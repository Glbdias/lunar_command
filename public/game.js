// ZUNO — lógica do jogo. Fundo de cada tela = arte original (assets/bg_*.webp);
// tudo que muda durante o jogo é desenhado por cima, em coordenadas de 330×540.
'use strict';

/* ================= utilidades ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const strip = s => String(s).replace(/<[^>]+>/g, '');
const today = () => new Date().toLocaleDateString('sv-SE');
const wait = ms => new Promise(r => setTimeout(r, ms));
const IS_FILE = location.protocol === 'file:';
const A = n => `assets/${n}`;
const pos = ([x, y, w, h]) => `left:${x}px;top:${y}px;width:${w}px;height:${h}px`;

/* ================= idioma (padrão: português; opção: inglês) ================= */
// Fica fora do save: trocar de idioma ou começar um jogo novo não mexe na escolha.
const LANG_KEY = 'zuno-lang';
let LANG = 'pt';
try { if (localStorage.getItem(LANG_KEY) === 'en') LANG = 'en'; } catch (e) { /* sem storage */ }
const EN = () => LANG === 'en';
const tr = (pt, en) => (EN() ? en : pt);
const LOC = () => (EN() ? 'en-US' : 'pt-BR');
document.documentElement.lang = LOC();
function setLang(l) {
  LANG = l === 'en' ? 'en' : 'pt';
  try { localStorage.setItem(LANG_KEY, LANG); } catch (e) { /* sem storage */ }
  document.documentElement.lang = LOC();
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  clearRobot(); // o balão do robô estava no idioma anterior
  buildCrops(); render();
}
// Arte em inglês: versões *_en das imagens, com o texto em português apagado (preenchido com as cores
// em volta). O texto em inglês é escrito por cima, em HTML (ART_LABELS), na mesma fonte do jogo.
const ART_EN = new Set(['bg_home.webp', 'bg_farm.webp', 'bg_explore.webp', 'bg_sleep.webp', 'bg_pipes.webp', 'bg_wires.webp',
  'modal_upg.webp', 'pop_harvest.webp', 'pop_search.webp', 'btn_colher.png', 'btn_melhorar.png', 'badge_maximo.png']);
const AL = n => (EN() && ART_EN.has(n) ? n.replace(/(\.\w+)$/, '_en$1') : n);
// [centro x, centro y, texto, tamanho da fonte, classe extra, largura] em coordenadas da arte
const HUD_EN = (y, f = 12.5, x = [67, 176, 284]) => [[x[0], y, 'ENERGY', f], [x[1], y, 'OXYGEN', f], [x[2], y, 'SCRAP', f]];
const NAV_EN = (y, f = 12) => [[46, y, 'FEED', f], [125, y, 'EXPLORE', f], [204, y, 'UPGRADES', f], [281, y, 'SLEEP', f]];
const ART_LABELS = {
  home: [...HUD_EN(30), ...NAV_EN(511)],
  farm: [...HUD_EN(24, 12.5, [66, 175, 281]), [166, 107, 'FARM', 25], ...NAV_EN(512)],
  explore: [...HUD_EN(22, 10.5, [71, 172, 270]), [180, 75, 'EXPLORATION', 19],
    [164, 113, 'Explore the Moon and collect scrap to upgrade your base!', 10.5, 't', 150], ...NAV_EN(505, 11.5)],
  sleep: [...HUD_EN(35, 12, [75, 176, 282]), [164, 122, 'SLEEP', 24], [164, 359, 'Resting restores your energy and gets you ready for more!', 12, 't', 205],
    [188, 411, 'SLEEP', 21], ...NAV_EN(501, 11.5)],
  pipes: [...HUD_EN(23, 12, [69, 176, 287]), [173, 95, 'PIPES<br>MINIGAME', 16.5], [164, 149, 'Connect the pipes and bring the water to the reservoir!', 11.5, 't', 215],
    [184, 486, 'Tap the pipes to turn them!', 13.5, 't', 200]],
  wires: [...HUD_EN(23, 11.5, [74, 176, 274]), [187, 87, 'ROCKET<br>REPAIR', 16.5], [157, 135, 'Connect the wires with the same symbol to restart the rocket!', 12, 't', 215],
    [232, 488, 'Sort the wires and connect each pair of matching symbols!', 11.5, 't dk', 145]],
  memory: [...HUD_EN(23, 11.5, [74, 176, 274]), [187, 87, 'ROCKET<br>REPAIR', 16.5]] // legenda e balão já são do jogo da memória
};
const LOCK_EN = [[102, 398], [223, 398]]; // "PLANTAÇÃO BLOQUEADA" das cúpulas de baixo
const artLabel = ([x, y, txt, f, cls = '', w]) => `<div class="al ${cls}" style="left:${x}px;top:${y}px;font-size:${f}px${w ? `;width:${w}px` : ''}">${txt}</div>`;
function artLabels(screen) {
  if (!EN()) return '';
  let h = (ART_LABELS[screen] || []).map(artLabel).join('');
  if (screen === 'farm') h += LOCK_EN.map(([x, y]) => artLabel([x, y, 'FARM<br>LOCKED', 11.5])).join('');
  return h;
}
// botão que troca o idioma: mostra o idioma para o qual vai trocar
const langBtn = (style = '') => `<button class="chip lang-btn" data-lang="${EN() ? 'pt' : 'en'}" style="${style}" aria-label="${tr('Idioma', 'Language')}">🌐 ${EN() ? 'Português' : 'English'}</button>`;
document.addEventListener('click', e => { const b = e.target.closest('[data-lang]'); if (b) { e.stopPropagation(); setLang(b.dataset.lang); } }, true);

/* ================= narração ================= */
function speak(text) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const clean = strip(text).replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, '').replace(/\s+/g, ' ').trim();
  if (!clean) return;
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = LOC();
  const vs = speechSynthesis.getVoices(), exact = EN() ? /en[-_]US/i : /pt[-_]BR/i, near = EN() ? /^en/i : /^pt/i;
  const v = vs.find(v => exact.test(v.lang)) || vs.find(v => near.test(v.lang));
  if (v) u.voice = v;
  u.pitch = 1.1;
  speechSynthesis.speak(u);
}
const sayBtn = t => `<button class="say" data-say="${esc(strip(t))}" aria-label="${tr('Ouvir', 'Listen')}">🔊</button>`;
document.addEventListener('click', e => { const b = e.target.closest('[data-say]'); if (b) { e.stopPropagation(); speak(b.dataset.say); } }, true);

/* ================= dificuldade ================= */
const DIFFS = [
  { get name() { return tr('Iniciante', 'Beginner'); }, cost: .7, drainSec: 75, grow: .75, move: .75, time: 1.4, sleep: 1.2 },
  { get name() { return tr('Intermediário', 'Intermediate'); }, cost: 1, drainSec: 50, grow: 1, move: 1, time: 1, sleep: 1 },
  { get name() { return tr('Avançado', 'Advanced'); }, cost: 1.3, drainSec: 32, grow: 1.2, move: 1.25, time: .8, sleep: .8 }
];
const ageToDiff = a => a <= 8 ? 0 : a <= 10 ? 1 : 2;
const D = () => DIFFS[S.diff];

/* ================= estado ================= */
const SAVE_KEY = 'zuno-save-v2';
function newState() {
  return {
    v: 2, phase: 'intro', age: null, diff: 1, day: 1,
    elixir: 70, o2: 100, scrap: 5, water: 4,
    baseLvl: 1, farmLvl: 1, rocket: 0,
    plots: [0, 1, 2, 3].map(() => ({ crop: null, left: 0, total: 0, harvests: 0 })),
    site: 'copernicus', dep: {}, trip: null, fedToday: false, tips: {},
    stats: { explored: 0, harvested: 0, scrapTotal: 0 },
    parental: { limitMin: 0, usedSec: 0, date: today() }, voice: true, drainAcc: 0
  };
}
let S;
function load() {
  try { const j = JSON.parse(localStorage.getItem(SAVE_KEY)); if (j && j.v === 2) { S = Object.assign(newState(), j); return; } } catch (e) { /* sem storage */ }
  S = newState();
}
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }

/* ================= regras de base ================= */
const O2_CAP = [100, 120, 140, 160, 180];
const o2Max = () => O2_CAP[S.baseLvl - 1];
const slotsOpen = () => [2, 3, 4, 4][S.farmLvl - 1];

const UPG = {
  base: { max: 5, costs: [{ e: 20, o: 40, s: 10 }, { e: 25, o: 50, s: 15 }, { e: 30, o: 60, s: 22 }, { e: 35, o: 70, s: 30 }] },
  farm: { max: 4, costs: [{ e: 20, s: 8 }, { e: 30, s: 16 }, { e: 40, s: 25 }] }
};
const ROCKET = [
  { get name() { return tr('Tanque de combustível', 'Fuel tank'); }, game: 'pipes', n: 5, e: 30, o: 40, s: 12 },
  { get name() { return tr('Fiação do painel', 'Panel wiring'); }, game: 'wires', n: 4, e: 40, o: 60, s: 20 },
  { get name() { return tr('Equipamentos de bordo', 'On-board equipment'); }, game: 'memory', n: 6, e: 50, o: 80, s: 28 },
  { get name() { return tr('Computador de bordo', 'Flight computer'); }, game: 'wires', n: 5, e: 55, o: 110, s: 36 },
  { get name() { return tr('Motor principal', 'Main engine'); }, game: 'pipes', n: 6, e: 60, o: 130, s: 45 }
];
const scaled = c => ({ e: Math.ceil((c.e || 0) * D().cost), o: Math.ceil((c.o || 0) * D().cost), s: Math.ceil((c.s || 0) * D().cost) });
const canPay = c => S.elixir >= c.e && S.o2 >= c.o && S.scrap >= c.s;
const pay = c => { S.elixir -= c.e; S.o2 -= c.o; S.scrap -= c.s; };

/* ================= NASA OSDR (plantação) ================= */
// Duas coisas separadas de propósito:
//  • CIÊNCIA (NASA OSDR OSD-895): o que aconteceu na estufa EDEN ISS, na Antártida (Terra).
//    Vem de /api/osd895 (ZIP ISA lido no servidor, com cache) — nada de número fixo aqui.
//  • JOGO (balanceamento): dias de jogo, água e energia. São escolhas de jogabilidade, NÃO medições.
const NASA = { osdr: { status: 'load', records: [], source: null }, lro: { status: 'load' } };
const OSD895_LS = 'zuno-osd895';

async function loadOSDR() {
  try {
    const r = await fetch('/api/osd895');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    if (!Array.isArray(data.records) || !data.records.length) throw new Error('sem registros');
    NASA.osdr = { status: r.headers.get('X-Data-Source') === 'cache' ? 'cache' : 'live', records: data.records, source: data.source };
    try { localStorage.setItem(OSD895_LS, JSON.stringify(data)); } catch (e) { /* sem storage */ }
  } catch (e) {
    // falha de rede: usa a última cópia baixada neste aparelho (com data e origem); se não houver, fica sem dados
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(OSD895_LS)); } catch (er) { /* ignore */ }
    NASA.osdr = saved && saved.records ? { status: 'cache', records: saved.records, source: saved.source } : { status: 'off', records: [], source: null };
    console.warn('OSD-895 indisponível:', e);
  }
  buildCrops();
  if (current === 'farm') render();
}

// Balanceamento do jogo (independente da ciência). Valores iguais aos que o jogo já usava.
const GAME = {
  alface: { days: 3, water: 2, elixir: 30 },
  pepino: { days: 6, water: 3, elixir: 33, harvests: 3 },
  rabanete: { days: 2, water: 1, elixir: 13 }
};
// Qual registro do OSD-895 representa cada alimento do jogo (Sample Name exato do estudo)
const CROP_SAMPLE = {
  alface: 'Lactuca_sativa_Lettuce_Waldmanns_Green',
  pepino: 'Cucumis_sativus_FruitCrop_Cucumber_Picowell',
  rabanete: 'Raphanus_sativus_sativus_TuberCrop_Radish_Raxe'
};
let CROPS = {};
function buildCrops() {
  const rec = k => NASA.osdr.records.find(r => r.sampleName === CROP_SAMPLE[k]) || null;
  // em inglês: noun = nome em minúsculas; plant = "The lettuce plant" (a gramática é montada em kidText)
  CROPS = {
    alface: { name: tr('Alface', 'Lettuce'), sci: 'Lactuca sativa', variety: 'Waldmanns Green', art: 'A', noun: tr('alface', 'lettuce'), ready: 'pronta', plant: tr('O pé de alface', 'The lettuce plant'),
      img: 'plant_alface.png', icon: `<img src="${A('veg_alface.png')}" alt="">`, sci895: rec('alface') },
    pepino: { name: tr('Pepino', 'Cucumber'), sci: 'Cucumis sativus', variety: 'Picowell', art: 'O', noun: tr('pepino', 'cucumber'), ready: 'pronto', plant: tr('O pé de pepino', 'The cucumber plant'),
      img: 'plant_pepino.png', icon: `<img src="${A('ic_pepino.png')}" alt="">`, sci895: rec('pepino') },
    rabanete: { name: tr('Rabanete', 'Radish'), sci: 'Raphanus sativus', variety: 'Raxe', art: 'O', noun: tr('rabanete', 'radish'), ready: 'pronto', plant: tr('O pé de rabanete', 'The radish plant'),
      svg: true, icon: ART.rabanete(), sci895: rec('rabanete') }
  };
  Object.keys(CROPS).forEach(k => { CROPS[k].regrow = !!GAME[k].harvests; CROPS[k].harvests = GAME[k].harvests || 1; });
}

