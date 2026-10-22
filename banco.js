/*
 * Banco compartilhado (Supabase, projeto diagrama-linear-br230): contratos, pontos e configurações de toda a equipe.
 * Leitura pública com a chave publicável (feita para ficar no site). Gravar só pelas funções do banco
 * (salvar, definir_codigos), que conferem o código da equipe; as tabelas não aceitam gravação direta.
 *
 *   Banco.carregar(cred)                  -> {contratos, pontos, config, versao, propostas, novo, publico, acesso, sessaoInvalida}
 *     (migração 11: dados_ler, já filtrado pelo papel e pelos contratos da pessoa; sem código, só a visão geral.
 *      Sem a função no banco, lê as tabelas como antes)
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
 *   Banco.fotosMover(cred, ids, contratoId, pontoId|null) -> {movidas, lote, ponto_nome}   (migração 06: corrigir contrato e ponto)
 *   Banco.fotoImportar(cred, foto, miniB64) -> {nova}   foto que já estava no Drive e não no banco (migração 06, Administrador)
 *
 * Análise das medições (migração 05; engenheiro, auxiliar, Administrador e, desde a 11, o analista com as medições do contrato):
 *   Banco.analise(cred, contratoId) -> {dados, fonte, em, por} | null
 *   Banco.analiseOcorr(cred, contratoId, kmIni, kmFim) -> ocorrências medidas da conservação no trecho (migração 14)
 */
