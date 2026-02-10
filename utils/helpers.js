const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

/**
 * Generate JWT token
 * @param {number} id - User ID
 * @param {string} loginTime - ISO timestamp of login (for token invalidation)
 */
exports.generateToken = (id, loginTime = null) => {
  const payload = { id };

  // Include loginTime for token version checking
  if (loginTime) {
    payload.loginTime = loginTime;
  }

  // Trim to handle Windows line endings (CRLF) in .env files
  const jwtExpire = (process.env.JWT_EXPIRE || "30d").trim();
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: jwtExpire,
  });
};

/**
 * Hash password
 */
exports.hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

/**
 * Compare password with hashed password
 */
exports.comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

/**
 * Remove password from user object
 */
exports.sanitizeUser = (user) => {
  if (!user) return null;
  // Convert to object if it's a Mongoose document
  const userObj = user.toObject ? user.toObject() : user;
  const { password, __v, _id, ...userWithoutSensitive } = userObj;
  return userWithoutSensitive;
};

/**
 * Calculate distance between two GPS coordinates
 * Using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
exports.calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Format distance for display
 * @param {number} distance - Distance in kilometers
 * @returns {string} Formatted distance
 */
exports.formatDistance = (distance) => {
  if (distance < 1) {
    return `${Math.round(distance * 1000)} m`;
  }
  return `${distance.toFixed(1)} km`;
};
