# BookmarkMind AI: Open Source Optimization & Cloud Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optimize the open-source extension for international growth, add CI/testing, localize the category taxonomy to English-first, improve search/import UX, and scaffold the cloud adapter module for future paid cloud service integration.

**Architecture:** Three parallel work streams within the same repository: (1) open-source foundation (license, CI, tests), (2) UX improvements (localization, search, import), (3) cloud adapter scaffolding (types + module structure, no backend required). All cloud features gracefully degrade to no-op when no backend is deployed.

**Tech Stack:** TypeScript, React 19, Vite, Chrome Extension MV3, Vitest, GitHub Actions.

---

### Task 1: Add MIT License and Open Source Foundation Files

**Files:**
- Create: `LICENSE`
- Create: `CONTRIBUTING.md`
- Create: `.github/ISSUE_TEMPLATE/bug_report.md`
- Create: `.github/ISSUE_TEMPLATE/feature_request.md`
- Create: `.github/ISSUE_TEMPLATE/config.yml`

- [ ] **Step 1: Create MIT License**

Create `LICENSE`:
```text
MIT License

Copyright (c) 2026 BookmarkMind AI Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 2: Create CONTRIBUTING.md**

Create `CONTRIBUTING.md`:
```markdown
# Contributing to BookmarkMind AI

Thank you for your interest in contributing!

## Development Setup

```bash
npm install
npm run dev
```

To load in Chrome:
1. Run `npm run build`
2. Open `chrome://extensions`
3. Enable Developer Mode
4. Click "Load unpacked" and select the `dist/` directory

## Code Style

- TypeScript strict mode
- No `any` types unless absolutely necessary
- Follow existing patterns in the codebase
- Run `npm run lint` before submitting

## Commit Convention

We use conventional commits:
- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation changes
- `refactor:` code restructuring
- `test:` test additions
- `chore:` build/CI/tooling

Example: `feat: add cloud sync indicator to side panel`

## Pull Requests

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run lint && npm run build`
5. Submit a PR with a clear description of changes
```

- [ ] **Step 3: Create GitHub Issue Templates**

Create `.github/ISSUE_TEMPLATE/bug_report.md`:
```markdown
---
name: Bug Report
about: Report a bug or unexpected behavior
title: 'bug: '
labels: bug
---

## Describe the bug
A clear description of what the bug is.

## To Reproduce
Steps to reproduce:
1. Go to '...'
2. Click on '...'
3. See error

## Expected behavior
What you expected to happen.

## Environment
- Browser: Chrome / Edge
- Extension version: 1.0.0
- OS: Windows / macOS / Linux

## Screenshots
If applicable, add screenshots.
```

Create `.github/ISSUE_TEMPLATE/feature_request.md`:
```markdown
---
name: Feature Request
about: Suggest an idea for BookmarkMind AI
title: 'feat: '
labels: enhancement
---

## Problem
What problem does this solve?

## Proposed Solution
How should it work?

## Alternatives
Any alternative approaches considered?
```

Create `.github/ISSUE_TEMPLATE/config.yml`:
```yaml
blank_issues_enabled: true
contact_links:
  - name: Question
    url: https://github.com/BookmarkMindAI/BookmarkMindAI/discussions
    about: Ask questions and discuss ideas
```

- [ ] **Step 4: Commit**

```bash
git add LICENSE CONTRIBUTING.md .github/
git commit -m "chore: add MIT license, contributing guide, and issue templates"
```

---

### Task 2: Set Up CI/CD with GitHub Actions

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `package.json` — add test scripts

- [ ] **Step 1: Create CI workflow**

Create `.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run build
      - name: Upload dist artifact
        if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        uses: actions/upload-artifact@v4
        with:
          name: bookmarkmind-ai-dist
          path: dist/
          retention-days: 30

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx vitest run --coverage
```

- [ ] **Step 2: Add test scripts to package.json**

Read current `package.json` first, then update the scripts section. The current scripts are:
```json
"scripts": {
  "dev": "vite",
  "build": "tsc --noEmit && vite build",
  "build:ext": "vite build",
  "lint": "eslint src --ext ts,tsx",
  "preview": "vite preview"
}
```

Change to:
```json
"scripts": {
  "dev": "vite",
  "build": "tsc --noEmit && vite build",
  "build:ext": "vite build",
  "lint": "eslint src --ext ts,tsx",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml package.json
git commit -m "ci: add GitHub Actions workflow for build and test"
```

---

### Task 3: Add Vitest and Write Unit Tests

**Files:**
- Create: `vitest.config.ts`
- Create: `src/lib/__tests__/bookmarkTaxonomy.test.ts`
- Create: `src/lib/__tests__/storage.test.ts`
- Modify: `package.json` — add vitest + @vitest/coverage-v8 devDependencies

- [ ] **Step 1: Create Vitest config**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/lib/**/*.ts'],
    },
  },
})
```

- [ ] **Step 2: Install vitest and jsdom**

Run:
```bash
npm install -D vitest @vitest/coverage-v8 jsdom @testing-library/jest-dom @types/jsdom
```

- [ ] **Step 3: Write bookmarkTaxonomy tests**

Create `src/lib/__tests__/bookmarkTaxonomy.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { BOOKMARK_TAXONOMY, normalizeFolderPath, inferFolderByRules, getTaxonomyPrompt } from '../bookmarkTaxonomy'

describe('BOOKMARK_TAXONOMY', () => {
  it('has exactly 11 top-level categories', () => {
    expect(BOOKMARK_TAXONOMY).toHaveLength(11)
  })

  it('every group has at least one child', () => {
    for (const group of BOOKMARK_TAXONOMY) {
      expect(group.children.length).toBeGreaterThan(0)
    }
  })

  it('last group is 其他 with 待整理 child', () => {
    const last = BOOKMARK_TAXONOMY[BOOKMARK_TAXONOMY.length - 1]
    expect(last.name).toBe('其他')
    expect(last.children).toContain('待整理')
  })
})

describe('getTaxonomyPrompt', () => {
  it('returns a non-empty string', () => {
    const prompt = getTaxonomyPrompt()
    expect(prompt.length).toBeGreaterThan(100)
  })

  it('includes all category names', () => {
    const prompt = getTaxonomyPrompt()
    for (const group of BOOKMARK_TAXONOMY) {
      expect(prompt).toContain(group.name)
    }
  })
})

