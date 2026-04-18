'use client';

import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { TerminalWebSocket } from '@/lib/terminal-websocket';
import Link from 'next/link';
import '@xterm/xterm/css/xterm.css';

interface TerminalPanelProps {
  projectId: string;
  userId: string;
  wsUrl?: string;
}

export function TerminalPanel({ projectId, userId, wsUrl = 'ws://localhost:4000/terminal' }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<TerminalWebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [showConfigPrompt, setShowConfigPrompt] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'var(--font-mono)',
      theme: {
        background: 'var(--bg-primary)',
        foreground: 'var(--text-primary)',
        cursor: 'var(--status-success)',
        cursorAccent: 'var(--bg-primary)',
        selectionBackground: '#264f78',
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);
    xterm.open(containerRef.current);

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    setTimeout(() => fitAddon.fit(), 0);

    return () => {
      xterm.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!xtermRef.current || !mountedRef.current) return;

    // 清理旧的 WebSocket 连接
    if (wsRef.current) {
      wsRef.current.disconnect();
      wsRef.current = null;
    }

    const ws = new TerminalWebSocket();
    wsRef.current = ws;

    ws.setOnConnected(() => {
      if (!mountedRef.current) return;
      setIsConnected(true);
      // 清空终端，避免显示旧内容
      xtermRef.current?.clear();
      if (fitAddonRef.current) {
        const dims = fitAddonRef.current.proposeDimensions();
        ws.start(dims?.cols || 80, dims?.rows || 24);
      }
    });

    ws.setOnOutput((data) => {
      if (mountedRef.current) {
        xtermRef.current?.write(data);
      }
    });

    ws.setOnExit(() => {
      if (mountedRef.current) {
        setIsConnected(false);
        xtermRef.current?.write('\r\n\x1b[33m[Session ended]\x1b[0m\r\n');
      }
    });

    ws.setOnError((msg) => {
      if (!mountedRef.current) return;

      // 检查是否是配置缺失错误
      if (msg.includes('请先在「设置')) {
        setShowConfigPrompt(true);
        setErrorMessage(msg);
      } else {
        // 只在首次连接失败时显示错误，避免重连时重复显示
        if (!isConnected) {
          xtermRef.current?.write(`\r\n\x1b[31m[Error: ${msg}]\x1b[0m\r\n`);
        }
      }
    });

    // 确保 wsUrl 包含 /terminal 路径
    const terminalUrl = wsUrl ? `${wsUrl}/terminal` : 'ws://localhost:4000/terminal';
    ws.connect(terminalUrl, projectId, userId);

    const disposable = xtermRef.current.onData((data) => {
      if (isConnected && mountedRef.current) {
        ws.sendInput(data);
      }
    });
    const pingInterval = setInterval(() => {
      if (isConnected) ws.ping();
    }, 30000);

    return () => {
      clearInterval(pingInterval);
      disposable.dispose();
      ws.disconnect();
      wsRef.current = null;
    };
  }, [projectId, userId, wsUrl]);

  useEffect(() => {
    if (!containerRef.current || !fitAddonRef.current) return;

    const handleResize = () => {
      if (fitAddonRef.current && xtermRef.current && mountedRef.current) {
        fitAddonRef.current.fit();
        const dims = fitAddonRef.current.proposeDimensions();
        if (dims && wsRef.current && isConnected) wsRef.current.resize(dims.cols, dims.rows);
      }
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(containerRef.current);
    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [isConnected]);

  // 显示配置提示
  if (showConfigPrompt) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="text-center p-8">
          <p className="text-gray-300 mb-4">{errorMessage}</p>
          <Link
            href="/settings"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            前往设置
          </Link>
        </div>
      </div>
    );
  }

  return <div ref={containerRef} style={{ height: '100%', width: '100%', backgroundColor: 'var(--bg-primary)' }} />;
}