/* ---- textos para crianças a partir do OSD-895 (arredonda só na hora de mostrar) ---- */
const noData = () => tr('Ainda não temos esse dado.', 'We don’t have this data yet.');
const AREAS = [1, 2, 3];                          // lado do canteiro em metros (1×1, 2×2, 3×3)
const areaSide = () => (AREAS.includes(S.areaSide) ? S.areaSide : 1);
const fmtKg = v => (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10).toLocaleString(LOC());
const fmtDays = v => Math.round(v).toLocaleString(LOC());
const metros = n => `${n} ${n === 1 ? tr('metro', 'meter') : tr('metros', 'meters')}`;
// produção estimada (kg) = produção média observada (kg/m²) × área (m²); valida área e unidade
function estimateKg(rec, areaM2) {
  const m = rec && rec.meanEdibleFreshweight;
  if (!m || m.value == null || m.unit !== 'kilogram per square meter') return null;
  if (!(areaM2 > 0) || !Number.isFinite(areaM2)) return null;
  const r = rec.edibleFreshweightRange || {};
  return { kg: m.value * areaM2, min: r.min != null ? r.min * areaM2 : null, max: r.max != null ? r.max * areaM2 : null };
}
// Frase principal: curta, sem "biomassa", "produtividade", "kg/m²" ou "ciclo avaliado"
function kidText(k, short) {
  const c = CROPS[k], rec = c && c.sci895, ND = noData();
  if (!rec) return ND;
  const side = areaSide(), est = estimateKg(rec, side * side);
  const age = rec.age && rec.age.value != null && rec.age.unit === 'day' ? rec.age.value : null;
  let t;
  if (rec.harvestType === 'spread') {
    // colheitas repetidas: a idade é a duração total do cultivo, não o tempo até a 1ª colheita
    t = age != null
      ? tr(`${c.plant} cresceu por <b>${fmtDays(age)} dias</b> e deu frutos várias vezes. O estudo não diz quando apareceu o primeiro ${c.noun}.`,
        `${c.plant} grew for <b>${fmtDays(age)} days</b> and gave fruit many times. The study does not say when the first ${c.noun} appeared.`)
      : tr(`${c.plant} deu frutos várias vezes. ${ND}`, `${c.plant} gave fruit many times. ${ND}`);
  } else {
    t = age != null
      ? tr(`${c.art} ${c.noun} ficou ${c.ready} para colher em cerca de <b>${fmtDays(age)} dias</b>.`,
        `The ${c.noun} was ready to harvest in about <b>${fmtDays(age)} days</b>.`)
      : tr(`Quanto tempo ${c.art === 'A' ? 'a' : 'o'} ${c.noun} levou? ${ND}`, `How long did the ${c.noun} take? ${ND}`);
  }
  if (short && rec.harvestType === 'spread') return t; // versão curta (balão da colheita)
  if (!est) return t + tr(` Quanto foi colhido? ${ND}`, ` How much was harvested? ${ND}`);
  return side === 1
    ? t + tr(` Em um espaço de 1 metro por 1 metro, foram colhidos cerca de <b>${fmtKg(est.kg)} kg</b>.`,
      ` In a space of 1 meter by 1 meter, about <b>${fmtKg(est.kg)} kg</b> were harvested.`)
    : t + tr(` Num espaço de ${metros(side)} por ${metros(side)}, a colheita estimada é de cerca de <b>${fmtKg(est.kg)} kg</b>.`,
      ` In a space of ${metros(side)} by ${metros(side)}, the estimated harvest is about <b>${fmtKg(est.kg)} kg</b>.`);
}
const sourceLine = () => tr('Fonte: NASA OSDR OSD-895 · estufa na Antártida (Terra)', 'Source: NASA OSDR OSD-895 · greenhouse in Antarctica (Earth)');

// ---- regras de jogo (só balanceamento; não são medições da planta) ----
const gameDays = c => Math.max(1, Math.ceil(GAME[c].days * D().grow) - (S.farmLvl >= 4 ? 1 : 0));
const regrowDays = () => Math.max(1, Math.round(2 * D().grow));
const elixirValue = c => Math.round(GAME[c].elixir * (1 + .1 * (S.farmLvl - 1)));
const waterNeed = c => Math.max(1, GAME[c].water - (S.farmLvl - 1));

/* ================= LRO / LOLA (topografia) ================= */
const SITES = {
  copernicus: { get name() { return tr('Cratera Copérnico', 'Copernicus Crater'); }, get short() { return tr('Copérnico', 'Copernicus'); }, z: 5, row: 14, col: 28, base: [3, 1],
    get lat() { return tr('5,6°N–11,3°N', '5.6°N–11.3°N'); }, get lon() { return tr('16,9°O–22,5°O', '16.9°W–22.5°W'); } },
  framauro: { name: 'Fra Mauro (Apollo 14)', short: 'Fra Mauro', z: 5, row: 16, col: 28, base: [2, 3],
    get lat() { return tr('0°–5,6°S', '0°–5.6°S'); }, get lon() { return tr('16,9°O–22,5°O', '16.9°W–22.5°W'); } }
};
const GRID = 4, TERRAIN = {};
const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src; });
function tileUrl(layer, s) {
  const names = { shade: 'LRO_LOLA_ClrShade_Global_128ppd_v04', dem: 'LRO_LOLA_DEM_Global_128ppd_v04' };
  return IS_FILE ? `https://trek.nasa.gov/tiles/Moon/EQ/${names[layer]}/1.0.0/default/default028mm/${s.z}/${s.row}/${s.col}.png` : `/api/lro/${layer}/${s.z}/${s.row}/${s.col}`;
}
async function loadTerrain(key) {
  if (TERRAIN[key]) return TERRAIN[key];
  const s = SITES[key]; let t;
  try {
    const [shade, dem] = await Promise.all([loadImg(tileUrl('shade', s)), loadImg(tileUrl('dem', s))]);
    t = { shade, zones: analyzeDEM(dem), status: 'live' };
  } catch (e) {
    console.warn('LRO indisponível:', e);
    t = { shade: null, zones: fallbackZones(key), status: 'off' };
  }
  t.pins = pickPins(t.zones, s.base);
  TERRAIN[key] = t; NASA.lro.status = t.status;
  return t;
}
function analyzeDEM(img) {
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, N, N);
  const d = x.getImageData(0, 0, N, N).data, g = new Float32Array(N * N);
  let mn = 255, mx = 0;
  for (let i = 0; i < N * N; i++) { g[i] = d[i * 4]; mn = Math.min(mn, g[i]); mx = Math.max(mx, g[i]); }
  const zs = N / GRID, zones = []; let maxSlope = 1e-4;
  for (let r = 0; r < GRID; r++) {
    zones.push([]);
    for (let cc = 0; cc < GRID; cc++) {
      let se = 0, ss = 0, n = 0;
      for (let y = r * zs; y < (r + 1) * zs - 1; y++) for (let xx = cc * zs; xx < (cc + 1) * zs - 1; xx++) {
        const i = y * N + xx; se += g[i]; ss += Math.abs(g[i + 1] - g[i]) + Math.abs(g[i + N] - g[i]); n++;
      }
      const z = { elevRaw: se / n, slopeRaw: ss / n }; maxSlope = Math.max(maxSlope, z.slopeRaw); zones[r].push(z);
    }
  }
  const range = Math.max(1, mx - mn);
  zones.flat().forEach(z => { z.elev = clamp((z.elevRaw - mn) / range, 0, 1); z.slope = clamp(z.slopeRaw / maxSlope, .05, 1); classify(z); });
  return zones;
}
function fallbackZones(key) {
  const seed = key.length * 7.3, zones = [];
  for (let r = 0; r < GRID; r++) { zones.push([]); for (let c = 0; c < GRID; c++) { const z = { elev: (Math.sin(r * 1.7 + seed) + Math.cos(c * 1.3 + seed) + 2) / 4, slope: clamp(Math.abs(Math.sin(r * c + seed)), .1, 1) }; classify(z); zones[r].push(z); } }
  return zones;
}
const ZONE_TXT = {
  crater: { icon: '🕳️', pt: ['Fundo de cratera', 'Região baixa e fria. Peças de meteoritos se acumulam aqui.'], en: ['Crater floor', 'A low, cold area. Meteorite pieces pile up here.'] },
  steep: { icon: '⛰️', pt: ['Borda íngreme', 'Muito inclinado: gasta mais oxigênio, mas esconde muitas peças.'], en: ['Steep rim', 'Very steep: uses more oxygen, but hides lots of parts.'] },
  plain: { icon: '🟫', pt: ['Planície', 'Terreno plano: caminhar é fácil e gasta pouco oxigênio.'], en: ['Plain', 'Flat ground: walking is easy and uses little oxygen.'] },
  hills: { icon: '🏔️', pt: ['Colinas', 'Terreno ondulado com pedras e crateras pequenas.'], en: ['Hills', 'Bumpy ground with rocks and small craters.'] }
};
// o terreno fica em cache; nome e dica são lidos no idioma atual na hora de mostrar
function classify(z) {
  z.kind = z.elev < .35 ? 'crater' : z.slope > .7 ? 'steep' : z.slope < .35 ? 'plain' : 'hills';
  z.icon = ZONE_TXT[z.kind].icon;
  Object.defineProperties(z, {
    type: { get: () => ZONE_TXT[z.kind][LANG][0], configurable: true },
    tip: { get: () => ZONE_TXT[z.kind][LANG][1], configurable: true }
  });
}
// 4 pinos do cenário = 4 zonas reais do LRO, da mais perto para a mais longe da base
function pickPins(zones, base) {
  const all = [];
  for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) if (r !== base[0] || c !== base[1]) all.push({ r, c, d: dist([r, c], base), z: zones[r][c] });
  const used = new Set(), out = [];
  const take = (list, score) => { const z = list.filter(p => !used.has(p.r * 4 + p.c)).sort((a, b) => score(b) - score(a))[0]; if (z) { used.add(z.r * 4 + z.c); out.push([z.r, z.c]); } };
  take(all.filter(p => p.d === 1), p => -p.z.slope);              // perto e fácil
  take(all.filter(p => p.d === 2), p => -p.z.elev);               // fundo de cratera
  take(all.filter(p => p.d >= 2 && p.d <= 3), p => p.z.slope);    // borda íngreme
  take(all, p => p.d * 10 + p.z.slope);                            // o mais distante
  while (out.length < 4) take(all, p => p.d);
  return out;
}
const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
const zoneCost = (z, from, to) => ({ o: Math.round((6 + 7 * dist(from, to) + 18 * z.slope) * D().move), e: Math.round((3 + 5 * z.slope) * D().move), s: 0 });
const returnCost = p => Math.round(7 * dist(p, SITES[S.site].base) * D().move);
const depKey = (r, c) => `${S.site}:${r},${c}`;
const zoneYield = (z, r, c) => Math.max(1, Math.round((2 + 5 * z.slope + 3 * (1 - z.elev) + rnd(0, 2)) * Math.max(.2, 1 - .3 * (S.dep[depKey(r, c)] || 0))));
const LUNAR_FACTS = [
  ['A sonda <b>LRO</b> mede o relevo da Lua com um laser chamado <b>LOLA</b>, que dispara 28 vezes por segundo!',
    'The <b>LRO</b> probe measures the Moon’s surface with a laser called <b>LOLA</b>, which fires 28 times per second!'],
  ['A missão <b>Artemis I</b> passou pela Lua em <b>2022</b>, mas não pousou. O programa Artemis prepara missões tripuladas!',
    'The <b>Artemis I</b> mission flew around the Moon in <b>2022</b>, but did not land. The Artemis program is getting ready for crewed missions!'],
  ['A cratera <b>Copérnico</b> tem cerca de <b>93 km</b> de largura e pode ser vista da Terra com binóculos.',
    '<b>Copernicus</b> crater is about <b>93 km</b> wide and can be seen from Earth with binoculars.'],
  ['A <b>Apollo 14</b> pousou em <b>Fra Mauro</b> em 1971 e trouxe solo lunar usado em experimentos com plantas.',
    '<b>Apollo 14</b> landed at <b>Fra Mauro</b> in 1971 and brought back Moon soil used in plant experiments.'],
  ['Na Lua um dia dura cerca de <b>29 dias</b> da Terra, por isso as noites lunares são muito longas e frias.',
    'A day on the Moon lasts about <b>29 Earth days</b>, so lunar nights are very long and cold.'],
  ['A gravidade da Lua é <b>6 vezes menor</b>: na Lua você pularia muito mais alto!',
    'The Moon’s gravity is <b>6 times weaker</b>: on the Moon you could jump much higher!']
];

/* ================= telas (coordenadas na arte 330×540) ================= */
const NAV_X = [[10, 76], [88, 76], [166, 76], [245, 76]];
const SCREENS = {
  // retângulos medidos pixel a pixel: interior colorido de cada barra desenhada (x, y, largura, altura)
  home: { bg: 'bg_home.webp', hud: { e: [37, 44.5, 68, 20.5], o: [141.5, 44.5, 68, 20.5], s: [257, 45, 53, 19.5] }, nav: [452, 78] },
  farm: { bg: 'bg_farm.webp', hud: { e: [41, 40, 64, 18.5], o: [142, 40, 66, 18.5], s: [250.5, 40, 58, 18.5] }, nav: [452, 78] },
  explore: { bg: 'bg_explore.webp', hud: { e: [40, 31.5, 63, 17.5], o: [142.5, 33, 57, 15.5], s: [243.5, 31.5, 56, 17.5] }, nav: [455, 72] },
  sleep: { bg: 'bg_sleep.webp', hud: { e: [43, 47, 62, 18.5], o: [142.5, 47.5, 64.5, 18], s: [250, 47.5, 57, 17.5] }, nav: [445, 72] },
  pipes: { bg: 'bg_pipes.webp', hud: { e: [36, 35, 66, 18.5], o: [142, 34, 65, 18.5], s: [250, 34.5, 61, 18] }, nav: null },
  wires: { bg: 'bg_wires.webp', hud: { e: [42, 32.5, 64, 16], o: [148, 32.5, 55.5, 16], s: [243.5, 33, 53, 16] }, nav: null }
};
SCREENS.memory = SCREENS.wires; // jogo da memória usa o mesmo cenário do conserto do foguete

/* ================= HUD / toast / robô / modal ================= */
function nextScrapGoal() { return S.rocket < 5 ? scaled(ROCKET[S.rocket]).s : 50; }
function hud() {
  const cfg = SCREENS[curBg()];
  const h = $('#hud');
  if (!cfg || S.phase !== 'play') { h.innerHTML = ''; return; }
  const bar = (k, w, txt, low) => `<div class="bar ${k} ${low ? 'low' : ''}" style="${pos(cfg.hud[k])}"><div class="fill" style="width:${clamp(w, 0, 100)}%"></div><div class="num">${txt}</div></div>`;
  h.innerHTML = bar('e', S.elixir, `${Math.round(S.elixir)}%`, S.elixir < 20) +
    bar('o', S.o2 / o2Max() * 100, `${Math.round(S.o2 / o2Max() * 100)}%`, S.o2 < 20) +
    bar('s', S.scrap / nextScrapGoal() * 100, `${S.scrap}`, false);
}
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2000); }

