// Emulates just enough of the Upstash REST API to exercise the handler
// locally, since this sandbox can't reach upstash.io.
const store = new Map(); // key -> {type:'str'|'hash'|'zset', v}

function run(args) {
  const op = String(args[0]).toUpperCase();
  const key = args[1];
  switch (op) {
    case 'PING':
      return 'PONG';
    case 'GET': {
      const e = store.get(key);
      return e && e.type === 'str' ? e.v : null;
    }
    case 'SET': {
      const nx = args.some((a) => String(a).toUpperCase() === 'NX');
      if (nx && store.has(key)) return null;
      store.set(key, { type: 'str', v: String(args[2]) });
      return 'OK';
    }
    case 'EXPIRE':
      return store.has(key) ? 1 : 0;
    case 'HSET': {
      const e = store.get(key) || { type: 'hash', v: new Map() };
      e.v.set(String(args[2]), String(args[3]));
      store.set(key, e);
      return 1;
    }
    case 'HSETNX': {
      const e = store.get(key) || { type: 'hash', v: new Map() };
      if (e.v.has(String(args[2]))) return 0;
      e.v.set(String(args[2]), String(args[3]));
      store.set(key, e);
      return 1;
    }
    case 'HGETALL': {
      const e = store.get(key);
      if (!e || e.type !== 'hash') return [];
      const out = [];
      for (const [f, v] of e.v) out.push(f, v);
      return out;
    }
    case 'HLEN': {
      const e = store.get(key);
      return e && e.type === 'hash' ? e.v.size : 0;
    }
    case 'ZINCRBY': {
      const e = store.get(key) || { type: 'zset', v: new Map() };
      const member = String(args[3]);
      const next = (e.v.get(member) || 0) + Number(args[2]);
      e.v.set(member, next);
      store.set(key, e);
      return String(next);
    }
    case 'ZRANGE': {
      const e = store.get(key);
      if (!e || e.type !== 'zset') return [];
      const rev = args.some((a) => String(a).toUpperCase() === 'REV');
      const withScores = args.some((a) => String(a).toUpperCase() === 'WITHSCORES');
      const rows = [...e.v.entries()].sort((a, b) => (rev ? b[1] - a[1] : a[1] - b[1]));
      const out = [];
      for (const [m, s] of rows) {
        out.push(m);
        if (withScores) out.push(String(s));
      }
      return out;
    }
    default:
      throw new Error('fake-redis: unsupported command ' + op);
  }
}

function install(baseUrl) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (!u.startsWith(baseUrl)) return realFetch(url, init);
    const body = JSON.parse(init.body);
    const isPipeline = u.endsWith('/pipeline');
    const respond = (payload) => ({
      ok: true,
      status: 200,
      json: async () => payload,
    });
    try {
      if (isPipeline) return respond(body.map((c) => ({ result: run(c) })));
      return respond({ result: run(body) });
    } catch (err) {
      return respond(isPipeline ? [{ error: String(err.message) }] : { error: String(err.message) });
    }
  };
}

module.exports = { install, store };
