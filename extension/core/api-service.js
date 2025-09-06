// Core API service for HumanReplies

class HumanRepliesAPI {
  constructor() {
    // Initialize with environment config
    this.initializeConfig();
    this.serviceUrls = null; // Cache for service URLs
    this.urlsCacheExpiry = null;
  }

  async initializeConfig() {
    // Load environment configuration
    if (typeof window !== "undefined" && window.EnvironmentConfig) {
      await window.EnvironmentConfig.loadEnvironment();
      this.baseURL = window.EnvironmentConfig.getApiBaseURL();
      this.debugMode = window.EnvironmentConfig.isDebugMode();
      
      // Check for custom base URL override
      const customURL = await window.EnvironmentConfig.getCustomBaseURL();
      if (customURL) {
        this.baseURL = customURL;
      }
    } else {
      // Fallback configuration
      this.baseURL = "http://localhost:8000/api/v1"; // Default to local development
      this.debugMode = true;
    }

    if (this.debugMode) {
      console.log(`HumanReplies API initialized with baseURL: ${this.baseURL}`);
    }
  }

  async generateReply(context, options = {}) {
    // Ensure config is loaded
    if (!this.baseURL) {
      await this.initializeConfig();
    }

    // Always use our backend now (no more fallback mode)
    return this.generateWithBackend(context, options);
  }

  async generateWithBackend(context, options) {
    // Generate reply using our FastAPI backend (which proxies to external services)
    try {
      if (this.debugMode) {
        console.log(`Making request to: ${this.baseURL}/services/generate-reply`);
      }

      const response = await fetch(`${this.baseURL}/services/generate-reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await this.getUserToken()}`,
        },
        body: JSON.stringify({
          context: context,
          platform: options.platform || "x",
          tone: options.tone || "helpful",
          length: options.length || "medium",
          user_writing_style: options.userWritingStyle || null,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Authentication required. Please sign in.");
        }
        if (response.status === 429) {
          throw new Error("Daily limit reached. Upgrade for unlimited replies.");
        }
        if (response.status === 503) {
          throw new Error("AI service is temporarily unavailable. Please try again later.");
        }
        
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Service unavailable: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        reply: data.reply,
        remainingReplies: data.remaining_replies,
        isLimitReached: data.is_limit_reached,
        serviceUsed: data.service_used,
      };
    } catch (error) {
      console.error("Backend API error:", error);
      throw error;
    }
  }

  async getServiceUrls() {
    // Get service URLs from backend (cached for 1 hour)
    try {
      // Check if we have cached URLs that are still valid
      if (this.serviceUrls && this.urlsCacheExpiry && new Date() < this.urlsCacheExpiry) {
        return this.serviceUrls;
      }

      if (this.debugMode) {
        console.log(`Fetching service URLs from: ${this.baseURL}/services/urls`);
      }

      const response = await fetch(`${this.baseURL}/services/urls`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch service URLs: ${response.status}`);
      }

      const data = await response.json();
      
      // Cache the URLs
      this.serviceUrls = data;
      this.urlsCacheExpiry = data.cache_expires_at ? new Date(data.cache_expires_at) : new Date(Date.now() + 60 * 60 * 1000); // 1 hour fallback
      
      if (this.debugMode) {
        console.log("Service URLs updated:", data);
      }
      
      return data;
    } catch (error) {
      console.error("Failed to fetch service URLs:", error);
      
      // Return cached URLs if available, otherwise throw
      if (this.serviceUrls) {
        console.warn("Using cached service URLs due to fetch error");
        return this.serviceUrls;
      }
      
      throw error;
    }
  }

  // buildPrompt method removed - now handled by backend

  async getUserToken() {
    // Future implementation - get user auth token
    return new Promise((resolve) => {
      chrome.storage.sync.get(["userToken"], (result) => {
        resolve(result.userToken || null);
      });
    });
  }

  // storeReply method removed - now handled automatically by backend

  async checkUserLimits() {
    // Check daily limits from backend
    try {
      const response = await fetch(`${this.baseURL}/user/limits`, {
        headers: {
          Authorization: `Bearer ${await this.getUserToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to check limits: ${response.status}`);
      }

      const data = await response.json();
      return {
        remainingReplies: data.remainingReplies,
        isLimitReached: data.remainingReplies <= 0,
      };
    } catch (error) {
      console.error("Failed to check limits:", error);
      // Return unlimited for now if we can't check limits
      return { remainingReplies: null, isLimitReached: false };
    }
  }

  async getServiceStatus() {
    // Get status of external services
    try {
      const urls = await this.getServiceUrls();
      return {
        pollinations: {
          url: urls.pollinations_url,
          lastUpdated: urls.last_updated,
          cacheExpiresAt: urls.cache_expires_at,
        },
      };
    } catch (error) {
      console.error("Failed to get service status:", error);
      return null;
    }
  }
}

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = HumanRepliesAPI;
} else {
  window.HumanRepliesAPI = HumanRepliesAPI;
}
