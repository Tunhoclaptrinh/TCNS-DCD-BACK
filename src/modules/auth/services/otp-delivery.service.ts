import axios from 'axios';
import type { AnyRecord } from '@app-types/common';

const REQUEST_TIMEOUT_MS = 10000;

function isProduction() {
  return (process.env.NODE_ENV || 'development') === 'production';
}

function buildAuthHeaders(token?: string) {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

class OtpDeliveryService {
  senderName: string;

  constructor() {
    this.senderName = process.env.OTP_SENDER_NAME || 'Hệ thống TCNS';
  }

  async sendEmailOtp({ to, otp, expiresMinutes }: AnyRecord) {
    const text = `${this.senderName}: Ma OTP dat lai mat khau cua ban la ${otp}. Hieu luc ${expiresMinutes} phut.`;
    const payload = {
      to,
      sender: this.senderName,
      subject: `[${this.senderName}] Ma OTP dat lai mat khau`,
      text,
      message: text,
    };

    return this.send('email', payload);
  }

  async sendSmsOtp({ to, otp, expiresMinutes }: AnyRecord) {
    const message = `${this.senderName}: Ma OTP cua ban la ${otp}. Hieu luc ${expiresMinutes} phut.`;
    const payload = {
      to,
      sender: this.senderName,
      message,
    };

    return this.send('sms', payload);
  }

  async send(channel: string, payload: AnyRecord) {
    const isSms = channel === 'sms';
    const url = isSms ? process.env.OTP_SMS_API_URL : process.env.OTP_EMAIL_API_URL;
    const token = isSms ? process.env.OTP_SMS_API_TOKEN : process.env.OTP_EMAIL_API_TOKEN;

    if (!url) {
      if (!isProduction()) {
        console.log(`[OTP MOCK][${channel}]`, payload);
        return { delivered: true, mocked: true };
      }
      throw new Error(`${channel.toUpperCase()} gateway is not configured`);
    }

    await axios.post(url, payload, {
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
        ...buildAuthHeaders(token),
      },
    });

    return { delivered: true, mocked: false };
  }
}

export default new OtpDeliveryService();
