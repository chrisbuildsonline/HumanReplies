// Background service worker for HumanReplies extension

// Import the API service
importScripts('core/api-service.js');

const apiService = new HumanRepliesAPI();

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'generateReply') {
    apiService.generateReply(request.context, request.options)
      .then(result => {
        sendResponse({ success: true, ...result });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'checkLimits') {
    apiService.checkUserLimits()
      .then(limits => {
        sendResponse({ success: true, ...limits });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});

// Extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('HumanReplies extension installed');
  
  // Set default settings
  chrome.storage.sync.set({
    dailyLimit: 20,
    usedReplies: 0,
    lastResetDate: new Date().toDateString()
  });
});

// Reset daily counter at midnight
chrome.alarms.create('resetDailyLimit', { 
  when: getNextMidnight(),
  periodInMinutes: 24 * 60 
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'resetDailyLimit') {
    chrome.storage.sync.set({
      usedReplies: 0,
      lastResetDate: new Date().toDateString()
    });
  }
});

function getNextMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime();
}