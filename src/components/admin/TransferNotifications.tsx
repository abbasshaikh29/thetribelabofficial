"use client";

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { 
  Bell, 
  CheckCircle, 
  AlertCircle, 
  XCircle, 
  Clock, 
  DollarSign,
  TrendingUp,
  AlertTriangle,
  X,
  RefreshCw
} from 'lucide-react';

interface ITransferNotification {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  amount?: number;
  transferId?: string;
  timestamp: string;
  read: boolean;
  actionRequired: boolean;
  suggestedAction?: string;
}

interface ITransferStats {
  totalTransfers: number;
  successfulTransfers: number;
  failedTransfers: number;
  queuedTransfers: number;
  totalAmount: number;
  averageTransferTime: number;
  batchEfficiency: number;
}

export default function TransferNotifications() {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<ITransferNotification[]>([]);
  const [stats, setStats] = useState<ITransferStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (session) {
      fetchNotifications();
      fetchStats();
      
      // Set up polling for real-time updates
      const interval = setInterval(() => {
        fetchNotifications();
        fetchStats();
      }, 30000); // Every 30 seconds

      return () => clearInterval(interval);
    }
  }, [session]);

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/admin/transfer-notifications');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/transfer-processing');
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch(`/api/admin/transfer-notifications/${notificationId}/read`, {
        method: 'POST'
      });
      
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const dismissNotification = (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'error': return <XCircle className="w-5 h-5 text-red-500" />;
      default: return <AlertCircle className="w-5 h-5 text-blue-500" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return `₹${(amount / 100).toLocaleString('en-IN')}`;
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const urgentCount = notifications.filter(n => !n.read && n.actionRequired).length;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-600">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading...</span>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Notification Bell */}
      <button
        onClick={() => setShowNotifications(!showNotifications)}
        className="relative p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Stats Summary */}
      {stats && (
        <div className="hidden md:flex items-center gap-4 ml-4">
          <div className="flex items-center gap-1 text-sm text-gray-600">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <span>{stats.successfulTransfers}/{stats.totalTransfers}</span>
          </div>
          
          {stats.queuedTransfers > 0 && (
            <div className="flex items-center gap-1 text-sm text-yellow-600">
              <Clock className="w-4 h-4" />
              <span>{stats.queuedTransfers} queued</span>
            </div>
          )}
          
          {stats.failedTransfers > 0 && (
            <div className="flex items-center gap-1 text-sm text-red-600">
              <XCircle className="w-4 h-4" />
              <span>{stats.failedTransfers} failed</span>
            </div>
          )}
        </div>
      )}

      {/* Notifications Dropdown */}
      {showNotifications && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Transfer Notifications</h3>
              <button
                aria-label="Close notifications"
                title="Close notifications"
                onClick={() => setShowNotifications(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {urgentCount > 0 && (
              <div className="mt-2 text-sm text-red-600">
                {urgentCount} notification{urgentCount !== 1 ? 's' : ''} require{urgentCount === 1 ? 's' : ''} action
              </div>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>No notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50 cursor-pointer ${
                      !notification.read ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {getNotificationIcon(notification.type)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className={`text-sm font-medium ${
                            !notification.read ? 'text-gray-900' : 'text-gray-700'
                          }`}>
                            {notification.title}
                          </h4>
                          <button
                            aria-label="Dismiss notification"
                            title="Dismiss notification"
                            onClick={(e) => {
                              e.stopPropagation();
                              dismissNotification(notification.id);
                            }}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        
                        <p className="text-sm text-gray-600 mt-1">
                          {notification.message}
                        </p>
                        
                        {notification.amount && (
                          <div className="flex items-center gap-1 mt-2 text-sm text-green-600">
                            <DollarSign className="w-3 h-3" />
                            {formatCurrency(notification.amount)}
                          </div>
                        )}
                        
                        {notification.suggestedAction && (
                          <div className="mt-2 p-2 bg-yellow-50 rounded text-xs text-yellow-800">
                            <strong>Action:</strong> {notification.suggestedAction}
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-gray-500">
                            {formatTime(notification.timestamp)}
                          </span>
                          
                          {notification.actionRequired && (
                            <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                              Action Required
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between text-sm">
              <button
                onClick={fetchNotifications}
                className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Refresh
              </button>
              
              <a
                href="/admin/transfers"
                className="text-blue-600 hover:text-blue-800"
              >
                View all transfers →
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
