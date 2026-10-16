/*
 * Fotos do aparelho e envio ao Google Drive da equipe.
 * Cada foto com carimbo fica guardada no aparelho (IndexedDB "diagrama-linear-fotos": loja "fotos" com os dados e a
 * miniatura, loja "arquivos" com a foto inteira) e sobe em duas etapas, uma foto de cada vez:
 *   1) o arquivo vai para o script do Google (drive-fotos/Codigo.gs), que guarda em "Fotos por pessoa / <nome> / Lote / Ponto";
 *   2) os dados e a miniatura vão para o banco (foto_registrar), que alimenta as galerias do app.
 * Sem sinal, as fotos esperam (mesmo com o app fechado). Depois de enviada, a foto continua no aparelho até a pessoa
 * apagar "só do celular". A foto marcada para não ir ao Drive fica só no aparelho (situação 'aparelho') até a pessoa
 * mandar enviar pela galeria.
 *
 *   var d = DriveFotos({ getUrl, getLogin, ambiente, registrar(cred, foto, miniB64), onChange, onSent });
 *   d.add([{ id, nome, blob, pastas: ['Lote 02', 'P7'], descricao, meta, enviar }])  -> Promise   (enviar: false = só no aparelho)
 *   d.list() -> Promise<[{ id, nome, meta, situacao: 'fila'|'aparelho'|'enviada', erro, enviada, tamanho, mini: Blob|null }]>
 *   d.enviar(ids, sim) -> Promise<quantas>   sim: as 'aparelho' vão para a fila; não: as da fila que ainda não subiram ficam só no aparelho
 *   d.arquivo(id) -> Promise<Blob|null>      d.apagar(ids) (some do aparelho)
 *   d.info() -> { n, aparelho, busy, erro, enviadas, total, bytes }   d.pump()
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
    function later(ms) { clearTimeout(timer); timer = setTimeout(pump, ms); }

    function add(items) {
      var login = opts.getLogin ? opts.getLogin() : null;
      return Promise.all(items.map(function (it) {
        return Promise.all([new Response(it.blob).arrayBuffer(), miniatura(it.blob)]).then(function (r) {
          return {
            arq: { id: it.id, buf: r[0] },
            foto: { id: it.id, nome: it.nome, tipo: it.blob.type || 'image/jpeg', pastas: it.pastas, descricao: it.descricao || '', meta: it.meta || {},
              mini: r[1], criada: Date.now(), autor: login ? { uid: login.uid || null, nome: login.nome || null } : null,
              situacao: it.enviar === false ? 'aparelho' : 'fila', etapa: 'drive', tent: 0, prox: 0, tamanho: r[0].byteLength, temArquivo: true }
          };
        });
      })).then(function (rows) {
        // a mesma foto (mesmo id) de novo: fica a versão nova, e sobe de novo
        return tx([FOTOS, ARQ], 'readwrite', function (s) { rows.forEach(function (r) { s[ARQ].put(r.arq); s[FOTOS].put(r.foto); }); });
      }).then(function () { erro = erro === 'codigo' ? erro : null; return recount(); }).then(function () { pump(); });
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
            if (sim && r.situacao === 'aparelho') { r.situacao = 'fila'; r.etapa = 'drive'; r.tent = 0; r.prox = 0; r.erro = null; }
            else if (!sim && r.situacao === 'fila' && r.etapa !== 'registro') { r.situacao = 'aparelho'; r.erro = null; }
            else return;
            m++;
            s[FOTOS].put(r);
          };
        });
      }).then(recount).then(function () { if (sim) pump(); return m; });
    }
    // some do aparelho (a foto enviada continua no Drive e nas galerias do banco)
    function apagar(ids) {
      return tx([FOTOS, ARQ], 'readwrite', function (s) { ids.forEach(function (id) { s[FOTOS].delete(id); s[ARQ].delete(id); }); }).then(recount);
    }

    // a próxima foto que pode subir agora (a mais antiga)
    function next() {
      return tx([FOTOS], 'readonly', function (s) { return s[FOTOS].getAll(); }).then(function (all) {
        var now = Date.now(), pend = (all || []).filter(function (r) { return r.situacao === 'fila'; });
        var ok = pend.filter(function (r) { return (r.prox || 0) <= now; }).sort(function (a, b) { return (a.criada || 0) - (b.criada || 0); });
        if (!ok.length && pend.length) later(Math.max(5000, Math.min.apply(null, pend.map(function (r) { return r.prox || 0; })) - now));
        return ok[0] || null;
      });
    }
    function salvar(r) { return tx([FOTOS], 'readwrite', function (s) { s[FOTOS].put(r); }); }
    function post(url, body) {
      var o = { method: 'POST', body: JSON.stringify(body), cache: 'no-store' }, t = null;
      if (window.AbortController) { var ctl = new AbortController(); o.signal = ctl.signal; t = setTimeout(function () { ctl.abort(); }, 120000); }
      // corpo em texto simples: o Google aceita sem pedir permissão prévia (CORS)
      return fetch(url, o).then(function (res) { return res.text(); }).then(function (txt) {
        clearTimeout(t);
        try { return JSON.parse(txt); } catch (e) { return { ok: false, erro: 'resposta_invalida' }; }
      }, function (e) { clearTimeout(t); throw e; });
    }
    function paraDrive(url, login, r) {
      return arquivo(r.id).then(function (blob) {
        if (!blob) return { ok: false, erro: 'sem_arquivo' };
        return new Response(blob).arrayBuffer().then(function (buf) {
          return post(url, { acao: 'enviar', ambiente: opts.ambiente || 'oficial', codigo: login.codigo, autor: login.nome, id: r.id, nome: r.nome,
            pastas: r.pastas, descricao: r.descricao, mime: r.tipo, dados: b64(buf) });
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
    function falhou(r, res) {
      if (res && res.erro === 'codigo_invalido') { busy = false; erro = 'codigo'; change(); return; }   // espera entrar de novo
      // recusou esta foto: tenta de novo mais tarde, sem travar as outras
      busy = false;
      erro = (res && res.erro) || 'erro';
      r.erro = erro;
      r.tent = (r.tent || 0) + 1;
      r.prox = Date.now() + Math.min(30 * 60000, 30000 * Math.pow(2, r.tent));
      return salvar(r).then(function () { change(); later(5000); });
    }
    function pump() {
      var url = opts.getUrl(), login = opts.getLogin();
      if (busy) return;
      if (!url || !login || navigator.onLine === false) { change(); return; }
      busy = true;
      change();
      next().then(function (r) {
        if (!r) { busy = false; change(); return; }
        var etapa1 = r.etapa === 'registro' ? Promise.resolve({ ok: true, ja: true }) : paraDrive(url, login, r);
        return etapa1.then(function (res) {
          if (!res || !res.ok) return falhou(r, res);
          if (!res.ja) { r.drive = { id: res.id || null, url: res.url || null }; r.etapa = 'registro'; }
          return salvar(r).then(function () { return paraBanco(login, r); }).then(function (res2) {
            if (!res2.ok) return falhou(r, res2);
            busy = false;
            erro = null;
            enviadas++;
            r.situacao = 'enviada'; r.erro = null; r.enviada = Date.now();
            return salvar(r).then(recount).then(function () { if (opts.onSent) opts.onSent(r); pump(); });
          });
        }, function () {
          busy = false;   // sem sinal ou demorou demais: tenta de novo daqui a pouco
          erro = 'rede';
          change();
          later(30000);
        });
      }, function () { busy = false; change(); });
    }
    function resetCode() { if (erro === 'codigo') erro = null; }

    // pede ao navegador para não apagar as fotos guardadas quando faltar espaço
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () { /* segue sem */ });
    recount().then(pump);
    window.addEventListener('online', function () { pump(); });
    setInterval(pump, 60000);
    return {
      add: add, list: list, arquivo: arquivo, apagar: apagar, enviar: enviar, pump: pump, resetCode: resetCode, post: post,
      info: function () { return { n: n, aparelho: soAparelho, busy: busy, erro: erro, enviadas: enviadas, total: total, bytes: bytes }; }
    };
  };
})();
