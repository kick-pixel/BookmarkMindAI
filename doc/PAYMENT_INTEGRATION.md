# BookmarkMindAI 支付接入文档

> 最后更新：2026-05-08

## 目录

1. [整体方案概述](#1-整体方案概述)
2. [海外支付方式全面对比](#2-海外支付方式全面对比)
3. [Stripe 注册与开通](#3-stripe-注册与开通)
4. [PingPong 注册与开通](#4-pingpong-注册与开通)
5. [Telegram Bot 支付对接](#5-telegram-bot-支付对接)
6. [完整资金流转](#6-完整资金流转)
7. [费用总览](#7-费用总览)
8. [注意事项与合规](#8-注意事项与合规)

---

## 1. 整体方案概述

### 1.1 核心问题

中国大陆**不在 Stripe 官方支持的地区列表中**。截至 2026 年 5 月，Stripe 支持的国家/地区包括：

> 澳大利亚、奥地利、比利时、巴西、保加利亚、加拿大、克罗地亚、塞浦路斯、捷克、丹麦、爱沙尼亚、芬兰、法国、德国、直布罗陀、希腊、**香港**、匈牙利、印度（预览）、印尼（预览）、爱尔兰、意大利、日本、拉脱维亚、列支敦士登、立陶宛、卢森堡、马来西亚、马耳他、墨西哥、荷兰、新西兰、挪威、波兰、葡萄牙、罗马尼亚、新加坡、斯洛伐克、斯洛文尼亚、南非、西班牙、瑞典、瑞士、泰国、阿联酋、英国、美国
>
> 以及扩展网络：科特迪瓦、加纳、肯尼亚、尼日利亚

**中国大陆不在列表中**，因此国内公司无法直接以中国大陆主体注册 Stripe 账户。

### 1.2 推荐方案

针对已有国内公司、但无对公账户的情况，推荐以下路径：

```
方案A（推荐）：香港公司 + Stripe + PingPong
  注册香港公司 → 开 Stripe（香港区）→ PingPong 结汇到个人卡

方案B：Stripe Atlas（美国 C-Corp）
  Stripe Atlas 注册美国公司 → 开 Stripe（美国区）→ PingPong 结汇

方案C：直接用 PingPong 虚拟账号
  用香港/美国公司开 Stripe → Stripe 提现到 PingPong 虚拟银行账号 → 结汇到个人卡
```

---

## 2. 海外支付方式全面对比

### 2.1 所有可选方案总览

| 方案 | 是否需要境外公司 | 是否需要对公账户 | Telegram 原生支持 | 订阅支持 | 综合费率 | 开通时间 | 推荐场景 |
|------|:---:|:---:|:---:|:---:|------|------|------|
| **Stripe** | 是（香港/美国） | 否（可用 PingPong） | ✅ 原生 | ✅ | ~5% | 3-6 周 | 长期、规模化 |
| **PayPal** | 否 | 否 | ❌ | ✅ | ~5-6% | 1-3 天 | 快速起步 |
| **LemonSqueezy** | 否 | 否 | ❌ | ✅ | ~6% | 1 天 | 个人开发者、最快 |
| **Paddle** | 否 | 否 | ❌ | ✅ | ~6% | 1-3 天 | SaaS、App |
| **Telegram Stars** | 否 | 否 | ✅ 原生 | ❌ | 变现困难 | 即时 | 补充支付方式 |
| **Crypto（加密货币）** | 否 | 否 | ❌ | ❌ | ~1-2% | 即时 | 技术用户群体 |

### 2.2 PayPal — 中国用户最便捷的收款方式

#### 2.2.1 PayPal 对中国用户的支持

PayPal 在中国有正式业务，中国用户可以：
- ✅ 用国内公司或个人身份注册 PayPal 商家账户
- ✅ 直接接收国际信用卡和 PayPal 余额付款
- ✅ 提现到国内银行账户（支持对公和对私）
- ✅ 无需境外公司主体
- ✅ 支持超过 200 个国家/地区
- ✅ 支持 100+ 种货币

#### 2.2.2 PayPal 商家账户注册

```
1. 访问 PayPal 中国官网
   👉 https://www.paypal.com/cn/webapps/mpp/merchant

2. 点击「注册」→ 选择「商家账户」

3. 填写信息
   - 邮箱地址
   - 密码
   - 商家信息（公司名、地址等）
   - 营业执照（企业账户）

4. 验证邮箱

5. 绑定银行账户
   - 可以绑个人银行卡（法人名下）
   - 也可以绑对公账户

6. 完成身份验证
   - 上传身份证/营业执照

7. 开始收款
```

#### 2.2.3 PayPal 费率（2026 年最新）

| 项目 | 费率 |
|------|------|
| 国际收款手续费 | **4.4% + $0.30** / 笔 |
| 货币转换费 | 额外 2.5%-4%（含在汇率中） |
| 提现到国内银行 | $35/笔（电汇）或免费（通过连连/PingPong） |
| 退款手续费 | $0.30 / 笔（手续费不退） |
| 争议处理费 | $15 / 笔 |
| 月费 | 无 |

> 💡 **费率优惠**：月收款超过 $3,000 可申请商家费率，最低可降至 3.4% + $0.30

#### 2.2.4 PayPal 提现方式

| 方式 | 费用 | 到账时间 | 说明 |
|------|------|----------|------|
| 直接提现到国内银行 | $35/笔 | 3-7 工作日 | 需要银行支持外汇 |
| 通过 PingPong/连连 | 免费或极低 | 1-3 工作日 | PayPal → PingPong → 人民币 |
| 提现到香港银行 | 免费 | 1-3 工作日 | 需有香港银行账户 |

**推荐方式**：PayPal → PingPong/连连 → 人民币（免提现费，汇率更优）

#### 2.2.5 PayPal 与 Telegram 的对接

> ⚠️ **Telegram Bot Payments 不支持 PayPal**。Telegram 原生支付仅支持 Stripe 等少数支付提供商。

在 Telegram Mini App 中使用 PayPal 的方式：

```
方案 A：Mini App 内嵌 PayPal 按钮
  → 在 WebView 中加载 PayPal Checkout
  → 问题：Telegram WebView 对跳转有限制，体验不佳
  → 不推荐

方案 B：跳转到外部网页支付
  → Mini App 中点击购买 → 打开外部浏览器
  → 用户在网页中完成 PayPal 支付
  → 支付成功后回调 Mini App
  → 可行但体验断开

方案 C：PayPal 作为独立网页支付渠道
  → Mini App 内使用 Telegram Invoice（Stripe）
  → 同时提供网页版支付页面（支持 PayPal）
  → 两条渠道并行，覆盖更多用户
  → 推荐方案
```

#### 2.2.6 PayPal 优劣势

| 优势 | 劣势 |
|------|------|
| 国内可直接注册，无需境外公司 | 手续费高于 Stripe |
| 不需要对公账户 | 货币转换费高（2.5%-4%） |
| 全球 4 亿+用户，用户信任度高 | 买家保护倾向强，易被争议 |
| 支持订阅付款（Recurring） | 不被 Telegram 原生支付支持 |
| 开通快，1-3 天即可使用 | 提现到国内银行手续费高（$35/笔） |
| 支持 100+ 货币 | 账户冻结风险（需保持低争议率） |

### 2.3 LemonSqueezy — 最适合个人开发者的方案

#### 2.3.1 核心特点

- **Merchant of Record (MoR)** 模式：LemonSqueezy 作为代收代付方
- **无需公司主体**：个人即可注册
- **无需对公账户**：提现到个人银行账户或 PayPal
- **自动处理全球税务**：VAT/Sales Tax 全部代为计算和缴纳
- **支持订阅**：月付/年付/免费试用
- **内置功能**：License Key 管理、Affiliate 系统、邮件营销

#### 2.3.2 费率

| 项目 | 费率 |
|------|------|
| 交易手续费 | **5% + $0.50** / 笔 |
| 月费 | 无 |
| 支持的支付方式 | 信用卡、PayPal、Apple Pay、Google Pay 等 21 种 |
| 提现 | 银行电汇或 PayPal，每半月自动结算 |
| 税务处理 | 包含（MoR 代为处理） |

#### 2.3.3 注册步骤

```
1. 访问 https://www.lemonsqueezy.com
2. 点击「Get started」
3. 填写邮箱和密码（无需信用卡）
4. 创建产品（设置价格、订阅方式）
5. 填写收款信息（个人银行或 PayPal）
6. 开始销售
```

> 全程 10 分钟内完成，零门槛。

#### 2.3.4 LemonSqueezy 与 Telegram 的对接

```
方案：Mini App 中打开 LemonSqueezy Checkout
  → 用户点击购买 → Telegram.WebApp.openLink() 打开 LS Checkout 页面
  → 用户完成支付 → 回调到 Mini App
  → LemonSqueezy Webhook 通知后端
  → 后端激活订阅

注意：不是原生支付体验，但功能最完整
```

### 2.4 Paddle — SaaS 产品的专业方案

#### 2.4.1 核心特点

- 同样是 **MoR（Merchant of Record）** 模式
- 专为 **SaaS 和 App** 设计
- 无需公司主体（个人也可注册）
- 自动处理全球税务和合规
- 支持订阅、用量计费、In-App Purchase
- 内置防欺诈、收入恢复、客户支持

#### 2.4.2 费率

| 项目 | 费率 |
|------|------|
| 交易手续费 | **5% + $0.50** / 笔 |
| 月费 | 无 |
| 税务处理 | 包含 |
| 提现 | 银行电汇，支持 200+ 国家 |
| 低于 $10 的产品 | 需联系定制价格 |

#### 2.4.3 适用场景

- SaaS 产品（月付/年付订阅）
- 桌面软件/工具
- App 内购买（绕过 App Store 30% 抽成）
- 需要专业税务合规的产品

### 2.5 Telegram Stars — Telegram 原生虚拟货币

#### 2.5.1 核心特点

- Telegram 2024 年推出的平台内虚拟货币
- 用户通过 App Store/Google Play 购买 Stars
- 用于支付数字商品和服务
- **绕过 Apple 对数字商品支付的限制**
- 全平台统一体验（iOS/Android/Desktop）

#### 2.5.2 费率与变现

| 项目 | 说明 |
|------|------|
| 购买 Stars | 用户通过应用内购买（Apple/Google 抽 30%） |
| Stars → 真实货币 | Telegram 抽成后可通过 Fragment 兑换 TON |
| 变现路径 | Stars → Fragment → TON → 交易所 → 法币 |
| 综合损耗 | 约 30-50%（Apple/Google 30% + Telegram 抽成 + 交易所损耗） |

> ⚠️ Stars 变现损耗较大，不建议作为主要支付方式，可作为补充。

### 2.6 加密货币支付

#### 2.6.1 可选方案

| 方案 | 说明 | 手续费 |
|------|------|--------|
| **USDT/USDC 直接收款** | 用户转账到你的钱包 | ~1-2%（网络费） |
| **Coinbase Commerce** | 支持多币种，自动转换 | 1% |
| **NOWPayments** | 支持 300+ 加密货币 | 0.5% |
| **CryptoPay** | 支持 BTC/ETH/USDT 等 | 1% |

#### 2.6.2 优劣势

| 优势 | 劣势 |
|------|------|
| 费率最低（0.5-2%） | 用户体验门槛高 |
| 无需公司/银行账户 | 价格波动风险（稳定币除外） |
| 即时到账 | 合规风险 |
| 无地域限制 | 不被 Telegram 原生支持 |

### 2.7 针对你情况的推荐方案

根据你「有国内公司、无对公账户」的情况，按优先级推荐：

#### 🥇 首选：PayPal（最快上线）

```
开通时间：1-3 天
门槛：最低（国内公司直接注册）
费用：4.4% + $0.30 + 提现费
Telegram 支持：需要网页版支付
适合：快速验证付费需求
```

#### 🥈 进阶：PayPal + LemonSqueezy（最省心）

```
开通时间：1 天
门槛：最低（个人即可）
费用：5% + $0.50（含税务处理）
Telegram 支持：通过网页链接
适合：不想处理税务合规、专注产品开发
```

#### 🥉 长期：Stripe + PingPong（费率最优）

```
开通时间：3-6 周
门槛：需要香港公司
费用：~5%（综合）
Telegram 支持：✅ 原生支持
适合：业务稳定后降低成本
```

#### 💡 推荐的演进路径

```
阶段 1（立即）：注册 PayPal 商家账户 → 1-3 天上线
  → 网页版支付页面，支持信用卡 + PayPal
  → Telegram Mini App 通过 openLink 跳转支付

阶段 2（1 周内）：接入 LemonSqueezy
  → 自动处理税务、订阅管理
  → 更专业的支付体验
  → 支持 PayPal + 信用卡 + Apple Pay

阶段 3（1-2 月后）：注册香港公司 + Stripe + PingPong
  → Telegram 原生支付（最佳体验）
  → 费率更低
  → 支持自动续订订阅

三条渠道并行：
  → Telegram 原生用户 → Stripe（Telegram Invoice）
  → 网页用户 → LemonSqueezy / PayPal
  → 加密货币用户 → USDT（可选）
```

---

## 3. Stripe 注册与开通

### 3.1 前提条件

由于中国大陆不在 Stripe 支持地区，需要选择以下任一方式获取合规主体：

#### 方式一：注册香港公司（推荐）

| 项目 | 详情 |
|------|------|
| 费用 | 约 3,000-5,000 RMB |
| 时间 | 5-10 个工作日 |
| 代理 | 瑞丰、卓佳、丰盛等 |
| 维护 | 年审约 2,000-3,000 RMB/年 |
| 税务 | 香港公司首年无盈利可零申报 |
| 优势 | Stripe 香港区功能完整，支持 HKD/USD 等多币种 |

注册香港公司所需材料：
- 1位以上股东/董事（年满18岁，无国籍限制）
- 有效身份证/护照
- 注册地址（代理可提供）
- 公司秘书（代理可提供）

#### 方式二：Stripe Atlas（美国 C-Corp）

| 项目 | 详情 |
|------|------|
| 费用 | $500 一次性 |
| 时间 | 1-2 周 |
| 包含 | Delaware C-Corp 注册 + 美国银行账户 + Stripe 账户 |
| 年维护 | 特许经营税约 $300+/年 + 报税 $500+/年 |
| 优势 | 全流程在线完成，美国银行账户直接提现 |
| 劣势 | 美国公司税务合规成本高 |

申请地址：https://stripe.com/atlas

#### 方式三：使用已有国内公司（限制较多）

> ⚠️ 中国大陆目前不在 Stripe 支持地区，无法直接用国内公司注册。必须通过上述方式获取境外主体。

### 3.2 Stripe 账户注册步骤

以香港公司为例：

```
1. 访问 https://dashboard.stripe.com/register
2. 填写基本信息
   - 邮箱
   - 姓名
   - 密码
   - 国家/地区选择：Hong Kong

3. 完成商家信息填写
   - 业务类型：Individual / Company
   - 公司名（英文）
   - 公司地址（香港注册地址）
   - 公司注册号
   - 业务网址（填你的产品网站）

4. 身份验证
   - 上传董事身份证/护照
   - 上传公司注册证书（CI）
   - 上传商业登记证（BR）
   - 上传公司章程（M&A）

5. 银行账户信息
   - 先跳过，后续填入 PingPong 虚拟账号

6. 提交审核
   - 通常 1-3 个工作日完成审核
```

### 3.3 Stripe 账户配置

审核通过后，需要配置以下内容：

#### 3.3.1 获取 API 密钥

```
Stripe Dashboard → Developers → API keys
  - Publishable key: pk_live_xxxxx（前端使用）
  - Secret key: sk_live_xxxxx（后端使用，务必保密）
```

#### 3.3.2 设置 Webhook

```
Stripe Dashboard → Developers → Webhooks
  - Endpoint URL: https://your-domain.com/api/stripe/webhook
  - 监听事件：
    - checkout.session.completed
    - payment_intent.succeeded
    - payment_intent.payment_failed
    - customer.subscription.created
    - customer.subscription.updated
    - customer.subscription.deleted
    - invoice.paid
    - invoice.payment_failed
```

#### 3.3.3 配置提现账户（PingPong）

```
Stripe Dashboard → Settings → Bank accounts and scheduling
  → Add bank account
  → 填入 PingPong 提供的虚拟银行账号信息（见第3节）
```

### 3.4 Stripe 定价（2026 年最新）

| 项目 | 费率 |
|------|------|
| 国际信用卡支付 | 3.25% + HK$2.35 / 笔 |
| Apple Pay / Google Pay | 同信用卡费率 |
| 货币转换 | 额外 1%（如非结算币种） |
| 争议/退款 | HK$80 / 笔 |
| 提现到银行 | 免费（2-7 个工作日） |

> 美国区费率：2.9% + $0.30/笔（国内卡），国际卡 3.25% + $0.30/笔

---

## 4. PingPong 注册与开通

### 4.1 PingPong 简介

PingPong 是中国跨境收款平台，核心功能：
- 提供虚拟美国/香港银行账号，用于接收 Stripe 提现
- 将 USD/HKD 结汇为人民币，提现到个人银行卡
- 不需要对公账户，支持个人银行卡收款
- 代为处理外汇申报

### 4.2 注册所需材料

| 材料 | 说明 |
|------|------|
| 营业执照 | 国内公司或香港公司均可 |
| 法人身份证 | 正反面照片 |
| 个人银行卡 | 法人名下的银行卡，用于收款 |
| 网站/App | 展示你的业务 |
| 公司信息 | 注册地址、经营范围等 |

### 4.3 注册步骤

```
1. 访问 PingPong 官网
   👉 https://www.pingpongx.com

2. 点击「免费注册」
   选择「企业账户」

3. 填写基本信息
   - 手机号
   - 验证码
   - 设置密码

4. 完成企业认证
   - 上传营业执照（国内公司或香港公司）
   - 填写公司信息（注册地址、经营范围等）
   - 上传法人身份证（正反面）

5. 绑定收款银行卡
   - 填写个人银行卡信息
   - 该卡必须与法人姓名一致

6. 等待审核
   - 通常 1-3 个工作日
   - 审核通过后即可使用
```

### 4.4 获取虚拟银行账号

审核通过后：

```
1. 登录 PingPong 后台
2. 选择「收款」→ 选择对应平台（Stripe）
3. 申请美国银行账号
4. 系统分配虚拟账号，你会获得：
   - Bank Name:       如 Citibank, N.A.
   - Account Name:    PingPong XXX Ltd.
   - Account Number:  4000XXXXXX
   - Routing Number:  021000089
   - Account Type:    Checking
```

### 4.5 将虚拟账号填入 Stripe

```
1. 登录 Stripe Dashboard
2. 进入 Settings → Bank accounts and scheduling
3. 点击「Add bank account」
4. 选择国家：United States
5. 填入 PingPong 提供的信息：
   - Routing number:  PingPong 给的路由号
   - Account number:  PingPong 给的账号
   - Account type:    Checking
6. Stripe 会进行小额打款验证（1-2 天）
7. 验证通过后，Stripe 自动提现到此账号
```

### 4.6 PingPong 费率

| 项目 | 费率 |
|------|------|
| 结汇手续费 | 标准 1%（月流水 >$10,000 可申请降费，最低约 0.4%-0.6%） |
| 提现到个人银行卡 | 通常免费 |
| 汇率 | 按银行中间价（不额外加价） |
| 提现额度 | 无个人 5 万美金年度限额（对公通道） |
| 到账时间 | Stripe 提现后 2-7 天到 PingPong，结汇 1-2 天到银行卡 |

### 4.7 替代平台对比

| 平台 | 结汇费率 | 到账速度 | 开户难度 | 特点 |
|------|----------|----------|----------|------|
| **PingPong** | 1% | 3-7 天 | 低 | 最主流，支持 Stripe |
| **连连国际** | 0.7% | 3-5 天 | 低 | 费率略低 |
| **Payoneer** | 1-2% | 3-7 天 | 低 | 全球通用，费率偏高 |
| **Airwallex** | 1% | 2-5 天 | 中 | 功能多，支持多币种 |

---

## 5. Telegram Bot 支付对接

### 5.1 Telegram Payments 概述

Telegram 提供原生的 Bot Payments API，支持通过 Stripe 等支付提供商收款。

关键特性：
- Telegram 不收取任何佣金
- 支付信息直接传给支付提供商，Telegram 不存储信用卡信息
- 支持 Apple Pay 和 Google Pay
- 支持超过 200 个国家，20+ 支付提供商
- 支持发送发票到个人聊天、群组和频道

> ⚠️ **重要限制**：Telegram Invoice API 仅支持一次性支付，不支持自动续订订阅。如需订阅功能，需结合 Stripe Subscription API 实现。

### 5.2 前置准备

1. 已注册的 Telegram Bot（通过 @BotFather 创建）
2. 已开通的 Stripe 账户
3. 后端服务（Node.js / Python 等）

### 5.3 连接 Stripe 到 Telegram Bot

```
1. 在 Telegram 中找到 @BotFather
2. 发送 /mybots
3. 选择你的 Bot
4. 选择 Bot Settings → Payments
5. 选择 Stripe
6. BotFather 会引导你连接 Stripe 账户
   - 需要登录 Stripe 并授权
7. 连接成功后，BotFather 会给你一个 provider_token
   格式示例：12345678:TEST:XXXX 或 12345678:LIVE:XXXX

⚠️ 注意区分：
  - :TEST: 标记的是测试模式 token
  - :LIVE: 标记的是生产模式 token
```

### 5.4 测试支付（Stripe Test Mode）

开发阶段使用测试模式：

```
1. 在 BotFather 中选择 Stripe TEST MODE
2. 获取测试模式的 provider_token
3. 使用测试卡号：
   - 4242 4242 4242 4242（成功）
   - 4000 0025 0000 3155（需要 3DS 验证）
   - 4000 0000 0000 9995（余额不足）
   - 到期日：任意未来日期
   - CVC：任意 3 位数字
```

### 5.5 Bot API 支付流程

完整的支付流程分 8 步：

```
┌────────────┐     ┌────────────┐     ┌────────────┐     ┌──────────┐
│  1.创建发票  │ ──→ │  2.转发行为  │ ──→ │  3.小费(可选)│ ──→ │ 4.物流信息 │
└────────────┘     └────────────┘     └────────────┘     └──────────┘
                                                                   │
┌────────────┐     ┌────────────┐     ┌────────────┐              │
│  7.结账     │ ←── │  6.选择配送  │ ←── │ 5.配送选项  │ ←────────────┘
└────────────┘     └────────────┘     └────────────┘
     │
     ▼
┌────────────┐
│ 8.支付成功  │
└────────────┘
```

### 5.6 关键 API 详解

#### 5.6.1 创建并发送发票 - sendInvoice

```json
POST https://api.telegram.org/bot<BOT_TOKEN>/sendInvoice

{
  "chat_id": "USER_CHAT_ID",
  "title": "BookmarkMindAI Pro",
  "description": "AI 书签管理专业版 - 月度订阅",
  "payload": "sub_pro_monthly_user123",
  "provider_token": "12345678:LIVE:XXXX",
  "currency": "USD",
  "prices": [
    {
      "label": "Pro Plan",
      "amount": 999
    }
  ],
  "start_parameter": "bm_pro_sub",
  "photo_url": "https://your-domain.com/product-image.png",
  "photo_width": 300,
  "photo_height": 300,
  "need_name": true,
  "need_email": true,
  "need_phone_number": false,
  "need_shipping_address": false,
  "is_flexible": false,
  "max_tip_amount": 0,
  "suggested_tip_amounts": []
}
```

> `amount` 单位是最小货币单位：USD 最小单位是美分，999 = $9.99

#### 5.6.2 回答预结账查询 - answerPreCheckoutQuery

用户点击支付按钮后，Telegram 向你的 Bot 发送 `pre_checkout_query`，你必须在 **10 秒内** 回答：

```json
POST https://api.telegram.org/bot<BOT_TOKEN>/answerPreCheckoutQuery

// 成功
{
  "pre_checkout_query_id": "QUERY_ID",
  "ok": true
}

// 失败（如库存不足）
{
  "pre_checkout_query_id": "QUERY_ID",
  "ok": false,
  "error_message": "抱歉，Pro 版名额已满，请稍后再试"
}
```

#### 5.6.3 处理成功支付

支付成功后，Bot 收到 `message.successful_payment` 更新：

```json
{
  "message": {
    "message_id": 123,
    "from": {
      "id": 123456789,
      "first_name": "User"
    },
    "chat": {
      "id": 123456789
    },
    "date": 1715000000,
    "successful_payment": {
      "invoice_payload": "sub_pro_monthly_user123",
      "total_amount": 999,
      "currency": "USD",
      "provider_payment_charge_id": "pi_xxx",
      "shipping_option_id": "",
      "order_info": {
        "name": "Zhang San",
        "email": "user@example.com"
      }
    }
  }
}
```

### 5.7 Mini App 中调用支付

在 Telegram Mini App（Web App）中，使用 `Telegram.WebApp.openInvoice()` 触发支付：

```javascript
// 方式1：使用 invoice URL
async function pay() {
  // 1. 先从你的后端创建 invoice，获取支付链接
  const response = await fetch('/api/create-invoice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: Telegram.WebApp.initDataUnsafe.user.id,
      planId: 'pro_monthly'
    })
  });
  const { invoiceUrl } = await response.json();

  // 2. 打开原生支付界面
  Telegram.WebApp.openInvoice(invoiceUrl, (status) => {
    switch (status) {
      case 'paid':
        // 支付成功，更新 UI
        showSuccessMessage();
        break;
      case 'cancelled':
        // 用户取消
        break;
      case 'failed':
        // 支付失败
        showErrorMessage();
        break;
    }
  });
}
```

### 5.8 后端实现示例（Node.js）

```javascript
// 创建 Invoice API
app.post('/api/create-invoice', async (req, res) => {
  const { userId, planId } = req.body;

  // 根据计划确定价格
  const plans = {
    pro_monthly: { title: 'Pro 月度', amount: 999 },
    pro_yearly: { title: 'Pro 年度', amount: 9999 },
  };
  const plan = plans[planId];
  if (!plan) return res.status(400).json({ error: 'Invalid plan' });

  // 调用 Telegram API 创建 invoice
  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `BookmarkMindAI ${plan.title}`,
        description: `AI 书签管理 ${plan.title}订阅`,
        payload: `${planId}_${userId}_${Date.now()}`,
        provider_token: STRIPE_PROVIDER_TOKEN,
        currency: 'USD',
        prices: [{ label: plan.title, amount: plan.amount }],
      }),
    }
  );

  const data = await response.json();
  if (data.ok) {
    res.json({ invoiceUrl: data.result });
  } else {
    res.status(500).json({ error: data.description });
  }
});

// 处理 Telegram Webhook（pre_checkout_query + successful_payment）
app.post('/api/telegram/webhook', async (req, res) => {
  const update = req.body;

  // 处理预结账查询
  if (update.pre_checkout_query) {
    // 在 10 秒内回答
    await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/answerPreCheckoutQuery`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pre_checkout_query_id: update.pre_checkout_query.id,
          ok: true,
        }),
      }
    );
  }

  // 处理支付成功
  if (update.message?.successful_payment) {
    const payment = update.message.successful_payment;
    const payload = payment.invoice_payload;

    // 解析 payload 获取用户信息和计划
    const [planId, userId] = payload.split('_');

    // 更新数据库，激活用户订阅
    await activateSubscription(userId, planId);

    // 发送确认消息
    await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: update.message.chat.id,
          text: `✅ 支付成功！你的 Pro 订阅已激活。`,
        }),
      }
    );
  }

  res.sendStatus(200);
});
```

### 5.9 订阅功能的实现

由于 Telegram Invoice API 不支持自动续订，需采用混合方案：

```
首次支付：
  Telegram Invoice（原生体验）→ 确认支付意愿

