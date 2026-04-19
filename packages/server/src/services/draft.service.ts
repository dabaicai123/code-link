import "reflect-metadata";
import { singleton, inject } from "tsyringe";
import { DraftRepository } from '../repositories/draft.repository.js';
import { ProjectRepository } from '../repositories/project.repository.js';
import { PermissionService } from './permission.service.js';
import { NotFoundError, ParamError, PermissionError } from '../utils/errors.js';
import { isAICommand, parseAICommand, executeAICommand } from '../ai/commands.js';
import { isAIEnabled } from '../ai/client.js';
import type { SelectDraft } from '../db/schema/index.js';
import type { DraftMemberWithUser, DraftMessageWithUser } from '../repositories/draft.repository.js';

export interface CreateDraftInput {
  projectId: number;
  title: string;
  memberIds?: number[];
}

@singleton()
export class DraftService {
  constructor(
    @inject(DraftRepository) private draftRepo: DraftRepository,
    @inject(ProjectRepository) private projectRepo: ProjectRepository,
    @inject(PermissionService) private permService: PermissionService
  ) {}

  async create(userId: number, input: CreateDraftInput): Promise<SelectDraft> {
    if (!input.projectId || !input.title) {
      throw new ParamError('缺少必填字段：projectId, title');
    }

    if (typeof input.title !== 'string' || input.title.length > 200) {
      throw new ParamError('Draft 标题必须是 1-200 字符的字符串');
    }

    const project = await this.projectRepo.findById(input.projectId);
    if (!project) {
      throw new NotFoundError('项目');
    }

    await this.permService.checkOrgRole(userId, project.organizationId, 'developer');

    const draft = await this.draftRepo.createWithOwner({
      projectId: input.projectId,
      title: input.title,
      createdBy: userId,
    }, userId);

    if (input.memberIds && input.memberIds.length > 0) {
      for (const memberId of input.memberIds) {
        if (memberId !== userId) {
          const isOrgMember = await this.permService.getOrgRole(memberId, project.organizationId);
          if (isOrgMember) {
            await this.draftRepo.addMember({
              draftId: draft.id,
              userId: memberId,
              role: 'participant',
            });
          }
        }
      }
    }

    return draft;
  }

  async findByUserId(userId: number): Promise<SelectDraft[]> {
    return this.draftRepo.findByUserId(userId);
  }

  async findById(draftId: number, userId: number): Promise<{ draft: SelectDraft; members: DraftMemberWithUser[] }> {
    const membership = await this.draftRepo.findMember(draftId, userId);
    if (!membership) {
      throw new PermissionError('您不是该 Draft 的成员');
    }

    const draft = await this.draftRepo.findById(draftId);
    if (!draft) {
      throw new NotFoundError('Draft');
    }

    const members = await this.draftRepo.findMembers(draftId);
    return { draft, members };
  }

  async updateStatus(draftId: number, userId: number, status: string): Promise<SelectDraft> {
    const validStatuses = ['discussing', 'brainstorming', 'reviewing', 'developing', 'confirmed', 'archived'];
    if (!validStatuses.includes(status)) {
      throw new ParamError('无效的状态值');
    }

    const membership = await this.draftRepo.findMember(draftId, userId);
    if (!membership) {
      throw new PermissionError('您不是该 Draft 的成员');
    }

    return this.draftRepo.updateStatus(draftId, status);
  }

  async delete(draftId: number, userId: number): Promise<void> {
    const membership = await this.draftRepo.findMember(draftId, userId);
    if (!membership || membership.role !== 'owner') {
      throw new PermissionError('只有 Draft owner 可以删除 Draft');
    }

    await this.draftRepo.delete(draftId);
  }

  async isMember(draftId: number, userId: number): Promise<boolean> {
    const membership = await this.draftRepo.findMember(draftId, userId);
    return !!membership;
  }

  async isOwner(draftId: number, userId: number): Promise<boolean> {
    const membership = await this.draftRepo.findMember(draftId, userId);
    return membership?.role === 'owner';
  }

  async createMessage(draftId: number, userId: number, input: { content: string; messageType?: string; parentId?: number; metadata?: string }): Promise<DraftMessageWithUser> {
    if (!input.content) {
      throw new ParamError('参数无效');
    }

    const membership = await this.draftRepo.findMember(draftId, userId);
    if (!membership) {
      throw new PermissionError('您不是该 Draft 的成员');
    }

    const message = await this.draftRepo.createMessage({
      draftId,
      parentId: input.parentId || null,
      userId,
      content: input.content,
      messageType: (input.messageType || 'text') as 'text' | 'image' | 'code' | 'document_card' | 'ai_command' | 'system' | 'ai_response' | 'ai_error',
      metadata: input.metadata || null,
    });

    await this.draftRepo.touch(draftId);

    return {
      ...message,
      userName: 'User',
    };
  }

