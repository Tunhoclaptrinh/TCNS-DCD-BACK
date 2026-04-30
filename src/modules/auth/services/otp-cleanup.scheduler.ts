import cron from 'node-cron';
import otpCodesRepository from '@modules/auth/repositories/otp-codes.repository';
import { logger } from '@utils/logger';

const OTP_CLEANUP_CRON = '0 3 * * *';
const OTP_CLEANUP_TIMEZONE = process.env.OTP_CLEANUP_TIMEZONE || 'Asia/Ho_Chi_Minh';

async function cleanupOtpCodes(source: string) {
  try {
    const deletedCount = await otpCodesRepository.deleteMany({});
    logger.info(`OTP cleanup completed by ${source}, deleted ${deletedCount} records`, 'OTP_CRON');
  } catch (error) {
    logger.error(`OTP cleanup failed by ${source}`, 'OTP_CRON', error);
  }
}

export function startOtpCleanupScheduler() {
  void cleanupOtpCodes('server startup');

  cron.schedule(OTP_CLEANUP_CRON, () => cleanupOtpCodes('03:00 cron'), { timezone: OTP_CLEANUP_TIMEZONE });

  logger.info(`OTP cleanup scheduler started: "${OTP_CLEANUP_CRON}" (${OTP_CLEANUP_TIMEZONE})`, 'OTP_CRON');
}
