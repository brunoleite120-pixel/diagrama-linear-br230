// Visualizador em tela cheia das folhas A3 do diagrama. É o mesmo código no site local e na página online
// (lá ele é embutido no HTML na hora de publicar), para as duas versões se comportarem igual.
//
// Uso: var v = TelaCheia({ pageW, pageH, getSheets: function () { return [svg, ...]; } });
//      v.open();  v.update(novasFolhas);  v.close();  v.isOpen();
//
// Gestos: pinça (dois dedos) dá zoom no ponto entre os dedos; com zoom, um dedo arrasta; sem zoom, deslizar troca
// de página; toque duplo aproxima onde tocou (ou volta ao tamanho inteiro); toque simples mostra/esconde os botões.
// No computador: roda do mouse dá zoom, setas trocam de página, +/- aproximam, 0 volta, Esc fecha.
// Com o celular em pé, a folha gira 90° para aproveitar o comprimento da tela.
(function (global) {
  'use strict';

  var MAX_ZOOM = 10;
  var CSS = [
    '.tc{position:fixed;inset:0;z-index:1000;background:#1B201D;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;overscroll-behavior:contain}',
    '.tc[hidden]{display:none}',
    '.tc-sheet{position:absolute;left:50%;top:50%;background:#FFFFFF;transform-origin:50% 50%;box-shadow:0 4px 30px rgba(0,0,0,.5);will-change:transform}',
    '.tc-sheet svg{display:block;width:100%;height:100%}',
    '.tc-btn{min-width:40px;height:40px;border:0;border-radius:20px;background:rgba(18,22,20,.8);color:#FFFFFF;font:600 13px/1 system-ui,-apple-system,"Segoe UI",sans-serif;padding:0 14px;display:inline-flex;align-items:center;justify-content:center;gap:6px;cursor:pointer}',
    '.tc-btn:disabled{opacity:.4;cursor:default}',
    '.tc-btn:focus-visible{outline:2px solid #86AEE6;outline-offset:2px}',
    '.tc-btn svg{width:18px;height:18px}',
    '.tc-close{position:absolute;top:calc(10px + env(safe-area-inset-top,0px));right:calc(10px + env(safe-area-inset-right,0px));width:40px;padding:0}',
    '.tc-bar{position:absolute;left:50%;bottom:calc(10px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px;white-space:nowrap}',
    '.tc-row{display:flex;gap:6px;align-items:center}',
    '.tc-page{color:#FFFFFF;background:rgba(18,22,20,.8);border-radius:20px;padding:0 12px;height:40px;display:inline-flex;align-items:center;font:600 13px/1 system-ui,-apple-system,"Segoe UI",sans-serif;font-variant-numeric:tabular-nums}',
    '.tc-hint{color:#FFFFFF;background:rgba(18,22,20,.8);border-radius:8px;padding:6px 10px;font:500 12px/1.3 system-ui,-apple-system,"Segoe UI",sans-serif;transition:opacity .4s}',
    '.tc-hint.gone{opacity:0}',
    '.tc.rot .tc-close{top:auto;bottom:calc(10px + env(safe-area-inset-bottom,0px))}',
    '.tc.rot .tc-bar{left:calc(10px + env(safe-area-inset-left,0px));bottom:auto;top:50%;transform-origin:0 0;transform:rotate(90deg) translate(-50%,-100%)}',
    '.tc .tc-close,.tc .tc-bar{transition:opacity .2s}',
    '.tc.hide-ui .tc-close,.tc.hide-ui .tc-bar{opacity:0;pointer-events:none}',
    '@media (prefers-reduced-motion: reduce){.tc *{transition:none !important}}'
  ].join('\n');
  var ICON = {
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12"/><path d="M18 6L6 18"/></svg>',
    prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>',
    next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>'
  };

  function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }

  function TelaCheia(opts) {
    var pageW = opts.pageW, pageH = opts.pageH;
    var st = { open: false, page: 0, sheets: [], z: 1, tx: 0, ty: 0, rot: 'auto', uiTimer: null, hintTimer: null, lastTap: 0, tapTimer: null, returnFocus: null };
    var pts = {}, gesture = null;
    var el = null, sheetEl = null, $ = {};

    function build() {
      if (el) return;
      if (!document.getElementById('tc-style')) {
        var style = document.createElement('style');
        style.id = 'tc-style';
        style.textContent = CSS;
        document.head.appendChild(style);
      }
      el = document.createElement('div');
      el.className = 'tc';
      el.hidden = true;
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      el.setAttribute('aria-label', 'Diagrama em tela cheia');
      el.innerHTML =
        '<div class="tc-sheet"></div>' +
        '<button class="tc-btn tc-close" type="button" data-tc="close" aria-label="Fechar tela cheia">' + ICON.close + '</button>' +
        '<div class="tc-bar"><div class="tc-hint gone" data-tc="hint">Dois dedos para dar zoom · deslize para trocar de página</div><div class="tc-row">' +
        '<button class="tc-btn" type="button" data-tc="prev" aria-label="Página anterior">' + ICON.prev + '</button>' +
        '<span class="tc-page" data-tc="page" aria-live="polite"></span>' +
        '<button class="tc-btn" type="button" data-tc="next" aria-label="Próxima página">' + ICON.next + '</button>' +
        '<button class="tc-btn" type="button" data-tc="fill" aria-pressed="false">Preencher</button>' +
        '<button class="tc-btn" type="button" data-tc="rot">Girar</button>' +
        '</div></div>';
      document.body.appendChild(el);
      sheetEl = el.querySelector('.tc-sheet');
      sheetEl.style.width = pageW + 'px';
      sheetEl.style.height = pageH + 'px';
      ['close', 'prev', 'next', 'fill', 'rot', 'page', 'hint'].forEach(function (k) { $[k] = el.querySelector('[data-tc="' + k + '"]'); });
      $.close.addEventListener('click', close);
      $.prev.addEventListener('click', function () { go(-1); showUi(); });
      $.next.addEventListener('click', function () { go(1); showUi(); });
      $.fill.addEventListener('click', function () { toggleFill(); showUi(); });
      $.rot.addEventListener('click', function () { st.rot = geom().rot ? 'off' : 'on'; resetView(); showUi(); });
      el.addEventListener('pointerdown', onDown);
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onUp);
      el.addEventListener('wheel', onWheel, { passive: false });
      el.addEventListener('keydown', onKey);
      // Safari (iOS) ainda dispara os gestos próprios dele; sem isso a pinça daria zoom na página inteira
      ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (t) { el.addEventListener(t, function (e) { e.preventDefault(); }); });
      window.addEventListener('resize', layout);
      document.addEventListener('fullscreenchange', layout);
      if (window.visualViewport) window.visualViewport.addEventListener('resize', layout);
    }

    // ---------------------------------------------------------------- geometria
    function geom() {
      var W = el.clientWidth, H = el.clientHeight;
      var rot = st.rot === 'auto' ? H > W * 1.05 : st.rot === 'on';
      var bw0 = rot ? pageH : pageW, bh0 = rot ? pageW : pageH;
      var fit = Math.min(W / bw0, H / bh0), cover = Math.max(W / bw0, H / bh0);
      var s = fit * st.z;
      return { W: W, H: H, rot: rot, fit: fit, cover: cover, s: s, bw: bw0 * s, bh: bh0 * s };
    }
    function layout() {
      if (!st.open) return;
      var g = geom();
      var mx = Math.max(0, (g.bw - g.W) / 2), my = Math.max(0, (g.bh - g.H) / 2);
      st.tx = clamp(st.tx, -mx, mx);
      st.ty = clamp(st.ty, -my, my);
      sheetEl.style.transform = 'translate(-50%,-50%) translate(' + st.tx + 'px,' + st.ty + 'px) rotate(' + (g.rot ? 90 : 0) + 'deg) scale(' + g.s + ')';
      el.classList.toggle('rot', g.rot);
      var zoomed = st.z > 1.01;
      $.fill.textContent = zoomed ? 'Ajustar' : 'Preencher';
      $.fill.setAttribute('aria-pressed', String(zoomed));
    }
    function resetView() { st.z = 1; st.tx = 0; st.ty = 0; layout(); }
    // muda o zoom mantendo parado o ponto (px, py) da tela
    function zoomAt(z, px, py) {
      var g = geom(), k = z / st.z;
      st.tx = px - g.W / 2 - (px - g.W / 2 - st.tx) * k;
      st.ty = py - g.H / 2 - (py - g.H / 2 - st.ty) * k;
      st.z = z;
      layout();
    }
    function toggleFill() {
      if (st.z > 1.01) { resetView(); return; }
      var g = geom();
      st.z = clamp(g.cover / g.fit, 1, MAX_ZOOM); st.tx = 0; st.ty = 0;
      layout();
    }

    // ---------------------------------------------------------------- páginas e botões
    function showPage() {
      st.page = clamp(st.page, 0, Math.max(0, st.sheets.length - 1));
      sheetEl.innerHTML = st.sheets[st.page] || '';
      $.page.textContent = (st.page + 1) + ' / ' + st.sheets.length;
      $.prev.disabled = st.page === 0;
      $.next.disabled = st.page >= st.sheets.length - 1;
    }
    function go(delta) {
      var n = clamp(st.page + delta, 0, st.sheets.length - 1);
      if (n === st.page) return;
      st.page = n;
      showPage();
      resetView();
    }
    function showUi() {
      el.classList.remove('hide-ui');
      clearTimeout(st.uiTimer);
      st.uiTimer = setTimeout(function () { el.classList.add('hide-ui'); }, 3500);
    }
    function toggleUi() {
      if (el.classList.contains('hide-ui')) showUi();
      else { clearTimeout(st.uiTimer); el.classList.add('hide-ui'); }
    }

    // ---------------------------------------------------------------- gestos
    function local(e) { var r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function twoPoints() { var ids = Object.keys(pts); return [pts[ids[0]], pts[ids[1]]]; }
    function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
    function startPinch() {
      var ab = twoPoints();
      gesture = { type: 'pinch', d0: Math.max(10, dist(ab[0], ab[1])), m0: { x: (ab[0].x + ab[1].x) / 2, y: (ab[0].y + ab[1].y) / 2 }, z0: st.z, tx0: st.tx, ty0: st.ty };
    }
    function startDrag(id, moved) {
      var p = pts[id];
      gesture = { type: 'drag', id: Number(id), x0: p.x, y0: p.y, tx0: st.tx, ty0: st.ty, moved: !!moved };
    }
    function onDown(e) {
      if (e.target.closest('.tc-btn')) return;
      pts[e.pointerId] = local(e);
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* captura é opcional */ }
      var n = Object.keys(pts).length;
      if (n === 1) startDrag(e.pointerId, false);
      else if (n === 2) { clearTimeout(st.tapTimer); startPinch(); }
    }
    function onMove(e) {
      if (!pts[e.pointerId]) return;
      pts[e.pointerId] = local(e);
      if (!gesture) return;
      if (gesture.type === 'pinch' && Object.keys(pts).length >= 2) {
        var ab = twoPoints(), g = geom();
        var m = { x: (ab[0].x + ab[1].x) / 2, y: (ab[0].y + ab[1].y) / 2 };
        var z = clamp(gesture.z0 * dist(ab[0], ab[1]) / gesture.d0, 1, MAX_ZOOM), k = z / gesture.z0;
        // o ponto da folha que estava entre os dedos acompanha os dedos (zoom e arraste juntos)
        st.tx = m.x - g.W / 2 - (gesture.m0.x - g.W / 2 - gesture.tx0) * k;
        st.ty = m.y - g.H / 2 - (gesture.m0.y - g.H / 2 - gesture.ty0) * k;
        st.z = z;
        layout();
      } else if (gesture.type === 'drag' && gesture.id === e.pointerId) {
        var p = pts[e.pointerId], dx = p.x - gesture.x0, dy = p.y - gesture.y0;
        if (Math.abs(dx) > 6 || Math.abs(dy) > 6) gesture.moved = true;
        if (gesture.moved && st.z > 1.001) { st.tx = gesture.tx0 + dx; st.ty = gesture.ty0 + dy; layout(); }
      }
    }
    function onUp(e) {
      if (!pts[e.pointerId]) return;
      var p = pts[e.pointerId];
      delete pts[e.pointerId];
      var left = Object.keys(pts);
      if (!gesture) return;
      if (gesture.type === 'pinch') {
        if (left.length === 1) startDrag(left[0], true); // segue arrastando com o dedo que ficou, sem contar como toque
        else if (!left.length) gesture = null;
        if (st.z < 1.03) resetView();
        return;
      }
      if (gesture.id !== e.pointerId) return;
      var dx = p.x - gesture.x0, dy = p.y - gesture.y0, moved = gesture.moved;
      gesture = null;
      if (e.type === 'pointercancel') return;
      if (!moved) {
        var now = Date.now();
        if (now - st.lastTap < 320) {
          clearTimeout(st.tapTimer); st.lastTap = 0;
          if (st.z > 1.01) resetView(); else zoomAt(2.5, p.x, p.y);
        } else {
          st.lastTap = now;
          st.tapTimer = setTimeout(toggleUi, 330);
        }
        return;
      }
      if (st.z > 1.001) return;
      // deslizar troca de página; com a folha girada, o "lado" da folha corre na vertical da tela
      var rot = geom().rot, main = rot ? -dy : -dx, cross = rot ? dx : dy;
      if (Math.abs(main) > 60 && Math.abs(main) > Math.abs(cross)) go(main > 0 ? 1 : -1);
    }
    function onWheel(e) {
      e.preventDefault();
      var p = local(e), f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0025));
      zoomAt(clamp(st.z * f, 1, MAX_ZOOM), p.x, p.y);
      if (st.z < 1.03) resetView();
    }
    function onKey(e) {
      var g, handled = true;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight' || e.key === 'PageDown') go(1);
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(-1);
      else if (e.key === '+' || e.key === '=') { g = geom(); zoomAt(clamp(st.z * 1.4, 1, MAX_ZOOM), g.W / 2, g.H / 2); }
      else if (e.key === '-') { g = geom(); zoomAt(clamp(st.z / 1.4, 1, MAX_ZOOM), g.W / 2, g.H / 2); if (st.z < 1.03) resetView(); }
      else if (e.key === '0') resetView();
      else handled = false;
      if (handled) { e.preventDefault(); e.stopPropagation(); }
    }

    // ---------------------------------------------------------------- abrir / fechar
    function open() {
      var sheets = opts.getSheets() || [];
      if (!sheets.length) return;
      build();
      st.returnFocus = document.activeElement;
      st.sheets = sheets; st.page = 0; st.rot = 'auto'; st.open = true;
      pts = {}; gesture = null;
      el.hidden = false;
      showPage();
      resetView();
      showUi();
      $.hint.classList.remove('gone');
      clearTimeout(st.hintTimer);
      st.hintTimer = setTimeout(function () { $.hint.classList.add('gone'); }, 4000);
      $.close.focus();
      // no app do iPhone a tela cheia do sistema mostra aviso e um X por cima: a camada já cobre a tela toda
      var nativo = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
      try {
        var r = el.requestFullscreen && !nativo ? el.requestFullscreen({ navigationUI: 'hide' }) : null;
        if (r && r.then) r.then(function () {
          try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(function () {}); } catch (err) { /* sem trava de orientação */ }
        }, function () {});
      } catch (err) { /* sem tela cheia do navegador: a camada já cobre a página toda */ }
    }
    function close() {
      if (!st.open) return;
      st.open = false;
      el.hidden = true;
      sheetEl.innerHTML = '';
      pts = {}; gesture = null;
      clearTimeout(st.uiTimer); clearTimeout(st.hintTimer); clearTimeout(st.tapTimer);
      try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (err) { /* nada a desfazer */ }
      try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {}); } catch (err) { /* nada a desfazer */ }
      if (st.returnFocus && st.returnFocus.focus) st.returnFocus.focus();
    }
    // novas folhas (dados mudaram): troca o desenho sem perder o zoom de quem está olhando
    function update(sheets) {
      if (!st.open) return;
      if (!sheets || !sheets.length) { close(); return; }
      var same = st.sheets[st.page] === sheets[st.page] && st.sheets.length === sheets.length;
      st.sheets = sheets;
      if (!same) { showPage(); layout(); }
    }

    return { open: open, close: close, update: update, isOpen: function () { return st.open; } };
  }

  global.TelaCheia = TelaCheia;
})(window);
