# BookmarkMind AI: Open Source Optimization & Cloud Extension Design

**Date:** 2026-05-08
**Status:** Draft — awaiting review
**Author:** Claude

## Overview

BookmarkMind AI is a local-first Chrome/Edge extension for AI-powered bookmark management. This design covers two parallel goals:

1. **Optimize the open-source core** for community growth and adoption (targeting English-speaking international users).
2. **Design a paid cloud service** that extends the extension with sync, cloud AI, and multi-device knowledge base.

The business model is **Hybrid**: the free extension remains fully functional in local mode. Paid users unlock cloud sync and managed AI. The codebase follows a **dual-repository** strategy: core extension stays open-source, cloud backend is private.

## Global Constraint: English-First, International Market

- Default language: **en-US**. Chinese is an optional secondary locale.
- All UI copy, prompts, error messages, and documentation default to English.
- Chrome Web Store listing, screenshots, landing page, and privacy policy in English.
- Category taxonomy requires an English→locale mapping layer (internal names stay stable; display names are localized).
- Pricing in USD. Payment via Stripe.
- AI prompts generated in English by default; user language setting controls output language.

---

## Line 1: Open Source Optimization (Public Repository)

### 1.1 Foundation

| Item | Description |
|---|---|
| **License** | MIT — permissive, no restrictions on commercial derivatives |
| **CONTRIBUTING.md** | Dev setup, commit convention, PR process, code style |
| **Issue templates** | Bug Report, Feature Request, Question (GitHub issue forms) |
| **CHANGELOG.md** | Auto-generated from commits via `conventional-changelog` |
| **GitHub Releases** | CI builds `.zip` artifact on tag, ready for Chrome sideload |
| **Privacy Policy** | Static page: what data leaves the browser, which AI providers receive content, BYOK disclaimer |

### 1.2 CI/CD & Quality

**GitHub Actions workflow (`.github/workflows/ci.yml`):**
- On PR: `npm install` → `npm run lint` → `npm run build` → run tests
- On push to `main`: build + upload dist as artifact
- On tag `v*`: create GitHub Release with `.zip` and `.crx` attachment

**Testing strategy:**
- **Unit tests** (Vitest):
  - `bookmarkTaxonomy.ts`: every regex rule tested against known domains and false-positive URLs
  - `storage.ts`: bookmark CRUD, URL normalization, duplicate detection, bulk import edge cases
  - `ai.ts`: prompt builder, summary normalization, known-domain fallback
  - `bookmarkImport.ts`: HTML parsing, Chrome bookmark JSON import
- **Integration tests** (Playwright or crx-test):
  - Install extension in headless Chrome, save a page, verify IndexedDB state
  - Import bookmarks HTML, verify staging folder behavior
- **Target coverage:** >70% on `src/lib/`, >50% overall

### 1.3 UX Polish

| Area | Current State | Target |
|---|---|---|
| **Bulk import** | Opens one tab per URL sequentially; 1000 bookmarks = very slow | Concurrent tab pool (max 3), pause/resume, progress bar with ETA |
| **Search ranking** | BM25-weighted heuristic | Add category weight, user-edit boost, recent-visit boost |
| **Knowledge cards** | Basic edit in Side Panel | Batch edit tags/categories, drag-to-reorder, inline rename |
| **Accessibility** | Not audited | WCAG AA: aria-labels, keyboard nav, color contrast >4.5:1 |
| **Empty state** | Minimal | Illustrations, guided onboarding, "save your first bookmark" CTA |

### 1.4 Localization Strategy

**Category taxonomy localization:**
- Internal category keys remain stable (e.g., `tech-dev`, `product-design`) — never change these.
- Display names are resolved through a locale map in `src/lib/i18n.ts`:

```typescript
// Internal key → display name per locale
const CATEGORY_I18N: Record<string, Record<AppLanguage, string>> = {
  'tech-dev':       { 'en': 'Tech & Development', 'zh-CN': '技术开发' },
  'product-design': { 'en': 'Product & Design',    'zh-CN': '产品设计' },
  // ... all 11 top-level categories + sub-categories
}
```

- Default `AppLanguage` changes from `'auto'` → `'en'` for new installs.
- AI prompts use English category names; output is in user's selected language.
- All existing i18n strings in `src/lib/i18n.ts` should have English as the primary key, with `zh-CN` as the fallback translation.

