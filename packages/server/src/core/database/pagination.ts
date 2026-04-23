import { z } from 'zod';
import { PAGINATION_LIMITS } from './constants.js';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
});

export const projectPaginationSchema = paginationSchema.extend({
  limit: z.coerce.number().int().min(1).max(PAGINATION_LIMITS.projects.max).default(PAGINATION_LIMITS.projects.default),
  organizationId: z.coerce.number().int().positive().optional(),
});

export const organizationPaginationSchema = paginationSchema.extend({
  limit: z.coerce.number().int().min(1).max(PAGINATION_LIMITS.organizations.max).default(PAGINATION_LIMITS.organizations.default),
});

export const draftPaginationSchema = paginationSchema.extend({
  limit: z.coerce.number().int().min(1).max(PAGINATION_LIMITS.drafts.max).default(PAGINATION_LIMITS.drafts.default),
});

export const buildPaginationSchema = paginationSchema.extend({
  limit: z.coerce.number().int().min(1).max(PAGINATION_LIMITS.builds.max).default(PAGINATION_LIMITS.builds.default),
});

export const messagePaginationSchema = paginationSchema.extend({
  limit: z.coerce.number().int().min(1).max(PAGINATION_LIMITS.messages.max).default(PAGINATION_LIMITS.messages.default),
});

export type PaginationInput = z.infer<typeof paginationSchema>;
export type ProjectPaginationInput = z.infer<typeof projectPaginationSchema>;
export type OrganizationPaginationInput = z.infer<typeof organizationPaginationSchema>;
export type DraftPaginationInput = z.infer<typeof draftPaginationSchema>;
export type BuildPaginationInput = z.infer<typeof buildPaginationSchema>;
export type MessagePaginationInput = z.infer<typeof messagePaginationSchema>;

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function computeOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

export function computeTotalPages(total: number, limit: number): number {
  return Math.ceil(total / limit);
}

export function paginate<T>(data: T[], total: number, page: number, limit: number): PaginatedResult<T> {
  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: computeTotalPages(total, limit),
    },
  };
}