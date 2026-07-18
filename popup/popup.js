(function() {
  'use strict';

  const PROVIDER_PRESETS = {
    deepseek: {
      apiUrl: 'https://api.deepseek.com/v1/chat/completions',
      model: 'deepseek-v4-flash'
    },
    openai: {
      apiUrl: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-4o-mini'
    },
    openrouter: {
      apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
      model: 'deepseek/deepseek-v4-pro'
    }
  };

  let allRecords = {};
  let currentView = 'list';
  let currentSearch = '';

  function sendMessage(msg) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(msg, (response) => {
        resolve(response);
      });
    });
  }

  async function init() {
    setupTabs();
    await loadRecords();
    await loadSettings();
    bindEvents();
  }

  function setupTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
      });
    });
  }

  async function loadRecords() {
    allRecords = await sendMessage({ type: 'GET_RECORDS' }) || {};
    renderWordList();
  }

  async function loadSettings() {
    const settings = await sendMessage({ type: 'GET_SETTINGS' });
    if (settings) {
      document.getElementById('provider').value = settings.provider || 'deepseek';
      document.getElementById('api-url').value = settings.apiUrl || '';
      document.getElementById('api-key').value = settings.apiKey || '';
      document.getElementById('model').value = settings.model || '';
    }
  }

  function bindEvents() {
    document.getElementById('btn-export').addEventListener('click', exportRecords);
    document.getElementById('btn-save-settings').addEventListener('click', saveSettings);
    document.getElementById('search-input').addEventListener('input', (e) => {
      currentSearch = e.target.value.toLowerCase().trim();
      renderWordList();
    });

    document.getElementById('provider').addEventListener('change', (e) => {
      const preset = PROVIDER_PRESETS[e.target.value];
      if (preset) {
        document.getElementById('api-url').value = preset.apiUrl;
        document.getElementById('model').value = preset.model;
      }
    });

    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const provider = btn.dataset.provider;
        document.getElementById('provider').value = provider;
        const preset = PROVIDER_PRESETS[provider];
        if (preset) {
          document.getElementById('api-url').value = preset.apiUrl;
          document.getElementById('model').value = preset.model;
        }
      });
    });
  }

  function renderWordList() {
    const container = document.getElementById('word-list');
    const stats = document.getElementById('stats');
    const tabCount = document.getElementById('tab-count');

    if (currentView === 'detail') return;

    const words = Object.keys(allRecords);
    let filtered = words;

    if (currentSearch) {
      filtered = words.filter(w => w.toLowerCase().includes(currentSearch));
    }

    filtered.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

    let totalRecords = 0;
    words.forEach(w => { totalRecords += allRecords[w].length; });
    tabCount.textContent = words.length || '';
    stats.textContent = words.length ? `${words.length} words | ${totalRecords} records` : '';

    if (filtered.length === 0) {
      container.innerHTML = words.length === 0
        ? '<div class="empty-state">No words saved.<br>Double-click any word on a webpage to translate it.</div>'
        : '<div class="empty-state">No matching words.</div>';
      return;
    }

    container.innerHTML = filtered.map(word => {
      const records = allRecords[word];
      const latest = records[records.length - 1];
      const snippet = latest?.sentence?.substring(0, 70) || '';
      return `
        <div class="word-item" data-word="${escapeAttr(word)}">
          <div class="word-item-header">
            <span class="word-item-word">${escapeHtml(word)}</span>
            <span class="word-item-count">${records.length} record${records.length > 1 ? 's' : ''}</span>
          </div>
          <div class="word-item-latest">
            ${escapeHtml(latest?.wordTranslation || '')} &mdash; "${escapeHtml(snippet)}${snippet.length >= 70 ? '...' : ''}"
          </div>
          <button class="word-item-delete" data-word="${escapeAttr(word)}" title="Delete">&times;</button>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.word-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('word-item-delete')) return;
        showWordDetail(item.dataset.word);
      });
    });

    container.querySelectorAll('.word-item-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const word = btn.dataset.word;
        const result = await sendMessage({ type: 'DELETE_RECORD', word });
        if (result && result.success) {
          allRecords = result.records || {};
          renderWordList();
          notifyContentScript();
        }
      });
    });
  }

  function showWordDetail(word) {
    currentView = 'detail';
    const container = document.getElementById('word-list');
    const records = allRecords[word] || [];

    const listHtml = records.map((r, i) => `
      <div class="record-card">
        <div class="record-card-sentence">"${escapeHtml(r.sentence)}"</div>
        <div class="record-card-trans"><strong>Word</strong> ${escapeHtml(r.wordTranslation)}</div>
        <div class="record-card-trans"><strong>Sentence</strong> ${escapeHtml(r.sentenceTranslation)}</div>
        <div class="record-card-meta">
          ${r.url ? escapeHtml(r.url.substring(0, 60)) + '...' : ''} &middot;
          ${new Date(r.timestamp).toLocaleString()}
        </div>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="word-detail">
        <button class="word-detail-back" id="btn-back">&larr; Back</button>
        <div class="word-detail-title">${escapeHtml(word)} <span style="color:#ccc;font-size:13px;font-weight:400;">&middot; ${records.length} record${records.length !== 1 ? 's' : ''}</span></div>
        ${records.length === 0 ? '<div class="empty-state">No records</div>' : listHtml}
        <button class="btn btn-outline btn-sm" id="btn-delete-word" style="margin-top:8px;">Delete all records</button>
      </div>
    `;

    document.getElementById('btn-back').addEventListener('click', () => {
      currentView = 'list';
      renderWordList();
    });

    document.getElementById('btn-delete-word').addEventListener('click', async () => {
      const result = await sendMessage({ type: 'DELETE_RECORD', word });
      if (result && result.success) {
        allRecords = result.records || {};
        currentView = 'list';
        renderWordList();
        notifyContentScript();
      }
    });
  }

  async function saveSettings() {
    const settings = {
      provider: document.getElementById('provider').value,
      apiUrl: document.getElementById('api-url').value.trim(),
      apiKey: document.getElementById('api-key').value.trim(),
      model: document.getElementById('model').value.trim()
    };

    const result = await sendMessage({ type: 'SAVE_SETTINGS', settings });
    const msgEl = document.getElementById('settings-msg');
    if (result && result.success) {
      msgEl.textContent = 'Settings saved.';
      msgEl.className = 'msg success';
    } else {
      msgEl.textContent = 'Failed to save.';
      msgEl.className = 'msg error';
    }
    setTimeout(() => { msgEl.textContent = ''; }, 2000);
  }

  async function exportRecords() {
    try {
      await sendMessage({ type: 'EXPORT_RECORDS' });
    } catch (e) {
      const data = await sendMessage({ type: 'GET_RECORDS' });
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `word-records-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  function notifyContentScript() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'REFRESH_MARKS' }).catch(() => {});
      }
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
