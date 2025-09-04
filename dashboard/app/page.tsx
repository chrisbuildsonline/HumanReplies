'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import StatsGrid from '@/components/StatsGrid';
import Charts from '@/components/Charts';
import RecentActivity from '@/components/RecentActivity';
import SettingsModal from '@/components/SettingsModal';
import Notification from '@/components/Notification';
import { DashboardStats, NotificationType } from '@/types';
import { StorageService } from '@/lib/storage';

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalReplies: 0,
    todayReplies: 0,
    avgResponseTime: 0,
    favoriteMode: 'neutral',
    dailyUsage: [],
    toneDistribution: {}
  });
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [notification, setNotification] = useState<{
    message: string;
    type: NotificationType;
  } | null>(null);

  useEffect(() => {
    loadStats();
    
    // Auto-refresh stats every 30 seconds
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadStats = async () => {
    try {
      const statsData = await StorageService.getStats();
      
      // Calculate today's replies
      const today = new Date().toDateString();
      const todayData = statsData.dailyUsage.find(day => day.date === today);
      statsData.todayReplies = todayData ? todayData.count : 0;
      
      setStats(statsData);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const showNotification = (message: string, type: NotificationType) => {
    setNotification({ message, type });
  };

  const closeNotification = () => {
    setNotification(null);
  };

  return (
    <div className="dashboard-container">
      <Header onSettingsClick={() => setIsSettingsOpen(true)} />
      
      <main className="dashboard-main">
        <StatsGrid stats={stats} />
        <Charts stats={stats} />
        <RecentActivity />
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onNotification={showNotification}
      />

      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={closeNotification}
        />
      )}
    </div>
  );
}