### 1.5 Community & Distribution

- **Chrome Web Store**: launch with 5 screenshots, English description, privacy disclosure
- **README**: English-first, Chinese as secondary section
- **Landing page**: static site (VitePress or Astro) with features, screenshots, download links, pricing teaser
- **Roadmap**: public GitHub Projects board with "In Progress", "Up Next", "Done" columns

---

## Line 2: Cloud Backend (Private Repository)

### 2.1 Tech Stack

| Component | Choice | Rationale |
|---|---|---|
| **Framework** | Hono (TypeScript) | Lightweight, edge-compatible, simple routing |
| **Deploy** | Cloudflare Workers | Global edge, generous free tier, fast cold start |
| **Database** | PostgreSQL (Neon or Supabase) | ACID, row-level security, JSONB for flexible payloads |
| **Cache** | Cloudflare KV or Upstash Redis | Session tokens, rate limit counters |
| **Object Storage** | Cloudflare R2 | User export files, backup archives |
| **Auth** | Supabase Auth or Clerk | Google OAuth, email/password, session management |
| **Payments** | Stripe | International standard, subscription management, webhooks |
| **AI Orchestration** | Direct OpenAI-compatible calls | Backend calls the model on behalf of user, returns result |

### 2.2 Database Schema

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  stripe_customer_id TEXT,
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'unlimited')),
  subscription_status TEXT DEFAULT 'inactive' CHECK (subscription_status IN ('inactive', 'active', 'past_due', 'canceled')),
  subscription_ends_at TIMESTAMPTZ
);

-- Bookmarks
CREATE TABLE bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url_hash TEXT NOT NULL,               -- SHA-256 of normalized URL, unique per user
  title TEXT NOT NULL,
  summary TEXT,
  tags TEXT[] DEFAULT '{}',
  category TEXT,
  sub_category TEXT,
  folder_path TEXT[],
  keywords TEXT[],
  favicon TEXT,
  domain TEXT,
  status TEXT DEFAULT 'active',
  is_archived BOOLEAN DEFAULT FALSE,
  content_hash TEXT,
  sync_version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,              -- tombstone for sync
  UNIQUE (user_id, url_hash)
);

-- Sync events (for incremental sync & conflict detection)
CREATE TABLE sync_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bookmark_id UUID NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('create', 'update', 'delete')),
  version INT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage records (monthly AI call tracking)
CREATE TABLE usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ai_calls_count INT DEFAULT 0,
  ai_calls_limit INT DEFAULT 0,         -- 0 = unlimited (Unlimited tier)
  reset_at TIMESTAMPTZ NOT NULL
);

