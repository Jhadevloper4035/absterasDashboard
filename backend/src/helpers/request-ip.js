export function cleanIpAddress(value = '') {
  const raw = String(value).split(',')[0].trim();
  if (raw === '::1') return '127.0.0.1';
  return raw.match(/(?:\d{1,3}\.){3}\d{1,3}/)?.[0] || raw;
}

export function requestIp(req) {
  return cleanIpAddress(req.get('cf-connecting-ip') || req.get('x-real-ip') || req.ips?.[0] || req.ip);
}
