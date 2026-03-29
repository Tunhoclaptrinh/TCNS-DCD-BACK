import type { NextFunction, Request, Response } from 'express';
import type { AnyRecord } from '@app-types/common';

type ResponseEnvelope = AnyRecord & {
  success: boolean;
  statusCode?: number;
  timestamp?: string;
};
type PaginationPayload = AnyRecord & {
  data?: unknown;
  pagination: unknown;
};
type ErrorLike = Error & {
  statusCode?: number;
  isOperational?: boolean;
  errors?: unknown;
};

function isRecord(value: unknown): value is AnyRecord {
  return value !== null && typeof value === 'object';
}

function isResponseEnvelope(value: unknown): value is ResponseEnvelope {
  return isRecord(value) && 'success' in value;
}

function hasPaginationPayload(value: unknown): value is PaginationPayload {
  return isRecord(value) && 'pagination' in value;
}

function addTimestamp<T extends AnyRecord & { timestamp?: string }>(payload: T) {
  payload.timestamp = new Date().toISOString();
  return payload;
}

function buildWrappedJsonResponse(res: Response, data: unknown) {
  const wrapped: AnyRecord = {
    success: res.statusCode < 400,
    statusCode: res.statusCode,
  };

  if (hasPaginationPayload(data)) {
    wrapped.data = data.data;
    wrapped.pagination = data.pagination;

    for (const key of Object.keys(data)) {
      if (key !== 'data' && key !== 'pagination') {
        wrapped[key] = data[key];
      }
    }
  } else {
    wrapped.data = data;
  }

  return addTimestamp(wrapped);
}

function logUnexpectedError(err: ErrorLike, req: Request) {
  console.error('[ERROR]', {
    message: err.message,
    path: req.path,
    method: req.method,
    stack: err.stack,
  });
}

export const wrapJsonResponse = (_req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json.bind(res);

  res.json = function (data: unknown) {
    if (isResponseEnvelope(data)) {
      if (data.success === false && data.statusCode) {
        res.statusCode = data.statusCode;
      }
      return originalJson(addTimestamp(data));
    }

    return originalJson(buildWrappedJsonResponse(res, data));
  };

  next();
};

export const errorHandler = (err: ErrorLike, req: Request, res: Response, _next: NextFunction) => {
  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational || false;

  if (!isOperational) {
    logUnexpectedError(err, req);
  }

  const response: AnyRecord = {
    success: false,
    statusCode,
    message: isOperational ? err.message : 'Internal Server Error',
  };

  if (err.errors) response.errors = err.errors;
  if (process.env.NODE_ENV === 'development' && !isOperational) {
    response.error = { type: err.name, stack: err.stack };
  }

  res.status(statusCode).json(addTimestamp(response));
};

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    statusCode: 404,
    message: 'Route not found',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
};
