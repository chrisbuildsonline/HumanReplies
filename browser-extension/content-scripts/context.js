let replyButton = null;
let selectedText = "";
let toneMenu = null;
let availableTones = [];
let enableEverywhere = false;
let isApiOnline = false;
let defaultTone = "ask";

console.log("HumanReplies context.js loaded");

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
    const result = await new Promise((resolve) => {
      chrome.storage.local.get(["humanreplies_tones_cache"], resolve);
    });

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
    const result = await new Promise((resolve) => {
      chrome.storage.sync.get(["enableEverywhere"], resolve);
    });
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
    const result = await new Promise((resolve) => {
      chrome.storage.sync.get(["defaultTone"], resolve);
    });
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
    const result = await new Promise((resolve) => {
      chrome.storage.local.get(["humanreplies_api_status"], resolve);
    });

    if (result.humanreplies_api_status) {
      const status = result.humanreplies_api_status;
      const isRecent = Date.now() - status.lastChecked < 60000; // 1 minute

      if (isRecent) {
        isApiOnline = status.isOnline;
        console.log("Loaded API status:", isApiOnline ? "online" : "offline");
      } else {
        console.log("API status cache expired, assuming offline");
        isApiOnline = false;
      }
    } else {
      console.log("No API status found, assuming offline");
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
    return;
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
    border: 2px solid #000;
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
  const style = document.createElement('style');
  style.textContent = `
    #humanreplies-reply-button.show-arrow::after {
      content: "▼";
      font-size: 8px;
      margin-left: 4px;
      opacity: 0.8;
    }
  `;
  if (!document.querySelector('style[data-humanreplies-arrow]')) {
    style.setAttribute('data-humanreplies-arrow', 'true');
    document.head.appendChild(style);
  }
  
  // Set arrow visibility based on default tone
  if (defaultTone === "ask") {
    button.classList.add('show-arrow');
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

function handleReplyGeneration(tone) {
  console.log("Generate reply for:", selectedText, "with tone:", tone);

  chrome.runtime.sendMessage({
    action: "generateReply",
    text: selectedText,
    tone: tone,
  });

  hideReplyButton();
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
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local" && changes.humanreplies_tones_cache) {
    console.log("Tones cache updated, reloading tones");
    loadTonesFromStorage();
  }

  if (namespace === "local" && changes.humanreplies_api_status) {
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
          replyButton.classList.add('show-arrow');
        } else {
          replyButton.classList.remove('show-arrow');
        }
      }
    });
  }
});

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
