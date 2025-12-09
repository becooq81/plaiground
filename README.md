# Plaiground

Chrome extension + backend API for translating clickbait titles into neutral, fact-based language using ChatGPT.

## Architecture

```
Extension (Chrome) → Backend API → OpenAI ChatGPT API
```

The extension detects news headlines on web pages, sends them to your backend, which calls OpenAI to rewrite them into neutral, unbiased titles, then displays the alternatives inline.

## Quick Start

### 1. Backend Setup

```bash
cd backend
npm install

# Create .env file
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY from https://platform.openai.com/api-keys

# Start the server
npm run dev
```

The backend will run on `http://localhost:4000` and automatically calls OpenAI's `https://api.openai.com/v1/chat/completions` endpoint.

### 2. Extension Setup

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `extension/` folder

### 3. Test It

1. Open a news website (e.g., Google News)
2. Click the extension icon
3. Click "Analyze page"
4. See AI-rewritten neutral titles appear below the original headlines!

## Project Structure

```
plaiground/
├── extension/          # Chrome extension (Manifest V3)
│   ├── icons/          # Extension icons
│   ├── popup.js        # Extension UI (calls backend API)
│   ├── content.js      # Injects rewritten titles into pages
│   └── manifest.json
├── backend/            # Express + TypeScript API
│   ├── src/index.ts    # Calls OpenAI API
│   └── .env.example    # Environment template
└── docs/               # Documentation
```

## Configuration

### Backend API URL

The extension is configured to call `http://localhost:4000/api/rewrite` by default.

To change it, edit `extension/popup.js` line 10:
```javascript
const API_URL = 'http://localhost:4000/api/rewrite'; // Change this
```

### Environment Variables

**Backend** (`backend/.env`):
- `OPENAI_API_KEY` (required) - Your OpenAI API key
- `PORT` (optional, default: 4000) - Server port
- `ALLOWED_ORIGINS` (optional) - CORS origins, leave empty for dev

## How It Works

1. **Extension** detects headlines on the current page
2. **Extension** sends titles + article context to backend
3. **Backend** calls OpenAI with a specialized prompt for Korean clickbait-to-neutral translation
4. **Backend** returns rewritten titles
5. **Extension** injects alternative titles below originals on the page

## Features

- ✅ Detects headlines on news sites (Google News, etc.)
- ✅ Sends to ChatGPT for intelligent rewriting
- ✅ Removes clickbait, emotional language, and bias
- ✅ Preserves factual information
- ✅ Displays alternatives inline on the page
- ✅ Blue color scheme

## License

See [LICENSE](LICENSE).
