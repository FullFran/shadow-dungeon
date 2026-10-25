import { joinRoom, selfId } from 'trystero';
import { TrysteroTransport, type RoomLike } from './trystero-transport';

/**
 * Joins the Trystero room of a room code (default Nostr strategy: public
 * relays for signaling, then direct WebRTC between browsers; no TURN server,
 * so peers behind strict NATs may not connect). Loaded with a dynamic import
 * from the lobby, so solo play never downloads the package.
 */
export const APP_ID = 'shadow-dungeon-spike';

export function joinTrysteroRoom(code: string): TrysteroTransport {
  const room = joinRoom({ appId: APP_ID }, `room-${code}`);
  return new TrysteroTransport(room as unknown as RoomLike, selfId);
}
