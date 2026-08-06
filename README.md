# iBanKa！云端部署器 (Cloudflare Auto Deployer)

一款可直接部署至 Cloudflare Pages / Workers 的轻量化自动化部署器，支持自动创建或更新 Cloudflare Worker / Pages 脚本与 KV 存储。

---

## 中文说明

### 1. 代码文件结构与作用说明

```
.
├── metadata.json                 # 应用元数据与权限配置
├── package.json                  # 项目依赖与启动/构建脚本
├── wrangler.toml                 # Wrangler 配置文件
├── server.mjs                    # Node.js 本地/开发服务器入口（代码 < 600 行）
├── lib/                          # 后端解耦模块目录
│   ├── cf-api.js                 # Cloudflare API 统一请求库（支持 Token/Global Key）
│   └── deploy-engine.js          # 部署核心引擎逻辑（Worker / Pages / KV / 域名绑定）
├── functions/                    # Cloudflare Pages Functions 后端 API
│   └── api/
│       └── [[path]].js           # Edge API 转发处理函数（代码 < 600 行）
├── public/                       # 前端静态资源
│   ├── index.html                # 主页面（包含 AI API 设置、语言切换、部署控制台）
│   ├── styles.css                # 样式文件（响应式布局、单版面无滚动条设计）
│   └── app.js                    # 前端交互逻辑（多语言切换、凭据校验、API 设置）
├── scripts/                      # 构建与打包脚本
│   └── build-upload.mjs          # 上传包生成脚本
├── history/                      # 开发版本历史记录
│   ├── history.md                # 整体历史版本记录
│   └── history-202608051900.md   # 最新版本更新日志
├── 技术实现方案.md               # 架构与技术实现方案
└── 产品设计文档.md               # 产品设计与需求规格说明
```

---

### 2. 动态变量说明 (Dynamic Variables Table)

| 变量名称 (Variable Name) | 类型 (Type) | 是否必须 (Required) | 说明 (Description) |
| :--- | :--- | :--- | :--- |
| `PORT` | 环境变量 (Env Var) | 否 (Default: 3000) | 本地 Node.js 服务器监听端口号 |
| `CLOUDFLARE_API_TOKEN` | 凭据 (Credentials) | 条件必须 (Conditional) | Cloudflare API Token（API Token 鉴权模式使用） |
| `CLOUDFLARE_EMAIL` | 凭据 (Credentials) | 条件必须 (Conditional) | Cloudflare 账号邮箱（Global API Key 鉴权模式使用） |
| `CLOUDFLARE_API_KEY` | 凭据 (Credentials) | 条件必须 (Conditional) | Cloudflare Global API Key（Global API Key 鉴权模式使用） |
| `CLOUDFLARE_ACCOUNT_ID` | 参数 (Parameter) | 是 (Yes) | Cloudflare 账号 ID，登录后可自动获取 |
| `AI_PROVIDER` | 本地存储 (LocalStorage)| 否 (Default: default) | AI 模型提供商：`default` (Gemini) 或 `custom` (OpenAI 兼容) |
| `AI_BASE_URL` | 本地存储 (LocalStorage)| 否 | 自定义 OpenAI 兼容 API 基础地址 (如 `https://api.openai.com/v1`) |
| `AI_API_KEY` | 本地存储 (LocalStorage)| 否 | 自定义 AI 接口 Key |
| `AI_MODEL_NAME` | 本地存储 (LocalStorage)| 否 | 自定义 AI 模型名称 (如 `gpt-4o-mini`) |

---

### 3. 程序使用说明

1. **登录凭据输入**:
   - **方式一 (推荐)**: 仅需在 API Key / Token 框填入 Cloudflare **API Token**（邮箱可留空）。
   - **方式二**: 填入注册邮箱以及 **Global API Key**。
2. **一键部署**:
   - 点击「登录并继续」，成功加载账号信息后切换至部署面板。
   - 可选择是否绑定随机子域名，点击「一键部署」即可完成 Pages/Worker 自动部署。
