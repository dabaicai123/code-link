import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getProjectRoomUsers,
  getDraftRoomUsers,
  addUserToProjectRoom,
  addUserToDraftRoom,
  removeUserFromProjectRoom,
  removeUserFromDraftRoom,
  deleteEmptyProjectRoom,
  deleteEmptyDraftRoom,
  resetRoomUsers,
  getRoomStats,
} from '../../src/socket/utils/room-manager.js';

describe('Socket room TTL cleanup', () => {
  beforeEach(() => {
    resetRoomUsers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetRoomUsers();
  });

  describe('Room user tracking', () => {
    it('should add users to project rooms', () => {
      const count = addUserToProjectRoom(1, 'socket1', { userId: 1, userName: 'test' });
      expect(count).toBe(1);
      expect(getProjectRoomUsers().has(1)).toBe(true);
      expect(getProjectRoomUsers().get(1)?.has('socket1')).toBe(true);
    });

    it('should add multiple users to same room', () => {
      addUserToProjectRoom(1, 'socket1', { userId: 1, userName: 'user1' });
      const count = addUserToProjectRoom(1, 'socket2', { userId: 2, userName: 'user2' });
      expect(count).toBe(2);
    });

    it('should remove users from rooms', () => {
      addUserToProjectRoom(1, 'socket1', { userId: 1, userName: 'test' });
      const result = removeUserFromProjectRoom(1, 'socket1');
      expect(result.user).toEqual({ userId: 1, userName: 'test' });
      expect(result.remainingCount).toBe(0);
    });

    it('should track room user counts', () => {
      addUserToProjectRoom(1, 'socket1', { userId: 1, userName: 'test' });
      addUserToProjectRoom(1, 'socket2', { userId: 2, userName: 'test2' });
      expect(getRoomStats().totalProjectUsers).toBe(2);
    });
  });

  describe('Empty room handling', () => {
    it('should mark room as empty when last user leaves', () => {
      addUserToProjectRoom(1, 'socket1', { userId: 1, userName: 'test' });
      removeUserFromProjectRoom(1, 'socket1');

      const stats = getRoomStats();
      expect(stats.emptyRoomsPending).toBe(1);
    });

    it('should delete empty room explicitly', () => {
      addUserToProjectRoom(1, 'socket1', { userId: 1, userName: 'test' });
      removeUserFromProjectRoom(1, 'socket1');

      const deleted = deleteEmptyProjectRoom(1);
      expect(deleted).toBe(true);
      expect(getProjectRoomUsers().has(1)).toBe(false);
    });

    it('should not delete room with users', () => {
      addUserToProjectRoom(1, 'socket1', { userId: 1, userName: 'test' });
      const deleted = deleteEmptyProjectRoom(1);
      expect(deleted).toBe(false);
      expect(getProjectRoomUsers().has(1)).toBe(true);
    });
  });

  describe('Draft room operations', () => {
    it('should add and remove users from draft rooms', () => {
      const count = addUserToDraftRoom(1, 'socket1', { userId: 1, userName: 'test' });
      expect(count).toBe(1);

      const result = removeUserFromDraftRoom(1, 'socket1');
      expect(result.user).toEqual({ userId: 1, userName: 'test' });
    });

    it('should track draft room stats', () => {
      addUserToDraftRoom(1, 'socket1', { userId: 1, userName: 'test' });
      addUserToDraftRoom(2, 'socket2', { userId: 2, userName: 'test2' });

      const stats = getRoomStats();
      expect(stats.draftRooms).toBe(2);
      expect(stats.totalDraftUsers).toBe(2);
    });
  });

  describe('Reset functionality', () => {
    it('should clear all room data on reset', () => {
      addUserToProjectRoom(1, 'socket1', { userId: 1, userName: 'test' });
      addUserToDraftRoom(1, 'socket1', { userId: 1, userName: 'test' });

      resetRoomUsers();

      const stats = getRoomStats();
      expect(stats.projectRooms).toBe(0);
      expect(stats.draftRooms).toBe(0);
      expect(stats.emptyRoomsPending).toBe(0);
    });
  });
});