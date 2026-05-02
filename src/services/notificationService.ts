import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { NotificationType, NotificationCategory } from '../components/NotificationSystem';

export interface CreateNotificationParams {
  userId?: string;
  title: string;
  message: string;
  type: NotificationType;
  category: NotificationCategory;
  relatedId?: string;
}

export const createNotification = async (params: CreateNotificationParams) => {
  try {
    const userId = params.userId || auth.currentUser?.uid;
    if (!userId) return null;

    const notificationData = {
      userId,
      title: params.title,
      message: params.message,
      type: params.type,
      category: params.category,
      relatedId: params.relatedId || null,
      status: 'unread',
      createdAt: new Date().toISOString()
    };

    const docRef = await addDoc(collection(db, 'notifications'), notificationData);
    return docRef.id;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
};

export const notifySignificantDelay = (flightName: string, minutes: number, userId?: string) => {
  return createNotification({
    userId,
    title: `Significant Delay: ${flightName}`,
    message: `A delay of ${minutes} minutes has been detected. Operational adjustments may be required.`,
    type: minutes > 60 ? 'critical' : 'warning',
    category: 'delay'
  });
};

export const notifyWeatherChange = (airport: string, condition: string, userId?: string) => {
  return createNotification({
    userId,
    title: `Weather Alert: ${airport}`,
    message: `Weather conditions at ${airport} have shifted to ${condition}. Check visibility and crosswind limits.`,
    type: 'warning',
    category: 'weather'
  });
};

export const notifyAirspaceAlert = (firCode: string, alert: string, userId?: string) => {
  return createNotification({
    userId,
    title: `Airspace Alert: ${firCode}`,
    message: `New restriction or warning in ${firCode} FIR: ${alert}`,
    type: 'critical',
    category: 'airspace'
  });
};
