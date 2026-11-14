// Opt-in live experiment. Uses the deployed app's shared budget guard, not a
// separate OpenAI key or ledger. Creates sessions for independent browser identities.
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const origin = 'https://teachapp.vercel.app';
const conditions = [
  {
    id: 'unrelated', repeats: 3,
    teaching: 'For this experiment: a banana smoothie contains banana and milk. Blend them together until smooth, then serve the drink cold.',
    expected: [null, null, null],
  },
  {
    id: 'irrelevant-register', repeats: 3,
    teaching: "A stakeholder register is a document that records stakeholders' names and contact details.",
    expected: [null, null, null],
  },
  {
    id: 'partial-identification', repeats: 3,
    teaching: 'Stakeholders are people or groups affected by the project or able to influence it, including people outside the delivery team.',
    expected: ['b', null, null],
  },
  {
    id: 'wrong-communication', repeats: 3,
    teaching: 'The correct way to communicate with project stakeholders is to send every group the same daily technical report. Never adapt the information, channel, or schedule to the needs of different groups.',
    expected: [null, 'a', null],
  },
  {
    id: 'complete-control', repeats: 1,
    teaching: "Stakeholders are people or groups affected by the project or able to influence it, including people outside the delivery team. Understand each stakeholder's needs and influence; agree on useful information, a suitable communication channel, and timing, and invite feedback. Revisit stakeholders and the engagement plan throughout the project, especially when scope, people, or needs change, and update the plan using feedback.",
    expected: ['b', 'd', 'a'],
  },
];
const questionIds = ['stakeholders-demo-identify', 'stakeholders-demo-communicate', 'stakeholders-demo-review'];
const report = {
  startedAt: new Date().toISOString(), origin,
  design: 'Predefined expectations; independent fresh sessions; no retries or prompt changes; no chat reply calls.',
  maximumReservationUsd: 0.050648,
  conditions, trials: [],
};
if (!process.argv.includes('--live')) {
  console.log(JSON.stringify({ ...report, instructions: 'Run with --live to create 13 browser-owned sessions and spend up to $0.050648 through the shared $4 guard.' }, null, 2));
  process.exit(0);
}
const output = path.resolve('reports/notebook-grounding', report.startedAt.replaceAll(':', '-'));
await fs.mkdir(output, { recursive: true });
let browserId = '';

async function save() {
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n');
}
async function request(route, body) {
  const response = await fetch(origin + route, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', 'x-anonymous-id': browserId },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(65000), redirect: 'error',
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} at ${route}`);
  return response.json();
}
await save();
try {
  for (const condition of conditions) {
    for (let run = 1; run <= condition.repeats; run++) {
      browserId = randomUUID();
      const trial = { condition: condition.id, run, startedAt: new Date().toISOString() };
      // Browser IDs grant access: keep them only in the ignored operational copy.
      await fs.mkdir('.data/experiments', { recursive: true });
      await fs.appendFile('.data/experiments/browser-identities.jsonl', JSON.stringify({ startedAt: report.startedAt, condition: condition.id, run, browserId }) + '\n', { mode: 0o600 });
      report.trials.push(trial);
      try {
        const created = await request('/api/sessions', { topicId: 'stakeholders-demo' });
        trial.sessionId = created.sessionId;
        trial.url = `${origin}/session/${trial.sessionId}`;
        await save();
        const prefix = '/api/sessions/' + trial.sessionId;
        const { message } = await request(prefix + '/messages', { text: condition.teaching });
        trial.messageId = message.id;
        const { notebook } = await request(prefix + '/notebook', {});
        trial.notebook = notebook;
        trial.sourceQuotesValid = notebook.every(n => n.sourceMessageId === message.id && condition.teaching.includes(n.claim));
        // The empty-notebook branch is deterministic. Do not count it as a
        // live examinee success even though it gives the expected zero score.
        trial.examineeModelCalled = notebook.length > 0;
        await save();
        const { attempt } = await request(prefix + '/exam', {});
        trial.attempt = attempt;
        trial.actual = questionIds.map(id => attempt.results.find(r => r.questionId === id)?.answer ?? null);
        trial.expected = condition.expected;
        trial.matchesExpected = trial.actual.every((answer, i) => answer === condition.expected[i]);
        trial.unexpectedAnswers = questionIds.filter((_, i) => condition.expected[i] === null && trial.actual[i] !== null);
        trial.referencesExist = attempt.results.every(r => r.notebookRefs.every(id => notebook.some(n => n.id === id)));
        trial.finishedAt = new Date().toISOString();
        console.log(JSON.stringify({ condition: condition.id, run, notes: notebook.length, liveExaminee: trial.examineeModelCalled, expected: trial.expected, actual: trial.actual, score: attempt.score, matches: trial.matchesExpected }));
      } catch (error) {
        trial.error = error instanceof Error && /^HTTP \d{3} at \/api\//.test(error.message) ? error.message : 'Request or response validation failed';
        console.log(JSON.stringify({ condition: condition.id, run, error: trial.error }));
        // Stop on infrastructure/provider failure; never silently retry and
        // turn failures into successes or spend beyond the declared design.
        await save();
        throw error;
      }
      await save();
    }
  }
  report.finishedAt = new Date().toISOString();
  report.summary = {
    completed: report.trials.length,
    matches: report.trials.filter(t => t.matchesExpected).length,
    liveExamineeTrials: report.trials.filter(t => t.examineeModelCalled).length,
    unexpectedAnswers: report.trials.reduce((sum, t) => sum + t.unexpectedAnswers.length, 0),
    allSourceQuotesValid: report.trials.every(t => t.sourceQuotesValid),
    allReferencesExist: report.trials.every(t => t.referencesExist),
  };
  await save();
  console.log(JSON.stringify({ output: path.join(output, 'results.json'), summary: report.summary }));
} catch {
  report.stoppedAt = new Date().toISOString();
  await save();
  console.log(JSON.stringify({ output: path.join(output, 'results.json'), stopped: true }));
  process.exitCode = 1;
}
