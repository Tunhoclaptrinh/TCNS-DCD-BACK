import BaseService from '@shared/common/base-service';
import db from '@database/mongo-database.adapter';
import usersRepository from '@modules/users/repositories/users.repository';
import generationsRepository from '@modules/generations/repositories/generations.repository';
import notificationsRepository from '@modules/notifications/repositories/notifications.repository';
import rewardPenaltiesRepository from '@modules/reward-penalties/repositories/reward-penalties.repository';
import dutySlotsRepository from '@modules/duty/repositories/duty-slots.repository';
import dutySwapRequestsRepository from '@modules/duty/repositories/duty-swap-requests.repository';
import { hashPassword } from '@utils/auth.utils';
import { sanitizeUser } from '@utils/user.utils';
import ApiError from '@utils/api-error';
import userSchema from '@modules/users/schemas/user.schema';
import notificationService from '@modules/notifications/services/notification.service';
import auditLogsService from '@modules/audit-logs/services/audit-logs.service';
import { getSuggestedRoles } from '../utils/user-mapping.utils';
import type { AnyRecord, Identifier } from '@app-types/common';
import type { QueryOptions } from '@app-types/database';

function generateAvatarUrl(name: string) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
}

type UserRecord = {
  id: Identifier;
  role?: string;
  expelled?: boolean;
  isActive?: boolean;
  position?: string;
  status?: string;
  department?: string;
  createdAt?: string;
  lastLogin?: string;
  name?: string;
  avatar?: string;
  firstName?: string;
  lastName?: string;
};
type UserStatItem = {
  total: number;
  active: number;
  locked: number;
  inactive: number;
  dismissed: number;
  ctv: number;
  official: number;
  management: number;
  alumni: number;
  recentSignups: number;
  byRole: Record<string, number>;
  byPosition: Record<string, number>;
  byGeneration: Record<string, number>;
};
type UserStats = {
  global: UserStatItem;
  byDepartment: Record<string, UserStatItem>;
};

function createUserStatItem(): UserStatItem {
  return {
    total: 0,
    active: 0,
    locked: 0,
    inactive: 0,
    dismissed: 0,
    ctv: 0,
    official: 0,
    management: 0,
    alumni: 0,
    recentSignups: 0,
    byRole: {},
    byPosition: {},
    byGeneration: {},
  };
}

function processUserStats(item: UserStatItem, user: any, weekAgo: Date) {
  item.total++;

  const isAlumni = Boolean(user.isAlumni);
  const isLocked = user.isActive === false;
  const isDismissed = user.status === 'dismissed';
  const isInactive = user.status === 'inactive';
  // 'active' reflects membership status only — account lock (isActive) is tracked separately.
  // A member can be active in the club but have their login account disabled.
  const isActive = !isAlumni && user.status === 'active';

  if (isAlumni) {
    item.alumni++;
  }
  if (isLocked) {
    item.locked++;
  }
  if (isDismissed) {
    item.dismissed++;
  } else if (isInactive) {
    item.inactive++;
  }

  if (isActive) {
    item.active++;
    if (user.position === 'ctv') {
      item.ctv++;
    } else if (user.position) {
      // Only count as official if they have an explicit position set (not null/undefined)
      // Members with no position fall into the 'others' tab and are counted in active but not official
      item.official++;
    }

    // Ban quản lý (Active management positions/roles: Đội trưởng, Trưởng ban, Phó ban, Thành viên ban)
    const mgmtPositions = [
      'dt',
      'tb',
      'pb',
      'tvb',
      'ns_leader',
      'ns_sub_leader',
      'tc_leader',
      'tc_sub_leader',
      'tt_leader',
      'tt_sub_leader',
      'other_leader',
      'other_sub_leader',
    ];
    const userRole = user.role || '';
    const isManagement =
      mgmtPositions.includes(user.position) || mgmtPositions.includes(userRole) || userRole === 'admin';
    if (isManagement) {
      item.management++;
    }

    // Track position/generation breakdown for ACTIVE members only — consistent with official/ctv/management
    if (user.position) {
      item.byPosition[user.position] = (item.byPosition[user.position] || 0) + 1;
    }
    if (user.generationId) {
      const genId = String(user.generationId);
      item.byGeneration[genId] = (item.byGeneration[genId] || 0) + 1;
    }
  }

  if (user.createdAt && new Date(user.createdAt) >= weekAgo) {
    item.recentSignups++;
  }
}