describe('normalizeFolderPath', () => {
  it('returns 其他/待整理 for empty input', () => {
    expect(normalizeFolderPath()).toEqual(['其他', '待整理'])
  })

  it('normalizes valid taxonomy paths', () => {
    expect(normalizeFolderPath(['技术开发', '前端开发'])).toEqual(['技术开发', '前端开发'])
  })

  it('falls back to first child for invalid second element', () => {
    const result = normalizeFolderPath(['技术开发', 'nonexistent'])
    expect(result[0]).toBe('技术开发')
    expect(result[1]).toBe(BOOKMARK_TAXONOMY[0].children[0])
  })

  it('falls back for invalid first element', () => {
    const result = normalizeFolderPath(['invalid', 'something'])
    expect(result).toEqual(['其他', '待整理'])
  })
})

describe('inferFolderByRules', () => {
  it('matches VPN-related content', () => {
    const result = inferFolderByRules({
      title: 'Best VPN for streaming',
      url: 'https://example.com/vpn',
      description: 'VPN proxy comparison',
      mainContent: '',
    })
    expect(result).toEqual(['效率工具', '网络代理'])
  })

  it('matches Web3/blockchain content', () => {
    const result = inferFolderByRules({
      title: 'Solana Faucet',
      url: 'https://faucet.solana.com',
      description: 'Get SOL for development',
      mainContent: '',
    })
    expect(result).toEqual(['技术开发', 'Web3与区块链'])
  })

  it('matches frontend development content', () => {
    const result = inferFolderByRules({
      title: 'React 19 Release Notes',
      url: 'https://react.dev/blog',
      description: 'React frontend framework',
      mainContent: '',
    })
    expect(result).toEqual(['技术开发', '前端开发'])
  })

  it('matches tutorial content', () => {
    const result = inferFolderByRules({
      title: 'Getting Started with Python',
      url: 'https://example.com/python-tutorial',
      description: 'Python 教程',
      mainContent: '',
    })
    expect(result).toEqual(['学习研究', '技术教程'])
  })

  it('falls back to 其他/待整理 for unclassifiable content', () => {
    const result = inferFolderByRules({
      title: 'Random page',
      url: 'https://example.com',
      description: '',
      mainContent: '',
    })
    expect(result).toEqual(['其他', '待整理'])
  })

  it('matches news content from known domains', () => {
    const result = inferFolderByRules({
      title: 'Tech news today',
      url: 'https://news.qq.com/article',
      description: 'Latest news from 36kr and IT之家',
      mainContent: '',
    })
    expect(result).toEqual(['资讯动态', '科技新闻'])
  })
})
```

- [ ] **Step 4: Write storage utility tests**

Create `src/lib/__tests__/storage.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { normalizeUrl, getDomain, computeStatus } from '../storage'
import type { Bookmark } from '../../types'

describe('normalizeUrl', () => {
  it('removes trailing slash', () => {
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com')
  })

  it('removes hash', () => {
    expect(normalizeUrl('https://example.com/page#section')).toBe('https://example.com/page')
  })

  it('sorts query parameters', () => {
    const result = normalizeUrl('https://example.com?b=2&a=1')
    expect(result).toBe('https://example.com/?a=1&b=2')
  })

  it('returns trimmed url for invalid urls', () => {
    expect(normalizeUrl('  not-a-url  ')).toBe('not-a-url')
  })
})

describe('getDomain', () => {
  it('extracts hostname without www', () => {
    expect(getDomain('https://www.example.com/path')).toBe('example.com')
  })

  it('returns empty string for invalid urls', () => {
    expect(getDomain('not-a-url')).toBe('')
  })
})

describe('computeStatus', () => {
  const now = Date.now()
  const DAY = 1000 * 60 * 60 * 24

  it('returns sleeping for never visited', () => {
    const bm = { lastVisitedAt: undefined } as Bookmark
    expect(computeStatus(bm)).toBe('sleeping')
  })

  it('returns active for recent visit', () => {
    const bm = { lastVisitedAt: now - 10 * DAY } as Bookmark
    expect(computeStatus(bm)).toBe('active')
  })

  it('returns idle for 30-90 day visit', () => {
    const bm = { lastVisitedAt: now - 60 * DAY } as Bookmark
    expect(computeStatus(bm)).toBe('idle')
  })

  it('returns sleeping for 90+ day visit', () => {
    const bm = { lastVisitedAt: now - 100 * DAY } as Bookmark
    expect(computeStatus(bm)).toBe('sleeping')
  })
})
```

- [ ] **Step 5: Run tests to verify they pass**

Run:
```bash
npx vitest run
```
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts src/lib/__tests__/ package.json package-lock.json
git commit -m "test: add vitest config and initial unit tests for taxonomy and storage"
```

---

### Task 4: Localize Category Taxonomy (English-First)

**Files:**
- Create: `src/lib/categoryI18n.ts`
- Modify: `src/sidepanel/SidePanelApp.tsx` — use localized category names
- Modify: `src/options/OptionsApp.tsx` — use localized category names in folder dropdowns

- [ ] **Step 1: Create category localization module**

