const $ = id => document.getElementById(id);

const state = {
  lang: localStorage.getItem('app_lang') || 'zh',
  loggedIn: false,
  accounts: [],
  zones: [],
  workers: [],
  pages: [],
  kvs: []
};

const i18n = {
  zh: {
    eyebrow: "Cloudflare 自动部署软件",
    appTitle: "iBanKa！云端部署器",
    summary: "填 API Token 或 邮箱+Global API Key，点一次自动完成 Pages/Worker 随机 UUID、随机 KV 和随机项目名；支持自定义域名绑定。",
    keySecurityTitle: "Key 安全说明",
    keySecurityDesc: "前端凭据不持久化存储，后端仅作 Cloudflare 官方 API 原样转发。",
    loginHead: "1. 登录 Cloudflare",
    loginSub: "支持 Cloudflare API Token（邮箱可留空）或 Global API Key（需邮箱）。",
    emailLabel: "邮箱 (API Token 可留空)",
    keyLabel: "API Token / Global API Key",
    loginBtn: "登录并继续",
    notLoggedIn: "未登录",
    quickHead: "2. 一键部署",
    quickSub: "默认使用 Pages + 加密/混淆源。开启域名绑定后自动随机子域名。",
    backLogin: "返回登录",
    domainLabel: "可选域名",
    previewLabel: "随机子域名预览",
    bindDomainCheck: "绑定随机子域名",
    quickDeployBtn: "一键部署",
    waitDeploy: "等待部署",
    advancedSummary: "高级设置和更新现有项目",
    advancedHead: "高级设置",
    advancedSub: "自定义 Worker、明文源、现有项目或现有 KV 时使用。",
    btnRefresh: "刷新账户/域名",
    btnRead: "读取现有项目",
    btnRandom: "随机名称",
    btnUuid: "生成 UUID",
    lblAccount: "Account",
    lblZone: "Zone",
    lblCustomDomain: "自定义域名",
    lblAction: "操作",
    optCreate: "随机新建",
    optUpdate: "更新现有",
    lblExistProj: "现有项目",
    lblType: "部署方式",
    lblSource: "部署源",
    optEncoded: "加密 / 混淆",
    optPlain: "明文",
    lblProjName: "项目名称",
    lblKvTitle: "KV 名称",
    lblExistKv: "现有 KV",
    hintCreate: "新建模式会配置随机 UUID、KV 和域名；更新模式只同步代码。",
    hintUpdate: "更新模式只同步代码，不修改 KV、UUID、域名或项目配置。",
    chkWorkersDev: "Worker 模式启用 workers.dev",
    btnAdvDeploy: "高级部署",
    btnAdvUpdate: "更新部署",
    logsHead: "日志",
    clearLogs: "清空",
    aiModalTitle: "AI API 设置",
    aiDefaultText: "默认模型（Gemini API 系统默认 KEY）",
    aiCustomText: "自定义 OpenAI 兼容接口",
    aiModelLabel: "Model 名称",
    aiGuideBtn: "免费 AI API 获取指南",
    saveBtn: "保存设置",
    guideModalTitle: "免费 AI API 获取指南",
    guideIntro: "以下是推荐的稳定免费/低成本 AI API 获取渠道与对比说明：",
    thProvider: "提供商",
    thRateLimit: "免费额度 / 限速",
    thProsCons: "优缺点",
    thConfigEx: "配置示例 (Base URL & Model)",
    closeBtn: "关闭",
    noDomain: "不绑定域名",
    noDomainAvail: "账号内没有可用域名",
    loginSuccess: "登录成功",
    deploying: "部署中...",
    deployDone: "部署完成"
  },
  en: {
    eyebrow: "Cloudflare Auto Deployer",
    appTitle: "iBanKa！Cloud Deployer",
    summary: "Enter API Token or Email+Global Key to auto-deploy Pages/Worker with random UUID, KV, and project name in one click.",
    keySecurityTitle: "Security Note",
    keySecurityDesc: "Credentials are not stored locally; backend proxies requests directly to Cloudflare API.",
    loginHead: "1. Cloudflare Login",
    loginSub: "Supports Cloudflare API Token (email optional) or Global API Key (email required).",
    emailLabel: "Email (Optional for API Token)",
    keyLabel: "API Token / Global API Key",
    loginBtn: "Login and Continue",
    notLoggedIn: "Not logged in",
    quickHead: "2. Quick Deploy",
    quickSub: "Default uses Pages + Encrypted source. Enable domain binding to auto-generate a random subdomain.",
    backLogin: "Back to Login",
    domainLabel: "Available Domain",
    previewLabel: "Random Subdomain Preview",
    bindDomainCheck: "Bind Random Subdomain",
    quickDeployBtn: "Quick Deploy",
    waitDeploy: "Waiting for deployment",
    advancedSummary: "Advanced Settings & Update Existing Project",
    advancedHead: "Advanced Settings",
    advancedSub: "Use when specifying Worker, Plain source, existing project, or existing KV.",
    btnRefresh: "Refresh Accounts/Zones",
    btnRead: "Read Projects",
    btnRandom: "Random Names",
    btnUuid: "Generate UUID",
    lblAccount: "Account",
    lblZone: "Zone",
    lblCustomDomain: "Custom Domain",
    lblAction: "Action",
    optCreate: "Create Random",
    optUpdate: "Update Existing",
    lblExistProj: "Existing Project",
    lblType: "Deploy Type",
    lblSource: "Source Mode",
    optEncoded: "Encoded / Obfuscated",
    optPlain: "Plain Code",
    lblProjName: "Project Name",
    lblKvTitle: "KV Title",
    lblExistKv: "Existing KV",
    hintCreate: "Create mode configures random UUID, KV, and domain; Update mode syncs code only.",
    hintUpdate: "Update mode syncs code only; preserves existing KV, UUID, domain, and configs.",
    chkWorkersDev: "Enable workers.dev for Worker mode",
    btnAdvDeploy: "Advanced Deploy",
    btnAdvUpdate: "Update Deploy",
    logsHead: "Logs",
    clearLogs: "Clear",
    aiModalTitle: "AI API Settings",
    aiDefaultText: "Default Model (System Default Gemini API Key)",
    aiCustomText: "Custom OpenAI Compatible API",
    aiModelLabel: "Model Name",
    aiGuideBtn: "Free AI API Guide",
    saveBtn: "Save Settings",
    guideModalTitle: "Free AI API Guide",
    guideIntro: "Recommended free/low-cost AI API channels and comparison:",
    thProvider: "Provider",
    thRateLimit: "Quota / Rate Limit",
    thProsCons: "Pros & Cons",
    thConfigEx: "Config Example (Base URL & Model)",
    closeBtn: "Close",
    noDomain: "No Domain Binding",
    noDomainAvail: "No available domains in account",
    loginSuccess: "Login Successful",
    deploying: "Deploying...",
    deployDone: "Deployment Complete"
  }
};

