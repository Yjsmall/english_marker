# Word Translator

Chrome extension — double-click any word to get AI-powered contextual translation.

## Features

- **Double-click** any word → AI translates the word in context + the whole sentence
- **Wave underline** highlights known words across all websites
- **Hover** to see the saved translation
- **Click** to view all previous contexts
- **Double-click again** to add a new context (different meaning)
- Configurable AI provider: DeepSeek V4, OpenAI, or custom
- Export all records as JSON

## Install

1. Clone or download this repo
2. Go to `chrome://extensions/`, enable **Developer mode**
3. Click **Load unpacked** and select the project folder
4. Click the extension icon → Settings → enter your API key

## Supported Providers

| Provider | Default Model |
|----------|--------------|
| DeepSeek | `deepseek-v4-flash` |
| OpenAI | `gpt-4o-mini` |
| OpenRouter | `deepseek/deepseek-v4-pro` |
| Custom | Any OpenAI-compatible API |

## Project Structure

```
├── manifest.json
├── background.js      # Service worker: storage, API calls
├── content.js         # Content script: word detection, card UI
├── content.css        # Card & highlight styles
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
└── icons/
```