Create `src/lib/categoryI18n.ts`:
```typescript
import type { AppLanguage } from '../types'
import type { Locale } from './i18n'
import { resolveLocale } from './i18n'

export interface CategoryI18nEntry {
  en: string
  'zh-CN': string
}

// Internal stable keys → display names per locale
const CATEGORY_I18N: Record<string, CategoryI18nEntry> = {
  // Top-level categories
  'tech-dev':         { en: 'Tech & Development', 'zh-CN': '技术开发' },
  'product-design':   { en: 'Product & Design',    'zh-CN': '产品设计' },
  'learning':         { en: 'Learning & Research', 'zh-CN': '学习研究' },
  'productivity':     { en: 'Productivity Tools',  'zh-CN': '效率工具' },
  'news':             { en: 'News & Trends',       'zh-CN': '资讯动态' },
  'work':             { en: 'Work Resources',      'zh-CN': '工作资料' },
  'business':         { en: 'Business & Finance',  'zh-CN': '商业财经' },
  'health':           { en: 'Health & Medical',    'zh-CN': '医疗健康' },
  'lifestyle':        { en: 'Life & Consumption',  'zh-CN': '生活消费' },
  'entertainment':    { en: 'Entertainment & Media','zh-CN': '娱乐媒体' },
  'other':            { en: 'Other',               'zh-CN': '其他' },

  // Sub-categories: tech-dev
  'tech-dev/frontend':     { en: 'Frontend',       'zh-CN': '前端开发' },
  'tech-dev/backend':      { en: 'Backend',        'zh-CN': '后端服务' },
  'tech-dev/ai-ml':        { en: 'AI & ML',        'zh-CN': 'AI与机器学习' },
  'tech-dev/web3':         { en: 'Web3 & Blockchain','zh-CN': 'Web3与区块链' },
  'tech-dev/data':         { en: 'Database & Data', 'zh-CN': '数据库与数据工程' },
  'tech-dev/devops':       { en: 'DevOps & Cloud',  'zh-CN': 'DevOps与云服务' },
  'tech-dev/languages':    { en: 'Languages',       'zh-CN': '编程语言' },
  'tech-dev/mobile':       { en: 'Mobile',          'zh-CN': '移动与客户端' },
  'tech-dev/security':     { en: 'Security',        'zh-CN': '安全与架构' },
  'tech-dev/testing':      { en: 'Testing & QA',    'zh-CN': '测试与质量' },
  'tech-dev/open-source':  { en: 'Open Source',     'zh-CN': '开源项目' },

  // Sub-categories: product-design
  'product-design/product-mgmt':  { en: 'Product Mgmt',  'zh-CN': '产品管理' },
  'product-design/ui-ux':         { en: 'UI/UX Design',  'zh-CN': 'UI/UX设计' },
  'product-design/resources':     { en: 'Design Resources','zh-CN': '设计资源' },
  'product-design/user-research': { en: 'User Research', 'zh-CN': '用户研究' },
  'product-design/growth':        { en: 'Growth Marketing','zh-CN': '增长营销' },

  // Sub-categories: learning
  'learning/tutorials':    { en: 'Tutorials',      'zh-CN': '技术教程' },
  'learning/papers':       { en: 'Academic Papers', 'zh-CN': '学术论文' },
  'learning/reports':      { en: 'Industry Reports', 'zh-CN': '行业报告' },
  'learning/courses':      { en: 'Courses',         'zh-CN': '课程资料' },
  'learning/datasets':     { en: 'Datasets',        'zh-CN': '数据集' },
  'learning/pkm':          { en: 'PKM',             'zh-CN': '个人知识管理' },

  // Sub-categories: productivity
  'productivity/ai-tools':    { en: 'AI Tools',       'zh-CN': 'AI工具' },
  'productivity/dev-tools':   { en: 'Dev Tools',      'zh-CN': '开发工具' },
  'productivity/vpn':         { en: 'VPN & Proxy',    'zh-CN': '网络代理' },
  'productivity/office':      { en: 'Office & Collab', 'zh-CN': '办公协作' },
  'productivity/automation':  { en: 'Automation',     'zh-CN': '自动化脚本' },
  'productivity/extensions':  { en: 'Browser Ext.',   'zh-CN': '浏览器扩展' },
  'productivity/design-tool': { en: 'Design Tools',   'zh-CN': '设计工具' },
  'productivity/data-tool':   { en: 'Data Tools',     'zh-CN': '数据工具' },

  // Sub-categories: news
  'news/tech-news':     { en: 'Tech News',    'zh-CN': '科技新闻' },
  'news/trends':        { en: 'Trends',       'zh-CN': '行业趋势' },
  'news/companies':     { en: 'Companies',    'zh-CN': '公司产品' },
  'news/finance':       { en: 'Finance',      'zh-CN': '财经商业' },
  'news/community':     { en: 'Community',    'zh-CN': '社区讨论' },

  // Sub-categories: work
  'work/docs':          { en: 'Docs & Specs',  'zh-CN': '文档规范' },
  'work/projects':      { en: 'Project Files', 'zh-CN': '项目资料' },
  'work/admin':         { en: 'Admin Panels',  'zh-CN': '后台管理' },
  'work/business-sys':  { en: 'Business Sys',  'zh-CN': '业务系统' },
  'work/careers':       { en: 'Careers',       'zh-CN': '招聘职业' },
  'work/portfolio':     { en: 'Portfolio',     'zh-CN': '简历作品' },
  'work/legal':         { en: 'Legal & Finance','zh-CN': '法律财务' },

  // Sub-categories: business
  'business/startup':  { en: 'Startups',       'zh-CN': '创业融资' },
  'business/research': { en: 'Company Research','zh-CN': '公司研究' },
  'business/marketing':{ en: 'Marketing',      'zh-CN': '市场营销' },
  'business/invest':   { en: 'Investing',      'zh-CN': '投资理财' },
  'business/ecommerce':{ en: 'E-commerce',     'zh-CN': '支付电商' },

  // Sub-categories: health
  'health/medical-data': { en: 'Medical Data',   'zh-CN': '医学数据' },
  'health/wellness':     { en: 'Health Info',    'zh-CN': '健康科普' },
  'health/medical-ai':   { en: 'Medical AI',     'zh-CN': '医疗AI' },
  'health/equipment':    { en: 'Equipment',      'zh-CN': '药品器械' },

  // Sub-categories: lifestyle
  'lifestyle/shopping': { en: 'Shopping',    'zh-CN': '购物比价' },
  'lifestyle/travel':   { en: 'Travel',      'zh-CN': '旅行出行' },
  'lifestyle/fitness':  { en: 'Fitness',     'zh-CN': '健康运动' },
  'lifestyle/food':     { en: 'Food & Living','zh-CN': '美食生活' },
  'lifestyle/pets':     { en: 'Pets',        'zh-CN': '宠物生活' },

  // Sub-categories: entertainment
  'entertainment/video':    { en: 'Video & Music',  'zh-CN': '视频音乐' },
  'entertainment/gaming':   { en: 'Gaming & Anime', 'zh-CN': '游戏动漫' },
  'entertainment/reading':  { en: 'Reading & Podcasts','zh-CN': '阅读播客' },

  // Sub-categories: other
  'other/inbox': { en: 'Inbox', 'zh-CN': '待整理' },
}

// Chinese name → internal key mapping (for backward compatibility with stored data)
const CN_TO_KEY: Record<string, string> = {
  '技术开发': 'tech-dev', '产品设计': 'product-design', '学习研究': 'learning',
  '效率工具': 'productivity', '资讯动态': 'news', '工作资料': 'work',
  '商业财经': 'business', '医疗健康': 'health', '生活消费': 'lifestyle',
  '娱乐媒体': 'entertainment', '其他': 'other',
}

// Internal key → Chinese name (reverse mapping)
const KEY_TO_CN: Record<string, string> = {}
for (const [cn, key] of Object.entries(CN_TO_KEY)) KEY_TO_CN[key] = cn

/**
 * Resolve the display name for a category path given the user's locale.
 * The internal category names (stored in bookmarks) remain in Chinese
 * for backward compatibility. This function translates them at render time.
 */
export function displayCategory(
  cnName: string,
  locale: Locale,
): string {
  if (locale === 'en') {
    const key = CN_TO_KEY[cnName]
    if (key && CATEGORY_I18N[key]) return CATEGORY_I18N[key].en
  }
  return cnName
}

/**
 * Get the full display path for a folder path.
 */
export function displayFolderPath(
  folderPath: string[],
  locale: Locale,
): string[] {
  return folderPath.map(part => displayCategory(part, locale))
}

/**
 * Get all root category display names for the given locale.
 */
export function getRootCategoryDisplayNames(locale: Locale): string[] {
  return Object.keys(CN_TO_KEY).map(cn => displayCategory(cn, locale))
}

/**
 * Get the full i18n map for use in settings dropdowns.
 * Returns { value: chineseName, label: displayName } pairs.
 */
export function getRootCategoryOptions(locale: Locale): Array<{ value: string; label: string }> {
  return Object.keys(CN_TO_KEY).map(cn => ({
    value: cn,
    label: displayCategory(cn, locale),
  }))
}

/**
 * Get child category options for a given root category.
 */
export function getChildCategoryOptions(
  rootCnName: string,
  locale: Locale,
): Array<{ value: string; label: string }> {
  const key = CN_TO_KEY[rootCnName]
  if (!key) return []

  const children = getChildKeysForRoot(key)
  return children.map(childKey => {
    const fullKey = `${key}/${childKey}`
    const entry = CATEGORY_I18N[fullKey]
    const cnName = entry ? entry['zh-CN'] : childKey
    const displayName = entry ? entry[locale] : cnName
    return { value: cnName, label: displayName }
  })
}

function getChildKeysForRoot(key: string): string[] {
  const childMap: Record<string, string[]> = {
    'tech-dev': ['frontend', 'backend', 'ai-ml', 'web3', 'data', 'devops', 'languages', 'mobile', 'security', 'testing', 'open-source'],
    'product-design': ['product-mgmt', 'ui-ux', 'resources', 'user-research', 'growth'],
    'learning': ['tutorials', 'papers', 'reports', 'courses', 'datasets', 'pkm'],
    'productivity': ['ai-tools', 'dev-tools', 'vpn', 'office', 'automation', 'extensions', 'design-tool', 'data-tool'],
    'news': ['tech-news', 'trends', 'companies', 'finance', 'community'],
    'work': ['docs', 'projects', 'admin', 'business-sys', 'careers', 'portfolio', 'legal'],
    'business': ['startup', 'research', 'marketing', 'invest', 'ecommerce'],
    'health': ['medical-data', 'wellness', 'medical-ai', 'equipment'],
    'lifestyle': ['shopping', 'travel', 'fitness', 'food', 'pets'],
    'entertainment': ['video', 'gaming', 'reading'],
    'other': ['inbox'],
  }
  return childMap[key] ?? []
}
```

