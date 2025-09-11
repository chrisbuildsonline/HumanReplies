// Environment configuration for HumanReplies extension
// This file handles different environments and API endpoints

class EnvironmentConfig {
  constructor() {
    this.environments = {
      development: {
        apiBaseURL: "http://localhost:8000/api/v1",
        dashboardURL: "http://localhost:3000",
        debug: true,
        supabase: {
          url: "https://anhcptguetscsoejzyed.supabase.co",
          anonKey:
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuaGNwdGd1ZXRzY3NvZWp6eWVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMTM4MTQsImV4cCI6MjA3MTg4OTgxNH0.LhZQib4k9BcMDZ_fM8pEyAe5m__fhuUxJdzJAKlb0kw",
        },
      },
      production: {
        apiBaseURL: "https://api.humanreplies.com/api/v1",
        dashboardURL: "https://humanreplies.com/dashboard",
        debug: false,
        supabase: {
          url: "https://anhcptguetscsoejzyed.supabase.co",
          anonKey:
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuaGNwdGd1ZXRzY3NvZWp6eWVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMTM4MTQsImV4cCI6MjA3MTg4OTgxNH0.LhZQib4k9BcMDZ_fM8pEyAe5m__fhuUxJdzJAKlb0kw",
        },
      },
    };

    // Default environment - change this for different builds
    this.currentEnvironment = "production";

    // Load persisted environment (local storage) – no auto production fallback
    this.loadEnvironment();
  }

  async loadEnvironment() {
    try {
      if (
        typeof chrome !== "undefined" &&
        chrome.storage &&
        chrome.storage.local
      ) {
        const result = await new Promise((resolve) => {
          chrome.storage.local.get(["environment"], resolve);
        });
        if (result.environment && this.environments[result.environment]) {
          this.currentEnvironment = result.environment;
        }
      }
    } catch (error) {
      console.warn(
        "EnvironmentConfig: loadEnvironment failed, keeping default:",
        error
      );
    }
    console.log(
      "[EnvironmentConfig] Active environment:",
      this.currentEnvironment
    );
  }

  detectEnvironment() {
    // Intentionally no-op now; we rely solely on explicit setting or default.
    // Left in place for backward compatibility if called elsewhere.
    return this.currentEnvironment;
  }

  getConfig() {
    return this.environments[this.currentEnvironment];
  }

  getApiBaseURL() {
    return this.getConfig().apiBaseURL;
  }

  // Removed getPollinationsURL() - now fetched from backend

  isDebugMode() {
    return this.getConfig().debug;
  }

  getCurrentEnvironment() {
    return this.currentEnvironment;
  }

  async setEnvironment(env) {
    if (this.environments[env]) {
      this.currentEnvironment = env;

      // Save to storage
      try {
        if (
          typeof chrome !== "undefined" &&
          chrome.storage &&
          chrome.storage.local
        ) {
          await new Promise((resolve) => {
            chrome.storage.local.set({ environment: env }, resolve);
          });
        }
        console.log("[EnvironmentConfig] Environment explicitly set to", env);
      } catch (error) {
        console.warn("Could not save environment to storage:", error);
      }
    }
  }

  // Method to override baseURL manually (for testing)
  async setCustomBaseURL(url) {
    try {
      if (
        typeof chrome !== "undefined" &&
        chrome.storage &&
        chrome.storage.local
      ) {
        await new Promise((resolve) => {
          chrome.storage.local.set({ customBaseURL: url }, resolve);
        });
      }

      // Update current config
      this.environments[this.currentEnvironment].apiBaseURL = url;
    } catch (error) {
      console.warn("Could not save custom base URL:", error);
    }
  }

  async getCustomBaseURL() {
    try {
      let result = {};
      if (
        typeof chrome !== "undefined" &&
        chrome.storage &&
        chrome.storage.local
      ) {
        result = await new Promise((resolve) => {
          chrome.storage.local.get(["customBaseURL"], resolve);
        });
      }
      return result.customBaseURL;
    } catch (error) {
      return null;
    }
  }

  getSupabaseConfig() {
    return this.getConfig().supabase;
  }

  getSupabaseUrl() {
    return this.getSupabaseConfig().url;
  }

  getSupabaseAnonKey() {
    return this.getSupabaseConfig().anonKey;
  }

  // API Status utilities
  async getApiStatus() {
    if (typeof chrome !== "undefined" && chrome.storage) {
      try {
        const result = await new Promise((resolve) => {
          chrome.storage.local.get(["humanreplies_api_status"], resolve);
        });

        if (result.humanreplies_api_status) {
          const status = result.humanreplies_api_status;
          const isRecent = Date.now() - status.lastChecked < 60000; // 1 minute
          return {
            isOnline: status.isOnline,
            lastChecked: status.lastChecked,
            isRecent: isRecent,
          };
        }
      } catch (error) {
        console.warn("Could not load API status:", error);
      }
    }
    return { isOnline: false, lastChecked: 0, isRecent: false };
  }

  async isApiOnline() {
    const status = await this.getApiStatus();
    return status.isRecent ? status.isOnline : false;
  }
}

// Create singleton instance
const environmentConfig = new EnvironmentConfig();

// Make available globally for non-module scripts (popup, etc.)
if (typeof window !== "undefined") {
  window.EnvironmentConfig = environmentConfig;
}

// ES module export for background script
export default environmentConfig;
