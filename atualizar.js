/*
 * Atualização do app (iPhone e Android) pelo servidor, sem compilar de novo: o app confere no site se há uma versão mais
 * nova do conteúdo (as páginas e os scripts), baixa em segundo plano e troca quando o app é aberto de novo, ou na hora,
 * se a pessoa tocar em "Atualizar agora". Nunca troca sozinho no meio do uso (no Android, abrir a câmera põe o app em
 * segundo plano; trocar ali perderia a foto).
 * Só age no app nativo com o plugin @capgo/capacitor-updater (modo manual, sem a nuvem deles, sem estatísticas: veja
 * capacitor.config.json). No navegador não faz nada: o site já se atualiza sozinho.
 *
 *   <site>/app/versao.json (oficial) e <site>/previa/app/versao.json (prévia), montados pelo pages.yml:
 *     { ambiente, versao (commit curto), ordem (data do commit, em segundos), arquivo, sha256, tamanho, texto }
 *   Só troca por uma versão do MESMO ambiente e MAIS NOVA (ordem maior) que a que está rodando (AMBIENTE.pacote e
 *   AMBIENTE.ordem, gravados por ferramentas/montar-app.sh). O plugin confere o SHA-256 do arquivo baixado.
 *   Se a versão nova não abrir direito (app.js não chega ao fim em 15 s), o plugin volta para a anterior e esta versão
 *   não é baixada de novo. As fotos e dados guardados no aparelho continuam (o endereço interno do app não muda).
 */
(function () {
  'use strict';
  var C = window.Capacitor, A = window.AMBIENTE || {};
  var U = C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.CapacitorUpdater;
  if (!U || !A.ordem) return;

  var BASE = 'https://brunoleite120-pixel.github.io/diagrama-linear-br230/' + (A.previa ? 'previa/' : '') + 'app/';
  var K_PRONTA = 'diagrama-linear.app-pronta';   // { id, versao, ordem, texto }: baixada, esperando o app abrir de novo
  var K_TENTOU = 'diagrama-linear.app-tentou';   // versão que acabou de ser posta: se não for a que está rodando, falhou
  var K_FALHOU = 'diagrama-linear.app-falhou';   // versão que não abriu: não baixa de novo
  var INTERVALO = 30 * 60000, ultima = 0, baixando = false;

  function ler(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function gravar(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* segue */ } }

  // a última troca deu certo? (o plugin volta para a anterior quando a nova não abre)
  var t = ler(K_TENTOU);
  if (t) {
    if (t.versao !== A.pacote) gravar(K_FALHOU, t.versao);
    gravar(K_TENTOU, null);
  }

  // ---------------------------------------------------------------- aviso na tela
  function aviso(html, botao, acao) {
    var el = document.getElementById('avisoApp');
    if (!el) {
      el = document.createElement('div');
      el.id = 'avisoApp';
      el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom, 0px));z-index:3000;' +
        'display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:10px;background:#1D4F91;color:#fff;' +
        'font-size:14px;line-height:1.3;box-shadow:0 6px 24px rgba(0,0,0,.25)';
      document.body.appendChild(el);
    }
    el.innerHTML = '<span style="flex:1;min-width:0">' + html + '</span>' +
      (botao ? '<button type="button" data-a="ok" style="border:0;border-radius:8px;background:#fff;color:#1D4F91;font-weight:700;padding:8px 12px;font-size:14px">' + botao + '</button>' : '') +
      '<button type="button" data-a="x" aria-label="Fechar" style="border:0;background:none;color:#fff;font-size:20px;padding:4px 6px">×</button>';
    el.onclick = function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (b.getAttribute('data-a') === 'ok' && acao) acao();
      else el.remove();
    };
  }
  function cobrir(txt) {
    var el = document.createElement('div');
    el.id = 'cobreApp';
    el.style.cssText = 'position:fixed;inset:0;z-index:4000;display:flex;align-items:center;justify-content:center;background:#F4F6F5;color:#1D4F91;font-size:16px;font-weight:600';
    el.textContent = txt;
    document.body.appendChild(el);
    return el;
  }

  // ---------------------------------------------------------------- trocar
  function pacotes() { return U.list().then(function (r) { return (r && r.bundles) || []; }, function () { return []; }); }
  function trocar(p) {
    return pacotes().then(function (bs) {
      var b = bs.filter(function (x) { return x.id === p.id; })[0];
      if (!b || /error|delet/.test(b.status)) {   // sumiu ou falhou: esquece; a próxima conferência baixa de novo se for o caso
        if (b && b.status === 'error') gravar(K_FALHOU, p.versao);
        gravar(K_PRONTA, null);
        return false;
      }
      var capa = cobrir('Atualizando o app…');
      gravar(K_TENTOU, { versao: p.versao });
      gravar(K_PRONTA, null);
      return U.set({ id: p.id }).then(function () { return true; }, function () {   // set() recarrega a página; só volta aqui se falhar
        gravar(K_TENTOU, null);
        capa.remove();
        return false;
      });
    });
  }
  // ao abrir: se há uma versão nova já baixada, troca antes de a pessoa começar a usar
  function trocarSePronta() {
    var p = ler(K_PRONTA);
    if (!p) return Promise.resolve(false);
    if (!(p.ordem > A.ordem)) { gravar(K_PRONTA, null); return Promise.resolve(false); }
    return trocar(p);
  }

  // ---------------------------------------------------------------- conferir e baixar
  function avisarPronta(p) {
    aviso('Versão nova do app baixada' + (p.texto ? ' (' + p.texto + ')' : '') + '. Entra quando o app abrir de novo.', 'Atualizar agora', function () { trocar(p); });
  }
  function conferir(forcar) {
    if (baixando || navigator.onLine === false) return;
    if (!forcar && Date.now() - ultima < INTERVALO) return;
    ultima = Date.now();
    fetch(BASE + 'versao.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (v) {
      if (!v || v.ambiente !== A.nome || !(v.ordem > A.ordem) || !v.arquivo || !v.sha256 || v.versao === ler(K_FALHOU)) return;
      var p = ler(K_PRONTA);
      if (p && p.versao === v.versao) { avisarPronta(p); return; }
      baixando = true;
      return U.download({ url: BASE + v.arquivo, version: v.versao, checksum: String(v.sha256).toLowerCase() }).then(function (b) {
        if (p && p.id && p.id !== b.id) U.delete({ id: p.id }).catch(function () { /* já foi */ });
        var nova = { id: b.id, versao: v.versao, ordem: v.ordem, texto: v.texto || v.versao };
        gravar(K_PRONTA, nova);
        avisarPronta(nova);
      });
    }).catch(function () { /* sem rede ou servidor fora do ar: tenta de novo mais tarde */ }).then(function () { baixando = false; });
  }

  // ---------------------------------------------------------------- início
  window.addEventListener('load', function () {
    // só confirma ao plugin que esta versão abriu bem quando o app.js chegou ao fim (senão ele volta para a anterior)
    if (window.Unifilar && window.Unifilar.pronto) U.notifyAppReady().catch(function () { /* segue */ });
    trocarSePronta().then(function (trocou) {
      if (trocou) return;
      setTimeout(function () { conferir(true); }, 3000);
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') conferir(false); });
      window.addEventListener('online', function () { conferir(false); });
    });
  });

  window.AtualizarApp = { conferir: function () { conferir(true); }, base: BASE };
})();
