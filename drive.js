/*
 * Fotos para o Google Drive da equipe: as fotos com carimbo entram numa fila no aparelho (IndexedDB) e sobem,
 * uma de cada vez, para o script do Google (drive-fotos/Codigo.gs), que guarda em "Fotos BR-230 / Lote 02 / P7".
 * Sem sinal, as fotos esperam na fila (mesmo com o app fechado) e sobem quando houver internet.
 *
 *   var d = DriveFotos({ getUrl, getLogin, onChange });
 *   d.add([{ id, nome, blob, pastas: ['Lote 02', 'P7'], descricao }])  -> Promise
 *   d.info() -> { n, busy, erro, enviadas }   d.pump()
 */
(function () {
  'use strict';

  var DB = 'diagrama-linear-fotos', STORE = 'fila';

  function openDb() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('sem_indexeddb')); return; }
      var r = indexedDB.open(DB, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(STORE, { keyPath: 'id' }); };
      r.onsuccess = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
    });
  }
  // uma transação; `fn(store)` pode devolver um request cujo resultado vira o valor da promessa
  function tx(mode, fn) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(STORE, mode), req = fn(t.objectStore(STORE));
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

  window.DriveFotos = function (opts) {
    var n = 0, busy = false, erro = null, enviadas = 0, timer = null;
    function change() { if (opts.onChange) opts.onChange(); }
    function recount() {
      return tx('readonly', function (s) { return s.count(); }).then(function (c) { n = c || 0; change(); }, function () { n = 0; });
    }
    function later(ms) { clearTimeout(timer); timer = setTimeout(pump, ms); }

    function add(items) {
      return Promise.all(items.map(function (it) {
        return new Response(it.blob).arrayBuffer().then(function (buf) {
          return { id: it.id, nome: it.nome, pastas: it.pastas, descricao: it.descricao || '', tipo: it.blob.type || 'image/jpeg', buf: buf, em: Date.now(), tent: 0, prox: 0 };
        });
      })).then(function (rows) {
        // a mesma foto (mesmo id) ainda na fila: fica a versão nova
        return tx('readwrite', function (s) { rows.forEach(function (r) { s.put(r); }); });
      }).then(function () { erro = erro === 'codigo' ? erro : null; return recount(); }).then(function () { pump(); });
    }

    // a próxima foto que pode ir agora (a mais antiga)
    function next() {
      return tx('readonly', function (s) { return s.getAll(); }).then(function (all) {
        var now = Date.now(), ok = (all || []).filter(function (r) { return (r.prox || 0) <= now; }).sort(function (a, b) { return a.em - b.em; });
        if (!ok.length && all && all.length) {   // todas esperando nova tentativa: acorda na hora da primeira
          later(Math.max(5000, Math.min.apply(null, all.map(function (r) { return r.prox || 0; })) - now));
        }
        return ok[0] || null;
      });
    }
    function post(url, login, r) {
      var body = JSON.stringify({ codigo: login.codigo, autor: login.nome, id: r.id, nome: r.nome, pastas: r.pastas, descricao: r.descricao, mime: r.tipo, dados: b64(r.buf) });
      var o = { method: 'POST', body: body, cache: 'no-store' }, t = null;
      if (window.AbortController) { var ctl = new AbortController(); o.signal = ctl.signal; t = setTimeout(function () { ctl.abort(); }, 120000); }
      // corpo em texto simples: o Google aceita sem pedir permissão prévia (CORS)
      return fetch(url, o).then(function (res) { return res.text(); }).then(function (txt) {
        clearTimeout(t);
        try { return JSON.parse(txt); } catch (e) { return { ok: false, erro: 'resposta_invalida' }; }
      }, function (e) { clearTimeout(t); throw e; });
    }
    function pump() {
      var url = opts.getUrl(), login = opts.getLogin();
      if (busy) return;
      if (!url || !login || navigator.onLine === false) { change(); return; }
      busy = true;
      change();
      next().then(function (r) {
        if (!r) { busy = false; change(); return; }
        return post(url, login, r).then(function (res) {
          busy = false;
          if (res && res.ok) {
            erro = null;
            enviadas++;
            return tx('readwrite', function (s) { s.delete(r.id); }).then(recount).then(function () { if (opts.onSent) opts.onSent(res); pump(); });
          }
          if (res && res.erro === 'codigo_invalido') { erro = 'codigo'; change(); return; }   // espera entrar de novo
          // o Google recusou esta foto: tenta de novo mais tarde, sem travar as outras
          erro = (res && res.erro) || 'erro';
          r.tent = (r.tent || 0) + 1;
          r.prox = Date.now() + Math.min(30 * 60000, 30000 * Math.pow(2, r.tent));
          return tx('readwrite', function (s) { s.put(r); }).then(function () { change(); later(5000); });
        }, function () {
          busy = false;   // sem sinal ou demorou demais: tenta de novo daqui a pouco
          erro = 'rede';
          change();
          later(30000);
        });
      }, function () { busy = false; change(); });
    }
    function resetCode() { if (erro === 'codigo') erro = null; }

    recount().then(pump);
    window.addEventListener('online', function () { pump(); });
    setInterval(pump, 60000);
    return {
      add: add, pump: pump, resetCode: resetCode,
      info: function () { return { n: n, busy: busy, erro: erro, enviadas: enviadas }; }
    };
  };
})();
