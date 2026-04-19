declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      userId?: number;
      orgRole?: 'owner' | 'developer' | 'member';
    }
  }
}

export {};