const robotQ = []; let robotBusy = false;
function robot(text) { return new Promise(res => { robotQ.push({ text, res }); pumpRobot(); }); }
function pumpRobot() {
  if (robotBusy || !robotQ.length) return;
  robotBusy = true;
  const { text, res } = robotQ.shift(), b = $('#bubble');
  b.className = 'bubble glass';
  b.style.bottom = SCREENS[curBg()]?.nav ? '92px' : '12px';
  b.innerHTML = `<div class="rb"><img src="${A('robot.png')}" alt="${tr('Robô', 'Robot')}"></div><div class="speech">${text}<div class="row">${sayBtn(text)}<button class="pill-btn yellow small" data-ok>OK</button></div></div>`;
  if (S.voice) speak(text);
  $('[data-ok]', b).onclick = () => { b.className = 'bubble hidden'; robotBusy = false; res(); pumpRobot(); };
}
const tip = (k, text) => { if (S.tips[k]) return; S.tips[k] = 1; save(); robot(text); };
const clearRobot = () => { robotQ.length = 0; robotBusy = false; $('#bubble').className = 'bubble hidden'; };

function modal(title, html, bind, opts = {}) {
  const m = $('#modal');
  m.innerHTML = `<div class="card glass ${opts.cls || ''}"><div class="banner ${opts.orange ? 'orange' : ''}">${title}</div>${opts.noX ? '' : `<button class="xround" data-close style="right:-6px;top:-14px" aria-label="${tr('Fechar', 'Close')}">✕</button>`}<div class="card-body">${html}</div></div>`;
  m.classList.remove('hidden');
  $$('[data-close]', m).forEach(x => x.onclick = closeModal);
  if (bind) bind(m);
}
function modalRaw(html, bind) {
  const m = $('#modal'); m.innerHTML = html; m.classList.remove('hidden');
  $$('[data-close]', m).forEach(x => x.onclick = closeModal);
  if (bind) bind(m);
}
function closeModal() { const m = $('#modal'); m.classList.add('hidden'); m.innerHTML = ''; }

/* ================= roteamento ================= */
let current = 'home', mgTimer = null, mgScreen = null;
const curBg = () => current === 'minigame' ? mgScreen : current;
function go(screen) { stopMG(); closeModal(); current = screen; render(); }
function render() {
  const play = S.phase === 'play';
  const cfg = play ? SCREENS[curBg()] : null;
  const bg = $('#bg');
  if (cfg) { const src = AL(cfg.bg); if (!bg.src.endsWith(src)) bg.src = A(src); bg.classList.remove('hidden'); } else bg.classList.add('hidden');
  $('#artlab').innerHTML = cfg ? artLabels(curBg()) : '';
  hud();
  const nav = $('#nav');
  nav.innerHTML = cfg && cfg.nav ? ['farm', 'explore', 'upgrades', 'sleep'].map((t, i) =>
    `<button data-nav="${t}" aria-label="${tr(['Alimentar', 'Explorar', 'Melhorias', 'Dormir'], ['Feed', 'Explore', 'Upgrades', 'Sleep'])[i]}" style="${pos([NAV_X[i][0], cfg.nav[0], NAV_X[i][1], cfg.nav[1]])}"></button>`).join('') : '';
  setBackdrop(cfg);
  if (S.phase === 'intro') return renderIntro();
  if (S.phase === 'outro') return renderOutro();
  if (S.phase === 'story') return renderStory();
  if (S.phase === 'age') return renderAge();
  if (S.phase === 'end') return renderEnd();
  if (current === 'minigame') return;
  ({ home: renderHome, farm: renderFarm, explore: renderExplore, sleep: renderSleep }[current] || renderHome)();
}
$('#nav').addEventListener('click', e => {
  const b = e.target.closest('[data-nav]'); if (!b) return;
  const t = b.dataset.nav;
  if (S.trip) { if (t !== 'explore') toast(tr('🚙 Volte para a base primeiro!', '🚙 Go back to the base first!')); return go('explore'); }
  if (t === 'upgrades') return openUpgrades();
  go(current === t ? 'home' : t);
});
const layer = html => { $('#layer').innerHTML = html; };

/* ================= vídeo de abertura (todo jogo novo) ================= */
const STORY_AFTER_VIDEO = 2; // o vídeo já mostra a base e a nave caindo → o tutorial continua em "Nos destroços..."
// Player de vídeo em tela cheia (no celular cobre a tela toda; no computador fica dentro do aparelho)
let vidSrc = null;
function playVideo(src, onDone) {
  const box = $('#vidlayer');
  if (vidSrc === src && !box.classList.contains('hidden')) return; // já está tocando
  vidSrc = src;
  box.innerHTML = `<video id="vid" src="${A(src)}" playsinline preload="auto"></video>
    <button class="pill-btn blue vid-snd hidden" id="vidSnd">${tr('🔊 ATIVAR SOM', '🔊 TURN ON SOUND')}</button>
    <button class="pill-btn yellow vid-skip" id="vidSkip">${tr('PULAR ⏭', 'SKIP ⏭')}</button>
    <div class="vid-bar"><i id="vidProg"></i></div>`;
  box.classList.remove('hidden'); positionVid();
  const v = $('#vid'), snd = $('#vidSnd');
  let done = false;
  const finish = () => {
    if (done) return; done = true;
    v.pause(); box.classList.add('hidden'); box.innerHTML = ''; vidSrc = null; onDone();
  };
  v.onended = finish;
  v.onerror = finish; // se o vídeo não carregar, segue o jogo sem travar
  v.ontimeupdate = () => { const p = $('#vidProg'); if (p && v.duration) p.style.width = (v.currentTime / v.duration * 100) + '%'; };
  $('#vidSkip').onclick = finish;
  const unmute = () => { v.muted = false; snd.classList.add('hidden'); if (v.paused) v.play(); };
  snd.onclick = unmute;
  v.onclick = () => { if (v.muted || v.paused) unmute(); };
  // navegadores só deixam tocar com som depois de um toque; se bloquear, toca mudo e mostra o botão de som
  v.muted = false;
  v.play().catch(() => { v.muted = true; snd.classList.remove('hidden'); v.play().catch(() => snd.classList.remove('hidden')); });
}
function renderIntro() {
  layer('');
  playVideo('intro.mp4', () => { if (S.phase !== 'intro') return; S.phase = 'story'; storyI = STORY_AFTER_VIDEO; save(); render(); });
}
// vídeo final: depois de consertar o foguete, antes da tela de "Missão cumprida"
function renderOutro() {
  layer('');
  playVideo('ending.mp4', () => { if (S.phase !== 'outro') return; S.phase = 'end'; save(); render(); });
}
function newGame() {
  const keep = { parental: S.parental, voice: S.voice };
  S = Object.assign(newState(), keep); storyI = 0; save(); closeModal(); clearRobot(); current = 'home'; render();
}

/* ================= história / idade ================= */
const STORY = [
  { get t() { return tr('Você é um astronauta e vive em um posto avançado na Lua. 🌕', 'You are an astronaut living at an outpost on the Moon. 🌕'); }, img: [['moon_scene.png', 'left:-15px;top:-10px;width:330px;height:220px;object-fit:cover']] },
  { get t() { return tr('Certo dia, uma nave espacial alienígena caiu perto da sua base! 💥', 'One day, an alien spaceship crashed near your base! 💥'); }, img: [['moon_scene.png', 'left:-15px;top:-10px;width:330px;height:220px;object-fit:cover;filter:brightness(.55)'], ['rocket.png', 'left:95px;top:14px;width:120px;border-radius:14px;box-shadow:0 0 0 3px #7fe3ff,0 0 18px #ff8a3d']] },
  { get t() { return tr('Nos destroços, você encontrou Zuno: um pequeno alienígena ferido e sem energia.', 'In the wreckage, you found Zuno: a little alien, hurt and out of energy.'); }, img: [['zuno_sleep.png', 'left:0;top:-10px;width:300px']] },
  { get t() { return tr('O Robô da base escaneou Zuno: a energia dele vem do <b>ELIXIR</b>, feito a partir de plantas cultivadas!', 'The base Robot scanned Zuno: his energy comes from <b>ELIXIR</b>, made from the plants you grow!'); }, img: [['robot.png', 'left:12px;top:30px;width:140px;border-radius:16px'], ['plant_alface.png', 'left:170px;top:70px;width:120px']] },
  { get t() { return tr('Sua missão: cuidar de Zuno, cuidar dos recursos da base e consertar o foguete para ele voltar para a família! 🚀', 'Your mission: take care of Zuno and the base, and fix the rocket so he can go back to his family! 🚀'); }, img: [['zuno_home.png', 'left:10px;top:-20px;width:150px'], ['rocket.png', 'left:170px;top:20px;width:120px']] }
];
let storyI = 0;
function renderStory() {
  const s = STORY[storyI];
  layer(`<div class="story">
    <div class="logo">ZUNO</div>
    <div class="scene">${s.img.map(([src, st]) => `<img src="${A(src)}" style="${st}" alt="">`).join('')}</div>
    <div class="story-text glass" style="padding:8px 10px"><p style="flex:1">${s.t}</p>${sayBtn(s.t)}</div>
    <div class="dots">${STORY.map((_, i) => `<i class="${i === storyI ? 'on' : ''}"></i>`).join('')}</div>
    <div class="row2"><button class="pill-btn blue" id="skip">${tr('PULAR', 'SKIP')}</button><button class="pill-btn green" id="next">${storyI < STORY.length - 1 ? tr('PRÓXIMO ▶', 'NEXT ▶') : tr('COMEÇAR!', 'START!')}</button></div>
    ${langBtn('right:8px;top:8px')}
  </div>`);
  if (S.voice && storyI > 0) speak(s.t);
  $('#next').onclick = () => { if (storyI < STORY.length - 1) { storyI++; renderStory(); } else { S.phase = 'age'; save(); render(); } };
  $('#skip').onclick = () => { S.phase = 'age'; save(); render(); };
}
function renderAge() {
  const t = tr('Quantos anos você tem? Assim eu deixo a missão do seu tamanho!', 'How old are you? That way I can make the mission just right for you!');
  layer(`<div class="story" style="justify-content:center;gap:14px">
    <div style="width:130px;height:122px;border-radius:20px;overflow:hidden;border:3px solid #7fe3ff"><img src="${A('robot.png')}" style="width:100%;height:100%;object-fit:cover" alt=""></div>
    <div class="story-text glass" style="padding:8px 10px"><p style="flex:1">${t}</p>${sayBtn(t)}</div>
    <div class="ages">${[7, 8, 9, 10, 11, 12].map(a => `<button class="pill-btn ${['yellow', 'yellow', 'blue', 'blue', 'green', 'green'][a - 7]}" data-age="${a}">${a}</button>`).join('')}</div>
    <p style="font-size:11px;text-align:center;opacity:.85">${tr('Adultos: o Modo Supervisão (limite de tempo) fica na engrenagem ⚙️ da tela inicial.', 'Grown-ups: Parent Mode (time limit) is under the gear ⚙️ on the home screen.')}</p>
    ${langBtn('right:8px;top:8px')}
  </div>`);
  $$('[data-age]').forEach(b => b.onclick = () => {
    S.age = +b.dataset.age; S.diff = ageToDiff(S.age); S.phase = 'play'; S.o2 = o2Max(); save();
    current = 'home'; render();
    robot(tr(`Nível <b>${D().name}</b> ativado! Eu sou o Robô da base. Toque em mim quando precisar de uma dica.`, `<b>${D().name}</b> level on! I’m the base Robot. Tap me whenever you need a hint.`));
    robot(tr('A barra amarela é a <b>ENERGIA</b> do Zuno (o Elixir). Se ela acabar, ele desmaia! Vamos cuidar bem dele.', 'The yellow bar is Zuno’s <b>ENERGY</b> (Elixir). If it runs out, he faints! Let’s take good care of him.'));
  });
}

/* ================= casa ================= */
const zunoMood = () => S.elixir <= 0 ? 'faint' : S.elixir < 30 ? 'sad' : 'happy';
function renderHome() {
  const mood = zunoMood();
  layer(`${mood === 'faint' ? '<div class="faint-veil"></div>' : ''}
    <div class="zuno-hit" id="zuno"></div>
    ${mood !== 'happy' ? `<div class="mood"><div class="speech">${mood === 'faint' ? tr('😵 Sem energia...', '😵 No energy...') : tr('😢 Estou com fome!', '😢 I’m hungry!')}</div></div>` : ''}
    <div class="chip" style="left:8px;top:72px;font-size:11px">📅 ${tr('Dia', 'Day')} ${S.day}</div>
    <button class="chip" id="nasaBtn" style="right:36px;top:72px;font-size:11px">🛰️ NASA</button>
    <button class="chip" id="gearBtn" style="right:8px;top:72px;padding:2px 4px;font-size:11px" aria-label="${tr('Pais', 'Parents')}">⚙️</button>
    <button class="chip" id="rocketBtn" style="left:8px;top:94px;font-size:11px">🚀 ${S.rocket}/5</button>
    ${langBtn('right:8px;top:94px;font-size:11px')}
    <button class="robot-hint" id="robotBtn"><img src="${A('robot.png')}" alt="${tr('Robô', 'Robot')}"><i>?</i></button>`);
  $('#zuno').onclick = petZuno;
  $('#robotBtn').onclick = () => robot(hint());
  $('#nasaBtn').onclick = openNasa;
  $('#gearBtn').onclick = () => parentalGate(openSettings);
  $('#rocketBtn').onclick = () => robot(S.rocket < 5
    ? tr(`Foguete: <b>${S.rocket} de 5</b> partes consertadas. Próxima: <b>${ROCKET[S.rocket].name}</b>. Use MELHORIAS!`, `Rocket: <b>${S.rocket} of 5</b> parts fixed. Next: <b>${ROCKET[S.rocket].name}</b>. Use UPGRADES!`)
    : tr('O foguete está pronto!', 'The rocket is ready!'));
  if (mood === 'faint') tip('faint' + S.day, tr('Zuno desmaiou sem energia! Colha plantas em <b>ALIMENTAR</b> ou coloque-o para <b>DORMIR</b>.', 'Zuno fainted with no energy! Harvest plants in <b>FEED</b> or put him to <b>SLEEP</b>.'));
  else if (mood === 'sad') tip('sad' + S.day, tr('Zuno está ficando fraco... Vá em <b>ALIMENTAR</b> e colha uma planta para ele!', 'Zuno is getting weak... Go to <b>FEED</b> and harvest a plant for him!'));
}
const PET = [['Zuno adora carinho! 💚', 'Zuno loves cuddles! 💚'], ['Zuno: "Blip blop!" (obrigado!)', 'Zuno: "Blip blop!" (thank you!)'],
  ['Zuno sente saudade da família...', 'Zuno misses his family...'], ['Zuno está curioso sobre a Terra 🌍', 'Zuno is curious about Earth 🌍']];
