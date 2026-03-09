import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import path from 'path';
import schemas from '@schemas';

// ==================== Helpers ====================

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

const TYPE_MAP = {
  string: { type: 'string' },
  number: { type: 'number' },
  boolean: { type: 'boolean' },
  email: { type: 'string', format: 'email' },
  date: { type: 'string', format: 'date-time' },
  enum: (rule) => ({ type: 'string', enum: rule.enum }),
};

function ruleToProperty(rule) {
  const base = TYPE_MAP[rule.type];
  const prop = {
    description: rule.description || '',
    ...(typeof base === 'function' ? base(rule) : base || { type: 'string' }),
  };

  if (rule.minLength !== undefined) prop.minLength = rule.minLength;
  if (rule.maxLength !== undefined) prop.maxLength = rule.maxLength;
  if (rule.min !== undefined) prop.minimum = rule.min;
  if (rule.max !== undefined) prop.maximum = rule.max;
  if (rule.default !== undefined) prop.default = rule.default;

  return prop;
}

// ==================== JSDoc Parser ====================

function parseJSDocFromController(controllerPath, methodName) {
  try {
    if (!fs.existsSync(controllerPath)) return null;

    const content = fs.readFileSync(controllerPath, 'utf-8');
    const jsdocBlockRegex = /\/\*\*([\s\S]*?)\*\//g;
    let jsdocMatch;

    while ((jsdocMatch = jsdocBlockRegex.exec(content)) !== null) {
      const afterJsdoc = content.substring(jsdocMatch.index + jsdocMatch[0].length).trimStart();

      if (
        afterJsdoc.startsWith(`exports.${methodName}`) ||
        (/^(\w+)\s*=/.test(afterJsdoc) && afterJsdoc.startsWith(`${methodName} `)) ||
        afterJsdoc.startsWith(`${methodName}=`)
      ) {
        return parseJSDocContent(jsdocMatch[1]);
      }
    }

    return null;
  } catch (err) {
    console.error(`Error parsing JSDoc for ${methodName}:`, err.message);
    return null;
  }
}

function parseJSDocContent(raw) {
  const result = { summary: '', tags: [], security: [], requestBody: null, responses: {} };
  const lines = raw.split('\n').map((l) => l.trim().replace(/^\*\s?/, ''));
  let foundSummary = false;

  for (const line of lines) {
    if (line.startsWith('@swagger.summary')) {
      result.summary = line.replace('@swagger.summary', '').trim();
      foundSummary = true;
    } else if (line.startsWith('@swagger.tag')) {
      result.tags.push(line.replace('@swagger.tag', '').trim());
    } else if (line.startsWith('@swagger.security')) {
      result.security.push({ bearerAuth: [] });
    } else if (line.startsWith('@swagger.body')) {
      const bodyType = line.replace('@swagger.body', '').trim();
      result.requestBody = {
        required: true,
        content: { 'application/json': { schema: { $ref: `#/components/schemas/${bodyType}` } } },
      };
    } else if (line.startsWith('@swagger.response')) {
      const parts = line.replace('@swagger.response', '').trim().split(' ');
      result.responses[parts[0]] = { description: parts.slice(1).join(' ') };
    } else if (!line.startsWith('@') && line && !foundSummary && line.length > 3) {
      result.summary = line;
      foundSummary = true;
    }
  }

  return result;
}

// ==================== Route Scanner ====================

