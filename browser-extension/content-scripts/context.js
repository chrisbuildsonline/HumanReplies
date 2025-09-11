let replyButton = null;
let selectedText = "";
let toneMenu = null;
let availableTones = [];
let enableEverywhere = false;
let isApiOnline = false;
let defaultTone = "ask";
let isUpdatingApiStatus = false; // Flag to prevent feedback loops

console.log("HumanReplies context.js loaded");

// Helper function to check if chrome APIs are available
function isChromeApiAvailable() {
  return typeof chrome !== "undefined" && chrome.storage && chrome.runtime;
}

// Helper function to safely execute chrome API calls
async function safeChromeStorageGet(storageType, keys) {
  if (!isChromeApiAvailable()) {
    console.warn("Chrome APIs not available, skipping storage operation");
    return {};
  }
  
  try {
    return await new Promise((resolve) => {
      chrome.storage[storageType].get(keys, resolve);
    });
  } catch (error) {
    console.error("Chrome storage get error:", error);
    return {};
  }
}

async function safeChromeStorageSet(storageType, data) {
  if (!isChromeApiAvailable()) {
    console.warn("Chrome APIs not available, skipping storage operation");
    return;
  }
  
  try {
    await new Promise((resolve) => {
      chrome.storage[storageType].set(data, resolve);
    });
  } catch (error) {
    console.error("Chrome storage set error:", error);
  }
}

// Helper function to update API status without triggering feedback loops
async function updateApiStatus(isOnline) {
  isUpdatingApiStatus = true;
  try {
    await safeChromeStorageSet("local", {
      humanreplies_api_status: {
        isOnline: isOnline,
        lastChecked: Date.now(),
      },
    });
    console.log("API status set to", isOnline ? "online" : "offline");
  } finally {
    // Reset flag after a short delay to allow storage event to process
    setTimeout(() => {
      isUpdatingApiStatus = false;
    }, 100);
  }
}

// Fallback tones if localStorage is empty
const fallbackTones = [
  {
    name: "professional",
    display_name: "💼 Professional",
    is_preset: true,
  },
  { name: "friendly", display_name: "😊 Friendly", is_preset: true },
  { name: "supportive", display_name: "❤️ Supportive", is_preset: true },
];

// Load tones from localStorage
async function loadTonesFromStorage() {
  try {
    const result = await safeChromeStorageGet("local", ["humanreplies_tones_cache"]);

    if (
      result.humanreplies_tones_cache &&
      result.humanreplies_tones_cache.tones
    ) {
      console.log(
        "Loaded tones from localStorage:",
        result.humanreplies_tones_cache.tones.length
      );
      availableTones = result.humanreplies_tones_cache.tones;
    } else {
      console.log("No tones in localStorage, using fallback tones");
      availableTones = fallbackTones;
    }
  } catch (err) {
    console.log("Error loading tones from localStorage, using fallback:", err);
    availableTones = fallbackTones;
  }
}

// Social media sites where context.js should be active
const SOCIAL_MEDIA_SITES = [
  "x.com",
  "twitter.com",
  "linkedin.com",
  "facebook.com",
];

// Check if current site is a social media platform
function isSocialMediaSite() {
  const hostname = window.location.hostname.toLowerCase();
  return SOCIAL_MEDIA_SITES.some((site) => hostname.includes(site));
}

// Load enable everywhere setting from localStorage
async function loadEnableEverywhereSetting() {
  try {
    const result = await safeChromeStorageGet("sync", ["enableEverywhere"]);
    enableEverywhere =
      result.enableEverywhere !== undefined ? result.enableEverywhere : false;
    console.log("Enable everywhere setting:", enableEverywhere);
  } catch (err) {
    console.log("Error loading enable everywhere setting:", err);
    enableEverywhere = false;
  }
}

// Load default tone setting from localStorage
async function loadDefaultToneSetting() {
  try {
    const result = await safeChromeStorageGet("sync", ["defaultTone"]);
    defaultTone = result.defaultTone || "ask";
    console.log("Default tone setting:", defaultTone);
  } catch (err) {
    console.log("Error loading default tone setting:", err);
    defaultTone = "ask";
  }
}

