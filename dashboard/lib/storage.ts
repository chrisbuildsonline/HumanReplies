import { DashboardStats, ExtensionSettings, Activity, ChromeStorage } from '@/types';

// Mock Chrome storage for development
const mockStorage = {
  data: {} as ChromeStorage,
  
  get: async (keys: string[] | string): Promise<ChromeStorage> => {
    if (typeof keys === 'string') {
      return { [keys]: mockStorage.data[keys as keyof ChromeStorage] };
    }
    const result: ChromeStorage = {};
    keys.forEach(key => {
      result[key as keyof ChromeStorage] = mockStorage.data[key as keyof ChromeStorage];
    });
    return result;
  },
  
  set: async (data: ChromeStorage): Promise<void> => {
    Object.assign(mockStorage.data, data);
    localStorage.setItem('humanRepliesMockData', JSON.stringify(mockStorage.data));
  },
  
  clear: async (): Promise<void> => {
    mockStorage.data = {};
    localStorage.removeItem('humanRepliesMockData');
  }
};

// Initialize mock data from localStorage
if (typeof window !== 'undefined') {
  const saved = localStorage.getItem('humanRepliesMockData');
  if (saved) {
    try {
      mockStorage.data = JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse mock data from localStorage');
    }
  }
}

export class StorageService {
  private static get storage() {
    if (typeof window !== 'undefined' && window.chrome?.storage) {
      return window.chrome.storage.local;
    }
    return mockStorage;
  }

  static async getStats(): Promise<DashboardStats> {
    const result = await this.storage.get('humanRepliesStats');
    return result.humanRepliesStats || {
      totalReplies: 0,
      todayReplies: 0,
      avgResponseTime: 0,
      favoriteMode: 'neutral',
      dailyUsage: [],
      toneDistribution: {}
    };
  }

  static async setStats(stats: DashboardStats): Promise<void> {
    await this.storage.set({ humanRepliesStats: stats });
  }

  static async getSettings(): Promise<ExtensionSettings> {
    const result = await this.storage.get('humanRepliesSettings');
    return result.humanRepliesSettings || {
      apiKey: '',
      defaultTone: 'neutral',
      autoShow: true,
      collectStats: true
    };
  }

  static async setSettings(settings: ExtensionSettings): Promise<void> {
    await this.storage.set({ humanRepliesSettings: settings });
  }

  static async getActivity(): Promise<Activity[]> {
    const result = await this.storage.get('humanRepliesActivity');
    return result.humanRepliesActivity || [];
  }

  static async setActivity(activity: Activity[]): Promise<void> {
    await this.storage.set({ humanRepliesActivity: activity });
  }

  static async clearAll(): Promise<void> {
    await this.storage.clear();
  }

  static async testApiConnection(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: 'Test connection' }],
          max_tokens: 10
        })
      });
      
      return response.ok;
    } catch (error) {
      console.error('API test failed:', error);
      return false;
    }
  }
}