// Core API service for HumanReplies

class HumanRepliesAPI {
  constructor() {
    this.baseURL = 'https://api.humanreplies.com/v1'; // Future SaaS endpoint
    this.fallbackMode = true; // Use DeepSeek directly for now
    this.deepSeekKey = 'hidden';
    this.deepSeekURL = 'https://api.deepseek.com/v1';
  }

  async generateReply(context, options = {}) {
    if (this.fallbackMode) {
      return this.generateWithDeepSeek(context, options);
    } else {
      return this.generateWithSaaS(context, options);
    }
  }

  async generateWithSaaS(context, options) {
    // Future implementation for SaaS service
    try {
      const response = await fetch(`${this.baseURL}/generate-reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getUserToken()}`
        },
        body: JSON.stringify({
          context: context,
          platform: options.platform || 'x',
          tone: options.tone || 'helpful',
          length: options.length || 'medium'
        })
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Daily limit reached. Upgrade for unlimited replies.');
        }
        throw new Error(`Service unavailable: ${response.status}`);
      }

      const data = await response.json();
      return {
        reply: data.reply,
        remainingReplies: data.remainingReplies,
        isLimitReached: data.remainingReplies <= 0
      };
    } catch (error) {
      console.error('SaaS API error:', error);
      throw error;
    }
  }

  async generateWithDeepSeek(context, options) {
    try {
      const prompt = this.buildPrompt(context, options);
      
      const response = await fetch(`${this.deepSeekURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.deepSeekKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: 'You are HumanReplies, an AI that generates thoughtful, human-like replies to social media posts. Keep responses concise, engaging, and authentic.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 280, // Twitter-like limit
          temperature: 0.8
        })
      });

      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.status}`);
      }

      const data = await response.json();
      return {
        reply: data.choices[0].message.content,
        remainingReplies: null, // Unlimited in fallback mode
        isLimitReached: false
      };
    } catch (error) {
      console.error('DeepSeek API error:', error);
      throw error;
    }
  }

  buildPrompt(context, options) {
    const tone = options.tone || 'helpful';
    const platform = options.platform || 'social media';
    
    return `Generate a ${tone} reply to this ${platform} post: "${context}"
    
Requirements:
- Keep it conversational and human-like
- Match the tone of the original post
- Be concise (under 280 characters)
- Add value to the conversation
- Avoid being overly promotional or salesy`;
  }

  async getUserToken() {
    // Future implementation - get user auth token
    return new Promise((resolve) => {
      chrome.storage.sync.get(['userToken'], (result) => {
        resolve(result.userToken || null);
      });
    });
  }

  async checkUserLimits() {
    // Future implementation - check daily limits
    if (this.fallbackMode) {
      return { remainingReplies: null, isLimitReached: false };
    }
    
    try {
      const response = await fetch(`${this.baseURL}/user/limits`, {
        headers: {
          'Authorization': `Bearer ${await this.getUserToken()}`
        }
      });
      
      const data = await response.json();
      return {
        remainingReplies: data.remainingReplies,
        isLimitReached: data.remainingReplies <= 0
      };
    } catch (error) {
      console.error('Failed to check limits:', error);
      return { remainingReplies: 0, isLimitReached: true };
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HumanRepliesAPI;
} else {
  window.HumanRepliesAPI = HumanRepliesAPI;
}