// Background service worker for HumanReplies extension

// Import the API service and environment config
import environmentConfig from "./config/environment.js";
import HumanRepliesAPI from "./core/api-service.js";

// In-memory auth cache (service worker can be restarted; we persist a copy in local storage as well)
let currentAuthState = null;
let tonesCache = null;
let apiService = null;

// Initialize API service with environment config
async function initializeApiService() {
  if (!apiService) {
    await environmentConfig.loadEnvironment();
    apiService = new HumanRepliesAPI(environmentConfig);
  }
  return apiService;
}

// Initialize on startup
initializeApiService().then(() => {
  // After API service ready perform an initial connectivity check
  performConnectivityCheck("background-startup");
});

// Periodic connectivity checks so content scripts can read fresh status
let connectivityInterval = null;
function startConnectivityLoop() {
  if (connectivityInterval) return;
  connectivityInterval = setInterval(() => {
    performConnectivityCheck("background-interval");
  }, 30000); // every 30s
}
startConnectivityLoop();

async function performConnectivityCheck(source = "background-manual") {
  try {
    const api = await initializeApiService();
    if (api && typeof api.checkConnectivity === "function") {
      const result = await api.checkConnectivity();
      chrome.storage.local.set({
        humanreplies_api_status: {
          isOnline: !!result.isOnline,
          lastChecked: Date.now(),
          source,
          error: result.error || null,
        },
      });
    }
  } catch (e) {
    chrome.storage.local.set({
      humanreplies_api_status: {
        isOnline: false,
        lastChecked: Date.now(),
        source,
        error: e.message || "connectivity check failed",
      },
    });
  }
}

// We'll handle CORS on the server side instead

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "authUpdated") {
    currentAuthState = {
      userToken: request.data?.userToken || null,
      refreshToken: request.data?.refreshToken || null,
      tokenExpiry: request.data?.tokenExpiry || null,
      userProfile: request.data?.userProfile || null,
      isAuthenticated: !!request.data?.userToken,
      updatedAt: Date.now(),
    };
    sendResponse({ ok: true });
    return true;
  }

  if (request.action === "getAuthState") {
    // Return current auth state from memory
    sendResponse({ auth: currentAuthState });
    return true;
  }

  if (request.action === "cacheTones") {
    // Cache tones in background script memory and storage
    tonesCache = {
      tones: request.tones,
      timestamp: request.timestamp,
      cachedAt: Date.now(),
    };

    // Persist to storage
    chrome.storage.local.set(
      {
        humanreplies_tones: request.tones,
        humanreplies_tones_timestamp: request.timestamp,
        HR_BG_TONES_CACHE: tonesCache,
      },
      () => {
        if (chrome.runtime.lastError) {
          sendResponse({
            success: false,
            error: chrome.runtime.lastError.message,
          });
        } else {
          sendResponse({ success: true });
        }
      }
    );
    return true;
  }

  if (request.action === "getTones") {
    // Return cached tones if available
    if (tonesCache && tonesCache.tones) {
      sendResponse({ success: true, tones: tonesCache.tones, fromCache: true });
      return true;
    }

    // Try to load from storage
    chrome.storage.local.get(
      ["humanreplies_tones", "HR_BG_TONES_CACHE"],
      (res) => {
        if (res.humanreplies_tones) {
          tonesCache = res.HR_BG_TONES_CACHE || {
            tones: res.humanreplies_tones,
            timestamp: Date.now(),
            cachedAt: Date.now(),
          };
          sendResponse({
            success: true,
            tones: res.humanreplies_tones,
            fromCache: true,
          });
        } else {
          sendResponse({ success: false, error: "No cached tones found" });
        }
      }
    );
    return true;
  }

  if (request.action === "generateReply") {
    initializeApiService()
      .then((api) => api.generateReply(request.context, request.options))
      .then((result) => {
        sendResponse({ success: true, ...result });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }

  if (request.action === "updateApiStatus") {
    // Update API status in storage (popup is notifying us of a status change)
    const statusUpdate = {
      isOnline: !!request.isOnline,
      lastChecked: Date.now(),
      source: request.source || "popup",
    };

    chrome.storage.local.set({ humanreplies_api_status: statusUpdate }, () => {
      if (chrome.runtime.lastError) {
        sendResponse({
          success: false,
          error: chrome.runtime.lastError.message,
        });
      } else {
        sendResponse({ success: true });
      }
    });
    return true;
  }

  if (request.action === "refreshConnectivity") {
    // Try to do a simple connectivity check by testing the API endpoint
    performConnectivityCheck("background-connectivity-check")
      .then(() => {
        // We rely on storage listener; respond optimistically
        sendResponse({ success: true });
      })
      .catch(() => {
        sendResponse({ success: false, error: "connectivity check failed" });
      });

    return true;
  }
});

// Extension installation
chrome.runtime.onInstalled.addListener(() => {});

function getNextMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime();
}
