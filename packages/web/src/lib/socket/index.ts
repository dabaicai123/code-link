// packages/web/src/lib/socket/index.ts
import { io, Socket } from 'socket.io-client';
import { getStorage } from '../storage';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || `http://localhost:${process.env.SERVER_PORT || 4000}`;

let projectSocket: Socket | null = null;
let draftSocket: Socket | null = null;
let terminalSocket: Socket | null = null;

function getToken(): string | null {
  return getStorage().getItem('token');
}

function createSocket(namespace: string): Socket {
  const token = getToken();
  return io(`${SOCKET_URL}${namespace}`, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  });
}

export function getProjectSocket(): Socket {
  if (!projectSocket) {
    projectSocket = createSocket('/project');
  }
  return projectSocket;
}

export function getDraftSocket(): Socket {
  if (!draftSocket) {
    draftSocket = createSocket('/draft');
  }
  return draftSocket;
}

export function getTerminalSocket(): Socket {
  if (!terminalSocket) {
    terminalSocket = createSocket('/terminal');
  }
  return terminalSocket;
}

export function disconnectAll(): void {
  projectSocket?.disconnect();
  draftSocket?.disconnect();
  terminalSocket?.disconnect();
  projectSocket = null;
  draftSocket = null;
  terminalSocket = null;
}

export function reconnectAll(): void {
  const token = getToken();
  if (token) {
    projectSocket?.connect();
    draftSocket?.connect();
    terminalSocket?.connect();
  }
}

export { Socket };