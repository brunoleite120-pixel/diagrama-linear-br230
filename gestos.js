/*
 * Gestos na foto aberta em tela cheia (Galeria e o lote da "Foto com carimbo"), pedido de 22/10/2026:
 *   - arrastar para o lado: a foto acompanha o dedo; soltando com mais de 1/4 da largura (ou rápido), passa para a próxima
 *     (para a esquerda) ou a anterior (para a direita). Na primeira e na última, só estica e volta;
 *   - arrastar para baixo: fecha (volta para a lista), com o fundo clareando junto;
 *   - dois dedos: amplia (até 5x); toque duplo: amplia 2,5x no ponto tocado, ou volta ao tamanho normal;
 *   - ampliada, um dedo move a foto (sem passar para a próxima).
 *
 *   var g = GestosFoto(caixa, { img(), area(), temAnt(), temProx(), ant(), prox(), fechar(), fundo() })
 *     caixa: o elemento que continua na tela enquanto as fotos trocam. area(): onde o gesto pode começar (sem ela, a caixa
 *     toda; os toques em botões e links nunca contam). img(): a <img> de agora. fundo(): o que clareia ao puxar para baixo.
 *     ant()/prox() trocam a foto (a <img> pode ser outra depois); a nova entra deslizando do lado certo.
 *   g.zerar()  volta ao tamanho normal (trocar a <img> já zera sozinho)
 *   g.solta()  tira os gestos da caixa
 */