function getAssignedUserIds(slot: { assignedUserIds?: Identifier[] }): Identifier[] {
  return slot.assignedUserIds || [];
}

class UserService extends BaseService {
  constructor() {
    super('users', usersRepository);
  }

  async prepareExportData(options: QueryOptions = {}) {
    const result = await super.prepareExportData({ ...options, includeRelations: true });
    let data = Array.isArray(result) ? result : [];

    const generations = await generationsRepository.findAll();
    const genMap = new Map(generations.map((g) => [Number(g.id), g.name]));

    return data.map((item: any) => {
      const exportItem = { ...item };
      delete exportItem.password;

      // ─── Generation name (join) ───
      const genName = item.generationId ? genMap.get(Number(item.generationId)) : null;
      const displayGen = genName || item.generation_name || item.generationId;
      if (displayGen) {
        exportItem.generationId = displayGen;
        exportItem.generation_name = displayGen;
      }

      // ─── Role names (join) ───
      if (exportItem.roles_names) {
        exportItem.roleIds = Array.isArray(exportItem.roles_names)
          ? exportItem.roles_names.join(', ')
          : exportItem.roles_names;
      }

      // ─── Date formatting: dd/mm/yyyy ───
      ['dob', 'joinDate'].forEach((dateKey) => {
        if (exportItem[dateKey]) {
          try {
            const date = new Date(exportItem[dateKey]);
            if (!isNaN(date.getTime())) {
              const d = String(date.getDate()).padStart(2, '0');
              const m = String(date.getMonth() + 1).padStart(2, '0');
              const y = date.getFullYear();
              exportItem[dateKey] = `${d}/${m}/${y}`;
            }
          } catch (e) {}
        }
      });

      if (!exportItem.note && exportItem.notes) {
        exportItem.note = exportItem.notes;
      }

      return exportItem;
    });
  }

  normalizeUserId(userId: Identifier) {
    const parsedUserId = Number(userId);
    return Number.isNaN(parsedUserId) ? userId : parsedUserId;
  }

  extractActorId(actor?: AnyRecord | Identifier) {
    if (actor && typeof actor === 'object') {
      return actor.id as Identifier;
    }

    return actor;
  }

  toAuditUserId(actor?: AnyRecord | Identifier, fallback?: Identifier) {
    const candidate = this.extractActorId(actor) ?? fallback;
    const normalized = Number(candidate);
    return Number.isFinite(normalized) ? normalized : 0;
  }

  getUserDisplayName(user: AnyRecord = {}) {
    return String(user.name || user.email || user.studentId || user.id || 'unknown');
  }

  async create(data: AnyRecord, performer?: AnyRecord | Identifier) {
    if (data.position && ['dt', 'ctv', 'tv'].includes(data.position as string)) {
      data.department = null;
    }

    if (data.position && data.roleIds === undefined) {
      data.roleIds = getSuggestedRoles(data.position as string, data.department as string);
    }

    const result = await super.create(data);

    if (result.success && result.data) {
      const createdUser = result.data as AnyRecord;
      await auditLogsService.log({
        userId: this.toAuditUserId(performer, createdUser.id as Identifier),
        action: 'THÊM NGƯỜI DÙNG',
        module: 'USERS',
        description: `Tạo người dùng ${this.getUserDisplayName(createdUser)}`,
        resourceId: String(createdUser.id),
      });
    }

    return result;
  }

  async update(id: Identifier, data: AnyRecord, performer?: AnyRecord | Identifier) {
    const existingUser = (await this.repository.findById(id)) as UserRecord;
    if (existingUser) {
      const position = data.position !== undefined ? data.position : existingUser.position;
      let department = data.department !== undefined ? data.department : existingUser.department;

      if (position && ['dt', 'ctv', 'tv'].includes(position as string)) {
        data.department = null;
        department = null;
      }

      // Tự động đồng bộ quyền nếu có thay đổi chức vụ mà không truyền roleIds
      if (data.position !== undefined && data.roleIds === undefined) {
        data.roleIds = getSuggestedRoles(position as string, department as string);
      }
    }

    const result = await super.update(id, data);

    if (result.success && result.data) {
      const updatedUser = result.data as AnyRecord;
      await auditLogsService.log({
        userId: this.toAuditUserId(performer, updatedUser.id as Identifier),
        action: 'CẬP NHẬT NGƯỜI DÙNG',
        module: 'USERS',
        description: `Cập nhật người dùng ${this.getUserDisplayName(updatedUser)}`,
        resourceId: String(updatedUser.id),
      });
    }

    return result;
  }

