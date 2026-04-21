// packages/web/src/components/chat/assistant-message.tsx
'use client';

import { useMemo } from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.min.css';

// Configure marked with custom code renderer
const renderer = new marked.Renderer();
renderer.code = function ({ text, lang }: { text: string; lang?: string }) {
  const language = (lang || 'plaintext').toLowerCase();
  let highlighted: string;
  try {
    if (hljs.getLanguage(language)) {
      highlighted = hljs.highlight(text, { language }).value;
    } else {
      highlighted = hljs.highlightAuto(text).value;
    }
  } catch {
    highlighted = text;
  }
  return `<div class="code-block-wrapper"><div class="code-block-header"><span class="code-lang">${language}</span><button class="code-copy-btn" onclick="navigator.clipboard.writeText(this.closest('.code-block-wrapper').querySelector('code').textContent)">Copy</button></div><pre class="hljs"><code class="language-${language}">${highlighted}</code></pre></div>`;
};

marked.setOptions({ renderer, breaks: true, gfm: true });

interface AssistantMessageProps {
  content: string;
  isStreaming?: boolean;
}

export function AssistantMessage({ content, isStreaming }: AssistantMessageProps) {
  const html = useMemo(() => {
    if (!content && isStreaming) {
      return '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    }
    try {
      return marked.parse(content) as string;
    } catch {
      return content;
    }
  }, [content, isStreaming]);

  return (
    <div
      className="msg-text text-text-primary leading-relaxed"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}