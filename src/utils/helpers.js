import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

/**
 * Generate JWT token
 */
export const generateToken = (id, loginTime = null) => {
  const payload = { id };

  if (loginTime) {
    payload.loginTime = loginTime;
  }

  const jwtExpire = (process.env.JWT_EXPIRE || '30d').trim();
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: jwtExpire,
  });
};

/**
 * Hash password
 */
export const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

/**
 * Compare password with hashed password
 */
export const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

/**
 * Remove password from user object
 */
export const sanitizeUser = (user) => {
  if (!user) return null;
  if (Array.isArray(user)) {
    return user.map((item) => sanitizeUser(item));
  }

  const userObj = user.toObject ? user.toObject() : user;

  // Keep response envelope unchanged, only sanitize nested user payload.
  if (userObj && typeof userObj === 'object' && Object.prototype.hasOwnProperty.call(userObj, 'data')) {
    return {
      ...userObj,
      data: sanitizeUser(userObj.data),
    };
  }

  const { password, __v, _id, ...userWithoutSensitive } = userObj;
  return userWithoutSensitive;
};

/**
 * Calculate distance between two GPS coordinates
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Format distance for display
 */
export const formatDistance = (distance) => {
  if (distance < 1) {
    return `${Math.round(distance * 1000)} m`;
  }
  return `${distance.toFixed(1)} km`;
};
