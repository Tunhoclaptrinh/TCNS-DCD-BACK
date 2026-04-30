import swaggerUi from 'swagger-ui-express';
import schemas from '@schemas';
import type { AnyRecord } from '@app-types/common';
import { logger } from './logger';
import type { SchemaDefinition, SchemaRule } from '@app-types/schema';

type SwaggerRouteDoc = {
  summary?: string;
  description?: string;
  tags?: string[];
  operationId?: string;
  parameters?: AnyRecord[];
  requestBody?: AnyRecord | null;
  responses?: AnyRecord;
  protected?: boolean;
  permission?: string;
  adminRole?: string;
  internal?: boolean;
};

function toPascalCase(value: string) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/(?:^|\s+)(\w)/g, (_, char: string) => char.toUpperCase())
    .replace(/\s+/g, '');
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
  const property: AnyRecord = {
    ...(typeof base === 'function' ? base(rule) : base || { type: 'string' }),
  };

  if (rule.description) property.description = rule.description;
  if (rule.minLength !== undefined) property.minLength = rule.minLength;
  if (rule.maxLength !== undefined) property.maxLength = rule.maxLength;
  if (rule.min !== undefined) property.minimum = rule.min;
  if (rule.max !== undefined) property.maximum = rule.max;
  if (rule.default !== undefined) property.default = rule.default;

  return property;
}

function buildObjectSchema(properties: AnyRecord, required: string[] = [], description?: string) {
  const schema: AnyRecord = {
    type: 'object',
    properties: { ...properties },
  };

  if (required.length > 0) schema.required = required;
  if (description) schema.description = description;

  return schema;
}

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

const userSchema = schemas.users as SchemaDefinition;
const notificationSettingsSchema = schemas.notification_settings as SchemaDefinition;
const dutySlotSchema = schemas.duty_slots as SchemaDefinition;
const rewardPenaltySchema = schemas.reward_penalties as SchemaDefinition;
const meetingSchema = schemas.meetings as SchemaDefinition;
const bonusCampaignSchema = schemas.bonus_campaigns as SchemaDefinition;
const bonusRegistrationSchema = schemas.bonus_registrations as SchemaDefinition;
const auditLogSchema = schemas.audit_logs as SchemaDefinition;

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
  files: {
    name: 'Kho tệp',
    description: 'Tra cứu metadata tệp đã lưu và đọc nội dung base64 khi cần.',
  },
  notifications: {
    name: 'Thông báo',
    description: 'Lấy danh sách thông báo, đánh dấu đã đọc và cập nhật cài đặt thông báo.',
  },
  duty: {
    name: 'Kíp trực',
    description: 'Quản lý lịch trực, đăng ký ca và xử lý yêu cầu đổi ca.',
  },
  'reward-penalties': {
    name: 'Thưởng phạt',
    description: 'Quản lý bản ghi thưởng phạt và thống kê tài chính liên quan.',
  },
  meetings: {
    name: 'Lịch họp',
    description: 'Quản lý lịch họp, điểm danh và xác nhận tham gia.',
  },
  'bonus-campaigns': {
    name: 'ĐRL, ĐƯT',
    description: 'Quản lý đợt cộng điểm, đăng ký thành viên, xét duyệt và xuất danh sách duyệt.',
  },
  'bonus-registrations': {
    name: 'Đăng ký cộng điểm',
    description: 'Quản lý danh sách đăng ký cộng điểm của thành viên.',
  },
  'audit-logs': {
    name: 'Audit Logs - Nhật ký hệ thống',
    description: 'Tra cứu lịch sử tác động của người dùng lên hệ thống.',
  },
  reports: {
    name: 'Báo cáo',
    description: 'Xuất báo cáo thống kê tổng hợp.',
  },
  generations: {
    name: 'Khóa/The',
    description: 'Quản lý danh sách các khóa học/khóa sinh viên.',
  },
  semesters: {
    name: 'Kỳ học',
    description: 'Quản lý danh sách các học kỳ trong hệ thống.',
  },
  roles: {
    name: 'Vai trò',
    description: 'Quản lý vai trò (RBAC) và phân quyền.',
  },
  permissions: {
    name: 'Quyền hạn',
    description: 'Tra cứu danh sách các quyền hạn có sẵn trong hệ thống.',
  },
};

