// Popup script for HumanReplies extension
import HumanRepliesAPI from "./core/api-service.js";
import SupabaseClient from "./supabase-client.js";
import AuthManager from "./auth-manager.js";

addVisibleDebug("[Popup] script file loaded");
addVisibleDebug("[Popup] Starting popup.js execution...");

// Add visible debug info to the page
function addVisibleDebug(..._parts) {
  // Logging disabled (stubbed out). Intentionally left blank.
  return;
}

function appendDebug(message) {
  try {
    const box = document.getElementById("debugArea");
    if (!box) return;
    box.style.display = "block";
    const ts = new Date().toLocaleTimeString();
    box.textContent += `[${ts}] ${message}
`;
  } catch (e) {}
}
class PopupManager {
  constructor() {
    addVisibleDebug("PopupManager constructor starting");
    this.isLoggedIn = false;
    this.currentUser = null;
    this.currentTone = "ask";
    this.api = null;
    this.isApiOnline = false; // Track API status
    this.apiStatusChecked = false; // Track if we've checked API status
    this.isOnSupportedSite = null; // Track if current site is supported (null = not checked yet)
    this.useIntegrations = true; // default ON
    this.enableSelectReply = true; // default ON
    this.enableEverywhere = false; // default OFF (social media only)
    this.offlineRetryInterval = null; // Track auto-retry interval when offline

    // Initialize async
    this.loadApiStatus(); // Load saved status first
    this.initializeApi();
    this.initializeOtherComponents();
  }

  async initializeApi() {
    try {
      addVisibleDebug("Before HumanRepliesAPI created");

      // Get environment config and initialize API service
      const envConfig = window.EnvironmentConfig;
      addVisibleDebug("EnvironmentConfig check:", {
        exists: !!envConfig,
        type: typeof envConfig,
        constructor: envConfig?.constructor?.name,
      });

      if (envConfig) {
        await envConfig.loadEnvironment();
        const config = envConfig.getConfig();
        addVisibleDebug("Environment config loaded:", {
          environment: envConfig.getCurrentEnvironment(),
          apiBaseURL: config.apiBaseURL,
          debug: config.debug,
        });

        this.api = new HumanRepliesAPI(envConfig);
        addVisibleDebug(
          "After HumanRepliesAPI created with environment config"
        );
      } else {
        addVisibleDebug("WARNING: No EnvironmentConfig found, using fallback");
        this.api = new HumanRepliesAPI();
        addVisibleDebug(
          "After HumanRepliesAPI created without environment config"
        );
      } // Log final API configuration
      if (this.api) {
        addVisibleDebug("Final API config:", {
          baseURL: this.api.getBaseURL(),
          environment: this.api.environment,
          debugMode: this.api.debugMode,
        });
      }

      // Start early pre-load of tones after API is ready
      this.preloadTones();

      // Start periodic API status checking (every 30 seconds)
      this.startApiStatusChecking();
    } catch (e) {
      addVisibleDebug("HumanRepliesAPI error: " + e.message);
      this.isApiOnline = false;
      this.apiStatusChecked = true;
      this.updateExtensionStatus();
    }
  }

  startApiStatusChecking() {
    // Check API status every 30 seconds
    setInterval(() => {
      this.checkApiStatus();
    }, 30000);
  }

  async checkApiStatus(isManualRefresh = false) {
    if (!this.api) {
      this.isApiOnline = false;
      this.apiStatusChecked = true;
      this.saveApiStatus();
      this.updateExtensionStatus();
      addVisibleDebug("[CheckAPI] No API instance available");
      return;
    }

    const wasOnline = this.isApiOnline;
    const refreshType = isManualRefresh ? "Manual Refresh" : "StatusCheck";

    // Log detailed API info
    addVisibleDebug(`[${refreshType}] Starting API check...`);
    addVisibleDebug(`[${refreshType}] API baseURL:`, this.api.getBaseURL());
    addVisibleDebug(`[${refreshType}] Environment:`, this.api.environment);

    try {
      // Use instance checkConnectivity method if available, otherwise fall back to getTones
      if (typeof this.api.checkConnectivity === "function") {
        addVisibleDebug(`[${refreshType}] Using instance checkConnectivity method`);
        const result = await this.api.checkConnectivity();
        this.isApiOnline = result.isOnline;
        
        if (result.error) {
          addVisibleDebug(`[${refreshType}] Connectivity check error:`, result.error);
        }
        
        // If API is online, also load tones to refresh data
        if (this.isApiOnline && (!wasOnline || isManualRefresh)) {
          addVisibleDebug(`[${refreshType}] API is online, loading tones...`);
          const tones = await this.api.getTones({
            timeoutMs: isManualRefresh ? 5000 : 3000,
            reason: isManualRefresh ? "manual-refresh" : "status-check",
          });
          this.allTones = tones;
          await this.loadTones();
          if (this.isLoggedIn) {
            this.loadCustomTones();
          }
        }
      } else if (typeof window.checkConnectivity === "function") {
        addVisibleDebug(`[${refreshType}] Using global checkConnectivity function`);
        const result = await window.checkConnectivity();
        this.isApiOnline = result.isOnline;
        
        if (result.error) {
          addVisibleDebug(`[${refreshType}] Connectivity check error:`, result.error);
        }
        
        // If API is online, also load tones to refresh data
        if (this.isApiOnline && (!wasOnline || isManualRefresh)) {
          addVisibleDebug(`[${refreshType}] API is online, loading tones...`);
          const tones = await this.api.getTones({
            timeoutMs: isManualRefresh ? 5000 : 3000,
            reason: isManualRefresh ? "manual-refresh" : "status-check",
          });
          this.allTones = tones;
          await this.loadTones();
          if (this.isLoggedIn) {
            this.loadCustomTones();
          }
        }
      } else {
        // Fallback to original getTones method
        addVisibleDebug(`[${refreshType}] Using getTones for connectivity check`);
        const tones = await this.api.getTones({
          timeoutMs: isManualRefresh ? 5000 : 3000,
          reason: isManualRefresh ? "manual-refresh" : "status-check",
        });

        addVisibleDebug(`[${refreshType}] API response:`, {
          tonesReceived: tones ? tones.length : 0,
          isArray: Array.isArray(tones),
          firstTone: tones && tones[0] ? tones[0].name : "none",
        });

        this.isApiOnline = tones && tones.length > 0;

        // If API came back online, reload tones
        if (!wasOnline && this.isApiOnline) {
          addVisibleDebug("[StatusCheck] API restored, reloading tones...");
          this.allTones = tones;
          await this.loadTones();
          if (this.isLoggedIn) {
            this.loadCustomTones();
          }
        }
      }

      addVisibleDebug(
        `[${refreshType}] API is`,
        this.isApiOnline ? "online" : "offline"
      );

    } catch (err) {
      this.isApiOnline = false;
      addVisibleDebug(`[${refreshType}] API error:`, {
        message: err.message,
        name: err.name,
        stack: err.stack ? err.stack.substring(0, 200) + "..." : "no stack",
      });
    }

    this.apiStatusChecked = true;
    this.saveApiStatus();
    this.updateExtensionStatus();
  }

