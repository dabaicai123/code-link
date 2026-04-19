// packages/web/src/lib/socket/terminal.ts
'use client';

import { useEffect, useCallback, useState, useRef } from 'react';
import { getTerminalSocket } from './index';
import { formatClaudeMessage, type ClaudeMessage, type SelectedElement } from '@/types/claude-message';

interface UseTerminalSocketOptions {
  projectId: number | null;
  onOutput?: (data: string) => void;
  onExit?: () => void;
  onError?: (message: string) => void;
}

export function useTerminalSocket(options: UseTerminalSocketOptions) {
  const { projectId, onOutput, onExit, onError } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const sessionIdRef = useRef<string | null>(null);

  const socket = getTerminalSocket();

  useEffect(() => {
    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => {
      setIsConnected(false);
      setIsStarted(false);
      sessionIdRef.current = null;
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    if (socket.connected) {
      setIsConnected(true);
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [socket]);

  useEffect(() => {
    const handleStarted = (data: { sessionId: string }) => {
      sessionIdRef.current = data.sessionId;
      setIsStarted(true);
    };

    const handleOutput = (data: { data: string }) => {
      try {
        const decoded = decodeBase64(data.data);
        onOutput?.(decoded);
      } catch {
        onOutput?.(data.data);
      }
    };

    const handleExit = () => {
      setIsStarted(false);
      sessionIdRef.current = null;
      onExit?.();
    };

    const handleError = (data: { message: string }) => {
      onError?.(data.message);
    };

    socket.on('started', handleStarted);
    socket.on('output', handleOutput);
    socket.on('exit', handleExit);
    socket.on('error', handleError);

    return () => {
      socket.off('started', handleStarted);
      socket.off('output', handleOutput);
      socket.off('exit', handleExit);
      socket.off('error', handleError);
    };
  }, [socket, onOutput, onExit, onError]);

  const start = useCallback(
    (cols: number, rows: number) => {
      if (projectId && isConnected) {
        socket.emit('start', { projectId, cols, rows });
      }
    },
    [projectId, isConnected, socket]
  );

  const sendInput = useCallback(
    (data: string) => {
      if (sessionIdRef.current) {
        const encoded = encodeBase64(data);
        socket.emit('input', { sessionId: sessionIdRef.current, data: encoded });
      }
    },
    [socket]
  );

  const resize = useCallback(
    (cols: number, rows: number) => {
      if (sessionIdRef.current) {
        socket.emit('resize', { sessionId: sessionIdRef.current, cols, rows });
      }
    },
    [socket]
  );

  const ping = useCallback(() => {
    socket.emit('ping', {});
  }, [socket]);

  const sendClaudeMessage = useCallback(
    (elements: SelectedElement[], userRequest: string) => {
      if (!sessionIdRef.current) {
        console.warn('Terminal session not started');
        return;
      }

      const message: ClaudeMessage = {
        type: 'claude-request',
        elements,
        userRequest,
        timestamp: Date.now(),
      };

      const formattedMessage = formatClaudeMessage(message);
      const encoded = encodeBase64(formattedMessage + '\n');

      socket.emit('claude-message', {
        sessionId: sessionIdRef.current,
        data: encoded,
      });
    },
    [socket]
  );

  return {
    isConnected,
    isStarted,
    start,
    sendInput,
    resize,
    ping,
    sendClaudeMessage,
  };
}

function decodeBase64(base64: string): string {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

function encodeBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}