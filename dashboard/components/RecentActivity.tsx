'use client';

import { useEffect, useState } from 'react';
import { Activity } from '@/types';
import { StorageService } from '@/lib/storage';

export default function RecentActivity() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivity();
  }, []);

  const loadActivity = async () => {
    try {
      const activityData = await StorageService.getActivity();
      setActivities(activityData.slice(-10).reverse()); // Last 10, most recent first
    } catch (error) {
      console.error('Error loading activity:', error);
    } finally {
      setLoading(false);
    }
  };

  const capitalizeFirst = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  if (loading) {
    return (
      <section className="activity-section">
        <h2>Recent Activity</h2>
        <div className="activity-list">
          <div className="activity-item">
            <div className="activity-content">
              <div className="activity-title">Loading...</div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="activity-section">
      <h2>Recent Activity</h2>
      <div className="activity-list">
        {activities.length === 0 ? (
          <div className="activity-item">
            <div className="activity-content">
              <div className="activity-title">No recent activity</div>
              <div className="activity-meta">Start using HumanReplies to see your activity here</div>
            </div>
          </div>
        ) : (
          activities.map((activity) => (
            <div key={activity.id} className="activity-item">
              <div className="activity-content">
                <div className="activity-title">{activity.action}</div>
                <div className="activity-meta">
                  {new Date(activity.timestamp).toLocaleString()} • 
                  Platform: {activity.platform || 'Unknown'}
                </div>
              </div>
              <div className={`activity-badge badge-${activity.tone || 'neutral'}`}>
                {capitalizeFirst(activity.tone || 'neutral')}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}