// Load API status from storage
async function loadApiStatus() {
  try {
    const result = await safeChromeStorageGet("local", ["humanreplies_api_status"]);

    if (result.humanreplies_api_status) {
      const status = result.humanreplies_api_status;
      const isRecent = Date.now() - status.lastChecked < 60000; // 1 minute

      if (isRecent) {
        isApiOnline = status.isOnline;
        console.log("Loaded API status:", isApiOnline ? "online" : "offline");
      } else {
        console.log("API status cache expired, assuming offline until live check");
        isApiOnline = false;
      }
    } else {
      console.log("No API status found, assuming offline until live check");
      isApiOnline = false;
    }
  } catch (err) {
    console.log("Error loading API status:", err);
    isApiOnline = false;
  }
}

// Check if context.js should be active on current site
function shouldBeActive() {
  // First check if API is online
  if (!isApiOnline) {
    console.log("Context.js disabled - API is offline");
    return false;
  }

  // Check if we should enable everywhere or restrict to social media
  if (enableEverywhere) {
    return true; // Active on all sites when enable everywhere is ON
  }

  // Default behavior: only active on social media sites
  const isOnSocialMedia = isSocialMediaSite();
  console.log(
    "Checking if should be active - enableEverywhere:",
    enableEverywhere,
    "isOnSocialMedia:",
    isOnSocialMedia,
    "isApiOnline:",
    isApiOnline
  );
  return isOnSocialMedia;
}

// Initialize settings and tones on script load
async function initialize() {
  await loadEnableEverywhereSetting();
  await loadApiStatus();
  await loadTonesFromStorage();
  await loadDefaultToneSetting();

  if (!shouldBeActive()) {
    console.log(
      "Context.js disabled - API offline or restricted to social media"
    );
    if (!isApiOnline) {
      startOfflineStatusPolling();
    }
    return;
  }

  // If API is online, stop any polling
  if (offlineStatusInterval) {
    clearInterval(offlineStatusInterval);
    offlineStatusInterval = null;
  }

  console.log("Context.js active on this site");
}

initialize();

function createToneMenu(buttonElement) {
  console.log("Creating tone menu with", availableTones.length, "tones");

  // Remove existing menu
  if (toneMenu) {
    toneMenu.remove();
    toneMenu = null;
  }

  // Ensure tones are loaded
  if (availableTones.length === 0) {
    console.log("No tones available, reloading from storage");
    loadTonesFromStorage().then(() => {
      if (availableTones.length > 0) {
        createToneMenu(buttonElement); // Retry after loading
      }
    });
    return;
  }

  const menu = document.createElement("div");
  menu.className = "humanreplies-tone-menu";
  menu.style.cssText = `
    position: absolute;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10001;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    width: 200px;
    display: block;
  `;

  const header = document.createElement("div");
  header.textContent = "Choose Reply Tone";
  header.style.cssText =
    "font-size: 12px; font-weight: 600; margin-bottom: 8px; color: #666;";
  menu.appendChild(header);

  availableTones.forEach((tone) => {
    const btn = document.createElement("button");
    btn.style.cssText = `
      display: block;
      width: 100%;
      padding: 6px 8px;
      border: none;
      background: transparent;
      text-align: left;
      cursor: pointer;
      border-radius: 4px;
      font-size: 13px;
      margin-bottom: 2px;
    `;
    btn.innerHTML = tone.display_name;
    btn.addEventListener("mouseenter", () => {
      btn.style.background = "#f5f5f5";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.background = "transparent";
    });
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleReplyGeneration(tone.name);
      menu.remove();
      toneMenu = null;
    });
    menu.appendChild(btn);
  });

  // Position menu below the button
  const rect = buttonElement.getBoundingClientRect();
  menu.style.top = rect.bottom + window.scrollY + 4 + "px";
  menu.style.left = rect.left + window.scrollX + "px";

  document.body.appendChild(menu);
  toneMenu = menu;

  // Close menu when clicking outside
  setTimeout(() => {
    const closeHandler = (e) => {
      if (!menu.contains(e.target) && e.target !== buttonElement) {
        menu.remove();
        toneMenu = null;
        document.removeEventListener("click", closeHandler);
      }
    };
    document.addEventListener("click", closeHandler);
  }, 100);
}

