// Popup script - runs when the extension popup is opened

document.addEventListener('DOMContentLoaded', function() {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const statusDiv = document.getElementById('status');
  const titlesList = document.getElementById('titlesList');
  const API_URL = 'http://localhost:4000/api/rewrite';

  function setStatus(message, variant = '') {
    statusDiv.textContent = message;
    statusDiv.className = `status${variant ? ' ' + variant : ''}`;
  }

  function renderTitles(titles) {
    titlesList.innerHTML = '';
    titles.forEach(({ original, alternative, source }) => {
      const li = document.createElement('li');
      li.className = 'title-item';
      li.innerHTML = `
        <div class="label">Alternative</div>
        <div class="alternative">${alternative}</div>
        <div class="original">Original: ${original}</div>
        <div class="source">Source: ${source}</div>
      `;
      titlesList.appendChild(li);
    });
  }

  async function rewriteWithBackend(titles) {
    const payload = {
      titles: titles.map((t) => t.original),
      context: titles
        .map((t) => t.context || '')
        .filter(Boolean)
        .slice(0, 3)
        .join('\n')
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
        // Fallback: inject content script into this tab, then retry once
        await chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          files: ['content.js']
        });
        response = await sendAnalyzeMessage(tab.id);
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

      const rewrites = titles.map((t, idx) => ({
        id: t.id,
        original: t.original,
        source: t.source,
        alternative: rewritten[idx] || t.original
      }));

      // Inject back into the page
      chrome.tabs.sendMessage(
        tab.id,
        { action: 'injectRewrites', rewrites: rewrites.map(({ id, alternative }) => ({ id, alternative })) },
        () => {
          // ignore errors; best-effort injection
        }
      );

      renderTitles(rewrites);
      setStatus(`Rewrote ${rewrites.length} headline${rewrites.length === 1 ? '' : 's'}.`, 'success');
    } catch (error) {
      console.error('Analysis error:', error);
      setStatus('Unable to analyze this page. Try reloading and ensure content scripts are allowed.', 'error');
    }
  }

  analyzeBtn.addEventListener('click', analyzeCurrentPage);

  // Run immediately on open
  analyzeCurrentPage();
});

