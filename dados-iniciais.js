// Dados iniciais extraídos de "RELATÓRIO DE ATIVIDADES LOTE 01 E 02" (planilha e PDF de 13/10/2026).
// Usados só na primeira abertura ou em "Restaurar dados iniciais". Depois disso, o site
// guarda as alterações no navegador (e no backup .json que você exportar).
//
// Status de cada serviço: OK = concluído, A = ativo (em execução), P = parado / não iniciado,
// NA = não se aplica. "pct" é o percentual executado (usado em A e P).
(function () {
  function s(code) {
    if (code === 'OK') return { st: 'OK', pct: 100 };
    if (code === 'NA') return { st: 'NA', pct: 0 };
    var st = code.charAt(0), pct = Number(code.slice(1) || 0);
    return { st: st, pct: pct };
  }
  // ordem: solo brita, aterro, enrocamento, OAC, serviços preliminares
  function serv(solo, aterro, enroc, oac, prelim) {
    return { solo: s(solo), aterro: s(aterro), enroc: s(enroc), oac: s(oac), prelim: s(prelim) };
  }
  function bmcm(km, metros) {
    return { desc: 'BMCM ARMCO D=2,00m (' + metros + 'm)', km: km, cor: 'vermelho' };
  }
  var n = 0;
  function pt(nome, kmIni, kmFim, enr, sb, sv, disp, obs) {
    n += 1;
    return { id: 'seed-' + n, nome: nome, kmIni: kmIni, kmFim: kmFim, enr: enr, sb: sb, serv: sv, disp: disp || [], obs: obs || '' };
  }

  var lote01 = {
    id: 'ct-314',
    orgao: 'Ministério dos Transportes · DNIT · Superintendência Regional no Pará · Unidade Local de Altamira',
    numero: '02 00314/2026',
    lote: 'Lote 01',
    rodovia: 'BR-230/PA',
    objeto: 'Emergenciais de recuperação na Rodovia BR-230/PA',
    executora: 'LCM Construção e Comércio S/A',
    supervisora: 'Consórcio Magna/Enecon',
    ctSupervisao: '02 00393/2022',
    extensaoContrato: 105,
    origem: 'Medicilândia',
    destino: 'Uruará',
    kmIni: 743.80,
    kmFim: 848.80,
    plataforma: '12,00 m',
    dataVistoria: '2026-10-08',
    porPagina: 9,
    marcos: [{ nome: 'Pedreira', km: 811.0 }],
    pontos: [
      pt('P1', 748.41, 750.41, 4088.25, 1855.67, serv('OK', 'OK', 'OK', 'NA', 'OK'), [],
        'Terminado, porém o revestimento estourou. Grande presença de material fino, gerador de poeira. Reconformação da plataforma com motoniveladora (KM 748,93 e 749,25). Dois rolos pé-de-carneiro (KM 749,56).'),
      pt('P2', 758.04, 758.54, 17548.02, 830.42, serv('OK', 'OK', 'OK', 'P0', 'OK'), [bmcm(758.43, 43)],
        'Dispositivo de drenagem ainda não implantado. Grande presença de material fino, gerador de poeira.'),
      pt('P3', 761.83, 762.83, 0, 837.39, serv('OK', 'NA', 'NA', 'NA', 'OK'),
        [{ desc: 'BMCM ARMCO D=2,00m (6m)', km: 762.12, cor: 'amarelo' }], ''),
      pt('P4', 765.53, 767.53, 8992.21, 943.11, serv('OK', 'OK', 'OK', 'NA', 'OK'), [],
        'Presença de maquinários estacionados em canteiro.'),
      pt('P5', 766.78, 767.53, 4501.4, 528.46, serv('OK', 'OK', 'OK', 'P0', 'OK'), [bmcm(767.26, 25)],
        'Material pétreo estocado às margens da rodovia.'),
      pt('P6', 772.14, 775.14, 13761.87, 2599.93, serv('P0', 'OK', 'OK', 'P0', 'OK'), [bmcm(774.10, 80)],
        'Dispositivo de drenagem às margens da rodovia.'),
      pt('P7', 782.17, 783.17, 0, 628.01, serv('P0', 'NA', 'NA', 'NA', 'NA'), [], ''),
      pt('P8', 793.48, 794.48, 6271.12, 789.59, serv('P0', 'OK', 'OK', 'P0', 'OK'), [bmcm(794.16, 30)],
        'Maquinário parado e encostado às margens da rodovia.'),
      pt('P9', 794.50, 795.50, 5168.995, 774.90, serv('P0', 'A65', 'A65', 'P0', 'OK'), [bmcm(795.20, 30)],
        'Execução de enrocamento. Execução de aterro. Presença de maquinários na frente de serviço.'),
      pt('P10', 801.20, 802.20, 4883.28, 858.55, serv('P0', 'OK', 'OK', 'P0', 'OK'), [bmcm(801.87, 20)], ''),
      pt('P11', 805.87, 806.87, 6119.76, 744.28, serv('P0', 'OK', 'OK', 'P0', 'OK'), [bmcm(806.58, 45)],
        'Material pétreo às margens da rodovia.'),
      pt('P12', 812.79, 813.79, 5114.77, 628.01, serv('P0', 'OK', 'OK', 'NA', 'OK'), [], ''),
      pt('P13', 822.06, 823.26, 8870.47, 935.97, serv('P0', 'P0', 'A50', 'P0', 'OK'), [bmcm(822.86, 30)],
        'Material pétreo estocado às margens da rodovia.'),
      pt('P14', 824.99, 827.99, 19605.34, 2775.24, serv('P0', 'OK', 'OK', 'A50', 'OK'), [
        { desc: 'BSCC 2,00x2,00m (25m)', km: 825.22, cor: 'cinza' },
        { desc: 'BSCC 2,00x2,00m (24m)', km: 825.51, cor: 'cinza' },
        { desc: 'BSCC 2,00x2,00m (24m)', km: 826.07, cor: 'cinza' },
        { desc: 'BSTC D=1,00m PA2 (6m)', km: 826.32, cor: 'azul' },
        { desc: 'BSCC 2,00x2,00m (24m)', km: 826.74, cor: 'cinza' }
      ], ''),
      pt('P15', 829.49, 831.49, 10467.13, 837.39, serv('P0', 'A68', 'A68', 'P0', 'OK'), [bmcm(830.72, 25)],
        'Execução de enrocamento. Presença de maquinários na frente de serviço.'),
      pt('P17', 835.67, 835.92, 0, 0, serv('NA', 'NA', 'NA', 'P0', 'NA'), [bmcm(835.80, 30)],
        'Dispositivo de drenagem às margens da rodovia.'),
      pt('P16', 837.64, 838.14, 3678.80, 420.61, serv('P0', 'OK', 'OK', 'OK', 'OK'), [bmcm(838.01, 19)], ''),
      pt('P18', 842.07, 843.07, 6567.43, 767.31, serv('P0', 'OK', 'OK', 'P0', 'OK'), [bmcm(842.89, 20)], '')
    ]
  };

  var lote02 = {
    id: 'ct-315',
    orgao: 'Ministério dos Transportes · DNIT · Superintendência Regional no Pará · Unidade Local de Altamira',
    numero: '02 00315/2026',
    lote: 'Lote 02',
    rodovia: 'BR-230/PA',
    objeto: 'Emergenciais de recuperação na Rodovia BR-230/PA',
    executora: 'Gonçalves & Dias Engenharia Ltda',
    supervisora: 'Consórcio Magna/Enecon',
    ctSupervisao: '02 00393/2022',
    extensaoContrato: 151,
    origem: 'Uruará',
    destino: 'Rurópolis',
    kmIni: 848.80,
    kmFim: 999.80,
    plataforma: '12,00 m',
    dataVistoria: '2026-10-07',
    porPagina: 9,
    marcos: [{ nome: 'Placas', km: 909.8 }],
    pontos: [
      pt('P1', 873.89, 874.49, 4610.88, 496.47, serv('A50', 'OK', 'OK', 'A50', 'OK'), [],
        'Conclusão do dispositivo de drenagem pendente. Maquinários fora de serviço às margens da rodovia.'),
      pt('P2', 881.57, 882.07, 3535.14, 494.30, serv('OK', 'OK', 'OK', 'A50', 'OK'), [],
        'Conclusão do dispositivo de drenagem pendente.'),
      pt('P3', 892.18, 892.68, 4218.65, 422.92, serv('OK', 'OK', 'OK', 'P0', 'OK'), [],
        'Aduelas às margens da rodovia. Dispositivo de drenagem ainda não implantado.'),
      pt('P4', 894.40, 895.90, 8990.19, 734.32, serv('OK', 'OK', 'OK', 'P0', 'OK'), [], ''),
      pt('P5', 896.30, 897.10, 833.97, 612.10, serv('OK', 'OK', 'OK', 'NA', 'OK'), [], ''),
      pt('P6', 948.00, 951.00, 3599.20, 489.60, serv('A25', 'OK', 'A25', 'A50', 'OK'), [],
        'Conclusão de dispositivo de drenagem pendente.'),
      pt('P7', 953.92, 955.92, 11481.90, 1764.67, serv('P0', 'P0', 'P0', 'P0', 'OK'), [],
        'Material pétreo estocado às margens da rodovia.'),
      pt('P8', 962.91, 963.91, 7604.70, 831.96, serv('P0', 'P0', 'P0', 'NA', 'OK'), [],
        'Presença de maquinários estacionados em local apropriado.'),
      pt('P9', 989.03, 990.03, 7181.95, 837.39, serv('P0', 'P0', 'P0', 'A50', 'OK'), [],
        'Conclusão de dispositivo de drenagem pendente.'),
      pt('P10', 996.85, 997.85, 4728.92, 811.86, serv('P0', 'P0', 'P0', 'A50', 'OK'), [],
        'Conclusão de dispositivo de drenagem pendente. Falta execução de solo-brita; serviços inacabados.')
    ]
  };

  window.UNIFILAR_SEED = { version: 1, activeId: 'ct-314', contracts: [lote01, lote02] };
})();
