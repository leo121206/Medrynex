/**
 * notification.service.ts — Real API integration only.
 * Backend route: /api/v1/notifications  (GET, PATCH /:id/read, POST /read-all)
 */
import { NotificationItem } from '../types/notification';
import { apiRequest } from './apiClient';

export const notificationService = {
  async getNotifications(): Promise<NotificationItem[]> {
    return apiRequest<NotificationItem[]>('/notifications');
  },

  async markAsRead(id: string): Promise<void> {
    await apiRequest<void>(`/notifications/${id}/read`, { method: 'PATCH' });
  },

  async markAllAsRead(): Promise<void> {
    await apiRequest<void>('/notifications/read-all', { method: 'POST' });
  },
};
