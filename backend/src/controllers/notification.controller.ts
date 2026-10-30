import { Request, Response } from 'express';
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../services/notification.service';
import { ApiResponse } from '../utils/apiResponse';

export const listNotifications = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const result = await getUserNotifications(userId);
  return ApiResponse.success(res, result, 'User notifications fetched successfully');
};

export const markRead = async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const userId = req.user!.id;
  const success = await markNotificationAsRead(id, userId);
  return ApiResponse.success(res, { success }, 'Notification marked as read');
};

export const markAllRead = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const success = await markAllNotificationsAsRead(userId);
  return ApiResponse.success(res, { success }, 'All notifications marked as read');
};
