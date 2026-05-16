# Edge Certification Notes

```text
BookmarkMind AI is a local-first bookmark management extension.

How to test:
1. Install the extension and click the extension icon.
2. Click "Save current page" to save the active tab.
3. Open the side panel from the popup or browser sidebar to view, search, edit, re-analyze, and manage saved bookmarks.
4. Open Settings to configure AI provider, API Key, model, language, privacy options, import/export, and cloud sync options.

AI features:
- The extension can work as a basic local bookmark manager without an API key.
- To test AI categorization, tags, summaries, and keyword extraction, configure an OpenAI-compatible API key in Settings.
- No default API key or paid account is included.
- If no API key is configured, the extension saves bookmarks locally and shows guidance to configure AI.

Privacy:
- Bookmark data is stored locally by default.
- Page content is only sent to the configured AI provider when the user enables/configures AI features.
- Some pages requiring login or special permissions may not be readable by the extension; in that case, the UI shows a clear error message and the user can retry after signing in.

No separate test account is required.
```
