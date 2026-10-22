/* Medições por MP (fase 5, decisão D-15 de 22/10/2026). Cada medição (MP) fica separada no banco, com as suas versões;
 * o que é do contrato inteiro (catálogo de serviços, segmentos, notas, ficha do SIAC, alertas que comparam várias MPs)
 * fica na "base". A análise que as telas usam (o mesmo formato da carga antiga) é montada aqui, somando as MPs.
 *
 *   separar(dados, ocorr) -> { base, mps: { '<n>': { dados, ocorr } } }   arquivo do contrato inteiro em partes
 *   montar(base, mps)     -> dados                                       mps = [{ n, dados }] (só as versões atuais)
 *   juntarBase(base, mp)  -> base                                        catálogo e serviços novos que a MP trouxe
 *
 * Por MP: a linha da medição, o SIAC dela, porMedicao, semLocal, cobertura, memória, desempenho, os alertas da MP,
 * em cada ponto/segmento as quantidades e valores de cada serviço, o total do mês (como veio do gerador, sem
 * arredondar de novo) e, no 424, os itens; e as ocorrências km a km.
 * Calculado: totais por serviço (q, v, meds), meses, tot e grupos de cada ponto e o resumo (total, n, comValor, de, ate,
 * localizado). Na base: o resto, inclusive o que compara várias MPs (no 424: aa, al, mx, est, gar, alertas por ponte,
 * "altos" e os totais de alertas do resumo), que o gerador refaz quando chega MP nova. */
