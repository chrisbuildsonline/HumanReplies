# HumanReplies Dashboard

A modern Next.js dashboard for monitoring usage statistics, managing settings, and analyzing performance of the HumanReplies browser extension.

## Features

### 📊 Usage Statistics
- **Total Replies Generated**: Track lifetime reply count
- **Daily Activity**: Monitor today's usage and 7-day trends
- **Response Time**: Average API response performance
- **Tone Analysis**: Most frequently used reply tones

### 📈 Visual Analytics
- **Daily Usage Chart**: Canvas-based bar chart showing reply generation over the last 7 days
- **Tone Distribution**: Canvas-based pie chart displaying usage breakdown by tone type
- **Real-time Updates**: Stats refresh automatically every 30 seconds

### ⚙️ Settings Management
- **API Configuration**: Manage DeepSeek API key with connection testing
- **Default Preferences**: Set default reply tone and auto-show behavior
- **Privacy Controls**: Toggle usage statistics collection
- **Data Management**: Clear all stored data with confirmation

### 🎨 User Experience
- **Dark/Light Mode**: Toggle between themes with system preference detection
- **Responsive Design**: Optimized for desktop and mobile viewing
- **Recent Activity**: Timeline of recent reply generations with context
- **Real-time Notifications**: Success/error feedback for all actions

## Tech Stack

- **Next.js 14** with App Router
- **TypeScript** for type safety
- **React 18** with hooks
- **Canvas API** for custom charts
- **CSS Custom Properties** for theming

## File Structure

```
dashboard/
├── app/
│   ├── layout.tsx      # Root layout with metadata
│   ├── page.tsx        # Main dashboard page
│   └── globals.css     # Global styles with theme support
├── components/
│   ├── Header.tsx      # Header with theme toggle and settings
│   ├── StatsGrid.tsx   # Statistics cards grid
│   ├── Charts.tsx      # Canvas-based charts
│   ├── RecentActivity.tsx # Activity timeline
│   ├── SettingsModal.tsx  # Settings modal dialog
│   └── Notification.tsx   # Toast notifications
├── lib/
│   └── storage.ts      # Chrome storage service with mocks
├── types/
│   └── index.ts        # TypeScript type definitions
├── package.json        # Dependencies and scripts
├── next.config.js      # Next.js configuration
├── tsconfig.json       # TypeScript configuration
└── README.md          # This documentation
```

## Getting Started

### Installation
```bash
cd dashboard
npm install
```

### Development
```bash
npm run dev
# Opens at http://localhost:3000
```

### Build for Production
```bash
npm run build
npm start
```

### Static Export
```bash
npm run export
# Generates static files in out/ directory
```

## Technical Details

### Data Storage
- Uses Chrome Storage API for persistence
- Stores statistics, settings, and activity logs
- Automatic data migration and validation

### Theme System
- CSS custom properties for consistent theming
- Automatic dark mode detection
- Smooth transitions between themes

### Charts
- Custom canvas-based charts for performance
- Responsive design with automatic scaling
- Real-time data updates

### API Integration
- DeepSeek API connection testing
- Secure API key storage
- Error handling and user feedback

## Browser Compatibility
- Chrome/Chromium (primary target)
- Firefox (with WebExtensions API)
- Safari (with some limitations)
- Edge (Chromium-based)

## Development Notes
- Uses modern ES6+ JavaScript features
- Responsive CSS Grid and Flexbox layouts
- Accessible design with proper ARIA labels
- Performance optimized with efficient DOM updates
#
# Usage

### As Extension Dashboard
1. Build the dashboard and serve the static files
2. All data is automatically synced with the extension's Chrome storage
3. Settings changes apply immediately to the extension

### For Development
1. Run `npm run dev` to start the development server
2. Mock Chrome APIs are provided for standalone testing
3. Use React DevTools and browser developer tools for debugging

## Technical Details

### Data Storage
- Uses Chrome Storage API for persistence in extension context
- Mock storage service for development without extension
- Automatic data migration and validation
- TypeScript interfaces for type safety

### Theme System
- CSS custom properties for consistent theming
- Automatic dark mode detection and persistence
- Smooth transitions between themes
- Responsive design with CSS Grid and Flexbox

### Charts
- Custom canvas-based charts for optimal performance
- Responsive design with automatic scaling
- Real-time data updates without external dependencies
- Accessible color schemes for both themes

### API Integration
- DeepSeek API connection testing
- Secure API key storage in Chrome storage
- Comprehensive error handling and user feedback
- TypeScript interfaces for API responses

## Browser Compatibility
- Chrome/Chromium (primary target)
- Firefox (with WebExtensions API)
- Safari (with some limitations)
- Edge (Chromium-based)

## Development Notes
- Built with Next.js 14 App Router
- TypeScript for full type safety
- React 18 with modern hooks patterns
- CSS-in-JS avoided for better performance
- Accessible design with proper ARIA labels
- Performance optimized with efficient re-renders