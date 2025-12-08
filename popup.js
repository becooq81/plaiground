// Popup script - runs when the extension popup is opened

document.addEventListener('DOMContentLoaded', function() {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const statusDiv = document.getElementById('status');
  const titlesList = document.getElementById('titlesList');

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

      renderTitles(titles);
      setStatus(`Found ${titles.length} headline${titles.length === 1 ? '' : 's'}.`, 'success');
    } catch (error) {
      console.error('Analysis error:', error);
      setStatus('Unable to analyze this page. Try reloading and ensure content scripts are allowed.', 'error');
    }
  }

  analyzeBtn.addEventListener('click', analyzeCurrentPage);

  // Run immediately on open
  analyzeCurrentPage();
});

