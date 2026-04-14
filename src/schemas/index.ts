import type { SchemaMap } from '@app-types/schema';
import users from '@modules/users/schemas/user.schema';
import notifications from '@modules/notifications/schemas/notification.schema';
import notificationSettings from '@modules/notifications/schemas/notification-setting.schema';
import files from '@modules/files/schemas/file.schema';
import dutySlots from '@modules/duty/schemas/duty-slot.schema';
import dutySwapRequests from '@modules/duty/schemas/duty-swap-request.schema';
import rewardPenalties from '@modules/reward-penalties/schemas/reward-penalty.schema';
import dutyShifts from './duty-shift.schema';
import dutyKips from './duty-kip.schema';
import dutyLeaveRequests from './duty-leave-request.schema';
import dutyDays from './duty-day.schema';
import dutyTemplates from './duty-template.schema';
import dutyTemplateAssignments from './duty-template-assignment.schema';
import generations from './generation.schema';

const schemas: SchemaMap = {
  // Auth & User
  users,
  generations,

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
};

export default schemas;
