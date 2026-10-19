# Gera site/snv-conversao.js: as réguas que convertem o km dos contratos de conservação (km do contrato) no km do site
# (SNV 202607A, o eixo de snv-br230.js), e de volta, uma por versão do SNV do contrato:
#   202104A (SNV 2020-2022; os km e a geometria são os mesmos de 202004A a 202206A): 437 e 438 (750,90 a 1.006,90) e
#     310, 419 e 264 (308,40 a 649,50, onde o km do site é o do contrato - 7,10);
#   202304A (SNV 2023-2025): 558 e 665 (301,10 a 999,60, onde o km do site é o do contrato + 0,20).
# No trecho do 437/438 Baixa do WFS do DNIT a geometria das duas versões, confere que o traçado é o mesmo,
# calcula os pontos de quebra (dentro de um segmento do SNV o km é proporcional ao comprimento, como em snv_build.py) e
# imprime a tabela de conferência. Não grava nada se uma conferência falhar.
# Nos trechos de deslocamento fixo, a conferência é a dos limites de cada segmento do SNV nas duas versões (mesma extensão,
# mesmo deslocamento em todos, sem buraco entre eles) e a do comprimento do traçado (a 3%: o DNIT redesenha um pouco a linha
# entre versões, mas o km nominal, que é o que a régua usa, é o mesmo).
# Rodar de novo sempre que o eixo do site (snv-br230.js) mudar de versão: a régua vale só para o eixo da versão PARA.
#   python -I ferramentas/snv_conversao_build.py                         (baixa do WFS e grava ../snv-conversao.js)
#   python -I ferramentas/snv_conversao_build.py --local de.json para.json   (usa o GeoJSON já baixado do trecho do 437/438;
#                                                                            os trechos de deslocamento fixo ainda vêm do WFS)
#   ... --saida <arquivo.js> --site <pasta do site>                      (grava em outro lugar ou lê outro eixo, para testar)
# Só a biblioteca padrão do Python. Fica fora do Pages (pages.yml exclui a pasta ferramentas).
import sys, os, json, math, urllib.request, urllib.parse
sys.stdout.reconfigure(encoding='utf-8')

DE, PARA = '202104A', '202607A'
COD_DE = ['230BPA1530', '230BPA1540', '230BPA1550', '230BPA1580']
COD_PARA = ['230BPA1525', '230BPA1530', '230BPA1540', '230BPA1550', '230BPA1580']
# limites nominais esperados (km inicial, km final) de cada segmento: se o DNIT mudar algum, a régua tem de ser revista
KM_DE = {'230BPA1530': (750.9, 783.9), '230BPA1540': (783.9, 855.9), '230BPA1550': (855.9, 916.9), '230BPA1580': (916.9, 1006.9)}
KM_PARA = {'230BPA1525': (741.7, 743.8), '230BPA1530': (743.8, 776.8), '230BPA1540': (776.8, 848.8), '230BPA1550': (848.8, 909.8),
           '230BPA1580': (909.8, 999.8)}
WFS = 'https://servicos.dnit.gov.br/dnitgeo/geoserver/ows'
R = 6371008.8
AQUI = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(AQUI)


def falha(msg):
    print('ERRO: ' + msg + '. Nada foi gravado.')
    sys.exit(1)


def baixar(ver, codes):
    q = {'service': 'WFS', 'version': '2.0.0', 'request': 'GetFeature', 'typeNames': 'vgeo:vw_snv_rod',
         'outputFormat': 'application/json', 'srsName': 'EPSG:4326',
         'CQL_FILTER': "Versao_SNV='%s' AND Codigo_SNV IN (%s)" % (ver, ','.join("'%s'" % c for c in codes))}
    try:
        with urllib.request.urlopen(WFS + '?' + urllib.parse.urlencode(q), timeout=120) as r:
            return json.loads(r.read().decode('utf-8'))
    except (OSError, ValueError) as e:   # sem rede, WFS fora do ar, tempo esgotado ou resposta que não é JSON
        falha('sem acesso ao WFS do DNIT (%s, versão %s): %s' % (WFS, ver, e))


