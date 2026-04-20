// packages/server/src/socket/utils/room-manager.ts
import { createLogger } from '../../core/logger/index.js';

const logger = createLogger('room-manager');

interface RoomUser {
  userId: number;
  userName: string;
}

// Room user maps: roomId -> Map<socketId, RoomUser>
const projectRoomUsers = new Map<number, Map<string, RoomUser>>();
const draftRoomUsers = new Map<number, Map<string, RoomUser>>();

// TTL cleanup configuration
const CLEANUP_INTERVAL_MS = 60 * 1000; // Check every minute
const EMPTY_ROOM_TTL_MS = 5 * 60 * 1000; // Remove empty rooms after 5 minutes

// Track when rooms became empty for TTL cleanup
const emptyRoomTimestamps = new Map<string, number>();

let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Get the project room users map (read-only view)
 */
export function getProjectRoomUsers(): ReadonlyMap<number, ReadonlyMap<string, RoomUser>> {
  return projectRoomUsers;
}

/**
 * Get the draft room users map (read-only view)
 */
export function getDraftRoomUsers(): ReadonlyMap<number, ReadonlyMap<string, RoomUser>> {
  return draftRoomUsers;
}

/**
 * Get users in a specific project room
 */
export function getProjectRoomUserList(projectId: number): RoomUser[] {
  const users = projectRoomUsers.get(projectId);
  return users ? Array.from(users.values()) : [];
}

/**
 * Get users in a specific draft room
 */
export function getDraftRoomUserList(draftId: number): RoomUser[] {
  const users = draftRoomUsers.get(draftId);
  return users ? Array.from(users.values()) : [];
}

/**
 * Get user count in a project room
 */
export function getProjectRoomUserCount(projectId: number): number {
  return projectRoomUsers.get(projectId)?.size ?? 0;
}

/**
 * Get user count in a draft room
 */
export function getDraftRoomUserCount(draftId: number): number {
  return draftRoomUsers.get(draftId)?.size ?? 0;
}

/**
 * Add a user to a project room
 */
export function addUserToProjectRoom(
  projectId: number,
  socketId: string,
  user: RoomUser
): number {
  if (!projectRoomUsers.has(projectId)) {
    projectRoomUsers.set(projectId, new Map());
  }
  const room = projectRoomUsers.get(projectId)!;
  room.set(socketId, user);

  // Clear empty timestamp if room was previously marked empty
  const key = `project:${projectId}`;
  emptyRoomTimestamps.delete(key);

  return room.size;
}

/**
 * Add a user to a draft room
 */
export function addUserToDraftRoom(
  draftId: number,
  socketId: string,
  user: RoomUser
): number {
  if (!draftRoomUsers.has(draftId)) {
    draftRoomUsers.set(draftId, new Map());
  }
  const room = draftRoomUsers.get(draftId)!;
  room.set(socketId, user);

  // Clear empty timestamp if room was previously marked empty
  const key = `draft:${draftId}`;
  emptyRoomTimestamps.delete(key);

  return room.size;
}

/**
 * Remove a user from a project room
 * Returns the removed user and the remaining user count
 */
export function removeUserFromProjectRoom(
  projectId: number,
  socketId: string
): { user: RoomUser | null; remainingCount: number } {
  const room = projectRoomUsers.get(projectId);
  if (!room) {
    return { user: null, remainingCount: 0 };
  }

  const user = room.get(socketId);
  room.delete(socketId);

  const remainingCount = room.size;

  // Mark room as potentially empty for TTL cleanup
  if (remainingCount === 0) {
    const key = `project:${projectId}`;
    emptyRoomTimestamps.set(key, Date.now());
  }

  return { user: user ?? null, remainingCount };
}

/**
 * Remove a user from a draft room
 * Returns the removed user and the remaining user count
 */