function createReplyButton() {
  console.log("Creating reply button");
  const button = document.createElement("div");
  button.id = "humanreplies-reply-button";
  button.innerHTML = "💬 Generate Reply";
  button.style.cssText = `
    position: absolute;
    background: linear-gradient(45deg, #f6f1e8, #c4b8a5);
    color: #000;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: bold;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    cursor: pointer;
    z-index: 10000;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    border: 1px solid #000;
    user-select: none;
    display: none;
    white-space: nowrap;
    transition: transform 0.2s;
  `;

  button.addEventListener("mouseenter", () => {
    button.style.transform = "scale(1.05)";
  });

  button.addEventListener("mouseleave", () => {
    button.style.transform = "scale(1)";
  });

  // Add arrow using ::after pseudo-element, but only show if defaultTone is "ask"
  const style = document.createElement("style");
  style.textContent = `
    #humanreplies-reply-button.show-arrow::after {
      content: "▼";
      font-size: 8px;
      margin-left: 4px;
      opacity: 0.8;
    }
  `;
  if (!document.querySelector("style[data-humanreplies-arrow]")) {
    style.setAttribute("data-humanreplies-arrow", "true");
    document.head.appendChild(style);
  }

  // Set arrow visibility based on default tone
  if (defaultTone === "ask") {
    button.classList.add("show-arrow");
  }

  button.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("Reply button clicked, default tone:", defaultTone);

    // If a preset tone is set (not "ask"), generate reply directly
    if (defaultTone && defaultTone !== "ask") {
      handleReplyGeneration(defaultTone);
    } else {
      // Show tone menu for "always ask me"
      createToneMenu(button);
    }
  });

  document.body.appendChild(button);
  return button;
}

function showReplyButton(selection) {
  console.log("showReplyButton called with selection:", selection.toString());

  if (!replyButton) {
    replyButton = createReplyButton();
  }

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  console.log("Selection rect:", rect);
  console.log("Button position:", {
    left: rect.right + 10 + window.scrollX,
    top: rect.top + window.scrollY,
  });

  replyButton.style.display = "block";
  replyButton.style.left = `${rect.right + 10 + window.scrollX}px`;
  replyButton.style.top = `${rect.top + window.scrollY}px`;

  console.log("Button should now be visible");
}

function hideReplyButton() {
  if (replyButton) {
    replyButton.style.display = "none";
  }
}

function enforceCharacterLimit(text, maxLength) {
  if (!text || text.length <= maxLength) {
    return text;
  }

  // Try to break at word boundary
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + "...";
  }

  return truncated.substring(0, maxLength - 3) + "...";
}

let loadingBox = null;
let successBox = null;
let errorBox = null;