// Language Initialization
applyLanguage(state.lang);

$('langZh').addEventListener('click', () => switchLanguage('zh'));
$('langEn').addEventListener('click', () => switchLanguage('en'));

function switchLanguage(lang) {
  state.lang = lang;
  localStorage.setItem('app_lang', lang);
  applyLanguage(lang);
}

function applyLanguage(lang) {
  $('langZh').classList.toggle('active', lang === 'zh');
  $('langEn').classList.toggle('active', lang === 'en');
  const dict = i18n[lang] || i18n.zh;
  document.querySelectorAll('[data-i18n]').forEach(elem => {
    const key = elem.getAttribute('data-i18n');
    if (dict[key]) elem.textContent = dict[key];
  });
  document.title = `${lang === 'zh' ? 'iBanKa！云端部署器' : 'iBanKa！Cloud Deployer'}`;
  syncModeState();
}

setRandomNames();
$('uuid').value = crypto.randomUUID();
fillSelect($('accountId'), [], 'Auto First Account');
fillSelect($('zoneId'), [], 'Auto Subdomain');
fillSelect($('quickZone'), [], 'No Domains');
fillProjectSelect();
fillKvSelect();

$('loginButton').addEventListener('click', login);
$('backToLogin').addEventListener('click', () => {
  state.loggedIn = false;
  showPage('login');
  setLoginStatus(i18n[state.lang].notLoggedIn);
});
$('quickDeploy').addEventListener('click', () => runDeploy(collectQuickPayload));
$('deploy').addEventListener('click', () => runDeploy(collectAdvancedPayload));
$('newNames').addEventListener('click', setRandomNames);
$('newUuid').addEventListener('click', () => { $('uuid').value = crypto.randomUUID(); });
$('bindDomain').addEventListener('change', updateQuickDomainPreview);
$('quickZone').addEventListener('change', updateQuickDomainPreview);
$('clearLogs').addEventListener('click', () => { $('logs').textContent = ''; });

