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
initializeApiService()
  .then(() => {
    console.log("Background service worker initialized");
  })
  .catch((error) => {
    console.error("Failed to initialize background service worker:", error);
  });

// We'll handle CORS on the server side instead

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request && request.action) {
    console.log("[BG] Received action:", request.action);
  }

  if (request.action === "authUpdated") {
    currentAuthState = {
      userToken: request.data?.userToken || null,
      refreshToken: request.data?.refreshToken || null,
      tokenExpiry: request.data?.tokenExpiry || null,
      userProfile: request.data?.userProfile || null,
      isAuthenticated: !!request.data?.userToken,
      updatedAt: Date.now(),
    };
    chrome.storage.local.set({ HR_BG_AUTH_CACHE: currentAuthState });
    console.log("[BG] Auth cache updated");
    sendResponse({ ok: true });
    return true;
  }

  if (request.action === "getAuthState") {
    // Lazy load from local storage if memory empty (after SW wake)
    if (!currentAuthState) {
      chrome.storage.local.get(["HR_BG_AUTH_CACHE"], (res) => {
        if (res.HR_BG_AUTH_CACHE) {
          currentAuthState = res.HR_BG_AUTH_CACHE;
        }
        sendResponse({ auth: currentAuthState });
      });
      return true; // async
    }
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
          console.error(
            "[BG] Failed to cache tones:",
            chrome.runtime.lastError
          );
          sendResponse({
            success: false,
            error: chrome.runtime.lastError.message,
          });
        } else {
          console.log(
            "[BG] Tones cached successfully:",
            request.tones.length,
            "tones"
          );
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
});

// Extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log("HumanReplies extension installed");
});

function getNextMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime();
}
