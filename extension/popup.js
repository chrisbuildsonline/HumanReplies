// Popup script for HumanReplies extension
class PopupManager {
  constructor() {
    this.isLoggedIn = false;
    this.currentUser = null;
    this.currentTone = "ask";
    this.api = new HumanRepliesAPI();
    this.supabase = new SupabaseClient();

    this.init();
  }

  async init() {
    // Since authentication is now optional, we'll check but not require it
    await this.checkAuthStatus();
    this.checkCurrentSite();
    await this.loadTones();
    this.updateUIState();
    this.loadToneSetting();
    this.setupEventListeners();
  }

  async checkAuthStatus() {
    try {
      // Check if user has stored token
      const result = await new Promise((resolve) => {
        chrome.storage.sync.get(
          ["userToken", "userProfile", "refreshToken", "tokenExpiry"],
          resolve
        );
      });

      if (result.userToken && result.userProfile) {
        // Check if token is expired
        const now = Date.now();
        const expiry = result.tokenExpiry || 0;

        if (now >= expiry && result.refreshToken) {
          try {
            // Try to refresh the token
            const refreshResult = await this.supabase.refreshToken(
              result.refreshToken
            );

            // Update stored tokens
            await new Promise((resolve) => {
              chrome.storage.sync.set(
                {
                  userToken: refreshResult.access_token,
                  refreshToken: refreshResult.refresh_token,
                  tokenExpiry: Date.now() + refreshResult.expires_in * 1000,
                },
                resolve
              );
            });

            this.currentUser = result.userProfile;
            this.isLoggedIn = true;
          } catch (error) {
            console.warn("Token refresh failed:", error);
            await this.clearAuthData();
          }
        } else if (now < expiry) {
          // Token is still valid
          this.currentUser = result.userProfile;
          this.isLoggedIn = true;
        } else {
          // Token expired and no refresh token
          await this.clearAuthData();
        }
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      await this.clearAuthData();
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
    }

    // Signup button
    const signupButton = document.getElementById("signupButton");
    if (signupButton) {
      signupButton.addEventListener("click", () => this.handleSignup());
    }

    // Tone selectors
    const toneSelectLoggedOut = document.getElementById("replyToneSelectLoggedOut");
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
  }

  async handleLogin() {
    try {
      // Show loading state
      const loginBtn = document.querySelector(".login-button");
      const originalText = loginBtn.innerHTML;
      loginBtn.innerHTML = "🔄 Opening login...";
      loginBtn.disabled = true;

      // Use Supabase Auth popup
      const authResult = await this.supabase.authenticateWithPopup("signin");

      if (authResult.access_token) {
        // Get user info from Supabase
        const userInfo = await this.supabase.getUserInfo(
          authResult.access_token
        );

        // Store auth data
        await new Promise((resolve) => {
          chrome.storage.sync.set(
            {
              userToken: authResult.access_token,
              refreshToken: authResult.refresh_token,
              tokenExpiry: Date.now() + authResult.expires_in * 1000,
              userProfile: {
                id: userInfo.id,
                email: userInfo.email,
                full_name:
                  userInfo.user_metadata?.full_name ||
                  userInfo.email.split("@")[0],
                avatar_url: userInfo.user_metadata?.avatar_url,
                created_at: userInfo.created_at,
              },
            },
            resolve
          );
        });

        // Update UI state
        this.currentUser = {
          id: userInfo.id,
          email: userInfo.email,
          full_name:
            userInfo.user_metadata?.full_name || userInfo.email.split("@")[0],
          avatar_url: userInfo.user_metadata?.avatar_url,
          created_at: userInfo.created_at,
        };
        this.isLoggedIn = true;
        this.updateUIState();
        this.showSuccess("Login successful!");
      }
    } catch (error) {
      console.error("Login failed:", error);
      if (error.message === "Authentication cancelled by user") {
        this.showError("Login cancelled");
      } else {
        this.showError("Login failed. Please try again.");
      }
    } finally {
      // Reset button
      const loginBtn = document.querySelector(".login-button");
      const originalText = "🚀 Login to HumanReplies";
      loginBtn.innerHTML = originalText;
      loginBtn.disabled = false;
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

      if (authResult.access_token) {
        // Get user info from Supabase
        const userInfo = await this.supabase.getUserInfo(
          authResult.access_token
        );

        // Store auth data
        await new Promise((resolve) => {
          chrome.storage.sync.set(
            {
              userToken: authResult.access_token,
              refreshToken: authResult.refresh_token,
              tokenExpiry: Date.now() + authResult.expires_in * 1000,
              userProfile: {
                id: userInfo.id,
                email: userInfo.email,
                full_name:
                  userInfo.user_metadata?.full_name ||
                  userInfo.email.split("@")[0],
                avatar_url: userInfo.user_metadata?.avatar_url,
                created_at: userInfo.created_at,
              },
            },
            resolve
          );
        });

        // Update UI state
        this.currentUser = {
          id: userInfo.id,
          email: userInfo.email,
          full_name:
            userInfo.user_metadata?.full_name || userInfo.email.split("@")[0],
          avatar_url: userInfo.user_metadata?.avatar_url,
          created_at: userInfo.created_at,
        };
        this.isLoggedIn = true;
        this.updateUIState();
        this.showSuccess("Account created successfully!");
      }
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

  async clearAuthData() {
    this.isLoggedIn = false;
    this.currentUser = null;

    await new Promise((resolve) => {
      chrome.storage.sync.remove(
        ["userToken", "userProfile", "refreshToken", "tokenExpiry"],
        resolve
      );
    });

    this.updateUIState();
  }

  openDashboard() {
    chrome.tabs.create({ url: "https://app.humanreplies.com/dashboard" });
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
      
      // Populate both tone select elements
      const toneSelectLoggedOut = document.getElementById("replyToneSelectLoggedOut");
      const toneSelectLoggedIn = document.getElementById("replyToneSelect");
      
      [toneSelectLoggedOut, toneSelectLoggedIn].forEach(toneSelect => {
        if (toneSelect && tones.length > 0) {
          // Clear existing options
          toneSelect.innerHTML = "";
          
          // Add tone options
          tones.forEach(tone => {
            const option = document.createElement("option");
            option.value = tone.name;
            option.textContent = tone.display_name;
            toneSelect.appendChild(option);
          });
        }
      });
    } catch (error) {
      console.error("Failed to load tones:", error);
      // Keep the hardcoded options as fallback - they're already in the HTML
    }
  }

  async loadCustomTones() {
    if (!this.isLoggedIn || !this.allTones) return;

    const customTonesList = document.getElementById("customTonesList");
    if (!customTonesList) return;

    // Filter custom tones (non-preset tones)
    const customTones = this.allTones.filter(tone => !tone.is_preset);

    if (customTones.length === 0) {
      customTonesList.innerHTML = '<div style="font-size: 11px; color: #7f8c8d; text-align: center; padding: 8px;">No custom tones yet</div>';
      return;
    }

    customTonesList.innerHTML = customTones.map(tone => `
      <div class="custom-tone-item">
        <div class="custom-tone-info">
          <div class="custom-tone-name">${tone.display_name}</div>
          <div class="custom-tone-desc">${tone.description || 'No description'}</div>
        </div>
        <div class="custom-tone-actions">
          <button class="tone-action-btn edit" onclick="editCustomTone('${tone.id}')">✏️</button>
          <button class="tone-action-btn delete" onclick="deleteCustomTone('${tone.id}')">🗑️</button>
        </div>
      </div>
    `).join('');
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

    customTonesList.insertAdjacentHTML('afterbegin', formHtml);
    document.getElementById("addToneButton").style.display = 'none';
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
        description: descInput.value.trim() || null
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
    const form = document.getElementById("addToneForm") || document.getElementById("editToneForm");
    if (form) {
      form.remove();
    }
    document.getElementById("addToneButton").style.display = 'block';
  }

  async editCustomTone(toneId) {
    const tone = this.allTones.find(t => t.id === toneId);
    if (!tone) return;

    const customTonesList = document.getElementById("customTonesList");
    if (!customTonesList) return;

    const formHtml = `
      <div class="tone-form" id="editToneForm">
        <div class="tone-form-field">
          <label class="tone-form-label">Tone Name (lowercase, no spaces)</label>
          <input type="text" class="tone-form-input" id="toneNameInput" value="${tone.name}">
        </div>
        <div class="tone-form-field">
          <label class="tone-form-label">Display Name</label>
          <input type="text" class="tone-form-input" id="toneDisplayInput" value="${tone.display_name}">
        </div>
        <div class="tone-form-field">
          <label class="tone-form-label">Description (optional)</label>
          <textarea class="tone-form-textarea" id="toneDescInput">${tone.description || ''}</textarea>
        </div>
        <div class="tone-form-actions">
          <button class="tone-form-btn save" onclick="saveEditedTone('${toneId}')">Update</button>
          <button class="tone-form-btn cancel" onclick="cancelToneForm()">Cancel</button>
        </div>
      </div>
    `;

    customTonesList.insertAdjacentHTML('afterbegin', formHtml);
    document.getElementById("addToneButton").style.display = 'none';
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
          userAvatar.textContent = (this.currentUser.full_name || this.currentUser.email).charAt(0).toUpperCase();
        }
        if (userName) {
          userName.textContent = this.currentUser.full_name || this.currentUser.email.split("@")[0];
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

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", function () {
  window.popupManager = new PopupManager();
});