(function () {
  'use strict';

  window.GestosFoto = function (caixa, o) {
    var pts = {}, n = 0, gesto = null, z = { s: 1, x: 0, y: 0 }, ultimoToque = null, animando = false, daImg = null;
    // a foto trocou por botão ou teclado (outra <img>): o zoom guardado era da anterior
    function img() { var el = o.img ? o.img() : caixa.querySelector('img'); if (el !== daImg) { daImg = el; z = { s: 1, x: 0, y: 0 }; } return el; }
    function aplica(el, x, y, s, suave) {
      if (!el) return;
      el.style.transition = suave ? 'transform .22s ease-out, opacity .22s ease-out' : 'none';
      el.style.transform = 'translate(' + x + 'px,' + y + 'px)' + (s !== 1 ? ' scale(' + s + ')' : '');
    }
    function fundo(op, suave) {
      var f = o.fundo && o.fundo();
      if (!f) return;
      f.style.transition = suave ? 'background-color .22s ease-out' : 'none';
      f.style.backgroundColor = op == null ? '' : 'rgba(14,19,17,' + op + ')';
    }
    // a foto ampliada não sai da caixa: o deslocamento fica limitado à sobra de cada lado
    function limita() {
      var el = img();
      if (!el) return;
      var w = el.offsetWidth, h = el.offsetHeight, mx = Math.max(0, (w * z.s - w) / 2), my = Math.max(0, (h * z.s - h) / 2);
      z.x = Math.max(-mx, Math.min(mx, z.x)); z.y = Math.max(-my, Math.min(my, z.y));
    }
    function zerar(suave) { z = { s: 1, x: 0, y: 0 }; aplica(img(), 0, 0, 1, suave); }
    // ponto da tela -> ponto da foto, em relação ao centro dela e sem o zoom (o centro do retângulo já inclui o deslocamento)
    function rel(px, py) {
      var el = img(), r = el.getBoundingClientRect();
      return { x: (px - (r.left + r.width / 2)) / z.s, y: (py - (r.top + r.height / 2)) / z.s };
    }
    function troca(dir) {
      var el = img(), w = caixa.clientWidth || 360;
      animando = true;
      aplica(el, dir > 0 ? -w : w, 0, 1, true);
      el.style.opacity = '0';
      setTimeout(function () {
        if (!caixa.isConnected) { animando = false; return; }   // fechou no meio da passada: não troca (nem reabre)
        if (dir > 0) o.prox(); else o.ant();
        var nv = img();
        z = { s: 1, x: 0, y: 0 };
        if (nv) {
          aplica(nv, dir > 0 ? w * 0.35 : -w * 0.35, 0, 1, false);
          nv.style.opacity = '0.3';
          nv.getBoundingClientRect();   // aplica a posição de saída antes de animar
          aplica(nv, 0, 0, 1, true);
          nv.style.opacity = '1';
        }
        setTimeout(function () { animando = false; }, 230);
      }, 190);
    }
    function onDown(e) {
      if (animando || (e.pointerType === 'mouse' && e.button !== 0)) return;
      var el = img(), ar = o.area ? o.area() : caixa;
      if (!el || !ar || !ar.contains(e.target) || e.target.closest('button,a,input,select,textarea')) return;
      pts[e.pointerId] = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: Date.now() };
      n = Object.keys(pts).length;
      try { caixa.setPointerCapture(e.pointerId); } catch (er) { /* segue */ }
      if (n === 2) {
        var ids = Object.keys(pts), a = pts[ids[0]], b = pts[ids[1]];
        gesto = { tipo: 'pinca', d0: Math.hypot(b.x - a.x, b.y - a.y) || 1, s0: z.s, x0: z.x, y0: z.y, c0: rel((a.x + b.x) / 2, (a.y + b.y) / 2) };
      } else if (n === 1) gesto = { tipo: 'novo', zx: z.x, zy: z.y };
    }
    function onMove(e) {
      var p = pts[e.pointerId];
      if (!p || !gesto) return;
      p.x = e.clientX; p.y = e.clientY;
      var el = img();
      if (gesto.tipo === 'pinca' && n >= 2) {
        var ids = Object.keys(pts), a = pts[ids[0]], b = pts[ids[1]];
        var s = Math.max(1, Math.min(5, gesto.s0 * Math.hypot(b.x - a.x, b.y - a.y) / gesto.d0));
        // o ponto entre os dedos fica parado na tela: u*s0 + T0 = u*s + T
        z.x = gesto.x0 + gesto.c0.x * (gesto.s0 - s);
        z.y = gesto.y0 + gesto.c0.y * (gesto.s0 - s);
        z.s = s;
        limita();
        aplica(el, z.x, z.y, z.s, false);
        return;
      }
      var dx = p.x - p.x0, dy = p.y - p.y0;
      if (gesto.tipo === 'novo') {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        gesto.tipo = z.s > 1.01 ? 'mover' : Math.abs(dx) > Math.abs(dy) ? 'lado' : dy > 0 ? 'baixo' : 'nada';
      }
      if (gesto.tipo === 'mover') { z.x = gesto.zx + dx; z.y = gesto.zy + dy; limita(); aplica(el, z.x, z.y, z.s, false); }
      else if (gesto.tipo === 'lado') {
        var pode = dx < 0 ? o.temProx() : o.temAnt();
        aplica(el, pode ? dx : dx / 4, 0, 1, false);   // sem outra foto daquele lado: só estica um pouco
      } else if (gesto.tipo === 'baixo') {
        aplica(el, dx / 3, Math.max(0, dy), 1, false);
        fundo(Math.max(0.25, 1 - dy / 500), false);
      }
      if (gesto.tipo !== 'nada' && e.cancelable) e.preventDefault();
    }
    function onUp(e) {
      var p = pts[e.pointerId];
      if (!p) return;
      delete pts[e.pointerId];
      n = Object.keys(pts).length;
      var g = gesto, el = img();
      if (g && g.tipo === 'pinca') {
        if (n === 1) { var r = pts[Object.keys(pts)[0]]; r.x0 = r.x; r.y0 = r.y; gesto = { tipo: 'mover', zx: z.x, zy: z.y }; }
        else if (!n) { gesto = null; if (z.s < 1.05) zerar(true); }
        return;
      }
      if (n) return;
      gesto = null;
      var dx = p.x - p.x0, dy = p.y - p.y0, dt = Math.max(1, Date.now() - p.t0), w = caixa.clientWidth || 360;
      if (!g || g.tipo === 'novo') {
        // toque: dois seguidos no mesmo lugar ampliam (ou voltam)
        var agora = Date.now();
        if (ultimoToque && agora - ultimoToque.t < 320 && Math.hypot(p.x - ultimoToque.x, p.y - ultimoToque.y) < 30) {
          ultimoToque = null;
          if (z.s > 1.01) zerar(true);
          else { var c = rel(p.x, p.y); z.s = 2.5; z.x = -c.x * 1.5; z.y = -c.y * 1.5; limita(); aplica(el, z.x, z.y, z.s, true); }
        } else ultimoToque = { t: agora, x: p.x, y: p.y };
        return;
      }
      if (g.tipo === 'lado') {
        var rapido = Math.abs(dx) / dt > 0.5 && Math.abs(dx) > 30;
        if ((Math.abs(dx) > w / 4 || rapido) && (dx < 0 ? o.temProx() : o.temAnt())) troca(dx < 0 ? 1 : -1);
        else aplica(el, 0, 0, 1, true);
      } else if (g.tipo === 'baixo') {
        if (dy > 120 || (dy > 40 && dy / dt > 0.5)) { fundo(null, false); o.fechar(); }
        else { aplica(el, 0, 0, 1, true); fundo(null, true); }
      }
    }
    // o sistema interrompeu o toque (gesto de voltar, ligação, girar): não troca nem fecha; a foto volta ao lugar
    function onCancel(e) {
      if (!pts[e.pointerId]) return;
      delete pts[e.pointerId];
      n = Object.keys(pts).length;
      if (n) return;
      var g = gesto; gesto = null;
      if (g && (g.tipo === 'lado' || g.tipo === 'baixo')) { aplica(img(), z.x, z.y, z.s, true); fundo(null, true); }
    }
    if (!o.area) caixa.style.touchAction = 'none';   // com área, quem chama põe touch-action:none nela
    caixa.addEventListener('pointerdown', onDown);
    caixa.addEventListener('pointermove', onMove);
    caixa.addEventListener('pointerup', onUp);
    caixa.addEventListener('pointercancel', onCancel);
    // o navegador não arrasta a imagem como arquivo
    caixa.addEventListener('dragstart', function (e) { e.preventDefault(); });
    return {
      zerar: function () { zerar(false); },
      solta: function () {
        caixa.removeEventListener('pointerdown', onDown); caixa.removeEventListener('pointermove', onMove);
        caixa.removeEventListener('pointerup', onUp); caixa.removeEventListener('pointercancel', onCancel);
      }
    };
  };
})();
