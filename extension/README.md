# HumanReplies Browser Extension

A Chrome extension that generates AI-powered replies for social media platforms. Currently supports X (Twitter) with more platforms coming soon.

## Features

- 🧠 **Smart Reply Generation**: Generate thoughtful, context-aware replies
- ⚡ **Instant AI Responses**: Quick AI-powered suggestions
- 🎯 **Context-Aware**: Understands the conversation context
- 🔒 **Daily Limits**: 20 free replies per day (SaaS integration ready)
- 🌐 **Platform Agnostic**: Modular design for multiple social platforms

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select the `extension` folder
4. The extension will appear in your browser toolbar

## Usage

### On X (Twitter):
- Navigate to any tweet you want to reply to
- Look for the "🧠 Generate Reply" button in reply areas
- Click to generate an AI-powered response
- The reply will be automatically inserted into the text box

## Technical Details

- **AI Provider**: DeepSeek API (fallback mode) → Future SaaS service
- **Supported Sites**: x.com, twitter.com
- **Browser**: Chrome (Manifest V3)
- **Architecture**: Platform-agnostic with modular integrations

## Development

The extension consists of:
- `manifest.json` - Extension configuration
- `background.js` - Service worker with API management
- `core/api-service.js` - Platform-agnostic API service
- `platforms/x-integration.js` - X (Twitter) specific integration
- `popup.html` - Extension popup interface
- `styles.css` - Custom styling

## API Configuration

**Current (Fallback Mode)**: DeepSeek API
- Model: `deepseek-chat`
- Max tokens: 280 (Twitter-optimized)
- Temperature: 0.8

**Future (SaaS Mode)**: HumanReplies API
- Endpoint: `https://api.humanreplies.com/v1`
- Daily limit: 20 free replies
- User authentication and usage tracking

## Privacy & Security

- API key is stored securely in the extension
- No user data is stored or transmitted beyond AI requests
- All processing happens locally in your browser

## Architecture

```
extension/
├── manifest.json           # Extension configuration
├── background.js          # Service worker
├── popup.html            # Extension popup
├── styles.css            # Global styles
├── core/
│   └── api-service.js    # Platform-agnostic API service
└── platforms/
    └── x-integration.js  # X (Twitter) integration
```

## Future Enhancements

- **SaaS Integration**: Connect to HumanReplies API service
- **More Platforms**: LinkedIn, Facebook, Instagram, etc.
- **Usage Analytics**: Track reply performance and engagement
- **Custom Tones**: Professional, casual, humorous reply styles
- **Team Features**: Shared reply templates and brand voice