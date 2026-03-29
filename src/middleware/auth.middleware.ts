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

function sendAuthError(res: Response, message: string) {
  return res.status(401).json({
    success: false,
    message,
  });
}

function readBearerToken(req: Request) {
  const authorizationHeader = req.headers.authorization;
  if (authorizationHeader && authorizationHeader.startsWith('Bearer')) {
    return authorizationHeader.split(' ')[1];
  }
  return null;
}

function decodeAuthToken(token: string) {
  return jwt.verify(token, process.env.JWT_SECRET as string) as AuthTokenPayload;
}

function isTokenOutdated(decoded: AuthTokenPayload, user: AuthenticatedUser) {
  if (!decoded.loginTime || !user.lastLogin) {
    return false;
  }

  return new Date(decoded.loginTime).getTime() < new Date(user.lastLogin).getTime();
}

export const protect = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = readBearerToken(req);

    if (!token) {
      return sendAuthError(res, 'Not authorized to access this route');
    }

    let decoded: AuthTokenPayload;
    try {
      decoded = decodeAuthToken(token);
    } catch {
      return sendAuthError(res, 'Token is invalid or expired');
    }

    const user = (await db.findById('users', decoded.id)) as AuthenticatedUser | null;

    if (!user) {
      return sendAuthError(res, 'User not found');
    }

    if (!user.isActive) {
      return sendAuthError(res, 'User account is inactive');
    }

    if (isTokenOutdated(decoded, user)) {
      return sendAuthError(res, 'Token has been invalidated. Please login again.');
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;

    if (!userRole || !roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `User role '${userRole}' is not authorized to access this route`,
      });
    }
    next();
  };
};

export const authorizeRoles = authorize;
