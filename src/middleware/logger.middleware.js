const SENSITIVE_FIELDS = ['password', 'token', 'refreshToken', 'accessToken'];
const MAX_BODY_LOG_LENGTH = 500;

function sanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const clean = { ...obj };
  for (const key of SENSITIVE_FIELDS) {
    if (key in clean) clean[key] = '***';
  }
  return clean;
}

function truncate(data) {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  if (!str || str.length <= MAX_BODY_LOG_LENGTH) return data;
  return str.slice(0, MAX_BODY_LOG_LENGTH) + `... (${str.length} chars)`;
}

function statusIcon(code) {
  if (code < 300) return '✅';
  if (code < 400) return '🔀';
  if (code < 500) return '⚠️';
  return '❌';
}

export default function apiLogger(req, res, next) {
  const start = Date.now();

  // Log request
  console.log(`\n📥 ${req.method} ${req.originalUrl}`);
  if (Object.keys(req.query).length) console.log('   Query:', req.query);
  if (req.body && Object.keys(req.body).length) console.log('   Body:', sanitize(req.body));

  // Capture JSON response
  let isJsonLogged = false;
  const oldJson = res.json;
  res.json = function (data) {
    isJsonLogged = true;
    const time = Date.now() - start;
    const icon = statusIcon(res.statusCode);

    console.log(`${icon} ${res.statusCode} ← ${req.method} ${req.originalUrl} (${time}ms)`);
    if (process.env.NODE_ENV !== 'production') {
      console.log('   Response:', truncate(data));
    }

    return oldJson.call(this, data);
  };

  // Fallback for non-json responses (file download, redirect, etc.)
  res.on('finish', () => {
    if (isJsonLogged) return;
    const time = Date.now() - start;
    const icon = statusIcon(res.statusCode);
    console.log(`${icon} ${res.statusCode} ← ${req.method} ${req.originalUrl} (${time}ms)`);
  });

  next();
}
