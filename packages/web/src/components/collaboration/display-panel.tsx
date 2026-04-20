'use client';

import { useReducer, useRef, useCallback } from 'react';

export interface SelectedElement {
  id: string;
  tagName: string;
  selector: string;
  content?: string;
  children?: SelectedElement[];
}

interface DisplayPanelProps {
  onAddElement: (element: SelectedElement) => void;
}

interface DisplayState {
  url: string;
  selectMode: boolean;
  selectedElement: SelectedElement | null;
  selectedElementRect: { x: number; y: number; width: number; height: number } | null;
  hoveredElement: SelectedElement | null;
  hoveredElementRect: { x: number; y: number; width: number; height: number } | null;
  clickPosition: { x: number; y: number } | null;
}

type DisplayAction =
  | { type: 'SET_URL'; url: string }
  | { type: 'TOGGLE_SELECT_MODE' }
  | { type: 'CLEAR_SELECTION_STATE' }
  | { type: 'SET_SELECTED'; element: SelectedElement; rect: DisplayState['selectedElementRect']; click: { x: number; y: number } }
  | { type: 'CLEAR_SELECTED' }
  | { type: 'SET_HOVERED'; element: SelectedElement; rect: DisplayState['hoveredElementRect'] }
  | { type: 'CLEAR_HOVERED' };

const initialState: DisplayState = {
  url: 'http://localhost:3000',
  selectMode: false,
  selectedElement: null,
  selectedElementRect: null,
  hoveredElement: null,
  hoveredElementRect: null,
  clickPosition: null,
};

function displayReducer(state: DisplayState, action: DisplayAction): DisplayState {
  switch (action.type) {
    case 'SET_URL':
      return { ...state, url: action.url };
    case 'TOGGLE_SELECT_MODE':
      return {
        ...state,
        selectMode: !state.selectMode,
        ...(!state.selectMode ? {
          selectedElement: null,
          selectedElementRect: null,
          clickPosition: null,
          hoveredElement: null,
          hoveredElementRect: null,
        } : {}),
      };
    case 'CLEAR_SELECTION_STATE':
      return {
        ...state,
        selectedElement: null,
        selectedElementRect: null,
        clickPosition: null,
      };
    case 'SET_SELECTED':
      return {
        ...state,
        selectedElement: action.element,
        selectedElementRect: action.rect,
        clickPosition: action.click,
        hoveredElement: null,
        hoveredElementRect: null,
      };
    case 'CLEAR_SELECTED':
      return {
        ...state,
        selectedElement: null,
        selectedElementRect: null,
        clickPosition: null,
      };
    case 'SET_HOVERED':
      return {
        ...state,
        hoveredElement: action.element,
        hoveredElementRect: action.rect,
      };
    case 'CLEAR_HOVERED':
      return {
        ...state,
        hoveredElement: null,
        hoveredElementRect: null,
      };
    default:
      return state;
  }
}

