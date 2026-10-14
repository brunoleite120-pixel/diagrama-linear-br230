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
      if (g[2] && g[4]) {
        var la = rats(g[2]), lo = rats(g[4]);
        var lat = la[0] + la[1] / 60 + la[2] / 3600, lon = lo[0] + lo[1] / 60 + lo[2] / 3600;
        if (g[1] && ascii(g[1]).toUpperCase() === 'S') lat = -lat;
        if (g[3] && ascii(g[3]).toUpperCase() === 'W') lon = -lon;
        if (isFinite(lat) && isFinite(lon) && (lat !== 0 || lon !== 0)) out.ll = [lat, lon];
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
  function readMeta(buf) {
    var ex = readExif(buf) || {};
    if (ex.ll) ex.via = 'exif';
    else { var x = readXmp(buf); if (x) { ex.ll = x; ex.via = 'xmp'; } }
    return ex;
  }

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
    '.ft-big{display:flex;align-items:center;justify-content:center;gap:10px;min-height:56px;border-radius:10px;border:1px solid var(--ft-accent);background:var(--ft-accent);color:var(--ft-accent-ink);font-size:16px;font-weight:650;cursor:pointer}',
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
    '@media (max-width:820px){.ft-work{grid-template-columns:1fr}.ft-prev{position:static}.ft-prev canvas{max-height:58vh}.ft-body{padding:12px}}',
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
            '<label class="ft-big">' + CAM + 'Tirar foto<input class="ft-file" type="file" id="ftCam" accept="image/*" capture="environment"></label>' +
            '<label class="ft-big alt">' + GAL + 'Escolher da galeria<input class="ft-file" type="file" id="ftGal" accept="image/*"></label>' +
            '<label class="ft-big alt">' + ARQ + 'Arquivos do celular<input class="ft-file" type="file" id="ftArq"></label>' +
            '<p class="ft-msg ft-warn" hidden></p>' +
            '<p class="ft-note"></p>' +
          '</div>' +
          '<div class="ft-work" hidden>' +
            '<div class="ft-prev"><canvas aria-label="Prévia da foto com carimbo"></canvas></div>' +
            '<div class="ft-side">' +
              '<section class="ft-sec"><h4>Local</h4><div class="ft-lot" role="status" hidden></div><div class="ft-src"></div>' +
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
              '<section class="ft-sec"><h4>O que aparece na legenda</h4><div class="ft-checks">' +
                FIELDS.map(function (f) { return '<label><input type="checkbox" id="ftC-' + f.k + '" data-campo="' + f.k + '">' + f.label + '</label>'; }).join('') +
              '</div></section>' +
              '<section class="ft-sec"><h4>Aparência</h4>' +
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
        '</div>' +
        '<div class="ft-foot" hidden><button type="button" class="ft-btn" data-ft="new">Nova foto</button>' +
          (opts.share ? '<button type="button" class="ft-btn" data-ft="share">Compartilhar</button>' : '') +
          '<button type="button" class="ft-btn primary" data-ft="save">Salvar foto</button></div>';
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
      renderHead();
      q('.ft-start').hidden = false;
      q('.ft-work').hidden = true;
      q('.ft-foot').hidden = true;
      startMsg('');
      q('.ft-note').textContent = (opts.gps
        ? 'O km sai do GPS do aparelho na hora da foto ou da localização gravada na foto. '
        : 'Neste link o navegador não informa a localização do aparelho: o km sai da localização gravada na foto. Deixe a câmera do celular salvando o local. ') +
        'Se a galeria entregar a foto sem localização, abra a mesma foto por "Arquivos do celular" (pasta DCIM > Câmera). Se ainda faltar, você digita o km ou escolhe o ponto.';
      renderGps();
    }
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
      q('.ft-ct').textContent = c ? [c.lote, c.numero, rodovia()].filter(Boolean).join(' · ') : rodovia();
    }
    var lastFixErr = '';
    function startGps() {
      if (!opts.gps || gpsWatch != null || !navigator.geolocation) return;
      gpsWatch = navigator.geolocation.watchPosition(function (pos) {
        lastFix = { ll: [pos.coords.latitude, pos.coords.longitude], acc: pos.coords.accuracy, t: Date.now() };
        lastFixErr = '';
        if (root && !q('.ft-start').hidden) renderGps();
      }, function (e) {
        lastFixErr = e && e.code === 1 ? 'A localização está bloqueada para este site. Libere nas permissões do navegador ou informe o km depois.' : 'Sem sinal de GPS no momento.';
        if (root && !q('.ft-start').hidden) renderGps();
      }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 30000 });
    }
    function stopGps() {
      if (gpsWatch != null && navigator.geolocation) navigator.geolocation.clearWatch(gpsWatch);
      gpsWatch = null;
    }

    // ---------------- foto escolhida
    function startMsg(text) { var el = q('.ft-msg'); el.textContent = text || ''; el.hidden = !text; }
    function onFile(file, from) {
      if (!file) return;
      startMsg('');
      if (file.type && !/^image\//.test(file.type)) { startMsg('Esse arquivo não é uma imagem. Escolha uma foto (JPEG).'); return; }
      // lê o começo do arquivo (até 1 MB) atrás do GPS gravado pela câmera
      file.slice(0, 1048576).arrayBuffer().then(function (buf) { return buf; }, function () { return null; }).then(function (buf) {
        var meta = buf ? readMeta(buf) : {}, heif = buf ? isHeif(buf) : false;
        var url = URL.createObjectURL(file), img = new Image();
        img.onload = function () { setupPhoto(img, url, file, meta, from); };
        img.onerror = function () {
          URL.revokeObjectURL(url);
          startMsg(heif
            ? 'Esta foto está em HEIC/HEIF, formato que o navegador não abre. Mude a câmera para JPEG (iPhone: Ajustes > Câmera > Formatos > Mais compatível; Samsung: câmera > configurações > desligue "Imagens HEIF") e tire a foto de novo.'
            : 'Não foi possível abrir essa imagem. Tente uma foto em JPEG.');
        };
        img.src = url;
      });
    }
    function setupPhoto(img, url, file, ex, from) {
      if (st && st.url) URL.revokeObjectURL(st.url);
      var ac = activeContract();
      st = { img: img, url: url, w: img.naturalWidth, h: img.naturalHeight, ll: null, km: null, side: '', dist: null, acc: null, src: 'manual', pid: '', desc: '', cid: ac ? ac.id : '' };
      st.date = ex.date || (from === 'camera' ? new Date() : new Date(file.lastModified || Date.now()));
      st.from = from;
      if (ex.ll) { st.ll = ex.ll; st.src = 'exif'; }
      else if (from === 'camera' && lastFix && Date.now() - lastFix.t < 120000) { st.ll = lastFix.ll; st.acc = lastFix.acc; st.src = 'gps'; }
      if (st.ll) {
        var loc = ref.locate(st.ll[0], st.ll[1]);
        st.loc = loc;
        if (loc.dist <= 2000) { st.km = loc.km; st.side = loc.dist >= 10 ? loc.side : ''; st.dist = loc.dist >= 10 ? Math.round(loc.dist) : null; }
      }
      st.noLoc = !st.ll;
      var auto = st.km != null ? identify(st.km) : null;
      st.pid = auto && auto.d <= 0.05 ? auto.p.id : (opts.initialPoint || '');
      if (!st.ll && st.pid) { var p0 = findPoint(st.pid); if (p0) st.km = p0.kmIni; }
      showWork();
    }
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
      q('.ft-start').hidden = true;
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
    function renderPontos() {
      var c = contract(), list = c ? (c.pontos || []).filter(function (p) { return p.kmIni != null; }).slice() : [];
      list.sort(function (a, b) { return a.kmIni - b.kmIni; });
      var h = '<option value="">Nenhum</option>';
      list.forEach(function (p) {
        var b = p.kmFim != null ? p.kmFim : p.kmIni, d = st.km == null ? null : st.km < p.kmIni ? p.kmIni - st.km : st.km > b ? st.km - b : 0;
        var dist = d == null ? '' : d === 0 ? ' · aqui' : ' · a ' + (d < 1 ? Math.round(d * 1000) + ' m' : nf(d, 1) + ' km');
        h += '<option value="' + esc(p.id) + '"' + (p.id === st.pid ? ' selected' : '') + '>' + esc(p.nome) + ' (km ' + nf(p.kmIni, 2) + ')' + dist + '</option>';
      });
      q('#ftPonto').innerHTML = h;
    }
    function renderSrc() {
      var h;
      if (st.src === 'exif') h = 'Posição: <b>GPS gravado na foto</b> ' + coordTxt(st.ll) + '.';
      else if (st.src === 'gps') h = 'Posição: <b>GPS do aparelho</b> na hora da foto ' + coordTxt(st.ll) + (st.acc ? ' (precisão ' + Math.round(st.acc) + ' m)' : '') + '.';
      else h = 'Posição: <b>informada à mão</b>. As coordenadas são as do eixo no km digitado (SNV ' + esc(snv.versao) + ').';
      if (st.src === 'manual' && st.noLoc) {
        h += ' <span class="ft-warn">Esta foto chegou sem localização.</span> ' + (st.from === 'camera'
          ? 'A câmera não gravou o local: ative a localização nas configurações da câmera (Android: "Tags de local"; iPhone: Ajustes > Privacidade > Serviços de Localização > Câmera).'
          : st.from === 'galeria'
            ? 'A galeria costuma apagar a localização ao entregar a foto ao navegador. Toque em Nova foto e abra a mesma foto por "Arquivos do celular" (pasta DCIM > Câmera).'
            : 'O arquivo não tem localização gravada. Confira se a câmera está salvando o local.') + ' Por enquanto, digite o km ou escolha o ponto.';
      }
      if (st.loc && st.loc.dist > 2000) h += ' <span class="ft-warn">A foto está a ' + nf(st.loc.dist / 1000, 1) + ' km da ' + esc(rodovia()) + ': confira o km.</span>';
      var p = findPoint(st.pid);
      if (p && st.km != null) {
        var b = p.kmFim != null ? p.kmFim : p.kmIni;
        if (st.km < p.kmIni - 0.05 || st.km > b + 0.05) h += ' <span class="ft-warn">O km está fora do ' + esc(p.nome) + ' (km ' + nf(p.kmIni, 2) + ' a ' + nf(b, 2) + ').</span>';
      }
      q('.ft-src').innerHTML = h;
      renderLote();
    }
    // confere se o km cai no trecho do lote da foto; se for de outro lote, avisa e oferece a correção
    function renderLote() {
      var list = contracts(), cur = contract(), box = q('.ft-lot');
      var here = st.km != null ? lotsAt(st.km) : [];
      q('#ftLoteWrap').hidden = list.length < 2;
      q('#ftLote').innerHTML = list.map(function (c) {
        var r = rangeTxt(c);
        return '<option value="' + esc(c.id) + '"' + (cur && c.id === cur.id ? ' selected' : '') + '>' + esc(lotName(c)) + (r ? ' · ' + r : '') + (has(here, c) ? ' · o km está aqui' : '') + '</option>';
      }).join('');
      var h = '';
      if (st.km != null && cur && !has(here, cur)) {
        if (here.length) {
          h = '<div>O km <b>' + nf(st.km, 2) + '</b> fica no <b>' + esc(lotName(here[0])) + '</b> (' + esc(rangeTxt(here[0])) + '), não no ' + esc(lotName(cur)) +
            (rangeTxt(cur) ? ' (' + esc(rangeTxt(cur)) + ')' : '') + '. A legenda e o ponto estão usando o lote errado.</div><div class="ft-opts">' +
            here.map(function (c) {
              var a = pointNear(c, st.km);
              return '<button type="button" class="ft-opt ft-fix" data-ft="fix-lot" data-cid="' + esc(c.id) + '">Corrigir para ' + esc(c.lote || lotName(c)) + (a ? ' · ' + esc(a.nome) : '') + '</button>';
            }).join('') +
            '<button type="button" class="ft-opt" data-ft="keep-lot">Manter ' + esc(cur.lote || lotName(cur)) + '</button></div>';
          if (st.keepLot === cur.id + '@' + nf(st.km, 2)) h = '';
        } else if (lotRange(cur)) {
          h = '<div>O km <b>' + nf(st.km, 2) + '</b> está fora do trecho de todos os contratos cadastrados (' +
            list.filter(function (c) { return lotRange(c); }).map(function (c) { return esc(c.lote || lotName(c)) + ': ' + esc(rangeTxt(c)); }).join('; ') +
            '). Confira o km.</div>';
        }
      }
      box.innerHTML = h;
      box.hidden = !h;
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
      if (C.desc && st.desc.trim()) out.push({ wrap: st.desc.trim() });
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
      drawTimer = setTimeout(function () { if (st) draw(q('.ft-prev canvas'), 1600); }, ms == null ? 90 : ms);
    }

    // ---------------- salvar
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
        cv.toBlob(function (b) { resolve(b); }, 'image/jpeg', 0.9);
      });
    }
    function busy(on) { root.querySelectorAll('[data-ft="save"],[data-ft="share"]').forEach(function (b) { b.disabled = on; }); }
    function save() {
      if (!st) return;
      busy(true);
      makeBlob().then(function (blob) {
        if (!blob) { notify('Não foi possível gerar a foto. Tente com uma imagem menor.'); return; }
        return opts.saveBlob(fileName(), blob);
      }).then(function () { busy(false); }, function () { busy(false); });
    }
    function share() {
      if (!st) return;
      busy(true);
      makeBlob().then(function (blob) {
        var f = new File([blob], fileName(), { type: 'image/jpeg' });
        if (navigator.canShare && navigator.canShare({ files: [f] })) return navigator.share({ files: [f], title: fileName() });
        notify('Este navegador não compartilha arquivos. Use Salvar foto.');
      }).catch(function () { /* compartilhamento cancelado */ }).then(function () { busy(false); });
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
    function onInput(e) {
      var t = e.target;
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
      if (t.id === 'ftCam' || t.id === 'ftGal' || t.id === 'ftArq') { origin = t.id === 'ftCam' ? 'camera' : t.id === 'ftGal' ? 'galeria' : 'arquivos'; onFile(t.files && t.files[0], origin); t.value = ''; return; }
      if (t.id === 'ftLogoFile') {
        var f = t.files && t.files[0];
        if (f) addLogo(f);
        t.value = '';
        return;
      }
      if (t.dataset && t.dataset.campo) { set.campos[t.dataset.campo] = t.checked; saveSet(set); scheduleDraw(0); return; }
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
      setTimeout(function () { var x = q('.ft-x'); if (x) x.focus(); }, 30);
    }
    function close() {
      stopGps();
      if (root && root.parentNode) root.parentNode.removeChild(root);
      document.documentElement.style.overflow = '';
      if (st && st.url) URL.revokeObjectURL(st.url);
      st = null;
    }

    // o padrão da equipe mudou no banco
    function refreshTeam() { if (root && root.parentNode) { renderOpts(); } refreshLogo(); }

    return { open: open, close: close, refreshTeam: refreshTeam, readExif: readExif, _state: function () { return st; } };
  }

  FotoCarimbo.readExif = readExif;
  FotoCarimbo.readMeta = readMeta;
  window.FotoCarimbo = FotoCarimbo;
})();