- [ ] **Step 2: Update SidePanelApp to use localized category names**

In `src/sidepanel/SidePanelApp.tsx`, add the import:
```typescript
import { displayCategory, displayFolderPath } from '../lib/categoryI18n'
```

After the existing `{ t } = createTranslator(settings?.language)` line, add:
```typescript
const locale = resolveLocale(settings?.language)
```

Replace the `getFolderLabel` function to use localization. Find:
```typescript
function getFolderLabel(bookmark: Bookmark): string {
  return getFolderKey(bookmark)
}
```

Change to:
```typescript
function getFolderLabel(bookmark: Bookmark, locale: Locale): string {
  return displayFolderPath(getFolderPath(bookmark), locale).join('/')
}
```

Then update all calls to `getFolderLabel(bookmark)` to `getFolderLabel(bookmark, locale)`. Specifically:
- In `scoreBookmark`: `scoreText(getFolderLabel(bookmark), ...)` → `scoreText(getFolderLabel(bookmark, locale), ...)`
- In the BookmarkCard JSX: `{highlightText(getFolderLabel(bm), searchQuery)}` → `{highlightText(getFolderLabel(bm, locale), searchQuery)}`

- [ ] **Step 3: Update folder tree rendering in SidePanelApp**

The `folderTree` memo uses `category.name` directly. Update the display to use localized names. In the folder group button rendering, change:
```tsx
<span className="cat-name">{folder.category}</span>
```
to:
```tsx
<span className="cat-name">{displayCategory(folder.category, locale)}</span>
```

And for child categories:
```tsx
<span className="cat-name">{child.name}</span>
```
to:
```tsx
<span className="cat-name">{displayCategory(child.name, locale)}</span>
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/categoryI18n.ts src/sidepanel/SidePanelApp.tsx
git commit -m "feat: add category taxonomy i18n with English primary display"
```

---

### Task 5: Improve Search Ranking with Recency and Visit Weight

**Files:**
- Modify: `src/sidepanel/SidePanelApp.tsx` — update `scoreBookmark` function

- [ ] **Step 1: Enhance search scoring**

In `src/sidepanel/SidePanelApp.tsx`, find the `scoreBookmark` function and replace it with:

```typescript
const scoreBookmark = useCallback((bookmark: Bookmark, query: string): number => {
    const tokens = expandSearchTokens(query)
    if (!tokens.length) return 0
    let score = 0
    score += scoreText(bookmark.title, tokens, 42)
    score += scoreText(bookmark.domain, tokens, 22)
    score += scoreText(bookmark.url, tokens, 16)
    score += scoreText(bookmark.category, tokens, 20)
    score += scoreText(bookmark.subCategory, tokens, 22)
    score += scoreText(getFolderLabel(bookmark, locale), tokens, 24)
    score += scoreText(bookmark.summary, tokens, 14)
    score += scoreText(bookmark.note, tokens, 12)
    score += scoreText(bookmark.aiReason, tokens, 8)
    score += bookmark.tags.reduce((sum, tag) => sum + scoreText(tag, tokens, 28), 0)
    score += bookmark.keywords?.reduce((sum, keyword) => sum + scoreText(keyword, tokens, 24), 0) ?? 0
    score += bookmark.sourceFolderPath?.reduce((sum, folder) => sum + scoreText(folder, tokens, 10), 0) ?? 0
    // Recency: bookmarks created in last week get up to 10 bonus points
    score += Math.max(0, 10 - Math.floor((now - bookmark.createdAt) / 86400000 / 7))
    // Visit weight: frequently visited bookmarks get up to 15 bonus points
    score += Math.min(bookmark.visitCount ?? 0, 15)
    // Active status bonus: recently active bookmarks score higher
    if (bookmark.status === 'active') score += 5
    return score
  }, [now, locale])
```

