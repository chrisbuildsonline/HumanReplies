// Popup script for HumanReplies extension
import HumanRepliesAPI from "./core/api-service.js";
import SupabaseClient from "./supabase-client.js";
import AuthManager from "./auth-manager.js";

class PopupManager {
  constructor() {
    this.isLoggedIn = false;
    this.currentUser = null;
    this.currentTone = "ask";
    this.api = null;
    this.isApiOnline = false;
    this.apiStatusChecked = false;
    this.isOnSupportedSite = null;
    this.useIntegrations = true;
    this.enableSelectReply = true;
    this.enableEverywhere = false;
    this.offlineRetryInterval = null;

    this.initializeAsync();
  }

  async initializeAsync() {
    try {
      await this.loadApiStatus();
      await this.initializeApi();
      this.initializeOtherComponents();
    } catch (error) {
      console.error("Initialization error:", error);
      this.initializeApi();
      this.initializeOtherComponents();
    }
  }

  async initializeApi() {
    try {
      const envConfig = window.EnvironmentConfig;

      if (envConfig) {
        await envConfig.loadEnvironment();
        this.api = new HumanRepliesAPI(envConfig);
      } else {
        this.api = new HumanRepliesAPI();
      }

      this.preloadTones();
      this.startApiStatusChecking();
      this.setupStorageListener();
    } catch (e) {
      console.error("API initialization error:", e.message);
      this.isApiOnline = false;
      this.apiStatusChecked = true;
      this.updateExtensionStatus();
    }
  }

  startApiStatusChecking() {
    setInterval(() => {
      this.checkApiStatus();
    }, 30000);
  }

