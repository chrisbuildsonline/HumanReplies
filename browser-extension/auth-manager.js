// Robust authentication manager for HumanReplies extension
class AuthManager {
  constructor() {
    this.isLoggedIn = false;
    this.currentUser = null;
    this.authCheckInterval = null;
  }

  // Store authentication data with multiple fallbacks
  async storeAuthData(authData) {
    console.log("AuthManager: Storing auth data:", authData);

    const dataToStore = {
      userToken: authData.access_token,
      refreshToken: authData.refresh_token,
      tokenExpiry: Date.now() + authData.expires_in * 1000,
      userProfile: authData.userProfile,
      authTimestamp: Date.now(),
      isAuthenticated: true,
    };

    let syncSucceeded = false;
    let localSucceeded = false;

    // Attempt sync storage first, but don't abort if it fails
    try {
      await new Promise((resolve, reject) => {
        chrome.storage.sync.set(dataToStore, () => {
          if (chrome.runtime.lastError) {
            console.warn(
              "AuthManager: sync storage error:",
              chrome.runtime.lastError.message || chrome.runtime.lastError
            );
            return reject(chrome.runtime.lastError);
          }
          syncSucceeded = true;
          resolve();
        });
      });
    } catch (err) {
      // Continue with local storage
    }

    // Always try local storage as well
    try {
      await new Promise((resolve, reject) => {
        chrome.storage.local.set(dataToStore, () => {
          if (chrome.runtime.lastError) {
            console.warn(
              "AuthManager: local storage error:",
              chrome.runtime.lastError.message || chrome.runtime.lastError
            );
            return reject(chrome.runtime.lastError);
          }
          localSucceeded = true;
          resolve();
        });
      });
    } catch (err) {
      // If both failed, we can't proceed
      if (!syncSucceeded) {
        console.error("AuthManager: Both sync and local storage failed");
        return false;
      }
    }

    // Verify via fallback retrieval
    const verification = await this.getAuthData();
    if (verification.userToken) {
      console.log(
        "AuthManager: Storage verification successful (sync:",
        syncSucceeded,
        "local:",
        localSucceeded,
        ")"
      );
      this.isLoggedIn = true;
      this.currentUser = verification.userProfile;
      // Broadcast to background for in-memory cache
      try {
        chrome.runtime.sendMessage({
          action: "authUpdated",
          data: {
            userToken: verification.userToken,
            refreshToken: verification.refreshToken,
            tokenExpiry: verification.tokenExpiry,
            userProfile: verification.userProfile,
          },
          meta: "broadcast-after-store",
        });
      } catch (e) {
        console.warn("AuthManager: failed to send authUpdated message", e);
      }
      return true;
    }

    console.error(
      "AuthManager: Storage verification failed (sync:",
      syncSucceeded,
      "local:",
      localSucceeded,
      ")"
    );
    return false;
  }

  // Retrieve authentication data with fallbacks
  async getAuthData() {
    try {
      // Try sync storage first
      const syncData = await new Promise((resolve) => {
        chrome.storage.sync.get(
          [
            "userToken",
            "userProfile",
            "refreshToken",
            "tokenExpiry",
            "authTimestamp",
            "isAuthenticated",
          ],
          resolve
        );
      });

      if (syncData.userToken) {
        if (!syncData.isAuthenticated) {
          console.warn(
            "AuthManager: sync data missing isAuthenticated flag, inferring true"
          );
          syncData.isAuthenticated = true;
        }
        console.log("AuthManager: Found auth data in sync storage");
        return syncData;
      } else {
        console.log("AuthManager: No userToken in sync storage");
      }

      // Fallback to local storage
      const localData = await new Promise((resolve) => {
        chrome.storage.local.get(
          [
            "userToken",
            "userProfile",
            "refreshToken",
            "tokenExpiry",
            "authTimestamp",
            "isAuthenticated",
          ],
          resolve
        );
      });

      if (localData.userToken) {
        if (!localData.isAuthenticated) {
          console.warn(
            "AuthManager: local data missing isAuthenticated flag, inferring true"
          );
          localData.isAuthenticated = true;
        }
        console.log(
          "AuthManager: Found auth data in local storage, syncing to sync storage"
        );
        chrome.storage.sync.set(localData, () => {}); // best effort
        return localData;
      } else {
        console.log("AuthManager: No userToken in local storage");
      }

      console.log("AuthManager: No auth data found");
      return {};
    } catch (error) {
      console.error("AuthManager: Failed to retrieve auth data:", error);
      return {};
    }
  }

