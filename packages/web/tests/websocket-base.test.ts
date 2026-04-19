import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketBase } from '../src/lib/websocket/base.ts';

describe('WebSocketBase', () => {
  let base: WebSocketBase;
  let mockWsInstance: any;
  const mockUrl = 'ws://localhost:3001';

  beforeEach(() => {
    vi.useFakeTimers();

    mockWsInstance = {
      readyState: 0,
      send: vi.fn(),
      close: vi.fn(),
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
    };

    global.WebSocket = vi.fn().mockImplementation(() => {
      return mockWsInstance;
    }) as any;
  });

  afterEach(() => {
    base?.disconnect();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should create connection with url', () => {
    base = new WebSocketBase(mockUrl);
    expect(global.WebSocket).toHaveBeenCalledWith(mockUrl);
  });

  it('should emit connected event on open', () => {
    base = new WebSocketBase(mockUrl);
    let connected = false;
    base.on('connected', () => {
      connected = true;
    });
    mockWsInstance.readyState = 1;
    mockWsInstance.onopen?.();
    expect(connected).toBe(true);
  });

  it('should emit disconnected event on close', () => {
    base = new WebSocketBase(mockUrl);
    let disconnected = false;
    base.on('disconnected', () => {
      disconnected = true;
    });
    mockWsInstance.onclose?.();
    expect(disconnected).toBe(true);
  });

  it('should emit message event on data', () => {
    base = new WebSocketBase(mockUrl);
    let received: any = null;
    base.on('message', (data: any) => {
      received = data;
    });
    mockWsInstance.onmessage?.({ data: JSON.stringify({ type: 'test' }) });
    expect(received).toEqual({ type: 'test' });
  });

  it('should emit typed message event', () => {
    base = new WebSocketBase(mockUrl);
    let received: any = null;
    base.on('chat', (data: any) => {
      received = data;
    });
    mockWsInstance.onmessage?.({ data: JSON.stringify({ type: 'chat', content: 'hello' }) });
    expect(received).toEqual({ type: 'chat', content: 'hello' });
  });

  it('should send data when connected', () => {
    base = new WebSocketBase(mockUrl);
    mockWsInstance.readyState = 1;

    base.send({ type: 'test', data: 'hello' });

    expect(mockWsInstance.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'test', data: 'hello' })
    );
  });

  it('should not send when not connected', () => {
    base = new WebSocketBase(mockUrl);
    mockWsInstance.readyState = 0;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    base.send({ type: 'test' });

    expect(warnSpy).toHaveBeenCalled();
    expect(mockWsInstance.send).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('should attempt reconnect on close', () => {
    base = new WebSocketBase(mockUrl, { maxReconnectAttempts: 3 });

    mockWsInstance.onclose?.();
    vi.advanceTimersByTime(3000);

    expect(global.WebSocket).toHaveBeenCalledTimes(2);
  });

  it('should not reconnect when manually disconnected', () => {
    base = new WebSocketBase(mockUrl);
    base.disconnect();

    // Reset the mock to track new calls
    (global.WebSocket as any).mockClear();

    // Trigger onclose manually - should not reconnect
    mockWsInstance.onclose?.();
    vi.advanceTimersByTime(5000);

    expect(global.WebSocket).not.toHaveBeenCalled();
  });

  it('should remove event handler', () => {
    base = new WebSocketBase(mockUrl);
    let count = 0;
    const handler = () => { count++; };

    base.on('test', handler);
    base.emit('test', {});
    expect(count).toBe(1);

    base.off('test', handler);
    base.emit('test', {});
    expect(count).toBe(1);
  });

  it('should disconnect properly', () => {
    base = new WebSocketBase(mockUrl);

    base.disconnect();

    expect(mockWsInstance.close).toHaveBeenCalled();
    expect((base as any).ws).toBeNull();
  });
});