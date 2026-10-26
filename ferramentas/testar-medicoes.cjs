/* Testes locais, sem banco, navegador ou dependências. Executar: node ferramentas/testar-medicoes.cjs
 * Usa os JSONs de ../dados quando disponíveis, além dos casos pequenos abaixo.
 * O DOM mínimo exercita o HTML e os eventos; não substitui inspeção visual no navegador.
 */
'use strict';
var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');
var vm = require('node:vm');
var cp = require('node:child_process');
var raiz = path.resolve(__dirname, '..'), testes = 0;
function ok(x, msg) { assert.ok(x, msg); testes++; }
function igual(a, b, msg) { assert.deepEqual(a, b, msg); testes++; }
function copia(x) { return JSON.parse(JSON.stringify(x)); }
function escape(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function dinheiro(n) { return 'R$ ' + Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function texto(h) { return h.replace(/<[^>]*>/g, ''); }
function dataFixa() { return new Date(2026, 9, 20); }
function elemento() {
  return { innerHTML: '', hidden: false, style: { setProperty: function () {} }, dataset: {}, events: {},
    classList: { toggle: function () {}, contains: function () { return false; }, add: function () {}, remove: function () {} },
    addEventListener: function (k, fn) { this.events[k] = fn; },
    querySelector: function () { return null; }, querySelectorAll: function () { return []; },
    contains: function () { return true; }, setAttribute: function () {}, removeAttribute: function () {},
    hasAttribute: function () { return false; }, focus: function () {}, getBoundingClientRect: function () { return { top: 0 }; }
  };
}
function dom() {
  var els = {}, doc = { activeElement: null, addEventListener: function () {}, body: elemento(), documentElement: elemento(), querySelector: function () { return null; }, querySelectorAll: function () { return []; },
    getElementById: function (id) { if (id === 'pgNav') return null; if (!els[id]) els[id] = elemento(); return els[id]; },
    createElement: function () { return { getContext: function () { return { measureText: function (t) { return { width: String(t).length * 5 }; } }; } }; }
  };
  return { document: doc, els: els };
}
function appBanco() {
  return { analise: function () { return Promise.resolve(null); } };
}
function motor(source) {
  var d = dom(), store = {}, loc = { hash: '', pathname: '/', search: '' }, banco = appBanco();
  var storage = { getItem: function (k) { return store[k] || null; }, setItem: function (k, v) { store[k] = v; }, removeItem: function (k) { delete store[k]; } };
  var w = { Banco: banco, scrollTo: function () {}, addEventListener: function () {}, matchMedia: function () { return { matches: false }; }, VisaoGeral: function () { return { render: function () {} }; } };
  var ctx = { window: w, document: d.document, localStorage: storage, sessionStorage: storage, location: loc,
    history: { state: null, replaceState: function (_, t, u) { loc.hash = u.indexOf('#') >= 0 ? u.slice(u.indexOf('#')) : ''; } },
    navigator: {}, console: console, Intl: Intl, Promise: Promise, Date: Date, setTimeout: setTimeout, clearTimeout: clearTimeout };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(raiz, 'medicoes.js'), 'utf8'), ctx);
  // Expõe as funções privadas só nesta cópia em memória; não altera o app nem a API publicada.
  var seam = "  window.Teste = { configurar: function (cts, dados, papel, acesso) { state = normalize(clone({contracts: cts, activeId: cts[0] && cts[0].id})); banco.on = true; banco.login = papel ? {codigo:'tk_teste', papel:papel} : null; banco.acesso = acesso || null; analise = {dados:dados || {}, estado:{}}; Object.keys(analise.dados).forEach(function (id) { analise.estado[id] = 'ok'; }); visaoOn = true; }, papel: function (p, a) { banco.login = p ? {codigo:'tk_teste',papel:p} : null; banco.acesso = a || null; podarAnalise(); }, parte:parte, anOf:anOf, anCalc:anCalc, carregar:carregarAnalise, abrir: typeof abrirMedicoes === 'function' ? abrirMedicoes : function(){}, render:renderAll, sair: function(){setVisao(false);renderAll();}, visao: function(){setVisao(true);renderAll();}, folhas:function(id){return renderSheets(contractById(id));}, dados:function(){return analise.dados;}, resetEstado: function(id){delete analise.estado[id];}, estado: function(id){return analise.estado[id];} }; renderEditor = function(){}; renderPreview = function(){}; save = function(){};\n";
  // o app.js termina com "if (init() !== false) {" (antes era "init();"): a costura entra no lugar e o init não roda
  source = source.replace(/^  init\(\);\r?\n/m, seam).replace(/^  if \(init\(\) !== false\) \{\r?\n/m, seam + '  if (false) {\n');
  vm.runInContext(source, ctx);
  return { api: w.Teste, w: w, doc: d.document, els: d.els, banco: banco, loc: loc };
}
function cto(id, tipo) { return { id: id, numero: id + '/2026', tipo: tipo || 'conserva', kmIni: 1, kmFim: 5, lote: 'Lote 01', pontos: [], valores: [], prazos: [] }; }
function analise(ms) { return { tipo: 'conserva', medicoes: ms, servicos: [{ id: 'a', cod: '50821', nome: 'Base solo-brita', un: 'm3', g: 'revprim' }], porMedicao: {}, pontes: {}, alertas: [], cobertura: {} }; }
function med(n, ref, v, e) { return { n: n, ref: ref, mes: ref, total: v, etapa: e || 1 }; }
function tela(cts, dados, extras) {
  var host = elemento(), doc = { activeElement: null, getElementById: function () { return null; } }, w = { scrollTo: function () {} };
  vm.runInNewContext(fs.readFileSync(path.join(raiz, 'medicoes.js'), 'utf8'), { window: w, document: doc, Promise: Promise, setTimeout: setTimeout, Date: dataFixa });
  var permit = {}, estados = {}, calls = {}, on = true;
  cts.forEach(function (c) { permit[c.id] = true; estados[c.id] = dados[c.id] ? 'ok' : 'vazia'; });
  var op = {
    host: host, contratos: function () { return cts; }, pode: function (c) { return !!permit[c.id]; }, ativa: function () { return on; },
    base: function (c) { return dados[c.id]; }, analise: function (c) { calls[c.id] = (calls[c.id] || 0) + 1; return engine.api.anCalc(dados[c.id]); },
    estado: function (c) { return estados[c.id]; }, online: function () { return false; }, carregar: function () { return Promise.resolve(); }, repetir: function (c) { delete estados[c.id]; },
    nome: function (c) { return 'CT ' + c.numero; }, pontos: function (c) { return c.pontos || []; }, grupos: function () { return [{ key: 'revprim', label: 'Pista' }]; },
    esc: escape, fmtN: function (n) { return Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 }); }, dinheiro: dinheiro,
    medTxt: function (an, n) { var m = an.medicoes.filter(function (x) { return String(x.n) === String(n); })[0]; return n + 'ª (' + (m && m.ref || '') + ')'; },
    etapaInfo: function (an, n) { return an.etapas.filter(function (e) { return e.etapa === n; })[0]; }, unTxt: function (u) { return u; }, semLocal: { short: 'Sem local' }, data: function (s) { return String(s).replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3/$2/$1'); }, diagrama: function () {}
  };
  Object.assign(op, extras || {});
  var area = w.Medicoes(op);
  function click(act, data) {
    var ds = Object.assign({ md: act }, data || {}), b = { dataset: ds, focus: function () {} };
    host.events.click({ target: { closest: function () { return b; } } });
  }
  area.render();
  return { area: area, host: host, click: click, calls: calls, permit: permit, estados: estados, doc: doc, op: op, desativar: function () { on = false; } };
}
var atual = fs.readFileSync(path.join(raiz, 'app.js'), 'utf8'), engine = motor(atual);

