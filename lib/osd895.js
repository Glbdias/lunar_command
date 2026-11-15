// Integração com o estudo NASA OSDR OSD-895 (estufa EDEN ISS, Antártida, 2018).
// As medições NÃO vêm no JSON da API: o JSON lista os arquivos do estudo, e os valores estão
// nas tabelas ISA (TSV) dentro do ZIP de metadados. Este módulo:
//   1) consulta https://osdr.nasa.gov/osdr/data/osd/files/895
//   2) localiza o ZIP de metadados ISA e baixa via remote_url (+ domínio osdr.nasa.gov)
//   3) lê s_OSD-895.txt e o arquivo de ensaio a_OSD-895_*.txt e une os registros por Sample Name
// Sem dependências: o ZIP é lido com zlib do próprio Node.
'use strict';
const zlib = require('zlib');

const STUDY = 'OSD-895';
const OSDR = 'https://osdr.nasa.gov';
const FILES_API = `${OSDR}/osdr/data/osd/files/895`;

// ---------- leitor de ZIP (diretório central) ----------
function unzip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('ZIP inválido (fim do diretório não encontrado)');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = {};
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('ZIP inválido (diretório central)');
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const loff = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    p += 46 + nlen + xlen + clen;
    if (name.endsWith('/')) continue;
    const start = loff + 30 + buf.readUInt16LE(loff + 26) + buf.readUInt16LE(loff + 28);
    const data = buf.subarray(start, start + csize);
    files[name.split('/').pop()] = method === 8 ? zlib.inflateRawSync(data) : method === 0 ? data : null;
  }
  return files;
}

// ---------- tabelas ISA (TSV) ----------
function parseTSV(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  const cells = l => l.split('\t').map(c => c.trim().replace(/^"|"$/g, '').trim());
  return { header: cells(lines[0]), rows: lines.slice(1).map(cells) };
}
// valor + unidade: a coluna "Unit" vem logo depois do parâmetro
function field(table, row, name) {
  const i = table.header.indexOf(name);
  if (i < 0) return { value: null, unit: null, field: name, missing: 'coluna ausente' };
  const unit = table.header[i + 1] === 'Unit' ? (row[i + 1] || null) : null;
  return { raw: row[i] ?? '', unit, field: name };
}
const NA = v => v == null || v === '' || /^not\s*applicable$/i.test(v) || /^n\/?a$/i.test(v);
function num(f, expectUnit) {
  if (NA(f.raw)) return { ...f, value: null, missing: 'sem medição no estudo' };
  const v = Number(String(f.raw).replace(',', '.'));
  if (!Number.isFinite(v)) return { ...f, value: null, missing: 'valor não numérico' };
  if (expectUnit && f.unit !== expectUnit) return { ...f, value: null, missing: `unidade inesperada (${f.unit})` };
  return { ...f, value: v };
}
function range(f, expectUnit) {
  if (NA(f.raw)) return { ...f, min: null, max: null, missing: 'sem faixa no estudo' };
  const m = String(f.raw).match(/^\s*([\d.]+)\s*[-–]\s*([\d.]+)\s*$/);
  if (!m) return { ...f, min: null, max: null, missing: 'faixa em formato inesperado' };
  if (expectUnit && f.unit !== expectUnit) return { ...f, min: null, max: null, missing: `unidade inesperada (${f.unit})` };
  return { ...f, min: Number(m[1]), max: Number(m[2]) };
}

const UNIT_DAY = 'day';
const UNIT_KGM2 = 'kilogram per square meter';

function extract(files) {
  const sName = Object.keys(files).find(n => /^s_OSD-895\.txt$/i.test(n));
  const aName = Object.keys(files).find(n => /^a_OSD-895_.*\.txt$/i.test(n));
  if (!sName || !aName) throw new Error('Tabelas ISA do OSD-895 não encontradas no ZIP');
  const s = parseTSV(files[sName].toString('utf8')), a = parseTSV(files[aName].toString('utf8'));
  const iSa = a.header.indexOf('Sample Name'), iSs = s.header.indexOf('Sample Name');
  const assay = new Map(a.rows.map(r => [r[iSa], r]));
  const records = s.rows.map(r => {
    const sample = r[iSs], ar = assay.get(sample);
    const light = field(s, r, 'Factor Value[Light Treatment]');
    const rec = {
      sampleName: sample,
      organism: field(s, r, 'Characteristics[Organism]').raw || null,
      cultivar: field(s, r, 'Characteristics[cultivar]').raw || null,
      light: light.raw ? `${light.raw}${light.unit ? ' ' + light.unit : ''}` : null,
      harvestType: (field(s, r, 'Parameter Value[Harvest Type]').raw || '').toLowerCase() || null,
      cyclesEvaluated: num(field(s, r, 'Parameter Value[Cycles Evaluated]')).value,
      sources: { sample: sName, assay: aName }
    };
    if (!ar) return { ...rec, age: { value: null, missing: 'sem registro no ensaio' }, meanEdibleFreshweight: { value: null, missing: 'sem registro no ensaio' }, edibleFreshweightRange: { min: null, max: null, missing: 'sem registro no ensaio' } };
    rec.age = num(field(a, ar, 'Parameter Value[Age At Sample Harvest]'), UNIT_DAY);
    rec.meanEdibleFreshweight = num(field(a, ar, 'Parameter Value[Mean Edible Freshweight]'), UNIT_KGM2);
    rec.edibleFreshweightRange = range(field(a, ar, 'Parameter Value[Edible Freshweight Range]'), UNIT_KGM2);
    return rec;
  });
  return records;
}

async function getJSON(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} em ${url}`);
  return r.json();
}
async function getBuffer(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} em ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

// Busca tudo na NASA e devolve os registros já unidos (sem arredondar nada).
async function fetchOSD895() {
  const list = await getJSON(FILES_API);
  const study = list.studies && list.studies[STUDY];
  const files = (study && study.study_files) || [];
  const zip = files.find(f => /metadata.*ISA\.zip$/i.test(f.file_name)) || files.find(f => /\.zip$/i.test(f.file_name));
  if (!zip || !zip.remote_url) throw new Error('ZIP de metadados ISA não listado pela API');
  const zipUrl = OSDR + zip.remote_url;
  const records = extract(unzip(await getBuffer(zipUrl)));
  return {
    source: {
      study: STUDY,
      title: 'Biomass Production of the EDEN ISS Space Greenhouse in Antarctica During the 2018 Experiment Phase',
      location: 'Estufa EDEN ISS, estação Neumayer III, Antártida (Terra)',
      filesApi: FILES_API, zipFile: zip.file_name, zipUrl,
      studyPage: `${OSDR}/bio/repo/data/studies/${STUDY}`,
      fetchedAt: new Date().toISOString()
    },
    records
  };
}

module.exports = { fetchOSD895, unzip, parseTSV, extract, FILES_API };