(function () {
  'use strict';

  // oficial ou banco de teste da prévia (ambiente.js). Sem ambiente.js não há banco: a prévia não pode cair no oficial
  var AMB = window.AMBIENTE || {};
  var BASE = AMB.supabaseUrl ? AMB.supabaseUrl + '/rest/v1/' : null;
  var KEY = AMB.supabaseKey || '';

  function req(path, body) {
    if (!BASE || !KEY) {
      var e0 = new Error('A configuração do site não carregou');
      e0.code = 'sem_ambiente';
      e0.status = 0;          // como sem rede: nada é recusado nem descartado, só não sai daqui
      return Promise.reject(e0);
    }
    var o = { method: body ? 'POST' : 'GET', headers: { apikey: KEY, 'Content-Type': 'application/json' }, cache: 'no-store' };
    if (body) o.body = JSON.stringify(body);
    var timer = null;
    if (window.AbortController) {
      var ctl = new AbortController();
      o.signal = ctl.signal;
      timer = setTimeout(function () { ctl.abort(); }, 20000);
    }
    // o prazo de 20 s vale até a resposta chegar inteira: com o sinal caindo no meio do corpo, r.text() ficaria parado e o
    // envio da fila e das fotos travava até recarregar o app
    return fetch(BASE + path, o).then(function (r) {
      return r.text().then(function (t) {
        clearTimeout(timer);
        var j = null;
        try { j = t ? JSON.parse(t) : null; } catch (e) { j = null; }
        if (!r.ok) {
          var err = new Error((j && j.message) || 'HTTP ' + r.status);
          err.code = (j && j.message) || 'http_' + r.status;
          err.status = r.status;          // 4xx: o banco respondeu e recusou; 5xx: falha do servidor
          err.pg = (j && j.code) || '';   // código do Postgres (P0001 = recusa das nossas funções)
          err.detalhe = (j && j.details) || '';
          throw err;
        }
        return j;
      }, function () {
        clearTimeout(timer);
        var e1 = new Error('A resposta do banco não chegou inteira');
        e1.code = 'sem_rede';   // como sem sinal: nada sai da fila, tenta de novo depois
        e1.status = 0;
        throw e1;
      });
    }, function () {
      clearTimeout(timer);
      var err = new Error('Sem conexão com o banco');
      err.code = 'sem_rede';
      err.status = 0;
      throw err;
    });
  }
  function rpc(fn, args) { return req('rpc/' + fn, args || {}); }

  window.Banco = {
    carregar: function (cred) {
      var antigo = this.carregarAntigo;
      return rpc('dados_ler', { p_cred: cred || null }).then(function (r) {
        return { contratos: r.contratos || [], pontos: r.pontos || [], config: r.config || [], versao: Number(r.versao) || 0, propostas: r.propostas || [],
          novo: true, publico: !!r.publico, acesso: r.acesso || null, sessaoInvalida: !!r.sessao_invalida };
      }, function (e) {
        // banco ainda sem a migração 11 (função não encontrada): lê as tabelas
        if (e && (e.pg === 'PGRST202' || e.status === 404)) return antigo();
        throw e;
      });
    },
    carregarAntigo: function () {
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
    historico: function (n, cred) {
      return rpc('historico_ler', { p_cred: cred || null, p_n: n || 40 }).catch(function (e) {
        if (e && (e.pg === 'PGRST202' || e.status === 404)) return req('historico?select=em,autor,papel,resumo,conflitos&order=id.desc&limit=' + (n || 40));
        throw e;
      });
    },

    entrarV2: function (codigo, nome, aparelho) { return rpc('entrar_v2', { p_codigo: codigo, p_nome: nome || null, p_aparelho: aparelho || null }); },
    criarCriador: function (nome, codigo, aparelho) { return rpc('criar_criador', { p_nome: nome, p_codigo: codigo, p_aparelho: aparelho || null }); },
    sessao: function (cred) { return rpc('sessao', { p_cred: cred }); },
    sair: function (token) { return rpc('sair', { p_token: token }); },
    usuarios: function (cred) { return rpc('usuarios_listar', { p_cred: cred }); },
    usuarioSalvar: function (cred, u) {
      return rpc('usuario_salvar', { p_cred: cred, p_id: u.id || null, p_nome: u.nome, p_papel: u.papel, p_codigo: u.codigo || null, p_ativo: u.ativo !== false,
        p_acesso: u.acesso || null });   // contratos do fiscal e do analista (migração 11)
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
    fotoImportar: function (cred, foto, mini) { return rpc('foto_importar', { p_cred: cred, p_foto: foto, p_mini: mini || null }); },
    fotosMover: function (cred, ids, cid, pid) { return rpc('fotos_mover', { p_cred: cred, p_ids: ids, p_contrato: cid, p_ponto: pid || null }); },

    analise: function (cred, cid) { return rpc('analise_ler', { p_cred: cred, p_contrato: cid }); },
    // ocorrências medidas da conservação no trecho de km (migração 14): [[medição, serviço, km ini, km fim, lado, q, local, pág.]]
    analiseOcorr: function (cred, cid, ki, kf) { return rpc('analise_ocorr_ler', { p_cred: cred, p_contrato: cid, p_km_ini: ki, p_km_fim: kf }); },
    // carga das medições (Administrador, menu Dados › Carregar medições): a análise inteira e, na conservação,
    // as ocorrências em partes (inicio = posição da 1ª linha da parte; 0 apaga as anteriores do contrato)
    analiseGravar: function (cred, cid, dados, fonte) { return rpc('analise_gravar', { p_cred: cred, p_contrato: cid, p_dados: dados, p_fonte: fonte || '' }); },
    analiseOcorrGravar: function (cred, cid, linhas, inicio) {
      return rpc('analise_ocorr_gravar', { p_cred: cred, p_contrato: cid, p_linhas: linhas, p_inicio: inicio }).then(Number);
    },
    // medições por MP (migração 21, decisão D-15): base do contrato + versão atual de cada MP; o app monta a análise (medmp.js)
    medicoes: function (cred, cid) { return rpc('medicoes_ler', { p_cred: cred, p_contrato: cid }); },
    medicoesOcorr: function (cred, cid, ki, kf) { return rpc('medicoes_ocorr_ler', { p_cred: cred, p_contrato: cid, p_km_ini: ki, p_km_fim: kf }); },
    medicoesVersoes: function (cred, cid, n) { return rpc('medicoes_versoes', { p_cred: cred, p_contrato: cid, p_n: n == null ? null : Number(n) }).then(function (r) { return r || []; }); },
    medicaoVersao: function (cred, cid, n, v) { return rpc('medicao_versao_ler', { p_cred: cred, p_contrato: cid, p_n: Number(n), p_versao: Number(v) }); },
    medicaoVoltar: function (cred, cid, n, v, motivo) { return rpc('medicao_voltar', { p_cred: cred, p_contrato: cid, p_n: Number(n), p_versao: Number(v), p_motivo: motivo }); },
    medicoesQuando: function (cred) { return rpc('medicoes_quando', { p_cred: cred }).then(function (r) { return r || {}; }); },
    // carga em partes, com troca única no fim: iniciar (base nova ou null) -> mp (dados, ou null para retirar) -> ocorr -> concluir
    cargaIniciar: function (cred, cid, base, fonte, motivo) { return rpc('carga_iniciar', { p_cred: cred, p_contrato: cid, p_base: base || null, p_fonte: fonte || '', p_motivo: motivo || '' }).then(Number); },
    cargaMp: function (cred, carga, n, dados) { return rpc('carga_mp', { p_cred: cred, p_carga: carga, p_n: Number(n), p_dados: dados }).then(Number); },
    cargaOcorr: function (cred, carga, n, linhas, inicio) { return rpc('carga_ocorr', { p_cred: cred, p_carga: carga, p_n: Number(n), p_linhas: linhas, p_inicio: inicio }).then(Number); },
    cargaConcluir: function (cred, carga, esperado) { return rpc('carga_concluir', { p_cred: cred, p_carga: carga, p_esperado: esperado }); },
    cargaCancelar: function (cred, carga) { return rpc('carga_cancelar', { p_cred: cred, p_carga: carga }); },
    // marca "medido sem execução" (uso interno): med = nº da medição, ou null para tirar
    analiseMarcar: function (cred, cid, pid, grupo, med) {
      return rpc('analise_marcar', { p_cred: cred, p_contrato: cid, p_ponte: pid, p_grupo: grupo, p_medicao: med == null ? null : Number(med) });
    }
  };
})();