def hav(a, b):
    lo1, la1, lo2, la2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def segmentos(d, ver, codes, km):
    feats = {f['properties']['Codigo_SNV']: f for f in d.get('features', [])}
    out = {}
    for c in codes:
        f = feats.get(c)
        if not f:
            falha('o segmento %s não veio na versão %s' % (c, ver))
        p = f['properties']
        if p.get('Versao_SNV') != ver:
            falha('%s veio na versão %s, e não na %s' % (c, p.get('Versao_SNV'), ver))
        if (p['Quilometragem_Inicio'], p['Quilometragem_Fim']) != km[c]:
            falha('%s (%s) vai do km %s ao %s; o esperado era %s a %s' % (c, ver, p['Quilometragem_Inicio'], p['Quilometragem_Fim'], km[c][0], km[c][1]))
        line = [x for part in f['geometry']['coordinates'] for x in part]
        out[c] = {'line': line, 'L': sum(hav(line[i - 1], line[i]) for i in range(1, len(line)))}
    return out


def iguais(a, b):
    return len(a) == len(b) and all(abs(p[0] - q[0]) < 1e-12 and abs(p[1] - q[1]) < 1e-12 for p, q in zip(a, b))


args = sys.argv[1:]
if '--site' in args:   # pasta do site com o snv-br230.js (padrão: a pasta acima de ferramentas/)
    i = args.index('--site'); SITE = args[i + 1]; del args[i:i + 2]
saida = os.path.join(SITE, 'snv-conversao.js')
if '--saida' in args:
    i = args.index('--saida'); saida = args[i + 1]; del args[i:i + 2]
if args[:1] == ['--local']:
    gde, gpara = [json.load(open(f, encoding='utf-8')) for f in args[1:3]]
elif args:
    falha('argumentos: [--local de.json para.json] [--saida arquivo.js]')
else:
    gde, gpara = baixar(DE, COD_DE), baixar(PARA, COD_PARA)
baixado = (gpara.get('timeStamp') or gde.get('timeStamp') or '')[:10]

# 0) o eixo do site é o da versão PARA, com os mesmos limites
s = open(os.path.join(SITE, 'snv-br230.js'), encoding='utf-8').read()
eixo = json.loads(s[s.index('{'):s.rstrip().rstrip(';').rindex('}') + 1])
if eixo.get('versao') != PARA:
    falha('snv-br230.js é da versão %s; esta régua é para a %s (mude PARA e os limites, e confira)' % (eixo.get('versao'), PARA))
lim = {x['codigo']: (x['kmIni'], x['kmFim']) for x in eixo['segmentos']}
for c in COD_PARA:
    if lim.get(c) != KM_PARA[c]:
        falha('no snv-br230.js, %s vai de %s; o WFS %s diz %s' % (c, lim.get(c), PARA, KM_PARA[c]))

# 1) o traçado não mudou: o antigo 1530 é o 1525 + o 1530 de agora (sem repetir o vértice da emenda); os outros, vértice a vértice
o, n = segmentos(gde, DE, COD_DE, KM_DE), segmentos(gpara, PARA, COD_PARA, KM_PARA)
if not iguais(n['230BPA1525']['line'] + n['230BPA1530']['line'][1:], o['230BPA1530']['line']):
    falha('o antigo 230BPA1530 não é mais o 230BPA1525 + 230BPA1530 de %s' % PARA)
for c in ['230BPA1540', '230BPA1550', '230BPA1580']:
    if not iguais(o[c]['line'], n[c]['line']):
        falha('a geometria do %s mudou entre %s e %s' % (c, DE, PARA))
print('Traçado: igual nas duas versões (vértice a vértice).')

# 2) pontos de quebra [km do contrato, km do site]; a = km do contrato da emenda 1525/1530 (o fim da pavimentação de hoje)
ki, kf = KM_DE['230BPA1530']
a = ki + (kf - ki) * n['230BPA1525']['L'] / o['230BPA1530']['L']
Q = [[750.9, 741.7], [a, 743.8], [783.9, 776.8], [855.9, 848.8], [916.9, 909.8], [1006.9, 999.8]]


def conv(k, i, j):   # a mesma conta das funções do arquivo gerado
    if k < Q[0][i] - 1e-9 or k > Q[-1][i] + 1e-9:
        return None
    for t in range(1, len(Q)):
        if k <= Q[t][i] + 1e-9:
            return Q[t - 1][j] + (k - Q[t - 1][i]) * (Q[t][j] - Q[t - 1][j]) / (Q[t][i] - Q[t - 1][i])


