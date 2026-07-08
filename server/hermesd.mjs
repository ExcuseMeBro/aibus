// hermesd — headless, Telegram-driven Hermes orchestrator (Design B).
// Everything happens over Telegram: a task message triggers PO triage; every
// human gate is an inline-button approve/reject. Claude (via `claude -p`, Max
// subscription auth on the host) supplies the reasoning; this daemon owns all IO
// (Plane REST, telegram, state). Run 24/7 under systemd — see hermesd.service.
//
//   HERMES_MODE=real node server/hermesd.mjs

import { parseRoles } from '../ingest/roles.mjs'
import { fingerprint, checkAndMark } from '../ingest/dedup.mjs'
import { buildGate } from '../ingest/gate.mjs'
import { sendGate, ackCallback } from '../ingest/gate-io.mjs'
import { getAdapters } from '../adapters/index.mjs'
import { runAgent } from './claude-agent.mjs'
import { State } from './state.mjs'
import { classify, nextOffset } from './router.mjs'
import { advanceFromGate, gateForState, gateSummary } from './ladder.mjs'

const TG = 'https://api.telegram.org'
const UI_RE = /\b(ui|ux|design|screen|page|button|layout|frontend|mobile app)\b/i

// --- claude-backed role agents (reasoning only; daemon does the IO) ----------
function makeAgents() {
  return {
    po: (text) => runAgent('po', text, { schemaHint: '{"type":"bug|feature","priority":"urgent|high|medium|low","title":"...","description":"...","acceptance":["..."],"needsUi":true|false}' }),
    pm: async (issue) => {
      const raw = await runAgent('pm', issue, { schemaHint: '{"sub":[{"title":"..."}]} — ordered sub-tasks' })
      const arr = Array.isArray(raw) ? raw : (raw.sub || raw.subtasks || raw.tasks || [])
      return arr.map(s => (typeof s === 'string' ? { title: s } : { title: s.title || s.name || String(s) }))
    },
    design: (issue) => runAgent('design', issue, { schemaHint: '{"notes":"prototype description"}' }),
    dev: (sub) => runAgent('dev', sub, { schemaHint: '{"branch":"feature/...","title":"feat: ...","summary":"..."}' }),
    marketing: (issue) => runAgent('marketing', issue, { schemaHint: '{"releaseNotes":"..."}' }),
  }
}

// --- telegram IO -------------------------------------------------------------
async function getUpdates(token, offset) {
  const res = await fetch(`${TG}/bot${token}/getUpdates?offset=${offset}&timeout=25`)
  const j = await res.json()
  if (!j.ok) throw new Error(`getUpdates: ${JSON.stringify(j).slice(0, 200)}`)
  return j.result || []
}

async function sendGateFor(ctx, issue, gate) {
  const gateId = ctx.state.putGate({ issueId: issue.id, gate, chatId: issue.chat_id })
  const payload = buildGate({ gate, gateId, title: issue.title, summary: gateSummary(gate, issue), chatId: issue.chat_id })
  await sendGate(ctx.token, payload)
  ctx.adapters.log?.('info', { action: 'gate_sent', issueId: issue.id, gate, gateId })
}

// --- handlers ----------------------------------------------------------------
async function handleSignal(ctx, signal) {
  if (!checkAndMark(fingerprint(signal))) return // duplicate → skip
  await ctx.notify.send(signal.chat_id, `📥 got it — triaging: "${signal.text.slice(0, 80)}"`)
  const po = await ctx.agents.po(signal.text)
  const issue = await ctx.adapters.plane.createIssue({
    title: po.title || signal.text.slice(0, 80),
    description: po.description || signal.text,
    type: po.type || 'feature',
    priority: po.priority || 'medium',
    acceptance: Array.isArray(po.acceptance) ? po.acceptance : [],
    needsUi: po.needsUi ?? UI_RE.test(signal.text),
    state: 'triage',
    chat_id: signal.chat_id,
  })
  ctx.adapters.log?.('info', { action: 'triaged', issueId: issue.id, from: signal.from })
  await sendGateFor(ctx, issue, 'roadmap')
}

async function handleGate(ctx, d) {
  // d = { gate, gateId, decision, userId, callbackId, chatId, authorized, reason }
  if (!d.authorized) { await ackCallback(ctx.token, d.callbackId, `⛔ ${d.reason}`); return }
  const rec = ctx.state.getGate(d.gateId)
  if (!rec) { await ackCallback(ctx.token, d.callbackId, 'gate expired'); return }
  const issue = ctx.adapters.plane.getIssue(rec.issueId)
  if (!issue) { await ackCallback(ctx.token, d.callbackId, 'issue gone'); ctx.state.delGate(d.gateId); return }

  ctx.state.delGate(d.gateId)
  if (d.decision === 'reject') {
    ctx.adapters.plane.updateIssue(issue.id, { state: 'cancelled' })
    await ackCallback(ctx.token, d.callbackId, '❌ rejected')
    await ctx.notify.send(issue.chat_id, `❌ ${issue.id} "${issue.title}" — rejected at ${d.gate} gate, closed.`)
    return
  }
  await ackCallback(ctx.token, d.callbackId, '✅ approved')
  try {
    const r = await advanceFromGate(d.gate, issue, ctx)
    if (r.gate) {
      await sendGateFor(ctx, r.issue, r.gate)
    } else {
      await ctx.notify.send(issue.chat_id, `🎉 ${issue.id} "${issue.title}" — shipped & published.`)
    }
  } catch (e) {
    await ctx.notify.send(issue.chat_id ?? ctx.defaultChat, `🚨 ${issue.id} failed at ${d.gate}: ${e.message}`)
    ctx.adapters.log?.('error', { action: 'gate_advance_failed', issueId: issue.id, gate: d.gate, error: e.message })
  }
}

async function tick(ctx) {
  const updates = await getUpdates(ctx.token, ctx.state.getOffset())
  for (const u of updates) {
    try {
      const intent = classify(u, ctx.rolesMap, ctx.botUsername)
      if (intent.kind === 'signal') await handleSignal(ctx, intent.signal)
      else if (intent.kind === 'gate') await handleGate(ctx, intent)
    } catch (e) {
      ctx.adapters.log?.('error', { action: 'update_failed', error: e.message })
    }
  }
  const next = nextOffset(updates)
  if (next != null) ctx.state.setOffset(next) // advance only after the batch is handled
}

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) { console.error('TELEGRAM_BOT_TOKEN missing'); process.exit(1) }
  const ctx = {
    token,
    defaultChat: process.env.HERMES_CHAT_ID,
    botUsername: process.env.BOT_USERNAME,
    rolesMap: parseRoles(process.env.HERMES_ROLES),
    adapters: getAdapters('real'),
    agents: makeAgents(),
    state: new State(),
  }
  ctx.notify = ctx.adapters.notify
  console.error(`[hermesd] online · mode=real · roles=${Object.keys(ctx.rolesMap).length} · offset=${ctx.state.getOffset()}`)
  if (ctx.defaultChat) await ctx.notify.send(ctx.defaultChat, '🪽 hermesd online — send a task or /task <text>')

  let backoff = 1000
  for (;;) {
    try { await tick(ctx); backoff = 1000 }
    catch (e) {
      console.error(`[hermesd] tick error: ${e.message} — retry in ${backoff}ms`)
      await new Promise(r => setTimeout(r, backoff))
      backoff = Math.min(backoff * 2, 30000)
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main()
