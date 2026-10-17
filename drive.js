/*
 * Fotos do aparelho e envio ao Google Drive da equipe.
 * Cada foto com carimbo fica guardada no aparelho (IndexedDB "diagrama-linear-fotos": loja "fotos" com os dados e a
 * miniatura, loja "arquivos" com a foto inteira) e sobe em duas etapas, uma foto de cada vez:
 *   1) o arquivo vai para o script do Google (drive-fotos/Codigo.gs), que guarda em "Fotos por pessoa / <nome> / CT nº / Ponto"
 *      (a pasta do contrato pelo número, "CT 02 00314-2026"; `pastaAntiga`, o nome usado até a versão 51 do app, vai junto para o
 *      script renomear a pasta antiga da pessoa no primeiro envio; o script antigo ignora o campo);
 *   2) os dados e a miniatura vão para o banco (foto_registrar), que alimenta as galerias do app.
 * Sem sinal, as fotos esperam (mesmo com o app fechado). Depois de enviada, a foto continua no aparelho até a pessoa
 * apagar "só do celular". A foto marcada para não ir ao Drive fica só no aparelho (situação 'aparelho') até a pessoa
 * mandar enviar pela galeria.
 *
 * Cada gravação que muda a foto (salvar de novo, corrigir, enviar/não enviar) soma 1 em `versao`: no fim de cada etapa o
 * envio lê o registro de novo e, se ele mudou no meio, grava só o resultado do envio sobre os dados novos (a foto apagada
 * no meio não volta).
 * Falhas: sem sinal ou tempo esgotado, a foto espera 1, 2, 4, 8… até 15 min (guardado com ela) e a fila espera junto; as
 * que ainda não falharam passam na frente, e o sinal que volta (evento online) solta as que esperavam por ele.
 * Acesso recusado pelo script, a fila não manda a foto inteira de novo: espera crescente e o app confere o acesso no banco
 * (a recusa fica guardada no aparelho, para conferir antes ao abrir o app de novo). O resultado de um envio ou conferência
 * feito com o acesso anterior não vale depois que a pessoa entra de novo.
 *
 *   var d = DriveFotos({ getUrl, getLogin, ambiente, registrar(cred, foto, miniB64), conferir(cred) -> Promise<vale>, onChange, onSent });
 *     conferir: true = o acesso vale, false = o banco confirmou que não vale mais; falha = não deu para conferir
 *   d.add([{ id, nome, blob, pastas: ['CT 02 00315-2026', 'P7'], pastaAntiga: 'Lote 02', descricao, meta, enviar }])  -> Promise
 *     (enviar: false = só no aparelho; pastaAntiga: opcional, texto)
 *   d.list() -> Promise<[{ id, nome, meta, situacao: 'fila'|'aparelho'|'enviada', erro, enviada, tamanho, mini: Blob|null }]>
 *   d.enviar(ids, sim) -> Promise<quantas>   sim: as 'aparelho' vão para a fila; não: as da fila que ainda não subiram ficam só no
 *     aparelho (a que está subindo agora não: ela já vai para o Drive)
 *   d.arquivo(id) -> Promise<Blob|null>      d.apagar(ids) (some do aparelho)
 *   d.corrigir(ids, meta, pastas, pastaAntiga) -> Promise<{ quantas, enviadas: [ids] }>   troca contrato e ponto (meta: cid, pid,
 *     pnome, lote); as que ainda não subiram vão para a pasta nova do Drive (com a pastaAntiga do contrato novo; sem ela, nenhuma);
 *     `enviadas`: as que já estavam registradas no banco na hora da gravação (o app corrige essas também no banco)
 *   d.info() -> { n, aparelho, busy, erro, enviadas, total, bytes, prox, emEnvio }   prox: hora (ms) da próxima tentativa, ou null;
 *     emEnvio: id da foto que está subindo agora, ou null
 *     erro: 'rede' (sem sinal), 'tempo' (o envio demorou demais), 'recusado' (o script recusou e o banco não respondeu),
 *     'script' (o script recusou, mas o banco confirmou que o acesso vale), 'codigo' (o banco confirmou que o acesso não vale
 *     mais: a fila para até entrar de novo, d.resetCode()), 'banco' (o banco não aceitou o registro), ou o motivo da recusa de uma foto
 *   d.pump()   d.pump(true): "Enviar agora", a pessoa pediu: não espera as pausas
 */
