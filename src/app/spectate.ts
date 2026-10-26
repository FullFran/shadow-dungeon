/**
 * Co-op spectating (docs/gdd.md §7): while this player is fainted the camera
 * follows a standing teammate; a key or a tap moves on to the next one.
 * Solo never spectates (a fainted solo player is a defeat).
 */
export interface Watchable {
  id: string;
  standing: boolean;
}

/** Who a fainted player watches: the current one while it stands, else the first standing teammate; null when nobody stands. */
export function spectateTarget(team: readonly Watchable[], current: string | null): string | null {
  if (current !== null && team.some((m) => m.id === current && m.standing)) return current;
  return team.find((m) => m.standing)?.id ?? null;
}

/** The next standing teammate after `current`, wrapping round; null when nobody stands. */
export function nextSpectate(team: readonly Watchable[], current: string | null): string | null {
  const from = team.findIndex((m) => m.id === current);
  for (let step = 1; step <= team.length; step++) {
    const m = team[(from + step + team.length) % team.length]!;
    if (m.standing) return m.id;
  }
  return null;
}