print('Ponto de quebra do fim da pavimentação: km do contrato %r = km do site 743,80' % a)
print('Fatores (km do site por km do contrato): 230BPA1525 %r; 230BPA1530 %r; depois do 783,90, 1 (site = contrato - 7,10)' % (
    (743.8 - 741.7) / (a - 750.9), (776.8 - 743.8) / (783.9 - a)))

# 3) tabela de conferência (passo 1.2 do plano; análise, seção 3.4): tem de bater a 0,0005 km
CONF = [(750.90, 741.70), (751.94, 743.80), (783.90, 776.80), (855.90, 848.80), (872.90, 865.80), (916.90, 909.80), (1006.90, 999.80)]
print('\n  km do contrato   km do site')
for k, esp in CONF:
    v = conv(k, 0, 1)
    print('  %14s   %10s' % (('%.2f' % k).replace('.', ','), ('%.3f' % v).replace('.', ',')))
    if v is None or abs(v - esp) > 0.0005:
        falha('o km %.2f do contrato deu %s no site; o esperado era %.2f' % (k, v, esp))
inv = conv(760.0, 1, 0)
print('\n  inversa: km 760,00 do site = km %s do contrato' % ('%.2f' % inv).replace('.', ','))
if abs(inv - 767.63) > 0.005:
    falha('a inversa do km 760,00 deu %s; o esperado era 767,63' % inv)
print('  fora da faixa: km 1.010,00 do contrato = %s' % ('fora da faixa' if conv(1010.0, 0, 1) is None else 'ERRO'))
if conv(1010.0, 0, 1) is not None or conv(741.6, 1, 0) is not None:
    falha('km fora do domínio não voltou vazio')

# 4) trechos de deslocamento fixo: [versão, códigos em ordem, deslocamento esperado (km do site - km do contrato)]
FIXOS = [
    ('202104A', ['230BPA1400', '230BPA1405', '230BPA1410', '230BPA1420', '230BPA1440', '230BPA1460', '230BPA1470', '230BPA1480',
                 '230BPA1482', '230BPA1485', '230BPA1495', '230BPA1497'], -7.10),
    ('202304A', ['230BPA1400', '230BPA1405', '230BPA1410', '230BPA1420', '230BPA1440', '230BPA1460', '230BPA1470', '230BPA1480',
                 '230BPA1482', '230BPA1485', '230BPA1495', '230BPA1497', '230BPA1500', '230BPA1520', '230BPA1525', '230BPA1530',
                 '230BPA1540', '230BPA1550', '230BPA1580'], 0.20),
]
EIXO_KM = {x['codigo']: (x['kmIni'], x['kmFim']) for x in eixo['segmentos']}


def comprimento(f):
    line = [x for part in f['geometry']['coordinates'] for x in part]
    return sum(hav(line[i - 1], line[i]) for i in range(1, len(line)))


def fixo(ver, codes, dd):
    gv, gp = baixar(ver, codes), baixar(PARA, codes)
    fv = {f['properties']['Codigo_SNV']: f for f in gv.get('features', []) if f['properties'].get('Versao_SNV') == ver}
    fp = {f['properties']['Codigo_SNV']: f for f in gp.get('features', []) if f['properties'].get('Versao_SNV') == PARA}
    ant = None
    for c in codes:
        if c not in fv or c not in fp:
            falha('o segmento %s não veio na versão %s ou na %s' % (c, ver, PARA))
        a, b = fv[c]['properties'], fp[c]['properties']
        ki, kf, si, sf = a['Quilometragem_Inicio'], a['Quilometragem_Fim'], b['Quilometragem_Inicio'], b['Quilometragem_Fim']
        if (si, sf) != EIXO_KM.get(c):
            falha('no snv-br230.js, %s vai de %s; o WFS %s diz %s' % (c, EIXO_KM.get(c), PARA, (si, sf)))
        if abs((si - ki) - dd) > 0.0005 or abs((sf - kf) - dd) > 0.0005:
            falha('%s: %s a %s (%s) e %s a %s (%s) não têm o deslocamento %+.2f' % (c, ki, kf, ver, si, sf, PARA, dd))
        if ant is not None and abs(ki - ant) > 0.0005:
            falha('%s (%s) não começa onde o anterior termina (%s; %s)' % (c, ver, ant, ki))
        ant = kf
        lv, lp = comprimento(fv[c]), comprimento(fp[c])
        print('  %s  %s: %7.2f a %7.2f  ->  %7.2f a %7.2f   traçado %8.3f / %8.3f km' % (c, ver, ki, kf, si, sf, lv / 1000, lp / 1000))
        if abs(lv - lp) > 0.03 * max(lv, lp):
            falha('o traçado do %s tem %.3f km em %s e %.3f km em %s' % (c, lv / 1000, ver, lp / 1000, PARA))
    k0 = fv[codes[0]]['properties']['Quilometragem_Inicio']
    return [[k0, round(k0 + dd, 3)], [ant, round(ant + dd, 3)]]