  saveApiStatus() {
    // Store API status in Chrome storage for other parts of extension to access
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local
        .set({
          humanreplies_api_status: {
            isOnline: this.isApiOnline,
            lastChecked: Date.now(),
          },
        })
        .then(() => {
          addVisibleDebug("[StatusSave] API status saved:", this.isApiOnline ? "online" : "offline");
        })
        .catch((err) => {
          addVisibleDebug("[StatusSave] Error saving API status:", err.message);
        });
    }
  }

  async loadApiStatus() {
    // First try to load cached status, only do live check if cache is stale
    addVisibleDebug("[StatusLoad] Loading API status from storage...");
    
    try {
      const result = await new Promise((resolve, reject) => {
        if (typeof chrome !== "undefined" && chrome.storage) {
          chrome.storage.local.get(["humanreplies_api_status"], (result) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(result);
            }
          });
        } else {
          resolve({});
        }
      });

      if (result.humanreplies_api_status) {
        const status = result.humanreplies_api_status;
        const age = Date.now() - status.lastChecked;
        const isRecent = age < 30000; // 30 seconds

        if (isRecent) {
          // Use cached status if it's recent
          this.isApiOnline = status.isOnline;
          this.apiStatusChecked = true;
          addVisibleDebug(`[StatusLoad] Using cached status (${age}ms old):`, status.isOnline ? "online" : "offline");
          this.updateExtensionStatus();
          return;
        } else {
          addVisibleDebug(`[StatusLoad] Cached status is stale (${age}ms old), performing live check`);
        }
      } else {
        addVisibleDebug("[StatusLoad] No cached status found, performing live check");
      }
    } catch (err) {
      addVisibleDebug("[StatusLoad] Error loading cached status:", err.message);
    }

    // Fall back to live check if no recent cached status
    this.isApiOnline = false;
    this.apiStatusChecked = false;
    this.updateExtensionStatus();
    await this.checkApiStatus(false);
  }

  async preloadTones() {
    // Early pre-load of tones (non-blocking) AFTER api is initialized
    try {
      addVisibleDebug("[EarlyTones] Calling api.getTones()...");
      if (!this.api) {
        addVisibleDebug("[EarlyTones] API not ready yet");
        this.isApiOnline = false;
        this.apiStatusChecked = true;
        this.saveApiStatus();
        this.updateExtensionStatus(); // Update UI with offline status
        return;
      }

      // Check if we have cached tones first
      const cachedTones = await this.getCachedTones();
      if (cachedTones && !this.shouldRefreshTones(cachedTones)) {
        addVisibleDebug(
          "[EarlyTones] Using cached tones:",
          cachedTones.tones.length
        );
        this.allTones = cachedTones.tones;
        this.isApiOnline = true;
        this.apiStatusChecked = true;
        this.saveApiStatus();
        this.updateExtensionStatus();
        return;
      }

      const tones = await this.api.getTones({
        timeoutMs: 2000,
        reason: "early-preload",
      });
      addVisibleDebug("[EarlyTones] Received tones count:", tones.length);
      this.allTones = tones;

      // Cache the tones
      await this.cacheTones(tones);

      this.isApiOnline = true;
      this.apiStatusChecked = true;
      this.saveApiStatus();
      this.updateExtensionStatus(); // Update UI with online status
    } catch (err) {
      addVisibleDebug("[EarlyTones] Error fetching tones:", err.message);

      // Try to use cached tones as fallback
      const cachedTones = await this.getCachedTones();
      if (cachedTones) {
        addVisibleDebug("[EarlyTones] Using cached tones as fallback");
        this.allTones = cachedTones.tones;
      }

      this.isApiOnline = false;
      this.apiStatusChecked = true;
      this.saveApiStatus();
      this.updateExtensionStatus(); // Update UI with offline status
    }
  }

  async getCachedTones() {
    try {
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(["humanreplies_tones_cache"], resolve);
      });
      return result.humanreplies_tones_cache || null;
    } catch (err) {
      addVisibleDebug("[Cache] Error getting cached tones:", err.message);
      return null;
    }
  }

  async cacheTones(tones) {
    try {
      const cacheData = {
        tones: tones,
        cachedAt: Date.now(),
        isLoggedIn: this.isLoggedIn,
      };

      await new Promise((resolve, reject) => {
        chrome.storage.local.set(
          { humanreplies_tones_cache: cacheData },
          () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          }
        );
      });

      addVisibleDebug("[Cache] Tones cached successfully");
    } catch (err) {
      addVisibleDebug("[Cache] Error caching tones:", err.message);
    }
  }

  shouldRefreshTones(cachedData) {
    if (!cachedData) return true;

    const now = Date.now();
    const cacheAge = now - cachedData.cachedAt;
    const twentyFourHours = 24 * 60 * 60 * 1000;

    // If user is logged in, always refresh (they might have new custom tones)
    if (this.isLoggedIn) {
      addVisibleDebug("[Cache] Logged in user - forcing refresh");
      return true;
    }

    // If cache is older than 24 hours, refresh
    if (cacheAge > twentyFourHours) {
      addVisibleDebug("[Cache] Cache expired (24h+) - refreshing");
      return true;
    }

    // If login state changed since cache, refresh
    if (cachedData.isLoggedIn !== this.isLoggedIn) {
      addVisibleDebug("[Cache] Login state changed - refreshing");
      return true;
    }

    addVisibleDebug(
      "[Cache] Using cached tones (age: " +
        Math.round(cacheAge / 1000 / 60) +
        " minutes)"
    );
    return false;
  }

  initializeOtherComponents() {
    try {
      this.supabase = new SupabaseClient();
      addVisibleDebug("SupabaseClient created");
    } catch (e) {
      addVisibleDebug("SupabaseClient error: " + e.message);
    }

    try {
      this.authManager = new AuthManager();
      addVisibleDebug("AuthManager created");
    } catch (e) {
      addVisibleDebug("AuthManager error: " + e.message);
    }

    addVisibleDebug("About to call init()");
    this.init();
  }

  async init() {
    addVisibleDebug("[Popup] init start");

    // First check for userState (new auth flow) - this takes priority
    await this.checkUserStateAuth();

    // Fallback to robust auth manager if no userState found
    if (!this.isLoggedIn) {
      let isAuthenticated = false;
      try {
        isAuthenticated = await this.authManager.checkAuthStatus();
      } catch (e) {
        addVisibleDebug("[Popup] authManager.checkAuthStatus threw", e);
      }
      const authState = this.authManager.getAuthState();
      this.isLoggedIn = authState.isLoggedIn;
      this.currentUser = authState.currentUser;
    }

    addVisibleDebug(
      "Auth check completed - isLoggedIn:",
      this.isLoggedIn,
      "currentUser:",
      this.currentUser
    ); // Debug logging

    this.checkCurrentSite();

    addVisibleDebug("[Popup] About to call loadTones()...");
    try {
      await this.loadTones();
      addVisibleDebug("[Popup] loadTones() completed");
    } catch (error) {
      addVisibleDebug("[Popup] loadTones() failed:", error);
    }

    this.updateUIState();
    this.loadToneSetting();
    this.setupEventListeners();
    
    // Show the popup content after login check is complete
    this.showPopupContent();

    // Set up periodic auth check using the auth manager
    this.authManager.startPeriodicCheck((isLoggedIn, currentUser) => {
      addVisibleDebug("Auth state changed:", isLoggedIn, currentUser);
      this.isLoggedIn = isLoggedIn;
      this.currentUser = currentUser;
      this.updateUIState();

      if (isLoggedIn) {
        this.loadTones();
        this.loadCustomTones();
        this.showSuccess("Successfully logged in!");
      }
    });

    addVisibleDebug("[Popup] init complete");

    // Clean up when popup is closed
    window.addEventListener("beforeunload", () => {
      this.cleanup();
    });
  }

  // Check userState (new auth flow) and validate tokens directly with Supabase
  async checkUserStateAuth() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["userState"], async (result) => {
        const userState = result.userState;
        if (!userState || !userState.access_token) {
          addVisibleDebug("[Popup] No userState found");
          return resolve(false);
        }

        addVisibleDebug("[Popup] Found userState, validating token...");

        // Check if token is expired (basic check)
        if (userState.expires_in && userState.storedAt) {
          const expiryTime = userState.storedAt + userState.expires_in * 1000;
          if (Date.now() >= expiryTime) {
            addVisibleDebug("[Popup] Token expired, clearing userState");
            chrome.storage.local.remove(["userState"]);
            return resolve(false);
          }
        }

        // Validate token directly with Supabase (bypass our backend)
        try {
          const userInfo = await this.supabase.getUserInfo(
            userState.access_token
          );
          if (userInfo && userInfo.email) {
            addVisibleDebug("[Popup] Token valid, setting logged in state");

            // Update state from validated userInfo
            this.isLoggedIn = true;
            this.currentUser = {
              id: userInfo.id,
              email: userInfo.email,
              full_name:
                userInfo.user_metadata?.full_name ||
                userInfo.email.split("@")[0],
              avatar_url: userInfo.user_metadata?.avatar_url,
              created_at: userInfo.created_at,
            };

            // Sync with AuthManager for consistency
            const authDataWithProfile = {
              access_token: userState.access_token,
              refresh_token: userState.refresh_token,
              expires_in: userState.expires_in,
              userProfile: this.currentUser,
            };
            await this.authManager.storeAuthData(authDataWithProfile);

            resolve(true);
          } else {
            throw new Error("Invalid user info response");
          }
        } catch (error) {
          addVisibleDebug("[Popup] Token validation failed:", error.message);
          // Clear invalid userState
          chrome.storage.local.remove(["userState"]);
          resolve(false);
        }
      });
    });
  }

  // Cleanup method for when popup is closed
  cleanup() {
    if (this.authManager) {
      this.authManager.stopPeriodicCheck();
    }
    if (this._bgDiagInterval) {
      clearInterval(this._bgDiagInterval);
      this._bgDiagInterval = null;
    }
  }

  // Manual refresh method for debugging
  async refreshAuthState() {
    addVisibleDebug("Manual auth refresh triggered using AuthManager");

    // Use auth manager to check status
    const isAuthenticated = await this.authManager.checkAuthStatus();
    const authState = this.authManager.getAuthState();

    addVisibleDebug("AuthManager check result:", isAuthenticated, authState);

    // Update local state
    this.isLoggedIn = authState.isLoggedIn;
    this.currentUser = authState.currentUser;

    this.updateUIState();

    chrome.storage.local.get(null, (all) => {
      const userState = all.userState;
      addVisibleDebug(
        "[Debug refresh] chrome.storage.local keys:",
        Object.keys(all)
      );
      if (userState) {
        addVisibleDebug("[Debug refresh] userState:", userState);
        const { userProfile, access_token } = userState;
        const shortToken = access_token
          ? access_token.substring(0, 6) + "…" + access_token.slice(-4)
          : "none";
        this.showSuccess(
          `userState: ${userProfile?.email || "n/a"} token ${shortToken}`
        );

        // Force re-check userState auth on debug refresh
        this.checkUserStateAuth().then((isValid) => {
          if (isValid && !this.isLoggedIn) {
            addVisibleDebug("[Debug] userState was valid, updating UI");
            this.updateUIState();
          }
        });
      } else {
        this.showError("userState: n/a token none");
      }
    });

    if (this.isLoggedIn) {
      await this.loadTones();
      this.loadCustomTones();
      this.showSuccess("Auth state refreshed - logged in!");
    } else {
      this.showError("Auth state refreshed - not logged in");
    }
  }

  async checkAuthStatus() {
    // Delegate entirely to AuthManager for consistency
    try {
      const wasLoggedIn = this.isLoggedIn;
      const result = await this.authManager.checkAuthStatus();
      const authState = this.authManager.getAuthState();
      this.isLoggedIn = authState.isLoggedIn;
      this.currentUser = authState.currentUser;
      addVisibleDebug(
        "Popup.checkAuthStatus via AuthManager =>",
        this.isLoggedIn,
        this.currentUser
      );
      if (wasLoggedIn !== this.isLoggedIn) {
        this.updateUIState();
      }
    } catch (e) {
      addVisibleDebug("Delegated auth check failed", e);
    }
  }

  checkCurrentSite() {
    // Get current tab to check if extension is active
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        const url = new URL(tabs[0].url);
        const hostname = url.hostname.toLowerCase();

        const supportedSites = [
          "x.com",
          "twitter.com",
          "linkedin.com",
          "facebook.com",
        ];

        this.isOnSupportedSite = supportedSites.some((site) =>
          hostname.includes(site)
        );

        this.updateExtensionStatus();
      }
    });
  }

  updateExtensionStatus() {
    // Get all status elements using classes
    const statusTextElements = document.querySelectorAll(".status-text");
    const statusIndicators = document.querySelectorAll(".status-indicator");
    const statusContainers = document.querySelectorAll(".extensionStatus");

    // Get elements to show/hide based on API status
    const apiOfflineMessage = document.getElementById("api-offline-message");
    const loggedOutState = document.getElementById("loggedOutState");
    const loggedInState = document.getElementById("loggedInState");

    if (
      !statusTextElements.length ||
      !statusIndicators.length ||
      !statusContainers.length
    ) {
      return; // Elements not ready yet
    }

    let statusText = "";
    let isActive = false;

    // Priority: API status first, then site support
    if (this.apiStatusChecked && !this.isApiOnline) {
      statusText = "HumanReplies API is offline";
      isActive = false;

      // Show API offline message and hide other content
      if (apiOfflineMessage) {
        apiOfflineMessage.classList.remove("hidden");
      }
      if (loggedOutState) {
        loggedOutState.classList.add("hidden");
      }
      if (loggedInState) {
        loggedInState.classList.add("hidden");
      }

      // Start auto-retry mechanism when popup is open and API is offline
      this.startOfflineAutoRetry();
    } else {
      // API is online or not checked yet - show normal content
      if (apiOfflineMessage) {
        apiOfflineMessage.classList.add("hidden");
      }
      if (loggedOutState && !this.isLoggedIn) {
        loggedOutState.classList.remove("hidden");
      }
      if (loggedInState && this.isLoggedIn) {
        loggedInState.classList.remove("hidden");
      }

      // Stop auto-retry when API comes back online
      this.stopOfflineAutoRetry();
    }

    // Update all status text elements
    statusTextElements.forEach((statusElement) => {
      // Clear existing content and create elements
      statusElement.innerHTML = "";

      // Add the status text
      const textSpan = document.createElement("span");
      textSpan.textContent = statusText;
      statusElement.appendChild(textSpan);

      // Add refresh button for offline API status
      if (!this.isApiOnline) {
        const refreshButton = document.createElement("button");
        refreshButton.innerHTML = "🔄";
        refreshButton.title = "Retry API connection";
        refreshButton.style.cssText = `
          background: none;
          border: none;
          color: inherit;
          margin-left: 8px;
          cursor: pointer;
          font-size: 12px;
          padding: 2px 4px;
          border-radius: 3px;
          transition: background-color 0.2s;
        `;

        // Add hover effect
        refreshButton.addEventListener("mouseenter", () => {
          refreshButton.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
        });
        refreshButton.addEventListener("mouseleave", () => {
          refreshButton.style.backgroundColor = "transparent";
        });

        // Add click handler to retry API connection
        refreshButton.addEventListener("click", async (e) => {
          e.stopPropagation();

          // Show loading state
          refreshButton.innerHTML = "⏳";
          refreshButton.disabled = true;

          addVisibleDebug("[Manual Refresh] Retrying API connection...");

          try {
            // Force immediate API status check with manual refresh flag
            await this.checkApiStatus(true);

            if (this.isApiOnline) {
              addVisibleDebug("[Manual Refresh] API is now online!");
              this.showSuccess("API connection restored!");
            } else {
              addVisibleDebug("[Manual Refresh] API still offline");
              this.showError("API still offline. Please try again later.");
            }
          } catch (error) {
            addVisibleDebug("[Manual Refresh] Retry failed:", error.message);
            this.showError("Failed to check API status");
          } finally {
            // Reset button after a short delay
            setTimeout(() => {
              refreshButton.innerHTML = "🔄";
              refreshButton.disabled = false;
            }, 1000);
          }
        });

        statusElement.appendChild(refreshButton);
      }
    });

    // Show/hide status containers based on API status
    statusContainers.forEach((container) => {
      if (!this.isApiOnline) {
        // Hide status containers when API is offline - we show the offline message instead
        container.style.display = "none";
      } else {
        container.style.display = "none"; // Always hidden when API is online (no need for status indicator)
      }
    });

    // Apply styling based on active state
    if (isActive) {
      statusContainers.forEach((container) => {
        container.classList.remove("logged-out");
        container.classList.add("logged-in");
      });
      statusTextElements.forEach((element) => {
        element.classList.remove("logged-out");
        element.classList.add("logged-in");
      });
      statusIndicators.forEach((indicator) => {
        indicator.classList.remove("logged-out");
        indicator.classList.add("logged-in");
      });
    } else {
      statusContainers.forEach((container) => {
        container.classList.remove("logged-in");
        container.classList.add("logged-out");
      });
      statusTextElements.forEach((element) => {
        element.classList.remove("logged-in");
        element.classList.add("logged-out");
      });
      statusIndicators.forEach((indicator) => {
        indicator.classList.remove("logged-in");
        indicator.classList.add("logged-out");
      });
    }
  }

  saveToneSetting(tone) {
    this.currentTone = tone;
    chrome.storage.sync.set({ defaultTone: tone });
    console.log("Tone setting saved:", tone);
  }

  startOfflineAutoRetry() {
    // Only start if not already running
    if (this.offlineRetryInterval) {
      return;
    }

    addVisibleDebug(
      "[Auto-Retry] Starting automatic API reconnection attempts every 5 seconds"
    );

    let retryCount = 0;

    this.offlineRetryInterval = setInterval(async () => {
      if (!this.isApiOnline) {
        retryCount++;
        addVisibleDebug(
          `[Auto-Retry] Attempt #${retryCount} - Attempting to reconnect to API...`
        );

        // Show visual feedback during retry
        this.updateRetryStatus(
          `🔄 Checking connection... (attempt #${retryCount})`
        );

        await this.checkApiStatus(false); // false = not manual refresh

        if (this.isApiOnline) {
          addVisibleDebug("[Auto-Retry] API reconnected successfully!");
          this.showSuccess("Connection restored!");
          this.stopOfflineAutoRetry();
        } else {
          // Reset to default retry message
          this.updateRetryStatus(
            "🔄 Automatically retrying every 5 seconds..."
          );
        }
      } else {
        // If somehow API is online, stop the retry
        this.stopOfflineAutoRetry();
      }
    }, 5000); // Check every 5 seconds
  }

  stopOfflineAutoRetry() {
    if (this.offlineRetryInterval) {
      addVisibleDebug("[Auto-Retry] Stopping automatic reconnection attempts");
      clearInterval(this.offlineRetryInterval);
      this.offlineRetryInterval = null;
    }
  }

  updateRetryStatus(message) {
    const retryStatus = document.getElementById("auto-retry-status");
    if (retryStatus) {
      retryStatus.textContent = message;
    }
  }

  async loadTones() {
    addVisibleDebug("[Popup] loadTones() starting...");

    // First check if DOM elements exist
    const toneSelectLoggedOut = document.getElementById(
      "replyToneSelectLoggedOut"
    );
    const toneSelectLoggedIn = document.getElementById("replyToneSelect");

    const domCheck = {
      loggedOut: !!toneSelectLoggedOut,
      loggedIn: !!toneSelectLoggedIn,
      loggedOutValue: toneSelectLoggedOut ? toneSelectLoggedOut.value : "N/A",
      loggedInValue: toneSelectLoggedIn ? toneSelectLoggedIn.value : "N/A",
    };

    addVisibleDebug("DOM check: " + JSON.stringify(domCheck));

    if (!toneSelectLoggedOut && !toneSelectLoggedIn) {
      addVisibleDebug("ERROR: No tone select elements found!");
      return;
    }

    try {
      let tones;

      // Check if we already have tones from preload or cache
      if (this.allTones && this.allTones.length > 0) {
        addVisibleDebug("[Popup] Using existing tones:", this.allTones.length);
        tones = this.allTones;
      } else {
        // Check cache first
        const cachedTones = await this.getCachedTones();
        if (cachedTones && !this.shouldRefreshTones(cachedTones)) {
          addVisibleDebug(
            "[Popup] Using cached tones:",
            cachedTones.tones.length
          );
          tones = cachedTones.tones;
          this.allTones = tones;
        } else {
          addVisibleDebug("[Popup] Fetching fresh tones from API...");
          tones = await this.api.getTones();
          this.allTones = tones;
          // Cache the fresh tones
          await this.cacheTones(tones);
        }
      }

      addVisibleDebug(
        "Got " + tones.length + " tones: " + JSON.stringify(tones)
      );

      // Re-get elements in case they changed
      const toneSelectLoggedOut = document.getElementById(
        "replyToneSelectLoggedOut"
      );
      const toneSelectLoggedIn = document.getElementById("replyToneSelect");

      addVisibleDebug("[Popup] Found tone selects after getting tones:", {
        loggedOut: !!toneSelectLoggedOut,
        loggedIn: !!toneSelectLoggedIn,
      });

      [toneSelectLoggedOut, toneSelectLoggedIn].forEach((toneSelect) => {
        if (toneSelect) {
          addVisibleDebug(`[Popup] Processing tone select: ${toneSelect.id}`);
          // Always start with "Always ask me" as the first option
          toneSelect.innerHTML = '<option value="ask">Always ask me</option>';

          // Add all tones from API (API already excludes "ask")
          const filteredTones = tones;

          // Filter preset and custom tones from the filtered list
          const presetTones = filteredTones.filter(
            (tone) =>
              tone.is_preset === true ||
              // If is_preset is undefined/null, treat known preset tone names as presets
              (tone.is_preset === undefined &&
                [
                  "neutral",
                  "joke",
                  "support",
                  "idea",
                  "question",
                  "confident",
                ].includes(tone.name))
          );
          const customTones = filteredTones.filter(
            (tone) =>
              tone.is_preset === false ||
              // If is_preset is undefined/null and it's not a known preset, treat as custom
              (tone.is_preset === undefined &&
                ![
                  "neutral",
                  "joke",
                  "support",
                  "idea",
                  "question",
                  "confident",
                ].includes(tone.name))
          );

          addVisibleDebug(
            `LoadTones: Preset tones for ${toneSelect.id}: ${presetTones.length} found`
          );
          addVisibleDebug(
            `LoadTones: Custom tones for ${toneSelect.id}: ${customTones.length} found`
          );

          // For logged-in users (replyToneSelect), show custom tones first, then presets
          if (this.isLoggedIn && toneSelect.id === "replyToneSelect") {
            // Add custom tones section first
            if (customTones.length > 0) {
              const customSeparator = document.createElement("option");
              customSeparator.disabled = true;
              customSeparator.textContent = "── Your Custom Tones ──";
              toneSelect.appendChild(customSeparator);

              customTones.forEach((tone) => {
                const option = document.createElement("option");
                option.value = tone.name;
                option.textContent = tone.display_name;
                toneSelect.appendChild(option);
              });
            }

            // Add preset tones section after custom tones
            if (presetTones.length > 0) {
              const presetSeparator = document.createElement("option");
              presetSeparator.disabled = true;
              presetSeparator.textContent = "── Preset Tones ──";
              toneSelect.appendChild(presetSeparator);

              presetTones.forEach((tone) => {
                const option = document.createElement("option");
                option.value = tone.name;
                option.textContent = tone.display_name;
                toneSelect.appendChild(option);
              });
            }
          }
          // For logged-out users (replyToneSelectLoggedOut), show only preset tones
          else if (toneSelect.id === "replyToneSelectLoggedOut") {
            if (presetTones.length > 0) {
              const presetSeparator = document.createElement("option");
              presetSeparator.disabled = true;
              presetSeparator.textContent = "── Preset Tones ──";
              toneSelect.appendChild(presetSeparator);

              presetTones.forEach((tone) => {
                const option = document.createElement("option");
                option.value = tone.name;
                option.textContent = tone.display_name;
                toneSelect.appendChild(option);
              });
            }
          }

          addVisibleDebug(
            `[Popup] Finished populating ${toneSelect.id}, options count: ${toneSelect.options.length}`
          );
        } else {
          addVisibleDebug(`[Popup] Tone select element not found in DOM`);
        }
      });

      addVisibleDebug("[Popup] loadTones() completed successfully");
    } catch (error) {
      addVisibleDebug("Failed to load tones:", error);
      addVisibleDebug("Error stack:", error.stack);
      // Keep the existing "Always ask me" option as fallback
    }
  }

  async loadCustomTones() {
    if (!this.isLoggedIn || !this.allTones) return;

    const customTonesList = document.getElementById("customTonesList");
    if (!customTonesList) return;

    // Filter custom tones (non-preset tones)
    const customTones = this.allTones.filter((tone) => !tone.is_preset);

    if (customTones.length === 0) {
      customTonesList.innerHTML =
        '<div style="font-size: 11px; color: #7f8c8d; text-align: center; padding: 8px;">No custom tones yet</div>';
      return;
    }

    customTonesList.innerHTML = customTones
      .map(
        (tone) => `
      <div class="custom-tone-item">
        <div class="custom-tone-info">
          <div class="custom-tone-name">${tone.display_name}</div>
          <div class="custom-tone-desc">${
            tone.description || "No description"
          }</div>
        </div>
        <div class="custom-tone-actions">
          <button class="tone-action-btn edit" onclick="editCustomTone('${
            tone.id
          }')">✏️</button>
          <button class="tone-action-btn delete" onclick="deleteCustomTone('${
            tone.id
          }')">🗑️</button>
        </div>
      </div>
    `
      )
      .join("");
  }

  async saveCustomTone(isEdit = false, toneId = null) {
    try {
      const nameInput = document.getElementById("toneNameInput");
      const displayInput = document.getElementById("toneDisplayInput");
      const descInput = document.getElementById("toneDescInput");

      if (!nameInput.value.trim() || !displayInput.value.trim()) {
        this.showError("Name and display name are required");
        return;
      }

      const toneData = {
        name: nameInput.value.trim().toLowerCase(),
        display_name: displayInput.value.trim(),
        description: descInput.value.trim() || null,
      };

      let result;
      if (isEdit && toneId) {
        result = await this.api.updateCustomTone(toneId, toneData);
      } else {
        result = await this.api.createCustomTone(toneData);
      }

      this.showSuccess(isEdit ? "Tone updated!" : "Tone created!");
      this.cancelToneForm();

      // Reload tones and update UI
      await this.loadTones();
      this.loadCustomTones();
    } catch (error) {
      console.error("Failed to save tone:", error);
      this.showError(error.message || "Failed to save tone");
    }
  }

  cancelToneForm() {
    const form =
      document.getElementById("addToneForm") ||
      document.getElementById("editToneForm");
    if (form) {
      form.remove();
    }
    document.getElementById("addToneButton").style.display = "block";
  }

  async editCustomTone(toneId) {
    const tone = this.allTones.find((t) => t.id === toneId);
    if (!tone) return;

    const customTonesList = document.getElementById("customTonesList");
    if (!customTonesList) return;

    const formHtml = `
      <div class="tone-form" id="editToneForm">
        <div class="tone-form-field">
          <label class="tone-form-label">Tone Name (lowercase, no spaces)</label>
          <input type="text" class="tone-form-input" id="toneNameInput" value="${
            tone.name
          }">
        </div>
        <div class="tone-form-field">
          <label class="tone-form-label">Display Name</label>
          <input type="text" class="tone-form-input" id="toneDisplayInput" value="${
            tone.display_name
          }">
        </div>
        <div class="tone-form-field">
          <label class="tone-form-label">Description (optional)</label>
          <textarea class="tone-form-textarea" id="toneDescInput">${
            tone.description || ""
          }</textarea>
        </div>
        <div class="tone-form-actions">
          <button class="tone-form-btn save" onclick="saveEditedTone('${toneId}')">Update</button>
          <button class="tone-form-btn cancel" onclick="cancelToneForm()">Cancel</button>
        </div>
      </div>
    `;

    customTonesList.insertAdjacentHTML("afterbegin", formHtml);
    document.getElementById("addToneButton").style.display = "none";
  }

  async deleteCustomTone(toneId) {
    if (!confirm("Are you sure you want to delete this custom tone?")) {
      return;
    }

    try {
      await this.api.deleteCustomTone(toneId);
      this.showSuccess("Tone deleted!");

      // Reload tones and update UI
      await this.loadTones();
      this.loadCustomTones();
    } catch (error) {
      console.error("Failed to delete tone:", error);
      this.showError(error.message || "Failed to delete tone");
    }
  }

  loadToneSetting() {
    chrome.storage.sync.get(
      [
        "defaultTone",
        "useIntegrations",
        "enableSelectReply",
        "enableEverywhere",
      ],
      (result) => {
        if (result.defaultTone) {
          this.currentTone = result.defaultTone;
        }
        if (typeof result.useIntegrations === "boolean") {
          this.useIntegrations = result.useIntegrations;
        }
        if (typeof result.enableSelectReply === "boolean") {
          this.enableSelectReply = result.enableSelectReply;
        }
        if (typeof result.enableEverywhere === "boolean") {
          this.enableEverywhere = result.enableEverywhere;
        }

        const loggedOutSelect = document.getElementById(
          "replyToneSelectLoggedOut"
        );
        const loggedInSelect = document.getElementById("replyToneSelect");
        if (loggedOutSelect) loggedOutSelect.value = this.currentTone;
        if (loggedInSelect) loggedInSelect.value = this.currentTone;

        // Update all integration toggles
        document.querySelectorAll(".use-integrations-toggle").forEach((el) => {
          el.checked = this.useIntegrations;
        });
        document.querySelectorAll(".use-integrations-status").forEach((el) => {
          el.textContent = this.useIntegrations ? "On" : "Off";
        });

        // Update all select reply toggles
        document
          .querySelectorAll(".enable-select-reply-toggle")
          .forEach((el) => {
            el.checked = this.enableSelectReply;
          });
        document
          .querySelectorAll(".enable-select-reply-status")
          .forEach((el) => {
            el.textContent = this.enableSelectReply ? "On" : "Off";
          });

        // Update all enable everywhere toggles
        document.querySelectorAll(".enable-everywhere-toggle").forEach((el) => {
          el.checked = this.enableEverywhere;
        });
        document.querySelectorAll(".enable-everywhere-status").forEach((el) => {
          el.textContent = this.enableEverywhere ? "On" : "Off";
        });
      }
    );
  }

  saveIntegrationsSetting(enabled) {
    this.useIntegrations = enabled;
    chrome.storage.sync.set({ useIntegrations: enabled });
    document.querySelectorAll(".use-integrations-status").forEach((el) => {
      el.textContent = enabled ? "On" : "Off";
    });
    document.querySelectorAll(".use-integrations-toggle").forEach((el) => {
      if (el.checked !== enabled) el.checked = enabled;
    });
  }

  saveSelectReplySetting(enabled) {
    this.enableSelectReply = enabled;
    chrome.storage.sync.set({ enableSelectReply: enabled });
    document.querySelectorAll(".enable-select-reply-status").forEach((el) => {
      el.textContent = enabled ? "On" : "Off";
    });
    document.querySelectorAll(".enable-select-reply-toggle").forEach((el) => {
      if (el.checked !== enabled) el.checked = enabled;
    });
  }

  saveEnableEverywhereSetting(enabled) {
    this.enableEverywhere = enabled;
    chrome.storage.sync.set({ enableEverywhere: enabled });
    document.querySelectorAll(".enable-everywhere-status").forEach((el) => {
      el.textContent = enabled ? "On" : "Off";
    });
    document.querySelectorAll(".enable-everywhere-toggle").forEach((el) => {
      if (el.checked !== enabled) el.checked = enabled;
    });
  }

  setupEventListeners() {
    // Login button
    const loginButton = document.getElementById("loginButton");
    if (loginButton) {
      loginButton.addEventListener("click", () => this.handleLogin());
      appendDebug("Primary listener bound: loginButton");
    }

    // Signup button
    const signupButton = document.getElementById("signupButton");
    if (signupButton) {
      signupButton.addEventListener("click", () => this.handleSignup());
    }

    // Listen for storage changes to detect authentication updates
    chrome.storage.onChanged.addListener((changes, namespace) => {
      addVisibleDebug("Storage changed:", changes, namespace); // Debug logging
      if (
        namespace === "sync" &&
        (changes.userToken || changes.userProfile || changes.isAuthenticated)
      ) {
        addVisibleDebug(
          "Auth-related storage change detected (delegating to AuthManager)"
        );
        this.authManager.checkAuthStatus().then(() => {
          const authState = this.authManager.getAuthState();
          this.isLoggedIn = authState.isLoggedIn;
          this.currentUser = authState.currentUser;
          this.updateUIState();
          if (this.isLoggedIn) {
            this.loadCustomTones();
          }
        });
      }
    });

    // Periodic background auth cache check (diagnostic)
    this._bgDiagInterval = setInterval(() => {
      try {
        chrome.runtime.sendMessage({ action: "getAuthState" }, (resp) => {
          if (resp && resp.auth) {
            const bgTokenPresent = !!resp.auth.userToken;
            if (bgTokenPresent && !this.isLoggedIn) {
              addVisibleDebug(
                "[Popup] Background has token but popup state logged out. Forcing re-check."
              );
              this.checkAuthStatus();
            }
          }
        });
      } catch (e) {
        /* ignore */
      }
    }, 5000);

    // Tone selectors
    const toneSelectLoggedOut = document.getElementById(
      "replyToneSelectLoggedOut"
    );
    if (toneSelectLoggedOut) {
      toneSelectLoggedOut.addEventListener("change", (e) =>
        this.saveToneSetting(e.target.value)
      );
    }

    const toneSelectLoggedIn = document.getElementById("replyToneSelect");
    if (toneSelectLoggedIn) {
      toneSelectLoggedIn.addEventListener("change", (e) =>
        this.saveToneSetting(e.target.value)
      );
    }

    // Debug refresh button
    const debugRefreshButton = document.getElementById("debugRefreshButton");
    if (debugRefreshButton) {
      debugRefreshButton.addEventListener("click", () =>
        this.refreshAuthState()
      );
      appendDebug("Primary listener bound: debugRefreshButton");
    }

    // Dashboard button
    const dashboardButton = document.getElementById("dashboardButton");
    if (dashboardButton) {
      dashboardButton.addEventListener("click", () => this.openDashboard());
      appendDebug("Primary listener bound: dashboardButton");
    }

    // Logout button
    const logoutButton = document.getElementById("logoutButton");
    if (logoutButton) {
      logoutButton.addEventListener("click", () => this.handleLogout());
      appendDebug("Primary listener bound: logoutButton");
    }

    // Integrations toggle
    const integrationsToggle = document.getElementById("useIntegrationsToggle");
    if (integrationsToggle) {
      integrationsToggle.addEventListener("change", (e) => {
        this.saveIntegrationsSetting(e.target.checked);
      });
    }
    const selectReplyToggle = document.getElementById(
      "enableSelectReplyToggle"
    );
    if (selectReplyToggle) {
      selectReplyToggle.addEventListener("change", (e) => {
        this.saveSelectReplySetting(e.target.checked);
      });
    }

    document.querySelectorAll(".use-integrations-toggle").forEach((el) => {
      el.addEventListener("change", (e) => {
        this.saveIntegrationsSetting(e.target.checked);
      });
    });
    document.querySelectorAll(".enable-select-reply-toggle").forEach((el) => {
      el.addEventListener("change", (e) => {
        this.saveSelectReplySetting(e.target.checked);
      });
    });

    document.querySelectorAll(".enable-everywhere-toggle").forEach((el) => {
      el.addEventListener("change", (e) => {
        this.saveEnableEverywhereSetting(e.target.checked);
      });
    });
  }

  async handleLogin() {
    try {
      addVisibleDebug("[Popup] handleLogin start");
      const loginBtn = document.getElementById("loginButton");
      if (loginBtn) {
        loginBtn.dataset.originalText = loginBtn.innerHTML;
        loginBtn.innerHTML = "🔄 Opening login...";
        loginBtn.disabled = true;
      } else {
        addVisibleDebug("[Popup] loginButton not found in DOM");
      }

      // Use Supabase Auth popup (wrap to capture early failures)
      let authResult;
      try {
        authResult = await this.supabase.authenticateWithPopup("signin");
        addVisibleDebug("[Popup] authenticateWithPopup resolved");
      } catch (innerErr) {
        addVisibleDebug("[Popup] authenticateWithPopup error:", innerErr);
        throw innerErr;
      }

      // Handle successful authentication
      await this.handleAuthResult(authResult, "Login successful!");
      addVisibleDebug("[Popup] handleAuthResult completed");
    } catch (error) {
      addVisibleDebug("Login failed:", error);
      if (error.message === "Authentication cancelled by user") {
        this.showError("Login cancelled");
      } else {
        this.showError("Login failed. Please try again.");
      }
    } finally {
      const loginBtn = document.getElementById("loginButton");
      if (loginBtn) {
        loginBtn.innerHTML =
          loginBtn.dataset.originalText || "🚀 Login to HumanReplies";
        loginBtn.disabled = false;
      }
      addVisibleDebug("[Popup] handleLogin end");
    }
  }

  async handleSignup() {
    try {
      // Show loading state
      const signupBtn = document.querySelector(
        '.login-button[onclick="handleSignup()"]'
      );
      const originalText = signupBtn.innerHTML;
      signupBtn.innerHTML = "🔄 Opening signup...";
      signupBtn.disabled = true;

      // Use Supabase Auth popup for signup
      const authResult = await this.supabase.authenticateWithPopup("signup");

      // Handle successful authentication (either immediate or after email confirmation)
      await this.handleAuthResult(authResult, "Account created successfully!");
    } catch (error) {
      console.error("Signup failed:", error);
      if (error.message === "Authentication cancelled by user") {
        this.showError("Signup cancelled");
      } else {
        this.showError("Signup failed. Please try again.");
      }
    } finally {
      // Reset button
      const signupBtn = document.querySelector(
        '.login-button[onclick="handleSignup()"]'
      );
      const originalText = "✨ Create Account";
      signupBtn.innerHTML = originalText;
      signupBtn.disabled = false;
    }
  }

  async handleLogout() {
    try {
      // Get current token
      const result = await new Promise((resolve) => {
        chrome.storage.sync.get(["userToken"], resolve);
      });

      if (result.userToken) {
        try {
          // Sign out from Supabase
          await this.supabase.signOut(result.userToken);
        } catch (error) {
          console.warn("Supabase logout failed:", error);
        }
      }

      await this.clearAuthData();
      this.showSuccess("Logged out successfully");
    } catch (error) {
      console.error("Logout failed:", error);
      this.showError("Logout failed");
    }
  }

  async handleAuthResult(authResult, successMessage) {
    if (authResult && authResult.access_token) {
      console.log("handleAuthResult called with:", authResult);

      // Get user info from Supabase
      const userInfo = await this.supabase.getUserInfo(authResult.access_token);
      console.log("User info retrieved:", userInfo);

      // Prepare auth data with user profile
      const authDataWithProfile = {
        access_token: authResult.access_token,
        refresh_token: authResult.refresh_token,
        expires_in: authResult.expires_in,
        userProfile: {
          id: userInfo.id,
          email: userInfo.email,
          full_name:
            userInfo.user_metadata?.full_name || userInfo.email.split("@")[0],
          avatar_url: userInfo.user_metadata?.avatar_url,
          created_at: userInfo.created_at,
        },
      };

      console.log("Storing auth data using AuthManager:", authDataWithProfile);

      // Use the robust auth manager to store data
      const stored = await this.authManager.storeAuthData(authDataWithProfile);

      if (stored) {
        console.log("Auth data stored successfully via AuthManager");

        // Update local state directly (don't wait for AuthManager sync)
        this.isLoggedIn = true;
        this.currentUser = authDataWithProfile.userProfile;

        console.log(
          "Updated local state - isLoggedIn:",
          this.isLoggedIn,
          "currentUser:",
          this.currentUser
        );

        this.updateUIState();
        this.showSuccess(successMessage);

        // Reload tones to get user's custom tones
        await this.loadTones();
        this.loadCustomTones();
      } else {
        console.error("Failed to store auth data");
        this.showError(
          "Login successful but failed to save session. Please try again."
        );
      }
    }
  }

  async clearAuthData() {
    console.log("Clearing auth data using AuthManager");

    // Use auth manager to clear data
    await this.authManager.clearAuthData();

    // Update local state
    this.isLoggedIn = false;
    this.currentUser = null;

    this.updateUIState();
  }

  openDashboard() {
    // Get dashboard URL from environment config
    const dashboardUrl = window.EnvironmentConfig
      ? window.EnvironmentConfig.getConfig().dashboardURL
      : "https://humanreplies.com/dashboard"; // fallback

    chrome.tabs.create({ url: dashboardUrl });
    console.log("[Popup] Opening dashboard:", dashboardUrl);
  }

  updateUIState() {
    console.log(
      "Updating UI state - isLoggedIn:",
      this.isLoggedIn,
      "currentUser:",
      this.currentUser
    ); // Debug logging

    const loggedOutState = document.getElementById("loggedOutState");
    const loggedInState = document.getElementById("loggedInState");

    // Don't update UI state if API is offline - let updateExtensionStatus handle it
    if (this.apiStatusChecked && !this.isApiOnline) {
      return;
    }

    if (this.isLoggedIn && this.currentUser) {
      // Show logged-in interface
      if (loggedOutState) loggedOutState.classList.add("hidden");
      if (loggedInState) {
        loggedInState.classList.remove("hidden");

        // Update user info
        const userAvatar = document.getElementById("userAvatar");
        const userName = document.getElementById("userName");
        const userEmail = document.getElementById("userEmail");

        if (userAvatar) {
          userAvatar.textContent = (
            this.currentUser.full_name || this.currentUser.email
          )
            .charAt(0)
            .toUpperCase();
        }
        if (userName) {
          userName.textContent =
            this.currentUser.full_name || this.currentUser.email.split("@")[0];
        }
        if (userEmail) {
          userEmail.textContent = this.currentUser.email;
        }

        // Load custom tones
        this.loadCustomTones();
      }
    } else {
      // Show logged-out interface
      if (loggedInState) loggedInState.classList.add("hidden");
      if (loggedOutState) {
        loggedOutState.classList.remove("hidden");

        // Update login button text
        const loginButton = document.getElementById("loginButton");
        if (loginButton) {
          loginButton.textContent = "🚀 Login to HumanReplies";
          loginButton.style.background = "#2c3e50";
        }

        // Show disabled overlay for advanced features
        const disabledOverlay = document.querySelector(".disabled-overlay");
        if (disabledOverlay) {
          disabledOverlay.classList.remove("hidden");
        }
      }
    }

    setTimeout(() => this.loadToneSetting(), 50);
  }

  showSuccess(message) {
    this.showNotification(message, "success");
  }

  showError(message) {
    this.showNotification(message, "error");
  }

  showNotification(message, type) {
    // Create notification element
    const notification = document.createElement("div");
    notification.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      z-index: 1000;
      ${
        type === "success"
          ? "background: #27ae60; color: white;"
          : "background: #e74c3c; color: white;"
      }
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  showPopupContent() {
    const supportedSiteView = document.getElementById("supported-site-view");
    if (supportedSiteView) {
      supportedSiteView.style.display = "block";
      addVisibleDebug("[Popup] Content now visible after login check");
    }
  }
}

