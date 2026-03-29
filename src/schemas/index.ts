import type { SchemaMap } from '@app-types/schema';
import users from '@modules/users/schemas/user.schema';
import notifications from '@modules/notifications/schemas/notification.schema';
import notificationSettings from '@modules/notifications/schemas/notification-setting.schema';
import files from '@modules/files/schemas/file.schema';
import dutySlots from '@modules/duty/schemas/duty-slot.schema';
import dutySwapRequests from '@modules/duty/schemas/duty-swap-request.schema';
import rewardPenalties from '@modules/reward-penalties/schemas/reward-penalty.schema';

const schemas: SchemaMap = {
  // Auth & User
  users,

  // User Content
  notifications,
  notification_settings: notificationSettings,
  files,
  duty_slots: dutySlots,
  duty_swap_requests: dutySwapRequests,
  reward_penalties: rewardPenalties,
};

export default schemas;
