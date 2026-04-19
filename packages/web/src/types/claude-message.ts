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

  if (message.elements.length > 0) {
    parts.push('--- 选中元素 ---');
    message.elements.forEach((el, index) => {
      parts.push(`\n[${index + 1}] <${el.tagName}>`);
      parts.push(`    选择器: ${el.selector}`);
      if (el.content) {
        parts.push(`    内容: ${el.content.slice(0, 100)}${el.content.length > 100 ? '...' : ''}`);
      }
    });
    parts.push('\n--- 用户需求 ---');
  }

  parts.push(message.userRequest);

  return parts.join('\n');
}