export function removeUserFromDraftRoom(
  draftId: number,
  socketId: string
): { user: RoomUser | null; remainingCount: number } {
  const room = draftRoomUsers.get(draftId);
  if (!room) {
    return { user: null, remainingCount: 0 };
  }

  const user = room.get(socketId);
  room.delete(socketId);

  const remainingCount = room.size;

  // Mark room as potentially empty for TTL cleanup
  if (remainingCount === 0) {
    const key = `draft:${draftId}`;
    emptyRoomTimestamps.set(key, Date.now());
  }

  return { user: user ?? null, remainingCount };
}

/**
 * Delete an empty project room from the map
 */
export function deleteEmptyProjectRoom(projectId: number): boolean {
  const room = projectRoomUsers.get(projectId);
  if (room && room.size === 0) {
    projectRoomUsers.delete(projectId);
    const key = `project:${projectId}`;
    emptyRoomTimestamps.delete(key);
    return true;
  }
  return false;
}

/**
 * Delete an empty draft room from the map
 */
export function deleteEmptyDraftRoom(draftId: number): boolean {
  const room = draftRoomUsers.get(draftId);
  if (room && room.size === 0) {
    draftRoomUsers.delete(draftId);
    const key = `draft:${draftId}`;
    emptyRoomTimestamps.delete(key);
    return true;
  }
  return false;
}

/**
 * Internal cleanup function to remove stale empty rooms
 */
function cleanupEmptyRooms(): void {
  const now = Date.now();
  const roomsToRemove: string[] = [];

  for (const [key, timestamp] of emptyRoomTimestamps) {
    if (now - timestamp >= EMPTY_ROOM_TTL_MS) {
      roomsToRemove.push(key);
    }
  }

  for (const key of roomsToRemove) {
    const [type, idStr] = key.split(':');
    const id = parseInt(idStr, 10);

    if (type === 'project') {
      const room = projectRoomUsers.get(id);
      if (room && room.size === 0) {
        projectRoomUsers.delete(id);
        logger.debug(`Cleaned up empty project room: ${id}`);
      }
    } else if (type === 'draft') {
      const room = draftRoomUsers.get(id);
      if (room && room.size === 0) {
        draftRoomUsers.delete(id);
        logger.debug(`Cleaned up empty draft room: ${id}`);
      }
    }

    emptyRoomTimestamps.delete(key);
  }

  if (roomsToRemove.length > 0) {
    logger.info(`TTL cleanup: removed ${roomsToRemove.length} empty room(s)`);
  }
}

/**
 * Start the TTL cleanup interval
 */
export function setupCleanupInterval(): void {
  if (cleanupInterval) {
    logger.warn('Cleanup interval already running');
    return;
  }

  cleanupInterval = setInterval(cleanupEmptyRooms, CLEANUP_INTERVAL_MS);
  logger.info('Room TTL cleanup interval started');
}

/**
 * Stop the TTL cleanup interval
 */
export function stopCleanupInterval(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    logger.info('Room TTL cleanup interval stopped');
  }
}

/**
 * Reset all room data (for testing)
 */
export function resetRoomUsers(): void {
  projectRoomUsers.clear();
  draftRoomUsers.clear();
  emptyRoomTimestamps.clear();
  logger.debug('All room data reset');
}

/**
 * Get statistics about room usage (for monitoring)
 */
export function getRoomStats(): {
  projectRooms: number;
  draftRooms: number;
  totalProjectUsers: number;
  totalDraftUsers: number;
  emptyRoomsPending: number;
} {
  let totalProjectUsers = 0;
  for (const room of projectRoomUsers.values()) {
    totalProjectUsers += room.size;
  }

  let totalDraftUsers = 0;
  for (const room of draftRoomUsers.values()) {
    totalDraftUsers += room.size;
  }

  return {
    projectRooms: projectRoomUsers.size,
    draftRooms: draftRoomUsers.size,
    totalProjectUsers,
    totalDraftUsers,
    emptyRoomsPending: emptyRoomTimestamps.size,
  };
}