后续续费：
  Stripe Subscription API（自动扣款）
  → 首次支付时，同时在 Stripe 创建 Customer + Payment Method
  → 创建 Subscription，每月自动扣款
  → 通过 Stripe Webhook 监听续费结果
  → Bot 通知用户续费状态

或者（简单方案）：
  不使用自动续费，改为每月到期前 Bot 发送提醒
  → 用户点击续费链接 → Telegram Invoice 支付
```

### 5.10 上线前检查清单

来源：Telegram 官方 Live Checklist

- [ ] Bot 控制账号已开启两步验证
- [ ] Bot 支持 `/terms` 命令，可查看服务条款
- [ ] Bot 支持客服渠道（`/support` 命令或其他方式）
- [ ] 服务条款清晰易懂
- [ ] 用户购买前需确认已阅读并同意服务条款
- [ ] 服务条款中说明 Telegram 不处理购买纠纷
- [ ] 服务器稳定，有数据备份
- [ ] 能正确处理争议和退款（Stripe chargeback）
- [ ] 已完成 Stripe 的 live checklist
- [ ] 已从 @BotFather 切换到 Stripe LIVE MODE

---

## 6. 完整资金流转

### 6.1 一次性支付流程

```
用户在 Telegram Mini App 点击"购买"
          │
          ▼
