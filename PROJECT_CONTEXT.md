# PROJECT_CONTEXT.md

Актуальная передача проекта команде: [TEAM_HANDOFF.md](TEAM_HANDOFF.md). Для Claude Code: [CLAUDE.md](CLAUDE.md). Русскоязычный план ниже implementation summary сохраняет исторические требования, в том числе к входу, стримингу и повторам запросов; это не описание текущего релиза. Текущее состояние и ограничения собраны в отчёте, новые явные указания пользователя имеют приоритет.

## Interface update — 15 November 2026

Published at https://teachapp.vercel.app as `dpl_2bopWWkw2iwWTejVfdKMHN1MjNjY` on 15 November 2026. No Git commit or push was made.

History now lives in a collapsible left sidebar on home and session pages, with an overlay drawer on narrow screens. The topic list is a styled native disclosure with status labels, best scores, and a selected checkmark; the selected topic's description appears below it. Selection closes the menu and restores focus; Escape and outside clicks close it too. Chat messages use distinct alignment, timestamps, a student header and grouped composer. Enter/Shift+Enter shortcuts respect IME composition. VoiceInput, browser IDs, API contracts and the shared $4 guard are unchanged. Safari verified topic selection, creation/history refresh and narrow drawer navigation; native textarea focus prevented end-to-end shortcut verification. Physical phone testing remains outstanding.

## Extension — 15 November 2026

Published at https://teachapp.vercel.app as `dpl_8UpBQBQwzu3dTHA4BUNbqcJBZbra`. Public production checks confirmed four topics, export of an existing saved attempt, and HTTP 404 for another browser. These checks made no model calls; no data or `ai_usage` migration/reset was performed.

Implemented latest/previous exam comparison, four practice topics / twelve original questions, and owner-only TXT/JSON session exports. Comparison uses immutable snapshots and disables deltas for changed questions; cited notes do not prove causality. Export reads all saved attempts in one consistent transaction, includes legacy results where available, and excludes browser access IDs. It does not restore browser access or support import.

275 tests in 24 files passed using isolated PostgreSQL; TypeScript/build and scoped lint passed. Safari TXT/JSON downloads and desktop comparison were verified with explicitly labelled local fixtures. Narrow layout reflow was also checked with Safari at 200% zoom; physical-phone verification remains outstanding. No paid AI calls, schema changes, voice changes or budget/ledger resets were needed. The user owns commit/push; a teammate owns the voice assistant.

## Implementation scope — 14 November 2026

The latest user decision is to **remove login from the interface and retain per-browser history and the complete AI workflow**. Vercel + Supabase hosting and the shared **$4** `ai_usage` guard remain. The browser keeps its random anonymous ID, omits old cookies/bearer tokens on study requests, and can reopen its own saved work. Clearing site data or changing browser/device loses access. Legacy account data is preserved, not distributed to guest users. Production demo login is disabled; legacy server authentication code is retained for compatibility.

The confirmed project name is **TeachAPP**. Existing browser storage and cookie keys retain their legacy prefix for compatibility with saved sessions.

