export const responseInterceptor = (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = function (data) {
    // Nếu đã là response chuẩn (có success field) → không wrap lại
    if (data && typeof data === 'object' && 'success' in data) {
      // Tự động set HTTP status code khi service trả về lỗi
      if (data.success === false && data.statusCode) {
        res.statusCode = data.statusCode;
      }
      data.timestamp = new Date().toISOString();
      return originalJson(data);
    }

    // Auto wrap raw data từ service
    const wrapped = {
      success: res.statusCode < 400,
      statusCode: res.statusCode,
    };

    // Nếu data có pagination → tách ra
    if (data && typeof data === 'object' && data.pagination) {
      wrapped.data = data.data;
      wrapped.pagination = data.pagination;
      // Copy extra fields (unreadCount, count, etc.)
      for (const key of Object.keys(data)) {
        if (key !== 'data' && key !== 'pagination') {
          wrapped[key] = data[key];
        }
      }
    } else {
      wrapped.data = data;
    }

    wrapped.timestamp = new Date().toISOString();

    return originalJson(wrapped);
  };

  next();
};

export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational || false;

  if (!isOperational) {
    console.error('❌ Error:', {
      message: err.message,
      path: req.path,
      method: req.method,
      stack: err.stack,
    });
  }

  const response = {
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

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    statusCode: 404,
    message: 'Route not found',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
};