print('\nTrechos de deslocamento fixo:')
T104 = fixo(*FIXOS[0])
T304 = fixo(*FIXOS[1])


# 5) grava o arquivo (LF, UTF-8). Cada versão: trechos (cada um, uma lista de quebras, linear entre elas; fora de todos, null)
def versao(de, eq, trechos):
    todas = [q for tr in trechos for q in tr]
    return {'de': de, 'equivalentes': eq, 'para': PARA, 'trechos': trechos,
            'dominio': {'contrato': [min(q[0] for q in todas), max(q[0] for q in todas)], 'site': [min(q[1] for q in todas), max(q[1] for q in todas)]}}


V = {'202104A': versao(DE, '202004A a 202206A', [T104, Q]), '202304A': versao('202304A', '', [T304])}
D = {'fonte': 'DNIT · SNV, camada vgeo:vw_snv_rod (WFS)', 'baixadoEm': baixado, 'para': PARA, 'versoes': V}
JS = '''/* Réguas do km dos contratos de conservação: km do contrato para o km do site (SNV %(para)s, o eixo de snv-br230.js), e
   de volta, uma por versão do SNV do contrato (campo snvVersao; sem ele, 202104A): 202104A (437, 438, 310, 419, 264) e
   202304A (558, 665). Gerado por ferramentas/snv_conversao_build.py do WFS do DNIT (baixado em %(bx)s). Não editar à mão:
   rodar o script de novo quando o eixo do site mudar de versão.
   Dentro de um trecho, o km é linear entre dois pontos de quebra; fora dos trechos as funções devolvem null (não extrapolam).
   O topo do objeto repete a versão 202104A só do trecho do 437/438 (quebras, paraSite, paraContrato), como antes. */
window.SNV_CONVERSAO = (function () {
  var D = %(json)s;
  // i: coluna de entrada (0 = contrato, 1 = site), j: a de saída
  function conv(trechos, i, j, k) {
    if (k == null || k === '' || !isFinite(k = Number(k))) return null;
    for (var r = 0; r < trechos.length; r++) {
      var q = trechos[r], n = q.length;
      if (k < q[0][i] - 1e-9 || k > q[n - 1][i] + 1e-9) continue;
      for (var t = 1; t < n; t++) if (k <= q[t][i] + 1e-9) return q[t - 1][j] + (k - q[t - 1][i]) * (q[t][j] - q[t - 1][j]) / (q[t][i] - q[t - 1][i]);
    }
    return null;
  }
  Object.keys(D.versoes).forEach(function (v) {
    var o = D.versoes[v];
    o.quebras = [].concat.apply([], o.trechos);
    o.paraSite = function (k) { return conv(o.trechos, 0, 1, k); };       // km do contrato -> km do site
    o.paraContrato = function (s) { return conv(o.trechos, 1, 0, s); };   // km do site -> km do contrato
  });
  // a régua de um contrato pela versão do SNV dele (sem versão: 202104A; versão sem régua: null)
  D.versao = function (v) { return D.versoes[v || '202104A'] || null; };
  var a = D.versoes['202104A'], t437 = a.trechos[a.trechos.length - 1];
  D.de = a.de; D.equivalentes = a.equivalentes; D.quebras = t437;
  D.dominio = { contrato: [t437[0][0], t437[t437.length - 1][0]], site: [t437[0][1], t437[t437.length - 1][1]] };
  D.paraSite = function (k) { return conv([t437], 0, 1, k); };
  D.paraContrato = function (s) { return conv([t437], 1, 0, s); };
  return D;
})();
''' % {'para': PARA, 'bx': baixado, 'json': json.dumps(D, ensure_ascii=False, separators=(',', ':'))}
with open(saida, 'w', encoding='utf-8', newline='\n') as fo:
    fo.write(JS)
print('\nGravado: %s (%d bytes)' % (saida, len(JS.encode('utf-8'))))
