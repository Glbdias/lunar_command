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

/* ================= narração ================= */
function speak(text) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const clean = strip(text).replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, '').replace(/\s+/g, ' ').trim();
  if (!clean) return;
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = 'pt-BR';
  const vs = speechSynthesis.getVoices();
  const v = vs.find(v => /pt[-_]BR/i.test(v.lang)) || vs.find(v => /^pt/i.test(v.lang));
  if (v) u.voice = v;
  u.pitch = 1.1;
  speechSynthesis.speak(u);
}
const sayBtn = t => `<button class="say" data-say="${esc(strip(t))}" aria-label="Ouvir">🔊</button>`;
document.addEventListener('click', e => { const b = e.target.closest('[data-say]'); if (b) { e.stopPropagation(); speak(b.dataset.say); } }, true);

/* ================= dificuldade ================= */
const DIFFS = [
  { name: 'Iniciante', cost: .7, drainSec: 75, grow: .75, move: .75, time: 1.4, sleep: 1.2 },
  { name: 'Intermediário', cost: 1, drainSec: 50, grow: 1, move: 1, time: 1, sleep: 1 },
  { name: 'Avançado', cost: 1.3, drainSec: 32, grow: 1.2, move: 1.25, time: .8, sleep: .8 }
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
  { name: 'Tanque de combustível', game: 'pipes', n: 5, e: 30, o: 40, s: 12 },
  { name: 'Fiação do painel', game: 'wires', n: 4, e: 40, o: 60, s: 20 },
  { name: 'Bomba de água', game: 'pipes', n: 5, e: 50, o: 80, s: 28 },
  { name: 'Computador de bordo', game: 'wires', n: 5, e: 55, o: 110, s: 36 },
  { name: 'Motor principal', game: 'pipes', n: 6, e: 60, o: 130, s: 45 }
];
const scaled = c => ({ e: Math.ceil((c.e || 0) * D().cost), o: Math.ceil((c.o || 0) * D().cost), s: Math.ceil((c.s || 0) * D().cost) });
const canPay = c => S.elixir >= c.e && S.o2 >= c.o && S.scrap >= c.s;
const pay = c => { S.elixir -= c.e; S.o2 -= c.o; S.scrap -= c.s; };

/* ================= NASA OSDR (plantação) ================= */
const OSDR_FALLBACK = {
  status: 'off', radishKg: 8, lettuceKg: 56, cucumberKg: 67, totalKg: 268, seasonDays: 286,
  photoperiod: 17, light: 330, radishLight: 600, radishDays: 14, lettuceDays: 18, cucumberSpread: true,
  title895: 'Biomass Production of the EDEN ISS Space Greenhouse in Antarctica During the 2018 Experiment Phase',
  title883: 'Analysis of Vegetable Seedlings Grown in Contact with Apollo 14 Lunar Surface Fines'
};
const NASA = { osdr: { ...OSDR_FALLBACK, status: 'load' }, lro: { status: 'load' } };
const CUCUMBER_DAYS_REF = 42; // estimativa (não consta nos estudos usados)

async function apiJSON(id) {
  const r = await fetch(IS_FILE ? `https://osdr.nasa.gov/osdr/data/osd/meta/${id}` : `/api/osdr/${id}`);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return { json: await r.json(), src: r.headers.get('X-Data-Source') || 'live' };
}
async function loadOSDR() {
  try {
    const [a, b] = await Promise.all([apiJSON(895), apiJSON(883)]);
    const study = j => Object.values(j.study)[0].studies[0];
    const s895 = study(a.json), s883 = study(b.json);
    const num = (re, txt, def) => { const m = String(txt).match(re); return m ? +m[1] : def; };
    const d = s895.description || '';
    const p895 = (s895.protocols || []).map(p => p.description).join(' ');
    const p883 = (s883.protocols || []).map(p => p.description).join(' ');
    const F = OSDR_FALLBACK;
    NASA.osdr = {
      status: a.src === 'cache' || b.src === 'cache' ? 'cache' : 'live',
      title895: s895.title, title883: s883.title,
      cucumberKg: num(/cucumbers?\s*\((\d+)\s*kg\)/i, d, F.cucumberKg),
      lettuceKg: num(/lettuces?\s*\((\d+)\s*kg\)/i, d, F.lettuceKg),
      radishKg: num(/radish(?:es)?\s*\((\d+)\s*kg\)/i, d, F.radishKg),
      totalKg: num(/more than\s*(\d+)\s*kg/i, d, F.totalKg),
      photoperiod: num(/photoperiod was\s*(\d+)\s*h/i, d, F.photoperiod),
      light: num(/(\d+)\s*micromole/i, d, F.light),
      radishLight: num(/(\d+)\s*micromole per square meter per second\s*for radish/i, p895, F.radishLight),
      seasonDays: num(/;\s*(\d+)\s*days\)/i, p895, F.seasonDays),
      cucumberSpread: /spread harvest[^.]*cucumber/i.test(p895) || F.cucumberSpread,
      radishDays: num(/radish seedlings were collected at\s*(\d+)\s*days/i, p883, F.radishDays),
      lettuceDays: num(/lettuce at\s*(\d+)\s*days/i, p883, F.lettuceDays)
    };
  } catch (e) {
    console.warn('OSDR indisponível, usando dados embutidos:', e);
    NASA.osdr = { ...OSDR_FALLBACK, status: 'off' };
  }
  buildCrops();
  if (current === 'farm') render();
}
let CROPS = {};
function buildCrops() {
  const o = NASA.osdr;
  CROPS = {
    alface: { name: 'Alface', sci: 'Lactuca sativa', realDays: o.lettuceDays, kg: o.lettuceKg, water: 2, regrow: false, srcDays: 'OSD-883', srcKg: 'OSD-895',
      img: 'plant_alface.png', icon: `<img src="${A('veg_alface.png')}" alt="">`,
      fact: `Plantada com solo da Lua trazido pela Apollo 14, a alface foi colhida em apenas <b>${o.lettuceDays} dias!</b>` },
    pepino: { name: 'Pepino', sci: 'Cucumis sativus', realDays: CUCUMBER_DAYS_REF, kg: o.cucumberKg, water: 3, regrow: o.cucumberSpread, harvests: 3, srcDays: 'estimativa', srcKg: 'OSD-895',
      img: 'plant_pepino.png', icon: `<img src="${A('ic_pepino.png')}" alt="">`,
      fact: `Na estufa espacial EDEN ISS, os cientistas colheram <b>${o.cucumberKg} kg</b> de pepino em uma temporada!` },
    rabanete: { name: 'Rabanete', sci: 'Raphanus sativus', realDays: o.radishDays, kg: o.radishKg, water: 1, regrow: false, srcDays: 'OSD-883', srcKg: 'OSD-895',
      svg: true, icon: ART.rabanete(),
      fact: `Plantado com solo da Lua trazido pela Apollo 14, o rabanete foi colhido em apenas <b>${o.radishDays} dias!</b>` }
  };
}
const gameDays = c => Math.max(1, Math.ceil(CROPS[c].realDays / 7 * D().grow) - (S.farmLvl >= 4 ? 1 : 0));
const regrowDays = () => Math.max(1, Math.round(2 * D().grow));
const elixirValue = c => Math.round((10 + CROPS[c].kg * 0.35) * (1 + .1 * (S.farmLvl - 1)));
const waterNeed = c => Math.max(1, CROPS[c].water - (S.farmLvl - 1));

