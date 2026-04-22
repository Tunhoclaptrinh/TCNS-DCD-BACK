import type { NextFunction, Request, Response } from 'express';
import { colorizeMethod, colorizeStatus, logger } from '../utils/logger';

const SENSITIVE_FIELDS = ['password', 'token', 'refreshToken', 'accessToken', 'secret'];
const MAX_PAYLOAD_LOG_LENGTH = 2000;

function redactSensitiveFields(payload: unknown) {
  if (!payload || typeof payload !== 'object' || payload === null) return payload;

  const redactedPayload = { ...(payload as object) } as any;
  for (const key of SENSITIVE_FIELDS) {
    if (key in redactedPayload) redactedPayload[key] = '***';
  }

  return redactedPayload;
}

function truncatePayload(payload: any) {
  const str = typeof payload === 'string' ? payload : JSON.stringify(payload);
  if (str.length > MAX_PAYLOAD_LOG_LENGTH) {
    return `${str.slice(0, MAX_PAYLOAD_LOG_LENGTH)}... (truncated)`;
  }
  return payload;
}

function getClientIp(req: Request) {
  return (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
}

// Ghi log request/response chi tiết với payload được trình bày nhiều dòng (pretty-print).
export default function logRequest(req: Request, res: Response, next: NextFunction) {
  const requestStartedAt = Date.now();
  const isDebug = (process.env.LOG_LEVEL || 'info').toLowerCase() === 'debug';

  // Chặn để lấy response body
  let responseBody: any = null;
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    responseBody = body;
    return originalJson(body);
  };

  res.on('finish', () => {
    const durationMs = Date.now() - requestStartedAt;
    const durationStr = durationMs > 1000 ? `${(durationMs / 1000).toFixed(2)}s` : `${durationMs}ms`;
    const ip = getClientIp(req);
    const method = colorizeMethod(req.method);
    const url = req.originalUrl;
    const status = colorizeStatus(res.statusCode);

    // 1. Log dòng trạng thái chính
    logger.http(`${status} ${method} ${url} ${durationStr} - IP: ${ip}`);

    // 2. Nếu ở chế độ debug, log thêm payload chi tiết
    if (isDebug) {
      // Log Query if exists
      if (Object.keys(req.query).length > 0) {
        logger.debug('QUERY PARAMS:', 'HTTP', req.query);
      }

      // Log Request Body if exists
      if (req.body && Object.keys(req.body).length > 0) {
        logger.debug('REQUEST PAYLOAD:', 'HTTP', truncatePayload(redactSensitiveFields(req.body)));
      }

      // Log Response Body if exists
      if (responseBody) {
        logger.debug('RESPONSE PAYLOAD:', 'HTTP', truncatePayload(responseBody));
      }
    }
  });

  next();
}
