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
    await this.checkAuthStatus();
    this.checkCurrentSite();
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
    // Login and logout buttons are handled via inline onclick handlers

    // Dashboard button (add this to logged in state)
    this.addDashboardButton();
  }

  addDashboardButton() {
    // Add dashboard button to logged in state
    const loggedInState = document.getElementById("loggedInState");
    if (loggedInState) {
      const dashboardBtn = document.createElement("button");
      dashboardBtn.className = "login-button";
      dashboardBtn.style.marginBottom = "16px";
      dashboardBtn.innerHTML = "📊 Open Dashboard";
      dashboardBtn.addEventListener("click", () => this.openDashboard());

      // Insert after user info
      const userInfo = loggedInState.querySelector(".user-info");
      if (userInfo) {
        userInfo.insertAdjacentElement("afterend", dashboardBtn);
      }
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
      // Update user info
      const userAvatar = loggedInState.querySelector(".user-avatar");
      const userName = loggedInState.querySelector(".user-name");
      const userEmail = loggedInState.querySelector(".user-email");

      if (userAvatar) {
        const initials = this.currentUser.full_name
          ? this.currentUser.full_name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
          : this.currentUser.email[0].toUpperCase();
        userAvatar.textContent = initials;
      }

      if (userName) {
        userName.textContent = this.currentUser.full_name || "User";
      }

      if (userEmail) {
        userEmail.textContent = this.currentUser.email;
      }

      loggedOutState.classList.add("hidden");
      loggedInState.classList.remove("hidden");
    } else {
      loggedOutState.classList.remove("hidden");
      loggedInState.classList.add("hidden");
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

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", function () {
  window.popupManager = new PopupManager();
});
