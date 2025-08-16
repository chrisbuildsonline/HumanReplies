# HumanReplies Extension Installation Guide

## Quick Install (Chrome)

1. **Open Chrome Extensions**
   - Go to `chrome://extensions/`
   - Or click the three dots menu → More tools → Extensions

2. **Enable Developer Mode**
   - Toggle "Developer mode" in the top right corner

3. **Load the Extension**
   - Click "Load unpacked"
   - Select the `extension` folder from this project
   - The extension should appear in your extensions list

4. **Verify Installation**
   - Look for "HumanReplies" in your extensions
   - The extension icon should appear in your browser toolbar
   - Status should show "On"

## Test the Extension

### Method 1: Visit X (Twitter)
1. Go to https://x.com or https://twitter.com
2. Find any tweet and click "Reply"
3. Look for the "🧠 Generate Reply" button
4. Click it to test AI reply generation

### Method 2: Use Test Page
1. Open `extension/test.html` in Chrome
2. Check that extension status shows "✅ Extension loaded successfully"
3. Click "Test DeepSeek API" to verify API connectivity

## Troubleshooting

### Extension Not Loading
- Make sure you selected the `extension` folder (not the parent folder)
- Check that all files are present in the extension folder
- Look for error messages in the Extensions page

### API Not Working
- Check your internet connection
- Verify the DeepSeek API key is valid
- Open Developer Tools (F12) and check Console for errors

### No Reply Button on X
- Make sure you're on x.com or twitter.com
- Try refreshing the page
- The button appears in reply areas, not main tweet compose

## Development Mode

If you're developing or modifying the extension:

1. **Make Changes** to any file in the `extension` folder
2. **Reload Extension** by clicking the refresh icon on the Extensions page
3. **Test Changes** by visiting X or using the test page

## File Structure

```
extension/
├── manifest.json              # Extension configuration
├── background.js             # Service worker
├── popup.html               # Extension popup
├── styles.css               # Styling
├── test.html               # Test page
├── core/
│   └── api-service.js      # API service
└── platforms/
    └── x-integration.js    # X (Twitter) integration
```

## Next Steps

Once installed and working:
- Visit X and try generating replies
- Check the popup for usage stats (future feature)
- Report any issues or suggestions

The extension is ready for production use with DeepSeek API integration!