# BookmarkMind AI

**AI Bookmark Manager & Personal Knowledge Assistant**

BookmarkMind AI 是一款本地优先的 AI 书签管理插件，面向 Chrome 和 Microsoft Edge。它不只是保存网页链接，而是读取网页内容，自动生成摘要、标签和两级目录分类，把杂乱的收藏夹整理成可搜索、可回顾、可长期复用的个人知识库。

> 让收藏夹真正变成知识库。

## 产品定位

BookmarkMind AI 解决的是传统收藏夹的三个问题：

- 收藏容易，整理困难。
- 目录混乱，重复和沉睡书签越来越多。
- 搜索只能靠标题和 URL，无法按语义、摘要、标签、领域快速找回。

当前版本采用 **local-first + BYOK** 路线：

- 书签、设置、分类、摘要默认保存在浏览器本地。
- 用户使用自己的 OpenAI-compatible API Key，不受插件额度限制。
- API Key 保存在浏览器本地，不上传到项目服务器。
- 支持 Chrome 和 Edge，基于 Chromium Manifest V3。
- 后续可扩展官方托管 AI 服务、账号登录、云端同步和多设备知识库。

## 核心能力

- 一键收藏当前页面。
- 自动读取网页标题、URL、描述、正文和 favicon。
- AI 自动生成摘要、标签、关键词。
- AI + 本地规则自动归入规范两级目录。
- 支持手动编辑目录、标签和备注。
- 支持导入 Chrome / Edge 收藏夹 HTML 文件。
- 导入时不会直接沿用旧收藏夹混乱目录，而是先进入 `其他 / 待整理`，分析后重新归入规范目录。
- 支持 JSON / Markdown / HTML 导出。
- 支持本地加权搜索，按标题、域名、目录、标签、关键词、摘要综合排序。
- 支持中英文界面。
- 支持活跃、搁置、沉睡等书签健康状态。

## 智能分类逻辑

BookmarkMind AI 使用“固定目录体系 + 强规则优先 + AI 判别 + 低置信度待整理”的策略。

### 为什么不用完全自由分类

如果完全让 AI 自由创建目录，导入一次旧收藏夹就可能产生大量不稳定目录，例如 `WEB`、`ORG`、`tool`、`crazy`。这会让产品重新变成另一个混乱收藏夹。

因此当前设计限制为最多两级目录：

- 一级目录保持稳定，便于长期维护。
- 二级目录表达具体领域。
- 标签用于横向检索，可以比目录更细。

### 示例

- `Pricing | Proton VPN` -> `效率工具 / 网络代理`
- `Solana Devnet Faucet - Airdrop SOL` -> `技术开发 / Web3与区块链`
- `React Server Components Guide` -> `技术开发 / 前端开发`
- `PostgreSQL Performance Tuning` -> `技术开发 / 数据库与数据工程`

## AI 模型配置

当前版本推荐使用自带 API Key。

支持所有 OpenAI-compatible Chat Completions 接口，包括：

- DeepSeek
- Kimi
- OpenAI
- OpenRouter
- SiliconFlow
- 通义千问 DashScope
- 火山方舟
- 智谱 BigModel
- Groq
- Together AI
- Perplexity
- Custom OpenAI-compatible API

切换模型厂商时，插件会自动填入默认 `Base URL` 和模型名。用户只需要填写 API Key；如果服务商模型更新，也可以手动覆盖 `Base URL` 和 `Model`。

## 免费与付费策略

当前版本：

- **自带 Key 模式免费使用。**
- 用户自己承担模型厂商 API 费用。
- 插件不限制用户自带 Key 的 AI 调用次数。

后续商业化建议分两层：

1. **AI 服务包**
   - 官方提供托管 AI 模型。
   - 免费用户每月 100 次 AI 调用。
   - 付费用户每月不限量使用自动分类、标签、摘要。

2. **云托管包**
   - 包含 AI 服务包。
   - 增加账号登录、云端数据同步、多设备访问、备份恢复。

登录策略建议：

- AI 服务包可以先不强制登录，用浏览器本地匿名 ID 记录免费额度。
- 涉及付费、云同步、多设备时必须登录。
- 登录方式优先支持邮箱验证码，其次支持 Google / Microsoft OAuth。

## 安装开发环境

```powershell
npm install
```

## 本地开发

```powershell
npm run dev
```

## 构建

```powershell
npm run build
```

构建产物位于 `dist` 目录。

## 质量验证

```powershell
npx tsc --noEmit
npm run lint
npm run build
```

当前环境验证结果：

- `npx tsc --noEmit` 通过。
- `npm run lint` 通过。
- `npm run build` 通过。

## Chrome 加载本地扩展

1. 执行 `npm run build`。
2. 打开 `chrome://extensions`。
3. 开启 `Developer mode`。
4. 点击 `Load unpacked`。
5. 选择项目下的 `dist` 目录。

## Edge 加载本地扩展

1. 执行 `npm run build`。
2. 打开 `edge://extensions`。
3. 开启 `Developer mode`。
4. 点击 `Load unpacked`。
5. 选择项目下的 `dist` 目录。

## 使用流程

1. 打开扩展设置页。
2. 选择模型厂商，填写 API Key。
3. 保存当前网页。
4. 等待 AI 自动分类、添加标签并生成摘要。
5. 在侧边栏中搜索、筛选、编辑和整理书签。
6. 如需迁移旧收藏夹，导入 Chrome / Edge 导出的 HTML 文件。

## 快捷入口

