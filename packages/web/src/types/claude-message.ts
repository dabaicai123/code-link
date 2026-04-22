// packages/web/src/types/claude-message.ts

/**
 * 选中的元素信息
 */
export interface SelectedElement {
  id: string;
  tagName: string;
  selector: string;
  content?: string;
  children?: SelectedElement[];
}

/**
 * 发送给 Claude Code 的消息
 */
export interface ClaudeMessage {
  type: 'claude-request';
  elements: SelectedElement[];
  userRequest: string;
  timestamp: number;
}

/**
 * 格式化消息为 Claude 可读格式
 */
export function formatClaudeMessage(message: ClaudeMessage): string {
  const parts: string[] = [];

  // Insert element references inline with the text
  if (message.elements.length > 0) {
    const elementRefs = message.elements.map((el) => `<${el.tagName} selector="${el.selector}">`).join(' ');
    parts.push(message.userRequest + ' ' + elementRefs);
  } else {
    parts.push(message.userRequest);
  }

  return parts.join('\n');
}
