export const sanitizeUser = (user: any): any => {
  if (!user) return null;
  if (Array.isArray(user)) {
    return user.map((item) => sanitizeUser(item));
  }

  const userObj = user.toObject ? user.toObject() : user;

  if (userObj && typeof userObj === 'object' && Object.prototype.hasOwnProperty.call(userObj, 'data')) {
    return {
      ...userObj,
      data: sanitizeUser(userObj.data),
    };
  }

  const { password, __v, _id, ...userWithoutSensitive } = userObj;
  return userWithoutSensitive;
};
