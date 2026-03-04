import jwt from 'jsonwebtoken';
import db from '@config/database';

export function initSocket(io) {
  // ==================== AUTH MIDDLEWARE ====================
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Unauthorized: no token'));

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return next(new Error('Unauthorized: invalid token'));
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