$('accountId').addEventListener('change', async () => {
  if ($('accountId').value) await loadResources();
});

$('deployMode').addEventListener('change', syncModeState);

$('existingProject').addEventListener('change', () => {
  const selected = parseProjectValue($('existingProject').value);
  if (!selected) return;
  $('deployMode').value = 'update';
  $('deployType').value = selected.type;
  $('projectName').value = selected.name;
  syncModeState();
});

$('kvId').addEventListener('change', () => {
  const selected = state.kvs.find(item => item.id === $('kvId').value);
  if (selected) $('kvTitle').value = selected.title || '';
});

$('loadAccounts').addEventListener('click', async () => {
  setBusy(true);
  try {
    await loadCloudflareBase();
    if ($('accountId').value) await loadResources();
  } catch (error) {
    setResult(error.message, 'error');
  } finally {
    setBusy(false);
  }
});

$('loadResources').addEventListener('click', async () => {
  setBusy(true);
  try { await loadResources(); } catch (error) { setResult(error.message, 'error'); } finally { setBusy(false); }
});

// AI API Settings
loadAiSettings();

$('aiSettingsBtn').addEventListener('click', () => { $('aiModal').classList.remove('page-hidden'); });
$('closeAiModal').addEventListener('click', () => { $('aiModal').classList.add('page-hidden'); });
$('openAiGuideBtn').addEventListener('click', () => { $('aiGuideModal').classList.remove('page-hidden'); });
$('closeGuideModal').addEventListener('click', () => { $('aiGuideModal').classList.add('page-hidden'); });
$('closeGuideBtn').addEventListener('click', () => { $('aiGuideModal').classList.add('page-hidden'); });

$('aiProviderDefault').addEventListener('change', toggleAiFields);
$('aiProviderCustom').addEventListener('change', toggleAiFields);

$('saveAiSettings').addEventListener('click', () => {
  const isCustom = $('aiProviderCustom').checked;
  const config = {
    provider: isCustom ? 'custom' : 'default',
    baseUrl: $('aiBaseUrl').value.trim(),
    apiKey: $('aiApiKey').value.trim(),
    modelName: $('aiModelName').value.trim()
  };
  localStorage.setItem('ai_config', JSON.stringify(config));
  $('aiModal').classList.add('page-hidden');
  log(`AI API Settings Saved (${config.provider})`);
});

function toggleAiFields() {
  $('customAiFields').classList.toggle('page-hidden', !$('aiProviderCustom').checked);
}

function loadAiSettings() {
  try {
    const raw = localStorage.getItem('ai_config');
    if (!raw) return;
    const config = JSON.parse(raw);
    if (config.provider === 'custom') {
      $('aiProviderCustom').checked = true;
      $('customAiFields').classList.remove('page-hidden');
    }
    $('aiBaseUrl').value = config.baseUrl || '';
    $('aiApiKey').value = config.apiKey || '';
    $('aiModelName').value = config.modelName || '';
  } catch (e) { /* ignore */ }
}

