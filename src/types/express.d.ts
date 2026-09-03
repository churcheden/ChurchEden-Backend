export {};

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        accountType: 'ADMIN' | 'MEMBER';
        adminId?: string;
      };
    }
  }
}
