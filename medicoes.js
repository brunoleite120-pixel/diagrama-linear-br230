/* Medições dos contratos: só na tela, com a análise e o acesso fornecidos pelo app.
 * Os resumos ficam por contrato; serviços e locais são montados só para a medição aberta.
 * Nenhuma leitura ou gravação de banco aqui (carregarAnalise continua no app.js).
 */
(function () {
  'use strict';

  window.Medicoes = function (op) {
    var host = op.host, esc = op.esc, fmtN = op.fmtN, dinheiro = op.dinheiro;
    var cache = {}, cid = '', med = null, modo = 'contrato', aba = 'grupos', zeradas = false, semValor = false;
    var segAberto = '', segTodas = false, segServ = false, segXls = false, segSem = null, segOrdem = 'km';
    // v202: o contrato aberto tem as partes Medições e Pagamentos; na tabela dos pagamentos, todas as linhas ou só as não pagas
    var secao = 'med', pagTodas = false, pagAbertas = false, ordSit = 'prazo';
    var etapas = {}, grupo = null, busca = '', ordem = 'km', mesSel = null, janela = null, fila = false, geracao = 0, resumoCel = false, matrizScroll = null, tipoMes = '', folha = false, folhaHist = false, folhaPula = false;
    var mqCel = window.matchMedia ? window.matchMedia('(max-width:700px)') : null;
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
    // sinalização (709): conservação por baixo, com nome próprio (op.grupoNome, do app.js) e o km das MPs (op.kmMp; nos outros, null)
    function sinal(c) { return !!(op.grupoNome && op.grupoNome(c) === 'Sinalização'); }
    function kmMp(c, k) { var v = op.kmMp && k != null ? op.kmMp(c, k) : null; return typeof v === 'number' && isFinite(v) ? v : null; }
    // Supervisora (CT 393, tipo 'sup', v173): mede por produtos, sem km; vem numa seção própria no fim, sem diagrama
    function ehSup(c) { return !!(c && c.tipo === 'sup'); }
    function tipoCurto(c) { return ehSup(c) ? 'supervisão' : c.tipo === 'oae' ? 'OAEs' : sinal(c) ? 'sinalização' : c.tipo === 'conserva' ? 'conservação' : 'pontos críticos'; }
    function tipo(c) { return ehSup(c) ? 'Supervisão · todo o trecho' : c.tipo === 'oae' ? 'OAEs' : sinal(c) ? 'Sinalização · todo o eixo' : c.tipo === 'conserva' ? 'Conservação' + (c.superficie === 'pavimentada' ? ' · pista pavimentada' : ' · revestimento primário') : 'Pontos críticos'; }
    function faixa(c) {
      if (ehSup(c)) return c.supervisora || '';
      var a = kmMp(c, c.kmIni), b = kmMp(c, c.kmFim);
      return [c.lote, a != null && b != null ? op.kmRotulo(c) + ' ' + fmtN(a) + ' a ' + fmtN(b) : c.kmIni != null && c.kmFim != null ? 'km ' + fmtN(c.kmIni) + ' a ' + fmtN(c.kmFim) : ''].filter(Boolean).join(' · ');
    }
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
    // v202: o que a consulta ao SIAC gravou de cada medição (med_mp.dados.siac): PI, reajuste, total, datas, processo e pagamento
    var IC_OK = '<svg class="md-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    var IC_REL = '<svg class="md-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
    var IC_COP = '<svg class="md-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>';
    function sMed(d, n) { var x = d.an.siac && d.an.siac.medicoes; return x && x[n] || null; }
    function totalMed(d, m) { var x = sMed(d, m.n); return x && numero(x.total) != null ? numero(x.total) : valor(m.total); }
    function reajMed(d, m) { var x = sMed(d, m.n); return x && numero(x.reaj) != null ? numero(x.reaj) : null; }
    // paga: processo de pagamento aprovado · apagar: AES emitido e com valor · zerada: nada a pagar · outra: outra situação do SIAC
    function pagSit(d, m) {
      var x = sMed(d, m.n), pg = x && x.pagamento;
      if (!pg || !pg.situacao) return '';
      if (/^processo de pagamento aprovado/i.test(pg.situacao)) return 'paga';
      if (!totalMed(d, m)) return 'zerada';
      return /aes emitid/i.test(pg.situacao) ? 'apagar' : 'outra';
    }
    function pagTxt(d, m) {
      var x = sMed(d, m.n), pg = x && x.pagamento, st = pagSit(d, m), dt = pg && pg.data ? ' em ' + dataTxt(pg.data) : '';
      return st === 'paga' ? 'Paga' + dt : st === 'apagar' ? 'AES emitido' + dt : st === 'zerada' ? 'Zerada, nada a pagar' : st ? pg.situacao + dt : '';
    }
    function pagIc(d, m) {
      var st = pagSit(d, m);
      return st === 'paga' ? '<span class="md-pg-ic paga">' + IC_OK + '</span>' : st === 'apagar' ? '<span class="md-pg-ic apagar">' + IC_REL + '</span>' : '<span class="md-pg-ic"></span>';
    }
    function pags(d) {
      if (d.pags) return d.pags;
      var r = { pi: 0, reaj: 0, nReaj: 0, tot: 0, pago: 0, nPago: 0, aPagar: 0, abertas: [], com: 0 };
      d.ms.forEach(function (m) {
        var t = totalMed(d, m), rj = reajMed(d, m), st = pagSit(d, m);
        r.pi += valor(m.total); r.tot += t;
        if (rj != null) { r.reaj += rj; r.nReaj++; }
        if (st) r.com++;
        if (st === 'paga') { r.pago += t; r.nPago++; } else if (st === 'apagar') { r.aPagar += t; r.abertas.push(m); }
      });
      d.pags = r;
      return r;
    }
    // média do total (PI + reajuste) das 6 últimas medições: a régua para dizer se o saldo de empenho cobre a próxima
    function media6(d) { var u = d.ms.slice(-6); return u.length ? u.reduce(function (s, m) { return s + totalMed(d, m); }, 0) / u.length : null; }
    function n2(v) { return dinheiro(v).replace(/^R\$\s*/, ''); }
    function consultaSiac(d) { var q = d.an.siac && d.an.siac.consulta; return q ? dataTxt(q) : ''; }
    function periodoTxt(a, b) {
      var x = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(a || '')), y = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(b || ''));
      if (!x || !y) return '';
      return (x[1] === y[1] && x[2] === y[2] ? x[3] : dataTxt(a)) + ' a ' + dataTxt(b);
    }
    function copiarBtn(txt, rotulo, comTexto) { return botao('copiar', IC_COP + (comTexto ? '<span>Copiar</span>' : ''), ' data-txt="' + esc(txt) + '" aria-label="' + esc(rotulo) + '" title="' + esc(rotulo) + '"', 'md-copiar' + (comTexto ? ' com-txt' : '')); }
    function copiar(txt, ok) {
      function falhou() {
        var t = document.createElement('textarea'); t.value = txt; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
        document.body.appendChild(t); t.select();
        var deu = false; try { deu = document.execCommand('copy'); } catch (e) { deu = false; }
        document.body.removeChild(t);
        if (op.toast) op.toast(deu ? ok : 'Não deu para copiar neste aparelho.');
      }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { if (op.toast) op.toast(ok); }, falhou);
      else falhou();
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
      return '<div class="md-top"><div><h1>' + (modo === 'mes' ? 'Medições por mês' : modo === 'sit' ? 'Situação no SIAC' : 'Medições dos contratos') + '</h1><p>' + carregados + ' de ' + cs.length + ' contratos com medições carregadas.' + (modo === 'sit' ? ' Pagamento, empenho, prazos e garantia.' : ' Valores a preços iniciais (PI).') + '</p></div>' +
        '<div class="seg md-modo" role="group" aria-label="Organização">' + [['contrato', 'Por contrato'], ['mes', 'Por mês'], ['sit', 'Situação']].map(function (x) {
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
          '<div class="md-saldo"><b class="md-accent">' + esc(d.pi > 0 ? pctCurto(d.total / d.pi * 100) + ' do valor medido (PI)' : 'falta o PI') + '</b><span>Saldo <b>' + (d.pi != null ? moeda(d.pi - d.total) : 'falta o PI') + '</b></span></div></div>';
        var sdl = siacDl(c, d);
        if (sdl) h += '<dl class="md-dl">' + sdl + '</dl>';
        else h += '<dl class="md-dl"><div><dt>Ritmo (últimos 6 meses)</dt><dd title="' + esc(ritmoTxt(d)) + '">' + (d.ritmo == null ? 'Sem base' : moeda(d.ritmo, '/mês')) + '</dd></div><div><dt>No ritmo atual</dt><dd title="' + esc(projTxt(d)) + '">' + esc(projTxt(d, true)) + '</dd></div>' +
          '<div><dt>Medições</dt><dd>' + d.ms.length + ' (' + d.comValor + ' com valor)</dd></div><div><dt>Avisos da leitura</dt><dd>' + avisos(d).length + '</dd></div></dl>';
        h += '<div class="md-acoes"><small class="' + (d.ultima < hoje() - 1 ? 'md-aviso' : '') + '">' + esc(falta(d)) + '</small>' + botao('abrir', 'Abrir medições →', attrs) + '</div>';
        if (op.estado(c) === 'carregando') h += '<small role="status">Atualizando a análise…</small>';
        if (op.estado(c) === 'erro') h += estadoHtml(c);
      }
      h += '</article>';
      if (!d || !d.ms.length) return h.replace('md-card-desktop', 'md-card-estado');
      return h + '<button type="button" class="card md-card md-card-cel" data-md="abrir"' + attrs + ' aria-label="' + esc('Abrir medições de ' + nome(c) + '; última: ' + d.ult.n + 'ª · ' + mesTxt(d.ultima) + '; ' + baseTxt(d) + '; saldo: ' + (d.pi != null ? dinheiro(d.pi - d.total) : 'falta o PI') + '; ' + falta(d)) + '"><span class="md-cel-top"><b>' + esc(nome(c)) + '</b><span>Última: <b>' + esc(d.ult.n + 'ª · ' + mesTxt(d.ultima)) + '</b></span></span>' + barra(d) +
        '<span class="md-saldo"><b class="md-accent">' + esc(d.pi > 0 ? pctCurto(d.total / d.pi * 100) + ' do valor medido (PI)' : 'falta o PI') + '</b><span>Saldo <b>' + (d.pi != null ? moeda(d.pi - d.total) : 'falta o PI') + '</b></span></span>' + celChips(c, d) + '<span class="md-falta ' + (d.ultima < hoje() - 1 ? 'md-aviso' : '') + '">' + esc(falta(d)) + '</span></button>';
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
      var soma = 0, n = 0, al = 0, ultTipos = {}, apg = 0, napg = 0, emp = 0, nemp = 0;
      cs.forEach(function (c) { var d = dado(c), t = tipoCurto(c); if (d && d.ms.length) { soma += d.total; n++; al += avisos(d).length; var pg0 = pags(d), e0 = empMed(d); apg += pg0.aPagar; napg += pg0.abertas.length; if (e0) { emp += e0.saldo; nemp++; } if (d.ultima != null && (ultTipos[t] == null || d.ultima > ultTipos[t])) ultTipos[t] = d.ultima; } });
      var ult = ['OAEs', 'conservação', 'sinalização', 'pontos críticos', 'supervisão'].filter(function (t) { return ultTipos[t] != null; }).map(function (t) { return mesTxt(ultTipos[t]) + ' ' + t; }).join(' · ');
      var h = cabecalho(cs) + '<div class="md-filtros"><label class="md-busca">Buscar serviço<input type="search" id="mdBusca" placeholder="Nome ou código: roçada, 50821…" value="' + esc(busca) + '"></label>' +
        '<label class="md-ordenar">Ordenar<select id="mdOrdem">' + [['km', 'pelo km'], ['saldo', 'menor saldo'], ['antiga', 'medição mais antiga'], ['avisos', 'mais avisos']].map(function (x) { return '<option value="' + x[0] + '"' + (ordem === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label></div>' +
        '<div id="mdBuscaRes" aria-live="polite">' + buscaHtml(cs) + '</div><div class="md-resumo card"><div><span class="md-label">Medido nos ' + n + ' contratos carregados (PI)</span><strong>' + moeda(soma) + '</strong></div><div><span class="md-label">Última competência</span><strong>' + esc(ult || '—') + '</strong></div>' + (nemp ? '<div><span class="md-label">A pagar no SIAC</span><strong>' + (napg ? moeda(apg) + ' <small>' + nMed(napg) + '</small>' : 'Nada') + '</strong></div><div><span class="md-label">Saldo de empenho (' + nemp + ' contratos)</span><strong>' + moeda(emp) + '</strong></div>' : '<div><span class="md-label">Avisos para conferir</span><strong>' + al + '</strong></div>') + '</div>';
      var list = cs.slice().sort(function (a, b) {
        var da = dado(a), db = dado(b), va, vb;
        if (ordem === 'saldo') { va = da && da.pi != null ? da.pi - da.total : Infinity; vb = db && db.pi != null ? db.pi - db.total : Infinity; }
        else if (ordem === 'antiga') { va = da && da.ultima != null ? da.ultima : Infinity; vb = db && db.ultima != null ? db.ultima : Infinity; }
        else if (ordem === 'avisos') { va = da ? -avisos(da).length : 0; vb = db ? -avisos(db).length : 0; }
        else { va = a.kmIni == null ? Infinity : valor(a.kmIni); vb = b.kmIni == null ? Infinity : valor(b.kmIni); }
        return va - vb || nome(a).localeCompare(nome(b));
      });
      var obras = list.filter(function (c) { return !ehSup(c); }), sups = list.filter(ehSup);
      h += '<section class="md-cards" aria-label="Contratos">' + obras.filter(function (c) { return !semMedicoes(c); }).map(cartao).join('') + '</section>' + semMedicoesHtml(obras, true);
      if (sups.length) h += '<h2 class="md-sec">Supervisão</h2><section class="md-cards" aria-label="Supervisão">' + sups.filter(function (c) { return !semMedicoes(c); }).map(cartao).join('') + '</section>' + semMedicoesHtml(sups, true);
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
        if (!gi[k]) { gi[k] = { key: k, nome: s.grupo ? nomeGrupo(s.grupo) : labels[k] || (k === 'semlocal' ? op.semLocal.short : k === 'semponte' ? 'Sem OAE' : k), rows: [], v: 0 }; gs.push(gi[k]); }
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

    function kpi(t, v, s, cls) { return '<div class="card md-kpi' + (cls ? ' ' + cls : '') + '"><span class="md-label">' + esc(t) + '</span><strong>' + v + '</strong><small>' + s + '</small></div>'; }
    // a lista por etapa: a do computador e a da folha do celular
    function etapasHtml(d) {
      var h = '';
      (d.an.etapas || []).slice().reverse().forEach(function (et) {
        var key = String(et.etapa), aberto = Object.prototype.hasOwnProperty.call(etapas, key) ? etapas[key] : et.etapa === d.ult.etapa;
        h += '<div class="md-etapa">' + botao('etapa', '<span><b>' + esc(et.etapa != null ? et.etapa + 'ª etapa' : 'Etapa não informada') + '</b><small>' + esc(et.de + ' a ' + et.ate) + ' · ' + esc(nMed(et.ns.length)) + '</small></span><span>' + moeda(et.total) + (aberto ? ' ▾' : ' ▸') + '</span>', ' data-e="' + esc(key) + '" aria-expanded="' + aberto + '"', 'md-etapa-btn');
        if (aberto) h += '<div>' + d.ms.slice().reverse().filter(function (x) { return x.etapa === et.etapa && (!zeradas || valor(x.total)); }).map(function (x) {
          var rotulo = op.medTxt(d.an, x.n) + (x.retificada ? ' · retificada' : '') + ' · ' + (valor(x.total) ? dinheiro(x.total) : 'zerada');
          var comPag = pags(d).com > 0, pt = comPag ? pagTxt(d, x) : '';
          if (pt) rotulo += ' · ' + pt + (pagSit(d, x) === 'apagar' ? ', a pagar' : '');
          return botao('med', '<b>' + esc(x.n + 'ª' + (x.retificada ? '*' : '')) + '</b><span>' + esc(mesTxt(idx(x.ref))) + '</span><span class="md-bar" aria-hidden="true"><i style="width:' + largura(Math.abs(valor(x.total)) / (d.max || 1) * 100) + '%"></i></span><span class="md-med-valor' + (!valor(x.total) ? ' md-zerada' : '') + '">' + esc(valor(x.total) ? dinheiro(x.total) : 'zerada') + '</span>' + (comPag ? pagIc(d, x) : ''), ' data-n="' + esc(x.n) + '" aria-label="' + esc(rotulo) + '" title="' + esc(rotulo) + '" aria-pressed="' + (String(x.n) === String(med)) + '"', 'md-med-row' + (comPag ? ' com-pag' : ''));
        }).join('') + '</div>';
        h += '</div>';
      });
      return h;
    }
    function aberta(d) { var r = null; d.ms.forEach(function (x) { if (String(x.n) === String(med)) r = x; }); return r; }
    // a anterior e a próxima à vista ("Esconder as zeradas"); a aberta pode ser uma das escondidas
    function vizinhas(d, m) {
      var i = d.ms.indexOf(m), r = {};
      d.ms.forEach(function (x, j) { if (zeradas && !valor(x.total)) return; if (j < i) r.ant = x; else if (j > i && !r.prox) r.prox = x; });
      return r;
    }
    function medCurta(m) { return m.n + 'ª, ' + mesTxt(idx(m.ref)); }
    // celular: "‹ 41ª* · mai/26 ▾ ›"; ‹ e › somem nas pontas
    function seletorHtml(d, m) {
      var rotulo = m.n + 'ª' + (m.retificada ? '*' : '') + ' · ' + mesTxt(idx(m.ref));
      if (d.ms.length < 2) return '<div class="md-sel"><span class="md-sel-rot">' + esc(rotulo) + '</span></div>';
      var v = vizinhas(d, m);
      return '<nav class="md-sel" aria-label="Trocar de medição">' +
        (v.ant ? botao('passo', '‹', ' data-v="-1" aria-label="' + esc('Medição anterior: ' + medCurta(v.ant)) + '"', 'md-sel-ant') : '') +
        botao('folha', '<span>' + esc(rotulo) + '</span><span aria-hidden="true">▾</span>', ' aria-haspopup="dialog" aria-label="' + esc('Escolher a medição. Aberta: ' + medCurta(m) + (m.retificada ? ', retificada' : '')) + '"', 'md-sel-ir') +
        (v.prox ? botao('passo', '›', ' data-v="1" aria-label="' + esc('Próxima medição: ' + medCurta(v.prox)) + '"', 'md-sel-prox') : '') + '</nav>';
    }
    function folhaHtml(c, d) {
      return '<div class="esc md-folha"><div class="esc-f" role="dialog" aria-modal="true" aria-labelledby="mdFolhaT" tabindex="-1"><div class="esc-top"><div><h2 id="mdFolhaT">Escolher a medição</h2><p>' + esc(nome(c) + ' · ' + nMed(d.ms.length)) + '</p></div><button type="button" class="esc-x" data-md="folha-x" aria-label="Fechar">×</button></div><div class="md-etapas">' + etapasHtml(d) + '</div></div></div>';
    }
    function abreFolha() {
      var c = contrato(cid), d = dado(c), m = d && aberta(d);
      if (!m || folha) return;
      // só a etapa da medição aberta vem aberta
      etapas = {}; etapas[String(d.ult.etapa)] = false; etapas[String(m.etapa)] = true;
      folha = true;
      // o Voltar do Android fecha a folha (e não sai da tela)
      try { history.pushState(Object.assign({}, history.state || {}, { mdFolha: 1 }), ''); folhaHist = true; } catch (e) { folhaHist = false; }
      host.insertAdjacentHTML('beforeend', folhaHtml(c, d));
      var f = host.querySelector('.md-folha .esc-f'), s = f.querySelector('.md-med-row[aria-pressed="true"]');
      f.focus({ preventScroll: true });
      if (s) f.scrollTop += s.getBoundingClientRect().top - f.getBoundingClientRect().top - (f.clientHeight - s.offsetHeight) / 2;
    }
    function focaSeletor() {
      var v = host.querySelector('[data-md="folha"]'), t = host.querySelector('#mdTituloMed');
      if (v && v.offsetParent) v.focus({ preventScroll: true }); else if (t) t.focus({ preventScroll: true });
    }
    // viaVoltar: o Voltar já tirou a entrada do histórico
    function fechaFolha(viaVoltar) {
      if (!folha) return;
      folha = false;
      var el = host.querySelector('.md-folha'), d = dado(contrato(cid)), l = host.querySelector('.md-lista .md-etapas');
      if (el) el.parentNode.removeChild(el);
      if (d && l) l.innerHTML = etapasHtml(d);
      if (folhaHist && !viaVoltar) { folhaPula = true; try { history.back(); } catch (e) { folhaPula = false; } }
      folhaHist = false;
      focaSeletor();
    }
    // v203: a parte Contrato: valor em cascata, o que já está assinado e ainda fora do SIAC, prazos, aditivos e apostilas, garantia e processo base
    function fichaS(d) { return d.an.siac && d.an.siac.ficha || null; }
    function diaIso(s) { var x = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return x ? new Date(+x[1], +x[2] - 1, +x[3]) : null; }
    function hojeDia() { var h = new Date(); return new Date(h.getFullYear(), h.getMonth(), h.getDate()); }
    function dias(s) { var t = diaIso(s); return t ? Math.round((t - hojeDia()) / 86400000) : null; }
    function diasTxt(n) { return n == null ? '' : n === 0 ? 'vence hoje' : n > 0 ? 'faltam ' + n + (n === 1 ? ' dia' : ' dias') : 'venceu há ' + (-n) + (n === -1 ? ' dia' : ' dias'); }
    function tomDias(n, a, b) { return n == null ? '' : n <= a ? 'dg' : n <= b ? 'at' : 'ok'; }
    function chipTom(txt, tom, ic) { return '<span class="md-chip-ct ' + (tom || 'n') + '">' + (ic || '') + esc(txt) + '</span>'; }
    function aditivos(d) { var a = d.an.siac && d.an.siac.aditivos; return Array.isArray(a) ? a.filter(function (x) { return x && x.num; }) : []; }
    function ehTA(x) { return x.tipo ? x.tipo === 'ta' : /^ta/i.test(x.num); }
    function foraSiac(c) {
      return (c.valores || []).filter(function (v) { return v && v.sit === 'prev'; }).map(function (v) { return { t: v.rotulo, v: numero(v.valor) != null ? dinheiro(v.valor) : '', nota: v.nota, fonte: v.fonte, data: v.data }; })
        .concat((c.prazos || []).filter(function (p) { return p && p.sit === 'prev'; }).map(function (p) { return { t: p.rotulo, v: p.data ? dataTxt(p.data) : '', nota: p.nota, fonte: p.fonte, data: null }; }));
    }
    function temContrato(c, d) { return !!(fichaS(d) || (c.valores || []).length || (c.prazos || []).length); }
    function prazosCt(c, d) {
      var f = fichaS(d) || {}, conf = (c.prazos || []).filter(function (p) { return p && p.sit !== 'prev' && diaIso(p.data); }), ini = null;
      conf.forEach(function (p) { if (!p.fim && /in[ií]cio/i.test(p.rotulo || '') && !ini) ini = p.data; });
      var ult = function (tipos, base) { var r = diaIso(base) ? base : null; conf.forEach(function (p) { if (tipos.indexOf(p.fim) >= 0 && (!r || p.data > r)) r = p.data; }); return r; };
      return { ini: ini || (diaIso(f.inicio_servicos) ? f.inicio_servicos : null), exe: ult(['exec', 'ambos'], f.termino_execucao), vig: ult(['vig', 'ambos'], f.termino_vigencia) };
    }
    function cascataHtml(c, d) {
      var f = fichaS(d), ads = aditivos(d), lin = function (r, v, tipo, sub) {
        return '<div class="md-cas-l ' + tipo + '"><span><span class="md-cas-r">' + esc(r) + '</span>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span><span class="md-cas-v">' + (tipo === 'ad' && v >= 0 ? '+ ' : '') + esc(dinheiro(v)) + '</span></div>';
      };
      if (!f) {
        var vs = (c.valores || []).filter(function (v) { return v && v.sit !== 'prev' && numero(v.valor) != null; });
        if (!vs.length) return '';
        return '<div class="md-cas">' + vs.map(function (v) { return lin(v.rotulo || 'Valor', numero(v.valor), 'tot', v.fonte || ''); }).join('') + '</div>';
      }
      var pii = numero(f.pi_inicial), piv = numero(f.pi_vigente), rj = numero(f.total_reajuste) || 0, pir = numero(f.total_pi_r), tad = numero(f.total_aditivos);
      if (pir == null && piv != null) pir = piv + rj;
      if (tad == null && piv != null && pii != null) tad = piv - pii;
      var tas = ads.filter(function (x) { return ehTA(x) && numero(x.valor); }), aps = ads.filter(function (x) { return !ehTA(x); });
      var somaTas = tas.reduce(function (s2, x) { return s2 + numero(x.valor); }, 0), partes = [];
      if (pii != null) partes.push([pii, 'md-cs-ini', 'PI inicial']);
      if (tas.length && tad != null && Math.abs(somaTas - tad) < 1) tas.forEach(function (x, i) { partes.push([numero(x.valor), 'md-cs-ta' + (i % 2), x.num]); });
      else if (tad) partes.push([tad, 'md-cs-ta0', 'aditivos']);
      if (rj) partes.push([rj, 'md-cs-rj', 'reajuste']);
      var h = '';
      if (pir > 0) {
        var med = d.total, mp = Math.max(0, Math.min(100, med / pir * 100));
        h += '<div class="md-cas-barra"><div class="md-cas-seg" role="img" aria-label="' + esc(partes.map(function (p) { return p[2] + ' ' + dinheiro(p[0]); }).join(', ') + '; medido até aqui ' + dinheiro(med)) + '">' +
          partes.filter(function (p) { return p[0] > 0; }).map(function (p) { return '<i class="' + p[1] + '" style="width:' + (p[0] / pir * 100).toFixed(2) + '%"></i>'; }).join('') + '</div>' +
          '<span class="md-cas-med" style="left:' + mp.toFixed(2) + '%" aria-hidden="true"></span>' +
          '<div class="md-cas-leg"><span><b>Medido até aqui: ' + esc(dinheiro(med)) + '</b>' + (piv > 0 ? ' (' + esc(pct(med / piv * 100)) + ' do PI vigente)' : '') + '</span><span class="md-cas-cores">' +
          partes.filter(function (p) { return p[0] > 0; }).map(function (p) { return '<span><i class="' + p[1] + '"></i>' + esc(p[2]) + '</span>'; }).join('') + '</span></div></div>';
      }
      h += '<div class="md-cas">';
      if (pii != null) h += lin('PI inicial', pii, 'ini', '');
      if (tas.length && Math.abs(somaTas - (tad || 0)) < 1) tas.forEach(function (x) { h += lin(x.num + (x.objeto ? ' · ' + objCurto(x) : ''), numero(x.valor), 'ad', x.assinatura ? 'assinado em ' + dataTxt(x.assinatura) : ''); });
      else if (tad) h += lin('Termos aditivos', tad, 'ad', tas.length ? tas.map(function (x) { return x.num; }).join(', ') : '');
      if (piv != null) h += lin('PI vigente', piv, 'tot', '');
      if (rj || aps.length) h += lin('Reajuste' + (aps.length ? ' · ' + aps.length + (aps.length === 1 ? ' apostila' : ' apostilas') : ''), rj, 'ad', aps.length ? aps[0].num + (aps.length > 1 ? ' a ' + aps[aps.length - 1].num : '') : '');
      if (pir != null) h += lin('PI + reajuste', pir, 'tot', '');
      return h + '</div>';
    }
    function objCurto(x) {
      var o = String(x.objeto || '').toLowerCase();
      if (/renova/.test(o)) return 'renovação';
      if (/prorroga/.test(o)) return 'prorrogação';
      if (/reajust/.test(o)) return 'reajustamento';
      return o.length > 40 ? o.slice(0, 38) + '…' : o;
    }
    function foraHtml(c) {
      var fs = foraSiac(c);
      if (!fs.length) return '';
      return '<div class="md-fora" aria-label="Ainda fora do SIAC"><span class="md-chip-ct az">Ainda fora do SIAC</span>' + fs.map(function (x) {
        return '<p><b>' + esc(x.t || '') + (x.v ? ': ' + x.v : '') + '</b>' + (x.nota ? '<span>' + esc(x.nota) + '</span>' : '') + (x.fonte ? '<small>' + esc(x.fonte) + '</small>' : '') + '</p>';
      }).join('') + '</div>';
    }
    function prazosHtml(c, d) {
      var p = prazosCt(c, d), ne = dias(p.exe), nv = dias(p.vig), cel = celular();
      if (!p.exe && !p.vig) return '';
      var tom = tomDias(ne, 45, 120), chip = ne == null ? '' : ne < 0 ? chipTom('execução vencida', 'dg') : tom === 'ok' ? chipTom('em dia', 'ok', IC_OK) : chipTom('execução ' + diasTxt(ne).replace(/^faltam/, 'em'), tom, IC_REL);
      var h = '<section class="card md-ct-card" aria-label="Prazos"><div class="md-pg-tit"><h3>Prazos</h3>' + chip + '</div>';
      var a = diaIso(p.ini), z = diaIso(p.vig || p.exe), hj = hojeDia();
      if (a && z && z > a) {
        var fimB = Math.max(z, hj), tot = fimB - a, ph = Math.max(0, Math.min(100, (hj - a) / tot * 100)), pe = diaIso(p.exe) ? (diaIso(p.exe) - a) / tot * 100 : null;
        h += '<div class="md-tl" aria-hidden="true"><div class="md-tl-trilho"></div><div class="md-tl-feito" style="width:' + ph.toFixed(1) + '%"></div>' + (pe != null ? '<i class="md-tl-exe" style="left:' + pe.toFixed(1) + '%"></i>' : '') +
          '<i class="md-tl-hoje" style="left:' + ph.toFixed(1) + '%"></i><span class="md-tl-rot" style="left:' + Math.max(8, Math.min(92, ph)).toFixed(1) + '%">hoje · ' + esc(dataTxt(isoDe(hj))) + '</span></div>';
      }
      var marco = function (r, v, sub, t) { return v ? '<div class="md-marco' + (t && t !== 'ok' ? ' ' + t : '') + '"><span class="md-label">' + esc(r) + '</span><strong>' + esc(dataTxt(v)) + '</strong><small>' + esc(sub) + '</small></div>' : ''; };
      var ni = dias(p.ini);
      h += '<div class="md-marcos' + (cel ? ' cel' : '') + '">' + marco('Início dos serviços', p.ini, ni == null ? '' : ni <= 0 ? 'há ' + (-ni) + (ni === -1 ? ' dia' : ' dias') : 'começa em ' + ni + ' dias') +
        marco('Fim da execução', p.exe, diasTxt(ne), tom) + marco('Fim da vigência', p.vig, diasTxt(nv), tomDias(nv, 45, 120)) + '</div>';
      if (a && diaIso(p.exe) && diaIso(p.exe) > a) {
        var dec = Math.max(0, (hj - a) / (diaIso(p.exe) - a) * 100);
        h += '<p class="md-ct-nota"><b>' + esc(pct(Math.min(dec, 999))) + ' do prazo de execução decorrido</b>' + (d.pi > 0 ? ' e <b>' + esc(pct(d.total / d.pi * 100)) + ' do PI medido</b>' : '') + '. ' + esc(projTxt(d)) + '.</p>';
      } else h += '<p class="md-ct-nota">' + esc(projTxt(d)) + '.</p>';
      return h + '</section>';
    }
    function isoDe(t) { return t.getFullYear() + '-' + ('0' + (t.getMonth() + 1)).slice(-2) + '-' + ('0' + t.getDate()).slice(-2); }
    function aditivosHtml(d) {
      var ads = aditivos(d), cel = celular();
      if (!ads.length) return '';
      var nT = ads.filter(ehTA).length, nA = ads.length - nT, cont = [nT ? nT + (nT === 1 ? ' aditivo' : ' aditivos') : '', nA ? nA + (nA === 1 ? ' apostila' : ' apostilas') : ''].filter(Boolean).join(' · ');
      var h = '<section class="card md-ct-card md-ct-ad" aria-label="Termos aditivos e apostilas"><div class="md-pg-tit"><h3>Termos aditivos e apostilas</h3><small>' + esc(cont) + '</small></div>';
      var sub = function (x) { return [x.objeto ? x.objeto.charAt(0) + x.objeto.slice(1).toLowerCase() : '', numero(x.dias) ? x.dias + ' dias' : ''].filter(Boolean).join(' · '); };
      if (cel) return h + '<ul class="md-ad-lista">' + ads.map(function (x) {
        return '<li><span><b>' + esc(x.num) + '</b>' + (x.assinatura ? ' · ' + esc(dataTxt(x.assinatura)) : '') + '<small>' + esc([sub(x), x.sei ? 'SEI ' + x.sei : ''].filter(Boolean).join(' · ')) + '</small></span><span class="md-cas-v">' + (numero(x.valor) ? esc((numero(x.valor) > 0 ? '+ ' : '') + n2(x.valor)) : '—') + '</span></li>';
      }).join('') + '</ul></section>';
      return h + '<div class="md-scroll" tabindex="0" role="region" aria-label="Termos aditivos e apostilas, tabela com rolagem"><table class="md-tabela md-ad-tabela"><thead><tr><th scope="col">Nº</th><th scope="col">Assinatura</th><th scope="col">Objeto</th><th scope="col" class="md-num">Valor (R$)</th><th scope="col">Documento</th></tr></thead><tbody>' + ads.map(function (x) {
        return '<tr><td><b>' + esc(x.num) + '</b></td><td>' + esc(x.assinatura ? dataTxt(x.assinatura) : '—') + (x.publicacao ? '<small>publicado em ' + esc(dataTxt(x.publicacao)) + '</small>' : '') + '</td><td class="md-ad-obj">' + esc(sub(x) || '—') + '</td><td class="md-num">' + (numero(x.valor) ? esc((numero(x.valor) > 0 ? '+ ' : '') + n2(x.valor)) : '—') + '</td><td>' + esc(x.sei ? 'SEI ' + x.sei : '—') + '</td></tr>';
      }).join('') + '</tbody></table></div></section>';
    }
    function garantiaHtml(d) {
      var g = d.an.siac && d.an.siac.garantia;
      if (!g || (!g.vencimento && !g.situacao)) return '';
      var n = dias(g.vencimento), tom = tomDias(n, 30, 90), sit = g.situacao || '';
      var chip = n != null && n < 0 ? chipTom('vencida', 'dg') : tom && tom !== 'ok' ? chipTom(diasTxt(n).replace(/^faltam/, 'vence em'), tom, IC_REL) : sit ? chipTom(sit, /liberad|vigente|ativ/i.test(sit) ? 'ok' : 'n', /liberad|vigente|ativ/i.test(sit) ? IC_OK : '') : '';
      return '<section class="card md-ct-card" aria-label="Garantia"><div class="md-pg-tit"><h3>Garantia</h3>' + chip + '</div>' +
        (g.vencimento ? '<div class="md-emp-l"><span>Vence em</span><span><b>' + esc(dataTxt(g.vencimento)) + '</b>' + (n != null ? ' · ' + esc(diasTxt(n)) : '') + '</span></div>' : '') +
        (numero(g.valor) ? '<div class="md-emp-l"><span>Valor</span><span>' + esc(dinheiro(g.valor)) + '</span></div>' : '') +
        (g.modalidade ? '<div class="md-emp-l"><span>Modalidade</span><span>' + esc(g.modalidade) + '</span></div>' : '') +
        (sit && tom && tom !== 'ok' ? '<div class="md-emp-l"><span>Situação no SIAC</span><span>' + esc(sit) + '</span></div>' : '') +
        (g.nota ? '<small class="md-emp-notas">' + esc(g.nota) + '</small>' : '') + '</section>';
    }
    function fonteCtHtml(d) {
      var s = d.an.siac || {}, pb = s.processo_base, q = consultaSiac(d);
      if (!pb && !q) return '';
      return '<section class="card md-ct-card md-ct-fonte" aria-label="Processo base e fonte">' + (pb ? '<div class="md-proc"><span>Processo base (SEI)</span><b>' + esc(pb) + '</b>' + copiarBtn(pb, 'Copiar o processo base', celular()) + '</div>' : '') +
        (q ? '<small>' + esc(lista(['ficha'].concat(aditivos(d).length ? ['aditivos e apostilas'] : [], s.empenho ? ['empenho'] : [], s.garantia ? ['garantia'] : [])).replace(/^f/, 'F') + ' lidos no SIAC em ' + q + '.') + '</small>' : '') + '</section>';
    }
    function lista(xs) { return xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' e ' + xs[xs.length - 1]; }
    function contratoAbaHtml(c, d) {
      var f = fichaS(d), q = consultaSiac(d), emp = d.an.siac && d.an.siac.empenho;
      var vc = '<section class="card md-ct-card" aria-label="Valor do contrato"><div class="md-pg-tit"><h3>Valor do contrato</h3><small>' + esc(f ? 'Ficha do SIAC' + (q ? ' · ' + q : '') : 'Cadastro') + '</small></div>' + cascataHtml(c, d) + foraHtml(c) + '</section>';
      if (celular()) return '<div class="md-ct-grid"><div class="md-ct-col">' + vc + prazosHtml(c, d) + aditivosHtml(d) + (emp ? empenhoHtml(d, emp) : '') + garantiaHtml(d) + fonteCtHtml(d) + '</div></div>';
      var esq = vc + aditivosHtml(d), dir = prazosHtml(c, d) + (emp ? empenhoHtml(d, emp) : '') + garantiaHtml(d) + fonteCtHtml(d);
      return '<div class="md-ct-grid"><div class="md-ct-col">' + esq + '</div><div class="md-ct-col">' + dir + '</div></div>';
    }
    // v205: Situação (3ª organização), cartões com o SIAC e marca de a pagar em Por mês; o "Para conferir" saiu na v218
    function empMed(d) {
      var e = d.an.siac && d.an.siac.empenho, sd = e ? numero(e.saldo) : null;
      if (sd == null) return null;
      var p = pags(d), md = media6(d);
      return { saldo: sd, sobra: sd - p.aPagar, media: md, cobre: md == null ? null : sd - p.aPagar >= md };
    }
    function mesesSem(d) { return d.ultima == null ? null : Math.max(0, hoje() - 1 - d.ultima); }
    // v209: o que o painel do contrato (app.js) mostra; as mesmas contas da Situação
    function resumoCt(c) {
      var d = dado(c);
      if (!d || !d.ms.length) return null;
      var p = prazosCt(c, d), ne = dias(p.exe), e = empMed(d), f = fichaS(d) || {}, g = d.an.siac && d.an.siac.garantia, s = d.an.siac;
      return {
        pct: d.pi > 0 ? pctCurto(d.total / d.pi * 100) : '', medido: compacto(d.total), pi: d.pi > 0 ? compacto(d.pi) : '', n: d.ms.length,
        ult: d.ult.n + 'ª · ' + mesTxt(d.ultima), ultValor: dinheiro(totalMed(d, d.ult)), ultPag: pagTxt(d, d.ult) || '', semMeses: mesesSem(d),
        exe: p.exe ? dataTxt(p.exe) : '', vig: p.vig ? dataTxt(p.vig) : '', dias: ne, tomPrazo: tomDias(ne, 45, 120),
        emp: e ? compacto(e.saldo) : '', cobre: e ? e.cobre : null,
        conferir: (function () {
          var ch = [], ng = g ? dias(g.vencimento) : null, ms = mesesSem(d);
          if (ne != null && ne < 0) ch.push({ t: 'execução vencida', tom: 'dg' });
          else if (ne != null && ne <= 120) ch.push({ t: 'execução em ' + ne + (ne === 1 ? ' dia' : ' dias'), tom: ne <= 45 ? 'dg' : 'at' });
          if (ng != null && ng <= 90) ch.push({ t: ng < 0 ? 'garantia vencida' : 'garantia em ' + ng + (ng === 1 ? ' dia' : ' dias'), tom: ng <= 30 ? 'dg' : 'at' });
          pags(d).abertas.forEach(function (x) { ch.push({ t: x.n + 'ª a pagar', tom: 'at' }); });
          if (e && e.cobre === false) ch.push({ t: 'empenho não cobre', tom: 'at' });
          if (ms >= 4) ch.push({ t: ms + ' meses sem medição', tom: 'at' });
          if (foraSiac(c).length) ch.push({ t: 'fora do SIAC', tom: 'az' });
          return ch;
        })(),
        siac: s ? { consulta: s.consulta ? dataTxt(s.consulta) : '', pi: numero(f.pi_vigente) != null ? dinheiro(numero(f.pi_vigente)) : '', exe: diaIso(f.termino_execucao) ? dataTxt(f.termino_execucao) : '',
          vig: diaIso(f.termino_vigencia) ? dataTxt(f.termino_vigencia) : '', garantia: g ? [g.situacao, g.vencimento ? 'vence em ' + dataTxt(g.vencimento) : ''].filter(Boolean).join(' · ') : '' } : null
      };
    }
    function sitTd(v, sub, tom) { return '<td><div class="md-sit-c"><span>' + v + '</span>' + (sub ? '<small class="' + (tom && tom !== 'ok' ? tom : '') + '">' + esc(sub) + '</small>' : '') + '</div></td>'; }
    function pagUlt(d) {
      var st = pagSit(d, d.ult), t = pagTxt(d, d.ult);
      return st === 'apagar' ? '<span class="md-chip-pg apagar">' + IC_REL + esc(t) + '</span>' : st === 'paga' ? '<span class="md-pg-ok">' + IC_OK + esc(t) + '</span>' : esc(t || '—');
    }
    function sitOrd(cs) {
      var k = function (c) { var d = dado(c), v = d ? dias(prazosCt(c, d).exe) : null; return v == null ? 1e9 : v; };
      return cs.slice().sort(function (a, b) { return ordSit === 'prazo' ? k(a) - k(b) || nome(a).localeCompare(nome(b)) : nome(a).localeCompare(nome(b)); });
    }
    function sitLinhaHtml(c) {
      var d = dado(c), p = prazosCt(c, d), ne = dias(p.exe), nv = dias(p.vig), g = d.an.siac && d.an.siac.garantia, ng = g ? dias(g.vencimento) : null, e = empMed(d), ms = mesesSem(d);
      return '<tr>' + '<th scope="row">' + botao('abrir-ab', '<b>' + esc(nome(c)) + '</b><small>' + esc(tipoNome(c, 1) + (c.executora ? ' · ' + String(c.executora).split(/\s+/)[0] : '')) + '</small>', ' data-cid="' + esc(c.id) + '" data-ab="ct" aria-label="' + esc('Abrir ' + nome(c) + ' em Contrato') + '"', 'ghost md-sit-ct') + '</th>' +
        sitTd(d.pi > 0 ? esc(pctCurto(d.total / d.pi * 100)) : '—', d.pi > 0 ? 'de ' + compacto(d.pi) : 'falta o PI') +
        sitTd(esc(d.ult.n + 'ª · ' + mesTxt(d.ultima)), ms ? 'há ' + ms + (ms === 1 ? ' mês' : ' meses') : 'em dia', ms >= 4 ? 'at' : '') +
        '<td>' + pagUlt(d) + '</td>' +
        sitTd(e ? esc(dinheiro(e.saldo)) : '—', e ? (e.cobre === false ? 'não cobre a próxima' : e.cobre ? 'cobre a próxima' : '') : '', e && e.cobre === false ? 'at' : '') +
        sitTd(p.exe ? esc(dataTxt(p.exe)) : '—', diasTxt(ne), tomDias(ne, 45, 120)) +
        sitTd(p.vig ? esc(dataTxt(p.vig)) : '—', diasTxt(nv), tomDias(nv, 45, 120)) +
        sitTd(g && g.vencimento ? esc(dataTxt(g.vencimento)) : '—', diasTxt(ng), tomDias(ng, 30, 90)) + '</tr>';
    }
    function sitCartaoHtml(c) {
      var d = dado(c), p = prazosCt(c, d), ne = dias(p.exe), g = d.an.siac && d.an.siac.garantia, ng = g ? dias(g.vencimento) : null, e = empMed(d), ms = mesesSem(d), ch = '';
      if (ne != null && ne < 0) ch += chipTom('execução vencida', 'dg');
      else if (ne != null && ne <= 120) ch += chipTom('execução em ' + ne + ' dias', ne <= 45 ? 'dg' : 'at');
      if (ng != null && ng <= 90) ch += chipTom(ng < 0 ? 'garantia vencida' : 'garantia em ' + ng + ' dias', ng <= 30 ? 'dg' : 'at');
      pags(d).abertas.forEach(function (m) { ch += chipTom(m.n + 'ª a pagar', 'at', IC_REL); });
      if (e && e.cobre === false) ch += chipTom('empenho não cobre', 'at');
      if (ms >= 4) ch += chipTom(ms + ' meses sem medição', 'at');
      if (foraSiac(c).length) ch += chipTom('fora do SIAC', 'az');
      if (!ch) ch = chipTom('em dia', 'ok', IC_OK);
      return '<li>' + botao('abrir-ab', '<span class="md-sit-top"><span><b>' + esc(nome(c)) + '</b><small>' + esc(tipoNome(c, 1) + (c.executora ? ' · ' + String(c.executora).split(/\s+/)[0] : '')) + '</small></span><span class="md-sit-dir"><b>' + esc(d.pi > 0 ? pctCurto(d.total / d.pi * 100) : '—') + '</b> medido<small>' + esc(d.ult.n + 'ª · ' + mesTxt(d.ultima)) + '</small></span></span>' +
        '<span class="md-sit-chips">' + ch + '</span><span class="md-sit-pe"><span>Empenho <b>' + esc(e ? compacto(e.saldo) : '—') + '</b></span><span>Execução até <b>' + esc(p.exe ? dataTxt(p.exe) : '—') + '</b></span></span>',
        ' data-cid="' + esc(c.id) + '" data-ab="ct" aria-label="' + esc('Abrir ' + nome(c) + ' em Contrato') + '"', 'md-sit-card') + '</li>';
    }
    function situacaoHtml(cs) {
      var com = cs.filter(function (c) { var d = dado(c); return d && d.ms.length; }), obras = sitOrd(com.filter(function (c) { return !ehSup(c); })), sups = sitOrd(com.filter(ehSup)), cel = celular();
      var qs = [];
      com.forEach(function (c) { var q = dado(c).an.siac && dado(c).an.siac.consulta; if (q && qs.indexOf(q) < 0) qs.push(q); });
      var h = cabecalho(cs);
      h += '<div class="md-sit-ctl"><h2>Contratos</h2><small>' + esc(com.length + ' contratos' + (qs.length ? ' · consulta ao SIAC de ' + qs.sort().map(dataTxt).join(', ') : '')) + '</small><label class="md-ordenar">Ordem<select id="mdOrdSit"><option value="prazo"' + (ordSit === 'prazo' ? ' selected' : '') + '>fim da execução mais perto</option><option value="nome"' + (ordSit === 'nome' ? ' selected' : '') + '>número do contrato</option></select></label></div>';
      if (cel) {
        h += '<ul class="md-sit-lista">' + obras.map(sitCartaoHtml).join('') + '</ul>';
        if (sups.length) h += '<h2 class="md-sec">Supervisão</h2><ul class="md-sit-lista">' + sups.map(sitCartaoHtml).join('') + '</ul>';
      } else {
        h += '<div class="card md-scroll md-sit-tab" tabindex="0" role="region" aria-label="Situação dos contratos, tabela com rolagem"><table class="md-tabela md-sit-tabela"><thead><tr><th scope="col">Contrato</th><th scope="col">Medido ÷ PI vigente</th><th scope="col">Última medição</th><th scope="col">Pagamento da última</th><th scope="col">Saldo de empenho</th><th scope="col">Fim da execução</th><th scope="col">Fim da vigência</th><th scope="col">Garantia até</th></tr></thead><tbody>' +
          obras.map(sitLinhaHtml).join('') + (sups.length ? '<tr class="md-sit-sep"><th scope="rowgroup" colspan="8">Supervisão</th></tr>' + sups.map(sitLinhaHtml).join('') : '') + '</tbody></table></div>';
      }
      h += semMedicoesHtml(cs, true);
      return h + '<p class="md-legenda">Saldo de empenho comparado com a média das 6 últimas medições (PI + reajuste), depois do que está a pagar. Prazos: vermelho até 45 dias ou vencido, amarelo até 120 (garantia: 30 e 90). Os prazos são os do cadastro conferido; quando o SIAC ainda não tem o termo, o item aparece em "Fora do SIAC". Tocar no contrato abre a aba Contrato.</p>';
    }
    // a linha do cartão de Por contrato com o SIAC; sem os dados do SIAC, o cartão fica como antes
    function siacDl(c, d) {
      if (!d.an.siac) return '';
      var p = prazosCt(c, d), ne = dias(p.exe), e = empMed(d), st = pagSit(d, d.ult), fs = foraSiac(c), tn = tomDias(ne, 45, 120);
      return '<div><dt>Pagamento da última</dt><dd' + (st === 'apagar' ? ' class="md-dd-at"' : '') + '>' + esc(pagTxt(d, d.ult) || '—') + '</dd></div>' +
        '<div><dt>Saldo de empenho</dt><dd' + (e && e.cobre === false ? ' class="md-dd-at" title="' + esc('Depois do que está a pagar, não cobre a próxima medição (média das 6 últimas: ' + dinheiro(e.media) + ')') + '"' : '') + '>' + (e ? moeda(e.saldo) + (e.cobre === false ? ' · não cobre' : '') : '—') + '</dd></div>' +
        '<div><dt>Fim da execução</dt><dd' + (tn && tn !== 'ok' ? ' class="md-dd-' + tn + '"' : '') + '>' + esc(p.exe ? dataTxt(p.exe) + ' · ' + diasTxt(ne) : '—') + '</dd></div>' +
        '<div><dt>No ritmo atual</dt><dd title="' + esc(projTxt(d)) + '">' + esc(projTxt(d, true)) + '</dd></div>' +
        (fs.length ? '<div class="md-dl-todo"><dt>Fora do SIAC</dt><dd class="md-dd-az">' + esc(fs.map(function (x) { return x.t; }).join('; ')) + '</dd></div>' : '');
    }
    function celChips(c, d) {
      if (!d.an.siac) return '';
      var p = prazosCt(c, d), ne = dias(p.exe), e = empMed(d), ch = '';
      pags(d).abertas.forEach(function (m) { ch += chipTom(m.n + 'ª a pagar', 'at', IC_REL); });
      if (ne != null && ne < 0) ch += chipTom('execução vencida', 'dg'); else if (ne != null && ne <= 120) ch += chipTom('execução em ' + ne + ' dias', ne <= 45 ? 'dg' : 'at');
      if (e && e.cobre === false) ch += chipTom('empenho não cobre', 'at');
      return ch ? '<span class="md-sit-chips">' + ch + '</span>' : '';
    }
    function contratoHtml(c) {
      var d = dado(c), h = '<div class="md-caminho">' + botao('voltar', '← Medições') + '<span class="md-caminho-ct">' + esc(nome(c)) + '<span class="md-caminho-info">' + esc(' · ' + tipo(c) + ' · ' + faixa(c)) + '</span></span>' + (ehSup(c) ? '' : botao('diagrama', 'Ver no diagrama', ' data-cid="' + esc(c.id) + '"', 'ghost md-diagrama')) + '</div>';
      if (!d || !d.ms.length) return h + '<section class="card md-card"><h1>' + esc(nome(c)) + '</h1>' + (d && !d.ms.length && op.estado(c) === 'ok' ? vazio('Ainda sem medições carregadas.') : estadoHtml(c)) + '</section>';
      var m = null;
      d.ms.forEach(function (x) { if (String(x.n) === String(med)) m = x; });
      if (!m) { m = d.ult; med = m.n; }
      var e = op.etapaInfo(d.an, d.ult.etapa), ems = e ? d.ms.filter(function (x) { return x.etapa === e.etapa; }) : [], pg = pags(d);
      if (op.estado(c) === 'erro') h += estadoHtml(c);
      // v202: com o SIAC lido, o contrato aberto ganha a parte Pagamentos
      var tc = temContrato(c, d), abas = [['med', 'Medições', String(d.ms.length)]];
      if (pg.com) abas.push(['pag', 'Pagamentos', pg.abertas.length ? pg.abertas.length + ' a pagar' : '']);
      if (tc) abas.push(['ct', 'Contrato', '']);
      if ((secao === 'pag' && !pg.com) || (secao === 'ct' && !tc)) secao = 'med';
      if (abas.length > 1) h += '<div class="md-secoes" role="group" aria-label="Partes do contrato">' + abas.map(function (x) {
        return botao('secao', esc(x[1]) + (x[2] ? ' <small' + (x[0] === 'pag' ? ' class="md-sec-at"' : '') + '>' + esc(x[2]) + '</small>' : ''), ' data-v="' + x[0] + '" aria-pressed="' + (secao === x[0]) + '"');
      }).join('') + '</div>';
      if (secao === 'pag') return h + pagamentosHtml(c, d);
      if (secao === 'ct') return h + contratoAbaHtml(c, d);
      var ultSm = sMed(d, d.ult.n), q = consultaSiac(d);
      var kpi3 = pg.nReaj ? kpi('Reajuste medido', dinheiro(pg.reaj), esc('Total com reajuste ' + dinheiro(pg.tot))) :
        kpi(e && e.etapa != null ? e.etapa + 'ª etapa · atual' : 'Etapa não informada', e ? dinheiro(e.total) : '—', e ? esc(e.de + ' a ' + e.ate) + ' · ' + nMed(ems.length) + ', ' + ems.filter(function (x) { return !valor(x.total); }).length + ' zeradas' : '');
      var kpi4 = ultSm ? kpi('No SIAC', esc(d.ult.n + 'ª · ' + mesTxt(d.ultima)), esc([pagTxt(d, d.ult), d.ultima < hoje() - 3 ? falta(d) : '', q ? 'consulta de ' + q : ''].filter(Boolean).join(' · ')), pagSit(d, d.ult) === 'apagar' || d.ultima < hoje() - 3 ? 'at' : '') :
        kpi('Última carregada', esc(op.medTxt(d.an, d.ult.n)), esc(falta(d)));
      if (!tc) h += '<div class="md-resumo-ctl">' + botao('resumo', (resumoCel ? '▾' : '▸') + ' Resumo do contrato', ' aria-expanded="' + resumoCel + '" aria-controls="mdKpis"') + '</div>';
      h += '<section class="md-kpis' + (resumoCel || tc ? '' : ' md-kpis-fechado') + (tc ? ' md-kpis-sem-cel' : '') + '" id="mdKpis" aria-label="Resumo do contrato">' + kpi('Medido (acumulado PI)', dinheiro(d.total), esc(baseTxt(d)) + (pg.nReaj ? '' : reajHtml(d))) +
        kpi('Saldo (PI)', d.pi != null ? dinheiro(d.pi - d.total) : 'falta o PI', esc(projTxt(d))) + kpi3 + kpi4 + '</section>';
      h += '<div class="md-contrato"><section class="card md-lista" aria-label="Medições do contrato"><div class="md-lista-top"><h2>' + nMed(d.ms.length) + '</h2><label><input type="checkbox" id="mdZeradas"' + (zeradas ? ' checked' : '') + '> Esconder as zeradas</label></div><div class="md-etapas">';
      h += etapasHtml(d) + '</div>' + seletorHtml(d, m) + '</section><section class="card md-detalhe" id="mdDetalhe" aria-label="Medição escolhida">' + medicaoHtml(c, d, m) + '</section></div>';
      return h + (folha ? folhaHtml(c, d) : '');
    }
    // situação do pagamento lida na consulta da medição no SIAC, com o processo de suporte e a data da consulta
    function pagamentoHtml(sm) {
      var p = sm && sm.pagamento;
      if (!p || !p.situacao) return '';
      return '<small class="md-pagamento">' + esc('SIAC: ' + p.situacao + (p.data ? ' em ' + dataTxt(p.data) : '') +
        (sm.processo ? ' · processo ' + sm.processo : '') + (p.consultado ? ' (consultado em ' + dataTxt(p.consultado) + ')' : '')) + '</small>';
    }
    // v202: período, processamento, AES e pagamento em trilha, com o processo de suporte (SEI) para copiar
    function trilhaHtml(c, d, m, sm) {
      var pg = sm.pagamento || {}, st = pagSit(d, m), ps = [], q = pg.consultado ? dataTxt(pg.consultado) : consultaSiac(d);
      var per = periodoTxt(sm.inicio, sm.fim);
      if (per) ps.push(['Período medido', per, 1]);
      if (sm.processado) ps.push(['Processada no SIAC', dataTxt(sm.processado), 1]);
      if (st === 'paga') ps.push(['Pagamento aprovado', pg.data ? dataTxt(pg.data) : '', 1]);
      else if (st === 'apagar') { ps.push(['AES emitido', pg.data ? dataTxt(pg.data) : '', 1]); ps.push(['Pagamento aprovado', 'aguardando', 0]); }
      else if (st === 'zerada') ps.push(['Sem valor a pagar', pg.situacao + (pg.data ? ' em ' + dataTxt(pg.data) : ''), 1]);
      else if (pg.situacao) ps.push([pg.situacao, pg.data ? dataTxt(pg.data) : '', 1]);
      if (!ps.length && !sm.processo) return '';
      var chip = st === 'apagar' ? '<span class="md-chip-pg apagar">' + IC_REL + 'a pagar</span>' : st === 'paga' ? '<span class="md-chip-pg paga">' + IC_OK + 'paga</span>' : '';
      var h = '<section class="md-trilha-box' + (st === 'apagar' ? ' apagar' : '') + '" aria-label="Andamento no SIAC"><div class="md-trilha-top"><b>Andamento no SIAC</b>' + chip + (q ? '<small>consultado em ' + esc(q) + '</small>' : '') + '</div>';
      if (ps.length) h += '<ol class="md-trilha">' + ps.map(function (x) {
        return '<li class="' + (x[2] ? 'feito' : 'falta') + '"><span class="md-trilha-bola" aria-hidden="true">' + (x[2] ? IC_OK : '') + '</span><span class="md-trilha-txt"><b>' + esc(x[0]) + '</b><small>' + esc(x[1]) + '</small></span></li>';
      }).join('') + '</ol>';
      if (sm.processo) h += '<div class="md-proc"><span>Processo de suporte (SEI)</span><b>' + esc(sm.processo) + '</b>' + copiarBtn(sm.processo, 'Copiar o número do processo', celular()) + '</div>';
      return h + '</section>';
    }
    function resumoMedTxt(c, d, m, sm) {
      var t = nome(c) + ' · ' + m.n + 'ª medição (' + mesTxt(idx(m.ref)) + '): ';
      t += sm && numero(sm.reaj) != null && numero(sm.total) != null ? 'PI ' + dinheiro(m.total) + ' + reajuste ' + dinheiro(sm.reaj) + ' = ' + dinheiro(sm.total) : dinheiro(m.total) + ' (PI)';
      var pt = pagTxt(d, m);
      if (pt) t += '. SIAC: ' + pt;
      if (sm && sm.processo) t += '. Processo ' + sm.processo;
      return t + '.';
    }
    function medicaoHtml(c, d, m) {
      var sm = d.an.siac && d.an.siac.medicoes && d.an.siac.medicoes[m.n], anterior = d.ms[d.ms.indexOf(m) - 1], v = valor(m.total), als = avisos(d, m.n);
      var processado = sm && sm.processado || m.processado, situacao = sm && sm.situacao || m.situacao, indices = sm && sm.indices || m.indices;
      var semKm = soSiac(d);
      if (semKm && aba === 'segmentos') aba = 'grupos';
      var varTxt = anterior ? (valor(anterior.total) ? (v - valor(anterior.total) >= 0 ? '+' : '−') + pctCurto(Math.abs((v - valor(anterior.total)) / valor(anterior.total)) * 100) : 'Variação percentual sem base (anterior zerada)') + ' em relação à ' + anterior.n + 'ª (' + dinheiro(anterior.total) + ')' : '';
      var h;
      if (sm && (sm.pagamento || sm.processo || numero(sm.reaj) != null)) {
        var rj = numero(sm.reaj), tt = numero(sm.total), sit = [situacao ? 'medição ' + String(situacao).toLowerCase() : '', indices ? 'índices ' + String(indices).toLowerCase() : ''].filter(Boolean).join(' · ');
        h = '<div class="md-top"><div><small>' + esc((m.etapa != null ? m.etapa + 'ª etapa · ' : '') + 'competência ' + mesTxt(idx(m.ref))) + '</small><h2 id="mdTituloMed" tabindex="-1">' + esc(m.n + 'ª medição' + (m.retificada ? ' · retificada' : '')) + '</h2>' +
          (varTxt ? '<small>' + esc(varTxt) + '</small>' : '') + (sit ? '<small>' + esc(sit.charAt(0).toUpperCase() + sit.slice(1)) + '</small>' : '') + '</div><div class="md-soma">' +
          (rj != null && tt != null ? '<div><span class="md-label">Preços iniciais (PI)</span><b>' + esc(dinheiro(v)) + '</b></div><span class="md-op" aria-hidden="true">+</span><div><span class="md-label">Reajuste</span><b>' + esc(dinheiro(rj)) + '</b></div><span class="md-op md-op-ig" aria-hidden="true">=</span><div class="md-soma-tot"><span class="md-label">Total da medição</span><strong class="md-total">' + esc(dinheiro(tt)) + '</strong></div>'
            : '<div class="md-soma-tot"><span class="md-label">Preços iniciais (PI)</span><strong class="md-total">' + esc(dinheiro(v)) + '</strong></div>') +
          copiarBtn(resumoMedTxt(c, d, m, sm), 'Copiar o resumo da medição') + '</div></div>';
        h += trilhaHtml(c, d, m, sm);
      } else {
      h = '<div class="md-top"><div><small>' + esc((m.etapa != null ? m.etapa + 'ª etapa · ' : '') + 'Competência ' + (m.mes || mesTxt(idx(m.ref)))) + '</small><h2 id="mdTituloMed" tabindex="-1">' + esc(m.n + 'ª medição' + (m.retificada ? ' · retificada' : '')) + '</h2><small>' + esc('Fonte: ' + (m.fonte || d.an.sobre && d.an.sobre.fonte || 'não informada') + ' · processada no SIAC em ' + (processado ? dataTxt(processado) : 'data não informada')) + '</small>' +
        (situacao ? '<small>' + esc(situacao + (indices ? ' · índices ' + indices : '')) + '</small>' : '') + pagamentoHtml(sm) + '</div><div class="md-direita"><strong class="md-total">' + esc(dinheiro(v)) + '</strong><small>Preços iniciais (PI)</small>';
      if (sm && numero(sm.total) != null) h += '<small>Com reajuste ' + dinheiro(sm.total) + '</small>';
      if (sm && numero(sm.reaj) != null) h += '<small>Reajuste da medição: ' + dinheiro(sm.reaj) + '</small>';
      if (anterior) h += '<small>' + esc(varTxt) + '</small>';
      h += '</div></div>';
      }
      // As análises antigas trazem [localizado, semLocal]; as novas podem trazer [localizado, total].
      // O total PI da medição é a base em ambos os casos; nunca se soma uma segunda vez o que já é total.
      var cob = d.an.cobertura && d.an.cobertura[m.n], local = cob ? numero(cob[0]) : null;
      if (local == null) { local = 0; Object.keys(d.an.pontes || {}).forEach(function (pid) { local += valor(d.an.pontes[pid].meses && d.an.pontes[pid].meses[m.n]); }); }
      if (semKm) h += '<p class="md-sem-local">' + (ehSup(c) ? 'A Supervisão mede por produtos, sem km: os valores vêm do Resumo da Medição do SIAC.' : 'Sem localização: esta análise vem só do Resumo da Medição do SIAC (sem km).') + '</p>';
      else h += '<div class="md-local"><div class="md-local-bar" role="img" aria-label="' + esc(dinheiro(local) + ' com local; ' + dinheiro(v - local) + ' sem local; base ' + dinheiro(v) + ' PI') + '"><span class="md-com-local" style="width:' + largura(v > 0 ? local / v * 100 : 0) + '%"></span><span class="md-sem-local-cor" style="width:' + largura(v > 0 ? (v - local) / v * 100 : 100) + '%"></span></div><div class="md-local-legenda"><span><i class="md-swatch md-com-local"></i>' + esc('Com local n' + (c.tipo === 'oae' ? 'as OAEs' : c.tipo === 'conserva' ? 'os segmentos' : 'os pontos') + ': ' + dinheiro(local) + ' (' + (v > 0 ? pctCurto(local / v * 100) : 'sem base percentual') + ')') + '</span><span><i class="md-swatch md-sem-local-cor"></i>' + esc('Sem local: ' + dinheiro(v - local)) + '</span></div></div>';
      h += '<div class="md-abas" role="group" aria-label="Ver a medição">' + [['grupos', 'Grupos e serviços'], ['segmentos', c.tipo === 'oae' ? 'Por OAE' : c.tipo === 'conserva' ? 'Por segmento' : 'Por ponto'], ['avisos', 'Avisos (' + als.length + ')']].filter(function (a) { return !semKm || a[0] !== 'segmentos'; }).map(function (a) { return botao('aba', esc(a[1]), ' data-v="' + a[0] + '" aria-pressed="' + (aba === a[0]) + '"'); }).join('') + '</div>';
      if (aba === 'avisos') return h + avisosHtml(als);
      if (aba === 'segmentos') return h + segmentosHtml(c, d, m);
      return h + gruposHtml(d, m);
    }
    // v202: a parte Pagamentos do contrato aberto: totais, gráfico por medição, empenho (quando lido do SIAC) e a tabela
    function graficoHtml(d) {
      var cel = celular(), W = cel ? 340 : 760, H = cel ? 170 : 230, L = 40, B = 22, T = 8, ms = d.ms, n = ms.length;
      var mx = 0; ms.forEach(function (m) { mx = Math.max(mx, valor(m.total) + Math.max(0, reajMed(d, m) || 0), totalMed(d, m)); });
      if (!n || !(mx > 0)) return '';
      var bruto = mx / 4, pot = Math.pow(10, Math.floor(Math.log(bruto) / Math.LN10)), passo = [1, 2, 2.5, 5, 10].map(function (k) { return k * pot; }).filter(function (k) { return k >= bruto; })[0], topo = passo * 4;
      var g = '', bw = (W - L - 4) / n, y0 = H - B, alt = H - B - T, cada = Math.max(1, Math.ceil(n / (cel ? 5 : 9)));
      for (var k = 1; k <= 4; k++) { var y = (T + alt * (1 - k / 4)).toFixed(1); g += '<line x1="' + L + '" y1="' + y + '" x2="' + W + '" y2="' + y + '" class="md-g-grade"/><text x="' + (L - 5) + '" y="' + (Number(y) + 4) + '" text-anchor="end" class="md-g-txt">' + esc(fmtN(Math.round(passo * k / 1000))) + '</text>'; }
      ms.forEach(function (m, i) {
        var x = L + i * bw + bw * 0.16, w = Math.max(1, bw * 0.68), pi = Math.max(0, valor(m.total)), rj = Math.max(0, reajMed(d, m) || 0), hp = alt * pi / topo, hr = alt * rj / topo, st = pagSit(d, m);
        var tip = m.n + 'ª · ' + mesTxt(idx(m.ref)) + ': PI ' + dinheiro(m.total) + (reajMed(d, m) != null ? ' + reajuste ' + dinheiro(reajMed(d, m)) + ' = ' + dinheiro(totalMed(d, m)) : '') + (st ? ' · ' + pagTxt(d, m) : '');
        g += '<g><title>' + esc(tip) + '</title>' + (st === 'apagar' ? '<rect x="' + x.toFixed(1) + '" y="' + (y0 - hp - hr).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + Math.max(1, hp + hr).toFixed(1) + '" class="md-g-apagar"/>' :
          '<rect x="' + x.toFixed(1) + '" y="' + (y0 - hp).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + Math.max(0, hp).toFixed(1) + '" class="md-g-pi"/>' + (hr >= 0.5 ? '<rect x="' + x.toFixed(1) + '" y="' + (y0 - hp - hr).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + hr.toFixed(1) + '" class="md-g-rj"/>' : '')) + '</g>';
        if ((n - 1 - i) % cada === 0) g += '<text x="' + (i === n - 1 ? x + w : x + w / 2).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="' + (i === n - 1 ? 'end' : 'middle') + '" class="md-g-txt">' + esc(mesTxt(idx(m.ref))) + '</text>';
      });
      g += '<line x1="' + L + '" y1="' + y0 + '" x2="' + W + '" y2="' + y0 + '" class="md-g-eixo"/>';
      var p = pags(d);
      return '<section class="card md-grafico"><div class="md-pg-tit"><h3>Por medição, em R$ mil</h3><span class="md-g-leg"><span><i class="md-g-pi"></i>PI</span>' + (p.nReaj ? '<span><i class="md-g-rj"></i>reajuste</span>' : '') + (p.abertas.length ? '<span><i class="md-g-apagar"></i>a pagar</span>' : '') + '</span></div>' +
        '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc('Valor de cada uma das ' + n + ' medições, em mil reais' + (p.nReaj ? ', PI e reajuste' : '') + (p.abertas.length ? '; a medição a pagar aparece tracejada' : '')) + '">' + g + '</svg></section>';
    }
    function empenhoHtml(d, emp) {
      var p = pags(d), md = media6(d), saldo = numero(emp.saldo), sobra = saldo == null ? null : saldo - p.aPagar, prox = d.ultima != null ? mesTxt(d.ultima + 1) : 'a próxima', aviso = '', tom = '';
      var lin = function (t, v, forte) { return v == null ? '' : '<div class="md-emp-l' + (forte ? ' forte' : '') + '"><span>' + esc(t) + '</span><span>' + esc(dinheiro(v)) + '</span></div>'; };
      if (sobra != null) {
        var antes = p.abertas.length ? 'Depois da ' + p.abertas.map(function (m) { return m.n + 'ª'; }).join(' e da ') + ' sobram ' + dinheiro(Math.max(0, sobra)) + '.' : 'Saldo de ' + dinheiro(saldo) + '.';
        if (sobra < 0) { aviso = 'O saldo não cobre ' + (p.abertas.length > 1 ? 'as medições a pagar' : 'a medição a pagar') + ': faltam ' + dinheiro(-sobra) + '.'; tom = 'dg'; }
        else if (md != null && sobra >= md) { aviso = antes + ' Cobre a medição de ' + prox + ' (média das 6 últimas: ' + dinheiro(md) + ').'; tom = 'ok'; }
        else if (md != null) { aviso = antes + ' Não cobre a medição de ' + prox + ': a média das 6 últimas é ' + dinheiro(md) + '.'; tom = 'at'; }
        else aviso = antes;
      }
      var notas = (emp.notas || []).filter(function (x) { return x && x.ne; });
      return '<section class="card md-emp" aria-label="Empenho"><div class="md-pg-tit"><h3>Empenho</h3><small>' + esc('SIAC' + (emp.atualizado ? ' · atualizado em ' + dataTxt(emp.atualizado) : '') + (emp.consulta ? ' · consulta de ' + dataTxt(emp.consulta) : '')) + '</small></div>' +
        lin('Empenhado', numero(emp.empenhado)) + lin('Ajustes', numero(emp.ajustes)) + lin('Consumido (medições pagas)', numero(emp.consumido)) + lin('Saldo', saldo, true) +
        (notas.length ? '<small class="md-emp-notas">' + esc((notas.length === 1 ? 'Nota com saldo: ' : 'Notas com saldo: ') + notas.map(function (x) { return x.ne + (numero(x.saldo) != null ? ' (' + dinheiro(x.saldo) + ')' : ''); }).join(' e ')) + '</small>' : '') +
        (aviso ? '<p class="md-emp-aviso ' + tom + '">' + esc(aviso) + '</p>' : '') + '</section>';
    }
    function pagLinhas(d) {
      return d.ms.slice().reverse().filter(function (m) { var st = pagSit(d, m); return !pagAbertas || st === 'apagar' || st === 'outra'; });
    }
    function pagTabelaTxt(c, d) {
      var br = function (v) { return v == null ? '' : (v < 0 ? '-' : '') + decimal(Math.abs(v), 2).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
      return [['Contrato', 'Medição', 'Competência', 'PI', 'Reajuste', 'Total', 'Processada', 'Pagamento', 'Processo de suporte'].join('\t')].concat(pagLinhas(d).map(function (m) {
        var x = sMed(d, m.n) || {};
        return [nome(c), m.n + 'ª', mesTxt(idx(m.ref)), br(valor(m.total)), br(reajMed(d, m)), br(totalMed(d, m)), x.processado ? dataTxt(x.processado) : '', pagTxt(d, m), x.processo || ''].join('\t');
      })).join('\n');
    }
    function pagamentosHtml(c, d) {
      var p = pags(d), f = d.an.siac && d.an.siac.ficha, pir = f && numero(f.total_pi_r), emp = d.an.siac && d.an.siac.empenho, cel = celular();
      var ab = p.abertas.map(function (m) { return m.n + 'ª · ' + pagTxt(d, m); }).join(' · ');
      var h = '<section class="md-kpis md-kpis5" aria-label="Pagamentos do contrato">' +
        kpi('Medido (PI)', dinheiro(p.pi), esc(nMed(d.ms.length) + (d.ms.length - d.comValor ? ', ' + (d.ms.length - d.comValor) + ' zeradas' : ''))) +
        kpi('Reajuste', p.nReaj ? dinheiro(p.reaj) : '—', esc(p.nReaj && p.pi ? pctCurto(p.reaj / p.pi * 100) + ' sobre o PI medido' : 'sem reajuste no SIAC')) +
        kpi('Total medido (PI + R)', dinheiro(p.tot), esc(pir ? 'de ' + dinheiro(pir) + ' (PI + R do contrato)' : 'PI + reajuste das medições')) +
        kpi('Pago', dinheiro(p.pago), esc(nMed(p.nPago) + ' com pagamento aprovado'), 'ok') +
        kpi('A pagar', p.abertas.length ? dinheiro(p.aPagar) : 'Nada', esc(p.abertas.length ? ab : 'todas as medições com valor estão pagas'), p.abertas.length ? 'at' : '') + '</section>';
      h += '<div class="md-pg-meio' + (emp ? '' : ' so') + '">' + graficoHtml(d) + (emp ? empenhoHtml(d, emp) : '') + '</div>';
      var linhas = pagLinhas(d), mostra = pagTodas ? linhas : linhas.slice(0, 12), q = consultaSiac(d);
      h += '<section class="card md-pg-tab" aria-label="Medições e pagamentos"><div class="md-pg-tit"><h3>Medições e pagamentos</h3><small>' + esc((mostra.length < linhas.length ? mostra.length + ' de ' : '') + nMed(linhas.length) + (pagAbertas ? ' não pagas' : '') + ' · mais recentes primeiro' + (q ? ' · SIAC, consulta de ' + q : '')) + '</small>' +
        '<span class="md-pg-ctl">' + botao('pag-abertas', 'Só as não pagas', ' aria-pressed="' + pagAbertas + '"', 'small') + (cel ? '' : botao('pag-copiar', IC_COP + '<span>Copiar tabela</span>', '', 'small md-copiar com-txt')) + '</span></div>';
      if (!linhas.length) h += vazio('Nenhuma medição a pagar.');
      else if (cel) h += '<ul class="md-pg-lista">' + mostra.map(function (m) {
        var st = pagSit(d, m), rj = reajMed(d, m);
        return '<li>' + botao('pag-med', '<span><b>' + esc(m.n + 'ª · ' + mesTxt(idx(m.ref))) + '</b><small>' + esc(rj != null ? 'PI ' + n2(valor(m.total)) + ' + reaj. ' + n2(rj) : 'PI') + '</small></span><span class="md-pg-dir"><b>' + esc(dinheiro(totalMed(d, m))) + '</b>' + (st ? '<span class="md-chip-pg ' + st + '">' + (st === 'paga' ? IC_OK : st === 'apagar' ? IC_REL : '') + esc(pagTxt(d, m)) + '</span>' : '') + '</span>',
          ' data-n="' + esc(m.n) + '" aria-label="' + esc('Abrir a ' + m.n + 'ª medição, ' + mesTxt(idx(m.ref)) + ', ' + dinheiro(totalMed(d, m)) + (st ? ', ' + pagTxt(d, m) : '')) + '"', 'md-pg-linha' + (st === 'apagar' ? ' apagar' : '')) + '</li>';
      }).join('') + '</ul>';
      else h += '<div class="md-scroll" tabindex="0" role="region" aria-label="Medições e pagamentos, tabela com rolagem"><table class="md-tabela md-pg-tabela"><thead><tr><th scope="col">Med.</th><th scope="col">Competência</th><th scope="col" class="md-num">PI</th><th scope="col" class="md-num">Reajuste</th><th scope="col" class="md-num">Total</th><th scope="col" class="md-num">Processada</th><th scope="col">Pagamento</th><th scope="col">Processo de suporte (SEI)</th></tr></thead><tbody>' + mostra.map(function (m) {
        var x = sMed(d, m.n) || {}, st = pagSit(d, m), rj = reajMed(d, m);
        return '<tr' + (st === 'apagar' ? ' class="apagar"' : '') + '><td>' + botao('pag-med', esc(m.n + 'ª'), ' data-n="' + esc(m.n) + '" aria-label="' + esc('Abrir a ' + m.n + 'ª medição') + '"', 'small ghost md-pg-n') + '</td><td>' + esc(mesTxt(idx(m.ref))) + '</td><td class="md-num">' + esc(n2(valor(m.total))) + '</td><td class="md-num">' + esc(rj == null ? '—' : n2(rj)) + '</td><td class="md-num"><b>' + esc(n2(totalMed(d, m))) + '</b></td><td class="md-num">' + esc(x.processado ? dataTxt(x.processado) : '—') + '</td>' +
          '<td>' + (st === 'apagar' ? '<span class="md-chip-pg apagar">' + IC_REL + esc(pagTxt(d, m)) + '</span>' : st === 'paga' ? '<span class="md-pg-ok">' + IC_OK + esc(pagTxt(d, m).replace(/^Paga/, 'Aprovado')) + '</span>' : esc(pagTxt(d, m) || '—')) + '</td><td>' + (x.processo ? '<span class="md-pg-proc">' + esc(x.processo) + copiarBtn(x.processo, 'Copiar o processo da ' + m.n + 'ª') + '</span>' : '—') + '</td></tr>';
      }).join('') + '</tbody>' + (pagAbertas ? '' : '<tfoot><tr><td colspan="2"><b>' + esc(nMed(d.ms.length)) + '</b></td><td class="md-num"><b>' + esc(n2(p.pi)) + '</b></td><td class="md-num"><b>' + esc(p.nReaj ? n2(p.reaj) : '—') + '</b></td><td class="md-num"><b>' + esc(n2(p.tot)) + '</b></td><td colspan="3"></td></tr></tfoot>') + '</table></div>';
      if (linhas.length > 12) h += botao('pag-todas', pagTodas ? 'Mostrar só as 12 mais recentes ▴' : 'Ver as ' + nMed(linhas.length) + ' ▾', '', 'ghost md-accent md-pg-mais');
      return h + '</section>';
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
        return '<tr><td>' + esc(r.s.cod || '—') + '</td><td>' + esc(r.s.nome) + '</td><td class="md-num">' + (r.q == null ? '—' : fmtN(r.q) + ' ' + esc(op.unTxt(r.s.un))) + '</td><td class="md-num">' + dinheiro(r.v) + '</td><td>' + esc(r.locais.length ? r.locais.join(' · ') : r.semPonte ? 'Sem OAE' : 'Sem local informado') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    }
    // Por OAE / por segmento / por ponto: o km de cada um na lista, a régua do trecho do contrato e, ao tocar,
    // o painel com km inicial e final, a extensão e todas as medições que ele teve (o mesmo dado da lista: an.pontes[pid].meses)
    function segmentosHtml(c, d, m) {
      var cons = c.tipo === 'conserva', oae = c.tipo === 'oae', casas = cons ? 1 : 3, ps = op.pontos(c), an = d.an.pontes || {}, info = {}, ordemKm = {};
      ps.forEach(function (p, i) { info[p.id] = p; ordemKm[p.id] = i; });
      function vm(pid, n) { var x = an[pid]; return valor(x && x.meses && x.meses[n]); }
      function nomeP(pid) { var p = info[pid]; return (p && (p.nome || p.codigo)) || (an[pid] && an[pid].nome) || pid; }
      function kms(pid) { var p = info[pid] || {}; var ki = numero(p.kmIni), kf = numero(p.kmFim); if (ki == null) ki = kf; if (kf == null) kf = ki; return ki == null ? null : [Math.min(ki, kf), Math.max(ki, kf)]; }
      function ext(k) { var e = k[1] - k[0]; return e < 1 ? Math.round(e * 1000) + ' m' : decimal(e, 1) + ' km'; }
      // km para o texto: no 709, o das MPs ("km MP 301,1"); nos outros, o do site
      var mpK = kmMp(c, c.kmIni) != null, kmP = mpK ? 'km MP ' : 'km ';
      function kt(v, cs) { return kmTxt(mpK ? kmMp(c, v) : v, cs); }
      function nMeds(pid) { return d.ms.filter(function (x) { return vm(pid, x.n) !== 0; }).length; }
      var todos = Object.keys(an).concat(ps.map(function (p) { return p.id; }).filter(function (id) { return !an[id]; }));
      var com = todos.filter(function (pid) { return vm(pid, m.n) !== 0; });
      if (!com.length) return vazio('Esta medição não tem valores localizados ' + (oae ? 'nas OAEs' : cons ? 'nos segmentos' : 'nos pontos') + '.');
      var mostrarSem = segSem == null ? cons : segSem;
      var lista = (mostrarSem ? todos.filter(function (pid) { return an[pid] || info[pid]; }) : com).slice().sort(function (x, y) {
        if (segOrdem === 'valor') return vm(y, m.n) - vm(x, m.n);
        return (ordemKm[x] == null ? 1e9 : ordemKm[x]) - (ordemKm[y] == null ? 1e9 : ordemKm[y]);
      });
      if (segAberto && lista.indexOf(segAberto) < 0) { if (todos.indexOf(segAberto) >= 0) lista.push(segAberto); else segAberto = ''; }
      var rot = oae ? 'OAEs' : cons ? 'segmentos' : 'pontos', h = '';
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
          var tip = nomeP(p.id) + ', ' + kmP + kt(k[0], casas) + (k[1] > k[0] ? ' a ' + kt(k[1], casas) : '') + ', ' + (v ? dinheiro(v) : 'sem valor nesta medição');
          var st = cons ? 'flex-grow:' + Math.max(k[1] - k[0], .1).toFixed(2) : 'left:' + ((k[0] - ka) / L * 100).toFixed(2) + '%;width:' + Math.max((k[1] - k[0]) / L * 100, .4).toFixed(2) + '%';
          return '<button type="button" class="' + cls + '" data-md="ponte" data-p="' + esc(p.id) + '" style="' + st + '" title="' + esc(tip) + '" aria-label="' + esc(tip) + '">' + (cons ? esc(nomeP(p.id)) : '') + '</button>';
        }).join('') + '</div><div class="md-regua-eixo"><span>' + kmP + kt(ka, 1) + (cons ? ' · início do contrato' : '') + '</span><span>' + kmP + kt(kb, 1) + (cons ? ' · fim' : '') + '</span></div></div>';
      }
      // v222: a medição aberta inteira num Excel, uma aba por OAE/segmento/ponto (no formato da planilha de uma medição)
      var nXls = op.salvar ? com.filter(function (pid) { return ((an[pid] || {}).servicos || []).some(function (sv) { return temQv(sv, m.n); }); }).length : 0;
      if (nXls) h += '<div class="md-seg-xls">' + botao('seg-xls', 'Baixar Excel da ' + esc(m.n + 'ª') + ' · ' + (oae ? 'todas as OAEs' : cons ? 'todos os segmentos' : 'todos os pontos'), ' data-n="' + esc(m.n) + '"', 'small') +
        '<small>' + esc('Uma aba para ' + (oae ? 'cada OAE' : cons ? 'cada segmento' : 'cada ponto') + ' com serviço nesta medição (' + nXls + '), com código, serviço, unidade e quantidade, e um resumo na frente.') + '</small></div>';
      h += '<div class="md-segs md-segmentos' + (segAberto ? ' aberto' : '') + '">';
      lista.forEach(function (pid) {
        var k = kms(pid), v = vm(pid, m.n), on = segAberto === pid, nm = nMeds(pid);
        var faixaKm = k ? (cons ? kmP + kt(k[0], casas) + ' → ' + kmP + kt(k[1], casas) : 'km ' + kmTxt(k[0], casas) + (k[1] > k[0] ? ' a ' + kmTxt(k[1], casas) : '')) : 'sem km no cadastro';
        var resto = (k && k[1] > k[0] ? ext(k) + ' · ' : '') + nMed(nm);
        var nomeH = cons ? '<span class="md-seg-nome cons"><b>' + esc(nomeP(pid)) + '</b><span><strong>' + esc(faixaKm) + '</strong><small>' + esc(resto) + '</small></span></span>'
          : '<span class="md-seg-nome"><b>' + esc(nomeP(pid)) + '</b><small>' + esc(faixaKm + ' · ' + resto) + '</small></span>';
        h += '<button type="button" class="md-seg-btn' + (on ? ' on' : '') + '" data-md="ponte" data-p="' + esc(pid) + '" aria-expanded="' + on + '">' + nomeH +
          '<span class="md-seg-v' + (v ? '' : ' zero') + '">' + (v ? dinheiro(v) : 'sem valor') + '</span><span class="md-seg-seta" aria-hidden="true">' + (on ? '‹' : '›') + '</span></button>';
        if (on) h += painelHtml(pid);
      });
      var nSem = todos.filter(function (pid) { return (an[pid] || info[pid]) && vm(pid, m.n) === 0; }).length;
      h += '<div class="md-seg-mais">' + (nSem ? botao('ponte-sem', mostrarSem ? 'Esconder ' + (oae ? 'as ' : 'os ') + nSem + ' sem valor nesta medição' : 'Mostrar ' + (oae ? 'as ' : 'os ') + nSem + ' sem valor nesta medição', ' data-v="' + (mostrarSem ? '0' : '1') + '"', 'small ghost') : '') +
        botao('ponte-ordem', segOrdem === 'valor' ? 'Ordenar pelo km' : 'Ordenar por valor', '', 'small ghost') + '</div></div>';
      return h + '<small>' + (oae || cons ? 'Valores localizados na memória de cálculo.' : 'Valores pelo ponto de cada capítulo do SIAC.') + ' Serviços sem local entram apenas no total da medição. Toque ' + (oae ? 'numa OAE' : cons ? 'num segmento' : 'num ponto') + ' para ver o km e as medições.</small>';

      function painelHtml(pid) {
        var p = info[pid], k = kms(pid), v = vm(pid, m.n), lin = d.ms.filter(function (x) { return vm(pid, x.n) !== 0; }), acum = 0, mx = 0;
        lin.forEach(function (x) { acum += vm(pid, x.n); mx = Math.max(mx, Math.abs(vm(pid, x.n))); });
        var tit = oae ? 'OAE' + (p && p.codigo && p.codigo !== p.nome ? ' · ' + p.codigo : '') : cons ? 'Segmento · ' + nome(c) : 'Ponto · ' + nome(c);
        var h = '<section class="md-painel" aria-label="' + esc(nomeP(pid) + ': km e medições') + '"><div class="md-painel-top"><div><small>' + esc(tit) + '</small><h3>' + esc(nomeP(pid)) + '</h3></div>' +
          botao('ponte', '✕', ' data-p="' + esc(pid) + '" aria-label="Fechar"', 'small ghost') + '</div>';
        // v184: corpo e pé separados. No computador, o painel preso ao lado da lista tem a altura da tela: o corpo rola
        // dentro dele e o pé (Acumulado e botões) fica sempre à vista (antes, só aparecia quando a lista acabava)
        var pe = '';
        h += '<div class="md-painel-corpo"><div class="md-painel-kpis">' + [[kmP + 'inicial', k ? kt(k[0], 3) : '—'], [kmP + 'final', k ? kt(k[1], 3) : '—'], ['extensão', k && k[1] > k[0] ? ext(k) : '—']].map(function (x) {
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
              ' data-n="' + esc(x.n) + '" aria-pressed="' + (String(x.n) === String(m.n)) + '" aria-label="' + esc('Abrir a ' + x.n + 'ª medição, ' + mesTxt(idx(x.ref)) + ': ' + dinheiro(y)) + '"', 'md-hist');
          }).join('') + '</div>';
          if (desc.length > 8) h += botao('ponte-todas', segTodas ? 'Mostrar só as 8 últimas ▴' : 'Ver as ' + desc.length + ' medições ▾', '', 'small ghost md-accent');
          pe += '<div class="md-hist-acum"><span>Acumulado</span><span>' + esc(dinheiro(acum)) + '</span></div>';
        }
        var xs = lin.length && op.salvar ? xlsConta(c, d, pid, m) : null;
        pe += '<div class="md-painel-acoes">' + (p && op.diagramaPonto ? botao('ponte-diag', 'Ver no diagrama', ' data-p="' + esc(pid) + '"', 'small primary') : '') +
          (p && op.fotos && op.fotos(c) ? botao('ponte-fotos', 'Fotos ' + (oae ? 'da OAE' : cons ? 'do segmento' : 'do ponto'), ' data-p="' + esc(pid) + '"', 'small') : '') +
          botao('ponte-serv', 'Serviços nesta medição', ' data-p="' + esc(pid) + '" aria-pressed="' + segServ + '"', 'small') +
          (xs && xs.todas ? botao('ponte-xls', 'Baixar Excel ' + (segXls ? '▴' : '▾'), ' data-p="' + esc(pid) + '" aria-expanded="' + segXls + '"', 'small') : '') + '</div>';
        // v220: as duas planilhas (todas as medições dele, marcada; ou só a medição aberta, no formato simples)
        if (xs && xs.todas && segXls) pe += '<div class="md-xls" role="group" aria-label="Baixar Excel">' +
          botao('ponte-xls-ir', '<b>Todas as medições ' + (oae ? 'desta OAE' : cons ? 'deste segmento' : 'deste ponto') + '</b><small>' + esc(nMed(xs.meds) + ' · ' + xs.todas + (xs.todas === 1 ? ' serviço' : ' serviços') + ' · resumo, uma aba por medição, serviços × medições e lançamentos') + '</small>', ' data-p="' + esc(pid) + '" data-q="todas" data-n="' + esc(m.n) + '"', 'md-xls-op on') +
          botao('ponte-xls-ir', '<b>Só a ' + esc(m.n + 'ª') + ' medição</b><small>' + esc(xs.med ? xs.med + (xs.med === 1 ? ' serviço' : ' serviços') + ' · código, serviço, unidade e quantidade' : 'sem serviço localizado nesta medição') + '</small>', ' data-p="' + esc(pid) + '" data-q="med" data-n="' + esc(m.n) + '"' + (xs.med ? '' : ' disabled'), 'md-xls-op') + '</div>';
        if (segServ) {
          h += '<h4 class="md-painel-sv">Serviços nesta medição (' + esc(m.n + 'ª') + ')</h4>';
          var rows = ((an[pid] && an[pid].servicos) || []).map(function (s) { var qv = s.por && s.por[m.n]; return qv && (valor(qv[0]) || valor(qv[1])) ? { s: s, q: numero(qv[0]), v: valor(qv[1]) } : null; }).filter(Boolean)
            .sort(function (x, y) { return y.v - x.v; });
          h += rows.length ? '<div class="md-scroll" tabindex="0" role="region" aria-label="Serviços nesta medição"><table class="md-tabela md-tabela-p"><thead><tr><th scope="col">Serviço</th><th scope="col">Quantidade</th><th scope="col">Valor (PI)</th></tr></thead><tbody>' + rows.map(function (r) {
            var cod = servInfo(c, r.s).cod;
            return '<tr><td>' + esc((cod ? cod + ' · ' : '') + (r.s.nome || r.s.id || '')) + '</td><td class="md-num">' + (r.q == null ? '—' : fmtN(r.q) + ' ' + esc(op.unTxt(r.s.un))) + '</td><td class="md-num">' + dinheiro(r.v) + '</td></tr>';
          }).join('') + '</tbody></table></div>' : vazio('Sem serviços localizados nesta medição.');
        }
        return h + '</div><div class="md-painel-pe">' + pe + '</div></section>';
      }
    }
    function kmTxt(v, casas) { return v == null ? '—' : decimal(v, casas); }

    // ---------------- v220: Baixar Excel no painel da OAE, do segmento ou do ponto (pedido de 26/11/2026)
    // Código e nome completo: os da análise; no 424, que só tem o nome curto, os do cadastro do contrato (c.catServ, tirado
    // do relatório de controle financeiro do SIAC: { "nome curto": [código, nome completo, unidade] })
    function servInfo(c, s) {
      var cat = c && c.catServ && (c.catServ[s.nome] || (s.id && c.catServ[s.id])) || null;
      return { cod: String(s.cod || (cat && cat[0]) || '').trim(), nome: String((cat && cat[1]) || s.nome || s.id || ''), un: op.unTxt(s.un || (cat && cat[2]) || '') };
    }
    function temQv(s, n) { var qv = s.por && s.por[n]; return !!(qv && (valor(qv[0]) || valor(qv[1]))); }
    function xlsConta(c, d, pid, m) {
      var ss = ((d.an.pontes || {})[pid] || {}).servicos || [], meds = d.ms.filter(function (x) { return ss.some(function (s) { return temQv(s, x.n); }); }).length;
      return { meds: meds, todas: ss.filter(function (s) { return d.ms.some(function (x) { return temQv(s, x.n); }); }).length, med: ss.filter(function (s) { return temQv(s, m.n); }).length };
    }
    function semAcento(t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, ''); }
    function slug(t) { return semAcento(t).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40); }
    function dois(n) { return ('0' + n).slice(-2); }
    function cmpTxt(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
    function codXls(cod) { return /^\d{1,15}$/.test(cod) ? Number(cod) : cod || '—'; }
    function pontoXls(c, d, pid) {
      var p = op.pontos(c).filter(function (x) { return x.id === pid; })[0] || null, an = (d.an.pontes || {})[pid] || {};
      var nm = (p && (p.nome || p.codigo)) || an.nome || pid, ki = p ? numero(p.kmIni) : null, kf = p ? numero(p.kmFim) : null;
      if (ki == null) ki = kf; if (kf == null) kf = ki;
      var mp = kmMp(c, c.kmIni) != null, km = function (v) { return mp ? kmMp(c, v) : v; };
      var k = ki == null ? null : [Math.min(ki, kf), Math.max(ki, kf)];
      return { nome: nm, cod: p && p.codigo && p.codigo !== nm ? p.codigo : '', tipo: c.tipo === 'oae' ? 'OAE' : c.tipo === 'conserva' ? 'Segmento' : 'Ponto',
        kmR: mp ? 'km MP ' : 'km ', k: k ? [km(k[0]), km(k[1])] : null, ext: k && k[1] > k[0] ? (k[1] - k[0] < 1 ? Math.round((k[1] - k[0]) * 1000) + ' m' : decimal(k[1] - k[0], 1) + ' km') : '',
        servs: an.servicos || [], meses: an.meses || {} };
    }
    function arquivoXls(c, pt, fim) {
      var n = /(\d+)/.exec(nome(c));
      return [n ? 'CT' + n[1] : slug(nome(c)), slug(pt.cod).replace(/_/g, ''), slug(pt.nome), fim].filter(Boolean).join('_') + '.xlsx';
    }
    // só a medição aberta: Código | Serviço | Unidade | Quantidade, na ordem do código (como a tabela de referência)
    // v221: a mesma tabela vira uma aba por medição no "todas as medições" (pedido de 26/11/2026)
    function abaMed(P, c, pt, m, nomeAba) {
      var E = P.E, rows = pt.servs.filter(function (s) { return temQv(s, m.n); }).map(function (s) { return { i: servInfo(c, s), q: numero(s.por[m.n][0]) }; });
      if (!rows.length) return null;
      rows.sort(function (a, b) { return cmpTxt(a.i.cod || '￿', b.i.cod || '￿') || cmpTxt(a.i.nome, b.i.nome); });
      var tit = [nome(c), pt.tipo + ' ' + pt.nome + (pt.k ? ' (' + pt.kmR + decimal(pt.k[0], 3) + ')' : ''), m.n + 'ª medição', mesTxt(idx(m.ref))].join(' · ');
      var linhasX = [[{ v: tit, e: E.sTitulo }], [], ['Código', 'Serviço', 'Unidade', 'Quantidade'].map(function (t) { return { v: t, e: E.sCab }; })];
      rows.forEach(function (r) { linhasX.push([{ v: codXls(r.i.cod), e: E.sCentro }, { v: r.i.nome, e: E.sTxt }, { v: r.i.un, e: E.sCentro }, { v: r.q, e: E.sQtd }]); });
      return { nome: nomeAba, cols: [10, 62, 10, 14], linhas: linhasX, mesclar: ['A1:D1'] };
    }
    function xlsMed(P, c, d, pid, m) {
      var pt = pontoXls(c, d, pid), aba = abaMed(P, c, pt, m, pt.nome + ' ' + m.n + 'ª'), ref = String(m.ref || '').slice(0, 7);
      return aba ? { nome: arquivoXls(c, pt, m.n + 'a' + (ref ? '_' + ref : '')), abas: [aba] } : null;
    }
    // todas as medições dele: Resumo, uma aba por medição (v221), Serviços × medições e Lançamentos (os totais em fórmula, com o valor já calculado)
    function xlsTodas(P, c, d, pid) {
      var E = P.E, col = P.col, pt = pontoXls(c, d, pid), ordG = {}, rotG = {};
      (op.grupos(c) || []).forEach(function (g, i) { ordG[g.key] = i; rotG[g.key] = g.short || g.label || g.key; });
      var ms = d.ms.filter(function (m) { return pt.servs.some(function (s) { return temQv(s, m.n); }); });
      if (!ms.length) return null;
      var sv = pt.servs.filter(function (s) { return ms.some(function (m) { return temQv(s, m.n); }); }).map(function (s) {
        return { s: s, i: servInfo(c, s), o: ordG[s.g] == null ? 999 : ordG[s.g], gn: rotG[s.g] || 'Outros' };
      }).sort(function (a, b) { return a.o - b.o || cmpTxt(a.gn, b.gn) || cmpTxt(a.i.nome, b.i.nome); });
      function qv(x, n) { var r = x.s.por && x.s.por[n]; return r ? [numero(r[0]) || 0, valor(r[1])] : [0, 0]; }
      var LA = "'Lançamentos'!";
      // Lançamentos: uma linha por serviço em cada medição
      var lan = [['Medição', 'Competência', 'Etapa', 'Grupo', 'Código', 'Serviço', 'Un', 'Quantidade', 'Valor (PI)', 'Preço unitário (PI)', 'Processo SEI', 'Pagamento'].map(function (t) { return { v: t, e: E.cab }; })];
      var porMed = {}, total = 0;
      ms.forEach(function (m) {
        var x = sMed(d, m.n) || {}, pg = pagTxt(d, m) || '—';
        porMed[m.n] = 0;
        sv.forEach(function (it) {
          if (!temQv(it.s, m.n)) return;
          var a = qv(it, m.n), r = lan.length + 1;
          porMed[m.n] += a[1]; total += a[1];
          lan.push([{ v: Number(m.n), e: E.ordinal }, { v: mesTxt(idx(m.ref)), e: E.centro }, { v: m.etapa ? m.etapa + 'ª' : '', e: E.centro }, { v: it.gn, e: E.txt },
            { v: codXls(it.i.cod), e: E.centro }, { v: it.i.nome, e: E.txtQ }, { v: it.i.un, e: E.centro }, { v: a[0], e: E.qtd }, { v: a[1], e: E.rs },
            { f: 'IFERROR(I' + r + '/H' + r + ',0)', v: a[0] ? a[1] / a[0] : 0, e: E.rs }, { v: x.processo || '—', e: E.centro }, { v: pg, e: E.txt }]);
        });
      });
      var nl = lan.length;
      lan.push([{ e: E.tot }, { e: E.tot }, { e: E.tot }, { e: E.tot }, { e: E.tot }, { v: 'Total', e: E.totTxt }, { e: E.tot }, { e: E.tot }, { f: 'SUBTOTAL(9,I2:I' + nl + ')', v: total, e: E.totRs }, { e: E.tot }, { e: E.tot }, { e: E.tot }]);
      // Serviços × medições: grupos da vistoria, quantidade e valor em cada medição e o acumulado
      var mx = [[{ v: 'Quantidade e valor (PI) de cada serviço em cada medição', e: E.sTitulo }], [{ v: 'Traço = serviço não medido naquela medição.', e: E.sub }], []];
      var c1 = [{ v: 'Grupo', e: E.cab }, { v: 'Código', e: E.cab }, { v: 'Serviço', e: E.cab }, { v: 'Un', e: E.cab }], c2 = [{ e: E.cab }, { e: E.cab }, { e: E.cab }, { e: E.cab }], mes = ['A4:A5', 'B4:B5', 'C4:C5', 'D4:D5'];
      ms.concat([null]).forEach(function (m, j) {
        var cc = 4 + j * 2;
        c1.push({ v: m ? m.n + 'ª · ' + mesTxt(idx(m.ref)) : 'Acumulado', e: E.cab }, { e: E.cab });
        c2.push({ v: 'Qtd', e: E.cab }, { v: 'Valor', e: E.cab });
        mes.push(col(cc) + '4:' + col(cc + 1) + '4');
      });
      mx.push(c1, c2);
      var ultG = null, ncol = 4 + (ms.length + 1) * 2, ini = mx.length + 1;
      sv.forEach(function (it) {
        if (it.gn !== ultG) { ultG = it.gn; var g = [{ v: it.gn, e: E.grupo }]; for (var k = 1; k < ncol; k++) g.push({ e: E.grupo }); mx.push(g); }
        var r = mx.length + 1, l = [{ e: E.txt }, { v: codXls(it.i.cod), e: E.centro }, { v: it.i.nome, e: E.txtQ }, { v: it.i.un, e: E.centro }], sq = 0, sv2 = 0, fq = [], fv = [];
        ms.forEach(function (m, j) {
          var a = qv(it, m.n), cc = 4 + j * 2;
          sq += a[0]; sv2 += a[1]; fq.push(col(cc) + r); fv.push(col(cc + 1) + r);
          l.push({ v: a[0], e: E.qtd }, { v: a[1], e: E.rs });
        });
        l.push({ f: fq.join('+'), v: sq, e: E.qtdB }, { f: fv.join('+'), v: sv2, e: E.rsB });
        mx.push(l);
      });
      var fimM = mx.length, tl = [{ e: E.tot }, { e: E.tot }, { v: 'Total', e: E.totTxt }, { e: E.tot }];
      ms.concat([null]).forEach(function (m, j) {
        var cv = col(4 + j * 2 + 1);
        tl.push({ e: E.tot }, { f: 'SUM(' + cv + ini + ':' + cv + fimM + ')', v: m ? porMed[m.n] : total, e: E.totRs });
      });
      mx.push(tl);
      var cm = [18, 10, 56, 6];
      ms.concat([null]).forEach(function () { cm.push(10, 14); });
      // Resumo
      var hoje = new Date(), res = [[{ v: pt.tipo + ' ' + pt.nome + ' · serviços medidos', e: E.titulo }], [{ v: [nome(c), tipo(c)].join(' · '), e: E.sub }], []];
      [[pt.tipo, pt.nome + (pt.cod ? ' (' + pt.cod + ')' : '')], [pt.kmR + 'inicial', pt.k ? decimal(pt.k[0], 3) : '—'], [pt.kmR + 'final', pt.k ? decimal(pt.k[1], 3) : '—'],
        ['Extensão', pt.ext || '—'], ['Medições com serviço', nMed(ms.length) + ' de ' + d.ms.length], ['Valores', 'Preço inicial (PI), sem reajuste'],
        ['Fonte', 'Memória de cálculo das medições no VIA-230; processo e pagamento conforme a consulta ao SIAC'],
        ['Gerado em', dois(hoje.getDate()) + '/' + dois(hoje.getMonth() + 1) + '/' + hoje.getFullYear()]].forEach(function (x) { res.push([{ v: x[0], e: E.sub }, x[1]]); });
      res.push([]);
      res.push(['Medição', 'Competência', 'Etapa', 'Processo SEI', 'Pagamento', 'Valor (PI)', '% do acumulado'].map(function (t) { return { v: t, e: E.cab }; }));
      var r0 = res.length + 1, rt = r0 + ms.length, difs = [];
      ms.forEach(function (m) {
        var x = sMed(d, m.n) || {}, r = res.length + 1, vMes = valor(pt.meses[m.n]);
        if (Math.abs(vMes - porMed[m.n]) > 1) difs.push(m.n + 'ª: ' + dinheiro(vMes) + ' na análise, ' + dinheiro(porMed[m.n]) + ' nos serviços');
        res.push([{ v: Number(m.n), e: E.ordinal }, { v: mesTxt(idx(m.ref)), e: E.centro }, { v: m.etapa ? m.etapa + 'ª' : '', e: E.centro }, { v: x.processo || '—', e: E.centro },
          { v: pagTxt(d, m) || '—', e: E.txt }, { f: 'SUMIF(' + LA + '$A:$A,' + Number(m.n) + ',' + LA + '$I:$I)', v: porMed[m.n], e: E.rs },
          { f: 'IFERROR(F' + r + '/$F$' + rt + ',0)', v: total ? porMed[m.n] / total : 0, e: E.pct }]);
      });
      res.push([{ v: 'Acumulado', e: E.totTxt }, { e: E.tot }, { e: E.tot }, { e: E.tot }, { e: E.tot }, { f: 'SUM(F' + r0 + ':F' + (rt - 1) + ')', v: total, e: E.totRs }, { e: E.tot }]);
      res.push([]);
      res.push([{ v: 'Medição registra quantidade e valor; não comprova execução.', e: E.sub }]);
      if (difs.length) res.push([{ v: 'Valor da medição diferente da soma dos serviços (' + difs.join('; ') + ').', e: E.sub }]);
      return { nome: arquivoXls(c, pt, 'servicos_' + hoje.getFullYear() + '-' + dois(hoje.getMonth() + 1) + '-' + dois(hoje.getDate())), abas: [
        { nome: 'Resumo', cols: [24, 13, 8, 24, 26, 18, 15], linhas: res, paisagem: true },
      ].concat(ms.map(function (m) { return abaMed(P, c, pt, m, m.n + 'ª · ' + mesTxt(idx(m.ref)).replace('/', '-')); }).filter(Boolean), [
        { nome: 'Serviços × medições', cols: cm, linhas: mx, mesclar: mes, congelar: 'E6', paisagem: true },
        { nome: 'Lançamentos', cols: [9, 12, 7, 20, 10, 60, 6, 12, 15, 17, 23, 22], linhas: lan, congelar: 'A2', filtro: 'A1:L' + nl, paisagem: true }
      ]) };
    }
    var planilhaP = null;
    function comPlanilha() {
      if (window.Planilha) return Promise.resolve(window.Planilha);
      if (planilhaP) return planilhaP;
      planilhaP = new Promise(function (ok, no) {
        var s = document.createElement('script');
        s.src = 'planilha.js';
        s.onload = function () { if (window.Planilha) ok(window.Planilha); else no(new Error('gerador incompleto')); };
        s.onerror = function () { planilhaP = null; s.remove(); no(new Error('sem sinal para carregar o gerador')); };
        document.head.appendChild(s);
      });
      return planilhaP;
    }
    // v222: uma medição, todas as OAEs (segmentos, pontos): Resumo e uma aba por OAE com serviço nesta medição, na ordem do km
    function xlsMedTodas(P, c, d, m) {
      var E = P.E, an = d.an.pontes || {}, ordem = op.pontos(c).map(function (p) { return p.id; });
      var pids = ordem.filter(function (id) { return an[id]; }).concat(Object.keys(an).filter(function (id) { return ordem.indexOf(id) < 0; }))
        .filter(function (id) { return (an[id].servicos || []).some(function (s) { return temQv(s, m.n); }); });
      if (!pids.length) return null;
      var rot = c.tipo === 'oae' ? 'OAE' : c.tipo === 'conserva' ? 'Segmento' : 'Ponto', abas = [], linhasR = [], tot = 0;
      linhasR.push([{ v: [nome(c), m.n + 'ª medição', mesTxt(idx(m.ref)), 'serviços por ' + (c.tipo === 'oae' ? 'OAE' : rot.toLowerCase())].join(' · '), e: E.sTitulo }], [{ v: tipo(c) + ' · valores em preço inicial (PI), sem reajuste', e: E.sub }], []);
      linhasR.push([rot, 'Código', 'km inicial', 'km final', 'Serviços', 'Valor (PI)', 'Aba'].map(function (t) { return { v: t, e: E.cab }; }));
      var r0 = linhasR.length + 1;
      pids.forEach(function (pid) {
        var pt = pontoXls(c, d, pid), nomeA = (pt.cod && pt.cod !== pt.nome ? pt.cod + ' ' : '') + pt.nome, aba = abaMed(P, c, pt, m, nomeA);
        abas.push(aba);
        var ss = pt.servs.filter(function (s) { return temQv(s, m.n); }), v = ss.reduce(function (a, s) { return a + valor(s.por[m.n][1]); }, 0);
        v = Math.round(v * 100) / 100; tot = Math.round((tot + v) * 100) / 100;
        linhasR.push([{ v: pt.nome, e: E.txt }, { v: pt.cod || '—', e: E.centro }, { v: pt.k ? decimal(pt.k[0], 3) : '—', e: E.centro }, { v: pt.k ? decimal(pt.k[1], 3) : '—', e: E.centro },
          { v: ss.length, e: E.centro }, { v: v, e: E.rs }, { v: '', e: E.centro, aba: aba }]);
      });
      var rt = linhasR.length;
      linhasR.push([{ v: 'Total nas ' + (c.tipo === 'oae' ? 'OAEs' : c.tipo === 'conserva' ? 'segmentos' : 'pontos'), e: E.totTxt }, { e: E.tot }, { e: E.tot }, { e: E.tot }, { e: E.tot }, { f: 'SUM(F' + r0 + ':F' + rt + ')', v: tot, e: E.totRs }, { e: E.tot }]);
      linhasR.push([]);
      var tm = valor(m.total);
      linhasR.push([{ v: 'Total da medição (PI)', e: E.sub }, null, null, null, null, { v: tm, e: E.rs }]);
      if (Math.abs(tm - tot) > 1) linhasR.push([{ v: 'Sem local (administração, mobilização, canteiro e o que a memória não localiza)', e: E.sub }, null, null, null, null, { f: 'F' + (rt + 3) + '-F' + (rt + 1), v: Math.round((tm - tot) * 100) / 100, e: E.rs }]);
      linhasR.push([{ v: 'Medição registra quantidade e valor; não comprova execução.', e: E.sub }]);
      var ref = String(m.ref || '').slice(0, 7), num = /(\d+)/.exec(nome(c));
      var todasAbas = [{ nome: 'Resumo', cols: [34, 10, 11, 11, 10, 17, 24], linhas: linhasR, paisagem: true }].concat(abas);
      P.nomes(todasAbas);   // nomes finais das abas (sem repetir), para a coluna "Aba" do resumo
      linhasR.forEach(function (l) { l.forEach(function (x) { if (x && x.aba) { var lk = P.link(x.aba.nome); x.f = lk.f; x.v = lk.v; delete x.aba; } }); });
      return { nome: [num ? 'CT' + num[1] : slug(nome(c)), m.n + 'a' + (ref ? '_' + ref : ''), c.tipo === 'oae' ? 'OAEs' : c.tipo === 'conserva' ? 'segmentos' : 'pontos'].join('_') + '.xlsx', abas: todasAbas };
    }
    function baixarXls(c, d, pid, m, todas) {
      return comPlanilha().then(function (P) {
        var x = todas === 'med' ? xlsMedTodas(P, c, d, m) : todas ? xlsTodas(P, c, d, pid) : xlsMed(P, c, d, pid, m);
        if (!x) { op.toast('Sem serviços localizados para a planilha.'); return; }
        return op.salvar(x.nome, P.xlsx(x.abas), 'Planilha pronta: ' + x.nome);
      }).catch(function (e) { op.toast('Não foi possível montar a planilha: ' + ((e && e.message) || e), 6000); });
    }
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
    function mil(v) { return v === 0 ? '0' : fmtN(Math.round(v / 1000)); }
    // Por mês: no celular (até 700 px) 6 meses com o contrato parado à esquerda; no computador 16 meses, barra do total, "12 meses" e "Última"
    var TIPOS = [['conserva', 'Conservação', 'Cons.'], ['pc', 'Pontos críticos', 'PC'], ['oae', 'OAEs', 'OAE'], ['sinal', 'Sinalização', 'Sinal.'], ['sup', 'Supervisão', 'Superv.']];
    function tipoChave(c) { return ehSup(c) ? 'sup' : c.tipo === 'oae' ? 'oae' : sinal(c) ? 'sinal' : c.tipo === 'conserva' ? 'conserva' : 'pc'; }
    function tipoNome(c, i) { var k = tipoChave(c); return TIPOS.filter(function (t) { return t[0] === k; })[0][i]; }
    function loteCurto(c) { var m = /lote\s*(\d+|único|unico)/i.exec(String(c.lote || '')); return !m ? '' : /^\d/.test(m[1]) ? 'L' + m[1] : 'Único'; }
    function curto(c) { return nome(c).replace(/\/\d{4}$/, ''); }
    function celular() { return !!(mqCel && mqCel.matches); }
    // ok/zero: tem medição · antes: antes da 1ª · sem: buraco entre medições · falta: depois da última, ainda não saiu no SIAC · fim: depois do fim da execução
    function estadoMes(d, i) {
      var cell = d.porMes[i];
      if (cell) return cell.total === 0 ? 'zero' : 'ok';
      if (!d.comps.length || i < d.comps[0]) return 'antes';
      if (i > d.comps[d.comps.length - 1]) return d.fim != null && i > d.fim ? 'fim' : 'falta';
      return 'sem';
    }
    function mensalHtml(cs) {
      var min = null, max = hoje() - 1, recente = null;
      cs.forEach(function (c) { var d = dado(c); if (!d || !d.comps.length) return; min = min == null ? d.comps[0] : Math.min(min, d.comps[0]); recente = recente == null ? d.comps[d.comps.length - 1] : Math.max(recente, d.comps[d.comps.length - 1]); max = Math.max(max, recente); });
      if (min == null) return cabecalho(cs) + vazio('Aguardando medições com competência registrada.') + '<div class="md-cards">' + cs.filter(function (c) { return !semMedicoes(c); }).map(cartao).join('') + '</div>' + semMedicoesHtml(cs, false);
      if (mesSel == null) mesSel = recente;
      var todos = cs.filter(function (c) { var d = dado(c); return d && d.ms.length; });
      var presentes = TIPOS.filter(function (t) { return todos.some(function (c) { return tipoChave(c) === t[0]; }); });
      if (tipoMes && !presentes.some(function (t) { return t[0] === tipoMes; })) tipoMes = '';
      var carregados = todos.filter(function (c) { return !tipoMes || tipoChave(c) === tipoMes; });
      var cel = celular(), span = cel ? 6 : 16, doze = max - 11;
      var de = janela == null ? Math.max(min, max - span + 1) : Math.max(min, Math.min(janela, Math.max(min, max - span + 1))), fim = Math.min(max, de + span - 1), cols = [];
      for (var i = de; i <= fim; i++) cols.push(i);
      var consultas = [];
      todos.forEach(function (c) { var s = dado(c).an.siac, q = s && s.consulta; if (q && consultas.indexOf(q) < 0) consultas.push(q); });
      var consultaTxt = consultas.length ? ' (consulta de ' + consultas.sort().map(dataTxt).join(', ') + ')' : '';
      function stat(i) {
        var s = { tot: 0, k: 0, nf: 0 };
        carregados.forEach(function (c) { var d = dado(c), e = estadoMes(d, i); if (e === 'ok' || e === 'zero') { s.tot += d.porMes[i].total; s.k++; } else if (e === 'falta') s.nf++; });
        return s;
      }
      var st = {}; cols.forEach(function (i) { st[i] = stat(i); });
      var topo = Math.max.apply(null, cols.map(function (i) { return st[i].tot; })) || 1;
      var h = cabecalho(cs) + '<p class="md-mes-ajuda">Valor em R$ mil (PI). Toque num número para abrir a medição; no mês, para ver a lista dele.' + (cel ? '' : ' As barras em cima são o total de cada mês.') + '</p>';
      var chips = [['', 'Todos', todos.length]].concat(presentes.map(function (t) { return [t[0], t[1], todos.filter(function (c) { return tipoChave(c) === t[0]; }).length]; }));
      h += '<div class="md-mes-ctl">' + (presentes.length > 1 ? '<div class="md-chips" role="group" aria-label="Tipo de contrato">' + chips.map(function (t) {
        return botao('tipomes', esc(t[1]) + '<small>' + t[2] + '</small>', ' data-v="' + t[0] + '" aria-pressed="' + (tipoMes === t[0]) + '"', 'md-chip');
      }).join('') + '</div>' : '') + '<div class="md-links md-janela">' + botao('janela', cel ? '‹ Anteriores' : '← Anteriores', ' data-v="' + (de - span) + '"' + (de <= min ? ' disabled' : '')) +
        (cel ? '<span>' + esc(mesTxt(de) + ' a ' + mesTxt(fim)) + '</span>' : '') + botao('janela', cel ? '›' : 'Mais recentes →', ' data-v="' + (de + span) + '"' + (cel ? ' aria-label="Mais recentes"' : '') + (fim >= max ? ' disabled' : '')) + '</div></div>';
      h += '<div class="card md-scroll md-matriz-scroll ' + (cel ? 'md-cel' : 'md-pc') + '" tabindex="0" role="region" aria-label="Matriz de medições, com rolagem horizontal"><table class="md-matriz"><caption class="sr-only">Valor PI por contrato e competência, em R$ mil</caption><thead><tr><th scope="col" class="md-nm">' + (cel ? '' : 'Contrato') + '</th>' + cols.map(function (i) {
        var s = st[i], parc = s.nf > 0, sub = parc ? 'faltam ' + s.nf : s.k ? s.k + '/' + s.k : '', tot = 'Total de ' + mesTxt(i) + ': ' + dinheiro(s.tot) + ' PI' + (parc ? ' (parcial)' : '');
        return '<th scope="col">' + (cel ? '' : '<button type="button" class="md-barra-mes" data-md="mes" data-v="' + i + '" aria-pressed="' + (i === mesSel) + '" aria-label="' + esc(tot) + '" title="' + esc(tot) + '"><i class="' + (i === mesSel ? 's' : parc ? 'p' : '') + '" style="height:' + Math.max(2, s.tot / topo * 44).toFixed(1) + 'px"></i></button>') +
          botao('mes', esc(mesTxt(i)) + '<small>' + (sub || '&nbsp;') + '</small>', ' data-v="' + i + '" aria-pressed="' + (i === mesSel) + '"' + (parc ? ' aria-label="' + esc(mesTxt(i) + ', faltam ' + s.nf + ' contratos no SIAC') + '"' : ''), 'md-mh' + (parc ? ' parc' : '')) + '</th>';
      }).join('') + (cel ? '' : '<th scope="col" class="md-x">12 meses<small>' + esc(mesTxt(doze) + ' a ' + mesTxt(max)) + '</small></th><th scope="col" class="md-x">Última<small>no SIAC</small></th>') + '</tr></thead><tbody>';
      var t12 = 0, temApagar = false;
      carregados.forEach(function (c) {
        var d = dado(c), consulta = d.an.siac && d.an.siac.consulta, lt = loteCurto(c);
        h += '<tr><th scope="row" class="md-nm" title="' + esc(nome(c)) + '">' + (cel ? '<b>' + esc(curto(c).replace(/^CT /, '')) + '</b><small>' + esc(tipoNome(c, 2) + (lt && c.tipo !== 'oae' ? ' · ' + lt : '')) + '</small>'
          : esc(curto(c)) + '<small>' + esc(c.tipo === 'oae' ? 'OAEs' : [c.lote, tipoCurto(c)].filter(Boolean).join(' · ')) + '</small>') + '</th>' + cols.map(function (i) {
          var e = estadoMes(d, i), cell = d.porMes[i], txt, cls, tip = nome(c) + ' · ' + mesTxt(i);
          if (cell) {
            txt = cell.total === 0 ? '0' : mil(cell.total); cls = cell.total === 0 ? 'md-zero' : 'md-tom' + tom(cell.total); tip += ' · ' + dinheiro(cell.total) + ' PI' + (cell.total === 0 ? ' · medição zerada' : '');
            var apM = cell.ms.filter(function (m) { return pagSit(d, m) === 'apagar'; });
            if (apM.length) { cls += ' md-apagar'; temApagar = true; tip += ' · a pagar: ' + apM.map(function (m) { return pagTxt(d, m); }).join(', '); }
          }
          else if (e === 'falta') { txt = '…'; cls = 'md-pend'; tip += ': ainda não saiu no SIAC' + (consulta ? ' (consulta de ' + dataTxt(consulta) + ')' : ''); }
          else if (e === 'sem') { txt = '—'; cls = 'md-ausente'; tip += ': sem medição neste mês'; }
          else { txt = ''; cls = 'md-branco'; tip += e === 'antes' ? ': antes da 1ª medição' : ': depois do fim da execução (' + mesTxt(d.fim) + ')'; }
          return '<td>' + botao(cell ? 'celula' : 'mes', esc(txt), ' data-cid="' + esc(c.id) + '" data-v="' + i + '" aria-label="' + esc(tip) + '" title="' + esc(tip) + '" aria-pressed="' + (i === mesSel) + '"', cls) + '</td>';
        }).join('');
        if (!cel) {
          var s12 = 0, atraso = d.ultima == null ? 0 : Math.max(0, hoje() - 1 - d.ultima), acabou = d.fim != null && d.fim < hoje() - 1 && d.ultima >= d.fim;
          for (var j = doze; j <= max; j++) if (d.porMes[j]) s12 += d.porMes[j].total;
          t12 += s12;
          h += '<td class="md-x"><b>' + mil(s12) + '</b></td><td class="md-x">' + (d.ult ? esc(d.ult.n + 'ª · ' + mesTxt(d.ultima)) + '<small' + (atraso >= 3 && !acabou ? ' class="md-atraso"' : '') + '>' + (acabou ? 'fim da execução' : atraso ? 'há ' + atraso + (atraso === 1 ? ' mês' : ' meses') : 'em dia') + '</small>' : '—') + '</td>';
        }
        h += '</tr>';
      });
      h += '<tr><th scope="row" class="md-nm">' + (cel ? '<b>Total</b><small>R$ mil</small>' : 'Total do mês<small>R$ mil (PI)</small>') + '</th>' + cols.map(function (i) {
        return '<td>' + botao('mes', mil(st[i].tot) + (st[i].nf ? '<small>parcial</small>' : ''), ' data-v="' + i + '" aria-pressed="' + (i === mesSel) + '"', 'md-tot') + '</td>';
      }).join('') + (cel ? '' : '<td class="md-x"><b>' + mil(t12) + '</b></td><td></td>') + '</tr></tbody></table></div>';
      h += semMedicoesHtml(cs, false);
      h += '<div class="md-legenda">' + (cel ? [[1, 'até 250'], [3, '500 a 1.000'], [5, 'mais de 2.000']] : [[1, 'até 250'], [2, '250 a 500'], [3, '500 a 1.000'], [4, '1.000 a 2.000'], [5, 'mais de 2.000']]).map(function (x) { return '<span><i class="md-swatch md-tom' + x[0] + '"></i>' + esc(x[1]) + '</span>'; }).join('') +
        (temApagar ? '<span><i class="md-swatch md-apagar-sw"></i>a pagar no SIAC (AES emitido)</span>' : '') + '<span><i class="md-swatch md-zero"></i>zerada</span><span><i class="md-swatch md-ausente"></i>— sem medição no mês</span><span><i class="md-swatch md-pend"></i>' + esc('… ainda não saiu no SIAC' + consultaTxt) + '</span>' + (cel ? '' : '<span>em branco: antes da 1ª medição</span>') + '</div>';
      // o mês escolhido: só quem mediu, do maior para o menor, e uma caixa com os que ainda não saíram no SIAC
      var s = stat(mesSel), quem = [], grupos = {}, sem = [];
      carregados.forEach(function (c) {
        var d = dado(c), cell = d.porMes[mesSel], e = estadoMes(d, mesSel);
        if (cell) cell.ms.forEach(function (m) { quem.push({ c: c, m: m }); });
        else if (e === 'falta') (grupos[d.ultima] = grupos[d.ultima] || []).push(c);
        else if (e === 'sem') sem.push(c);
      });
      quem.sort(function (a, b) { return valor(b.m.total) - valor(a.m.total); });
      var maior = quem.reduce(function (x, q) { return Math.max(x, Math.abs(valor(q.m.total))); }, 0) || 1;
      var lista = quem.map(function (q) {
        var v = valor(q.m.total), lt = loteCurto(q.c), dq = dado(q.c), pq = pagTxt(dq, q.m), sq = pagSit(dq, q.m);
        return '<button type="button" class="md-linha-mes" data-md="abrir" data-cid="' + esc(q.c.id) + '" data-n="' + esc(q.m.n) + '" aria-label="' + esc('Abrir a ' + q.m.n + 'ª medição de ' + nome(q.c) + ', ' + dinheiro(v) + ' PI') + '"><span><b>' + esc(curto(q.c)) + '</b> <small>' + esc(tipoNome(q.c, 1) + (lt && q.c.tipo !== 'oae' ? ' · ' + lt : '') + ' · ' + q.m.n + 'ª medição' + (v ? '' : ' · zerada')) + '</small>' + (pq && sq !== 'zerada' ? '<small class="md-linha-pg' + (sq === 'apagar' ? ' apagar' : '') + '">' + esc(pq) + '</small>' : '') + '</span><b>' + esc(dinheiro(v)) + '</b><span aria-hidden="true">›</span><span class="md-linha-bar" aria-hidden="true"><i style="width:' + largura(Math.abs(v) / maior * 100) + '%"></i></span></button>';
      }).join('');
      var box = s.nf ? '<div class="md-pend-box"><b>' + s.nf + (s.nf === 1 ? ' contrato ainda sem a medição de ' : ' contratos ainda sem a medição de ') + esc(mesTxt(mesSel)) + ' no SIAC</b>' + esc(consultaTxt) + Object.keys(grupos).map(Number).sort(function (a, b) { return a - b; }).map(function (u) {
        var n = Math.max(0, hoje() - 1 - u);
        return '<div>Última em <b>' + esc(mesTxt(u)) + '</b>' + (n >= 3 ? ' · <b>' + n + ' meses</b>' : '') + ': ' + esc(grupos[u].map(curto).join(' · ')) + '</div>';
      }).join('') + '</div>' : '';
      if (sem.length) box += '<p class="md-sem-mes">Sem medição neste mês: ' + esc(sem.map(curto).join(' · ')) + '</p>';
      var esperado = s.k + s.nf;
      return h + '<section class="card md-card md-mes-det' + (box && quem.length ? ' com-pend' : '') + '"><div><div class="md-top"><h2>' + esc(mesTxt(mesSel)) + (s.nf ? ' <span class="md-tag">parcial</span>' : '') + '</h2><strong>' + dinheiro(s.tot) + ' (PI)</strong></div>' +
        '<p class="md-mes-sub">' + (s.k ? (s.nf ? s.k + ' de ' + esperado + ' contratos já mediram' : s.k + (s.k === 1 ? ' contrato mediu' : ' contratos mediram')) + ' · ' + nMed(quem.length) : 'Nenhuma medição de ' + esc(mesTxt(mesSel)) + ' nos dados carregados') + '</p>' +
        (lista ? '<div class="md-linhas">' + lista + '</div>' : '') + '</div>' + (box ? '<div>' + box + '</div>' : '') + '</section>';
    }

    function render() {
      var cs = permitidos(), ids = cs.map(function (c) { return c.id; });
      Object.keys(cache).forEach(function (id) { if (ids.indexOf(id) < 0) delete cache[id]; });
      if (!op.ativa() || !cs.length) { fechaFolha(); host.innerHTML = ''; return; }
      if (cid && !contrato(cid)) { cid = ''; med = null; }
      // a busca conserva o foco e a seleção quando chega outra análise enquanto a pessoa digita
      var input = document.activeElement, focado = input && host.contains(input) ? input.id : '', ini = input && input.selectionStart, fim = input && input.selectionEnd;
      var matriz = host.querySelector('.md-matriz-scroll');
      if (matriz && matriz.clientWidth) matrizScroll = matriz.scrollLeft + matriz.clientWidth >= matriz.scrollWidth - 1 ? null : matriz.scrollLeft;
      var folhaEl = host.querySelector('.md-folha .esc-f'), folhaY = folhaEl ? folhaEl.scrollTop : 0;
      host.innerHTML = cid ? contratoHtml(contrato(cid)) : modo === 'mes' ? mensalHtml(cs) : modo === 'sit' ? situacaoHtml(cs) : inicioHtml(cs);
      matriz = host.querySelector('.md-matriz-scroll');
      if (matriz) matriz.scrollLeft = matrizScroll == null ? matriz.scrollWidth : matrizScroll;
      if (focado) { var novo = document.getElementById(focado); if (novo) { novo.focus({ preventScroll: true }); if (novo.setSelectionRange && ini != null) novo.setSelectionRange(ini, fim); } }
      if (folha) { folhaEl = host.querySelector('.md-folha .esc-f'); if (folhaEl) { folhaEl.scrollTop = folhaY; folhaEl.focus({ preventScroll: true }); } else fechaFolha(); }
    }
    function abrir(id, n, ab) {
      if (!contrato(id)) return;
      if (id !== cid) { secao = 'med'; pagTodas = false; pagAbertas = false; }
      if (n != null) secao = 'med';
      if (ab === 'pag' || ab === 'ct') secao = ab;
      cid = id; med = n == null ? null : n; etapas = {}; grupo = null; aba = 'grupos'; semValor = false; segAberto = ''; segTodas = false; segServ = false; segXls = false; segSem = null; segOrdem = 'km';
      var d = dado(contrato(id));
      if (d && n != null) d.ms.forEach(function (m) { if (String(m.n) === String(n)) etapas[String(m.etapa)] = true; });
      render(); window.scrollTo(0, 0);
      var titulo = host.querySelector('#mdTituloMed'); if (titulo) titulo.focus({ preventScroll: true });
    }
    host.addEventListener('click', function (ev) {
      if (ev.target.classList && ev.target.classList.contains('md-folha')) { fechaFolha(); return; }
      var b = ev.target.closest('[data-md]'); if (!b || !host.contains(b) || !op.ativa()) return;
      var act = b.dataset.md, daFolha = false;
      if (act === 'folha') { abreFolha(); return; }
      if (act === 'folha-x') { fechaFolha(); return; }
      if (act === 'diagrama') { var c = contrato(b.dataset.cid); if (c) op.diagrama(c); return; }
      if (act === 'abrir') { abrir(b.dataset.cid, b.dataset.n); return; }
      if (act === 'abrir-ab') { abrir(b.dataset.cid, null, b.dataset.ab); return; }
      if (act === 'copiar') { copiar(b.dataset.txt || '', 'Copiado.'); return; }
      if (act === 'pag-copiar') { var cc = contrato(cid), dc = cc && dado(cc); if (dc) copiar(pagTabelaTxt(cc, dc), 'Tabela copiada: cole na planilha.'); return; }
      if (act === 'pag-med') { abrir(cid, b.dataset.n); return; }
      if (act === 'ponte-diag' || act === 'ponte-fotos') {
        var cp = contrato(cid), pp = cp && op.pontos(cp).filter(function (x) { return x.id === b.dataset.p; })[0];
        if (pp) (act === 'ponte-diag' ? op.diagramaPonto : op.fotos)(cp, pp);
        return;
      }
      if (act === 'voltar') { cid = ''; med = null; segAberto = ''; }
      else if (act === 'modo') { modo = b.dataset.v === 'mes' || b.dataset.v === 'sit' ? b.dataset.v : 'contrato'; cid = ''; matrizScroll = null; }
      else if (act === 'med') { daFolha = folha; fechaFolha(); med = b.dataset.n; grupo = null; semValor = false; }
      else if (act === 'passo') {
        var dp = dado(contrato(cid)), mp = dp && aberta(dp), vz = mp ? vizinhas(dp, mp) : {}, alvo = b.dataset.v === '-1' ? vz.ant : vz.prox;
        if (alvo) { med = alvo.n; grupo = null; semValor = false; }
      }
      else if (act === 'etapa') {
        var d = dado(contrato(cid)), key = b.dataset.e, naFolha = folha && b.closest('.md-folha');
        etapas[key] = !(Object.prototype.hasOwnProperty.call(etapas, key) ? etapas[key] : d && d.ult && String(d.ult.etapa) === key);
        if (naFolha) {
          naFolha.querySelector('.md-etapas').innerHTML = etapasHtml(d);
          var etF = naFolha.querySelectorAll('[data-md="etapa"]');
          for (var k = 0; k < etF.length; k++) if (etF[k].dataset.e === key) etF[k].focus({ preventScroll: true });
          return;
        }
      }
      else if (act === 'aba') aba = b.dataset.v;
      else if (act === 'secao') secao = b.dataset.v === 'pag' || b.dataset.v === 'ct' ? b.dataset.v : 'med';
      else if (act === 'pag-todas') pagTodas = !pagTodas;
      else if (act === 'pag-abertas') { pagAbertas = !pagAbertas; pagTodas = false; }
      else if (act === 'ponte') { segAberto = segAberto === b.dataset.p ? '' : b.dataset.p; segTodas = false; segServ = false; segXls = false; }
      else if (act === 'ponte-todas') segTodas = !segTodas;
      else if (act === 'ponte-serv') segServ = !segServ;
      else if (act === 'ponte-xls') segXls = !segXls;
      else if (act === 'seg-xls') {
        var cs = contrato(cid), ds = cs && dado(cs), msx = null;
        if (ds) ds.ms.forEach(function (x) { if (String(x.n) === String(b.dataset.n)) msx = x; });
        if (cs && ds && msx) baixarXls(cs, ds, '', msx, 'med');
        return;
      }
      else if (act === 'ponte-xls-ir') {
        var cx = contrato(cid), dx = cx && dado(cx), mx = null;
        if (dx) dx.ms.forEach(function (x) { if (String(x.n) === String(b.dataset.n)) mx = x; });
        if (cx && dx && mx) baixarXls(cx, dx, b.dataset.p, mx, b.dataset.q === 'todas');
        segXls = false;
      }
      else if (act === 'ponte-sem') segSem = b.dataset.v === '1';
      else if (act === 'ponte-ordem') segOrdem = segOrdem === 'valor' ? 'km' : 'valor';
      else if (act === 'grupo') grupo = grupo === b.dataset.g ? '' : b.dataset.g;
      else if (act === 'semvalor') semValor = !semValor;
      else if (act === 'resumo') resumoCel = !resumoCel;
      else if (act === 'janela') janela = Number(b.dataset.v);
      else if (act === 'tipomes') tipoMes = b.dataset.v || '';
      else if (act === 'mes' || act === 'celula') {
        mesSel = Number(b.dataset.v);
        if (act === 'celula') { var dm = dado(contrato(b.dataset.cid)), ce = dm && dm.porMes[mesSel]; if (ce && ce.ms.length === 1) { abrir(b.dataset.cid, ce.ms[0].n); return; } }
      } else if (act === 'tentar') { var ct = contrato(b.dataset.cid); if (ct) op.repetir(ct); carregar(); }
      else return;
      // o corpo do painel tem rolagem própria (v184): o desenho novo volta ao mesmo ponto; ao ligar os serviços, vai até eles
      var pc0 = host.querySelector('.md-painel-corpo'), rol0 = pc0 && segAberto ? pc0.scrollTop : 0;
      render();
      var pc1 = host.querySelector('.md-painel-corpo');
      if (pc1 && rol0) pc1.scrollTop = rol0;
      if (pc1 && act === 'ponte-serv' && segServ) { var sv = pc1.querySelector('.md-painel-sv'); if (sv) pc1.scrollTop = Math.max(0, sv.offsetTop - pc1.offsetTop - 8); }
      if (act === 'ponte-xls-ir') { var bx = host.querySelector('[data-md="ponte-xls"]'); if (bx) bx.focus({ preventScroll: true }); return; }
      var alvos = host.querySelectorAll('[data-md="' + act + '"]');
      for (var i = 0; i < alvos.length; i++) if (alvos[i].dataset.n === b.dataset.n && alvos[i].dataset.g === b.dataset.g && alvos[i].dataset.e === b.dataset.e && alvos[i].dataset.v === b.dataset.v && alvos[i].dataset.p === b.dataset.p && alvos[i].className === b.className) { alvos[i].focus({ preventScroll: true }); break; }
      if (daFolha || (act === 'passo' && !host.contains(document.activeElement))) focaSeletor();
    });
    // a folha do celular: Esc fecha, Tab não sai dela
    document.addEventListener('keydown', function (ev) {
      if (!folha) return;
      if (ev.key === 'Escape') { ev.preventDefault(); fechaFolha(); return; }
      if (ev.key !== 'Tab') return;
      var l = [].filter.call(host.querySelectorAll('.md-folha button'), function (x) { return x.offsetParent !== null; });
      if (!l.length) { ev.preventDefault(); return; }
      var i = l.indexOf(document.activeElement);
      if (ev.shiftKey && i <= 0) { ev.preventDefault(); l[l.length - 1].focus(); }
      else if (!ev.shiftKey && (i < 0 || i === l.length - 1)) { ev.preventDefault(); l[0].focus(); }
    });
    // celular ⇄ computador (girar o tablet, mudar a janela): a matriz troca de 6 para 16 meses
    if (mqCel) { var trocou = function () { if (op.ativa() && (((modo === 'mes' || modo === 'sit') && !cid) || (cid && secao !== 'med'))) { matrizScroll = null; render(); } }; if (mqCel.addEventListener) mqCel.addEventListener('change', trocou); else if (mqCel.addListener) mqCel.addListener(trocou); }
    host.addEventListener('change', function (ev) {
      if (!op.ativa()) return;
      if (ev.target.id === 'mdOrdem') ordem = ev.target.value;
      else if (ev.target.id === 'mdOrdSit') ordSit = ev.target.value === 'nome' ? 'nome' : 'prazo';
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
      // v209: os números de um contrato para o painel do editor e a entrada direto no contrato (aba Medições, Pagamentos ou Contrato)
      resumo: function (c) { try { return resumoCt(c); } catch (e) { return null; } },
      irContrato: function (id, ab) {
        if (!contrato(id)) return false;
        if (id !== cid) { pagTodas = false; pagAbertas = false; }
        secao = ab === 'pag' || ab === 'ct' ? ab : 'med';
        cid = id; med = null; etapas = {}; grupo = null; aba = 'grupos'; semValor = false; segAberto = ''; segTodas = false; segServ = false; segXls = false; segSem = null; segOrdem = 'km';
        return true;
      },
      // chamada no popstate do app; true: a folha resolveu
      voltar: function () {
        if (folhaPula) { folhaPula = false; return true; }
        if (document.querySelector('.modal')) return false;
        if (folha) { fechaFolha(true); return true; }
        // o Avançar do navegador caiu na entrada de uma folha já fechada: volta sem sair da tela
        if (!history.state || !history.state.mdFolha) return false;
        folhaPula = true;
        try { history.back(); } catch (e) { folhaPula = false; }
        return true;
      },
      limpar: function () { fechaFolha(); geracao++; cache = {}; cid = ''; med = null; busca = ''; grupo = null; etapas = {}; matrizScroll = null; host.innerHTML = ''; }
    };
  };
})();
