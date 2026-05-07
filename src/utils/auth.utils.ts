import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { SignOptions } from 'jsonwebtoken';
import type { Identifier } from '@app-types/common';

type TokenPayload = {
  id: Identifier;
  loginTime?: string | null;
};

function buildTokenPayload(id: Identifier, loginTime: string | null = null): TokenPayload {
  const payload: TokenPayload = { id };

  if (loginTime) {
    payload.loginTime = loginTime;
  }

  return payload;
}

export const generateToken = (id: Identifier, loginTime: string | null = null) => {
  const payload = buildTokenPayload(id, loginTime);
  const jwtExpire = (process.env.JWT_EXPIRE || '30d').trim() as SignOptions['expiresIn'];
  return jwt.sign(payload, process.env.JWT_SECRET || 'dev-secret', {
    expiresIn: jwtExpire,
  });
};

export const generateRefreshToken = (id: Identifier, loginTime: string | null = null) => {
  const payload = buildTokenPayload(id, loginTime);
  const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  const refreshExpire = (process.env.JWT_REFRESH_EXPIRE || '30d').trim() as SignOptions['expiresIn'];

  return jwt.sign(payload, refreshSecret || 'dev-secret', {
    expiresIn: refreshExpire,
  });
};

export const hashPassword = async (password: string) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

export const comparePassword = async (password: string, hashedPassword: string) => {
  return await bcrypt.compare(password, hashedPassword);
};
