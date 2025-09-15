// Core API service for HumanReplies

class HumanRepliesAPI {
  constructor(environmentConfig = null) {
    // Initialize with environment config
    this.envConfig = environmentConfig;

    // Set defaults from environment or fallback
    if (this.envConfig) {
      this.baseURL = this.envConfig.getApiBaseURL();
      this.debugMode = this.envConfig.isDebugMode();
      this.environment = this.envConfig.getCurrentEnvironment();
    } else {
      // Fallback defaults
      this.baseURL = undefined;
      this.debugMode = false;
      this.environment = "production";
    }

    // Caching for service URLs
    this.serviceUrls = null;
    this.urlsCacheExpiry = null;
  }

  getBaseURL() {
    return this.baseURL;
  }

  // ===== Internal helpers =====
  _debug(...args) {
    if (this.debugMode) {
      // eslint-disable-next-line no-console
      console.log("[HumanRepliesAPI]", ...args);
    }
  }

  async _fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
    const abortSupported = typeof AbortController !== "undefined";
    let controller;
    let timeoutHandle;

    try {
      if (abortSupported) {
        controller = new AbortController();
        options.signal = controller.signal;
      }

      const timeoutPromise = new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => {
          if (controller) controller.abort();
          reject(new Error("Fetch timeout"));
        }, timeoutMs);
      });

      const response = await Promise.race([
        fetch(url, options),
        timeoutPromise,
      ]);
      return response;
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  }

  async generateReply(context, options = {}) {
    if (!this.baseURL) {
      throw new Error(
        "API baseURL is not configured. Make sure to pass environmentConfig to constructor."
      );
    }
    return this.generateWithBackend(context, options);
  }

  async generateWithBackend(context, options = {}) {
    try {
      const endpoint = `${this.baseURL}/services/generate-reply`;
      if (this.debugMode) {
        this._debug("Making request to:", endpoint);
      }

      // Get the token if available, but proceed without it if not present
      const userToken = await this.getUserToken();
      const headers = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };

      // Only add the Authorization header if we have a token
      if (userToken) {
        headers.Authorization = `Bearer ${userToken}`;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          context,
          platform: options.platform || "x",
          tone: options.tone || "helpful",
          length: options.length || "medium",
          user_writing_style: options.userWritingStyle || null,
          is_improve_mode: options.isImproveMode || false,
        }),
      });

      if (!response.ok) {
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

      // Prefer backend result
      let finalReply = data.generated_response;
      let serviceUsed = data.service_used || "backend";
      let variations = null; // ensure scope outside conditional

      // If the backend didn't return a response but did return a prompt,
      // try Pollinations directly from the client
      if (!finalReply && data.generated_prompt) {
        const { pollinations_url: pollinationsUrl } =
          await this.getServiceUrls();

        if (!pollinationsUrl) {
          throw new Error("AI service URL not available");
        }

        const encodedPrompt = encodeURIComponent(data.generated_prompt);
        // Add a small random seed to avoid heavy caching

        const pollinationsResponse = await fetch(pollinationsUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/plain",
          },
          body: JSON.stringify({
            messages: [
              {
                role: "user",
                content: data.generated_prompt, // send your full structured prompt here
              },
            ],
          }),
        });

        if (!pollinationsResponse.ok) {
          // throw new Error(
          //   "Too many requests to AI service, please try again later."
          // );

          return {
            reply: null,
            variations: null,
            isRateLimitReached: true,
          };
        }

        const rawReply = (await pollinationsResponse.text())
          .trim()
          .replace(/^["']|["']$/g, "");

        // Try to parse JSON response with variations
        try {
          const parsedResponse = JSON.parse(rawReply);
          if (
            parsedResponse.variations &&
            Array.isArray(parsedResponse.variations) &&
            parsedResponse.variations.every(v => typeof v === 'string')
          ) {
            variations = parsedResponse.variations;
            finalReply = variations[0]; // Use first variation as default reply
          } else if (typeof parsedResponse === 'string') {
            // If parsed response is a string, use it
            finalReply = parsedResponse;
          } else {
            // If it's a JSON object but not in expected format, extract text or use fallback
            finalReply = parsedResponse.text || parsedResponse.reply || "I'd be happy to help with that.";
          }
        } catch (e) {
          // If JSON parsing fails, check if rawReply looks like JSON before using it
          if (rawReply.trim().startsWith('{') && rawReply.trim().endsWith('}')) {
            // Looks like malformed JSON, use fallback message
            finalReply = "I'd be happy to help with that.";
          } else {
            // Use raw response as single reply
            finalReply = rawReply;
          }
        }

        serviceUsed = "pollinations";
      }

      return {
        reply: finalReply,
        variations: variations,
        remainingReplies: data.remaining_replies ?? null,
        isLimitReached: data.is_limit_reached ?? false,
        serviceUsed,
        isRateLimitReached: false,
        generatedPrompt: data.generated_prompt ?? null,
      };
    } catch (error) {
      // eslint-disable-next-line no-console
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

      const response = await fetch(`${this.baseURL}/services/urls`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
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

      return data;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to fetch service URLs:", error);

      // Return cached URLs if available, otherwise throw
      if (this.serviceUrls) {
        // eslint-disable-next-line no-console
        console.warn("Using cached service URLs due to fetch error");
        return this.serviceUrls;
      }

      throw error;
    }
  }

  async getUserToken() {
    return new Promise((resolve) => {
      const finish = (token, phase) => {
        resolve(token || null);
      };

      // Check if chrome.storage is available
      if (typeof chrome === "undefined" || !chrome.storage) {
        // eslint-disable-next-line no-console
        console.warn("[API] chrome.storage not available");
        return finish(null, "no-chrome-storage");
      }

      try {
        // First check for new userState format (priority)
        chrome.storage.local.get(["userState"], (userStateResult) => {
          if (chrome.runtime.lastError) {
            // eslint-disable-next-line no-console
            console.warn(
              "[API] getUserToken userState error:",
              chrome.runtime.lastError
            );
            tryLegacyFormats();
            return;
          }

          const token =
            userStateResult &&
            userStateResult.userState &&
            userStateResult.userState.access_token;

          if (token) {
            return finish(token, "userState");
          }
          tryLegacyFormats();
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[API] getUserToken userState failed, trying legacy", e);
        tryLegacyFormats();
      }

      const tryLegacyFormats = () => {
        // Try sync storage with legacy userToken format
        try {
          chrome.storage.sync.get(["userToken"], (result) => {
            if (chrome.runtime.lastError) {
              // eslint-disable-next-line no-console
              console.warn(
                "[API] getUserToken sync error:",
                chrome.runtime.lastError
              );
              tryLocalStorage();
              return;
            }

            if (result && result.userToken) {
              return finish(result.userToken, "sync");
            }
            tryLocalStorage();
          });
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn("[API] getUserToken sync failed, trying local", e);
          tryLocalStorage();
        }
      };

      const tryLocalStorage = () => {
        try {
          chrome.storage.local.get(["userToken"], (localResult) => {
            if (chrome.runtime.lastError) {
              // eslint-disable-next-line no-console
              console.warn(
                "[API] getUserToken local error:",
                chrome.runtime.lastError
              );
              tryBackgroundFallback();
              return;
            }

            if (localResult && localResult.userToken) {
              return finish(localResult.userToken, "local");
            }
            tryBackgroundFallback();
          });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("[API] getUserToken local failure", err);
          tryBackgroundFallback();
        }
      };

      const tryBackgroundFallback = () => {
        // Background cache fallback
        try {
          chrome.runtime.sendMessage({ action: "getAuthState" }, (resp) => {
            if (chrome.runtime.lastError) {
              // eslint-disable-next-line no-console
              console.warn(
                "[API] getUserToken background error:",
                chrome.runtime.lastError
              );
              finish(null, "background-error");
              return;
            }
            const bgToken = resp?.auth?.userToken;
            finish(bgToken, "background");
          });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("[API] getUserToken background failure", err);
          finish(null, "none");
        }
      };
    });
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
      // eslint-disable-next-line no-console
      console.error("Failed to get service status:", error);
      return null;
    }
  }

  async getTones(options = {}) {
    // Get available tones from backend (includes user's custom tones if authenticated)
    try {
      const timeoutMs =
        typeof options.timeoutMs === "number" ? options.timeoutMs : 8000;

      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        return [];
      }

      if (!this.baseURL) {
        return [];
      }

      const tonesUrl = `${this.baseURL}/tones/`;

      // Get the token if available
      const userToken = await this.getUserToken();

      const headers = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      if (userToken) {
        headers.Authorization = `Bearer ${userToken}`;
      }

      const response = await this._fetchWithTimeout(
        tonesUrl,
        { method: "GET", headers },
        timeoutMs
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch tones: ${response.status}`);
      }

      const data = await response.json().catch(() => ({}));
      const tones = Array.isArray(data.tones) ? data.tones : [];

      return tones.length ? tones : [];
    } catch (error) {
      const message = (error && error.message) || String(error);

      // Set API is offline
      this.isApiOnline = false;
      if (
        /(Failed to fetch|NetworkError|Load failed|timeout|abort)/i.test(
          message
        )
      ) {
        throw new Error("API is offline.");
      }
      // eslint-disable-next-line no-console
      console.error("[getTones] error", error);
      throw new Error("API is offline.");
    }
  }

  async createCustomTone(toneData) {
    // Create a custom tone for the authenticated user
    try {
      if (!this.baseURL) {
        throw new Error(
          "API baseURL is not configured. Make sure to pass environmentConfig to constructor."
        );
      }

      const userToken = await this.getUserToken();
      if (!userToken) {
        throw new Error("Authentication required to create custom tones");
      }

      const response = await fetch(`${this.baseURL}/tones/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify(toneData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `Failed to create tone: ${response.status}`
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to create custom tone:", error);
      throw error;
    }
  }

  async updateCustomTone(toneId, toneData) {
    // Update a custom tone for the authenticated user
    try {
      if (!this.baseURL) {
        throw new Error(
          "API baseURL is not configured. Make sure to pass environmentConfig to constructor."
        );
      }

      const userToken = await this.getUserToken();
      if (!userToken) {
        throw new Error("Authentication required to update custom tones");
      }

      const response = await fetch(`${this.baseURL}/tones/${toneId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify(toneData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `Failed to update tone: ${response.status}`
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Failed to update custom tone:", error);
      throw error;
    }
  }

  async deleteCustomTone(toneId) {
    // Delete a custom tone for the authenticated user
    try {
      if (!this.baseURL) {
        throw new Error(
          "API baseURL is not configured. Make sure to pass environmentConfig to constructor."
        );
      }

      const userToken = await this.getUserToken();
      if (!userToken) {
        throw new Error("Authentication required to delete custom tones");
      }

      const response = await fetch(`${this.baseURL}/tones/${toneId}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${userToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `Failed to delete tone: ${response.status}`
        );
      }

      return { success: true };
    } catch (error) {
      console.error("Failed to delete custom tone:", error);
      throw error;
    }
  }

  async getUserSettings() {
    // Get user settings for the authenticated user
    try {
      if (!this.baseURL) {
        throw new Error(
          "API baseURL is not configured. Make sure to pass environmentConfig to constructor."
        );
      }

      const userToken = await this.getUserToken();
      if (!userToken) {
        throw new Error("Authentication required to get user settings");
      }

      const response = await fetch(`${this.baseURL}/user-settings/`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${userToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          // User settings don't exist yet, return defaults
          return {
            use_own_voice: false,
            guardian_text: "",
          };
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `Failed to get user settings: ${response.status}`
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Failed to get user settings:", error);
      throw error;
    }
  }

  async updateUserSettings(settingsData) {
    // Update user settings for the authenticated user
    try {
      if (!this.baseURL) {
        throw new Error(
          "API baseURL is not configured. Make sure to pass environmentConfig to constructor."
        );
      }

      const userToken = await this.getUserToken();
      if (!userToken) {
        throw new Error("Authentication required to update user settings");
      }

      const response = await fetch(`${this.baseURL}/user-settings/`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify(settingsData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail ||
            `Failed to update user settings: ${response.status}`
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Failed to update user settings:", error);
      throw error;
    }
  }

  // ===== Global connectivity check =====
  async checkConnectivity() {
    // Perform a quick health check to determine API connectivity
    try {
      if (!this.baseURL) {
        return { isOnline: false, error: "No API base URL configured" };
      }

      // Extract base server URL (remove /api/v1 suffix if present)
      let serverBaseURL = this.baseURL;
      if (serverBaseURL.endsWith("/api/v1")) {
        serverBaseURL = serverBaseURL.replace("/api/v1", "");
      }

      const healthUrl = `${serverBaseURL}/health`;
      const response = await this._fetchWithTimeout(
        healthUrl,
        { method: "GET" },
        5000 // 5 second timeout for connectivity check
      );

      const isOnline = response.ok;
      return {
        isOnline,
        status: response.status,
        error: isOnline ? null : `HTTP ${response.status}`,
      };
    } catch (error) {
      const message = (error && error.message) || String(error);
      return {
        isOnline: false,
        error: message,
      };
    }
  }
}

// Global connectivity function that can be called from anywhere (guarded)
if (typeof window !== "undefined") {
  window.checkConnectivity = async function () {
    try {
      const envConfig = window.EnvironmentConfig || null;
      const api = new HumanRepliesAPI(envConfig);
      const result = await api.checkConnectivity();
      if (
        typeof chrome !== "undefined" &&
        chrome.storage &&
        chrome.storage.local
      ) {
        chrome.storage.local.set({
          humanreplies_api_status: {
            isOnline: result.isOnline,
            lastChecked: Date.now(),
            error: result.error || null,
          },
        });
      }
      return result;
    } catch (error) {
      if (
        typeof chrome !== "undefined" &&
        chrome.storage &&
        chrome.storage.local
      ) {
        chrome.storage.local.set({
          humanreplies_api_status: {
            isOnline: false,
            lastChecked: Date.now(),
            error: error.message || "Connectivity check failed",
          },
        });
      }
      return {
        isOnline: false,
        error: error.message || "Connectivity check failed",
      };
    }
  };
}

// Make HumanRepliesAPI available globally for content scripts
if (typeof window !== "undefined") {
  window.HumanRepliesAPI = HumanRepliesAPI;
}

// ES module export for background script
export default HumanRepliesAPI;
