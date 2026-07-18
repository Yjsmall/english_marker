# 单词翻译助手

Chrome 浏览器插件 — 双击网页任意单词，AI 翻译该词在语境中的含义及整句翻译。

## 功能

- **双击**任意单词 → AI 翻译该词在当前语境的含义 + 整句翻译
- 已知单词在所有网页自动显示**波浪下划线**
- **悬停**显示上次保存的翻译
- **单击**查看该词所有历史语境记录
- **再次双击**添加新语境记录（一词多义）
- 可配置 AI 翻译源：DeepSeek V4 / OpenAI / 自定义
- 导出全部单词记录为 JSON

## 安装

1. 克隆或下载本项目
2. 打开 `chrome://extensions/`，开启**开发者模式**
3. 点击**加载已解压的扩展程序**并选择项目目录
4. 点击插件图标 → Settings → 填入 API Key

## 支持的翻译源

| 来源 | 默认模型 |
|------|---------|
| DeepSeek | `deepseek-v4-flash` |
| OpenAI | `gpt-4o-mini` |
| OpenRouter | `deepseek/deepseek-v4-pro` |
| 自定义 | 任何兼容 OpenAI 接口的 API |

## 项目结构

```
├── manifest.json
├── background.js      # Service worker: 存储管理、API 调用
├── content.js         # 内容脚本: 单词检测、卡片 UI
├── content.css        # 卡片和标记样式
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
└── icons/
```
