'use client';

import { DashboardStats } from '@/types';

interface StatsGridProps {
  stats: DashboardStats;
}

export default function StatsGrid({ stats }: StatsGridProps) {
  const capitalizeFirst = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  return (
    <section className="stats-section">
      <h2>Usage Statistics</h2>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">💬</div>
          <div className="stat-content">
            <h3>{stats.totalReplies.toLocaleString()}</h3>
            <p>Total Replies Generated</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div className="stat-content">
            <h3>{stats.todayReplies.toLocaleString()}</h3>
            <p>Replies Today</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⚡</div>
          <div className="stat-content">
            <h3>{stats.avgResponseTime}ms</h3>
            <p>Avg Response Time</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🎯</div>
          <div className="stat-content">
            <h3>{capitalizeFirst(stats.favoriteMode)}</h3>
            <p>Most Used Tone</p>
          </div>
        </div>
      </div>
    </section>
  );
}