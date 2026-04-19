'use client';

import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { TerminalWebSocket } from '@/lib/websocket/terminal';
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
  const isConnectedRef = useRef(false);
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

  useEffect(() => {
    if (!xtermRef.current || !mountedRef.current) return;

    if (wsRef.current) {
      wsRef.current.disconnect();
      wsRef.current = null;
    }

    const terminalUrl = wsUrl.includes('/terminal') ? wsUrl : `${wsUrl}/terminal`;
    const ws = new TerminalWebSocket(terminalUrl, projectId, userId);
    wsRef.current = ws;

    ws.on('connected', () => {
      if (!mountedRef.current) return;
      setIsConnected(true);
      isConnectedRef.current = true;
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
        isConnectedRef.current = false;
        xtermRef.current?.write('\r\n\x1b[33m[Session ended]\x1b[0m\r\n');
      }
    });

    ws.setOnError((msg) => {
      if (!mountedRef.current) return;

      if (msg.includes('请先在「设置')) {
        setShowConfigPrompt(true);
        setErrorMessage(msg);
      } else {
        if (!isConnectedRef.current) {
          xtermRef.current?.write(`\r\n\x1b[31m[Error: ${msg}]\x1b[0m\r\n`);
        }
      }
    });

    const disposable = xtermRef.current.onData((data) => {
      if (isConnectedRef.current && mountedRef.current) {
        ws.sendInput(data);
      }
    });
    const pingInterval = setInterval(() => {
      if (isConnectedRef.current) ws.ping();
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
        if (dims && wsRef.current && isConnectedRef.current) wsRef.current.resize(dims.cols, dims.rows);
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