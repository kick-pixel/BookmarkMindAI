# Privacy Policy

**BookmarkMind AI** — A local-first AI bookmark manager

Last updated: May 15, 2026

## Data Collection

BookmarkMind AI is designed to be **local-first**. Your bookmarks, categories, tags, and AI-generated summaries are stored in your browser's `chrome.storage` and never leave your device unless you explicitly enable cloud sync.

### Page content sent to AI

When you save a page for AI analysis, the extension extracts the **page title, URL, and main text content** and sends them to the AI provider you configure (e.g., OpenAI, DeepSeek, NVIDIA, or your own custom API). This content is used **only** for:

- Automatically categorizing the bookmark
- Generating a concise summary
- Extracting keywords and tags

No personal information, browsing history, or user behavior data is collected or transmitted.

### AI provider data

When you configure an AI provider with your own API key, your page content is sent directly to that provider's API. BookmarkMind AI does not store, forward, or process this content on any intermediary server. The privacy of your data then depends on the AI provider's own privacy policy.

### Cloud sync (optional)

If you enable cloud sync, your bookmark data (URLs, titles, categories, tags, summaries) is encrypted and synced to your configured cloud storage. BookmarkMind AI does not have access to your cloud credentials or sync data.

## What we do NOT collect

- **No personal information** — name, email, address, etc.
- **No browsing history** — we only access pages you explicitly save
- **No user activity tracking** — no clicks, scrolls, or keystroke logging
- **No location data** — no GPS or IP address collection
- **No analytics or telemetry** — no usage statistics are sent

## Data retention

All bookmark data is stored locally in your browser. If you uninstall the extension, all locally stored data is removed. Cloud-synced data persists according to your cloud provider's retention policy.

## Third-party services

BookmarkMind AI uses the following third-party services only when you explicitly configure them:

- **AI API providers** — for bookmark analysis (your configured provider of choice)
- **Cloud storage providers** — for optional cross-device sync

We do not sell, rent, or transfer your data to any third party outside the explicitly configured services above.

## Children's privacy

BookmarkMind AI does not knowingly collect personal information from children under 13.

## Changes to this policy

We may update this privacy policy from time to time. Changes will be reflected in the extension's settings page and the linked document.

## Contact

For questions about this privacy policy, please open an issue at:

https://github.com/kick-pixel/BookmarkMindAI/issues
