const baseUrl = (process.env.CRM_BASE_URL || 'http://127.0.0.1:4000').replace(/\/+$/, '');

async function readJson(path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path} failed with ${response.status}: ${body.error?.message || body.message || 'request failed'}`);
  return body;
}

await readJson('/health');

if (process.env.CRM_SMOKE_EMAIL && process.env.CRM_SMOKE_PASSWORD) {
  const login = await readJson('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.CRM_SMOKE_EMAIL, password: process.env.CRM_SMOKE_PASSWORD }),
  });
  const token = login.data?.token || login.data?.accessToken || login.token || login.accessToken;
  if (!token) throw new Error('Login succeeded but no access token was returned');
  await readJson('/api/dashboard/summary', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

console.log('CRM smoke check passed');
