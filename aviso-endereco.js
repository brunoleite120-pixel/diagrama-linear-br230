/* Aviso da mudança de endereço (outubro de 2026). O site saiu do GitHub Pages (brunoleite120-pixel.github.io/diagrama-linear-br230),
 * que sai do ar quando o repositório ficar privado, e fica só no Cloudflare: https://via-230.pages.dev/ (prévia: /previa/).
 * Só aparece no endereço antigo; no app instalado (localhost) e no Cloudflare não faz nada.
 * O armazenamento do navegador é por endereço: o login, as alterações e as fotos que ainda não foram enviadas daqui não passam
 * sozinhos para o endereço novo. Por isso o aviso mostra o que falta enviar e só diz "pode trocar" com tudo enviado.
 * Depois que o endereço antigo sair do ar, o sw.js abre a cópia guardada (com este aviso) em vez da página de erro do GitHub. */
(function () {
  if (location.hostname !== 'brunoleite120-pixel.github.io') return;
  var previa = /\/previa\//.test(location.pathname);
  var NOVO = 'https://via-230.pages.dev/' + (previa ? 'previa/' : '');
  var CHAVE = 'diagrama-linear.aviso-endereco';   // "agora não": fica pequeno até a próxima abertura do app
  var css = '' +
    '#avEnd{position:fixed;left:0;right:0;top:0;z-index:2147483000;display:flex;justify-content:center;padding:calc(env(safe-area-inset-top,0px) + 10px) 12px 0;pointer-events:none;font:14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}' +
    '#avEnd .av-c{pointer-events:auto;max-width:520px;width:100%;background:#FFFFFF;color:#17201C;border:2px solid #C98A00;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.28);padding:14px 16px;display:flex;flex-direction:column;gap:10px;max-height:calc(100vh - 24px);overflow:auto}' +
    '#avEnd h2{margin:0;font-size:17px;line-height:1.25}' +
    '#avEnd p{margin:0}' +
    '#avEnd .av-url{font-weight:700;word-break:break-all;user-select:all;background:#FFF4D6;border-radius:6px;padding:6px 8px}' +
    '#avEnd .av-st{border-radius:8px;padding:8px 10px;font-weight:600}' +
    '#avEnd .av-st.ok{background:#E6F4EC;color:#14663A}' +
    '#avEnd .av-st.pend{background:#FDECEA;color:#8A1C12}' +
    '#avEnd ol{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:4px}' +
    '#avEnd .av-b{display:flex;flex-wrap:wrap;gap:8px}' +
    '#avEnd .av-b a,#avEnd .av-b button{min-height:44px;padding:0 14px;border-radius:8px;font:inherit;font-weight:650;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;text-decoration:none}' +
    '#avEnd .av-ir{background:#2B5797;color:#FFFFFF;border:0}' +
    '#avEnd .av-cp,#avEnd .av-x{background:#FFFFFF;color:#17201C;border:1px solid #9AA29E}' +
    '#avEnd.min .av-c{display:none}' +
    '#avEnd .av-pill{display:none;pointer-events:auto;min-height:40px;padding:0 14px;border-radius:20px;border:2px solid #C98A00;background:#FFF4D6;color:#5C3D00;font:inherit;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.2)}' +
    '#avEnd.min .av-pill{display:inline-flex;align-items:center}';

  function pendentes() {
    var U = window.Unifilar, b = null, d = null;
    try { b = U && U.banco ? U.banco() : null; } catch (e) { b = null; }
    try { d = U && U.drive ? U.drive() : null; } catch (e) { d = null; }
    var i = null;
    try { i = d && d.info ? d.info() : null; } catch (e) { i = null; }
    var rec = 0;
    try { rec = U && U.recusadas ? U.recusadas() : 0; } catch (e) { rec = 0; }
    // as fotos do aparelho: 'sim' (contadas; sem a fila do Drive não há fotos guardadas), 'nao' (ainda contando) ou 'erro' (não leu)
    var cont = !d ? 'sim' : !i ? 'nao' : i.contado === true ? 'sim' : i.contado === 'erro' ? 'erro' : 'nao';
    return { cont: cont, pronto: !!(U && U.pronto), login: !!(b && b.login), alt: b && b.pend ? b.pend.length : 0, fotos: i ? i.n || 0 : 0,
      aparelho: i ? i.aparelho || 0 : 0, outras: i ? i.outras || 0 : 0, recusadas: rec, enviando: !!(b && b.sending) || !!(i && i.busy) };
  }
  function plural(n, um, varios) { return n + ' ' + (n === 1 ? um : varios); }
  function status() {
    var p = pendentes();
    if (!p.pronto || p.cont === 'nao') return { ok: false, t: 'Conferindo o que falta enviar deste aparelho…' };
    // sem ler as fotos guardadas no aparelho, não dá para dizer que está tudo enviado
    if (p.cont === 'erro') return { ok: false, t: 'Não consegui conferir as fotos guardadas neste aparelho. Feche e abra o app de novo; se continuar, abra Galeria › No aparelho e confira antes de trocar de endereço.' };
    // só libera com tudo zerado: o que fica só neste endereço some quando o atalho antigo for apagado
    var linhas = [];
    if (p.alt || p.fotos) {
      var falta = [];
      if (p.alt) falta.push(plural(p.alt, 'alteração', 'alterações'));
      if (p.fotos) falta.push(plural(p.fotos, 'foto', 'fotos'));
      linhas.push('Espere: ' + falta.join(' e ') + ' deste aparelho ainda não ' + (p.alt + p.fotos === 1 ? 'foi enviada' : 'foram enviadas') +
        '. Deixe o app aberto com internet' + (p.enviando ? ' (enviando agora)' : '') + '.');
    }
    if (p.aparelho) linhas.push(plural(p.aparelho, 'foto está', 'fotos estão') + ' só neste aparelho (marcadas para não enviar): envie ao Drive ou salve na galeria do celular e apague daqui antes.');
    if (p.outras) linhas.push(plural(p.outras, 'foto', 'fotos') + ' de outra pessoa' + (p.login ? '' : ' (ou de quem saiu)') + ' ainda não ' + (p.outras === 1 ? 'foi enviada' : 'foram enviadas') + ': quem tirou precisa entrar aqui com o código dele e enviar.');
    if (p.recusadas) linhas.push(plural(p.recusadas, 'alteração está guardada', 'alterações estão guardadas') + ' só aqui, sem ter ido para o banco: abra Dados › Alterações guardadas e mande de novo, ou baixe o arquivo e apague.');
    if (!linhas.length) return { ok: true, t: 'Tudo enviado: pode trocar de endereço.' };
    return { ok: false, t: linhas.join(' ') + ' Não apague o atalho antigo antes disso.' };
  }

  function montar() {
    if (document.getElementById('avEnd')) return;
    var st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);
    var el = document.createElement('div');
    el.id = 'avEnd';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-labelledby', 'avEndT');
    el.innerHTML = '<div class="av-c">' +
      '<h2 id="avEndT">O endereço do VIA-230 mudou' + (previa ? ' (prévia)' : '') + '</h2>' +
      '<p>Este endereço vai sair do ar. O endereço novo é:</p>' +
      '<div class="av-url">' + NOVO + '</div>' +
      '<div class="av-st" aria-live="polite"></div>' +
      '<ol><li>Espere aparecer "Tudo enviado" aqui em cima.</li>' +
      '<li>Abra o endereço novo e instale de novo: no iPhone, Safari › Compartilhar › Adicionar à Tela de Início; no Android, Chrome › ⋮ › Instalar app.</li>' +
      '<li>Entre de novo com o seu código de acesso e refaça as logos e os ajustes da foto, se usar.</li>' +
      '<li>Só depois apague o atalho antigo (no iPhone, apagar o atalho apaga o que está guardado nele).</li></ol>' +
      '<div class="av-b"><a class="av-ir" href="' + NOVO + '">Abrir o endereço novo</a>' +
      '<button type="button" class="av-cp">Copiar o endereço</button>' +
      '<button type="button" class="av-x">Agora não</button></div>' +
      '</div><button type="button" class="av-pill" aria-label="Aviso: o endereço do app mudou">Endereço novo ›</button>';
    document.body.appendChild(el);
    var stEl = el.querySelector('.av-st');
    function atualiza() { var s = status(); stEl.textContent = s.t; stEl.className = 'av-st ' + (s.ok ? 'ok' : 'pend'); }
    atualiza();
    setInterval(atualiza, 3000);
    el.querySelector('.av-cp').addEventListener('click', function (e) {
      var b = e.currentTarget;
      function feito(t) { b.textContent = t; setTimeout(function () { b.textContent = 'Copiar o endereço'; }, 2500); }
      try {
        navigator.clipboard.writeText(NOVO).then(function () { feito('Copiado'); }, function () { feito('Selecione e copie acima'); });
      } catch (x) { feito('Selecione e copie acima'); }
    });
    el.querySelector('.av-x').addEventListener('click', function () {
      el.classList.add('min');
      try { sessionStorage.setItem(CHAVE, '1'); } catch (x) { /* sem armazenamento */ }
    });
    el.querySelector('.av-pill').addEventListener('click', function () { el.classList.remove('min'); });
    try { if (sessionStorage.getItem(CHAVE)) el.classList.add('min'); } catch (x) { /* sem armazenamento */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
})();
