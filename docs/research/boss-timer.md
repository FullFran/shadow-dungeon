# Boss timers that read at a glance

Research for odd/tasks/last-phase-and-timer.md (S2). Owner request: "hay que hacer que se entienda y se vea muy bien la mecanica del tiempo. busca referencias de otros juegos que lo hagan y ponlo que se vea bien". Public knowledge of how other games show a boss clock, what each one gets right, and the design we take. Original art and text only: we borrow ideas, never assets or wording.

## What our clock does today (code)

- Every spell card has a timer (`timerMs`). Breaking its segment ends it early ("broken"); if the clock runs out, the card ends anyway ("timeout"): the boss loses the rest of that segment, the next card is declared, and on the last card the boss falls (core/cards.ts `endCard`).
- The reward is the capture: a card broken (or a survival card survived) without the player being hit gives back `CAPTURE.healShare` of max HP at once and `CAPTURE.coins` at the end (core/cards.ts `updateCapture`). A timed-out card gives nothing.
- The HUD shows "12 s" with a small hourglass at the right end of the boss bar, red in the last 5 s. Only the host sees it (the clock is not in the snapshot). Nothing says what the clock is for.

So the clock is not a threat to the player: it is a deadline for the reward. The display must say exactly that.

## References

| Game | How the clock shows | What makes it readable |
|---|---|---|
| Touhou Project (spell cards) | The card's name slides in by the boss, a countdown in big digits at the top centre, its bonus value next to the name. Captured: a "Spell Card Bonus" banner with the score; hit, bombed or timed out: "Bonus Failed". | One clock per card, tied to the card's name. The reward is visible from the start and its loss is announced the moment it happens, not at the end. The last seconds tick audibly. |
| Monster Hunter (quest timer) | A clock face in a corner whose pie fills as time runs; text warnings at fixed marks ("5 minutes remaining") and a quest-failed screen. | A shape that drains (no need to read digits) plus discrete warnings at thresholds. |
| Hades (Tight Deadline pact) | A countdown at the top of the screen; when it runs out you start taking damage. | The rule is learnt once from the pact's description; afterwards the number alone suffices. Red and a pulse near the end. |
| Enter the Gungeon | No timer, but two ideas that map to ours: bosses cap the damage they take per second (phases cannot be skipped, like our card floor), and a boss beaten without taking a hit drops a Master Round. | A no-hit reward the player knows in advance, announced with its own item drop. |
| Sekiro | Red deathblow markers over the boss's health: one per life still to take. | You always know how many phases are left and when the next blow is the last. |
| Cuphead | No timer; on defeat, a progress line shows how far into the fight you got, phase by phase. | The fight's phases as a line with markers, read in a second. |
| Hollow Knight / Celeste | No timers; phase changes are cued by a stagger, a roar, an arena change and a music shift. | A phase change is an event you hear and see, never only a number. |
| Spelunky (ghost) | Time pressure arrives with a one-line warning and a sound before the threat appears. | A first warning that explains the stakes in words, once, then sound alone. |

## What makes a boss clock readable

1. **Tie the clock to the thing it times.** Touhou puts the countdown with the card; ours sat in a corner of the bar, next to the boss's statuses.
2. **Show the stake, not just the time.** Touhou's bonus value, Gungeon's Master Round: the player knows what the clock is protecting. Ours never said "capture".
3. **Announce the loss when it happens.** "Bonus Failed" the moment you are hit; a lost capture should dim its seal at once, not at the card's end.
4. **A shape, not only digits.** Monster Hunter's draining pie: the share left reads without reading the number (phones, peripheral vision).
5. **Escalate the last seconds on several channels.** Colour (red) is not enough for colour-blind players: size, a pulse and a tick sound every second carry the same message.
6. **End every card with a word.** Touhou's result banner: the player learns whether they beat the clock or the clock beat them.
7. **Teach once.** Spelunky and Hades explain the rule a single time; after that the cues stand alone.

## Our design (implemented in odd/tasks/last-phase-and-timer.md T4 to T6)

- **Card clock plate**, centred just above the boss bar: a large hourglass, the seconds in big digits, and a thin draining line (the share of the card's time left). It replaces the small clock at the bar's right end.
- **Capture seal** beside it: lit gold while the capture is still possible (the player has not been hit during this card), dimmed and struck through as soon as it is lost, with a short "Sin captura" under it. Shape and strike-through, not only colour.
- **Last 5 s**: the plate turns red, the digits grow and pulse, the hourglass flips, and a tick sounds every second (a higher one on the last). Red is never the only cue.
- **Result banner** at the card's end, small and over the plate (never covering the arena's middle): "¡CARTA SUPERADA!" (broken), "¡RESISTIDA!" (a survival card) or "¡TIEMPO!" with "La carta pasa sin premio". A capture keeps its own "¡Técnica dominada!" notice.
- **First-time tip**, once per device like `bossPhaseTipSeen` (Settings `cardTimerTipSeen`): when the first card clock appears, one panel: "Reloj de carta: rómpela antes de que se acabe el tiempo y sin recibir golpes para dominarla (PS y Pokémonedas). Si se acaba, la carta pasa sin premio."
- **Co-op**: the host sends each card boss's clock in the snapshot, so a guest sees the same plate, ticks, banners and tip; the capture seal is each player's own (captures are judged per peer).
- **Phones (568x320)**: the plate is sized from the HUD scale, sits in the band above the bar and never over the centre third.
