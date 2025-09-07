// Background service worker for HumanReplies extension

// Import the API service
importScripts("core/api-service.js");

// In-memory auth cache (service worker can be restarted; we persist a copy in local storage as well)
let currentAuthState = null;

const apiService = new HumanRepliesAPI();

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

  if (request.action === "generateReply") {
    apiService
      .generateReply(request.context, request.options)
      .then((result) => {
        sendResponse({ success: true, ...result });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }

  if (request.action === "checkLimits") {
    apiService
      .checkUserLimits()
      .then((limits) => {
        sendResponse({ success: true, ...limits });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});

// Extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log("HumanReplies extension installed");

  // Set default settings
  chrome.storage.sync.set({
    dailyLimit: 20,
    usedReplies: 0,
    lastResetDate: new Date().toDateString(),
  });
});

// Reset daily counter at midnight
chrome.alarms.create("resetDailyLimit", {
  when: getNextMidnight(),
  periodInMinutes: 24 * 60,
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "resetDailyLimit") {
    chrome.storage.sync.set({
      usedReplies: 0,
      lastResetDate: new Date().toDateString(),
    });
  }
});

function getNextMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime();
}
