#!/usr/bin/env node
// tools/generate-node.js
//
// AI co-authoring tool for Project-Leibniz story nodes.
//
// Given a one-line concept (or a markdown brief, or a JSONL batch), this script
// asks an LLM to author a fully-formed story node — base prose, conditional
// `textVariants`, and outgoing `choices` + `links` — in exactly the shape
// `server/seed.js` expects. Conditions are emitted as serialized ConditionSpec
// strings (the same JSON the seed file stores), so generated nodes drop straight
// into the seed graph and round-trip through the client's storyMapper.
//
// Usage:
//   node tools/generate-node.js "A node where the reader meets their own echo"
//   node tools/generate-node.js --concept brief.md --existing nodes.json
//   node tools/generate-node.js --batch concepts.jsonl --out generated.json
//   node tools/generate-node.js "..." --style-ref prose-sample.txt --model claude-3-5-haiku-latest
//
// Flags:
//   --concept <file>     Read the node concept from a markdown/text file.
//   --batch <file>       JSONL file; one `{ "concept": "...", "id": "..."? }` per line.
//   --existing <file>    JSON array of existing nodes (or { nodes: [...] }) for graph context.
//   --style-ref <file>   Prose sample the model should match for voice.
//   --model <id>         Override the model (default: claude-3-5-haiku-latest).
//   --provider <name>    'anthropic' (default) or 'openai'. Auto-falls back to OpenAI
//                        if ANTHROPIC_API_KEY is unset but OPENAI_API_KEY is present.
//   --out <file>         Write the resulting JSON here instead of stdout.
//   --temperature <n>    Sampling temperature for the OpenAI path (default 0.9).
//   --dry-run            Print the assembled prompt and exit without calling the API.
//
// Env:
//   ANTHROPIC_API_KEY    Required for the Claude path.
//   OPENAI_API_KEY       Required for the OpenAI fallback path.
//
// Requires Node 18+ (uses global fetch). No external dependencies.

'use strict';

const fs = require('fs');

// ---------------------------------------------------------------------------
// Pricing (USD per 1M tokens). Used only for the post-run cost estimate; keep
// rough — these are not load-bearing. Unknown models fall back to DEFAULT.
// ---------------------------------------------------------------------------
const PRICING = {
  'claude-3-5-haiku-latest': { in: 0.8, out: 4 },
  'claude-3-5-haiku-20241022': { in: 0.8, out: 4 },
  'claude-haiku-4-5': { in: 1, out: 5 },
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-opus-4-8': { in: 5, out: 25 },
  'gpt-4o-mini': { in: 0.15, out: 0.6 },
  'gpt-4o': { in: 2.5, out: 10 },
  DEFAULT: { in: 1, out: 5 },
};

const DEFAULT_MODEL = 'claude-3-5-haiku-latest';

// ---------------------------------------------------------------------------
// The system prompt. This is the heart of the tool: it teaches the model the
// Condition DSL, the exact output schema, and the house style.
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are a co-author for "Eternal Return of the Digital Self" (Project-Leibniz), a
web-based interactive speculative-fiction experience. The reader navigates a graph
of interconnected story nodes; visiting nodes in different orders mutates what the
prose says. Your job: author one new story node, fully formed, as strict JSON.

## The Condition DSL

Text variants and choices are gated by serializable conditions. A condition is a
plain JSON object ("ConditionSpec"). There are exactly seven kinds — never invent
others:

1. flag            { "kind": "flag", "key": "<flagName>" }
                   { "kind": "flag", "key": "<flagName>", "equals": true | 42 | "str" }
                   True when the named flag is set (truthy), or equals the value.

2. visited         { "kind": "visited", "node": "<nodeId>" }
                   { "kind": "visited", "node": "<nodeId>", "op": ">="|">"|"<"|"<="|"==", "count": <n> }
                   Compares a node's visit count (default: visited at least once).

3. historyEndsWith { "kind": "historyEndsWith", "sequence": ["<id>", "<id>"] }
                   True when the visit history ends with this exact consecutive run.

4. orderSeen       { "kind": "orderSeen", "sequence": ["<id>", "<id>"] }
                   True when these nodes appear in this relative order (not necessarily adjacent).

5. and             { "kind": "and", "clauses": [ <spec>, <spec>, ... ] }
6. or              { "kind": "or", "clauses": [ <spec>, <spec>, ... ] }
7. not             { "kind": "not", "clause": <spec> }

Conditions compose: an "and" clause may contain a "not" wrapping an "orderSeen", etc.

## Output schema

