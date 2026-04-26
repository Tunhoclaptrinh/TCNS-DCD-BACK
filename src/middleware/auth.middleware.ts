import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import db from '@database';
import type { Identifier } from '@app-types/common';

type AuthTokenPayload = {
  id: Identifier;
  loginTime?: string | null;
};
type AuthenticatedUser = Record<string, any> & {
  id: Identifier;
  role?: string;
  isActive?: boolean;
  lastLogin?: string | null;
};

function sendUnauthorizedResponse(res: Response, message: string) {
  return res.status(401).json({
    success: false,
    message,
  });
}

function getBearerToken(req: Request) {
  const authorizationHeader = req.headers.authorization;
  if (authorizationHeader && authorizationHeader.startsWith('Bearer ')) {
    return authorizationHeader.split(' ')[1];
  }

  return null;
}

function verifyAuthToken(token: string) {
  return jwt.verify(token, process.env.JWT_SECRET as string) as AuthTokenPayload;
}

function isTokenOutdated(decoded: AuthTokenPayload, user: AuthenticatedUser) {
  if (!decoded.loginTime || !user.lastLogin) {
    return false;
  }

  return new Date(decoded.loginTime).getTime() < new Date(user.lastLogin).getTime();
}

async function findUser(userId: Identifier) {
  return (await db.findById('users', userId)) as AuthenticatedUser | null;
}

import userAccessService from '@modules/users/services/user-access.service';

// ... (existing helper functions)

// Kiểm tra JWT, nạp thông tin user hiện tại và gắn vào `req.user`.
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getBearerToken(req);

    if (!token) {
      return sendUnauthorizedResponse(res, 'Not authorized to access this route');
    }

    let decoded: AuthTokenPayload;
    try {
      decoded = verifyAuthToken(token);
    } catch {
      return sendUnauthorizedResponse(res, 'Token is invalid or expired');
    }

    const user = await findUser(decoded.id);

    if (!user) {
      return sendUnauthorizedResponse(res, 'User not found');
    }

    if (!user.isActive) {
      return sendUnauthorizedResponse(res, 'User account is inactive');
    }

    if (isTokenOutdated(decoded, user)) {
      return sendUnauthorizedResponse(res, 'Token has been invalidated. Please login again.');
    }

    // Compute and attach permissions
    const permissions = await userAccessService.computePermissions(user);
    req.user = { ...user, permissions };

    next();
  } catch (error) {
    next(error);
  }
};

// Chặn truy cập nếu role hiện tại không nằm trong danh sách cho phép.
export const requireRole = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;

    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `User role '${userRole}' is not authorized to access this route`,
      });
    }
    next();
  };
};
