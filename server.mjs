import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { callCfApi } from './lib/cf-api.js';
import {
  bindDomain,
  cleanProjectName,
  deployPages,
  deployWorker,
  getOrCreateKv,
  getRandomName,
  initKv,
  listDomains,
  syncPagesCode,
  syncWorkerCode,
  validateDeployParams
} from './lib/deploy-engine.js';

const PORT = Number(process.env.PORT || 3000);
const STATIC_DIR = resolve(import.meta.dirname, 'public');

const server = createServer(async (req, res) => {
  try {
    if (req.url?.startsWith('/api/')) {
      await handleApi(req, res);
    } else {
      await handleStatic(req, res);
    }
  } catch (err) {
    sendJson(res, 500, { ok: false, error: err.message || String(err) });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`iBanKa！云端部署器已启动: http://localhost:${PORT}`);
});

async function handleApi(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: '仅支持 POST 请求' });
    return;
  }
  const data = await parseJson(req);

  if (req.url === '/api/accounts') {
    const accounts = await callCfApi(data.credentials, '/accounts?per_page=50');
    sendJson(res, 200, { ok: true, accounts: accounts.map(a => ({ id: a.id, name: a.name })) });
    return;
  }
  if (req.url === '/api/zones') {
    const zones = await callCfApi(data.credentials, '/zones?status=active&per_page=100');
    sendJson(res, 200, { ok: true, zones: zones.map(z => ({ id: z.id, name: z.name })) });
    return;
  }
  if (req.url === '/api/resources') {
    if (!data.accountId) throw new Error('缺少 Account ID');
    const resources = await fetchResources(data.credentials, data.accountId);
    sendJson(res, 200, { ok: true, ...resources });
    return;
  }
  if (req.url === '/api/deploy') {
    const result = await executeDeploy(data);
    sendJson(res, 200, { ok: true, ...result });
    return;
  }
  sendJson(res, 404, { ok: false, error: '接口不存在' });
}

async function fetchResources(credentials, accountId) {
  const [workerResult, pagesResult, kvResult] = await Promise.allSettled([
    callCfApi(credentials, `/accounts/${accountId}/workers/scripts?per_page=100`),
    callCfApi(credentials, `/accounts/${accountId}/pages/projects`),
    callCfApi(credentials, `/accounts/${accountId}/storage/kv/namespaces?per_page=100`)
  ]);
  const warnings = [];
  const workers = extractList(workerResult, warnings, 'Worker')
    .map(p => ({ name: p.id || p.script_name || p.name, title: p.id || p.script_name || p.name }))
    .filter(p => p.name);
  const pages = extractList(pagesResult, warnings, 'Pages')
    .map(p => ({ name: p.name, title: p.name }))
    .filter(p => p.name);
  const kvs = extractList(kvResult, warnings, 'KV')
    .map(k => ({ id: k.id, title: k.title }))
    .filter(k => k.id);
  return { workers, pages, kvs, warnings };
}

function extractList(result, warnings, label) {
  if (result.status === 'fulfilled') return Array.isArray(result.value) ? result.value : [];
  warnings.push(`${label} 列表读取失败: ${result.reason?.message || result.reason}`);
  return [];
}

async function executeDeploy(data) {
  validateDeployParams(data);
  const logs = [];
  const log = msg => logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
  const uuid = data.uuid || crypto.randomUUID();
  const isUpdate = data.deployMode === 'update';
  const projectName = isUpdate ? data.projectName : cleanProjectName(data.projectName || getRandomName('edge'));
  const mode = data.sourceMode === 'plain' ? 'plain' : 'encoded';
  const deployType = data.deployType === 'worker' ? 'worker' : 'pages';

  log(`准备${isUpdate ? '更新' : '部署'} ${deployType === 'pages' ? 'Pages' : 'Worker'}: ${projectName}`);

  if (isUpdate) {
    if (deployType === 'worker') {
      await syncWorkerCode(data.credentials, { accountId: data.accountId, scriptName: projectName, sourceMode: mode }, log);
    } else {
      await syncPagesCode(data.credentials, { accountId: data.accountId, projectName, sourceMode: mode }, log);
    }
    return { deployType, projectName, sourceMode: mode, logs };
  }

  const kv = await getOrCreateKv(data.credentials, data.accountId, { id: data.kvId, title: data.kvTitle || getRandomName('store') }, log);
  if (kv.created) {
    await initKv(data.credentials, data.accountId, kv.id, log);
  }

  if (deployType === 'worker') {
    await deployWorker(data.credentials, { accountId: data.accountId, scriptName: projectName, sourceMode: mode, uuid, kvId: kv.id, enableWorkersDev: !!data.enableWorkersDev }, log);
  } else {
    await deployPages(data.credentials, { accountId: data.accountId, projectName, sourceMode: mode, uuid, kvId: kv.id }, log);
  }

  let domain = null;
  if (data.hostname && data.zoneId) {
    domain = await bindDomain(data.credentials, { accountId: data.accountId, deployType, projectName, zoneId: data.zoneId, hostname: data.hostname }, log);
  }
  const domains = await listDomains(data.credentials, { accountId: data.accountId, deployType, projectName }, log);

  return { deployType, projectName, sourceMode: mode, uuid, kv: { id: kv.id, title: kv.title || '' }, domain, domains, logs };
}

async function handleStatic(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const filePath = resolve(STATIC_DIR, `.${pathname}`);
  if (!filePath.startsWith(STATIC_DIR) || !existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }
  const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' }[extname(filePath)] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime });
  res.end(await readFile(filePath));
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

async function parseJson(req) {
  let body = '';
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : {};
}
