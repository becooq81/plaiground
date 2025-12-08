# Development Guide

## Getting Started

This extension is built with vanilla JavaScript (no build process required). You can start developing immediately!

## Project Architecture

### Manifest V3 Structure

This extension uses Chrome's Manifest V3, which includes:

- **Service Worker** (`background.js`): Replaces background pages, handles events
- **Content Scripts** (`content.js`): Runs in the context of web pages
- **Popup** (`popup.html`, `popup.js`, `popup.css`): Extension UI

### Communication Flow

```
Popup (popup.js)
    ↕ chrome.runtime.sendMessage()
Background (background.js)
    ↕ chrome.tabs.sendMessage()
Content Script (content.js)
```

## Common Development Tasks

### 1. Adding New Permissions

Edit `manifest.json`:

```json
"permissions": [
  "storage",
  "activeTab",
  "tabs",        // Add new permissions here
  "bookmarks"
]
```

Common permissions:
- `storage`: Chrome storage API
- `activeTab`: Access to current tab
- `tabs`: Full tab access
- `bookmarks`: Bookmark management
- `history`: Browsing history
- `cookies`: Cookie access

### 2. Modifying the Popup

- **UI**: Edit `popup.html`
- **Styles**: Edit `popup.css`
- **Logic**: Edit `popup.js`

Popup has access to:
- `chrome.storage`: Persistent storage
- `chrome.tabs`: Tab manipulation
- `chrome.runtime`: Send messages to background

### 3. Working with Content Scripts

Content scripts can:
- Access and modify the DOM
- Listen to page events
- Communicate with background/popup

Content scripts CANNOT:
- Use most Chrome APIs (except storage, runtime messaging)
- Access variables from page scripts

### 4. Background Service Worker

The background service worker:
- Listens for browser events
- Manages long-running tasks
- Coordinates between content scripts and popup

**Important**: Service workers can be terminated by Chrome. Don't rely on global state!

### 5. Storage

Use `chrome.storage.sync` for user preferences:

```javascript
// Save
await chrome.storage.sync.set({ key: 'value' });

// Load
const data = await chrome.storage.sync.get(['key']);
console.log(data.key);
```

Use `chrome.storage.local` for larger data.

## Debugging Tips

### View Console Logs

- **Popup**: Right-click extension icon → Inspect popup
- **Background**: Go to `chrome://extensions/` → Click "service worker"
- **Content Script**: Open DevTools on the webpage (F12)

### Common Issues

**Service worker not updating**:
- Reload the extension completely at `chrome://extensions/`

**Content script not injecting**:
- Check `matches` patterns in manifest.json
- Ensure you've reloaded the extension after changes
- Check if the content script is in the Console's context dropdown

**Storage not persisting**:
- Use `chrome.storage.sync` or `chrome.storage.local`, not `localStorage`
- Check if you have the "storage" permission

## Testing

### Manual Testing
1. Load extension in Chrome
2. Click extension icon
3. Check console for errors
4. Test on different websites

### Automated Testing (Future)
Consider adding:
- Jest for unit tests
- Puppeteer for E2E tests

## Building for Production

1. **Update version** in `manifest.json`
2. **Convert icons to PNG** (required for Chrome Web Store)
3. **Remove console.logs** (optional but recommended)
4. **Test thoroughly**
5. **Create a ZIP file**:
   ```bash
   zip -r extension.zip . -x "*.git*" -x "node_modules/*" -x "*.md"
   ```

## Best Practices

1. **Keep service worker lightweight**: It can be terminated at any time
2. **Use promises/async-await**: Modern Chrome API methods return promises
3. **Handle errors gracefully**: Always wrap Chrome API calls in try-catch
4. **Respect user privacy**: Only request permissions you actually need
5. **Minimize content script impact**: Content scripts run on every page load

## Useful Resources

- [Chrome Extensions Documentation](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Chrome APIs Reference](https://developer.chrome.com/docs/extensions/reference/)
- [Sample Extensions](https://github.com/GoogleChrome/chrome-extensions-samples)

## Next Steps

- [ ] Customize the extension name and description
- [ ] Add your custom functionality
- [ ] Update permissions as needed
- [ ] Create proper icons (convert SVG to PNG)
- [ ] Add error handling
- [ ] Test on different websites
- [ ] Prepare for publishing

