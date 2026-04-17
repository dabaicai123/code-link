// tests/ws-types.test.ts
import { describe, it, expect } from 'vitest';
import {
  parseMessage,
  createFileChangeEvent,
  createChatMessage,
  createBuildNotification,
  isFileChangeEvent,
  isChatMessage,
} from '../src/websocket/types';

describe('WebSocket Message Types', () => {
  it('should parse valid JSON message', () => {
    const raw = '{"type":"file_change","projectId":1,"path":"src/index.ts"}';
    const msg = parseMessage(raw);
    expect(msg?.type).toBe('file_change');
    expect(msg?.projectId).toBe(1);
  });

  it('should create file change event', () => {
    const event = createFileChangeEvent(1, 'src/index.ts', 'modified', 'console.log("hello");');
    expect(event.type).toBe('file_change');
    expect(event.path).toBe('src/index.ts');
    expect(event.action).toBe('modified');
  });

  it('should create chat message', () => {
    const msg = createChatMessage(1, 123, 'testuser', 'Hello everyone!');
    expect(msg.type).toBe('chat');
    expect(msg.userId).toBe(123);
    expect(msg.content).toBe('Hello everyone!');
  });

  it('should create build notification', () => {
    const notif = createBuildNotification(1, 'success', 3001);
    expect(notif.type).toBe('build_status');
    expect(notif.status).toBe('success');
    expect(notif.previewPort).toBe(3001);
  });

  it('should correctly identify message types', () => {
    const fileEvent = createFileChangeEvent(1, 'test.ts', 'created');
    const chatMsg = createChatMessage(1, 1, 'testuser', 'hi');

    expect(isFileChangeEvent(fileEvent)).toBe(true);
    expect(isFileChangeEvent(chatMsg)).toBe(false);
    expect(isChatMessage(chatMsg)).toBe(true);
  });
});