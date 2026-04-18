import type {
  Draft,
  DraftMember,
  DraftMessage,
  CreateDraftInput,
  SendMessageInput,
  DraftStatus,
  ConfirmationType,
} from '../types/draft';

const API_BASE = '/api/drafts';

async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token');
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const draftsApi = {
  // 创建 Draft
  async create(input: CreateDraftInput): Promise<{ draft: Draft }> {
    return fetchApi(`${API_BASE}`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  // 获取 Draft 列表
  async list(projectId?: number): Promise<{ drafts: Draft[] }> {
    const url = projectId ? `${API_BASE}?projectId=${projectId}` : API_BASE;
    return fetchApi(url);
  },

  // 获取 Draft 详情
  async get(draftId: number): Promise<{ draft: Draft; members: DraftMember[] }> {
    return fetchApi(`${API_BASE}/${draftId}`);
  },

  // 更新 Draft 状态
  async updateStatus(draftId: number, status: DraftStatus): Promise<{ draft: Draft }> {
    return fetchApi(`${API_BASE}/${draftId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },

  // 删除 Draft
  async delete(draftId: number): Promise<{ success: boolean }> {
    return fetchApi(`${API_BASE}/${draftId}`, {
      method: 'DELETE',
    });
  },

  // 添加成员
  async addMember(draftId: number, userId: number): Promise<{ success: boolean }> {
    return fetchApi(`${API_BASE}/${draftId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  },

  // 移除成员
  async removeMember(draftId: number, userId: number): Promise<{ success: boolean }> {
    return fetchApi(`${API_BASE}/${draftId}/members/${userId}`, {
      method: 'DELETE',
    });
  },

  // 获取消息列表
  async getMessages(
    draftId: number,
    options?: { parentId?: number; limit?: number; before?: string }
  ): Promise<{ messages: DraftMessage[] }> {
    const params = new URLSearchParams();
    if (options?.parentId !== undefined) {
      params.set('parentId', String(options.parentId));
    }
    if (options?.limit) {
      params.set('limit', String(options.limit));
    }
    if (options?.before) {
      params.set('before', options.before);
    }
    const query = params.toString();
    return fetchApi(`${API_BASE}/${draftId}/messages${query ? `?${query}` : ''}`);
  },

  // 发送消息
  async sendMessage(draftId: number, input: SendMessageInput): Promise<{ message: DraftMessage }> {
    return fetchApi(`${API_BASE}/${draftId}/messages`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  // 确认消息
  async confirmMessage(
    draftId: number,
    messageId: number,
    type: ConfirmationType,
    comment?: string
  ): Promise<{ success: boolean }> {
    return fetchApi(`${API_BASE}/${draftId}/messages/${messageId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ type, comment }),
    });
  },

  // 获取消息确认列表
  async getConfirmations(
    draftId: number,
    messageId: number
  ): Promise<{ confirmations: Array<{ userId: number; userName: string; type: string; comment: string | null }> }> {
    return fetchApi(`${API_BASE}/${draftId}/messages/${messageId}/confirmations`);
  },
};