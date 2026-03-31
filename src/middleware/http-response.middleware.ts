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
  return {
    ...payload,
    timestamp: new Date().toISOString(),
  };
}

function buildWrappedResponse(res: Response, responseBody: unknown) {
  const wrapped: AnyRecord = {
    success: res.statusCode < 400,
    statusCode: res.statusCode,
  };

  if (hasPaginationPayload(responseBody)) {
    wrapped.data = responseBody.data;
    wrapped.pagination = responseBody.pagination;

    for (const key of Object.keys(responseBody)) {
      if (key !== 'data' && key !== 'pagination') {
        wrapped[key] = responseBody[key];
      }
    }
  } else {
    wrapped.data = responseBody;
  }

  return addTimestamp(wrapped);
}

function logUnexpectedError(error: ErrorLike, req: Request) {
  console.error('[ERROR]', {
    message: error.message,
    path: req.path,
    method: req.method,
    stack: error.stack,
  });
}

export const wrapJson = (_req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json.bind(res);

  res.json = function jsonWithEnvelope(responseBody: unknown) {
    if (isResponseEnvelope(responseBody)) {
      if (responseBody.success === false && responseBody.statusCode) {
        res.statusCode = responseBody.statusCode;
      }

      return originalJson(addTimestamp(responseBody));
    }

    return originalJson(buildWrappedResponse(res, responseBody));
  };

  next();
};

export const handleError = (error: ErrorLike, req: Request, res: Response, _next: NextFunction) => {
  const statusCode = error.statusCode || 500;
  const isOperationalError = error.isOperational || false;

  if (!isOperationalError) {
    logUnexpectedError(error, req);
  }

  const response: AnyRecord = {
    success: false,
    statusCode,
    message: isOperationalError ? error.message : 'Internal Server Error',
  };

  if (error.errors) response.errors = error.errors;
  if (process.env.NODE_ENV === 'development' && !isOperationalError) {
    response.error = { type: error.name, stack: error.stack };
  }

  res.status(statusCode).json(addTimestamp(response));
};

export const notFound = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    statusCode: 404,
    message: 'Route not found',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
};
