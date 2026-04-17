'use client';

import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { TerminalWebSocket } from '@/lib/terminal-websocket';
import '@xterm/xterm/css/xterm.css';

interface TerminalPanelProps {
  projectId: string;
  userId: string;
  wsUrl?: string;
}

export function TerminalPanel({ projectId, userId, wsUrl = 'ws://localhost:3001/terminal' }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<TerminalWebSocket | null>(null);

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
    if (!xtermRef.current) return;

    const ws = new TerminalWebSocket();
    wsRef.current = ws;

    ws.setOnConnected(() => {
      if (fitAddonRef.current) {
        const dims = fitAddonRef.current.proposeDimensions();
        ws.start(dims?.cols || 80, dims?.rows || 24);
      }
    });

    ws.setOnOutput((data) => xtermRef.current?.write(data));
    ws.setOnExit(() => xtermRef.current?.write('\r\n\x1b[33m[Session ended]\x1b[0m\r\n'));
    ws.setOnError((msg) => xtermRef.current?.write(`\r\n\x1b[31m[Error: ${msg}]\x1b[0m\r\n`));

    ws.connect(wsUrl, projectId, userId);

    const disposable = xtermRef.current.onData((data) => ws.sendInput(data));
    const pingInterval = setInterval(() => ws.ping(), 30000);

    return () => {
      clearInterval(pingInterval);
      disposable.dispose();
      ws.disconnect();
    };
  }, [projectId, userId, wsUrl]);

  useEffect(() => {
    if (!containerRef.current || !fitAddonRef.current) return;

    const handleResize = () => {
      if (fitAddonRef.current && xtermRef.current) {
        fitAddonRef.current.fit();
        const dims = fitAddonRef.current.proposeDimensions();
        if (dims && wsRef.current) wsRef.current.resize(dims.cols, dims.rows);
      }
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(containerRef.current);
    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <div ref={containerRef} style={{ height: '100%', width: '100%', backgroundColor: 'var(--bg-primary)' }} />;
}
