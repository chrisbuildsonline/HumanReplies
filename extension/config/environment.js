// Environment configuration for HumanReplies extension
// This file handles different environments and API endpoints

class EnvironmentConfig {
  constructor() {
    this.environments = {
      development: {
        apiBaseURL: "http://localhost:8000/api/v1",
        pollinationsURL: "https://text.pollinations.ai",
        debug: true,
      },
      staging: {
        apiBaseURL: "https://staging-api.humanreplies.com/v1",
        pollinationsURL: "https://text.pollinations.ai",
        debug: true,
      },
      production: {
        apiBaseURL: "https://api.humanreplies.com/v1",
        pollinationsURL: "https://text.pollinations.ai",
        debug: false,
      },
    };

    // Default environment - change this for different builds
    this.currentEnvironment = "development";

    // Load environment from storage or manifest
    this.loadEnvironment();
  }

  async loadEnvironment() {
    try {
      // Try to get environment from chrome storage first
      const result = await new Promise((resolve) => {
        chrome.storage.sync.get(["environment"], resolve);
      });

      if (result.environment && this.environments[result.environment]) {
        this.currentEnvironment = result.environment;
      } else {
        // Try to detect from manifest or URL
        this.detectEnvironment();
      }
    } catch (error) {
      console.warn("Could not load environment from storage:", error);
      this.detectEnvironment();
    }
  }

  detectEnvironment() {
    // Auto-detect environment based on extension context
    if (typeof chrome !== "undefined" && chrome.runtime) {
      const manifest = chrome.runtime.getManifest();

      // Check if this is a development build
      if (
        manifest.name.includes("Dev") ||
        manifest.name.includes("Development")
      ) {
        this.currentEnvironment = "development";
      } else if (manifest.name.includes("Staging")) {
        this.currentEnvironment = "staging";
      } else {
        this.currentEnvironment = "production";
      }
    }
  }

  getConfig() {
    return this.environments[this.currentEnvironment];
  }

  getApiBaseURL() {
    return this.getConfig().apiBaseURL;
  }

  getPollinationsURL() {
    return this.getConfig().pollinationsURL;
  }

  isDebugMode() {
    return this.getConfig().debug;
  }

  getCurrentEnvironment() {
    return this.currentEnvironment;
  }

  async setEnvironment(env) {
    if (this.environments[env]) {
      this.currentEnvironment = env;

      // Save to storage
      try {
        await new Promise((resolve) => {
          chrome.storage.sync.set({ environment: env }, resolve);
        });
      } catch (error) {
        console.warn("Could not save environment to storage:", error);
      }
    }
  }

  // Method to override baseURL manually (for testing)
  async setCustomBaseURL(url) {
    try {
      await new Promise((resolve) => {
        chrome.storage.sync.set({ customBaseURL: url }, resolve);
      });

      // Update current config
      this.environments[this.currentEnvironment].apiBaseURL = url;
    } catch (error) {
      console.warn("Could not save custom base URL:", error);
    }
  }

  async getCustomBaseURL() {
    try {
      const result = await new Promise((resolve) => {
        chrome.storage.sync.get(["customBaseURL"], resolve);
      });
      return result.customBaseURL;
    } catch (error) {
      return null;
    }
  }
}

// Create singleton instance
const environmentConfig = new EnvironmentConfig();

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = environmentConfig;
} else {
  window.EnvironmentConfig = environmentConfig;
}