Key changes from current code:
- Summary weight increased from 10 to 14
- Added visit count bonus (up to 15 points)
- Added active status bonus (5 points)
- Recency window widened from 5 to 10 bonus points

- [ ] **Step 2: Add locale to the useCallback dependency array**

The existing dependency array is `[now]`. Change to `[now, locale]`.

- [ ] **Step 3: Commit**

```bash
git add src/sidepanel/SidePanelApp.tsx
git commit -m "feat: improve search ranking with visit frequency and active status weight"
```

---

### Task 6: Improve Bulk Import Performance with Concurrent Tab Pool

**Files:**
- Modify: `src/background/service-worker.ts` — replace sequential tab analysis with concurrent pool

- [ ] **Step 1: Add concurrent pool to analyzeBookmarksByOpeningTabs**

The existing `analyzeBookmarkInTemporaryTab`, `waitForTabComplete`, `isHttpUrl`, and `hasReadableMainContent` functions are already defined. No changes needed to them.

Replace the existing sequential for-loop inside `analyzeBookmarksByOpeningTabs` (the `for (const bookmark of imported)` block starting around line 549) with a concurrent pool. Change the loop body to a function:

```typescript
  const CONCURRENT_TABS = 3
  let processedCount = 0
  let failedCount = 0
  const taskId = `${taskType}_${Date.now()}`

  await updateProcessingTask({
    id: taskId,
    type: taskType,
    status: 'running',
    total,
    processed: 0,
    failed: 0,
    startedAt: Date.now(),
    updatedAt: Date.now(),
  })

  async function processOneBookmark(bookmark: Bookmark) {
    await updateProcessingTask({
      id: taskId,
      type: taskType,
      status: 'running',
      total,
      processed: processedCount,
      failed: failedCount,
      currentTitle: bookmark.title,
      startedAt: Date.now(),
      updatedAt: Date.now(),
    })

    try {
      const analyzed = await analyzeBookmarkInTemporaryTab(bookmark, {
        active: options.active ?? false,
        closeTab: options.closeTabs ?? true,
      })
      if (analyzed.aiStatus === 'failed' || analyzed.aiError) failedCount++
    } catch (err) {
      bookmark.aiStatus = 'failed'
      bookmark.aiError = err instanceof Error ? err.message : 'Failed to analyze page'
      bookmark.updatedAt = Date.now()
      failedCount++
      await saveBookmark(bookmark)
      chrome.runtime.sendMessage({ type: 'BOOKMARK_UPDATED', payload: bookmark }).catch(() => {})
    }
    processedCount++
    await broadcastProcessingProgress(taskId, taskType, processedCount, total, failedCount)
  }

  // Process in concurrent batches of CONCURRENT_TABS
  const chunks: Bookmark[][] = []
  for (let i = 0; i < imported.length; i += CONCURRENT_TABS) {
    chunks.push(imported.slice(i, i + CONCURRENT_TABS))
  }

  for (const chunk of chunks) {
    await Promise.all(chunk.map(processOneBookmark))
  }
```

- [ ] **Step 2: Commit**

```bash
git add src/background/service-worker.ts
git commit -m "perf: process import bookmarks with concurrent tab pool (max 3)"
```

---

### Task 7: Add Cloud Adapter Types and Module Structure

**Files:**
- Create: `src/lib/cloud/config.ts`
- Create: `src/lib/cloud/client.ts`
- Create: `src/lib/cloud/auth.ts`
- Create: `src/lib/cloud/sync-engine.ts`
- Create: `src/lib/cloud/ai-proxy.ts`
- Create: `src/lib/cloud/license.ts`
- Create: `src/lib/cloud/index.ts`
- Modify: `src/types/index.ts` — add cloud-related fields to UserSettings

- [ ] **Step 1: Add cloud types to UserSettings**

In `src/types/index.ts`, add to `UserSettings`:
```typescript
  // Cloud sync
  cloudEnabled: boolean
  aiSource: 'byok' | 'cloud'
  lastSyncAt: number
```

Also add new message types to `MessageType`:
```typescript
  | 'CLOUD_LOGIN'
  | 'CLOUD_LOGOUT'
  | 'CLOUD_SYNC'
  | 'CLOUD_AI_PROCESS'
  | 'CLOUD_GET_STATUS'
```

- [ ] **Step 2: Create cloud config**

Create `src/lib/cloud/config.ts`:
```typescript
export const CLOUD_CONFIG = {
  apiBaseUrl: 'https://api.bookmarkmind.ai',
  apiVersion: 'v1',
  tokenKey: 'bai_cloud_token',
  tokenRefreshThresholdMs: 5 * 60 * 1000, // 5 minutes before expiry
  syncPollIntervalMs: 10 * 60 * 1000,     // 10 minutes
  syncPushDebounceMs: 5000,               // 5 seconds
  maxRetryAttempts: 3,
  retryBackoffMs: [1000, 2000, 4000],
}

export function getApiBaseUrl(): string {
  return `${CLOUD_CONFIG.apiBaseUrl}/api/${CLOUD_CONFIG.apiVersion}`
}
```

- [ ] **Step 3: Create cloud HTTP client**

Create `src/lib/cloud/client.ts`:
```typescript
import { getApiBaseUrl, CLOUD_CONFIG } from './config'

interface CloudResponse<T = unknown> {
  ok: boolean
  status: number
  data?: T
  error?: string
}

async function getToken(): Promise<string | null> {
  try {
    const result = await chrome.storage.local.get(CLOUD_CONFIG.tokenKey)
    return (result[CLOUD_CONFIG.tokenKey] as string | undefined) ?? null
  } catch {
    return null
  }
}

async function fetchWithAuth(
  path: string,
  init?: RequestInit,
): Promise<CloudResponse> {
  const token = await getToken()
  const url = `${getApiBaseUrl()}${path}`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  try {
    const response = await fetch(url, {
      ...init,
      headers,
    })

    if (response.status === 401) {
      return { ok: false, status: 401, error: 'Unauthorized' }
    }

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: data?.error ?? response.statusText,
      }
    }

    return { ok: true, status: response.status, data }
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : 'Network error',
    }
  }
}

export const cloud = {
  get: <T = unknown>(path: string) => fetchWithAuth(path, { method: 'GET' }) as Promise<CloudResponse<T>>,
  post: <T = unknown>(path: string, body: unknown) =>
    fetchWithAuth(path, { method: 'POST', body: JSON.stringify(body) }) as Promise<CloudResponse<T>>,
  put: <T = unknown>(path: string, body: unknown) =>
    fetchWithAuth(path, { method: 'PUT', body: JSON.stringify(body) }) as Promise<CloudResponse<T>>,
}
```

