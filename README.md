# Word Translator / 单词翻译助手

Chrome extension — double-click any word to get AI-powered contextual translation.

Chrome 浏览器插件 — 双击网页任意单词，AI 翻译该词在语境中的含义及整句翻译。

## Features / 功能

- **Double-click** any word → AI translates the word in context + the whole sentence
- **双击**任意单词 → AI 翻译该词在当前语境的含义 + 整句翻译
- **Wave underline** highlights known words across all websites
- 已知单词在所有网页自动显示**波浪下划线**
- **Hover** to see the saved translation
- **悬停**显示上次保存的翻译
- **Click** to view all previous contexts
- **单击**查看该词所有历史语境记录
- **Double-click again** to add a new context (different meaning)
- **再次双击**添加新语境记录（一词多义）
- Configurable AI provider: DeepSeek V4, OpenAI, or custom
- 可配置 AI 翻译源：DeepSeek V4 / OpenAI / 自定义
- Export all records as JSON
- 导出全部单词记录为 JSON

## Install / 安装

1. Clone or download this repo / 克隆或下载本项目
2. Go to `chrome://extensions/`, enable **Developer mode** / 打开 `chrome://extensions/`，开启**开发者模式**
3. Click **Load unpacked** and select the project folder / 点击**加载已解压的扩展程序**并选择项目目录
4. Click the extension icon → Settings → enter your API key / 点击插件图标 → Settings → 填入 API Key

## Supported Providers / 支持的翻译源

| Provider | Default Model |
|----------|--------------|
| DeepSeek | `deepseek-v4-flash` |
| OpenAI | `gpt-4o-mini` |
| OpenRouter | `deepseek/deepseek-v4-pro` |
| Custom | Any OpenAI-compatible API |

## Project Structure / 项目结构

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