  async findUserOrThrow(userId: Identifier) {
    const user = (await this.repository.findById(userId)) as UserRecord | null;
    if (!user) {
      throw ApiError.notFound('Không tìm thấy người dùng');
    }
    return user;
  }

  async deleteUserNotifications(userId: Identifier) {
    const notifications = await notificationsRepository.findAllByUserId(userId);
    await Promise.all(notifications.map((item) => notificationsRepository.delete(item.id)));
    await notificationsRepository.deleteAllSettingsByUserId(userId);
    return notifications.length;
  }

  async deleteUserRewardPenalties(userId: Identifier) {
    const rewardPenaltiesByUser = await rewardPenaltiesRepository.findByUserId(userId);
    const rewardPenaltiesByCreator = await rewardPenaltiesRepository.findByCreatorId(userId);
    const rewardPenaltyMap = new Map<Identifier, AnyRecord>();

    for (const item of [...rewardPenaltiesByUser, ...rewardPenaltiesByCreator]) {
      rewardPenaltyMap.set(item.id, item);
    }

    await Promise.all([...rewardPenaltyMap.values()].map((item) => rewardPenaltiesRepository.delete(item.id)));
  }

  async deleteUserSwapRequests(userId: Identifier) {
    const swapByRequester = await dutySwapRequestsRepository.findMany({ requesterId: userId });
    const swapByTarget = await dutySwapRequestsRepository.findMany({ targetUserId: userId });
    const swapByApprover = await dutySwapRequestsRepository.findMany({ approvedBy: userId });
    const swapMap = new Map<Identifier, AnyRecord>();

    for (const item of [...swapByRequester, ...swapByTarget, ...swapByApprover]) {
      swapMap.set(item.id, item);
    }

    await Promise.all([...swapMap.values()].map((item) => dutySwapRequestsRepository.delete(item.id)));
  }

  async removeUserFromDutySlots(userId: Identifier) {
    const dutySlots = await dutySlotsRepository.findAll();
    const slotUpdates: Promise<unknown>[] = [];

    for (const slot of dutySlots) {
      const assignedUserIds = getAssignedUserIds(slot);
      const filtered = assignedUserIds.filter((id) => Number(id) !== Number(userId));

      if (filtered.length !== assignedUserIds.length) {
        slotUpdates.push(
          dutySlotsRepository.update(slot.id, {
            assignedUserIds: filtered,
            updatedAt: new Date().toISOString(),
          }),
        );
      }
    }

    if (slotUpdates.length > 0) {
      await Promise.all(slotUpdates);
    }
  }

  getSchema() {
    return userSchema;
  }

  async validateUniqueFields(data: AnyRecord, excludeId?: Identifier) {
    const errors: string[] = [];

    if (data.email) {
      const existingEmail = await this.repository.findOne({ email: data.email });
      if (existingEmail && (excludeId === undefined || String(existingEmail.id) !== String(excludeId))) {
        errors.push(`Email '${data.email}' đã tồn tại`);
      }
    }

    if (data.studentId) {
      const existingStudentId = await this.repository.findOne({ studentId: data.studentId });
      if (existingStudentId && (excludeId === undefined || String(existingStudentId.id) !== String(excludeId))) {
        errors.push(`Mã sinh viên '${data.studentId}' đã tồn tại`);
      }
    }

    return errors;
  }

  async validateCreate(data: AnyRecord) {
    const errors = await this.validateUniqueFields(data);
    if (errors.length > 0) {
      return { success: false, message: errors.join('. '), errors };
    }
    return { success: true };
  }

  async validateUpdate(id: Identifier, data: AnyRecord) {
    const errors = await this.validateUniqueFields(data, id);
    if (errors.length > 0) {
      return { success: false, message: errors.join('. '), errors };
    }
    return { success: true };
  }

