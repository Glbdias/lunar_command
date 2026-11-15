// Vercel Function — proxy da NASA OSDR (metadados de estudos).
// A OSDR só libera CORS para o próprio domínio, então o navegador não consegue chamar direto.
// Acessada como /api/osdr/895 (ver rewrites no vercel.json).
module.exports = async (req, res) => {
  const id = String((req.query && req.query.id) || '');
  if (!/^\d{1,5}$/.test(id)) return res.status(400).json({ error: 'id inválido' });
  try {
    const r = await fetch(`https://osdr.nasa.gov/osdr/data/osd/meta/${id}`, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) return res.status(502).json({ error: 'OSDR HTTP ' + r.status });
    const body = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Data-Source', 'live');
    // a CDN do Vercel guarda por 1 dia (substitui a pasta cache/ do server.js)
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).send(body);
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
};
