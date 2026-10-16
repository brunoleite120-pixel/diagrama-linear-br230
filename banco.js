/*
 * Banco compartilhado (Supabase, projeto diagrama-linear-br230): contratos, pontos e configurações de toda a equipe.
 * Leitura pública com a chave publicável (feita para ficar no site). Gravar só pelas funções do banco
 * (salvar, definir_codigos), que conferem o código da equipe; as tabelas não aceitam gravação direta.
 *
 *   Banco.carregar()                      -> {contratos, pontos, config, versao}
 *   Banco.versao()                        -> número que muda a cada gravação
 *   Banco.entrar(codigo)                  -> 'equipe' | 'responsavel' | null
 *   Banco.salvarCampos(codigo, autor, resumo, ops) -> {versao, conflitos} (só os campos alterados; fica o de quem alterou por último)
 *   Banco.salvar(codigo, autor, resumo, ops) -> nova versão
 *   Banco.codigosDefinidos(), Banco.definirCodigos(atual, equipe, responsavel), Banco.historico(n)
 *
 * Acesso por pessoa (desde a migração 03): cada entrada vira uma sessão ("tk_..."), usada no lugar do código.
 *   Banco.entrarV2(codigo, nome, aparelho) -> {token, papel: criador|engenheiro|fiscal, nome, uid} | null
 *   Banco.criarCriador(nome, codigo, aparelho), Banco.sessao(token), Banco.sair(token)
 *   Banco.usuarios(cred), Banco.usuarioSalvar(cred, u), Banco.codigoGeralDesativar(cred, 'equipe'|'responsavel')
 *   Banco.decidir(cred, ids, aprovar, motivo)      propostas dos fiscais
 *   Banco.lixeira(cred), Banco.restaurarLixeira(cred, id), Banco.copiaDados(cred, id), Banco.restaurarCopia(cred, id)
 *
 * Fotos (migração 04; o arquivo inteiro fica no Drive, aqui só os dados e a miniatura):
 *   Banco.fotoRegistrar(cred, foto, miniB64), Banco.fotosListar(cred, 'minhas'|'todas'|'relatorio'|'deletadas', limite, antes)
 *   Banco.fotosMini(cred, ids) -> [{id, jpeg}]   Banco.fotoRelatorio(cred, ids, marcar) -> quantas
 *
 * Análise das medições (migração 05; só engenheiro e criador, a tabela não tem leitura pública):
 *   Banco.analise(cred, contratoId) -> {dados, fonte, em, por} | null
 */
(function () {
  'use strict';

  // oficial ou banco de teste da prévia (ambiente.js)
  var AMB = window.AMBIENTE || {};
  var BASE = (AMB.supabaseUrl || 'https://gwuoxrljxuwtiavjrcup.supabase.co') + '/rest/v1/';
  var KEY = AMB.supabaseKey || 'sb_publishable_B5a0XlObjcN96TklpN1CdA_2kkaUhOg';

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
        req('contratos?select=id,dados,ordem,meta,atualizado_em,atualizado_por&order=ordem.asc,id.asc'),
        req('pontos?select=contrato_id,id,dados,meta,atualizado_em,atualizado_por&order=contrato_id.asc,id.asc'),
        req('config?select=chave,valor'),
        rpc('versao'),
        req('propostas?select=id,contrato_id,ponto_id,ponto_nome,campos,autor_uid,autor_nome,atualizado_em&situacao=eq.pendente&order=id.asc')
          .catch(function (e) { if (e && e.code === 'sem_rede') throw e; return []; })   // banco ainda sem propostas
      ]).then(function (r) { return { contratos: r[0] || [], pontos: r[1] || [], config: r[2] || [], versao: Number(r[3]) || 0, propostas: r[4] || [] }; });
    },
    versao: function () { return rpc('versao').then(Number); },
    entrar: function (codigo) { return rpc('entrar', { p_codigo: codigo }); },
    codigosDefinidos: function () { return rpc('codigos_definidos'); },
    definirCodigos: function (atual, equipe, responsavel) {
      return rpc('definir_codigos', { p_atual: atual || null, p_equipe: equipe || null, p_responsavel: responsavel || null });
    },
    salvarCampos: function (codigo, autor, resumo, ops) {
      return rpc('salvar_v2', { p_codigo: codigo, p_autor: autor || null, p_resumo: resumo || null, p_ops: ops });
    },
    salvar: function (codigo, autor, resumo, ops) {
      return rpc('salvar', { p_codigo: codigo, p_autor: autor || null, p_resumo: resumo || null, p_ops: ops }).then(Number);
    },
    historico: function (n) { return req('historico?select=em,autor,papel,resumo,conflitos&order=id.desc&limit=' + (n || 40)); },

    entrarV2: function (codigo, nome, aparelho) { return rpc('entrar_v2', { p_codigo: codigo, p_nome: nome || null, p_aparelho: aparelho || null }); },
    criarCriador: function (nome, codigo, aparelho) { return rpc('criar_criador', { p_nome: nome, p_codigo: codigo, p_aparelho: aparelho || null }); },
    sessao: function (cred) { return rpc('sessao', { p_cred: cred }); },
    sair: function (token) { return rpc('sair', { p_token: token }); },
    usuarios: function (cred) { return rpc('usuarios_listar', { p_cred: cred }); },
    usuarioSalvar: function (cred, u) {
      return rpc('usuario_salvar', { p_cred: cred, p_id: u.id || null, p_nome: u.nome, p_papel: u.papel, p_codigo: u.codigo || null, p_ativo: u.ativo !== false });
    },
    codigoGeralDesativar: function (cred, papel) { return rpc('codigo_geral_desativar', { p_cred: cred, p_papel: papel }); },
    decidir: function (cred, ids, aprovar, motivo) { return rpc('decidir_propostas', { p_cred: cred, p_ids: ids, p_aprovar: !!aprovar, p_motivo: motivo || null }); },
    lixeira: function (cred) { return rpc('lixeira_listar', { p_cred: cred }); },
    restaurarLixeira: function (cred, id) { return rpc('restaurar_lixeira', { p_cred: cred, p_id: id }).then(Number); },
    copiaDados: function (cred, id) { return rpc('copia_dados', { p_cred: cred, p_id: id }); },
    restaurarCopia: function (cred, id) { return rpc('restaurar_copia', { p_cred: cred, p_id: id }).then(Number); },

    fotoRegistrar: function (cred, foto, mini) { return rpc('foto_registrar', { p_cred: cred, p_foto: foto, p_mini: mini || null }); },
    fotosListar: function (cred, escopo, limite, antes) {
      return rpc('fotos_listar', { p_cred: cred, p_escopo: escopo, p_limite: limite || 300, p_antes: antes || null }).then(function (r) { return r || []; });
    },
    fotosMini: function (cred, ids) { return rpc('fotos_mini', { p_cred: cred, p_ids: ids }).then(function (r) { return r || []; }); },
    fotoRelatorio: function (cred, ids, marcar) { return rpc('foto_relatorio', { p_cred: cred, p_ids: ids, p_marcar: !!marcar }).then(Number); },

    analise: function (cred, cid) { return rpc('analise_ler', { p_cred: cred, p_contrato: cid }); }
  };
})();
