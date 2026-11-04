// Basit API istemcisi (testler için)
export function client(base = 'http://localhost:8790') {
  let cookie = '';
  const call = async (method, path, body) => {
    const r = await fetch(base + '/api' + path, { method, headers: { 'content-type': 'application/json', 'x-pm': '1', cookie }, body: body ? JSON.stringify(body) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    const t = await r.text(); let d; try { d = JSON.parse(t); } catch { d = t; }
    if (!r.ok) throw new Error(method + ' ' + path + ' ' + r.status + ' ' + JSON.stringify(d));
    return d;
  };
  return { get: p => call('GET', p), post: (p, b) => call('POST', p, b), put: (p, b) => call('PUT', p, b), del: p => call('DELETE', p) };
}