- [ ] **Step 4: Create cloud auth module**

Create `src/lib/cloud/auth.ts`:
```typescript
import { CLOUD_CONFIG } from './config'
import { cloud } from './client'

export interface CloudUser {
  id: string
  email: string
  tier: 'free' | 'pro' | 'unlimited'
  subscriptionStatus: 'inactive' | 'active' | 'past_due' | 'canceled'
}

export async function loginWithGoogle(): Promise<boolean> {
  // Opens OAuth flow via backend redirect
  // Returns true if login succeeded, false otherwise
  try {
    const redirectUri = chrome.identity.getRedirectURL('/auth/callback')
    const authUrl = `${CLOUD_CONFIG.apiBaseUrl}/api/auth/google?redirect_uri=${encodeURIComponent(redirectUri)}`

    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true,
    })

    if (!responseUrl) return false

    const params = new URLSearchParams(responseUrl.split('#')[1] ?? responseUrl.split('?')[1] ?? '')
    const token = params.get('token')
    if (!token) return false

    await chrome.storage.local.set({ [CLOUD_CONFIG.tokenKey]: token })
    return true
  } catch {
    return false
  }
}

export async function logout(): Promise<void> {
  await chrome.storage.local.remove(CLOUD_CONFIG.tokenKey)
}

export async function getCloudUser(): Promise<CloudUser | null> {
  const response = await cloud.get<CloudUser>('/user')
  if (!response.ok) return null
  return response.data ?? null
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getToken()
  return Boolean(token)
}

async function getToken(): Promise<string | null> {
  try {
    const result = await chrome.storage.local.get(CLOUD_CONFIG.tokenKey)
    return (result[CLOUD_CONFIG.tokenKey] as string | undefined) ?? null
  } catch {
    return null
  }
}
```

- [ ] **Step 5: Create cloud sync engine**

Create `src/lib/cloud/sync-engine.ts`:
```typescript
import type { Bookmark } from '../../types'
import { cloud } from './client'
import { isAuthenticated } from './auth'

export interface SyncRequest {
  lastSyncAt: string
  changes: Array<{
    id: string
    syncState: 'pending_create' | 'pending_update' | 'pending_delete'
    payload: Partial<Bookmark> | null
    syncVersion: number
  }>
}

export interface SyncResponse {
  remoteChanges: Array<{
    id: string
    action: 'create' | 'update' | 'delete'
    payload: Partial<Bookmark> | null
    syncVersion: number
  }>
  conflicts: Array<{
    id: string
    resolution: 'server_wins' | 'client_wins' | 'merge'
    payload: Partial<Bookmark>
  }>
  newLastSyncAt: string
}

export async function syncBookmarks(
  lastSyncAt: string,
  changes: SyncRequest['changes'],
): Promise<SyncResponse | null> {
  if (!await isAuthenticated()) return null
  if (!changes.length && lastSyncAt) {
    // Pull-only: no local changes, just fetch remote
    const response = await cloud.get<SyncResponse>(`/bookmarks?since=${encodeURIComponent(lastSyncAt)}`)
    if (!response.ok) return null
    return response.data ?? null
  }

  const response = await cloud.post<SyncResponse>('/bookmarks/sync', {
    lastSyncAt,
    changes,
  } satisfies SyncRequest)

  if (!response.ok) return null
  return response.data ?? null
}

export function collectPendingChanges(
  bookmarks: Bookmark[],
): SyncRequest['changes'] {
  return bookmarks
    .filter(bm => bm.syncState && bm.syncState !== 'synced')
    .map(bm => ({
      id: bm.id,
      syncState: bm.syncState as SyncRequest['changes'][number]['syncState'],
      payload: bm.syncState === 'pending_delete' ? null : bm,
      syncVersion: bm.syncVersion ?? 1,
    }))
}
```

- [ ] **Step 6: Create cloud AI proxy**

Create `src/lib/cloud/ai-proxy.ts`:
```typescript
import type { Bookmark, ExtractedContent } from '../../types'
import { cloud } from './client'
import { isAuthenticated } from './auth'

export interface AIJobResult {
  classification?: {
    folderPath: [string, string]
    tags: string[]
    confidence: number
    reason: string
  }
  summary?: string
  keywords?: string[]
}

export async function submitToCloudAI(
  bookmark: Bookmark,
  content: ExtractedContent,
): Promise<string | null> {
  // Submit bookmark metadata to cloud for AI processing
  // Returns job ID for polling
  if (!await isAuthenticated()) return null

  const response = await cloud.post<{ jobId: string }>('/ai/process', {
    bookmarkId: bookmark.id,
    title: content.title,
    url: content.url,
    description: content.description,
    category: bookmark.category,
  })

  if (!response.ok) return null
  return response.data?.jobId ?? null
}

export async function pollAIJob(jobId: string): Promise<AIJobResult | null> {
  if (!await isAuthenticated()) return null

  const response = await cloud.get<AIJobResult>(`/ai/status/${jobId}`)
  if (!response.ok) return null
  return response.data ?? null
}

/**
 * Apply cloud AI result to a bookmark.
 * Returns the updated bookmark object or null if job not ready.
 */
export function applyAIResultToBookmark(
  bookmark: Bookmark,
  result: AIJobResult,
): Bookmark {
  const updated = { ...bookmark }

  if (result.classification) {
    updated.category = result.classification.folderPath[0]
    updated.subCategory = result.classification.folderPath[1]
    updated.folderPath = result.classification.folderPath
    updated.tags = [...new Set([...updated.tags, ...result.classification.tags])]
    updated.aiCategorized = true
    updated.aiConfidence = result.classification.confidence
    updated.aiReason = result.classification.reason
  }

  if (result.summary) {
    updated.summary = result.summary
    updated.summaryGeneratedAt = Date.now()
  }

  if (result.keywords) {
    updated.keywords = result.keywords
  }

  updated.aiStatus = 'done'
  return updated
}
```