(function (raiz) {
  'use strict';
  var TOPO_MP = ['porMedicao', 'semLocal', 'cobertura', 'memorias', 'desempenho'];   // { '<n>': ... } no arquivo
  var RESUMO_CALC = ['total', 'n', 'comValor', 'de', 'ate', 'localizado'];
  var SERV_CALC = ['q', 'v', 'meds', 'por'];
  var PONTE_CALC = ['servicos', 'meses', 'tot', 'grupos', 'itens'];
  var GRUPO_CALC = ['valor', 'ult', 'n'];

  function chave(s) { return (s.id || s.cod || '') + '|' + s.nome; }
  function r2(x) { return Math.round(x * 100) / 100; }
  function r6(x) { return Math.round(x * 1e6) / 1e6; }
  function sem(o, tira) { var r = {}; Object.keys(o).forEach(function (k) { if (tira.indexOf(k) < 0) r[k] = o[k]; }); return r; }
  function so(o, fica) { var r = {}; fica.forEach(function (k) { if (o[k] !== undefined) r[k] = o[k]; }); return r; }
  function nOrd(a, b) { return a - b; }

  function separar(dados, ocorr) {
    var d = dados, base = sem(d, ['medicoes', 'alertas', 'resumo', 'pontes', 'siac', 'sobre', 'marcas'].concat(TOPO_MP));
    base.topo = TOPO_MP.filter(function (k) { return d[k] && typeof d[k] === 'object'; });
    base.resumoChaves = d.resumo ? RESUMO_CALC.filter(function (k) { return d.resumo[k] !== undefined; }) : [];
    if (d.resumo) base.resumoExtra = sem(d.resumo, RESUMO_CALC);
    if (d.alertas) base.temAlertas = true;
    if (d.siac) base.siac = sem(d.siac, ['medicoes']);
    base.pontes = {};
    var mps = {};
    (d.medicoes || []).forEach(function (m) {
      var n = String(m.n), x = { med: m };
      if (d.siac && d.siac.medicoes && d.siac.medicoes[n] !== undefined) x.siac = d.siac.medicoes[n];
      TOPO_MP.forEach(function (k) { if (d[k] && d[k][n] !== undefined) x[k] = d[k][n]; });
      if (d.alertas) x.alertas = d.alertas.filter(function (a) { return String(a.n) === n; });
      x.pontes = {}; x.serv = {};
      mps[n] = { dados: x, ocorr: [] };
    });
    Object.keys(d.pontes || {}).forEach(function (pid) {
      var p = d.pontes[pid], b = sem(p, PONTE_CALC);
      b.serv = (p.servicos || []).map(function (s) {
        var m = sem(s, SERV_CALC);
        if (!s.por) { m.semPor = true; m.q = s.q; m.v = s.v; m.meds = s.meds; }
        return m;
      });
      var gx = {};
      Object.keys(p.grupos || {}).forEach(function (g) { var e = sem(p.grupos[g], GRUPO_CALC); if (Object.keys(e).length) gx[g] = e; });
      if (Object.keys(gx).length) b.gruposExtra = gx;
      if (p.itens) b.temItens = true;
      base.pontes[pid] = b;
      (p.servicos || []).forEach(function (s) {
        Object.keys(s.por || {}).forEach(function (n) {
          var mp = mps[n];
          if (!mp) throw new Error('serviço na medição ' + n + ', que não está na lista de medições (' + pid + ')');
          var x = mp.dados.pontes[pid] || (mp.dados.pontes[pid] = { s: [] });
          x.s.push([chave(s), s.por[n][0], s.por[n][1]]);
          mp.dados.serv[chave(s)] = sem(s, SERV_CALC);
        });
      });
      Object.keys(p.meses || {}).forEach(function (n) {
        if (!mps[n]) throw new Error('mês ' + n + ' sem medição (' + pid + ')');
        (mps[n].dados.pontes[pid] || (mps[n].dados.pontes[pid] = { s: [] })).m = p.meses[n];
      });
      Object.keys(p.itens || {}).forEach(function (n) {
        if (!mps[n]) throw new Error('itens da medição ' + n + ' sem medição (' + pid + ')');
        (mps[n].dados.pontes[pid] || (mps[n].dados.pontes[pid] = { s: [] })).it = p.itens[n];
      });
    });
    (ocorr || []).forEach(function (o) {
      var mp = mps[String(o[0])];
      if (!mp) throw new Error('ocorrência da medição ' + o[0] + ', que não está na lista de medições');
      mp.ocorr.push(o);
    });
    return { base: base, mps: mps };
  }

  // lista = [{ n, dados }] das versões atuais, em qualquer ordem
  function montar(base, lista) {
    var b = base, mps = lista.slice().sort(function (u, w) { return u.n - w.n; }), d = sem(b, ['topo', 'resumoChaves', 'resumoExtra', 'temAlertas', 'siac', 'pontes']);
    d.medicoes = mps.map(function (x) { return x.dados.med; });
    (b.topo || []).forEach(function (k) {
      d[k] = {};
      mps.forEach(function (x) { if (x.dados[k] !== undefined) d[k][String(x.n)] = x.dados[k]; });
    });
    if (b.temAlertas) d.alertas = [].concat.apply([], mps.map(function (x) { return x.dados.alertas || []; }));
    if (b.siac) {
      d.siac = sem(b.siac, []);
      if (mps.some(function (x) { return x.dados.siac !== undefined; })) {
        d.siac.medicoes = {};
        mps.forEach(function (x) { if (x.dados.siac !== undefined) d.siac.medicoes[String(x.n)] = x.dados.siac; });
      }
    }
    d.pontes = {};
    Object.keys(b.pontes || {}).forEach(function (pid) {
      var bp = b.pontes[pid], p = sem(bp, ['serv', 'gruposExtra', 'temItens']), por = {}, meta = {}, ordem = [], meses = {}, itens = {};
      (bp.serv || []).forEach(function (s) { var k = chave(s); meta[k] = s; ordem.push(k); });
      mps.forEach(function (x) {
        var e = x.dados.pontes && x.dados.pontes[pid], n = String(x.n);
        if (!e) return;
        (e.s || []).forEach(function (t) {
          if (!meta[t[0]]) { meta[t[0]] = (x.dados.serv && x.dados.serv[t[0]]) || { nome: t[0].split('|').slice(1).join('|') }; ordem.push(t[0]); }
          (por[t[0]] || (por[t[0]] = {}))[n] = [t[1], t[2]];
        });
        if (e.m !== undefined) meses[n] = e.m;
        if (e.it !== undefined) itens[n] = e.it;
      });
      var grupos = {};
      p.servicos = [];
      ordem.forEach(function (k) {
        var s = meta[k], pk = por[k];
        if (!pk) {
          if (s.semPor) { var z = sem(s, ['semPor']); p.servicos.push(z); }
          return;
        }
        var ns = Object.keys(pk).map(Number).sort(nOrd), q = 0, v = 0, po = {};
        ns.forEach(function (n) { po[n] = pk[n]; q += pk[n][0]; v += pk[n][1]; });
        var o = sem(s, ['semPor', 'q', 'v', 'meds']);
        o.q = r6(q); o.v = r2(v); o.meds = ns.map(function (n) { return n + 'ª'; }).join(', '); o.por = po;
        p.servicos.push(o);
        var g = grupos[s.g] || (grupos[s.g] = { valor: 0, ult: 0, ns: {} });
        ns.forEach(function (n) { g.valor += pk[n][1]; g.ns[n] = 1; if (n > g.ult) g.ult = n; });
      });
      p.meses = meses;
      p.tot = r2(Object.keys(meses).reduce(function (t, n) { return t + meses[n]; }, 0));
      p.grupos = {};
      Object.keys(grupos).forEach(function (k) {
        var g = grupos[k], o = { valor: r2(g.valor), ult: g.ult, n: Object.keys(g.ns).length };
        var ex = bp.gruposExtra && bp.gruposExtra[k];
        if (ex) Object.keys(ex).forEach(function (c) { o[c] = ex[c]; });
        p.grupos[k] = o;
      });
      if (bp.temItens) p.itens = itens;
      d.pontes[pid] = p;
    });
    if (b.resumoChaves && (b.resumoChaves.length || b.resumoExtra)) {
      var r = {}, ms = d.medicoes, ch = b.resumoChaves;
      if (ch.indexOf('total') >= 0) r.total = r2(ms.reduce(function (t, m) { return t + (m.total || 0); }, 0));
      if (ch.indexOf('n') >= 0) r.n = ms.length;
      if (ch.indexOf('comValor') >= 0) r.comValor = ms.filter(function (m) { return m.total > 0; }).length;
      if (ch.indexOf('de') >= 0) r.de = ms.length ? ms[0].mes : null;
      if (ch.indexOf('ate') >= 0) r.ate = ms.length ? ms[ms.length - 1].mes : null;
      if (ch.indexOf('localizado') >= 0) r.localizado = r2(Object.keys(d.cobertura || {}).reduce(function (t, n) { return t + ((d.cobertura[n] || [])[0] || 0); }, 0));
      Object.keys(b.resumoExtra || {}).forEach(function (k) { r[k] = b.resumoExtra[k]; });
      d.resumo = r;
    }
    return d;
  }

  // a MP nova (ou retificada) pode trazer serviço que a base ainda não tem: entra no fim da lista do ponto e do catálogo
  function juntarBase(base, mp, catalogo) {
    var b = JSON.parse(JSON.stringify(base));
    Object.keys(mp.pontes || {}).forEach(function (pid) {
      var bp = b.pontes[pid] || (b.pontes[pid] = { serv: [] }), tem = {};
      (bp.serv || (bp.serv = [])).forEach(function (s) { tem[chave(s)] = 1; });
      (mp.pontes[pid].s || []).forEach(function (t) {
        if (tem[t[0]]) return;
        tem[t[0]] = 1;
        bp.serv.push((mp.serv && mp.serv[t[0]]) || { nome: t[0].split('|').slice(1).join('|') });
      });
    });
    if (Array.isArray(catalogo) && Array.isArray(b.servicos)) {
      var ja = {};
      b.servicos.forEach(function (s) { ja[s.id || s.cod] = 1; });
      catalogo.forEach(function (s) { if (!ja[s.id || s.cod]) { ja[s.id || s.cod] = 1; b.servicos.push(s); } });
    }
    return b;
  }

  var api = { separar: separar, montar: montar, juntarBase: juntarBase, chave: chave };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.MedMP = api;
})(typeof window !== 'undefined' ? window : this);