- Previous guest deployment: `dpl_B3BgHY8JKdpZtRU7X3qqBs2r9zM7` at https://teachapp.vercel.app. All 263 tests passed with isolated PostgreSQL; typecheck, scoped lint and cloud build passed. Production guest history, paid reply/notebook/exam (3/3), cached IDs, cross-browser 404 isolation, login redirect, and disabled demo login were verified. No database migration or spending-ledger reset.
- Implemented foundation: Next.js/TypeScript app, anonymous browser ID, Postgres schema, session/message persistence, read repositories, content loading and deterministic grading.
- `src/ai/client.ts` is the only OpenAI HTTP boundary. Student uses `prompts/student.md`, the topic title, and bounded conversation history; answer keys/key ideas are not provided to the student. Notebook and examinee use strict structured output schemas plus source/ID checks. Debriefs use authored content and code without another model call.
- OpenAI configuration is server-only: `OPENAI_API_KEY`, `OPENAI_MODEL=gpt-6-luna`, `OPENAI_BUDGET_USD=4`. Only this priced model is accepted. Output limits: student 256 tokens, notebook 1,024, exam 768; provider hard ceiling 1,536. At most 6,000 counted input tokens, no reasoning, tools or automatic retries. Chat uses the latest 12 messages within 12,000 characters; each explanation may contain at most 4,000 characters. Notebook extraction uses all user explanations up to 24 messages/12,000 characters, rejecting longer sessions without replacing existing notes.
- PostgreSQL `ai_usage` reserves a conservative cost before each generation, atomically across processes. Reservations survive restarts, errors, and deleted sessions. The total budget defaults to $4 (may be lowered to 0–4), is shared by all users, and does not reset daily. It estimates this app's requests using checked prices; it does not read the OpenAI balance or cover other apps. See README for prices and setup.
- Microphone input uses browser SpeechRecognition/webkitSpeechRecognition, with Russian/English selection and an explicit start/stop/review/add flow. No OpenAI transcription calls or audio storage are added. The browser may send audio to its own speech service; this is disclosed before starting. Typed drafts are preserved, dictation never sends a message automatically, and a one-minute/remaining-character cap plus page-hide/unmount cleanup bound capture. Unsupported or insecure contexts retain ordinary typing. Unit tests simulate the speech service; real device recognition remains a manual check.
- The workspace has no login controls or AuthProvider. `/login` and `/auth/callback` redirect home. History loads for the resolved browser identity, with pagination and an explicit browser-storage limitation notice.
- Paid replies, notebook extraction, and exams accept guest owners through the existing identity/ownership checks and same-origin JSON boundary. Reply claims have a three-second owner cooldown; notebook/exam cooldowns now span every session of that owner per operation. Row locks serialize concurrent claims; cached results bypass cooldown and spending.
- Normal browser API calls use `credentials: omit` and remove authorization headers. Old demo cookies cannot mix shared history into the guest workspace. Explicit legacy API auth retains its validation rules; guest IDs cannot impersonate account IDs or retired identities.
- `POST /api/sessions/:id/messages` saves the user's message and returns `{ message }` as JSON. A separate owner-checked `POST /api/sessions/:id/reply { messageId }` generates and persists `{ message }`. Ownership is checked before generation. Repeated completed requests reuse the saved answer; pending jobs and a short per-owner cooldown prevent concurrent duplicate calls. Failed replies can be retried explicitly without resending the explanation. Streaming is deferred.
- `GET /api/sessions/:id` resumes `{ session, topic, messages, notebook, learning, latestAttempt, previousAttempt, ai }`; `learning` reports revision/freshness and question count, `ai` reports configuration availability, and student messages include `replyToMessageId`.
- The interface updates the notebook after each explanation, with manual retry/update controls. Each note is an exact quote from a user message with a source link. Mistakes remain as taught. POST notebook/exam require the browser/legacy account owner and same-origin JSON; completed revisions are cached. Short durable claims fence concurrent/stale writes. GET requests never generate paid output.
- The examinee sees only public questions/options and the notebook, never keys, key ideas or the chat. Empty notebooks produce zero without an API call. Code grades keys and rejects guesses or invalid references. Attempts save question/notebook snapshots and deterministic review guidance atomically; GET/POST debrief only reads that saved result. New explanations visibly invalidate the notebook/result until updated/retested.
- Progress returns the real UTC activity streak and gaps from the latest attempt per topic, with `topicOfTheDay: null`. All practice questions correct marks a topic passed in this app; best score and results persist in history.
- Exact quote/source and grading checks are deterministic; whether evidence is semantically relevant still depends on the model. Unit tests mock it, and live checks are samples, not a universal honesty guarantee. Production runtime, ledger/cache, and browser checks passed; a full PMP package, adaptive planning, and broader model evaluation remain outstanding.
- Initial cloud release verified (historical, before the login-free interface): Vercel project **teachapp** in **BusinessCup** is running at **https://teachapp.vercel.app**, deployment `dpl_CC4HrfwWqXt1aWZfcy4HNk11H5iW`; the public page returns HTTP 200. Supabase project **TeachAPP** is in **Singapore**. Eight production API checks returned HTTP 200: demo sign-in restores the same account, imported history is present, and three notebook entries, the saved 3/3 exam, and debrief are readable. Cached repeats preserve the notebook/attempt IDs with cloud AI disabled. With the $4 production cap active, all three live AI calls returned HTTP 200: student reply, three exact-source notebook notes, and a 3/3 exam; the saved debrief also returned HTTP 200. Chrome checks confirmed `admin / admin` sign-in, imported/new sessions on the dashboard, and the new session's reply, three notes, and 3/3 result. `.vercelignore` excludes local secrets/database files from CLI uploads. The user performs all Git commits and pushes themselves.
- The cloud migration is complete: **39 records in 10 application tables** match the frozen local snapshot by full-row fingerprints and counts; RLS is enabled on all 10 tables. All **4 `ai_usage` reservations**, totalling **$0.00206475** with no budget block, were preserved. This is reserved usage, not a provider bill. Guest data keeps its owner; the new web origin does not automatically inherit localhost's browser ID or merge guest sessions into the shared demo account. Backups and verification artifacts are in ignored `.data/`; do not reimport into the populated target.
- Production usage/cache verification: three fresh AI calls added **$0.001468** in conservative reservations, bringing the shared ledger to **7 reservations / 3,532,750 nanodollars ($0.00353275)** with `budget_blocked=false`. Repeated reply/notebook/exam requests returned the same saved IDs; post-repeat SQL verified exactly unchanged count, sum, and blocked status. These are conservative guard values, not OpenAI billed charges.
- Cutover protection: local `OPENAI_BUDGET_USD` remains **0**, and the local app server is stopped. Production `OPENAI_BUDGET_USD=4` and `OPENAI_MODEL=gpt-6-luna` are active against the migrated shared ledger; the original reservations remain included. Live generation and unchanged reservations on cached repeats passed verification. Any other instance must use the same durable cloud ledger before paid AI is enabled; keeping the old local database with another $4 allowance would reset the guard.
- Production PostgreSQL uses the transaction pooler, `sslmode=verify-full`, and a multiline `DATABASE_SSL_CA` PEM downloaded from Supabase Database Settings. `src/server/database-config.ts` retains Node's default CA set, adds the Supabase CA, and enforces certificate and hostname validation without URL SSL options overriding it. The operational certificate copy is ignored at `.data/cloud/supabase-ca.pem`. HTTP and idle-connection diagnostics log only fixed allowlisted categories/codes, never raw error messages or credentials.
- Supabase Auth Site URL is configured as **https://teachapp.vercel.app**, and **https://teachapp.vercel.app/auth/callback** is allowed. Google OAuth credentials and custom SMTP are still unconfigured; personal sign-in is not ready for general users. Production `admin / admin` sign-in has passed its runtime check and restores the existing demo account.

