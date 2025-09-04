'use client';

import { useEffect, useRef } from 'react';
import { DashboardStats, DailyUsage } from '@/types';

interface ChartsProps {
  stats: DashboardStats;
}

export default function Charts({ stats }: ChartsProps) {
  const usageChartRef = useRef<HTMLCanvasElement>(null);
  const toneChartRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (usageChartRef.current) {
      drawUsageChart();
    }
    if (toneChartRef.current) {
      drawToneChart();
    }
  }, [stats]);

  const getLast7DaysData = (): DailyUsage[] => {
    const days: DailyUsage[] = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateString = date.toDateString();
      
      const dayData = stats.dailyUsage.find(d => d.date === dateString);
      days.push({
        date: dateString,
        label: date.toLocaleDateString('en-US', { weekday: 'short' }),
        count: dayData ? dayData.count : 0
      });
    }
    
    return days;
  };

  const drawUsageChart = () => {
    const canvas = usageChartRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const last7Days = getLast7DaysData();
    
    // Chart dimensions
    const padding = 40;
    const chartWidth = canvas.width - (padding * 2);
    const chartHeight = canvas.height - (padding * 2);
    
    // Find max value for scaling
    const maxValue = Math.max(...last7Days.map(d => d.count), 1);
    
    // Get CSS custom properties
    const computedStyle = getComputedStyle(document.documentElement);
    const borderColor = computedStyle.getPropertyValue('--border-color').trim();
    const primaryColor = computedStyle.getPropertyValue('--primary-color').trim();
    const textSecondary = computedStyle.getPropertyValue('--text-secondary').trim();
    
    // Draw axes
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    
    // Y-axis
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, canvas.height - padding);
    ctx.stroke();
    
    // X-axis
    ctx.beginPath();
    ctx.moveTo(padding, canvas.height - padding);
    ctx.lineTo(canvas.width - padding, canvas.height - padding);
    ctx.stroke();
    
    // Draw bars
    const barWidth = chartWidth / last7Days.length * 0.8;
    const barSpacing = chartWidth / last7Days.length * 0.2;
    
    ctx.fillStyle = primaryColor;
    
    last7Days.forEach((day, index) => {
      const barHeight = (day.count / maxValue) * chartHeight;
      const x = padding + (index * (barWidth + barSpacing)) + (barSpacing / 2);
      const y = canvas.height - padding - barHeight;
      
      ctx.fillRect(x, y, barWidth, barHeight);
      
      // Draw labels
      ctx.fillStyle = textSecondary;
      ctx.font = '12px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(day.label || '', x + (barWidth / 2), canvas.height - padding + 20);
      
      ctx.fillStyle = primaryColor;
    });
  };

  const drawToneChart = () => {
    const canvas = toneChartRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const tones = Object.keys(stats.toneDistribution);
    if (tones.length === 0) return;
    
    const total = Object.values(stats.toneDistribution).reduce((sum, count) => sum + count, 0);
    if (total === 0) return;
    
    // Chart dimensions
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 20;
    
    // Colors for different tones
    const colors: Record<string, string> = {
      neutral: '#1a73e8',
      joke: '#f9ab00',
      support: '#34a853',
      idea: '#ea4335',
      question: '#9c27b0'
    };
    
    let currentAngle = -Math.PI / 2; // Start from top
    
    tones.forEach(tone => {
      const count = stats.toneDistribution[tone];
      const sliceAngle = (count / total) * 2 * Math.PI;
      
      // Draw slice
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = colors[tone] || '#666';
      ctx.fill();
      
      // Draw label
      const labelAngle = currentAngle + (sliceAngle / 2);
      const labelX = centerX + Math.cos(labelAngle) * (radius * 0.7);
      const labelY = centerY + Math.sin(labelAngle) * (radius * 0.7);
      
      ctx.fillStyle = 'white';
      ctx.font = '12px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round((count / total) * 100)}%`, labelX, labelY);
      
      currentAngle += sliceAngle;
    });
  };

  return (
    <section className="charts-section">
      <div className="chart-container">
        <h3>Daily Usage</h3>
        <canvas ref={usageChartRef} width={400} height={200} />
      </div>
      <div className="chart-container">
        <h3>Tone Distribution</h3>
        <canvas ref={toneChartRef} width={400} height={200} />
      </div>
    </section>
  );
}