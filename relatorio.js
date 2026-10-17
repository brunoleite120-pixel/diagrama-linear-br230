/*
 * Relatório fotográfico em PDF (A4), no modelo do DNIT usado pela supervisão: cabeçalho do DNIT, executora e supervisora,
 * objeto, local, as fotos marcadas com ★ no período escolhido e a descrição.
 *   Lotes (pontos críticos, obra pontual): até 6 fotos por ponto (2 × 2 até 4 fotos; 2 × 3 com 5 ou 6; acima de 6 vão as 6 primeiras).
 *   Pontes (contrato 'oae', serviço contínuo): até 6 fotos por folha; com mais, a ponte segue em folhas equilibradas (8 → 4 + 4).
 *   Folhas: "juntar" (padrão) põe pontos com poucas fotos na mesma folha, até 6 fotos, cada foto com o nome do ponto/ponte;
 *   "uma por ponto" deixa cada ponto na sua folha, mesmo com uma foto só.
 * O período é uma semana, um mês ou datas livres. A descrição vem preenchida pelo app (situação do ponto e observação)
 * e pode ser ajustada antes de gerar; o texto ajustado fica guardado neste aparelho para a próxima vez.
 *
 *   var r = RelatorioFoto({ contratos, ativo, ordem, descricao, ehOae, ensureLibs, saveBlob, toast, modal, closeModal,
 *                           podeEditar, salvarContrato, logoSupervisora, nomes });
 * nomes: funções de nome do contrato do app.js (nome de tela na escolha do contrato e no nome do arquivo); o título do PDF
 * continua com o Lote da licitação.
 *   r.abrir({ itens, arquivo, cid })   itens: fotos marcadas (da galeria); arquivo(it) -> Promise<Blob> da foto inteira
 */
