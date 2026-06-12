// Thin IO glue: offset -> getUpdates -> parse -> dedup -> emit fresh signals JSON.
// Network + filesystem only; pure logic lives in telegram.mjs / dedup.mjs.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { parseUpdates } from './telegram.mjs'
import { fingerprint, isSeen, markSeen } from './dedup.mjs'

const OFFSET_PATH = '.hermes/tg-offset'

function getOffset() {
  if (!existsSync(OFFSET_PATH)) return 0
  return Number(readFileSync(OFFSET_PATH, 'utf8')) || 0
}
function setOffset(n) {
  mkdirSync('.hermes', { recursive: true })
  writeFileSync(OFFSET_PATH, String(n))
}

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN missing')
    process.exit(1)
  }
  const offset = getOffset()
  let json
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=0`)
    json = await res.json()
  } catch (err) {
    console.error(`getUpdates failed: ${err.message}`)
    process.exit(2) // offset NOT advanced — retried next loop
  }
  if (!json.ok) {
    console.error(`telegram error: ${JSON.stringify(json)}`)
    process.exit(2)
  }
  const { signals, nextOffset } = parseUpdates(json)
  const fresh = []
  for (const s of signals) {
    const fp = fingerprint(s)
    if (isSeen(fp)) continue
    markSeen(fp)
    fresh.push(s)
  }
  if (nextOffset != null) setOffset(nextOffset)
  process.stdout.write(JSON.stringify(fresh, null, 2))
}

main()
