// ZUNO — servidor local + proxy para as APIs da NASA (OSDR e LRO/LOLA via Moon Trek)
// Uso: node server.js   →   http://localhost:5173
// Sem dependências (Node 18+). Respostas da NASA ficam em ./cache para funcionar offline.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 5173;
const PUB = path.join(__dirname, 'public');
// pasta de cache; se o disco for somente leitura (alguns serviços de hospedagem), usa a pasta temporária
let CACHE = path.join(__dirname, 'cache');
try { fs.mkdirSync(CACHE, { recursive: true }); }
catch (e) { CACHE = path.join(require('os').tmpdir(), 'zuno-cache'); fs.mkdirSync(CACHE, { recursive: true }); }

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.webm': 'video/webm', '.webmanifest': 'application/manifest+json'
};

// Camadas LRO disponíveis no NASA Moon Trek (WMTS)
const LRO_LAYERS = {
  shade: 'LRO_LOLA_ClrShade_Global_128ppd_v04', // relevo colorido sombreado (LOLA)
  dem: 'LRO_LOLA_DEM_Global_128ppd_v04'         // modelo digital de elevação (LOLA)
};

async function fetchCached(key, url) {
  const file = path.join(CACHE, key);
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    try { fs.writeFileSync(file, buf); } catch (e) { /* sem cache em disco: segue sem guardar */ }
    return { buf, src: 'live' };
  } catch (e) {
    if (fs.existsSync(file)) return { buf: fs.readFileSync(file), src: 'cache' };
    throw e;
  }
}

// OSD-895: baixar e ler o ZIP ISA é caro, então guarda o resultado já extraído e só refaz a cada 24 h.
// Se a NASA falhar, entrega a última cópia guardada (com a data de quando foi obtida).
const { fetchOSD895 } = require('./lib/osd895');
const OSD895_TTL = 24 * 3600 * 1000;
let osd895Mem = null, osd895Pending = null;
async function getOSD895() {
  const file = path.join(CACHE, 'osd895.json');
  if (!osd895Mem && fs.existsSync(file)) { try { osd895Mem = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { /* cache corrompido */ } }
  const age = osd895Mem ? Date.now() - Date.parse(osd895Mem.source.fetchedAt) : Infinity;
  if (osd895Mem && age < OSD895_TTL) return { data: osd895Mem, src: 'cache' };
  try {
    osd895Pending = osd895Pending || fetchOSD895();
    osd895Mem = await osd895Pending;
    try { fs.writeFileSync(file, JSON.stringify(osd895Mem)); } catch (e) { /* sem cache em disco */ }
    return { data: osd895Mem, src: 'live' };
  } catch (e) {
    if (osd895Mem) return { data: osd895Mem, src: 'cache' };
    throw e;
  } finally { osd895Pending = null; }
}

function send(res, code, body, type, extra = {}) {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-cache', ...extra });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = decodeURIComponent(url.pathname);

  try {
    // NASA OSDR OSD-895 — medições de crescimento extraídas do ZIP ISA
    if (p === '/api/osd895') {
      const { data, src } = await getOSD895();
      return send(res, 200, JSON.stringify(data), 'application/json; charset=utf-8', { 'X-Data-Source': src });
    }
    // NASA OSDR — metadados de estudo (ex.: /api/osdr/895)
    let m = p.match(/^\/api\/osdr\/(\d{1,5})$/);
    if (m) {
      const { buf, src } = await fetchCached(`osdr-${m[1]}.json`, `https://osdr.nasa.gov/osdr/data/osd/meta/${m[1]}`);
      return send(res, 200, buf, 'application/json', { 'X-Data-Source': src });
    }
    // LRO / LOLA — tiles do Moon Trek (ex.: /api/lro/dem/5/14/28)
    m = p.match(/^\/api\/lro\/(shade|dem)\/(\d{1,2})\/(\d{1,3})\/(\d{1,3})$/);
    if (m) {
      const [, layer, z, row, col] = m;
      const tileUrl = `https://trek.nasa.gov/tiles/Moon/EQ/${LRO_LAYERS[layer]}/1.0.0/default/default028mm/${z}/${row}/${col}.png`;
      const { buf, src } = await fetchCached(`lro-${layer}-${z}-${row}-${col}.png`, tileUrl);
      return send(res, 200, buf, 'image/png', { 'X-Data-Source': src });
    }
    if (p.startsWith('/api/')) return send(res, 404, '{"error":"not found"}', 'application/json');

    // Arquivos estáticos
    const file = path.normalize(path.join(PUB, p === '/' ? 'index.html' : p));
    if (!file.startsWith(PUB)) return send(res, 403, 'Forbidden', 'text/plain');
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) return send(res, 404, 'Not found', 'text/plain');
      const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
      // suporte a Range (necessário para o vídeo poder avançar/voltar e tocar direito)
      const range = req.headers.range && req.headers.range.match(/bytes=(\d*)-(\d*)/);
      if (range) {
        const start = range[1] ? +range[1] : Math.max(0, st.size - +range[2]);
        const end = range[1] && range[2] ? Math.min(+range[2], st.size - 1) : st.size - 1;
        if (start >= st.size || start > end) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
        res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
        return fs.createReadStream(file, { start, end }).pipe(res);
      }
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' });
      fs.createReadStream(file).pipe(res);
    });
  } catch (e) {
    send(res, 502, JSON.stringify({ error: String(e.message || e) }), 'application/json');
  }
});

server.listen(PORT, () => {
  console.log(`\n  🚀 ZUNO rodando em  http://localhost:${PORT}\n`);
});
