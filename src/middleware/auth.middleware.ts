import jwt from 'jsonwebtoken';
import db from '@config/database';

function extractToken(req) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer')) {
    return auth.split(' ')[1];
  }
  return null;
}

export const protect = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route',
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Token is invalid or expired',
      });
    }

    const user = await db.findById('users', decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User account is inactive',
      });
    }

    // Invalidate old tokens
    if (decoded.loginTime && user.lastLogin) {
      const isTokenOutdated = new Date(decoded.loginTime).getTime() < new Date(user.lastLogin).getTime();
      if (isTokenOutdated) {
        return res.status(401).json({
          success: false,
          message: 'Token has been invalidated. Please login again.',
        });
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
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this route`,
      });
    }
    next();
  };
};

export const authorizeRoles = authorize;