---

Контекст проекта для команды и для ИИ-агентов, которые помогают писать код.
Прочитай этот файл целиком перед любой задачей. Если задача противоречит файлу, сначала уточни у человека.

Последнее обновление: 14 ноября 2026 (Астана).

---

## 1. Что происходит

Мы участвуем в хакатоне **Business Cup 2.0 "From Zero to Product"** (AIESEC, Zimran, Nazarbayev University), 14–15 ноября 2026.
За 24 часа нужно сделать работающий продукт и защитить его.

- Формат защиты: питч 5 минут + 2 минуты вопросов.
- Сдаём три вещи: **дека, ссылка на работающий продукт, репозиторий**. Без любой из них дисквалификация.
- Топ-10 финалистов борются за ₸5 000 000.
- Точное время дедлайна: **TODO, вписать**.

## 2. Что мы делаем (одной фразой)

Веб-приложение, в котором человек готовится к экзамену PMP, **объясняя темы ИИ-ученику, а затем ученик сдаёт за него экзаменационные вопросы**, опираясь только на то, чему его научили. Результат ученика показывает, готов ли пользователь по этой теме.

Название проекта: **TeachAPP**.

## 3. Решения, которые уже приняты

Не пересматривать без согласия всей команды.

| Вопрос | Решение |
|---|---|
| Название проекта | TeachAPP |
| Трек | Skills |
| Целевой рынок | Жители США, 25–45 лет |
| Пользователь | Работающий специалист, который готовится к экзамену PMP и платит за подготовку сам |
| Боль | "Я читаю материал и думаю, что понял, а на ситуационных вопросах проваливаюсь" |
| Механика | Пользователь учит ИИ-ученика, затем ученик сдаёт вопросы в стиле PMP только по тому, чему его научили |
| Главная метрика для пользователя | Результат ученика на экзамене по теме (например, 3 из 5), а не абстрактная оценка понимания |
| Первый экзамен | PMP, только он |
| Платформа | Веб. Мобильные приложения и Telegram-боты запрещены правилами |
| Модель | B2C. Продаём человеку, не школам и не работодателям |
| Язык продукта | Английский: интерфейс, промпты, контент, дека |
| Монетизация (гипотеза) | Подписка на период подготовки с бесплатным пробным доступом |
| Вход в MVP | Без входа. История и прогресс привязаны к браузеру; очистка данных или другое устройство не восстанавливают прежнюю историю. Кнопки входа убраны |
| Облачный ИИ | OpenAI GPT-6 Luna: диалог, тетрадь с источниками и экзамен ученика. Разбор и оценка — кодом. Генерация доступна гостям; общий консервативный лимит приложения $4 из стартовых $5, ограниченный контекст |
| Размещение | Vercel (teachapp, BusinessCup) + Supabase (TeachAPP, Singapore); https://teachapp.vercel.app. История и ai_usage перенесены; вход, сохранённые результаты, три новых вызова ИИ и интерфейс проверены. Общий лимит $4 действует, повторные запросы не увеличили резерв расходов; локальный ИИ выключен |
| Микрофон | Браузерное распознавание речи без расходов OpenAI: русский/английский, предпросмотр и ручное добавление текста в объяснение |

