package lore

import (
	"bytes"
	"fmt"
	"strings"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/text"
)

// TocEntry is one heading of a rendered document.
type TocEntry struct {
	Level int
	ID    string
	Title string
}

// md renders GitHub-flavoured markdown (tables, autolinks). Raw HTML in the
// source is not passed through (goldmark's default), so the bible cannot
// inject markup into the page.
var md = goldmark.New(
	goldmark.WithExtensions(extension.GFM),
	goldmark.WithParserOptions(parser.WithAutoHeadingID()),
)

// RenderMarkdown turns markdown into HTML with an id on every heading
// (accent-free slugs: «Cosmología» -> "cosmologia") and returns the
// headings for a table of contents.
func RenderMarkdown(src []byte) (string, []TocEntry, error) {
	ctx := parser.NewContext(parser.WithIDs(&slugIDs{seen: map[string]int{}}))
	doc := md.Parser().Parse(text.NewReader(src), parser.WithContext(ctx))
	var toc []TocEntry
	err := ast.Walk(doc, func(n ast.Node, entering bool) (ast.WalkStatus, error) {
		h, ok := n.(*ast.Heading)
		if !ok || !entering {
			return ast.WalkContinue, nil
		}
		id, _ := h.AttributeString("id")
		idb, _ := id.([]byte)
		toc = append(toc, TocEntry{Level: h.Level, ID: string(idb), Title: plainText(h, src)})
		return ast.WalkSkipChildren, nil
	})
	if err != nil {
		return "", nil, err
	}
	var buf bytes.Buffer
	if err := md.Renderer().Render(&buf, src, doc); err != nil {
		return "", nil, err
	}
	return buf.String(), toc, nil
}

// plainText is the text of an inline tree without markup.
func plainText(n ast.Node, src []byte) string {
	var b strings.Builder
	_ = ast.Walk(n, func(c ast.Node, entering bool) (ast.WalkStatus, error) {
		if !entering {
			return ast.WalkContinue, nil
		}
		switch t := c.(type) {
		case *ast.Text:
			b.Write(t.Segment.Value(src))
			if t.SoftLineBreak() {
				b.WriteByte(' ')
			}
		case *ast.String:
			b.Write(t.Value)
		}
		return ast.WalkContinue, nil
	})
	return b.String()
}

// slugIDs gives headings accent-free, unique ids.
type slugIDs struct{ seen map[string]int }

// Slug folds a heading into an anchor id.
func Slug(s string) string {
	slug := strings.ReplaceAll(Normalize(s), " ", "-")
	if slug == "" {
		slug = "seccion"
	}
	return slug
}

func (s *slugIDs) Generate(value []byte, _ ast.NodeKind) []byte {
	base := Slug(string(value))
	id := base
	if n := s.seen[base]; n > 0 {
		id = fmt.Sprintf("%s-%d", base, n)
	}
	s.seen[base]++
	s.seen[id]++
	return []byte(id)
}

func (s *slugIDs) Put(value []byte) { s.seen[string(value)]++ }
