const API_BASE = 'https://api.cloudflare.com/client/v4';
const COMPAT_DATE = '2026-01-20';
const BINDING_NAME = 'C';
const SOURCE_BASE = 'https://raw.githubusercontent.com/byJoey/cfnew/main';

export default {
  async fetch(request, env, ctx) {
    const pathname = new URL(request.url).pathname;
    if (pathname.startsWith('/api/')) {
      const context = { request, env, waitUntil: ctx?.waitUntil?.bind(ctx) };
      return request.method === 'POST' ? onRequestPost(context) : onRequest();
    }
    if (env?.ASSETS?.fetch) return env.ASSETS.fetch(request);
    return new Response('Not Found', { status: 404 });
  }
};

export async function onRequestPost(context) {
  try {
    const data = await context.request.json().catch(() => ({}));
    const route = new URL(context.request.url).pathname.replace(/^\/api\/?/, '');
    if (route === 'accounts') {
      const list = await callApi(data.credentials, '/accounts?per_page=50');
      return jsonRes(200, { ok: true, accounts: list.map(a => ({ id: a.id, name: a.name })) });
    }
    if (route === 'zones') {
      const list = await callApi(data.credentials, '/zones?status=active&per_page=100');
      return jsonRes(200, { ok: true, zones: list.map(z => ({ id: z.id, name: z.name })) });
    }
    if (route === 'resources') {
      if (!data.accountId) throw new Error('缺少 Account ID');
      const res = await fetchResources(data.credentials, data.accountId);
      return jsonRes(200, { ok: true, ...res });
    }
    if (route === 'deploy') {
      const result = await executeDeploy(data, context);
      return jsonRes(200, { ok: true, ...result });
    }
    return jsonRes(404, { ok: false, error: '接口不存在' });
  } catch (err) {
    return jsonRes(500, { ok: false, error: err.message || String(err) });
  }
}

export function onRequest() {
  return jsonRes(405, { ok: false, error: '仅支持 POST 请求' });
}

function getAuthHeaders(credentials) {
  const key = String(credentials?.key || '').trim();
  const email = String(credentials?.email || '').trim();
  const isGlobal = /^[a-f0-9]{37}$/i.test(key) && Boolean(email);
  if (isGlobal) {
    return { 'X-Auth-Email': email, 'X-Auth-Key': key };
  }
  const token = key.startsWith('Bearer ') ? key.slice(7) : key;
  return { 'Authorization': `Bearer ${token}` };
}

async function callApi(credentials, path, options = {}) {
  const resData = await callApiRaw(credentials, path, options);
  if (resData && typeof resData === 'object' && 'success' in resData) {
    if (!resData.success) {
      const msg = (resData.errors || []).map(e => e.message || JSON.stringify(e)).join('; ') || 'Cloudflare API 请求失败';
      throw new Error(msg);
    }
    return resData.result;
  }
  return resData;
}

async function callApiRaw(credentials, path, options = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const headers = { ...getAuthHeaders(credentials), ...(options.headers || {}) };
  let body = options.body;
  if (body && !(body instanceof FormData) && typeof body !== 'string') {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    body = JSON.stringify(body);
  }
  const res = await fetch(url, { method: options.method || 'GET', headers, body });
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = typeof data === 'string' ? data : (data.errors || []).map(e => e.message || JSON.stringify(e)).join('; ');
    throw new Error(`${res.status} ${res.statusText}${msg ? ` - ${msg}` : ''}`);
  }
  return data;
}

async function fetchResources(credentials, accountId) {
  const [workerResult, pagesResult, kvResult] = await Promise.allSettled([
    callApi(credentials, `/accounts/${accountId}/workers/scripts?per_page=100`),
    callApi(credentials, `/accounts/${accountId}/pages/projects`),
    callApi(credentials, `/accounts/${accountId}/storage/kv/namespaces?per_page=100`)
  ]);
  const warnings = [];
  const workers = (workerResult.status === 'fulfilled' && Array.isArray(workerResult.value) ? workerResult.value : [])
    .map(p => ({ name: p.id || p.script_name || p.name, title: p.id || p.script_name || p.name }))
    .filter(p => p.name);
  const pages = (pagesResult.status === 'fulfilled' && Array.isArray(pagesResult.value) ? pagesResult.value : [])
    .map(p => ({ name: p.name, title: p.name }))
    .filter(p => p.name);
  const kvs = (kvResult.status === 'fulfilled' && Array.isArray(kvResult.value) ? kvResult.value : [])
    .map(k => ({ id: k.id, title: k.title }))
    .filter(k => k.id);
  return { workers, pages, kvs, warnings };
}

