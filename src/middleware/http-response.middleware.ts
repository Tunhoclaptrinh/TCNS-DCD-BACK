import type { NextFunction, Request, Response } from 'express';
import type { AnyRecord } from '@app-types/common';
import { logger } from '../utils/logger';
import { transformError } from './error-transform.middleware';

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
  const wrappedResponse: AnyRecord = {
    success: res.statusCode < 400,
    statusCode: res.statusCode,
  };

  if (hasPaginationPayload(responseBody)) {
    wrappedResponse.data = responseBody.data;
    wrappedResponse.pagination = responseBody.pagination;

    for (const key of Object.keys(responseBody)) {
      if (key !== 'data' && key !== 'pagination') {
        wrappedResponse[key] = responseBody[key];
      }
    }
  } else {
    wrappedResponse.data = responseBody;
  }

  return addTimestamp(wrappedResponse);
}

function logUnexpectedError(error: ErrorLike, req: Request) {
  logger.error(`${req.method} ${req.path} failed: ${error.message}`, 'HTTP', error);
}

// Bọc mọi `res.json()` theo format chuẩn `{ success, data, ... }` của API.
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

// Chuẩn hóa response lỗi và chỉ log stack với lỗi không chủ đích.
export const handleError = (error: ErrorLike, req: Request, res: Response, _next: NextFunction) => {
  const normalizedError = transformError(error);
  const statusCode = normalizedError.statusCode;
  const isOperationalError = normalizedError.isOperational;

  if (!isOperationalError) {
    logUnexpectedError(error, req);
  }

  const response: AnyRecord = {
    success: false,
    statusCode,
    message: isOperationalError ? normalizedError.message : 'Internal Server Error',
  };

  if (normalizedError.errors) response.errors = normalizedError.errors;
  if (process.env.NODE_ENV === 'development' && !isOperationalError) {
    response.error = { type: normalizedError.type, stack: error.stack };
  }

  res.status(statusCode).json(addTimestamp(response));
};

// Trả về 404 thống nhất khi không route nào match request hiện tại.
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
