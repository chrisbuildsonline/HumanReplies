// Supabase client for HumanReplies extension
class SupabaseClient {
  constructor() {
    // Load Supabase configuration from environment
    this.initializeConfig();
    this.redirectUrl = chrome.runtime.getURL("auth-callback.html");
  }

  initializeConfig() {
    // Use environment config if available
    if (typeof window !== "undefined" && window.EnvironmentConfig) {
      this.supabaseUrl = window.EnvironmentConfig.getSupabaseUrl();
      this.supabaseAnonKey = window.EnvironmentConfig.getSupabaseAnonKey();

      // Log if in debug mode
      if (window.EnvironmentConfig.isDebugMode()) {
        console.log("Supabase initialized with URL:", this.supabaseUrl);
      }
    } else {
      console.error(
        "Environment configuration not found. Supabase client may not work correctly."
      );
      // Fallback values - should not be used in production
      this.supabaseUrl = "https://anhcptguetscsoejzyed.supabase.co";
      this.supabaseAnonKey =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuaGNwdGd1ZXRzY3NvZWp6eWVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMTM4MTQsImV4cCI6MjA3MTg4OTgxNH0.LhZQib4k9BcMDZ_fM8pEyAe5m__fhuUxJdzJAKlb0kw";
    }
  }

  // Generate Supabase Auth URL for popup
  getAuthUrl(type = "signin") {
    const params = new URLSearchParams({
      apikey: this.supabaseAnonKey,
      redirect_to: this.redirectUrl,
      response_type: "token",
    });

    const endpoint = type === "signup" ? "signup" : "signin";
    return `${this.supabaseUrl}/auth/v1/${endpoint}?${params.toString()}`;
  }

  // Open auth popup and handle the flow
  async authenticateWithPopup(type = "signin") {
    return new Promise((resolve, reject) => {
      const authUrl = this.getAuthUrl(type);

      // Create popup window
      chrome.windows.create(
        {
          url: authUrl,
          type: "popup",
          width: 500,
          height: 600,
          focused: true,
        },
        (window) => {
          if (!window) {
            reject(new Error("Failed to create auth popup"));
            return;
          }

          const windowId = window.id;
          let authCompleted = false;

          // Listen for tab updates to detect auth completion
          const listener = (tabId, changeInfo, tab) => {
            if (tab.windowId !== windowId || authCompleted) return;

            if (changeInfo.url && changeInfo.url.includes(this.redirectUrl)) {
              authCompleted = true;
              chrome.tabs.onUpdated.removeListener(listener);

              // Extract tokens from URL
              try {
                const url = new URL(changeInfo.url);
                const fragment = url.hash.substring(1);
                const params = new URLSearchParams(fragment);

                const accessToken = params.get("access_token");
                const refreshToken = params.get("refresh_token");
                const expiresIn = params.get("expires_in");
                const tokenType = params.get("token_type");

                if (accessToken) {
                  // Close the popup
                  chrome.windows.remove(windowId);

                  resolve({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                    expires_in: parseInt(expiresIn),
                    token_type: tokenType,
                  });
                } else {
                  chrome.windows.remove(windowId);
                  reject(new Error("No access token received"));
                }
              } catch (error) {
                chrome.windows.remove(windowId);
                reject(new Error("Failed to parse auth response"));
              }
            }
          };

          chrome.tabs.onUpdated.addListener(listener);

          // Handle popup closed by user
          chrome.windows.onRemoved.addListener((closedWindowId) => {
            if (closedWindowId === windowId && !authCompleted) {
              chrome.tabs.onUpdated.removeListener(listener);
              reject(new Error("Authentication cancelled by user"));
            }
          });

          // Timeout after 5 minutes
          setTimeout(() => {
            if (!authCompleted) {
              chrome.tabs.onUpdated.removeListener(listener);
              chrome.windows.remove(windowId);
              reject(new Error("Authentication timeout"));
            }
          }, 300000);
        }
      );
    });
  }

  // Get user info from Supabase using access token
  async getUserInfo(accessToken) {
    try {
      const response = await fetch(`${this.supabaseUrl}/auth/v1/user`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: this.supabaseAnonKey,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get user info: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error getting user info:", error);
      throw error;
    }
  }

  // Sign out user
  async signOut(accessToken) {
    try {
      const response = await fetch(`${this.supabaseUrl}/auth/v1/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: this.supabaseAnonKey,
        },
      });

      return response.ok;
    } catch (error) {
      console.error("Error signing out:", error);
      return false;
    }
  }

  // Refresh access token
  async refreshToken(refreshToken) {
    try {
      const response = await fetch(
        `${this.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: this.supabaseAnonKey,
          },
          body: JSON.stringify({
            refresh_token: refreshToken,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to refresh token: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error refreshing token:", error);
      throw error;
    }
  }
}

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = SupabaseClient;
} else {
  window.SupabaseClient = SupabaseClient;
}
