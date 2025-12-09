// Content script - runs on web pages matching the patterns in manifest.json

console.log('NewTox extension content script loaded');

// Prevent double-injection if the script is programmatically injected more than once
if (window.__newtoxContentInjected) {
  // Already injected; skip re-registering listeners
  console.debug('NewTox content already injected');
} else {
  window.__newtoxContentInjected = true;
}

function normalizeWhitespace(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function ensureStylesInjected() {
  if (document.getElementById('newtox-alt-style')) return;
  const style = document.createElement('style');
  style.id = 'newtox-alt-style';
  style.textContent = `
    .newtox-alt-block {
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
    .newtox-alt-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: #2563eb;
      margin-bottom: 4px;
      font-weight: 600;
    }
    .newtox-alt-text {
      font-size: 14px;
      font-weight: 600;
    }
  `;
  document.head.appendChild(style);
}

function clearInjectedAlternatives() {
  document.querySelectorAll('.newtox-alt-block').forEach((node) => node.remove());
  // Restore original titles if they were replaced in game mode
  document.querySelectorAll('[data-original-title]').forEach((el) => {
    const original = el.dataset.originalTitle;
    if (original) {
      if (el.tagName === 'A' || el.tagName === 'a') {
        el.textContent = original;
        if (el.title) el.title = original;
        if (el.getAttribute('aria-label')) el.setAttribute('aria-label', original);
      } else {
        el.textContent = original;
      }
      el.style.borderBottom = '';
      el.style.paddingBottom = '';
      delete el.dataset.originalTitle;
    }
  });
}

function injectAlternatives(candidates, gameMode = false) {
  ensureStylesInjected();
  clearInjectedAlternatives();

  candidates.forEach(({ alternative, el, original }) => {
    if (!el || !el.parentNode || !alternative) return;
    
    if (gameMode) {
      // Game mode: Replace the original title completely
      // Store original in data attribute for potential restoration
      if (!el.dataset.originalTitle) {
        el.dataset.originalTitle = original || el.textContent;
      }
      
      // Replace the text content
      if (el.tagName === 'A' || el.tagName === 'a') {
        // For links, update both text and title/aria-label if present
        el.textContent = alternative;
        if (el.title) el.title = alternative;
        if (el.getAttribute('aria-label')) el.setAttribute('aria-label', alternative);
      } else {
        el.textContent = alternative;
      }
      
      // Add a visual indicator that this is a game mode replacement
      el.style.borderBottom = '2px dashed #3b82f6';
      el.style.paddingBottom = '2px';
    } else {
      // Normal mode: Show alternative below the original
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
      block.className = 'newtox-alt-block';

      const label = document.createElement('div');
      label.className = 'newtox-alt-label';
      label.textContent = 'Alternative';

      const text = document.createElement('div');
      text.className = 'newtox-alt-text';
      text.textContent = alternative;

      block.appendChild(label);
      block.appendChild(text);

      // Insert after the target element
      insertTarget.insertAdjacentElement('afterend', block);
    }
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
  
  // Exclude navigation and UI elements
  const excludePatterns = [
    '로그인', '회원가입', '검색', '메뉴', '닫기', '공유',
    '댓글', '좋아요', '구독', '알림', '설정', '더보기',
    '이전', '다음', '이전글', '다음글', '목록', '목차',
    '홈', '홈으로', '맨위로', 'top', 'bottom',
    'copyright', '저작권', 'all rights reserved'
  ];
  
  for (const pattern of excludePatterns) {
    if (lowerTrimmed.includes(pattern.toLowerCase())) {
      // Check if it's in a navigation or header element
      const isNavElement = el.closest('nav, header, footer, [role="navigation"], [role="banner"], [role="contentinfo"]');
      if (isNavElement) {
        return true;
      }
    }
  }
  
  // Exclude if element is in navigation, header, or footer
  const parent = el.closest('nav, header, footer, .nav, .header, .footer, [role="navigation"], [role="banner"], [role="contentinfo"]');
  if (parent && trimmed.length < 20) {
    // Short text in nav/header/footer is likely not a news title
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
    '[id*="headline"]',
    // 머니투데이 및 한국 뉴스 사이트 특화 선택자
    'a[href*="/view/"]',  // 뉴스 기사 링크
    'a[href*="/news/"]',  // 뉴스 섹션 링크
    'li a[href]',  // 리스트 아이템 안의 링크
    'ul li a',  // 리스트의 링크
    'ol li a',  // 순서 있는 리스트의 링크
    '.list-item a',  // 리스트 아이템 클래스
    '[class*="list"] a[href]',  // 리스트 관련 클래스의 링크
    'h3 a',  // h3 안의 링크
    'h2 a',  // h2 안의 링크
    'h4 a',  // h4 안의 링크
    'strong a[href]',  // strong 태그 안의 링크
    'b a[href]',  // b 태그 안의 링크
    'dt a[href]',  // 정의 목록의 링크
    'dd a[href]'  // 정의 목록 설명의 링크
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
      
      // For link elements, try to get text from direct children or the link itself
      if ((!text || text.length < 8) && (el.tagName === 'A' || el.tagName === 'a')) {
        // Try getting text from first text node or first child element
        const firstTextNode = Array.from(el.childNodes).find(node => 
          node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0
        );
        if (firstTextNode) {
          text = normalizeWhitespace(firstTextNode.textContent);
        } else if (el.firstElementChild) {
          // If link contains an element (like strong, span), get its text
          text = normalizeWhitespace(el.firstElementChild.textContent || el.firstElementChild.innerText);
        }
      }
      
      // If text is still empty, try getting from first child text node
      if (!text && el.firstChild && el.firstChild.nodeType === Node.TEXT_NODE) {
        text = normalizeWhitespace(el.firstChild.textContent || '');
      }
      
      // For heading elements that might contain links, extract the link text
      if ((!text || text.length < 8) && /^H[1-6]$/i.test(el.tagName)) {
        const link = el.querySelector('a');
        if (link) {
          text = normalizeWhitespace(link.textContent || link.innerText);
        }
      }
      
      if (!text || text.length < 8) return;
      
      // Exclude navigation and UI elements
      if (shouldExclude(el, text)) return;
      
      // Exclude very short or very long texts that are likely not titles
      if (text.length < 10 || text.length > 200) return;
      
      // Exclude texts that look like navigation (contain only symbols or very short)
      if (/^[^\w가-힣]+$/.test(text)) return;
      
      const key = text.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);

      const articleText = extractArticleTextFromElement(el);
      const inMainContent = isInMainContent(el);
      
      // Higher priority for links that look like news articles
      let priority = inMainContent ? 1 : 0;
      if (el.tagName === 'A' || el.tagName === 'a') {
        const href = el.getAttribute('href') || '';
        // Boost priority for links that look like news articles
        if (href.includes('/view/') || href.includes('/news/') || href.includes('/article/')) {
          priority = 2;
        } else if (href.includes('http') && !href.includes('#') && !href.includes('javascript:')) {
          priority = 1;
        }
      }

      candidates.push({
        id: candidates.length,
        original: text,
        context: articleText,
        source: describeSource(el),
        el: includeElements ? el : undefined,
        priority: priority
      });
    });
  });

  // Sort by priority (higher priority first), then by text length (longer titles are usually more important)
  candidates.sort((a, b) => {
    const priorityDiff = (b.priority || 0) - (a.priority || 0);
    if (priorityDiff !== 0) return priorityDiff;
    return (b.original.length || 0) - (a.original.length || 0);
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

  // Return more candidates for better coverage (especially for news sites with many headlines)
  return candidates.slice(0, 20);
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
    const gameMode = request.gameMode || false;
    
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
        
        return { ...target, alternative: rw.alternative, original: rw.original };
      })
      .filter(Boolean);

    if (merged.length) {
      injectAlternatives(merged, gameMode);
    }

    sendResponse({ status: 'injected', count: merged.length, gameMode });
    return true;
  }

  return false;
});
