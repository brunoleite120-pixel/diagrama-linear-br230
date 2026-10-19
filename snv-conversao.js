/* Réguas do km dos contratos de conservação: km do contrato para o km do site (SNV 202607A, o eixo de snv-br230.js), e
   de volta, uma por versão do SNV do contrato (campo snvVersao; sem ele, 202104A): 202104A (437, 438, 310, 419, 264) e
   202304A (558, 665). Gerado por ferramentas/snv_conversao_build.py do WFS do DNIT (baixado em 2026-10-19). Não editar à mão:
   rodar o script de novo quando o eixo do site mudar de versão.
   Dentro de um trecho, o km é linear entre dois pontos de quebra; fora dos trechos as funções devolvem null (não extrapolam).
   O topo do objeto repete a versão 202104A só do trecho do 437/438 (quebras, paraSite, paraContrato), como antes. */
window.SNV_CONVERSAO = (function () {
  var D = {"fonte":"DNIT · SNV, camada vgeo:vw_snv_rod (WFS)","baixadoEm":"2026-10-19","para":"202607A","versoes":{"202104A":{"de":"202104A","equivalentes":"202004A a 202206A","para":"202607A","trechos":[[[308.4,301.3],[649.5,642.4]],[[750.9,741.7],[751.9398997732765,743.8],[783.9,776.8],[855.9,848.8],[916.9,909.8],[1006.9,999.8]]],"dominio":{"contrato":[308.4,1006.9],"site":[301.3,999.8]}},"202304A":{"de":"202304A","equivalentes":"","para":"202607A","trechos":[[[301.1,301.3],[999.6,999.8]]],"dominio":{"contrato":[301.1,999.6],"site":[301.3,999.8]}}}};
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
