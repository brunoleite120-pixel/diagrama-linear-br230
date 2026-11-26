/* v220: Baixar Excel no painel da OAE. Executar: node ferramentas/testar-planilha.cjs [pasta de saída]
 * Usa a tela de teste de testar-medicoes.cjs (o mesmo medicoes.js e o anCalc do app.js) com os dados reais da OAE Paraná
 * (CT 424, oae-18), clica em Baixar Excel, confere o que sai e grava os dois .xlsx na pasta indicada para abrir no Excel.
 */
'use strict';
var fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
var base = fs.readFileSync(path.join(__dirname, 'testar-medicoes.cjs'), 'utf8');
base = base.slice(0, base.indexOf('\nfunction calculos()'));
var H = new Function('require', '__dirname', base + '\nreturn { tela: tela, cto: cto, med: med, texto: texto };')(require, __dirname);
var testes = 0;
function ok(x, msg) { assert.ok(x, msg); testes++; }

var c = H.cto('424', 'oae');
c.numero = '02 00424/2024';
c.pontos = [{ id: 'oae-18', nome: 'Paraná', codigo: 'OAE 18', kmIni: 556.24, kmFim: 556.276 }, { id: 'oae-19', nome: 'Lageado', codigo: 'OAE 19', kmIni: 560, kmFim: 560.1 }];
// o catálogo gravado no cadastro do 424 (revisoes/2026-11-26-excel-oae/catServ-424.json); sem ele, os cinco serviços da 27ª
var catArq = process.env.CATSERV || path.join(__dirname, '..', '..', 'revisoes', '2026-11-26-excel-oae', 'catServ-424.json');
c.catServ = fs.existsSync(catArq) ? JSON.parse(fs.readFileSync(catArq, 'utf8')) : {
  'Pingadeira de elastômero 40×40 mm': ['7200835', 'Pingadeira de elastômero perfil 40 x 40 mm com aba inclinada e fixada com adesivo estrutural e pinos - fornecimento e instalação - exclusa a plataforma', 'm'],
  'Pintura com nata de cimento (3 demãos)': ['51114', 'Pintura manual com nata de cimento - 3 demãos', 'm2'],
  'Limpeza de concreto com jato d’água sob pressão': ['97482', "Limpeza em superfície de concreto com jateamento d'água sob pressão", 'm2'],
  'Recomposição de guarda-corpo': ['91982', 'Recomposição de guarda-corpo com agregados comerciais - instalação', 'm'],
  'Limpeza de ponte': ['395000', 'Limpeza de ponte', 'm']
};
var S = [
  ['acesso', 'm2', 'Plataforma de trabalho suspensa sob tabuleiro', { 15: [287.1, 19032.29], 25: [436.76, 28953.47] }],
  ['juntas', 'm', 'Restauração de berços de apoio de junta de dilatação', { 15: [24.4, 46416.33] }],
  ['juntas', 'm', 'Pingadeira de elastômero 40×40 mm', { 26: [91, 18690.84], 27: [36, 7394.18] }],
  ['pintura', 'm2', 'Pintura com nata de cimento (3 demãos)', { 15: [1177.82, 5215.86], 25: [1310.28, 5802.44], 27: [1600, 7085.44] }],
  ['concreto', 'm3', 'Concreto projetado fck 30 (teto)', { 15: [6, 12997.19] }],
  ['acesso', 'm2', 'Limpeza de concreto com jato d’água sob pressão', { 15: [1182.845, 6294.01], 25: [1310.28, 3396.77], 27: [885.6, 2295.83] }],
  ['rotina', 'm3', 'Poda de árvores até 5 m', { 15: [5, 2104.08], 25: [5, 2104.09] }],
  ['concreto', 'm3', 'Concreto projetado fck 30 (superfícies inclinadas)', { 15: [2.4, 3475.01] }],
  ['drenagem', 'un', 'Recomposição de dreno (tubo galvanizado Ø100)', { 15: [16, 1792.07], 26: [7, 784.03] }],
  ['rotina', 'm3', 'Poda de árvores de 5 a 7,5 m', { 15: [3, 701.37], 25: [3, 701.38] }],
  ['pintura', 'm2', 'Caiação com fixador de cal', { 15: [128.88, 434.9], 25: [225.54, 761.08] }],
  ['pista', 'm', 'Recomposição de guarda-corpo', { 27: [8, 1137.64] }],
  ['rotina', 'm', 'Limpeza de ponte', { 15: [37, 184.41], 25: [53.271, 260.97], 27: [18, 79.4] }],
  ['pista', 'm3', 'Remoção manual de revestimento asfáltico', { 15: [0.512, 112.9] }],
  ['rotina', 'ha', 'Roçada manual', { 15: [0.02, 39.12], 25: [0.005, 9.62] }]
].map(function (x) { return { g: x[0], un: x[1], nome: x[2], por: x[3] }; });
var meses = { 15: 98799.54, 25: 41989.82, 26: 19474.87, 27: 17992.49 };
var pag = { 15: ['50602.002453/2025-26', '2025-10-14'], 25: ['50602.002100/2026-15', '2026-08-05'], 26: ['50602.002353/2026-81', '2026-09-04'], 27: ['50602.002659/2026-37', '2026-11-26'] };
var refs = { 15: '2025-09', 25: '2026-07', 26: '2026-08', 27: '2026-09' }, ms = [], sm = {};
for (var n = 14; n <= 27; n++) {
  var ref = refs[n] || (n < 15 ? '2025-0' + (n - 6) : '2026-0' + (n - 19));
  ms.push(H.med(n, ref, meses[n] ? meses[n] * 5 : 1000, n <= 18 ? 1 : 2));
  if (pag[n]) sm[n] = { processo: pag[n][0], pagamento: { situacao: 'Processo de Pagamento Aprovado', data: pag[n][1] } };
}
var a = { medicoes: ms, siac: { medicoes: sm }, pontes: { 'oae-18': { meses: meses, grupos: {}, servicos: S }, 'oae-19': { meses: { 27: 500 }, grupos: {}, servicos: [{ g: 'rotina', un: 'm', nome: 'Limpeza de ponte', por: { 27: [100, 500] } }] } } };
var salvos = [], avisos = [];
var t = H.tela([c], { 424: a }, {
  salvar: function (nome, blob, msg) { salvos.push({ nome: nome, blob: blob, msg: msg }); return Promise.resolve(); },
  toast: function (m) { avisos.push(m); },
  unTxt: function (u) { return { m2: 'm²', m3: 'm³', und: 'un' }[u] || u || ''; },
  grupos: function () { return ['juntas', 'apoios', 'concreto', 'pintura', 'drenagem', 'rotina', 'pista', 'outros', 'acesso'].map(function (k) { return { key: k, short: { juntas: 'Juntas', apoios: 'Aparelhos de apoio', concreto: 'Concreto', pintura: 'Pintura', drenagem: 'Drenagem', rotina: 'Rotina', pista: 'Pista / guarda-corpo', outros: 'Outros', acesso: 'Acesso e limpeza' }[k] }; }); }
});
function h() { return t.host.innerHTML; }
t.click('abrir', { cid: '424', n: '27' });
t.click('aba', { v: 'segmentos' });
t.click('ponte', { p: 'oae-18' });
ok(h().includes('data-md="ponte-xls"') && h().includes('>Baixar Excel ▾</button>'), 'botão Baixar Excel no painel');
ok(!h().includes('md-xls-op'), 'escolhas fechadas no início');
t.click('ponte-xls', { p: 'oae-18' });
ok(h().includes('Todas as medições desta OAE') && h().includes('4 medições · 15 serviços'), 'escolha: todas as medições, com a conta');
ok(h().includes('resumo, uma aba por medição, serviços × medições e lançamentos'), 'texto da escolha com as abas por medição');
ok(H.texto(h()).includes('Só a 27ª medição') && h().includes('5 serviços · código, serviço, unidade e quantidade'), 'escolha: só a medição aberta');
ok(h().includes('md-xls-op on'), 'todas marcada');
t.click('ponte-xls-ir', { p: 'oae-18', q: 'med', n: '27' });
ok(!h().includes('md-xls-op'), 'escolhas fecham depois do toque');
t.click('ponte-xls', { p: 'oae-18' });
t.click('ponte-xls-ir', { p: 'oae-18', q: 'todas', n: '27' });
// Serviços nesta medição passa a mostrar o código do cadastro no 424
t.click('ponte-serv', { p: 'oae-18' });
ok(h().includes('7200835 · Pingadeira de elastômero 40×40 mm'), 'código do cadastro nos serviços desta medição');
// OAE sem serviço em nenhuma medição: sem botão
t.click('ponte', { p: 'oae-19' });
ok(h().includes('data-md="ponte-xls"'), 'outra OAE com serviço tem o botão');
// v222: a medição inteira, uma aba por OAE
ok(h().includes('data-md="seg-xls"') && h().includes('Baixar Excel da 27ª · todas as OAEs') && h().includes('com serviço nesta medição (2)'), 'botão da medição inteira acima da lista');
t.click('seg-xls', { n: '27' });

