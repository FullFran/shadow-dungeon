package loreapi

import (
	"bytes"
	"html/template"

	"github.com/fullfran/mazmorra-sombria/server/internal/lore"
)

// Mermaid is loaded from cdnjs at an exact version with its SRI hash. If it
// fails to load, the diagram stays a readable code block.
const (
	mermaidURL = "https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.9.1/mermaid.min.js"
	mermaidSRI = "sha384-WmdflGW9aGfoBdHc4rRyWzYuAjEmDwMdGdiPNacbwfGKxBW/SO6guzuQ76qjnSlr"
)

var pageTitles = map[string]string{
	"lore":             "Biblia del lore",
	"buenas-practicas": "Buenas prácticas del lore",
}

type pageData struct {
	Title      string
	Doc        string
	Body       template.HTML
	Toc        []lore.TocEntry
	Version    string
	Ref        string
	Commit     string
	MermaidURL string
	MermaidSRI string
}

func renderPage(idx *lore.Index, doc string) ([]byte, error) {
	src, _ := idx.DocMarkdown(doc)
	body, toc, err := lore.RenderMarkdown(src)
	if err != nil {
		return nil, err
	}
	// The document title (level 1) is the page heading; the TOC lists
	// sections (2) and subsections (3).
	var entries []lore.TocEntry
	for _, t := range toc {
		if t.Level == 2 || t.Level == 3 {
			entries = append(entries, t)
		}
	}
	commit := idx.Source.Commit
	if len(commit) > 12 {
		commit = commit[:12]
	}
	var buf bytes.Buffer
	err = pageTmpl.Execute(&buf, pageData{
		Title: pageTitles[doc], Doc: doc,
		// goldmark escapes the source and drops raw HTML, so its output is safe.
		Body: template.HTML(body), Toc: entries,
		Version: idx.Version, Ref: idx.Source.Ref, Commit: commit,
		MermaidURL: mermaidURL, MermaidSRI: mermaidSRI,
	})
	return buf.Bytes(), err
}

