import postgres from 'postgres';

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 健康检查
  if (path === '/' && req.method === 'GET') {
    return res.status(200).json({ status: 'ok' });
  }

  const sql = postgres(process.env.DATABASE_URL);

  try {
    // 认证
    const key = url.searchParams.get('key') || req.headers.authorization?.replace('Bearer ', '');
    if (key !== process.env.API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // POST /events - 记录事件
    if (path === '/events' && req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { type, value } = body;
      if (!type || typeof type !== 'string') {
        return res.status(400).json({ error: "Missing or invalid 'type'" });
      }
      const now = new Date().toISOString();
      await sql`INSERT INTO events (type, value, ts) VALUES (${type}, ${value || null}, ${now})`;
      return res.status(200).json({ ok: true });
    }

    // GET /events - 查询事件
    if (path === '/events' && req.method === 'GET') {
      const type = url.searchParams.get('type');
      const hours = url.searchParams.get('hours');
      const limit = url.searchParams.get('limit') || '100';

      let query = sql`SELECT * FROM events`;
      const conditions = [];

      if (type) conditions.push(sql`type = ${type}`);
      if (hours) {
        const since = new Date(Date.now() - Number(hours) * 3600000).toISOString();
        conditions.push(sql`ts >= ${since}`);
      }

      if (conditions.length > 0) {
        query = sql`SELECT * FROM events WHERE ${sql.join(conditions, ' AND ')}`;
      }

      query = sql`${query} ORDER BY ts DESC LIMIT ${Number(limit)}`;
      const rows = await query;
      return res.status(200).json(rows);
    }

    // DELETE /events - 删除旧事件
    if (path === '/events' && req.method === 'DELETE') {
      const days = Number(url.searchParams.get('days'));
      if (!days || days < 1) {
        return res.status(400).json({ error: "Missing or invalid 'days' parameter" });
      }
      const cutoff = new Date(Date.now() - days * 86400000).toISOString();
      const result = await sql`DELETE FROM events WHERE ts < ${cutoff}`;
      return res.status(200).json({ ok: true, deleted: result.count });
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Internal error' });
  } finally {
    await sql.end();
  }
}
