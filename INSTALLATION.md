# Installation Guide

## How to Load Your Chrome Extension

### Step 1: Add Icons
Before loading the extension, you need to add icon files to the `icons/` directory:
- `icon16.png` (16x16px)
- `icon48.png` (48x48px)
- `icon128.png` (128x128px)

See `icons/README.md` for quick generation methods.

### Step 2: Load in Chrome

1. Open Google Chrome
2. Navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked**
5. Select the `plaiground` folder (this directory)

### Step 3: Test Your Extension

- Click the extension icon in your Chrome toolbar
- The popup should appear with a button
- Click the button to test functionality
- Open DevTools (F12) and check the Console tab for logs

## Development Tips

### Reload After Changes
After making code changes:
1. Go to `chrome://extensions/`
2. Click the **Reload** button on your extension

### Debug Your Extension

- **Popup**: Right-click the extension icon → Inspect popup
- **Background script**: Click "service worker" link on extension card
- **Content script**: Open DevTools on any webpage (F12)

### Common Issues

**Icons missing error**: Add placeholder PNG files to the `icons/` directory

**Extension not working**: Check the Console for errors in:
- Background service worker
- Popup (inspect popup)
- Content script (page DevTools)

## File Structure

```
plaiground/
├── manifest.json       # Extension configuration
├── popup.html          # Popup UI
├── popup.css           # Popup styles
├── popup.js            # Popup logic
├── background.js       # Background service worker
├── content.js          # Content script (runs on pages)
├── content.css         # Styles injected into pages
└── icons/              # Extension icons
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Next Steps

1. Customize the extension name and description in `manifest.json`
2. Modify the popup UI in `popup.html` and `popup.css`
3. Add your logic to `popup.js`, `background.js`, and `content.js`
4. Update permissions in `manifest.json` as needed
5. Add proper icons

## Publishing (Optional)

To publish your extension to the Chrome Web Store:
1. Create a developer account
2. Package your extension
3. Upload to Chrome Web Store
4. Fill in store listing details

Learn more: https://developer.chrome.com/docs/webstore/publish/

