import type { NextFunction, Request, Response } from 'express';

// Đồng bộ `newPassword` về `password` để các flow cũ và mới dùng chung phía sau.
export const mapNewPassword = (req: Request, _res: Response, next: NextFunction) => {
  if (typeof req.body?.newPassword === 'string' && !req.body.password) {
    req.body.password = req.body.newPassword;
  }

  next();
};
