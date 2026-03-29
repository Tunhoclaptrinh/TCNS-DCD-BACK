const SENSITIVE_FIELDS = ['password', 'token', 'refreshToken', 'accessToken'];
const MAX_BODY_LOG_LENGTH = 500;

function maskSensitiveFields(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const clean = { ...payload };
  for (const key of SENSITIVE_FIELDS) {
    if (key in clean) clean[key] = '***';
  }
  return clean;
}

function truncateForLog(data) {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  if (!str || str.length <= MAX_BODY_LOG_LENGTH) return data;
  return str.slice(0, MAX_BODY_LOG_LENGTH) + `... (${str.length} chars)`;
}

function shouldLogDetails() {
  return (process.env.NODE_ENV || 'development') !== 'production';
}

export default function requestLogger(req, res, next) {
  const start = Date.now();

  console.log(`[HTTP] ${req.method} ${req.originalUrl}`);

  if (shouldLogDetails() && Object.keys(req.query || {}).length > 0) {
    console.log('[HTTP] Query:', req.query);
  }

  if (shouldLogDetails() && req.body && Object.keys(req.body).length > 0) {
    console.log('[HTTP] Body:', truncateForLog(maskSensitiveFields(req.body)));
  }

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    console.log(`[HTTP] ${res.statusCode} ${req.method} ${req.originalUrl} ${durationMs}ms`);
  });

  next();
}