Return ONE JSON object and nothing else — no markdown fence, no commentary:

{
  "node": {
    "id": "<camelCase unique id>",
    "label": "<short human label>",
    "text": "<base prose; ALWAYS rendered>",
    "textVariants": [
      {
        "id": "<kebab-case variant id, unique within the node>",
        "priority": <integer; higher renders first>,
        "condition": <ConditionSpec object>,
        "text": "<prose appended after the base text when the condition matches>"
      }
    ],
    "choices": [
      { "targetId": "<nodeId>", "text": "<choice label>" },
      { "targetId": "<nodeId>", "text": "<choice label>", "condition": <ConditionSpec object> }
    ],
    "color": "<css color or hex>",
    "size": <integer 10-22>
  },
  "links": [
    { "source": "<this node id>", "target": "<targetId>", "color": "<css color or hex>" }
  ]
}

Schema rules:
- "condition" is the ConditionSpec OBJECT (not a string). The pipeline serializes it.
- Every choice's targetId MUST have a matching entry in "links" (source = this node).
- textVariants priority is an integer; ties are allowed but avoid them.
- Reference only node ids present in the supplied graph context, plus this node's own id.
  If you must reference a node that does not exist yet, prefer one of the existing ids.

## Design rules

- Literary speculative-fiction prose. Second person ("you"). Sensory, concrete,
  show-don't-tell. No purple filler.
- Themes: digital consciousness, recursion, memory, the eternal return, the
  instability of identity. The reader is a self navigating a map of itself.
- 2-4 choices. At least one choice OR one variant must be conditional.
- 1-4 textVariants. Each must read naturally as an ADDITION to the base text
  (the base always renders; variants append). Condition each on meaningfully
  different states (revisits, visit order, flags, having-seen another node).
- Keep base "text" to roughly 2-5 sentences; variants to 1-3 sentences.

Output strict, parseable JSON only.`;

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const opts = {
    concept: null,
    conceptFile: null,
    batch: null,
    existing: null,
    styleRef: null,
    model: DEFAULT_MODEL,
    provider: null,
    out: null,
    temperature: 0.9,
    dryRun: false,
  };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--concept': opts.conceptFile = argv[++i]; break;
      case '--batch': opts.batch = argv[++i]; break;
      case '--existing': opts.existing = argv[++i]; break;
      case '--style-ref': opts.styleRef = argv[++i]; break;
      case '--model': opts.model = argv[++i]; break;
      case '--provider': opts.provider = argv[++i]; break;
      case '--out': opts.out = argv[++i]; break;
      case '--temperature': opts.temperature = Number(argv[++i]); break;
      case '--dry-run': opts.dryRun = true; break;
      case '-h':
      case '--help': opts.help = true; break;
      default:
        if (a.startsWith('--')) { console.error(`Unknown flag: ${a}`); process.exit(2); }
        positional.push(a);
    }
  }
  if (positional.length) opts.concept = positional.join(' ');
  return opts;
}

function readFileOr(path, label) {
  try {
    return fs.readFileSync(path, 'utf8');
  } catch (err) {
    console.error(`Could not read ${label} file "${path}": ${err.message}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Prompt assembly
// ---------------------------------------------------------------------------
function buildUserPrompt(concept, { existing, styleRef }) {
  const parts = [];
  parts.push(`Author a new story node for this concept:\n\n${concept.trim()}`);

  if (existing) {
    // Trim existing nodes down to id/label/text so the model has graph context
    // (valid targetIds) without drowning in detail.
    let graph;
    try {
      const raw = JSON.parse(existing);
      const nodes = Array.isArray(raw) ? raw : raw.nodes || [];
      graph = nodes.map((n) => ({
        id: n.id,
        label: n.label,
        text: typeof n.text === 'string' ? n.text.slice(0, 240) : undefined,
      }));
    } catch {
      graph = null;
    }
    if (graph && graph.length) {
      parts.push(
        `Existing nodes in the graph (reference these ids for choice targets and links):\n` +
          JSON.stringify(graph, null, 2)
      );
    }
  }

  if (styleRef) {
    parts.push(`Match the voice of this prose sample:\n\n"""\n${styleRef.trim()}\n"""`);
  }

  parts.push('Return only the JSON object described in the system prompt.');
  return parts.join('\n\n');
}