async function login() {
  setLoginStatus('Logging in...');
  setBusy(true);
  try {
    await loadCloudflareBase();
    state.loggedIn = true;
    showPage('deploy');
    setLoginStatus(i18n[state.lang].loginSuccess, 'success');
    setResult(i18n[state.lang].loginSuccess, 'success');
  } catch (error) {
    setLoginStatus(error.message, 'error');
    log(`Login error: ${error.message}`);
  } finally {
    setBusy(false);
  }
}

async function loadCloudflareBase() {
  const credentials = getCredentials();
  const [accountsRes, zonesRes] = await Promise.all([
    post('/api/accounts', { credentials }),
    post('/api/zones', { credentials })
  ]);
  state.accounts = accountsRes.accounts || [];
  state.zones = zonesRes.zones || [];
  fillSelect($('accountId'), state.accounts, 'Select Account');
  fillSelect($('zoneId'), state.zones, 'Select Subdomain');
  fillSelect($('quickZone'), state.zones, state.zones.length ? 'No Domain' : 'No Domains');
  updateQuickDomainPreview();
  log(`Accounts: ${state.accounts.length}, Zones: ${state.zones.length}`);
}

async function runDeploy(collector) {
  if (!state.loggedIn) {
    setResult('Please login first', 'error');
    showPage('login');
    return;
  }
  setResult(i18n[state.lang].deploying);
  setBusy(true);
  try {
    const payload = collector();
    const result = await post('/api/deploy', payload);
    (result.logs || []).forEach(log);
    setResult(formatDeployResult(payload, result), 'success');
  } catch (error) {
    setResult(error.message, 'error');
    log(`Deploy error: ${error.message}`);
  } finally {
    setBusy(false);
  }
}

function formatDeployResult(payload, result) {
  if (payload.deployMode === 'update') return `${result.projectName} updated successfully`;
  if (result.domain?.hostname) return `https://${result.domain.hostname}/${result.uuid}`;
  return `${result.projectName} deployed, UUID: ${result.uuid}`;
}

async function loadResources() {
  const credentials = getCredentials();
  const accountId = $('accountId').value;
  if (!accountId) throw new Error('Please select Account');
  setResult('Loading resources...');
  const resources = await post('/api/resources', { credentials, accountId });
  state.workers = resources.workers || [];
  state.pages = resources.pages || [];
  state.kvs = resources.kvs || [];
  fillProjectSelect();
  fillKvSelect();
  log(`Workers: ${state.workers.length}, Pages: ${state.pages.length}, KVs: ${state.kvs.length}`);
  setResult('Resources loaded', 'success');
}

function getCredentials() {
  const email = $('email').value.trim();
  const key = $('key').value.trim();
  if (!key) throw new Error(state.lang === 'zh' ? '请填写 Cloudflare API Token 或 Global API Key' : 'Please enter API Token or Global API Key');
  return { email, key };
}

function collectQuickPayload() {
  const selectedZone = state.zones.find(item => item.id === $('quickZone').value) || state.zones[0];
  const shouldBindDomain = $('bindDomain').checked && !!selectedZone;
  const hostname = shouldBindDomain ? randomSubdomain(selectedZone.name) : '';
  return {
    credentials: getCredentials(),
    accountId: $('accountId').value,
    deployMode: 'create',
    deployType: 'pages',
    sourceMode: 'encoded',
    projectName: randomName('edge'),
    uuid: crypto.randomUUID(),
    kvTitle: randomName('store'),
    hostname,
    zoneId: shouldBindDomain ? selectedZone.id : '',
    autoDomain: false
  };
}

function collectAdvancedPayload() {
  const credentials = getCredentials();
  const deployMode = $('deployMode').value;
  const selectedProject = parseProjectValue($('existingProject').value);
  if (deployMode === 'update') {
    const projectName = $('projectName').value.trim() || selectedProject?.name || '';
    if (!projectName) throw new Error('Project name required for update');
    return { credentials, accountId: $('accountId').value, deployMode, deployType: $('deployType').value, sourceMode: $('sourceMode').value, projectName };
  }
  const hostname = $('advancedHostname').value.trim();
  return {
    credentials,
    accountId: $('accountId').value,
    deployMode,
    deployType: $('deployType').value,
    sourceMode: $('sourceMode').value,
    projectName: $('projectName').value.trim() || randomName('edge'),
    uuid: $('uuid').value.trim() || crypto.randomUUID(),
    kvTitle: $('kvTitle').value.trim() || randomName('store'),
    kvId: $('kvId').value,
    hostname,
    zoneId: $('zoneId').value,
    autoDomain: false,
    enableWorkersDev: $('enableWorkersDev').checked
  };
}

