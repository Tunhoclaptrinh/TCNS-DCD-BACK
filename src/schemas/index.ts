import type { SchemaMap } from '@app-types/schema';
import users from './user.schema';
import notifications from './notification.schema';
import notificationSettings from './notification-setting.schema';
import files from './file.schema';
import dutySlots from './duty-slot.schema';
import dutyShifts from './duty-shift.schema';
import dutyKips from './duty-kip.schema';
import dutySwapRequests from './duty-swap-request.schema';
import rewardPenalties from './reward-penalty.schema';
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
