/**
 * @deprecated
 *
 * This file is retained only as a backward-compatibility shim.
 * The implementation has moved to `./rooms/InMemoryRoomManager`.
 * The contract is now defined by `./rooms/IRoomManager`.
 *
 * Import from the new location:
 *
 *   import type { IRoomManager }    from './rooms';
 *   import { InMemoryRoomManager }  from './rooms';
 */

// Re-export so any lingering `import { RoomManager }` references still compile.
export { InMemoryRoomManager as RoomManager } from './rooms';
