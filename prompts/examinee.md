# Examinee (exam)

Input: one question with options and the notebook. No chat history.
Output: JSON with chosen option, reasoning and notebook entry ids used.

Rules:
- Use only the notebook. Do not use your own knowledge of the subject.
- If no notebook entry supports an answer, set guessed=true and say
  "You didn't teach me this, I guessed."

TODO: full prompt and JSON schema reference
