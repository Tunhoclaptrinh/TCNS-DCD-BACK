/**
 * Swagger Auto-Generator - Tự động đọc routes, controllers, schemas
 * - Tự scan routes/ folder → build OpenAPI paths
 * - Parse JSDoc @swagger.* annotations từ controllers
 * - Auto-detect middleware: protect, authorize, validateSchema, validateFields, checkPermission
 * - Auto-detect upload routes (multipart/form-data)
 * - Auto-generate smart summaries dựa trên method + path + entity
 * - Auto-attach requestBody từ schemas/
 */

const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const path = require('path');
const schemas = require('../src/schemas');

// ==================== JSDoc Parser ====================

/**
 * Parse JSDoc comments từ controller methods
 * Hỗ trợ cả exports.method = và class field method = async
 */
function parseJSDocFromController(controllerPath, methodName) {
  try {
    if (!fs.existsSync(controllerPath)) {
      return null;
    }

    const content = fs.readFileSync(controllerPath, 'utf-8');

    // Iterate qua từng /** */ block, tìm block ngay trước method target
    const jsdocBlockRegex = /\/\*\*([\s\S]*?)\*\//g;
    let jsdocMatch;
    let targetJsdoc = null;

    while ((jsdocMatch = jsdocBlockRegex.exec(content)) !== null) {
      const jsdocEnd = jsdocMatch.index + jsdocMatch[0].length;
      const afterJsdoc = content.substring(jsdocEnd).trimStart();

      // Pattern 1: exports.methodName =
      if (afterJsdoc.startsWith(`exports.${methodName}`)) {
        targetJsdoc = jsdocMatch[1];
        break;
      }

      // Pattern 2: methodName = async (class-based controller)
      if (afterJsdoc.startsWith(`${methodName} =`) || afterJsdoc.startsWith(`${methodName}=`)) {
        targetJsdoc = jsdocMatch[1];
        break;
      }
    }

    if (!targetJsdoc) {
      return null;
    }

    const result = {
      summary: '',
      description: '',
      tags: [],
      security: [],
      requestBody: null,
      responses: {},
    };

    const lines = targetJsdoc.split('\n').map((l) => l.trim().replace(/^\*\s?/, ''));
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
          content: {
            'application/json': {
              schema: { $ref: `#/components/schemas/${bodyType}` },
            },
          },
        };
      } else if (line.startsWith('@swagger.response')) {
        const parts = line.replace('@swagger.response', '').trim().split(' ');
        const code = parts[0];
        const desc = parts.slice(1).join(' ');
        result.responses[code] = { description: desc };
      } else if (!line.startsWith('@') && line && !foundSummary && line.length > 3) {
        result.summary = line;
        foundSummary = true;
      }
    }

    return result;
  } catch (err) {
    console.error(`Error parsing JSDoc for ${methodName}:`, err.message);
    return null;
  }
}

// ==================== Route Scanner ====================

/**
 * Đọc routes/index.js để lấy mount path thực tế
 * router.use('/users', require('./user.routes')) → { 'user': 'users' }
 */
