export interface DashboardStats {
  totalReplies: number;
  todayReplies: number;
  avgResponseTime: number;
  favoriteMode: string;
  dailyUsage: DailyUsage[];
  toneDistribution: Record<string, number>;
}

export interface DailyUsage {
  date: string;
  count: number;
  label?: string;
}

export interface ExtensionSettings {
  apiKey: string;
  defaultTone: ReplyTone;
  autoShow: boolean;
  collectStats: boolean;
}

export interface Activity {
  id: string;
  action: string;
  timestamp: number;
  platform?: string;
  tone?: ReplyTone;
}

export type ReplyTone = 'neutral' | 'joke' | 'support' | 'idea' | 'question';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface ChromeStorage {
  humanRepliesStats?: DashboardStats;
  humanRepliesSettings?: ExtensionSettings;
  humanRepliesActivity?: Activity[];
}

declare global {
  interface Window {
    chrome?: {
      storage: {
        local: {
          get: (keys: string[] | string) => Promise<any>;
          set: (data: any) => Promise<void>;
          clear: () => Promise<void>;
        };
      };
    };
  }
}