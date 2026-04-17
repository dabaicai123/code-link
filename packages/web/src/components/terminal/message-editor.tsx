'use client';

import { useState, useRef, KeyboardEvent } from 'react';

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

  return (
    <div style={{ borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
      {elements.length > 0 && (
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-color)', minHeight: '36px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', lineHeight: 1.8 }}>
            {elements.map((el) => (
              <span key={el.id} className="element-tag">
                &lt;{el.tagName}&gt;
                <span className="remove" onClick={() => onRemoveElement(el.id)}>✕</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ padding: '8px 12px', display: 'flex', gap: '8px' }}>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="描述修改需求，回车发送..."
          className="input"
          style={{ flex: 1 }}
        />
        <button onClick={handleSend} className="btn btn-primary">发送</button>
      </div>
    </div>
  );
}
