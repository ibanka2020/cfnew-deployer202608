import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { callCfApi, callCfApiRaw, isGlobalApiKey } from './cf-api.js';

export const COMPAT_DATE = '2026-01-20';
export const BINDING_NAME = 'C';
export const SOURCE_BASE_URL = 'https://raw.githubusercontent.com/byJoey/cfnew/main';

const sourcesDir = resolve(import.meta.dirname, '..', 'public', 'sources');

export function validateDeployParams(data) {
  if (!data?.credentials?.key) throw new Error('缺少 Cloudflare API Token 或 Global API Key');
  if (!data.accountId) throw new Error('缺少 Account ID');
  if (data.deployMode === 'update' && !String(data.projectName || '').trim()) throw new Error('更新现有项目时必须选择项目名称');
  if (data.deployMode === 'update') return;
  if (data.hostname && !data.zoneId) throw new Error('绑定域名时必须选择 Zone');
}

export function cleanProjectName(name) {
  return String(name || getRandomName('edge'))
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || getRandomName('edge');
}

export function getRandomName(prefix) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

export async function fetchSourceCode(mode) {
  const filename = mode === 'plain' ? '明文源吗' : '少年你相信光吗';
  const url = `${SOURCE_BASE_URL}/${encodeURIComponent(filename)}?t=${Date.now()}`;
  try {
    const res = await fetch(url, {
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' }
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const text = await res.text();
    if (!text.trim()) throw new Error('远程源文件为空');
    return text;
  } catch (err) {
    try {
      return await readFile(join(sourcesDir, filename), 'utf8');
    } catch {
      throw new Error(`实时拉取源文件失败: ${err.message}`);
    }
  }
}

export async function runWrangler(args, credentials, accountId, workDir = process.cwd()) {
  return new Promise((resolvePromise, reject) => {
    const isGlobal = isGlobalApiKey(credentials);
    const key = String(credentials?.key || '').trim();
    const token = key.startsWith('Bearer ') ? key.slice(7) : key;
    const envVars = {
      ...process.env,
      CLOUDFLARE_ACCOUNT_ID: accountId
    };
    if (isGlobal) {
      envVars.CLOUDFLARE_EMAIL = credentials.email;
      envVars.CLOUDFLARE_API_KEY = credentials.key;
    } else {
      envVars.CLOUDFLARE_API_TOKEN = token;
    }

    const subProcess = spawn('npx', ['-y', 'wrangler', ...args], {
      cwd: workDir,
      env: envVars,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    subProcess.stdout.on('data', chunk => { output += chunk.toString(); });
    subProcess.stderr.on('data', chunk => { output += chunk.toString(); });
    subProcess.on('error', reject);
    subProcess.on('close', code => {
      if (code === 0) resolvePromise(output);
      else reject(new Error(output || `wrangler 退出码: ${code}`));
    });
  });
}

export async function getOrCreateKv(credentials, accountId, options, log) {
  const list = await callCfApi(credentials, `/accounts/${accountId}/storage/kv/namespaces?per_page=100`);
  if (options.id) {
    const found = list.find(item => item.id === options.id);
    if (found) {
      log(`复用 KV: ${found.title}`);
      return { ...found, created: false };
    }
    log(`使用指定 KV: ${options.id}`);
    return { id: options.id, title: options.title || options.id, created: false };
  }
  const title = options.title;
  const existing = list.find(item => item.title === title);
  if (existing) {
    log(`复用 KV: ${title}`);
    return { ...existing, created: false };
  }
  const res = await callCfApi(credentials, `/accounts/${accountId}/storage/kv/namespaces`, {
    method: 'POST',
    body: { title }
  });
  log(`创建 KV: ${title}`);
  return { ...res, title, created: true };
}

export async function initKv(credentials, accountId, namespaceId, log) {
  await callCfApiRaw(credentials, `/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/c`, {
    method: 'PUT',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    body: '{}'
  });
  await callCfApiRaw(credentials, `/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/c_ver`, {
    method: 'PUT',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    body: String(Date.now())
  });
  log('KV 已写入初始配置');
}

export async function deployWorker(credentials, options, log) {
  const code = await fetchSourceCode(options.sourceMode);
  const formData = new FormData();
  const metadata = {
    main_module: 'worker.js',
    compatibility_date: COMPAT_DATE,
    bindings: [
      { type: 'plain_text', name: 'u', text: options.uuid },
      { type: 'kv_namespace', name: BINDING_NAME, namespace_id: options.kvId }
    ]
  };
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }), 'metadata.json');
  formData.append('worker.js', new Blob([code], { type: 'application/javascript+module' }), 'worker.js');
  await callCfApi(credentials, `/accounts/${options.accountId}/workers/scripts/${encodeURIComponent(options.scriptName)}`, {
    method: 'PUT',
    body: formData
  });
  log('Worker 脚本上传完成');
  if (options.enableWorkersDev) {
    await enableWorkersDev(credentials, options.accountId, options.scriptName);
    log('workers.dev 默认域名已启用');
  }
}

export async function syncWorkerCode(credentials, options, log) {
  const code = await fetchSourceCode(options.sourceMode);
  const settings = await callCfApi(credentials, `/accounts/${options.accountId}/workers/scripts/${encodeURIComponent(options.scriptName)}/settings`);
  const metadata = {};
  for (const field of ['main_module', 'compatibility_date', 'compatibility_flags', 'bindings', 'migrations', 'usage_model', 'limits', 'placement', 'tail_consumers', 'logpush']) {
    if (settings?.[field] !== undefined && settings?.[field] !== null) metadata[field] = settings[field];
  }
  if (!metadata.main_module) metadata.main_module = 'worker.js';
  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }), 'metadata.json');
  formData.append('worker.js', new Blob([code], { type: 'application/javascript+module' }), 'worker.js');
  await callCfApi(credentials, `/accounts/${options.accountId}/workers/scripts/${encodeURIComponent(options.scriptName)}`, {
    method: 'PUT',
    body: formData
  });
  log('Worker 代码已同步');
}