function petZuno(e) {
  if (zunoMood() === 'faint') return toast(tr('😵 Zuno precisa de Elixir!', '😵 Zuno needs Elixir!'));
  const h = document.createElement('div'); h.className = 'heart'; h.textContent = ['💚', '💙', '✨', '⭐'][rnd(0, 3)];
  const r = $('#screen').getBoundingClientRect(), k = 330 / r.width;
  h.style.left = ((e.clientX - r.left) * k - 12) + 'px'; h.style.top = ((e.clientY - r.top) * k - 20) + 'px';
  $('#layer').appendChild(h); setTimeout(() => h.remove(), 1200);
  toast(PET[rnd(0, PET.length - 1)][EN() ? 1 : 0]);
}
function hint() {
  const open = S.plots.slice(0, slotsOpen());
  if (open.some(p => p.crop && p.left <= 0)) return tr('Tem planta pronta! Vá em <b>ALIMENTAR</b> e faça a colheita. 🌱', 'A plant is ready! Go to <b>FEED</b> and harvest it. 🌱');
  if (S.elixir < 20) return tr('A energia está muito baixa. Vá <b>DORMIR</b> para recuperar, e as plantas crescem durante a noite.', 'Energy is very low. Go to <b>SLEEP</b> to recover; plants grow during the night.');
  if (open.some(p => !p.crop)) return S.water >= 1 ? tr('Há cúpula vazia na plantação! Plante algo para produzir Elixir.', 'There’s an empty dome on the farm! Plant something to make Elixir.') : tr('Acabou a água! Extraia gelo lunar na tela da plantação. 💧', 'Out of water! Dig lunar ice on the farm screen. 💧');
  if (S.rocket < 5) {
    const c = scaled(ROCKET[S.rocket]);
    if (c.o > o2Max()) return tr(`A próxima peça do foguete precisa de <b>${c.o}</b> de oxigênio, mas o tanque só guarda <b>${o2Max()}</b>. Melhore a <b>Base</b>!`, `The next rocket part needs <b>${c.o}</b> oxygen, but the tank only holds <b>${o2Max()}</b>. Upgrade the <b>Base</b>!`);
    if (canPay(c)) return tr('Você já tem recursos para consertar uma parte do foguete! Abra <b>MELHORIAS</b>. 🚀', 'You have enough to fix a rocket part! Open <b>UPGRADES</b>. 🚀');
    if (S.scrap < c.s) return tr(`Precisamos de mais <b>${c.s - S.scrap}</b> sucatas. Vá <b>EXPLORAR</b> a Lua!`, `We need <b>${c.s - S.scrap}</b> more scrap. Go <b>EXPLORE</b> the Moon!`);
    if (S.o2 < c.o) return tr('Falta oxigênio. Volte de uma expedição ou durma para reabastecer o tanque.', 'Not enough oxygen. Come back from an expedition or sleep to refill the tank.');
    return tr('Falta energia para a melhoria. Colha plantas para o Zuno!', 'Not enough energy for the upgrade. Harvest plants for Zuno!');
  }
  return tr('Tudo certo por aqui! Continue cuidando do Zuno.', 'All good here! Keep taking care of Zuno.');
}

/* ================= plantação ================= */
// Cada cúpula liberada é a mesma peça (assets/pod.png: cúpula da arte original, vazia, com rótulo e
// caixa de status limpos), colocada por cima do desenho. As 4 ficam idênticas; as de baixo cobrem a
// arte de "bloqueada". Planta, nome e status ficam dentro da peça em % (acompanham o tamanho dela).
// as de baixo ficam um pouco menores (mesma proporção das de cima) para não encostar nos botões
const PODS = [[44, 136, 118, 167], [165, 136, 118, 167], [50, 300, 106, 150], [171, 300, 106, 150]];
const stageScale = p => { if (p.left <= 0) return 1; const f = 1 - p.left / p.total; return f < .34 ? .3 : f < .67 ? .55 : .8; };
function plantHTML(k, sc) {
  const c = CROPS[k];
  return c.svg ? `<div class="plant" style="width:46%;left:27%;transform:scale(${sc})">${ART.rabanete()}</div>`
    : `<div class="plant" style="width:96%;left:2%;transform:scale(${sc})"><img src="${A(c.img)}" alt=""></div>`;
}
function renderFarm() {
  const html = PODS.map((r, i) => {
    const p = S.plots[i];
    if (i >= slotsOpen()) return ''; // bloqueada: já está desenhada no fundo
    const ready = p.crop && p.left <= 0;
    const name = p.crop ? `${CROPS[p.crop].icon}${CROPS[p.crop].name.toUpperCase()}` : tr('VAZIO', 'EMPTY');
    let st;
    if (!p.crop) st = `<button class="pill-btn green plantar" data-plant="${i}">${tr('+ PLANTAR', '+ PLANT')}</button>`;
    else if (ready) st = `<div class="ok-pill">${tr('✔ PRONTO!', '✔ READY!')}</div><button class="img-btn colher" data-harvest="${i}" aria-label="${tr('Colher', 'Harvest')}" style="background-image:url(${A(AL('btn_colher.png'))})">${EN() ? '<span class="al btn-al">HARVEST</span>' : ''}</button>`;
    // barra = contagem de dias DE JOGO (não é medição do crescimento real da planta)
    else st = `<div class="days" title="${tr('Dias de jogo (não é medição do estudo)', 'Game days (not a study measurement)')}">🎮 ${p.left} ${p.left > 1 ? tr('DIAS', 'DAYS') : tr('DIA', 'DAY')}</div><div class="prog" title="${tr('Estimativa do jogo', 'Game estimate')}"><i style="width:${Math.round((1 - p.left / p.total) * 100)}%"></i></div>`;
    return `<div class="pod" style="${pos(r)}"><img class="podimg" src="${A('pod.png')}" alt="">
      <div class="pod-in ${ready ? 'ready' : ''}" data-pod="${i}">${p.crop ? plantHTML(p.crop, stageScale(p)) : ''}</div>
      <div class="plabel">${name}</div><div class="pstatus">${st}</div></div>`;
  }).join('');
  layer(html + `
    <div class="chip" style="left:8px;top:70px">💧 ${tr('Água', 'Water')}: ${S.water}</div>
    <button class="chip" id="ice" style="right:8px;top:70px">⛏️ ${tr('Gelo', 'Ice')} +3💧</button>
    <button class="chip" id="cropInfo" style="left:8px;top:94px">🧪 NASA</button>`);
  $$('[data-plant]').forEach(b => b.onclick = () => choosePlant(+b.dataset.plant));
  $$('[data-harvest]').forEach(b => b.onclick = () => harvest(+b.dataset.harvest));
  $$('.pod-in').forEach(d => d.onclick = () => { const i = +d.dataset.pod, p = S.plots[i]; if (!p.crop) choosePlant(i); else if (p.left <= 0) harvest(i); else toast(tr(`🌱 Faltam ${p.left} dia(s)`, `🌱 ${p.left} day(s) to go`)); });
  $('#ice').onclick = collectWater;
  $('#cropInfo').onclick = openNasa;
  tip('farm', tr('Esta é a plantação! As plantas são estudadas de verdade pela NASA. Plantar usa <b>água</b> e um pouco de <b>energia</b>; colher dá <b>Elixir</b> para o Zuno.',
    'This is the farm! NASA really studies these plants. Planting uses <b>water</b> and a little <b>energy</b>; harvesting gives <b>Elixir</b> to Zuno.'));
}
function collectWater() {
  if (S.elixir < 4) return toast(tr('⚡ Energia insuficiente!', '⚡ Not enough energy!'));
  S.elixir -= 4; S.water += 3; save(); render(); toast(tr('💧 +3 de água (gelo lunar derretido)', '💧 +3 water (melted lunar ice)'));
  tip('water', tr('Sabia? Em 2009, a NASA descobriu <b>gelo de água</b> em crateras escuras do polo sul da Lua com a missão LCROSS!', 'Did you know? In 2009, NASA found <b>water ice</b> in dark craters at the Moon’s south pole with the LCROSS mission!'));
}
function choosePlant(i) {
  const cards = Object.keys(CROPS).map(k => {
    const c = CROPS[k], w = waterNeed(k), ok = S.water >= w && S.elixir >= 3;
    const sci = kidText(k);
    return `<div class="cropcard"><div class="pic">${c.svg ? ART.rabanete() : `<img src="${A(c.img)}" alt="">`}</div>
      <div class="info"><h3>${c.name} ${sayBtn(`${c.name}. ${tr('Na estufa da Antártida', 'In the Antarctic greenhouse')}: ${sci}`)}</h3>
        <div class="sci-txt">🔬 ${sci}</div>
        <div class="crop-foot"><span class="game-txt">🎮 ${tr('No jogo', 'In the game')}: <b>${gameDays(k)} ${tr('dia(s)', 'day(s)')}</b> · 💧${w} · +${elixirValue(k)}⚡</span>
        <button class="pill-btn green small" data-pick="${k}" ${ok ? '' : 'disabled'}>${tr('PLANTAR', 'PLANT')}</button></div></div></div>`;
  }).join('');
  const sizes = AREAS.map(n => `<button class="area-btn ${areaSide() === n ? 'on' : ''}" data-area="${n}">${n}×${n} m</button>`).join('');
  modal(tr('O QUE PLANTAR?', 'WHAT TO PLANT?'), `<p style="font-size:12px;text-align:center">${tr(`Plantar custa 3⚡ + água. Você tem 💧${S.water}.`, `Planting costs 3⚡ + water. You have 💧${S.water}.`)}</p>
    <div class="area-row"><span>${tr('Tamanho do canteiro:', 'Plot size:')}</span>${sizes}</div>${cards}
    <p class="src-line">${sourceLine()}. ${tr('Os dias de jogo são do jogo, não do estudo.', 'Game days come from the game, not from the study.')}</p>`, m => {
    $$('[data-area]', m).forEach(b => b.onclick = () => { S.areaSide = +b.dataset.area; save(); choosePlant(i); });
    $$('[data-pick]', m).forEach(b => b.onclick = () => {
      const k = b.dataset.pick, p = S.plots[i];
      S.water -= waterNeed(k); S.elixir -= 3;
      Object.assign(p, { crop: k, left: gameDays(k), total: gameDays(k), harvests: 0 });
      save(); closeModal(); render(); toast(tr(`🌱 ${CROPS[k].name} plantado!`, `🌱 ${CROPS[k].name} planted!`));
      tip('plant', tr('As plantas crescem enquanto o Zuno dorme. Cada noite de sono = <b>1 dia</b> na Lua.', 'Plants grow while Zuno sleeps. Each night of sleep = <b>1 day</b> on the Moon.'));
    });
  });
}
function harvest(i) {
  const p = S.plots[i], k = p.crop, c = CROPS[k], gain = elixirValue(k);
  S.elixir = Math.min(100, S.elixir + gain); S.fedToday = true; S.stats.harvested++; p.harvests++;
  let extra = '';
  if (c.regrow && p.harvests < c.harvests) { p.left = regrowDays(); p.total = p.left; extra = tr(` O pé de pepino continua dando frutos: mais em ${p.left} dia(s)!`, ` The cucumber plant keeps giving fruit: more in ${p.left} day(s)!`); }
  else Object.assign(p, { crop: null, left: 0, total: 0, harvests: 0 });
  save(); render();
  toast(tr(`⚡ +${gain} de energia para o Zuno!`, `⚡ +${gain} energy for Zuno!`));
  const txt = kidText(k, true);
  const small = strip(txt).length > 115;
  if (extra) setTimeout(() => robot(extra.trim()), 300);
  // popup original "COLHEITA REALIZADA!" com o texto e o vegetal trocados
  const vegOverlay = k === 'alface' ? '' : `<div class="abs" style="${pos([196, 136, 82, 62])};background:radial-gradient(circle,#2f74e0 40%,#2563d8 70%,rgba(37,99,216,0));display:grid;place-items:center">${c.svg ? `<div style="width:54px">${ART.rabanete()}</div>` : `<img src="${A(c.img)}" style="width:80px" alt="">`}</div>`;
  modalRaw(`<div class="popimg" style="${pos([6, 253, 300, 207])}"><img src="${A(AL('pop_harvest.webp'))}" alt="${tr('Colheita realizada', 'Harvest done')}">${EN() ? artLabel([150, 33, 'HARVEST DONE!', 19]) : ''}
      <div class="abs speech" style="${pos([125, 62, 148, 92])};border:0;background:#eef4ff;font-size:${small ? 10 : 11.5}px;line-height:1.3;padding:3px 6px;border-radius:12px;overflow-y:auto;scrollbar-width:none;display:flex;flex-direction:column;justify-content:safe center"><span>${txt}</span><span class="src-mini">${tr('Fonte: NASA OSDR OSD-895 · Antártida', 'Source: NASA OSDR OSD-895 · Antarctica')}</span></div>
      ${vegOverlay}
      <button class="hot" data-close style="${pos([262, 6, 36, 36])}" aria-label="${tr('Fechar', 'Close')}"></button>
      <div class="abs" style="left:8px;top:170px">${sayBtn(txt)}</div></div>`, m => m.onclick = e => { if (e.target === m) closeModal(); });
  if (S.voice) speak(txt);
}

