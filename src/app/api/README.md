Routes are thin: parse the request, call src/server and src/ai, return a response
typed by src/lib/types.ts.

POST /api/sessions
POST /api/sessions/[id]/messages   (streamed)
POST /api/sessions/[id]/notebook
POST /api/sessions/[id]/exam
GET  /api/sessions/[id]/debrief
GET  /api/topics
GET  /api/progress
