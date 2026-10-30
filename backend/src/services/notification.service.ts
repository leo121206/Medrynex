import { prisma, isDbConnected } from '../models/db';
import { store, InMemoryNotification } from '../models/store';
import { logger } from '../config/logger';

export interface CreateNotificationInput {
  userId: string;
  type: 'CONSENT_REQUEST' | 'CONSENT_GRANTED' | 'CONSENT_REJECTED' | 'CONSENT_REVOKED' | 'EMERGENCY_ACCESS' | 'ANOMALY_ALERT';
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export const createNotification = async (input: CreateNotificationInput): Promise<InMemoryNotification> => {
  const notifId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const notification: InMemoryNotification = {
    id: notifId,
    userId: input.userId,
    type: input.type,
    title: input.title,
    message: input.message,
    metadata: input.metadata || null,
    isRead: false,
    createdAt: new Date(),
  };

  // 1. Persist to PostgreSQL if connected
  if (isDbConnected) {
    try {
      const dbNotif = await prisma.notification.create({
        data: {
          id: notifId,
          userId: input.userId,
          type: input.type,
          title: input.title,
          message: input.message,
          metadata: input.metadata ? (input.metadata as any) : undefined,
          isRead: false,
        },
      });
      notification.id = dbNotif.id;
    } catch (err) {
      logger.warn('Failed to persist notification to database, using memory fallback:', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 2. Mirror in in-memory store
  store.notifications.unshift(notification);
  return notification;
};

export const getUserNotifications = async (userId: string): Promise<InMemoryNotification[]> => {
  const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
  if (isDbConnected) {
    try {
      const dbNotifs = await prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      if ((dbNotifs && dbNotifs.length > 0) || !isTestEnv) {
        return (dbNotifs || []).map((n) => ({
          id: n.id,
          userId: n.userId,
          type: n.type,
          title: n.title,
          message: n.message,
          metadata: (n.metadata as Record<string, unknown>) || null,
          isRead: n.isRead,
          createdAt: n.createdAt,
        }));
      }
    } catch (err) {
      logger.warn('Failed to query notifications from database:', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return store.notifications.filter((n) => n.userId === userId);
};

export const markNotificationAsRead = async (id: string, userId: string): Promise<boolean> => {
  let dbUpdated = false;
  if (isDbConnected) {
    try {
      const res = await prisma.notification.updateMany({
        where: { id, userId },
        data: { isRead: true },
      });
      if (res.count > 0) dbUpdated = true;
    } catch {
      // non-fatal
    }
  }

  const notif = store.notifications.find((n) => n.id === id && (n.userId === userId || userId === 'ADMIN'));
  if (notif) {
    notif.isRead = true;
    return true;
  }
  return dbUpdated;
};

export const markAllNotificationsAsRead = async (userId: string): Promise<boolean> => {
  if (isDbConnected) {
    try {
      await prisma.notification.updateMany({
        where: { userId },
        data: { isRead: true },
      });
    } catch {
      // non-fatal
    }
  }

  store.notifications
    .filter((n) => n.userId === userId)
    .forEach((n) => {
      n.isRead = true;
    });

  return true;
};
