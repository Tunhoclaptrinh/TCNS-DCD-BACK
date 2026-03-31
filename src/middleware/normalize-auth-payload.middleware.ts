import type { NextFunction, Request, Response } from 'express';

function getText(body: Request['body'], fieldName: string) {
  return typeof body?.[fieldName] === 'string' ? body[fieldName].trim() : '';
}

export const requireResetTarget = (req: Request, res: Response, next: NextFunction) => {
  const email = getText(req.body, 'email');
  const phone = getText(req.body, 'phone');

  if (!email && !phone) {
    return res.status(400).json({
      success: false,
      message: 'Email hoặc số điện thoại là bắt buộc',
    });
  }

  next();
};

export const mapNewPassword = (req: Request, _res: Response, next: NextFunction) => {
  if (typeof req.body?.newPassword === 'string' && !req.body.password) {
    req.body.password = req.body.newPassword;
  }

  next();
};
