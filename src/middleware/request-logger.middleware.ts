import type { NextFunction, Request, Response } from 'express';

const SENSITIVE_FIELDS = ['password', 'token', 'refreshToken', 'accessToken'];
const MAX_BODY_LOG_LENGTH = 500;

function redactSensitiveFields(payload: unknown) {
  if (!payload || typeof payload !== 'object') return payload;

  const redactedPayload = { ...payload };
  for (const key of SENSITIVE_FIELDS) {
    if (key in redactedPayload) redactedPayload[key] = '***';
  }

  return redactedPayload;
}

function truncateLoggedPayload(payload: unknown) {
  const serializedPayload = typeof payload === 'string' ? payload : JSON.stringify(payload);
  if (!serializedPayload || serializedPayload.length <= MAX_BODY_LOG_LENGTH) {
    return payload;
  }

  return serializedPayload.slice(0, MAX_BODY_LOG_LENGTH) + `... (${serializedPayload.length} chars)`;
}

function shouldLogDetails() {
  return (process.env.NODE_ENV || 'development') !== 'production';
}

// Ghi log request/response cơ bản và ẩn các field nhạy cảm trong body.
export default function logRequest(req: Request, res: Response, next: NextFunction) {
  const requestStartedAt = Date.now();
  const verbose = shouldLogDetails();

  console.log(`[HTTP] ${req.method} ${req.originalUrl}`);

  if (verbose && Object.keys(req.query).length > 0) {
    console.log('[HTTP] Query:', req.query);
  }

  if (verbose && req.body && Object.keys(req.body).length > 0) {
    console.log('[HTTP] Body:', truncateLoggedPayload(redactSensitiveFields(req.body)));
  }

  res.on('finish', () => {
    const durationMs = Date.now() - requestStartedAt;
    console.log(`[HTTP] ${res.statusCode} ${req.method} ${req.originalUrl} ${durationMs}ms`);
  });

  next();
}
