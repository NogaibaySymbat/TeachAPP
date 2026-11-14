Routes are thin: parse the request, call src/server, and return a response
typed by src/lib/types.ts. The src/ai scaffold is reserved for future integration.

POST /api/sessions
POST /api/sessions/[id]/messages   (currently JSON with the saved user message)
POST /api/sessions/[id]/notebook
POST /api/sessions/[id]/exam
GET  /api/sessions/[id]/debrief
GET  /api/topics
GET  /api/progress

Student reply streaming, notebook generation, exams, and debriefs are pending
AI integration. The latter three endpoints currently return AI_NOT_CONNECTED
after checking session ownership. See the root README for the current auth
and session-history endpoints.
