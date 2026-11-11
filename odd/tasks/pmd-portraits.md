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
- Assumption: the speaker of a Senda line is resolved from its text (`Name: «…»` names it, an unnamed quote is the line's own Pokémon, no quote is narration), in both languages, and a test checks es and en agree; the text itself is not rewritten. The dialogue boxes show only the quote when the whole line is one speaker's words; the log keeps the full line.
- Assumption: emotions come from the moment (low-HP voice: Pain; mid-run voice: Worried; bond: Happy; a boss before the fight: Determined, after it: Pain; a guardian's last words: Pain, its warning: Worried); everything else is Normal. The owner can retune.

## Tasks

- T1 (S2, S7) inline: `fetch-portraits.mjs` downloads the 8 emotions for playable looks and speakers; manifest maps key to emotions; `portraitFor(key, emotion)`; lazy `<img>` only when a line is shown.
- T2 (S3, S6) inline: dialogue box draws the portrait (emotion-aware) instead of the cropped sprite; no portrait, no frame.
- T3 (S4, S5, S6) inline: `src/data/dialogue-speakers.ts` (pure speaker and emotion resolution); portraits in the cinematic player (guardians, Sendas), the in-dungeon story box and the evolve bond line.
- T4 (S8, S9) inline: tests iterating every speaker; credits; phone layout; GDD.
- T5 (S10): pending, needs an owner design proposal (not part of this branch).

## Parity checklist

- [ ] Every playable look (base, shiny, female) has a portrait or a declared fallback (tests/data/portraits.test.ts)
- [ ] Town: residents, services, disguised Zorua, Sima plea, tour (dialogueSources)
- [ ] Cinematics: 4 guardians (Tu Sombra listed as none), 8 Sendas x 3 chapters before/after; prologue and Sima scenes listed as none
- [ ] In-dungeon: voice and boss lines of all 8 Sendas; co-op keeps the log (no box, no portrait)
- [ ] Evolve bond lines and Phantump's word
- [ ] i18n es/en: speakers agree in both languages
- [ ] Save/net: none expected
- [ ] CREDITS, credits screen, GDD, prove

## Log

- L1 (2026-11-11, coordinator brief): "Finish what the issue and the document list as open: portraits in every dialogue that has a known speaker (town NPCs, cinematics/story lines with speaker and emotion, boss last lines, Senda scenes), with the right emotion when the data has one, neutral otherwise; a speaker with no portrait shows no frame (never a broken image)."
- L2: main already ships Normal face portraits for playable looks (c963800, 7c7016b) in `src/assets/portraits` as bundled assets because sd-pre did not serve raw `public/portraits`; 2078b24's `public/portraits` is therefore re-applied on main's pipeline instead of cherry-picked.
