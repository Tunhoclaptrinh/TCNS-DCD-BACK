import { Server, Socket } from 'socket.io';
import { logger } from '@utils/logger';

class SocketService {
  private io: Server | null = null;

  init(ioInstance: Server) {
    this.io = ioInstance;

    this.io.on('connection', (socket: Socket) => {
      logger.info(`Socket connected: ${socket.id}`, 'SOCKET');

      socket.on('joinRoom', (roomId: string) => {
        socket.join(roomId);
        logger.debug(`Socket ${socket.id} joined room: ${roomId}`, 'SOCKET');
      });

      socket.on('leaveRoom', (roomId: string) => {
        socket.leave(roomId);
        logger.debug(`Socket ${socket.id} left room: ${roomId}`, 'SOCKET');
      });

      socket.on('disconnect', () => {
        logger.info(`Socket disconnected: ${socket.id}`, 'SOCKET');
      });
    });
  }

  getIO(): Server {
    if (!this.io) {
      throw new Error('Socket.io server is not initialized!');
    }
    return this.io;
  }

  emitToRoom(roomId: string, event: string, data: any) {
    if (this.io) {
      this.io.to(roomId).emit(event, data);
    }
  }

  emitToUser(userId: string | number, event: string, data: any) {
    this.emitToRoom(`user_${userId}`, event, data);
  }
}

export const socketService = new SocketService();
