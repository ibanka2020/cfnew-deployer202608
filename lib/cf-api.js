export function isGlobalApiKey(credentials) {
  const key = String(credentials?.key || '').trim();
  const email = String(credentials?.email || '').trim();
  return /^[a-f0-9]{37}$/i.test(key) && Boolean(email);
}

export function getAuthHeaders(credentials) {
  const key = String(credentials?.key || '').trim();
  const email = String(credentials?.email || '').trim();
  if (isGlobalApiKey(credentials)) {
    return {
      'X-Auth-Email': email,
      'X-Auth-Key': key
    };
  }
  const token = key.startsWith('Bearer ') ? key.slice(7) : key;
  return {
    'Authorization': `Bearer ${token}`
  };
}

export async function callCfApi(credentials, path, options = {}) {
  const resData = await callCfApiRaw(credentials, path, options);
  if (resData && typeof resData === 'object' && 'success' in resData) {
    if (!resData.success) {
      const msg = (resData.errors || []).map(err => err.message || JSON.stringify(err)).join('; ') || 'Cloudflare API 请求失败';
      const err = new Error(msg);
      err.response = resData;
      throw err;
    }
    return resData.result;
  }
  return resData;
}

export async function callCfApiRaw(credentials, path, options = {}) {
  const baseUrl = 'https://api.cloudflare.com/client/v4';
  const url = path.startsWith('http') ? path : `${baseUrl}${path}`;
  const headers = {
    ...getAuthHeaders(credentials),
    ...(options.headers || {})
  };
  let body = options.body;
  if (body && !(body instanceof FormData) && typeof body !== 'string') {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    body = JSON.stringify(body);
  }
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body
  });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const msg = typeof data === 'string'
      ? data
      : (data.errors || []).map(err => err.message || JSON.stringify(err)).join('; ');
    throw new Error(`${response.status} ${response.statusText}${msg ? ` - ${msg}` : ''}`);
  }
  return data;
}