  async beforeCreate(data: AnyRecord) {
    const transformed = this.transformBySchema(data);

    if (transformed.password) {
      transformed.password = await hashPassword(transformed.password);
    }

    if (transformed.firstName || transformed.lastName) {
      transformed.name = `${transformed.lastName || ''} ${transformed.firstName || ''}`.trim();
    }

    if (!transformed.avatar && transformed.name) {
      transformed.avatar = generateAvatarUrl(transformed.name);
    }

    // Auto-sync roles based on position if roleIds are not provided
    if (!transformed.roleIds || (Array.isArray(transformed.roleIds) && transformed.roleIds.length === 0)) {
      transformed.roleIds = getSuggestedRoles(transformed.position as string, transformed.department as string);
    }

    return {
      ...transformed,
      isActive: transformed.isActive !== undefined ? transformed.isActive : true,
      status: transformed.status || 'active',
    };
  }

  async beforeUpdate(id: Identifier, data: AnyRecord) {
    const payload = { ...data };

    if (payload.newPassword) {
      payload.password = await hashPassword(payload.newPassword);
      delete payload.newPassword;
    } else if (payload.password) {
      payload.password = await hashPassword(payload.password);
    }

    // Optional: Auto-sync roles if position/department changed AND roleIds were not explicitly sent
    if (
      (payload.position || payload.department) &&
      (!payload.roleIds || (Array.isArray(payload.roleIds) && payload.roleIds.length === 0))
    ) {
      const current = (await this.repository.findById(id)) as UserRecord;
      if (current) {
        const pos = (payload.position as string) || current.position;
        const dept = (payload.department as string) || current.department;
        payload.roleIds = getSuggestedRoles(pos, dept);
      }
    }

    if (payload.firstName || payload.lastName) {
      const current = (await this.repository.findById(id)) as UserRecord;
      if (current) {
        const lastName = payload.lastName !== undefined ? payload.lastName : current.lastName;
        const firstName = payload.firstName !== undefined ? payload.firstName : current.firstName;

        // Neu name trong payload hien tai dang bi trong hoac khong co, moi tu dong generate tu ho ten.
        // Dieu nay de tranh viec ghi de username (name) neu nguoi dung da co tinh dat khac.
        if (!payload.name) {
          payload.name = `${lastName || ''} ${firstName || ''}`.trim();
        }
      }
    }

    // Luon whitelist theo schema de field noi bo tu controller khong bi luu nham vao user.
    const transformed = this.transformBySchema(payload);

    return {
      ...transformed,
    };
  }

  private cachedImportPasswordConfig: { strategy: string; fixedValue: string; time: number } | null = null;

  private async getImportPasswordConfig(): Promise<{ strategy: string; fixedValue: string }> {
    const now = Date.now();
    if (this.cachedImportPasswordConfig && now - this.cachedImportPasswordConfig.time < 5000) {
      return this.cachedImportPasswordConfig;
    }
    const Model = (db as any).getModel('system_settings');
    let strategy = 'fixed';
    let fixedValue = process.env.DEFAULT_IMPORT_PASSWORD || 'TCNS@2026';
    if (Model) {
      const docs = await Model.find({
        key: { $in: ['DEFAULT_IMPORT_PASSWORD_STRATEGY', 'DEFAULT_IMPORT_PASSWORD'] },
      }).lean();
      docs.forEach((doc: any) => {
        if (doc.key === 'DEFAULT_IMPORT_PASSWORD_STRATEGY' && doc.value) strategy = doc.value;
        if (doc.key === 'DEFAULT_IMPORT_PASSWORD' && doc.value) fixedValue = doc.value;
      });
    }
    const config = { strategy, fixedValue, time: now };
    this.cachedImportPasswordConfig = config;
    return config;
  }