// Global functions for HTML onclick handlers
function handleLogin() {
  if (window.popupManager) {
    window.popupManager.handleLogin();
  }
}

function handleSignup() {
  if (window.popupManager) {
    window.popupManager.handleSignup();
  }
}

function handleLogout() {
  if (window.popupManager) {
    window.popupManager.handleLogout();
  }
}

function saveToneSetting(tone) {
  if (window.popupManager) {
    window.popupManager.saveToneSetting(tone);
  }
}

function saveCustomTone() {
  if (window.popupManager) {
    window.popupManager.saveCustomTone();
  }
}

function saveEditedTone(toneId) {
  if (window.popupManager) {
    window.popupManager.saveCustomTone(true, toneId);
  }
}

function cancelToneForm() {
  if (window.popupManager) {
    window.popupManager.cancelToneForm();
  }
}

function editCustomTone(toneId) {
  if (window.popupManager) {
    window.popupManager.editCustomTone(toneId);
  }
}

function deleteCustomTone(toneId) {
  if (window.popupManager) {
    window.popupManager.deleteCustomTone(toneId);
  }
}

// Global debug functions
window.debugAuth = async function () {
  const result = await new Promise((resolve) => {
    chrome.storage.sync.get(
      ["userToken", "userProfile", "refreshToken", "tokenExpiry"],
      resolve
    );
  });
  console.log("Current auth storage:", result);
  return result;
};