/* ================= exploração ================= */
const PIN_POS = [[28, 160], [110, 133], [178, 163], [248, 127]];
const PANEL = [14, 206, 302, 248];
let selPin = null;
async function renderExplore() {
  const site = SITES[S.site];
  layer(`<div id="pins"></div><div class="xpanel glass" id="xp" style="${pos(PANEL)}"><div class="banner">${S.trip ? tr('EXPEDIÇÃO', 'EXPEDITION') : tr('ESCOLHA UM LOCAL', 'PICK A PLACE')}</div><p style="text-align:center;margin-top:30px">${tr('🛰️ Baixando relevo da LRO...', '🛰️ Downloading LRO terrain...')}</p></div>`);
  const t = await loadTerrain(S.site);
  if (current !== 'explore' || !$('#xp')) return;
  drawPins(t); drawPanel(t);
  tip('explore', tr('Cada pino é um lugar <b>de verdade</b> da Lua: o relevo vem do laser LOLA da sonda LRO! Terrenos inclinados gastam mais oxigênio, mas têm mais sucata. Guarde oxigênio para voltar!',
    'Each pin is a <b>real</b> place on the Moon: the terrain comes from the LRO probe’s LOLA laser! Steep ground uses more oxygen but has more scrap. Save oxygen for the trip back!'));
}
function drawPins(t) {
  const posNow = S.trip ? S.trip.pos : SITES[S.site].base;
  let astro = 'left:44px;top:132px';
  $('#pins').innerHTML = t.pins.map(([r, c], i) => {
    const [x, y] = PIN_POS[i], times = S.dep[depKey(r, c)] || 0;
    if (r === posNow[0] && c === posNow[1]) astro = `left:${x + 16}px;top:${y - 8}px`;
    return `<button class="pinb ${selPin === i ? 'sel' : ''} ${times >= 3 ? 'dim' : ''}" data-pin="${i}" style="left:${x}px;top:${y}px"><img src="${A('pin.png')}" alt="${tr('Local', 'Place')} ${i + 1}"><span class="n">${i + 1}</span>${times ? '<span class="ck">✔</span>' : ''}</button>`;
  }).join('') + `<div class="astro" style="${astro}">🧑‍🚀</div>`;
  $$('[data-pin]').forEach(b => b.onclick = () => { selPin = +b.dataset.pin; drawPins(t); drawPanel(t); });
}
function drawPanel(t) {
  const site = SITES[S.site], posNow = S.trip ? S.trip.pos : site.base;
  let info;
  if (selPin === null) info = `<div class="zinfo"><h4>${tr('Toque num pino', 'Tap a pin')} ${sayBtn(tr('Toque num pino do cenário ou numa região numerada do mapa para ver o terreno e o custo.', 'Tap a pin in the scene or a numbered area on the map to see the terrain and the cost.'))}</h4>
      <p style="font-size:11px;line-height:1.3">${tr(`O mapinha é a Lua de verdade (${site.name}), medida pelo laser <b style="color:#ffe14d">LOLA</b> da sonda <b style="color:#ffe14d">LRO</b> da NASA.`,
        `The little map is the real Moon (${site.name}), measured by the <b style="color:#ffe14d">LOLA</b> laser on NASA’s <b style="color:#ffe14d">LRO</b> probe.`)}</p></div>`;
  else {
    const [r, c] = t.pins[selPin], z = t.zones[r][c];
    const cost = zoneCost(z, posNow, [r, c]), back = returnCost([r, c]);
    const can = S.o2 >= cost.o && S.elixir >= cost.e, risky = S.o2 - cost.o < back;
    const times = S.dep[depKey(r, c)] || 0;
    info = `<div class="zinfo"><h4>${selPin + 1}. ${z.icon} ${z.type} ${sayBtn(z.type + '. ' + z.tip)}</h4>
      <div class="meter"><span>${tr('Altitude', 'Altitude')}</span><div class="mb"><i style="width:${Math.round(z.elev * 100)}%;background:#38b6ff"></i></div></div>
      <div class="meter"><span>${tr('Inclinação', 'Slope')}</span><div class="mb"><i style="width:${Math.round(z.slope * 100)}%;background:#ff8a3d"></i></div></div>
      <div class="meter"><span>${tr('Sucata', 'Scrap')}</span><div class="mb"><i style="width:${Math.round(Math.max(.2, 1 - .3 * times) * 100)}%;background:#4fd44a"></i></div></div>
      <div class="costs"><span class="cost ${S.o2 < cost.o ? 'no' : ''}">🫧−${cost.o}</span><span class="cost ${S.elixir < cost.e ? 'no' : ''}">⚡−${cost.e}</span><span class="cost">${tr('volta', 'back')} 🫧${back}</span></div>
      ${risky && can ? `<div class="warn">${tr('⚠️ Não vai sobrar oxigênio para voltar!', '⚠️ Not enough oxygen left to get back!')}</div>` : ''}
      <button class="pill-btn green small" id="go" ${can ? '' : 'disabled'}>${tr('EXPLORAR', 'EXPLORE')}</button></div>`;
  }
  $('#xp').innerHTML = `<div class="banner">${S.trip ? tr('EXPEDIÇÃO', 'EXPEDITION') : tr('ESCOLHA UM LOCAL', 'PICK A PLACE')}</div>
    <div class="xrow"><div class="lro"><canvas id="lro" width="236" height="236"></canvas><div class="tag">NASA LRO/LOLA · ${site.short}</div></div>${info}</div>
    <div class="xfoot"><div class="seg">${Object.entries(SITES).map(([k, s]) => `<button data-site="${k}" class="${k === S.site ? 'on' : ''}" ${S.trip ? 'disabled' : ''}>${s.short}</button>`).join('')}</div>
      <span>🎒 ${S.trip ? S.trip.bag : 0}🔩</span>
      <button class="pill-btn blue small" id="home" ${S.trip ? '' : 'disabled'}>🏠 ${tr('VOLTAR', 'BACK')}</button></div>`;
  drawLRO(t);
  $$('[data-site]').forEach(b => b.onclick = () => { S.site = b.dataset.site; selPin = null; save(); render(); });
  $('#home').onclick = returnToBase;
  const g = $('#go'); if (g) g.onclick = () => explore(t);
  $('#lro').onclick = e => {
    const r = e.target.getBoundingClientRect();
    const cc = Math.floor((e.clientX - r.left) / r.width * GRID), rr = Math.floor((e.clientY - r.top) / r.height * GRID);
    const i = t.pins.findIndex(([a, b]) => a === rr && b === cc);
    if (i >= 0) { selPin = i; drawPins(t); drawPanel(t); } else toast(tr('Escolha uma região numerada', 'Pick a numbered area'));
  };
}
function drawLRO(t) {
  const cv = $('#lro'); if (!cv) return;
  const x = cv.getContext('2d'), W = cv.width, Z = W / GRID, site = SITES[S.site];
  if (t.shade) x.drawImage(t.shade, 0, 0, W, W);
  else t.zones.forEach((row, r) => row.forEach((z, c) => { const v = Math.round(60 + z.elev * 140); x.fillStyle = `rgb(${v * .6},${v},${v})`; x.fillRect(c * Z, r * Z, Z, Z); }));
  x.strokeStyle = 'rgba(255,255,255,.25)'; x.lineWidth = 1;
  for (let i = 1; i < GRID; i++) { x.beginPath(); x.moveTo(i * Z, 0); x.lineTo(i * Z, W); x.moveTo(0, i * Z); x.lineTo(W, i * Z); x.stroke(); }
  x.textAlign = 'center'; x.textBaseline = 'middle';
  t.pins.forEach(([r, c], i) => {
    x.lineWidth = selPin === i ? 6 : 3; x.strokeStyle = selPin === i ? '#ffe14d' : 'rgba(255,225,77,.7)';
    x.strokeRect(c * Z + 3, r * Z + 3, Z - 6, Z - 6);
    x.fillStyle = '#1b4fd0'; x.beginPath(); x.arc(c * Z + 16, r * Z + 16, 12, 0, 7); x.fill();
    x.fillStyle = '#fff'; x.font = 'bold 15px Fredoka'; x.fillText(i + 1, c * Z + 16, r * Z + 17);
  });
  const [br, bc] = site.base; x.font = `${Z * .45}px serif`; x.fillText('🏠', bc * Z + Z / 2, br * Z + Z / 2);
  const p = S.trip ? S.trip.pos : null; if (p) { x.font = `${Z * .38}px serif`; x.fillText('🧑‍🚀', p[1] * Z + Z * .7, p[0] * Z + Z * .7); }
}
function explore(t) {
  const [r, c] = t.pins[selPin], z = t.zones[r][c];
  const cost = zoneCost(z, S.trip ? S.trip.pos : SITES[S.site].base, [r, c]);
  if (S.o2 < cost.o || S.elixir < cost.e) return;
  S.o2 -= cost.o; S.elixir -= cost.e;
  if (!S.trip) S.trip = { pos: SITES[S.site].base, bag: 0 };
  S.trip.pos = [r, c];
  const got = zoneYield(z, r, c);
  S.dep[depKey(r, c)] = (S.dep[depKey(r, c)] || 0) + 1; S.stats.explored++; S.trip.bag += got;
  save(); hud(); drawPins(t); drawPanel(t);
  const fact = LUNAR_FACTS[S.stats.explored % LUNAR_FACTS.length][EN() ? 1 : 0];
  // popup original "BUSCA REALIZADA!" com número e texto dinâmicos
  modalRaw(`<div class="popimg" style="${pos(PANEL)}"><img src="${A(AL('pop_search.webp'))}" alt="${tr('Busca realizada', 'Search done')}">${EN() ? artLabel([150, 26, 'SEARCH DONE!', 18]) : ''}
      <div class="abs lil stroke" style="${pos([210, 101, 54, 30])};display:grid;place-items:center;font-size:24px;background:linear-gradient(#5fe04a,#28a82c);border-radius:14px">+${got}</div>
      <div class="abs speech" style="${pos([24, 140, 246, 74])};border:0;background:#eef4ff;font-size:11px;line-height:1.35;padding:3px 8px;text-align:center;display:flex;align-items:center;justify-content:center"><span>${fact}</span></div>
      <button class="hot" data-close style="${pos([254, 6, 38, 38])}" aria-label="${tr('Fechar', 'Close')}"></button>
      <div class="abs" style="left:10px;top:12px">${sayBtn(tr(`Busca realizada! Mais ${got} sucatas na mochila. ${fact}`, `Search done! ${got} more scrap in the backpack. ${fact}`))}</div></div>`,
    m => m.onclick = e => { if (e.target === m || e.target.closest('.popimg')) { closeModal(); if (S.stats.explored === 1) robot(tr('A sucata fica na <b>mochila</b> até você <b>VOLTAR</b> para a base. Se o oxigênio acabar no caminho, eu te resgato, mas metade da mochila se perde!', 'Scrap stays in your <b>backpack</b> until you go <b>BACK</b> to the base. If oxygen runs out on the way, I’ll rescue you, but half the backpack is lost!')); } });
  if (S.voice) speak(tr(`Mais ${got} sucatas! ${fact}`, `${got} more scrap! ${fact}`));
}
function returnToBase() {
  if (!S.trip) return;
  const need = returnCost(S.trip.pos);
  let bag = S.trip.bag, msg;
  if (S.o2 >= need) msg = tr(`De volta à base! Você trouxe <b>${bag} sucatas</b> e o tanque de oxigênio foi reabastecido. 🫧`, `Back at the base! You brought <b>${bag} scrap</b> and the oxygen tank was refilled. 🫧`);
  else { const lost = Math.ceil(bag / 2); bag -= lost; msg = tr(`O oxigênio não deu para voltar... Eu fui te resgatar! 🤖 Perdemos <b>${lost} sucatas</b> no caminho. Planeje melhor a volta!`, `Oxygen ran out on the way back... I came to rescue you! 🤖 We lost <b>${lost} scrap</b> on the way. Plan your trip back better!`); }
  S.scrap += bag; S.stats.scrapTotal += bag; S.o2 = o2Max(); S.trip = null; selPin = null;
  save(); go('home'); robot(msg);
}

