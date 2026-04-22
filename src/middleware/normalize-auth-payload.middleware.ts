import type { NextFunction, Request, Response } from 'express';

function getText(body: Request['body'], fieldName: string) {
  return typeof body?.[fieldName] === 'string' ? body[fieldName].trim() : '';
}

// Flow quên mật khẩu hiện chỉ hỗ trợ gửi OTP qua email.
export const requireResetEmail = (req: Request, res: Response, next: NextFunction) => {
  const email = getText(req.body, 'email');

  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Email là bắt buộc',
    });
  }

  next();
};

// Đồng bộ `newPassword` về `password` để các flow cũ và mới dùng chung phía sau.
export const mapNewPassword = (req: Request, _res: Response, next: NextFunction) => {
  if (typeof req.body?.newPassword === 'string' && !req.body.password) {
    req.body.password = req.body.newPassword;
  }

  next();
};
