import nodemailer from 'nodemailer';
import type { AnyRecord } from '@app-types/common';

function isProduction() {
  return (process.env.NODE_ENV || 'development') === 'production';
}

class OtpDeliveryService {
  senderName: string;
  transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.senderName = process.env.OTP_SENDER_NAME || 'Hệ thống TCNS';
    this.initTransporter();
  }

  private initTransporter() {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    }
  }

  private buildHtmlTemplate(otp: string, expiresMinutes: number) {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
      <h2 style="color: #333; text-align: center;">Mã Xác Nhận Đặt Lại Mật Khẩu</h2>
      <p style="color: #555; font-size: 16px;">Xin chào,</p>
      <p style="color: #555; font-size: 16px;">Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản của mình. Dưới đây là mã xác nhận (OTP) của bạn:</p>
      <div style="text-align: center; margin: 30px 0;">
        <span style="display: inline-block; font-size: 32px; font-weight: bold; color: #4CAF50; letter-spacing: 5px; padding: 10px 20px; background-color: #f9f9f9; border-radius: 8px; border: 1px dashed #4CAF50;">
          ${otp}
        </span>
      </div>
      <p style="color: #555; font-size: 16px;">Mã này có hiệu lực trong vòng <strong>${expiresMinutes} phút</strong>. Vui lòng không chia sẻ mã này với bất kỳ ai.</p>
      <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
      <p style="color: #888; font-size: 12px; text-align: center;">Email này được gửi tự động từ ${this.senderName}, vui lòng không phản hồi.</p>
    </div>
    `;
  }

  async sendEmailOtp({ to, otp, expiresMinutes }: AnyRecord) {
    const text = `${this.senderName}: Mã OTP đặt lại mật khẩu của bạn là ${otp}. Hiệu lực ${expiresMinutes} phút.`;
    const html = this.buildHtmlTemplate(String(otp), Number(expiresMinutes));

    const payload = {
      from: `"${this.senderName}" <${process.env.SMTP_USER || 'noreply@tcns.com'}>`,
      to,
      subject: `[${this.senderName}] Mã OTP đặt lại mật khẩu`,
      text,
      html,
    };

    return this.sendEmail(payload);
  }

  async sendEmail(payload: nodemailer.SendMailOptions) {
    if (!this.transporter) {
      if (!isProduction()) {
        console.log('[OTP MOCK][email]', payload);
        return { delivered: true, mocked: true };
      }
      throw new Error('EMAIL gateway (SMTP) is not configured');
    }

    try {
      const info = await this.transporter.sendMail(payload);
      console.log('[OTP EMAIL SENT]', info.messageId);
      return { delivered: true, mocked: false, messageId: info.messageId };
    } catch (error) {
      console.error('[OTP EMAIL ERROR]', error);
      throw error;
    }
  }
}

export default new OtpDeliveryService();