function showLoadingBox() {
  // Remove any existing boxes
  hideAllBoxes();

  loadingBox = document.createElement("div");
  loadingBox.id = "humanreplies-loading-box";
  loadingBox.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <div style="width: 16px; height: 16px; border: 2px solid #f3f3f3; border-top: 2px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite;"></div>
      <span>Generating reply...</span>
    </div>
  `;
  loadingBox.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 12px 16px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10002;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    color: #333;
    min-width: 200px;
  `;

  // Add animation keyframes if not already added
  if (!document.querySelector("style[data-humanreplies-loading]")) {
    const style = document.createElement("style");
    style.setAttribute("data-humanreplies-loading", "true");
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(loadingBox);
}

function hideLoadingBox() {
  if (loadingBox) {
    loadingBox.remove();
    loadingBox = null;
  }
}

function showSuccessBox(variations, remainingReplies) {
  // Remove any existing boxes
  hideAllBoxes();

  // Store variations and current index
  const currentVariationIndex = 0;

  successBox = document.createElement("div");
  successBox.id = "humanreplies-success-box";
  successBox._variations = variations;
  successBox._currentIndex = currentVariationIndex;

  const hasMultipleVariations = variations.length > 1;
  const currentReply = variations[currentVariationIndex];

  successBox.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
      <span style="font-weight: 600; color: #27ae60;">✅ Reply Generated</span>
      <button id="humanreplies-close-btn" style="background: none; border: none; font-size: 16px; cursor: pointer; color: #999;">×</button>
    </div>
    ${
      hasMultipleVariations
        ? `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding: 4px 8px; background: #f8f9fa; border-radius: 4px;">
        <button id="humanreplies-prev-btn" style="
          background: none;
          border: none;
          font-size: 16px;
          cursor: pointer;
          color: #666;
          padding: 4px;
          ${
            currentVariationIndex === 0
              ? "opacity: 0.3; cursor: not-allowed;"
              : ""
          }
        ">‹</button>
        <span style="font-size: 12px; color: #666;">
          Variation ${currentVariationIndex + 1} of ${variations.length}
        </span>
        <button id="humanreplies-next-btn" style="
          background: none;
          border: none;
          font-size: 16px;
          cursor: pointer;
          color: #666;
          padding: 4px;
          ${
            currentVariationIndex === variations.length - 1
              ? "opacity: 0.3; cursor: not-allowed;"
              : ""
          }
        ">›</button>
      </div>
    `
        : ""
    }
    <textarea id="humanreplies-reply-text" style="
      width: 100%;
      min-height: 80px;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 8px;
      font-family: inherit;
      font-size: 13px;
      resize: vertical;
      margin-bottom: 8px;
    ">${currentReply}</textarea>
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <span id="humanreplies-char-count" style="font-size: 11px; color: #666;">
        ${currentReply.length} characters${
    remainingReplies ? ` • ${remainingReplies} replies left` : ""
  }
      </span>
      <button id="humanreplies-copy-btn" style="
        background: #3498db;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 4px;
      ">
        📋 Copy
      </button>
    </div>
  `;

  successBox.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: white;
    border: 1px solid #27ae60;
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10002;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    color: #333;
    width: 320px;
    max-width: calc(100vw - 40px);
  `;

  document.body.appendChild(successBox);

  // Add event listeners
  const closeBtn = successBox.querySelector("#humanreplies-close-btn");
  const copyBtn = successBox.querySelector("#humanreplies-copy-btn");
  const textarea = successBox.querySelector("#humanreplies-reply-text");
  const prevBtn = successBox.querySelector("#humanreplies-prev-btn");
  const nextBtn = successBox.querySelector("#humanreplies-next-btn");
  const charCount = successBox.querySelector("#humanreplies-char-count");

  closeBtn.addEventListener("click", () => {
    hideSuccessBox();
  });

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(textarea.value);
      copyBtn.innerHTML = "✅ Copied!";
      setTimeout(() => {
        copyBtn.innerHTML = "📋 Copy";
      }, 2000);
    } catch (err) {
      console.error("Failed to copy text:", err);
      copyBtn.innerHTML = "❌ Failed";
      setTimeout(() => {
        copyBtn.innerHTML = "📋 Copy";
      }, 2000);
    }
  });

  // Navigation event listeners
  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (successBox._currentIndex > 0) {
        successBox._currentIndex--;
        updateVariationDisplay(successBox, remainingReplies);
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (successBox._currentIndex < successBox._variations.length - 1) {
        successBox._currentIndex++;
        updateVariationDisplay(successBox, remainingReplies);
      }
    });
  }

  // Auto-hide after 30 seconds
  setTimeout(() => {
    hideSuccessBox();
  }, 30000);
}

function updateVariationDisplay(successBox, remainingReplies) {
  const textarea = successBox.querySelector("#humanreplies-reply-text");
  const charCount = successBox.querySelector("#humanreplies-char-count");
  const prevBtn = successBox.querySelector("#humanreplies-prev-btn");
  const nextBtn = successBox.querySelector("#humanreplies-next-btn");
  const variationCounter = successBox.querySelector(
    "#humanreplies-success-box > div:nth-child(2) span"
  );

  const currentReply = successBox._variations[successBox._currentIndex];

  // Update textarea content
  textarea.value = currentReply;

  // Update character count
  if (charCount) {
    charCount.textContent = `${currentReply.length} characters${
      remainingReplies ? ` • ${remainingReplies} replies left` : ""
    }`;
  }

  // Update navigation buttons
  if (prevBtn) {
    if (successBox._currentIndex === 0) {
      prevBtn.style.opacity = "0.3";
      prevBtn.style.cursor = "not-allowed";
    } else {
      prevBtn.style.opacity = "1";
      prevBtn.style.cursor = "pointer";
    }
  }

  if (nextBtn) {
    if (successBox._currentIndex === successBox._variations.length - 1) {
      nextBtn.style.opacity = "0.3";
      nextBtn.style.cursor = "not-allowed";
    } else {
      nextBtn.style.opacity = "1";
      nextBtn.style.cursor = "pointer";
    }
  }

  // Update variation counter
  if (variationCounter) {
    variationCounter.textContent = `Variation ${
      successBox._currentIndex + 1
    } of ${successBox._variations.length}`;
  }
}

