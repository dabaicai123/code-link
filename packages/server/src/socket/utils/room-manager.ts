import { createLogger } from '../../core/logger/index.js';

const logger = createLogger('room-manager');

interface RoomUser {
  userId: number;
  userName: string;
}

type RoomType = 'project' | 'draft';

// Generic room storage: type -> roomId -> Map<socketId, RoomUser>
const rooms = new Map<RoomType, Map<number, Map<string, RoomUser>>>();
rooms.set('project', new Map());
rooms.set('draft', new Map());

// TTL cleanup
const CLEANUP_INTERVAL_MS = 60 * 1000;
const EMPTY_ROOM_TTL_MS = 5 * 60 * 1000;
const emptyRoomTimestamps = new Map<string, number>();
let cleanupInterval: NodeJS.Timeout | null = null;

// --- Generic room operations (replaces duplicated project/draft pairs) ---

function getRoomMap(type: RoomType): Map<number, Map<string, RoomUser>> {
  return rooms.get(type)!;
}

export function getRoomUserList(type: RoomType, roomId: number): RoomUser[] {
  const room = getRoomMap(type).get(roomId);
  return room ? Array.from(room.values()) : [];
}

export function getRoomUserCount(type: RoomType, roomId: number): number {
  return getRoomMap(type).get(roomId)?.size ?? 0;
}

export function addUserToRoom(type: RoomType, roomId: number, socketId: string, user: RoomUser): number {
  const map = getRoomMap(type);
  if (!map.has(roomId)) map.set(roomId, new Map());
  const room = map.get(roomId)!;
  room.set(socketId, user);
  emptyRoomTimestamps.delete(`${type}:${roomId}`);
  return room.size;
}

export function removeUserFromRoom(type: RoomType, roomId: number, socketId: string): { user: RoomUser | null; remainingCount: number } {
  const room = getRoomMap(type).get(roomId);
  if (!room) return { user: null, remainingCount: 0 };

  const user = room.get(socketId);
  room.delete(socketId);

  if (room.size === 0) emptyRoomTimestamps.set(`${type}:${roomId}`, Date.now());

  return { user: user ?? null, remainingCount: room.size };
}

export function deleteEmptyRoom(type: RoomType, roomId: number): boolean {
  const room = getRoomMap(type).get(roomId);
  if (room && room.size === 0) {
    getRoomMap(type).delete(roomId);
    emptyRoomTimestamps.delete(`${type}:${roomId}`);
    return true;
  }
  return false;
}

export function getRoomUsersMap(type: RoomType): ReadonlyMap<number, ReadonlyMap<string, RoomUser>> {
  return getRoomMap(type);
}

// --- Cleanup ---

function cleanupEmptyRooms(): void {
  const now = Date.now();
  const toRemove: string[] = [];
  for (const [key, ts] of emptyRoomTimestamps) {
    if (now - ts >= EMPTY_ROOM_TTL_MS) toRemove.push(key);
  }
  for (const key of toRemove) {
    const [type, idStr] = key.split(':') as [RoomType, string];
    const id = parseInt(idStr, 10);
    deleteEmptyRoom(type, id);
  }
  if (toRemove.length > 0) logger.info(`TTL cleanup: removed ${toRemove.length} empty room(s)`);
}

export function setupCleanupInterval(): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(cleanupEmptyRooms, CLEANUP_INTERVAL_MS);
}

export function stopCleanupInterval(): void {
  if (cleanupInterval) { clearInterval(cleanupInterval); cleanupInterval = null; }
}

export function resetRoomUsers(): void {
  for (const map of rooms.values()) map.clear();
  emptyRoomTimestamps.clear();
}

export function getRoomStats() {
  let totalProject = 0, totalDraft = 0;
  for (const room of getRoomMap('project').values()) totalProject += room.size;
  for (const room of getRoomMap('draft').values()) totalDraft += room.size;
  return {
    projectRooms: getRoomMap('project').size,
    draftRooms: getRoomMap('draft').size,
    totalProjectUsers: totalProject,
    totalDraftUsers: totalDraft,
    emptyRoomsPending: emptyRoomTimestamps.size,
  };
}