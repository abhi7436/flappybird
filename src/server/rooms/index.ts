/**
 * Barrel export for the rooms module.
 *
 * Import from this path instead of reaching into individual files:
 *
 *   import { IRoomManager, InMemoryRoomManager } from './rooms';
 *
 * This makes it trivial to swap the concrete implementation at a
 * single injection point (server/index.ts) without touching consumers.
 */

export type { IRoomManager, RoomSnapshot } from './IRoomManager';
export { InMemoryRoomManager } from './InMemoryRoomManager';
