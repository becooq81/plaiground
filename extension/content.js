// Content script - runs on web pages matching the patterns in manifest.json

console.log('Plaiground extension content script loaded');

// Prevent double-injection if the script is programmatically injected more than once
if (window.__plaigroundContentInjected) {
  // Already injected; skip re-registering listeners
  console.debug('Plaiground content already injected');
} else {
  window.__plaigroundContentInjected = true;
}

function normalizeWhitespace(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function ensureStylesInjected() {
  if (document.getElementById('plaiground-alt-style')) return;
  const style = document.createElement('style');
  style.id = 'plaiground-alt-style';
  style.textContent = `
    .plaiground-alt-block {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin-top: 4px;
      padding: 6px 8px;
      background: #eff6ff;
      border: 1px solid #3b82f6;
      border-left-width: 3px;
      border-radius: 6px;
      color: #111827;
      line-height: 1.4;
    }
    .plaiground-alt-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: #2563eb;
      margin-bottom: 4px;
      font-weight: 600;
    }
    .plaiground-alt-text {
      font-size: 14px;
      font-weight: 600;
    }
  `;
  document.head.appendChild(style);
}

function clearInjectedAlternatives() {
  document.querySelectorAll('.plaiground-alt-block').forEach((node) => node.remove());
}

function injectAlternatives(candidates) {
  ensureStylesInjected();
  clearInjectedAlternatives();

  candidates.forEach(({ alternative, el }) => {
    if (!el || !el.parentNode || !alternative) return;
    
    // Find the best insertion point
    // For Google News and similar sites, we want to insert after the headline's container
    // Try to find a parent article/item container, or use the element itself
    let insertTarget = el;
    
    // If the element is a link, try to find its parent container (article item, card, etc.)
    if (el.tagName === 'A' || el.tagName === 'a') {
      const parent = el.parentElement;
      // Look for common article/item container classes
      if (parent && (
        parent.classList.toString().match(/article|item|card|story|entry|post/i) ||
        parent.getAttribute('role') === 'article' ||
        parent.tagName === 'ARTICLE'
      )) {
        insertTarget = parent;
      } else {
        // If no clear container, try the next sibling or parent
        insertTarget = el;
      }
    }
    
    // Ensure we have a valid parent
    if (!insertTarget.parentNode) return;
    
    const block = document.createElement('div');
    block.className = 'plaiground-alt-block';

    const label = document.createElement('div');
    label.className = 'plaiground-alt-label';
    label.textContent = 'Alternative';

    const text = document.createElement('div');
    text.className = 'plaiground-alt-text';
    text.textContent = alternative;

    block.appendChild(label);
    block.appendChild(text);

    // Insert after the target element
    insertTarget.insertAdjacentElement('afterend', block);
  });
}

function extractArticleTextFromElement(element) {
  const article = element.closest('article') || document.querySelector('article');
  if (!article) return '';

  const paragraphs = Array.from(article.querySelectorAll('p'))
    .map((p) => normalizeWhitespace(p.innerText || ''))
    .filter(Boolean);

  return paragraphs.join(' ');
}

function describeSource(element) {
  const tag = element.tagName ? element.tagName.toLowerCase() : 'element';
  const section = element.closest('section, article, main');
  if (section && section.id) return `${tag} (#${section.id})`;
  if (section && section.className) return `${tag} (.${section.className.split(' ').filter(Boolean).join('.')})`;
  return tag;
}

let lastCandidates = [];

// Simple check: exclude specific UI text from being recognized as titles
function shouldExclude(el, text) {
  const trimmed = text.trim();
  const lowerTrimmed = trimmed.toLowerCase();
  
  // Exclude "Google 앱"
  if (trimmed === 'Google 앱') {
    return true;
  }
  
  // Exclude "관련 콘텐츠" (Related Content)
  if (trimmed === '관련 콘텐츠') {
    return true;
  }
  
  // Exclude "google 계정" (Google account) - case insensitive
  if (lowerTrimmed === 'google 계정' || lowerTrimmed.includes('google 계정')) {
    return true;
  }
  
  return false;
}

function collectTitleCandidates(includeElements = false) {
  const selectors = [
    'article h1',
    'article h2',
    'article h3',
    'article h4',
    'main h1',
    'main h2',
    'main h3',
    'main h4',
    '[role="main"] h1',
    '[role="main"] h2',
    '[role="main"] h3',
    '[role="main"] h4',
    'h1',
    'h2',
    'h3',
    'h4',
    '[role="heading"]',
    '[aria-level]',
    'header h1',
    'header h2',
    'header h3',
    'header h4',
    'a[role="heading"]',
    'a[aria-label]',
    'a[jsname][href]',
    'a[class*="DY5T1d"]',
    'a[class*="JtKRv"]',
    'a[aria-label][href]',
    'span[class*="DY5T1d"]',
    'div[class*="DY5T1d"]',
    // Korean news sites specific selectors
    '.article-title',
    '.news-title',
    '.headline',
    '[class*="title"]',
    '[class*="headline"]',
    '[id*="title"]',
    '[id*="headline"]'
  ];

  const seen = new Set();
  const candidates = [];

  // Helper to check if element is in main content area
  const isInMainContent = (el) => {
    const main = el.closest('main, article, [role="main"], [role="article"]');
    if (main) return true;
    // Check for common content container classes/ids
    const contentContainer = el.closest('[class*="content"], [class*="article"], [class*="post"], [id*="content"], [id*="article"]');
    return !!contentContainer;
  };

  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((el) => {
      // Get text from the element, prioritizing textContent for better extraction
      let text = normalizeWhitespace(
        el.textContent ||
        el.innerText ||
        el.getAttribute('aria-label') ||
        el.getAttribute('title') ||
        ''
      );
      
      // If text is still empty, try getting from first child text node
      if (!text && el.firstChild && el.firstChild.nodeType === Node.TEXT_NODE) {
        text = normalizeWhitespace(el.firstChild.textContent || '');
      }
      
      if (!text || text.length < 8) return;
      
      // Exclude "Google 앱"
      if (shouldExclude(el, text)) return;
      
      const key = text.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);

      const articleText = extractArticleTextFromElement(el);
      const inMainContent = isInMainContent(el);

      candidates.push({
        id: candidates.length,
        original: text,
        context: articleText,
        source: describeSource(el),
        el: includeElements ? el : undefined,
        priority: inMainContent ? 1 : 0 // Prioritize main content headlines
      });
    });
  });

  // Sort by priority (main content first), then by selector order
  candidates.sort((a, b) => (b.priority || 0) - (a.priority || 0));

  // Fallbacks if we found nothing: use document title or meta titles
  if (!candidates.length) {
    const fallbackTitles = [];
    if (document.title && document.title.length > 8) {
      fallbackTitles.push(document.title);
    }
    const og = document.querySelector('meta[property="og:title"]')?.content;
    if (og && og.length > 8) fallbackTitles.push(og);
    const tw = document.querySelector('meta[name="twitter:title"]')?.content;
    if (tw && tw.length > 8) fallbackTitles.push(tw);

    fallbackTitles.forEach((t) => {
      const text = normalizeWhitespace(t);
      const key = text.toLowerCase();
      if (seen.has(key) || text.length < 8) return;
      if (shouldExclude(null, text)) return; // Check exclusion for fallbacks too
      seen.add(key);
      candidates.push({
        id: candidates.length,
        original: text,
        context: '',
        source: 'document-title',
        el: includeElements ? document.querySelector('title') : undefined
      });
    });
  }

  return candidates.slice(0, 12);
}

