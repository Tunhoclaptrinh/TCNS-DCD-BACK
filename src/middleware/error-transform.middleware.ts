import mongoose from 'mongoose';
import type { AnyRecord } from '@app-types/common';
import ApiError from '@utils/api-error';

export type NormalizedError = {
  statusCode: number;
  message: string;
  errors?: unknown;
  type: string;
};

function isRecord(value: unknown): value is AnyRecord {
  return value !== null && typeof value === 'object';
}

function toFieldLabel(field: string) {
  return String(field)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-.]/g, ' ')
    .trim();
}

function buildValidationFieldErrors(error: mongoose.Error.ValidationError) {
  return Object.values(error.errors).map((item: any) => ({
    field: item.path,
    message: item.message || `Giá trị không hợp lệ cho trường ${item.path}`,
  }));
}

function buildDuplicateKeyMessage(error: AnyRecord) {
  const keyValue = isRecord(error.keyValue) ? error.keyValue : {};
  const keyPattern = isRecord(error.keyPattern) ? error.keyPattern : {};

  const [fieldFromValue, value] = Object.entries(keyValue)[0] || [];
  const [fieldFromPattern] = Object.keys(keyPattern);
  const field = String(fieldFromValue || fieldFromPattern || 'không xác định');

  if (value !== undefined) {
    return {
      message: `Trường "${toFieldLabel(field)}" với giá trị '${String(value)}' đã tồn tại. Vui lòng sử dụng giá trị khác.`,
      errors: [{ field, message: 'Giá trị đã tồn tại' }],
    };
  }

  return {
    message: `Giá trị của trường "${toFieldLabel(field)}" đã tồn tại.`,
    errors: [{ field, message: 'Giá trị đã tồn tại' }],
  };
}

function isMongoDuplicateKeyError(error: AnyRecord) {
  return error.name === 'MongoServerError' && Number(error.code) === 11000;
}

function isMongoConnectivityError(error: AnyRecord) {
  const name = String(error.name || '');
  return (
    name === 'MongoNetworkError' ||
    name === 'MongoServerSelectionError' ||
    name === 'MongooseServerSelectionError' ||
    name === 'MongoTimeoutError'
  );
}

function isBodyParseError(error: AnyRecord) {
  const syntaxError = error as SyntaxError & { status?: number; body?: unknown };
  return syntaxError instanceof SyntaxError && syntaxError.status === 400 && 'body' in syntaxError;
}

function isMulterError(error: AnyRecord) {
  return error.name === 'MulterError';
}

function mapMulterMessage(code: unknown) {
  const normalized = String(code || '');
  if (normalized === 'LIMIT_FILE_SIZE') return 'Kích thước tệp vượt giới hạn cho phép';
  if (normalized === 'LIMIT_FILE_COUNT') return 'Số lượng tệp vượt giới hạn cho phép';
  if (normalized === 'LIMIT_UNEXPECTED_FILE') return 'Trường tệp tải lên không hợp lệ';
  return 'Tải lên tệp thất bại';
}

function isJwtError(error: AnyRecord) {
  const name = String(error.name || '');
  return name === 'JsonWebTokenError' || name === 'TokenExpiredError' || name === 'NotBeforeError';
}

export function transformError(error: unknown): NormalizedError {
  if (error instanceof ApiError) {
    return {
      statusCode: error.statusCode,
      message: error.message,
      errors: error.errors,
      type: error.name,
    };
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return {
      statusCode: 400,
      message: 'Dữ liệu không hợp lệ',
      errors: buildValidationFieldErrors(error),
      type: error.name,
    };
  }

  if (error instanceof mongoose.Error.CastError) {
    const field = error.path || 'id';
    return {
      statusCode: 400,
      message: `Giá trị '${String(error.value)}' không hợp lệ cho trường '${toFieldLabel(field)}'`,
      errors: [{ field, message: error.message }],
      type: error.name,
    };
  }

  if (isRecord(error)) {
    if (isMongoDuplicateKeyError(error)) {
      const duplicate = buildDuplicateKeyMessage(error);
      return {
        statusCode: 409,
        message: duplicate.message,
        errors: duplicate.errors,
        type: String(error.name || 'MongoServerError'),
      };
    }

    if (isMongoConnectivityError(error)) {
      return {
        statusCode: 503,
        message: 'Dịch vụ cơ sở dữ liệu tạm thời không khả dụng',
        type: String(error.name || 'MongoConnectionError'),
      };
    }

    if (isBodyParseError(error)) {
      return {
        statusCode: 400,
        message: 'Nội dung JSON không hợp lệ',
        type: 'SyntaxError',
      };
    }

    if (isMulterError(error)) {
      return {
        statusCode: 400,
        message: mapMulterMessage(error.code),
        type: String(error.name || 'MulterError'),
      };
    }

    if (isJwtError(error)) {
      return {
        statusCode: 401,
        message: 'Token không hợp lệ hoặc đã hết hạn',
        type: String(error.name || 'JsonWebTokenError'),
      };
    }

    if (typeof error.statusCode === 'number') {
      return {
        statusCode: error.statusCode,
        message: typeof error.message === 'string' ? error.message : 'Yêu cầu không thành công',
        errors: error.errors,
        type: String(error.name || 'Error'),
      };
    }
  }

  if (error instanceof Error) {
    return {
      statusCode: 500,
      message: 'Internal Server Error',
      type: error.name,
    };
  }

  return {
    statusCode: 500,
    message: 'Internal Server Error',
    type: 'UnknownError',
  };
}
