# Plaiground Chrome Extension

A modern Chrome extension built with Manifest V3, featuring a beautiful UI and clean architecture.

## Features

- 🎨 Modern, gradient-based UI design
- ⚡ Manifest V3 (latest Chrome extension standard)
- 💾 Chrome storage integration
- 🔄 Background service worker
- 📝 Content script for page interaction
- 🎯 Clean, modular code structure

## Quick Start

1. **Add Icons**: Create or add PNG icons to the `icons/` directory (see `icons/README.md`)
2. **Load Extension**: 
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select this directory
3. **Test**: Click the extension icon in your toolbar

For detailed instructions, see [INSTALLATION.md](INSTALLATION.md)

## Project Structure

```
├── manifest.json       # Extension configuration
├── popup.html          # Extension popup interface
├── popup.css           # Popup styling
├── popup.js            # Popup functionality
├── background.js       # Background service worker
├── content.js          # Content script (runs on web pages)
├── content.css         # Styles injected into pages
└── icons/              # Extension icons
```

## Development

### Making Changes

After editing any files:
1. Go to `chrome://extensions/`
2. Click the reload button on your extension

### Debugging

- **Popup**: Right-click extension icon → "Inspect popup"
- **Background**: Click "service worker" on extension card
- **Content Script**: Open DevTools (F12) on any webpage

## Customization

- Edit `manifest.json` to change name, description, and permissions
- Modify `popup.html` and `popup.css` to customize the UI
- Update logic in `popup.js`, `background.js`, and `content.js`

## Learn More

- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)

## License

See [LICENSE](LICENSE) file for details.