  // Check if user is authenticated
  async checkAuthStatus() {
    console.log("AuthManager: Checking auth status...");

    const authData = await this.getAuthData();

    if (!authData.userToken) {
      console.log("AuthManager: No valid auth data found");
      this.isLoggedIn = false;
      this.currentUser = null;
      return false;
    }

    if (authData.isAuthenticated === undefined) {
      authData.isAuthenticated = true; // infer
    }

    // Check if token is expired
    const now = Date.now();
    const expiry = authData.tokenExpiry || 0;

    if (now >= expiry) {
      console.log("AuthManager: Token expired, attempting refresh...");

      if (authData.refreshToken) {
        try {
          const supabase = new SupabaseClient();
          const refreshResult = await supabase.refreshToken(
            authData.refreshToken
          );

          // Store refreshed tokens
          const refreshedData = {
            access_token: refreshResult.access_token,
            refresh_token: refreshResult.refresh_token,
            expires_in: refreshResult.expires_in,
            userProfile: authData.userProfile,
          };

          const stored = await this.storeAuthData(refreshedData);
          if (stored) {
            console.log("AuthManager: Token refreshed successfully");
            return true;
          }
        } catch (error) {
          console.error("AuthManager: Token refresh failed:", error);
          await this.clearAuthData();
          return false;
        }
      } else {
        console.log("AuthManager: No refresh token available");
        await this.clearAuthData();
        return false;
      }
    } else {
      console.log("AuthManager: Token is valid");
      this.isLoggedIn = true;
      this.currentUser = authData.userProfile;
      return true;
    }
  }

  // Clear all authentication data
  async clearAuthData() {
    console.log("AuthManager: Clearing auth data...");

    this.isLoggedIn = false;
    this.currentUser = null;

    const keysToRemove = [
      "userToken",
      "userProfile",
      "refreshToken",
      "tokenExpiry",
      "authTimestamp",
      "isAuthenticated",
    ];

    // Clear from both storages
    await new Promise((resolve) => {
      chrome.storage.sync.remove(keysToRemove, resolve);
    });

    await new Promise((resolve) => {
      chrome.storage.local.remove(keysToRemove, resolve);
    });

    console.log("AuthManager: Auth data cleared");
    try {
      chrome.runtime.sendMessage({
        action: "authUpdated",
        data: { userToken: null },
        meta: "cleared",
      });
    } catch (e) {
      /* ignore */
    }
  }

  // Start periodic auth checking
  startPeriodicCheck(callback) {
    if (this.authCheckInterval) {
      clearInterval(this.authCheckInterval);
    }

    this.authCheckInterval = setInterval(async () => {
      const wasLoggedIn = this.isLoggedIn;
      await this.checkAuthStatus();

      if (wasLoggedIn !== this.isLoggedIn && callback) {
        callback(this.isLoggedIn, this.currentUser);
      }
    }, 3000); // Check every 3 seconds
  }

  // Stop periodic checking
  stopPeriodicCheck() {
    if (this.authCheckInterval) {
      clearInterval(this.authCheckInterval);
      this.authCheckInterval = null;
    }
  }

  // Get current auth state
  getAuthState() {
    return {
      isLoggedIn: this.isLoggedIn,
      currentUser: this.currentUser,
    };
  }
}

// Make it globally available
window.AuthManager = AuthManager;

// ES module export
export default AuthManager;
