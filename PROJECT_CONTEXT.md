# PROJECT_CONTEXT.md

## Implementation scope — 14 November 2026

The current user request covers **frontend and backend only**. ML modules and prompts are deferred. The original sections below describe the target MVP, not completed functionality.

The confirmed project name is **TeachAPP**. Existing browser storage and cookie keys retain their legacy prefix for compatibility with saved sessions.

- Implemented foundation: Next.js/TypeScript app, anonymous browser ID, Postgres schema, session/message persistence, read repositories, content loading and deterministic grading.
- The team's AI scaffold in `src/ai/` and prompt drafts in `prompts/` are preserved for the ML developer, but are not connected. The content templates follow the current validated loader contract; they are not live study content.
- Latest user decision: add a demo username/password option (`admin / admin`) alongside Email magic links and Google OAuth. The dark sign-in screen opens a separate form for each input method. Personal providers use verified Supabase bearer tokens; the shared demo uses a signed HttpOnly cookie.
- Session history is listed through `GET /api/sessions?offset=0` only after sign-in; guests receive 401. Both the header and the history section explain that an account is required.
- `POST /api/auth/claim` imports guest sessions and progress into the verified account. Account subjects are separate from internal app IDs; retired guest IDs cannot access the imported data.
- Both providers require Supabase URL/publishable key. Email additionally needs working SMTP delivery; Google needs its OAuth Web client configured in the Supabase Google provider. `npm run setup:local` prepares local database/environment settings and preserves existing settings; newly created settings enable demo auth with a generated signing secret. Provider setup is documented in README. Local tests do not prove real email delivery or Google sign-in.
- Demo sign-in is available in the UI when `DEMO_AUTH_ENABLED=true` and a suitable `AUTH_SECRET` are configured; PostgreSQL is also required. Current local settings enable it. The shared account has no administration privileges, uses an eight-hour signed HttpOnly cookie, and never imports personal guest sessions. Use it for demonstrations, not private study data.
- Google configuration uses the app origin in Google Authorized JavaScript origins, the Supabase callback from its provider dashboard in Google Authorized redirect URIs, and the app `/auth/callback` in Supabase's redirect allowlist. Client ID/secret stay in Supabase provider settings. Only identity/profile scopes are requested; see the [official setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-google).
- Content packages currently contain no study topics or questions; the UI displays an empty state.
- `POST /api/sessions` returns `firstMessage: null` until the Student module is connected.
- `POST /api/sessions/:id/messages` saves the user's message and returns `{ message }` as JSON. Streaming student replies are deferred.
- `GET /api/sessions/:id` is an additional session-resume endpoint returning `{ session, messages, notebook }`.
- Notebook generation, exams and debrief routes return `501 AI_NOT_CONNECTED` after checking session ownership.
- Progress returns the real UTC activity streak, with `topicOfTheDay: null` and `gaps: []` until the relevant modules are connected.
- Model-backed semantic honesty testing, attempt writes, exam-based progress updates, production deployment and the full end-to-end MVP remain outstanding.

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
| Вход в MVP | Быстрый старт гостем; история доступна после входа. Email (ссылка для входа) и Google через Supabase Auth; для демонстрации также логин и пароль admin / admin |

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
- Голосовой ввод (только если останется время после часа 18).
- Оплата по-настоящему. Достаточно экрана с тарифом; не имитировать успешный платёж.
- Функции для школ, компаний, преподавателей.
- Обычный режим "ИИ объясняет тему". Это убивает нашу отличительную механику.
- Обычный режим "пользователь сам решает тесты". Таких приложений много, наше отличие в том, что сдаёт ученик.

## 11. Что ещё нужно выяснить

- [ ] Точное время дедлайна и формат сдачи.
- [ ] Кто делает фронтенд, деку и README.
- [ ] Какую модель и чей API-ключ используем, какой лимит расходов.
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