/* ================= melhorias (modal original) ================= */
function costBox(c, keys, btnAttr, can, compact) {
  const ic = { e: 'ic_energy.png', o: 'ic_o2.png', s: 'ic_gear.png' }, have = { e: S.elixir, o: S.o2, s: S.scrap };
  return `<div class="hd">${compact ? tr('CUSTO', 'COST') : tr('CUSTO DA<br>MELHORIA', 'UPGRADE<br>COST')}</div>${keys.map(k => `<div class="row"><img src="${A(ic[k])}" alt=""><span class="v ${have[k] < c[k] ? 'no' : ''}">${c[k]}</span></div>`).join('')}
    <button class="img-btn" ${btnAttr} ${can ? '' : 'disabled'} style="background-image:url(${A(AL('btn_melhorar.png'))})" aria-label="${tr('Melhorar', 'Upgrade')}">${EN() ? '<span class="al dk btn-al">UPGRADE</span>' : ''}</button>`;
}
function openUpgrades() {
  if (S.trip) { toast(tr('🚙 Volte para a base primeiro!', '🚙 Go back to the base first!')); return go('explore'); }
  const M = [15, 62]; // canto do modal na tela
  const at = ([x, y, w, h]) => pos([x, y, w, h]);
  const segs = (n, on, cls, r) => `<div class="levels ${cls}" style="${at(r)}">${Array.from({ length: n }, (_, i) => `<i class="${i < on ? 'on' : ''}"></i>`).join('')}</div>`;
  let h = `<img src="${A(AL('modal_upg.webp'))}" style="width:100%;height:100%;display:block" alt="${tr('Melhorias', 'Upgrades')}">`;
  if (EN()) h += [[146, 49, 'UPGRADES', 21], [112, 118, 'BASE UPGRADE', 11.5, 'l'], [113, 204, 'FARM<br>UPGRADE', 12, 'l'], [113, 304, 'ROCKET<br>REPAIR', 12, 'l'], [250, 151, 'MAX', 10]].map(artLabel).join('');
  // textos pequenos da arte ficam borrados: substituídos por texto nítido (e que diz o efeito real)
  const desc = (r, bg, txt) => `<div class="updesc" style="${at(r)};background:${bg}"><span>${txt}</span></div>`;
  const nextR = S.rocket < 5 ? ROCKET[S.rocket] : null;
  h += desc([40, 66, 222, 26], '#11245f', tr('Melhore sua base e a plantação, e conserte o foguete do Zuno!', 'Upgrade your base and farm, and fix Zuno’s rocket!'));
  h += desc([109, 123, 104, 23], '#1a3157', S.baseLvl < 5 ? `${tr('Tanque de O₂', 'O₂ tank')}: <b>${O2_CAP[S.baseLvl - 1]} → ${O2_CAP[S.baseLvl]}</b>` : tr(`Tanque máximo: <b>${O2_CAP[4]}</b> de O₂`, `Max tank: <b>${O2_CAP[4]}</b> O₂`));
  h += desc([110, 215, 102, 26], '#1e3a7a', tr(['Libera a <b>3ª cúpula</b> e usa menos 💧', 'Libera a <b>4ª cúpula</b> e usa menos 💧', 'Plantas crescem <b>1 dia</b> mais rápido', 'Plantação no <b>nível máximo</b>'],
    ['Unlocks the <b>3rd dome</b> and uses less 💧', 'Unlocks the <b>4th dome</b> and uses less 💧', 'Plants grow <b>1 day</b> faster', 'Farm at <b>max level</b>'])[S.farmLvl - 1]);
  h += desc([110, 316, 100, 27], '#1c3570', nextR ? `${tr('Próxima', 'Next')}: <b>${nextR.name}</b> (${tr({ wires: 'fios', memory: 'memória', pipes: 'canos' }, { wires: 'wires', memory: 'memory', pipes: 'pipes' })[nextR.game]})` : tr('Foguete <b>pronto</b>!', 'Rocket <b>ready</b>!'));
  // base
  h += segs(5, S.baseLvl, 'green', [110, 149, 106, 16]);
  if (S.baseLvl < 5) { const c = scaled(UPG.base.costs[S.baseLvl - 1]); h += `<div class="costbox compact" style="${at([215, 103, 72, 74])}">${costBox(c, ['e', 'o', 's'], 'data-up="base"', canPay(c), true)}</div>`; }
  // plantação
  h += segs(4, S.farmLvl, 'cyan', [110, 246, 86, 16]) + `<div class="lvtxt" style="${at([112, 263, 84, 12])}">${tr('Nível', 'Level')} ${S.farmLvl} / 4</div>`;
  if (S.farmLvl < 4) { const c = scaled(UPG.farm.costs[S.farmLvl - 1]); h += `<div class="costbox" style="${at([212, 190, 72, 84])}">${costBox(c, ['e', 's'], 'data-up="farm"', canPay(c))}</div>`; }
  else h += `<div class="maxbadge" style="${at([218, 196, 62, 64])}${EN() ? `;background-image:url(${A(AL('badge_maximo.png'))})` : ''}">${EN() ? '<span class="al btn-al" style="top:75%;font-size:9.5px">MAX</span>' : ''}</div>`;
  // foguete
  h += segs(5, S.rocket, 'cyan', [110, 351, 92, 16]) + `<div class="lvtxt" style="${at([112, 368, 92, 12])}">${tr('Nível', 'Level')} ${S.rocket} / 5</div>`;
  if (S.rocket < 5) { const c = scaled(ROCKET[S.rocket]); h += `<div class="costbox" style="${at([212, 287, 72, 98])}">${costBox(c, ['e', 'o', 's'], 'data-rocket', canPay(c))}</div>`; }
  h += `<button class="hot" data-close style="${at([264, 12, 38, 36])}" aria-label="${tr('Fechar', 'Close')}"></button>`;
  const t = tr('Melhorias. Toda melhoria precisa de energia, oxigênio e sucata ao mesmo tempo. Se faltar algum, o botão fica bloqueado.', 'Upgrades. Every upgrade needs energy, oxygen and scrap at the same time. If one is missing, the button stays locked.');
  h += `<div class="abs" style="left:10px;top:50px">${sayBtn(t)}</div>`;
  const rocketWarn = S.rocket < 5 && scaled(ROCKET[S.rocket]).o > o2Max();
  modalRaw(`<div class="popimg" style="${pos([M[0], M[1], 300, 418])}">${h}</div>`, m => {
    m.onclick = e => { if (e.target === m) closeModal(); };
    $$('[data-up]', m).forEach(b => b.onclick = () => {
      const key = b.dataset.up, lk = key === 'base' ? 'baseLvl' : 'farmLvl', c = scaled(UPG[key].costs[S[lk] - 1]);
      if (!canPay(c)) return;
      pay(c); S[lk]++; save(); closeModal(); render();
      robot(key === 'base' ? tr(`Base melhorada! Agora o tanque guarda <b>${o2Max()}</b> de oxigênio.`, `Base upgraded! The tank now holds <b>${o2Max()}</b> oxygen.`)
        : tr(`Plantação melhorada! ${slotsOpen() > 2 ? 'Nova cúpula liberada, ' : ''}menos água por planta e colheitas maiores. 🌱`, `Farm upgraded! ${slotsOpen() > 2 ? 'New dome unlocked, ' : ''}less water per plant and bigger harvests. 🌱`));
    });
    const rb = $('[data-rocket]', m);
    if (rb) rb.onclick = () => {
      const st = ROCKET[S.rocket], c = scaled(st);
      if (!canPay(c)) return;
      closeModal();
      startMG(st, () => {
        pay(c); S.rocket++; save();
        if (S.rocket >= 5) { S.phase = 'outro'; save(); current = 'home'; render(); }
        else { go('home'); robot(tr(`Parte consertada: <b>${st.name}</b>! Faltam ${5 - S.rocket}. Zuno está cada vez mais perto de casa! 🚀`, `Part fixed: <b>${st.name}</b>! ${5 - S.rocket} to go. Zuno is getting closer to home! 🚀`)); }
      });
    };
  });
  if (rocketWarn) robot(tr(`A próxima parte do foguete precisa de <b>${scaled(ROCKET[S.rocket]).o}</b> de oxigênio, mas o tanque guarda só <b>${o2Max()}</b>. Melhore a <b>Base</b> primeiro!`, `The next rocket part needs <b>${scaled(ROCKET[S.rocket]).o}</b> oxygen, but the tank only holds <b>${o2Max()}</b>. Upgrade the <b>Base</b> first!`));
}

/* ================= minigames ================= */
function stopMG() { if (mgTimer) { clearInterval(mgTimer); mgTimer = null; } }
function startTimer(sec, rect, onEnd) {
  stopMG();
  let left = Math.round(sec * D().time);
  const draw = () => { const el = $('#timer'); if (el) { el.textContent = `00:${String(left).padStart(2, '0')}`; el.classList.toggle('low', left <= 10); } };
  draw();
  mgTimer = setInterval(() => { left--; draw(); if (left <= 0) { stopMG(); onEnd(); } }, 1000);
}
function startMG(stage, onWin) {
  clearRobot();
  mgScreen = stage.game; current = 'minigame'; render();
  const failTxt = tr('Não tem problema! Os recursos não foram gastos. Quer tentar de novo?', 'No problem! Your resources were not spent. Want to try again?');
  const fail = () => modal(tr('TEMPO ESGOTADO!', 'TIME’S UP!'), `<div class="say-row"><p>${failTxt}</p>${sayBtn(failTxt)}</div>
      <div class="actions"><button class="pill-btn blue" id="quit">${tr('SAIR', 'QUIT')}</button><button class="pill-btn green" id="retry">${tr('TENTAR DE NOVO', 'TRY AGAIN')}</button></div>`, m => {
    $('#retry', m).onclick = () => { closeModal(); startMG(stage, onWin); };
    $('#quit', m).onclick = () => go('home');
  }, { noX: true });
  const win = () => { stopMG(); setTimeout(onWin, 800); };
  if (stage.game === 'wires') wiresGame(stage.n, win, fail);
  else if (stage.game === 'memory') memoryGame(stage.n, win, fail);
  else pipesGame(stage.n, win, fail);
  const quit = $('#mgx'); if (quit) quit.onclick = () => go('home');
}

// ---- canos ----
const N_ = 1, E_ = 2, S_ = 4, W_ = 8;
const rot = m => ((m << 1) | (m >> 3)) & 15;
const rotN = (m, n) => { for (let i = 0; i < ((n % 4) + 4) % 4; i++) m = rot(m); return m; };
function pipeSVG(m) {
  const seg = (x2, y2) => `<line class="pd" x1="50" y1="50" x2="${x2}" y2="${y2}" stroke-width="44" stroke-linecap="round"/>`;
  const body = (x2, y2) => `<line class="pb" x1="50" y1="50" x2="${x2}" y2="${y2}" stroke-width="33" stroke-linecap="round"/>`;
  const hl = (x2, y2) => `<line class="ph" x1="50" y1="50" x2="${x2}" y2="${y2}" stroke-width="8" stroke-linecap="round" transform="translate(-7 -7)"/>`;
  const ring = (x, y, v) => v ? `<rect class="ring" x="${x - 5}" y="${y - 23}" width="10" height="46" rx="3" stroke-width="2.5"/>` : `<rect class="ring" x="${x - 23}" y="${y - 5}" width="46" height="10" rx="3" stroke-width="2.5"/>`;
  const dirs = [[N_, 50, 0, 50, 10, false], [E_, 100, 50, 90, 50, true], [S_, 50, 100, 50, 90, false], [W_, 0, 50, 10, 50, true]].filter(d => m & d[0]);
  return `<svg viewBox="0 0 100 100">${dirs.map(d => seg(d[1], d[2])).join('')}${dirs.map(d => body(d[1], d[2])).join('')}${dirs.map(d => hl(d[1], d[2])).join('')}${dirs.map(d => ring(d[3], d[4], d[5])).join('')}</svg>`;
}
function pipesGame(n, onWin, onFail) {
  const r0 = rnd(0, n - 1), r1 = rnd(0, n - 1);
  let path = null;
  for (let tries = 0; tries < 60 && !path; tries++) {
    const seen = new Set([r0 * n]), stack = [[r0, 0]];
    const dfs = (r, c) => {
      if (r === r1 && c === n - 1) return true;
      for (const [dr, dc] of shuffle([[0, 1], [1, 0], [-1, 0], [0, -1], [0, 1]])) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= n || nc >= n || seen.has(nr * n + nc)) continue;
        seen.add(nr * n + nc); stack.push([nr, nc]);
        if (stack.length < n * 3 && dfs(nr, nc)) return true;
        stack.pop();
      }
      return false;
    };
    if (dfs(r0, 0)) path = stack;
  }
  if (!path) { path = []; for (let c = 0; c < n; c++) path.push([r0, c]); for (let r = r0; r !== r1;) { r += r1 > r0 ? 1 : -1; path.push([r, n - 1]); } }
  const base = Array.from({ length: n }, () => Array(n).fill(0));
  const opp = { [N_]: S_, [S_]: N_, [E_]: W_, [W_]: E_ };
  const bit = (a, b) => b[0] < a[0] ? N_ : b[0] > a[0] ? S_ : b[1] > a[1] ? E_ : W_;
  base[r0][0] |= W_; base[r1][n - 1] |= E_;
  for (let i = 0; i < path.length - 1; i++) { const b = bit(path[i], path[i + 1]); base[path[i][0]][path[i][1]] |= b; base[path[i + 1][0]][path[i + 1][1]] |= opp[b]; }
  const filler = [N_ | S_, N_ | E_, N_ | E_ | S_, N_ | E_];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (!base[r][c]) base[r][c] = filler[rnd(0, 3)];
  const turns = Array.from({ length: n }, () => Array.from({ length: n }, () => rnd(0, 3)));
  const mask = (r, c) => rotN(base[r][c], turns[r][c]);
  const BOARD = [30, 202, 272, 256], ts = Math.floor(Math.min(BOARD[2] / (n + 2), BOARD[3] / n));
  let cells = '';
  for (let r = 0; r < n; r++) {
    cells += `<div class="tile end">${r === r0 ? `<img src="${A('pipe_tank.png')}" alt="${tr('Água', 'Water')}">` : ''}</div>`;
    for (let c = 0; c < n; c++) cells += `<button class="tile" data-r="${r}" data-c="${c}">${pipeSVG(base[r][c])}</button>`;
    cells += `<div class="tile end">${r === r1 ? `<img src="${A('pipe_res.png')}" alt="${tr('Reservatório', 'Reservoir')}">` : ''}</div>`;
  }
  const t = tr('Conecte os canos e leve a água até o reservatório! Toque nos canos para girar.', 'Connect the pipes and bring the water to the reservoir! Tap the pipes to turn them.');
  layer(`<div class="board" style="${pos(BOARD)};grid-template-columns:repeat(${n + 2},${ts}px);grid-auto-rows:${ts}px;background-size:${ts}px ${ts}px">${cells}</div>
    <div class="timer-ov" id="timer" style="${pos([150, 178, 64, 22])}"></div>
    <button class="hot" id="mgx" style="${pos([285, 62, 43, 40])};border-radius:50%" aria-label="${tr('Sair', 'Quit')}"></button>
    <div class="abs" style="left:8px;top:150px">${sayBtn(t)}</div>`);
  const tiles = {};
  $$('.tile[data-r]').forEach(b => {
    const r = +b.dataset.r, c = +b.dataset.c; tiles[r + ',' + c] = b;
    const s = () => b.querySelector('svg').style.transform = `rotate(${turns[r][c] * 90}deg)`; s();
    b.onclick = () => { if (!mgTimer) return; turns[r][c]++; s(); check(); };
  });
  const flow = () => {
    const wet = new Set(); let done = false;
    if (mask(r0, 0) & W_) {
      const q = [[r0, 0]]; wet.add(r0 + ',0');
      while (q.length) {
        const [r, c] = q.shift(), m = mask(r, c);
        if (r === r1 && c === n - 1 && (m & E_)) done = true;
        for (const [b, dr, dc] of [[N_, -1, 0], [E_, 0, 1], [S_, 1, 0], [W_, 0, -1]]) {
          if (!(m & b)) continue;
          const nr = r + dr, nc = c + dc, k = nr + ',' + nc;
          if (nr < 0 || nc < 0 || nr >= n || nc >= n || wet.has(k)) continue;
          if (mask(nr, nc) & opp[b]) { wet.add(k); q.push([nr, nc]); }
        }
      }
    }
    return { wet, done };
  };
  const check = () => {
    const { wet, done } = flow();
    Object.entries(tiles).forEach(([k, b]) => b.classList.toggle('wet', wet.has(k)));
    if (done) { toast(tr('💧 A água chegou ao reservatório!', '💧 The water reached the reservoir!')); onWin(); }
  };
  for (let i = 0; i < 8 && flow().done; i++) { const [r, c] = path[rnd(0, path.length - 1)]; turns[r][c]++; tiles[r + ',' + c].querySelector('svg').style.transform = `rotate(${turns[r][c] * 90}deg)`; }
  check();
  startTimer(n > 5 ? 60 : 45, null, onFail);
  if (S.voice) speak(t);
}

