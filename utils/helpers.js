const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

/**
 * Generate JWT token
 */
exports.generateToken = (id, loginTime = null) => {
  const payload = { id };
  if (loginTime) {
    payload.loginTime = loginTime;
  }
  const jwtExpire = (process.env.JWT_EXPIRE || "30d").trim();
  return jwt.sign(payload, process.env.JWT_SECRET || "secret", {
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
 * Compare password
 */
exports.comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

/**
 * Sanitize user object
 */
exports.sanitizeUser = (user) => {
  if (!user) return null;
  const userObj = user.toObject ? user.toObject() : user;
  const { password, __v, _id, ...userWithoutSensitive } = userObj;
  return userWithoutSensitive;
};
