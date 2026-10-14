/* Diagrama linear dos pontos críticos
 * - Edita contratos e pontos (dados guardados no navegador + backup .json)
 * - Desenha o diagrama em SVG no formato A3 paisagem
 * - Exporta PDF vetorial (jsPDF + svg2pdf.js) ou imprime pelo navegador
 */
(function () {
  'use strict';

  // ------------------------------------------------------------------ constantes
  var SERVICES = [
    { key: 'solo', label: 'Solo Brita 70/30', short: 'Solo brita' },
    { key: 'aterro', label: 'Aterro', short: 'Aterro' },
    { key: 'enroc', label: 'Enrocamento', short: 'Enrocamento' },
    { key: 'oac', label: 'OAC / Drenagem', short: 'OAC / Drenagem' },
    { key: 'prelim', label: 'Sv. Preliminares', short: 'Sv. preliminares' }
  ];
  var STATUS = {
    OK: { tag: 'OK', name: 'Concluído', btn: 'OK', fill: '#1E9E55' },
    A: { tag: 'ATIVO', name: 'Ativo', btn: 'Ativo', fill: '#2B5797' },
    P: { tag: 'PARADO', name: 'Parado', btn: 'Parado', fill: '#D93025' },
    NA: { tag: 'N/A', name: 'Não se aplica', btn: 'N/A', fill: 'none' }
  };
  var STATUS_ORDER = ['OK', 'A', 'P', 'NA'];
  var DEVICE_COLORS = {
    vermelho: { name: 'Vermelho', hex: '#E02424' },
    amarelo: { name: 'Amarelo', hex: '#E5B800' },
    cinza: { name: 'Cinza', hex: '#4F5653' },
    azul: { name: 'Azul', hex: '#1F6FD1' },
    verde: { name: 'Verde', hex: '#1E9E55' }
  };
  var STORE_KEY = 'unifilar-pontos-criticos.v1';
  var PAGE_W = 1190.55, PAGE_H = 841.89; // A3 paisagem em pontos
  var FONT = 'Helvetica, Arial, sans-serif';
  var LIBS = {
    jspdf: [
      'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
      'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js'
    ],
    svg2pdf: [
      'https://cdn.jsdelivr.net/npm/svg2pdf.js@2.2.3/dist/svg2pdf.umd.min.js',
      'https://unpkg.com/svg2pdf.js@2.2.3/dist/svg2pdf.umd.min.js'
    ]
  };

  // Geometria da folha (pt)
  var G = {
    frame: 20, labelX: 30, colLine: 136, x0: 142, x1: PAGE_W - 30,
    yHead: 94, yMarco: 100, yDevBase: 214, yKmBase: 262,
    yBand: 268, bandH: 70, yExt: 346, extH: 18, yConc: 370, concH: 20,
    yServ: 402, servH: 19, servStep: 24, yObs: 530, obsH: 220, yFoot: 760
  };

  // ------------------------------------------------------------------ utilidades
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function uid(prefix) { return (prefix || 'id') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function parseNum(v) {
    if (v == null) return null;
    var t = String(v).trim().replace(/\s/g, '');
    if (!t) return null;
    if (t.indexOf(',') >= 0) t = t.replace(/\./g, '').replace(',', '.');
    var n = Number(t);
    return isFinite(n) ? n : null;
  }
  function fmt(n, dec) {
    if (n == null || !isFinite(n)) return '';
    return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function fmtKm(n) { return n == null ? '' : fmt(n, 2); }
  function fmtPct(n) {
    if (n == null || !isFinite(n)) return '-';
    var r = Math.round(n * 10) / 10;
    return fmt(r, r % 1 === 0 ? 0 : 1) + '%';
  }
  function fmtDate(iso) {
    if (!iso) return '';
    var p = String(iso).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso;
  }
  function todayIso() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function r2(n) { return Math.round(n * 100) / 100; }

  // ------------------------------------------------------------------ cálculos
  function svcPct(s) {
    if (!s || s.st === 'NA') return null;
    if (s.st === 'OK') return 100;
    return clamp(Number(s.pct) || 0, 0, 100);
  }
  function pointPct(p) {
    var vals = SERVICES.map(function (k) { return svcPct(p.serv[k.key]); }).filter(function (v) { return v != null; });
    if (!vals.length) return 0;
    return vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
  }
  function pointLen(p) {
    return (p.kmIni != null && p.kmFim != null) ? Math.max(0, p.kmFim - p.kmIni) : null;
  }
  function sortedPoints(c) {
    return c.pontos.slice().sort(function (a, b) {
      var ka = a.kmIni == null ? 1e9 : a.kmIni, kb = b.kmIni == null ? 1e9 : b.kmIni;
      return ka - kb;
    });
  }
  function totals(c) {
    var pts = c.pontos, len = 0, enr = null, sb = null, pct = 0;
    pts.forEach(function (p) {
      len += pointLen(p) || 0;
      if (p.enr != null) enr = (enr || 0) + p.enr;
      if (p.sb != null) sb = (sb || 0) + p.sb;
      pct += pointPct(p);
    });
    return { n: pts.length, len: len, enr: enr, sb: sb, avg: pts.length ? pct / pts.length : null };
  }

  // ------------------------------------------------------------------ medida de texto
  var measureCtx = document.createElement('canvas').getContext('2d');
  function textW(str, size, bold) {
    measureCtx.font = (bold ? 'bold ' : '') + size + 'px Helvetica, Arial, sans-serif';
    return measureCtx.measureText(String(str)).width;
  }
  function fitText(str, maxW, size, bold) {
    str = String(str || '');
    if (textW(str, size, bold) <= maxW) return str;
    while (str.length > 1 && textW(str + '...', size, bold) > maxW) str = str.slice(0, -1);
    return str.replace(/\s+$/, '') + '...';
  }
  // tamanho de fonte que faz o texto caber em maxW, sem passar de 'size' nem ficar abaixo de 'min'
  function fitSize(str, maxW, size, bold, min) {
    var w = textW(String(str || ''), size, bold);
    return w <= maxW ? size : Math.max(min, size * maxW / w);
  }
  function wrap(text, maxW, size, bold) {
    var out = [];
    String(text || '').split(/\n/).forEach(function (para) {
      var words = para.split(/\s+/).filter(Boolean), line = '';
      words.forEach(function (w) {
        var test = line ? line + ' ' + w : w;
        if (textW(test, size, bold) <= maxW) { line = test; return; }
        if (line) out.push(line);
        while (textW(w, size, bold) > maxW && w.length > 1) {
          var k = w.length;
          while (k > 1 && textW(w.slice(0, k), size, bold) > maxW) k--;
          out.push(w.slice(0, k));
          w = w.slice(k);
        }
        line = w;
      });
      if (line) out.push(line);
    });
    return out;
  }

  // ------------------------------------------------------------------ primitivas SVG
  function T(x, y, str, o) {
    o = o || {};
    var a = '<text x="' + r2(x) + '" y="' + r2(y) + '" font-family="' + FONT + '" font-size="' + (o.size || 8) + '"';
    if (o.bold) a += ' font-weight="bold"';
    a += ' fill="' + (o.fill || '#17201C') + '"';
    if (o.anchor) a += ' text-anchor="' + o.anchor + '"';
    if (o.rot) a += ' transform="rotate(-90 ' + r2(x) + ' ' + r2(y) + ')"';
    return a + '>' + esc(str) + '</text>';
  }
  function R(x, y, w, h, o) {
    o = o || {};
    var a = '<rect x="' + r2(x) + '" y="' + r2(y) + '" width="' + r2(Math.max(0, w)) + '" height="' + r2(Math.max(0, h)) + '"';
    if (o.rx) a += ' rx="' + o.rx + '" ry="' + o.rx + '"';
    a += ' fill="' + (o.fill || 'none') + '"';
    if (o.stroke) a += ' stroke="' + o.stroke + '" stroke-width="' + (o.sw || 1) + '"';
    if (o.dash) a += ' stroke-dasharray="' + o.dash + '"';
    if (o.cls) a += ' class="' + o.cls + '"';
    return a + '/>';
  }
  function L(x1, y1, x2, y2, o) {
    o = o || {};
    var a = '<line x1="' + r2(x1) + '" y1="' + r2(y1) + '" x2="' + r2(x2) + '" y2="' + r2(y2) + '" stroke="' + (o.stroke || '#17201C') + '" stroke-width="' + (o.sw || 1) + '"';
    if (o.dash) a += ' stroke-dasharray="' + o.dash + '"';
    if (o.cap) a += ' stroke-linecap="' + o.cap + '"';
    return a + '/>';
  }
  function P(points, fill) {
    return '<polygon points="' + points.map(function (p) { return r2(p[0]) + ',' + r2(p[1]); }).join(' ') + '" fill="' + fill + '"/>';
  }

  // ------------------------------------------------------------------ paginação
  // Quantas folhas usar: cada pessoa pode escolher (fica guardado só no navegador dela, por contrato);
  // sem escolha, vale o "pontos por página" do contrato. Os pontos são repartidos igualmente entre as folhas.
  var MAX_PER_PAGE = 24;
  var PAGES_KEY = 'diagrama-linear.paginas';
  var pagesPref = (function () { try { return JSON.parse(localStorage.getItem(PAGES_KEY) || '{}') || {}; } catch (e) { return {}; } })();
  function setPagesPref(cid, pages) {
    if (pages) pagesPref[cid] = pages; else delete pagesPref[cid];
    try { localStorage.setItem(PAGES_KEY, JSON.stringify(pagesPref)); } catch (e) { /* sem armazenamento: vale só nesta visita */ }
  }
  function autoPages(c, n) { return Math.max(1, Math.ceil(n / clamp(parseInt(c.porPagina, 10) || 9, 1, 14))); }
  function minPages(n) { return Math.max(1, Math.ceil(n / MAX_PER_PAGE)); }
  function pageCountFor(c, n) {
    var want = parseInt(pagesPref[c.id], 10);
    return want ? clamp(want, minPages(n), Math.max(1, n)) : autoPages(c, n);
  }
  function paginate(c) {
    var pts = sortedPoints(c), n = pts.length, pageCount = pageCountFor(c, n);
    var base = Math.floor(n / pageCount), extra = n % pageCount, chunks = [], at = 0;
    for (var i = 0; i < pageCount; i++) {
      var size = base + (i < extra ? 1 : 0);
      chunks.push(pts.slice(at, at + size));
      at += size;
    }
    return { chunks: chunks, slots: Math.max(1, Math.ceil(n / pageCount)), sorted: pts };
  }

  function geom(slots) {
    var slot = (G.x1 - G.x0) / slots, gap = Math.min(14, slot * 0.12);
    return { slot: slot, gap: gap, bw: slot - gap, bx: function (li) { return G.x0 + li * slot + gap / 2; } };
  }

  function placeMarcos(c, pg) {
    // devolve [{pageIdx, x, marco}] usando a mesma grade de colunas da folha
    var gm = geom(pg.slots), slot = gm.slot, out = [];
    var where = [];
    pg.chunks.forEach(function (ch, pi) { ch.forEach(function (p, li) { where.push({ p: p, pi: pi, li: li }); }); });
    (c.marcos || []).forEach(function (m) {
      if (m.km == null || !where.length) return;
      var inside = where.find(function (w) { return w.p.kmIni != null && w.p.kmFim != null && m.km >= w.p.kmIni && m.km <= w.p.kmFim; });
      if (inside) {
        var len = inside.p.kmFim - inside.p.kmIni;
        var t = len > 0 ? (m.km - inside.p.kmIni) / len : 0.5;
        out.push({ pageIdx: inside.pi, x: gm.bx(inside.li) + t * gm.bw, marco: m });
        return;
      }
      var next = where.find(function (w) { return w.p.kmIni != null && w.p.kmIni > m.km; });
      if (next) {
        out.push({ pageIdx: next.pi, x: G.x0 + next.li * slot + (next.li === 0 ? 3 : 0), marco: m });
      } else {
        var last = where[where.length - 1];
        out.push({ pageIdx: last.pi, x: G.x0 + (last.li + 1) * slot - 3, marco: m });
      }
    });
    return out;
  }

  // ------------------------------------------------------------------ desenho da folha
  function renderSheets(c) {
    var pg = paginate(c), tot = totals(c), marcos = placeMarcos(c, pg);
    return pg.chunks.map(function (chunk, i) {
      return renderSheet(c, chunk, i, pg.chunks.length, pg.slots, tot, marcos.filter(function (m) { return m.pageIdx === i; }));
    });
  }

  function renderSheet(c, chunk, pageIdx, pageCount, slots, tot, marcos) {
    var o = [];
    o.push('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ' + PAGE_W + ' ' + PAGE_H + '" width="' + PAGE_W + '" height="' + PAGE_H + '">');
    o.push(R(0, 0, PAGE_W, PAGE_H, { fill: '#FFFFFF' }));
    o.push(R(G.frame, G.frame, PAGE_W - 2 * G.frame, PAGE_H - 2 * G.frame, { stroke: '#17201C', sw: 1.1 }));

    drawHeader(o, c, tot);
    drawLabels(o, c);

    var gm = geom(slots), slot = gm.slot;
    var n = chunk.length;

    if (!n) {
      o.push(T((G.x0 + G.x1) / 2, G.yBand + 30, 'Nenhum ponto cadastrado neste contrato.', { size: 12, fill: '#5C6661', anchor: 'middle' }));
    } else {
      // pista entre os pontos (trechos sem intervenção)
      o.push(R(G.x0, G.yBand, slot * n, G.bandH, { fill: '#EDC9C9' }));
      chunk.forEach(function (p, i) {
        drawPoint(o, p, gm.bx(i), gm.bw);
      });
      o.push(L(G.x0, G.yBand + G.bandH / 2, G.x0 + slot * n, G.yBand + G.bandH / 2, { stroke: '#30353A', sw: 0.8, dash: '7 4' }));
      o.push(R(G.x0, G.yBand, slot * n, G.bandH, { stroke: '#7D8581', sw: 0.8 }));
    }
    marcos.forEach(function (m) { drawMarco(o, m); });
    drawFooter(o, c, tot, pageIdx, pageCount);
    o.push('</svg>');
    return o.join('');
  }

  function drawHeader(o, c, tot) {
    var logo = window.UNIFILAR_LOGO, tx = 34;
    if (logo) {
      var lh = 56, lw = lh * logo.w / logo.h;
      o.push('<image x="32" y="30" width="' + r2(lw) + '" height="' + lh + '" preserveAspectRatio="xMidYMid meet" href="' + logo.src + '" xlink:href="' + logo.src + '"/>');
      tx = 32 + lw + 14;
    }
    // indicadores à direita
    var kpis = [
      { k: 'EXTENSÃO DO CONTRATO', v: c.extensaoContrato != null ? fmt(c.extensaoContrato, 2) + ' km' : '-', s: '' },
      { k: 'PONTOS CRÍTICOS', v: String(tot.n), s: fmt(tot.len, 2) + ' km somados' },
      { k: 'AVANÇO MÉDIO', v: fmtPct(tot.avg), s: 'média dos pontos' },
      { k: 'ÚLTIMA VISTORIA', v: fmtDate(c.dataVistoria) || '-', s: '' }
    ];
    var bw = 98, bg = 6, bx0 = G.x1 - (kpis.length * bw + (kpis.length - 1) * bg);
    kpis.forEach(function (k, i) {
      var x = bx0 + i * (bw + bg);
      o.push(R(x, 30, bw, 56, { fill: '#F4F6F5', stroke: '#C7CCC9', sw: 0.7, rx: 3 }));
      o.push(T(x + 8, 43, k.k, { size: 5.8, bold: true, fill: '#5C6661' }));
      o.push(T(x + 8, 63, fitText(k.v, bw - 14, 14, true), { size: 14, bold: true }));
      if (k.s) o.push(T(x + 8, 77, fitText(k.s, bw - 14, 6.4), { size: 6.4, fill: '#5C6661' }));
    });
    var maxW = bx0 - tx - 16;
    o.push(T(tx, 41, fitText(String(c.orgao || '').toUpperCase(), maxW, 6.6), { size: 6.6, fill: '#5C6661' }));
    o.push(T(tx, 62, fitText('DIAGRAMA LINEAR · OBRA ' + (c.numero || '[Nº DA OBRA]'), maxW, 17, true), { size: 17, bold: true }));
    var sub = [
      c.rodovia ? 'Rodovia ' + c.rodovia : '',
      c.lote || '',
      c.executora ? 'Executora: ' + c.executora : '',
      c.supervisora ? 'Supervisora: ' + c.supervisora + (c.ctSupervisao ? ' (CT ' + c.ctSupervisao + ')' : '') : ''
    ].filter(Boolean).join('   ·   ');
    wrap(sub, maxW, 7.6).slice(0, 2).forEach(function (line, i) {
      o.push(T(tx, 76 + i * 10, line, { size: 7.6, fill: '#3B4540' }));
    });
    o.push(L(G.frame, G.yHead, PAGE_W - G.frame, G.yHead, { stroke: '#17201C', sw: 1 }));
  }

  function drawLabels(o, c) {
    var x = G.labelX, w = G.colLine - G.labelX - 6, gray = '#5C6661';
    o.push(T(x, 113, 'SENTIDO', { size: 6, bold: true, fill: gray }));
    o.push(T(x, 126, fitText('De: ' + (c.origem || '-'), w, 7.8, true), { size: 7.8, bold: true }));
    o.push(T(x, 138, fitText('Para: ' + (c.destino || '-'), w, 7.8, true), { size: 7.8, bold: true }));
    // seta de sentido
    o.push(L(x, 147, x + 70, 147, { stroke: '#B42318', sw: 1.4 }));
    o.push(P([[x + 76, 147], [x + 68, 143], [x + 68, 151]], '#B42318'));
    if (c.kmIni != null || c.kmFim != null) {
      o.push(T(x, 166, 'TRECHO', { size: 6, bold: true, fill: gray }));
      o.push(T(x, 177, fitText('KM ' + (fmtKm(c.kmIni) || '?') + ' a ' + (fmtKm(c.kmFim) || '?'), w, 7.4), { size: 7.4 }));
    }
    o.push(T(x, G.yKmBase - 4, 'KM DOS PONTOS', { size: 6, bold: true, fill: gray }));
    o.push(T(x, G.yBand + 26, 'PLATAFORMA', { size: 7, bold: true }));
    if (c.plataforma) o.push(T(x, G.yBand + 37, fitText(c.plataforma, w, 7), { size: 7 }));
    o.push(T(x, G.yBand + 52, 'Pista', { size: 6.6, fill: gray }));
    o.push(T(x, G.yExt + 12.5, 'EXTENSÃO', { size: 7, bold: true }));
    o.push(T(x, G.yConc + 13.5, 'CONCLUSÃO', { size: 7, bold: true }));
    o.push(T(x, G.yServ - 4, 'SERVIÇOS', { size: 6, bold: true, fill: gray }));
    SERVICES.forEach(function (s, i) {
      o.push(T(x, G.yServ + i * G.servStep + 12.8, s.label, { size: 7.2, bold: true }));
    });
    o.push(T(x, G.yObs + 12, 'OBSERVAÇÕES', { size: 7, bold: true }));
    o.push(L(G.colLine, 106, G.colLine, G.yObs + G.obsH, { stroke: '#C9CECB', sw: 0.6 }));
  }

  function drawPoint(o, p, bx, bw) {
    var cx = bx + bw / 2;
    o.push('<g data-pid="' + esc(p.id) + '">');

    // bloco da plataforma
    var blockFill = '#D6DAD8';
    o.push(R(bx, G.yBand, bw, G.bandH, { fill: blockFill, stroke: '#7D8581', sw: 0.7, cls: 'blk' }));

    // KM inicial e final (texto vertical nas bordas do bloco)
    var ks = 7.4;
    if (p.kmIni != null) o.push(T(bx + ks * 0.75 + 1, G.yKmBase, fmtKm(p.kmIni), { size: ks, bold: true, rot: true }));
    if (p.kmFim != null) o.push(T(bx + bw - ks * 0.25 - 1, G.yKmBase, fmtKm(p.kmFim), { size: ks, bold: true, rot: true }));

    // dispositivos (OAC / bueiros): desenhados antes dos textos do bloco, que ficam por cima
    drawDevices(o, p, bx, bw);

    // volumes e nome do ponto, com fundo para interromper as linhas dos dispositivos
    var vols = [p.enr != null ? 'Enr: ' + fmt(p.enr, 2) + ' m³' : null, p.sb != null ? 'Sb: ' + fmt(p.sb, 2) + ' m³' : null].filter(Boolean);
    var vs = Math.min.apply(null, [6.1].concat(vols.map(function (t) { return fitSize(t, bw - 8, 6.1, false, 3.6); }))), vy = G.yBand + 10;
    vols.forEach(function (txt) {
      txt = fitText(txt, bw - 8, vs);
      o.push(R(bx + 2.5, vy - vs * 0.82, textW(txt, vs) + 3, vs * 1.12, { fill: blockFill }));
      o.push(T(bx + 4, vy, txt, { size: r2(vs), fill: '#B42318' }));
      vy += Math.max(5, vs * 1.31);
    });
    var name = p.nome || '?', ns = fitSize(name, bw - 6, 19, true, 9), nw = textW(name, ns, true);
    o.push(R(cx - nw / 2 - 3, G.yBand + G.bandH - 11 - ns * 0.76, nw + 6, ns * 0.82, { fill: blockFill }));
    o.push(T(cx, G.yBand + G.bandH - 11, name, { size: r2(ns), bold: true, anchor: 'middle' }));

    // extensão
    var len = pointLen(p);
    o.push(R(bx, G.yExt, bw, G.extH, { fill: '#FFFFFF', stroke: '#7D8581', sw: 0.6 }));
    var extTxt = len != null ? fmt(len, 2) + ' km' : '-';
    o.push(T(cx, G.yExt + 12.4, extTxt, { size: r2(fitSize(extTxt, bw - 4, 8.4, true, 5)), bold: true, anchor: 'middle' }));

    // conclusão
    var pct = pointPct(p);
    o.push(R(bx, G.yConc, bw, G.concH, { fill: '#EEF0EF', stroke: '#7D8581', sw: 0.6 }));
    if (pct > 0) o.push(R(bx + 0.6, G.yConc + 0.6, (bw - 1.2) * pct / 100, G.concH - 1.2, { fill: '#A9D5B8' }));
    o.push(T(cx, G.yConc + 13.6, fmtPct(pct), { size: r2(fitSize(fmtPct(pct), bw - 4, 9.2, true, 5.5)), bold: true, anchor: 'middle' }));

    // serviços
    SERVICES.forEach(function (s, i) {
      var sv = p.serv[s.key] || { st: 'NA', pct: 0 }, y = G.yServ + i * G.servStep, st = STATUS[sv.st] || STATUS.NA;
      if (sv.st === 'NA') {
        o.push(R(bx, y, bw, G.servH, { fill: '#FFFFFF', stroke: '#B9C0BC', sw: 0.6, dash: '2 2', rx: 2 }));
        o.push(T(cx, y + 12.8, 'N/A', { size: 7, bold: true, fill: '#7A817D', anchor: 'middle' }));
        return;
      }
      var label = st.tag;
      if (sv.st === 'A') label = 'ATIVO · ' + fmtPct(svcPct(sv));
      if (sv.st === 'P' && svcPct(sv) > 0) label = 'PARADO · ' + fmtPct(svcPct(sv));
      o.push(R(bx, y, bw, G.servH, { fill: st.fill, rx: 2 }));
      var ls = fitSize(label, bw - 6, 7.4, true, 4.4);
      o.push(T(cx, y + 12.8, fitText(label, bw - 6, ls, true), { size: r2(ls), bold: true, fill: '#FFFFFF', anchor: 'middle' }));
    });

    // observações
    o.push(R(bx, G.yObs, bw, G.obsH, { fill: '#FFFFFF', stroke: '#7D8581', sw: 0.6 }));
    o.push(T(bx + 5, G.yObs + 12, 'Observações gerais', { size: r2(fitSize('Observações gerais', bw - 10, 7, true, 4.2)), bold: true }));
    // com muitos pontos por folha a coluna estreita: a letra diminui junto (no padrão de 9 por folha fica igual)
    var k = clamp((bw - 10) / 89.6, 0.62, 1);
    var fs = r2(7 * k), lh = 8.9 * k, maxLines = Math.floor((G.obsH - 26) / lh);
    var lines = wrap(p.obs || '', bw - 10, fs);
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1] = fitText(lines[maxLines - 1] + '...', bw - 10, fs);
    }
    lines.forEach(function (ln, i) { o.push(T(bx + 5, G.yObs + 25 + i * lh, ln, { size: fs, fill: '#2B3430' })); });

    o.push('</g>');
  }

  function drawDevices(o, p, bx, bw) {
    var devs = (p.disp || []).filter(function (d) { return d && (d.desc || d.km != null); });
    if (!devs.length) return;
    var len = pointLen(p), fs = 6;
    var items = devs.map(function (d) {
      var t = (len && d.km != null) ? clamp((d.km - p.kmIni) / len, 0, 1) : 0.5;
      var x = clamp(bx + t * bw, bx + 3, bx + bw - 3);
      return { d: d, x: x, lx: x };
    }).sort(function (a, b) { return a.x - b.x; });
    // afasta os rótulos para não sobrepor
    var minGap = fs + 1.6;
    for (var i = 1; i < items.length; i++) {
      if (items[i].lx - items[i - 1].lx < minGap) items[i].lx = items[i - 1].lx + minGap;
    }
    var overflow = items[items.length - 1].lx - (bx + bw + 6);
    if (overflow > 0) items.forEach(function (it) { it.lx -= overflow; });
    items.forEach(function (it) {
      var col = (DEVICE_COLORS[it.d.cor] || DEVICE_COLORS.vermelho).hex;
      var lineTop = G.yDevBase + 6;
      if (Math.abs(it.lx - it.x) > 0.5) {
        o.push(L(it.lx, G.yDevBase + 2, it.x, lineTop, { stroke: col, sw: 0.7 }));
      }
      o.push(L(it.x, lineTop, it.x, G.yBand + G.bandH, { stroke: col, sw: 2.2 }));
      var label = fitText(it.d.desc || 'Dispositivo', G.yDevBase - G.yMarco - 6, fs);
      o.push(T(it.lx + fs * 0.35, G.yDevBase, label, { size: fs, fill: '#1D4F91', rot: true }));
    });
  }

  function drawMarco(o, m) {
    var name = String(m.marco.nome || 'Marco').toUpperCase(), km = 'KM ' + fmtKm(m.marco.km);
    var w = Math.max(textW(name, 7.2, true), textW(km, 6.8, true)) + 14, h = 25;
    var bx = clamp(m.x - w / 2, G.x0, G.x1 - w);
    o.push(R(bx, G.yMarco, w, h, { fill: '#5E8C2E', rx: 2 }));
    o.push(T(bx + w / 2, G.yMarco + 10, name, { size: 7.2, bold: true, fill: '#FFFFFF', anchor: 'middle' }));
    o.push(T(bx + w / 2, G.yMarco + 20, km, { size: 6.8, bold: true, fill: '#FFFFFF', anchor: 'middle' }));
    o.push(L(m.x, G.yMarco + h, m.x, G.yBand - 8, { stroke: '#2B5797', sw: 1.8 }));
    o.push(P([[m.x - 4.5, G.yBand - 9], [m.x + 4.5, G.yBand - 9], [m.x, G.yBand - 1]], '#2B5797'));
  }

  function drawFooter(o, c, tot, pageIdx, pageCount) {
    var y = G.yFoot, x = G.labelX, gray = '#5C6661';
    o.push(L(G.frame, y - 4, PAGE_W - G.frame, y - 4, { stroke: '#C9CECB', sw: 0.6 }));
    o.push(T(x, y + 10, 'LEGENDA', { size: 6.4, bold: true, fill: gray }));
    var lx = x + 44;
    ['OK', 'A', 'P', 'NA'].forEach(function (k) {
      var st = STATUS[k], label = k === 'OK' ? 'Concluído (OK)' : k === 'A' ? 'Ativo' : k === 'P' ? 'Parado' : 'Não se aplica (N/A)';
      if (k === 'NA') o.push(R(lx, y + 2, 16, 10, { fill: '#FFFFFF', stroke: '#B9C0BC', sw: 0.6, dash: '2 2', rx: 1.5 }));
      else o.push(R(lx, y + 2, 16, 10, { fill: st.fill, rx: 1.5 }));
      o.push(T(lx + 20, y + 10, label, { size: 7 }));
      lx += 20 + textW(label, 7) + 14;
    });
    o.push(L(lx, y + 7, lx + 16, y + 7, { stroke: DEVICE_COLORS.vermelho.hex, sw: 2.2 }));
    o.push(T(lx + 20, y + 10, 'OAC / dispositivo de drenagem', { size: 7 }));
    lx += 20 + textW('OAC / dispositivo de drenagem', 7) + 14;
    o.push(R(lx, y + 2, 16, 10, { fill: '#EDC9C9' }));
    o.push(T(lx + 20, y + 10, 'Trecho sem intervenção', { size: 7 }));

    o.push(T(x, y + 28, 'Conclusão do ponto = média das etapas aplicáveis. N/A: serviço não aplicável neste ponto crítico.', { size: 6.6, fill: gray }));

    var bx = 640;
    if (pageIdx === pageCount - 1) {
      o.push(R(bx, y, G.x1 - bx, 34, { fill: '#F4F6F5', stroke: '#C7CCC9', sw: 0.7, rx: 3 }));
      o.push(T(bx + 10, y + 13, 'TOTAL GERAL', { size: 6.6, bold: true, fill: gray }));
      var parts = [];
      if (tot.enr != null) parts.push(['Enrocamento', fmt(tot.enr, 2) + ' m³']);
      if (tot.sb != null) parts.push(['Solo-brita', fmt(tot.sb, 2) + ' m³']);
      parts.push(['Extensão dos pontos', fmt(tot.len, 2) + ' km']);
      parts.push(['Pontos', String(tot.n)]);
      var px = bx + 10;
      parts.forEach(function (pt) {
        var lbl = pt[0] + ': ';
        o.push(T(px, y + 26, lbl, { size: 8, fill: '#3B4540' }));
        px += textW(lbl, 8);
        o.push(T(px, y + 26, pt[1], { size: 8.2, bold: true }));
        px += textW(pt[1], 8.2, true) + 22;
      });
    } else {
      o.push(T(G.x1, y + 13, 'Continua na página ' + (pageIdx + 2), { size: 7.4, fill: gray, anchor: 'end' }));
    }
    o.push(T(G.x1, PAGE_H - G.frame - 6, 'Página ' + (pageIdx + 1) + ' de ' + pageCount + '   ·   Gerado em ' + fmtDate(todayIso()), { size: 6.4, fill: gray, anchor: 'end' }));
  }

  // ------------------------------------------------------------------ estado
  var state, ui = { contractOpen: false, open: {}, wide: false };

  function validState(s) {
    return s && Array.isArray(s.contracts) && s.contracts.every(function (c) { return c && Array.isArray(c.pontos); });
  }
  function normalize(s) {
    s.contracts.forEach(function (c) {
      c.id = c.id || uid('ct');
      c.marcos = Array.isArray(c.marcos) ? c.marcos : [];
      c.pontos.forEach(function (p) {
        p.id = p.id || uid('pt');
        p.serv = p.serv || {};
        SERVICES.forEach(function (k) { if (!p.serv[k.key]) p.serv[k.key] = { st: 'NA', pct: 0 }; });
        p.disp = Array.isArray(p.disp) ? p.disp : [];
      });
    });
    if (!s.contracts.some(function (c) { return c.id === s.activeId; })) s.activeId = s.contracts[0] && s.contracts[0].id;
    return s;
  }
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) { var s = JSON.parse(raw); if (validState(s)) return normalize(s); }
    } catch (e) { /* sem acesso ao armazenamento */ }
    return null;
  }
  var saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      saveTimer = null;
      var el = document.getElementById('saveState');
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(state));
        var d = new Date();
        el.textContent = 'Salvo às ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
        el.classList.remove('warn');
      } catch (e) {
        el.textContent = 'Não salvou no navegador: use "Salvar backup"';
        el.classList.add('warn');
      }
      if (banco.on) { trackChanges(); syncStatus(); }
    }, 300);
  }
  function active() {
    return state.contracts.find(function (c) { return c.id === state.activeId; }) || state.contracts[0];
  }
  function findPoint(id) {
    return active().pontos.find(function (p) { return p.id === id; });
  }

  // ------------------------------------------------------------------ interface: helpers
  var $ = function (id) { return document.getElementById(id); };
  var toastTimer = null;
  function toast(msg, ms) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, ms || 3200);
  }
  var ICON_TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>';
  var ICON_CHEV = '<svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

  function field(label, attrs, value, extra) {
    var id = 'f-' + Math.random().toString(36).slice(2, 9);
    return '<div class="field' + (extra || '') + '"><label for="' + id + '">' + esc(label) + '</label><input id="' + id + '" ' + attrs + ' value="' + esc(value == null ? '' : value) + '"></div>';
  }

  // ------------------------------------------------------------------ interface: abas
  function renderTabs() {
    $('tabs').innerHTML = state.contracts.map(function (c) {
      return '<button type="button" class="tab" data-tab="' + esc(c.id) + '" aria-current="' + (c.id === state.activeId) + '">' +
        esc(c.lote || 'Contrato') + '<small>' + esc(c.numero || 'sem número') + '</small></button>';
    }).join('') + '<button type="button" class="tab add" data-act="new-contract">+ Contrato</button>';
  }

  // ------------------------------------------------------------------ interface: editor
  function renderEditor() {
    var c = active();
    var h = [];
    h.push('<section class="card">');
    h.push('<button type="button" class="card-head" data-act="toggle-contract" aria-expanded="' + ui.contractOpen + '"><span>Dados do contrato <span class="sub">· ' + esc(c.lote || '') + ' ' + esc(c.numero || '') + '</span></span>' + ICON_CHEV + '</button>');
    if (ui.contractOpen) {
      h.push('<div class="card-body">' + (banco.on ? lastLine(metaKey(c.id)) : '') + '<div class="grid">');
      h.push(field('Nº da obra / contrato', 'data-c="numero" type="text"', c.numero));
      h.push(field('Lote', 'data-c="lote" type="text"', c.lote));
      h.push(field('Executora', 'data-c="executora" type="text"', c.executora, ' full'));
      h.push(field('Supervisora', 'data-c="supervisora" type="text"', c.supervisora));
      h.push(field('Contrato da supervisora', 'data-c="ctSupervisao" type="text"', c.ctSupervisao));
      h.push(field('Órgão (linha do cabeçalho)', 'data-c="orgao" type="text"', c.orgao, ' full'));
      h.push(field('Rodovia', 'data-c="rodovia" type="text"', c.rodovia));
      h.push(field('Extensão do contrato (km)', 'data-c="extensaoContrato" data-num="1" type="text" inputmode="decimal"', fmt(c.extensaoContrato, 2)));
      h.push(field('Sentido: de', 'data-c="origem" type="text"', c.origem));
      h.push(field('Sentido: para', 'data-c="destino" type="text"', c.destino));
      h.push(field('KM inicial do trecho', 'data-c="kmIni" data-num="1" type="text" inputmode="decimal"', fmtKm(c.kmIni)));
      h.push(field('KM final do trecho', 'data-c="kmFim" data-num="1" type="text" inputmode="decimal"', fmtKm(c.kmFim)));
      h.push(field('Largura da plataforma', 'data-c="plataforma" type="text"', c.plataforma));
      h.push(field('Data da última vistoria', 'data-c="dataVistoria" type="date"', c.dataVistoria));
      h.push(field('Pontos por página (máx.)', 'data-c="porPagina" data-int="1" type="number" min="1" max="14"', c.porPagina || 9));
      h.push('</div>');
      h.push('<div class="section-title">Marcos no diagrama<button type="button" class="btn small" data-act="add-marco">+ Marco</button></div>');
      if (!c.marcos.length) h.push('<div class="empty">Nenhum marco. Use para pedreira, cidade, ponte etc.</div>');
      c.marcos.forEach(function (m, i) {
        h.push('<div class="mini-row">' +
          field('Nome', 'data-marco="' + i + '" data-mf="nome" type="text"', m.nome) +
          field('KM', 'data-marco="' + i + '" data-mf="km" type="text" inputmode="decimal"', fmtKm(m.km)) +
          '<button type="button" class="icon-btn" data-act="del-marco" data-idx="' + i + '" aria-label="Remover marco ' + esc(m.nome) + '">' + ICON_TRASH + '</button></div>');
      });
      h.push('<div><button type="button" class="btn small danger" data-act="del-contract">Excluir este contrato</button></div>');
      h.push('</div>');
    }
    h.push('</section>');

    var pts = sortedPoints(c);
    h.push('<div class="points-head"><h2>Pontos críticos<span class="count">' + pts.length + '</span></h2><button type="button" class="btn small" data-act="add-point">+ Ponto</button></div>');
    h.push('<div class="hint">Ordenados por KM, como no diagrama. Clique num ponto (aqui ou no desenho) para editar.</div>');
    h.push('<div class="pt-list" id="ptList">');
    pts.forEach(function (p) { h.push(pointCard(p)); });
    h.push('</div>');
    if (readOnly()) {
      h.unshift('<div class="ro-note"><span>Só consulta: os dados são do banco da equipe. Para editar, entre com o código da equipe.</span>' +
        '<button type="button" class="btn small primary" data-act="login">Entrar para editar</button></div>');
    }
    $('editor').innerHTML = h.join('');
    lockEditor();
  }

  function pointHead(p) {
    var dots = SERVICES.map(function (s) {
      var st = (p.serv[s.key] || {}).st || 'NA';
      return '<span class="dot ' + st + '" title="' + esc(s.short + ': ' + STATUS[st].name) + '"></span>';
    }).join('');
    var km = (p.kmIni != null ? fmtKm(p.kmIni) : '?') + ' – ' + (p.kmFim != null ? fmtKm(p.kmFim) : '?');
    return '<span class="pt-name">' + esc(p.nome || '?') + '</span><span class="pt-km">KM ' + km + '</span><span class="pt-dots">' + dots + '</span><span class="pt-pct">' + fmtPct(pointPct(p)) + '</span>' + ICON_CHEV;
  }

  function pointCard(p) {
    var open = !!ui.open[p.id];
    var h = '<article class="pt' + (open ? ' open' : '') + '" data-id="' + esc(p.id) + '">';
    h += '<button type="button" class="pt-head" data-act="toggle-point" data-id="' + esc(p.id) + '" aria-expanded="' + open + '">' + pointHead(p) + '</button>';
    if (open) {
      var id = esc(p.id), len = pointLen(p);
      h += '<div class="pt-body">' + (banco.on ? lastLine(metaKey(active().id, p.id)) : '') + '<div class="grid">';
      h += field('Nome do ponto', 'data-p="nome" data-id="' + id + '" type="text"', p.nome);
      h += field('Extensão (calculada)', 'type="text" readonly tabindex="-1"', len != null ? fmt(len, 2) + ' km' : '');
      h += field('KM inicial', 'data-p="kmIni" data-num="1" data-id="' + id + '" type="text" inputmode="decimal"', fmtKm(p.kmIni));
      h += field('KM final', 'data-p="kmFim" data-num="1" data-id="' + id + '" type="text" inputmode="decimal"', fmtKm(p.kmFim));
      h += field('Enrocamento (m³)', 'data-p="enr" data-num="1" data-id="' + id + '" type="text" inputmode="decimal"', fmt(p.enr, 2));
      h += field('Solo-brita (m³)', 'data-p="sb" data-num="1" data-id="' + id + '" type="text" inputmode="decimal"', fmt(p.sb, 2));
      h += '</div>';

      h += '<div class="section-title">Serviços</div>';
      SERVICES.forEach(function (s) {
        var sv = p.serv[s.key];
        var segs = STATUS_ORDER.map(function (k) {
          return '<button type="button" class="' + k + '" data-act="set-st" data-id="' + id + '" data-svc="' + s.key + '" data-st="' + k + '" aria-pressed="' + (sv.st === k) + '">' + STATUS[k].btn + '</button>';
        }).join('');
        var pctDisabled = (sv.st === 'OK' || sv.st === 'NA');
        h += '<div class="svc"><div class="svc-name">' + esc(s.short) + '</div><div class="seg" role="group" aria-label="' + esc(s.short) + '">' + segs + '</div>' +
          '<div class="pct-in"><input type="number" min="0" max="100" step="1" data-svcpct="' + s.key + '" data-id="' + id + '" value="' + (pctDisabled ? (sv.st === 'OK' ? 100 : '') : (Number(sv.pct) || 0)) + '"' + (pctDisabled ? ' disabled' : '') + ' aria-label="Percentual executado de ' + esc(s.short) + '"><span>%</span></div></div>';
      });

      h += '<div class="section-title">Dispositivos de drenagem (OAC)<button type="button" class="btn small" data-act="add-dev" data-id="' + id + '">+ Dispositivo</button></div>';
      if (!p.disp.length) h += '<div class="empty">Nenhum dispositivo neste ponto.</div>';
      p.disp.forEach(function (d, i) {
        var opts = Object.keys(DEVICE_COLORS).map(function (k) {
          return '<option value="' + k + '"' + (d.cor === k ? ' selected' : '') + '>' + DEVICE_COLORS[k].name + '</option>';
        }).join('');
        var sid = 'sel-' + Math.random().toString(36).slice(2, 9);
        h += '<div class="dev-row">' +
          field('Descrição', 'data-dev="' + i + '" data-df="desc" data-id="' + id + '" type="text" placeholder="BMCM ARMCO D=2,00m (30m)"', d.desc) +
          field('KM', 'data-dev="' + i + '" data-df="km" data-id="' + id + '" type="text" inputmode="decimal"', fmtKm(d.km)) +
          '<div class="field"><label for="' + sid + '">Cor</label><select id="' + sid + '" data-dev="' + i + '" data-df="cor" data-id="' + id + '">' + opts + '</select></div>' +
          '<button type="button" class="icon-btn" data-act="del-dev" data-id="' + id + '" data-idx="' + i + '" aria-label="Remover dispositivo">' + ICON_TRASH + '</button></div>';
      });

      var tid = 'obs-' + id;
      h += '<div class="field"><label for="' + tid + '">Observações gerais</label><textarea id="' + tid + '" data-p="obs" data-id="' + id + '" rows="4">' + esc(p.obs) + '</textarea></div>';
      h += '<div class="pt-foot"><button type="button" class="btn small" data-act="dup-point" data-id="' + id + '">Duplicar ponto</button><button type="button" class="btn small danger" data-act="del-point" data-id="' + id + '">Excluir ponto</button></div>';
      h += '</div>';
    }
    return h + '</article>';
  }

  function refreshPointHead(p) {
    var art = document.querySelector('.pt[data-id="' + CSS.escape(p.id) + '"] .pt-head');
    if (art) art.innerHTML = pointHead(p);
    var art2 = document.querySelector('.pt[data-id="' + CSS.escape(p.id) + '"] input[readonly]');
    if (art2) { var len = pointLen(p); art2.value = len != null ? fmt(len, 2) + ' km' : ''; }
  }
  function rerenderPoint(p) {
    var art = document.querySelector('.pt[data-id="' + CSS.escape(p.id) + '"]');
    if (art) art.outerHTML = pointCard(p);
    lockEditor();
  }

  // ------------------------------------------------------------------ interface: pré-visualização
  var previewTimer = null, viewer = null;
  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPreview, 120);
  }
  // lista do seletor "Páginas": automático (padrão do contrato) ou de 1 folha até 1 ponto por folha
  var pagesCtlSig = '';
  function renderPagesCtl(c) {
    var sel = $('selPages'), n = c ? c.pontos.length : 0;
    if (!sel) return;
    var auto = c ? autoPages(c, n) : 1, cur = c && pagesPref[c.id] ? pageCountFor(c, n) : 0;
    var sig = [c ? c.id : '', n, auto, cur].join('|');
    if (sig === pagesCtlSig) return; // não refaz a lista à toa (fecharia o seletor aberto no celular)
    pagesCtlSig = sig;
    if (!c || n < 2) { sel.innerHTML = '<option value="0">Automático</option>'; sel.disabled = true; return; }
    var h = ['<option value="0"' + (cur ? '' : ' selected') + '>Automático (' + auto + (auto === 1 ? ' página' : ' páginas') + ')</option>'];
    for (var p = minPages(n); p <= n; p++) {
      var per = Math.ceil(n / p);
      h.push('<option value="' + p + '"' + (cur === p ? ' selected' : '') + '>' + p + (p === 1 ? ' página' : ' páginas') + ' · ' + per + (per === 1 ? ' ponto' : ' pontos') + ' por página</option>');
    }
    sel.innerHTML = h.join('');
    sel.disabled = false;
  }
  function onPagesChange() {
    var c = active();
    if (!c) return;
    setPagesPref(c.id, parseInt($('selPages').value, 10) || 0);
    renderPreview();
  }

  // ------------------------------------------------------------------ mapa (SNV)
  var VIEW_KEY = 'diagrama-linear.vista';
  var view = (function () { try { return localStorage.getItem(VIEW_KEY) === 'mapa' ? 'mapa' : 'diagrama'; } catch (e) { return 'diagrama'; } })();
  var mapa = null;
  var NO_STATUS = { name: 'Sem atividade', fill: '#7A8580' };
  // cor e situação de um ponto no mapa: concluído, parado, ativo ou sem atividade
  function pointInfo(p) {
    var pct = pointPct(p), sts = SERVICES.map(function (k) { return (p.serv[k.key] || {}).st; });
    var key = pct >= 100 ? 'OK' : sts.indexOf('P') >= 0 ? 'P' : sts.indexOf('A') >= 0 ? 'A' : null;
    var st = key ? STATUS[key] : NO_STATUS;
    return {
      color: st.fill, status: st.name, pctText: fmtPct(pct),
      servs: SERVICES.filter(function (k) { var s = p.serv[k.key]; return s && s.st !== 'NA'; }).map(function (k) {
        var s = p.serv[k.key];
        return { label: k.label, color: STATUS[s.st].fill, text: STATUS[s.st].name + (s.st === 'OK' ? '' : ' · ' + fmtPct(svcPct(s))) };
      })
    };
  }
  // iPhone/iPad: o download comum não chega à galeria; a folha de compartilhar tem "Salvar imagem" e "Salvar em Arquivos"
  function isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  function canShareFile(f) { try { return !!(navigator.canShare && navigator.canShare({ files: [f] })); } catch (e) { return false; } }
  function downloadLink(name, blob) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  // app iOS (Capacitor): grava no cache do app e abre a folha de compartilhar nativa (Salvar Imagem / Salvar em Arquivos)
  function isNativeApp() { var C = window.Capacitor; return !!(C && C.isNativePlatform && C.isNativePlatform()); }
  function nativeSave(name, blob) {
    var P = window.Capacitor && window.Capacitor.Plugins;
    if (!isNativeApp() || !P || !P.Filesystem || !P.Share) return null;
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(',')[1]); };
      r.onerror = function () { reject(r.error); };
      r.readAsDataURL(blob);
    }).then(function (b64) {
      return P.Filesystem.writeFile({ path: name, data: b64, directory: 'CACHE' });
    }).then(function (res) {
      return P.Share.share({ title: name, files: [res.uri] });
    });
  }
  function saveBlob(name, blob, msg) {
    var nat = nativeSave(name, blob);
    if (nat) {
      return nat.then(function () { toast(msg || ('Arquivo pronto: ' + name)); }, function (err) {
        if (err && /cancel/i.test(err.message || String(err))) return;
        toast('Não foi possível salvar o arquivo: ' + ((err && err.message) || err));
      });
    }
    var file = isIOS() && typeof File === 'function' ? new File([blob], name, { type: blob.type || 'application/octet-stream' }) : null;
    if (file && canShareFile(file)) {
      return navigator.share({ files: [file], title: name }).then(function () { toast(msg || ('Arquivo pronto: ' + name)); }, function (err) {
        if (err && err.name === 'AbortError') return;
        offerShare(file);   // o iPhone só abre o compartilhar logo depois de um toque
      });
    }
    downloadLink(name, blob);
    toast(msg || ('Arquivo salvo: ' + name));
    return Promise.resolve();
  }
  function offerShare(file) {
    var old = document.getElementById('shareReady');
    if (old) old.remove();
    var bar = document.createElement('div');
    bar.id = 'shareReady';
    bar.className = 'share-ready';
    bar.setAttribute('role', 'status');
    bar.innerHTML = '<span></span><button type="button" class="btn primary">Salvar / compartilhar</button><button type="button" class="btn" aria-label="Fechar">×</button>';
    bar.querySelector('span').textContent = 'Arquivo pronto: ' + file.name;
    var b = bar.querySelectorAll('button');
    b[0].addEventListener('click', function () {
      navigator.share({ files: [file], title: file.name }).then(function () { bar.remove(); }, function (err) {
        if (err && err.name === 'AbortError') return;
        bar.remove();
        downloadLink(file.name, file);
      });
    });
    b[1].addEventListener('click', function () { bar.remove(); });
    (document.fullscreenElement || document.body).appendChild(bar);
  }
  // no Safari do iPhone não há botão de instalar: mostra o caminho uma vez
  function installHint() {
    var standalone = navigator.standalone || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    if (!isIOS() || standalone || location.protocol !== 'https:') return;
    try { if (localStorage.getItem('diagrama-linear.dica-instalar')) return; } catch (e) { return; }
    var bar = document.createElement('div');
    bar.className = 'share-ready';
    bar.setAttribute('role', 'note');
    bar.innerHTML = '<span>Para instalar no iPhone: toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>.</span><button type="button" class="btn" aria-label="Fechar">×</button>';
    bar.querySelector('button').addEventListener('click', function () {
      bar.remove();
      try { localStorage.setItem('diagrama-linear.dica-instalar', '1'); } catch (e) { /* sem armazenamento */ }
    });
    document.body.appendChild(bar);
  }
  function saveText(name, text, mime) { return saveBlob(name, new Blob([text], { type: mime || 'text/plain' })); }
  var foto = null;
  function openFoto(pid) {
    if (!foto && window.FotoCarimbo) {
      foto = window.FotoCarimbo({
        snv: window.SNV_BR230, getContract: active, logoSrc: window.UNIFILAR_LOGO && window.UNIFILAR_LOGO.src,
        getContracts: function () { return state.contracts; },
        setActiveContract: function (id) {
          if (state.activeId === id || !state.contracts.some(function (c) { return c.id === id; })) return;
          state.activeId = id; ui.open = {}; save(); renderAll();
        },
        gps: true, share: !!navigator.canShare, saveBlob: saveBlob, notify: function (m) { toast(m); },
        getTeamLogo: function () { return (banco.on && banco.cfg.fotoLogo) || null; },
        canSetTeamLogo: function () { return banco.on && isResp(); },
        setTeamLogo: function (v) { return saveTeamLogo({ t: 'config', chave: 'fotoLogo', valor: v }); },
        clearTeamLogo: function () { return saveTeamLogo({ t: 'apagar_config', chave: 'fotoLogo' }); }
      });
    }
    if (foto) foto.open({ pointId: pid || '' });
  }
  function ensureMap() {
    if (mapa || !window.MapaSNV) return mapa;
    mapa = window.MapaSNV({
      host: $('mapHost'), snv: window.SNV_BR230, getContract: active, pointInfo: pointInfo,
      saveText: saveText, tiles: true, gps: true, notify: function (m) { toast(m); }, onPhoto: openFoto
    });
    return mapa;
  }
  function setView(v) {
    view = v === 'mapa' && window.MapaSNV && window.L && window.SNV_BR230 ? 'mapa' : 'diagrama';
    try { localStorage.setItem(VIEW_KEY, view); } catch (e) { /* sem armazenamento */ }
    var isMap = view === 'mapa';
    $('viewDiagrama').setAttribute('aria-pressed', String(!isMap));
    $('viewMapa').setAttribute('aria-pressed', String(isMap));
    $('pages').hidden = isMap;
    $('mapHost').hidden = !isMap;
    $('selPages').closest('label').hidden = isMap;
    $('btnWide').textContent = ui.wide ? 'Mostrar editor' : (isMap ? 'Ampliar mapa' : 'Ampliar diagrama');
    if (isMap && ensureMap()) { mapa.render(); mapa.show(); }
    renderPreview();
  }
  function renderPreview() {
    var c = active(), tot = totals(c);
    if (view === 'mapa' && mapa) {
      mapa.render();
      $('previewMeta').textContent = 'Mapa pelo SNV/DNIT ' + window.SNV_BR230.versao + ' · ' + tot.n + ' pontos · avanço médio ' + fmtPct(tot.avg);
      return;
    }
    var sheets = renderSheets(c);
    renderPagesCtl(c);
    $('pages').innerHTML = sheets.map(function (svg, i) {
      return '<div class="sheet" aria-label="Página ' + (i + 1) + '">' + svg + '</div>';
    }).join('');
    $('previewMeta').textContent = sheets.length + (sheets.length === 1 ? ' página' : ' páginas') + ' · A3 paisagem · ' + tot.n + ' pontos · avanço médio ' + fmtPct(tot.avg);
    if (viewer && viewer.isOpen()) viewer.update(sheets);
  }

  function renderAll() {
    renderTabs();
    renderEditor();
    renderPreview();
  }

  // ------------------------------------------------------------------ eventos do editor
  function onInput(e) {
    var t = e.target, c = active();
    if (t.dataset.c) {
      var k = t.dataset.c;
      if (t.dataset.num) c[k] = parseNum(t.value);
      else if (t.dataset.int) c[k] = clamp(parseInt(t.value, 10) || 9, 1, 14);
      else c[k] = t.value;
      if (k === 'numero' || k === 'lote') renderTabs();
    } else if (t.dataset.marco != null && t.dataset.mf) {
      var m = c.marcos[Number(t.dataset.marco)];
      if (m) m[t.dataset.mf] = t.dataset.mf === 'km' ? parseNum(t.value) : t.value;
    } else if (t.dataset.p) {
      var p = findPoint(t.dataset.id);
      if (!p) return;
      p[t.dataset.p] = t.dataset.num ? parseNum(t.value) : t.value;
      refreshPointHead(p);
    } else if (t.dataset.svcpct) {
      var p2 = findPoint(t.dataset.id);
      if (!p2) return;
      p2.serv[t.dataset.svcpct].pct = clamp(Number(t.value) || 0, 0, 100);
      refreshPointHead(p2);
    } else if (t.dataset.dev != null && t.dataset.df) {
      var p3 = findPoint(t.dataset.id);
      if (!p3) return;
      var d = p3.disp[Number(t.dataset.dev)];
      if (d) d[t.dataset.df] = t.dataset.df === 'km' ? parseNum(t.value) : t.value;
    } else {
      return;
    }
    save();
    schedulePreview();
  }

  function onClick(e) {
    var tab = e.target.closest('[data-tab]');
    if (tab) {
      state.activeId = tab.dataset.tab;
      ui.open = {};
      save();
      renderAll();
      return;
    }
    var b = e.target.closest('[data-act]');
    if (!b) return;
    var act = b.dataset.act, c = active(), p;
    if (act === 'login') { openLogin(); return; }
    if (readOnly() && EDIT_ACTS.indexOf(act) >= 0) { toast('Para editar, entre com o código da equipe.'); openLogin(); return; }
    switch (act) {
      case 'toggle-contract':
        ui.contractOpen = !ui.contractOpen;
        renderEditor();
        return;
      case 'toggle-point':
        ui.open[b.dataset.id] = !ui.open[b.dataset.id];
        p = findPoint(b.dataset.id);
        // ao fechar, a lista volta a ser ordenada por KM
        if (!ui.open[b.dataset.id]) renderEditor();
        else if (p) rerenderPoint(p);
        return;
      case 'set-st':
        p = findPoint(b.dataset.id);
        if (!p) return;
        var sv = p.serv[b.dataset.svc], st = b.dataset.st;
        if (st === 'OK') sv.pct = 100;
        else if (st === 'NA') sv.pct = 0;
        else if (sv.st === 'OK' || sv.st === 'NA') sv.pct = st === 'A' ? 50 : 0;
        sv.st = st;
        rerenderPoint(p);
        break;
      case 'add-point':
        var pts = sortedPoints(c), last = pts[pts.length - 1];
        var base = last && last.kmFim != null ? Math.round((last.kmFim + 1) * 100) / 100 : null;
        var serv = {};
        SERVICES.forEach(function (s) { serv[s.key] = { st: 'P', pct: 0 }; });
        p = { id: uid('pt'), nome: 'P' + (c.pontos.length + 1), kmIni: base, kmFim: base != null ? base + 1 : null, enr: null, sb: null, serv: serv, disp: [], obs: '' };
        c.pontos.push(p);
        ui.open = {}; ui.open[p.id] = true;
        renderEditor();
        scrollToPoint(p.id);
        break;
      case 'dup-point':
        p = findPoint(b.dataset.id);
        if (!p) return;
        var cp = clone(p);
        cp.id = uid('pt');
        cp.nome = (p.nome || 'P') + ' (cópia)';
        c.pontos.push(cp);
        ui.open = {}; ui.open[cp.id] = true;
        renderEditor();
        scrollToPoint(cp.id);
        break;
      case 'del-point':
        p = findPoint(b.dataset.id);
        if (!p || !confirm('Excluir o ponto ' + (p.nome || '') + '? Isso não pode ser desfeito (a não ser por um backup).')) return;
        c.pontos = c.pontos.filter(function (x) { return x.id !== p.id; });
        renderEditor();
        break;
      case 'add-dev':
        p = findPoint(b.dataset.id);
        if (!p) return;
        p.disp.push({ desc: '', km: p.kmIni != null && p.kmFim != null ? Math.round((p.kmIni + p.kmFim) / 2 * 100) / 100 : null, cor: 'vermelho' });
        rerenderPoint(p);
        break;
      case 'del-dev':
        p = findPoint(b.dataset.id);
        if (!p) return;
        p.disp.splice(Number(b.dataset.idx), 1);
        rerenderPoint(p);
        break;
      case 'add-marco':
        c.marcos.push({ nome: '', km: null });
        renderEditor();
        break;
      case 'del-marco':
        c.marcos.splice(Number(b.dataset.idx), 1);
        renderEditor();
        break;
      case 'new-contract':
        var ref = active();
        var nc = {
          id: uid('ct'), orgao: ref ? ref.orgao : '', numero: '', lote: 'Lote ' + String(state.contracts.length + 1).padStart(2, '0'),
          rodovia: ref ? ref.rodovia : '', objeto: ref ? ref.objeto : '', executora: '', supervisora: ref ? ref.supervisora : '',
          ctSupervisao: ref ? ref.ctSupervisao : '', extensaoContrato: null, origem: '', destino: '', kmIni: null, kmFim: null,
          plataforma: ref ? ref.plataforma : '', dataVistoria: todayIso(), porPagina: 9, marcos: [], pontos: []
        };
        state.contracts.push(nc);
        state.activeId = nc.id;
        ui.contractOpen = true; ui.open = {};
        renderAll();
        break;
      case 'del-contract':
        if (state.contracts.length < 2) { toast('Este é o único contrato. Crie outro antes de excluir este.'); return; }
        if (!confirm('Excluir o contrato ' + (c.lote || '') + ' ' + (c.numero || '') + ' com todos os pontos?')) return;
        state.contracts = state.contracts.filter(function (x) { return x.id !== c.id; });
        state.activeId = state.contracts[0].id;
        renderAll();
        break;
      default:
        return;
    }
    save();
    schedulePreview();
  }

  function scrollToPoint(id) {
    var el = document.querySelector('.pt[data-id="' + CSS.escape(id) + '"]');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // clique no desenho abre o ponto no editor
  function onPreviewClick(e) {
    var g = e.target.closest('[data-pid]');
    if (!g) return;
    var id = g.getAttribute('data-pid');
    if (ui.wide) toggleWide(false);
    ui.open = {}; ui.open[id] = true;
    renderEditor();
    scrollToPoint(id);
  }

  function toggleWide(force) {
    ui.wide = typeof force === 'boolean' ? force : !ui.wide;
    $('layout').classList.toggle('wide', ui.wide);
    $('btnWide').setAttribute('aria-pressed', String(ui.wide));
    $('btnWide').textContent = ui.wide ? 'Mostrar editor' : (view === 'mapa' ? 'Ampliar mapa' : 'Ampliar diagrama');
    if (mapa) mapa.show();
  }

  // ------------------------------------------------------------------ PDF
  function loadScript(urls) {
    return urls.reduce(function (prev, url) {
      return prev.catch(function () {
        return new Promise(function (resolve, reject) {
          var s = document.createElement('script');
          s.src = url;
          s.onload = resolve;
          s.onerror = function () { s.remove(); reject(new Error('Falha ao carregar ' + url)); };
          document.head.appendChild(s);
        });
      });
    }, Promise.reject(new Error('início')));
  }
  function ensureLibs() {
    var p = Promise.resolve();
    // no app iOS as bibliotecas do PDF vêm junto (lib/), para gerar o PDF sem internet
    var local = isNativeApp();
    if (!(window.jspdf && window.jspdf.jsPDF)) p = p.then(function () { return loadScript((local ? ['lib/jspdf.umd.min.js'] : []).concat(LIBS.jspdf)); });
    return p.then(function () {
      if (!(window.svg2pdf && window.svg2pdf.svg2pdf)) return loadScript((local ? ['lib/svg2pdf.umd.min.js'] : []).concat(LIBS.svg2pdf));
    });
  }
  function buildPdf(c) {
    c = c || active();
    return ensureLibs().then(function () {
      var JsPDF = window.jspdf.jsPDF;
      var doc = new JsPDF({ orientation: 'landscape', unit: 'pt', format: 'a3', compress: true });
      doc.setProperties({
        title: 'Diagrama linear - Obra ' + (c.numero || ''),
        subject: [c.lote, c.rodovia].filter(Boolean).join(' - '),
        author: c.supervisora || '',
        creator: 'Diagrama linear dos pontos críticos'
      });
      var sheets = renderSheets(c), host = $('pdfHost');
      var chain = Promise.resolve();
      sheets.forEach(function (svg, i) {
        chain = chain.then(function () {
          if (i > 0) doc.addPage('a3', 'landscape');
          host.innerHTML = svg;
          return window.svg2pdf.svg2pdf(host.querySelector('svg'), doc, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });
        });
      });
      return chain.then(function () { host.innerHTML = ''; return doc; });
    });
  }
  function pdfName(c) {
    var name = 'Diagrama linear - ' + [c.lote, c.numero ? 'CT ' + c.numero : ''].filter(Boolean).join(' - ') + ' - ' + todayIso() + '.pdf';
    return name.replace(/[\\/:*?"<>|]/g, '-');
  }
  function exportPdf() {
    var btn = $('btnPdf'), c = active(), old = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = 'Gerando PDF…';
    buildPdf(c).then(function (doc) {
      return saveBlob(pdfName(c), doc.output('blob'), 'PDF gerado: ' + pdfName(c));
    }).catch(function (err) {
      console.error(err);
      toast('Não consegui gerar o PDF direto (sem internet?). Abrindo a impressão: escolha "Salvar como PDF".', 6000);
      setTimeout(printSheets, 600);
    }).then(function () {
      btn.disabled = false;
      btn.innerHTML = old;
    });
  }
  function printSheets() {
    var sheets = renderSheets(active());
    $('printArea').innerHTML = sheets.map(function (s) { return '<div class="print-sheet">' + s + '</div>'; }).join('');
    setTimeout(function () { window.print(); }, 50);
  }

  // ------------------------------------------------------------------ backup
  function downloadBackup() {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    var name = 'backup-diagrama-linear-' + todayIso() + '.json';
    saveBlob(name, blob, isIOS() ? 'Backup pronto: ' + name : 'Backup salvo na pasta de downloads.');
  }
  function openBackup(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var s = JSON.parse(reader.result);
        if (!validState(s)) throw new Error('formato');
        if (!confirm(banco.on
          ? 'Substituir os dados do banco da equipe pelos do backup "' + file.name + '"? Todos vão passar a ver os dados do backup (a troca fica no histórico).'
          : 'Substituir os dados atuais pelos do backup "' + file.name + '"?')) return;
        s = normalize(s);
        s.activeId = s.contracts.some(function (c) { return c.id === state.activeId; }) ? state.activeId : s.activeId;
        state = s;
        ui.open = {};
        save();
        renderAll();
        toast(banco.on ? 'Backup carregado. Enviando ao banco da equipe…' : 'Backup carregado.');
      } catch (e) {
        toast('Esse arquivo não é um backup válido deste site.');
      }
    };
    reader.readAsText(file);
  }

  // ------------------------------------------------------------------ menu
  function closeMenu() { $('menuPop').hidden = true; $('btnMenu').setAttribute('aria-expanded', 'false'); }
  function onMenu(e) {
    var b = e.target.closest('[data-act]');
    if (!b) return;
    closeMenu();
    var act = b.dataset.act;
    if (act === 'backup') downloadBackup();
    else if (act === 'restore') {
      if (banco.on && !isResp()) { toast('Só o responsável pode trocar os dados da equipe por um backup.', 5000); if (!banco.login) openLogin(); return; }
      $('fileInput').click();
    }
    else if (act === 'print') printSheets();
    else if (act === 'reset') {
      if (!confirm('Apagar as alterações deste navegador e voltar aos dados iniciais da planilha? Faça um backup antes, se precisar.')) return;
      state = normalize(clone(window.UNIFILAR_SEED));
      ui.open = {};
      save();
      renderAll();
      toast('Dados iniciais restaurados.');
    }
  }

  // ------------------------------------------------------------------ banco compartilhado (Supabase, banco.js)
  // Todos veem os mesmos dados; edita quem entrou com o código da equipe. Cada alteração vira uma operação numa fila
  // guardada no aparelho, que sobe ao banco assim que houver sinal. Os aparelhos conferem a versão do banco a cada 20 s.
  var SYNC_KEY = 'diagrama-linear.banco';           // {versao, pend, cfg}
  var LOGIN_KEY = 'diagrama-linear.acesso';         // {codigo, nome, papel} deste aparelho
  var NAME_KEY = 'diagrama-linear.nome';
  var OLD_KEY = 'diagrama-linear.antes-do-banco';   // o que estava só neste aparelho antes do banco da equipe
  var banco = { on: !!window.Banco, versao: 0, pend: [], cfg: {}, meta: {}, conf: [], base: null, login: null, online: null, busy: false, sending: 0, at: null, want: false };
  var flushTimer = null;

  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function lsPut(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } }
  function keepSync() { lsPut(SYNC_KEY, { versao: banco.versao, pend: banco.pend, cfg: banco.cfg, meta: banco.meta, conf: banco.conf }); }
  function readOnly() { return banco.on && !banco.login; }
  function isResp() { return !!(banco.login && banco.login.papel === 'responsavel'); }

  function contractFields(c) { var o = {}; Object.keys(c).forEach(function (k) { if (k !== 'id' && k !== 'pontos') o[k] = c[k]; }); return o; }
  function pointFields(p) { var o = {}; Object.keys(p).forEach(function (k) { if (k !== 'id') o[k] = p[k]; }); return o; }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  // Campos, como o banco conta: cada dado do contrato/ponto; nos pontos, cada serviço é um campo ("serv.aterro").
  // Só os campos alterados sobem, com a hora da alteração. Se duas pessoas alteraram o mesmo campo,
  // o banco fica com o valor de quem alterou por último e avisa quem enviou.
  function units(o, isPoint) {
    var u = {};
    Object.keys(o || {}).forEach(function (k) {
      if (isPoint && k === 'serv' && o.serv && typeof o.serv === 'object' && !Array.isArray(o.serv)) {
        Object.keys(o.serv).forEach(function (s) { u['serv.' + s] = o.serv[s]; });
      } else u[k] = o[k];
    });
    return u;
  }
  function setField(o, k, has, v) {
    var p = k.split('.');
    if (p.length === 2) {
      if (!o[p[0]] || typeof o[p[0]] !== 'object') { if (!has) return; o[p[0]] = {}; }
      if (has) o[p[0]][p[1]] = v === undefined ? null : clone(v); else delete o[p[0]][p[1]];
    } else if (has) o[k] = v === undefined ? null : clone(v);
    else delete o[k];
  }
  function applyFields(o, campos) {
    Object.keys(campos || {}).forEach(function (k) { setField(o, k, 'v' in campos[k], campos[k].v); });
  }
  // {campo: {v: novo valor (sem v = apagado), a: valor de antes (sem a = não existia), em: hora}}
  function fieldDiff(a, b, isPoint, em) {
    var ua = units(a, isPoint), ub = units(b, isPoint), c = {}, n = 0;
    function has(u, k) { return Object.prototype.hasOwnProperty.call(u, k) && u[k] !== undefined; }
    Object.keys(ub).forEach(function (k) {
      if (!has(ub, k) || (has(ua, k) && same(ua[k], ub[k]))) return;
      c[k] = { v: ub[k], em: em };
      if (has(ua, k)) c[k].a = ua[k];
      n++;
    });
    Object.keys(ua).forEach(function (k) { if (has(ua, k) && !has(ub, k)) { c[k] = { a: ua[k], em: em }; n++; } });
    return n ? c : null;
  }
  // operações que levam o estado `a` ao estado `b`
  function diffOps(a, b, em) {
    var ops = [], am = {}, bm = {};
    em = em || new Date().toISOString();
    a.contracts.forEach(function (c, i) { am[c.id] = { c: c, i: i }; });
    b.contracts.forEach(function (c, i) {
      var o = am[c.id], old = {};
      bm[c.id] = true;
      if (!o) ops.push({ t: 'contrato', id: c.id, ordem: i, dados: contractFields(c), em: em });
      else {
        var cf = fieldDiff(contractFields(o.c), contractFields(c), false, em);
        if (cf || o.i !== i) {
          var co = { t: 'contrato_campos', id: c.id, nome: c.lote || c.numero || '', campos: cf || {} };
          if (o.i !== i) co.ordem = i;
          ops.push(co);
        }
        o.c.pontos.forEach(function (p) { old[p.id] = p; });
      }
      c.pontos.forEach(function (p) {
        if (!old[p.id]) ops.push({ t: 'ponto', cid: c.id, id: p.id, dados: pointFields(p), em: em });
        else {
          var pf = fieldDiff(pointFields(old[p.id]), pointFields(p), true, em);
          if (pf) ops.push({ t: 'ponto_campos', cid: c.id, id: p.id, nome: p.nome || '', campos: pf });
        }
        delete old[p.id];
      });
      Object.keys(old).forEach(function (id) { ops.push({ t: 'apagar_ponto', cid: c.id, id: id, nome: old[id].nome || '', em: em }); });
    });
    a.contracts.forEach(function (c) { if (!bm[c.id]) ops.push({ t: 'apagar_contrato', id: c.id }); });
    return ops;
  }
  // aplica as operações ainda não enviadas sobre o que veio do banco
  function applyOps(s, ops) {
    ops.forEach(function (op) {
      var c = s.contracts.find(function (x) { return x.id === (op.cid || op.id); }), p;
      if (op.t === 'contrato') {
        var nc = clone(op.dados);
        nc.id = op.id; nc.pontos = c ? c.pontos : [];
        if (c) s.contracts.splice(s.contracts.indexOf(c), 1);
        s.contracts.splice(Math.min(op.ordem || 0, s.contracts.length), 0, nc);
      } else if (op.t === 'contrato_campos' && c) {
        applyFields(c, op.campos);
        if (op.ordem != null) { s.contracts.splice(s.contracts.indexOf(c), 1); s.contracts.splice(Math.min(op.ordem, s.contracts.length), 0, c); }
      } else if (op.t === 'apagar_contrato') {
        if (c) s.contracts.splice(s.contracts.indexOf(c), 1);
      } else if (op.t === 'ponto' && c) {
        var np = clone(op.dados), k = c.pontos.findIndex(function (x) { return x.id === op.id; });
        np.id = op.id;
        if (k >= 0) c.pontos[k] = np; else c.pontos.push(np);
      } else if (op.t === 'ponto_campos' && c) {
        p = c.pontos.find(function (x) { return x.id === op.id; });
        if (p) applyFields(p, op.campos);   // se outra pessoa excluiu o ponto, não volta
      } else if (op.t === 'apagar_ponto' && c) {
        c.pontos = c.pontos.filter(function (x) { return x.id !== op.id; });
      }
    });
    return s;
  }
  function opKey(op) {
    if (/^(ponto|ponto_campos|apagar_ponto)$/.test(op.t)) return 'p:' + op.cid + ':' + op.id;
    if (op.t === 'config' || op.t === 'apagar_config') return 'g:' + op.chave;
    return 'c:' + op.id;
  }
  // junta uma alteração nova com a que ainda espera na fila para o mesmo ponto/contrato
  function mergeOp(old, op) {
    if (!/_campos$/.test(op.t)) return op;                        // exclusão, registro novo, configuração: vale a nova
    if (old.t === 'ponto' || old.t === 'contrato') {               // registro novo que ainda não subiu: continua completo
      var full = clone(old), em = null;
      applyFields(full.dados, op.campos);
      Object.keys(op.campos).forEach(function (k) { em = op.campos[k].em; });
      if (em) full.em = em;
      if (op.ordem != null) full.ordem = op.ordem;
      return full;
    }
    if (old.t !== op.t) return old;
    var m = clone(old);
    m.nome = op.nome || m.nome;
    Object.keys(op.campos).forEach(function (k) {
      var nf = op.campos[k], of = m.campos[k], f = { em: nf.em };
      if ('v' in nf) f.v = nf.v;
      if (of) { if ('a' in of) f.a = of.a; } else if ('a' in nf) f.a = nf.a;   // "antes" é o da primeira alteração
      if (of && ('a' in f) === ('v' in f) && (!('v' in f) || same(f.a, f.v))) delete m.campos[k];   // voltou ao que era
      else m.campos[k] = f;
    });
    if (op.ordem != null) m.ordem = op.ordem;
    return Object.keys(m.campos).length || m.ordem != null ? m : null;
  }
  // a fila guarda uma operação por ponto/contrato; as que já estão a caminho do banco ficam como estão
  function enqueue(ops) {
    ops.forEach(function (op) {
      var sent = banco.pend.slice(0, banco.sending), rest = banco.pend.slice(banco.sending);
      if (op.t === 'apagar_contrato') rest = rest.filter(function (x) { return x.cid !== op.id; });
      var k = opKey(op), i = rest.findIndex(function (x) { return opKey(x) === k; });
      if (i < 0) rest.push(op);
      else { var m = mergeOp(rest[i], op); if (m) rest[i] = m; else rest.splice(i, 1); }
      banco.pend = sent.concat(rest);
    });
    keepSync();
  }
  var FIELD_NAMES = {
    nome: 'nome', kmIni: 'KM inicial', kmFim: 'KM final', enr: 'enrocamento (m³)', sb: 'solo-brita (m³)', obs: 'observações', disp: 'dispositivos',
    numero: 'nº do contrato', lote: 'lote', executora: 'executora', supervisora: 'supervisora', ctSupervisao: 'contrato da supervisora',
    orgao: 'órgão', rodovia: 'rodovia', objeto: 'objeto', extensaoContrato: 'extensão do contrato', origem: 'sentido (de)', destino: 'sentido (para)',
    plataforma: 'largura da plataforma', dataVistoria: 'data da vistoria', porPagina: 'pontos por página', marcos: 'marcos'
  };
  function fieldName(k) {
    if (k.indexOf('serv.') === 0) { var s = SERVICES.find(function (x) { return x.key === k.slice(5); }); return s ? s.short : k.slice(5); }
    return FIELD_NAMES[k] || k;
  }
  function loteOf(cid) { var c = state.contracts.find(function (x) { return x.id === cid; }); return c ? (c.lote || c.numero || 'Contrato') : 'Contrato'; }
  // texto curto do que mudou, para o histórico
  function opsResumo(ops) {
    var names = [];
    ops.forEach(function (op) {
      var t, f = op.campos ? Object.keys(op.campos).map(fieldName).join(', ') : '';
      if (op.t === 'ponto_campos') t = loteOf(op.cid) + ' ' + (op.nome || 'ponto') + (f ? ': ' + f : '');
      else if (op.t === 'ponto') t = loteOf(op.cid) + ' ' + (op.dados.nome || 'ponto') + ' (novo ponto)';
      else if (op.t === 'apagar_ponto') t = loteOf(op.cid) + ' ' + (op.nome || '') + ': ponto excluído';
      else if (op.t === 'contrato_campos') t = (op.nome || 'Contrato') + ': ' + (f || 'ordem das abas');
      else if (op.t === 'contrato') t = (op.dados.lote || 'Contrato') + ' (novo contrato)';
      else if (op.t === 'apagar_contrato') t = 'Contrato excluído';
      else t = 'Configuração';
      if (names.indexOf(t) < 0) names.push(t);
    });
    return names.slice(0, 8).join('; ') + (names.length > 8 ? ' e mais ' + (names.length - 8) : '');
  }

  // ---------------- quem alterou por último (por campo, como veio do banco)
  function metaKey(cid, id) { return id == null ? 'c:' + cid : 'p:' + cid + ':' + id; }
  function metaOf(key) { return banco.meta[key] || (banco.meta[key] = { m: {}, por: null, em: null }); }
  function lastChange(key) {
    var x = banco.meta[key];
    if (!x) return null;
    var best = null;
    Object.keys(x.m || {}).forEach(function (k) {
      var f = x.m[k], t = Date.parse(f && f.em);
      if (isFinite(t) && (!best || t > best.t)) best = { t: t, por: f.por, em: f.em };
    });
    if (!best) return x.por ? { por: x.por, em: x.em, campos: [] } : null;
    var campos = Object.keys(x.m).filter(function (k) {
      var f = x.m[k];
      return f.por === best.por && best.t - Date.parse(f.em) < 3 * 60000;
    });
    return { por: best.por, em: best.em, campos: campos };
  }
  function fmtWhen(iso, secs) {
    var d = new Date(iso);
    if (!isFinite(d)) return '';
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + ' às ' + hhmm(d) + (secs ? ':' + String(d.getSeconds()).padStart(2, '0') : '');
  }
  function lastHtml(key) {
    var l = banco.on && lastChange(key);
    if (!l) return '';
    var f = l.campos.length && l.campos.length <= 4 ? ' · ' + esc(l.campos.map(fieldName).join(', ')) : '';
    return 'Última alteração: <b>' + esc(l.por || 'sem nome') + '</b> · ' + esc(fmtWhen(l.em)) + f;
  }
  function lastLine(key) {
    var h = lastHtml(key);
    return '<div class="last-edit" data-last="' + esc(key) + '"' + (h ? '' : ' hidden') + '>' + h + '</div>';
  }
  function refreshLastLines() {
    document.querySelectorAll('[data-last]').forEach(function (el) { var h = lastHtml(el.getAttribute('data-last')); el.innerHTML = h; el.hidden = !h; });
  }
  // depois de gravar: o que entrou passa a ter este aparelho como último a alterar
  function noteMeta(ops, conf) {
    var lost = {}, me = (banco.login && banco.login.nome) || null;
    conf.forEach(function (x) { if (x.tipo === 'perdeu') lost[metaKey(x.cid || x.id, x.alvo === 'ponto' ? x.id : null) + '|' + x.campo] = 1; });
    ops.forEach(function (op) {
      var isP = /ponto/.test(op.t), key = isP ? metaKey(op.cid, op.id) : metaKey(op.id), mm;
      if (/^apagar_/.test(op.t)) { if (!conf.length) delete banco.meta[key]; return; }
      if (op.campos) {
        mm = metaOf(key).m;
        Object.keys(op.campos).forEach(function (k) { if (!lost[key + '|' + k]) mm[k] = { por: me, em: op.campos[k].em }; });
      } else if (op.dados) {
        mm = metaOf(key).m;
        Object.keys(units(op.dados, isP)).forEach(function (k) { mm[k] = { por: me, em: op.em }; });
      }
    });
  }

  // ---------------- avisos de alterações que se cruzaram (ficam até a pessoa dispensar)
  function fmtValue(campo, v) {
    if (v == null || v === '') return '(vazio)';
    if (campo && campo.indexOf('serv.') === 0 && typeof v === 'object') {
      var st = STATUS[v.st] ? STATUS[v.st].name : (v.st || '?');
      return st + (v.st === 'A' || v.st === 'P' ? ' ' + (Number(v.pct) || 0) + '%' : '');
    }
    if (Array.isArray(v)) return v.length + (v.length === 1 ? ' item' : ' itens');
    if (typeof v === 'number') return fmt(v, v % 1 ? 2 : 0);
    var s = String(v);
    return '"' + (s.length > 60 ? s.slice(0, 57) + '…' : s) + '"';
  }
  function conflictText(x, autor) {
    var alvo = x.alvo === 'ponto' ? loteOf(x.cid) + ' ' + (x.nome || 'ponto') : (x.nome || 'Contrato');
    var secs = !!(x.em && x.seu_em && fmtWhen(x.em) === fmtWhen(x.seu_em));   // no mesmo minuto: mostra os segundos
    var campo = x.campo ? ' · ' + fieldName(x.campo) : '', quem = x.por || 'outra pessoa', quando = x.em ? ' (' + fmtWhen(x.em, secs) + ')' : '';
    var sua = autor ? 'a alteração de ' + autor : 'a sua alteração', seu = x.seu_em ? ' (' + fmtWhen(x.seu_em, secs) + ')' : '';
    if (x.tipo === 'perdeu') return alvo + campo + ': ficou o valor de ' + quem + ', que alterou depois' + quando + ': ' + fmtValue(x.campo, x.valor) + '. ' + sua.charAt(0).toUpperCase() + sua.slice(1) + seu + ' não entrou.';
    if (x.tipo === 'substituiu') return alvo + campo + ': ficou o ' + (autor ? 'valor de ' + autor : 'seu valor') + ', alterado por último' + seu + '. Substituiu o de ' + quem + quando + ': ' + fmtValue(x.campo, x.valor) + '.';
    if (x.tipo === 'nao_excluido') return alvo + ': não foi excluído, porque ' + quem + ' alterou o ponto depois' + quando + '.';
    if (x.tipo === 'excluido') return alvo + ': ' + (x.alvo === 'ponto' ? 'o ponto' : 'o contrato') + ' já tinha sido excluído por outra pessoa; ' + sua + ' nele não entrou.';
    return alvo + campo;
  }
  function showConflicts(list) {
    if (list) { banco.conf = banco.conf.concat(list).slice(-30); keepSync(); }
    var bar = $('confBar');
    if (!banco.conf.length) { if (bar) bar.remove(); return; }
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'confBar';
      bar.className = 'share-ready conf-bar';
      bar.setAttribute('role', 'status');
      (document.fullscreenElement || document.body).appendChild(bar);
    }
    bar.innerHTML = '<div class="conf-body"><b>Alterações que se cruzaram</b><span>Duas pessoas mexeram no mesmo campo: ficou o valor de quem alterou por último.</span><ul>' +
      banco.conf.map(function (x) { return '<li>' + esc(conflictText(x)) + '</li>'; }).join('') + '</ul></div>' +
      '<button type="button" class="btn primary">Entendi</button>';
    bar.querySelector('button').addEventListener('click', function () { banco.conf = []; keepSync(); bar.remove(); });
  }
  // chamada a cada alteração local (save): o que mudou desde a última vez entra na fila
  function trackChanges() {
    if (!banco.on || !banco.base) return;
    var ops = diffOps(banco.base, state);
    banco.base = clone(state);
    if (!ops.length) return;
    enqueue(ops);
    scheduleFlush(1200);
  }
  function scheduleFlush(ms) { clearTimeout(flushTimer); flushTimer = setTimeout(flush, ms || 0); syncStatus(); }
  function flush() {
    if (!banco.on || banco.busy || !banco.pend.length || !banco.login) { syncStatus(); return; }
    var ops = banco.pend.slice(0, 500), n = ops.length;
    banco.busy = true;
    banco.sending = n;
    syncStatus();
    window.Banco.salvarCampos(banco.login.codigo, banco.login.nome, opsResumo(ops), ops).then(function (res) {
      var v = Number(res && res.versao), conf = (res && res.conflitos) || [];
      banco.busy = false;
      banco.sending = 0;
      banco.online = true;
      banco.at = new Date();
      banco.pend.splice(0, n);
      noteMeta(ops, conf);
      if (conf.length) { showConflicts(conf); refresh(); }          // o banco ficou com outro valor em algum campo
      else if (v === banco.versao + 1) { banco.versao = v; refreshLastLines(); }
      else refresh();                                                // outra pessoa gravou no meio: recarrega
      keepSync();
      if (banco.pend.length) scheduleFlush(300);
      syncStatus();
    }, function (err) {
      banco.busy = false;
      banco.sending = 0;
      var code = err && err.code;
      if (code === 'sem_rede') { banco.online = false; syncStatus(); return; }
      if (code === 'codigo_invalido') { logout(true); toast('O código da equipe mudou. Entre de novo para enviar as alterações deste aparelho.', 7000); return; }
      if (code === 'muitas_tentativas') { toast('O banco bloqueou por muitas tentativas com código errado. Tente de novo em 10 minutos.', 7000); syncStatus(); return; }
      banco.pend.splice(0, n);   // o banco recusou os dados: descarta e volta ao que está lá
      keepSync();
      toast('O banco recusou uma alteração (' + ((err && err.message) || 'erro') + '). Os dados foram recarregados.', 7000);
      refresh();
    });
  }
  function typing() {
    var a = document.activeElement;
    return !!(a && a.closest && a.closest('#editor') && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
  }
  function fromServer(r) {
    var s = { activeId: state ? state.activeId : null, contracts: [] }, byId = {};
    banco.meta = {};
    r.contratos.forEach(function (row) {
      var c = clone(row.dados || {}); c.id = row.id; c.pontos = []; byId[c.id] = c; s.contracts.push(c);
      banco.meta[metaKey(row.id)] = { m: row.meta || {}, por: row.atualizado_por || null, em: row.atualizado_em || null };
    });
    r.pontos.forEach(function (row) {
      var c = byId[row.contrato_id];
      if (!c) return;
      var p = clone(row.dados || {}); p.id = row.id; c.pontos.push(p);
      banco.meta[metaKey(row.contrato_id, row.id)] = { m: row.meta || {}, por: row.atualizado_por || null, em: row.atualizado_em || null };
    });
    s.contracts.forEach(function (c) { c.pontos.sort(function (a, b) { return a.id.localeCompare(b.id, 'pt-BR', { numeric: true }); }); });
    return s;
  }
  // traz o banco (mais o que ainda não subiu deste aparelho); espera a pessoa parar de digitar
  function refresh(force) {
    if (!banco.on) return Promise.resolve();
    if (!force && typing()) { banco.want = true; return Promise.resolve(); }
    banco.want = false;
    return window.Banco.carregar().then(function (r) {
      if (!force && typing()) { banco.want = true; return; }
      banco.online = true;
      banco.at = new Date();
      banco.versao = r.versao;
      var cfg = {};
      r.config.forEach(function (x) { cfg[x.chave] = x.valor; });
      var logoMudou = !same(cfg.fotoLogo || null, banco.cfg.fotoLogo || null);
      banco.cfg = cfg;
      if (r.contratos.length) {
        if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
        trackChanges();   // o que acabou de ser mudado aqui entra na fila antes de trocar o estado
        state = normalize(applyOps(fromServer(r), banco.pend));
        banco.base = clone(state);
        try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* sem armazenamento */ }
        renderAll();
      }
      keepSync();
      if (logoMudou && foto) foto.refreshTeam();
      checkOld();
      syncStatus();
    }, function (err) {
      if (err && err.code === 'sem_rede') banco.online = false;
      syncStatus();
    });
  }
  function poll() {
    if (!banco.on || document.visibilityState === 'hidden') return;
    if (banco.pend.length && banco.login && !banco.busy) flush();
    window.Banco.versao().then(function (v) {
      banco.online = true;
      if (v !== banco.versao && !banco.busy) refresh(); else syncStatus();
    }, function () { banco.online = false; syncStatus(); });
  }
  function hhmm(d) { return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function syncStatus() {
    if (!banco.on) return;
    var el = $('saveState'), n = banco.pend.length, t, warn = false;
    if (banco.busy) t = 'Enviando ao banco…';
    else if (n && !banco.login) { t = n + (n === 1 ? ' alteração não enviada' : ' alterações não enviadas') + ': entre para enviar'; warn = true; }
    else if (n) { t = (banco.online === false ? 'Sem sinal · ' : '') + n + (n === 1 ? ' alteração aguardando' : ' alterações aguardando'); warn = banco.online === false; }
    else if (banco.online === false) { t = 'Sem sinal · cópia deste aparelho'; warn = true; }
    else if (banco.at) t = 'Banco da equipe · ' + hhmm(banco.at);
    else t = 'Conectando ao banco…';
    el.textContent = t;
    el.classList.toggle('warn', warn);
  }

  // ---------------- acesso: código da equipe (edita) e do responsável (também troca os códigos e a logo da equipe)
  function setLogin(l) {
    banco.login = l;
    lsPut(LOGIN_KEY, l);
    document.body.classList.toggle('ro', readOnly());
    renderLoginBtn();
  }
  function renderLoginBtn() {
    var b = $('btnLogin');
    if (!b) return;
    b.hidden = !banco.on;
    b.textContent = banco.login ? (banco.login.nome || 'Equipe') + ' · ' + (isResp() ? 'responsável' : 'equipe') : 'Entrar para editar';
    b.classList.toggle('primary', !banco.login);
  }
  function logout(silent) {
    setLogin(null);
    renderAll();
    syncStatus();
    if (!silent) toast('Você saiu. Este aparelho fica só para consulta.');
  }
  function modal(html, onSubmit) {
    closeModal();
    var m = document.createElement('div');
    m.className = 'modal';
    m.id = 'modal';
    m.innerHTML = '<form class="modal-box" role="dialog" aria-modal="true" aria-labelledby="modalTitle" novalidate>' + html + '</form>';
    (document.fullscreenElement || document.body).appendChild(m);
    var f = m.querySelector('form');
    f.addEventListener('submit', function (e) { e.preventDefault(); if (onSubmit) onSubmit(f); });
    m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('[data-close]')) closeModal(); });
    m.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
    f.addEventListener('change', function (e) {
      if (e.target.hasAttribute('data-showpw')) f.querySelectorAll('input[data-pw]').forEach(function (i) { i.type = e.target.checked ? 'text' : 'password'; });
    });
    setTimeout(function () { var x = f.querySelector('input:not([type=checkbox]),button[type=submit],button'); if (x) x.focus(); }, 30);
    return f;
  }
  function closeModal() { var m = $('modal'); if (m) m.remove(); }
  function modalErr(f, t) { var e = f.querySelector('.modal-err'); if (e) { e.textContent = t || ''; e.hidden = !t; } }
  function busyBtn(f, on, label) {
    var b = f.querySelector('button[type=submit]');
    if (!b) return;
    if (on) { b.dataset.old = b.textContent; b.textContent = label || 'Aguarde…'; } else if (b.dataset.old) b.textContent = b.dataset.old;
    b.disabled = on;
  }
  function errText(err) {
    var c = err && err.code;
    return c === 'sem_rede' ? 'Sem conexão com o banco. Tente quando tiver sinal.'
      : c === 'codigo_invalido' ? 'Código errado.'
      : c === 'muitas_tentativas' ? 'Muitas tentativas erradas. Espere 10 minutos e tente de novo.'
      : c === 'codigo_curto' ? 'O código da equipe precisa de pelo menos 6 caracteres e o do responsável, de 8.'
      : c === 'codigos_iguais' ? 'Os dois códigos precisam ser diferentes.'
      : 'Não deu certo (' + ((err && err.message) || 'erro') + ').';
  }
  function mField(id, label, pw, value) {
    return '<div class="field"><label for="' + id + '">' + esc(label) + '</label><input id="' + id + '"' + (pw ? ' type="password" data-pw autocomplete="off"' : ' autocomplete="name"') +
      ' maxlength="' + (pw ? 200 : 60) + '" value="' + esc(value || '') + '"></div>';
  }
  var SHOWPW = '<label class="show-pw"><input type="checkbox" data-showpw> Mostrar o que digitei</label>';
  var MFOOT = '<p class="modal-err" role="alert" hidden></p><div class="modal-foot"><button type="button" class="btn" data-close>Cancelar</button>';
  function openLogin() {
    if (banco.login) { openAccount(); return; }
    modal('<h2 id="modalTitle">Entrar para editar</h2>' +
      '<p>Os dados são de toda a equipe: com o código, o que você mudar aparece para todos (e fica no histórico com o seu nome).</p>' +
      mField('lgNome', 'Seu nome', false, lsGet(NAME_KEY) || '') + mField('lgCod', 'Código da equipe', true) + SHOWPW +
      MFOOT + '<button type="submit" class="btn primary">Entrar</button></div>',
    function (f) {
      var n = f.querySelector('#lgNome').value.trim(), c = f.querySelector('#lgCod').value;
      if (!n) { modalErr(f, 'Escreva seu nome.'); return; }
      if (!c) { modalErr(f, 'Digite o código.'); return; }
      modalErr(f, '');
      busyBtn(f, true, 'Conferindo…');
      window.Banco.entrar(c).then(function (papel) {
        busyBtn(f, false);
        if (!papel) { modalErr(f, 'Código errado.'); return; }
        lsPut(NAME_KEY, n);
        setLogin({ codigo: c, nome: n, papel: papel });
        closeModal();
        renderAll();
        toast(papel === 'responsavel' ? 'Você entrou como responsável.' : 'Pronto, ' + n + ': o que você mudar vai para o banco da equipe.');
        flush();
      }, function (err) { busyBtn(f, false); modalErr(f, errText(err)); });
    });
  }
  function openAccount() {
    var f = modal('<h2 id="modalTitle">' + esc(banco.login.nome || 'Equipe') + '</h2>' +
      '<p>Este aparelho está editando o banco da equipe como <b>' + (isResp() ? 'responsável' : 'equipe') + '</b>.</p>' +
      '<div class="modal-list"><button type="button" class="btn" data-acc="hist">Histórico de alterações</button>' +
      (isResp() ? '<button type="button" class="btn" data-acc="codes">Trocar códigos</button>' : '') +
      '<button type="button" class="btn danger" data-acc="sair">Sair deste aparelho</button></div>' +
      '<div class="modal-foot"><button type="button" class="btn" data-close>Fechar</button></div>');
    f.addEventListener('click', function (e) {
      var b = e.target.closest('[data-acc]');
      if (!b) return;
      if (b.dataset.acc === 'hist') openHist();
      else if (b.dataset.acc === 'codes') openCodes();
      else if (b.dataset.acc === 'sair') {
        if (banco.pend.length && !confirm('Há ' + banco.pend.length + ' alteração(ões) deste aparelho que ainda não subiram para o banco. Sair e descartar?')) return;
        banco.pend = []; keepSync();
        closeModal(); logout(); refresh(true);
      }
    });
  }
  function openHist() {
    var f = modal('<h2 id="modalTitle">Histórico de alterações</h2><div class="hist" aria-live="polite">Carregando…</div><div class="modal-foot"><button type="button" class="btn" data-close>Fechar</button></div>');
    window.Banco.historico(40).then(function (rows) {
      var el = f.querySelector('.hist');
      el.innerHTML = rows.length ? rows.map(function (r) {
        var d = new Date(r.em);
        var dia = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
        var conf = Array.isArray(r.conflitos) ? r.conflitos.map(function (x) { return '<span class="hist-conf">' + esc(conflictText(x, r.autor || 'quem enviou')) + '</span>'; }).join('') : '';
        return '<div class="hist-row"><span class="hist-when">' + dia + ' ' + hhmm(d) + '</span><span><b>' + esc(r.autor || '—') + '</b> ' + esc(r.resumo || '') + conf + '</span></div>';
      }).join('') : '<p>Nada gravado ainda.</p>';
    }, function (err) { f.querySelector('.hist').textContent = errText(err); });
  }
  // #configurar (primeira vez: cria os códigos) ou "Trocar códigos" (pede o código atual do responsável)
  function openCodes() {
    window.Banco.codigosDefinidos().then(function (def) {
      modal('<h2 id="modalTitle">' + (def ? 'Trocar códigos' : 'Criar os códigos de acesso') + '</h2>' +
        (def ? '<p>Precisa do código atual do responsável. Deixe em branco o que não quiser trocar. Quem usa o código antigo vai precisar entrar de novo.</p>'
          : '<p>O <b>código do responsável</b> (pelo menos 8 caracteres) fica só com você: troca os códigos e a logo da equipe. O <b>código da equipe</b> (pelo menos 6) é o que você passa para quem vai editar.</p>' + mField('cdNome', 'Seu nome', false, lsGet(NAME_KEY) || '')) +
        (def ? mField('cdAtual', 'Código atual do responsável', true) : '') +
        mField('cdResp', def ? 'Novo código do responsável (opcional)' : 'Código do responsável', true) +
        mField('cdEq', def ? 'Novo código da equipe (opcional)' : 'Código da equipe', true) + SHOWPW +
        MFOOT + '<button type="submit" class="btn primary">Salvar códigos</button></div>',
      function (f) {
        var atual = def ? f.querySelector('#cdAtual').value : null, resp = f.querySelector('#cdResp').value, eq = f.querySelector('#cdEq').value;
        var nome = def ? (banco.login && banco.login.nome) || lsGet(NAME_KEY) || '' : f.querySelector('#cdNome').value.trim();
        if (!def && !nome) { modalErr(f, 'Escreva seu nome.'); return; }
        if (def && !atual) { modalErr(f, 'Digite o código atual do responsável.'); return; }
        if (!def && (!resp || !eq)) { modalErr(f, 'Crie os dois códigos.'); return; }
        if (def && !resp && !eq) { modalErr(f, 'Digite pelo menos um código novo.'); return; }
        if ((resp && resp.length < 8) || (eq && eq.length < 6)) { modalErr(f, errText({ code: 'codigo_curto' })); return; }
        if (resp && eq && resp === eq) { modalErr(f, errText({ code: 'codigos_iguais' })); return; }
        modalErr(f, '');
        busyBtn(f, true, 'Salvando…');
        window.Banco.definirCodigos(atual, eq || null, resp || null).then(function () {
          busyBtn(f, false);
          closeModal();
          if (nome) lsPut(NAME_KEY, nome);
          setLogin({ codigo: resp || atual, nome: nome, papel: 'responsavel' });
          renderAll();
          toast(def ? 'Códigos trocados.' : 'Códigos criados. Passe o código da equipe para quem vai editar.', 6000);
          if (location.hash === '#configurar') history.replaceState(null, '', location.pathname + location.search);
          flush();
        }, function (err) { busyBtn(f, false); modalErr(f, errText(err)); });
      });
    }, function (err) { toast(errText(err), 6000); });
  }
  // primeira abertura com o banco: o que estava só neste aparelho fica guardado à parte, com opção de baixar
  function prepareOld() {
    if (!banco.on || lsGet(SYNC_KEY)) return;
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw && !localStorage.getItem(OLD_KEY)) localStorage.setItem(OLD_KEY, raw);
    } catch (e) { /* sem armazenamento */ }
  }
  function checkOld() {
    var old = lsGet(OLD_KEY);
    if (!old || old.avisado) return;
    if (!validState(old) || !diffOps(state, normalize(clone(old))).length) { lsPut(OLD_KEY, null); return; }
    old.avisado = true;
    lsPut(OLD_KEY, old);
    var bar = document.createElement('div');
    bar.className = 'share-ready';
    bar.setAttribute('role', 'status');
    bar.innerHTML = '<span>Agora os dados vêm do banco da equipe. O que estava só neste aparelho foi guardado: se alguém editou aqui, baixe o backup e mande ao responsável.</span>' +
      '<button type="button" class="btn primary">Baixar backup</button><button type="button" class="btn">Dispensar</button>';
    var b = bar.querySelectorAll('button');
    b[0].addEventListener('click', function () {
      var o = lsGet(OLD_KEY) || old;
      delete o.avisado;
      saveBlob('dados-deste-aparelho-' + todayIso() + '.json', new Blob([JSON.stringify(o, null, 2)], { type: 'application/json' }));
      bar.remove();
    });
    b[1].addEventListener('click', function () { bar.remove(); });
    document.body.appendChild(bar);
  }
  // logo da equipe no carimbo das fotos: vai direto ao banco (só o responsável)
  function saveTeamLogo(op) {
    if (!banco.on || !isResp()) return Promise.reject(new Error('so_responsavel'));
    var resumo = op.t === 'config' ? 'Logo da equipe nas fotos: ' + (op.valor.nome || 'nova') : 'Logo da equipe nas fotos removida';
    return window.Banco.salvar(banco.login.codigo, banco.login.nome, resumo, [op]).then(function (v) {
      if (op.t === 'config') banco.cfg.fotoLogo = op.valor; else delete banco.cfg.fotoLogo;
      if (v === banco.versao + 1) banco.versao = v; else refresh();
      keepSync();
      syncStatus();
    });
  }
  // editor só para consulta enquanto ninguém entrou
  function lockEditor() {
    if (!readOnly()) return;
    $('editor').querySelectorAll('input,select,textarea').forEach(function (el) { el.disabled = true; });
  }
  var EDIT_ACTS = ['set-st', 'add-point', 'dup-point', 'del-point', 'add-dev', 'del-dev', 'add-marco', 'del-marco', 'new-contract', 'del-contract'];
  function initBanco() {
    if (!banco.on) { var lb = $('btnLogin'); if (lb) lb.hidden = true; return; }
    prepareOld();
    var s = lsGet(SYNC_KEY);
    if (s) {
      banco.versao = Number(s.versao) || 0; banco.pend = Array.isArray(s.pend) ? s.pend : []; banco.cfg = s.cfg || {};
      banco.meta = s.meta && typeof s.meta === 'object' ? s.meta : {}; banco.conf = Array.isArray(s.conf) ? s.conf : [];
    }
    banco.base = clone(state);   // o estado guardado aqui já inclui o que está na fila
    setLogin(lsGet(LOGIN_KEY));
    if (banco.conf.length) showConflicts();
    $('btnLogin').addEventListener('click', openLogin);
    document.querySelectorAll('[data-act="reset"]').forEach(function (b) { b.hidden = true; var hr = b.previousElementSibling; if (hr && hr.tagName === 'HR') hr.hidden = true; });
    $('editor').addEventListener('focusout', function () { setTimeout(function () { if (banco.want && !typing()) refresh(); }, 50); });
    window.addEventListener('online', function () { banco.online = true; flush(); poll(); });
    window.addEventListener('offline', function () { banco.online = false; syncStatus(); });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') poll(); });
    window.addEventListener('hashchange', function () { if (location.hash === '#configurar') openCodes(); });
    setInterval(poll, 20000);
    syncStatus();
    refresh().then(function () {
      if (banco.login) window.Banco.entrar(banco.login.codigo).then(function (p) {   // o código pode ter sido trocado
        if (!p) { logout(true); toast('O código da equipe mudou. Entre de novo para editar.', 6000); }
        else if (p !== banco.login.papel) setLogin({ codigo: banco.login.codigo, nome: banco.login.nome, papel: p });
      }, function () { /* sem sinal: confere depois */ });
      flush();
      if (location.hash === '#configurar') openCodes();
    });
  }

  // ------------------------------------------------------------------ início
  function init() {
    state = load() || normalize(clone(window.UNIFILAR_SEED));
    if (window.UNIFILAR_LOGO) $('brandLogo').src = window.UNIFILAR_LOGO.src;
    var ed = $('editor');
    ed.addEventListener('input', onInput);
    ed.addEventListener('change', onInput);
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.menu')) closeMenu();
    });
    $('tabs').addEventListener('click', onClick);
    ed.addEventListener('click', onClick);
    $('pages').addEventListener('click', onPreviewClick);
    $('btnPdf').addEventListener('click', exportPdf);
    $('btnWide').addEventListener('click', function () { toggleWide(); });
    $('selPages').addEventListener('change', onPagesChange);
    $('viewDiagrama').addEventListener('click', function () { setView('diagrama'); });
    $('btnFoto').addEventListener('click', function () { openFoto(''); });
    if (!window.FotoCarimbo || !window.SNV_BR230) $('btnFoto').hidden = true;
    $('viewMapa').addEventListener('click', function () { setView('mapa'); });
    if (!window.MapaSNV || !window.L || !window.SNV_BR230) $('viewMapa').closest('.view-sw').hidden = true;
    if (window.TelaCheia) {
      viewer = window.TelaCheia({ pageW: PAGE_W, pageH: PAGE_H, getSheets: function () { return renderSheets(active()); } });
      $('btnFull').addEventListener('click', function () { if (view === 'mapa' && mapa) mapa.openFull(); else viewer.open(); });
    } else {
      $('btnFull').hidden = true;
    }
    $('btnMenu').addEventListener('click', function () {
      var pop = $('menuPop');
      pop.hidden = !pop.hidden;
      $('btnMenu').setAttribute('aria-expanded', String(!pop.hidden));
    });
    $('menuPop').addEventListener('click', onMenu);
    $('fileInput').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (f) openBackup(f);
      e.target.value = '';
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
    initBanco();
    renderAll();
    if (view === 'mapa') setView('mapa');
    save();
    installHint();
  }

  // acesso para testes no console
  window.Unifilar = {
    buildPdf: function () { return buildPdf(active()); },
    renderSheets: function () { return renderSheets(active()); },
    state: function () { return state; },
    mapa: function () { return mapa; },
    banco: function () { return banco; },
    diffOps: diffOps,
    applyOps: applyOps
  };

  init();
})();
