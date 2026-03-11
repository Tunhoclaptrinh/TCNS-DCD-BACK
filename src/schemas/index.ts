import type { SchemaMap } from '@app-types/schema';
import users from './user.schema';
import notifications from './notification.schema';
import notificationSettings from './notification-setting.schema';
import dutySlots from './duty-slot.schema';
import dutySwapRequests from './duty-swap-request.schema';
import rewardPenalties from './reward-penalty.schema';

const schemas: SchemaMap = {
  // Auth & User
  users,

  // User Content
  notifications,
  notification_settings: notificationSettings,
  duty_slots: dutySlots,
  duty_swap_requests: dutySwapRequests,
  reward_penalties: rewardPenalties,
};

export default schemas;
