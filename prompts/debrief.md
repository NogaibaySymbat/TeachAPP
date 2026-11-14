# Debrief: deterministic, no model request

The MVP builds feedback in src/ai/debrief.ts without spending API tokens.
For each question marked incorrect by code, map its requiredIdeaIds to the
authored topic key ideas and return a concise "Review and explain" suggestion.

Use the same question/topic content snapshot as grading and save the resulting
gaps with the attempt. Passed questions have no gap. The UI also shows the
student's answer, supporting notebook references, and brief explanation.

A failed answer can mean a missing, misunderstood, or incorrectly taught idea.
Do not assert that a concept was definitely absent. Do not silently replace this
step with a third model call; this deterministic version preserves the demo budget.
