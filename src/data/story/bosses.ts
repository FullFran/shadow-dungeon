import type { CardFightDef } from '../cards';
import { CUBONE_BOSSES, CUBONE_FIGHTS, CUBONE_ROOMS, type CuboneBossId, type CuboneRoomId } from './cubone';
import type { StoryBossDef, Tier4 } from './kit';
import { LITWICK_BOSSES, LITWICK_FIGHTS, LITWICK_ROOMS, type LitwickBossId, type LitwickRoomId } from './litwick';
import { ZORUA_BOSSES, ZORUA_FIGHTS, ZORUA_ROOMS, type ZoruaBossId, type ZoruaRoomId } from './zorua';

/**
 * Every Senda boss defined in data/story (the starters' shadows and wounds),
 * gathered for the species table, the enemy behaviours, the tier tricks, the
 * rooms and the proofs: a new line adds its file's lists here.
 */
export type StoryBossId = CuboneBossId | LitwickBossId | ZoruaBossId;
export type StoryRoomId = CuboneRoomId | LitwickRoomId | ZoruaRoomId;

export const STORY_BOSSES: readonly (StoryBossDef & { id: StoryBossId })[] = [...CUBONE_BOSSES, ...LITWICK_BOSSES, ...ZORUA_BOSSES];

/** Each boss's fights, Easy to Nightmare. */
export const STORY_FIGHTS: Record<StoryBossId, Tier4<CardFightDef>> = { ...CUBONE_FIGHTS, ...LITWICK_FIGHTS, ...ZORUA_FIGHTS };

export const STORY_ROOMS = { ...CUBONE_ROOMS, ...LITWICK_ROOMS, ...ZORUA_ROOMS };