Почему PMP: аудитория точно 25–45, платят сами, вопросы экзамена ситуационные и требуют понимания, тему может объяснить на демо любой из нас.

Другие экзамены (NCLEX, CPA, ИТ-сертификаты) в продукт **не добавляем**. В питче они идут как план роста. В коде экзамен должен быть отделён от движка (см. раздел 7), чтобы это было видно в репозитории.

## 4. Критерии жюри

Каждое решение проверяй по этой таблице.

| Вес | Критерий | Что это значит для нас |
|---|---|---|
| 40% | Does it work? | Работает от начала до конца в продакшене. Ценность настоящая, не захардкожена. Жюри читает репозиторий: качество UX и кода |
| 20% | What do we sell? | Понятно, за что платит пользователь и зачем вернётся завтра |
| 15% | Who do we sell to? | Чёткая проблема, глубокое понимание пользователя |
| 15% | Why does it make money? | Большая или растущая ниша, путь к $100M ARR, LTV > CAC |
| 10% | Is it new? | Не копия существующего бизнеса |

Условия допуска (pass/fail): только B2C, только веб, все три материала сданы.

Следствия:
- Никаких моков и заранее записанных ответов. Каждый ответ ученика и каждая оценка приходят от модели в реальном времени.
- Продукт должен быть задеплоен и доступен по публичной ссылке.
- Репозиторий должен быть чистым: понятная структура, README, никаких секретов в коде.
- В интерфейсе должен быть виден механизм возврата (см. раздел 6).