function hideSuccessBox() {
  if (successBox) {
    successBox.remove();
    successBox = null;
  }
}

function showErrorBox(errorMessage) {
  // Remove any existing boxes
  hideAllBoxes();

  errorBox = document.createElement("div");
  errorBox.id = "humanreplies-error-box";
  errorBox.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
      <span style="font-weight: 600; color: #f39c12;">⚠️ Generation Failed</span>
      <button id="humanreplies-error-close-btn" style="background: none; border: none; font-size: 16px; cursor: pointer; color: #999;">×</button>
    </div>
    <p style="margin: 0; line-height: 1.4; color: #666;">
      ${errorMessage}
    </p>
  `;

  errorBox.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #fff8dc;
    border: 1px solid #f39c12;
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10002;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    width: 280px;
    max-width: calc(100vw - 40px);
  `;

  document.body.appendChild(errorBox);

  // Add event listeners
  const closeBtn = errorBox.querySelector("#humanreplies-error-close-btn");
  closeBtn.addEventListener("click", () => {
    hideErrorBox();
  });

  // Auto-hide after 8 seconds
  setTimeout(() => {
    hideErrorBox();
  }, 8000);
}

function hideErrorBox() {
  if (errorBox) {
    errorBox.remove();
    errorBox = null;
  }
}

function hideAllBoxes() {
  hideLoadingBox();
  hideSuccessBox();
  hideErrorBox();
}

async function handleReplyGeneration(tone) {
  console.log("Generate reply for:", selectedText, "with tone:", tone);

  // Hide the reply button
  hideReplyButton();

  // Show loading state
  showLoadingBox();

  try {
    // Get current platform based on URL
    const hostname = window.location.hostname.toLowerCase();
    let platform = "generic";
    if (hostname.includes("x.com") || hostname.includes("twitter.com")) {
      platform = "x";
    } else if (hostname.includes("linkedin.com")) {
      platform = "linkedin";
    } else if (hostname.includes("facebook.com")) {
      platform = "facebook";
    }

    // Check if chrome.runtime is available
    if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
      hideLoadingBox();
      showErrorBox("Extension is not properly loaded. Please refresh the page and try again.");
      return;
    }

    // Send message to background script for API call with timeout
    const response = await Promise.race([
      new Promise((resolve, reject) => {
        try {
          chrome.runtime.sendMessage(
            {
              action: "generateReply",
              context: selectedText,
              options: {
                platform: platform,
                tone: tone || "helpful",
              },
            },
            (response) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(response);
              }
            }
          );
        } catch (error) {
          reject(error);
        }
      }),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error("Reply generation timed out after 5 seconds"));
        }, 5000);
      })
    ]);

    hideLoadingBox();

    if (response && response.success) {
      // Enforce character limit based on platform
      const maxLength = platform === "x" ? 280 : 500;

      // Handle variations or single reply
      let variations = response.variations;
      if (!variations || !Array.isArray(variations)) {
        // Fallback to single reply
        variations = [response.reply];
      }

      // Enforce character limits on all variations
      const processedVariations = variations.map((reply) =>
        enforceCharacterLimit(reply, maxLength)
      );

      console.log(`Generated ${processedVariations.length} variations`);
      showSuccessBox(processedVariations, response.remainingReplies);
    } else {
      const errorMessage = response?.error || "Unknown error occurred";
      console.error("Reply generation failed:", errorMessage);
      
      // Trigger connectivity check when reply generation fails
      if (typeof window.checkConnectivity === "function") {
        console.log("Reply failed, checking API connectivity...");
        window.checkConnectivity().then((result) => {
          isApiOnline = result.isOnline;
          if (!result.isOnline) {
            console.log("API confirmed offline, starting polling");
            startOfflineStatusPolling();
          }
        }).catch((error) => {
          console.error("Connectivity check failed:", error);
          isApiOnline = false;
          startOfflineStatusPolling();
        });
      } else {
        // Fallback: Mark API as offline in storage for robust status propagation
        await updateApiStatus(false);
      }
      
      showErrorBox(errorMessage);
    }
  } catch (error) {
    console.error("Reply generation failed:", error);
    hideLoadingBox();
    
    // Handle timeout specifically
    if (error.message && error.message.includes("timed out")) {
      console.log("Reply generation timed out, checking API connectivity...");
      
      // Trigger connectivity check when timeout occurs
      if (typeof window.checkConnectivity === "function") {
        window.checkConnectivity().then((result) => {
          isApiOnline = result.isOnline;
          if (!result.isOnline) {
            console.log("API confirmed offline after timeout");
            startOfflineStatusPolling();
          }
        }).catch((connectivityError) => {
          console.error("Connectivity check failed:", connectivityError);
          isApiOnline = false;
          startOfflineStatusPolling();
        });
      } else {
        // Fallback: Mark API as offline in storage
        await updateApiStatus(false);
      }
      
      showErrorBox("Reply generation timed out. The API might be offline.");
    } else {
      showErrorBox("We couldn't generate a reply now, try again later");
    }
  }
}