// ---- fios ----
const SYM = [ // l = sprite da esquerda, r = sprite da direita (recortados da tela original)
  { name: 'raio', color: '#ffd21f', dark: '#9a6a00', l: 0, r: 3 },
  { name: 'folha', color: '#3fd44a', dark: '#14702a', l: 1, r: 1 },
  { name: 'gota', color: '#1e9bff', dark: '#0b4a9a', l: 2, r: 4 },
  { name: 'engrenagem', color: '#9b4dff', dark: '#4a1a9a', l: 3, r: 0 },
  { name: 'antena', color: '#ff3b4e', dark: '#8a0f20', l: 4, r: 2 }
];
function wiresGame(n, onWin, onFail) {
  const ids = shuffle([0, 1, 2, 3, 4]).slice(0, n);
  const left = shuffle([...ids]), right = shuffle([...ids]);
  const B = [18, 200, 294, 238], rowH = B[3] / n;
  const yOf = i => (i + .5) * rowH;
  const LX = 1, RX = B[2] - 65;
  const t = tr('Conecte os fios que têm o mesmo símbolo para reativar o foguete! Toque num símbolo da esquerda e depois no igual da direita.', 'Connect the wires with the same symbol to restart the rocket! Tap a symbol on the left, then the matching one on the right.');
  layer(`<div class="wboard" id="wb" style="${pos(B)}"><svg class="lines" id="lines" viewBox="0 0 ${B[2]} ${B[3]}"></svg>
      ${left.map((s, i) => `<button class="wnode" data-side="L" data-s="${s}" style="left:${LX}px;top:${yOf(i) - 23}px"><img src="${A(`node_l${SYM[s].l}.png`)}" alt="${SYM[s].name}"></button>`).join('')}
      ${right.map((s, i) => `<button class="wnode" data-side="R" data-s="${s}" style="left:${RX}px;top:${yOf(i) - 23}px"><img src="${A(`node_r${SYM[s].r}.png`)}" alt="${SYM[s].name}"></button>`).join('')}
    </div>
    <div class="timer-ov" id="timer" style="${pos([150, 166, 64, 22])}"></div>
    <button class="hot" id="mgx" style="${pos([290, 60, 38, 36])};border-radius:50%" aria-label="${tr('Sair', 'Quit')}"></button>
    <div class="abs" style="left:8px;top:140px">${sayBtn(t)}</div>`);
  const lines = $('#lines'), done = new Set(), wb = $('#wb');
  let sel = null, temp = '';
  const endL = b => [parseFloat(b.style.left) + 62, parseFloat(b.style.top) + 23];
  const endR = b => [parseFloat(b.style.left) + 3, parseFloat(b.style.top) + 23];
  const curve = (a, b, s, w = 1) => {
    const mx = (a[0] + b[0]) / 2, d = `M${a[0]} ${a[1]} C${mx} ${a[1]} ${mx} ${b[1]} ${b[0]} ${b[1]}`;
    return `<path d="${d}" stroke="${SYM[s].dark}" stroke-width="${12 * w}" fill="none" stroke-linecap="round"/><path d="${d}" stroke="${SYM[s].color}" stroke-width="${8 * w}" fill="none" stroke-linecap="round"/><path d="${d}" stroke="rgba(255,255,255,.55)" stroke-width="${2.5 * w}" fill="none" stroke-linecap="round" transform="translate(0 -2)"/>`;
  };
  const redraw = () => { lines.innerHTML = [...done].map(s => curve(endL($(`.wnode[data-side=L][data-s="${s}"]`)), endR($(`.wnode[data-side=R][data-s="${s}"]`)), s)).join('') + temp; };
  const tryConnect = rb => {
    if (!sel || !rb || rb.dataset.side !== 'R' || done.has(+rb.dataset.s)) return;
    if (rb.dataset.s === sel.dataset.s) { done.add(+sel.dataset.s); sel.classList.add('done'); rb.classList.add('done'); }
    else { rb.classList.remove('bad'); void rb.offsetWidth; rb.classList.add('bad'); toast(tr('❌ Símbolo diferente!', '❌ Different symbol!')); }
    sel.classList.remove('sel'); sel = null; temp = ''; redraw();
    if (done.size === n) { toast(tr('⚡ Foguete reativado!', '⚡ Rocket restarted!')); onWin(); }
  };
  wb.addEventListener('pointerdown', e => {
    if (!mgTimer) return;
    const b = e.target.closest('.wnode'); if (!b) return;
    if (b.dataset.side === 'L' && !done.has(+b.dataset.s)) { if (sel) sel.classList.remove('sel'); sel = b; b.classList.add('sel'); }
    else if (b.dataset.side === 'R') tryConnect(b);
  });
  wb.addEventListener('pointermove', e => {
    if (!sel || !e.buttons) return;
    const r = wb.getBoundingClientRect(), k = B[2] / r.width;
    temp = curve(endL(sel), [(e.clientX - r.left) * k, (e.clientY - r.top) * k], +sel.dataset.s, .7); redraw();
  });
  wb.addEventListener('pointerup', e => {
    const el = document.elementFromPoint(e.clientX, e.clientY), b = el && el.closest('.wnode');
    if (sel && b && b.dataset.side === 'R') tryConnect(b); else { temp = ''; redraw(); }
  });
  startTimer(n > 4 ? 50 : 40, null, onFail);
  if (S.voice) speak(t);
}

// ---- jogo da memória: encontre os pares de equipamentos ----
const MEM_ITEMS = [
  { k: 'capacete', pt: 'Capacete', en: 'Helmet' }, { k: 'chave', pt: 'Chave inglesa', en: 'Wrench' }, { k: 'oxigenio', pt: 'Tanque de oxigênio', en: 'Oxygen tank' },
  { k: 'antena', pt: 'Antena', en: 'Antenna' }, { k: 'luva', pt: 'Luva espacial', en: 'Space glove' }, { k: 'bateria', pt: 'Bateria', en: 'Battery', svg: true }
].map(it => ({ ...it, get name() { return it[LANG]; } }));
function memoryGame(pairs, onWin, onFail) {
  const items = MEM_ITEMS.slice(0, pairs);
  const deck = shuffle([...items, ...items].map(it => ({ ...it })));
  const B = [18, 196, 294, 238], cols = 4, rows = Math.ceil(deck.length / cols), gap = 7, pad = 9;
  const cw = (B[2] - pad * 2 - gap * (cols - 1)) / cols, ch = Math.min(cw * 0.92, (B[3] - pad * 2 - gap * (rows - 1)) / rows);
  const top = (B[3] - (ch * rows + gap * (rows - 1))) / 2;
  const face = it => it.svg
    ? `<img src="${A('mem_blank.png')}" alt=""><div class="mem-icon">${ART[it.k]()}</div>`
    : `<img src="${A('mem_' + it.k + '.png')}" alt="${it.name}">`;
  const t = tr('Jogo da memória! Encontre os pares de itens para coletar os equipamentos do conserto. Toque em duas cartas.', 'Memory game! Find the matching pairs to collect the repair equipment. Tap two cards.');
  layer(`<div class="updesc mem-sub" style="${pos([60, 125, 210, 25])}"><span>${tr('<b>Jogo da Memória:</b> encontre os pares de itens para coletar os equipamentos!', '<b>Memory Game:</b> find the matching pairs to collect the equipment!')}</span></div>
    <div class="timer-ov" id="timer" style="${pos([150, 166, 64, 22])}"></div>
    <div class="mem-pairs" id="memPairs" style="${pos([224, 165, 76, 24])}">${tr('Pares', 'Pairs')}: <b>0/${pairs}</b></div>
    <div class="mem-board" style="${pos(B)}">${deck.map((it, i) => `<button class="mem-card" data-i="${i}" aria-label="${tr('Carta', 'Card')}" style="${pos([pad + (i % cols) * (cw + gap), top + Math.floor(i / cols) * (ch + gap), cw, ch])}">
      <div class="mem-inner"><div class="mem-face mem-back"><img src="${A('mem_back.png')}" alt=""></div><div class="mem-face mem-front">${face(it)}</div></div></button>`).join('')}</div>
    <div class="mem-speech" style="${pos([152, 466, 156, 46])}"><span>${tr('Encontre todos os pares e receba os equipamentos para consertar o foguete!', 'Find all the pairs and get the equipment to fix the rocket!')}</span></div>
    <button class="hot" id="mgx" style="${pos([290, 60, 38, 36])};border-radius:50%" aria-label="${tr('Sair', 'Quit')}"></button>
    <div class="abs" style="left:8px;top:140px">${sayBtn(t)}</div>`);
  let open = [], found = 0, busy = false;
  const cards = $$('.mem-card');
  cards.forEach(c => c.onclick = () => {
    if (!mgTimer || busy || c.classList.contains('flip') || c.classList.contains('done')) return;
    c.classList.add('flip'); open.push(c);
    if (open.length < 2) return;
    const [a, b] = open; open = [];
    const ia = deck[+a.dataset.i], ib = deck[+b.dataset.i];
    if (ia.k === ib.k) {
      found++; a.classList.add('done'); b.classList.add('done');
      $('#memPairs').innerHTML = `${tr('Pares', 'Pairs')}: <b>${found}/${pairs}</b>`;
      toast(`✔ ${ia.name}!`);
      if (found === pairs) { toast(tr('🧰 Equipamentos coletados!', '🧰 Equipment collected!')); onWin(); }
    } else {
      busy = true;
      setTimeout(() => { a.classList.remove('flip'); b.classList.remove('flip'); busy = false; }, 800);
    }
  });
  startTimer(pairs > 5 ? 60 : 45, null, onFail);
  if (S.voice) speak(t);
}

/* ================= dormir ================= */
const sleepGain = () => Math.round((S.fedToday ? 30 : 15) * D().sleep);
function renderSleep() {
  const t = tr(`Descansar recupera ${sleepGain()} de energia, enche o oxigênio e avança 1 dia. As plantas crescem durante a noite!`, `Resting restores ${sleepGain()} energy, refills oxygen and moves ahead 1 day. Plants grow during the night!`);
  layer(`<button class="hot" id="sleepGo" style="${pos([70, 388, 188, 44])};border-radius:22px" aria-label="${tr('Dormir', 'Sleep')}"></button>
    <div class="abs" style="left:286px;top:345px">${sayBtn(t + (S.fedToday ? '' : tr(' Dica: colha uma planta antes de dormir, assim o Zuno recupera mais energia!', ' Tip: harvest a plant before sleeping so Zuno gets more energy back!')))}</div>`);
  $('#sleepGo').onclick = doSleep;
}
async function doSleep() {
  const gain = sleepGain(), f = $('#fade');
  f.textContent = '🌙 Z z z...'; f.classList.add('on');
  await wait(1200);
  S.day++;
  let grown = 0;
  S.plots.forEach(p => { if (p.crop && p.left > 0) { p.left--; grown++; } });
  S.elixir = Math.min(100, S.elixir + gain); S.o2 = o2Max(); S.fedToday = false;
  Object.keys(S.dep).forEach(k => { S.dep[k] = Math.max(0, S.dep[k] - 1); if (!S.dep[k]) delete S.dep[k]; });
  save();
  f.textContent = `☀️ ${tr('Dia', 'Day')} ${S.day}`;
  await wait(1000);
  f.classList.remove('on');
  go('home');
  const ready = S.plots.filter(p => p.crop && p.left <= 0).length;
  robot(tr(`Bom dia! Zuno recuperou <b>${gain}</b> de energia e o oxigênio foi reabastecido.${grown ? ` 🌱 ${grown} planta(s) cresceram.` : ''}${ready ? ` <b>${ready}</b> pronta(s) para colher!` : ''}`,
    `Good morning! Zuno got <b>${gain}</b> energy back and the oxygen was refilled.${grown ? ` 🌱 ${grown} plant(s) grew.` : ''}${ready ? ` <b>${ready}</b> ready to harvest!` : ''}`));
}

/* ================= final ================= */
function renderEnd() {
  const t = tr(`Missão cumprida! Você consertou o foguete em ${S.day} dias e o Zuno voltou para a família dele. Obrigado, astronauta! Quem sabe um dia você vai para o espaço de verdade!`,
    `Mission complete! You fixed the rocket in ${S.day} days and Zuno went back to his family. Thank you, astronaut! Maybe one day you’ll go to space for real!`);
  layer(`<div class="story" style="gap:8px;padding-top:22px">
    <div class="logo" style="font-size:30px;text-align:center;line-height:1.1">${tr('MISSÃO<br>CUMPRIDA!', 'MISSION<br>COMPLETE!')}</div>
    <div class="scene" style="height:190px"><img src="${A('moon_scene.png')}" style="left:-15px;top:-10px;width:330px;height:210px;object-fit:cover" alt="">
      <img id="rk" src="${A('rocket.png')}" style="left:110px;top:20px;width:110px" alt="${tr('Foguete', 'Rocket')}"></div>
    <div class="story-text glass" style="padding:8px 10px;font-size:13px"><p style="flex:1">${t}</p>${sayBtn(t)}</div>
    <table class="dtab" style="font-size:12px"><tr><td>${tr('Dias na Lua', 'Days on the Moon')}</td><td>${S.day}</td></tr><tr><td>${tr('Expedições', 'Expeditions')}</td><td>${S.stats.explored}</td></tr><tr><td>${tr('Colheitas', 'Harvests')}</td><td>${S.stats.harvested}</td></tr><tr><td>${tr('Sucata coletada', 'Scrap collected')}</td><td>${S.stats.scrapTotal}</td></tr></table>
    <button class="pill-btn green" id="again">🔄 ${tr('JOGAR DE NOVO', 'PLAY AGAIN')}</button></div>`);
  setTimeout(() => { const r = $('#rk'); if (r) r.classList.add('fly'); }, 900);
  for (let i = 0; i < 22; i++) { const c = document.createElement('div'); c.className = 'confetti'; c.textContent = ['⭐', '✨', '🎉', '💚'][i % 4]; c.style.left = rnd(0, 310) + 'px'; c.style.animationDelay = (i * .12) + 's'; $('#layer').appendChild(c); }
  if (S.voice) speak(t);
  $('#again').onclick = newGame;
}

