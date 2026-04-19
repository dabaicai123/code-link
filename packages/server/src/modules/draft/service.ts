import "reflect-metadata";
import { singleton, inject } from 'tsyringe';
import { DraftRepository } from './repository.js';
import { ProjectRepository } from '../project/repository.js';
import { AuthRepository } from '../auth/repository.js';
import { PermissionService } from '../../shared/permission.service.js';
import { ParamError, NotFoundError, PermissionError } from '../../core/errors/index.js';
import { parseAICommand, executeAICommand, isAICommand } from '../../ai/commands.js';
import type { SelectDraft, InsertDraftMessage } from '../../db/schema/index.js';
import type { CreateDraftInput, CreateDraftMessageInput, ConfirmMessageInput } from './schemas.js';
import type { DraftDetail, DraftMessageWithUser, MessageConfirmationWithUser } from './types.js';

@singleton()
export class DraftService {
  constructor(
    @inject(DraftRepository) private readonly draftRepo: DraftRepository,
    @inject(ProjectRepository) private readonly projectRepo: ProjectRepository,
    @inject(AuthRepository) private readonly authRepo: AuthRepository,
    @inject(PermissionService) private readonly permissionService: PermissionService
  ) {}

  // ==================== Draft CRUD ====================

  async create(userId: number, input: CreateDraftInput): Promise<SelectDraft> {
    // Validate title
    const trimmedTitle = input.title.trim();
    if (!trimmedTitle) {
      throw new ParamError('标题不能为空');
    }
    if (trimmedTitle.length > 200) {
      throw new ParamError('标题最多200个字符');
    }

    // Check project access
    const project = await this.projectRepo.findById(input.projectId);
    if (!project) {
      throw new NotFoundError('项目');
    }

    await this.permissionService.checkProjectAccess(userId, project.id);

    // Create draft with owner
    const draft = await this.draftRepo.createWithOwner({
      projectId: input.projectId,
      title: trimmedTitle,
      createdBy: userId,
    }, userId);

    // Add additional members if provided
    if (input.memberIds && input.memberIds.length > 0) {
      for (const memberId of input.memberIds) {
        const memberUser = await this.authRepo.findById(memberId);
        if (memberUser) {
          await this.draftRepo.addMember(draft.id, memberId, 'participant');
        }
      }
    }

    return draft;
  }

  async findById(draftId: number, userId: number): Promise<DraftDetail> {
    const draft = await this.draftRepo.findById(draftId);
    if (!draft) {
      throw new NotFoundError('草稿');
    }

    await this.checkDraftAccess(draftId, userId);

    const members = await this.draftRepo.findMembers(draftId);
    return { draft, members };
  }

  async findByUserId(userId: number): Promise<SelectDraft[]> {
    return this.draftRepo.findByUserId(userId);
  }

  async updateStatus(draftId: number, userId: number, status: string): Promise<SelectDraft> {
    const draft = await this.draftRepo.findById(draftId);
    if (!draft) {
      throw new NotFoundError('草稿');
    }

    await this.checkDraftAccess(draftId, userId);

    return this.draftRepo.updateStatus(draftId, status);
  }

  async delete(draftId: number, userId: number): Promise<void> {
    const draft = await this.draftRepo.findById(draftId);
    if (!draft) {
      throw new NotFoundError('草稿');
    }

    await this.checkDraftAccess(draftId, userId);

    // Only owner or admin can delete
    const member = await this.draftRepo.findMember(draftId, userId);
    const isSuperAdmin = await this.permissionService.isSuperAdmin(userId);

    if (!isSuperAdmin && (!member || member.role !== 'owner')) {
      throw new PermissionError('只有草稿 owner 可以删除');
    }

    await this.draftRepo.delete(draftId);
  }

  // ==================== Member Management ====================

  async addMember(draftId: number, userId: number, newUserId: number): Promise<void> {
    await this.checkDraftAccess(draftId, userId);

    const newUser = await this.authRepo.findById(newUserId);
    if (!newUser) {
      throw new NotFoundError('用户');
    }

    await this.draftRepo.addMember(draftId, newUserId, 'participant');
  }

  async removeMember(draftId: number, userId: number, memberId: number): Promise<void> {
    await this.checkDraftAccess(draftId, userId);

    await this.draftRepo.removeMember(draftId, memberId);
  }