## 5. Путь пользователя (MVP)

1. **Старт гостем или с аккаунтом.** При первом визите создаётся анонимный ID, пользователь сразу попадает к выбору темы. Для доступа к истории нужно войти через Email или Google. После подтверждённого входа гостевые занятия и прогресс переносятся в личный аккаунт.
2. **Выбор темы.** Список тем PMP, у каждой виден статус: не начата, ученик не сдал, ученик сдал.
3. **Объяснение.** Чат. Пользователь объясняет тему своими словами. Ученик переспрашивает, просит пример и иногда неверно пересказывает услышанное, чтобы пользователь поправил.
4. **Тетрадь ученика.** После объяснения пользователь видит список утверждений, которые ученик "записал" с его слов. Это всё, что ученик знает по теме.
5. **Экзамен ученика.** Ученик отвечает на 3–5 ситуационных вопросов в стиле PMP. Для каждого ответа показано обоснование со ссылкой на запись в тетради. Если нужной записи нет, ученик прямо говорит: "You didn't teach me this, I guessed", и вопрос считается проваленным.
6. **Разбор.** Результат (например, 3 из 5) и по каждому проваленному вопросу: какой идеи не хватило в объяснении.
7. **Переобъяснить и пересдать.** Пользователь дообъясняет пробелы, тетрадь пополняется, ученик пересдаёт.
8. **Прогресс.** Главный экран: карта тем, серия дней, рекомендованная тема на сегодня.

### Почему тетрадь обязательна

Модель и так знает PMP. Если просто попросить её "отвечать только по объяснению пользователя", она ответит правильно из собственных знаний, и ученик сдаст экзамен при любом объяснении. Это сделало бы главную ценность продукта фальшивой (критерий 40%: "the core value is real, not faked").

Поэтому на экзамене ученик **не получает историю диалога**, только тетрадь, и обязан привязать каждый ответ к записи в ней.

## 6. Зачем пользователь вернётся завтра

Это 20% оценки, поэтому входит в MVP, а не в "потом".

- Проваленные учеником темы, которые хочется пересдать.
- Карта пробелов, которая сокращается от сессии к сессии.
- Серия дней подряд (streak).
- Тема дня: система сама предлагает, что объяснять сегодня (сначала слабые темы).
- Ученик "растёт": его тетрадь по каждой теме сохраняется и пополняется, результат на экзамене улучшается.

## 7. Архитектура

Стек ниже предложен по умолчанию. **Бэкенд-разработчики подтверждают или меняют его в первый час**, после чего обновляют этот раздел.

- Фронтенд: Next.js (TypeScript), деплой на Vercel.
- Бэкенд: API-маршруты Next.js или отдельный сервис, на выбор бэкенд-команды.
- База: Postgres (например, Supabase).
- Для просмотра истории вход обязателен. Гость использует ID браузера; личный аккаунт — Supabase Auth с Email magic link или Google OAuth. Сервер проверяет токен и определяет внутренний ID. После входа гостевые сессии и прогресс переносятся в личный аккаунт. Для демонстрации добавлен отдельный вход admin / admin с подписанной HttpOnly-cookie; он включается серверной настройкой и не переносит личную гостевую историю в общий аккаунт.
- ИИ: вызовы LLM только с сервера. Ключ хранится в переменных окружения.

Главный принцип: **движок не знает про PMP**. Экзамен подключается как пакет контента:

```
/content/exams/pmp/
  exam.json        # название, описание, список тем
  topics/*.json    # по файлу на тему: ключевые идеи, типичные заблуждения
  questions/*.json # по файлу на тему: 3–5 ситуационных вопросов, верный ответ, какие ключевые идеи нужны для ответа
```

Добавление второго экзамена должно означать новую папку, а не правки кода.

### Модули ИИ (зона ответственности ИИ-разработчика)