export function DisplayPanel({ onAddElement }: DisplayPanelProps) {
  const [state, dispatch] = useReducer(displayReducer, initialState);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleRefresh = () => {
    if (iframeRef.current) {
      iframeRef.current.src = state.url;
    }
  };

  const handleAddElement = () => {
    if (state.selectedElement) {
      onAddElement(state.selectedElement);
      dispatch({ type: 'CLEAR_SELECTED' });
    }
  };

  const handleCancelSelection = () => {
    dispatch({ type: 'CLEAR_SELECTION_STATE' });
  };

  // 计算元素的 CSS 选择器
  const getSelector = useCallback((element: Element): string => {
    if (element.id) {
      return `#${element.id}`;
    }

    const path: string[] = [];
    let current: Element | null = element;

    while (current && current.tagName !== 'HTML') {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        selector = `#${current.id}`;
        path.unshift(selector);
        break;
      }

      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/).filter(c => c);
        if (classes.length > 0) {
          selector += `.${classes.slice(0, 2).join('.')}`;
        }
      }

      const siblings = current.parentElement?.children;
      if (siblings && siblings.length > 1) {
        const index = Array.from(siblings).indexOf(current) + 1;
        selector += `:nth-child(${index})`;
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    return path.join(' > ');
  }, []);

  // 提取元素及其子元素信息
  const extractElementInfo = useCallback((element: Element): SelectedElement => {
    const selector = getSelector(element);
    const content = element.textContent?.trim().slice(0, 100) || undefined;
    const children: SelectedElement[] = [];

    // 提取直接子元素
    Array.from(element.children).forEach((child) => {
      if (child.tagName !== 'SCRIPT' && child.tagName !== 'STYLE') {
        children.push(extractElementInfo(child));
      }
    });

    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      tagName: element.tagName.toLowerCase(),
      selector,
      content,
      children: children.length > 0 ? children : undefined,
    };
  }, [getSelector]);

  // 处理 iframe 内的点击（通过 overlay 捕获坐标）
  const handleOverlayClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!state.selectMode || !iframeRef.current) return;

    const iframe = iframeRef.current;
    const iframeRect = iframe.getBoundingClientRect();

    // 计算点击位置相对于 iframe 的坐标
    const x = e.clientX - iframeRect.left;
    const y = e.clientY - iframeRect.top;

    // 获取 iframe 内的元素
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) return;

      const element = iframeDoc.elementFromPoint(x, y);
      if (!element || element.tagName === 'HTML' || element.tagName === 'BODY') return;

      // 提取元素及其子元素信息
      const elementInfo = extractElementInfo(element);

      // 获取元素在 iframe 内的位置
      const elementRect = element.getBoundingClientRect();

      dispatch({
        type: 'SET_SELECTED',
        element: elementInfo,
        rect: {
          x: elementRect.left,
          y: elementRect.top,
          width: elementRect.width,
          height: elementRect.height,
        },
        click: { x, y },
      });
    } catch (err) {
      console.error('无法访问 iframe 内容（可能是跨域限制）:', err);
    }
  }, [state.selectMode, extractElementInfo]);

  // 处理 hover 显示预览（只在没有选中元素时生效）
  const handleOverlayMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // 如果已经有选中元素，不更新 hover
    if (!state.selectMode || !iframeRef.current || state.selectedElement) return;

    const iframe = iframeRef.current;
    const iframeRect = iframe.getBoundingClientRect();
    const x = e.clientX - iframeRect.left;
    const y = e.clientY - iframeRect.top;

    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        dispatch({ type: 'CLEAR_HOVERED' });
        return;
      }

      const element = iframeDoc.elementFromPoint(x, y);
      if (!element || element.tagName === 'HTML' || element.tagName === 'BODY') {
        dispatch({ type: 'CLEAR_HOVERED' });
        return;
      }

      const selector = getSelector(element);
      const content = element.textContent?.trim().slice(0, 50) || undefined;

      const elementRect = element.getBoundingClientRect();

      dispatch({
        type: 'SET_HOVERED',
        element: {
          id: 'preview',
          tagName: element.tagName.toLowerCase(),
          selector,
          content,
        },
        rect: {
          x: elementRect.left,
          y: elementRect.top,
          width: elementRect.width,
          height: elementRect.height,
        },
      });
    } catch {
      dispatch({ type: 'CLEAR_HOVERED' });
    }
  }, [state.selectMode, state.selectedElement, getSelector]);

  const handleOverlayMouseLeave = useCallback(() => {
    // 只在没有选中元素时清除 hover
    if (!state.selectedElement) {
      dispatch({ type: 'CLEAR_HOVERED' });
    }
  }, [state.selectedElement]);

  // 计算添加按钮的位置
  const getAddButtonPosition = () => {
    if (!state.clickPosition) return { top: 0, left: 0 };
    const overlay = overlayRef.current;
    if (!overlay) return { top: state.clickPosition.y + 10, left: state.clickPosition.x };

    const overlayRect = overlay.getBoundingClientRect();
    const buttonWidth = 100;
    const buttonHeight = 32;
    const padding = 10;

    let top = state.clickPosition.y + padding;
    let left = state.clickPosition.x;

    if (left + buttonWidth > overlayRect.width) {
      left = overlayRect.width - buttonWidth - padding;
    }

    if (top + buttonHeight > overlayRect.height) {
      top = state.clickPosition.y - buttonHeight - padding;
    }

    return { top, left: Math.max(padding, left) };
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '4px 8px' }}>
          <input
            type="text"
            value={state.url}
            onChange={(e) => dispatch({ type: 'SET_URL', url: e.target.value })}
            style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' }}
          />
        </div>
        <button onClick={handleRefresh} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }}>刷新</button>
        <button
          onClick={() => dispatch({ type: 'TOGGLE_SELECT_MODE' })}
          className="btn"
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            backgroundColor: state.selectMode ? 'rgba(248, 113, 113, 0.2)' : 'var(--accent-color)',
            border: state.selectMode ? '1px solid var(--status-error)' : 'none',
            color: state.selectMode ? 'var(--status-error)' : 'white',
          }}
        >
          {state.selectMode ? '✕ 取消选择' : '🎯 选择'}
        </button>
      </div>

      {state.selectMode && (
        <div style={{ padding: '4px 12px', backgroundColor: 'rgba(124, 58, 237, 0.1)', borderBottom: '1px solid var(--accent-color)', fontSize: '11px', color: 'var(--accent-light)' }}>
          选择模式已开启，点击页面元素可添加到消息中
        </div>
      )}

      <div style={{ flex: 1, position: 'relative' }}>
        <iframe
          ref={iframeRef}
          src={state.url}
          style={{ width: '100%', height: '100%', border: 'none', backgroundColor: 'white' }}
        />
        {/* 选择模式覆盖层 */}
        {state.selectMode && (
          <div
            ref={overlayRef}
            onClick={handleOverlayClick}
            onMouseMove={handleOverlayMouseMove}
            onMouseLeave={handleOverlayMouseLeave}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              cursor: state.selectedElement ? 'default' : 'crosshair',
              zIndex: 10,
              backgroundColor: 'transparent',
            }}
          >
            {/* hover 时的高亮框（只在未选中时显示） */}
            {state.hoveredElementRect && !state.selectedElement && (
              <div
                style={{
                  position: 'absolute',
                  top: state.hoveredElementRect.y,
                  left: state.hoveredElementRect.x,
                  width: state.hoveredElementRect.width,
                  height: state.hoveredElementRect.height,
                  border: '2px solid var(--accent-color)',
                  backgroundColor: 'rgba(124, 58, 237, 0.1)',
                  pointerEvents: 'none',
                  borderRadius: '2px',
                }}
              />
            )}

            {/* 选中元素的高亮框 */}
            {state.selectedElementRect && (
              <div
                style={{
                  position: 'absolute',
                  top: state.selectedElementRect.y,
                  left: state.selectedElementRect.x,
                  width: state.selectedElementRect.width,
                  height: state.selectedElementRect.height,
                  border: '2px solid var(--status-success)',
                  backgroundColor: 'rgba(34, 197, 94, 0.15)',
                  pointerEvents: 'none',
                  borderRadius: '2px',
                }}
              />
            )}

            {/* 点击后出现在鼠标附近的添加按钮 */}
            {state.selectedElement && state.clickPosition && (
              <div
                style={{
                  position: 'absolute',
                  top: getAddButtonPosition().top,
                  left: getAddButtonPosition().left,
                  display: 'flex',
                  gap: '4px',
                  zIndex: 20,
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddElement();
                  }}
                  className="btn btn-primary"
                  style={{
                    padding: '6px 12px',
                    fontSize: '11px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  }}
                >
                  + 添加 &lt;{state.selectedElement.tagName}&gt;
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCancelSelection();
                  }}
                  className="btn btn-secondary"
                  style={{
                    padding: '6px 8px',
                    fontSize: '11px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  }}
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}