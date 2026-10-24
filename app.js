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
  // linhas a mais dos pontos críticos, só no contrato que as lista (c.gruposExtras), como na conservação.
  // CT 267: gabião, estaca raiz e cortina atirantada
  var PC_EXTRAS = [
    { key: 'conten', label: 'Contenção', short: 'Contenção', extra: true }
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
  // itens de cada grupo da ponte, marcados na vistoria com dano observado ou em execução (lista aprovada pelo usuário em 19/10/2026).
  // Guardados no próprio grupo (sv.itens = chaves); saem nas Observações gerais da folha. med = serviço medido que trata o item
  // (para o "medido × vistoriado" por item); sem med, o item não tem serviço próprio nas medições
  var OAE_ITENS = {
    juntas: [{ t: 'O que foi observado', l: [
      { k: 'berco', n: 'Berço da junta', med: /ber[çc]os? de apoio de junta/i }, { k: 'vedacao', n: 'Vedação (perfil)' },
      { k: 'pingadeira', n: 'Pingadeira', med: /pingadeira/i }, { k: 'asfalto', n: 'Asfalto sobre a junta', med: /revestimento asf/i },
      { k: 'degrau', n: 'Degrau na pista' }] }],
    apoios: [{ t: 'O que foi observado', l: [
      { k: 'sujeira', n: 'Sujeira ou detritos', med: /limpeza de aparelhos/i }, { k: 'deslocado', n: 'Aparelho deslocado' },
      { k: 'rompido', n: 'Aparelho rompido ou deformado' }, { k: 'berco_ap', n: 'Berço do aparelho danificado' }] }],
    concreto: [{ t: 'O quê', l: [
      { k: 'armadura', n: 'Armadura exposta', med: /concreto|demoli/i }, { k: 'desplacamento', n: 'Desplacamento', med: /concreto|demoli/i },
      { k: 'fissuras', n: 'Fissuras', med: /concreto/i }, { k: 'infiltracao', n: 'Infiltração / eflorescência', med: /concreto/i }] },
      { t: 'Onde', l: [{ k: 'laje', n: 'Laje' }, { k: 'viga', n: 'Viga' }, { k: 'pilar', n: 'Pilar' }, { k: 'travessa', n: 'Travessa' }, { k: 'encontro', n: 'Encontro / cortina' }] }],
    pintura: [{ t: 'O que foi observado', l: [
      { k: 'desgastada', n: 'Desgastada', med: /nata de cimento|caia[çc][ãa]o|ep[óo]xi/i }, { k: 'manchas', n: 'Manchas ou sujeira', med: /nata de cimento|caia[çc][ãa]o/i },
      { k: 'pichacao', n: 'Pichação', med: /nata de cimento|caia[çc][ãa]o/i }] }],
    drenagem: [{ t: 'O que foi observado', l: [
      { k: 'entupido', n: 'Dreno entupido', med: /dreno/i }, { k: 'quebrado', n: 'Quebrado ou ausente', med: /dreno/i }, { k: 'curto', n: 'Dreno curto', med: /dreno/i }] }],
    rotina: [{ t: 'O que foi observado', l: [
      { k: 'veg_tabuleiro', n: 'Vegetação no tabuleiro', med: /poda|ro[çc]ada|vegeta[çc][ãa]o/i }, { k: 'veg_encontros', n: 'Vegetação nos encontros ou taludes', med: /poda|ro[çc]ada|vegeta[çc][ãa]o/i },
      { k: 'lixo', n: 'Lixo ou entulho', med: /limpeza de ponte/i }, { k: 'assoreamento', n: 'Assoreamento sob a ponte' }] }],
    pista: [{ t: 'O que foi observado', l: [
      { k: 'guarda', n: 'Guarda-corpo ou barreira danificado', med: /guarda-corpo/i }, { k: 'buraco', n: 'Buraco ou trinca no pavimento' },
      { k: 'erosao', n: 'Erosão no encontro ou aterro', med: /eros[ãa]o/i }, { k: 'degrau_cab', n: 'Degrau na cabeceira' }] }]
  };
  function itemDe(g, k) { var r = null; (OAE_ITENS[g] || []).forEach(function (b) { b.l.forEach(function (x) { if (x.k === k) r = x; }); }); return r; }
  // itens marcados, pelo nome e na ordem da lista (chave desconhecida fica como está)
  function itensDe(g, sv) {
    var ks = (sv && Array.isArray(sv.itens)) ? sv.itens : [], out = [];
    (OAE_ITENS[g] || []).forEach(function (b) { b.l.forEach(function (x) { if (ks.indexOf(x.k) >= 0) out.push(x); }); });
    ks.forEach(function (k) { if (!itemDe(g, k)) out.push({ k: k, n: String(k) }); });
    return out;
  }
  function minus1(t) { return t ? t.charAt(0).toLowerCase() + t.slice(1) : t; }
  // conservação (437, 438): mesmos estados das pontes, com os nomes da conservação (oaeStOf junta s.nomes por cima de OAE_STATUS).
  // tot = nome do grupo no total da folha; as chaves não repetem as dos pontos críticos nem as das pontes (fieldName e
  // fmtValue acham o grupo só pela chave)
  var CONS_NOMES = {
    OK: { tag: 'SEM DEFEITO', name: 'Sem defeito', btn: 'Sem defeito' },
    DN: { tag: 'DEFEITO OBSERVADO', name: 'Defeito observado', btn: 'Defeito observado' },
    NA: { name: 'Não se aplica neste segmento' }     // tag e btn continuam "N/A"
  };
  var CONS_SERVICES = [
    { key: 'revprim', label: 'Pista (revestimento primário)', short: 'Pista (revest. primário)', tot: 'Pista', un: 'km', q: 'km de pista com defeito', nomes: CONS_NOMES },
    { key: 'drenoac', label: 'Drenagem e OAC', short: 'Drenagem e OAC', un: 'un', q: 'nº de dispositivos com defeito', nomes: CONS_NOMES },
    { key: 'erosao', label: 'Aterros e erosões', short: 'Aterros e erosões', un: 'm³', q: 'm³ a recompor', nomes: CONS_NOMES },
    { key: 'faixadom', label: 'Faixa de domínio (roçada e capina)', short: 'Faixa de domínio', un: 'km', q: 'km a roçar ou capinar', nomes: CONS_NOMES },
    { key: 'pontesmad', label: 'Pontes de madeira', short: 'Pontes de madeira', un: 'un', q: 'nº de pontes com defeito', nomes: CONS_NOMES },
    { key: 'pavurb', label: 'Pavimento urbano', short: 'Pavimento urbano', un: 'm²', q: 'm² de pavimento com defeito', nomes: CONS_NOMES },
    { key: 'sinal', label: 'Sinalização', short: 'Sinalização', un: 'un', q: 'nº de placas ou elementos com defeito', nomes: CONS_NOMES }
  ];
  // conservação com a pista pavimentada (c.superficie === 'pavimentada': 558, 310, 419, 264, 665, 731), plano 5.2 e decisão D-3.
  // Os grupos seguem os das MPs e do Resumo do contrato do SIAC. A mesma chave da lista de cima só onde o significado é o mesmo
  // (drenagem, erosões, faixa de domínio, sinalização, pontes de madeira, pista não pavimentada). extra: só no contrato que o
  // lista em c.gruposExtras (pontes de madeira no 665; a pista não pavimentada no 310)
  var CONS_PAV_SERVICES = [
    { key: 'panelas', label: 'Pista: panelas e buracos', short: 'Panelas e buracos', tot: 'Panelas', un: 'm²', q: 'm² de panelas', nomes: CONS_NOMES },
    { key: 'remendos', label: 'Pista: afundamentos, trincas em bloco e couro de jacaré', short: 'Afundam. e couro de jacaré', tot: 'Remendos', un: 'm²', q: 'm² a remendar', nomes: CONS_NOMES },
    { key: 'trincas', label: 'Pista: trincas isoladas', short: 'Trincas isoladas', tot: 'Trincas', un: 'm', q: 'm de trincas', nomes: CONS_NOMES },
    { key: 'desgaste', label: 'Pista: desgaste e desagregação', short: 'Desgaste e desagregação', tot: 'Desgaste', un: 'm²', q: 'm² com desgaste', nomes: CONS_NOMES },
    { key: 'acost', label: 'Acostamento e bordos', short: 'Acostamento e bordos', tot: 'Acostamento', un: 'km', q: 'km com defeito', nomes: CONS_NOMES },
    { key: 'drenoac', label: 'Drenagem e OAC', short: 'Drenagem e OAC', un: 'un', q: 'nº de dispositivos com defeito', nomes: CONS_NOMES },
    { key: 'erosao', label: 'Aterros, erosões e barreiras', short: 'Aterros, erosões, barreiras', tot: 'Aterros e erosões', un: 'm³', q: 'm³ a recompor', nomes: CONS_NOMES },
    { key: 'faixadom', label: 'Faixa de domínio (roçada e capina)', short: 'Faixa de domínio', un: 'km', q: 'km a roçar ou capinar', nomes: CONS_NOMES },
    { key: 'sinal', label: 'Sinalização', short: 'Sinalização', un: 'un', q: 'nº de placas ou elementos com defeito', nomes: CONS_NOMES },
    { key: 'pontelimp', label: 'Pontes: limpeza, guarda-corpo e laje de transição', short: 'Pontes (limpeza e laje)', tot: 'Pontes', un: 'un', q: 'nº de pontes com defeito', nomes: CONS_NOMES },
    { key: 'pontesmad', label: 'Pontes de madeira', short: 'Pontes de madeira', un: 'un', q: 'nº de pontes com defeito', nomes: CONS_NOMES, extra: true },
    { key: 'revprim', label: 'Pista não pavimentada (revestimento primário)', short: 'Pista não pavimentada', tot: 'Pista não pavimentada', un: 'km', q: 'km de pista com defeito', nomes: CONS_NOMES, extra: true }
  ];
  // sinalização (c.superficie === 'sinalizacao': CT 709, Sinalisa, todo o eixo): grupos pelos serviços do Resumo do SIAC
  // (códigos SICRO das 58 medições). faixadom é a mesma chave da conservação (mesmo significado). Sem desempenho
  var SIN_SERVICES = [
    { key: 'sinhpint', label: 'Sinalização horizontal: pintura (faixas, setas e zebrados)', short: 'Pintura de faixas', tot: 'Pintura', un: 'm²', q: 'm² de pintura com defeito', nomes: CONS_NOMES },
    { key: 'sinhtacha', label: 'Sinalização horizontal: tachas e tachões', short: 'Tachas e tachões', tot: 'Tachas', un: 'un', q: 'nº de tachas ou tachões faltando ou soltos', nomes: CONS_NOMES },
    { key: 'sinvplaca', label: 'Sinalização vertical: placas, marcos quilométricos e pórticos', short: 'Placas e pórticos', tot: 'Placas', un: 'un', q: 'nº de placas com defeito', nomes: CONS_NOMES },
    { key: 'defensa', label: 'Defensas metálicas e ancoragens', short: 'Defensas metálicas', tot: 'Defensas', un: 'm', q: 'm de defensa com defeito', nomes: CONS_NOMES },
    { key: 'cerca', label: 'Cercas (implantação e recomposição)', short: 'Cercas', un: 'm', q: 'm de cerca com defeito', nomes: CONS_NOMES },
    { key: 'faixadom', label: 'Faixa de domínio (roçada, capina e caiação)', short: 'Faixa de domínio', un: 'km', q: 'km a roçar ou capinar', nomes: CONS_NOMES }
  ];
  // superfície da pista da conservação: os textos e a cor da pista nas folhas (sem superficie, revestimento primário: 437 e 438)
  var PISTA = {
    primario: { nome: 'revestimento primário', cor: '#E8DCBF', leg: 'Revestimento primário (predominante)',
      nota: 'Pista: revestimento primário (predominante). Os trechos pavimentados, quando houver, não são desenhados: os perímetros e as extensões estão nas Observações gerais.' },
    pavimentada: { nome: 'pavimentada', cor: '#D2D6D9', leg: 'Pista pavimentada (predominante)',
      nota: 'Pista: pavimentada (predominante). Os trechos não pavimentados, quando houver, não são desenhados: os perímetros e as extensões estão nas Observações gerais.' },
    // sub: a 3ª linha do nome na folha em escala (sem ela, "(predominante)")
    sinalizacao: { nome: 'a da conservação', sub: 'de cada trecho', cor: '#DCDAD3', leg: 'Pista (contrato de sinalização em todo o eixo)',
      nota: 'Contrato de sinalização em todo o eixo: a superfície da pista é a dos contratos de conservação de cada trecho e não é desenhada aqui.' }
  };
  function isPavimentada(c) { return !!(c && c.tipo === 'conserva' && c.superficie === 'pavimentada'); }
  function isSinalizacao(c) { return !!(c && c.tipo === 'conserva' && c.superficie === 'sinalizacao'); }
  function pistaDe(c) { return isPavimentada(c) ? PISTA.pavimentada : isSinalizacao(c) ? PISTA.sinalizacao : PISTA.primario; }
  // desempenho (conservação rotineira) na vistoria, só na pista pavimentada (plano 5.4, decisão D-4): os 5 indicadores das MPs,
  // com o peso de cada um no fator de desempenho. Cada indicador é um campo do segmento, p.serv['desemp_veg'] = 'A' | 'N' (sem a
  // chave, não vistoriado): assim o banco mescla, propõe, aprova e avisa de conflito por indicador, como nos grupos.
  // Fica fora da folha A3 nesta versão
  var DESEMP_IND = [
    { k: 'veg', n: 'Vegetação', peso: 40 },
    { k: 'limpd', n: 'Limpeza dentro da plataforma', peso: 10 },
    { k: 'limpf', n: 'Limpeza fora da plataforma', peso: 5 },
    { k: 'dren', n: 'Drenagem: existência e funcionamento', peso: 20 },
    { k: 'caia', n: 'Caiação', peso: 25 }
  ];
  var DESEMP_ST = { A: 'Atende', N: 'Não atende' };
  DESEMP_IND.forEach(function (d) { d.key = 'desemp_' + d.k; d.short = 'Desempenho: ' + d.n; d.label = d.short; });
  // os indicadores marcados do segmento: { veg: 'A', caia: 'N' }
  function desempDe(p) {
    var o = {}, sv = (p && p.serv) || {};
    DESEMP_IND.forEach(function (d) { if (DESEMP_ST[sv[d.key]]) o[d.k] = sv[d.key]; });
    return o;
  }
  // trafegabilidade do segmento: linha própria, com estados próprios (interrompido é vermelho e nunca conta como em execução)
  var TRAFEG = { key: 'trafeg', label: 'Trafegabilidade', short: 'Trafegabilidade' };
  var TRAF_STATUS = {
    NV: { tag: 'SEM VISTORIA', name: 'Sem vistoria', fill: 'none' },
    T: { tag: 'TRAFEGÁVEL', name: 'Trafegável', btn: 'Trafegável', fill: '#1E9E55', ink: '#FFFFFF' },
    R: { tag: 'COM RESTRIÇÃO', name: 'Com restrição', btn: 'Com restrição', fill: '#F2A93B', ink: '#3D2800' },
    I: { tag: 'INTERROMPIDO', name: 'Interrompido', btn: 'Interrompido', fill: '#D93025', ink: '#FFFFFF' }
  };
  var TRAF_ORDER = ['T', 'R', 'I'];
  function trafSt(sv) { var st = sv && sv.st; return TRAF_STATUS[st] ? st : 'NV'; }
  // todos os grupos de todos os tipos, para achar o nome pela chave (histórico, propostas, conflitos)
  var GRUPOS_TODOS = SERVICES.concat(PC_EXTRAS, OAE_SERVICES, CONS_SERVICES, CONS_PAV_SERVICES.filter(function (s) { return !CONS_SERVICES.some(function (x) { return x.key === s.key; }); }),
    SIN_SERVICES.filter(function (s) { return !CONS_SERVICES.some(function (x) { return x.key === s.key; }); }), [TRAFEG], DESEMP_IND);
  function isOae(c) { return !!(c && c.tipo === 'oae'); }
  // grupos de serviço do tipo do contrato (TIPOS[...].servicos): pontos críticos, conservação ou pontes. Na conservação com a
  // pista pavimentada, os de CONS_PAV_SERVICES, com os extras só do contrato que os lista (c.gruposExtras)
  function servicesOf(c) {
    if (isSinalizacao(c)) return SIN_SERVICES;
    if (isPavimentada(c)) {
      var ex = Array.isArray(c.gruposExtras) ? c.gruposExtras : [];
      return CONS_PAV_SERVICES.filter(function (s) { return !s.extra || ex.indexOf(s.key) >= 0; });
    }
    // pontos críticos com linhas a mais (c.gruposExtras) ou com o nome de uma linha trocado só neste contrato (c.rotulos:
    // no CT 267 a linha do solo-brita é a pavimentação, com BGS e CBUQ)
    if (ctTipo(c) === 'pc' && c && ((Array.isArray(c.gruposExtras) && c.gruposExtras.length) || c.rotulos)) {
      var exP = Array.isArray(c.gruposExtras) ? c.gruposExtras : [], rot = c.rotulos || {};
      return SERVICES.concat(PC_EXTRAS.filter(function (s) { return exP.indexOf(s.key) >= 0; })).map(function (s) {
        return rot[s.key] ? { key: s.key, label: rot[s.key], short: rot[s.key], extra: s.extra } : s;
      });
    }
    return tipoInfo(c).servicos;
  }
  // grupo que falta nos segmentos (a superfície ou os extras mudaram) nasce sem vistoria; os que saíram ficam guardados
  function gruposFaltam(c) {
    if (!isContinuo(c)) return;
    var list = servicesOf(c);
    c.pontos.forEach(function (p) { p.serv = p.serv || {}; list.forEach(function (s) { if (!p.serv[s.key]) p.serv[s.key] = { st: 'NV' }; }); });
  }

  // ---------------- nomes do contrato. O campo Lote é o lote da licitação ("Lote 01"): fica na folha A3, no carimbo da foto
  // e no título do relatório. O nome de tela sai do tipo e do número do contrato ("Pontos Críticos 314", "Conservação 437",
  // "Proarte 424") e a pasta do Drive, do número ("CT 02 00314-2026": a barra quebra caminhos no .zip e no Windows).
  // Tipo vazio = pontos críticos (o padrão do app); 'oae' = pontes (Proarte); 'conserva' = conservação (437 e 438).
  // Os módulos recebem estas funções em opts.nomes (NOMES, abaixo); foto.js e mapa.js também rodam na página online,
  // sem o app.js, e por isso cada módulo tem uma cópia curta da mesma regra
  // 'sinal' não é tipo: é o grupo da conservação com rotuloTipo 'sinal' (CT 709), com nome e lugar próprios na lista (ctGrupo)
  var NOME_PALAVRA = { pc: 'Pontos Críticos', conserva: 'Conservação', oae: 'Proarte', sinal: 'Sinalização' };
  var NOME_CURTO = { pc: 'p. críticos', conserva: 'conserv.', oae: 'pontes', sinal: 'sinaliz.' };   // rótulo pequeno da raia no celular
  var CT_CURTO = { pc: 'PC', conserva: 'Cons.', oae: 'Proarte', sinal: 'Sinal.' };   // botão do contrato na barra encolhida do celular ("PC 314")
  var TIPO_ORDEM = ['pc', 'conserva', 'oae'];
  // ordem dos grupos na Visão geral (raias e caixa "Contratos"): a sinalização logo antes das pontes (decisão N-6)
  var GRUPO_ORDEM = ['pc', 'conserva', 'sinal', 'oae'];
  function txtLimpo(v) { return v == null ? '' : String(v).trim().replace(/\s+/g, ' '); }
  function ctTipo(c) { return c && c.tipo === 'oae' ? 'oae' : c && c.tipo === 'conserva' ? 'conserva' : 'pc'; }
  // grupo da lista e nome do contrato: o tipo ou, na conservação com rotuloTipo 'sinal' (709), "Sinalização" (por baixo, conservação:
  // todo isConserva continua valendo)
  function ctGrupo(c) { return c && c.rotuloTipo === 'sinal' && ctTipo(c) === 'conserva' ? 'sinal' : ctTipo(c); }
  function tipoDe(x) { return typeof x === 'string' ? (NOME_PALAVRA[x] ? x : 'pc') : ctGrupo(x); }   // o grupo pelo nome ou pelo próprio contrato
  // 709: o km mostrado é o do contrato (o das MPs), com o rótulo do cadastro (rotuloKmContrato); o km do site fica só por trás
  // (posição no desenho e no banco). Os outros contratos, sem o rótulo, não mudam
  function kmSoContrato(c) { return !!(c && ctGrupo(c) === 'sinal' && txtLimpo(c.rotuloKmContrato)); }
  // km do contrato pela régua, com o "*" da ponta pelo cadastro ("301,10"); sem a régua, '-'
  function kmContrTxt(c, s) { var r = kmDoContrato(c, s); return r ? fmtKm(r.km) + (r.ast ? '*' : '') : '-'; }
  // "02 00314/2026" -> "314"; sem número no formato nº/ano, vazio
  function ctNumeroCurto(c) { var m = /(\d{3,})\s*\/\s*\d{4}/.exec(txtLimpo(c && c.numero)); return m ? String(Number(m[1])) : ''; }
  function ctNome(c) {
    if (!c) return '';
    var n = ctNumeroCurto(c), w = NOME_PALAVRA[ctGrupo(c)];
    return n ? w + ' ' + n : txtLimpo(c.lote) || w;
  }
  // só "Lote NN" é lote da licitação: o "CT 424 · OAEs" do 424 não é
  function ctLoteReal(c) { var l = txtLimpo(c && c.lote); return /^lote\b/i.test(l) ? l : ''; }
  function ctNumeroCT(c) { var n = txtLimpo(c && c.numero); return n ? 'CT ' + n : ''; }
  function ctFormal(c) { return c ? [ctLoteReal(c), ctNumeroCT(c)].filter(Boolean).join(' · ') || ctNome(c) : ''; }   // "Lote 01 · CT 02 00314/2026"
  function ctCompleto(c) { return nomeArquivo(c).join(' · '); }   // "Pontos Críticos 314 · Lote 01 · CT 02 00314/2026" (sem repetir)
  // sem número e sem Lote (contrato recém-criado), o id entra no nome: dois contratos assim não dividem a mesma pasta
  function ctPasta(c) {
    if (!c) return '';
    var n = txtLimpo(c.numero);
    return n ? 'CT ' + n.replace(/\s*\/\s*/g, '-') : txtLimpo(c.lote) || ctNome(c) + (c.id ? ' (' + c.id + ')' : '');
  }
  // pastas que existiam no Drive até a versão 51, pelo nº do contrato: o nome antigo não depende do Lote de hoje, que pode ser
  // corrigido ou limpo (o "CT 424 · OAEs" do 424) antes de as pastas serem renomeadas
  var PASTA_ANTES = { '0200314/2026': 'Lote 01', '0200315/2026': 'Lote 02', '0200424/2024': 'CT 424 · OAEs' };
  function ctPastaAntes(c) {
    var k = txtLimpo(c && c.numero).replace(/\s+/g, '');
    return Object.prototype.hasOwnProperty.call(PASTA_ANTES, k) ? PASTA_ANTES[k] : '';
  }
  // pasta usada até a versão 51 do app (o Lote ou "CT nº"), igual letra por letra (ou a da lista acima): o script do Drive
  // renomeia a pasta antiga da pessoa no primeiro envio, sem mover as fotos
  function ctPastaAntiga(c) { return c ? ctPastaAntes(c) || String(c.lote || (c.numero ? 'CT ' + c.numero : '') || 'Contrato') : 'Sem lote'; }
  // ordem fixa: pontos críticos, conservação, sinalização (709) e pontes; dentro do grupo, pelo número (sem número no fim, na ordem
  // da lista). A conservação vai pela posição no eixo (decisão D-16: 558, 310, 419, 264, 731, 665, 437, 438): o km inicial ou, no
  // contrato fora do eixo (o ramal do 731), c.posEixo
  function posEixo(c) { return typeof c.posEixo === 'number' ? c.posEixo : typeof c.kmIni === 'number' ? c.kmIni : null; }
  function ctOrdem(lista) {
    return (lista || []).map(function (c, i) {
      var t = ctGrupo(c);
      return { c: c, i: i, t: GRUPO_ORDEM.indexOf(t), k: t === 'conserva' ? posEixo(c) : null, n: Number(ctNumeroCurto(c)) || Infinity };
    })
      .sort(function (a, b) {
        return a.t - b.t || (a.k == null) - (b.k == null) || (a.k != null && a.k !== b.k ? a.k - b.k : 0) || (a.n < b.n ? -1 : a.n > b.n ? 1 : 0) || a.i - b.i;
      })
      .map(function (x) { return x.c; });
  }
  var NOMES = {
    tipo: ctTipo, grupo: ctGrupo, grupos: GRUPO_ORDEM.slice(), nome: ctNome, numeroCurto: ctNumeroCurto, loteReal: ctLoteReal, numeroCT: ctNumeroCT, formal: ctFormal, completo: ctCompleto,
    pasta: ctPasta, pastaAntiga: ctPastaAntiga, pastaAntes: ctPastaAntes, ordem: ctOrdem, tipos: TIPO_ORDEM.slice(), partesArquivo: nomeArquivo,
    palavra: function (t) { return NOME_PALAVRA[tipoDe(t)]; },
    curto: function (t) { return NOME_CURTO[tipoDe(t)]; }
  };
  // partes do nome dos arquivos (PDF da folha, relatório): nome, lote real e nº do CT, sem repetir
  function nomeArquivo(c) {
    var out = [];
    [ctNome(c), ctLoteReal(c), ctNumeroCT(c)].forEach(function (s) { if (s && out.indexOf(s) < 0) out.push(s); });
    return out;
  }
  // ---------------- tipos de contrato: o que cada tipo tem, pela chave de ctTipo (sem tipo, ou tipo desconhecido, = pontos
  // críticos, como sempre). item/itens: o que o contrato lista (folha, lista, textos); porPagina: o padrão da folha;
  // continuo: serviço contínuo (estado na vistoria, como nas pontes), que a conservação divide com as pontes;
  // opcao: o texto do tipo na janela do "+ Contrato"; palavras: as do resumo do serviço contínuo ("dano"/"defeito"),
  // lidas sempre por palavrasDe; servicos: os grupos de serviço (logo depois de STATUS, fora deste literal).
  // isOae continua só para o que é das pontes (análise das medições, km final pela extensão, código OAE)
  var TIPOS = {
    pc: { item: 'ponto', itens: 'pontos', porPagina: 9, continuo: false, opcao: 'Pontos Críticos (obra emergencial)' },
    conserva: { item: 'segmento', itens: 'segmentos', porPagina: 13, continuo: true, opcao: 'Conservação (P.A.T.O.)',
      palavras: { dano: 'defeito', danos: 'defeitos', semDano: 'sem defeito', semDanoCurto: 's/ defeito', total: 'Defeitos estimados' } },
    oae: { item: 'ponte', itens: 'pontes', porPagina: 9, continuo: true, opcao: 'Proarte (pontes, OAE)',
      palavras: { dano: 'dano', danos: 'danos', semDano: 'sem dano aparente', semDanoCurto: 's/ dano', total: 'Danos estimados' } }
  };
  function tipoInfo(c) { return TIPOS[ctTipo(c)]; }
  function isConserva(c) { return ctTipo(c) === 'conserva'; }
  function isContinuo(c) { return !!tipoInfo(c).continuo; }
  // palavras do resumo do tipo; os pontos críticos (sem palavras) e o contrato que falta ficam com as das pontes
  function palavrasDe(c) { var t = tipoInfo(c); return (t && t.palavras) || TIPOS.oae.palavras; }
  // km do contrato (o dos documentos: SNV 2020–2022 na conservação) de um km do site, pela régua de snv-conversao.js.
  // Só nos contratos com kmIniContrato e kmFimContrato. Nas pontas do contrato vale o km do cadastro, com ast quando a
  // régua discorda em mais de 0,01 km (o início do 437: 750,90 no cadastro, 751,94 pela geometria); no meio, a régua.
  // Devolve { km, ast, geom } (geom: o km pela régua, para a nota) ou null: sem a régua (aparelho com o cache antigo),
  // régua de outra versão do eixo (snv-br230.js trocou e a régua não foi gerada de novo) ou km fora dela
  // versões do SNV que a régua conhece (snv-conversao.js), para o campo do cadastro. Sem snvVersao, 202104A (437/438)
  var SNV_VERSOES = [['202104A', 'SNV 2020–2022 (202104A)'], ['202304A', 'SNV 2023–2025 (202304A)']];
  // régua do contrato pela versão do SNV dele; o snv-conversao.js antigo (sem versao) só tem a 202104A
  function reguaDe(c) {
    var R = window.SNV_CONVERSAO, v = (c && c.snvVersao) || '202104A';
    if (!R) return null;
    if (typeof R.versao === 'function') return R.versao(v);
    return v === '202104A' ? R : null;
  }
  function kmDoContrato(c, s) {
    var R = reguaDe(c), eixo = window.SNV_BR230;
    if (!c || !R || typeof R.paraContrato !== 'function' || !eixo || R.para !== eixo.versao) return null;
    var ki = c.kmIniContrato, kf = c.kmFimContrato;
    if (typeof ki !== 'number' || typeof kf !== 'number' || !isFinite(ki) || !isFinite(kf)) return null;
    if (s == null || s === '' || !isFinite(s = Number(s))) return null;
    var geom = R.paraContrato(s);
    if (geom == null) return null;
    var ponta = typeof c.kmIni === 'number' && Math.abs(s - c.kmIni) < 0.001 ? ki : typeof c.kmFim === 'number' && Math.abs(s - c.kmFim) < 0.001 ? kf : null;
    return ponta == null ? { km: geom, ast: false, geom: geom } : { km: ponta, ast: Math.abs(ponta - geom) > 0.01, geom: geom };
  }
  var STATUS = {
    OK: { tag: 'OK', name: 'Concluído', btn: 'OK', fill: '#1E9E55' },
    A: { tag: 'ATIVO', name: 'Ativo', btn: 'Ativo', fill: '#2B5797' },
    P: { tag: 'PARADO', name: 'Parado', btn: 'Parado', fill: '#D93025' },
    NA: { tag: 'N/A', name: 'Não se aplica', btn: 'N/A', fill: 'none' }
  };
  var STATUS_ORDER = ['OK', 'A', 'P', 'NA'];
  // grupos de serviço de cada tipo (servicesOf). Ficam fora do literal de TIPOS, que os testes em node leem sozinho, sem as listas
  TIPOS.pc.servicos = SERVICES;
  TIPOS.conserva.servicos = CONS_SERVICES;
  TIPOS.oae.servicos = OAE_SERVICES;
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
  // ✕ = medido sem execução: marca interna da supervisão sobre a medição. Não fica nos pontos (leitura pública):
  // vem com a análise (só engenheiro e criador) e só aparece na folha com a análise e no cartão de quem vê a análise
  var MNE_COR = '#2A1414';
  function mneOf(an, pid, g) { var m = an && an.marcas && an.marcas[pid]; return m && m[g] && m[g].med ? m[g] : null; }
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
  // resumo da ponte (ou do segmento): grupos com dano, em execução, sem dano e sem vistoria (N/A não conta); marcas de
  // prioridade e conclusão informada. Os grupos são os do tipo do contrato (sem c, o dono do ponto)
  function oaeNec(p, c) {
    var r = { dn: 0, exec: 0, ok: 0, nv: 0, aval: 0, pri: 0, ci: 0 };
    servicesOf(c || ownerOf(p)).forEach(function (s) {
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
  // texto do resumo, com as palavras do tipo ("dano em 2 grupos" nas pontes, "defeito em 2 grupos" na conservação)
  function oaeNecTxt(n, c) {
    var w = palavrasDe(c);
    if (n.dn) return w.dano + ' em ' + n.dn + (n.dn === 1 ? ' grupo' : ' grupos') + (n.exec ? ' · ' + n.exec + ' em execução' : '');
    if (n.exec) return n.exec + (n.exec === 1 ? ' grupo' : ' grupos') + ' em execução';
    if (!n.aval || n.nv === n.aval) return 'sem vistoria';
    return n.nv ? w.semDano + ' · ' + n.nv + ' sem vistoria' : w.semDano;
  }
  // contrato: pontes com dano e, por grupo, quantas pontes e quanto (soma só das estimativas informadas)
  function oaeResumo(c) {
    var r = { dn: 0, exec: 0, nv: 0, pri: 0, grupos: {} }, lista = servicesOf(c);
    lista.forEach(function (s) { r.grupos[s.key] = { pontes: 0, q: 0, semQ: 0 }; });
    c.pontos.forEach(function (p) {
      var n = oaeNec(p, c);
      if (n.dn) r.dn++;
      if (n.exec) r.exec++;
      if (n.pri) r.pri++;
      if (!n.aval || n.nv === n.aval) r.nv++;
      lista.forEach(function (s) {
        var sv = p.serv[s.key], gr = r.grupos[s.key], q = sv && sv.q != null ? Number(sv.q) : NaN;
        if (oaeSt(sv) !== 'DN') return;
        gr.pontes++;
        if (s.un && s.un !== '%') { if (isFinite(q)) gr.q += q; else gr.semQ++; }
      });
    });
    return r;
  }
  // total por grupo ("Juntas: ~12 m em 3 pontes"), com os grupos e o item do tipo; sem c (folha das pontes, que não muda), os das pontes
  function oaeFaltaTxt(r, c) {
    var ti = c ? tipoInfo(c) : TIPOS.oae, asterisco = false, t = (c ? servicesOf(c) : ti.servicos).filter(function (s) { return r.grupos[s.key].pontes; }).map(function (s) {
      var gr = r.grupos[s.key], q = s.un && s.un !== '%' && gr.q ? '~' + fmtN(gr.q) + ' ' + s.un + (gr.semQ ? '*' : '') + ' em ' : '';
      if (q && gr.semQ) asterisco = true;
      return (s.tot || s.short) + ': ' + q + gr.pontes + ' ' + (gr.pontes === 1 ? ti.item : ti.itens);
    }).join(' · ');
    return t ? t + (asterisco ? '  (* há ' + ti.itens + ' sem a estimativa)' : '') : '';
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
  // valor em R$ (PI): aceita o "R$" colado de um documento e, sem vírgula, o ponto de milhar ("1.500.000"), que o parseNum
  // leria como decimal ("1.500" = 1,5) ou como texto (sem valor)
  function parseValor(v) {
    return parseQtd(String(v == null ? '' : v).replace(/R\$/gi, ''));
  }
  // quantidade (m³, m): sem vírgula, o ponto é de milhar como no R$ ("1.300" = mil e trezentos, não 1,3); "1.5" e
  // "1.300,50" seguem o parseNum. O km não passa por aqui: lá o ponto é decimal ("849.53")
  var QTD_CAMPO = /^(enr|sb|bgs|extensao|largura|extensaoContrato)$/;
  function parseQtd(v) {
    var t = String(v == null ? '' : v).replace(/\s/g, '');
    return parseNum(/^\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, '') : t);
  }
  // ao sair do campo de quantidade: reescreve como ficou gravado (1.300 -> 1.300,00) e avisa se não entendeu
  function qtdSaida(t, v, dec) {
    if (v == null && t.value.trim()) toast('Número não entendido: digite só o número, como 1.300,50.', 5000);
    t.value = dec ? fmt(v, 2) : fmtN(v);
  }
  // um Intl.NumberFormat por número de casas (toLocaleString cria um a cada chamada)
  var FMT = {};
  function fmt(n, dec) {
    if (n == null || !isFinite(n)) return '';
    var f = FMT[dec] || (FMT[dec] = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }));
    return f.format(Number(n));
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
    var pts = c.pontos, len = 0, enr = null, sb = null, bgs = null, pct = 0;
    pts.forEach(function (p) {
      len += pointLen(p) || 0;
      if (p.enr != null) enr = (enr || 0) + p.enr;
      if (p.sb != null) sb = (sb || 0) + p.sb;
      if (p.bgs != null) bgs = (bgs || 0) + p.bgs;
      pct += pointPct(p, c);
    });
    return { n: pts.length, len: len, enr: enr, sb: sb, bgs: bgs, avg: pts.length ? pct / pts.length : null };
  }
  // conservação (por enquanto só a faixa): a extensão do contrato ou, sem ela, km final − inicial; os segmentos do SNV
  // (snv-br230.js) que entram na faixa do km inicial ao final (sem os km ou sem o eixo, nenhum)
  function extensaoFaixa(c) {
    if (typeof c.extensaoContrato === 'number' && isFinite(c.extensaoContrato)) return c.extensaoContrato;
    return typeof c.kmIni === 'number' && typeof c.kmFim === 'number' && c.kmFim > c.kmIni ? r2(c.kmFim - c.kmIni) : null;
  }
  function snvDaFaixa(c) {
    var eixo = window.SNV_BR230;
    if (!eixo || !Array.isArray(eixo.segmentos) || typeof c.kmIni !== 'number' || typeof c.kmFim !== 'number') return [];
    return eixo.segmentos.filter(function (s) { return s.kmFim > c.kmIni + 0.001 && s.kmIni < c.kmFim - 0.001; });
  }
  // "122,00 km · 3 segmentos do SNV" (vazio sem a extensão e sem os km)
  function faixaTexto(c) {
    var e = extensaoFaixa(c), n = snvDaFaixa(c).length;
    return [e != null ? fmt(e, 2) + ' km' : '', n ? n + (n === 1 ? ' segmento do SNV' : ' segmentos do SNV') : ''].filter(Boolean).join(' · ');
  }
  // km inicial e final que dão para desenhar a faixa (números, o final depois do inicial)
  function kmFaixaOk(c) {
    return typeof c.kmIni === 'number' && typeof c.kmFim === 'number' && isFinite(c.kmIni) && isFinite(c.kmFim) && c.kmFim > c.kmIni;
  }
  // indicador EXECUÇÃO / VIGÊNCIA da folha da conservação, pelos prazos que são fim (fim 'exec', 'vig' ou 'ambos', com data;
  // plano, seção 3): o número é o último fim de execução confirmado, com " · vig. <data>" quando a vigência confirmada vai além,
  // e embaixo o fim previsto (a confirmar) quando é mais tarde. Sem fim confirmado, o número é o previsto, com "a confirmar"
  // embaixo e prev (caixa tracejada, número em cinza). O previsto que é só de vigência sai com "vig." ("prev. vig. 28/11/2026",
  // ou "30/08/2027 · vig. 28/11/2027" quando a vigência prevista vai além da execução prevista), para não ser lido como fim da
  // execução. Sem sit conta como a confirmar. { v, s, prev }
  function execVig(c) {
    var E = '', V = '', Pe = '', Pv = '';
    (Array.isArray(c.prazos) ? c.prazos : []).forEach(function (x) {
      if (!x || ['exec', 'vig', 'ambos'].indexOf(x.fim) < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(x.data || '')) return;
      var ex = x.fim !== 'vig', vg = x.fim !== 'exec';
      if (x.sit === 'conf') { if (ex && x.data > E) E = x.data; if (vg && x.data > V) V = x.data; }
      else { if (ex && x.data > Pe) Pe = x.data; if (vg && x.data > Pv) Pv = x.data; }
    });
    // o previsto só entra quando é mais tarde que o confirmado; a vigência prevista, só quando vai além da execução prevista
    var M = E > V ? E : V, pe = Pe > M ? Pe : '', pv = Pv > M && Pv > pe ? Pv : '';
    var p = pe ? fmtDate(pe) + (pv ? ' · vig. ' + fmtDate(pv) : '') : pv ? 'vig. ' + fmtDate(pv) : '';
    var s = p ? 'prev. ' + p + ' · a confirmar' : '';
    if (E) return { v: fmtDate(E) + (V > E ? ' · vig. ' + fmtDate(V) : ''), s: s, prev: false };
    if (V) return { v: 'vig. ' + fmtDate(V), s: s, prev: false };
    if (p) return { v: p, s: 'a confirmar', prev: true };
    return { v: '-', s: '', prev: false };
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
    if (isConserva(c)) return folhasConserva(c, semAnalise ? null : anOf(c));   // conservação: as folhas dela (folhasConserva), com o código à parte
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

  // kpisProprios (opcional): os indicadores da folha, no lugar dos do tipo (só a folha de colunas da conservação passa)
  function drawHeader(o, c, tot, an, kpisProprios) {
    var logo = window.UNIFILAR_LOGO, tx = 34;
    if (logo) {
      var lh = 56, lw = lh * logo.w / logo.h;
      o.push('<image x="32" y="30" width="' + r2(lw) + '" height="' + lh + '" preserveAspectRatio="xMidYMid meet" href="' + logo.src + '" xlink:href="' + logo.src + '"/>');
      tx = 32 + lw + 14;
    }
    // indicadores à direita
    var cons = isConserva(c), kpis = kpisProprios || (isOae(c) ? oaeKpis(c, tot, an) : cons ? faixaKpis(c) : [
      { k: 'EXTENSÃO DO CONTRATO', v: c.extensaoContrato != null ? fmt(c.extensaoContrato, 2) + ' km' : '-', s: '' },
      { k: 'PONTOS CRÍTICOS', v: String(tot.n), s: fmt(tot.len, 2) + ' km somados' },
      { k: 'AVANÇO MÉDIO', v: fmtPct(tot.avg), s: 'média dos pontos' },
      { k: 'ÚLTIMA VISTORIA', v: fmtDate(c.dataVistoria) || '-', s: '' }
    ]);
    var bw = 98, bg = 6, bx0 = G.x1 - (kpis.length * bw + (kpis.length - 1) * bg);
    if (cons) bx0 = drawKpisFaixa(o, kpis, bw, bg);
    else kpis.forEach(function (k, i) {
      var x = bx0 + i * (bw + bg);
      o.push(R(x, 30, bw, 56, { fill: '#F4F6F5', stroke: '#C7CCC9', sw: 0.7, rx: 3 }));
      o.push(T(x + 8, 43, k.k, { size: 5.8, bold: true, fill: '#5C6661' }));
      o.push(T(x + 8, 63, fitText(k.v, bw - 14, 14, true), { size: 14, bold: true }));
      if (k.s) o.push(T(x + 8, 77, fitText(k.s, bw - 14, 6.4), { size: 6.4, fill: '#5C6661' }));
    });
    var maxW = bx0 - tx - 16;
    o.push(T(tx, 41, fitText(String(c.orgao || '').toUpperCase(), maxW, 6.6), { size: 6.6, fill: '#5C6661' }));
    if (cons) {
      // conservação: o título inteiro, com a letra diminuindo (até 13 pt) em vez de ser cortado
      var tit = 'DIAGRAMA LINEAR · ' + (ctGrupo(c) === 'sinal' ? 'SINALIZAÇÃO' : 'CONSERVAÇÃO (P.A.T.O.)') + ' · CT ' + (txtPdf(c.numero) || '[Nº DO CONTRATO]'), ts = fitSize(tit, maxW, 17, true, 13);
      o.push(T(tx, 62, fitText(tit, maxW, ts, true), { size: r2(ts), bold: true }));
    } else o.push(T(tx, 62, fitText((isOae(c) ? 'DIAGRAMA DE OAEs · CT ' : 'DIAGRAMA LINEAR · OBRA ') + (c.numero || '[Nº DA OBRA]'), maxW, 17, true), { size: 17, bold: true }));
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
    var lista = servicesOf(c), passo = servPasso(lista);
    lista.forEach(function (s, i) {
      o.push(T(x, G.yServ + i * passo + 12.8, s.label, { size: 7.2, bold: true }));
    });
    o.push(T(x, G.yObs + 12, 'OBSERVAÇÕES', { size: 7, bold: true }));
    o.push(L(G.colLine, 106, G.colLine, G.yObs + G.obsH, { stroke: '#C9CECB', sw: 0.6 }));
  }

  // passo das linhas de serviço na folha: 24 com as 5 de sempre; com a 6ª (Contenção), 21, para caber antes das observações
  function servPasso(lista) { return lista.length > 5 ? 21 : G.servStep; }
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
    var vols = [p.enr != null ? 'Enr: ' + fmt(p.enr, 2) + ' m³' : null, p.sb != null ? 'Sb: ' + fmt(p.sb, 2) + ' m³' : null,
      p.bgs != null ? 'BGS: ' + fmt(p.bgs, 2) + ' m³' : null].filter(Boolean);
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
    var lista = servicesOf(ownerOf(p)), passo = servPasso(lista);
    lista.forEach(function (s, i) {
      var sv = p.serv[s.key] || { st: 'NA', pct: 0 }, y = G.yServ + i * passo, st = STATUS[sv.st] || STATUS.NA;
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
      if (tot.bgs != null) parts.push(['BGS prevista', fmt(tot.bgs, 2) + ' m³']);
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

  // ------------------------------------------------------------------ folhas da conservação
  // folhas da conservação, na ordem das páginas. 'colunas' = o modelo de sempre (uma coluna por segmento, página 1);
  // 'escala' = a faixa em escala do passo 1.4. Tirar um nome daqui tira a folha (o usuário decide depois qual fica)
  var FOLHAS_CONSERVA = ['colunas', 'escala'];
  // As páginas do contrato de conservação numa passada só, cada folha desenhada uma vez: cada página é uma função (i, n) que
  // desenha a página i de n (o "Página i de n" conta todas as folhas, na ordem de FOLHAS_CONSERVA). As colunas sem segmento só
  // saem quando são a única folha da lista (F-5 a: até gerar os segmentos, fica só a folha em escala, como antes); a lista
  // nunca sai vazia (sem nome conhecido em FOLHAS_CONSERVA, saem as colunas)
  // an: a análise das medições (folha "Com análise", de uso interno) ou null (só a vistoria)
  function folhasConserva(c, an) {
    var L = FOLHAS_CONSERVA.filter(function (k) { return k === 'colunas' || k === 'escala'; }), folhas = [];
    if (!L.length) L = ['colunas'];
    var soColunas = L.indexOf('escala') < 0;
    L.forEach(function (k) {
      if (k === 'colunas') {
        if (c.pontos.length || soColunas) folhas = folhas.concat(paginasColunas(c, soColunas, an));   // página 1 (passo 2.3)
        return;
      }
      var q = quadrosFaixa(c);
      folhas.push(function (i, n) { return renderFaixa(c, i, n, q, an); });   // folha em escala (passo 1.4)
      // continuação da folha em escala, logo depois dela, só quando os prazos e valores não couberam nos quadros (E-3)
      q.cont.forEach(function (pg) { folhas.push(function (i, n) { return quadrosCont(c, i, n, q, pg, an); }); });
    });
    return folhas.map(function (f, i) { return f(i, folhas.length); });
  }

  // Folha em escala: o cabeçalho da conservação (drawHeader) e o contrato em escala, em duas faixas empilhadas (cada uma com a
  // metade do km Atualizado), com as localidades (marcos) e as pontas do contrato com o km duplo, os segmentos do SNV
  // (snv-br230.js), a pista e as réguas do km Atualizado e do km do contrato (snv-conversao.js); embaixo, os quadros de prazos e
  // valores (CONFIRMADOS e PREVISTOS, A CONFIRMAR) e as Observações gerais (obsFolha) e, no rodapé, a legenda, as notas e o TOTAL
  // GERAL. Sem os outros contratos e sem as pontes (decisões 0.8 e 0.10). Sem hachura, recorte, transparência nem itálico, que o
  // PDF não passa a limpo; o tracejado passa.
  // Geometria (pt; opção B da E-1): faixas de 222 pt a partir de y 104, com 10 pt entre elas; dentro da faixa, a partir do topo y0,
  // as distâncias da maquete: bandeiras em y0 + 4 (a 2ª e a 3ª linha de 29 em 29 pt, no vão que era das pontes), SNV em y0 + 102,
  // pista em y0 + 128, régua do km Atualizado em y0 + 166 e régua do km do contrato em y0 + 194. Embaixo das faixas, a linha dos
  // quadros, de 172 pt; rodapé em y 744 (16 pt acima do G.yFoot das outras folhas, para caber as notas)
  var GF = { yTop: 104, H: 222, gap: 10, flagY: 4, flagH: 25, flagStep: 29, ySeg: 102, segH: 20, yBand: 128, bandH: 30, yRule: 166, yRuleC: 194, yF: 744 };
  // texto que vai à folha da conservação: o PDF sai sem fonte embutida (buildPdf), e a Helvetica dele só tem o Latin-1 e os extras
  // do Windows-1252 (– — ‘ ’ “ ” • … € ™ e outros). "≈" vira "aprox. ", "→" vira " para ", os traços U+2212, U+2010 e U+2011
  // viram "-", "≤" e "≥" viram "<=" e ">=", "′" e "″" viram ' e "; tabulação e espaço não separável viram espaço e os espaços
  // repetidos, um só (sem tocar nas quebras de linha do formulário, que o wrap respeita); qualquer outro caractere (emoji
  // inclusive, um "?" por caractere) vira "?". A tela mostra o mesmo que o PDF: quem digitou vê o "?" e corrige. Vem DEPOIS do
  // toUpperCase (o "µ" em maiúscula é o "Μ" grego, que a fonte não tem). Só nas funções da conservação: não entra em T(), que é
  // das outras folhas
  function txtPdf(s) {
    s = String(s == null ? '' : s);
    if (s.normalize) s = s.normalize('NFC');   // "c" + cedilha separada (texto colado de outro sistema) vira o "ç" da fonte
    return s.replace(/\r\n?/g, '\n').replace(/\u2248[ \t\u00A0]*/g, 'aprox. ').replace(/[ \t\u00A0]*\u2192[ \t\u00A0]*/g, ' para ')
      .replace(/[\u2212\u2010\u2011]/g, '-').replace(/\u2264/g, '<=').replace(/\u2265/g, '>=').replace(/\u2032/g, "'").replace(/\u2033/g, '"')
      .replace(/[ \t\u00A0]+/g, ' ')
      .replace(/[^\n\u0020-\u007E\u00A0-\u00FF\u0152\u0153\u0160\u0161\u0178\u017D\u017E\u0192\u02C6\u02DC\u2013\u2014\u2018-\u201A\u201C-\u201E\u2020-\u2022\u2026\u2030\u2039\u203A\u20AC\u2122]/gu, '?');
  }
  // as duas faixas da folha em escala, [[kA, kB], [kB, kC]], cada uma com a metade do contrato (km Atualizado); null sem os km ou
  // com o contrato de até 0,01 km (no lugar das faixas, o aviso)
  function faixasDe(c) {
    if (!kmFaixaOk(c) || c.kmFim <= c.kmIni + 0.01) return null;
    var m = Math.round((c.kmIni + c.kmFim) / 2 * 1e6) / 1e6;
    return [[c.kmIni, m], [m, c.kmFim]];
  }
  // escala da faixa na folha A3 impressa sem ajuste de tamanho (E-6), pelos pt por km (1 pt = 25,4/72 mm): "1 km = 5,9 mm (A3)"
  function escalaFaixa(ppk) {
    var mm = ppk * 25.4 / 72;
    return '1 km = ' + fmt(mm, mm < 1 ? 2 : 1) + ' mm (A3)';
  }
  // passos das réguas pela escala (pt por km): o 1º par [maior, menor], em km, com o maior a 60 pt ou mais e o menor a 4 pt ou
  // mais (437 e 438: 5 e 1, como a maquete). Sem par que sirva (contrato de milhares de km, como um km final digitado errado), o
  // último vezes 10 até servir: a régua nunca fica sem passo, e o menor a 4 pt ou mais limita os traços (cerca de 255 por régua)
  function passoRegua(ppk) {
    var P = [[0.1, 0.02], [0.2, 0.05], [0.5, 0.1], [1, 0.2], [2, 0.5], [5, 1], [10, 2], [20, 5], [50, 10], [100, 20]];
    var p = P.find(function (q) { return q[0] * ppk >= 60 && q[1] * ppk >= 4; });
    if (p) return p;
    var a = 1000, b = 200;
    while (a < 1e12 && !(a * ppk >= 60 && b * ppk >= 4)) { a *= 10; b *= 10; }
    return [a, b];
  }
  // traços de uma régua de kA a kB, sem as pontas, com o par de passoRegua: contados por índice inteiro (i · menor), para não
  // errar o múltiplo somando decimais; o traço maior é o de i múltiplo de maior/menor. [{ k, maior }]
  function tracosRegua(kA, kB, par) {
    var me = par[1], n = Math.round(par[0] / me), out = [];
    for (var i = Math.floor(kA / me + 1e-9) + 1; i * me < kB - 1e-9; i++) out.push({ k: Math.round(i * me * 1e6) / 1e6, maior: i % n === 0 });
    return out;
  }
  // por que a régua do km do contrato sai ou não na folha, nesta ordem: 'semFaixa' (sem os km para desenhar as faixas),
  // 'semCadastro' (sem os dois km do contrato no cadastro), 'semRegua' (snv-conversao.js não carregou: o index.html antigo
  // guardado no aparelho), 'semEixo' (snv-br230.js não carregou, ou veio sem a versão), 'outraVersao' (o eixo mudou de versão e a
  // régua não foi gerada de novo), 'foraDominio' (ponta do contrato fora do domínio da régua) ou 'ok'
  // os intervalos de km do site cobertos pela régua: um por trecho (a 202104A tem dois, 301,30–642,40 e 741,70–999,80)
  function dominiosDe(conv) {
    if (conv && Array.isArray(conv.trechos) && conv.trechos.length) return conv.trechos.map(function (q) { return [q[0][1], q[q.length - 1][1]]; });
    var q = (conv && conv.quebras) || [], d = conv && conv.dominio && conv.dominio.site;
    return d ? [d] : q.length ? [[q[0][1], q[q.length - 1][1]]] : [];
  }
  function reguaStatus(c) {
    var conv = reguaDe(c), eixo = window.SNV_BR230;
    if (!faixasDe(c)) return 'semFaixa';
    if (c.kmLocal) return 'kmLocal';   // 731: km próprio do ramal (c.ramal), sem a régua do SNV
    if (typeof c.kmIniContrato !== 'number' || typeof c.kmFimContrato !== 'number' || !isFinite(c.kmIniContrato) || !isFinite(c.kmFimContrato)) return 'semCadastro';
    if (!conv || typeof conv.paraContrato !== 'function') return 'semRegua';
    if (!eixo || !eixo.versao) return 'semEixo';
    if (conv.para !== eixo.versao) return 'outraVersao';
    if (!kmDoContrato(c, c.kmIni) || !kmDoContrato(c, c.kmFim)) return 'foraDominio';
    // as duas pontas num trecho só: com o buraco no meio, a régua não cobre o contrato todo
    if (!dominiosDe(conv).some(function (d) { return c.kmIni >= d[0] - 1e-6 && c.kmFim <= d[1] + 1e-6; })) return 'foraDominio';
    return 'ok';
  }
  // texto no lugar da régua do km do contrato, na faixa em que ela não sai
  var REGUA_SEM = {
    semCadastro: 'km do contrato não informado no cadastro',
    semRegua: 'km do contrato indisponível neste aparelho (ver nota)',
    semEixo: 'km do contrato indisponível neste aparelho (ver nota)',
    outraVersao: 'km do contrato indisponível neste aparelho (ver nota)',
    foraDominio: 'km do contrato fora do domínio da régua (ver nota)'
  };
  // linha (r: 0 a 2) e posição da caixa (bx) de cada bandeira de uma faixa, para duas ou três bandeiras perto uma da outra não se
  // cobrirem. itens: [{ x, w }] (x da haste e largura da caixa, já medidas). Para cada bandeira, a 1ª linha e a 1ª posição
  // (centrada na haste, presa à direita dela ou presa à esquerda, sempre entre x0 e x1) em que a caixa não encosta (folga de
  // 4 pt) noutra da mesma linha nem cobre (2 pt) a haste de uma bandeira de linha de cima, e em que a haste não passa (2 pt) por
  // caixa de linha de baixo; sem lugar, linha 2, centrada, e a bandeira vai para a reserva (fica sobreposta). Tenta na ordem
  // crescente e na decrescente de x (junto de cada borda, uma das duas falha) e fica com a que deixar menos bandeiras na reserva
  // (empate: a crescente). { pos: [{ bx, r }] na ordem de itens, reserva: [índices de itens] }
  function linhasBandeiras(itens, x0, x1) {
    function tentar(desc) {
      var postos = [], pos = [], reserva = [];
      itens.map(function (b, i) { return i; }).sort(function (a, b) { return desc ? itens[b].x - itens[a].x : itens[a].x - itens[b].x; }).forEach(function (i) {
        var x = itens[i].x, w = itens[i].w, achou = null;
        var cands = [x - w / 2, x - 3, x - w + 3].map(function (bx) { return clamp(bx, x0, x1 - w); });
        for (var r = 0; r < 3 && !achou; r++) {
          for (var k = 0; k < cands.length && !achou; k++) {
            var bx = cands[k];
            if (postos.every(function (p) {
              if (p.r === r) return bx + w + 4 <= p.bx || p.bx + p.w + 4 <= bx;   // caixa da mesma linha
              if (p.r < r) return !(bx - 2 <= p.x && p.x <= bx + w + 2);           // haste de uma bandeira de cima
              return !(p.bx - 2 <= x && x <= p.bx + p.w + 2);                      // caixa de baixo no caminho da haste
            })) achou = { bx: bx, r: r };
          }
        }
        if (!achou) { achou = { bx: clamp(x - w / 2, x0, x1 - w), r: 2 }; reserva.push(i); }
        postos.push({ x: x, w: w, bx: achou.bx, r: achou.r });
        pos[i] = achou;
      });
      return { pos: pos, reserva: reserva };
    }
    var a = tentar(false), d = tentar(true);
    return d.reserva.length < a.reserva.length ? d : a;
  }
  // nomes das bandeiras das pontas do contrato (pretas), em maiúsculas: a inicial "INÍCIO CT 437 · <nome>" e a final "<nome>". O
  // nome é o do marco que está na ponta (a até 0,001 km, como em kmDoContrato; ele vira a bandeira da ponta) ou, sem ele, a
  // origem ou o destino sem o "(km ...)" do fim; sem os dois, "INÍCIO CT 437" e "FIM CT 437" (sem o número, "DO CONTRATO")
  function pontasFaixa(c) {
    var n = ctNumeroCurto(c);
    function nome(k, txt) {
      var m = (c.marcos || []).find(function (q) { return q && typeof q.km === 'number' && Math.abs(q.km - k) < 0.001; });
      return (m && txtLimpo(m.nome)) || txtLimpo(String(txt || '').replace(/\s*\(km [^)]*\)\s*$/i, ''));
    }
    var ni = nome(c.kmIni, c.origem), nf = nome(c.kmFim, c.destino);
    return {
      ini: ((n ? 'INÍCIO CT ' + n : 'INÍCIO DO CONTRATO') + (ni ? ' · ' + ni : '')).toUpperCase(),
      fim: (nf || (n ? 'FIM CT ' + n : 'FIM DO CONTRATO')).toUpperCase()
    };
  }
  // nome do SNV (em maiúsculas no snv-br230.js) em caixa de título, como a maquete: "Fim da Pavimentação", "Entr. PA-370",
  // "Entr. BR-163/230 (Rurópolis)"
  function snvTitulo(s) {
    return String(s || '').toLowerCase().replace(/(^|[\s(\/])([^\s(\/])/g, function (a, b, l) { return b + l.toUpperCase(); })
      .replace(/(^|\s)([A-Z][a-z])-(?=\d)/g, function (a, b, p) { return b + p.toUpperCase() + '-'; })
      .replace(/\bEntr(?=\s)/g, 'Entr.').replace(/\s(Da|De|Do|Das|Dos|E)(?=\s)/g, function (a) { return a.toLowerCase(); });
  }
  // notas do rodapé da folha em escala, nesta ordem e cada uma só quando vale: conversão do km (quando a régua do km do contrato
  // sai em alguma faixa), asterisco das pontas (quando o cadastro discorda da régua), régua indisponível ou fora do domínio
  // (reguaStatus) e a da pista (sempre). Sem as faixas, só a da pista. Os números e as versões vêm da régua e do eixo
  function notasConserva(c) {
    var st = reguaStatus(c), conv = reguaDe(c), eixo = window.SNV_BR230, out = [];
    var pista = pistaDe(c).nota;
    if (st === 'semFaixa') return [pista];
    if (st === 'kmLocal') return ['KM LOCAL: km próprio do segmento ' + txtPdf(txtLimpo(c.ramal)) + ' do SNV, fora do eixo da BR-230 (sem km Atualizado). Estaca de 20 m: km = estaca x ' + fmt(c.estaca || 0.02, 2) + '.', pista];
    if (kmSoContrato(c)) return [notaKmMp(c, st), pista];
    if (faixasDe(c).some(function (f) { return kmDoContrato(c, f[0]) && kmDoContrato(c, f[1]); })) {
      var sc = txtPdf(txtLimpo(c.snvContrato)), dp = [conv.de ? 'de ' + conv.de : '', conv.para ? 'para ' + conv.para : ''].filter(Boolean).join(' ');
      out.push('KM Atualizado: SNV ' + eixo.versao + ' (DNIT). KM do contrato' + (sc ? ': ' + sc + ',' : '') + ' pela tabela de conversão do SNV' + (dp ? ' (' + dp + ')' : '') + ': ' +
        trechoConversao(c, conv) + '. A conversão vale de SNV para SNV, não para hodômetro.');
    }
    var ast = [[c.kmIni, 'no início'], [c.kmFim, 'no fim']].map(function (p) {
      var r = kmDoContrato(c, p[0]);
      return r && r.ast ? '* ' + fmtKm(r.km) + ' = km do contrato ' + p[1] + ', pelo cadastro, adotado no km Atualizado ' + fmtKm(p[0]) + '; pela geometria do SNV, o km Atualizado ' + fmtKm(p[0]) + ' é o ' + fmtKm(r.geom) + ' do contrato.' : '';
    }).filter(Boolean);
    if (ast.length) out.push(ast.join(' '));
    if (st === 'semCadastro') out.push('Sem o km do contrato no cadastro: a folha mostra só o km Atualizado.');
    else if (st === 'semRegua') out.push('A régua do km do contrato não foi carregada neste aparelho (versão antiga do app guardada sem internet): a folha saiu sem o km do contrato. Abra o app com internet e gere a folha de novo.');
    else if (st === 'semEixo') out.push('O eixo do SNV (km Atualizado) não foi carregado inteiro neste aparelho: a folha saiu sem o km do contrato. Abra o app com internet e gere a folha de novo.');
    else if (st === 'outraVersao') out.push('A régua do km do contrato é ' + (conv.para ? 'do SNV ' + conv.para : 'de outra versão do SNV') + ', e o km Atualizado é do SNV ' + eixo.versao + ': a folha saiu sem o km do contrato.');
    else if (st === 'foraDominio') out.push(notaDominio(conv));
    out.push(pista);
    return out;
  }
  // 709 (kmSoContrato): a folha mostra só o km das MPs, com o rótulo do cadastro; o desenho é posicionado pelo eixo do SNV
  // curta: na folha de colunas (3 linhas de notas), sem o SNV do contrato
  function notaKmMp(c, st, curta) {
    var sc = curta ? '' : txtPdf(txtLimpo(c.snvContrato));
    return txtPdf(txtLimpo(c.rotuloKmContrato)).replace(/^km\b/i, 'KM') + ': o km escrito nas medições (MPs)' + (sc ? '; ' + sc : '') +
      '. Cada serviço medido traz o km da própria MP. O desenho é posicionado pelo eixo do SNV do DNIT.' +
      (st === 'ok' ? '' : ' A régua do km da MP não saiu neste aparelho: abra o app com internet e gere a folha de novo.');
  }
  // nota do domínio da régua: "do km Atualizado 301,30 ao 642,40 e do 741,70 ao 999,80"
  function notaDominio(conv) {
    var ds = dominiosDe(conv);
    if (!ds.length) return 'O km do contrato só é calculado dentro do domínio da régua.';
    return 'O km do contrato só é calculado do km Atualizado ' + ds.map(function (d, i) { return (i ? 'do ' : '') + fmtKm(d[0]) + ' ao ' + fmtKm(d[1]); }).join(' e ') + ' (domínio da régua).';
  }
  // a relação entre o km Atualizado e o km do contrato, pelos pontos de quebra da régua: a diferença (contrato − Atualizado) na
  // ponta inicial, em cada quebra dentro do contrato e na ponta final; igual (a 0,005 km) em todos: "em todo o contrato, km
  // Atualizado = km do contrato - 7,10" (438); igual só de uma quebra em diante: "do km 783,90 do contrato em diante, ...; antes
  // disso a conversão segue a geometria" (437); nunca igual: "a conversão segue a geometria do SNV". Só os pontos dentro do
  // domínio da régua contam
  function trechoConversao(c, conv) {
    var qs = (conv.quebras || []).map(function (q) { return q[1]; }).filter(function (s) { return s > c.kmIni + 0.001 && s < c.kmFim - 0.001; });
    var todos = [c.kmIni].concat(qs, [c.kmFim]), p = todos.map(function (s) { var k = conv.paraContrato(s); return k == null ? null : { k: k, d: k - s }; }).filter(Boolean);
    if (p.length < 2) return 'a conversão segue a geometria do SNV';
    var d = p[p.length - 1].d, j = p.length - 1;
    while (j > 0 && Math.abs(p[j - 1].d - d) <= 0.005) j--;
    var rel = 'km Atualizado = km do contrato' + (Math.abs(d) < 0.005 ? '' : (d > 0 ? ' - ' : ' + ') + fmtKm(Math.abs(d)));
    if (!j) return (p.length === todos.length ? 'em todo o contrato, ' : 'dentro do domínio da régua, ') + rel;
    if (j < p.length - 1) return 'do km ' + fmtKm(p[j].k) + ' do contrato em diante, ' + rel + '; antes disso a conversão segue a geometria';
    return 'a conversão segue a geometria do SNV';
  }
  function faixaKpis(c) {
    var ki = c.kmIniContrato, kf = c.kmFimContrato, e = extensaoFaixa(c), ev = execVig(c);
    function num(k) { return typeof k === 'number' && isFinite(k); }
    // nas pontas, o km do cadastro, com "*" quando a régua discorda (o início do 437: 750,90*)
    function contr(k, s) { var r = kmDoContrato(c, s); return num(k) ? fmtKm(k) + (r && r.ast ? '*' : '') : '?'; }
    return [
      { k: 'EXTENSÃO DO CONTRATO', v: e != null ? fmt(e, 2) + ' km' : '-', s: !kmFaixaOk(c) ? '' : kmSoContrato(c) ? 'segmentos de ' + contr(ki, c.kmIni) + ' a ' + contr(kf, c.kmFim) : (c.kmLocal ? 'km local ' : 'km Atualizado ') + fmtKm(c.kmIni) + '–' + fmtKm(c.kmFim) },
      // 709: o rótulo do cadastro ("KM DA MP (SNV 2023–2025)") no lugar de "KM DO CONTRATO"
      { k: kmSoContrato(c) ? txtPdf(txtLimpo(c.rotuloKmContrato)).toUpperCase() : 'KM DO CONTRATO', v: num(ki) || num(kf) ? contr(ki, c.kmIni) + ' a ' + contr(kf, c.kmFim) : '-', s: txtPdf(txtLimpo(c.snvContrato)) },
      { k: 'EXECUÇÃO / VIGÊNCIA', v: ev.v, s: ev.s, prev: ev.prev, w: 160 },
      { k: 'ÚLTIMA VISTORIA', v: fmtDate(c.dataVistoria) || '-', s: '' }
    ];
  }
  // indicadores da conservação: largura própria (k.w, padrão bw); o que é só previsto (k.prev) em caixa tracejada, com o número
  // em cinza; o número diminui (até 9 pt) em vez de ser cortado e a linha de baixo sai inteira (kpiSub). Devolve o x da 1ª caixa
  function drawKpisFaixa(o, kpis, bw, bg) {
    var x0 = G.x1 - kpis.reduce(function (s, k) { return s + (k.w || bw) + bg; }, -bg);
    kpis.reduce(function (x, k) {
      var w = k.w || bw, vs = fitSize(k.v, w - 14, 14, true, 9), sb = kpiSub(k.s, w - 14);
      o.push(k.prev ? R(x, 30, w, 56, { fill: '#FFFFFF', stroke: '#8E9792', sw: 0.9, rx: 3, dash: '3 2' }) : R(x, 30, w, 56, { fill: '#F4F6F5', stroke: '#C7CCC9', sw: 0.7, rx: 3 }));
      o.push(T(x + 8, 43, k.k, { size: 5.8, bold: true, fill: '#5C6661' }));
      o.push(T(x + 8, 63, fitText(k.v, w - 14, vs, true), { size: r2(vs), bold: true, fill: k.prev ? '#5C6661' : '#17201C' }));
      if (k.s) sb.ls.forEach(function (ln, i) { o.push(T(x + 8, sb.ls.length > 1 ? 74 + i * 7 : 77, ln, { size: r2(sb.size), fill: '#5C6661' })); });
      return x + w + bg;
    }, x0);
    return x0;
  }
  // linha de baixo de um indicador da conservação, inteira, nunca com "...": a letra diminui de 6,4 até 5,6 pt e, se ainda não
  // couber, o texto quebra em 2 linhas de 5,6 pt, no espaço que deixa as duas mais parecidas (o SNV do contrato do 437,
  // "SNV 2020–2022 (citado como 202101A)"); só o texto que nem em 2 linhas cabe fica abaixo de 5,6 pt. { ls, size }
  function kpiSub(s, w) {
    s = String(s || '');
    var ss = fitSize(s, w, 6.4, false, 5.6);
    if (textW(s, ss) <= w) return { ls: [s], size: ss };
    var p = s.split(' '), best = { ls: [s], m: textW(s, 5.6) };
    for (var i = 1; i < p.length; i++) {
      var ls = [p.slice(0, i).join(' '), p.slice(i).join(' ')], m = Math.max(textW(ls[0], 5.6), textW(ls[1], 5.6));
      if (m < best.m) best = { ls: ls, m: m };
    }
    return { ls: best.ls, size: Math.min(5.6, 5.6 * w / best.m) };
  }
  // sentido: a origem e o destino quebram em até 2 linhas cada (a 2ª recuada), em vez de serem cortados na 1ª; o que passar
  // das 2 linhas termina em "..."
  function sentidoFaixa(o, c, x, w, gray) {
    var y = 114;
    o.push(T(x, 104, 'SENTIDO', { size: 6, bold: true, fill: gray }));
    [['De: ', c.origem], ['Para: ', c.destino]].forEach(function (d) {
      var ind = textW(d[0], 7.4, true), ls = wrap(d[0] + (txtPdf(txtLimpo(d[1])) || '-'), w, 7.4, true);
      if (ls.length > 1) ls = [ls[0], fitText(ls.slice(1).join(' '), w - ind, 7.4, true)];
      ls.forEach(function (ln, i) { o.push(T(x + (i ? ind : 0), y, ln, { size: 7.4, bold: true })); y += 8.4; });
    });
    var ya = y - 2.4;
    o.push(L(x, ya, x + 70, ya, { stroke: '#B42318', sw: 1.4 }));
    o.push(P([[x + 76, ya], [x + 68, ya - 4], [x + 68, ya + 4]], '#B42318'));
  }
  // q: os quadros de prazos e valores, já medidos e repartidos (quadrosFaixa)
  function renderFaixa(c, pageIdx, pageCount, q, an) {
    var o = [], x = G.labelX, w = G.colLine - G.labelX - 6, gray = '#5C6661', fx = faixasDe(c);
    var yq = GF.yTop + 2 * GF.H + GF.gap + 4, hq = GF.yF - 10 - yq;   // linha dos quadros, embaixo das faixas: y 562, 172 pt
    q = q || quadrosFaixa(c);
    o.push('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ' + PAGE_W + ' ' + PAGE_H + '" width="' + PAGE_W + '" height="' + PAGE_H + '">');
    o.push(R(0, 0, PAGE_W, PAGE_H, { fill: '#FFFFFF' }));
    o.push(R(G.frame, G.frame, PAGE_W - 2 * G.frame, PAGE_H - 2 * G.frame, { stroke: '#17201C', sw: 1.1 }));
    if (an) drawUsoInterno(o);   // a folha "Com análise" sai inteira como uso interno, inclusive esta
    drawHeader(o, c);
    sentidoFaixa(o, c, x, w, gray);

    if (!fx) {
      o.push(T((G.x0 + G.x1) / 2, GF.yTop + GF.yBand + 4, 'Informe o KM inicial e o final (km Atualizado) nos dados do contrato para desenhar a faixa.', { size: 12, fill: gray, anchor: 'middle' }));
    } else {
      var st = reguaStatus(c), segs = snvDaFaixa(c), pontas = pontasFaixa(c);
      fx.forEach(function (f, i) { faixaEscala(o, c, f[0], f[1], i, fx.length, st, segs, pontas); });
    }

    // quadros de prazos e valores: o que coube inteiro; o resto vai para a folha seguinte (quadrosCont)
    o.push(T(x, yq + 12, 'PRAZOS E VALORES', { size: 7, bold: true }));
    o.push(T(x, yq + 22, 'do contrato', { size: 6.2, fill: gray }));
    quadroItens(o, true, QX.conf, yq, hq, q.conf, 0, q.n1.conf);
    quadroItens(o, false, QX.prev, yq, hq, q.prev, 0, q.n1.prev);
    obsFaixa(o, c, yq, hq);
    o.push(L(G.colLine, 106, G.colLine, GF.yF - 10, { stroke: '#C9CECB', sw: 0.6 }));
    rodapeFaixa(o, c, GF.yF);
    o.push(T(G.x1, PAGE_H - G.frame - 6, 'Página ' + (pageIdx + 1) + ' de ' + pageCount + '   ·   Gerado em ' + fmtDate(todayIso()), { size: 6.4, fill: gray, anchor: 'end' }));
    o.push('</svg>');
    return o.join('');
  }
  // uma faixa da folha em escala, de kA a kB (km Atualizado), a i-ésima de n, num <g data-faixa> com os km da faixa (para conferir
  // no console): os rótulos da coluna da esquerda e, nesta ordem, os segmentos do SNV, a pista, as réguas e as bandeiras (as
  // hastes e as setas antes das caixas, que ficam por cima). st: reguaStatus(c); segs: snvDaFaixa(c); pontas: pontasFaixa(c)
  function faixaEscala(o, c, kA, kB, i, n, st, segs, pontas) {
    var y0 = GF.yTop + i * (GF.H + GF.gap), yB = y0 + GF.yBand, x = G.labelX, w = G.colLine - G.labelX - 6, gray = '#5C6661';
    var ppk = (G.x1 - G.x0) / (kB - kA), X = function (k) { return G.x0 + (k - kA) * ppk; }, ultima = i === n - 1;
    var versao = window.SNV_BR230 && window.SNV_BR230.versao, pedacos = [], lim = [];
    segs.forEach(function (g) {
      var a = Math.max(g.kmIni, kA), b = Math.min(g.kmFim, kB);
      if (b - a > 0.001) pedacos.push({ g: g, a: a, b: b });
      [g.kmIni, g.kmFim].forEach(function (k) {
        if (k > kA + 0.001 && k < kB - 0.001 && !lim.some(function (q) { return Math.abs(q - k) < 0.001; })) lim.push(k);
      });
    });
    o.push('<g data-faixa="' + (i + 1) + '" data-ka="' + kA + '" data-kb="' + kB + '">');
    if (i) o.push(L(G.frame, y0 - 6, PAGE_W - G.frame, y0 - 6, { stroke: '#C9CECB', sw: 0.6 }));

    // coluna da esquerda: a faixa, a escala e o nome de cada linha do desenho
    o.push(T(x, y0 + 62, 'FAIXA ' + (i + 1) + ' DE ' + n, { size: 6, bold: true, fill: gray }));
    var so = kmSoContrato(c);   // 709: só o km das MPs (o do contrato), na linha da régua de cima; a de baixo não sai
    o.push(T(x, y0 + 72, so ? 'km ' + kmContrTxt(c, kA) + ' a ' + kmContrTxt(c, kB) : 'km ' + fmtKm(kA) + ' a ' + fmtKm(kB), { size: 6.6, fill: gray }));
    o.push(T(x, y0 + 84, escalaFaixa(ppk), { size: 6, fill: gray }));
    if (pedacos.length) o.push(T(x, y0 + 115, 'SEGMENTO SNV', { size: 7, bold: true }));
    o.push(T(x, y0 + 140, 'PISTA', { size: 7, bold: true }));
    o.push(T(x, y0 + 150, pistaDe(c).nome, { size: 6.2, fill: gray }));
    o.push(T(x, y0 + 158, pistaDe(c).sub || '(predominante)', { size: 6.2, fill: gray }));
    var sc = txtPdf(txtLimpo(c.snvContrato)), ss = fitSize(sc, w, 5.8, false, 4.8);
    if (so) {
      // o rótulo do cadastro em 2 linhas: "KM DA MP" e o SNV entre parênteses
      var rk = txtPdf(txtLimpo(c.rotuloKmContrato)).toUpperCase(), rm = /^(.*?)\s*(\(.*\))$/.exec(rk);
      o.push(T(x, y0 + 178, fitText(rm ? rm[1] : rk, w, 7, true), { size: 7, bold: true, fill: '#6B4E16' }));
      if (rm) o.push(T(x, y0 + 186, fitText(rm[2], w, 5.8), { size: 5.8, fill: gray }));
    } else {
      o.push(T(x, y0 + 178, c.kmLocal ? 'KM LOCAL' : 'KM ATUALIZADO', { size: 7, bold: true }));
      if (c.kmLocal ? c.ramal : versao) o.push(T(x, y0 + 186, 'SNV ' + (c.kmLocal ? c.ramal : versao), { size: 5.8, fill: gray }));
      o.push(T(x, y0 + 206, c.kmLocal ? 'ESTACA (20 M)' : 'KM DO CONTRATO', { size: 7, bold: true, fill: '#6B4E16' }));
      if (sc) o.push(T(x, y0 + 214, fitText(sc, w, ss), { size: r2(ss), fill: gray }));
    }

    // segmentos do SNV que entram na faixa: código, de onde a onde e a extensão nominal (no pedaço de menos de 30 pt, sem texto)
    pedacos.forEach(function (p) {
      var xa = X(p.a), xb = X(p.b), g = p.g;
      o.push(R(xa, y0 + GF.ySeg, xb - xa, GF.segH, { fill: '#EEF0EF', stroke: '#7D8581', sw: 0.6 }));
      if (xb - xa < 30) return;
      var t = txtPdf([txtLimpo(g.codigo), snvTitulo(g.de) + ' – ' + snvTitulo(g.ate), typeof g.extensao === 'number' ? fmt(g.extensao, 1) + ' km nominais' : ''].filter(Boolean).join(' · '));
      o.push(T((xa + xb) / 2, y0 + GF.ySeg + 13, fitText(t, xb - xa - 8, 6.6, true), { size: 6.6, bold: true, anchor: 'middle' }));
    });
    // pista, com o eixo tracejado; os limites dos segmentos tracejados até a régua do contrato; o traço vermelho nas pontas do
    // contrato (o início na 1ª faixa, o fim na última)
    o.push(R(G.x0, yB, G.x1 - G.x0, GF.bandH, { fill: pistaDe(c).cor }));
    o.push(L(G.x0, yB + GF.bandH / 2, G.x1, yB + GF.bandH / 2, { stroke: '#30353A', sw: 0.8, dash: '7 4' }));
    o.push(R(G.x0, yB, G.x1 - G.x0, GF.bandH, { stroke: '#7D8581', sw: 0.8 }));
    // (no 709, só até a régua do km da MP, que fica na linha de cima)
    lim.forEach(function (k) { o.push(L(X(k), y0 + GF.ySeg, X(k), y0 + (so ? GF.yRule + 22 : 218), { stroke: '#7D8581', sw: 0.7, dash: '3 2' })); });
    [i ? null : c.kmIni, ultima ? c.kmFim : null].forEach(function (k) {
      if (k == null) return;
      var xx = clamp(X(k), G.x0 + 1, G.x1 - 1);
      o.push(L(xx, yB - 4, xx, yB + GF.bandH + 4, { stroke: '#B42318', sw: 2.4 }));
    });

    // régua do km Atualizado e régua do km do contrato, com os traços pela régua de conversão (nunca por um deslocamento fixo:
    // no antigo 1530 os do contrato ficam mais espaçados) e, nas pontas, o km do contrato como nas bandeiras ("750,90*"). Sem o
    // km do contrato nas duas pontas da faixa, a régua não sai e o motivo fica no lugar dela, na mesma altura (nada sobe)
    var par = passoRegua(ppk), conv = reguaDe(c) || {}, ra = kmDoContrato(c, kA), rb = kmDoContrato(c, kB);
    // 709: a régua do km das MPs no lugar da do km do site (que não sai); sem a régua de conversão, o motivo no lugar dela
    if (!so) reguaFaixa(o, 'site', y0 + GF.yRule, '#17201C', tracosRegua(kA, kB, par).map(function (t) { return { x: X(t.k), k: t.k, maior: t.maior }; }), fmtKm(kA), fmtKm(kB));
    var yC = so ? GF.yRule : GF.yRuleC;
    if (c.kmLocal) {
      // 731: a 2ª régua é a das estacas (20 m), nos mesmos traços da régua do km local
      var ee = c.estaca || 0.02;
      reguaFaixa(o, 'contrato', y0 + GF.yRuleC, '#6B4E16', tracosRegua(kA, kB, par).map(function (t) { return { x: X(t.k), k: Math.round(t.k / ee), maior: t.maior }; }),
        'E ' + Math.round(kA / ee), 'E ' + Math.round(kB / ee));
    } else if (ra && rb) {
      var tc = typeof conv.paraSite !== 'function' ? [] : tracosRegua(ra.geom, rb.geom, par).map(function (t) {
        var s = conv.paraSite(t.k);
        return s != null && s > kA && s < kB ? { x: X(s), k: t.k, maior: t.maior } : null;
      }).filter(Boolean);
      reguaFaixa(o, 'contrato', y0 + yC, '#6B4E16', tc, fmtKm(ra.km) + (ra.ast ? '*' : ''), fmtKm(rb.km) + (rb.ast ? '*' : ''));
    } else o.push(T(G.x0 + 4, y0 + yC + 4, REGUA_SEM[st] || REGUA_SEM.foraDominio, { size: 6.4, fill: gray }));

    // bandeiras: as pontas do contrato (pretas; a inicial só na 1ª faixa, a final só na última) e as localidades (marcos) da faixa,
    // com o km duplo. O marco na ponta já é a bandeira dela; o de fora do contrato não sai; o do km que divide as faixas sai uma
    // vez só, no começo da faixa de baixo. A linha e a posição de cada caixa vêm de linhasBandeiras
    var fl = [];
    if (!i) fl.push(bandeiraFaixa(c, pontas.ini, c.kmIni, X, '#17201C'));
    (c.marcos || []).forEach(function (m) {
      if (!m || typeof m.km !== 'number' || !isFinite(m.km) || m.km < c.kmIni - 0.001 || m.km > c.kmFim + 0.001) return;
      if (Math.abs(m.km - c.kmIni) < 0.001 || Math.abs(m.km - c.kmFim) < 0.001 || m.km < kA || (ultima ? m.km > kB : m.km >= kB)) return;
      fl.push(bandeiraFaixa(c, txtLimpo(m.nome).toUpperCase() || 'MARCO', m.km, X, '#5E8C2E'));
    });
    if (ultima) fl.push(bandeiraFaixa(c, pontas.fim, c.kmFim, X, '#17201C'));
    var lb = linhasBandeiras(fl, G.x0, G.x1);
    if (lb.reserva.length) console.warn('Folha da conservação, faixa ' + (i + 1) + ': sem lugar livre para ' + lb.reserva.map(function (j) { return fl[j].nome; }).join(', ') + ' (a bandeira fica sobreposta)');
    fl.forEach(function (f, j) {
      var yt = y0 + GF.flagY + lb.pos[j].r * GF.flagStep;
      o.push(L(f.x, yt + GF.flagH, f.x, yB - 8, { stroke: '#2B5797', sw: 1.8 }));
      o.push(P([[f.x - 4.5, yB - 9], [f.x + 4.5, yB - 9], [f.x, yB - 1]], '#2B5797'));
    });
    fl.forEach(function (f, j) {
      var yt = y0 + GF.flagY + lb.pos[j].r * GF.flagStep, bx = lb.pos[j].bx;
      o.push(R(bx, yt, f.w, GF.flagH, { fill: f.cor, rx: 2 }));
      o.push(T(bx + f.w / 2, yt + 10, f.nome, { size: r2(f.ns), bold: true, fill: '#FFFFFF', anchor: 'middle' }));
      o.push(T(bx + f.w / 2, yt + 20, f.sub, { size: 6.4, bold: true, fill: '#FFFFFF', anchor: 'middle' }));
    });
    o.push('</g>');
  }
  // bandeira da folha em escala, medida (a linha e a posição da caixa vêm de linhasBandeiras): o nome em maiúsculas, numa caixa de
  // até 220 pt (a letra diminui até 6 pt e, depois, o nome é cortado) e, embaixo, o km duplo, "KM 776,80 · CONTR. 783,90" (o
  // "CONTR." só quando a régua dá o km do contrato; nas pontas, o do cadastro, com "*" quando a régua discorda: "CONTR. 750,90*")
  function bandeiraFaixa(c, nome, km, X, cor) {
    var r = kmDoContrato(c, km), sub = kmSoContrato(c) ? 'KM ' + kmContrTxt(c, km) : 'KM ' + fmtKm(km) + (r ? ' · CONTR. ' + fmtKm(r.km) + (r.ast ? '*' : '') : '');
    nome = txtPdf(nome).replace(/\b(para|aprox\.)/g, function (s) { return s.toUpperCase(); });   // o nome já vem em maiúsculas
    var ns = fitSize(nome, 206, 7.2, true, 6);
    nome = fitText(nome, 206, ns, true);
    return { x: clamp(X(km), G.x0 + 1, G.x1 - 1), nome: nome, ns: ns, sub: sub, cor: cor, w: Math.min(220, Math.max(textW(nome, ns, true), textW(sub, 6.4, true)) + 14) };
  }
  // uma régua da folha em escala, num <g data-regua="site"> ou "contrato": a linha, os traços (o maior com o número, menos perto das
  // pontas, onde ficam os km da ponta, la e lb, em negrito). tracos: [{ x, k, maior }]
  function reguaFaixa(o, nome, y, cor, tracos, la, lb) {
    var ma = textW(la, 6.4, true) + 10, mb = textW(lb, 6.4, true) + 10;
    o.push('<g data-regua="' + nome + '">');
    o.push(L(G.x0, y, G.x1, y, { stroke: cor, sw: 0.7 }));
    tracos.forEach(function (t) {
      o.push(L(t.x, y, t.x, y + (t.maior ? 6 : 3), { stroke: cor, sw: 0.6 }));
      if (t.maior && t.x - G.x0 > ma && G.x1 - t.x > mb) o.push(T(t.x, y + 14, fmtN(t.k), { size: 6.2, fill: cor, anchor: 'middle' }));
    });
    o.push(T(G.x0 + 1, y + 14, la, { size: 6.4, bold: true, fill: cor }));
    o.push(T(G.x1 - 1, y + 14, lb, { size: 6.4, bold: true, fill: cor, anchor: 'end' }));
    o.push('</g>');
  }
  // Observações gerais (obsFolha), na linha dos quadros, à direita (de x 712 até x1): 6,6 pt, de 8,6 em 8,6 pt; o que não couber
  // faz a letra diminuir até 5,4 pt (a entrelinha junto) e, depois, a última linha termina em "..."
  function obsFaixa(o, c, yq, hq) {
    var xo = 712, wo = G.x1 - xo, t = txtPdf(c.obsFolha), s = 6.6, lh, max, ls;
    function cabe(z) { lh = 8.6 * z / 6.6; max = Math.floor((hq - 30) / lh) + 1; ls = wrap(t, wo - 12, z); return ls.length <= max; }
    while (!cabe(s) && s > 5.4) s = Math.max(5.4, r2(s - 0.1));
    if (ls.length > max) { ls = ls.slice(0, max); ls[max - 1] = fitText(ls[max - 1] + '...', wo - 12, s); }
    o.push(R(xo, yq, wo, hq, { fill: '#FFFFFF', stroke: '#7D8581', sw: 0.6 }));
    o.push(T(xo + 6, yq + 12, 'Observações gerais', { size: 7, bold: true }));
    ls.forEach(function (ln, i) { o.push(T(xo + 6, yq + 25 + i * lh, ln, { size: r2(s), fill: '#2B3430' })); });
  }
  // itens dos quadros de prazos e valores (PI) da folha em escala, com os textos já montados (sem medir): { conf, prev }, cada lista
  // com os prazos e depois os valores, na ordem do formulário. sit 'conf' vai para CONFIRMADOS; qualquer outra coisa ('prev' ou sem
  // sit, dado digitado à mão no banco), para PREVISTOS, A CONFIRMAR: um item sem sit nunca sai como confirmado. O item sem nada que
  // a folha mostre (o "+ Prazo" recém-tocado) não sai. A fonte fica só no formulário (E-4). Cada item: { g ('prazos' ou 'valores'),
  // rot, dir (a data ou o valor, à direita), vazio (dir é "sem data" ou "sem valor"), det (no prazo, de que é o fim e a nota; no
  // valor, "ref. <data>" e a nota) }
  var FIM_TXT = { exec: 'fim da execução', vig: 'fim da vigência', ambos: 'fim da execução e da vigência' };
  function itensQuadros(c) {
    var out = { conf: [], prev: [] };
    ['prazos', 'valores'].forEach(function (g) {
      var pz = g === 'prazos';
      (Array.isArray(c[g]) ? c[g] : []).forEach(function (x) {
        if (!x) return;
        var rot = txtPdf(txtLimpo(x.rotulo)), nota = txtPdf(txtLimpo(x.nota)), data = txtLimpo(x.data), temV = typeof x.valor === 'number' && isFinite(x.valor);
        var fim = pz && FIM_TXT[x.fim] || '';
        if (!rot && !data && !nota && (pz ? !fim : !temV)) return;
        var det = (pz ? [fim, nota] : [data ? 'ref. ' + txtPdf(fmtDate(data)) : '', nota]).filter(Boolean).join('. ');
        var dir = pz ? (data ? txtPdf(fmtDate(data)) : 'sem data') : temV ? fmtPI(x.valor) : 'sem valor';
        out[x.sit === 'conf' ? 'conf' : 'prev'].push({ g: g, rot: rot, dir: dir, vazio: pz ? !data : !temV, det: det });
      });
    });
    return out;
  }
  // caixas dos quadros, na linha de baixo da folha em escala (como a maquete): CONFIRMADOS em x 142 e PREVISTOS, A CONFIRMAR em
  // x 426, com 276 pt de largura cada; a altura é a do lugar (172 pt na folha em escala, até o rodapé na folha de continuação)
  var QX = { conf: G.x0, prev: G.x0 + 284 }, QW = 276;
  // um item dos quadros, medido: o rótulo em até 2 linhas ao lado da data ou do valor (a 2ª linha cortada com "...") e o detalhe
  // em até 3 linhas (confirmados) ou 4 (previstos), a última cortada; h: a altura dele (9 pt por linha do rótulo, 8 por linha do
  // detalhe e 3 depois do item)
  function medeItem(it, conf) {
    var wl = QW - 12 - textW(it.dir, 6.6, !it.vazio) - 8, wd = QW - 18, max = conf ? 3 : 4, rl = wrap(it.rot, wl, 6.6, true), dl = wrap(it.det, wd, 6.2);
    if (rl.length > 2) rl = [rl[0], fitText(rl.slice(1).join(' '), wl, 6.6, true)];
    if (!rl.length) rl = [''];
    if (dl.length > max) dl = dl.slice(0, max - 1).concat(fitText(dl.slice(max - 1).join(' '), wd, 6.2));
    return { it: it, rl: rl, dl: dl, h: 9 * rl.length + 8 * dl.length + 3 };
  }
  // altura dos itens medidos numa caixa, com o subtítulo (PRAZOS, VALORES (PI)) de cada grupo que tem item ali: 9 pt, e 2 pt entre
  // os dois grupos
  function alturaItens(ms) {
    var h = 0, g = null;
    ms.forEach(function (m) { if (m.it.g !== g) { h += (g ? 2 : 0) + 9; g = m.it.g; } h += m.h; });
    return h;
  }
  // quantos itens de ms, a partir de ini, cabem inteiros numa caixa de altura hq, com o 1º item topo pt abaixo do alto da caixa e
  // 4 pt de margem embaixo; quando não cabem todos, fica lugar (9 pt) para a linha "Continua na folha seguinte (mais N itens)"
  function cabemItens(ms, ini, topo, hq) {
    var livre = hq - topo - 4, k = 0;
    if (alturaItens(ms.slice(ini)) <= livre) return ms.length - ini;
    while (ini + k < ms.length && alturaItens(ms.slice(ini, ini + k + 1)) + 9 <= livre) k++;
    return k;
  }
  // os quadros de prazos e valores, medidos e repartidos pelas folhas (E-3). A letra é sempre a normal: o que não couber inteiro na
  // caixa da folha em escala fica de fora, com "Continua na folha seguinte (mais N itens)" na última linha da caixa, e a folha
  // seguinte (quadrosCont) traz as duas caixas com a lista completa (se nem ela couber, mais uma folha, do mesmo jeito). { conf,
  // prev: os itens medidos; n1: { conf, prev }, quantos saem na folha em escala; cont: [{ conf: [de, até], prev: [de, até] }], a
  // parte de cada lista em cada folha de continuação (nenhuma quando tudo coube, o caso do 437 e do 438) }
  var Q_TOPO = { conf: 24, prev: 26 }, Q_CONT_Y = GF.yTop;
  function quadrosFaixa(c) {
    var iq = itensQuadros(c), hq = GF.yF - 10 - (GF.yTop + 2 * GF.H + GF.gap + 4), hc = GF.yF - 10 - Q_CONT_Y, ks = ['conf', 'prev'];
    var q = { conf: iq.conf.map(function (it) { return medeItem(it, true); }), prev: iq.prev.map(function (it) { return medeItem(it, false); }), n1: {}, cont: [] };
    ks.forEach(function (k) { q.n1[k] = cabemItens(q[k], 0, Q_TOPO[k], hq); });
    if (q.n1.conf === q.conf.length && q.n1.prev === q.prev.length) return q;
    var ini = { conf: 0, prev: 0 };
    while (ini.conf < q.conf.length || ini.prev < q.prev.length) {
      var pg = {};
      ks.forEach(function (k) {
        var n = ini[k] < q[k].length ? Math.max(1, cabemItens(q[k], ini[k], Q_TOPO[k], hc)) : 0;   // ao menos 1 por folha: sempre acaba
        pg[k] = [ini[k], ini[k] + n];
        ini[k] += n;
      });
      q.cont.push(pg);
    }
    return q;
  }
  // uma caixa dos quadros em bx, de yq a yq + hq: CONFIRMADOS (cheia) ou PREVISTOS, A CONFIRMAR (tracejada, com a etiqueta), com os
  // itens medidos ms[de] a ms[ate - 1] e, quando a lista continua depois deles, a linha "Continua na folha seguinte (mais N itens)"
  function quadroItens(o, conf, bx, yq, hq, ms, de, ate) {
    var cor = conf ? '#17201C' : '#3B4540', cd = conf ? '#2B3430' : '#5C6661', gray = '#5C6661', y = yq + Q_TOPO[conf ? 'conf' : 'prev'], g = null, resto = ms.length - ate;
    if (conf) {
      o.push(R(bx, yq, QW, hq, { fill: '#F4F6F5', stroke: '#7D8581', sw: 0.6 }));
      o.push(T(bx + 6, yq + 12, 'CONFIRMADOS', { size: 6.6, bold: true, fill: '#146C3B' }));
    } else {
      var tag = 'PREVISTOS, A CONFIRMAR';
      o.push(R(bx, yq, QW, hq, { fill: '#FFFFFF', stroke: '#8E9792', sw: 0.9, dash: '3 2' }));
      o.push(R(bx + 6, yq + 4, textW(tag, 6.4, true) + 10, 11, { fill: '#FFFFFF', stroke: '#5C6661', sw: 0.7, rx: 5.5, dash: '2 1.5' }));
      o.push(T(bx + 11, yq + 12, tag, { size: 6.4, bold: true, fill: '#3B4540' }));
    }
    if (!ms.length) { o.push(T(bx + 6, y, conf ? 'Nenhum item.' : 'Nada a confirmar.', { size: 6.2, fill: gray })); return; }
    if (de >= ate) { o.push(T(bx + 6, y, 'A lista deste quadro termina na folha anterior.', { size: 6.2, fill: gray })); return; }
    ms.slice(de, ate).forEach(function (m) {
      if (m.it.g !== g) {
        if (g) y += 2;
        g = m.it.g;
        o.push(T(bx + 6, y, g === 'prazos' ? 'PRAZOS' : 'VALORES (PI)', { size: 6, bold: true, fill: gray }));
        y += 9;
      }
      o.push(T(bx + QW - 6, y, m.it.dir, m.it.vazio ? { size: 6.6, fill: gray, anchor: 'end' } : { size: 6.6, bold: true, fill: cor, anchor: 'end' }));
      m.rl.forEach(function (ln) { if (ln) o.push(T(bx + 6, y, ln, { size: 6.6, bold: true, fill: cor })); y += 9; });
      m.dl.forEach(function (ln) { o.push(T(bx + 10, y, ln, { size: 6.2, fill: cd })); y += 8; });
      y += 3;
    });
    if (resto > 0) o.push(T(bx + 6, y + 6, 'Continua na folha seguinte (mais ' + resto + (resto === 1 ? ' item)' : ' itens)'), { size: 6.2, bold: true, fill: gray }));
  }
  // rodapé da folha em escala, a partir de y: a linha de cima; a legenda; as notas (notasConserva), da esquerda até antes do TOTAL
  // GERAL (x 640): cada uma quebrada em 598 pt, a 6,1 pt, de 8,2 em 8,2 pt a partir de y + 24, no máximo 6 linhas (o que não couber
  // faz a letra diminuir até 5,4 pt e, depois, a última linha termina em "..."); e o TOTAL GERAL, com a extensão e os segmentos do
  // SNV. A legenda e o total não têm ponte nem outro contrato (decisões 0.10 e 0.8)
  function rodapeFaixa(o, c, y) {
    var ns = notasConserva(c), s = 6.1, ls, gray = '#5C6661', lx = G.labelX + 40, px = 650, e = extensaoFaixa(c), n = snvDaFaixa(c).length;
    function linhas(z) { return ns.reduce(function (a, t) { return a.concat(wrap(t, 598, z)); }, []); }
    o.push(L(G.frame, y - 4, PAGE_W - G.frame, y - 4, { stroke: '#C9CECB', sw: 0.6 }));
    o.push(T(G.labelX, y + 10, 'LEGENDA', { size: 6.4, bold: true, fill: gray }));
    [[{ fill: '#5E8C2E', rx: 1.5 }, 'Localidade'], [{ fill: '#17201C', rx: 1.5 }, 'Início / fim do contrato'],
      [{ fill: '#EEF0EF', stroke: '#7D8581', sw: 0.6 }, 'Segmento do SNV'], [{ fill: pistaDe(c).cor, stroke: '#7D8581', sw: 0.6 }, pistaDe(c).leg],
      [{ fill: '#FFFFFF', stroke: '#8E9792', sw: 0.9, dash: '3 2' }, 'Previsto, a confirmar']].forEach(function (l) {
      o.push(R(lx, y + 2, 15, 10, l[0]));
      o.push(T(lx + 19, y + 10, l[1], { size: 6.6 }));
      lx += 19 + textW(l[1], 6.6) + 10;
    });
    ls = linhas(s);
    while (ls.length > 6 && s > 5.4) { s = Math.max(5.4, r2(s - 0.1)); ls = linhas(s); }
    if (ls.length > 6) { ls = ls.slice(0, 6); ls[5] = fitText(ls[5] + '...', 598, s); }
    ls.forEach(function (ln, i) { o.push(T(G.labelX, y + 24 + i * 8.2, ln, { size: r2(s), fill: gray })); });
    o.push(R(640, y, G.x1 - 640, 34, { fill: '#F4F6F5', stroke: '#C7CCC9', sw: 0.7, rx: 3 }));
    o.push(T(650, y + 13, 'TOTAL GERAL', { size: 6.6, bold: true, fill: gray }));
    [['Extensão: ', e != null ? fmt(e, 2) + ' km' : '-'], ['Segmentos do SNV: ', n ? String(n) : '-']].forEach(function (t) {
      o.push(T(px, y + 26, t[0], { size: 8, fill: '#3B4540' }));
      px += textW(t[0], 8);
      o.push(T(px, y + 26, t[1], { size: 8.2, bold: true }));
      px += textW(t[1], 8.2, true) + 22;
    });
  }
  // continuação da folha em escala (E-3), só quando os prazos e valores não couberam nos quadros dela: o cabeçalho e as duas caixas
  // com a lista completa, sem as faixas, do alto da folha (y 104) até o lugar do rodapé. pg: a parte das listas desta folha
  // (quadrosFaixa)
  function quadrosCont(c, pageIdx, pageCount, q, pg, an) {
    var o = [], x = G.labelX, gray = '#5C6661', yq = Q_CONT_Y, hq = GF.yF - 10 - yq;
    o.push('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ' + PAGE_W + ' ' + PAGE_H + '" width="' + PAGE_W + '" height="' + PAGE_H + '">');
    o.push(R(0, 0, PAGE_W, PAGE_H, { fill: '#FFFFFF' }));
    o.push(R(G.frame, G.frame, PAGE_W - 2 * G.frame, PAGE_H - 2 * G.frame, { stroke: '#17201C', sw: 1.1 }));
    drawHeader(o, c);
    if (an) drawUsoInterno(o);   // a folha "Com análise" sai inteira como uso interno
    o.push(T(x, yq + 12, 'PRAZOS E VALORES', { size: 7, bold: true }));
    o.push(T(x, yq + 22, 'do contrato', { size: 6.2, fill: gray }));
    o.push(T(x, yq + 34, 'continuação da', { size: 6.2, fill: gray }));
    o.push(T(x, yq + 42, 'folha anterior', { size: 6.2, fill: gray }));
    quadroItens(o, true, QX.conf, yq, hq, q.conf, pg.conf[0], pg.conf[1]);
    quadroItens(o, false, QX.prev, yq, hq, q.prev, pg.prev[0], pg.prev[1]);
    o.push(L(G.colLine, 106, G.colLine, GF.yF - 10, { stroke: '#C9CECB', sw: 0.6 }));
    o.push(T(G.x1, PAGE_H - G.frame - 6, 'Página ' + (pageIdx + 1) + ' de ' + pageCount + '   ·   Gerado em ' + fmtDate(todayIso()), { size: 6.4, fill: gray, anchor: 'end' }));
    o.push('</svg>');
    return o.join('');
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
  var FMT_N = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
  function fmtN(n) { return n == null || !isFinite(n) ? '' : FMT_N.format(Number(n)); }
  function fmtBRL(n) { return n == null || !isFinite(n) ? '-' : 'R$ ' + fmt(Math.round(n), 0); }
  function fmtBRLc(n) {
    if (n == null || !isFinite(n)) return '-';
    if (Math.abs(n) >= 1e6) return 'R$ ' + fmt(n / 1e6, 2) + ' mi';
    if (Math.abs(n) >= 1e4) return 'R$ ' + fmt(n / 1e3, 0) + ' mil';
    return fmtBRL(n);
  }
  // com a análise, a linha do estado da ponte sai e cada grupo mostra a última restauração (células mais altas, duas linhas)
  // n = número de grupos (sem n, os das pontes: renderSheet só chama esta função no 424)
  function oaeGeom(an, n) {
    var g = { yKm: 151, yBand: 157, bandH: 56, yExt: 219, extH: 18, yNec: 243, necH: 26, yServ: 281, servH: 19, servStep: 23 };
    if (an) { g.yNec = null; g.yServ = 257; g.servH = 22; g.servStep = 26; }
    var after = g.yServ + (n || TIPOS.oae.servicos.length) * g.servStep;
    if (an) { g.yConc = after + 4; g.concH = 21; g.yMed = g.yConc + g.concH + 4; g.medH = 30; g.yAl = g.yMed + g.medH + 6; g.alH = 16; g.yObs = g.yAl + g.alH + 8; }
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
    if (an) o.push(T(x, g.yServ - 5, 'ÚLTIMA RESTAURAÇÃO', { size: 6.6, bold: true, fill: '#146C3B' }));
    else {
      o.push(T(x, g.yNec + 12, 'ESTADO', { size: 7, bold: true }));
      o.push(T(x, g.yNec + 21.5, 'e última vistoria', { size: 6.4, fill: gray }));
      o.push(T(x, g.yServ - 4, 'ESTADO NA VISTORIA', { size: 6, bold: true, fill: gray }));
    }
    servicesOf(c).forEach(function (s, i) {
      var y = g.yServ + i * g.servStep + g.servH / 2 + 3.3, uw = s.un ? textW(s.un, 6.4) + 4 : 0;
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

    // estado da ponte (resumo dos grupos) e a última vistoria: quando e quem marcou (só na folha da vistoria)
    if (g.yNec != null) {
      var nn = oaeNec(p, c), vis = c ? vistoriaPonte(c, p) : null;
      var nf = nn.dn ? '#FBE3BC' : nn.exec ? '#D5E0F0' : (nn.aval && !nn.nv) ? '#CDE8D6' : '#EEF0EF';
      var ntx = oaeNecTxt(nn, c), nsz = fitSize(ntx, bw - 4, 7.6, true, 4.6);
      o.push(R(bx, g.yNec, bw, g.necH, { fill: nf, stroke: '#7D8581', sw: 0.6 }));
      o.push(T(cx, g.yNec + (vis ? 11 : 16.4), fitText(ntx, bw - 4, nsz, true), { size: r2(nsz), bold: true, fill: '#17201C', anchor: 'middle' }));
      if (vis) {
        var vt = 'vistoria ' + fmtWhen(vis.em).slice(0, 5) + (vis.por ? ' · ' + vis.por : '');
        o.push(T(cx, g.yNec + 21, fitText(vt, bw - 4, 6, false), { size: 6, fill: '#3B4540', anchor: 'middle' }));
      }
    }

    // grupos: cor = estado marcado na vistoria; "~" = estimativa do dano; contorno roxo = alerta alto nas medições.
    // Com a análise, a célula mostra a última restauração e, por cima, o que a vistoria viu depois (celRest)
    servicesOf(c || ownerOf(p)).forEach(function (s, i) {
      var sv = p.serv[s.key], k = oaeSt(sv), st = oaeStOf(s, k), y = g.yServ + i * g.servStep;
      var gi = a && a.grupos ? a.grupos[s.key] : null;
      if (an) celRest(o, an, a, p, s, sv, k, bx, y, bw, g.servH);
      else celEstado(o, s, sv, k, st, bx, y, bw, g.servH);
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
      // o nº de cada medição, pequeno, dentro do quadradinho (some se a coluna for estreita demais)
      var nfs = r2(Math.min(ch * 0.62, (cw - 1.2) / 1.15, 5.6));
      ms.forEach(function (m, k) {
        var on = a && a.meses && a.meses[String(m.n)], col = k % cols, row = Math.floor(k / cols);
        var qx = bx + 1 + col * cw + 0.45, qy = g.yMed + 1 + row * ch + 0.45;
        o.push(R(qx, qy, cw - 0.9, ch - 0.9, { fill: on ? (mx[m.n] ? ALERTA_COR : '#2B5797') : '#EEF0EF' }));
        if (nfs >= 3) o.push(T(qx + (cw - 0.9) / 2, qy + (ch - 0.9) / 2 + nfs * 0.36, String(m.n), { size: nfs, bold: !!on, fill: on ? '#FFFFFF' : '#8E9792', anchor: 'middle' }));
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
    // os itens marcados na vistoria saem no alto, um grupo por linha (com o "outro item ou local" do grupo)
    var itl = [];
    servicesOf(c || ownerOf(p)).forEach(function (s) {
      var sv = p.serv[s.key] || {}, k = oaeSt(sv), its = comQtd(k) ? itensDe(s.key, sv).map(function (x) { return minus1(x.n); }) : [];
      if (!its.length && !(comQtd(k) && sv.n)) return;
      var tx = s.short + (k === 'EX' ? ' (em execução)' : '') + ': ' + its.join(', ') + (sv.n ? (its.length ? ' · ' : '') + sv.n : '');
      wrap('• ' + tx, bw - 10, fs).forEach(function (x, j) { itl.push({ t: j ? '  ' + x : x, cor: '#5C3D00' }); });
    });
    var lines = (itl.length ? [{ t: fitText('Itens observados:', bw - 10, fs, true), b: true, cor: '#7A5200' }].concat(itl, p.obs ? [{ t: '' }] : []) : [])
      .concat(wrap(p.obs || '', bw - 10, fs).map(function (t) { return { t: t }; }));
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

  // célula do estado de um grupo na vistoria (folha sem a análise): s = o grupo, sv = o que está gravado, k = o código do
  // estado, st = o estado com os nomes da linha (oaeStOf, ou TRAF_STATUS na trafegabilidade). Sem vistoria e N/A: caixa
  // tracejada; os outros: caixa cheia com o rótulo e a estimativa, em uma ou duas linhas, e as marcas no canto
  function celEstado(o, s, sv, k, st, bx, y, bw, h) {
    var cx = bx + bw / 2;
    if (st.fill === 'none') {
      o.push(R(bx, y, bw, h, { fill: k === 'NV' ? '#F3F4F3' : '#FFFFFF', stroke: '#B9C0BC', sw: 0.6, dash: '2 2', rx: 2 }));
      var vz = fitSize(st.tag, bw - 6, 6.8, true, 4.4);
      o.push(T(cx, y + 12.6, fitText(st.tag, bw - 6, vz, true), { size: r2(vz), bold: true, fill: '#7A817D', anchor: 'middle' }));
      return;
    }
    var qt = comQtd(k) ? fmtQtd(s, sv.q) : '', label = st.tag + (qt ? ' · ' + qt : '');
    o.push(R(bx, y, bw, h, { fill: st.fill, rx: 2 }));
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

  function marcaPri(o, x, y) {
    o.push('<circle cx="' + r2(x) + '" cy="' + r2(y) + '" r="4.6" fill="#B42318" stroke="#FFFFFF" stroke-width="0.8"/>');
    o.push(T(x, y + 2.3, '!', { size: 6.6, bold: true, fill: '#FFFFFF', anchor: 'middle' }));
  }
  function marcaCi(o, x, y) {
    o.push('<circle cx="' + r2(x) + '" cy="' + r2(y) + '" r="4.6" fill="#FFFFFF" stroke="#1E9E55" stroke-width="1"/>');
    o.push('<path d="M' + r2(x - 2.3) + ' ' + r2(y + 0.1) + ' L' + r2(x - 0.6) + ' ' + r2(y + 1.9) + ' L' + r2(x + 2.4) + ' ' + r2(y - 1.8) + '" fill="none" stroke="#1E9E55" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>');
  }
  // ✕ = medido sem execução (marca interna, só na folha com a análise)
  function marcaMne(o, x, y) {
    o.push('<circle cx="' + r2(x) + '" cy="' + r2(y) + '" r="4.6" fill="' + MNE_COR + '" stroke="#FFFFFF" stroke-width="0.8"/>');
    o.push('<path d="M' + r2(x - 1.9) + ' ' + r2(y - 1.9) + ' L' + r2(x + 1.9) + ' ' + r2(y + 1.9) + ' M' + r2(x + 1.9) + ' ' + r2(y - 1.9) + ' L' + r2(x - 1.9) + ' ' + r2(y + 1.9) + '" fill="none" stroke="#FFFFFF" stroke-width="1.3" stroke-linecap="round"/>');
  }
  // folha com a análise: a célula do grupo mostra a última restauração (mês · nº da última medição com serviço do
  // grupo na ponte). Se a vistoria marcou dano observado ou em execução, a cor passa a ser a do estado e a
  // quantidade estimada vai embaixo da data. Marcas no canto: prioridade, conclusão informada e medido sem execução
  function celRest(o, an, a, p, s, sv, k, bx, y, bw, h) {
    var gi = a && a.grupos ? a.grupos[s.key] : null, ult = gi && gi.ult ? Number(gi.ult) : 0, cx = bx + bw / 2, cons = an.tipo === 'conserva';
    var mm = ult ? mesMed(an, ult) : '', data = ult ? (mm ? mm + ' · ' : '') + ult + 'ª' : '';
    var l1 = '', l2 = '', fill = null, ink = '#FFFFFF';
    if (comQtd(k)) {
      var stk = oaeStOf(s, k), qt = fmtQtd(s, sv.q);
      fill = stk.fill; ink = stk.ink;
      l1 = data || (cons ? 'sem medição' : 'sem restauração');
      // em coluna estreita, só a estimativa (o azul já diz em execução), para o número não sair cortado
      if (k === 'EX') { l2 = 'em execução' + (qt ? ' · ' + qt : ''); if (qt && textW(l2, 4, true) > bw - 6) l2 = qt; }
      else l2 = qt ? qt + (s.un === '%' ? ' com dano' : cons ? ' com defeito' : ' danificados') : stk.name.toLowerCase();
    } else if (ult) { fill = '#1E9E55'; l1 = data; }
    if (fill) {
      o.push(R(bx, y, bw, h, { fill: fill, rx: 2 }));
      if (l2) {
        // o tamanho é medido com 0,3 pt de folga (o arredondamento não corta texto que cabe); as linhas ficam abaixo das marcas do canto
        var s1 = fitSize(l1, bw - 6.3, 7.6, true, 4.2), s2 = fitSize(l2, bw - 6.3, 6.2, true, 4);
        o.push(T(cx, y + h / 2 + 0.6, fitText(l1, bw - 6, s1, true), { size: r2(s1), bold: true, fill: ink, anchor: 'middle' }));
        o.push(T(cx, y + h / 2 + 8.8, fitText(l2, bw - 6, s2, true), { size: r2(s2), bold: true, fill: ink, anchor: 'middle' }));
      } else {
        var s0 = fitSize(l1, bw - 6.3, 8.2, true, 4.2);
        o.push(T(cx, y + h / 2 + s0 * 0.36, fitText(l1, bw - 6, s0, true), { size: r2(s0), bold: true, fill: ink, anchor: 'middle' }));
      }
    } else {
      var tg = k === 'NA' ? 'NÃO TEM (N/A)' : cons ? 'SEM MEDIÇÃO' : 'SEM RESTAURAÇÃO', vz = fitSize(tg, bw - 6.3, 6.6, true, 4.2);
      o.push(R(bx, y, bw, h, { fill: '#FFFFFF', stroke: '#B9C0BC', sw: 0.6, dash: '2 2', rx: 2 }));
      o.push(T(cx, y + h / 2 + vz * 0.36, fitText(tg, bw - 6, vz, true), { size: r2(vz), bold: true, fill: '#7A817D', anchor: 'middle' }));
    }
    var mk = 0;
    if (comQtd(k) && sv.pri) marcaPri(o, bx + 3.5 + 10 * mk++, y + 0.5);
    if (comQtd(k) && sv.ci) marcaCi(o, bx + 3.5 + 10 * mk++, y + 0.5);
    // ✕ de uma medição que não é a da data mostrada (análise carregada depois com medições novas): o nº vai ao lado
    var mkM = mneOf(an, p.id, s.key);
    if (mkM) {
      var xm = bx + 3.5 + 10 * mk++;
      marcaMne(o, xm, y + 0.5);
      // o nº vai numa pílula branca (legível sobre qualquer cor); fica de fora se encostar no número do alerta
      if (Number(mkM.med) !== ult) {
        var tm = mkM.med + 'ª', pw = textW(tm, 5, true) + 2.4, lim = bx + bw - 1;
        if (gi && gi.altos) lim = bx + bw - Math.max(10, textW(String(gi.altos), 6, true) + 6) + 1;
        if (xm + 4.4 + pw <= lim) {
          o.push(R(xm + 4.4, y - 2.6, pw, 6.4, { fill: '#FFFFFF', stroke: MNE_COR, sw: 0.5, rx: 3.2 }));
          o.push(T(xm + 4.4 + pw / 2, y + 2.2, tm, { size: 5, bold: true, fill: MNE_COR, anchor: 'middle' }));
        }
      }
    }
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
    // com a análise: a célula é a última restauração; laranja/azul = o que a vistoria marcou
    (an ? [['REST', 'Restaurado (mês · nº)'], ['DN', 'Dano observado'], ['EX', 'Em execução'], ['SR', 'Sem restauração']]
      : [['OK', 'Sem dano aparente'], ['DN', 'Dano observado'], ['EX', 'Em execução'], ['NA', 'Não tem (N/A)'], ['NV', 'Sem vistoria']]).forEach(function (it) {
      var st = it[0] === 'REST' ? { fill: '#1E9E55' } : it[0] === 'SR' ? { fill: 'none' } : OAE_STATUS[it[0]];
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
      item(function (xx, yy) { marcaMne(o, xx + 7.5, yy + 5); }, 'Medido sem execução', y + 16);
      yn = y + 38;
    }
    var notas = [
      an ? 'Cada grupo mostra a última medição com o serviço na ponte (mês · nº). Se a vistoria marcou dano ou execução, a cor é a do estado e a estimativa (~) vai embaixo.'
        : 'Serviço contínuo: estado de cada grupo na última vistoria. ~ = estimativa do dano feita pela supervisão. Conclusão informada = a contratada diz que concluiu; a supervisão ainda confere.',
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

  // ------------------------------------------------------------------ folha de colunas da conservação (página 1, passo 2.3)
  // O modelo de sempre, no desenho das pontes do 424: uma coluna por segmento, em ordem de km, com o km Atualizado e, em cima, o do
  // contrato; o bloco do segmento (código do SNV, nome e descrição), a extensão, o estado (resumo dos 7 grupos) com a última
  // vistoria, a trafegabilidade numa linha própria, os 7 grupos e as observações; no alto, as localidades. Bloco próprio: para
  // tirar a folha, apagar este bloco e o nome 'colunas' de FOLHAS_CONSERVA. Todo texto digitado passa por txtPdf (a fonte do PDF).
  // Sem hachura, recorte, transparência nem itálico, que o PDF não passa a limpo; o tracejado passa.

  // as páginas de colunas, cada uma uma função (i, n) para folhasConserva: paginate reparte os segmentos pelo "segmentos por
  // página" do contrato (13 no padrão: o 437 e o 438 cabem numa folha) e o total sai na última página de colunas. soColunas: a
  // folha em escala não sai, e a página leva a faixa das Observações gerais do contrato quando o obsFolha tem texto (4.10, F-9 c)
  function paginasColunas(c, soColunas, an) {
    var pg = paginate(c), r = resumoSegs(c), faixa = !!(soColunas && txtLimpo(c.obsFolha)), nPag = pg.chunks.length;
    return pg.chunks.map(function (ch, j) {
      return function (i, n) { return renderColunas(c, pg, j, { pag: i + 1, total: n, ultima: j === nPag - 1 }, r, faixa, an); };
    });
  }
  // uma página de colunas: a j-ésima de paginate (pg); num = { pag, total, ultima } ("Página pag de total"; ultima: a última
  // página de colunas, com o total); r = resumoSegs(c); faixa: com as Observações gerais do contrato embaixo das colunas
  function renderColunas(c, pg, j, num, r, faixa, an) {
    var o = [], ch = pg.chunks[j], g = colunasGeom(faixa, servicesOf(c).length), gm = geom(pg.slots);
    o.push('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ' + PAGE_W + ' ' + PAGE_H + '" width="' + PAGE_W + '" height="' + PAGE_H + '">');
    o.push(R(0, 0, PAGE_W, PAGE_H, { fill: '#FFFFFF' }));
    o.push(R(G.frame, G.frame, PAGE_W - 2 * G.frame, PAGE_H - 2 * G.frame, { stroke: '#17201C', sw: 1.1 }));
    if (an) drawUsoInterno(o);
    drawHeader(o, c, null, null, colunasKpis(c, r));
    drawLabelsSeg(o, c, g);
    // sem segmento (só quando as colunas são a única folha): o aviso no lugar das colunas, nunca uma página em branco
    if (!ch.length) o.push(T((G.x0 + G.x1) / 2, 300, 'Nenhum segmento neste contrato. Os segmentos saem dos limites dos trechos (dados do contrato).', { size: 8, fill: '#5C6661', anchor: 'middle' }));
    else {
      // eixo da rodovia passando pelos segmentos (antes dos blocos, que ficam por cima)
      o.push(L(G.x0, g.yBand + g.bandH / 2, G.x0 + gm.slot * ch.length, g.yBand + g.bandH / 2, { stroke: '#9AA29E', sw: 0.8, dash: '7 4' }));
      ch.forEach(function (p, i) { drawSegmento(o, c, p, gm.bx(i), gm.bw, g, an); });
    }
    bandeirasCol(o, c, pg, j, g);
    if (faixa) drawObsContrato(o, c, g);
    drawFooterSeg(o, c, r, num, an);
    o.push('</svg>');
    return o.join('');
  }
  // alturas da folha de colunas (pt; da maquete): as das pontes até o estado, a trafegabilidade em 275 e os grupos a partir de
  // 305 (nGrupos: 7 no revestimento primário, de 23 em 23 pt; mais de 8, na pista pavimentada, de 21 em 21); as observações
  // até 748, ou até 700 com a faixa das Observações gerais do contrato (faixa)
  function colunasGeom(faixa, nGrupos) {
    var n = nGrupos || CONS_SERVICES.length;
    var g = { yKm: 151, yBand: 157, bandH: 56, yExt: 219, extH: 18, yNec: 243, necH: 26, yTraf: 275, servH: 19, yServ: 305, servStep: n > 8 ? 21 : 23 };
    g.yObs = g.yServ + n * g.servStep + 6;
    g.obsEnd = G.yFoot - (faixa ? 60 : 12);
    return g;
  }
  // contagens do contrato para a folha: as de oaeResumo (segmentos com defeito, em execução, sem vistoria, com prioridade e os
  // grupos, para o total) e mais o número de segmentos (n), os interrompidos (interr; a trafegabilidade fica à parte do estado,
  // plano 4.2) e a extensão somada dos segmentos (ext; null quando nenhum tem os dois km)
  function resumoSegs(c) {
    var r = oaeResumo(c), ext = null;
    r.n = c.pontos.length;
    r.interr = c.pontos.filter(function (p) { return trafSt(p.serv && p.serv.trafeg) === 'I'; }).length;
    c.pontos.forEach(function (p) { var l = pointLen(p); if (l != null) ext = (ext || 0) + l; });
    r.ext = ext;
    return r;
  }
  // os 4 indicadores (F-6 a): SEGMENTOS (com os sem vistoria embaixo), COM DEFEITO (embaixo, o primeiro que valer: interrompidos,
  // F-7 a; com prioridade; em execução), EXECUÇÃO / VIGÊNCIA (a caixa da folha em escala) e ÚLTIMA VISTORIA
  function colunasKpis(c, r) {
    var ev = execVig(c);
    return [
      { k: 'SEGMENTOS', v: String(r.n), s: !r.n ? '' : r.nv ? r.nv + ' sem vistoria' : 'todos vistoriados' },
      { k: 'COM DEFEITO', v: r.dn + (r.dn === 1 ? ' segmento' : ' segmentos'),
        s: r.interr ? r.interr + (r.interr === 1 ? ' interrompido' : ' interrompidos') : r.pri ? r.pri + ' com prioridade' : r.exec ? r.exec + ' em execução' : 'observado na vistoria' },
      { k: 'EXECUÇÃO / VIGÊNCIA', v: ev.v, s: ev.s, prev: ev.prev, w: 160 },
      { k: 'ÚLTIMA VISTORIA', v: fmtDate(c.dataVistoria) || '-', s: '' }
    ];
  }
  // coluna da esquerda: o sentido (o da folha em escala) e o nome de cada linha das colunas
  function drawLabelsSeg(o, c, g) {
    var x = G.labelX, w = G.colLine - G.labelX - 6, gray = '#5C6661';
    sentidoFaixa(o, c, x, w, gray);
    o.push(T(x, g.yKm + 3, fitText(c.kmLocal ? 'km local (' + c.ramal + ')' : kmSoContrato(c) ? txtPdf(txtLimpo(c.rotuloKmContrato)) : 'km Atualizado (contr. em cima)', w, 6.2), { size: 6.2, fill: gray }));
    o.push(T(x, g.yBand + 24, 'SEGMENTO', { size: 7, bold: true }));
    o.push(T(x, g.yBand + 35, 'código e segmento SNV', { size: 6.4, fill: gray }));
    o.push(T(x, g.yExt + 12.5, 'EXTENSÃO', { size: 7, bold: true }));
    o.push(T(x, g.yNec + 12, 'ESTADO', { size: 7, bold: true }));
    o.push(T(x, g.yNec + 21.5, 'e última vistoria', { size: 6.4, fill: gray }));
    o.push(T(x, g.yTraf + 12.8, 'TRAFEGABILIDADE', { size: 7.2, bold: true }));
    o.push(T(x, g.yServ - 4, 'ESTADO NA VISTORIA', { size: 6, bold: true, fill: gray }));
    servicesOf(c).forEach(function (s, i) {
      var y = g.yServ + i * g.servStep + g.servH / 2 + 3.3, uw = s.un ? textW(s.un, 6.4) + 4 : 0;
      // para baixo, em décimos: arredondar para cima devolveria o "..." (7,2 quando cabe: a folha do 437/438 não muda)
      var fz = Math.floor(fitSize(s.short, w - uw, 7.2, true, 6.2) * 10) / 10;
      o.push(T(x, y, fitText(s.short, w - uw, fz, true), { size: fz, bold: true }));
      if (s.un) o.push(T(x + w, y, s.un, { size: 6.4, fill: gray, anchor: 'end' }));
    });
    o.push(T(x, g.yObs + 12, 'OBSERVAÇÕES', { size: 7, bold: true }));
    o.push(L(G.colLine, 106, G.colLine, g.obsEnd, { stroke: '#C9CECB', sw: 0.6 }));
  }
  // uma coluna (o segmento p), no molde de drawPonte
  // an (folha "Com análise"): cada grupo mostra a última medição com serviço no segmento (celRest), como as pontes do 424
  function drawSegmento(o, c, p, bx, bw, g, an) {
    var cx = bx + bw / 2, sv = p.serv || {}, a = an && an.pontes ? an.pontes[p.id] || null : null;
    function km(v) { return typeof v === 'number' && isFinite(v) ? fmtKm(v) : '-'; }
    o.push('<g data-pid="' + esc(p.id) + '">');
    // km Atualizado e, em cima, pequeno, o do contrato pela régua (sem a régua, a linha não sai: a nota do rodapé explica)
    // 709 (kmSoContrato): só o km das MPs (o do contrato pela régua), no lugar do km Atualizado
    var kmt = km(p.kmIni) + ' – ' + km(p.kmFim), kc = segContrTxt(c, p);
    if (kmSoContrato(c)) { kmt = kc ? kc.replace(/^contr\. /, '') : '-'; kc = ''; }
    o.push(T(cx, g.yKm, kmt, { size: r2(fitSize(kmt, bw - 4, 7.6, true, 5)), bold: true, anchor: 'middle' }));
    if (kc) {
      var kcs = fitSize(kc, bw - 4, 5.8, false, 4.4);
      o.push(T(cx, g.yKm - 9, fitText(kc, bw - 4, kcs), { size: r2(kcs), fill: '#6B4E16', anchor: 'middle' }));
    }

    // bloco do segmento (a cor da pista da folha em escala): o código do SNV em cima, o nome grande e a descrição embaixo
    o.push(R(bx, g.yBand, bw, g.bandH, { fill: pistaDe(c).cor, stroke: '#7D8581', sw: 0.7, cls: 'blk' }));
    var snv = txtPdf(snvDoSegmento(p));
    if (snv) o.push(T(cx, g.yBand + 13, fitText(snv, bw - 6, 6.4, true), { size: 6.4, bold: true, fill: '#5C6661', anchor: 'middle' }));
    var nome = txtPdf(txtLimpo(p.nome)) || '?', ns = fitSize(nome, bw - 6, 19, true, 9), ds = txtPdf(txtLimpo(p.descricao));
    o.push(T(cx, g.yBand + 38, fitText(nome, bw - 6, ns, true), { size: r2(ns), bold: true, anchor: 'middle' }));
    if (ds) o.push(T(cx, g.yBand + 50, fitText(ds, bw - 6, 6), { size: 6, fill: '#3B4540', anchor: 'middle' }));

    // extensão
    var len = pointLen(p), et = len != null ? fmt(len, 2) + ' km' : '-';
    o.push(R(bx, g.yExt, bw, g.extH, { fill: '#FFFFFF', stroke: '#7D8581', sw: 0.6 }));
    o.push(T(cx, g.yExt + 12.4, et, { size: r2(fitSize(et, bw - 4, 8.4, true, 5)), bold: true, anchor: 'middle' }));

    // estado do segmento (resumo dos 7 grupos; a trafegabilidade não entra) e a última vistoria: quando e quem marcou (com o banco)
    var nn = oaeNec(p, c), vis = vistoriaPonte(c, p);
    var nf = nn.dn ? '#FBE3BC' : nn.exec ? '#D5E0F0' : (nn.aval && !nn.nv) ? '#CDE8D6' : '#EEF0EF';
    // coluna estreita (12 ou 13 por folha): "· 1 em execução" vira "· 1 em exec." quando não cabe a 4,6 pt (como a maquete), e a
    // letra pode descer até 4,2 pt (a das células), para o resumo não sair cortado
    var ntx = oaeNecTxt(nn, c);
    if (textW(ntx, 4.6, true) > bw - 4) ntx = ntx.replace(/ em execução$/, ' em exec.');
    var nsz = fitSize(ntx, bw - 4, 7.6, true, 4.2);
    o.push(R(bx, g.yNec, bw, g.necH, { fill: nf, stroke: '#7D8581', sw: 0.6 }));
    o.push(T(cx, g.yNec + (vis ? 11 : 16.4), fitText(ntx, bw - 4, nsz, true), { size: r2(nsz), bold: true, fill: '#17201C', anchor: 'middle' }));
    if (vis) {
      var vt = txtPdf('vistoria ' + fmtWhen(vis.em).slice(0, 5) + (vis.por ? ' · ' + vis.por : ''));
      o.push(T(cx, g.yNec + 21, fitText(vt, bw - 4, 6, false), { size: 6, fill: '#3B4540', anchor: 'middle' }));
    }

    // trafegabilidade (linha própria: trafegável, com restrição, interrompido) e os 7 grupos, com as células das pontes
    var kt = trafSt(sv.trafeg);
    celEstado(o, TRAFEG, sv.trafeg, kt, TRAF_STATUS[kt], bx, g.yTraf, bw, g.servH);
    servicesOf(c).forEach(function (s, i) {
      var x = sv[s.key], k = oaeSt(x);
      if (an) celRest(o, an, a, p, s, x || {}, k, bx, g.yServ + i * g.servStep, bw, g.servH);
      else celEstado(o, s, x, k, oaeStOf(s, k), bx, g.yServ + i * g.servStep, bw, g.servH);
    });

    // observações: as do engenheiro e as notas "onde/o quê" (F-4 b), com a letra que diminui com a coluna, como no 424
    var oh = g.obsEnd - g.yObs;
    o.push(R(bx, g.yObs, bw, oh, { fill: '#FFFFFF', stroke: '#7D8581', sw: 0.6 }));
    o.push(T(bx + 5, g.yObs + 12, 'Observações gerais', { size: r2(fitSize('Observações gerais', bw - 10, 7, true, 4.2)), bold: true }));
    var k = clamp((bw - 10) / 89.6, 0.62, 1), fs = r2(7 * k), lh = 8.9 * k, maxLines = Math.floor((oh - 26) / lh);
    var lines = linhasNotas(notasCol(c, p), function (t) { return wrap(t, bw - 10, fs); });
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1] = { t: fitText(lines[maxLines - 1].t + '...', bw - 10, fs) };
    }
    lines.forEach(function (ln, i) { if (ln.t) o.push(T(bx + 5, g.yObs + 25 + i * lh, ln.t, { size: fs, fill: '#2B3430' })); });
    o.push('</g>');
  }
  // os parágrafos da caixa de observações da coluna, sem quebrar em linhas (F-4 b): as observações do engenheiro (obs) e, depois
  // (notas), a nota "onde/o quê" da trafegabilidade com restrição ou interrompida e a de cada grupo com defeito ou em execução, na
  // ordem dos grupos ("Pista: atoleiro no km ~790")
  function notasCol(c, p) {
    var sv = p.serv || {}, notas = [], t = sv.trafeg, nt = txtLimpo(t && t.n), kt = trafSt(t);
    if (nt && (kt === 'R' || kt === 'I')) notas.push(TRAFEG.short + ': ' + nt);
    servicesOf(c).forEach(function (s) {
      var x = sv[s.key], n = txtLimpo(x && x.n);
      if (n && comQtd(oaeSt(x))) notas.push((s.tot || s.short) + ': ' + n);
    });
    return { obs: p.obs || '', notas: notas };
  }
  // as linhas da caixa, como drawPonte: as do obs, uma linha em branco quando há obs e notas, e as de cada nota. Montadas aqui, e
  // não num texto só com "\n\n", porque wrap descarta parágrafo vazio (a linha em branco sumiria). quebra: texto -> [linhas]
  function linhasNotas(nc, quebra) {
    var ls = quebra(txtPdf(nc.obs)).map(function (t) { return { t: t }; });
    if (ls.length && nc.notas.length) ls.push({ t: '' });
    nc.notas.forEach(function (n) { quebra(txtPdf(n)).forEach(function (t) { ls.push({ t: t }); }); });
    return ls;
  }
  // localidades (marcos) da página j: só as de dentro do contrato, sem as pontas (o limite 437/438 já é a ponta da 1ª ou da última
  // coluna), na posição de placeMarcos (a grade das colunas: um marco no limite entre dois segmentos fica na borda direita do bloco
  // da esquerda, como no 424), com o km duplo de bandeiraFaixa ("KM 776,80 · CONTR. 783,90"). Caixa verde em y 100, presa entre x0
  // e x1; a seta desce até a ponta em 138, acima do "contr." da coluna. Duas caixas que se encostariam: a de trás anda para a
  // direita (presa em x1); a seta continua no km. As setas antes das caixas, que ficam por cima
  function bandeirasCol(o, c, pg, j, g) {
    if (typeof c.kmIni !== 'number' || typeof c.kmFim !== 'number') return;
    var ms = (c.marcos || []).filter(function (m) { return m && typeof m.km === 'number' && isFinite(m.km) && m.km > c.kmIni + 0.001 && m.km < c.kmFim - 0.001; });
    var fl = placeMarcos({ marcos: ms }, pg).filter(function (m) { return m.pageIdx === j; }).map(function (m) {
      return bandeiraFaixa(c, txtLimpo(m.marco.nome).toUpperCase() || 'MARCO', m.marco.km, function () { return m.x; }, '#5E8C2E');
    }).sort(function (a, b) { return a.x - b.x; });
    var ya = g.yKm - 12, fim = -Infinity, h = 25;   // ya - 1 = 138: a ponta da seta
    fl.forEach(function (f) { f.bx = Math.min(Math.max(clamp(f.x - f.w / 2, G.x0, G.x1 - f.w), fim + 4), G.x1 - f.w); fim = f.bx + f.w; });
    fl.forEach(function (f) {
      o.push(L(f.x, G.yMarco + h, f.x, ya - 8, { stroke: '#2B5797', sw: 1.8 }));
      o.push(P([[f.x - 4.5, ya - 9], [f.x + 4.5, ya - 9], [f.x, ya - 1]], '#2B5797'));
    });
    fl.forEach(function (f) {
      o.push(R(f.bx, G.yMarco, f.w, h, { fill: f.cor, rx: 2 }));
      o.push(T(f.bx + f.w / 2, G.yMarco + 10, f.nome, { size: r2(f.ns), bold: true, fill: '#FFFFFF', anchor: 'middle' }));
      o.push(T(f.bx + f.w / 2, G.yMarco + 20, f.sub, { size: 6.4, bold: true, fill: '#FFFFFF', anchor: 'middle' }));
    });
  }
  // Observações gerais do contrato (obsFolha), numa faixa embaixo das colunas, só quando a folha em escala não sai (4.10, F-9 c):
  // até 3 linhas de 6,4 pt; o que não couber faz a letra diminuir até 5,6 pt e, depois, a última linha termina em "..."
  function drawObsContrato(o, c, g) {
    var x = G.labelX, w = G.x1 - G.labelX, y = g.obsEnd + 6, t = txtPdf(c.obsFolha), s = 6.4, ls = wrap(t, w - 12, s);
    while (ls.length > 3 && s > 5.6) { s = Math.max(5.6, r2(s - 0.1)); ls = wrap(t, w - 12, s); }
    if (ls.length > 3) { ls = ls.slice(0, 3); ls[2] = fitText(ls[2] + '...', w - 12, s); }
    o.push(R(x, y, w, 46, { fill: '#FFFFFF', stroke: '#7D8581', sw: 0.6 }));
    o.push(T(x + 6, y + 10, 'OBSERVAÇÕES GERAIS DO CONTRATO', { size: 6.4, bold: true }));
    ls.forEach(function (ln, i) { o.push(T(x + 6, y + 20 + i * 8.4, ln, { size: r2(s), fill: '#2B3430' })); });
  }
  // notas do rodapé da folha de colunas, cada uma só quando vale: o serviço contínuo (sempre); o km Atualizado e o do contrato,
  // quando a régua dá o "contr." de algum segmento, com o "*" da ponta do contrato pelo cadastro (só os números: E-5 A); ou, com
  // segmentos e sem o "contr." em nenhum, o motivo (sem o km do contrato no cadastro, ou sem a tabela de conversão no aparelho)
  function notasColunas(c) {
    var out = ['Serviço contínuo: estado de cada grupo na última vistoria da supervisão. ~ = estimativa da supervisão. Conclusão informada = a contratada diz que concluiu; a supervisão ainda confere.'];
    if (kmSoContrato(c)) { if (c.pontos.length) out.push(notaKmMp(c, c.pontos.some(function (p) { return segContrTxt(c, p); }) ? 'ok' : 'semRegua', true)); }
    else if (c.pontos.some(function (p) { return segContrTxt(c, p); })) {
      var sc = txtPdf(txtLimpo(c.snvContrato)), ast = [[c.kmIni, 'no início'], [c.kmFim, 'no fim']].map(function (k) {
        var usa = c.pontos.some(function (p) { return Math.abs(p.kmIni - k[0]) < 0.001 || Math.abs(p.kmFim - k[0]) < 0.001; }), r = usa ? kmDoContrato(c, k[0]) : null;
        return r && r.ast ? '* ' + fmtKm(r.km) + ' = km do contrato ' + k[1] + ', pelo cadastro; pela geometria, ' + fmtKm(r.geom) + '.' : '';
      }).filter(Boolean);
      out.push('KM Atualizado: SNV ' + window.SNV_BR230.versao + ' (DNIT); contr. = km do contrato' + (sc ? ', ' + sc + ',' : '') + ' pela tabela de conversão do SNV.' + (ast.length ? ' ' + ast.join(' ') : ''));
    } else if (c.pontos.length) {
      var stc = reguaStatus(c);
      out.push(stc === 'kmLocal' ? 'KM local: km próprio do segmento ' + txtPdf(txtLimpo(c.ramal)) + ' do SNV (fora do eixo); estaca de 20 m, km = estaca x ' + fmt(c.estaca || 0.02, 2) + '.' : stc === 'semCadastro' ? 'Sem o km do contrato no cadastro: a folha mostra só o km Atualizado.' : stc === 'foraDominio' ? notaDominio(reguaDe(c)) :
        'Sem a tabela de conversão do SNV neste aparelho: o km do contrato não aparece.');
    }
    return out;
  }
  // rodapé, no molde de drawFooterOae (que não muda): a legenda dos estados e das marcas e, na 2ª linha, a da trafegabilidade; as
  // notas (notasColunas) quebradas em 598 pt, a 6,1 pt, no máximo 3 linhas (a letra diminui até 5,4 pt e, depois, a última linha
  // termina em "..."); o TOTAL GERAL na última página de colunas (nas outras, "Continua na página X") e a página (num)
  function drawFooterSeg(o, c, r, num, an) {
    var y = G.yFoot, x = G.labelX, gray = '#5C6661', lx = x + 40, fs = 6.8;
    o.push(L(G.frame, y - 4, PAGE_W - G.frame, y - 4, { stroke: '#C9CECB', sw: 0.6 }));
    o.push(T(x, y + 10, 'LEGENDA', { size: 6.4, bold: true, fill: gray }));
    function item(desenho, txt, yy) {
      desenho(lx, yy);
      o.push(T(lx + 19, yy + 8, txt, { size: fs }));
      lx += 19 + textW(txt, fs) + 10;
    }
    function caixa(st, nv) {
      return function (xx, yy) { o.push(st.fill === 'none' ? R(xx, yy, 15, 10, { fill: nv ? '#F3F4F3' : '#FFFFFF', stroke: '#B9C0BC', sw: 0.6, dash: '2 2', rx: 1.5 }) : R(xx, yy, 15, 10, { fill: st.fill, rx: 1.5 })); };
    }
    // com a análise: verde = a última medição com serviço do grupo; laranja e azul = o que a vistoria marcou
    if (an) {
      item(function (xx, yy) { o.push(R(xx, yy, 15, 10, { fill: '#1E9E55', rx: 1.5 })); }, 'Medido (mês · nº da última medição)', y + 2);
      [['DN', 'Defeito observado'], ['EX', 'Em execução']].forEach(function (it) { item(caixa(OAE_STATUS[it[0]]), it[1], y + 2); });
      item(function (xx, yy) { o.push(R(xx, yy, 15, 10, { fill: '#FFFFFF', stroke: '#B9C0BC', sw: 0.6, dash: '2 2', rx: 1.5 })); }, 'Sem medição', y + 2);
    } else [['OK', 'Sem defeito'], ['DN', 'Defeito observado'], ['EX', 'Em execução'], ['NA', 'Não se aplica (N/A)'], ['NV', 'Sem vistoria']].forEach(function (it) {
      item(caixa(OAE_STATUS[it[0]], it[0] === 'NV'), it[1], y + 2);
    });
    item(function (xx, yy) { marcaPri(o, xx + 7.5, yy + 5); }, 'Prioridade', y + 2);
    item(function (xx, yy) { marcaCi(o, xx + 7.5, yy + 5); }, 'Conclusão informada', y + 2);
    lx = x + 40;
    o.push(T(lx, y + 24, 'Trafegabilidade:', { size: fs, bold: true }));
    lx += textW('Trafegabilidade:', fs, true) + 8;
    TRAF_ORDER.forEach(function (k) { item(caixa(TRAF_STATUS[k]), TRAF_STATUS[k].name, y + 16); });
    var ns = notasColunas(c), s = 6.1, ls;
    if (an) ns = ['Com a análise das medições (uso interno): cada grupo mostra a última medição com serviço no segmento, pelo local da memória de cálculo (' +
      (an.medicoes && an.medicoes.length ? an.medicoes[0].mes + ' a ' + an.medicoes[an.medicoes.length - 1].mes : '') + '); laranja e azul = o que a vistoria marcou. Medição registra quantidade e valor; não comprova execução.'].concat(ns);
    function linhas(z) { return ns.reduce(function (a, t) { return a.concat(wrap(t, 598, z)); }, []); }
    ls = linhas(s);
    while (ls.length > 3 && s > 5.4) { s = Math.max(5.4, r2(s - 0.1)); ls = linhas(s); }
    if (ls.length > 3) { ls = ls.slice(0, 3); ls[2] = fitText(ls[2] + '...', 598, s); }
    ls.forEach(function (ln, i) { o.push(T(x, y + 38 + i * 8.2, ln, { size: r2(s), fill: gray })); });

    var bx = 640;
    if (num.ultima) {
      var falta = oaeFaltaTxt(r, c), parts = [['Segmentos', String(r.n)], ['Extensão', r.ext != null ? fmt(r.ext, 2) + ' km' : '-'], ['Segmentos com defeito', String(r.dn)]];
      if (r.interr) parts.push(['Interrompidos', String(r.interr)]);
      o.push(R(bx, y, G.x1 - bx, falta ? 46 : 34, { fill: '#F4F6F5', stroke: '#C7CCC9', sw: 0.7, rx: 3 }));
      o.push(T(bx + 10, y + 13, 'TOTAL GERAL', { size: 6.6, bold: true, fill: gray }));
      if (falta) o.push(T(bx + 10, y + 39, fitText(palavrasDe(c).total + ': ' + falta, G.x1 - bx - 20, 6.8), { size: 6.8, fill: '#3B4540' }));
      var px = bx + 10;
      parts.forEach(function (pt) {
        var lbl = pt[0] + ': ';
        o.push(T(px, y + 26, lbl, { size: 8, fill: '#3B4540' }));
        px += textW(lbl, 8);
        o.push(T(px, y + 26, pt[1], { size: 8.2, bold: true }));
        px += textW(pt[1], 8.2, true) + 22;
      });
    } else {
      o.push(T(G.x1, y + 13, 'Continua na página ' + (num.pag + 1), { size: 7.4, fill: gray, anchor: 'end' }));
    }
    o.push(T(G.x1, PAGE_H - G.frame - 6, 'Página ' + num.pag + ' de ' + num.total + '   ·   Gerado em ' + fmtDate(todayIso()), { size: 6.4, fill: gray, anchor: 'end' }));
  }

  // ------------------------------------------------------------------ estado
  // aba/dadosAb/grpAb: aba aberta na ponte (vist | med), "Dados da ponte" aberto e grupos abertos na aba Medições ("pid|grupo");
  // medModo: grupo | abc (aba Medições); servModo: o mesmo nos serviços do contrato (resumo da análise)
  var state, ui = { contractOpen: false, open: {}, wide: false, medSel: {}, medGlobal: {}, trechosErro: '', aba: {}, dadosAb: {}, desAb: {}, grpAb: {}, ocAb: {}, medModo: 'grupo', servModo: 'grupo', voltar: null };

  function validState(s) {
    return s && Array.isArray(s.contracts) && s.contracts.every(function (c) {
      return c && typeof c === 'object' && Array.isArray(c.pontos) && c.pontos.every(function (p) {
        return p && typeof p === 'object' && (p.serv == null || (typeof p.serv === 'object' && !Array.isArray(p.serv)));
      });
    });
  }
  // backup: situações que esta versão não conhece (nos pontos críticos, fora de OK/Ativo/Parado/N/A). Devolve exemplos
  function situacoesEstranhas(s) {
    var ruins = [];
    s.contracts.forEach(function (c) {
      if (isContinuo(c)) return;   // pontes e conservação já tratam o desconhecido como "sem vistoria"
      c.pontos.forEach(function (p) {
        Object.keys(p.serv || {}).forEach(function (k) {
          var sv = p.serv[k];
          if (!sv || typeof sv !== 'object' || !STATUS[sv.st]) ruins.push((c.nome || c.id || 'contrato') + ' · ' + (p.nome || p.id || 'ponto') + ' · ' + k + ': ' + String(sv && sv.st));
        });
      });
    });
    return ruins;
  }
  function normalize(s) {
    s.contracts.forEach(function (c) {
      c.id = c.id || uid('ct');
      c.marcos = Array.isArray(c.marcos) ? c.marcos : [];
      var list = servicesOf(c), cont = isContinuo(c), cons = isConserva(c);
      c.pontos.forEach(function (p) {
        p.id = p.id || uid('pt');
        p.serv = p.serv || {};
        // serviço contínuo (pontes, conservação): grupo que falta = sem vistoria; pontos críticos: N/A
        list.forEach(function (k) { if (!p.serv[k.key]) p.serv[k.key] = cont ? { st: 'NV' } : { st: 'NA', pct: 0 }; });
        // segmento da conservação sem a trafegabilidade (backup antigo, por exemplo): nasce sem vistoria
        if (cons && !p.serv[TRAFEG.key]) p.serv[TRAFEG.key] = { st: 'NV' };
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
  var saveTimer = null, localFalhou = false;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(gravarAgora, 300);
  }
  // grava já o que está esperando os 300 ms (a página vai sumir: troca de app, aba fechada, outra aba assumiu a edição)
  function flushSave() { if (saveTimer) { clearTimeout(saveTimer); gravarAgora(); } }
  function gravarAgora() {
    saveTimer = null;
    if (aba.ro) return;   // outra aba edita: esta não grava por cima
    var el = document.getElementById('saveState');
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
      localFalhou = false;
      var d = new Date();
      el.textContent = 'Salvo às ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      el.classList.remove('warn');
    } catch (e) {
      localFalhou = true;
      el.textContent = 'Não salvou no navegador: use "Salvar backup"';
      el.classList.add('warn');
    }
    if (banco.on) { trackChanges(); syncStatus(); }
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
  // embaixo do nome, pequeno: o lote da licitação ou, sem ele, o nº do contrato (curto: a aba cabe na largura do celular)
  function abaSub(c) {
    var l = ctLoteReal(c);
    return l && l !== ctNome(c) ? l : ctNumeroCT(c) || 'sem número';
  }
  // os contratos ficam num botão só, com o nome do contrato aberto; a lista desce separada por tipo, com "+ Contrato" no fim
  // (com muitos contratos a barra não quebra em várias linhas). Os itens têm data-tab: o onClick de sempre abre o contrato
  // a sinalização (709) num grupo próprio, logo depois das pontes (424) e antes da conservação (decisão N-6)
  var GRUPOS_MENU = [['pc', 'Pontos críticos'], ['oae', 'Pontes (Proarte)'], ['sinal', 'Sinalização'], ['conserva', 'Conservação (P.A.T.O.)']];
  var ICON_DESCE = '<svg class="ctm-seta" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  function renderTabs() {
    var nav = $('tabs'), at = !visaoOn && !medicoesOn ? active() : null;
    var lista = GRUPOS_MENU.map(function (g) {
      // na ordem fixa (ctOrdem): a conservação pela posição no eixo, e não pela ordem de cadastro no banco
      var cs = ctOrdem(state.contracts).filter(function (c) { return ctGrupo(c) === g[0]; });
      if (!cs.length) return '';
      return '<div class="ctm-g">' + g[1] + '</div>' + cs.map(function (c) {
        return '<button type="button" class="ctm-i" data-tab="' + esc(c.id) + '" aria-current="' + (!!at && c.id === at.id) + '">' +
          esc(ctNome(c)) + '<small>' + esc(abaSub(c)) + '</small></button>';
      }).join('');
    }).join('');
    // no celular a Visão geral fica só com o ícone (aria-label mantém o nome). O botão dos contratos abre uma lista de botões
    // comuns (aria-expanded/aria-controls), sem a semântica de menu (aria-haspopup), que pediria setas e outro anúncio
    nav.innerHTML = (window.VisaoGeral && $('visaoHost') ? '<button type="button" class="tab tab-visao" data-act="visao" aria-label="Visão geral" aria-current="' + visaoOn + '">' + ICON_VISAO + '<span class="tv-txt">Visão geral</span></button>' : '') +
      (temMedicoes() ? '<button type="button" class="tab tab-medicoes" data-act="medicoes" aria-label="Medições" aria-current="' + medicoesOn + '" aria-pressed="' + medicoesOn + '">' + ICON_MED + '<span class="tm-txt">Medições</span></button>' : '') +
      (isPublico() ? '' : '<div class="ctmenu"><button type="button" class="tab ctm-btn" data-act="ct-menu" aria-expanded="false" aria-controls="ctmPop" aria-current="' + !!at + '">' +
      '<span class="ctm-nome"><span class="ctm-n">' + (at ? '<span class="ctm-longo">' + esc(ctNome(at)) + '</span><span class="ctm-cur">' + esc(ctNumeroCurto(at) || ctCurto(at)) + '</span></span><small>' + esc(abaSub(at)) + '</small>' : 'Contratos</span>') +
      (window.AMBIENTE && window.AMBIENTE.previa ? '<span class="ctm-prev">Prévia</span>' : '') + '</span>' + ICON_DESCE + '</button>' +
      '<div class="ctm-pop" id="ctmPop" hidden>' + lista +
      '<div class="ctm-add"><hr><button type="button" class="ctm-i add" data-act="new-contract">+ Contrato</button></div></div></div>');
    nav.classList.toggle('com-med', !!nav.querySelector('.tab-medicoes'));
    var cc = $('ctCurto');
    if (cc) cc.innerHTML = esc(at ? ctCurto(at) : 'Contratos') + ICON_DESCE;
    var atl = $('atalhos');
    if (atl) {
      atl.hidden = true;   // as páginas valem em qualquer largura: os atalhos que rolavam até cada parte saíram
      var bp = atl.querySelector('[data-ir="pontos"]');
      if (bp && at) bp.textContent = isConserva(at) ? 'Segmentos' : isOae(at) ? 'Pontes' : 'Pontos';
    }
    var np = document.querySelector('#pgNav [data-pg="pontos"] .pg-t');
    if (np && at) np.textContent = isConserva(at) ? 'Segmentos' : isOae(at) ? 'Pontes' : 'Pontos';
  }
  function ctCurto(c) { var n = ctNumeroCurto(c); return n ? CT_CURTO[ctGrupo(c)] + ' ' + n : ctNome(c); }

  // ---------------- celular e tablet: atalhos Pontos · Diagrama · Mapa (o editor fica em cima da folha) e, no celular em pé,
  // a barra do topo que encolhe ao rolar para baixo (fica só a 2ª linha, com o contrato curto) e volta ao rolar para cima.
  // Ao encolher, a margem de baixo da barra guarda a altura que saiu: o resto da página não sobe (sem pulo na tela)
  var mmEmPe = window.matchMedia ? window.matchMedia('(max-width:700px)') : null;
  var mmAtalhos = window.matchMedia ? window.matchMedia('(max-width:1100px)') : null;
  var rolY = 0;
  function topoMini(on) {
    var tb = document.querySelector('.topbar');
    if (!tb || document.body.classList.contains('topo-mini') === !!on) return;
    if (on) {
      var h0 = tb.offsetHeight;
      document.body.classList.add('topo-mini');
      tb.style.marginBottom = Math.max(0, h0 - tb.offsetHeight) + 'px';
    } else {
      document.body.classList.remove('topo-mini');
      tb.style.marginBottom = '';
    }
    syncTopbar();
  }
  function listaAberta() { return ($('ctmPop') && !$('ctmPop').hidden) || !$('menuPop').hidden; }
  function aoRolar() {
    var y = window.scrollY || 0, d = y - rolY;
    if (!mmEmPe || !mmEmPe.matches || visaoOn || medicoesOn || y < 140 || document.body.hasAttribute('data-pg')) { topoMini(false); rolY = y; }
    else if (Math.abs(d) >= 8) {
      if (d > 0 && !listaAberta()) topoMini(true);
      else if (d < 0) topoMini(false);
      rolY = y;
    }
    marcaAtalho();
  }
  function marcaAtalho(em) {
    var atl = $('atalhos');
    if (!atl || atl.hidden) return;
    if (!em) {
      var pv = document.querySelector('.preview'), tb = document.querySelector('.topbar');
      em = pv && (ui.wide || pv.getBoundingClientRect().top <= (tb ? tb.offsetHeight : 0) + 80) ? (view === 'mapa' ? 'mapa' : 'diagrama') : 'pontos';
    }
    atl.querySelectorAll('[data-ir]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.ir === em)); });
  }
  function irPara(onde) {
    var alvo;
    if (onde === 'pontos') {
      if (ui.wide) toggleWide(false);
      alvo = $('editor').querySelector('.points-head') || $('editor');
    } else {
      if ((onde === 'mapa') !== (view === 'mapa')) setView(onde);
      alvo = view === 'mapa' ? $('mapHost') : document.querySelector('.preview');
    }
    if (!alvo) return;
    // a barra já fica no tamanho de chegada (encolhida se o destino está mais abaixo), para a rolagem parar logo abaixo dela
    var r = alvo.getBoundingClientRect();
    topoMini(!!(mmEmPe && mmEmPe.matches) && r.top + (window.scrollY || 0) > 140 && r.top > 0);
    alvo.scrollIntoView({ block: 'start' });
    rolY = window.scrollY || 0;
    marcaAtalho(onde === 'pontos' ? 'pontos' : view === 'mapa' ? 'mapa' : 'diagrama');
  }
  function ctMenu(abrir) {
    var pop = $('ctmPop'), b = document.querySelector('[data-act="ct-menu"]');
    if (!pop || !b) return;
    pop.hidden = !abrir;
    b.setAttribute('aria-expanded', String(!!abrir));
    if (abrir) { var f = pop.querySelector('.ctm-i[aria-current="true"]') || pop.querySelector('.ctm-i'); if (f) f.focus(); }
  }
  // a barra do topo é fixa: as rolagens até um elemento (ponto, mapa, desenho) param logo abaixo dela
  function syncTopbar() {
    var tb = document.querySelector('.topbar');
    if (tb) document.documentElement.style.setProperty('--topbar-h', tb.offsetHeight + 'px');
  }

  // ---------------- páginas separadas (Pontos · Diagrama · Mapa · Galeria) e a barra das páginas, com a Foto, em qualquer
  // largura com um contrato aberto. Celular e tablet em pé: a barra embaixo, com a Foto no meio; celular deitado: no topo;
  // tablet deitado e computador: uma 2ª linha da barra do topo, em abas (index.html). O Diagrama é a primeira; a escolhida
  // fica guardada neste aparelho. Cada troca entra no histórico: o Voltar do Android (e do navegador) volta para a anterior.
  // Fora do celular, a página Pontos mostra a lista e o item aberto lado a lado (renderEditor, mdOn)
  var PG_KEY = 'diagrama-linear.pagina';
  var mmCel = window.matchMedia ? window.matchMedia('(max-width:700px),(max-height:500px) and (orientation:landscape) and (max-width:1100px)') : null;
  var mmMd = window.matchMedia ? window.matchMedia('(min-width:701px) and (min-height:501px),(min-width:1101px)') : null;
  var mmPc = window.matchMedia ? window.matchMedia('(min-width:1101px)') : null;
  // computador largo: as ferramentas da folha sobem para a barra das páginas
  var mmLargo = window.matchMedia ? window.matchMedia('(min-width:1400px)') : null;
  var pg = (function () { try { var v = localStorage.getItem(PG_KEY); return v === 'pontos' || v === 'mapa' || v === 'galeria' ? v : 'diagrama'; } catch (e) { return 'diagrama'; } })();
  var pgRolY = {};   // onde cada página estava rolada, para voltar ao mesmo lugar
  function temMapa() { return !!(window.MapaSNV && window.L && window.SNV_BR230); }
  function pgAtivo() { return !visaoOn && !medicoesOn && !$('layout').hidden; }
  function mdOn() { return pgAtivo() && !!(mmMd && mmMd.matches); }
  function aplicaPg() {
    var nav = $('pgNav'), on = pgAtivo();
    if (!nav) return;
    nav.hidden = !on;
    if (!on) { document.body.removeAttribute('data-pg'); fechaGaleriaPg(); return; }
    var cA = active();
    if ((pg === 'galeria' && !galeriaOn()) || (pg === 'mapa' && (!temMapa() || !podeMapa(cA)))) pg = 'diagrama';
    if (pg === 'diagrama' && !podeDiagrama(cA)) pg = 'pontos';   // fiscal e analista sem o acompanhamento: sem diagrama
    document.body.setAttribute('data-pg', pg);
    nav.querySelectorAll('[data-pg]').forEach(function (b) { if (b.dataset.pg === pg) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    topoMini(false);
    if (ui.wide) toggleWide(false);
    if ((pg === 'diagrama' || pg === 'mapa') && (pg === 'mapa') !== (view === 'mapa')) setView(pg);
    if ((pg === 'diagrama' || pg === 'mapa') && previewSujo) renderPreview();
    if (pg === 'galeria') abreGaleriaPg(); else fechaGaleriaPg();
    ferramentasNaBarra();
    folhasNav();
    contaPg();
    syncTopbar();   // a 2ª linha (abas) entrou ou saiu da barra do topo
  }
  // computador largo, no Diagrama: Só vistoria/Com análise, Páginas, Tela cheia e PDF ficam na barra das páginas
  function ferramentasNaBarra() {
    var t = document.querySelector('.preview-tools'), slot = $('pgTools'), bar = document.querySelector('.preview-bar');
    if (!t || !slot || !bar) return;
    var sobe = pgAtivo() && pg === 'diagrama' && !!(mmLargo && mmLargo.matches);
    if (sobe && t.parentNode !== slot) slot.appendChild(t);
    else if (!sobe && t.parentNode !== bar) bar.appendChild(t);
    slot.hidden = !sobe;
  }
  // computador, no Diagrama: as folhas em miniatura à esquerda (cópias do desenho, sem os cliques); a da tela fica marcada
  function folhasNav() {
    var nav = $('folhasNav');
    if (!nav) return;
    var on = pgAtivo() && pg === 'diagrama' && view !== 'mapa' && !!(mmPc && mmPc.matches);
    nav.hidden = !on;
    if (!on) return;
    var sh = $('pages').querySelectorAll('.sheet');
    nav.innerHTML = '<div class="fn-t">Folhas</div>' + Array.prototype.map.call(sh, function (x, i) {
      return '<button type="button" class="fn-b" data-fi="' + i + '"><span class="fn-mini"></span><span>Folha ' + (i + 1) + '</span></button>';
    }).join('');
    var minis = nav.querySelectorAll('.fn-mini');
    Array.prototype.forEach.call(sh, function (x, i) {
      var svg = x.querySelector('svg');
      if (!svg || !minis[i]) return;
      var cl = svg.cloneNode(true);
      cl.setAttribute('aria-hidden', 'true');
      cl.removeAttribute('id');
      cl.querySelectorAll('[data-pid]').forEach(function (g) { g.removeAttribute('data-pid'); });
      minis[i].appendChild(cl);
    });
    marcaFolha();
  }
  function marcaFolha() {
    var nav = $('folhasNav'), pgs = $('pages');
    if (!nav || nav.hidden) return;
    var lim = pgs.getBoundingClientRect().top + 80, at = 0;
    Array.prototype.forEach.call(pgs.querySelectorAll('.sheet'), function (x, i) { if (x.getBoundingClientRect().top <= lim) at = i; });
    nav.querySelectorAll('.fn-b').forEach(function (b) { if (Number(b.dataset.fi) === at) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
  }
  var fnT = 0;
  function pedeFolhasNav() { clearTimeout(fnT); fnT = setTimeout(function () { folhasNav(); contaPg(); }, 150); }
  // os números nas abas do computador: itens do contrato e folhas do diagrama
  function contaPg() {
    var c = active(), nav = $('pgNav');
    if (!c || !nav || !state.contracts.length) return;
    var a = nav.querySelector(':scope > [data-pg="pontos"] .pg-n'), d = nav.querySelector(':scope > [data-pg="diagrama"] .pg-n');   // :scope: o body também tem data-pg
    if (a) a.textContent = String(sortedPoints(c).length);
    if (d) { var n = $('pages').querySelectorAll('.sheet').length; d.textContent = n ? n + ' pág.' : ''; }
  }
  // "Voltar ao diagrama · folha N" (ou "ao mapa"): o item foi aberto tocando nele no desenho ou no mapa
  var ICON_VOLTA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>';
  function voltarHtml() {
    var v = ui.voltar;
    if (!v) return '';
    var t = v.pg === 'mapa' ? 'Voltar ao mapa' : 'Voltar ao diagrama' + (v.folha >= 0 ? ' · folha ' + (v.folha + 1) : '');
    return '<button type="button" class="btn small ld-voltar" data-act="ld-voltar">' + ICON_VOLTA + esc(t) + '</button>';
  }
  function voltarDe(v) {
    irPg(v.pg);
    if (v.pg === 'diagrama' && v.top != null) { var pgs = $('pages'); requestAnimationFrame(function () { pgs.scrollTop = v.top; marcaFolha(); }); }
    renderEditor();
  }
  // tocar em "Abrir em Pontes" no balão do mapa
  function abrirDoMapa(pid) {
    if (!findPoint(pid)) return;
    ui.open = {}; ui.open[pid] = true;
    ui.voltar = mdOn() ? { pg: 'mapa' } : null;
    if (pgAtivo()) irPg('pontos');
    renderEditor();
    scrollToPoint(pid, true);
  }
  // semHist: veio do Voltar (popstate), não entra de novo no histórico
  function irPg(novo, semHist) {
    if (novo === 'foto') { if (podeFotos()) openFoto(''); return; }
    if ((novo === 'diagrama' && !podeDiagrama(active())) || (novo === 'mapa' && !podeMapa(active())) || (novo === 'galeria' && !galeriaOn())) return;
    if (!pgAtivo()) return;
    if (novo === pg && document.body.getAttribute('data-pg') === pg) {   // tocar na página aberta: volta ao começo dela
      if (novo !== 'mapa' && novo !== 'galeria') window.scrollTo(0, 0);
      return;
    }
    pgRolY[pg] = window.scrollY || 0;
    pg = novo;
    try { localStorage.setItem(PG_KEY, pg); } catch (e) { /* sem armazenamento */ }
    aplicaPg();
    if (pg === 'mapa' && mapa) { mapa.invalidate(); mapa.show(); }   // o mapa estava escondido: mede de novo
    else pausaMapa();
    window.scrollTo(0, pg === 'mapa' || pg === 'galeria' ? 0 : pgRolY[pg] || 0);
    if (!semHist) try { history.pushState({ pg: pg }, ''); } catch (e) { /* segue sem histórico */ }
  }
  // a galeria como página: entre as duas barras, do contrato aberto (galeria.js, opção pagina). Sair dela pelo Esc ou pelo
  // "Entrar" volta ao Diagrama
  var glPgCid = null, glPend = null;   // contrato da galeria aberta como página (null = fechada); filtro pedido para a próxima abertura
  function abreGaleriaPg() {
    var c = active(), f = glPend || {};
    glPend = null;
    syncTopbar();   // a página fica fixa logo abaixo da barra: mede de novo antes de abrir
    if (!c || (glPgCid === c.id && galeria && galeria.isOpen() && !f.pid && !f.aba)) return;
    glPgCid = c.id;
    abrirGaleriaJa({ cid: c.id, pid: f.pid || '', aba: f.aba, pagina: true, aoFechar: function () { glPgCid = null; if (pg === 'galeria') irPg('diagrama'); } });
  }
  function fechaGaleriaPg() {
    if (glPgCid === null) return;
    glPgCid = null;
    if (galeria) galeria.close(true);
  }

  // ------------------------------------------------------------------ interface: editor
  // o relatório fotográfico (relatorio.js, linhaRot) escreve o objeto em Helvetica 8 pt numa largura de 391,28 pt (A4 sem as
  // margens de 40, a coluna do rótulo de 112 e 12 de folga) e mostra só as 2 primeiras linhas. Aqui, a mesma quebra por
  // palavras do jsPDF (splitTextToSize: parágrafos pelas quebras de linha, palavras pelo espaço), com a medida da folha A3
  // (textW: Helvetica ou Arial). As larguras do jsPDF são cerca de 1% menores: perto do limite, o aviso pode vir um pouco
  // antes do corte de verdade, não depois. Num aparelho sem as duas (Android), a letra de lá pode errar por pouco
  var OBJ_LARGURA = 595.28 - 2 * 40 - 112 - 12;
  function linhasObjeto(s) {
    var sp = textW(' ', 8), out = [];
    String(s || '-').split(/\r?\n/).forEach(function (par) {
      var ln = '', w = 0;
      par.split(' ').forEach(function (p, i) {
        var pw = textW(p, 8);
        if (i && w + sp + pw > OBJ_LARGURA) { out.push(ln); ln = p; w = pw; }
        else { ln = i ? ln + ' ' + p : p; w += (i ? sp : 0) + pw; }
      });
      out.push(ln);
    });
    return out;
  }
  // avisos do formulário (vazio = escondido): objeto maior que as 2 linhas do relatório; na conservação, km Atualizado igual
  // ao do contrato (no início ou no fim), sinal de que o km do documento foi digitado no campo do km do site
  function avisoObjeto(c) {
    var ls = linhasObjeto(c.objeto);
    if (ls.length <= 2) return '';
    var fim = ls[1].trim();
    return 'O relatório fotográfico mostra só 2 linhas do objeto: este texto dá ' + ls.length + ' linhas e sai cortado depois de "' + (fim.length > 30 ? '…' + fim.slice(-29) : fim) + '".';
  }
  function avisoKm(c) {
    function igual(a, b) { return typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 0.5; }
    if (!isConserva(c) || c.kmLocal || kmSoContrato(c) || (!igual(c.kmIni, c.kmIniContrato) && !igual(c.kmFim, c.kmFimContrato))) return '';
    // quanto a régua desloca o km nas pontas (437: cerca de -7,1; SNV 2023–2025: +0,20): só avisa quando passa de 0,5 km
    var R = reguaDe(c), d = null;
    [c.kmFimContrato, c.kmIniContrato].forEach(function (k) { var s = R && typeof k === 'number' ? R.paraSite(k) : null; if (s != null && d == null) d = s - k; });
    if (d == null) d = { '202104A': -7.1, '202304A': 0.2 }[c.snvVersao || '202104A'];
    if (d == null || Math.abs(d) < 0.5) return '';
    var v = window.SNV_BR230 && window.SNV_BR230.versao;
    return 'O km Atualizado está igual ao do contrato. O km Atualizado' + (v ? ' (SNV ' + v + ')' : '') + ' é cerca de ' + fmt(Math.abs(d), 1) + ' km ' + (d > 0 ? 'maior' : 'menor') + ': confira.';
  }
  // limites dos trechos e dos segmentos da conservação (c.trechos: os km Atualizado, do km inicial ao final do contrato).
  // Hoje só o "Gerar segmentos" usa; o relatório por trechos vai ler o mesmo campo. Listas validadas (decisão 0.12), pelo nº
  // do contrato sem espaços, para o botão "Preencher com a lista validada"
  var TRECHOS_PADRAO = {
    '0200437/2021': [743.8, 754.8, 765.8, 776.8, 786.8, 796.8, 806.8, 816.8, 826.8, 836.8, 848.8, 857.3, 865.8],
    '0200438/2021': [865.8, 876.8, 887.8, 898.8, 909.8, 919.8, 929.8, 939.8, 949.8, 959.8, 969.8, 979.8, 989.8, 999.8],
    // plano dos contratos novos, seção 5.5 (decisão D-5)
    '0200558/2025': [301.3, 311.3, 321.3, 331.3, 341.3, 351.3, 361.3, 371.3, 383.6],
    '0200310/2023': [383.6, 388.6, 398.6, 406.9, 416.9, 426.9, 436.9, 446.9, 456.9, 466.9, 476.9, 488.5],
    '0200419/2023': [488.5, 498.5, 508.5, 518.5, 528.5, 538.5, 548.5, 555.3, 563.7],
    '0200264/2023': [564.1, 574, 584, 594, 604, 614, 624.7, 642.4],
    '0200665/2024': [642.4, 652.4, 662.4, 672.4, 682.4, 692.4, 702.4, 712.4, 722.4, 732.4, 743.8],
    '0200731/2022': [0, 2, 4, 6, 8, 10, 12, 15.22]
  };
  function trechosPadrao(c) {
    var k = txtLimpo(c && c.numero).replace(/\s+/g, '');
    return Object.prototype.hasOwnProperty.call(TRECHOS_PADRAO, k) ? TRECHOS_PADRAO[k] : null;
  }
  function trechosTxt(lista) { return (Array.isArray(lista) ? lista : []).map(fmtKm).join('; '); }
  // texto -> { lista: [números] } ou { erro: 'texto' }; vazio -> { lista: [] }
  function trechosLer(txt) {
    var partes = String(txt || '').split(/[;\n]+/).map(function (s) { return s.trim(); }).filter(Boolean), lista = [];
    for (var i = 0; i < partes.length; i++) {
      var k = parseNum(partes[i]);
      if (k == null) return { erro: 'Não entendi o km "' + partes[i] + '". Separe os km por ponto e vírgula, como 743,80; 754,80.' };
      lista.push(k);
    }
    return { lista: lista };
  }
  // a lista gravada (ou a lida) vale para este contrato? { ok, lista, erro }
  function trechosValidos(c, lista) {
    lista = lista || (Array.isArray(c.trechos) ? c.trechos : []);
    var ini = c.kmIni, fim = c.kmFim;
    if (!lista.length) return { ok: false, lista: lista, erro: '' };   // sem limites: sem aviso, mas "Gerar segmentos" não roda
    if (lista.length < 2) return { ok: false, lista: lista, erro: 'São precisos pelo menos 2 limites (o km inicial e o final do contrato).' };
    for (var i = 1; i < lista.length; i++) if (!(lista[i] > lista[i - 1] + 0.001))
      return { ok: false, lista: lista, erro: 'Os limites têm de crescer, sem repetir: ' + fmtKm(lista[i]) + ' vem depois de ' + fmtKm(lista[i - 1]) + '.' };
    if (typeof ini !== 'number' || Math.abs(lista[0] - ini) > 0.001) return { ok: false, lista: lista, erro: 'O primeiro limite tem de ser o km inicial do contrato (' + (fmtKm(ini) || '?') + ').' };
    if (typeof fim !== 'number' || Math.abs(lista[lista.length - 1] - fim) > 0.001) return { ok: false, lista: lista, erro: 'O último limite tem de ser o km final do contrato (' + (fmtKm(fim) || '?') + ').' };
    return { ok: true, lista: lista, erro: '' };
  }
  // aviso dos limites, nesta ordem: a última lista digitada e recusada (ui.trechosErro); a lista gravada que não vale (quando
  // ela só não bate com o km inicial ou final do contrato, que mudou depois, o aviso diz isso na frente); os segmentos já
  // existentes; senão, vazio
  function avisoTrechos(c) {
    if (!isConserva(c)) return '';
    if (ui.trechosErro) return ui.trechosErro;
    var v = trechosValidos(c), l = v.lista;
    if (v.erro) {
      var ponta = l.length >= 2 && trechosValidos({ kmIni: l[0], kmFim: l[l.length - 1] }, l).ok;
      return (ponta ? 'Os limites gravados não batem com o km inicial ou final do contrato: corrija. ' : '') + v.erro;
    }
    return c.pontos && c.pontos.length ? 'Os segmentos já existem e não mudam com estes limites.' : '';
  }
  // km do contrato de um marco da conservação, só para leitura ("(contr. 783,90)"; "*" quando a régua discorda do cadastro
  // na ponta do contrato); sem a régua, nada
  function marcoContr(c, km) {
    var k = isConserva(c) ? kmDoContrato(c, km) : null;
    return k ? { t: '(contr. ' + fmtKm(k.km) + (k.ast ? '*' : '') + ')', g: k.ast ? 'Pela régua: ' + fmtKm(k.geom) : '' } : { t: '', g: '' };
  }
  // ---------------- segmentos da conservação (os pontos do contrato, como as pontes do 424): funções puras, para o teste em node
  // um segmento por par de limites, contíguos, S01, S02…; todos sem vistoria (os 7 grupos e a trafegabilidade)
  function segmentosDosTrechos(lista, uidFn, grupos) {
    var out = [];
    for (var i = 0; i + 1 < lista.length; i++) {
      var serv = {};
      (grupos || CONS_SERVICES).forEach(function (s) { serv[s.key] = { st: 'NV' }; });
      serv[TRAFEG.key] = { st: 'NV' };
      out.push({ id: uidFn('pt'), classe: 'segmento', nome: 'S' + String(i + 1).padStart(2, '0'), descricao: '', kmIni: lista[i], kmFim: lista[i + 1], serv: serv, disp: [], obs: '' });
    }
    return out;
  }
  // avisos da lista "Segmentos" (lista de textos; vazia = tudo certo): segmento sem km, km final antes do inicial, fora do
  // contrato, buraco (no começo, no meio ou no fim), sobreposição e nome repetido. Tolerância de 0,001 km
  function avisosSegmentos(c) {
    if (!isConserva(c) || !c.pontos || !c.pontos.length) return [];
    var out = [], ok = [], E = 0.001, nomes = {};
    function num(v) { return typeof v === 'number' && isFinite(v); }
    function nm(p) { return txtLimpo(p.nome) || '?'; }
    sortedPoints(c).forEach(function (p) {
      var a = num(p.kmIni), b = num(p.kmFim);
      if (!a || !b) out.push(nm(p) + ' está sem o km ' + (!a && !b ? 'inicial e o final' : !a ? 'inicial' : 'final'));
      else if (p.kmFim < p.kmIni - E) out.push(nm(p) + ': o km final vem antes do inicial');
      if (a && num(c.kmIni) && p.kmIni < c.kmIni - E) out.push(nm(p) + ' começa antes do km inicial do contrato (' + fmtKm(c.kmIni) + ')');
      if (b && num(c.kmFim) && p.kmFim > c.kmFim + E) out.push(nm(p) + ' passa do km final do contrato (' + fmtKm(c.kmFim) + ')');
      if (a && b && p.kmFim >= p.kmIni - E) ok.push(p);
      nomes[nm(p)] = (nomes[nm(p)] || 0) + 1;
    });
    // buracos e sobreposições: da ponta inicial do contrato (ou do primeiro segmento) à final, pelo km que já está coberto
    ok.sort(function (x, y) { return x.kmIni - y.kmIni || x.kmFim - y.kmFim; });
    var cob = num(c.kmIni) ? c.kmIni : ok.length ? ok[0].kmIni : null, ant = null;
    ok.forEach(function (p) {
      if (p.kmIni > cob + E) out.push('Entre ' + fmtKm(cob) + ' e ' + fmtKm(p.kmIni) + ' não há segmento');
      else if (ant && p.kmIni < cob - E) out.push(nm(ant) + ' e ' + nm(p) + ' se sobrepõem entre ' + fmtKm(p.kmIni) + ' e ' + fmtKm(Math.min(cob, p.kmFim)));
      if (p.kmFim > cob) { cob = p.kmFim; ant = p; }
    });
    if (ok.length && num(c.kmFim) && cob < c.kmFim - E) out.push('Entre ' + fmtKm(cob) + ' e ' + fmtKm(c.kmFim) + ' não há segmento');
    Object.keys(nomes).forEach(function (n) { if (nomes[n] > 1) out.push('Há ' + nomes[n] + ' segmentos com o nome ' + n); });
    return out;
  }
  // o aviso da lista, uma linha por aviso (syncAvisos, data-aviso="segmentos")
  function avisoSegmentosTxt(c) { return avisosSegmentos(c).join('\n'); }
  // a lista sem nenhum segmento: o caminho é gravar os limites e gerar (acompanha os limites e o km do contrato: syncAvisos)
  function segVazioTxt(c) {
    return trechosValidos(c).ok ? 'Nenhum segmento. Eles saem dos limites dos trechos gravados nos dados do contrato: toque em Gerar segmentos.' :
      'Para gerar os segmentos, grave os limites dos trechos nos dados do contrato.';
  }
  // km do segmento novo ("+ Segmento"): contíguo ao que termina mais longe (o maior km final, não o último da lista por km, que
  // pode ser um sem km), com até 10 km, sem passar do km final do contrato. Sem espaço, ou sem km final nenhum: os dois vazios
  function kmNovoSegmento(c) {
    var fins = c.pontos.map(function (p) { return p.kmFim; }).filter(function (v) { return typeof v === 'number' && isFinite(v); });
    if (!fins.length || typeof c.kmFim !== 'number') return { kmIni: null, kmFim: null };
    var ini = Math.max.apply(null, fins);
    if (!(ini < c.kmFim - 0.001)) return { kmIni: null, kmFim: null };
    return { kmIni: ini, kmFim: Math.round(Math.min(ini + 10, c.kmFim) * 1000) / 1000 };
  }
  // nome do segmento novo: o primeiro "Snn" livre a partir do número de segmentos + 1
  function nomeNovoSegmento(c) {
    var usados = {};
    c.pontos.forEach(function (p) { usados[txtLimpo(p.nome).toUpperCase()] = true; });
    for (var i = c.pontos.length + 1; ; i++) { var n = 'S' + String(i).padStart(2, '0'); if (!usados[n]) return n; }
  }
  // toque num botão da trafegabilidade: T, R ou I; tocar de novo no marcado volta a sem vistoria. A nota fica sempre (q, pri, ci
  // e pct não existem aqui)
  function trafToque(sv, st) {
    var r = { st: TRAF_ORDER.indexOf(st) >= 0 && trafSt(sv) !== st ? st : 'NV' };
    if (sv && sv.n) r.n = sv.n;
    return r;
  }
  // km do contrato do segmento, pela régua ("contr. 750,90* – 762,59"); sem a régua ou sem um dos km, vazio (nunca "NaN")
  function segContrTxt(c, p) {
    var a = kmDoContrato(c, p.kmIni), b = kmDoContrato(c, p.kmFim);
    return a && b ? 'contr. ' + fmtKm(a.km) + (a.ast ? '*' : '') + ' – ' + fmtKm(b.km) + (b.ast ? '*' : '') : '';
  }
  // código do SNV do segmento: os segmentos do eixo que cruzam o dele; um só, o código ("230BPA1530"); mais de um, o primeiro e
  // o número do último ("230BPA1530/1540"); sem o eixo ou sem km, vazio
  function snvDoSegmento(p) {
    var eixo = window.SNV_BR230;
    if (!eixo || !Array.isArray(eixo.segmentos) || typeof p.kmIni !== 'number' || typeof p.kmFim !== 'number') return '';
    var ss = eixo.segmentos.filter(function (s) { return s.kmFim > p.kmIni + 0.001 && s.kmIni < p.kmFim - 0.001; });
    if (!ss.length) return '';
    var a = String(ss[0].codigo || ''), z = String(ss[ss.length - 1].codigo || ''), m = /\d+$/.exec(z);
    return ss.length === 1 || a === z ? a : a + '/' + (m ? m[0] : z);
  }
  // prazos e valores (PI) da conservação em dois grupos: confirmados e previstos, a confirmar (tracejado). Cada item na ordem
  // da lista; data-prazo/data-valor e data-idx são a posição na lista, não no grupo. Um toque na situação troca o grupo
  var FIM_OPC = [['', '-'], ['exec', 'execução'], ['vig', 'vigência'], ['ambos', 'execução e vigência']];
  function listaHtml(c, k) {
    var pz = k === 'prazos', lst = Array.isArray(c[k]) ? c[k] : [], at = pz ? 'data-prazo' : 'data-valor', a = pz ? 'prazo' : 'valor', h = [];
    h.push('<div class="section-title">' + (pz ? 'Prazos' : 'Valores (PI)') + '<button type="button" class="btn small" data-act="add-' + a + '">' + (pz ? '+ Prazo' : '+ Valor') + '</button></div>');
    if (!lst.length) h.push('<div class="empty">' + (pz ? 'Nenhum prazo.' : 'Nenhum valor.') + ' O novo entra em "a confirmar"; um toque na situação confirma.</div>');
    [['conf', 'Confirmados'], ['prev', 'Previstos, a confirmar']].forEach(function (g) {
      var itens = [];
      lst.forEach(function (x, i) {
        x = x || {};
        if ((x.sit === 'conf' ? 'conf' : 'prev') !== g[0]) return;
        var d = at + '="' + i + '" data-pf=', conf = g[0] === 'conf', sid = 'sel-' + Math.random().toString(36).slice(2, 9);
        itens.push('<div class="pz-item">' + field('Rótulo', d + '"rotulo" type="text"', x.rotulo, ' full') +
          (pz ? field('Data', d + '"data" type="date"', x.data) +
            '<div class="field"><label for="' + sid + '">Fim de</label><select id="' + sid + '" ' + d + '"fim">' + FIM_OPC.map(function (o) {
              return '<option value="' + o[0] + '"' + ((x.fim || '') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
            }).join('') + '</select></div>' :
            field('Valor (R$)', d + '"valor" type="text" inputmode="decimal"', fmt(x.valor, 2)) + field('Data de referência', d + '"data" type="date"', x.data)) +
          field('Fonte', d + '"fonte" type="text"', x.fonte, ' full') + field('Nota', d + '"nota" type="text"', x.nota, ' full') +
          '<div class="pz-acts"><button type="button" class="pz-sit" data-act="set-' + a + '-sit" data-idx="' + i + '" aria-pressed="' + conf + '" title="Um toque troca a situação">' + (conf ? 'confirmado' : 'a confirmar') + '</button>' +
          '<button type="button" class="icon-btn" data-act="del-' + a + '" data-idx="' + i + '" aria-label="Remover ' + (pz ? 'o prazo ' : 'o valor ') + esc(x.rotulo) + '">' + ICON_TRASH + '</button></div></div>');
      });
      if (itens.length) h.push('<div class="pz-grupo' + (g[0] === 'prev' ? ' prev' : '') + '"><div class="pz-gtit">' + g[1] + '</div>' + itens.join('') + '</div>');
    });
    return h.join('');
  }
  function renderEditor() {
    var c = active(), cons = isConserva(c);
    var h = [];
    ui.trechosErro = '';   // o erro da lista de limites recusada vale até o editor ser refeito
    h.push('<section class="card">');
    // conservação: o tipo no título, numa linha embaixo, só para leitura (sem número, o nome de tela é o Lote, que não diz o tipo)
    h.push('<button type="button" class="card-head" data-act="toggle-contract" aria-expanded="' + ui.contractOpen + '"><span>Dados do contrato <span class="sub" data-nomes="sub">· ' + esc(ctNome(c)) + '</span>' +
      (cons ? ' <span class="sub ct-tipo">Tipo: ' + esc(ctGrupo(c) === 'sinal' ? 'Sinalização (P.A.T.O. de sinalização)' : tipoInfo(c).opcao) + '</span>' : '') + '</span>' + ICON_CHEV + '</button>');
    if (ui.contractOpen) {
      h.push('<div class="card-body">' + (banco.on ? lastLine(metaKey(c.id)) : '') + '<div class="grid">');
      h.push(field('Nº da obra / contrato', 'data-c="numero" type="text"', c.numero));
      h.push(field('Lote (da licitação)', 'data-c="lote" type="text"', c.lote));
      // só para leitura: saem do tipo e do número do contrato (o Lote não muda o nome nem a pasta quando há número)
      h.push(field('Nome na tela', 'data-nomes="nome" type="text" readonly', ctNome(c)));
      h.push(field('Pasta no Drive', 'data-nomes="pasta" type="text" readonly', ctPasta(c)));
      // o objeto sai no relatório fotográfico (em todos os tipos), cortado na 2ª linha: o aviso diz quando passa
      h.push(field('Objeto', 'data-c="objeto" type="text"', c.objeto, ' full'));
      h.push('<div class="hint ct-aviso full" data-aviso="objeto">' + esc(avisoObjeto(c)) + '</div>');
      h.push(field('Executora', 'data-c="executora" type="text"', c.executora, ' full'));
      h.push(field('Supervisora', 'data-c="supervisora" type="text"', c.supervisora));
      h.push(field('Contrato da supervisora', 'data-c="ctSupervisao" type="text"', c.ctSupervisao));
      h.push(field('Órgão (linha do cabeçalho)', 'data-c="orgao" type="text"', c.orgao, ' full'));
      h.push(field('Rodovia', 'data-c="rodovia" type="text"', c.rodovia));
      h.push(field('Extensão do contrato (km)', 'data-c="extensaoContrato" data-num="1" type="text" inputmode="decimal"', fmt(c.extensaoContrato, 2)));
      h.push(field('Sentido: de', 'data-c="origem" type="text"', c.origem));
      h.push(field('Sentido: para', 'data-c="destino" type="text"', c.destino));
      if (cons) {
        // conservação: o km do site é o km Atualizado (o eixo de snv-br230.js); o do contrato é o dos documentos (SNV 2020–2022),
        // que a régua de snv-conversao.js converte. Sem largura da plataforma nem pontos por página (a folha é a faixa)
        var snvV = (window.SNV_BR230 && window.SNV_BR230.versao) || '';
        // 709 (kmSoContrato): o km do site é só a posição no eixo; o do contrato leva o rótulo do cadastro ("km da MP (SNV 2023–2025)")
        var soK = kmSoContrato(c), kmRot = c.kmLocal ? ' · km local (' + (c.ramal || 'ramal') + ')' : soK ? ' · posição no eixo (km do site)' : ' · km Atualizado' + (snvV ? ' (SNV ' + snvV + ')' : '');
        var kcRot = soK ? ' · ' + txtLimpo(c.rotuloKmContrato) : ' do contrato';
        h.push(field('KM inicial' + kmRot, 'data-c="kmIni" data-num="1" type="text" inputmode="decimal"', fmtKm(c.kmIni)));
        h.push(field('KM final' + kmRot, 'data-c="kmFim" data-num="1" type="text" inputmode="decimal"', fmtKm(c.kmFim)));
        h.push(field('KM inicial' + kcRot, 'data-c="kmIniContrato" data-num="1" type="text" inputmode="decimal"', fmtKm(c.kmIniContrato)));
        h.push(field('KM final' + kcRot, 'data-c="kmFimContrato" data-num="1" type="text" inputmode="decimal"', fmtKm(c.kmFimContrato)));
        h.push('<div class="hint ct-aviso full" data-aviso="km">' + esc(avisoKm(c)) + '</div>');
        h.push(field('SNV do contrato', 'data-c="snvContrato" type="text"', c.snvContrato));
        // versão do SNV dos km do contrato: escolhe a régua (snv-conversao.js)
        if (!c.kmLocal) {   // o km local (731) não usa a régua do SNV
          var vId = 'f-' + Math.random().toString(36).slice(2, 9), vAt = c.snvVersao || '202104A';
          h.push('<div class="field"><label for="' + vId + '">Versão do SNV do km do contrato</label><select id="' + vId + '" data-c="snvVersao">' + SNV_VERSOES.map(function (o) {
            return '<option value="' + o[0] + '"' + (o[0] === vAt ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
          }).join('') + '</select></div>');
        }
        h.push(field('Data da última vistoria', 'data-c="dataVistoria" type="date"', c.dataVistoria));
        // superfície da pista: escolhe os grupos da vistoria e os textos da folha; os extras só valem na pavimentada
        var sId = 'f-' + Math.random().toString(36).slice(2, 9), pav = isPavimentada(c), sin = isSinalizacao(c);
        h.push('<div class="field"><label for="' + sId + '">Superfície da pista</label><select id="' + sId + '" data-c="superficie">' +
          '<option value="primario"' + (pav || sin ? '' : ' selected') + '>Revestimento primário</option><option value="pavimentada"' + (pav ? ' selected' : '') + '>Pavimentada</option>' +
          '<option value="sinalizacao"' + (sin ? ' selected' : '') + '>Sinalização (todo o eixo)</option></select></div>');
        if (pav) {
          var ex = Array.isArray(c.gruposExtras) ? c.gruposExtras : [];
          h.push('<div class="field full"><span class="lbl">Grupos só deste contrato</span><div class="gx-lista">' + CONS_PAV_SERVICES.filter(function (s) { return s.extra; }).map(function (s) {
            return '<label class="gx"><input type="checkbox" data-gx="' + s.key + '"' + (ex.indexOf(s.key) >= 0 ? ' checked' : '') + '> ' + esc(s.label) + '</label>';
          }).join('') + '</div></div>');
        }
      } else {
        h.push(field('KM inicial do trecho', 'data-c="kmIni" data-num="1" type="text" inputmode="decimal"', fmtKm(c.kmIni)));
        h.push(field('KM final do trecho', 'data-c="kmFim" data-num="1" type="text" inputmode="decimal"', fmtKm(c.kmFim)));
        h.push(field('Largura da plataforma', 'data-c="plataforma" type="text"', c.plataforma));
        h.push(field('Data da última vistoria', 'data-c="dataVistoria" type="date"', c.dataVistoria));
        h.push(field('Pontos por página (máx.)', 'data-c="porPagina" data-int="1" type="number" min="1" max="14"', c.porPagina || 9));
      }
      h.push('</div>');
      if (cons) {
        h.push(listaHtml(c, 'prazos'));
        h.push(listaHtml(c, 'valores'));
        var obsId = 'obsf-' + Math.random().toString(36).slice(2, 9);
        h.push('<div class="field"><label for="' + obsId + '">Observações da folha</label><textarea id="' + obsId + '" data-c="obsFolha" rows="4">' + esc(c.obsFolha) + '</textarea></div>');
        // limites dos trechos e dos segmentos: data-trechos (não data-c), gravado só ao sair do campo e só quando a lista vale
        // (onInput). O botão da lista validada só no 437 e no 438, com o campo vazio (hidden acompanha a gravação)
        var trId = 'trch-' + Math.random().toString(36).slice(2, 9), trPad = trechosPadrao(c), trLst = Array.isArray(c.trechos) ? c.trechos : [];
        h.push('<div class="field"><label for="' + trId + '">Limites dos trechos e dos segmentos (' + (c.kmLocal ? 'km local' : kmSoContrato(c) ? 'posição no eixo, km do site' : 'km Atualizado') + ')</label><textarea id="' + trId + '" data-trechos="1" rows="2">' + esc(trechosTxt(trLst)) + '</textarea></div>');
        h.push('<div class="hint">Os km separados por ponto e vírgula, do km inicial ao final do contrato.</div>');
        h.push('<div class="hint ct-aviso full" data-aviso="trechos">' + esc(avisoTrechos(c)) + '</div>');
        if (trPad) h.push('<div data-trpad="1"' + (trLst.length ? ' hidden' : '') + '><button type="button" class="btn small" data-act="preencher-trechos">Preencher com a lista validada</button></div>');
      }
      h.push('<div class="section-title">Marcos no diagrama<button type="button" class="btn small" data-act="add-marco">+ Marco</button></div>');
      if (!c.marcos.length) h.push('<div class="empty">Nenhum marco. Use para pedreira, cidade, ponte etc.</div>');
      c.marcos.forEach(function (m, i) {
        var kmF = field('KM', 'data-marco="' + i + '" data-mf="km" type="text" inputmode="decimal"', fmtKm(m.km));
        // conservação: o km do contrato do marco, só para leitura, embaixo de "KM" (acompanha o km digitado: syncAvisos)
        if (cons) { var mc = marcoContr(c, m.km); kmF = kmF.replace('</label>', '<span class="mk-c" data-mkc="' + i + '" title="' + esc(mc.g) + '">' + esc(mc.t) + '</span></label>'); }
        h.push('<div class="mini-row">' +
          field('Nome', 'data-marco="' + i + '" data-mf="nome" type="text"', m.nome) + kmF +
          '<button type="button" class="icon-btn" data-act="del-marco" data-idx="' + i + '" aria-label="Remover marco ' + esc(m.nome) + '">' + ICON_TRASH + '</button></div>');
      });
      if (!banco.on || isAdmin()) h.push('<div><button type="button" class="btn small danger" data-act="del-contract">' + (banco.on ? 'Arquivar este contrato' : 'Excluir este contrato') + '</button></div>');
      h.push('</div>');
    }
    h.push('</section>');

    var pts = sortedPoints(c), oae = isOae(c);
    if (oae || cons) { carregarAnalise(c); h.push(analiseResumoHtml(c)); }
    if (isPavimentada(c)) h.push(desempResumoHtml(c));
    var iLista = h.length;   // até aqui, o resumo do contrato (dados, análise, desempenho); daqui em diante, a lista
    // conservação: a lista "Segmentos". Sem nenhum, só "Gerar segmentos" (pelos limites dos trechos); com pelo menos um, só
    // "+ Segmento" (os dois nunca juntos: um segmento solto num contrato vazio esconderia o "Gerar")
    if (cons) {
      h.push('<div class="points-head"><h2>Segmentos<span class="count">' + pts.length + '</span></h2>' + (pts.length ? '<button type="button" class="btn small" data-act="add-point">+ Segmento</button>' :
        '<button type="button" class="btn small" data-act="gerar-segmentos">Gerar segmentos</button>') + '</div>');
      h.push('<div class="hint"><b>Faixa do contrato:</b> ' + esc(faixaTexto(c) || 'informe o km inicial e o final nos dados do contrato') + '</div>');
      if (pts.length) h.push('<div class="hint">Ordenados por km, como no diagrama. Toque num segmento (aqui ou no desenho) para marcar o estado.</div>');
      else h.push('<div class="empty" data-segvazio="1">' + esc(segVazioTxt(c)) + '</div>');
      h.push('<div class="hint ct-aviso" data-aviso="segmentos">' + esc(avisoSegmentosTxt(c)) + '</div>');
    } else if (oae && medGlobalDe(c, anOf(c))) {
      // pontes de uma medição: só as que tiveram serviço nela, da maior para a menor
      var anL = anOf(c), gL = medGlobalDe(c, anL), vL = function (p) { var a = anL.pontes && anL.pontes[p.id]; return a ? Number(a.meses[String(gL)]) || 0 : 0; };
      var nTot = pts.length;
      pts = pts.filter(function (p) { return vL(p) > 0; }).sort(function (x, y) { return vL(y) - vL(x); });
      h.push('<div class="points-head"><h2>Pontes<span class="count">' + pts.length + ' de ' + nTot + '</span></h2><button type="button" class="btn small" data-act="an-med" data-v="0">Todas por km</button></div>');
      h.push('<div class="hint">Só as pontes com serviço na ' + esc(medTxt(anL, gL)) + ', da maior para a menor. Ao abrir uma, o gráfico já mostra essa medição.</div>');
    } else {
      h.push('<div class="points-head"><h2>' + (oae ? 'Pontes' : 'Pontos críticos') + '<span class="count">' + pts.length + '</span></h2><button type="button" class="btn small" data-act="add-point">' + (oae ? '+ Ponte' : '+ Ponto') + '</button></div>');
      h.push('<div class="hint">' + (oae ? 'Ordenadas por km, como no diagrama. Toque numa ponte (aqui ou no desenho) para marcar o estado' + (anOf(c) ? ' e ver as medições e os alertas.' : '.') :
        'Ordenados por KM, como no diagrama. Clique num ponto (aqui ou no desenho) para editar.') + '</div>');
    }
    // lado a lado: um item aberto por vez, à direita; na lista, no lugar dele, só a linha marcada
    var md = mdOn(), pAb = null;
    if (md) {
      pts.forEach(function (p) { if (!pAb && ui.open[p.id]) pAb = p; });
      ui.open = {};
      if (pAb) ui.open[pAb.id] = true;
      if (!pAb) ui.voltar = null;
    }
    h.push('<div class="pt-list" id="ptList">');
    pts.forEach(function (p) { h.push(p === pAb ? ptMarcadoHtml(p) : pointCard(p)); });
    h.push('</div>');
    // analista e fiscal: sem aviso de papel em cima (pedido de 19/10/2026); só o contrato de conservação vazio avisa o fiscal
    var nota = '';
    if (readOnly() && !isAnalista()) {
      nota = '<div class="ro-note"><span>Só consulta: os dados são do banco da equipe. Para editar, entre com o seu código.</span>' +
        '<button type="button" class="btn small primary" data-act="login">Entrar</button></div>';
    } else if (isFiscal() && cons && !pts.length) {
      nota = '<div class="ro-note fiscal-note"><span>Este contrato de conservação ainda não tem segmentos.</span></div>';
    }
    var ed = $('editor');
    ed.classList.toggle('ld', md);
    if (md) {
      var resBtn = '<button type="button" class="ld-resumo" data-act="ld-resumo" aria-current="' + !pAb + '"><span class="ld-resumo-t"><b>Resumo do contrato</b>' +
        '<small>Dados do contrato' + (anOf(c) ? ' · Análise das medições' : '') + '</small></span>' + ICON_CHEV + '</button>';
      ed.innerHTML = '<div class="ld-l">' + nota + resBtn + h.slice(iLista).join('') + dicaInstalarHtml() + '</div>' +
        '<div class="ld-r">' + (pAb ? voltarHtml() + pointCard(pAb) : '<h2 class="ld-tit">Resumo do contrato</h2>' + h.slice(0, iLista).join('')) + '</div>';
    } else ed.innerHTML = nota + h.join('') + dicaInstalarHtml();
    lockEditor();
  }
  // na lista lado a lado, a linha do item aberto (sem data-id no .pt: os seletores do cartão acham só o da direita)
  function ptMarcadoHtml(p) {
    var c = ownerOf(p);   // as mesmas colunas do cartão (ponte, segmento ou ponto)
    return '<div class="pt' + (isOae(c) || isConserva(c) ? ' oae' : '') + (isConserva(c) ? ' cons' : '') + ' pt-marcado"><button type="button" class="pt-head" data-act="toggle-point" data-id="' + esc(p.id) + '" aria-expanded="true" aria-current="true">' + pointHead(p) + '</button></div>';
  }

  function pointHead(p) {
    var c = ownerOf(p);
    if (isOae(c)) return ponteHead(p, c);
    if (isConserva(c)) return segHead(p, c);
    var dots = servicesOf(c).map(function (s) {
      var st = (p.serv[s.key] || {}).st;
      if (!STATUS[st]) st = 'NA';   // situação desconhecida (backup editado à mão): não derruba a tela
      return '<span class="dot ' + st + '" title="' + esc(s.short + ': ' + STATUS[st].name) + '"></span>';
    }).join('');
    var km = (p.kmIni != null ? fmtKm(p.kmIni) : '?') + ' – ' + (p.kmFim != null ? fmtKm(p.kmFim) : '?');
    var np = banco.on ? propsDo(active().id, p.id).length : 0;
    return '<span class="pt-name">' + esc(p.nome || '?') + (np ? '<span class="pt-prop" title="Alteração aguardando aprovação" aria-label="aguardando aprovação"></span>' : '') + '</span><span class="pt-km">KM ' + km + '</span><span class="pt-dots">' + dots + '</span><span class="pt-pct">' + fmtPct(pointPct(p)) + '</span>' + ICON_CHEV;
  }

  // botões de status de cada serviço. Pontos críticos (obra feita uma vez): OK, Ativo, Parado, N/A e o % executado.
  // Serviço contínuo (pontes, conservação, pelo tipo do contrato do ponto): estado na vistoria (sem dano aparente, dano
  // observado, em execução, N/A), estimativa do dano, onde, e as marcas de prioridade e de conclusão informada
  // mais(s, estado): botões a mais na linha das marcas (pontes, quem vê a análise: medido sem execução)
  // antes: HTML que entra logo depois das mudanças aguardando aprovação e antes dos grupos (a trafegabilidade do segmento)
  // itensMais(s, sv): HTML embaixo dos itens do grupo (pontes, quem vê a análise: em que medição cada item foi medido)
  function servHtml(p, list, extra, mais, antes, itensMais) {
    var id = esc(p.id), h = propHtml(active().id, p) + (antes || ''), prop = propServ(active().id, p.id), cont = isContinuo(ownerOf(p));
    list.forEach(function (s) {
      var sv = p.serv[s.key] || (cont ? { st: 'NV' } : { st: 'NA', pct: 0 }), pv = prop[s.key], cur = cont ? oaeSt(sv) : sv.st;
      var segs = (cont ? OAE_STATUS_ORDER : STATUS_ORDER).map(function (k) {
        var pend = pv && pv.st === k && cur !== k ? ' pend' : '';
        return '<button type="button" class="' + k + pend + '" data-act="set-st" data-id="' + id + '" data-svc="' + s.key + '" data-st="' + k + '" aria-pressed="' + (cur === k) + '"' + (pend ? ' title="Aguardando aprovação"' : '') + '>' + (cont ? oaeStOf(s, k) : STATUS[k]).btn + '</button>';
      }).join('');
      if (cont) {
        var on = comQtd(cur), mx = mais ? mais(s, cur) : '', temItens = isOae(ownerOf(p)) && !!OAE_ITENS[s.key];
        h += '<div class="svc oae"><div class="svc-name">' + esc(s.short) + (s.q ? ' <small class="svc-un">' + esc(s.q + ' (estimativa)') + '</small>' : '') +
          (cur === 'NV' ? ' <small class="svc-nv">sem vistoria</small>' : '') + (extra ? extra(s) : '') + '</div>' +
          '<div class="seg" role="group" aria-label="' + esc(s.short) + '">' + segs + '</div>' +
          (s.un ? '<div class="pct-in"><input type="number" min="0"' + (s.un === '%' ? ' max="100"' : '') + ' step="any" inputmode="decimal" data-svcpct="' + s.key + '" data-id="' + id + '" value="' + (on && sv.q != null ? esc(sv.q) : '') + '"' +
            (on ? ' placeholder="estimativa"' : ' disabled') + ' aria-label="' + esc(s.short + ': estimativa, ' + s.q) + '"><span>' + esc(s.un) + '</span></div>' : '<div class="pct-in"></div>') +
          (on && temItens ? itensHtml(id, s, sv, pv) + (itensMais ? itensMais(s, sv) : '') : '') +
          (on ? '<input class="svc-nota" type="text" maxlength="140" data-svcpct="' + s.key + '" data-nota="1" data-id="' + id + '" value="' + esc(sv.n || '') + '" placeholder="' + (temItens ? 'Outro item ou local (opcional)' : 'Onde / o quê (opcional)') + '" aria-label="' + esc((temItens ? 'Outro item ou local: ' : 'Onde ou o quê: ') + s.short) + '">' : '') +
          (on || mx ? '<div class="svc-marcas">' + (on ? Object.keys(OAE_MARCAS).map(function (m) {
              var pm = pv && comQtd(pv.st) && !!pv[m] !== !!sv[m] ? ' pend' : '';
              return '<button type="button" class="marca ' + m + pm + '" data-act="set-marca" data-id="' + id + '" data-svc="' + s.key + '" data-m="' + m + '" aria-pressed="' + !!sv[m] + '" title="' + esc(OAE_MARCAS[m].title + (pm ? ' (aguardando aprovação)' : '')) + '">' +
                '<i aria-hidden="true">' + (m === 'pri' ? '!' : '✓') + '</i>' + esc(OAE_MARCAS[m].name) + '</button>';
            }).join('') : '') + mx + '</div>' : '') +
          '</div>';
        return;
      }
      var pctDisabled = (sv.st === 'OK' || sv.st === 'NA');
      h += '<div class="svc"><div class="svc-name">' + esc(s.short) + (extra ? extra(s) : '') + '</div><div class="seg" role="group" aria-label="' + esc(s.short) + '">' + segs + '</div>' +
        '<div class="pct-in"><input type="number" min="0" max="100" step="1" data-svcpct="' + s.key + '" data-id="' + id + '" value="' + (pctDisabled ? (sv.st === 'OK' ? 100 : '') : (Number(sv.pct) || 0)) + '"' + (pctDisabled ? ' disabled' : '') + ' aria-label="Percentual executado de ' + esc(s.short) + '"><span>%</span></div></div>';
    });
    return h;
  }

  // itens do grupo (dano observado ou em execução): botões que se marcam e desmarcam; "+ Outro" leva ao campo de texto.
  // Proposta de fiscal com outro conjunto de itens: o botão fica com a borda de "aguardando aprovação"
  function itensHtml(id, s, sv, pv) {
    var ks = Array.isArray(sv.itens) ? sv.itens : [], pk = pv && comQtd(oaeSt(pv)) && Array.isArray(pv.itens) ? pv.itens : (pv && comQtd(oaeSt(pv)) ? [] : null);
    return '<div class="svc-itens">' + OAE_ITENS[s.key].map(function (b, i) {
      return '<div class="svc-it-b"><span class="svc-it-t">' + esc(b.t) + '</span><div class="svc-it-l" role="group" aria-label="' + esc(s.short + ': ' + b.t) + '">' + b.l.map(function (x) {
        var on = ks.indexOf(x.k) >= 0, pend = pk && (pk.indexOf(x.k) >= 0) !== on ? ' pend' : '';
        return '<button type="button" class="svc-it' + pend + '" data-act="set-item" data-id="' + id + '" data-svc="' + s.key + '" data-it="' + x.k + '" aria-pressed="' + on + '"' + (pend ? ' title="Aguardando aprovação"' : '') + '>' + (on ? '✓ ' : '') + esc(x.n) + '</button>';
      }).join('') + (i === OAE_ITENS[s.key].length - 1 ? '<button type="button" class="svc-it outro" data-act="item-outro" data-id="' + id + '" data-svc="' + s.key + '">+ Outro</button>' : '') + '</div></div>';
    }).join('') + '</div>';
  }

  function pointCard(p) {
    if (isOae(ownerOf(p))) return ponteCard(p, ownerOf(p));
    if (isConserva(ownerOf(p))) return segCard(p, ownerOf(p));
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
      if (p.bgs != null || (ownerOf(p) || {}).temBgs) h += field('BGS prevista (m³)', 'data-p="bgs" data-num="1" data-id="' + id + '" type="text" inputmode="decimal"', fmt(p.bgs, 2));
      h += '</div>';

      h += '<div class="section-title">Serviços</div>';
      h += servHtml(p, servicesOf(ownerOf(p)));

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
    var mk = document.querySelector('.pt-marcado [data-id="' + CSS.escape(p.id) + '"]');
    if (mk) mk.innerHTML = pointHead(p);
    var art2 = document.querySelector('.pt[data-id="' + CSS.escape(p.id) + '"] input[readonly]');
    if (art2) { var len = pointLen(p); art2.value = len != null ? fmt(len, 2) + ' km' : ''; }
    // segmento: o km do contrato e o código do SNV acompanham o km digitado
    var art3 = document.querySelector('.pt[data-id="' + CSS.escape(p.id) + '"]');
    if (art3 && art3.classList.contains('cons')) {
      var c = ownerOf(p);
      art3.querySelectorAll('[data-segc]').forEach(function (el) { el.value = segContrTxt(c, p).replace(/^contr\. /, ''); });
      art3.querySelectorAll('[data-segsnv]').forEach(function (el) { el.value = snvDoSegmento(p); });
    }
  }
  function rerenderPoint(p) {
    var art = document.querySelector('.pt[data-id="' + CSS.escape(p.id) + '"]');
    if (art) art.outerHTML = pointCard(p);
    lockEditor();
  }
  // refaz o cartão da ponte (abas, medição escolhida) e devolve o foco ao botão equivalente, sem rolar a tela
  function refazPonte(pid, foco) {
    var p = findPoint(pid);
    if (!p) return;
    rerenderPoint(p);
    var el = foco && document.querySelector('.pt[data-id="' + CSS.escape(pid) + '"] ' + foco);
    if (el && !el.disabled) try { el.focus({ preventScroll: true }); } catch (e) { /* sem foco */ }
  }
  // "Dados da ponte" (aba Vistoria) continua aberto ou fechado quando o cartão é refeito
  document.addEventListener('toggle', function (e) {
    var d = e.target;
    if (d && d.classList && d.classList.contains('pt-dados') && d.dataset.id) ui.dadosAb[d.dataset.id] = d.open;
    if (d && d.classList && d.classList.contains('pt-des') && d.dataset.id) ui.desAb[d.dataset.id] = d.open;
    // "Onde foi medido" (segmento da conservação): a lista só é montada aberta; ao abrir, lê as ocorrências e refaz o cartão
    if (d && d.classList && d.classList.contains('an-oc') && d.dataset.id) {
      ui.ocAb[d.dataset.id] = d.open;
      // fechada, deixa de estar "cheia": ao abrir de novo a lista é refeita (e lida outra vez se deu erro)
      if (!d.open) delete d.dataset.cheio;
      else if (!d.dataset.cheio) { carregarOcorr(active(), findPoint(d.dataset.id)); refazPonte(d.dataset.id, '.an-oc summary'); }
    }
  }, true);

  // ------------------------------------------------------------------ análise das medições (contratos de pontes)
  // Fica numa tabela sem leitura pública; só engenheiro e criador recebem (Banco.analise). Guardada no aparelho
  // enquanto a pessoa estiver entrada como engenheiro ou criador, para abrir sem sinal; sai junto com a sessão.
  var AN_KEY = 'diagrama-linear.analise';
  var analise = { dados: {}, estado: {} };   // estado[cid]: carregando | ok | vazia | erro
  function analiseInit() {
    var x = isEng() || isAnalista() ? lsGet(AN_KEY) : null;
    analise = { dados: x && x.dados && typeof x.dados === 'object' ? x.dados : {}, estado: {} };
    if (!isEng() && !isAnalista()) lsPut(AN_KEY, null);
  }
  // o acesso do analista diminuiu (tiraram as medições de um contrato): as medições guardadas daquele contrato saem do aparelho
  function podarAnalise() {
    if (!isAnalista() || !analise) return;
    var tirou = false;
    Object.keys(analise.dados).forEach(function (cid) {
      var a = banco.acesso && banco.acesso[cid];
      if (!(a && a.med)) { delete analise.dados[cid]; tirou = true; }
    });
    if (tirou) lsPut(AN_KEY, { dados: analise.dados });
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
  var anCache = { raw: null, view: null }, mnePend = {}, anLido = {}, anPedidos = {};   // anLido[cid]: quando a análise (e as marcas) foi lida do banco
  // na área dedicada, também consulta pontos críticos; as folhas e o editor conservam o recorte de tipos de antes
  function anOf(c, naArea) {
    var raw = c && (naArea || isOae(c) || isConserva(c)) && parte(c, 'med') ? analise.dados[c.id] || null : null;
    if (!raw) return null;
    if (anCache.raw !== raw) anCache = { raw: raw, view: anCalc(raw) };
    return anCache.view;
  }
  var REGRUPA = [[/^remo[çc][ãa]o manual de revestimento asf/i, 'juntas'], [/anticorrosiva/i, 'pintura']];
  // unidade como se escreve: m2 → m², m3 → m³, und → un
  function unTxt(u) { return { m2: 'm²', m3: 'm³', und: 'un' }[u] || u || ''; }
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
    // serviços que mudaram de grupo (19/10/2026, pedido do usuário): a remoção de asfalto é medida junto com os berços (o corte
    // do asfalto para refazer a junta) e vai para Juntas; a pintura epóxi vai para Pintura. Vale também para a análise gravada
    // antes; os grupos tocados são refeitos como em gen_424.py (valor = soma, ult = última medição, n = nº de medições)
    function regrupa(a) {
      var toca = {}, sv = (a.servicos || []).map(function (s) {
        var r = null;
        REGRUPA.forEach(function (x) { if (x[0].test(s.nome || '')) r = x[1]; });
        if (!r || r === s.g) return s;
        if (s.g) toca[s.g] = 1;
        toca[r] = 1;
        return Object.assign({}, s, { g: r, gAntes: s.g });
      });
      if (!Object.keys(toca).length) return a;
      var grupos = Object.assign({}, a.grupos);
      Object.keys(toca).forEach(function (k) {
        var ns = [], v = 0;
        sv.forEach(function (s) { if (s.g !== k) return; v += Number(s.v) || 0; medsDe(s.meds).forEach(function (n) { if (ns.indexOf(n) < 0) ns.push(n); }); });
        if (!ns.length) { delete grupos[k]; return; }
        grupos[k] = Object.assign({}, grupos[k], { valor: Math.round(v * 100) / 100, ult: Math.max.apply(null, ns), n: ns.length });
      });
      return Object.assign({}, a, { servicos: sv, grupos: grupos });
    }
    var pontes = {}, total = 0, comAlerta = 0, cons = raw.tipo === 'conserva';
    Object.keys(raw.pontes || {}).forEach(function (pid) {
      var a = regrupa(raw.pontes[pid]), mx = {}, grupos = {}, als = [], et = {};
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
        if (at.length < 2 || cons) return;   // conservação: o segmento é atendido o ano todo, voltar não é alerta
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
      if (volta.length && !cons) {
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
    return Object.assign({}, raw, { medicoes: meds, pontes: pontes, etapas: etapas, resumo: Object.assign({}, raw.resumo, { altos: total, alertas: total, pontesAlerta: comAlerta }) });
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
  // medições por MP (migração 21, D-15): a base e a versão atual de cada MP, somadas aqui (medmp.js) no mesmo formato da
  // análise antiga; mps = o que se sabe de cada MP (versão, quando, quem, ocorrências), sem os dados. Banco ainda sem a
  // migração 21: a análise antiga.
  var anQuando = {};
  function lerAnalise(cred, cid) {
    if (!window.Banco.medicoes || !window.MedMP) return window.Banco.analise(cred, cid);
    return window.Banco.medicoes(cred, cid).then(function (r) {
      if (!r || !r.base) return null;
      var mps = r.mps || [];
      return { dados: window.MedMP.montar(r.base, mps.map(function (x) { return { n: x.n, dados: x.dados }; })), fonte: r.fonte, em: r.em, por: r.por, marcas: r.marcas,
        mps: mps.map(function (x) { return { n: x.n, v: x.v, em: x.em, por: x.por, ocorr: x.ocorr, versoes: x.versoes }; }) };
    }, function (e) {
      if (e && (e.pg === 'PGRST202' || e.status === 404)) return window.Banco.analise(cred, cid);
      throw e;
    });
  }
  function carregarAnalise(c, naArea) {
    if (!c || (!naArea && !(isOae(c) || isConserva(c))) || !banco.on || !parte(c, 'med') || !window.Banco || !window.Banco.analise) return Promise.resolve();
    var e = analise.estado[c.id];
    if (e === 'carregando') return anPedidos[c.id] || Promise.resolve();
    if (e === 'ok' || e === 'vazia' || e === 'erro') return Promise.resolve();   // erro: só de novo ao trocar de aba ou voltar ao app
    analise.estado[c.id] = 'carregando';
    var cred = banco.login.codigo, cid = c.id;
    return (anPedidos[cid] = lerAnalise(cred, cid).then(function (r) {
      if (!banco.login || banco.login.codigo !== cred || !parte(contractById(cid), 'med')) return;
      if (r && r.dados && typeof r.dados === 'object') {
        analise.dados[cid] = r.dados;
        analise.dados[cid].sobre = { fonte: r.fonte || '', em: r.em || null, por: r.por || '' };
        if (r.mps) analise.dados[cid].mpsInfo = r.mps; else delete analise.dados[cid].mpsInfo;
        anQuando[cid] = r.em || null;
        // medido sem execução; sem o campo, o banco ainda não tem a migração 07 e a marca não aparece
        if (r.marcas && typeof r.marcas === 'object' && !Array.isArray(r.marcas)) analise.dados[cid].marcas = r.marcas;
        else delete analise.dados[cid].marcas;
        analise.estado[cid] = 'ok';
        anLido[cid] = Date.now();
      } else {
        delete analise.dados[cid];
        analise.estado[cid] = 'vazia';
      }
      lsPut(AN_KEY, { dados: analise.dados });
      // digitando no cartão: só a folha agora; o cartão é refeito quando a pessoa sair do campo
      if (medicoesOn) desenhaMedicoes();
      else if (visaoOn && visao) desenhaVisao();
      else if (!visaoOn && active() && active().id === cid) { if (!typing()) renderEditor(); else banco.want = true; renderPreview(); }
    }, function (err) {
      if (!banco.login || banco.login.codigo !== cred || !parte(contractById(cid), 'med')) return;
      analise.estado[cid] = 'erro';
      // sessão encerrada ou papel trocado em outro aparelho: reconfere o acesso (que tira a análise deste aparelho)
      if (err && (err.code === 'codigo_invalido' || err.code === 'sem_permissao')) { conferirAcesso(); return; }
      if (medicoesOn) desenhaMedicoes();
      else if (active() && active().id === cid) { if (!typing()) renderEditor(); else banco.want = true; }
    }));
  }
  function fmtIsoDate(iso) { return iso ? fmtDate(String(iso).slice(0, 10)) : ''; }

  // no resumo: com "Todas", uma linha por etapa; com uma etapa, as pontes sem serviço, as atendidas mais de uma vez e
  // (na 1ª etapa) o executado × estimado do Anexo VI. Tocar numa ponte abre o cartão dela.
  function anPChip(p) { return '<button type="button" class="an-pchip" data-act="an-ir" data-id="' + esc(p.id) + '">' + esc(p.nome || p.codigo || '?') + (p.kmIni != null ? ' <small>km ' + esc(fmtKm(p.kmIni)) + '</small>' : '') + '</button>'; }
  // resumo: serviços medidos no contrato (na etapa mostrada), nos grupos da vistoria e "Acesso e limpeza", com a curva ABC do
  // contrato (pelo valor). A quantidade só se soma por serviço; por grupo, o valor e o % do total. Os itens do Anexo VI sem
  // descrição (cod_*) nunca foram medidos: ficam fora das listas, citados no rodapé
  function servContratoHtml(c, an, E) {
    var ei = E ? etapaInfo(an, E) : null, ag = {}, ord = [], cods = {}, cons = an.tipo === 'conserva', caps = {}, capL = [], estL = [];
    // conservação: o contrato inteiro, da medição consolidada (inclui o que não tem local); "segmentos" conta onde há local
    if (cons) {
      var svI = {}, ns = E ? ei.ns : (an.medicoes || []).map(function (m) { return m.n; });
      // pelo id (o mesmo código em dois grupos vira 93776-1, 93776-2) e, sem id igual, pelo código
      (an.servicos || []).forEach(function (s) { svI[s.id || s.cod] = s; });
      (an.servicos || []).forEach(function (s) { if (s.cod && !svI[s.cod]) svI[s.cod] = s; });
      ns.forEach(function (n) {
        var pm = (an.porMedicao || {})[String(n)] || {};
        Object.keys(pm).forEach(function (k) {
          var s = svI[k] || { nome: k, un: '' }, t = ag[k];
          // sem grupo da vistoria: o capítulo do SIAC, quando a análise veio do Resumo da Medição (sem km)
          var gk = s.g || (s.grupo ? 'cap:' + s.grupo : 'semlocal');
          if (gk.indexOf('cap:') === 0 && !caps[gk]) { caps[gk] = 1; capL.push({ key: gk, short: s.grupo.replace(/^[\d,.]+\s*-\s*/, ''), cap: true }); }
          if (!t) { t = ag[k] = { nome: s.nome, un: s.un, g: gk, q: 0, v: 0, pontes: 0 }; ord.push(t); }
          t.q += Number(pm[k][0]) || 0; t.v += Number(pm[k][1]) || 0;
        });
      });
      // o serviço do segmento acha a sua linha pelo id, pelo código exato e, quando o código vem sem o sufixo do período
      // (731: 240000 no segmento × 240000-4 "2023–24" e 240000-15 "2025–26"), pelo grupo e pelo nome; cada segmento conta uma vez
      var porCod = {};
      Object.keys(ag).forEach(function (k) { var b = String(k).replace(/-\d+$/, ''); (porCod[b] = porCod[b] || []).push(k); });
      var linhasDe = function (s) {
        if (s.id && ag[s.id]) return [s.id];
        if (s.cod && ag[s.cod]) return [s.cod];
        var cs = porCod[String(s.cod || '').replace(/-\d+$/, '')] || [];
        [function (k) { return ag[k].g === s.g && ag[k].nome === s.nome; }, function (k) { return ag[k].nome === s.nome; }, function (k) { return ag[k].g === s.g; }]
          .some(function (f) { var x = cs.filter(f); if (x.length) { cs = x; return true; } return false; });
        return cs;
      };
      sortedPoints(c).forEach(function (p) {
        var a = an.pontes && an.pontes[p.id], vis = {};
        ((a && a.servicos) || []).forEach(function (s) { if (!noEscopo([s], ns, true).length) return; linhasDe(s).forEach(function (k) { if (!vis[k]) { vis[k] = 1; ag[k].pontes++; } }); });
      });
      estL = ord.filter(function (t) { return t.v < 0; });
      ord = ord.filter(function (t) { return t.v > 0; });
    }
    if (!cons) sortedPoints(c).forEach(function (p) {
      var a = an.pontes && an.pontes[p.id];
      if (!a) return;
      var base = a.servicos || [], temPor = base.some(function (s) { return s.por; });
      base.forEach(function (s) {
        if (/^cod_/.test(s.nome || '')) { if (s.est > 0 && (!E || E === EST_ETAPA)) cods[s.nome.slice(4)] = (cods[s.nome.slice(4)] || 0) + 1; return; }
        if (!(s.v > 0)) return;
        var x = E ? noEscopo([s], ei.ns, temPor)[0] : s;
        if (!x || !(x.v > 0)) return;
        var t = ag[s.nome];
        if (!t) { t = ag[s.nome] = { nome: s.nome, un: s.un, g: s.g, q: 0, v: 0, pontes: 0 }; ord.push(t); }
        t.q += Number(x.q) || 0; t.v += Number(x.v) || 0; t.pontes++;
      });
    });
    if (!ord.length && !estL.length) return '';
    ord.sort(function (x, y) { return y.v - x.v; });
    var tot = ord.reduce(function (t, x) { return t + x.v; }, 0), acum = 0, pc = { A: 0, B: 0, C: 0 }, nk = { A: 0, B: 0, C: 0 };
    ord.forEach(function (t) { t.k = acum / tot < 0.8 ? 'A' : acum / tot < 0.95 ? 'B' : 'C'; acum += t.v; pc[t.k] += t.v / tot * 100; nk[t.k]++; });
    function pct(v) { return (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10).toLocaleString('pt-BR') + '%'; }
    var modo = ui.servModo === 'abc' ? 'abc' : 'grupo', cid = 'ct:' + c.id;
    function linha(t) {
      return '<div class="mg-svc"><div class="mg-l"><span class="mg-nm"><span class="sc-k ' + t.k.toLowerCase() + '" aria-label="classe ' + t.k + '">' + t.k + '</span>' + esc(t.nome) +
        '<small class="sc-p">' + (cons ? (t.pontes ? t.pontes + (t.pontes === 1 ? ' segmento' : ' segmentos') : 'sem local') : t.pontes + (t.pontes === 1 ? ' ponte' : ' pontes')) + (t.g === 'acesso' ? ' · meio de execução' : '') + '</small></span>' +
        '<span class="mg-q"><b>' + fmtN(Math.round(t.q * 100) / 100) + ' <small>' + esc(unTxt(t.un)) + '</small></b><small>' + fmtBRL(t.v) + ' · ' + pct(t.v / tot * 100) + '</small></span></div></div>';
    }
    var h = '<div class="an-sec an-serv"><h4>Serviços medidos (' + ord.length + ')' + (E ? ' · ' + E + 'ª etapa' : '') + '</h4>';
    var sEst = estL.reduce(function (t, x) { return t + x.v; }, 0);
    h += '<div class="an-line">' + (estL.length ? '<b>' + fmtBRL(tot + sEst) + ' no contrato</b> · líquido, já descontado' + (estL.length === 1 ? ' o estorno' : 's os estornos') + ' de ' + fmtBRL(-sEst) + ' (no fim da lista)' : fmtBRL(tot) + (cons ? ' no contrato' : ' nas pontes') + ' · quantidade somada por serviço; por grupo, só o valor') + '</div>';
    h += '<div class="sc-abc" aria-hidden="true">' + ['A', 'B', 'C'].filter(function (k) { return nk[k]; }).map(function (k) {
      return '<i class="' + k.toLowerCase() + '" style="flex:' + pc[k].toFixed(2) + ' 0 0"></i>';
    }).join('') + '</div>';
    h += '<div class="abc-res">' + ['A', 'B', 'C'].filter(function (k) { return nk[k]; }).map(function (k) {
      return '<span class="abc-tag ' + k.toLowerCase() + '"><b>' + k + '</b> ' + nk[k] + (nk[k] === 1 ? ' serviço' : ' serviços') + ' · ' + pct(pc[k]) + '</span>';
    }).join('') + '</div>';
    h += '<div class="seg an-modo" role="group" aria-label="Ordem dos serviços do contrato">' + [['grupo', 'Por grupo'], ['abc', 'Por valor (ABC)']].map(function (x) {
      return '<button type="button" data-act="serv-modo" data-v="' + x[0] + '" aria-pressed="' + (modo === x[0]) + '">' + x[1] + '</button>';
    }).join('') + '</div>';
    if (modo === 'abc') {
      var lc = ord.filter(function (t) { return t.k === 'C'; });
      h += '<div class="mg-lista sc-lista">' + ord.filter(function (t) { return t.k !== 'C'; }).map(linha).join('') +
        (lc.length ? '<details class="sc-c"><summary>Classe C: ' + lc.length + (lc.length === 1 ? ' serviço' : ' serviços') + ' · ' + pct(pc.C) + ' do valor</summary>' + lc.map(linha).join('') + '</details>' : '') + '</div>';
    } else {
      // capítulos do SIAC na ordem do relatório (1,0; 1,1; 2,0...)
      capL.sort(function (x, y) {
        var a = (x.key.match(/^cap:([\d,.]+)/) || [, ''])[1].split(/[,.]/).map(Number), b = (y.key.match(/^cap:([\d,.]+)/) || [, ''])[1].split(/[,.]/).map(Number);
        return (a[0] || 0) - (b[0] || 0) || (a[1] || 0) - (b[1] || 0);
      });
      h += '<div class="mg-lista">' + servicesOf(c).concat(capL, [MED_OUTROS, cons ? MED_SEMLOCAL : MED_ACESSO]).map(function (g) {
        var it = ord.filter(function (t) { return t.g === g.key; });
        if (!it.length) return '';
        var v = it.reduce(function (s, t) { return s + t.v; }, 0), ch = cid + '|' + g.key, ab = !!ui.grpAb[ch], ac = g === MED_ACESSO || g === MED_SEMLOCAL || g === MED_OUTROS;
        return '<div class="mg' + (ac ? ' acesso' : '') + '"><button type="button" class="mg-h" data-act="med-grp" data-id="' + esc(cid) + '" data-g="' + esc(g.key) + '" aria-expanded="' + ab + '">' +
          '<span class="mg-n"><b>' + esc(g.short) + '</b><span class="mg-s"><span class="mg-e nv">' + (ac ? (cons ? 'sem local nos segmentos · ' + it.length + (it.length === 1 ? ' serviço' : ' serviços') : 'meio de execução · fora da vistoria') : it.length + (it.length === 1 ? ' serviço' : ' serviços')) + '</span></span></span>' +
          '<span class="mg-t"><b>' + fmtBRL(v) + '</b><small>' + pct(v / tot * 100) + '</small></span>' + ICON_CHEV + '</button>' +
          '<div class="mg-b"' + (ab ? '' : ' hidden') + '>' + it.map(linha).join('') + '</div></div>';
      }).join('') + '</div>';
    }
    if (estL.length) h += '<div class="mg-lista f5-est"><div class="mg acesso"><div class="mg-h" style="cursor:default"><span class="mg-n"><b>Estornos</b><span class="mg-s"><span class="mg-e nv">' + estL.length + (estL.length === 1 ? ' serviço' : ' serviços') + ' · descontado' + (estL.length === 1 ? '' : 's') + ' do total</span></span></span>' +
      '<span class="mg-t"><b style="color:#B3261E">− ' + fmtBRL(-sEst) + '</b><small>fora da curva ABC</small></span><span></span></div><div class="mg-b">' + estL.map(function (t) {
        return '<div class="mg-svc"><div class="mg-l"><span class="mg-nm">' + esc(t.nome) + '<small class="sc-p">' + (t.pontes ? t.pontes + (t.pontes === 1 ? ' segmento' : ' segmentos') : 'sem local') + '</small></span><span class="mg-q"><b>' + fmtN(Math.round(t.q * 100) / 100) + ' <small>' + esc(unTxt(t.un)) + '</small></b><small style="color:#B3261E">− ' + fmtBRL(-t.v) + '</small></span></div></div>';
      }).join('') + '</div></div></div>';
    if (cons) return h + '<div class="an-rod">Todos os serviços da medição consolidada, inclusive os sem local (transportes, administração, canteiro). "Segmentos": em quantos a memória de cálculo localizou o serviço.</div></div>';
    var ks = Object.keys(cods).sort();
    h += '<div class="an-rod">Remoção de asfalto conta em Juntas (é medida junto com os berços); pintura epóxi, em Pintura.' +
      (ks.length ? ' Fora das listas: ' + (ks.length === 1 ? 'o item ' : 'os itens ') + esc(ks.join(' e ')) + ' do Anexo VI, estimados em ' + ks.map(function (k) { return cods[k]; }).join(' e ') + ' pontes, sem descrição e nunca medidos.' : '') + '</div>';
    return h + '</div>';
  }
  function etapasHtml(an, cob, E) {
    var h = '';
    var pChip = anPChip;
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
    if (!parte(c, 'med')) return '';   // sem as medições: nada aparece (ninguém fica sabendo o que outros acessos veem)
    var an = anOf(c), e = analise.estado[c.id];
    if (!an) {
      var t = e === 'carregando' || !e ? 'Carregando a análise das medições…' : e === 'erro' ? 'Não foi possível carregar a análise das medições agora. Ela volta a ser pedida quando você trocar de aba ou voltar ao app.' : 'Nenhuma análise das medições cadastrada para este contrato.';
      return '<div class="an-note">' + esc(t) + '</div>';
    }
    if (an.tipo === 'conserva') return analiseConsHtml(c, an);
    var r = an.resumo || {}, sobre = an.sobre || {}, E = etapaDe(an), ei = etapaInfo(an, E), cob = coberturaEtapas(c, an), nAl = 0, pAl = 0;
    c.pontos.forEach(function (p) { var k = alertasEm(an.pontes ? an.pontes[p.id] : null, E).length; nAl += k; if (k) pAl++; });
    var kp = [
      E ? ['Medido na ' + E + 'ª etapa', fmtBRL(ei.total || cob[E].v), ei.ns.length + ' medições · ' + ei.de + ' a ' + ei.ate + ' · ' + fmtBRL(cob[E].v) + ' nas pontes']
        : ['Medido a preços iniciais', fmtBRL(r.total), r.n + ' medições · ' + r.de + ' a ' + r.ate],
      ['Alertas para conferência', String(nAl), (pAl ? 'em ' + pAl + (pAl === 1 ? ' ponte · ' : ' pontes · ') : '') + 'ponte atendida mais de uma vez na mesma etapa, ou juntas refeitas em menos de 1 ano']
    ];
    if (E) kp.push(['Pontes atendidas', cob[E].atend + ' de ' + cob[E].total, cob[E].falta.length ? cob[E].falta.length + ' sem serviço nesta etapa' : 'todas tiveram serviço nesta etapa']);
    var h = '<section class="card an-card"><div class="an-head"><b>Análise das medições</b><span class="sub">' +
      (sobre.em ? 'atualizada em ' + esc(fmtIsoDate(sobre.em)) : '') + (isEng() ? ' · visível só para engenheiros, auxiliares de engenharia e o Administrador' : '') + '</span></div>';
    var ets = an.etapas || [];
    h += '<div class="an-jan"><span id="anEtTit">Mostrar</span><div class="seg an-etapas" role="group" aria-labelledby="anEtTit" style="grid-template-columns:repeat(' + (ets.length + 1) + ',minmax(0,1fr))">' +
      '<button type="button" data-act="an-etapa" data-v="0" aria-pressed="' + !E + '">Todas<small>' + esc((r.de || '') + ' a ' + (r.ate || '')) + '</small></button>' +
      ets.map(function (e) { return '<button type="button" data-act="an-etapa" data-v="' + e.etapa + '" aria-pressed="' + (E === e.etapa) + '">' + e.etapa + 'ª etapa<small>' + esc(e.de + ' a ' + e.ate) + '</small></button>'; }).join('') + '</div></div>';
    h += '<div class="an-kpis">' + kp.map(function (k) {
      return '<div class="an-kpi"><span>' + esc(k[0]) + '</span><b>' + esc(k[1]) + '</b><small>' + esc(k[2]) + '</small></div>';
    }).join('') + '</div>';
    h += medListaHtml(c, an, E);
    h += etapasHtml(an, cob, E);
    h += servContratoHtml(c, an, E);
    h += cmpResumoHtml(c, an);
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
  // resumo da conservação: o medido (todas ou uma etapa), quanto a memória de cálculo pôs nos segmentos, os segmentos por
  // medição, o valor de cada segmento, os serviços do contrato e os avisos da leitura (memória × medição, MP × despacho)
  function analiseConsHtml(c, an) {
    var r = an.resumo || {}, sobre = an.sobre || {}, E = etapaDe(an), ei = etapaInfo(an, E), ets = an.etapas || [], cob = an.cobertura || {};
    var ns = E ? ei.ns : (an.medicoes || []).map(function (m) { return m.n; }), et = {};
    (an.medicoes || []).forEach(function (m) { et[m.n] = m.etapa; });
    function locDe(l) { return l.reduce(function (t, n) { var x = cob[String(n)]; return t + (x ? Number(x[0]) || 0 : 0); }, 0); }
    var tot = E ? ei.total : r.total, loc = locDe(ns);
    var avs = (an.alertas || []).filter(function (x) { return !E || et[x.n] === E; }).sort(function (x, y) { return x.n - y.n; });
    var kp = [
      E ? ['Medido na ' + E + 'ª etapa', fmtBRL(tot), ei.ns.length + ' medições · ' + ei.de + ' a ' + ei.ate] : ['Medido a preços iniciais', fmtBRL(r.total), r.n + ' medições · ' + r.de + ' a ' + r.ate],
      ['Com local nos segmentos', tot ? pctTxt(loc / tot * 100) : '–', fmtBRL(loc) + ' pela memória de cálculo; o resto é transporte, administração e serviço sem km'],
      ['Avisos da leitura', String(avs.length), 'memória de cálculo que não fecha com a medição, ou MP diferente do despacho']
    ];
    var h = '<section class="card an-card"><div class="an-head"><b>Análise das medições</b><span class="sub">' + (sobre.em ? 'atualizada em ' + esc(fmtIsoDate(sobre.em)) : '') + '</span></div>';
    h += '<div class="an-jan"><span id="anEtTit">Mostrar</span><div class="seg an-etapas" role="group" aria-labelledby="anEtTit" style="grid-template-columns:repeat(' + (ets.length + 1) + ',minmax(0,1fr))">' +
      '<button type="button" data-act="an-etapa" data-v="0" aria-pressed="' + !E + '">Todas<small>' + esc((r.de || '') + ' a ' + (r.ate || '')) + '</small></button>' +
      ets.map(function (e) { return '<button type="button" data-act="an-etapa" data-v="' + e.etapa + '" aria-pressed="' + (E === e.etapa) + '">' + e.etapa + 'ª etapa<small>' + esc(e.de + ' a ' + e.ate) + '</small></button>'; }).join('') + '</div></div>';
    h += '<div class="an-kpis">' + kp.map(function (k) { return '<div class="an-kpi"><span>' + esc(k[0]) + '</span><b>' + esc(k[1]) + '</b><small>' + esc(k[2]) + '</small></div>'; }).join('') + '</div>';
    h += medListaHtml(c, an, E);
    if (!E) {
      h += '<div class="an-sec"><h4>Por etapa</h4>' + ets.map(function (e) {
        var l = locDe(e.ns);
        return '<button type="button" class="an-etrow" data-act="an-etapa" data-v="' + e.etapa + '"><span><b>' + e.etapa + 'ª etapa</b> · ' + esc(e.de + ' a ' + e.ate) + ' · ' + e.ns.length + ' medições · ' + fmtBRL(e.total) + '</span>' +
          '<small>' + fmtBRL(l) + ' nos segmentos (' + (e.total ? pctTxt(l / e.total * 100) : '–') + ')</small></button>';
      }).join('') + '</div>';
    }
    // valor de cada segmento no recorte, por km, com a barra proporcional ao maior
    var segs = sortedPoints(c).map(function (p) {
      var a = an.pontes && an.pontes[p.id], v = !a ? 0 : E ? (a.et && a.et[E] ? a.et[E].v : 0) : a.tot || 0;
      return { p: p, v: v };
    }), mx = segs.reduce(function (t, x) { return Math.max(t, x.v); }, 0);
    if (mx > 0) {
      h += '<div class="an-sec"><h4>Por segmento' + (E ? ' · ' + E + 'ª etapa' : '') + '</h4>' + segs.map(function (x) {
        var p = x.p, km = 'km ' + (p.kmIni != null ? fmtKm(p.kmIni) : '?') + ' – ' + (p.kmFim != null ? fmtKm(p.kmFim) : '?');
        return '<button type="button" class="an-prow an-segv" data-act="an-ir" data-id="' + esc(p.id) + '"><span><b>' + esc(p.nome || '?') + '</b><small>' + esc(km) + (p.descricao ? ' · ' + esc(p.descricao) : '') + '</small>' +
          '<span class="abc-bar"><i style="width:' + (x.v ? Math.max(1.5, x.v / mx * 100) : 0).toFixed(1) + '%"></i></span></span>' +
          '<span class="an-v"><b>' + fmtBRL(x.v) + '</b><small>' + (loc ? pctTxt(x.v / loc * 100) + ' do localizado' : '') + '</small></span></button>';
      }).join('') + '</div>';
    }
    h += servContratoHtml(c, an, E);
    if (avs.length) {
      h += '<details class="an-mais an-avs"><summary>Avisos da leitura das medições · ' + avs.length + '</summary>' + avs.map(function (x) {
        return '<div class="an-line"><b>' + esc(medTxt(an, x.n)) + '</b> · ' + esc(x.tipo === 'siac' ? 'SIAC × MP (para a fiscalização): ' : x.tipo === 'fiscal' ? 'para a fiscalização: ' : x.tipo === 'despacho' ? 'valor da MP × despacho: ' : 'memória de cálculo: ') + esc(x.motivo) + '</div>';
      }).join('') + '</details>';
    }
    if (parte(c, 'acomp')) h += cmpResumoHtml(c, an);
    if (sobre.fonte) h += '<div class="an-src">Fonte: ' + esc(sobre.fonte) + '.</div>';
    var notas = an.notas || [];
    if (notas.length) h += '<details class="an-notas"><summary>Como foi feita a análise</summary><ol>' + notas.map(function (n) { return '<li><b>' + esc(n.assunto) + '.</b> ' + esc(n.texto) + '</li>'; }).join('') + '</ol></details>';
    return h + '</section>';
  }

  function ponteHead(p, c) {
    var dots = servicesOf(c).map(function (s) {
      var sv = p.serv[s.key], k = oaeSt(sv), qt = comQtd(k) ? fmtQtd(s, sv.q) : '';
      var its = comQtd(k) ? itensDe(s.key, sv).map(function (x) { return minus1(x.n); }) : [];
      return '<span class="dot ' + k + '" title="' + esc(s.short + ': ' + oaeStOf(s, k).name + (qt ? ' · ' + qt : '') + (its.length ? ' · ' + its.join(', ') : '') + (comQtd(k) && sv.pri ? ' · prioridade' : '') + (comQtd(k) && sv.ci ? ' · conclusão informada' : '')) + '"></span>';
    }).join('');
    var n = oaeNec(p, c), nc = n.dn ? 'dn' : n.exec ? 'exec' : (!n.aval || n.nv === n.aval) ? 'nv' : 'ok', w = palavrasDe(c);
    var nt = n.dn ? n.dn + ' ' + (n.dn === 1 ? w.dano : w.danos) : n.exec ? 'em exec.' : nc === 'nv' ? '–' : w.semDanoCurto;
    var an = anOf(c), a = an && an.pontes ? an.pontes[p.id] : null;
    var np = banco.on ? propsDo(c.id, p.id).length : 0;
    var badge = (n.pri ? '<b class="pt-pri" title="' + n.pri + (n.pri === 1 ? ' grupo com prioridade' : ' grupos com prioridade') + '">!</b>' : '') +
      (function () { var k = alertasEm(a, etapaDe(an)).length; return k ? '<b class="pt-al" title="' + k + (k === 1 ? ' alerta' : ' alertas') + ' na análise das medições">' + k + '</b>' : ''; })();
    return '<span class="pt-name">' + esc(p.nome || '?') + (np ? '<span class="pt-prop" title="Alteração aguardando aprovação" aria-label="aguardando aprovação"></span>' : '') + '</span>' +
      '<span class="pt-km">' + badge + esc(p.codigo || '') + (p.kmIni != null ? (p.codigo ? ' · ' : '') + 'km ' + (p.kmConferir ? '~' : '') + fmtKm(p.kmIni) : '') + (a ? ultTagHtml(c, an, a) : '') + '</span><span class="pt-dots">' + dots + '</span><span class="pt-pct nec-' + nc + '" title="' + esc(oaeNecTxt(n, c)) + '">' + nt + '</span>' + ICON_CHEV;
  }

  function ponteCard(p, c) {
    var open = !!ui.open[p.id];
    var h = '<article class="pt oae' + (open ? ' open' : '') + '" data-id="' + esc(p.id) + '">';
    h += '<button type="button" class="pt-head" data-act="toggle-point" data-id="' + esc(p.id) + '" aria-expanded="' + open + '">' + ponteHead(p, c) + '</button>';
    if (open) {
      var id = esc(p.id), an = anOf(c), a = an && an.pontes ? an.pontes[p.id] : null;
      // com a análise (engenheiro, auxiliar, Administrador): duas abas, Vistoria e Medições. Sem ela (fiscal), só a vistoria
      var soMed = !parte(c, 'acomp');   // analista só com as medições: sem a vistoria
      var aba = a && (soMed || ui.aba[p.id] === 'med') ? 'med' : 'vist';
      if (soMed && !a) return h + '<div class="pt-body"><div class="an-note">' + (analise.estado[c.id] === 'carregando' ? 'Carregando as medições…' : 'Sem medições desta ponte.') + '</div></div></article>';
      h += '<div class="pt-body">' + (banco.on ? lastLine(metaKey(c.id, p.id)) : '');
      if (a && !soMed) h += '<div class="pt-abas" role="tablist" aria-label="Partes da ponte">' + [['vist', 'Vistoria'], ['med', 'Medições']].map(function (x) {
        return '<button type="button" role="tab" data-act="pt-aba" data-id="' + id + '" data-v="' + x[0] + '" aria-selected="' + (aba === x[0]) + '">' + x[1] + '</button>';
      }).join('') + '</div>';
      if (a) h += conferirHtml(c, p, an, a, aba);
      if (aba === 'med') return h + medicoesHtml(c, p, an, a) + '</div></article>';
      h += '<details class="pt-dados" data-id="' + id + '"' + (ui.dadosAb[p.id] ? ' open' : '') + '><summary>Dados da ponte <span>· nome, km, município, medidas</span></summary><div class="grid">';
      h += field('Nome da ponte', 'data-p="nome" data-id="' + id + '" type="text"', p.nome);
      h += field('Código (OAE)', 'data-p="codigo" data-id="' + id + '" type="text"', p.codigo);
      h += field('KM (SNV ' + ((window.SNV_BR230 && window.SNV_BR230.versao) || '') + ')' + (p.kmConferir ? ' · estimado, conferir em campo' : ''), 'data-p="kmIni" data-num="1" data-id="' + id + '" type="text" inputmode="decimal"', fmtKm(p.kmIni));
      h += field('KM do contrato (Anexo VI)', 'data-p="kmContrato" data-num="1" data-id="' + id + '" type="text" inputmode="decimal"', fmtKm(p.kmContrato));
      h += field('Município', 'data-p="municipio" data-id="' + id + '" type="text"', p.municipio);
      h += field('Extensão (m)', 'data-p="extensao" data-num="1" data-id="' + id + '" type="text" inputmode="decimal"', fmtN(p.extensao));
      h += field('Largura (m)', 'data-p="largura" data-num="1" data-id="' + id + '" type="text" inputmode="decimal"', fmtN(p.largura));
      h += '</div></details>';

      var vis = vistoriaPonte(c, p);
      h += '<div class="section-title">Estado da ponte' + (vis ? '<span class="sub-vis">última vistoria ' + esc(fmtWhen(vis.em)) + (vis.por ? ' · ' + esc(vis.por) : '') + '</span>' : '') + '</div>';
      // com a análise: a última medição de cada grupo (verde) ou "nunca medido"; o estado continua sendo o da vistoria.
      // O que pede conferência fica no "Para conferir" do alto; os alertas, na aba Medições
      h += servHtml(p, servicesOf(c), function (s) {
        if (!a) return '';
        var gi = a.grupos ? a.grupos[s.key] : null, u = gi && gi.ult, mm = u ? mesMed(an, u) : '';
        return u ? ' <span class="svc-ult" title="Última medição com este serviço nesta ponte">medido ' + esc(u + 'ª' + (mm ? ' · ' + mm : '')) + '</span>'
          : ' <span class="svc-ult nunca" title="Nenhuma medição com este serviço nesta ponte">nunca medido</span>';
      }, function (s, cur) {
        // medido sem execução: marca interna, gravada à parte (Banco.analiseMarcar), só para quem vê a análise.
        // Aparece com dano observado ou em execução (junto das outras marcas) ou se já estiver marcada
        var gi = a && a.grupos ? a.grupos[s.key] : null, mk = mneOf(an, p.id, s.key), med = mk ? mk.med : gi && gi.ult;
        if (!a || !an.marcas || !med || (!mk && !comQtd(cur))) return '';
        return '<button type="button" class="marca mne" data-act="an-mne" data-id="' + id + '" data-svc="' + s.key + '" data-med="' + esc(med) + '" aria-pressed="' + !!mk + '"' +
          ' title="' + esc('Uso interno: a ' + med + 'ª medição pagou este serviço, mas a vistoria não achou o serviço feito. Só aparece na folha com a análise.' + (mk && mk.por ? ' Marcado por ' + mk.por + '.' : '')) + '">' +
          '<i aria-hidden="true">✕</i>Medido sem execução · ' + esc(med) + 'ª</button>';
      }, '', a ? function (s, sv) { return itensMedHtml(an, a, s, sv); } : null);


      var tid = 'obs-' + id;
      h += '<div class="field"><label for="' + tid + '">Observações gerais</label><textarea id="' + tid + '" data-p="obs" data-id="' + id + '" rows="4">' + esc(p.obs) + '</textarea></div>';
      h += '<div class="pt-foot"><span class="pt-foot-l">' + (galeriaOn() ? '<button type="button" class="btn small" data-act="fotos-ponto" data-id="' + id + '">Fotos desta ponte</button>' : '') +
        '</span><button type="button" class="btn small danger" data-act="del-point" data-id="' + id + '">Excluir ponte</button></div>';
      h += '</div>';
    }
    return h + '</article>';
  }

  // ---------------- segmento da conservação (no molde da ponte): linha fechada, cartão aberto e a trafegabilidade
  // linha fechada, como no esboço do plano: nome e descrição; km Atualizado, km do contrato, extensão e código do SNV (com a
  // marca de prioridade na frente); as 7 bolinhas dos grupos; à direita, a trafegabilidade por extenso (o resumo dos grupos no title)
  // km do segmento na linha fechada: "km 301,30 – 311,30"; no 709 (kmSoContrato), o do contrato com o rótulo do cadastro
  // ("km da MP (SNV 2023–2025) 301,10 – 311,10"), sem o km do site
  function segKmTxt(c, p) {
    if (kmSoContrato(c)) return txtLimpo(c.rotuloKmContrato) + ' ' + (segContrTxt(c, p).replace(/^contr\. /, '') || '?');
    return 'km ' + (p.kmIni != null ? fmtKm(p.kmIni) : '?') + ' – ' + (p.kmFim != null ? fmtKm(p.kmFim) : '?');
  }
  function segHead(p, c) {
    if (!parte(c, 'acomp')) {   // analista da conservação: só o segmento, sem as bolinhas e a trafegabilidade da vistoria
      var kmA = segKmTxt(c, p), nomeA = (p.nome || '?') + (p.descricao ? ' · ' + p.descricao : '');
      var anA = anOf(c), aA = anA && anA.pontes ? anA.pontes[p.id] : null;
      return '<span class="pt-name" title="' + esc(nomeA) + '">' + esc(nomeA) + '</span><span class="pt-km">' + esc(kmA) + (aA ? ultTagHtml(c, anA, aA) : '') + '</span><span class="pt-dots"></span><span class="pt-pct"></span>' + ICON_CHEV;
    }
    var dots = servicesOf(c).map(function (s) {
      var sv = p.serv[s.key], k = oaeSt(sv), qt = comQtd(k) ? fmtQtd(s, sv.q) : '';
      return '<span class="dot ' + k + '" title="' + esc(s.short + ': ' + oaeStOf(s, k).name + (qt ? ' · ' + qt : '') + (comQtd(k) && sv.pri ? ' · prioridade' : '') + (comQtd(k) && sv.ci ? ' · conclusão informada' : '')) + '"></span>';
    }).join('');
    var n = oaeNec(p, c), kt = trafSt(p.serv[TRAFEG.key]), len = pointLen(p), contr = segContrTxt(c, p), snv = snvDoSegmento(p);
    var km = segKmTxt(c, p) + (contr && !kmSoContrato(c) ? ' (' + contr + ')' : '') +
      (len != null ? ' · ' + fmt(len, 2) + ' km' : '') + (snv ? ' · ' + snv : '');
    var np = banco.on ? propsDo(c.id, p.id).length : 0, nome = (p.nome || '?') + (p.descricao ? ' · ' + p.descricao : '');
    var anS = anOf(c), aS = anS && anS.pontes ? anS.pontes[p.id] : null;
    var badge = n.pri ? '<b class="pt-pri" title="' + n.pri + (n.pri === 1 ? ' grupo com prioridade' : ' grupos com prioridade') + '">!</b>' : '';
    return '<span class="pt-name" title="' + esc(nome) + '">' + esc(nome) + (np ? '<span class="pt-prop" title="Alteração aguardando aprovação" aria-label="aguardando aprovação"></span>' : '') + '</span>' +
      '<span class="pt-km" title="' + esc(km) + '">' + badge + esc(km) + (aS ? ultTagHtml(c, anS, aS) : '') + '</span><span class="pt-dots">' + dots + '</span>' +
      '<span class="pt-pct nec-' + (kt === 'NV' ? 'nv' : kt) + '" title="' + esc(oaeNecTxt(n, c)) + '">' + (kt === 'NV' ? '–' : TRAF_STATUS[kt].tag) + '</span>' + ICON_CHEV;
  }
  // cartão aberto (classe oae só pelo leiaute dos cartões das pontes; cons para as regras próprias): nome, descrição, extensão
  // (o 1º campo só de leitura, que refreshPointHead atualiza), km Atualizado, km do contrato e SNV (só de leitura, acompanham o
  // km); o estado com a trafegabilidade em cima dos grupos; observações; só "Excluir segmento" (sem "Duplicar")
  function segCard(p, c) {
    var open = !!ui.open[p.id];
    var h = '<article class="pt oae cons' + (open ? ' open' : '') + '" data-id="' + esc(p.id) + '">';
    h += '<button type="button" class="pt-head" data-act="toggle-point" data-id="' + esc(p.id) + '" aria-expanded="' + open + '">' + segHead(p, c) + '</button>';
    if (open) {
      var id = esc(p.id), len = pointLen(p), snvV = (window.SNV_BR230 && window.SNV_BR230.versao) || '', soK = kmSoContrato(c);
      var kmR = c.kmLocal ? ' · km local (' + (c.ramal || 'ramal') + ')' : soK ? ' · posição no eixo (não aparece nas folhas)' : ' · km Atualizado' + (snvV ? ' (SNV ' + snvV + ')' : '');
      // com as medições: abas Vistoria e Medições, como na ponte; o analista (sem o acompanhamento) vê só as medições
      var an = anOf(c), a = an && an.pontes ? an.pontes[p.id] : null, soMed = !parte(c, 'acomp');
      var aba = a && (soMed || ui.aba[p.id] === 'med') ? 'med' : 'vist';
      h += '<div class="pt-body">' + (banco.on && !soMed ? lastLine(metaKey(c.id, p.id)) : '');
      if (a && !soMed) h += '<div class="pt-abas" role="tablist" aria-label="Partes do segmento">' + [['vist', 'Vistoria'], ['med', 'Medições']].map(function (x) {
        return '<button type="button" role="tab" data-act="pt-aba" data-id="' + id + '" data-v="' + x[0] + '" aria-selected="' + (aba === x[0]) + '">' + x[1] + '</button>';
      }).join('') + '</div>';
      if (a && !soMed) h += conferirHtml(c, p, an, a, aba);
      if (aba === 'med') return h + medicoesHtml(c, p, an, a) + '</div></article>';
      if (soMed) {
        var eA = analise.estado[c.id];
        return h + '<div class="section-title">Medições deste segmento</div><div class="an-note">' + esc(!banco.on ? 'As medições aparecem com o banco da equipe ligado.' : eA === 'carregando' || !eA ? 'Carregando as medições…' :
          eA === 'erro' ? 'Não foi possível carregar as medições agora.' : an ? 'Nenhuma medição com serviço neste segmento.' : 'Nenhuma medição cadastrada para este contrato.') + '</div></div></article>';
      }
      h += '<div class="grid">';
      h += field('Nome', 'data-p="nome" data-id="' + id + '" type="text"', p.nome);
      h += field('Descrição (opcional)', 'data-p="descricao" data-id="' + id + '" type="text"', p.descricao);
      h += field('Extensão (calculada)', 'type="text" readonly tabindex="-1"', len != null ? fmt(len, 2) + ' km' : '');
      h += field('KM inicial' + kmR, 'data-p="kmIni" data-num="1" data-id="' + id + '" type="text" inputmode="decimal"', fmtKm(p.kmIni));
      h += field('KM final' + kmR, 'data-p="kmFim" data-num="1" data-id="' + id + '" type="text" inputmode="decimal"', fmtKm(p.kmFim));
      h += field(soK ? txtLimpo(c.rotuloKmContrato) : 'KM do contrato', 'data-segc="1" type="text" readonly tabindex="-1"', segContrTxt(c, p).replace(/^contr\. /, ''));
      h += field('Segmento do SNV', 'data-segsnv="1" type="text" readonly tabindex="-1"', snvDoSegmento(p));
      h += '</div>';
      var vis = vistoriaPonte(c, p);
      h += '<div class="section-title">Estado do segmento' + (vis ? '<span class="sub-vis">vistoria ' + esc(fmtWhen(vis.em)) + (vis.por ? ' · ' + esc(vis.por) : '') + '</span>' : '') + '</div>';
      // com a análise: a última medição de cada grupo neste segmento (verde) ou "nunca medido"
      h += servHtml(p, servicesOf(c), a ? function (s) {
        var gi = a.grupos ? a.grupos[s.key] : null, u = gi && gi.ult, mm = u ? mesMed(an, u) : '';
        return u ? ' <span class="svc-ult" title="Última medição com este serviço neste segmento">medido ' + esc(u + 'ª' + (mm ? ' · ' + mm : '')) + '</span>'
          : ' <span class="svc-ult nunca" title="Nenhuma medição com este serviço neste segmento">nunca medido</span>';
      } : null, null, trafHtml(p));
      if (isPavimentada(c)) h += desempHtml(p, c);
      var tid = 'obs-' + id;
      h += '<div class="field"><label for="' + tid + '">Observações gerais</label><textarea id="' + tid + '" data-p="obs" data-id="' + id + '" rows="4">' + esc(p.obs) + '</textarea></div>';
      h += '<div class="pt-foot"><span class="pt-foot-l"></span><button type="button" class="btn small danger" data-act="del-point" data-id="' + id + '">Excluir segmento</button></div>';
      h += '</div>';
    }
    return h + '</article>';
  }
  // bloco recolhido "Desempenho" do segmento (pista pavimentada): os 5 indicadores com Atende / Não atende; tocar de novo no
  // marcado volta a não vistoriado. O fiscal marca como nos grupos (cada indicador vira proposta do seu campo, serv.desemp_<indicador>)
  function desempHtml(p, c) {
    var id = esc(p.id), x = desempDe(p), pv = propServ(c.id, p.id), nv = 0, nn = 0;
    var linhas = DESEMP_IND.map(function (d) {
      var cur = x[d.k] === 'A' || x[d.k] === 'N' ? x[d.k] : '';
      if (!cur) nv++; else if (cur === 'N') nn++;
      var bts = ['A', 'N'].map(function (v) {
        var pend = pv[d.key] === v && cur !== v ? ' pend' : '';
        return '<button type="button" class="' + (v === 'A' ? 'OK' : 'DN') + pend + '" data-act="set-desemp" data-id="' + id + '" data-ind="' + d.k + '" data-v="' + v + '" aria-pressed="' + (cur === v) + '"' + (pend ? ' title="Aguardando aprovação"' : '') + '>' + DESEMP_ST[v] + '</button>';
      }).join('');
      return '<div class="svc oae des"><div class="svc-name">' + esc(d.n) + ' <small class="svc-un">peso ' + d.peso + '</small>' + (cur ? '' : ' <small class="svc-nv">não vistoriado</small>') + '</div>' +
        '<div class="seg" role="group" aria-label="' + esc(d.n) + '">' + bts + '</div></div>';
    }).join('');
    var sub = nv === DESEMP_IND.length ? 'não vistoriado' : (nn ? nn + (nn === 1 ? ' não atende' : ' não atendem') : 'todos atendem') + (nv ? ' · ' + nv + ' sem vistoria' : '');
    return '<details class="pt-dados pt-des" data-id="' + id + '"' + (ui.desAb[p.id] ? ' open' : '') + '><summary>Desempenho <span>· ' + esc(sub) + '</span></summary><div class="des-lista">' + linhas + '</div></details>';
  }
  // extensão atendida pela vistoria (resumo do contrato, só para quem vê as medições): por indicador, os km dos segmentos que
  // atendem sobre os km vistoriados; o fator é a média pelos pesos dos indicadores vistoriados (como o fator das MPs)
  function desempResumo(c) {
    var ind = DESEMP_IND.map(function (d) { return { d: d, at: 0, vis: 0 }; }), nseg = 0, nvis = 0, ext = 0, pesos = 0, soma = 0;
    c.pontos.forEach(function (p) {
      var len = pointLen(p), x = desempDe(p), algum = false;
      if (len == null) return;
      nseg++; ext += len;
      ind.forEach(function (o) { var v = x[o.d.k]; if (v === 'A' || v === 'N') { o.vis += len; algum = true; if (v === 'A') o.at += len; } });
      if (algum) nvis++;
    });
    ind.forEach(function (o) { if (o.vis > 0) { pesos += o.d.peso; soma += o.d.peso * o.at / o.vis; } });
    return { ind: ind, nseg: nseg, nvis: nvis, ext: ext, pesos: pesos, fator: pesos ? soma / pesos : null };
  }
  function desempResumoHtml(c) {
    if (!banco.on || !parte(c, 'med') || !c.pontos.length) return '';
    var r = desempResumo(c);
    var h = '<section class="card an-card des-card"><div class="an-head"><b>Desempenho pela vistoria</b><span class="sub">' +
      (r.nvis ? r.nvis + ' de ' + r.nseg + ' segmentos vistoriados' : 'nenhum segmento vistoriado') + ' · só para quem vê as medições</span></div>';
    if (r.fator != null) h += '<div class="des-fator"><b>' + fmt(r.fator, 2) + '</b><span>fator pela vistoria' + (r.pesos < 100 ? ' (só ' + r.pesos + ' dos 100 pontos de peso foram vistoriados)' : '') + '</span></div>';
    h += '<ul class="des-ind">' + r.ind.map(function (o) {
      return '<li><span>' + esc(o.d.n) + ' <small>peso ' + o.d.peso + '</small></span><span>' + (o.vis ? fmt(o.at, 1) + ' de ' + fmt(o.vis, 1) + ' km atendem' : 'sem vistoria') + '</span></li>';
    }).join('') + '</ul></section>';
    return h;
  }
  // trafegabilidade do segmento: Trafegável, Com restrição, Interrompido (tocar de novo desmarca) e a nota, sempre à vista e com
  // data-svcpct (o fiscal escreve); sem estimativa nem marcas. "pend" = proposta de um fiscal com outro estado
  function trafHtml(p) {
    var id = esc(p.id), sv = p.serv[TRAFEG.key] || { st: 'NV' }, cur = trafSt(sv), pv = propServ(active().id, p.id)[TRAFEG.key];
    var segs = TRAF_ORDER.map(function (k) {
      var pend = pv && pv.st === k && cur !== k ? ' pend' : '';
      return '<button type="button" class="' + k + pend + '" data-act="set-st" data-id="' + id + '" data-svc="' + TRAFEG.key + '" data-st="' + k + '" aria-pressed="' + (cur === k) + '"' + (pend ? ' title="Aguardando aprovação"' : '') + '>' + TRAF_STATUS[k].btn + '</button>';
    }).join('');
    return '<div class="svc oae traf"><div class="svc-name">' + esc(TRAFEG.short) + (cur === 'NV' ? ' <small class="svc-nv">sem vistoria</small>' : '') + '</div>' +
      '<div class="seg" role="group" aria-label="' + esc(TRAFEG.short) + '">' + segs + '</div>' +
      '<input class="svc-nota" type="text" maxlength="140" data-svcpct="' + TRAFEG.key + '" data-nota="1" data-id="' + id + '" value="' + esc(sv.n || '') + '" placeholder="Onde / o quê (opcional)" aria-label="Onde ou o quê: trafegabilidade">' +
      '</div>';
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
      h += '<div class="abc-filtro"><span>' + esc(temPor ? 'Só o que foi medido ' + nPt(an) + ' na ' + medTxt(an, med) + '.' : 'Serviços medidos na ' + medTxt(an, med) + ', com o total de cada um ' + nPt(an) + '.') +
        '</span><button type="button" class="btn small" data-act="abc-todas">' + (Ev ? 'A ' + Ev + 'ª etapa inteira' : 'Todas as medições · ' + fmtBRL(a.tot)) + '</button></div>';
      if (!sv.length) return h + '<div class="an-note">Nenhum serviço medido ' + nPt(an) + ' na ' + esc(medTxt(an, med)) + '.</div>';
    } else if (E) {
      h += '<div class="section-title">Serviços · Curva ABC · ' + E + 'ª etapa (' + esc(ei.de + ' a ' + ei.ate) + ')</div>';
      h += '<div class="abc-filtro"><span>' + esc(temPor ? 'Só o que foi medido ' + nPt(an) + ' na ' + E + 'ª etapa' + (comEst ? ', com o estimado do Anexo VI.' : '.') : 'Serviços medidos na ' + E + 'ª etapa, com o total de cada um ' + nPt(an) + '.') +
        '</span><button type="button" class="btn small" data-act="an-etapa" data-v="0">Todas as medições · ' + fmtBRL(a.tot) + '</button></div>';
      if (!sv.length) return h + '<div class="an-note">Nenhum serviço medido ' + nPt(an) + ' na ' + E + 'ª etapa.</div>';
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
        '<div class="abc-v" title="' + pct(x.pct) + ' do valor · acumulado ' + pct(x.ac) + '"><b>' + fmtN(x.s.q) + ' <span class="abc-un">' + esc(unTxt(x.s.un)) + '</span></b>' +
        '<small>' + fmtBRL(x.s.v) + ' · ' + pct(x.pct) + '</small>' +
        (comEst && x.s.est > 0 ? '<small' + (x.s.q > x.s.est ? ' class="an-over"' : '') + '>estimado ' + fmtN(x.s.est) + ' ' + esc(unTxt(x.s.un)) + '</small>' : '') + '</div></div>';
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
  // a análise da conservação é por segmento; a das pontes, por ponte
  function nPt(an) { return an && an.tipo === 'conserva' ? 'neste segmento' : 'nesta ponte'; }
  function dPt(an) { return an && an.tipo === 'conserva' ? 'deste segmento' : 'desta ponte'; }
  function medTxt(an, n) { var mm = mesMed(an, n); return n + 'ª' + (mm ? ' (' + mm + ')' : ''); }

  // ---------------- última medição da ponte, pontes por medição e medido × vistoriado
  // mês da medição como número (ano × 12 + mês). A idade da última medição da ponte é contada até a última medição do
  // contrato, não até hoje: a análise só vai até a medição mais recente que foi lida
  function medIdx(an, n) {
    var r = null;
    ((an && an.medicoes) || []).forEach(function (m) { if (m.n === Number(n) && /^\d{4}-\d{2}/.test(m.ref || '')) r = Number(m.ref.slice(0, 4)) * 12 + Number(m.ref.slice(5, 7)); });
    return r;
  }
  var ULT_REC = 2, ULT_MED = 6;   // verde até 2 meses antes da última do contrato, amarelo até 6, vermelho depois (ou nunca)
  function ultMedDe(an, a) {
    var ms = (an && an.medicoes) || [], fim = ms.length ? ms[ms.length - 1] : null, u = null;
    if (!fim) return null;
    ms.forEach(function (m) { if (a && a.meses && Number(a.meses[String(m.n)]) > 0) u = m; });
    var id = u ? medIdx(an, fim.n) - medIdx(an, u.n) : null;
    return { m: u, fim: fim, idade: id, cls: !u ? 'nunca' : !isFinite(id) || id <= ULT_REC ? 'rec' : id <= ULT_MED ? 'med' : 'ant' };
  }
  // etiqueta na linha da ponte: a última medição com serviço (cor pela idade) ou, com uma medição escolhida na lista,
  // o valor medido nela
  function ultTagHtml(c, an, a) {
    var g = medGlobalDe(c, an);
    if (g) {
      var v = Number(a.meses && a.meses[String(g)]) || 0;
      return v ? ' <span class="pt-ult u-sel" title="' + esc('Medido ' + nPt(an) + ' na ' + medTxt(an, g)) + '">' + esc(g + 'ª · ' + fmtBRLc(v)) + '</span>' : '';
    }
    var u = ultMedDe(an, a);
    if (!u) return '';
    var tip = !u.m ? 'Nenhuma medição com serviço ' + nPt(an) + '' : 'Última medição com serviço ' + nPt(an) + ': ' + medTxt(an, u.m.n) +
      (u.idade ? ', ' + u.idade + (u.idade === 1 ? ' mês' : ' meses') + ' antes da ' + medTxt(an, u.fim.n) + ', a última do contrato' : ', a última do contrato');
    return ' <span class="pt-ult u-' + u.cls + '" title="' + esc(tip) + '">' + esc(u.m ? 'Última ' + u.m.n + 'ª · ' + u.m.mes : an.tipo === 'conserva' ? 'Nunca medido' : 'Nunca medida') + '</span>';
  }
  // medição escolhida na lista (por contrato), se existir nesta análise
  function medGlobalDe(c, an) {
    var n = c && ui.medGlobal[c.id];
    return n && an && (an.medicoes || []).some(function (m) { return m.n === n; }) ? n : null;
  }
  // medição mostrada no cartão da ponte: a tocada no gráfico (null = todas) ou, sem toque, a escolhida na lista
  function medSelDe(pid) {
    if (Object.prototype.hasOwnProperty.call(ui.medSel, pid)) return ui.medSel[pid];
    var c = active();
    return medGlobalDe(c, anOf(c));
  }
  // resumo: seletor "Pontes por medição"; com uma escolhida, o total dela e quem entrou e saiu em relação à anterior
  function medListaHtml(c, an, E) {
    var ps = sortedPoints(c), g = medGlobalDe(c, an), sid = 'anMed-' + c.id, todas = an.medicoes || [];
    var ms = todas.filter(function (m) { return !E || m.etapa === E || m.n === g; }).slice().reverse();
    function medidas(n) { return ps.filter(function (p) { var a = an.pontes && an.pontes[p.id]; return a && Number(a.meses[String(n)]) > 0; }); }
    var fim = todas[todas.length - 1], cons = an.tipo === 'conserva', w1 = cons ? ' segmento' : ' ponte', wN = cons ? ' segmentos' : ' pontes';
    var h = '<div class="an-sec an-medsel"><h4><label for="' + sid + '">' + (cons ? 'Segmentos' : 'Pontes') + ' por medição</label></h4>' +
      '<select id="' + sid + '" data-anmed="1"><option value="">' + (cons ? 'Todos os segmentos' : 'Todas as pontes') + ', por km</option>' + ms.map(function (m) {
        var k = medidas(m.n).length;
        return '<option value="' + m.n + '"' + (g === m.n ? ' selected' : '') + '>' + esc(m.n + 'ª · ' + m.mes + ' · ' + k + (k === 1 ? w1 : wN)) + '</option>';
      }).join('') + '</select>';
    if (g) {
      var cur = medidas(g), ant = null;
      todas.forEach(function (m) { if (m.n < g && (!ant || m.n > ant.n)) ant = m; });
      var v = cur.reduce(function (t, p) { return t + (Number(an.pontes[p.id].meses[String(g)]) || 0); }, 0);
      var nal = cur.filter(function (p) { return (an.pontes[p.id].mx || []).indexOf(g) >= 0; }).length;
      h += '<div class="an-line"><b>' + cur.length + (cur.length === 1 ? w1 : wN) + '</b> com serviço na ' + esc(medTxt(an, g)) + ' · ' + fmtBRL(v) + ' n' + (cons ? 'os' : 'as') + wN +
        (nal ? ' · <span class="an-over">' + nal + ' com alerta</span>' : '') + '</div>';
      if (ant) {
        var pa = medidas(ant.n), idsC = cur.map(function (p) { return p.id; }), idsA = pa.map(function (p) { return p.id; });
        var entr = cur.filter(function (p) { return idsA.indexOf(p.id) < 0; }), sai = pa.filter(function (p) { return idsC.indexOf(p.id) < 0; });
        h += '<div class="an-line">Em relação à ' + esc(medTxt(an, ant.n)) + ': ' + (entr.length ? entr.length + (entr.length === 1 ? ' entrou' : ' entraram') : (cons ? 'nenhum entrou' : 'nenhuma entrou')) +
          ' · ' + (sai.length ? sai.length + (sai.length === 1 ? ' saiu' : ' saíram') : (cons ? 'nenhum saiu' : 'nenhuma saiu')) + '</div>';
        if (entr.length) h += '<div class="an-pchips"><span class="an-pch-l">Entraram</span>' + entr.map(anPChip).join('') + '</div>';
        if (sai.length) h += '<div class="an-pchips"><span class="an-pch-l">Saíram</span>' + sai.map(anPChip).join('') + '</div>';
      }
    } else if (fim) {
      h += '<div class="an-line an-ult-leg">Etiqueta de cada' + w1 + ': a última medição com serviço, contando até a ' + esc(medTxt(an, fim.n)) + ', a última do contrato. ' +
        '<span class="pt-ult u-rec">até ' + ULT_REC + ' meses</span> <span class="pt-ult u-med">' + (ULT_REC + 1) + ' a ' + ULT_MED + ' meses</span> ' +
        '<span class="pt-ult u-ant">mais de ' + ULT_MED + ' meses</span> <span class="pt-ult u-nunca">' + (cons ? 'nunca medido' : 'nunca medida') + '</span></div>';
    }
    return h + '</div>';
  }
  // medido × vistoriado de um grupo: só os casos para conferir. Dano observado num grupo que nenhuma medição pagou, ou
  // dano observado até 6 meses depois da medição que pagou o serviço (mês da vistoria do grupo; sem ela, a data da vistoria
  // do contrato)
  var CMP_MESES = 6;
  function vistIdx(c, p, key) {
    var x = banco.on && banco.meta[metaKey(c.id, p.id)], f = x && x.m && x.m['serv.' + key], d = f ? new Date(f.vist || f.em) : null;
    if (!d || !isFinite(d)) d = c.dataVistoria ? new Date(c.dataVistoria + 'T12:00:00') : null;
    return d && isFinite(d) ? d.getFullYear() * 12 + d.getMonth() + 1 : null;
  }
  // com itens marcados que têm serviço nas medições, a conferência é por item (o serviço daquele item), não pelo grupo inteiro
  function cmpGrupo(c, p, key, an, gi) {
    if (oaeSt(p.serv[key]) !== 'DN') return null;
    var aP = an.pontes && an.pontes[p.id], its = aP ? itensDe(key, p.serv[key]).filter(function (x) { return x.med; }) : [];
    if (its.length) {
      var viI = vistIdx(c, p, key), nunca = [], logo = null;
      its.forEach(function (x) {
        var u = ultItem(aP, key, x);
        if (!u) { nunca.push(minus1(x.n)); return; }
        var miI = medIdx(an, u), dI = viI != null && miI != null ? viI - miI : null;
        if (dI != null && dI >= 0 && dI <= CMP_MESES && (!logo || dI < logo.d)) logo = { d: dI, u: u, n: minus1(x.n) };
      });
      if (nunca.length) return { k: 'nunca', t: 'dano observado em ' + juntaE(nunca) + ' e nenhuma medição ' + (nunca.length === 1 ? 'deste item' : 'destes itens') + ' ' + nPt(an) + '' };
      if (logo) return { k: 'logo', t: 'dano observado em ' + logo.n + ' ' + (logo.d === 0 ? 'no mesmo mês da ' : logo.d + (logo.d === 1 ? ' mês' : ' meses') + ' depois da ') + medTxt(an, logo.u) + ', que mediu ' + logo.n };
      return null;
    }
    if (!gi || !gi.ult) return { k: 'nunca', t: 'dano observado e nenhuma medição deste serviço ' + nPt(an) + '' };
    var vi = vistIdx(c, p, key), mi = medIdx(an, gi.ult), d = vi != null && mi != null ? vi - mi : null;
    if (d == null || d < 0 || d > CMP_MESES) return null;
    return { k: 'logo', t: 'dano observado ' + (d === 0 ? 'no mesmo mês da ' : d + (d === 1 ? ' mês' : ' meses') + ' depois da ') + medTxt(an, gi.ult) + ', que mediu este serviço' };
  }
  // última medição (nº) do serviço que trata o item nesta ponte, só entre os serviços do mesmo grupo (g); 0 = nunca medido
  function ultItem(a, g, it) {
    var u = 0;
    ((a && a.servicos) || []).forEach(function (x) { if (x.v > 0 && x.g === g && it.med && it.med.test(x.nome || '')) medsNums(x.meds).forEach(function (n) { if (n > u) u = n; }); });
    return u;
  }
  function juntaE(l) { return l.length < 2 ? l.join('') : l.slice(0, -1).join(', ') + ' e ' + l[l.length - 1]; }
  // aba Vistoria (quem vê a análise): em que medição cada item marcado foi medido nesta ponte
  function itensMedHtml(an, a, s, sv) {
    var its = itensDe(s.key, sv).filter(function (x) { return x.med; });
    if (!its.length) return '';
    return '<div class="svc-it-med">' + its.map(function (x) {
      var u = ultItem(a, s.key, x);
      return '<span' + (u ? '' : ' class="nunca"') + '><b>' + esc(x.n) + '</b> ' + esc(u ? 'medido na ' + medTxt(an, u) : 'nunca medido ' + nPt(an) + '') + '</span>';
    }).join('') + '</div>';
  }
  // resumo: os grupos com dano observado que pedem conferência com as medições
  function cmpResumoHtml(c, an) {
    var rows = [];
    sortedPoints(c).forEach(function (p) {
      var a = an.pontes && an.pontes[p.id];
      if (!a) return;
      servicesOf(c).forEach(function (s) {
        var cm = cmpGrupo(c, p, s.key, an, a.grupos ? a.grupos[s.key] : null);
        if (cm) rows.push({ p: p, s: s, cm: cm });
      });
    });
    var h = '<div class="an-sec"><h4>Medido × vistoriado (' + rows.length + ')</h4>';
    if (!rows.length) return h + '<div class="empty">Nenhum grupo com dano observado sem medição ou até ' + CMP_MESES + ' meses depois de medido.</div></div>';
    return h + rows.map(function (r) {
      return '<button type="button" class="an-prow" data-act="an-ir" data-id="' + esc(r.p.id) + '"><span><b>' + esc(nomePonte(r.p) + ' · ' + r.s.short) + '</b><small>' + esc(r.cm.t) + '</small></span></button>';
    }).join('') + '</div>';
  }
  // nos textos que vêm prontos da análise: cada "Nª" de medição ganha o mês (etapa e o que já tem mês ficam como estão)
  function comMes(an, t) {
    return String(t == null ? '' : t).replace(/(\d+)ª(?!\s*(etapa|\(|saída))/g, function (x, n) { var mm = mesMed(an, n); return mm ? x + ' (' + mm + ')' : x; });
  }
  // topo de "Medições nesta ponte": "Todas as medições" com a soma, ou só os dados da medição escolhida no gráfico
  function topoHtml(an, a, med) {
    var ms = an.medicoes || [], m = null, h = '', k = String(med || ''), E = etapaDe(an);
    ms.forEach(function (x) { if (x.n === med) m = x; });
    var v = m ? Number(a.meses[k]) || 0 : 0;
    h += '<div class="an-esc"><button type="button" class="an-chip' + (!m && !E ? ' on' : '') + '" data-act="an-etapa" data-v="0" aria-pressed="' + (!m && !E) + '">Todas <b>' + fmtBRL(a.tot) + '</b></button>' +
      (an.etapas || []).map(function (e) {
        var on = !m && E === e.etapa, i = a.et && a.et[e.etapa];
        return '<button type="button" class="an-chip' + (on ? ' on' : '') + '" data-act="an-etapa" data-v="' + e.etapa + '" aria-pressed="' + on + '">' + e.etapa + 'ª etapa <b>' + fmtBRL(i ? i.v : 0) + '</b></button>';
      }).join('') + '</div>';   // a medição escolhida aparece entre ‹ ›, logo abaixo do gráfico
    if (m) {
      var sv = (a.servicos || []).filter(function (s) { return s.v > 0; }), temPor = sv.some(function (s) { return s.por; });
      var nsv = sv.filter(function (s) { return temPor ? !!(s.por && s.por[k]) : medsNums(s.meds).indexOf(m.n) >= 0; }).length;
      h += '<div class="an-line">' + (m.etapa ? esc(m.etapa) + 'ª etapa · ' : '') +
        (v ? nsv + (nsv === 1 ? ' serviço medido' : ' serviços medidos') + ' ' + nPt(an) + '' : 'sem serviço ' + nPt(an) + '') +
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
      if (!i || !i.ns.length) h += '<div class="an-line"><span class="an-over">Sem serviço ' + nPt(an) + ' na ' + E + 'ª etapa</span> (' + esc(ei.de + ' a ' + ei.ate) + ').</div>';
      else if (an.tipo === 'conserva') h += '<div class="an-line">' + i.ns.length + ' de ' + ei.ns.length + ' medições da ' + E + 'ª etapa com serviço ' + nPt(an) + ' (' + esc(ei.de + ' a ' + ei.ate) + ')</div>';
      else h += '<div class="an-line">' + (i.passagens.length > 1 ? '<span class="an-over">' + i.passagens.length + ' passagens</span>' : '1 passagem') + ': ' + esc(i.trechos.join(' · ')) +
        (i.passagens.length > 1 ? (i.gap != null ? ' · voltou em ' + i.gap + (i.gap === 1 ? ' mês' : ' meses') : '') + ' · <b>' + fmtBRL(i.rep) + '</b> depois da 1ª passagem' : '') + '</div>';
      return h + estL;
    }
    var ult = ms.filter(function (x) { return Number(a.meses[String(x.n)]) > 0; }).slice(-3).reverse();
    if (ult.length) h += '<div class="an-line">Últimas com serviço: ' + ult.map(function (x) { return x.n + 'ª (' + esc(x.mes) + ') ' + fmtBRL(Number(a.meses[String(x.n)])); }).join(' · ') + '</div>';
    return h + estL;
  }
  // ---------------- ponte em duas abas (Vistoria | Medições), só para quem vê a análise
  // "Para conferir": grupos com dano observado sem medição, ou observado até 6 meses depois da medição que pagou o serviço
  // (cmpGrupo). Aparece nas duas abas, com o atalho para a outra
  function conferirHtml(c, p, an, a, aba) {
    var rows = [];
    servicesOf(c).forEach(function (s) {
      var cm = cmpGrupo(c, p, s.key, an, a.grupos ? a.grupos[s.key] : null);
      if (!cm) return;
      var qt = fmtQtd(s, (p.serv[s.key] || {}).q);
      rows.push(s.short + ': ' + (qt ? cm.t.replace(/^dano observado/, 'dano observado (' + qt + ')') : cm.t) + '.');
    });
    if (!rows.length) return '';
    var outra = aba === 'med' ? 'vist' : 'med';
    return '<section class="pt-conf" aria-label="Para conferir"><b>Para conferir · ' + rows.length + '</b>' + rows.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') +
      '<button type="button" class="pt-conf-ir" data-act="pt-aba" data-id="' + esc(p.id) + '" data-v="' + outra + '">' + (outra === 'med' ? 'Ver nas Medições ›' : 'Ver na Vistoria ›') + '</button></section>';
  }
  // medições com serviço nesta ponte, na etapa mostrada (as que ‹ › percorrem)
  function medsComServ(an, a) {
    var E = etapaDe(an);
    return (an.medicoes || []).filter(function (m) { return Number(a.meses[String(m.n)]) > 0 && (!E || m.etapa === E); });
  }
  // aba Medições: escolha da medição (etapas, gráfico, ‹ ›), os serviços por grupo da vistoria (ou pela curva ABC) e os alertas
  function medicoesHtml(c, p, an, a) {
    var ms = an.medicoes || [], mx = {}, max = 0, h = '', sel = medSelDe(p.id) || null, E = etapaDe(an);
    (a.mx || []).forEach(function (n) { mx[n] = 1; });
    ms.forEach(function (m) { max = Math.max(max, Number(a.meses[String(m.n)]) || 0); });
    if (sel && !ms.some(function (m) { return m.n === sel; })) sel = null;
    h += '<div class="section-title">Medições ' + nPt(an) + '</div>';
    h += '<div class="an-topo">' + topoHtml(an, a, sel) + '</div>';
    var corte = -1;
    ms.forEach(function (m, i) { if (corte < 0 && i > 0 && m.etapa !== ms[i - 1].etapa) corte = i; });
    // cada barra é um botão: no celular não há "passar o mouse"; tocar escolhe a medição, tocar de novo volta ao total
    h += '<div class="an-graf"><div class="an-bars" role="group" aria-label="Valor medido ' + nPt(an) + ' em cada medição">' + ms.map(function (m, i) {
      var v = Number(a.meses[String(m.n)]) || 0, alt = v ? Math.max(4, Math.round(v / max * 100)) : 0, it = a.itens && a.itens[String(m.n)];
      var tip = m.n + 'ª medição (' + m.mes + ')' + (m.etapa ? ' · ' + m.etapa + 'ª etapa' : '') + (v ? ' · ' + fmtBRL(v) + (mx[m.n] ? ' · medição com alerta' : '') + (it ? ' · ' + it : '') : ' · sem serviço ' + nPt(an) + '');
      return '<button type="button" class="an-bar' + (i === corte ? ' corte' : '') + (v ? '' : ' zero') + (m.n === sel ? ' sel' : '') + (E && m.etapa !== E ? ' fora' : '') + '" data-act="med-bar" data-n="' + esc(m.n) + '" title="' + esc(tip) + '" aria-label="' + esc(tip) + '" aria-pressed="' + (m.n === sel) + '">' +
        '<i class="' + (v ? (mx[m.n] ? 'al' : 'on') : '') + '" style="height:' + alt + '%"></i></button>';
    }).join('') + '</div>';
    if (ms.length) {
      h += '<div class="an-axis"><span>' + esc(ms[0].mes) + '</span>' + (corte > 0 ? '<span>' + (ms[corte].etapa) + 'ª etapa a partir de ' + esc(ms[corte].mes) + '</span>' : '') + '<span>' + esc(ms[ms.length - 1].mes) + '</span></div>';
      h += '<div class="an-leg"><span><i class="on"></i>com serviço</span><span><i class="al"></i>medição com alerta</span></div>';
    }
    h += '</div>';
    // ‹ › pulam entre as medições com serviço nesta ponte; o meio mostra a escolhida e, tocado, volta ao total
    var com = medsComServ(an, a);
    if (com.length) {
      var vSel = sel ? Number(a.meses[String(sel)]) || 0 : 0, iE = E && a.et ? a.et[E] : null;
      var meio = sel ? esc(sel + 'ª · ' + mesMed(an, sel)) + ' · <b>' + (vSel ? fmtBRL(vSel) : 'sem serviço') + '</b>'
        : esc(E ? E + 'ª etapa' : 'Todas as medições') + ' · <b>' + fmtBRL(E ? (iE ? iE.v : 0) : a.tot) + '</b>';
      h += '<div class="an-nav"><button type="button" class="an-nav-s" data-act="med-nav" data-d="-1" aria-label="Medição com serviço anterior">‹</button>' +
        '<button type="button" class="an-nav-c' + (sel ? ' on' : '') + '" data-act="abc-todas"' + (sel ? ' title="Voltar ao total"' : ' disabled') + '>' + meio + '</button>' +
        '<button type="button" class="an-nav-s" data-act="med-nav" data-d="1" aria-label="Próxima medição com serviço">›</button></div>';
      h += '<div class="an-nav-t">‹ › pulam entre ' + (com.length === 1 ? 'a única medição' : 'as ' + com.length + ' medições') + ' com serviço' + (E ? ' na ' + E + 'ª etapa' : '') + (sel ? ' · o meio volta ao total' : '') + '</div>';
    }
    var modo = ui.medModo === 'abc' ? 'abc' : 'grupo';
    h += '<div class="seg an-modo" role="group" aria-label="Ordem dos serviços">' + [['grupo', 'Por grupo'], ['abc', 'Por valor (ABC)']].map(function (x) {
      return '<button type="button" data-act="med-modo" data-v="' + x[0] + '" aria-pressed="' + (modo === x[0]) + '">' + x[1] + '</button>';
    }).join('') + '</div>';
    h += '<div class="abc-box">' + (modo === 'abc' ? abcHtml(an, a, sel) : gruposMedHtml(c, p, an, a, sel)) + '</div>';
    if (an.tipo === 'conserva') {
      h += ocorrHtml(c, p, an, a, sel, E) + avisosSegHtml(an, a, sel, E);
      return h + '<div class="an-rod">' + esc((modo === 'grupo' ? 'Valores ' + (sel ? 'da ' + medTxt(an, sel) : E ? 'da ' + E + 'ª etapa' : 'de todas as medições') + ' em cada grupo' + (parte(c, 'acomp') ? '; o estado vem da aba Vistoria. ' : '. ') : 'Classe A/B/C pelo valor; a quantidade em destaque. ') +
        'O local vem da memória de cálculo de cada medição. Medição registra quantidade e valor; não comprova execução.') + '</div>';
    }

    var al = alertasEm(a, E).slice().sort(function (x, y) { return (y.rep != null ? y.rep : y.valor) - (x.rep != null ? x.rep : x.valor); });
    h += '<div class="section-title">Alertas da análise' + (E ? ' · ' + E + 'ª etapa' : '') + '</div>';
    if (!al.length) h += '<div class="empty">' + (E ? 'Nenhuma volta nesta etapa e nenhuma junta refeita em menos de 1 ano.' : 'Nenhuma etapa com mais de uma passagem e nenhuma junta refeita em menos de 1 ano.') + '</div>';
    al.forEach(function (x) {
      h += '<div class="an-al"><span class="an-sev alta">' + esc(x.tipo === 'atendimentos' ? x.etapa + 'ª etapa' : 'Juntas') + '</span>' +
        '<div><b>' + esc(x.servico) + '</b> · ' + esc(x.tipoNome || ALERTA_TXT[x.tipo] || x.tipo) + '<small>' + esc(x.motivo) +   // os trechos já vêm com os meses
        (x.gap != null ? ' · voltou em ' + x.gap + (x.gap === 1 ? ' mês' : ' meses') : '') + '</small></div>' +
        '<span class="an-v">' + (x.tipo === 'atendimentos' ? '<b>' + fmtBRL(x.rep) + '</b><small>depois da 1ª passagem</small>' : '<b>' + fmtBRL(x.valor) + '</b><small>juntas medidas</small>') + '</span></div>';
    });
    h += '<div class="an-rod">' + esc((modo === 'grupo' ? 'Valores ' + (sel ? 'da ' + medTxt(an, sel) : E ? 'da ' + E + 'ª etapa' : 'de todas as medições') + ' em cada grupo; o estado vem da aba Vistoria. ' : 'Classe A/B/C pelo valor; a quantidade em destaque. ') +
      'Medição registra quantidade e valor; não comprova execução.') + '</div>';
    return h;
  }
  // serviços medidos, nos grupos da vistoria (na ordem da aba Vistoria) e, por último, "Acesso e limpeza" (plataforma e jato,
  // que não são grupo da vistoria). Por grupo só se soma o valor; a quantidade fica em cada serviço
  var MED_ACESSO = { key: 'acesso', short: 'Acesso e limpeza' };
  var MED_SEMLOCAL = { key: 'semlocal', short: 'Transporte, administração e canteiro' };
  var MED_OUTROS = { key: 'outros', short: 'Sinalização, desvio, transporte e outros' };   // fora das linhas da vistoria (CT 267)   // conservação: sem local na memória
  function gruposMedHtml(c, p, an, a, med) {
    var pid = p.id, k = String(med || ''), E = med ? 0 : etapaDe(an), ei = E ? etapaInfo(an, E) : null, ms = an.medicoes || [], mMed = null;
    var base = (a.servicos || []).filter(function (s) { return s.v > 0; }), temPor = base.some(function (s) { return s.por; });
    ms.forEach(function (m) { if (m.n === med) mMed = m; });
    // medições abertas em cada serviço: as da etapa da medição escolhida, as da etapa mostrada ou todas
    var etF = med ? (mMed && mMed.etapa) || 0 : E;
    var faixa = ms.filter(function (m) { return !etF || m.etapa === etF; });
    function noRecorte(s) {
      if (med) {
        if (temPor) return s.por && s.por[k] ? { q: Number(s.por[k][0]) || 0, v: Number(s.por[k][1]) || 0 } : null;
        return medsNums(s.meds).indexOf(med) >= 0 ? { q: s.q, v: s.v, tot: true } : null;
      }
      if (E) { var x = noEscopo([s], ei.ns, temPor)[0]; return x ? { q: x.q, v: x.v, tot: !temPor } : null; }
      return { q: s.q, v: s.v };
    }
    var grupos = servicesOf(c).concat([MED_OUTROS, MED_ACESSO]).map(function (g) {
      var it = base.filter(function (s) { return s.g === g.key; }).sort(function (x, y) { return y.v - x.v; }).map(function (s) {
        var r = noRecorte(s); return r ? { s: s, q: r.q, v: r.v, tot: r.tot } : null;
      }).filter(Boolean);
      return { g: g, it: it, v: it.reduce(function (t, x) { return t + x.v; }, 0) };
    });
    if ((med || E) && !grupos.some(function (x) { return x.it.length; })) return '<div class="an-note">Nenhum serviço medido ' + nPt(an) + ' na ' + esc(med ? medTxt(an, med) : E + 'ª etapa (' + ei.de + ' a ' + ei.ate + ')') + '.</div>';
    // abre sozinho o grupo de maior valor no recorte; o que a pessoa abriu ou fechou fica como ela deixou
    var maior = null;
    grupos.forEach(function (x) { if (x.v > 0 && (!maior || x.v > maior.v)) maior = x; });
    var h = '<div class="mg-lista">';
    grupos.forEach(function (x) {
      var g = x.g, ac = g === MED_ACESSO || g === MED_OUTROS, gi = a.grupos ? a.grupos[g.key] : null, n = x.it.length, ch = pid + '|' + g.key;
      var ab = Object.prototype.hasOwnProperty.call(ui.grpAb, ch) ? ui.grpAb[ch] : x === maior;
      if (ac && !n && !(gi && gi.ult)) return;   // acesso e limpeza só aparece se a ponte já teve
      var est;
      if (ac) est = '<span class="mg-e nv">fora dos grupos da vistoria</span>';
      else if (!parte(c, 'acomp')) est = '';   // analista só das medições: sem o estado da vistoria
      else {
        var sv = p.serv[g.key], st = oaeSt(sv), qt = comQtd(st) ? fmtQtd(g, sv.q) : '';
        est = st === 'NV' ? '<span class="mg-e nv">sem vistoria</span>' : '<span class="mg-e ' + st.toLowerCase() + '">' + esc(oaeStOf(g, st).name + (qt ? ' ' + qt : '')) + '</span>';
      }
      var ult = gi && gi.ult ? '<span class="mg-u">última ' + gi.ult + 'ª</span>' : '<span class="mg-u nunca">nunca medido</span>';
      var vazio = gi && gi.ult && (med || E) ? 'Sem serviço deste grupo ' + (med ? 'na ' + medTxt(an, med) : 'na ' + E + 'ª etapa') + '; a última medição com ele foi a ' + medTxt(an, gi.ult) + '.'
        : 'Nenhuma das ' + ms.length + ' medições pagou serviço deste grupo ' + nPt(an) + '.';
      h += '<div class="mg' + (ac ? ' acesso' : '') + (n ? '' : ' vazio') + '">' +
        '<button type="button" class="mg-h" data-act="med-grp" data-id="' + esc(pid) + '" data-g="' + esc(g.key) + '" aria-expanded="' + ab + '">' +
        '<span class="mg-n"><b>' + esc(g.short) + '</b><span class="mg-s">' + est + ult + '</span></span>' +
        '<span class="mg-t"><b>' + (n ? fmtBRL(x.v) : '—') + '</b><small>' + (n ? n + (n === 1 ? ' serviço' : ' serviços') : med ? 'nada nesta medição' : E ? 'nada nesta etapa' : 'sem medição') + '</small></span>' + ICON_CHEV + '</button>' +
        '<div class="mg-b"' + (ab ? '' : ' hidden') + '>' + (n ? x.it.map(function (y) { return svcMedHtml(an, y, med, faixa, etF, temPor); }).join('') : '<div class="mg-vazio">' + esc(vazio) + '</div>') + '</div></div>';
    });
    return h + '</div>';
  }
  // um serviço na aba Medições: quantidade em destaque, valor pequeno; embaixo, cada medição da faixa com este serviço (a
  // escolhida em negrito), o total da etapa e, só na 1ª etapa, o estimado do Anexo VI (o edital só traz a 1ª)
  function svcMedHtml(an, y, med, faixa, etF, temPor) {
    var s = y.s, un = esc(unTxt(s.un)), h = '<div class="mg-svc"><div class="mg-l"><span class="mg-nm">' + esc(s.nome) + '</span>' +
      '<span class="mg-q"><b>' + fmtN(y.q) + ' <small>' + un + '</small></b><small>' + fmtBRL(y.v) + '</small></span></div>';
    if (!temPor) return h + (y.tot ? '<small class="mg-obs">total ' + dPt(an) + '; esta análise não separa por medição</small>' : '') + '</div>';
    var rows = faixa.filter(function (m) { return s.por && s.por[String(m.n)]; });
    var tq = 0, tv = 0;
    rows.forEach(function (m) { var x = s.por[String(m.n)]; tq += Number(x[0]) || 0; tv += Number(x[1]) || 0; });
    var est = etF === EST_ETAPA && s.est > 0;
    if (rows.length > 1 || est) {
      h += '<div class="mg-det">' + (rows.length > 1 ? rows.map(function (m) {
        var on = m.n === med ? ' on' : '';
        return '<span class="' + on + '">' + esc(medTxt(an, m.n)) + '</span><span class="n' + on + '">' + fmtN(Number(s.por[String(m.n)][0]) || 0) + ' ' + un + '</span>';
      }).join('') + '<span class="tt">' + esc(etF ? 'Total na ' + etF + 'ª etapa' : 'Total, todas as medições') + '</span><span class="n tt">' + fmtN(tq) + ' ' + un + ' <small>' + fmtBRL(tv) + '</small></span>' : '') +
        (est ? '<span class="es">Estimado no Anexo VI (' + EST_ETAPA + 'ª etapa)</span><span class="n es' + (tq > s.est ? ' an-over' : '') + '">' + fmtN(s.est) + ' ' + un + '</span>' : '') + '</div>';
    }
    return h + '</div>';
  }

  // ---------------- conservação: as ocorrências da memória de cálculo (onde cada serviço foi medido, km a km)
  // Ficam na tabela analise_ocorr (migração 14, decisão D-9), lidas por segmento (o trecho de km dele) só quando alguém
  // abre a lista; não ficam guardadas no aparelho. Cada ocorrência: [medição, código do serviço, km inicial, km final
  // (km Atualizado), lado, quantidade, local, página da memória]
  var anOcorr = {}, OC_MAX = 300;   // anOcorr["cid|pid"] = { estado: carregando | ok | erro, cred, ki, kf, l }
  function ocKey(c, p) { return c.id + '|' + p.id; }
  // a lista guardada só vale para a mesma sessão e o mesmo trecho de km
  function ocorrDe(c, p) {
    var x = anOcorr[ocKey(c, p)];
    return x && banco.login && x.cred === banco.login.codigo && x.ki === p.kmIni && x.kf === p.kmFim ? x : null;
  }
  function carregarOcorr(c, p) {
    if (!c || !p || p.kmIni == null || p.kmFim == null || !banco.on || !banco.login || !window.Banco || !window.Banco.analiseOcorr) return;
    var x = ocorrDe(c, p);
    if (x && x.estado !== 'erro') return;
    var k = ocKey(c, p), cred = banco.login.codigo, cid = c.id, pid = p.id;
    anOcorr[k] = { estado: 'carregando', cred: cred, ki: p.kmIni, kf: p.kmFim };
    function refaz() { if (!visaoOn && active() && active().id === cid && ui.open[pid] && ui.ocAb[pid] && !typing()) refazPonte(pid); }
    // o primeiro e o último segmento também levam o que a memória mediu antes ou depois deles (fora do contrato pela régua),
    // como na conta dos valores por segmento da análise
    var ki = p.kmIni, kf = p.kmFim, segs = sortedPoints(c).filter(function (q) { return q.kmIni != null && q.kmFim != null; });
    if (segs.length && !segs.some(function (q) { return q.kmIni < p.kmIni; })) ki = -1e5;
    if (segs.length && !segs.some(function (q) { return q.kmFim > p.kmFim; })) kf = 1e5;
    var ler = window.Banco.medicoesOcorr ? window.Banco.medicoesOcorr(cred, cid, ki, kf).catch(function (e) {
      if (e && (e.pg === 'PGRST202' || e.status === 404)) return window.Banco.analiseOcorr(cred, cid, ki, kf);
      throw e;
    }) : window.Banco.analiseOcorr(cred, cid, ki, kf);
    ler.then(function (r) {
      if (!anOcorr[k] || anOcorr[k].cred !== cred) return;
      anOcorr[k] = { estado: 'ok', cred: cred, ki: p.kmIni, kf: p.kmFim, l: Array.isArray(r) ? r : [] };
      refaz();
    }, function () { if (anOcorr[k] && anOcorr[k].cred === cred) anOcorr[k].estado = 'erro'; refaz(); });
  }
  // ocorrências do segmento (o banco já devolve só as que tocam o trecho, por km), no recorte da medição ou da etapa
  function ocorrSeg(x, an, sel, E) {
    var et = {};
    (an.medicoes || []).forEach(function (m) { et[m.n] = m.etapa; });
    return x.l.filter(function (o) { return sel ? o[0] === sel : !E || et[o[0]] === E; });
  }
  function ocorrHtml(c, p, an, a, sel, E) {
    var ab = !!ui.ocAb[p.id], x = ocorrDe(c, p), h = '<details class="an-oc" data-id="' + esc(p.id) + '"' + (ab ? ' open data-cheio="1"' : '') + '><summary>Onde foi medido · km a km' +
      '<span>' + esc(sel ? medTxt(an, sel) : E ? E + 'ª etapa' : 'todas as medições') + '</span></summary>';
    if (!ab) return h + '</details>';
    if (!x) { carregarOcorr(c, p); x = ocorrDe(c, p); }   // aberta antes (ui.ocAb) e ainda sem a lista desta sessão e deste trecho
    if (!x && (p.kmIni == null || p.kmFim == null)) return h + '<div class="an-note">Informe o km inicial e o final do segmento para ver as ocorrências.</div></details>';
    if (!x || x.estado === 'carregando') return h + '<div class="an-note">Carregando as ocorrências da memória de cálculo…</div></details>';
    if (x.estado === 'erro') return h + '<div class="an-note">Não foi possível carregar agora. <button type="button" class="btn small" data-act="oc-retry" data-id="' + esc(p.id) + '">Tentar de novo</button></div></details>';
    var l = ocorrSeg(x, an, sel, E), sv = {}, arq = an.memorias || {};
    // pelo id (o mesmo código em dois grupos vira 93776-1, 93776-2) e, sem id igual, pelo código
    (an.servicos || []).forEach(function (s) { sv[s.id || s.cod] = s; });
    (an.servicos || []).forEach(function (s) { if (s.cod && !sv[s.cod]) sv[s.cod] = s; });
    if (!l.length) return h + '<div class="an-note">Nenhuma ocorrência ' + esc(nPt(an)) + ' ' + esc(sel ? 'na ' + medTxt(an, sel) : E ? 'na ' + E + 'ª etapa' : 'nas medições') + '.</div></details>';
    h += '<div class="an-line">' + l.length + (l.length === 1 ? ' ocorrência' : ' ocorrências') + (l.length > OC_MAX ? ' · as ' + OC_MAX + ' primeiras por km; escolha uma medição no gráfico para ver só ela' : '') + '</div>';
    var soK = kmSoContrato(c);
    h += '<div class="an-oc-t">' + l.slice(0, OC_MAX).map(function (o) {
      // 709: o km escrito na MP, que a carga guarda no local ("km MP 603,54–603,26 (SNV 2020–2022)"), vai para a coluna do km e sai
      // do local (sem repetir); o km do site (o[2], o[3]) fica só por trás
      var mp = soK ? /km MP ([\d.,–-]+) \((SNV [^)]+)\)/.exec(o[6] || '') : null, loc = o[6];
      var s = sv[o[1]] || {}, km = mp ? mp[1].replace('–', ' – ') : o[3] != null && o[3] !== o[2] ? fmtKm(o[2]) + ' – ' + fmtKm(o[3]) : fmtKm(o[2]);
      if (mp) loc = o[6].replace(mp[0], '').replace(/;\s*;/g, ';').replace(/^\s*;\s*|\s*;\s*$/g, '').trim();
      var tip = 'Memória de cálculo da ' + medTxt(an, o[0]) + (arq[o[0]] ? ': ' + arq[o[0]] : '') + (o[7] ? ', pág. ' + o[7] : '') + (mp ? ' · km da MP no ' + mp[2] : '') + (o[3] != null && o[3] !== o[2] ? ' · a quantidade é a da linha inteira da memória' : '');
      return '<div class="an-oc-r" title="' + esc(tip) + '"><span class="km">' + (mp ? 'km MP ' : 'km ') + esc(km) + (mp ? ' <small>(' + esc(mp[2]) + ')</small>' : '') + (o[4] ? ' <small>' + esc(o[4]) + '</small>' : '') + '</span>' +
        '<span class="sv">' + esc(s.nome || o[1]) + (loc ? ' <small>' + esc(loc) + '</small>' : '') + '</span>' +
        '<span class="q"><b>' + fmtN(o[5]) + ' <small>' + esc(unTxt(s.un)) + '</small></b><small>' + esc(o[0] + 'ª · ' + mesMed(an, o[0])) + '</small></span></div>';
    }).join('') + '</div>';
    return h + '<div class="an-rod">' + (c.kmLocal ? 'km local (' + esc(c.ramal || '') + '), da estaca da memória (km = estaca x 0,02); a estaca vai no local.' :
      soK ? 'km MP: o escrito na memória de cálculo de cada medição (SNV 2020–2022 até a 18ª MP, SNV 2023–2025 da 19ª em diante).' : 'km Atualizado, passado do km da memória pela régua do contrato.') + ' Trecho que passa do segmento aparece com a quantidade da linha inteira.</div></details>';
  }
  // avisos da leitura das medições que tocam o segmento: a memória de cálculo não fecha com o que a medição pagou
  function avisosSegHtml(an, a, sel, E) {
    var et = {};
    (an.medicoes || []).forEach(function (m) { et[m.n] = m.etapa; });
    var l = (an.alertas || []).filter(function (x) {
      if (x.tipo !== 'memoria' || (sel ? x.n !== sel : E && et[x.n] !== E)) return false;
      return (a.servicos || []).some(function (s) { return s.cod === x.cod && s.por && s.por[String(x.n)]; });
    });
    if (!l.length) return '';
    return '<details class="an-mais an-avs"><summary>Avisos da leitura · ' + l.length + '</summary>' + l.map(function (x) {
      return '<div class="an-line"><b>' + esc(medTxt(an, x.n)) + '</b> · ' + esc(x.motivo) + '</div>';
    }).join('') + '<div class="an-rod">Quando a memória soma mais que o medido, as quantidades dos segmentos foram reduzidas na mesma proporção.</div></details>';
  }

  // ------------------------------------------------------------------ interface: pré-visualização
  var previewTimer = null, viewer = null;
  // digitando em Pontos (com o Diagrama e o Mapa escondidos): só marca; o desenho é refeito ao abrir o Diagrama ou o Mapa
  var previewSujo = false;
  function schedulePreview() {
    clearTimeout(previewTimer);
    if (pgAtivo() && pg !== 'diagrama' && pg !== 'mapa') { previewSujo = true; return; }
    previewTimer = setTimeout(renderPreview, 120);
  }
  // lista do seletor "Páginas": automático (padrão do contrato) ou de 1 folha até 1 ponto por folha
  var pagesCtlSig = '';
  function renderPagesCtl(c) {
    var sel = $('selPages'), n = c ? c.pontos.length : 0;
    if (!sel) return;
    sel.closest('label').hidden = view === 'mapa' || !!(c && isConserva(c));   // como em setView; as folhas da conservação são as de folhasConserva, sem escolha
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
  // conferido pela medição (medido = vistoriado até a data da medição): a última medição com serviço no segmento ou ponte
  // (an.pontes[pid].meses, o mesmo dado da aba Medições) e a última do contrato. Só para quem vê as medições.
  var MES_C = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  function mesIdx(ref) { var m = /^(\d{4})-(\d{2})(?:-|$)/.exec(String(ref || '')); return m && +m[2] >= 1 && +m[2] <= 12 ? +m[1] * 12 + +m[2] - 1 : null; }
  function mesCurto(i) { return i == null ? '' : MES_C[i % 12] + '/' + String(Math.floor(i / 12)).slice(-2); }
  function numMed(v) { if (typeof v === 'number') return v; var s = String(v == null ? '' : v).trim(); if (!s) return 0; if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.'); return Number(s) || 0; }
  function anConf(c) { return c && banco.on && banco.login && parte(c, 'med') && analise.dados[c.id] && analise.estado[c.id] !== 'vazia' ? analise.dados[c.id] : null; }
  function refMed(an, n) { var m = (an.medicoes || []).filter(function (x) { return x.n === n; })[0]; return m ? mesIdx(m.ref) : null; }
  function medDoPonto(c, p) {
    var an = anConf(c), x = an && an.pontes && an.pontes[p.id], ms = x && x.meses, ult = null;
    if (!ms) return null;
    Object.keys(ms).forEach(function (k) { var n = Number(k); if (numMed(ms[k]) > 0 && (ult == null || n > ult)) ult = n; });
    return ult == null ? null : { n: ult, mes: refMed(an, ult) };
  }
  function medDoContrato(c) {
    var an = anConf(c), ult = null;
    if (!an) return null;
    (an.medicoes || []).forEach(function (m) { if (ult == null || m.n > ult.n) ult = m; });
    if (!ult) return null;
    var i = mesIdx(ult.ref), d = new Date(), agora = d.getFullYear() * 12 + d.getMonth();
    return { n: ult.n, mes: i, txt: mesCurto(i), atraso: i == null ? 0 : Math.max(0, agora - 1 - i) };
  }
  // cor e situação de um ponto no mapa: concluído, parado, ativo ou sem atividade
  function pointInfo(p) {
    var dono = ownerOf(p);
    // pontes e segmentos da conservação: a situação pela vistoria (na conservação, "defeito" no lugar de "dano")
    if (isOae(dono) || isConserva(dono)) {
      // conferido: algum grupo marcado sem defeito na vistoria ou serviço medido ali (a marcação de campo, dano ou execução, vem antes)
      var n = oaeNec(p, dono), med = medDoPonto(dono, p), k = n.dn ? 'DN' : n.exec ? 'EX' : (n.ok || med) ? 'OK' : null, nt = oaeNecTxt(n, dono);
      var nomeK = !k ? 'Sem apontamento' : isConserva(dono) && k === 'OK' ? 'Sem defeito' : isConserva(dono) && k === 'DN' ? 'Defeito observado' : OAE_STATUS[k].name;
      var conf = k === 'OK' && med ? 'conferido na ' + med.n + 'ª med.' + (med.mes != null ? ' (' + mesCurto(med.mes) + ')' : '') : k === 'OK' && n.nv ? 'vistoria marcada' : '';
      return {
        color: k ? OAE_STATUS[k].fill : NO_STATUS.fill, status: nomeK, conf: conf,
        pctText: k === 'OK' ? conf : !k ? '' : nt === 'sem vistoria' || nt === palavrasDe(dono).semDano ? '' : nt,
        servs: servicesOf(dono).filter(function (s) { var x = oaeSt(p.serv[s.key]); return x !== 'NA' && x !== 'NV'; }).map(function (s) {
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
        var S = STATUS[s.st] || STATUS.NA;
        return { label: k.label, color: S.fill, text: S.name + (s.st === 'OK' ? '' : ' · ' + fmtPct(svcPct(s))) };
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
  // cópias que o app grava no cache do aparelho só para o compartilhar do sistema (PDF, .zip, fotos para a galeria): saem
  // depois de entregues; as que sobraram (app fechado no meio), ao abrir. Nunca mexe nas fotos da galeria do app (IndexedDB)
  var TEMP_KEY = 'diagrama-linear.temporarios';
  function tempLista() { var l = lsGet(TEMP_KEY); return Array.isArray(l) ? l : []; }
  function tempMarca(paths) { lsPut(TEMP_KEY, tempLista().concat(paths).slice(-500)); }
  function tempApaga(paths) {
    var P = window.Capacitor && window.Capacitor.Plugins;
    if (!P || !P.Filesystem) return Promise.resolve();
    return Promise.all(paths.map(function (p) { return P.Filesystem.deleteFile({ path: p, directory: 'CACHE' }).catch(function () { /* já saiu */ }); })).then(function () {
      lsPut(TEMP_KEY, tempLista().filter(function (p) { return paths.indexOf(p) < 0; }));
    });
  }
  function tempLimpar() { if (isNativeApp()) { var l = tempLista(); if (l.length) tempApaga(l); } }
  function nativeSave(name, blob) {
    var P = window.Capacitor && window.Capacitor.Plugins;
    if (!isNativeApp() || !P || !P.Filesystem || !P.Share) return null;
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(',')[1]); };
      r.onerror = function () { reject(r.error); };
      r.readAsDataURL(blob);
    }).then(function (b64) {
      tempMarca([name]);
      return P.Filesystem.writeFile({ path: name, data: b64, directory: 'CACHE' });
    }).then(function (res) {
      var fim = function () { tempApaga([name]); };
      return P.Share.share({ title: name, files: [res.uri] }).then(function (x) { fim(); return x; }, function (err) { fim(); throw err; });
    });
  }
  // várias fotos para a galeria do celular (Galeria › Baixar › Na galeria de fotos do celular): no app, o compartilhar do sistema
  // com os arquivos, até 30 por vez (no iPhone, "Salvar N imagens"); no navegador do celular, o compartilhar com arquivos, depois
  // de um toque. No computador a galeria monta o .zip (podeCompartilharFotos = false)
  function celular() { return isIOS() || /Android/i.test(navigator.userAgent); }
  function podeCompartilharFotos() {
    var P = window.Capacitor && window.Capacitor.Plugins;
    if (isNativeApp()) return !!(P && P.Filesystem && P.Share);
    if (!celular() || typeof File !== 'function') return false;
    return canShareFile(new File([new Blob(['x'], { type: 'image/jpeg' })], 'a.jpg', { type: 'image/jpeg' }));
  }
  function blobB64(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(',')[1]); };
      r.onerror = function () { reject(r.error); };
      r.readAsDataURL(blob);
    });
  }
  function salvarFotos(files, rotulo) {
    var P = window.Capacitor && window.Capacitor.Plugins;
    if (isNativeApp() && P && P.Filesystem && P.Share) {
      var partes = [];
      for (var i = 0; i < files.length; i += 30) partes.push(files.slice(i, i + 30));
      return partes.reduce(function (pr, parte, k) {
        return pr.then(function () {
          var paths = parte.map(function (f) { return 'fotos/' + f.name; });
          tempMarca(paths);
          return Promise.all(parte.map(function (f, j) {
            return blobB64(f.blob).then(function (b64) { return P.Filesystem.writeFile({ path: paths[j], data: b64, directory: 'CACHE', recursive: true }); });
          })).then(function (rs) {
            return P.Share.share({ title: rotulo + (partes.length > 1 ? ' (' + (k + 1) + ' de ' + partes.length + ')' : ''), files: rs.map(function (r) { return r.uri; }) });
          }).then(function () { tempApaga(paths); }, function (err) { tempApaga(paths); if (err && /cancel/i.test(err.message || String(err))) return; throw err; });
        });
      }, Promise.resolve());
    }
    var fs = files.map(function (f) { return new File([f.blob], f.name, { type: f.blob.type || 'image/jpeg' }); });
    offerShare(fs, rotulo);
    return Promise.resolve();
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
  function offerShare(file, rotulo) {
    var files = Array.isArray(file) ? file : [file];
    var old = document.getElementById('shareReady');
    if (old) old.remove();
    var bar = document.createElement('div');
    bar.id = 'shareReady';
    bar.className = 'share-ready';
    bar.setAttribute('role', 'status');
    bar.innerHTML = '<span></span><button type="button" class="btn primary">Salvar / compartilhar</button><button type="button" class="btn" aria-label="Fechar">×</button>';
    bar.querySelector('span').textContent = files.length > 1 ? files.length + ' fotos prontas' + (rotulo ? ': ' + rotulo : '') : 'Arquivo pronto: ' + files[0].name;
    var b = bar.querySelectorAll('button');
    b[0].addEventListener('click', function () {
      navigator.share({ files: files, title: rotulo || files[0].name }).then(function () { bar.remove(); }, function (err) {
        if (err && err.name === 'AbortError') return;
        bar.remove();
        files.forEach(function (f) { downloadLink(f.name, f); });
      });
    });
    b[1].addEventListener('click', function () { bar.remove(); });
    (document.fullscreenElement || document.body).appendChild(bar);
  }
  // no Safari do iPhone não há botão de instalar: mostra o caminho uma vez
  // fica no fim da lista do editor (não cobre os pontos nem a tela cheia), até a pessoa dispensar; nunca no app nem já instalado
  var ICON_INSTALAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m8 7 4-4 4 4"/><path d="M5 12v8h14v-8"/></svg>';
  function dicaInstalarHtml() {
    var standalone = navigator.standalone || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    if (!isIOS() || standalone || isNativeApp() || location.protocol !== 'https:') return '';
    try { if (localStorage.getItem('diagrama-linear.dica-instalar')) return ''; } catch (e) { return ''; }
    var ipad = /iPad/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return '<div class="dica-inst" role="note">' + ICON_INSTALAR + '<span><b>Use como app no ' + (ipad ? 'iPad' : 'iPhone') + '.</b> Toque em Compartilhar e depois em Adicionar à Tela de Início.</span>' +
      '<button type="button" data-act="dica-fechar" aria-label="Dispensar a dica">×</button></div>';
  }
  function saveText(name, text, mime) { return saveBlob(name, new Blob([text], { type: mime || 'text/plain' })); }
  var foto = null;
  function openFoto(pid, fotos) {
    if (!podeFotos()) { toast(banco.login ? 'Seu acesso não inclui fotos.' : 'Entre com o seu código para tirar fotos.'); return; }
    if (!foto && window.FotoCarimbo) {
      foto = window.FotoCarimbo({
        snv: window.SNV_BR230, logoSrc: window.UNIFILAR_LOGO && window.UNIFILAR_LOGO.src, nomes: NOMES,
        getContract: function () { var c = active(), l = ctsFoto(); return l.indexOf(c) >= 0 ? c : l[0] || null; },
        getContracts: ctsFoto,
        setActiveContract: function (id) {
          if (state.activeId === id || !state.contracts.some(function (c) { return c.id === id; })) return;
          state.activeId = id; ui.open = {}; save(); renderAll();
        },
        // no app instalado o compartilhar é o do próprio app (o WebView do Android não tem o da web), como na galeria
        gps: true, share: !!navigator.canShare || (isNativeApp() && podeCompartilharFotos()), saveBlob: saveBlob, notify: function (m, ms) { toast(m, ms); },
        compartilhar: isNativeApp() && podeCompartilharFotos() ? function (files, rotulo) { return salvarFotos(files, rotulo); } : null,
        drive: driveQ && {
          ready: driveReady,
          add: function (items) { return driveQ.add(items); },
          apagar: function (ids) { return driveQ.apagar(ids); },
          status: driveStatus,
          // a faixa da barra de baixo (várias fotos): a situação de cada foto mandada e o motivo da espera
          info: function () { return driveQ.info(); }, lista: function () { return driveQ.list(); }, logado: function () { return !!banco.login; },
          segurar: function (ids) { return driveQ.enviar(ids, false); },
          quem: function () { return banco.login ? { uid: banco.login.uid || null, nome: banco.login.nome || null } : null; }
        },
        // "Ver na galeria" da foto tirada: abre em No aparelho
        abrirGaleria: function () { if (galeriaOn()) abrirGaleria({ aba: 'local' }); },
        getTeamLogo: function () { return (banco.on && banco.cfg.fotoLogo) || null; },
        canSetTeamLogo: function () { return banco.on && isResp(); },
        setTeamLogo: function (v) { return saveTeamLogo({ t: 'config', chave: 'fotoLogo', valor: v }); },
        clearTeamLogo: function () { return saveTeamLogo({ t: 'apagar_config', chave: 'fotoLogo' }); }
      });
    }
    if (foto) foto.open({ pointId: pid || '', fotos: fotos || null });
  }
  function ensureMap() {
    if (mapa || !window.MapaSNV) return mapa;
    mapa = window.MapaSNV({
      host: $('mapHost'), snv: window.SNV_BR230, getContract: active, pointInfo: pointInfo, nomes: NOMES,
      saveText: saveText, tiles: true, gps: true, notify: function (m, ms) { toast(m, ms); }, onPhoto: openFoto,
      onOpen: abrirDoMapa, openLabel: function () { var c = active(); return 'Abrir em ' + (isConserva(c) ? 'Segmentos' : isOae(c) ? 'Pontes' : 'Pontos'); }
    });
    return mapa;
  }
  function pausaMapa() { if (mapa && mapa.pausa && mapa.pausa()) toast('Localização ao vivo desligada: você saiu do Mapa.'); }
  function setView(v) {
    var temM = !!(window.MapaSNV && window.L && window.SNV_BR230), cV = state && state.contracts.length ? active() : null;
    // fiscal: só o mapa (sem o diagrama)
    if (cV && !podeDiagrama(cV) && temM && podeMapa(cV)) v = 'mapa';
    view = v === 'mapa' && temM ? 'mapa' : 'diagrama';
    try { localStorage.setItem(VIEW_KEY, view); } catch (e) { /* sem armazenamento */ }
    var isMap = view === 'mapa';
    $('viewDiagrama').setAttribute('aria-pressed', String(!isMap));
    $('viewMapa').setAttribute('aria-pressed', String(isMap));
    $('pages').hidden = isMap;
    $('mapHost').hidden = !isMap;
    $('selPages').closest('label').hidden = isMap;
    $('folhaSw').classList.toggle('so-diagrama', isMap);
    $('btnWide').textContent = ui.wide ? 'Mostrar editor' : (isMap ? 'Ampliar mapa' : 'Ampliar diagrama');
    if (isMap && !$('layout').hidden && ensureMap()) { mapa.render(); mapa.show(); }
    if (!isMap && !pgAtivo()) pausaMapa();
    renderPreview();
  }
  function metaSituacao(c, tot) {
    if (!isOae(c)) return ' · avanço médio ' + fmtPct(tot.avg);
    var r = oaeResumo(c);
    return ' · ' + r.dn + (r.dn === 1 ? ' ponte com dano' : ' pontes com dano') + (r.exec ? ' · ' + r.exec + ' em execução' : '');
  }
  // o contrato na linha sob o desenho: os pontos ou as pontes e a situação; na conservação, a faixa ("122,00 km · 3 segmentos do SNV")
  // folha: o texto sob as folhas (na conservação com segmentos e com a folha de colunas, "12 segmentos de vistoria · 8 com defeito ·
  // " antes da faixa); sem folha, o do mapa, que fica como antes (os segmentos não aparecem no mapa)
  function metaItens(c, tot, folha) {
    if (isConserva(c)) {
      var n = c.pontos.length, dn = folha && n && FOLHAS_CONSERVA.indexOf('colunas') >= 0 ? oaeResumo(c).dn : -1;
      return (dn < 0 ? '' : n + (n === 1 ? ' segmento de vistoria · ' : ' segmentos de vistoria · ') + (dn ? dn + ' com defeito · ' : '')) + (faixaTexto(c) || 'sem o km inicial e o final');
    }
    return tot.n + (isOae(c) ? ' pontes' : ' pontos') + metaSituacao(c, tot);
  }
  function renderPreview() {
    previewSujo = false;
    if (medicoesOn) { desenhaMedicoes(); return; }
    if (visaoOn && visao && !$('visaoHost').hidden) { if (!desenhaVisao()) renderAll(); return; }
    var c = active(), tot = totals(c);
    if (view === 'mapa' && mapa) {
      mapa.render();
      $('previewMeta').textContent = 'Mapa pelo SNV/DNIT ' + window.SNV_BR230.versao + ' · ' + metaItens(c, tot);
      return;
    }
    var temAn = (isOae(c) || isConserva(c)) && !!anOf(c), sw = $('folhaSw');
    if (sw) {
      sw.hidden = !temAn || !parte(c, 'acomp');
      sw.querySelectorAll('[data-folha]').forEach(function (x) { x.setAttribute('aria-pressed', String((x.dataset.folha === 'vistoria') === folhaVistoria)); });
    }
    var sheets = renderSheets(c, temAn && folhaSoVist(c));
    renderPagesCtl(c);
    $('pages').innerHTML = sheets.map(function (svg, i) {
      return '<div class="sheet" aria-label="Página ' + (i + 1) + '">' + svg + (viewer ? '<button type="button" class="ler-btn" data-ler="' + i + '">' + ICON_LER + 'Abrir para ler</button>' : '') + '</div>';
    }).join('');
    $('previewMeta').textContent = sheets.length + (sheets.length === 1 ? ' página' : ' páginas') + ' · A3 paisagem · ' + metaItens(c, tot, true);
    if (viewer && viewer.isOpen()) viewer.update(sheets);
    pedeFolhasNav();
  }

  // sem código (ou sem nenhum contrato liberado): só a visão geral
  function soVisao() { return isPublico() || !state.contracts.length; }
  function renderAll() {
    if (medicoesOn && !temMedicoes()) { if (medicoes) medicoes.limpar(); medicoesOn = false; }
    // o link pode ter sido aberto antes de o banco devolver os contratos e as partes liberadas
    if (location.hash === '#medicoes' && temMedicoes()) { medicoesOn = true; visaoOn = false; }
    if (medicoes && !medicoesOn) medicoes.render();   // limpa o HTML escondido e poda contratos cujo acesso saiu
    if (soVisao() && window.VisaoGeral && $('visaoHost')) visaoOn = true;
    aplicaPapel();
    renderTabs();
    if (mostraVisao() && desenhaVisao()) return;
    if (medicoesOn && desenhaMedicoes()) return;
    // fiscal (sem o diagrama): a folha ao lado fica no mapa
    var cR = active();
    if (view !== 'mapa' && !podeDiagrama(cR) && podeMapa(cR) && temMapa()) setView('mapa');
    renderEditor();
    // o mapa criado (ou girado) com o layout escondido ficou com tamanho zero: mede de novo antes de desenhar
    if (view === 'mapa') { if (mapa) mapa.invalidate(); else ensureMap(); }
    renderPreview();
    if (view === 'mapa' && mapa) mapa.show();
  }

  // ------------------------------------------------------------------ visão geral (visao.js)
  // Todos os contratos numa rodovia só, em escala de km; só na tela. É a tela inicial: o app abre nela e, depois de
  // escolher um contrato, fica nele até fechar o app ou tocar em "Visão geral" (sessionStorage).
  var INICIO_KEY = 'diagrama-linear.no-contrato', visao = null;
  // Medições: no celular só o ícone (cifrão sobre a régua), para o nome do contrato aberto caber no botão ao lado
  var ICON_MED = '<svg class="tm-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 20h18"/><path d="M6 20v-3M10 20v-3M14 20v-3M18 20v-3"/><path d="M15 5.5c-.6-.9-1.7-1.5-3-1.5-1.7 0-3 1-3 2.3s1.3 1.9 3 2.2c1.7.3 3 1 3 2.3S13.7 13 12 13c-1.3 0-2.4-.6-3-1.5"/><path d="M12 2.5v1.5M12 13v1.5"/></svg>';
  var ICON_VISAO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 12h18M7 8v8M12 8v8M17 8v8"/></svg>';
  var visaoOn = (function () { try { return sessionStorage.getItem(INICIO_KEY) !== '1'; } catch (e) { return true; } })();
  function setVisao(on) {
    if (medicoesOn) { medicoesOn = false; hashMedicoes(false); }
    visaoOn = !!on;
    try { if (on) sessionStorage.removeItem(INICIO_KEY); else sessionStorage.setItem(INICIO_KEY, '1'); } catch (e) { /* sem armazenamento */ }
  }
  function ensureVisao() {
    if (visao || !window.VisaoGeral || !$('visaoHost')) return visao;
    visao = window.VisaoGeral({
      host: $('visaoHost'), contratos: function () { return state.contracts; }, nomes: NOMES, publico: isPublico,
      // sem código, o ponto vem só com o km: sem situação (cinza)
      info: function (p) { return isPublico() ? { status: '', color: '#5C6661', servs: [], pctText: '' } : pointInfo(p); }, isOae: isOae,
      // a última medição do contrato (cartão: "Conferido até a 48ª med. · ago/26"); quem não vê as medições: null
      medContrato: function (c) { return isPublico() ? null : medDoContrato(c); },
      temMapa: function () { return !!(window.MapaSNV && window.L && window.SNV_BR230) && !isPublico(); }, temFotos: galeriaOn,
      // 709 (kmSoContrato): os textos com o km das MPs; dos outros contratos, null (o km do site, como sempre)
      kmMp: function (c, k) { var r = kmSoContrato(c) ? kmDoContrato(c, k) : null; return r ? r.km : null; },
      onAbrir: function (c, p) { abrirDaVisao(c, p, false); },
      onMapa: function (c, p) { abrirDaVisao(c, p, podeMapa(c)); },
      onFotos: function (c, p) { abrirGaleria({ cid: c.id, pid: p.id }); },
      // erro num evento da visão (clique, busca, arrasto): mostra o contrato
      onErro: function (e) { console.error(e); visaoOn = false; renderAll(); }
    });
    return visao;
  }
  // um dado estranho não pode impedir a abertura nem travar a tela: se a visão falha, mostra o contrato
  function desenhaVisao() {
    // na tela inicial, as medições das conservações e pontes vêm junto (pintam o que a supervisão já conferiu); uma vez cada
    if (banco.login) state.contracts.forEach(function (c) { if ((isOae(c) || isConserva(c)) && !analise.estado[c.id]) carregarAnalise(c); });
    try { visao.render(); return true; } catch (e) {
      console.error(e);
      visaoOn = false; mostraVisao(); renderTabs();
      return false;
    }
  }
  function mostraVisao() {
    var vh = $('visaoHost'), on = visaoOn && !!vh && !!ensureVisao();
    if (on || medicoesOn) topoMini(false);
    $('layout').hidden = on || medicoesOn;
    if (vh) vh.hidden = !on;
    if ($('medicoesHost')) $('medicoesHost').hidden = !medicoesOn;
    // na visão não há contrato na tela: imprimir pegaria o contrato escondido. Fiscal e analista sem o acompanhamento: sem diagrama
    var semPdf = on || medicoesOn || !state.contracts.length || !podeDiagrama(active());
    $('btnPdf').hidden = semPdf;
    var pr = document.querySelector('#menuPop [data-act="print"]');
    if (pr) pr.hidden = semPdf;
    if ($('menuPdf')) $('menuPdf').hidden = semPdf;
    aplicaPg();
    return on;
  }
  // ------------------------------------------------------------------ medições (medicoes.js); só na tela, sem alterar as folhas
  var medicoes = null, medicoesOn = false;
  function temMedicoes() { return !!window.Medicoes && state.contracts.some(function (c) { return parte(c, 'med'); }); }
  function hashMedicoes(on) {
    try { history.replaceState(history.state, '', location.pathname + location.search + (on ? '#medicoes' : location.hash === '#medicoes' ? '' : location.hash)); } catch (e) { /* segue sem link */ }
  }
  function abrirMedicoes() {
    if (!temMedicoes()) return;
    state.contracts.forEach(function (c) { if (parte(c, 'med') && analise.estado[c.id] === 'erro') delete analise.estado[c.id]; });
    setVisao(false); medicoesOn = true; hashMedicoes(true);
    closeMenu(); renderAll(); syncTopbar(); window.scrollTo(0, 0);
  }
  function desenhaMedicoes() {
    if (!medicoesOn || !temMedicoes() || !$('medicoesHost')) return false;
    if (!medicoes) medicoes = window.Medicoes({
      host: $('medicoesHost'), contratos: function () { return state.contracts; }, pode: function (c) { return parte(c, 'med'); },
      ativa: function () { return medicoesOn && temMedicoes(); },
      base: function (c) { return parte(c, 'med') ? analise.dados[c.id] : null; }, analise: function (c) { return anOf(c, true); },
      estado: function (c) { return analise.estado[c.id]; },
      online: function () { return !!(banco.on && banco.login && window.Banco && window.Banco.analise); },
      carregar: function (c) { return carregarAnalise(c, true); },
      repetir: function (c) { if (parte(c, 'med') && analise.estado[c.id] === 'erro') delete analise.estado[c.id]; },
      nome: function (c) { return ctNumeroCT(c) || ctNome(c); }, grupoNome: function (c) { return NOME_PALAVRA[ctGrupo(c)]; },
      // 709 (kmSoContrato): o km das MPs (o do contrato pela régua) e o rótulo dele; nos outros, null (o km do site, como sempre)
      kmMp: function (c, k) { var r = kmSoContrato(c) ? kmDoContrato(c, k) : null; return r ? r.km : null; },
      kmRotulo: function (c) { return kmSoContrato(c) ? txtLimpo(c.rotuloKmContrato) : ''; }, pontos: sortedPoints, grupos: function (c) { return servicesOf(c).concat([MED_OUTROS, MED_ACESSO]); },
      esc: esc, fmtN: fmtN, dinheiro: function (v) { return v == null || !isFinite(v) ? '—' : 'R$ ' + fmt(v, 2); },
      medTxt: medTxt, etapaInfo: etapaInfo, unTxt: unTxt, semLocal: MED_SEMLOCAL, data: fmtIsoDate,
      diagrama: function (c) { if (parte(c, 'med')) abrirDaVisao(c, null, false); },
      // painel da ponte/segmento: o ponto no diagrama e as fotos dele (conservação: pelo km do segmento, as fotos não têm ponto)
      diagramaPonto: function (c, p) { if (parte(c, 'med')) abrirDaVisao(c, p, false); },
      fotos: function (c, p) {
        if (!galeriaOn() || ctsFoto().indexOf(c) < 0) return false;
        if (!p) return true;
        if (c.tipo === 'conserva') abrirGaleria({ cid: c.id, km: [Number(p.kmIni), Number(p.kmFim)], kmNome: p.nome || p.codigo || '' });
        else abrirGaleria({ cid: c.id, pid: p.id });
        return true;
      }
    });
    medicoes.render(); medicoes.carregar();
    return true;
  }
  // do cartão da visão geral para o contrato: abre o ponto no editor ou no mapa
  function abrirDaVisao(c, p, noMapa) {
    if (isPublico()) { toast('Entre com o seu código para abrir o contrato.', 5000); openLogin(); return; }
    setVisao(false);
    if (analise.estado[c.id] === 'erro') delete analise.estado[c.id];
    state.activeId = c.id;
    ui.open = {};
    if (p) ui.open[p.id] = true;
    save();
    renderAll();
    syncTopbar();   // o PDF voltou à barra, que pode ter mudado de altura: mede antes de rolar (o observer só avisa depois)
    if (noMapa) {
      setView('mapa');
      if (pgAtivo()) irPg('mapa');
      if (p && mapa && mapa.foco) setTimeout(function () { mapa.foco(p.id); }, 200);
      var mh = $('mapHost');
      if (mh && !pgAtivo()) mh.scrollIntoView({ block: 'start' });
    } else if (p) {
      if (pgAtivo()) irPg('pontos');
      if (ui.wide) toggleWide(false);
      scrollToPoint(p.id, pgAtivo());
    } else window.scrollTo(0, 0);
  }

  // ------------------------------------------------------------------ eventos do editor
  // nome na tela e pasta do Drive (só para leitura) acompanham o número e o lote digitados
  function syncNomes(c) {
    $('editor').querySelectorAll('[data-nomes]').forEach(function (el) {
      var k = el.getAttribute('data-nomes');
      if (k === 'sub') el.textContent = '· ' + ctNome(c);
      else el.value = k === 'pasta' ? ctPasta(c) : ctNome(c);
    });
  }
  // avisos do formulário e km do contrato dos marcos acompanham o que é digitado (objeto, km do contrato e do site, km do marco,
  // limites dos trechos, km e nome dos segmentos). Cada aviso pelo seu nome (data-aviso); um nome sem função fica como está
  var AVISOS = { km: avisoKm, objeto: avisoObjeto, trechos: avisoTrechos, segmentos: avisoSegmentosTxt };
  function syncAvisos(c) {
    var ed = $('editor');
    ed.querySelectorAll('[data-aviso]').forEach(function (el) {
      var f = AVISOS[el.getAttribute('data-aviso')];
      if (f) el.textContent = f(c);
    });
    ed.querySelectorAll('[data-segvazio]').forEach(function (el) { el.textContent = segVazioTxt(c); });
    ed.querySelectorAll('[data-mkc]').forEach(function (el) {
      var m = c.marcos[Number(el.getAttribute('data-mkc'))], mc = marcoContr(c, m ? m.km : null);
      el.textContent = mc.t; el.title = mc.g;
    });
  }
  function onInput(e) {
    var t = e.target, c = active();
    if (isFiscal() && !t.dataset.svcpct) return;
    // pontes por medição (análise das medições): só muda a tela
    if (t.dataset.anmed) {
      if (e.type !== 'change') return;
      var nm = Number(t.value) || null;
      if (nm) ui.medGlobal[c.id] = nm; else delete ui.medGlobal[c.id];
      ui.medSel = {};
      renderEditor();
      var sm = document.querySelector('[data-anmed]');
      if (sm) sm.focus();
      return;
    }
    // limites dos trechos: só ao sair do campo. Lista que não vale não grava (o aviso diz por quê); vazia apaga; não é vistoria
    if (t.dataset.trechos) {
      if (e.type !== 'change') return;
      var lt = trechosLer(t.value), vt = lt.erro ? null : lt.lista.length ? trechosValidos(c, lt.lista) : { ok: true };
      if (lt.erro || !vt.ok) { ui.trechosErro = lt.erro || vt.erro; syncAvisos(c); return; }
      ui.trechosErro = '';
      if (lt.lista.length) c.trechos = lt.lista; else delete c.trechos;
      t.value = trechosTxt(c.trechos);
      var tp = $('editor').querySelector('[data-trpad]');
      if (tp) tp.hidden = !!lt.lista.length;
      syncAvisos(c);
      save();
      schedulePreview();
      return;
    }
    // grupos só deste contrato (pista pavimentada): mudam a lista de grupos; não é vistoria
    if (t.dataset.gx) {
      if (e.type !== 'change') return;
      var gx = Array.isArray(c.gruposExtras) ? c.gruposExtras.slice() : [], gi = gx.indexOf(t.dataset.gx);
      if (t.checked && gi < 0) gx.push(t.dataset.gx); else if (!t.checked && gi >= 0) gx.splice(gi, 1);
      if (gx.length) c.gruposExtras = gx; else delete c.gruposExtras;
      gruposFaltam(c);
      save();
      renderAll();
      return;
    }
    if (t.dataset.c) {
      var k = t.dataset.c;
      // nº de outro contrato (como no "+ Contrato"): não grava; ao sair do campo, avisa e volta ao número de antes da edição
      if (k === 'numero') {
        if (t.dataset.antes == null) t.dataset.antes = c.numero || '';
        var dupN = numeroRepetido(t.value, c);
        if (e.type === 'change') {
          if (dupN) { toast('Já existe o ' + ctNome(dupN) + ' com este número.', 5000); t.value = t.dataset.antes; }
          delete t.dataset.antes;
        } else if (dupN) return;
      }
      if (t.dataset.num && QTD_CAMPO.test(k)) { c[k] = parseQtd(t.value); if (e.type === 'change') qtdSaida(t, c[k], true); }
      else if (t.dataset.num) c[k] = parseNum(t.value);
      else if (t.dataset.int) c[k] = clamp(parseInt(t.value, 10) || 9, 1, 14);
      else c[k] = t.value;
      if (k === 'numero' || k === 'lote') { renderTabs(); syncNomes(c); }
      // superfície da pista: outros grupos e outra folha (sem o campo, revestimento primário)
      if (k === 'superficie') {
        if (e.type !== 'change') return;
        if (c.superficie !== 'pavimentada' && c.superficie !== 'sinalizacao') delete c.superficie;   // sem a 2ª, a sinalização (709) se perderia
        gruposFaltam(c);
        save();
        renderAll();
        return;
      }
      if (/^(objeto|kmIni|kmFim|kmIniContrato|kmFimContrato|snvVersao)$/.test(k)) syncAvisos(c);
      if (isConserva(c) && e.type === 'change' && /^(kmIniContrato|kmFimContrato|snvVersao)$/.test(k)) c.pontos.forEach(refreshPointHead);
      // a aba da conservação vai pela posição no eixo
      if (isConserva(c) && e.type === 'change' && /^(kmIni|posEixo)$/.test(k)) renderTabs();
    } else if (t.dataset.marco != null && t.dataset.mf) {
      var m = c.marcos[Number(t.dataset.marco)];
      if (m) m[t.dataset.mf] = t.dataset.mf === 'km' ? parseNum(t.value) : t.value;
      if (m && t.dataset.mf === 'km') syncAvisos(c);
    } else if ((t.dataset.prazo != null || t.dataset.valor != null) && t.dataset.pf) {
      // prazos e valores (PI) da conservação: o item pela posição na lista; data vazia e "fim de" vazio = null
      var lsI = t.dataset.prazo != null ? 'prazos' : 'valores', it = (Array.isArray(c[lsI]) ? c[lsI] : [])[Number(t.dataset.prazo != null ? t.dataset.prazo : t.dataset.valor)], pf = t.dataset.pf;
      if (!it) return;
      it[pf] = pf === 'data' || pf === 'fim' ? t.value || null : pf === 'valor' ? parseValor(t.value) : t.value;
      // ao sair do campo, o valor aparece como ficou gravado; texto que não virou número avisa (e o campo fica vazio)
      if (pf === 'valor' && e.type === 'change') {
        if (it.valor == null && t.value.trim()) toast('Valor não entendido: digite só o número, como 1.500.000,00.', 5000);
        t.value = fmt(it.valor, 2);
      }
    } else if (t.dataset.p) {
      var p = findPoint(t.dataset.id);
      if (!p) return;
      if (t.dataset.num && QTD_CAMPO.test(t.dataset.p)) {
        p[t.dataset.p] = parseQtd(t.value);
        if (e.type === 'change') qtdSaida(t, p[t.dataset.p], !/^(extensao|largura)$/.test(t.dataset.p));
      } else p[t.dataset.p] = t.dataset.num ? parseNum(t.value) : t.value;
      if (isOae(c) && t.dataset.p === 'kmIni' && p.kmConferir) p.kmConferir = false;   // km corrigido à mão: já foi conferido
      if (isOae(c) && (t.dataset.p === 'kmIni' || t.dataset.p === 'extensao')) {
        p.kmFim = p.kmIni != null ? Math.round((p.kmIni + (Number(p.extensao) || 0) / 1000) * 1000) / 1000 : null;
      }
      refreshPointHead(p);
      // segmento: os avisos da lista (buraco, sobreposição, nome repetido) acompanham o km e o nome, sem refazer o editor
      if (isConserva(c) && /^(kmIni|kmFim|nome)$/.test(t.dataset.p)) syncAvisos(c);
    } else if (t.dataset.svcpct) {
      var p2 = findPoint(t.dataset.id);
      if (!p2) return;
      var sv2 = p2.serv[t.dataset.svcpct];
      if (!sv2) return;
      if (isContinuo(c)) {
        if (t.dataset.nota) { if (t.value.trim()) sv2.n = t.value; else delete sv2.n; }
        else if (t.dataset.svcpct === TRAFEG.key) return;   // a trafegabilidade só tem a nota
        else {
          var so = servicesOf(c).find(function (x) { return x.key === t.dataset.svcpct; }), q = parseNum(t.value);
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
    // prazo e valor não são vistoria; no segmento, nome, descrição, km e observações também não (só o que se viu: estado,
    // estimativa e nota, ramo data-svcpct)
    if (!t.dataset.c && t.dataset.marco == null && t.dataset.pf == null && !(isConserva(c) && t.dataset.p)) marcaVistoria(c);
    save();
    schedulePreview();
  }

  function onClick(e) {
    var tab = e.target.closest('[data-tab]');
    if (tab) {
      if (analise.estado[tab.dataset.tab] === 'erro') delete analise.estado[tab.dataset.tab];
      var veioDaVisao = visaoOn, daLista = !!tab.closest('#ctmPop');
      setVisao(false);
      state.activeId = tab.dataset.tab;
      ui.open = {};
      save();
      renderAll();
      if (veioDaVisao) window.scrollTo(0, 0);
      if (daLista) { var nb = document.querySelector('[data-act="ct-menu"]'); if (nb) nb.focus({ preventScroll: true }); }
      return;
    }
    var b = e.target.closest('[data-act]');
    if (!b) return;
    var act = b.dataset.act, c = active(), p;
    if (act === 'ct-menu') { ctMenu($('ctmPop') && $('ctmPop').hidden); return; }
    if (b.closest && b.closest('#ctmPop')) ctMenu(false);
    if (act === 'visao') { setVisao(true); renderAll(); window.scrollTo(0, 0); return; }
    if (act === 'medicoes') { abrirMedicoes(); return; }
    if (act === 'dica-fechar') {
      try { localStorage.setItem('diagrama-linear.dica-instalar', '1'); } catch (err) { /* sem armazenamento */ }
      var dica = b.closest('.dica-inst');
      if (dica) dica.remove();
      return;
    }
    if (act === 'login') { openLogin(); return; }
    if (readOnly() && EDIT_ACTS.indexOf(act) >= 0) { if (isAnalista()) { toast('Analista só consulta.'); return; } toast('Para editar, entre com o seu código.'); openLogin(); return; }
    if (isFiscal() && EDIT_ACTS.indexOf(act) >= 0 && act !== 'set-st' && act !== 'set-marca' && act !== 'set-item' && act !== 'set-desemp') { toast('Fiscal de campo só altera o status dos serviços.'); return; }
    if (act === 'prop-ok' || act === 'prop-no') { decidirPropostas([Number(b.dataset.prop)], act === 'prop-ok'); return; }
    if (act === 'fotos-ponto') { abrirGaleria({ cid: c.id, pid: b.dataset.id }); return; }
    // barra do gráfico: escolhe a medição (o topo e a curva ABC passam a ser só dela); tocar de novo, ou "Todas as medições", volta a todas
    if (act === 'med-bar' || act === 'abc-todas') {
      var art = b.closest('article.pt');
      if (!art) return;
      var pidSel = art.dataset.id, n = act === 'med-bar' ? Number(b.dataset.n) : null;
      if (n && medSelDe(pidSel) === n) n = null;
      ui.medSel[pidSel] = n;   // null = todas, mesmo com uma medição escolhida na lista
      refazPonte(pidSel, act === 'med-bar' ? '.an-bar[data-n="' + b.dataset.n + '"]' : '.an-nav-s[data-d="1"]');
      return;
    }
    // ‹ › da aba Medições: a medição com serviço anterior ou a seguinte (sem nenhuma escolhida, a última ou a primeira)
    if (act === 'med-nav') {
      var pidN = b.dataset.id || (b.closest('article.pt') || {}).dataset.id, anN = anOf(c), aN = anN && anN.pontes ? anN.pontes[pidN] : null;
      if (!aN) return;
      var comN = medsComServ(anN, aN).map(function (m) { return m.n; }), dN = Number(b.dataset.d), cur = medSelDe(pidN), j;
      if (!comN.length) return;
      if (!cur) j = dN > 0 ? 0 : comN.length - 1;
      else if (comN.indexOf(cur) >= 0) j = Math.max(0, Math.min(comN.length - 1, comN.indexOf(cur) + dN));
      else {   // a escolhida não teve serviço aqui: a próxima depois dela, ou a anterior antes dela
        var dep = comN.filter(function (x) { return dN > 0 ? x > cur : x < cur; });
        j = comN.indexOf(dep.length ? (dN > 0 ? dep[0] : dep[dep.length - 1]) : (dN > 0 ? comN[comN.length - 1] : comN[0]));
      }
      ui.medSel[pidN] = comN[j];
      refazPonte(pidN, '.an-nav-s[data-d="' + b.dataset.d + '"]');
      return;
    }
    // abas da ponte (Vistoria | Medições), ordem dos serviços na aba Medições e grupos abertos ou fechados
    if (act === 'item-outro') {
      var art0 = b.closest('.svc'), inp = art0 && art0.querySelector('input.svc-nota');
      if (inp) { inp.focus(); try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch (e) { /* sem seleção */ } }
      return;
    }
    if (act === 'pt-aba') {
      ui.aba[b.dataset.id] = b.dataset.v === 'med' ? 'med' : 'vist';
      refazPonte(b.dataset.id, '.pt-abas [data-v="' + ui.aba[b.dataset.id] + '"]');
      return;
    }
    if (act === 'med-modo') {
      var pidMo = (b.closest('article.pt') || {}).dataset.id;
      ui.medModo = b.dataset.v === 'abc' ? 'abc' : 'grupo';
      if (pidMo) refazPonte(pidMo, '.an-modo [data-v="' + ui.medModo + '"]');
      return;
    }
    if (act === 'serv-modo') {
      var secS = b.closest('.an-serv'), anS = anOf(c);
      ui.servModo = b.dataset.v === 'abc' ? 'abc' : 'grupo';
      if (secS && anS) {
        secS.outerHTML = servContratoHtml(c, anS, etapaDe(anS));
        var fS = document.querySelector('.an-serv [data-act="serv-modo"][data-v="' + ui.servModo + '"]');
        if (fS) try { fS.focus({ preventScroll: true }); } catch (e) { /* sem foco */ }
      }
      return;
    }
    if (act === 'med-grp') {
      var abG = b.getAttribute('aria-expanded') !== 'true', corpo = b.nextElementSibling;
      ui.grpAb[b.dataset.id + '|' + b.dataset.g] = abG;
      b.setAttribute('aria-expanded', String(abG));
      if (corpo) corpo.hidden = !abG;
      return;
    }
    // "Onde foi medido" que não carregou: lê de novo
    if (act === 'oc-retry') {
      var pr = findPoint(b.dataset.id);
      if (c && pr) { carregarOcorr(c, pr); refazPonte(pr.id, '.an-oc summary'); }
      return;
    }
    // etapa mostrada na análise (resumo e cartões das pontes); o PDF não muda
    if (act === 'an-etapa') {
      var ev = Number(b.dataset.v) || 0;
      ui.medSel = {};
      if (c) delete ui.medGlobal[c.id];
      if (ev !== etapaSel) { etapaSel = ev; lsPut(ETAPA_KEY, ev || null); }
      renderEditor();
      return;
    }
    // medido sem execução (uso interno): grava à parte, direto no banco (precisa de conexão); a tela muda na hora
    // e volta atrás se o banco recusar. Sem 'marcas' na análise, o banco ainda não tem a migração 07
    if (act === 'an-mne') {
      var rawM = c && analise.dados[c.id], pidM = b.dataset.id, gM = b.dataset.svc, medM = Number(b.dataset.med) || null;
      if (!rawM || !rawM.marcas || typeof rawM.marcas !== 'object' || !isEng() || !banco.on || !banco.login || !window.Banco || !window.Banco.analiseMarcar) return;
      var cidM = c.id, chM = cidM + '|' + pidM + '|' + gM, credM = banco.login.codigo;
      if (mnePend[chM]) { toast('Aguarde: a marca anterior ainda está sendo gravada.'); return; }
      if (analise.estado[cidM] === 'carregando') { toast('Aguarde: a análise está sendo atualizada.'); return; }
      // vale o que a pessoa viu no botão; se a análise mudou desde então, só refaz o cartão
      var antes = rawM.marcas[pidM] && rawM.marcas[pidM][gM] ? rawM.marcas[pidM][gM] : null, quer = b.getAttribute('aria-pressed') !== 'true';
      if (!!antes === quer) { var p0 = findPoint(pidM); if (p0) rerenderPoint(p0); return; }
      var novo = quer ? medM : null;
      if (!antes && !medM) return;
      // aplica na análise atual (pode ter sido lida de novo no meio), da mesma sessão; tela = refazer o cartão e a folha
      var poeM = function (v, tela) {
        var raw = banco.login && banco.login.codigo === credM ? analise.dados[cidM] : null, mks = raw && raw.marcas;
        if (!mks || typeof mks !== 'object') return;
        if (v) (mks[pidM] = mks[pidM] || {})[gM] = v;
        else if (mks[pidM]) { delete mks[pidM][gM]; if (!Object.keys(mks[pidM]).length) delete mks[pidM]; }
        anCache = { raw: null, view: null };
        lsPut(AN_KEY, { dados: analise.dados });
        if (tela && !visaoOn && active() && active().id === cidM) { var pp = findPoint(pidM); if (pp) rerenderPoint(pp); renderPreview(); }
      };
      var mAgora = function () { var raw = analise.dados[cidM], m = raw && raw.marcas && raw.marcas[pidM]; return m && m[gM] ? m[gM] : null; };
      poeM(novo ? { med: novo, por: banco.login.nome || '', em: new Date().toISOString() } : null, true);
      mnePend[chM] = 1;
      window.Banco.analiseMarcar(credM, cidM, pidM, gM, novo).then(function (r) {
        delete mnePend[chM];
        // gravou: confirma sem refazer a tela (não derruba o que a pessoa está digitando), a não ser que a tela
        // esteja diferente (a análise foi lida de novo antes de a gravação valer)
        var v = novo ? (r && r.med ? r : { med: novo, por: banco.login && banco.login.nome || '', em: new Date().toISOString() }) : null;
        poeM(v, !!mAgora() !== !!novo);
      }, function (err) {
        delete mnePend[chM];
        poeM(antes, true);
        toast(err && err.code === 'sem_rede' ? 'Sem conexão: a marca não foi gravada.' : 'Não foi possível gravar a marca (' + ((err && err.code) || 'erro') + ').', 5000);
        if (err && (err.code === 'codigo_invalido' || err.code === 'sem_permissao')) conferirAcesso();
      });
      return;
    }
    // lista das pontes: só as medidas numa medição (da maior para a menor) ou todas por km
    if (act === 'an-med') {
      var nv = Number(b.dataset.v) || null;
      if (nv) ui.medGlobal[c.id] = nv; else delete ui.medGlobal[c.id];
      ui.medSel = {};
      renderEditor();
      return;
    }
    if (act === 'ld-resumo') { ui.open = {}; ui.voltar = null; renderEditor(); return; }
    if (act === 'ld-voltar') { var vv = ui.voltar; ui.voltar = null; if (vv) voltarDe(vv); return; }
    // ponte citada no resumo da análise: abre o cartão dela
    if (act === 'an-ir') {
      var pidIr = b.dataset.id, anIr = anOf(c), gIr = medGlobalDe(c, anIr), aIr = anIr && anIr.pontes ? anIr.pontes[pidIr] : null;
      if (gIr && !(aIr && Number(aIr.meses[String(gIr)]) > 0)) delete ui.medGlobal[c.id];
      if (mdOn()) { ui.open = {}; ui.voltar = null; }
      ui.open[pidIr] = true;
      renderEditor();
      var alvo = document.querySelector('article.pt[data-id="' + (window.CSS && CSS.escape ? CSS.escape(pidIr) : pidIr) + '"]');
      if (alvo) alvo.scrollIntoView({ block: 'start' });
      return;
    }
    switch (act) {
      case 'toggle-contract':
        ui.contractOpen = !ui.contractOpen;
        renderEditor();
        return;
      case 'toggle-point':
        if (mdOn()) {
          var abre = !ui.open[b.dataset.id];
          ui.open = {}; ui.voltar = null;
          if (abre) ui.open[b.dataset.id] = true;
          renderEditor();
          var mr = document.querySelector('#editor .ld-r');
          if (mr) mr.scrollTop = 0;
          return;
        }
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
        // trafegabilidade do segmento: só T, R e I (tocar de novo volta a sem vistoria); a nota nunca é apagada (trafToque)
        if (b.dataset.svc === TRAFEG.key) {
          if (!isConserva(c) || TRAF_ORDER.indexOf(st) < 0) return;
          p.serv[TRAFEG.key] = trafToque(sv, st);
          rerenderPoint(p);
          break;
        }
        if (isConserva(c) && !OAE_STATUS[st]) return;   // estado da trafegabilidade num grupo: ignorado
        if (isContinuo(c)) {
          if (oaeSt(sv) === st) st = 'NV';   // tocar de novo no status marcado desmarca (volta para sem vistoria)
          // serviço contínuo: a estimativa, o "onde" e as marcas só valem com dano observado ou em execução
          delete sv.pct;
          if (!comQtd(st)) {
            // tinha o que perder: "Desfazer" por alguns segundos (um toque sem querer no celular apagava a anotação)
            var temDet = sv.q != null || (sv.n && String(sv.n).trim()) || sv.pri || sv.ci || (sv.itens && Object.keys(sv.itens).length);
            if (temDet) {
              var antes = JSON.parse(JSON.stringify(sv)), svK = b.dataset.svc, pId = p.id;
              offerUndo('A estimativa, a nota e os itens deste serviço saíram junto com a situação.', function () {
                var p2 = findPoint(pId);
                if (!p2 || !p2.serv) return;
                p2.serv[svK] = antes;
                rerenderPoint(p2);
                afterEdit('set-st', active());
              });
            }
            delete sv.q; delete sv.n; delete sv.pri; delete sv.ci; delete sv.itens;
          }
        } else if (st === 'OK') sv.pct = 100;
        else if (st === 'NA') sv.pct = 0;
        else if (sv.st === 'OK' || sv.st === 'NA') sv.pct = st === 'A' ? 50 : 0;
        sv.st = st;
        rerenderPoint(p);
        break;
      case 'set-desemp':
        p = findPoint(b.dataset.id);
        var dInd = DESEMP_IND.find(function (d) { return d.k === b.dataset.ind; }), dv = b.dataset.v;
        if (!p || !isPavimentada(c) || !dInd || !DESEMP_ST[dv]) return;
        if (p.serv[dInd.key] === dv) delete p.serv[dInd.key]; else p.serv[dInd.key] = dv;
        ui.desAb[p.id] = true;
        rerenderPoint(p);
        // o resumo do contrato (fora do cartão do segmento) acompanha
        var dc = document.querySelector('.des-card');
        if (dc) { var dh = desempResumoHtml(c); if (dh) dc.outerHTML = dh; else dc.remove(); }
        var fd = document.querySelector('.pt[data-id="' + CSS.escape(p.id) + '"] [data-act="set-desemp"][data-ind="' + dInd.k + '"][data-v="' + dv + '"]');
        if (fd) try { fd.focus({ preventScroll: true }); } catch (e) { /* sem foco */ }
        break;
      case 'set-marca':
        p = findPoint(b.dataset.id);
        if (!p) return;
        var svm = p.serv[b.dataset.svc], mk = b.dataset.m;
        if (b.dataset.svc === TRAFEG.key || !svm || !OAE_MARCAS[mk] || !comQtd(oaeSt(svm))) return;   // a trafegabilidade não tem marcas
        if (svm[mk]) delete svm[mk]; else svm[mk] = true;
        rerenderPoint(p);
        break;
      case 'set-item':
        p = findPoint(b.dataset.id);
        if (!p || !isOae(c)) return;
        var svi = p.serv[b.dataset.svc], ki = b.dataset.it;
        if (!svi || !itemDe(b.dataset.svc, ki) || !comQtd(oaeSt(svi))) return;
        var li = Array.isArray(svi.itens) ? svi.itens.slice() : [], ji = li.indexOf(ki);
        if (ji >= 0) li.splice(ji, 1); else li.push(ki);
        if (li.length) svi.itens = li; else delete svi.itens;
        rerenderPoint(p);
        var fi = document.querySelector('.pt[data-id="' + CSS.escape(p.id) + '"] [data-act="set-item"][data-svc="' + b.dataset.svc + '"][data-it="' + ki + '"]');
        if (fi) try { fi.focus({ preventScroll: true }); } catch (e) { /* sem foco */ }
        break;
      case 'add-point':
        var pts = sortedPoints(c), last = pts[pts.length - 1];
        var base = last && last.kmFim != null ? Math.round((last.kmFim + 1) * 100) / 100 : null;
        var serv = {};
        if (isConserva(c)) {
          // "+ Segmento" (o botão só existe com pelo menos um): no fim, contíguo ao que termina mais longe (kmNovoSegmento)
          if (!c.pontos.length) { toast('Para começar, grave os limites dos trechos e toque em Gerar segmentos.', 5000); return; }
          var kmN = kmNovoSegmento(c);
          p = segmentosDosTrechos([0, 0], uid, servicesOf(c))[0];
          p.nome = nomeNovoSegmento(c); p.kmIni = kmN.kmIni; p.kmFim = kmN.kmFim;
        } else if (isOae(c)) {
          servicesOf(c).forEach(function (s) { serv[s.key] = { st: 'NV' }; });
          p = { id: uid('pt'), nome: 'Nova ponte', codigo: 'OAE ' + String(c.pontos.length + 1).padStart(2, '0'), kmIni: null, kmFim: null, extensao: null, largura: null, municipio: '', serv: serv, disp: [], obs: '' };
        } else {
          servicesOf(c).forEach(function (s) { serv[s.key] = { st: 'P', pct: 0 }; });
          p = { id: uid('pt'), nome: 'P' + (c.pontos.length + 1), kmIni: base, kmFim: base != null ? base + 1 : null, enr: null, sb: null, serv: serv, disp: [], obs: '' };
        }
        c.pontos.push(p);
        ui.open = {}; ui.open[p.id] = true;
        renderEditor();
        scrollToPoint(p.id);
        break;
      case 'dup-point':
        p = findPoint(b.dataset.id);
        if (!p || isConserva(c)) return;   // segmento não tem "Duplicar"
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
      // conservação: os limites validados (437 e 438) no campo vazio, se batem com o km inicial e o final do contrato
      case 'preencher-trechos':
        var trP = trechosPadrao(c);
        if (!isConserva(c) || !trP) return;
        if (Array.isArray(c.trechos) && c.trechos.length) { toast('Os limites dos trechos já estão gravados.'); return; }
        var vP = trechosValidos(c, trP.slice());
        if (!vP.ok) { toast('A lista validada não bate com este contrato: ' + vP.erro, 6000); return; }
        c.trechos = trP.slice();
        renderEditor();
        break;
      // conservação: os segmentos pelos limites dos trechos (com confirmação e, com o banco, a conferência de outro aparelho)
      case 'gerar-segmentos':
        gerarSegmentos(c);
        return;
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
      // prazos e valores (PI) da conservação: o item novo nasce "a confirmar"; um toque na situação troca o grupo
      case 'add-prazo':
      case 'add-valor':
        var lsA = act === 'add-prazo' ? 'prazos' : 'valores';
        if (!Array.isArray(c[lsA])) c[lsA] = [];
        c[lsA].push(lsA === 'prazos' ? { rotulo: '', data: null, sit: 'prev', fim: null, fonte: '', nota: '' } : { rotulo: '', valor: null, sit: 'prev', data: null, fonte: '', nota: '' });
        renderEditor();
        break;
      case 'set-prazo-sit':
      case 'set-valor-sit':
        var lsS = act === 'set-prazo-sit' ? 'prazos' : 'valores', itS = (Array.isArray(c[lsS]) ? c[lsS] : [])[Number(b.dataset.idx)];
        if (!itS) return;
        itS.sit = itS.sit === 'conf' ? 'prev' : 'conf';
        renderEditor();
        break;
      case 'del-prazo':
      case 'del-valor':
        var lsD = act === 'del-prazo' ? 'prazos' : 'valores', itD = (Array.isArray(c[lsD]) ? c[lsD] : [])[Number(b.dataset.idx)], cidD = c.id;
        if (!itD) return;
        confirmar({ titulo: lsD === 'prazos' ? 'Remover o prazo?' : 'Remover o valor?', texto: (itD.rotulo || 'Sem rótulo') + (lsD === 'prazos' ? (itD.data ? ' · ' + fmtDate(itD.data) : '') : (itD.valor != null ? ' · ' + fmtPI(itD.valor) : '')) + '.', botao: 'Remover', perigo: true }).then(function (r) {
          // a lista pode ter mudado no meio (atualização do banco): acha o item de novo, pelo conteúdo (itemChave)
          var cc = contractById(cidD), arr = cc && Array.isArray(cc[lsD]) ? cc[lsD] : [], i = arr.indexOf(itD), kD = itemChave(itD);
          if (i < 0) i = arr.findIndex(function (x) { return itemChave(x) === kD; });
          if (!r || i < 0) return;
          arr.splice(i, 1);
          if (cc === active()) renderEditor();
          afterEdit(act, cc);
        });
        return;
      case 'new-contract':
        // o contrato nasce no envio da janela (lá, o afterEdit com o contrato novo)
        abrirNovoContrato(active());
        return;
      case 'del-contract':
        if (banco.on && !isAdmin()) { toast('Só o Administrador arquiva contratos.'); return; }
        if (state.contracts.length < 2) { toast('Este é o único contrato. Crie outro antes de ' + (banco.on ? 'arquivar' : 'excluir') + ' este.'); return; }
        if (banco.on) arquivarContrato(c); else excluirContrato(c);
        return;
      default:
        return;
    }
    afterEdit(act, c);
  }
  // na conservação, só marcar o estado conta como vistoria: gerar, acrescentar, excluir e desfazer a exclusão não contam
  function afterEdit(act, c) {
    if (isConserva(c) ? act === 'set-st' || act === 'set-marca' || act === 'set-desemp' : POINT_ACTS.indexOf(act) >= 0) marcaVistoria(c);
    save();
    schedulePreview();
  }
  // "Gerar segmentos": só num contrato de conservação sem segmentos e com os limites dos trechos válidos. Com o banco, depois da
  // confirmação, lê o banco antes de criar (outro aparelho pode ter acabado de gerar): sem resposta (banco.at não mudou, porque
  // refresh engole o erro), não cria. Na volta, acha o contrato de novo pelo id (refresh troca o estado) e confere outra vez
  function gerarSegmentos(c0) {
    var cid = c0.id;
    function recusa(c) {
      if (!c || !isConserva(c)) return 'Só os contratos de conservação têm segmentos.';
      if (c.pontos.length) return 'Este contrato já tem segmentos.';
      var v = trechosValidos(c);
      return v.ok ? '' : v.erro || 'Grave os limites dos trechos nos dados do contrato antes de gerar os segmentos.';
    }
    var e0 = recusa(c0);
    if (e0) { toast(e0, 6000); return; }
    var l0 = c0.trechos, n0 = l0.length - 1, ult = 'S' + String(n0).padStart(2, '0');
    confirmar({
      titulo: 'Gerar ' + n0 + (n0 === 1 ? ' segmento?' : ' segmentos?'),
      texto: 'De ' + fmtKm(l0[0]) + ' a ' + fmtKm(l0[n0]) + ', pelos limites dos trechos gravados no contrato (' + (n0 === 1 ? 'S01' : 'S01 a ' + ult) + '). ' +
        (n0 === 1 ? 'Ele começa' : 'Todos começam') + ' sem vistoria; a data da última vistoria não muda.',
      botao: 'Gerar'
    }).then(function (r) {
      if (!r) return;
      var antes = banco.at;
      (banco.on ? refresh(true) : Promise.resolve()).then(function () {
        if (banco.on && banco.at === antes) { toast('Sem sinal: conecte-se para gerar os segmentos (antes de criar, o app confere se outro aparelho já gerou).', 7000); return; }
        var c = contractById(cid);
        if (c && isConserva(c) && c.pontos.length) { toast('Os segmentos deste contrato já foram gerados em outro aparelho.', 6000); return; }
        var e = recusa(c);
        if (e) { toast(e, 6000); return; }
        c.pontos = c.pontos.concat(segmentosDosTrechos(c.trechos, uid, servicesOf(c)));
        ui.open = {};
        if (c === active() && !visaoOn) renderEditor();
        afterEdit('gerar-segmentos', c);
        // envia já (sem a espera de 1,2 s): enquanto os segmentos estão só neste aparelho, outro aparelho pode gerar de novo
        trackChanges(); scheduleFlush(0);
      });
    });
  }
  function contractById(id) { return state.contracts.find(function (x) { return x.id === id; }) || null; }

  // ---------------- "+ Contrato": a janela pede o tipo (não muda depois), o nº e o lote. Do contrato aberto (ref) vêm só o órgão,
  // a rodovia, a supervisora e o contrato dela, que são os mesmos, e a largura da plataforma, só de um contrato do mesmo tipo;
  // o objeto é de cada contrato (sai no relatório fotográfico). Pontos críticos ficam sem tipo, como o 314 e o 315
  function novoContrato(tipo, ref, numero, lote) {
    var t = tipoDe(tipo), cons = t === 'conserva';
    var nc = {
      // o lote é o da licitação (o nome de tela sai do tipo e do número)
      id: uid('ct'), orgao: ref ? ref.orgao : '', numero: numero || '', lote: lote || '', tipo: t,
      rodovia: ref ? ref.rodovia : '', objeto: '', executora: '', supervisora: ref ? ref.supervisora : '',
      ctSupervisao: ref ? ref.ctSupervisao : '', extensaoContrato: null, origem: '', destino: '', kmIni: null, kmFim: null,
      plataforma: ref && ctTipo(ref) === t ? ref.plataforma : '', dataVistoria: cons ? null : todayIso(), porPagina: TIPOS[t].porPagina, marcos: [], pontos: []
    };
    if (t === 'pc') delete nc.tipo;
    if (cons) {
      // conservação: sem plataforma; km e SNV do contrato, prazos, valores (PI) e observações da folha vêm do formulário
      delete nc.plataforma;
      nc.kmIniContrato = null; nc.kmFimContrato = null; nc.snvContrato = ''; nc.prazos = []; nc.valores = []; nc.obsFolha = '';
    }
    return nc;
  }
  // nº igual ao de outro contrato (sem contar os espaços): o nome de tela e a pasta do Drive saem do número. exceto: o
  // contrato que está sendo editado (campo "Nº" dos dados do contrato), que não conta
  function numeroRepetido(numero, exceto) {
    var k = txtLimpo(numero).replace(/\s+/g, '');
    return k ? state.contracts.find(function (x) { return x !== exceto && txtLimpo(x.numero).replace(/\s+/g, '') === k; }) || null : null;
  }
  function abrirNovoContrato(ref) {
    modal('<h2 id="modalTitle">Novo contrato</h2>' +
      '<fieldset class="folha-op"><legend>Tipo do contrato</legend>' +
      TIPO_ORDEM.map(function (t) { return '<label><input type="radio" name="tipo" value="' + t + '"> <span><b>' + esc(TIPOS[t].opcao) + '</b></span></label>'; }).join('') +
      '</fieldset>' +
      mField('ncNumero', 'Nº do contrato', false, '', 'off') + mField('ncLote', 'Lote (da licitação)', false, '', 'off') +
      '<p class="hint">O tipo não pode ser trocado depois.</p>' +
      MFOOT + '<button type="submit" class="btn primary">Criar</button></div>',
    function (f) {
      var tp = f.querySelector('input[name=tipo]:checked'), numero = f.querySelector('#ncNumero').value.trim(), lote = f.querySelector('#ncLote').value.trim();
      if (!tp) { modalErr(f, 'Escolha o tipo do contrato.'); return; }
      var dup = numeroRepetido(numero);
      if (dup) { modalErr(f, 'Já existe o ' + ctNome(dup) + ' com este número.'); return; }
      closeModal();
      var nc = novoContrato(tp.value, ref, numero, lote);
      state.contracts.push(nc);
      state.activeId = nc.id;
      ui.contractOpen = true; ui.open = {};
      var ncVisao = visaoOn;
      setVisao(false);
      renderAll();
      if (ncVisao) window.scrollTo(0, 0);
      afterEdit('new-contract', nc);
    });
  }

  // ---------------- exclusões: sempre com confirmação na própria página; o ponto ainda pode ser desfeito na hora
  // na conservação, "segmento" (itemTxt); nos outros tipos, "ponto", como sempre (inclusive nas pontes)
  function itemTxt(c) { return isConserva(c) ? tipoInfo(c).item : 'ponto'; }
  function itensTxt(c) { return isConserva(c) ? tipoInfo(c).itens : 'pontos'; }
  function itemCap(c) { var t = itemTxt(c); return t.charAt(0).toUpperCase() + t.slice(1); }
  function excluirPonto(cid, p) {
    var km = (p.kmIni != null ? fmtKm(p.kmIni) : '?') + ' – ' + (p.kmFim != null ? fmtKm(p.kmFim) : '?'), c0 = contractById(cid), it = itemTxt(c0), It = itemCap(c0);
    confirmar({
      titulo: 'Excluir o ' + it + ' ' + (p.nome || '') + '?',
      html: '<p>KM ' + esc(km) + ' · ' + esc(loteOf(cid)) + '.</p><p>' + (banco.on
        ? 'O ' + it + ' sai do diagrama de todos. Fica 30 dias na lixeira (menu Dados › Lixeira e cópias), de onde um engenheiro ou o Administrador pode restaurar.'
        : 'Neste aparelho não há lixeira: só dá para recuperar por um backup.') + '</p>',
      botao: 'Excluir ' + it, perigo: true
    }).then(function (r) {
      var c = contractById(cid);
      if (!r || !c) return;
      var copia = clone(p);
      c.pontos = c.pontos.filter(function (x) { return x.id !== p.id; });
      if (c === active()) renderEditor();
      afterEdit('del-point', c);
      offerUndo(It + ' ' + (p.nome || '') + ' excluído.', function () {
        var cc = contractById(cid);
        if (!cc) { toast('O contrato deste ' + it + ' não existe mais.'); return; }
        if (cc.pontos.some(function (x) { return x.id === copia.id; })) return;
        cc.pontos.push(clone(copia));
        if (cc === active()) { ui.open = {}; ui.open[copia.id] = true; renderEditor(); scrollToPoint(copia.id); }
        afterEdit('add-point', cc);
        toast(It + ' ' + (copia.nome || '') + ' de volta.');
      });
    });
  }
  // com o banco ninguém exclui contrato: o Administrador arquiva (sai de todas as telas e os dados ficam guardados, D-2)
  function arquivarContrato(c) {
    var nome = ctNome(c) || 'Contrato', cid = c.id;
    confirmar({
      titulo: 'Arquivar o contrato ' + nome + '?',
      html: '<p>O contrato <b>' + esc(ctCompleto(c)) + '</b> sai de todas as telas, para todos: lista, Visão geral, Medições, mapa, foto e galeria.</p>' +
        '<p>Nada é apagado: os <b>' + c.pontos.length + ' ' + itensTxt(c) + '</b>, as fotos e as medições ficam guardados no banco. Você restaura quando quiser em Dados › Contratos arquivados.</p>',
      digitar: nome, botao: 'Arquivar contrato', perigo: true
    }).then(function (r) {
      if (!r || !contractById(cid) || state.contracts.length < 2) return;
      var cc = contractById(cid);
      banco.arquivados = (banco.arquivados || []).concat([{ id: cid, nome: nome, completo: ctCompleto(cc), n: cc.pontos.length, it: itensTxt(cc), em: new Date().toISOString(), por: (banco.login && banco.login.nome) || null }]);
      // sai do estado e da base juntos (a posição dos outros contratos não muda: nenhuma "ordem das abas" vai junto) e o
      // arquivamento entra na fila como operação própria
      state.contracts = state.contracts.filter(function (x) { return x.id !== cid; });
      if (banco.base) banco.base.contracts = banco.base.contracts.filter(function (x) { return x.id !== cid; });
      if (state.activeId === cid) state.activeId = state.contracts[0].id;
      enqueue([{ t: 'arquivar_contrato', id: cid, nome: nome, em: new Date().toISOString() }]);
      scheduleFlush(300);
      ui.open = {};
      renderAll();
      afterEdit('del-contract', active());
      toast('Contrato ' + nome + ' arquivado. Para trazer de volta: Dados › Contratos arquivados.', 6000);
    });
  }
  function excluirContrato(c) {
    var nome = ctNome(c) || 'Contrato', cid = c.id;
    confirmar({
      titulo: 'Excluir o contrato ' + nome + ' inteiro?',
      html: '<p>Sai o contrato <b>' + esc(ctCompleto(c)) + '</b> com os <b>' + c.pontos.length + ' ' + itensTxt(c) + '</b>, para todos.</p><p>' +
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

  // na troca de página do celular o ponto aparece direto (a página acabou de abrir: não há de onde deslizar)
  function scrollToPoint(id, direto) {
    if (mdOn()) {
      var mr = document.querySelector('#editor .ld-r'), mk = document.querySelector('#editor .pt-marcado');
      if (mr) mr.scrollTop = 0;
      if (mk) mk.scrollIntoView({ block: 'nearest' });
      return;
    }
    var el = document.querySelector('.pt[data-id="' + CSS.escape(id) + '"]');
    if (el) el.scrollIntoView(direto ? { block: 'start' } : { behavior: 'smooth', block: 'start' });
  }

  // clique no desenho abre o ponto no editor; "Abrir para ler" (celular) abre a tela cheia nessa página
  var ICON_LER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/><path d="M11 8.5v5M8.5 11h5"/></svg>';
  function onPreviewClick(e) {
    var lb = e.target.closest('.ler-btn');
    if (lb) { if (viewer) viewer.open(Number(lb.dataset.ler) || 0); return; }
    var g = e.target.closest('[data-pid]');
    if (!g) return;
    var id = g.getAttribute('data-pid');
    var trocou = pgAtivo() && pg !== 'pontos';
    var sh = g.closest('.sheet'), fol = sh ? Array.prototype.indexOf.call($('pages').querySelectorAll('.sheet'), sh) : -1, topo = $('pages').scrollTop;
    if (pgAtivo()) irPg('pontos');
    if (ui.wide) toggleWide(false);
    ui.open = {}; ui.open[id] = true;
    ui.voltar = trocou && mdOn() ? { pg: 'diagrama', folha: fol, top: topo } : null;
    renderEditor();
    scrollToPoint(id, trocou);
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
        title: (isConserva(c) ? 'Diagrama linear - Conservação - CT ' : 'Diagrama linear - Obra ') + (c.numero || ''),
        subject: nomeArquivo(c).concat(c.rodovia ? [c.rodovia] : []).join(' - '),
        author: c.supervisora || '',
        creator: isConserva(c) ? 'Diagrama linear da conservação' : 'Diagrama linear dos pontos críticos'
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
    // "Diagrama linear - Pontos Críticos 314 - Lote 01 - CT 02 00314-2026 - 2026-10-17.pdf" (a barra do nº vira hífen)
    var name = 'Diagrama linear - ' + nomeArquivo(c).join(' - ') + ' - ' + todayIso() + (interno ? ' (interno)' : '') + '.pdf';
    return name.replace(/[\\/:*?"<>|]/g, '-');
  }
  // quem vê a análise das medições escolhe: só a vistoria (padrão, para enviar) ou com a análise (uso interno)
  function escolherFolha(oque) {
    var c = active();
    if (!anOf(c)) return Promise.resolve(true);
    if (!parte(c, 'acomp')) return Promise.resolve(false);   // analista só das medições: a folha com a análise, sem escolher
    return new Promise(function (resolve) {
      modal('<h2 id="modalTitle">' + esc(oque) + '</h2>' +
        '<fieldset class="folha-op"><legend>O que vai na folha</legend>' +
        // começa sempre em "Só a vistoria": a folha com a análise é de uso interno e não vai à contratada por engano
        '<label><input type="radio" name="folha" value="vistoria" checked> <span><b>Só a vistoria</b><small>Estado ' + (isConserva(c) ? 'dos segmentos' : 'das pontes') + ' e observações. Para enviar à contratada ou ao DNIT.</small></span></label>' +
        '<label><input type="radio" name="folha" value="analise"> <span><b>Com a análise das medições</b><small>Valores medidos e alertas em roxo, com o aviso “USO INTERNO – análise preliminar” no topo.</small></span></label></fieldset>' +
        '<div class="modal-foot"><button type="button" class="btn" data-close>Cancelar</button><button type="submit" class="btn primary">Continuar</button></div>',
      function (f) {
        var com = f.querySelector('input[name=folha]:checked').value === 'analise';
        closeModal();
        resolve(!com);
      });
    });
  }
  function exportPdf() {
    if (!state.contracts.length || !podeDiagrama(active())) { toast('Seu acesso não inclui o diagrama deste contrato.'); return; }
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
  function imprimir() { if (!state.contracts.length || !podeDiagrama(active())) { toast('Seu acesso não inclui o diagrama deste contrato.'); return; } escolherFolha('Imprimir').then(printSheets); }
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
      // um backup sem contratos apagaria tudo de todos: recusa
      if (!s.contracts.length) { toast('Esse backup não tem nenhum contrato. Nada foi trocado.'); return; }
      var estranhas = situacoesEstranhas(s);
      if (estranhas.length) { toast('Esse backup tem ' + estranhas.length + ' situação(ões) que o site não conhece (ex.: ' + estranhas[0] + '). Nada foi trocado.', 9000); return; }
      try { normalize(clone(s)); } catch (e) { toast('Esse arquivo não é um backup válido deste site.'); return; }
      var np =s.contracts.reduce(function (n, c) { return n + c.pontos.length; }, 0);
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

  // ---- carga das medições (fase 5: D-12, D-13, D-14 e D-15). Quem carrega: Administrador, engenheiro e auxiliar.
  // Arquivo do contrato inteiro { tipo: 'carga-medicoes', contrato, fonte, dados, ocorr } (o dos geradores, como sempre) ou de
  // algumas MPs { tipo: 'carga-mp', contrato, fonte, base?, mps: { '<n>': { dados, ocorr } } } (dados no formato por MP).
  // O app compara cada MP com a versão atual do banco e só envia as novas e as que mudaram; a MP que não está no arquivo fica
  // como está (o arquivo nunca apaga MP). A MP igual a uma versão guardada volta para ela, com motivo (D-13); a retificada
  // que chega sem as ocorrências que tinha pede confirmação (D-14). Tudo entra numa carga só, que os outros só veem no fim.
  var CARGA_PARTE = 2000;
  function brl2(v) { return v == null || !isFinite(v) ? '–' : 'R$ ' + fmt(v, 2); }   // com centavos: retificação muda às vezes só centavos
  function ocAssin(l) { var q = 0, k = 0; l.forEach(function (o) { q += Number(o[5]) || 0; k += Number(o[2]) || 0; }); return { n: l.length, q: q, k: k }; }
  function mesmoNum(a, b) { a = Number(a) || 0; b = Number(b) || 0; return Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a)); }
  function ocIgual(as, x) { return as.n === (Number(x.ocorr) || 0) && mesmoNum(as.q, x.oq) && mesmoNum(as.k, x.okm); }
  function igualJson(a, b) {
    if (a === b) return true;
    if (typeof a === 'number' && typeof b === 'number') return a === b;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) return a.length === b.length && a.every(function (x, i) { return igualJson(x, b[i]); });
    var ka = Object.keys(a).filter(function (k) { return a[k] !== undefined; }), kb = Object.keys(b).filter(function (k) { return b[k] !== undefined; });
    return ka.length === kb.length && ka.every(function (k) { return Object.prototype.hasOwnProperty.call(b, k) && igualJson(a[k], b[k]); });
  }
  function errCarga(e) {
    var c = e && e.code, d = {};
    try { d = JSON.parse((e && e.detalhe) || '{}') || {}; } catch (x) { d = {}; }
    return c === 'carga_em_andamento' ? 'Outra carga deste contrato está em andamento' + (d.por ? ', começada por ' + d.por + (d.em ? ' às ' + hhmm(new Date(d.em)) : '') : '') + '. Espere ela terminar (ou 30 minutos sem andamento) e carregue de novo.'
      : c === 'carga_incompleta' ? 'O banco não recebeu tudo' + (e.detalhe ? ' (' + e.detalhe + ')' : '') + '. Nada mudou; carregue o arquivo de novo.'
      : c === 'contrato_arquivado' ? 'Este contrato está arquivado: restaure antes de carregar medições.'
      : c === 'contrato_inexistente' ? 'O contrato do arquivo não está no banco.'
      : c === 'sem_base' ? 'A primeira carga deste contrato precisa do arquivo do contrato inteiro.'
      : c === 'dados_invalidos' || c === 'medicao_invalida' ? 'O banco recusou o arquivo: formato de medição inválido.'
      : c === 'motivo_curto' ? 'Escreva o motivo (pelo menos 5 letras).'
      : c === 'sem_permissao' ? 'Seu acesso não carrega medições (só Administrador, engenheiro e auxiliar).'
      : errText(e);
  }
  function abrirCargaMed(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var x, c, arq;
      try {
        x = JSON.parse(reader.result);
        if (!x || typeof x.contrato !== 'string') throw new Error('formato');
        if (x.tipo === 'carga-medicoes') {
          if (!x.dados || typeof x.dados !== 'object' || !Array.isArray(x.dados.medicoes) || !x.dados.medicoes.length || (x.ocorr != null && !Array.isArray(x.ocorr))) throw new Error('formato');
        } else if (x.tipo === 'carga-mp') {
          if (!x.mps || typeof x.mps !== 'object' || !Object.keys(x.mps).length) throw new Error('formato');
          Object.keys(x.mps).forEach(function (n) { var m = x.mps[n]; if (!m || !m.dados || !m.dados.med || String(m.dados.med.n) !== String(n) || (m.ocorr != null && !Array.isArray(m.ocorr))) throw new Error('formato'); });
        } else throw new Error('formato');
      } catch (e) { toast('Esse arquivo não é uma carga de medições deste site.'); return; }
      c = state.contracts.filter(function (k) { return k.id === x.contrato; })[0];
      if (!c) { toast('O contrato do arquivo (' + x.contrato + ') não está no site.'); return; }
      if (!banco.login || !isEng()) { toast('Só Administrador, engenheiro e auxiliar carregam medições.'); return; }
      if (!window.Banco.medicoes || !window.MedMP) { toast('Atualize o app para carregar medições.', 6000); return; }
      try {
        if (x.tipo === 'carga-medicoes') arq = window.MedMP.separar(x.dados, x.ocorr || []);
        else { arq = { base: x.base || null, mps: {} }; Object.keys(x.mps).forEach(function (n) { arq.mps[n] = { dados: x.mps[n].dados, ocorr: x.mps[n].ocorr || [] }; }); }
        Object.keys(arq.mps).forEach(function (n) { (arq.mps[n].ocorr || []).forEach(function (o) { if (!Array.isArray(o) || o.length !== 8 || String(o[0]) !== String(n)) throw new Error('ocorrência fora do formato na ' + n + 'ª'); }); });
      } catch (e) { toast('O arquivo não fecha: ' + e.message + '.', 8000); return; }
      var cred = banco.login.codigo;
      toast('Comparando com o que o banco tem…', 60000);
      Promise.all([window.Banco.medicoes(cred, c.id), window.Banco.medicoesVersoes(cred, c.id, null)]).then(function (r) {
        return compararCarga(c, arq, r[0], r[1], cred).then(function (cmp) { toast('Comparação pronta.', 1200); mostrarCarga(c, file.name, x.fonte || '', cmp); });
      }).catch(function (e) { console.error(e); toast(errCarga(e), 9000); });
    };
    reader.readAsText(file);
  }
  // cada MP do arquivo: igual | nova | retificada | volta (igual a uma versão guardada)
  function compararCarga(c, arq, cur, vers, cred) {
    var atual = {}, lista = [], pedidos = [];
    ((cur && cur.mps) || []).forEach(function (m) { atual[m.n] = m; });
    Object.keys(arq.mps).map(Number).sort(function (a, b) { return a - b; }).forEach(function (n) {
      var m = arq.mps[n], d = m.dados, oc = m.ocorr || [], as = ocAssin(oc), a = atual[n];
      var e = { n: n, dados: d, ocorr: oc, as: as, mes: d.med.mes || '', total: Number(d.med.total) || 0, antes: a ? { total: Number(a.dados.med.total) || 0, ocorr: Number(a.ocorr) || 0, v: a.v, em: a.em, por: a.por } : null };
      if (a && igualJson(a.dados, d) && ocIgual(as, a)) e.tipo = 'igual';
      else {
        e.tipo = a ? 'retificada' : 'nova';
        var cand = vers.filter(function (v) { return v.n === n && v.estado === 'anterior' && !v.retirada && mesmoNum(v.total, e.total) && ocIgual(as, v); });
        if (cand.length) pedidos.push(Promise.all(cand.map(function (v) { return window.Banco.medicaoVersao(cred, c.id, n, v.v); })).then(function (rs) {
          var hit = rs.filter(function (r) { return r && igualJson(r.dados, d); })[0];
          if (hit) { e.tipo = 'volta'; e.volta = vers.filter(function (v) { return v.n === n && v.v === hit.v; })[0]; }
        }));
      }
      lista.push(e);
    });
    var base = arq.base;
    if (!base && cur) { base = cur.base; lista.forEach(function (e) { base = window.MedMP.juntarBase(base, e.dados, null); }); }
    return Promise.all(pedidos).then(function () {
      return {
        lista: lista, base: base, semBase: !cur, baseMuda: !cur || !igualJson(cur.base, base),
        fora: Object.keys(atual).map(Number).filter(function (n) { return !arq.mps[n]; }).sort(function (a, b) { return a - b; }),
        antigo: !!(cur && cur.base && base && cur.base.gerado_em && base.gerado_em && String(base.gerado_em) < String(cur.base.gerado_em)) ? { arq: base.gerado_em, banco: cur.base.gerado_em } : null
      };
    });
  }
  function mostrarCarga(c, nome, fonte, cmp) {
    var nomeCt = c.numero ? 'CT ' + c.numero : c.id, L = cmp.lista;
    if (cmp.semBase && !cmp.base) { toast('A primeira carga deste contrato precisa do arquivo do contrato inteiro.', 7000); return; }
    var novas = L.filter(function (e) { return e.tipo === 'nova'; }), rets = L.filter(function (e) { return e.tipo === 'retificada'; }),
      voltas = L.filter(function (e) { return e.tipo === 'volta'; }), iguais = L.filter(function (e) { return e.tipo === 'igual'; }),
      apaga = rets.concat(voltas).filter(function (e) { return e.antes && e.antes.ocorr > 0 && !e.as.n; });
    var envio = novas.concat(rets, voltas).sort(function (a, b) { return a.n - b.n; });
    if (!envio.length && !cmp.baseMuda) { toast('O arquivo é igual ao que o banco tem: nada a carregar.', 6000); return; }
    var pedeMotivo = voltas.length || cmp.antigo || apaga.length;
    function dif(a, b) { var d = b - a; return (d >= 0 ? '+' : '−') + brl2(Math.abs(d)); }
    function linha(e) {
      var t = '<b>' + e.n + 'ª</b>' + (e.mes ? ' · ' + esc(e.mes) : '') + ' · ';
      if (e.tipo === 'nova') return '<li>' + t + brl2(e.total) + (e.as.n ? ' · ' + e.as.n + ' ocorrências' : '') + '</li>';
      var oc = e.antes.ocorr !== e.as.n ? ' · ocorrências ' + e.antes.ocorr + ' → ' + e.as.n : '';
      if (e.tipo === 'volta') return '<li>' + t + 'volta à versão ' + e.volta.v + ' (carregada em ' + esc(fmtIsoDate(e.volta.gravado)) + (e.volta.por ? ' por ' + esc(e.volta.por) : '') + ') · ' + brl2(e.antes.total) + ' → ' + brl2(e.total) + oc + '</li>';
      return '<li>' + t + brl2(e.antes.total) + ' → ' + brl2(e.total) + (mesmoNum(e.antes.total, e.total) ? ' (mesmo valor; mudou o detalhe)' : ' (' + dif(e.antes.total, e.total) + ')') + oc + '</li>';
    }
    function bloco(t, l) { return l.length ? '<h3 class="cg-h">' + t + ' · ' + l.length + '</h3><ul class="cg-l">' + l.map(linha).join('') + '</ul>' : ''; }
    var h = '<h2 id="modalTitle">Carregar as medições do ' + esc(nomeCt) + '?</h2>' +
      '<p>Arquivo <b>' + esc(nome) + '</b>: ' + L.length + (L.length === 1 ? ' medição' : ' medições') + '. Só vai para o banco o que é novo ou mudou; a medição que não está no arquivo fica como está.</p>' +
      (fonte ? '<p><small>' + esc(fonte) + '</small></p>' : '') +
      bloco('Novas', novas) + bloco('Retificadas', rets) + bloco('Voltam a uma versão guardada', voltas) +
      (iguais.length ? '<p class="hint">' + iguais.length + (iguais.length === 1 ? ' medição igual' : ' medições iguais') + ' ao banco (não são enviadas).</p>' : '') +
      (cmp.fora.length ? '<p class="hint">Fora do arquivo, continuam como estão: ' + cmp.fora.map(function (n) { return n + 'ª'; }).join(', ') + '.</p>' : '') +
      '<p class="hint">Catálogo de serviços, notas e ficha do SIAC: ' + (cmp.semBase ? 'primeira carga do contrato' : cmp.baseMuda ? 'mudam com este arquivo' : 'sem mudança') + '.</p>' +
      (cmp.antigo ? '<div class="cg-alerta"><b>Arquivo mais antigo que o do banco.</b> Gerado em ' + esc(fmtIsoDate(cmp.antigo.arq)) + '; o que está no banco é de ' + esc(fmtIsoDate(cmp.antigo.banco)) + '.' +
        '<label><input type="checkbox" data-cg-ok> Sei que é mais antigo e quero carregar assim mesmo</label></div>' : '') +
      apaga.map(function (e) {
        return '<div class="cg-alerta"><b>A ' + e.n + 'ª chega sem ocorrências km a km</b> e hoje tem ' + e.antes.ocorr + '. Se seguir, as ' + e.antes.ocorr + ' saem dos segmentos (a versão de agora fica guardada).' +
          '<label><input type="checkbox" data-cg-ok> Apagar as ocorrências da ' + e.n + 'ª</label></div>';
      }).join('') +
      (voltas.length ? '<div class="cg-alerta"><b>' + (voltas.length === 1 ? 'Uma medição volta' : voltas.length + ' medições voltam') + ' a uma versão guardada</b> (o arquivo é igual a uma carga anterior).' +
        '<label><input type="checkbox" data-cg-ok> Voltar mesmo assim</label></div>' : '') +
      '<div class="field"><label for="cgMot">Motivo' + (pedeMotivo ? '' : ' (opcional)') + ' · fica no histórico das versões</label><input id="cgMot" maxlength="300" autocomplete="off" placeholder="Ex.: MP 59 recebida no SEI; 12ª retificada"></div>' +
      '<p class="hint">Grava como ' + esc(banco.login.nome || 'Administrador') + '. Os outros veem as medições novas só quando tudo terminar; se cair no meio, nada muda.</p>' +
      '<p class="cg-prog" hidden></p>' + MFOOT + '<button type="submit" class="btn primary">Carregar ' + (envio.length ? envio.length + (envio.length === 1 ? ' medição' : ' medições') : 'o catálogo') + '</button></div>';
    modal(h, function (f) {
      var mot = f.querySelector('#cgMot').value.trim();
      if ([].some.call(f.querySelectorAll('[data-cg-ok]'), function (i) { return !i.checked; })) { modalErr(f, 'Marque as confirmações em destaque para seguir.'); return; }
      if (pedeMotivo && mot.length < 5) { modalErr(f, 'Escreva o motivo (pelo menos 5 letras).'); return; }
      modalErr(f, '');
      busyBtn(f, true, 'Gravando…');
      // enquanto grava, a janela não fecha (Cancelar, Esc, toque fora): a carga seguiria sozinha e o erro sumiria com ela
      var mEl = f.parentNode, fx = f.querySelectorAll('[data-close]');
      mEl.dataset.ocupado = '1'; fx.forEach(function (x) { x.disabled = true; });
      var livre = function () { delete mEl.dataset.ocupado; fx.forEach(function (x) { x.disabled = false; }); };
      var pg = f.querySelector('.cg-prog');
      pg.hidden = false;
      executarCarga(banco.login.codigo, c.id, cmp.baseMuda ? cmp.base : null, fonte, mot || (novas.length && !rets.length && !voltas.length ? 'medição nova' : ''), envio, function (k, t) { pg.textContent = 'Enviando ' + k + ' de ' + t + '…'; }).then(function (r) {
        livre();
        if ($('modal') === mEl) closeModal();
        recarregarMedicoes(c);
        toast('Medições do ' + nomeCt + ' carregadas: ' + (r && r.mps != null ? r.mps : envio.length) + (envio.length === 1 ? ' medição' : ' medições') + '.', 6000);
      }, function (err) {
        console.error(err);
        livre();
        busyBtn(f, false); pg.hidden = true;
        modalErr(f, errCarga(err));
      });
    }, 'cg-box');
  }
  // envio = [{ n, dados (null = retirar), ocorr }]; prog(k, total) a cada parte
  function executarCarga(cred, cid, base, fonte, motivo, envio, prog) {
    var carga = null, esperado = {}, feito = 0, total = envio.reduce(function (t, e) { return t + 1 + Math.ceil((e.ocorr || []).length / CARGA_PARTE); }, 0);
    var p = window.Banco.cargaIniciar(cred, cid, base, fonte, motivo).then(function (id) { carga = id; });
    envio.forEach(function (e) {
      var oc = e.ocorr || [];
      p = p.then(function () { return window.Banco.cargaMp(cred, carga, e.n, e.dados); }).then(function () { if (prog) prog(++feito, total); });
      for (var i = 0; i < oc.length; i += CARGA_PARTE) (function (i) {
        p = p.then(function () { return window.Banco.cargaOcorr(cred, carga, e.n, oc.slice(i, i + CARGA_PARTE), i); }).then(function () { if (prog) prog(++feito, total); });
      })(i);
      esperado[e.n] = oc.length;
    });
    return p.then(function () { return window.Banco.cargaConcluir(cred, carga, esperado); }).catch(function (err) {
      if (carga) window.Banco.cargaCancelar(cred, carga).catch(function () { });
      throw err;
    });
  }
  function recarregarMedicoes(c) {
    delete analise.estado[c.id];
    Object.keys(anOcorr).forEach(function (k) { if (k.indexOf(c.id + '|') === 0) delete anOcorr[k]; });
    carregarAnalise(c, true);
  }

  // ---- medições carregadas e as versões de cada MP (D-13, D-15): voltar a uma versão guardada ou retirar uma MP, com motivo
  function openVersoesMed(cid) {
    if (!banco.login || !isEng()) return;
    if (!window.Banco.medicoesVersoes) { toast('Atualize o app para ver as versões.'); return; }
    var c = cid ? contractById(cid) : null;
    if (!c || !parte(c, 'med')) {
      // fora de um contrato com medições (visão geral, aba Medições): escolhe o contrato
      var cs = state.contracts.filter(function (k) { return parte(k, 'med'); });
      var f0 = modal('<h2 id="modalTitle">Medições carregadas</h2><p class="hint">Escolha o contrato.</p><div class="lx">' + cs.map(function (k) {
        return '<div class="lx-row"><div class="lx-txt"><b>' + esc(ctNumeroCT(k) || ctNome(k)) + '</b></div><button type="button" class="btn small" data-mpct="' + esc(k.id) + '">Abrir</button></div>';
      }).join('') + '</div><div class="modal-foot"><button type="button" class="btn" data-close>Fechar</button></div>', null, 'mpv-box');
      f0.addEventListener('click', function (e) { var b = e.target.closest('[data-mpct]'); if (b) openVersoesMed(b.dataset.mpct); });
      return;
    }
    var cred = banco.login.codigo, an = analise.dados[c.id], aberto = {};
    function mesDe(n) { var m = an && (an.medicoes || []).filter(function (x) { return x.n === n; })[0]; return m && m.mes ? ' · ' + m.mes : ''; }
    function desenha(vs) {
      var por = {};
      vs.forEach(function (v) { (por[v.n] || (por[v.n] = [])).push(v); });
      var ns = Object.keys(por).map(Number).sort(function (a, b) { return b - a; });
      var h = '<h2 id="modalTitle">Medições carregadas · ' + esc(c.numero ? 'CT ' + c.numero : c.id) + '</h2>' +
        (ns.length ? '<p class="hint">Cada medição guarda as versões anteriores. Voltar ou retirar pede motivo e fica no histórico.</p>' : '<p>Este contrato ainda não tem medições carregadas.</p>') +
        '<div class="mpv">' + ns.map(function (n) {
          var l = por[n], at = l.filter(function (v) { return v.estado === 'atual'; })[0];
          var cab = '<div class="mpv-row"><div class="mpv-txt"><b>' + n + 'ª' + esc(mesDe(n)) + '</b> · ' + (at ? (at.retirada ? 'retirada' : brl2(at.total) + (at.ocorr ? ' · ' + at.ocorr + ' ocorrências' : '')) : 'sem versão atual') +
            '<small>' + (at ? 'versão ' + at.v + ' de ' + l.length + ' · ' + esc(fmtIsoDate(at.ativada || at.gravado)) + (at.ativada_por || at.por ? ' por ' + esc(at.ativada_por || at.por) : '') : '') + '</small></div>' +
            '<button type="button" class="btn small" data-mpv="' + n + '">' + (aberto[n] ? 'Fechar' : 'Versões') + '</button></div>';
          if (!aberto[n]) return cab;
          return cab + '<div class="mpv-vers">' + l.map(function (v) {
            return '<div class="mpv-v"><div class="mpv-txt">Versão ' + v.v + (v.estado === 'atual' ? ' <b>(atual)</b>' : '') + ' · ' + (v.retirada ? 'retirada' : brl2(v.total) + ' · ' + (v.ocorr || 0) + ' ocorrências') +
              '<small>carregada em ' + esc(fmtIsoDate(v.gravado)) + (v.por ? ' por ' + esc(v.por) : '') + (v.motivo ? ' · ' + esc(v.motivo) : '') + (v.fonte ? ' · ' + esc(v.fonte) : '') + '</small></div>' +
              (v.estado === 'anterior' && !v.retirada ? '<button type="button" class="btn small" data-mpvolta="' + n + ':' + v.v + '">Voltar a esta</button>' : '') +
              (v.estado === 'atual' && !v.retirada ? '<button type="button" class="btn small danger" data-mptira="' + n + '">Retirar</button>' : '') + '</div>';
          }).join('') + '</div>';
        }).join('') + '</div><div class="modal-foot"><button type="button" class="btn" data-close>Fechar</button></div>';
      var f = modal(h, null, 'mpv-box');
      f.addEventListener('click', function (e) {
        var b = e.target.closest('[data-mpv],[data-mpvolta],[data-mptira]');
        if (!b) return;
        if (b.dataset.mpv) { aberto[b.dataset.mpv] = !aberto[b.dataset.mpv]; desenha(vs); return; }
        if (b.dataset.mpvolta) {
          var nv = b.dataset.mpvolta.split(':').map(Number);
          confirmar({ titulo: 'Voltar a ' + nv[0] + 'ª à versão ' + nv[1] + '?', texto: 'A versão de agora fica guardada e pode voltar depois.', campo: 'Motivo (obrigatório)', botao: 'Voltar à versão ' + nv[1] }).then(function (r) {
            if (!r) { abrir(); return; }
            if (r.valor.length < 5) { toast('Escreva o motivo (pelo menos 5 letras).'); abrir(); return; }
            window.Banco.medicaoVoltar(cred, c.id, nv[0], nv[1], r.valor).then(function () { recarregarMedicoes(c); toast('A ' + nv[0] + 'ª voltou à versão ' + nv[1] + '.'); abrir(); }, function (err) { toast(errCarga(err), 8000); abrir(); });
          });
          return;
        }
        var n = Number(b.dataset.mptira);
        confirmar({ titulo: 'Retirar a ' + n + 'ª das medições?', texto: 'Ela sai dos totais e dos segmentos. Fica guardada: dá para voltar em "Versões".', campo: 'Motivo (obrigatório)', botao: 'Retirar a ' + n + 'ª', perigo: true }).then(function (r) {
          if (!r) { abrir(); return; }
          if (r.valor.length < 5) { toast('Escreva o motivo (pelo menos 5 letras).'); abrir(); return; }
          executarCarga(cred, c.id, null, '', r.valor, [{ n: n, dados: null, ocorr: [] }]).then(function () { recarregarMedicoes(c); toast('A ' + n + 'ª foi retirada.'); abrir(); }, function (err) { toast(errCarga(err), 8000); abrir(); });
        });
      });
    }
    function abrir() {
      window.Banco.medicoesVersoes(cred, c.id, null).then(desenha, function (err) { toast(errCarga(err), 8000); });
    }
    abrir();
  }

  // ---- medição nova carregada em outro aparelho (D-23): atualiza sozinha; com a aba Medições aberta, avisa e espera o toque
  var medQuandoEm = 0;
  function conferirMedNovas() {
    if (!banco.login || !(isEng() || isAnalista()) || !window.Banco.medicoesQuando || Date.now() - medQuandoEm < 60000) return;
    medQuandoEm = Date.now();
    var cred = banco.login.codigo;
    window.Banco.medicoesQuando(cred).then(function (q) {
      if (!banco.login || banco.login.codigo !== cred) return;
      var mud = Object.keys(q).filter(function (cid) { return analise.estado[cid] === 'ok' && anQuando[cid] && q[cid] !== anQuando[cid]; });
      if (!mud.length) return;
      if (!medicoesOn) { mud.forEach(function (cid) { var c = contractById(cid); if (c) recarregarMedicoes(c); }); return; }
      var b = $('medNova');
      if (!b) { b = document.createElement('div'); b.id = 'medNova'; b.className = 'med-nova'; b.setAttribute('role', 'status'); document.body.appendChild(b); }
      b.innerHTML = 'Há medição nova · ' + esc(mud.map(function (cid) { var c = contractById(cid); return c && c.numero ? 'CT ' + c.numero : cid; }).join(', ')) + ' <button type="button" class="btn small primary">Atualizar</button>';
      b.hidden = false;
      b.querySelector('button').onclick = function () { b.hidden = true; mud.forEach(function (cid) { var c = contractById(cid); if (c) recarregarMedicoes(c); }); };
    }, function () { });
  }

  // ------------------------------------------------------------------ menu
  function closeMenu() { $('menuPop').hidden = true; $('btnMenu').setAttribute('aria-expanded', 'false'); }
  function onMenu(e) {
    var b = e.target.closest('[data-act]');
    if (!b) return;
    closeMenu();
    var act = b.dataset.act;
    if (act === 'medicoes') { abrirMedicoes(); return; }
    if (act === 'login') { openLogin(); return; }
    if (act === 'pdf') { exportPdf(); return; }
    if (act === 'backup') downloadBackup();
    else if (act === 'restore') {
      if (banco.on && !isResp()) { toast('Só o Administrador pode trocar os dados da equipe por um backup.', 5000); if (!banco.login) openLogin(); return; }
      $('fileInput').click();
    }
    else if (act === 'print') { if (visaoOn || medicoesOn) { toast('Abra um contrato para imprimir o diagrama dele.'); return; } imprimir(); }
    // na visão o contrato ativo está escondido: o relatório começa em "Todos"
    else if (act === 'relfoto') abrirGaleria({ aba: 'relatorio', cid: visaoOn ? '' : active().id });
    else if (act === 'lixeira') openLixeira();
    else if (act === 'arquivados') openArquivados();
    else if (act === 'recusadas') openRecusadas();
    else if (act === 'usuarios') openUsuarios();
    else if (act === 'cargamed') { if (!banco.login || !isEng()) { toast('Só Administrador, engenheiro e auxiliar carregam medições.'); return; } $('fileMed').click(); }
    else if (act === 'mpversoes') openVersoesMed(medicoesOn || visaoOn ? null : active() && active().id);
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
  var banco = { on: !!window.Banco, versao: 0, pend: [], cfg: {}, meta: {}, conf: [], propostas: [], acesso: null, base: null, login: null, online: null, busy: false, sending: 0, at: null, want: false,
    falhas: 0, espera: 0, lote: 0,   // falhas seguidas do servidor, quando tentar de novo e tamanho do lote ao separar uma recusa
    semEspaco: false, arquivados: [], envio: 0 };   // fila sem cópia no aparelho; contratos arquivados (só o Administrador recebe); nº do envio em andamento
  var flushTimer = null;

  // ---------------- uma aba por vez edita (decisão D-3 de 21/10/2026). Duas abas (ou o app instalado e uma aba do navegador)
  // gravariam a fila inteira na mesma chave, e uma apagaria a da outra. A trava do navegador (Web Locks) fica com a primeira
  // aba e solta sozinha quando ela fecha; as outras ficam só para consulta: não gravam, não enviam e não mandam fotos.
  // "Editar nesta aba" toma a trava (a outra grava o que estava esperando e vira consulta) e recarrega para ler o que ela deixou.
  // Sem a trava (navegador antigo), cada aba edita como antes.
  //   pronto: já se sabe se esta aba edita (até lá não envia nada); dono: esta aba editava (ao perder, grava antes de parar)
  var aba = { ro: false, pronto: false, dono: false, trava: ((window.AMBIENTE && window.AMBIENTE.prefixo) || '') + 'diagrama-linear.edicao' };
  var ABA_ASSUMIR = 'diagrama-linear.aba-assumir';
  function initAba() {
    if (!navigator.locks || !navigator.locks.request) { aba.pronto = true; return; }
    var assumir = false;
    try { assumir = sessionStorage.getItem(ABA_ASSUMIR) === '1'; sessionStorage.removeItem(ABA_ASSUMIR); } catch (e) { /* sem armazenamento */ }
    pegarAba(assumir);
  }
  function pegarAba(assumir) {
    navigator.locks.request(aba.trava, assumir ? { steal: true } : { ifAvailable: true }, function (lock) {
      if (!lock) { abaSoLeitura(); esperarAba(); return null; }
      abaEdita();
      return new Promise(function () { /* segura enquanto a aba estiver aberta */ });
    }).catch(function () { abaSoLeitura(); esperarAba(); });   // outra aba tomou a edição
  }
  // a outra aba fechou: esta pega a trava e oferece recarregar para editar (lendo o que a outra deixou gravado)
  function esperarAba() {
    navigator.locks.request(aba.trava, function () {
      abaBarra('livre');
      return new Promise(function () { /* segura até recarregar */ });
    }).catch(function () { abaSoLeitura(); esperarAba(); });
  }
  function abaEdita() {
    aba.pronto = true; aba.dono = true; aba.ro = false;
    var b = $('abaBar');
    if (b) b.remove();
    if (banco.pend.length && banco.login) scheduleFlush(300);
    if (driveQ) driveQ.pump();
    syncStatus();
  }
  function abaSoLeitura() {
    if (aba.dono) { flushSave(); keepSync(); }   // era a aba que editava: grava o que estava esperando antes de parar
    aba.dono = false; aba.ro = true; aba.pronto = true;
    clearTimeout(flushTimer);
    abaBarra('outra');
    aplicaPapel();
    renderAll();
    syncStatus();
  }
  function abaBarra(tipo) {
    var b = $('abaBar');
    if (!b) {
      b = document.createElement('div');
      b.id = 'abaBar';
      b.className = 'share-ready conf-bar aba-bar';
      b.setAttribute('role', 'status');
      document.body.appendChild(b);
    }
    b.innerHTML = tipo === 'livre'
      ? '<span class="aba-txt">A outra aba foi fechada. Recarregue para editar nesta.</span><button type="button" class="btn primary small">Recarregar</button>'
      : '<span class="aba-txt"><b>Só consulta.</b> O app está aberto em outra aba ou janela, e só uma edita por vez. O que você mudar aqui não é gravado.</span><button type="button" class="btn small">Editar nesta aba</button>';
    b.querySelector('button').addEventListener('click', function () {
      if (tipo === 'livre') { location.reload(); return; }
      try { sessionStorage.setItem(ABA_ASSUMIR, '1'); } catch (e) { /* sem armazenamento */ }
      // toma a trava já (a outra grava e para), espera ela terminar e recarrega para ler o que ficou gravado
      navigator.locks.request(aba.trava, { steal: true }, function () { return new Promise(function () { /* até recarregar */ }); }).catch(function () { /* outra tomou de novo */ });
      b.querySelector('button').disabled = true;
      setTimeout(function () { location.reload(); }, 900);
    });
  }

  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function lsPut(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  // a fila guardada no aparelho; sem espaço, as alterações ficam só na memória: a barra avisa até voltar a gravar
  function keepSync() {
    if (aba.ro) return true;   // outra aba edita: esta não grava a fila por cima da dela
    var ok = lsPut(SYNC_KEY, { versao: banco.versao, pend: banco.pend, cfg: banco.cfg, meta: banco.meta, conf: banco.conf, propostas: banco.propostas, acesso: banco.acesso, arquivados: banco.arquivados });
    if (!ok && !banco.semEspaco && banco.pend.length) toast('Este aparelho está sem espaço: ' + banco.pend.length + (banco.pend.length === 1 ? ' alteração está' : ' alterações estão') + ' só na memória. Deixe o app aberto com internet ou salve um backup (menu Dados).', 9000);
    banco.semEspaco = !ok;
    return ok;
  }
  // sem código ou analista: só consulta
  function readOnly() { return aba.ro || (banco.on && (!banco.login || isAnalista())); }
  // papéis (revisoes/2026-10-19-decisoes-acessos.md): Administrador (criador) e engenheiro (tudo; só o Administrador mexe na
  // conta de outro Administrador), auxiliar de engenharia (edita, aprova, lixeira, medições), analista (só vê, nos contratos e
  // partes liberados) e fiscal de campo (vistoria e fotos, nos contratos liberados, com aprovação). O banco confere tudo de
  // novo; aqui é só a tela. Os códigos gerais antigos valem como Administrador ("responsavel") e auxiliar ("equipe").
  var NIVEL = { criador: 3, responsavel: 3, engenheiro: 3, auxiliar: 2, equipe: 2, fiscal: 1, analista: 0 };
  var PAPEL_NOME = { criador: 'Administrador', responsavel: 'Administrador', engenheiro: 'engenheiro', auxiliar: 'auxiliar de engenharia', equipe: 'auxiliar de engenharia',
    fiscal: 'fiscal de campo', analista: 'analista' };
  function nivel() { return banco.on && banco.login ? (NIVEL[banco.login.papel] || 0) : 0; }
  function isResp() { return nivel() >= 3; }
  function isAdmin() { var p = banco.on && banco.login && banco.login.papel; return p === 'criador' || p === 'responsavel'; }
  function isEng() { return nivel() >= 2; }
  function isFiscal() { return nivel() === 1; }
  function isAnalista() { return !!(banco.on && banco.login && banco.login.papel === 'analista'); }
  // sem código: só a visão geral (o banco manda só o trecho dos contratos e a posição dos pontos)
  function isPublico() { return banco.on && !banco.login; }
  function papelNome(p) { return PAPEL_NOME[p] || 'equipe'; }
  // parte do contrato: med = medições; acomp = pontos e status, diagrama e PDF, mapa. O analista só tem as partes liberadas
  // para ele em cada contrato (banco.acesso, do banco); os outros papéis, conforme o papel
  function parte(c, k) {
    if (!banco.on) return true;
    if (!banco.login || !c) return false;
    if (isAnalista()) {
      var a = banco.acesso && banco.acesso[c.id];
      if (k === 'acomp' && isConserva(c)) return false;   // na conservação o analista só tem as medições
      return !!(a && a[k]);
    }
    return k === 'med' ? isEng() : true;
  }
  // analista com as medições: vê também os pontos (segmentos), o diagrama (com a análise) e o mapa, sem a vistoria
  function anMed(c) { return isAnalista() && parte(c, 'med'); }
  function podeDiagrama(c) { return !isFiscal() && (parte(c, 'acomp') || anMed(c)); }
  function podeMapa(c) { return parte(c, 'acomp') || anMed(c); }
  // Foto e Galeria: do fiscal ao Administrador, e o analista nos contratos em que tem as medições (só as fotos dele)
  function podeFotos(c) {
    if (!banco.on || nivel() >= 1) return true;
    if (!isAnalista()) return false;
    return c ? parte(c, 'med') : state.contracts.some(function (x) { return parte(x, 'med'); });
  }
  function ctsFoto() { return state.contracts.filter(function (x) { return !isAnalista() || parte(x, 'med'); }); }
  // a folha só da vistoria: só para quem tem o acompanhamento (o analista só das medições vê sempre a folha com a análise)
  function folhaSoVist(c) { return folhaVistoria && parte(c, 'acomp'); }

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
          var co = { t: 'contrato_campos', id: c.id, nome: ctNome(c), campos: cf || {} };   // nome: só o rótulo do aviso de conflito
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
    a.contracts.forEach(function (c) { if (!bm[c.id]) ops.push({ t: 'arquivar_contrato', id: c.id, nome: ctNome(c), em: em }); });
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
      } else if (op.t === 'apagar_contrato' || op.t === 'arquivar_contrato') {
        if (c) c.arquivado = { em: op.em || new Date().toISOString(), por: (banco.login && banco.login.nome) || null };   // sai da tela (separarArquivados)
      } else if (op.t === 'desarquivar_contrato') {
        if (c) delete c.arquivado;
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
    if (op.t === 'arquivar_contrato' || op.t === 'desarquivar_contrato') return 'a:' + op.id;   // não junta com as edições do contrato
    return 'c:' + op.id;
  }
  // junta uma alteração nova com a que ainda espera na fila para o mesmo ponto/contrato
  function mergeOp(old, op) {
    if (old.t !== op.t && /arquivar_contrato$/.test(old.t) && /arquivar_contrato$/.test(op.t)) return null;   // arquivou e restaurou antes de subir
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
    nome: 'nome', kmIni: 'KM inicial', kmFim: 'KM final', enr: 'enrocamento (m³)', sb: 'solo-brita (m³)', bgs: 'BGS prevista (m³)', temBgs: 'campo de BGS nos pontos', rotulos: 'nomes das linhas só deste contrato', obs: 'observações', disp: 'dispositivos',
    numero: 'nº do contrato', lote: 'lote da licitação', executora: 'executora', supervisora: 'supervisora', ctSupervisao: 'contrato da supervisora',
    orgao: 'órgão', rodovia: 'rodovia', objeto: 'objeto', extensaoContrato: 'extensão do contrato', origem: 'sentido (de)', destino: 'sentido (para)',
    plataforma: 'largura da plataforma', dataVistoria: 'data da vistoria', porPagina: 'pontos por página', marcos: 'marcos',
    codigo: 'código da ponte', extensao: 'extensão (m)', largura: 'largura (m)', municipio: 'município', tipo: 'tipo de contrato',
    kmContrato: 'KM do contrato', kmConferir: 'KM a conferir', localRelatorio: 'local (relatório fotográfico)',
    kmLocal: 'km local (fora do eixo)', ramal: 'segmento do SNV do km local', estaca: 'km por estaca',
    kmIniContrato: 'KM inicial do contrato', kmFimContrato: 'KM final do contrato', snvContrato: 'SNV do contrato', snvVersao: 'versão do SNV do contrato', superficie: 'superfície da pista', rotuloTipo: 'nome do tipo na lista', rotuloKmContrato: 'rótulo do km do contrato', gruposExtras: 'grupos só deste contrato', kmFimMapa: 'fim do desenho no mapa', posEixo: 'posição no eixo', prazos: 'prazos', valores: 'valores (PI)',
    obsFolha: 'observações da folha', trechos: 'limites dos trechos', descricao: 'descrição', classe: 'classe do item'
  };
  // cid: o contrato do campo, quando se sabe. Na conservação, a mesma chave pode ter nome diferente na pista de revestimento
  // primário e na pavimentada (erosao: "Aterros e erosões" x "Aterros, erosões, barreiras"): vale o grupo do contrato
  function fieldName(k, cid) {
    if (k.indexOf('serv.') === 0) {
      var ck = k.slice(5), c = cid ? contractById(cid) : null;
      var s = (c ? servicesOf(c) : []).find(function (x) { return x.key === ck; }) || GRUPOS_TODOS.find(function (x) { return x.key === ck; });
      return s ? s.short : ck;
    }
    return FIELD_NAMES[k] || k;
  }
  // nome de tela do contrato pelo id, buscado neste aparelho (histórico, conflitos, propostas, lixeira); sem ele, o texto que veio
  function loteOf(cid, senao) { var c = contractById(cid); return c ? ctNome(c) || 'Contrato' : senao || 'Contrato'; }
  // prazos e valores (PI): rótulo aparado, cortado em 40 caracteres; situação por extenso
  function rotCurto(x) { var r = String((x && x.rotulo) || '').trim() || 'sem rótulo'; return r.length > 40 ? r.slice(0, 39) + '…' : r; }
  function sitNome(x) { return x && x.sit === 'conf' ? 'confirmado' : 'a confirmar'; }
  // valor (PI) em reais, sempre com centavos ("R$ 35.398.999,93"; fmtBRL arredonda), no histórico, nos avisos e na confirmação
  // de remover; sem número, "sem valor"
  function fmtPI(n) { return n == null || !isFinite(n) ? 'sem valor' : 'R$ ' + fmt(n, 2); }
  // o mesmo prazo ou valor pelo conteúdo (rótulo aparado, data, situação e valor), sem depender da ordem das chaves, que o
  // jsonb do banco devolve trocada: acha o item de novo depois de uma atualização do banco
  function itemChave(x) {
    x = x || {};
    return JSON.stringify([String(x.rotulo || '').trim(), x.data || null, x.sit === 'conf' ? 'conf' : 'prev', x.valor != null && x.valor !== '' ? x.valor : null]);
  }
  // o que mudou numa lista de prazos ou de valores, item a item pelo rótulo (aparado; rótulos repetidos, na ordem): a situação,
  // a data do prazo, o valor; novo, excluído ou só "alterado" (fonte, nota, fim de, data do valor). Trocar o rótulo dá um
  // excluído e um novo; só a ordem mudou = nada. a e v: a lista de antes e a de agora (sem lista = vazia)
  function listaDif(k, a, v) {
    var A = Array.isArray(a) ? a : [], B = Array.isArray(v) ? v : [], usado = [], out = [];
    function rot(x) { return String((x && x.rotulo) || '').trim(); }
    function val(x, q) { return x && x[q] != null && x[q] !== '' ? x[q] : null; }
    B.forEach(function (y) {
      var i = A.findIndex(function (x, j) { return !usado[j] && rot(x) === rot(y); });
      if (i < 0) { out.push(rotCurto(y) + ' (novo)'); return; }
      usado[i] = true;
      var x = A[i], d = [];
      if (Object.keys(x || {}).concat(Object.keys(y || {})).every(function (q) { return same(val(x, q), val(y, q)); })) return;
      if (sitNome(x) !== sitNome(y)) d.push(sitNome(x) + ' → ' + sitNome(y));
      if (k === 'prazos' && val(x, 'data') !== val(y, 'data')) d.push('data ' + (fmtDate(val(x, 'data')) || 'sem data') + ' → ' + (fmtDate(val(y, 'data')) || 'sem data'));
      if (k === 'valores' && val(x, 'valor') !== val(y, 'valor')) d.push(fmtPI(val(x, 'valor')) + ' → ' + fmtPI(val(y, 'valor')));
      out.push(rotCurto(y) + (d.length ? ': ' + d.join(' e ') : ' (alterado)'));
    });
    A.forEach(function (x, j) { if (!usado[j]) out.push(rotCurto(x) + ' (excluído)'); });
    return out;
  }
  // nomes dos campos alterados; prazos e valores com o que mudou pelo rótulo, no máximo 2 itens por operação (os dois
  // campos juntos) e "e mais N" logo depois da última das duas listas, não depois de um campo que vem em seguida
  // ("observações da folha"): o banco guarda só 300 caracteres do resumo
  function camposResumo(campos) {
    var vagas = 2, resto = 0, ult = -1;
    var s = Object.keys(campos).map(function (k, i) {
      if (k !== 'prazos' && k !== 'valores') return fieldName(k);
      var d = listaDif(k, campos[k].a, campos[k].v), mostra = d.slice(0, vagas);
      vagas -= mostra.length; resto += d.length - mostra.length; ult = i;
      return fieldName(k) + (mostra.length ? ': ' + mostra.join(', ') : '');
    });
    if (resto) s[ult] += ' e mais ' + resto;
    return s.join(', ');
  }
  // texto curto do que mudou, para o histórico. Na conservação, os segmentos novos do mesmo contrato num envio viram uma frase só
  // ("Conservação 437: 12 segmentos novos (S01 a S12)"; um só: "Conservação 437: segmento S13 (novo)") e a exclusão diz
  // "segmento excluído"; nos outros tipos, como sempre (o "(novo ponto)" das pontes também)
  function opsResumo(ops) {
    var names = [], segNovos = {};
    ops.forEach(function (op) {
      if (op.t === 'ponto' && isConserva(contractById(op.cid))) (segNovos[op.cid] = segNovos[op.cid] || []).push(op.dados.nome || '?');
    });
    ops.forEach(function (op) {
      var t, f = op.campos ? Object.keys(op.campos).map(function (k) { return fieldName(k, op.t === 'ponto_campos' ? op.cid : op.id); }).join(', ') : '', sg = segNovos[op.cid];
      if (op.t === 'ponto_campos') t = loteOf(op.cid) + ' ' + (op.nome || 'ponto') + (f ? ': ' + f : '');
      else if (op.t === 'ponto' && sg) t = loteOf(op.cid) + ': ' + (sg.length === 1 ? 'segmento ' + sg[0] + ' (novo)' : sg.length + ' segmentos novos (' + sg[0] + ' a ' + sg[sg.length - 1] + ')');
      else if (op.t === 'ponto') t = loteOf(op.cid) + ' ' + (op.dados.nome || 'ponto') + ' (novo ponto)';
      else if (op.t === 'apagar_ponto') t = loteOf(op.cid) + ' ' + (op.nome || '') + ': ' + itemTxt(contractById(op.cid)) + ' excluído';
      else if (op.t === 'contrato_campos') {
        t = loteOf(op.id, op.nome) + ': ' + (f || 'ordem das abas');
        // prazos e valores: o que mudou pelo rótulo, quando o texto do contrato cabe nos 300 caracteres (senão, só os nomes)
        var td = f && (op.campos.prazos || op.campos.valores) ? loteOf(op.id, op.nome) + ': ' + camposResumo(op.campos) : '';
        if (td && td.length <= 300) t = td;
      } else if (op.t === 'contrato') t = (ctNome(op.dados) || 'Contrato') + ' (novo contrato)';
      else if (op.t === 'apagar_contrato') t = 'Contrato excluído';
      else if (op.t === 'arquivar_contrato') t = loteOf(op.id, op.nome) + ': contrato arquivado';
      else if (op.t === 'desarquivar_contrato') t = loteOf(op.id, op.nome) + ': contrato restaurado do arquivo';
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
  // última vistoria da ponte ou do segmento: o grupo marcado (fora de sem vistoria) alterado por último; no segmento, também a
  // trafegabilidade (com trafSt: oaeSt dá sem vistoria para T, R e I)
  function vistoriaPonte(c, p) {
    var x = banco.on && banco.meta[metaKey(c.id, p.id)], best = null;
    if (!x) return null;
    servicesOf(c).concat(isConserva(c) ? [TRAFEG] : [], isPavimentada(c) ? DESEMP_IND : []).forEach(function (s) {
      // vist/vpor (migração 24, D-25): a última mudança de situação, quantidade ou percentual; sem eles, a última alteração
      var f = x.m && x.m['serv.' + s.key], t = f && Date.parse(f.vist || f.em);
      var marcado = s === TRAFEG ? trafSt(p.serv[s.key]) !== 'NV' : s.peso ? !!DESEMP_ST[p.serv[s.key]] : oaeSt(p.serv[s.key]) !== 'NV';
      if (isFinite(t) && marcado && (!best || t > best.t)) best = { t: t, por: f.vpor || f.por, em: f.vist || f.em };
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
    var kc = String(key).split(':')[1], f = l.campos.length && l.campos.length <= 4 ? ' · ' + esc(l.campos.map(function (k) { return fieldName(k, kc); }).join(', ')) : '';
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
    // trafegabilidade do segmento: o estado e a nota ("Com restrição (atoleiro no km 790)")
    if (campo === 'serv.' + TRAFEG.key && typeof v === 'object') return TRAF_STATUS[trafSt(v)].name + (v.n ? ' (' + v.n + ')' : '');
    // indicador do desempenho do segmento: "atende" / "não atende"
    if (campo && campo.indexOf('serv.desemp_') === 0) return DESEMP_ST[v] ? minus1(DESEMP_ST[v]) : 'não vistoriado';
    if (campo && campo.indexOf('serv.') === 0 && typeof v === 'object') {
      // grupo do serviço contínuo (pontes ou conservação), pela chave, que não se repete entre os tipos
      var so = OAE_SERVICES.concat(CONS_SERVICES, CONS_PAV_SERVICES, SIN_SERVICES).find(function (x) { return x.key === campo.slice(5); });
      if (so) {
        var k = oaeSt(v), qt = comQtd(k) ? fmtQtd(so, v.q) : '';
        var its = comQtd(k) ? itensDe(so.key, v).map(function (x) { return minus1(x.n); }) : [];
        return oaeStOf(so, k).name + (qt ? ' ' + qt : '') + (its.length ? ': ' + its.join(', ') : '') + (comQtd(k) && v.pri ? ', prioridade' : '') + (comQtd(k) && v.ci ? ', conclusão informada' : '') + (comQtd(k) && v.n ? ' (' + v.n + ')' : '');
      }
      var st = STATUS[v.st] ? STATUS[v.st].name : (v.st || '?');
      return st + (v.st === 'A' || v.st === 'P' ? ' ' + (Number(v.pct) || 0) + '%' : '');
    }
    // prazos e valores (PI): os itens pelo rótulo e a situação, até cerca de 300 caracteres (um item novo entra no fim da lista)
    if ((campo === 'prazos' || campo === 'valores') && Array.isArray(v)) {
      if (!v.length) return '(nenhum)';
      var its = v.map(function (x) { return rotCurto(x) + ' (' + sitNome(x) + ')'; }), nIt = 1;
      while (nIt < its.length && its.slice(0, nIt + 1).join('; ').length <= 300) nIt++;
      return its.slice(0, nIt).join('; ') + (its.length > nIt ? ' e mais ' + (its.length - nIt) : '');
    }
    // limites dos trechos (conservação): os km, como no formulário
    if (campo === 'trechos' && Array.isArray(v)) return v.length ? v.map(fmtKm).join('; ') : '(nenhum)';
    if (Array.isArray(v)) return v.length + (v.length === 1 ? ' item' : ' itens');
    if (typeof v === 'number') return fmt(v, v % 1 ? 2 : 0);
    var s = String(v);
    return '"' + (s.length > 60 ? s.slice(0, 57) + '…' : s) + '"';
  }
  function conflictText(x, autor) {
    // o banco manda o Lote como nome do contrato: a tela usa o nome do contrato deste aparelho, quando ele ainda existe
    var alvo = x.alvo === 'ponto' ? loteOf(x.cid) + ' ' + (x.nome || 'ponto') : loteOf(x.id, x.nome);
    var secs = !!(x.em && x.seu_em && fmtWhen(x.em) === fmtWhen(x.seu_em));   // no mesmo minuto: mostra os segundos
    var campo = x.campo ? ' · ' + fieldName(x.campo, x.alvo === 'ponto' ? x.cid : x.id) : '', quem = x.por || 'outra pessoa', quando = x.em ? ' (' + fmtWhen(x.em, secs) + ')' : '';
    var sua = autor ? 'a alteração de ' + autor : 'a sua alteração', seu = x.seu_em ? ' (' + fmtWhen(x.seu_em, secs) + ')' : '';
    // prazos e valores (PI), com a lista que este aparelho enviou (flush): o que ficou comparado item a item com o que saiu
    var dif = Array.isArray(x.enviado) ? listaDif(x.campo, x.tipo === 'perdeu' ? x.enviado : x.valor, x.tipo === 'perdeu' ? x.valor : x.enviado).join('; ') : '';
    if (x.tipo === 'perdeu') return alvo + campo + ': ficou o valor de ' + quem + ', que alterou depois' + quando + (dif ? '; do que ' + (autor || 'você') + ' enviou para o que ficou: ' + dif : ': ' + fmtValue(x.campo, x.valor)) + '. ' + sua.charAt(0).toUpperCase() + sua.slice(1) + seu + ' não entrou.';
    if (x.tipo === 'substituiu') return alvo + campo + ': ficou o ' + (autor ? 'valor de ' + autor : 'seu valor') + ', alterado por último' + seu + '. Substituiu o de ' + quem + quando + (dif ? '; do valor de ' + quem + ' para o que ficou: ' + dif : ': ' + fmtValue(x.campo, x.valor)) + '.';
    // "o segmento" na conservação (pelo contrato de x.cid neste aparelho); nos outros tipos, "o ponto"
    var it = itemTxt(x.cid ? contractById(x.cid) : null);
    if (x.tipo === 'nao_excluido') return alvo + ': não foi excluído, porque ' + quem + ' alterou o ' + it + ' depois' + quando + '.';
    if (x.tipo === 'excluido') return alvo + ': ' + (x.alvo === 'ponto' ? 'o ' + it : 'o contrato') + ' já tinha sido excluído por outra pessoa; ' + sua + ' nele não entrou.';
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
    if (aba.ro || !aba.pronto) { syncStatus(); return; }   // outra aba edita (ela é que envia), ou ainda não se sabe
    var ops = banco.pend.slice(0, banco.lote || 500), n = ops.length, envL = {}, envio = ++banco.envio;
    // prazos e valores (PI) são um campo só (fica a lista inteira de quem alterou por último): guarda a lista como sai agora,
    // para o aviso de conflito (a da fila é a mesma da tela e muda se alguém digitar durante o envio)
    ops.forEach(function (o) {
      if (o.t === 'contrato_campos' && o.campos) ['prazos', 'valores'].forEach(function (k) { if (o.campos[k] && 'v' in o.campos[k]) envL[o.id + '|' + k] = clone(o.campos[k].v); });
    });
    banco.busy = true;
    banco.sending = n;
    syncStatus();
    window.Banco.salvarCampos(banco.login.codigo, banco.login.nome, opsResumo(ops), ops).then(function (res) {
      if (envio !== banco.envio) { envioVelho(envio, true); return; }   // saiu ou entrou outra pessoa no meio do envio
      var v = Number(res && res.versao), conf = (res && res.conflitos) || [];
      banco.busy = false;
      banco.sending = 0;
      banco.online = true;
      banco.at = new Date();
      banco.pend = banco.pend.filter(function (o) { return ops.indexOf(o) < 0; });   // só as que foram neste envio
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
      conf.forEach(function (x) { var en = x.alvo === 'contrato' && envL[x.id + '|' + x.campo]; if (Array.isArray(en)) x.enviado = en; });
      if (conf.length) { showConflicts(conf); refresh(); }          // o banco ficou com outro valor em algum campo
      else if (v === banco.versao + 1) { banco.versao = v; refreshLastLines(); }
      else refresh();                                                // outra pessoa gravou no meio: recarrega
      keepSync();
      if (banco.pend.length) scheduleFlush(300);
      syncStatus();
    }, function (err) {
      if (envio !== banco.envio) { envioVelho(envio, false); return; }
      banco.busy = false;
      banco.sending = 0;
      var code = err && err.code;
      if (code === 'sem_rede') { banco.online = false; syncStatus(); return; }
      if (code === 'codigo_invalido') { logout(true); toast('Seu acesso mudou ou foi desativado. Entre de novo para enviar as alterações deste aparelho.', 7000); return; }
      if (code === 'muitas_tentativas') { toast('O banco bloqueou esta rede por muitas tentativas com código errado. Tente de novo em 5 minutos.', 7000); syncStatus(); return; }
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
      var op = ops[0];
      if (!guardarRecusada(op, err)) {   // sem espaço no aparelho para guardar: não apaga; avisa e para de tentar
        banco.espera = Date.now() + 300000;
        toast('O banco recusou uma alteração e não há espaço neste aparelho para guardá-la à parte. Ela continua na fila: salve um backup (menu Dados).', 9000);
        syncStatus();
        return;
      }
      banco.pend = banco.pend.filter(function (o) { return o !== op; });
      if (!banco.pend.length) banco.lote = 0;
      keepSync();
      toast((code === 'so_status' ? 'Fiscal de campo só altera o status dos serviços.' : code === 'so_admin_arquiva' ? 'Só o Administrador arquiva contratos.' : 'O banco recusou uma alteração (' + ((err && err.message) || 'erro') + ').') +
        ' A alteração "' + opsResumo([op]) + '" ficou guardada em Dados › Alterações guardadas; as outras seguem para o banco.', 9000);
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
  // Alterações guardadas neste aparelho (Dados › Alterações guardadas), cada uma com quem fez:
  //   tipo 'recusada': o banco recusou de vez (dado ou permissão);
  //   tipo 'sessao': a sessão terminou (saiu, o acesso mudou, entrou outra pessoa) antes de ela subir. Volta sozinha para a
  //   fila quando a mesma pessoa entrar de novo; nunca sobe com o código de outra pessoa (o Administrador reenvia em nome dela,
  //   e o histórico diz de quem era).
  //   envio: o nº do envio que estava a caminho do banco quando a sessão terminou (se a resposta chegar e gravou, sai daqui)
  function recusadas() { var l = lsGet(RECUSA_KEY); return Array.isArray(l) ? l : []; }
  function gravarRecusadas(l) { if (aba.ro) return false; try { if (l.length) localStorage.setItem(RECUSA_KEY, JSON.stringify(l)); else localStorage.removeItem(RECUSA_KEY); return true; } catch (e) { return false; } }
  function autorAgora() { var l = banco.login; return { por: (l && l.nome) || null, uid: (l && l.uid) || null, papel: (l && l.papel) || null }; }
  function guardarRecusada(op, err) {
    var a = autorAgora(), l = recusadas();
    l.push({ em: new Date().toISOString(), por: a.por, uid: a.uid, papel: a.papel, tipo: 'recusada', erro: (err && err.message) || 'erro', op: op });
    return gravarRecusadas(l);
  }
  function chaveGuardada(x) { return String(x.em) + '|' + JSON.stringify(x.op); }
  // a alteração guardada é desta pessoa? (pelo id da conta; as antigas, sem id, pelo nome; sem nome nenhum: de quem estiver)
  function minhaGuardada(x, l) { l = l || banco.login; if (!l) return false; return x.uid ? x.uid === l.uid : !x.por || x.por === l.nome; }
  // a sessão terminou com alterações na fila: guarda com o nome de quem fez (as que estavam a caminho, marcadas com o envio)
  var guardadasMem = null, ultimaGuarda = '';   // sem espaço para guardar: ficam aqui até a pessoa baixar o arquivo
  function guardarDaSessao(ops, envio, nEnvio) {
    var a = autorAgora(), em = new Date().toISOString();
    var novas = ops.map(function (op, i) {
      var x = { em: em, por: a.por, uid: a.uid, papel: a.papel, tipo: 'sessao', erro: 'a sessão terminou antes de enviar', op: op };
      if (envio && i < nEnvio) x.envio = envio;
      return x;
    });
    if (gravarRecusadas(recusadas().concat(novas))) {
      ultimaGuarda = ops.length + (ops.length === 1 ? ' alteração que não tinha subido ficou guardada' : ' alterações que não tinham subido ficaram guardadas') + ' com o nome de ' + (a.por || 'quem saiu') + '. ' +
        (ops.length === 1 ? 'Sobe' : 'Sobem') + ' quando você entrar de novo neste aparelho.';
      toast(ops.length + (ops.length === 1 ? ' alteração que não tinha subido ficou guardada' : ' alterações que não tinham subido ficaram guardadas') + ' com o nome de ' + (a.por || 'quem saiu') +
        ' (Dados › Alterações guardadas). ' + (ops.length === 1 ? 'Sobe' : 'Sobem') + ' quando ' + (a.por || 'a pessoa') + ' entrar de novo neste aparelho.', 9000);
      return;
    }
    guardadasMem = (guardadasMem || []).concat(novas);
    setTimeout(avisarGuardadasMem, 400);
  }
  function avisarGuardadasMem() {
    if (!guardadasMem || !guardadasMem.length) return;
    var n = guardadasMem.length;
    var f = modal('<h2 id="modalTitle">Alterações sem lugar para guardar</h2><p>' + n + (n === 1 ? ' alteração não tinha subido' : ' alterações não tinham subido') +
      ' quando a sessão terminou, e este aparelho está sem espaço para guardá-las. Baixe o arquivo agora: se o app fechar, elas se perdem.</p>' +
      '<div class="modal-foot"><button type="button" class="btn primary" data-mem="baixar">Baixar (.json)</button></div>');
    f.addEventListener('click', function (e) {
      if (!e.target.closest('[data-mem]')) return;
      saveBlob('alteracoes-guardadas-' + todayIso() + '.json', new Blob([JSON.stringify(guardadasMem, null, 2)], { type: 'application/json' }), 'Arquivo das alterações salvo.');
      guardadasMem = null;
      closeModal();
    });
  }
  // a resposta de um envio que estava a caminho quando a sessão terminou: se gravou, as guardadas dele saem; senão ficam
  function envioVelho(envio, gravou) {
    var l = recusadas();
    if (gravou) gravarRecusadas(l.filter(function (x) { return x.envio !== envio; }));
    else { l.forEach(function (x) { if (x.envio === envio) delete x.envio; }); gravarRecusadas(l); }
    banco.busy = false;
    syncStatus();
    if (banco.pend.length && banco.login) scheduleFlush(300);
  }
  // a pessoa entrou de novo: as alterações dela que a sessão anterior deixou guardadas voltam para a fila
  function devolverGuardadas(l) {
    var todas = recusadas(), minhas = todas.filter(function (x) { return x.tipo === 'sessao' && (x.uid ? x.uid === l.uid : !!x.por && x.por === l.nome); });
    if (!minhas.length) return;
    if (!gravarRecusadas(todas.filter(function (x) { return minhas.indexOf(x) < 0; }))) return;
    enqueue(minhas.map(function (x) { return x.op; }));
    banco.espera = 0;
    scheduleFlush(1500);
    // depois do "Olá" da entrada, que tomaria o lugar deste aviso
    setTimeout(function () { toast(minhas.length + (minhas.length === 1 ? ' alteração sua que estava guardada voltou' : ' alterações suas que estavam guardadas voltaram') + ' para a fila e ' + (minhas.length === 1 ? 'sobe' : 'sobem') + ' agora.', 6000); }, 2500);
  }
  // cada pessoa vê e manda de novo só as dela; o Administrador vê todas e reenvia as de outra pessoa em nome dela
  function openRecusadas() {
    if (!banco.login) { toast('Entre com o seu código para ver as alterações guardadas neste aparelho.', 5000); return; }
    var todas = recusadas(), adm = isAdmin(), grupos = [], porK = {};
    todas.forEach(function (x) {
      if (!adm && !minhaGuardada(x)) return;
      var k = x.uid || ('n:' + (x.por || ''));
      if (!porK[k]) { porK[k] = { autor: x.por || 'sem nome', papel: x.papel, minha: minhaGuardada(x), itens: [] }; grupos.push(porK[k]); }
      porK[k].itens.push(x);
    });
    if (!grupos.length) { toast(todas.length ? 'As alterações guardadas neste aparelho são de outra pessoa: só ela ou o Administrador as veem.' : 'Nenhuma alteração guardada neste aparelho.', 5000); return; }
    var f = modal('<h2 id="modalTitle">Alterações guardadas neste aparelho</h2>' +
      '<p>Não foram gravadas no banco: ou o banco recusou, ou a sessão terminou antes de elas subirem. As da sessão voltam sozinhas quando a pessoa entra de novo neste aparelho.</p>' +
      grupos.map(function (g, gi) {
        return '<h3 class="rec-autor">' + esc(g.autor) + (g.papel ? ' · ' + esc(papelNome(g.papel)) : '') + ' · ' + g.itens.length + '</h3><ul class="rec-lista">' + g.itens.map(function (x) {
          return '<li><b>' + esc(opsResumo([x.op])) + '</b><small>' + esc(new Date(x.em).toLocaleString('pt-BR')) + ' · ' + (x.tipo === 'sessao' ? 'a sessão terminou antes de enviar' : 'recusada pelo banco: ' + esc(x.erro)) + '</small></li>';
        }).join('') + '</ul><div class="modal-foot rec-acoes">' +
          '<button type="button" class="btn danger" data-rec="apagar" data-g="' + gi + '">Apagar</button>' +
          '<button type="button" class="btn" data-rec="baixar" data-g="' + gi + '">Baixar (.json)</button>' +
          (g.minha ? '<button type="button" class="btn primary" data-rec="reenviar" data-g="' + gi + '">Mandar de novo</button>'
            : adm ? '<button type="button" class="btn primary" data-rec="admin" data-g="' + gi + '">Reenviar em nome de ' + esc(g.autor) + '</button>' : '') + '</div>';
      }).join('') +
      '<div class="modal-foot"><button type="button" class="btn" data-close>Fechar</button></div>');
    function tirar(g) {
      var ks = g.itens.map(chaveGuardada);
      return gravarRecusadas(recusadas().filter(function (x) { return ks.indexOf(chaveGuardada(x)) < 0; }));
    }
    f.addEventListener('click', function (e) {
      var b = e.target.closest('[data-rec]');
      if (!b) return;
      var k = b.dataset.rec, g = grupos[Number(b.dataset.g)];
      if (!g) return;
      var ops = g.itens.map(function (x) { return x.op; });
      if (k === 'baixar') {
        saveBlob('alteracoes-guardadas-' + todayIso() + '.json', new Blob([JSON.stringify(g.itens, null, 2)], { type: 'application/json' }), 'Arquivo das alterações guardadas salvo.');
      } else if (k === 'reenviar') {
        if (!tirar(g)) { toast('Não deu para mexer na lista deste aparelho.'); return; }
        closeModal();
        enqueue(ops);
        keepSync();
        banco.espera = 0;
        refresh();          // mostra o banco com estas alterações por cima, como as outras da fila
        scheduleFlush(300);
        toast('Mandando de novo ' + ops.length + (ops.length === 1 ? ' alteração.' : ' alterações.'));
      } else if (k === 'admin') {
        closeModal();
        confirmar({ titulo: 'Reenviar as alterações de ' + g.autor + '?', texto: ops.length + (ops.length === 1 ? ' alteração vai' : ' alterações vão') + ' direto para o banco, sem passar pela aprovação. O histórico registra que eram de ' + g.autor + ' e que você reenviou.', botao: 'Reenviar' }).then(function (r) {
          if (!r) return;
          var me = banco.login.nome || 'Administrador', resumo = ('Reenviado por ' + me + ' (de ' + g.autor + '): ' + opsResumo(ops)).slice(0, 300);
          window.Banco.salvarCampos(banco.login.codigo, me, resumo, ops).then(function (res) {
            tirar(g);
            var conf = (res && res.conflitos) || [];
            if (conf.length) showConflicts(conf);
            refresh();
            toast('Reenviadas ' + ops.length + (ops.length === 1 ? ' alteração' : ' alterações') + ' de ' + g.autor + '.', 5000);
          }, function (err) {
            toast('Não deu para reenviar agora (' + ((err && err.message) || 'erro') + '). Continuam guardadas.', 7000);
          });
        });
      } else if (k === 'apagar') {
        closeModal();
        confirmar({ titulo: 'Apagar as alterações guardadas de ' + g.autor + '?', texto: 'Elas somem deste aparelho. Se quiser guardar, baixe o arquivo antes.', botao: 'Apagar', perigo: true }).then(function (r) {
          if (!r) return;
          tirar(g);
          toast('Apagadas deste aparelho.');
        });
      }
    });
  }
  function typing() {
    var a = document.activeElement;
    // a caixa de marcar da caixa "Contratos" (Visão geral) fica com o foco depois de cada toque e não é digitação: não
    // adia a atualização do banco
    if (a && a.type === 'checkbox' && a.closest && a.closest('#visaoHost, #medicoesHost')) return false;
    return !!(a && a.closest && a.closest('#editor, #visaoHost, #medicoesHost') && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
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
    // aba só de consulta: a fila é a da aba que edita (relê a que ela gravou)
    if (aba.ro) { var sk = lsGet(SYNC_KEY); banco.pend = sk && Array.isArray(sk.pend) ? sk.pend : []; }
    var credR = banco.login && banco.login.codigo;
    return window.Banco.carregar(credR).then(function (r) {
      if (!force && typing()) { banco.want = true; return; }
      // a resposta é de outra sessão (saiu ou entrou outra pessoa no meio): descarta
      if ((banco.login && banco.login.codigo) !== credR) return;
      // sessão vencida ou desativada em outro aparelho: o banco mandou só a visão pública; confere o acesso (sai)
      if (r.sessaoInvalida && banco.login) { conferirAcesso(); return; }
      if (r.novo) { banco.acesso = r.acesso || null; podarAnalise(); }
      banco.online = true;
      banco.at = new Date();
      banco.versao = r.versao;
      var cfg = {};
      r.config.forEach(function (x) { cfg[x.chave] = x.valor; });
      var logoMudou = !same(cfg.fotoLogo || null, banco.cfg.fotoLogo || null);
      banco.cfg = cfg;
      banco.propostas = Array.isArray(r.propostas) ? r.propostas : [];
      // r.novo: o banco já filtrou pelo acesso (dados_ler): vale mesmo vazio (nenhum contrato liberado)
      if (r.contratos.length || r.novo) {
        if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
        trackChanges();   // o que acabou de ser mudado aqui entra na fila antes de trocar o estado
        state = normalize(applyOps(fromServer(r), banco.pend));
        separarArquivados(state);
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
    conferirMedNovas();
    window.Banco.versao().then(function (v) {
      banco.online = true;
      if (v !== banco.versao && !banco.busy) refresh(); else syncStatus();
    }, function () { banco.online = false; syncStatus(); });
  }
  function hhmm(d) { return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function syncStatus() {
    if (!banco.on) return;
    var el = $('saveState'), n = banco.pend.length, t, warn = false;
    if (aba.ro) { t = 'Só consulta: o app está aberto em outra aba'; warn = true; }
    else if (n && banco.semEspaco) { t = 'Aparelho sem espaço · ' + n + (n === 1 ? ' alteração só na memória' : ' alterações só na memória') + ' · salve um backup'; warn = true; }
    else if (banco.busy) t = 'Enviando ao banco…';
    else if (n && !banco.login) { t = n + (n === 1 ? ' alteração não enviada' : ' alterações não enviadas') + ': entre para enviar'; warn = true; }
    else if (n && banco.falhas) { t = 'Banco com falha · ' + n + (n === 1 ? ' alteração guardada' : ' alterações guardadas') + ' · tenta de novo às ' + hhmm(new Date(banco.espera)); warn = true; }
    else if (n && isFiscal()) { t = (banco.online === false ? 'Sem sinal · ' : '') + n + (n === 1 ? ' mudança para enviar à aprovação' : ' mudanças para enviar à aprovação'); warn = banco.online === false; }
    else if (n) { t = (banco.online === false ? 'Sem sinal · ' : '') + n + (n === 1 ? ' alteração aguardando' : ' alterações aguardando'); warn = banco.online === false; }
    else if (banco.online === false) { t = 'Sem sinal · cópia deste aparelho'; warn = true; }
    else if (banco.at) t = (window.AMBIENTE && AMBIENTE.previa ? 'Banco de teste · ' : 'Banco da equipe · ') + hhmm(banco.at);
    else t = 'Conectando ao banco…';
    if (localFalhou && !aba.ro) { t += ' · não salvou no navegador'; warn = true; }
    var dq = driveQ && driveReady() ? driveQ.info() : null;
    if (dq && dq.n) { t += ' · ' + dq.n + (dq.n === 1 ? ' foto' : ' fotos') + ' para o Drive'; warn = warn || !banco.login || dq.erro === 'codigo' || dq.erro === 'recusado' || dq.erro === 'script'; }
    el.textContent = t;
    el.classList.toggle('warn', warn);
    var me = $('menuEstado');
    if (me) { me.textContent = t; me.hidden = false; }
  }

  // ---------------- acesso: cada pessoa entra com o próprio código (criador, engenheiro ou fiscal de campo).
  // A entrada vira uma sessão (token "tk_..." guardado em banco.login.codigo), que vale até a pessoa sair ou o criador
  // trocar/desativar o acesso dela. Os códigos gerais antigos (equipe/responsável) ainda entram, pedindo o nome.
  // inicio: a sessão guardada ao abrir o app (os dados do aparelho são dela). Ao sair ou ao entrar outra pessoa, o que este
  // aparelho guardou do banco era do acesso anterior: sai antes de mostrar (o próximo refresh traz só o que o novo acesso vê)
  // a mesma pessoa com o mesmo papel: trocar de pessoa, ou a mesma pessoa com outro papel, limpa o aparelho
  function mesmaPessoa(a, b) { return !a && !b || !!(a && b && (a.codigo === b.codigo || (a.uid && a.uid === b.uid)) && a.papel === b.papel); }
  function setLogin(l, inicio) {
    var limpou = banco.on && !inicio && !mesmaPessoa(banco.login, l);
    if (limpou) limparDadosAparelho();
    banco.login = l;
    lsPut(LOGIN_KEY, l);
    if (banco.on && l) devolverGuardadas(l);
    // o aparelho ficou vazio: lê o banco já com o acesso novo (sem esperar alguém gravar algo para a versão mudar)
    if (limpou) { banco.versao = 0; setTimeout(function () { refresh(true); }, 0); }
    analiseInit();
    aplicaPapel();
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
    var ml = $('menuLogin'), mh = $('menuLoginHr');
    if (ml) { ml.hidden = !banco.on; ml.textContent = b ? b.textContent : 'Entrar'; }
    if (mh) mh.hidden = !banco.on;
    // itens do menu Dados conforme o papel
    // fiscal e analista: sem backup (o menu fica com a conta, o PDF e a impressão do que veem)
    var equipe = !banco.on || isEng();
    var show = { arquivados: isAdmin(), lixeira: isEng(), usuarios: isResp(), cargamed: banco.on && isEng(), mpversoes: banco.on && isEng(), aprovar: isEng() || (isFiscal() && minhasPropostas() > 0), restore: !banco.on || isResp(), relfoto: isEng() && galeriaOn(), backup: equipe };
    Object.keys(show).forEach(function (k) {
      var el = document.querySelector('#menuPop [data-act="' + k + '"]');
      if (el) el.hidden = !show[k];
    });
  }
  // contratos arquivados (decisão D-2): saem de todas as telas, mas os dados ficam no banco; só o Administrador os recebe e
  // restaura (Dados › Contratos arquivados). Aqui fica só o resumo de cada um
  function separarArquivados(s) {
    var arq = [], ids = {};
    s.contracts = s.contracts.filter(function (c) {
      if (!c.arquivado) return true;
      ids[c.id] = true;
      arq.push({ id: c.id, nome: ctNome(c) || 'Contrato', completo: ctCompleto(c), n: c.pontos.length, it: itensTxt(c), em: c.arquivado.em || null, por: c.arquivado.por || null });
      return false;
    });
    banco.arquivados = arq;
    banco.propostas = (banco.propostas || []).filter(function (x) { return !ids[x.contrato_id]; });
    if (!s.contracts.some(function (c) { return c.id === s.activeId; })) s.activeId = s.contracts[0] ? s.contracts[0].id : null;
  }
  function openArquivados() {
    if (!isAdmin()) { toast('Só o Administrador vê os contratos arquivados.'); return; }
    var l = banco.arquivados || [];
    var f = modal('<h2 id="modalTitle">Contratos arquivados</h2>' +
      '<p>Saíram de todas as telas, para todos. Nada foi apagado: os ' + itensTxt(null) + ', as fotos e as medições continuam no banco. Ao restaurar, o contrato volta como estava.</p>' +
      (l.length ? '<ul class="rec-lista">' + l.map(function (x, i) {
        return '<li><b>' + esc(x.completo || x.nome) + '</b><small>' + x.n + ' ' + esc(x.it || 'pontos') + (x.em ? ' · arquivado em ' + esc(new Date(x.em).toLocaleString('pt-BR')) : '') + (x.por ? ' por ' + esc(x.por) : '') + '</small>' +
          '<button type="button" class="btn small" data-arq="' + i + '">Restaurar</button></li>';
      }).join('') + '</ul>' : '<p><b>Nenhum contrato arquivado.</b></p>') +
      '<div class="modal-foot"><button type="button" class="btn" data-close>Fechar</button></div>');
    f.addEventListener('click', function (e) {
      var b = e.target.closest('[data-arq]');
      if (!b) return;
      var x = l[Number(b.dataset.arq)];
      if (!x) return;
      closeModal();
      enqueue([{ t: 'desarquivar_contrato', id: x.id, nome: x.nome, em: new Date().toISOString() }]);
      banco.arquivados = banco.arquivados.filter(function (y) { return y.id !== x.id; });
      keepSync();
      banco.espera = 0;
      scheduleFlush(0);
      setTimeout(function () { refresh(true); }, 1500);
      toast('Restaurando ' + x.nome + '. Ele volta para a lista assim que o banco responder.', 6000);
    });
  }
  function limparDadosAparelho() {
    if (medicoes) medicoes.limpar();
    flushSave();   // o último toque de quem sai entra na fila dele antes de guardar
    state = { version: (state && state.version) || 1, activeId: null, contracts: [] };
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* sem armazenamento */ }
    // as alterações que não subiram são da pessoa anterior: não vão com o código de quem entra agora. Ficam guardadas com o
    // nome dela e voltam quando ela entrar de novo (guardarDaSessao)
    if (banco.pend.length) guardarDaSessao(banco.pend, banco.busy ? banco.envio : 0, banco.sending);
    banco.envio++;   // a resposta de um envio a caminho não mexe mais na fila
    banco.pend = []; banco.sending = 0; banco.cfg = {}; banco.conf = []; banco.arquivados = [];
    banco.base = clone(state); banco.meta = {}; banco.propostas = []; banco.acesso = null;
    lsPut(AN_KEY, null);
    if (window.GaleriaLimparCache) window.GaleriaLimparCache();
    // a galeria aberta por quem saiu (listas do Drive e do banco guardadas por alguns minutos) não serve para quem entra (A8)
    if (galeria) { try { galeria.close(true); } catch (e) { /* já fechada */ } galeria = null; }
    // a Foto com carimbo aberta por quem saiu: grava a última mudança como dela e fecha (não fica para quem entra)
    if (foto && foto.fechar) { try { foto.fechar(); } catch (e) { /* já fechada */ } }
    setVisao(true);
    keepSync();
  }
  // classes do corpo conforme o papel e o contrato aberto (o CSS esconde o que o papel não usa)
  function aplicaPapel() {
    if ($('menuMedicoes')) $('menuMedicoes').hidden = !temMedicoes();
    var c = state && state.contracts.length ? active() : null, b = document.body.classList;
    b.toggle('ro', readOnly());
    b.toggle('fiscal', isFiscal());
    b.toggle('analista', isAnalista());
    b.toggle('publico', isPublico());
    b.toggle('sem-diagrama', !!c && !podeDiagrama(c));
    b.toggle('sem-mapa', !!c && !podeMapa(c));
    b.toggle('sem-fotos', !podeFotos(c));
  }
  function logout(silent) {
    setLogin(null);
    renderAll();
    syncStatus();
    if (!silent) toast(ultimaGuarda ? 'Você saiu. ' + ultimaGuarda : 'Você saiu. Sem o código, este aparelho mostra só a visão geral.', ultimaGuarda ? 8000 : undefined);
    ultimaGuarda = '';
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

  // aoCancelar: chamado quando a pessoa fecha sem confirmar (Cancelar, ×, Esc ou toque fora)
  function modal(html, onSubmit, cls, aoCancelar) {
    closeModal();
    var m = document.createElement('div');
    m.className = 'modal';
    m.id = 'modal';
    m.innerHTML = '<form class="modal-box' + (cls ? ' ' + cls : '') + '" role="dialog" aria-modal="true" aria-labelledby="modalTitle" novalidate>' + html + '</form>';
    (document.fullscreenElement || document.body).appendChild(m);
    var f = m.querySelector('form');
    f.addEventListener('submit', function (e) { e.preventDefault(); if (onSubmit) onSubmit(f); });
    function cancela() { if (m.dataset.ocupado) return; closeModal(); if (aoCancelar) aoCancelar(); }
    m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('[data-close]')) cancela(); });
    m.addEventListener('keydown', function (e) { if (e.key === 'Escape') cancela(); });
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
      : c === 'muitas_tentativas' ? 'Muitas tentativas erradas nesta rede (Wi-Fi ou dados do celular). Espere 5 minutos e tente de novo.'
      : c === 'codigo_curto' ? 'O código precisa de pelo menos 6 caracteres (o do Administrador, 8).'
      : c === 'codigo_admin' ? 'Para dar acesso de Administrador, defina um código novo com pelo menos 8 caracteres.'
      : c === 'codigo_em_uso' ? 'Esse código já é de outra pessoa (ou é um código geral). Escolha outro.'
      : c === 'nome_em_uso' ? 'Já existe um usuário com esse nome.'
      : c === 'ultimo_criador' ? 'Precisa ficar pelo menos um Administrador ativo.'
      : c === 'so_criador' ? 'Só o Administrador e os engenheiros podem fazer isso.'
      : c === 'so_admin' ? 'Só o Administrador mexe na conta de um Administrador.'
      : c === 'acesso_invalido' ? 'Os contratos escolhidos não vieram certos. Tente de novo.'
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
  // o.marcar: {texto, padrao} caixa de marcar opcional (ex.: "Apagar também deste celular").
  // Devolve null (cancelou) ou {valor, marcado}.
  function semAcento(t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase(); }
  function confirmar(o) {
    return new Promise(function (resolve) {
      var f = modal('<h2 id="modalTitle">' + esc(o.titulo) + '</h2>' + (o.html || (o.texto ? '<p>' + esc(o.texto) + '</p>' : '')) +
        (o.campo ? '<div class="field"><label for="cfCampo">' + esc(o.campo) + '</label><input id="cfCampo" maxlength="300" autocomplete="off"></div>' : '') +
        (o.marcar ? '<label class="cf-marca"><input type="checkbox" id="cfMarca"' + (o.marcar.padrao ? ' checked' : '') + '> <span>' + esc(o.marcar.texto) + '</span></label>' : '') +
        (o.digitar ? '<div class="field cf-dig"><label for="cfDig">Para confirmar, digite <b>' + esc(o.digitar) + '</b></label><input id="cfDig" autocomplete="off" autocorrect="off" spellcheck="false"></div>' : '') +
        '<div class="modal-foot"><button type="button" class="btn" data-close>' + esc(o.cancelar || 'Cancelar') + '</button>' +
        '<button type="submit" class="btn ' + (o.perigo ? 'danger-solid' : 'primary') + '"' + (o.digitar ? ' disabled' : '') + '>' + esc(o.botao || 'Confirmar') + '</button></div>',
      function (form) {
        if (o.digitar && semAcento(form.querySelector('#cfDig').value) !== semAcento(o.digitar)) return;
        var c = form.querySelector('#cfCampo');
        var m = form.querySelector('#cfMarca');
        var v = { valor: c ? c.value.trim() : '', marcado: !!(m && m.checked) };
        closeModal();
        resolve(v);
      }, null, function () { resolve(null); });   // cancelou: quem chamou reabre a lista de onde veio
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
      ? 'Olá, ' + r.nome + '. Como fiscal de campo, você faz a vistoria e tira as fotos dos seus contratos; um engenheiro aprova as mudanças.'
      : r.papel === 'analista' ? 'Olá, ' + r.nome + '. Como analista, você consulta os contratos liberados para você.'
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
      '<p>Este aparelho entrou como <b>' + esc(papelNome(banco.login.papel)) + '</b>.' + (isFiscal() ? ' Você faz a vistoria e tira as fotos dos seus contratos; um engenheiro aprova as mudanças.' :
        isAnalista() ? ' Você consulta os contratos liberados para você, sem editar.' : '') + '</p>' +
      '<div class="modal-list">' +
      (isEng() ? '<button type="button" class="btn" data-acc="aprov">Aprovar mudanças dos fiscais' + (n ? ' (' + n + ')' : '') + '</button>' : '') +
      (isResp() ? '<button type="button" class="btn" data-acc="users">Usuários e acessos</button>' : '') +
      (isEng() ? '<button type="button" class="btn" data-acc="lixeira">Lixeira e cópias de segurança</button>' : '') +
      (isEng() ? '<button type="button" class="btn" data-acc="hist">Histórico de alterações</button>' : '') +
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
        // as alterações que não subiram ficam guardadas com o nome de quem sai (limparDadosAparelho) e sobem quando ele voltar
        var sair = function () {
          var tok = banco.login && banco.login.codigo;
          closeModal(); logout(); refresh(true);
          if (tok && String(tok).indexOf('tk_') === 0) window.Banco.sair(tok).catch(function () { /* sem sinal: a sessão expira sozinha */ });
        };
        if (!banco.pend.length) { sair(); return; }
        confirmar({ titulo: 'Sair com alterações sem enviar?', texto: 'Há ' + banco.pend.length + (banco.pend.length === 1 ? ' alteração' : ' alterações') + ' deste aparelho que ainda não ' + (banco.pend.length === 1 ? 'subiu' : 'subiram') + ' para o banco. ' + (banco.pend.length === 1 ? 'Ela fica guardada' : 'Elas ficam guardadas') + ' neste aparelho com o seu nome e ' + (banco.pend.length === 1 ? 'sobe' : 'sobem') + ' quando você entrar de novo aqui.', botao: 'Sair e guardar' })
          .then(function (r) { if (r) sair(); });
      }
    });
  }
  function openHist() {
    var f = modal('<h2 id="modalTitle">Histórico de alterações</h2><div class="hist" aria-live="polite">Carregando…</div><div class="modal-foot"><button type="button" class="btn" data-close>Fechar</button></div>', null, 'wide');
    window.Banco.historico(60, banco.login && banco.login.codigo).then(function (rows) {
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
    { k: 'engenheiro', nome: 'Engenheiro', desc: 'O mesmo que o Administrador: edita tudo, aprova, vê as medições e as fotos de todos, cadastra pessoas e volta os dados para uma cópia. Só não mexe na conta de um Administrador.' },
    { k: 'auxiliar', nome: 'Auxiliar de engenharia', desc: 'Edita tudo, aprova as mudanças dos fiscais, restaura da lixeira, vê as medições e as fotos de todos. Não cadastra pessoas.' },
    { k: 'analista', nome: 'Analista', desc: 'Só consulta, nos contratos marcados abaixo: as medições, o acompanhamento (pontos e status, diagrama e PDF, mapa) ou os dois. Onde tem as medições, também tira fotos e vê as que tirou.', ct: 'analista' },
    { k: 'fiscal', nome: 'Fiscal de campo', desc: 'Nos contratos marcados abaixo: faz a vistoria e muda o status dos serviços (fica aguardando aprovação), tira e envia fotos e vê só as que tirou. Sem diagrama e sem PDF.', ct: 'fiscal' },
    { k: 'criador', nome: 'Administrador', desc: 'Tudo, inclusive cadastrar pessoas, outros Administradores e voltar os dados para uma cópia.' }
  ];
  function gerarCodigo() {
    var A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = new Uint32Array(8), s = '';
    (window.crypto || window.msCrypto).getRandomValues(r);
    for (var i = 0; i < 8; i++) s += A[r[i] % A.length];
    return s.slice(0, 4) + '-' + s.slice(4);
  }
  function openUsuarios() {
    if (!isResp()) { toast('Só o Administrador e os engenheiros cadastram pessoas.'); return; }
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
          var pp = PAPEIS.find(function (x) { return x.k === u.papel; }) || PAPEIS[0], nct = u.acesso ? Object.keys(u.acesso).length : 0;
          var podeEd = r.pode_admin || u.papel !== 'criador';   // o engenheiro não mexe na conta de um Administrador
          return '<div class="us-row' + (u.ativo ? '' : ' off') + '"><div class="us-txt"><b>' + esc(u.nome) + '</b> <span class="tag t-' + esc(u.papel) + '">' + esc(pp.nome) + '</span>' +
            (u.ativo ? '' : ' <span class="tag t-off">desativado</span>') + (u.id === r.eu ? ' <span class="tag">você</span>' : '') +
            '<small>' + (pp.ct ? (nct ? nct + (nct === 1 ? ' contrato' : ' contratos') : 'nenhum contrato liberado') + ' · ' : '') +
            (u.usado_em ? 'Último uso: ' + esc(fmtWhen(u.usado_em)) + ' · ' + u.aparelhos + (u.aparelhos === 1 ? ' aparelho' : ' aparelhos') : 'Ainda não entrou') + '</small></div>' +
            (podeEd ? '<button type="button" class="btn small" data-us="edit" data-id="' + esc(u.id) + '">Editar</button>' : '') + '</div>';
        }).join('') : '<p class="empty">Ninguém cadastrado ainda. Use “+ Nova pessoa”.</p>';
        if (r.codigo_equipe || r.codigo_responsavel) {
          var gs = r.gerais || [];
          h += '<div class="section-title">Códigos gerais (do sistema antigo)</div>' +
            '<p class="hint">Ainda entram, pedindo o nome. Cadastre cada pessoa abaixo com o código próprio (com o mesmo nome, as alterações ' +
            'guardadas no aparelho dela sobem sozinhas quando ela entrar com o código novo). Quando a lista ficar vazia, desative.</p>' +
            (gs.length ? '<div class="us-gerais"><b>Ainda entram com código geral:</b>' + gs.map(function (g) {
              return '<div class="us-row"><div class="us-txt">' + esc(g.nome || 'Sem nome') + '<small>' + (g.origem === 'responsavel' ? 'código do responsável' : 'código da equipe') +
                ' · último uso: ' + esc(fmtWhen(g.usado_em)) + ' · ' + g.aparelhos + (g.aparelhos === 1 ? ' aparelho' : ' aparelhos') + '</small></div></div>';
            }).join('') + '</div>' : '<p class="hint">Ninguém entrou com código geral nos últimos 180 dias.</p>') +
            (r.codigo_equipe ? '<div class="us-row"><div class="us-txt"><b>Código geral da equipe</b><small>Entra como auxiliar de engenharia</small></div><button type="button" class="btn small danger" data-us="geral" data-papel="equipe">Desativar</button></div>' : '') +
            (r.codigo_responsavel ? '<div class="us-row"><div class="us-txt"><b>Código geral do responsável</b><small>Entra como Administrador</small></div>' +
              (r.pode_admin ? '<button type="button" class="btn small danger" data-us="geral" data-papel="responsavel">Desativar</button>' : '') + '</div>' : '');
        }
        el.innerHTML = h;
      }, function (err) { f.querySelector('.us').textContent = errText(err); });
    }
    f.addEventListener('click', function (e) {
      var b = e.target.closest('[data-us]');
      if (!b) return;
      if (b.dataset.us === 'novo') openUsuario(null, dados);
      else if (b.dataset.us === 'edit') openUsuario((dados.usuarios || []).find(function (u) { return u.id === b.dataset.id; }) || null, dados);
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
  // contratos do fiscal (um por contrato) e do analista (medições e acompanhamento, cada um à parte)
  function usContratosHtml(u) {
    var ac = (u && u.acesso) || {}, ehF = u && u.papel === 'fiscal', ehA = u && u.papel === 'analista';
    var linhas = ctOrdem(state.contracts).map(function (c) {
      var a = ac[c.id], id = esc(c.id);
      return '<div class="us-ct"><span class="us-ct-n">' + esc(ctNome(c)) + '<small>' + esc(abaSub(c)) + '</small></span><span class="us-ct-ops">' +
        '<label data-ctx="fiscal"><input type="checkbox" data-ct="' + id + '" data-k="f"' + (ehF && a ? ' checked' : '') + '> Liberado</label>' +
        '<label data-ctx="analista"><input type="checkbox" data-ct="' + id + '" data-k="med"' + (ehA && a && a.med ? ' checked' : '') + '> Medições</label>' +
        (isConserva(c) ? '' : '<label data-ctx="analista"><input type="checkbox" data-ct="' + id + '" data-k="acomp"' + (ehA && a && a.acomp ? ' checked' : '') + '> Acompanhamento</label>') + '</span></div>';
    }).join('');
    return '<fieldset class="us-cts" id="usCts" hidden><legend>Contratos liberados</legend>' +
      '<p class="hint" data-ctx="fiscal">Marque os contratos em que esta pessoa faz a vistoria e tira as fotos. Ela só vê esses.</p>' +
      '<p class="hint" data-ctx="analista">Em cada contrato, marque o que o analista vê. <b>Medições</b>: as medições de cada ponto, com os pontos, o diagrama e o mapa, e as fotos dele. ' +
      '<b>Acompanhamento</b>: pontos e status dos serviços, diagrama e PDF, mapa. Na conservação, só as medições. Sem nenhuma, o contrato não aparece para ele.</p>' +
      '<div class="us-ct-todos"><button type="button" class="btn small" data-cts="todos">Marcar todos</button><button type="button" class="btn small" data-cts="nenhum">Desmarcar todos</button></div>' +
      (linhas || '<p class="empty">Nenhum contrato cadastrado.</p>') + '</fieldset>';
  }
  function openUsuario(u, dados) {
    var novo = !u, podeAdm = !!(dados && dados.pode_admin) || isAdmin();
    var radios = PAPEIS.filter(function (x) { return x.k !== 'criador' || podeAdm; }).map(function (x) {
      var on = u ? u.papel === x.k : x.k === 'fiscal';
      return '<label class="papel-op"><input type="radio" name="usPapel" value="' + x.k + '"' + (on ? ' checked' : '') + '><span><b>' + esc(x.nome) + '</b><small>' + esc(x.desc) + '</small></span></label>';
    }).join('');
    var f = modal('<h2 id="modalTitle">' + (novo ? 'Nova pessoa' : 'Editar ' + esc(u.nome)) + '</h2>' +
      mField('usNome', 'Nome (aparece no histórico e nas fotos)', false, u ? u.nome : '', 'off') +
      '<fieldset class="papeis"><legend>Acesso</legend>' + radios + '</fieldset>' + usContratosHtml(u) +
      '<div class="field"><label for="usCod">' + (novo ? 'Código de acesso (pelo menos 6 caracteres)' : 'Novo código (deixe em branco para manter o atual)') + '</label>' +
      '<div class="cod-row"><input id="usCod" maxlength="200" autocomplete="off" autocorrect="off" spellcheck="false" value="' + (novo ? gerarCodigo() : '') + '"><button type="button" class="btn small" data-gerar>Gerar outro</button></div></div>' +
      (novo ? '' : '<label class="show-pw"><input type="checkbox" id="usAtivo"' + (u.ativo ? ' checked' : '') + '> Acesso ativo</label>') +
      MFOOT + '<button type="submit" class="btn primary">Salvar</button></div>',
    function (form) {
      var nome = form.querySelector('#usNome').value.trim(), papel = (form.querySelector('input[name=usPapel]:checked') || {}).value,
        cod = form.querySelector('#usCod').value.trim(), ativo = novo ? true : form.querySelector('#usAtivo').checked;
      if (!nome) { modalErr(form, 'Escreva o nome.'); return; }
      var acesso = null;
      if (papel === 'fiscal' || papel === 'analista') {
        acesso = {};
        form.querySelectorAll('#usCts input[data-ct]:checked').forEach(function (i) {
          var cid = i.dataset.ct, k = i.dataset.k;
          if (papel === 'fiscal' && k === 'f') acesso[cid] = {};
          if (papel === 'analista' && k !== 'f') { acesso[cid] = acesso[cid] || { med: false, acomp: false }; acesso[cid][k] = true; }
        });
      }
      var minC = papel === 'criador' ? 8 : 6;
      if (papel === 'criador' && !cod && (novo || u.papel !== 'criador')) { modalErr(form, errText({ code: 'codigo_admin' })); return; }
      if ((novo || cod) && cod.length < minC) { modalErr(form, 'O código precisa de pelo menos ' + minC + ' caracteres' + (papel === 'criador' ? ' (Administrador).' : '.')); return; }
      modalErr(form, '');
      busyBtn(form, true, 'Salvando…');
      var semCt = acesso && !Object.keys(acesso).length;
      window.Banco.usuarioSalvar(banco.login.codigo, { id: u ? u.id : null, nome: nome, papel: papel, codigo: cod || null, ativo: ativo, acesso: acesso }).then(function (id) {
        if (!id && cod) { busyBtn(form, false); modalErr(form, errText({ code: 'codigo_em_uso' })); return; }
        if (semCt) toast(nome + ' ficou sem nenhum contrato liberado: só vai ver a visão geral até você marcar algum.', 7000);
        busyBtn(form, false);
        if (u && u.id === (banco.login && banco.login.uid) && papel !== banco.login.papel) conferirAcesso();
        if (cod) mostrarCodigo(nome, cod, novo);
        else { toast('Salvo.'); openUsuarios(); }
      }, function (err) { busyBtn(form, false); modalErr(form, errText(err)); });
    });
    f.querySelector('[data-gerar]').addEventListener('click', function () { f.querySelector('#usCod').value = gerarCodigo(); });
    // a lista de contratos aparece para o fiscal e o analista, com as caixas de cada um
    var mostraCts = function () {
      var pp = (f.querySelector('input[name=usPapel]:checked') || {}).value, box = f.querySelector('#usCts');
      box.hidden = pp !== 'fiscal' && pp !== 'analista';
      box.querySelectorAll('[data-ctx]').forEach(function (el) { el.hidden = el.dataset.ctx !== pp; });
    };
    f.addEventListener('change', function (e) { if (e.target.name === 'usPapel') mostraCts(); });
    f.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cts]');
      if (!b) return;
      var pp = (f.querySelector('input[name=usPapel]:checked') || {}).value;
      f.querySelectorAll('#usCts [data-ctx="' + pp + '"] input[data-ct]').forEach(function (i) { i.checked = b.dataset.cts === 'todos'; });
    });
    mostraCts();
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
  // contrato do item da lixeira pelo nome deste aparelho; o banco só manda o Lote (ou o nº), que fica para o contrato que já saiu daqui
  function lxContrato(x, senao) {
    return x.tipo === 'ponto' ? loteOf(x.contrato_id, x.lote || senao || 'contrato') : loteOf(x.item_id, x.nome || x.item_id);
  }
  // contrato deste aparelho do ponto na lixeira (para dizer "segmento" na conservação); sem ele, null, e fica "ponto"
  function lxDono(x) { return x && x.contrato_id ? contractById(x.contrato_id) : null; }
  function openLixeira() {
    if (!isEng()) { toast('A lixeira e as cópias são para engenheiros, auxiliares de engenharia e o Administrador.'); return; }
    var f = modal('<h2 id="modalTitle">Lixeira e cópias de segurança</h2><div class="lx" aria-live="polite">Carregando…</div>' +
      '<div class="modal-foot"><button type="button" class="btn" data-close>Fechar</button></div>', null, 'wide');
    var dados = null;
    window.Banco.lixeira(banco.login.codigo).then(function (r) {
      dados = r;
      var lx = r.lixeira || [], cp = r.copias || [], h = '';
      h += '<div class="section-title">Excluídos · ficam 30 dias</div>';
      h += lx.length ? lx.map(function (x) {
        var km = x.km && (x.km[0] != null || x.km[1] != null) ? ' · KM ' + fmtKm(x.km[0]) + ' – ' + fmtKm(x.km[1]) : '';
        var titulo = x.tipo === 'ponto' ? itemCap(lxDono(x)) + ' ' + (x.nome || x.item_id) + ' · ' + lxContrato(x) + km : 'Contrato ' + lxContrato(x) + ' · ' + (x.pontos || 0) + ' pontos';
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
        confirmar({ titulo: 'Restaurar ' + (x.tipo === 'ponto' ? 'o ' + itemTxt(lxDono(x)) + ' ' + (x.nome || '') : 'o contrato ' + lxContrato(x)) + '?',
          texto: x.tipo === 'ponto' ? 'Ele volta para ' + lxContrato(x, 'o contrato') + ' com os dados de quando foi excluído.' : 'Ele volta com os ' + (x.pontos || 0) + ' pontos que tinha.',
          botao: 'Restaurar' }).then(function (r) {
          if (!r) { openLixeira(); return; }
          window.Banco.restaurarLixeira(banco.login.codigo, id).then(function () {
            toast((x.tipo === 'ponto' ? itemCap(lxDono(x)) + ' ' + (x.nome || '') : 'Contrato ' + lxContrato(x)) + ' restaurado.', 5000);
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
      return '<li><b>' + esc(fieldName(k, x.contrato_id)) + ':</b> ' + (a !== undefined ? esc(fmtValue(k, a)) + ' → ' : '') + '<b>' + esc(fmtValue(k, x.campos[k].v)) + '</b></li>';
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
  function minhasPropostas() {
    if (!banco.login) return 0;
    return (banco.propostas || []).filter(function (x) { return (x.autor_uid && x.autor_uid === banco.login.uid) || (!x.autor_uid && x.autor_nome === banco.login.nome); }).length;
  }
  // no computador, o botão amarelo "Aprovar (3)"; no celular e no tablet, o mesmo número num selo no ≡ e o item dentro do menu
  function renderAprov() {
    var b = $('btnAprov');
    if (!b) return;
    var all = banco.propostas || [], n = all.length, k = 0, minhas = 0;
    if (isEng() && n) { k = n; b.hidden = false; b.textContent = 'Aprovar (' + n + ')'; b.title = n + ' mudança(s) de fiscais aguardando aprovação'; }
    else if (isFiscal()) {
      minhas = k = minhasPropostas();
      b.hidden = !minhas;
      b.textContent = minhas + ' aguardando aprovação';
      b.title = 'Suas mudanças que ainda não foram aprovadas';
    } else b.hidden = true;
    var it = document.querySelector('#menuPop [data-act="aprovar"]');
    if (it) {
      if (isFiscal()) { it.hidden = !minhas; it.textContent = 'Suas mudanças aguardando aprovação' + (minhas ? ' (' + minhas + ')' : ''); }
      else it.textContent = 'Aprovar mudanças dos fiscais' + (n ? ' (' + n + ')' : '');
      it.classList.toggle('tem-aprov', !!k);
    }
    var m = $('btnMenu');
    if (m) {
      var sl = m.querySelector('.menu-selo');
      if (!sl) { sl = document.createElement('span'); sl.className = 'menu-selo'; sl.setAttribute('aria-hidden', 'true'); m.appendChild(sl); }
      sl.hidden = !k; sl.textContent = k ? String(k) : '';
      m.setAttribute('aria-label', 'Dados' + (k ? (isFiscal() ? ' · ' + k + (k === 1 ? ' mudança sua aguardando' : ' mudanças suas aguardando') + ' aprovação' : ' · ' + k + (k === 1 ? ' mudança de fiscal' : ' mudanças de fiscais') + ' para aprovar') : ''));
    }
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
    if (!isEng()) { toast('Só engenheiro, auxiliar de engenharia ou Administrador aprova.'); return; }
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
    var i = driveQ.info(), n = i.n, fotos = n + (n === 1 ? ' foto' : ' fotos'), quando = i.prox ? ' Tenta de novo às ' + hhmm(new Date(i.prox)) + '.' : '';
    if (!n) return i.enviadas ? 'Fotos enviadas ao Drive da equipe.' : 'As fotos marcadas vão para o Drive da equipe.';
    if (!banco.login) return fotos + ' esperando para o Drive: entre com o código da equipe.';
    // 'codigo': o banco confirmou que o acesso não vale mais; 'recusado': o script recusou e o banco não respondeu (não diz que o
    // código mudou); 'script': o script recusou, mas o banco confirmou que o acesso vale; 'banco': o banco não aceitou o registro
    if (i.erro === 'codigo') return 'Seu acesso mudou: entre de novo para enviar as fotos (' + fotos + ' esperando).';
    if (i.busy) return 'Enviando ao Drive… (' + fotos + ' na fila)';
    if (i.erro === 'rede' || navigator.onLine === false) return 'Sem sinal: ' + fotos + ' esperando para o Drive.' + quando;
    if (i.erro === 'tempo') return 'O envio demorou demais (sinal fraco ou o Drive ocupado): ' + fotos + ' esperando para o Drive.' + quando;
    if (i.erro === 'recusado') return fotos + ' esperando para o Drive: o envio foi recusado e o acesso não pôde ser conferido agora.' + quando;
    if (i.erro === 'script') return fotos + ' esperando para o Drive: o Drive recusou o envio, mas o seu acesso está certo.' + quando;
    if (i.erro === 'banco') return fotos + ' esperando para o Drive: o banco não aceitou o registro agora.' + (quando || ' Tenta de novo sozinho.');
    if (i.erro) return fotos + ' esperando para o Drive (o Google recusou; tenta de novo sozinho).';
    return fotos + ' na fila para o Drive.';
  }
  function onDriveChange() { syncStatus(); if (foto) foto.refreshDrive(); renderGaleriaBtn(); if (galeria) galeria.changed(); }
  function initDrive() {
    if (!banco.on || !window.DriveFotos || driveQ) return;
    driveQ = window.DriveFotos({
      getUrl: function () { return driveReady() ? banco.cfg.driveFotos.url : null; },
      getLogin: function () { return banco.login; },
      podeEnviar: function () { return aba.pronto && !aba.ro; },   // só a aba que edita manda as fotos
      ambiente: window.AMBIENTE.nome,
      registrar: function (cred, f, mini) { return window.Banco.fotoRegistrar(cred, f, mini); },
      // o envio foi recusado pelo acesso: a mesma conferência da sessão (null = não vale mais; falha = banco ou rede fora)
      conferir: function (cred) { return window.Banco.sessao(cred).then(function (x) { return !!x; }); },
      onChange: onDriveChange
    });
    // as já enviadas saem do aparelho depois do prazo escolhido em Galeria › Espaço e envio (padrão: nunca)
    setTimeout(function () {
      tempLimpar();
      if (!driveQ) return;
      if (window.Galeria && window.Galeria.limparEnviadas) window.Galeria.limparEnviadas(driveQ);
      // foto guardada sozinha enquanto era editada e o app fechou antes de sair dela: com o envio automático ligado, vai para a fila
      // (menos a que estiver aberta agora na tela Foto)
      var auto = true;
      try { auto = localStorage.getItem('diagrama-linear.foto-drive') !== '0'; } catch (e) { /* sem armazenamento */ }
      if (!auto) return;
      driveQ.list().then(function (l) {
        var cur = foto && foto._state ? foto._state() : null;
        var ids = l.filter(function (r) { return r.situacao === 'aparelho' && r.meta && r.meta.rascunho && r.meta.querEnviar === true && !r.meta.camera && (!cur || r.id !== cur.uid); }).map(function (r) { return r.id; });
        if (ids.length) driveQ.enviar(ids, true);
      }).catch(function () { /* segue */ });
    }, 8000);
  }
  // ---------------- galeria (galeria.js): fotos deste aparelho e da equipe, conforme o acesso
  var galeria = null;
  function galeriaOn() { return !!(banco.on && driveQ && window.Galeria && banco.login && podeFotos()); }
  function abrirGaleria(f) {
    if (!galeriaOn()) return;
    var c = active();
    if (pgAtivo() && c && (!f || !f.cid || f.cid === c.id)) {
      glPend = f || {};
      if (pg === 'galeria') { glPgCid = null; abreGaleriaPg(); } else irPg('galeria');
      return;
    }
    abrirGaleriaJa(f);
  }
  function abrirGaleriaJa(f) {
    if (!galeria) {
      galeria = window.Galeria({
        // o analista que tira fotos fica como o fiscal na galeria: Neste aparelho e Minhas
        drive: driveQ, Banco: window.Banco, nivel: function () { return isAnalista() && podeFotos() ? 1 : nivel(); }, getLogin: function () { return banco.login; }, nomes: NOMES,
        driveUrl: function () { return driveReady() ? banco.cfg.driveFotos.url : null; },
        ambiente: (window.AMBIENTE && window.AMBIENTE.nome) || 'oficial',
        // na visão geral não há contrato na tela: a galeria não escolhe sozinha o contrato escondido
        contratos: ctsFoto, ocultos: function () { return (banco.arquivados || []).map(function (x) { return x.id; }); }, ativo: function () { var c = active(); return c && !visaoOn && ctsFoto().indexOf(c) >= 0 ? c.id : ''; },
        toast: toast, confirmar: confirmar, saveBlob: saveBlob, entrar: openLogin, carimbar: function (fotos) { openFoto('', fotos); },
        podeCompartilharFotos: podeCompartilharFotos, salvarFotos: salvarFotos, nativo: isNativeApp, onBaixa: renderGaleriaBtn,
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
        contratos: function () { return state.contracts; }, ativo: function () { return visaoOn ? null : active(); }, ordem: sortedPoints, descricao: descRelatorio, ehOae: isOae, nomes: NOMES,
        ensureLibs: ensureLibs, saveBlob: saveBlob, toast: toast, modal: modal, closeModal: closeModal,
        podeEditar: function () { return !readOnly() && !isFiscal(); }, salvarContrato: salvarCamposContrato, logoSupervisora: window.UNIFILAR_LOGO || null
      });
    }
    relFoto.abrir(a);
  }
  // texto inicial da descrição: situação de cada serviço (lotes) ou estado de cada grupo na vistoria (pontes, conservação) e a observação
  function descRelatorio(c, p) {
    var partes;
    if (isContinuo(c)) {
      partes = servicesOf(c).map(function (s) {
        var sv = p.serv[s.key], k = oaeSt(sv);
        if (k === 'NV' || k === 'NA') return '';
        var qt = comQtd(k) ? fmtQtd(s, sv.q) : '';
        return s.short + ': ' + oaeStOf(s, k).name.toLowerCase() + (qt ? ' ' + qt : '') + (comQtd(k) && sv.n ? ' (' + sv.n + ')' : '') +
          (comQtd(k) && sv.pri ? ', prioridade' : '') + (comQtd(k) && sv.ci ? ', conclusão informada pela executora' : '');
      });
    } else {
      partes = servicesOf(c).map(function (s) {
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
    var n = driveQ ? driveQ.info().n : 0, el = b.querySelector('.gl-pend'), bx = galeria && galeria.baixando ? galeria.baixando() : 0;
    if (el) { el.textContent = n + bx; el.hidden = !(n + bx); }
    b.title = [n ? n + (n === 1 ? ' foto esperando envio' : ' fotos esperando envio') : '', bx ? bx + (bx === 1 ? ' foto baixando' : ' fotos baixando') : ''].filter(Boolean).join(' · ') || 'Fotos deste aparelho e da equipe';
    var nb = document.querySelector('#pgNav [data-pg="galeria"]');
    if (nb) {
      var era = nb.hidden, ep = nb.querySelector('.gl-pend');
      nb.hidden = !galeriaOn();
      nb.title = b.title;
      if (ep) { ep.textContent = n + bx; ep.hidden = !(n + bx); }
      if (era !== nb.hidden) aplicaPg();
    }
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
  // os seletores que só mudam o que se vê (data-anmed: "Segmentos/Pontes por medição") continuam livres para quem só lê
  function lockEditor() {
    if (readOnly()) $('editor').querySelectorAll('input,select,textarea').forEach(function (el) { if (!el.hasAttribute('data-anmed')) el.disabled = true; });
    else if (isFiscal()) $('editor').querySelectorAll('input,select,textarea').forEach(function (el) { if (!el.hasAttribute('data-svcpct')) el.disabled = true; });
  }
  var EDIT_ACTS = ['set-st', 'set-marca', 'set-item', 'set-desemp', 'add-point', 'dup-point', 'del-point', 'add-dev', 'del-dev', 'add-marco', 'del-marco', 'new-contract', 'del-contract',
    'add-prazo', 'del-prazo', 'set-prazo-sit', 'add-valor', 'del-valor', 'set-valor-sit', 'preencher-trechos', 'gerar-segmentos'];
  var POINT_ACTS = ['set-st', 'set-marca', 'set-item', 'add-point', 'dup-point', 'del-point', 'add-dev', 'del-dev'];   // ações que mexem nos pontos
  function initBanco() {
    if (!banco.on) { var lb = $('btnLogin'); if (lb) lb.hidden = true; return; }
    prepareOld();
    var s = lsGet(SYNC_KEY);
    if (s) {
      banco.versao = Number(s.versao) || 0; banco.pend = Array.isArray(s.pend) ? s.pend : []; banco.cfg = s.cfg || {};
      banco.meta = s.meta && typeof s.meta === 'object' ? s.meta : {}; banco.conf = Array.isArray(s.conf) ? s.conf : [];
      banco.acesso = s.acesso && typeof s.acesso === 'object' ? s.acesso : null;
    }
    banco.base = clone(state);   // o estado guardado aqui já inclui o que está na fila
    initDrive();
    renderGaleriaBtn();
    $('btnGaleria').addEventListener('click', function () { abrirGaleria(); });
    banco.propostas = s && Array.isArray(s.propostas) ? s.propostas : [];
    banco.arquivados = s && Array.isArray(s.arquivados) ? s.arquivados : [];
    setLogin(lsGet(LOGIN_KEY), true);
    if (banco.conf.length) showConflicts();
    $('btnLogin').addEventListener('click', openLogin);
    initAprov();
    ['editor', 'visaoHost', 'medicoesHost'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('focusout', function () { setTimeout(function () { if (banco.want && !typing()) refresh(); }, 50); });
    });
    window.addEventListener('online', function () { banco.online = true; banco.espera = 0; flush(); poll(); });
    window.addEventListener('offline', function () { banco.online = false; syncStatus(); });
    // trocar de app ou fechar a aba: o último toque grava já, sem esperar os 300 ms (o sistema pode encerrar o app)
    window.addEventListener('pagehide', flushSave);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') { flushSave(); return; }
      poll();
      if (isEng() || isAnalista()) {
        conferirAcesso();   // quem tem a análise no aparelho: confere se ainda tem o acesso
        var ca = active();
        if (ca && analise.estado[ca.id] === 'erro') { delete analise.estado[ca.id]; renderEditor(); }
        // as marcas "medido sem execução" de outras pessoas chegam com a análise: lê de novo ao voltar ao app,
        // no máximo a cada 10 min e sem marca sendo gravada
        else if (ca && (isOae(ca) || isConserva(ca)) && analise.estado[ca.id] === 'ok' && Date.now() - (anLido[ca.id] || 0) > 600000 && !Object.keys(mnePend).length) {
          delete analise.estado[ca.id]; carregarAnalise(ca);
        }
      }
    });
    setInterval(function () {
      if (document.visibilityState !== 'visible' || (!isEng() && !isAnalista())) return;
      conferirAcesso();
      // marcas gravadas em outro aparelho: relê a análise da ponte aberta a cada 10 min (não no meio de uma gravação ou digitação)
      var ca = active();
      if (ca && !visaoOn && (isOae(ca) || isConserva(ca)) && analise.estado[ca.id] === 'ok' && Date.now() - (anLido[ca.id] || 0) > 600000 && !Object.keys(mnePend).length && !typing()) { delete analise.estado[ca.id]; carregarAnalise(ca); }
    }, 300000);
    window.addEventListener('hashchange', function () {
      if (location.hash === '#configurar') openConfigurar();
      if (location.hash === '#medicoes') abrirMedicoes();
      else if (medicoesOn) { setVisao(true); renderAll(); }
    });
    setInterval(poll, 20000);
    syncStatus();
    refresh().then(function () {
      conferirAcesso().then(flush);
      if (location.hash === '#configurar') openConfigurar();
    });
  }

  // ------------------------------------------------------------------ início
  // sem ambiente.js não se sabe qual banco nem qual armazenamento usar (a prévia leria e gravaria o do site oficial,
  // que fica na mesma origem): o app não abre e pede para recarregar
  function semAmbiente() {
    var d = document.createElement('div');
    d.setAttribute('role', 'alert');
    d.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(23,32,28,.6)';
    d.innerHTML = '<div style="max-width:420px;background:#fff;color:#17201C;border-radius:12px;padding:18px 20px;display:flex;flex-direction:column;gap:12px;font:15px/1.45 system-ui,sans-serif">' +
      '<b style="font-size:17px">A configuração do site não carregou</b>' +
      '<span>Nada foi lido nem gravado. Confira a internet e recarregue a página. O que está guardado neste aparelho continua aqui.</span>' +
      '<button type="button" style="min-height:44px;border:0;border-radius:8px;background:#1D4F91;color:#fff;font:inherit;font-weight:650">Recarregar</button></div>';
    d.querySelector('button').addEventListener('click', function () { location.reload(); });
    document.body.appendChild(d);
  }
  function init() {
    if (!window.AMBIENTE || !window.AMBIENTE.supabaseUrl) { semAmbiente(); return false; }
    state = load() || normalize(clone(window.UNIFILAR_SEED));
    if (window.UNIFILAR_LOGO) $('brandLogo').src = window.UNIFILAR_LOGO.src;
    var ed = $('editor');
    ed.addEventListener('input', onInput);
    ed.addEventListener('change', onInput);
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.menu')) closeMenu();
      if (!e.target.closest('.ctmenu') && !e.target.closest('#ctCurto')) ctMenu(false);
    });
    $('atalhos').addEventListener('click', function (e) { var x = e.target.closest('[data-ir]'); if (x) irPara(x.dataset.ir); });
    // barra encolhida: o contrato curto devolve a barra inteira e abre a lista de contratos
    $('ctCurto').addEventListener('click', function () { topoMini(false); ctMenu(true); });
    window.addEventListener('scroll', aoRolar, { passive: true });
    if (mmEmPe && mmEmPe.addEventListener) mmEmPe.addEventListener('change', aoRolar);
    // celular: o teclado aberto encolhe a tela; o campo tocado vai para o meio da área que sobra
    if (window.visualViewport) document.addEventListener('focusin', function (e) {
      var t = e.target;
      if (!mmAtalhos || !mmAtalhos.matches || !t.matches || !t.matches('input:not([type=checkbox]):not([type=radio]):not([type=file]),textarea')) return;
      setTimeout(function () {
        var r = t.getBoundingClientRect();
        if (document.activeElement === t && (r.bottom > window.visualViewport.height - 8 || r.top < 0)) t.scrollIntoView({ block: 'center' });
      }, 350);
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
    $('btnPdfPg').addEventListener('click', exportPdf);
    $('pgNav').addEventListener('click', function (e) { var x = e.target.closest('[data-pg]'); if (x) irPg(x.dataset.pg); });
    $('pgNav').querySelector('[data-pg="foto"]').hidden = $('btnFoto').hidden;
    $('pgNav').querySelector('[data-pg="mapa"]').hidden = !temMapa();
    try { history.replaceState({ pg: pg }, ''); } catch (e) { /* segue sem histórico */ }
    window.addEventListener('popstate', function (e) { var s = e.state && e.state.pg; if (s && s !== pg && pgAtivo()) irPg(s, true); });
    [mmCel, mmMd, mmPc, mmLargo].forEach(function (m) {
      if (m && m.addEventListener) m.addEventListener('change', function () {
        aplicaPg();
        if (pgAtivo() && $('editor').classList.contains('ld') !== mdOn()) renderEditor();
        if (view === 'mapa' && mapa) { mapa.invalidate(); mapa.show(); }
      });
    });
    $('folhasNav').addEventListener('click', function (e) {
      var x = e.target.closest('.fn-b');
      if (!x) return;
      var s2 = $('pages').querySelectorAll('.sheet')[Number(x.dataset.fi)];
      if (s2) s2.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
    $('pages').addEventListener('scroll', function () { marcaFolha(); }, { passive: true });
    // dedo: com um campo de texto em uso (teclado aberto), a barra das páginas some para não ficar no meio da tela
    var mmDedo = window.matchMedia ? window.matchMedia('(pointer:coarse)') : null;
    function campoTexto(t) { return !!(t && t.matches && t.matches('input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=button]):not([type=submit]),textarea')); }
    document.addEventListener('focusin', function (e) { if (mmDedo && mmDedo.matches && campoTexto(e.target)) document.body.classList.add('teclado'); });
    document.addEventListener('focusout', function (e) {
      if (campoTexto(e.target)) setTimeout(function () { if (!campoTexto(document.activeElement)) document.body.classList.remove('teclado'); }, 120);
    });
    $('viewMapa').addEventListener('click', function () { setView('mapa'); });
    if (!window.MapaSNV || !window.L || !window.SNV_BR230) $('viewMapa').closest('.view-sw').hidden = true;
    if (window.TelaCheia) {
      viewer = window.TelaCheia({ pageW: PAGE_W, pageH: PAGE_H, getSheets: function () { var c = active(); return renderSheets(c, (isOae(c) || isConserva(c)) && !!anOf(c) && folhaSoVist(c)); } });
      $('btnFull').addEventListener('click', function () { if (view === 'mapa' && mapa) mapa.openFull(); else viewer.open(); });
    } else {
      $('btnFull').hidden = true;
    }
    $('btnMenu').addEventListener('click', function () {
      var pop = $('menuPop'), rec = pop.querySelector('[data-act="recusadas"]'), nr = recusadas().length;
      if (rec) { rec.hidden = !nr; rec.textContent = 'Alterações guardadas (' + nr + ')'; }
      pop.hidden = !pop.hidden;
      $('btnMenu').setAttribute('aria-expanded', String(!pop.hidden));
      // acesso sem nenhuma opção aqui (fiscal no computador): explica, em vez de abrir um menu vazio
      if (!pop.hidden) {
        var algum = [].some.call(pop.querySelectorAll('button[data-act]'), function (x) { return !x.hidden && x.offsetParent; }), vz = $('menuVazio');
        if (!algum && !vz) { vz = document.createElement('p'); vz.id = 'menuVazio'; vz.className = 'menu-vazio'; vz.textContent = 'Seu acesso não tem opções neste menu. Os pontos, o mapa, as fotos e a galeria ficam nas abas da barra de cima.'; pop.insertBefore(vz, pop.firstChild); }
        if (vz) vz.hidden = algum;
      }
    });
    $('menuPop').addEventListener('click', onMenu);
    $('fileInput').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (f) openBackup(f);
      e.target.value = '';
    });
    $('fileMed').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (f) abrirCargaMed(f);
      e.target.value = '';
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      closeMenu();
      if ($('ctmPop') && !$('ctmPop').hidden) { ctMenu(false); var b = document.querySelector('[data-act="ct-menu"]'); if (b) b.focus(); }
    });
    if (!window.VisaoGeral || !$('visaoHost')) visaoOn = false;
    syncTopbar();
    var tbar = document.querySelector('.topbar');
    // border-box: no iPhone o recuo da área segura (env) pode chegar depois da 1ª medida e só muda o padding da barra, que o
    // observer padrão (content-box) não vê; a galeria do celular (fixa abaixo da barra) ficava com o topo escondido
    if (window.ResizeObserver && tbar) { try { new ResizeObserver(syncTopbar).observe(tbar, { box: 'border-box' }); } catch (e) { new ResizeObserver(syncTopbar).observe(tbar); } }
    window.addEventListener('resize', syncTopbar);
    window.addEventListener('orientationchange', function () { setTimeout(syncTopbar, 300); });
    window.addEventListener('pageshow', syncTopbar);
    setTimeout(syncTopbar, 500); setTimeout(syncTopbar, 2000);
    initAba();
    initBanco();
    renderAll();
    if (view === 'mapa') setView('mapa');
    save();
  }

  // acesso para testes no console
  window.Unifilar = {
    buildPdf: function () { return buildPdf(active()); },
    // cid: um contrato qualquer (sem cid, o aberto); semAnalise: a folha do 424 só com a vistoria (para comparar as folhas
    // antes e depois de uma mudança, contrato por contrato)
    renderSheets: function (cid, semAnalise) { var c = cid ? contractById(cid) : active(); return c ? renderSheets(c, semAnalise === true) : []; },
    state: function () { return state; },
    mapa: function () { return mapa; },
    banco: function () { return banco; },
    drive: function () { return driveQ; },
    recusadas: function () { return recusadas().length; },
    diffOps: diffOps,
    applyOps: applyOps
  };

  // algo mais largo que a tela (no iPhone, depois de girar o celular a página rolava para o lado ou encolhia): anota qual
  // elemento passou e quanto, e mostra no fim do menu Dados, para achar a causa no aparelho (22/10/2026)
  var LARG_KEY = 'diagrama-linear.largura';
  function confereLargura() {
    var W = document.documentElement.clientWidth, pior = null;
    if (!W) return;
    Array.prototype.forEach.call(document.querySelectorAll('body *'), function (e) {
      var r = e.getBoundingClientRect();
      if (!r.width || r.right <= W + 2 || getComputedStyle(e).position === 'fixed') return;
      var p = e.parentElement, pr = p && p.getBoundingClientRect();
      if (pr && pr.right > W + 2) return;   // o pai já passou: fica o de fora
      if (!pior || r.right > pior.r) {
        var cl = typeof e.className === 'string' ? e.className : (e.className && e.className.baseVal) || '';
        pior = { r: Math.round(r.right), el: e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (cl ? '.' + cl.trim().split(/\s+/).slice(0, 3).join('.') : '') };
      }
    });
    if (!pior) return;
    var reg = { em: new Date().toISOString(), tela: W, ate: pior.r, el: pior.el, pg: document.body.getAttribute('data-pg') || '', alt: window.innerHeight };
    lsPut(LARG_KEY, reg);
    mostraLargura();
  }
  function mostraLargura() {
    var menu = $('menuPop'), reg = lsGet(LARG_KEY);
    if (!menu || !reg || !reg.el) return;
    var d = $('larguraDiag');
    if (!d) { d = document.createElement('div'); d.id = 'larguraDiag'; d.className = 'menu-versao'; menu.appendChild(d); }
    d.textContent = 'Largura: ' + reg.el + ' até ' + reg.ate + ' px (tela ' + reg.tela + ' × ' + reg.alt + ', ' + (reg.pg || 'início') + ', ' + fmtWhen(reg.em) + ')';
  }
  var largT = null;
  function agendaLargura() { clearTimeout(largT); largT = setTimeout(confereLargura, 1200); }
  window.addEventListener('resize', agendaLargura);
  window.addEventListener('orientationchange', agendaLargura);
  setTimeout(function () { confereLargura(); mostraLargura(); }, 4000);

  if (init() !== false) {
    window.Unifilar.pronto = true;   // atualizar.js confere isto antes de confirmar ao app que uma versão baixada abriu bem
    if (window.AtualizarApp && window.AtualizarApp.pronto) window.AtualizarApp.pronto();   // já, sem esperar o "load"
  }
})();
