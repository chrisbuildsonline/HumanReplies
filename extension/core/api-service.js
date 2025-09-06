// Core API service for HumanReplies

class HumanRepliesAPI {
  constructor() {
    // Initialize with environment config
    this.initializeConfig();
    this.fallbackMode = true; // Use Pollinations.ai directly for now
  }

  async initializeConfig() {
    // Load environment configuration
    if (typeof window !== "undefined" && window.EnvironmentConfig) {
      await window.EnvironmentConfig.loadEnvironment();
      this.baseURL = window.EnvironmentConfig.getApiBaseURL();
      this.pollinationsURL = window.EnvironmentConfig.getPollinationsURL();
      this.debugMode = window.EnvironmentConfig.isDebugMode();
      
      // Check for custom base URL override
      const customURL = await window.EnvironmentConfig.getCustomBaseURL();
      if (customURL) {
        this.baseURL = customURL;
      }
    } else {
      // Fallback configuration
      this.baseURL = "http://localhost:8000/api/v1"; // Default to local development
      this.pollinationsURL = "https://text.pollinations.ai";
      this.debugMode = true;
    }

    if (this.debugMode) {
      console.log(`HumanReplies API initialized with baseURL: ${this.baseURL}`);
    }
  }

  async generateReply(context, options = {}) {
    // Ensure config is loaded
    if (!this.baseURL) {
      await this.initializeConfig();
    }

    if (this.fallbackMode) {
      return this.generateWithPollinations(context, options);
    } else {
      return this.generateWithSaaS(context, options);
    }
  }

  async generateWithSaaS(context, options) {
    // Implementation for your FastAPI backend
    try {
      if (this.debugMode) {
        console.log(`Making request to: ${this.baseURL}/generate-reply`);
      }

      const response = await fetch(`${this.baseURL}/generate-reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await this.getUserToken()}`,
        },
        body: JSON.stringify({
          context: context,
          platform: options.platform || "x",
          tone: options.tone || "helpful",
          length: options.length || "medium",
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error(
            "Daily limit reached. Upgrade for unlimited replies."
          );
        }
        throw new Error(`Service unavailable: ${response.status}`);
      }

      const data = await response.json();
      
      // Store the reply in the backend for analytics
      await this.storeReply(context, data.reply, options);
      
      return {
        reply: data.reply,
        remainingReplies: data.remainingReplies,
        isLimitReached: data.remainingReplies <= 0,
      };
    } catch (error) {
      console.error("Backend API error:", error);
      throw error;
    }
  }

  async generateWithPollinations(context, options) {
    try {
      const prompt = this.buildPrompt(context, options);

      // Pollinations.ai uses a simple GET request with the prompt as a parameter
      const encodedPrompt = encodeURIComponent(prompt);
      const response = await fetch(`${this.pollinationsURL}/${encodedPrompt}`, {
        method: "GET",
        headers: {
          Accept: "text/plain",
        },
      });

      if (!response.ok) {
        throw new Error(`Pollinations API error: ${response.status}`);
      }

      const reply = await response.text();

      // Clean up the response - remove any extra quotes or newlines
      const cleanReply = reply.trim().replace(/^["']|["']$/g, "");

      return {
        reply: cleanReply,
        remainingReplies: null, // Free service - unlimited
        isLimitReached: false,
      };
    } catch (error) {
      console.error("Pollinations API error:", error);
      throw error;
    }
  }

  buildPrompt(context, options = {}) {
    const {
      tone = "helpful",
      platform = "social media",
      userWritingStyle = "",
    } = options;

    const p = String(platform).toLowerCase();
    const isTwitter = p === "twitter" || p === "x";

    const platformInstructions = isTwitter
      ? "Limit to under 100 characters. Keep it very light and short, do not sound to stiff. Avoid hashtags and unnecessary @mentions. Use newlines \r\n if suitable. "
      : "Keep it concise and skimmable."; // Twitter is 280

    let toneInstruction = "Write a helpful, balanced reply. ";
    switch (tone) {
      case "joke":
        toneInstruction = "Write a funny, good-natured reply.";
        break;
      case "support":
        toneInstruction =
          "Write a supportive, encouraging reply. You don't have to write keep going in every response.";
        break;
      case "idea":
        toneInstruction = "Suggest an innovative, practical idea as a reply.";
        break;
      case "confident":
        toneInstruction = "Write a confident, assertive reply.";
        break;
      case "question":
        toneInstruction =
          "Ask a thoughtful, conversation-starting question as a reply.";
        break;
    }

    toneInstruction +=
      " You are replying to a human, so act like it. Use smileys only if appropriate. Build on the original post. Answer questions if asked.";

    const noDashRule =
      "Do not use em dashes (—) or en dashes (–). Use commas, periods, or semicolons instead. " +
      "Grammar should be easy to read, for everyone. " +
      "Before returning, scan the text and replace any em/en dash with a comma or period.";

    const style = userWritingStyle
      ? `Adopt this writing style: ${userWritingStyle}`
      : "";

    const prompt = [
      style,
      `${toneInstruction} to this ${
        isTwitter ? "X (Twitter)" : p
      } post: "${context}".`,
      `${platformInstructions} Keep it conversational and human-like.`,
      "Be respectful. No emojis unless present in the original.",
      noDashRule,
    ]
      .filter(Boolean)
      .join("\n");

    return prompt.trim();
  }

  async getUserToken() {
    // Future implementation - get user auth token
    return new Promise((resolve) => {
      chrome.storage.sync.get(["userToken"], (result) => {
        resolve(result.userToken || null);
      });
    });
  }

  async storeReply(originalPost, generatedReply, options = {}) {
    // Store reply in backend for dashboard analytics
    if (this.fallbackMode) {
      return; // Skip storing in fallback mode
    }

    try {
      const response = await fetch(`${this.baseURL}/replies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await this.getUserToken()}`,
        },
        body: JSON.stringify({
          original_post: originalPost,
          generated_reply: generatedReply,
          service_type: options.platform || "x",
          post_url: options.postUrl || null,
          metadata: {
            tone: options.tone,
            length: options.length,
            timestamp: new Date().toISOString()
          }
        }),
      });

      if (this.debugMode && response.ok) {
        console.log("Reply stored successfully for analytics");
      }
    } catch (error) {
      console.warn("Failed to store reply for analytics:", error);
      // Don't throw - this shouldn't break the main functionality
    }
  }

  async checkUserLimits() {
    // Check daily limits from your backend
    if (this.fallbackMode) {
      return { remainingReplies: null, isLimitReached: false };
    }

    try {
      const response = await fetch(`${this.baseURL}/user/limits`, {
        headers: {
          Authorization: `Bearer ${await this.getUserToken()}`,
        },
      });

      const data = await response.json();
      return {
        remainingReplies: data.remainingReplies,
        isLimitReached: data.remainingReplies <= 0,
      };
    } catch (error) {
      console.error("Failed to check limits:", error);
      return { remainingReplies: 0, isLimitReached: true };
    }
  }
}

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = HumanRepliesAPI;
} else {
  window.HumanRepliesAPI = HumanRepliesAPI;
}