| Модуль | Что делает | Вход | Выход |
|---|---|---|---|
| Student | Играет ученика в диалоге: переспрашивает, просит пример, иногда неверно пересказывает | Тема, история диалога, текущая тетрадь | Реплика ученика (стрим) |
| Notebook | Выписывает, чему пользователь реально научил | Тема, реплики пользователя | Список утверждений (JSON), каждое со ссылкой на реплику-источник |
| Examinee | Ученик сдаёт экзамен | Вопрос с вариантами, **только тетрадь** | Выбранный ответ, обоснование, ID записей тетради или пометка "не учили" (JSON) |
| Debrief | Разбирает результат | Вопросы, ответы ученика, тетрадь, ключевые идеи темы | По каждому проваленному вопросу: какой идеи не хватило |
| Planner | Выбирает тему дня | Прогресс пользователя | ID темы и причина |

Требования:
- Notebook записывает только то, что сказал пользователь, включая его ошибки. Он ничего не исправляет и не дополняет от себя.
- Examinee не видит диалог и не использует собственные знания о PMP. Ответ без ссылки на запись тетради помечается как угаданный и не засчитывается.
- Правильность ответа проверяет код по ключу из `questions/*.json`, а не модель.
- Все модули, кроме Student, возвращают строго JSON по схеме. Невалидный ответ повторяется один раз, затем возвращается ошибка.
- Student не выдаёт правильные ответы и не превращается в преподавателя.
- Вопросы пишем сами. Не копировать из платных банков вопросов и материалов PMI.
- В интерфейсе и деке не обещать предсказание балла на настоящем экзамене. Формулировка: "shows whether you're ready on this topic".

Проверка честности (обязательный тест перед сдачей): пустое или бессмысленное объяснение должно давать ученику 0 правильных ответов.

### Контракт API (черновик, согласовать в первый час)

```
POST /api/sessions                 { topicId }   -> { sessionId, firstMessage }
POST /api/sessions/:id/messages    { text }      -> поток: реплика ученика
POST /api/sessions/:id/notebook    {}            -> { notebook: [{ id, claim, sourceMessageId }] }
POST /api/sessions/:id/exam        {}            -> { results: [{ questionId, answer, correct, reasoning, notebookRefs[], guessed }], score }
GET  /api/sessions/:id/debrief                   -> { gaps: [{ questionId, missingIdea }] }
GET  /api/topics                                 -> [{ id, title, status, bestScore }]
GET  /api/progress                               -> { streak, topicOfTheDay, gaps[] }
```

Повторное объяснение: новые сообщения в ту же сессию, затем снова `notebook` и `exam`.

### Данные (черновик)

- `users`: id (внутренний ID аккаунта или гостя), auth_subject (проверенный ID Supabase), demo_username (уникальный логин временного аккаунта), claimed_by (аккаунт, которому передан гостевой ID), created_at
- `sessions`: id, user_id, topic_id, started_at, finished_at
- `messages`: id, session_id, role (user | student), text, created_at
- `notebook_entries`: id, session_id, claim, source_message_id
- `exam_attempts`: id, session_id, score, created_at
- `exam_answers`: attempt_id, question_id, answer, correct, guessed, reasoning, notebook_refs[]
- `topic_progress`: user_id, topic_id, status, best_score, last_session_at

## 8. Роли

| Кто | Зона |
|---|---|
| ИИ-разработчик | Промпты и логика Student, Notebook, Examinee, Debrief, Planner; JSON-схемы; контент-пакет PMP (темы и вопросы); тест честности |
| Бэкенд 1 | API, база данных, анонимные пользователи |
| Бэкенд 2 | Деплой, окружение, стриминг ответов, интеграция с модулями ИИ |

**Открытый вопрос: кто делает фронтенд.** В команде нет выделенного фронтенд-разработчика, а UX входит в 40% оценки. Решить в первый час.

Также без владельца: дека и питч, README.

## 9. План (подстроить под реальный дедлайн)