// Listen for messages from popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fromPopup') {
    sendResponse({ status: 'content script received message' });
    return true;
  }

  if (request.action === 'analyzeNewsTitles') {
    const candidates = collectTitleCandidates(true);
    lastCandidates = candidates;
    const titles = candidates.map(({ id, original, source, context }) => ({ id, original, source, context }));

    if (titles.length) {
      sendResponse({ titles });
      return true;
    }

    // Retry once after a short delay to allow dynamic content to render (e.g., Google News)
    setTimeout(() => {
      const retryCandidates = collectTitleCandidates(true);
      lastCandidates = retryCandidates;
      const retryTitles = retryCandidates.map(({ id, original, source, context }) => ({ id, original, source, context }));
      sendResponse({ titles: retryTitles });
    }, 800);
    return true; // keep the message channel open
  }

  if (request.action === 'injectRewrites') {
    const rewrites = request.rewrites || [];
    
    // Re-collect candidates to ensure we have fresh element references
    // This is important because the DOM might have changed or elements might have been replaced
    const freshCandidates = collectTitleCandidates(true);
    
    const merged = rewrites
      .map((rw) => {
        if (!rw.original || !rw.alternative) return null;
        
        // Prioritize matching by original text (most reliable)
        // This ensures we match the correct title even if IDs are out of sync
        let target = freshCandidates.find((c) => {
          const normalizedOriginal = normalizeWhitespace(c.original || '');
          const normalizedRw = normalizeWhitespace(rw.original || '');
          return normalizedOriginal === normalizedRw || 
                 normalizedOriginal.toLowerCase() === normalizedRw.toLowerCase();
        });
        
        // Fallback to ID matching if text match fails
        if (!target) {
          target = freshCandidates.find((c) => c.id === rw.id);
        }
        
        // Last resort: try lastCandidates
        if (!target) {
          target = lastCandidates.find((c) => {
            const normalizedOriginal = normalizeWhitespace(c.original || '');
            const normalizedRw = normalizeWhitespace(rw.original || '');
            return normalizedOriginal === normalizedRw || 
                   normalizedOriginal.toLowerCase() === normalizedRw.toLowerCase();
          }) || lastCandidates.find((c) => c.id === rw.id);
        }
        
        if (!target || !target.el || !rw.alternative) return null;
        
        // Verify the element is still in the DOM
        if (!target.el.parentNode) {
          // Try to re-find the element by text content
          const textMatch = Array.from(document.querySelectorAll('*')).find(node => {
            const nodeText = normalizeWhitespace(node.innerText || '');
            const targetText = normalizeWhitespace(target.original || '');
            return nodeText === targetText || 
                   (nodeText.length > 10 && targetText.length > 10 && nodeText.includes(targetText));
          });
          if (textMatch) {
            target.el = textMatch;
          } else {
            return null;
          }
        }
        
        return { ...target, alternative: rw.alternative };
      })
      .filter(Boolean);

    if (merged.length) {
      injectAlternatives(merged);
    }

    sendResponse({ status: 'injected', count: merged.length });
    return true;
  }

  return false;
});
