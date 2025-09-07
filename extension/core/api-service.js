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
        console.log(
          `Making request to: ${this.baseURL}/services/generate-reply`
        );
      }

      // Get the token if available, but we'll proceed without it if not present
      const userToken = await this.getUserToken();
      const headers = {
        "Content-Type": "application/json",
      };

      // Only add the Authorization header if we have a token
      if (userToken) {
        headers.Authorization = `Bearer ${userToken}`;
      }

      const response = await fetch(`${this.baseURL}/services/generate-reply`, {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
          context: context,
          platform: options.platform || "x",
          tone: options.tone || "helpful",
          length: options.length || "medium",
          user_writing_style: options.userWritingStyle || null,
        }),
      });

      if (!response.ok) {
        // No longer requiring authentication - just passing through the error message
        if (response.status === 429) {
          throw new Error(
            "Daily limit reached. Upgrade for unlimited replies."
          );
        }
        if (response.status === 503) {
          throw new Error(
            "AI service is temporarily unavailable. Please try again later."
          );
        }

        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `Service unavailable: ${response.status}`
        );
      }

      const data = await response.json();

      // If the backend didn't generate a response, use pollinations directly from client
      let finalReply = data.generated_response;

      if (!finalReply && data.generated_prompt) {
        if (this.debugMode) {
          console.log(
            "Backend returned prompt but no response, using pollinations directly"
          );
        }

        // Get service URLs to fetch the pollinations endpoint
        const serviceUrls = await this.getServiceUrls();
        const pollinationsUrl = serviceUrls.pollinations_url;

        if (pollinationsUrl) {
          // Make direct request to pollinations with the generated prompt
          const encodedPrompt = encodeURIComponent(data.generated_prompt);
          const pollinationsResponse = await fetch(
            `${pollinationsUrl}/${encodedPrompt}?seed=${Mapath.random()
              .toString(36)
              .substring(2, 10)}`,
            {
              method: "GET",
              headers: { Accept: "text/plain" },
            }
          );

          if (pollinationsResponse.ok) {
            finalReply = await pollinationsResponse.text();
            finalReply = finalReply.trim().replace(/^["']|["']$/g, ""); // Remove surrounding quotes
          } else {
            throw new Error("Failed to generate response from AI service");
          }
        } else {
          throw new Error("AI service URL not available");
        }
      }

      return {
        reply: finalReply,
        remainingReplies: data.remaining_replies || null,
        isLimitReached: data.is_limit_reached || false,
        serviceUsed: "pollinations",
        generatedPrompt: data.generated_prompt,
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
      if (
        this.serviceUrls &&
        this.urlsCacheExpiry &&
        new Date() < this.urlsCacheExpiry
      ) {
        return this.serviceUrls;
      }

      if (this.debugMode) {
        console.log(
          `Fetching service URLs from: ${this.baseURL}/services/urls`
        );
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
      this.urlsCacheExpiry = data.cache_expires_at
        ? new Date(data.cache_expires_at)
        : new Date(Date.now() + 60 * 60 * 1000); // 1 hour fallback

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
      // Get the token if available, but we'll proceed without it if not present
      const userToken = await this.getUserToken();
      const headers = {};

      // Only add the Authorization header if we have a token
      if (userToken) {
        headers.Authorization = `Bearer ${userToken}`;
      }

      const response = await fetch(`${this.baseURL}/user/limits`, {
        headers: headers,
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

  async getTones() {
    // Get available tones from backend (includes user's custom tones if authenticated)
    try {
      // Ensure config is loaded
      if (!this.baseURL) {
        await this.initializeConfig();
      }

      if (this.debugMode) {
        console.log(`Fetching tones from: ${this.baseURL}/tones`);
      }

      // Get the token if available
      const userToken = await this.getUserToken();
      const headers = {
        "Content-Type": "application/json",
      };

      // Add authorization header if we have a token
      if (userToken) {
        headers.Authorization = `Bearer ${userToken}`;
      }

      const response = await fetch(`${this.baseURL}/tones/`, {
        method: "GET",
        headers: headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch tones: ${response.status}`);
      }

      const data = await response.json();

      if (this.debugMode) {
        console.log("Tones fetched:", data);
      }

      return data.tones || [];
    } catch (error) {
      console.error("Failed to fetch tones:", error);
      
      // Return fallback tones if API fails
      return [
        { name: "ask", display_name: "Always ask me" },
        { name: "neutral", display_name: "👍 Neutral" },
        { name: "joke", display_name: "😂 Joke" },
        { name: "support", display_name: "❤️ Support" },
        { name: "idea", display_name: "💡 Idea" },
        { name: "question", display_name: "❓ Question" },
        { name: "confident", display_name: "💪 Confident" }
      ];
    }
  }

  async createCustomTone(toneData) {
    // Create a custom tone for the authenticated user
    try {
      if (!this.baseURL) {
        await this.initializeConfig();
      }

      const userToken = await this.getUserToken();
      if (!userToken) {
        throw new Error("Authentication required to create custom tones");
      }

      const response = await fetch(`${this.baseURL}/tones/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${userToken}`,
        },
        body: JSON.stringify(toneData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to create tone: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Failed to create custom tone:", error);
      throw error;
    }
  }

  async updateCustomTone(toneId, toneData) {
    // Update a custom tone
    try {
      if (!this.baseURL) {
        await this.initializeConfig();
      }

      const userToken = await this.getUserToken();
      if (!userToken) {
        throw new Error("Authentication required to update custom tones");
      }

      const response = await fetch(`${this.baseURL}/tones/${toneId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${userToken}`,
        },
        body: JSON.stringify(toneData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to update tone: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Failed to update custom tone:", error);
      throw error;
    }
  }

  async deleteCustomTone(toneId) {
    // Delete a custom tone
    try {
      if (!this.baseURL) {
        await this.initializeConfig();
      }

      const userToken = await this.getUserToken();
      if (!userToken) {
        throw new Error("Authentication required to delete custom tones");
      }

      const response = await fetch(`${this.baseURL}/tones/${toneId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${userToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to delete tone: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Failed to delete custom tone:", error);
      throw error;
    }
  }
}

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = HumanRepliesAPI;
} else {
  window.HumanRepliesAPI = HumanRepliesAPI;
}
