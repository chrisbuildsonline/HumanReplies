'use client';

import { useState, useEffect } from 'react';
import { ExtensionSettings, ReplyTone, NotificationType } from '@/types';
import { StorageService } from '@/lib/storage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification: (message: string, type: NotificationType) => void;
}

export default function SettingsModal({ isOpen, onClose, onNotification }: SettingsModalProps) {
  const [settings, setSettings] = useState<ExtensionSettings>({
    apiKey: '',
    defaultTone: 'neutral',
    autoShow: true,
    collectStats: true
  });
  const [isTestingApi, setIsTestingApi] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      const currentSettings = await StorageService.getSettings();
      setSettings(currentSettings);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleSave = async () => {
    try {
      await StorageService.setSettings(settings);
      onNotification('Settings saved successfully!', 'success');
      onClose();
    } catch (error) {
      console.error('Error saving settings:', error);
      onNotification('Error saving settings', 'error');
    }
  };

  const handleTestApi = async () => {
    if (!settings.apiKey) {
      onNotification('Please enter an API key first', 'warning');
      return;
    }

    setIsTestingApi(true);
    try {
      const isValid = await StorageService.testApiConnection(settings.apiKey);
      if (isValid) {
        onNotification('API connection successful!', 'success');
      } else {
        onNotification('API connection failed', 'error');
      }
    } catch (error) {
      onNotification('API connection failed', 'error');
    } finally {
      setIsTestingApi(false);
    }
  };

  const handleClearData = async () => {
    if (confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
      try {
        await StorageService.clearAll();
        onNotification('All data cleared successfully', 'success');
        onClose();
        // Reload page to refresh all data
        window.location.reload();
      } catch (error) {
        console.error('Error clearing data:', error);
        onNotification('Error clearing data', 'error');
      }
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay active" onClick={handleOverlayClick}>
      <div className="modal-content">
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="settings-section">
            <h3>API Configuration</h3>
            <div className="form-group">
              <label htmlFor="apiKey">DeepSeek API Key</label>
              <input
                type="password"
                id="apiKey"
                placeholder="Enter your API key"
                value={settings.apiKey}
                onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
              />
              <button
                className="test-api-btn"
                onClick={handleTestApi}
                disabled={isTestingApi}
              >
                {isTestingApi ? 'Testing...' : 'Test Connection'}
              </button>
            </div>
          </div>
          
          <div className="settings-section">
            <h3>Default Settings</h3>
            <div className="form-group">
              <label htmlFor="defaultTone">Default Reply Tone</label>
              <select
                id="defaultTone"
                value={settings.defaultTone}
                onChange={(e) => setSettings({ ...settings, defaultTone: e.target.value as ReplyTone })}
              >
                <option value="neutral">Neutral</option>
                <option value="joke">Joke</option>
                <option value="support">Support</option>
                <option value="idea">Idea</option>
                <option value="question">Question</option>
              </select>
            </div>
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.autoShow}
                  onChange={(e) => setSettings({ ...settings, autoShow: e.target.checked })}
                />
                <span className="checkmark">Auto-show toolbar on text selection</span>
              </label>
            </div>
          </div>

          <div className="settings-section">
            <h3>Privacy & Data</h3>
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.collectStats}
                  onChange={(e) => setSettings({ ...settings, collectStats: e.target.checked })}
                />
                <span className="checkmark">Collect usage statistics</span>
              </label>
            </div>
            <div className="form-group">
              <button className="danger-btn" onClick={handleClearData}>
                Clear All Data
              </button>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}