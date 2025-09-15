// Debug logging control - set to false to disable all logs
const DEBUG_ENABLED = false;

function debugLog(...args) {
  if (DEBUG_ENABLED) {
    console.log("[HumanReplies]", ...args);
  }
}

let replyButton = null;
let selectedText = "";
let toneMenu = null;
let availableTones = [];
let siteSpecificMode = false;
let extensionMode = "selected"; // "everywhere", "selected", "disabled"
let allowedSites = ["x.com", "twitter.com", "linkedin.com", "facebook.com"];
let isApiOnline = false;
let defaultTone = "ask";
let useOwnVoice = false;
let userWritingStyle = "";
let improveTextEnabled = true; // Enable improve text feature by default
let isUpdatingApiStatus = false; // Flag to prevent feedback loops
let isExtensionContextInvalidated = false; // Flag to track invalid extension context

// Helper function to check if extension context is still valid
function isExtensionContextValid() {
  try {
    // chrome.runtime.id becomes undefined when context is invalidated
    return typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id;
  } catch (error) {
    // Any error accessing chrome.runtime indicates invalidation
    return false;
  }
}

// Helper function to check if chrome APIs are available
function isChromeApiAvailable() {
  if (isExtensionContextInvalidated) {
    return false;
  }

  if (!isExtensionContextValid()) {
    console.warn("Extension context has been invalidated");
    isExtensionContextInvalidated = true;
    shutdownGracefully();
    return false;
  }

  return typeof chrome !== "undefined" && chrome.storage && chrome.runtime;
}

