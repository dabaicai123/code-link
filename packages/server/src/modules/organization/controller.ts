import "reflect-metadata";
import { singleton, inject } from 'tsyringe';
import { Request, Response } from 'express';
import { OrganizationService } from './service.js';
import { success } from '../../core/errors/index.js';
import { organizationPaginationSchema } from '../../core/database/pagination.js';

@singleton()
export class OrganizationController {
  constructor(
    @inject(OrganizationService) private readonly service: OrganizationService
  ) {}

  async create(req: Request, res: Response): Promise<void> {
    const result = await this.service.create(req.userId!, req.body);
    res.status(201).json(success(result));
  }

  async list(req: Request, res: Response): Promise<void> {
    const { page, limit } = organizationPaginationSchema.parse(req.query);
    const result = await this.service.findByUserId(req.userId!, page, limit);
    res.json(success(result));
  }

  async get(req: Request, res: Response): Promise<void> {
    const { id: orgId } = req.validatedParams!;
    const result = await this.service.findById(orgId, req.userId!);
    res.json(success(result));
  }

  async update(req: Request, res: Response): Promise<void> {
    const { id: orgId } = req.validatedParams!;
    const result = await this.service.updateName(orgId, req.userId!, req.body);
    res.json(success(result));
  }

  async delete(req: Request, res: Response): Promise<void> {
    const { id: orgId } = req.validatedParams!;
    await this.service.delete(orgId, req.userId!);
    res.status(204).send();
  }

  async inviteMember(req: Request, res: Response): Promise<void> {
    const { id: orgId } = req.validatedParams!;
    const result = await this.service.inviteMember(orgId, req.userId!, req.body);
    res.status(201).json(success(result));
  }

  async getInvitations(req: Request, res: Response): Promise<void> {
    const { id: orgId } = req.validatedParams!;
    const result = await this.service.getInvitations(orgId, req.userId!);
    res.json(success(result));
  }

  async cancelInvitation(req: Request, res: Response): Promise<void> {
    const { id: orgId, invId } = req.validatedParams!;
    await this.service.cancelInvitation(orgId, invId, req.userId!);
    res.status(204).send();
  }

  async getMyInvitations(req: Request, res: Response): Promise<void> {
    const result = await this.service.getMyInvitations(req.userId!);
    res.json(success(result));
  }

  async acceptInvitation(req: Request, res: Response): Promise<void> {
    const { invId } = req.validatedParams!;
    const result = await this.service.acceptInvitation(invId, req.userId!);
    res.json(success(result));
  }

  async declineInvitation(req: Request, res: Response): Promise<void> {
    const { invId } = req.validatedParams!;
    await this.service.declineInvitation(invId, req.userId!);
    res.status(204).send();
  }
}