(function () {
  'use strict';

  var PW = 595.28, PH = 841.89, X0 = 40, X1 = PW - 40, W = X1 - X0, MID = X0 + W / 2, LBL = 112;
  var AZUL = [0, 32, 96];   // azul das barras do modelo
  var CAB = ['MINISTÉRIO DOS TRANSPORTES', 'DEPARTAMENTO NACIONAL DE INFRAESTRUTURA DE TRANSPORTES', 'SUPERINTENDÊNCIA REGIONAL DO ESTADO DO PARÁ', 'UNIDADE LOCAL DE ALTAMIRA/PA'];
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var DESC_KEY = 'diagrama-linear.rel-desc', FOLHAS_KEY = 'diagrama-linear.rel-folhas';
  var FOTO_MAX = 1400;   // lado maior da foto no PDF (px): nítida na folha e o arquivo não fica pesado

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function iso(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function br(s) { var p = String(s).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function fmtKm(n) { return n == null || !isFinite(n) ? '?' : Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function plural(n, a, b) { return n + ' ' + (n === 1 ? a : b); }
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function lsPut(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } }
  function diaDe(em) { if (!em) return ''; var d = new Date(em); return isFinite(d) ? iso(d) : String(em).slice(0, 10); }

  // semanas de segunda a domingo e meses, os mais recentes primeiro
  function semanas(n) {
    var out = [], d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (d.getDay() + 6) % 7);
    for (var i = 0; i < n; i++) {
      var a = new Date(d); a.setDate(d.getDate() - 7 * i);
      var b = new Date(a); b.setDate(a.getDate() + 6);
      out.push({ de: iso(a), ate: iso(b), t: br(iso(a)).slice(0, 5) + ' a ' + br(iso(b)) + (i === 0 ? ' (esta semana)' : i === 1 ? ' (semana passada)' : '') });
    }
    return out;
  }
  function meses(n) {
    var out = [], d = new Date();
    for (var i = 0; i < n; i++) {
      var a = new Date(d.getFullYear(), d.getMonth() - i, 1), b = new Date(a.getFullYear(), a.getMonth() + 1, 0);
      out.push({ de: iso(a), ate: iso(b), t: MESES[a.getMonth()] + ' de ' + a.getFullYear() });
    }
    return out;
  }

  // ---------------------------------------------------------------- imagens
  function paraJpeg(blob) {
    return new Promise(function (res, rej) {
      var u = URL.createObjectURL(blob), im = new Image();
      im.onload = function () {
        var w = im.naturalWidth, h = im.naturalHeight, k = Math.min(1, FOTO_MAX / Math.max(w, h));
        var cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
        var g = cv.getContext('2d');
        g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, cv.width, cv.height);
        g.drawImage(im, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(u);
        res({ src: cv.toDataURL('image/jpeg', 0.82), w: cv.width, h: cv.height });
      };
      im.onerror = function () { URL.revokeObjectURL(u); rej(new Error('imagem')); };
      im.src = u;
    });
  }
  function tipoImg(src) { return /^data:image\/png/.test(src) ? 'PNG' : 'JPEG'; }

  // ---------------------------------------------------------------- folha
  function Folha(doc) {
    function fit(lw, lh, bw, bh) { var k = Math.min(bw / lw, bh / lh); return { w: lw * k, h: lh * k }; }
    function img(L, cx, cy, bw, bh, alias) {
      if (!L || !L.src) return false;
      var f = fit(L.w, L.h, bw, bh);
      doc.addImage(L.src, tipoImg(L.src), cx - f.w / 2, cy - f.h / 2, f.w, f.h, alias, 'FAST');
      return true;
    }
    function barra(y, h, t, x, w) {
      doc.setFillColor(AZUL[0], AZUL[1], AZUL[2]);
      doc.rect(x, y, w, h, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      var s = caber(t, w - 8, 8, 6, true);
      while (t.length > 4 && doc.getTextWidth(t) > w - 8) t = t.slice(0, -2).replace(/\s+$/, '') + '…';
      doc.text(t, x + w / 2, y + h / 2 + s * 0.35, { align: 'center' });
      doc.setTextColor(0, 0, 0);
    }
    function caber(t, w, size, min, bold) {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      var s = size;
      doc.setFontSize(s);
      while (s > min && doc.getTextWidth(t) > w) { s -= 0.25; doc.setFontSize(s); }
      return s;
    }
    function hline(y) { doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.6); doc.line(X0, y, X1, y); }
    function vline(x, y1, y2) { doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.6); doc.line(x, y1, x, y2); }
    // linha com rótulo à esquerda (OBJETO, LOCAL): o texto quebra em até 2 linhas
    function linhaRot(y, rot, val) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      var ls = doc.splitTextToSize(String(val || '-'), W - LBL - 12).slice(0, 2), h = ls.length > 1 ? 24 : 15;
      doc.setFont('helvetica', 'bold');
      doc.text(rot, X0 + LBL / 2, y + h / 2 + 2.8, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      ls.forEach(function (l, i) { doc.text(l, X0 + LBL + (W - LBL) / 2, y + h / 2 + 2.8 + (i - (ls.length - 1) / 2) * 9.5, { align: 'center' }); });
      vline(X0 + LBL, y, y + h);
      hline(y + h);
      return y + h;
    }

    return function (P) {
      var y = 36, top = y, cx;
      // cabeçalho
      img(P.logos.dnit, X0 + 82, y + 32, 140, 48, 'lg-dnit');
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      CAB.forEach(function (t, i) { doc.text(t, X0 + 178, y + 19 + i * 10.6); });
      y += 64;
      hline(y);
      barra(y, 12, 'EMPRESA EXECUTORA:', X0, W / 2);
      barra(y, 12, 'EMPRESA SUPERVISORA:', MID, W / 2);
      y += 12;
      // executora só pelo nome; supervisora com a logo; depois nomes e contratos
      var yl = y;
      var s0 = caber(P.executora, W / 2 - 20, 12, 7, true);
      doc.text(P.executora, X0 + W / 4, y + 21 + s0 * 0.35, { align: 'center' });
      img(P.logoSup, MID + W / 4, y + 21, W / 2 - 60, 30, 'lg-sup');
      y += 42;
      hline(y);
      [[P.executora, X0 + W / 4], [P.supervisora, MID + W / 4]].forEach(function (n) {
        var s = caber(n[0], W / 2 - 12, 8, 6, false);
        doc.text(n[0], n[1], y + 9.8, { align: 'center' });
        doc.setFontSize(s);
      });
      y += 14;
      hline(y);
      [[P.contrato, X0 + W / 4], [P.ctSupervisao, MID + W / 4]].forEach(function (n) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        var a = 'CONTRATO:', wa = doc.getTextWidth(a);
        doc.setFont('helvetica', 'normal');
        var b = n[0] || '-', wb = doc.getTextWidth(b), x = n[1] - (wa + 8 + wb) / 2;
        doc.setFont('helvetica', 'bold');
        doc.text(a, x, y + 9.8);
        doc.setFont('helvetica', 'normal');
        doc.text(b, x + wa + 8, y + 9.8);
      });
      y += 14;
      vline(MID, yl - 12, y);
      hline(y);
      y = linhaRot(y, 'OBJETO:', P.objeto);
      y = linhaRot(y, 'LOCAL:', P.local);
      barra(y, 15, P.titulo, X0, W);
      y += 15;
      doc.setFont('helvetica', 'bold');
      var rt = 'REGISTROS DE ATIVIDADES EM CAMPO' + (P.periodo ? ' – ' + P.periodo : '');
      caber(rt, W - 12, 8, 6, true);
      doc.text(rt, X0 + W / 2, y + 10.4, { align: 'center' });
      y += 15;
      hline(y);

      // descrição: mede antes, para as fotos ocuparem o resto da folha
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      var dl = [], maxL = 10;
      function cortar(ls, n) { if (ls.length > n) { ls = ls.slice(0, n); ls[n - 1] = ls[n - 1].replace(/.{0,2}$/, '') + '…'; } return ls; }
      if (Array.isArray(P.desc)) {   // folha com vários pontos: um parágrafo por ponto, cada um com a sua parte das linhas
        maxL = 12;
        var porPar = Math.max(2, Math.floor(maxL / P.desc.length));
        P.desc.forEach(function (par) { dl = dl.concat(cortar(doc.splitTextToSize(par, W - LBL - 14), porPar)); });
      } else {
        String(P.desc || '').split('\n').forEach(function (par) { dl = dl.concat(doc.splitTextToSize(par, W - LBL - 14)); });
      }
      dl = cortar(dl, maxL);
      var hDesc = Math.max(30, dl.length * 10 + 12), hRod = 48, yRod = PH - 30 - hRod, yDesc = yRod - hDesc - 13;

      // fotos: 1 ou 2 na largura toda; 2 × 2 até 4; 2 × 3 com 5 ou 6
      var nF = P.fotos.length, cols = nF <= 2 ? 1 : 2, rows = nF <= 2 ? Math.max(1, nF) : nF > 4 ? 3 : 2;
      var ch = (yDesc - y) / rows, cw = W / cols;
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var k = r * cols + c, fx = X0 + c * cw, fy = y + r * ch;
          if (k < nF) barra(fy, 11, P.legendas ? P.legendas[k] : 'FOTO ' + pad2(P.numIni + k), fx, cw);
          var f = P.fotos[k], bx = fx + 5, by = fy + 11 + 5, bw = cw - 10, bh = ch - 11 - 10;
          if (f && f.src) {
            var ff = fit(f.w, f.h, bw, bh);
            doc.addImage(f.src, 'JPEG', bx + (bw - ff.w) / 2, by + (bh - ff.h) / 2, ff.w, ff.h, f.alias, 'FAST');
          } else if (f === null) {
            doc.setFillColor(238, 240, 239);
            doc.rect(bx, by, bw, bh, 'F');
            doc.setTextColor(92, 102, 97);
            doc.setFontSize(8);
            doc.text('Foto indisponível (não veio do Drive)', bx + bw / 2, by + bh / 2, { align: 'center' });
            doc.setTextColor(0, 0, 0);
          }
        }
        if (r > 0) hline(y + r * ch);
      }
      if (cols > 1) vline(MID, y, yDesc);
      y = yDesc;
      hline(y);
      barra(y, 13, 'DESCRIÇÃO:', X0, W);
      y += 13;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(P.rotDesc, X0 + LBL - 8, y + hDesc / 2 + 2.8, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      var dy = y + (hDesc - (dl.length - 1) * 10) / 2 + 2.8;
      dl.forEach(function (l, i) { doc.text(l, X0 + LBL + 7, dy + i * 10); });
      vline(X0 + LBL, y, y + hDesc);
      y += hDesc;
      hline(y);
      // rodapé
      cx = y + hRod / 2;
      img(P.logos.dnitRodape, X0 + W / 4, cx, 150, 28, 'lg-dnit2');
      img(P.logos.mt, MID + W / 4, cx, 150, 30, 'lg-mt');
      y += hRod;
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.9);
      doc.rect(X0, top, W, y - top);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(92, 102, 97);
      doc.text('Folha ' + P.pag + ' de ' + P.tot + '   ·   gerado em ' + P.gerado, X1, PH - 16, { align: 'right' });
      doc.setTextColor(0, 0, 0);
    };
  }

  // ---------------------------------------------------------------- tela de escolha
  var CSS = [
    '.rf-modal{max-width:640px!important}',
    '.rf-per{border:0;margin:0;padding:0;display:grid;gap:8px}',
    '.rf-per legend{font-size:12.5px;font-weight:600;color:var(--ink-2);padding:0;margin-bottom:6px}',
    '.rf-per .seg{grid-template-columns:repeat(3,minmax(0,1fr))}',
    '.rf-per .seg button[aria-pressed="true"],.rf-folhas button[aria-pressed="true"]{background:var(--accent);color:#fff}',
    '.rf-folhas{grid-template-columns:repeat(2,minmax(0,1fr))}',
    '.rf-folhas button{white-space:normal;line-height:1.2;padding:4px 6px;min-height:36px}',
    '.rf-datas{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:13px}',
    '.rf-datas input{min-height:34px;border:1px solid var(--line);border-radius:6px;padding:4px 8px}',
    '.rf-sel{width:100%;min-height:36px;border:1px solid var(--line);border-radius:6px;padding:4px 8px;background:#fff;font-size:13.5px}',
    '.rf-resumo{font-size:13px;color:var(--ink-2)}',
    '.rf-resumo b{color:var(--ink)}',
    '.rf-aviso{font-size:12.5px;color:#9A5B00}',
    '.rf-pts{display:grid;gap:8px;max-height:min(46vh,420px);overflow:auto;padding-right:2px}',
    '.rf-pt{border:1px solid var(--line);border-radius:8px;padding:8px 10px;display:grid;gap:6px}',
    '.rf-pt b{font-size:13px}',
    '.rf-pt small{font-size:12px;color:var(--ink-3)}',
    '.rf-pt textarea{width:100%;min-height:64px;border:1px solid var(--line);border-radius:6px;padding:6px 8px;font:inherit;font-size:13px;resize:vertical}',
    '.rf-pt .rf-auto{justify-self:start;border:0;background:none;color:var(--accent);font-size:12px;padding:0}'
  ].join('\n');

  // cópia curta das funções de nome do app.js (o app passa as dele em o.nomes): nome de tela pelo tipo e número do contrato,
  // lote da licitação ("Lote 01") e nº do CT, para o nome do arquivo
  function nomesPadrao() {
    var PAL = { pc: 'Pontos Críticos', conserva: 'Conservação', oae: 'Proarte' };
    function lp(v) { return v == null ? '' : String(v).trim().replace(/\s+/g, ' '); }
    function nome(c) {
      if (!c) return '';
      var m = /(\d{3,})\s*\/\s*\d{4}/.exec(lp(c.numero)), w = PAL[c.tipo === 'oae' ? 'oae' : c.tipo === 'conserva' ? 'conserva' : 'pc'];
      return m ? w + ' ' + String(Number(m[1])) : lp(c.lote) || w;
    }
    function loteReal(c) { var l = lp(c && c.lote); return /^lote\b/i.test(l) ? l : ''; }
    function numeroCT(c) { var n = lp(c && c.numero); return n ? 'CT ' + n : ''; }
    function partesArquivo(c) {
      var out = [];
      [nome(c), loteReal(c), numeroCT(c)].forEach(function (x) { if (x && out.indexOf(x) < 0) out.push(x); });
      return out;
    }
    return { nome: nome, loteReal: loteReal, numeroCT: numeroCT, partesArquivo: partesArquivo };
  }

  window.RelatorioFoto = function (o) {
    var LG = window.RELATORIO_LOGOS || {}, nomes = o.nomes || nomesPadrao();
    // "Nº 01" dos pontos emergenciais: o número do nome (P1 → 01) ou a ordem no contrato
    function numero(c, p, i) { var m = /(\d+)/.exec(p.nome || ''); return pad2(m ? Number(m[1]) : i + 1); }
    // conservação (437, 438): "SEGMENTO Nº 01", e não "PONTO EMERGENCIAL" (texto a confirmar com a fiscalização)
    function conserva(c) { return !!(c && c.tipo === 'conserva'); }
    function titulo(c, p, num) {
      if (o.ehOae(c)) {
        return [p.codigo, p.nome ? 'PONTE ' + String(p.nome).toUpperCase() : ''].filter(Boolean).join(' · ') +
          (p.kmIni != null ? ' · KM ' + (p.kmConferir ? '~' : '') + fmtKm(p.kmIni) : '') +
          (p.kmContrato != null && p.kmContrato !== p.kmIni ? ' (CONTR. ' + fmtKm(p.kmContrato) + ')' : '');
      }
      return (conserva(c) ? 'SEGMENTO Nº ' : 'PONTO EMERGENCIAL Nº ') + num + (p.kmIni != null ? ' · KM ' + fmtKm(p.kmIni) + (p.kmFim != null && p.kmFim !== p.kmIni ? ' A ' + fmtKm(p.kmFim) : '') : '');
    }
    // nome curto, para a legenda de cada foto quando a folha junta vários pontos
    function curto(c, p, num) {
      if (o.ehOae(c)) return p.nome ? 'PONTE ' + String(p.nome).toUpperCase() : String(p.codigo || p.id).toUpperCase();
      return (conserva(c) ? 'SEGMENTO Nº ' : 'PONTO Nº ') + num + (p.kmIni != null ? ' · KM ' + fmtKm(p.kmIni) : '');
    }
    function localPadrao(c) {
      return c.localRelatorio || [c.rodovia || 'BR-230/PA', [c.origem, c.destino].filter(Boolean).join(' – ')].filter(Boolean).join(': ') +
        (c.kmIni != null && c.kmFim != null ? ' (km ' + fmtKm(c.kmIni) + ' a ' + fmtKm(c.kmFim) + ')' : '');
    }

    function abrir(a) {
      if (!document.getElementById('rfCss')) { var st = document.createElement('style'); st.id = 'rfCss'; st.textContent = CSS; document.head.appendChild(st); }
      var cs = o.contratos(), atv = o.ativo();
      var com = cs.filter(function (c) { return a.itens.some(function (it) { return it.cid === c.id; }); });
      var S = {
        cid: (a.cid && cs.some(function (c) { return c.id === a.cid; })) ? a.cid : (com.some(function (c) { return c.id === (atv && atv.id); }) ? atv.id : (com[0] || atv || cs[0] || {}).id),
        modo: 'semana', sem: semanas(12), mes: meses(12), iSem: 0, iMes: 0,
        de: iso(new Date(Date.now() - 14 * 864e5)), ate: iso(new Date()), gerando: false, parar: false,
        folhas: lsGet(FOLHAS_KEY) === 'ponto' ? 'ponto' : 'juntar'
      };
      // começa na semana mais recente que tem foto
      var ultima = a.itens.filter(function (it) { return it.cid === S.cid; }).map(function (it) { return diaDe(it.em); }).sort().pop();
      if (ultima) {
        var iw = S.sem.findIndex(function (s) { return ultima >= s.de && ultima <= s.ate; });
        if (iw > 0) S.iSem = iw;
        else if (iw < 0) S.modo = 'mes';
        var im = S.mes.findIndex(function (s) { return ultima >= s.de && ultima <= s.ate; });
        if (im >= 0) S.iMes = im;
      }
      var textos = lsGet(DESC_KEY) || {};

      function contrato() { return cs.find(function (c) { return c.id === S.cid; }) || cs[0]; }
      function periodo() {
        if (S.modo === 'semana') return S.sem[S.iSem];
        if (S.modo === 'mes') return S.mes[S.iMes];
        var de = S.de <= S.ate ? S.de : S.ate, ate = S.de <= S.ate ? S.ate : S.de;
        return { de: de, ate: ate, t: br(de) + ' a ' + br(ate) };
      }
      function perTxt(p) { return p.de === p.ate ? br(p.de) : br(p.de) + ' A ' + br(p.ate); }
      function chave(c, p, per) { return c.id + ':' + p.id + ':' + per.de + ':' + per.ate; }
      function grupos() {
        var c = contrato(), per = periodo(), porP = {}, sem = 0, total = 0;
        var pts = o.ordem(c), ids = {};
        pts.forEach(function (p) { ids[p.id] = 1; });
        a.itens.forEach(function (it) {
          if (it.cid !== c.id) return;
          var d = diaDe(it.em);
          if (!d || d < per.de || d > per.ate) return;
          total++;
          if (!it.pid || !ids[it.pid]) { sem++; return; }
          (porP[it.pid] = porP[it.pid] || []).push(it);
        });
        var oae = o.ehOae(c), lista = [];
        pts.forEach(function (p, i) {
          var fs = porP[p.id];
          if (!fs) return;
          fs.sort(function (x, y) { return String(x.em || '').localeCompare(String(y.em || '')); });
          var num = numero(c, p, i), k = chave(c, p, per), auto = o.descricao(c, p);
          lista.push({ p: p, num: num, fotos: oae ? fs : fs.slice(0, 6), corte: oae ? 0 : Math.max(0, fs.length - 6), titulo: titulo(c, p, num), auto: auto,
            curto: curto(c, p, num), desc: textos[k] != null ? textos[k] : auto, chave: k, folhas: oae ? Math.ceil(fs.length / 6) : 1 });
        });
        return { c: c, per: per, oae: oae, pts: lista, sem: sem, total: total };
      }
      // as folhas do PDF: cada ponto em pedaços de até 6 fotos (ponte com mais de 6: folhas equilibradas, 8 → 4 + 4, 13 → 5 + 4 + 4);
      // no modo "juntar", pedaços que cabem juntos (até 6 fotos) dividem a folha, na ordem dos pontos
      function folhasDoPdf() {
        var plano = [];
        G.pts.forEach(function (x) {
          var blocos = [], i = 0, nf = G.oae ? x.folhas : 1;
          for (var j = 0; j < nf; j++) { var q = Math.ceil((x.fotos.length - i) / (nf - j)); blocos.push(x.fotos.slice(i, i + q)); i += q; }
          var ini = 1;
          blocos.forEach(function (bl, j) {
            var pd = { x: x, fotos: bl, numIni: ini, parte: j + 1, partes: blocos.length }, ult = plano[plano.length - 1];
            ini += bl.length;
            if (S.folhas === 'juntar' && blocos.length === 1 && ult && !ult.dividida && ult.n + bl.length <= 6) { ult.itens.push(pd); ult.n += bl.length; }
            else plano.push({ itens: [pd], n: bl.length, dividida: blocos.length > 1 });
          });
        });
        return plano;
      }

      var G = null;
      function corpo() {
        G = grupos();
        var c = G.c, folhas = folhasDoPdf().length, pode = o.podeEditar();
        var h = '<div class="field"><label for="rfLocal">Local (vai no cabeçalho de todas as folhas)</label><input id="rfLocal" maxlength="160" value="' + esc(localPadrao(c)) + '"' + (pode ? '' : ' disabled') + '></div>';
        if (!G.total) {
          h += '<div class="rf-resumo">Nenhuma foto marcada com ★ ' + (S.modo === 'semana' ? 'nesta semana' : S.modo === 'mes' ? 'neste mês' : 'neste período') + ' para este contrato.</div>';
          return h;
        }
        h += '<div class="rf-resumo"><b>' + plural(G.pts.length, G.oae ? 'ponte' : 'ponto', G.oae ? 'pontes' : 'pontos') + '</b> · ' +
          plural(G.pts.reduce(function (s, x) { return s + x.fotos.length; }, 0), 'foto', 'fotos') + ' · <b>' + plural(folhas, 'folha', 'folhas') + '</b> A4</div>';
        if (G.pts.length > 1) {
          h += '<div class="seg rf-folhas" role="group" aria-label="Folhas">' + [['juntar', 'Juntar ' + (G.oae ? 'pontes' : 'pontos') + ' (até 6 fotos por folha)'], ['ponto', 'Uma folha por ' + (G.oae ? 'ponte' : 'ponto')]].map(function (m) {
            return '<button type="button" data-rf="folhas" data-v="' + m[0] + '" aria-pressed="' + (S.folhas === m[0]) + '">' + m[1] + '</button>';
          }).join('') + '</div>';
        }
        var cortes = G.pts.filter(function (x) { return x.corte; });
        if (cortes.length) h += '<div class="rf-aviso">' + esc(cortes.map(function (x) { return x.p.nome; }).join(', ')) + ': mais de 6 fotos marcadas; vão as 6 primeiras (desmarque as que não quer na galeria).</div>';
        if (G.sem) h += '<div class="rf-aviso">' + plural(G.sem, 'foto marcada não está ligada a', 'fotos marcadas não estão ligadas a') + ' nenhum ponto e ' + (G.sem === 1 ? 'fica' : 'ficam') + ' de fora.</div>';
        h += '<div class="rf-pts">' + G.pts.map(function (x, i) {
          return '<div class="rf-pt"><b>' + esc(x.titulo) + '</b><small>' + plural(x.fotos.length, 'foto', 'fotos') + (x.folhas > 1 ? ' · ' + x.folhas + ' folhas' : '') + '</small>' +
            '<textarea data-i="' + i + '" maxlength="900" aria-label="' + esc('Descrição: ' + x.titulo) + '">' + esc(x.desc) + '</textarea>' +
            (x.desc !== x.auto ? '<button type="button" class="rf-auto" data-rf="auto" data-i="' + i + '">Voltar ao texto do app</button>' : '') + '</div>';
        }).join('') + '</div>';
        return h;
      }
      function perHtml() {
        var h = '<div class="seg" role="group" aria-label="Tipo de período">' + [['semana', 'Semana'], ['mes', 'Mês'], ['livre', 'Período']].map(function (m) {
          return '<button type="button" data-rf="modo" data-v="' + m[0] + '" aria-pressed="' + (S.modo === m[0]) + '">' + m[1] + '</button>';
        }).join('') + '</div>';
        if (S.modo === 'semana') h += '<select class="rf-sel" data-rf="sem" aria-label="Semana">' + S.sem.map(function (s, i) { return '<option value="' + i + '"' + (i === S.iSem ? ' selected' : '') + '>' + esc(s.t) + '</option>'; }).join('') + '</select>';
        else if (S.modo === 'mes') h += '<select class="rf-sel" data-rf="mes" aria-label="Mês">' + S.mes.map(function (s, i) { return '<option value="' + i + '"' + (i === S.iMes ? ' selected' : '') + '>' + esc(s.t) + '</option>'; }).join('') + '</select>';
        else h += '<div class="rf-datas"><label>de <input type="date" data-rf="de" value="' + S.de + '"></label><label>até <input type="date" data-rf="ate" value="' + S.ate + '"></label></div>';
        return h;
      }
      function rodape() {
        var n = G && G.pts.length ? folhasDoPdf().length : 0;
        return '<button type="button" class="btn" data-close>Cancelar</button><button type="submit" class="btn primary"' + (n && !S.gerando ? '' : ' disabled') + '>' +
          (S.gerando ? esc(S.gerando) : 'Gerar PDF' + (n ? ' (' + plural(n, 'folha', 'folhas') + ')' : '')) + '</button>';
      }

      var f = o.modal('<h2 id="modalTitle">Relatório fotográfico</h2>' +
        '<div class="field"><label for="rfCt">Contrato</label><select id="rfCt" class="rf-sel">' + cs.map(function (c) {
          return '<option value="' + esc(c.id) + '"' + (c.id === S.cid ? ' selected' : '') + '>' + esc(nomes.nome(c) || 'Contrato') + '</option>';
        }).join('') + '</select></div>' +
        '<fieldset class="rf-per"><legend>Período das fotos (marcadas com ★ na galeria)</legend><div id="rfPer"></div></fieldset>' +
        '<div id="rfCorpo" style="display:grid;gap:10px"></div>' +
        '<p class="modal-err" role="alert" hidden></p><div class="modal-foot" id="rfFoot"></div>', gerar, 'rf-modal');

      function desenhar(soCorpo) {
        if (!soCorpo) f.querySelector('#rfPer').innerHTML = perHtml();
        f.querySelector('#rfCorpo').innerHTML = corpo();
        f.querySelector('#rfFoot').innerHTML = rodape();
      }
      function foot() { var ft = f.querySelector('#rfFoot'); if (ft) ft.innerHTML = rodape(); }
      desenhar();

      f.addEventListener('click', function (e) {
        var b = e.target.closest('[data-rf]');
        if (!b || S.gerando) return;
        var k = b.getAttribute('data-rf');
        if (k === 'modo') { S.modo = b.getAttribute('data-v'); desenhar(); }
        else if (k === 'folhas') { S.folhas = b.getAttribute('data-v'); lsPut(FOLHAS_KEY, S.folhas); desenhar(true); }
        else if (k === 'auto') {
          var x = G.pts[Number(b.getAttribute('data-i'))];
          if (!x) return;
          delete textos[x.chave];
          lsPut(DESC_KEY, textos);
          desenhar(true);
        }
      });
      f.addEventListener('change', function (e) {
        var t = e.target, k = t.getAttribute('data-rf');
        if (S.gerando) return;
        if (t.id === 'rfCt') { S.cid = t.value; desenhar(true); }
        else if (k === 'sem') { S.iSem = Number(t.value); desenhar(true); }
        else if (k === 'mes') { S.iMes = Number(t.value); desenhar(true); }
        else if (k === 'de' || k === 'ate') { if (t.value) S[k] = t.value; desenhar(true); }
        else if (t.id === 'rfLocal') { var v = t.value.trim(); o.salvarContrato(S.cid, { localRelatorio: v || null }); }
      });
      f.addEventListener('input', function (e) {
        var t = e.target;
        if (t.tagName !== 'TEXTAREA' || !G) return;
        var x = G.pts[Number(t.getAttribute('data-i'))];
        if (!x) return;
        x.desc = t.value;
        if (t.value === x.auto) delete textos[x.chave]; else textos[x.chave] = t.value;
        lsPut(DESC_KEY, textos);
      });

      function gerar() {
        if (S.gerando || !G || !G.pts.length) return;
        var c = G.c, per = G.per, plano = folhasDoPdf(), nFotos = plano.reduce(function (s, pg) { return s + pg.n; }, 0);
        plano.forEach(function (pg) { pg.fotos = [].concat.apply([], pg.itens.map(function (pd) { return pd.fotos; })); });
        S.gerando = 'Preparando…'; S.parar = false;
        foot();
        var feitas = 0, falhas = 0;
        o.ensureLibs().then(function () {
          var doc = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });
          doc.setProperties({ title: 'Relatório fotográfico - ' + [c.lote, c.numero].filter(Boolean).join(' - '), author: c.supervisora || '', creator: 'Diagrama linear' });
          var folha = Folha(doc), gerado = br(iso(new Date())), cadeia = Promise.resolve();
          plano.forEach(function (pg, ip) {
            cadeia = cadeia.then(function () {
              if (S.parar || !document.body.contains(f)) throw { parou: true };
              var imgs = [], seq = Promise.resolve();
              pg.fotos.forEach(function (it) {
                seq = seq.then(function () {
                  if (S.parar || !document.body.contains(f)) throw { parou: true };   // fechou a janela: para
                  feitas++;
                  S.gerando = 'Foto ' + feitas + ' de ' + nFotos + '…';
                  foot();
                  // o Drive às vezes falha numa chamada solta: tenta mais uma vez antes de deixar a foto em branco
                  return a.arquivo(it).catch(function () { return a.arquivo(it); }).then(paraJpeg).then(function (im) { im.alias = 'ft-' + it.id; imgs.push(im); }, function () { falhas++; imgs.push(null); });
                });
              });
              return seq.then(function () {
                if (ip > 0) doc.addPage('a4', 'portrait');
                var um = pg.itens[0], varios = pg.itens.length > 1, legendas = null;
                if (varios) {
                  legendas = [];
                  pg.itens.forEach(function (pd) { pd.fotos.forEach(function () { legendas.push('FOTO ' + pad2(legendas.length + 1) + ' – ' + pd.x.curto); }); });
                }
                folha({
                  logos: LG, logoSup: o.logoSupervisora,
                  executora: String(c.executora || '-').toUpperCase(), supervisora: String(c.supervisora || '-').toUpperCase(),
                  contrato: c.numero || '', ctSupervisao: c.ctSupervisao || '', objeto: c.objeto || '', local: localPadrao(c),
                  titulo: varios ? (G.oae ? 'PONTES: ' : conserva(c) ? 'SEGMENTOS: ' : 'PONTOS EMERGENCIAIS: ') + pg.itens.map(function (pd) { return G.oae ? pd.x.curto.replace(/^PONTE /, '') : 'Nº ' + pd.x.num; }).join(' · ')
                    : um.x.titulo + (um.partes > 1 ? ' – FOLHA ' + um.parte + '/' + um.partes : ''),
                  periodo: perTxt(per), fotos: imgs, numIni: um.numIni, legendas: legendas, rotDesc: 'Serviço:',
                  desc: varios ? pg.itens.filter(function (pd) { return String(pd.x.desc || '').trim(); }).map(function (pd) { return pd.x.curto + ': ' + String(pd.x.desc).trim().replace(/\s*\n+\s*/g, ' '); }) : um.x.desc,
                  pag: ip + 1, tot: plano.length, gerado: gerado
                });
              });
            });
          });
          return cadeia.then(function () {
            // "Relatório fotográfico - Pontos Críticos 314 - Lote 01 - CT 02 00314-2026 - <período>.pdf"; o título do PDF fica com o Lote
            var nome = ('Relatório fotográfico - ' + nomes.partesArquivo(c).join(' - ') + ' - ' + per.de + (per.ate !== per.de ? ' a ' + per.ate : '') + '.pdf').replace(/[\\/:*?"<>|]/g, '-');
            S.gerando = 'Salvando…';
            foot();
            return o.saveBlob(nome, doc.output('blob'), 'PDF gerado: ' + nome);
          });
        }).then(function () {
          S.gerando = false;
          o.closeModal();
          if (falhas) o.toast(plural(falhas, 'foto não veio', 'fotos não vieram') + ' do Drive (sem conexão?) e ' + (falhas === 1 ? 'ficou' : 'ficaram') + ' em branco no PDF.', 7000);
        }, function (e) {
          S.gerando = false;
          if (e && e.parou) return;
          console.error(e);
          if (document.body.contains(f)) {
            foot();
            var er = f.querySelector('.modal-err');
            if (er) { er.textContent = 'Não consegui gerar o PDF (sem internet para a biblioteca do PDF?). Tente de novo.'; er.hidden = false; }
          }
        });
      }
    }
    return { abrir: abrir };
  };
})();
