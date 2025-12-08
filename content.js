// Content script - runs on web pages matching the patterns in manifest.json

console.log('Plaiground extension content script loaded');

// Prevent double-injection if the script is programmatically injected more than once
if (window.__plaigroundContentInjected) {
  // Already injected; skip re-registering listeners
  console.debug('Plaiground content already injected');
} else {
  window.__plaigroundContentInjected = true;

const CLICKBAIT_PHRASES = [
  /won'?t believe/i,
  /shocking/i,
  /you need to see/i,
  /what happens next/i,
  /one weird trick/i,
  /literally everyone/i,
  /goes viral/i,
  /will change your life/i,
  /breaks the internet/i
];

const CLICKBAIT_WORDS = [
  'unbelievable',
  'jaw-dropping',
  'mind-blowing',
  'insane',
  'crazy',
  'stunning',
  'epic',
  'ultimate',
  'secret',
  'exclusive',
  'must-see',
  'viral',
  '쏟아냈다'
];

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
      background: #f5f5f7;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      color: #111827;
      line-height: 1.4;
    }
    .plaiground-alt-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: #6b7280;
      margin-bottom: 4px;
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

    el.insertAdjacentElement('afterend', block);
  });
}

function firstSentence(text) {
  const cleaned = normalizeWhitespace(text);
  const match = cleaned.match(/([^.!?]{15,}?[.!?])\s/);
  return match ? match[1].trim() : cleaned.slice(0, 160).trim();
}

function cleanClickbait(title) {
  let cleaned = normalizeWhitespace(title);
  CLICKBAIT_PHRASES.forEach((re) => {
    cleaned = cleaned.replace(re, '');
  });

  CLICKBAIT_WORDS.forEach((word) => {
    const re = new RegExp(`\\b${word}\\b`, 'ig');
    cleaned = cleaned.replace(re, '');
  });

  cleaned = cleaned.replace(/[!?]{2,}/g, '');
  cleaned = cleaned.replace(/^[^a-zA-Z0-9]+/, '').trim();

  if (!cleaned) return title.trim();

  // Capitalize first letter for readability
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
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

function generateAlternativeTitle(original, articleText) {
  const cleaned = cleanClickbait(original);
  const articleSentence = articleText ? firstSentence(articleText) : '';

  if (articleSentence && articleSentence.length > 30) {
    return articleSentence;
  }

  if (cleaned.length < 12 && articleSentence) {
    return articleSentence;
  }

  return cleaned;
}

function collectTitleCandidates(includeElements = false) {
  const selectors = [
    'article h1',
    'article h2',
    'article h3',
    'article h4',
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
    'div[class*="DY5T1d"]'
  ];

  const seen = new Set();
  const candidates = [];

  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((el) => {
      const text = normalizeWhitespace(
        el.innerText ||
        el.getAttribute('aria-label') ||
        el.getAttribute('title') ||
        ''
      );
      if (!text || text.length < 8) return;
      const key = text.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);

      const articleText = extractArticleTextFromElement(el);
      const alternative = generateAlternativeTitle(text, articleText);

      candidates.push({
        original: text,
        alternative,
        source: describeSource(el),
        el: includeElements ? el : undefined
      });
    });
  });

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
      seen.add(key);
      candidates.push({
        original: text,
        alternative: generateAlternativeTitle(text, ''),
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
    const titles = candidates.map(({ original, alternative, source }) => ({ original, alternative, source }));

    if (titles.length) {
      injectAlternatives(candidates);
      sendResponse({ titles });
      return true;
    }

    // Retry once after a short delay to allow dynamic content to render (e.g., Google News)
    setTimeout(() => {
      const retryCandidates = collectTitleCandidates(true);
      const retryTitles = retryCandidates.map(({ original, alternative, source }) => ({ original, alternative, source }));
      if (retryTitles.length) {
        injectAlternatives(retryCandidates);
      }
      sendResponse({ titles: retryTitles });
    }, 800);
    return true; // keep the message channel open
  }

  return false;
});

}