import usersRepository from '@modules/users/repositories/users.repository';
import dutySlotsRepository from '@modules/duty/repositories/duty-slots.repository';
import dutySwapRequestsRepository from '@modules/duty/repositories/duty-swap-requests.repository';
import rewardPenaltiesRepository from '@modules/reward-penalties/repositories/reward-penalties.repository';
import notificationsRepository from '@modules/notifications/repositories/notifications.repository';

class ReportsRepository {
  async loadOverviewData() {
    const [users, dutySlots, swapRequests, rewardPenalties, notifications] = await Promise.all([
      usersRepository.findAll(),
      dutySlotsRepository.findAll(),
      dutySwapRequestsRepository.findAll(),
      rewardPenaltiesRepository.findAll(),
      notificationsRepository.findAll(),
    ]);

    return {
      users,
      dutySlots,
      swapRequests,
      rewardPenalties,
      notifications,
    };
  }
}

export default new ReportsRepository();
