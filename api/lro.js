// Vercel Function — proxy dos tiles LRO/LOLA do NASA Moon Trek (topografia lunar).
// Acessada como /api/lro/dem/5/14/28 (ver rewrites no vercel.json).
const LAYERS = {
  shade: 'LRO_LOLA_ClrShade_Global_128ppd_v04', // relevo colorido sombreado
  dem: 'LRO_LOLA_DEM_Global_128ppd_v04'         // modelo digital de elevação
};
module.exports = async (req, res) => {
  const q = req.query || {};
  const layer = String(q.layer || ''), z = String(q.z || ''), row = String(q.row || ''), col = String(q.col || '');
  if (!LAYERS[layer] || !/^\d{1,2}$/.test(z) || !/^\d{1,3}$/.test(row) || !/^\d{1,3}$/.test(col)) {
    return res.status(400).json({ error: 'parâmetros inválidos' });
  }
  const url = `https://trek.nasa.gov/tiles/Moon/EQ/${LAYERS[layer]}/1.0.0/default/default028mm/${z}/${row}/${col}.png`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) return res.status(502).json({ error: 'Moon Trek HTTP ' + r.status });
    const body = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('X-Data-Source', 'live');
    res.setHeader('Cache-Control', 'public, s-maxage=604800, stale-while-revalidate=2592000');
    return res.status(200).send(body);
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
};