  setupStorageListener() {
    if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === "local" && changes.humanreplies_api_status) {
          const newStatus = changes.humanreplies_api_status.newValue;

          if (newStatus && newStatus.isOnline !== this.isApiOnline) {
            this.isApiOnline = newStatus.isOnline;
            this.apiStatusChecked = true;
            this.updateExtensionStatus();

            if (newStatus.isOnline) {
              this.showSuccess("API connection restored!");
            }
          }
        }
      });
    }
  }

  async checkApiStatus(isManualRefresh = false) {
    if (!this.api) {
      this.isApiOnline = false;
      this.apiStatusChecked = true;
      this.saveApiStatus();
      this.updateExtensionStatus();
      return;
    }

    const wasOnline = this.isApiOnline;

    try {
      if (typeof this.api.checkConnectivity === "function") {
        const result = await this.api.checkConnectivity();
        this.isApiOnline = result.isOnline;

        if (this.isApiOnline && (!wasOnline || isManualRefresh)) {
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
        const result = await window.checkConnectivity();
        this.isApiOnline = result.isOnline;

        if (this.isApiOnline && (!wasOnline || isManualRefresh)) {
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
        const tones = await this.api.getTones({
          timeoutMs: isManualRefresh ? 5000 : 3000,
          reason: isManualRefresh ? "manual-refresh" : "status-check",
        });

        this.isApiOnline = tones && tones.length > 0;

        if (!wasOnline && this.isApiOnline) {
          this.allTones = tones;
          await this.loadTones();
          if (this.isLoggedIn) {
            this.loadCustomTones();
          }
        }
      }
    } catch (err) {
      this.isApiOnline = false;
    }

    this.apiStatusChecked = true;
    this.saveApiStatus();
    this.updateExtensionStatus();
  }

  saveApiStatus() {
    if (typeof chrome !== "undefined" && chrome.storage) {
      try {
        const statusUpdate = {
          isOnline: !!this.isApiOnline,
          lastChecked: Date.now(),
          source: "popup",
          checkedAt: new Date().toISOString(),
        };

        chrome.storage.local.set({ humanreplies_api_status: statusUpdate });
      } catch (e) {
        console.error("Failed to save API status:", e.message);
      }
    }
  }

  async loadApiStatus() {
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
        const age = Date.now() - (status.lastChecked || 0);
        const isRecent = age < 30000;

        this.isApiOnline = !!status.isOnline;
        this.apiStatusChecked = true;
        this.updateExtensionStatus();

        if (!isRecent) {
          this.requestBackgroundRefresh();
        }
      } else {
        this.isApiOnline = false;
        this.apiStatusChecked = true;
        this.saveApiStatus();
        this.updateExtensionStatus();
      }
    } catch (err) {
      this.isApiOnline = false;
      this.apiStatusChecked = true;
      this.saveApiStatus();
      this.updateExtensionStatus();
    }
  }

  requestBackgroundRefresh() {
    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      try {
        chrome.runtime.sendMessage({ action: "refreshConnectivity" });
      } catch (e) {
        console.error("Failed to request background refresh:", e.message);
      }
    }
  }

  async preloadTones() {
    try {
      if (!this.api) {
        this.isApiOnline = false;
        this.apiStatusChecked = true;
        this.saveApiStatus();
        this.updateExtensionStatus();
        return;
      }

      const cachedTones = await this.getCachedTones();
      if (cachedTones && !this.shouldRefreshTones(cachedTones)) {
        this.allTones = cachedTones.tones;
        return;
      }

      const tones = await this.api.getTones({
        timeoutMs: 2000,
        reason: "early-preload",
      });
      this.allTones = tones;

      await this.cacheTones(tones);

      if (!this.apiStatusChecked || tones.length > 0) {
        this.isApiOnline = true;
        this.apiStatusChecked = true;
        this.saveApiStatus();
        this.updateExtensionStatus();
      }
    } catch (err) {
      const cachedTones = await this.getCachedTones();
      if (cachedTones) {
        this.allTones = cachedTones.tones;
      }

      if (!this.apiStatusChecked || !this.isApiOnline) {
        this.isApiOnline = false;
        this.apiStatusChecked = true;
        this.saveApiStatus();
        this.updateExtensionStatus();
      }
    }
  }

  async getCachedTones() {
    try {
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(["humanreplies_tones_cache"], resolve);
      });
      return result.humanreplies_tones_cache || null;
    } catch (err) {
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
    } catch (err) {
      console.error("Error caching tones:", err.message);
    }
  }

  shouldRefreshTones(cachedData) {
    if (!cachedData) return true;

    const now = Date.now();
    const cacheAge = now - cachedData.cachedAt;
    const twentyFourHours = 24 * 60 * 60 * 1000;

    if (this.isLoggedIn) {
      return true;
    }

    if (cacheAge > twentyFourHours) {
      return true;
    }

    if (cachedData.isLoggedIn !== this.isLoggedIn) {
      return true;
    }

    return false;
  }

  initializeOtherComponents() {
    try {
      this.supabase = new SupabaseClient();
    } catch (e) {
      console.error("SupabaseClient error:", e.message);
    }

    try {
      this.authManager = new AuthManager();
    } catch (e) {
      console.error("AuthManager error:", e.message);
    }

    this.init();
  }

  async init() {
    await this.checkUserStateAuth();

    if (!this.isLoggedIn) {
      try {
        await this.authManager.checkAuthStatus();
        const authState = this.authManager.getAuthState();
        this.isLoggedIn = authState.isLoggedIn;
        this.currentUser = authState.currentUser;
      } catch (e) {
        console.error("Auth check failed:", e);
      }
    }

    this.checkCurrentSite();

    try {
      await this.loadTones();
    } catch (error) {
      console.error("Load tones failed:", error);
    }

    this.updateUIState();
    this.loadToneSetting();
    this.setupEventListeners();
    this.showPopupContent();

    this.authManager.startPeriodicCheck((isLoggedIn, currentUser) => {
      this.isLoggedIn = isLoggedIn;
      this.currentUser = currentUser;
      this.updateUIState();

      if (isLoggedIn) {
        this.loadTones();
        this.loadCustomTones();
        this.showSuccess("Successfully logged in!");
      }
    });

    window.addEventListener("beforeunload", () => {
      this.cleanup();
    });
  }

  async checkUserStateAuth() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["userState"], async (result) => {
        const userState = result.userState;
        if (!userState || !userState.access_token) {
          return resolve(false);
        }

        if (userState.expires_in && userState.storedAt) {
          const expiryTime = userState.storedAt + userState.expires_in * 1000;
          if (Date.now() >= expiryTime) {
            chrome.storage.local.remove(["userState"]);
            return resolve(false);
          }
        }

        try {
          const userInfo = await this.supabase.getUserInfo(
            userState.access_token
          );
          if (userInfo && userInfo.email) {
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
          chrome.storage.local.remove(["userState"]);
          resolve(false);
        }
      });
    });
  }

  cleanup() {
    if (this.authManager) {
      this.authManager.stopPeriodicCheck();
    }
    if (this._bgDiagInterval) {
      clearInterval(this._bgDiagInterval);
      this._bgDiagInterval = null;
    }
  }

  async checkAuthStatus() {
    try {
      const wasLoggedIn = this.isLoggedIn;
      await this.authManager.checkAuthStatus();
      const authState = this.authManager.getAuthState();
      this.isLoggedIn = authState.isLoggedIn;
      this.currentUser = authState.currentUser;

      if (wasLoggedIn !== this.isLoggedIn) {
        this.updateUIState();
      }
    } catch (e) {
      console.error("Auth check failed:", e);
    }
  }

  checkCurrentSite() {
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
    const statusTextElements = document.querySelectorAll(".status-text");
    const statusIndicators = document.querySelectorAll(".status-indicator");
    const statusContainers = document.querySelectorAll(".extensionStatus");

    const apiOfflineMessage = document.getElementById("api-offline-message");
    const loggedOutState = document.getElementById("loggedOutState");
    const loggedInState = document.getElementById("loggedInState");

    if (
      !statusTextElements.length ||
      !statusIndicators.length ||
      !statusContainers.length
    ) {
      return;
    }

    let statusText = "";
    let isActive = false;

    if (this.apiStatusChecked && !this.isApiOnline) {
      statusText = "HumanReplies API is offline";
      isActive = false;

      if (apiOfflineMessage) {
        apiOfflineMessage.classList.remove("hidden");
      }

      if (loggedOutState) {
        loggedOutState.classList.add("hidden");
      }
      if (loggedInState) {
        loggedInState.classList.add("hidden");
      }

      this.startOfflineAutoRetry();
    } else {
      if (apiOfflineMessage) {
        apiOfflineMessage.classList.add("hidden");
      }
      if (loggedOutState && !this.isLoggedIn) {
        loggedOutState.classList.remove("hidden");
      }
      if (loggedInState && this.isLoggedIn) {
        loggedInState.classList.remove("hidden");
      }

      this.stopOfflineAutoRetry();
    }

    statusTextElements.forEach((statusElement) => {
      statusElement.innerHTML = "";

      const textSpan = document.createElement("span");
      textSpan.textContent = statusText;
      statusElement.appendChild(textSpan);

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

        refreshButton.addEventListener("mouseenter", () => {
          refreshButton.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
        });
        refreshButton.addEventListener("mouseleave", () => {
          refreshButton.style.backgroundColor = "transparent";
        });

        refreshButton.addEventListener("click", async (e) => {
          e.stopPropagation();

          refreshButton.innerHTML = "⏳";
          refreshButton.disabled = true;

          try {
            await this.checkApiStatus(true);

            if (this.isApiOnline) {
              this.showSuccess("API connection restored!");
            } else {
              this.showError("API still offline. Please try again later.");
            }
          } catch (error) {
            this.showError("Failed to check API status");
          } finally {
            setTimeout(() => {
              refreshButton.innerHTML = "🔄";
              refreshButton.disabled = false;
            }, 1000);
          }
        });

        statusElement.appendChild(refreshButton);
      }
    });

    statusContainers.forEach((container) => {
      container.style.display = "none";
    });

    const elements = [statusContainers, statusTextElements, statusIndicators];
    const className = isActive ? "logged-in" : "logged-out";
    const removeClass = isActive ? "logged-out" : "logged-in";

    elements.forEach((elementList) => {
      elementList.forEach((element) => {
        element.classList.remove(removeClass);
        element.classList.add(className);
      });
    });
  }

  saveToneSetting(tone) {
    this.currentTone = tone;
    chrome.storage.sync.set({ defaultTone: tone });
  }

  startOfflineAutoRetry() {
    if (this.offlineRetryInterval) {
      return;
    }

    let retryCount = 0;

    this.offlineRetryInterval = setInterval(async () => {
      if (!this.isApiOnline) {
        retryCount++;

        this.updateRetryStatus(
          `Checking connection... (attempt #${retryCount})`
        );

        await this.checkApiStatus(false);

        if (this.isApiOnline) {
          this.showSuccess("Connection restored!");
          this.stopOfflineAutoRetry();
        } else {
          this.updateRetryStatus("Automatically retrying every 10 seconds...");
        }
      } else {
        this.stopOfflineAutoRetry();
      }
    }, 10000);
  }

  stopOfflineAutoRetry() {
    if (this.offlineRetryInterval) {
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
    const toneSelectLoggedOut = document.getElementById(
      "replyToneSelectLoggedOut"
    );
    const toneSelectLoggedIn = document.getElementById("replyToneSelect");

    if (!toneSelectLoggedOut && !toneSelectLoggedIn) {
      return;
    }

    try {
      let tones;

      if (this.allTones && this.allTones.length > 0) {
        tones = this.allTones;
      } else {
        const cachedTones = await this.getCachedTones();
        if (cachedTones && !this.shouldRefreshTones(cachedTones)) {
          tones = cachedTones.tones;
          this.allTones = tones;
        } else {
          tones = await this.api.getTones();
          this.allTones = tones;
          await this.cacheTones(tones);
        }
      }

      [toneSelectLoggedOut, toneSelectLoggedIn].forEach((toneSelect) => {
        if (toneSelect) {
          toneSelect.innerHTML = '<option value="ask">Always ask me</option>';

          const presetTones = tones.filter(
            (tone) =>
              tone.is_preset === true ||
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
          const customTones = tones.filter(
            (tone) =>
              tone.is_preset === false ||
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

          if (this.isLoggedIn && toneSelect.id === "replyToneSelect") {
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
          } else if (toneSelect.id === "replyToneSelectLoggedOut") {
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
        }
      });
    } catch (error) {
      console.error("Failed to load tones:", error);
    }
  }

  async loadCustomTones() {
    if (!this.isLoggedIn || !this.allTones) return;

    const customTonesList = document.getElementById("customTonesList");
    if (!customTonesList) return;

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

        // Capture the initial value (only first time)
        if (typeof this.enableEverywhereInitial === "undefined") {
          this.enableEverywhereInitial = this.enableEverywhere;
        }

        const loggedOutSelect = document.getElementById(
          "replyToneSelectLoggedOut"
        );
        const loggedInSelect = document.getElementById("replyToneSelect");
        if (loggedOutSelect) loggedOutSelect.value = this.currentTone;
        if (loggedInSelect) loggedInSelect.value = this.currentTone;

        document.querySelectorAll(".use-integrations-toggle").forEach((el) => {
          el.checked = this.useIntegrations;
        });
        document.querySelectorAll(".use-integrations-status").forEach((el) => {
          el.textContent = this.useIntegrations ? "On" : "Off";
        });

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

        document.querySelectorAll(".enable-everywhere-toggle").forEach((el) => {
          el.checked = this.enableEverywhere;
        });
        document.querySelectorAll(".enable-everywhere-status").forEach((el) => {
          el.textContent = this.enableEverywhere ? "On" : "Off";
        });

        // Ensure labels reflect correct suffix state on load
        this.updateEnableEverywhereReloadNeeded(this.enableEverywhere);
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
    this.updateEnableEverywhereReloadNeeded(enabled);
  }

  setupEventListeners() {
    const loginButton = document.getElementById("loginButton");
    if (loginButton) {
      loginButton.addEventListener("click", () => this.handleLogin());
    }

    const signupButton = document.getElementById("signupButton");
    if (signupButton) {
      signupButton.addEventListener("click", () => this.handleSignup());
    }

    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (
        namespace === "sync" &&
        (changes.userToken || changes.userProfile || changes.isAuthenticated)
      ) {
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

    this._bgDiagInterval = setInterval(() => {
      try {
        chrome.runtime.sendMessage({ action: "getAuthState" }, (resp) => {
          if (resp && resp.auth) {
            const bgTokenPresent = !!resp.auth.userToken;
            if (bgTokenPresent && !this.isLoggedIn) {
              this.checkAuthStatus();
            }
          }
        });
      } catch (e) {
        // Ignore errors
      }
    }, 5000);

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

    const dashboardButton = document.getElementById("dashboardButton");
    if (dashboardButton) {
      dashboardButton.addEventListener("click", () => this.openDashboard());
    }

    const logoutButton = document.getElementById("logoutButton");
    if (logoutButton) {
      logoutButton.addEventListener("click", () => this.handleLogout());
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
      const loginBtn = document.getElementById("loginButton");
      if (loginBtn) {
        loginBtn.dataset.originalText = loginBtn.innerHTML;
        loginBtn.innerHTML = "🔄 Opening login...";
        loginBtn.disabled = true;
      }

      const authResult = await this.supabase.authenticateWithPopup("signin");
      await this.handleAuthResult(authResult, "Login successful!");
    } catch (error) {
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
    }
  }

  async handleSignup() {
    try {
      const signupBtn = document.querySelector(
        '.login-button[onclick="handleSignup()"]'
      );
      const originalText = signupBtn.innerHTML;
      signupBtn.innerHTML = "🔄 Opening signup...";
      signupBtn.disabled = true;

      const authResult = await this.supabase.authenticateWithPopup("signup");
      await this.handleAuthResult(authResult, "Account created successfully!");
    } catch (error) {
      if (error.message === "Authentication cancelled by user") {
        this.showError("Signup cancelled");
      } else {
        this.showError("Signup failed. Please try again.");
      }
    } finally {
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
      const result = await new Promise((resolve) => {
        chrome.storage.sync.get(["userToken"], resolve);
      });

      if (result.userToken) {
        try {
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
      const userInfo = await this.supabase.getUserInfo(authResult.access_token);

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

      const stored = await this.authManager.storeAuthData(authDataWithProfile);

      if (stored) {
        this.isLoggedIn = true;
        this.currentUser = authDataWithProfile.userProfile;

        this.updateUIState();
        this.showSuccess(successMessage);

        await this.loadTones();
        this.loadCustomTones();
      } else {
        this.showError(
          "Login successful but failed to save session. Please try again."
        );
      }
    }
  }

  async clearAuthData() {
    await this.authManager.clearAuthData();

    this.isLoggedIn = false;
    this.currentUser = null;

    this.updateUIState();
  }

  openDashboard() {
    const dashboardUrl = window.EnvironmentConfig
      ? window.EnvironmentConfig.getConfig().dashboardURL
      : "https://humanreplies.com/dashboard";

    chrome.tabs.create({ url: dashboardUrl });
  }

  updateUIState() {
    const loggedOutState = document.getElementById("loggedOutState");
    const loggedInState = document.getElementById("loggedInState");
    const apiOfflineMessage = document.getElementById("api-offline-message");

    if (this.apiStatusChecked && !this.isApiOnline) {
      return;
    }

    if (this.isLoggedIn && this.currentUser) {
      if (loggedOutState) loggedOutState.classList.add("hidden");
      if (loggedInState) {
        loggedInState.classList.remove("hidden");

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

        this.loadCustomTones();
      }
    } else {
      if (loggedInState) loggedInState.classList.add("hidden");
      if (loggedOutState) {
        loggedOutState.classList.remove("hidden");

        const loginButton = document.getElementById("loginButton");
        if (loginButton) {
          loginButton.textContent = "🚀 Login to HumanReplies";
          loginButton.style.background = "#2c3e50";
        }

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
    }
  }

  updateEnableEverywhereReloadNeeded(currentValue) {
    const changed = currentValue !== this.enableEverywhereInitial;
    document.querySelectorAll(".enable-everywhere-toggle").forEach((toggle) => {
      const setting = toggle.closest(".setting");
      if (!setting) return;
      const labelEl = setting.querySelector(".setting-label");
      if (!labelEl) return;
      labelEl.textContent =
        "Enable everywhere" + (changed ? " (Reload needed)" : "");
    });
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

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", function () {
  try {
    window.popupManager = new PopupManager();
  } catch (e) {
    console.error("Failed to create PopupManager:", e);
  }
});

// Cleanup when popup is closed
window.addEventListener("beforeunload", function () {
  if (window.popupManager) {
    window.popupManager.stopOfflineAutoRetry();
  }
});