function getMountPaths(routesDir) {
  const indexPath = path.join(routesDir, 'index.js');
  if (!fs.existsSync(indexPath)) return {};

  const content = fs.readFileSync(indexPath, 'utf-8');
  const mountMap = {};

  // Parse import: import varName from './xxx.routes'
  const importMap = {};
  const importRegex = /import\s+(\w+)\s+from\s+['"`]\.\/([^'"`]+)['"`]/g;
  let importMatch;
  while ((importMatch = importRegex.exec(content)) !== null) {
    const varName = importMatch[1];
    const fileName = importMatch[2].replace('.routes', '').replace('./', '');
    importMap[varName] = fileName;
  }

  // Parse router.use('/path', varName)
  const useRegex = /router\.use\s*\(\s*['"`]\/([^'"`]+)['"`]\s*,\s*(\w+)\s*\)/g;
  let useMatch;
  while ((useMatch = useRegex.exec(content)) !== null) {
    const mountPath = useMatch[1];
    const varName = useMatch[2];
    const fileName = importMap[varName];
    if (fileName) mountMap[fileName] = mountPath;
  }

  // Fallback: require() syntax
  const requireRegex = /router\.use\s*\(\s*['"`]\/([^'"`]+)['"`]\s*,\s*require\s*\(\s*['"`]\.\/([^'"`]+)['"`]\s*\)/g;
  let reqMatch;
  while ((reqMatch = requireRegex.exec(content)) !== null) {
    mountMap[reqMatch[2].replace('.routes', '').replace('./', '')] = reqMatch[1];
  }

  return mountMap;
}

function detectGlobalMiddleware(content) {
  const result = {
    hasGlobalProtect: false,
    globalProtectLine: -1,
    hasGlobalAuthorize: false,
    globalAuthorizeLine: -1,
    globalAuthorizeRole: null,
  };
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (/router\.use\s*\(\s*protect\s*\)/.test(line)) {
      result.hasGlobalProtect = true;
      result.globalProtectLine = i;
    }

    const authMatch = line.match(/router\.use\s*\(\s*authorize\s*\(\s*['"`](\w+)['"`]\s*\)\s*\)/);
    if (authMatch) {
      result.hasGlobalAuthorize = true;
      result.globalAuthorizeLine = i;
      result.globalAuthorizeRole = authMatch[1];
    }
  }

  return result;
}

const MIDDLEWARE_PATTERNS = [
  { key: 'hasProtect', regex: /\bprotect\b/ },
  { key: 'hasAuthorize', regex: /authorize\s*\(\s*['"`](\w+)['"`]\s*\)/, capture: 'authorizeRole' },
  { key: 'hasCheckPermission', regex: /checkPermission\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/, capture: 'permission' },
  { key: 'hasValidateSchema', regex: /validateSchema\s*\(\s*['"`](\w+)['"`]\s*\)/, capture: 'schemaName' },
  { key: 'hasUploadMiddleware', regex: /getUploadMiddleware/ },
];

function detectRouteMiddleware(routeText) {
  const mw = {};

  for (const { key, regex, capture } of MIDDLEWARE_PATTERNS) {
    const match = routeText.match(regex);
    mw[key] = !!match;
    if (capture && match) mw[capture] = match[1];
  }

  // validateFields — more complex
  const fieldsMatch = routeText.match(/validateFields\s*\(\s*['"`](\w+)['"`]\s*,\s*\[([^\]]+)\]/);
  if (fieldsMatch) {
    mw.hasValidateFields = true;
    mw.validateFieldsSchema = fieldsMatch[1];
    mw.validateFieldNames = fieldsMatch[2]
      .split(',')
      .map((f) => f.trim().replace(/['"`]/g, ''))
      .filter(Boolean);
  }

  return mw;
}

function scanRoutes(routesDir = path.join(__dirname, '../routes')) {
  const paths = {};
  const mountMap = getMountPaths(routesDir);
  const routeFiles = fs.readdirSync(routesDir).filter((f) => f.endsWith('.routes.js'));

  for (const file of routeFiles) {
    const content = fs.readFileSync(path.join(routesDir, file), 'utf-8');
    const baseName = file.replace('.routes.js', '');
    Object.assign(paths, parseRoutesFromFile(content, mountMap[baseName] || baseName));
  }

  return paths;
}

function parseRoutesFromFile(content, basePath) {
  const paths = {};
  const cleanContent = content.replace(/^\s*\/\/.*$/gm, '');
  const globalMw = detectGlobalMiddleware(cleanContent);

  const routeRegex =
    /router\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]([\s\S]*?(\w+Controller)\.([\w]+))/g;
  let match;

  while ((match = routeRegex.exec(cleanContent)) !== null) {
    const [, method, routePath, routeText, controllerName, methodName] = match;
    const routeLineIndex = cleanContent.substring(0, match.index).split('\n').length - 1;
    const fullPath = routePath === '/' ? `/${basePath}` : `/${basePath}${routePath}`;
    const openApiPath = fullPath.replace(/:(\w+)/g, '{$1}');

    const routeMw = detectRouteMiddleware(routeText);
    const isProtected =
      routeMw.hasProtect || (globalMw.hasGlobalProtect && routeLineIndex > globalMw.globalProtectLine);
    const isAdminOnly =
      routeMw.hasAuthorize || (globalMw.hasGlobalAuthorize && routeLineIndex > globalMw.globalAuthorizeLine);

    const controllerFile = controllerName.replace(/Controller$/, '') + '.controller.js';
    const jsdoc = parseJSDocFromController(path.join(__dirname, '../controllers', controllerFile), methodName);

    if (!paths[openApiPath]) paths[openApiPath] = {};
    paths[openApiPath][method] = buildOperation({
      method,
      routePath,
      basePath,
      jsdoc,
      isProtected,
      isAdminOnly,
      adminRole: routeMw.authorizeRole || globalMw.globalAuthorizeRole,
      routeMw,
    });
  }

  return paths;
}

// ==================== Operation Builder ====================

const SUMMARY_MAP = [
  [/^\/$/, 'get', (e) => `Danh sách ${e}`],
  [/^\/$/, 'post', (e) => `Tạo ${e}`],
  [/^\/$/, 'delete', (e) => `Xoá tất cả ${e}`],
  [/^\/:id$/, 'get', (e) => `Chi tiết ${e}`],
  [/^\/:id$/, 'put', (e) => `Cập nhật ${e}`],
  [/^\/:id$/, 'delete', (e) => `Xoá ${e}`],
  [/^\/:id\/status$/, 'patch', (e) => `Cập nhật trạng thái ${e}`],
  [/^\/:id\/permanent$/, 'delete', (e) => `Xoá vĩnh viễn ${e}`],
  [/^\/:id\/activity$/, 'get', (e) => `Lịch sử hoạt động ${e}`],
  [/^\/:id\/read$/, 'patch', () => 'Đánh dấu đã đọc'],
  [/^\/read-all$/, 'patch', () => 'Đánh dấu tất cả đã đọc'],
  [/^\/profile$/, 'put', () => 'Cập nhật profile'],
  [/^\/schema$/, 'get', (e) => `Xem schema ${e}`],
  [/^\/template$/, 'get', (e) => `Tải template import ${e}`],
  [/^\/import$/, 'post', (e) => `Import ${e} từ file`],
  [/^\/export$/, 'get', (e) => `Export ${e}`],
  [/^\/stats/, 'get', (e) => `Thống kê ${e}`],
  [/^\/cleanup$/, 'post', (e) => `Dọn dẹp ${e}`],
  [/^\/me$/, 'get', () => 'Thông tin tài khoản hiện tại'],
];

function generateSmartSummary(method, routePath, basePath) {
  const entity = capitalize(basePath);
  for (const [pattern, m, fn] of SUMMARY_MAP) {
    if (pattern.test(routePath) && m === method) return fn(entity);
  }
  return `${method.toUpperCase()} ${routePath}`;
}

function resolveSchemaRef(schemaKey) {
  if (schemas[schemaKey]) return capitalize(schemaKey);
  if (schemas[schemaKey + 's']) return capitalize(schemaKey + 's');
  return null;
}

function buildFieldsSubsetSchema(schemaKey, fieldNames) {
  const schema = schemas[schemaKey.endsWith('s') ? schemaKey : schemaKey + 's'] || schemas[schemaKey];
  if (!schema) return null;

  const properties = {};
  const required = [];

  for (const name of fieldNames) {
    if (!schema[name]) continue;
    properties[name] = ruleToProperty(schema[name]);
    required.push(name);
  }

  const result = { type: 'object', properties };
  if (required.length > 0) result.required = required;
  return result;
}

function buildRequestBody(method, basePath, routeMw) {
  if (routeMw.hasValidateSchema && routeMw.schemaName) {
    const ref = resolveSchemaRef(routeMw.schemaName);
    if (ref)
      return { required: true, content: { 'application/json': { schema: { $ref: `#/components/schemas/${ref}` } } } };
  }

  if (routeMw.hasValidateFields && routeMw.validateFieldsSchema) {
    const subset = buildFieldsSubsetSchema(routeMw.validateFieldsSchema, routeMw.validateFieldNames);
    if (subset) return { required: true, content: { 'application/json': { schema: subset } } };
  }

  if (routeMw.hasUploadMiddleware) {
    return {
      required: true,
      content: {
        'multipart/form-data': {
          schema: {
            type: 'object',
            properties: { file: { type: 'string', format: 'binary', description: 'File upload' } },
          },
        },
      },
    };
  }

  if (method === 'post' || method === 'put') {
    const ref = resolveSchemaRef(basePath);
    if (ref) return { content: { 'application/json': { schema: { $ref: `#/components/schemas/${ref}` } } } };
  }

  return null;
}

function buildOperation({ method, routePath, basePath, jsdoc, isProtected, isAdminOnly, adminRole, routeMw }) {
  const operation = {
    tags: [capitalize(basePath)],
    summary: generateSmartSummary(method, routePath, basePath),
    responses: { 200: { description: 'Thành công' }, 400: { description: 'Dữ liệu không hợp lệ' } },
  };

  // Security
  if (isProtected || isAdminOnly) {
    operation.security = [{ bearerAuth: [] }];
    operation.responses['401'] = { description: 'Chưa đăng nhập' };
  }

  // Description
  const descParts = [];
  if (isAdminOnly) descParts.push(`🔒 Yêu cầu quyền: ${adminRole || 'admin'}`);
  if (routeMw.hasCheckPermission && routeMw.permission) descParts.push(`🔑 Permission: \`${routeMw.permission}\``);
  if (descParts.length > 0) operation.description = descParts.join(' | ');

  // Request body
  const body = buildRequestBody(method, basePath, routeMw);
  if (body) operation.requestBody = body;

  // JSDoc overrides
  if (jsdoc) {
    if (jsdoc.tags.length > 0) operation.tags = jsdoc.tags;
    if (jsdoc.summary) operation.summary = jsdoc.summary;
    if (jsdoc.security.length > 0) operation.security = jsdoc.security;
    if (jsdoc.requestBody) operation.requestBody = jsdoc.requestBody;
    if (Object.keys(jsdoc.responses).length > 0) operation.responses = jsdoc.responses;
  }

  // Path params
  const params = routePath.match(/:(\w+)/g);
  if (params) {
    operation.parameters = params.map((p) => ({
      name: p.slice(1),
      in: 'path',
      required: true,
      schema: { type: 'string' },
    }));
  }

  // Query params for GET list
  if (method === 'get' && !routePath.includes(':') && !/\/(schema|stats|template|export)/.test(routePath)) {
    operation.parameters = [
      ...(operation.parameters || []),
      { name: '_page', in: 'query', schema: { type: 'integer', default: 1 }, description: 'Trang' },
      { name: '_limit', in: 'query', schema: { type: 'integer', default: 10 }, description: 'Số bản ghi / trang' },
      { name: '_sort', in: 'query', schema: { type: 'string' }, description: 'Sắp xếp theo field' },
      { name: '_order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] }, description: 'Thứ tự' },
      { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Tìm kiếm' },
    ];
  }

  return operation;
}

// ==================== Spec Builder ====================

function buildSwaggerSpec() {
  const paths = scanRoutes();

  const tagSet = new Set();
  for (const pathMethods of Object.values(paths)) {
    for (const op of Object.values(pathMethods)) {
      if (op.tags) op.tags.forEach((t) => tagSet.add(t));
    }
  }

  const generatedSchemas = {};
  for (const [key, schemaDef] of Object.entries(schemas)) {
    const schemaName = capitalize(key);
    const properties = {};
    const required = [];

    for (const [field, rule] of Object.entries(schemaDef)) {
      properties[field] = ruleToProperty(rule);
      if (rule.required) required.push(field);
    }

    generatedSchemas[schemaName] = {
      type: 'object',
      properties,
      ...(required.length > 0 && { required }),
    };
  }

  return {
    openapi: '3.0.0',
    info: {
      title: 'Base Backend API',
      version: '1.0.0',
      description: 'API Documentation',
    },
    servers: [
      ...(process.env.BASE_URL ? [{ url: `${process.env.BASE_URL}/api`, description: 'Production Server' }] : []),
      { url: `http://localhost:${process.env.PORT || 3000}/api`, description: 'Local Server' },
    ],
    tags: Array.from(tagSet).map((name) => ({ name })),
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: generatedSchemas,
    },
  };
}

// ==================== Setup ====================

function setupSwagger(app) {
  const spec = buildSwaggerSpec();

  app.get('/api-docs.json', (req, res) => res.json(spec));

  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      swaggerOptions: {
        defaultModelsExpandDepth: -1,
        defaultModelExpandDepth: -1,
      },
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'Base API - Swagger',
    }),
  );

  console.log('📚 Swagger Generator initialized');
  console.log(`   - Scanned ${Object.keys(spec.paths).length} endpoints`);
  console.log(`   - Tags: ${spec.tags.map((t) => t.name).join(', ')}`);
}

export { setupSwagger, buildSwaggerSpec };