Telegram.WebApp.openInvoice() 打开原生支付界面
          │
          ▼
用户输入信用卡信息 / Apple Pay / Google Pay
          │
          ▼
Stripe 处理支付（扣除 2.9%-3.25% + 手续费）
          │
          ▼
Telegram 发送 pre_checkout_query → 后端确认
          │
          ▼
支付成功 → Telegram 发送 successful_payment → 后端激活订阅
          │
          ▼
Stripe 自动提现到 PingPong 虚拟银行账号（USD，2-7 天）
          │
          ▼
PingPong 收到款项 → 结汇为人民币（扣除 1% 手续费）
          │
          ▼
人民币到账法人个人银行卡（1-2 天）
```

### 6.2 时序图

```
用户          Telegram         Bot后端          Stripe          PingPong         银行卡
 │               │               │               │               │               │
 │──点击购买──→  │               │               │               │               │
 │               │──openInvoice→ │               │               │               │
 │               │               │──createInv──→ │               │               │
 │               │               │←──invUrl───── │               │               │
 │               │←──invoice───  │               │               │               │
 │──输入卡号──→  │               │               │               │               │
 │               │──pre_checkout→│               │               │               │
 │               │               │──confirm────→ │               │               │
 │               │               │               │──扣款────→    │               │
 │               │──pay_success→ │               │               │               │
 │               │               │──activate──→  │               │               │
 │               │               │               │──auto payout─→│               │
 │               │               │               │               │──结汇───────→  │
 │←──通知成功──  │               │               │               │               │
