/* Medições dos contratos: só na tela, com a análise e o acesso fornecidos pelo app.
 * Os resumos ficam por contrato; serviços e locais são montados só para a medição aberta.
 * Nenhuma leitura ou gravação de banco aqui (carregarAnalise continua no app.js).
 */
(function () {
  'use strict';

  window.Medicoes = function (op) {
    var host = op.host, esc = op.esc, fmtN = op.fmtN, dinheiro = op.dinheiro;
    var cache = {}, cid = '', med = null, modo = 'contrato', aba = 'grupos', zeradas = false, semValor = false;
    var segAberto = '', segTodas = false, segServ = false, segSem = null, segOrdem = 'km';
    var etapas = {}, grupo = null, busca = '', ordem = 'km', mesSel = null, janela = null, fila = false, geracao = 0, resumoCel = false, matrizScroll = null;
    var meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

    function numero(v) { return v == null || v === '' || !isFinite(Number(v)) ? null : Number(v); }
    function valor(v) { return numero(v) || 0; }
    function idx(ref) {
      var m = /^(\d{4})-(\d{2})(?:-|$)/.exec(String(ref || ''));
      return m && Number(m[2]) >= 1 && Number(m[2]) <= 12 ? Number(m[1]) * 12 + Number(m[2]) - 1 : null;
    }
    function mesTxt(i) { return i == null ? 'competência não informada' : meses[i % 12] + '/' + String(Math.floor(i / 12)).slice(-2); }
    function hoje() { var d = new Date(); return d.getFullYear() * 12 + d.getMonth(); }
    function pct(v) { return fmtN(v) + '%'; }
    function nMed(n) { return n + (n === 1 ? ' medição' : ' medições'); }
    function largura(v) { return Math.max(0, Math.min(100, valor(v))).toFixed(2); }
    function nome(c) {
      var n = /^\s*(?:CT\s*)?(?:\d{2}\s+)?0*(\d+)(\/\d{4})?\s*$/i.exec(String(c.numero || ''));
      return n ? 'CT ' + Number(n[1]) + (n[2] || '') : op.nome(c);
    }
    function decimal(v, casas) { return Number(v).toFixed(casas).replace('.', ','); }
    function pctCurto(v) { return decimal(v, 1) + '%'; }
    function compacto(v) {
      return Math.abs(v) >= 1000000 ? 'R$ ' + decimal(v / 1000000, 2) + ' mi' : Math.abs(v) >= 1000 ? 'R$ ' + decimal(v / 1000, 1) + ' mil' : dinheiro(v);
    }
    function moeda(v, sufixo) {
      var completo = dinheiro(v) + (sufixo || '');
      return '<span title="' + esc(completo) + '" aria-label="' + esc(completo) + '">' + esc(compacto(v) + (sufixo || '')) + '</span>';
    }
    function tipoCurto(c) { return c.tipo === 'oae' ? 'OAEs' : c.tipo === 'conserva' ? 'conservação' : 'pontos críticos'; }
    function tipo(c) { return c.tipo === 'oae' ? 'Pontes (OAEs)' : c.tipo === 'conserva' ? 'Conservação' + (c.superficie === 'pavimentada' ? ' · pista pavimentada' : ' · revestimento primário') : 'Pontos críticos'; }
    function faixa(c) { return [c.lote, c.kmIni != null && c.kmFim != null ? 'km ' + fmtN(c.kmIni) + ' a ' + fmtN(c.kmFim) : ''].filter(Boolean).join(' · '); }
    function botao(act, txt, attrs, cls) { return '<button type="button" class="btn' + (cls ? ' ' + cls : '') + '" data-md="' + act + '"' + (attrs || '') + '>' + txt + '</button>'; }
    function vazio(txt) { return '<p class="md-vazio">' + esc(txt) + '</p>'; }
    function permitidos() { return op.contratos().filter(function (c) { return op.pode(c); }); }
    function contrato(id) { var r = null; permitidos().forEach(function (c) { if (c.id === id) r = c; }); return r; }
    function dado(c) {
      if (!c || !op.pode(c)) return null;
      var raw = op.base(c), cad = JSON.stringify([c.valores, c.prazos]), x = cache[c.id];
      if (!raw) { delete cache[c.id]; return null; }
      if (x && x.raw === raw && x.cad === cad) return x;
      var an = op.analise(c);
      if (!an) return null;
      var ms = (an.medicoes || []).slice().sort(function (a, b) { return (idx(a.ref) || 0) - (idx(b.ref) || 0) || a.n - b.n; });
      var porMes = {}, total = 0, comValor = 0, max = 0;
      ms.forEach(function (m) {
        total += valor(m.total); if (valor(m.total) !== 0) comValor++;
        max = Math.max(max, Math.abs(valor(m.total)));
        var i = idx(m.ref);
        if (i == null) return;
        if (!porMes[i]) porMes[i] = { total: 0, ms: [] };
        porMes[i].total += valor(m.total); porMes[i].ms.push(m);
      });
      var siac = an.siac || null, pi = siac && siac.ficha ? numero(siac.ficha.pi_vigente) : null, base = 'PI vigente (SIAC)';
      // item do cadastro marcado como base (base: true, ex.: PI com um TA que o SIAC ainda não registrou) vale antes do SIAC
      var marcado = (c.valores || []).filter(function (v) { return v && v.base === true && numero(v.valor) != null; });
      if (marcado.length) { var vb = marcado[marcado.length - 1]; pi = numero(vb.valor); base = String(vb.rotulo || 'PI') + ' (cadastro' + (vb.sit === 'conf' ? '' : ', previsto') + ')'; }
      if (pi == null) {
        ['pi vigente', 'pi inicial'].some(function (rotulo) {
          var vs = (c.valores || []).filter(function (v) { return String(v.rotulo || '').trim().toLowerCase() === rotulo && numero(v.valor) != null; });
          if (!vs.length) return false;
          pi = numero(vs[vs.length - 1].valor); base = rotulo === 'pi vigente' ? 'PI vigente (cadastro)' : 'PI inicial (cadastro)'; return true;
        });
      }
      var fim = null;
      (c.prazos || []).forEach(function (p) { var i = idx(p.data); if ((p.fim === 'exec' || p.fim === 'ambos') && i != null && (fim == null || i > fim)) fim = i; });
      if (fim == null && siac && siac.ficha) fim = idx(siac.ficha.termino_execucao);
      var comps = Object.keys(porMes).map(Number).sort(function (a, b) { return a - b; }), ult = ms.length ? ms[ms.length - 1] : null;
      var seis = comps.slice(-6), ritmo = seis.length ? seis.reduce(function (s, i) { return s + porMes[i].total; }, 0) / seis.length : null;
      var ultima = ult ? idx(ult.ref) : null, proje = fim != null && ultima != null && ritmo != null ? total + ritmo * Math.max(0, fim - ultima) : null;
      var reaj = null, nReaj = 0;
      if (siac && siac.medicoes) Object.keys(siac.medicoes).forEach(function (n) {
        var v = numero(siac.medicoes[n].total); if (v != null) { reaj = (reaj || 0) + v; nReaj++; }
      });
      x = { raw: raw, cad: cad, an: an, ms: ms, porMes: porMes, comps: comps, total: total, comValor: comValor, max: max, ult: ult,
        pi: pi, base: base, fim: fim, ritmo: ritmo, seis: seis, ultima: ultima, proje: proje, reaj: reaj, nReaj: nReaj, detalhes: {}, indice: null };
      cache[c.id] = x;
      return x;
    }
    function baseTxt(d) { return d.pi != null && d.pi > 0 ? pct(d.total / d.pi * 100) + ' de ' + dinheiro(d.pi) + ' · ' + d.base : 'falta o PI' + (d.pi === 0 ? ' (base igual a zero)' : ''); }
    function projTxt(d, inteiro) {
      if (!d.ult) return 'Sem medições para projetar';
      if (!(d.pi > 0)) return 'Projeção: falta o PI';
      if (d.fim == null) return 'Projeção: falta o fim da execução';
      if (d.proje == null) return 'Projeção: falta a competência';
      if (d.proje > d.pi && d.ritmo > 0) return 'PI acaba por ' + mesTxt(d.ultima + Math.ceil(Math.max(0, d.pi - d.total) / d.ritmo)) + ' (prazo ' + mesTxt(d.fim) + ')';
      return (inteiro ? Math.round(d.proje / d.pi * 100) + '%' : pct(d.proje / d.pi * 100)) + ' do PI até ' + mesTxt(d.fim);
    }
    function ritmoTxt(d) { return d.ritmo == null ? 'Sem base' : dinheiro(d.ritmo) + '/mês · ' + d.seis.length + (d.seis.length === 1 ? ' competência, ' : ' competências, ') + mesTxt(d.seis[0]) + ' a ' + mesTxt(d.seis[d.seis.length - 1]); }
    function falta(d) {
      if (d.ultima == null) return 'Sem medição carregada';
      var n = Math.max(0, hoje() - 1 - d.ultima);
      return n ? 'Sem medição no SIAC desde ' + mesTxt(d.ultima) + ' (' + n + (n === 1 ? ' mês)' : ' meses)') : 'Em dia: medição de ' + mesTxt(d.ultima) + ' no SIAC';
    }
    function reajHtml(d) { return d.reaj == null ? '' : '<small title="' + esc('Com reajuste ' + dinheiro(d.reaj) + ' · totais de ' + nMed(d.nReaj) + ' no SIAC') + '">com reajuste ' + moeda(d.reaj) + ' (SIAC)</small>'; }
    function barra(d) {
      if (!(d.pi > 0)) return '';
      return '<span class="md-bar" role="img" aria-label="' + esc(baseTxt(d) + '; projeção: ' + projTxt(d)) + '"><i class="md-proj" style="width:' + largura(d.proje / d.pi * 100) + '%"></i><i style="width:' + largura(d.total / d.pi * 100) + '%"></i></span>';
    }
    function avisos(d, n) { return (d.an.alertas || []).filter(function (a) { return n == null || a.n == null || String(a.n) === String(n); }); }
    function estadoHtml(c) {
      var e = op.estado(c);
      if (e === 'erro') return vazio('Não foi possível atualizar a análise.') + botao('tentar', 'Tentar novamente', ' data-cid="' + esc(c.id) + '"');
      return vazio(e === 'carregando' || (!e && op.online()) ? 'Carregando medições…' : e === 'vazia' ? 'Ainda sem medições carregadas.' : 'Análise indisponível neste aparelho. Conecte-se para carregar.');
    }

    // uma leitura de cada vez. A próxima começa em outra tarefa, deixando a tela responder entre os contratos
    function carregar() {
      if (fila || !op.ativa()) return;
      var cs = permitidos(), pend = cs.filter(function (c) { return !op.estado(c) || op.estado(c) === 'carregando'; });
      if (!pend.length || !op.online()) return;
      fila = true;
      var jaLendo = pend.filter(function (c) { return op.estado(c) === 'carregando'; });
      var c = jaLendo[0] || pend[0], g = geracao;
      Promise.resolve(op.carregar(c)).then(terminou, terminou);
      function terminou() {
        fila = false;
        if (!op.ativa()) return;
        if (g !== geracao) { setTimeout(carregar, 0); return; }
        render();
        setTimeout(carregar, 0);
      }
    }
    function cabecalho(cs) {
      var carregados = cs.filter(function (c) { var d = dado(c); return d && d.ms.length; }).length;
      return '<div class="md-top"><div><h1>' + (modo === 'mes' ? 'Medições por mês' : 'Medições dos contratos') + '</h1><p>' + carregados + ' de ' + cs.length + ' contratos com medições carregadas. Valores a preços iniciais (PI).</p></div>' +
        '<div class="seg md-modo" role="group" aria-label="Organização">' + [['contrato', 'Por contrato'], ['mes', 'Por mês']].map(function (x) {
          return '<button type="button" data-md="modo" data-v="' + x[0] + '" aria-pressed="' + (modo === x[0]) + '">' + x[1] + '</button>';
        }).join('') + '</div></div>';
    }
    function cartao(c) {
      var d = dado(c), attrs = ' data-cid="' + esc(c.id) + '"';
      var h = '<article class="card md-card md-card-desktop"><div class="md-top"><div><h2>' + esc(nome(c)) + '</h2><small>' + esc(tipo(c)) + '</small><small>' + esc(faixa(c)) + '</small></div>';
      if (d && d.ult) h += '<div class="md-direita"><span class="md-label">Última medição</span><b>' + esc(d.ult.n + 'ª · ' + mesTxt(d.ultima)) + '</b><span>' + esc(dinheiro(d.ult.total)) + '</span></div>';
      h += '</div>';
      if (!d || !d.ms.length) h += d && !d.ms.length && op.estado(c) === 'ok' ? vazio('Ainda sem medições carregadas.') : estadoHtml(c);
      else {
        h += '<div><div class="md-medido"><span><b>' + moeda(d.total) + '</b> medido</span><span title="' + esc(d.base) + '">' + (d.pi != null ? 'de ' + moeda(d.pi) + ' (' + esc(d.base.replace(/ \(.+\)$/, '')) + ')' : 'falta o PI') + '</span></div>' + reajHtml(d) + barra(d) +
          '<div class="md-saldo"><b class="md-accent">' + esc(d.pi > 0 ? pctCurto(d.total / d.pi * 100) + ' executado' : 'falta o PI') + '</b><span>Saldo <b>' + (d.pi != null ? moeda(d.pi - d.total) : 'falta o PI') + '</b></span></div></div>';
        h += '<dl class="md-dl"><div><dt>Ritmo (últimos 6 meses)</dt><dd title="' + esc(ritmoTxt(d)) + '">' + (d.ritmo == null ? 'Sem base' : moeda(d.ritmo, '/mês')) + '</dd></div><div><dt>No ritmo atual</dt><dd title="' + esc(projTxt(d)) + '">' + esc(projTxt(d, true)) + '</dd></div>' +
          '<div><dt>Medições</dt><dd>' + d.ms.length + ' (' + d.comValor + ' com valor)</dd></div><div><dt>Avisos da leitura</dt><dd>' + avisos(d).length + '</dd></div></dl>' +
          '<div class="md-acoes"><small class="' + (d.ultima < hoje() - 1 ? 'md-aviso' : '') + '">' + esc(falta(d)) + '</small>' + botao('abrir', 'Abrir medições →', attrs) + '</div>';
        if (op.estado(c) === 'carregando') h += '<small role="status">Atualizando a análise…</small>';
        if (op.estado(c) === 'erro') h += estadoHtml(c);
      }
      h += '</article>';
      if (!d || !d.ms.length) return h.replace('md-card-desktop', 'md-card-estado');
      return h + '<button type="button" class="card md-card md-card-cel" data-md="abrir"' + attrs + ' aria-label="' + esc('Abrir medições de ' + nome(c) + '; última: ' + d.ult.n + 'ª · ' + mesTxt(d.ultima) + '; ' + baseTxt(d) + '; saldo: ' + (d.pi != null ? dinheiro(d.pi - d.total) : 'falta o PI') + '; ' + falta(d)) + '"><span class="md-cel-top"><b>' + esc(nome(c)) + '</b><span>Última: <b>' + esc(d.ult.n + 'ª · ' + mesTxt(d.ultima)) + '</b></span></span>' + barra(d) +
        '<span class="md-saldo"><b class="md-accent">' + esc(d.pi > 0 ? pctCurto(d.total / d.pi * 100) + ' executado' : 'falta o PI') + '</b><span>Saldo <b>' + (d.pi != null ? moeda(d.pi - d.total) : 'falta o PI') + '</b></span></span><span class="md-falta ' + (d.ultima < hoje() - 1 ? 'md-aviso' : '') + '">' + esc(falta(d)) + '</span></button>';
    }
    function semMedicoes(c) {
      var d = dado(c);
      return op.estado(c) !== 'carregando' && (d ? !d.ms.length : op.estado(c) === 'vazia');
    }
    function semMedicoesHtml(cs, pilulas) {
      var csSem = cs.filter(semMedicoes);
      return !csSem.length ? '' : '<div class="md-sem-med"><span>Ainda sem medições carregadas:</span> ' + (pilulas ? csSem.map(function (c) { return '<span class="md-sem-pill">' + esc(nome(c)) + '</span>'; }).join('') : esc(csSem.map(nome).join(', '))) + '</div>';
    }
    function inicioHtml(cs) {
      var soma = 0, n = 0, al = 0, ultTipos = {};
      cs.forEach(function (c) { var d = dado(c), t = tipoCurto(c); if (d && d.ms.length) { soma += d.total; n++; al += avisos(d).length; if (d.ultima != null && (ultTipos[t] == null || d.ultima > ultTipos[t])) ultTipos[t] = d.ultima; } });
      var ult = ['OAEs', 'conservação', 'pontos críticos'].filter(function (t) { return ultTipos[t] != null; }).map(function (t) { return mesTxt(ultTipos[t]) + ' ' + t; }).join(' · ');
      var h = cabecalho(cs) + '<div class="md-filtros"><label class="md-busca">Buscar serviço<input type="search" id="mdBusca" placeholder="Nome ou código: roçada, 50821…" value="' + esc(busca) + '"></label>' +
        '<label class="md-ordenar">Ordenar<select id="mdOrdem">' + [['km', 'pelo km'], ['saldo', 'menor saldo'], ['antiga', 'medição mais antiga'], ['avisos', 'mais avisos']].map(function (x) { return '<option value="' + x[0] + '"' + (ordem === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label></div>' +
        '<div id="mdBuscaRes" aria-live="polite">' + buscaHtml(cs) + '</div><div class="md-resumo card"><div><span class="md-label">Medido nos ' + n + ' contratos carregados (PI)</span><strong>' + moeda(soma) + '</strong></div><div><span class="md-label">Última competência</span><strong>' + esc(ult || '—') + '</strong></div><div><span class="md-label">Avisos para conferir</span><strong>' + al + '</strong></div></div>';
      var list = cs.slice().sort(function (a, b) {
        var da = dado(a), db = dado(b), va, vb;
        if (ordem === 'saldo') { va = da && da.pi != null ? da.pi - da.total : Infinity; vb = db && db.pi != null ? db.pi - db.total : Infinity; }
        else if (ordem === 'antiga') { va = da && da.ultima != null ? da.ultima : Infinity; vb = db && db.ultima != null ? db.ultima : Infinity; }
        else if (ordem === 'avisos') { va = da ? -avisos(da).length : 0; vb = db ? -avisos(db).length : 0; }
        else { va = a.kmIni == null ? Infinity : valor(a.kmIni); vb = b.kmIni == null ? Infinity : valor(b.kmIni); }
        return va - vb || nome(a).localeCompare(nome(b));
      });
      h += '<section class="md-cards" aria-label="Contratos">' + list.filter(function (c) { return !semMedicoes(c); }).map(cartao).join('') + '</section>' + semMedicoesHtml(cs, true);
      return h + '<p class="md-legenda"><i class="md-swatch medido"></i>Medido (acumulado PI ÷ base do contrato) <i class="md-swatch proj"></i>Projeção até o fim da execução. Ritmo: média das últimas 6 competências registradas; zeradas contam, lacunas não contam.</p>';
    }

    // a lista completa de serviços por medição: a própria análise (porMedicao) ou, na análise por ponte (424), a do Resumo da
    // Medição do SIAC (siac.itens), que traz também a administração local, a mobilização e o canteiro
    function consol(an) {
      if (an.porMedicao) return { servicos: an.servicos || [], porMedicao: an.porMedicao, nomeCod: {} };
      var it = an.siac && an.siac.itens;
      return it && it.porMedicao ? { servicos: it.servicos || [], porMedicao: it.porMedicao, nomeCod: it.nomeCod || {} } : null;
    }
    // as duas formas existentes: consolidado porMedicao (ou siac.itens), ou só os serviços .por de cada ponte
    function linhas(d, n) {
      if (d.detalhes[n]) return d.detalhes[n];
      var an = d.an, cs = consol(an), rows = [], ix = {}, locais = {}, pts = op.pontos(contrato(cid) || {}), nomes = {};
      pts.forEach(function (p) { nomes[p.id] = p.nome || p.codigo || p.id; });
      Object.keys(an.pontes || {}).forEach(function (pid) {
        var p = an.pontes[pid];
        (p.servicos || []).forEach(function (s) {
          var qv = s.por && s.por[n]; if (!qv || (!valor(qv[0]) && !valor(qv[1]))) return;
          // o nome curto do serviço da ponte e, com siac.itens, os códigos do SIAC a que ele corresponde
          [String(s.id || s.cod || s.nome)].concat(cs && cs.nomeCod[s.nome] || []).forEach(function (k) {
            if (!locais[k]) locais[k] = [];
            if (locais[k].indexOf(nomes[pid] || p.nome || pid) < 0) locais[k].push(nomes[pid] || p.nome || pid);
          });
        });
      });
      var pm = cs && cs.porMedicao[n];
      if (pm) {
        cs.servicos.forEach(function (s) { ix[s.id || s.cod] = s; });
        cs.servicos.forEach(function (s) { if (s.cod && !ix[s.cod]) ix[s.cod] = s; });
        Object.keys(pm).forEach(function (k) {
          var s = ix[k] || { cod: k, nome: k }, qv = pm[k];
          rows.push({ id: k, s: s, q: valor(qv[0]), v: valor(qv[1]), locais: locais[k] || locais[s.cod] || [] });
        });
        // capítulos/grupos do catálogo sem serviço nesta competência ficam recolhidos, com valor zero
        cs.servicos.forEach(function (s) {
          var k = String(s.id || s.cod);
          if (!Object.prototype.hasOwnProperty.call(pm, k) && !rows.some(function (r) { return r.s === s; })) rows.push({ id: k, s: s, q: 0, v: 0, locais: [] });
        });
      } else {
        Object.keys(an.pontes || {}).forEach(function (pid) {
          (an.pontes[pid].servicos || []).forEach(function (s) {
            var qv = s.por && s.por[n]; if (!qv) return;
            var k = String(s.id || s.cod || s.nome), r = ix[k];
            if (!r) { r = ix[k] = { id: k, s: s, q: 0, v: 0, locais: locais[k] || [] }; rows.push(r); }
            r.q += valor(qv[0]); r.v += valor(qv[1]);
          });
        });
        // análise por ponte (424): a administração local, a mobilização e o canteiro não têm ponte e entram só no total da
        // medição; a diferença vira um grupo próprio, para os grupos fecharem com o total
        var mt = null, soma = 0;
        d.ms.forEach(function (m) { if (String(m.n) === String(n)) mt = valor(m.total); });
        rows.forEach(function (r) { soma += r.v; });
        if (mt != null && Math.abs(mt - soma) > 1) rows.push({ id: '_semponte', s: { cod: '', nome: 'Administração local, mobilização e canteiro (a análise não detalha por serviço)', un: '', g: 'semponte' }, q: null, v: mt - soma, locais: [], semPonte: true });
      }
      rows.sort(function (a, b) { return b.v - a.v; });
      var gs = [], gi = {}, labels = {};
      op.grupos(contrato(cid) || {}).forEach(function (g) { labels[g.key] = g.label || g.short; });
      rows.forEach(function (r) {
        var s = r.s, k = s.grupo ? 'cap:' + s.grupo : s.g || 'semlocal';
        if (!gi[k]) { gi[k] = { key: k, nome: s.grupo ? nomeGrupo(s.grupo) : labels[k] || (k === 'semlocal' ? op.semLocal.short : k === 'semponte' ? 'Sem ponte' : k), rows: [], v: 0 }; gs.push(gi[k]); }
        gi[k].rows.push(r); gi[k].v += r.v;
      });
      gs.sort(function (a, b) { return b.v - a.v; });
      var dt = { rows: rows, grupos: gs };
      d.detalhes[n] = dt;
      return dt;
    }
    function buscaHtml(cs) {
      if (!busca.trim()) return '';
      var q = normal(busca), rs = [];
      cs.forEach(function (c) {
        var d = dado(c); if (!d) return;
        if (!d.indice) {
          var ag = {}, si = {}, cb = consol(d.an);
          (cb ? cb.servicos : []).forEach(function (s) { si[s.id || s.cod] = s; });
          (cb ? cb.servicos : []).forEach(function (s) { if (s.cod && !si[s.cod]) si[s.cod] = s; });
          function soma(s, k, n, qv) {
            if (!valor(qv[0]) && !valor(qv[1])) return;
            if (!ag[k]) ag[k] = { s: s, q: 0, v: 0, ns: [] };
            ag[k].q += valor(qv[0]); ag[k].v += valor(qv[1]);
            if (ag[k].ns.indexOf(n) < 0) ag[k].ns.push(n);
          }
          d.ms.forEach(function (m) {
            var pm = cb && cb.porMedicao[m.n];
            if (pm) Object.keys(pm).forEach(function (k) { soma(si[k] || { cod: k, nome: k }, k, m.n, pm[k]); });
            else Object.keys(d.an.pontes || {}).forEach(function (pid) { (d.an.pontes[pid].servicos || []).forEach(function (s) { if (s.por && s.por[m.n]) soma(s, s.id || s.cod || s.nome, m.n, s.por[m.n]); }); });
          });
          d.indice = Object.keys(ag).map(function (k) { return ag[k]; });
        }
        d.indice.forEach(function (r) { if (normal((r.s.cod || '') + ' ' + r.s.nome).indexOf(q) >= 0) rs.push({ c: c, d: d, r: r }); });
      });
      return '<section class="card md-card"><h2>' + rs.length + ' serviços encontrados</h2><small>Totais nas medições carregadas; a busca se completa conforme as análises chegam.</small>' +
        (rs.length ? rs.map(function (x) { var r = x.r; return '<div class="md-resultado"><b>' + esc([nome(x.c), String(r.s.cod || '').trim(), r.s.nome].filter(Boolean).join(' · ')) + '</b><span>' + esc(fmtN(r.q)) + ' ' + esc(op.unTxt(r.s.un)) + ' · ' + esc(dinheiro(r.v)) + ' (PI)</span><div class="md-links">' + r.ns.map(function (n) { return botao('abrir', esc(op.medTxt(x.d.an, n)), ' data-cid="' + esc(x.c.id) + '" data-n="' + esc(n) + '"'); }).join('') + '</div></div>'; }).join('') : vazio('Nenhum serviço encontrado nos contratos carregados.')) + '</section>';
    }
    function normal(s) { return String(s || '').toLowerCase().replace(/[áàâãä]/g, 'a').replace(/[éêèë]/g, 'e').replace(/[íìîï]/g, 'i').replace(/[óòôõö]/g, 'o').replace(/[úùûü]/g, 'u').replace(/ç/g, 'c'); }
    function nomeGrupo(s) {
      s = String(s || '').replace(/^[\d,.]+\s*-\s*/, '').trim().toLowerCase();
      return s.replace(/[a-záàâãäéêèëíìîïóòôõöúùûüç]/, function (letra) { return letra.toUpperCase(); });
    }

    function kpi(t, v, s) { return '<div class="card md-kpi"><span class="md-label">' + esc(t) + '</span><strong>' + v + '</strong><small>' + s + '</small></div>'; }
    function contratoHtml(c) {
      var d = dado(c), h = '<div class="md-caminho">' + botao('voltar', '← Medições') + '<span class="md-caminho-ct">' + esc(nome(c)) + '<span class="md-caminho-info">' + esc(' · ' + tipo(c) + ' · ' + faixa(c)) + '</span></span>' + botao('diagrama', 'Ver no diagrama', ' data-cid="' + esc(c.id) + '"', 'ghost md-diagrama') + '</div>';
      if (!d || !d.ms.length) return h + '<section class="card md-card"><h1>' + esc(nome(c)) + '</h1>' + (d && !d.ms.length && op.estado(c) === 'ok' ? vazio('Ainda sem medições carregadas.') : estadoHtml(c)) + '</section>';
      var m = null;
      d.ms.forEach(function (x) { if (String(x.n) === String(med)) m = x; });
      if (!m) { m = d.ult; med = m.n; }
      var e = op.etapaInfo(d.an, d.ult.etapa), ems = e ? d.ms.filter(function (x) { return x.etapa === e.etapa; }) : [];
      if (op.estado(c) === 'erro') h += estadoHtml(c);
      h += '<div class="md-resumo-ctl">' + botao('resumo', (resumoCel ? '▾' : '▸') + ' Resumo do contrato', ' aria-expanded="' + resumoCel + '" aria-controls="mdKpis"') + '</div>';
      h += '<section class="md-kpis' + (resumoCel ? '' : ' md-kpis-fechado') + '" id="mdKpis" aria-label="Resumo do contrato">' + kpi('Medido (acumulado PI)', dinheiro(d.total), esc(baseTxt(d)) + reajHtml(d)) +
        kpi('Saldo (PI)', d.pi != null ? dinheiro(d.pi - d.total) : 'falta o PI', esc(projTxt(d))) +
        kpi(e && e.etapa != null ? e.etapa + 'ª etapa · atual' : 'Etapa não informada', e ? dinheiro(e.total) : '—', e ? esc(e.de + ' a ' + e.ate) + ' · ' + nMed(ems.length) + ', ' + ems.filter(function (x) { return !valor(x.total); }).length + ' zeradas' : '') +
        kpi('Última carregada', esc(op.medTxt(d.an, d.ult.n)), esc(falta(d))) + '</section>';
      h += '<div class="md-contrato"><section class="card md-lista" aria-label="Medições do contrato"><div class="md-lista-top"><h2>' + nMed(d.ms.length) + '</h2><label><input type="checkbox" id="mdZeradas"' + (zeradas ? ' checked' : '') + '> Esconder as zeradas</label></div><div class="md-etapas">';
      (d.an.etapas || []).slice().reverse().forEach(function (et) {
        var key = String(et.etapa), aberto = Object.prototype.hasOwnProperty.call(etapas, key) ? etapas[key] : et.etapa === d.ult.etapa;
        h += '<div class="md-etapa">' + botao('etapa', '<span><b>' + esc(et.etapa != null ? et.etapa + 'ª etapa' : 'Etapa não informada') + '</b><small>' + esc(et.de + ' a ' + et.ate) + ' · ' + esc(nMed(et.ns.length)) + '</small></span><span>' + moeda(et.total) + (aberto ? ' ▾' : ' ▸') + '</span>', ' data-e="' + esc(key) + '" aria-expanded="' + aberto + '"', 'md-etapa-btn');
        if (aberto) h += '<div>' + d.ms.slice().reverse().filter(function (x) { return x.etapa === et.etapa && (!zeradas || valor(x.total)); }).map(function (x) {
          var rotulo = op.medTxt(d.an, x.n) + (x.retificada ? ' · retificada' : '') + ' · ' + (valor(x.total) ? dinheiro(x.total) : 'zerada');
          return botao('med', '<b>' + esc(x.n + 'ª' + (x.retificada ? '*' : '')) + '</b><span>' + esc(mesTxt(idx(x.ref))) + '</span><span class="md-bar" aria-hidden="true"><i style="width:' + largura(Math.abs(valor(x.total)) / (d.max || 1) * 100) + '%"></i></span><span class="md-med-valor' + (!valor(x.total) ? ' md-zerada' : '') + '">' + esc(valor(x.total) ? dinheiro(x.total) : 'zerada') + '</span>', ' data-n="' + esc(x.n) + '" aria-label="' + esc(rotulo) + '" title="' + esc(rotulo) + '" aria-pressed="' + (String(x.n) === String(med)) + '"', 'md-med-row');
        }).join('') + '</div>';
        h += '</div>';
      });
      h += '</div><nav class="md-pilulas" aria-label="Trocar de medição">' + d.ms.filter(function (x) { return !zeradas || valor(x.total); }).map(function (x) {
        return botao('med', esc(op.medTxt(d.an, x.n)), ' data-n="' + x.n + '" aria-pressed="' + (String(x.n) === String(med)) + '"');
      }).join('') + '</nav></section><section class="card md-detalhe" id="mdDetalhe" aria-label="Medição escolhida">' + medicaoHtml(c, d, m) + '</section></div>';
      return h;
    }
    function medicaoHtml(c, d, m) {
      var sm = d.an.siac && d.an.siac.medicoes && d.an.siac.medicoes[m.n], anterior = d.ms[d.ms.indexOf(m) - 1], v = valor(m.total), als = avisos(d, m.n);
      var processado = sm && sm.processado || m.processado, situacao = sm && sm.situacao || m.situacao, indices = sm && sm.indices || m.indices;
      var semKm = soSiac(d);
      if (semKm && aba === 'segmentos') aba = 'grupos';
      var h = '<div class="md-top"><div><small>' + esc((m.etapa != null ? m.etapa + 'ª etapa · ' : '') + 'Competência ' + (m.mes || mesTxt(idx(m.ref)))) + '</small><h2 id="mdTituloMed" tabindex="-1">' + esc(m.n + 'ª medição' + (m.retificada ? ' · retificada' : '')) + '</h2><small>' + esc('Fonte: ' + (m.fonte || d.an.sobre && d.an.sobre.fonte || 'não informada') + ' · processada no SIAC em ' + (processado ? dataTxt(processado) : 'data não informada')) + '</small>' +
        (situacao ? '<small>' + esc(situacao + (indices ? ' · índices ' + indices : '')) + '</small>' : '') + '</div><div class="md-direita"><strong class="md-total">' + esc(dinheiro(v)) + '</strong><small>Preços iniciais (PI)</small>';
      if (sm && numero(sm.total) != null) h += '<small>Com reajuste ' + dinheiro(sm.total) + '</small>';
      if (sm && numero(sm.reaj) != null) h += '<small>Reajuste da medição: ' + dinheiro(sm.reaj) + '</small>';
      if (anterior) h += '<small>' + esc((valor(anterior.total) ? (v - valor(anterior.total) >= 0 ? '+' : '−') + pctCurto(Math.abs((v - valor(anterior.total)) / valor(anterior.total)) * 100) : 'Variação percentual sem base (anterior zerada)') + ' em relação à ' + anterior.n + 'ª (' + dinheiro(anterior.total) + ')') + '</small>';
      h += '</div></div>';
      // As análises antigas trazem [localizado, semLocal]; as novas podem trazer [localizado, total].
      // O total PI da medição é a base em ambos os casos; nunca se soma uma segunda vez o que já é total.
      var cob = d.an.cobertura && d.an.cobertura[m.n], local = cob ? numero(cob[0]) : null;
      if (local == null) { local = 0; Object.keys(d.an.pontes || {}).forEach(function (pid) { local += valor(d.an.pontes[pid].meses && d.an.pontes[pid].meses[m.n]); }); }
      if (semKm) h += '<p class="md-sem-local">Sem localização: esta análise vem só do Resumo da Medição do SIAC (sem km).</p>';
      else h += '<div class="md-local"><div class="md-local-bar" role="img" aria-label="' + esc(dinheiro(local) + ' com local; ' + dinheiro(v - local) + ' sem local; base ' + dinheiro(v) + ' PI') + '"><span class="md-com-local" style="width:' + largura(v > 0 ? local / v * 100 : 0) + '%"></span><span class="md-sem-local-cor" style="width:' + largura(v > 0 ? (v - local) / v * 100 : 100) + '%"></span></div><div class="md-local-legenda"><span><i class="md-swatch md-com-local"></i>' + esc('Com local n' + (c.tipo === 'oae' ? 'as pontes' : c.tipo === 'conserva' ? 'os segmentos' : 'os pontos') + ': ' + dinheiro(local) + ' (' + (v > 0 ? pctCurto(local / v * 100) : 'sem base percentual') + ')') + '</span><span><i class="md-swatch md-sem-local-cor"></i>' + esc('Sem local: ' + dinheiro(v - local)) + '</span></div></div>';
      h += '<div class="md-abas" role="group" aria-label="Ver a medição">' + [['grupos', 'Grupos e serviços'], ['segmentos', c.tipo === 'oae' ? 'Por ponte' : c.tipo === 'conserva' ? 'Por segmento' : 'Por ponto'], ['avisos', 'Avisos (' + als.length + ')']].filter(function (a) { return !semKm || a[0] !== 'segmentos'; }).map(function (a) { return botao('aba', esc(a[1]), ' data-v="' + a[0] + '" aria-pressed="' + (aba === a[0]) + '"'); }).join('') + '</div>';
      if (aba === 'avisos') return h + avisosHtml(als);
      if (aba === 'segmentos') return h + segmentosHtml(c, d, m);
      return h + gruposHtml(d, m);
    }
    function dataTxt(s) { return /^\d{4}-\d{2}-\d{2}/.test(String(s)) ? op.data(s) : String(s); }
    function soSiac(d) {
      var ks = Object.keys(d.an.cobertura || {});
      return !Object.keys(d.an.pontes || {}).length && ks.length > 0 && ks.every(function (k) { return numero(d.an.cobertura[k][0]) === 0; }) &&
        (!!d.an.siac || d.ms.some(function (m) { return /siac/i.test(m.fonte || ''); }));
    }
    function gruposHtml(d, m) {
      var dt = linhas(d, m.n), gs = dt.grupos.filter(function (g) { return semValor || g.v !== 0; });
      if (grupo == null && gs.length) grupo = gs[0].key;
      var h = '<div class="md-grupos">' + gs.map(function (g) {
        var aberto = grupo === g.key, pc = valor(m.total) ? g.v / valor(m.total) * 100 : 0;
        return '<div class="md-grupo">' + botao('grupo', '<span><b>' + esc(g.nome) + '</b><span class="md-bar" aria-hidden="true"><i style="width:' + largura(pc) + '%"></i></span></span><span class="md-direita"><b>' + dinheiro(g.v) + '</b><small>' + pct(pc) + ' da medição</small></span>', ' data-g="' + esc(g.key) + '" aria-expanded="' + aberto + '"', 'md-grupo-btn') + (aberto ? tabelaHtml(semValor || !g.v ? g.rows : g.rows.filter(function (r) { return r.v || r.q; })) : '') + '</div>';
      }).join('') + '</div>';
      if (!dt.rows.length) h += vazio(valor(m.total) ? 'O detalhamento por serviço desta medição não está disponível na análise.' : 'Medição registrada com valor zero.');
      var zero = dt.grupos.filter(function (g) { return !g.v; }).length;
      if (zero) h += botao('semvalor', (semValor ? 'Esconder' : 'Mostrar') + ' os ' + zero + ' grupos sem valor nesta medição', ' aria-pressed="' + semValor + '"', 'ghost');
      var soma = dt.rows.reduce(function (s, r) { return s + r.v; }, 0);
      if (dt.rows.length && Math.abs(soma - valor(m.total)) > 1) h += '<p class="md-aviso">Os serviços detalhados somam ' + dinheiro(soma) + '; o total PI da medição é ' + dinheiro(m.total) + '. O detalhamento disponível não fecha com o total.</p>';
      return h;
    }
    function tabelaHtml(rows) {
      return '<div class="md-scroll" tabindex="0" role="region" aria-label="Serviços do grupo, tabela com rolagem"><table class="md-tabela"><caption class="sr-only">Serviços da medição escolhida</caption><thead><tr><th scope="col">Código</th><th scope="col">Serviço</th><th scope="col">Quantidade</th><th scope="col">Valor (PI)</th><th scope="col">Onde</th></tr></thead><tbody>' + rows.map(function (r) {
        return '<tr><td>' + esc(r.s.cod || '—') + '</td><td>' + esc(r.s.nome) + '</td><td class="md-num">' + (r.q == null ? '—' : fmtN(r.q) + ' ' + esc(op.unTxt(r.s.un))) + '</td><td class="md-num">' + dinheiro(r.v) + '</td><td>' + esc(r.locais.length ? r.locais.join(' · ') : r.semPonte ? 'Sem ponte' : 'Sem local informado') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    }
    // Por ponte / por segmento / por ponto: o km de cada um na lista, a régua do trecho do contrato e, ao tocar,
    // o painel com km inicial e final, a extensão e todas as medições que ele teve (o mesmo dado da lista: an.pontes[pid].meses)
    function segmentosHtml(c, d, m) {
      var cons = c.tipo === 'conserva', oae = c.tipo === 'oae', casas = cons ? 1 : 3, ps = op.pontos(c), an = d.an.pontes || {}, info = {}, ordemKm = {};
      ps.forEach(function (p, i) { info[p.id] = p; ordemKm[p.id] = i; });
      function vm(pid, n) { var x = an[pid]; return valor(x && x.meses && x.meses[n]); }
      function nomeP(pid) { var p = info[pid]; return (p && (p.nome || p.codigo)) || (an[pid] && an[pid].nome) || pid; }
      function kms(pid) { var p = info[pid] || {}; var ki = numero(p.kmIni), kf = numero(p.kmFim); if (ki == null) ki = kf; if (kf == null) kf = ki; return ki == null ? null : [Math.min(ki, kf), Math.max(ki, kf)]; }
      function ext(k) { var e = k[1] - k[0]; return e < 1 ? Math.round(e * 1000) + ' m' : decimal(e, 1) + ' km'; }
      function nMeds(pid) { return d.ms.filter(function (x) { return vm(pid, x.n) !== 0; }).length; }
      var todos = Object.keys(an).concat(ps.map(function (p) { return p.id; }).filter(function (id) { return !an[id]; }));
      var com = todos.filter(function (pid) { return vm(pid, m.n) !== 0; });
      if (!com.length) return vazio('Esta medição não tem valores localizados ' + (oae ? 'nas pontes' : cons ? 'nos segmentos' : 'nos pontos') + '.');
      var mostrarSem = segSem == null ? cons : segSem;
      var lista = (mostrarSem ? todos.filter(function (pid) { return an[pid] || info[pid]; }) : com).slice().sort(function (x, y) {
        if (segOrdem === 'valor') return vm(y, m.n) - vm(x, m.n);
        return (ordemKm[x] == null ? 1e9 : ordemKm[x]) - (ordemKm[y] == null ? 1e9 : ordemKm[y]);
      });
      if (segAberto && lista.indexOf(segAberto) < 0) { if (todos.indexOf(segAberto) >= 0) lista.push(segAberto); else segAberto = ''; }
      var rot = oae ? 'pontes' : cons ? 'segmentos' : 'pontos', h = '';
      // régua: do km inicial ao final do contrato, cada um no seu lugar
      var ka = numero(c.kmIni), kb = numero(c.kmFim);
      ps.forEach(function (p) { var k = kms(p.id); if (!k) return; if (ka == null || k[0] < ka) ka = k[0]; if (kb == null || k[1] > kb) kb = k[1]; });
      var noTrecho = ps.filter(function (p) { return kms(p.id); });
      if (ka != null && kb > ka && noTrecho.length) {
        var L = kb - ka;
        h += '<div class="md-regua-box"><div class="md-regua-top"><span><b>' + (cons ? 'Os ' + noTrecho.length + ' segmentos no trecho' : 'Onde ficam') + '</b> · ' + (cons ? '' : noTrecho.length + ' ' + rot + ' no trecho, ') + com.length + ' com valor nesta medição</span>' +
          (cons ? '<span>tamanho de cada bloco = extensão do segmento</span>' : '<span><i class="md-leg on"></i>com valor<i class="md-leg"></i>sem valor<i class="md-leg sel"></i>aberto</span>') + '</div>';
        h += '<div class="md-regua' + (cons ? ' md-regua-blocos' : '') + '">' + noTrecho.map(function (p) {
          var k = kms(p.id), v = vm(p.id, m.n), cls = (v ? 'on' : '') + (segAberto === p.id ? ' sel' : '');
          var tip = nomeP(p.id) + ', km ' + kmTxt(k[0], casas) + (k[1] > k[0] ? ' a ' + kmTxt(k[1], casas) : '') + ', ' + (v ? dinheiro(v) : 'sem valor nesta medição');
          var st = cons ? 'flex-grow:' + Math.max(k[1] - k[0], .1).toFixed(2) : 'left:' + ((k[0] - ka) / L * 100).toFixed(2) + '%;width:' + Math.max((k[1] - k[0]) / L * 100, .4).toFixed(2) + '%';
          return '<button type="button" class="' + cls + '" data-md="ponte" data-p="' + esc(p.id) + '" style="' + st + '" title="' + esc(tip) + '" aria-label="' + esc(tip) + '">' + (cons ? esc(nomeP(p.id)) : '') + '</button>';
        }).join('') + '</div><div class="md-regua-eixo"><span>km ' + kmTxt(ka, 1) + (cons ? ' · início do contrato' : '') + '</span><span>km ' + kmTxt(kb, 1) + (cons ? ' · fim' : '') + '</span></div></div>';
      }
      h += '<div class="md-segs md-segmentos' + (segAberto ? ' aberto' : '') + '">';
      lista.forEach(function (pid) {
        var k = kms(pid), v = vm(pid, m.n), on = segAberto === pid, nm = nMeds(pid);
        var faixaKm = k ? (cons ? 'km ' + kmTxt(k[0], casas) + ' → km ' + kmTxt(k[1], casas) : 'km ' + kmTxt(k[0], casas) + (k[1] > k[0] ? ' a ' + kmTxt(k[1], casas) : '')) : 'sem km no cadastro';
        var resto = (k && k[1] > k[0] ? ext(k) + ' · ' : '') + nMed(nm);
        var nomeH = cons ? '<span class="md-seg-nome cons"><b>' + esc(nomeP(pid)) + '</b><span><strong>' + esc(faixaKm) + '</strong><small>' + esc(resto) + '</small></span></span>'
          : '<span class="md-seg-nome"><b>' + esc(nomeP(pid)) + '</b><small>' + esc(faixaKm + ' · ' + resto) + '</small></span>';
        h += '<button type="button" class="md-seg-btn' + (on ? ' on' : '') + '" data-md="ponte" data-p="' + esc(pid) + '" aria-expanded="' + on + '">' + nomeH +
          '<span class="md-seg-v' + (v ? '' : ' zero') + '">' + (v ? dinheiro(v) : 'sem valor') + '</span><span class="md-seg-seta" aria-hidden="true">' + (on ? '‹' : '›') + '</span></button>';
        if (on) h += painelHtml(pid);
      });
      var nSem = todos.filter(function (pid) { return (an[pid] || info[pid]) && vm(pid, m.n) === 0; }).length;
      h += '<div class="md-seg-mais">' + (nSem ? botao('ponte-sem', mostrarSem ? 'Esconder os ' + nSem + ' sem valor nesta medição' : 'Mostrar os ' + nSem + ' sem valor nesta medição', ' data-v="' + (mostrarSem ? '0' : '1') + '"', 'small ghost') : '') +
        botao('ponte-ordem', segOrdem === 'valor' ? 'Ordenar pelo km' : 'Ordenar por valor', '', 'small ghost') + '</div></div>';
      return h + '<small>' + (oae || cons ? 'Valores localizados na memória de cálculo.' : 'Valores pelo ponto de cada capítulo do SIAC.') + ' Serviços sem local entram apenas no total da medição. Toque ' + (oae ? 'numa ponte' : cons ? 'num segmento' : 'num ponto') + ' para ver o km e as medições.</small>';

      function painelHtml(pid) {
        var p = info[pid], k = kms(pid), v = vm(pid, m.n), lin = d.ms.filter(function (x) { return vm(pid, x.n) !== 0; }), acum = 0, mx = 0;
        lin.forEach(function (x) { acum += vm(pid, x.n); mx = Math.max(mx, Math.abs(vm(pid, x.n))); });
        var tit = oae ? 'Ponte' + (p && p.codigo && p.codigo !== p.nome ? ' · ' + p.codigo : '') : cons ? 'Segmento · ' + nome(c) : 'Ponto · ' + nome(c);
        var h = '<section class="md-painel" aria-label="' + esc(nomeP(pid) + ': km e medições') + '"><div class="md-painel-top"><div><small>' + esc(tit) + '</small><h3>' + esc(nomeP(pid)) + '</h3></div>' +
          botao('ponte', '✕', ' data-p="' + esc(pid) + '" aria-label="Fechar"', 'small ghost') + '</div>';
        h += '<div class="md-painel-kpis">' + [['km inicial', k ? kmTxt(k[0], 3) : '—'], ['km final', k ? kmTxt(k[1], 3) : '—'], ['extensão', k && k[1] > k[0] ? ext(k) : '—']].map(function (x) {
          return '<div><small>' + x[0] + '</small><b>' + esc(x[1]) + '</b></div>'; }).join('') + '</div>';
        h += '<p class="md-painel-txt">Entrou em <b>' + lin.length + ' de ' + d.ms.length + '</b> medições · ' + (v ? 'nesta (' + m.n + 'ª) ' + esc(dinheiro(v)) + (valor(m.total) ? ', ' + pctCurto(v / valor(m.total) * 100) + ' da medição' : '') : 'sem valor nesta medição') + '</p>';
        if (lin.length) {
          h += '<div class="md-col" aria-hidden="true">' + d.ms.map(function (x) {
            var y = vm(pid, x.n);
            return '<i class="' + (y ? '' : 'zero') + (String(x.n) === String(m.n) ? ' atual' : '') + '" style="height:' + (y ? Math.max(Math.abs(y) / (mx || 1) * 100, 4).toFixed(1) + '%' : '2px') + '" title="' + esc(x.n + 'ª · ' + mesTxt(idx(x.ref)) + ': ' + (y ? dinheiro(y) : 'sem valor')) + '"></i>';
          }).join('') + '</div><div class="md-regua-eixo"><span>' + esc(d.ms[0].n + 'ª · ' + mesTxt(idx(d.ms[0].ref))) + '</span><span>' + esc(d.ms[d.ms.length - 1].n + 'ª · ' + mesTxt(idx(d.ms[d.ms.length - 1].ref))) + '</span></div>';
          var desc = lin.slice().reverse(), mostra = segTodas ? desc : desc.filter(function (x, i) { return i < 8 || String(x.n) === String(m.n); });
          h += '<div><div class="md-hist-cab"><span>Med.</span><span>Competência</span><span></span><span>Valor (PI)</span></div>' + mostra.map(function (x) {
            var y = vm(pid, x.n);
            return botao('med', '<b>' + esc(x.n + 'ª' + (x.retificada ? '*' : '')) + '</b><span>' + esc(mesTxt(idx(x.ref))) + '</span><span class="md-bar" aria-hidden="true"><i style="width:' + largura(Math.abs(y) / (mx || 1) * 100) + '%"></i></span><span class="md-num">' + esc(dinheiro(y)) + '</span>',
              ' data-n="' + x.n + '" aria-pressed="' + (String(x.n) === String(m.n)) + '" aria-label="' + esc('Abrir a ' + x.n + 'ª medição, ' + mesTxt(idx(x.ref)) + ': ' + dinheiro(y)) + '"', 'md-hist');
          }).join('') + '</div>';
          if (desc.length > 8) h += botao('ponte-todas', segTodas ? 'Mostrar só as 8 últimas ▴' : 'Ver as ' + desc.length + ' medições ▾', '', 'small ghost md-accent');
          h += '<div class="md-hist-acum"><span>Acumulado</span><span>' + esc(dinheiro(acum)) + '</span></div>';
        }
        h += '<div class="md-painel-acoes">' + (p && op.diagramaPonto ? botao('ponte-diag', 'Ver no diagrama', ' data-p="' + esc(pid) + '"', 'small primary') : '') +
          (p && op.fotos && op.fotos(c) ? botao('ponte-fotos', 'Fotos ' + (oae ? 'da ponte' : cons ? 'do segmento' : 'do ponto'), ' data-p="' + esc(pid) + '"', 'small') : '') +
          botao('ponte-serv', 'Serviços nesta medição', ' data-p="' + esc(pid) + '" aria-pressed="' + segServ + '"', 'small') + '</div>';
        if (segServ) {
          var rows = ((an[pid] && an[pid].servicos) || []).map(function (s) { var qv = s.por && s.por[m.n]; return qv && (valor(qv[0]) || valor(qv[1])) ? { s: s, q: numero(qv[0]), v: valor(qv[1]) } : null; }).filter(Boolean)
            .sort(function (x, y) { return y.v - x.v; });
          h += rows.length ? '<div class="md-scroll" tabindex="0" role="region" aria-label="Serviços nesta medição"><table class="md-tabela md-tabela-p"><thead><tr><th scope="col">Serviço</th><th scope="col">Quantidade</th><th scope="col">Valor (PI)</th></tr></thead><tbody>' + rows.map(function (r) {
            return '<tr><td>' + esc((r.s.cod ? r.s.cod + ' · ' : '') + (r.s.nome || r.s.id || '')) + '</td><td class="md-num">' + (r.q == null ? '—' : fmtN(r.q) + ' ' + esc(op.unTxt(r.s.un))) + '</td><td class="md-num">' + dinheiro(r.v) + '</td></tr>';
          }).join('') + '</tbody></table></div>' : vazio('Sem serviços localizados nesta medição.');
        }
        return h + '</section>';
      }
    }
    function kmTxt(v, casas) { return v == null ? '—' : decimal(v, casas); }
    function avisosHtml(als) {
      // os avisos para a fiscalização (SIAC × MP e os de vistoria) vêm primeiro e em destaque
      var fisc = function (a) { return a.tipo === 'siac' || a.tipo === 'fiscal' ? 1 : 0; };
      var nomes = { siac: 'SIAC · conferir com a fiscalização', fiscal: 'Conferir com a fiscalização', despacho: 'MP × despacho', dimensao: 'Dimensão fora do comum',
        fora: 'Fora do trecho', memoria: 'Memória de cálculo', repetido: 'Linha repetida', retificacao: 'Retificação' };
      return als.length ? '<div class="md-avisos">' + als.slice().sort(function (a, b) { return fisc(b) - fisc(a); }).map(function (a) {
        return '<article class="md-alerta' + (fisc(a) ? ' siac' : '') + '"><b>' + esc(nomes[a.tipo] || a.tipo || 'Aviso') + (a.cod ? ' · ' + esc(a.cod) : '') + '</b><p>' + esc(a.motivo || 'Sem descrição') + '</p></article>';
      }).join('') + '</div>' : vazio('Nenhum aviso registrado para esta medição.');
    }

    function tom(v) { return v > 2000000 ? 5 : v > 1000000 ? 4 : v > 500000 ? 3 : v > 250000 ? 2 : 1; }
    function mensalHtml(cs) {
      var min = null, max = hoje() - 1, recente = null;
      cs.forEach(function (c) { var d = dado(c); if (!d || !d.comps.length) return; min = min == null ? d.comps[0] : Math.min(min, d.comps[0]); recente = recente == null ? d.comps[d.comps.length - 1] : Math.max(recente, d.comps[d.comps.length - 1]); max = Math.max(max, recente); });
      if (min == null) return cabecalho(cs) + vazio('Aguardando medições com competência registrada.') + '<div class="md-cards">' + cs.filter(function (c) { return !semMedicoes(c); }).map(cartao).join('') + '</div>' + semMedicoesHtml(cs, false);
      if (mesSel == null) mesSel = recente;
      var de = janela == null ? Math.max(min, max - 15) : Math.max(min, Math.min(janela, Math.max(min, max - 15))), fim = Math.min(max, de + 15), cols = [], totais = {};
      for (var i = de; i <= fim; i++) { cols.push(i); totais[i] = 0; }
      var h = cabecalho(cs) + '<div class="md-top"><p>Cada célula mostra o valor em R$ mil (PI). Toque no valor para abrir a medição; no mês para ver os contratos.</p><div class="md-links">' + botao('janela', '← Anteriores', ' data-v="' + (de - 16) + '"' + (de <= min ? ' disabled' : '')) + botao('janela', 'Mais recentes →', ' data-v="' + (de + 16) + '"' + (fim >= max ? ' disabled' : '')) + '</div></div>';
      h += '<div class="card md-scroll md-matriz-scroll" tabindex="0" role="region" aria-label="Matriz de medições, com rolagem horizontal"><table class="md-matriz"><caption class="sr-only">Valor PI por contrato e competência, em R$ mil</caption><thead><tr><th scope="col">Contrato</th>' + cols.map(function (i) { return '<th scope="col">' + botao('mes', esc(mesTxt(i)), ' data-v="' + i + '" aria-pressed="' + (i === mesSel) + '"') + '</th>'; }).join('') + '</tr></thead><tbody>';
      var carregados = cs.filter(function (c) { var d = dado(c); return d && d.ms.length; }), consultas = [];
      carregados.forEach(function (c) {
        var d = dado(c);
        var consulta = d.an.siac && d.an.siac.consulta;
        if (consulta && consultas.indexOf(consulta) < 0) consultas.push(consulta);
        h += '<tr><th scope="row" title="' + esc(nome(c)) + '">' + esc(nome(c).replace(/\/\d{4}$/, '')) + '<small>' + esc(c.tipo === 'oae' ? 'pontes (OAEs)' : [c.lote, tipoCurto(c)].filter(Boolean).join(' · ')) + '</small></th>' + cols.map(function (i) {
          var cell = d && d.porMes[i], txt, cls, tip;
          if (cell) { totais[i] += cell.total; txt = cell.total === 0 ? '0' : fmtN(Math.round(cell.total / 1000)); cls = cell.total === 0 ? 'md-zero' : 'md-tom' + tom(cell.total); tip = nome(c) + ' · ' + mesTxt(i) + ' · ' + dinheiro(cell.total) + ' PI' + (cell.total === 0 ? ' · medição zerada' : ''); }
          else { txt = '—'; cls = 'md-ausente'; tip = nome(c) + ' · ' + mesTxt(i) + ': ' + (i < d.comps[0] ? 'sem medição carregada' : 'sem medição no SIAC' + (consulta ? ' (consulta de ' + dataTxt(consulta) + ')' : ' nos dados carregados')); }
          return '<td>' + botao(cell ? 'celula' : 'mes', esc(txt), ' data-cid="' + esc(c.id) + '" data-v="' + i + '" aria-label="' + esc(tip) + '" title="' + esc(tip) + '" aria-pressed="' + (i === mesSel) + '"', cls) + '</td>';
        }).join('') + '</tr>';
      });
      h += '<tr><th scope="row">Total do mês (PI)<small>contratos carregados</small></th>' + cols.map(function (i) { return '<td>' + botao('mes', fmtN(Math.round(totais[i] / 1000)), ' data-v="' + i + '" aria-pressed="' + (i === mesSel) + '"') + '</td>'; }).join('') + '</tr></tbody></table></div>';
      h += semMedicoesHtml(cs, false);
      h += '<div class="md-legenda">R$ mil: ' + [[1, 'até 250'], [2, '250 a 500'], [3, '500 a 1.000'], [4, '1.000 a 2.000'], [5, 'mais de 2.000'], ['zero', 'medição zerada'], ['ausente', 'sem medição no SIAC' + (consultas.length ? ' (consulta de ' + consultas.sort().map(dataTxt).join(', ') + ')' : ' nos dados carregados')]].map(function (x) { return '<span><i class="md-swatch ' + (typeof x[0] === 'number' ? 'md-tom' : 'md-') + x[0] + '"></i>' + esc(x[1]) + '</span>'; }).join('') + '</div>';
      var soma = 0, n = 0;
      var fichas = carregados.map(function (c) {
        var d = dado(c), cell = d && d.porMes[mesSel];
        if (cell) { soma += cell.total; n += cell.ms.length; }
        return '<article class="card md-card"><h3>' + esc(nome(c)) + '</h3>' + (cell ? cell.ms.map(function (m) { return botao('abrir', '<span>' + esc(op.medTxt(d.an, m.n)) + '<small>' + dinheiro(m.total) + ' PI' + (!valor(m.total) ? ' · zerada' : '') + '</small></span>', ' data-cid="' + esc(c.id) + '" data-n="' + m.n + '"'); }).join('') : vazio(!d ? 'Análise não carregada' : d.comps.length && mesSel >= d.comps[0] ? 'Sem medição no SIAC nos dados carregados' : 'Sem medição carregada para esta competência')) + '</article>';
      }).join('');
      return h + '<section class="card md-card"><div class="md-top"><h2>' + esc(mesTxt(mesSel)) + ' · ' + nMed(n) + '</h2><strong>' + dinheiro(soma) + ' (PI)</strong></div><div class="md-fichas">' + fichas + '</div></section>';
    }

    function render() {
      var cs = permitidos(), ids = cs.map(function (c) { return c.id; });
      Object.keys(cache).forEach(function (id) { if (ids.indexOf(id) < 0) delete cache[id]; });
      if (!op.ativa() || !cs.length) { host.innerHTML = ''; return; }
      if (cid && !contrato(cid)) { cid = ''; med = null; }
      // a busca conserva o foco e a seleção quando chega outra análise enquanto a pessoa digita
      var input = document.activeElement, focado = input && host.contains(input) ? input.id : '', ini = input && input.selectionStart, fim = input && input.selectionEnd;
      var matriz = host.querySelector('.md-matriz-scroll');
      if (matriz && matriz.clientWidth) matrizScroll = matriz.scrollLeft + matriz.clientWidth >= matriz.scrollWidth - 1 ? null : matriz.scrollLeft;
      host.innerHTML = cid ? contratoHtml(contrato(cid)) : modo === 'mes' ? mensalHtml(cs) : inicioHtml(cs);
      matriz = host.querySelector('.md-matriz-scroll');
      if (matriz) matriz.scrollLeft = matrizScroll == null ? matriz.scrollWidth : matrizScroll;
      if (focado) { var novo = document.getElementById(focado); if (novo) { novo.focus({ preventScroll: true }); if (novo.setSelectionRange && ini != null) novo.setSelectionRange(ini, fim); } }
      var sel = host.querySelector('.md-pilulas [aria-pressed="true"]');
      if (sel && sel.parentNode.clientWidth) sel.parentNode.scrollLeft = Math.max(0, sel.offsetLeft - sel.parentNode.offsetLeft - 20);
    }
    function abrir(id, n) {
      if (!contrato(id)) return;
      cid = id; med = n == null ? null : n; etapas = {}; grupo = null; aba = 'grupos'; semValor = false; segAberto = ''; segTodas = false; segServ = false; segSem = null; segOrdem = 'km';
      var d = dado(contrato(id));
      if (d && n != null) d.ms.forEach(function (m) { if (String(m.n) === String(n)) etapas[String(m.etapa)] = true; });
      render(); window.scrollTo(0, 0);
      var titulo = host.querySelector('#mdTituloMed'); if (titulo) titulo.focus({ preventScroll: true });
    }
    host.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-md]'); if (!b || !host.contains(b) || !op.ativa()) return;
      var act = b.dataset.md;
      if (act === 'diagrama') { var c = contrato(b.dataset.cid); if (c) op.diagrama(c); return; }
      if (act === 'abrir') { abrir(b.dataset.cid, b.dataset.n); return; }
      if (act === 'ponte-diag' || act === 'ponte-fotos') {
        var cp = contrato(cid), pp = cp && op.pontos(cp).filter(function (x) { return x.id === b.dataset.p; })[0];
        if (pp) (act === 'ponte-diag' ? op.diagramaPonto : op.fotos)(cp, pp);
        return;
      }
      if (act === 'voltar') { cid = ''; med = null; segAberto = ''; }
      else if (act === 'modo') { modo = b.dataset.v === 'mes' ? 'mes' : 'contrato'; cid = ''; matrizScroll = null; }
      else if (act === 'med') { med = b.dataset.n; grupo = null; semValor = false; }
      else if (act === 'etapa') { var d = dado(contrato(cid)), key = b.dataset.e; etapas[key] = !(Object.prototype.hasOwnProperty.call(etapas, key) ? etapas[key] : d && d.ult && String(d.ult.etapa) === key); }
      else if (act === 'aba') aba = b.dataset.v;
      else if (act === 'ponte') { segAberto = segAberto === b.dataset.p ? '' : b.dataset.p; segTodas = false; segServ = false; }
      else if (act === 'ponte-todas') segTodas = !segTodas;
      else if (act === 'ponte-serv') segServ = !segServ;
      else if (act === 'ponte-sem') segSem = b.dataset.v === '1';
      else if (act === 'ponte-ordem') segOrdem = segOrdem === 'valor' ? 'km' : 'valor';
      else if (act === 'grupo') grupo = grupo === b.dataset.g ? '' : b.dataset.g;
      else if (act === 'semvalor') semValor = !semValor;
      else if (act === 'resumo') resumoCel = !resumoCel;
      else if (act === 'janela') janela = Number(b.dataset.v);
      else if (act === 'mes' || act === 'celula') {
        mesSel = Number(b.dataset.v);
        if (act === 'celula') { var dm = dado(contrato(b.dataset.cid)), ce = dm && dm.porMes[mesSel]; if (ce && ce.ms.length === 1) { abrir(b.dataset.cid, ce.ms[0].n); return; } }
      } else if (act === 'tentar') { var ct = contrato(b.dataset.cid); if (ct) op.repetir(ct); carregar(); }
      else return;
      render();
      var alvos = host.querySelectorAll('[data-md="' + act + '"]');
      for (var i = 0; i < alvos.length; i++) if (alvos[i].dataset.n === b.dataset.n && alvos[i].dataset.g === b.dataset.g && alvos[i].dataset.e === b.dataset.e && alvos[i].dataset.v === b.dataset.v && alvos[i].dataset.p === b.dataset.p && alvos[i].className === b.className) { alvos[i].focus({ preventScroll: true }); break; }
    });
    host.addEventListener('change', function (ev) {
      if (!op.ativa()) return;
      if (ev.target.id === 'mdOrdem') ordem = ev.target.value;
      else if (ev.target.id === 'mdZeradas') zeradas = ev.target.checked;
      else return;
      render();
    });
    host.addEventListener('input', function (ev) {
      if (ev.target.id !== 'mdBusca' || !op.ativa()) return;
      busca = ev.target.value;
      var res = document.getElementById('mdBuscaRes'); if (res) res.innerHTML = buscaHtml(permitidos());
    });
    return {
      render: render,
      carregar: carregar,
      limpar: function () { geracao++; cache = {}; cid = ''; med = null; busca = ''; grupo = null; etapas = {}; matrizScroll = null; host.innerHTML = ''; }
    };
  };
})();
