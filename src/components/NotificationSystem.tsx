import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Bell, X, Info, AlertTriangle, AlertCircle, CheckCircle2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export type NotificationType = 'info' | 'warning' | 'critical' | 'success';
export type NotificationStatus = 'unread' | 'read' | 'dismissed';
export type NotificationCategory = 'delay' | 'weather' | 'airspace' | 'technical' | 'system';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  status: NotificationStatus;
  relatedId?: string;
  category: NotificationCategory;
  createdAt: string;
}

const NotificationSystem: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      where('status', '!=', 'dismissed'),
      orderBy('status'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];
      
      setNotifications(fetched);
      setUnreadCount(fetched.filter(n => n.status === 'unread').length);
    });

    return () => unsubscribe();
  }, [auth.currentUser]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { status: 'read' });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const unread = notifications.filter(n => n.status === 'unread');
      if (unread.length === 0) return;

      const batch = writeBatch(db);
      unread.forEach(n => {
        batch.update(doc(db, 'notifications', n.id), { status: 'read' });
      });
      await batch.commit();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const dismissNotification = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { status: 'dismissed' });
    } catch (error) {
      console.error('Error dismissing notification:', error);
    }
  };

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'critical': return <AlertCircle className="text-rose-500" size={18} />;
      case 'warning': return <AlertTriangle className="text-amber-500" size={18} />;
      case 'success': return <CheckCircle2 className="text-emerald-500" size={18} />;
      default: return <Info className="text-indigo-500" size={18} />;
    }
  };

  const getTypeStyles = (type: NotificationType) => {
    switch (type) {
      case 'critical': return 'border-rose-100 bg-rose-50 dark:bg-rose-900/10';
      case 'warning': return 'border-amber-100 bg-amber-50 dark:bg-amber-900/10';
      case 'success': return 'border-emerald-100 bg-emerald-50 dark:bg-emerald-900/10';
      default: return 'border-indigo-100 bg-indigo-50 dark:bg-indigo-900/10';
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <Bell className={unreadCount > 0 ? "text-indigo-600 animate-pulse" : "text-gray-500"} size={22} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40 bg-black/5"
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-80 max-h-[500px] bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 z-50 overflow-hidden flex flex-col"
            >
              <div className="p-5 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between">
                <h3 className="text-sm font-black text-indigo-900 dark:text-white uppercase tracking-widest">Alert Center</h3>
                {unreadCount > 0 && (
                  <button 
                    onClick={markAllAsRead}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {notifications.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="w-12 h-12 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Bell className="text-gray-300" size={20} />
                    </div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No active alerts</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <motion.div
                      key={n.id}
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`p-3 rounded-2xl border ${getTypeStyles(n.type)} flex gap-3 relative group transition-opacity ${n.status === 'read' ? 'opacity-70' : 'opacity-100'}`}
                      onClick={() => n.status === 'unread' && markAsRead(n.id)}
                    >
                      <div className="mt-0.5">{getIcon(n.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[11px] font-black text-indigo-900 dark:text-white uppercase truncate pr-4">{n.title}</p>
                          <span className="text-[8px] font-bold text-gray-400 uppercase">
                            {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">{n.message}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          dismissNotification(n.id);
                        }}
                        className="absolute top-2 right-2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-opacity"
                      >
                        <X size={10} className="text-gray-400" />
                      </button>
                    </motion.div>
                  ))
                )}
              </div>

              {notifications.length > 0 && (
                <div className="p-3 border-t border-gray-50 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="w-full py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors"
                  >
                    Close
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationSystem;
