/*
 * Galeria de fotos do app: as guardadas neste aparelho (drive.js) e as da equipe (banco: dados e miniatura; foto inteira no Drive).
 *   Neste aparelho  tudo o que está guardado aqui, com a situação do envio (na fila, enviada)
 *   Minhas          as que eu enviei, de qualquer aparelho
 *   Todas           as de toda a equipe, por pessoa (engenheiro e criador)
 *   Relatório       as marcadas com ★ para o relatório fotográfico, que sai em PDF (relatorio.js) (engenheiro e Administrador)
 *   Deletados       as apagadas do Drive por engenheiros (só o criador; dá para restaurar)
 * A galeria mostra só a miniatura leve; a foto inteira vem do aparelho (se estiver aqui) ou do Drive ao abrir ou baixar.
 *
 *   var g = Galeria({ drive, Banco, getLogin, nivel, driveUrl, ambiente, contratos, toast, confirmar, saveBlob, entrar });
 *   g.open({ cid, pid })   abre (opcional: já filtrada num ponto)      g.changed()   a fila do aparelho mudou
 */
(function () {
  'use strict';

  var CSS = [
    '.gl{position:fixed;inset:0;z-index:3000;display:flex;flex-direction:column;background:var(--ground,#F1F3F1);color:var(--ink,#17201C);font-size:14px;',
    '  padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)}',
    '.gl-top{display:flex;align-items:center;gap:10px;padding:10px 16px;background:var(--panel,#fff);border-bottom:1px solid var(--line,#D5DAD6)}',
    '.gl-top h2{margin:0;font-size:17px;font-weight:650;flex:1;min-width:0}',
    '.gl-tabs{display:flex;gap:6px;padding:10px 16px 0;overflow-x:auto;scrollbar-width:none}',
    '.gl-tabs::-webkit-scrollbar{display:none}',
    '.gl-tab{flex:none;border:1px solid var(--line,#D5DAD6);background:var(--panel,#fff);border-radius:999px;padding:6px 14px;font-size:13px;white-space:nowrap}',
    '.gl-tab small{margin-left:6px;color:var(--ink-3,#5C6661);font-variant-numeric:tabular-nums}',
    '.gl-tab[aria-selected="true"]{background:var(--ink,#17201C);border-color:var(--ink,#17201C);color:#fff}',
    '.gl-tab[aria-selected="true"] small{color:#C9D0CC}',
    '.gl-fil{display:flex;flex-wrap:wrap;gap:8px;padding:10px 16px 0}',
    '.gl-fil select{min-height:32px;max-width:100%;padding:4px 8px;border:1px solid var(--line,#D5DAD6);border-radius:6px;background:var(--panel,#fff);font-size:13px}',
    '.gl-info{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 16px;font-size:12.5px;color:var(--ink-2,#3B4540)}',
    '.gl-info .gl-txt{flex:1 1 220px;min-width:0}',
    '.gl-info .gl-txt b{color:var(--ink,#17201C);font-weight:600}',
    '.gl-warn{color:#B54708}',
    '.gl-body{flex:1;overflow:auto;padding:0 16px calc(84px + env(safe-area-inset-bottom,0px));-webkit-overflow-scrolling:touch}',
    '.gl-g{display:flex;align-items:baseline;gap:8px;margin:14px 0 8px;font-size:13px;font-weight:650}',
    '.gl-g small{font-weight:400;color:var(--ink-3,#5C6661);font-variant-numeric:tabular-nums}',
    '.gl-g button{margin-left:auto;border:0;background:none;color:var(--accent,#1D4F91);font-size:12.5px;padding:2px 4px}',
    '.gl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(108px,1fr));gap:6px}',
    '.gl-t{position:relative;display:block;padding:0;border:0;border-radius:6px;overflow:hidden;background:var(--line-2,#E6E9E6);aspect-ratio:1/1;max-width:100%}',
    '.gl-t img{display:block;width:100%;height:100%;object-fit:cover}',
    '.gl-t .gl-cap{position:absolute;left:0;right:0;bottom:0;padding:14px 6px 4px;background:linear-gradient(transparent,rgba(0,0,0,.62));color:#fff;font-size:11px;line-height:1.25;text-align:left;',
    '  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.gl-b{position:absolute;top:5px;left:5px;padding:2px 6px;border-radius:999px;font-size:10.5px;font-weight:650;background:rgba(255,255,255,.92);color:var(--ink,#17201C)}',
    '.gl-b.fila{background:#FEF0C7;color:#7A2E0E}',
    '.gl-b.erro{background:#FEE4E2;color:#912018}',
    '.gl-b.ok{background:#D1FADF;color:#05603A}',
    '.gl-b.ap{background:#E4E7EC;color:#344054}',
    '.gl-star{position:absolute;top:4px;right:6px;color:#FDB022;font-size:17px;text-shadow:0 1px 2px rgba(0,0,0,.5)}',
    '.gl-ck{position:absolute;top:5px;right:5px;width:22px;height:22px;border-radius:50%;border:2px solid #fff;background:rgba(0,0,0,.25);box-shadow:0 1px 3px rgba(0,0,0,.4)}',
    '.gl-t[aria-pressed="true"]{outline:3px solid var(--accent,#1D4F91);outline-offset:-3px}',
    '.gl-t[aria-pressed="true"] .gl-ck{background:var(--accent,#1D4F91)}',
    '.gl-t[aria-pressed="true"] .gl-ck::after{content:"";position:absolute;left:6px;top:2px;width:5px;height:10px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg)}',
    '.gl-vazio{padding:40px 8px;text-align:center;color:var(--ink-3,#5C6661)}',
    '.gl-vazio .btn{margin-top:12px}',
    '.gl-bar{position:absolute;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));display:flex;flex-wrap:wrap;align-items:center;gap:8px;max-width:760px;margin:0 auto;',
    '  padding:10px 12px;background:var(--panel,#fff);border:1px solid var(--line,#D5DAD6);border-radius:10px;box-shadow:0 6px 24px rgba(23,32,28,.16)}',
    '.gl-bar .gl-n{flex:1 1 120px;font-size:13px;font-weight:600;font-variant-numeric:tabular-nums}',
    '.gl-prog{flex:1 1 200px;font-size:13px;font-variant-numeric:tabular-nums}',
    '.gl-ver{position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;background:#0E1311;color:#fff}',
    '.gl-ver-top{display:flex;align-items:center;gap:8px;padding:10px 12px}',
    '.gl-ver-top .gl-c{flex:1;text-align:center;font-size:13px;color:#C9D0CC;font-variant-numeric:tabular-nums}',
    '.gl-ver .btn{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.2);color:#fff}',
    '.gl-ver .btn:hover{background:rgba(255,255,255,.16)}',
    '.gl-ver .btn.danger{color:#FDA29B;border-color:rgba(253,162,155,.4)}',
    '.gl-ver .btn.primary{background:var(--accent,#1D4F91);border-color:var(--accent,#1D4F91)}',
    '.gl-ver-img{position:relative;flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:0 8px}',
    '.gl-ver-img img{max-width:100%;max-height:100%;object-fit:contain}',
    '.gl-ver-img .gl-leve{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);display:flex;gap:8px;align-items:center;padding:6px 10px;border-radius:999px;background:rgba(0,0,0,.6);font-size:12px;white-space:nowrap}',
    '.gl-ver-info{padding:10px 16px 4px;font-size:13px;line-height:1.5;color:#E4E8E5;max-height:30vh;overflow:auto}',
    '.gl-ver-info b{color:#fff}',
    '.gl-ver-info .gl-desc{white-space:pre-wrap;color:#C9D0CC}',
    '.gl-ver-acts{display:flex;flex-wrap:wrap;gap:8px;padding:8px 16px calc(12px + env(safe-area-inset-bottom,0px))}',
    '.gl-nav{min-width:40px;justify-content:center}',
    '@media (max-width:560px){.gl-top{padding:8px 12px}.gl-tabs,.gl-fil,.gl-info{padding-left:12px;padding-right:12px}.gl-body{padding-left:12px;padding-right:12px}',
    '  .gl-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}}'
  ].join('\n');

  var MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var POR_ZIP = 40;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function data(iso) { var d = iso ? new Date(iso) : null; return d && isFinite(d.getTime()) ? d : null; }
  function dia(iso) { var d = data(iso); return d ? pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() : ''; }
  function hora(iso) { var d = data(iso); return d ? dia(iso) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) : ''; }
  function mesKey(iso) { var d = data(iso); return d ? d.getFullYear() + '-' + pad(d.getMonth() + 1) : ''; }
  function mesNome(k) { var p = k.split('-'); return MESES[+p[1] - 1] + '/' + p[0]; }
  function kmTxt(km) { return km == null || km === '' ? '' : 'km ' + Number(km).toFixed(3).replace('.', ','); }
  function tam(b) { return !b ? '' : b >= 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' kB'; }
  function plural(n, um, varios) { return n + ' ' + (n === 1 ? um : varios); }
  function b64Blob(s, type) {
    var bin = atob(s), u8 = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new Blob([u8], { type: type || 'image/jpeg' });
  }

  // .zip sem compressão (o JPEG já é comprimido); nomes em UTF-8
  var CRC_T = null;
  function crc32(u8) {
    if (!CRC_T) {
      CRC_T = new Uint32Array(256);
      for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC_T[n] = c >>> 0; }
    }
    var r = 0xFFFFFFFF;
    for (var i = 0; i < u8.length; i++) r = CRC_T[(r ^ u8[i]) & 0xFF] ^ (r >>> 8);
    return (r ^ 0xFFFFFFFF) >>> 0;
  }
  function zip(files) {
    var parts = [], central = [], offset = 0, enc = new TextEncoder();
    return files.reduce(function (p, f) {
      return p.then(function () { return new Response(f.blob).arrayBuffer(); }).then(function (buf) {
        var name = enc.encode(f.name), size = buf.byteLength, crc = crc32(new Uint8Array(buf));
        var d = f.date || new Date();
        var time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
        var day = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
        var lh = new DataView(new ArrayBuffer(30));
        lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
        lh.setUint16(10, time, true); lh.setUint16(12, day, true); lh.setUint32(14, crc, true);
        lh.setUint32(18, size, true); lh.setUint32(22, size, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
        parts.push(lh.buffer, name, buf);
        var ch = new DataView(new ArrayBuffer(46));
        ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
        ch.setUint16(12, time, true); ch.setUint16(14, day, true); ch.setUint32(16, crc, true);
        ch.setUint32(20, size, true); ch.setUint32(24, size, true); ch.setUint16(28, name.length, true);
        ch.setUint32(42, offset, true);
        central.push(ch.buffer, name);
        offset += 30 + name.length + size;
      });
    }, Promise.resolve()).then(function () {
      var cdSize = central.reduce(function (s, x) { return s + x.byteLength; }, 0), end = new DataView(new ArrayBuffer(22));
      end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
      end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
      return new Blob(parts.concat(central, [end.buffer]), { type: 'application/zip' });
    });
  }

  var ABAS = [
    { k: 'local', t: 'Neste aparelho', nivel: 0 },
    { k: 'minhas', t: 'Minhas', nivel: 1 },
    { k: 'todas', t: 'Todas', nivel: 2 },
    { k: 'relatorio', t: 'Relatório', nivel: 2 },
    { k: 'deletadas', t: 'Deletados', nivel: 3 }
  ];
  // agrupar: por mês ou por pessoa (escolha só para engenheiro e Administrador; o fiscal só vê as fotos dele, por mês)
  var AGRUPAR = { mes: 'Por mês', pessoa: 'Por pessoa' };
  var MESES_NOME = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  function mesLongo(k) { var p = k.split('-'); return MESES_NOME[+p[1] - 1] + ' de ' + p[0]; }
  function agruparPadrao(aba) { return aba === 'todas' ? 'pessoa' : 'mes'; }

  window.Galeria = function (o) {
    var root = null, aba = 'local', filtro = { cid: '', pid: '', autor: '', mes: '' }, agrupar = '';
    var itens = [], locais = {}, lista = [], sel = {}, selecionando = false, carregando = false, erroTxt = '', geracao = 0;
    var minis = {}, pedindo = {}, fila = {}, filaT = null, obs = null, urlsLocais = [];
    var ver = -1, grande = null, ocupado = null, cancelar = false;

    function login() { return o.getLogin ? o.getLogin() : null; }
    function nv() { return o.nivel ? o.nivel() : 0; }
    function modo() { return nv() >= 2 ? agrupar || agruparPadrao(aba) : 'mes'; }
    function abasVisiveis() { return ABAS.filter(function (a) { return a.nivel === 0 || (login() && nv() >= a.nivel); }); }
    function q(s) { return root.querySelector(s); }
    function msgErro(e) {
      var c = (e && (e.code || e.erro || e.message)) || '';
      if (c === 'sem_rede') return 'Sem conexão. As fotos guardadas neste aparelho continuam em "Neste aparelho".';
      if (c === 'codigo_invalido') return 'Seu acesso expirou ou mudou. Entre de novo.';
      if (c === 'sem_permissao' || c === 'so_criador') return 'Seu acesso não permite ver estas fotos.';
      if (c === 'sem_login') return 'Entre com o seu código para ver as fotos enviadas.';
      if (/fotos_listar|PGRST202|http_404/.test(c)) return 'O banco ainda não tem a galeria da equipe.';
      return 'Não foi possível carregar as fotos (' + c + ').';
    }

    // ---------------------------------------------------------------- dados
    function deLocal(r) {
      var m = r.meta || {}, u = r.mini ? URL.createObjectURL(r.mini) : null;
      if (u) urlsLocais.push(u);
      return { id: r.id, nome: r.nome, origem: 'local', cid: m.cid || '', pid: m.pid || '', pnome: m.pnome || '', lote: m.lote || '', km: m.km, lat: m.lat, lng: m.lng,
        em: m.em || (r.criada ? new Date(r.criada).toISOString() : null), desc: m.desc || '', autor: r.autor && r.autor.nome || '',
        situacao: r.situacao, etapa: r.etapa, erro: r.erro, enviada: r.enviada, driveId: r.drive && r.drive.id || null, tamanho: r.tamanho, temArquivo: r.temArquivo, mini: u };
    }
    function deBanco(f) {
      return { id: f.id, nome: f.nome_arquivo || 'foto.jpg', origem: 'banco', cid: f.contrato_id || '', pid: f.ponto_id || '', pnome: f.ponto_nome || '', lote: f.lote || '',
        km: f.km, lat: f.lat, lng: f.lng, em: f.tirada_em || f.enviada_em, desc: f.descricao || '', autor: f.autor_nome || '', situacao: f.situacao,
        relatorio: !!f.relatorio, relPor: f.relatorio_por || '', delPor: f.deletada_por || '', delEm: f.deletada_em || null, enviadaEm: f.enviada_em,
        driveId: f.drive_id || null, driveUrl: f.drive_url || null, tamanho: f.tamanho };
    }
    function soltarUrls() { urlsLocais.forEach(function (u) { URL.revokeObjectURL(u); }); urlsLocais = []; }
    function carregar() {
      var g = ++geracao;
      carregando = true; erroTxt = '';
      render();
      var pLocal = o.drive ? o.drive.list().catch(function () { return []; }) : Promise.resolve([]);
      pLocal.then(function (loc) {
        if (g !== geracao) return null;
        soltarUrls();
        locais = {};
        loc.forEach(function (r) { locais[r.id] = deLocal(r); });
        if (aba === 'local') return loc.map(function (r) { return locais[r.id]; });
        var l = login();
        if (!l) { var e = new Error('sem_login'); e.code = 'sem_login'; throw e; }
        return o.Banco.fotosListar(l.codigo, aba, 1000).then(function (arr) { return arr.map(deBanco); });
      }).then(function (arr) {
        if (g !== geracao || !arr) return;
        arr.sort(function (a, b) { return String(b.em || '').localeCompare(String(a.em || '')); });
        itens = arr; carregando = false;
        render();
      }, function (e) {
        if (g !== geracao) return;
        itens = []; carregando = false; erroTxt = msgErro(e);
        render();
      });
    }
    function miniDe(it) { var l = locais[it.id]; return (l && l.mini) || it.mini || minis[it.id] || null; }

    // miniaturas do banco: só as que aparecem na tela, em lotes de 40
    function pedirMini(id) {
      if (minis[id] || pedindo[id] || (locais[id] && locais[id].mini)) return;
      fila[id] = 1;
      clearTimeout(filaT);
      filaT = setTimeout(buscarMinis, 60);
    }
    function buscarMinis() {
      var l = login(), ids = Object.keys(fila);
      fila = {};
      if (!l || !ids.length) return;
      for (var i = 0; i < ids.length; i += 40) (function (lote) {
        lote.forEach(function (id) { pedindo[id] = 1; });
        o.Banco.fotosMini(l.codigo, lote).then(function (arr) {
          arr.forEach(function (m) { minis[m.id] = 'data:image/jpeg;base64,' + m.jpeg; mostrarMini(m.id); });
          lote.forEach(function (id) { delete pedindo[id]; });
        }, function () { lote.forEach(function (id) { delete pedindo[id]; }); });
      })(ids.slice(i, i + 40));
    }
    function mostrarMini(id) {
      if (!root) return;
      var t = root.querySelector('.gl-t[data-id="' + cssId(id) + '"] img');
      if (t) t.src = minis[id];
      if (ver >= 0 && lista[ver] && lista[ver].id === id && !grande) { var im = q('.gl-ver-img img'); if (im) im.src = minis[id]; }
    }
    function cssId(id) { return String(id).replace(/["\\]/g, '\\$&'); }
    function observar() {
      if (obs) obs.disconnect();
      var ts = root.querySelectorAll('.gl-t[data-falta]');
      if (!('IntersectionObserver' in window)) { ts.forEach(function (t) { pedirMini(t.getAttribute('data-id')); }); return; }
      obs = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { pedirMini(e.target.getAttribute('data-id')); obs.unobserve(e.target); } });
      }, { root: q('.gl-body'), rootMargin: '400px 0px' });
      ts.forEach(function (t) { obs.observe(t); });
    }

    // foto inteira: do aparelho, ou do Drive pelo script (confere quem pode ver)
    function arquivo(it) {
      var l = locais[it.id];
      var aqui = l && l.temArquivo && o.drive ? o.drive.arquivo(it.id) : Promise.resolve(null);
      return aqui.then(function (b) {
        if (b) return b;
        var url = o.driveUrl ? o.driveUrl() : null, lg = login();
        if (!it.driveId) throw { code: 'sem_drive' };
        if (!url) throw { code: 'sem_url' };
        if (!lg) throw { code: 'sem_login' };
        return o.drive.post(url, { acao: 'baixar', ambiente: o.ambiente || 'oficial', codigo: lg.codigo, driveId: it.driveId }).then(function (r) {
          if (!r || !r.ok) throw { code: (r && r.erro) || 'erro' };
          return b64Blob(r.dados, r.mime);
        }, function () { throw { code: 'sem_rede' }; });
      });
    }
    function erroArquivo(e) {
      var c = e && e.code;
      return c === 'sem_drive' ? 'Esta foto ainda não chegou ao Drive.' : c === 'sem_rede' ? 'Sem conexão com o Drive.' : c === 'sem_login' ? 'Entre com o seu código.'
        : c === 'sem_url' ? 'O envio ao Drive não está configurado.' : c === 'codigo_invalido' ? 'Seu acesso expirou. Entre de novo.'
        : c === 'sem_permissao' ? 'Seu acesso não permite esta foto.' : 'Não foi possível pegar a foto (' + (c || 'erro') + ').';
    }

    // ---------------------------------------------------------------- filtros
    function contratos() { return (o.contratos ? o.contratos() : []) || []; }
    function nomeContrato(cid, it) {
      var c = contratos().find(function (x) { return x.id === cid; });
      return c ? [c.lote, c.numero ? 'CT ' + c.numero : ''].filter(Boolean).join(' · ') || 'Contrato' : (it && it.lote) || 'Sem contrato';
    }
    function filtrar() {
      lista = itens.filter(function (it) {
        return (!filtro.cid || it.cid === filtro.cid) && (!filtro.pid || it.pid === filtro.pid) &&
          (!filtro.autor || (it.autor || 'Sem nome') === filtro.autor) && (!filtro.mes || mesKey(it.em) === filtro.mes);
      });
    }
    function opcoes(sel0, vazio, pares) {
      return '<option value="">' + esc(vazio) + '</option>' + pares.map(function (p) {
        return '<option value="' + esc(p[0]) + '"' + (p[0] === sel0 ? ' selected' : '') + '>' + esc(p[1]) + '</option>';
      }).join('');
    }
    function filtrosHtml() {
      var cs = {}, ps = {}, as = {}, ms = {};
      itens.forEach(function (it) {
        if (it.cid) cs[it.cid] = nomeContrato(it.cid, it);
        if (it.pid && (!filtro.cid || it.cid === filtro.cid)) ps[it.pid] = it.pnome || 'Ponto';
        as[it.autor || 'Sem nome'] = 1;
        var k = mesKey(it.em); if (k) ms[k] = 1;
      });
      // aberta num ponto sem fotos: o filtro continua visível
      if (filtro.cid && !cs[filtro.cid]) cs[filtro.cid] = nomeContrato(filtro.cid);
      if (filtro.pid && !ps[filtro.pid]) {
        var c0 = contratos().find(function (x) { return x.id === filtro.cid; }), p0 = c0 && (c0.pontos || []).find(function (x) { return x.id === filtro.pid; });
        ps[filtro.pid] = (p0 && p0.nome) || 'Ponto';
      }
      var ordem = function (m) { return Object.keys(m).map(function (k) { return [k, m[k] === 1 ? k : m[k]]; }).sort(function (a, b) { return a[1].localeCompare(b[1], 'pt-BR', { numeric: true }); }); };
      var h = '';
      if (Object.keys(cs).length > 1 || filtro.cid) h += '<select data-f="cid" aria-label="Contrato">' + opcoes(filtro.cid, 'Todos os contratos', ordem(cs)) + '</select>';
      if (Object.keys(ps).length || filtro.pid) h += '<select data-f="pid" aria-label="Ponto">' + opcoes(filtro.pid, 'Todos os pontos', ordem(ps)) + '</select>';
      if (aba !== 'local' && aba !== 'minhas' && (Object.keys(as).length > 1 || filtro.autor)) h += '<select data-f="autor" aria-label="Pessoa">' + opcoes(filtro.autor, 'Todas as pessoas', ordem(as)) + '</select>';
      var mm = Object.keys(ms).sort().reverse().map(function (k) { return [k, mesNome(k)]; });
      if (mm.length > 1 || filtro.mes) h += '<select data-f="mes" aria-label="Mês">' + opcoes(filtro.mes, 'Todos os meses', mm) + '</select>';
      if (itens.length && nv() >= 2) {
        var g = modo();
        h += '<select data-f="agrupar" aria-label="Agrupar">' + Object.keys(AGRUPAR).map(function (k) {
          return '<option value="' + k + '"' + (k === g ? ' selected' : '') + '>' + AGRUPAR[k] + '</option>';
        }).join('') + '</select>';
      }
      return h;
    }
    function grupos() {
      var g = modo(), mapa = {}, ordem = [];
      lista.forEach(function (it, i) {
        var k = g === 'pessoa' ? it.autor || 'Sem nome' : (mesKey(it.em) ? mesLongo(mesKey(it.em)) : 'Sem data');
        if (!mapa[k]) { mapa[k] = []; ordem.push(k); }
        mapa[k].push(i);
      });
      if (g !== 'mes') ordem.sort(function (a, b) { return a.localeCompare(b, 'pt-BR', { numeric: true }); });
      return ordem.map(function (k) { return { nome: k, idx: mapa[k] }; });
    }

    // ---------------------------------------------------------------- tela
    function badge(it) {
      if (it.origem === 'local') {
        if (it.situacao === 'enviada') return '<span class="gl-b ok">Enviada</span>';
        if (it.situacao === 'aparelho') return '<span class="gl-b ap">Só no aparelho</span>';
        if (it.erro && it.erro !== 'rede') return '<span class="gl-b erro">Tentando de novo</span>';
        return '<span class="gl-b fila">Na fila</span>';
      }
      if (aba === 'deletadas') return '<span class="gl-b erro">Apagada</span>';
      return locais[it.id] ? '<span class="gl-b">No aparelho</span>' : '';
    }
    function tile(it, i) {
      var m = miniDe(it), cap = [it.pnome, kmTxt(it.km)].filter(Boolean).join(' · ') || hora(it.em);
      if ((aba === 'todas' || aba === 'relatorio' || aba === 'deletadas') && modo() !== 'pessoa') cap = (it.autor ? it.autor.split(' ')[0] + ' · ' : '') + cap;
      // por mês o grupo não diz o dia: vai na legenda da foto
      if (modo() === 'mes' && it.em && cap.indexOf(dia(it.em)) < 0) cap = dia(it.em).slice(0, 5) + ' · ' + cap;
      return '<button type="button" class="gl-t" data-i="' + i + '" data-id="' + esc(it.id) + '"' + (m ? '' : ' data-falta') +
        (selecionando ? ' aria-pressed="' + !!sel[it.id] + '"' : '') + ' aria-label="' + esc(cap + ', ' + hora(it.em)) + '">' +
        (m ? '<img alt="" src="' + esc(m) + '">' : '<img alt="">') + badge(it) +
        (it.relatorio && !selecionando ? '<span class="gl-star" title="No relatório">★</span>' : '') +
        (selecionando ? '<span class="gl-ck"></span>' : '') + '<span class="gl-cap">' + esc(cap) + '</span></button>';
    }
    function infoHtml() {
      if (aba === 'local') {
        var all = Object.keys(locais).map(function (k) { return locais[k]; });
        if (!all.length) return '';
        var pend = all.filter(function (x) { return x.situacao === 'fila'; }).length, soAp = all.filter(function (x) { return x.situacao === 'aparelho'; }).length;
        var env = all.filter(function (x) { return x.situacao === 'enviada'; }).length, bytes = all.reduce(function (a, x) { return a + (x.temArquivo ? x.tamanho || 0 : 0); }, 0);
        var inf = o.drive ? o.drive.info() : {};
        var t = '<b>' + plural(all.length, 'foto guardada', 'fotos guardadas') + '</b> neste aparelho' + (bytes ? ' · ' + tam(bytes) : '');
        if (pend) {
          t += ' · <span class="gl-warn">' + plural(pend, 'esperando envio', 'esperando envio') + '</span>';
          if (!login()) t += ' (só vão para o Drive depois que você entrar com o seu código)';
          else if (inf.busy) t += ' (enviando…)';
          else if (inf.erro === 'rede' || navigator.onLine === false) t += ' (sem sinal; envia sozinho depois)';
          else if (!(o.driveUrl && o.driveUrl())) t += ' (envio ao Drive não configurado)';
        } else if (!soAp) t += ' · todas já foram enviadas';
        if (soAp) t += ' · ' + plural(soAp, 'só no aparelho (não vai para o Drive)', 'só no aparelho (não vão para o Drive)');
        var b = '';
        if (soAp) b += '<button type="button" class="btn small primary" data-g="enviar-ap">Enviar ' + (soAp === 1 ? 'esta' : 'as ' + soAp) + ' ao Drive</button>';
        if (pend && login() && !inf.busy) b += '<button type="button" class="btn small" data-g="enviar">Enviar agora</button>';
        if (pend && !login() && o.entrar) b += '<button type="button" class="btn small primary" data-g="entrar">Entrar para enviar</button>';
        if (env) b += '<button type="button" class="btn small" data-g="limpar">Liberar espaço (' + env + ')</button>';
        return '<span class="gl-txt">' + t + '</span>' + b + selBtn();
      }
      var txt = {
        minhas: 'Fotos que você enviou, de qualquer aparelho.',
        todas: 'Fotos de toda a equipe. Marque com ★ as que vão para o relatório fotográfico.',
        relatorio: 'Fotos escolhidas para o relatório fotográfico.',
        deletadas: 'Apagadas do Drive por engenheiros. Ficam na pasta Deletados até você restaurar.'
      }[aba];
      return '<span class="gl-txt"><b>' + plural(lista.length, 'foto', 'fotos') + '</b>' + (lista.length !== itens.length ? ' de ' + itens.length : '') + ' · ' + txt + '</span>' +
        (aba === 'relatorio' && o.relatorioPdf && itens.length && !selecionando ? '<button type="button" class="btn small primary" data-g="rel-pdf">Gerar o relatório em PDF</button>' : '') + selBtn();
    }
    function selBtn() {
      if (!lista.length) return '';
      return selecionando ? '<button type="button" class="btn small" data-g="todas">Selecionar todas (' + lista.length + ')</button>'
        : '<button type="button" class="btn small" data-g="selecionar">Selecionar</button>' +
          '<button type="button" class="btn small" data-g="baixar-tudo">Baixar ' + (lista.length === 1 ? 'a foto' : 'as ' + lista.length) + '</button>';
    }
    function corpoHtml() {
      if (carregando && !itens.length) return '<div class="gl-vazio">Carregando…</div>';
      if (erroTxt) return '<div class="gl-vazio">' + esc(erroTxt) + (login() ? '' : '<br><button type="button" class="btn small primary" data-g="entrar">Entrar</button>') + '</div>';
      if (!itens.length) {
        return '<div class="gl-vazio">' + ({
          local: 'Nenhuma foto guardada neste aparelho. As fotos com carimbo (botão Foto) ficam aqui até você apagar.',
          minhas: 'Você ainda não enviou fotos.', todas: 'Nenhuma foto enviada pela equipe ainda.',
          relatorio: 'Nenhuma foto marcada para o relatório. Marque com ★ em "Todas".', deletadas: 'Nenhuma foto apagada do Drive.'
        }[aba]) + '</div>';
      }
      if (!lista.length) return '<div class="gl-vazio">Nenhuma foto com esses filtros.</div>';
      return grupos().map(function (g) {
        return '<h3 class="gl-g">' + esc(g.nome) + ' <small>' + plural(g.idx.length, 'foto', 'fotos') + '</small>' +
          (selecionando ? '<button type="button" data-g="sel-grupo" data-idx="' + g.idx.join(',') + '">Selecionar o grupo</button>' : '') + '</h3>' +
          '<div class="gl-grid">' + g.idx.map(function (i) { return tile(lista[i], i); }).join('') + '</div>';
      }).join('');
    }
    function selecionadas() { return lista.filter(function (it) { return sel[it.id]; }); }
    // ações possíveis para um conjunto de fotos, conforme a aba e o acesso
    function acoes(ls) {
      var n = nv(), a = [];
      if (!ls.length) return a;
      a.push({ k: 'baixar', t: ls.length === 1 ? 'Baixar' : 'Baixar (' + ls.length + ')', c: 'primary' });
      if (n >= 2 && aba !== 'local' && aba !== 'deletadas') {
        var todas = ls.every(function (x) { return x.relatorio; });
        a.push({ k: todas ? 'tirar-rel' : 'por-rel', t: todas ? '☆ Tirar do relatório' : '★ Relatório' });
      }
      var ap = ls.filter(function (x) { return locais[x.id] && locais[x.id].situacao === 'aparelho'; }).length;
      var fi = ls.filter(function (x) { return locais[x.id] && locais[x.id].situacao === 'fila' && locais[x.id].etapa !== 'registro'; }).length;
      if (ap) a.push({ k: 'enviar-drive', t: 'Enviar ao Drive' + (ls.length > 1 ? ' (' + ap + ')' : ''), c: 'primary' });
      if (fi) a.push({ k: 'segurar', t: 'Não enviar' + (ls.length > 1 ? ' (' + fi + ')' : '') });
      if (ls.some(function (x) { return locais[x.id]; })) a.push({ k: 'apagar-local', t: 'Apagar do celular', c: 'danger' });
      if (n >= 2 && aba !== 'deletadas' && ls.some(function (x) { return x.driveId && (x.origem === 'banco' || x.situacao === 'enviada'); })) a.push({ k: 'apagar-drive', t: 'Apagar do Drive', c: 'danger' });
      if (n >= 3 && aba === 'deletadas') a.push({ k: 'restaurar', t: 'Restaurar', c: 'primary' });
      return a;
    }
    function barHtml() {
      if (ocupado) return '<div class="gl-bar"><span class="gl-prog">' + esc(ocupado) + '</span><button type="button" class="btn small" data-g="cancelar">Parar</button></div>';
      if (!selecionando) return '';
      var ls = selecionadas();
      return '<div class="gl-bar"><span class="gl-n">' + (ls.length ? plural(ls.length, 'selecionada', 'selecionadas') : 'Toque nas fotos') + '</span>' +
        acoes(ls).map(function (a) { return '<button type="button" class="btn small ' + (a.c || '') + '" data-g="' + a.k + '">' + esc(a.t) + '</button>'; }).join('') +
        '<button type="button" class="btn small" data-g="sair-sel">Cancelar</button></div>';
    }
    function render() {
      if (!root) return;
      filtrar();
      var abas = abasVisiveis(), corpo = q('.gl-body'), top = corpo ? corpo.scrollTop : 0;
      q('.gl-tabs').innerHTML = abas.length > 1 ? abas.map(function (a) {
        return '<button type="button" class="gl-tab" role="tab" data-aba="' + a.k + '" aria-selected="' + (a.k === aba) + '">' + esc(a.t) +
          (a.k === aba && itens.length ? '<small>' + itens.length + '</small>' : '') + '</button>';
      }).join('') : '';
      q('.gl-fil').innerHTML = filtrosHtml();
      q('.gl-info').innerHTML = carregando && !itens.length ? '' : infoHtml();
      corpo.innerHTML = corpoHtml();
      corpo.scrollTop = top;
      q('.gl-barhost').innerHTML = barHtml();
      observar();
      if (ver >= 0) renderVer();
    }
    function renderBar() { if (root) q('.gl-barhost').innerHTML = barHtml(); }

    // ---------------------------------------------------------------- foto aberta
    function soltarGrande() { if (grande) { URL.revokeObjectURL(grande.url); grande = null; } }
    function abrir(i) { soltarGrande(); ver = i; renderVer(); var it = lista[i]; if (it && locais[it.id] && locais[it.id].temArquivo) carregarGrande(); }
    function fecharVer() { soltarGrande(); ver = -1; var v = q('.gl-ver'); if (v) v.remove(); }
    function carregarGrande() {
      var it = lista[ver];
      if (!it) return;
      var lv = q('.gl-leve');
      if (lv) lv.innerHTML = 'Carregando a foto inteira…';
      arquivo(it).then(function (b) {
        if (lista[ver] !== it) return;
        soltarGrande();
        grande = { id: it.id, blob: b, url: URL.createObjectURL(b) };
        var im = q('.gl-ver-img img'); if (im) im.src = grande.url;
        var l2 = q('.gl-leve'); if (l2) l2.remove();
      }, function (e) {
        var l3 = q('.gl-leve');
        if (l3) l3.innerHTML = esc(erroArquivo(e)) + ' <button type="button" class="btn small" data-g="grande">Tentar de novo</button>';
      });
    }
    function renderVer() {
      var it = lista[ver];
      if (!it) { fecharVer(); return; }
      var v = q('.gl-ver');
      if (!v) { v = document.createElement('div'); v.className = 'gl-ver'; v.setAttribute('role', 'dialog'); v.setAttribute('aria-label', 'Foto'); root.appendChild(v); }
      var src = grande && grande.id === it.id ? grande.url : miniDe(it);
      if (!src) pedirMini(it.id);
      var linhas = [];
      linhas.push('<b>' + esc([it.cid ? nomeContrato(it.cid, it) : it.lote, it.pnome ? 'Ponto ' + it.pnome : 'Sem ponto'].filter(Boolean).join(' · ')) + '</b>');
      linhas.push(esc([kmTxt(it.km), it.lat != null ? Number(it.lat).toFixed(5) + ', ' + Number(it.lng).toFixed(5) : '', hora(it.em)].filter(Boolean).join(' · ')));
      if (it.autor) linhas.push('Tirada por ' + esc(it.autor));
      if (it.origem === 'local') {
        linhas.push(it.situacao === 'enviada' ? 'Enviada ao Drive' + (it.enviada ? ' em ' + esc(hora(new Date(it.enviada).toISOString())) : '') + ' · também guardada neste aparelho'
          : it.situacao === 'aparelho' ? 'Guardada só neste aparelho · não vai para o Drive (toque em Enviar ao Drive se quiser)'
          : 'Guardada neste aparelho · <span class="gl-warn">ainda não enviada</span>');
      } else {
        if (it.relatorio) linhas.push('★ No relatório fotográfico' + (it.relPor ? ' (marcada por ' + esc(it.relPor) + ')' : ''));
        if (it.situacao === 'deletada') linhas.push('Apagada do Drive' + (it.delPor ? ' por ' + esc(it.delPor) : '') + (it.delEm ? ' em ' + esc(hora(it.delEm)) : ''));
        if (locais[it.id]) linhas.push('Também guardada neste aparelho');
      }
      if (it.tamanho) linhas.push(esc(it.nome) + ' · ' + tam(it.tamanho));
      if (it.desc) linhas.push('<span class="gl-desc">' + esc(it.desc) + '</span>');
      var temGrande = grande && grande.id === it.id;
      var leve = !temGrande && !(locais[it.id] && locais[it.id].temArquivo) && it.driveId
        ? '<div class="gl-leve">Prévia leve <button type="button" class="btn small" data-g="grande">Ver a foto inteira' + (it.tamanho ? ' (' + tam(it.tamanho) + ')' : '') + '</button></div>' : '';
      var acts = acoes([it]).map(function (a) { return '<button type="button" class="btn small ' + (a.c || '') + '" data-g="' + a.k + '" data-um="1">' + esc(a.t) + '</button>'; }).join('');
      if (nv() >= 3 && it.driveUrl) acts += '<a class="btn small" href="' + esc(it.driveUrl) + '" target="_blank" rel="noopener">Abrir no Drive</a>';
      v.innerHTML = '<div class="gl-ver-top"><button type="button" class="btn small" data-g="fechar-ver">← Voltar</button>' +
        '<span class="gl-c">' + (ver + 1) + ' de ' + lista.length + '</span>' +
        '<button type="button" class="btn small gl-nav" data-g="ant" aria-label="Anterior"' + (ver ? '' : ' disabled') + '>‹</button>' +
        '<button type="button" class="btn small gl-nav" data-g="prox" aria-label="Próxima"' + (ver < lista.length - 1 ? '' : ' disabled') + '>›</button></div>' +
        '<div class="gl-ver-img">' + (src ? '<img alt="" src="' + esc(src) + '">' : '<img alt="">') + leve + '</div>' +
        '<div class="gl-ver-info">' + linhas.join('<br>') + '</div><div class="gl-ver-acts">' + acts + '</div>';
    }

    // ---------------------------------------------------------------- ações
    function nomesUnicos(ls) {
      var usados = {};
      return ls.map(function (it) {
        var n = String(it.nome || 'foto.jpg').replace(/[\\/:*?"<>|]+/g, '-'), base = n.replace(/\.jpe?g$/i, ''), k = 2;
        while (usados[n.toLowerCase()]) n = base + ' (' + (k++) + ').jpg';
        usados[n.toLowerCase()] = 1;
        return n;
      });
    }
    function baixar(ls) {
      if (!ls.length || ocupado) return;
      if (ls.length === 1) {
        var it = ls[0];
        if (o.toast) o.toast('Baixando a foto…');
        var p = grande && grande.id === it.id ? Promise.resolve(grande.blob) : arquivo(it);
        p.then(function (b) { return o.saveBlob(nomesUnicos([it])[0], b); }, function (e) { o.toast(erroArquivo(e), 5000); });
        return;
      }
      var partes = Math.ceil(ls.length / POR_ZIP), total = ls.reduce(function (a, x) { return a + (x.tamanho || 0); }, 0);
      o.confirmar({ titulo: 'Baixar ' + ls.length + ' fotos', botao: 'Baixar',
        html: '<p>As fotos inteiras vêm ' + (ls.every(function (x) { return locais[x.id] && locais[x.id].temArquivo; }) ? 'deste aparelho' : 'do Drive da equipe') +
          (total ? ' (cerca de ' + tam(total) + ')' : '') + ' e são salvas em ' + (partes === 1 ? 'um arquivo .zip' : partes + ' arquivos .zip de até ' + POR_ZIP + ' fotos') + '.</p>' +
          (total > 50 * 1048576 ? '<p>É bastante coisa: prefira uma rede Wi-Fi.</p>' : '') }).then(function (ok) {
        if (!ok) return;
        cancelar = false;
        var nomes = nomesUnicos(ls), falhas = 0, parte = 0;
        var rotulo = ({ local: 'Fotos deste aparelho', minhas: 'Minhas fotos', todas: 'Fotos da equipe', relatorio: 'Relatório fotográfico', deletadas: 'Fotos apagadas' }[aba]) +
          ' ' + new Date().toISOString().slice(0, 10);
        function lote(ini) {
          if (cancelar || ini >= ls.length) return Promise.resolve();
          parte++;
          var files = [], fim = Math.min(ls.length, ini + POR_ZIP);
          var cadeia = Promise.resolve();
          for (var i = ini; i < fim; i++) (function (i) {
            cadeia = cadeia.then(function () {
              if (cancelar) return;
              ocupado = 'Baixando ' + (i + 1) + ' de ' + ls.length + '…'; renderBar();
              return arquivo(ls[i]).then(function (b) { files.push({ name: nomes[i], blob: b, date: data(ls[i].em) || new Date() }); }, function () { falhas++; });
            });
          })(i);
          return cadeia.then(function () {
            if (cancelar || !files.length) return;
            ocupado = 'Montando o .zip…'; renderBar();
            return zip(files).then(function (z) { return o.saveBlob(rotulo + (partes > 1 ? ' - parte ' + parte : '') + '.zip', z); });
          }).then(function () { return lote(fim); });
        }
        lote(0).then(function () {
          ocupado = null; renderBar();
          if (cancelar) o.toast('Download parado.');
          else if (falhas) o.toast(plural(falhas, 'foto não pôde ser baixada', 'fotos não puderam ser baixadas') + ' (sem conexão ou ainda não chegaram ao Drive).', 6000);
        }, function () { ocupado = null; renderBar(); o.toast('Não foi possível montar o arquivo. Tente com menos fotos.', 6000); });
      });
    }
    function relatorio(ls, marcar) {
      var l = login(), ids = ls.filter(function (x) { return x.origem === 'banco' && x.situacao === 'ativa'; }).map(function (x) { return x.id; });
      if (!l || !ids.length) return;
      o.Banco.fotoRelatorio(l.codigo, ids, marcar).then(function () {
        itens.forEach(function (x) { if (ids.indexOf(x.id) >= 0) { x.relatorio = marcar; x.relPor = marcar ? l.nome || '' : ''; } });
        if (aba === 'relatorio' && !marcar) itens = itens.filter(function (x) { return ids.indexOf(x.id) < 0; });
        o.toast(marcar ? plural(ids.length, 'foto marcada', 'fotos marcadas') + ' para o relatório.' : plural(ids.length, 'foto tirada', 'fotos tiradas') + ' do relatório.');
        if (ver >= 0 && aba === 'relatorio' && !marcar) fecharVer();
        render();
      }, function (e) { o.toast(msgErro(e), 6000); });
    }
    function apagarLocal(ls) {
      var loc = ls.filter(function (x) { return locais[x.id]; }).map(function (x) { return locais[x.id]; });
      var nao = loc.filter(function (x) { return x.situacao !== 'enviada'; });
      // fiscal: as da fila esperam o envio; as que ele escolheu deixar só no aparelho, ele mesmo pode apagar
      if (nv() < 2 && nao.some(function (x) { return x.situacao === 'fila'; })) {
        loc = loc.filter(function (x) { return x.situacao !== 'fila'; });
        if (!loc.length) { o.toast('Estas fotos ainda não foram enviadas. Espere o envio (ou peça a um engenheiro) para apagar do celular.', 7000); return; }
        nao = loc.filter(function (x) { return x.situacao !== 'enviada'; });
      }
      if (!loc.length) return;
      var n = loc.length;
      o.confirmar({
        titulo: 'Apagar do celular ' + (n === 1 ? 'esta foto' : n + ' fotos') + '?', perigo: true, botao: 'Apagar do celular',
        html: nao.length
          ? '<p class="modal-err">' + (nao.length === n ? (n === 1 ? 'Esta foto ainda não foi enviada' : 'Nenhuma delas foi enviada ainda') : plural(nao.length, 'delas ainda não foi enviada', 'delas ainda não foram enviadas')) +
            ' ao Drive: ' + (nao.length === 1 ? 'ela se perde' : 'elas se perdem') + ' de vez.</p>'
          : '<p>' + (n === 1 ? 'Ela continua' : 'Elas continuam') + ' no Drive e na galeria da equipe. Sai só deste aparelho, para liberar espaço.</p>',
        digitar: nao.length ? 'APAGAR' : (n > 20 ? 'APAGAR' : null)
      }).then(function (ok) {
        if (!ok) return;
        o.drive.apagar(loc.map(function (x) { return x.id; })).then(function () {
          o.toast(plural(n, 'foto apagada', 'fotos apagadas') + ' deste aparelho.');
          if (ver >= 0) fecharVer();
          sel = {};
          carregar();
        }, function () { o.toast('Não foi possível apagar deste aparelho.', 5000); });
      });
    }
    // as que ficaram só no aparelho vão para a fila do Drive (sim), ou as da fila que ainda não subiram ficam só aqui (não)
    function enviarDrive(ls, sim) {
      var ids = ls.filter(function (x) { return locais[x.id]; }).map(function (x) { return x.id; });
      if (!ids.length || !o.drive || !o.drive.enviar) return;
      o.drive.enviar(ids, sim).then(function (m) {
        if (!m) return;
        o.toast(sim ? plural(m, 'foto na fila', 'fotos na fila') + ' para o Drive' + (login() ? '.' : ': entre com o seu código para enviar.')
          : plural(m, 'foto fica', 'fotos ficam') + ' só neste aparelho (não ' + (m === 1 ? 'vai' : 'vão') + ' para o Drive).', 5000);
        if (ver >= 0) fecharVer();
        sel = {}; selecionando = false;
        carregar();
      }, function () { o.toast('Não foi possível mudar estas fotos neste aparelho.', 5000); });
    }
    function moverDrive(ls, apagar) {
      var l = login(), url = o.driveUrl ? o.driveUrl() : null;
      ls = ls.filter(function (x) { return x.driveId && (apagar ? x.situacao !== 'deletada' && (x.origem === 'banco' || x.situacao === 'enviada') : x.situacao === 'deletada'); });
      if (!l || !url || !ls.length || ocupado) return;
      var n = ls.length;
      o.confirmar(apagar ? {
        titulo: 'Apagar do Drive ' + (n === 1 ? 'esta foto' : n + ' fotos') + '?', perigo: true, botao: 'Apagar do Drive',
        html: '<p>' + (n === 1 ? 'A foto sai' : 'As fotos saem') + ' da galeria da equipe e ' + (n === 1 ? 'vai' : 'vão') + ' para a pasta <b>Deletados</b> do Drive. ' +
          'Só o Administrador vê essa pasta e pode restaurar.</p>', digitar: n > 1 ? 'APAGAR' : null
      } : {
        titulo: 'Restaurar ' + (n === 1 ? 'esta foto' : n + ' fotos') + '?', botao: 'Restaurar',
        html: '<p>' + (n === 1 ? 'Ela volta' : 'Elas voltam') + ' para a pasta original no Drive e para a galeria da equipe.</p>'
      }).then(function (ok) {
        if (!ok) return;
        cancelar = false;
        var feitos = 0, falhas = [], cadeia = Promise.resolve();
        ls.forEach(function (it, i) {
          cadeia = cadeia.then(function () {
            if (cancelar) return;
            ocupado = (apagar ? 'Apagando ' : 'Restaurando ') + (i + 1) + ' de ' + n + '…'; renderBar();
            return o.drive.post(url, { acao: apagar ? 'apagar' : 'restaurar', ambiente: o.ambiente || 'oficial', codigo: l.codigo, driveId: it.driveId }).then(function (r) {
              if (r && r.ok) feitos++; else falhas.push((r && r.erro) || 'erro');
            }, function () { falhas.push('sem_rede'); });
          });
        });
        cadeia.then(function () {
          ocupado = null;
          if (ver >= 0) fecharVer();
          sel = {}; selecionando = false;
          var t = feitos ? plural(feitos, apagar ? 'foto foi para Deletados' : 'foto restaurada', apagar ? 'fotos foram para Deletados' : 'fotos restauradas') + '.' : '';
          if (falhas.length) t += ' ' + plural(falhas.length, 'não foi', 'não foram') + ' (' + (falhas.indexOf('sem_rede') >= 0 ? 'sem conexão' : falhas[0]) + ').';
          o.toast(t.trim(), 6000);
          carregar();
        });
      });
    }
    function fazer(k, ls) {
      if (k === 'baixar') baixar(ls);
      else if (k === 'por-rel') relatorio(ls, true);
      else if (k === 'tirar-rel') relatorio(ls, false);
      else if (k === 'apagar-local') apagarLocal(ls);
      else if (k === 'enviar-drive') enviarDrive(ls, true);
      else if (k === 'segurar') enviarDrive(ls, false);
      else if (k === 'apagar-drive') moverDrive(ls, true);
      else if (k === 'restaurar') moverDrive(ls, false);
    }

    function onClick(e) {
      var t = e.target.closest('[data-g],[data-aba],.gl-t');
      if (!t || !root.contains(t)) return;
      if (t.hasAttribute('data-aba')) {
        var a = t.getAttribute('data-aba');
        if (a === aba) return;
        aba = a; agrupar = ''; filtro.autor = ''; sel = {}; selecionando = false; itens = [];
        carregar();
        return;
      }
      if (t.classList.contains('gl-t')) {
        var i = +t.getAttribute('data-i'), it = lista[i];
        if (!it) return;
        if (selecionando) { if (sel[it.id]) delete sel[it.id]; else sel[it.id] = 1; t.setAttribute('aria-pressed', !!sel[it.id]); renderBar(); }
        else abrir(i);
        return;
      }
      var g = t.getAttribute('data-g');
      if (g === 'fechar') close();
      else if (g === 'entrar') { close(); if (o.entrar) o.entrar(); }
      else if (g === 'selecionar') { selecionando = true; sel = {}; render(); }
      else if (g === 'sair-sel') { selecionando = false; sel = {}; render(); }
      else if (g === 'todas') { var tudo = lista.every(function (x) { return sel[x.id]; }); sel = {}; if (!tudo) lista.forEach(function (x) { sel[x.id] = 1; }); render(); }
      else if (g === 'sel-grupo') {
        var idx = t.getAttribute('data-idx').split(',').map(Number), cheio = idx.every(function (i2) { return sel[lista[i2].id]; });
        idx.forEach(function (i2) { if (cheio) delete sel[lista[i2].id]; else sel[lista[i2].id] = 1; });
        render();
      }
      else if (g === 'baixar-tudo') baixar(lista.slice());
      else if (g === 'rel-pdf') o.relatorioPdf({ itens: itens.slice(), arquivo: arquivo, cid: filtro.cid });
      else if (g === 'enviar') { if (o.drive) o.drive.pump(); setTimeout(render, 300); }
      else if (g === 'enviar-ap') enviarDrive(Object.keys(locais).map(function (k) { return locais[k]; }).filter(function (x) { return x.situacao === 'aparelho'; }), true);
      else if (g === 'limpar') {
        var env = Object.keys(locais).map(function (k) { return locais[k]; }).filter(function (x) { return x.situacao === 'enviada'; });
        apagarLocal(env);
      }
      else if (g === 'cancelar') { cancelar = true; ocupado = 'Parando…'; renderBar(); }
      else if (g === 'fechar-ver') fecharVer();
      else if (g === 'ant' && ver > 0) abrir(ver - 1);
      else if (g === 'prox' && ver < lista.length - 1) abrir(ver + 1);
      else if (g === 'grande') carregarGrande();
      else fazer(g, t.hasAttribute('data-um') ? [lista[ver]] : selecionadas());
    }
    function onChange(e) {
      var f = e.target.getAttribute('data-f');
      if (!f) return;
      if (f === 'agrupar') agrupar = e.target.value;
      else { filtro[f] = e.target.value; if (f === 'cid') filtro.pid = ''; }
      render();
    }
    function onKey(e) {
      if (!root || document.querySelector('.modal')) return;
      if (e.key === 'Escape') { if (ver >= 0) fecharVer(); else if (selecionando) { selecionando = false; sel = {}; render(); } else close(); }
      else if (ver >= 0 && e.key === 'ArrowLeft' && ver > 0) abrir(ver - 1);
      else if (ver >= 0 && e.key === 'ArrowRight' && ver < lista.length - 1) abrir(ver + 1);
    }

    function open(f) {
      f = f || {};
      if (!document.getElementById('glCss')) { var st = document.createElement('style'); st.id = 'glCss'; st.textContent = CSS; document.head.appendChild(st); }
      if (!root) {
        root = document.createElement('div');
        root.className = 'gl';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        root.setAttribute('aria-label', 'Fotos');
        root.innerHTML = '<div class="gl-top"><button type="button" class="btn small" data-g="fechar">← Voltar</button><h2>Fotos</h2></div>' +
          '<div class="gl-tabs" role="tablist"></div><div class="gl-fil"></div><div class="gl-info"></div><div class="gl-body"></div><div class="gl-barhost"></div>';
        root.addEventListener('click', onClick);
        root.addEventListener('change', onChange);
        document.addEventListener('keydown', onKey);
        document.body.appendChild(root);
        document.body.style.overflow = 'hidden';
      }
      filtro = { cid: f.cid || '', pid: f.pid || '', autor: '', mes: '' };
      var vis = abasVisiveis().map(function (a) { return a.k; });
      aba = f.aba && vis.indexOf(f.aba) >= 0 ? f.aba : (f.pid ? (vis.indexOf('todas') >= 0 ? 'todas' : vis.indexOf('minhas') >= 0 ? 'minhas' : 'local') : (vis.indexOf(aba) >= 0 ? aba : 'local'));
      sel = {}; selecionando = false; ver = -1; itens = [];
      carregar();
    }
    function close() {
      if (!root) return;
      cancelar = true;
      if (obs) obs.disconnect();
      soltarGrande(); soltarUrls();
      document.removeEventListener('keydown', onKey);
      root.remove(); root = null; ver = -1;
      document.body.style.overflow = '';
    }
    var mudouT = null;
    function changed() {
      if (!root || aba !== 'local' || ocupado) return;
      clearTimeout(mudouT);
      mudouT = setTimeout(function () { if (root && aba === 'local' && ver < 0 && !selecionando) carregar(); else if (root) { var i = q('.gl-info'); if (i && aba === 'local') i.innerHTML = infoHtml(); } }, 400);
    }
    return { open: open, close: close, changed: changed, isOpen: function () { return !!root; } };
  };
})();
