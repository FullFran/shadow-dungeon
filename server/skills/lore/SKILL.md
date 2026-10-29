---
name: lore-sima
description: >
  Grounded answers about the lore of Mazmorra Sombría / Shadow Dungeon from its public lore API.
  Trigger: lore de Mazmorra Sombría, la Sima, Sendas, Caminantes, personajes, guardianes,
  contradicciones, misterios, canon, "qué sabemos de...", "¿esto es canon?".
---

# Lore de Mazmorra Sombría (graph RAG)

Base URL: `https://sd-api.fullfran.com` (public, read-only, JSON).

## Query

1. Context bundle (always first). URL-encode `q`; `k` = seed nodes (default 8, max 25):
   ```sh
   curl -sG https://sd-api.fullfran.com/api/lore/context --data-urlencode "q=sombra que tira" --data-urlencode k=8
   ```
   Returns `nodes` (graph nodes with `status`, `sources`; `hop` 0 = matched, 1 = neighbour), `edges`,
   `sections` (bible chunks: `path`, `heading_path`, `lines`, `tier`, `text`) and `context`
   (a plain-text bundle with sources and tiers). Read `context`; use the rest to dig.
2. Dig into one entity by node id (from `nodes[].id`; `depth` 1 or 2):
   ```sh
   curl -s "https://sd-api.fullfran.com/api/lore/node/croagunk?depth=1"
   ```
3. Find ids: `GET /api/lore/search?q=croa`. Raw data: `/api/lore/graph`, `/api/lore/doc/lore`,
   `/api/lore/doc/buenas-practicas`, `/api/lore/meta` (data version and source commit).
   Humans read it at `/lore`, `/lore/grafo`, `/lore/buenas-practicas`.

Matching is accent- and case-insensitive Spanish keyword matching, not semantic: ask with
the game's own words (Sima, Lucidez, Senda del Hueso, Phantump...), and retry with
synonyms or a node id before concluding something is absent.

## Rules

- Answer ONLY from what the API returned. Never invent canon or fill gaps with Pokémon canon.
- Cite every claim: `[path:line]` (e.g. `[docs/lore/lore.md:306]`, `[src/data/world.ts:359]`),
  i18n keys (`i18n:sima.scene.lost.10`) or the bible section (`§9 Contradicciones`).
- Always state the canon tier: **Núcleo** [N], **En el juego** [J], **Borrador** [B], or
  design **NO CANON AÚN** (bible §10, nodes with `status: diseño`). Borrador is not canon.
- Flag known contradictions (C1, C2...) and open mysteries (M1, M2...) when they touch the
  answer; quote their state (Abierta, Menor...). Mention design ideas (D*) only as non-canon.
- If nothing relevant comes back: say «no está en el lore» (or the equivalent in the
  user's language). Do not guess.
- Reply in the user's language; keep game terms as the game spells them.

## Changing the lore

The API is read-only. To change lore:

1. Edit `docs/lore/` in `/home/fran/fullfran/mazmorra-sombria` on branch `docs/lore-bible`.
2. Rebuild and check the graph there:
   `node tools/lore/build-graph.mjs && node tools/lore/embed-graph.mjs && node tools/lore-graph-check.mjs`
3. Commit, then in the backend repo run `server/tools/sync-lore.sh` (copies the 4 files into
   `server/internal/lore/data/`), commit the copy and redeploy the server.
