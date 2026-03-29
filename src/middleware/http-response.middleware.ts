import type { NextFunction, Request, Response } from 'express';
import type { AnyRecord } from '@app-types/common';

function buildWrappedJsonResponse(res: Response, data: any) {
  const wrapped: AnyRecord = {
    success: res.statusCode < 400,
    statusCode: res.statusCode,
  };

  if (data && typeof data === 'object' && data.pagination) {
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

  wrapped.timestamp = new Date().toISOString();
  return wrapped;
}

function logUnexpectedError(err: any, req: Request) {
  console.error('[ERROR]', {
    message: err.message,
    path: req.path,
    method: req.method,
    stack: err.stack,
  });
}

export const wrapJsonResponse = (_req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json.bind(res);

  res.json = function (data: any) {
    if (data && typeof data === 'object' && 'success' in data) {
      if (data.success === false && data.statusCode) {
        res.statusCode = data.statusCode;
      }
      data.timestamp = new Date().toISOString();
      return originalJson(data);
    }

    return originalJson(buildWrappedJsonResponse(res, data));
  };

  next();
};

export const errorHandler = (err: any, req: Request, res: Response, _next: NextFunction) => {
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

  response.timestamp = new Date().toISOString();

  res.status(statusCode).json(response);
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