function getMountPaths(routesDir) {
  const indexPath = path.join(routesDir, 'index.js');
  const mountMap = {};

  if (!fs.existsSync(indexPath)) {
    return mountMap;
  }

  const content = fs.readFileSync(indexPath, 'utf-8');
  const mountRegex = /router\.use\s*\(\s*['"`]\/([^'"`]+)['"`]\s*,\s*require\s*\(\s*['"`]\.\/([^'"`]+)['"`]\s*\)/g;

  let match;
  while ((match = mountRegex.exec(content)) !== null) {
    const mountPath = match[1];
    const baseName = match[2].replace('.routes', '').replace('./', '');
    mountMap[baseName] = mountPath;
  }

  return mountMap;
}

/**
 * Detect global middleware (router.use) trước khi scan routes
 * Trả về { hasGlobalProtect, hasGlobalAuthorize, globalAuthorizeLine }
 */
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

    // router.use(protect)
    if (/router\.use\s*\(\s*protect\s*\)/.test(line)) {
      result.hasGlobalProtect = true;
      result.globalProtectLine = i;
    }

    // router.use(authorize('admin'))
    const authMatch = line.match(/router\.use\s*\(\s*authorize\s*\(\s*['"`](\w+)['"`]\s*\)\s*\)/);
    if (authMatch) {
      result.hasGlobalAuthorize = true;
      result.globalAuthorizeLine = i;
      result.globalAuthorizeRole = authMatch[1];
    }
  }

  return result;
}

/**
 * Detect middleware cho một route cụ thể từ route line text
 */
function detectRouteMiddleware(routeText) {
  const middleware = {
    hasProtect: false,
    hasAuthorize: false,
    authorizeRole: null,
    hasCheckPermission: false,
    permission: null,
    hasValidateSchema: false,
    schemaName: null,
    hasValidateFields: false,
    validateFieldNames: [],
    validateFieldsSchema: null,
    hasUploadMiddleware: false,
  };

  // protect
  if (/\bprotect\b/.test(routeText)) {
    middleware.hasProtect = true;
  }

  // authorize('admin')
  const authMatch = routeText.match(/authorize\s*\(\s*['"`](\w+)['"`]\s*\)/);
  if (authMatch) {
    middleware.hasAuthorize = true;
    middleware.authorizeRole = authMatch[1];
  }

  // checkPermission('users:create')
  const permMatch = routeText.match(/checkPermission\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/);
  if (permMatch) {
    middleware.hasCheckPermission = true;
    middleware.permission = permMatch[1];
  }

  // validateSchema('user')
  const schemaMatch = routeText.match(/validateSchema\s*\(\s*['"`](\w+)['"`]\s*\)/);
  if (schemaMatch) {
    middleware.hasValidateSchema = true;
    middleware.schemaName = schemaMatch[1];
  }

  // validateFields('user', ['email', 'password'])
  const fieldsMatch = routeText.match(/validateFields\s*\(\s*['"`](\w+)['"`]\s*,\s*\[([^\]]+)\]/);
  if (fieldsMatch) {
    middleware.hasValidateFields = true;
    middleware.validateFieldsSchema = fieldsMatch[1];
    middleware.validateFieldNames = fieldsMatch[2]
      .split(',')
      .map((f) => f.trim().replace(/['"`]/g, ''))
      .filter(Boolean);
  }

  // getUploadMiddleware(...)
  if (/getUploadMiddleware/.test(routeText)) {
    middleware.hasUploadMiddleware = true;
  }

  return middleware;
}

/**
 * Scan routes folder → build OpenAPI paths
 */
function scanRoutes(routesDir = path.join(__dirname, '../routes')) {
  const paths = {};
  const mountMap = getMountPaths(routesDir);

  const routeFiles = fs.readdirSync(routesDir).filter((f) => f.endsWith('.routes.js') && f !== 'index.js');

  for (const file of routeFiles) {
    const routePath = path.join(routesDir, file);
    const content = fs.readFileSync(routePath, 'utf-8');
    const baseName = file.replace('.routes.js', '');
    const mountPath = mountMap[baseName] || baseName;

    const routes = parseRoutesFromFile(content, mountPath);
    Object.assign(paths, routes);
  }

  return paths;
}

/**
 * Parse routes từ route file content
 * Bao gồm detect middleware cho từng route
 */
function parseRoutesFromFile(content, basePath) {
  const paths = {};

  // Loại bỏ dòng comment
  const cleanContent = content.replace(/^\s*\/\/.*$/gm, '');

  // Detect global middleware
  const globalMw = detectGlobalMiddleware(cleanContent);

  // Regex match từng route declaration — lấy toàn bộ text từ router.method đến );
  // Dùng 2 bước: (1) tìm vị trí router.method, (2) extract full route text

  // Match: router.METHOD('path', ...args..., controllerVar.method) hoặc inline
  const routeRegex =
    /router\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]([\s\S]*?(\w+Controller)\.([\w]+))/g;

  let match;
  while ((match = routeRegex.exec(cleanContent)) !== null) {
    const method = match[1];
    const routePath = match[2];
    const routeText = match[3]; // text chứa middleware args
    const controllerName = match[4];
    const methodName = match[5];

    // Tìm vị trí route trong file gốc (để so sánh với global middleware line)
    const routeLineIndex = cleanContent.substring(0, match.index).split('\n').length - 1;

    // Build full path
    const fullPath = routePath === '/' ? `/${basePath}` : `/${basePath}${routePath}`;

    const openApiPath = fullPath.replace(/:(\w+)/g, '{$1}');

    // Detect middleware cho route này
    const routeMw = detectRouteMiddleware(routeText);

    // Merge với global middleware
    const isProtected =
      routeMw.hasProtect || (globalMw.hasGlobalProtect && routeLineIndex > globalMw.globalProtectLine);
    const isAdminOnly =
      routeMw.hasAuthorize || (globalMw.hasGlobalAuthorize && routeLineIndex > globalMw.globalAuthorizeLine);
    const adminRole = routeMw.authorizeRole || globalMw.globalAuthorizeRole;

    // Parse JSDoc từ controller
    const controllerFile = controllerName.replace(/Controller$/, '') + '.controller.js';
    const controllerPath = path.join(__dirname, '../controllers', controllerFile);
    const jsdoc = parseJSDocFromController(controllerPath, methodName);

    // Build operation
    const operation = buildOperation({
      method,
      routePath,
      basePath,
      jsdoc,
      isProtected,
      isAdminOnly,
      adminRole,
      routeMw,
    });

    if (!paths[openApiPath]) {
      paths[openApiPath] = {};
    }
    paths[openApiPath][method.toLowerCase()] = operation;
  }

  return paths;
}

// ==================== Operation Builder ====================

/**
 * Schema name mapping: schemaKey → OpenAPI schema name
 * user → Users, users → Users, notification → Notifications
 */
function resolveSchemaRef(schemaKey) {
  // Thử tìm exact match trước
  if (schemas[schemaKey]) {
    return capitalize(schemaKey);
  }
  // Thử thêm 's' (user → users)
  if (schemas[schemaKey + 's']) {
    return capitalize(schemaKey + 's');
  }
  return null;
}

/**
 * Build subset schema từ validateFields
 */
function buildFieldsSubsetSchema(schemaKey, fieldNames) {
  const schemaName = schemaKey.endsWith('s') ? schemaKey : schemaKey + 's';
  const schema = schemas[schemaName] || schemas[schemaKey];
  if (!schema) return null;

  const properties = {};
  const required = [];

  for (const fieldName of fieldNames) {
    const rule = schema[fieldName];
    if (!rule) continue;

    const prop = { description: rule.description || '' };

    switch (rule.type) {
      case 'string':
        prop.type = 'string';
        break;
      case 'number':
        prop.type = 'number';
        break;
      case 'boolean':
        prop.type = 'boolean';
        break;
      case 'email':
        prop.type = 'string';
        prop.format = 'email';
        break;
      case 'date':
        prop.type = 'string';
        prop.format = 'date-time';
        break;
      case 'enum':
        prop.type = 'string';
        prop.enum = rule.enum;
        break;
      default:
        prop.type = 'string';
    }

    if (rule.minLength !== undefined) prop.minLength = rule.minLength;
    if (rule.maxLength !== undefined) prop.maxLength = rule.maxLength;
    if (rule.min !== undefined) prop.minimum = rule.min;
    if (rule.max !== undefined) prop.maximum = rule.max;

    properties[fieldName] = prop;
    required.push(fieldName);
  }

  const result = { type: 'object', properties };
  if (required.length > 0) result.required = required;
  return result;
}

/**
 * Sinh summary thông minh dựa trên method + path + entity
 */
function generateSmartSummary(method, routePath, basePath) {
  const entity = capitalize(basePath);

  // Exact matches
  if (routePath === '/' && method === 'get') return `Danh sách ${entity}`;
  if (routePath === '/' && method === 'post') return `Tạo ${entity}`;
  if (routePath === '/' && method === 'delete') return `Xoá tất cả ${entity}`;

  if (routePath === '/:id' && method === 'get') return `Chi tiết ${entity}`;
  if (routePath === '/:id' && method === 'put') return `Cập nhật ${entity}`;
  if (routePath === '/:id' && method === 'delete') return `Xoá ${entity}`;

  // Pattern matches
  if (/^\/:id\/status$/.test(routePath) && method === 'patch') return `Cập nhật trạng thái ${entity}`;
  if (/^\/:id\/permanent$/.test(routePath) && method === 'delete') return `Xoá vĩnh viễn ${entity}`;
  if (/^\/:id\/activity$/.test(routePath) && method === 'get') return `Lịch sử hoạt động ${entity}`;
  if (/^\/:id\/read$/.test(routePath) && method === 'patch') return `Đánh dấu đã đọc`;
  if (/^\/read-all$/.test(routePath) && method === 'patch') return `Đánh dấu tất cả đã đọc`;
  if (/^\/profile$/.test(routePath) && method === 'put') return `Cập nhật profile`;
  if (/^\/schema$/.test(routePath) && method === 'get') return `Xem schema ${entity}`;
  if (/^\/template$/.test(routePath) && method === 'get') return `Tải template import ${entity}`;
  if (/^\/import$/.test(routePath) && method === 'post') return `Import ${entity} từ file`;
  if (/^\/export$/.test(routePath) && method === 'get') return `Export ${entity}`;
  if (/^\/stats/.test(routePath) && method === 'get') return `Thống kê ${entity}`;
  if (/^\/cleanup$/.test(routePath) && method === 'post') return `Dọn dẹp ${entity}`;
  if (/^\/me$/.test(routePath) && method === 'get') return `Thông tin tài khoản hiện tại`;

  // Fallback
  return `${method.toUpperCase()} ${routePath}`;
}

/**
 * Build OpenAPI operation object
 */
function buildOperation({ method, routePath, basePath, jsdoc, isProtected, isAdminOnly, adminRole, routeMw }) {
  const operation = {
    tags: [capitalize(basePath)],
    summary: generateSmartSummary(method, routePath, basePath),
    responses: {
      200: { description: 'Thành công' },
      400: { description: 'Dữ liệu không hợp lệ' },
    },
  };

  // --- Security ---
  if (isProtected || isAdminOnly) {
    operation.security = [{ bearerAuth: [] }];
    operation.responses['401'] = { description: 'Chưa đăng nhập' };
  }

  // --- Description từ permissions ---
  const descParts = [];
  if (isAdminOnly) {
    descParts.push(`🔒 Yêu cầu quyền: ${adminRole || 'admin'}`);
  }
  if (routeMw.hasCheckPermission && routeMw.permission) {
    descParts.push(`🔑 Permission: \`${routeMw.permission}\``);
  }
  if (descParts.length > 0) {
    operation.description = descParts.join(' | ');
  }

  // --- Request Body ---
  if (routeMw.hasValidateSchema && routeMw.schemaName) {
    // validateSchema('user') → full schema
    const schemaRef = resolveSchemaRef(routeMw.schemaName);
    if (schemaRef) {
      operation.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: `#/components/schemas/${schemaRef}` },
          },
        },
      };
    }
  } else if (routeMw.hasValidateFields && routeMw.validateFieldsSchema) {
    // validateFields('user', ['email', 'password']) → subset schema
    const subsetSchema = buildFieldsSubsetSchema(routeMw.validateFieldsSchema, routeMw.validateFieldNames);
    if (subsetSchema) {
      operation.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: subsetSchema,
          },
        },
      };
    }
  } else if (routeMw.hasUploadMiddleware) {
    // Upload route → multipart/form-data
    operation.requestBody = {
      required: true,
      content: {
        'multipart/form-data': {
          schema: {
            type: 'object',
            properties: {
              file: { type: 'string', format: 'binary', description: 'File upload' },
            },
          },
        },
      },
    };
  } else if ((method === 'post' || method === 'put') && !operation.requestBody) {
    // POST/PUT không có validate → thử gắn schema entity (tất cả fields optional)
    const schemaRef = resolveSchemaRef(basePath);
    if (schemaRef) {
      operation.requestBody = {
        content: {
          'application/json': {
            schema: { $ref: `#/components/schemas/${schemaRef}` },
          },
        },
      };
    }
  }

  // --- Override với JSDoc nếu có ---
  if (jsdoc) {
    if (jsdoc.tags && jsdoc.tags.length > 0) {
      operation.tags = jsdoc.tags;
    }
    if (jsdoc.summary) {
      operation.summary = jsdoc.summary;
    }
    if (jsdoc.security && jsdoc.security.length > 0) {
      operation.security = jsdoc.security;
    }
    if (jsdoc.requestBody) {
      operation.requestBody = jsdoc.requestBody;
    }
    if (Object.keys(jsdoc.responses).length > 0) {
      operation.responses = jsdoc.responses;
    }
  }

  // --- Path parameters ---
  const params = routePath.match(/:(\w+)/g);
  if (params) {
    operation.parameters = params.map((p) => ({
      name: p.slice(1),
      in: 'path',
      required: true,
      schema: { type: 'string' },
    }));
  }

  // --- Query parameters cho GET list ---
  if (
    method === 'get' &&
    !routePath.includes(':') &&
    routePath !== '/schema' &&
    !routePath.includes('/stats') &&
    routePath !== '/template' &&
    routePath !== '/export'
  ) {
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

// ==================== Schema Converter ====================

/**
 * Convert schema format → OpenAPI schema
 */
function convertToOpenApiSchema(schema) {
  const properties = {};
  const required = [];

  for (const [field, rule] of Object.entries(schema)) {
    const prop = { description: rule.description || '' };

    switch (rule.type) {
      case 'string':
        prop.type = 'string';
        break;
      case 'number':
        prop.type = 'number';
        break;
      case 'boolean':
        prop.type = 'boolean';
        break;
      case 'email':
        prop.type = 'string';
        prop.format = 'email';
        break;
      case 'date':
        prop.type = 'string';
        prop.format = 'date-time';
        break;
      case 'enum':
        prop.type = 'string';
        prop.enum = rule.enum;
        break;
      default:
        prop.type = 'string';
    }

    if (rule.minLength !== undefined) prop.minLength = rule.minLength;
    if (rule.maxLength !== undefined) prop.maxLength = rule.maxLength;
    if (rule.min !== undefined) prop.minimum = rule.min;
    if (rule.max !== undefined) prop.maximum = rule.max;
    if (rule.default !== undefined) prop.default = rule.default;
    if (rule.required) required.push(field);

    properties[field] = prop;
  }

  const result = { type: 'object', properties };
  if (required.length > 0) result.required = required;
  return result;
}

/**
 * Capitalize first letter
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ==================== Spec Builder ====================

/**
 * Build complete OpenAPI spec
 */
function buildSwaggerSpec() {
  // 1. Convert schemas
  const componentSchemas = {};
  for (const [entity, schema] of Object.entries(schemas)) {
    componentSchemas[capitalize(entity)] = convertToOpenApiSchema(schema);
  }

  // 2. Scan routes tự động
  const paths = scanRoutes();

  // 3. Auto-generate tags từ paths
  const tagSet = new Set();
  for (const pathMethods of Object.values(paths)) {
    for (const op of Object.values(pathMethods)) {
      if (op.tags) op.tags.forEach((t) => tagSet.add(t));
    }
  }

  const tags = Array.from(tagSet).map((name) => ({ name }));

  // 4. Build spec
  return {
    openapi: '3.0.0',
    info: {
      title: 'Base Backend API',
      version: '1.0.0',
      description: 'API Documentation — Tự sinh từ routes, controllers, schemas',
    },
    servers: [{ url: '/api', description: 'API Server' }],
    tags,
    paths,
    components: {
      schemas: componentSchemas,
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  };
}

// ==================== Setup ====================

/**
 * Mount Swagger UI vào Express app
 */
function setupSwagger(app) {
  const spec = buildSwaggerSpec();

  // Serve spec JSON
  app.get('/api-docs.json', (req, res) => {
    res.json(spec);
  });

  // Serve Swagger UI
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'Base API - Swagger',
    }),
  );

  console.log('📚 Swagger Auto-Generator initialized');
  console.log(`   - Scanned ${Object.keys(spec.paths).length} endpoints`);
  console.log(`   - Loaded ${Object.keys(spec.components.schemas).length} schemas`);
  console.log(`   - Tags: ${spec.tags.map((t) => t.name).join(', ')}`);
}

module.exports = { setupSwagger, buildSwaggerSpec };