| Этап | Что готово |
|---|---|
| Час 0–1 | Подтверждён стек, согласован контракт API, создан репозиторий, пустое приложение задеплоено |
| Час 1–6 | Работает сквозной сценарий на одной теме: объяснение, тетрадь, экзамен ученика, разбор; пусть некрасиво |
| Час 6–12 | Анонимный ID, сохранение сессий, 6–8 тем PMP с вопросами, пересдача, экран прогресса |
| Час 12–18 | Серия дней, тема дня, полировка интерфейса, обработка ошибок |
| Час 18–21 | Заморозка функций. Тестирование, исправление багов, README |
| Час 21–24 | Дека, репетиция питча, запасная запись демо на случай сбоя сети |

Правило: в любой момент после шестого часа в продакшене лежит работающая версия.

## 10. Чего не делаем

- Другие экзамены, кроме PMP.
- Мобильное приложение, Telegram-бот.
- Регистрация личных аккаунтов по паролю и социальные провайдеры кроме Google. Личный вход — Email magic link или Google; admin / admin используется только как общий демоаккаунт.
- Голосовой разговор с ИИ и озвучка ответов. Сейчас подключён только голосовой ввод текста по отдельному запросу пользователя.
- Оплата по-настоящему. Достаточно экрана с тарифом; не имитировать успешный платёж.
- Функции для школ, компаний, преподавателей.
- Обычный режим "ИИ объясняет тему". Это убивает нашу отличительную механику.
- Обычный режим "пользователь сам решает тесты". Таких приложений много, наше отличие в том, что сдаёт ученик.

## 11. Что ещё нужно выяснить

- [ ] Точное время дедлайна и формат сдачи.
- [ ] Кто делает фронтенд, деку и README.
- [x] OpenAI API пользователя, экономная GPT-6 Luna, общий лимит TeachAPP $4. Ключ добавляется локально в `OPENAI_API_KEY`; реальный вызов нужно проверить после его настройки.
- [ ] Актуальная структура экзамена PMP: сверить темы с действующим документом PMI (Exam Content Outline), не полагаться на память.
- [ ] Цифры для деки: число сдающих PMP в год, стоимость экзамена, цены конкурентов. Только из проверяемых источников со ссылками.
- [ ] Конкуренты: кто уже делает "обучение через объяснение ИИ" и чем мы отличаемся.

## 12. Правила для ИИ-агентов

1. Весь текст в продукте, промпты, комментарии в коде и коммиты пишутся на английском.
2. Не добавляй функции из раздела 10 и не расширяй объём без запроса человека.
3. Не хардкодь ответы модели, оценки и демо-данные, выдаваемые за настоящие.
4. Не клади секреты в код. Только переменные окружения, плюс `.env.example` без значений.
5. Не меняй контракт API и схему данных молча. Сначала предложи изменение, после согласования обнови этот файл.
6. Всё, что относится к PMP, лежит в `/content/exams/pmp/`. В коде движка не должно быть слова "PMP".
7. Пиши простой читаемый код: жюри читает репозиторий. Небольшие файлы, понятные имена, без мёртвого кода.
8. Не выдумывай факты об экзамене PMP и рыночные цифры. Если данных нет, оставь TODO и скажи человеку.
9. Перед завершением задачи проверь, что приложение собирается и основной сценарий из раздела 5 работает.
10. Если принято новое решение, допиши его в раздел 3 и обнови дату вверху файла.

### Workspace palette refresh — 15 November 2026

The home page, history, topic chooser, chat, notebook and exam review now use the supplied Pearl / Harbor / Midnight / Santorini / Sea Green palette. Manrope is self-hosted with its OFL license in `public/fonts/`. Conversation behavior, browser ownership, voice integrations and the shared OpenAI budget are unchanged. Desktop Safari and a narrow layout via browser zoom were checked; physical phone testing remains outstanding. All 294 existing tests passed against isolated local PostgreSQL. See `DESIGN.md` for the current visual system.
