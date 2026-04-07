import type { NextFunction, Request, Response } from 'express';
import { hasPermission } from '@shared/security/permission-policy';

// Kiểm tra role hiện tại có quyền thực hiện action được yêu cầu hay không.
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;

    if (!userRole) {
      return res.status(401).json({
        success: false,
        message: 'Yêu cầu đăng nhập',
      });
    }

    if (!hasPermission(userRole, permission)) {
      return res.status(403).json({
        success: false,
        message: `Bạn không có quyền: ${permission}`,
      });
    }

    next();
  };
};
