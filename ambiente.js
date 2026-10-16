/*
 * Ambiente do site: "oficial" (o link da equipe) ou "previa" (o link /previa/ e o app do grupo Prévia do TestFlight).
 * A prévia usa o banco de teste e guarda o que fica no aparelho com o prefixo "previa.", porque o site oficial
 * e a prévia ficam no mesmo endereço (github.io) e dividiriam o mesmo armazenamento.
 * As montagens (.github/workflows/pages.yml e ios.yml) trocam NOME e VERSAO abaixo; este arquivo carrega antes dos outros.
 */
(function () {
  'use strict';

  var NOME = 'oficial';
  var VERSAO = 'dev';

  var BANCOS = {
    oficial: { url: 'https://gwuoxrljxuwtiavjrcup.supabase.co', chave: 'sb_publishable_B5a0XlObjcN96TklpN1CdA_2kkaUhOg', prefixo: '' },
    previa: { url: 'https://rczjtfgrxtwriobummnm.supabase.co', chave: 'sb_publishable_S9_Ikj2-YMzs29AVtLKKiQ_kANb1JHv', prefixo: 'previa.' }
  };
  var b = BANCOS[NOME] || BANCOS.oficial;
  var previa = NOME === 'previa';

  window.AMBIENTE = { nome: NOME, previa: previa, versao: VERSAO, supabaseUrl: b.url, supabaseKey: b.chave, prefixo: b.prefixo };

  // armazenamento do aparelho separado do site oficial
  if (b.prefixo) {
    try {
      var S = window.Storage && Storage.prototype, ls = window.localStorage;
      ['getItem', 'setItem', 'removeItem'].forEach(function (m) {
        var orig = S[m];
        S[m] = function (k) {
          var a = Array.prototype.slice.call(arguments);
          if (this === ls) a[0] = b.prefixo + k;
          return orig.apply(this, a);
        };
      });
    } catch (e) { /* sem armazenamento */ }
    try {
      var F = window.IDBFactory && IDBFactory.prototype;
      ['open', 'deleteDatabase'].forEach(function (m) {
        var orig = F[m];
        F[m] = function (nome) {
          var a = Array.prototype.slice.call(arguments);
          a[0] = b.prefixo + nome;
          return orig.apply(this, a);
        };
      });
    } catch (e) { /* sem IndexedDB */ }
  }

  // selo PRÉVIA na barra e a versão no menu Dados
  function marcar() {
    var brand = document.querySelector('.topbar .brand');
    if (previa && brand && !document.getElementById('seloPrevia')) {
      var s = document.createElement('span');
      s.id = 'seloPrevia';
      s.className = 'selo-previa';
      s.title = 'Versão de teste, com o banco de teste. A equipe usa o link oficial.';
      s.textContent = 'Prévia';
      brand.appendChild(s);
    }
    var menu = document.getElementById('menuPop');
    if (menu && !document.getElementById('versaoSite')) {
      var v = document.createElement('div');
      v.id = 'versaoSite';
      v.className = 'menu-versao';
      v.textContent = (previa ? 'Prévia · ' : 'Versão ') + VERSAO;
      menu.appendChild(document.createElement('hr'));
      menu.appendChild(v);
    }
  }
  if (previa) {
    document.title = 'PRÉVIA · ' + document.title;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', marcar);
  else marcar();
})();