const EXTRA_SCHEMAS: AnyRecord = {
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
  AuthForgotPasswordRequest: Object.assign(
    buildObjectSchema(
      {
        email: {
          type: 'string',
          format: 'email',
          description: 'Email tài khoản dùng để nhận OTP đặt lại mật khẩu.',
        },
      },
      ['email'],
      'Yêu cầu gửi OTP quên mật khẩu qua email.',
    ),
    {},
  ),
  AuthResetPasswordRequest: Object.assign(
    buildObjectSchema(
      {
        email: {
          type: 'string',
          format: 'email',
          description: 'Email tài khoản dùng để xác định OTP reset password.',
        },
        otp: {
          type: 'string',
          description: 'Mã OTP đã nhận.',
        },
        token: {
          type: 'string',
          description: 'Alias của field `otp`.',
        },
        newPassword: {
          type: 'string',
          format: 'password',
          description: 'Mật khẩu mới.',
        },
      },
      ['email', 'newPassword'],
      'Đặt lại mật khẩu bằng OTP gửi qua email. Có thể truyền mã qua field `otp` hoặc alias `token`.',
    ),
    {
      allOf: [{ anyOf: [{ required: ['otp'] }, { required: ['token'] }] }],
    },
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
  AuthRefreshTokenRequest: Object.assign(
    buildObjectSchema(
      {
        refreshToken: {
          type: 'string',
          description: 'Refresh token hợp lệ.',
        },
        token: {
          type: 'string',
          description: 'Alias của field `refreshToken`.',
        },
      },
      [],
      'Lấy access token mới từ refresh token. Có thể truyền qua field `refreshToken` hoặc alias `token`.',
    ),
    {
      anyOf: [{ required: ['refreshToken'] }, { required: ['token'] }],
    },
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
    buildPropertiesFromSchemaFields(
      pickFields(notificationSettingsSchema, [
        'shiftNotifications',
        'approvalNotifications',
        'systemNotifications',
        'emailNotifications',
        'smsNotifications',
      ]),
    ),
    [],
    'Cập nhật cài đặt thông báo của người dùng hiện tại.',
  ),
  DutySlotRequest: buildObjectSchema(
    buildPropertiesFromSchemaFields(omitFields(dutySlotSchema, ['createdBy'])),
    ['shiftDate', 'shiftLabel'],
    'Thông tin kíp trực. `weekStart` sẽ được tự suy ra từ `shiftDate` nếu không truyền.',
  ),
  DutySlotUpdateRequest: buildObjectSchema(
    buildPropertiesFromSchemaFields(omitFields(dutySlotSchema, ['createdBy'])),
    [],
    'Dữ liệu cập nhật kíp trực. Chỉ cần truyền các trường muốn thay đổi.',
  ),
  DutySwapRequest: buildObjectSchema(
    {
      dutySlotId: {
        type: 'number',
        description: 'ID kíp trực cần đổi.',
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
    'Tạo yêu cầu đổi kíp trực.',
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
    buildPropertiesFromSchemaFields(omitFields(rewardPenaltySchema, ['createdBy'])),
    ['userId', 'type', 'amount', 'reason'],
    'Tạo bản ghi thưởng hoặc phạt. `createdBy` được xác định từ người dùng đang đăng nhập.',
  ),
  RewardPenaltyUpdateRequest: buildObjectSchema(
    buildPropertiesFromSchemaFields(omitFields(rewardPenaltySchema, ['createdBy'])),
    [],
    'Cập nhật bản ghi thưởng hoặc phạt. Chỉ cần truyền các trường muốn thay đổi.',
  ),
  MeetingCreateRequest: buildObjectSchema(
    buildPropertiesFromSchemaFields(omitFields(meetingSchema, ['createdBy', 'updatedBy', 'confirmations'])),
    ['title', 'location', 'meetingAt'],
    'Tạo lịch họp mới và gửi thông báo đến các thành viên tham gia.',
  ),
  MeetingUpdateRequest: buildObjectSchema(
    buildPropertiesFromSchemaFields(omitFields(meetingSchema, ['createdBy', 'updatedBy', 'confirmations'])),
    [],
    'Cập nhật thông tin cuộc họp đã tạo.',
  ),
  MeetingRsvpRequest: buildObjectSchema(
    {
      status: {
        type: 'string',
        enum: ['accepted', 'declined'],
        description: 'Trạng thái phản hồi tham gia.',
      },
      reason: {
        type: 'string',
        description: 'Lý do khi từ chối tham gia.',
      },
    },
    ['status'],
    'Xác nhận tham gia họp của người dùng hiện tại.',
  ),
  BonusCampaignCreateRequest: buildObjectSchema(
    buildPropertiesFromSchemaFields(
      omitFields(bonusCampaignSchema, ['createdBy', 'updatedBy', 'maDot', 'createdAt', 'updatedAt']),
    ),
    ['semesterId', 'thoiGianBatDau', 'thoiGianKetThuc'],
    'Tạo đợt cộng điểm DRL/HB.',
  ),
  BonusCampaignUpdateRequest: buildObjectSchema(
    buildPropertiesFromSchemaFields(
      omitFields(bonusCampaignSchema, ['createdBy', 'updatedBy', 'maDot', 'createdAt', 'updatedAt']),
    ),
    [],
    'Cập nhật thông tin đợt cộng điểm.',
  ),
  BonusRegistrationUpdateRequest: buildObjectSchema(
    buildPropertiesFromSchemaFields(
      omitFields(bonusRegistrationSchema, ['campaignId', 'userId', 'registeredAt', 'createdAt', 'updatedAt']),
    ),
    [],
    'Dữ liệu cập nhật đăng ký cộng điểm.',
  ),
  BonusCampaignReviewRequest: buildObjectSchema(
    {
      approvedUserIds: {
        type: 'array',
        items: { type: 'number' },
        description: 'Danh sách ID thành viên được duyệt (nếu không truyền sẽ dùng danh sách đủ điều kiện tự động).',
      },
      approvedNote: {
        type: 'string',
        description: 'Ghi chú áp dụng cho thành viên được duyệt.',
      },
      rejectedNote: {
        type: 'string',
        description: 'Ghi chú áp dụng cho thành viên không được duyệt.',
      },
    },
    [],
    'Xét duyệt danh sách đăng ký cộng điểm của một đợt.',
  ),
  UploadAvatarRequest: {
    type: 'object',
    description: 'Payload upload avatar. Có thể dùng field `avatar` hoặc `image`.',
    properties: {
      avatar: {
        type: 'string',
        format: 'binary',
        description: 'Tệp ảnh avatar. Có thể dùng field `avatar` hoặc `image`.',
      },
      image: {
        type: 'string',
        format: 'binary',
        description: 'Alias của field `avatar`.',
      },
      storeData: {
        type: 'boolean',
        description: 'Nếu bật, metadata file sẽ lưu thêm chuỗi base64 vào DB.',
      },
    },
    anyOf: [{ required: ['avatar'] }, { required: ['image'] }],
  },
  UploadGeneralFileRequest: {
    type: 'object',
    description: 'Payload upload file chung. Có thể dùng field `file` hoặc `image`.',
    properties: {
      file: {
        type: 'string',
        format: 'binary',
        description: 'Tệp cần tải lên. Có thể là ảnh hoặc tài liệu thông thường.',
      },
      image: {
        type: 'string',
        format: 'binary',
        description: 'Alias tương thích ngược cho field `file` khi tải ảnh.',
      },
      storeData: {
        type: 'boolean',
        description: 'Nếu bật, metadata file sẽ lưu thêm chuỗi base64 vào DB.',
      },
    },
    anyOf: [{ required: ['file'] }, { required: ['image'] }],
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
      storeData: {
        type: 'boolean',
        description: 'Nếu bật, metadata file sẽ lưu thêm chuỗi base64 vào DB.',
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
        description: 'Mật khẩu mới.',
      },
      newPassword: {
        type: 'string',
        format: 'password',
        description: 'Alias của field `password` khi cập nhật người dùng.',
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
        description: 'Mật khẩu mới.',
      },
      newPassword: {
        type: 'string',
        format: 'password',
        description: 'Alias của field `password` khi cập nhật người dùng.',
      },
      avatar: {
        type: 'string',
        format: 'binary',
        description: 'Ảnh avatar mới.',
      },
      storeData: {
        type: 'boolean',
        description: 'Nếu bật, metadata file sẽ lưu thêm chuỗi base64 vào DB.',
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
        description: 'Tệp CSV/XLS/XLSX cần import.',
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

const ROUTE_DOCS: Record<string, SwaggerRouteDoc> = {
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
    description: 'Gửi mã OTP qua email để đặt lại mật khẩu.',
    requestBody: buildSchemaRefBody('AuthForgotPasswordRequest'),
    responses: {
      200: { description: 'Yêu cầu gửi OTP đã được tiếp nhận' },
      400: { description: 'Thiếu email hoặc email không hợp lệ' },
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
    protected: true,
  },
  'POST /auth/logout': {
    summary: 'Đăng xuất',
    description: 'Đăng xuất phiên hiện tại ở phía client.',
    protected: true,
  },
  'PUT /auth/change-password': {
    summary: 'Đổi mật khẩu',
    description: 'Đổi mật khẩu cho tài khoản đang đăng nhập.',
    protected: true,
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
      'Cập nhật thông tin hồ sơ của chính bạn. Dùng `application/json` khi cập nhật text hoặc URL avatar, và dùng `multipart/form-data` khi upload file avatar qua field `avatar`.',
    protected: true,
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
    protected: true,
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
    protected: true,
    permission: 'users:list',
    internal: true,
  },
  'POST /users/bulk': {
    summary: 'Thao tác hàng loạt người dùng',
    description: 'Hỗ trợ tạo, cập nhật hoặc xóa hàng loạt người dùng.',
    protected: true,
    permission: 'users:update',
    requestBody: buildSchemaRefBody('UserBulkRequest'),
    internal: true,
  },
  'POST /users/validate': {
    summary: 'Kiểm tra dữ liệu người dùng',
    description: 'Kiểm tra dữ liệu đầu vào theo schema người dùng.',
    protected: true,
    requestBody: buildSchemaRefBody('Users'),
    internal: true,
  },
  'POST /users': {
    summary: 'Tạo người dùng',
    description: 'Tạo tài khoản người dùng mới bằng dữ liệu quản trị.',
    protected: true,
    permission: 'users:create',
    requestBody: buildSchemaRefBody('Users'),
  },
  'PUT /users/{id}': {
    summary: 'Cập nhật người dùng',
    description:
      'Cập nhật thông tin người dùng theo ID. Dùng `application/json` khi cập nhật dữ liệu text/URL, và dùng `multipart/form-data` khi upload file avatar qua field `avatar`.',
    protected: true,
    permission: 'users:update',
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
  'DELETE /users/{id}': {
    summary: 'Xóa người dùng',
    description: 'Xóa mềm người dùng theo ID.',
    protected: true,
    permission: 'users:delete',
  },
  'GET /users': {
    summary: 'Danh sách người dùng',
    description: 'Lấy danh sách người dùng và hỗ trợ phân trang.',
    protected: true,
    permission: 'users:list',
  },
  'GET /users/stats/summary': {
    summary: 'Thống kê người dùng',
    description: 'Lấy thống kê tổng quan người dùng theo trạng thái, vai trò và phòng ban.',
    protected: true,
    permission: 'users:view_stats',
  },
  'PATCH /users/{id}/status': {
    summary: 'Cập nhật trạng thái người dùng',
    description: 'Bật hoặc tắt trạng thái hoạt động của người dùng theo ID.',
    protected: true,
    permission: 'users:manage_status',
  },
  'PATCH /users/{id}/promote': {
    summary: 'Cập nhật vai trò người dùng',
    description: 'Thay đổi vai trò của người dùng theo ID.',
    protected: true,
    permission: 'users:manage_rank',
    requestBody: buildSchemaRefBody('UserPromoteRequest'),
  },
  'PATCH /users/{id}/expel': {
    summary: 'Khai trừ người dùng',
    description: 'Đánh dấu người dùng bị khai trừ khỏi tổ chức.',
    protected: true,
    permission: 'users:expel',
    requestBody: buildSchemaRefBody('UserExpelRequest', false),
  },
  'DELETE /users/{id}/permanent': {
    summary: 'Xóa vĩnh viễn người dùng',
    description: 'Xóa cứng người dùng khỏi hệ thống.',
    protected: true,
    permission: 'users:delete',
  },
  'GET /users/template': {
    summary: 'Tải mẫu import người dùng',
    protected: true,
    permission: 'users:import_export',
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
    description: 'Cho phép quản trị viên tải lên tệp tin (CSV, Excel) để thêm mới hàng loạt thành viên vào hệ thống.',
    protected: true,
    permission: 'users:import_export',
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
    description: 'Kết xuất toàn bộ hoặc một phần danh sách thành viên ra tệp Excel/CSV để lưu trữ và báo cáo.',
    protected: true,
    permission: 'users:import_export',
    parameters: [
      {
        name: 'format',
        in: 'query',
        schema: { type: 'string', enum: ['csv', 'xlsx'], default: 'xlsx' },
        description: 'Định dạng tệp tin đầu ra.',
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
  'GET /users/{id}/activity': {
    summary: 'Lấy lịch sử hoạt động người dùng',
    description: 'Truy vấn nhật ký chi tiết các hành động mà một người dùng đã thực hiện trên hệ thống.',
    protected: true,
  },
  'GET /users/{id}': {
    summary: 'Chi tiết người dùng',
    description:
      'Lấy toàn bộ thông tin hồ sơ của một thành viên bao gồm: Họ tên, Email, Vai trò, Khóa học và Trạng thái.',
    protected: true,
  },

  'GET /notifications/settings': {
    summary: 'Lấy cài đặt thông báo',
    description: 'Xem cấu hình tùy chỉnh việc nhận thông báo qua các kênh (Hệ thống, Email) của cá nhân.',
    protected: true,
  },
  'PUT /notifications/settings': {
    summary: 'Cập nhật cài đặt thông báo',
    description: 'Thay đổi tùy chọn nhận thông báo cho từng loại sự kiện (Lịch trực mới, Lịch họp, Thưởng phạt...).',
    protected: true,
    requestBody: buildSchemaRefBody('NotificationSettingsUpdateRequest', false),
  },
  'GET /notifications': {
    summary: 'Lấy danh sách thông báo',
    description: 'Trả về danh sách các thông báo cá nhân, sắp xếp theo thời gian mới nhất.',
    protected: true,
  },
  'PATCH /notifications/{id}/read': {
    summary: 'Đánh dấu thông báo đã đọc',
    description: 'Cập nhật trạng thái "Đã đọc" cho một thông báo cụ thể.',
    protected: true,
  },
  'PATCH /notifications/read-all': {
    summary: 'Đánh dấu tất cả thông báo đã đọc',
    description: 'Hành động nhanh để chuyển toàn bộ thông báo chưa đọc sang trạng thái đã đọc.',
    protected: true,
  },
  'DELETE /notifications/{id}': {
    summary: 'Xóa thông báo',
    description: 'Gỡ bỏ một bản ghi thông báo khỏi danh sách cá nhân.',
    protected: true,
  },
  'DELETE /notifications': {
    summary: 'Xóa tất cả thông báo',
    description: 'Dọn sạch hoàn toàn hòm thư thông báo của người dùng.',
    protected: true,
  },
  'POST /upload/avatar': {
    summary: 'Tải ảnh đại diện',
    description: 'Tải ảnh lên Cloudinary và trả về URL. Hỗ trợ tự động tối ưu hóa kích thước và định dạng ảnh.',
    protected: true,
    requestBody: {
      required: true,
      content: {
        'multipart/form-data': {
          schema: { $ref: '#/components/schemas/UploadAvatarRequest' },
        },
      },
    },
  },
  'POST /upload/general': {
    summary: 'Tải tệp tin tổng hợp',
    description: 'Hỗ trợ tải nhiều loại định dạng (Image, PDF, Docx...). Tệp sẽ được lưu trữ an toàn trên Cloudinary.',
    protected: true,
    requestBody: {
      required: true,
      content: {
        'multipart/form-data': {
          schema: { $ref: '#/components/schemas/UploadGeneralFileRequest' },
        },
      },
    },
  },
  'DELETE /upload/file': {
    summary: 'Xóa tệp trên Cloud',
    description: 'Xóa vĩnh viễn tệp tin khỏi bộ nhớ Cloudinary dựa trên Public ID.',
    protected: true,
    adminRole: 'admin',
    parameters: [
      { name: 'publicId', in: 'query', schema: { type: 'string' }, description: 'Public ID duy nhất của tệp.' },
      {
        name: 'url',
        in: 'query',
        schema: { type: 'string' },
        description: 'URL đầy đủ (hệ thống sẽ tự bóc tách publicId).',
      },
    ],
  },
  'GET /upload/file/info': {
    summary: 'Lấy thông tin tệp trên Cloudinary',
    protected: true,
    adminRole: 'admin',
    internal: true,
    parameters: [
      { name: 'publicId', in: 'query', schema: { type: 'string' }, description: 'Public ID của asset.' },
      { name: 'url', in: 'query', schema: { type: 'string' }, description: 'URL đầy đủ của asset.' },
    ],
  },
  'GET /upload/stats': {
    summary: 'Thống kê dung lượng tệp',
    description: 'Thống kê số lượng và dung lượng tệp trên Cloudinary theo từng thư mục.',
    protected: true,
    adminRole: 'admin',
    internal: true,
  },
  'POST /upload/cleanup': {
    summary: 'Dọn dẹp tài nguyên thừa',
    description:
      'Quét và xóa các tệp tin "mồ côi" (không còn liên kết với dữ liệu database) để tiết kiệm dung lượng Cloud.',
    protected: true,
    adminRole: 'admin',
    internal: true,
    parameters: [
      {
        name: 'days',
        in: 'query',
        schema: { type: 'number', default: 30 },
        description: 'Số ngày tối thiểu tính từ khi tệp được tải lên để đưa vào danh sách dọn dẹp.',
      },
    ],
    requestBody: buildSchemaRefBody('UploadCleanupRequest', false),
  },

  'GET /files': {
    summary: 'Lấy danh sách metadata tệp',
    description: 'Trả về danh sách metadata tệp và thông tin lưu trữ của các tệp tin trên hệ thống.',
    protected: true,
    parameters: [
      {
        name: 'includeData',
        in: 'query',
        schema: { type: 'boolean', default: false },
        description: 'Nếu bật, response sẽ trả thêm field `data` base64.',
      },
    ],
  },
  'GET /files/{id}': {
    summary: 'Lấy chi tiết metadata tệp',
    description: 'Trả về thông tin chi tiết, đường dẫn và quyền truy cập của một tệp tin dựa trên ID.',
    protected: true,
    parameters: [
      {
        name: 'includeData',
        in: 'query',
        schema: { type: 'boolean', default: false },
        description: 'Nếu bật, response sẽ trả thêm field `data` base64.',
      },
    ],
  },

  'GET /duty/week': {
    summary: 'Lấy lịch trực theo tuần',
    description: 'Lấy danh sách kíp trực trong tuần theo `weekStart` và hỗ trợ phân trang.',
    protected: true,
    permission: 'duty:view',
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
    summary: 'Thống kê kíp trực',
    protected: true,
    permission: 'duty:view',
  },
  'POST /duty/slots': {
    summary: 'Tạo kíp trực',
    protected: true,
    permission: 'duty:manage',
    requestBody: buildSchemaRefBody('DutySlotRequest'),
    responses: {
      201: { description: 'Tạo kíp trực thành công' },
      400: { description: 'Dữ liệu không hợp lệ' },
    },
  },
  'PUT /duty/slots/{id}': {
    summary: 'Cập nhật kíp trực',
    protected: true,
    permission: 'duty:manage',
    requestBody: buildSchemaRefBody('DutySlotUpdateRequest', false),
  },
  'PATCH /duty/slots/{id}/register': {
    summary: 'Đăng ký vào kíp trực',
    description: 'Đăng ký người dùng hiện tại vào kíp trực theo ID.',
    protected: true,
    permission: 'duty:register',
  },
  'PATCH /duty/slots/{id}/cancel': {
    summary: 'Hủy đăng ký kíp trực',
    description: 'Hủy đăng ký kíp trực của người dùng hiện tại.',
    protected: true,
    permission: 'duty:update',
  },
  'POST /duty/swaps': {
    summary: 'Tạo yêu cầu đổi ca',
    protected: true,
    permission: 'duty:update',
    requestBody: buildSchemaRefBody('DutySwapRequest'),
    responses: {
      201: { description: 'Tạo yêu cầu đổi ca thành công' },
      400: { description: 'Dữ liệu không hợp lệ hoặc xung đột kíp trực' },
    },
  },
  'GET /duty/swaps': {
    summary: 'Lấy danh sách yêu cầu đổi ca',
    protected: true,
    permission: 'duty:view',
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
    protected: true,
    permission: 'duty:approve_swap',
    requestBody: buildSchemaRefBody('DutySwapDecisionRequest'),
  },

  'GET /reward-penalties': {
    summary: 'Lấy lịch sử thưởng phạt',
    protected: true,
    permission: 'reward_penalty:view',
  },
  'POST /reward-penalties': {
    summary: 'Tạo bản ghi thưởng phạt',
    protected: true,
    permission: 'reward_penalty:manage',
    requestBody: buildSchemaRefBody('RewardPenaltyCreateRequest'),
    responses: {
      201: { description: 'Tạo bản ghi thành công' },
      400: { description: 'Dữ liệu không hợp lệ' },
    },
  },
  'PUT /reward-penalties/{id}': {
    summary: 'Cập nhật bản ghi thưởng phạt',
    protected: true,
    permission: 'reward_penalty:manage',
    requestBody: buildSchemaRefBody('RewardPenaltyUpdateRequest', false),
    responses: {
      200: { description: 'Cập nhật bản ghi thành công' },
      400: { description: 'Dữ liệu không hợp lệ' },
      404: { description: 'Không tìm thấy bản ghi' },
    },
  },
  'GET /reward-penalties/stats/financial': {
    summary: 'Thống kê tài chính thưởng phạt',
    protected: true,
    permission: 'reward_penalty:view',
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

  'GET /meetings': {
    summary: 'Lấy danh sách lịch họp',
    protected: true,
    permission: 'duty:view',
  },
  'POST /meetings': {
    summary: 'Tạo lịch họp mới',
    protected: true,
    permission: 'duty:manage',
    requestBody: buildSchemaRefBody('MeetingCreateRequest'),
  },
  'GET /meetings/{id}': {
    summary: 'Lấy chi tiết cuộc họp',
    protected: true,
    permission: 'duty:view',
  },
  'PUT /meetings/{id}': {
    summary: 'Cập nhật thông tin cuộc họp',
    protected: true,
    permission: 'duty:manage',
    requestBody: buildSchemaRefBody('MeetingUpdateRequest', false),
  },
  'DELETE /meetings/{id}': {
    summary: 'Xóa cuộc họp',
    protected: true,
    permission: 'duty:manage',
  },
  'PATCH /meetings/{id}/rsvp': {
    summary: 'Xác nhận tham gia họp',
    protected: true,
    requestBody: buildSchemaRefBody('MeetingRsvpRequest'),
  },

  'GET /bonus-campaigns': {
    summary: 'Danh sách đợt cộng điểm',
    protected: true,
    permission: 'duty:view',
    parameters: [
      {
        name: 'openOnly',
        in: 'query',
        schema: { type: 'boolean', default: false },
        description: 'Chỉ lấy các đợt đang mở đăng ký.',
      },
    ],
  },
  'POST /bonus-campaigns': {
    summary: 'Tạo đợt cộng điểm mới',
    protected: true,
    permission: 'duty:manage',
    requestBody: buildSchemaRefBody('BonusCampaignCreateRequest'),
  },
  'GET /bonus-campaigns/{id}': {
    summary: 'Chi tiết đợt cộng điểm',
    protected: true,
    permission: 'duty:view',
  },
  'PUT /bonus-campaigns/{id}': {
    summary: 'Cập nhật đợt cộng điểm',
    protected: true,
    permission: 'duty:manage',
    requestBody: buildSchemaRefBody('BonusCampaignUpdateRequest'),
  },
  'DELETE /bonus-campaigns/{id}': {
    summary: 'Xóa đợt cộng điểm',
    protected: true,
    permission: 'duty:manage',
  },
  'PATCH /bonus-campaigns/{id}/register': {
    summary: 'Đăng ký tham gia đợt cộng điểm',
    protected: true,
    permission: 'duty:view',
  },
  'POST /bonus-campaigns/{id}/review': {
    summary: 'Xét duyệt danh sách đăng ký',
    protected: true,
    permission: 'duty:manage',
    requestBody: buildSchemaRefBody('BonusCampaignReviewRequest'),
  },
  'GET /bonus-campaigns/{id}/export': {
    summary: 'Xuất Excel danh sách đã duyệt',
    protected: true,
    permission: 'duty:manage',
  },

  'GET /audit-logs': {
    summary: 'Danh sách nhật ký hệ thống',
    description:
      'Truy vấn toàn bộ lịch sử tác động đến dữ liệu của hệ thống. Đây là công cụ quan trọng để kiểm soát bảo mật, cho phép biết rõ Ai đã làm gì, Vào lúc nào, Trên bản ghi nào và Trạng thái ra sao.',
    protected: true,
    permission: 'system:manage',
  },

  'GET /bonus-registrations': {
    summary: 'Danh sách đăng ký cộng điểm',
    protected: true,
  },
  'GET /bonus-registrations/{id}': {
    summary: 'Chi tiết bản đăng ký',
    protected: true,
  },
  'PUT /bonus-registrations/{id}': {
    summary: 'Cập nhật bản đăng ký',
    protected: true,
    permission: 'bonus-campaigns:review',
    requestBody: buildSchemaRefBody('BonusRegistrationUpdateRequest'),
  },
  'DELETE /bonus-registrations/{id}': {
    summary: 'Xóa bản đăng ký',
    protected: true,
    permission: 'bonus-campaigns:delete',
  },

  'GET /reports/overview': {
    summary: 'Lấy báo cáo tổng quan',
    description:
      'Truy xuất các chỉ số thống kê quan trọng của hệ thống (như số lượng thành viên, lượt đăng ký, tình hình thưởng phạt) để phục vụ công tác điều hành.',
    protected: true,
    permission: 'reports:view',
  },
  'GET /reports/export': {
    summary: 'Xuất báo cáo tổng quan',
    description: 'Xuất dữ liệu báo cáo ra file (CSV hoặc Excel) để lưu trữ hoặc phân tích ngoại tuyến.',
    protected: true,
    permission: 'reports:export',
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

  'GET /generations': {
    summary: 'Danh sách khóa học',
    description:
      'Truy vấn danh sách các Khóa học/Thế hệ thành viên trong hệ thống (ví dụ: K66, K67). Đây là tham số quan trọng để phân loại và lọc dữ liệu sinh viên.',
    protected: true,
    permission: 'generations:manage',
  },
  'GET /generations/{id}': {
    summary: 'Chi tiết khóa học',
    description: 'Xem thông tin chi tiết của một Khóa học cụ thể, bao gồm tên gọi và các mô tả liên quan.',
    protected: true,
    permission: 'generations:manage',
  },
  'POST /generations': {
    summary: 'Tạo khóa học mới',
    description: 'Khai báo một Khóa học/Thế hệ mới vào cơ sở dữ liệu dùng chung.',
    protected: true,
    permission: 'generations:manage',
    requestBody: buildSchemaRefBody('Generations'),
  },
  'PUT /generations/{id}': {
    summary: 'Cập nhật khóa học',
    description:
      'Sửa đổi thông tin của một khóa học. Lưu ý: Việc đổi tên khóa học sẽ ảnh hưởng đến hiển thị ở tất cả các module liên quan đến thành viên.',
    protected: true,
    permission: 'generations:manage',
    requestBody: buildSchemaRefBody('Generations', false),
  },
  'DELETE /generations/{id}': {
    summary: 'Xóa khóa học',
    description: 'Gỡ bỏ hoàn toàn một khóa học. Chỉ thực hiện được nếu không còn thành viên nào thuộc khóa này.',
    protected: true,
    permission: 'generations:manage',
  },
  'PATCH /generations/{id}/set-current': {
    summary: 'Đặt khóa học hiện tại',
    description:
      'Thiết lập một khóa học là "Khóa hiện tại". Các bộ lọc mặc định trên toàn hệ thống sẽ ưu tiên hiển thị dữ liệu của khóa này.',
    protected: true,
    permission: 'generations:manage',
  },

  'GET /roles': {
    summary: 'Danh sách vai trò',
    description: 'Truy vấn danh sách các Vai trò (Roles) có trong hệ thống cùng các quyền hạn đi kèm của từng vai trò.',
    protected: true,
    permission: 'system:manage_roles',
  },
  'GET /roles/{id}': {
    summary: 'Chi tiết vai trò',
    description: 'Xem thông tin chi tiết và tập hợp các Permission Key được gán cho vai trò này.',
    protected: true,
    permission: 'system:manage_roles',
  },
  'POST /roles': {
    summary: 'Tạo vai trò mới',
    description:
      'Khởi tạo một vai trò mới. Cho phép định nghĩa các quyền hạn mà vai trò này được phép thực hiện trên hệ thống.',
    protected: true,
    permission: 'system:manage_roles',
    requestBody: buildSchemaRefBody('Roles'),
  },
  'PUT /roles/{id}': {
    summary: 'Cập nhật vai trò',
    description:
      'Chỉnh sửa thông tin vai trò hoặc thay đổi danh sách quyền hạn. Thay đổi sẽ có hiệu lực ngay khi người dùng thực hiện yêu cầu tiếp theo.',
    protected: true,
    permission: 'system:manage_roles',
    requestBody: buildSchemaRefBody('Roles', false),
  },
  'PATCH /roles/{id}': {
    summary: 'Cập nhật một phần vai trò',
    description: 'Cập nhật một vài trường thông tin cụ thể của vai trò.',
    protected: true,
    permission: 'system:manage_roles',
    requestBody: buildSchemaRefBody('Roles', false),
  },
  'DELETE /roles/{id}': {
    summary: 'Xóa vai trò',
    description: 'Gỡ bỏ vai trò khỏi hệ thống. Hệ thống sẽ ngăn chặn nếu vai trò này đang được gán cho người dùng.',
    protected: true,
    permission: 'system:manage_roles',
  },

  'GET /permissions': {
    summary: 'Danh sách quyền hạn',
    description:
      'Lấy danh mục tất cả các mã quyền (Permission Keys) khả dụng. Đây là các đơn vị quyền nhỏ nhất được dùng để cấu thành Vai trò.',
    protected: true,
    permission: 'system:manage_roles',
  },
  'GET /permissions/{id}': {
    summary: 'Chi tiết quyền hạn',
    description: 'Xem mô tả chi tiết của một quyền hạn cụ thể.',
    protected: true,
    permission: 'system:manage_roles',
  },
  'POST /permissions': {
    summary: 'Tạo quyền hạn mới',
    description: 'Khai báo một mã quyền hạn mới vào hệ thống quản lý.',
    protected: true,
    permission: 'system:manage_roles',
    requestBody: buildSchemaRefBody('Permissions'),
  },
  'PUT /permissions/{id}': {
    summary: 'Cập nhật quyền hạn',
    description: 'Sửa đổi tên hiển thị hoặc thông tin mô tả của mã quyền.',
    protected: true,
    permission: 'system:manage_roles',
    requestBody: buildSchemaRefBody('Permissions', false),
  },
  'DELETE /permissions/{id}': {
    summary: 'Xóa quyền hạn',
    description: 'Gỡ bỏ mã quyền khỏi hệ thống.',
    protected: true,
    permission: 'system:manage_roles',
  },

  'GET /semesters': {
    summary: 'Danh sách học kỳ',
    description:
      'Truy vấn toàn bộ lịch sử các học kỳ. Giúp người dùng có thể lọc dữ liệu theo từng giai đoạn thời gian cụ thể.',
    protected: true,
    permission: 'settings:view',
  },
  'GET /semesters/{id}': {
    summary: 'Chi tiết học kỳ',
    description: 'Xem thông tin chi tiết về thời gian bắt đầu và kết thúc của một học kỳ.',
    protected: true,
    permission: 'settings:view',
  },
  'POST /semesters': {
    summary: 'Tạo học kỳ mới',
    description:
      'Thiết lập một học kỳ mới. Lưu ý: Chỉ nên có một học kỳ Active tại một thời điểm để đảm bảo tính nhất quán của dữ liệu.',
    protected: true,
    permission: 'settings:manage',
    requestBody: buildSchemaRefBody('Semesters'),
  },
  'PUT /semesters/{id}': {
    summary: 'Cập nhật học kỳ',
    description: 'Sửa đổi thông tin cấu hình của học kỳ.',
    protected: true,
    permission: 'settings:manage',
    requestBody: buildSchemaRefBody('Semesters', false),
  },
  'DELETE /semesters/{id}': {
    summary: 'Xóa học kỳ',
    description: 'Gỡ bỏ học kỳ khỏi hệ thống. Hệ thống sẽ ngăn chặn nếu đã có dữ liệu liên quan gắn với học kỳ này.',
    protected: true,
    permission: 'settings:manage',
  },
  'PATCH /semesters/{id}/set-current': {
    summary: 'Đặt học kỳ hiện tại',
    description: 'Kích hoạt một học kỳ làm mốc thời gian hiện tại cho toàn bộ ứng dụng.',
    protected: true,
    permission: 'settings:manage',
  },
};

const LIST_ROUTE_KEYS = new Set([
  'GET /users',
  'GET /files',
  'GET /notifications',
  'GET /reward-penalties',
  'GET /duty/swaps',
  'GET /meetings',
  'GET /bonus-campaigns',
  'GET /audit-logs',
]);

const SUMMARY_MAP: Array<[RegExp, string, (entity: string) => string]> = [
  [/^\/$/, 'get', (entity) => `Danh sách ${entity}`],
  [/^\/$/, 'post', (entity) => `Tạo ${entity}`],
  [/^\/$/, 'delete', (entity) => `Xoá tất cả ${entity}`],
  [/^\/:id$/, 'get', (entity) => `Chi tiết ${entity}`],
  [/^\/:id$/, 'put', (entity) => `Cập nhật ${entity}`],
  [/^\/:id$/, 'delete', (entity) => `Xoá ${entity}`],
  [/^\/:id\/status$/, 'patch', (entity) => `Cập nhật trạng thái ${entity}`],
  [/^\/:id\/permanent$/, 'delete', (entity) => `Xoá vĩnh viễn ${entity}`],
  [/^\/:id\/activity$/, 'get', (entity) => `Lịch sử hoạt động ${entity}`],
  [/^\/:id\/read$/, 'patch', () => 'Đánh dấu đã đọc'],
  [/^\/read-all$/, 'patch', () => 'Đánh dấu tất cả đã đọc'],
  [/^\/profile$/, 'put', () => 'Cập nhật profile'],
  [/^\/template$/, 'get', (entity) => `Tải template import ${entity}`],
  [/^\/import$/, 'post', (entity) => `Import ${entity} từ file`],
  [/^\/export$/, 'get', (entity) => `Export ${entity}`],
  [/^\/stats/, 'get', (entity) => `Thống kê ${entity}`],
  [/^\/cleanup$/, 'post', (entity) => `Dọn dẹp ${entity}`],
  [/^\/me$/, 'get', () => 'Thông tin tài khoản hiện tại'],
];

function getTagMetadata(basePath: string) {
  return (
    TAG_METADATA[basePath] || {
      name: toPascalCase(basePath),
      description: `API cho nhóm ${basePath}.`,
    }
  );
}

function buildDefaultSummary(method: string, routePattern: string, basePath: string) {
  const entity = getTagMetadata(basePath).name.toLowerCase();

  for (const [pattern, expectedMethod, getSummary] of SUMMARY_MAP) {
    if (pattern.test(routePattern) && expectedMethod === method) {
      return getSummary(entity);
    }
  }

  return `${method.toUpperCase()} ${routePattern}`;
}

function parseRouteKey(routeKey: string) {
  const match = routeKey.match(/^([A-Z]+)\s+(.+)$/);
  if (!match) {
    throw new Error(`Invalid route key: ${routeKey}`);
  }

  const method = match[1].toLowerCase();
  const openApiPath = match[2];
  const pathParts = openApiPath.split('/').filter(Boolean);
  const basePath = pathParts[0] || '';
  const routePath = pathParts.length > 1 ? `/${pathParts.slice(1).join('/')}` : '/';
  const routePattern = routePath.replace(/\{(\w+)\}/g, ':$1');

  return { method, openApiPath, basePath, routePattern };
}

function buildOperationId(method: string, openApiPath: string) {
  const normalizedPath = openApiPath
    .replace(/[{}]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return `${method}_${normalizedPath}`;
}

function buildPathParameters(openApiPath: string) {
  return Array.from(openApiPath.matchAll(/\{(\w+)\}/g)).map((match) => {
    const name = match[1];
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
  if (!LIST_ROUTE_KEYS.has(routeKey)) return [];

  return [
    {
      name: '_page',
      in: 'query',
      schema: { type: 'integer', default: 1, minimum: 1 },
      description: 'Trang hiện tại. Alias: `page`.',
    },
    {
      name: '_limit',
      in: 'query',
      schema: { type: 'integer', default: 10, minimum: 1, maximum: 1000 },
      description: 'Số bản ghi mỗi trang. Alias: `limit`.',
    },
    {
      name: '_sort',
      in: 'query',
      schema: { type: 'string', example: 'createdAt' },
      description: 'Field sắp xếp. Có thể truyền nhiều field, cách nhau bằng dấu phẩy. Alias: `sort`.',
    },
    {
      name: '_order',
      in: 'query',
      schema: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
      description: 'Thứ tự sắp xếp. Alias: `order`.',
    },
    {
      name: 'q',
      in: 'query',
      schema: { type: 'string' },
      description: 'Từ khóa tìm kiếm tự do. Alias: `_q`.',
    },
  ];
}

function mergeParameters(...groups: AnyRecord[][]) {
  const merged: AnyRecord[] = [];
  const seen = new Set();

  for (const group of groups) {
    for (const parameter of group || []) {
      const key = `${parameter.in}:${parameter.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(parameter);
    }
  }

  return merged;
}

function buildDefaultResponses(method: string, routePattern: string) {
  const successCode = method === 'post' && (routePattern === '/' || routePattern === '/register') ? 201 : 200;

  return {
    [successCode]: { description: successCode === 201 ? 'Tạo mới thành công' : 'Thành công' },
    400: { description: 'Dữ liệu không hợp lệ' },
  };
}

function buildSwaggerPaths(includeInternal: boolean) {
  const paths: AnyRecord = {};

  for (const [routeKey, doc] of Object.entries(ROUTE_DOCS)) {
    if (!includeInternal && doc.internal) {
      continue;
    }

    const { method, openApiPath, basePath, routePattern } = parseRouteKey(routeKey);
    const tag = getTagMetadata(basePath);
    const requiresAuth = Boolean(doc.protected || doc.permission || doc.adminRole);
    const operation: AnyRecord = {
      tags: doc.tags || [tag.name],
      summary: doc.summary || buildDefaultSummary(method, routePattern, basePath),
      operationId: doc.operationId || buildOperationId(method, openApiPath),
      responses: {
        ...buildDefaultResponses(method, routePattern),
        ...(doc.responses || {}),
      },
    };

    if (requiresAuth) {
      operation.security = [{ bearerAuth: [] }];
      if (!operation.responses['401']) {
        operation.responses['401'] = { description: 'Chưa đăng nhập' };
      }
    }

    if (doc.permission || doc.adminRole) {
      if (!operation.responses['403']) {
        operation.responses['403'] = { description: 'Không có quyền truy cập' };
      }
    }

    const descriptionParts = [];
    if (doc.description) descriptionParts.push(doc.description);
    if (requiresAuth) descriptionParts.push('Yêu cầu xác thực bằng Bearer token.');
    if (doc.adminRole) descriptionParts.push(`Yêu cầu vai trò: \`${doc.adminRole}\`.`);
    if (doc.permission) descriptionParts.push(`Yêu cầu permission: \`${doc.permission}\`.`);
    if (doc.internal) descriptionParts.push('API nội bộ/hỗ trợ vận hành. Mặc định được ẩn khỏi Swagger public.');
    if (descriptionParts.length > 0) {
      operation.description = descriptionParts.join(' | ');
    }

    if (doc.requestBody) {
      operation.requestBody = doc.requestBody;
    }

    const parameters = mergeParameters(
      buildPathParameters(openApiPath),
      doc.parameters || [],
      buildDefaultListParameters(routeKey),
    );

    if (parameters.length > 0) {
      operation.parameters = parameters;
    }

    if (!paths[openApiPath]) {
      paths[openApiPath] = {};
    }

    paths[openApiPath][method] = operation;
  }

  return paths;
}

function buildSwaggerSpec() {
  const includeInternal = String(process.env.SWAGGER_INCLUDE_INTERNAL || 'false') === 'true';
  const paths = buildSwaggerPaths(includeInternal);
  const tagSet = new Set<string>();

  for (const pathMethods of Object.values(paths)) {
    for (const operation of Object.values(pathMethods as AnyRecord)) {
      if (operation.tags) {
        operation.tags.forEach((tagName: string) => tagSet.add(tagName));
      }
    }
  }

  const generatedSchemas: AnyRecord = {};

  for (const [schemaKey, schemaDef] of Object.entries(schemas) as Array<[string, SchemaDefinition]>) {
    const schemaName = toPascalCase(schemaKey);
    const properties: AnyRecord = {};
    const required: string[] = [];

    for (const [field, rule] of Object.entries(schemaDef) as Array<[string, SchemaRule]>) {
      properties[field] = ruleToProperty(rule);
      if (rule.required) required.push(field);
    }

    generatedSchemas[schemaName] = {
      type: 'object',
      properties,
      ...(required.length > 0 ? { required } : {}),
    };
  }

  Object.assign(generatedSchemas, EXTRA_SCHEMAS);

  return {
    openapi: '3.0.0',
    info: {
      title: 'TCNS Backend API',
      version: '1.0.0',
      description: 'Tài liệu OpenAPI cho hệ thống TCNS. Swagger được khai báo tĩnh để bám sát tài liệu mong muốn.',
    },
    servers: [
      ...(process.env.BASE_URL ? [{ url: `${process.env.BASE_URL}/api`, description: 'Máy chủ production' }] : []),
      { url: `http://localhost:${process.env.PORT || 3000}/api`, description: 'Máy chủ local' },
    ],
    tags: Array.from(tagSet).map((tagName) => {
      const matched = Object.values(TAG_METADATA).find((item) => item.name === tagName);
      return matched ? { name: tagName, description: matched.description } : { name: tagName };
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

function setupSwagger(app: AnyRecord) {
  const spec = buildSwaggerSpec();

  app.get('/api-docs.json', (_req, res) => res.json(spec));

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

  logger.info('Swagger initialized', 'SERVER');
  logger.info(`   - Declared ${Object.keys(spec.paths).length} paths`, 'SERVER');
  logger.info(`   - Tags: ${spec.tags.map((tag: { name: string }) => tag.name).join(', ')}`, 'SERVER');
}

export { setupSwagger, buildSwaggerSpec };
