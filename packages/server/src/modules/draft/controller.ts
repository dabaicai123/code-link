import "reflect-metadata";
import { singleton, inject } from 'tsyringe';
import { Request, Response } from 'express';
import { DraftService } from './service.js';
import { success } from '../../core/errors/index.js';
import { draftPaginationSchema, messagePaginationSchema } from '../../core/database/pagination.js';

@singleton()
export class DraftController {
  constructor(
    @inject(DraftService) private readonly service: DraftService
  ) {}

  async create(req: Request, res: Response): Promise<void> {
    const result = await this.service.create(req.userId!, req.body);
    res.status(201).json(success(result));
  }

  async list(req: Request, res: Response): Promise<void> {
    const { page, limit } = draftPaginationSchema.parse(req.query);
    const result = await this.service.findByUserId(req.userId!, page, limit);
    res.json(success(result));
  }

  async get(req: Request, res: Response): Promise<void> {
    const { draftId } = req.validatedParams!;
    const result = await this.service.findById(draftId, req.userId!);
    res.json(success(result));
  }

  async updateStatus(req: Request, res: Response): Promise<void> {
    const { draftId } = req.validatedParams!;
    const result = await this.service.updateStatus(draftId, req.userId!, req.body.status);
    res.json(success(result));
  }

  async delete(req: Request, res: Response): Promise<void> {
    const { draftId } = req.validatedParams!;
    await this.service.delete(draftId, req.userId!);
    res.status(204).send();
  }

  async createMessage(req: Request, res: Response): Promise<void> {
    const { draftId } = req.validatedParams!;
    const result = await this.service.createMessage(draftId, req.userId!, req.body);
    res.status(201).json(success(result));
  }

  async listMessages(req: Request, res: Response): Promise<void> {
    const { draftId } = req.validatedParams!;
    const { page, limit } = messagePaginationSchema.parse(req.query);
    const result = await this.service.findMessages(draftId, req.userId!, page, limit);
    res.json(success(result));
  }

  async confirmMessage(req: Request, res: Response): Promise<void> {
    const { draftId, messageId } = req.validatedParams!;
    const result = await this.service.confirmMessage(draftId, messageId, req.userId!, req.body);
    res.json(success(result));
  }

  async listConfirmations(req: Request, res: Response): Promise<void> {
    const { draftId, messageId } = req.validatedParams!;
    const confirmations = await this.service.findConfirmations(draftId, messageId, req.userId!);
    res.json(success(confirmations));
  }

  async listCards(req: Request, res: Response): Promise<void> {
    const { draftId } = req.validatedParams!;
    const cards = await this.service.findCards(draftId, req.userId!);
    res.json(success(cards));
  }

  async addMember(req: Request, res: Response): Promise<void> {
    const { draftId } = req.validatedParams!;
    await this.service.addMember(draftId, req.userId!, req.body.newUserId);
    res.json(success(null));
  }

  async removeMember(req: Request, res: Response): Promise<void> {
    const { draftId, memberId } = req.validatedParams!;
    await this.service.removeMember(draftId, req.userId!, memberId);
    res.status(204).send();
  }
}