function fillSelect(select, items, emptyLabel) {
  select.innerHTML = '';
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = emptyLabel;
  select.append(empty);
  for (const item of items) {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = `${item.name} (${item.id})`;
    select.append(option);
  }
  if (items.length === 1) select.value = items[0].id;
}

function fillProjectSelect() {
  const select = $('existingProject');
  select.innerHTML = '';
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = state.workers.length || state.pages.length ? 'Select project to update' : 'No projects';
  select.append(empty);
  for (const worker of state.workers) appendOption(select, `worker:${worker.name}`, `Worker: ${worker.title || worker.name}`);
  for (const page of state.pages) appendOption(select, `pages:${page.name}`, `Pages: ${page.title || page.name}`);
}

function fillKvSelect() {
  const select = $('kvId');
  select.innerHTML = '';
  appendOption(select, '', $('deployMode').value === 'update' ? 'Update mode skips KV' : 'Create Random KV');
  for (const kv of state.kvs) appendOption(select, kv.id, `${kv.title || kv.id} (${kv.id})`);
}

function appendOption(select, value, text) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = text;
  select.append(option);
}

function parseProjectValue(value) {
  if (!value || !value.includes(':')) return null;
  const index = value.indexOf(':');
  return { type: value.slice(0, index), name: value.slice(index + 1) };
}

async function post(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error || `Request failed: ${response.status}`);
  return data;
}

function setRandomNames() {
  $('projectName').value = randomName('edge');
  $('kvTitle').value = randomName('store');
  $('kvId').value = '';
  $('existingProject').value = '';
  $('deployMode').value = 'create';
  updateQuickDomainPreview();
  syncModeState();
}

function updateQuickDomainPreview() {
  const selectedZone = state.zones.find(item => item.id === $('quickZone').value) || state.zones[0];
  if (!$('bindDomain').checked) {
    $('quickHostnamePreview').value = i18n[state.lang].noDomain;
    return;
  }
  if (!selectedZone) {
    $('quickHostnamePreview').value = i18n[state.lang].noDomainAvail;
    return;
  }
  $('quickHostnamePreview').value = randomSubdomain(selectedZone.name);
}

function randomSubdomain(zoneName) { return `${randomName('edge')}.${zoneName}`; }
function randomName(prefix) { return `${prefix}-${crypto.randomUUID().slice(0, 8)}`; }

function syncModeState() {
  const updating = $('deployMode').value === 'update';
  const dict = i18n[state.lang] || i18n.zh;
  $('deploy').textContent = updating ? dict.btnAdvUpdate : dict.btnAdvDeploy;
  $('modeHint').textContent = updating ? dict.hintUpdate : dict.hintCreate;
  for (const id of ['uuid', 'kvTitle', 'kvId', 'advancedHostname', 'zoneId', 'enableWorkersDev']) {
    $(id).disabled = updating;
  }
}

function showPage(page) {
  $('loginPage').classList.toggle('page-hidden', page !== 'login');
  $('deployPage').classList.toggle('page-hidden', page !== 'deploy');
}

function setBusy(busy) {
  for (const button of document.querySelectorAll('button')) button.disabled = busy;
}

function setLoginStatus(text, type = '') {
  $('loginStatus').textContent = text;
  $('loginStatus').className = `result ${type}`.trim();
}

function setResult(text, type = '') {
  $('result').textContent = text;
  $('result').className = `result ${type}`.trim();
}

function log(text) {
  const target = $('logs');
  target.textContent += `[${new Date().toLocaleTimeString()}] ${text}\n`;
  target.scrollTop = target.scrollHeight;
}
