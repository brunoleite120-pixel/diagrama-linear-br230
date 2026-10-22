// Visão geral: todos os contratos numa rodovia só, em escala de km. Só na tela; o PDF oficial continua em cada contrato.
// Uma faixa por contrato. O trecho aparece com o comprimento real quando cabe (3 px ou mais); curto demais para a escala
// vira um símbolo; símbolos que se encostam viram um círculo com a quantidade (tocar aproxima). Zoom pelos botões,
// pinça, Ctrl + roda do mouse; arrastar para os lados. O cartão do ponto leva ao contrato (editor) ou ao mapa.
// Na barra do desenho, [Tudo] [Contratos ▾]: a caixa seletora marca os contratos mostrados (cada marcação filtra e
// enquadra na hora; nada marcado = "Tudo"). A escolha fica guardada no aparelho; desenho, cartões, chips e lista a seguem.
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
  // segmentos da conservação (passo 2.4): a situação da vistoria, como nas pontes, com "defeito"
  var SIT_S = [['Sem defeito', '#1E9E55', 'sem defeito', 'sem defeito'], ['Defeito observado', '#F2A93B', 'com defeito', 'com defeito'],
    ['Em execução', '#2B5797', 'em execução', 'em execução'], ['Sem vistoria', '#7A8580', 'sem vistoria', 'sem vistoria']];
  // a pior situação de um grupo pinta a borda do círculo
  var PESO = { 'Parado': 4, 'Dano observado': 4, 'Defeito observado': 4, 'Ativo': 2, 'Em execução': 2, 'Sem atividade': 1, 'Sem vistoria': 1 };
  var COR = {};
  SIT_C.concat(SIT_O, SIT_S).forEach(function (s) { COR[s[0]] = s[1]; });
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
  // 731 (c.kmLocal): km próprio do ramal. Só no desenho, a raia começa no c.posEixo (624,70, sob o contorno planejado do 264);
  // os textos mostram o km local
  function kmVis(c, k) { return k != null && c.kmLocal && typeof c.posEixo === 'number' ? c.posEixo + (k - (c.kmIni || 0)) : k; }
  function kmDesl(c) { return c.kmLocal && typeof c.posEixo === 'number' ? c.posEixo - (c.kmIni || 0) : 0; }
  // 709 (o.kmMp, do app.js): os textos mostram o km das MPs (o do contrato pela régua); o km do site fica só no desenho. Sem o
  // km das MPs (outro contrato, ou sem a régua no aparelho), null
  var kmMpFn = null;
  function kmMp(c, k) { var v = kmMpFn && k != null ? kmMpFn(c, k) : null; return typeof v === 'number' && isFinite(v) ? v : null; }
  function kmTxt(x, ate) {
    var d = kmDesl(x.c), a = kmMp(x.c, x.km);
    if (a != null) return 'km MP ' + nf(a, 2) + (ate ? ' a ' + (kmMp(x.c, x.kf) != null ? nf(kmMp(x.c, x.kf), 2) : '?') : '');
    return (d ? 'km local ' : 'km ') + (x.p.kmConferir ? '~' : '') + nf(x.km - d, 2) + (ate ? ' a ' + nf(x.kf - d, 2) : '');
  }
  // faixa de km do contrato no cartão e na caixa "Contratos": "km 301,3 – 999,8"; no 709, a das MPs ("km MP 301,1 – 999,6")
  function kmFaixaTxt(c, f) {
    var a = kmMp(c, f[0]), b = kmMp(c, f[1]);
    return a != null && b != null ? 'km MP ' + nf(a, 1) + ' – ' + nf(b, 1) : 'km ' + nf(f[0], 1) + ' – ' + nf(f[1], 1);
  }
  // nomes do contrato: o app.js passa os seus em o.nomes. Esta cópia curta, com a mesma regra, vale quando eles não vêm:
  // nome de tela pelo tipo e número ("Pontos Críticos 314"), nome formal com o Lote da licitação e o nº do CT, ordem fixa
  // dos tipos (pontos críticos, conservação, pontes) e os rótulos da caixa "Contratos" e das raias
  function nomesPadrao() {
    // sinal: o grupo da conservação com rotuloTipo 'sinal' (709), "Sinalização" no nome e logo antes das pontes
    var PAL = { pc: 'Pontos Críticos', conserva: 'Conservação', oae: 'Proarte', sinal: 'Sinalização' }, ORD = ['pc', 'conserva', 'oae'], GRS = ['pc', 'conserva', 'sinal', 'oae'];
    var CUR = { pc: 'p. críticos', conserva: 'conserv.', oae: 'pontes', sinal: 'sinaliz.' };
    function lp(v) { return v == null ? '' : String(v).trim().replace(/\s+/g, ' '); }
    function tipo(c) { return c && c.tipo === 'oae' ? 'oae' : c && c.tipo === 'conserva' ? 'conserva' : 'pc'; }
    function grupo(c) { return c && c.rotuloTipo === 'sinal' && tipo(c) === 'conserva' ? 'sinal' : tipo(c); }
    function tp(x) { return typeof x === 'string' ? (PAL[x] ? x : 'pc') : grupo(x); }
    function numeroCurto(c) { var m = /(\d{3,})\s*\/\s*\d{4}/.exec(lp(c && c.numero)); return m ? String(Number(m[1])) : ''; }
    function nome(c) { if (!c) return ''; var n = numeroCurto(c); return n ? PAL[grupo(c)] + ' ' + n : lp(c.lote) || PAL[grupo(c)]; }
    function loteReal(c) { var l = lp(c && c.lote); return /^lote\b/i.test(l) ? l : ''; }
    function numeroCT(c) { var n = lp(c && c.numero); return n ? 'CT ' + n : ''; }
    function formal(c) { return c ? [loteReal(c), numeroCT(c)].filter(Boolean).join(' · ') || nome(c) : ''; }
    function completo(c) { var out = []; [nome(c), loteReal(c), numeroCT(c)].forEach(function (x) { if (x && out.indexOf(x) < 0) out.push(x); }); return out.join(' · '); }
    // a conservação vai pela posição no eixo (km inicial, ou posEixo no contrato fora do eixo), como ctOrdem no app.js
    function ordem(lista) {
      return (lista || []).map(function (c, i) {
        var t = grupo(c), k = t !== 'conserva' ? null : typeof c.posEixo === 'number' ? c.posEixo : typeof c.kmIni === 'number' ? c.kmIni : null;
        return { c: c, i: i, t: GRS.indexOf(t), k: k, n: Number(numeroCurto(c)) || Infinity };
      })
        .sort(function (a, b) {
          return a.t - b.t || (a.k == null) - (b.k == null) || (a.k != null && a.k !== b.k ? a.k - b.k : 0) || (a.n < b.n ? -1 : a.n > b.n ? 1 : 0) || a.i - b.i;
        })
        .map(function (x) { return x.c; });
    }
    return { tipo: tipo, grupo: grupo, grupos: GRS.slice(), numeroCurto: numeroCurto, nome: nome, loteReal: loteReal, numeroCT: numeroCT, formal: formal, completo: completo, ordem: ordem,
      tipos: ORD.slice(), palavra: function (t) { return PAL[tp(t)]; }, curto: function (t) { return CUR[tp(t)]; } };
  }
  // filtro de situação por tipo de contrato: cada tipo conta à parte (antes o 'c:' juntava tudo que não era ponte)
  var PRE = { pc: 'c:', conserva: 's:', oae: 'o:' };
  var SIT_GR = [['pc', 'Pontos críticos · situação', SIT_C], ['conserva', 'Conservação · segmentos', SIT_S], ['oae', 'Proarte · pontes', SIT_O]];
  // a busca não liga para acento nem maiúscula ("conservacao", "criticos")
  function semAc(s) { s = String(s == null ? '' : s).toLowerCase(); return s.normalize ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : s; }
  // "A", "A e B", "A, B e C"
  function eLista(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' e ' + a[a.length - 1]; }
  function mapaDe(a) { if (!a) return null; var m = {}; a.forEach(function (k) { m[k] = true; }); return m; }
  // escolha da caixa "Contratos", guardada no aparelho (sem armazenamento, vale só nesta visita):
  // sel = ids marcados (null = Tudo); vistos = ids que existiam na última escolha (os que chegarem depois são "novo")
  function idsDe(v) { return Array.isArray(v) ? v.filter(function (x) { return typeof x === 'string' && x; }) : null; }
  function lerFiltro(chave) {
    try {
      var j = JSON.parse(localStorage.getItem(chave) || 'null'), s = j && idsDe(j.sel);
      return { sel: s && s.length ? s : null, vistos: (j && idsDe(j.vistos)) || null };
    } catch (e) { return { sel: null, vistos: null }; }
  }
  function gravarFiltro(chave, f) { try { localStorage.setItem(chave, JSON.stringify(f)); } catch (e) { /* sem armazenamento: vale só nesta visita */ } }
  // km de atuação: a união dos trechos (sem contar duas vezes o que se sobrepõe)
  function uniao(xs) {
    var a = xs.map(function (x) { return [x.km, x.kf]; }).sort(function (u, w) { return u[0] - w[0]; }), t = 0, s = null, e = null;
    a.forEach(function (r) { if (e == null || r[0] > e) { if (e != null) t += e - s; s = r[0]; e = r[1]; } else e = Math.max(e, r[1]); });
    return e == null ? 0 : t + e - s;
  }

  function VisaoGeral(o) {
    // mais: <details> "Serviços" do cartão (null = padrão do aparelho); ct: a caixa seletora "Contratos" aberta
    // (fica aberta entre os redesenhos, enquanto a pessoa marca vários)
    var host = o.host, st = { k0: null, k1: null, sel: null, off: {}, q: '', mais: null, ct: false };
    var W = 0, F = [0, 100], raf = 0, ptrs = {}, gesto = null, semClique = 0, cacheIt = null, ultW = 0;
    // grupoDe: item → data-fid do grupo que o contém no último desenho (ao fechar o cartão, o foco volta a ele);
    // ptrTipo/toque: o clique veio do dedo ou da caneta (o foco não volta ao campo de busca: o teclado virtual reabriria);
    // avisado: o #vgAviso tem texto (o render() só o limpa quando há o que limpar, e não a cada quadro do arrasto);
    // ptrEm: hora do último toque ou clique; refoco: o render() está devolvendo o foco (nenhum dos dois fecha a caixa)
    var grupoDe = {}, ptrTipo = '', toque = false, avisado = false, ptrEm = 0, refoco = false;
    // N: funções de nome (as do app.js por cima da cópia curta). filtro: a escolha da caixa "Contratos"; selM e vistosM são
    // os mesmos ids como mapa, para o "está no filtro?" ser uma consulta por id
    var N = nomesPadrao();
    if (o.nomes) Object.keys(o.nomes).forEach(function (k) { N[k] = o.nomes[k]; });
    kmMpFn = typeof o.kmMp === 'function' ? o.kmMp : null;
    var FILTRO_KEY = 'diagrama-linear-visao-contratos-' + ((window.AMBIENTE && window.AMBIENTE.nome) || 'oficial');
    var filtro = lerFiltro(FILTRO_KEY), selM = mapaDe(filtro.sel), vistosM = mapaDe(filtro.vistos);

    function cel() { return !!(window.matchMedia && window.matchMedia('(max-width: 700px)').matches); }
    // a lista do último desenho: achar(), a busca e os cliques usam a mesma, sem recalcular a situação de cada ponto.
    // lista: os itens de todos os contratos (a busca procura em todos); on: só os dos contratos mostrados (x.on).
    // todos: os contratos na ordem fixa (tipo e número); mostra: os do filtro. Os contadores (sem km, km fora) e a faixa
    // de km de cada contrato (fx) saem aqui, uma vez por desenho, e não a cada quadro do arrasto
    function itens() {
      if (cacheIt) return cacheIt;
      var out = [], dentro = [], semKm = 0, fora = 0, foraC = 0, fx = {}, por = {}, on = {}, novos = {};
      var todos = N.ordem(o.contratos()), mostra = selM ? todos.filter(function (c) { return selM[c.id]; }) : todos;
      // escolha: há contratos marcados aqui (todos marcados continuam marcados: mostra tudo, sem "fora do filtro");
      // ativo: a escolha deixa algum de fora. Nenhum dos escolhidos está aqui (excluído, ou ainda não chegou do banco):
      // mostra todos, com aviso, e a escolha continua guardada (uma carga parcial não a apaga). Com um contrato só não há
      // caixa: o guardado não vale, sem ser apagado
      var escolha = !!selM && mostra.length > 0 && todos.length > 1, ativo = escolha && mostra.length < todos.length;
      var aviso = !!selM && !mostra.length && todos.length > 1;
      if (!escolha) mostra = todos;
      mostra.forEach(function (c) { on[c.id] = true; });
      todos.forEach(function (c) {
        var oae = o.isOae(c), pre = PRE[N.tipo(c)], ok = !!on[c.id], xs = [];
        // chegou depois da última escolha e não está nela: fica desligado, com a marca "novo", até a pessoa mexer no filtro
        // (o guardado que chega depois, como na carga parcial, aparece escolhido e sem a marca)
        if (ativo && vistosM && !vistosM[c.id] && !ok) novos[c.id] = true;
        // km do contrato fora da rodovia: não entra na faixa (faixaDe), mas entra no aviso
        if (ok && [c.kmIni, c.kmFim].some(function (v) { var n = kmVis(c, num(v)); return n != null && !noKm(n); })) foraC++;
        // conservação (passo 2.4): os segmentos entram como trechos, na cor da pior situação do segmento
        c.pontos.forEach(function (p) {
          var km = kmVis(c, num(p.kmIni)), kf = kmVis(c, num(p.kmFim));
          if (km == null) { if (ok) semKm++; return; }
          if (!noKm(km)) { if (ok) fora++; return; }
          if (kf != null && !noKm(kf)) { if (ok) fora++; kf = null; }   // km final fora da rodovia: avisa e desenha só no km inicial
          if (kf == null || kf < km) kf = km;
          var inf = o.info(p);
          xs.push({ c: c, p: p, oae: oae, km: km, kf: kf, key: c.id + ':' + p.id, st: inf.status, cor: inf.color, inf: inf, fk: pre + inf.status, on: ok });
        });
        fx[c.id] = faixaDe(c, xs);
        por[c.id] = xs;
        out.push.apply(out, xs);
        if (ok) dentro.push.apply(dentro, xs);
      });
      return (cacheIt = { lista: out, on: dentro, semKm: semKm, fora: fora, foraC: foraC, todos: todos, mostra: mostra, dentro: on,
        escolha: escolha, ativo: ativo, aviso: aviso, novos: novos, fx: fx, por: por });
    }
    function faixaDe(c, its) {
      var a = kmVis(c, num(c.kmIni)), b = kmVis(c, num(c.kmFim));
      if (!noKm(a)) a = null;
      if (!noKm(b)) b = null;
      if (a != null && b != null && a > b) { var t = a; a = b; b = t; }   // km do contrato digitado no sentido inverso
      its.forEach(function (x) { if (x.c === c) { a = a == null ? x.km : Math.min(a, x.km); b = b == null ? x.kf : Math.max(b, x.kf); } });
      return a == null || b == null ? null : [a, b];
    }
    // a faixa total (limite do zoom, do arrasto e do minimapa) é a dos contratos mostrados (cs), pela faixa já medida (fx).
    // Marcar contratos enquadra esta faixa: a folga (3% do trecho, pelo menos 0,5 km e uns 16 px) não corta o círculo da ponta
    function faixaTotal(cs, fx, wpx) {
      var a = Infinity, b = -Infinity;
      cs.forEach(function (c) { var f = fx[c.id]; if (f) { a = Math.min(a, f[0]); b = Math.max(b, f[1]); } });
      if (!isFinite(a) || !isFinite(b) || b - a < MIN_KM) return [isFinite(a) ? a - 5 : 0, isFinite(a) ? a + 5 : 100];
      var pad = Math.max((b - a) * 0.03, 0.5, (b - a) * 16 / Math.max(wpx, 200));
      return [a - pad, b + pad];
    }
    // faixa do desenho: a dos contratos mostrados; se nenhum deles tem km (contrato novo), a de todos (o desenho não cai
    // na janela 0–100) e o render() avisa
    function semFaixa(d) { return d.ativo && !d.mostra.some(function (c) { return d.fx[c.id]; }); }
    function faixaMostrada(d) { return faixaTotal(semFaixa(d) ? d.todos : d.mostra, d.fx, W); }
    // o trecho dos contratos (sem a folga do desenho); nenhum com km: null
    function envoltoria(cs, fx) {
      var a = Infinity, b = -Infinity;
      cs.forEach(function (c) { var f = fx[c.id]; if (f) { a = Math.min(a, f[0]); b = Math.max(b, f[1]); } });
      return isFinite(a) && isFinite(b) ? [a, b] : null;
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
    // um desenho por quadro no arrasto, na pinça e na roda; os dados não mudam no gesto: reaproveita a lista (itens)
    function agenda() { if (!raf) raf = requestAnimationFrame(seguro(function () { raf = 0; render(false, true); })); }
    // erro num evento da visão (dado estranho): volta a busca, o cartão e a caixa ao padrão e o app mostra o contrato,
    // como no renderAll
    function seguro(f) {
      return function (e) { try { return f(e); } catch (er) { if (!o.onErro) throw er; st.q = ''; st.sel = null; st.ct = false; o.onErro(er); } };
    }
    function achar(key) { var r = null; itens().lista.forEach(function (x) { if (x.key === key) r = x; }); return r; }
    function trk() { return host.querySelector('.vg-trk'); }

    function render(medido, gesto) {
      if (!medido && !gesto) cacheIt = null;
      var mob = cel(), d = itens(), its = d.on, cs = d.mostra;
      ultW = host.clientWidth;
      if (!W) W = Math.max(200, host.clientWidth - (mob ? 24 + 26 + 54 : 40 + 34 + 168 + (st.sel ? 420 : 0)));
      // estava em "Tudo" (a janela cobria a faixa anterior): acompanha a faixa nova (dados do banco, cartão aberto, tela girada)
      var ep = (F[1] - F[0]) * 1e-9, eraTudo = st.k0 != null && st.k0 <= F[0] + ep && st.k1 >= F[1] - ep;
      F = faixaMostrada(d);
      if (st.k0 == null || eraTudo) { st.k0 = F[0]; st.k1 = F[1]; } else { var r0 = lim(st.k0, st.k1); st.k0 = r0[0]; st.k1 = r0[1]; }
      var k0 = st.k0, k1 = st.k1, R = k1 - k0, FR = F[1] - F[0];
      var X = function (km) { return (km - k0) / R * 100; }, P = function (km) { return (km - k0) / R * W; };
      var vis = its.filter(function (x) { return x.kf >= k0 && x.km <= k1 && !st.off[x.fk]; });
      var tem = {};   // tipos com contrato mostrado: só eles ganham chips de situação e legenda
      cs.forEach(function (c) { tem[N.tipo(c)] = true; });
      // o contrato do ponto aberto saiu do filtro: o cartão fecha (o foco fica na marcação da caixa, pelo data-fid)
      var sel = st.sel ? achar(st.sel) : null;
      if (sel && !sel.on) sel = null;
      if (st.sel && !sel) { st.sel = null; st.mais = null; }
      var h = '';

      // título; o aviso de km fora da rodovia junta pontos (km inicial ou final) e limites de contrato
      var rod = String((d.todos[0] && d.todos[0].rodovia) || 'BR-230/PA'), nT = d.todos.length;
      var ruins = [d.fora ? d.fora + (d.fora === 1 ? ' item' : ' itens') : '', d.foraC ? d.foraC + (d.foraC === 1 ? ' contrato' : ' contratos') : ''].filter(Boolean).join(' e ');
      h += '<div class="vg-head"><div><h2>' + esc(rod) + ' · ' + (d.ativo ? cs.length + ' de ' + nT + (nT === 1 ? ' contrato' : ' contratos') : 'todos os contratos') + '</h2>' +
        '<p>Em escala de km. Só na tela: o PDF oficial continua dentro de cada contrato.</p></div>' +
        '<span class="vg-tot">' + its.length + (its.length === 1 ? ' item' : ' itens') + ' no desenho' + (d.semKm ? ' · <b>' + d.semKm + ' sem km</b> (não aparecem)' : ' · nenhum sem km') +
        (ruins ? ' · <b>' + ruins + ' com km fora da rodovia</b> (confira a vírgula)' : '') + '</span></div>';

      // desenho, antes dos cartões e da busca: marcar um contrato só muda o que está embaixo da barra
      // passo da régua pela distância entre marcas: no máximo uma a cada 60–70 px, qualquer que seja a faixa
      var alvoT = R * (mob ? 60 : 70) / W, step = [1, 2, 5, 10, 20, 50, 100, 200, 500].filter(function (t) { return t >= alvoT; })[0] || Math.pow(10, Math.ceil(Math.log10(alvoT))), ticks = [];
      for (var t = Math.ceil(k0 / step) * step; t <= k1; t += step) ticks.push(t);
      // barra: [Tudo] [Contratos ▾] (com um contrato só não há o que escolher), o zoom e o trecho na tela
      if (nT < 2) st.ct = false;
      h += '<div class="vg-meio"><section class="vg-box vg-diag" tabindex="-1" aria-label="Diagrama em escala"><div class="vg-bar">' + (nT > 1 ? caixaContratos(d) : '') +
        '<div class="vg-zoom" role="group" aria-label="Zoom"><button type="button" class="lado" data-vg="esq" aria-label="Para a esquerda">‹</button><button type="button" data-vg="menos" aria-label="Afastar">−</button>' +
        '<button type="button" data-vg="mais" aria-label="Aproximar">+</button><button type="button" class="lado" data-vg="dir" aria-label="Para a direita">›</button></div>' +
        '<span class="vg-faixa">km ' + nf(k0, R < 20 ? 1 : 0) + ' – ' + nf(k1, R < 20 ? 1 : 0) + ' · ' + nf(R, R < 20 ? 1 : 0) + ' km na tela</span></div>' +
        (d.aviso ? '<p class="vg-av">Os contratos escolhidos não estão aqui; mostrando todos.</p>' : '') +
        (semFaixa(d) ? '<p class="vg-nokm">' + esc(eLista(cs.map(function (c) { return N.nome(c); }))) + (cs.length === 1 ? ' ainda não tem km' : ' ainda não têm km') +
          ': o desenho mostra o trecho de todos os contratos.</p>' : '');
      // a rodovia inteira, com a parte que está na tela
      var XF = function (km) { return (km - F[0]) / FR * 100; };
      // uma linha por contrato com faixa; com muitos contratos as linhas afinam para caber nos 22 px do botão
      var mini = cs.map(function (c) { return { c: c, f: d.fx[c.id] }; }).filter(function (m) { return m.f; });
      var nM = mini.length, passo = Math.min(6, 16 / Math.max(nM, 1)), alt = Math.max(1, Math.min(4, passo - 1)), top0 = (22 - ((nM - 1) * passo + alt)) / 2;
      // com filtro, o minimapa mostra (e enquadra) só o trecho dos escolhidos
      h += '<button type="button" class="vg-mini" data-vg="tudo" aria-label="' + (d.ativo ? 'Trecho dos contratos escolhidos' : 'Rodovia inteira') + ': toque para ver tudo">' + mini.map(function (m, i) {
        return '<span style="left:' + pc(XF(m.f[0])) + ';width:' + pc((m.f[1] - m.f[0]) / FR * 100) + ';top:' + (top0 + i * passo).toFixed(1) + 'px;height:' + alt.toFixed(1) + 'px;background:' + (o.isOae(m.c) ? '#9AA39E' : '#5C6661') + '"></span>';
      }).join('') + '<span class="vg-jan" style="left:' + pc(XF(k0)) + ';width:' + pc(R / FR * 100) + '"></span></button>';

      h += '<div class="vg-plot">';
      // localidades do SNV, em duas linhas para não encavalar. Perto da borda o nome encosta nela (em vez de sumir);
      // as cidades das pontas (Novo Repartimento e Rurópolis), fora da tela, ficam na borda com a seta do sentido
      // as pontas na tela entram primeiro, para não perderem o lugar para as do meio; as setas das pontas fora da tela, por último
      var ocup = [[], []], loc = '', nL = LOCAIS.length, dentro = function (i) { return LOCAIS[i][1] >= k0 && LOCAIS[i][1] <= k1; };
      var ordem = [0, nL - 1].filter(dentro).concat(LOCAIS.map(function (l, i) { return i; }).slice(1, -1), [0, nL - 1].filter(function (i) { return !dentro(i); }));
      ordem.forEach(function (i) {
        var l = LOCAIS[i], ponta = i === 0 ? -1 : i === LOCAIS.length - 1 ? 1 : 0, fora = l[1] < k0 || l[1] > k1;
        if (fora && !(ponta === -1 && l[1] < k0) && !(ponta === 1 && l[1] > k1)) return;
        var nome = fora ? (ponta < 0 ? '← ' + l[0] : l[0] + ' →') : l[0];
        var x = fora ? (ponta < 0 ? 0 : W) : P(l[1]), w = nome.length * (mob ? 5.8 : 6.4) + 10, a = x - w / 2, tr = 'translateX(-50%)', lx = x;
        if (a < 0) { lx = Math.max(0, x - 4); a = lx; tr = 'none'; }
        else if (x + w / 2 > W) { lx = Math.min(W, x + 4); a = lx - w; tr = 'translateX(-100%)'; }
        if (a < 0 || a + w > W) return;
        var livre = function (r) { return ocup[r].every(function (q) { return a + w <= q[0] || a >= q[1]; }); };
        var row = livre(0) ? 0 : livre(1) ? 1 : -1;
        if (row < 0) return;
        ocup[row].push([a, a + w]);
        loc += '<span' + (fora ? ' class="vg-loc-ponta"' : '') + ' style="left:' + pc(lx / W * 100) + ';top:' + (row ? 15 : 0) + 'px;transform:' + tr + '">' + esc(nome) + '</span>' +
          (fora ? '' : '<i style="left:' + pc(X(l[1])) + ';top:' + (row ? 32 : 17) + 'px;bottom:0"></i>');
      });
      h += '<div class="vg-row vg-loc"><div class="vg-lab vg-lab-s">Localidades (SNV)</div><div class="vg-trk">' + loc + '</div></div>';
      h += '<div class="vg-row vg-rod"><div class="vg-lab"><b>' + esc(rod.split('/')[0]) + '</b></div><div class="vg-trk"><span class="vg-asf"></span></div></div>';
      var grade = ticks.map(function (t) { return '<i class="vg-grade" style="left:' + pc(X(t)) + '"></i>'; }).join('');
      var enc = mob ? 16 : 14;   // símbolos mais perto que isso (px) viram um círculo com a quantidade
      // um grupo que nem no zoom máximo se separa (itens no mesmo km): o toque passa pelos itens um a um
      function preso(g) { return R <= MIN_KM * 1.001 || (g.b - g.a) / MIN_KM * W < enc; }
      grupoDe = {};
      // uma raia por contrato mostrado, na ordem fixa (tipo e número), e não na ordem em que foram marcados
      cs.forEach(function (c) {
        // por km; no mesmo km, a barra mais longa antes, para a curta ficar por cima e continuar visível
        var tp = N.tipo(c), oae = o.isOae(c), xs = vis.filter(function (x) { return x.c === c; }).sort(function (a, b) { return a.km - b.km || (b.kf - b.km) - (a.kf - a.km); });
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
            var km = k0 + g.soma / g.xs.length / W * R, pior = null, n = g.xs.length, nome = oae ? ' pontes' : N.tipo(x.c) === 'conserva' ? ' segmentos' : ' pontos';
            g.xs.forEach(function (y) { if (!pior || (PESO[y.st] || 0) > (PESO[pior.st] || 0)) pior = y; });
            var estilo = ' style="left:' + pc(X(km)) + ';border-color:' + ((PESO[pior.st] || 0) >= 2 ? pior.cor : '#3B4540') + '"';
            var fidG = (preso(g) ? 'gp:' : 'ga:') + x.key;
            g.xs.forEach(function (y) { grupoDe[y.key] = fidG; });
            if (preso(g)) {
              // escolhe o próximo depois do que está aberto (na ordem por km), e volta ao primeiro no fim
              var iSel = -1, idx = function (y) { return xs.indexOf(y); };
              xs.forEach(function (y, i) { if (y.key === st.sel) iSel = i; });
              var dentro = g.xs.some(function (y) { return y.key === st.sel; });
              var prox = g.xs.filter(function (y) { return idx(y) > iSel; })[0] || g.xs[0], tipG = n + nome + ' no km ' + nf(g.a, 2) + ': toque para ver um a um (também na lista abaixo)';
              mk += '<button type="button" class="vg-mk grupo' + (dentro ? ' sel' : '') + '" data-vg="sel" data-fid="gp:' + esc(g.xs[0].key) + '" data-key="' + esc(prox.key) + '"' + estilo + ' title="' + esc(tipG) + '" aria-label="' + esc(tipG) + '">' + n + '</button>';
              return;
            }
            // o toque aproxima pelo menos à metade da tela, centrado no grupo
            var pad = Math.max((g.b - g.a) * 0.4, 1), alvo = Math.min(g.b - g.a + 2 * pad, R / 2), meio = (g.a + g.b) / 2, tipA = n + nome + ' entre km ' + nf(g.a, 1) + ' e ' + nf(g.b, 1) + ': toque para aproximar';
            mk += '<button type="button" class="vg-mk grupo" data-vg="ir" data-fid="ga:' + esc(g.xs[0].key) + '" data-a="' + (meio - alvo / 2) + '" data-b="' + (meio + alvo / 2) + '"' + estilo + ' title="' + esc(tipA) + '" aria-label="' + esc(tipA) + '">' + n + '</button>';
            return;
          }
          var mid = (x.km + x.kf) / 2, nome = String(x.p.nome || x.p.codigo || (x.oae ? 'Ponte' : 'Ponto')), lw = nome.length * (mob ? 6.2 : 6.6) + 10, cx = P(mid);
          // sem nome (visão pública, que não recebe os nomes): sem rótulo, em vez de um "?" em cima de cada marca
          var temNome = !!(x.p.nome || x.p.codigo);
          if (temNome && cx - lw / 2 >= ult + 4 && cx - lw / 2 >= -2 && cx + lw / 2 <= W + 2) { ult = cx + lw / 2; rot += '<span class="vg-rot" style="left:' + pc(X(mid)) + '">' + esc(nome) + (x.p.kmConferir ? ' ~' : '') + '</span>'; }
          var tip = (x.oae ? nome + (x.p.codigo ? ' · ' + x.p.codigo : '') : nome) + ' · ' + kmTxt(x, g.t === 'barra') + ' · ' + x.st;
          mk += '<button type="button" class="vg-mk ' + g.t + (st.sel === x.key ? ' sel' : '') + '" data-vg="sel" data-key="' + esc(x.key) + '" title="' + esc(tip) + '" aria-label="' + esc(tip) + '" style="left:' + pc(X(g.t === 'barra' ? x.km : mid)) +
            (g.t === 'barra' ? ';width:' + pc((x.kf - x.km) / R * 100) : '') + ';background:' + x.cor + '"></button>';
        });
        var f = d.fx[c.id], a = f ? Math.max(f[0], k0) : 0, b = f ? Math.min(f[1], k1) : 0;
        var banda = f && b > a ? '<i class="vg-banda' + (oae ? ' oae' : '') + '" style="left:' + pc(X(a)) + ';width:' + pc((b - a) / R * 100) + '"></i>' : '';
        // computador: "Pontos Críticos 314" e "p. críticos · 18 na tela"; celular (coluna estreita): "314" e "p. críticos"
        var rotT = !mob && tp === 'conserva' ? N.palavra(c).toLowerCase() : N.curto(c);   // pelo contrato: a sinalização (709) tem nome próprio
        h += '<div class="vg-row vg-lane"><div class="vg-lab" title="' + esc(N.completo(c)) + '"><b>' + esc(mob ? N.numeroCurto(c) || N.nome(c) : N.nome(c)) + '</b><small>' +
          esc(rotT) + (c.kmLocal ? ' · km próprio' : '') + (mob ? '' : ' · ' + xs.length + ' na tela') + '</small></div>' +
          '<div class="vg-trk">' + grade + banda + rot + mk + '</div></div>';
      });
      h += '<div class="vg-row vg-eixo"><div class="vg-lab"></div><div class="vg-trk">' + ticks.map(function (t) {
        var x = P(t), tr = x > W - 30 ? 'translateX(-100%)' : x < 30 ? 'none' : 'translateX(-50%)';
        return '<i style="left:' + pc(X(t)) + '"></i><span style="left:' + pc(X(t)) + ';transform:' + tr + '">km ' + nf(t, 0) + '</span>';
      }).join('') + '</div></div>';
      h += '<div class="vg-row vg-esc"><div class="vg-lab vg-lab-s">Escala</div><div class="vg-trk"><i style="width:' + pc(step / R * 100) + '"></i><span>' + nf(step, 0) + ' km</span></div></div>';
      h += '</div>';
      // legenda dos contratos mostrados: trecho e losango só com pontos críticos ou conservação; "Ponte" só com pontes
      h += '<div class="vg-leg">' + (tem.pc || tem.conserva ? '<span><i style="width:18px;height:10px;border-radius:2px;background:#2B5797"></i>Trecho no tamanho real</span>' +
        '<span><i style="width:9px;height:9px;transform:rotate(45deg);border-radius:1px;background:#3B4540"></i>Ponto curto demais para esta escala</span>' : '') +
        (tem.oae ?'<span><i style="width:11px;height:11px;border-radius:50%;background:#7A8580"></i>Ponte</span>' : '') +
        '<span><i style="width:16px;height:16px;border-radius:50%;border:2px solid #D93025;box-sizing:border-box"></i>Vários juntos (borda: a pior situação); toque para aproximar</span>' +
        '<span>“~” km a conferir</span>' + (mob ? '' : '<span>Ctrl + roda do mouse aproxima; arraste para os lados</span>') + '</div></section>';

      // cartão do ponto escolhido (no celular, sobe da parte de baixo)
      if (sel) {
        // sem código (o.publico): o banco manda só a posição; o cartão diz só o km e pede o código para abrir
        var pub = !!(o.publico && o.publico());
        var x = sel, inf = x.inf, nomeS = pub ? (x.oae ? 'Ponte' : 'Ponto') : x.oae ? (x.p.nome || '?') + (x.p.codigo ? ' · ' + x.p.codigo : '') : (x.p.nome || '?');
        var kmS = x.oae ? 'km ' + (x.p.kmConferir ? '~' : '') + nf(x.km, 2) + (Number(x.p.extensao) ? ' · ' + nf(x.p.extensao, 1) + ' m de ponte' : '')
          : kmTxt(x, true) + ' · ' + nf(x.kf - x.km, 2) + ' km';
        var servs = (inf.servs || []).map(function (s) {
          return '<div class="vg-sv"><span>' + esc(s.label) + '</span><b><i style="background:' + esc(s.color) + '"></i>' + esc(s.text) + '</b></div>';
        }).join('');
        h += '<aside class="vg-box vg-card" aria-label="Ponto escolhido" data-key="' + esc(x.key) + '"><div class="vg-card-top"><div><small>' + esc(N.completo(x.c)) + '</small>' +
          '<h3>' + esc(nomeS) + '</h3><span>' + kmS + '</span></div><button type="button" class="vg-x" data-vg="fechar" aria-label="Fechar">×</button></div>' +
          (pub ? '<p class="vg-obs">A situação e os detalhes aparecem para quem entra com o código.</p>' : '<div class="vg-st"><i style="background:' + esc(x.cor) + '"></i>' + esc(x.st) + (inf.pctText ? ' · ' + esc(inf.pctText) : '') + '</div>') +
          (!pub && (servs || x.p.obs) ? '<details class="vg-mais"' + ((st.mais != null ? st.mais : !mob) ? ' open' : '') + '><summary>' + (servs ? 'Serviços' + (x.p.obs ? ' e observações' : '') : 'Observações') + '</summary>' + servs +
            (x.p.obs ? '<p class="vg-obs">' + esc(x.p.obs) + '</p>' : '') + '</details>' : '') +
          '<div class="vg-acoes"><button type="button" class="btn primary" data-vg="abrir">' + (pub ? 'Entrar para ver' : 'Abrir no contrato') + '</button>' +
          (!x.c.kmLocal && (typeof o.temMapa === 'function' ? o.temMapa() : o.temMapa) ? '<button type="button" class="btn" data-vg="mapa">Ver no mapa</button>' : '') +
          (o.temFotos && o.temFotos() ? '<button type="button" class="btn" data-vg="fotos">Fotos</button>' : '') + '</div></aside>';
      }
      h += '</div>';

      // resumo por contrato (só os mostrados); embaixo, quantos ficaram fora do filtro
      h += '<section class="vg-cards" aria-label="Resumo dos contratos mostrados">' + cs.map(function (c) {
        var tp = N.tipo(c), oae = tp === 'oae', xs = d.por[c.id] || [], sits = oae ? SIT_O : tp === 'conserva' ? SIT_S : SIT_C, n = {}, f = d.fx[c.id];
        xs.forEach(function (x) { n[x.st] = (n[x.st] || 0) + 1; });
        var tot = tp === 'conserva' ? xs.length : c.pontos.length, ext = oae ? c.pontos.reduce(function (t, p) { return t + (Number(p.extensao) || 0); }, 0) / 1000 : uniao(xs);
        var segs = sits.filter(function (s) { return n[s[0]]; }).map(function (s) { return '<i style="flex:' + n[s[0]] + ' 1 0;background:' + s[1] + '"></i>'; }).join('');
        var txt = sits.filter(function (s) { return n[s[0]]; }).map(function (s) { return n[s[0]] + ' ' + (n[s[0]] === 1 ? s[2] : s[3]); }).join(' · ');
        var pad = f ? Math.max((f[1] - f[0]) * 0.03, 0.5) : 0, nome = N.nome(c) || 'Contrato', formal = N.formal(c);
        return '<article class="vg-box vg-ct ' + tp + '"><div class="vg-ct-h"><h3>' + esc(nome) + '</h3>' + (formal && formal !== nome ? '<span>' + esc(formal) + '</span>' : '') + '</div>' +
          (f ? '<div class="vg-ct-t">' + kmFaixaTxt(c, f) + (c.origem || c.destino ? ' · ' + esc(c.origem || '?') + ' → ' + esc(c.destino || '?') : '') + '</div>' : '') +
          '<div class="vg-ct-n"><b>' + tot + (oae ? (tot === 1 ? ' ponte' : ' pontes') : tp === 'conserva' ? (tot === 1 ? ' segmento' : ' segmentos') : (tot === 1 ? ' ponto' : ' pontos')) + '</b><span>' + nf(ext, 2) + (oae ? ' km de pontes' : ' km de atuação') + '</span></div>' +
          '<div class="vg-seg" aria-hidden="true">' + segs + '</div><div class="vg-ct-s">' + (txt || 'sem itens com km') + '</div>' +
          '<div class="vg-ct-a">' + (f ? '<button type="button" class="btn small" data-vg="ir" data-fid="vd:' + esc(c.id) + '" data-a="' + (f[0] - pad) + '" data-b="' + (f[1] + pad) + '">Ver no desenho</button>' : '') +
          '<button type="button" class="btn small ghost" data-vg="ct" data-cid="' + esc(c.id) + '">Abrir contrato →</button></div></article>';
      }).join('') + '</section>';
      var nFora = nT - cs.length;
      if (d.ativo && nFora > 0) h += '<div class="vg-fora"><span>' + nFora + (nFora === 1 ? ' contrato fora do filtro' : ' contratos fora do filtro') + '</span>' +
        '<button type="button" class="btn small" data-vg="ftodos" data-fid="ft:fora">Mostrar todos</button></div>';

      // busca e filtros por situação: contam só os contratos mostrados (as duas escolhas, contrato e situação, se somam)
      var conta = {};
      its.forEach(function (x) { conta[x.fk] = (conta[x.fk] || 0) + 1; });
      function chips(sits, pre, oae) {
        return sits.map(function (s) {
          var fk = pre + s[0], on = !st.off[fk];
          return '<button type="button" class="vg-chip' + (oae ? ' oae' : '') + '" data-vg="chip" data-fk="' + esc(fk) + '" aria-pressed="' + on + '"><i style="background:' + s[1] + '"></i>' + esc(s[0]) + ' <b>' + (conta[fk] || 0) + '</b></button>';
        }).join('');
      }
      h += '<section class="vg-box vg-filtros" aria-label="Busca e filtros"><div class="vg-busca"><label class="vg-cap" for="vgBusca">Buscar</label>' +
        '<input id="vgBusca" type="search" autocomplete="off" placeholder="km (ex.: 794,5), ponto, ponte ou contrato" value="' + esc(st.q) + '"><div class="vg-res" id="vgRes">' + resultados() + '</div></div>' +
        SIT_GR.filter(function (g) { return tem[g[0]]; }).map(function (g) {
          return '<div class="vg-chips"><span class="vg-cap">' + esc(g[1]) + '</span><div>' + chips(g[2], PRE[g[0]], g[0] === 'oae') + '</div></div>';
        }).join('') + '</section>';

      // lista do trecho da tela
      var ord = vis.slice().sort(function (a, b) { return a.km - b.km; }), max = mob ? 8 : 12;
      h += '<section class="vg-box vg-lista" aria-label="Itens no trecho da tela"><div class="vg-lista-h"><h3>No trecho da tela</h3><span>' + vis.length + (vis.length === 1 ? ' item' : ' itens') + ', por km</span></div><div class="vg-tab">' +
        (mob ? '' : '<div class="vg-tr h"><span>Contrato</span><span>Ponto ou ponte</span><span class="n">km</span><span class="n">Extensão</span><span>Situação</span></div>') +
        ord.slice(0, max).map(function (x) {
          var nome = x.oae ? (x.p.nome || '?') + (x.p.codigo ? ' · ' + x.p.codigo : '') : (x.p.nome || '?'), km = kmTxt(x).replace(/^km (local |MP )?/, '');
          var sit = '<i style="background:' + esc(x.cor) + '"></i>' + esc(x.st) + (!x.oae && x.inf.pctText ? ' · ' + esc(x.inf.pctText) : '');
          // celular: "314 · P1"; computador: o nome do contrato na primeira coluna
          if (mob) return '<button type="button" class="vg-tr m' + (st.sel === x.key ? ' sel' : '') + '" data-vg="sel" data-fid="li:' + esc(x.key) + '" data-key="' + esc(x.key) + '"><span><b>' + esc((N.numeroCurto(x.c) || N.nome(x.c)) + ' · ' + nome) + '</b><small class="s">' + sit + '</small></span><span class="n">km ' + km + '</span></button>';
          return '<button type="button" class="vg-tr' + (st.sel === x.key ? ' sel' : '') + '" data-vg="sel" data-fid="li:' + esc(x.key) + '" data-key="' + esc(x.key) + '"><span>' + esc(N.nome(x.c)) + '</span><span><b>' + esc(nome) + '</b></span>' +
            '<span class="n">' + km + '</span><span class="n">' + (x.oae ? (Number(x.p.extensao) ? nf(x.p.extensao, 1) + ' m' : '–') : nf(x.kf - x.km, 2) + ' km') + '</span><span class="s">' + sit + '</span></button>';
        }).join('') + '</div>' + (ord.length > max ? '<span class="vg-resto">e mais ' + (ord.length - max) + ' no trecho da tela; aproxime para ver menos</span>' : '') + '</section>';

      // o redesenho troca tudo: guarda o foco (busca, botão ou marcação da caixa) e a rolagem do cartão do mesmo ponto e da
      // caixa "Contratos" aberta. data-fid é a identidade de controles repetidos (marcações, "Ver no desenho", grupos,
      // linhas da lista); se o controle some (resultado da busca, grupo que aproximou, ×, caixa fechada), o foco vai para
      // a busca, para o botão "Contratos" ou para o desenho. Depois do toque de dedo num resultado, vai para o desenho:
      // o campo de busca focado no toque reabriria o teclado (Android)
      var ae = document.activeElement, foco = null, dv = ae && ae.dataset || {};
      if (ae && ae !== host && host.contains(ae)) {
        foco = { q: dv.fid ? '[data-fid="' + cssEsc(dv.fid) + '"]' : ae.id ? '#' + ae.id : ae.tagName === 'SUMMARY' ? '.vg-mais summary' :
          dv.vg ? '[data-vg="' + dv.vg + '"]' + (dv.key ? '[data-key="' + cssEsc(dv.key) + '"]' : dv.fk ? '[data-fk="' + cssEsc(dv.fk) + '"]' : dv.cid ? '[data-cid="' + cssEsc(dv.cid) + '"]' : '') : null,
          alt: ae.closest && ae.closest('.vg-res') && !toque ? '#vgBusca' : ae.closest && ae.closest('.vg-fora') ? '[data-fid="ft:todos"]' :
            ae.closest && ae.closest('.vg-ctw') ? '[data-fid="ft:ct"]' : '.vg-diag' };
        if (ae.id === 'vgBusca') { foco.s = ae.selectionStart; foco.e = ae.selectionEnd; }
      }
      var cd0 = host.querySelector('.vg-card'), topo0 = cd0 && sel && cd0.dataset.key === sel.key ? cd0.scrollTop : 0;
      var pl0 = st.ct && host.querySelector('.vg-pnl-l'), rol0 = pl0 ? pl0.scrollTop : 0;
      host.innerHTML = '<div class="vg' + (sel ? ' com-card' : '') + '">' + h + '</div>';
      if (!sel) avisa('');   // cartão fechado (×, Esc, ponto que sumiu): o "Cartão aberto." não fica para trás
      if (topo0) { var cd1 = host.querySelector('.vg-card'); if (cd1) cd1.scrollTop = topo0; }
      if (rol0) { var pl1 = host.querySelector('.vg-pnl-l'); if (pl1) pl1.scrollTop = rol0; }
      if (foco) {
        var fn = (foco.q && host.querySelector(foco.q)) || host.querySelector(foco.alt);
        // a marcação ficou na caixa fechada (escondida, sem foco): o foco vai ao botão "Contratos"
        if (fn && fn.closest && fn.closest('.vg-pnl[hidden]')) fn = host.querySelector('[data-fid="ft:ct"]');
        refoco = true;
        if (fn) { try { fn.focus({ preventScroll: true }); if (foco.s != null) fn.setSelectionRange(foco.s, foco.e); } catch (e) { /* navegador antigo */ } }
        refoco = false;
      }
      // a largura real da faixa decide trecho, símbolo e grupo: se mudou (cartão aberto, tela girada), desenha de novo
      var tk = trk(), w = tk ? tk.clientWidth : 0;
      if (w && Math.abs(w - W) > 3 && !medido) { W = w; render(true); return; }
      folga();
    }
    function cssEsc(s) { return window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&'); }
    // leitor de tela: o aviso fica fora do host, que é trocado a cada desenho (index.html #vgAviso); '' limpa
    function avisa(t) {
      if (!t && !avisado) return;
      var av = document.getElementById('vgAviso');
      avisado = !!t;
      if (av) av.textContent = t;
    }
    // no celular o cartão é uma folha presa embaixo: o fim da página ganha a altura dela, para nada ficar escondido
    function folga() {
      var vg = host.firstChild, cd = host.querySelector('.vg-card');
      if (vg && vg.style) vg.style.paddingBottom = cel() && cd ? (cd.offsetHeight + 12) + 'px' : '';
    }

    // [Tudo] [Contratos ▾] e a caixa seletora logo abaixo, por cima do desenho: os contratos por tipo, na ordem fixa, cada um
    // com o símbolo da raia (losango: pontos críticos; faixa: conservação; círculo: pontes) e o trecho de km. Sem escolha,
    // nada marcado e "Tudo" escuro (também no aviso: a escolha guardada não chegou e a tela mostra todos); com escolha, o
    // botão escuro diz os números (até 3) ou quantos. A caixa é sempre desenhada (escondida quando fechada), para o
    // aria-controls apontar para ela
    function caixaContratos(d) {
      var ms = d.escolha ? d.mostra : [], n = ms.length;
      var vis = 'Contratos' + (n ? ' · ' + (n <= 3 ? ms.map(function (c) { return N.numeroCurto(c) || N.nome(c); }).join(', ') : n) : '');
      // o nome acessível começa pelo texto visível, para o comando de voz achar o botão
      var nomeB = vis + ', mostrando ' + (n ? eLista(ms.map(function (c) { return N.nome(c); })) : 'todos');
      var s = '<div class="vg-ctw"><div class="vg-pre" role="group" aria-label="Contratos mostrados">' +
        '<button type="button" data-vg="ftudo" data-fid="ft:todos" aria-pressed="' + !d.escolha + '" aria-label="Tudo, todos os contratos">Tudo</button>' +
        '<button type="button" class="vg-ctb' + (n ? ' on' : '') + '" data-vg="painel" data-fid="ft:ct" aria-expanded="' + !!st.ct + '" aria-controls="vgCts" aria-label="' + esc(nomeB) + '">' +
        '<span>' + esc(vis) + '</span><i class="vg-seta" aria-hidden="true"></i></button></div>' +
        '<div class="vg-pnl" id="vgCts" role="group" aria-label="Escolher os contratos mostrados"' + (st.ct ? '' : ' hidden') + '><div class="vg-pnl-l">';
      // por grupo (a sinalização, 709, à parte, com a cor da conservação); sem N.grupo (nomes antigos), pelo tipo
      var grs = N.grupo ? N.grupos || N.tipos : N.tipos, grDe = N.grupo || N.tipo;
      grs.forEach(function (t) {
        var cs = d.todos.filter(function (c) { return grDe(c) === t; }), tc = t === 'sinal' ? 'conserva' : t;
        if (!cs.length) return;
        s += '<fieldset class="vg-pg ' + tc + '"><legend class="vg-cap">' + esc(N.palavra(t)) + '</legend>' + cs.map(function (c) {
          var on = d.escolha && !!d.dentro[c.id], f = d.fx[c.id];
          return '<label class="vg-op' + (on ? ' on' : '') + '" title="' + esc(N.completo(c)) + '"><input type="checkbox" data-ck="' + esc(c.id) + '" data-fid="ck:' + esc(c.id) + '"' + (on ? ' checked' : '') + '>' +
            '<span class="vg-op-s" aria-hidden="true"><i class="vg-sb ' + tc + '"></i></span><span class="vg-op-t"><b>' + esc(N.nome(c) || 'Contrato') + '</b><small>' + (c.kmLocal ? 'km local ' + nf(c.kmIni, 1) + ' – ' + nf(c.kmFim, 1) + ' (km próprio)' : f ? kmFaixaTxt(c, f) : 'sem km') + '</small></span>' +
            (d.novos[c.id] ? '<small class="vg-novo">novo</small>' : '') + '</label>';
        }).join('') + '</fieldset>';
      });
      // "Mostrar todos" (só com algo marcado: no aviso a tela já mostra todos e o "Tudo" basta) desmarca tudo sem fechar a
      // caixa; "Pronto" fecha
      return s + '</div><div class="vg-pnl-p">' + (d.escolha ? '<button type="button" class="btn small ghost" data-vg="ftodos" data-fid="ft:limpa">Mostrar todos</button>' : '') +
        '<button type="button" class="btn small" data-vg="pronto" data-fid="ft:pronto">Pronto</button></div></div></div>';
    }
    // fecha a caixa; com foco (Esc, "Pronto"), ele volta ao botão "Contratos"
    function fechaCaixa(foco) {
      st.ct = false;
      render();
      var b = foco && host.querySelector('[data-fid="ft:ct"]');
      if (b) { try { b.focus({ preventScroll: true }); } catch (e) { /* navegador antigo */ } }
    }
    // marcar ou desmarcar um contrato. A escolha que vale é a da tela (d.mostra): os guardados que ainda não chegaram não
    // contam aqui (aplicaFiltro os devolve). Sem escolha, marcar mostra só ele; desmarcar o último volta a "Tudo"
    function escolhidos() { var d = itens(); return d.escolha ? d.mostra.map(function (c) { return c.id; }) : null; }
    function marcar(id, on) {
      var s = (escolhidos() || []).filter(function (x) { return x !== id; });
      return on ? s.concat([id]) : s;
    }
    // nova escolha (null = Tudo): guarda no aparelho com os contratos que existem agora (os que chegarem depois são "novo").
    // Todos marcados continuam marcados (a escolha fica explícita; um contrato novo entra desmarcado). Os guardados que
    // ainda não chegaram do banco continuam na escolha. A faixa total passa a ser a dos escolhidos
    function aplicaFiltro(s) {
      var d = itens(), aqui = d.todos.map(function (c) { return c.id; });
      if (s && !s.length) s = null;
      if (s && d.escolha) filtro.sel.forEach(function (i) { if (aqui.indexOf(i) < 0 && s.indexOf(i) < 0) s.push(i); });
      filtro = { sel: s, vistos: aqui };
      selM = mapaDe(s); vistosM = mapaDe(aqui);
      gravarFiltro(FILTRO_KEY, filtro);
      cacheIt = null;
      F = faixaMostrada(itens());
    }
    function anuncio() { var d = itens(); return 'Mostrando ' + (d.ativo ? eLista(d.mostra.map(function (c) { return N.nome(c); })) : 'todos os contratos') + '.'; }
    // o filtro mudou: enquadra a união dos escolhidos (a faixa total, com folga) e o leitor de tela diz o que ficou
    function mudaFiltro(s) { aplicaFiltro(s); st.k0 = null; render(); avisa(anuncio()); }

    function resultados() {
      var q = (st.q || '').trim();
      if (!q) return '';
      var d = itens();
      // km como no mapa: "794,5", "km 794,5", "1.006,9" ou estaca "794+500"
      var t = q.replace(/\s/g, '').replace(/^km/i, ''), est = /^(\d+)\+(\d{1,3})$/.exec(t);
      if (!est && t.indexOf(',') >= 0) t = t.replace(/\./g, '').replace(',', '.');
      var out = [], kmB = [], n = est ? Number(est[1]) + Number(est[2]) / 1000 : Number(t);
      if (t && isFinite(n) && /\d/.test(q)) {
        // fora do trecho dos contratos escolhidos (sem a folga do desenho; nenhum deles com km conta como fora), mas no
        // trecho dos outros: mostra todos e vai ao km
        var FT = d.ativo ? faixaTotal(d.todos, d.fx, W) : F, U = d.ativo ? envoltoria(d.mostra, d.fx) : F;
        if (U && n >= U[0] && n <= U[1]) kmB.push('<button type="button" data-vg="km" data-km="' + n + '">Ir ao km ' + nf(n, n % 1 ? 2 : 0) + '</button>');
        else if (n >= FT[0] && n <= FT[1]) kmB.push('<button type="button" data-vg="kmtodos" data-km="' + n + '">Mostrar todos e ir ao km ' + nf(n, n % 1 ? 2 : 0) + '</button>');
        else kmB.push('<span class="vg-res-n">O desenho vai do km ' + nf(FT[0], 0) + ' ao km ' + nf(FT[1], 0) + '.</span>');
      }
      // o nº de um contrato ("315", sem "km"): os pontos dele vêm antes do botão de km (o Enter escolhe o primeiro)
      var ehCt = /^\d+$/.test(q) && d.todos.some(function (c) { return N.numeroCurto(c) === String(Number(q)); });
      // nome: cada palavra em qualquer ordem ("Lote 02 P1", "315 P1", "proarte"), sem ligar para acento; procura em todos
      // os contratos, também nos fora do filtro. Ordem: nome igual a um termo (2) e termo que é parte do nome do contrato
      // ou o nº curto dele (1) valem mais; o nome igual ao digitado vem primeiro
      var ql = semAc(q), termos = ql.split(/\s+/).filter(Boolean), max = 6;
      // "lote 02" ou "lote 2" filtra pelo número do lote da licitação (o "02" do nº do contrato não traz o outro lote; o
      // "CT 424 · OAEs" do 424 não é lote); os outros termos continuam livres. Se nenhum contrato tem esse lote, vale como texto comum
      var lm = /(?:^|\s)lote\s*0*(\d+)(?=\s|$)/.exec(ql), nl = lm ? Number(lm[1]) : null;
      var nLote = function (c) { var m = /\d+/.exec(N.loteReal(c)); return m ? Number(m[0]) : null; };
      if (nl != null && d.todos.some(function (c) { return nLote(c) === nl; })) termos = ql.replace(lm[0], ' ').split(/\s+/).filter(Boolean); else nl = null;
      // texto de cada contrato para a busca, uma vez por busca: Lote, nº, nome de tela e nome formal (String(): lote ou nº
      // numérico, de backup ou do banco, não pode quebrar a busca)
      var txt = {};
      d.todos.forEach(function (c) { txt[c.id] = semAc([c.lote, c.numero, N.nome(c), N.formal(c), N.tipo(c) === 'oae' ? 'pontes' : ''].map(function (v) { return v == null ? '' : String(v); }).join(' ')); });
      function nota(x) {
        var nome = semAc(x.p.nome), cod = semAc(x.p.codigo), ctw = txt[x.c.id].split(/\s+/), ct = N.numeroCurto(x.c);
        return termos.reduce(function (t, w) { return t + (w === nome || w === cod || ql === nome || ql === cod ? 2 : ctw.indexOf(w) >= 0 || w === ct ? 1 : 0); }, 0);
      }
      var ach = d.lista.filter(function (x) {
        if (nl != null && nLote(x.c) !== nl) return false;
        var s = semAc((x.p.nome || '') + ' ' + (x.p.codigo || '')) + ' ' + txt[x.c.id];
        return termos.every(function (w) { return s.indexOf(w) >= 0; });
      }).map(function (x) { return { x: x, n: nota(x) }; }).sort(function (a, b) { return b.n - a.n || b.x.on - a.x.on || a.x.km - b.x.km; }).map(function (r) { return r.x; });
      // resultado de contrato fora do filtro (no mesmo peso, depois dos de dentro): "· fora do filtro"; ao escolher, o
      // contrato entra no filtro
      ach.slice(0, max).forEach(function (x) {
        out.push('<button type="button" data-vg="achar" data-key="' + esc(x.key) + '">' + esc(N.nome(x.c) + ' · ' + (x.p.nome || '?') + (x.p.codigo ? ' · ' + x.p.codigo : '') + ' · km ' + nf(x.km, 2)) +
          (x.on ? '' : '<span class="vg-res-f"> · fora do filtro</span>') + '</button>');
      });
      if (ach.length > max) out.push('<span class="vg-res-n">e mais ' + (ach.length - max) + '; digite também o número do contrato</span>');
      out = ehCt && ach.length ? out.concat(kmB) : kmB.concat(out);
      return out.length ? out.join('') : '<span class="vg-res-n">Nada encontrado.</span>';
    }
    // pre: o que o leitor de tela diz antes (o contrato que entrou no filtro); baixo: veio da busca ou da lista, embaixo
    // do desenho (no computador, o cartão que abriu lá em cima vem à vista)
    function mostrar(x, pre, baixo) {
      // escolhido fora da tela: centraliza nele, mantendo o zoom
      if (x.kf < st.k0 || x.km > st.k1) { var R = st.k1 - st.k0, m = (x.km + x.kf) / 2, r = lim(m - R / 2, m + R / 2); st.k0 = r[0]; st.k1 = r[1]; }
      if (st.sel !== x.key) st.mais = null;
      st.sel = x.key;
      render();
      avisa((pre || '') + String(x.p.nome || x.p.codigo || 'Ponto') + ', km ' + nf(x.km, 2) + ', ' + x.st + '. Cartão aberto.');
      if (cel()) enquadrar(); else if (baixo) verTopo(host.querySelector('.vg-card'));
    }
    // fecha o cartão. Com o foco no cartão, solto na página ou no marcador do próprio ponto, ele vai ao marcador do ponto
    // (ou ao grupo que o contém, ou à linha da lista; senão, ao desenho). Num controle de fora do cartão (busca, filtro,
    // enquadrar, grupo, outro marcador), fica onde está: o render() o devolve ao mesmo controle
    function fechar() {
      var k = st.sel, ae = document.activeElement;
      var mover = !ae || ae === document.body || (host.contains(ae) && !!ae.closest && (!!ae.closest('.vg-card') || (ae.classList.contains('vg-mk') && ae.dataset.key === k)));
      st.sel = null; st.mais = null; render();
      if (!mover || !k) return;
      var q = '[data-vg="sel"][data-key="' + cssEsc(k) + '"]';
      // no grupo do mesmo km, o data-key é o próximo item, não o que estava aberto: acha o grupo pelo grupoDe do desenho
      var m = host.querySelector('.vg-mk' + q) || (grupoDe[k] && host.querySelector('[data-fid="' + cssEsc(grupoDe[k]) + '"]')) || host.querySelector(q) || host.querySelector('.vg-diag');
      if (m) { try { m.focus({ preventScroll: true }); } catch (e) { /* navegador antigo */ } }
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
    // computador: o desenho e o cartão ficam em cima, e a busca, a lista e os cartões dos contratos embaixo. A ação feita lá
    // embaixo rola até o topo do desenho ou do cartão só se ele passou para cima da tela (o html{scroll-padding-top}
    // desconta a barra do topo); à vista, não rola
    function verTopo(el) {
      var tb = document.querySelector('.topbar'), topo = tb ? tb.getBoundingClientRect().bottom : 0;
      if (el && el.scrollIntoView && el.getBoundingClientRect().top < topo) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
    // o desenho mudou por uma ação lá de baixo ("Ver no desenho", "Ir ao km", "Mostrar todos"): ele vem à vista
    function verDesenho() { if (cel()) enquadrar(); else verTopo(host.querySelector('.vg-diag')); }
    // a caixa abriu passando do pé da tela (tela baixa, como o celular deitado): rola até ela aparecer; se não cabe, o topo
    // dela fica logo abaixo da barra do topo. À vista, não rola
    function verCaixa() {
      var p = host.querySelector('.vg-pnl');
      if (p && p.scrollIntoView && p.getBoundingClientRect().bottom > window.innerHeight) p.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    // dedo (pointer: coarse): um toque até 12 px de um marcador conta nele, sem mudar o desenho em escala.
    // O toque no corpo de um marcador nem chega aqui; entre vizinhos, ganha o mais perto
    function perto(e) {
      var tk = e.target.closest('.vg-lane .vg-trk'), m0 = null, d0 = 12;
      if (!tk || !(window.matchMedia && window.matchMedia('(pointer: coarse)').matches)) return null;
      Array.prototype.forEach.call(tk.querySelectorAll('.vg-mk'), function (mk) {
        var r = mk.getBoundingClientRect(), dd = Math.max(r.left - e.clientX, e.clientX - r.right, r.top - e.clientY, e.clientY - r.bottom);
        if (dd < d0) { d0 = dd; m0 = mk; }
      });
      return m0;
    }
    host.addEventListener('click', seguro(function (e) {
      var b = e.target.closest('[data-vg]') || perto(e);
      if (!b || Date.now() < semClique) return;
      // Enter ou Espaço (o clique do teclado não tem "detail") abrindo o cartão: o foco entra nele, no ×
      var a = b.dataset.vg, R = st.k1 - st.k0, m = (st.k0 + st.k1) / 2, x, tecl = e.detail === 0 && !st.sel;
      // dedo ou caneta (o tipo vem no clique, senão do pointerdown; sem nenhum dos dois, pela tela de toque): vale
      // para os render() deste clique
      var tipo = e.pointerType || ptrTipo || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches ? 'touch' : '');
      toque = e.detail !== 0 && /touch|pen/.test(tipo);
      // no computador o cartão fica no fluxo, acima da lista: rola só o necessário para o × ficar à vista
      // (o html{scroll-padding-top} desconta a barra do topo); no celular a folha é fixa e o enquadrar() cuida do desenho
      var focoX = function () {
        var bx = tecl && host.querySelector('.vg-card .vg-x'), cd = bx && host.querySelector('.vg-card');
        if (bx) { try { bx.focus({ preventScroll: true }); if (!cel() && cd.scrollIntoView) cd.scrollIntoView({ block: 'nearest' }); } catch (er) { /* navegador antigo */ } }
      };
      // veio de baixo do desenho (busca, lista, cartões dos contratos, "fora do filtro"): o resultado aparece lá em cima
      var baixo = !b.closest('.vg-meio');
      if (a === 'ir') { ir(Number(b.dataset.a), Number(b.dataset.b)); if (baixo) verDesenho(); }   // "Ver no desenho" dos cartões
      else if (a === 'tudo') { st.k0 = null; render(); }
      else if (a === 'mais') ir(m - R / 4, m + R / 4);
      else if (a === 'menos') ir(m - R, m + R);
      else if (a === 'esq') ir(st.k0 - R * 0.4, st.k1 - R * 0.4);
      else if (a === 'dir') ir(st.k0 + R * 0.4, st.k1 + R * 0.4);
      else if (a === 'chip') { st.off[b.dataset.fk] = !st.off[b.dataset.fk]; render(); }
      // "Tudo": limpa a escolha e fecha a caixa; sem escolha (só com zoom), enquadra tudo. "Contratos" abre ou fecha a
      // caixa; "Mostrar todos" (na caixa e embaixo dos cartões) limpa a escolha. As marcações vêm pelo 'change'
      else if (a === 'ftudo') { st.ct = false; if (filtro.sel) mudaFiltro(null); else { st.k0 = null; render(); } }
      else if (a === 'painel') { st.ct = !st.ct; render(); if (st.ct) verCaixa(); }
      else if (a === 'pronto') fechaCaixa(true);
      else if (a === 'ftodos') { mudaFiltro(null); if (baixo) verDesenho(); }
      else if (a === 'fechar') fechar();
      // o grupo no mesmo km passa pelos itens um a um: o foco fica nele
      else if (a === 'sel') { x = achar(b.dataset.key); if (x) { if (st.sel === x.key && b.classList.contains('vg-mk')) fechar(); else { mostrar(x, '', baixo); if (!b.classList.contains('grupo')) focoX(); } } }
      else if (a === 'km' || a === 'kmtodos') {
        // km fora dos contratos escolhidos: antes mostra todos
        if (a === 'kmtodos') aplicaFiltro(null);
        var k = Number(b.dataset.km), d = Math.min(6, (F[1] - F[0]) / 2);
        st.q = ''; ir(k - d, k + d);
        if (a === 'kmtodos') avisa(anuncio());
        verDesenho();
      } else if (a === 'achar') {
        x = achar(b.dataset.key);
        // o achado aparece no desenho mesmo com a situação dele desligada nos filtros: religa aquele filtro.
        // Contrato fora do filtro: é marcado (a faixa total muda antes de enquadrar o ponto); se com ele ficam todos
        // marcados, o leitor de tela diz que mostra todos
        var pre = '';
        if (x && !x.on) {
          aplicaFiltro(marcar(x.c.id, true));
          pre = itens().ativo ? N.nome(x.c) + ' entrou no filtro. ' : 'Mostrando todos os contratos. ';
          x = achar(b.dataset.key);
        }
        if (x) { var pd = Math.max(2, (x.kf - x.km) * 3), r = lim(x.km - pd, x.kf + pd); st.q = ''; st.k0 = r[0]; st.k1 = r[1]; delete st.off[x.fk]; mostrar(x, pre, baixo); focoX(); }
      } else if (a === 'abrir' || a === 'mapa' || a === 'fotos') {
        x = st.sel ? achar(st.sel) : null;
        if (x) (a === 'abrir' ? o.onAbrir : a === 'mapa' ? o.onMapa : o.onFotos)(x.c, x.p);
      } else if (a === 'ct') {
        o.contratos().forEach(function (c) { if (c.id === b.dataset.cid) o.onAbrir(c, null); });
      }
      toque = false;
    }));
    // busca: atualiza só a lista de resultados, para não perder o foco do campo
    host.addEventListener('input', seguro(function (e) {
      if (e.target.id !== 'vgBusca') return;
      st.q = e.target.value;
      var r = host.querySelector('#vgRes');
      if (r) r.innerHTML = resultados();
    }));
    // marcação da caixa "Contratos": vale na hora (filtra e enquadra); a caixa continua aberta
    host.addEventListener('change', seguro(function (e) {
      var id = e.target.dataset && e.target.dataset.ck;
      if (id) mudaFiltro(marcar(id, !!e.target.checked));
    }));
    host.addEventListener('keydown', function (e) {
      if (e.target.id === 'vgBusca' && e.key === 'Enter') { var f = host.querySelector('#vgRes button'); if (f) { e.preventDefault(); f.click(); } }
    });
    // Esc fecha a caixa "Contratos" (o foco volta ao botão) ou, sem ela, o cartão; com o foco na visão ou solto na página
    // (depois de um redesenho)
    document.addEventListener('keydown', seguro(function (e) {
      if (e.key !== 'Escape' || !(st.ct || st.sel) || !host.offsetParent) return;
      var a = document.activeElement;
      if (a && a !== document.body && !host.contains(a)) return;
      if (st.ct) fechaCaixa(true); else fechar();
    }));
    // caixa aberta: um toque ou clique fora dela só a fecha (não abre um ponto nem mexe no desenho; fora da visão, como
    // nas abas do topo, o clique segue). O fim de um arrasto não conta. A captura vem antes do clique do host
    document.addEventListener('pointerdown', function () { ptrEm = Date.now(); }, true);
    document.addEventListener('click', seguro(function (e) {
      if (!st.ct || !host.offsetParent || Date.now() < semClique) return;
      var t = e.target, dentro = host.contains(t);
      if (dentro && t.closest && t.closest('.vg-ctw')) return;
      if (dentro) { e.preventDefault(); e.stopPropagation(); }
      st.ct = false;
      render();
    }), true);
    // o teclado (Tab) saiu da caixa e do botão: ela fecha. Só conta o foco que veio de dentro deles (relatedTarget): a
    // janela que volta a ter foco o devolve a um controle de fora (ex.: o × do cartão) sem a pessoa sair da caixa. O foco
    // que segue um toque ou clique (tratado acima) e o que o render() devolve também não contam
    document.addEventListener('focusin', seguro(function (e) {
      if (!st.ct || refoco || Date.now() - ptrEm < 1000 || !host.offsetParent) return;
      var t = e.target, de = e.relatedTarget, naCaixa = function (x) { return !!x && host.contains(x) && !!x.closest && !!x.closest('.vg-ctw'); };
      if (naCaixa(t) || !naCaixa(de)) return;
      st.ct = false;
      render();
    }));
    // abrir ou fechar "Serviços" vale para os redesenhos seguintes do mesmo ponto ('toggle' não sobe: captura)
    host.addEventListener('toggle', function (e) {
      if (e.target.classList && e.target.classList.contains('vg-mais')) { st.mais = e.target.open; folga(); }
    }, true);
    // arrastar para os lados; dois dedos aproximam ou afastam (pinça)
    function kmEm(clientX) { var tk = trk(), r = tk ? tk.getBoundingClientRect() : null; return r ? st.k0 + (clientX - r.left) / r.width * (st.k1 - st.k0) : (st.k0 + st.k1) / 2; }
    function fracEm(clientX) { var tk = trk(), r = tk ? tk.getBoundingClientRect() : null; return r ? (clientX - r.left) / r.width : 0.5; }
    host.addEventListener('pointerdown', function (e) {
      ptrTipo = e.pointerType || '';   // para o clique que vem depois (nem todo navegador põe o tipo no clique)
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
      rt = setTimeout(seguro(function () { var w = host.clientWidth; if (host.offsetParent && w && w !== ultW) render(); else folga(); }), 120);
    });
    // saiu da visão (o app esconde o host: contrato, mapa, abas do topo): o aviso do cartão não fica para trás na página
    // e a caixa "Contratos" volta fechada
    if (window.MutationObserver) new window.MutationObserver(function () { if (host.hidden) { avisa(''); st.ct = false; } }).observe(host, { attributes: true, attributeFilter: ['hidden'] });

    return { render: render };
  }

  window.VisaoGeral = VisaoGeral;
})();
