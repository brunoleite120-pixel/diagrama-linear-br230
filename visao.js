// Visão geral: todos os contratos numa rodovia só, em escala de km. Só na tela; o PDF oficial continua em cada contrato.
// Uma faixa por contrato. O trecho aparece com o comprimento real quando cabe (3 px ou mais); curto demais para a escala
// vira um símbolo; símbolos que se encostam viram um círculo com a quantidade (tocar aproxima). Zoom pelos botões,
// pinça, Ctrl + roda do mouse; arrastar para os lados. O cartão do ponto leva ao contrato (editor) ou ao mapa.
(function () {
  'use strict';

  // localidades tiradas dos nomes dos segmentos do SNV (202607A), só para orientar: não são divisas municipais
  var LOCAIS = [['Novo Repartimento', 301.3], ['Pacajá', 406.9], ['Anapu', 488.5], ['Belo Monte', 563.7], ['Altamira', 624.7],
    ['Brasil Novo', 697.8], ['Medicilândia', 741.7], ['Uruará', 848.8], ['Placas', 909.8], ['Rurópolis', 999.8]];
  // situações na ordem dos filtros, com as cores do app (STATUS e OAE_STATUS em app.js)
  var SIT_C = [['Concluído', '#1E9E55', 'concluído', 'concluídos'], ['Ativo', '#2B5797', 'ativo', 'ativos'],
    ['Parado', '#D93025', 'parado', 'parados'], ['Sem atividade', '#7A8580', 'sem atividade', 'sem atividade']];
  var SIT_O = [['Sem dano aparente', '#1E9E55', 'sem dano aparente', 'sem dano aparente'], ['Dano observado', '#F2A93B', 'com dano', 'com dano'],
    ['Em execução', '#2B5797', 'em execução', 'em execução'], ['Sem vistoria', '#7A8580', 'sem vistoria', 'sem vistoria']];
  // a pior situação de um grupo pinta a borda do círculo
  var PESO = { 'Parado': 4, 'Dano observado': 4, 'Ativo': 2, 'Em execução': 2, 'Sem atividade': 1, 'Sem vistoria': 1 };
  var COR = {};
  SIT_C.concat(SIT_O).forEach(function (s) { COR[s[0]] = s[1]; });
  var MIN_KM = 1.5;   // menor trecho na tela, em km
  // km plausível na rodovia: fora disso é erro de digitação (ex.: 84880 em vez de 848,80) e não entra no desenho
  // (a faixa do eixo SNV com 50 km de folga; sem o eixo, 0 a 5.000)
  var KMS = null;
  function noKm(v) {
    if (!KMS) { var s = window.SNV_BR230 && window.SNV_BR230.segmentos; KMS = s && s.length ? [s[0].kmIni - 50, s[s.length - 1].kmFim + 50] : [0, 5000]; }
    return v != null && v >= KMS[0] && v <= KMS[1];
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  // um formatador por número de casas: toLocaleString cria um Intl.NumberFormat novo a cada chamada (pesa no arrasto)
  var NF = {};
  function nf(n, d) { var f = NF[d] || (NF[d] = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })); return f.format(Number(n)); }
  function pc(v) { return (Math.round(v * 1000) / 1000) + '%'; }
  function num(v) { var n = Number(v); return v != null && v !== '' && isFinite(n) ? n : null; }
  // "02 00314/2026" → "314"
  function curto(c) { var m = /(\d{3,})\/\d{4}/.exec(c.numero || ''); return m ? String(Number(m[1])) : (c.lote || '?'); }
  // km de atuação: a união dos trechos (sem contar duas vezes o que se sobrepõe)
  function uniao(xs) {
    var a = xs.map(function (x) { return [x.km, x.kf]; }).sort(function (u, w) { return u[0] - w[0]; }), t = 0, s = null, e = null;
    a.forEach(function (r) { if (e == null || r[0] > e) { if (e != null) t += e - s; s = r[0]; e = r[1]; } else e = Math.max(e, r[1]); });
    return e == null ? 0 : t + e - s;
  }

  function VisaoGeral(o) {
    // mais: <details> "Serviços" do cartão (null = padrão do aparelho); tudo: a janela cobre a rodovia inteira
    var host = o.host, st = { k0: null, k1: null, sel: null, off: {}, q: '', mais: null };
    var W = 0, F = [0, 100], raf = 0, ptrs = {}, gesto = null, semClique = 0, cacheIt = null, ultW = 0;

    function cel() { return !!(window.matchMedia && window.matchMedia('(max-width: 700px)').matches); }
    // a lista do último desenho: achar(), a busca e os cliques usam a mesma, sem recalcular a situação de cada ponto
    function itens() {
      if (cacheIt) return cacheIt;
      var out = [], semKm = 0, fora = 0;
      o.contratos().forEach(function (c) {
        var oae = o.isOae(c);
        c.pontos.forEach(function (p) {
          var km = num(p.kmIni), kf = num(p.kmFim);
          if (km == null) { semKm++; return; }
          if (!noKm(km)) { fora++; return; }
          if (kf == null || kf < km || !noKm(kf)) kf = km;
          var inf = o.info(p);
          out.push({ c: c, p: p, oae: oae, km: km, kf: kf, key: c.id + ':' + p.id, st: inf.status, cor: inf.color, inf: inf, fk: (oae ? 'o:' : 'c:') + inf.status });
        });
      });
      return (cacheIt = { lista: out, semKm: semKm, fora: fora });
    }
    function faixaDe(c, its) {
      var a = num(c.kmIni), b = num(c.kmFim);
      if (!noKm(a)) a = null;
      if (!noKm(b)) b = null;
      if (a != null && b != null && a > b) { var t = a; a = b; b = t; }   // km do contrato digitado no sentido inverso
      its.forEach(function (x) { if (x.c === c) { a = a == null ? x.km : Math.min(a, x.km); b = b == null ? x.kf : Math.max(b, x.kf); } });
      return a == null || b == null ? null : [a, b];
    }
    function faixaTotal(its, wpx) {
      var a = Infinity, b = -Infinity;
      o.contratos().forEach(function (c) { var f = faixaDe(c, its); if (f) { a = Math.min(a, f[0]); b = Math.max(b, f[1]); } });
      if (!isFinite(a) || !isFinite(b) || b - a < MIN_KM) return [isFinite(a) ? a - 5 : 0, isFinite(a) ? a + 5 : 100];
      var pad = (b - a) * 16 / Math.max(wpx, 200);   // folga de uns 16 px: o círculo da ponta não fica cortado
      return [a - pad, b + pad];
    }
    function lim(a, b) {
      // janela curta demais: completa em volta do centro (e não só para a direita)
      if (b - a < MIN_KM) { var m = (a + b) / 2; a = m - MIN_KM / 2; b = m + MIN_KM / 2; }
      var r = b - a;
      if (r >= F[1] - F[0]) return F.slice();
      if (a < F[0]) a = F[0];
      b = a + r;
      if (b > F[1]) { b = F[1]; a = b - r; }
      return [a, b];
    }
    function ir(a, b) { var r = lim(a, b); st.k0 = r[0]; st.k1 = r[1]; render(); }
    function agenda() { if (!raf) raf = requestAnimationFrame(function () { raf = 0; render(); }); }
    function achar(key) { var r = null; itens().lista.forEach(function (x) { if (x.key === key) r = x; }); return r; }
    function trk() { return host.querySelector('.vg-trk'); }

    function render(medido) {
      if (!medido) cacheIt = null;
      var mob = cel(), d = itens(), its = d.lista;
      ultW = host.clientWidth;
      if (!W) W = Math.max(200, host.clientWidth - (mob ? 24 + 26 + 46 : 40 + 34 + 168 + (st.sel ? 420 : 0)));
      // estava em "Tudo" (a janela cobria a faixa anterior): acompanha a faixa nova (dados do banco, cartão aberto, tela girada)
      var ep = (F[1] - F[0]) * 1e-9, eraTudo = st.k0 != null && st.k0 <= F[0] + ep && st.k1 >= F[1] - ep;
      F = faixaTotal(its, W);
      if (st.k0 == null || eraTudo) { st.k0 = F[0]; st.k1 = F[1]; } else { var r0 = lim(st.k0, st.k1); st.k0 = r0[0]; st.k1 = r0[1]; }
      var k0 = st.k0, k1 = st.k1, R = k1 - k0, FR = F[1] - F[0];
      var X = function (km) { return (km - k0) / R * 100; }, P = function (km) { return (km - k0) / R * W; };
      var vis = its.filter(function (x) { return x.kf >= k0 && x.km <= k1 && !st.off[x.fk]; });
      var cs = o.contratos(), temC = cs.some(function (c) { return !o.isOae(c); }), temO = cs.some(function (c) { return o.isOae(c); });
      var sel = st.sel ? achar(st.sel) : null;
      if (st.sel && !sel) st.sel = null;
      var h = '';

      // título
      var rod = String((cs[0] && cs[0].rodovia) || 'BR-230/PA');
      h += '<div class="vg-head"><div><h2>' + esc(rod) + ' · todos os contratos</h2><p>Em escala de km. Só na tela: o PDF oficial continua dentro de cada contrato.</p></div>' +
        '<span class="vg-tot">' + its.length + (its.length === 1 ? ' item' : ' itens') + ' no desenho' + (d.semKm ? ' · <b>' + d.semKm + ' sem km</b> (não aparecem)' : ' · nenhum sem km') +
        (d.fora ? ' · <b>' + d.fora + ' com km fora da rodovia</b> (confira a vírgula)' : '') + '</span></div>';

      // resumo por contrato
      h += '<section class="vg-cards" aria-label="Resumo por contrato">' + cs.map(function (c) {
        var oae = o.isOae(c), xs = its.filter(function (x) { return x.c === c; }), sits = oae ? SIT_O : SIT_C, n = {}, f = faixaDe(c, its);
        xs.forEach(function (x) { n[x.st] = (n[x.st] || 0) + 1; });
        var tot = c.pontos.length, ext = oae ? c.pontos.reduce(function (t, p) { return t + (Number(p.extensao) || 0); }, 0) / 1000 : uniao(xs);
        var segs = sits.filter(function (s) { return n[s[0]]; }).map(function (s) { return '<i style="flex:' + n[s[0]] + ' 1 0;background:' + s[1] + '"></i>'; }).join('');
        var txt = sits.filter(function (s) { return n[s[0]]; }).map(function (s) { return n[s[0]] + ' ' + (n[s[0]] === 1 ? s[2] : s[3]); }).join(' · ');
        var pad = f ? Math.max((f[1] - f[0]) * 0.03, 0.5) : 0;
        return '<article class="vg-box vg-ct"><div class="vg-ct-h"><h3>' + esc(c.lote || 'Contrato') + '</h3><span>' + esc(c.numero || '') + '</span></div>' +
          (f ? '<div class="vg-ct-t">km ' + nf(f[0], 1) + ' – ' + nf(f[1], 1) + (c.origem || c.destino ? ' · ' + esc(c.origem || '?') + ' → ' + esc(c.destino || '?') : '') + '</div>' : '') +
          '<div class="vg-ct-n"><b>' + tot + (oae ? (tot === 1 ? ' ponte' : ' pontes') : (tot === 1 ? ' ponto' : ' pontos')) + '</b><span>' + nf(ext, 2) + (oae ? ' km de pontes' : ' km de atuação') + '</span></div>' +
          '<div class="vg-seg" aria-hidden="true">' + segs + '</div><div class="vg-ct-s">' + (txt || 'sem itens com km') + '</div>' +
          '<div class="vg-ct-a">' + (f ? '<button type="button" class="btn small" data-vg="ir" data-a="' + (f[0] - pad) + '" data-b="' + (f[1] + pad) + '">Ver no desenho</button>' : '') +
          '<button type="button" class="btn small ghost" data-vg="ct" data-cid="' + esc(c.id) + '">Abrir contrato →</button></div></article>';
      }).join('') + '</section>';

      // busca e filtros por situação
      var conta = {};
      its.forEach(function (x) { conta[x.fk] = (conta[x.fk] || 0) + 1; });
      function chips(sits, pre, oae) {
        return sits.map(function (s) {
          var fk = pre + s[0], on = !st.off[fk];
          return '<button type="button" class="vg-chip' + (oae ? ' oae' : '') + '" data-vg="chip" data-fk="' + esc(fk) + '" aria-pressed="' + on + '"><i style="background:' + s[1] + '"></i>' + esc(s[0]) + ' <b>' + (conta[fk] || 0) + '</b></button>';
        }).join('');
      }
      h += '<section class="vg-box vg-filtros" aria-label="Busca e filtros"><div class="vg-busca"><label class="vg-cap" for="vgBusca">Buscar</label>' +
        '<input id="vgBusca" type="search" autocomplete="off" placeholder="km (ex.: 794,5), ponto ou ponte" value="' + esc(st.q) + '"><div class="vg-res" id="vgRes">' + resultados() + '</div></div>' +
        (temC ? '<div class="vg-chips"><span class="vg-cap">Conserva · situação</span><div>' + chips(SIT_C, 'c:', false) + '</div></div>' : '') +
        (temO ? '<div class="vg-chips"><span class="vg-cap">Pontes · situação</span><div>' + chips(SIT_O, 'o:', true) + '</div></div>' : '') + '</section>';

      // desenho
      // passo da régua pela distância entre marcas: no máximo uma a cada 60–70 px, qualquer que seja a faixa
      var alvoT = R * (mob ? 60 : 70) / W, step = [1, 2, 5, 10, 20, 50, 100, 200, 500].filter(function (t) { return t >= alvoT; })[0] || Math.pow(10, Math.ceil(Math.log10(alvoT))), ticks = [];
      for (var t = Math.ceil(k0 / step) * step; t <= k1; t += step) ticks.push(t);
      var presets = [['Tudo', F[0], F[1]]];
      // um botão por contrato, menos o que já ocupa quase a rodovia inteira (igual a "Tudo")
      cs.forEach(function (c) {
        var f = faixaDe(c, its);
        if (f && f[1] - f[0] < FR * 0.85) { var pd = Math.max((f[1] - f[0]) * 0.03, 0.5); presets.push([c.lote || curto(c), f[0] - pd, f[1] + pd]); }
      });
      var eq = function (a, b) { return Math.abs(a - k0) < R * 0.004 + 0.05 && Math.abs(b - k1) < R * 0.004 + 0.05; }, marcado = false;
      h += '<div class="vg-meio"><section class="vg-box vg-diag" aria-label="Diagrama em escala"><div class="vg-bar">' +
        '<div class="vg-pre" role="group" aria-label="Enquadrar">' + presets.map(function (p) {
          var r = lim(p[1], p[2]), on = !marcado && eq(r[0], r[1]);
          if (on) marcado = true;
          return '<button type="button" data-vg="ir" data-a="' + p[1] + '" data-b="' + p[2] + '" aria-pressed="' + on + '">' + esc(p[0]) + '</button>';
        }).join('') + '</div>' +
        '<div class="vg-zoom" role="group" aria-label="Zoom"><button type="button" class="lado" data-vg="esq" aria-label="Para a esquerda">‹</button><button type="button" data-vg="menos" aria-label="Afastar">−</button>' +
        '<button type="button" data-vg="mais" aria-label="Aproximar">+</button><button type="button" class="lado" data-vg="dir" aria-label="Para a direita">›</button></div>' +
        '<span class="vg-faixa">km ' + nf(k0, R < 20 ? 1 : 0) + ' – ' + nf(k1, R < 20 ? 1 : 0) + ' · ' + nf(R, R < 20 ? 1 : 0) + ' km na tela</span></div>';
      // a rodovia inteira, com a parte que está na tela
      var XF = function (km) { return (km - F[0]) / FR * 100; };
      // uma linha por contrato com faixa; com muitos contratos as linhas afinam para caber nos 22 px do botão
      var mini = cs.map(function (c) { return { c: c, f: faixaDe(c, its) }; }).filter(function (m) { return m.f; });
      var nM = mini.length, passo = Math.min(6, 16 / Math.max(nM, 1)), alt = Math.max(1, Math.min(4, passo - 1)), top0 = (22 - ((nM - 1) * passo + alt)) / 2;
      h += '<button type="button" class="vg-mini" data-vg="tudo" aria-label="Rodovia inteira: toque para ver tudo">' + mini.map(function (m, i) {
        return '<span style="left:' + pc(XF(m.f[0])) + ';width:' + pc((m.f[1] - m.f[0]) / FR * 100) + ';top:' + (top0 + i * passo).toFixed(1) + 'px;height:' + alt.toFixed(1) + 'px;background:' + (o.isOae(m.c) ? '#9AA39E' : '#5C6661') + '"></span>';
      }).join('') + '<span class="vg-jan" style="left:' + pc(XF(k0)) + ';width:' + pc(R / FR * 100) + '"></span></button>';

      h += '<div class="vg-plot">';
      // localidades do SNV, em duas linhas para não encavalar
      var r0 = -1e9, r1 = -1e9, loc = '';
      LOCAIS.forEach(function (l) {
        if (l[1] < k0 || l[1] > k1) return;
        var x = P(l[1]), w = l[0].length * (mob ? 5.8 : 6.4) + 10, row = -1;
        if (x - w / 2 < 0 || x + w / 2 > W) return;
        if (x - w / 2 >= r0) { row = 0; r0 = x + w / 2; } else if (x - w / 2 >= r1) { row = 1; r1 = x + w / 2; }
        if (row < 0) return;
        loc += '<span style="left:' + pc(X(l[1])) + ';top:' + (row ? 15 : 0) + 'px;transform:translateX(-50%)">' + esc(l[0]) + '</span>' +
          '<i style="left:' + pc(X(l[1])) + ';top:' + (row ? 32 : 17) + 'px;bottom:0"></i>';
      });
      h += '<div class="vg-row vg-loc"><div class="vg-lab vg-lab-s">Localidades (SNV)</div><div class="vg-trk">' + loc + '</div></div>';
      h += '<div class="vg-row vg-rod"><div class="vg-lab"><b>' + esc(rod.split('/')[0]) + '</b></div><div class="vg-trk"><span class="vg-asf"></span></div></div>';
      var grade = ticks.map(function (t) { return '<i class="vg-grade" style="left:' + pc(X(t)) + '"></i>'; }).join('');
      var enc = mob ? 16 : 14;   // símbolos mais perto que isso (px) viram um círculo com a quantidade
      // um grupo que nem no zoom máximo se separa (itens no mesmo km): o toque passa pelos itens um a um
      function preso(g) { return R <= MIN_KM * 1.001 || (g.b - g.a) / MIN_KM * W < enc; }
      cs.forEach(function (c) {
        // por km; no mesmo km, a barra mais longa antes, para a curta ficar por cima e continuar visível
        var oae = o.isOae(c), xs = vis.filter(function (x) { return x.c === c; }).sort(function (a, b) { return a.km - b.km || (b.kf - b.km) - (a.kf - a.km); });
        function agrupar(fixo) {
          var gs = [];
          xs.forEach(function (x, i) {
            var w = P(x.kf) - P(x.km), cx = P((x.km + x.kf) / 2);
            if (w >= 3) { gs.push({ t: 'barra', xs: [x], a: x.km, b: x.kf, fim: P(x.kf) }); return; }
            // o escolhido fica sozinho (com destaque), a não ser que o grupo dele não se separe mais
            if (x.key === fixo) { gs.push({ t: oae ? 'pino' : 'simb', xs: [x], a: x.km, b: x.kf, ini: cx, fim: cx, soma: cx, fixo: true }); return; }
            var u = gs[gs.length - 1];
            // junta ao anterior se encosta nele, sem deixar o grupo crescer em cadeia (o círculo fica perto dos itens)
            if (u && u.t !== 'barra' && !u.fixo && cx - u.fim < enc && cx - u.ini < 3 * enc) { u.t = 'grupo'; u.xs.push(x); u.b = Math.max(u.b, x.kf); u.fim = cx; u.soma += cx; return; }
            gs.push({ t: oae ? 'pino' : 'simb', xs: [x], a: x.km, b: x.kf, ini: cx, fim: cx, soma: cx });
          });
          return gs;
        }
        var gs = agrupar(null);
        if (st.sel && gs.some(function (g) { return g.t === 'grupo' && !preso(g) && g.xs.some(function (y) { return y.key === st.sel; }); })) gs = agrupar(st.sel);
        var ult = -1e9, rot = '', mk = '';
        gs.forEach(function (g) {
          var x = g.xs[0];
          if (g.t === 'grupo') {
            var km = k0 + g.soma / g.xs.length / W * R, pior = null, n = g.xs.length, nome = oae ? ' pontes' : ' pontos';
            g.xs.forEach(function (y) { if (!pior || (PESO[y.st] || 0) > (PESO[pior.st] || 0)) pior = y; });
            var estilo = ' style="left:' + pc(X(km)) + ';border-color:' + ((PESO[pior.st] || 0) >= 2 ? pior.cor : '#3B4540') + '"';
            if (preso(g)) {
              // escolhe o próximo depois do que está aberto (na ordem por km), e volta ao primeiro no fim
              var iSel = -1, idx = function (y) { return xs.indexOf(y); };
              xs.forEach(function (y, i) { if (y.key === st.sel) iSel = i; });
              var dentro = g.xs.some(function (y) { return y.key === st.sel; });
              var prox = g.xs.filter(function (y) { return idx(y) > iSel; })[0] || g.xs[0], tipG = n + nome + ' no km ' + nf(g.a, 2) + ': toque para ver um a um (também na lista abaixo)';
              mk += '<button type="button" class="vg-mk grupo' + (dentro ? ' sel' : '') + '" data-vg="sel" data-key="' + esc(prox.key) + '"' + estilo + ' title="' + esc(tipG) + '" aria-label="' + esc(tipG) + '">' + n + '</button>';
              return;
            }
            // o toque aproxima pelo menos à metade da tela, centrado no grupo
            var pad = Math.max((g.b - g.a) * 0.4, 1), alvo = Math.min(g.b - g.a + 2 * pad, R / 2), meio = (g.a + g.b) / 2, tipA = n + nome + ' entre km ' + nf(g.a, 1) + ' e ' + nf(g.b, 1) + ': toque para aproximar';
            mk += '<button type="button" class="vg-mk grupo" data-vg="ir" data-a="' + (meio - alvo / 2) + '" data-b="' + (meio + alvo / 2) + '"' + estilo + ' title="' + esc(tipA) + '" aria-label="' + esc(tipA) + '">' + n + '</button>';
            return;
          }
          var mid = (x.km + x.kf) / 2, nome = x.p.nome || x.p.codigo || '?', lw = nome.length * (mob ? 6.2 : 6.6) + 10, cx = P(mid);
          if (cx - lw / 2 >= ult + 4 && cx - lw / 2 >= -2 && cx + lw / 2 <= W + 2) { ult = cx + lw / 2; rot += '<span class="vg-rot" style="left:' + pc(X(mid)) + '">' + esc(nome) + (x.p.kmConferir ? ' ~' : '') + '</span>'; }
          var tip = (x.oae ? nome + (x.p.codigo ? ' · ' + x.p.codigo : '') : nome) + ' · km ' + (x.p.kmConferir ? '~' : '') + nf(x.km, 2) + (g.t === 'barra' ? ' a ' + nf(x.kf, 2) : '') + ' · ' + x.st;
          mk += '<button type="button" class="vg-mk ' + g.t + (st.sel === x.key ? ' sel' : '') + '" data-vg="sel" data-key="' + esc(x.key) + '" title="' + esc(tip) + '" aria-label="' + esc(tip) + '" style="left:' + pc(X(g.t === 'barra' ? x.km : mid)) +
            (g.t === 'barra' ? ';width:' + pc((x.kf - x.km) / R * 100) : '') + ';background:' + x.cor + '"></button>';
        });
        var f = faixaDe(c, its), a = f ? Math.max(f[0], k0) : 0, b = f ? Math.min(f[1], k1) : 0;
        var banda = f && b > a ? '<i class="vg-banda' + (oae ? ' oae' : '') + '" style="left:' + pc(X(a)) + ';width:' + pc((b - a) / R * 100) + '"></i>' : '';
        h += '<div class="vg-row vg-lane"><div class="vg-lab"><b>' + esc(mob ? curto(c) : (c.lote || curto(c))) + '</b><small>' +
          (mob ? (oae ? 'pontes' : 'conserva') : 'CT ' + esc(curto(c)) + ' · ' + xs.length + ' na tela') + '</small></div>' +
          '<div class="vg-trk">' + grade + banda + rot + mk + '</div></div>';
      });
      h += '<div class="vg-row vg-eixo"><div class="vg-lab"></div><div class="vg-trk">' + ticks.map(function (t) {
        var x = P(t), tr = x > W - 30 ? 'translateX(-100%)' : x < 30 ? 'none' : 'translateX(-50%)';
        return '<i style="left:' + pc(X(t)) + '"></i><span style="left:' + pc(X(t)) + ';transform:' + tr + '">km ' + nf(t, 0) + '</span>';
      }).join('') + '</div></div>';
      h += '<div class="vg-row vg-esc"><div class="vg-lab vg-lab-s">Escala</div><div class="vg-trk"><i style="width:' + pc(step / R * 100) + '"></i><span>' + nf(step, 0) + ' km</span></div></div>';
      h += '</div>';
      h += '<div class="vg-leg"><span><i style="width:18px;height:10px;border-radius:2px;background:#2B5797"></i>Trecho no tamanho real</span>' +
        '<span><i style="width:9px;height:9px;transform:rotate(45deg);border-radius:1px;background:#3B4540"></i>Ponto curto demais para esta escala</span>' +
        (temO ? '<span><i style="width:11px;height:11px;border-radius:50%;background:#7A8580"></i>Ponte</span>' : '') +
        '<span><i style="width:16px;height:16px;border-radius:50%;border:2px solid #D93025;box-sizing:border-box"></i>Vários juntos (borda: a pior situação); toque para aproximar</span>' +
        '<span>“~” km a conferir</span>' + (mob ? '' : '<span>Ctrl + roda do mouse aproxima; arraste para os lados</span>') + '</div></section>';

      // cartão do ponto escolhido (no celular, sobe da parte de baixo)
      if (sel) {
        var x = sel, inf = x.inf, nomeS = x.oae ? (x.p.nome || '?') + (x.p.codigo ? ' · ' + x.p.codigo : '') : (x.p.nome || '?');
        var kmS = x.oae ? 'km ' + (x.p.kmConferir ? '~' : '') + nf(x.km, 2) + (Number(x.p.extensao) ? ' · ' + nf(x.p.extensao, 1) + ' m de ponte' : '')
          : 'km ' + (x.p.kmConferir ? '~' : '') + nf(x.km, 2) + ' a ' + nf(x.kf, 2) + ' · ' + nf(x.kf - x.km, 2) + ' km';
        var servs = (inf.servs || []).map(function (s) {
          return '<div class="vg-sv"><span>' + esc(s.label) + '</span><b><i style="background:' + esc(s.color) + '"></i>' + esc(s.text) + '</b></div>';
        }).join('');
        h += '<aside class="vg-box vg-card" aria-label="Ponto escolhido" data-key="' + esc(x.key) + '"><div class="vg-card-top"><div><small>' + esc((x.c.lote || '') + ' · ' + (x.c.numero || '')) + '</small>' +
          '<h3>' + esc(nomeS) + '</h3><span>' + kmS + '</span></div><button type="button" class="vg-x" data-vg="fechar" aria-label="Fechar">×</button></div>' +
          '<div class="vg-st"><i style="background:' + esc(x.cor) + '"></i>' + esc(x.st) + (inf.pctText ? ' · ' + esc(inf.pctText) : '') + '</div>' +
          (servs || x.p.obs ? '<details class="vg-mais"' + ((st.mais != null ? st.mais : !mob) ? ' open' : '') + '><summary>' + (servs ? 'Serviços' + (x.p.obs ? ' e observações' : '') : 'Observações') + '</summary>' + servs +
            (x.p.obs ? '<p class="vg-obs">' + esc(x.p.obs) + '</p>' : '') + '</details>' : '') +
          '<div class="vg-acoes"><button type="button" class="btn primary" data-vg="abrir">Abrir no contrato</button>' +
          (o.temMapa ? '<button type="button" class="btn" data-vg="mapa">Ver no mapa</button>' : '') +
          (o.temFotos && o.temFotos() ? '<button type="button" class="btn" data-vg="fotos">Fotos</button>' : '') + '</div></aside>';
      }
      h += '</div>';

      // lista do trecho da tela
      var ord = vis.slice().sort(function (a, b) { return a.km - b.km; }), max = mob ? 8 : 12;
      h += '<section class="vg-box vg-lista" aria-label="Itens no trecho da tela"><div class="vg-lista-h"><h3>No trecho da tela</h3><span>' + vis.length + (vis.length === 1 ? ' item' : ' itens') + ', por km</span></div><div class="vg-tab">' +
        (mob ? '' : '<div class="vg-tr h"><span>Contrato</span><span>Ponto ou ponte</span><span class="n">km</span><span class="n">Extensão</span><span>Situação</span></div>') +
        ord.slice(0, max).map(function (x) {
          var nome = x.oae ? (x.p.nome || '?') + (x.p.codigo ? ' · ' + x.p.codigo : '') : (x.p.nome || '?'), km = (x.p.kmConferir ? '~' : '') + nf(x.km, 2);
          var sit = '<i style="background:' + esc(x.cor) + '"></i>' + esc(x.st) + (!x.oae && x.inf.pctText ? ' · ' + esc(x.inf.pctText) : '');
          if (mob) return '<button type="button" class="vg-tr m' + (st.sel === x.key ? ' sel' : '') + '" data-vg="sel" data-key="' + esc(x.key) + '"><span><b>' + esc((x.c.lote || '') + ' · ' + nome) + '</b><small class="s">' + sit + '</small></span><span class="n">km ' + km + '</span></button>';
          return '<button type="button" class="vg-tr' + (st.sel === x.key ? ' sel' : '') + '" data-vg="sel" data-key="' + esc(x.key) + '"><span>' + esc(x.c.lote || '') + '</span><span><b>' + esc(nome) + '</b></span>' +
            '<span class="n">' + km + '</span><span class="n">' + (x.oae ? (Number(x.p.extensao) ? nf(x.p.extensao, 1) + ' m' : '–') : nf(x.kf - x.km, 2) + ' km') + '</span><span class="s">' + sit + '</span></button>';
        }).join('') + '</div>' + (ord.length > max ? '<span class="vg-resto">e mais ' + (ord.length - max) + ' no trecho da tela; aproxime para ver menos</span>' : '') + '</section>';

      // o redesenho troca tudo: guarda o foco (busca ou botão) e a rolagem do cartão do mesmo ponto
      var ae = document.activeElement, foco = null;
      if (ae && ae !== host && host.contains(ae)) {
        if (ae.id) foco = { q: '#' + ae.id };
        else if (ae.dataset && ae.dataset.vg) foco = { q: '[data-vg="' + ae.dataset.vg + '"]' + (ae.dataset.key ? '[data-key="' + cssEsc(ae.dataset.key) + '"]' : ae.dataset.fk ? '[data-fk="' + cssEsc(ae.dataset.fk) + '"]' : ae.dataset.cid ? '[data-cid="' + cssEsc(ae.dataset.cid) + '"]' : '') };
        if (foco && ae.id === 'vgBusca') { foco.s = ae.selectionStart; foco.e = ae.selectionEnd; }
      }
      var cd0 = host.querySelector('.vg-card'), topo0 = cd0 && sel && cd0.dataset.key === sel.key ? cd0.scrollTop : 0;
      host.innerHTML = '<div class="vg' + (sel ? ' com-card' : '') + '">' + h + '</div>';
      if (topo0) { var cd1 = host.querySelector('.vg-card'); if (cd1) cd1.scrollTop = topo0; }
      if (foco) {
        var fn = host.querySelector(foco.q);
        if (fn) { try { fn.focus({ preventScroll: true }); if (foco.s != null) fn.setSelectionRange(foco.s, foco.e); } catch (e) { /* navegador antigo */ } }
      }
      // a largura real da faixa decide trecho, símbolo e grupo: se mudou (cartão aberto, tela girada), desenha de novo
      var tk = trk(), w = tk ? tk.clientWidth : 0;
      if (w && Math.abs(w - W) > 3 && !medido) { W = w; render(true); return; }
      folga();
    }
    function cssEsc(s) { return window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&'); }
    // no celular o cartão é uma folha presa embaixo: o fim da página ganha a altura dela, para nada ficar escondido
    function folga() {
      var vg = host.firstChild, cd = host.querySelector('.vg-card');
      if (vg && vg.style) vg.style.paddingBottom = cel() && cd ? (cd.offsetHeight + 12) + 'px' : '';
    }

    function resultados() {
      var q = (st.q || '').trim();
      if (!q) return '';
      // km como no mapa: "794,5", "km 794,5", "1.006,9" ou estaca "794+500"
      var t = q.replace(/\s/g, '').replace(/^km/i, ''), est = /^(\d+)\+(\d{1,3})$/.exec(t);
      if (!est && t.indexOf(',') >= 0) t = t.replace(/\./g, '').replace(',', '.');
      var out = [], n = est ? Number(est[1]) + Number(est[2]) / 1000 : Number(t);
      if (t && isFinite(n) && /\d/.test(q)) {
        if (n >= F[0] && n <= F[1]) out.push('<button type="button" data-vg="km" data-km="' + n + '">Ir ao km ' + nf(n, n % 1 ? 2 : 0) + '</button>');
        else out.push('<span class="vg-res-n">O desenho vai do km ' + nf(F[0], 0) + ' ao km ' + nf(F[1], 0) + '.</span>');
      }
      // nome: cada palavra em qualquer ordem ("Lote 02 P1", "315 P1"); o nome igual ao digitado vem primeiro
      // ordem: nome igual a um termo (2) e termo que é parte do lote ou o nº curto do contrato (1) valem mais
      var ql = q.toLowerCase(), termos = ql.split(/\s+/).filter(Boolean), max = 6;
      function nota(x) {
        var nome = (x.p.nome || '').toLowerCase(), cod = (x.p.codigo || '').toLowerCase(), lote = (x.c.lote || '').toLowerCase().split(/\s+/), ct = curto(x.c);
        return termos.reduce(function (t, w) { return t + (w === nome || w === cod || ql === nome || ql === cod ? 2 : lote.indexOf(w) >= 0 || w === ct ? 1 : 0); }, 0);
      }
      var ach = itens().lista.filter(function (x) {
        var s = ((x.p.nome || '') + ' ' + (x.p.codigo || '') + ' ' + (x.c.lote || '') + ' ' + (x.c.numero || '')).toLowerCase();
        return termos.every(function (w) { return s.indexOf(w) >= 0; });
      }).map(function (x) { return { x: x, n: nota(x) }; }).sort(function (a, b) { return b.n - a.n || a.x.km - b.x.km; }).map(function (r) { return r.x; });
      ach.slice(0, max).forEach(function (x) {
        out.push('<button type="button" data-vg="achar" data-key="' + esc(x.key) + '">' + esc((x.c.lote || '') + ' · ' + (x.p.nome || '?') + (x.p.codigo ? ' · ' + x.p.codigo : '') + ' · km ' + nf(x.km, 2)) + '</button>');
      });
      if (ach.length > max) out.push('<span class="vg-res-n">e mais ' + (ach.length - max) + '; digite também o lote ou o contrato</span>');
      return out.length ? out.join('') : '<span class="vg-res-n">Nada encontrado.</span>';
    }
    function mostrar(x) {
      // escolhido fora da tela: centraliza nele, mantendo o zoom
      if (x.kf < st.k0 || x.km > st.k1) { var R = st.k1 - st.k0, m = (x.km + x.kf) / 2, r = lim(m - R / 2, m + R / 2); st.k0 = r[0]; st.k1 = r[1]; }
      if (st.sel !== x.key) st.mais = null;
      st.sel = x.key;
      render();
      if (cel()) enquadrar();
    }
    // celular: mostra o desenho entre a barra do topo (fixa) e a folha do cartão; se o marcador já está à vista, não rola
    function enquadrar() {
      var dg = host.querySelector('.vg-diag');
      if (!dg) return;
      var tb = document.querySelector('.topbar'), card = host.querySelector('.vg-card'), mk = host.querySelector('.vg-mk.sel');
      var topo = (tb ? tb.getBoundingClientRect().bottom : 0) + 8, base = (card ? card.getBoundingClientRect().top : window.innerHeight) - 8;
      var rd = dg.getBoundingClientRect(), dy;
      if (mk) {
        var rm = mk.getBoundingClientRect();
        if (rm.top >= topo && rm.bottom <= base) return;
        // cabe com os botões do topo do desenho: o desenho logo abaixo da barra; senão, o marcador no meio da faixa livre
        dy = rm.bottom - rd.top <= base - topo ? rd.top - topo : (rm.top + rm.bottom) / 2 - (topo + base) / 2;
      } else dy = rd.top - topo;
      if (Math.abs(dy) > 2) window.scrollBy({ top: dy, behavior: 'smooth' });
    }

    host.addEventListener('click', function (e) {
      var b = e.target.closest('[data-vg]');
      if (!b || Date.now() < semClique) return;
      var a = b.dataset.vg, R = st.k1 - st.k0, m = (st.k0 + st.k1) / 2, x;
      if (a === 'ir') { ir(Number(b.dataset.a), Number(b.dataset.b)); if (cel() && b.closest('.vg-ct')) enquadrar(); }   // dos cartões, lá embaixo
      else if (a === 'tudo') { st.k0 = null; render(); }
      else if (a === 'mais') ir(m - R / 4, m + R / 4);
      else if (a === 'menos') ir(m - R, m + R);
      else if (a === 'esq') ir(st.k0 - R * 0.4, st.k1 - R * 0.4);
      else if (a === 'dir') ir(st.k0 + R * 0.4, st.k1 + R * 0.4);
      else if (a === 'chip') { st.off[b.dataset.fk] = !st.off[b.dataset.fk]; render(); }
      else if (a === 'fechar') { st.sel = null; st.mais = null; render(); }
      else if (a === 'sel') { x = achar(b.dataset.key); if (x) { if (st.sel === x.key && b.classList.contains('vg-mk')) { st.sel = null; st.mais = null; render(); } else mostrar(x); } }
      else if (a === 'km') { var k = Number(b.dataset.km), d = Math.min(6, (F[1] - F[0]) / 2); st.q = ''; ir(k - d, k + d); if (cel()) enquadrar(); }
      else if (a === 'achar') {
        x = achar(b.dataset.key);
        if (x) { var pd = Math.max(2, (x.kf - x.km) * 3), r = lim(x.km - pd, x.kf + pd); st.q = ''; st.k0 = r[0]; st.k1 = r[1]; mostrar(x); }
      } else if (a === 'abrir' || a === 'mapa' || a === 'fotos') {
        x = st.sel ? achar(st.sel) : null;
        if (x) (a === 'abrir' ? o.onAbrir : a === 'mapa' ? o.onMapa : o.onFotos)(x.c, x.p);
      } else if (a === 'ct') {
        o.contratos().forEach(function (c) { if (c.id === b.dataset.cid) o.onAbrir(c, null); });
      }
    });
    // busca: atualiza só a lista de resultados, para não perder o foco do campo
    host.addEventListener('input', function (e) {
      if (e.target.id !== 'vgBusca') return;
      st.q = e.target.value;
      var r = host.querySelector('#vgRes');
      if (r) r.innerHTML = resultados();
    });
    host.addEventListener('keydown', function (e) {
      if (e.target.id === 'vgBusca' && e.key === 'Enter') { var f = host.querySelector('#vgRes button'); if (f) { e.preventDefault(); f.click(); } }
    });
    // Esc fecha o cartão, com o foco na visão ou solto na página (depois de um redesenho)
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !st.sel || !host.offsetParent) return;
      var a = document.activeElement;
      if (a && a !== document.body && !host.contains(a)) return;
      st.sel = null; st.mais = null; render();
    });
    // abrir ou fechar "Serviços" vale para os redesenhos seguintes do mesmo ponto ('toggle' não sobe: captura)
    host.addEventListener('toggle', function (e) {
      if (e.target.classList && e.target.classList.contains('vg-mais')) { st.mais = e.target.open; folga(); }
    }, true);
    // arrastar para os lados; dois dedos aproximam ou afastam (pinça)
    function kmEm(clientX) { var tk = trk(), r = tk ? tk.getBoundingClientRect() : null; return r ? st.k0 + (clientX - r.left) / r.width * (st.k1 - st.k0) : (st.k0 + st.k1) / 2; }
    function fracEm(clientX) { var tk = trk(), r = tk ? tk.getBoundingClientRect() : null; return r ? (clientX - r.left) / r.width : 0.5; }
    host.addEventListener('pointerdown', function (e) {
      if (!e.target.closest('.vg-plot') || (e.pointerType === 'mouse' && e.button !== 0)) return;
      // primeiro dedo de um gesto novo: esquece dedos que ficaram sem pointerup (senão um dedo vira "pinça")
      if (e.isPrimary) { ptrs = {}; gesto = null; }
      ptrs[e.pointerId] = e.clientX;
      var ids = Object.keys(ptrs);
      if (ids.length === 1) gesto = { tipo: 'arrasto', x0: e.clientX, k0: st.k0, k1: st.k1, mexeu: false };
      else if (ids.length === 2) {
        var xs = ids.map(function (i) { return ptrs[i]; }), cx = (xs[0] + xs[1]) / 2;
        gesto = { tipo: 'pinca', d0: Math.max(20, Math.abs(xs[0] - xs[1])), R0: st.k1 - st.k0, kc: kmEm(cx), fc: fracEm(cx), mexeu: true };
        ids.forEach(prender);
      }
    });
    // o redesenho troca o elemento tocado; preso ao host (que nunca é trocado), o gesto continua recebendo os eventos.
    // Só quando o gesto começa de fato: preso já no toque, o clique iria para o host e não abriria o ponto
    function prender(id) { try { host.setPointerCapture(Number(id)); } catch (e) { /* ponteiro já solto */ } }
    window.addEventListener('pointermove', function (e) {
      if (!gesto || !(e.pointerId in ptrs)) return;
      ptrs[e.pointerId] = e.clientX;
      if (gesto.tipo === 'arrasto') {
        var dx = e.clientX - gesto.x0;
        if (!gesto.mexeu && Math.abs(dx) < 6) return;
        if (!gesto.mexeu) prender(e.pointerId);
        gesto.mexeu = true;
        var dk = -dx / Math.max(W, 1) * (gesto.k1 - gesto.k0), r = lim(gesto.k0 + dk, gesto.k1 + dk);
        st.k0 = r[0]; st.k1 = r[1]; agenda();
      } else {
        var ids = Object.keys(ptrs);
        if (ids.length < 2) return;
        var d = Math.max(20, Math.abs(ptrs[ids[0]] - ptrs[ids[1]])), R = Math.min(F[1] - F[0], Math.max(MIN_KM, gesto.R0 * gesto.d0 / d));
        var a = gesto.kc - gesto.fc * R, rr = lim(a, a + R);
        st.k0 = rr[0]; st.k1 = rr[1]; agenda();
      }
    });
    function solta(e) {
      if (!(e.pointerId in ptrs)) return;
      delete ptrs[e.pointerId];
      if (gesto && gesto.mexeu) semClique = Date.now() + 250;   // o fim do arrasto não vale como toque num ponto
      if (!Object.keys(ptrs).length) gesto = null;
      else if (gesto && gesto.tipo === 'pinca') { var id = Object.keys(ptrs)[0]; gesto = { tipo: 'arrasto', x0: ptrs[id], k0: st.k0, k1: st.k1, mexeu: true }; }
    }
    window.addEventListener('pointerup', solta);
    window.addEventListener('pointercancel', solta);
    // Ctrl + roda (e a pinça do touchpad) aproxima no ponto do mouse; rolar para os lados anda
    host.addEventListener('wheel', function (e) {
      if (!e.target.closest('.vg-plot')) return;
      var R = st.k1 - st.k0;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        var kc = kmEm(e.clientX), fc = fracEm(e.clientX), nR = Math.min(F[1] - F[0], Math.max(MIN_KM, R * Math.exp(e.deltaY * 0.0025))), a = kc - fc * nR, r = lim(a, a + nR);
        st.k0 = r[0]; st.k1 = r[1]; agenda();
      } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        var dk = e.deltaX / Math.max(W, 1) * R, r2 = lim(st.k0 + dk, st.k1 + dk);
        st.k0 = r2[0]; st.k1 = r2[1]; agenda();
      }
    }, { passive: false });
    // só a largura muda o desenho: teclado e barra do navegador (só altura) não redesenham, para não fechar a busca
    var rt = 0;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { var w = host.clientWidth; if (host.offsetParent && w && w !== ultW) render(); else folga(); }, 120);
    });

    return { render: render };
  }

  window.VisaoGeral = VisaoGeral;
})();
