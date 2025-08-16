# Dark/Light Mode Implementation for HumanReplies

## Overview
HumanReplies extension now supports automatic dark/light mode detection and theming across all components.

## Implementation Details

### 1. Theme Detection
The extension detects the current theme using multiple methods:

```javascript
const isDarkMode = document.documentElement.style.colorScheme === 'dark' ||
                  document.body.classList.contains('dark') ||
                  document.querySelector('[data-theme="dark"]') ||
                  window.matchMedia('(prefers-color-scheme: dark)').matches ||
                  // X-specific dark mode detection
                  document.querySelector('meta[name="theme-color"][content="#000000"]') ||
                  document.querySelector('[style*="background-color: rgb(0, 0, 0)"]') ||
                  getComputedStyle(document.body).backgroundColor === 'rgb(0, 0, 0)';
```

### 2. Dynamic Theme Watching
The extension watches for theme changes in real-time using MutationObserver:

- Monitors `document.documentElement` and `document.body` for style/class changes
- Automatically updates UI colors when theme switches
- Logs theme changes for debugging

### 3. Component Theming

#### Generate Reply Button
- **Light Mode**: `#2c3e50` (dark navy)
- **Dark Mode**: `#1d9bf0` (Twitter blue)
- Hover states and shadows adapt accordingly

#### Selection Toolbar (Compact)
- **Light Mode**: `#2c3e50` background
- **Dark Mode**: `#1d9bf0` background
- Maintains brand consistency while adapting to platform

#### Selection Toolbar (Expanded)
- **Light Mode**: White background, dark text
- **Dark Mode**: `#15202b` background, white text
- Borders and shadows adjust for visibility

#### Reply Tone Menu
- **Light Mode**: White background, dark text
- **Dark Mode**: `#15202b` background, white text
- Dropdown and buttons themed appropriately

#### Extension Popup
- **Light Mode**: `#f5f3f0` background (brand beige)
- **Dark Mode**: `#15202b` background (Twitter dark)
- All text, borders, and controls adapt

### 4. Color Palette

#### Light Mode Colors
- Primary: `#2c3e50` (HumanReplies brand navy)
- Background: `#f5f3f0` (brand beige)
- Text: `#2c3e50`
- Secondary text: `#7f8c8d`
- Borders: `#e8e5e1`
- Cards: `white`

#### Dark Mode Colors
- Primary: `#1d9bf0` (Twitter blue)
- Background: `#15202b` (Twitter dark)
- Text: `#ffffff`
- Secondary text: `#8b98a5`
- Borders: `#38444d`
- Cards: `#1e2732`

### 5. CSS Media Queries
All components use `@media (prefers-color-scheme: dark)` for fallback theming when JavaScript detection isn't available.

### 6. Platform Integration
The theming system is designed to:
- Respect user's system preferences
- Integrate seamlessly with X (Twitter) interface
- Maintain HumanReplies brand identity
- Provide consistent experience across light/dark modes

## Benefits
1. **Better UX**: Matches user's preferred theme
2. **Platform Integration**: Blends naturally with X interface
3. **Accessibility**: Proper contrast ratios in both modes
4. **Brand Consistency**: Maintains HumanReplies identity
5. **Future-Proof**: Easy to extend to other platforms

## Testing
- Test on X with light theme
- Test on X with dark theme
- Test system theme switching
- Verify popup theming
- Check all toolbar states and menus

## Future Enhancements
- Manual theme override in settings
- Custom color schemes
- Platform-specific theme adaptations
- High contrast mode support