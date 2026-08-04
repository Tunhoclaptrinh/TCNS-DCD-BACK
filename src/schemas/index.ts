import type { SchemaMap } from '@app-types/schema';
import users from '@modules/users/schemas/user.schema';
import notifications from '@modules/notifications/schemas/notification.schema';
import notificationSettings from '@modules/notifications/schemas/notification-setting.schema';
import files from '@modules/files/schemas/file.schema';
import dutySlots from '@modules/duty/schemas/duty-slot.schema';
import dutySwapRequests from '@modules/duty/schemas/duty-swap-request.schema';
import rewardPenalties from '@modules/reward-penalties/schemas/reward-penalty.schema';
import dutyShifts from '@modules/duty/schemas/duty-shift.schema';
import dutyKips from '@modules/duty/schemas/duty-kip.schema';
import dutyLeaveRequests from '@modules/duty/schemas/duty-leave-request.schema';
import dutyDays from '@modules/duty/schemas/duty-day.schema';
import dutyTemplates from '@modules/duty/schemas/duty-template.schema';
import dutyTemplateAssignments from '@modules/duty/schemas/duty-template-assignment.schema';
import dutyLogs from '@modules/duty/schemas/duty-log.schema';
import dutySettings from '@modules/duty/schemas/duty-settings.schema';
import dutyViolations from '@modules/duty/schemas/duty-violation.schema';
import dutyPeriodConfigs from '@modules/duty/schemas/duty-period-config.schema';

import generations from '@modules/generations/schemas/generation.schema';
import roles from '@modules/roles/schemas/role.schema';
import permissions from '@modules/permissions/schemas/permission.schema';
import auditLogs from '@modules/audit-logs/schemas/audit-log.schema';
import meetings from '@modules/meetings/schemas/meeting.schema';
import bonusCampaigns from '@modules/bonus-campaigns/schemas/bonus-campaign.schema';
import bonusRegistrations from '@modules/bonus-registrations/schemas/bonus-registration.schema';
import semesters from '@modules/semesters/schemas/semester.schema';
import otpCodes from '@modules/auth/schemas/otp.schema';
import systemSettings from '@modules/system-settings/schemas/system-setting.schema';

const schemas: SchemaMap = {
  // Auth & User
  users,
  generations,
  roles,
  permissions,
  audit_logs: auditLogs,
  meetings,
  bonus_campaigns: bonusCampaigns,
  bonus_registrations: bonusRegistrations,
  otp_codes: otpCodes,
  semesters,
  system_settings: systemSettings,

  // User Content
  notifications,
  notification_settings: notificationSettings,
  files,
  duty_templates: dutyTemplates,
  duty_shifts: dutyShifts,

  duty_kips: dutyKips,
  duty_slots: dutySlots,
  duty_swap_requests: dutySwapRequests,
  duty_leave_requests: dutyLeaveRequests,
  reward_penalties: rewardPenalties,
  duty_days: dutyDays,
  duty_template_assignments: dutyTemplateAssignments,
  duty_logs: dutyLogs,
  duty_settings: dutySettings,
  duty_violations: dutyViolations,
  duty_period_configs: dutyPeriodConfigs,
};

export default schemas;
