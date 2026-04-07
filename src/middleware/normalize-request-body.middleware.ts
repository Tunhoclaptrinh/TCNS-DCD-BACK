import type { NextFunction, Request, Response } from 'express';
import { camelizeObjectKeys } from '@utils/case';

const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Chuẩn hóa key trong body về camelCase trước khi đi tiếp vào controller/service.
export const camelizeBody = (req: Request, _res: Response, next: NextFunction) => {
  if (!BODY_METHODS.has(req.method) || req.body == null) {
    return next();
  }

  req.body = camelizeObjectKeys(req.body);
  next();
};
