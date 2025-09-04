'use client';

import { useState, useEffect } from 'react';

interface HeaderProps {
  onSettingsClick: () => void;
}

export default function Header({ onSettingsClick }: HeaderProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Load saved theme
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' || 'light';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  return (
    <header className="dashboard-header">
      <div className="header-content">
        <div className="logo-section">
          <h1>HumanReplies</h1>
          <span className="version">v1.0.0</span>
        </div>
        <div className="header-actions">
          <button className="theme-toggle" onClick={toggleTheme}>
            <span className="theme-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
          </button>
          <button className="settings-btn" onClick={onSettingsClick}>
            Settings
          </button>
        </div>
      </div>
    </header>
  );
}