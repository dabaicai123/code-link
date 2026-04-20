// tests/ws-types.test.ts
import { describe, it, expect } from 'vitest';
import {
  ProjectEvents,
  DraftEvents,
  TerminalEvents,
} from '../src/socket/types';

describe('WebSocket Message Types', () => {
  describe('ProjectEvents', () => {
    it('should validate file_change event', () => {
      const result = ProjectEvents.fileChange.safeParse({
        projectId: 1,
        path: 'src/index.ts',
        action: 'modified',
        content: 'console.log("hello");',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.projectId).toBe(1);
        expect(result.data.path).toBe('src/index.ts');
        expect(result.data.action).toBe('modified');
      }
    });

    it('should validate chat event', () => {
      const result = ProjectEvents.chat.safeParse({
        projectId: 1,
        content: 'Hello everyone!',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.projectId).toBe(1);
        expect(result.data.content).toBe('Hello everyone!');
      }
    });

    it('should validate chatMessage server event', () => {
      const result = ProjectEvents.chatMessage.safeParse({
        projectId: 1,
        userId: 123,
        userName: 'testuser',
        content: 'Hello everyone!',
        timestamp: '2026-04-20T00:00:00Z',
      });
      expect(result.success).toBe(true);
    });

    it('should validate buildStatus server event', () => {
      const result = ProjectEvents.buildStatus.safeParse({
        projectId: 1,
        status: 'success',
        previewPort: 3001,
        timestamp: '2026-04-20T00:00:00Z',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('success');
        expect(result.data.previewPort).toBe(3001);
      }
    });

    it('should reject invalid action', () => {
      const result = ProjectEvents.fileChange.safeParse({
        projectId: 1,
        path: 'test.ts',
        action: 'invalid',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing projectId', () => {
      const result = ProjectEvents.chat.safeParse({
        content: 'Hello',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('DraftEvents', () => {
    it('should validate subscribe event', () => {
      const result = DraftEvents.subscribe.safeParse({
        draftId: 1,
      });
      expect(result.success).toBe(true);
    });

    it('should validate message event', () => {
      const result = DraftEvents.message.safeParse({
        draftId: 1,
        content: 'Hello',
        parentId: null,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('TerminalEvents', () => {
    it('should validate start event', () => {
      const result = TerminalEvents.start.safeParse({
        projectId: 1,
        cols: 80,
        rows: 24,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.projectId).toBe(1);
        expect(result.data.cols).toBe(80);
        expect(result.data.rows).toBe(24);
      }
    });

    it('should validate start with defaults', () => {
      const result = TerminalEvents.start.safeParse({
        projectId: 1,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cols).toBe(80);
        expect(result.data.rows).toBe(24);
      }
    });

    it('should validate ping event', () => {
      const result = TerminalEvents.ping.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject invalid start (missing projectId)', () => {
      const result = TerminalEvents.start.safeParse({
        cols: 80,
        rows: 24,
      });
      expect(result.success).toBe(false);
    });
  });
});