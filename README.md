# NewTox

Chrome extension + backend API for translating clickbait Korean news titles into neutral, fact-based language using ChatGPT.

## Overview

NewTox (News Detox) helps you read news more objectively by automatically rewriting clickbait headlines into neutral, factual titles. The extension works especially well with Korean news sites like Naver News.

## Architecture

```
Extension (Chrome) → Backend API → OpenAI ChatGPT API
```

The extension detects news headlines on web pages, sends them to your backend, which calls OpenAI to rewrite them into neutral, unbiased titles, then displays the alternatives inline or replaces them in game mode.

## Features

### Core Features
- ✅ Detects headlines on Korean news sites (Naver News, Money Today, etc.)
- ✅ Sends to ChatGPT for intelligent rewriting
- ✅ Removes clickbait, emotional language, and bias
- ✅ Preserves factual information (numbers, dates, names, locations)
- ✅ Displays alternatives inline on the page
- ✅ Optimized for Naver News structure

### Game Mode 🎮
- ✅ **Guess the Original**: See translated titles and guess what the original was
- ✅ **Scoring System**: Get points based on how accurate your guess is (0-100)
- ✅ **Statistics**: Track your score, correct answers, and attempts
- ✅ **Similarity Algorithm**: Uses Levenshtein distance + word overlap + character similarity

## Quick Start

### 1. Backend Setup

```bash
cd backend
npm install

# Create .env file
cat > .env << 'EOF'
# OpenAI API Configuration
# Get your API key from https://platform.openai.com/api-keys
OPENAI_API_KEY=your_api_key_here

# Server Configuration
PORT=4000

# CORS Configuration (leave empty for development)
ALLOWED_ORIGINS=
EOF

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

1. Open a Korean news website (e.g., [Naver News](https://news.naver.com/))
2. Click the extension icon
3. Click **"페이지 분석"** (Analyze page)
4. See AI-rewritten neutral titles appear below the original headlines!

## Project Structure

```
newtox/
├── extension/          # Chrome extension (Manifest V3)
│   ├── icons/          # Extension icons (SVG logo)
│   ├── popup.html      # Extension popup UI
│   ├── popup.js        # Extension UI logic (calls backend API)
│   ├── popup.css       # Extension styles
│   ├── content.js      # Content script (detects & injects titles)
│   ├── content.css     # Styles for injected content
│   ├── background.js   # Background service worker
│   └── manifest.json   # Extension manifest
├── backend/            # Express + TypeScript API
│   ├── src/
│   │   └── index.ts    # Main API server (calls OpenAI)
│   ├── package.json
│   └── .env            # Environment variables (create this)
└── docs/               # Documentation
```

## Configuration

### Backend API URL

The extension is configured to call `http://localhost:4000/api/rewrite` by default.

To change it, edit `extension/popup.js`:
```javascript
const API_URL = 'http://localhost:4000/api/rewrite'; // Change this
```

### Environment Variables

**Backend** (`backend/.env`):
- `OPENAI_API_KEY` (required) - Your OpenAI API key from https://platform.openai.com/api-keys
- `PORT` (optional, default: 4000) - Server port
- `ALLOWED_ORIGINS` (optional) - CORS origins, leave empty for development

## How It Works

1. **Extension** detects headlines on the current page using specific selectors:
   - Links containing `news.naver.com/article`
   - Elements with class `cnf_news_title`
   - Elements with class `cc_clip_t`
2. **Extension** extracts text from these elements (prioritizing `strong` tags)
3. **Extension** sends titles + article context to backend
4. **Backend** calls OpenAI with a specialized prompt for Korean clickbait-to-neutral translation
5. **Backend** returns rewritten titles
6. **Extension** either:
   - **Normal Mode**: Injects alternative titles below originals on the page
   - **Game Mode**: Replaces titles with translated versions for guessing game

## Game Mode

Game Mode is an interactive feature where:

1. Original titles are completely replaced with translated versions
2. Users guess what the original title was
3. The system calculates a similarity score (0-100) using:
   - **Levenshtein Distance** (50% weight) - Edit distance algorithm
   - **Word Overlap** (50% weight) - Common words ratio
   - **Character Similarity** (20% weight) - Character-by-character matching
4. Scores ≥70 are considered correct
5. Statistics track total score, correct answers, and attempts


## Technical Details

### Similarity Algorithm

The game mode uses a hybrid similarity algorithm:

```javascript
Final Score = min(100, 
  Levenshtein Score (50%) + 
  Word Overlap Score (50%) + 
  Character Similarity (20%)
)
```

- **Levenshtein Distance**: Measures edit distance between strings
- **Word Overlap**: Calculates ratio of common words
- **Character Similarity**: Compares character-by-character matches

### AI Model

- **Model**: GPT-4o-mini
- **Temperature**: 0.7 (for more diverse rewrites)
- **Specialized Prompt**: Optimized for Korean news clickbait removal

## Development

### Backend

```bash
cd backend
npm install
npm run dev    # Development mode with hot reload
npm run build  # Build for production
npm start      # Run production build
```

### Extension

1. Make changes to extension files
2. Go to `chrome://extensions/`
3. Click the reload button on the extension card
4. Refresh the target webpage

## License

See [LICENSE](LICENSE).