  async preprocessImportRecord(data: AnyRecord) {
    // ─── GENDER ───
    if (data.gender) {
      const g = String(data.gender).toLowerCase().trim();
      if (g === 'nam') data.gender = 'male';
      else if (g === 'nữ' || g === 'nu') data.gender = 'female';
      else if (g === 'khác' || g === 'khac') data.gender = 'other';
    }

    // ─── STATUS ───
    if (data.status) {
      const s = String(data.status).toLowerCase().trim();
      if (s === 'đang hoạt động' || s === 'hoạt động' || s === 'active') data.status = 'active';
      else if (s === 'đã nghỉ' || s === 'đã ngưng' || s === 'nghỉ' || s === 'inactive') data.status = 'inactive';
      else if (s === 'khai trừ' || s === 'đuổi' || s === 'dismissed') data.status = 'dismissed';
    }

    // ─── POSITION (Chức vụ) ─── map readable text → code
    const POSITION_MAP: Record<string, string> = {
      'cộng tác viên': 'ctv',
      ctv: 'ctv',
      'thành viên': 'tv',
      tv: 'tv',
      'thành viên ban': 'tvb',
      tvb: 'tvb',
      'phó ban': 'pb',
      pb: 'pb',
      'trưởng ban': 'tb',
      tb: 'tb',
      'đội trưởng': 'dt',
      dt: 'dt',
    };
    if (!data.position || String(data.position).trim() === '') {
      throw new Error(
        `Cột 'Hạng/Chức vụ' (position) là bắt buộc khi nhập file Excel. Vui lòng điền Chức vụ hợp lệ (ví dụ: Cộng tác viên, Thành viên, Thành viên ban, Phó ban, Trưởng ban, Đội trưởng).`,
      );
    }

    const key = String(data.position).toLowerCase().trim();
    const mapped = POSITION_MAP[key];
    if (mapped) {
      data.position = mapped;
    } else {
      throw new Error(
        `Giá trị '${data.position}' ở cột 'Hạng/Chức vụ' không hợp lệ. Các giá trị hợp lệ: Cộng tác viên, Thành viên, Thành viên ban, Phó ban, Trưởng ban, Đội trưởng.`,
      );
    }

    // ─── GENERATION ID ─── check numeric ID first, then Name, then flexible digits
    if (data.generationId !== undefined && data.generationId !== null && data.generationId !== '') {
      const rawGen = String(data.generationId).trim();
      const allGens = await generationsRepository.findAll();

      // 1. Check numeric 'id' match first
      let matched = allGens.find(
        (g: any) => g.id !== undefined && g.id !== null && (String(g.id) === rawGen || Number(g.id) === Number(rawGen)),
      );

      // 2. Check exact Name match next
      if (!matched) {
        matched = allGens.find(
          (g: any) =>
            String(g.name || '')
              .trim()
              .toLowerCase() === rawGen.toLowerCase(),
        );
      }

      // 3. Check digit extraction match (e.g. "K60" / "Khóa 60" -> 60)
      if (!matched) {
        const extractNum = (str: string) => str.replace(/\D/g, '');
        const targetNum = extractNum(rawGen);
        if (targetNum) {
          matched = allGens.find((g: any) => extractNum(String(g.name || '')) === targetNum);
        }
      }

      if (matched) {
        data.generationId = Number(matched.id ?? matched._id); // Numeric ID for schema type validation
        data.generation_name = matched.name; // Human-readable name for UI display
        data._matchedGenerationId = Number(matched.id ?? matched._id);
      } else {
        throw new Error(`Không tìm thấy Khóa/Thế hệ '${data.generationId}'. Vui lòng kiểm tra lại.`);
      }
    }

    // ─── DEPARTMENT ─── support name lookup (if provided as text instead of ID)
    if (data.department && typeof data.department === 'string' && isNaN(Number(data.department))) {
      const deptModel = (db as any).getModel('departments');
      if (deptModel) {
        const dept = await deptModel
          .findOne({ name: { $regex: new RegExp('^' + data.department.trim() + '$', 'i') } })
          .lean();
        if (dept) {
          data.department = (dept as any).name; // keep name; schema type is string
        }
        // else: keep original string — schema will validate
      }
    }

    // ─── ROLE IDS ─── support comma-separated role names
    if (data.roleIds && typeof data.roleIds === 'string') {
      const roleNames = data.roleIds
        .split(',')
        .map((r: string) => r.trim())
        .filter(Boolean);
      if (roleNames.length > 0) {
        const roleModel = (db as any).getModel('roles');
        if (roleModel) {
          const roles = await roleModel.find({ name: { $in: roleNames } });
          const foundNames = roles.map((r: any) => r.name);
          const missing = roleNames.filter((r) => !foundNames.includes(r));
          if (missing.length > 0) {
            throw new Error(`Không tìm thấy các Vai trò sau: ${missing.join(', ')}`);
          }
          data.roleIds = roles.map((r: any) => Number(r.id ?? r._id));
        }
      }
    }

    // ─── FULL NAME ─── combine lastName + firstName
    if (!data.name && (data.lastName || data.firstName)) {
      data.name = `${data.lastName || ''} ${data.firstName || ''}`.trim();
    }

    // ─── PASSWORD ─── default from config
    if (!data.password || String(data.password).trim() === '') {
      const config = await this.getImportPasswordConfig();
      let pwd = '';
      if (config.strategy === 'dob' && data.dob) {
        let d: Date | null = null;
        if (data.dob instanceof Date) {
          d = isNaN(data.dob.getTime()) ? null : data.dob;
        } else {
          const str = String(data.dob).trim();
          const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
          if (dmyMatch) {
            d = new Date(Number(dmyMatch[3]), Number(dmyMatch[2]) - 1, Number(dmyMatch[1]));
          } else {
            const parsed = new Date(str);
            d = isNaN(parsed.getTime()) ? null : parsed;
          }
        }
        if (d && !isNaN(d.getTime())) {
          const day = String(d.getDate()).padStart(2, '0');
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const year = d.getFullYear();
          pwd = `${day}${month}${year}`;
        }
      } else if (config.strategy === 'studentId' && data.studentId) {
        pwd = String(data.studentId).trim();
      } else if (config.strategy === 'cccd' && data.cccd) {
        pwd = String(data.cccd).trim();
      }

      data.password = pwd || config.fixedValue || process.env.DEFAULT_IMPORT_PASSWORD || 'TCNS@2026';
    }
  }

