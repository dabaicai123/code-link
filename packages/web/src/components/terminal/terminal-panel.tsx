'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { useTerminalSocket } from '@/lib/socket/terminal';
import Link from 'next/link';
import '@xterm/xterm/css/xterm.css';

interface TerminalPanelProps {
  projectId: string;
}

export function TerminalPanel({ projectId }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [showConfigPrompt, setShowConfigPrompt] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const mountedRef = useRef(true);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- xterm instance init: runs once on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'var(--font-mono)',
      theme: {
        background: 'var(--bg-primary)',
        foreground: 'var(--text-primary)',
        cursor: 'var(--status-running)',
        cursorAccent: 'var(--bg-primary)',
        selectionBackground: '#264f78',
        green: 'var(--status-running)',
      },
      allowProposedApi: true,
      cols: 120,
      rows: 40,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);
    xterm.open(containerRef.current);

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    setTimeout(() => {
      if (fitAddonRef.current && containerRef.current) {
        fitAddonRef.current.fit();
      }
    }, 100);

    return () => {
      xterm.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  const handleOutput = useCallback((data: string) => {
    if (mountedRef.current) {
      xtermRef.current?.write(data);
    }
  }, []);

  const handleExit = useCallback(() => {
    if (mountedRef.current) {
      hasStartedRef.current = false;
      xtermRef.current?.write('\r\n\x1b[33m[Session ended]\x1b[0m\r\n');
    }
  }, []);

  const handleError = useCallback((message: string) => {
    if (!mountedRef.current) return;

    if (message.includes('请先在「设置')) {
      setShowConfigPrompt(true);
      setErrorMessage(message);
    } else {
      xtermRef.current?.write(`\r\n\x1b[31m[Error: ${message}]\x1b[0m\r\n`);
    }
  }, []);

  const { isConnected, isStarted, start, sendInput, resize, ping } = useTerminalSocket({
    projectId: projectId ? parseInt(projectId, 10) : null,
    onOutput: handleOutput,
    onExit: handleExit,
    onError: handleError,
  });

  // 当连接建立时启动终端
  useEffect(() => {
    if (isConnected && !isStarted && !hasStartedRef.current && xtermRef.current && fitAddonRef.current) {
      hasStartedRef.current = true;
      xtermRef.current.clear();
      const dims = fitAddonRef.current.proposeDimensions();
      start(dims?.cols || 80, dims?.rows || 24);
    }
  }, [isConnected, isStarted, start]);

  // 处理终端输入
  useEffect(() => {
    if (!xtermRef.current || !isStarted) return;

    const disposable = xtermRef.current.onData((data) => {
      if (isStarted && mountedRef.current) {
        sendInput(data);
      }
    });

    return () => {
      disposable.dispose();
    };
  }, [isStarted, sendInput]);

  // Ping 保活
  useEffect(() => {
    if (!isStarted) return;

    const pingInterval = setInterval(() => {
      ping();
    }, 30000);

    return () => {
      clearInterval(pingInterval);
    };
  }, [isStarted, ping]);

  // 处理窗口大小变化
  useEffect(() => {
    if (!containerRef.current || !fitAddonRef.current) return;

    const handleResize = () => {
      if (fitAddonRef.current && xtermRef.current && mountedRef.current) {
        fitAddonRef.current.fit();
        const dims = fitAddonRef.current.proposeDimensions();
        if (dims && isStarted) {
          resize(dims.cols, dims.rows);
        }
      }
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(containerRef.current);
    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [isStarted, resize]);

  if (showConfigPrompt) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
      }}>
        <div style={{ textAlign: 'center', padding: '32px' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>{errorMessage}</p>
          <Link
            href="/settings"
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--accent-primary)',
              color: 'white',
              borderRadius: 'var(--radius-md)',
              textDecoration: 'none',
            }}
          >
            前往设置
          </Link>
        </div>
      </div>
    );
  }

  return <div ref={containerRef} style={{ height: '100%', width: '100%', backgroundColor: 'var(--bg-primary)' }} />;
}