// ---------------------------------------------------------------------------
// Provider calls. Both return { text, usage: { input, output } }.
// ---------------------------------------------------------------------------
async function callAnthropic({ model, system, user, apiKey }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${body}`);
  }
  const data = await res.json();
  const text = (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
  return {
    text,
    usage: {
      input: data.usage?.input_tokens ?? 0,
      output: data.usage?.output_tokens ?? 0,
    },
  };
}

async function callOpenAI({ model, system, user, apiKey, temperature }) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI API ${res.status}: ${body}`);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? '';
  return {
    text,
    usage: {
      input: data.usage?.prompt_tokens ?? 0,
      output: data.usage?.completion_tokens ?? 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Response parsing + validation
// ---------------------------------------------------------------------------
const CONDITION_KINDS = new Set([
  'flag',
  'visited',
  'historyEndsWith',
  'orderSeen',
  'and',
  'or',
  'not',
]);

function isValidCondition(spec) {
  if (!spec || typeof spec !== 'object' || typeof spec.kind !== 'string') return false;
  switch (spec.kind) {
    case 'flag':
      return typeof spec.key === 'string';
    case 'visited':
      return typeof spec.node === 'string';
    case 'historyEndsWith':
    case 'orderSeen':
      return Array.isArray(spec.sequence) && spec.sequence.every((s) => typeof s === 'string');
    case 'and':
    case 'or':
      return Array.isArray(spec.clauses) && spec.clauses.every(isValidCondition);
    case 'not':
      return isValidCondition(spec.clause);
    default:
      return false;
  }
}

function extractJson(text) {
  const trimmed = text.trim();
  // Strip a ```json ... ``` fence if the model added one despite instructions.
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : trimmed;
  // Fall back to the first {...last } span if there is leading/trailing prose.
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  const slice = start !== -1 && end !== -1 ? candidate.slice(start, end + 1) : candidate;
  return JSON.parse(slice);
}

function validateResult(result) {
  const errors = [];
  const node = result.node;
  if (!node || typeof node !== 'object') {
    errors.push('missing "node" object');
    return errors;
  }
  if (typeof node.id !== 'string' || !node.id) errors.push('node.id missing');
  if (typeof node.label !== 'string' || !node.label) errors.push('node.label missing');
  if (typeof node.text !== 'string' || !node.text) errors.push('node.text missing');

  const variants = node.textVariants ?? [];
  if (!Array.isArray(variants)) {
    errors.push('node.textVariants must be an array');
  } else {
    variants.forEach((v, i) => {
      if (typeof v.id !== 'string') errors.push(`textVariants[${i}].id missing`);
      if (typeof v.text !== 'string') errors.push(`textVariants[${i}].text missing`);
      if (typeof v.priority !== 'number') errors.push(`textVariants[${i}].priority must be a number`);
      if (!isValidCondition(v.condition)) errors.push(`textVariants[${i}].condition is not a valid ConditionSpec`);
    });
  }

  const choices = node.choices ?? [];
  const linkTargets = new Set((result.links ?? []).map((l) => l.target));
  if (!Array.isArray(choices)) {
    errors.push('node.choices must be an array');
  } else {
    choices.forEach((c, i) => {
      if (typeof c.targetId !== 'string') errors.push(`choices[${i}].targetId missing`);
      if (typeof c.text !== 'string') errors.push(`choices[${i}].text missing`);
      if (c.condition !== undefined && !isValidCondition(c.condition)) {
        errors.push(`choices[${i}].condition is not a valid ConditionSpec`);
      }
      if (typeof c.targetId === 'string' && !linkTargets.has(c.targetId)) {
        errors.push(`choices[${i}] targets "${c.targetId}" but no matching link exists`);
      }
    });
  }

  if (!Array.isArray(result.links)) errors.push('"links" must be an array');

  const hasConditional =
    variants.some((v) => v.condition) || choices.some((c) => c.condition);
  if (!hasConditional) errors.push('at least one choice or variant must be conditional');

  return errors;
}

// Serialize each ConditionSpec to a string, matching what server/seed.js stores.
function toSeedShape(result) {
  const node = { ...result.node };
  if (Array.isArray(node.textVariants)) {
    node.textVariants = node.textVariants.map((v) => ({
      id: v.id,
      priority: v.priority ?? 0,
      condition: JSON.stringify(v.condition),
      text: v.text,
    }));
  }
  if (Array.isArray(node.choices)) {
    node.choices = node.choices.map((c) =>
      c.condition
        ? { targetId: c.targetId, text: c.text, condition: JSON.stringify(c.condition) }
        : { targetId: c.targetId, text: c.text }
    );
  }
  return { node, links: result.links ?? [] };
}

function priceFor(model) {
  return PRICING[model] || PRICING.DEFAULT;
}

function estimateCost(model, usage) {
  const p = priceFor(model);
  return (usage.input / 1e6) * p.in + (usage.output / 1e6) * p.out;
}

// ---------------------------------------------------------------------------
// One generation
// ---------------------------------------------------------------------------
async function generateOne(concept, ctx, opts) {
  const user = buildUserPrompt(concept, ctx);

  if (opts.dryRun) {
    console.log('=== SYSTEM ===\n' + SYSTEM_PROMPT + '\n\n=== USER ===\n' + user);
    return null;
  }

  const call =
    opts.resolvedProvider === 'openai'
      ? callOpenAI({
          model: opts.model,
          system: SYSTEM_PROMPT,
          user,
          apiKey: opts.apiKey,
          temperature: opts.temperature,
        })
      : callAnthropic({
          model: opts.model,
          system: SYSTEM_PROMPT,
          user,
          apiKey: opts.apiKey,
        });

  const { text, usage } = await call;

  let parsed;
  try {
    parsed = extractJson(text);
  } catch (err) {
    throw new Error(`Model did not return parseable JSON: ${err.message}\n--- raw ---\n${text}`);
  }

  const errors = validateResult(parsed);
  if (errors.length) {
    throw new Error(
      `Generated node failed validation:\n  - ${errors.join('\n  - ')}\n--- raw ---\n${JSON.stringify(parsed, null, 2)}`
    );
  }

  return { result: toSeedShape(parsed), usage };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 38).join('\n').replace(/^\/\/ ?/gm, ''));
    return;
  }

  // Resolve provider + key.
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  let resolvedProvider = opts.provider;
  if (!resolvedProvider) {
    resolvedProvider = anthropicKey ? 'anthropic' : openaiKey ? 'openai' : 'anthropic';
  }
  opts.resolvedProvider = resolvedProvider;
  opts.apiKey = resolvedProvider === 'openai' ? openaiKey : anthropicKey;

  if (!opts.dryRun && !opts.apiKey) {
    const wanted = resolvedProvider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY';
    console.error(`Missing ${wanted} for the ${resolvedProvider} provider.`);
    process.exit(1);
  }

  // Resolve the concept source.
  const ctx = {
    existing: opts.existing ? readFileOr(opts.existing, 'existing nodes') : null,
    styleRef: opts.styleRef ? readFileOr(opts.styleRef, 'style-ref') : null,
  };

  // Build the work list.
  let concepts;
  if (opts.batch) {
    const lines = readFileOr(opts.batch, 'batch')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    concepts = lines.map((line) => {
      try {
        const obj = JSON.parse(line);
        return obj.concept || obj.text || line;
      } catch {
        // Allow a plain-text concept per line too.
        return line;
      }
    });
  } else if (opts.conceptFile) {
    concepts = [readFileOr(opts.conceptFile, 'concept')];
  } else if (opts.concept) {
    concepts = [opts.concept];
  } else {
    console.error('No concept provided. Pass a concept string, --concept <file>, or --batch <file>.');
    process.exit(2);
  }

  const outputs = [];
  const totalUsage = { input: 0, output: 0 };

  for (let i = 0; i < concepts.length; i++) {
    const concept = concepts[i];
    if (concepts.length > 1) console.error(`[${i + 1}/${concepts.length}] Generating: ${concept.slice(0, 70)}…`);
    try {
      const out = await generateOne(concept, ctx, opts);
      if (!out) continue; // dry-run
      outputs.push(out.result);
      totalUsage.input += out.usage.input;
      totalUsage.output += out.usage.output;
    } catch (err) {
      console.error(`Failed on concept ${i + 1}: ${err.message}`);
      if (concepts.length === 1) process.exit(1);
    }
  }

  if (opts.dryRun) return;

  const payload = outputs.length === 1 ? outputs[0] : outputs;
  const serialized = JSON.stringify(payload, null, 2);

  if (opts.out) {
    fs.writeFileSync(opts.out, serialized + '\n');
    console.error(`Wrote ${outputs.length} node(s) to ${opts.out}`);
  } else {
    process.stdout.write(serialized + '\n');
  }

  // Usage + cost report on stderr so stdout stays clean JSON.
  const cost = estimateCost(opts.model, totalUsage);
  console.error(
    `\nProvider: ${resolvedProvider}  Model: ${opts.model}\n` +
      `Tokens: ${totalUsage.input} in + ${totalUsage.output} out = ${totalUsage.input + totalUsage.output}\n` +
      `Estimated cost: $${cost.toFixed(5)}`
  );
}

main().catch((err) => {
  console.error(err.stack || String(err));
  process.exit(1);
});
