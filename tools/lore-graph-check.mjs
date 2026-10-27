#!/usr/bin/env node
// Checks docs/lore/lore-graph.json (no dependencies):
// - node ids are unique; types and statuses are known;
// - every edge endpoint exists, and every node has at least one edge;
// - every node and edge has at least one source;
// - a "path:line" (or "path:line-line") source points at an existing file and lines within range;
// - an "i18n:<key>" source exists in src/i18n/es.json and src/i18n/en.json;
// - docs/lore/lore-graph.html embeds exactly this JSON.
// Exit code 1 on any failure. Usage: node tools/lore-graph-check.mjs [graph.json]
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const graphPath = resolve(process.argv[2] ?? join(root, 'docs/lore/lore-graph.json'));
const htmlPath = join(dirname(graphPath), 'lore-graph.html');
const TYPES = new Set(['personaje', 'lugar', 'faccion', 'concepto', 'suceso', 'objeto', 'senda']);
const STATUSES = new Set(['canon', 'diseño']);

const raw = readFileSync(graphPath, 'utf8');
const graph = JSON.parse(raw);
const es = JSON.parse(readFileSync(join(root, 'src/i18n/es.json'), 'utf8'));
const en = JSON.parse(readFileSync(join(root, 'src/i18n/en.json'), 'utf8'));
const errors = [];
const lineCounts = new Map();

function linesOf(path) {
  if (!lineCounts.has(path)) lineCounts.set(path, existsSync(path) ? readFileSync(path, 'utf8').split('\n').length : -1);
  return lineCounts.get(path);
}

function checkSource(src, where) {
  if (typeof src !== 'string' || src.length === 0) return errors.push(`${where}: empty source`);
  if (src.startsWith('i18n:')) {
    const key = src.slice(5);
    if (!(key in es)) errors.push(`${where}: i18n key not in es.json: ${key}`);
    if (!(key in en)) errors.push(`${where}: i18n key not in en.json: ${key}`);
    return;
  }
  const m = /^([^:]+):(\d+)(?:-(\d+))?$/.exec(src);
  if (!m) return errors.push(`${where}: source is neither path:line nor i18n:key: ${src}`);
  const [, rel, a, b] = m;
  const n = linesOf(join(root, rel));
  if (n < 0) return errors.push(`${where}: file not found: ${rel}`);
  const lo = Number(a);
  const hi = Number(b ?? a);
  if (lo < 1 || hi < lo || hi > n) errors.push(`${where}: line ${a}${b ? '-' + b : ''} out of range (1..${n}) in ${rel}`);
}

const ids = new Set();
const degree = new Map();
for (const [i, node] of graph.nodes.entries()) {
  const where = `node ${node.id ?? '#' + i}`;
  if (!node.id) errors.push(`${where}: no id`);
  if (ids.has(node.id)) errors.push(`${where}: duplicate id`);
  ids.add(node.id);
  degree.set(node.id, 0);
  if (!node.label) errors.push(`${where}: no label`);
  if (!node.summary) errors.push(`${where}: no summary`);
  if (!TYPES.has(node.type)) errors.push(`${where}: unknown type ${node.type}`);
  if (!STATUSES.has(node.status)) errors.push(`${where}: unknown status ${node.status}`);
  if (!Array.isArray(node.sources) || node.sources.length === 0) errors.push(`${where}: no sources`);
  else node.sources.forEach((s) => checkSource(s, where));
}
for (const [i, edge] of graph.edges.entries()) {
  const where = `edge #${i} ${edge.from} -${edge.relation}-> ${edge.to}`;
  for (const end of [edge.from, edge.to]) {
    if (!ids.has(end)) errors.push(`${where}: unknown endpoint ${end}`);
    else degree.set(end, degree.get(end) + 1);
  }
  if (!edge.relation) errors.push(`${where}: no relation`);
  if (!Array.isArray(edge.sources) || edge.sources.length === 0) errors.push(`${where}: no sources`);
  else edge.sources.forEach((s) => checkSource(s, where));
}
for (const [id, d] of degree) if (d === 0) errors.push(`node ${id}: no edges (isolated)`);

if (existsSync(htmlPath)) {
  const html = readFileSync(htmlPath, 'utf8');
  const m = /<script id="lore-data" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
  if (!m) errors.push('lore-graph.html: no <script id="lore-data"> block');
  else if (JSON.stringify(JSON.parse(m[1])) !== JSON.stringify(graph)) errors.push('lore-graph.html: embedded JSON differs from lore-graph.json (re-embed it)');
} else errors.push('lore-graph.html not found');

const count = (list, key) => Object.entries(list.reduce((acc, x) => ((acc[x[key]] = (acc[x[key]] ?? 0) + 1), acc), {})).map(([k, v]) => `${k} ${v}`).join(', ');
console.log(`nodes: ${graph.nodes.length} (${count(graph.nodes, 'type')})`);
console.log(`status: ${count(graph.nodes, 'status')}`);
console.log(`edges: ${graph.edges.length} (${new Set(graph.edges.map((e) => e.relation)).size} relations)`);
console.log(`sources checked: ${graph.nodes.reduce((n, x) => n + (x.sources?.length ?? 0), 0) + graph.edges.reduce((n, x) => n + (x.sources?.length ?? 0), 0)}`);
if (errors.length) {
  console.error(`FAIL: ${errors.length} problem(s)`);
  for (const e of errors) console.error('  ' + e);
  process.exit(1);
}
console.log('OK: unique ids, endpoints exist, no isolated nodes, every node and edge sourced, sources resolve, HTML in sync');