// Helper function to safely execute chrome API calls
async function safeChromeStorageGet(storageType, keys) {
  if (!isChromeApiAvailable()) {
    console.warn("Chrome APIs not available, skipping storage operation");
    return {};
  }

  try {
    return await new Promise((resolve, reject) => {
      // Double-check context validity before making the call
      if (!isExtensionContextValid()) {
        console.warn("Extension context invalidated before storage get");
        isExtensionContextInvalidated = true;
        shutdownGracefully();
        resolve({});
        return;
      }

      chrome.storage[storageType].get(keys, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result);
        }
      });
    });
  } catch (error) {
    // Check for extension context invalidation
    if (
      error.message &&
      (error.message.includes("Extension context invalidated") ||
        error.message.includes("receiving end does not exist"))
    ) {
      console.warn(
        "Extension context invalidated - shutting down context script"
      );
      isExtensionContextInvalidated = true;
      shutdownGracefully();
      return {};
    }
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
    await new Promise((resolve, reject) => {
      // Double-check context validity before making the call
      if (!isExtensionContextValid()) {
        console.warn("Extension context invalidated before storage set");
        isExtensionContextInvalidated = true;
        shutdownGracefully();
        resolve();
        return;
      }

      chrome.storage[storageType].set(data, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  } catch (error) {
    // Check for extension context invalidation
    if (
      error.message &&
      (error.message.includes("Extension context invalidated") ||
        error.message.includes("receiving end does not exist"))
    ) {
      console.warn("Extension context invalidated during storage set");
      isExtensionContextInvalidated = true;
      shutdownGracefully();
      return;
    }
    console.error("Chrome storage set error:", error);
  }
}

// Graceful shutdown when extension context is invalidated
function shutdownGracefully() {
  // Clear intervals and timeouts
  if (offlineStatusInterval) {
    clearInterval(offlineStatusInterval);
    offlineStatusInterval = null;
  }

  // Remove UI elements
  if (replyButton) {
    replyButton.remove();
    replyButton = null;
  }

  if (toneMenu) {
    toneMenu.remove();
    toneMenu = null;
  }

  // Hide any notifications
  hideAllBoxes();

  // Remove event listeners
  document.removeEventListener("mouseup", handleSelection);
  document.removeEventListener("keyup", handleSelection);
}

// Helper function to update API status without triggering feedback loops
async function updateApiStatus(isOnline, source = "content-script") {
  if (isExtensionContextInvalidated) return;

  isUpdatingApiStatus = true;
  try {
    const statusUpdate = {
      isOnline: !!isOnline, // Ensure boolean
      lastChecked: Date.now(),
      source: source,
      checkedAt: new Date().toISOString(),
    };

    await safeChromeStorageSet("local", {
      humanreplies_api_status: statusUpdate,
    });

    // Update local state
    isApiOnline = isOnline;
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
    const result = await safeChromeStorageGet("local", [
      "humanreplies_tones_cache",
    ]);

    if (
      result.humanreplies_tones_cache &&
      result.humanreplies_tones_cache.tones
    ) {
      availableTones = result.humanreplies_tones_cache.tones;
    } else {
      // console.log("No tones in localStorage, using fallback tones");
      availableTones = fallbackTones;
    }
  } catch (err) {
    // console.log("Error loading tones from localStorage, using fallback:", err);
    availableTones = fallbackTones;
  }
}

// Sites where context.js should be active
const DEFAULT_ALLOWED_SITES = [
  "x.com",
  "twitter.com",
  "linkedin.com",
  "facebook.com",
];

// Check if current site is in the allowed sites list
function isOnAllowedSite() {
  const hostname = window.location.hostname.toLowerCase();
  return allowedSites.some((site) => hostname.includes(site));
}

// Load site settings from storage
async function loadSiteSettings() {
  try {
    const result = await safeChromeStorageGet("sync", [
      "siteSpecificMode",
      "extensionMode",
      "allowedSites",
    ]);
    siteSpecificMode =
      result.siteSpecificMode !== undefined ? result.siteSpecificMode : false;

    // Load extension mode with migration from old siteSpecificMode
    if (
      result.extensionMode &&
      ["everywhere", "selected", "disabled"].includes(result.extensionMode)
    ) {
      extensionMode = result.extensionMode;
    } else if (result.siteSpecificMode !== undefined) {
      // Migrate from old setting
      extensionMode = result.siteSpecificMode ? "selected" : "everywhere";
    } else {
      extensionMode = "everywhere";
    }
    if (Array.isArray(result.allowedSites)) {
      allowedSites = result.allowedSites;
    } else if (result.allowedSites === undefined) {
      // Only set defaults if allowedSites has never been set
      allowedSites = DEFAULT_ALLOWED_SITES;
    }
    // console.log("Site specific mode:", siteSpecificMode, "Allowed sites:", allowedSites);
  } catch (err) {
    // console.log("Error loading site settings:", err);
    siteSpecificMode = false;
    allowedSites = DEFAULT_ALLOWED_SITES;
  }
}

// Load default tone setting from localStorage
async function loadDefaultToneSetting() {
  try {
    const result = await safeChromeStorageGet("sync", ["defaultTone"]);
    defaultTone = result.defaultTone || "ask";
    // console.log("Default tone setting:", defaultTone);
  } catch (err) {
    // console.log("Error loading default tone setting:", err);
    defaultTone = "ask";
  }
}

// Load user voice settings
async function loadUserVoiceSettings() {
  try {
    const result = await safeChromeStorageGet("sync", [
      "useOwnVoice",
      "writingStyle",
      "guardianText",
      "improveTextEnabled",
    ]);
    useOwnVoice = result.useOwnVoice !== undefined ? result.useOwnVoice : false;
    userWritingStyle = result.writingStyle || "";
    improveTextEnabled =
      result.improveTextEnabled !== undefined
        ? result.improveTextEnabled
        : true;
    // console.log("User voice settings:", { useOwnVoice, userWritingStyle, improveTextEnabled });
  } catch (err) {
    // console.log("Error loading user voice settings:", err);
    useOwnVoice = false;
    userWritingStyle = "";
    improveTextEnabled = true;
  }
}

// Load API status from storage
async function loadApiStatus() {
  try {
    const result = await safeChromeStorageGet("local", [
      "humanreplies_api_status",
    ]);

    if (result.humanreplies_api_status) {
      const status = result.humanreplies_api_status;
      isApiOnline = !!status.isOnline;
      // console.log("Loaded API status:", isApiOnline ? "online" : "offline");
    } else {
      // console.log("No API status found in storage. Requesting background refresh...");
      isApiOnline = false; // temporary until refresh
      if (isChromeApiAvailable() && !window.__hr_requested_initial_status) {
        window.__hr_requested_initial_status = true;
        try {
          if (isExtensionContextValid()) {
            chrome.runtime.sendMessage({ action: "refreshConnectivity" });
          }
          // Try a delayed re-read after 1s
          setTimeout(async () => {
            const retry = await safeChromeStorageGet("local", [
              "humanreplies_api_status",
            ]);
            if (retry.humanreplies_api_status) {
              const s = retry.humanreplies_api_status;
              isApiOnline = !!s.isOnline;
              // console.log("Status loaded after refresh:", isApiOnline ? "online" : "offline");
              if (isApiOnline) {
                // Stop offline polling if running
                if (offlineStatusInterval) {
                  clearInterval(offlineStatusInterval);
                  offlineStatusInterval = null;
                }
              } else {
                startOfflineStatusPolling();
              }
            } else {
              // console.log("Still no status after refresh attempt; will rely on polling");
              startOfflineStatusPolling();
            }
          }, 1000);
        } catch (e) {
          console.warn("Failed to request connectivity refresh", e);
        }
      }
    }
  } catch (err) {
    // console.log("Error loading API status:", err);
    isApiOnline = false;
  }
}

// Check if context.js should be active on current site
function shouldBeActive() {
  debugLog("shouldBeActive check:", {
    isApiOnline,
    extensionMode,
    hostname: window.location.hostname,
    allowedSites,
  });

  // First check if API is online
  if (!isApiOnline) {
    debugLog("Context.js disabled - API is offline");
    return false;
  }

  // Check extension mode
  switch (extensionMode) {
    case "disabled":
      debugLog("Extension is disabled everywhere");
      return false;
    case "selected":
      const onAllowed = isOnAllowedSite();
      debugLog("Extension in selected mode, on allowed site:", onAllowed);
      return onAllowed;
    case "everywhere":
    default:
      debugLog("Extension in everywhere mode");
      return true;
  }
}

// Initialize settings and tones on script load
async function initialize() {
  await loadSiteSettings();
  await loadApiStatus();
  await loadTonesFromStorage();
  await loadDefaultToneSetting();
  await loadUserVoiceSettings();

  if (!shouldBeActive()) {
    // console.log("Context.js disabled - API offline or restricted to social media");
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

  // console.log("Context.js active on this site");
}

initialize();

function createToneMenu(buttonElement) {
  // console.log("Creating tone menu with", availableTones.length, "tones");

  // Remove existing menu
  if (toneMenu) {
    toneMenu.remove();
    toneMenu = null;
  }

  // Ensure tones are loaded
  if (availableTones.length === 0) {
    // console.log("No tones available, reloading from storage");
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
      color: #000 !important;
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

function createReplyButton(isImproveMode = false) {
  // console.log("Creating reply button");
  const button = document.createElement("div");
  button.id = "humanreplies-reply-button";
  button.innerHTML = isImproveMode ? "✨ Improve text" : "💬 Generate Reply";
  button.dataset.improveMode = isImproveMode.toString();
  button.style.cssText = `
    position: absolute;
    background: #f6f1e8;
    color: #000;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: bold;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    cursor: pointer;
    z-index: 10000;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    border: 1px solid #b1b1b1;
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

  // Set arrow visibility based on default tone (only for generate mode, not improve mode)
  if (defaultTone === "ask" && !isImproveMode) {
    button.classList.add("show-arrow");
  }

  button.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    // console.log("Reply button clicked, default tone:", defaultTone, "improve mode:", isImproveMode);

    // For improve mode, always use the default tone directly (no menu)
    if (isImproveMode) {
      handleReplyGeneration(defaultTone || "helpful");
      return;
    }

    // For generate mode, follow normal logic
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

function showReplyButton(selection, isImproveMode = false) {
  // console.log("showReplyButton called with selection:", selection.toString());

  // Remove existing button if mode has changed
  if (
    replyButton &&
    replyButton.dataset.improveMode !== isImproveMode.toString()
  ) {
    replyButton.remove();
    replyButton = null;
  }

  if (!replyButton) {
    replyButton = createReplyButton(isImproveMode);
  }

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  // console.log("Selection rect:", rect);
  // console.log("Button position:", { left: rect.right + 10 + window.scrollX, top: rect.top + window.scrollY });

  // Store button position for later use by boxes
  replyButtonPosition.left = rect.right + 10 + window.scrollX;
  replyButtonPosition.top = rect.top + window.scrollY;

  replyButton.style.display = "block";
  replyButton.style.left = `${replyButtonPosition.left}px`;
  replyButton.style.top = `${replyButtonPosition.top}px`;

  // console.log("Button should now be visible");
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
let replyButtonPosition = { left: 0, top: 0 };

function showLoadingBox() {
  // Remove any existing boxes
  hideAllBoxes();

  // Determine if we're in improve mode
  const isImproveMode =
    replyButton && replyButton.dataset.improveMode === "true";
  const loadingMessage = isImproveMode
    ? "Improving your text..."
    : "Generating reply suggestions...";

  loadingBox = document.createElement("div");
  loadingBox.id = "humanreplies-loading-box";
  loadingBox.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <div style="width: 16px; height: 16px; border: 2px solid #f3f3f3; border-top: 2px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite;"></div>
      <span>${loadingMessage}</span>
    </div>
  `;
  loadingBox.style.cssText = `
    position: absolute;
    left: ${replyButtonPosition.left}px;
    top: ${replyButtonPosition.top + 40}px;
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

  // Add animation keyframes and CSS variables if not already added
  if (!document.querySelector("style[data-humanreplies-loading]")) {
    const style = document.createElement("style");
    style.setAttribute("data-humanreplies-loading", "true");
    style.textContent = `
      :root {
        --color-black: #000;
        --color-orange: #ff7900;
        --color-white: #fff;
        --border-radius: 8px;
      }
      
      .chunky-button-423412 {
        display: inline-block;
        border: 4px solid var(--color-black);
        background: var(--color-orange);
        color: var(--color-white);
        font-size: 1.15rem;
        font-weight: bold;
        padding: 0.75em 2.5em;
        border-radius: var(--border-radius);
        box-shadow: 6px 6px 0px var(--color-black);
        transition:
          transform 0.18s cubic-bezier(.4,2,.6,.8),
          box-shadow 0.18s cubic-bezier(.78,.17,.27,.89);
        cursor: pointer;
        outline: none;
        position: relative;
      }
      .chunky-button-423412:hover,
      .chunky-button-423412:focus-visible {
        transform: translate(3px, 3px);
        box-shadow: 0px 0px 0px var(--color-black);
      }
      
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
  debugLog("showSuccessBox called with:", {
    variations,
    remainingReplies,
    variationsLength: variations?.length,
  });

  // Check for null variations
  if (!variations) {
    debugLog("ERROR: variations is null/undefined!");
    showErrorBox("Failed to generate reply - no response received");
    return;
  }

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
      <span style="font-weight: 600; color: #000000;" id="humanreplies-header-text">Reply Suggestions</span>
      <button id="humanreplies-close-btn" style="background: none; margin: 0; padding: 0; border: none; font-size: 16px; cursor: pointer; color: #999;">×</button>
    </div>
    ${
      hasMultipleVariations
        ? `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding: 4px 8px; background: transparent; border-radius: 4px;">
        <button id="humanreplies-prev-btn" style="
          background: none;
          border: none;
          font-size: 16px;
          cursor: pointer;
          color: #666;
          padding: 4px;
          margin: 0;
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
          margin: 0;
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
      min-height: 120px;
      border: 1px solid #111;
      background: #fff !important;
      border-radius: 4px;
      padding: 8px;
      font-family: inherit;
      font-size: 13px;
      resize: vertical;
      margin-bottom: 8px;
      box-shadow: 2px 2px 1px 1px #000;
    ">${currentReply}</textarea>
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <span id="humanreplies-char-count" style="font-size: 11px; color: #666;">
        ${currentReply.length} characters${
    remainingReplies ? ` • ${remainingReplies} replies left` : ""
  }
      </span>
      <button id="humanreplies-copy-btn" class="chunky-button-423412" style="
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        padding: 6px 12px;
        margin: 0;
      ">
        Copy
      </button>
    </div>
  `;

  successBox.style.cssText = `
    position: absolute;
    left: ${replyButtonPosition.left}px;
    top: ${replyButtonPosition.top + 40}px;
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

  // Update header text based on improve mode
  const isImproveMode =
    replyButton && replyButton.dataset.improveMode === "true";
  const headerText = isImproveMode ? "Improved Text" : "Reply Suggestions";
  const headerElement = successBox.querySelector("#humanreplies-header-text");
  if (headerElement) {
    headerElement.textContent = headerText;
  }

  // Hide reply button when hovering over success box
  successBox.addEventListener("mouseenter", () => {
    hideReplyButton();
  });

  // Add event listeners
  const closeBtn = successBox.querySelector("#humanreplies-close-btn");
  const copyBtn = successBox.querySelector("#humanreplies-copy-btn");
  const textarea = successBox.querySelector("#humanreplies-reply-text");
  const prevBtn = successBox.querySelector("#humanreplies-prev-btn");
  const nextBtn = successBox.querySelector("#humanreplies-next-btn");
  const charCount = successBox.querySelector("#humanreplies-char-count");

  // Note: Removed textarea event listeners that were hiding the reply button
  // This allows the improve functionality to work properly with textareas

  closeBtn.addEventListener("click", () => {
    hideSuccessBox();
  });

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(textarea.value);
      copyBtn.innerHTML = "Copied!";
      setTimeout(() => {
        hideSuccessBox();
      }, 1000);
    } catch (err) {
      console.error("Failed to copy text:", err);
      copyBtn.innerHTML = "❌ Failed";
      setTimeout(() => {
        copyBtn.innerHTML = "Copy";
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
      <button id="humanreplies-error-close-btn" style="background: none; padding: 4px; margin: 0; border: none; font-size: 16px; cursor: pointer; color: #999;">×</button>
    </div>
    <p style="margin: 0; line-height: 1.4; color: #666;">
      ${errorMessage}
    </p>
  `;

  errorBox.style.cssText = `
    position: absolute;
    left: ${replyButtonPosition.left}px;
    top: ${replyButtonPosition.top + 40}px;
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

// Check if selection is inside an input field or contenteditable element
function isSelectionInEditableArea() {
  const selection = window.getSelection();
  if (!selection.rangeCount) return { inEditable: false, isTextarea: false };

  const range = selection.getRangeAt(0);
  let element = range.commonAncestorContainer;

  // If it's a text node, get the parent element
  if (element.nodeType === Node.TEXT_NODE) {
    element = element.parentElement;
  }

  // Check current element and up to 5 levels of parents (increased for X/Twitter's nested structure)
  for (let i = 0; i < 6 && element; i++) {
    debugLog(`Checking element level ${i}:`, {
      tagName: element.tagName,
      contentEditable: element.contentEditable,
      className: element.className,
      dataOffsetKey: element.getAttribute("data-offset-key"),
      nodeType: element.nodeType,
    });

    // Check if it's a textarea FIRST (highest priority)
    if (element.tagName === "TEXTAREA") {
      debugLog("✅ Found textarea:", element.tagName);
      return { inEditable: true, isTextarea: true };
    }

    // Check if it's an input field
    if (element.tagName === "INPUT") {
      debugLog("Found input field:", element.tagName);
      return { inEditable: true, isTextarea: false };
    }

    // Check if element or parent has contenteditable="true" (treat as textarea for improve functionality)
    if (
      element.contentEditable === "true" ||
      element.getAttribute("contenteditable") === "true"
    ) {
      debugLog(
        "✅ Found contenteditable element (treating as textarea):",
        element
      );
      return { inEditable: true, isTextarea: true };
    }

    // Enhanced X/Twitter detection - check for Draft.js editor structure
    if (
      element.getAttribute("data-offset-key") ||
      (element.className &&
        element.className.includes("public-DraftStyleDefault"))
    ) {
      debugLog("✅ Found X/Twitter Draft.js editor element:", element);
      return { inEditable: true, isTextarea: true };
    }

    // Additional X/Twitter patterns - check for common X editor containers
    if (
      element.className &&
      (element.className.includes("DraftEditor-") ||
        element.className.includes("notranslate") ||
        (element.getAttribute("role") === "textbox" &&
          element.getAttribute("aria-multiline") === "true"))
    ) {
      debugLog("✅ Found X/Twitter editor container:", element);
      return { inEditable: true, isTextarea: true };
    }

    // Move up to parent element
    element = element.parentElement;
  }

  return { inEditable: false, isTextarea: false };
}

async function handleReplyGeneration(tone) {
  debugLog("Starting reply generation for:", selectedText, "with tone:", tone);

  // Determine if we're in improve mode
  const isImproveMode =
    replyButton && replyButton.dataset.improveMode === "true";

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

    // Check if chrome.runtime is available and extension context is valid
    if (!isChromeApiAvailable()) {
      hideLoadingBox();
      showErrorBox(
        "Extension is not properly loaded. Please refresh the page and try again."
      );
      return;
    }

    // Send message to background script for API call with timeout
    const response = await Promise.race([
      new Promise((resolve, reject) => {
        try {
          // Double-check extension context before sending message
          if (!isExtensionContextValid()) {
            reject(new Error("Extension context invalidated"));
            return;
          }

          chrome.runtime.sendMessage(
            {
              action: "generateReply",
              context: selectedText,
              options: {
                platform: platform,
                tone: tone || "helpful",
                userWritingStyle: useOwnVoice ? userWritingStyle : null,
                isImproveMode: isImproveMode,
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
      }),
    ]);

    hideLoadingBox();
    debugLog("Background script response:", response);

    if (response && response.success) {
      // Enforce character limit based on platform
      const maxLength = platform === "x" ? 280 : 500;

      if (response?.isRateLimitReached) {
        showErrorBox(
          "Too many requests in a short time, please try again later."
        );
      }

      // Handle variations or single reply
      let variations = response.variations;
      debugLog(
        "Raw variations from response:",
        variations,
        "reply:",
        response.reply
      );

      // Validate that variations are strings, not JSON objects
      const isValidVariation = (v) => {
        if (typeof v !== "string") return false;
        try {
          // Check if it's a JSON object string
          const parsed = JSON.parse(v);
          return typeof parsed === "string"; // Only allow if it parses to a string
        } catch {
          return true; // Not JSON, so it's a regular string
        }
      };

      if (
        !variations ||
        !Array.isArray(variations) ||
        !variations.every(isValidVariation)
      ) {
        // Fallback to single reply, but validate it too
        const validReply = isValidVariation(response.reply)
          ? response.reply
          : "I'd be happy to help with that.";
        variations = [validReply];
        debugLog("Using fallback single reply:", variations);
      }

      // Enforce character limits on all variations
      const processedVariations = variations.map((reply) =>
        enforceCharacterLimit(reply, maxLength)
      );

      debugLog(
        `Generated ${processedVariations.length} variations:`,
        processedVariations
      );
      showSuccessBox(processedVariations, response.remainingReplies);
    } else {
      const errorMessage = response?.error || "Unknown error occurred";
      debugLog("Reply generation failed - response not successful:", {
        response,
        errorMessage,
      });
      console.error("Reply generation failed:", errorMessage);

      // Trigger connectivity check when reply generation fails
      if (typeof window.checkConnectivity === "function") {
        // console.log("Reply failed, checking API connectivity...");
        window
          .checkConnectivity()
          .then((result) => {
            if (!result.isOnline) {
              // console.log("API confirmed offline, starting polling");
              updateApiStatus(false, "reply-failure-check");
              startOfflineStatusPolling();
            }
          })
          .catch((error) => {
            console.error("Connectivity check failed:", error);
            updateApiStatus(false, "reply-failure-error");
            startOfflineStatusPolling();
          });
      } else {
        // Fallback: Mark API as offline in storage for robust status propagation
        // console.log("Reply generation failed, marking API as offline");
        await updateApiStatus(false, "reply-generation-failure");
        startOfflineStatusPolling();
      }

      showErrorBox(errorMessage);
    }
  } catch (error) {
    console.error("Reply generation failed:", error);
    hideLoadingBox();

    // Handle timeout specifically
    if (error.message && error.message.includes("timed out")) {
      // console.log("Reply generation timed out, checking API connectivity...");

      // Trigger connectivity check when timeout occurs
      if (typeof window.checkConnectivity === "function") {
        window
          .checkConnectivity()
          .then((result) => {
            if (!result.isOnline) {
              // console.log("API confirmed offline after timeout");
              updateApiStatus(false, "timeout-check");
              startOfflineStatusPolling();
            }
          })
          .catch((connectivityError) => {
            console.error("Connectivity check failed:", connectivityError);
            updateApiStatus(false, "timeout-error");
            startOfflineStatusPolling();
          });
      } else {
        // Fallback: Mark API as offline in storage
        // console.log("Reply generation timed out, marking API as offline");
        await updateApiStatus(false, "reply-timeout");
        startOfflineStatusPolling();
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

  debugLog("handleSelection triggered");
  const selection = window.getSelection();

  debugLog("Selection details:", {
    rangeCount: selection.rangeCount,
    text: selection.toString(),
    textLength: selection.toString().trim().length,
  });

  if (selection.rangeCount > 0 && selection.toString().trim().length > 0) {
    selectedText = selection.toString().trim();

    // Check if selection is inside an editable area
    const editableInfo = isSelectionInEditableArea();

    if (editableInfo.inEditable) {
      if (editableInfo.isTextarea && improveTextEnabled) {
        debugLog("Selection is in textarea, showing improve button");
        showReplyButton(selection, true); // true = improve mode
      } else if (editableInfo.isTextarea && !improveTextEnabled) {
        debugLog(
          "Selection is in textarea, but improve text feature is disabled, hiding button"
        );
        hideReplyButton();
      } else {
        debugLog(
          "Selection is in input/contenteditable (not textarea), hiding reply button"
        );
        hideReplyButton();
      }
      return;
    }

    debugLog("Text selected, showing generate button for:", selectedText);
    showReplyButton(selection, false); // false = generate mode
  } else {
    debugLog("No text selected, hiding button");
    hideReplyButton();
  }
}

// Listen for storage changes to reload tones and settings when updated
if (isChromeApiAvailable()) {
  try {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      // Check if context is still valid before processing changes
      if (!isExtensionContextValid()) {
        console.warn(
          "Extension context invalidated during storage change event"
        );
        isExtensionContextInvalidated = true;
        shutdownGracefully();
        return;
      }

      if (namespace === "local" && changes.humanreplies_tones_cache) {
        // console.log("Tones cache updated, reloading tones");
        loadTonesFromStorage();
      }

      if (namespace === "local" && changes.humanreplies_api_status) {
        // Ignore storage changes we caused ourselves to prevent feedback loops
        if (isUpdatingApiStatus) {
          // console.log("[Context] Ignoring API status change (self-update)");
          return;
        }

        const newStatus = changes.humanreplies_api_status.newValue;
        const oldStatus = changes.humanreplies_api_status.oldValue;

        // console.log("[Context] *** API STATUS CHANGED IN STORAGE ***");
        // console.log(`[Context] Old status: ${oldStatus?.isOnline ? "online" : "offline"} (source: ${oldStatus?.source || "unknown"})`);
        // console.log(`[Context] New status: ${newStatus?.isOnline ? "online" : "offline"} (source: ${newStatus?.source || "unknown"})`);
        // console.log(`[Context] New status object:`, newStatus);

        // Update local state immediately
        if (newStatus && newStatus.isOnline !== isApiOnline) {
          const wasOnline = isApiOnline;
          isApiOnline = !!newStatus.isOnline;

          // console.log(`[Context] *** UPDATING LOCAL STATE: ${wasOnline ? "online" : "offline"} → ${isApiOnline ? "online" : "offline"} ***`);

          // Update UI visibility based on new status
          if (!shouldBeActive()) {
            // console.log("[Context] API went offline, hiding reply button and stopping features");
            hideReplyButton();
            if (toneMenu) {
              toneMenu.remove();
              toneMenu = null;
            }
            if (!wasOnline) {
              // If was already offline, start polling for reconnection
              startOfflineStatusPolling();
            }
          } else if (isApiOnline && !wasOnline) {
            // console.log("[Context] API came back online, re-enabling features");
            // Stop offline polling if it was running
            if (offlineStatusInterval) {
              clearInterval(offlineStatusInterval);
              offlineStatusInterval = null;
            }
            // Re-initialize to enable features
            initialize();
          }
        }
      }

      if (
        namespace === "sync" &&
        (changes.siteSpecificMode ||
          changes.extensionMode ||
          changes.allowedSites)
      ) {
        // console.log("Site settings changed, reloading");
        loadSiteSettings().then(() => {
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
        // console.log("Default tone setting changed, reloading");
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

      if (
        namespace === "sync" &&
        (changes.useOwnVoice ||
          changes.writingStyle ||
          changes.guardianText ||
          changes.improveTextEnabled)
      ) {
        // console.log("User voice settings changed, reloading");
        loadUserVoiceSettings();
      }
    });
  } catch (error) {
    console.warn("Failed to set up storage change listener:", error);
  }
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
      // console.log("Context.js: API reconnected, re-enabling features");
      clearInterval(offlineStatusInterval);
      offlineStatusInterval = null;
      initialize();
    }
    lastApiOnline = isApiOnline;
  }, 5000);
}

// console.log("Adding event listeners");
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