  async validateImportData(data: AnyRecord, rowIndex?: number) {
    await this.preprocessImportRecord(data);
    return super.validateImportData(data, rowIndex);
  }

  async transformImportData(data: AnyRecord) {
    const transformed = await super.transformImportData(data);

    // Map _matchedGenerationId to numeric ID (number) for DB save
    if (data._matchedGenerationId !== undefined) {
      transformed.generationId = Number(data._matchedGenerationId);
    } else if (transformed.generationId && isNaN(Number(transformed.generationId))) {
      const gen = await generationsRepository.findOne({ name: String(transformed.generationId).trim() });
      if (gen) transformed.generationId = Number(gen.id ?? gen._id);
    }

    // Ensure password is never empty before hashing
    const rawPassword = transformed.password || data.password || 'TCNS@2026';
    transformed.password = await hashPassword(String(rawPassword));

    if (!transformed.avatar && transformed.name) {
      transformed.avatar = generateAvatarUrl(transformed.name);
    }

    if (transformed.position) {
      transformed.roleIds = getSuggestedRoles(
        transformed.position as string,
        (transformed.department as string) || null,
      );
    }

    if (transformed.status === 'active') {
      transformed.isActive = true;
      transformed.isAlumni = false;
    } else if (transformed.status === 'inactive') {
      transformed.isActive = false;
      transformed.isAlumni = true;
    } else if (transformed.status === 'dismissed') {
      transformed.isActive = false;
      transformed.isAlumni = false;
      transformed.expelled = true;
    }

    return transformed;
  }

  async generateMockData(field: string, rules: any): Promise<any> {
    const lowerField = field.toLowerCase();
    if (lowerField === 'gender') return 'Nam';
    if (lowerField === 'status') return 'Đang hoạt động';
    if (lowerField === 'position') return 'Thành viên';
    if (lowerField === 'department') return 'Ban Chuyên Môn';
    if (lowerField.includes('role')) return 'Quản trị viên, Thành viên';
    if (lowerField.includes('generation')) return 'K60';
    if (lowerField === 'isactive') return 'Có';
    if (lowerField === 'isalumni') return 'Không';
    if (lowerField === 'dob') return '01/01/2000';
    if (lowerField === 'classid') return 'D20CQCN01-B';

    if (lowerField.includes('name')) return 'Nguyễn Văn A';
    if (lowerField === 'lastname') return 'Nguyễn Văn';
    if (lowerField === 'firstname') return 'A';
    if (lowerField.includes('email')) return 'nguyenvana@gmail.com';
    if (lowerField.includes('phone')) return '0987654321';
    if (lowerField.includes('student') || lowerField.includes('code')) return 'SV123456';
    if (lowerField === 'cccd') return '001202000001';

    return super.generateMockData(field, rules);
  }

