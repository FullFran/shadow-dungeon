import { readFileSync, writeFileSync } from 'node:fs';
const R = new URL('../../docs/lore/', import.meta.url).pathname;
const json = JSON.stringify(JSON.parse(readFileSync(R+'lore-graph.json','utf8'))).replace(/</g,'\\u003c');
const tpl = readFileSync(new URL('./lore-graph.template.html', import.meta.url),'utf8');
writeFileSync(R+'lore-graph.html', tpl.replace('__DATA__', () => json));
