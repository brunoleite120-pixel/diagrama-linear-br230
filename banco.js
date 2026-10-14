/*
 * Banco compartilhado (Supabase, projeto diagrama-linear-br230): contratos, pontos e configurações de toda a equipe.
 * Leitura pública com a chave publicável (feita para ficar no site). Gravar só pelas funções do banco
 * (salvar, definir_codigos), que conferem o código da equipe; as tabelas não aceitam gravação direta.
 *
 *   Banco.carregar()                      -> {contratos, pontos, config, versao}
 *   Banco.versao()                        -> número que muda a cada gravação
 *   Banco.entrar(codigo)                  -> 'equipe' | 'responsavel' | null
 *   Banco.salvar(codigo, autor, resumo, ops) -> nova versão
 *   Banco.codigosDefinidos(), Banco.definirCodigos(atual, equipe, responsavel), Banco.historico(n)
 */
(function () {
  'use strict';

  var BASE = 'https://gwuoxrljxuwtiavjrcup.supabase.co/rest/v1/';
  var KEY = 'sb_publishable_B5a0XlObjcN96TklpN1CdA_2kkaUhOg';

  function req(path, body) {
    var o = { method: body ? 'POST' : 'GET', headers: { apikey: KEY, 'Content-Type': 'application/json' }, cache: 'no-store' };
    if (body) o.body = JSON.stringify(body);
    var timer = null;
    if (window.AbortController) {
      var ctl = new AbortController();
      o.signal = ctl.signal;
      timer = setTimeout(function () { ctl.abort(); }, 20000);
    }
    return fetch(BASE + path, o).then(function (r) {
      clearTimeout(timer);
      return r.text().then(function (t) {
        var j = null;
        try { j = t ? JSON.parse(t) : null; } catch (e) { j = null; }
        if (!r.ok) {
          var err = new Error((j && j.message) || 'HTTP ' + r.status);
          err.code = (j && j.message) || 'http_' + r.status;
          throw err;
        }
        return j;
      });
    }, function () {
      clearTimeout(timer);
      var err = new Error('Sem conexão com o banco');
      err.code = 'sem_rede';
      throw err;
    });
  }
  function rpc(fn, args) { return req('rpc/' + fn, args || {}); }

  window.Banco = {
    carregar: function () {
      return Promise.all([
        req('contratos?select=id,dados,ordem&order=ordem.asc,id.asc'),
        req('pontos?select=contrato_id,id,dados&order=contrato_id.asc,id.asc'),
        req('config?select=chave,valor'),
        rpc('versao')
      ]).then(function (r) { return { contratos: r[0] || [], pontos: r[1] || [], config: r[2] || [], versao: Number(r[3]) || 0 }; });
    },
    versao: function () { return rpc('versao').then(Number); },
    entrar: function (codigo) { return rpc('entrar', { p_codigo: codigo }); },
    codigosDefinidos: function () { return rpc('codigos_definidos'); },
    definirCodigos: function (atual, equipe, responsavel) {
      return rpc('definir_codigos', { p_atual: atual || null, p_equipe: equipe || null, p_responsavel: responsavel || null });
    },
    salvar: function (codigo, autor, resumo, ops) {
      return rpc('salvar', { p_codigo: codigo, p_autor: autor || null, p_resumo: resumo || null, p_ops: ops }).then(Number);
    },
    historico: function (n) { return req('historico?select=em,autor,papel,resumo&order=id.desc&limit=' + (n || 40)); }
  };
})();