window.testApiDirect = async function () {
  addVisibleDebug("[DirectTest] Starting direct API test...");

  try {
    // Test 1: Direct fetch to the API
    addVisibleDebug("[DirectTest] Testing direct fetch...");
    const response = await fetch("http://localhost:8000/api/v1/tones/", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    addVisibleDebug("[DirectTest] Response status:", response.status);

    if (response.ok) {
      const data = await response.json();
      addVisibleDebug("[DirectTest] Response data:", {
        hasTones: !!data.tones,
        tonesCount: data.tones ? data.tones.length : 0,
      });
    } else {
      addVisibleDebug("[DirectTest] Response not OK:", response.statusText);
    }
  } catch (error) {
    addVisibleDebug("[DirectTest] Direct fetch error:", error.message);
  }

  // Test 2: Using the API service
  if (window.popupManager && window.popupManager.api) {
    addVisibleDebug("[DirectTest] Testing via API service...");
    try {
      const tones = await window.popupManager.api.getTones({
        timeoutMs: 10000,
        reason: "direct-test",
      });
      addVisibleDebug("[DirectTest] API service result:", {
        tonesCount: tones ? tones.length : 0,
        firstTone: tones && tones[0] ? tones[0].name : "none",
      });
    } catch (error) {
      addVisibleDebug("[DirectTest] API service error:", error.message);
    }
  } else {
    addVisibleDebug("[DirectTest] No API service available");
  }
};

window.forceRefresh = function () {
  if (window.popupManager) {
    window.popupManager.refreshAuthState();
  }
};

window.checkStorageNow = async function () {
  console.log("=== STORAGE DEBUG CHECK ===");

  // Check both sync and local storage
  const syncResult = await new Promise((resolve) => {
    chrome.storage.sync.get(
      [
        "userToken",
        "userProfile",
        "refreshToken",
        "tokenExpiry",
        "isAuthenticated",
      ],
      resolve
    );
  });

  const localResult = await new Promise((resolve) => {
    chrome.storage.local.get(
      [
        "userToken",
        "userProfile",
        "refreshToken",
        "tokenExpiry",
        "isAuthenticated",
      ],
      resolve
    );
  });

  console.log("Sync storage:", syncResult);
  console.log("Local storage:", localResult);

  if (window.popupManager) {
    console.log(
      "PopupManager state - isLoggedIn:",
      window.popupManager.isLoggedIn
    );
    console.log(
      "PopupManager state - currentUser:",
      window.popupManager.currentUser
    );

    if (window.popupManager.authManager) {
      const authState = window.popupManager.authManager.getAuthState();
      console.log("AuthManager state:", authState);
    }
  }

  return { sync: syncResult, local: localResult };
};

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", function () {
  addVisibleDebug("DOMContentLoaded fired");
  console.log("[Popup] DOMContentLoaded fired");
  console.log("[Popup] DOM is ready, initializing...");

  // Check if required dependencies are loaded
  const deps = {
    HumanRepliesAPI: typeof HumanRepliesAPI,
    SupabaseClient: typeof SupabaseClient,
    AuthManager: typeof AuthManager,
    EnvironmentConfig: typeof window.EnvironmentConfig,
  };

  addVisibleDebug("Dependencies: " + JSON.stringify(deps));
  console.log("[Popup] Checking dependencies:", deps);

  appendDebug("DOMContentLoaded");
  try {
    addVisibleDebug("Creating PopupManager...");
    console.log("[Popup] Creating PopupManager...");
    window.popupManager = new PopupManager();

    addVisibleDebug("PopupManager created successfully");
    console.log("[Popup] PopupManager created successfully");
    appendDebug("PopupManager constructed");
  } catch (e) {
    addVisibleDebug("PopupManager error: " + e.message);
    console.error("[Popup] Failed constructing PopupManager", e);
    console.error("[Popup] Error stack:", e.stack);
    appendDebug("PopupManager construction failed: " + (e && e.message));
  }

  // Basic DOM test
  const loggedOutSelect = document.getElementById("replyToneSelectLoggedOut");
  const loggedInSelect = document.getElementById("replyToneSelect");
  console.log("[Popup] DOM elements found:", {
    loggedOut: !!loggedOutSelect,
    loggedIn: !!loggedInSelect,
  });
});

// Cleanup when popup is closed
window.addEventListener("beforeunload", function () {
  if (window.popupManager) {
    addVisibleDebug("[Cleanup] Popup closing, stopping auto-retry");
    window.popupManager.stopOfflineAutoRetry();
  }
});

// Also log when the script is fully parsed
console.log("[Popup] Script parsing completed");

// Test if chrome APIs are available
console.log("[Popup] Chrome APIs available:", {
  chrome: typeof chrome,
  storage: typeof chrome?.storage,
  runtime: typeof chrome?.runtime,
});
