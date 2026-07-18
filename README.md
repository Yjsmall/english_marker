<p align="center">
  <img src="icons/icon128.png" width="80" alt="Word Translator" />
</p>

<h1 align="center">Word Translator</h1>

<p align="center">
  <a href="README-zh.md">中文文档</a>
</p>

<p align="center">
  Chrome extension — double-click any word to get AI-powered contextual translation.
</p>

## Features

- **Double-click** any word → AI translates the word in context + the whole sentence
- **Wave underline** highlights known words across all websites
- **Hover** to see the saved translation
- **Click** to view all previous contexts for that word
- **Double-click again** to add a new context (different meaning)
- Configurable AI provider: DeepSeek V4, OpenAI, or custom
- Export all records as JSON

## Quick Start

1. Clone or download this repo
2. Go to `chrome://extensions/`, enable **Developer mode**
3. Click **Load unpacked** and select the project folder
4. Click the extension icon → **Settings** → enter your API key

## Supported Providers

| Provider | Model |
|----------|-------|
| [DeepSeek](https://platform.deepseek.com) | `deepseek-v4-flash` |
| [OpenAI](https://platform.openai.com) | `gpt-4o-mini` |
| [OpenRouter](https://openrouter.ai) | `deepseek/deepseek-v4-pro` |
| Custom | Any OpenAI-compatible API |

## Project Structure

```text
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

## License

MIT
