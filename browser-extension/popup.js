// Popup script for HumanReplies extension
console.log("[Popup] script file loaded");
function appendDebug(message) {
  try {
    const box = document.getElementById("debugArea");
    if (!box) return;
    box.style.display = "block";
    const ts = new Date().toLocaleTimeString();
    box.textContent += `[${ts}] ${message}\n`;
  } catch (e) {}
}
class PopupManager {
  constructor() {
    this.isLoggedIn = false;
    this.currentUser = null;
    this.currentTone = "ask";
    this.api = new HumanRepliesAPI();
    this.supabase = new SupabaseClient();
    this.authManager = new AuthManager();

    this.init();
  }

  async init() {
    console.log("[Popup] init start");

    // First check for userState (new auth flow) - this takes priority
    await this.checkUserStateAuth();

    // Fallback to robust auth manager if no userState found
    if (!this.isLoggedIn) {
      let isAuthenticated = false;
      try {
        isAuthenticated = await this.authManager.checkAuthStatus();
      } catch (e) {
        console.error("[Popup] authManager.checkAuthStatus threw", e);
      }
      const authState = this.authManager.getAuthState();
      this.isLoggedIn = authState.isLoggedIn;
      this.currentUser = authState.currentUser;
    }

    console.log(
      "Auth check completed - isLoggedIn:",
      this.isLoggedIn,
      "currentUser:",
      this.currentUser
    ); // Debug logging

    this.checkCurrentSite();
    await this.loadTones();
    this.updateUIState();
    this.loadToneSetting();
    this.setupEventListeners();

    // Set up periodic auth check using the auth manager
    this.authManager.startPeriodicCheck((isLoggedIn, currentUser) => {
      console.log("Auth state changed:", isLoggedIn, currentUser);
      this.isLoggedIn = isLoggedIn;
      this.currentUser = currentUser;
      this.updateUIState();

      if (isLoggedIn) {
        this.loadTones();
        this.loadCustomTones();
        this.showSuccess("Successfully logged in!");
      }
    });

    console.log("[Popup] init complete");

    // Clean up when popup is closed
    window.addEventListener("beforeunload", () => {
      this.cleanup();
    });
  }

