// Thin telegram IO for gates: send an approval prompt, ack a button press.
// Network only — pure gate logic lives in gate.mjs. fetchFn is injectable so
// the request shape is testable without a real network call.

async function call(token, method, body, fetchFn) {
  if (!token) throw new Error('gate-io: telegram token missing')
  const res = await fetchFn(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

// Post a buildGate() payload to the chat. Returns telegram's JSON response.
export function sendGate(token, payload, fetchFn = fetch) {
  return call(token, 'sendMessage', payload, fetchFn)
}

// Acknowledge a callback_query so the button stops spinning + show a toast.
export function ackCallback(token, callbackId, text, fetchFn = fetch) {
  return call(token, 'answerCallbackQuery', { callback_query_id: callbackId, text }, fetchFn)
}
