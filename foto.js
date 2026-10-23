/*
 * Foto com carimbo: logo no canto escolhido e legenda com rodovia, km (SNV), lado/distância do eixo,
 * coordenadas, data e hora, ponto crítico identificado pelo km, contrato e descrição.
 * Usado pelo site local e embutido na página online (build.js troca o marcador). Precisa de MapaSNV.Ref
 * (mapa.js) e de window.SNV_BR230.
 *
 *   var f = FotoCarimbo({ snv, getContract, logoSrc, gps, share, saveBlob, notify, nomes,
 *                         getTeamLogo, canSetTeamLogo, setTeamLogo, clearTeamLogo });
 *   f.open({ pointId });
 * nomes: funções de nome do contrato do app.js (nome de tela, formal, pasta do Drive); sem elas, vale a cópia curta daqui.
 *
 * De onde vem a posição, nesta ordem: GPS gravado na foto (EXIF), GPS do aparelho na hora da foto
 * (só onde o navegador libera), ou km digitado / ponto escolhido.
 */
(function () {
  'use strict';

  var KEY = 'diagrama-linear.foto';
  var LOGOS_KEY = 'diagrama-linear.foto-logos';           // logos adicionadas neste aparelho
  var LOGO_SEL_KEY = 'diagrama-linear.foto-logo-escolhida';
  var GIRO_KEY = 'diagrama-linear.foto-cam-giro';          // como a foto da câmera sai: 'deitada' (padrão), 'auto' ou 'empe'
  var CAM_GIROS = [['deitada', 'Deitada (padrão)', 'A foto sai sempre deitada. Com o celular em pé, entra o quadro deitado do meio.'],
    ['auto', 'Automático', 'Em pé ou deitada, como o celular estiver (pelo sensor, mesmo com a rotação da tela travada).'],
    ['empe', 'Sempre em pé', 'A foto sai sempre em pé. Com o celular deitado, entra o quadro em pé do meio.']];
  var DNIT_KEY = 'diagrama-linear.foto-logo-dnit-2';       // '1': a logo do DNIT já foi posta como padrão neste aparelho (de novo em 22/10/2026)
  var OLD_LOGO_KEY = 'diagrama-linear.foto-logo';           // versão 9: uma logo só
  var NUVEM = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 19a5 5 0 0 1-.7-9.95A6.5 6.5 0 0 1 18.6 9 4.5 4.5 0 0 1 17.5 19z"/></svg>';
  function celular() { return /iPad|iPhone|iPod|Android/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  var DRIVE_KEY = 'diagrama-linear.foto-drive';             // '0': fotos novas ficam só no aparelho (desmarcadas para o Drive)
  var MESES = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
  var FIELDS = [
    { k: 'rodkm', label: 'Rodovia e km', on: true },
    { k: 'lado', label: 'Lado e distância do eixo', on: true },
    { k: 'coord', label: 'Coordenadas', on: true },
    { k: 'data', label: 'Data e hora', on: true },
    { k: 'ponto', label: 'Ponto crítico', on: true },
    { k: 'contrato', label: 'Lote e contrato', curto: 'lote', on: true },
    { k: 'executora', label: 'Executora', on: true },
    { k: 'supervisora', label: 'Supervisora', on: true },
    { k: 'desc', label: 'Descrição', on: true },
    { k: 'snv', label: 'Versão do SNV', on: true }
  ];
  var CORNERS = [['tl', 'Em cima, esq.'], ['tr', 'Em cima, dir.'], ['bl', 'Embaixo, esq.'], ['br', 'Embaixo, dir.']];
  var COLORS = { amarelo: '#FFE81A', branco: '#FFFFFF' };
  var SIZES = { P: 0.024, M: 0.031, G: 0.04 };
  var CORES_OP = [['amarelo', 'Amarelo'], ['branco', 'Branco']];
  var TAMS_OP = [['P', 'Pequeno'], ['M', 'Médio'], ['G', 'Grande']];
  var FUNDOS_OP = [['sombra', 'Sombra'], ['faixa', 'Faixa escura'], ['nenhum', 'Sem fundo']];
  // tamanho do arquivo final (salvar, compartilhar, Drive): [lado maior em px, qualidade do JPEG].
  // Normal (1280 px a 80%, o padrão desde 22/10/2026) fica com cerca de 0,4 MB e serve para tudo: ver no app, relatório (o PDF
  // usa até 1400 px) e galeria do celular. Full HD (1920 px a 85%) fica com cerca de 1 MB, para quem precisa ampliar muito.
  var ARQS = { tela: [1280, 0.8], fhd: [1920, 0.85] };
  var ARQS_OP = [['tela', 'Normal', '1280 px · cerca de 0,4 MB · nítida no relatório (padrão)'], ['fhd', 'Full HD', '1920 px · cerca de 1 MB · para ampliar muito']];
  // padrão do carimbo de 22/10/2026 (todos os itens, legenda no canto inferior direito, logo sem fundo, 1280 px): o que foi
  // guardado antes (sem setV) volta uma vez ao padrão novo; depois vale o que a pessoa escolher
  var SET_V = 3;
  // os 4 grupos de opções (cada um abre a sua folha) e as chaves de `set` de cada um; a logo escolhida fica em LOGO_SEL_KEY
  var GRUPOS = { leg: ['leg', 'campos'], apa: ['cor', 'tam', 'fundo'], logo: ['logoOn', 'logo', 'logoFundo'], arq: ['arq'] };
  var GRUPO_NOME = { leg: 'Legenda', apa: 'Aparência', logo: 'Logo', arq: 'Arquivo' };
  var GRUPO_TITULO = { leg: 'O que aparece na legenda', apa: 'Aparência', logo: 'Logo', arq: 'Tamanho do arquivo' };
  // folga do km no trecho do contrato: 50 m, a mesma da galeria (galeria.js)
  var FOLGA_KM = 0.05;
  // todos os contratos cujo trecho tem o km, na ordem da lista; faixa(c): [km inicial, km final] ou null. Nunca só "o primeiro":
  // os de conservação cobrem o mesmo trecho dos de pontos críticos, e a ordem não diz qual serviço foi fotografado
  function contratosNoKm(cs, km, faixa) {
    if (km == null || !isFinite(km)) return [];
    return (cs || []).filter(function (c) { var r = faixa(c); return !!r && km >= r[0] - FOLGA_KM && km <= r[1] + FOLGA_KM; });
  }

  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  // no app (Capacitor) a permissão é do app, nos Ajustes do aparelho; no site, do navegador
  function nativo() { var C = window.Capacitor; return !!(C && C.isNativePlatform && C.isNativePlatform()); }
  function bloqueado(oque) {
    return nativo() ? oque + ' está bloqueada para o app. Libere nos Ajustes do aparelho, nas permissões do app VIA-230'
      : oque + ' está bloqueada para este site. Libere nas permissões do navegador';
  }
  function opcao(lista, k) { for (var i = 0; i < lista.length; i++) if (lista[i][0] === k) return lista[i]; return null; }
  function rotulo(lista, k) { var o = opcao(lista, k); return o ? o[1] : ''; }
  function defaults() {
    var campos = {};
    FIELDS.forEach(function (f) { campos[f.k] = f.on; });
    return { logo: 'tl', leg: 'br', cor: 'amarelo', tam: 'M', fundo: 'sombra', logoFundo: false, logoOn: true, arq: 'tela', setV: SET_V, campos: campos };
  }
  // `txt`: o texto guardado (para os testes); sem ele, lê o deste aparelho. Valor desconhecido volta ao padrão.
  function loadSet(txt) {
    var d = defaults(), VALE = { logo: CORNERS, leg: CORNERS, cor: CORES_OP, tam: TAMS_OP, fundo: FUNDOS_OP };
    try {
      var s = JSON.parse((txt !== undefined ? txt : localStorage.getItem(KEY)) || 'null');
      if (s && typeof s === 'object' && s.setV === SET_V) {
        Object.keys(VALE).forEach(function (k) { if (typeof s[k] === 'string' && opcao(VALE[k], s[k])) d[k] = s[k]; });
        ['logoFundo', 'logoOn'].forEach(function (k) { if (typeof s[k] === 'boolean') d[k] = s[k]; });
        if (typeof s.arq === 'string' && own(ARQS, s.arq)) d.arq = s.arq;
        if (s.campos && typeof s.campos === 'object') FIELDS.forEach(function (f) { if (typeof s.campos[f.k] === 'boolean') d.campos[f.k] = s.campos[f.k]; });
      }
    } catch (e) { /* sem armazenamento: usa o padrão */ }
    return d;
  }
  // false: o navegador não deixou guardar (aba anônima, armazenamento cheio)
  function saveSet(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch (e) { return false; } }
  // nome curto da logo, para o botão "Logo" ("DNIT", "Consórcio")
  function logoCurto(l) {
    if (!l) return '';
    if (l.id === 'dnit') return 'DNIT';
    if (l.id === 'consorcio') return 'Consórcio';
    // sem o "Logo"/"Logo da" do começo do nome do arquivo ("Logo da Plennus" vira "Plennus"); nome longo fica só a primeira palavra
    var n = String(l.nome || '').trim().replace(/^(logo(marca|tipo)?|marca)[\s_-]+(d[aeo]s?\s+)?(?=\S)/i, '');
    n = n ? n.charAt(0).toUpperCase() + n.slice(1) : l.team ? 'Da equipe' : 'Logo';
    var w = n.split(/\s+/)[0];
    return n.length <= 12 ? n : w.length >= 3 && w.length <= 12 ? w : n.slice(0, 11) + '…';
  }
  // o valor de cada um dos 4 botões; `logo`: nome curto da logo escolhida ('' = nenhuma)
  function resumos(s, logo) {
    var n = FIELDS.filter(function (f) { return s.campos[f.k]; }).length;
    return {
      leg: (n === 0 ? 'Nenhum item' : n === 1 ? '1 item' : n + ' itens') + ' · ' + rotulo(CORNERS, s.leg).toLowerCase(),
      apa: rotulo(CORES_OP, s.cor) + ' · ' + rotulo(TAMS_OP, s.tam),
      logo: s.logoOn && logo ? logo + ' · ' + rotulo(CORNERS, s.logo).toLowerCase() : 'Sem logo',
      arq: rotulo(ARQS_OP, s.arq)
    };
  }
  // o grupo g está no padrão? (a logo escolhida, do grupo "logo", é conferida em FotoCarimbo)
  function grupoNoPadrao(s, g) {
    var d = defaults();
    return GRUPOS[g].every(function (k) {
      return k === 'campos' ? FIELDS.every(function (f) { return !!s.campos[f.k] === d.campos[f.k]; }) : s[k] === d[k];
    });
  }
  // texto do padrão no rodapé da folha; `logo`: nome curto da logo padrão
  function padraoTxt(g, logo) {
    var d = defaults();
    if (g === 'leg') {
      var on = FIELDS.filter(function (f) { return f.on; }), off = FIELDS.filter(function (f) { return !f.on; }).map(function (f) { return f.curto || f.label.toLowerCase(); });
      return 'Padrão: ' + rotulo(CORNERS, d.leg).toLowerCase() + ', ' + on.length + ' de ' + FIELDS.length + ' itens' + (off.length ? ' (sem ' + (off.length > 1 ? off.slice(0, -1).join(', ') + ' e ' + off[off.length - 1] : off[0]) + ')' : '');
    }
    if (g === 'apa') return 'Padrão: ' + [rotulo(CORES_OP, d.cor), rotulo(TAMS_OP, d.tam), rotulo(FUNDOS_OP, d.fundo)].join(' · ');
    if (g === 'logo') return 'Padrão: ' + [logo || 'sem logo', rotulo(CORNERS, d.logo).toLowerCase(), d.logoFundo ? 'fundo branco' : 'sem fundo'].join(' · ');
    return 'Padrão: ' + rotulo(ARQS_OP, d.arq);
  }

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
      // data zerada ("0000:00:00 00:00:00", de alguns aplicativos) virava 1899: sem data, vale a do arquivo
      var m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2})/.exec(out.date);
      var ok = m && +m[1] >= 1990 && +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= 31;
      out.date = ok ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null;
      if (out.date && !isFinite(out.date.getTime())) out.date = null;
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
    '  --ft-line-2:#C9D0CC;--ft-soft:var(--accent-soft,#E7EEF7);--ft-ok:#17663A;--ft-ok-bg:#E5F2EA;--ft-off:#8C9690;',
    '  position:fixed;inset:0;z-index:3000;display:flex;flex-direction:column;background:var(--ft-bg);color:var(--ft-ink);font-size:14px;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)}',
    '.ft-head{display:flex;align-items:center;gap:10px;padding:10px 16px;background:var(--ft-panel);border-bottom:1px solid var(--ft-line)}',
    '.ft-head h2{margin:0;font-size:16px;font-weight:650;white-space:nowrap}',
    /* celular: o contrato desce para baixo do título, com até 2 linhas, em vez de sair cortado */
    '@media (max-width:560px){.ft-head{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:10px;row-gap:1px}.ft-head h2{grid-column:1;grid-row:1}.ft-head .ft-ct{grid-column:1;grid-row:2;white-space:normal;overflow:visible;line-height:1.3}.ft-head .ft-x{grid-column:2;grid-row:1 / span 2;min-width:44px;min-height:44px}}',
    '.ft-ct{font-size:12.5px;color:var(--ft-ink-3);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}',
    '.ft-x{border:1px solid var(--ft-line);background:var(--ft-panel);color:var(--ft-ink);border-radius:8px;min-width:40px;min-height:40px;font-size:20px;line-height:1;cursor:pointer}',
    '.ft-body{flex:1;overflow-y:auto;overflow-x:hidden;overscroll-behavior-x:none;padding:16px}',   /* nada arrasta a tela para o lado (iPhone) */
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
    '.ft-prev canvas{display:block;max-width:100%;max-height:calc(100vh - 150px);max-height:calc(100dvh - 150px);width:auto;height:auto}',
    '.ft-side{display:flex;flex-direction:column;gap:12px;min-width:0}',
    '.ft-sec{background:var(--ft-panel);border:1px solid var(--ft-line);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:10px}',
    '.ft-sec h4{margin:0;font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--ft-ink-3)}',
    '.ft-sech{display:flex;align-items:center;justify-content:space-between;gap:8px}',
    '.ft-tag{font-size:11px;font-weight:600;color:var(--ft-ink-2);background:var(--ft-bg);border-radius:10px;padding:2px 8px}',
    '.ft-mini{font-size:11.5px;color:var(--ft-ink-3)}',
    '.ft-mini b{color:var(--ft-ok)}',
    '.ft-src{font-size:12.5px;color:var(--ft-ink-2);line-height:1.45}',
    '.ft-src b{color:var(--ft-ink)}',
    '.ft-warn{color:var(--danger,#B42318);font-weight:600}',
    '.ft-lot{display:flex;flex-direction:column;gap:8px;padding:9px 11px;border:1px solid var(--danger,#B42318);border-left-width:4px;border-radius:8px;background:var(--ft-panel);background:color-mix(in srgb,var(--danger,#B42318) 7%,var(--ft-panel));font-size:13px;line-height:1.45;color:var(--ft-ink)}',
    '.ft-lot b{font-weight:700}',
    '.ft-lot .ft-opts{gap:6px}',
    '.ft-lot .ft-fix{background:var(--ft-accent);border-color:var(--ft-accent);color:var(--ft-accent-ink)}',
    '.ft-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}',
    '.ft-f{display:flex;flex-direction:column;gap:3px;min-width:0}',
    // nome longo do contrato num select ("Conservação 665 · km 642,40 a 743,80 · o km…") não alarga a coluna
    '.ft-f select,.ft-f input,.ft-f textarea{min-width:0;max-width:100%;width:100%;box-sizing:border-box}',
    '.ft-f.full{grid-column:1/-1}',
    '.ft-f span{font-size:11.5px;font-weight:600;color:var(--ft-ink-3)}',
    '.ft input,.ft select,.ft textarea{font:inherit;color:var(--ft-ink);background:var(--ft-panel);border:1px solid var(--ft-line);border-radius:6px;min-height:34px;padding:4px 8px;width:100%;min-width:0}',
    // o campo de arquivo escondido (logo, câmera, galeria): a regra de cima dava a ele width:100% e, preso no canto do botão, ele
    // passava da tela e deixava puxar a página para o lado no iPhone
    '.ft .ft-file{position:absolute;left:0;top:0;width:1px;height:1px;min-width:0;min-height:0;padding:0;border:0;opacity:0;overflow:hidden;pointer-events:none}',
    // data e hora: no iPhone o campo nativo tem largura própria e passava do cartão
    '.ft input[type=datetime-local]{display:block;max-width:100%;-webkit-appearance:none;appearance:none;text-align:left}',
    '.ft textarea{min-height:58px;resize:vertical}',
    '.ft input:focus-visible,.ft select:focus-visible,.ft textarea:focus-visible,.ft button:focus-visible{outline:2px solid var(--ft-accent);outline-offset:1px}',
    // os 10 itens da legenda (folha "Legenda"), com a nota de quando o item não sai nesta foto
    '.ft-checks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}',
    '.ft-checks label{display:flex;align-items:center;gap:8px;min-width:0;min-height:44px;padding:4px 8px;border:1px solid var(--ft-line);border-radius:8px;font-size:12.5px;line-height:1.2;cursor:pointer}',
    '.ft-checks label:has(input:checked){border-color:#B9C7DA}',
    '.ft-checks input{width:20px;height:20px;min-height:0;margin:0;flex:none;accent-color:var(--ft-accent)}',
    '.ft-checks span{display:flex;flex-direction:column;min-width:0;overflow-wrap:anywhere}',
    '.ft-checks small{font-size:10.5px;color:var(--ft-ink-3)}',
    '.ft-chk{display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:600;min-height:32px;cursor:pointer}',
    '.ft-drvsec .ft-chk{min-height:44px}',
    // foto única: "Guardada no app" logo abaixo da foto, o cartão do Drive (interruptor do envio automático) e "Também posso"
    '.ft-drvsec{gap:8px}',
    '.ft-gd{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:10px;background:#E3F3EA;border:1px solid #B9DEC8}',
    '.ft-gd i{flex:none;width:26px;height:26px;border-radius:50%;background:#1E7A47;color:#fff;font-style:normal;font-weight:800;display:flex;align-items:center;justify-content:center}',
    '.ft-gd b{color:#1E7A47}',
    '.ft-gd div div{font-size:12.5px;color:var(--ft-ink-2);line-height:1.4}',
    '.ft-gd.ag{background:var(--ft-bg);border-color:var(--ft-line)}.ft-gd.ag i{background:#9AA39E}.ft-gd.ag b{color:var(--ft-ink-2)}',
    '.ft-gd.er{background:#FCEBE8;border-color:#F3C2BA}.ft-gd.er i{background:var(--danger,#B42318)}.ft-gd.er b{color:var(--danger,#B42318)}',
    '.ft-dv{display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:10px;border:1px solid var(--ft-line)}',
    '.ft-dv>svg{flex:none;width:20px;height:20px;color:var(--ft-accent)}',
    '.ft-dv>div{flex:1;min-width:0}',
    '.ft-dvs{font-size:12px;color:var(--ft-ink-3);line-height:1.4}',
    '.ft-sw{flex:none;position:relative;width:44px;height:26px;cursor:pointer}',
    '.ft-sw input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}',
    '.ft-sw i{position:absolute;inset:0;border-radius:13px;background:#C9CFCB;pointer-events:none;transition:background .15s}',
    '.ft-sw i::after{content:"";position:absolute;left:3px;top:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:left .15s}',
    '.ft-sw input:checked+i{background:var(--ft-accent)}.ft-sw input:checked+i::after{left:21px}',
    '.ft-sw input:focus-visible+i{outline:2px solid var(--ft-accent);outline-offset:2px}',
    '.ft-tb h4{margin:0}',
    '.ft-tbg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}',
    '.ft-tbg .ft-btn{justify-content:center;min-height:46px;text-align:center;white-space:normal;line-height:1.2;padding:6px 10px}',
    '.ft-btn.perigo{color:var(--danger,#B42318)}',
    '.ft-foot .ft-big2{flex:1 1 140px;justify-content:center;min-height:46px}',
    '.ft-big2 svg{width:18px;height:18px}',
    '.ft-chk input{width:20px;height:20px;min-height:0;margin:0;flex:none;accent-color:var(--ft-accent)}',
    '.ft-item .ft-chk{font-weight:500;font-size:13px}',
    '.ft-bdrv{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;font-size:13px}',
    '.ft-opts{display:flex;flex-wrap:wrap;gap:6px}',
    '.ft-opt{border:1px solid var(--ft-line);background:var(--ft-panel);color:var(--ft-ink-2);border-radius:6px;min-height:32px;padding:4px 10px;font:inherit;font-size:12.5px;font-weight:600;cursor:pointer}',
    '.ft-opt[aria-pressed="true"]{background:var(--ft-ink);border-color:var(--ft-ink);color:var(--ft-panel)}',
    '.ft-corners{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;width:100%}',
    '.ft-canto{flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:0;padding:8px 2px;border-radius:12px}',
    '.ft-opt.ft-canto[aria-pressed="true"]{border:2px solid var(--ft-accent);padding:7px 1px;background:var(--ft-soft);color:var(--ft-accent);font-weight:700}',
    '.ft-cmini{position:relative;display:block;width:44px;height:32px;border-radius:4px;background:#C9CFCB}',
    '.ft-cleg{position:absolute;width:18px;height:9px;border-radius:2px;background:#7D8781}',
    '.ft-canto[aria-pressed="true"] .ft-cleg.alvo{background:#F2C230}',
    '.ft-clogo{position:absolute;font-style:normal;font-size:7.5px;line-height:1;font-weight:900;color:#1D4F91}',
    '.ft-canto[aria-pressed="true"] .ft-clogo.alvo{color:#0B3B7A;outline:1.5px solid #F2C230;outline-offset:1px}',
    '.ft-cleg.tl,.ft-clogo.tl{left:3px;top:3px}.ft-cleg.tr,.ft-clogo.tr{right:3px;top:3px}.ft-cleg.bl,.ft-clogo.bl{left:3px;bottom:3px}.ft-cleg.br,.ft-clogo.br{right:3px;bottom:3px}',
    '.ft-cleg.tl+.ft-clogo.tl,.ft-cleg.tr+.ft-clogo.tr{top:14px}.ft-cleg.bl+.ft-clogo.bl,.ft-cleg.br+.ft-clogo.br{bottom:14px}',
    '.ft-ct{font-size:12px;line-height:1.15;text-align:center}',
    '.ft-cnota{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;font-size:12.5px;color:var(--ft-ink-3)}',
    '.ft-clink{border:0;background:none;padding:6px 0;color:var(--ft-accent);font:inherit;font-weight:650}',
    '.ft-troca{min-height:36px}',
    '@media (max-width:820px){.ft[data-fg="leg"] .ft-folha{max-height:76%}}',
    '.ft-logos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}',
    '.ft-logo{display:flex;align-items:center;gap:8px;min-width:0;min-height:48px;padding:4px 8px;border:1px solid var(--ft-line-2);border-radius:8px;background:var(--ft-panel);color:var(--ft-ink);font:inherit;font-size:12.5px;font-weight:600;text-align:left;cursor:pointer}',
    // miniatura de 48 px: com 56, "Consórcio Magna/Enecon" quebrava no meio da palavra a 360 px e no painel da tela larga
    // (o nome só quebra depois da barra, onde renderLogos põe um <wbr>)
    '.ft-logo img{flex:none;display:block;width:48px;height:34px;object-fit:contain;background:repeating-conic-gradient(#D9DDDA 0 25%,#F4F6F4 0 50%) 0 0/10px 10px;border-radius:4px}',
    '.ft-logo span{display:flex;flex-direction:column;gap:1px;min-width:0;line-height:1.2;overflow-wrap:break-word}',
    '.ft-logo small{font-weight:600;color:var(--ft-accent)}',
    '.ft-logo[aria-pressed="true"]{background:var(--ft-soft);border-color:var(--ft-accent);box-shadow:0 0 0 1px var(--ft-accent)}',
    '.ft-lacts{display:flex;flex-wrap:wrap;gap:6px}',
    '.ft-add{position:relative;display:flex;align-items:center;justify-content:center;min-height:44px;border:1px dashed #9AA39E;border-radius:8px;background:var(--ft-panel);color:var(--ft-accent);font-size:13px;font-weight:600;cursor:pointer}',
    '.ft-add:focus-within{outline:2px solid var(--ft-accent);outline-offset:1px}',
    '.ft-amostra{flex:none;width:12px;height:12px;border-radius:50%;border:1px solid var(--ft-off)}',
    // tamanho do arquivo: duas opções grandes (Normal e Full HD)
    '.ft-arqs{display:flex;flex-direction:column;gap:8px}',
    '.ft-arq{display:flex;align-items:center;gap:12px;min-height:56px;padding:8px 12px;border:1px solid var(--ft-line-2);border-radius:10px;background:var(--ft-panel);color:var(--ft-ink);font:inherit;text-align:left;cursor:pointer}',
    '.ft-arq[aria-pressed="true"]{background:var(--ft-soft);border:2px solid var(--ft-accent);padding:7px 11px}',
    '.ft-arq i{flex:none;width:20px;height:20px;box-sizing:border-box;border-radius:50%;border:1.5px solid #9AA39E;background:var(--ft-panel)}',
    '.ft-arq[aria-pressed="true"] i{border:6px solid var(--ft-accent)}',
    '.ft-arq span{display:flex;flex-direction:column;gap:2px;min-width:0}',
    '.ft-arq b{font-size:14px}',
    '.ft-arq small{font-size:11.5px;font-weight:400;color:var(--ft-ink-2)}',
    // fileira dos 4 botões (Legenda, Aparência, Logo, Arquivo) embaixo da prévia: cada um mostra o valor de agora e abre a sua folha
    '.ft-bar{display:flex;flex-direction:column;gap:6px;min-width:0}',
    '.ft-bbs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}',
    '.ft-bb{min-width:0;min-height:52px;padding:6px 2px;border:1px solid var(--ft-line-2);border-radius:10px;background:var(--ft-panel);color:var(--ft-ink);font:inherit;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;text-align:center;cursor:pointer}',
    '.ft-bb[aria-expanded="true"]{background:var(--ft-ink);border-color:var(--ft-ink);color:var(--ft-panel)}',
    '.ft-bbn{display:flex;align-items:center;gap:4px;max-width:100%}',
    '.ft-bbn svg{flex:none;width:13px;height:13px}',
    '.ft-bbn i{flex:none;font-style:normal;font-weight:800;font-size:10px;line-height:1}',
    '.ft-bbn b{font-size:12px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.ft-bbv{font-size:10.5px;line-height:1.2;color:var(--ft-ink-3);max-width:100%;overflow-wrap:anywhere}',
    '.ft-bb[aria-expanded="true"] .ft-bbv{color:var(--ft-line)}',
    '.ft-bb[disabled]{opacity:.55;cursor:progress}',
    '.ft-bnote{margin:0;display:flex;align-items:center;gap:7px;padding:0 2px;font-size:11.5px;line-height:1.35;color:var(--ft-ink-2)}',
    '.ft-bnote i{flex:none;width:9px;height:14px;box-sizing:border-box;border:1.5px solid var(--ft-ok);border-radius:2.5px}',
    '.ft-bnote b{color:var(--ft-ok)}',
    // a folha de opções: sobe de baixo no celular (a prévia continua à vista em cima); na tela larga, painel sobre a coluna do lado
    '.ft-camada{position:absolute;inset:0;z-index:20}',
    '.ft-fundo{position:absolute;inset:0;background:rgba(23,32,28,.32);animation:ft-esmaece .2s ease-out}',
    '.ft-folha{position:absolute;left:0;right:0;bottom:0;max-height:62%;box-sizing:border-box;display:flex;flex-direction:column;background:var(--ft-panel);color:var(--ft-ink);border-radius:16px 16px 0 0;box-shadow:0 -6px 24px rgba(0,0,0,.18);overflow:hidden;' +
      'padding:0 env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);animation:ft-sobe .22s ease-out;outline:none}',
    '.ft-alca{flex:none;align-self:center;width:36px;height:4px;border-radius:2px;background:var(--ft-line-2);margin-top:8px}',
    '.ft-fhead{flex:none;display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:6px 14px 10px}',
    '.ft-ftit{display:flex;flex-direction:column;gap:5px;min-width:0}',
    '.ft-ftit h3{margin:0;font-size:17px;font-weight:700}',
    '.ft-fsalvo{display:flex;flex-wrap:wrap;align-items:center;gap:4px 6px;font-size:11px;color:var(--ft-ink-3)}',
    '.ft-pill{display:inline-flex;align-items:center;gap:5px;font-weight:700;color:var(--ft-ok);background:var(--ft-ok-bg);border-radius:10px;padding:2px 8px}',
    '.ft-pill i{width:7px;height:11px;box-sizing:border-box;border:1.5px solid currentColor;border-radius:2px}',
    '.ft-pill.err{color:var(--danger,#B42318);background:#FCEBE8}',
    '.ft-fbody{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;padding:2px 14px 12px}',
    '.ft-fg{display:flex;flex-direction:column;gap:12px}',
    '.ft-fg>.ft-src{font-size:12px}',
    '.ft-leghint{margin:0;font-size:12px}',
    '.ft-folha .ft-row>span{font-size:12px}',
    '.ft-folha .ft-opts{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:6px}',
    '.ft-folha .ft-opt{display:flex;align-items:center;justify-content:center;gap:6px;min-width:0;min-height:40px;padding:4px;border-color:var(--ft-line-2);border-radius:8px;color:var(--ft-ink);font-size:12.5px;text-align:center}',
    '.ft-folha .ft-opt[aria-pressed="true"]{border-color:var(--ft-ink);color:var(--ft-panel)}',
    '.ft-folha .ft-lacts .ft-opt{padding:4px 12px}',
    '.ft-ffoot{flex:none;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 14px 12px;border-top:1px solid var(--ft-line)}',
    '.ft-fpad{font-size:11.5px;color:var(--ft-ink-3);line-height:1.3;min-width:0}',
    '.ft-facts{flex:none;display:flex;align-items:center;gap:4px}',
    '.ft-desf{min-height:40px;padding:0 12px;border:0;border-radius:8px;background:none;color:var(--ft-accent);font:inherit;font-size:13px;font-weight:700;cursor:pointer}',
    '.ft-voltar{min-height:40px;padding:0 12px;border:1px solid var(--ft-line-2);border-radius:8px;background:var(--ft-panel);color:var(--ft-accent);font:inherit;font-size:13px;font-weight:600;cursor:pointer}',
    '.ft-voltar[aria-disabled="true"]{color:var(--ft-off);border-color:var(--ft-line);cursor:default}',
    '@keyframes ft-sobe{from{transform:translateY(100%)}to{transform:none}}',
    '@keyframes ft-entra{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}',
    '@keyframes ft-esmaece{from{opacity:0}to{opacity:1}}',
    '.ft-row{display:flex;flex-direction:column;gap:5px}',
    '.ft-row>span{font-size:11.5px;font-weight:600;color:var(--ft-ink-3)}',
    '.ft-foot{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;padding:10px 16px;background:var(--ft-panel);border-top:1px solid var(--ft-line)}',
    '.ft-btn{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:6px 16px;border:1px solid var(--ft-line);border-radius:8px;background:var(--ft-panel);color:var(--ft-ink);font:inherit;font-size:14px;font-weight:650;cursor:pointer}',
    '.ft-btn.primary{background:var(--ft-accent);border-color:var(--ft-accent);color:var(--ft-accent-ink)}',
    '.ft-btn[disabled]{opacity:.6;cursor:progress}',
    '.ft-camask{position:fixed;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.55)}',
    '.ft-camask-box{width:100%;max-width:400px;display:flex;flex-direction:column;gap:8px;padding:20px 18px 14px;border-radius:18px;background:var(--ft-panel);color:var(--ft-ink);box-shadow:0 10px 30px rgba(0,0,0,.4)}',
    '.ft-camask-box b{font-size:19px}',
    '.ft-camask-box p{margin:0 0 8px;font-size:14.5px;line-height:1.4;color:var(--ft-ink-2)}',
    '.ft-camask-box .ft-btn{justify-content:center;min-height:46px;font-size:15px}',
    '.ft-askdel{border:0;background:none;min-height:40px;color:var(--danger,#B42318);font:inherit;font-size:14px;font-weight:650}',
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
    '.ft-batch .ft-thumb img{cursor:zoom-in}',
    '.ft-batch.ft-gerando .ft-blist .ft-item input,.ft-batch.ft-gerando .ft-blist .ft-item select,.ft-batch.ft-gerando .ft-blist .ft-item textarea{pointer-events:none;opacity:.6}',
    // foto do lote aberta em tela cheia (tocar na prévia): passar o dedo troca de foto, puxar para baixo fecha (gestos.js)
    '.ft-ver{position:absolute;inset:0;z-index:60;display:flex;flex-direction:column;background:#0E1311;color:#fff}',
    '.ft-ver-top{display:flex;align-items:center;gap:8px;padding:calc(10px + env(safe-area-inset-top,0px)) calc(12px + env(safe-area-inset-right,0px)) 10px calc(12px + env(safe-area-inset-left,0px))}',
    '.ft-ver-top .ft-verc{flex:1;text-align:center;font-size:13px;color:#C9D0CC;font-variant-numeric:tabular-nums}',
    '.ft-ver-top button{min-height:38px;padding:0 12px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);color:#fff;font:inherit;font-size:14px;cursor:pointer}',
    '.ft-ver-top button[disabled]{opacity:.35}',
    '.ft-ver-img{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:0 8px;touch-action:none;overflow:hidden}',
    '.ft-ver-img img{max-width:100%;max-height:100%;object-fit:contain;-webkit-user-drag:none;user-select:none;-webkit-user-select:none}',
    '.ft-ver-info{padding:10px 16px calc(14px + env(safe-area-inset-bottom,0px));font-size:13px;line-height:1.5;color:#E4E8E5}',
    '.ft-ver-info b{color:#fff}',
    '.ft-ifields{display:flex;flex-direction:column;gap:8px;min-width:0}',
    '.ft-ihead{display:flex;align-items:center;justify-content:space-between;gap:8px}',
    '.ft-iname{font-weight:650;font-size:13px;overflow-wrap:anywhere;min-width:0}',
    '.ft-prog{margin-right:auto;align-self:center;font-size:13px;color:var(--ft-ink-2);font-variant-numeric:tabular-nums}',
    '.ft-faixa{flex:1 1 100%;min-width:0}',
    '.ft-faixa .ft-fx-env{width:100%;justify-content:center;min-height:44px;border:1.5px solid var(--ft-accent);background:var(--ft-soft);color:var(--ft-accent);font-size:15px;font-weight:700}',
    '.ft-fx{display:flex;align-items:center;gap:8px;min-height:44px;padding:0 6px 0 12px;box-sizing:border-box;border-radius:10px;border:1px solid;font-size:14px}',
    '.ft-fx>span{font-weight:800}',
    '.ft-fx b{flex:1;min-width:0;font-weight:650;color:var(--ft-ink)}',
    '.ft-fx i{font-style:normal;font-size:12.5px;font-weight:750;padding-right:6px;font-variant-numeric:tabular-nums}',
    '.ft-fx.fila{background:#FFF4DC;border-color:#E8C77A;color:#9A5B00}',
    '.ft-fx.ok{background:#E3F3EA;border-color:#B9DEC8;color:#1E7A47}',
    '.ft-fx.alt{background:var(--ft-soft);border-color:var(--ft-accent);color:var(--ft-accent)}',
    '.ft-fx.alt button{border:0;border-radius:8px;min-height:36px;padding:0 12px;background:var(--ft-accent);color:var(--ft-accent-ink);font:inherit;font-weight:700}',
    '.ft-foot .ft-salvar{flex:1 1 100%;justify-content:center;min-height:48px}',
    '.ft-foot .ft-meio{flex:1 1 0;justify-content:center;min-height:46px}',
    '@media (min-width:900px){.ft-foot .ft-salvar{flex:2 1 0}.ft-faixa{flex-basis:100%}}',
    '.ft-prog:not(:empty)+.ft-dstat{flex-basis:100%;order:-1}',
    '.ft-src small{display:block;margin-top:4px;color:var(--ft-ink-3);font-variant-numeric:tabular-nums}',
    '.ft-note a{color:var(--ft-accent);font-weight:600}',
    // câmera dentro do app
    '.ft.camming{background:#000}',
    '.ft.camming .ft-head{display:none}',
    '.ft.camming .ft-body{padding:0;overflow:hidden;background:#000}',
    '.ft-cam{height:100%;display:flex;flex-direction:column;background:#000;color:#fff}',
    '.ft-camview{position:relative;flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden}',
    '.ft-camview video{display:block;width:100%;height:100%;object-fit:contain;background:#000}',
    '.ft-camgps{position:absolute;left:10px;right:10px;top:10px;z-index:2;display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:13px;line-height:1.35;font-variant-numeric:tabular-nums}',
    '.ft-camgl{padding:6px 10px;border-radius:999px;background:rgba(0,0,0,.6)}',
    '.ft-camgl i{display:inline-block;width:8px;height:8px;border-radius:50%;background:#3BD16F;margin-right:6px}',
    '.ft-camlot{border:0;border-radius:999px;padding:6px 10px;background:rgba(154,91,0,.9);color:#fff;font:inherit;font-size:12.5px}',
    '.ft-camlotx{flex:1 1 100%;padding:7px 10px;border-radius:8px;background:rgba(0,0,0,.7);color:#FFB4A8}',
    // prévia: o recorte da foto e o carimbo como vão sair, por cima da imagem
    '.ft-camov{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1}',
    '.ft-camfoot{display:flex;flex-direction:column}',
    '.ft-camopt{display:flex;justify-content:center;gap:8px;padding:10px 12px 0}',
    '.ft-campill{border:0;border-radius:999px;padding:8px 14px;background:rgba(255,255,255,.16);color:#fff;font:inherit;font-size:13px;font-weight:650;white-space:nowrap}',
    '.ft-campill.on{background:#FFE81A;color:#17201C}',
    '.ft-campop{position:absolute;left:12px;right:12px;bottom:110px;z-index:5;display:flex;flex-direction:column;gap:8px;padding:14px;border-radius:14px;background:#fff;color:#17201C;box-shadow:0 8px 30px rgba(0,0,0,.45);max-width:420px;margin:0 auto}',
    '.ft-campop[hidden]{display:none}',
    '.ft-camop{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:10px 12px;border-radius:10px;border:1px solid #D5DAD6;background:#fff;color:#17201C;font:inherit;text-align:left}',
    '.ft-camop[aria-pressed="true"]{border-color:#1D4F91;background:#E7EEF7}',
    '.ft-camop small,.ft-camnota{color:#5C6661;font-size:12px;line-height:1.35}',
    '.ft-camgps b{color:#FFE81A}',
    '.ft-camgps .ft-warn{color:#FFB4A8}',
    // aviso do limite de fotos da câmera (MAX_FOTOS), embaixo da imagem
    '.ft-camlim{position:absolute;left:10px;right:10px;bottom:10px;padding:8px 11px;border-radius:8px;background:rgba(150,24,16,.9);font-size:14px;font-weight:650;line-height:1.4}',
    '.ft-flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;transition:opacity .25s}',
    '.ft-flash.on{opacity:.7;transition:none}',
    '.ft-flash.segura{opacity:1;background:transparent;transition:none;display:flex;align-items:center;justify-content:center}',
    '.ft-flash.segura::after{content:"Segure firme\\2026";padding:9px 16px;border-radius:999px;background:rgba(0,0,0,.65);color:#fff;font-size:16px;font-weight:700}',
    '.ft-camctl{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;padding:14px 16px}',
    '.ft-camb{justify-self:start;display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:6px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.4);background:transparent;color:#fff;font:inherit;font-size:14px;font-weight:650;cursor:pointer}',
    '.ft-camdone{justify-self:end}',
    '.ft-camb[disabled]{opacity:.45;cursor:default}',
    '.ft-camlast{width:40px;height:40px;border-radius:6px;overflow:hidden;background:#333;flex:none}',
    '.ft-camlast img{width:100%;height:100%;object-fit:cover;display:block}',
    '.ft-shot{width:74px;height:74px;border-radius:50%;border:4px solid #fff;background:rgba(255,255,255,.2);cursor:pointer;padding:0}',
    '.ft-shot:active{background:#fff}',
    '.ft-shot[disabled]{opacity:.5}',
    // celular deitado: a imagem com toda a altura, o GPS pequeno no canto dela e os botões numa coluna do lado de baixo
    // do celular (como a câmera do celular); virando para o outro lado (.ft-cw), os botões trocam de lado.
    // --ar é a proporção da câmera (vem do vídeo), para a área da imagem ter o tamanho exato dela
    '@media (orientation:landscape) and (max-height:560px){' +
      '.ft-cam{flex-direction:row}' +
      '.ft-cam.ft-cw{flex-direction:row-reverse}' +
      '.ft-camview{flex:0 1 auto;height:100%;aspect-ratio:var(--ar,4/3);min-width:0;margin:0 auto}' +
      '.ft-camgps{left:50%;right:auto;top:6px;transform:translateX(-50%);justify-content:center;width:max-content;max-width:min(56%,360px);font-size:11px}' +
      '.ft-camctl{flex:1;grid-template-columns:none;grid-template-rows:1fr auto 1fr;justify-items:center;gap:8px;padding:8px 10px}' +
      '.ft-camfoot{height:100%}' +
      '.ft-camopt{flex-direction:column;align-items:center;padding:8px 8px 0}' +
      '.ft-campill{padding:6px 10px;font-size:12px}' +
      '.ft-campop{bottom:auto;top:10px}' +
      '.ft-camb{align-self:start;justify-self:center;flex-direction:column;gap:4px;max-width:96px;padding:6px 8px;font-size:13px;text-align:center}' +
      '.ft-camdone{align-self:end}' +
      '.ft-camlast{width:34px;height:34px}' +
      '.ft-shot{width:64px;height:64px}' +
    '}',
    '@media (max-width:820px){.ft-work,.ft-batch{grid-template-columns:minmax(0,1fr)}.ft-prev{position:static}.ft-prev canvas{max-height:58vh}.ft-body{padding:12px}}',
    '@media (max-width:560px){.ft-item{grid-template-columns:minmax(0,1fr)}.ft-thumb img{max-height:52vh}}',
    // celular: no lote de fotos, os 4 botões ficam no alto (antes das fotos); com a folha aberta, a prévia encolhe para caber
    // em cima dela (--ft-livre vem de ajustaFolha)
    '@media (max-width:820px){' +
      '.ft-bside{order:-1}' +
      '.ft.folha .ft-prev canvas{max-height:var(--ft-livre,40vh)}' +
      '.ft.folha .ft-thumb{min-height:0}' +
      '.ft.folha .ft-thumb img{max-height:var(--ft-livre,40vh)}' +
    '}',
    // tela larga: a folha vira um painel sobre a coluna do lado (ajustaFolha acerta a posição), sem cobrir a prévia
    '@media (min-width:821px){' +
      '.ft-fundo{background:rgba(23,32,28,.12)}' +
      '.ft-folha{left:auto;right:16px;bottom:auto;top:72px;width:340px;max-height:calc(100% - 160px);border-radius:12px;box-shadow:0 10px 32px rgba(0,0,0,.22);padding:0;animation-name:ft-entra}' +
      '.ft-alca{display:none}' +
      '.ft-fhead{padding-top:14px}' +
    '}',
    // celular deitado (pouca altura): a folha de baixo cobria a legenda da foto; ela fica do lado direito, com toda a altura,
    // e a prévia (ou a primeira foto do lote) ocupa o resto da largura. ajustaFolha põe a classe e acerta --ft-lado e --ft-livre
    '.ft.folha-lado .ft-fundo{background:rgba(23,32,28,.12)}',
    '.ft.folha-lado .ft-folha{left:auto;top:0;right:0;bottom:0;width:min(400px,52%);max-height:none;border-radius:16px 0 0 16px;box-shadow:-6px 0 24px rgba(0,0,0,.18);' +
      'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) 0;animation-name:ft-lado}',
    '.ft.folha-lado .ft-alca{display:none}',
    '.ft.folha-lado .ft-fhead{padding-top:12px}',
    '.ft.folha-lado .ft-body{padding-right:calc(var(--ft-lado,52%) + 12px - env(safe-area-inset-right,0px))}',
    '@keyframes ft-lado{from{transform:translateX(100%)}to{transform:none}}',
    // tela muito estreita (320 px): os 4 nomes sem os ícones
    '@media (max-width:349px){.ft-bbn svg,.ft-bbn i{display:none}}',
    '@media (prefers-reduced-motion:reduce){.ft-folha,.ft-fundo,.ft.folha-lado .ft-folha{animation:none}}'
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
  // ícones dos 4 botões de opções
  var ICONE = {
    leg: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 2h12M1 7h8M1 12h12"/></svg>',
    apa: '<i aria-hidden="true">Aa</i>',
    logo: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="0.75" y="1.75" width="12.5" height="10.5" rx="2"/><rect x="2.75" y="3.75" width="4" height="3" fill="currentColor"/></svg>',
    arq: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="2.25" y="0.75" width="9.5" height="12.5" rx="2"/><path d="M4.5 4.5h5M4.5 8h5"/></svg>'
  };

  // nomes do contrato: o app.js passa os seus em opts.nomes. Esta cópia curta, com a mesma regra, vale na página online,
  // que embute este arquivo sem o app.js: nome de tela pelo tipo e número ("Pontos Críticos 314"), nome formal com o Lote
  // da licitação e o nº do CT, pasta do Drive pelo número ("CT 02 00314-2026") e a pasta usada até a versão 51 (o Lote)
  function nomesPadrao() {
    // sinal: a conservação com rotuloTipo 'sinal' (709) tem o nome "Sinalização" (por baixo, conservação)
    var PAL = { pc: 'Pontos Críticos', conserva: 'Conservação', oae: 'Proarte', sinal: 'Sinalização' };
    function lp(v) { return v == null ? '' : String(v).trim().replace(/\s+/g, ' '); }
    function tipo(c) { return c && c.tipo === 'oae' ? 'oae' : c && c.tipo === 'conserva' ? 'conserva' : 'pc'; }
    function numeroCurto(c) { var m = /(\d{3,})\s*\/\s*\d{4}/.exec(lp(c && c.numero)); return m ? String(Number(m[1])) : ''; }
    function nome(c) { if (!c) return ''; var n = numeroCurto(c), w = PAL[c.rotuloTipo === 'sinal' && tipo(c) === 'conserva' ? 'sinal' : tipo(c)]; return n ? w + ' ' + n : lp(c.lote) || w; }
    function loteReal(c) { var l = lp(c && c.lote); return /^lote\b/i.test(l) ? l : ''; }
    function numeroCT(c) { var n = lp(c && c.numero); return n ? 'CT ' + n : ''; }
    function formal(c) { return c ? [loteReal(c), numeroCT(c)].filter(Boolean).join(' · ') || nome(c) : ''; }
    function completo(c) { var out = []; [nome(c), loteReal(c), numeroCT(c)].forEach(function (x) { if (x && out.indexOf(x) < 0) out.push(x); }); return out.join(' · '); }
    // sem número e sem Lote, o id entra no nome (dois contratos novos não dividem a pasta)
    function pasta(c) { if (!c) return ''; var n = lp(c.numero); return n ? 'CT ' + n.replace(/\s*\/\s*/g, '-') : lp(c.lote) || nome(c) + (c.id ? ' (' + c.id + ')' : ''); }
    // as pastas que existiam até a versão 51, pelo nº (não dependem do Lote de hoje); dos outros, o Lote ou "CT nº", letra por letra
    var ANTES = { '0200314/2026': 'Lote 01', '0200315/2026': 'Lote 02', '0200424/2024': 'CT 424 · OAEs' };
    function pastaAntes(c) { var k = lp(c && c.numero).replace(/\s+/g, ''); return Object.prototype.hasOwnProperty.call(ANTES, k) ? ANTES[k] : ''; }
    function pastaAntiga(c) { return c ? pastaAntes(c) || String(c.lote || (c.numero ? 'CT ' + c.numero : '') || 'Contrato') : 'Sem lote'; }
    return { tipo: tipo, numeroCurto: numeroCurto, nome: nome, loteReal: loteReal, numeroCT: numeroCT, formal: formal, completo: completo,
      pasta: pasta, pastaAntiga: pastaAntiga, pastaAntes: pastaAntes };
  }

  function FotoCarimbo(opts) {
    var snv = opts.snv, Ref = window.MapaSNV && window.MapaSNV.Ref;
    if (!snv || !Ref) return null;
    injectStyle();
    var ref = Ref(snv), set = loadSet(), notify = opts.notify || function () {}, nomes = opts.nomes || nomesPadrao();
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
    // nome de tela do contrato ("Pontos Críticos 314"); o Lote da licitação fica no carimbo e no texto do Drive
    function lotName(c) { return c ? nomes.nome(c) || 'Contrato' : ''; }
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
    // pontos críticos: a foto só é do contrato até 1 km de algum ponto (o 267 vai do km 613,50 ao 744,98 com 3 pontos; no meio
    // ficam a Proarte e a conservação). Sem ponto com km, vale o trecho do contrato (decidido em 22/10/2026)
    var PC_RAIO = 1;
    function pcMaisPerto(c, km) {
      var best = null;
      (c.pontos || []).forEach(function (p) {
        if (p.kmIni == null) return;
        var a = Math.min(p.kmIni, p.kmFim != null ? p.kmFim : p.kmIni), b = Math.max(p.kmIni, p.kmFim != null ? p.kmFim : p.kmIni);
        var d = km < a ? a - km : km > b ? km - b : 0;
        if (!best || d < best.d) best = { p: p, d: d };
      });
      return best;
    }
    function pcLonge(c, km) { if (!c || c.tipo === 'oae' || c.tipo === 'conserva' || km == null) return null; var m = pcMaisPerto(c, km); return m && m.d > PC_RAIO ? m : null; }
    function lotsAt(km) {
      return contratosNoKm(contracts(), km, function (c) { return sameRoad(c) ? lotRange(c) : null; }).filter(function (c) { return !pcLonge(c, km); });
    }
    // "A, B e C"
    function lotNames(list) {
      var n = list.map(function (c) { return lotName(c); });
      return n.length > 1 ? n.slice(0, -1).join(', ') + ' e ' + n[n.length - 1] : n.join('');
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
              // legenda, aparência, logo e arquivo: valem para a foto única e para o lote de fotos (moveShared leva para o lugar certo)
              '<div class="ft-shared ft-bar"><div class="ft-bbs" role="group" aria-label="Opções do carimbo">' +
                ['leg', 'apa', 'logo', 'arq'].map(function (g) {
                  return '<button type="button" class="ft-bb" data-folha="' + g + '" aria-haspopup="dialog" aria-expanded="false" aria-controls="ftFolha">' +
                    '<span class="ft-bbn">' + ICONE[g] + '<b>' + GRUPO_NOME[g] + '</b></span><span class="ft-bbv"></span></button>';
                }).join('') +
                '</div><p class="ft-bnote"><i aria-hidden="true"></i><span></span></p></div>' +
              '<section class="ft-sec"><div class="ft-sech"><h4>Local</h4><span class="ft-tag">Desta foto</span></div><div class="ft-lot" role="status" hidden></div><div class="ft-src"></div>' +
                '<div class="ft-opts ft-here" hidden><button type="button" class="ft-opt" data-ft="here">Usar o GPS do aparelho agora</button></div>' +
                '<div class="ft-grid">' +
                  '<label class="ft-f full" id="ftLoteWrap"><span>Contrato da foto</span><select id="ftLote"></select></label>' +
                  '<label class="ft-f"><span>km</span><input id="ftKm" inputmode="decimal" autocomplete="off"></label>' +
                  '<label class="ft-f"><span>Ponto</span><select id="ftPonto"></select></label>' +
                  '<label class="ft-f"><span>Lado</span><select id="ftLado"><option value="">Eixo / não informar</option><option value="LE">LE · lado esquerdo</option><option value="LD">LD · lado direito</option></select></label>' +
                  '<label class="ft-f"><span>Distância do eixo (m)</span><input id="ftDl" inputmode="numeric" autocomplete="off"></label>' +
                  '<label class="ft-f full"><span>Data e hora</span><input id="ftData" type="datetime-local"></label>' +
                  '<label class="ft-f full"><span>Descrição</span><textarea id="ftDesc" maxlength="240" placeholder="Ex.: lançamento de enrocamento no bueiro"></textarea></label>' +
                '</div>' +
              '</section>' +
              '<section class="ft-sec ft-drvsec" hidden>' +
                '<div class="ft-gd ag" role="status"><i aria-hidden="true">✓</i><div><b class="ft-gdt">Guardando no app…</b><div class="ft-gds"></div></div></div>' +
                '<div class="ft-dv">' + NUVEM + '<div><b>Drive da equipe</b><div class="ft-dvs"></div></div>' +
                  '<label class="ft-sw"><input type="checkbox" id="ftDrive" role="switch" aria-label="Enviar ao Drive automaticamente"><i></i></label></div>' +
                '<div class="ft-mini">Envio automático: vale para as próximas fotos · <b>salvo neste aparelho</b></div></section>' +
              '<section class="ft-sec ft-tb"><h4>Também posso</h4><div class="ft-tbg">' +
                '<button type="button" class="ft-btn" data-ft="save">' + (celular() ? 'Salvar na galeria do celular' : 'Baixar a foto') + '</button>' +
                (opts.share ? '<button type="button" class="ft-btn" data-ft="share">Compartilhar</button>' : '') +
                '<button type="button" class="ft-btn" data-ft="editar">Editar carimbo</button>' +
                '<button type="button" class="ft-btn perigo" data-ft="descartar">Descartar</button></div></section>' +
            '</div>' +
          '</div>' +
          '<div class="ft-batch" hidden>' +
            '<div class="ft-bmain">' +
              '<section class="ft-sec ft-bsum"><h4 class="ft-bcount">Fotos</h4><div class="ft-src ft-bstat"></div><div class="ft-lot ft-blot" role="status" hidden></div>' +
                '<label class="ft-f"><span>Descrição de todas as fotos</span><textarea id="ftBDesc" maxlength="240" placeholder="Ex.: lançamento de enrocamento no bueiro"></textarea></label>' +
                '<div class="ft-src">Cada foto também pode ter a própria descrição; se ficar em branco, vale esta.</div>' +
                '<div class="ft-bdrv" hidden><span class="ft-bdrvn"></span><span class="ft-opts"><button type="button" class="ft-opt" data-ft="b-drv-all">Marcar todas</button>' +
                  '<button type="button" class="ft-opt" data-ft="b-drv-none">Nenhuma</button></span></div>' +
              '</section>' +
              '<div class="ft-blist"></div>' +
            '</div>' +
            '<div class="ft-side ft-bside"></div>' +
          '</div>' +
          '<div class="ft-cam" hidden>' +
            '<div class="ft-camview"><video playsinline muted autoplay aria-label="Prévia da câmera"></video><canvas class="ft-camov" aria-hidden="true"></canvas><div class="ft-camgps" role="status"></div><div class="ft-camlim" role="alert" hidden></div><div class="ft-flash"></div></div>' +
            '<div class="ft-camfoot">' +
            '<div class="ft-camopt"><button type="button" class="ft-campill on" data-ft="cam-giro" aria-haspopup="true"></button><button type="button" class="ft-campill" data-ft="cam-car" aria-haspopup="true">Carimbo \u25be</button></div>' +
            '<div class="ft-campop" data-pop="giro" hidden><b>Como a foto sai</b>' +
              CAM_GIROS.map(function (x) { return '<button type="button" class="ft-camop" data-ft="cam-giro-v" data-v="' + x[0] + '"><b>' + x[1] + '</b><small>' + x[2] + '</small></button>'; }).join('') +
              '<small class="ft-camnota">No iPhone, o app pede uma vez para usar o movimento do celular: é assim que ele sabe se o celular está deitado, mesmo com a rotação da tela travada.</small></div>' +
            '<div class="ft-campop" data-pop="car" hidden><b>Carimbo</b>' +
              ['leg', 'apa', 'logo', 'arq'].map(function (g) { return '<button type="button" class="ft-camop" data-ft="cam-car-g" data-v="' + g + '"><b>' + GRUPO_NOME[g] + '</b></button>'; }).join('') + '</div>' +
            '<div class="ft-camctl">' +
              '<button type="button" class="ft-camb" data-ft="cam-cancel">Fechar</button>' +
              '<button type="button" class="ft-shot" data-ft="cam-shot" aria-label="Fotografar"></button>' +
              '<button type="button" class="ft-camb ft-camdone" data-ft="cam-done" disabled><span class="ft-camlast" hidden></span><span class="ft-camn">Concluir</span></button>' +
            '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="ft-foot" hidden><span class="ft-prog ft-many" role="status"></span><div class="ft-faixa ft-many" role="status" hidden></div>' +
          (opts.abrirGaleria ? '<button type="button" class="ft-btn ft-one ft-big2" data-ft="ver-gal">Ver na galeria</button>' : '') +
          '<button type="button" class="ft-btn primary ft-many ft-salvar" data-ft="b-save">Salvar todas (.zip)</button>' +
          (opts.share ? '<button type="button" class="ft-btn ft-many ft-meio" data-ft="b-share">Compartilhar todas</button>' : '') +
          '<button type="button" class="ft-btn ft-many ft-meio" data-ft="new">+ Nova seleção</button>' +
          '<button type="button" class="ft-btn primary ft-one ft-big2" data-ft="new">' + CAM + 'Tirar outra</button></div>' +
        // folha de opções: um grupo por vez (o do botão tocado)
        '<div class="ft-camada" hidden><div class="ft-fundo" data-ft="folha-fecha" aria-hidden="true"></div>' +
          '<div class="ft-folha" id="ftFolha" role="dialog" aria-modal="true" aria-labelledby="ftFolhaT" tabindex="-1">' +
            '<i class="ft-alca" aria-hidden="true"></i>' +
            '<div class="ft-fhead"><div class="ft-ftit"><h3 id="ftFolhaT"></h3>' +
                '<span class="ft-fsalvo"><span class="ft-pill" role="status"><i aria-hidden="true"></i><span class="ft-salvo"></span></span><span class="ft-svale"></span></span></div>' +
              '<button type="button" class="ft-btn primary" data-ft="folha-fecha">Pronto</button></div>' +
            '<div class="ft-fbody">' +
              '<div class="ft-fg" data-g="leg"><div class="ft-row"><span>Canto da legenda</span><div class="ft-corners" data-group="leg"></div><div class="ft-cnota"></div></div>' +
                '<div class="ft-row"><span>O que aparece</span><p class="ft-src ft-leghint"></p></div><div class="ft-checks">' +
                FIELDS.map(function (f) { return '<label><input type="checkbox" id="ftC-' + f.k + '" data-campo="' + f.k + '"><span>' + f.label + '<small data-nota="' + f.k + '" hidden></small></span></label>'; }).join('') +
              '</div></div>' +
              '<div class="ft-fg" data-g="apa">' +
                '<div class="ft-row"><span>Cor do texto</span><div class="ft-opts" data-group="cor"></div></div>' +
                '<div class="ft-row"><span>Tamanho</span><div class="ft-opts" data-group="tam"></div></div>' +
                '<div class="ft-row"><span>Fundo do texto</span><div class="ft-opts" data-group="fundo"></div></div></div>' +
              '<div class="ft-fg" data-g="logo">' +
                '<div class="ft-row"><span>Logo</span><div class="ft-opts" data-group="logoOn"></div></div>' +
                '<div class="ft-row ft-sologo"><span>Canto da logo</span><div class="ft-corners" data-group="logo"></div></div>' +
                '<div class="ft-row"><span>Qual logo</span><div class="ft-logos" role="group" aria-label="Logos disponíveis"></div>' +
                  '<label class="ft-add">+ Adicionar logo (PNG ou JPG)<input class="ft-file" type="file" id="ftLogoFile" accept="image/png,image/jpeg,image/webp"></label>' +
                  '<div class="ft-lacts"><button type="button" class="ft-opt" data-ft="logo-team" hidden>Usar como padrão da equipe</button>' +
                  '<button type="button" class="ft-opt" data-ft="logo-team-off" hidden>Tirar padrão da equipe</button>' +
                  '<button type="button" class="ft-opt" data-ft="logo-del" hidden>Remover esta logo</button></div>' +
                  '<div class="ft-src ft-logo-src"></div></div>' +
                '<div class="ft-row ft-sologo"><span>Fundo da logo</span><div class="ft-opts" data-group="logoFundo"></div></div></div>' +
              '<div class="ft-fg" data-g="arq"><div class="ft-arqs" role="group" aria-label="Tamanho do arquivo" data-group="arq"></div>' +
                '<p class="ft-src">Vale para Salvar, Compartilhar e Enviar ao Drive.</p></div>' +
            '</div>' +
            '<div class="ft-ffoot"><span class="ft-fpad"></span><span class="ft-facts">' +
              '<button type="button" class="ft-desf" data-ft="folha-desfaz" hidden>Desfazer</button>' +
              '<button type="button" class="ft-voltar" data-ft="folha-padrao" aria-disabled="false">Voltar ao padrão</button></span></div>' +
          '</div></div>';
      root.addEventListener('click', onClick);
      root.addEventListener('input', onInput);
      root.addEventListener('change', onChange);
      root.addEventListener('keydown', function (e) {
        if (q('.ft-ver')) {
          if (e.key === 'Escape') fechaLoteVer(); else if (e.key === 'ArrowLeft') passaLoteVer(-1); else if (e.key === 'ArrowRight') passaLoteVer(1);
          return;
        }
        if (folha) { teclaFolha(e); return; }
        if (e.key === 'Escape' && q('.ft-camask')) { camAskFim('ask-voltar'); return; }
        if (e.key === 'Escape' && cam && cam.shots.length) { camAsk(); return; }
        if (e.key === 'Escape') { if (st && !batch) sair(); close(); }
      });
    }

    // os 4 cantos com um desenho da foto: o bloco da legenda (amarelo, quando marcado) e a logo no canto dela
    function cantos(name) {
      var el = q('[data-group="' + name + '"]'), cur = currentLogo();
      el.innerHTML = CORNERS.map(function (c) {
        var on = set[name] === c[0], lg = name === 'leg' ? (set.logoOn && cur ? set.logo : '') : c[0], lgd = name === 'logo' ? set.leg : c[0];
        return '<button type="button" class="ft-opt ft-canto" data-set="' + name + '" data-val="' + c[0] + '" aria-pressed="' + on + '">' +
          '<span class="ft-cmini" aria-hidden="true"><i class="ft-cleg ' + lgd + (name === 'leg' ? ' alvo' : '') + '"></i>' + (lg ? '<i class="ft-clogo ' + lg + (name === 'logo' ? ' alvo' : '') + '">DNIT</i>' : '') + '</span>' +
          '<span class="ft-ct">' + c[1] + '</span></button>';
      }).join('');
    }
    var legAntes = '';   // o canto da legenda antes do último toque (para "Trocar com a logo")
    function renderOpts() {
      // os botões são refeitos: o foco (teclado) volta para o botão equivalente
      var a = document.activeElement, foco = '', naFolha = !!folha && (a === document.body || q('.ft-folha').contains(a));
      if (a && root.contains(a) && a.dataset) foco = a.dataset.set ? '[data-set="' + a.dataset.set + '"][data-val="' + a.dataset.val + '"]' : a.dataset.logo != null ? '[data-logo="' + a.dataset.logo + '"]' : '';
      function group(name, items) {
        var el = q('[data-group="' + name + '"]');
        el.innerHTML = items.map(function (it) {
          return '<button type="button" class="ft-opt" data-set="' + name + '" data-val="' + it[0] + '" aria-pressed="' + (String(set[name]) === String(it[0])) + '">' + (it[2] || '') + it[1] + '</button>';
        }).join('');
      }
      group('logoOn', [['true', 'Mostrar'], ['false', 'Sem logo']]);
      group('logoFundo', [['true', 'Branco'], ['false', 'Sem fundo']]);
      renderLogos();
      cantos('logo');
      cantos('leg');
      var cur = currentLogo(), mesmo = set.logoOn && cur && set.logo === set.leg, cn = q('.ft-cnota');
      cn.innerHTML = (set.logoOn && cur ? 'A logo está ' + esc(rotulo(CORNERS, set.logo).toLowerCase()) + ' <button type="button" class="ft-clink" data-ft="ir-logo">(muda em Logo)</button>'
        : 'Sem logo nas fotos <button type="button" class="ft-clink" data-ft="ir-logo">(muda em Logo)</button>') +
        (mesmo ? '<button type="button" class="ft-opt ft-troca" data-ft="trocar-logo">Trocar com a logo</button>' : '');
      group('cor', CORES_OP.map(function (c) { return [c[0], c[1], '<i class="ft-amostra" style="background:' + COLORS[c[0]] + '" aria-hidden="true"></i>']; }));
      group('tam', TAMS_OP);
      group('fundo', FUNDOS_OP);
      q('[data-group="arq"]').innerHTML = ARQS_OP.map(function (o) {
        return '<button type="button" class="ft-arq" data-set="arq" data-val="' + o[0] + '" aria-pressed="' + (set.arq === o[0]) + '"><i aria-hidden="true"></i><span><b>' + o[1] + '</b><small>' + o[2] + '</small></span></button>';
      }).join('');
      root.querySelectorAll('.ft-sologo').forEach(function (r) { r.hidden = !set.logoOn; });
      FIELDS.forEach(function (f) {
        q('#ftC-' + f.k).checked = !!set.campos[f.k];
        var n = notaCampo(f.k), el = q('[data-nota="' + f.k + '"]');
        el.textContent = n;
        el.hidden = !n;
      });
      renderBar();
      renderFolha();
      if (foco) { var novo = q(foco); if (novo && novo !== a && novo.offsetParent) novo.focus(); }
      if (naFolha) seguraFoco();
    }
    // o botão com o foco sumiu com a própria ação ("Remover esta logo", "Usar como padrão da equipe", "Tirar padrão da equipe"):
    // o foco ia para o body, fora da folha, e o Esc e o Tab deixavam de valer. Vai para a logo marcada (do lado desses botões),
    // senão para a primeira opção marcada do grupo, senão para a folha
    function seguraFoco() {
      var p = q('.ft-folha'), at = document.activeElement;
      if (at === p || (at && p.contains(at) && at.getClientRects().length)) return;
      var alvo = q('.ft-fg:not([hidden]) .ft-logo[aria-pressed="true"]') || q('.ft-fg:not([hidden]) [aria-pressed="true"]');
      (alvo && alvo.getClientRects().length ? alvo : p).focus({ preventScroll: true });
    }
    // por que um item marcado não sai nesta foto (só na foto única; no lote, cada foto tem o seu caso)
    function notaCampo(k) {
      if (k === 'lado' && !set.campos.rodkm) return 'só sai com Rodovia e km';
      if (!st || batch) return '';
      var c = contract();
      if (k === 'lado' && !st.side) return 'sem lado nesta foto';
      if (k === 'coord' && !st.ll && st.km == null) return 'sem local nesta foto';
      if (k === 'ponto' && !findPoint(st.pid)) return semPontos() ? 'conservação: sem ponto' : 'nenhum ponto nesta foto';
      if (k === 'desc' && !(st.desc || '').trim()) return 'vazia nesta foto';
      if (k === 'executora' && !(c && c.executora)) return 'o contrato não tem';
      if (k === 'supervisora' && !(c && c.supervisora)) return 'o contrato não tem';
      return '';
    }
    // o valor de agora em cada um dos 4 botões
    function renderBar() {
      var cur = currentLogo(), v = resumos(set, cur ? logoCurto(cur) : '');
      root.querySelectorAll('[data-folha]').forEach(function (b) {
        var g = b.dataset.folha;
        b.querySelector('.ft-bbv').textContent = v[g];
        b.setAttribute('aria-label', GRUPO_NOME[g] + ': ' + v[g]);
      });
      q('.ft-bnote span').innerHTML = batch ? 'Legenda, aparência, logo e arquivo valem para todas as fotos e ficam <b>salvos neste aparelho</b>.'
        : 'Legenda, aparência, logo e arquivo ficam <b>salvos neste aparelho</b>.';
    }

    // ---------------- folhas de opções: cada botão abre a sua, com só aquele grupo; a prévia redesenha a cada toque
    var folha = null;   // { g, btn, antes (para o Desfazer), mudou, ok (guardou no aparelho), rolagem }
    function abreFolha(g, btn) {
      if (folha) fechaFolha(true);
      folha = { g: g, btn: btn, antes: null, mudou: false, ok: saveSet(set), rolagem: q('.ft-body').scrollTop };
      root.setAttribute('data-fg', g); legAntes = '';
      q('#ftFolhaT').textContent = GRUPO_TITULO[g];
      q('.ft-leghint').textContent = batch ? 'Marque o que vai escrito nas fotos. As prévias já mostram a mudança.' : 'Marque o que vai escrito na foto. A prévia já mostra a mudança.';
      root.querySelectorAll('.ft-fg').forEach(function (el) { el.hidden = el.dataset.g !== g; });
      ['.ft-head', '.ft-body', '.ft-foot'].forEach(function (s) { q(s).setAttribute('inert', ''); });
      q('.ft-camada').hidden = false;
      root.classList.add('folha');
      btn.setAttribute('aria-expanded', 'true');
      renderOpts();
      q('.ft-fbody').scrollTop = 0;
      ajustaFolha(true);
      window.addEventListener('resize', onResizeFolha);
      document.addEventListener('keydown', teclaFora, true);
      q('.ft-folha').focus();
    }
    function fechaFolha(semFoco) {
      if (!folha || !root) return;
      var f = folha;
      folha = null;
      window.removeEventListener('resize', onResizeFolha);
      document.removeEventListener('keydown', teclaFora, true);
      q('.ft-camada').hidden = true;
      root.classList.remove('folha', 'folha-lado');
      root.style.removeProperty('--ft-livre');
      root.style.removeProperty('--ft-lado');
      ['.ft-head', '.ft-body', '.ft-foot'].forEach(function (s) { q(s).removeAttribute('inert'); });
      f.btn.setAttribute('aria-expanded', 'false');
      q('.ft-body').scrollTop = f.rolagem;
      if (!semFoco && f.btn.offsetParent) f.btn.focus({ preventScroll: true });
    }
    function onResizeFolha() { ajustaFolha(false); }
    // tela larga: o painel fica sobre a coluna do lado, entre o cabeçalho e o rodapé (com pouca altura, do alto até o fim do rodapé).
    // Celular em pé: a folha sobe de baixo e a prévia (ou a primeira foto do lote) encolhe para caber em cima dela.
    // Celular deitado (pouca altura): a folha fica do lado direito e a prévia, no resto da largura, com a altura do corpo.
    // `rolar` leva a prévia ao alto (na tela larga, só quando ela não está toda à vista)
    function ajustaFolha(rolar) {
      if (!folha) return;
      var p = q('.ft-folha'), r = root.getBoundingClientRect(), h = q('.ft-head').getBoundingClientRect(), ft = q('.ft-foot'), body = q('.ft-body');
      var larga = midia('(min-width: 821px)'), lado = !larga && midia('(orientation: landscape) and (max-height: 560px)'), modo = larga ? 'larga' : lado ? 'lado' : 'baixo';
      root.classList.toggle('folha-lado', lado);
      if (folha.modo !== modo) { folha.modo = modo; rolar = true; }   // virou o celular: leva a prévia de novo para a vista
      if (larga) {
        // pouca altura (celular grande deitado, 896x414): o painel vai do alto até o fim do rodapé (os dois ficam inertes com a folha
        // aberta), senão a lista da folha ficava com pouco mais de 100 px
        var baixa = midia('(max-height: 560px)'), side = (batch ? q('.ft-bside') : q('.ft-work .ft-side')).getBoundingClientRect();
        var fim = ft.hidden ? r.bottom : ft.getBoundingClientRect()[baixa ? 'bottom' : 'top'], topo = baixa ? 8 : h.bottom - r.top + 12;
        if (side.width) { p.style.left = Math.round(side.left - r.left) + 'px'; p.style.width = Math.round(Math.min(420, side.width)) + 'px'; }
        p.style.top = Math.round(topo) + 'px';
        p.style.maxHeight = Math.max(240, Math.round(fim - r.top - topo - 12)) + 'px';
        root.style.removeProperty('--ft-livre');
        root.style.removeProperty('--ft-lado');
      } else {
        p.style.left = p.style.width = p.style.top = p.style.maxHeight = '';
        if (lado) {
          root.style.setProperty('--ft-lado', p.offsetWidth + 'px');
          root.style.setProperty('--ft-livre', Math.max(120, body.clientHeight - 24) + 'px');
        } else {
          root.style.removeProperty('--ft-lado');
          // offsetTop: a posição sem a animação de subida (getBoundingClientRect pega a folha ainda lá embaixo)
          root.style.setProperty('--ft-livre', Math.max(120, Math.round(p.offsetTop - (h.bottom - r.top) - 24)) + 'px');
        }
      }
      if (!rolar) return;
      var alvo = batch ? q('.ft-item:not(.err) .ft-thumb') : q('.ft-prev');
      if (!alvo) return;
      var ar = alvo.getBoundingClientRect(), br = body.getBoundingClientRect();
      if (larga && ar.top >= br.top && ar.bottom <= br.bottom) return;   // tela larga: só rola se a foto não estiver toda à vista
      body.scrollTop += ar.top - br.top - 12;
    }
    function midia(m) { return !!(window.matchMedia && window.matchMedia(m).matches); }
    // tecla com o foco fora da tela da foto (no body, depois que o botão com o foco sumiu): Esc e Tab continuam presos à folha
    function teclaFora(e) { if (folha && root && !root.contains(e.target)) teclaFolha(e); }
    // Esc fecha só a folha; Tab não sai dela
    function teclaFolha(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fechaFolha(); return; }
      if (e.key !== 'Tab') return;
      var l = Array.prototype.filter.call(q('.ft-folha').querySelectorAll('button,input,select,textarea,[tabindex]:not([tabindex="-1"])'), function (el) {
        return !el.disabled && el.offsetParent !== null;
      });
      if (!l.length) { e.preventDefault(); return; }
      var i = l.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); l[l.length - 1].focus(); }
      else if (!e.shiftKey && (i < 0 || i === l.length - 1)) { e.preventDefault(); l[0].focus(); }
    }
    // a logo padrão: a do DNIT, a mesma que o bloco de DNIT_KEY marca uma vez em cada aparelho (sem ela, a primeira da lista)
    function logoPadrao() {
      var lib = library(), d = null;
      lib.forEach(function (l) { if (l.id === 'dnit') d = l; });
      return d || lib[0] || null;
    }
    function folhaNoPadrao(g) {
      if (!grupoNoPadrao(set, g)) return false;
      if (g !== 'logo') return true;
      var cur = currentLogo(), lp = logoPadrao();
      return (cur ? cur.id : '') === (lp ? lp.id : '');
    }
    function renderFolha() {
      if (!folha) return;
      var g = folha.g, np = folhaNoPadrao(g), lp = logoPadrao();
      q('.ft-pill').classList.toggle('err', !folha.ok);
      q('.ft-salvo').textContent = !folha.ok ? 'Não deu para salvar neste aparelho' : folha.mudou ? 'Salvo agora neste aparelho' : 'Salvo neste aparelho';
      q('.ft-svale').textContent = folha.ok ? 'vale para as próximas fotos' : 'vale só nesta visita';
      q('.ft-fpad').textContent = np ? 'Já está no padrão.' : padraoTxt(g, lp ? logoCurto(lp) : '');
      q('[data-ft="folha-padrao"]').setAttribute('aria-disabled', String(np));
      q('[data-ft="folha-desfaz"]').hidden = !folha.antes;
      ajustaFolha(false);
    }
    // toda mudança de opção passa por aqui: guarda no aparelho e some o Desfazer
    function guarda(ok) {
      ok = saveSet(set) && ok !== false;
      if (folha) { folha.mudou = true; folha.antes = null; folha.ok = ok; }
      return ok;
    }
    function grupoAgora(g) {
      var o = {};
      GRUPOS[g].forEach(function (k) { o[k] = k === 'campos' ? Object.assign({}, set.campos) : set[k]; });
      if (g === 'logo') o.selId = selId;
      return o;
    }
    // aplica um grupo guardado (padrão ou Desfazer); `antes` fica para o Desfazer
    function poeGrupo(o, antes) {
      var ok = true;
      Object.keys(o).forEach(function (k) { if (k !== 'selId') set[k] = k === 'campos' ? Object.assign({}, o[k]) : o[k]; });
      if (own(o, 'selId')) { selId = o.selId; ok = lsSet(LOGO_SEL_KEY, selId); refreshLogo(); }
      guarda(ok);
      folha.antes = antes;
      renderOpts();
      scheduleDraw(0);
    }
    function padraoFolha() {
      if (!folha || folhaNoPadrao(folha.g)) return;
      var g = folha.g, d = defaults(), o = {};
      GRUPOS[g].forEach(function (k) { o[k] = d[k]; });
      if (g === 'logo') { var lp = logoPadrao(); o.selId = lp ? lp.id : ''; }
      poeGrupo(o, grupoAgora(g));
    }
    function desfazFolha() {
      if (!folha || !folha.antes) return;
      poeGrupo(folha.antes, null);
      q('[data-ft="folha-padrao"]').focus();
    }

    function startView() {
      fechaFolha(true);
      if (cam && cam.shots.length) avisoCapturas(cam.shots.length);
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
        h = esc('"Câmera com GPS" tira várias fotos seguidas sem sair do app: o km, o ponto e o contrato de cada foto vêm do GPS do celular na hora do clique. ' +
          (and ? 'É o jeito mais seguro no Android, que costuma apagar o local das fotos escolhidas na galeria ou nos arquivos. ' : '') +
          'Para fotos já tiradas, use "Arquivos do celular" (uma ou várias): o km sai da localização gravada em cada foto.');
      } else {
        h = esc((opts.gps
          ? 'O km sai do GPS do aparelho na hora da foto ou da localização gravada na foto. '
          : 'Neste link o navegador não informa a localização do aparelho: o km sai da localização gravada na foto. Deixe a câmera do celular salvando o local. ') +
          'Em "Arquivos do celular" dá para marcar várias fotos de uma vez: cada uma recebe o km, o ponto e o contrato do próprio GPS.');
        // página online: no Android o sistema apaga o local das fotos; o app (site) tem a câmera com GPS
        if (and && opts.appUrl) h += ' <b>No Android</b>, o sistema costuma apagar o local das fotos entregues ao navegador. Para não depender disso, use o app ' +
          '<a href="' + esc(opts.appUrl) + '" target="_blank" rel="noopener">' + esc(opts.appUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')) + '</a> e o botão "Câmera com GPS", que usa o GPS do celular na hora da foto.';
      }
      q('.ft-note').innerHTML = h + ' Se faltar o local, você digita o km ou escolhe o ponto.';
      renderGps();
    }
    // os 4 botões de opções (legenda, aparência, logo, arquivo) valem para a foto única e para o lote de fotos: ficam no alto da coluna do lado
    function moveShared(target) { root.querySelectorAll('.ft-shared').forEach(function (s) { target.insertBefore(s, target.firstChild); }); }
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
      return ' · <span class="ft-warn">' + (here.length === 1 ? 'este km é do contrato ' + esc(lotName(here[0])) : 'este km está nos contratos ' + esc(lotNames(here))) + '</span>';
    }
    function renderHead() {
      var c = contract();
      if (batch) {   // lote de fotos: os lotes/contratos em uso
        var seen = {}, names = [];
        readyItems().forEach(function (it) { var x = byId(it.cid); if (x && !seen[x.id]) { seen[x.id] = 1; names.push(lotName(x)); } });
        q('.ft-ct').textContent = [rodovia()].concat(names.length ? [names.join(', ')] : []).join(' · ');
        return;
      }
      q('.ft-ct').textContent = c ? [lotName(c), nomes.numeroCT(c), rodovia()].filter(Boolean).join(' · ') : rodovia();
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
        lastFixErr = e && e.code === 1 ? bloqueado('A localização') + ' ou informe o km depois.' : 'Sem sinal de GPS no momento.';
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
      // foto da Câmera com GPS: o mesmo id do rascunho guardado no clique, para a versão com carimbo entrar no lugar dele
      st = { img: img, url: url, w: img.naturalWidth, h: img.naturalHeight, desc: '', uid: (ex && ex.uid) || newUid(), drive: ex && ex.enviar ? true : padraoDrive() };
      place(st, ex, file, from);
      showWork();
    }
    // posição, data, lote e ponto de uma foto (a única ou cada uma do lote de fotos)
    function place(o, ex, file, from) {
      var ac = activeContract();
      o.ll = null; o.km = null; o.side = ''; o.dist = null; o.acc = null; o.src = 'manual'; o.pid = ''; o.cid = ac ? ac.id : '';
      // foto guardada que volta para o carimbo (Galeria › sem carimbo): fica no contrato e no ponto que já tinha
      if (ex.cid && byId(ex.cid)) o.cid = ex.cid;
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
        o.pid = pertoPonto(auto) ? auto.p.id : (opts.initialPoint || '');
        if (ex.cid && ex.cid === o.cid && ex.pid && findPoint(ex.pid)) o.pid = ex.pid;
        if (!o.ll && o.pid) { var p0 = findPoint(o.pid); if (p0) o.km = p0.kmIni; }
      });
    }
    // as funções de desenho e de texto leem `st`: no lote, cada foto passa por aqui
    function withItem(it, fn) { var old = st; st = it; try { return fn(); } finally { st = old; } }
    // pontos do contrato que a foto pode ter; a conservação fica "sem ponto" até o passo 2.5 (os segmentos não entram na foto)
    function pontosDe(c) { return !c || c.tipo === 'conserva' ? [] : c.pontos || []; }
    function findPoint(id) { var c = contract(); return c && id ? pontosDe(c).find(function (p) { return p.id === id; }) || null : null; }
    function identify(km) {
      var c = contract(), best = null;
      if (!c || km == null) return null;
      pontosDe(c).forEach(function (p) {
        if (p.kmIni == null) return;
        var a = p.kmIni, b = p.kmFim != null ? p.kmFim : p.kmIni, d = km < a ? a - km : km > b ? km - b : 0;
        if (!best || d < best.d) best = { p: p, d: d, c: c };
      });
      return best;
    }
    // até onde o km da foto escolhe o ponto sozinho: 150 m para cada lado da ponte (Proarte), 50 m nos outros
    function raioPonto(c) { return c && c.tipo === 'oae' ? 0.15 : 0.05; }
    function pertoPonto(a) { return !!a && a.d <= raioPonto(a.c); }

    function showWork() {
      root.classList.remove('many');
      moveShared(q('.ft-work .ft-side'));
      var side = q('.ft-work .ft-side'), dv = q('.ft-drvsec');
      if (dv && side.firstChild !== dv) side.insertBefore(dv, side.firstChild);
      renderGuarda();
      q('.ft-start').hidden = true;
      q('.ft-batch').hidden = true;
      q('.ft-work').hidden = false;
      q('.ft-foot').hidden = false;
      q('#ftKm').value = st.km != null ? nf(st.km, 2) : '';
      q('#ftLado').value = st.side || '';
      q('#ftDl').value = st.dist != null ? String(st.dist) : '';
      q('#ftData').value = dateInput(st.date);
      q('#ftDesc').value = st.desc;
      q('#ftDrive').checked = st.drive !== false;
      renderHead();
      renderPontos();
      renderSrc();
      renderOpts();
      scheduleDraw(0);
    }
    // conservação: só contrato e km; o campo Ponto some (os segmentos são divisão nossa)
    function semPontos() { var c = contract(); return !!c && c.tipo === 'conserva'; }
    function renderPontos() { var sp = q('#ftPonto'); sp.innerHTML = pontoOptions(); sp.closest('label').hidden = semPontos(); }
    function pontoOptions() {
      var c = contract(), list = c ? pontosDe(c).filter(function (p) { return p.kmIni != null; }).slice() : [];
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
          if (e && e.code === 1) lastFixErr = bloqueado('A localização') + '.';
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
      withItem(o, function () { var auto = o.km != null ? identify(o.km) : null; if (pertoPonto(auto)) o.pid = auto.p.id; });
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
        var r = raioPonto(contract());
        if (st.km < p.kmIni - r || st.km > b + r) h += ' <span class="ft-warn">O km está fora do ' + esc(p.nome) + ' (km ' + nf(p.kmIni, 2) + ' a ' + nf(b, 2) + ').</span>';
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
          // um km no trecho de mais de um contrato: todos aparecem, cada um com o seu botão (quem corrige escolhe o serviço)
          h = '<div>O km <b>' + nf(st.km, 2) + '</b> fica ' + (here.length === 1 ? 'no contrato <b>' + esc(lotName(here[0])) + '</b> (' + esc(rangeTxt(here[0])) + ')'
              : 'no trecho de ' + here.length + ' contratos (' + here.map(function (c) { return '<b>' + esc(lotName(c)) + '</b>' + (rangeTxt(c) ? ': ' + esc(rangeTxt(c)) : ''); }).join('; ') + ')') +
            (pcLonge(cur, st.km) ? ', longe dos pontos do ' + esc(lotName(cur)) + ' (o mais perto é o ' + esc(pcLonge(cur, st.km).p.nome || 'ponto') + ', a ' + nf(pcLonge(cur, st.km).d, 1) + ' km)'
              : ', não no ' + esc(lotName(cur)) + (rangeTxt(cur) ? ' (' + esc(rangeTxt(cur)) + ')' : '')) + '. A legenda e o ponto estão usando o contrato errado.' +
            (here.length > 1 ? ' Escolha o do serviço fotografado.' : '') + '</div><div class="ft-opts">' +
            here.map(function (c) {
              var a = pointNear(c, st.km);
              return '<button type="button" class="ft-opt ft-fix" data-ft="fix-lot" data-cid="' + esc(c.id) + '"' + di + '>Corrigir para ' + esc(lotName(c)) + (a ? ' · ' + esc(a.nome) : '') + '</button>';
            }).join('') +
            '<button type="button" class="ft-opt" data-ft="keep-lot"' + di + '>Manter ' + esc(lotName(cur)) + '</button></div>';
          if (st.keepLot === cur.id + '@' + nf(st.km, 2)) h = '';
        } else if (pcLonge(cur, st.km)) {
          var lg = pcLonge(cur, st.km);
          h = '<div>O km <b>' + nf(st.km, 2) + '</b> fica longe dos pontos do ' + esc(lotName(cur)) + ' (o mais perto é o ' + esc(lg.p.nome || 'ponto') + ', a ' +
            (lg.d < 10 ? nf(lg.d, 1) : nf(lg.d, 0)) + ' km) e de nenhum outro contrato cadastrado. Confira o km.</div>';
        } else if (lotRange(cur)) {
          h = '<div>O km <b>' + nf(st.km, 2) + '</b> está fora do trecho de todos os contratos cadastrados (' +
            list.filter(function (c) { return lotRange(c); }).map(function (c) { return esc(lotName(c)) + ': ' + esc(rangeTxt(c)); }).join('; ') +
            '). Confira o km.</div>';
        }
      }
      return h;
    }
    // ponto do lote c que fica no km (até 50 m)
    function pointNear(c, km) {
      var best = null;
      pontosDe(c).forEach(function (p) {
        if (p.kmIni == null) return;
        var a = p.kmIni, b = p.kmFim != null ? p.kmFim : p.kmIni, d = km < a ? a - km : km > b ? km - b : 0;
        if (d <= raioPonto(c) && (!best || d < best.d)) best = { p: p, d: d };
      });
      return best ? best.p : null;
    }
    function applyLot(id, why) {
      var c = byId(id);
      if (!c || !st) return;
      st.cid = c.id;
      st.keepLot = '';
      var auto = st.km != null ? identify(st.km) : null;
      st.pid = pertoPonto(auto) ? auto.p.id : '';
      renderHead(); renderPontos(); renderSrc(); scheduleDraw(0);
      if (opts.setActiveContract) opts.setActiveContract(c.id);
      var p = findPoint(st.pid);
      notify('Foto no contrato ' + lotName(c) + (p ? ' · ponto ' + p.nome : '') + '.');
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
      carimbo(g, W, H);
    }
    // o carimbo (logo e legenda) de `st` num quadro W x H: na foto pronta e na prévia da câmera
    function carimbo(g, W, H) {
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
      if (st && !batch) { st.ver = (st.ver || 0) + 1; agendaGuarda(); }
      if (batch) mudou();
      clearTimeout(drawTimer);
      drawTimer = setTimeout(function () {
        if (batch) { batch.items.forEach(function (it, i) { if (it.img && !it.gone) queueDraw(i); }); return; }
        if (st) draw(q('.ft-prev canvas'), 1600);
      }, ms == null ? 90 : ms);
    }

    // ---------------- guardar no app (galeria › No aparelho) sem a pessoa apertar nada
    // A foto entra no aparelho como "só aqui" logo que abre e a cada mudança (1,5 s depois da última); vai para a fila do Drive
    // (se o envio automático estiver ligado) só ao sair dela: Tirar outra, Ver na galeria ou fechar. Assim o Drive recebe uma
    // vez, já com o carimbo final. Fechado à força no meio, a foto continua no aparelho e dá para enviar pela galeria.
    var guardaT = null, guardaP = Promise.resolve();
    function agendaGuarda() { if (!opts.drive) return; clearTimeout(guardaT); guardaT = setTimeout(function () { guardaT = null; guardarFoto(false); }, st && st.feita == null ? 400 : 1500); }
    // o app foi para o fundo (outra tela, celular travado): guarda já a última mudança
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && guardaT) guardarFoto(false); });
    function guardarFoto(final) {
      var a = st;
      clearTimeout(guardaT); guardaT = null;
      if (!a || !opts.drive || a.descartada) return guardaP;
      var como = final && a.drive !== false ? 'fila' : 'aparelho';
      if (a.como === 'fila' || (a.feita === a.ver && (a.como === como || !final))) return guardaP;
      var ver = a.ver;
      a.guardando = true; renderGuarda();
      guardaP = guardaP.then(function () {
        if (a.descartada) return;
        return withItem(a, function () { var nome = fileName(); return makeBlob().then(function (b) { return { b: b, nome: nome }; }); }).then(function (r) {
          if (a.descartada) return;
          if (!r.b) throw new Error('blob');
          var item = driveItem(a, r.b, r.nome);
          item.enviar = como === 'fila';
          // guardada no meio da edição: se o app fechar antes de sair da foto, ela vai para a fila ao abrir de novo (app.js)
          if (!final) item.meta = Object.assign({}, item.meta, { rascunho: 1, querEnviar: a.drive !== false });
          return opts.drive.add([item]).then(function () {
            a.feita = ver; a.como = como; a.erroG = false; a.guardando = false;
            if (como === 'fila') refreshDrive();
          });
        });
      }).then(null, function () { a.erroG = true; a.guardando = false; }).then(function () { if (st === a) renderGuarda(); });
      return guardaP;
    }
    function renderGuarda() {
      if (!root) return;
      var g = q('.ft-gd'), dv = q('.ft-dvs');
      if (!g || !st) return;
      var er = !!st.erroG, ok = st.feita != null && !st.guardando;
      g.className = 'ft-gd' + (er ? ' er' : ok ? '' : ' ag');
      g.querySelector('i').textContent = er ? '!' : '✓';
      q('.ft-gdt').textContent = er ? 'Não deu para guardar no app' : ok ? 'Guardada no app' : 'Guardando no app…';
      q('.ft-gds').textContent = er ? 'O aparelho está sem espaço ou não deixou guardar. Use "Salvar na galeria do celular".'
        : 'Fica em Galeria › No aparelho. Não precisa apertar nada para não perder.';
      if (dv) {
        var on = st.drive !== false;
        dv.textContent = !driveOn() ? 'O envio ao Drive começa depois que você entrar com o seu código; a foto espera guardada no app.'
          : on ? 'Vai para o Drive quando você tocar em Tirar outra, Ver na galeria ou fechar. Dá para mudar o carimbo até lá.'
          : 'Fica só neste aparelho. Dá para enviar depois em Galeria › No aparelho.';
      }
    }
    // tocar duas vezes: a primeira só pergunta (no botão)
    var descT = null;
    function descartar(b) {
      if (!st) return;
      if (!b.classList.contains('conf')) {
        b.classList.add('conf'); b.textContent = 'Tocar de novo para descartar';
        clearTimeout(descT); descT = setTimeout(function () { b.classList.remove('conf'); b.textContent = 'Descartar'; }, 4000);
        return;
      }
      clearTimeout(descT);
      b.classList.remove('conf'); b.textContent = 'Descartar';
      var a = st, ja = a.feita != null;
      a.descartada = true;
      clearTimeout(guardaT); guardaT = null;
      guardaP.then(function () { return ja && opts.drive && opts.drive.apagar ? opts.drive.apagar([a.uid]) : null; }).then(function () { notify('Foto descartada.'); refreshDrive(); }, function () { notify('Não foi possível tirar a foto do aparelho.'); });
      startView();
    }
    function sair(depois) {
      var a = st;
      guardarFoto(true).then(function () {
        if (a && a.erroG && !a.descartada) notify('Não consegui guardar a última mudança da foto no app (sem espaço?). Em Galeria › No aparelho ficou a versão anterior.', 8000);
        if (depois) depois();
      });
    }

    // ---------------- salvar
    function arq() { return own(ARQS, set.arq) ? ARQS[set.arq] : ARQS.tela; }
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
        var a = arq();
        try { draw(cv, a[0]); } catch (e) { cv.width = cv.height = 0; resolve(null); return; }
        // a imagem grande sai da memória logo depois (no iPhone o navegador demora a liberar sozinho)
        cv.toBlob(function (b) { cv.width = cv.height = 0; resolve(b); }, 'image/jpeg', a[1]);
      });
    }
    function busy(on) { root.querySelectorAll('[data-ft="save"],[data-ft="share"],[data-ft="drive"]').forEach(function (b) { b.disabled = on; }); }
    function save() {
      if (!st) return;
      busy(true);
      makeBlob().then(function (blob) {
        if (!blob) { notify('Não foi possível gerar a foto. Tente com uma imagem menor.'); return; }
        if (!opts.drive) toDrive([driveItem(st, blob, fileName())], true);
        return opts.saveBlob(fileName(), blob);
      }).then(function () { busy(false); }, function () { busy(false); });
    }
    function share() {
      if (!st) return;
      busy(true);
      makeBlob().then(function (blob) {
        if (!opts.drive) toDrive([driveItem(st, blob, fileName())], true);
        var f = new File([blob], fileName(), { type: 'image/jpeg' });
        if (navigator.canShare && navigator.canShare({ files: [f] })) return navigator.share({ files: [f], title: fileName() });
        notify('Este navegador não compartilha arquivos. Use "' + (celular() ? 'Salvar na galeria do celular' : 'Baixar a foto') + '".');
      }).catch(function () { /* compartilhamento cancelado */ }).then(function () { busy(false); });
    }

    // ---------------- Google Drive da equipe: toda foto salva, compartilhada ou enviada vai para "CT nº / Ponto"
    // (pasta pelo número do contrato, "CT 02 00314-2026"; pastaAntiga = a do Lote, que o script renomeia no primeiro envio)
    function newUid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
    function driveOn() { return !!(opts.drive && opts.drive.ready()); }
    function driveItem(it, blob, name) {
      return withItem(it, function () {
        var c = contract(), p = findPoint(st.pid), ll = st.ll || (st.km != null ? ref.at(st.km) : null);
        var desc = (st.desc || '').trim() || (st.bi != null && batch ? batch.common.trim() : '');
        // nome de tela e nome formal, sempre com o nº do CT: a importação do Drive acha o contrato pelo número
        var info = [
          c ? nomes.nome(c) : '',
          c && nomes.formal(c) !== nomes.nome(c) ? nomes.formal(c) : '',
          p ? 'Ponto ' + p.nome : semPontos() ? '' : 'Sem ponto',
          st.km != null ? kmLine(st.km, st.side, st.dist, true) : '',
          ll ? coordTxt(ll) : '',
          st.date ? dateTxt(st.date) : '',
          desc
        ].filter(Boolean).join('\n');
        var d = st.date && isFinite(st.date.getTime()) ? st.date : null;
        // dados para as galerias do app (banco)
        var meta = { cid: c ? c.id : null, pid: p ? p.id : null, pnome: p ? p.nome || null : null, lote: c ? nomes.formal(c) : null,
          km: st.km != null ? Math.round(st.km * 1000) / 1000 : null, lat: ll ? ll[0] : null, lng: ll ? ll[1] : null,
          em: d ? d.toISOString() : null, desc: desc || null };
        return { id: st.uid || newUid(), nome: name, blob: blob, pastas: [(c && nomes.pasta(c)) || 'Sem lote', p ? p.nome || 'Ponto sem nome' : 'Sem ponto'],
          pastaAntiga: nomes.pastaAntiga(c), descricao: info, meta: meta, enviar: st.drive !== false };
      });
    }
    // a foto fica guardada no aparelho (galeria do app) mesmo sem o Drive configurado; o envio espera
    function toDrive(list, auto) {
      if (!opts.drive || !list.length) return;
      var b0 = batch, mud0 = batch && batch.mud;
      opts.drive.add(list).then(function () {
        if (batch) {
          var ids = list.map(function (x) { return x.id; }), vai = list.filter(function (x) { return x.enviar !== false; }).map(function (x) { return x.id; });
          batch.items.forEach(function (it) {
            if (ids.indexOf(it.uid) < 0) return;
            it.salva = true;
            it.filaDrive = vai.indexOf(it.uid) >= 0;
            if (batch.sit) delete batch.sit[it.uid];   // a versão nova ainda não chegou: nada de "No Drive" da anterior
          });
          if (vai.length && batch === b0) batch.envMud = mud0;
        }
        var nd = list.filter(function (x) { return x.enviar !== false; }).length, na = list.length - nd;
        if (!auto) notify(((nd ? (nd === 1 ? 'Foto na fila' : nd + ' fotos na fila') + ' para o Drive da equipe.' : '') +
          (na ? ' ' + (na === 1 ? '1 ficou' : na + ' ficaram') + ' só neste aparelho.' : '')).trim());
        else if (na && !nd) notify(na === 1 ? 'Foto guardada só neste aparelho (não vai para o Drive).' : na + ' fotos guardadas só neste aparelho (não vão para o Drive).');
        refreshDrive();
      }, function () { notify('Não foi possível guardar a foto para o Drive neste aparelho.'); });
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
      var ds = q('.ft-drvsec');
      if (ds) ds.hidden = !opts.drive;
      renderFaixa(); lerSituacoes();
      renderGuarda();
    }

    // ---------------- várias fotos de uma vez (Arquivos do celular): cada uma com o km, o ponto e o lote do próprio GPS
    // Só a miniatura (1000 px) fica na memória; a foto inteira é aberta de novo na hora de salvar.
    var MAX_FOTOS = 80, batch = null, drawQ = [], drawing = false, prevCv = null, descTimer = null;
    // `presets`: dados de cada foto da "Câmera com GPS", na mesma ordem
    function onFiles(list, from, presets) {
      var files = Array.prototype.slice.call(list || []);
      if (files.length <= 1) { onFile(files[0], from, presets && presets[0]); return; }
      startMsg('');
      // só os arquivos do celular são cortados (eles continuam lá para abrir depois); a câmera do app já trava em MAX_FOTOS,
      // e as fotos dela só existem na memória: nenhuma pode ficar de fora
      var extra = from === 'camapp' ? 0 : files.length - MAX_FOTOS;
      if (extra > 0) files = files.slice(0, MAX_FOTOS);
      clearBatch();
      var b = batch = { common: '', ver: 0, mud: 0, envMud: 0, sit: null, out: null, busy: false, items: files.map(function (f, i) {
        return { file: f, name: f.name || 'Foto ' + (i + 1), from: from, bi: i, desc: '', wait: true, preset: presets ? presets[i] : null, uid: (presets && presets[i] && presets[i].uid) || newUid(), drive: presets && presets[i] && presets[i].enviar ? true : padraoDrive() };
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
      avisoCapturas(batch.items.filter(function (it) { return it.from === 'camapp' && !it.salva && !it.err; }).length);
      batch.items.forEach(function (it) { if (it.url) URL.revokeObjectURL(it.url); if (it.prevUrl) URL.revokeObjectURL(it.prevUrl); });
      batch = null;
      drawQ = [];
      if (root) { q('.ft-blist').innerHTML = ''; q('.ft-prog').textContent = ''; travaOpcoes(false); }   // "Nova seleção" no meio da geração
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
      el.innerHTML = '<div class="ft-thumb"><span>Gerando prévia…</span><img alt="Foto ' + (i + 1) + ' com o carimbo" data-ft="lv-abre" data-lv="' + i + '" hidden></div>' +
        '<div class="ft-ifields">' + head + '<div class="ft-src"></div>' +
          '<div class="ft-opts ft-here" hidden><button type="button" class="ft-opt" data-ft="b-here"' + d + '>Usar o GPS do aparelho agora</button></div>' +
          '<div class="ft-lot" role="status" hidden></div>' +
          '<div class="ft-grid">' +
            (contracts().length > 1 ? '<label class="ft-f full"><span>Contrato</span><select data-b="lote"' + d + '></select></label>' : '') +
            '<label class="ft-f"><span>km</span><input data-b="km"' + d + ' inputmode="decimal" autocomplete="off"></label>' +
            '<label class="ft-f"><span>Ponto</span><select data-b="ponto"' + d + '></select></label>' +
            '<label class="ft-f full"><span>Descrição desta foto</span><input data-b="desc"' + d + ' maxlength="240" autocomplete="off"></label>' +
          '</div>' + (opts.drive ? '<label class="ft-chk"><input type="checkbox" data-b="drive"' + d + (it.drive !== false ? ' checked' : '') + '> Enviar ao Drive</label>' : '') + '</div>';
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
        var bp = el.querySelector('[data-b="ponto"]');
        bp.innerHTML = pontoOptions();
        bp.closest('label').hidden = semPontos();
        if (ls) ls.innerHTML = loteOptions();
      });
      var c = batch.common.trim();
      el.querySelector('[data-b="desc"]').placeholder = c ? 'Igual à de todas: ' + c : 'Ex.: vista geral do bueiro';
    }
    function liveItems() { return batch ? batch.items.filter(function (it) { return !it.gone; }) : []; }
    function readyItems() { return liveItems().filter(function (it) { return !it.wait && !it.err; }); }
    // fotos cujo km fica em outro lote (e que ninguém mandou manter): a lista de todos os contratos que têm o km (null: está certa)
    function wrongLot(it) {
      if (it.km == null) return null;
      return withItem(it, function () {
        var cur = contract(), here = lotsAt(it.km);
        if (!cur || !here.length || has(here, cur) || it.keepLot === cur.id + '@' + nf(it.km, 2)) return null;
        return here;
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
      // "Corrigir pelo km" muda sozinho só as fotos com um único contrato possível; nas outras (o km está no trecho de mais de um),
      // a escolha aparece antes de gravar: aqui, para todas elas, ou em cada foto
      var wrong = 0, um = 0, varios = 0, opc = {}, ordem = [], box = q('.ft-blot');
      ok.forEach(function (it) {
        var w = wrongLot(it);
        if (!w) return;
        wrong++;
        if (w.length === 1) { um++; return; }
        varios++;
        w.forEach(function (c) { if (!opc[c.id]) { opc[c.id] = { c: c, n: 0 }; ordem.push(c.id); } opc[c.id].n++; });
      });
      box.innerHTML = wrong ? '<div><b>' + wrong + (wrong === 1 ? ' foto está' : ' fotos estão') + ' com o km em outro contrato.</b> A legenda e o ponto ' + (wrong === 1 ? 'dela' : 'delas') + ' estão usando o contrato errado.</div>' +
        (um ? '<div class="ft-opts"><button type="button" class="ft-opt ft-fix" data-ft="b-fixall">' + (!varios ? 'Corrigir o contrato ' + (wrong === 1 ? 'dela' : 'das ' + wrong) + ' pelo km'
          : 'Corrigir pelo km ' + (um === 1 ? 'a que tem' : 'as ' + um + ' que têm') + ' um só contrato possível') + '</button></div>' : '') +
        (varios ? '<div>' + (varios === 1 ? 'Em 1 foto' : 'Em ' + varios + ' fotos') + ', o km está no trecho de mais de um contrato: escolha o do serviço fotografado (aqui, para ' +
          (varios === 1 ? 'ela' : 'todas elas') + ', ou em cada foto, abaixo).</div><div class="ft-opts">' + ordem.map(function (id) {
            return '<button type="button" class="ft-opt" data-ft="b-fixto" data-cid="' + esc(id) + '">Passar ' + (varios === 1 ? 'para ' : opc[id].n < varios ? 'as ' + opc[id].n + ' possíveis para ' : 'as ' + varios + ' para ') +
              esc(lotName(opc[id].c)) + '</button>';
          }).join('') + '</div>' : '') : '';
      box.hidden = !wrong;
      var n = ok.length, off = batch.busy || wait > 0 || !n, nd = ok.filter(function (it) { return it.drive !== false; }).length;
      var bd = q('.ft-bdrv');
      if (bd) {
        bd.hidden = !opts.drive || !n;
        q('.ft-bdrvn').textContent = nd === n ? (n === 1 ? 'Vai para o Drive.' : 'Todas vão para o Drive.') : !nd ? (n === 1 ? 'Fica só no aparelho.' : 'Todas ficam só no aparelho.')
          : nd + ' de ' + n + ' vão para o Drive; ' + (n - nd) + ' só no aparelho.';
      }
      root.querySelectorAll('[data-ft="b-save"],[data-ft="b-share"]').forEach(function (b) { b.disabled = off; });
      var bs = q('[data-ft="b-save"]'), sh = q('[data-ft="b-share"]');
      bs.textContent = '⤓ ' + (n > 1 ? 'Salvar as ' + n + ' fotos (.zip)' : 'Salvar (.zip)');
      if (sh) sh.textContent = '↗ Compartilhar' + (n > 1 ? ' as ' + n : '');
      renderFaixa();
    }
    // a faixa de cima da barra (várias fotos): faltando enviar, o botão "☁ Enviar as N ao Drive"; mandadas, "⏳ Na fila … 0 de N"
    // até cada uma chegar ("✓ No Drive da equipe · N de N"). Na fila nunca aparece como enviada. Mudou o carimbo depois de
    // mandar: "Carimbo alterado · Atualizar no Drive" (a mesma foto, o mesmo id: a nova substitui a anterior no Drive)
    function renderFaixa() {
      var el = q('.ft-faixa');
      if (!el) return;
      if (!batch || !driveOn()) { el.hidden = true; el.innerHTML = ''; return; }
      var ok = readyItems(), n = ok.length, nd = ok.filter(function (it) { return it.drive !== false; }).length;
      var foi = ok.filter(function (it) { return it.filaDrive; }), off = batch.busy || !n || ok.length < liveItems().filter(function (it) { return !it.err; }).length;
      var falta = ok.filter(function (it) { return it.drive !== false && !it.filaDrive; }).length;
      if (foi.length && falta && batch.envMud === batch.mud) {
        el.hidden = false;
        el.innerHTML = '<button type="button" class="ft-btn ft-fx-env" data-ft="b-drive"' + (off ? ' disabled' : '') + '>☁ Enviar ' + (falta === 1 ? 'a que falta' : 'as ' + falta + ' que faltam') + ' ao Drive</button>';
        return;
      }
      if (!foi.length) {
        el.hidden = !nd;
        el.innerHTML = nd ? '<button type="button" class="ft-btn ft-fx-env" data-ft="b-drive"' + (off ? ' disabled' : '') + '>☁ ' +
          (nd === n ? (n === 1 ? 'Enviar ao Drive' : 'Enviar as ' + n + ' ao Drive') : 'Enviar ' + (nd === 1 ? 'a marcada' : 'as ' + nd + ' marcadas') + ' ao Drive') + '</button>' : '';
        return;
      }
      el.hidden = false;
      if (batch.envMud !== batch.mud) {
        el.innerHTML = '<div class="ft-fx alt"><span aria-hidden="true">✎</span><b>Carimbo alterado</b><button type="button" data-ft="b-drive"' + (off ? ' disabled' : '') + '>Atualizar no Drive</button></div>';
        return;
      }
      var sit = batch.sit || {}, chegou = foi.filter(function (it) { return sit[it.uid] === 'enviada'; }).length, tot = foi.length;
      el.innerHTML = chegou === tot ? '<div class="ft-fx ok"><span aria-hidden="true">✓</span><b>No Drive da equipe</b><i>' + chegou + ' de ' + tot + '</i></div>'
        : '<div class="ft-fx fila"><span aria-hidden="true">⏳</span><b>' + esc(motivoFila()) + '</b><i>' + chegou + ' de ' + tot + '</i></div>';
    }
    function motivoFila() {
      var i = opts.drive.info ? opts.drive.info() || {} : {};
      if (opts.drive.logado && !opts.drive.logado()) return 'Na fila: sobem depois que você entrar com o seu código';
      if (i.erro === 'codigo') return 'Na fila: seu acesso mudou, entre de novo';
      if (i.busy || (i.enviando || []).length) return 'Enviando ao Drive…';
      if (i.erro === 'rede' || navigator.onLine === false) return 'Na fila: sobem quando houver sinal';
      if (i.pausado) return 'Na fila: envio pausado';
      if (i.esperaWifi) return 'Na fila: esperando o Wi-Fi';
      return 'Na fila do Drive';
    }
    // a situação de cada foto do lote na fila do aparelho (fila, enviada)
    function lerSituacoes() {
      if (!batch || !opts.drive || !opts.drive.lista || !batch.items.some(function (it) { return it.filaDrive; })) return;
      var b = batch;
      opts.drive.lista().then(function (l) {
        if (batch !== b) return;
        var m = {};
        (l || []).forEach(function (r) { m[r.id] = r.situacao; });
        b.sit = m;
        renderFaixa();
      }, function () { /* segue com a última */ });
    }
    function setItemLot(it, id) {
      var c = byId(id);
      if (!c) return null;
      withItem(it, function () {
        it.cid = c.id;
        it.keepLot = '';
        var auto = it.km != null ? identify(it.km) : null;
        it.pid = pertoPonto(auto) ? auto.p.id : '';
      });
      return c;
    }
    // só as fotos com um único contrato possível pelo km; as com mais de um esperam a escolha (fixTo ou o botão de cada foto)
    function fixAll() {
      var n = 0, resta = 0;
      batch.items.forEach(function (it, i) {
        if (it.gone || it.wait || it.err) return;
        var to = wrongLot(it);
        if (!to) return;
        if (to.length !== 1) { resta++; return; }
        setItemLot(it, to[0].id);
        n++;
        refreshItem(i);
        queueDraw(i);
      });
      if (n) mudou();
      renderBatchSum();
      if (n || resta) notify((n ? n + (n === 1 ? ' foto corrigida' : ' fotos corrigidas') + ' para o contrato do km.' : '') +
        (resta ? (n ? ' ' : '') + resta + (resta === 1 ? ' tem' : ' têm') + ' o km em mais de um contrato: escolha o contrato ' + (resta === 1 ? 'dela' : 'delas') + '.' : ''));
    }
    // as fotos com o km em mais de um contrato, entre eles o escolhido (id), passam para ele
    function fixTo(id) {
      var n = 0, c = byId(id);
      if (!c) return;
      batch.items.forEach(function (it, i) {
        if (it.gone || it.wait || it.err) return;
        var to = wrongLot(it);
        if (!to || to.length < 2 || !has(to, c)) return;
        setItemLot(it, c.id);
        n++;
        refreshItem(i);
        queueDraw(i);
      });
      if (n) mudou();
      renderBatchSum();
      if (n) notify(n + (n === 1 ? ' foto passou' : ' fotos passaram') + ' para o contrato ' + lotName(c) + '.');
    }
    // o carimbo de alguma foto do lote mudou (para a faixa "Carimbo alterado" depois de mandar ao Drive)
    function mudou() { if (!batch) return; batch.mud = (batch.mud || 0) + 1; if (batch.items.some(function (it) { return it.filaDrive; })) renderFaixa(); }
    function itemChanged(i, later) {
      mudou();
      batch.ver++;
      var it = batch.items[i];
      clearTimeout(it.t);
      if (later) it.t = setTimeout(function () { queueDraw(i); }, 250);
      else queueDraw(i);
    }
    // prévias com carimbo, uma de cada vez, num canvas só
    // ---------------- foto do lote em tela cheia: a prévia com o carimbo, uma de cada vez, passando com o dedo (22/10/2026)
    var lvI = -1;
    function loteVis() {
      if (!batch) return [];
      return batch.items.map(function (it, k) { return k; }).filter(function (k) { var it = batch.items[k]; return !it.gone && !it.err && !it.wait && (it.prevUrl || it.url); });
    }
    function abreLoteVer(i) {
      if (!batch) return;
      var el = q('.ft-ver');
      if (!el) {
        el = document.createElement('div'); el.className = 'ft-ver'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Foto do lote');
        root.appendChild(el);
        if (window.GestosFoto) window.GestosFoto(el, {
          area: function () { return q('.ft-ver-img'); }, img: function () { return q('.ft-ver-img img'); }, fundo: function () { return el; },
          temAnt: function () { return loteVis().indexOf(lvI) > 0; }, temProx: function () { var v = loteVis(); return v.indexOf(lvI) >= 0 && v.indexOf(lvI) < v.length - 1; },
          ant: function () { passaLoteVer(-1); }, prox: function () { passaLoteVer(1); }, fechar: fechaLoteVer
        });
      }
      lvI = i;
      renderLoteVer();
    }
    function passaLoteVer(d) { var v = loteVis(), p = v.indexOf(lvI); if (p >= 0 && v[p + d] != null) { lvI = v[p + d]; renderLoteVer(); } }
    function fechaLoteVer() {
      var el = q('.ft-ver'), i = lvI;
      lvI = -1;
      if (el) el.remove();
      var it = itemEl(i); if (it) it.scrollIntoView({ block: 'center' });   // volta para a foto que estava aberta na lista
    }
    function renderLoteVer() {
      var el = q('.ft-ver'), v = loteVis(), p = v.indexOf(lvI), it = batch && batch.items[lvI];
      if (!el || p < 0 || !it) { fechaLoteVer(); return; }
      var c = byId(it.cid), pt = null;
      if (c && it.pid) pontosDe(c).forEach(function (x) { if (x.id === it.pid) pt = x; });
      var onde = [c ? lotName(c) : 'Sem contrato', pt ? 'Ponto ' + (pt.nome || '') : '', it.km != null ? 'km ' + nf(it.km, 2) : 'sem km'].filter(Boolean).join(' · ');
      el.innerHTML = '<div class="ft-ver-top"><button type="button" data-ft="lv-fecha">← Voltar</button><span class="ft-verc">' + (p + 1) + ' de ' + v.length + '</span>' +
        '<button type="button" data-ft="lv-ant" aria-label="Anterior"' + (p ? '' : ' disabled') + '>‹</button>' +
        '<button type="button" data-ft="lv-prox" aria-label="Próxima"' + (p < v.length - 1 ? '' : ' disabled') + '>›</button></div>' +
        '<div class="ft-ver-img"><img alt="Foto ' + (lvI + 1) + ' com o carimbo" src="' + esc(it.prevUrl || it.url) + '"></div>' +
        '<div class="ft-ver-info"><b>' + (lvI + 1) + '. ' + esc(it.name) + '</b><br>' + esc(onde) + (it.prevUrl ? '' : ' · <span style="color:#FEC84B">prévia do carimbo ainda sendo gerada</span>') + '</div>';
    }
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
    function setBatchBusy(on) { if (!batch) return; batch.busy = on; travaOpcoes(on); if (!on) prog(''); renderBatchSum(); }
    // enquanto o lote gera as fotos, os 4 botões de opções ficam travados: mudar a legenda ou o tamanho no meio deixava o .zip
    // (e a fila do Drive) com fotos de carimbos e tamanhos diferentes
    function travaOpcoes(on) {
      if (on) fechaFolha(true);
      root.querySelectorAll('[data-folha]').forEach(function (b) { b.disabled = on; });
      var bt = q('.ft-batch'); if (bt) bt.classList.toggle('ft-gerando', !!on);
      root.querySelectorAll('.ft-batch .ft-blist input, .ft-batch .ft-blist select, .ft-batch .ft-blist textarea, #ftBDesc, .ft-batch .ft-blist button[data-i]').forEach(function (x) { x.disabled = on; });
    }
    // gera as fotos finais (no tamanho escolhido em "Tamanho do arquivo", lido uma vez) e guarda enquanto nada mudar
    function outputs() {
      var b = batch, ver = b.ver;
      if (b.out && b.out.ver === ver) return Promise.resolve(b.out.files);
      var list = readyItems(), out = [], used = {}, cv = document.createElement('canvas'), a = arq();
      return list.reduce(function (p, it, k) {
        return p.then(function () {
          if (batch !== b) throw new Error('cancel');
          prog('Gerando ' + (k + 1) + ' de ' + list.length + '…');
          return decode(it.file).then(function (d) {
            if (!d) return null;
            withItem(it, function () { var keep = it.img; it.img = d.img; try { draw(cv, a[0]); } finally { it.img = keep; } });
            URL.revokeObjectURL(d.url);
            return new Promise(function (resolve) { cv.toBlob(resolve, 'image/jpeg', a[1]); });
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
      ligaGiro();   // antes de qualquer espera: no iPhone, a permissão do movimento só pode ser pedida no toque
      startGps();
      navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 4032 }, height: { ideal: 3024 } } }).then(function (stream) {
        if (!root || !root.parentNode || cam) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
        cam = { stream: stream, track: stream.getVideoTracks()[0], shots: [], busy: false, lastUrl: null, sure: 0 };
        try { cam.ic = window.ImageCapture ? new window.ImageCapture(cam.track) : null; } catch (e) { cam.ic = null; }
        var v = q('.ft-cam video');
        v.onloadedmetadata = v.onresize = camAr;
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
        cam.ov = setInterval(camOv, 1000);   // a hora e o km do carimbo mudam sozinhos
        renderCam();
      }, function (e) {
        startMsg(e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')
          ? bloqueado('A câmera') + ', ou use "Câmera do celular".'
          : 'Não foi possível abrir a câmera aqui. Use "Câmera do celular".');
      });
    }
    function stopCam() {
      if (cam) {
        cam.stream.getTracks().forEach(function (t) { t.stop(); });
        if (cam.lastUrl) URL.revokeObjectURL(cam.lastUrl);
        clearInterval(cam.ov);
      }
      cam = null;
      var ca = root && root.querySelector('.ft-camask'); if (ca) ca.remove();   // a pergunta de fechar a câmera não fica para depois
      desligaGiro();
      camPop('');
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
    function camVirou() { camLado(); camOv(); setTimeout(function () { camLado(); camOv(); }, 400); }   // o iPhone às vezes só atualiza o ângulo depois de girar a tela
    // a câmera muda de proporção ao girar o celular (em pé / deitado)
    function camAr() {
      var v = root && q('.ft-cam video');
      if (v && v.videoWidth && v.videoHeight) q('.ft-camview').style.setProperty('--ar', v.videoWidth + '/' + v.videoHeight);
      camOv();
    }

    // ---------------- giro: em pé ou deitada, pelo sensor do celular (vale com a rotação da tela travada)
    // giro.a: para onde o celular está virado, em graus: 0 em pé, 90 com o topo para a esquerda, -90 com o topo para a
    // direita, 180 de cabeça para baixo (a mesma conta do ângulo da tela). Sem sensor (ou sem permissão), fica null e a foto
    // sai como a tela. camModo: 'deitada' (o padrão: a foto sai sempre deitada; com o celular em pé, o quadro deitado do meio),
    // 'auto' (como o celular estiver) ou 'empe' (sempre em pé).
    var giro = { a: null }, camModo = CAM_GIROS.some(function (x) { return x[0] === lsGet(GIRO_KEY); }) ? lsGet(GIRO_KEY) : 'deitada', camLotsAberto = false;
    function aoGirar(e) {
      if (e.beta == null || e.gamma == null) return;
      var b = e.beta * Math.PI / 180, gm = e.gamma * Math.PI / 180, ux = -Math.sin(gm) * Math.cos(b), uy = Math.sin(b);
      if (ux * ux + uy * uy < 0.3) return;   // deitado na mesa: fica o último
      var a = Math.atan2(ux, uy) * 180 / Math.PI, alvo = Math.round(a / 90) * 90;
      if (alvo === -180) alvo = 180;
      // folga de 55°: perto da diagonal não fica trocando
      if (giro.a === null || Math.abs(((a - giro.a) % 360 + 540) % 360 - 180) > 55) {
        if (giro.a !== alvo) { giro.a = alvo; camOv(); }
      }
    }
    function ligaGiro() {
      var D = window.DeviceOrientationEvent;
      if (!D || giro.on) return;
      giro.on = true;
      var liga = function () { window.addEventListener('deviceorientation', aoGirar); };
      if (typeof D.requestPermission === 'function') {
        try { D.requestPermission().then(function (r) { if (r === 'granted' && giro.on) liga(); }, function () { /* sem permissão: segue a tela */ }); } catch (e) { /* idem */ }
      } else liga();
    }
    function desligaGiro() { giro.on = false; giro.a = null; window.removeEventListener('deviceorientation', aoGirar); }
    // quanto a imagem da tela está girada em relação à cena (0, 90, -90 ou 180)
    function telaAng() { var o = screen.orientation, a = o && typeof o.angle === 'number' ? o.angle : window.orientation; a = ((+a || 0) % 360 + 360) % 360; return a > 180 ? a - 360 : a; }
    function giroRel() { if (giro.a === null) return 0; var r = ((giro.a - telaAng()) % 360 + 540) % 360 - 180; return r === -180 ? 180 : r; }
    // tamanho da foto pronta a partir da imagem iw x ih da tela: girada e, se for o caso, o recorte 4:3 do meio
    function camQuadro(iw, ih, rel, modo) {
      var ow = rel % 180 ? ih : iw, oh = rel % 180 ? iw : ih, pw = ow, ph = oh;
      if (modo === 'deitada' && oh > ow) ph = ow * 3 / 4;
      if (modo === 'empe' && ow > oh) pw = oh * 3 / 4;
      return { w: pw, h: ph };
    }
    // a foto da câmera (como a tela mostra) girada para a cena ficar em pé, e o recorte do modo
    function orientar(blob, rel, modo) {
      return decode(blob).then(function (d) {
        if (!d) return blob;
        var img = d.img, iw = img.naturalWidth, ih = img.naturalHeight, qd = camQuadro(iw, ih, rel, modo), W = Math.round(qd.w), H = Math.round(qd.h);
        if (!rel && W === iw && H === ih) { URL.revokeObjectURL(d.url); return blob; }
        var cv = document.createElement('canvas'), g = cv.getContext('2d');
        cv.width = W; cv.height = H;
        g.translate(W / 2, H / 2); g.rotate(-rel * Math.PI / 180); g.drawImage(img, -iw / 2, -ih / 2);
        URL.revokeObjectURL(d.url);
        return toBlobP(cv).then(function (b) { cv.width = cv.height = 0; return b || blob; });
      });
    }
    // os dados que a foto teria agora (GPS, hora, contrato e ponto), para a prévia do carimbo
    function camPrev() {
      var f = camFix(), o = { desc: '' };
      place(o, { live: true, date: new Date(), ll: f ? f.ll : null, acc: f ? f.acc : null }, { lastModified: Date.now(), size: 0, type: 'image/jpeg' }, 'camapp');
      return o;
    }
    // por cima da imagem: escurece o que fica fora da foto e desenha o carimbo como vai sair (girado junto com a cena)
    function camOv() {
      if (!cam || !root) return;
      var cv = q('.ft-camov'), box = q('.ft-camview'), v = q('.ft-cam video');
      var BW = box.clientWidth, BH = box.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== Math.round(BW * dpr) || cv.height !== Math.round(BH * dpr)) { cv.width = Math.round(BW * dpr); cv.height = Math.round(BH * dpr); }
      var g = cv.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, BW, BH);
      var gb = q('[data-ft="cam-giro"]'), rel = giroRel();
      if (gb) gb.textContent = '\u27f3 ' + (camModo === 'auto' ? 'Automático · ' + (rel % 180 ? 'deitada' : 'em pé') : camModo === 'empe' ? 'Em pé' : 'Deitada');
      if (!v.videoWidth || !BW || !BH) return;
      var s = Math.min(BW / v.videoWidth, BH / v.videoHeight), qd = camQuadro(v.videoWidth * s, v.videoHeight * s, rel, camModo);
      var rw = rel % 180 ? qd.h : qd.w, rh = rel % 180 ? qd.w : qd.h, cx = BW / 2, cy = BH / 2;
      g.fillStyle = 'rgba(0,0,0,0.62)';
      g.beginPath(); g.rect(0, 0, BW, BH); g.rect(cx - rw / 2, cy - rh / 2, rw, rh); g.fill('evenodd');
      g.save();
      g.translate(cx, cy); g.rotate(rel * Math.PI / 180); g.translate(-qd.w / 2, -qd.h / 2);
      try { withItem(camPrev(), function () { carimbo(g, qd.w, qd.h); }); } catch (e) { /* a prévia não pode travar a câmera */ }
      g.restore();
    }
    function camPop(qual, btn) {
      if (!root) return;
      root.querySelectorAll('.ft-campop').forEach(function (p) { p.hidden = p.dataset.pop !== qual; });
      if (qual === 'giro') root.querySelectorAll('[data-ft="cam-giro-v"]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.v === camModo); });
      var f = qual && q('.ft-campop[data-pop="' + qual + '"] button');
      if (f) f.focus();
    }
    function camFix() { return lastFix && Date.now() - lastFix.t < 30000 ? lastFix : null; }
    function renderCamGps() {
      var el = q('.ft-camgps'), f = camFix();
      if (!f) { el.innerHTML = '<span class="ft-camgl"><span class="ft-warn">' + esc(lastFixErr || 'Procurando o GPS…') + '</span> As fotos tiradas agora ficam sem local.</span>'; return; }
      // uma linha só: GPS, km e ponto; "N contratos neste km" vira um botão que abre o aviso inteiro
      var loc = ref.locate(f.ll[0], f.ll[1]), h, lot = '';
      if (loc.dist > 2000) h = 'GPS ' + Math.round(f.acc || 0) + ' m · fora da ' + esc(rodovia()) + ' (' + nf(loc.dist / 1000, 1) + ' km do eixo)';
      else {
        var a = identify(loc.km);
        if (a && a.c.tipo === 'oae' && !pertoPonto(a)) a = null;   // Proarte: só sugere a ponte a até 150 m dela
        h = 'GPS ' + Math.round(f.acc || 0) + ' m · <b>' + esc(kmLine(loc.km, loc.dist >= 10 ? loc.side : '', loc.dist, true)) + '</b>' +
          (a ? ' · ' + esc(a.p.nome) + (a.d === 0 ? ' (aqui)' : ' a ' + (a.d < 1 ? Math.round(a.d * 1000) + ' m' : nf(a.d, 1) + ' km')) : '');
        lot = gpsLot(loc.km);
      }
      var nLot = lot ? lotsAt(loc.km).length : 0;
      el.innerHTML = '<span class="ft-camgl"><i aria-hidden="true"></i>' + h + '</span>' +
        (lot ? '<button type="button" class="ft-camlot" data-ft="cam-lots" aria-expanded="' + camLotsAberto + '">' + (nLot === 1 ? 'km de outro contrato' : nLot + ' contratos neste km') + ' \u25be</button>' +
          (camLotsAberto ? '<span class="ft-camlotx">' + lot.replace(/^ · /, '') + '</span>' : '') : '');
    }
    function renderCam() {
      if (!cam) return;
      renderCamGps();
      var n = cam.shots.length, last = q('.ft-camlast'), cheio = n >= MAX_FOTOS, lim = q('.ft-camlim');
      q('[data-ft="cam-done"]').disabled = !n;
      // no limite do lote, o botão de fotografar trava: as fotos da câmera só existem na memória até salvar
      q('[data-ft="cam-shot"]').disabled = cam.busy || cheio;
      q('.ft-camn').textContent = cheio ? 'Concluir (' + n + ' de ' + MAX_FOTOS + ')' : n ? 'Concluir (' + n + ')' : 'Concluir';
      lim.hidden = !cheio;
      lim.textContent = cheio ? 'Limite de ' + MAX_FOTOS + ' fotos: toque em Concluir para salvar estas; depois continue fotografando.' : '';
      q('[data-ft="cam-cancel"]').textContent = 'Fechar';
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
    // a captura cheia (ImageCapture) só quando a prévia é menor que o tamanho escolhido para o arquivo: no Android ela refaz foco
    // e exposição e leva de 0,5 a 2 s, e quem mexe o celular depois do toque via a foto sair com o chão e girada (23/10/2026).
    // O quadro da prévia sai no instante do toque, como no iPhone
    function cheia(v, c) {
      return !!(c.ic && typeof c.ic.takePhoto === 'function') && Math.max(v.videoWidth, v.videoHeight) < arq()[0];
    }
    function grab(v, c, full) {
      if (!full) return frameBlob(v);
      var W = 32, H = Math.max(8, Math.round(32 * v.videoHeight / v.videoWidth)), ref0 = { W: W, H: H, g: gray(v, 0, W, H) };
      return c.ic.takePhoto().then(function (blob) { return upright(blob, ref0); }).catch(function () { return frameBlob(v); });
    }
    function shoot() {
      var c = cam, v = q('.ft-cam video');
      if (!c || c.busy || !v.videoWidth || c.shots.length >= MAX_FOTOS) return;
      var fix = camFix(), when = new Date(), btn = q('[data-ft="cam-shot"]'), fl = q('.ft-flash'), rel = giroRel(), modo = camModo;
      var full = cheia(v, c), pisca = function () { fl.classList.add('on'); setTimeout(function () { fl.classList.remove('on'); }, 60); };
      c.busy = true;
      btn.disabled = true;
      // captura cheia: "Segure firme…" até a foto sair, e o clarão só no fim
      if (full) fl.classList.add('segura'); else pisca();
      grab(v, c, full).then(function (b0) { return b0 ? orientar(b0, rel, modo).then(null, function () { return b0; }) : b0; }).then(null, function () { return null; }).then(function (blob) {
        if (full) { fl.classList.remove('segura'); pisca(); }
        if (cam !== c) return;
        c.busy = false;
        btn.disabled = false;
        if (!blob) { notify('Não foi possível capturar a foto. Tente de novo.'); return; }
        var name = 'Foto ' + pad(when.getHours()) + 'h' + pad(when.getMinutes()) + 'm' + pad(when.getSeconds()) + 's.jpg', uid = newUid();
        var sh = { uid: uid, file: new File([blob], name, { type: 'image/jpeg', lastModified: when.getTime() }), meta: { live: true, date: when, ll: fix ? fix.ll : null, acc: fix ? fix.acc : null, uid: uid } };
        c.shots.push(sh);
        sh.guarda = guardarCaptura(sh, blob, name);
        if (c.lastUrl) URL.revokeObjectURL(c.lastUrl);
        c.lastUrl = URL.createObjectURL(blob);
        c.sure = 0;
        renderCam();
        if (c.shots.length >= MAX_FOTOS) notify('Limite de ' + MAX_FOTOS + ' fotos: toque em Concluir para salvar estas; depois continue fotografando.');
        else if (!fix) notify('Foto sem local: o GPS ainda não respondeu.');
      });
    }
    // A4: cada foto da câmera entra no aparelho na hora em que é tirada (Galeria › No aparelho, sem carimbo e sem ir ao Drive).
    // Se o app fechar, o celular recarregar ou alguém tocar em × ou em Nova seleção, a foto e o GPS dela não se perdem. Ao
    // terminar o lote (salvar, compartilhar ou enviar), a versão com carimbo entra no lugar dela (mesmo id)
    function guardarCaptura(sh, blob, name) {
      if (!opts.drive) return Promise.resolve(false);
      var m = sh.meta, ll = m.ll, loc = ll ? ref.locate(ll[0], ll[1]) : null, km = loc && loc.dist <= 2000 ? loc.km : null;
      var a = km != null ? identify(km) : null, c = a ? a.c : null, p = a && pertoPonto(a) ? a.p : null;
      var info = ['Câmera com GPS (sem carimbo)', km != null ? kmLine(km, '', null, true) : '', ll ? coordTxt(ll) : '', dateTxt(m.date)].filter(Boolean).join('\n');
      return opts.drive.add([{ id: sh.uid, nome: name, blob: blob, pastas: [(c && nomes.pasta(c)) || 'Sem lote', p ? p.nome || 'Ponto sem nome' : 'Sem ponto'], pastaAntiga: nomes.pastaAntiga(c),
        descricao: info, enviar: false,
        meta: { cid: c ? c.id : null, pid: p ? p.id : null, pnome: p ? p.nome || null : null, lote: c ? nomes.formal(c) : null, km: km != null ? Math.round(km * 1000) / 1000 : null,
          lat: ll ? ll[0] : null, lng: ll ? ll[1] : null, em: m.date.toISOString(), desc: null, rascunho: 1, camera: 1 } }])
        .then(function () { return true; }, function () { notify('O aparelho não deixou guardar esta foto (sem espaço?). Toque em Concluir e salve as fotos agora.'); return false; });
    }
    // fotos da câmera que ainda não foram salvas com o carimbo: continuam em Galeria › No aparelho
    function avisoCapturas(n) {
      if (n && opts.drive) notify(n === 1 ? 'A foto da câmera ficou guardada em Galeria › No aparelho (sem carimbo).' : 'As ' + n + ' fotos da câmera ficaram guardadas em Galeria › No aparelho (sem carimbo).');
    }
    function camDone() {
      if (!cam || cam.busy) return;
      var shots = cam.shots.slice();
      stopCam();
      if (!shots.length) { startView(); return; }
      onFiles(shots.map(function (s) { return s.file; }), 'camapp', shots.map(function (s) { return s.meta; }));
    }
    // com fotos tiradas, fechar pergunta antes: elas já estão guardadas no aparelho, sem carimbo
    function camCancel() {
      if (!cam) return;
      if (cam.shots.length) { camAsk(); return; }
      startView();
    }
    function camAsk() {
      var c0 = cam;
      Promise.all(cam.shots.map(function (s) { return s.guarda || Promise.resolve(false); })).then(function (rs) {
        if (cam !== c0) return;
        camAskMostra(rs.filter(function (r) { return r !== true; }).length);
      });
    }
    // nFalha: fotos que o aparelho não deixou guardar (sem espaço?): sair agora as perderia
    function camAskMostra(nFalha) {
      var n = cam.shots.length, d = q('.ft-camask');
      if (d) d.remove();
      d = document.createElement('div');
      d.className = 'ft-camask'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-labelledby', 'ftCamAskT');
      d.innerHTML = '<div class="ft-camask-box"><b id="ftCamAskT">' + (n === 1 ? '1 foto ainda sem carimbo' : n + ' fotos ainda sem carimbo') + '</b>' +
        (nFalha ? '<p class="ft-warn">' + (nFalha === 1 ? '1 foto não ficou guardada' : nFalha + ' fotos não ficaram guardadas') + ' no aparelho (sem espaço?). ' +
          'Ponha o carimbo e salve agora, senão ' + (nFalha === 1 ? 'ela se perde' : 'elas se perdem') + '.</p>'
          : '<p>' + (n === 1 ? 'Ela já está guardada' : 'Elas já estão guardadas') + ' no aparelho, com o GPS. Se sair agora, ' + (n === 1 ? 'fica' : 'ficam') +
          ' em Galeria › No aparelho, marcada' + (n === 1 ? '' : 's') + ' “sem carimbo”.</p>') +
        '<button type="button" class="ft-btn primary" data-ft="ask-carimbo">✎ Pôr o carimbo agora</button>' +
        (nFalha ? '' : '<button type="button" class="ft-btn" data-ft="ask-depois">Deixar para depois</button>') +
        '<button type="button" class="ft-btn" data-ft="ask-voltar">Continuar fotografando</button>' +
        '<button type="button" class="ft-askdel" data-ft="ask-descartar">Descartar ' + (n === 1 ? 'a foto' : 'as ' + n) + '</button></div>';
      root.appendChild(d);
      d.querySelector('[data-ft="ask-carimbo"]').focus();
    }
    function camAskFim(k) {
      var d = q('.ft-camask');
      if (d) d.remove();
      if (!cam || k === 'ask-voltar') return;
      if (k === 'ask-carimbo') { camDone(); return; }
      if (k === 'ask-depois') { var n = cam.shots.length; stopCam(); avisoCapturas(n); startView(); return; }
      camDescartar();
    }
    function camDescartar() {
      var shots = cam.shots.slice();
      cam.shots = [];   // descartadas de propósito: não contam como "ficaram guardadas"
      if (shots.length && opts.drive && opts.drive.apagar) {
        Promise.all(shots.map(function (s) { return s.guarda; })).then(function () { return opts.drive.apagar(shots.map(function (s) { return s.uid; })); })
          .then(function () { notify(shots.length === 1 ? 'Foto descartada.' : shots.length + ' fotos descartadas.'); }, function () { /* ficam na galeria */ });
      }
      startView();
    }

    // ---------------- eventos
    function onClick(e) {
      var o = e.target.closest('[data-set]');
      if (o) {
        var k = o.dataset.set, v = o.dataset.val;
        if (k === 'leg' && set.leg !== v) legAntes = set.leg;
        set[k] = k === 'logoOn' || k === 'logoFundo' ? v === 'true' : v;
        guarda(); renderOpts(); scheduleDraw(0);
        return;
      }
      var lg = e.target.closest('[data-logo]');
      if (lg) { selectLogo(lg.dataset.logo); return; }
      var fb = e.target.closest('[data-folha]');
      if (fb) { if (folha && folha.btn === fb) fechaFolha(); else abreFolha(fb.dataset.folha, fb); return; }
      var b = e.target.closest('[data-ft]');
      if (!b) return;
      if (b.dataset.ft === 'folha-fecha') { fechaFolha(); return; }
      if (b.dataset.ft === 'folha-padrao') { padraoFolha(); return; }
      if (b.dataset.ft === 'folha-desfaz') { desfazFolha(); return; }
      if (b.dataset.ft === 'lv-abre') { abreLoteVer(+b.dataset.lv); return; }
      if (b.dataset.ft === 'lv-fecha') { fechaLoteVer(); return; }
      if (b.dataset.ft === 'lv-ant' || b.dataset.ft === 'lv-prox') { passaLoteVer(b.dataset.ft === 'lv-prox' ? 1 : -1); return; }
      if (batch && b.dataset.i != null) { batchClick(b, +b.dataset.i); return; }
      if (b.dataset.ft === 'cam-open') { openCam(); return; }
      if (b.dataset.ft === 'cam-shot') { camPop(''); shoot(); return; }
      if (b.dataset.ft === 'cam-giro' || b.dataset.ft === 'cam-car') { var qual = b.dataset.ft === 'cam-giro' ? 'giro' : 'car', ab = q('.ft-campop[data-pop="' + qual + '"]'); camPop(ab.hidden ? qual : ''); return; }
      if (b.dataset.ft === 'cam-giro-v') { camModo = b.dataset.v; lsSet(GIRO_KEY, camModo); camPop(''); camOv(); return; }
      if (b.dataset.ft === 'cam-car-g') { camPop(''); abreFolha(b.dataset.v, q('[data-ft="cam-car"]')); return; }
      if (b.dataset.ft === 'cam-lots') { camLotsAberto = !camLotsAberto; renderCamGps(); return; }
      if (b.dataset.ft === 'cam-done') { camDone(); return; }
      if (b.dataset.ft === 'trocar-logo') {
        set.logo = legAntes && legAntes !== set.leg ? legAntes : set.leg.charAt(0) + (set.leg.charAt(1) === 'l' ? 'r' : 'l');
        legAntes = '';
        guarda(); renderOpts(); scheduleDraw(0);
        return;
      }
      if (b.dataset.ft === 'ir-logo') { abreFolha('logo', q('[data-folha="logo"]')); return; }
      if (b.dataset.ft === 'cam-cancel') { camCancel(); return; }
      if (/^ask-/.test(b.dataset.ft)) { camAskFim(b.dataset.ft); return; }
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
      if (b.dataset.ft === 'b-fixall') { if (batch) fixAll(); return; }
      if (b.dataset.ft === 'b-fixto') { if (batch) fixTo(b.dataset.cid); return; }
      if ((b.dataset.ft === 'b-drv-all' || b.dataset.ft === 'b-drv-none') && batch) {
        var vai = b.dataset.ft === 'b-drv-all';
        padraoDrive(vai);
        batch.items.forEach(function (it, i) { it.drive = vai; var cx = itemEl(i) && itemEl(i).querySelector('[data-b="drive"]'); if (cx) cx.checked = vai; });
        renderBatchSum();
        return;
      }
      if (b.dataset.ft === 'close') { if (st && !batch) sair(); close(); }
      else if (b.dataset.ft === 'new') { if (st && !batch) sair(); startView(); }
      else if (b.dataset.ft === 'ver-gal') { var vg = opts.abrirGaleria; if (st && !batch) sair(function () { if (vg) vg(); }); close(); }
      else if (b.dataset.ft === 'descartar') descartar(b);
      else if (b.dataset.ft === 'editar') { var bb = q('.ft-bb[data-folha="leg"]'); if (bb) bb.click(); }
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
      if (!it || it.gone || batch.busy) return;
      if (b.dataset.ft === 'b-del') {
        if (it.from === 'camapp' && !it.salva && opts.drive) { it.salva = true; notify('Foto ' + (i + 1) + ' tirada da seleção. Ela continua em Galeria › No aparelho (sem carimbo).'); }
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
        notify('Foto ' + (i + 1) + ' no contrato ' + lotName(c) + (p ? ' · ponto ' + p.nome : '') + '.');
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
      if (batch.busy && (t.id === 'ftBDesc' || (t.dataset && t.dataset.b))) return true;
      if (t.id === 'ftBDesc') {
        batch.common = t.value;
        batch.ver++; mudou();
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
          if (pertoPonto(auto)) it.pid = auto.p.id;
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
        if (pertoPonto(auto)) st.pid = auto.p.id;
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
      if (t.dataset && t.dataset.campo) { set.campos[t.dataset.campo] = t.checked; guarda(); renderOpts(); scheduleDraw(0); return; }
      if (t.id === 'ftDrive') { if (st) st.drive = t.checked; padraoDrive(t.checked); renderGuarda(); return; }
      if (batch && t.dataset && t.dataset.b === 'drive') { var bi = batch.items[+t.dataset.i]; if (bi) { bi.drive = t.checked; renderBatchSum(); } return; }
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

    // ---------------- logos: DNIT e consórcio (embutidas), padrão da equipe (banco, definida pelo responsável) e as adicionadas neste aparelho
    function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
    // escolha "Enviar ao Drive" das fotos novas: vale a última que a pessoa usou
    function padraoDrive(v) { if (v != null) lsSet(DRIVE_KEY, v ? '1' : '0'); return lsGet(DRIVE_KEY) !== '0'; }
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
    // a logo do DNIT passa a ser a padrão: marcada uma vez em cada aparelho (depois a pessoa troca se quiser)
    if (window.FOTO_LOGO_DNIT && lsGet(DNIT_KEY) !== '1') { lsSet(LOGO_SEL_KEY, 'dnit'); lsSet(DNIT_KEY, '1'); }
    var selId = lsGet(LOGO_SEL_KEY) || '', curImg = null, curKey = '';
    function teamLogo() { var t = opts.getTeamLogo ? opts.getTeamLogo() : null; return t && typeof t.src === 'string' && /^data:image\//.test(t.src) ? t : null; }
    function library() {
      var out = [], t = teamLogo();
      if (t) out.push({ id: 'equipe', nome: t.nome || 'Logo da equipe', src: t.src, team: true });
      if (window.FOTO_LOGO_DNIT) out.push({ id: 'dnit', nome: 'DNIT', src: window.FOTO_LOGO_DNIT.src, builtin: true });
      if (opts.logoSrc) out.push({ id: 'consorcio', nome: 'Consórcio Magna/Enecon', src: opts.logoSrc, builtin: true });
      return out.concat(deviceLogos);
    }
    function currentLogo() {
      var lib = library(), pick = null;
      lib.forEach(function (l) { if (l.id === selId) pick = l; });
      return pick || lib[0] || null;
    }
    // true: a logo mudou e a prévia vai ser redesenhada quando ela carregar
    function refreshLogo() {
      var cur = currentLogo(), key = cur ? cur.id + ':' + cur.src.length : '';
      if (key === curKey) return false;
      curKey = key;
      if (!cur) { curImg = null; scheduleDraw(0); return true; }
      loadLogo(cur.src).then(function (im) { if (curKey === key) { curImg = im; scheduleDraw(0); } });
      return true;
    }
    function renderLogos() {
      if (!root) return;
      var cur = currentLogo(), t = teamLogo(), canTeam = !!(opts.canSetTeamLogo && opts.canSetTeamLogo());
      // "Sem logo": nenhuma fica marcada (tocar numa logo volta a mostrar); o nome só quebra linha depois da barra ("Magna/Enecon")
      q('.ft-logos').innerHTML = library().map(function (l) {
        return '<button type="button" class="ft-logo" data-logo="' + esc(l.id) + '" aria-pressed="' + !!(set.logoOn && cur && cur.id === l.id) + '"><img src="' + esc(l.src) + '" alt=""><span>' +
          esc(l.nome).replace(/\//g, '/<wbr>') + (l.team ? '<small>padrão da equipe</small>' : '') + '</span></button>';
      }).join('');
      // remover e pôr como padrão da equipe agem na logo marcada: com "Sem logo" nenhuma está marcada, então somem
      q('[data-ft="logo-del"]').hidden = !(set.logoOn && cur && !cur.team && !cur.builtin);
      q('[data-ft="logo-team"]').hidden = !(canTeam && set.logoOn && cur && !cur.team);
      q('[data-ft="logo-team-off"]').hidden = !(canTeam && t);
      q('.ft-logo-src').textContent = 'A logo marcada fica como padrão neste aparelho. ' +
        (t ? 'A equipe usa por padrão: ' + (t.nome || 'logo da equipe') + '. ' : '') +
        (canTeam ? 'Como responsável, você pode deixar a logo marcada como padrão para toda a equipe.' : '');
    }
    // tocar numa logo liga a logo; `manter`: só troca qual é a escolhida (remover, padrão da equipe), sem mexer em "Mostrar"/"Sem logo".
    // Mesma logo de antes depois de "Sem logo": refreshLogo não muda nada, então redesenha aqui (no lote, isso também invalida as fotos já geradas)
    function selectLogo(id, manter) {
      selId = id;
      var ok = lsSet(LOGO_SEL_KEY, id);
      if (!manter) set.logoOn = true;
      guarda(ok);
      renderOpts();
      if (!refreshLogo()) scheduleDraw(0);
    }
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
      selectLogo('', true);
    }
    function setTeam() {
      var cur = currentLogo();
      if (!cur || cur.team || !opts.setTeamLogo) return;
      Promise.resolve(opts.setTeamLogo({ nome: cur.nome, src: cur.src })).then(function () {
        notify('Logo "' + cur.nome + '" definida como padrão da equipe.');
        selectLogo('equipe', true);
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
      if (o.fotos && o.fotos.length) onFiles(o.fotos.map(function (x) { return x.file; }), 'camapp', o.fotos.map(function (x) { return x.meta; }));
      setTimeout(function () { var x = q('.ft-x'); if (x) x.focus(); }, 30);
    }
    function close() {
      fechaFolha(true);
      if (cam && cam.shots.length) avisoCapturas(cam.shots.length);
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
  // as regras das opções, sem tela (para os testes em node)
  FotoCarimbo.opcoes = { padrao: defaults, ler: loadSet, resumos: resumos, logoCurto: logoCurto, noPadrao: grupoNoPadrao, padraoTxt: padraoTxt,
    ARQS: ARQS, GRUPOS: GRUPOS, FIELDS: FIELDS };
  // contrato pelo km, sem tela (para os testes em node): a mesma folga da galeria
  FotoCarimbo.km = { FOLGA_KM: FOLGA_KM, contratosNoKm: contratosNoKm };
  window.FotoCarimbo = FotoCarimbo;
})();
