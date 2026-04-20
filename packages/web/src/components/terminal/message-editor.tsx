'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface SelectedElement {
  id: string;
  tagName: string;
  selector: string;
  content?: string;
}

interface MessageEditorProps {
  elements: SelectedElement[];
  onRemoveElement: (id: string) => void;
  onSend: (message: string, elements: SelectedElement[]) => void;
}

export function MessageEditor({ elements, onRemoveElement, onSend }: MessageEditorProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && text === '' && elements.length > 0) {
      onRemoveElement(elements[elements.length - 1].id);
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (text.trim() || elements.length > 0) {
        onSend(text, elements);
        setText('');
      }
    }
  };

  const handleSend = () => {
    if (text.trim() || elements.length > 0) {
      onSend(text, elements);
      setText('');
    }
  };

  const handleContainerClick = () => {
    inputRef.current?.focus();
  };

  return (
    <div className="border-t border-border bg-secondary p-2 flex gap-2">
      <div
        onClick={handleContainerClick}
        className="inline-input-container flex-1"
      >
        {elements.map((el) => (
          <span key={el.id} className="element-tag">
            &lt;{el.tagName}&gt;
            <span className="remove" onClick={(e) => { e.stopPropagation(); onRemoveElement(el.id); }}>✕</span>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={elements.length > 0 ? "描述修改..." : "输入需求，回车发送..."}
          className="flex-1 min-w-[60px] bg-transparent border-none outline-none text-foreground text-[13px] placeholder:text-muted-foreground"
        />
      </div>
      <Button
        onClick={handleSend}
        disabled={!text.trim() && elements.length === 0}
        size="sm"
        className="h-9"
      >
        发送
      </Button>
    </div>
  );
}
