export type NotificationCategory = 
  | 'request' 
  | 'anomaly' 
  | 'emergency' 
  | 'approved' 
  | 'expiring' 
  | 'reconciliation' 
  | 'dispute';

export interface NotificationItem {
  id: string;
  userId: string;
  category: NotificationCategory;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  actionUrl?: string;
  severity?: 'info' | 'warning' | 'danger' | 'success';
}
