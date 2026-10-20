// Teste das contas da galeria e da tela Foto que não dependem de tela nem de banco (node ferramentas/teste-galeria.js):
//   link "Abrir no Drive" só pelo id do arquivo no formato do Google; contratos pelo km (todos, com a folga de 50 m, igual nas
//   duas telas); "Contrato e ponto" em partes de até 300 e o aviso final com o que mudou de verdade.
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm');

var raiz = path.join(__dirname, '..');
var ctx = { window: {}, console: console };
ctx.window.window = ctx.window;
vm.createContext(ctx);
['galeria.js', 'foto.js'].forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(raiz, f), 'utf8'), ctx, { filename: f }); });
var G = ctx.window.Galeria.puras, F = ctx.window.FotoCarimbo.km;

var falhas = 0, total = 0;
function ok(cond, nome) { total++; if (!cond) { falhas++; console.log('FALHOU: ' + nome); } }
function igual(a, b, nome) { ok(JSON.stringify(a) === JSON.stringify(b), nome + ' (veio ' + JSON.stringify(a) + ', esperado ' + JSON.stringify(b) + ')'); }

// ---------------------------------------------------------------- A2: link pelo id
var ID = '1AbC_dEf-GhIjKlMnOpQrStUvWxYz012';
igual(G.linkDrive(ID), 'https://drive.google.com/file/d/' + ID + '/view', 'id do Google vira link do Drive');
igual(G.linkDrive('javascript:alert(1)'), '', 'comando no lugar do id não vira link');
igual(G.linkDrive('1AbC"><img src=x onerror=alert(1)>'), '', 'id com aspas e sinais não vira link');
igual(G.linkDrive('curto'), '', 'id curto demais não vira link');
igual(G.linkDrive(ID + '/../x'), '', 'id com barra não vira link');
igual(G.linkDrive(new Array(122).join('a')), '', 'id longo demais (121) não vira link');
igual(G.linkDrive(null), '', 'sem id, sem link');
igual(G.linkDrive({ toString: function () { return ID; } }), '', 'só texto vira link');

// ---------------------------------------------------------------- A7: contratos pelo km
var pc = { id: 'ct-314', kmIni: 700, kmFim: 760, pontos: [] };
var cons = { id: 'ct-cons', tipo: 'conserva', kmIni: 650, kmFim: 800, pontos: [] };
var outro = { id: 'ct-315', kmIni: 760.2, kmFim: 820, pontos: [] };
var semKm = { id: 'ct-x', pontos: [{ id: 'p1', kmIni: 900, kmFim: 901 }] };   // trecho pelos pontos: 899,5 a 901,5
var cs = [pc, cons, outro, semKm];
function ids(l) { return l.map(function (c) { return c.id; }); }
igual(ids(G.ctsDoKm(cs, 730)), ['ct-314', 'ct-cons'], 'km de dois contratos: os dois, na ordem da lista');
igual(ids(G.ctsDoKm(cs, 760.17)), ['ct-cons', 'ct-315'], '170 m depois do fim do 314 e 30 m antes do 315');
igual(ids(G.ctsDoKm(cs, 760.06)), ['ct-cons'], '60 m depois do fim do 314 e 140 m antes do 315: nenhum dos dois');
igual(ids(G.ctsDoKm(cs, 760.04)), ['ct-314', 'ct-cons'], '40 m depois do fim do 314: ainda nele');
igual(ids(G.ctsDoKm(cs, 899.46)), ['ct-x'], 'trecho pelos pontos, com a folga');
igual(ids(G.ctsDoKm(cs, 600)), [], 'fora de todos: nenhum');
igual(ids(G.ctsDoKm(cs, null)), [], 'sem km: nenhum');
igual(ids(G.ctsDoKm(cs, '730')), ['ct-314', 'ct-cons'], 'km em texto');
ok(G.porKm([pc, cons], 730) === null, 'porKm: dois contratos com o km, não escolhe nenhum');
ok(G.porKm([pc, outro], 730) === pc, 'porKm: um só contrato com o km');

// a tela Foto usa a mesma folga e devolve todos
ok(F.FOLGA_KM === G.FOLGA_KM && G.FOLGA_KM === 0.05, 'mesma folga (50 m) na galeria e na tela Foto');
function faixa(c) { return c.kmIni != null ? [c.kmIni, c.kmFim] : null; }
igual(ids(F.contratosNoKm([pc, cons, outro], 730, faixa)), ['ct-314', 'ct-cons'], 'tela Foto: os dois contratos do km');
igual(ids(F.contratosNoKm([pc, cons, outro], 760.04, faixa)), ['ct-314', 'ct-cons'], 'tela Foto: 40 m depois do fim, ainda no contrato');
igual(ids(F.contratosNoKm([pc, outro], 760.16, faixa)), ['ct-315'], 'tela Foto: 40 m antes do início do 315 (antes era 1 m)');
igual(ids(F.contratosNoKm([pc, outro], 760.1, faixa)), [], 'tela Foto: 100 m de cada um, nenhum');
igual(ids(F.contratosNoKm([pc], null, faixa)), [], 'tela Foto: sem km, nenhum');

// ---------------------------------------------------------------- A6: partes de até 300 e o aviso final
function n(k) { var l = []; for (var i = 0; i < k; i++) l.push('f' + i); return l; }
igual(G.POR_MOVER, 300, 'parte de até 300 (o limite do banco)');
igual(G.partes(n(1000), 300).map(function (p) { return p.length; }), [300, 300, 300, 100], '1.000 fotos: 4 partes');
igual(G.partes(n(300), 300).map(function (p) { return p.length; }), [300], '300 fotos: uma parte');
igual(G.partes(n(301), 300).map(function (p) { return p.length; }), [300, 1], '301 fotos: duas partes');
igual(G.partes([], 300), [], 'nenhuma foto: nenhuma parte');
var todas = [].concat.apply([], G.partes(n(1000), 300));
igual(todas, n(1000), 'as partes juntas são a lista inteira, na mesma ordem');
igual(G.resumoMover(18, 2, 'sem conexão'), '18 corrigidas, 2 não (sem conexão).', 'aviso: 18 corrigidas, 2 não');
igual(G.resumoMover(1, 1, ''), '1 corrigida, 1 não.', 'aviso: uma de cada');
igual(G.resumoMover(0, 400, 'sem conexão; tente de novo com sinal'), '400 fotos não mudaram (sem conexão; tente de novo com sinal).', 'aviso: nenhuma mudou');
igual(G.resumoMover(5, 0, ''), '', 'tudo certo: sem aviso de falha');

console.log((falhas ? falhas + ' de ' + total + ' falharam' : 'ok: ' + total + ' conferências'));
process.exit(falhas ? 1 : 0);
