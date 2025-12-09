// Popup script - runs when the extension popup is opened

document.addEventListener('DOMContentLoaded', function() {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const statusDiv = document.getElementById('status');
  const titlesList = document.getElementById('titlesList');
  const gameModeToggle = document.getElementById('gameModeToggle');
  const gameModeContainer = document.getElementById('gameModeContainer');
  const gameScoreEl = document.getElementById('gameScore');
  const gameCorrectEl = document.getElementById('gameCorrect');
  const gameAttemptsEl = document.getElementById('gameAttempts');
  
  // Configure your backend API URL here
  // For local development: 'http://localhost:4000/api/rewrite'
  // For production: 'https://your-api-domain.com/api/rewrite'
  const API_URL = 'http://localhost:4000/api/rewrite';

  // Game state
  let gameState = {
    score: 0,
    correct: 0,
    attempts: 0,
    currentRewrites: []
  };

  // Load game mode preference from storage
  chrome.storage.local.get(['gameMode'], (result) => {
    if (result.gameMode) {
      gameModeToggle.checked = true;
      toggleGameMode(true);
    }
  });

  function setStatus(message, variant = '') {
    statusDiv.textContent = message;
    statusDiv.className = `status${variant ? ' ' + variant : ''}`;
  }

  function updateGameStats() {
    gameScoreEl.textContent = gameState.score;
    gameCorrectEl.textContent = gameState.correct;
    gameAttemptsEl.textContent = gameState.attempts;
  }

  function toggleGameMode(enabled) {
    if (enabled) {
      gameModeContainer.style.display = 'block';
      updateGameStats();
    } else {
      gameModeContainer.style.display = 'none';
    }
    chrome.storage.local.set({ gameMode: enabled });
  }

  // Text similarity function using Levenshtein distance and word overlap
  function calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    const s1 = str1.trim().toLowerCase();
    const s2 = str2.trim().toLowerCase();
    
    if (s1 === s2) return 100;
    
    // Levenshtein distance
    const maxLen = Math.max(s1.length, s2.length);
    if (maxLen === 0) return 100;
    
    const distance = levenshteinDistance(s1, s2);
    const levenshteinScore = (1 - distance / maxLen) * 50;
    
    // Word overlap score
    const words1 = s1.split(/\s+/).filter(w => w.length > 0);
    const words2 = s2.split(/\s+/).filter(w => w.length > 0);
    const allWords = new Set([...words1, ...words2]);
    const commonWords = words1.filter(w => words2.includes(w));
    const wordOverlapScore = (commonWords.length / allWords.size) * 50;
    
    // Character n-gram similarity (for partial matches)
    const charScore = characterSimilarity(s1, s2) * 20;
    
    return Math.min(100, Math.round(levenshteinScore + wordOverlapScore + charScore));
  }

  function levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  }

  function characterSimilarity(str1, str2) {
    const len = Math.min(str1.length, str2.length);
    if (len === 0) return 0;
    let matches = 0;
    for (let i = 0; i < len; i++) {
      if (str1[i] === str2[i]) matches++;
    }
    return matches / len;
  }

  function renderTitles(titles, isGameMode = false) {
    titlesList.innerHTML = '';
    gameState.currentRewrites = titles;
    
    titles.forEach(({ original, alternative, source, id }, index) => {
      const li = document.createElement('li');
      li.className = `title-item${isGameMode ? ' game-mode' : ''}`;
      li.dataset.titleId = id;
      
      if (isGameMode) {
        // Store original title in data attribute for reliable access
        li.dataset.originalTitle = original;
        
        li.innerHTML = `
          <div class="label">번역된 제목 (원본을 맞춰보세요!)</div>
          <div class="alternative">${alternative}</div>
          <div class="source">Source: ${source}</div>
          <div class="game-guess-section">
            <input type="text" 
                   class="game-guess-input" 
                   placeholder="원본 제목을 입력하세요..."
                   data-title-id="${id}">
            <div class="game-guess-buttons">
              <button class="btn-guess" data-title-id="${id}">정답 확인</button>
              <button class="btn-reveal" data-title-id="${id}">정답 보기</button>
            </div>
            <div class="game-result" id="result-${id}" style="display: none;"></div>
          </div>
        `;
        
        // Add event listeners - use data attribute to get original title
        const guessInput = li.querySelector('.game-guess-input');
        const guessBtn = li.querySelector('.btn-guess');
        const revealBtn = li.querySelector('.btn-reveal');
        const resultDiv = li.querySelector('.game-result');
        const originalTitle = original; // Capture in closure for this iteration
        
        guessInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            guessBtn.click();
          }
        });
        
        guessBtn.addEventListener('click', () => {
          const guess = guessInput.value.trim();
          if (!guess) return;
          
          // Get original title from data attribute (most reliable)
          const actualOriginal = li.dataset.originalTitle || originalTitle;
          
          const similarity = calculateSimilarity(guess, actualOriginal);
          gameState.attempts++;
          gameState.score += similarity;
          if (similarity >= 70) {
            gameState.correct++;
          }
          
          updateGameStats();
          
          resultDiv.style.display = 'block';
          resultDiv.className = `game-result ${similarity >= 70 ? 'correct' : 'incorrect'}`;
          resultDiv.innerHTML = `
            <div class="game-result-score">점수: ${similarity}점 ${similarity >= 70 ? '✅ 정답!' : '❌ 틀렸습니다'}</div>
            <div class="game-result-original">
              <div class="game-result-label">원본 제목 (실제 뉴스):</div>
              ${actualOriginal}
            </div>
          `;
          
          guessInput.disabled = true;
          guessBtn.disabled = true;
          revealBtn.disabled = true;
        });
        
        revealBtn.addEventListener('click', () => {
          // Get original title from data attribute (most reliable)
          const actualOriginal = li.dataset.originalTitle || originalTitle;
          
          resultDiv.style.display = 'block';
          resultDiv.className = 'game-result incorrect';
          resultDiv.innerHTML = `
            <div class="game-result-score">정답을 공개합니다</div>
            <div class="game-result-original">
              <div class="game-result-label">원본 제목 (실제 뉴스):</div>
              ${actualOriginal}
            </div>
          `;
          
          guessInput.disabled = true;
          guessBtn.disabled = true;
          revealBtn.disabled = true;
        });
      } else {
        li.innerHTML = `
          <div class="label">Alternative</div>
          <div class="alternative">${alternative}</div>
          <div class="original">Original: ${original}</div>
          <div class="source">Source: ${source}</div>
        `;
      }
      
      titlesList.appendChild(li);
    });
  }

  async function rewriteWithBackend(titles) {
    // Collect article context from first few titles that have it
    const contextTexts = titles
      .map((t) => t.context || '')
      .filter((ctx) => ctx && ctx.length > 20) // Only meaningful context
      .slice(0, 3)
      .join('\n\n');

    const payload = {
      titles: titles.map((t) => t.original),
      context: contextTexts || undefined
    };

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error ${res.status}: ${text}`);
    }

    const data = await res.json();
    const rewritten = Array.isArray(data.rewritten) ? data.rewritten : [];
    return rewritten;
  }

  async function sendAnalyzeMessage(tabId) {
    return await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { action: 'analyzeNewsTitles' }, (response) => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message));
        }
        resolve(response);
      });
    });
  }

  async function analyzeCurrentPage() {
    setStatus('Analyzing page titles...', '');
    titlesList.innerHTML = '';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) throw new Error('No active tab found');

      let response;
      try {
        // First attempt: assumes content script already loaded
        response = await sendAnalyzeMessage(tab.id);
      } catch (err) {
        console.log('Content script not found, injecting...', err);
        // Fallback: inject content script into this tab, then retry once
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id, allFrames: true },
            files: ['content.js']
          });
          // Wait a bit for script to initialize
          await new Promise(resolve => setTimeout(resolve, 100));
          response = await sendAnalyzeMessage(tab.id);
        } catch (injectErr) {
          console.error('Failed to inject content script:', injectErr);
          throw new Error('Could not inject content script. Make sure the extension has scripting permissions.');
        }
      }

      const titles = response?.titles || [];
      if (!titles.length) {
        setStatus('No news-style titles detected on this page.', 'error');
        return;
      }

      setStatus('Rewriting with AI...', '');
      let rewritten = [];
      try {
        rewritten = await rewriteWithBackend(titles);
      } catch (err) {
        console.error('Rewrite error:', err);
        setStatus('Rewrite failed; showing originals.', 'error');
        rewritten = titles.map((t) => t.original);
      }

      const rewrites = titles.map((t, idx) => {
        // Ensure we're using the actual original title from the page
        const actualOriginal = t.original || '';
        return {
          id: t.id,
          original: actualOriginal, // 실제 뉴스 사이트에서 가져온 원본 제목
          source: t.source,
          alternative: rewritten[idx] || actualOriginal
        };
      });
      
      // Debug: Log to verify original titles are being captured
      if (gameModeToggle.checked) {
        console.log('게임 모드 - 원본 제목들:', rewrites.map(r => ({ id: r.id, original: r.original })));
      }

      const isGameMode = gameModeToggle.checked;

      // Inject back into the page
      chrome.tabs.sendMessage(
        tab.id,
        { 
          action: 'injectRewrites', 
          rewrites: rewrites.map(({ id, original, alternative }) => ({ id, original, alternative })),
          gameMode: isGameMode
        },
        () => {
          // ignore errors; best-effort injection
        }
      );

      renderTitles(rewrites, isGameMode);
      
      if (isGameMode) {
        setStatus(`게임 모드: ${rewrites.length}개 제목이 번역되었습니다. 원본을 맞춰보세요!`, 'success');
      } else {
        setStatus(`Rewrote ${rewrites.length} headline${rewrites.length === 1 ? '' : 's'}.`, 'success');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      setStatus('Unable to analyze this page. Try reloading and ensure content scripts are allowed.', 'error');
    }
  }

  analyzeBtn.addEventListener('click', analyzeCurrentPage);
  
  gameModeToggle.addEventListener('change', (e) => {
    toggleGameMode(e.target.checked);
    // Reset game stats when toggling
    if (e.target.checked) {
      gameState = { score: 0, correct: 0, attempts: 0, currentRewrites: [] };
      updateGameStats();
    }
    // Re-analyze if we already have results
    if (gameState.currentRewrites.length > 0) {
      analyzeCurrentPage();
    }
  });

  // Run immediately on open
  analyzeCurrentPage();
});

