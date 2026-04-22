import "reflect-metadata";
import { singleton, inject } from 'tsyringe';
import { Request, Response } from 'express';
import { DraftService } from './service.js';
import { success } from '../../core/errors/index.js';

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
    const drafts = await this.service.findByUserId(req.userId!);
    res.json(success(drafts));
  }

  async get(req: Request, res: Response): Promise<void> {
    const draftId = Number(req.params.draftId);
    const result = await this.service.findById(draftId, req.userId!);
    res.json(success(result));
  }

  async updateStatus(req: Request, res: Response): Promise<void> {
    const draftId = Number(req.params.draftId);
    const result = await this.service.updateStatus(draftId, req.userId!, req.body.status);
    res.json(success(result));
  }

  async delete(req: Request, res: Response): Promise<void> {
    const draftId = Number(req.params.draftId);
    await this.service.delete(draftId, req.userId!);
    res.status(204).send();
  }


  async createMessage(req: Request, res: Response): Promise<void> {
    const draftId = Number(req.params.draftId);
    const result = await this.service.createMessage(draftId, req.userId!, req.body);
    res.status(201).json(success(result));
  }

  async listMessages(req: Request, res: Response): Promise<void> {
    const draftId = Number(req.params.draftId);
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const messages = await this.service.findMessages(draftId, req.userId!, limit);
    res.json(success(messages));
  }


  async confirmMessage(req: Request, res: Response): Promise<void> {
    const draftId = Number(req.params.draftId);
    const messageId = Number(req.params.messageId);
    const result = await this.service.confirmMessage(draftId, messageId, req.userId!, req.body);
    res.json(success(result));
  }

  async listConfirmations(req: Request, res: Response): Promise<void> {
    const draftId = Number(req.params.draftId);
    const messageId = Number(req.params.messageId);
    const confirmations = await this.service.findConfirmations(draftId, messageId, req.userId!);
    res.json(success(confirmations));
  }


  async listCards(req: Request, res: Response): Promise<void> {
    const draftId = Number(req.params.draftId);
    const cards = await this.service.findCards(draftId, req.userId!);
    res.json(success(cards));
  }


  async addMember(req: Request, res: Response): Promise<void> {
    const draftId = Number(req.params.draftId);
    await this.service.addMember(draftId, req.userId!, req.body.newUserId);
    res.json(success(null));
  }

  async removeMember(req: Request, res: Response): Promise<void> {
    const draftId = Number(req.params.draftId);
    const memberId = Number(req.params.memberId);
    await this.service.removeMember(draftId, req.userId!, memberId);
    res.status(204).send();
  }
}