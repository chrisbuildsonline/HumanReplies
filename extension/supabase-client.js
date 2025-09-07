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
    }
  }

  // Open auth popup and handle the flow
  async authenticateWithPopup(type = "signin") {
    // Open internal extension page (has chrome.* APIs) instead of data URL
    return new Promise((resolve, reject) => {
      const authPage = chrome.runtime.getURL(
        `auth-ui.html?mode=${encodeURIComponent(type)}&url=${encodeURIComponent(
          this.supabaseUrl
        )}&key=${encodeURIComponent(this.supabaseAnonKey)}`
      );

      chrome.windows.create(
        {
          url: authPage,
          type: "popup",
          width: 400,
          height: 500,
          focused: true,
        },
        (window) => {
          if (!window) {
            reject(new Error("Failed to create auth popup"));
            return;
          }

          const windowId = window.id;
          let authCompleted = false;

          // Runtime message listener (preferred now)
          const runtimeListener = (msg) => {
            if (msg && msg.action === "authResult" && !authCompleted) {
              authCompleted = true;
              try { chrome.windows.remove(windowId); } catch(e) {}
              chrome.runtime.onMessage.removeListener(runtimeListener);
              if (msg.success && msg.data && msg.data.access_token) {
                resolve(msg.data);
              } else if (msg.cancelled) {
                reject(new Error("Authentication cancelled by user"));
              } else {
                reject(new Error(msg.error || "Authentication failed"));
              }
            }
          };
          chrome.runtime.onMessage.addListener(runtimeListener);

          // Keep legacy storage polling as fallback
          const storagePoller = setInterval(() => {
            chrome.storage.local.get(["auth_popup_result"], (result) => {
              if (result.auth_popup_result && !authCompleted) {
                const authResult = result.auth_popup_result;
                // Check if this is a recent result (within last 30 seconds)
                if (Date.now() - authResult.timestamp < 30000) {
                  console.log("Auth result found in storage:", authResult);

                  // Clear the storage result
                  chrome.storage.local.remove(["auth_popup_result"]);

                  if (authResult.type === "AUTH_SUCCESS") {
                    authCompleted = true;
                    clearInterval(checkWindowClosed);
                    clearInterval(storagePoller);
                    chrome.runtime.onMessage.removeListener(runtimeListener);
                    chrome.windows.onRemoved.removeListener(
                      windowRemovedListener
                    );
                    chrome.windows.remove(windowId);
                    resolve(authResult.data);
                  }
                }
              }
            });
          }, 500); // Check every 500ms

          // (postMessage listener no longer needed with internal page)

          // Poll to check if popup window is still open
          const checkWindowClosed = setInterval(() => {
            chrome.windows.get(windowId, (window) => {
              if (chrome.runtime.lastError || !window) {
                // Window was closed
                if (!authCompleted) {
                  authCompleted = true;
                  clearInterval(checkWindowClosed);
                  clearInterval(storagePoller);
                  chrome.runtime.onMessage.removeListener(runtimeListener);
                  reject(new Error("Authentication cancelled by user"));
                }
              }
            });
          }, 1000);

          // Handle popup closed by user
          const windowRemovedListener = (closedWindowId) => {
            if (closedWindowId === windowId && !authCompleted) {
              chrome.runtime.onMessage.removeListener(runtimeListener);
              clearInterval(checkWindowClosed);
              clearInterval(storagePoller);
              chrome.windows.onRemoved.removeListener(windowRemovedListener);
              reject(new Error("Authentication cancelled by user"));
            }
          };

          chrome.windows.onRemoved.addListener(windowRemovedListener);

          // Timeout after 5 minutes
          setTimeout(() => {
            if (!authCompleted) {
              chrome.runtime.onMessage.removeListener(runtimeListener);
              clearInterval(checkWindowClosed);
              clearInterval(storagePoller);
              chrome.windows.onRemoved.removeListener(windowRemovedListener);
              chrome.windows.remove(windowId);
              reject(new Error("Authentication timeout"));
            }
          }, 300000);
        }
      );
    });
  }

  // Legacy createAuthForm retained only for backward compatibility (unused)
  createAuthForm() {
    throw new Error("Deprecated: use internal auth-ui.html");
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