-- AI processing queue (async)
CREATE TABLE ai_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bookmark_id UUID NOT NULL REFERENCES bookmarks(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_sync_events_user_created ON sync_events(user_id, created_at);
CREATE INDEX idx_ai_jobs_user_status ON ai_jobs(user_id, status);
CREATE INDEX idx_bookmarks_user_updated ON bookmarks(user_id, updated_at);
CREATE INDEX idx_usage_records_user_reset ON usage_records(user_id, reset_at);
```

### 2.3 API Endpoints

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/auth/login` | POST | — | Google OAuth callback / email login, returns JWT |
| `/api/user` | GET | JWT | User info, subscription tier, usage stats |
| `/api/bookmarks` | GET | JWT | List bookmarks; supports `?since=<ts>` for incremental pull |
| `/api/bookmarks/sync` | POST | JWT | Full sync handshake (see §2.4) |
| `/api/bookmarks/:id` | PUT | JWT | Single bookmark update |
| `/api/ai/process` | POST | JWT | Submit bookmark for cloud AI processing (Pro+ only) |
| `/api/ai/status/:jobId` | GET | JWT | Check AI job status |
| `/api/usage` | GET | JWT | Current AI usage, limits, reset date |
| `/api/export` | POST | JWT | Trigger export, returns R2 download URL |
| `/api/billing/webhook` | POST | Stripe signature | Stripe subscription event handler |

### 2.4 Sync Protocol

The extension already has `syncState` (`pending_create`, `pending_update`, `pending_delete`, `synced`, `conflict`) and `syncVersion` fields. The cloud sync protocol builds on this:

**Handshake flow:**
```
Client → Server: POST /api/bookmarks/sync
{
  "lastSyncAt": "2026-05-08T10:00:00Z",
  "changes": [
    { "id": "...", "syncState": "pending_update", "payload": {...}, "syncVersion": 3 },
    { "id": "...", "syncState": "pending_delete", "payload": null }
  ]
}

Server → Client:
{
  "remoteChanges": [
    { "id": "...", "action": "create" | "update" | "delete", "payload": {...}, "syncVersion": 2 }
  ],
  "conflicts": [
    { "id": "...", "resolution": "server_wins" | "client_wins" | "merge", "payload": {...} }
  ],
  "newLastSyncAt": "2026-05-08T10:05:00Z"
}
```

**Conflict resolution rules:**
1. If client `syncVersion` > server `syncVersion` → **client wins** (user made a newer edit)
2. If server `syncVersion` > client `syncVersion` → **server wins** (another device edited first)
3. If versions equal but content differs → **merge**: user-edited fields (note, folderPath, tags) keep client values; AI-generated fields (summary, keywords) take server values
4. Conflicts are logged but never block sync

### 2.5 Pricing Tiers

| Feature | Free | Pro ($5/mo) | Unlimited ($12/mo) |
|---|---|---|---|
| Local AI (BYOK) | Yes (unlimited) | Yes (unlimited) | Yes (unlimited) |
| Cloud AI calls | No | 500/mo | Unlimited |
| Synced devices | 1 (local only) | 3 | Unlimited |
| Cloud backup | No | 30-day history | Unlimited history |
| Priority support | No | No | Yes |

**Key principle:** Free users lose nothing compared to the current extension. Cloud is additive.

### 2.6 AI Proxy

When a user has Cloud AI enabled:
1. Extension sends `{ title, url, description, category }` to `/api/ai/process`
2. Server queues the job in `ai_jobs`
3. A background worker picks up the job, calls the configured AI provider (using server-side API key)
4. Result (category, tags, summary, keywords) is stored in `ai_jobs.result`
5. Extension polls `/api/ai/status/:jobId` until result is ready
6. Extension applies the result locally via `saveBookmark`

Page body is **not** sent to the cloud AI by default — only metadata. If user opts in, body can be sent (configurable in settings).

---

## Line 3: Extension Cloud Adapter (In Core Repository)

### 3.1 Module Structure

```
src/lib/cloud/
  ├── client.ts          # HTTP client: fetch wrapper, retries, token attachment
  ├── auth.ts            # OAuth login, token refresh, session management
  ├── sync-engine.ts     # Sync handshake, change collection, remote change application
  ├── ai-proxy.ts        # Cloud AI submission & result polling
  ├── license.ts         # Subscription status check, feature gate
  └── config.ts          # API base URL, feature flags, version
```

### 3.2 Authentication Flow

1. User clicks "Sign in with Google" in Settings
2. `chrome.identity.launchWebAuthFlow` opens OAuth window to backend
3. Backend validates, creates/links user, returns JWT
4. JWT stored in `chrome.storage.local` as `bai_cloud_token` (encrypted via `crypto.subtle` or simple obfuscation)
5. Token auto-refreshes 5 minutes before expiry
6. On network failure or 401, silently fall back to local mode — no UI disruption

### 3.3 Sync Triggers

| Trigger | Behavior |
|---|---|
| **Local write** | `saveBookmark` / `deleteBookmark` sets `syncState` → enqueues push within 5s (debounced) |
| **Background poll** | Every 10 minutes, pull `since = lastSyncAt` |
| **Extension install** | Service worker `install` event: check `lastSyncAt`, pull offline changes |
| **Manual** | "Sync Now" button in Side Panel |

### 3.4 AI Source Toggle

Settings UI adds an "AI Source" radio group:
- **Your API Key (BYOK)** — current behavior, extension calls user's provider directly
- **Cloud AI** — extension sends bookmark metadata to `/api/ai/process`, result applied locally

If subscription expires, automatically revert to BYOK and show a one-time notification.

### 3.5 Settings Changes

`UserSettings` type extended:

```typescript
interface UserSettings {
  // ... existing fields ...
  // Cloud
  cloudEnabled: boolean;          // Whether cloud sync is active
  aiSource: 'byok' | 'cloud';     // AI call source
  lastSyncAt: number;             // Timestamp of last successful sync
}
```

### 3.6 UI Additions

**Settings page (OptionsApp) — new section:**
```
┌─ Cloud Account ──────────────────────┐
│  [Sign in with Google]               │
│  Status: Free plan · Local mode only │
│                                      │
│  [Upgrade to Pro]                    │
└──────────────────────────────────────┘

┌─ AI Source ──────────────────────────┐
│  ○ Use my API key (BYOK)             │
│  ● Cloud AI (Pro feature)            │
└──────────────────────────────────────┘

┌─ Sync ───────────────────────────────┐
│  Last synced: 2 minutes ago          │
│  [Sync Now]                          │
└──────────────────────────────────────┘
```

**Side Panel (SidePanelApp) — sync indicator:**
- Small sync icon in the header (green = synced, gray = offline, spinning = syncing)
- Click opens sync detail modal

### 3.7 Integration Points

| Existing Module | Integration |
|---|---|
| `service-worker.ts` | New message handlers: `CLOUD_LOGIN`, `CLOUD_LOGOUT`, `CLOUD_SYNC`, `CLOUD_AI_PROCESS` |
| `storage.ts` | After `saveBookmark`/`deleteBookmark`, if cloud enabled, set `syncState` and trigger push |
| `ai.ts` | `classifyBookmark` / `generateSummary`: check `aiSource`; if `cloud` and user is Pro+, route through cloud proxy |
| `types/index.ts` | Add `cloudEnabled`, `aiSource`, `lastSyncAt` to `UserSettings` |
| `sidepanel/SidePanelApp.tsx` | Add sync status indicator, login entry point |
| `options/OptionsApp.tsx` | Add Cloud configuration section (auth, sync, AI source) |

### 3.8 Fallback & Safety

| Scenario | Behavior |
|---|---|
| No backend deployed | Cloud adapter never initializes; extension behaves identically to current version |
| Network failure | All local features work normally; sync states remain `pending`, retry on reconnect |
| Token expired | Silent fallback to local mode; show subtle "Sign in to resume sync" banner |
| Rate limited | Exponential backoff on sync requests (1s → 2s → 4s → 8s, max 60s) |
| Subscription lapsed | Auto-revert to BYOK; preserve all local data; one-time notification |

---

## Build Order & Dependencies

```
Phase 1 (Weeks 1-3): Open Source Foundation
├── 1.1 Add MIT license, CONTRIBUTING.md, issue templates
├── 1.2 Set up GitHub Actions CI
├── 1.3 Add Vitest, write classifier + storage tests
└── 1.4 Localize taxonomy (English primary, zh-CN secondary)

Phase 2 (Weeks 3-6): Open Source UX & Distribution
├── 2.1 Batch import performance improvement (concurrent tabs, pause/resume)
├── 2.2 Search ranking improvements
├── 2.3 Chrome Web Store preparation
└── 2.4 Landing page + README English rewrite

Phase 3 (Weeks 6-10): Cloud Backend MVP
├── 3.1 Set up Hono + PostgreSQL + Auth
├── 3.2 Implement user CRUD + bookmarks CRUD API
├── 3.3 Implement sync protocol (§2.4)
└── 3.4 Stripe integration + webhook handler

Phase 4 (Weeks 10-13): Cloud Adapter in Extension
├── 4.1 Add cloud adapter module structure
├── 4.2 Implement auth flow (OAuth + token management)
├── 4.3 Implement sync engine (local → server → remote)
└── 4.4 Implement cloud AI proxy

Phase 5 (Weeks 13-15): Polish & Launch
├── 5.1 End-to-end sync testing
├── 5.2 Error handling, edge cases, offline resilience
├── 5.3 Chrome Web Store launch
└── 5.4 Cloud billing launch (Pro + Unlimited)
```

**Dependency chain:** Phase 1 → Phase 2 can proceed in parallel with Phase 3 start. Phase 4 requires Phase 3 API to be stable. Phase 5 requires everything complete.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Chrome Web Store review rejection | Delay launch | Prepare privacy policy, data disclosure, test thoroughly before submission |
| Sync conflicts corrupt data | Data loss | Conflict resolution is non-destructive; all versions preserved in `sync_events` |
| Cloud backend cost exceeds revenue | Financial loss | Cloudflare Workers free tier covers initial users; monitor cost per user |
| BYOK users feel pressured to pay | Churn | Free tier explicitly keeps all local features; cloud is additive only |
| AI proxy latency > local | UX degradation | Show processing state in UI; allow fallback to BYOK for speed |