async function executeDeploy(data, context) {
  if (!data?.credentials?.key) throw new Error('缺少 Cloudflare API Token 或 Global API Key');
  if (!data.accountId) throw new Error('缺少 Account ID');

  const logs = [];
  const log = msg => logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
  const uuid = data.uuid || crypto.randomUUID();
  const isUpdate = data.deployMode === 'update';
  const projectName = isUpdate ? data.projectName : cleanName(data.projectName || randName('edge'));
  const mode = data.sourceMode === 'plain' ? 'plain' : 'encoded';
  const deployType = data.deployType === 'worker' ? 'worker' : 'pages';

  log(`准备${isUpdate ? '更新' : '部署'} ${deployType === 'pages' ? 'Pages' : 'Worker'}: ${projectName}`);

  if (isUpdate) {
    if (deployType === 'worker') {
      await syncWorker(data.credentials, data.accountId, projectName, mode, log);
    } else {
      await syncPages(data.credentials, data.accountId, projectName, mode, log);
    }
    return { deployType, projectName, sourceMode: mode, logs };
  }

  const kv = await getOrCreateKv(data.credentials, data.accountId, data.kvId, data.kvTitle || randName('store'), log);

  if (deployType === 'worker') {
    await deployWorker(data.credentials, data.accountId, projectName, mode, uuid, kv.id, !!data.enableWorkersDev, log);
  } else {
    await deployPages(data.credentials, data.accountId, projectName, mode, uuid, kv.id, log);
  }

  let domain = null;
  if (data.hostname && data.zoneId) {
    domain = await bindDomain(data.credentials, data.accountId, data.zoneId, projectName, data.hostname, deployType, log);
  }

  return { deployType, projectName, sourceMode: mode, uuid, kv: { id: kv.id, title: kv.title || '' }, domain, logs };
}

async function fetchSourceCode(mode) {
  const filename = mode === 'plain' ? '明文源吗' : '少年你相信光吗';
  const url = `${SOURCE_BASE}/${encodeURIComponent(filename)}?t=${Date.now()}`;
  const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } });
  if (!res.ok) throw new Error(`实时拉取源文件失败: ${res.status}`);
  const text = await res.text();
  if (!text.trim()) throw new Error('远程源文件为空');
  return text;
}

async function getOrCreateKv(credentials, accountId, kvId, title, log) {
  const list = await callApi(credentials, `/accounts/${accountId}/storage/kv/namespaces?per_page=100`);
  if (kvId) {
    const found = list.find(item => item.id === kvId);
    if (found) { log(`复用 KV: ${found.title}`); return found; }
    return { id: kvId, title };
  }
  const existing = list.find(item => item.title === title);
  if (existing) { log(`复用 KV: ${title}`); return existing; }
  const res = await callApi(credentials, `/accounts/${accountId}/storage/kv/namespaces`, { method: 'POST', body: { title } });
  log(`创建 KV: ${title}`);
  return { ...res, title };
}

async function deployWorker(credentials, accountId, scriptName, sourceMode, uuid, kvId, enableWorkersDev, log) {
  const code = await fetchSourceCode(sourceMode);
  const formData = new FormData();
  const metadata = {
    main_module: 'worker.js',
    compatibility_date: COMPAT_DATE,
    bindings: [
      { type: 'plain_text', name: 'u', text: uuid },
      { type: 'kv_namespace', name: BINDING_NAME, namespace_id: kvId }
    ]
  };
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }), 'metadata.json');
  formData.append('worker.js', new Blob([code], { type: 'application/javascript+module' }), 'worker.js');
  await callApi(credentials, `/accounts/${accountId}/workers/scripts/${encodeURIComponent(scriptName)}`, { method: 'PUT', body: formData });
  log('Worker 脚本上传完成');
  if (enableWorkersDev) {
    try { await callApi(credentials, `/accounts/${accountId}/workers/scripts/${encodeURIComponent(scriptName)}/subdomain`, { method: 'POST', body: { enabled: true } }); } catch { /* ignore */ }
  }
}

async function syncWorker(credentials, accountId, scriptName, sourceMode, log) {
  const code = await fetchSourceCode(sourceMode);
  const settings = await callApi(credentials, `/accounts/${accountId}/workers/scripts/${encodeURIComponent(scriptName)}/settings`);
  const metadata = { main_module: 'worker.js', compatibility_date: settings?.compatibility_date || COMPAT_DATE, bindings: settings?.bindings || [] };
  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }), 'metadata.json');
  formData.append('worker.js', new Blob([code], { type: 'application/javascript+module' }), 'worker.js');
  await callApi(credentials, `/accounts/${accountId}/workers/scripts/${encodeURIComponent(scriptName)}`, { method: 'PUT', body: formData });
  log('Worker 代码已同步');
}

