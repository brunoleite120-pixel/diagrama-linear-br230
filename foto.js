/*
 * Foto com carimbo: logo no canto escolhido e legenda com rodovia, km (SNV), lado/distância do eixo,
 * coordenadas, data e hora, ponto crítico identificado pelo km, contrato e descrição.
 * Usado pelo site local e embutido na página online (build.js troca o marcador). Precisa de MapaSNV.Ref
 * (mapa.js) e de window.SNV_BR230.
 *
 *   var f = FotoCarimbo({ snv, getContract, logoSrc, gps, share, saveBlob, notify,
 *                         getTeamLogo, canSetTeamLogo, setTeamLogo, clearTeamLogo });
 *   f.open({ pointId });
 *
 * De onde vem a posição, nesta ordem: GPS gravado na foto (EXIF), GPS do aparelho na hora da foto
 * (só onde o navegador libera), ou km digitado / ponto escolhido.
 */
(function () {
  'use strict';

  var KEY = 'diagrama-linear.foto';
  var LOGOS_KEY = 'diagrama-linear.foto-logos';           // logos adicionadas neste aparelho
  var LOGO_SEL_KEY = 'diagrama-linear.foto-logo-escolhida';
  var OLD_LOGO_KEY = 'diagrama-linear.foto-logo';           // versão 9: uma logo só
  var MESES = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
  var FIELDS = [
    { k: 'rodkm', label: 'Rodovia e km', on: true },
    { k: 'lado', label: 'Lado e distância do eixo', on: true },
    { k: 'coord', label: 'Coordenadas', on: true },
    { k: 'data', label: 'Data e hora', on: true },
    { k: 'ponto', label: 'Ponto crítico', on: true },
    { k: 'contrato', label: 'Lote e contrato', on: false },
    { k: 'executora', label: 'Executora', on: false },
    { k: 'supervisora', label: 'Supervisora', on: false },
    { k: 'desc', label: 'Descrição', on: true },
    { k: 'snv', label: 'Versão do SNV', on: true }
  ];
  var CORNERS = [['tl', 'Sup. esq.'], ['tr', 'Sup. dir.'], ['bl', 'Inf. esq.'], ['br', 'Inf. dir.']];
  var COLORS = { amarelo: '#FFE81A', branco: '#FFFFFF' };
  var SIZES = { P: 0.024, M: 0.031, G: 0.04 };

  function defaults() {
    var campos = {};
    FIELDS.forEach(function (f) { campos[f.k] = f.on; });
    return { logo: 'tl', leg: 'bl', cor: 'amarelo', tam: 'M', fundo: 'sombra', logoFundo: true, logoOn: true, campos: campos };
  }
  function loadSet() {
    var d = defaults();
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (s && typeof s === 'object') {
        ['logo', 'leg', 'cor', 'tam', 'fundo'].forEach(function (k) { if (typeof s[k] === 'string') d[k] = s[k]; });
        ['logoFundo', 'logoOn'].forEach(function (k) { if (typeof s[k] === 'boolean') d[k] = s[k]; });
        if (s.campos) FIELDS.forEach(function (f) { if (typeof s.campos[f.k] === 'boolean') d.campos[f.k] = s.campos[f.k]; });
      }
    } catch (e) { /* sem armazenamento: usa o padrão */ }
    return d;
  }
  function saveSet(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* sem armazenamento */ } }

  // ------------------------------------------------------------------ formatação
  function nf(n, d) { return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function coordTxt(ll) {
    function f(v) { var s = Math.abs(v).toFixed(5).replace('.', ','); if (s.indexOf(',') < 2) s = '0' + s; return (v < 0 ? '-' : '') + s; }
    return f(ll[0]) + '/' + f(ll[1]);
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dateTxt(d) { return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function dateInput(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function snvTxt(v) { var m = /^(\d{4})(\d{2})/.exec(String(v || '')); return m ? 'SNV: ' + MESES[Number(m[2]) - 1] + '/' + m[1].slice(2) : ''; }
  function parseNum(v) {
    var t = String(v == null ? '' : v).trim().replace(/\s/g, '').replace(/^km/i, '');
    if (!t) return null;
    if (t.indexOf(',') >= 0) t = t.replace(/\./g, '').replace(',', '.');
    var n = Number(t);
    return isFinite(n) ? n : null;
  }

  // ------------------------------------------------------------------ EXIF (JPEG): GPS e data da foto
  function readExif(buf) {
    try {
      var v = new DataView(buf);
      if (v.byteLength < 4 || v.getUint16(0) !== 0xFFD8) return null;
      var off = 2;
      while (off + 4 <= v.byteLength) {
        var marker = v.getUint16(off);
        if ((marker & 0xFF00) !== 0xFF00) return null;
        var len = v.getUint16(off + 2);
        if (marker === 0xFFE1 && off + 10 <= v.byteLength && v.getUint32(off + 4) === 0x45786966) return parseTiff(v, off + 10, off + 2 + len);
        if (marker === 0xFFDA) return null;
        off += 2 + len;
      }
    } catch (e) { /* EXIF ilegível */ }
    return null;
  }
  function parseTiff(v, start, end) {
    var le = v.getUint16(start) === 0x4949;
    function u16(o) { return v.getUint16(start + o, le); }
    function u32(o) { return v.getUint32(start + o, le); }
    function ifd(o) {
      var tags = {}, n = u16(o);
      for (var i = 0; i < n; i++) { var e = o + 2 + i * 12; tags[u16(e)] = { type: u16(e + 2), count: u32(e + 4), at: e + 8 }; }
      return tags;
    }
    function dataAt(t) { var unit = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 }[t.type] || 1; return unit * t.count > 4 ? u32(t.at) : t.at; }
    function ascii(t) { var o = dataAt(t), s = ''; for (var i = 0; i < t.count - 1 && start + o + i < end; i++) s += String.fromCharCode(v.getUint8(start + o + i)); return s; }
    function rats(t) { var o = dataAt(t), r = []; for (var i = 0; i < t.count; i++) { var den = u32(o + i * 8 + 4); r.push(den ? u32(o + i * 8) / den : 0); } return r; }
    var out = {}, ifd0 = ifd(u32(4));
    if (ifd0[0x8769]) {
      var ex = ifd(u32(ifd0[0x8769].at)), dt = ex[0x9003] || ex[0x9004];
      if (dt) out.date = ascii(dt);
    }
    if (!out.date && ifd0[0x0132]) out.date = ascii(ifd0[0x0132]);
    if (ifd0[0x8825]) {
      var g = ifd(u32(ifd0[0x8825].at));
      out.gpsTags = true;
      if (g[2] && g[4]) {
        var la = rats(g[2]), lo = rats(g[4]);
        var lat = la[0] + la[1] / 60 + la[2] / 3600, lon = lo[0] + lo[1] / 60 + lo[2] / 3600;
        if (g[1] && ascii(g[1]).toUpperCase() === 'S') lat = -lat;
        if (g[3] && ascii(g[3]).toUpperCase() === 'W') lon = -lon;
        if (isFinite(lat) && isFinite(lon) && (lat !== 0 || lon !== 0)) out.ll = [lat, lon];
        else out.gpsZero = true;   // Android 10+: o sistema zera o GPS antes de entregar a foto a quem não tem permissão
      }
    }
    if (out.date) {
      var m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2})/.exec(out.date);
      out.date = m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null;
    }
    return out;
  }


  // XMP: alguns aplicativos de câmera gravam o GPS só aqui (exif:GPSLatitude="3,52.1234S" ou "3,52,7.4S")
  function xmpCoord(s) {
    var m = /^\s*(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)(?:,(\d+(?:\.\d+)?))?\s*([NSEW])\s*$/i.exec(s || '');
    if (!m) return null;
    var v = Number(m[1]) + Number(m[2]) / 60 + (m[3] ? Number(m[3]) / 3600 : 0);
    return /[SW]/i.test(m[4]) ? -v : v;
  }
  function readXmp(buf) {
    try {
      var bytes = new Uint8Array(buf), txt = '';
      for (var i = 0; i < bytes.length; i += 32768) txt += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(bytes.length, i + 32768)));
      var a = txt.indexOf('<x:xmpmeta');
      if (a < 0) return null;
      var b = txt.indexOf('</x:xmpmeta>', a), x = txt.slice(a, b > a ? b : a + 65536);
      function get(name) { var m = new RegExp(name + '\\s*=\\s*"([^"]+)"').exec(x) || new RegExp('<' + name + '>([^<]+)<').exec(x); return m ? m[1] : null; }
      var lat = xmpCoord(get('exif:GPSLatitude')), lon = xmpCoord(get('exif:GPSLongitude'));
      return lat != null && lon != null && (lat !== 0 || lon !== 0) ? [lat, lon] : null;
    } catch (e) { return null; }
  }
  function isHeif(buf) {
    try { return /^ftyp(heic|heix|hevc|hevx|mif1|msf1|avif)/.test(String.fromCharCode.apply(null, new Uint8Array(buf, 4, 8))); } catch (e) { return false; }
  }
  // tudo o que der para tirar do arquivo: GPS (EXIF ou XMP) e data
  // (exif/gpsTags/gpsZero/heif ajudam a explicar por que a foto chegou sem localização)
  function readMeta(buf) {
    var r = readExif(buf), ex = r || {};
    ex.exif = !!r;
    ex.heif = isHeif(buf);
    if (ex.ll) ex.via = 'exif';
    else { var x = readXmp(buf); if (x) { ex.ll = x; ex.via = 'xmp'; ex.gpsZero = false; } }
    return ex;
  }
  function isAndroid() { return /Android/i.test(navigator.userAgent || ''); }

  // ------------------------------------------------------------------ estilo
  var CSS = [
    '.ft{--ft-bg:var(--bg,var(--ground,#F1F3F1));--ft-panel:var(--panel,#FFFFFF);--ft-ink:var(--ink,#17201C);--ft-ink-2:var(--ink-2,#3B4540);--ft-ink-3:var(--ink-3,#5C6661);--ft-line:var(--line,#D5DAD6);--ft-accent:var(--accent,#1D4F91);--ft-accent-ink:var(--accent-ink,#FFFFFF);',
    '  position:fixed;inset:0;z-index:3000;display:flex;flex-direction:column;background:var(--ft-bg);color:var(--ft-ink);font-size:14px;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)}',
    '.ft-head{display:flex;align-items:center;gap:10px;padding:10px 16px;background:var(--ft-panel);border-bottom:1px solid var(--ft-line)}',
    '.ft-head h2{margin:0;font-size:16px;font-weight:650;white-space:nowrap}',
    '.ft-ct{font-size:12.5px;color:var(--ft-ink-3);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}',
    '.ft-x{border:1px solid var(--ft-line);background:var(--ft-panel);color:var(--ft-ink);border-radius:8px;min-width:36px;min-height:36px;font-size:20px;line-height:1;cursor:pointer}',
    '.ft-body{flex:1;overflow:auto;padding:16px}',
    '.ft-start{max-width:520px;margin:4vh auto 0;display:flex;flex-direction:column;gap:12px}',
    '.ft-start h3{margin:0;font-size:18px;text-wrap:balance}',
    '.ft-start p{margin:0;color:var(--ft-ink-2);line-height:1.5}',
    '.ft-big{display:flex;align-items:center;justify-content:center;gap:10px;min-height:56px;border-radius:10px;border:1px solid var(--ft-accent);background:var(--ft-accent);color:var(--ft-accent-ink);font-family:inherit;font-size:16px;font-weight:650;cursor:pointer}',
    '.ft-big.alt{background:var(--ft-panel);color:var(--ft-accent)}',
    '.ft-big svg{width:22px;height:22px}',
    '.ft-big:focus-within{outline:2px solid var(--ft-accent);outline-offset:2px}',
    '.ft-file{position:absolute;width:1px;height:1px;opacity:0;overflow:hidden;pointer-events:none}',
    '.ft-gps{font-size:13px;padding:10px 12px;border-radius:8px;background:var(--ft-panel);border:1px solid var(--ft-line);font-variant-numeric:tabular-nums}',
    '.ft-gps b{font-family:var(--font-mono,ui-monospace,Consolas,monospace)}',
    '.ft-work{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px;align-items:start}',
    '.ft-prev{position:sticky;top:0;background:#000;border-radius:8px;overflow:hidden;display:flex;justify-content:center}',
    '.ft-prev canvas{display:block;max-width:100%;max-height:calc(100vh - 150px);width:auto;height:auto}',
    '.ft-side{display:flex;flex-direction:column;gap:12px;min-width:0}',
    '.ft-sec{background:var(--ft-panel);border:1px solid var(--ft-line);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:10px}',
    '.ft-sec h4{margin:0;font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--ft-ink-3)}',
    '.ft-src{font-size:12.5px;color:var(--ft-ink-2);line-height:1.45}',
    '.ft-src b{color:var(--ft-ink)}',
    '.ft-warn{color:var(--danger,#B42318);font-weight:600}',
    '.ft-lot{display:flex;flex-direction:column;gap:8px;padding:9px 11px;border:1px solid var(--danger,#B42318);border-left-width:4px;border-radius:8px;background:var(--ft-panel);background:color-mix(in srgb,var(--danger,#B42318) 7%,var(--ft-panel));font-size:13px;line-height:1.45;color:var(--ft-ink)}',
    '.ft-lot b{font-weight:700}',
    '.ft-lot .ft-opts{gap:6px}',
    '.ft-lot .ft-fix{background:var(--ft-accent);border-color:var(--ft-accent);color:var(--ft-accent-ink)}',
    '.ft-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
    '.ft-f{display:flex;flex-direction:column;gap:3px;min-width:0}',
    '.ft-f.full{grid-column:1/-1}',
    '.ft-f span{font-size:11.5px;font-weight:600;color:var(--ft-ink-3)}',
    '.ft input,.ft select,.ft textarea{font:inherit;color:var(--ft-ink);background:var(--ft-panel);border:1px solid var(--ft-line);border-radius:6px;min-height:34px;padding:4px 8px;width:100%;min-width:0}',
    '.ft textarea{min-height:58px;resize:vertical}',
    '.ft input:focus-visible,.ft select:focus-visible,.ft textarea:focus-visible,.ft button:focus-visible{outline:2px solid var(--ft-accent);outline-offset:1px}',
    '.ft-checks{display:grid;grid-template-columns:1fr 1fr;gap:6px 10px}',
    '.ft-checks label{display:flex;align-items:center;gap:7px;font-size:13px;min-height:28px}',
    '.ft-checks input{width:18px;height:18px;min-height:0;margin:0;flex:none;accent-color:var(--ft-accent)}',
    '.ft-opts{display:flex;flex-wrap:wrap;gap:6px}',
    '.ft-opt{border:1px solid var(--ft-line);background:var(--ft-panel);color:var(--ft-ink-2);border-radius:6px;min-height:32px;padding:4px 10px;font:inherit;font-size:12.5px;font-weight:600;cursor:pointer}',
    '.ft-opt[aria-pressed="true"]{background:var(--ft-ink);border-color:var(--ft-ink);color:var(--ft-panel)}',
    '.ft-corners{display:grid;grid-template-columns:1fr 1fr;gap:6px;width:100%}',
    '.ft-logos{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:6px}',
    '.ft-logo{display:flex;flex-direction:column;align-items:stretch;gap:4px;padding:6px;border:1px solid var(--ft-line);border-radius:8px;background:var(--ft-panel);color:var(--ft-ink);font:inherit;font-size:12px;font-weight:600;text-align:left;cursor:pointer;min-width:0}',
    '.ft-logo img{display:block;width:100%;height:52px;object-fit:contain;background:repeating-conic-gradient(#D9DDDA 0 25%,#F4F6F4 0 50%) 0 0/12px 12px;border-radius:4px}',
    '.ft-logo span{display:flex;flex-direction:column;gap:1px;overflow-wrap:anywhere}',
    '.ft-logo small{font-weight:600;color:var(--ft-accent)}',
    '.ft-logo[aria-pressed="true"]{border-color:var(--ft-accent);box-shadow:0 0 0 2px var(--ft-accent)}',
    '.ft-row{display:flex;flex-direction:column;gap:5px}',
    '.ft-row>span{font-size:11.5px;font-weight:600;color:var(--ft-ink-3)}',
    '.ft-foot{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;padding:10px 16px;background:var(--ft-panel);border-top:1px solid var(--ft-line)}',
    '.ft-btn{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:6px 16px;border:1px solid var(--ft-line);border-radius:8px;background:var(--ft-panel);color:var(--ft-ink);font:inherit;font-size:14px;font-weight:650;cursor:pointer}',
    '.ft-btn.primary{background:var(--ft-accent);border-color:var(--ft-accent);color:var(--ft-accent-ink)}',
    '.ft-btn[disabled]{opacity:.6;cursor:progress}',
    '.ft [hidden]{display:none!important}',
    '.ft-sub{font-size:13px;font-weight:600;opacity:.85}',
    // várias fotos de uma vez
    '.ft:not(.many) .ft-many,.ft.many .ft-one{display:none}',
    '.ft-batch{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px;align-items:start}',
    '.ft-bmain{display:flex;flex-direction:column;gap:10px;min-width:0}',
    '.ft-blist{display:flex;flex-direction:column;gap:10px}',
    '.ft-bstat{font-variant-numeric:tabular-nums}',
    '.ft-item{display:grid;grid-template-columns:minmax(0,260px) minmax(0,1fr);gap:12px;align-items:start;padding:10px;background:var(--ft-panel);border:1px solid var(--ft-line);border-radius:10px}',
    '.ft-item.err{border-color:var(--danger,#B42318)}',
    '.ft-thumb{background:#000;border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center;min-height:150px;color:#C9CFCB;font-size:12.5px}',
    '.ft-thumb img{display:block;max-width:100%;max-height:320px;width:auto;height:auto}',
    '.ft-ifields{display:flex;flex-direction:column;gap:8px;min-width:0}',
    '.ft-ihead{display:flex;align-items:center;justify-content:space-between;gap:8px}',
    '.ft-iname{font-weight:650;font-size:13px;overflow-wrap:anywhere;min-width:0}',
    '.ft-prog{margin-right:auto;align-self:center;font-size:13px;color:var(--ft-ink-2);font-variant-numeric:tabular-nums}',
    '.ft-dstat{align-self:center;font-size:12.5px;color:var(--ft-ink-2);flex:1 1 180px;min-width:0}',
    '.ft-prog:not(:empty)+.ft-dstat{flex-basis:100%;order:-1}',
    '.ft-src small{display:block;margin-top:4px;color:var(--ft-ink-3);font-variant-numeric:tabular-nums}',
    '.ft-note a{color:var(--ft-accent);font-weight:600}',
    // câmera dentro do app
    '.ft.camming .ft-head{display:none}',
    '.ft.camming .ft-body{padding:0;overflow:hidden;background:#000}',
    '.ft-cam{height:100%;display:flex;flex-direction:column;background:#000;color:#fff}',
    '.ft-camview{position:relative;flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden}',
    '.ft-camview video{display:block;width:100%;height:100%;object-fit:contain;background:#000}',
    '.ft-camgps{position:absolute;left:10px;right:10px;top:10px;padding:7px 11px;border-radius:8px;background:rgba(0,0,0,.62);font-size:13px;line-height:1.45;font-variant-numeric:tabular-nums}',
    '.ft-camgps b{color:#FFE81A}',
    '.ft-camgps .ft-warn{color:#FFB4A8}',
    '.ft-flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;transition:opacity .25s}',
    '.ft-flash.on{opacity:.7;transition:none}',
    '.ft-camctl{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;padding:14px 16px}',
    '.ft-camb{justify-self:start;display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:6px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.4);background:transparent;color:#fff;font:inherit;font-size:14px;font-weight:650;cursor:pointer}',
    '.ft-camdone{justify-self:end}',
    '.ft-camb[disabled]{opacity:.45;cursor:default}',
    '.ft-camlast{width:40px;height:40px;border-radius:6px;overflow:hidden;background:#333;flex:none}',
    '.ft-camlast img{width:100%;height:100%;object-fit:cover;display:block}',
    '.ft-shot{width:74px;height:74px;border-radius:50%;border:4px solid #fff;background:rgba(255,255,255,.2);cursor:pointer;padding:0}',
    '.ft-shot:active{background:#fff}',
    '.ft-shot[disabled]{opacity:.5}',
    // celular deitado: GPS numa coluna do lado de cima do celular, a imagem com toda a altura e os botões do lado de baixo
    // (como a câmera do celular); virando para o outro lado (.ft-cw), as colunas trocam de lado
    '@media (orientation:landscape) and (max-height:560px){' +
      '.ft.camming{background:#000}' +
      '.ft-cam{flex-direction:row}' +
      '.ft-camview{align-items:stretch}' +
      '.ft-camgps{position:static;order:-1;flex:0 0 clamp(150px,27%,260px);align-self:flex-start;margin:8px 0 8px 8px;max-height:calc(100% - 16px);overflow:auto;padding:6px 9px;font-size:12.5px;background:rgba(255,255,255,.08)}' +
      '.ft-cam.ft-cw,.ft-cw .ft-camview{flex-direction:row-reverse}' +
      '.ft-cw .ft-camgps{margin:8px 8px 8px 0}' +
      '.ft-camview video{flex:1;min-width:0;width:auto;height:100%}' +
      '.ft-camctl{grid-template-columns:none;grid-template-rows:1fr auto 1fr;justify-items:center;gap:8px;padding:8px 10px}' +
      '.ft-camb{align-self:start;justify-self:center;flex-direction:column;gap:4px;max-width:96px;padding:6px 8px;font-size:13px;text-align:center}' +
      '.ft-camdone{align-self:end}' +
      '.ft-camlast{width:34px;height:34px}' +
      '.ft-shot{width:64px;height:64px}' +
    '}',
    '@media (max-width:820px){.ft-work,.ft-batch{grid-template-columns:1fr}.ft-prev{position:static}.ft-prev canvas{max-height:58vh}.ft-body{padding:12px}}',
    '@media (max-width:560px){.ft-item{grid-template-columns:1fr}.ft-thumb img{max-height:52vh}}',
    '@media (max-width:420px){.ft-checks{grid-template-columns:1fr}}'
  ].join('\n');
  function injectStyle() {
    if (document.getElementById('ft-style')) return;
    var s = document.createElement('style');
    s.id = 'ft-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  var CAM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
  var ARQ = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
  var GAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/></svg>';

  function FotoCarimbo(opts) {
    var snv = opts.snv, Ref = window.MapaSNV && window.MapaSNV.Ref;
    if (!snv || !Ref) return null;
    injectStyle();
    var ref = Ref(snv), set = loadSet(), notify = opts.notify || function () {};
    var root = null, st = null, gpsWatch = null, lastFix = null, drawTimer = null, origin = 'camera';

    function q(sel) { return root.querySelector(sel); }
    // lote da foto: começa no lote aberto na página e pode ser corrigido pelo km
    function activeContract() { return opts.getContract ? opts.getContract() : null; }
    function contracts() {
      var l = opts.getContracts ? opts.getContracts() : null;
      if (l && l.length) return l;
      var c0 = activeContract();
      return c0 ? [c0] : [];
    }
    function byId(id) { var r = null; contracts().forEach(function (c) { if (c.id === id) r = c; }); return r; }
    function contract() { return (st && st.cid && byId(st.cid)) || activeContract(); }
    function lotName(c) { return c ? [c.lote, c.numero ? 'CT ' + c.numero : ''].filter(Boolean).join(' · ') || 'Contrato' : ''; }
    function numOr(v) { var n = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? n : null; }
    // trecho do contrato (km inicial e final); sem eles, a faixa dos pontos com 500 m de folga
    function lotRange(c) {
      var a = numOr(c.kmIni), b = numOr(c.kmFim);
      if (a == null || b == null) {
        var ks = [];
        (c.pontos || []).forEach(function (p) { if (p.kmIni != null) ks.push(p.kmIni); if (p.kmFim != null) ks.push(p.kmFim); });
        if (!ks.length) return null;
        a = Math.min.apply(null, ks) - 0.5; b = Math.max.apply(null, ks) + 0.5;
      }
      return a <= b ? [a, b] : [b, a];
    }
    function sameRoad(c) {
      function k(s) { return String(s || '').toUpperCase().replace(/\s+/g, '').replace(/^BR(\d)/, 'BR-$1').split('/')[0]; }
      return !c.rodovia || k(c.rodovia) === k(snv.rodovia || 'BR-230');
    }
    function lotsAt(km) {
      return contracts().filter(function (c) { var r = sameRoad(c) && lotRange(c); return r && km >= r[0] - 0.001 && km <= r[1] + 0.001; });
    }
    function has(list, c) { return !!c && list.some(function (x) { return x.id === c.id; }); }
    function rangeTxt(c) { var r = lotRange(c); return r ? 'km ' + nf(r[0], 2) + ' a ' + nf(r[1], 2) : ''; }
    function rodovia() { var c = contract(); return (c && c.rodovia) || snv.rodovia || 'BR-230/PA'; }

    function loadLogo(src) {
      return new Promise(function (resolve) {
        if (!src) { resolve(null); return; }
        var im = new Image();
        im.onload = function () { resolve(im); };
        im.onerror = function () { resolve(null); };
        im.src = src;
      });
    }

    // ---------------- interface
    function build() {
      root = document.createElement('div');
      root.className = 'ft';
      root.setAttribute('role', 'dialog');
      root.setAttribute('aria-modal', 'true');
      root.setAttribute('aria-labelledby', 'ftTitle');
      root.innerHTML =
        '<div class="ft-head"><h2 id="ftTitle">Foto com carimbo</h2><span class="ft-ct"></span><button type="button" class="ft-x" data-ft="close" aria-label="Fechar">×</button></div>' +
        '<div class="ft-body">' +
          '<div class="ft-start">' +
            '<h3>Tire a foto ou escolha uma da galeria</h3>' +
            '<div class="ft-gps"></div>' +
            (camSupported() ? '<button type="button" class="ft-big" data-ft="cam-open">' + CAM + 'Câmera com GPS <span class="ft-sub">· várias fotos</span></button>' : '') +
            '<label class="ft-big' + (camSupported() ? ' alt' : '') + '">' + CAM + (camSupported() ? 'Câmera do celular' : 'Tirar foto') + '<input class="ft-file" type="file" id="ftCam" accept="image/*" capture="environment"></label>' +
            '<label class="ft-big alt">' + GAL + 'Escolher da galeria<input class="ft-file" type="file" id="ftGal" accept="image/*"></label>' +
            '<label class="ft-big alt">' + ARQ + 'Arquivos do celular <span class="ft-sub">· uma ou várias</span><input class="ft-file" type="file" id="ftArq" multiple></label>' +
            '<p class="ft-msg ft-warn" hidden></p>' +
            '<p class="ft-note"></p>' +
          '</div>' +
          '<div class="ft-work" hidden>' +
            '<div class="ft-prev"><canvas aria-label="Prévia da foto com carimbo"></canvas></div>' +
            '<div class="ft-side">' +
              '<section class="ft-sec"><h4>Local</h4><div class="ft-lot" role="status" hidden></div><div class="ft-src"></div>' +
                '<div class="ft-opts ft-here" hidden><button type="button" class="ft-opt" data-ft="here">Usar o GPS do aparelho agora</button></div>' +
                '<div class="ft-grid">' +
                  '<label class="ft-f full" id="ftLoteWrap"><span>Lote / contrato da foto</span><select id="ftLote"></select></label>' +
                  '<label class="ft-f"><span>km</span><input id="ftKm" inputmode="decimal" autocomplete="off"></label>' +
                  '<label class="ft-f"><span>Ponto</span><select id="ftPonto"></select></label>' +
                  '<label class="ft-f"><span>Lado</span><select id="ftLado"><option value="">Eixo / não informar</option><option value="LE">LE · lado esquerdo</option><option value="LD">LD · lado direito</option></select></label>' +
                  '<label class="ft-f"><span>Distância do eixo (m)</span><input id="ftDl" inputmode="numeric" autocomplete="off"></label>' +
                  '<label class="ft-f full"><span>Data e hora</span><input id="ftData" type="datetime-local"></label>' +
                  '<label class="ft-f full"><span>Descrição</span><textarea id="ftDesc" maxlength="240" placeholder="Ex.: lançamento de enrocamento no bueiro"></textarea></label>' +
                '</div>' +
              '</section>' +
              '<section class="ft-sec ft-shared"><h4>O que aparece na legenda</h4><div class="ft-checks">' +
                FIELDS.map(function (f) { return '<label><input type="checkbox" id="ftC-' + f.k + '" data-campo="' + f.k + '">' + f.label + '</label>'; }).join('') +
              '</div></section>' +
              '<section class="ft-sec ft-shared"><h4>Aparência</h4>' +
                '<div class="ft-row"><span>Logo</span><div class="ft-opts" data-group="logoOn"></div><div class="ft-corners" data-group="logo"></div></div>' +
                '<div class="ft-row"><span>Legenda</span><div class="ft-corners" data-group="leg"></div></div>' +
                '<div class="ft-row"><span>Cor do texto</span><div class="ft-opts" data-group="cor"></div></div>' +
                '<div class="ft-row"><span>Tamanho</span><div class="ft-opts" data-group="tam"></div></div>' +
                '<div class="ft-row"><span>Fundo do texto</span><div class="ft-opts" data-group="fundo"></div></div>' +
                '<div class="ft-row"><span>Fundo da logo</span><div class="ft-opts" data-group="logoFundo"></div></div>' +
                '<div class="ft-row"><span>Qual logo</span><div class="ft-logos" role="group" aria-label="Logos disponíveis"></div>' +
                  '<div class="ft-opts"><label class="ft-opt">Adicionar logo (PNG ou JPG)<input class="ft-file" type="file" id="ftLogoFile" accept="image/png,image/jpeg,image/webp"></label>' +
                  '<button type="button" class="ft-opt" data-ft="logo-team" hidden>Usar como padrão da equipe</button>' +
                  '<button type="button" class="ft-opt" data-ft="logo-team-off" hidden>Tirar padrão da equipe</button>' +
                  '<button type="button" class="ft-opt" data-ft="logo-del" hidden>Remover esta logo</button></div>' +
                  '<div class="ft-src ft-logo-src"></div></div>' +
              '</section>' +
            '</div>' +
          '</div>' +
          '<div class="ft-batch" hidden>' +
            '<div class="ft-bmain">' +
              '<section class="ft-sec ft-bsum"><h4 class="ft-bcount">Fotos</h4><div class="ft-src ft-bstat"></div><div class="ft-lot ft-blot" role="status" hidden></div>' +
                '<label class="ft-f"><span>Descrição de todas as fotos</span><textarea id="ftBDesc" maxlength="240" placeholder="Ex.: lançamento de enrocamento no bueiro"></textarea></label>' +
                '<div class="ft-src">Cada foto também pode ter a própria descrição; se ficar em branco, vale esta.</div>' +
              '</section>' +
              '<div class="ft-blist"></div>' +
            '</div>' +
            '<div class="ft-side ft-bside"></div>' +
          '</div>' +
          '<div class="ft-cam" hidden>' +
            '<div class="ft-camview"><video playsinline muted autoplay aria-label="Prévia da câmera"></video><div class="ft-camgps" role="status"></div><div class="ft-flash"></div></div>' +
            '<div class="ft-camctl">' +
              '<button type="button" class="ft-camb" data-ft="cam-cancel">Fechar</button>' +
              '<button type="button" class="ft-shot" data-ft="cam-shot" aria-label="Fotografar"></button>' +
              '<button type="button" class="ft-camb ft-camdone" data-ft="cam-done" disabled><span class="ft-camlast" hidden></span><span class="ft-camn">Concluir</span></button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="ft-foot" hidden><span class="ft-prog ft-many" role="status"></span><span class="ft-dstat" role="status" hidden></span>' +
          '<button type="button" class="ft-btn" data-ft="new"><span class="ft-one">Nova foto</span><span class="ft-many">Nova seleção</span></button>' +
          '<button type="button" class="ft-btn ft-one ft-drv" data-ft="drive" hidden>Enviar ao Drive</button><button type="button" class="ft-btn ft-many ft-drv" data-ft="b-drive" hidden>Enviar todas ao Drive</button>' +
          (opts.share ? '<button type="button" class="ft-btn ft-one" data-ft="share">Compartilhar</button><button type="button" class="ft-btn ft-many" data-ft="b-share">Compartilhar todas</button>' : '') +
          '<button type="button" class="ft-btn primary ft-one" data-ft="save">Salvar foto</button>' +
          '<button type="button" class="ft-btn primary ft-many" data-ft="b-save">Salvar todas (.zip)</button></div>';
      root.addEventListener('click', onClick);
      root.addEventListener('input', onInput);
      root.addEventListener('change', onChange);
      root.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    }

    function renderOpts() {
      function group(name, items) {
        var el = q('[data-group="' + name + '"]');
        el.innerHTML = items.map(function (it) {
          return '<button type="button" class="ft-opt" data-set="' + name + '" data-val="' + it[0] + '" aria-pressed="' + (String(set[name]) === String(it[0])) + '">' + it[1] + '</button>';
        }).join('');
      }
      group('logoOn', [['true', 'Mostrar'], ['false', 'Sem logo']]);
      group('logoFundo', [['true', 'Branco'], ['false', 'Sem fundo']]);
      renderLogos();
      group('logo', CORNERS);
      group('leg', CORNERS);
      group('cor', [['amarelo', 'Amarelo'], ['branco', 'Branco']]);
      group('tam', [['P', 'Pequeno'], ['M', 'Médio'], ['G', 'Grande']]);
      group('fundo', [['sombra', 'Sombra'], ['faixa', 'Faixa escura'], ['nenhum', 'Sem fundo']]);
      q('[data-group="logo"]').hidden = !set.logoOn;
      FIELDS.forEach(function (f) { q('#ftC-' + f.k).checked = !!set.campos[f.k]; });
    }

    function startView() {
      stopCam();
      clearBatch();
      if (st && st.url) URL.revokeObjectURL(st.url);
      st = null;
      root.classList.remove('many');
      renderHead();
      q('.ft-start').hidden = false;
      q('.ft-work').hidden = true;
      q('.ft-batch').hidden = true;
      q('.ft-foot').hidden = true;
      startMsg('');
      var and = isAndroid(), h;
      if (camSupported()) {
        h = esc('"Câmera com GPS" tira várias fotos seguidas sem sair do app: o km, o ponto e o lote de cada foto vêm do GPS do celular na hora do clique. ' +
          (and ? 'É o jeito mais seguro no Android, que costuma apagar o local das fotos escolhidas na galeria ou nos arquivos. ' : '') +
          'Para fotos já tiradas, use "Arquivos do celular" (uma ou várias): o km sai da localização gravada em cada foto.');
      } else {
        h = esc((opts.gps
          ? 'O km sai do GPS do aparelho na hora da foto ou da localização gravada na foto. '
          : 'Neste link o navegador não informa a localização do aparelho: o km sai da localização gravada na foto. Deixe a câmera do celular salvando o local. ') +
          'Em "Arquivos do celular" dá para marcar várias fotos de uma vez: cada uma recebe o km, o ponto e o lote do próprio GPS.');
        // página online: no Android o sistema apaga o local das fotos; o app (site) tem a câmera com GPS
        if (and && opts.appUrl) h += ' <b>No Android</b>, o sistema costuma apagar o local das fotos entregues ao navegador. Para não depender disso, use o app ' +
          '<a href="' + esc(opts.appUrl) + '" target="_blank" rel="noopener">' + esc(opts.appUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')) + '</a> e o botão "Câmera com GPS", que usa o GPS do celular na hora da foto.';
      }
      q('.ft-note').innerHTML = h + ' Se faltar o local, você digita o km ou escolhe o ponto.';
      renderGps();
    }
    // as seções de legenda e aparência valem para a foto única e para o lote de fotos
    function moveShared(target) { root.querySelectorAll('.ft-shared').forEach(function (s) { target.appendChild(s); }); }
    function renderGps() {
      var el = q('.ft-gps');
      if (!opts.gps) { el.hidden = true; return; }
      el.hidden = false;
      if (!lastFix) { el.innerHTML = lastFixErr || 'Procurando o GPS… permita a localização quando o navegador perguntar.'; return; }
      var loc = ref.locate(lastFix.ll[0], lastFix.ll[1]);
      el.innerHTML = loc.dist > 2000
        ? 'GPS ativo · fora da ' + esc(rodovia()) + ' (' + nf(loc.dist / 1000, 1) + ' km do eixo)'
        : 'GPS ativo · <b>' + esc(kmLine(loc.km, loc.side, loc.dist, true)) + '</b> · precisão ' + Math.round(lastFix.acc || 0) + ' m' + gpsLot(loc.km);
    }
    function gpsLot(km) {
      var here = lotsAt(km), cur = activeContract();
      if (!here.length || !cur || has(here, cur)) return '';
      return ' · <span class="ft-warn">este km é do ' + esc(lotName(here[0])) + '</span>';
    }
    function renderHead() {
      var c = contract();
      if (batch) {   // lote de fotos: os lotes/contratos em uso
        var seen = {}, names = [];
        readyItems().forEach(function (it) { var x = byId(it.cid); if (x && !seen[x.id]) { seen[x.id] = 1; names.push(x.lote || lotName(x)); } });
        q('.ft-ct').textContent = [rodovia()].concat(names.length ? [names.join(', ')] : []).join(' · ');
        return;
      }
      q('.ft-ct').textContent = c ? [c.lote, c.numero, rodovia()].filter(Boolean).join(' · ') : rodovia();
    }
    var lastFixErr = '';
    function startGps() {
      if (!opts.gps || gpsWatch != null || !navigator.geolocation) return;
      gpsWatch = navigator.geolocation.watchPosition(function (pos) {
        lastFix = { ll: [pos.coords.latitude, pos.coords.longitude], acc: pos.coords.accuracy, t: Date.now() };
        lastFixErr = '';
        if (root && !q('.ft-start').hidden) renderGps();
        if (cam) renderCamGps();
      }, function (e) {
        lastFixErr = e && e.code === 1 ? 'A localização está bloqueada para este site. Libere nas permissões do navegador ou informe o km depois.' : 'Sem sinal de GPS no momento.';
        if (root && !q('.ft-start').hidden) renderGps();
        if (cam) renderCamGps();
      }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 30000 });
    }
    function stopGps() {
      if (gpsWatch != null && navigator.geolocation) navigator.geolocation.clearWatch(gpsWatch);
      gpsWatch = null;
    }

    // ---------------- foto escolhida
    function startMsg(text) { var el = q('.ft-msg'); el.textContent = text || ''; el.hidden = !text; }
    function readHead(file) {
      return file.slice(0, 1048576).arrayBuffer().then(function (buf) { return readMeta(buf); }, function () { return { unread: true }; });
    }
    // tipo e tamanho do arquivo, para a pessoa conferir (e relatar) o que chegou
    function fileInfo(file, meta) {
      var t = meta && meta.heif ? 'HEIC' : /jpe?g/i.test(file.type || file.name || '') ? 'JPEG' : (file.type || '').replace(/^image\//, '').toUpperCase() || 'tipo não informado';
      var mb = file.size >= 1048576 ? nf(file.size / 1048576, 1) + ' MB' : Math.max(1, Math.round(file.size / 1024)) + ' KB';
      return t + ' · ' + mb;
    }
    function openFail(file, meta) {
      return meta.heif
        ? 'Esta foto está em HEIC/HEIF, formato que o navegador não abre. Mude a câmera para JPEG (iPhone: Ajustes > Câmera > Formatos > Mais compatível; Samsung: câmera > configurações > desligue "Imagens HEIF") e tire a foto de novo.'
        : 'Não foi possível abrir essa imagem (' + fileInfo(file, meta) + '). ' + (file.size > 15728640 ? 'Ela é muito grande para o navegador do celular: use a câmera em resolução normal (12 MP), não 50/108/200 MP.' : 'Tente uma foto em JPEG.');
    }
    // `preset`: dados de uma foto da "Câmera com GPS" (posição e hora do aparelho no clique)
    function onFile(file, from, preset) {
      if (!file) return;
      startMsg('');
      if (file.type && !/^image\//.test(file.type)) { startMsg('Esse arquivo não é uma imagem. Escolha uma foto (JPEG).'); return; }
      // lê o começo do arquivo (até 1 MB) atrás do GPS gravado pela câmera
      (preset ? Promise.resolve(preset) : readHead(file)).then(function (meta) {
        var url = URL.createObjectURL(file), img = new Image();
        img.onload = function () { setupPhoto(img, url, file, meta, from); };
        img.onerror = function () { URL.revokeObjectURL(url); startMsg(openFail(file, meta)); };
        img.src = url;
      });
    }
    function setupPhoto(img, url, file, ex, from) {
      if (st && st.url) URL.revokeObjectURL(st.url);
      st = { img: img, url: url, w: img.naturalWidth, h: img.naturalHeight, desc: '', uid: newUid() };
      place(st, ex, file, from);
      showWork();
    }
    // posição, data, lote e ponto de uma foto (a única ou cada uma do lote de fotos)
    function place(o, ex, file, from) {
      var ac = activeContract();
      o.ll = null; o.km = null; o.side = ''; o.dist = null; o.acc = null; o.src = 'manual'; o.pid = ''; o.cid = ac ? ac.id : '';
      o.date = ex.date || (from === 'camera' ? new Date() : new Date(file.lastModified || Date.now()));
      o.from = from;
      o.meta = ex;
      o.info = fileInfo(file, ex);
      if (ex.live) { if (ex.ll) { o.ll = ex.ll; o.acc = ex.acc; o.src = 'gps'; } }
      else if (ex.ll) { o.ll = ex.ll; o.src = 'exif'; }
      else if (from === 'camera' && lastFix && Date.now() - lastFix.t < 120000) { o.ll = lastFix.ll; o.acc = lastFix.acc; o.src = 'gps'; }
      if (o.ll) {
        var loc = ref.locate(o.ll[0], o.ll[1]);
        o.loc = loc;
        if (loc.dist <= 2000) { o.km = loc.km; o.side = loc.dist >= 10 ? loc.side : ''; o.dist = loc.dist >= 10 ? Math.round(loc.dist) : null; }
      }
      o.noLoc = !o.ll;
      withItem(o, function () {
        var auto = o.km != null ? identify(o.km) : null;
        o.pid = auto && auto.d <= 0.05 ? auto.p.id : (opts.initialPoint || '');
        if (!o.ll && o.pid) { var p0 = findPoint(o.pid); if (p0) o.km = p0.kmIni; }
      });
    }
    // as funções de desenho e de texto leem `st`: no lote, cada foto passa por aqui
    function withItem(it, fn) { var old = st; st = it; try { return fn(); } finally { st = old; } }
    function findPoint(id) { var c = contract(); return c && id ? (c.pontos || []).find(function (p) { return p.id === id; }) || null : null; }
    function identify(km) {
      var c = contract(), best = null;
      if (!c || km == null) return null;
      (c.pontos || []).forEach(function (p) {
        if (p.kmIni == null) return;
        var a = p.kmIni, b = p.kmFim != null ? p.kmFim : p.kmIni, d = km < a ? a - km : km > b ? km - b : 0;
        if (!best || d < best.d) best = { p: p, d: d };
      });
      return best;
    }

    function showWork() {
      root.classList.remove('many');
      moveShared(q('.ft-work .ft-side'));
      q('.ft-start').hidden = true;
      q('.ft-batch').hidden = true;
      q('.ft-work').hidden = false;
      q('.ft-foot').hidden = false;
      q('#ftKm').value = st.km != null ? nf(st.km, 2) : '';
      q('#ftLado').value = st.side || '';
      q('#ftDl').value = st.dist != null ? String(st.dist) : '';
      q('#ftData').value = dateInput(st.date);
      q('#ftDesc').value = st.desc;
      renderHead();
      renderPontos();
      renderSrc();
      renderOpts();
      scheduleDraw(0);
    }
    function renderPontos() { q('#ftPonto').innerHTML = pontoOptions(); }
    function pontoOptions() {
      var c = contract(), list = c ? (c.pontos || []).filter(function (p) { return p.kmIni != null; }).slice() : [];
      list.sort(function (a, b) { return a.kmIni - b.kmIni; });
      var h = '<option value="">Nenhum</option>';
      list.forEach(function (p) {
        var b = p.kmFim != null ? p.kmFim : p.kmIni, d = st.km == null ? null : st.km < p.kmIni ? p.kmIni - st.km : st.km > b ? st.km - b : 0;
        var dist = d == null ? '' : d === 0 ? ' · aqui' : ' · a ' + (d < 1 ? Math.round(d * 1000) + ' m' : nf(d, 1) + ' km');
        h += '<option value="' + esc(p.id) + '"' + (p.id === st.pid ? ' selected' : '') + '>' + esc(p.nome) + ' (km ' + nf(p.kmIni, 2) + ')' + dist + '</option>';
      });
      return h;
    }
    function renderSrc() {
      q('.ft-work .ft-src').innerHTML = srcHtml(false);
      q('.ft-work .ft-here').hidden = !(opts.gps && st.src === 'manual');
      renderLote();
    }
    // "Usar o GPS do aparelho agora": para foto sem local, tirada ali mesmo
    function hereFix() {
      return new Promise(function (resolve) {
        if (lastFix && Date.now() - lastFix.t < 15000) { resolve(lastFix); return; }
        if (!navigator.geolocation) { resolve(null); return; }
        navigator.geolocation.getCurrentPosition(function (pos) {
          lastFix = { ll: [pos.coords.latitude, pos.coords.longitude], acc: pos.coords.accuracy, t: Date.now() };
          resolve(lastFix);
        }, function (e) {
          if (e && e.code === 1) lastFixErr = 'A localização está bloqueada para este site. Libere nas permissões do navegador.';
          resolve(null);
        }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
      });
    }
    function applyFix(o, fix) {
      var loc = ref.locate(fix.ll[0], fix.ll[1]), near = loc.dist <= 2000;
      o.ll = fix.ll; o.acc = fix.acc; o.src = 'gps'; o.noLoc = false; o.loc = loc; o.keepLot = '';
      o.km = near ? loc.km : null;
      o.side = near && loc.dist >= 10 ? loc.side : '';
      o.dist = near && loc.dist >= 10 ? Math.round(loc.dist) : null;
      withItem(o, function () { var auto = o.km != null ? identify(o.km) : null; if (auto && auto.d <= 0.05) o.pid = auto.p.id; });
    }
    function useHere(btn, done) {
      var old = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Buscando o GPS…';
      hereFix().then(function (fix) {
        btn.disabled = false;
        btn.textContent = old;
        if (!fix) { notify(lastFixErr || 'Sem sinal de GPS. Libere a localização para este site e tente de novo.'); return; }
        done(fix);
        notify('Posição do aparelho aplicada (precisão ' + Math.round(fix.acc || 0) + ' m).');
      });
    }
    // de onde veio a posição; `short` é o texto curto de cada foto do lote
    function srcHtml(short) {
      var h;
      var side = st.side ? ' · ' + st.side + (st.dist != null ? ' a ' + st.dist + ' m do eixo' : '') : '';
      if (short) {
        if (st.src === 'exif') h = 'Posição: <b>GPS gravado na foto</b> ' + coordTxt(st.ll) + side + ' · ' + dateTxt(st.date) + '.';
        else if (st.src === 'gps') h = 'Posição: <b>GPS do aparelho</b> ' + coordTxt(st.ll) + (st.acc ? ' (precisão ' + Math.round(st.acc) + ' m)' : '') + side + ' · ' + dateTxt(st.date) + '.';
        else if (st.noLoc && st.km == null) h = '<span class="ft-warn">Foto sem localização.</span> ' + noLocWhy() + ' Digite o km ou escolha o ponto.';
        else h = 'Posição: <b>km informado à mão</b> (coordenadas do eixo' + (st.noLoc ? '; a foto não tem localização' : '') + ').';
      } else if (st.src === 'exif') h = 'Posição: <b>GPS gravado na foto</b> ' + coordTxt(st.ll) + '.';
      else if (st.src === 'gps') h = 'Posição: <b>GPS do aparelho</b> na hora da foto ' + coordTxt(st.ll) + (st.acc ? ' (precisão ' + Math.round(st.acc) + ' m)' : '') + '.';
      else h = 'Posição: <b>informada à mão</b>. As coordenadas são as do eixo no km digitado (SNV ' + esc(snv.versao) + ').';
      if (!short && st.src === 'manual' && st.noLoc) {
        h += ' <span class="ft-warn">Esta foto chegou sem localização.</span> ' + noLocWhy() + ' ' + noLocTip() +
          '<br><small>Arquivo: ' + esc(st.info || '') + ' · dados da câmera (EXIF): ' + (st.meta && st.meta.exif ? 'sim' : 'não') +
          ' · GPS: ' + (st.meta && st.meta.gpsZero ? 'apagado' : st.meta && st.meta.gpsTags ? 'vazio' : 'não gravado') + '</small>';
      }
      if (st.loc && st.loc.dist > 2000) h += ' <span class="ft-warn">A foto está a ' + nf(st.loc.dist / 1000, 1) + ' km da ' + esc(rodovia()) + ': confira o km.</span>';
      var p = findPoint(st.pid);
      if (p && st.km != null) {
        var b = p.kmFim != null ? p.kmFim : p.kmIni;
        if (st.km < p.kmIni - 0.05 || st.km > b + 0.05) h += ' <span class="ft-warn">O km está fora do ' + esc(p.nome) + ' (km ' + nf(p.kmIni, 2) + ' a ' + nf(b, 2) + ').</span>';
      }
      return h;
    }
    // por que a foto chegou sem localização, pelo que veio no arquivo
    function noLocWhy() {
      var m = st.meta || {};
      if (m.live) return 'Não havia sinal de GPS na hora da foto.';
      if (m.gpsZero) return isAndroid() ? 'O Android apagou a localização ao entregar a foto ao navegador (proteção de privacidade do sistema).' : 'A localização chegou apagada.';
      if (m.exif && !m.gpsTags) return 'A câmera não gravou o local nesta foto.';
      if (m.exif === false) return 'A foto chegou sem os dados da câmera (foi reprocessada por WhatsApp, editor, captura de tela ou pelo seletor de fotos).';
      return '';
    }
    // o que fazer: depende do aparelho e de por onde a foto veio
    function noLocTip() {
      var m = st.meta || {}, and = isAndroid(), cam = camSupported(), t;
      if (m.live) t = 'Espere aparecer "GPS ativo" no alto da câmera antes de fotografar.';
      else if (m.gpsZero && and) t = (st.from === 'galeria' ? 'Às vezes funciona abrir a mesma foto por "Arquivos do celular" > armazenamento interno > DCIM > Camera. ' : '') +
        (cam ? 'Para as próximas, use "Câmera com GPS": o local vem do GPS do celular na hora da foto, sem depender do Android.'
          : 'Para as próximas, use o app (site) instalado e o botão "Câmera com GPS": o local vem do GPS do celular na hora da foto.');
      else if ((m.exif && !m.gpsTags) || st.from === 'camera') t = 'Ative o local na câmera (Android: Câmera > Configurações > Tags de local; iPhone: Ajustes > Privacidade > Serviços de Localização > Câmera).' +
        (cam ? ' Ou use "Câmera com GPS".' : '');
      else if (st.from === 'galeria') t = and ? 'A galeria do Android costuma apagar o local: abra a mesma foto por "Arquivos do celular" > armazenamento interno > DCIM > Camera.'
        : 'No iPhone, na tela de escolher as fotos, toque em "Opções" e ligue "Localização"; ou abra a foto por "Arquivos do celular".';
      else t = 'Use o arquivo original da câmera (pasta DCIM > Camera), não uma cópia enviada por aplicativo.';
      return t + (opts.gps ? ' Se você está no local agora, toque em "Usar o GPS do aparelho agora".' : '') + ' Ou digite o km / escolha o ponto.';
    }
    // confere se o km cai no trecho do lote da foto; se for de outro lote, avisa e oferece a correção
    function renderLote() {
      var box = q('.ft-work .ft-lot'), h = lotHtml();
      q('#ftLoteWrap').hidden = contracts().length < 2;
      q('#ftLote').innerHTML = loteOptions();
      box.innerHTML = h;
      box.hidden = !h;
    }
    function loteOptions() {
      var cur = contract(), here = st.km != null ? lotsAt(st.km) : [];
      return contracts().map(function (c) {
        var r = rangeTxt(c);
        return '<option value="' + esc(c.id) + '"' + (cur && c.id === cur.id ? ' selected' : '') + '>' + esc(lotName(c)) + (r ? ' · ' + r : '') + (has(here, c) ? ' · o km está aqui' : '') + '</option>';
      }).join('');
    }
    function lotHtml() {
      var list = contracts(), cur = contract(), here = st.km != null ? lotsAt(st.km) : [], h = '';
      var di = st.bi != null ? ' data-i="' + st.bi + '"' : '';   // foto do lote de fotos
      if (st.km != null && cur && !has(here, cur)) {
        if (here.length) {
          h = '<div>O km <b>' + nf(st.km, 2) + '</b> fica no <b>' + esc(lotName(here[0])) + '</b> (' + esc(rangeTxt(here[0])) + '), não no ' + esc(lotName(cur)) +
            (rangeTxt(cur) ? ' (' + esc(rangeTxt(cur)) + ')' : '') + '. A legenda e o ponto estão usando o lote errado.</div><div class="ft-opts">' +
            here.map(function (c) {
              var a = pointNear(c, st.km);
              return '<button type="button" class="ft-opt ft-fix" data-ft="fix-lot" data-cid="' + esc(c.id) + '"' + di + '>Corrigir para ' + esc(c.lote || lotName(c)) + (a ? ' · ' + esc(a.nome) : '') + '</button>';
            }).join('') +
            '<button type="button" class="ft-opt" data-ft="keep-lot"' + di + '>Manter ' + esc(cur.lote || lotName(cur)) + '</button></div>';
          if (st.keepLot === cur.id + '@' + nf(st.km, 2)) h = '';
        } else if (lotRange(cur)) {
          h = '<div>O km <b>' + nf(st.km, 2) + '</b> está fora do trecho de todos os contratos cadastrados (' +
            list.filter(function (c) { return lotRange(c); }).map(function (c) { return esc(c.lote || lotName(c)) + ': ' + esc(rangeTxt(c)); }).join('; ') +
            '). Confira o km.</div>';
        }
      }
      return h;
    }
    // ponto do lote c que fica no km (até 50 m)
    function pointNear(c, km) {
      var best = null;
      (c.pontos || []).forEach(function (p) {
        if (p.kmIni == null) return;
        var a = p.kmIni, b = p.kmFim != null ? p.kmFim : p.kmIni, d = km < a ? a - km : km > b ? km - b : 0;
        if (d <= 0.05 && (!best || d < best.d)) best = { p: p, d: d };
      });
      return best ? best.p : null;
    }
    function applyLot(id, why) {
      var c = byId(id);
      if (!c || !st) return;
      st.cid = c.id;
      st.keepLot = '';
      var auto = st.km != null ? identify(st.km) : null;
      st.pid = auto && auto.d <= 0.05 ? auto.p.id : '';
      renderHead(); renderPontos(); renderSrc(); scheduleDraw(0);
      if (opts.setActiveContract) opts.setActiveContract(c.id);
      var p = findPoint(st.pid);
      notify('Foto no ' + lotName(c) + (p ? ' · ponto ' + p.nome : '') + '.');
    }

    // ---------------- desenho
    function kmLine(km, side, dist, withSide) {
      var s = rodovia().replace(/^BR-/, 'BR ') + ' - ' + nf(km, 2);
      if (withSide && side) s += ' - ' + side + (dist != null ? ' - DL: ' + Math.round(dist) + ' m' : '');
      return s;
    }
    function lines() {
      var c = contract(), out = [], C = set.campos, p = findPoint(st.pid);
      var ll = st.ll || (st.km != null ? ref.at(st.km) : null);
      if (C.rodkm) out.push(st.km != null ? kmLine(st.km, st.side, st.dist, C.lado) : rodovia().replace(/^BR-/, 'BR '));
      if (C.coord && ll) out.push(coordTxt(ll));
      if (C.data && st.date) out.push(dateTxt(st.date));
      if (C.ponto && p) out.push('Ponto ' + p.nome + ' - km ' + nf(p.kmIni, 2) + (p.kmFim != null ? ' a ' + nf(p.kmFim, 2) : ''));
      if (C.contrato && c) out.push([c.lote, c.numero ? 'CT ' + c.numero : ''].filter(Boolean).join(' - '));
      if (C.executora && c && c.executora) out.push('Executora: ' + c.executora);
      if (C.supervisora && c && c.supervisora) out.push('Supervisão: ' + c.supervisora);
      var desc = (st.desc || '').trim() || (st.bi != null && batch ? batch.common.trim() : '');
      if (C.desc && desc) out.push({ wrap: desc });
      if (C.snv) out.push(snvTxt(snv.versao));
      return out;
    }
    function draw(canvas, maxSide) {
      var sc = Math.min(1, maxSide / Math.max(st.w, st.h)), W = Math.round(st.w * sc), H = Math.round(st.h * sc);
      canvas.width = W; canvas.height = H;
      var g = canvas.getContext('2d');
      g.drawImage(st.img, 0, 0, W, H);
      var short = Math.min(W, H), fs = short * (SIZES[set.tam] || SIZES.M), lh = fs * 1.28, m = Math.round(short * 0.03);
      // logo
      var logoBox = null, li = curImg;
      if (set.logoOn && li) {
        var lw = short * (set.tam === 'G' ? 0.4 : set.tam === 'P' ? 0.26 : 0.32), lhh = lw * li.naturalHeight / li.naturalWidth, padL = set.logoFundo ? fs * 0.35 : 0;
        var bx = set.logo[1] === 'l' ? m : W - m - lw - padL * 2, by = set.logo[0] === 't' ? m : H - m - lhh - padL * 2;
        if (set.logoFundo) {
          g.save(); g.globalAlpha = 0.88; g.fillStyle = '#FFFFFF';
          roundRect(g, bx, by, lw + padL * 2, lhh + padL * 2, fs * 0.3); g.fill(); g.restore();
        }
        g.drawImage(li, bx + padL, by + padL, lw, lhh);
        logoBox = { x: bx, y: by, w: lw + padL * 2, h: lhh + padL * 2 };
      }
      // legenda
      g.font = '600 ' + fs + 'px Arial, Helvetica, sans-serif';
      var maxW = W - m * 2, txt = [];
      lines().forEach(function (l) {
        if (typeof l === 'string') { if (l) txt.push(l); return; }
        wrapText(g, l.wrap, maxW).forEach(function (w) { txt.push(w); });
      });
      if (!txt.length) return;
      var right = set.leg[1] === 'r', top = set.leg[0] === 't', blockH = txt.length * lh, y0;
      if (top) {
        y0 = m;
        if (logoBox && set.logo === set.leg) y0 = logoBox.y + logoBox.h + fs * 0.5;
      } else {
        y0 = H - m - blockH;
        if (logoBox && set.logo === set.leg) y0 = logoBox.y - fs * 0.5 - blockH;
      }
      var wMax = 0;
      txt.forEach(function (t) { wMax = Math.max(wMax, g.measureText(t).width); });
      if (set.fundo === 'faixa') {
        g.save(); g.fillStyle = 'rgba(0,0,0,0.5)';
        roundRect(g, (right ? W - m - wMax : m) - fs * 0.4, y0 - fs * 0.3, wMax + fs * 0.8, blockH + fs * 0.45, fs * 0.25); g.fill(); g.restore();
      }
      g.textAlign = right ? 'right' : 'left';
      g.textBaseline = 'top';
      var x = right ? W - m : m;
      txt.forEach(function (t, i) {
        var y = y0 + i * lh;
        if (set.fundo === 'sombra') {
          g.save();
          g.lineJoin = 'round'; g.lineWidth = Math.max(2, fs * 0.1); g.strokeStyle = 'rgba(0,0,0,0.5)';
          g.shadowColor = 'rgba(0,0,0,0.7)'; g.shadowBlur = fs * 0.25;
          g.strokeText(t, x, y);
          g.restore();
        }
        g.fillStyle = COLORS[set.cor] || COLORS.amarelo;
        g.fillText(t, x, y);
      });
    }
    function roundRect(g, x, y, w, h, r) {
      g.beginPath();
      g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
      g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
      g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
    }
    function wrapText(g, text, maxW) {
      var out = [];
      String(text).split(/\n+/).forEach(function (para) {
        var words = para.split(/\s+/), line = '';
        words.forEach(function (w) {
          var tryL = line ? line + ' ' + w : w;
          if (g.measureText(tryL).width <= maxW || !line) line = tryL;
          else { out.push(line); line = w; }
        });
        if (line) out.push(line);
      });
      return out.slice(0, 4);
    }
    function scheduleDraw(ms) {
      clearTimeout(drawTimer);
      drawTimer = setTimeout(function () {
        if (batch) { batch.items.forEach(function (it, i) { if (it.img && !it.gone) queueDraw(i); }); return; }
        if (st) draw(q('.ft-prev canvas'), 1600);
      }, ms == null ? 90 : ms);
    }

    // ---------------- salvar
    // qualidade do JPEG final (salvar, compartilhar, Drive): 85% fica igual a olho nu e uns 10% menor que 90%
    var QUALIDADE = 0.85;
    function fileName() {
      var p = findPoint(st.pid), d = st.date || new Date();
      var parts = ['Foto', rodovia().replace(/[\/\s]+/g, '-')];
      if (st.km != null) { var k = Math.round(st.km * 100) * 10; parts.push('km ' + Math.floor(k / 1000) + '+' + String(k % 1000).padStart(3, '0')); }
      if (p) parts.push(p.nome);
      parts.push(d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + 'h' + pad(d.getMinutes()));
      return parts.join(' ').replace(/[\\:*?"<>|]+/g, '-') + '.jpg';
    }
    function makeBlob() {
      return new Promise(function (resolve) {
        var cv = document.createElement('canvas');
        draw(cv, 3200);
        cv.toBlob(function (b) { resolve(b); }, 'image/jpeg', QUALIDADE);
      });
    }
    function busy(on) { root.querySelectorAll('[data-ft="save"],[data-ft="share"],[data-ft="drive"]').forEach(function (b) { b.disabled = on; }); }
    function save() {
      if (!st) return;
      busy(true);
      makeBlob().then(function (blob) {
        if (!blob) { notify('Não foi possível gerar a foto. Tente com uma imagem menor.'); return; }
        toDrive([driveItem(st, blob, fileName())], true);
        return opts.saveBlob(fileName(), blob);
      }).then(function () { busy(false); }, function () { busy(false); });
    }
    function share() {
      if (!st) return;
      busy(true);
      makeBlob().then(function (blob) {
        toDrive([driveItem(st, blob, fileName())], true);
        var f = new File([blob], fileName(), { type: 'image/jpeg' });
        if (navigator.canShare && navigator.canShare({ files: [f] })) return navigator.share({ files: [f], title: fileName() });
        notify('Este navegador não compartilha arquivos. Use Salvar foto.');
      }).catch(function () { /* compartilhamento cancelado */ }).then(function () { busy(false); });
    }

    // ---------------- Google Drive da equipe: toda foto salva, compartilhada ou enviada vai para "Lote / Ponto"
    function newUid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
    function driveOn() { return !!(opts.drive && opts.drive.ready()); }
    function driveItem(it, blob, name) {
      return withItem(it, function () {
        var c = contract(), p = findPoint(st.pid), ll = st.ll || (st.km != null ? ref.at(st.km) : null);
        var desc = (st.desc || '').trim() || (st.bi != null && batch ? batch.common.trim() : '');
        var info = [
          c ? lotName(c) : '',
          p ? 'Ponto ' + p.nome : 'Sem ponto',
          st.km != null ? kmLine(st.km, st.side, st.dist, true) : '',
          ll ? coordTxt(ll) : '',
          st.date ? dateTxt(st.date) : '',
          desc
        ].filter(Boolean).join('\n');
        return { id: st.uid || newUid(), nome: name, blob: blob, pastas: [(c && (c.lote || lotName(c))) || 'Sem lote', p ? p.nome || 'Ponto sem nome' : 'Sem ponto'], descricao: info };
      });
    }
    function toDrive(list, auto) {
      if (!driveOn() || !list.length) return;
      opts.drive.add(list).then(function () {
        if (!auto) notify(list.length === 1 ? 'Foto na fila para o Drive da equipe.' : list.length + ' fotos na fila para o Drive da equipe.');
        refreshDrive();
      }, function () { notify('Não foi possível guardar a foto para o Drive neste aparelho.'); });
    }
    function sendDrive() {
      if (!st || !driveOn()) return;
      busy(true);
      makeBlob().then(function (blob) {
        if (!blob) { notify('Não foi possível gerar a foto. Tente com uma imagem menor.'); return; }
        toDrive([driveItem(st, blob, fileName())]);
      }).then(function () { busy(false); }, function () { busy(false); });
    }
    function sendAllDrive() {
      if (!batch || batch.busy || !driveOn()) return;
      var b = batch;
      setBatchBusy(true);
      outputs().then(function (files) {
        if (!files.length) { notify('Nenhuma foto pôde ser gerada.'); return; }
        toDrive(files.map(function (f) { return driveItem(f.it, f.blob, f.name); }));
      }).catch(function (e) {
        if (!e || e.message !== 'cancel') notify('Não foi possível gerar as fotos. Tente com menos fotos por vez.');
      }).then(function () { if (batch === b) setBatchBusy(false); });
    }
    // situação da fila (texto do app) e botões do Drive
    function refreshDrive() {
      if (!root) return;
      var on = driveOn();
      root.querySelectorAll('.ft-drv').forEach(function (b) { b.hidden = !on; });
      var el = q('.ft-dstat');
      if (el) { var t = on && opts.drive.status ? opts.drive.status() : ''; el.textContent = t; el.hidden = !t; }
    }

    // ---------------- várias fotos de uma vez (Arquivos do celular): cada uma com o km, o ponto e o lote do próprio GPS
    // Só a miniatura (1000 px) fica na memória; a foto inteira é aberta de novo na hora de salvar.
    var MAX_FOTOS = 80, batch = null, drawQ = [], drawing = false, prevCv = null, descTimer = null;
    // `presets`: dados de cada foto da "Câmera com GPS", na mesma ordem
    function onFiles(list, from, presets) {
      var files = Array.prototype.slice.call(list || []);
      if (files.length <= 1) { onFile(files[0], from, presets && presets[0]); return; }
      startMsg('');
      var extra = files.length - MAX_FOTOS;
      if (extra > 0) files = files.slice(0, MAX_FOTOS);
      clearBatch();
      var b = batch = { common: '', ver: 0, out: null, busy: false, items: files.map(function (f, i) {
        return { file: f, name: f.name || 'Foto ' + (i + 1), from: from, bi: i, desc: '', wait: true, preset: presets ? presets[i] : null, uid: newUid() };
      }) };
      showBatch();
      if (extra > 0) notify('Abertas as primeiras ' + MAX_FOTOS + ' fotos. Salve estas e depois abra as outras ' + extra + '.');
      (function next(i) {
        if (batch !== b) return;
        if (i >= b.items.length) { renderBatchSum(); return; }
        var it = b.items[i];
        loadItem(it).then(null, function () { it.err = it.err || 'Não foi possível abrir esta imagem.'; }).then(function () {
          if (batch !== b) { if (it.url) URL.revokeObjectURL(it.url); return; }
          it.wait = false;
          renderItem(i);
          renderBatchSum();
          next(i + 1);
        });
      })(0);
    }
    function decode(file) {
      return new Promise(function (resolve) {
        var url = URL.createObjectURL(file), img = new Image();
        img.onload = function () { resolve({ img: img, url: url }); };
        img.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
        img.src = url;
      });
    }
    function loadItem(it) {
      if (it.file.type && !/^image\//.test(it.file.type)) { it.err = 'Este arquivo não é uma imagem.'; return Promise.resolve(); }
      return (it.preset ? Promise.resolve(it.preset) : readHead(it.file)).then(function (meta) {
        return decode(it.file).then(function (d) {
          if (!d) { it.err = openFail(it.file, meta); return; }
          it.w = d.img.naturalWidth; it.h = d.img.naturalHeight;
          var sc = Math.min(1, 1000 / Math.max(it.w, it.h)), cv = document.createElement('canvas');
          cv.width = Math.max(1, Math.round(it.w * sc)); cv.height = Math.max(1, Math.round(it.h * sc));
          cv.getContext('2d').drawImage(d.img, 0, 0, cv.width, cv.height);
          URL.revokeObjectURL(d.url);
          return new Promise(function (resolve) { cv.toBlob(resolve, 'image/jpeg', 0.85); }).then(function (blob) {
            cv.width = cv.height = 0;
            if (!blob) { it.err = 'Não foi possível abrir esta imagem.'; return; }
            return decode(blob).then(function (t) {
              if (!t) { it.err = 'Não foi possível abrir esta imagem.'; return; }
              it.img = t.img; it.url = t.url;
              place(it, meta, it.file, it.from);
            });
          });
        });
      });
    }
    function clearBatch() {
      if (!batch) return;
      batch.items.forEach(function (it) { if (it.url) URL.revokeObjectURL(it.url); if (it.prevUrl) URL.revokeObjectURL(it.prevUrl); });
      batch = null;
      drawQ = [];
      if (root) { q('.ft-blist').innerHTML = ''; q('.ft-prog').textContent = ''; }
    }
    function showBatch() {
      root.classList.add('many');
      moveShared(q('.ft-bside'));
      q('.ft-start').hidden = true;
      q('.ft-work').hidden = true;
      q('.ft-batch').hidden = false;
      q('.ft-foot').hidden = false;
      q('#ftBDesc').value = batch.common;
      renderHead();
      renderOpts();
      q('.ft-blist').innerHTML = batch.items.map(function (it, i) { return '<article class="ft-item" data-i="' + i + '" aria-label="Foto ' + (i + 1) + '"></article>'; }).join('');
      batch.items.forEach(function (it, i) { renderItem(i); });
      renderBatchSum();
      q('.ft-body').scrollTop = 0;
    }
    function itemEl(i) { return q('.ft-item[data-i="' + i + '"]'); }
    function renderItem(i) {
      var it = batch.items[i], el = itemEl(i);
      if (!el) return;
      var head = '<div class="ft-ihead"><span class="ft-iname">' + (i + 1) + '. ' + esc(it.name) + '</span>' +
        (it.wait ? '' : '<button type="button" class="ft-opt" data-ft="b-del" data-i="' + i + '" aria-label="Tirar a foto ' + (i + 1) + ' da seleção">Tirar</button>') + '</div>';
      if (it.wait) { el.innerHTML = '<div class="ft-thumb">Lendo a foto…</div><div class="ft-ifields">' + head + '</div>'; return; }
      if (it.err) {
        el.classList.add('err');
        el.innerHTML = '<div class="ft-thumb">Sem prévia</div><div class="ft-ifields">' + head + '<p class="ft-src ft-warn">' + esc(it.err) + ' Esta foto fica de fora.</p></div>';
        return;
      }
      var d = ' data-i="' + i + '"';
      el.innerHTML = '<div class="ft-thumb"><span>Gerando prévia…</span><img alt="Foto ' + (i + 1) + ' com o carimbo" hidden></div>' +
        '<div class="ft-ifields">' + head + '<div class="ft-src"></div>' +
          '<div class="ft-opts ft-here" hidden><button type="button" class="ft-opt" data-ft="b-here"' + d + '>Usar o GPS do aparelho agora</button></div>' +
          '<div class="ft-lot" role="status" hidden></div>' +
          '<div class="ft-grid">' +
            (contracts().length > 1 ? '<label class="ft-f full"><span>Lote / contrato</span><select data-b="lote"' + d + '></select></label>' : '') +
            '<label class="ft-f"><span>km</span><input data-b="km"' + d + ' inputmode="decimal" autocomplete="off"></label>' +
            '<label class="ft-f"><span>Ponto</span><select data-b="ponto"' + d + '></select></label>' +
            '<label class="ft-f full"><span>Descrição desta foto</span><input data-b="desc"' + d + ' maxlength="240" autocomplete="off"></label>' +
          '</div></div>';
      el.querySelector('[data-b="km"]').value = it.km != null ? nf(it.km, 2) : '';
      el.querySelector('[data-b="desc"]').value = it.desc;
      refreshItem(i);
      queueDraw(i);
    }
    // textos, avisos e listas da foto i (sem tocar no campo que está sendo digitado)
    function refreshItem(i) {
      var it = batch.items[i], el = itemEl(i);
      if (!el || it.wait || it.err) return;
      el.querySelector('.ft-here').hidden = !(opts.gps && it.src === 'manual');
      withItem(it, function () {
        el.querySelector('.ft-src').innerHTML = srcHtml(true);
        var lot = lotHtml(), box = el.querySelector('.ft-lot'), ls = el.querySelector('[data-b="lote"]');
        box.innerHTML = lot;
        box.hidden = !lot;
        el.querySelector('[data-b="ponto"]').innerHTML = pontoOptions();
        if (ls) ls.innerHTML = loteOptions();
      });
      var c = batch.common.trim();
      el.querySelector('[data-b="desc"]').placeholder = c ? 'Igual à de todas: ' + c : 'Ex.: vista geral do bueiro';
    }
    function liveItems() { return batch ? batch.items.filter(function (it) { return !it.gone; }) : []; }
    function readyItems() { return liveItems().filter(function (it) { return !it.wait && !it.err; }); }
    // fotos cujo km fica em outro lote (e que ninguém mandou manter)
    function wrongLot(it) {
      if (it.km == null) return null;
      return withItem(it, function () {
        var cur = contract(), here = lotsAt(it.km);
        if (!cur || !here.length || has(here, cur) || it.keepLot === cur.id + '@' + nf(it.km, 2)) return null;
        return here[0];
      });
    }
    function renderBatchSum() {
      if (!batch) return;
      var live = liveItems(), ok = readyItems();
      var wait = live.filter(function (it) { return it.wait; }).length, bad = live.filter(function (it) { return it.err; }).length;
      var gps = ok.filter(function (it) { return it.src === 'exif' || it.src === 'gps'; }).length, sem = ok.filter(function (it) { return it.noLoc; }).length;
      q('.ft-bcount').textContent = live.length + (live.length === 1 ? ' foto' : ' fotos');
      renderHead();
      var parts = [];
      if (wait) parts.push('lendo ' + wait + (wait === 1 ? ' foto' : ' fotos') + '…');
      if (ok.length) parts.push(gps + ' com localização');
      if (sem) parts.push('<span class="ft-warn">' + sem + ' sem localização</span>: digite o km ou escolha o ponto nelas');
      if (bad) parts.push('<span class="ft-warn">' + bad + (bad === 1 ? ' não abriu' : ' não abriram') + '</span>');
      q('.ft-bstat').innerHTML = parts.join(' · ');
      var wrong = ok.filter(function (it) { return wrongLot(it); }).length, box = q('.ft-blot');
      box.innerHTML = wrong ? '<div><b>' + wrong + (wrong === 1 ? ' foto está' : ' fotos estão') + ' com o km em outro lote.</b> A legenda e o ponto ' + (wrong === 1 ? 'dela' : 'delas') + ' estão usando o lote errado.</div>' +
        '<div class="ft-opts"><button type="button" class="ft-opt ft-fix" data-ft="b-fixall">Corrigir o lote ' + (wrong === 1 ? 'dela' : 'das ' + wrong) + ' pelo km</button></div>' : '';
      box.hidden = !wrong;
      var n = ok.length, off = batch.busy || wait > 0 || !n;
      root.querySelectorAll('[data-ft="b-save"],[data-ft="b-share"],[data-ft="b-drive"]').forEach(function (b) { b.disabled = off; });
      var bs = q('[data-ft="b-save"]'), sh = q('[data-ft="b-share"]');
      bs.textContent = n > 1 ? 'Salvar as ' + n + ' fotos (.zip)' : 'Salvar (.zip)';
      if (sh) sh.textContent = n > 1 ? 'Compartilhar as ' + n : 'Compartilhar';
    }
    function setItemLot(it, id) {
      var c = byId(id);
      if (!c) return null;
      withItem(it, function () {
        it.cid = c.id;
        it.keepLot = '';
        var auto = it.km != null ? identify(it.km) : null;
        it.pid = auto && auto.d <= 0.05 ? auto.p.id : '';
      });
      return c;
    }
    function fixAll() {
      var n = 0;
      batch.items.forEach(function (it, i) {
        if (it.gone || it.wait || it.err) return;
        var to = wrongLot(it);
        if (!to) return;
        setItemLot(it, to.id);
        n++;
        refreshItem(i);
        queueDraw(i);
      });
      renderBatchSum();
      if (n) notify(n + (n === 1 ? ' foto corrigida' : ' fotos corrigidas') + ' para o lote do km.');
    }
    function itemChanged(i, later) {
      batch.ver++;
      var it = batch.items[i];
      clearTimeout(it.t);
      if (later) it.t = setTimeout(function () { queueDraw(i); }, 250);
      else queueDraw(i);
    }
    // prévias com carimbo, uma de cada vez, num canvas só
    function queueDraw(i) {
      if (!batch) return;
      batch.ver++;
      if (drawQ.indexOf(i) < 0) drawQ.push(i);
      if (!drawing) pump();
    }
    function pump() {
      var b = batch;
      if (!b || !drawQ.length) { drawing = false; return; }
      drawing = true;
      var i = drawQ.shift(), it = b.items[i], el = itemEl(i), img = el && el.querySelector('.ft-thumb img');
      if (!it || it.gone || !it.img || !img) { pump(); return; }
      prevCv = prevCv || document.createElement('canvas');
      withItem(it, function () { draw(prevCv, 900); });
      prevCv.toBlob(function (blob) {
        if (blob && batch === b && !it.gone) {
          if (it.prevUrl) URL.revokeObjectURL(it.prevUrl);
          it.prevUrl = URL.createObjectURL(blob);
          img.onload = function () { img.hidden = false; var s = img.previousElementSibling; if (s) s.remove(); };
          img.src = it.prevUrl;
        }
        pump();
      }, 'image/jpeg', 0.85);
    }
    function prog(t) { q('.ft-prog').textContent = t || ''; }
    function setBatchBusy(on) { if (!batch) return; batch.busy = on; if (!on) prog(''); renderBatchSum(); }
    // gera as fotos finais (3200 px) e guarda enquanto nada mudar
    function outputs() {
      var b = batch, ver = b.ver;
      if (b.out && b.out.ver === ver) return Promise.resolve(b.out.files);
      var list = readyItems(), out = [], used = {}, cv = document.createElement('canvas');
      return list.reduce(function (p, it, k) {
        return p.then(function () {
          if (batch !== b) throw new Error('cancel');
          prog('Gerando ' + (k + 1) + ' de ' + list.length + '…');
          return decode(it.file).then(function (d) {
            if (!d) return null;
            withItem(it, function () { var keep = it.img; it.img = d.img; try { draw(cv, 3200); } finally { it.img = keep; } });
            URL.revokeObjectURL(d.url);
            return new Promise(function (resolve) { cv.toBlob(resolve, 'image/jpeg', QUALIDADE); });
          }).then(function (blob) {
            if (!blob) return;
            var name = withItem(it, fileName), base = name.replace(/\.jpg$/i, ''), n = 2;
            while (used[name.toLowerCase()]) name = base + ' (' + (n++) + ').jpg';
            used[name.toLowerCase()] = true;
            out.push({ name: name, blob: blob, date: it.date, it: it });
          });
        });
      }, Promise.resolve()).then(function () {
        cv.width = cv.height = 0;
        if (b.ver === ver) b.out = { ver: ver, files: out };
        return out;
      });
    }
    function zipName(n) {
      var d = new Date();
      return ('Fotos ' + rodovia().replace(/[\/\s]+/g, '-') + ' ' + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' +
        pad(d.getHours()) + 'h' + pad(d.getMinutes()) + ' (' + n + ' fotos).zip').replace(/[\\:*?"<>|]+/g, '-');
    }
    function saveAll() {
      if (!batch || batch.busy) return;
      var b = batch;
      setBatchBusy(true);
      outputs().then(function (files) {
        if (!files.length) { notify('Nenhuma foto pôde ser gerada.'); return; }
        toDrive(files.map(function (f) { return driveItem(f.it, f.blob, f.name); }), true);
        prog('Montando o .zip…');
        return makeZip(files).then(function (zip) {
          var name = zipName(files.length);
          prog('');
          return opts.saveBlob(name, zip, files.length + ' fotos com carimbo: ' + name);
        });
      }).catch(function (e) {
        if (!e || e.message !== 'cancel') notify('Não foi possível gerar as fotos. Tente com menos fotos por vez.');
      }).then(function () { if (batch === b) setBatchBusy(false); });
    }
    function shareAll() {
      if (!batch || batch.busy) return;
      var b = batch;
      // já prontas: abre o compartilhar ainda dentro do toque
      if (b.out && b.out.ver === b.ver) { shareFiles(b.out.files, false); toDrive(b.out.files.map(function (f) { return driveItem(f.it, f.blob, f.name); }), true); return; }
      setBatchBusy(true);
      outputs().then(function (files) {
        if (batch !== b) return;
        setBatchBusy(false);
        shareFiles(files, true);
        toDrive(files.map(function (f) { return driveItem(f.it, f.blob, f.name); }), true);
      }).catch(function (e) {
        if (batch === b) setBatchBusy(false);
        if (!e || e.message !== 'cancel') notify('Não foi possível gerar as fotos. Tente com menos fotos por vez.');
      });
    }
    function shareFiles(files, late) {
      var list = files.map(function (f) { return new File([f.blob], f.name, { type: 'image/jpeg' }); });
      var can = false;
      try { can = !!(navigator.canShare && navigator.canShare({ files: list })); } catch (e) { can = false; }
      if (!list.length) return;
      if (!can) { notify('Este navegador não compartilha tantas fotos de uma vez. Use "Salvar (.zip)".'); return; }
      navigator.share({ files: list, title: list.length + ' fotos com carimbo' }).then(function () { prog(''); }, function (err) {
        if (err && err.name === 'AbortError') return;
        if (late) { prog(list.length + ' fotos prontas: toque em Compartilhar de novo.'); return; }   // o toque expirou enquanto gerava
        notify('Não foi possível compartilhar. Use "Salvar (.zip)".');
      });
    }
    // .zip sem compressão (o JPEG já é comprimido); nomes em UTF-8
    var CRC_T = null;
    function crc32(u8) {
      if (!CRC_T) {
        CRC_T = new Uint32Array(256);
        for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC_T[n] = c >>> 0; }
      }
      var r = 0xFFFFFFFF;
      for (var i = 0; i < u8.length; i++) r = CRC_T[(r ^ u8[i]) & 0xFF] ^ (r >>> 8);
      return (r ^ 0xFFFFFFFF) >>> 0;
    }
    function makeZip(files) {
      var parts = [], central = [], offset = 0, enc = new TextEncoder();
      return files.reduce(function (p, f) {
        return p.then(function () { return f.blob.arrayBuffer(); }).then(function (buf) {
          var name = enc.encode(f.name), size = buf.byteLength, crc = crc32(new Uint8Array(buf));
          var d = f.date instanceof Date && isFinite(f.date.getTime()) ? f.date : new Date();
          var time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
          var day = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
          var lh = new DataView(new ArrayBuffer(30));
          lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
          lh.setUint16(10, time, true); lh.setUint16(12, day, true); lh.setUint32(14, crc, true);
          lh.setUint32(18, size, true); lh.setUint32(22, size, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
          parts.push(lh.buffer, name, f.blob);
          var ch = new DataView(new ArrayBuffer(46));
          ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
          ch.setUint16(12, time, true); ch.setUint16(14, day, true); ch.setUint32(16, crc, true);
          ch.setUint32(20, size, true); ch.setUint32(24, size, true); ch.setUint16(28, name.length, true);
          ch.setUint32(42, offset, true);
          central.push(ch.buffer, name);
          offset += 30 + name.length + size;
        });
      }, Promise.resolve()).then(function () {
        var cdSize = central.reduce(function (s, x) { return s + x.byteLength; }, 0), end = new DataView(new ArrayBuffer(22));
        end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
        end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
        return new Blob(parts.concat(central, [end.buffer]), { type: 'application/zip' });
      });
    }

    // ---------------- câmera dentro do app (site): o local vem do GPS do aparelho no clique,
    // sem depender do que o sistema deixa o navegador ler na foto (o Android apaga o GPS das fotos entregues ao navegador)
    var cam = null;
    function camSupported() { return !!(opts.gps && navigator.mediaDevices && navigator.mediaDevices.getUserMedia); }
    function openCam() {
      startMsg('');
      startGps();
      navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 4032 }, height: { ideal: 3024 } } }).then(function (stream) {
        if (!root || !root.parentNode || cam) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
        cam = { stream: stream, track: stream.getVideoTracks()[0], shots: [], busy: false, lastUrl: null, sure: 0 };
        try { cam.ic = window.ImageCapture ? new window.ImageCapture(cam.track) : null; } catch (e) { cam.ic = null; }
        var v = q('.ft-cam video');
        v.srcObject = stream;
        var p = v.play();
        if (p && p.catch) p.catch(function () { /* toca sozinho quando aparecer */ });
        root.classList.add('camming');
        q('.ft-start').hidden = true;
        q('.ft-cam').hidden = false;
        camLado();
        window.addEventListener('resize', camVirou);
        window.addEventListener('orientationchange', camVirou);
        if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', camVirou);
        renderCam();
      }, function (e) {
        startMsg(e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')
          ? 'A câmera está bloqueada para este site. Libere a câmera nas permissões do navegador, ou use "Câmera do celular".'
          : 'Não foi possível abrir a câmera aqui. Use "Câmera do celular".');
      });
    }
    function stopCam() {
      if (cam) {
        cam.stream.getTracks().forEach(function (t) { t.stop(); });
        if (cam.lastUrl) URL.revokeObjectURL(cam.lastUrl);
      }
      cam = null;
      window.removeEventListener('resize', camVirou);
      window.removeEventListener('orientationchange', camVirou);
      if (screen.orientation && screen.orientation.removeEventListener) screen.orientation.removeEventListener('change', camVirou);
      if (!root) return;
      q('.ft-cam video').srcObject = null;
      root.classList.remove('camming');
      q('.ft-cam').hidden = true;
    }
    // deitado com o topo do celular para a direita (ângulo 270): botões à esquerda, que fica sendo o lado de baixo do celular
    function camLado() {
      if (!root) return;
      var o = screen.orientation, a = o && typeof o.angle === 'number' ? o.angle : window.orientation;
      q('.ft-cam').classList.toggle('ft-cw', ((+a || 0) % 360 + 360) % 360 === 270);
    }
    function camVirou() { camLado(); setTimeout(camLado, 400); }   // o iPhone às vezes só atualiza o ângulo depois de girar a tela
    function camFix() { return lastFix && Date.now() - lastFix.t < 30000 ? lastFix : null; }
    function renderCamGps() {
      var el = q('.ft-camgps'), f = camFix();
      if (!f) { el.innerHTML = '<span class="ft-warn">' + esc(lastFixErr || 'Procurando o GPS…') + '</span> As fotos tiradas agora ficam sem local.'; return; }
      var loc = ref.locate(f.ll[0], f.ll[1]), h;
      if (loc.dist > 2000) h = 'GPS ativo · fora da ' + esc(rodovia()) + ' (' + nf(loc.dist / 1000, 1) + ' km do eixo)';
      else {
        var a = identify(loc.km);
        h = 'GPS ativo · <b>' + esc(kmLine(loc.km, loc.dist >= 10 ? loc.side : '', loc.dist, true)) + '</b>' +
          (a ? ' · ' + esc(a.p.nome) + (a.d === 0 ? ' (aqui)' : ' a ' + (a.d < 1 ? Math.round(a.d * 1000) + ' m' : nf(a.d, 1) + ' km')) : '') + gpsLot(loc.km);
      }
      el.innerHTML = h + ' · precisão ' + Math.round(f.acc || 0) + ' m';
    }
    function renderCam() {
      if (!cam) return;
      renderCamGps();
      var n = cam.shots.length, last = q('.ft-camlast');
      q('[data-ft="cam-done"]').disabled = !n;
      q('.ft-camn').textContent = n ? 'Concluir (' + n + ')' : 'Concluir';
      q('[data-ft="cam-cancel"]').textContent = n ? 'Descartar' : 'Fechar';
      last.hidden = !n;
      last.innerHTML = n && cam.lastUrl ? '<img alt="" src="' + cam.lastUrl + '">' : '';
    }
    function toBlobP(cv, qy) { return new Promise(function (r) { cv.toBlob(r, 'image/jpeg', qy || 0.92); }); }
    function frameBlob(v) {
      var cv = document.createElement('canvas');
      cv.width = v.videoWidth; cv.height = v.videoHeight;
      cv.getContext('2d').drawImage(v, 0, 0);
      return toBlobP(cv).then(function (b) { cv.width = cv.height = 0; return b; });
    }
    // miniatura em tons de cinza (média zero), girada `rot` graus, para comparar com a prévia
    function gray(src, rot, W, H) {
      var cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      var g = cv.getContext('2d'), dw = rot % 180 ? H : W, dh = rot % 180 ? W : H;
      g.translate(W / 2, H / 2); g.rotate(rot * Math.PI / 180);
      g.drawImage(src, -dw / 2, -dh / 2, dw, dh);
      var px = g.getImageData(0, 0, W, H).data, out = new Float32Array(W * H), m = 0, i;
      for (i = 0; i < W * H; i++) { out[i] = px[i * 4] * 0.3 + px[i * 4 + 1] * 0.59 + px[i * 4 + 2] * 0.11; m += out[i]; }
      m /= W * H;
      for (i = 0; i < W * H; i++) out[i] -= m;
      return out;
    }
    // a foto em resolução cheia (ImageCapture) pode vir deitada em alguns aparelhos: gira para ficar como a prévia
    function upright(blob, ref0) {
      return decode(blob).then(function (d) {
        if (!d) return blob;
        var img = d.img, iw = img.naturalWidth, ih = img.naturalHeight, best = null;
        ((iw >= ih) === (ref0.W >= ref0.H) ? [0, 180] : [90, 270]).forEach(function (r) {
          var a = gray(img, r, ref0.W, ref0.H), s = 0;
          for (var i = 0; i < a.length; i++) { var x = a[i] - ref0.g[i]; s += x * x; }
          if (!best || s < best.s) best = { r: r, s: s };
        });
        if (best.r === 0) { URL.revokeObjectURL(d.url); return blob; }
        var cv = document.createElement('canvas'), sw = best.r % 180 ? ih : iw, sh = best.r % 180 ? iw : ih, g = cv.getContext('2d');
        cv.width = sw; cv.height = sh;
        g.translate(sw / 2, sh / 2); g.rotate(best.r * Math.PI / 180); g.drawImage(img, -iw / 2, -ih / 2);
        URL.revokeObjectURL(d.url);
        return toBlobP(cv).then(function (b) { cv.width = cv.height = 0; return b || blob; });
      });
    }
    function grab(v, c) {
      if (!c.ic || typeof c.ic.takePhoto !== 'function') return frameBlob(v);
      var W = 32, H = Math.max(8, Math.round(32 * v.videoHeight / v.videoWidth)), ref0 = { W: W, H: H, g: gray(v, 0, W, H) };
      return c.ic.takePhoto().then(function (blob) { return upright(blob, ref0); }).catch(function () { return frameBlob(v); });
    }
    function shoot() {
      var c = cam, v = q('.ft-cam video');
      if (!c || c.busy || !v.videoWidth) return;
      var fix = camFix(), when = new Date(), btn = q('[data-ft="cam-shot"]'), fl = q('.ft-flash');
      c.busy = true;
      btn.disabled = true;
      fl.classList.add('on');
      setTimeout(function () { fl.classList.remove('on'); }, 60);
      grab(v, c).then(null, function () { return null; }).then(function (blob) {
        if (cam !== c) return;
        c.busy = false;
        btn.disabled = false;
        if (!blob) { notify('Não foi possível capturar a foto. Tente de novo.'); return; }
        var name = 'Foto ' + pad(when.getHours()) + 'h' + pad(when.getMinutes()) + 'm' + pad(when.getSeconds()) + 's.jpg';
        c.shots.push({ file: new File([blob], name, { type: 'image/jpeg', lastModified: when.getTime() }), meta: { live: true, date: when, ll: fix ? fix.ll : null, acc: fix ? fix.acc : null } });
        if (c.lastUrl) URL.revokeObjectURL(c.lastUrl);
        c.lastUrl = URL.createObjectURL(blob);
        c.sure = 0;
        renderCam();
        if (!fix) notify('Foto sem local: o GPS ainda não respondeu.');
      });
    }
    function camDone() {
      if (!cam || cam.busy) return;
      var shots = cam.shots.slice();
      stopCam();
      if (!shots.length) { startView(); return; }
      onFiles(shots.map(function (s) { return s.file; }), 'camapp', shots.map(function (s) { return s.meta; }));
    }
    // com fotos tiradas, descartar pede um segundo toque
    function camCancel(b) {
      if (!cam) return;
      if (cam.shots.length && Date.now() - cam.sure > 3000) {
        cam.sure = Date.now();
        b.textContent = 'Toque de novo para descartar ' + cam.shots.length;
        setTimeout(function () { if (cam && Date.now() - cam.sure >= 3000) renderCam(); }, 3100);
        return;
      }
      startView();
    }

    // ---------------- eventos
    function onClick(e) {
      var o = e.target.closest('[data-set]');
      if (o) {
        var k = o.dataset.set, v = o.dataset.val;
        set[k] = k === 'logoOn' || k === 'logoFundo' ? v === 'true' : v;
        saveSet(set); renderOpts(); scheduleDraw(0);
        return;
      }
      var lg = e.target.closest('[data-logo]');
      if (lg) { selectLogo(lg.dataset.logo); return; }
      var b = e.target.closest('[data-ft]');
      if (!b) return;
      if (batch && b.dataset.i != null) { batchClick(b, +b.dataset.i); return; }
      if (b.dataset.ft === 'cam-open') { openCam(); return; }
      if (b.dataset.ft === 'cam-shot') { shoot(); return; }
      if (b.dataset.ft === 'cam-done') { camDone(); return; }
      if (b.dataset.ft === 'cam-cancel') { camCancel(b); return; }
      if (b.dataset.ft === 'here') {
        useHere(b, function (fix) {
          if (!st) return;
          applyFix(st, fix);
          q('#ftKm').value = st.km != null ? nf(st.km, 2) : '';
          q('#ftLado').value = st.side || '';
          q('#ftDl').value = st.dist != null ? String(st.dist) : '';
          renderHead(); renderPontos(); renderSrc(); scheduleDraw(0);
        });
        return;
      }
      if (b.dataset.ft === 'b-save') { saveAll(); return; }
      if (b.dataset.ft === 'b-share') { shareAll(); return; }
      if (b.dataset.ft === 'b-drive') { sendAllDrive(); return; }
      if (b.dataset.ft === 'drive') { sendDrive(); return; }
      if (b.dataset.ft === 'b-fixall') { if (batch) fixAll(); return; }
      if (b.dataset.ft === 'close') close();
      else if (b.dataset.ft === 'new') { startView(); }
      else if (b.dataset.ft === 'save') save();
      else if (b.dataset.ft === 'share') share();
      else if (b.dataset.ft === 'logo-del') removeLogo();
      else if (b.dataset.ft === 'logo-team') setTeam();
      else if (b.dataset.ft === 'logo-team-off') clearTeam();
      else if (b.dataset.ft === 'fix-lot') applyLot(b.dataset.cid, 'fix');
      else if (b.dataset.ft === 'keep-lot' && st) { var kc = contract(); st.keepLot = kc ? kc.id + '@' + nf(st.km, 2) : ''; renderLote(); }
    }
    // botões de uma foto do lote de fotos
    function batchClick(b, i) {
      var it = batch.items[i];
      if (!it || it.gone) return;
      if (b.dataset.ft === 'b-del') {
        it.gone = true;
        batch.ver++;
        if (it.url) URL.revokeObjectURL(it.url);
        if (it.prevUrl) URL.revokeObjectURL(it.prevUrl);
        it.url = it.prevUrl = null; it.img = null;
        var el = itemEl(i);
        if (el) el.remove();
        if (!liveItems().length) { startView(); return; }
        renderBatchSum();
      } else if (b.dataset.ft === 'fix-lot') {
        var c = setItemLot(it, b.dataset.cid);
        if (!c) return;
        refreshItem(i); itemChanged(i); renderBatchSum();
        var p = withItem(it, function () { return findPoint(it.pid); });
        notify('Foto ' + (i + 1) + ' no ' + lotName(c) + (p ? ' · ponto ' + p.nome : '') + '.');
      } else if (b.dataset.ft === 'keep-lot') {
        var kc = withItem(it, contract);
        it.keepLot = kc && it.km != null ? kc.id + '@' + nf(it.km, 2) : '';
        refreshItem(i); renderBatchSum();
      } else if (b.dataset.ft === 'b-here') {
        useHere(b, function (fix) {
          if (!batch || it.gone) return;
          applyFix(it, fix);
          var ki = itemEl(i).querySelector('[data-b="km"]');
          if (ki) ki.value = it.km != null ? nf(it.km, 2) : '';
          refreshItem(i); renderBatchSum(); itemChanged(i);
        });
      }
    }
    function batchInput(t) {
      if (t.id === 'ftBDesc') {
        batch.common = t.value;
        batch.ver++;
        clearTimeout(descTimer);
        descTimer = setTimeout(function () {
          if (!batch) return;
          batch.items.forEach(function (it, i) { if (!it.gone && !it.wait && !it.err) { refreshItem(i); if (!it.desc.trim()) queueDraw(i); } });
        }, 300);
        return true;
      }
      if (!t.dataset || !t.dataset.b) return false;
      var i = +t.dataset.i, it = batch.items[i];
      if (!it || it.gone || it.wait || it.err) return true;
      if (t.dataset.b === 'km') {
        var k = parseNum(t.value);
        withItem(it, function () {
          it.km = k != null && k >= ref.kmMin - 50 && k <= ref.kmMax + 50 ? k : null;
          if (it.src !== 'manual' && it.loc && it.km != null && Math.abs(it.km - it.loc.km) > 0.001) { it.src = 'manual'; it.ll = null; it.loc = null; }
          var auto = it.km != null ? identify(it.km) : null;
          if (auto && auto.d <= 0.05) it.pid = auto.p.id;
        });
        refreshItem(i); renderBatchSum(); itemChanged(i, true);
      } else if (t.dataset.b === 'desc') { it.desc = t.value; itemChanged(i, true); }
      else if (t.dataset.b === 'ponto') {
        withItem(it, function () {
          it.pid = t.value;
          var p = findPoint(it.pid);
          if (p && (it.km == null || it.src === 'manual')) it.km = p.kmIni;
        });
        var ki = itemEl(i).querySelector('[data-b="km"]');
        if (ki) ki.value = it.km != null ? nf(it.km, 2) : '';
        refreshItem(i); renderBatchSum(); itemChanged(i);
      } else if (t.dataset.b === 'lote') { setItemLot(it, t.value); refreshItem(i); renderBatchSum(); itemChanged(i); }
      return true;
    }
    function onInput(e) {
      var t = e.target;
      if (batch && t.tagName !== 'SELECT' && batchInput(t)) return;
      if (!st) return;
      if (t.id === 'ftKm') {
        var k = parseNum(t.value);
        st.km = k != null && k >= ref.kmMin - 50 && k <= ref.kmMax + 50 ? k : null;
        if (st.src !== 'manual' && st.loc && st.km != null && Math.abs(st.km - st.loc.km) > 0.001) { st.src = 'manual'; st.ll = null; st.loc = null; }
        var auto = st.km != null ? identify(st.km) : null;
        if (auto && auto.d <= 0.05) st.pid = auto.p.id;
        renderPontos(); renderSrc();
      } else if (t.id === 'ftDl') {
        var dl = parseNum(t.value); st.dist = dl != null ? Math.max(0, Math.round(dl)) : null;
      } else if (t.id === 'ftDesc') {
        st.desc = t.value;
      } else if (t.id === 'ftData') {
        var d = t.value ? new Date(t.value) : null; if (d && isFinite(d.getTime())) st.date = d;
      } else return;
      scheduleDraw();
    }
    function onChange(e) {
      var t = e.target;
      if (t.id === 'ftCam' || t.id === 'ftGal') { origin = t.id === 'ftCam' ? 'camera' : 'galeria'; onFile(t.files && t.files[0], origin); t.value = ''; return; }
      if (t.id === 'ftArq') { origin = 'arquivos'; onFiles(t.files, origin); t.value = ''; return; }
      if (t.id === 'ftLogoFile') {
        var f = t.files && t.files[0];
        if (f) addLogo(f);
        t.value = '';
        return;
      }
      if (t.dataset && t.dataset.campo) { set.campos[t.dataset.campo] = t.checked; saveSet(set); scheduleDraw(0); return; }
      if (batch && t.tagName === 'SELECT' && batchInput(t)) return;
      if (!st) return;
      if (t.id === 'ftPonto') {
        st.pid = t.value;
        var p = findPoint(st.pid);
        if (p && (st.km == null || st.src === 'manual')) { st.km = p.kmIni; q('#ftKm').value = nf(p.kmIni, 2); }
        renderSrc(); scheduleDraw(0);
      } else if (t.id === 'ftLote') {
        applyLot(t.value, 'select');
      } else if (t.id === 'ftLado') { st.side = t.value; if (!st.side) { st.dist = null; q('#ftDl').value = ''; } scheduleDraw(0); }
    }

    // ---------------- logos: consórcio (embutida), padrão da equipe (banco, definida pelo responsável) e as adicionadas neste aparelho
    function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
    var deviceLogos = (function () {
      var list = [];
      try { list = JSON.parse(lsGet(LOGOS_KEY) || '[]') || []; } catch (e) { list = []; }
      list = list.filter(function (l) { return l && typeof l.src === 'string' && /^data:image\//.test(l.src); });
      var old = lsGet(OLD_LOGO_KEY);   // versão anterior guardava uma logo só
      if (old && /^data:image\//.test(old) && !list.length) {
        list.push({ id: 'l' + Date.now().toString(36), nome: 'Logo carregada', src: old });
        lsSet(LOGOS_KEY, JSON.stringify(list));
        lsSet(LOGO_SEL_KEY, list[0].id);
      }
      try { localStorage.removeItem(OLD_LOGO_KEY); } catch (e) { /* nada */ }
      return list;
    })();
    var selId = lsGet(LOGO_SEL_KEY) || '', curImg = null, curKey = '';
    function teamLogo() { var t = opts.getTeamLogo ? opts.getTeamLogo() : null; return t && typeof t.src === 'string' && /^data:image\//.test(t.src) ? t : null; }
    function library() {
      var out = [], t = teamLogo();
      if (t) out.push({ id: 'equipe', nome: t.nome || 'Logo da equipe', src: t.src, team: true });
      if (opts.logoSrc) out.push({ id: 'consorcio', nome: 'Consórcio Magna/Enecon', src: opts.logoSrc, builtin: true });
      return out.concat(deviceLogos);
    }
    function currentLogo() {
      var lib = library(), pick = null;
      lib.forEach(function (l) { if (l.id === selId) pick = l; });
      return pick || lib[0] || null;
    }
    function refreshLogo() {
      var cur = currentLogo(), key = cur ? cur.id + ':' + cur.src.length : '';
      if (key === curKey) return;
      curKey = key;
      if (!cur) { curImg = null; scheduleDraw(0); return; }
      loadLogo(cur.src).then(function (im) { if (curKey === key) { curImg = im; scheduleDraw(0); } });
    }
    function renderLogos() {
      if (!root) return;
      var cur = currentLogo(), t = teamLogo(), canTeam = !!(opts.canSetTeamLogo && opts.canSetTeamLogo());
      q('.ft-logos').innerHTML = library().map(function (l) {
        return '<button type="button" class="ft-logo" data-logo="' + esc(l.id) + '" aria-pressed="' + (cur && cur.id === l.id) + '"><img src="' + esc(l.src) + '" alt=""><span>' + esc(l.nome) + (l.team ? '<small>padrão da equipe</small>' : '') + '</span></button>';
      }).join('');
      q('[data-ft="logo-del"]').hidden = !(cur && !cur.team && !cur.builtin);
      q('[data-ft="logo-team"]').hidden = !(canTeam && cur && !cur.team);
      q('[data-ft="logo-team-off"]').hidden = !(canTeam && t);
      q('.ft-logo-src').textContent = 'A logo marcada fica como padrão neste aparelho. ' +
        (t ? 'A equipe usa por padrão: ' + (t.nome || 'logo da equipe') + '. ' : '') +
        (canTeam ? 'Como responsável, você pode deixar a logo marcada como padrão para toda a equipe.' : '');
    }
    function selectLogo(id) { selId = id; lsSet(LOGO_SEL_KEY, id); set.logoOn = true; saveSet(set); renderOpts(); refreshLogo(); }
    // logo adicionada: reduzida (PNG mantém a transparência; até 600 px) e guardada no aparelho
    function shrinkLogo(im) {
      function enc(w, type) {
        var h = Math.max(1, Math.round(w * im.naturalHeight / im.naturalWidth)), cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(im, 0, 0, w, h);
        return cv.toDataURL(type || 'image/png', 0.92);
      }
      var w = Math.min(600, im.naturalWidth), data = enc(w);
      if (data.length > 200000) data = enc(Math.min(400, w));
      if (data.length > 200000) data = enc(Math.min(400, w), 'image/webp');
      return data;
    }
    function addLogo(file) {
      var url = URL.createObjectURL(file);
      loadLogo(url).then(function (im) {
        URL.revokeObjectURL(url);
        if (!im) { notify('Não foi possível abrir essa imagem de logo. Use PNG ou JPG.'); return; }
        var item = { id: 'l' + Date.now().toString(36), nome: (file.name || 'Logo').replace(/\.[^.]+$/, '').slice(0, 40) || 'Logo', src: shrinkLogo(im) };
        deviceLogos.push(item);
        if (!lsSet(LOGOS_KEY, JSON.stringify(deviceLogos))) notify('A logo vale só nesta visita: o navegador não deixou guardá-la.');
        selectLogo(item.id);
      });
    }
    function removeLogo() {
      var cur = currentLogo();
      if (!cur || cur.team || cur.builtin) return;
      deviceLogos = deviceLogos.filter(function (l) { return l.id !== cur.id; });
      lsSet(LOGOS_KEY, JSON.stringify(deviceLogos));
      selectLogo('');
    }
    function setTeam() {
      var cur = currentLogo();
      if (!cur || cur.team || !opts.setTeamLogo) return;
      Promise.resolve(opts.setTeamLogo({ nome: cur.nome, src: cur.src })).then(function () {
        notify('Logo "' + cur.nome + '" definida como padrão da equipe.');
        selectLogo('equipe');
      }, function () { notify('Não foi possível salvar a logo da equipe. Tente de novo.'); });
    }
    function clearTeam() {
      if (!opts.clearTeamLogo) return;
      Promise.resolve(opts.clearTeamLogo()).then(function () { notify('A equipe volta a usar a logo do consórcio.'); renderOpts(); refreshLogo(); },
        function () { notify('Não foi possível tirar a logo da equipe. Tente de novo.'); });
    }
    function open(o) {
      o = o || {};
      opts.initialPoint = o.pointId || '';
      if (!root) build();
      (document.fullscreenElement || document.body).appendChild(root);
      document.documentElement.style.overflow = 'hidden';
      refreshLogo();
      startGps();
      startView();
      refreshDrive();
      setTimeout(function () { var x = q('.ft-x'); if (x) x.focus(); }, 30);
    }
    function close() {
      stopCam();
      stopGps();
      if (root && root.parentNode) root.parentNode.removeChild(root);
      document.documentElement.style.overflow = '';
      if (st && st.url) URL.revokeObjectURL(st.url);
      st = null;
      clearBatch();
    }

    // o padrão da equipe mudou no banco
    function refreshTeam() { if (root && root.parentNode) { renderOpts(); } refreshLogo(); }

    return { open: open, close: close, refreshTeam: refreshTeam, refreshDrive: refreshDrive, readExif: readExif, _state: function () { return st; }, _batch: function () { return batch; } };
  }

  FotoCarimbo.readExif = readExif;
  FotoCarimbo.readMeta = readMeta;
  window.FotoCarimbo = FotoCarimbo;
})();
