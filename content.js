(function() {
  'use strict';

  let currentCard = null;
  let currentTooltip = null;
  let currentBackdrop = null;
  let currentHighlight = null;
  let knownWords = {};
  let isScanning = false;

  function init() {
    document.addEventListener('dblclick', handleDoubleClick);
    document.addEventListener('click', handleClick);
    document.addEventListener('scroll', removeTooltip, true);
    loadKnownWords().then(() => scanAndMark());
  }

  async function loadKnownWords() {
    try {
      const words = await sendMessage({ type: 'GET_KNOWN_WORDS' });
      knownWords = {};
      words.forEach(item => {
        knownWords[item.word.toLowerCase()] = item.records;
      });
    } catch (e) {
      console.warn('WordTranslator: failed to load known words', e);
    }
  }

  function sendMessage(msg) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(msg, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
  }

  function getWordAtPoint(x, y) {
    const range = document.caretRangeFromPoint(x, y);
    if (!range) return null;

    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return null;

    const text = node.textContent;
    const offset = range.startOffset;

    if (offset >= text.length) return null;

    const wordRe = /[\w'-]+/g;
    let match;
    while ((match = wordRe.exec(text)) !== null) {
      if (offset >= match.index && offset <= match.index + match[0].length) {
        return {
          word: match[0],
          textNode: node,
          startIndex: match.index,
          endIndex: match.index + match[0].length
        };
      }
    }
    return null;
  }

  function findBlockContainer(node) {
    const blockTags = new Set(['P', 'DIV', 'LI', 'TD', 'TH', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SECTION', 'ARTICLE', 'BLOCKQUOTE', 'PRE', 'BLOCKQUOTE']);
    let el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    while (el && el !== document.body) {
      if (blockTags.has(el.tagName) || el.hasAttribute('data-wt-block')) {
        return el;
      }
      el = el.parentElement;
    }
    return node.nodeType === Node.TEXT_NODE ? (node.parentElement || node) : node;
  }

  function extractContextSentence(fullText, word) {
    if (!fullText || !word) return '';

    const lowerText = fullText.toLowerCase();
    const lowerWord = word.toLowerCase();

    let idx = lowerText.indexOf(lowerWord);
    if (idx === -1) {
      idx = lowerText.indexOf(lowerWord.replace(/[.,!?;:'"()]+/g, ''));
      if (idx === -1) {
        const start = Math.max(0, fullText.length / 2 - 200);
        return fullText.substring(start, Math.min(fullText.length, start + 500));
      }
    }

    const wordEnd = idx + word.length;
    const delimRe = /[.!?。！？\n](?=\s|$)/gi;

    let sentenceStart = 0;
    const beforeText = fullText.substring(0, wordEnd);
    let lastDelim = 0;
    let m;
    while ((m = delimRe.exec(beforeText)) !== null) {
      lastDelim = m.index + 1;
    }
    if (lastDelim > 0) {
      sentenceStart = lastDelim;
      while (sentenceStart < fullText.length && fullText[sentenceStart] === ' ') {
        sentenceStart++;
      }
    }

    let sentenceEnd = fullText.length;
    delimRe.lastIndex = wordEnd;
    const nextDelim = delimRe.exec(fullText);
    if (nextDelim) {
      sentenceEnd = nextDelim.index + 1;
    }

    let sentence = fullText.substring(sentenceStart, sentenceEnd).trim();
    if (sentence.length > 500) {
      sentence = sentence.substring(0, 500);
    }
    return sentence;
  }

  function getSentenceAtNode(textNode, startIdx, endIdx) {
    const word = textNode.textContent.substring(startIdx, endIdx);
    const container = findBlockContainer(textNode);
    const fullText = (container.textContent || '').replace(/\s+/g, ' ');
    return extractContextSentence(fullText, word) || word;
  }

  function handleDoubleClick(e) {
    const info = getWordAtPoint(e.clientX, e.clientY);
    if (!info || !info.word) return;
    if (info.word.length < 2) return;
    if (/^\d+$/.test(info.word)) return;

    const word = info.word;
    const sentence = getSentenceAtNode(info.textNode, info.startIndex, info.endIndex);

    removeCard();
    removeTooltip();
    clearHighlight();

    const range = document.createRange();
    range.setStart(info.textNode, info.startIndex);
    range.setEnd(info.textNode, info.endIndex);
    const rect = range.getBoundingClientRect();

    showCard(rect, word, sentence, true);
  }

  function showCard(wordRect, word, sentence, translate) {
    removeCard();
    removeTooltip();
    clearHighlight();

    const backdrop = document.createElement('div');
    backdrop.className = 'wt-backdrop';
    document.body.appendChild(backdrop);

    const card = document.createElement('div');
    card.className = 'wt-card';

    const key = word.toLowerCase();
    const existingRecords = knownWords[key] || [];

    card.innerHTML = `
      <div class="wt-card-header">
        <div>
          <div class="wt-card-word">${escapeHtml(word)}</div>
          <div class="wt-card-record-info">${existingRecords.length > 0 ? `${existingRecords.length} record${existingRecords.length > 1 ? 's' : ''} saved` : 'First time'}</div>
        </div>
        <button class="wt-card-close">&times;</button>
      </div>
      <div class="wt-card-body">
        <div class="wt-card-field">
          <div class="wt-card-label">Sentence</div>
          <div class="wt-card-value wt-card-highlight">${escapeHtml(sentence)}</div>
        </div>
        ${translate ? `
          <div class="wt-card-loading" id="wt-translate-loading">
            <div class="wt-card-spinner"></div>
            Translating...
          </div>
          <div id="wt-translate-result" style="display:none;">
            <div class="wt-card-field">
              <div class="wt-card-label">Word meaning</div>
              <div class="wt-card-value" id="wt-word-trans"></div>
            </div>
            <div class="wt-card-field">
              <div class="wt-card-label">Sentence translation</div>
              <div class="wt-card-value" id="wt-sent-trans"></div>
            </div>
          </div>
          <div class="wt-card-error" id="wt-translate-error" style="display:none;"></div>
        ` : ''}
        ${existingRecords.length > 0 ? `
          <div class="wt-card-divider"></div>
          <div class="wt-card-field">
            <div class="wt-card-label">Previous contexts</div>
            ${existingRecords.slice(-3).reverse().map((r, i) => `
              <div class="wt-card-prev-record">
                <div class="rec-label">#${existingRecords.length - i} - ${escapeHtml(r.wordTranslation)}</div>
                <div class="rec-sentence">"${escapeHtml(r.sentence.substring(0, 80))}${r.sentence.length > 80 ? '...' : ''}"</div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
      <div class="wt-card-footer">
        <button class="wt-card-btn wt-card-btn-secondary" id="wt-btn-copy">Copy</button>
        <button class="wt-card-btn wt-card-btn-secondary" id="wt-btn-retranslate">Retry</button>
      </div>
    `;

    document.body.appendChild(card);

    const cardW = 380;
    let left = wordRect.left + wordRect.width / 2 - cardW / 2;
    let top = wordRect.bottom + 8;

    if (left + cardW > window.innerWidth - 12) {
      left = window.innerWidth - cardW - 12;
    }
    if (left < 12) left = 12;

    const cardH = Math.min(card.offsetHeight || 300, window.innerHeight - 32);
    if (top + cardH + 12 > window.innerHeight) {
      top = wordRect.top - cardH - 8;
    }
    if (top < 12) top = 12;

    card.style.left = left + 'px';
    card.style.top = top + 'px';
    card.style.maxHeight = (window.innerHeight - 24) + 'px';

    currentCard = card;
    currentBackdrop = backdrop;

    card.querySelector('.wt-card-close').addEventListener('click', (ev) => {
      ev.stopPropagation();
      removeCard();
    });

    card.querySelector('#wt-btn-copy').addEventListener('click', () => {
      const wTrans = card.querySelector('#wt-word-trans')?.textContent || '';
      const sTrans = card.querySelector('#wt-sent-trans')?.textContent || '';
      const text = `Word: ${word}\nSentence: ${sentence}\nWord Translation: ${wTrans}\nSentence Translation: ${sTrans}`;
      navigator.clipboard.writeText(text).catch(() => {});
    });

    card.querySelector('#wt-btn-retranslate').addEventListener('click', () => {
      const loadingEl = card.querySelector('#wt-translate-loading');
      const resultEl = card.querySelector('#wt-translate-result');
      const errorEl = card.querySelector('#wt-translate-error');
      if (loadingEl) loadingEl.style.display = 'flex';
      if (resultEl) resultEl.style.display = 'none';
      if (errorEl) errorEl.style.display = 'none';
      doTranslate(word, sentence, card);
    });

    if (translate) {
      doTranslate(word, sentence, card);
    }
  }

  function showHistoryCard(wordRect, word, records) {
    removeCard();
    removeTooltip();
    clearHighlight();

    const backdrop = document.createElement('div');
    backdrop.className = 'wt-backdrop';
    document.body.appendChild(backdrop);

    const card = document.createElement('div');
    card.className = 'wt-card';

    const recordsHtml = records.map((r, i) => `
      <div class="wt-card-prev-record">
        <div class="rec-label">#${i + 1} &mdash; ${escapeHtml(r.wordTranslation)}</div>
        <div class="rec-sentence">"${escapeHtml(r.sentence)}"</div>
      </div>
    `).join('');

    card.innerHTML = `
      <div class="wt-card-header">
        <div>
          <div class="wt-card-word">${escapeHtml(word)}</div>
          <div class="wt-card-record-info">${records.length} record${records.length > 1 ? 's' : ''}</div>
        </div>
        <button class="wt-card-close">&times;</button>
      </div>
      <div class="wt-card-body">
        <div class="wt-card-field">
          <div class="wt-card-label">All previous contexts</div>
          ${recordsHtml}
        </div>
      </div>
      <div class="wt-card-footer">
        <button class="wt-card-btn wt-card-btn-secondary" id="wt-btn-new">Add new context</button>
      </div>
    `;

    document.body.appendChild(card);

    const cardW = 380;
    let left = wordRect.left + wordRect.width / 2 - cardW / 2;
    let top = wordRect.bottom + 8;

    if (left + cardW > window.innerWidth - 12) {
      left = window.innerWidth - cardW - 12;
    }
    if (left < 12) left = 12;

    const cardH = Math.min(card.offsetHeight || 300, window.innerHeight - 32);
    if (top + cardH + 12 > window.innerHeight) {
      top = wordRect.top - cardH - 8;
    }
    if (top < 12) top = 12;

    card.style.left = left + 'px';
    card.style.top = top + 'px';
    card.style.maxHeight = (window.innerHeight - 24) + 'px';

    currentCard = card;
    currentBackdrop = backdrop;

    card.querySelector('.wt-card-close').addEventListener('click', (ev) => {
      ev.stopPropagation();
      removeCard();
    });

    card.querySelector('#wt-btn-new').addEventListener('click', () => {
      const sentence = getContextSentence(
        document.querySelector(`.wt-known-word[data-wt*="${escapeAttr(word)}"]`) || document.body
      );
      removeCard();
      showCard(wordRect, word, sentence, true);
    });
  }

  async function doTranslate(word, sentence, card) {
    try {
      const result = await sendMessage({
        type: 'TRANSLATE',
        word,
        sentence
      });

      const loadingEl = card.querySelector('#wt-translate-loading');
      const resultEl = card.querySelector('#wt-translate-result');
      const errorEl = card.querySelector('#wt-translate-error');
      const wordTransEl = card.querySelector('#wt-word-trans');
      const sentTransEl = card.querySelector('#wt-sent-trans');

      if (loadingEl) loadingEl.style.display = 'none';

      if (result.error) {
        if (errorEl) {
          errorEl.textContent = result.error;
          errorEl.style.display = 'block';
        }
        if (resultEl) resultEl.style.display = 'none';
      } else {
        if (wordTransEl) wordTransEl.textContent = result.wordTranslation || '';
        if (sentTransEl) sentTransEl.textContent = result.sentenceTranslation || '';
        if (resultEl) resultEl.style.display = 'block';
        if (errorEl) errorEl.style.display = 'none';
      }

      await loadKnownWords();
      const key = word.toLowerCase();
      const records = knownWords[key] || [];
      const headerInfo = card.querySelector('.wt-card-record-info');
      if (headerInfo) {
        headerInfo.textContent = `${records.length} record(s)`;
      }

      const highlightWordCard = card.querySelector('.wt-card-word');
      if (highlightWordCard) {
        highlightWordCard.classList.add('wt-highlight-word');
      }
    } catch (e) {
      const loadingEl = card.querySelector('#wt-translate-loading');
      const errorEl = card.querySelector('#wt-translate-error');
      if (loadingEl) loadingEl.style.display = 'none';
      if (errorEl) {
        errorEl.textContent = 'Translation failed: ' + e.message;
        errorEl.style.display = 'block';
      }
    }
  }

  function removeCard() {
    if (currentCard) {
      currentCard.remove();
      currentCard = null;
    }
    if (currentBackdrop) {
      currentBackdrop.remove();
      currentBackdrop = null;
    }
    clearHighlight();
  }

  function clearHighlight() {
    if (currentHighlight) {
      currentHighlight.classList.remove('wt-highlight-word');
      currentHighlight = null;
    }
  }

  function handleClick(e) {
    if (e.target.classList.contains('wt-backdrop')) {
      removeCard();
    }
    removeTooltip();
  }

  async function scanAndMark() {
    if (isScanning) return;
    isScanning = true;

    try {
      const knownLower = Object.keys(knownWords);
      if (knownLower.length === 0) return;

      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: function(node) {
            if (node.parentElement &&
                (node.parentElement.classList.contains('wt-known-word') ||
                 node.parentElement.classList.contains('wt-scanned') ||
                 node.parentElement.classList.contains('wt-card') ||
                 node.parentElement.classList.contains('wt-tooltip') ||
                 node.parentElement.tagName === 'SCRIPT' ||
                 node.parentElement.tagName === 'STYLE' ||
                 node.parentElement.tagName === 'NOSCRIPT' ||
                 node.parentElement.tagName === 'TEXTAREA' ||
                 node.parentElement.tagName === 'INPUT' ||
                 node.parentElement.isContentEditable)) {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );

      const textNodes = [];
      while (walker.nextNode()) {
        textNodes.push(walker.currentNode);
      }

      const wordRegex = /[\w'-]+/g;

      for (const node of textNodes) {
        const text = node.textContent;

        const matches = [];
        let match;
        while ((match = wordRegex.exec(text)) !== null) {
          const lower = match[0].toLowerCase();
          if (knownWords[lower]) {
            matches.push({ start: match.index, end: match.index + match[0].length, word: match[0], key: lower });
          }
        }

        if (matches.length === 0) continue;

        matches.sort((a, b) => a.start - b.start);

        let lastEnd = 0;
        let result = '';
        for (const m of matches) {
          if (m.start < lastEnd) continue;
          result += escapeHtml(text.substring(lastEnd, m.start));
          const records = knownWords[m.key];
          const latest = records[records.length - 1];
          const data = JSON.stringify({
            word: m.key,
            translation: latest?.wordTranslation || '',
            records
          }).replace(/"/g, '&quot;');
          result += `<span class="wt-known-word" data-wt="${data}">${escapeHtml(m.word)}</span>`;
          lastEnd = m.end;
        }
        result += escapeHtml(text.substring(lastEnd));

        const container = document.createElement('span');
        container.classList.add('wt-scanned');
        container.innerHTML = result;
        const parent = node.parentNode;
        if (parent) {
          parent.replaceChild(container, node);
        }
      }

      attachHoverListeners();
    } finally {
      isScanning = false;
    }
  }

  function attachHoverListeners() {
    document.querySelectorAll('.wt-known-word').forEach(el => {
      if (el._wtHoverBound) return;
      el._wtHoverBound = true;

      el.addEventListener('mouseenter', (e) => {
        showTooltip(e, el);
      });

      el.addEventListener('mouseleave', () => {
        removeTooltip();
      });

      let clickTimer = null;

      el.addEventListener('click', (e) => {
        if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; return; }
        clickTimer = setTimeout(() => {
          clickTimer = null;
          const dataStr = el.getAttribute('data-wt');
          if (!dataStr) return;
          try {
            const data = JSON.parse(dataStr.replace(/&quot;/g, '"'));
            const records = knownWords[data.word] || [];
            if (records.length === 0) return;
            removeCard();
            removeTooltip();
            const range = document.createRange();
            range.selectNodeContents(el);
            const rect = range.getBoundingClientRect();
            showHistoryCard(rect, data.word, records);
          } catch (err) {
            console.warn('WordTranslator: failed to parse data', err);
          }
        }, 280);
      });

      el.addEventListener('dblclick', (e) => {
        if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
        e.stopPropagation();
        const dataStr = el.getAttribute('data-wt');
        if (!dataStr) return;
        try {
          const data = JSON.parse(dataStr.replace(/&quot;/g, '"'));
          const word = data.word;
          const range = document.createRange();
          range.selectNodeContents(el);
          const rect = range.getBoundingClientRect();
          const sentence = getContextSentence(el);
          removeCard();
          removeTooltip();
          showCard(rect, word, sentence, true);
        } catch (err) {
          console.warn('WordTranslator: failed to parse data', err);
        }
      });
    });
  }

  function getContextSentence(element) {
    const container = findBlockContainer(element);
    const fullText = (container.textContent || '').replace(/\s+/g, ' ');

    let word = element.textContent || '';
    try {
      const data = JSON.parse((element.getAttribute('data-wt') || '').replace(/&quot;/g, '"'));
      word = data.word;
    } catch (e) {}

    return extractContextSentence(fullText, word) || word;
  }

  function showTooltip(e, el) {
    removeTooltip();

    const dataStr = el.getAttribute('data-wt');
    if (!dataStr) return;
    let data;
    try {
      data = JSON.parse(dataStr.replace(/&quot;/g, '"'));
    } catch (err) {
      return;
    }

    const tooltip = document.createElement('div');
    tooltip.className = 'wt-tooltip';

    const records = data.records || [];
    const latest = records[records.length - 1];
    const translation = latest?.wordTranslation || '';

    tooltip.innerHTML = `
      <div class="wt-tooltip-word">${escapeHtml(data.word)}</div>
      <div class="wt-tooltip-trans">${escapeHtml(translation)}</div>
    `;

    document.body.appendChild(tooltip);

    const rect = el.getBoundingClientRect();
    let left = rect.left;
    let top = rect.bottom + 4;

    if (left + 340 > window.innerWidth) {
      left = window.innerWidth - 340;
    }
    if (left < 4) left = 4;
    if (top + tooltip.offsetHeight > window.innerHeight) {
      top = rect.top - tooltip.offsetHeight - 4;
    }

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';

    currentTooltip = tooltip;
  }

  function removeTooltip() {
    if (currentTooltip) {
      currentTooltip.remove();
      currentTooltip = null;
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function escapeAttr(str) {
    return str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  chrome.runtime.onMessage.addListener((request) => {
    if (request.type === 'REFRESH_MARKS') {
      loadKnownWords().then(() => {
        document.querySelectorAll('.wt-scanned').forEach(el => {
          const parent = el.parentNode;
          if (parent) {
            while (el.firstChild) {
              parent.insertBefore(el.firstChild, el);
            }
            parent.removeChild(el);
          }
        });
        document.querySelectorAll('.wt-known-word').forEach(el => {
          const parent = el.parentNode;
          if (parent) {
            parent.replaceChild(document.createTextNode(el.textContent), el);
          }
        });
        document.body.normalize();
        scanAndMark();
      });
    }
  });

  const observer = new MutationObserver((mutations) => {
    let hasNewText = false;
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === Node.TEXT_NODE ||
            (node.nodeType === Node.ELEMENT_NODE &&
             !node.classList?.contains('wt-known-word') &&
             !node.classList?.contains('wt-card') &&
             !node.classList?.contains('wt-tooltip'))) {
          hasNewText = true;
          break;
        }
      }
      if (hasNewText) break;
    }
    if (hasNewText) {
      setTimeout(() => scanAndMark(), 300);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
