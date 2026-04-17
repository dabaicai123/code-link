'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { TerminalWebSocket } from '@/lib/terminal-websocket';
import '@xterm/xterm/css/xterm.css';

export interface TerminalProps {
  projectId: string;
  userId: string;
  wsUrl?: string;
  onExit?: () => void;
  onError?: (error: string) => void;
  className?: string;
}

export function Terminal({
  projectId,
  userId,
  wsUrl = 'ws://localhost:3001/terminal',
  onExit,
  onError,
  className = '',
}: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<TerminalWebSocket | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // 初始化终端
  useEffect(() => {
    if (!containerRef.current) return;

    // 创建 xterm 实例
    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        cursorAccent: '#1e1e1e',
        selectionBackground: '#264f78',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5',
      },
      allowProposedApi: true,
    });

    // 创建插件
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);
    xterm.open(containerRef.current);

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // 初始调整大小
    setTimeout(() => {
      fitAddon.fit();
    }, 0);

    // 清理函数
    return () => {
      xterm.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  // 连接 WebSocket
  useEffect(() => {
    if (!xtermRef.current) return;

    const ws = new TerminalWebSocket();
    wsRef.current = ws;

    // 设置事件处理器
    ws.setOnConnected(() => {
      console.log('Terminal WebSocket connected');
      // 连接成功后启动终端会话
      if (fitAddonRef.current) {
        const dims = fitAddonRef.current.proposeDimensions();
        if (dims) {
          ws.start(dims.cols, dims.rows);
        } else {
          // 默认尺寸
          ws.start(80, 24);
        }
      }
    });

    ws.setOnOutput((data) => {
      xtermRef.current?.write(data);
    });

    ws.setOnExit(() => {
      xtermRef.current?.write('\r\n\x1b[33m[Session ended]\x1b[0m\r\n');
      onExit?.();
    });

    ws.setOnError((message) => {
      xtermRef.current?.write(`\r\n\x1b[31m[Error: ${message}]\x1b[0m\r\n`);
      onError?.(message);
    });

    // 连接 WebSocket
    ws.connect(wsUrl, projectId, userId);

    // 监听终端输入
    const disposable = xtermRef.current.onData((data) => {
      ws.sendInput(data);
    });

    // 心跳保活
    const pingInterval = setInterval(() => {
      ws.ping();
    }, 30000);

    return () => {
      clearInterval(pingInterval);
      disposable.dispose();
      ws.disconnect();
      wsRef.current = null;
    };
  }, [projectId, userId, wsUrl, onExit, onError]);

  // 窗口大小变化时自动调整
  useEffect(() => {
    if (!containerRef.current || !fitAddonRef.current) return;

    const handleResize = () => {
      if (fitAddonRef.current && xtermRef.current) {
        fitAddonRef.current.fit();
        const dims = fitAddonRef.current.proposeDimensions();
        if (dims && wsRef.current) {
          wsRef.current.resize(dims.cols, dims.rows);
        }
      }
    };

    // 使用 ResizeObserver 监听容器大小变化
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(containerRef.current);
    resizeObserverRef.current = resizeObserver;

    // 同时监听窗口大小变化
    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`terminal-container h-full w-full bg-[#1e1e1e] ${className}`}
      style={{ minHeight: '200px' }}
    />
  );
}

export default Terminal;