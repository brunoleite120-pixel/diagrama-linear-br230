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
  // contrato de pontes (tipo 'oae', ex.: CT 424): um grupo de serviços por linha, uma coluna por ponte.
  // un = unidade da estimativa do dano feita pela supervisão (q = o que ela mede); rotina não tem quantidade.
  // nomes: rótulos próprios da linha (rotina fala de vegetação ou sujeira, não de dano). Plataforma e jato d'água
  // são meio de execução: ficam só na análise das medições, sem linha na vistoria
  var OAE_SERVICES = [
    { key: 'juntas', label: 'Juntas de dilatação', short: 'Juntas', un: 'm', q: 'm de junta com dano' },
    { key: 'apoios', label: 'Aparelhos de apoio', short: 'Aparelhos de apoio', un: 'un', q: 'nº de aparelhos com dano' },
    { key: 'concreto', label: 'Recuperação estrutural (concreto)', short: 'Concreto', un: 'm²', q: 'm² de concreto com dano' },
    { key: 'pintura', label: 'Proteção superficial (pintura)', short: 'Pintura', un: '%', q: '% da pintura com dano' },
    { key: 'drenagem', label: 'Drenagem da OAE', short: 'Drenagem', un: 'un', q: 'nº de drenos com dano' },
    { key: 'rotina', label: 'Conservação de rotina (vegetação e limpeza)', short: 'Rotina', un: null, q: '', nomes: {
      OK: { tag: 'SEM VEGETAÇÃO/SUJEIRA APARENTE', name: 'Sem vegetação/sujeira aparente', btn: 'Sem vegetação/sujeira aparente' },
      DN: { tag: 'VEGETAÇÃO OU SUJEIRA OBSERVADA', name: 'Vegetação ou sujeira observada', btn: 'Vegetação ou sujeira observada' } } },
    { key: 'pista', label: 'Pista, guarda-corpo e encontros', short: 'Pista / guarda-corpo', un: 'm', q: 'm de guarda-corpo ou pista com dano' }
  ];
  function isOae(c) { return !!(c && c.tipo === 'oae'); }
  function servicesOf(c) { return isOae(c) ? OAE_SERVICES : SERVICES; }
  var STATUS = {
    OK: { tag: 'OK', name: 'Concluído', btn: 'OK', fill: '#1E9E55' },
    A: { tag: 'ATIVO', name: 'Ativo', btn: 'Ativo', fill: '#2B5797' },
    P: { tag: 'PARADO', name: 'Parado', btn: 'Parado', fill: '#D93025' },
    NA: { tag: 'N/A', name: 'Não se aplica', btn: 'N/A', fill: 'none' }
  };
  var STATUS_ORDER = ['OK', 'A', 'P', 'NA'];
  // pontes: serviço contínuo de conservação. O estado é o que a supervisão viu na vistoria (sem dano aparente,
  // dano observado, em execução) com a ESTIMATIVA do dano, e não o avanço de uma obra feita uma vez só, como nos pontos críticos
  var OAE_STATUS = {
    NV: { tag: 'SEM VISTORIA', name: 'Sem vistoria', fill: 'none' },
    OK: { tag: 'SEM DANO APARENTE', name: 'Sem dano aparente', btn: 'Sem dano aparente', fill: '#1E9E55', ink: '#FFFFFF' },
    DN: { tag: 'DANO OBSERVADO', name: 'Dano observado', btn: 'Dano observado', fill: '#F2A93B', ink: '#3D2800' },
    EX: { tag: 'EM EXECUÇÃO', name: 'Em execução', btn: 'Em execução', fill: '#2B5797', ink: '#FFFFFF' },
    NA: { tag: 'N/A', name: 'Não tem nesta ponte', btn: 'N/A', fill: 'none' }
  };
  var OAE_STATUS_ORDER = ['OK', 'DN', 'EX', 'NA'];
  // estado do grupo com os nomes da linha (rotina: vegetação ou sujeira)
  function oaeStOf(s, k) { var o = s && s.nomes && s.nomes[k]; return o ? Object.assign({}, OAE_STATUS[k], o) : OAE_STATUS[k]; }
  // marcas do grupo, só com dano observado ou em execução: prioridade da supervisão e conclusão informada pela
  // contratada (o estado continua o observado até a supervisão conferir e marcar)
  var OAE_MARCAS = {
    pri: { name: 'Prioridade', title: 'Prioridade da supervisão' },
    ci: { name: 'Conclusão informada', title: 'A contratada informou que concluiu; fica como observado até a supervisão conferir' }
  };
  var ALERTA_COR = '#7B3FA0', ALERTA_TINTA = '#5B2C8F';   // roxo = análise das medições (separada do estado da ponte)
  function oaeSt(sv) {
    var st = sv && sv.st;
    if (st === 'PR' || st === 'UR') return 'DN';   // nomes da primeira versão desta tela
    return OAE_STATUS[st] ? st : 'NV';
  }
  function comQtd(st) { return st === 'DN' || st === 'EX'; }
  // "~" = estimativa da supervisão
  function fmtQtd(s, q) {
    if (q == null || q === '' || !s.un || !isFinite(q)) return '';
    return '~' + (s.un === '%' ? fmtPct(Number(q)) : fmtN(Number(q)) + ' ' + s.un);
  }
  // resumo da ponte: grupos com dano, em execução, sem dano e sem vistoria (N/A não conta); marcas de prioridade e conclusão informada
  function oaeNec(p) {
    var r = { dn: 0, exec: 0, ok: 0, nv: 0, aval: 0, pri: 0, ci: 0 };
    OAE_SERVICES.forEach(function (s) {
      var sv = p.serv[s.key], st = oaeSt(sv);
      if (st === 'NA') return;
      r.aval++;
      if (st === 'NV') r.nv++;
      else if (st === 'OK') r.ok++;
      else if (st === 'EX') r.exec++;
      else r.dn++;
      if (comQtd(st) && sv.pri) r.pri++;
      if (comQtd(st) && sv.ci) r.ci++;
    });
    return r;
  }
  function oaeNecTxt(n) {
    if (n.dn) return 'dano em ' + n.dn + (n.dn === 1 ? ' grupo' : ' grupos') + (n.exec ? ' · ' + n.exec + ' em execução' : '');
    if (n.exec) return n.exec + (n.exec === 1 ? ' grupo' : ' grupos') + ' em execução';
    if (!n.aval || n.nv === n.aval) return 'sem vistoria';
    return n.nv ? 'sem dano aparente · ' + n.nv + ' sem vistoria' : 'sem dano aparente';
  }
  // contrato: pontes com dano e, por grupo, quantas pontes e quanto (soma só das estimativas informadas)
  function oaeResumo(c) {
    var r = { dn: 0, exec: 0, nv: 0, pri: 0, grupos: {} };
    OAE_SERVICES.forEach(function (s) { r.grupos[s.key] = { pontes: 0, q: 0, semQ: 0 }; });
    c.pontos.forEach(function (p) {
      var n = oaeNec(p);
      if (n.dn) r.dn++;
      if (n.exec) r.exec++;
      if (n.pri) r.pri++;
      if (!n.aval || n.nv === n.aval) r.nv++;
      OAE_SERVICES.forEach(function (s) {
        var sv = p.serv[s.key], gr = r.grupos[s.key], q = sv && sv.q != null ? Number(sv.q) : NaN;
        if (oaeSt(sv) !== 'DN') return;
        gr.pontes++;
        if (s.un && s.un !== '%') { if (isFinite(q)) gr.q += q; else gr.semQ++; }
      });
    });
    return r;
  }
  function oaeFaltaTxt(r) {
    var asterisco = false, t = OAE_SERVICES.filter(function (s) { return r.grupos[s.key].pontes; }).map(function (s) {
      var gr = r.grupos[s.key], q = s.un && s.un !== '%' && gr.q ? '~' + fmtN(gr.q) + ' ' + s.un + (gr.semQ ? '*' : '') + ' em ' : '';
      if (q && gr.semQ) asterisco = true;
      return s.short + ': ' + q + gr.pontes + (gr.pontes === 1 ? ' ponte' : ' pontes');
    }).join(' · ');
    return t ? t + (asterisco ? '  (* há pontes sem a estimativa)' : '') : '';
  }
  var DEVICE_COLORS = {
    vermelho: { name: 'Vermelho', hex: '#E02424' },
    amarelo: { name: 'Amarelo', hex: '#E5B800' },
    cinza: { name: 'Cinza', hex: '#4F5653' },
    azul: { name: 'Azul', hex: '#1F6FD1' },
    verde: { name: 'Verde', hex: '#1E9E55' }
  };
  var STORE_KEY = 'unifilar-pontos-criticos.v1';
  var PREVIA = !!(window.AMBIENTE && window.AMBIENTE.previa);
  // folha na tela (pontes com análise): só a vistoria ou com a análise das medições
  var FOLHA_KEY = 'diagrama-linear.folha-tela', folhaVistoria = false;
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
  // contrato a que o ponto pertence (normalmente o aberto)
  function ownerOf(p) {
    if (!state) return null;
    var a = active();
    if (a && a.pontos.indexOf(p) >= 0) return a;
    return state.contracts.find(function (c) { return c.pontos.indexOf(p) >= 0; }) || a;
  }
  function pointPct(p, c) {
    var vals = servicesOf(c || ownerOf(p)).map(function (k) { return svcPct(p.serv[k.key]); }).filter(function (v) { return v != null; });
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
      pct += pointPct(p, c);
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
  // semAnalise: folha só com a vistoria, mesmo para quem vê a análise das medições (PDF e impressão perguntam)
  function renderSheets(c, semAnalise) {
    var pg = paginate(c), tot = totals(c), marcos = placeMarcos(c, pg);
    return pg.chunks.map(function (chunk, i) {
      return renderSheet(c, chunk, i, pg.chunks.length, pg.slots, tot, marcos.filter(function (m) { return m.pageIdx === i; }), semAnalise);
    });
  }

  function renderSheet(c, chunk, pageIdx, pageCount, slots, tot, marcos, semAnalise) {
    var o = [];
    o.push('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ' + PAGE_W + ' ' + PAGE_H + '" width="' + PAGE_W + '" height="' + PAGE_H + '">');
    o.push(R(0, 0, PAGE_W, PAGE_H, { fill: '#FFFFFF' }));
    o.push(R(G.frame, G.frame, PAGE_W - 2 * G.frame, PAGE_H - 2 * G.frame, { stroke: '#17201C', sw: 1.1 }));

    var oae = isOae(c), an = oae && !semAnalise ? anOf(c) : null, go = oae ? oaeGeom(an) : null;
    if (an) drawUsoInterno(o);
    drawHeader(o, c, tot, an);
    if (oae) drawLabelsOae(o, c, an, go); else drawLabels(o, c);

    var gm = geom(slots), slot = gm.slot;
    var n = chunk.length;

    if (!n) {
      o.push(T((G.x0 + G.x1) / 2, (oae ? go.yBand : G.yBand) + 30, oae ? 'Nenhuma ponte cadastrada neste contrato.' : 'Nenhum ponto cadastrado neste contrato.', { size: 12, fill: '#5C6661', anchor: 'middle' }));
    } else if (oae) {
      // eixo da rodovia passando pelas pontes
      o.push(L(G.x0, go.yBand + go.bandH / 2, G.x0 + slot * n, go.yBand + go.bandH / 2, { stroke: '#9AA29E', sw: 0.8, dash: '7 4' }));
      chunk.forEach(function (p, i) { drawPonte(o, p, gm.bx(i), gm.bw, an, go, c); });
    } else {
      // pista entre os pontos (trechos sem intervenção)
      o.push(R(G.x0, G.yBand, slot * n, G.bandH, { fill: '#EDC9C9' }));
      chunk.forEach(function (p, i) {
        drawPoint(o, p, gm.bx(i), gm.bw);
      });
      o.push(L(G.x0, G.yBand + G.bandH / 2, G.x0 + slot * n, G.yBand + G.bandH / 2, { stroke: '#30353A', sw: 0.8, dash: '7 4' }));
      o.push(R(G.x0, G.yBand, slot * n, G.bandH, { stroke: '#7D8581', sw: 0.8 }));
    }
    marcos.forEach(function (m) { drawMarco(o, m, oae ? go.yBand : G.yBand); });
    if (oae) drawFooterOae(o, c, tot, pageIdx, pageCount, an); else drawFooter(o, c, tot, pageIdx, pageCount);
    o.push('</svg>');
    return o.join('');
  }

  function drawHeader(o, c, tot, an) {
    var logo = window.UNIFILAR_LOGO, tx = 34;
    if (logo) {
      var lh = 56, lw = lh * logo.w / logo.h;
      o.push('<image x="32" y="30" width="' + r2(lw) + '" height="' + lh + '" preserveAspectRatio="xMidYMid meet" href="' + logo.src + '" xlink:href="' + logo.src + '"/>');
      tx = 32 + lw + 14;
    }
    // indicadores à direita
    var kpis = isOae(c) ? oaeKpis(c, tot, an) : [
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
    o.push(T(tx, 62, fitText((isOae(c) ? 'DIAGRAMA DE OAEs · CT ' : 'DIAGRAMA LINEAR · OBRA ') + (c.numero || '[Nº DA OBRA]'), maxW, 17, true), { size: 17, bold: true }));
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

  function drawMarco(o, m, yBand) {
    var name = String(m.marco.nome || 'Marco').toUpperCase(), km = 'KM ' + fmtKm(m.marco.km);
    var w = Math.max(textW(name, 7.2, true), textW(km, 6.8, true)) + 14, h = 25;
    var bx = clamp(m.x - w / 2, G.x0, G.x1 - w);
    yBand = yBand || G.yBand;
    o.push(R(bx, G.yMarco, w, h, { fill: '#5E8C2E', rx: 2 }));
    o.push(T(bx + w / 2, G.yMarco + 10, name, { size: 7.2, bold: true, fill: '#FFFFFF', anchor: 'middle' }));
    o.push(T(bx + w / 2, G.yMarco + 20, km, { size: 6.8, bold: true, fill: '#FFFFFF', anchor: 'middle' }));
    o.push(L(m.x, G.yMarco + h, m.x, yBand - 8, { stroke: '#2B5797', sw: 1.8 }));
    o.push(P([[m.x - 4.5, yBand - 9], [m.x + 4.5, yBand - 9], [m.x, yBand - 1]], '#2B5797'));
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

  // ------------------------------------------------------------------ folha de pontes (contrato tipo 'oae')
  // Cada coluna é uma ponte, em ordem de km. As linhas de status são as dos lotes (OK, Ativo, Parado, N/A), que o fiscal muda.
  // Com a análise das medições carregada (só engenheiro e criador), entram também o medido na ponte (por etapa), a faixa
  // das medições e os alertas. A folha com a análise é de uso interno (aviso no topo).
  var ALERTA_TXT = {
    junta: 'junta feita de novo (além do comprimento físico)', garantia: 'medido depois da garantia acionada',
    etapa: 'repetido na mesma etapa', garantia5: 'repetido dentro da garantia de 5 anos', vegetacao: 'vegetação refeita antes do intervalo',
    acima: 'acima do estimado do Anexo VI', sem_estimativa: 'sem estimativa no Anexo VI'
  };
  function fmtN(n) { return n == null || !isFinite(n) ? '' : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 }); }
  function fmtBRL(n) { return n == null || !isFinite(n) ? '-' : 'R$ ' + fmt(Math.round(n), 0); }
  function fmtBRLc(n) {
    if (n == null || !isFinite(n)) return '-';
    if (Math.abs(n) >= 1e6) return 'R$ ' + fmt(n / 1e6, 2) + ' mi';
    if (Math.abs(n) >= 1e4) return 'R$ ' + fmt(n / 1e3, 0) + ' mil';
    return fmtBRL(n);
  }
  function oaeGeom(an) {
    var g = { yKm: 151, yBand: 157, bandH: 56, yExt: 219, extH: 18, yNec: 243, necH: 26, yServ: 281, servH: 19, servStep: 23 };
    var after = g.yServ + OAE_SERVICES.length * g.servStep;
    if (an) { g.yConc = after + 4; g.concH = 21; g.yMed = g.yConc + g.concH + 4; g.medH = 27; g.yAl = g.yMed + g.medH + 6; g.alH = 16; g.yObs = g.yAl + g.alH + 8; }
    else g.yObs = after + 6;
    g.obsEnd = G.yFoot - 12;
    return g;
  }
  function oaeExt(c) { return c.pontos.reduce(function (s, p) { return s + (Number(p.extensao) || 0); }, 0); }
  function oaeKpis(c, tot, an) {
    var ext = oaeExt(c), r = an && an.resumo, n = oaeResumo(c);
    var nec = { k: 'PONTES COM DANO', v: n.dn + (n.dn === 1 ? ' ponte' : ' pontes'), s: n.pri ? n.pri + (n.pri === 1 ? ' com prioridade' : ' com prioridade') : n.exec ? n.exec + ' em execução' : 'observado na vistoria' };
    if (r) return [
      { k: 'PONTES', v: String(tot.n), s: fmt(ext, 0) + ' m de pontes' },
      nec,
      { k: 'MEDIDO (PREÇOS INICIAIS)', v: fmtBRLc(r.total), s: r.n + ' medições · ' + r.de + ' a ' + r.ate },
      { k: 'ALERTAS', v: String(r.alertas), s: r.pontesAlerta ? 'em ' + r.pontesAlerta + (r.pontesAlerta === 1 ? ' ponte' : ' pontes') : 'nenhuma ponte' }
    ];
    return [
      { k: 'PONTES', v: String(tot.n), s: fmt(ext, 0) + ' m de pontes' },
      nec,
      { k: 'SEM VISTORIA', v: n.nv + (n.nv === 1 ? ' ponte' : ' pontes'), s: 'de ' + tot.n },
      { k: 'ÚLTIMA VISTORIA', v: fmtDate(c.dataVistoria) || '-', s: '' }
    ];
  }

  function drawLabelsOae(o, c, an, g) {
    var x = G.labelX, w = G.colLine - G.labelX - 6, gray = '#5C6661';
    o.push(T(x, 110, 'SENTIDO', { size: 6, bold: true, fill: gray }));
    o.push(T(x, 121, fitText('De: ' + (c.origem || '-'), w, 7.4, true), { size: 7.4, bold: true }));
    o.push(T(x, 132, fitText('Para: ' + (c.destino || '-'), w, 7.4, true), { size: 7.4, bold: true }));
    o.push(L(x, 139, x + 70, 139, { stroke: '#B42318', sw: 1.4 }));
    o.push(P([[x + 76, 139], [x + 68, 135], [x + 68, 143]], '#B42318'));
    if (c.kmIni != null || c.kmFim != null) o.push(T(x, g.yKm, fitText('KM ' + (fmtKm(c.kmIni) || '?') + ' a ' + (fmtKm(c.kmFim) || '?'), w, 6.6), { size: 6.6, fill: gray }));
    o.push(T(x, g.yBand + 24, 'PONTE', { size: 7, bold: true }));
    o.push(T(x, g.yBand + 35, 'nome e código', { size: 6.4, fill: gray }));
    o.push(T(x, g.yExt + 12.5, 'EXTENSÃO', { size: 7, bold: true }));
    o.push(T(x, g.yNec + 12, 'ESTADO', { size: 7, bold: true }));
    o.push(T(x, g.yNec + 21.5, 'e última vistoria', { size: 6.4, fill: gray }));
    o.push(T(x, g.yServ - 4, 'ESTADO NA VISTORIA', { size: 6, bold: true, fill: gray }));
    OAE_SERVICES.forEach(function (s, i) {
      var y = g.yServ + i * g.servStep + 12.8, uw = s.un ? textW(s.un, 6.4) + 4 : 0;
      o.push(T(x, y, fitText(s.short, w - uw, 7.2, true), { size: 7.2, bold: true }));
      if (s.un) o.push(T(x + w, y, s.un, { size: 6.4, fill: gray, anchor: 'end' }));
    });
    if (an) {
      var ms = an.medicoes || [];
      o.push(T(x, g.yConc + 9.5, 'MEDIDO NA PONTE', { size: 7, bold: true }));
      o.push(T(x, g.yConc + 18, 'por etapa, preços iniciais', { size: 6, fill: gray }));
      o.push(T(x, g.yMed + 11, 'MEDIÇÕES', { size: 7, bold: true }));
      if (ms.length) o.push(T(x, g.yMed + 21, fitText(ms[0].n + 'ª a ' + ms[ms.length - 1].n + 'ª (' + ms[0].mes + ' a ' + ms[ms.length - 1].mes + ')', w, 6.2), { size: 6.2, fill: gray }));
      o.push(T(x, g.yAl + 11.5, 'ALERTAS', { size: 7, bold: true }));
      o.push(T(x + w, g.yAl + 11.5, 'para conferir', { size: 6, fill: gray, anchor: 'end' }));
    }
    o.push(T(x, g.yObs + 12, 'OBSERVAÇÕES', { size: 7, bold: true }));
    o.push(L(G.colLine, 106, G.colLine, g.obsEnd, { stroke: '#C9CECB', sw: 0.6 }));
  }

  function drawPonte(o, p, bx, bw, an, g, c) {
    var cx = bx + bw / 2, a = an && an.pontes ? an.pontes[p.id] || null : null;
    o.push('<g data-pid="' + esc(p.id) + '">');
    // km pelo SNV em vigor (o do mapa e da foto); "~" = estimado, a conferir em campo; em cima, pequeno, o km do contrato
    var kmT = p.kmIni != null ? (p.kmConferir ? '~' : '') + fmtKm(p.kmIni) : '-';
    o.push(T(cx, g.yKm, kmT, { size: r2(fitSize(kmT, bw - 4, 7.6, true, 5)), bold: true, anchor: 'middle' }));
    if (p.kmContrato != null && p.kmContrato !== p.kmIni) {
      var kc = 'contr. ' + fmtKm(p.kmContrato);
      o.push(T(cx, g.yKm - 9, fitText(kc, bw - 4, 5.8), { size: 5.8, fill: '#5C6661', anchor: 'middle' }));
    }

    // bloco da ponte: código grande e nome
    o.push(R(bx, g.yBand, bw, g.bandH, { fill: '#D6DAD8', stroke: '#7D8581', sw: 0.7, cls: 'blk' }));
    // o nome é a identificação principal; o código (OAE nn) vem pequeno em cima
    if (p.codigo) o.push(T(cx, g.yBand + 13, fitText(p.codigo, bw - 6, 6.8, true), { size: 6.8, bold: true, fill: '#5C6661', anchor: 'middle' }));
    var nome = p.nome || '?', maior = nome.split(/\s+/).reduce(function (m, w) { return textW(w, 13, true) > textW(m, 13, true) ? w : m; }, '');
    var ns = fitSize(maior, bw - 6, 13, true, 6), nl = wrap(nome, bw - 6, ns, true);
    if (nl.length > 2) { nl = nl.slice(0, 2); nl[1] = fitText(nl[1] + '...', bw - 6, ns, true); }
    var ny = g.yBand + (nl.length > 1 ? 30 : 37);
    nl.forEach(function (ln, i) { o.push(T(cx, ny + i * (ns + 2), ln, { size: r2(ns), bold: true, anchor: 'middle' })); });

    // extensão × largura
    o.push(R(bx, g.yExt, bw, g.extH, { fill: '#FFFFFF', stroke: '#7D8581', sw: 0.6 }));
    var extTxt = p.extensao != null ? fmtN(p.extensao) + ' m' + (p.largura != null ? ' × ' + fmtN(p.largura) : '') : '-';
    o.push(T(cx, g.yExt + 12.4, extTxt, { size: r2(fitSize(extTxt, bw - 4, 8, true, 4.6)), bold: true, anchor: 'middle' }));

    // estado da ponte (resumo dos grupos) e a última vistoria: quando e quem marcou
    var nn = oaeNec(p), vis = c ? vistoriaPonte(c, p) : null;
    var nf = nn.dn ? '#FBE3BC' : nn.exec ? '#D5E0F0' : (nn.aval && !nn.nv) ? '#CDE8D6' : '#EEF0EF';
    var ntx = oaeNecTxt(nn), nsz = fitSize(ntx, bw - 4, 7.6, true, 4.6);
    o.push(R(bx, g.yNec, bw, g.necH, { fill: nf, stroke: '#7D8581', sw: 0.6 }));
    o.push(T(cx, g.yNec + (vis ? 11 : 16.4), fitText(ntx, bw - 4, nsz, true), { size: r2(nsz), bold: true, fill: '#17201C', anchor: 'middle' }));
    if (vis) {
      var vt = 'vistoria ' + fmtWhen(vis.em).slice(0, 5) + (vis.por ? ' · ' + vis.por : '');
      o.push(T(cx, g.yNec + 21, fitText(vt, bw - 4, 6, false), { size: 6, fill: '#3B4540', anchor: 'middle' }));
    }

    // grupos: cor = estado marcado na vistoria; "~" = estimativa do dano; contorno roxo = alerta alto nas medições
    OAE_SERVICES.forEach(function (s, i) {
      var sv = p.serv[s.key], k = oaeSt(sv), st = oaeStOf(s, k), y = g.yServ + i * g.servStep;
      var gi = a && a.grupos ? a.grupos[s.key] : null;
      if (st.fill === 'none') {
        o.push(R(bx, y, bw, g.servH, { fill: k === 'NV' ? '#F3F4F3' : '#FFFFFF', stroke: '#B9C0BC', sw: 0.6, dash: '2 2', rx: 2 }));
        var vz = fitSize(st.tag, bw - 6, 6.8, true, 4.4);
        o.push(T(cx, y + 12.6, fitText(st.tag, bw - 6, vz, true), { size: r2(vz), bold: true, fill: '#7A817D', anchor: 'middle' }));
      } else {
        var qt = comQtd(k) ? fmtQtd(s, sv.q) : '', label = st.tag + (qt ? ' · ' + qt : '');
        o.push(R(bx, y, bw, g.servH, { fill: st.fill, rx: 2 }));
        var ls = fitSize(label, bw - 6, 7.4, true, 4.4);
        if (ls >= 6) o.push(T(cx, y + 12.8, fitText(label, bw - 6, ls, true), { size: r2(ls), bold: true, fill: st.ink, anchor: 'middle' }));
        else {
          // não cabe numa linha: estado em cima e estimativa embaixo (ou o nome em duas linhas)
          var l2 = qt ? [st.tag, qt] : wrap(st.tag, bw - 6, 6, true);
          if (l2.length > 2) l2 = [l2[0], l2.slice(1).join(' ')];
          var s2 = Math.min.apply(null, l2.map(function (t) { return fitSize(t, bw - 6, 6.2, true, 4.2); }));
          l2.forEach(function (t, j) {
            o.push(T(cx, y + (l2.length > 1 ? 8.3 + j * 7.4 : 12.6), fitText(t, bw - 6, s2, true), { size: r2(s2), bold: true, fill: st.ink, anchor: 'middle' }));
          });
        }
        // marcas no canto: "!" = prioridade; visto = conclusão informada pela contratada (a supervisão ainda confere)
        var mk = 0;
        if (comQtd(k) && sv.pri) marcaPri(o, bx + 3.5 + 10 * mk++, y + 0.5);
        if (comQtd(k) && sv.ci) marcaCi(o, bx + 3.5 + 10 * mk++, y + 0.5);
      }
      if (gi && gi.altos) {
        o.push(R(bx - 0.8, y - 0.8, bw + 1.6, g.servH + 1.6, { stroke: ALERTA_COR, sw: 1.6, rx: 2.6 }));
        var bt = String(gi.altos), bwid = Math.max(10, textW(bt, 6, true) + 6);
        o.push(R(bx + bw - bwid + 2, y - 4.5, bwid, 9, { fill: ALERTA_COR, rx: 4.5 }));
        o.push(T(bx + bw - bwid / 2 + 2, y + 2.2, bt, { size: 6, bold: true, fill: '#FFFFFF', anchor: 'middle' }));
      }
    });

    if (an) {
      // medido na ponte, a preços iniciais, e por etapa: só o histórico, sem comparar com o estimado do Anexo VI
      o.push(R(bx, g.yConc, bw, g.concH, { fill: '#F4F6F5', stroke: '#7D8581', sw: 0.6 }));
      var mt = a && a.tot ? fmtBRLc(a.tot) : '-', et = a ? medEtapas(an, a) : [];
      o.push(T(cx, g.yConc + (et.length > 1 ? 9.4 : 13.6), mt, { size: r2(fitSize(mt, bw - 4, 8.4, true, 5)), bold: true, anchor: 'middle' }));
      if (et.length > 1) {
        var ett = et.map(function (e) { return e.etapa + 'ª ' + fmtBRLc(e.v); }).join(' · '), ets = fitSize(ett, bw - 4, 5.8, false, 4.2);
        o.push(T(cx, g.yConc + 17.6, fitText(ett, bw - 4, ets), { size: r2(ets), fill: '#3B4540', anchor: 'middle' }));
      }

      // faixa das medições: um quadradinho por medição (azul = houve serviço na ponte; roxo = medição com alerta)
      var ms = an.medicoes || [], cols = 9, rows = Math.max(1, Math.ceil(ms.length / cols));
      var cw = (bw - 2) / cols, ch = (g.medH - 2) / rows, mx = {};
      (a && a.mx || []).forEach(function (n) { mx[n] = 1; });
      o.push(R(bx, g.yMed, bw, g.medH, { fill: '#FFFFFF', stroke: '#7D8581', sw: 0.6 }));
      ms.forEach(function (m, k) {
        var on = a && a.meses && a.meses[String(m.n)], col = k % cols, row = Math.floor(k / cols);
        o.push(R(bx + 1 + col * cw + 0.45, g.yMed + 1 + row * ch + 0.45, cw - 0.9, ch - 0.9, { fill: on ? (mx[m.n] ? ALERTA_COR : '#2B5797') : '#EEF0EF' }));
      });
      // alertas
      o.push(R(bx, g.yAl, bw, g.alH, { fill: '#FFFFFF', stroke: '#7D8581', sw: 0.6 }));
      var at = !a ? '-' : a.al ? a.al + (a.al === 1 ? ' alerta' : ' alertas') : 'nenhum';
      o.push(T(cx, g.yAl + 11, fitText(at, bw - 4, fitSize(at, bw - 4, 7.2, true, 4.4), true), { size: r2(fitSize(at, bw - 4, 7.2, true, 4.4)), bold: true, fill: a && a.al ? ALERTA_TINTA : '#3B4540', anchor: 'middle' }));
    }

    // observações do fiscal e, com a análise, os alertas da ponte
    var oh = g.obsEnd - g.yObs;
    o.push(R(bx, g.yObs, bw, oh, { fill: '#FFFFFF', stroke: '#7D8581', sw: 0.6 }));
    o.push(T(bx + 5, g.yObs + 12, 'Observações gerais', { size: r2(fitSize('Observações gerais', bw - 10, 7, true, 4.2)), bold: true }));
    var k = clamp((bw - 10) / 89.6, 0.62, 1), fs = r2(7 * k), lh = 8.9 * k, maxLines = Math.floor((oh - 26) / lh);
    var lines = wrap(p.obs || '', bw - 10, fs).map(function (t) { return { t: t }; });
    var altos = a ? (a.alertas || []).slice().sort(function (x, y) { return y.valor - x.valor; }) : [];
    if (altos.length) {
      if (lines.length) lines.push({ t: '' });
      lines.push({ t: 'Alertas das medições:', b: true, cor: ALERTA_TINTA });
      altos.forEach(function (x) {
        wrap('• ' + x.servico + ': ' + (x.trechos || ALERTA_TXT[x.tipo] || x.tipo) + ' (' + fmtBRL(x.valor) + ')', bw - 10, fs).forEach(function (t) { lines.push({ t: t, cor: '#4B2377' }); });
      });
    }
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1] = { t: fitText(lines[maxLines - 1].t + '...', bw - 10, fs), cor: lines[maxLines - 1].cor };
    }
    lines.forEach(function (ln, i) { if (ln.t) o.push(T(bx + 5, g.yObs + 25 + i * lh, ln.t, { size: fs, bold: !!ln.b, fill: ln.cor || '#2B3430' })); });
    o.push('</g>');
  }

  function marcaPri(o, x, y) {
    o.push('<circle cx="' + r2(x) + '" cy="' + r2(y) + '" r="4.6" fill="#B42318" stroke="#FFFFFF" stroke-width="0.8"/>');
    o.push(T(x, y + 2.3, '!', { size: 6.6, bold: true, fill: '#FFFFFF', anchor: 'middle' }));
  }
  function marcaCi(o, x, y) {
    o.push('<circle cx="' + r2(x) + '" cy="' + r2(y) + '" r="4.6" fill="#FFFFFF" stroke="#1E9E55" stroke-width="1"/>');
    o.push('<path d="M' + r2(x - 2.3) + ' ' + r2(y + 0.1) + ' L' + r2(x - 0.6) + ' ' + r2(y + 1.9) + ' L' + r2(x + 2.4) + ' ' + r2(y - 1.8) + '" fill="none" stroke="#1E9E55" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>');
  }
  // valor medido na ponte em cada etapa do contrato
  function medEtapas(an, a) {
    var r = {}, ord = [];
    (an.medicoes || []).forEach(function (m) {
      var v = Number(a.meses && a.meses[String(m.n)]) || 0;
      if (!v) return;
      if (!r[m.etapa]) { r[m.etapa] = { etapa: m.etapa, v: 0 }; ord.push(r[m.etapa]); }
      r[m.etapa].v += v;
    });
    return ord;
  }
  // aviso no topo da folha com a análise das medições (uso interno)
  function drawUsoInterno(o) {
    var t = 'USO INTERNO – ANÁLISE PRELIMINAR DAS MEDIÇÕES', w = textW(t, 7.6, true) + 24, x = (PAGE_W - w) / 2;
    o.push(R(x, 12, w, 15, { fill: ALERTA_COR, rx: 3 }));
    o.push(T(PAGE_W / 2, 22.6, t, { size: 7.6, bold: true, fill: '#FFFFFF', anchor: 'middle' }));
  }

  function drawFooterOae(o, c, tot, pageIdx, pageCount, an) {
    var y = G.yFoot, x = G.labelX, gray = '#5C6661';
    o.push(L(G.frame, y - 4, PAGE_W - G.frame, y - 4, { stroke: '#C9CECB', sw: 0.6 }));
    o.push(T(x, y + 10, 'LEGENDA', { size: 6.4, bold: true, fill: gray }));
    // 1ª linha: estados e marcas; 2ª linha (com a análise): a legenda em roxo. Tudo à esquerda do quadro do total (x < 630)
    var lx = x + 40, fs = 6.8;
    function item(desenho, txt, yy) {
      desenho(lx, yy);
      o.push(T(lx + 19, yy + 8, txt, { size: fs }));
      lx += 19 + textW(txt, fs) + 10;
    }
    [['OK', 'Sem dano aparente'], ['DN', 'Dano observado'], ['EX', 'Em execução'], ['NA', 'Não tem (N/A)'], ['NV', 'Sem vistoria']].forEach(function (it) {
      var st = OAE_STATUS[it[0]];
      item(function (xx, yy) {
        if (st.fill === 'none') o.push(R(xx, yy, 15, 10, { fill: it[0] === 'NV' ? '#F3F4F3' : '#FFFFFF', stroke: '#B9C0BC', sw: 0.6, dash: '2 2', rx: 1.5 }));
        else o.push(R(xx, yy, 15, 10, { fill: st.fill, rx: 1.5 }));
      }, it[1], y + 2);
    });
    item(function (xx, yy) { marcaPri(o, xx + 7.5, yy + 5); }, 'Prioridade', y + 2);
    item(function (xx, yy) { marcaCi(o, xx + 7.5, yy + 5); }, 'Conclusão informada', y + 2);
    var yn = y + 26;
    if (an) {
      lx = x + 40;
      item(function (xx, yy) { o.push(R(xx + 0.8, yy + 0.8, 13.4, 8.4, { stroke: ALERTA_COR, sw: 1.6, rx: 1.5 })); }, 'Grupo refeito (alerta)', y + 16);
      item(function (xx, yy) { o.push(R(xx + 3.5, yy + 1, 8, 8, { fill: '#2B5797' })); }, 'Medição com serviço', y + 16);
      item(function (xx, yy) { o.push(R(xx + 3.5, yy + 1, 8, 8, { fill: ALERTA_COR })); }, 'Medição com alerta', y + 16);
      yn = y + 38;
    }
    var notas = [
      'Serviço contínuo: estado de cada grupo na última vistoria. ~ = estimativa do dano feita pela supervisão. Conclusão informada = a contratada diz que concluiu; a supervisão ainda confere.',
      'KM pelo SNV ' + ((window.SNV_BR230 && window.SNV_BR230.versao) || '') + ' (DNIT); contr. = km do contrato (Anexo VI); ~ antes do km = km estimado, a conferir em campo.'
    ];
    if (an) notas.push('Em roxo, a análise das medições (uso interno), a preços iniciais: alerta = ponte atendida mais de uma vez na mesma etapa ou junta/pingadeira refeita em menos de 1 ano. Indício a conferir.');
    notas.forEach(function (t, i) { o.push(T(x, yn + i * 8.4, fitText(t, 598, 6.1), { size: 6.1, fill: gray })); });

    var bx = 640;
    if (pageIdx === pageCount - 1) {
      var rs = oaeResumo(c), falta = oaeFaltaTxt(rs);
      o.push(R(bx, y, G.x1 - bx, falta ? 46 : 34, { fill: '#F4F6F5', stroke: '#C7CCC9', sw: 0.7, rx: 3 }));
      o.push(T(bx + 10, y + 13, 'TOTAL GERAL', { size: 6.6, bold: true, fill: gray }));
      if (falta) o.push(T(bx + 10, y + 39, fitText('Danos estimados: ' + falta, G.x1 - bx - 20, 6.8), { size: 6.8, fill: '#3B4540' }));
      var parts = [['Pontes', String(tot.n)], ['Extensão das pontes', fmt(oaeExt(c), 0) + ' m'], ['Pontes com dano', String(rs.dn)]];
      if (an && an.resumo) {
        parts.push(['Medido', fmtBRLc(an.resumo.total)]);
        parts.push(['Alertas', String(an.resumo.alertas)]);
      }
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
  var state, ui = { contractOpen: false, open: {}, wide: false, medSel: {} };

  function validState(s) {
    return s && Array.isArray(s.contracts) && s.contracts.every(function (c) { return c && Array.isArray(c.pontos); });
  }
  function normalize(s) {
    s.contracts.forEach(function (c) {
      c.id = c.id || uid('ct');
      c.marcos = Array.isArray(c.marcos) ? c.marcos : [];
      var list = servicesOf(c);
      c.pontos.forEach(function (p) {
        p.id = p.id || uid('pt');
        p.serv = p.serv || {};
        list.forEach(function (k) { if (!p.serv[k.key]) p.serv[k.key] = isOae(c) ? { st: 'NV' } : { st: 'NA', pct: 0 }; });
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
  // mexer num ponto conta como vistoria: a "Data da última vistoria" do contrato vai para hoje
  // (só avança; quem quiser pode corrigir à mão no formulário do contrato)
  function marcaVistoria(c) {
    var hoje = todayIso();
    if (!c || isFiscal() || (c.dataVistoria && c.dataVistoria >= hoje)) return;
    c.dataVistoria = hoje;
    var el = document.querySelector('[data-c="dataVistoria"]');
    if (el && document.activeElement !== el) el.value = hoje;
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
    $('tabs').innerHTML = (window.VisaoGeral ? '<button type="button" class="tab tab-visao" data-act="visao" aria-current="' + visaoOn + '">' + ICON_VISAO + 'Visão geral</button>' : '') +
      state.contracts.map(function (c) {
      return '<button type="button" class="tab" data-tab="' + esc(c.id) + '" aria-current="' + (!visaoOn && c.id === state.activeId) + '">' +
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

    var pts = sortedPoints(c), oae = isOae(c);
    if (oae) { carregarAnalise(c); h.push(analiseResumoHtml(c)); }
    h.push('<div class="points-head"><h2>' + (oae ? 'Pontes' : 'Pontos críticos') + '<span class="count">' + pts.length + '</span></h2><button type="button" class="btn small" data-act="add-point">' + (oae ? '+ Ponte' : '+ Ponto') + '</button></div>');
    h.push('<div class="hint">' + (oae ? 'Ordenadas por km, como no diagrama. Toque numa ponte (aqui ou no desenho) para marcar o estado' + (anOf(c) ? ' e ver as medições e os alertas.' : '.') :
      'Ordenados por KM, como no diagrama. Clique num ponto (aqui ou no desenho) para editar.') + '</div>');
    h.push('<div class="pt-list" id="ptList">');
    pts.forEach(function (p) { h.push(pointCard(p)); });
    h.push('</div>');
    if (readOnly()) {
      h.unshift('<div class="ro-note"><span>Só consulta: os dados são do banco da equipe. Para editar, entre com o seu código.</span>' +
        '<button type="button" class="btn small primary" data-act="login">Entrar</button></div>');
    } else if (isFiscal()) {
      h.unshift('<div class="ro-note fiscal-note"><span>Você entrou como <b>fiscal de campo</b>: ' + (oae ? 'marque o estado de cada ponte e estime o dano (quanto e onde)' : 'mude o status e o % dos serviços') + '. A mudança fica aguardando a aprovação de um engenheiro.</span></div>');
    }
    $('editor').innerHTML = h.join('');
    lockEditor();
  }

  function pointHead(p) {
    var c = ownerOf(p);
    if (isOae(c)) return ponteHead(p, c);
    var dots = SERVICES.map(function (s) {
      var st = (p.serv[s.key] || {}).st || 'NA';
      return '<span class="dot ' + st + '" title="' + esc(s.short + ': ' + STATUS[st].name) + '"></span>';
    }).join('');
    var km = (p.kmIni != null ? fmtKm(p.kmIni) : '?') + ' – ' + (p.kmFim != null ? fmtKm(p.kmFim) : '?');
    var np = banco.on ? propsDo(active().id, p.id).length : 0;
    return '<span class="pt-name">' + esc(p.nome || '?') + (np ? '<span class="pt-prop" title="Alteração aguardando aprovação" aria-label="aguardando aprovação"></span>' : '') + '</span><span class="pt-km">KM ' + km + '</span><span class="pt-dots">' + dots + '</span><span class="pt-pct">' + fmtPct(pointPct(p)) + '</span>' + ICON_CHEV;
  }

  // botões de status de cada serviço. Pontos críticos (obra feita uma vez): OK, Ativo, Parado, N/A e o % executado.
  // Pontes (serviço contínuo): estado na vistoria (sem dano aparente, dano observado, em execução, N/A), estimativa do
  // dano, onde, e as marcas de prioridade e de conclusão informada
  function servHtml(p, list, extra) {
    var id = esc(p.id), h = propHtml(active().id, p), prop = propServ(active().id, p.id), oae = list === OAE_SERVICES;
    list.forEach(function (s) {
      var sv = p.serv[s.key] || (oae ? { st: 'NV' } : { st: 'NA', pct: 0 }), pv = prop[s.key], cur = oae ? oaeSt(sv) : sv.st;
      var segs = (oae ? OAE_STATUS_ORDER : STATUS_ORDER).map(function (k) {
        var pend = pv && pv.st === k && cur !== k ? ' pend' : '';
        return '<button type="button" class="' + k + pend + '" data-act="set-st" data-id="' + id + '" data-svc="' + s.key + '" data-st="' + k + '" aria-pressed="' + (cur === k) + '"' + (pend ? ' title="Aguardando aprovação"' : '') + '>' + (oae ? oaeStOf(s, k) : STATUS[k]).btn + '</button>';
      }).join('');
      if (oae) {
        var on = comQtd(cur);
        h += '<div class="svc oae"><div class="svc-name">' + esc(s.short) + (s.q ? ' <small class="svc-un">' + esc(s.q + ' (estimativa)') + '</small>' : '') +
          (cur === 'NV' ? ' <small class="svc-nv">sem vistoria</small>' : '') + (extra ? extra(s) : '') + '</div>' +
          '<div class="seg" role="group" aria-label="' + esc(s.short) + '">' + segs + '</div>' +
          (s.un ? '<div class="pct-in"><input type="number" min="0"' + (s.un === '%' ? ' max="100"' : '') + ' step="any" inputmode="decimal" data-svcpct="' + s.key + '" data-id="' + id + '" value="' + (on && sv.q != null ? esc(sv.q) : '') + '"' +
            (on ? ' placeholder="estimativa"' : ' disabled') + ' aria-label="' + esc(s.short + ': estimativa, ' + s.q) + '"><span>' + esc(s.un) + '</span></div>' : '<div class="pct-in"></div>') +
          (on ? '<input class="svc-nota" type="text" maxlength="140" data-svcpct="' + s.key + '" data-nota="1" data-id="' + id + '" value="' + esc(sv.n || '') + '" placeholder="Onde / o quê (opcional)" aria-label="' + esc('Onde ou o quê: ' + s.short) + '">' +
            '<div class="svc-marcas">' + Object.keys(OAE_MARCAS).map(function (m) {
              var pm = pv && comQtd(pv.st) && !!pv[m] !== !!sv[m] ? ' pend' : '';
              return '<button type="button" class="marca ' + m + pm + '" data-act="set-marca" data-id="' + id + '" data-svc="' + s.key + '" data-m="' + m + '" aria-pressed="' + !!sv[m] + '" title="' + esc(OAE_MARCAS[m].title + (pm ? ' (aguardando aprovação)' : '')) + '">' +
                '<i aria-hidden="true">' + (m === 'pri' ? '!' : '✓') + '</i>' + esc(OAE_MARCAS[m].name) + '</button>';
            }).join('') + '</div>' : '') +
          '</div>';
        return;
      }
      var pctDisabled = (sv.st === 'OK' || sv.st === 'NA');
      h += '<div class="svc"><div class="svc-name">' + esc(s.short) + (extra ? extra(s) : '') + '</div><div class="seg" role="group" aria-label="' + esc(s.short) + '">' + segs + '</div>' +
        '<div class="pct-in"><input type="number" min="0" max="100" step="1" data-svcpct="' + s.key + '" data-id="' + id + '" value="' + (pctDisabled ? (sv.st === 'OK' ? 100 : '') : (Number(sv.pct) || 0)) + '"' + (pctDisabled ? ' disabled' : '') + ' aria-label="Percentual executado de ' + esc(s.short) + '"><span>%</span></div></div>';
    });
    return h;
  }

  function pointCard(p) {
    if (isOae(ownerOf(p))) return ponteCard(p, ownerOf(p));
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
      h += servHtml(p, SERVICES);

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
      h += '<div class="pt-foot"><span class="pt-foot-l">' + (galeriaOn() ? '<button type="button" class="btn small" data-act="fotos-ponto" data-id="' + id + '">Fotos deste ponto</button>' : '') +
        '<button type="button" class="btn small" data-act="dup-point" data-id="' + id + '">Duplicar ponto</button></span><button type="button" class="btn small danger" data-act="del-point" data-id="' + id + '">Excluir ponto</button></div>';
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

  // ------------------------------------------------------------------ análise das medições (contratos de pontes)
  // Fica numa tabela sem leitura pública; só engenheiro e criador recebem (Banco.analise). Guardada no aparelho
  // enquanto a pessoa estiver entrada como engenheiro ou criador, para abrir sem sinal; sai junto com a sessão.
  var AN_KEY = 'diagrama-linear.analise';
  var analise = { dados: {}, estado: {} };   // estado[cid]: carregando | ok | vazia | erro
  function analiseInit() {
    var x = isEng() ? lsGet(AN_KEY) : null;
    analise = { dados: x && x.dados && typeof x.dados === 'object' ? x.dados : {}, estado: {} };
    if (!isEng()) lsPut(AN_KEY, null);
  }
  // Alerta da análise (por ponte): a ponte atendida mais de uma vez na mesma etapa. Passagem = medições seguidas com
  // serviço na ponte (uma passagem pode atravessar o mês). O PTO prevê uma passagem por estrutura em cada etapa, então
  // toda volta na mesma etapa é alerta para conferência; o intervalo até a volta e o valor medido depois da 1ª passagem
  // aparecem como informação. Entre etapas não é alerta: cada etapa pode refazer o serviço (pintar tudo de novo).
  // Exceção: juntas e pingadeiras refeitas em menos de 1 ano são alerta (deveriam durar mais), mesmo entre etapas.
  // Os alertas por serviço da análise (repetição, juntas além do comprimento, garantia) não aparecem.
  // A tela pode mostrar uma etapa só (seletor guardado no aparelho); o PDF mostra sempre todas.
  var ETAPA_KEY = 'diagrama-linear.etapa-analise', EST_ETAPA = 1;   // o Anexo VI do edital estima só a 1ª etapa
  var etapaSel = Number(lsGet(ETAPA_KEY)) || 0;                      // 0 = todas as etapas
  lsPut('diagrama-linear.janela', null);                             // seletor antigo (3/6/12 meses)
  var anCache = { raw: null, view: null };
  function anOf(c) {
    var raw = c && isOae(c) && isEng() ? analise.dados[c.id] || null : null;
    if (!raw) return null;
    if (anCache.raw !== raw) anCache = { raw: raw, view: anCalc(raw) };
    return anCache.view;
  }
  function anCalc(raw) {
    var meds = (raw.medicoes || []).slice().sort(function (x, y) { return x.n - y.n; }), mes = {}, info = {}, etapas = [], porEtapa = {};
    meds.forEach(function (m) {
      info[m.n] = m;
      var r = String(m.ref || ''); if (/^\d{4}-\d{2}/.test(r)) mes[m.n] = Number(r.slice(0, 4)) * 12 + Number(r.slice(5, 7));
      if (!porEtapa[m.etapa]) { porEtapa[m.etapa] = { etapa: m.etapa, ns: [], de: m.mes, ate: m.mes, total: 0 }; etapas.push(porEtapa[m.etapa]); }
      var e = porEtapa[m.etapa]; e.ns.push(m.n); e.ate = m.mes; e.total += Number(m.total) || 0;
    });
    function medsDe(t) { var ns = []; String(t || '').replace(/(\d+)ª/g, function (_, d) { ns.push(Number(d)); }); return ns; }
    function trecho(r) {
      var a0 = info[r[0]], a1 = info[r[r.length - 1]];
      return r.length === 1 ? r[0] + 'ª (' + (a0 && a0.mes || '') + ')' : r[0] + 'ª a ' + r[r.length - 1] + 'ª (' + (a0 && a0.mes || '') + ' a ' + (a1 && a1.mes || '') + ')';
    }
    var pontes = {}, total = 0, comAlerta = 0;
    Object.keys(raw.pontes || {}).forEach(function (pid) {
      var a = raw.pontes[pid], mx = {}, grupos = {}, als = [], et = {};
      Object.keys(a.grupos || {}).forEach(function (k) { grupos[k] = Object.assign({}, a.grupos[k], { altos: 0 }); });
      etapas.forEach(function (e) {
        var ns = e.ns.filter(function (n) { return Number(a.meses && a.meses[String(n)]) > 0; }), at = [], gap = null, v = 0, rep = 0;
        ns.forEach(function (n) { var u = at[at.length - 1]; if (u && n === u[u.length - 1] + 1) u.push(n); else at.push([n]); });
        ns.forEach(function (n) { v += Number(a.meses[String(n)]) || 0; });
        at.slice(1).forEach(function (r) { r.forEach(function (n) { rep += Number(a.meses[String(n)]) || 0; }); });
        // a volta mais rápida: do fim de uma passagem ao começo da seguinte, em meses
        for (var i = 1; i < at.length; i++) {
          var d = mes[at[i][0]] - mes[at[i - 1][at[i - 1].length - 1]];
          if (isFinite(d) && (gap == null || d < gap)) gap = d;
        }
        et[e.etapa] = { ns: ns, v: v, passagens: at, trechos: at.map(trecho), gap: gap, rep: rep };
        if (at.length < 2) return;
        var et_ = e.etapa;
        als.push({ tipo: 'atendimentos', sev: 'Alta', etapa: et_, etapas: [et_], vezes: at.length, valor: v, rep: rep, gap: gap, meds: ns.map(function (n) { return n + 'ª'; }).join(', '),
          servico: 'Atendida ' + at.length + ' vezes na ' + et_ + 'ª etapa', tipoNome: 'mais de uma passagem na mesma etapa', trechos: at.map(trecho).join(' · '),
          motivo: at.map(trecho).join(' · ') + '; o PTO prevê uma passagem por estrutura em cada etapa' });
        ns.forEach(function (n) { mx[n] = 1; });
        // grupos com serviço medido em mais de uma passagem dessa etapa
        (a.servicos || []).forEach(function (s) {
          if (!s.g || !grupos[s.g]) return;
          var vis = {};
          medsDe(s.meds).forEach(function (n) { at.forEach(function (r, j) { if (r.indexOf(n) >= 0) vis[j] = 1; }); });
          if (Object.keys(vis).length > 1) { grupos[s.g].altos++; grupos[s.g].alerta = grupos[s.g].alerta || 'medido em mais de uma passagem na etapa'; }
        });

      });
      // juntas e pingadeiras deveriam durar mais: refeitas em menos de 1 ano é alerta, mesmo de uma etapa para outra
      var sj = (a.servicos || []).filter(function (s) { return s.g === 'juntas' && s.v > 0; }), nj = [];
      sj.forEach(function (s) { medsDe(s.meds).forEach(function (n) { if (nj.indexOf(n) < 0) nj.push(n); }); });
      nj.sort(function (x, y) { return x - y; });
      var pj = [];
      nj.forEach(function (n) { var u = pj[pj.length - 1]; if (u && n === u[u.length - 1] + 1) u.push(n); else pj.push([n]); });
      var volta = [], gj = null;
      for (var j = 1; j < pj.length; j++) {
        var dj = mes[pj[j][0]] - mes[pj[j - 1][pj[j - 1].length - 1]];
        if (isFinite(dj) && dj < 12) {
          if (volta.indexOf(pj[j - 1]) < 0) volta.push(pj[j - 1]);
          volta.push(pj[j]);
          if (gj == null || dj < gj) gj = dj;
        }
      }
      if (volta.length) {
        var vj = sj.reduce(function (t, s) { return t + s.v; }, 0);
        var etJ = [];
        volta.forEach(function (r) { r.forEach(function (n) { var e = info[n] && info[n].etapa; if (e != null && etJ.indexOf(e) < 0) etJ.push(e); }); });
        als.push({ tipo: 'juntas12', sev: 'Alta', valor: vj, gap: gj, etapas: etJ, meds: nj.map(function (n) { return n + 'ª'; }).join(', '),
          servico: 'Juntas refeitas em menos de 1 ano', tipoNome: 'junta ou pingadeira medida de novo em menos de 12 meses',
          trechos: 'voltaram em ' + gj + (gj === 1 ? ' mês: ' : ' meses: ') + volta.map(trecho).join(' · '),
          motivo: 'juntas medidas na ' + volta.map(trecho).reduce(function (t, x, i, l) { return t + (i ? (i === l.length - 1 ? ' e na ' : ', na ') : '') + x; }, '') + ' (' + sj.map(function (s) { return s.nome; }).join(', ') + '); deveriam durar mais de um ano' });
        volta.forEach(function (r) { r.forEach(function (n) { mx[n] = 1; }); });
        if (grupos.juntas) { grupos.juntas.altos++; grupos.juntas.alerta = 'refeita em menos de 1 ano'; }
      }
      if (als.length) comAlerta++;
      total += als.length;
      pontes[pid] = Object.assign({}, a, { alertas: als, aa: als.length, al: als.length, grupos: grupos, et: et, mx: Object.keys(mx).map(Number).sort(function (x, y) { return x - y; }) });
    });
    return Object.assign({}, raw, { pontes: pontes, etapas: etapas, resumo: Object.assign({}, raw.resumo, { altos: total, alertas: total, pontesAlerta: comAlerta }) });
  }
  // etapa mostrada na tela (0 = todas), se existir nesta análise
  function etapaDe(an) { return etapaSel && an && (an.etapas || []).some(function (e) { return e.etapa === etapaSel; }) ? etapaSel : 0; }
  function etapaInfo(an, n) { var r = null; ((an && an.etapas) || []).forEach(function (e) { if (e.etapa === n) r = e; }); return r; }
  // alertas da ponte que tocam a etapa (E = 0: todos)
  function alertasEm(a, E) { return ((a && a.alertas) || []).filter(function (x) { return !E || (x.etapas || []).indexOf(E) >= 0; }); }
  function pctTxt(v) { return (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10).toLocaleString('pt-BR') + '%'; }
  function nomePonte(p) { return (p.nome || '?') + (p.codigo ? ' · ' + p.codigo : ''); }
  // por etapa: pontes atendidas, as sem serviço, as atendidas mais de uma vez e o executado × estimado do Anexo VI
  function coberturaEtapas(c, an) {
    var r = {}, ps = sortedPoints(c);
    (an.etapas || []).forEach(function (e) {
      var x = { etapa: e.etapa, total: ps.length, atend: 0, falta: [], rep: [], v: 0, est: [] };
      ps.forEach(function (p) {
        var a = an.pontes ? an.pontes[p.id] : null, i = a && a.et ? a.et[e.etapa] : null;
        if (!i || !i.ns.length) x.falta.push(p);
        else { x.atend++; x.v += i.v; if (i.passagens.length > 1) x.rep.push({ p: p, i: i }); }
        if (e.etapa === EST_ETAPA && a && a.est > 0) x.est.push({ p: p, est: a.est, v: i ? i.v : 0, pct: (i ? i.v : 0) / a.est * 100 });
      });
      x.rep.sort(function (u, w) { return w.i.rep - u.i.rep; });
      x.est.sort(function (u, w) { return w.pct - u.pct; });
      r[e.etapa] = x;
    });
    return r;
  }
  function carregarAnalise(c) {
    if (!c || !isOae(c) || !banco.on || !isEng() || !window.Banco || !window.Banco.analise) return;
    var e = analise.estado[c.id];
    if (e === 'carregando' || e === 'ok' || e === 'vazia' || e === 'erro') return;   // erro: só de novo ao trocar de aba ou voltar ao app
    analise.estado[c.id] = 'carregando';
    var cred = banco.login.codigo, cid = c.id;
    window.Banco.analise(cred, cid).then(function (r) {
      if (!banco.login || banco.login.codigo !== cred) return;
      if (r && r.dados && typeof r.dados === 'object') {
        analise.dados[cid] = r.dados;
        analise.dados[cid].sobre = { fonte: r.fonte || '', em: r.em || null, por: r.por || '' };
        analise.estado[cid] = 'ok';
      } else {
        delete analise.dados[cid];
        analise.estado[cid] = 'vazia';
      }
      lsPut(AN_KEY, { dados: analise.dados });
      if (active() && active().id === cid) { renderEditor(); renderPreview(); }
    }, function (err) {
      analise.estado[cid] = 'erro';
      // sessão encerrada ou papel trocado em outro aparelho: reconfere o acesso (que tira a análise deste aparelho)
      if (err && (err.code === 'codigo_invalido' || err.code === 'sem_permissao')) { conferirAcesso(); return; }
      if (active() && active().id === cid) renderEditor();
    });
  }
  function fmtIsoDate(iso) { return iso ? fmtDate(String(iso).slice(0, 10)) : ''; }

  // no resumo: com "Todas", uma linha por etapa; com uma etapa, as pontes sem serviço, as atendidas mais de uma vez e
  // (na 1ª etapa) o executado × estimado do Anexo VI. Tocar numa ponte abre o cartão dela.
  function etapasHtml(an, cob, E) {
    var h = '';
    function pChip(p) { return '<button type="button" class="an-pchip" data-act="an-ir" data-id="' + esc(p.id) + '">' + esc(p.nome || p.codigo || '?') + (p.kmIni != null ? ' <small>km ' + esc(fmtKm(p.kmIni)) + '</small>' : '') + '</button>'; }
    function estRow(y) {
      return '<button type="button" class="an-prow" data-act="an-ir" data-id="' + esc(y.p.id) + '"><span><b>' + esc(nomePonte(y.p)) + '</b><small>executado ' + fmtBRL(y.v) + ' de ' + fmtBRL(y.est) + ' estimados' + (y.v > y.est ? ' · <span class="an-over">' + fmtBRL(y.v - y.est) + ' acima</span>' : '') + '</small></span>' +
        '<span class="an-v"><b' + (y.pct > 100 ? ' class="an-over"' : '') + '>' + pctTxt(y.pct) + '</b></span></button>';
    }
    if (!E) {
      h += '<div class="an-sec"><h4>Por etapa</h4>' + (an.etapas || []).map(function (e) {
        var x = cob[e.etapa], acima = x.est.filter(function (y) { return y.pct > 100; }).length;
        return '<button type="button" class="an-etrow" data-act="an-etapa" data-v="' + e.etapa + '"><span><b>' + e.etapa + 'ª etapa</b> · ' + esc(e.de + ' a ' + e.ate) + ' · ' + e.ns.length + ' medições · ' + fmtBRL(x.v) + ' nas pontes</span>' +
          '<small>' + x.atend + ' de ' + x.total + ' pontes atendidas' + (x.falta.length ? ' · <span class="an-over">' + x.falta.length + ' sem serviço</span>' : '') +
          ' · ' + (x.rep.length ? '<span class="an-over">' + x.rep.length + (x.rep.length === 1 ? ' atendida' : ' atendidas') + ' mais de uma vez</span>' : 'nenhuma atendida mais de uma vez') +
          (x.est.length ? ' · ' + acima + (acima === 1 ? ' acima' : ' acima') + ' do estimado no Anexo VI' : '') + '</small></button>';
      }).join('') + '</div>';
      return h;
    }
    var x = cob[E];
    h += '<div class="an-sec"><h4>Sem serviço nesta etapa (' + x.falta.length + ')</h4>' + (x.falta.length ? '<div class="an-pchips">' + x.falta.map(pChip).join('') + '</div>'
      : '<div class="empty">Todas as ' + x.total + ' pontes tiveram serviço nesta etapa.</div>') + '</div>';
    h += '<div class="an-sec"><h4>Atendidas mais de uma vez nesta etapa (' + x.rep.length + ')</h4>' + (x.rep.length ? x.rep.map(function (y) {
      return '<button type="button" class="an-prow" data-act="an-ir" data-id="' + esc(y.p.id) + '"><span><b>' + esc(nomePonte(y.p)) + '</b><small>' + y.i.passagens.length + ' passagens: ' + esc(y.i.trechos.join(' · ')) +
        (y.i.gap != null ? ' · voltou em ' + y.i.gap + (y.i.gap === 1 ? ' mês' : ' meses') : '') + '</small></span>' +
        '<span class="an-v"><b>' + fmtBRL(y.i.rep) + '</b><small>depois da 1ª passagem</small></span></button>';
    }).join('') : '<div class="empty">Nenhuma ponte atendida mais de uma vez nesta etapa.</div>') + '</div>';
    if (x.est.length) {
      var ac = x.est.filter(function (y) { return y.pct > 100; }), ou = x.est.filter(function (y) { return y.pct <= 100; });
      var tv = x.est.reduce(function (t, y) { return t + y.v; }, 0), te = x.est.reduce(function (t, y) { return t + y.est; }, 0);
      h += '<div class="an-sec"><h4>Executado × estimado no Anexo VI</h4><div class="an-line">' + ac.length + ' de ' + x.est.length + ' pontes passaram do estimado · executado ' + fmtBRL(tv) + ' de ' + fmtBRL(te) + ' estimados (' + pctTxt(tv / te * 100) + ')</div>' +
        ac.map(estRow).join('') + (ou.length ? '<details class="an-mais"><summary>As outras ' + ou.length + ' pontes (até 100% do estimado)</summary>' + ou.map(estRow).join('') + '</details>' : '') + '</div>';
    }
    return h;
  }
  function analiseResumoHtml(c) {
    if (!banco.on) return '';
    if (!isEng()) {
      return '<div class="an-note">Os valores medidos e os alertas da análise das medições aparecem para engenheiros e para o Administrador.' +
        (banco.login ? '' : ' Entre para ver.') + '</div>';
    }
    var an = anOf(c), e = analise.estado[c.id];
    if (!an) {
      var t = e === 'carregando' || !e ? 'Carregando a análise das medições…' : e === 'erro' ? 'Não foi possível carregar a análise das medições agora. Ela volta a ser pedida quando você trocar de aba ou voltar ao app.' : 'Nenhuma análise das medições cadastrada para este contrato.';
      return '<div class="an-note">' + esc(t) + '</div>';
    }
    var r = an.resumo || {}, sobre = an.sobre || {}, E = etapaDe(an), ei = etapaInfo(an, E), cob = coberturaEtapas(c, an), nAl = 0, pAl = 0;
    c.pontos.forEach(function (p) { var k = alertasEm(an.pontes ? an.pontes[p.id] : null, E).length; nAl += k; if (k) pAl++; });
    var kp = [
      E ? ['Medido na ' + E + 'ª etapa', fmtBRL(ei.total || cob[E].v), ei.ns.length + ' medições · ' + ei.de + ' a ' + ei.ate + ' · ' + fmtBRL(cob[E].v) + ' nas pontes']
        : ['Medido a preços iniciais', fmtBRL(r.total), r.n + ' medições · ' + r.de + ' a ' + r.ate],
      ['Alertas para conferência', String(nAl), (pAl ? 'em ' + pAl + (pAl === 1 ? ' ponte · ' : ' pontes · ') : '') + 'ponte atendida mais de uma vez na mesma etapa, ou juntas refeitas em menos de 1 ano']
    ];
    if (E) kp.push(['Pontes atendidas', cob[E].atend + ' de ' + cob[E].total, cob[E].falta.length ? cob[E].falta.length + ' sem serviço nesta etapa' : 'todas tiveram serviço nesta etapa']);
    var h = '<section class="card an-card"><div class="an-head"><b>Análise das medições</b><span class="sub">' +
      (sobre.em ? 'atualizada em ' + esc(fmtIsoDate(sobre.em)) : '') + ' · visível só para engenheiros e o Administrador</span></div>';
    var ets = an.etapas || [];
    h += '<div class="an-jan"><span id="anEtTit">Mostrar</span><div class="seg an-etapas" role="group" aria-labelledby="anEtTit" style="grid-template-columns:repeat(' + (ets.length + 1) + ',minmax(0,1fr))">' +
      '<button type="button" data-act="an-etapa" data-v="0" aria-pressed="' + !E + '">Todas<small>' + esc((r.de || '') + ' a ' + (r.ate || '')) + '</small></button>' +
      ets.map(function (e) { return '<button type="button" data-act="an-etapa" data-v="' + e.etapa + '" aria-pressed="' + (E === e.etapa) + '">' + e.etapa + 'ª etapa<small>' + esc(e.de + ' a ' + e.ate) + '</small></button>'; }).join('') + '</div></div>';
    h += '<div class="an-kpis">' + kp.map(function (k) {
      return '<div class="an-kpi"><span>' + esc(k[0]) + '</span><b>' + esc(k[1]) + '</b><small>' + esc(k[2]) + '</small></div>';
    }).join('') + '</div>';
    h += etapasHtml(an, cob, E);
    if (sobre.fonte) h += '<div class="an-src">Fonte: ' + esc(sobre.fonte) + '.</div>';
    // as notas de critérios que não valem mais na tela (garantia, carta das juntas, comprimento das juntas, vegetação) saem
    var notas = [{ assunto: 'Alertas desta tela', texto: 'Alerta por ponte: atendida mais de uma vez na mesma etapa (uma passagem = medições seguidas com serviço); o PTO prevê uma passagem por estrutura em cada etapa. ' +
      'Cada alerta mostra quando a ponte voltou e o valor medido depois da 1ª passagem. Juntas e pingadeiras refeitas em menos de 1 ano também são alerta, mesmo de uma etapa para outra. ' +
      'Entre etapas, o resto não é alerta: cada etapa pode refazer o serviço. O estimado vem do Anexo VI do edital, que só traz a 1ª etapa. Indício a conferir.' }]
      .concat((an.notas || []).filter(function (n) { return !/^(garantia|carta|comprimento f|vegeta)/i.test(String(n.assunto || '')); }));
    if (notas.length) {
      h += '<details class="an-notas"><summary>Critérios dos alertas e ressalvas</summary><ol>' + notas.map(function (n) {
        return '<li><b>' + esc(n.assunto) + '.</b> ' + esc(n.texto) + '</li>';
      }).join('') + '</ol></details>';
    }
    return h + '</section>';
  }

  function ponteHead(p, c) {
    var dots = OAE_SERVICES.map(function (s) {
      var sv = p.serv[s.key], k = oaeSt(sv), qt = comQtd(k) ? fmtQtd(s, sv.q) : '';
      return '<span class="dot ' + k + '" title="' + esc(s.short + ': ' + oaeStOf(s, k).name + (qt ? ' · ' + qt : '') + (comQtd(k) && sv.pri ? ' · prioridade' : '') + (comQtd(k) && sv.ci ? ' · conclusão informada' : '')) + '"></span>';
    }).join('');
    var n = oaeNec(p), nc = n.dn ? 'dn' : n.exec ? 'exec' : (!n.aval || n.nv === n.aval) ? 'nv' : 'ok';
    var nt = n.dn ? n.dn + (n.dn === 1 ? ' dano' : ' danos') : n.exec ? 'em exec.' : nc === 'nv' ? '–' : 's/ dano';
    var an = anOf(c), a = an && an.pontes ? an.pontes[p.id] : null;
    var np = banco.on ? propsDo(c.id, p.id).length : 0;
    var badge = (n.pri ? '<b class="pt-pri" title="' + n.pri + (n.pri === 1 ? ' grupo com prioridade' : ' grupos com prioridade') + '">!</b>' : '') +
      (function () { var k = alertasEm(a, etapaDe(an)).length; return k ? '<b class="pt-al" title="' + k + (k === 1 ? ' alerta' : ' alertas') + ' na análise das medições">' + k + '</b>' : ''; })();
    return '<span class="pt-name">' + esc(p.nome || '?') + (np ? '<span class="pt-prop" title="Alteração aguardando aprovação" aria-label="aguardando aprovação"></span>' : '') + '</span>' +
      '<span class="pt-km">' + badge + esc(p.codigo || '') + (p.kmIni != null ? (p.codigo ? ' · ' : '') + 'km ' + (p.kmConferir ? '~' : '') + fmtKm(p.kmIni) : '') + '</span><span class="pt-dots">' + dots + '</span><span class="pt-pct nec-' + nc + '" title="' + esc(oaeNecTxt(n)) + '">' + nt + '</span>' + ICON_CHEV;
  }

  function ponteCard(p, c) {
    var open = !!ui.open[p.id];
    var h = '<article class="pt oae' + (open ? ' open' : '') + '" data-id="' + esc(p.id) + '">';
    h += '<button type="button" class="pt-head" data-act="toggle-point" data-id="' + esc(p.id) + '" aria-expanded="' + open + '">' + ponteHead(p, c) + '</button>';
    if (open) {
      var id = esc(p.id), an = anOf(c), a = an && an.pontes ? an.pontes[p.id] : null;
      h += '<div class="pt-body">' + (banco.on ? lastLine(metaKey(c.id, p.id)) : '') + '<div class="grid">';
      h += field('Nome da ponte', 'data-p="nome" data-id="' + id + '" type="text"', p.nome);
      h += field('Código (OAE)', 'data-p="codigo" data-id="' + id + '" type="text"', p.codigo);
      h += field('KM (SNV ' + ((window.SNV_BR230 && window.SNV_BR230.versao) || '') + ')' + (p.kmConferir ? ' · estimado, conferir em campo' : ''), 'data-p="kmIni" data-num="1" data-id="' + id + '" type="text" inputmode="decimal"', fmtKm(p.kmIni));
      h += field('KM do contrato (Anexo VI)', 'data-p="kmContrato" data-num="1" data-id="' + id + '" type="text" inputmode="decimal"', fmtKm(p.kmContrato));
      h += field('Município', 'data-p="municipio" data-id="' + id + '" type="text"', p.municipio);
      h += field('Extensão (m)', 'data-p="extensao" data-num="1" data-id="' + id + '" type="text" inputmode="decimal"', fmtN(p.extensao));
      h += field('Largura (m)', 'data-p="largura" data-num="1" data-id="' + id + '" type="text" inputmode="decimal"', fmtN(p.largura));
      h += '</div>';

      var vis = vistoriaPonte(c, p);
      h += '<div class="section-title">Estado da ponte' + (vis ? '<span class="sub-vis">vistoria ' + esc(fmtWhen(vis.em)) + (vis.por ? ' · ' + esc(vis.por) : '') + '</span>' : '') + '</div>';
      h += servHtml(p, OAE_SERVICES, function (s) {
        var gi = a && a.grupos ? a.grupos[s.key] : null;
        if (!gi) return '';
        return '<small class="svc-med' + (gi.altos ? ' al' : '') + '">' + (gi.ult ? 'última medição: ' + esc(medTxt(an, gi.ult)) : '') + (gi.altos ? ' · ' + esc(comMes(an, gi.alerta || 'alerta')) : '') + '</small>';
      });

      if (a) h += ponteAnaliseHtml(an, a, p.id);
      else if (banco.on && !isEng()) h += '<div class="an-note">As medições e os alertas desta ponte aparecem para engenheiros e para o Administrador.</div>';

      var tid = 'obs-' + id;
      h += '<div class="field"><label for="' + tid + '">Observações gerais</label><textarea id="' + tid + '" data-p="obs" data-id="' + id + '" rows="4">' + esc(p.obs) + '</textarea></div>';
      h += '<div class="pt-foot"><span class="pt-foot-l">' + (galeriaOn() ? '<button type="button" class="btn small" data-act="fotos-ponto" data-id="' + id + '">Fotos desta ponte</button>' : '') +
        '</span><button type="button" class="btn small danger" data-act="del-point" data-id="' + id + '">Excluir ponte</button></div>';
      h += '</div>';
    }
    return h + '</article>';
  }

  // curva ABC dos serviços medidos na ponte: A = os que somam os primeiros 80% do valor, B = até 95%, C = o resto.
  // A em destaque; C fica recolhido. Cada serviço mostra em quais medições foi medido nesta ponte.
  // Com uma medição escolhida no gráfico (med), a curva é só daquela medição: quantidade e valor de cada serviço nela
  // (campo "por" da análise: {"22": [quantidade, valor]}); sem esse campo, mostra os serviços dela com o total de cada um.
  function abcHtml(an, a, med) {
    var mesDe = {}, k = String(med || ''), base = (a.servicos || []).filter(function (s) { return s.v > 0; });
    (an.medicoes || []).forEach(function (m) { mesDe[m.n] = m.mes; });
    var temPor = base.some(function (s) { return s.por; }), sv = base, E = med ? 0 : etapaDe(an), ei = E ? etapaInfo(an, E) : null, Ev = etapaDe(an);
    if (med) {
      sv = base.filter(function (s) { return temPor ? !!(s.por && s.por[k]) : medsNums(s.meds).indexOf(med) >= 0; }).map(function (s) {
        return temPor ? Object.assign({}, s, { q: s.por[k][0], v: s.por[k][1] }) : s;
      });
    } else if (E) sv = noEscopo(base, ei.ns, temPor);
    var comEst = E === EST_ETAPA && temPor;
    sv = sv.slice().sort(function (x, y) { return y.v - x.v; });
    var h = '';
    if (med) {
      h += '<div class="section-title">Serviços · Curva ABC · ' + med + 'ª medição' + (mesDe[med] ? ' (' + esc(mesDe[med]) + ')' : '') + '</div>';
      h += '<div class="abc-filtro"><span>' + esc(temPor ? 'Só o que foi medido nesta ponte na ' + medTxt(an, med) + '.' : 'Serviços medidos na ' + medTxt(an, med) + ', com o total de cada um nesta ponte.') +
        '</span><button type="button" class="btn small" data-act="abc-todas">' + (Ev ? 'A ' + Ev + 'ª etapa inteira' : 'Todas as medições · ' + fmtBRL(a.tot)) + '</button></div>';
      if (!sv.length) return h + '<div class="an-note">Nenhum serviço medido nesta ponte na ' + esc(medTxt(an, med)) + '.</div>';
    } else if (E) {
      h += '<div class="section-title">Serviços · Curva ABC · ' + E + 'ª etapa (' + esc(ei.de + ' a ' + ei.ate) + ')</div>';
      h += '<div class="abc-filtro"><span>' + esc(temPor ? 'Só o que foi medido nesta ponte na ' + E + 'ª etapa' + (comEst ? ', com o estimado do Anexo VI.' : '.') : 'Serviços medidos na ' + E + 'ª etapa, com o total de cada um nesta ponte.') +
        '</span><button type="button" class="btn small" data-act="an-etapa" data-v="0">Todas as medições · ' + fmtBRL(a.tot) + '</button></div>';
      if (!sv.length) return h + '<div class="an-note">Nenhum serviço medido nesta ponte na ' + E + 'ª etapa.</div>';
    } else {
      if (!sv.length) return '';
      h += '<div class="section-title">Serviços · Curva ABC</div>';
    }
    var tot = sv.reduce(function (t, s) { return t + s.v; }, 0), acum = 0, cls = { A: [], B: [], C: [] };
    sv.forEach(function (s) {
      var k = acum / tot < 0.8 ? 'A' : acum / tot < 0.95 ? 'B' : 'C';
      acum += s.v;
      cls[k].push({ s: s, pct: s.v / tot * 100, ac: acum / tot * 100, k: k });
    });
    function pct(v) { return (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10).toLocaleString('pt-BR') + '%'; }
    function soma(l) { return l.reduce(function (t, x) { return t + x.pct; }, 0); }
    function meds(t) {
      var ns = medsNums(t).filter(function (n) { return !E || ei.ns.indexOf(n) >= 0; });
      return ns.length ? '<span class="abc-meds">' + ns.map(function (n) {
        return '<i' + (n === med ? ' class="sel"' : '') + '>' + n + 'ª' + (mesDe[n] ? ' <small>(' + esc(mesDe[n]) + ')</small>' : '') + '</i>';
      }).join('') + '</span>' : '';
    }
    // à direita, a quantidade medida em destaque e o valor pequeno embaixo (a classe A/B/C continua sendo pelo valor)
    function linha(x) {
      return '<div class="abc-r ' + x.k.toLowerCase() + '"><span class="abc-c" aria-label="classe ' + x.k + '">' + x.k + '</span>' +
        '<div class="abc-n"><span class="abc-t">' + esc(x.s.nome) + '</span>' + meds(x.s.meds) +
        '<span class="abc-bar"><i style="width:' + Math.max(1.5, x.pct).toFixed(1) + '%"></i></span></div>' +
        '<div class="abc-v" title="' + pct(x.pct) + ' do valor · acumulado ' + pct(x.ac) + '"><b>' + fmtN(x.s.q) + ' <span class="abc-un">' + esc(x.s.un) + '</span></b>' +
        '<small>' + fmtBRL(x.s.v) + ' · ' + pct(x.pct) + '</small>' +
        (comEst && x.s.est > 0 ? '<small' + (x.s.q > x.s.est ? ' class="an-over"' : '') + '>estimado ' + fmtN(x.s.est) + ' ' + esc(x.s.un) + '</small>' : '') + '</div></div>';
    }
    h += '<div class="abc-res">' + ['A', 'B', 'C'].filter(function (k) { return cls[k].length; }).map(function (k) {
      return '<span class="abc-tag ' + k.toLowerCase() + '"><b>' + k + '</b> ' + cls[k].length + (cls[k].length === 1 ? ' serviço' : ' serviços') + ' · ' + pct(soma(cls[k])) + '</span>';
    }).join('') + '</div>';
    h += '<div class="abc">' + cls.A.map(linha).join('') + cls.B.map(linha).join('');
    if (cls.C.length) h += '<details class="abc-mais"><summary>Classe C: ' + cls.C.length + (cls.C.length === 1 ? ' serviço' : ' serviços') + ' · ' + pct(soma(cls.C)) + ' do valor</summary>' + cls.C.map(linha).join('') + '</details>';
    h += '</div>';
    if (!med && !E) h += compHtml(an, base, temPor);
    return h;
  }
  // cada serviço somado nas medições ns (campo "por"); sem "por", os serviços medidos nelas, com o total de cada um
  function noEscopo(base, ns, temPor) {
    return base.map(function (s) {
      if (!temPor) return medsNums(s.meds).some(function (n) { return ns.indexOf(n) >= 0; }) ? s : null;
      var q = 0, v = 0, tem = false;
      ns.forEach(function (n) { var p = s.por && s.por[String(n)]; if (p) { tem = true; q += Number(p[0]) || 0; v += Number(p[1]) || 0; } });
      return tem ? Object.assign({}, s, { q: q, v: v }) : null;
    }).filter(Boolean);
  }
  // serviços por etapa, lado a lado: quantidade (e valor) de cada serviço em cada etapa; marca os medidos em mais de uma
  function compHtml(an, base, temPor) {
    var ets = an.etapas || [];
    if (!temPor || ets.length < 2) return '';
    var rows = base.map(function (s) {
      var cel = ets.map(function (e) { var x = noEscopo([s], e.ns, true)[0]; return x ? { q: x.q, v: x.v } : null; });
      return { s: s, cel: cel, n: cel.filter(Boolean).length };
    }).sort(function (x, y) { return y.s.v - x.s.v; });
    var varias = rows.filter(function (r) { return r.n > 1; }).length;
    return '<details class="an-comp"><summary>Serviços por etapa · ' + rows.length + (rows.length === 1 ? ' serviço' : ' serviços') + (varias ? ' · ' + varias + ' medidos em mais de uma etapa' : '') + '</summary>' +
      '<div class="an-comp-t" style="grid-template-columns:minmax(0,1fr) repeat(' + ets.length + ',minmax(66px,auto))"><span class="h">Serviço</span>' +
      ets.map(function (e) { return '<span class="h n">' + e.etapa + 'ª etapa</span>'; }).join('') +
      rows.map(function (r) {
        return '<span class="t">' + esc(r.s.nome) + (r.n > 1 ? ' <i class="an-rep">em ' + r.n + ' etapas</i>' : '') + '</span>' + r.cel.map(function (x) {
          return '<span class="n">' + (x ? '<b>' + fmtN(x.q) + ' <small>' + esc(r.s.un) + '</small></b><small>' + fmtBRL(x.v) + '</small>' : '–') + '</span>';
        }).join('');
      }).join('') + '</div></details>';
  }
  function medsNums(t) { var ns = []; String(t || '').replace(/(\d+)ª/g, function (_, d) { ns.push(Number(d)); }); return ns; }
  // medição citada sempre com o mês e o ano: "25ª (mar/26)" (os meses vêm da análise)
  function mesMed(an, n) { var m = null; ((an && an.medicoes) || []).forEach(function (x) { if (x.n === Number(n)) m = x; }); return m && m.mes ? m.mes : ''; }
  function medTxt(an, n) { var mm = mesMed(an, n); return n + 'ª' + (mm ? ' (' + mm + ')' : ''); }
  // nos textos que vêm prontos da análise: cada "Nª" de medição ganha o mês (etapa e o que já tem mês ficam como estão)
  function comMes(an, t) {
    return String(t == null ? '' : t).replace(/(\d+)ª(?!\s*(etapa|\(|saída))/g, function (x, n) { var mm = mesMed(an, n); return mm ? x + ' (' + mm + ')' : x; });
  }
  var DET0 = 'Toque numa barra para ver só aquela medição.';
  function detTxt(med) { return med ? 'Toque de novo na barra da ' + medTxt(anOf(active()), med) + ' ou em “Todas as medições” para voltar ao total.' : DET0; }
  // topo de "Medições nesta ponte": "Todas as medições" com a soma, ou só os dados da medição escolhida no gráfico
  function topoHtml(an, a, med) {
    var ms = an.medicoes || [], m = null, h = '', k = String(med || ''), E = etapaDe(an);
    ms.forEach(function (x) { if (x.n === med) m = x; });
    var v = m ? Number(a.meses[k]) || 0 : 0;
    h += '<div class="an-esc"><button type="button" class="an-chip' + (!m && !E ? ' on' : '') + '" data-act="an-etapa" data-v="0" aria-pressed="' + (!m && !E) + '">Todas <b>' + fmtBRL(a.tot) + '</b></button>' +
      (an.etapas || []).map(function (e) {
        var on = !m && E === e.etapa, i = a.et && a.et[e.etapa];
        return '<button type="button" class="an-chip' + (on ? ' on' : '') + '" data-act="an-etapa" data-v="' + e.etapa + '" aria-pressed="' + on + '">' + e.etapa + 'ª etapa <b>' + fmtBRL(i ? i.v : 0) + '</b></button>';
      }).join('') +
      (m ? '<span class="an-chip on">' + esc(medTxt(an, m.n)) + ' <b>' + fmtBRL(v) + '</b></span>' : '') + '</div>';
    if (m) {
      var sv = (a.servicos || []).filter(function (s) { return s.v > 0; }), temPor = sv.some(function (s) { return s.por; });
      var nsv = sv.filter(function (s) { return temPor ? !!(s.por && s.por[k]) : medsNums(s.meds).indexOf(m.n) >= 0; }).length;
      h += '<div class="an-line">' + (m.etapa ? esc(m.etapa) + 'ª etapa · ' : '') +
        (v ? nsv + (nsv === 1 ? ' serviço medido' : ' serviços medidos') + ' nesta ponte' : 'sem serviço nesta ponte') +
        ((a.mx || []).indexOf(m.n) >= 0 ? ' · <span class="an-over">medição com alerta</span>' : '') + '</div>';
      return h;
    }
    // executado × estimado do Anexo VI (só existe para a 1ª etapa)
    var estL = '', i1 = a.et && a.et[EST_ETAPA];
    if (a.est > 0 && (!E || E === EST_ETAPA)) {
      var pc = (i1 ? i1.v : 0) / a.est * 100;
      estL = '<div class="an-line">Anexo VI (' + EST_ETAPA + 'ª etapa): estimado <b>' + fmtBRL(a.est) + '</b> · executado ' + fmtBRL(i1 ? i1.v : 0) +
        ' (<span' + (pc > 100 ? ' class="an-over"' : '') + '>' + pctTxt(pc) + '</span>)</div>';
    }
    if (E) {
      var i = a.et && a.et[E], ei = etapaInfo(an, E);
      if (!i || !i.ns.length) h += '<div class="an-line"><span class="an-over">Sem serviço nesta ponte na ' + E + 'ª etapa</span> (' + esc(ei.de + ' a ' + ei.ate) + ').</div>';
      else h += '<div class="an-line">' + (i.passagens.length > 1 ? '<span class="an-over">' + i.passagens.length + ' passagens</span>' : '1 passagem') + ': ' + esc(i.trechos.join(' · ')) +
        (i.passagens.length > 1 ? (i.gap != null ? ' · voltou em ' + i.gap + (i.gap === 1 ? ' mês' : ' meses') : '') + ' · <b>' + fmtBRL(i.rep) + '</b> depois da 1ª passagem' : '') + '</div>';
      return h + estL;
    }
    var ult = ms.filter(function (x) { return Number(a.meses[String(x.n)]) > 0; }).slice(-3).reverse();
    if (ult.length) h += '<div class="an-line">Últimas com serviço: ' + ult.map(function (x) { return x.n + 'ª (' + esc(x.mes) + ') ' + fmtBRL(Number(a.meses[String(x.n)])); }).join(' · ') + '</div>';
    return h + estL;
  }
  // troca o topo e a curva ABC da ponte aberta, pela medição escolhida no gráfico (ou todas)
  function abcTrocar(art) {
    var pid = art && art.dataset.id, an = anOf(active()), a = an && an.pontes ? an.pontes[pid] : null;
    if (!a) return;
    var box = art.querySelector('.abc-box'), topo = art.querySelector('.an-topo');
    if (box) box.innerHTML = abcHtml(an, a, ui.medSel[pid]);
    if (topo) topo.innerHTML = topoHtml(an, a, ui.medSel[pid]);
  }
  // medições da ponte (barras por medição), serviços pela curva ABC e alertas
  function ponteAnaliseHtml(an, a, pid) {
    var ms = an.medicoes || [], mx = {}, max = 0, h = '', sel = ui.medSel[pid] || null, E = etapaDe(an);
    (a.mx || []).forEach(function (n) { mx[n] = 1; });
    ms.forEach(function (m) { max = Math.max(max, Number(a.meses[String(m.n)]) || 0); });
    // só o histórico: total, por etapa e as últimas medições com serviço (sem comparar com o estimado do Anexo VI)
    if (sel && !ms.some(function (m) { return m.n === sel; })) sel = null;
    h += '<div class="section-title">Medições nesta ponte</div>';
    h += '<div class="an-topo">' + topoHtml(an, a, sel) + '</div>';
    var corte = -1;
    ms.forEach(function (m, i) { if (corte < 0 && i > 0 && m.etapa !== ms[i - 1].etapa) corte = i; });
    // cada barra é um botão: no celular não há "passar o mouse", então o toque mostra a medição embaixo do gráfico
    h += '<div class="an-graf"><div class="an-bars" role="group" aria-label="Valor medido nesta ponte em cada medição">' + ms.map(function (m, i) {
      var v = Number(a.meses[String(m.n)]) || 0, alt = v ? Math.max(4, Math.round(v / max * 100)) : 0, it = a.itens && a.itens[String(m.n)];
      var tip = m.n + 'ª medição (' + m.mes + ')' + (m.etapa ? ' · ' + m.etapa + 'ª etapa' : '') + (v ? ' · ' + fmtBRL(v) + (mx[m.n] ? ' · medição com alerta' : '') + (it ? ' · ' + it : '') : ' · sem serviço nesta ponte');
      return '<button type="button" class="an-bar' + (i === corte ? ' corte' : '') + (v ? '' : ' zero') + (m.n === sel ? ' sel' : '') + (E && m.etapa !== E ? ' fora' : '') + '" data-act="med-bar" data-n="' + m.n + '" data-tip="' + esc(tip) + '" title="' + esc(tip) + '" aria-label="' + esc(tip) + '" aria-pressed="' + (m.n === sel) + '">' +
        '<i class="' + (v ? (mx[m.n] ? 'al' : 'on') : '') + '" style="height:' + alt + '%"></i></button>';
    }).join('') + '</div>';
    if (ms.length) {
      h += '<div class="an-axis"><span>' + esc(ms[0].mes) + '</span>' + (corte > 0 ? '<span>' + (ms[corte].etapa) + 'ª etapa a partir de ' + esc(ms[corte].mes) + '</span>' : '') + '<span>' + esc(ms[ms.length - 1].mes) + '</span></div>';
      h += '<div class="an-leg"><span><i class="on"></i>com serviço</span><span><i class="al"></i>medição com alerta</span></div>';
      h += '<div class="an-det' + (sel ? ' on' : '') + '" aria-live="polite">' + esc(detTxt(sel)) + '</div>';
    }
    h += '</div>';

    h += '<div class="abc-box">' + abcHtml(an, a, sel) + '</div>';

    var al = alertasEm(a, E).slice().sort(function (x, y) { return (y.rep != null ? y.rep : y.valor) - (x.rep != null ? x.rep : x.valor); });
    h += '<div class="section-title">Alertas da análise' + (E ? ' · ' + E + 'ª etapa' : '') + '</div>';
    if (!al.length) h += '<div class="empty">' + (E ? 'Nenhuma volta nesta etapa e nenhuma junta refeita em menos de 1 ano.' : 'Nenhuma etapa com mais de uma passagem e nenhuma junta refeita em menos de 1 ano.') + '</div>';
    al.forEach(function (x) {
      h += '<div class="an-al"><span class="an-sev alta">' + esc(x.tipo === 'atendimentos' ? x.etapa + 'ª etapa' : 'Juntas') + '</span>' +
        '<div><b>' + esc(x.servico) + '</b> · ' + esc(x.tipoNome || ALERTA_TXT[x.tipo] || x.tipo) + '<small>' + esc(x.motivo) +   // os trechos já vêm com os meses
        (x.gap != null ? ' · voltou em ' + x.gap + (x.gap === 1 ? ' mês' : ' meses') : '') + '</small></div>' +
        '<span class="an-v">' + (x.tipo === 'atendimentos' ? '<b>' + fmtBRL(x.rep) + '</b><small>depois da 1ª passagem</small>' : '<b>' + fmtBRL(x.valor) + '</b><small>juntas medidas</small>') + '</span></div>';
    });
    return h;
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
    if (isOae(ownerOf(p))) {
      var n = oaeNec(p), k = n.dn ? 'DN' : n.exec ? 'EX' : (n.aval && !n.nv) ? 'OK' : null, nt = oaeNecTxt(n);
      return {
        color: k ? OAE_STATUS[k].fill : NO_STATUS.fill, status: k ? OAE_STATUS[k].name : 'Sem vistoria', pctText: nt === 'sem vistoria' || nt === 'sem dano aparente' ? '' : nt,
        servs: OAE_SERVICES.filter(function (s) { var x = oaeSt(p.serv[s.key]); return x !== 'NA' && x !== 'NV'; }).map(function (s) {
          var sv = p.serv[s.key], x = oaeSt(sv), qt = comQtd(x) ? fmtQtd(s, sv.q) : '';
          return { label: s.label, color: OAE_STATUS[x].fill, text: oaeStOf(s, x).name + (qt ? ' · ' + qt : '') + (comQtd(x) && sv.pri ? ' · prioridade' : '') +
            (comQtd(x) && sv.ci ? ' · conclusão informada' : '') + (comQtd(x) && sv.n ? ' · ' + sv.n : '') };
        })
      };
    }
    var list = servicesOf(ownerOf(p));
    var pct = pointPct(p), sts = list.map(function (k) { return (p.serv[k.key] || {}).st; });
    var key = pct >= 100 ? 'OK' : sts.indexOf('P') >= 0 ? 'P' : sts.indexOf('A') >= 0 ? 'A' : null;
    var st = key ? STATUS[key] : NO_STATUS;
    return {
      color: st.fill, status: st.name, pctText: fmtPct(pct),
      servs: list.filter(function (k) { var s = p.serv[k.key]; return s && s.st !== 'NA'; }).map(function (k) {
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
        drive: driveQ && {
          ready: driveReady,
          add: function (items) { return driveQ.add(items); },
          status: driveStatus
        },
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
    $('folhaSw').classList.toggle('so-diagrama', isMap);
    $('btnWide').textContent = ui.wide ? 'Mostrar editor' : (isMap ? 'Ampliar mapa' : 'Ampliar diagrama');
    if (isMap && ensureMap()) { mapa.render(); mapa.show(); }
    renderPreview();
  }
  function metaSituacao(c, tot) {
    if (!isOae(c)) return ' · avanço médio ' + fmtPct(tot.avg);
    var r = oaeResumo(c);
    return ' · ' + r.dn + (r.dn === 1 ? ' ponte com dano' : ' pontes com dano') + (r.exec ? ' · ' + r.exec + ' em execução' : '');
  }
  function renderPreview() {
    if (visaoOn && visao && !$('visaoHost').hidden) { visao.render(); return; }
    var c = active(), tot = totals(c);
    if (view === 'mapa' && mapa) {
      mapa.render();
      $('previewMeta').textContent = 'Mapa pelo SNV/DNIT ' + window.SNV_BR230.versao + ' · ' + tot.n + (isOae(c) ? ' pontes' : ' pontos') + metaSituacao(c, tot);
      return;
    }
    var temAn = isOae(c) && !!anOf(c), sw = $('folhaSw');
    if (sw) {
      sw.hidden = !temAn;
      sw.querySelectorAll('[data-folha]').forEach(function (x) { x.setAttribute('aria-pressed', String((x.dataset.folha === 'vistoria') === folhaVistoria)); });
    }
    var sheets = renderSheets(c, temAn && folhaVistoria);
    renderPagesCtl(c);
    $('pages').innerHTML = sheets.map(function (svg, i) {
      return '<div class="sheet" aria-label="Página ' + (i + 1) + '">' + svg + '</div>';
    }).join('');
    $('previewMeta').textContent = sheets.length + (sheets.length === 1 ? ' página' : ' páginas') + ' · A3 paisagem · ' + tot.n + (isOae(c) ? ' pontes' : ' pontos') + metaSituacao(c, tot);
    if (viewer && viewer.isOpen()) viewer.update(sheets);
  }

  function renderAll() {
    renderTabs();
    if (mostraVisao()) { visao.render(); return; }
    renderEditor();
    renderPreview();
    if (view === 'mapa' && mapa) mapa.show();
  }

  // ------------------------------------------------------------------ visão geral (visao.js)
  // Todos os contratos numa rodovia só, em escala de km; só na tela. É a tela inicial: o app abre nela e, depois de
  // escolher um contrato, fica nele até fechar o app ou tocar em "Visão geral" (sessionStorage).
  var INICIO_KEY = 'diagrama-linear.no-contrato', visao = null;
  var ICON_VISAO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M2 12h20"/><path d="M6 8v8"/><path d="M13 8v8"/><path d="M18 9.5v5"/></svg>';
  var visaoOn = (function () { try { return sessionStorage.getItem(INICIO_KEY) !== '1'; } catch (e) { return true; } })();
  function setVisao(on) {
    visaoOn = !!on;
    try { if (on) sessionStorage.removeItem(INICIO_KEY); else sessionStorage.setItem(INICIO_KEY, '1'); } catch (e) { /* sem armazenamento */ }
  }
  function ensureVisao() {
    if (visao || !window.VisaoGeral) return visao;
    visao = window.VisaoGeral({
      host: $('visaoHost'), contratos: function () { return state.contracts; }, info: pointInfo, isOae: isOae,
      temMapa: !!(window.MapaSNV && window.L && window.SNV_BR230), temFotos: galeriaOn,
      onAbrir: function (c, p) { abrirDaVisao(c, p, false); },
      onMapa: function (c, p) { abrirDaVisao(c, p, true); },
      onFotos: function (c, p) { abrirGaleria({ cid: c.id, pid: p.id }); }
    });
    return visao;
  }
  function mostraVisao() {
    var on = visaoOn && !!ensureVisao();
    $('layout').hidden = on;
    $('visaoHost').hidden = !on;
    $('btnPdf').hidden = on;
    return on;
  }
  // do cartão da visão geral para o contrato: abre o ponto no editor ou no mapa
  function abrirDaVisao(c, p, noMapa) {
    setVisao(false);
    if (analise.estado[c.id] === 'erro') delete analise.estado[c.id];
    state.activeId = c.id;
    ui.open = {};
    if (p) ui.open[p.id] = true;
    save();
    renderAll();
    if (noMapa) {
      setView('mapa');
      if (p && mapa && mapa.foco) setTimeout(function () { mapa.foco(p.id); }, 200);
      var mh = $('mapHost');
      if (mh) mh.scrollIntoView({ block: 'start' });
    } else if (p) {
      if (ui.wide) toggleWide(false);
      scrollToPoint(p.id);
    } else window.scrollTo(0, 0);
  }

  // ------------------------------------------------------------------ eventos do editor
  function onInput(e) {
    var t = e.target, c = active();
    if (isFiscal() && !t.dataset.svcpct) return;
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
      if (isOae(c) && t.dataset.p === 'kmIni' && p.kmConferir) p.kmConferir = false;   // km corrigido à mão: já foi conferido
      if (isOae(c) && (t.dataset.p === 'kmIni' || t.dataset.p === 'extensao')) {
        p.kmFim = p.kmIni != null ? Math.round((p.kmIni + (Number(p.extensao) || 0) / 1000) * 1000) / 1000 : null;
      }
      refreshPointHead(p);
    } else if (t.dataset.svcpct) {
      var p2 = findPoint(t.dataset.id);
      if (!p2) return;
      var sv2 = p2.serv[t.dataset.svcpct];
      if (!sv2) return;
      if (isOae(c)) {
        if (t.dataset.nota) { if (t.value.trim()) sv2.n = t.value; else delete sv2.n; }
        else {
          var so = OAE_SERVICES.find(function (x) { return x.key === t.dataset.svcpct; }), q = parseNum(t.value);
          if (q == null) delete sv2.q; else sv2.q = so && so.un === '%' ? clamp(q, 0, 100) : Math.max(0, q);
        }
      } else sv2.pct = clamp(Number(t.value) || 0, 0, 100);
      refreshPointHead(p2);
    } else if (t.dataset.dev != null && t.dataset.df) {
      var p3 = findPoint(t.dataset.id);
      if (!p3) return;
      var d = p3.disp[Number(t.dataset.dev)];
      if (d) d[t.dataset.df] = t.dataset.df === 'km' ? parseNum(t.value) : t.value;
    } else {
      return;
    }
    if (!t.dataset.c && t.dataset.marco == null) marcaVistoria(c);
    save();
    schedulePreview();
  }

  function onClick(e) {
    var tab = e.target.closest('[data-tab]');
    if (tab) {
      if (analise.estado[tab.dataset.tab] === 'erro') delete analise.estado[tab.dataset.tab];
      var veioDaVisao = visaoOn;
      setVisao(false);
      state.activeId = tab.dataset.tab;
      ui.open = {};
      save();
      renderAll();
      if (veioDaVisao) window.scrollTo(0, 0);
      return;
    }
    var b = e.target.closest('[data-act]');
    if (!b) return;
    var act = b.dataset.act, c = active(), p;
    if (act === 'visao') { setVisao(true); renderAll(); window.scrollTo(0, 0); return; }
    if (act === 'login') { openLogin(); return; }
    if (readOnly() && EDIT_ACTS.indexOf(act) >= 0) { toast('Para editar, entre com o seu código.'); openLogin(); return; }
    if (isFiscal() && EDIT_ACTS.indexOf(act) >= 0 && act !== 'set-st' && act !== 'set-marca') { toast('Fiscal de campo só altera o status dos serviços.'); return; }
    if (act === 'prop-ok' || act === 'prop-no') { decidirPropostas([Number(b.dataset.prop)], act === 'prop-ok'); return; }
    if (act === 'fotos-ponto') { abrirGaleria({ cid: c.id, pid: b.dataset.id }); return; }
    // barra do gráfico: escolhe a medição (o topo e a curva ABC passam a ser só dela); tocar de novo, ou "Todas as medições", volta a todas
    if (act === 'med-bar' || act === 'abc-todas') {
      var art = b.closest('article.pt'), gr = art && art.querySelector('.an-graf'), det = gr && gr.querySelector('.an-det');
      if (!art || !gr) return;
      var pidSel = art.dataset.id, n = act === 'med-bar' ? Number(b.dataset.n) : null;
      if (n && ui.medSel[pidSel] === n) n = null;
      if (n) ui.medSel[pidSel] = n; else delete ui.medSel[pidSel];
      gr.querySelectorAll('.an-bar').forEach(function (x) {
        var on = n != null && Number(x.dataset.n) === n;
        x.classList.toggle('sel', on); x.setAttribute('aria-pressed', String(on));
      });
      if (det) { det.textContent = detTxt(n); det.classList.toggle('on', !!n); }
      abcTrocar(art);
      return;
    }
    // etapa mostrada na análise (resumo e cartões das pontes); o PDF não muda
    if (act === 'an-etapa') {
      var ev = Number(b.dataset.v) || 0;
      ui.medSel = {};
      if (ev !== etapaSel) { etapaSel = ev; lsPut(ETAPA_KEY, ev || null); }
      renderEditor();
      return;
    }
    // ponte citada no resumo da análise: abre o cartão dela
    if (act === 'an-ir') {
      var pidIr = b.dataset.id;
      ui.open[pidIr] = true;
      renderEditor();
      var alvo = document.querySelector('article.pt[data-id="' + (window.CSS && CSS.escape ? CSS.escape(pidIr) : pidIr) + '"]');
      if (alvo) { alvo.scrollIntoView({ block: 'start' }); window.scrollBy(0, -90); }
      return;
    }
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
        if (!sv) return;
        if (isOae(c)) {
          if (oaeSt(sv) === st) st = 'NV';   // tocar de novo no status marcado desmarca (volta para sem vistoria)
          // ponte: a estimativa, o "onde" e as marcas só valem com dano observado ou em execução
          delete sv.pct;
          if (!comQtd(st)) { delete sv.q; delete sv.n; delete sv.pri; delete sv.ci; }
        } else if (st === 'OK') sv.pct = 100;
        else if (st === 'NA') sv.pct = 0;
        else if (sv.st === 'OK' || sv.st === 'NA') sv.pct = st === 'A' ? 50 : 0;
        sv.st = st;
        rerenderPoint(p);
        break;
      case 'set-marca':
        p = findPoint(b.dataset.id);
        if (!p) return;
        var svm = p.serv[b.dataset.svc], mk = b.dataset.m;
        if (!svm || !OAE_MARCAS[mk] || !comQtd(oaeSt(svm))) return;
        if (svm[mk]) delete svm[mk]; else svm[mk] = true;
        rerenderPoint(p);
        break;
      case 'add-point':
        var pts = sortedPoints(c), last = pts[pts.length - 1];
        var base = last && last.kmFim != null ? Math.round((last.kmFim + 1) * 100) / 100 : null;
        var serv = {};
        if (isOae(c)) {
          OAE_SERVICES.forEach(function (s) { serv[s.key] = { st: 'NV' }; });
          p = { id: uid('pt'), nome: 'Nova ponte', codigo: 'OAE ' + String(c.pontos.length + 1).padStart(2, '0'), kmIni: null, kmFim: null, extensao: null, largura: null, municipio: '', serv: serv, disp: [], obs: '' };
        } else {
          SERVICES.forEach(function (s) { serv[s.key] = { st: 'P', pct: 0 }; });
          p = { id: uid('pt'), nome: 'P' + (c.pontos.length + 1), kmIni: base, kmFim: base != null ? base + 1 : null, enr: null, sb: null, serv: serv, disp: [], obs: '' };
        }
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
        if (p) excluirPonto(c.id, p);
        return;
      case 'add-dev':
        p = findPoint(b.dataset.id);
        if (!p) return;
        p.disp.push({ desc: '', km: p.kmIni != null && p.kmFim != null ? Math.round((p.kmIni + p.kmFim) / 2 * 100) / 100 : null, cor: 'vermelho' });
        rerenderPoint(p);
        break;
      case 'del-dev':
        p = findPoint(b.dataset.id);
        if (!p) return;
        var dv = p.disp[Number(b.dataset.idx)], pidDev = p.id, cidDev = c.id;
        if (!dv) return;
        confirmar({ titulo: 'Remover o dispositivo?', texto: (dv.desc || 'Dispositivo sem descrição') + (dv.km != null ? ' · KM ' + fmtKm(dv.km) : '') + ', do ponto ' + (p.nome || '') + '.', botao: 'Remover', perigo: true }).then(function (r) {
          var cc = contractById(cidDev), pp = cc && cc.pontos.find(function (x) { return x.id === pidDev; });
          if (!r || !pp) return;
          var i = pp.disp.indexOf(dv);
          if (i < 0) i = pp.disp.findIndex(function (x) { return same(x, dv); });
          if (i < 0) return;
          pp.disp.splice(i, 1);
          if (cc === active()) rerenderPoint(pp);
          afterEdit('del-dev', cc);
        });
        return;
      case 'add-marco':
        c.marcos.push({ nome: '', km: null });
        renderEditor();
        break;
      case 'del-marco':
        var mk = c.marcos[Number(b.dataset.idx)], cidMk = c.id;
        if (!mk) return;
        confirmar({ titulo: 'Remover o marco ' + (mk.nome || '') + '?', texto: 'Ele sai do diagrama' + (mk.km != null ? ' (KM ' + fmtKm(mk.km) + ')' : '') + '.', botao: 'Remover', perigo: true }).then(function (r) {
          var cc = contractById(cidMk), i = cc ? cc.marcos.indexOf(mk) : -1;
          if (!r || i < 0) return;
          cc.marcos.splice(i, 1);
          if (cc === active()) renderEditor();
          afterEdit('del-marco', cc);
        });
        return;
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
        excluirContrato(c);
        return;
      default:
        return;
    }
    afterEdit(act, c);
  }
  function afterEdit(act, c) {
    if (POINT_ACTS.indexOf(act) >= 0) marcaVistoria(c);
    save();
    schedulePreview();
  }
  function contractById(id) { return state.contracts.find(function (x) { return x.id === id; }) || null; }

  // ---------------- exclusões: sempre com confirmação na própria página; o ponto ainda pode ser desfeito na hora
  function excluirPonto(cid, p) {
    var km = (p.kmIni != null ? fmtKm(p.kmIni) : '?') + ' – ' + (p.kmFim != null ? fmtKm(p.kmFim) : '?');
    confirmar({
      titulo: 'Excluir o ponto ' + (p.nome || '') + '?',
      html: '<p>KM ' + esc(km) + ' · ' + esc(loteOf(cid)) + '.</p><p>' + (banco.on
        ? 'O ponto sai do diagrama de todos. Fica 30 dias na lixeira (menu Dados › Lixeira e cópias), de onde um engenheiro ou o Administrador pode restaurar.'
        : 'Neste aparelho não há lixeira: só dá para recuperar por um backup.') + '</p>',
      botao: 'Excluir ponto', perigo: true
    }).then(function (r) {
      var c = contractById(cid);
      if (!r || !c) return;
      var copia = clone(p);
      c.pontos = c.pontos.filter(function (x) { return x.id !== p.id; });
      if (c === active()) renderEditor();
      afterEdit('del-point', c);
      offerUndo('Ponto ' + (p.nome || '') + ' excluído.', function () {
        var cc = contractById(cid);
        if (!cc) { toast('O contrato deste ponto não existe mais.'); return; }
        if (cc.pontos.some(function (x) { return x.id === copia.id; })) return;
        cc.pontos.push(clone(copia));
        if (cc === active()) { ui.open = {}; ui.open[copia.id] = true; renderEditor(); scrollToPoint(copia.id); }
        afterEdit('add-point', cc);
        toast('Ponto ' + (copia.nome || '') + ' de volta.');
      });
    });
  }
  function excluirContrato(c) {
    var nome = (c.lote || c.numero || 'Contrato').trim(), cid = c.id;
    confirmar({
      titulo: 'Excluir o contrato ' + nome + ' inteiro?',
      html: '<p>Sai o contrato <b>' + esc([c.lote, c.numero].filter(Boolean).join(' · ')) + '</b> com os <b>' + c.pontos.length + ' pontos</b>, para todos.</p><p>' +
        (banco.on ? 'Fica 30 dias na lixeira (menu Dados › Lixeira e cópias) e o banco guarda uma cópia antes de excluir.' : 'Neste aparelho só dá para recuperar por um backup.') + '</p>',
      digitar: nome, botao: 'Excluir contrato', perigo: true
    }).then(function (r) {
      if (!r || !contractById(cid) || state.contracts.length < 2) return;
      state.contracts = state.contracts.filter(function (x) { return x.id !== cid; });
      if (state.activeId === cid) state.activeId = state.contracts[0].id;
      ui.open = {};
      renderAll();
      afterEdit('del-contract', active());
      toast('Contrato ' + nome + ' excluído.' + (banco.on ? ' Dá para restaurar pela lixeira.' : ''), 5000);
    });
  }
  // barra "Desfazer" por alguns segundos depois de excluir
  var undoTimer = null;
  function offerUndo(msg, fn) {
    var old = $('undoBar');
    if (old) old.remove();
    clearTimeout(undoTimer);
    var bar = document.createElement('div');
    bar.id = 'undoBar';
    bar.className = 'share-ready';
    bar.setAttribute('role', 'status');
    bar.innerHTML = '<span></span><button type="button" class="btn primary">Desfazer</button><button type="button" class="btn" aria-label="Fechar">×</button>';
    bar.querySelector('span').textContent = msg;
    var b = bar.querySelectorAll('button');
    b[0].addEventListener('click', function () { bar.remove(); fn(); });
    b[1].addEventListener('click', function () { bar.remove(); });
    (document.fullscreenElement || document.body).appendChild(bar);
    undoTimer = setTimeout(function () { bar.remove(); }, 12000);
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
  function buildPdf(c, semAnalise) {
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
      var sheets = renderSheets(c, semAnalise), host = $('pdfHost');
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
  function pdfName(c, interno) {
    var name = 'Diagrama linear - ' + [c.lote, c.numero ? 'CT ' + c.numero : ''].filter(Boolean).join(' - ') + ' - ' + todayIso() + (interno ? ' (interno)' : '') + '.pdf';
    return name.replace(/[\\/:*?"<>|]/g, '-');
  }
  // quem vê a análise das medições escolhe: só a vistoria (padrão, para enviar) ou com a análise (uso interno)
  function escolherFolha(oque) {
    var c = active();
    if (!anOf(c)) return Promise.resolve(true);
    return new Promise(function (resolve) {
      modal('<h2 id="modalTitle">' + esc(oque) + '</h2>' +
        '<fieldset class="folha-op"><legend>O que vai na folha</legend>' +
        '<label><input type="radio" name="folha" value="vistoria"' + (folhaVistoria ? ' checked' : '') + '> <span><b>Só a vistoria</b><small>Estado das pontes e observações. Para enviar à contratada ou ao DNIT.</small></span></label>' +
        '<label><input type="radio" name="folha" value="analise"' + (folhaVistoria ? '' : ' checked') + '> <span><b>Com a análise das medições</b><small>Valores medidos e alertas em roxo, com o aviso “USO INTERNO – análise preliminar” no topo.</small></span></label></fieldset>' +
        '<div class="modal-foot"><button type="button" class="btn" data-close>Cancelar</button><button type="submit" class="btn primary">Continuar</button></div>',
      function (f) {
        var com = f.querySelector('input[name=folha]:checked').value === 'analise';
        closeModal();
        resolve(!com);
      });
    });
  }
  function exportPdf() {
    escolherFolha('Gerar PDF').then(function (semAnalise) {
      var btn = $('btnPdf'), c = active(), old = btn.innerHTML, nome = pdfName(c, !semAnalise && !!anOf(c));
      btn.disabled = true;
      btn.textContent = 'Gerando PDF…';
      buildPdf(c, semAnalise).then(function (doc) {
        return saveBlob(nome, doc.output('blob'), 'PDF gerado: ' + nome);
      }).catch(function (err) {
        console.error(err);
        toast('Não consegui gerar o PDF direto (sem internet?). Abrindo a impressão: escolha "Salvar como PDF".', 6000);
        setTimeout(function () { printSheets(semAnalise); }, 600);
      }).then(function () {
        btn.disabled = false;
        btn.innerHTML = old;
      });
    });
  }
  function imprimir() { escolherFolha('Imprimir').then(printSheets); }
  function printSheets(semAnalise) {
    var sheets = renderSheets(active(), semAnalise === true);
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
      } catch (e) {
        toast('Esse arquivo não é um backup válido deste site.');
        return;
      }
      var np = s.contracts.reduce(function (n, c) { return n + c.pontos.length; }, 0);
      confirmar({
        titulo: 'Trocar os dados pelos do backup?',
        html: '<p>Arquivo <b>' + esc(file.name) + '</b>: ' + s.contracts.length + ' contrato(s) e ' + np + ' pontos.</p><p>' + (banco.on
          ? 'Todos passam a ver os dados do backup. Antes da troca o banco guarda uma cópia de como está agora (menu Dados › Lixeira e cópias).'
          : 'Os dados atuais deste aparelho serão substituídos.') + '</p>',
        digitar: banco.on ? 'SUBSTITUIR' : null, botao: 'Trocar pelos do backup', perigo: true
      }).then(function (r) {
        if (!r) return;
        s = normalize(s);
        s.activeId = s.contracts.some(function (c) { return c.id === state.activeId; }) ? state.activeId : s.activeId;
        state = s;
        ui.open = {};
        save();
        renderAll();
        toast(banco.on ? 'Backup carregado. Enviando ao banco…' : 'Backup carregado.');
      });
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
      if (banco.on && !isResp()) { toast('Só o Administrador pode trocar os dados da equipe por um backup.', 5000); if (!banco.login) openLogin(); return; }
      $('fileInput').click();
    }
    else if (act === 'print') imprimir();
    else if (act === 'relfoto') abrirGaleria({ aba: 'relatorio', cid: active().id });
    else if (act === 'reset') {
      confirmar({ titulo: 'Voltar aos dados iniciais?', texto: 'Apaga as alterações deste navegador e volta aos dados da planilha. Faça um backup antes, se precisar.', digitar: 'APAGAR', botao: 'Voltar aos dados iniciais', perigo: true }).then(function (r) {
        if (!r) return;
        state = normalize(clone(window.UNIFILAR_SEED));
        ui.open = {};
        save();
        renderAll();
        toast('Dados iniciais restaurados.');
      });
    }
    else if (act === 'lixeira') openLixeira();
    else if (act === 'recusadas') openRecusadas();
    else if (act === 'usuarios') openUsuarios();
    else if (act === 'aprovar') openAprov();
  }

  // ------------------------------------------------------------------ banco compartilhado (Supabase, banco.js)
  // Todos veem os mesmos dados; edita quem entrou com o código da equipe. Cada alteração vira uma operação numa fila
  // guardada no aparelho, que sobe ao banco assim que houver sinal. Os aparelhos conferem a versão do banco a cada 20 s.
  var SYNC_KEY = 'diagrama-linear.banco';           // {versao, pend, cfg}
  var LOGIN_KEY = 'diagrama-linear.acesso';         // {codigo, nome, papel} deste aparelho
  var NAME_KEY = 'diagrama-linear.nome';
  var OLD_KEY = 'diagrama-linear.antes-do-banco';   // o que estava só neste aparelho antes do banco da equipe
  var RECUSA_KEY = 'diagrama-linear.recusadas';     // alterações que o banco recusou de vez (guardadas, nunca apagadas sozinhas)
  var banco = { on: !!window.Banco, versao: 0, pend: [], cfg: {}, meta: {}, conf: [], propostas: [], base: null, login: null, online: null, busy: false, sending: 0, at: null, want: false,
    falhas: 0, espera: 0, lote: 0 };   // falhas seguidas do servidor, quando tentar de novo e tamanho do lote ao separar uma recusa
  var flushTimer = null;

  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function lsPut(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } }
  function keepSync() { lsPut(SYNC_KEY, { versao: banco.versao, pend: banco.pend, cfg: banco.cfg, meta: banco.meta, conf: banco.conf, propostas: banco.propostas }); }
  function readOnly() { return banco.on && !banco.login; }
  // papéis: criador (tudo), engenheiro (edita, aprova, lixeira) e fiscal de campo (só status dos serviços, com aprovação).
  // Os códigos gerais antigos valem como criador ("responsavel") e engenheiro ("equipe").
  var NIVEL = { criador: 3, responsavel: 3, engenheiro: 2, equipe: 2, fiscal: 1 };
  var PAPEL_NOME = { criador: 'Administrador', responsavel: 'Administrador', engenheiro: 'engenheiro', equipe: 'engenheiro', fiscal: 'fiscal de campo' };
  function nivel() { return banco.on && banco.login ? (NIVEL[banco.login.papel] || 0) : 0; }
  function isResp() { return nivel() >= 3; }
  function isEng() { return nivel() >= 2; }
  function isFiscal() { return nivel() === 1; }
  function papelNome(p) { return PAPEL_NOME[p] || 'equipe'; }

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
    plataforma: 'largura da plataforma', dataVistoria: 'data da vistoria', porPagina: 'pontos por página', marcos: 'marcos',
    codigo: 'código da ponte', extensao: 'extensão (m)', largura: 'largura (m)', municipio: 'município', tipo: 'tipo de contrato',
    kmContrato: 'KM do contrato', kmConferir: 'KM a conferir', localRelatorio: 'local (relatório fotográfico)'
  };
  function fieldName(k) {
    if (k.indexOf('serv.') === 0) { var s = SERVICES.concat(OAE_SERVICES).find(function (x) { return x.key === k.slice(5); }); return s ? s.short : k.slice(5); }
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
  function vistoriaPonte(c, p) {
    var x = banco.on && banco.meta[metaKey(c.id, p.id)], best = null;
    if (!x) return null;
    OAE_SERVICES.forEach(function (s) {
      var f = x.m && x.m['serv.' + s.key], t = f && Date.parse(f.em);
      if (isFinite(t) && oaeSt(p.serv[s.key]) !== 'NV' && (!best || t > best.t)) best = { t: t, por: f.por, em: f.em };
    });
    return best;
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
      var so = OAE_SERVICES.find(function (x) { return x.key === campo.slice(5); });
      if (so) {
        var k = oaeSt(v), qt = comQtd(k) ? fmtQtd(so, v.q) : '';
        return oaeStOf(so, k).name + (qt ? ' ' + qt : '') + (comQtd(k) && v.pri ? ', prioridade' : '') + (comQtd(k) && v.ci ? ', conclusão informada' : '') + (comQtd(k) && v.n ? ' (' + v.n + ')' : '');
      }
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
    if (banco.espera > Date.now()) { scheduleFlush(banco.espera - Date.now()); return; }   // o servidor falhou há pouco: espera
    var ops = banco.pend.slice(0, banco.lote || 500), n = ops.length;
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
      banco.falhas = 0; banco.espera = 0;
      if (!banco.pend.length) banco.lote = 0; else if (banco.lote) banco.lote = Math.min(500, banco.lote * 2);   // separou a recusa: volta a crescer
      if (res && res.propostas != null) {                            // fiscal: vira proposta, o banco não muda
        if (res.propostas) toast('Enviado para aprovação de um engenheiro.', 4000);
        keepSync();
        if (banco.pend.length) scheduleFlush(300); else refresh();
        syncStatus();
        return;
      }
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
      if (code === 'codigo_invalido') { logout(true); toast('Seu acesso mudou ou foi desativado. Entre de novo para enviar as alterações deste aparelho.', 7000); return; }
      if (code === 'muitas_tentativas') { toast('O banco bloqueou por muitas tentativas com código errado. Tente de novo em 10 minutos.', 7000); syncStatus(); return; }
      if (!recusaDefinitiva(err)) {
        // falha do servidor (5xx, tempo esgotado, banco reiniciando, função ainda sendo trocada...): nada sai da fila;
        // tenta de novo sozinho, esperando cada vez mais (10 s, 20 s, 40 s... até 5 min)
        banco.falhas++;
        banco.espera = Date.now() + Math.min(300000, 10000 * Math.pow(2, banco.falhas - 1));
        if (banco.falhas === 1 || banco.falhas % 5 === 0) toast('O banco não respondeu direito (' + ((err && err.message) || 'erro') + '). As alterações continuam guardadas neste aparelho e sobem sozinhas quando ele voltar.', 7000);
        keepSync();
        scheduleFlush(banco.espera - Date.now());
        return;
      }
      // o banco recusou de vez (dado ou permissão). O lote é uma transação só: nada dele foi gravado. Manda em lotes
      // menores até sobrar só a alteração recusada; as outras sobem normalmente.
      if (n > 1) { banco.lote = Math.ceil(n / 2); scheduleFlush(300); return; }
      var op = banco.pend[0];
      if (!guardarRecusada(op, err)) {   // sem espaço no aparelho para guardar: não apaga; avisa e para de tentar
        banco.espera = Date.now() + 300000;
        toast('O banco recusou uma alteração e não há espaço neste aparelho para guardá-la à parte. Ela continua na fila: salve um backup (menu Dados).', 9000);
        syncStatus();
        return;
      }
      banco.pend.splice(0, 1);
      if (!banco.pend.length) banco.lote = 0;
      keepSync();
      toast((code === 'so_status' ? 'Fiscal de campo só altera o status dos serviços.' : 'O banco recusou uma alteração (' + ((err && err.message) || 'erro') + ').') +
        ' A alteração "' + opsResumo([op]) + '" ficou guardada em Dados › Alterações recusadas; as outras seguem para o banco.', 9000);
      refresh();
      if (banco.pend.length) scheduleFlush(300);
    });
  }
  // recusa definitiva: o banco respondeu que o dado (ou a permissão) não serve, e mandar de novo daria o mesmo erro.
  // 5xx, 408 e 429 são falha passageira do servidor; 401/403/404 são acesso ou versão do banco: também não são do dado.
  function recusaDefinitiva(err) {
    var s = err && err.status, pg = String((err && err.pg) || '');
    if (s === 413) return true;                                    // grande demais: em lotes menores passa
    if (!s || s >= 500 || s === 408 || s === 429) return false;
    return pg === 'P0001' || /^2[23]/.test(pg);                    // erro das nossas funções, dado inválido ou regra do banco
  }
  // ---- alterações recusadas: ficam neste aparelho até alguém baixar, mandar de novo ou apagar (menu Dados)
  function recusadas() { var l = lsGet(RECUSA_KEY); return Array.isArray(l) ? l : []; }
  function guardarRecusada(op, err) {
    var l = recusadas();
    l.push({ em: new Date().toISOString(), por: (banco.login && banco.login.nome) || null, erro: (err && err.message) || 'erro', op: op });
    try { localStorage.setItem(RECUSA_KEY, JSON.stringify(l)); return true; } catch (e) { return false; }
  }
  function openRecusadas() {
    var l = recusadas();
    if (!l.length) { toast('Nenhuma alteração recusada neste aparelho.'); return; }
    var f = modal('<h2 id="modalTitle">Alterações recusadas</h2>' +
      '<p>O banco recusou estas alterações deste aparelho. Elas não foram gravadas, mas ficaram guardadas aqui. Baixe o arquivo para conferir ou guardar, ou mande de novo se o motivo já foi resolvido (por exemplo, o acesso foi corrigido).</p>' +
      '<ul class="rec-lista">' + l.map(function (x) {
        return '<li><b>' + esc(opsResumo([x.op])) + '</b><small>' + esc(new Date(x.em).toLocaleString('pt-BR')) + (x.por ? ' · ' + esc(x.por) : '') + ' · motivo: ' + esc(x.erro) + '</small></li>';
      }).join('') + '</ul>' +
      '<div class="modal-foot"><button type="button" class="btn" data-close>Fechar</button>' +
      '<button type="button" class="btn danger" data-rec="apagar">Apagar a lista</button>' +
      '<button type="button" class="btn" data-rec="baixar">Baixar (.json)</button>' +
      (banco.login ? '<button type="button" class="btn primary" data-rec="reenviar">Mandar de novo</button>' : '') + '</div>');
    f.addEventListener('click', function (e) {
      var b = e.target.closest('[data-rec]');
      if (!b) return;
      var k = b.dataset.rec;
      if (k === 'baixar') {
        saveBlob('alteracoes-recusadas-' + todayIso() + '.json', new Blob([JSON.stringify(recusadas(), null, 2)], { type: 'application/json' }), 'Arquivo das alterações recusadas salvo.');
      } else if (k === 'reenviar') {
        var ops = recusadas().map(function (x) { return x.op; });
        lsPut(RECUSA_KEY, null);
        closeModal();
        enqueue(ops);
        keepSync();
        banco.espera = 0;
        refresh();          // mostra o banco com estas alterações por cima, como as outras da fila
        scheduleFlush(300);
        toast('Mandando de novo ' + ops.length + (ops.length === 1 ? ' alteração.' : ' alterações.'));
      } else if (k === 'apagar') {
        closeModal();
        confirmar({ titulo: 'Apagar as alterações recusadas?', texto: 'Elas somem deste aparelho. Se quiser guardar, baixe o arquivo antes.', botao: 'Apagar', perigo: true }).then(function (r) {
          if (!r) return;
          lsPut(RECUSA_KEY, null);
          toast('Lista apagada.');
        });
      }
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
      banco.propostas = Array.isArray(r.propostas) ? r.propostas : [];
      if (r.contratos.length) {
        if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
        trackChanges();   // o que acabou de ser mudado aqui entra na fila antes de trocar o estado
        state = normalize(applyOps(fromServer(r), banco.pend));
        banco.base = clone(state);
        try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* sem armazenamento */ }
        renderAll();
      }
      keepSync();
      renderAprov();
      if (logoMudou && foto) foto.refreshTeam();
      if (driveQ) { driveQ.pump(); onDriveChange(); }
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
    else if (n && banco.falhas) { t = 'Banco com falha · ' + n + (n === 1 ? ' alteração guardada' : ' alterações guardadas') + ' · tenta de novo às ' + hhmm(new Date(banco.espera)); warn = true; }
    else if (n && isFiscal()) { t = (banco.online === false ? 'Sem sinal · ' : '') + n + (n === 1 ? ' mudança para enviar à aprovação' : ' mudanças para enviar à aprovação'); warn = banco.online === false; }
    else if (n) { t = (banco.online === false ? 'Sem sinal · ' : '') + n + (n === 1 ? ' alteração aguardando' : ' alterações aguardando'); warn = banco.online === false; }
    else if (banco.online === false) { t = 'Sem sinal · cópia deste aparelho'; warn = true; }
    else if (banco.at) t = (window.AMBIENTE && AMBIENTE.previa ? 'Banco de teste · ' : 'Banco da equipe · ') + hhmm(banco.at);
    else t = 'Conectando ao banco…';
    var dq = driveQ && driveReady() ? driveQ.info() : null;
    if (dq && dq.n) { t += ' · ' + dq.n + (dq.n === 1 ? ' foto' : ' fotos') + ' para o Drive'; warn = warn || !banco.login || dq.erro === 'codigo'; }
    el.textContent = t;
    el.classList.toggle('warn', warn);
  }

  // ---------------- acesso: cada pessoa entra com o próprio código (criador, engenheiro ou fiscal de campo).
  // A entrada vira uma sessão (token "tk_..." guardado em banco.login.codigo), que vale até a pessoa sair ou o criador
  // trocar/desativar o acesso dela. Os códigos gerais antigos (equipe/responsável) ainda entram, pedindo o nome.
  function setLogin(l) {
    banco.login = l;
    lsPut(LOGIN_KEY, l);
    analiseInit();
    document.body.classList.toggle('ro', readOnly());
    document.body.classList.toggle('fiscal', isFiscal());
    renderLoginBtn();
    renderAprov();
    if (driveQ && l) { driveQ.resetCode(); driveQ.pump(); }
  }
  function renderLoginBtn() {
    var b = $('btnLogin');
    if (b) {
      b.hidden = !banco.on;
      b.textContent = banco.login ? (banco.login.nome || 'Equipe') + ' · ' + papelNome(banco.login.papel) : 'Entrar';
      b.classList.toggle('primary', !banco.login);
    }
    // itens do menu Dados conforme o papel
    var show = { lixeira: isEng(), usuarios: isResp(), aprovar: isEng(), restore: !banco.on || isResp(), relfoto: isEng() && galeriaOn() };
    Object.keys(show).forEach(function (k) {
      var el = document.querySelector('#menuPop [data-act="' + k + '"]');
      if (el) el.hidden = !show[k];
    });
  }
  function logout(silent) {
    setLogin(null);
    renderAll();
    syncStatus();
    if (!silent) toast('Você saiu. Este aparelho fica só para consulta.');
  }
  function aparelho() {
    var ua = navigator.userAgent;
    return (isNativeApp() ? 'App ' : 'Site ') + (/iPhone|iPad/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : 'outro');
  }
  // ao abrir: confere se o acesso guardado neste aparelho ainda vale (o criador pode ter trocado o papel ou desativado)
  function conferirAcesso() {
    var l = banco.login;
    if (!banco.on || !l) return Promise.resolve();
    if (String(l.codigo || '').indexOf('tk_') !== 0) {
      // entrou numa versão anterior, com o código geral: troca por uma sessão
      return window.Banco.entrarV2(l.codigo, l.nome || lsGet(NAME_KEY) || null, aparelho()).then(function (r) {
        if (r && r.token) setLogin({ codigo: r.token, nome: r.nome, papel: r.papel, uid: r.uid || null });
        else { logout(true); toast('O código mudou. Entre de novo para editar.', 6000); }
      }, function (err) {
        if (err && err.code !== 'sem_rede' && err.code !== 'muitas_tentativas') { logout(true); toast('Entre de novo para editar.', 6000); }
      });
    }
    return window.Banco.sessao(l.codigo).then(function (x) {
      if (!x) { logout(true); toast('Seu acesso foi trocado ou desativado. Entre de novo.', 6000); return; }
      if (x.papel !== l.papel || (x.nome && x.nome !== l.nome)) {
        setLogin({ codigo: l.codigo, nome: x.nome || l.nome, papel: x.papel, uid: x.uid || l.uid || null });
        renderAll();
        toast('Seu acesso agora é de ' + papelNome(x.papel) + '.', 5000);
      }
    }, function () { /* sem sinal: confere depois */ });
  }

  function modal(html, onSubmit, cls) {
    closeModal();
    var m = document.createElement('div');
    m.className = 'modal';
    m.id = 'modal';
    m.innerHTML = '<form class="modal-box' + (cls ? ' ' + cls : '') + '" role="dialog" aria-modal="true" aria-labelledby="modalTitle" novalidate>' + html + '</form>';
    (document.fullscreenElement || document.body).appendChild(m);
    var f = m.querySelector('form');
    f.addEventListener('submit', function (e) { e.preventDefault(); if (onSubmit) onSubmit(f); });
    m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('[data-close]')) closeModal(); });
    m.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
    f.addEventListener('change', function (e) {
      if (e.target.hasAttribute('data-showpw')) f.querySelectorAll('input[data-pw]').forEach(function (i) { i.type = e.target.checked ? 'text' : 'password'; });
    });
    setTimeout(function () { var x = f.querySelector('input:not([type=checkbox]):not([type=radio]),button[type=submit],button'); if (x) x.focus(); }, 30);
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
      : c === 'codigo_invalido' ? 'Código errado ou acesso desativado.'
      : c === 'muitas_tentativas' ? 'Muitas tentativas erradas. Espere 10 minutos e tente de novo.'
      : c === 'codigo_curto' ? 'O código precisa de pelo menos 6 caracteres (o do Administrador, 8).'
      : c === 'codigo_em_uso' ? 'Esse código já é de outra pessoa (ou é um código geral). Escolha outro.'
      : c === 'nome_em_uso' ? 'Já existe um usuário com esse nome.'
      : c === 'ultimo_criador' ? 'Precisa ficar pelo menos um Administrador ativo.'
      : c === 'so_criador' ? 'Só o Administrador pode fazer isso.'
      : c === 'sem_permissao' ? 'Seu acesso não permite isso.'
      : c === 'contrato_excluido' ? 'O contrato deste ponto foi excluído: restaure o contrato primeiro.'
      : c === 'ja_existe' ? 'Já existe um item com esse código. Nada foi mudado.'
      : c === 'nao_encontrado' ? 'Não encontrei esse item (talvez já tenha sido restaurado).'
      : c === 'ja_configurado' ? 'O banco já tem acesso configurado. Entre com o seu código.'
      : 'Não deu certo (' + ((err && err.message) || 'erro') + ').';
  }
  function mField(id, label, pw, value, extra) {
    // código: sem maiúscula automática nem corretor (no iPhone, "Mostrar o que digitei" vira campo de texto comum)
    return '<div class="field"><label for="' + id + '">' + label + '</label><input id="' + id + '"' + (pw ? ' type="password" data-pw autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false"' : ' autocomplete="' + (extra || 'name') + '"') +
      ' maxlength="' + (pw ? 200 : 60) + '" value="' + esc(value || '') + '"></div>';
  }
  var SHOWPW = '<label class="show-pw"><input type="checkbox" data-showpw> Mostrar o que digitei</label>';
  var MFOOT = '<p class="modal-err" role="alert" hidden></p><div class="modal-foot"><button type="button" class="btn" data-close>Cancelar</button>';

  // confirmação dentro da página (o confirm() do sistema some no app e é fácil de tocar sem ler).
  // o.digitar: texto que a pessoa precisa digitar para liberar o botão. o.campo: caixa de texto opcional (ex.: motivo).
  // Devolve null (cancelou) ou {valor}.
  function semAcento(t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase(); }
  function confirmar(o) {
    return new Promise(function (resolve) {
      var f = modal('<h2 id="modalTitle">' + esc(o.titulo) + '</h2>' + (o.html || (o.texto ? '<p>' + esc(o.texto) + '</p>' : '')) +
        (o.campo ? '<div class="field"><label for="cfCampo">' + esc(o.campo) + '</label><input id="cfCampo" maxlength="300" autocomplete="off"></div>' : '') +
        (o.digitar ? '<div class="field cf-dig"><label for="cfDig">Para confirmar, digite <b>' + esc(o.digitar) + '</b></label><input id="cfDig" autocomplete="off" autocorrect="off" spellcheck="false"></div>' : '') +
        '<div class="modal-foot"><button type="button" class="btn" data-close>' + esc(o.cancelar || 'Cancelar') + '</button>' +
        '<button type="submit" class="btn ' + (o.perigo ? 'danger-solid' : 'primary') + '"' + (o.digitar ? ' disabled' : '') + '>' + esc(o.botao || 'Confirmar') + '</button></div>',
      function (form) {
        if (o.digitar && semAcento(form.querySelector('#cfDig').value) !== semAcento(o.digitar)) return;
        var c = form.querySelector('#cfCampo');
        var v = { valor: c ? c.value.trim() : '' };
        closeModal();
        resolve(v);
      });
      if (o.digitar) {
        var inp = f.querySelector('#cfDig'), btn = f.querySelector('button[type=submit]');
        inp.addEventListener('input', function () { btn.disabled = semAcento(inp.value) !== semAcento(o.digitar); });
        setTimeout(function () { inp.focus(); }, 40);
      }
    });
  }

  function openLogin() {
    if (banco.login) { openAccount(); return; }
    window.Banco.codigosDefinidos().then(function (def) { if (def) loginModal(); else openPrimeiro(); }, function () { loginModal(); });
  }
  function loginModal() {
    modal('<h2 id="modalTitle">Entrar</h2>' +
      '<p>Use o código que o Administrador do sistema passou para você. O acesso fica guardado neste aparelho até você sair.</p>' +
      (PREVIA ? '<p class="hint">Esta é a <b>prévia</b>: usa o banco de teste, com códigos próprios. Os códigos do site oficial não valem aqui.</p>' : '') +
      mField('lgCod', 'Seu código', true) + SHOWPW +
      '<div id="lgNomeBox" hidden>' + mField('lgNome', 'Seu nome', false, lsGet(NAME_KEY) || '') +
      '<p class="hint">Esse é o código geral da equipe: o nome vai para o histórico.</p></div>' +
      MFOOT + '<button type="submit" class="btn primary">Entrar</button></div>',
    function (f) {
      var c = f.querySelector('#lgCod').value, box = f.querySelector('#lgNomeBox'), n = f.querySelector('#lgNome').value.trim();
      if (!c) { modalErr(f, 'Digite o código.'); return; }
      if (!box.hidden && !n) { modalErr(f, 'Escreva seu nome.'); return; }
      modalErr(f, '');
      busyBtn(f, true, 'Conferindo…');
      // espaço sobrando no fim (sugestão do teclado do celular): se o código como digitado não entra, tenta sem ele
      var tentar = function (cod) { return window.Banco.entrarV2(cod, box.hidden ? null : n, aparelho()); };
      tentar(c).then(function (r) { return (r && r.token) || c.trim() === c || !c.trim() ? r : tentar(c.trim()); }).then(function (r) {
        busyBtn(f, false);
        if (!r || !r.token) { modalErr(f, (PREVIA ? 'Código errado para a prévia (o do site oficial não vale aqui).' : 'Código errado.') + ' Confira maiúsculas e minúsculas.'); return; }
        if (!box.hidden) lsPut(NAME_KEY, n);
        entrou(r);
      }, function (err) {
        busyBtn(f, false);
        if (err && err.code === 'falta_nome') { box.hidden = false; modalErr(f, ''); f.querySelector('#lgNome').focus(); return; }
        modalErr(f, errText(err));
      });
    });
  }
  function entrou(r) {
    setLogin({ codigo: r.token, nome: r.nome, papel: r.papel, uid: r.uid || null });
    closeModal();
    renderAll();
    toast(r.papel === 'fiscal'
      ? 'Olá, ' + r.nome + '. Como fiscal de campo, você muda o status dos serviços e um engenheiro aprova.'
      : 'Olá, ' + r.nome + ' (' + papelNome(r.papel) + ').', 5000);
    if (location.hash === '#configurar') history.replaceState(null, '', location.pathname + location.search);
    refresh(true).then(flush);
  }
  // banco novo, sem nenhum acesso: cria a conta do criador
  function openPrimeiro() {
    modal('<h2 id="modalTitle">Criar a conta do Administrador</h2>' +
      '<p>Primeira vez neste banco. O <b>Administrador</b> pode tudo: cadastra as pessoas (engenheiros e fiscais de campo), aprova mudanças e restaura cópias. Guarde o código só com você.</p>' +
      mField('pmNome', 'Seu nome', false, lsGet(NAME_KEY) || '') + mField('pmCod', 'Seu código (pelo menos 8 caracteres)', true) + mField('pmCod2', 'Repita o código', true) + SHOWPW +
      MFOOT + '<button type="submit" class="btn primary">Criar e entrar</button></div>',
    function (f) {
      var n = f.querySelector('#pmNome').value.trim(), c = f.querySelector('#pmCod').value, c2 = f.querySelector('#pmCod2').value;
      if (!n) { modalErr(f, 'Escreva seu nome.'); return; }
      if (c.length < 8) { modalErr(f, 'O código do Administrador precisa de pelo menos 8 caracteres.'); return; }
      if (c !== c2) { modalErr(f, 'Os dois códigos não são iguais.'); return; }
      modalErr(f, '');
      busyBtn(f, true, 'Criando…');
      window.Banco.criarCriador(n, c, aparelho()).then(function (r) {
        busyBtn(f, false);
        lsPut(NAME_KEY, n);
        entrou(r);
        toast('Conta criada. Agora cadastre as pessoas em Dados › Usuários e acessos.', 6000);
      }, function (err) { busyBtn(f, false); modalErr(f, errText(err)); });
    });
  }
  // endereço #configurar: primeira vez cria o criador; depois, abre o cadastro de usuários (ou a entrada)
  function openConfigurar() {
    if (isResp()) { openUsuarios(); return; }
    openLogin();
  }
  function openAccount() {
    var n = banco.propostas.length;
    var f = modal('<h2 id="modalTitle">' + esc(banco.login.nome || 'Equipe') + '</h2>' +
      '<p>Este aparelho entrou como <b>' + esc(papelNome(banco.login.papel)) + '</b>.' + (isFiscal() ? ' Você muda o status dos serviços e um engenheiro aprova.' : '') + '</p>' +
      '<div class="modal-list">' +
      (isEng() ? '<button type="button" class="btn" data-acc="aprov">Aprovar mudanças dos fiscais' + (n ? ' (' + n + ')' : '') + '</button>' : '') +
      (isResp() ? '<button type="button" class="btn" data-acc="users">Usuários e acessos</button>' : '') +
      (isEng() ? '<button type="button" class="btn" data-acc="lixeira">Lixeira e cópias de segurança</button>' : '') +
      '<button type="button" class="btn" data-acc="hist">Histórico de alterações</button>' +
      '<button type="button" class="btn danger" data-acc="sair">Sair deste aparelho</button></div>' +
      '<div class="modal-foot"><button type="button" class="btn" data-close>Fechar</button></div>');
    f.addEventListener('click', function (e) {
      var b = e.target.closest('[data-acc]');
      if (!b) return;
      var a = b.dataset.acc;
      if (a === 'hist') openHist();
      else if (a === 'users') openUsuarios();
      else if (a === 'lixeira') openLixeira();
      else if (a === 'aprov') openAprov();
      else if (a === 'sair') {
        var sair = function () {
          var tok = banco.login && banco.login.codigo;
          banco.pend = []; keepSync();
          closeModal(); logout(); refresh(true);
          if (tok && String(tok).indexOf('tk_') === 0) window.Banco.sair(tok).catch(function () { /* sem sinal: a sessão expira sozinha */ });
        };
        if (!banco.pend.length) { sair(); return; }
        confirmar({ titulo: 'Sair e descartar?', texto: 'Há ' + banco.pend.length + ' alteração(ões) deste aparelho que ainda não subiram para o banco. Se sair agora, elas se perdem.', botao: 'Sair e descartar', perigo: true })
          .then(function (r) { if (r) sair(); });
      }
    });
  }
  function openHist() {
    var f = modal('<h2 id="modalTitle">Histórico de alterações</h2><div class="hist" aria-live="polite">Carregando…</div><div class="modal-foot"><button type="button" class="btn" data-close>Fechar</button></div>', null, 'wide');
    window.Banco.historico(60).then(function (rows) {
      var el = f.querySelector('.hist');
      el.innerHTML = rows.length ? rows.map(function (r) {
        var d = new Date(r.em);
        var dia = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
        var conf = Array.isArray(r.conflitos) ? r.conflitos.map(function (x) { return '<span class="hist-conf">' + esc(conflictText(x, r.autor || 'quem enviou')) + '</span>'; }).join('') : '';
        return '<div class="hist-row"><span class="hist-when">' + dia + ' ' + hhmm(d) + '</span><span><b>' + esc(r.autor || '—') + '</b> ' + esc(r.resumo || '') + conf + '</span></div>';
      }).join('') : '<p>Nada gravado ainda.</p>';
    }, function (err) { f.querySelector('.hist').textContent = errText(err); });
  }

  // ---------------- usuários e acessos (só o criador)
  var PAPEIS = [
    { k: 'engenheiro', nome: 'Engenheiro', desc: 'Edita tudo, aprova as mudanças dos fiscais, restaura da lixeira e vê as fotos de todos.' },
    { k: 'fiscal', nome: 'Fiscal de campo', desc: 'Só muda o status e o % dos serviços (fica aguardando aprovação) e vê só as fotos que tirou.' },
    { k: 'criador', nome: 'Administrador', desc: 'Tudo, inclusive cadastrar pessoas e voltar os dados para uma cópia.' }
  ];
  function gerarCodigo() {
    var A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = new Uint32Array(8), s = '';
    (window.crypto || window.msCrypto).getRandomValues(r);
    for (var i = 0; i < 8; i++) s += A[r[i] % A.length];
    return s.slice(0, 4) + '-' + s.slice(4);
  }
  function openUsuarios() {
    if (!isResp()) { toast('Só o Administrador cadastra pessoas.'); return; }
    var f = modal('<h2 id="modalTitle">Usuários e acessos</h2>' +
      '<p>Cada pessoa entra com o próprio código. Desativar alguém tira o acesso de todos os aparelhos dela.</p>' +
      '<div class="us" aria-live="polite">Carregando…</div>' +
      '<p class="modal-err" role="alert" hidden></p>' +
      '<div class="modal-foot"><button type="button" class="btn" data-close>Fechar</button><button type="button" class="btn primary" data-us="novo">+ Nova pessoa</button></div>', null, 'wide');
    var dados = null;
    function carregar() {
      window.Banco.usuarios(banco.login.codigo).then(function (r) {
        dados = r;
        var lista = r.usuarios || [], el = f.querySelector('.us');
        var h = lista.length ? lista.map(function (u) {
          var pp = PAPEIS.find(function (x) { return x.k === u.papel; }) || PAPEIS[0];
          return '<div class="us-row' + (u.ativo ? '' : ' off') + '"><div class="us-txt"><b>' + esc(u.nome) + '</b> <span class="tag t-' + esc(u.papel) + '">' + esc(pp.nome) + '</span>' +
            (u.ativo ? '' : ' <span class="tag t-off">desativado</span>') + (u.id === r.eu ? ' <span class="tag">você</span>' : '') +
            '<small>' + (u.usado_em ? 'Último uso: ' + esc(fmtWhen(u.usado_em)) + ' · ' + u.aparelhos + (u.aparelhos === 1 ? ' aparelho' : ' aparelhos') : 'Ainda não entrou') + '</small></div>' +
            '<button type="button" class="btn small" data-us="edit" data-id="' + esc(u.id) + '">Editar</button></div>';
        }).join('') : '<p class="empty">Ninguém cadastrado ainda. Use “+ Nova pessoa”.</p>';
        if (r.codigo_equipe || r.codigo_responsavel) {
          h += '<div class="section-title">Códigos gerais (do sistema antigo)</div>' +
            '<p class="hint">Ainda entram, pedindo o nome. Quando todos tiverem código próprio, desative.</p>' +
            (r.codigo_equipe ? '<div class="us-row"><div class="us-txt"><b>Código geral da equipe</b><small>Entra como engenheiro</small></div><button type="button" class="btn small danger" data-us="geral" data-papel="equipe">Desativar</button></div>' : '') +
            (r.codigo_responsavel ? '<div class="us-row"><div class="us-txt"><b>Código geral do responsável</b><small>Entra como Administrador</small></div><button type="button" class="btn small danger" data-us="geral" data-papel="responsavel">Desativar</button></div>' : '');
        }
        el.innerHTML = h;
      }, function (err) { f.querySelector('.us').textContent = errText(err); });
    }
    f.addEventListener('click', function (e) {
      var b = e.target.closest('[data-us]');
      if (!b) return;
      if (b.dataset.us === 'novo') openUsuario(null);
      else if (b.dataset.us === 'edit') openUsuario((dados.usuarios || []).find(function (u) { return u.id === b.dataset.id; }) || null);
      else if (b.dataset.us === 'geral') {
        var papel = b.dataset.papel;
        confirmar({ titulo: 'Desativar o código geral ' + (papel === 'equipe' ? 'da equipe' : 'do responsável') + '?',
          texto: 'Quem entrou com ele sai de todos os aparelhos e vai precisar de um código próprio. Não dá para reativar por aqui.',
          digitar: 'DESATIVAR', botao: 'Desativar', perigo: true }).then(function (r) {
          if (!r) { openUsuarios(); return; }
          window.Banco.codigoGeralDesativar(banco.login.codigo, papel).then(function () { toast('Código geral desativado.'); openUsuarios(); },
            function (err) { toast(errText(err), 6000); openUsuarios(); });
        });
      }
    });
    carregar();
  }
  function openUsuario(u) {
    var novo = !u;
    var radios = PAPEIS.map(function (x) {
      var on = u ? u.papel === x.k : x.k === 'fiscal';
      return '<label class="papel-op"><input type="radio" name="usPapel" value="' + x.k + '"' + (on ? ' checked' : '') + '><span><b>' + esc(x.nome) + '</b><small>' + esc(x.desc) + '</small></span></label>';
    }).join('');
    var f = modal('<h2 id="modalTitle">' + (novo ? 'Nova pessoa' : 'Editar ' + esc(u.nome)) + '</h2>' +
      mField('usNome', 'Nome (aparece no histórico e nas fotos)', false, u ? u.nome : '', 'off') +
      '<fieldset class="papeis"><legend>Acesso</legend>' + radios + '</fieldset>' +
      '<div class="field"><label for="usCod">' + (novo ? 'Código de acesso (pelo menos 6 caracteres)' : 'Novo código (deixe em branco para manter o atual)') + '</label>' +
      '<div class="cod-row"><input id="usCod" maxlength="200" autocomplete="off" autocorrect="off" spellcheck="false" value="' + (novo ? gerarCodigo() : '') + '"><button type="button" class="btn small" data-gerar>Gerar outro</button></div></div>' +
      (novo ? '' : '<label class="show-pw"><input type="checkbox" id="usAtivo"' + (u.ativo ? ' checked' : '') + '> Acesso ativo</label>') +
      MFOOT + '<button type="submit" class="btn primary">Salvar</button></div>',
    function (form) {
      var nome = form.querySelector('#usNome').value.trim(), papel = (form.querySelector('input[name=usPapel]:checked') || {}).value,
        cod = form.querySelector('#usCod').value.trim(), ativo = novo ? true : form.querySelector('#usAtivo').checked;
      if (!nome) { modalErr(form, 'Escreva o nome.'); return; }
      if (novo && cod.length < 6) { modalErr(form, 'O código precisa de pelo menos 6 caracteres.'); return; }
      if (!novo && cod && cod.length < 6) { modalErr(form, 'O código precisa de pelo menos 6 caracteres.'); return; }
      modalErr(form, '');
      busyBtn(form, true, 'Salvando…');
      window.Banco.usuarioSalvar(banco.login.codigo, { id: u ? u.id : null, nome: nome, papel: papel, codigo: cod || null, ativo: ativo }).then(function () {
        busyBtn(form, false);
        if (u && u.id === (banco.login && banco.login.uid) && papel !== banco.login.papel) conferirAcesso();
        if (cod) mostrarCodigo(nome, cod, novo);
        else { toast('Salvo.'); openUsuarios(); }
      }, function (err) { busyBtn(form, false); modalErr(form, errText(err)); });
    });
    f.querySelector('[data-gerar]').addEventListener('click', function () { f.querySelector('#usCod').value = gerarCodigo(); });
  }
  // o código só aparece agora: o banco guarda apenas a versão embaralhada
  function mostrarCodigo(nome, cod, novo) {
    var f = modal('<h2 id="modalTitle">' + (novo ? 'Pronto: passe o código para ' : 'Novo código de ') + esc(nome) + '</h2>' +
      '<div class="cod-show" id="codShow">' + esc(cod) + '</div>' +
      '<p>Ele aparece só agora. A pessoa entra no site ou no app em <b>Entrar</b> e digita esse código.' + (novo ? '' : ' Os aparelhos que usavam o código antigo vão pedir para entrar de novo.') + '</p>' +
      '<div class="modal-foot"><button type="button" class="btn" data-copiar>Copiar</button><button type="button" class="btn primary" data-close>Feito</button></div>');
    f.querySelector('[data-copiar]').addEventListener('click', function () {
      var t = 'Seu código de acesso ao Diagrama Linear BR-230: ' + cod;
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast('Código copiado.'); }, function () {
        var r = document.createRange(); r.selectNodeContents(f.querySelector('#codShow'));
        var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
        toast('Selecionado: copie com o menu do aparelho.');
      });
    });
    f.closest('.modal').addEventListener('click', function (e) { if (e.target.closest('[data-close]')) setTimeout(openUsuarios, 0); });
  }

  // ---------------- lixeira e cópias automáticas (engenheiro ou criador)
  function openLixeira() {
    if (!isEng()) { toast('A lixeira e as cópias são para engenheiros e o Administrador.'); return; }
    var f = modal('<h2 id="modalTitle">Lixeira e cópias de segurança</h2><div class="lx" aria-live="polite">Carregando…</div>' +
      '<div class="modal-foot"><button type="button" class="btn" data-close>Fechar</button></div>', null, 'wide');
    var dados = null;
    window.Banco.lixeira(banco.login.codigo).then(function (r) {
      dados = r;
      var lx = r.lixeira || [], cp = r.copias || [], h = '';
      h += '<div class="section-title">Excluídos · ficam 30 dias</div>';
      h += lx.length ? lx.map(function (x) {
        var km = x.km && (x.km[0] != null || x.km[1] != null) ? ' · KM ' + fmtKm(x.km[0]) + ' – ' + fmtKm(x.km[1]) : '';
        var titulo = x.tipo === 'ponto' ? 'Ponto ' + (x.nome || x.item_id) + ' · ' + (x.lote || 'contrato') + km : 'Contrato ' + (x.nome || x.item_id) + ' · ' + (x.pontos || 0) + ' pontos';
        return '<div class="lx-row"><div class="lx-txt"><b>' + esc(titulo) + '</b><small>Excluído por ' + esc(x.apagado_por || '—') + ' em ' + esc(fmtWhen(x.apagado_em)) +
          (x.tipo === 'ponto' && !x.contrato_existe ? ' · o contrato também foi excluído' : '') + '</small></div>' +
          '<button type="button" class="btn small" data-lx="rest" data-id="' + x.id + '">Restaurar</button></div>';
      }).join('') : '<p class="empty">Nada excluído nos últimos 30 dias.</p>';
      h += '<div class="section-title">Cópias automáticas · ficam 7 dias</div>' +
        '<p class="hint">O banco guarda uma cópia de tudo antes de cada exclusão, antes de muitas alterações juntas e a cada 6 horas de uso.</p>';
      h += cp.length ? cp.map(function (x) {
        return '<div class="lx-row"><div class="lx-txt"><b>' + esc(fmtWhen(x.em)) + '</b> · ' + x.contratos + ' contratos, ' + x.pontos + ' pontos<small>' + esc(x.motivo || '') + (x.autor ? ' · ' + esc(x.autor) : '') + '</small></div>' +
          '<div class="lx-acts"><button type="button" class="btn small" data-lx="baixar" data-id="' + x.id + '">Baixar</button>' +
          (r.pode_copia ? '<button type="button" class="btn small danger" data-lx="voltar" data-id="' + x.id + '">Voltar para esta</button>' : '') + '</div></div>';
      }).join('') : '<p class="empty">Nenhuma cópia ainda: a primeira é feita na próxima alteração.</p>';
      f.querySelector('.lx').innerHTML = h;
    }, function (err) { f.querySelector('.lx').textContent = errText(err); });
    f.addEventListener('click', function (e) {
      var b = e.target.closest('[data-lx]');
      if (!b || !dados) return;
      var id = Number(b.dataset.id);
      if (b.dataset.lx === 'rest') {
        var x = dados.lixeira.find(function (y) { return y.id === id; });
        if (!x) return;
        confirmar({ titulo: 'Restaurar ' + (x.tipo === 'ponto' ? 'o ponto ' : 'o contrato ') + (x.nome || '') + '?',
          texto: x.tipo === 'ponto' ? 'Ele volta para ' + (x.lote || 'o contrato') + ' com os dados de quando foi excluído.' : 'Ele volta com os ' + (x.pontos || 0) + ' pontos que tinha.',
          botao: 'Restaurar' }).then(function (r) {
          if (!r) { openLixeira(); return; }
          window.Banco.restaurarLixeira(banco.login.codigo, id).then(function () {
            toast((x.tipo === 'ponto' ? 'Ponto ' : 'Contrato ') + (x.nome || '') + ' restaurado.', 5000);
            if (x.tipo === 'contrato') state.activeId = x.item_id;
            refresh(true);
            openLixeira();
          }, function (err) { toast(errText(err), 7000); openLixeira(); });
        });
      } else if (b.dataset.lx === 'baixar') {
        var c = dados.copias.find(function (y) { return y.id === id; });
        b.disabled = true;
        window.Banco.copiaDados(banco.login.codigo, id).then(function (d) {
          b.disabled = false;
          var st = copiaParaEstado(d), dt = new Date(c.em);
          var nome = 'copia-diagrama-linear-' + dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0') + '-' + String(dt.getHours()).padStart(2, '0') + 'h' + String(dt.getMinutes()).padStart(2, '0') + '.json';
          saveBlob(nome, new Blob([JSON.stringify(st, null, 2)], { type: 'application/json' }), 'Cópia baixada: ' + nome);
        }, function (err) { b.disabled = false; toast(errText(err), 6000); });
      } else if (b.dataset.lx === 'voltar') {
        var cc = dados.copias.find(function (y) { return y.id === id; });
        confirmar({ titulo: 'Voltar TODOS os dados para ' + fmtWhen(cc.em) + '?',
          html: '<p>Contratos e pontos voltam a ficar como estavam nessa hora, para todos (' + cc.contratos + ' contratos, ' + cc.pontos + ' pontos). O que foi feito depois some.</p>' +
            '<p>Antes de voltar, o banco guarda uma cópia de agora: dá para desfazer pela mesma lista.</p>',
          digitar: 'RESTAURAR', botao: 'Voltar para esta cópia', perigo: true }).then(function (r) {
          if (!r) { openLixeira(); return; }
          window.Banco.restaurarCopia(banco.login.codigo, id).then(function () {
            banco.pend = []; keepSync();
            toast('Dados de volta para ' + fmtWhen(cc.em) + '.', 6000);
            refresh(true);
          }, function (err) { toast(errText(err), 7000); });
        });
      }
    });
  }
  // cópia do banco -> mesmo formato do "Salvar backup (.json)", que o "Abrir backup…" aceita
  function copiaParaEstado(d) {
    var byId = {}, s = { activeId: state.activeId, contracts: [] };
    (d.contratos || []).forEach(function (row) { var c = clone(row.dados || {}); c.id = row.id; c.pontos = []; byId[c.id] = c; s.contracts.push(c); });
    (d.pontos || []).forEach(function (row) { var c = byId[row.contrato_id]; if (!c) return; var p = clone(row.dados || {}); p.id = row.id; c.pontos.push(p); });
    return s;
  }

  // ---------------- propostas dos fiscais (aguardando aprovação de engenheiro ou criador)
  function propsDo(cid, pid) { return (banco.propostas || []).filter(function (x) { return x.contrato_id === cid && x.ponto_id === pid; }); }
  // serviço -> valor proposto (a proposta mais nova vale)
  function propServ(cid, pid) {
    var o = {};
    propsDo(cid, pid).forEach(function (x) {
      Object.keys(x.campos || {}).forEach(function (k) { if (k.indexOf('serv.') === 0 && x.campos[k].v) o[k.slice(5)] = x.campos[k].v; });
    });
    return o;
  }
  function propCampos(x) {
    return Object.keys(x.campos || {}).map(function (k) {
      var a = x.campos[k].a;
      return '<li><b>' + esc(fieldName(k)) + ':</b> ' + (a !== undefined ? esc(fmtValue(k, a)) + ' → ' : '') + '<b>' + esc(fmtValue(k, x.campos[k].v)) + '</b></li>';
    }).join('');
  }
  function propHtml(cid, p) {
    var list = propsDo(cid, p.id);
    if (!list.length) return '';
    return '<div class="props" role="group" aria-label="Mudanças aguardando aprovação">' + list.map(function (x) {
      var minha = banco.login && ((x.autor_uid && x.autor_uid === banco.login.uid) || (!x.autor_uid && x.autor_nome === banco.login.nome));
      return '<div class="prop"><div class="prop-txt"><span class="prop-tag">Aguardando aprovação</span> ' + (minha ? 'Sua mudança' : 'Mudança de <b>' + esc(x.autor_nome || 'fiscal') + '</b>') +
        ' · ' + esc(fmtWhen(x.atualizado_em)) + '<ul>' + propCampos(x) + '</ul></div>' +
        (isEng() ? '<div class="prop-acts"><button type="button" class="btn small primary" data-act="prop-ok" data-prop="' + x.id + '">Aprovar</button>' +
          '<button type="button" class="btn small" data-act="prop-no" data-prop="' + x.id + '">Recusar</button></div>' : '') + '</div>';
    }).join('') + '</div>';
  }
  function initAprov() {
    if ($('btnAprov')) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.id = 'btnAprov';
    b.className = 'btn small aprov';
    b.hidden = true;
    b.addEventListener('click', openAprov);
    var ss = $('saveState');
    ss.parentNode.insertBefore(b, ss);
    renderAprov();
  }
  function renderAprov() {
    var b = $('btnAprov');
    if (!b) return;
    var all = banco.propostas || [], n = all.length;
    if (isEng() && n) { b.hidden = false; b.textContent = 'Aprovar (' + n + ')'; b.title = n + ' mudança(s) de fiscais aguardando aprovação'; }
    else if (isFiscal()) {
      var minhas = all.filter(function (x) { return (x.autor_uid && x.autor_uid === banco.login.uid) || (!x.autor_uid && x.autor_nome === banco.login.nome); }).length;
      b.hidden = !minhas;
      b.textContent = minhas + (minhas === 1 ? ' aguardando aprovação' : ' aguardando aprovação');
      b.title = 'Suas mudanças que ainda não foram aprovadas';
    } else b.hidden = true;
    var it = document.querySelector('#menuPop [data-act="aprovar"]');
    if (it) it.textContent = 'Aprovar mudanças dos fiscais' + (n ? ' (' + n + ')' : '');
  }
  function openAprov() {
    var all = banco.propostas || [];
    if (isFiscal()) all = all.filter(function (x) { return (x.autor_uid && x.autor_uid === banco.login.uid) || (!x.autor_uid && x.autor_nome === banco.login.nome); });
    var eng = isEng();
    var lote = function (cid) { return loteOf(cid); };
    var h = all.length ? all.map(function (x) {
      return '<label class="ap-row">' + (eng ? '<input type="checkbox" value="' + x.id + '" checked>' : '') +
        '<span><b>' + esc(lote(x.contrato_id) + ' · ' + (x.ponto_nome || x.ponto_id)) + '</b> · ' + esc(x.autor_nome || 'fiscal') + ' · ' + esc(fmtWhen(x.atualizado_em)) +
        '<ul>' + propCampos(x) + '</ul></span></label>';
    }).join('') : '<p class="empty">Nada aguardando aprovação.</p>';
    var f = modal('<h2 id="modalTitle">' + (eng ? 'Mudanças dos fiscais' : 'Suas mudanças aguardando aprovação') + '</h2>' +
      (eng && all.length ? '<p>Aprovar aplica a mudança no diagrama de todos, em nome de quem fez. Recusar descarta.</p><label class="show-pw"><input type="checkbox" data-todas checked> Marcar todas</label>' : '') +
      '<div class="ap-list">' + h + '</div>' +
      '<div class="modal-foot"><button type="button" class="btn" data-close>Fechar</button>' +
      (eng && all.length ? '<button type="button" class="btn" data-ap="no">Recusar marcadas</button><button type="button" class="btn primary" data-ap="ok">Aprovar marcadas</button>' : '') + '</div>', null, 'wide');
    f.addEventListener('change', function (e) {
      if (e.target.hasAttribute('data-todas')) f.querySelectorAll('.ap-row input').forEach(function (i) { i.checked = e.target.checked; });
    });
    f.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ap]');
      if (!b) return;
      var ids = Array.prototype.map.call(f.querySelectorAll('.ap-row input:checked'), function (i) { return Number(i.value); });
      if (!ids.length) { toast('Marque pelo menos uma.'); return; }
      decidirPropostas(ids, b.dataset.ap === 'ok');
    });
  }
  function decidirPropostas(ids, aprovar) {
    if (!isEng()) { toast('Só engenheiro ou Administrador aprova.'); return; }
    var go = function (motivo) {
      window.Banco.decidir(banco.login.codigo, ids, aprovar, motivo).then(function (r) {
        var n = (r && r.n) || 0;
        toast(n ? (aprovar ? 'Aprovado' : 'Recusado') + (n > 1 ? ' (' + n + ')' : '') + '.' : 'Nada mudou: talvez outra pessoa já tenha decidido.', 4000);
        closeModal();
        refresh(true);
      }, function (err) { toast(errText(err), 6000); });
    };
    if (aprovar) { go(null); return; }
    confirmar({ titulo: ids.length > 1 ? 'Recusar ' + ids.length + ' mudanças?' : 'Recusar a mudança?', texto: 'O diagrama continua como está. Quem fez vê que foi recusada.', campo: 'Motivo (opcional)', botao: 'Recusar', perigo: true })
      .then(function (r) { if (r) go(r.valor || null); });
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
    bar.innerHTML = '<span>Agora os dados vêm do banco da equipe. O que estava só neste aparelho foi guardado: se alguém editou aqui, baixe o backup e mande ao Administrador.</span>' +
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
  // ---------------- fotos para o Google Drive da equipe (drive.js); o endereço do envio fica no banco (config "driveFotos")
  var driveQ = null;
  function driveReady() { return !!(banco.on && banco.cfg.driveFotos && banco.cfg.driveFotos.url); }
  function driveStatus() {
    if (!driveQ || !driveReady()) return '';
    var i = driveQ.info(), n = i.n, fotos = n + (n === 1 ? ' foto' : ' fotos');
    if (!n) return i.enviadas ? 'Fotos enviadas ao Drive da equipe.' : 'As fotos marcadas vão para o Drive da equipe.';
    if (!banco.login) return fotos + ' esperando para o Drive: entre com o código da equipe.';
    if (i.erro === 'codigo') return fotos + ' esperando para o Drive: o código mudou, entre de novo.';
    if (i.busy) return 'Enviando ao Drive… (' + fotos + ' na fila)';
    if (i.erro === 'rede' || navigator.onLine === false) return 'Sem sinal: ' + fotos + ' esperando para o Drive.';
    if (i.erro) return fotos + ' esperando para o Drive (o Google recusou; tenta de novo sozinho).';
    return fotos + ' na fila para o Drive.';
  }
  function onDriveChange() { syncStatus(); if (foto) foto.refreshDrive(); renderGaleriaBtn(); if (galeria) galeria.changed(); }
  function initDrive() {
    if (!banco.on || !window.DriveFotos || driveQ) return;
    driveQ = window.DriveFotos({
      getUrl: function () { return driveReady() ? banco.cfg.driveFotos.url : null; },
      getLogin: function () { return banco.login; },
      ambiente: (window.AMBIENTE && window.AMBIENTE.nome) || 'oficial',
      registrar: function (cred, f, mini) { return window.Banco.fotoRegistrar(cred, f, mini); },
      onChange: onDriveChange
    });
  }
  // ---------------- galeria (galeria.js): fotos deste aparelho e da equipe, conforme o acesso
  var galeria = null;
  function galeriaOn() { return !!(banco.on && driveQ && window.Galeria); }
  function abrirGaleria(f) {
    if (!galeriaOn()) return;
    if (!galeria) {
      galeria = window.Galeria({
        drive: driveQ, Banco: window.Banco, nivel: nivel, getLogin: function () { return banco.login; },
        driveUrl: function () { return driveReady() ? banco.cfg.driveFotos.url : null; },
        ambiente: (window.AMBIENTE && window.AMBIENTE.nome) || 'oficial',
        contratos: function () { return state.contracts; }, ativo: function () { var c = active(); return c ? c.id : ''; },
        toast: toast, confirmar: confirmar, saveBlob: saveBlob, entrar: openLogin,
        relatorioPdf: window.RelatorioFoto ? relatorioPdf : null
      });
    }
    galeria.open(f);
  }
  // ---------------- relatório fotográfico em PDF (relatorio.js), no modelo do DNIT: uma folha por ponto ou ponte
  var relFoto = null;
  function relatorioPdf(a) {
    if (!relFoto) {
      relFoto = window.RelatorioFoto({
        contratos: function () { return state.contracts; }, ativo: active, ordem: sortedPoints, descricao: descRelatorio, ehOae: isOae,
        ensureLibs: ensureLibs, saveBlob: saveBlob, toast: toast, modal: modal, closeModal: closeModal,
        podeEditar: function () { return !readOnly() && !isFiscal(); }, salvarContrato: salvarCamposContrato, logoSupervisora: window.UNIFILAR_LOGO || null
      });
    }
    relFoto.abrir(a);
  }
  // texto inicial da descrição: situação de cada serviço (lotes) ou estado de cada grupo na vistoria (pontes) e a observação
  function descRelatorio(c, p) {
    var partes;
    if (isOae(c)) {
      partes = OAE_SERVICES.map(function (s) {
        var sv = p.serv[s.key], k = oaeSt(sv);
        if (k === 'NV' || k === 'NA') return '';
        var qt = comQtd(k) ? fmtQtd(s, sv.q) : '';
        return s.short + ': ' + oaeStOf(s, k).name.toLowerCase() + (qt ? ' ' + qt : '') + (comQtd(k) && sv.n ? ' (' + sv.n + ')' : '') +
          (comQtd(k) && sv.pri ? ', prioridade' : '') + (comQtd(k) && sv.ci ? ', conclusão informada pela executora' : '');
      });
    } else {
      partes = SERVICES.map(function (s) {
        var sv = p.serv[s.key];
        if (!sv || sv.st === 'NA' || !STATUS[sv.st]) return '';
        return s.label + ': ' + STATUS[sv.st].name.toLowerCase() + (sv.st === 'OK' ? '' : ', ' + fmtPct(svcPct(sv)));
      });
    }
    var t = partes.filter(Boolean).join('; ');
    return (t ? t + '.' : '') + (p.obs ? (t ? '\n' : '') + String(p.obs).trim() : '');
  }
  // campos do contrato alterados pelo relatório (local e logo da executora): sobem ao banco como qualquer edição
  function salvarCamposContrato(cid, campos) {
    var c = contractById(cid);
    if (!c || readOnly() || isFiscal()) return;
    Object.keys(campos).forEach(function (k) { if (campos[k] == null) delete c[k]; else c[k] = campos[k]; });
    save();
  }
  // botão Galeria: mostra quantas fotos deste aparelho ainda esperam envio
  function renderGaleriaBtn() {
    var b = $('btnGaleria');
    if (!b) return;
    b.hidden = !galeriaOn();
    var n = driveQ ? driveQ.info().n : 0, el = b.querySelector('.gl-pend');
    if (el) { el.textContent = n; el.hidden = !n; }
    b.title = n ? n + (n === 1 ? ' foto esperando envio' : ' fotos esperando envio') : 'Fotos deste aparelho e da equipe';
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
    if (readOnly()) $('editor').querySelectorAll('input,select,textarea').forEach(function (el) { el.disabled = true; });
    else if (isFiscal()) $('editor').querySelectorAll('input,select,textarea').forEach(function (el) { if (!el.hasAttribute('data-svcpct')) el.disabled = true; });
  }
  var EDIT_ACTS = ['set-st', 'set-marca', 'add-point', 'dup-point', 'del-point', 'add-dev', 'del-dev', 'add-marco', 'del-marco', 'new-contract', 'del-contract'];
  var POINT_ACTS = ['set-st', 'set-marca', 'add-point', 'dup-point', 'del-point', 'add-dev', 'del-dev'];   // ações que mexem nos pontos
  function initBanco() {
    if (!banco.on) { var lb = $('btnLogin'); if (lb) lb.hidden = true; return; }
    prepareOld();
    var s = lsGet(SYNC_KEY);
    if (s) {
      banco.versao = Number(s.versao) || 0; banco.pend = Array.isArray(s.pend) ? s.pend : []; banco.cfg = s.cfg || {};
      banco.meta = s.meta && typeof s.meta === 'object' ? s.meta : {}; banco.conf = Array.isArray(s.conf) ? s.conf : [];
    }
    banco.base = clone(state);   // o estado guardado aqui já inclui o que está na fila
    initDrive();
    renderGaleriaBtn();
    $('btnGaleria').addEventListener('click', function () { abrirGaleria(); });
    banco.propostas = s && Array.isArray(s.propostas) ? s.propostas : [];
    setLogin(lsGet(LOGIN_KEY));
    if (banco.conf.length) showConflicts();
    $('btnLogin').addEventListener('click', openLogin);
    initAprov();
    document.querySelectorAll('[data-act="reset"]').forEach(function (b) { b.hidden = true; var hr = b.previousElementSibling; if (hr && hr.tagName === 'HR') hr.hidden = true; });
    $('editor').addEventListener('focusout', function () { setTimeout(function () { if (banco.want && !typing()) refresh(); }, 50); });
    window.addEventListener('online', function () { banco.online = true; banco.espera = 0; flush(); poll(); });
    window.addEventListener('offline', function () { banco.online = false; syncStatus(); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') return;
      poll();
      if (isEng()) {
        conferirAcesso();   // quem tem a análise no aparelho: confere se ainda é engenheiro ou criador
        var ca = active();
        if (ca && analise.estado[ca.id] === 'erro') { delete analise.estado[ca.id]; renderEditor(); }
      }
    });
    setInterval(function () { if (document.visibilityState === 'visible' && isEng()) conferirAcesso(); }, 300000);
    window.addEventListener('hashchange', function () { if (location.hash === '#configurar') openConfigurar(); });
    setInterval(poll, 20000);
    syncStatus();
    refresh().then(function () {
      conferirAcesso().then(flush);
      if (location.hash === '#configurar') openConfigurar();
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
    folhaVistoria = lsGet(FOLHA_KEY) === 'vistoria';
    $('folhaSw').addEventListener('click', function (e) {
      var x = e.target.closest('[data-folha]');
      if (!x) return;
      folhaVistoria = x.dataset.folha === 'vistoria';
      lsPut(FOLHA_KEY, folhaVistoria ? 'vistoria' : 'analise');
      renderPreview();
    });
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
      var pop = $('menuPop'), rec = pop.querySelector('[data-act="recusadas"]'), nr = recusadas().length;
      if (rec) { rec.hidden = !nr; rec.textContent = 'Alterações recusadas (' + nr + ')'; }
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
    drive: function () { return driveQ; },
    diffOps: diffOps,
    applyOps: applyOps
  };

  init();
  window.Unifilar.pronto = true;   // atualizar.js confere isto antes de confirmar ao app que uma versão baixada abriu bem
})();