- [ ] **Step 7: Create cloud license/subscription checker**

Create `src/lib/cloud/license.ts`:
```typescript
import { cloud } from './client'
import { isAuthenticated } from './auth'

export interface LicenseInfo {
  tier: 'free' | 'pro' | 'unlimited'
  canUseCloudAI: boolean
  aiCallsUsed: number
  aiCallsLimit: number
  resetAt: string
}

export async function getLicenseInfo(): Promise<LicenseInfo | null> {
  if (!await isAuthenticated()) return null

  const response = await cloud.get<LicenseInfo>('/usage')
  if (!response.ok) return null
  return response.data ?? null
}

export async function canUseCloudAI(): Promise<boolean> {
  const license = await getLicenseInfo()
  return license?.canUseCloudAI ?? false
}
```

- [ ] **Step 8: Create cloud index barrel**

Create `src/lib/cloud/index.ts`:
```typescript
export { CLOUD_CONFIG, getApiBaseUrl } from './config'
export { cloud } from './client'
export { loginWithGoogle, logout, getCloudUser, isAuthenticated } from './auth'
export { syncBookmarks, collectPendingChanges } from './sync-engine'
export { submitToCloudAI, pollAIJob, applyAIResultToBookmark } from './ai-proxy'
export { getLicenseInfo, canUseCloudAI } from './license'
export type { CloudUser } from './auth'
export type { SyncRequest, SyncResponse } from './sync-engine'
export type { AIJobResult } from './ai-proxy'
export type { LicenseInfo } from './license'
```

- [ ] **Step 9: Commit**

```bash
git add src/lib/cloud/ src/types/index.ts
git commit -m "feat: add cloud adapter module structure with types, auth, sync, AI proxy, and license"
```

---

### Task 8: Wire Cloud Adapter into Service Worker Message Handling

**Files:**
- Modify: `src/background/service-worker.ts` — add cloud message handlers
- Modify: `src/lib/storage.ts` — trigger cloud sync on bookmark changes

- [ ] **Step 1: Add cloud message handlers to service worker**

In `src/background/service-worker.ts`, add import at the top:
```typescript
import { loginWithGoogle, logout, getCloudUser, syncBookmarks, collectPendingChanges, canUseCloudAI } from './lib/cloud'
```

Add new cases to the `handleMessage` function's switch statement, before the `default` case:

```typescript
    case 'CLOUD_LOGIN': {
      const success = await loginWithGoogle()
      if (success) {
        const user = await getCloudUser()
        return { success: true, data: user }
      }
      return { success: false, error: 'Login failed' }
    }

    case 'CLOUD_LOGOUT': {
      await logout()
      return { success: true }
    }

    case 'CLOUD_SYNC': {
      const bookmarks = await getAllBookmarks()
      const settings = await getSettings()
      const lastSyncAt = settings.lastSyncAt ? new Date(settings.lastSyncAt).toISOString() : '1970-01-01T00:00:00Z'
      const changes = collectPendingChanges(bookmarks)

      if (!changes.length) {
        // Pull-only sync
        const result = await syncBookmarks(lastSyncAt, [])
        if (!result) return { success: false, error: 'Sync failed' }

        // Apply remote changes locally
        await applyRemoteSync(result.remoteChanges)

        await updateSettings({ lastSyncAt: Date.now() })
        return { success: true, data: { synced: result.remoteChanges.length } }
      }

      const result = await syncBookmarks(lastSyncAt, changes)
      if (!result) return { success: false, error: 'Sync failed' }

      // Apply remote changes and conflicts
      await applyRemoteSync(result.remoteChanges)
      await applyConflictResolutions(result.conflicts)

      // Mark synced locally
      const syncedIds = new Set([
        ...changes.map(c => c.id),
        ...result.remoteChanges.map(c => c.id),
      ])
      await markBookmarksSynced(Array.from(syncedIds))

      await updateSettings({ lastSyncAt: Date.now() })
      return { success: true, data: { synced: result.remoteChanges.length + changes.length } }
    }

    case 'CLOUD_GET_STATUS': {
      const user = await getCloudUser()
      return { success: true, data: user }
    }
```

- [ ] **Step 2: Add sync helper functions**

Add these helper functions before the `handleMessage` function:

```typescript
async function applyRemoteSync(changes: Array<{ action: string; payload: Partial<Bookmark> | null }>): Promise<void> {
  for (const change of changes) {
    if (change.action === 'delete' && change.payload) {
      await deleteBookmark(change.payload.id!)
    } else if (change.payload?.id) {
      const bookmarks = await getAllBookmarks()
      const existing = bookmarks.find(b => b.id === change.payload!.id)
      if (existing) {
        const merged = { ...existing, ...change.payload, syncState: 'synced' as const }
        await saveBookmark(merged)
      } else {
        await saveBookmark(change.payload as Bookmark)
      }
    }
  }
}

async function applyConflictResolutions(
  conflicts: Array<{ id: string; resolution: string; payload: Partial<Bookmark> }>,
): Promise<void> {
  for (const conflict of conflicts) {
    const bookmarks = await getAllBookmarks()
    const existing = bookmarks.find(b => b.id === conflict.id)
    if (existing) {
      const merged = { ...existing, ...conflict.payload, syncState: 'synced' as const }
      await saveBookmark(merged)
    }
  }
}

async function markBookmarksSynced(ids: string[]): Promise<void> {
  const bookmarks = await getAllBookmarks()
  for (const bm of bookmarks) {
    if (ids.includes(bm.id) && bm.syncState !== 'synced') {
      bm.syncState = 'synced'
      await saveBookmark(bm)
    }
  }
}
```

- [ ] **Step 3: Trigger cloud sync after bookmark save**

In `src/lib/storage.ts`, after `saveBookmark` completes (the line `return saved`), we need to enqueue a cloud sync push. Add before the return:

```typescript
  // Enqueue cloud sync push if cloud is enabled
  enqueueCloudSyncPush(saved.id)
```

Add the `enqueueCloudSyncPush` function at the bottom of the file:

```typescript
let cloudSyncTimer: ReturnType<typeof setTimeout> | null = null

function enqueueCloudSyncPush(bookmarkId: string): void {
  // Debounced cloud sync: wait 5s after last write
  if (cloudSyncTimer) clearTimeout(cloudSyncTimer)
  cloudSyncTimer = setTimeout(async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'CLOUD_SYNC' })
    } catch {
      // Cloud not available — silent fallback
    }
  }, 5000)
}
```

