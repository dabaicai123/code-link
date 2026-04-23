export const PAGINATION_LIMITS = {
  projects: { default: 50, max: 100 },
  organizations: { default: 50, max: 100 },
  builds: { default: 20, max: 50 },
  messages: { default: 100, max: 200 },
  drafts: { default: 20, max: 50 },
  repos: { default: 10, max: 20 },
} as const;