export async function deployPages(credentials, options, log) {
  await createOrUpdatePagesProject(credentials, options, log);
  const tmpDir = await mkdtemp(join(tmpdir(), 'deploy-panel-pages-'));
  try {
    const code = await fetchSourceCode(options.sourceMode);
    await writeFile(join(tmpDir, '_worker.js'), code, 'utf8');
    await writeFile(join(tmpDir, 'index.html'), '<!doctype html><meta charset="utf-8"><title>Deploy</title>', 'utf8');
    await writeFile(join(tmpDir, 'wrangler.toml'), `name = "${options.projectName}"\ncompatibility_date = "${COMPAT_DATE}"\npages_build_output_dir = "."\n\n[vars]\nu = "${options.uuid}"\n\n[[kv_namespaces]]\nbinding = "${BINDING_NAME}"\nid = "${options.kvId}"\n`, 'utf8');
    log(`Pages 项目已配置: ${options.projectName}`);
    const output = await runWrangler(['pages', 'deploy', tmpDir, '--project-name', options.projectName, '--branch', 'main', '--commit-dirty', 'true', '--no-bundle'], credentials, options.accountId, tmpDir);
    output.trim().split('\n').filter(Boolean).forEach(line => log(`wrangler: ${line}`));
    log('Pages 部署上传完成');
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

export async function syncPagesCode(credentials, options, log) {
  const tmpDir = await mkdtemp(join(tmpdir(), 'deploy-panel-pages-update-'));
  try {
    const code = await fetchSourceCode(options.sourceMode);
    await writeFile(join(tmpDir, '_worker.js'), code, 'utf8');
    const output = await runWrangler(['pages', 'deploy', tmpDir, '--project-name', options.projectName, '--branch', 'main', '--commit-dirty', 'true', '--no-bundle'], credentials, options.accountId, tmpDir);
    output.trim().split('\n').filter(Boolean).forEach(line => log(`wrangler: ${line}`));
    log('Pages 代码同步完成');
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

export async function createOrUpdatePagesProject(credentials, options, log) {
  let project = null;
  try {
    project = await callCfApi(credentials, `/accounts/${options.accountId}/pages/projects/${encodeURIComponent(options.projectName)}`);
  } catch (err) {
    if (!String(err.message).includes('404')) throw err;
  }
  const config = {
    compatibility_date: COMPAT_DATE,
    env_vars: { u: { type: 'plain_text', value: options.uuid } },
    kv_namespaces: { [BINDING_NAME]: { namespace_id: options.kvId } }
  };
  if (!project) {
    project = await callCfApi(credentials, `/accounts/${options.accountId}/pages/projects`, {
      method: 'POST',
      body: { name: options.projectName, production_branch: 'main', deployment_configs: { production: config, preview: config } }
    });
    log('Pages 项目已创建');
    return project;
  }
  await callCfApi(credentials, `/accounts/${options.accountId}/pages/projects/${encodeURIComponent(options.projectName)}`, {
    method: 'PATCH',
    body: { deployment_configs: { production: config, preview: config } }
  });
  log('Pages 项目配置已更新');
  return project;
}

export async function bindDomain(credentials, options, log) {
  if (options.deployType === 'pages') {
    const res = await callCfApi(credentials, `/accounts/${options.accountId}/pages/projects/${encodeURIComponent(options.projectName)}/domains`, {
      method: 'POST',
      body: { name: options.hostname }
    });
    log(`Pages 域名已绑定: ${options.hostname}`);
    try {
      await callCfApi(credentials, `/zones/${options.zoneId}/dns_records`, {
        method: 'POST',
        body: { type: 'CNAME', name: options.hostname, content: `${options.projectName}.pages.dev`, proxied: true }
      });
      log(`CNAME 记录已创建: ${options.hostname}`);
    } catch (dnsErr) {
      log(`CNAME 跳过: ${dnsErr.message}`);
    }
    return { hostname: res.name || options.hostname, type: 'pages' };
  }
  try {
    const res = await callCfApi(credentials, `/accounts/${options.accountId}/workers/domains`, {
      method: 'PUT',
      body: { environment: 'production', hostname: options.hostname, service: options.projectName, zone_id: options.zoneId }
    });
    log(`Worker 域名已绑定: ${options.hostname}`);
    return { hostname: res.hostname || options.hostname, type: 'worker' };
  } catch (err) {
    await callCfApi(credentials, `/zones/${options.zoneId}/workers/routes`, {
      method: 'POST',
      body: { pattern: `${options.hostname}/*`, script: options.projectName }
    });
    log(`Worker Route 已绑定: ${options.hostname}/*`);
    return { hostname: options.hostname, type: 'route', warning: err.message };
  }
}

export async function listDomains(credentials, options, log) {
  try {
    if (options.deployType === 'pages') {
      const list = await callCfApi(credentials, `/accounts/${options.accountId}/pages/projects/${encodeURIComponent(options.projectName)}/domains`);
      return list.map(item => ({ hostname: item.name || item.hostname, status: item.status || '' }));
    }
    const list = await callCfApi(credentials, `/accounts/${options.accountId}/workers/domains?per_page=100`);
    return list.filter(item => item.service === options.projectName || item.script === options.projectName)
      .map(item => ({ hostname: item.hostname || item.domain, status: item.status || '' }));
  } catch (err) {
    log(`域名读取失败: ${err.message}`);
    return [];
  }
}

export async function enableWorkersDev(credentials, accountId, scriptName) {
  const path = `/accounts/${accountId}/workers/scripts/${encodeURIComponent(scriptName)}/subdomain`;
  try {
    await callCfApi(credentials, path, { method: 'POST', body: { enabled: true } });
  } catch {
    await callCfApi(credentials, path, { method: 'PUT', body: { enabled: true } });
  }
}
