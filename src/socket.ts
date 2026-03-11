import jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';
import type { Server } from 'socket.io';
import db from '@config/database';

type SocketTokenPayload = JwtPayload & {
  id?: number | string;
};

function verifySocketToken(token: string): SocketTokenPayload {
  return jwt.verify(token, process.env.JWT_SECRET || '') as SocketTokenPayload;
}

export function initSocket(io: Server) {
  // ==================== AUTH MIDDLEWARE ====================
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Unauthorized: no token'));

    let decoded: SocketTokenPayload;
    try {
      decoded = verifySocketToken(token);
    } catch {
      return next(new Error('Unauthorized: invalid token'));
    }

    if (decoded.id === undefined || decoded.id === null) {
      return next(new Error('Unauthorized: invalid token payload'));
    }

    const user = await db.findById('users', decoded.id);
    if (!user || !user.isActive) {
      return next(new Error('Unauthorized: user not found or inactive'));
    }

    socket.userId = user.id;
    next();
  });

  // ==================== CONNECTION ====================
  io.on('connection', async (socket) => {
    await db.update('users', socket.userId, {
      isOnline: true,
      updatedAt: new Date().toISOString(),
    });

    socket.broadcast.emit('user:online', { userId: socket.userId });

    // ==================== DISCONNECT ====================
    socket.on('disconnect', async () => {
      const lastSeen = new Date().toISOString();

      await db.update('users', socket.userId, {
        isOnline: false,
        lastSeen,
        updatedAt: new Date().toISOString(),
      });

      socket.broadcast.emit('user:offline', {
        userId: socket.userId,
        lastSeen,
      });
    });
  });
}
