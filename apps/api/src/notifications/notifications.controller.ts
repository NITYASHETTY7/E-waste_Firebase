import {
  Controller,
  Get,
  Patch,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FirebaseService } from '../firebase/firebase.service';

const convertDate = (field: any): Date | null => {
  if (!field) return null;
  return typeof field.toDate === 'function' ? field.toDate() : new Date(field);
};

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private firebaseService: FirebaseService) {}

  @Get()
  async getMyNotifications(@Request() req: any) {
    const userId = req.user?.userId;
    const snap = await this.firebaseService.db
      .collection('users')
      .doc(userId)
      .collection('notifications')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    return snap.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: convertDate(doc.data().createdAt),
    }));
  }

  @Patch(':id/read')
  async markRead(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.userId;
    const notifRef = this.firebaseService.db
      .collection('users')
      .doc(userId)
      .collection('notifications')
      .doc(id);

    await notifRef.update({ read: true });
    return { count: 1 };
  }

  @Patch('read-all')
  async markAllRead(@Request() req: any) {
    const userId = req.user?.userId;
    const unreadSnap = await this.firebaseService.db
      .collection('users')
      .doc(userId)
      .collection('notifications')
      .where('read', '==', false)
      .get();

    const batch = this.firebaseService.db.batch();
    unreadSnap.forEach((doc: any) => {
      batch.update(doc.ref, { read: true });
    });
    await batch.commit();

    return { count: unreadSnap.size };
  }
}