3. **高级配置与更新**:
   - 展开高级选项，可自定义指定已有的 Worker/Pages 项目、项目名称、UUID、KV 绑定量以及部署源模式（混淆/明文）。
4. **AI API 设置与免费获取**:
   - 点击右上角「AI API 设置」，支持在系统默认 Gemini Key 与自定义 OpenAI 兼容 Endpoint 之间切换，弹窗内附带「免费 AI API 获取指南」。

---

### 4. 本地运行与部署环境

#### 在 AI Studio 中查看您的应用
- Preview 窗口将实时自动渲染服务，且对外开放端口为 3000。

#### 本地运行 (Local Development)
```bash
# 安装依赖
npm install

# 启动本地开发服务 (端口 3000)
npm run dev
```

#### 部署至 Cloudflare Pages
```bash
# 本地打包上传资产
npm run build:upload

# 部署构建输出包
npm run deploy
```

---

### 5. 更新日志 (Changelog)

- **2026-08-05 (v1.2.0)**:
  - 移除了针对 API Key 的硬编码 37 位正则与必填邮箱限制，支持 API Token 鉴权模式。
  - 新增中英文界面快速切换（铺开式右上角按钮）。
  - 新增「AI API 设置」与「免费 AI API 获取指南」功能弹窗。
  - 进行模块解耦拆分，确保单文件代码行数严格少于 600 行。
  - 适配应用与浏览器标题前缀 `iBanKa！`。

---

## English Documentation

### 1. Directory Structure and File Descriptions

```
.
├── metadata.json                 # Application metadata & permissions
├── package.json                  # Dependencies and scripts
├── wrangler.toml                 # Wrangler configuration
├── server.mjs                    # Node.js dev/server entry (< 600 lines)
├── lib/                          # Backend decoupled modules
│   ├── cf-api.js                 # Unified Cloudflare API client (Token & Global Key)
│   └── deploy-engine.js          # Core deployment engine (Worker / Pages / KV / Domains)
├── functions/                    # Cloudflare Pages Functions
│   └── api/
│       └── [[path]].js           # Edge API routing worker (< 600 lines)
├── public/                       # Frontend static assets
│   ├── index.html                # Main UI HTML
│   ├── styles.css                # Responsive stylesheet (Single screen, no scrollbar)
│   └── app.js                    # Client interaction & i18n logic
├── scripts/                      # Build & upload scripts
├── history/                      # Version history logs
├── 技术实现方案.md               # Technical Implementation Spec
└── 产品设计文档.md               # Product Design Spec
```

### 2. Dynamic Variables Table

| Variable Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `PORT` | Env Var | No (Default: 3000) | Local server listening port |
| `CLOUDFLARE_API_TOKEN` | Credential | Conditional | Cloudflare API Token for Token Auth Mode |
| `CLOUDFLARE_EMAIL` | Credential | Conditional | Cloudflare Account Email for Global Key Mode |
| `CLOUDFLARE_API_KEY` | Credential | Conditional | Cloudflare Global API Key for Global Key Mode |
| `CLOUDFLARE_ACCOUNT_ID` | Parameter | Yes | Cloudflare Account ID |
| `AI_PROVIDER` | LocalStorage| No (Default: default) | AI Provider: `default` (Gemini) or `custom` (OpenAI compatible) |
| `AI_BASE_URL` | LocalStorage| No | Custom OpenAI compatible Base URL |
| `AI_API_KEY` | LocalStorage| No | Custom AI Key |
| `AI_MODEL_NAME` | LocalStorage| No | Custom Model Name |

### 3. Usage Instructions

1. Enter your Cloudflare API Token (email optional) OR Email + Global API Key.
2. Click "Login and Continue", then "Quick Deploy" to deploy automatically.
3. Switch language using top-right toggles or configure AI API settings anytime.