  async getUserStats(filters: Record<string, any> = {}) {
    const query: any = {};

    if (filters.generationId === 'active_generations') {
      // Resolve active generation IDs from the source of truth
      const activeGens = await generationsRepository.findMany({ isActive: true });
      const activeGenIds = activeGens.map((g: any) => Number(g.id ?? g._id)).filter(Boolean);
      if (activeGenIds.length > 0) query.generationId_in = activeGenIds;
    } else if (filters.generationId) {
      query.generationId = Number(filters.generationId) || filters.generationId;
    }

    if (filters.isAlumni !== undefined) {
      query.isAlumni = filters.isAlumni === 'true' || filters.isAlumni === true;
    }
    if (filters.status) query.status = filters.status;
    if (filters.status_ne) query.status_ne = filters.status_ne;
    if (filters.department) query.department = filters.department;
    if (filters.position) query.position = filters.position;

    const users = (await this.repository.findMany(query)) as UserRecord[];
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const stats: UserStats = {
      global: createUserStatItem(),
      byDepartment: {},
    };

    for (const user of users) {
      processUserStats(stats.global, user, weekAgo);

      if (user.department) {
        if (!stats.byDepartment[user.department]) {
          stats.byDepartment[user.department] = createUserStatItem();
        }
        processUserStats(stats.byDepartment[user.department], user, weekAgo);
      }
    }

    // Active generations count always comes from the generations table (source of truth)
    const allGenerations = await generationsRepository.findAll();
    (stats.global as any).activeGenerations = allGenerations.filter((g: any) => g.isActive === true).length;

    return stats;
  }

  async getUserActivity(userId: Identifier) {
    const user = await this.findUserOrThrow(userId);

    return {
      user: sanitizeUser(user),
      joinedAt: user.createdAt,
      lastLogin: user.lastLogin,
    };
  }

  async toggleUserStatus(userId: Identifier, performer?: AnyRecord | Identifier) {
    const user = await this.findUserOrThrow(userId);

    const newIsActive = !user.isActive;
    const updateData: AnyRecord = {
      isActive: newIsActive,
    };

    const updated = await this.repository.update(userId, updateData);

    await auditLogsService.log({
      userId: this.toAuditUserId(performer, user.id),
      action: updated?.isActive ? 'KÍCH HOẠT NGƯỜI DÙNG' : 'VÔ HIỆU HÓA NGƯỜI DÙNG',
      module: 'USERS',
      description: `${updated?.isActive ? 'Kích hoạt' : 'Vô hiệu hóa'} người dùng ${this.getUserDisplayName(user)}`,
      resourceId: String(user.id),
    });

    return sanitizeUser(updated);
  }

  async promoteUser(
    userId: Identifier,
    role: string,
    reason: string | null | undefined,
    actorId: Identifier,
    actorPermissions: string[],
  ) {
    const allowedRoles = ['customer', 'staff', 'admin'];
    if (!allowedRoles.includes(role)) {
      throw ApiError.badRequest(`Vai trò không hợp lệ. Vai trò cho phép: ${allowedRoles.join(', ')}`);
    }

    const user = await this.findUserOrThrow(userId);
    if (user.expelled) throw ApiError.badRequest('Không thể thăng quyền người dùng đã bị khai trừ');
    if (Number(actorId) === Number(user.id)) throw ApiError.badRequest('Không thể tự thay đổi vai trò của chính mình');

    const isActorAdmin = actorPermissions.includes('*');
    if (!isActorAdmin) {
      throw ApiError.forbidden('Chỉ admin mới có quyền này');
    }

    const now = new Date().toISOString();
    const updated = await this.repository.update(userId, {
      role,
      promotedAt: now,
      promotedBy: actorId,
      promotionReason: reason || '',
    });

    await notificationService.notifyUser(user.id, {
      title: 'Cập nhật chức vụ',
      message: `Chức vụ của bạn đã được cập nhật thành '${role}'.`,
      type: 'system',
      category: 'system',
      metadata: {
        role,
        reason: reason || '',
      },
    });

    await auditLogsService.log({
      userId: this.toAuditUserId(actorId),
      action: 'THAY ĐỔI VAI TRÒ NGƯỜI DÙNG',
      module: 'USERS',
      description: `Thay đổi vai trò người dùng ${this.getUserDisplayName(user)} sang ${role}`,
      resourceId: String(user.id),
    });

    return sanitizeUser(updated);
  }