/* ================= LRO / LOLA (topografia) ================= */
const SITES = {
  copernicus: { name: 'Cratera Copérnico', short: 'Copérnico', z: 5, row: 14, col: 28, base: [3, 1], lat: '5,6°N–11,3°N', lon: '16,9°O–22,5°O' },
  framauro: { name: 'Fra Mauro (Apollo 14)', short: 'Fra Mauro', z: 5, row: 16, col: 28, base: [2, 3], lat: '0°–5,6°S', lon: '16,9°O–22,5°O' }
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
function classify(z) {
  if (z.elev < .35) Object.assign(z, { type: 'Fundo de cratera', icon: '🕳️', tip: 'Região baixa e fria. Peças de meteoritos se acumulam aqui.' });
  else if (z.slope > .7) Object.assign(z, { type: 'Borda íngreme', icon: '⛰️', tip: 'Muito inclinado: gasta mais oxigênio, mas esconde muitas peças.' });
  else if (z.slope < .35) Object.assign(z, { type: 'Planície', icon: '🟫', tip: 'Terreno plano: caminhar é fácil e gasta pouco oxigênio.' });
  else Object.assign(z, { type: 'Colinas', icon: '🏔️', tip: 'Terreno ondulado com pedras e crateras pequenas.' });
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
  'A sonda <b>LRO</b> mede o relevo da Lua com um laser chamado <b>LOLA</b>, que dispara 28 vezes por segundo!',
  'A missão <b>Artemis I</b> passou pela Lua em <b>2022</b>, mas não pousou. O programa Artemis prepara missões tripuladas!',
  'A cratera <b>Copérnico</b> tem cerca de <b>93 km</b> de largura e pode ser vista da Terra com binóculos.',
  'A <b>Apollo 14</b> pousou em <b>Fra Mauro</b> em 1971 e trouxe solo lunar usado em experimentos com plantas.',
  'Na Lua um dia dura cerca de <b>29 dias</b> da Terra, por isso as noites lunares são muito longas e frias.',
  'A gravidade da Lua é <b>6 vezes menor</b>: na Lua você pularia muito mais alto!'
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
  b.innerHTML = `<div class="rb"><img src="${A('robot.png')}" alt="Robô"></div><div class="speech">${text}<div class="row">${sayBtn(text)}<button class="pill-btn yellow small" data-ok>OK</button></div></div>`;
  if (S.voice) speak(text);
  $('[data-ok]', b).onclick = () => { b.className = 'bubble hidden'; robotBusy = false; res(); pumpRobot(); };
}
const tip = (k, text) => { if (S.tips[k]) return; S.tips[k] = 1; save(); robot(text); };
const clearRobot = () => { robotQ.length = 0; robotBusy = false; $('#bubble').className = 'bubble hidden'; };

function modal(title, html, bind, opts = {}) {
  const m = $('#modal');
  m.innerHTML = `<div class="card glass ${opts.cls || ''}"><div class="banner ${opts.orange ? 'orange' : ''}">${title}</div>${opts.noX ? '' : '<button class="xround" data-close style="right:-6px;top:-14px" aria-label="Fechar">✕</button>'}<div class="card-body">${html}</div></div>`;
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
  if (cfg) { if (!bg.src.endsWith(cfg.bg)) bg.src = A(cfg.bg); bg.classList.remove('hidden'); } else bg.classList.add('hidden');
  hud();
  const nav = $('#nav');
  nav.innerHTML = cfg && cfg.nav ? ['farm', 'explore', 'upgrades', 'sleep'].map((t, i) =>
    `<button data-nav="${t}" aria-label="${['Alimentar', 'Explorar', 'Melhorias', 'Dormir'][i]}" style="${pos([NAV_X[i][0], cfg.nav[0], NAV_X[i][1], cfg.nav[1]])}"></button>`).join('') : '';
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
  if (S.trip) { if (t !== 'explore') toast('🚙 Volte para a base primeiro!'); return go('explore'); }
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
    <button class="pill-btn blue vid-snd hidden" id="vidSnd">🔊 ATIVAR SOM</button>
    <button class="pill-btn yellow vid-skip" id="vidSkip">PULAR ⏭</button>
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
  { t: 'Você é um astronauta e vive em um posto avançado na Lua. 🌕', img: [['moon_scene.png', 'left:-15px;top:-10px;width:330px;height:220px;object-fit:cover']] },
  { t: 'Certo dia, uma nave espacial alienígena caiu perto da sua base! 💥', img: [['moon_scene.png', 'left:-15px;top:-10px;width:330px;height:220px;object-fit:cover;filter:brightness(.55)'], ['rocket.png', 'left:95px;top:14px;width:120px;border-radius:14px;box-shadow:0 0 0 3px #7fe3ff,0 0 18px #ff8a3d']] },
  { t: 'Nos destroços, você encontrou Zuno: um pequeno alienígena ferido e sem energia.', img: [['zuno_sleep.png', 'left:0;top:-10px;width:300px']] },
  { t: 'O Robô da base escaneou Zuno: a energia dele vem do <b>ELIXIR</b>, feito a partir de plantas cultivadas!', img: [['robot.png', 'left:12px;top:30px;width:140px;border-radius:16px'], ['plant_alface.png', 'left:170px;top:70px;width:120px']] },
  { t: 'Sua missão: cuidar de Zuno, cuidar dos recursos da base e consertar o foguete para ele voltar para a família! 🚀', img: [['zuno_home.png', 'left:10px;top:-20px;width:150px'], ['rocket.png', 'left:170px;top:20px;width:120px']] }
];
let storyI = 0;
function renderStory() {
  const s = STORY[storyI];
  layer(`<div class="story">
    <div class="logo">ZUNO</div>
    <div class="scene">${s.img.map(([src, st]) => `<img src="${A(src)}" style="${st}" alt="">`).join('')}</div>
    <div class="story-text glass" style="padding:8px 10px"><p style="flex:1">${s.t}</p>${sayBtn(s.t)}</div>
    <div class="dots">${STORY.map((_, i) => `<i class="${i === storyI ? 'on' : ''}"></i>`).join('')}</div>
    <div class="row2"><button class="pill-btn blue" id="skip">PULAR</button><button class="pill-btn green" id="next">${storyI < STORY.length - 1 ? 'PRÓXIMO ▶' : 'COMEÇAR!'}</button></div>
  </div>`);
  if (S.voice && storyI > 0) speak(s.t);
  $('#next').onclick = () => { if (storyI < STORY.length - 1) { storyI++; renderStory(); } else { S.phase = 'age'; save(); render(); } };
  $('#skip').onclick = () => { S.phase = 'age'; save(); render(); };
}
function renderAge() {
  const t = 'Quantos anos você tem? Assim eu deixo a missão do seu tamanho!';
  layer(`<div class="story" style="justify-content:center;gap:14px">
    <div style="width:130px;height:122px;border-radius:20px;overflow:hidden;border:3px solid #7fe3ff"><img src="${A('robot.png')}" style="width:100%;height:100%;object-fit:cover" alt=""></div>
    <div class="story-text glass" style="padding:8px 10px"><p style="flex:1">${t}</p>${sayBtn(t)}</div>
    <div class="ages">${[7, 8, 9, 10, 11, 12].map(a => `<button class="pill-btn ${['yellow', 'yellow', 'blue', 'blue', 'green', 'green'][a - 7]}" data-age="${a}">${a}</button>`).join('')}</div>
    <p style="font-size:11px;text-align:center;opacity:.85">Adultos: o Modo Supervisão (limite de tempo) fica na engrenagem ⚙️ da tela inicial.</p>
  </div>`);
  $$('[data-age]').forEach(b => b.onclick = () => {
    S.age = +b.dataset.age; S.diff = ageToDiff(S.age); S.phase = 'play'; S.o2 = o2Max(); save();
    current = 'home'; render();
    robot(`Nível <b>${D().name}</b> ativado! Eu sou o Robô da base. Toque em mim quando precisar de uma dica.`);
    robot('A barra amarela é a <b>ENERGIA</b> do Zuno (o Elixir). Se ela acabar, ele desmaia! Vamos cuidar bem dele.');
  });
}

/* ================= casa ================= */
const zunoMood = () => S.elixir <= 0 ? 'faint' : S.elixir < 30 ? 'sad' : 'happy';
function renderHome() {
  const mood = zunoMood();
  layer(`${mood === 'faint' ? '<div class="faint-veil"></div>' : ''}
    <div class="zuno-hit" id="zuno"></div>
    ${mood !== 'happy' ? `<div class="mood"><div class="speech">${mood === 'faint' ? '😵 Sem energia...' : '😢 Estou com fome!'}</div></div>` : ''}
    <div class="chip" style="left:8px;top:72px;font-size:11px">📅 Dia ${S.day}</div>
    <button class="chip" id="nasaBtn" style="right:36px;top:72px;font-size:11px">🛰️ NASA</button>
    <button class="chip" id="gearBtn" style="right:8px;top:72px;padding:2px 4px;font-size:11px" aria-label="Pais">⚙️</button>
    <button class="chip" id="rocketBtn" style="left:8px;top:94px;font-size:11px">🚀 ${S.rocket}/5</button>
    <button class="robot-hint" id="robotBtn"><img src="${A('robot.png')}" alt="Robô"><i>?</i></button>`);
  $('#zuno').onclick = petZuno;
  $('#robotBtn').onclick = () => robot(hint());
  $('#nasaBtn').onclick = openNasa;
  $('#gearBtn').onclick = () => parentalGate(openSettings);
  $('#rocketBtn').onclick = () => robot(S.rocket < 5 ? `Foguete: <b>${S.rocket} de 5</b> partes consertadas. Próxima: <b>${ROCKET[S.rocket].name}</b>. Use MELHORIAS!` : 'O foguete está pronto!');
  if (mood === 'faint') tip('faint' + S.day, 'Zuno desmaiou sem energia! Colha plantas em <b>ALIMENTAR</b> ou coloque-o para <b>DORMIR</b>.');
  else if (mood === 'sad') tip('sad' + S.day, 'Zuno está ficando fraco... Vá em <b>ALIMENTAR</b> e colha uma planta para ele!');
}
const PET = ['Zuno adora carinho! 💚', 'Zuno: "Blip blop!" (obrigado!)', 'Zuno sente saudade da família...', 'Zuno está curioso sobre a Terra 🌍'];
function petZuno(e) {
  if (zunoMood() === 'faint') return toast('😵 Zuno precisa de Elixir!');
  const h = document.createElement('div'); h.className = 'heart'; h.textContent = ['💚', '💙', '✨', '⭐'][rnd(0, 3)];
  const r = $('#screen').getBoundingClientRect(), k = 330 / r.width;
  h.style.left = ((e.clientX - r.left) * k - 12) + 'px'; h.style.top = ((e.clientY - r.top) * k - 20) + 'px';
  $('#layer').appendChild(h); setTimeout(() => h.remove(), 1200);
  toast(PET[rnd(0, PET.length - 1)]);
}
function hint() {
  const open = S.plots.slice(0, slotsOpen());
  if (open.some(p => p.crop && p.left <= 0)) return 'Tem planta pronta! Vá em <b>ALIMENTAR</b> e faça a colheita. 🌱';
  if (S.elixir < 20) return 'A energia está muito baixa. Vá <b>DORMIR</b> para recuperar, e as plantas crescem durante a noite.';
  if (open.some(p => !p.crop)) return S.water >= 1 ? 'Há cúpula vazia na plantação! Plante algo para produzir Elixir.' : 'Acabou a água! Extraia gelo lunar na tela da plantação. 💧';
  if (S.rocket < 5) {
    const c = scaled(ROCKET[S.rocket]);
    if (c.o > o2Max()) return `A próxima peça do foguete precisa de <b>${c.o}</b> de oxigênio, mas o tanque só guarda <b>${o2Max()}</b>. Melhore a <b>Base</b>!`;
    if (canPay(c)) return 'Você já tem recursos para consertar uma parte do foguete! Abra <b>MELHORIAS</b>. 🚀';
    if (S.scrap < c.s) return `Precisamos de mais <b>${c.s - S.scrap}</b> sucatas. Vá <b>EXPLORAR</b> a Lua!`;
    if (S.o2 < c.o) return 'Falta oxigênio. Volte de uma expedição ou durma para reabastecer o tanque.';
    return 'Falta energia para a melhoria. Colha plantas para o Zuno!';
  }
  return 'Tudo certo por aqui! Continue cuidando do Zuno.';
}

/* ================= plantação ================= */
// As 4 cúpulas usam os mesmos elementos (vidro aceso, rótulo e status). As de baixo, quando liberadas,
// ganham uma base (podbase) cobrindo a placa "PLANTAÇÃO BLOQUEADA" e as listras do desenho original.
const PODS = [
  { inn: [55, 165, 97, 62], bgd: 'dome_in_l.png', label: [66, 235, 80, 16], status: [55, 253, 97, 47] },
  { inn: [176, 158, 99, 69], bgd: 'dome_in_r.png', label: [186, 235, 84, 16], status: [174, 253, 104, 47] },
  { inn: [57, 322, 95, 62], bgd: 'dome_in_l.png', label: [66, 388, 80, 16], status: [56, 406, 97, 45], base: [50, 384, 110, 68] },
  { inn: [178, 322, 95, 62], bgd: 'dome_in_r.png', label: [187, 388, 84, 16], status: [176, 406, 100, 45], base: [170, 384, 112, 68] }
];
const stageScale = p => { if (p.left <= 0) return 1; const f = 1 - p.left / p.total; return f < .34 ? .3 : f < .67 ? .55 : .8; };
function plantHTML(k, sc) {
  const c = CROPS[k];
  return c.svg ? `<div class="plant" style="width:48%;margin-left:-24%;transform:scale(${sc})">${ART.rabanete()}</div>`
    : `<div class="plant" style="width:100%;left:0;bottom:0;transform:scale(${sc})"><img src="${A(c.img)}" alt=""></div>`;
}
function renderFarm() {
  const html = PODS.map((P, i) => {
    const p = S.plots[i];
    if (i >= slotsOpen()) return ''; // bloqueada: já está desenhada no fundo
    const ready = p.crop && p.left <= 0;
    const inner = `<div class="dome-in ${ready ? 'ready' : ''}" data-pod="${i}" style="${pos(P.inn)}"><img class="bgd" src="${A(P.bgd)}" alt="">${p.crop ? plantHTML(p.crop, stageScale(p)) : ''}</div>`;
    const name = p.crop ? `${CROPS[p.crop].icon}${CROPS[p.crop].name.toUpperCase()}` : 'VAZIO';
    let st;
    if (!p.crop) st = `<div class="days">VAZIO</div><button class="pill-btn green small" style="width:92%" data-plant="${i}">+ PLANTAR</button>`;
    else if (ready) st = `<div class="ok-pill">✔ PRONTO!</div><button class="img-btn" data-harvest="${i}" aria-label="Colher" style="width:93px;height:28px;background-image:url(${A('btn_colher.png')})"></button>`;
    else st = `<div class="days">🕐 ${p.left} DIA${p.left > 1 ? 'S' : ''}</div><div class="prog"><i style="width:${Math.round((1 - p.left / p.total) * 100)}%"></i></div>`;
    return (P.base ? `<div class="podbase" style="${pos(P.base)}"></div>` : '') + inner +
      `<div class="plabel" style="${pos(P.label)}">${name}</div><div class="pstatus" style="${pos(P.status)}">${st}</div>`;
  }).join('');
  layer(html + `
    <div class="chip" style="left:8px;top:70px">💧 Água: ${S.water}</div>
    <button class="chip" id="ice" style="right:8px;top:70px">⛏️ Gelo +3💧</button>
    <button class="chip" id="cropInfo" style="left:8px;top:94px">🧪 NASA</button>`);
  $$('[data-plant]').forEach(b => b.onclick = () => choosePlant(+b.dataset.plant));
  $$('[data-harvest]').forEach(b => b.onclick = () => harvest(+b.dataset.harvest));
  $$('.dome-in').forEach(d => d.onclick = () => { const i = +d.dataset.pod, p = S.plots[i]; if (!p.crop) choosePlant(i); else if (p.left <= 0) harvest(i); else toast(`🌱 Faltam ${p.left} dia(s)`); });
  $('#ice').onclick = collectWater;
  $('#cropInfo').onclick = openNasa;
  tip('farm', 'Esta é a plantação! As plantas são estudadas de verdade pela NASA. Plantar usa <b>água</b> e um pouco de <b>energia</b>; colher dá <b>Elixir</b> para o Zuno.');
}
function collectWater() {
  if (S.elixir < 4) return toast('⚡ Energia insuficiente!');
  S.elixir -= 4; S.water += 3; save(); render(); toast('💧 +3 de água (gelo lunar derretido)');
  tip('water', 'Sabia? Em 2009, a NASA descobriu <b>gelo de água</b> em crateras escuras do polo sul da Lua com a missão LCROSS!');
}
function choosePlant(i) {
  const cards = Object.keys(CROPS).map(k => {
    const c = CROPS[k], w = waterNeed(k), ok = S.water >= w && S.elixir >= 3;
    const desc = `${c.name}: no jogo leva ${gameDays(k)} dias, usa ${w} de água e dá ${elixirValue(k)} de energia.`;
    return `<div class="cropcard"><div class="pic">${c.svg ? ART.rabanete() : `<img src="${A(c.img)}" alt="">`}</div>
      <div class="info"><h3>${c.name} ${sayBtn(desc)}</h3><i style="opacity:.8">${c.sci}</i><br>
        <span class="nasa-tag">${c.srcDays}</span>${c.srcDays === 'estimativa' ? '~' : ''}${c.realDays} dias até colher<br>
        <span class="nasa-tag">${c.srcKg}</span>EDEN ISS: ${c.kg} kg${c.regrow ? ' · colhe 3×' : ''}<br>
        🎮 <b>${gameDays(k)} dia(s)</b> · 💧${w} · +${elixirValue(k)}⚡</div>
      <button class="pill-btn green small" data-pick="${k}" ${ok ? '' : 'disabled'}>PLANTAR</button></div>`;
  }).join('');
  modal('O QUE PLANTAR?', `<p style="font-size:12px;text-align:center">Plantar custa 3⚡ + água. Você tem 💧${S.water}.</p>${cards}`, m => {
    $$('[data-pick]', m).forEach(b => b.onclick = () => {
      const k = b.dataset.pick, p = S.plots[i];
      S.water -= waterNeed(k); S.elixir -= 3;
      Object.assign(p, { crop: k, left: gameDays(k), total: gameDays(k), harvests: 0 });
      save(); closeModal(); render(); toast(`🌱 ${CROPS[k].name} plantado!`);
      tip('plant', 'As plantas crescem enquanto o Zuno dorme. Cada noite de sono = <b>1 dia</b> na Lua.');
    });
  });
}
function harvest(i) {
  const p = S.plots[i], k = p.crop, c = CROPS[k], gain = elixirValue(k);
  S.elixir = Math.min(100, S.elixir + gain); S.fedToday = true; S.stats.harvested++; p.harvests++;
  let extra = '';
  if (c.regrow && p.harvests < c.harvests) { p.left = regrowDays(); p.total = p.left; extra = ` O pé de pepino continua dando frutos: mais em ${p.left} dia(s)!`; }
  else Object.assign(p, { crop: null, left: 0, total: 0, harvests: 0 });
  save(); render();
  toast(`⚡ +${gain} de energia para o Zuno!`);
  const txt = c.fact;
  if (extra) setTimeout(() => robot(extra.trim()), 300);
  // popup original "COLHEITA REALIZADA!" com o texto e o vegetal trocados
  const vegOverlay = k === 'alface' ? '' : `<div class="abs" style="${pos([196, 136, 82, 62])};background:radial-gradient(circle,#2f74e0 40%,#2563d8 70%,rgba(37,99,216,0));display:grid;place-items:center">${c.svg ? `<div style="width:54px">${ART.rabanete()}</div>` : `<img src="${A(c.img)}" style="width:80px" alt="">`}</div>`;
  modalRaw(`<div class="popimg" style="${pos([6, 253, 300, 207])}"><img src="${A('pop_harvest.webp')}" alt="Colheita realizada">
      <div class="abs speech" style="${pos([125, 64, 146, 88])};border:0;background:#eef4ff;font-size:12.5px;line-height:1.35;padding:4px 6px;border-radius:12px;overflow:hidden;display:flex;align-items:center"><span>${txt}</span></div>
      ${vegOverlay}
      <button class="hot" data-close style="${pos([262, 6, 36, 36])}" aria-label="Fechar"></button>
      <div class="abs" style="left:8px;top:170px">${sayBtn(txt)}</div></div>`, m => m.onclick = e => { if (e.target === m) closeModal(); });
  if (S.voice) speak(txt);
}

/* ================= exploração ================= */
const PIN_POS = [[28, 160], [110, 133], [178, 163], [248, 127]];
const PANEL = [14, 206, 302, 248];
let selPin = null;
async function renderExplore() {
  const site = SITES[S.site];
  layer(`<div id="pins"></div><div class="xpanel glass" id="xp" style="${pos(PANEL)}"><div class="banner">${S.trip ? 'EXPEDIÇÃO' : 'ESCOLHA UM LOCAL'}</div><p style="text-align:center;margin-top:30px">🛰️ Baixando relevo da LRO...</p></div>`);
  const t = await loadTerrain(S.site);
  if (current !== 'explore' || !$('#xp')) return;
  drawPins(t); drawPanel(t);
  tip('explore', 'Cada pino é um lugar <b>de verdade</b> da Lua: o relevo vem do laser LOLA da sonda LRO! Terrenos inclinados gastam mais oxigênio, mas têm mais sucata. Guarde oxigênio para voltar!');
}
function drawPins(t) {
  const posNow = S.trip ? S.trip.pos : SITES[S.site].base;
  let astro = 'left:44px;top:132px';
  $('#pins').innerHTML = t.pins.map(([r, c], i) => {
    const [x, y] = PIN_POS[i], times = S.dep[depKey(r, c)] || 0;
    if (r === posNow[0] && c === posNow[1]) astro = `left:${x + 16}px;top:${y - 8}px`;
    return `<button class="pinb ${selPin === i ? 'sel' : ''} ${times >= 3 ? 'dim' : ''}" data-pin="${i}" style="left:${x}px;top:${y}px"><img src="${A('pin.png')}" alt="Local ${i + 1}"><span class="n">${i + 1}</span>${times ? '<span class="ck">✔</span>' : ''}</button>`;
  }).join('') + `<div class="astro" style="${astro}">🧑‍🚀</div>`;
  $$('[data-pin]').forEach(b => b.onclick = () => { selPin = +b.dataset.pin; drawPins(t); drawPanel(t); });
}
function drawPanel(t) {
  const site = SITES[S.site], posNow = S.trip ? S.trip.pos : site.base;
  let info;
  if (selPin === null) info = `<div class="zinfo"><h4>Toque num pino ${sayBtn('Toque num pino do cenário ou numa região numerada do mapa para ver o terreno e o custo.')}</h4>
      <p style="font-size:11px;line-height:1.3">O mapinha é a Lua de verdade (${site.name}), medida pelo laser <b style="color:#ffe14d">LOLA</b> da sonda <b style="color:#ffe14d">LRO</b> da NASA.</p></div>`;
  else {
    const [r, c] = t.pins[selPin], z = t.zones[r][c];
    const cost = zoneCost(z, posNow, [r, c]), back = returnCost([r, c]);
    const can = S.o2 >= cost.o && S.elixir >= cost.e, risky = S.o2 - cost.o < back;
    const times = S.dep[depKey(r, c)] || 0;
    info = `<div class="zinfo"><h4>${selPin + 1}. ${z.icon} ${z.type} ${sayBtn(z.type + '. ' + z.tip)}</h4>
      <div class="meter"><span>Altitude</span><div class="mb"><i style="width:${Math.round(z.elev * 100)}%;background:#38b6ff"></i></div></div>
      <div class="meter"><span>Inclinação</span><div class="mb"><i style="width:${Math.round(z.slope * 100)}%;background:#ff8a3d"></i></div></div>
      <div class="meter"><span>Sucata</span><div class="mb"><i style="width:${Math.round(Math.max(.2, 1 - .3 * times) * 100)}%;background:#4fd44a"></i></div></div>
      <div class="costs"><span class="cost ${S.o2 < cost.o ? 'no' : ''}">🫧−${cost.o}</span><span class="cost ${S.elixir < cost.e ? 'no' : ''}">⚡−${cost.e}</span><span class="cost">volta 🫧${back}</span></div>
      ${risky && can ? '<div class="warn">⚠️ Não vai sobrar oxigênio para voltar!</div>' : ''}
      <button class="pill-btn green small" id="go" ${can ? '' : 'disabled'}>EXPLORAR</button></div>`;
  }
  $('#xp').innerHTML = `<div class="banner">${S.trip ? 'EXPEDIÇÃO' : 'ESCOLHA UM LOCAL'}</div>
    <div class="xrow"><div class="lro"><canvas id="lro" width="236" height="236"></canvas><div class="tag">NASA LRO/LOLA · ${site.short}</div></div>${info}</div>
    <div class="xfoot"><div class="seg">${Object.entries(SITES).map(([k, s]) => `<button data-site="${k}" class="${k === S.site ? 'on' : ''}" ${S.trip ? 'disabled' : ''}>${s.short}</button>`).join('')}</div>
      <span>🎒 ${S.trip ? S.trip.bag : 0}🔩</span>
      <button class="pill-btn blue small" id="home" ${S.trip ? '' : 'disabled'}>🏠 VOLTAR</button></div>`;
  drawLRO(t);
  $$('[data-site]').forEach(b => b.onclick = () => { S.site = b.dataset.site; selPin = null; save(); render(); });
  $('#home').onclick = returnToBase;
  const g = $('#go'); if (g) g.onclick = () => explore(t);
  $('#lro').onclick = e => {
    const r = e.target.getBoundingClientRect();
    const cc = Math.floor((e.clientX - r.left) / r.width * GRID), rr = Math.floor((e.clientY - r.top) / r.height * GRID);
    const i = t.pins.findIndex(([a, b]) => a === rr && b === cc);
    if (i >= 0) { selPin = i; drawPins(t); drawPanel(t); } else toast('Escolha uma região numerada');
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
  const fact = LUNAR_FACTS[S.stats.explored % LUNAR_FACTS.length];
  // popup original "BUSCA REALIZADA!" com número e texto dinâmicos
  modalRaw(`<div class="popimg" style="${pos(PANEL)}"><img src="${A('pop_search.webp')}" alt="Busca realizada">
      <div class="abs lil stroke" style="${pos([210, 101, 54, 30])};display:grid;place-items:center;font-size:24px;background:linear-gradient(#5fe04a,#28a82c);border-radius:14px">+${got}</div>
      <div class="abs speech" style="${pos([24, 140, 246, 74])};border:0;background:#eef4ff;font-size:11px;line-height:1.35;padding:3px 8px;text-align:center;display:flex;align-items:center;justify-content:center"><span>${fact}</span></div>
      <button class="hot" data-close style="${pos([254, 6, 38, 38])}" aria-label="Fechar"></button>
      <div class="abs" style="left:10px;top:12px">${sayBtn(`Busca realizada! Mais ${got} sucatas na mochila. ${fact}`)}</div></div>`,
    m => m.onclick = e => { if (e.target === m || e.target.closest('.popimg')) { closeModal(); if (S.stats.explored === 1) robot('A sucata fica na <b>mochila</b> até você <b>VOLTAR</b> para a base. Se o oxigênio acabar no caminho, eu te resgato, mas metade da mochila se perde!'); } });
  if (S.voice) speak(`Mais ${got} sucatas! ${fact}`);
}
function returnToBase() {
  if (!S.trip) return;
  const need = returnCost(S.trip.pos);
  let bag = S.trip.bag, msg;
  if (S.o2 >= need) msg = `De volta à base! Você trouxe <b>${bag} sucatas</b> e o tanque de oxigênio foi reabastecido. 🫧`;
  else { const lost = Math.ceil(bag / 2); bag -= lost; msg = `O oxigênio não deu para voltar... Eu fui te resgatar! 🤖 Perdemos <b>${lost} sucatas</b> no caminho. Planeje melhor a volta!`; }
  S.scrap += bag; S.stats.scrapTotal += bag; S.o2 = o2Max(); S.trip = null; selPin = null;
  save(); go('home'); robot(msg);
}

/* ================= melhorias (modal original) ================= */
function costBox(c, keys, btnAttr, can, compact) {
  const ic = { e: 'ic_energy.png', o: 'ic_o2.png', s: 'ic_gear.png' }, have = { e: S.elixir, o: S.o2, s: S.scrap };
  return `<div class="hd">${compact ? 'CUSTO' : 'CUSTO DA<br>MELHORIA'}</div>${keys.map(k => `<div class="row"><img src="${A(ic[k])}" alt=""><span class="v ${have[k] < c[k] ? 'no' : ''}">${c[k]}</span></div>`).join('')}
    <button class="img-btn" ${btnAttr} ${can ? '' : 'disabled'} style="background-image:url(${A('btn_melhorar.png')})" aria-label="Melhorar"></button>`;
}
function openUpgrades() {
  if (S.trip) { toast('🚙 Volte para a base primeiro!'); return go('explore'); }
  const M = [15, 62]; // canto do modal na tela
  const at = ([x, y, w, h]) => pos([x, y, w, h]);
  const segs = (n, on, cls, r) => `<div class="levels ${cls}" style="${at(r)}">${Array.from({ length: n }, (_, i) => `<i class="${i < on ? 'on' : ''}"></i>`).join('')}</div>`;
  let h = `<img src="${A('modal_upg.webp')}" style="width:100%;height:100%;display:block" alt="Melhorias">`;
  // textos pequenos da arte ficam borrados: substituídos por texto nítido (e que diz o efeito real)
  const desc = (r, bg, txt) => `<div class="updesc" style="${at(r)};background:${bg}"><span>${txt}</span></div>`;
  const nextR = S.rocket < 5 ? ROCKET[S.rocket] : null;
  h += desc([40, 66, 222, 26], '#11245f', 'Melhore sua base e a plantação, e conserte o foguete do Zuno!');
  h += desc([109, 123, 104, 23], '#1a3157', S.baseLvl < 5 ? `Tanque de O₂: <b>${O2_CAP[S.baseLvl - 1]} → ${O2_CAP[S.baseLvl]}</b>` : `Tanque máximo: <b>${O2_CAP[4]}</b> de O₂`);
  h += desc([110, 215, 102, 26], '#1e3a7a', ['Libera a <b>3ª cúpula</b> e usa menos 💧', 'Libera a <b>4ª cúpula</b> e usa menos 💧', 'Plantas crescem <b>1 dia</b> mais rápido', 'Plantação no <b>nível máximo</b>'][S.farmLvl - 1]);
  h += desc([110, 316, 100, 27], '#1c3570', nextR ? `Próxima: <b>${nextR.name}</b> (${nextR.game === 'wires' ? 'fios' : 'canos'})` : 'Foguete <b>pronto</b>!');
  // base
  h += segs(5, S.baseLvl, 'green', [110, 149, 106, 16]);
  if (S.baseLvl < 5) { const c = scaled(UPG.base.costs[S.baseLvl - 1]); h += `<div class="costbox compact" style="${at([215, 103, 72, 74])}">${costBox(c, ['e', 'o', 's'], 'data-up="base"', canPay(c), true)}</div>`; }
  // plantação
  h += segs(4, S.farmLvl, 'cyan', [110, 246, 86, 16]) + `<div class="lvtxt" style="${at([112, 263, 84, 12])}">Nível ${S.farmLvl} / 4</div>`;
  if (S.farmLvl < 4) { const c = scaled(UPG.farm.costs[S.farmLvl - 1]); h += `<div class="costbox" style="${at([212, 190, 72, 84])}">${costBox(c, ['e', 's'], 'data-up="farm"', canPay(c))}</div>`; }
  else h += `<div class="maxbadge" style="${at([218, 196, 62, 64])}"></div>`;
  // foguete
  h += segs(5, S.rocket, 'cyan', [110, 351, 92, 16]) + `<div class="lvtxt" style="${at([112, 368, 92, 12])}">Nível ${S.rocket} / 5</div>`;
  if (S.rocket < 5) { const c = scaled(ROCKET[S.rocket]); h += `<div class="costbox" style="${at([212, 287, 72, 98])}">${costBox(c, ['e', 'o', 's'], 'data-rocket', canPay(c))}</div>`; }
  h += `<button class="hot" data-close style="${at([264, 12, 38, 36])}" aria-label="Fechar"></button>`;
  const t = 'Melhorias. Toda melhoria precisa de energia, oxigênio e sucata ao mesmo tempo. Se faltar algum, o botão fica bloqueado.';
  h += `<div class="abs" style="left:10px;top:50px">${sayBtn(t)}</div>`;
  const rocketWarn = S.rocket < 5 && scaled(ROCKET[S.rocket]).o > o2Max();
  modalRaw(`<div class="popimg" style="${pos([M[0], M[1], 300, 418])}">${h}</div>`, m => {
    m.onclick = e => { if (e.target === m) closeModal(); };
    $$('[data-up]', m).forEach(b => b.onclick = () => {
      const key = b.dataset.up, lk = key === 'base' ? 'baseLvl' : 'farmLvl', c = scaled(UPG[key].costs[S[lk] - 1]);
      if (!canPay(c)) return;
      pay(c); S[lk]++; save(); closeModal(); render();
      robot(key === 'base' ? `Base melhorada! Agora o tanque guarda <b>${o2Max()}</b> de oxigênio.` : `Plantação melhorada! ${slotsOpen() > 2 ? 'Nova cúpula liberada, ' : ''}menos água por planta e colheitas maiores. 🌱`);
    });
    const rb = $('[data-rocket]', m);
    if (rb) rb.onclick = () => {
      const st = ROCKET[S.rocket], c = scaled(st);
      if (!canPay(c)) return;
      closeModal();
      startMG(st, () => {
        pay(c); S.rocket++; save();
        if (S.rocket >= 5) { S.phase = 'outro'; save(); current = 'home'; render(); }
        else { go('home'); robot(`Parte consertada: <b>${st.name}</b>! Faltam ${5 - S.rocket}. Zuno está cada vez mais perto de casa! 🚀`); }
      });
    };
  });
  if (rocketWarn) robot(`A próxima parte do foguete precisa de <b>${scaled(ROCKET[S.rocket]).o}</b> de oxigênio, mas o tanque guarda só <b>${o2Max()}</b>. Melhore a <b>Base</b> primeiro!`);
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
  const fail = () => modal('TEMPO ESGOTADO!', `<div class="say-row"><p>Não tem problema! Os recursos não foram gastos. Quer tentar de novo?</p>${sayBtn('Não tem problema! Os recursos não foram gastos. Quer tentar de novo?')}</div>
      <div class="actions"><button class="pill-btn blue" id="quit">SAIR</button><button class="pill-btn green" id="retry">TENTAR DE NOVO</button></div>`, m => {
    $('#retry', m).onclick = () => { closeModal(); startMG(stage, onWin); };
    $('#quit', m).onclick = () => go('home');
  }, { noX: true });
  const win = () => { stopMG(); setTimeout(onWin, 800); };
  if (stage.game === 'wires') wiresGame(stage.n, win, fail); else pipesGame(stage.n, win, fail);
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
    cells += `<div class="tile end">${r === r0 ? `<img src="${A('pipe_tank.png')}" alt="Água">` : ''}</div>`;
    for (let c = 0; c < n; c++) cells += `<button class="tile" data-r="${r}" data-c="${c}">${pipeSVG(base[r][c])}</button>`;
    cells += `<div class="tile end">${r === r1 ? `<img src="${A('pipe_res.png')}" alt="Reservatório">` : ''}</div>`;
  }
  const t = 'Conecte os canos e leve a água até o reservatório! Toque nos canos para girar.';
  layer(`<div class="board" style="${pos(BOARD)};grid-template-columns:repeat(${n + 2},${ts}px);grid-auto-rows:${ts}px;background-size:${ts}px ${ts}px">${cells}</div>
    <div class="timer-ov" id="timer" style="${pos([150, 178, 64, 22])}"></div>
    <button class="hot" id="mgx" style="${pos([285, 62, 43, 40])};border-radius:50%" aria-label="Sair"></button>
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
    if (done) { toast('💧 A água chegou ao reservatório!'); onWin(); }
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
  const t = 'Conecte os fios que têm o mesmo símbolo para reativar o foguete! Toque num símbolo da esquerda e depois no igual da direita.';
  layer(`<div class="wboard" id="wb" style="${pos(B)}"><svg class="lines" id="lines" viewBox="0 0 ${B[2]} ${B[3]}"></svg>
      ${left.map((s, i) => `<button class="wnode" data-side="L" data-s="${s}" style="left:${LX}px;top:${yOf(i) - 23}px"><img src="${A(`node_l${SYM[s].l}.png`)}" alt="${SYM[s].name}"></button>`).join('')}
      ${right.map((s, i) => `<button class="wnode" data-side="R" data-s="${s}" style="left:${RX}px;top:${yOf(i) - 23}px"><img src="${A(`node_r${SYM[s].r}.png`)}" alt="${SYM[s].name}"></button>`).join('')}
    </div>
    <div class="timer-ov" id="timer" style="${pos([150, 166, 64, 22])}"></div>
    <button class="hot" id="mgx" style="${pos([290, 60, 38, 36])};border-radius:50%" aria-label="Sair"></button>
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
    else { rb.classList.remove('bad'); void rb.offsetWidth; rb.classList.add('bad'); toast('❌ Símbolo diferente!'); }
    sel.classList.remove('sel'); sel = null; temp = ''; redraw();
    if (done.size === n) { toast('⚡ Foguete reativado!'); onWin(); }
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

/* ================= dormir ================= */
const sleepGain = () => Math.round((S.fedToday ? 30 : 15) * D().sleep);
function renderSleep() {
  const t = `Descansar recupera ${sleepGain()} de energia, enche o oxigênio e avança 1 dia. As plantas crescem durante a noite!`;
  layer(`<button class="hot" id="sleepGo" style="${pos([70, 388, 188, 44])};border-radius:22px" aria-label="Dormir"></button>
    <div class="abs" style="left:286px;top:345px">${sayBtn(t + (S.fedToday ? '' : ' Dica: colha uma planta antes de dormir, assim o Zuno recupera mais energia!'))}</div>`);
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
  f.textContent = `☀️ Dia ${S.day}`;
  await wait(1000);
  f.classList.remove('on');
  go('home');
  const ready = S.plots.filter(p => p.crop && p.left <= 0).length;
  robot(`Bom dia! Zuno recuperou <b>${gain}</b> de energia e o oxigênio foi reabastecido.${grown ? ` 🌱 ${grown} planta(s) cresceram.` : ''}${ready ? ` <b>${ready}</b> pronta(s) para colher!` : ''}`);
}

/* ================= final ================= */
function renderEnd() {
  const t = `Missão cumprida! Você consertou o foguete em ${S.day} dias e o Zuno voltou para a família dele. Obrigado, astronauta! Quem sabe um dia você vai para o espaço de verdade!`;
  layer(`<div class="story" style="gap:8px;padding-top:22px">
    <div class="logo" style="font-size:30px;text-align:center;line-height:1.1">MISSÃO<br>CUMPRIDA!</div>
    <div class="scene" style="height:190px"><img src="${A('moon_scene.png')}" style="left:-15px;top:-10px;width:330px;height:210px;object-fit:cover" alt="">
      <img id="rk" src="${A('rocket.png')}" style="left:110px;top:20px;width:110px" alt="Foguete"></div>
    <div class="story-text glass" style="padding:8px 10px;font-size:13px"><p style="flex:1">${t}</p>${sayBtn(t)}</div>
    <table class="dtab" style="font-size:12px"><tr><td>Dias na Lua</td><td>${S.day}</td></tr><tr><td>Expedições</td><td>${S.stats.explored}</td></tr><tr><td>Colheitas</td><td>${S.stats.harvested}</td></tr><tr><td>Sucata coletada</td><td>${S.stats.scrapTotal}</td></tr></table>
    <button class="pill-btn green" id="again">🔄 JOGAR DE NOVO</button></div>`);
  setTimeout(() => { const r = $('#rk'); if (r) r.classList.add('fly'); }, 900);
  for (let i = 0; i < 22; i++) { const c = document.createElement('div'); c.className = 'confetti'; c.textContent = ['⭐', '✨', '🎉', '💚'][i % 4]; c.style.left = rnd(0, 310) + 'px'; c.style.animationDelay = (i * .12) + 's'; $('#layer').appendChild(c); }
  if (S.voice) speak(t);
  $('#again').onclick = newGame;
}

/* ================= dados NASA ================= */
const statusTag = s => ({ live: '<span class="status live">AO VIVO</span>', cache: '<span class="status cache">CACHE</span>', off: '<span class="status off">OFFLINE</span>', load: '<span class="status load">carregando</span>' }[s] || '');
function openNasa() {
  const o = NASA.osdr, s = SITES[S.site];
  const t = 'Estes são os dados reais da NASA usados no jogo: estudos de plantas da OSDR e o relevo da Lua medido pela sonda LRO.';
  modal('DADOS DA NASA', `<div class="say-row"><p style="font-size:12px">${t}</p>${sayBtn(t)}</div>
    <h3 class="sec">🌱 NASA OSDR ${statusTag(o.status)}</h3>
    <table class="dtab">
      <tr><td><a href="https://osdr.nasa.gov/bio/repo/data/studies/OSD-895" target="_blank" rel="noopener">OSD-895</a></td><td>${esc(o.title895)}</td></tr>
      <tr><td>Pepino / Alface / Rabanete</td><td>${o.cucumberKg} / ${o.lettuceKg} / ${o.radishKg} kg (total &gt;${o.totalKg} kg em ${o.seasonDays} dias)</td></tr>
      <tr><td>Luz / fotoperíodo</td><td>${o.light} µmol/m²/s (rabanete ${o.radishLight}) · ${o.photoperiod} h/dia</td></tr>
      <tr><td><a href="https://osdr.nasa.gov/bio/repo/data/studies/OSD-883" target="_blank" rel="noopener">OSD-883</a></td><td>${esc(o.title883)}</td></tr>
      <tr><td>Dias até coleta</td><td>Alface ${o.lettuceDays} · Rabanete ${o.radishDays}</td></tr>
      <tr><td>No jogo</td><td>dias = dias reais ÷ 7 (× nível) · elixir = 10 + kg × 0,35 · pepino colhe 3× (spread harvest)</td></tr>
    </table>
    <h3 class="sec">🌕 LRO / LOLA ${statusTag(NASA.lro.status)}</h3>
    <table class="dtab">
      <tr><td>Região</td><td>${s.name} (${s.lat}, ${s.lon})</td></tr>
      <tr><td>Camadas</td><td>LRO_LOLA_DEM_Global_128ppd_v04 (elevação) e LRO_LOLA_ClrShade (relevo)</td></tr>
      <tr><td>No jogo</td><td>altitude e inclinação de cada local → custo de oxigênio e quantidade de sucata</td></tr>
      <tr><td>Fonte</td><td><a href="https://trek.nasa.gov/moon/" target="_blank" rel="noopener">NASA Moon Trek</a></td></tr>
    </table>`);
}

/* ================= controle parental ================= */
function parentalGate(next) {
  const a = rnd(6, 9), b = rnd(6, 9);
  modal('ÁREA DOS PAIS', `<p style="text-align:center">Para continuar, responda: <b>${a} × ${b} = ?</b></p>
    <div class="gate" style="margin-top:8px"><input id="gateIn" type="number" inputmode="numeric" autocomplete="off"></div>
    <div class="actions"><button class="pill-btn green" id="gateOk">ENTRAR</button></div>`, m => {
    const ok = () => { if (+$('#gateIn', m).value === a * b) { closeModal(); next(); } else toast('Resposta incorreta'); };
    $('#gateOk', m).onclick = ok; $('#gateIn', m).onkeydown = e => { if (e.key === 'Enter') ok(); }; $('#gateIn', m).focus();
  });
}
function openSettings() {
  const p = S.parental;
  modal('MODO SUPERVISÃO', `
    <div class="set-row"><span>Limite diário de tela</span><select id="lim">${[0, 15, 30, 45, 60, 90].map(v => `<option value="${v}" ${v === p.limitMin ? 'selected' : ''}>${v ? v + ' min' : 'Sem limite'}</option>`).join('')}</select></div>
    <div class="set-row"><span>Tempo jogado hoje</span><b>${Math.floor(p.usedSec / 60)} min</b></div>
    <div class="set-row"><span>Idade da criança</span><select id="age">${[7, 8, 9, 10, 11, 12].map(v => `<option ${v === S.age ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    <div class="set-row"><span>Narração do robô</span><select id="voice"><option value="1" ${S.voice ? 'selected' : ''}>Ligada</option><option value="0" ${S.voice ? '' : 'selected'}>Desligada</option></select></div>
    <div class="actions"><button class="pill-btn red small" id="reset">🗑️ REINICIAR</button><button class="pill-btn green" data-close>SALVAR</button></div>`, m => {
    $('#lim', m).onchange = e => { p.limitMin = +e.target.value; save(); };
    $('#age', m).onchange = e => { S.age = +e.target.value; S.diff = ageToDiff(S.age); S.o2 = Math.min(S.o2, o2Max()); save(); hud(); toast('Nível: ' + D().name); };
    $('#voice', m).onchange = e => { S.voice = e.target.value === '1'; save(); };
    // confirmação dentro do jogo (o confirm() nativo é bloqueado em alguns navegadores)
    $('#reset', m).onclick = () => modal('REINICIAR?', `<div class="say-row"><p style="text-align:center">Apagar todo o progresso e começar um jogo novo? Isso não pode ser desfeito.</p>${sayBtn('Apagar todo o progresso e começar um jogo novo? Isso não pode ser desfeito.')}</div>
      <div class="actions"><button class="pill-btn blue" data-close>CANCELAR</button><button class="pill-btn red" id="resetYes">SIM, REINICIAR</button></div>`,
      m2 => { $('#resetYes', m2).onclick = newGame; }, { noX: true });
  });
}
function checkLimit() {
  const p = S.parental;
  if (p.date !== today()) { p.date = today(); p.usedSec = 0; }
  const over = p.limitMin > 0 && p.usedSec >= p.limitMin * 60;
  if (over && !$('#lock')) {
    stopMG();
    const t = 'Hora de descansar! O Zuno também precisa dormir. Volte amanhã para continuar a missão.';
    const lock = document.createElement('div'); lock.id = 'lock'; lock.className = 'lock';
    lock.innerHTML = `<img src="${A('zuno_sleep.png')}" style="width:240px;border-radius:18px" alt=""><div class="logo" style="font-size:24px">HORA DE DESCANSAR</div>
      <div class="story-text glass" style="padding:8px 10px"><p style="flex:1">${t}</p>${sayBtn(t)}</div><button class="pill-btn blue small" id="unlock">Área dos pais</button>`;
    $('#screen').appendChild(lock);
    if (S.voice) speak(t);
    $('#unlock').onclick = () => parentalGate(() => { p.limitMin = 0; save(); lock.remove(); toast('Limite removido para hoje'); });
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
  b.style.backgroundImage = cfg ? `url(${A(cfg.bg)})` : 'none';
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
