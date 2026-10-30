import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  listNotifications,
  markRead,
  markAllRead,
} from '../controllers/notification.controller';

const router = Router();

router.get('/', authenticate, listNotifications);
router.patch('/:id/read', authenticate, markRead);
router.post('/read-all', authenticate, markAllRead);

export default router;
