import fs from 'fs';

const server = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
function extractFunction(name) {
  const start = server.indexOf(`function ${name}`);
  if (start < 0) throw new Error(`Missing function ${name}`);
  const braceStart = server.indexOf(') {', start) + 2;
  let depth = 0;
  for (let i = braceStart; i < server.length; i += 1) {
    if (server[i] === '{') depth += 1;
    if (server[i] === '}') depth -= 1;
    if (depth === 0) return server.slice(start, i + 1);
  }
  throw new Error(`Could not extract function ${name}`);
}

const fnNames = [
  'isUnclearValue',
  'hasLowSpecificityMarker',
  'isGenericConferenceReviewTask',
  'draftReadiness',
  'estimateRoutingConfidence',
  'normaliseMappedOutput'
];
const bundle = fnNames.map(extractFunction).join('\n');
const exported = new Function(`${bundle}\nreturn { draftReadiness, estimateRoutingConfidence, normaliseMappedOutput };`)();

const tasks = JSON.parse(fs.readFileSync(new URL('../data/tasks.json', import.meta.url), 'utf8'));
const contacts = Object.fromEntries(JSON.parse(fs.readFileSync(new URL('../data/contacts.json', import.meta.url), 'utf8')).map((c) => [c.contact_id, c]));
const companies = Object.fromEntries(JSON.parse(fs.readFileSync(new URL('../data/companies.json', import.meta.url), 'utf8')).map((c) => [c.company_id, c]));
const contexts = Object.fromEntries(JSON.parse(fs.readFileSync(new URL('../data/notionContext.json', import.meta.url), 'utf8')).map((n) => [n.notion_context_id, n]));
const hydrated = tasks.map((task) => ({
  ...task,
  contact: contacts[task.contact_id],
  company: companies[task.company_id],
  notion_context: contexts[task.notion_context_id]
}));

const expressionTask = hydrated.find((task) => task.task_subject === 'Ask about expression workflow');
const reviewTask = hydrated.find((task) => task.task_subject === 'Conference contact review');

const expressionReadiness = exported.draftReadiness(expressionTask);
if (expressionReadiness.blocked) throw new Error(`Expression workflow task should not be blocked: ${expressionReadiness.reasons.join('; ')}`);
if (expressionReadiness.score !== 95) throw new Error(`Expected expression workflow confidence 95, got ${expressionReadiness.score}`);

const overridden = exported.normaliseMappedOutput({ routing_confidence: 9, use_case: 'LLM supplied use case' }, expressionTask, expressionReadiness.score);
if (overridden.routing_confidence !== 95) throw new Error(`LLM routing confidence was not overridden. Got ${overridden.routing_confidence}`);

const reviewReadiness = exported.draftReadiness(reviewTask);
if (!reviewReadiness.blocked) throw new Error('Conference contact review task should be blocked.');
if (reviewReadiness.score !== 0) throw new Error(`Expected conference review confidence 0, got ${reviewReadiness.score}`);
if (!reviewReadiness.reasons.some((reason) => reason.includes('conference contact review'))) throw new Error('Missing conference review blocked reason.');

console.log('v28 routing logic validation passed');

