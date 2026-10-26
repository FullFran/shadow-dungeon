import type { CardFightDef } from '../cards';
import { CUBONE_BOSSES, CUBONE_FIGHTS, CUBONE_ROOMS, type CuboneBossId, type CuboneRoomId } from './cubone';
import type { StoryBossDef, Tier4 } from './kit';
import { LITWICK_BOSSES, LITWICK_FIGHTS, LITWICK_ROOMS, type LitwickBossId, type LitwickRoomId } from './litwick';
import { ZORUA_BOSSES, ZORUA_FIGHTS, ZORUA_ROOMS, type ZoruaBossId, type ZoruaRoomId } from './zorua';
import { ABRA_BOSSES, ABRA_FIGHTS, ABRA_ROOMS, type AbraBossId, type AbraRoomId } from './abra';
import { PIPLUP_BOSSES, PIPLUP_FIGHTS, PIPLUP_ROOMS, type PiplupBossId, type PiplupRoomId } from './piplup';
import { SHINX_BOSSES, SHINX_FIGHTS, SHINX_ROOMS, type ShinxBossId, type ShinxRoomId } from './shinx';
import { AXEW_BOSSES, AXEW_FIGHTS, AXEW_ROOMS, type AxewBossId, type AxewRoomId } from './axew';

/**
 * Every Senda boss defined in data/story (the starters' and the gacha lines' shadows and wounds),
 * gathered for the species table, the enemy behaviours, the tier tricks, the
 * rooms and the proofs: a new line adds its file's lists here.
 */
export type StoryBossId = CuboneBossId | LitwickBossId | ZoruaBossId | AbraBossId | PiplupBossId | ShinxBossId | AxewBossId;
export type StoryRoomId = CuboneRoomId | LitwickRoomId | ZoruaRoomId | AbraRoomId | PiplupRoomId | ShinxRoomId | AxewRoomId;

export const STORY_BOSSES: readonly (StoryBossDef & { id: StoryBossId })[] = [...CUBONE_BOSSES, ...LITWICK_BOSSES, ...ZORUA_BOSSES, ...ABRA_BOSSES, ...PIPLUP_BOSSES, ...SHINX_BOSSES, ...AXEW_BOSSES];

/** Each boss's fights, Easy to Nightmare. */
export const STORY_FIGHTS: Record<StoryBossId, Tier4<CardFightDef>> = { ...CUBONE_FIGHTS, ...LITWICK_FIGHTS, ...ZORUA_FIGHTS, ...ABRA_FIGHTS, ...PIPLUP_FIGHTS, ...SHINX_FIGHTS, ...AXEW_FIGHTS };

export const STORY_ROOMS = { ...CUBONE_ROOMS, ...LITWICK_ROOMS, ...ZORUA_ROOMS, ...ABRA_ROOMS, ...PIPLUP_ROOMS, ...SHINX_ROOMS, ...AXEW_ROOMS };
