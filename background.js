const DEFAULT_SETTINGS = {
  provider: 'deepseek',
  apiUrl: 'https://api.deepseek.com/v1/chat/completions',
  apiKey: '',
  model: 'deepseek-v4-flash',
  thinkingDisabled: true,
  systemPrompt: 'You are a professional translator. Translate the given word and sentence from the source language to Chinese. Respond ONLY in JSON format: {"wordTranslation": "...", "sentenceTranslation": "..."}. Do not include any other text.'
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['settings', 'wordRecords'], (data) => {
    if (!data.settings) {
      chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
    }
    if (!data.wordRecords) {
      chrome.storage.local.set({ wordRecords: {} });
    }
  });
});

function buildTranslationPrompt(word, sentence) {
  return `Translate the word "${word}" in the context of this sentence, and then translate the entire sentence. The target language is Chinese.\n\nSentence: "${sentence}"\n\nRespond ONLY with valid JSON: {"wordTranslation": "...", "sentenceTranslation": "..."}`;
}

async function callAI(settings, word, sentence) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${settings.apiKey}`
  };

  const body = {
    model: settings.model,
    messages: [
      { role: 'system', content: settings.systemPrompt },
      { role: 'user', content: buildTranslationPrompt(word, sentence) }
    ]
  };

  if (settings.thinkingDisabled && (settings.model === 'deepseek-v4-flash' || settings.model === 'deepseek-v4-pro')) {
    body.thinking = { type: 'disabled' };
  }

  const response = await fetch(settings.apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  return content;
}

function parseTranslationResponse(content) {
  content = content.trim();
  if (content.startsWith('```')) {
    content = content.replace(/```\w*\n?/g, '').replace(/```/g, '');
  }
  try {
    return JSON.parse(content);
  } catch (e) {
    const wm = content.match(/wordTranslation["\s:]+["']?([^"'}]+)/i);
    const sm = content.match(/sentenceTranslation["\s:]+["']?([^"'}]+)/i);
    return {
      wordTranslation: wm ? wm[1] : '',
      sentenceTranslation: sm ? sm[1] : ''
    };
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'TRANSLATE') {
    handleTranslate(request, sender).then(sendResponse).catch(e => sendResponse({ error: e.message }));
    return true;
  } else if (request.type === 'GET_RECORDS') {
    chrome.storage.local.get('wordRecords', (data) => {
      sendResponse(data.wordRecords || {});
    });
    return true;
  } else if (request.type === 'DELETE_RECORD') {
    chrome.storage.local.get('wordRecords', (data) => {
      const records = data.wordRecords || {};
      delete records[request.word];
      chrome.storage.local.set({ wordRecords: records }, () => {
        sendResponse({ success: true, records });
      });
    });
    return true;
  } else if (request.type === 'EXPORT_RECORDS') {
    chrome.storage.local.get('wordRecords', (data) => {
      const records = data.wordRecords || {};
      const json = JSON.stringify(records, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      chrome.downloads.download({
        url,
        filename: `word-records-${new Date().toISOString().slice(0, 10)}.json`,
        saveAs: true
      }).catch(() => {
        sendResponse({ json });
      });
      sendResponse({ success: true });
    });
    return true;
  } else if (request.type === 'GET_SETTINGS') {
    chrome.storage.local.get('settings', (data) => {
      sendResponse(data.settings || DEFAULT_SETTINGS);
    });
    return true;
  } else if (request.type === 'SAVE_SETTINGS') {
    chrome.storage.local.set({ settings: request.settings }, () => {
      sendResponse({ success: true });
    });
    return true;
  } else if (request.type === 'GET_KNOWN_WORDS') {
    chrome.storage.local.get('wordRecords', (data) => {
      const records = data.wordRecords || {};
      const words = Object.keys(records).map(w => ({
        word: w,
        records: records[w]
      }));
      sendResponse(words);
    });
    return true;
  }
});

async function handleTranslate(request, sender) {
  const { word, sentence } = request;
  const settingsData = await chrome.storage.local.get('settings');
  const settings = { ...DEFAULT_SETTINGS, ...(settingsData.settings || {}) };

  if (!settings.apiKey) {
    return { error: 'API key not configured. Please set it in the extension popup.' };
  }

  let result;
  try {
    const content = await callAI(settings, word, sentence);
    result = parseTranslationResponse(content);
  } catch (e) {
    try {
      const content = await callAI(settings, word, sentence);
      result = parseTranslationResponse(content);
    } catch (e2) {
      return { error: `Translation failed: ${e.message}` };
    }
  }

  const recordsData = await chrome.storage.local.get('wordRecords');
  const wordRecords = recordsData.wordRecords || {};
  const key = word.toLowerCase();

  if (!wordRecords[key]) {
    wordRecords[key] = [];
  }

  wordRecords[key].push({
    sentence,
    wordTranslation: result.wordTranslation || '',
    sentenceTranslation: result.sentenceTranslation || '',
    timestamp: Date.now(),
    url: sender.tab?.url || ''
  });

  await chrome.storage.local.set({ wordRecords });

  return {
    success: true,
    wordTranslation: result.wordTranslation,
    sentenceTranslation: result.sentenceTranslation,
    recordCount: wordRecords[key].length
  };
}