function calculos() {
  var c = cto('teste'), a = analise([med(1, '2026-01', 100), med(2, '2026-02', 200), med(3, '2026-04', 0), med(4, '2026-05', 300), med(5, '2026-06', 400), med(6, '2026-07', 500), med(7, '2026-08', 600)]);
  c.valores = [{ rotulo: 'PI vigente', valor: 10000 }]; c.prazos = [{ fim: 'exec', data: '2027-08-31' }, { fim: 'vig', data: '2030-01-01' }];
  a.porMedicao[7] = { a: [2, 600] };
  a.cobertura[7] = [200, 400];
  var t = tela([c], { teste: a }), h = t.host.innerHTML;
  ok(h.includes('R$ 2.100,00'), 'soma PI'); ok(h.includes('21%'), 'percentual PI');
  ok(h.includes('R$ 7.900,00'), 'saldo PI'); ok(h.includes('R$ 333,33/mês'), 'ritmo usa seis competências, incluindo zero e excluindo lacuna');
  ok(h.includes('61% do PI até ago/27'), 'projeção entre última competência e prazo de execução');
  igual(t.calls.teste, 1, 'um cálculo por análise');
  t.click('abrir', { cid: 'teste' }); h = t.host.innerHTML;
  ok(h.includes('+20,0% em relação à 6ª (R$ 500,00)'), 'variação vs anterior com uma casa');
  ok(h.includes('R$ 200,00 (33,3%)'), 'cobertura antiga localizado + semLocal');
  ok(!h.includes('Com reajuste'), 'sem SIAC não exibe reajuste');
  t.click('aba', { v: 'segmentos' }); t.click('aba', { v: 'grupos' });
  igual(t.calls.teste, 1, 'toques não recalculam análise');
  t.click('grupo', { g: 'revprim' }); ok(!t.host.innerHTML.includes('<tbody>'), 'grupo fechado não monta tabela');
  t.click('grupo', { g: 'revprim' }); ok(t.host.innerHTML.includes('<tbody>'), 'grupo aberto monta tabela');
  t.click('med', { n: '3' }); ok(t.host.innerHTML.includes('Medição registrada com valor zero'), 'zero é medição registrada');
  t.click('med', { n: '4' }); ok(t.host.innerHTML.includes('anterior zerada'), 'variação sem dividir por zero');
  t.click('voltar'); t.click('modo', { v: 'mes' });
  ok(t.host.innerHTML.includes('md-zero'), 'matriz diferencia zeradas');
  ok(t.host.innerHTML.includes('md-ausente'), 'matriz diferencia lacunas');
  // o detalhe do mês virou a seção md-mes-det (v109): título só com o mês e a contagem na linha de baixo
  function detMes() { return (t.host.innerHTML.match(/<section class="card md-card md-mes-det[^"]*">([\s\S]*?)<\/section>/) || [])[1] || ''; }
  t.click('mes', { v: String(2026 * 12 + 6) }); ok(detMes().includes('<h2>jul/26</h2>') && detMes().includes('R$ 500,00 (PI)'), 'toque no mês troca o detalhe');
  t.click('mes', { v: String(2026 * 12 + 7) });
  ok(detMes().includes('<h2>ago/26</h2>') && detMes().includes('1 contrato mediu · 1 medição') && detMes().includes('R$ 600,00 (PI)'), 'detalhe mensal');
  t.click('celula', { cid: 'teste', v: String(2026 * 12 + 7) }); ok(t.host.innerHTML.includes('7ª medição'), 'célula abre medição exata');
  t.click('voltar'); t.click('modo', { v: 'contrato' });
  c.valores = []; t.area.render(); ok(t.host.innerHTML.includes('falta o PI'), 'sem PI não inventa base');
  a.siac = { ficha: { pi_vigente: 3000 }, medicoes: { 7: { total: 750, reaj: 150, processado: '2026-09-10' } } };
  // a análise do banco é substituída, como numa atualização real
  var novo = copia(a), dados = { teste: novo }; t = tela([c], dados);
  ok(t.host.innerHTML.includes('PI vigente (SIAC)'), 'base SIAC vence cadastro');
  ok(t.host.innerHTML.includes('PI acaba por nov/26 (prazo ago/27)'), 'esgotamento do PI');
  t.click('abrir', { cid: 'teste' });
  ok(t.host.innerHTML.includes('Com reajuste R$ 750,00'), 'total com reajuste separado do PI');
  ok(t.host.innerHTML.includes('Reajuste da medição: R$ 150,00'), 'reajuste da medição');
  ok(t.host.innerHTML.includes('processada no SIAC em 10/09/2026'), 'data de processamento do SIAC');
  novo.alertas = [{ tipo: 'siac', n: 7, motivo: '<conferir>' }]; t = tela([c], { teste: copia(novo) }); t.click('abrir', { cid: 'teste' }); t.click('aba', { v: 'avisos' });
  ok(t.host.innerHTML.includes('SIAC · conferir com a fiscalização'), 'SIAC destacado');
  ok(t.host.innerHTML.includes('&lt;conferir&gt;'), 'texto de dados escapado');
  t.permit.teste = false; t.area.render(); igual(t.host.innerHTML, '', 'revogação remove HTML');
  t.click('abrir', { cid: 'teste' }); igual(t.host.innerHTML, '', 'evento antigo não reabre contrato revogado');
}
function acessos() {
  var cs = [cto('liberado'), cto('restrito')], dados = { liberado: analise([med(1, '2026-05', 1)]), restrito: analise([med(1, '2026-05', 999)]) };
  var chamadas = 0;
  engine.banco.analise = function () { chamadas++; return Promise.resolve(null); };
  ['engenheiro', 'auxiliar', 'criador', 'equipe', 'responsavel'].forEach(function (p) {
    engine.api.configurar(cs, dados, p); ok(engine.api.parte(cs[0], 'med'), p + ' tem med');
    engine.api.abrir(); ok(engine.els.medicoesHost.innerHTML.includes('restrito/2026'), p + ' vê cartões');
    ok(engine.els.layout.hidden && engine.els.visaoHost.hidden && engine.els.btnPdf.hidden, 'área esconde contrato/visão/PDF');
    engine.api.visao(); ok(engine.els.medicoesHost.hidden && !engine.els.visaoHost.hidden, 'volta à visão geral');
  });
  ['fiscal', null].forEach(function (p) {
    engine.api.configurar(cs, dados, p); engine.api.render(); engine.api.abrir();
    ok(!engine.api.parte(cs[0], 'med'), 'fiscal/público sem med');
    ok(!engine.els.tabs.innerHTML.includes('tab-medicoes'), 'sem aba');
    ok(engine.els.menuMedicoes.hidden, 'sem menu');
    ok(!engine.api.anOf(cs[0]), 'anOf nega análise');
    engine.api.carregar(cs[0], true); igual(chamadas, 0, 'fiscal/público não chama Banco.analise');
  });
  // v126: o contrato liberado vale para tudo (a marca Liberado grava {med, acomp}; med ou acomp antigos também liberam);
  // o contrato fora de banco.acesso continua restrito
  engine.api.configurar(cs, dados, 'analista', { liberado: { med: true, acomp: true } }); engine.api.abrir();
  ok(engine.els.medicoesHost.innerHTML.includes('liberado/2026'), 'analista vê permitido');
  ok(!engine.els.medicoesHost.innerHTML.includes('restrito/2026'), 'analista não recebe HTML restrito');
  ok(!engine.api.parte(cs[1], 'med') && !engine.api.parte(cs[1], 'acomp'), 'contrato não liberado fica sem as duas partes');
  engine.api.configurar(cs, dados, 'analista', { liberado: { med: true }, restrito: { acomp: true } }); engine.api.abrir();
  ok(engine.els.medicoesHost.innerHTML.includes('liberado/2026') && engine.els.medicoesHost.innerHTML.includes('restrito/2026'), 'liberado antigo (só med ou só acomp) vale para as medições');
  // podarAnalise (a cada leitura do banco) usa a mesma regra: o liberado antigo só com acomp não perde as medições do aparelho
  engine.api.papel('analista', { liberado: { med: true }, restrito: { acomp: true } });
  ok(!!engine.api.dados().liberado && !!engine.api.dados().restrito, 'nova leitura do banco mantém as medições do liberado antigo');
  engine.api.papel('analista', {}); engine.api.render();
  igual(engine.els.medicoesHost.innerHTML, '', 'revogação limpa área e cache');
  engine.api.configurar(cs, dados, 'engenheiro'); engine.loc.hash = '#medicoes'; engine.api.render();
  ok(!engine.els.medicoesHost.hidden, 'deep link abre área');
  engine.api.sair(); igual(engine.loc.hash, '', 'sair limpa deep link');
}
function reais() {
  var pasta = path.resolve(raiz, '..', 'dados'), arq = path.join(pasta, 'analise_ct-437.json');
  if (!fs.existsSync(arq)) { console.log('JSONs reais não presentes: casos de amostra ignorados.'); return; }
  var c = cto('437'), d = JSON.parse(fs.readFileSync(arq));
  c.numero = '02 00437/2021';
  var t = tela([c], { 437: d });
  ok(t.host.innerHTML.includes('R$ 44.715.865,80'), '437 acumulado real');
  ok(texto(t.host.innerHTML).includes('R$ 1,06 mi/mês'), '437 ritmo compacto real das últimas seis competências');
  ok(texto(t.host.innerHTML).includes('R$ 44,72 mi medidode R$ 66,24 mi (PI vigente)'), '437 linha de medido conforme desenho');
  ok(texto(t.host.innerHTML).includes('com reajuste R$ 62,89 mi (SIAC)'), '437 reajuste real compacto e secundário');
  ok(texto(t.host.innerHTML).includes('92% do PI até ago/27'), '437 projeção inteira no cartão');
  ok(t.host.innerHTML.includes('R$ 1.062.699,11/mês · 6 competências'), '437 base completa do ritmo no title');
  ok(t.host.innerHTML.includes('6 competências, dez/25 a mai/26'), '437 período das competências no title');
  t.click('abrir', { cid: '437' });
  ok(t.host.innerHTML.includes('Fonte: MP (medição consolidada) · processada no SIAC em 16/06/2026</small><small>PROVISÓRIA · índices DEFINITIVOS'), '437 fonte e processamento juntos, situação abaixo');
  ok(texto(t.host.innerHTML).includes('R$ 6,38 mi'), '437 cabeçalho da quinta etapa compacto');
  ok(t.host.innerHTML.includes('−43,8% em relação à 56ª (R$ 1.157.014,54)'), '437 variação real');
  ok(t.host.innerHTML.includes('R$ 300.136,17 (46,1%)'), '437 cobertura real');
  ok(t.host.innerHTML.includes('R$ 350.420,69'), '437 sem local real');
  var res = elemento(); t.doc.getElementById = function (id) { return id === 'mdBuscaRes' ? res : null; };
  t.host.events.input({ target: { id: 'mdBusca', value: '50821' } });
  ok(res.innerHTML.includes('Base estabilizada solo-brita'), 'busca real por código');
  ok(res.innerHTML.includes('54ª'), 'busca lista medições');
  var semSiac = copia(d); delete semSiac.siac;
  semSiac.medicoes[semSiac.medicoes.length - 1].processado = '16/06/2026';
  semSiac.medicoes[semSiac.medicoes.length - 1].situacao = 'PROVISÓRIA';
  semSiac.medicoes[semSiac.medicoes.length - 1].indices = 'DEFINITIVOS';
  var legado = tela([c], { 437: semSiac }); legado.click('abrir', { cid: '437' });
  ok(legado.host.innerHTML.includes('processada no SIAC em 16/06/2026</small><small>PROVISÓRIA · índices DEFINITIVOS'), 'metadados antigos na medição continuam funcionando');
  ['419', '558', '665'].forEach(function (id) {
    var x = JSON.parse(fs.readFileSync(path.join(pasta, 'analise_ct-' + id + '.json'))), cc = cto(id), dd = {}; dd[id] = x;
    var u = tela([cc], dd);
    u.click('abrir', { cid: id });
    ok(!u.host.innerHTML.includes('NaN'), id + ' sem NaN');
    if (id === '419' || id === '558') {
      ok(u.host.innerHTML.includes('Sem localização: esta análise vem só do Resumo da Medição do SIAC (sem km).'), id + ' explica fonte sem km');
      ok(!u.host.innerHTML.includes('data-v="segmentos"'), id + ' sem aba por segmento');
      ok(!u.host.innerHTML.includes('md-local-bar'), id + ' sem barra de cobertura');
      u.click('aba', { v: 'segmentos' }); ok(!u.host.innerHTML.includes('md-segmentos'), id + ' evento antigo não abre segmento');
      if (id === '419') ok(u.host.innerHTML.includes('Tapa buraco - conservação de pista de rolamento'), 'capítulos SIAC em frase e sem prefixo');
    }
    if (id === '665') { u.click('med', { n: '1' }); ok(u.host.innerHTML.includes('retificada'), '665 retificação'); }
  });
  var cs = [], ds = {};
  ['264', '310', '419', '437', '438', '558', '665'].forEach(function (id) { cs.push(cto(id)); ds[id] = JSON.parse(fs.readFileSync(path.join(pasta, 'analise_ct-' + id + '.json'))); });
  cs.push(cto('424', 'oae'));
  // O JSON do 424 não veio no pedido: só seu total conhecido entra nesta amostra de agregação.
  ds[424] = analise([med(27, '2026-09', 10444658.80)]);
  var conjunto = tela(cs, ds), faixa = texto(conjunto.host.innerHTML.match(/<div class="md-resumo card">([\s\S]*?)<\/strong><\/div><\/div>/)[1]);
  ok(faixa.includes('Medido nos 8 contratos carregados (PI)R$ 256,01 mi'), 'resumo de oito contratos com valor compacto');
  ok(faixa.includes('set/26 OAEs · jun/26 conservação'), 'resumo considera 419 entre todos os contratos reais fornecidos');
}
// Proarte (tipo oae, CT 424): na tela, o que era "ponte(s)" agora diz "OAE(s)". Os nomes internos (an.pontes, data-md="ponte",
// semponte) não mudaram. Os nomes das OAEs e do serviço são neutros, para nenhum texto visível dizer ponte.
function oaes() {
  var c = cto('424', 'oae'), vistos = [];
  c.pontos = [{ id: 'p1', nome: 'Rio Verde', codigo: 'P01', kmIni: 2, serv: {} }, { id: 'p2', nome: 'Córrego Fundo', kmIni: 3, serv: {} }];
  // 2ª medição: R$ 150,00 na OAE e R$ 50,00 sem OAE (administração local, mobilização e canteiro); a 1ª é zerada
  var a = { medicoes: [med(1, '2026-08', 0), med(2, '2026-09', 200)], pontes: { p1: { meses: { 2: 150 }, grupos: {}, servicos: [{ nome: 'Junta de dilatação', cod: '10', g: 'juntas', un: 'm', q: 3, v: 150, meds: '2ª', por: { 2: [3, 150] } }] } } };
  var t = tela([c], { 424: a }, { fotos: function () { return true; } });
  function h() { vistos.push(t.host.innerHTML); return t.host.innerHTML; }
  t.click('abrir', { cid: '424' });
  ok(h().includes('Junta de dilatação') && h().includes('Rio Verde'), '424 detalhe por .por sem consolidado');
  ok(h().includes(' · OAEs · Lote 01'), '424 caminho diz OAEs');
  ok(h().includes('>Por OAE</button>') && h().includes('Com local nas OAEs: R$ 150,00 (75,0%)'), '424 aba Por OAE e local nas OAEs');
  ok(h().includes('<b>Sem OAE</b>'), '424 grupo Sem OAE');
  t.click('grupo', { g: 'semponte' }); ok(h().includes('R$ 50,00</td><td>Sem OAE</td>'), '424 serviço sem OAE na tabela');
  t.click('aba', { v: 'segmentos' }); ok(h().includes('Rio Verde') && h().includes('R$ 150,00'), '424 por OAE');
  ok(texto(h()).includes('Onde ficam · 2 OAEs no trecho, 1 com valor nesta medição'), '424 régua conta OAEs');
  ok(h().includes('>Mostrar as 1 sem valor nesta medição</button>') && h().includes('Toque numa OAE para ver o km e as medições.'), '424 lista de OAEs');
  t.click('ponte', { p: 'p1' }); ok(h().includes('<small>OAE · P01</small>') && h().includes('>Fotos da OAE</button>'), '424 painel da OAE');
  t.click('med', { n: '1' }); ok(h().includes('Esta medição não tem valores localizados nas OAEs.'), '424 medição sem valor nas OAEs');
  t.click('voltar'); ok(h().includes('<h2>CT 424/2026</h2><small>OAEs</small>'), '424 cartão diz OAEs');
  t.click('modo', { v: 'mes' }); ok(h().includes('>CT 424<small>OAEs</small>') && h().includes('<small>OAEs · 2ª medição</small>'), '424 matriz e mês dizem OAEs');
  ok(!vistos.some(function (x) { return /ponte/i.test(texto(x)) || /(?:aria-label|title)="[^"]*ponte/i.test(x); }), '424 nenhum texto diz ponte');
}
function desenho() {
  var c = cto('437'), vazio = cto('314'), sem = cto('315'), oae = cto('424', 'oae'), cons = cto('419');
  c.numero = '02 00437/2021'; vazio.numero = '02 00314/2026'; sem.numero = '02 00315/2026';
  var a = analise([med(56, '2026-04', 1157014.54), med(57, '2026-05', 650556.86)]);
  a.siac = { consulta: '2026-10-20', ficha: { pi_vigente: 66241772.27, termino_execucao: '2027-08-30' }, medicoes: {} };
  a.porMedicao[57] = { a: [1, 650556.86] }; a.cobertura[57] = [300136.17, 350420.69];
  a.servicos[0].cod = ''; a.servicos[0].grupo = '15,0 - 1ª ADEQUAÇÃO - TRANSPORTES';
  var t = tela([c, vazio, sem, oae, cons], { 437: a, 314: analise([]), 424: analise([med(27, '2026-09', 729968.92)]), 419: analise([med(35, '2026-06', 2389506.69)]) });
  var h = t.host.innerHTML, visivel = texto(h), cards = h.match(/<section class="md-cards"[^>]*>([\s\S]*?)<\/section>/)[1];
  ok(visivel.includes('CT 437/2021'), 'nome curto sem 02 nem zeros');
  ok(!visivel.includes('02 00437'), 'nome original só fica fora da área');
  ok(!cards.includes('CT 314') && !cards.includes('CT 315'), 'vazia e sem análise ficam fora dos cartões');
  ok(/md-sem-pill">CT 314\/2026/.test(h) && /md-sem-pill">CT 315\/2026/.test(h), 'contratos vazios em pílulas tracejadas');
  ok(visivel.includes('set/26 OAEs · jun/26 conservação'), 'resumo usa competência mais recente por tipo, incluindo 419');
  ok(visivel.includes('R$ 1,81 mi medidode R$ 66,24 mi (PI vigente)'), 'medido e PI compactos na mesma linha');
  ok(h.includes('title="R$ 1.807.571,40" aria-label="R$ 1.807.571,40"'), 'valor compacto guarda valor completo em title e aria-label');
  ok(h.includes('<span>R$ 650.556,86</span>'), 'última medição mantém valor completo');
  ok(h.includes('R$ 903,8 mil/mês'), 'ritmo abaixo de milhão em mil com uma casa');
  ok(!cards.includes('Ver no diagrama'), 'diagrama só no contrato');
  ok(visivel.includes('Sem medição no SIAC desde mai/26 (4 meses)'), 'aviso curto de atraso');
  ok(visivel.includes('Em dia: medição de set/26 no SIAC'), 'aviso em dia');
  var cel = h.match(/<button[^>]*md-card-cel[^>]*data-cid="437"[^>]*>([\s\S]*?)<\/button>/)[1];
  ok(cel.includes('Última: <b>57ª · mai/26') && cel.includes('md-proj'), 'cartão inteiro é botão e mostra última e projeção');
  ok(!cel.includes('<dl') && !cel.includes('<button') && !cel.includes('medido</span>'), 'cartão celular sem dl, botões internos ou linha desktop');
  t.click('abrir', { cid: '437' }); h = t.host.innerHTML;
  ok(h.includes('md-caminho-ct">CT 437/2021'), 'caminho usa nome curto');
  ok(h.includes('R$ 1,81 mi') && h.includes('md-etapa-btn'), 'cabeçalho da etapa compacto');
  ok(h.includes('1ª Adequação - transportes') && !texto(h).includes('15,0 -'), 'capítulo sem prefixo numérico em frase');
  ok(h.includes('md-local-bar') && h.includes('md-com-local') && h.includes('md-sem-local-cor'), 'cobertura com dois blocos e legenda');
  t.estados[437] = 'erro'; t.area.render();
  ok(t.host.innerHTML.includes('Tentar novamente'), 'erro ao atualizar pode ser tentado no contrato aberto, inclusive no celular');
  t.estados[437] = 'ok';
  t.click('voltar');
  var res = elemento(); t.doc.getElementById = function (id) { return id === 'mdBuscaRes' ? res : null; };
  t.host.events.input({ target: { id: 'mdBusca', value: 'solo-brita' } });
  ok(res.innerHTML.includes('CT 437/2021 · Base solo-brita') && !res.innerHTML.includes('·  ·'), 'busca sem separadores vazios quando falta código');
  t.click('modo', { v: 'mes' }); h = t.host.innerHTML;
  var tabela = h.match(/<table class="md-matriz">([\s\S]*?)<\/table>/)[1];
  ok(tabela.includes('>CT 437<small>Lote 01 · conservação'), 'matriz com CT curto e subtítulo de lote e tipo');
  ok(!tabela.includes('CT 314') && !tabela.includes('CT 315'), 'vazios fora da matriz');
  ok(h.includes('CT 314/2026, CT 315/2026'), 'linha de vazios abaixo da tabela');
  // v109: a legenda separa "— sem medição no mês" (lacuna) de "… ainda não saiu no SIAC", e a data da consulta vai com este
  ok(h.includes('<i class="md-swatch md-pend"></i>… ainda não saiu no SIAC (consulta de 20/10/2026)</span>'), 'legenda usa consulta do SIAC em DD/MM/AAAA');
  var matriz = { scrollLeft: 0, scrollWidth: 1200, clientWidth: 400 }, montada = false;
  t.host.querySelector = function (q) { return q === '.md-matriz-scroll' && montada ? matriz : null; };
  Object.defineProperty(t.host, 'innerHTML', { get: function () { return h; }, set: function (v) { h = v; montada = true; matriz.scrollLeft = 0; } });
  t.area.render(); igual(matriz.scrollLeft, 1200, 'matriz inicia rolada para o fim');
  matriz.scrollLeft = 230; t.click('mes', { v: '24320' }); igual(matriz.scrollLeft, 230, 'seleção de mês preserva rolagem manual');
  t.estados[314] = 'carregando'; t.click('modo', { v: 'contrato' });
  ok(t.host.innerHTML.includes('Carregando medições…'), 'placeholder continua enquanto análise vazia está carregando');
  a.servicos[0].grupo = '<img src=x onerror=1>'; a.servicos[0].nome = '<script>teste</script>';
  t = tela([c], { 437: copia(a) }); t.click('abrir', { cid: '437' });
  ok(t.host.innerHTML.includes('&lt;img') && !t.host.innerHTML.includes('<img'), 'capítulo escapado');
  ok(t.host.innerHTML.includes('&lt;script&gt;') && !t.host.innerHTML.includes('<script>'), 'serviço escapado');
}
// A folha do Proarte passou a dizer "OAE"/"OAEs" no lugar de "ponte"/"pontes". Na base ainda antiga, só esses
// textos são trocados (sem efeito quando a base já diz OAE); o desenho fora dos <text> segue byte a byte, e o x
// de um texto só pode mudar na linha em que um rótulo trocado mudou de tamanho ("Pontes: " → "OAEs: " no TOTAL GERAL).
function trocaOae(t) {
  return t.replace(/^PONTES COM NC$/, 'OAEs COM NC').replace(/^PONTES$/, 'OAEs').replace(/^PONTE$/, 'OAE')
    .replace(/^Pontes: $/, 'OAEs: ').replace(/^Pontes com NC: $/, 'OAEs com NC: ').replace(/Extensão das pontes/, 'Extensão das OAEs')
    .replace(/abertas na ponte/, 'abertas na OAE').replace(/Nenhuma ponte/, 'Nenhuma OAE').replace(/ m de pontes$/, ' m de OAEs')
    .replace(/(\d) pontes\b/g, '$1 OAEs').replace(/(\d) ponte\b/g, '$1 OAE')
    // a parte da análise (roxa): título, ALERTAS sem alerta e as notas
    .replace(/^MEDIDO NA PONTE$/, 'MEDIDO NA OAE').replace(/^nenhuma ponte$/, 'nenhuma OAE')
    .replace(/o serviço na ponte \(/, 'o serviço na OAE (').replace(/alerta = ponte atendida/, 'alerta = OAE atendida');
}
function igualA3Oae(atual, base, msg) {
  var re = /<text\b([^>]*)>([^<]*)<\/text>/g, linhas = {}, trocou = {};
  function textos(fs) { var o = []; fs.join('\n').replace(re, function (a, at, t) { o.push([at, t]); return a; }); return o; }
  function linha(at) { return (at.match(/ y="([^"]*)"/) || [])[1]; }
  function semX(x) { return [linhas[linha(x[0])] ? x[0].replace(/ x="[^"]*"/, '') : x[0], x[1]]; }
  var a = textos(atual), b = textos(base).map(function (x, i) { var t = trocaOae(x[1]); if (t !== x[1]) trocou[i] = true; if (t.length !== x[1].length) linhas[linha(x[0])] = true; return [x[0], t]; });
  // nota cortada com "...": com "OAE" (mais curto que "ponte") cabem mais letras na linha; só nos textos trocados,
  // compara até onde os dois chegam
  var ac = a.map(function (y, i) {
    var x = b[i]; if (!trocou[i] || !x || !/\.\.\.$/.test(x[1]) || !/\.\.\.$/.test(y[1])) return y;
    var n = Math.min(x[1].length, y[1].length) - 3; b[i] = [x[0], x[1].slice(0, n) + '...']; return [y[0], y[1].slice(0, n) + '...'];
  });
  igual(JSON.stringify(atual).replace(re, '<text/>'), JSON.stringify(base).replace(re, '<text/>'), msg + ' (desenho)');
  igual(ac.map(semX), b.map(semX), msg + ' (textos, com ponte → OAE na base)');
  ok(!a.some(function (x) { return /ponte/i.test(x[1]); }), msg + ' (nenhum texto diz ponte)');
}
// A folha A3 não muda com a área de Medições. A base era o commit 687b22a (o app antes das Medições), que não existe
// neste repositório e cujas folhas ficaram para trás de propósito (NC no lugar da vistoria, v121 a v125). Agora a base é
// o HEAD (ou o app.js passado como argumento): o que ainda não foi gravado no app.js não altera as folhas, fora
// ponte → OAE no Proarte, e abrir as Medições também não.
function a3() {
  var base = process.argv[2] ? fs.readFileSync(path.resolve(process.argv[2]), 'utf8') : cp.execFileSync('git', ['show', 'HEAD:app.js'], { cwd: raiz, encoding: 'utf8', maxBuffer: 2000000 }), antes = motor(base);
  var cs = [cto('pc', null), cto('cons'), cto('oae', 'oae'), cto('oae0', 'oae'), cto('oaean', 'oae')]; cs[0].tipo = null;
  cs.slice(0, 3).concat(cs[4]).forEach(function (c) { c.pontos = [{ id: c.id + '-p', nome: 'Trecho de teste', codigo: 'P1', kmIni: 2, kmFim: 3, serv: {}, obs: '', extensao: 1 }]; });
  cs[4].pontos.push({ id: 'oaean-q', nome: 'Outro trecho', codigo: 'P2', kmIni: 4, kmFim: 4.1, serv: {}, obs: '', extensao: 1 });
  // oaean: Proarte com análise, para a folha mostrar também a parte das medições (MEDIDO NA OAE, ALERTAS e as notas)
  var dados = { oaean: { tipo: 'oae', medicoes: [med(1, '2026-03', 100), med(2, '2026-04', 200), med(3, '2026-06', 300)],
    pontes: { 'oaean-p': { meses: { 1: 100, 3: 300 }, grupos: { juntas: 400 }, servicos: [{ nome: 'Junta de dilatação', cod: '10', g: 'juntas', un: 'm', q: 3, v: 400, meds: '1ª, 3ª', por: { 1: [1, 100], 3: [2, 300] } }] } } } };
  var real = path.resolve(raiz, '..', 'dados', 'analise_ct-437.json');
  if (fs.existsSync(real)) {
    dados.cons = JSON.parse(fs.readFileSync(real));
    cs[1].pontos = Object.keys(dados.cons.pontes).map(function (id, i) { return { id: id, nome: 'Segmento ' + (i + 1), kmIni: 1 + i, kmFim: 2 + i, serv: {} }; });
  }
  function compara(msg) {
    cs.forEach(function (c) {
      if (c.tipo === 'oae') igualA3Oae(engine.api.folhas(c.id), antes.api.folhas(c.id), msg + c.id);
      else igual(JSON.stringify(engine.api.folhas(c.id)), JSON.stringify(antes.api.folhas(c.id)), msg + c.id);
    });
  }
  antes.api.configurar(cs, dados, 'engenheiro'); engine.api.configurar(cs, dados, 'engenheiro');
  ok(engine.api.folhas('oaean').join('').includes('>MEDIDO NA OAE</text>'), 'A3 do Proarte com análise mostra a parte das medições');
  compara('A3 idêntico ao HEAD: ');
  engine.api.abrir();
  compara('A3 idêntico com medições abertas: ');
}
function corrida() {
  var resolve, chamadas = 0, c = cto('corrida');
  engine.api.configurar([c], {}, 'engenheiro');
  engine.banco.analise = function () { chamadas++; return new Promise(function (r) { resolve = r; }); };
  var p = engine.api.carregar(c), p2 = engine.api.carregar(c);
  igual(p, p2, 'leitura em andamento é compartilhada'); igual(chamadas, 1, 'sem chamadas duplicadas');
  engine.api.papel('fiscal'); resolve({ dados: analise([med(1, '2026-05', 9999)]) });
  return p.then(function () { ok(!engine.api.dados().corrida, 'resposta tardia não restaura dados sem permissão'); });
}
function pontosCriticos() {
  var c = cto('314'); c.tipo = null;
  engine.api.configurar([c], {}, 'engenheiro');
  var chamadas = 0;
  engine.banco.analise = function () { chamadas++; return Promise.resolve({ dados: analise([med(1, '2026-06', 1234)]) }); };
  return engine.api.carregar(c, true).then(function () {
    igual(chamadas, 1, 'área consulta todos os tipos com a API existente');
    ok(!engine.api.anOf(c), 'pontos críticos mantêm comportamento anterior fora da área');
    engine.api.abrir(); ok(engine.els.medicoesHost.innerHTML.includes('R$ 1.234,00'), 'pontos críticos com análise aparecem na área');
  });
}
function fila() {
  var cs = [cto('a'), cto('b'), cto('c')], dados = {}, emCurso = 0, maximo = 0, feitas = [], espera = [];
  var t = tela(cs, dados, { online: function () { return true; }, carregar: function (c) {
    emCurso++; maximo = Math.max(maximo, emCurso); feitas.push(c.id); t.estados[c.id] = 'carregando';
    return new Promise(function (r) { espera.push(function () { dados[c.id] = analise([med(1, '2026-05', 1)]); t.estados[c.id] = 'ok'; emCurso--; r(); }); });
  } });
  cs.forEach(function (c) { delete t.estados[c.id]; });
  t.area.carregar(); igual(feitas.join(','), 'a', 'primeira leitura');
  t.area.carregar(); igual(feitas.length, 1, 'fila não duplica');
  return new Promise(function (resolve, reject) {
    function avanca() {
      try {
        if (espera.length) espera.shift()();
        if (feitas.length === 3 && emCurso === 0) { igual(maximo, 1, 'leituras sequenciais'); igual(feitas.join(','), 'a,b,c', 'todos carregados'); resolve(); }
        else setTimeout(avanca, 5);
      } catch (e) { reject(e); }
    }
    avanca();
  });
}
try { calculos(); acessos(); reais(); oaes(); desenho(); a3(); } catch (e) { console.error(e); process.exitCode = 1; }
if (!process.exitCode) corrida().then(pontosCriticos).then(fila).then(function () { console.log(testes + ' verificações de medições passaram.'); }, function (e) { console.error(e); process.exitCode = 1; });