/* ================= dados NASA ================= */
const statusTag = s => ({ live: `<span class="status live">${tr('AO VIVO', 'LIVE')}</span>`, cache: '<span class="status cache">CACHE</span>', off: '<span class="status off">OFFLINE</span>', load: `<span class="status load">${tr('carregando', 'loading')}</span>` }[s] || '');
function openNasa() {
  const o = NASA.osdr, s = SITES[S.site], ND = noData();
  const t = tr('Estes são os dados reais da NASA usados no jogo: o estudo de plantas OSD-895 e o relevo da Lua medido pela sonda LRO.', 'This is the real NASA data used in the game: the OSD-895 plant study and the Moon’s terrain measured by the LRO probe.');
  const src = o.source;
  const val = (f, u) => f && f.value != null ? `${f.value} ${esc(f.unit || u || '')}` : `<i>${ND}</i>`;
  const rng = f => f && f.min != null ? `${f.min}–${f.max} ${esc(f.unit || '')}` : `<i>${esc((f && f.missing && !EN()) ? f.missing : ND)}</i>`;
  const side = areaSide();
  const crops = Object.keys(CROPS).map(k => {
    const c = CROPS[k], r = c.sci895, est = estimateKg(r, side * side);
    if (!r) return `<tr><td>${c.name}</td><td><i>${ND}</i></td></tr>`;
    return `<tr><td>${c.name}<br><small>${esc(r.sampleName)}</small></td><td>
      ${tr('Colheita', 'Harvest')}: <b>${r.harvestType === 'spread' ? tr('repetida (spread)', 'repeated (spread)') : tr('única (batch)', 'single (batch)')}</b> · ${tr('ciclos avaliados', 'cycles evaluated')}: ${r.cyclesEvaluated ?? '—'}<br>
      Age At Sample Harvest: <b>${val(r.age)}</b>${r.harvestType === 'spread' ? ` <small>${tr('(duração total do cultivo, não o tempo até a 1ª colheita)', '(total growing time, not the time to the 1st harvest)')}</small>` : ''}<br>
      Mean Edible Freshweight: <b>${val(r.meanEdibleFreshweight)}</b><br>
      Edible Freshweight Range: ${rng(r.edibleFreshweightRange)}<br>
      ${tr('Estimativa', 'Estimate')} ${side}×${side} m (${side * side} m²): ${est ? `<b>${est.kg.toFixed(2)} kg</b>${est.min != null ? ` (${tr('faixa', 'range')} ${est.min.toFixed(2)}–${est.max.toFixed(2)} kg)` : ''}` : `<i>${ND}</i>`}</td></tr>`;
  }).join('');
  modal(tr('DADOS DA NASA', 'NASA DATA'), `<div class="say-row"><p style="font-size:12px">${t}</p>${sayBtn(t)}</div>
    <h3 class="sec">🌱 NASA OSDR OSD-895 ${statusTag(o.status)}</h3>
    <p style="font-size:10.5px;margin:2px 0 4px">${tr('Estufa EDEN ISS, na <b>Antártida (Terra)</b>, 2018. Não são plantas cultivadas na Lua.', 'EDEN ISS greenhouse, in <b>Antarctica (Earth)</b>, 2018. These plants were not grown on the Moon.')}</p>
    <table class="dtab">${crops}
      <tr><td>${tr('Fórmula', 'Formula')}</td><td>${tr('produção estimada (kg) = Mean Edible Freshweight (kg/m²) × área plantada (m²)', 'estimated yield (kg) = Mean Edible Freshweight (kg/m²) × planted area (m²)')}</td></tr>
      <tr><td>${tr('Campos usados', 'Fields used')}</td><td>s_OSD-895.txt: Characteristics[cultivar], Parameter Value[Harvest Type] · a_OSD-895_*.txt: Parameter Value[Age At Sample Harvest], [Mean Edible Freshweight], [Edible Freshweight Range], ${tr('unidos por Sample Name', 'joined by Sample Name')}</td></tr>
      <tr><td>${tr('Arquivo', 'File')}</td><td>${src ? `<a href="${esc(src.zipUrl)}" target="_blank" rel="noopener">${esc(src.zipFile)}</a><br><small>${tr('lista', 'list')}: ${esc(src.filesApi)}<br>${tr('obtido em', 'fetched on')} ${new Date(src.fetchedAt).toLocaleString(LOC())}</small>` : `<i>${ND}</i>`}</td></tr>
      <tr><td>${tr('No jogo', 'In the game')}</td><td>${tr('dias de jogo, água e energia são <b>balanceamento do jogo</b>, separados do estudo. A barra da cúpula conta dias de jogo, não mede a planta.', 'game days, water and energy are <b>game balance</b>, kept apart from the study. The dome bar counts game days; it does not measure the plant.')}</td></tr>
    </table>
    <h3 class="sec">🌕 LRO / LOLA ${statusTag(NASA.lro.status)}</h3>
    <table class="dtab">
      <tr><td>${tr('Região', 'Region')}</td><td>${s.name} (${s.lat}, ${s.lon})</td></tr>
      <tr><td>${tr('Camadas', 'Layers')}</td><td>LRO_LOLA_DEM_Global_128ppd_v04 (${tr('elevação', 'elevation')}) ${tr('e', 'and')} LRO_LOLA_ClrShade (${tr('relevo', 'shaded relief')})</td></tr>
      <tr><td>${tr('No jogo', 'In the game')}</td><td>${tr('altitude e inclinação de cada local → custo de oxigênio e quantidade de sucata', 'altitude and slope of each place → oxygen cost and amount of scrap')}</td></tr>
      <tr><td>${tr('Fonte', 'Source')}</td><td><a href="https://trek.nasa.gov/moon/" target="_blank" rel="noopener">NASA Moon Trek</a></td></tr>
    </table>`);
}

/* ================= controle parental ================= */
function parentalGate(next) {
  const a = rnd(6, 9), b = rnd(6, 9);
  modal(tr('ÁREA DOS PAIS', 'PARENTS’ AREA'), `<p style="text-align:center">${tr('Para continuar, responda', 'To continue, answer')}: <b>${a} × ${b} = ?</b></p>
    <div class="gate" style="margin-top:8px"><input id="gateIn" type="number" inputmode="numeric" autocomplete="off"></div>
    <div class="actions"><button class="pill-btn green" id="gateOk">${tr('ENTRAR', 'ENTER')}</button></div>`, m => {
    const ok = () => { if (+$('#gateIn', m).value === a * b) { closeModal(); next(); } else toast(tr('Resposta incorreta', 'Wrong answer')); };
    $('#gateOk', m).onclick = ok; $('#gateIn', m).onkeydown = e => { if (e.key === 'Enter') ok(); }; $('#gateIn', m).focus();
  });
}
function openSettings() {
  const p = S.parental;
  modal(tr('MODO SUPERVISÃO', 'PARENT MODE'), `
    <div class="set-row"><span>${tr('Limite diário de tela', 'Daily screen limit')}</span><select id="lim">${[0, 15, 30, 45, 60, 90].map(v => `<option value="${v}" ${v === p.limitMin ? 'selected' : ''}>${v ? v + ' min' : tr('Sem limite', 'No limit')}</option>`).join('')}</select></div>
    <div class="set-row"><span>${tr('Tempo jogado hoje', 'Played today')}</span><b>${Math.floor(p.usedSec / 60)} min</b></div>
    <div class="set-row"><span>${tr('Idade da criança', 'Child’s age')}</span><select id="age">${[7, 8, 9, 10, 11, 12].map(v => `<option ${v === S.age ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    <div class="set-row"><span>${tr('Narração do robô', 'Robot narration')}</span><select id="voice"><option value="1" ${S.voice ? 'selected' : ''}>${tr('Ligada', 'On')}</option><option value="0" ${S.voice ? '' : 'selected'}>${tr('Desligada', 'Off')}</option></select></div>
    <div class="set-row"><span>${tr('Idioma', 'Language')}</span><select id="langSel"><option value="pt" ${EN() ? '' : 'selected'}>Português</option><option value="en" ${EN() ? 'selected' : ''}>English</option></select></div>
    <div class="actions"><button class="pill-btn red small" id="reset">🗑️ ${tr('REINICIAR', 'RESTART')}</button><button class="pill-btn green" data-close>${tr('SALVAR', 'SAVE')}</button></div>`, m => {
    $('#lim', m).onchange = e => { p.limitMin = +e.target.value; save(); };
    $('#age', m).onchange = e => { S.age = +e.target.value; S.diff = ageToDiff(S.age); S.o2 = Math.min(S.o2, o2Max()); save(); hud(); toast(tr('Nível: ', 'Level: ') + D().name); };
    $('#voice', m).onchange = e => { S.voice = e.target.value === '1'; save(); };
    $('#langSel', m).onchange = e => { setLang(e.target.value); openSettings(); };
    // confirmação dentro do jogo (o confirm() nativo é bloqueado em alguns navegadores)
    const resetTxt = tr('Apagar todo o progresso e começar um jogo novo? Isso não pode ser desfeito.', 'Erase all progress and start a new game? This cannot be undone.');
    $('#reset', m).onclick = () => modal(tr('REINICIAR?', 'RESTART?'), `<div class="say-row"><p style="text-align:center">${resetTxt}</p>${sayBtn(resetTxt)}</div>
      <div class="actions"><button class="pill-btn blue" data-close>${tr('CANCELAR', 'CANCEL')}</button><button class="pill-btn red" id="resetYes">${tr('SIM, REINICIAR', 'YES, RESTART')}</button></div>`,
      m2 => { $('#resetYes', m2).onclick = newGame; }, { noX: true });
  });
}
function checkLimit() {
  const p = S.parental;
  if (p.date !== today()) { p.date = today(); p.usedSec = 0; }
  const over = p.limitMin > 0 && p.usedSec >= p.limitMin * 60;
  if (over && !$('#lock')) {
    stopMG();
    const t = tr('Hora de descansar! O Zuno também precisa dormir. Volte amanhã para continuar a missão.', 'Time to rest! Zuno needs to sleep too. Come back tomorrow to continue the mission.');
    const lock = document.createElement('div'); lock.id = 'lock'; lock.className = 'lock';
    lock.innerHTML = `<img src="${A('zuno_sleep.png')}" style="width:240px;border-radius:18px" alt=""><div class="logo" style="font-size:24px">${tr('HORA DE DESCANSAR', 'TIME TO REST')}</div>
      <div class="story-text glass" style="padding:8px 10px"><p style="flex:1">${t}</p>${sayBtn(t)}</div><button class="pill-btn blue small" id="unlock">${tr('Área dos pais', 'Parents’ area')}</button>`;
    $('#screen').appendChild(lock);
    if (S.voice) speak(t);
    $('#unlock').onclick = () => parentalGate(() => { p.limitMin = 0; save(); lock.remove(); toast(tr('Limite removido para hoje', 'Limit removed for today')); });
  }
  return over;
}

/* ================= relógio ================= */
setInterval(() => {
  if (document.hidden || S.phase !== 'play') return;
  S.parental.usedSec++;
  if (checkLimit()) return;
  if (current === 'minigame' || !$('#modal').classList.contains('hidden')) return;
  if (++S.drainAcc >= D().drainSec) {
    S.drainAcc = 0;
    if (S.elixir > 0) { S.elixir = Math.max(0, S.elixir - 1); hud(); if (current === 'home' && (S.elixir === 29 || S.elixir === 0)) render(); }
  }
  if (S.parental.usedSec % 10 === 0) save();
}, 1000);

/* ================= início ================= */
// Celular: sem moldura, jogo ocupando a largura toda, centralizado; a sobra em cima/embaixo
// mostra a própria arte da tela desfocada (nada é esticado). Computador: mockup do aparelho.
const MOBILE_UA = (navigator.userAgentData && navigator.userAgentData.mobile) || /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(navigator.userAgent);
// Sem mockup: o jogo sempre ocupa a tela (celular ou computador).
const isMobile = () => true;
const isPhone = () => MOBILE_UA || matchMedia('(pointer: coarse)').matches;
function safeInsets() {
  const p = $('#safe'), cs = getComputedStyle(p);
  return { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
}
function fit() {
  const vv = window.visualViewport, W = vv ? vv.width : window.innerWidth, H = vv ? vv.height : window.innerHeight;
  const dev = $('#device'), mobile = isMobile();
  document.body.classList.toggle('mobile', mobile);
  if (mobile) {
    const i = safeInsets(), aw = W - i.l - i.r, ah = H - i.t - i.b;
    const k = Math.min(aw / 330, ah / 540);
    dev.style.left = (i.l + aw / 2) + 'px'; dev.style.top = (i.t + ah / 2) + 'px';
    dev.style.transform = `translate(-50%, -50%) scale(${k})`;
  } else {
    const k = Math.min(W / 380, H / 630, 1.6);
    dev.style.left = '50%'; dev.style.top = '50%';
    dev.style.transform = `translate(-50%, -50%) scale(${k})`;
  }
  positionVid();
}
function positionVid() {
  const box = $('#vidlayer');
  if (!box || box.classList.contains('hidden')) return;
  if (document.body.classList.contains('mobile')) { box.style.cssText = ''; return; }
  const r = $('#screen').getBoundingClientRect();
  box.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;border-radius:${26 * r.width / 330}px`;
}
function setBackdrop(cfg) {
  const b = $('#backdrop');
  b.style.backgroundImage = cfg ? `url(${A(AL(cfg.bg))})` : 'none';
}
window.addEventListener('resize', fit);
if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);
window.addEventListener('orientationchange', () => setTimeout(fit, 300));
// no celular, entra em tela cheia no primeiro toque (Android/Chrome; no iPhone use "Adicionar à Tela de Início")
document.addEventListener('pointerdown', () => {
  const el = document.documentElement;
  if (!isPhone() || document.fullscreenElement || !el.requestFullscreen) return;
  el.requestFullscreen({ navigationUI: 'hide' }).then(() => setTimeout(fit, 200)).catch(() => {});
}, { passive: true });
load(); buildCrops(); fit(); render(); checkLimit(); loadOSDR();
loadTerrain(S.site).then(() => { if (current === 'explore') render(); });