  // ==================== Message Management ====================

  async createMessage(
    draftId: number,
    userId: number,
    input: CreateDraftMessageInput
  ): Promise<DraftMessageWithUser> {
    const draft = await this.draftRepo.findById(draftId);
    if (!draft) {
      throw new NotFoundError('草稿');
    }

    await this.checkDraftAccess(draftId, userId);

    const message = await this.draftRepo.createMessage({
      draftId,
      userId,
      content: input.content,
      messageType: input.messageType ?? 'text',
      parentId: input.parentId,
      metadata: input.metadata,
    });

    await this.draftRepo.touch(draftId);

    const user = await this.authRepo.findById(userId);
    return {
      ...message,
      userName: user?.name ?? null,
    };
  }

  async findMessages(draftId: number, userId: number, limit?: number): Promise<DraftMessageWithUser[]> {
    await this.checkDraftAccess(draftId, userId);

    return this.draftRepo.findMessages(draftId, limit);
  }

  // ==================== Confirmation Management ====================

  async confirmMessage(
    draftId: number,
    messageId: number,
    userId: number,
    input: ConfirmMessageInput
  ): Promise<MessageConfirmationWithUser> {
    await this.checkDraftAccess(draftId, userId);

    const message = await this.draftRepo.findMessage(draftId, messageId);
    if (!message) {
      throw new NotFoundError('消息');
    }

    const confirmation = await this.draftRepo.upsertConfirmation({
      messageId,
      userId,
      type: input.type,
      comment: input.comment,
    });

    const user = await this.authRepo.findById(userId);
    return {
      ...confirmation,
      userName: user?.name ?? '',
    };
  }

  async findConfirmations(
    draftId: number,
    messageId: number,
    userId: number
  ): Promise<MessageConfirmationWithUser[]> {
    await this.checkDraftAccess(draftId, userId);

    const message = await this.draftRepo.findMessage(draftId, messageId);
    if (!message) {
      throw new NotFoundError('消息');
    }

    return this.draftRepo.findConfirmations(messageId);
  }

  // ==================== AI Command Handling ====================

  async handleAICommand(
    draftId: number,
    userId: number,
    content: string
  ): Promise<{ success: boolean; response?: string; error?: string }> {
    await this.checkDraftAccess(draftId, userId);

    if (!isAICommand(content)) {
      throw new ParamError('无效的 AI 命令格式');
    }

    const command = parseAICommand(content);
    if (!command) {
      throw new ParamError('无效的 AI 命令格式');
    }

    // Create user message first
    await this.draftRepo.createMessage({
      draftId,
      userId,
      content,
      messageType: 'ai_command',
    });

    // Execute AI command
    const result = await executeAICommand(draftId, command, userId);

    // Create AI response message (using userId of the user who triggered the command)
    if (result.success && result.response) {
      await this.draftRepo.createMessage({
        draftId,
        userId, // User who triggered the AI command
        content: result.response,
        messageType: 'ai_response',
        metadata: JSON.stringify({ commandType: result.commandType }),
      });
      await this.draftRepo.touch(draftId);
    } else {
      await this.draftRepo.createMessage({
        draftId,
        userId,
        content: result.error ?? 'AI 命令执行失败',
        messageType: 'ai_error',
        metadata: JSON.stringify({ commandType: result.commandType }),
      });
    }

    return result;
  }

  checkIsAICommand(content: string): boolean {
    return isAICommand(content);
  }

  // ==================== Utility Methods ====================

  async isMember(draftId: number, userId: number): Promise<boolean> {
    const member = await this.draftRepo.findMember(draftId, userId);
    return !!member;
  }

  async isOwner(draftId: number, userId: number): Promise<boolean> {
    const member = await this.draftRepo.findMember(draftId, userId);
    return member?.role === 'owner';
  }

  async getProjectId(draftId: number): Promise<number | null> {
    const draft = await this.draftRepo.findById(draftId);
    return draft?.projectId ?? null;
  }

  // ==================== Private Helpers ====================

  private async checkDraftAccess(draftId: number, userId: number): Promise<void> {
    // Super admin always has access
    if (await this.permissionService.isSuperAdmin(userId)) {
      return;
    }

    const member = await this.draftRepo.findMember(draftId, userId);
    if (!member) {
      throw new PermissionError('您没有权限访问该草稿');
    }
  }
}