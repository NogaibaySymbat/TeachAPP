Routes are thin: parse the request, call src/server, and return a response
typed by src/lib/types.ts. All model calls use src/ai/client.ts and its shared budget.

GET  /api/sessions               (browser-owned paginated history)
POST /api/sessions
POST /api/sessions/[id]/messages   (currently JSON with the saved user message)
POST /api/sessions/[id]/reply      ({messageId} -> {message}; browser owner)
GET  /api/sessions/[id]            (session, topic, messages, notebook, learning, latestAttempt, previousAttempt, ai)
POST /api/sessions/[id]/notebook   ({} -> {notebook, learning}; browser owner)
POST /api/sessions/[id]/exam       ({} -> {attempt}; browser owner, fresh notebook)
GET/POST /api/sessions/[id]/debrief (optional attemptId -> saved {attemptId, gaps})
GET  /api/sessions/[id]/export     (owner-only JSON attachment, all saved modern + legacy attempts; no generation)
GET  /api/topics
GET  /api/progress

Student replies return one short JSON response after generation. User messages
are saved separately; retrying a completed reply returns its persisted message.
Replies require ownership, a configured OpenAI key, and remaining app budget.
Learning POSTs require same-origin JSON and browser/legacy account ownership. Completed learning
revisions are cached; durable claims prevent duplicate calls and stale writes.
Empty notebooks score zero without a model call. Attempts save immutable review
snapshots and deterministic gaps. Debrief and session GETs never generate output.
Progress includes saved gaps from the latest attempt per topic. Streaming remains
deferred. The current UI uses x-anonymous-id without login and omits legacy credentials.
Per-owner/operation cooldowns span sessions; cached results bypass the cooldown.
See the root README for history and legacy account behavior.
