# Location plaque

Owner (2026-11-04): redesign every top location banner with an entrance animation, decoration and a representative map icon.
One shared component (`src/ui/location-plaque.ts`), model in `src/ui/location-plaque-model.ts`, texts in `src/adapters/floor-plaque.ts`.

## Tasks

- [x] T1 RED: place model tests (icon, es+en name, variant, timing, reduced motion) and floor plaque text tests
- [x] T2 GREEN: 17 original place icons, model, DOM component, CSS from tokens
- [x] T3 town: the map name banner becomes the plaque (canvas banner removed)
- [x] T4 dungeons: floor card, floor 1 title, Sima stratum title and boss name cards become the plaque (canvas card and title no longer drawn)
- [x] T5 docs: DESIGN.md §4, §5, §8 and `docs/gdd.md`

## Parity checklist

- [x] Town maps: refugio, ruinas, mirador, crater, lago, cienaga (warm variant), tested over `WORLD`
- [x] Dungeons: crypt, forest, caves, swamp, Sima, tutorial (`DUNGEONS` + `TUTORIAL`), tested
- [x] Challenges: 8 lines, each with its own icon (`CHALLENGES`), and the Senda chapter II and III roads (`SENDA_ROADS`) wear their line icon, tested
- [x] Sima strata: 5 bands (`SIMA_BANDS`), eclipse variant, tested
- [x] Shrine fights (`shrinePlace`) and every boss arena (`BOSS_PLACE`): blood variant
- [x] Solo and co-op share `game.ts` and `town/scene.ts`, so rooms get it too
- [x] i18n es and en: place names are existing keys, `plaque.boss` added to both
- [x] Reduced motion: plain fade (`plaqueTiming(true)`), checked in the browser
- [x] GDD (`docs/gdd.md`) and DESIGN.md updated
- Not applicable: save, net protocol and sim harnesses (presentation only)