  async expelUser(
    userId: Identifier,
    reason: string | null | undefined,
    actorId: Identifier,
    actorPermissions: string[],
  ) {
    const user = await this.findUserOrThrow(userId);
    if (Number(actorId) === Number(user.id))
      throw ApiError.badRequest('Không thể tự khai trừ tài khoản của chính mình');

    const isActorAdmin = actorPermissions.includes('*');
    const isTargetAdmin = Array.isArray((user as any).permissions) && (user as any).permissions.includes('*');
    if (!isActorAdmin && isTargetAdmin) {
      throw ApiError.forbidden('Chỉ admin mới có thể khai trừ tài khoản admin');
    }

    if (user.expelled) {
      return sanitizeUser(user);
    }

    const now = new Date().toISOString();
    const updated = await this.repository.update(userId, {
      expelled: true,
      expelledAt: now,
      expelReason: reason || '',
      expelledBy: actorId,
      status: 'dismissed',
      isActive: false,
    });

    await notificationService.notifyUser(user.id, {
      title: 'Thông báo khai trừ',
      message: 'Tài khoản của bạn đã bị khai trừ khỏi tổ chức.',
      type: 'approval',
      category: 'approval',
      metadata: {
        reason: reason || '',
      },
    });

    await auditLogsService.log({
      userId: this.toAuditUserId(actorId),
      action: 'KHAI TRỪ NGƯỜI DÙNG',
      module: 'USERS',
      description: `Khai trừ người dùng ${this.getUserDisplayName(user)}`,
      resourceId: String(user.id),
    });

    return sanitizeUser(updated);
  }

  async permanentDeleteUser(userId: Identifier, actorId: Identifier, actorPermissions: string[]) {
    const user = await this.findUserOrThrow(userId);
    if (Number(actorId) === Number(user.id)) throw ApiError.badRequest('Không thể tự xóa tài khoản của chính mình');

    const isActorAdmin = actorPermissions.includes('*');
    const isTargetAdmin = Array.isArray((user as any).permissions) && (user as any).permissions.includes('*');
    if (!isActorAdmin && isTargetAdmin) {
      throw ApiError.forbidden('Chỉ admin mới có thể xóa tài khoản admin');
    }

    const normalizedUserId = this.normalizeUserId(userId);
    const notificationCount = await this.deleteUserNotifications(normalizedUserId);
    await this.deleteUserRewardPenalties(normalizedUserId);
    await this.deleteUserSwapRequests(normalizedUserId);
    await this.removeUserFromDutySlots(normalizedUserId);

    await this.repository.delete(userId);

    await auditLogsService.log({
      userId: this.toAuditUserId(actorId),
      action: 'XÓA NGƯỜI DÙNG',
      module: 'USERS',
      description: `Xóa vĩnh viễn người dùng ${this.getUserDisplayName(user)}`,
      resourceId: String(user.id),
    });

    return { user: 1, notifications: notificationCount };
  }

  async getPotentialAlumni() {
    const generations = await db.findMany('generations', { isActive: false });
    const inactiveGenIds = generations.map((g: any) => g.id);

    if (inactiveGenIds.length === 0) return [];

    const users = await db.findMany('users', {
      generationId: { $in: inactiveGenIds },
      $or: [{ isAlumni: false }, { isAlumni: { $exists: false } }],
    });

    return users;
  }

  async syncAlumniStatus(userIds?: Identifier[], actorId?: Identifier) {
    let count = 0;

    if (userIds && Array.isArray(userIds)) {
      // Sync only specific users
      for (const id of userIds) {
        await this.repository.update(id, {
          isAlumni: true,
          isActive: false,
          status: 'inactive',
        });
        count++;
      }
    } else {
      // Original logic: sync everyone in inactive generations
      const generations = await db.findMany('generations', {});
      const activeGenIds = new Set(generations.filter((g: any) => g.isActive).map((g: any) => g.id));

      const users = await this.repository.findAll();
      for (const user of users) {
        const shouldBeActive = user.generationId && activeGenIds.has(user.generationId);
        // Skip already alumni, or if their position dictates they should remain active
        // Also skip dismissed users
        if (!user.isAlumni && !shouldBeActive && user.status !== 'dismissed') {
          await this.repository.update(user.id, {
            isAlumni: true,
            isActive: false,
            status: 'inactive',
          });
          count++;
        }
      }
    }

    if (count > 0) {
      await auditLogsService.log({
        userId: this.toAuditUserId(actorId),
        action: 'ĐỒNG BỘ CỰU THÀNH VIÊN',
        module: 'USERS',
        description: `Cập nhật ${count} thành viên sang trạng thái cựu thành viên`,
      });
    }

    return count;
  }
}

export default new UserService();
