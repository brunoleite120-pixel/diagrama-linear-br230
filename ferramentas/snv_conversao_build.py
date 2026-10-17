# Gera site/snv-conversao.js: a régua que converte o km dos contratos de conservação 437 e 438 (km do contrato, SNV
# 2020-2022, citado como 202101A; os km e a geometria são os mesmos de 202004A a 202206A) no km do site (SNV 202607A, o
# eixo de snv-br230.js), e de volta. Baixa do WFS do DNIT a geometria das duas versões, confere que o traçado é o mesmo,
# calcula os pontos de quebra (dentro de um segmento do SNV o km é proporcional ao comprimento, como em snv_build.py) e
# imprime a tabela de conferência. Não grava nada se uma conferência falhar.
# Rodar de novo sempre que o eixo do site (snv-br230.js) mudar de versão: a régua vale só para o eixo da versão PARA.
#   python -I ferramentas/snv_conversao_build.py                         (baixa do WFS e grava ../snv-conversao.js)
#   python -I ferramentas/snv_conversao_build.py --local de.json para.json   (usa o GeoJSON já baixado)
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
    with urllib.request.urlopen(WFS + '?' + urllib.parse.urlencode(q), timeout=120) as r:
        return json.loads(r.read().decode('utf-8'))


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

# 4) grava o arquivo (LF, UTF-8)
D = {'fonte': 'DNIT · SNV, camada vgeo:vw_snv_rod (WFS)', 'de': DE, 'equivalentes': '202004A a 202206A', 'para': PARA,
     'baixadoEm': baixado, 'quebras': Q, 'dominio': {'contrato': [Q[0][0], Q[-1][0]], 'site': [Q[0][1], Q[-1][1]]}}
JS = '''/* Régua do km dos contratos de conservação 437 e 438: km do contrato (SNV %(de)s; os km são os mesmos de
   %(eq)s) para o km do site (SNV %(para)s, o eixo de snv-br230.js), e de volta. Gerado por
   ferramentas/snv_conversao_build.py do WFS do DNIT (baixado em %(bx)s). Não editar à mão: rodar o script de novo quando
   o eixo do site mudar de versão.
   Entre dois pontos de quebra o km é linear; fora do domínio as funções devolvem null (não extrapolam). */
window.SNV_CONVERSAO = (function () {
  var D = %(json)s;
  // i: coluna de entrada (0 = contrato, 1 = site), j: a de saída
  function conv(i, j, k) {
    var q = D.quebras, n = q.length;
    if (k == null || k === '' || !isFinite(k = Number(k)) || k < q[0][i] - 1e-9 || k > q[n - 1][i] + 1e-9) return null;
    for (var t = 1; t < n; t++) if (k <= q[t][i] + 1e-9) return q[t - 1][j] + (k - q[t - 1][i]) * (q[t][j] - q[t - 1][j]) / (q[t][i] - q[t - 1][i]);
    return null;
  }
  D.paraSite = function (k) { return conv(0, 1, k); };       // km do contrato -> km do site
  D.paraContrato = function (s) { return conv(1, 0, s); };   // km do site -> km do contrato
  return D;
})();
''' % {'de': DE, 'eq': D['equivalentes'], 'para': PARA, 'bx': baixado, 'json': json.dumps(D, ensure_ascii=False, separators=(',', ':'))}
with open(saida, 'w', encoding='utf-8', newline='\n') as fo:
    fo.write(JS)
print('\nGravado: %s (%d bytes)' % (saida, len(JS.encode('utf-8'))))