- [ ] **Step 4: Commit**

```bash
git add src/background/service-worker.ts src/lib/storage.ts
git commit -m "feat: wire cloud adapter into service worker message handling and storage layer"
```

---

### Task 9: Add Cloud Settings UI to Options Page

**Files:**
- Modify: `src/options/OptionsApp.tsx` — add cloud account section

- [ ] **Step 1: Add cloud state and UI to OptionsApp**

In `src/options/OptionsApp.tsx`, add imports:
```typescript
import { loginWithGoogle, logout, getCloudUser, isAuthenticated } from '../lib/cloud'
import type { CloudUser } from '../lib/cloud'
```

Add state after existing `languageSwitcherRef`:
```typescript
const [cloudUser, setCloudUser] = useState<CloudUser | null>(null)
const [cloudAuthenticated, setCloudAuthenticated] = useState(false)
```

Add effect to check auth status after the existing settings load effect:
```typescript
useEffect(() => {
  void (async () => {
    const authed = await isAuthenticated()
    setCloudAuthenticated(authed)
    if (authed) {
      const user = await getCloudUser()
      setCloudUser(user)
    }
  })()
}, [])
```

- [ ] **Step 2: Add Cloud Account section to the settings page JSX**

Find the section where AI service settings end (look for the closing `</section>` after the AI settings). Add a new section before it:

```tsx
<section className="settings-section">
  <h3>Cloud Account</h3>
  {cloudAuthenticated && cloudUser ? (
    <div className="cloud-account-card">
      <div className="cloud-user-info">
        <span className="cloud-user-email">{cloudUser.email}</span>
        <span className={`cloud-tier-badge ${cloudUser.tier}`}>
          {cloudUser.tier.charAt(0).toUpperCase() + cloudUser.tier.slice(1)}
        </span>
      </div>
      <p className="cloud-status">
        Sync: {cloudUser.subscriptionStatus === 'active' ? 'Active' : 'Local mode only'}
      </p>
      <div className="cloud-actions">
        <button className="btn btn-ghost btn-sm" onClick={async () => {
          await logout()
          setCloudAuthenticated(false)
          setCloudUser(null)
        }}>
          Sign Out
        </button>
        {cloudUser.tier === 'free' && (
          <a className="btn btn-primary btn-sm" href="https://bookmarkmind.ai/pricing" target="_blank" rel="noopener">
            Upgrade to Pro
          </a>
        )}
      </div>
    </div>
  ) : (
    <div className="cloud-account-card">
      <p>Sign in to enable cloud sync and cross-device knowledge base.</p>
      <button className="btn btn-primary" onClick={async () => {
        const success = await loginWithGoogle()
        if (success) {
          setCloudAuthenticated(true)
          const user = await getCloudUser()
          setCloudUser(user)
        }
      }}>
        Sign in with Google
      </button>
    </div>
  )}
</section>
```

- [ ] **Step 3: Add minimal CSS for cloud account card**

In `src/options/options.css`, add:
```css
.cloud-account-card {
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 8px;
}
.cloud-user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.cloud-user-email {
  font-weight: 500;
}
.cloud-tier-badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}
.cloud-tier-badge.pro {
  background: #dbeafe;
  color: #1d4ed8;
}
.cloud-tier-badge.unlimited {
  background: #d1fae5;
  color: #047857;
}
.cloud-tier-badge.free {
  background: #f3f4f6;
  color: #6b7280;
}
.cloud-status {
  color: var(--text-muted, #6b7280);
  font-size: 13px;
  margin-bottom: 12px;
}
.cloud-actions {
  display: flex;
  gap: 8px;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/options/OptionsApp.tsx src/options/options.css
git commit -m "feat: add cloud account sign-in section to settings page"
```

---

### Task 10: Add Sync Status Indicator to Side Panel Header

**Files:**
- Modify: `src/sidepanel/SidePanelApp.tsx` — add sync status indicator

- [ ] **Step 1: Add sync state to SidePanelApp**

Add state:
```typescript
const [syncing, setSyncing] = useState(false)
const [lastSynced, setLastSynced] = useState<number | null>(null)
```

Add a manual sync handler:
```typescript
const handleSync = useCallback(async () => {
    setSyncing(true)
    const res = await chrome.runtime.sendMessage({ type: 'CLOUD_SYNC' })
    setSyncing(false)
    if (res.success) {
      setLastSynced(Date.now())
      const [bmRes, catRes] = await Promise.all([
        chrome.runtime.sendMessage({ type: 'GET_BOOKMARKS' }),
        chrome.runtime.sendMessage({ type: 'GET_CATEGORIES' }),
      ])
      if (bmRes.success) setBookmarks(bmRes.data.filter((b: Bookmark) => !b.isArchived))
      if (catRes.success) setCategories(catRes.data)
    }
  }, [])
```

- [ ] **Step 2: Add sync button to header**

In the header actions `<div className="sp-header-actions">`, add before the settings button:
```tsx
{cloudAuthenticated && (
  <button
    className={`btn btn-ghost btn-sm sync-btn ${syncing ? 'syncing' : ''}`}
    onClick={handleSync}
    aria-label="Sync with cloud"
  >
    {syncing ? '↻' : '↻'}
  </button>
)}
```

- [ ] **Step 3: Add sync button styles**

In `src/sidepanel/sidepanel.css`, add:
```css
.sync-btn.syncing {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/sidepanel/SidePanelApp.tsx src/sidepanel/sidepanel.css
git commit -m "feat: add cloud sync button to side panel header"
```

---

### Task 11: Final Build Verification and Polish

**Files:**
- No new files — verify all existing changes compile

- [ ] **Step 1: Run full type check**

Run:
```bash
npm run build
```
Expected: Clean build with no TypeScript errors.

- [ ] **Step 2: Run linter**

Run:
```bash
npm run lint
```
Expected: No lint errors. If there are, fix them.

- [ ] **Step 3: Run all tests**

Run:
```bash
npm run test
```
Expected: All tests pass.

- [ ] **Step 4: Verify cloud adapter is properly gated**

Verify that if cloud module is not initialized (no backend deployed), the extension still works normally. The cloud functions all return `null`/`false` when not authenticated, and message handlers gracefully handle failures. No additional code needed — this is by design.

- [ ] **Step 5: Commit any remaining fixes**

```bash
git add -A
git commit -m "fix: address build and lint issues from cloud adapter integration"
```
