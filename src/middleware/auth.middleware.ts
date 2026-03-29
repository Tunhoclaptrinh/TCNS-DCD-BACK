import jwt from 'jsonwebtoken';
import db from '@database';

function sendAuthError(res, message: string) {
  return res.status(401).json({
    success: false,
    message,
  });
}

function readBearerToken(req) {
  const authorizationHeader = req.headers.authorization;
  if (authorizationHeader && authorizationHeader.startsWith('Bearer')) {
    return authorizationHeader.split(' ')[1];
  }
  return null;
}

export const protect = async (req, res, next) => {
  try {
    const token = readBearerToken(req);

    if (!token) {
      return sendAuthError(res, 'Not authorized to access this route');
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return sendAuthError(res, 'Token is invalid or expired');
    }

    const user = await db.findById('users', decoded.id);

    if (!user) {
      return sendAuthError(res, 'User not found');
    }

    if (!user.isActive) {
      return sendAuthError(res, 'User account is inactive');
    }

    if (decoded.loginTime && user.lastLogin) {
      const isTokenOutdated = new Date(decoded.loginTime).getTime() < new Date(user.lastLogin).getTime();
      if (isTokenOutdated) {
        return sendAuthError(res, 'Token has been invalidated. Please login again.');
      }
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
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
