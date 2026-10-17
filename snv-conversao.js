/* Régua do km dos contratos de conservação 437 e 438: km do contrato (SNV 202104A; os km são os mesmos de
   202004A a 202206A) para o km do site (SNV 202607A, o eixo de snv-br230.js), e de volta. Gerado por
   ferramentas/snv_conversao_build.py do WFS do DNIT (baixado em 2026-10-17). Não editar à mão: rodar o script de novo quando
   o eixo do site mudar de versão.
   Entre dois pontos de quebra o km é linear; fora do domínio as funções devolvem null (não extrapolam). */
window.SNV_CONVERSAO = (function () {
  var D = {"fonte":"DNIT · SNV, camada vgeo:vw_snv_rod (WFS)","de":"202104A","equivalentes":"202004A a 202206A","para":"202607A","baixadoEm":"2026-10-17","quebras":[[750.9,741.7],[751.9398997732765,743.8],[783.9,776.8],[855.9,848.8],[916.9,909.8],[1006.9,999.8]],"dominio":{"contrato":[750.9,1006.9],"site":[741.7,999.8]}};
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
