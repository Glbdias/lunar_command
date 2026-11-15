// Vercel Function — dados do OSD-895 já extraídos do ZIP ISA (ver lib/osd895.js).
// A CDN do Vercel guarda a resposta por 1 dia; enquanto revalida, entrega a versão anterior.
const { fetchOSD895 } = require('../lib/osd895');

module.exports = async (req, res) => {
  try {
    const data = await fetchOSD895();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Data-Source', 'live');
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).send(JSON.stringify(data));
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: String(e.message || e) });
  }
};