setTimeout(function () {
  try {
    ok(salvos.length === 3, 'três planilhas entregues (' + salvos.length + ')' + (avisos.length ? ' avisos: ' + avisos.join(' | ') : ''));
    ok(salvos[0].nome === 'CT424_OAE18_Parana_27a_2026-09.xlsx', 'nome da planilha simples: ' + salvos[0].nome);
    ok(/^CT424_OAE18_Parana_servicos_\d{4}-\d{2}-\d{2}\.xlsx$/.test(salvos[1].nome), 'nome da planilha completa: ' + salvos[1].nome);
    ok(salvos[2].nome === 'CT424_27a_2026-09_OAEs.xlsx', 'nome da planilha da medição: ' + salvos[2].nome);
    var saida = process.argv[2];
    Promise.all(salvos.map(function (s) { return s.blob.arrayBuffer(); })).then(function (bufs) {
      bufs.forEach(function (b, i) {
        var u8 = Buffer.from(b);
        ok(u8.slice(0, 2).toString() === 'PK', 'é um .zip: ' + salvos[i].nome);
        var txt = u8.toString('utf8');
        if (i === 0) {
          ok(txt.includes('Pingadeira de elastômero perfil 40 x 40 mm com aba inclinada') && txt.includes('<v>7200835</v>') && txt.includes('<v>1600</v>'), 'simples com código, nome completo e quantidade');
          ok(txt.includes('CT 424/2024 · OAE Paraná (km 556,240) · 27ª medição · set/26'), 'título da simples');
          ok(txt.indexOf('<v>395000</v>') < txt.indexOf('<v>51114</v>') && txt.indexOf('<v>51114</v>') < txt.indexOf('<v>7200835</v>') && txt.indexOf('<v>7200835</v>') < txt.indexOf('<v>91982</v>'), 'ordem do código como texto');
        } else if (i === 2) {
          var abas2 = (txt.match(/<sheet name="[^"]*"/g) || []).map(function (x) { return x.slice(13, -1); });
          ok(abas2.join(' | ') === 'Resumo | OAE 18 Paraná | OAE 19 Lageado', 'abas da medição: ' + abas2.join(' | '));
          ok(txt.includes('CT 424/2024 · 27ª medição · set/26 · serviços por OAE') && txt.includes("HYPERLINK(&quot;#'OAE 18 Paraná'!A1&quot;"), 'resumo com título e link para a aba');
          ok(/<f>SUM\(F\d+:F\d+\)<\/f><v>18492\.49<\/v>/.test(txt) && txt.includes('Sem local (administração'), 'total nas OAEs e o sem local');
          ok(txt.includes('CT 424/2024 · OAE Paraná (km 556,240) · 27ª medição · set/26') && txt.includes('CT 424/2024 · OAE Lageado (km 560,000) · 27ª medição · set/26'), 'uma aba por OAE no formato da individual');
        } else {
          var abas = (txt.match(/<sheet name="[^"]*"/g) || []).map(function (x) { return x.slice(13, -1); });
          ok(abas.join(' | ') === 'Resumo | 15ª · set-25 | 25ª · jul-26 | 26ª · ago-26 | 27ª · set-26 | Serviços × medições | Lançamentos', 'abas na ordem: ' + abas.join(' | '));
          var i27 = txt.indexOf('CT 424/2024 · OAE Paraná (km 556,240) · 27ª medição · set/26'), i26 = txt.indexOf('CT 424/2024 · OAE Paraná (km 556,240) · 26ª medição · ago/26');
          ok(i27 > 0 && i26 > 0 && txt.indexOf('<v>7200835</v>', i27) > i27, 'abas das medições no formato da individual');
          var m15 = /SUMIF\('Lançamentos'!\$A:\$A,15,'Lançamentos'!\$I:\$I\)<\/f><v>([\d.]+)<\/v>/.exec(txt); ok(m15 && Math.abs(Number(m15[1]) - 98799.54) < 0.005, 'resumo soma os lançamentos da 15ª: ' + (m15 && m15[1]));
          ok(/<f>SUM\(F\d+:F\d+\)<\/f><v>178256\.72<\/v>/.test(txt), 'acumulado 178.256,72');
          ok(txt.includes('Paga em 26/11/2026') && txt.includes('50602.002659/2026-37'), 'processo e pagamento');
          ok(!txt.includes('Valor da medição diferente'), 'serviços fecham com o valor da OAE em cada medição');
        }
        if (saida) fs.writeFileSync(path.join(saida, salvos[i].nome), u8);
      });
      console.log(testes + ' verificações da planilha passaram.' + (saida ? ' Arquivos em ' + saida : ''));
    }).catch(function (e) { console.error(e); process.exitCode = 1; });
  } catch (e) { console.error(e); process.exitCode = 1; }
}, 50);
