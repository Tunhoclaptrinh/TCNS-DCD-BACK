import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import path from 'path';
import schemas from '@schemas';
import type { AnyRecord } from '@app-types/common';
import type { SchemaDefinition, SchemaRule } from '@app-types/schema';

type JSDocResult = {
  summary: string;
  tags: string[];
  security: AnyRecord[];
  requestBody: AnyRecord | null;
  responses: AnyRecord;
};

type GlobalMiddlewareInfo = {
  hasGlobalProtect: boolean;
  globalProtectLine: number;
  hasGlobalAuthorize: boolean;
  globalAuthorizeLine: number;
  globalAuthorizeRole: string | null;
};

type RouteMiddlewareInfo = AnyRecord & {
  hasProtect?: boolean;
  hasAuthorize?: boolean;
  authorizeRole?: string;
  hasCheckPermission?: boolean;
  permission?: string;
  hasValidateSchema?: boolean;
  schemaName?: string;
  hasUploadMiddleware?: boolean;
  hasValidateFields?: boolean;
  validateFieldsSchema?: string;
  validateFieldNames?: string[];
};

// ==================== Helpers ====================

function findExistingFile(basePath: string) {
  const candidates = [basePath, `${basePath}.ts`, `${basePath}.js`];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function toPascalCase(str: string) {
  return String(str || '')
    .replace(/[_-]+/g, ' ')
    .replace(/(?:^|\s+)(\w)/g, (_, char: string) => char.toUpperCase())
    .replace(/\s+/g, '');
}

function normalizeSchemaKey(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
}

const TYPE_MAP = {
  string: { type: 'string' },
  number: { type: 'number' },
  boolean: { type: 'boolean' },
  email: { type: 'string', format: 'email' },
  date: { type: 'string', format: 'date-time' },
  enum: (rule: SchemaRule) => ({ type: 'string', enum: rule.enum }),
  array: { type: 'array', items: { type: 'string' } },
  object: { type: 'object', additionalProperties: true },
};

function ruleToProperty(rule: SchemaRule) {
  const base = TYPE_MAP[rule.type];
  const prop: AnyRecord = {
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

function buildObjectSchema(properties: AnyRecord, required: string[] = [], description?: string) {
  const schema: AnyRecord = {
    type: 'object',
    properties,
  };

  if (required.length > 0) schema.required = required;
  if (description) schema.description = description;

  return schema;
}

function buildMultipartBodyFromFields(
  fields: Record<string, SchemaRule>,
  fileFieldName: string,
  fileDescription: string,
) {
  const properties: AnyRecord = {
    [fileFieldName]: {
      type: 'string',
      format: 'binary',
      description: fileDescription,
    },
  };

  for (const [field, rule] of Object.entries(fields) as Array<[string, SchemaRule]>) {
    properties[field] = ruleToProperty(rule);
  }

  return {
    required: false,
    content: {
      'multipart/form-data': {
        schema: {
          type: 'object',
          properties,
        },
      },
    },
  };
}

const userSchema = schemas.users as SchemaDefinition;
const notificationSettingsSchema = schemas.notification_settings as SchemaDefinition;
const dutySlotSchema = schemas.duty_slots as SchemaDefinition;
const rewardPenaltySchema = schemas.reward_penalties as SchemaDefinition;

function pickFields(schema: SchemaDefinition, fieldNames: string[]) {
  const picked: Record<string, SchemaRule> = {};

  for (const fieldName of fieldNames) {
    if (!schema[fieldName]) continue;
    picked[fieldName] = schema[fieldName];
  }

  return picked;
}

function omitFields(schema: SchemaDefinition, fieldNames: string[]) {
  const omitted = new Set(fieldNames);
  const result: Record<string, SchemaRule> = {};

  for (const [fieldName, rule] of Object.entries(schema) as Array<[string, SchemaRule]>) {
    if (omitted.has(fieldName)) continue;
    result[fieldName] = rule;
  }

  return result;
}

function buildPropertiesFromSchemaFields(fields: Record<string, SchemaRule>) {
  return Object.fromEntries(Object.entries(fields).map(([field, rule]) => [field, ruleToProperty(rule)]));
}

const userProfileFieldNames = [
  'name',
  'lastName',
  'firstName',
  'dob',
  'studentId',
  'classId',
  'hometown',
  'position',
  'department',
  'phone',
  'address',
  'bio',
  'avatar',
];
const userProfileJsonFields = pickFields(userSchema, userProfileFieldNames);
const userProfileMultipartFields = omitFields(userProfileJsonFields, ['avatar']);
const userUpdateJsonFields = userSchema;
const userUpdateMultipartFields = omitFields(userSchema, ['avatar']);

const TAG_METADATA: Record<string, { name: string; description: string }> = {
  auth: {
    name: 'Xác thực',
    description: 'Đăng ký, đăng nhập, làm mới token và quản lý mật khẩu.',
  },
  users: {
    name: 'Người dùng',
    description: 'Quản lý tài khoản, hồ sơ, phân quyền và thống kê người dùng.',
  },
  upload: {
    name: 'Tải tệp',
    description: 'Tải ảnh lên Cloudinary và quản lý tài nguyên media.',
  },
  notifications: {
    name: 'Thông báo',
    description: 'Lấy danh sách thông báo, đánh dấu đã đọc và cập nhật cài đặt thông báo.',
  },
  duty: {
    name: 'Ca trực',
    description: 'Quản lý lịch trực, đăng ký ca và xử lý yêu cầu đổi ca.',
  },
  'reward-penalties': {
    name: 'Thưởng phạt',
    description: 'Quản lý bản ghi thưởng phạt và thống kê tài chính liên quan.',
  },
  reports: {
    name: 'Báo cáo',
    description: 'Tổng hợp và xuất báo cáo quản trị.',
  },
};

function getTagMetadata(basePath: string) {
  return (
    TAG_METADATA[basePath] || {
      name: toPascalCase(basePath),
      description: `API cho nhóm ${basePath}.`,
    }
  );
}

function getEntityLabel(basePath: string) {
  return getTagMetadata(basePath).name.toLowerCase();
}

function buildSchemaRefBody(schemaName: string, required = true, contentType = 'application/json') {
  return {
    required,
    content: {
      [contentType]: {
        schema: { $ref: `#/components/schemas/${schemaName}` },
      },
    },
  };
}

const EXTRA_SCHEMAS: AnyRecord = {
  AuthRegisterRequest: buildObjectSchema(
    pickFields(userSchema, ['email', 'password', 'name', 'phone', 'address']),
    ['email', 'password', 'name'],
    'Dữ liệu đăng ký tài khoản mới.',
  ),
  AuthLoginRequest: buildObjectSchema(
    {
      email: ruleToProperty(userSchema.email),
      password: {
        type: 'string',
        format: 'password',
        description: 'Mật khẩu đăng nhập',
      },
    },
    ['email', 'password'],
    'Thông tin đăng nhập bằng email và mật khẩu.',
  ),
  AuthForgotPasswordRequest: buildObjectSchema(
    {
      email: {
        type: 'string',
        format: 'email',
        description: 'Email tài khoản. Cần truyền email hoặc phone.',
      },
      phone: {
        type: 'string',
        description: 'Số điện thoại tài khoản. Cần truyền email hoặc phone.',
      },
    },
    [],
    'Yêu cầu gửi OTP quên mật khẩu.',
  ),
  AuthResetPasswordRequest: buildObjectSchema(
    {
      email: {
        type: 'string',
        format: 'email',
        description: 'Email tài khoản. Cần truyền email hoặc phone.',
      },
      phone: {
        type: 'string',
        description: 'Số điện thoại tài khoản. Cần truyền email hoặc phone.',
      },
      otp: {
        type: 'string',
        description: 'Mã OTP đã nhận.',
      },
      newPassword: {
        type: 'string',
        format: 'password',
        description: 'Mật khẩu mới.',
      },
    },
    ['otp', 'newPassword'],
    'Đặt lại mật khẩu bằng OTP.',
  ),
  AuthChangePasswordRequest: buildObjectSchema(
    {
      currentPassword: {
        type: 'string',
        format: 'password',
        description: 'Mật khẩu hiện tại.',
      },
      newPassword: {
        type: 'string',
        format: 'password',
        description: 'Mật khẩu mới.',
      },
    },
    ['currentPassword', 'newPassword'],
    'Đổi mật khẩu của tài khoản đang đăng nhập.',
  ),
  AuthRefreshTokenRequest: buildObjectSchema(
    {
      refreshToken: {
        type: 'string',
        description: 'Refresh token hợp lệ.',
      },
    },
    ['refreshToken'],
    'Lấy access token mới từ refresh token.',
  ),
  UserBulkRequest: buildObjectSchema(
    {
      operation: {
        type: 'string',
        enum: ['create', 'update', 'delete'],
        description: 'Loại thao tác hàng loạt.',
      },
      items: {
        type: 'array',
        description: 'Danh sách bản ghi cần tạo hoặc xóa.',
        items: { type: 'object', additionalProperties: true },
      },
      updates: {
        type: 'array',
        description: 'Danh sách cập nhật theo dạng `{ id, data }`.',
        items: {
          type: 'object',
          properties: {
            id: { type: 'number', description: 'ID bản ghi' },
            data: { type: 'object', additionalProperties: true, description: 'Dữ liệu cập nhật' },
          },
          required: ['id', 'data'],
        },
      },
      ids: {
        type: 'array',
        description: 'Danh sách ID cần xóa.',
        items: { type: 'number' },
      },
    },
    ['operation'],
    'Payload thao tác hàng loạt cho người dùng.',
  ),
  UserPromoteRequest: buildObjectSchema(
    {
      role: {
        type: 'string',
        enum: ['customer', 'staff', 'admin'],
        description: 'Vai trò mới của người dùng.',
      },
      reason: {
        type: 'string',
        description: 'Lý do thay đổi vai trò.',
      },
    },
    ['role'],
    'Dữ liệu cập nhật vai trò người dùng.',
  ),
  UserExpelRequest: buildObjectSchema(
    {
      reason: {
        type: 'string',
        description: 'Lý do khai trừ.',
      },
    },
    [],
    'Dữ liệu khai trừ người dùng.',
  ),
  NotificationSettingsUpdateRequest: buildObjectSchema(
    pickFields(notificationSettingsSchema, [
      'shiftNotifications',
      'approvalNotifications',
      'systemNotifications',
      'emailNotifications',
      'smsNotifications',
    ]),
    [],
    'Cập nhật cài đặt thông báo của người dùng hiện tại.',
  ),
  DutySlotRequest: buildObjectSchema(
    dutySlotSchema,
    ['weekStart', 'shiftDate', 'shiftLabel', 'createdBy'],
    'Thông tin ca trực.',
  ),
  DutySlotUpdateRequest: buildObjectSchema(
    dutySlotSchema,
    [],
    'Dữ liệu cập nhật ca trực. Chỉ cần truyền các trường muốn thay đổi.',
  ),
  DutySwapRequest: buildObjectSchema(
    {
      dutySlotId: {
        type: 'number',
        description: 'ID ca trực cần đổi.',
      },
      targetUserId: {
        type: 'number',
        description: 'ID người được đề nghị nhận ca.',
      },
      reason: {
        type: 'string',
        description: 'Lý do đổi ca.',
      },
    },
    ['dutySlotId', 'targetUserId', 'reason'],
    'Tạo yêu cầu đổi ca trực.',
  ),
  DutySwapDecisionRequest: buildObjectSchema(
    {
      decision: {
        type: 'string',
        enum: ['approved', 'rejected'],
        description: 'Quyết định duyệt hoặc từ chối yêu cầu.',
      },
      note: {
        type: 'string',
        description: 'Ghi chú khi duyệt/từ chối.',
      },
    },
    ['decision'],
    'Duyệt hoặc từ chối yêu cầu đổi ca.',
  ),
  RewardPenaltyCreateRequest: buildObjectSchema(
    rewardPenaltySchema,
    ['userId', 'type', 'amount', 'reason', 'createdBy'],
    'Tạo bản ghi thưởng hoặc phạt.',
  ),
  UploadImageRequest: {
    type: 'object',
    properties: {
      image: {
        type: 'string',
        format: 'binary',
        description: 'Tệp ảnh cần tải lên.',
      },
    },
    required: ['image'],
  },
  UserProfileUpdateRequest: buildObjectSchema(
    buildPropertiesFromSchemaFields(userProfileJsonFields),
    [],
    'Cập nhật hồ sơ cá nhân qua `application/json`. Nếu muốn truyền URL avatar thủ công, dùng field `avatar` dạng chuỗi.',
  ),
  UserProfileMultipartRequest: buildObjectSchema(
    {
      ...buildPropertiesFromSchemaFields(userProfileMultipartFields),
      avatar: {
        type: 'string',
        format: 'binary',
        description: 'Ảnh avatar mới.',
      },
    },
    [],
    'Cập nhật hồ sơ cá nhân qua `multipart/form-data`. Dùng field `avatar` để upload file ảnh.',
  ),
  UserUpdateRequest: buildObjectSchema(
    {
      ...buildPropertiesFromSchemaFields(userUpdateJsonFields),
      password: {
        type: 'string',
        format: 'password',
        description: userSchema.password.description || 'Mật khẩu mới.',
      },
    },
    [],
    'Cập nhật người dùng qua `application/json`. Có thể truyền `avatar` dưới dạng URL chuỗi.',
  ),
  UserUpdateMultipartRequest: buildObjectSchema(
    {
      ...buildPropertiesFromSchemaFields(userUpdateMultipartFields),
      password: {
        type: 'string',
        format: 'password',
        description: userSchema.password.description || 'Mật khẩu mới.',
      },
      avatar: {
        type: 'string',
        format: 'binary',
        description: 'Ảnh avatar mới.',
      },
    },
    [],
    'Cập nhật người dùng qua `multipart/form-data`. Dùng field `avatar` để upload file ảnh.',
  ),
  ImportFileRequest: {
    type: 'object',
    properties: {
      file: {
        type: 'string',
        format: 'binary',
        description: 'Tệp CSV/XLSX cần import.',
      },
    },
    required: ['file'],
  },
  UploadCleanupRequest: buildObjectSchema(
    {
      days: {
        type: 'number',
        default: 30,
        description: 'Xóa các tệp cũ hơn số ngày này.',
      },
    },
    [],
    'Dọn dẹp tệp cũ trên Cloudinary.',
  ),
};

const ROUTE_DOCS: Record<string, AnyRecord> = {
  'POST /auth/register': {
    summary: 'Đăng ký tài khoản',
    description: 'Tạo tài khoản người dùng mới bằng email và mật khẩu.',
    requestBody: buildSchemaRefBody('AuthRegisterRequest'),
    responses: {
      201: { description: 'Đăng ký thành công' },
      400: { description: 'Email đã tồn tại hoặc dữ liệu không hợp lệ' },
    },
  },
  'POST /auth/login': {
    summary: 'Đăng nhập',
    description: 'Xác thực người dùng và trả về access token, refresh token cùng danh sách quyền.',
    requestBody: buildSchemaRefBody('AuthLoginRequest'),
    responses: {
      200: { description: 'Đăng nhập thành công' },
      400: { description: 'Dữ liệu không hợp lệ' },
      401: { description: 'Sai email/mật khẩu hoặc tài khoản bị khóa' },
    },
  },
  'POST /auth/forgot-password': {
    summary: 'Gửi OTP quên mật khẩu',
    description: 'Gửi mã OTP qua email hoặc SMS để đặt lại mật khẩu.',
    requestBody: buildSchemaRefBody('AuthForgotPasswordRequest'),
    responses: {
      200: { description: 'Yêu cầu gửi OTP đã được tiếp nhận' },
      429: { description: 'Yêu cầu OTP quá nhiều lần trong thời gian ngắn' },
    },
  },
  'POST /auth/reset-password': {
    summary: 'Đặt lại mật khẩu',
    description: 'Đặt lại mật khẩu bằng OTP hợp lệ.',
    requestBody: buildSchemaRefBody('AuthResetPasswordRequest'),
    responses: {
      200: { description: 'Đặt lại mật khẩu thành công' },
      400: { description: 'OTP không hợp lệ hoặc đã hết hạn' },
    },
  },
  'GET /auth/me': {
    summary: 'Lấy thông tin tài khoản hiện tại',
    description: 'Trả về thông tin người dùng đang đăng nhập kèm danh sách quyền.',
  },
  'POST /auth/logout': {
    summary: 'Đăng xuất',
    description: 'Đăng xuất phiên hiện tại ở phía client.',
  },
  'PUT /auth/change-password': {
    summary: 'Đổi mật khẩu',
    description: 'Đổi mật khẩu cho tài khoản đang đăng nhập.',
    requestBody: buildSchemaRefBody('AuthChangePasswordRequest'),
    responses: {
      200: { description: 'Đổi mật khẩu thành công' },
      400: { description: 'Mật khẩu hiện tại sai hoặc mật khẩu mới không hợp lệ' },
      401: { description: 'Chưa đăng nhập' },
    },
  },
  'POST /auth/refresh': {
    summary: 'Làm mới access token',
    description: 'Dùng refresh token để lấy access token mới.',
    requestBody: buildSchemaRefBody('AuthRefreshTokenRequest'),
    responses: {
      200: { description: 'Làm mới token thành công' },
      400: { description: 'Thiếu refresh token' },
      401: { description: 'Refresh token không hợp lệ hoặc đã hết hạn' },
    },
  },
  'PUT /users/profile': {
    summary: 'Cập nhật hồ sơ cá nhân',
    description:
      'Cập nhật thông tin hồ sơ của chính bạn. Dùng `application/json` khi cập nhật text hoặc URL avatar, và dùng `multipart/form-data` khi upload file avatar.',
    requestBody: {
      required: false,
      content: {
        'multipart/form-data': {
          schema: { $ref: '#/components/schemas/UserProfileMultipartRequest' },
          encoding: {
            avatar: {
              contentType: 'image/*',
            },
          },
        },
        'application/json': {
          schema: { $ref: '#/components/schemas/UserProfileUpdateRequest' },
        },
      },
    },
    responses: {
      200: { description: 'Cập nhật hồ sơ thành công' },
      400: { description: 'Không có dữ liệu hợp lệ để cập nhật' },
      401: { description: 'Chưa đăng nhập' },
    },
  },
  'GET /users/search': {
    summary: 'Tìm kiếm người dùng',
    description: 'Tìm kiếm người dùng theo từ khóa và hỗ trợ phân trang.',
    parameters: [
      { name: 'q', in: 'query', required: true, schema: { type: 'string' }, description: 'Từ khóa tìm kiếm.' },
      { name: '_page', in: 'query', schema: { type: 'integer', default: 1 }, description: 'Trang hiện tại.' },
      { name: '_limit', in: 'query', schema: { type: 'integer', default: 10 }, description: 'Số bản ghi mỗi trang.' },
      { name: '_sort', in: 'query', schema: { type: 'string' }, description: 'Sắp xếp theo field.' },
      {
        name: '_order',
        in: 'query',
        schema: { type: 'string', enum: ['asc', 'desc'] },
        description: 'Thứ tự sắp xếp.',
      },
    ],
  },
  'GET /users/count': {
    summary: 'Đếm số lượng người dùng',
    description: 'Trả về tổng số người dùng theo bộ lọc hiện tại.',
    internal: true,
  },
  'POST /users/bulk': {
    summary: 'Thao tác hàng loạt người dùng',
    description: 'Hỗ trợ tạo, cập nhật hoặc xóa hàng loạt người dùng.',
    requestBody: buildSchemaRefBody('UserBulkRequest'),
    internal: true,
  },
  'POST /users/validate': {
    summary: 'Kiểm tra dữ liệu người dùng',
    description: 'Kiểm tra dữ liệu đầu vào theo schema người dùng.',
    requestBody: buildSchemaRefBody('Users'),
    internal: true,
  },
  'PUT /users/{id}': {
    summary: 'Cập nhật người dùng',
    description:
      'Cập nhật thông tin người dùng theo ID. Dùng `application/json` khi cập nhật dữ liệu text/URL, và dùng `multipart/form-data` khi upload file avatar.',
    requestBody: {
      required: false,
      content: {
        'multipart/form-data': {
          schema: { $ref: '#/components/schemas/UserUpdateMultipartRequest' },
          encoding: {
            avatar: {
              contentType: 'image/*',
            },
          },
        },
        'application/json': {
          schema: { $ref: '#/components/schemas/UserUpdateRequest' },
        },
      },
    },
  },
  'GET /users/stats/summary': {
    summary: 'Thống kê người dùng',
    description: 'Lấy thống kê tổng quan người dùng theo trạng thái, vai trò và phòng ban.',
  },
  'PATCH /users/{id}/promote': {
    summary: 'Cập nhật vai trò người dùng',
    description: 'Thay đổi vai trò của người dùng theo ID.',
    requestBody: buildSchemaRefBody('UserPromoteRequest'),
  },
  'PATCH /users/{id}/expel': {
    summary: 'Khai trừ người dùng',
    description: 'Đánh dấu người dùng bị khai trừ khỏi tổ chức.',
    requestBody: buildSchemaRefBody('UserExpelRequest', false),
  },
  'GET /users/template': {
    summary: 'Tải mẫu import người dùng',
    parameters: [
      {
        name: 'format',
        in: 'query',
        schema: { type: 'string', enum: ['csv', 'xlsx'], default: 'xlsx' },
        description: 'Định dạng file mẫu muốn tải.',
      },
    ],
    responses: {
      200: {
        description: 'Tải file mẫu thành công',
        content: {
          'application/octet-stream': {
            schema: { type: 'string', format: 'binary' },
          },
        },
      },
    },
  },
  'POST /users/import': {
    summary: 'Import người dùng từ file',
    description: 'Import dữ liệu người dùng từ tệp CSV hoặc XLSX.',
    requestBody: {
      required: true,
      content: {
        'multipart/form-data': {
          schema: { $ref: '#/components/schemas/ImportFileRequest' },
        },
      },
    },
  },
  'GET /users/export': {
    summary: 'Xuất danh sách người dùng',
    description: 'Xuất dữ liệu người dùng theo định dạng CSV hoặc XLSX.',
    parameters: [
      {
        name: 'format',
        in: 'query',
        schema: { type: 'string', enum: ['csv', 'xlsx'], default: 'xlsx' },
        description: 'Định dạng file xuất.',
      },
    ],
    responses: {
      200: {
        description: 'Xuất dữ liệu thành công',
        content: {
          'application/octet-stream': {
            schema: { type: 'string', format: 'binary' },
          },
        },
      },
    },
  },
  'GET /users/schema': {
    summary: 'Xem schema người dùng',
    description: 'Xem tài liệu schema validation của entity người dùng.',
    internal: true,
  },
  'GET /users/{id}/activity': {
    summary: 'Lấy lịch sử hoạt động người dùng',
  },
  'GET /notifications/settings': {
    summary: 'Lấy cài đặt thông báo',
  },
  'PUT /notifications/settings': {
    summary: 'Cập nhật cài đặt thông báo',
    requestBody: buildSchemaRefBody('NotificationSettingsUpdateRequest', false),
  },
  'POST /upload/avatar': {
    summary: 'Tải ảnh avatar lên Cloudinary',
    description: 'Tải một ảnh avatar mới. Field file phải có tên `image`.',
    requestBody: {
      required: true,
      content: {
        'multipart/form-data': {
          schema: { $ref: '#/components/schemas/UploadImageRequest' },
        },
      },
    },
  },
  'POST /upload/general': {
    summary: 'Tải ảnh chung lên Cloudinary',
    description: 'Tải một ảnh dùng chung lên Cloudinary. Field file phải có tên `image`.',
    requestBody: {
      required: true,
      content: {
        'multipart/form-data': {
          schema: { $ref: '#/components/schemas/UploadImageRequest' },
        },
      },
    },
  },
  'DELETE /upload/file': {
    summary: 'Xóa tệp trên Cloudinary',
    description: 'Xóa tệp theo `publicId` hoặc `url`.',
    parameters: [
      { name: 'publicId', in: 'query', schema: { type: 'string' }, description: 'Public ID của asset.' },
      { name: 'url', in: 'query', schema: { type: 'string' }, description: 'URL đầy đủ của asset.' },
    ],
  },
  'GET /upload/file/info': {
    summary: 'Lấy thông tin tệp trên Cloudinary',
    parameters: [
      { name: 'publicId', in: 'query', schema: { type: 'string' }, description: 'Public ID của asset.' },
      { name: 'url', in: 'query', schema: { type: 'string' }, description: 'URL đầy đủ của asset.' },
    ],
    internal: true,
  },
  'GET /upload/stats': {
    summary: 'Thống kê dung lượng tệp',
    description: 'Thống kê số lượng và dung lượng tệp trên Cloudinary theo từng thư mục.',
    internal: true,
  },
  'POST /upload/cleanup': {
    summary: 'Dọn dẹp tệp cũ trên Cloudinary',
    requestBody: buildSchemaRefBody('UploadCleanupRequest', false),
    internal: true,
  },
  'GET /duty/week': {
    summary: 'Lấy lịch trực theo tuần',
    description: 'Lấy danh sách ca trực trong tuần theo `weekStart` và hỗ trợ phân trang.',
    parameters: [
      {
        name: 'weekStart',
        in: 'query',
        schema: { type: 'string', format: 'date-time' },
        description: 'Ngày bắt đầu tuần theo ISO.',
      },
      { name: '_page', in: 'query', schema: { type: 'integer', default: 1 }, description: 'Trang hiện tại.' },
      { name: '_limit', in: 'query', schema: { type: 'integer', default: 10 }, description: 'Số bản ghi mỗi trang.' },
      { name: '_sort', in: 'query', schema: { type: 'string' }, description: 'Field sắp xếp.' },
      {
        name: '_order',
        in: 'query',
        schema: { type: 'string', enum: ['asc', 'desc'] },
        description: 'Thứ tự sắp xếp.',
      },
    ],
  },
  'GET /duty/stats/summary': {
    summary: 'Thống kê ca trực',
  },
  'POST /duty/slots': {
    summary: 'Tạo ca trực',
    requestBody: buildSchemaRefBody('DutySlotRequest'),
    responses: {
      201: { description: 'Tạo ca trực thành công' },
      400: { description: 'Dữ liệu không hợp lệ' },
    },
  },
  'PUT /duty/slots/{id}': {
    summary: 'Cập nhật ca trực',
    requestBody: buildSchemaRefBody('DutySlotUpdateRequest', false),
  },
  'PATCH /duty/slots/{id}/register': {
    summary: 'Đăng ký vào ca trực',
    description: 'Đăng ký người dùng hiện tại vào ca trực theo ID.',
  },
  'PATCH /duty/slots/{id}/cancel': {
    summary: 'Hủy đăng ký ca trực',
    description: 'Hủy đăng ký ca trực của người dùng hiện tại.',
  },
  'POST /duty/swaps': {
    summary: 'Tạo yêu cầu đổi ca',
    requestBody: buildSchemaRefBody('DutySwapRequest'),
    responses: {
      201: { description: 'Tạo yêu cầu đổi ca thành công' },
      400: { description: 'Dữ liệu không hợp lệ hoặc xung đột ca trực' },
    },
  },
  'GET /duty/swaps': {
    summary: 'Lấy danh sách yêu cầu đổi ca',
    parameters: [
      { name: 'status', in: 'query', schema: { type: 'string' }, description: 'Lọc theo trạng thái yêu cầu.' },
      { name: '_page', in: 'query', schema: { type: 'integer', default: 1 }, description: 'Trang hiện tại.' },
      { name: '_limit', in: 'query', schema: { type: 'integer', default: 10 }, description: 'Số bản ghi mỗi trang.' },
      { name: '_sort', in: 'query', schema: { type: 'string' }, description: 'Field sắp xếp.' },
      {
        name: '_order',
        in: 'query',
        schema: { type: 'string', enum: ['asc', 'desc'] },
        description: 'Thứ tự sắp xếp.',
      },
    ],
  },
  'PATCH /duty/swaps/{id}/decision': {
    summary: 'Duyệt hoặc từ chối yêu cầu đổi ca',
    requestBody: buildSchemaRefBody('DutySwapDecisionRequest'),
  },
  'GET /reward-penalties': {
    summary: 'Lấy lịch sử thưởng phạt',
  },
  'POST /reward-penalties': {
    summary: 'Tạo bản ghi thưởng phạt',
    requestBody: buildSchemaRefBody('RewardPenaltyCreateRequest'),
    responses: {
      201: { description: 'Tạo bản ghi thành công' },
      400: { description: 'Dữ liệu không hợp lệ' },
    },
  },
  'GET /reward-penalties/stats/financial': {
    summary: 'Thống kê tài chính thưởng phạt',
    parameters: [
      {
        name: 'from',
        in: 'query',
        schema: { type: 'string', format: 'date-time' },
        description: 'Thời gian bắt đầu lọc.',
      },
      {
        name: 'to',
        in: 'query',
        schema: { type: 'string', format: 'date-time' },
        description: 'Thời gian kết thúc lọc.',
      },
      {
        name: 'dateFrom',
        in: 'query',
        schema: { type: 'string', format: 'date-time' },
        description: 'Alias của `from`.',
      },
      { name: 'dateTo', in: 'query', schema: { type: 'string', format: 'date-time' }, description: 'Alias của `to`.' },
    ],
  },
  'GET /reports/overview': {
    summary: 'Lấy báo cáo tổng quan',
  },
  'GET /reports/export': {
    summary: 'Xuất báo cáo tổng quan',
    parameters: [
      {
        name: 'format',
        in: 'query',
        schema: { type: 'string', enum: ['csv', 'xlsx'], default: 'xlsx' },
        description: 'Định dạng file xuất.',
      },
    ],
    responses: {
      200: {
        description: 'Xuất báo cáo thành công',
        content: {
          'application/octet-stream': {
            schema: { type: 'string', format: 'binary' },
          },
        },
      },
    },
  },
};

// ==================== JSDoc Parser ====================

function parseJSDocFromController(controllerPath: string | null, methodName: string): JSDocResult | null {
  try {
    if (!controllerPath || !fs.existsSync(controllerPath)) return null;

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
  } catch (err: any) {
    console.error(`Error parsing JSDoc for ${methodName}:`, err.message);
    return null;
  }
}

function parseJSDocContent(raw: string): JSDocResult {
  const result: JSDocResult = { summary: '', tags: [], security: [], requestBody: null, responses: {} };
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

function getMountPaths(routesDir: string) {
  const indexPath = findExistingFile(path.join(routesDir, 'index'));
  if (!indexPath) return {};

  const content = fs.readFileSync(indexPath, 'utf-8');
  const mountMap: AnyRecord = {};

  // Parse import: import varName from './xxx.routes'
  const importMap: Record<string, string> = {};
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

function detectGlobalMiddleware(content: string): GlobalMiddlewareInfo {
  const result: GlobalMiddlewareInfo = {
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
  { key: 'hasUploadMiddleware', regex: /getUploadMiddleware|getAvatarUploadMiddleware/ },
];

function detectRouteMiddleware(routeText) {
  const mw: RouteMiddlewareInfo = {};

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
  const paths: AnyRecord = {};
  const mountMap = getMountPaths(routesDir);
  const routeFiles = fs.readdirSync(routesDir).filter((f) => /\.routes\.(ts|js)$/.test(f));

  for (const file of routeFiles) {
    const content = fs.readFileSync(path.join(routesDir, file), 'utf-8');
    const baseName = file.replace(/\.routes\.(ts|js)$/, '');
    Object.assign(paths, parseRoutesFromFile(content, mountMap[baseName] || baseName));
  }

  return paths;
}

function parseRoutesFromFile(content: string, basePath: string) {
  const paths: AnyRecord = {};
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

    const controllerFile = controllerName.replace(/Controller$/, '') + '.controller';
    const controllerPath = findExistingFile(path.join(__dirname, '../controllers', controllerFile));
    const jsdoc = parseJSDocFromController(controllerPath, methodName);

    if (!paths[openApiPath]) paths[openApiPath] = {};
    paths[openApiPath][method] = buildOperation({
      method,
      routePath,
      basePath,
      openApiPath,
      jsdoc,
      isProtected,
      isAdminOnly,
      adminRole: routeMw.authorizeRole || globalMw.globalAuthorizeRole,
      routeMw,
      methodName,
    });
  }

  return paths;
}

// ==================== Operation Builder ====================

const SUMMARY_MAP: Array<[RegExp, string, (entity: string) => string]> = [
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

function generateSmartSummary(method: string, routePath: string, basePath: string) {
  const entity = getEntityLabel(basePath);
  for (const [pattern, m, fn] of SUMMARY_MAP) {
    if (pattern.test(routePath) && m === method) return fn(entity);
  }
  return `${method.toUpperCase()} ${routePath}`;
}

function resolveSchemaRef(schemaKey: string) {
  const normalized = normalizeSchemaKey(schemaKey);
  if (schemas[normalized]) return toPascalCase(normalized);
  if (schemas[`${normalized}s`]) return toPascalCase(`${normalized}s`);
  return null;
}

function buildFieldsSubsetSchema(schemaKey: string, fieldNames: string[]) {
  const normalized = normalizeSchemaKey(schemaKey);
  const schema = (schemas[normalized.endsWith('s') ? normalized : `${normalized}s`] || schemas[normalized]) as
    | SchemaDefinition
    | undefined;
  if (!schema) return null;

  const properties: AnyRecord = {};
  const required = [];

  for (const name of fieldNames) {
    if (!schema[name]) continue;
    properties[name] = ruleToProperty(schema[name]);
    if (schema[name].required) {
      required.push(name);
    }
  }

  const result: AnyRecord = { type: 'object', properties };
  if (required.length > 0) result.required = required;
  return result;
}

function buildRequestBody(method: string, basePath: string, routeMw: RouteMiddlewareInfo, routeKey?: string) {
  const routeDoc = routeKey ? ROUTE_DOCS[routeKey] : null;
  if (routeDoc?.requestBody) {
    return routeDoc.requestBody;
  }

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
            $ref: '#/components/schemas/ImportFileRequest',
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

function buildPathParameters(routePath: string) {
  const params = routePath.match(/:(\w+)/g);
  if (!params) return [];

  return params.map((item) => {
    const name = item.slice(1);
    return {
      name,
      in: 'path',
      required: true,
      schema: { type: name === 'id' ? 'integer' : 'string' },
      description: name === 'id' ? 'ID bản ghi' : `Tham số đường dẫn ${name}`,
    };
  });
}

function buildDefaultListParameters(routeKey: string) {
  const listRouteKeys = new Set(['GET /users', 'GET /notifications', 'GET /reward-penalties', 'GET /duty/swaps']);

  if (!listRouteKeys.has(routeKey)) return [];

  return [
    { name: '_page', in: 'query', schema: { type: 'integer', default: 1 }, description: 'Trang hiện tại.' },
    { name: '_limit', in: 'query', schema: { type: 'integer', default: 10 }, description: 'Số bản ghi mỗi trang.' },
    { name: '_sort', in: 'query', schema: { type: 'string' }, description: 'Field sắp xếp.' },
    { name: '_order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] }, description: 'Thứ tự sắp xếp.' },
    { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Từ khóa tìm kiếm.' },
  ];
}

function mergeParameters(...groups: AnyRecord[][]) {
  const merged: AnyRecord[] = [];
  const seen = new Set();

  for (const group of groups) {
    for (const param of group || []) {
      const key = `${param.in}:${param.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(param);
    }
  }

  return merged;
}

function buildDefaultResponses(method: string, routePath: string) {
  const successCode = method === 'post' && (routePath === '/' || routePath === '/register') ? 201 : 200;
  return {
    [successCode]: { description: successCode === 201 ? 'Tạo mới thành công' : 'Thành công' },
    400: { description: 'Dữ liệu không hợp lệ' },
  };
}

function buildOperation({
  method,
  routePath,
  basePath,
  openApiPath,
  jsdoc,
  isProtected,
  isAdminOnly,
  adminRole,
  routeMw,
  methodName,
}: AnyRecord) {
  const routeKey = `${method.toUpperCase()} ${openApiPath}`;
  const routeDoc = ROUTE_DOCS[routeKey] || {};
  const tagMeta = getTagMetadata(basePath);
  const operation: AnyRecord = {
    tags: [tagMeta.name],
    summary: routeDoc.summary || generateSmartSummary(method, routePath, basePath),
    operationId: methodName || `${method}_${basePath}_${routePath}`,
    responses: buildDefaultResponses(method, routePath),
  };

  // Security
  if (isProtected || isAdminOnly) {
    operation.security = [{ bearerAuth: [] }];
    operation.responses['401'] = { description: 'Chưa đăng nhập' };
  }
  if (isAdminOnly || routeMw.hasCheckPermission) {
    operation.responses['403'] = { description: 'Không có quyền truy cập' };
  }

  // Description
  const descParts = [];
  if (routeDoc.description) descParts.push(routeDoc.description);
  if (isProtected || isAdminOnly) descParts.push('Yêu cầu xác thực bằng Bearer token.');
  if (isAdminOnly) descParts.push(`Yêu cầu vai trò: \`${adminRole || 'admin'}\`.`);
  if (routeMw.hasCheckPermission && routeMw.permission)
    descParts.push(`Yêu cầu permission: \`${routeMw.permission}\`.`);
  if (routeDoc.internal) descParts.push('API nội bộ/hỗ trợ vận hành. Mặc định được ẩn khỏi Swagger public.');
  if (descParts.length > 0) operation.description = descParts.join(' | ');

  // Request body
  const body = buildRequestBody(method, basePath, routeMw, routeKey);
  if (body) operation.requestBody = body;

  const parameters = mergeParameters(
    buildPathParameters(routePath),
    routeDoc.parameters || [],
    buildDefaultListParameters(routeKey),
  );
  if (parameters.length > 0) {
    operation.parameters = parameters;
  }

  if (routeDoc.responses) {
    operation.responses = { ...operation.responses, ...routeDoc.responses };
  }

  // JSDoc overrides
  if (jsdoc) {
    if (jsdoc.tags.length > 0) operation.tags = jsdoc.tags;
    if (jsdoc.summary) operation.summary = jsdoc.summary;
    if (jsdoc.security.length > 0) operation.security = jsdoc.security;
    if (jsdoc.requestBody) operation.requestBody = jsdoc.requestBody;
    if (Object.keys(jsdoc.responses).length > 0) operation.responses = jsdoc.responses;
  }

  if (routeDoc.internal) {
    operation['x-internal'] = true;
  }

  return operation;
}

// ==================== Spec Builder ====================

function buildSwaggerSpec() {
  const rawPaths = scanRoutes();
  const includeInternal = String(process.env.SWAGGER_INCLUDE_INTERNAL || 'false') === 'true';
  const paths: AnyRecord = {};

  for (const [pathKey, methods] of Object.entries(rawPaths)) {
    const filteredMethods: AnyRecord = {};

    for (const [method, operation] of Object.entries(methods as AnyRecord)) {
      if (!includeInternal && operation['x-internal']) {
        continue;
      }
      filteredMethods[method] = operation;
    }

    if (Object.keys(filteredMethods).length > 0) {
      paths[pathKey] = filteredMethods;
    }
  }

  const tagSet = new Set();
  for (const pathMethods of Object.values(paths)) {
    for (const op of Object.values(pathMethods as AnyRecord)) {
      if (op.tags) op.tags.forEach((t) => tagSet.add(t));
    }
  }

  const generatedSchemas: AnyRecord = {};
  for (const [key, schemaDef] of Object.entries(schemas) as Array<[string, SchemaDefinition]>) {
    const schemaName = toPascalCase(key);
    const properties: AnyRecord = {};
    const required = [];

    for (const [field, rule] of Object.entries(schemaDef) as Array<[string, SchemaRule]>) {
      properties[field] = ruleToProperty(rule);
      if (rule.required) required.push(field);
    }

    generatedSchemas[schemaName] = {
      type: 'object',
      properties,
      ...(required.length > 0 && { required }),
    };
  }

  Object.assign(generatedSchemas, EXTRA_SCHEMAS);

  return {
    openapi: '3.0.0',
    info: {
      title: 'TCNS Backend API',
      version: '1.0.0',
      description:
        'Tài liệu OpenAPI cho hệ thống TCNS. Swagger được sinh tự động từ route, controller và schema, đồng bộ theo hành vi API thực tế.',
    },
    servers: [
      ...(process.env.BASE_URL ? [{ url: `${process.env.BASE_URL}/api`, description: 'Máy chủ production' }] : []),
      { url: `http://localhost:${process.env.PORT || 3000}/api`, description: 'Máy chủ local' },
    ],
    tags: Array.from(tagSet).map((name) => {
      const matched = Object.values(TAG_METADATA).find((item) => item.name === name);
      return matched ? { name, description: matched.description } : { name };
    }),
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

function setupSwagger(app: AnyRecord) {
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
      customSiteTitle: 'TCNS API - Swagger',
    }),
  );

  console.log('📚 Swagger Generator initialized');
  console.log(`   - Scanned ${Object.keys(spec.paths).length} endpoints`);
  console.log(`   - Tags: ${spec.tags.map((t) => t.name).join(', ')}`);
}

export { setupSwagger, buildSwaggerSpec };