function handleSelection() {
  // Check if context.js should be active before handling selection
  if (!shouldBeActive()) {
    return;
  }

  console.log("handleSelection triggered");
  const selection = window.getSelection();

  console.log("Selection details:", {
    rangeCount: selection.rangeCount,
    text: selection.toString(),
    textLength: selection.toString().trim().length,
  });

  if (selection.rangeCount > 0 && selection.toString().trim().length > 0) {
    selectedText = selection.toString().trim();
    console.log("Text selected, showing button for:", selectedText);
    showReplyButton(selection);
  } else {
    console.log("No text selected, hiding button");
    hideReplyButton();
  }
}

// Listen for storage changes to reload tones and settings when updated
if (isChromeApiAvailable()) {
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local" && changes.humanreplies_tones_cache) {
      console.log("Tones cache updated, reloading tones");
      loadTonesFromStorage();
    }

    if (namespace === "local" && changes.humanreplies_api_status) {
      // Ignore storage changes we caused ourselves to prevent feedback loops
      if (isUpdatingApiStatus) {
        console.log("Ignoring API status change (self-update)");
        return;
      }
      
      console.log("API status changed, reloading");
      loadApiStatus().then(() => {
        // Hide reply button if API went offline
        if (!shouldBeActive()) {
          hideReplyButton();
          if (toneMenu) {
            toneMenu.remove();
            toneMenu = null;
          }
        }
      });
    }

    if (namespace === "sync" && changes.enableEverywhere) {
      console.log("Enable everywhere setting changed, reloading");
      loadEnableEverywhereSetting().then(() => {
        // Hide reply button if setting changed and we're now on a restricted site
        if (!shouldBeActive()) {
          hideReplyButton();
          if (toneMenu) {
            toneMenu.remove();
            toneMenu = null;
          }
        }
      });
    }

    if (namespace === "sync" && changes.defaultTone) {
      console.log("Default tone setting changed, reloading");
      loadDefaultToneSetting().then(() => {
        // Update arrow visibility on existing button
        if (replyButton) {
          if (defaultTone === "ask") {
            replyButton.classList.add("show-arrow");
          } else {
            replyButton.classList.remove("show-arrow");
          }
        }
      });
    }
  });
} else {
  console.warn("Chrome APIs not available, storage change listener not set up");
}

// Periodically poll API status every 5 seconds
let offlineStatusInterval = null;

async function startOfflineStatusPolling() {
  if (offlineStatusInterval) return;
  let lastApiOnline = isApiOnline;
  offlineStatusInterval = setInterval(async () => {
    await loadApiStatus();
    if (isApiOnline) {
      console.log("Context.js: API reconnected, re-enabling features");
      clearInterval(offlineStatusInterval);
      offlineStatusInterval = null;
      initialize();
    }
    lastApiOnline = isApiOnline;
  }, 5000);
}

console.log("Adding event listeners");
document.addEventListener("mouseup", handleSelection);
document.addEventListener("keyup", handleSelection);

document.addEventListener("click", (e) => {
  if (
    e.target.id !== "humanreplies-reply-button" &&
    !e.target.closest(".humanreplies-tone-menu")
  ) {
    setTimeout(() => {
      const selection = window.getSelection();
      if (!selection.toString().trim()) {
        hideReplyButton();
        if (toneMenu) {
          toneMenu.remove();
          toneMenu = null;
        }
      }
    }, 100);
  }
});
