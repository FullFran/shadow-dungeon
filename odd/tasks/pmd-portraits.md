# PMD portraits in every dialogue (issue #47)

Objective: Mystery Dungeon portraits (SpriteCollab `portrait/`, CC BY-NC 4.0) beside every character who speaks, with its emotion. Branch: `feat/pmd-portraits-2` (from main 0.13.0; supersedes `feat/pmd-portraits` 2078b24, based on 0.10.2).
Delivery: `ask-on-risk`, work-unit commits; push, PR and release are the owner's call. Test runner: `npx vitest run --testTimeout=30000 --maxWorkers=4`.

## Specs

- S1: ticket SD-J12RV0: "Estaría bueno añadir los autorretratos clásicos de PMD para cuando hablas con los NPC del juego y darle más personalidad. Están en la misma página de dónde se han sacado los sprites". Owner: "me gustaria hacerlo como dice el", "me gusta!!! tenemos que usarlos!!!!". Ticket SD-ANU4AR: "Que cuando habla un notas, salga su sprite como en pokemon mundo misterioso". Owner: "la 47 tenemos que hacerla".
- S2: pipeline: portraits come from the same SpriteCollab repo and pinned commit as main's face portraits (`tools/fetch-portraits.mjs`, `src/assets/portraits`, bundled assets), for every playable look and every species that speaks, with the 8 core emotions (Normal, Happy, Sad, Angry, Surprised, Worried, Determined, Pain) where they exist, Normal as the fallback, and their artists credited in `CREDITS.md`.
- S3: town: every NPC line in the dialogue box (residents, services, disguises, Sima plea, tour) shows the speaker's portrait; objects, signs and system lines show none.
- S4: cinematics: guardian and Senda lines that a character says show that character's portrait (speaker resolved from the line, emotion from the moment); narrator, the Voice, the prologue and the Sima scenes show none.
- S5: in-dungeon story lines (inner voice, boss pre/post lines, "boss last lines") and the evolve bond lines show the speaker's portrait; the player's portrait follows its species, shiny and female look.
- S6 (coordinator brief, 2026-11-11): "with the right emotion when the data has one, neutral otherwise; a speaker with no portrait shows no frame (never a broken image)".
- S7 (brief): "load portraits lazily, never all at once at run start (a past regression loaded 26 MB of sheets)".
- S8 (brief): "Credits screen keeps the PMDCollab attribution; phones (568x320) must fit."
- S9 (brief): "Tests iterating every speaker that appears in dialogue data: each has a portrait or is explicitly listed as having none."
- S10 (old S6, owner): "y las escenas hablando y demas... tambien tenemos que mejorar eso!!! para que se sienta mas como mundo misterioso, pero sin hacerse pesado ahora es un poco anticlimatico y no muy hilado lo de las suplicas...": pacing and the Sima pleas' threading. Design to be proposed to the owner before rewriting content.
- Assumption: the speaker of a Senda line is resolved from its text (`Name: «…»` names it, an unnamed quote is the line's own Pokémon, no quote is narration), in both languages, and a test checks es and en agree; the text itself is not rewritten and still names the speaker, so the portrait sits beside the unchanged line (no extra name plate in cinematics).
- Assumption: emotions come from the moment (low-HP voice: Pain; mid-run voice: Worried; bond: Happy; a boss before the fight: Determined, after it: Pain; a guardian's last words: Pain, its warning: Worried); everything else is Normal. The owner can retune.

## Tasks

- T1 (S2, S7) inline: `fetch-portraits.mjs` downloads the 8 emotions for playable looks and speakers (85 keys, 580 files, 0.9 MB); manifest maps key to emotions; `portraitFor(key, emotion)`; lazy `<img>` only when a line is shown; `inlineAsset` keeps portraits out of index.js. Status: done (879b8c8, build fix commit). RED observed: portraits.test (missing PORTRAIT_EMOTIONS), inline test (missing `inlineAsset`).
- T2 (S3, S6) inline: dialogue box shows the PMD portrait (emotion-aware) instead of the cropped sprite; no portrait, no frame. Status: done; seen at 568x320 and 1280x720 in headless Chromium.
- T3 (S4, S5, S6) inline: `src/data/dialogue-speakers.ts`; portraits in the cinematic player (guardians, Sendas, gallery replays), the in-dungeon story box and the evolve bond line. Status: done. RED observed: dialogue-speakers, story-cinematic and guardian-cinematic tests failed before `spokenLine`/`storyFace`/`guardianFace`/`lineFace` existed.
- T4 (S8, S9) inline: tests iterating every speaker; credits text; phone layout; GDD. Status: done (credits text changed before its test: RED not observed there).
- T5 (S10): pending, needs an owner design proposal (not part of this branch).

## Parity checklist

- [x] Every playable look (base, shiny, female) has a portrait or a declared fallback (tests/data/portraits.test.ts)
- [x] Town: residents, services, disguised Zorua, Sima plea, tour (dialogueSources, tests/data/dialogue-speakers.test.ts)
- [x] Cinematics: 4 guardians (Tu Sombra listed as none), 8 Sendas x 3 chapters before/after, gallery replays; prologue and Sima scenes listed as none
- [x] In-dungeon: voice and boss lines of all 8 Sendas (solo); co-op keeps the log (no box, no portrait), unchanged
- [x] Evolve bond line (the line's face, Happy); Phantump's word appended to it keeps the line's face
- [x] i18n es/en: speakers agree in both languages (test); credits.sprites names the portraits in both
- [x] Save/net: none (presentation only)
- [x] CREDITS (generated), credits screen (reads every artist table), GDD (Retratos en los diálogos), prove green
- [x] `pumpkaboo-small`, `pumpkaboo-super` fall back to base Pumpkaboo `0710/0000` (test)

## Log

- L1 (2026-11-11, coordinator brief): "Finish what the issue and the document list as open: portraits in every dialogue that has a known speaker (town NPCs, cinematics/story lines with speaker and emotion, boss last lines, Senda scenes), with the right emotion when the data has one, neutral otherwise; a speaker with no portrait shows no frame (never a broken image)."
- L2: main already ships Normal face portraits for playable looks (c963800, 7c7016b) in `src/assets/portraits` as bundled assets because sd-pre did not serve raw `public/portraits`; 2078b24's `public/portraits` is therefore re-applied on main's pipeline instead of cherry-picked.
- L3: speakers found by the tests that the first download missed: haunter, drifblim, kecleon, mightyena (added to SPEAKERS). es/en disagreed on 4 lines whose lead-in was longer than the first regex allowed; fixed by reading the name from the lead-in's first word and treating a lead-in with no species as the line's own Pokémon.
- L4: Vite inlines files under 4 KB as base64: on main the 47 face portraits were already inside index.js, and with 580 the script grew to 3.6 MB (1.59 MB gzip). `build.assetsInlineLimit` now keeps every portrait as its own file: index.js 2.36 MB (657 KB gzip), 0 inlined PNG.
- L5: decision: the line text is not rewritten (it already names the speaker); the portrait sits beside it. The old document's "strip Name: «» prefixes" is dropped; owner can ask for it with T5.

