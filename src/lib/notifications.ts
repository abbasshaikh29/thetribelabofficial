import { dbconnect } from './db';
import mongoose from 'mongoose';
import { Notification, INotification } from '@/models/Notification';

export interface NotificationData {
  userId: string;
  title: string;
  message: string;
  type: string;
  linkUrl?: string;
  metadata?: Record<string, any>;
}

/**
 * Creates a new notification for a user
 */
export async function createNotification(data: NotificationData) {
  try {
    await dbconnect();
    
    const notification = new Notification({
      userId: new mongoose.Types.ObjectId(data.userId),
      title: data.title,
      message: data.message,
      type: data.type,
      linkUrl: data.linkUrl,
      metadata: data.metadata,
      isRead: false,
      createdAt: new Date()
    });
    
    await notification.save();
    
    console.log(`Created notification for user ${data.userId}: ${data.title}`);
    return { success: true, notification };
  } catch (error) {
    console.error('Error creating notification:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Gets unread notifications for a user
 */
export async function getUnreadNotifications(userId: string) {
  try {
    await dbconnect();
    
    const notifications = await Notification.find({
      userId: new mongoose.Types.ObjectId(userId),
      isRead: false
    }).sort({ createdAt: -1 }).lean();
    
    return { success: true, notifications };
  } catch (error) {
    console.error('Error getting unread notifications:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Marks a notification as read
 */
export async function markNotificationAsRead(notificationId: string) {
  try {
    await dbconnect();
    
    await Notification.findByIdAndUpdate(notificationId, { isRead: true });
    
    return { success: true };
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return { success: false, error: String(error) };
  }
}
