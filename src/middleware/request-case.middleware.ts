import { camelizeObjectKeys } from '@utils/case';

export const normalizeRequestBodyCase = (req, _res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = camelizeObjectKeys(req.body);
  }

  next();
};
