import { Request, Response, NextFunction } from 'express';

/** 管理者ユーザーのみ通過を許可するミドルウェア */
export function adminMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.username !== process.env.ADMIN_USERNAME) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
}