(function () {
  'use strict';

  var DB = 'diagrama-linear-fotos', FOTOS = 'fotos', ARQ = 'arquivos', VELHA = 'fila';

  function openDb() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('sem_indexeddb')); return; }
      var r = indexedDB.open(DB, 2);
      r.onupgradeneeded = function () {
        var db = r.result, t = r.transaction;
        if (!db.objectStoreNames.contains(FOTOS)) db.createObjectStore(FOTOS, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(ARQ)) db.createObjectStore(ARQ, { keyPath: 'id' });
        // versão 1: só a fila de envio (foto inteira junto); passa para as lojas novas
        if (db.objectStoreNames.contains(VELHA)) {
          var g = t.objectStore(VELHA).getAll();
          g.onsuccess = function () {
            (g.result || []).forEach(function (x) {
              t.objectStore(ARQ).put({ id: x.id, buf: x.buf });
              t.objectStore(FOTOS).put({ id: x.id, nome: x.nome, tipo: x.tipo, pastas: x.pastas, descricao: x.descricao, meta: {}, criada: x.em || Date.now(),
                situacao: 'fila', etapa: 'drive', tent: 0, prox: 0, tamanho: x.buf ? x.buf.byteLength : 0, temArquivo: true });
            });
            db.deleteObjectStore(VELHA);
          };
        }
      };
      r.onsuccess = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
    });
  }
  // uma transação; `fn(stores)` pode devolver um request cujo resultado vira o valor da promessa
  function tx(names, mode, fn) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(names, mode), st = {};
        names.forEach(function (n) { st[n] = t.objectStore(n); });
        var req = fn(st);
        t.oncomplete = function () { db.close(); resolve(req && 'result' in req ? req.result : undefined); };
        t.onerror = t.onabort = function () { db.close(); reject(t.error); };
      });
    });
  }
  function b64(buf) {
    var u8 = new Uint8Array(buf), s = '', step = 0x8000;
    for (var i = 0; i < u8.length; i += step) s += String.fromCharCode.apply(null, u8.subarray(i, i + step));
    return btoa(s);
  }
  // miniatura leve (~360 px) para as galerias
  function miniatura(blob) {
    var load = window.createImageBitmap ? createImageBitmap(blob) : new Promise(function (resolve, reject) {
      var u = URL.createObjectURL(blob), img = new Image();
      img.onload = function () { URL.revokeObjectURL(u); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(u); reject(new Error('imagem')); };
      img.src = u;
    });
    return load.then(function (img) {
      var w = img.width, h = img.height, k = Math.min(1, 360 / Math.max(w, h));
      var cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      if (img.close) img.close();
      return new Promise(function (r) { cv.toBlob(r, 'image/jpeg', 0.62); });
    }).then(function (b) { return b ? new Response(b).arrayBuffer() : null; }, function () { return null; });
  }

  window.DriveFotos = function (opts) {
    var n = 0, soAparelho = 0, total = 0, bytes = 0, busy = false, erro = null, enviadas = 0, timer = null;
    // a fila fica parada até `espera` (sem sinal ou acesso recusado); `recusas`: do acesso, seguidas; `proxFila`: a foto que volta primeiro
    var espera = 0, recusas = 0, proxFila = 0;
    // `geracao` muda a cada entrada nova (resetCode com outro acesso; `marcaFila` diz de qual acesso é a recusa guardada);
    // `emEnvio`: a foto que está subindo agora; `voltou`: hora em que o sinal voltou (solta as fotos paradas por falta dele)
    var geracao = 0, marcaFila = null, emEnvio = null, voltou = 0;
    var PAUSA_MAX = 15 * 60000, CHAVE = 'diagrama-linear-fotos-acesso-' + (opts.ambiente || 'oficial');
    function acesso(e) { return e === 'codigo' || e === 'recusado' || e === 'script'; }
    function semRede(e) { return e === 'rede' || e === 'tempo'; }
    // marca curta do acesso (não guarda o código): para saber se a recusa guardada é do acesso de agora
    function marca(l) {
      var c = String((l && l.codigo) || ''), h = 5381;
      for (var i = 0; i < c.length; i++) h = ((h << 5) + h + c.charCodeAt(i)) | 0;
      return c ? 'm' + h : null;
    }
    // a recusa do acesso fica guardada no aparelho: ao abrir o app de novo, a fila confere o acesso antes de mandar a foto inteira
    function guardar() {
      try {
        if (recusas || erro === 'codigo') localStorage.setItem(CHAVE, JSON.stringify({ m: marcaFila, r: recusas, e: espera, x: acesso(erro) ? erro : null }));
        else localStorage.removeItem(CHAVE);
      } catch (e) { /* sem armazenamento: vale só nesta sessão */ }
    }
    try {
      var gu = JSON.parse(localStorage.getItem(CHAVE) || 'null');
      // a parada pelo acesso não volta parada: só confere de novo antes do primeiro envio
      if (gu && gu.m) { marcaFila = gu.m; recusas = Math.max(1, gu.r || 0); espera = gu.x === 'codigo' ? 0 : gu.e || 0; erro = gu.x === 'codigo' ? null : gu.x || null; }
    } catch (e) { /* segue sem */ }
    // a pausa da fila; uma hora mais longe que a maior pausa possível vem do relógio do celular que voltou: vale como vencida
    function parada(agora) { if (espera - agora > PAUSA_MAX) espera = 0; return espera > agora; }
    function devida(r, agora) {
      var p = r.prox || 0;
      if (p <= agora || p - agora > (semRede(r.erro) ? PAUSA_MAX : 2 * PAUSA_MAX)) return true;
      // o sinal voltou depois que ela falhou por falta dele: tenta já
      return semRede(r.erro) && (r.falhou || 0) < voltou;
    }
    function change() { if (opts.onChange) opts.onChange(); }
    function recount() {
      return tx([FOTOS], 'readonly', function (s) { return s[FOTOS].getAll(); }).then(function (all) {
        all = all || [];
        total = all.length;
        n = all.filter(function (r) { return r.situacao === 'fila'; }).length;
        soAparelho = all.filter(function (r) { return r.situacao === 'aparelho'; }).length;
        bytes = all.reduce(function (a, r) { return a + (r.temArquivo ? r.tamanho || 0 : 0); }, 0);
        change();
      }, function () { n = 0; });
    }
    function later(ms) { clearTimeout(timer); timer = setTimeout(function () { pump(); }, ms); }
    // a pasta antiga do contrato (o Lote) que o script renomeia: só texto não vazio; sem ela, o registro fica sem o campo
    function comAntiga(r, v) { if (typeof v === 'string' && v) r.pastaAntiga = v; else delete r.pastaAntiga; return r; }
    // espera crescente: 1, 2, 4, 8… até 15 min
    function pausa(t) { return Math.min(15 * 60000, 60000 * Math.pow(2, Math.max(0, t - 1))); }

    function add(items) {
      var login = opts.getLogin ? opts.getLogin() : null;
      return Promise.all(items.map(function (it) {
        return Promise.all([new Response(it.blob).arrayBuffer(), miniatura(it.blob)]).then(function (r) {
          return {
            arq: { id: it.id, buf: r[0] },
            foto: comAntiga({ id: it.id, nome: it.nome, tipo: it.blob.type || 'image/jpeg', pastas: it.pastas, descricao: it.descricao || '', meta: it.meta || {},
              mini: r[1], criada: Date.now(), autor: login ? { uid: login.uid || null, nome: login.nome || null } : null,
              situacao: it.enviar === false ? 'aparelho' : 'fila', etapa: 'drive', tent: 0, prox: 0, tamanho: r[0].byteLength, temArquivo: true }, it.pastaAntiga)
          };
        });
      })).then(function (rows) {
        // a mesma foto (mesmo id) de novo: fica a versão nova (versao + 1, para o envio em curso saber), e sobe de novo
        return tx([FOTOS, ARQ], 'readwrite', function (s) {
          rows.forEach(function (r) {
            s[ARQ].put(r.arq);
            var g = s[FOTOS].get(r.foto.id);
            g.onsuccess = function () { r.foto.versao = ((g.result && g.result.versao) || 0) + 1; s[FOTOS].put(r.foto); };
          });
        });
      }).then(function () {
        // foto nova tenta já, mesmo depois de faltar sinal; o acesso recusado continua esperando a conferência
        if (semRede(erro)) espera = 0;
        if (!acesso(erro)) erro = null;
        return recount();
      }).then(function () { pump(); });
    }

    function list() {
      return tx([FOTOS], 'readonly', function (s) { return s[FOTOS].getAll(); }).then(function (all) {
        return (all || []).map(function (r) {
          return { id: r.id, nome: r.nome, meta: r.meta || {}, descricao: r.descricao, situacao: r.situacao, etapa: r.etapa, erro: r.erro || null,
            enviada: r.enviada || null, criada: r.criada, tamanho: r.tamanho, temArquivo: !!r.temArquivo, drive: r.drive || null, autor: r.autor || null,
            mini: r.mini ? new Blob([r.mini], { type: 'image/jpeg' }) : null };
        }).sort(function (a, b) { return (b.criada || 0) - (a.criada || 0); });
      });
    }
    function arquivo(id) {
      return tx([ARQ], 'readonly', function (s) { return s[ARQ].get(id); }).then(function (x) { return x && x.buf ? new Blob([x.buf], { type: 'image/jpeg' }) : null; });
    }
    // manda para o Drive as que ficaram só no aparelho (sim) ou segura as da fila que ainda não subiram (não)
    function enviar(ids, sim) {
      var m = 0;
      return tx([FOTOS], 'readwrite', function (s) {
        ids.forEach(function (id) {
          var g = s[FOTOS].get(id);
          g.onsuccess = function () {
            var r = g.result;
            if (!r) return;
            if (sim && r.situacao === 'aparelho') {
              r.situacao = 'fila'; r.tent = 0; r.prox = 0; r.erro = null;
              // o arquivo que já tinha chegado ao Drive não sobe de novo: falta só o registro no banco
              if (!(r.etapa === 'registro' && r.drive && r.drive.id)) r.etapa = 'drive';
            }
            // a que está subindo agora não fica para trás: o arquivo já vai a caminho do Drive
            else if (!sim && r.situacao === 'fila' && r.etapa !== 'registro' && !(busy && id === emEnvio)) { r.situacao = 'aparelho'; r.erro = null; }
            else return;
            r.versao = (r.versao || 0) + 1;
            m++;
            s[FOTOS].put(r);
          };
        });
      }).then(recount).then(function () { if (sim) pump(); return m; });
    }
    // contrato e ponto corrigidos na galeria: muda os dados guardados; a que ainda não subiu vai para a pasta nova do Drive (a
    // pasta antiga troca junto: a do contrato anterior não pode ficar, senão o script renomearia a pasta errada).
    // A que espera só o registro no banco sobe com os dados novos; a já enviada (lida aqui, na mesma gravação: pode ter
    // acabado de subir com a galeria aberta) volta em `enviadas`, para o app corrigir também no banco.
    function corrigir(ids, meta, pastas, pastaAntiga) {
      var m = 0, env = [];
      return tx([FOTOS], 'readwrite', function (s) {
        ids.forEach(function (id) {
          var g = s[FOTOS].get(id);
          g.onsuccess = function () {
            var r = g.result;
            if (!r) return;
            r.meta = Object.assign({}, r.meta || {}, { cid: meta.cid || null, pid: meta.pid || null, pnome: meta.pnome || null, lote: meta.lote || null });
            if (pastas && r.etapa !== 'registro' && r.situacao !== 'enviada') { r.pastas = pastas; comAntiga(r, pastaAntiga); }
            if (r.situacao === 'enviada') env.push(r.id);
            r.versao = (r.versao || 0) + 1;
            m++;
            s[FOTOS].put(r);
          };
        });
      }).then(recount).then(function () { return { quantas: m, enviadas: env }; });
    }
    // some do aparelho (a foto enviada continua no Drive e nas galerias do banco)
    function apagar(ids) {
      return tx([FOTOS, ARQ], 'readwrite', function (s) { ids.forEach(function (id) { s[FOTOS].delete(id); s[ARQ].delete(id); }); }).then(recount);
    }

    // a próxima foto que pode subir agora: primeiro as que nunca falharam (prox 0) e as que esperam há mais tempo, depois a
    // mais antiga (a foto grande que estoura o tempo no sinal fraco não segura as outras); `forcar`: sem esperar a pausa de cada foto
    function next(forcar) {
      return tx([FOTOS], 'readonly', function (s) { return s[FOTOS].getAll(); }).then(function (all) {
        var now = Date.now(), pend = (all || []).filter(function (r) { return r.situacao === 'fila'; });
        var ok = pend.filter(function (r) { return forcar || devida(r, now); })
          .sort(function (a, b) { return Math.min(a.prox || 0, now) - Math.min(b.prox || 0, now) || (a.criada || 0) - (b.criada || 0); });
        proxFila = !ok.length && pend.length ? Math.min.apply(null, pend.map(function (r) { return r.prox || 0; })) : 0;
        if (proxFila) later(Math.max(5000, proxFila - now));
        return ok[0] || null;
      });
    }
    // grava o fim de uma etapa do envio sobre o registro como está agora (lido de novo na mesma transação): a foto apagada
    // no meio do envio não volta. fn(atual, igual): igual = ninguém mudou a foto desde que o envio a leu (mesma versao)
    function concluir(r, fn) {
      return tx([FOTOS], 'readwrite', function (s) {
        var out = {}, g = s[FOTOS].get(r.id);
        g.onsuccess = function () {
          var a = g.result;
          if (!a) return;
          fn(a, (a.versao || 0) === (r.versao || 0));
          s[FOTOS].put(a);
          out.result = a;
        };
        return out;
      });
    }
    function post(url, body, ms) {
      var o = { method: 'POST', body: JSON.stringify(body), cache: 'no-store' }, t = null, estourou = false;
      if (window.AbortController) { var ctl = new AbortController(); o.signal = ctl.signal; t = setTimeout(function () { estourou = true; ctl.abort(); }, ms || 120000); }
      // corpo em texto simples: o Google aceita sem pedir permissão prévia (CORS)
      return fetch(url, o).then(function (res) { return res.text(); }).then(function (txt) {
        clearTimeout(t);
        try { return JSON.parse(txt); } catch (e) { return { ok: false, erro: 'resposta_invalida' }; }
      }, function (e) {
        clearTimeout(t);
        // tempo esgotado: pode ser o sinal fraco ou o Drive demorando (a trava do script); não é o mesmo que faltar sinal
        if (estourou) { var x = new Error('tempo esgotado'); x.code = 'tempo'; throw x; }
        throw e;
      });
    }
    function paraDrive(url, login, r) {
      return arquivo(r.id).then(function (blob) {
        if (!blob) return { ok: false, erro: 'sem_arquivo' };
        return new Response(blob).arrayBuffer().then(function (buf) {
          // tempo limite pelo tamanho: 60 s + 60 s por MB, até 10 min (a foto pequena não espera à toa; a grande no sinal fraco tem tempo)
          var ms = Math.min(10 * 60000, 60000 + 60000 * buf.byteLength / 1048576);
          var corpo = { acao: 'enviar', ambiente: opts.ambiente || 'oficial', codigo: login.codigo, autor: login.nome, id: r.id, nome: r.nome,
            pastas: r.pastas, descricao: r.descricao, mime: r.tipo, dados: b64(buf) };
          // só quando existe (foto tirada pelo app novo): o script de antes ignora o campo; a foto antiga da fila vai sem ele
          if (typeof r.pastaAntiga === 'string' && r.pastaAntiga) corpo.pastaAntiga = r.pastaAntiga;
          return post(url, corpo, ms);
        });
      });
    }
    function paraBanco(login, r) {
      if (!opts.registrar) return Promise.resolve({ ok: true });
      var m = r.meta || {}, mini = r.mini ? b64(r.mini) : null;
      var foto = { id: r.id, contrato_id: m.cid || null, ponto_id: m.pid || null, ponto_nome: m.pnome || null, lote: m.lote || null,
        km: m.km != null ? m.km : null, lat: m.lat != null ? m.lat : null, lng: m.lng != null ? m.lng : null, tirada_em: m.em || new Date(r.criada || Date.now()).toISOString(),
        descricao: m.desc || r.descricao || null, nome_arquivo: r.nome, tamanho: r.tamanho || null,
        drive_id: r.drive && r.drive.id || null, drive_url: r.drive && r.drive.url || null, autor_nome: login.nome || null };
      return opts.registrar(login.codigo, foto, mini).then(function () { return { ok: true }; }, function (e) {
        if (e && e.code === 'sem_rede') throw e;
        return { ok: false, erro: (e && e.code) || 'banco' };
      });
    }
    // o app confere o acesso no banco (opts.conferir): 'ok', 'invalido' (o banco confirmou que não vale mais) ou 'sem_resposta'
    function checar(login) {
      if (!opts.conferir) return Promise.resolve('sem_resposta');
      return Promise.resolve().then(function () { return opts.conferir(login.codigo); })
        .then(function (vale) { return vale ? 'ok' : 'invalido'; }, function () { return 'sem_resposta'; });
    }
    // o resultado é de um acesso anterior (a pessoa entrou de novo, ou saiu, no meio do envio ou da conferência)
    function outro(g, login) { var l = opts.getLogin ? opts.getLogin() : null; return g !== geracao || !l || l.codigo !== login.codigo; }
    // a recusa era do acesso anterior: não para nem espera, tenta já com o de agora
    function deNovo() { busy = false; change(); pump(); }
    // o acesso valeu (o script ou o banco aceitou): a fila esquece as recusas
    function valeu() {
      espera = 0;
      if (recusas || acesso(erro)) { recusas = 0; if (acesso(erro)) erro = null; guardar(); }
    }
    // o banco confirmou que o acesso não vale mais: a fila para até a pessoa entrar de novo (resetCode)
    function parar() { erro = 'codigo'; busy = false; guardar(); change(); }
    // acesso recusado pelo script: a fila inteira espera, cada vez mais, sem mandar a foto de novo. motivo: 'recusado' (o banco
    // não respondeu: não dá para dizer que o código mudou) ou 'script' (o banco confirmou que o acesso vale; o script recusou assim mesmo)
    function segurar(motivo) {
      recusas++;
      espera = Date.now() + pausa(recusas);
      erro = motivo;
      busy = false;
      guardar();
      change();
      later(espera - Date.now());
    }
    // banco: a recusa veio do registro no banco (o arquivo já está no Drive), não do Google
    function falhou(r, res, login, g, banco) {
      if (res && res.erro === 'codigo_invalido') {
        if (outro(g, login)) return deNovo();
        return checar(login).then(function (ac) {
          if (outro(g, login)) return deNovo();
          if (ac === 'invalido') parar(); else segurar(ac === 'ok' ? 'script' : 'recusado');
        });
      }
      // recusou esta foto: tenta de novo mais tarde, sem travar as outras
      var e = (res && res.erro) || 'erro';
      erro = banco ? 'banco' : e;
      return concluir(r, function (a, igual) {
        if (!igual) return;   // mudou no meio: os dados novos tentam sem esperar
        a.erro = e;
        a.tent = (a.tent || 0) + 1;
        a.prox = Date.now() + Math.min(30 * 60000, 30000 * Math.pow(2, a.tent));
      }).then(function () { busy = false; change(); later(5000); });
    }
    // sem sinal ou demorou demais (tempo): esta foto espera 1, 2, 4, 8… até 15 min (guardado com ela) e a fila espera junto
    function semSinal(r, tempo) {
      var e = tempo ? 'tempo' : 'rede';
      erro = e;
      return concluir(r, function (a, igual) {
        if (!igual) return;
        a.erro = e;
        a.tent = (a.tent || 0) + 1;
        a.falhou = Date.now();
        a.prox = Date.now() + pausa(a.tent);
      }).then(function (a) {
        espera = a && a.prox > Date.now() ? a.prox : Date.now() + 60000;
        busy = false;
        change();
        later(espera - Date.now());
      });
    }
    function seguir(forcar) { busy = false; return recount().then(function () { pump(forcar); }); }
    // as duas etapas de uma foto; cada uma termina gravando sobre o registro lido de novo (concluir). g: a geração do acesso
    function enviarFoto(url, login, r, forcar, g) {
      var etapa1 = r.etapa === 'registro' ? Promise.resolve({ ok: true, ja: true }) : paraDrive(url, login, r);
      return etapa1.then(function (res) {
        if (!res || !res.ok) return falhou(r, res, login, g);
        if (res.ja) return registrar(login, r, forcar, g);
        valeu();
        return concluir(r, function (a, igual) {
          a.drive = { id: res.id || null, url: res.url || null };
          // corrigida no meio (mesmo arquivo): o arquivo fica onde subiu, como na correção depois de enviada, e o banco leva
          // os dados novos. Salva de novo no meio (arquivo novo, `criada` nova): continua na etapa do Drive e sobe de novo
          if (igual || (a.criada === r.criada && a.tamanho === r.tamanho)) a.etapa = 'registro';
        }).then(function (a) {
          if (!a || a.situacao !== 'fila' || a.etapa !== 'registro') return seguir(forcar);   // apagada (não volta), segurada ou para subir de novo
          return registrar(login, a, forcar, g);
        });
      }).then(null, function (e) { return semSinal(r, !!(e && e.code === 'tempo')); });
    }
    function registrar(login, a, forcar, g) {
      return paraBanco(login, a).then(function (res2) {
        if (!res2.ok) return falhou(a, res2, login, g, true);
        valeu();
        return concluir(a, function (b, igual) {
          // corrigida enquanto ia ao banco: continua na fila, para registrar os dados novos
          if (igual) { b.situacao = 'enviada'; b.erro = null; b.enviada = Date.now(); }
        }).then(function (b) {
          var foi = !!(b && b.situacao === 'enviada');
          if (foi) { enviadas++; erro = null; }
          busy = false;
          // fora da cadeia do envio: um erro aqui não conta como falta de sinal desta foto
          recount().then(function () { if (foi && opts.onSent) opts.onSent(b); pump(forcar); });
        });
      });
    }
    function pump(forcar) {
      forcar = forcar === true;
      var url = opts.getUrl(), login = opts.getLogin(), g = geracao;
      if (busy) return;
      if (!url || !login || navigator.onLine === false) { change(); return; }
      if (!forcar && erro === 'codigo') { change(); return; }   // acesso que não vale mais: espera entrar de novo
      if (!forcar && parada(Date.now())) { later(espera - Date.now()); change(); return; }
      busy = true;
      emEnvio = null;
      change();
      // depois de uma recusa do acesso, o app confere no banco antes de mandar a foto inteira de novo
      (recusas || erro === 'codigo' ? checar(login) : Promise.resolve('ok')).then(function (ac) {
        if (outro(g, login)) return deNovo();   // entrou de novo durante a conferência: confere o acesso novo
        if (ac === 'invalido') return parar();
        if (ac === 'sem_resposta' && !forcar) return segurar('recusado');
        if (ac === 'ok' && erro === 'codigo') erro = null;
        return next(forcar).then(function (r) {
          if (!r) { busy = false; change(); return; }
          emEnvio = r.id;
          return enviarFoto(url, login, r, forcar, g);
        });
      }).then(null, function () { busy = false; change(); });
    }
    // entrou de novo (outro acesso): a fila volta na hora, e o que estava em curso com o acesso anterior não vale mais.
    // O mesmo acesso de novo (ao abrir o app, papel trocado): a recusa guardada continua; a parada pelo acesso confere já
    function resetCode() {
      var mk = marca(opts.getLogin ? opts.getLogin() : null);
      if (mk && mk === marcaFila) {
        if (erro === 'codigo') { erro = null; espera = 0; recusas = Math.max(1, recusas); guardar(); }
        return;
      }
      marcaFila = mk;
      geracao++;
      if (acesso(erro)) { erro = null; espera = 0; }
      recusas = 0;
      guardar();
    }

    // pede ao navegador para não apagar as fotos guardadas quando faltar espaço
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () { /* segue sem */ });
    recount().then(function () { pump(); });
    window.addEventListener('online', function () {
      // o sinal voltou: as fotos paradas por falta dele tentam já (no máximo a cada 90 s: o sinal que vai e volta não vira laço);
      // as paradas pelo acesso continuam esperando a conferência
      if (Math.abs(Date.now() - voltou) > 90000) { voltou = Date.now(); if (semRede(erro)) espera = 0; }
      pump();
    });
    setInterval(function () { pump(); }, 60000);
    return {
      add: add, list: list, arquivo: arquivo, apagar: apagar, enviar: enviar, corrigir: corrigir, pump: pump, resetCode: resetCode, post: post,
      info: function () {
        // próxima tentativa: o fim da pausa da fila ou a foto que volta primeiro (parada pelo acesso: só ao entrar de novo)
        var agora = Date.now(), prox = erro === 'codigo' ? null : parada(agora) ? espera : proxFila > agora && proxFila - agora <= 2 * PAUSA_MAX ? proxFila : null;
        return { n: n, aparelho: soAparelho, busy: busy, erro: erro, enviadas: enviadas, total: total, bytes: bytes, prox: prox, emEnvio: busy ? emEnvio : null };
      }
    };
  };
})();