- 点击扩展图标：打开快速收藏弹窗。
- 右键网页空白处：选择“保存并整理此页面”或“打开 BookmarkMind AI 面板”。
- 快捷键 `Alt+B`：打开扩展弹窗。
- 快捷键 `Alt+Shift+S`：保存当前页面并触发 AI 整理。
- 快捷键 `Alt+Shift+M`：打开 BookmarkMind AI 侧边栏。

## 导入收藏夹逻辑

导入 Chrome / Edge 收藏夹 HTML 时：

- 原浏览器目录不会直接显示在左侧目录树。
- 原目录仅作为分类上下文保存。
- 新导入书签先进入 `其他 / 待整理`。
- 后台分析完成后，移动到规范两级目录。
- 重复书签不会重复新增。
- 已存在但未摘要或分析失败的书签，会进入补处理队列。

## 技术栈

- React 19
- TypeScript
- Vite
- Chrome Extension Manifest V3
- Chrome Side Panel API
- IndexedDB：存储书签主体、摘要、标签、关键词、AI 状态等高容量数据
- Chrome Storage Local：存储设置、目录、迁移标记和轻量状态
- OpenAI-compatible Chat Completions API

## 本地数据层与云同步兼容

当前版本已将书签主体迁移到 IndexedDB：

- 首次启动会自动把旧版本 `chrome.storage.local` 中的 `bai_bookmarks` 迁移到 IndexedDB。
- 迁移成功后会移除旧的大数组，释放 `chrome.storage.local` 容量。
- 设置、目录、免费 AI 用量、迁移版本仍保存在 `chrome.storage.local`，便于快速读取和兼容 Manifest V3。
- 删除书签采用云同步友好的 tombstone 字段：`deletedAt`、`syncState: pending_delete`。
- 每个书签预留云同步字段：`remoteId`、`syncState`、`syncVersion`、`syncUpdatedAt`。
- 普通本地读取会过滤已删除 tombstone；未来接入云同步时，同步层可以读取这些字段处理创建、更新、删除和冲突。

后续接入云端时建议保持三层结构：

1. 本地仓储层：IndexedDB，负责离线可用和快速检索。
2. 同步队列层：读取 `syncState`，批量上传 pending changes，处理冲突。
3. 云端 API 层：账号、设备、远程书签、版本号、删除 tombstone 和增量同步。

## 目录结构

```text
src/
  background/       Service Worker、消息处理、AI 异步处理
  content/          页面内容提取脚本
  lib/              AI、存储、分类体系、导入解析、国际化
  options/          设置页
  popup/            Popup 快速收藏入口
  sidepanel/        书签知识库主界面
  styles/           设计系统样式
  types/            核心类型定义
docs/               产品、上线和推广文档
dist/               构建产物
```

## 上线检查清单

- 完成 Chrome / Edge 手动安装测试。
- 验证新用户首次打开配置流程。
- 验证 DeepSeek / OpenAI-compatible API 配置。
- 验证保存当前页、AI 分类、摘要、标签生成。
- 验证导入 Chrome / Edge 收藏夹 HTML。
- 验证导入后目录不会被旧收藏夹目录污染。
- 验证搜索、筛选、编辑目录、删除目录。
- 准备隐私政策，说明 API Key 本地保存、页面内容可能发送给用户配置的模型服务商。
- 准备商店截图、功能说明、权限说明。
- 准备官网或落地页。

## 推广方向

早期推广重点不是“又一个书签插件”，而是强调：

- AI 自动整理收藏夹。
- 导入旧收藏夹后自动重新归类。
- 收藏网页自动变成摘要知识卡片。
- 本地优先，自带 Key，不绑定云服务。

适合的推广渠道：

- Chrome Web Store / Edge Add-ons。
- Product Hunt。
- V2EX、少数派、即刻、小红书、知乎。
- 开发者社区：掘金、博客园、Indie Hackers。
- AI 工具导航站。

推荐内容标题：

- “我做了一个能自动整理收藏夹的 AI 插件”
- “把沉睡多年的 Chrome 收藏夹整理成 AI 知识库”
- “不上传账号、不绑云服务，用自己的 API Key 管理书签”

## 相关文档

- 产品需求：[AI书签插件产品需求分析.md](./AI书签插件产品需求分析.md)
- 上线与推广：[docs/上线与推广计划.md](./docs/上线与推广计划.md)

## 本地模式优化路线

当前本地模式优先保证“简单、可见、可恢复”：

- P0：导入 Chrome / Edge 收藏夹后，会显示本地 AI 整理进度、已处理数量和失败数量。
- P0：失败或未生成摘要的书签可以一键重试，不需要用户逐条排查。
- P0：用户手动移动书签到其他目录时，会记录为本地分类偏好，后续同类网页会优先参考用户习惯。
- P0：搜索会同时参考标题、域名、URL、目录、标签、摘要、备注、关键词和原始导入目录，并尊重当前目录和状态筛选。
- P1：侧边栏提供本地体检入口，可筛选待处理、AI 失败、缺摘要、重复书签和待整理书签。
- P1：支持按 URL 清理重复书签，优先保留摘要更完整、访问更多、更新时间更新的版本。
- P1：支持清理没有书签的自定义空目录，减少目录树噪音。
- P1：继续完善目录治理，包括低频目录、非规范目录的合并建议。
- P2：当本地数据规模增大后，将书签主体从 `chrome.storage.local` 迁移到 `IndexedDB`，保留 `chrome.storage.local` 存储设置和轻量索引。
