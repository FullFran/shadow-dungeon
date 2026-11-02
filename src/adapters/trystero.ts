import { joinRoom, selfId } from 'trystero';
import type { IceServer } from './turn';
import { roomConfig, TrysteroTransport, type RoomLike } from './trystero-transport';

/**
 * Joins the Trystero room of a room code (default Nostr strategy: public
 * relays for signaling, `RELAY_REDUNDANCY` of them, then WebRTC between browsers: direct when it can,
 * through the `turn` relay servers otherwise; without them, peers behind
 * strict NATs may not connect). Loaded with a dynamic import from the lobby,
 * so solo play never downloads the package.
 */
export const APP_ID = 'shadow-dungeon-spike';

export function joinTrysteroRoom(code: string, turn: readonly IceServer[] = []): TrysteroTransport {
  const room = joinRoom(roomConfig(APP_ID, turn), `room-${code}`);
  return new TrysteroTransport(room as unknown as RoomLike, selfId);
}