var pageTmpl = template.Must(template.New("page").Parse(`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>{{.Title}} · Mazmorra Sombría</title>
<style>
:root {
  --bg: #f6f4f1; --panel: #ffffff; --ink: #1d1b20; --muted: #5d5966; --line: #d6d1cb;
  --accent: #b3122f; --code: #efebe6; --row: #faf8f5;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #121016; --panel: #1b1820; --ink: #ebe7f0; --muted: #a59fb0; --line: #34303b;
    --accent: #ff6b81; --code: #26222c; --row: #18151d;
    color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --bg: #121016; --panel: #1b1820; --ink: #ebe7f0; --muted: #a59fb0; --line: #34303b;
  --accent: #ff6b81; --code: #26222c; --row: #18151d;
  color-scheme: dark;
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; scroll-padding-top: 1rem; }
body { margin: 0; background: var(--bg); color: var(--ink);
  font: 17px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
a { color: var(--accent); }
.wrap { max-width: 50rem; margin: 0 auto; padding: 0 16px 4rem; }
nav.top { display: flex; flex-wrap: wrap; gap: .5rem 1.25rem; align-items: center;
  padding: .9rem 0; border-bottom: 1px solid var(--line); font-size: .95rem; }
nav.top strong { margin-right: auto; }
nav.top a[aria-current] { color: var(--ink); text-decoration: none; font-weight: 600; }
.box { background: var(--panel); border: 1px solid var(--line); border-radius: 10px;
  padding: .75rem 1rem; margin: 1.25rem 0; }
.box h2 { font-size: 1rem; margin: 0 0 .4rem; }
.box p, .box ul { margin: .3rem 0; font-size: .92rem; }
details.toc summary { cursor: pointer; font-weight: 600; }
details.toc ol { padding-left: 1.2rem; margin: .5rem 0 0; font-size: .92rem; }
details.toc li.l3 { margin-left: 1rem; list-style: circle; }
h1 { font-size: 1.7rem; line-height: 1.25; margin: 1.5rem 0 .5rem; }
h2 { font-size: 1.35rem; margin: 2.2rem 0 .6rem; padding-top: .4rem; border-top: 1px solid var(--line); }
h3 { font-size: 1.12rem; margin: 1.6rem 0 .4rem; }
h1 a.anchor, h2 a.anchor, h3 a.anchor, h4 a.anchor { color: var(--muted); text-decoration: none;
  margin-left: .35rem; font-weight: 400; opacity: 0; }
h1:hover a.anchor, h2:hover a.anchor, h3:hover a.anchor, h4:hover a.anchor, a.anchor:focus { opacity: 1; }
code { background: var(--code); border-radius: 4px; padding: .05em .3em; font-size: .88em;
  overflow-wrap: anywhere; }
pre { background: var(--code); border-radius: 8px; padding: .8rem; overflow-x: auto; font-size: .85rem; }
pre code { background: none; padding: 0; overflow-wrap: normal; }
table { display: block; overflow-x: auto; border-collapse: collapse; margin: 1rem 0; font-size: .88rem; max-width: 100%; }
th, td { border: 1px solid var(--line); padding: .4rem .55rem; text-align: left; vertical-align: top; min-width: 7rem; }
th { background: var(--panel); }
tr:nth-child(even) td { background: var(--row); }
blockquote { margin: 1rem 0; padding: .2rem 1rem; border-left: 4px solid var(--accent); color: var(--muted); }
hr { border: 0; border-top: 1px solid var(--line); margin: 2rem 0; }
.mermaid { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: .5rem; overflow-x: auto; }
footer { margin-top: 3rem; color: var(--muted); font-size: .85rem; }
button.theme { background: none; border: 1px solid var(--line); color: var(--ink); border-radius: 6px;
  padding: .15rem .5rem; font: inherit; font-size: .85rem; cursor: pointer; }
</style>
</head>
<body>
<div class="wrap">
<nav class="top" aria-label="Lore">
  <strong>Mazmorra Sombría · Lore</strong>
  <a href="/lore"{{if eq .Doc "lore"}} aria-current="page"{{end}}>Biblia</a>
  <a href="/lore/grafo">Grafo</a>
  <a href="/lore/buenas-practicas"{{if eq .Doc "buenas-practicas"}} aria-current="page"{{end}}>Buenas prácticas</a>
  <button class="theme" type="button" id="theme" aria-label="Cambiar tema">◐</button>
</nav>
{{if eq .Doc "lore"}}
<section class="box" aria-labelledby="api">
  <h2 id="api">Cómo consultar</h2>
  <p>El lore también se puede consultar por API (solo lectura, JSON):</p>
  <ul>
    <li><code>GET /api/lore/context?q=sombra%20que%20tira&amp;k=8</code>: nodos del grafo, sus vecinos, relaciones y secciones de la biblia, con un campo <code>context</code> listo para pegar en un LLM.</li>
    <li><code>GET /api/lore/node/{id}?depth=1</code>: un nodo, sus vecinos (hasta 2 saltos) y las secciones que lo mencionan.</li>
    <li><code>GET /api/lore/search?q=croa</code>: autocompletado de nodos y títulos.</li>
    <li><code>GET /api/lore/graph</code>, <code>/api/lore/doc/lore</code>, <code>/api/lore/doc/buenas-practicas</code>, <code>/api/lore/meta</code>: datos en bruto y versión.</li>
  </ul>
  <p>Niveles de canon: <strong>[N]</strong> Núcleo, <strong>[J]</strong> En el juego, <strong>[B]</strong> Borrador; la sección 10 es NO CANON AÚN.</p>
</section>
{{end}}
{{if .Toc}}
<details class="toc box" open>
  <summary>Índice</summary>
  <ol>
  {{range .Toc}}<li class="l{{.Level}}"><a href="#{{.ID}}">{{.Title}}</a></li>
  {{end}}</ol>
</details>
{{end}}
<main>
{{.Body}}
</main>
<footer>Datos {{.Version}} · {{.Ref}} @ {{.Commit}}. Solo lectura.</footer>
</div>
<script>
(function () {
  var root = document.documentElement, key = "lore-theme";
  try { var saved = localStorage.getItem(key); if (saved) root.dataset.theme = saved; } catch (e) {}
  document.getElementById("theme").addEventListener("click", function () {
    var dark = root.dataset.theme ? root.dataset.theme === "dark"
      : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem(key, root.dataset.theme); } catch (e) {}
  });
  document.querySelectorAll("main h1[id], main h2[id], main h3[id], main h4[id]").forEach(function (h) {
    var a = document.createElement("a");
    a.className = "anchor"; a.href = "#" + h.id; a.textContent = "#";
    a.setAttribute("aria-label", "Enlace a esta sección");
    h.appendChild(a);
  });
})();
</script>
<script src="{{.MermaidURL}}" integrity="{{.MermaidSRI}}" crossorigin="anonymous" referrerpolicy="no-referrer" defer></script>
<script>
window.addEventListener("load", function () {
  if (!window.mermaid) return;
  var nodes = [];
  document.querySelectorAll("code.language-mermaid").forEach(function (code) {
    var div = document.createElement("div");
    div.className = "mermaid";
    div.textContent = code.textContent;
    code.parentNode.replaceWith(div);
    nodes.push(div);
  });
  if (!nodes.length) return;
  var dark = document.documentElement.dataset.theme === "dark" ||
    (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
  mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: dark ? "dark" : "default" });
  mermaid.run({ nodes: nodes });
});
</script>
</body>
</html>
`))