  // Check userState (new auth flow) and validate tokens directly with Supabase
  async checkUserStateAuth() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['userState'], async (result) => {
        const userState = result.userState;
        if (!userState || !userState.access_token) {
          console.log("[Popup] No userState found");
          return resolve(false);
        }

        console.log("[Popup] Found userState, validating token...");
        
        // Check if token is expired (basic check)
        if (userState.expires_in && userState.storedAt) {
          const expiryTime = userState.storedAt + (userState.expires_in * 1000);
          if (Date.now() >= expiryTime) {
            console.log("[Popup] Token expired, clearing userState");
            chrome.storage.local.remove(['userState']);
            return resolve(false);
          }
        }

        // Validate token directly with Supabase (bypass our backend)
        try {
          const userInfo = await this.supabase.getUserInfo(userState.access_token);
          if (userInfo && userInfo.email) {
            console.log("[Popup] Token valid, setting logged in state");
            
            // Update state from validated userInfo
            this.isLoggedIn = true;
            this.currentUser = {
              id: userInfo.id,
              email: userInfo.email,
              full_name: userInfo.user_metadata?.full_name || userInfo.email.split("@")[0],
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
          console.log("[Popup] Token validation failed:", error.message);
          // Clear invalid userState
          chrome.storage.local.remove(['userState']);
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
    console.log("Manual auth refresh triggered using AuthManager");

    // Use auth manager to check status
    const isAuthenticated = await this.authManager.checkAuthStatus();
    const authState = this.authManager.getAuthState();

    console.log("AuthManager check result:", isAuthenticated, authState);

    // Update local state
    this.isLoggedIn = authState.isLoggedIn;
    this.currentUser = authState.currentUser;

    this.updateUIState();

    chrome.storage.local.get(null, (all) => {
      const userState = all.userState;
      console.log(
        "[Debug refresh] chrome.storage.local keys:",
        Object.keys(all)
      );
      if (userState) {
        console.log("[Debug refresh] userState:", userState);
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
            console.log("[Debug] userState was valid, updating UI");
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
      console.log(
        "Popup.checkAuthStatus via AuthManager =>",
        this.isLoggedIn,
        this.currentUser
      );
      if (wasLoggedIn !== this.isLoggedIn) {
        this.updateUIState();
      }
    } catch (e) {
      console.error("Delegated auth check failed", e);
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

        const statusElement = document.getElementById("statusText");
        const statusIndicator = document.getElementById("statusIndicator");
        const statusContainer = document.getElementById("extensionStatus");

        const isSupported = supportedSites.some((site) =>
          hostname.includes(site)
        );

        if (isSupported) {
          // Update status indicators to show active
          statusElement.textContent = "Extension Active";
          statusContainer.classList.remove("logged-out");
          statusContainer.classList.add("logged-in");
          statusElement.classList.remove("logged-out");
          statusElement.classList.add("logged-in");
          statusIndicator.classList.remove("logged-out");
          statusIndicator.classList.add("logged-in");
        } else {
          // Update status indicators to show disabled
          statusElement.textContent = "Extension is disabled";
          statusContainer.classList.remove("logged-in");
          statusContainer.classList.add("logged-out");
          statusElement.classList.remove("logged-in");
          statusElement.classList.add("logged-out");
          statusIndicator.classList.remove("logged-in");
          statusIndicator.classList.add("logged-out");
        }
      }
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
      console.log("Storage changed:", changes, namespace); // Debug logging
      if (
        namespace === "sync" &&
        (changes.userToken || changes.userProfile || changes.isAuthenticated)
      ) {
        console.log(
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
              console.warn(
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

    // Add custom tone button
    const addToneButton = document.getElementById("addToneButton");
    if (addToneButton) {
      addToneButton.addEventListener("click", () => this.showAddToneForm());
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
  }

  async handleLogin() {
    try {
      console.log("[Popup] handleLogin start");
      const loginBtn = document.getElementById("loginButton");
      if (loginBtn) {
        loginBtn.dataset.originalText = loginBtn.innerHTML;
        loginBtn.innerHTML = "🔄 Opening login...";
        loginBtn.disabled = true;
      } else {
        console.warn("[Popup] loginButton not found in DOM");
      }

      // Use Supabase Auth popup (wrap to capture early failures)
      let authResult;
      try {
        authResult = await this.supabase.authenticateWithPopup("signin");
        console.log("[Popup] authenticateWithPopup resolved");
      } catch (innerErr) {
        console.error("[Popup] authenticateWithPopup error:", innerErr);
        throw innerErr;
      }

      // Handle successful authentication
      await this.handleAuthResult(authResult, "Login successful!");
      console.log("[Popup] handleAuthResult completed");
    } catch (error) {
      console.error("Login failed:", error);
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
      console.log("[Popup] handleLogin end");
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

  saveToneSetting(tone) {
    this.currentTone = tone;
    chrome.storage.sync.set({ defaultTone: tone });
    console.log("Tone setting saved:", tone);
  }

  async loadTones() {
    try {
      const tones = await this.api.getTones();
      this.allTones = tones; // Store for later use

      // Debug: Log the tones to see their structure
      console.log("LoadTones: All tones received:", tones);
      
      // Populate both tone select elements
      const toneSelectLoggedOut = document.getElementById(
        "replyToneSelectLoggedOut"
      );
      const toneSelectLoggedIn = document.getElementById("replyToneSelect");

      [toneSelectLoggedOut, toneSelectLoggedIn].forEach((toneSelect) => {
        if (toneSelect && tones.length > 0) {
          // Start fresh with just "Always ask me"
          toneSelect.innerHTML = '<option value="ask">Always ask me</option>';

          // Filter out "Always ask me" from the API response to avoid duplicates
          const filteredTones = tones.filter(tone => tone.name !== "ask");

          // Filter preset and custom tones from the filtered list
          const presetTones = filteredTones.filter((tone) => 
            tone.is_preset === true || 
            // If is_preset is undefined/null, treat known preset tone names as presets
            (tone.is_preset === undefined && ['neutral', 'joke', 'support', 'idea', 'question', 'confident'].includes(tone.name))
          );
          const customTones = filteredTones.filter((tone) => 
            tone.is_preset === false || 
            // If is_preset is undefined/null and it's not a known preset, treat as custom
            (tone.is_preset === undefined && !['neutral', 'joke', 'support', 'idea', 'question', 'confident'].includes(tone.name))
          );
          
          console.log(`LoadTones: Preset tones for ${toneSelect.id}:`, presetTones);
          console.log(`LoadTones: Custom tones for ${toneSelect.id}:`, customTones);

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
        }
      });
    } catch (error) {
      console.error("Failed to load tones:", error);
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

  showAddToneForm() {
    const customTonesList = document.getElementById("customTonesList");
    if (!customTonesList) return;

    const formHtml = `
      <div class="tone-form" id="addToneForm">
        <div class="tone-form-field">
          <label class="tone-form-label">Tone Name (lowercase, no spaces)</label>
          <input type="text" class="tone-form-input" id="toneNameInput" placeholder="e.g., friendly_casual">
        </div>
        <div class="tone-form-field">
          <label class="tone-form-label">Display Name</label>
          <input type="text" class="tone-form-input" id="toneDisplayInput" placeholder="e.g., 😊 Friendly & Casual">
        </div>
        <div class="tone-form-field">
          <label class="tone-form-label">Description (optional)</label>
          <textarea class="tone-form-textarea" id="toneDescInput" placeholder="Describe this tone..."></textarea>
        </div>
        <div class="tone-form-actions">
          <button class="tone-form-btn save" onclick="saveCustomTone()">Save</button>
          <button class="tone-form-btn cancel" onclick="cancelToneForm()">Cancel</button>
        </div>
      </div>
    `;

    customTonesList.insertAdjacentHTML("afterbegin", formHtml);
    document.getElementById("addToneButton").style.display = "none";
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
    chrome.storage.sync.get(["defaultTone"], (result) => {
      if (result.defaultTone) {
        this.currentTone = result.defaultTone;
      }

      const loggedOutSelect = document.getElementById(
        "replyToneSelectLoggedOut"
      );
      const loggedInSelect = document.getElementById("replyToneSelect");

      if (loggedOutSelect) loggedOutSelect.value = this.currentTone;
      if (loggedInSelect) loggedInSelect.value = this.currentTone;
    });
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
  console.log("[Popup] DOMContentLoaded fired");
  appendDebug("DOMContentLoaded");
  try {
    window.popupManager = new PopupManager();
    appendDebug("PopupManager constructed");
  } catch (e) {
    console.error("[Popup] Failed constructing PopupManager", e);
    appendDebug("PopupManager construction failed: " + (e && e.message));
  }

  // Delegated fallback
  document.body.addEventListener(
    "click",
    (e) => {
      const id = e.target && e.target.id;
      if (!id) return;
      if (id === "loginButton" && window.popupManager) {
        appendDebug("Delegated click: loginButton");
        window.popupManager.handleLogin();
      }
      if (id === "debugRefreshButton" && window.popupManager) {
        appendDebug("Delegated click: debugRefreshButton");
        window.popupManager.refreshAuthState();
      }
      if (id === "dashboardButton" && window.popupManager) {
        appendDebug("Delegated click: dashboardButton");
        window.popupManager.openDashboard();
      }
      if (id === "logoutButton" && window.popupManager) {
        appendDebug("Delegated click: logoutButton");
        window.popupManager.handleLogout();
      }
    },
    true
  );
});
