// Content script - runs on web pages matching the patterns in manifest.json

console.log('WebSquareA extension content script loaded');

// Prevent double-injection if the script is programmatically injected more than once
if (window.__websquareaContentInjected) {
  // Already injected; skip re-registering listeners
  console.debug('WebSquareA content already injected');
} else {
  window.__websquareaContentInjected = true;
}

function normalizeWhitespace(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function ensureStylesInjected() {
  if (document.getElementById('websquarea-alt-style')) return;
  const style = document.createElement('style');
  style.id = 'websquarea-alt-style';
  style.textContent = `
    .websquarea-alt-block {
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
    .websquarea-alt-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: #2563eb;
      margin-bottom: 4px;
      font-weight: 600;
    }
    .websquarea-alt-text {
      font-size: 14px;
      font-weight: 600;
    }
  `;
  document.head.appendChild(style);
}

function clearInjectedAlternatives() {
  document.querySelectorAll('.websquarea-alt-block').forEach((node) => node.remove());
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
      block.className = 'websquarea-alt-block';

      const label = document.createElement('div');
      label.className = 'websquarea-alt-label';
      label.textContent = '대안 제목';

      const text = document.createElement('div');
      text.className = 'websquarea-alt-text';
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
    'copyright', '저작권', 'all rights reserved',
    // 네이버 뉴스 특화 제외 패턴
    '언론사별', '정치', '경제', '사회', '생활/문화', 'IT/과학', '세계',
    '랭킹', '신문보기', '오피니언', 'TV', '팩트체크',
    '전체 언론사', '뉴스스탠드', '라이브러리', '구독설정',
    '구독', '블로터', '부산일보', '기자협회보', '비즈워치', '매일경제',
    '한경비즈니스', '한겨레', '시사IN', '매일신문',  // 언론사 이름 제외
    // 뉴스가 아닌 단어들
    '방송뉴스', '언론사편집', '이슈NOW', '이슈 now', '이슈 Now',
    '콘텐츠', '엔터', '스포츠', '날씨', '프리미엄',
    '알고리즘 안내', '정정보도 모음', '구독설정'
  ];
  
  // 정확히 일치하는 제외 단어들 (부분 일치가 아닌 완전 일치)
  const exactExcludeWords = [
    '방송뉴스', '언론사편집', '이슈NOW', '콘텐츠', '엔터', '스포츠', '날씨', '프리미엄'
  ];
  
  // 정확히 일치하는 단어는 무조건 제외
  for (const word of exactExcludeWords) {
    if (trimmed === word || lowerTrimmed === word.toLowerCase()) {
      return true;
    }
  }
  
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
  const seen = new Set();
  const candidates = [];

  // 1. 네이버 뉴스 기사 링크: href에 'news.naver.com/article' 포함하는 a 태그
  const allLinks = document.querySelectorAll('a[href*="news.naver.com/article"]');

  allLinks.forEach((el) => {
    // href 확인 - news.naver.com/article 포함하는지 확인
    const href = el.getAttribute('href') || '';
    if (!href.includes('news.naver.com/article')) {
      return;
    }

    // 텍스트 추출 - a 태그 안에 있는 strong 태그의 텍스트를 우선 사용, 없으면 a 태그의 텍스트 사용
    let text = '';
    
    // 1순위: a 태그 안에 있는 strong 태그의 텍스트
    const strongText = el.querySelector('strong');
    if (strongText && strongText.textContent && strongText.textContent.trim().length > 0) {
      text = normalizeWhitespace(strongText.textContent);
    }
    
    // 2순위: a 태그 안에 있는 b 태그의 텍스트
    if (!text || text.length < 8) {
      const bText = el.querySelector('b');
      if (bText && bText.textContent && bText.textContent.trim().length > 0) {
        const bTextContent = normalizeWhitespace(bText.textContent);
        if (bTextContent.length >= 8) {
          text = bTextContent;
        }
      }
    }
    
    // 3순위: a 태그의 전체 텍스트 (strong/b 태그가 없거나 짧을 때)
    // a 태그 안에 있는 모든 텍스트를 가져옴 (textContent는 HTML 엔티티를 자동 디코딩: &amp; -> &)
    if (!text || text.length < 8) {
      const aTagText = normalizeWhitespace(
        el.textContent ||
        el.innerText ||
        el.getAttribute('aria-label') ||
        el.getAttribute('title') ||
        ''
      );
      if (aTagText && aTagText.length >= 8) {
        text = aTagText;
      }
    }
    
    // 텍스트가 없으면 스킵
    if (!text || text.length < 8) return;
    
    // 부모가 strong/b인 경우
    if (el.parentElement) {
      const parent = el.parentElement;
      if ((parent.tagName === 'STRONG' || parent.tagName === 'B' || parent.tagName === 'strong' || parent.tagName === 'b')) {
        const parentText = normalizeWhitespace(parent.textContent || '');
        if (parentText.length > text.length && parentText.length >= 10) {
          text = parentText;
        }
      }
    }
    
    // 완전 제외 단어 체크
    const excludeWords = ['이슈NOW', '언론사편집', '방송뉴스', '다른 언론사 보기', '프리미엄 추천 채널', '최근 검색어', '구독설정'];
    const lowerText = text.toLowerCase();
    for (const word of excludeWords) {
      if (lowerText.includes(word.toLowerCase())) {
        return; // 완전 제외
      }
    }
    
    // 제목에서 언론사 이름과 시간 정보 제거
    if (text) {
      text = text.replace(/^_?[가-힣a-zA-Z0-9\s]+_\s*\d+월\s*\d+일\s*\d+:\d+\s*/g, '');
      text = text.replace(/^[가-힣a-zA-Z0-9\s]+\s+\d+월\s*\d+일\s*\d+:\d+\s*/g, '');
      text = normalizeWhitespace(text);
    }
    
    // 최소 길이 체크
    if (!text || text.length < 10) return;
    
    // 중복 제거
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    const articleText = extractArticleTextFromElement(el);

    candidates.push({
      id: candidates.length,
      original: text,
      context: articleText,
      source: describeSource(el),
      el: includeElements ? el : undefined,
      priority: 1
    });
  });

  // 2. cnf_news_title 클래스를 가진 요소의 텍스트
  const cnfTitleElements = document.querySelectorAll('.cnf_news_title');

  cnfTitleElements.forEach((el) => {
    // strong 태그 안에 있는 경우 strong 태그의 텍스트 우선 사용
    let text = '';
    if (el.tagName === 'STRONG' || el.tagName === 'strong') {
      // textContent는 HTML 엔티티를 자동으로 디코딩함 (&amp; -> &)
      text = normalizeWhitespace(el.textContent || el.innerText || '');
    } else {
      // cnf_news_title 클래스를 가진 요소 내부의 strong 태그 우선
      const strongText = el.querySelector('strong');
      if (strongText && strongText.textContent && strongText.textContent.trim().length > 0) {
        text = normalizeWhitespace(strongText.textContent);
      } else {
        text = normalizeWhitespace(
          el.textContent ||
          el.innerText ||
          el.getAttribute('aria-label') ||
          el.getAttribute('title') ||
          ''
        );
      }
    }
    
    // 텍스트가 없으면 스킵
    if (!text || text.length < 8) return;

    // 완전 제외 단어 체크
    const excludeWords = ['이슈NOW', '언론사편집', '방송뉴스', '다른 언론사 보기', '프리미엄 추천 채널', '최근 검색어', '구독설정'];
    const lowerText = text.toLowerCase();
    for (const word of excludeWords) {
      if (lowerText.includes(word.toLowerCase())) {
        return; // 완전 제외
      }
    }

    // 제목에서 언론사 이름과 시간 정보 제거
    if (text) {
      text = text.replace(/^_?[가-힣a-zA-Z0-9\s]+_\s*\d+월\s*\d+일\s*\d+:\d+\s*/g, '');
      text = text.replace(/^[가-힣a-zA-Z0-9\s]+\s+\d+월\s*\d+일\s*\d+:\d+\s*/g, '');
      text = normalizeWhitespace(text);
    }

    // 최소 길이 체크
    if (!text || text.length < 10) return;

    // 중복 제거
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    const articleText = extractArticleTextFromElement(el);

    candidates.push({
      id: candidates.length,
      original: text,
      context: articleText,
      source: describeSource(el),
      el: includeElements ? el : undefined,
      priority: 1
    });
  });

  // 3. cc_clip_t 클래스를 가진 요소의 텍스트
  const ccClipElements = document.querySelectorAll('.cc_clip_t');

  ccClipElements.forEach((el) => {
    // 텍스트 추출
    let text = normalizeWhitespace(
      el.textContent ||
      el.innerText ||
      el.getAttribute('aria-label') ||
      el.getAttribute('title') ||
      ''
    );

    // 텍스트가 없으면 스킵
    if (!text || text.length < 8) return;

    // 완전 제외 단어 체크
    const excludeWords = ['이슈NOW', '언론사편집', '방송뉴스', '다른 언론사 보기', '프리미엄 추천 채널', '최근 검색어', '구독설정'];
    const lowerText = text.toLowerCase();
    for (const word of excludeWords) {
      if (lowerText.includes(word.toLowerCase())) {
        return; // 완전 제외
      }
    }

    // 제목에서 언론사 이름과 시간 정보 제거
    if (text) {
      text = text.replace(/^_?[가-힣a-zA-Z0-9\s]+_\s*\d+월\s*\d+일\s*\d+:\d+\s*/g, '');
      text = text.replace(/^[가-힣a-zA-Z0-9\s]+\s+\d+월\s*\d+일\s*\d+:\d+\s*/g, '');
      text = normalizeWhitespace(text);
    }

    // 최소 길이 체크
    if (!text || text.length < 10) return;

    // 중복 제거
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    const articleText = extractArticleTextFromElement(el);

    candidates.push({
      id: candidates.length,
      original: text,
      context: articleText,
      source: describeSource(el),
      el: includeElements ? el : undefined,
      priority: 1
    });
  });

  // Return candidates
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

    // Retry once after a short delay to allow dynamic content to render (e.g., Google News, Naver News)
    // 네이버 뉴스는 동적 로딩이 많으므로 재시도 시간을 늘림
    setTimeout(() => {
      const retryCandidates = collectTitleCandidates(true);
      lastCandidates = retryCandidates;
      const retryTitles = retryCandidates.map(({ id, original, source, context }) => ({ id, original, source, context }));
      sendResponse({ titles: retryTitles });
    }, 1200); // 네이버 뉴스는 800ms → 1200ms로 증가
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