  async findMessages(draftId: number, userId: number, options?: { parentId?: number | null; before?: string; limit?: number }): Promise<DraftMessageWithUser[]> {
    const membership = await this.draftRepo.findMember(draftId, userId);
    if (!membership) {
      throw new PermissionError('您不是该 Draft 的成员');
    }

    return this.draftRepo.findMessages(draftId, options || {});
  }

  async confirmMessage(draftId: number, messageId: number, userId: number, input: { type: string; comment?: string }): Promise<{ userId: number; userName: string; type: string }> {
    const validTypes = ['agree', 'disagree', 'suggest'];
    if (!validTypes.includes(input.type)) {
      throw new ParamError('type 必须是 agree, disagree 或 suggest');
    }

    const membership = await this.draftRepo.findMember(draftId, userId);
    if (!membership) {
      throw new PermissionError('您不是该 Draft 的成员');
    }

    const message = await this.draftRepo.findMessage(messageId, draftId);
    if (!message) {
      throw new NotFoundError('消息');
    }

    await this.draftRepo.upsertConfirmation({
      messageId,
      userId,
      type: input.type as 'agree' | 'disagree' | 'suggest',
      comment: input.comment || null,
    });

    return {
      userId,
      userName: 'User',
      type: input.type,
    };
  }

  async findConfirmations(draftId: number, messageId: number, userId: number) {
    const membership = await this.draftRepo.findMember(draftId, userId);
    if (!membership) {
      throw new PermissionError('您不是该 Draft 的成员');
    }

    return this.draftRepo.findConfirmations(messageId);
  }

  async addMember(draftId: number, userId: number, newUserId: number): Promise<void> {
    const membership = await this.draftRepo.findMember(draftId, userId);
    if (!membership || membership.role !== 'owner') {
      throw new PermissionError('只有 Draft owner 可以添加成员');
    }

    const draft = await this.draftRepo.findById(draftId);
    if (!draft) {
      throw new NotFoundError('Draft');
    }

    const project = await this.projectRepo.findById(draft.projectId);
    if (!project) {
      throw new NotFoundError('项目');
    }

    const isOrgMember = await this.permService.getOrgRole(newUserId, project.organizationId);
    if (!isOrgMember) {
      throw new PermissionError('用户不是项目所属组织的成员');
    }

    await this.draftRepo.addMember({
      draftId,
      userId: newUserId,
      role: 'participant',
    });
  }

  async removeMember(draftId: number, userId: number, memberId: number): Promise<void> {
    const membership = await this.draftRepo.findMember(draftId, userId);
    if (!membership || membership.role !== 'owner') {
      throw new PermissionError('只有 Draft owner 可以移除成员');
    }

    const targetMembership = await this.draftRepo.findMember(draftId, memberId);
    if (!targetMembership) {
      throw new NotFoundError('成员');
    }

    if (targetMembership.role === 'owner') {
      throw new PermissionError('无法移除 Draft owner');
    }

    await this.draftRepo.removeMember(draftId, memberId);
  }

  async getProjectId(draftId: number): Promise<number | null> {
    const draft = await this.draftRepo.findById(draftId);
    return draft?.projectId || null;
  }

  async handleAICommand(
    draftId: number,
    userId: number,
    content: string,
    parentMessageId?: number
  ): Promise<{ success: boolean; message?: DraftMessageWithUser; error?: string }> {
    if (!isAIEnabled()) {
      return {
        success: false,
        error: 'AI 功能未启用。请配置 ANTHROPIC_API_KEY。',
      };
    }

    const command = parseAICommand(content);
    if (!command) {
      return {
        success: false,
        error: '无法解析 AI 命令',
      };
    }

    try {
      const aiResult = await executeAICommand(draftId, command, userId);

      const aiResponseContent = aiResult.success
        ? aiResult.response
        : `AI 命令执行失败: ${aiResult.error}`;

      const aiMessage = await this.createMessage(draftId, 0, {
        content: aiResponseContent || '',
        messageType: aiResult.success ? 'ai_response' : 'ai_error',
        parentId: parentMessageId,
        metadata: JSON.stringify({ commandType: command.type }),
      });

      return {
        success: aiResult.success,
        message: aiMessage,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'AI 命令执行失败',
      };
    }
  }

  checkIsAICommand(content: string): boolean {
    return isAICommand(content);
  }
}