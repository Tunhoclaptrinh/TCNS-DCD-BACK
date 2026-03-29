import type { NextFunction, Request, Response } from 'express';
import { camelizeObjectKeys } from '@utils/case';

export const normalizeRequestBodyKeys = (req: Request, _res: Response, next: NextFunction) => {
  req.body = camelizeObjectKeys(req.body);
  next();
};