```

---

## 7. 费用总览

### 7.1 综合成本对比（以 $9.99/月 为例）

| 支付方式 | 收款手续费 | 提现/结汇费 | 综合费率 | 实际到账（$9.99） |
|------|------|------|------|------|
| **Stripe + PingPong** | 3.25% + HK$2.35 | 1% | ~5% | ~$9.49（≈ ¥66.4） |
| **PayPal + PingPong** | 4.4% + $0.30 | 1% | ~6% | ~$9.39（≈ ¥65.7） |
| **PayPal 直提** | 4.4% + $0.30 | $35/笔 | 极高 | 不适合小额 |
| **LemonSqueezy** | 5% + $0.50 | 包含 | ~6% | ~$9.39（≈ ¥65.7） |
| **Paddle** | 5% + $0.50 | 包含 | ~6% | ~$9.39（≈ ¥65.7） |
| **USDT 直收** | ~1% | ~1% | ~2% | ~$9.79（≈ ¥68.5） |

### 7.2 年度固定成本

| 项目 | 费用 |
|------|------|
| 香港公司注册 | 约 ¥3,000-5,000（一次性） |
| 香港公司年审 | 约 ¥2,000-3,000/年 |
| 香港公司报税 | 约 ¥2,000-5,000/年（零申报较低） |
| 域名 + 服务器 | 按需 |

---

## 8. 注意事项与合规

### 8.1 税务合规

- 通过 PingPong 收到的款项，PingPong 会提供交易流水
- 收入需在中国公司税务中申报
- 香港公司如无香港本地收入，可申请离岸豁免，无需在香港缴税
- 美国公司（如用 Atlas）需每年报税，即使无盈利也需申报

### 8.2 外汇合规

- PingPong 代为处理外汇申报，无需自行到银行办理
- 通过对公通道收款，不受个人 5 万美金年度结汇限额
- 大额收入需保留业务合同、发票等证明材料

### 8.3 Stripe 风控

- 新账户避免短期大额交易，建议从小额开始
- 保持低退款率和争议率（<1%）
- 确保网站内容与实际业务一致
- 及时响应 Stripe 的信息验证请求
- 查看 Stripe 禁止业务列表：https://stripe.com/legal/restricted-businesses

### 8.4 Telegram 支付政策

- 由于 Apple 政策限制，iOS 用户通过 Bot Payment 支付数字商品和服务可能受限
- 2024 年起，Telegram 推出 Telegram Stars，可用于数字商品支付（全平台支持）
- 实体商品和服务无此限制
- 建议同时支持 Stars 支付作为备选

### 8.5 数据安全

- Stripe Secret Key 绝不能暴露在前端代码中
- Webhook 签名验证必须实现，防止伪造请求
- 用户支付信息由 Stripe 处理，你的服务器不应存储信用卡信息
- 所有 API 通信必须使用 HTTPS

---

## 附录：快速上手清单

### 整体时间线

```
第 1-2 周：
  ☐ 注册香港公司（或 Stripe Atlas）
  ☐ 同时注册 PingPong 企业账户

第 3 周：
  ☐ 香港公司注册完成
  ☐ PingPong 审核通过，获取虚拟银行账号
  ☐ 注册 Stripe 账户（香港区）

第 4 周：
  ☐ Stripe 审核通过
  ☐ 配置 Stripe 提现到 PingPong
  ☐ 在 @BotFather 连接 Stripe 到 Telegram Bot

第 5 周：
  ☐ 实现后端支付 API
  ☐ 实现前端 Mini App 支付调用
  ☐ 测试模式联调

第 6 周：
  ☐ 切换 Stripe LIVE MODE
  ☐ 切换 Telegram Bot 到 LIVE MODE
  ☐ 正式上线
```

### 紧急联系

| 平台 | 联系方式 |
|------|----------|
| Stripe | https://support.stripe.com |
| PingPong | 官网在线客服 / 400-878-6610 |
| Telegram | @BotSupport |