async function deployPages(credentials, accountId, projectName, sourceMode, uuid, kvId, log) {
  await createOrUpdatePagesProject(credentials, accountId, projectName, uuid, kvId, log);
  const code = await fetchSourceCode(sourceMode);
  await uploadPagesDeployment(credentials, accountId, projectName, code, log);
}

async function syncPages(credentials, accountId, projectName, sourceMode, log) {
  const code = await fetchSourceCode(sourceMode);
  await uploadPagesDeployment(credentials, accountId, projectName, code, log);
}

async function createOrUpdatePagesProject(credentials, accountId, projectName, uuid, kvId, log) {
  const config = { compatibility_date: COMPAT_DATE, env_vars: { u: { type: 'plain_text', value: uuid } }, kv_namespaces: { [BINDING_NAME]: { namespace_id: kvId } } };
  let project = null;
  try {
    project = await callApi(credentials, `/accounts/${accountId}/pages/projects/${encodeURIComponent(projectName)}`);
  } catch (e) { /* ignore */ }

  if (!project) {
    await callApi(credentials, `/accounts/${accountId}/pages/projects`, {
      method: 'POST',
      body: { name: projectName, production_branch: 'main', deployment_configs: { production: config, preview: config } }
    });
    log('Pages 项目已创建');
  } else {
    await callApi(credentials, `/accounts/${accountId}/pages/projects/${encodeURIComponent(projectName)}`, {
      method: 'PATCH',
      body: { deployment_configs: { production: config, preview: config } }
    });
    log('Pages 项目配置已更新');
  }
}

async function uploadPagesDeployment(credentials, accountId, projectName, workerCode, log) {
  const { jwt } = await callApi(credentials, `/accounts/${accountId}/pages/projects/${encodeURIComponent(projectName)}/upload-token`);
  const htmlContent = '<!doctype html><meta charset="utf-8"><title>Deploy</title>';
  const bytes = new TextEncoder().encode(htmlContent);
  const hash = await computeHash(bytes, 'html');
  const base64Str = bytesToBase64(bytes);

  await fetch(`${API_BASE}/pages/assets/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([{ key: hash, value: base64Str, metadata: { contentType: 'text/html; charset=utf-8' }, base64: true }])
  }).catch(() => null);

  const formData = new FormData();
  formData.append('manifest', JSON.stringify({ '/index.html': hash }));
  formData.append('branch', 'main');
  formData.append('commit_dirty', 'true');
  formData.append('commit_message', 'deploy from web app');

  const bundleInner = new FormData();
  bundleInner.set('metadata', JSON.stringify({ main_module: 'worker.js', compatibility_date: COMPAT_DATE }));
  bundleInner.set('worker.js', new Blob([workerCode], { type: 'application/javascript+module' }), 'worker.js');
  const bundleBlob = await new Response(bundleInner).blob();
  formData.append('_worker.bundle', bundleBlob, '_worker.bundle');

  const dep = await callApi(credentials, `/accounts/${accountId}/pages/projects/${encodeURIComponent(projectName)}/deployments`, {
    method: 'POST',
    body: formData
  });
  if (dep?.url) log(`Pages 访问地址: ${dep.url}`);
}

async function bindDomain(credentials, accountId, zoneId, projectName, hostname, deployType, log) {
  if (deployType === 'pages') {
    const res = await callApi(credentials, `/accounts/${accountId}/pages/projects/${encodeURIComponent(projectName)}/domains`, { method: 'POST', body: { name: hostname } });
    log(`Pages 域名已绑定: ${hostname}`);
    return { hostname: res.name || hostname, type: 'pages' };
  }
  try {
    const res = await callApi(credentials, `/accounts/${accountId}/workers/domains`, {
      method: 'PUT',
      body: { environment: 'production', hostname, service: projectName, zone_id: zoneId }
    });
    log(`Worker 域名已绑定: ${hostname}`);
    return { hostname: res.hostname || hostname, type: 'worker' };
  } catch (e) {
    await callApi(credentials, `/zones/${zoneId}/workers/routes`, { method: 'POST', body: { pattern: `${hostname}/*`, script: projectName } });
    log(`Worker Route 已绑定: ${hostname}/*`);
    return { hostname, type: 'route' };
  }
}

async function computeHash(bytes, ext) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${bytesToBase64(bytes)}${ext}`));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

function bytesToBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.slice(i, i + 0x8000));
  return btoa(bin);
}

function cleanName(name) {
  return String(name || randName('edge')).trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || randName('edge');
}

function randName(prefix) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function jsonRes(status, data) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
