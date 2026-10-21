/*
 * Mapa do trecho pelo SNV do DNIT: eixo da BR-230/PA, km inicial e final de cada ponto crítico,
 * ida a um km qualquer, arquivo KML e, onde o navegador libera a localização, o veículo ao vivo
 * e a rota até um ponto dentro do próprio app (com voz), seguindo a rodovia mesmo sem internet.
 * Usado pelo site local (index.html) e embutido na página online (build.js troca o marcador).
 * Precisa do Leaflet (window.L) e dos dados do SNV (window.SNV_BR230, arquivo snv-br230.js).
 *
 *   var m = MapaSNV({ host, snv, getContract, pointInfo, saveText, tiles, gps, notify, nomes });
 *   m.show(); m.render(); m.openFull(); m.closeFull(); m.isFull(); m.exportKml();
 * nomes: funções de nome do contrato do app.js; sem elas (página online), vale a cópia curta daqui.
 */
(function () {
  'use strict';

  var LEAFLET_CSS = ".leaflet-pane, .leaflet-tile, .leaflet-marker-icon, .leaflet-marker-shadow, .leaflet-tile-container, .leaflet-pane > svg, .leaflet-pane > canvas, .leaflet-zoom-box, .leaflet-image-layer, .leaflet-layer{position: absolute;left: 0;top: 0;} .leaflet-container{overflow: hidden;} .leaflet-tile, .leaflet-marker-icon, .leaflet-marker-shadow{-webkit-user-select: none;-moz-user-select: none;user-select: none;-webkit-user-drag: none;} .leaflet-tile::selection{background: transparent;} .leaflet-safari .leaflet-tile{image-rendering: -webkit-optimize-contrast;} .leaflet-safari .leaflet-tile-container{width: 1600px;height: 1600px;-webkit-transform-origin: 0 0;} .leaflet-marker-icon, .leaflet-marker-shadow{display: block;} .leaflet-container .leaflet-overlay-pane svg{max-width: none !important;max-height: none !important;} .leaflet-container .leaflet-marker-pane img, .leaflet-container .leaflet-shadow-pane img, .leaflet-container .leaflet-tile-pane img, .leaflet-container img.leaflet-image-layer, .leaflet-container .leaflet-tile{max-width: none !important;max-height: none !important;width: auto;padding: 0;} .leaflet-container img.leaflet-tile{mix-blend-mode: plus-lighter;} .leaflet-container.leaflet-touch-zoom{-ms-touch-action: pan-x pan-y;touch-action: pan-x pan-y;} .leaflet-container.leaflet-touch-drag{-ms-touch-action: pinch-zoom;touch-action: none;touch-action: pinch-zoom;} .leaflet-container.leaflet-touch-drag.leaflet-touch-zoom{-ms-touch-action: none;touch-action: none;} .leaflet-container{-webkit-tap-highlight-color: transparent;} .leaflet-container a{-webkit-tap-highlight-color: rgba(51, 181, 229, 0.4);} .leaflet-tile{filter: inherit;visibility: hidden;} .leaflet-tile-loaded{visibility: inherit;} .leaflet-zoom-box{width: 0;height: 0;-moz-box-sizing: border-box;box-sizing: border-box;z-index: 800;} .leaflet-overlay-pane svg{-moz-user-select: none;} .leaflet-pane{z-index: 400;} .leaflet-tile-pane{z-index: 200;} .leaflet-overlay-pane{z-index: 400;} .leaflet-shadow-pane{z-index: 500;} .leaflet-marker-pane{z-index: 600;} .leaflet-tooltip-pane{z-index: 650;} .leaflet-popup-pane{z-index: 700;} .leaflet-map-pane canvas{z-index: 100;} .leaflet-map-pane svg{z-index: 200;} .leaflet-vml-shape{width: 1px;height: 1px;} .lvml{display: inline-block;position: absolute;} .leaflet-control{position: relative;z-index: 800;pointer-events: visiblePainted;pointer-events: auto;} .leaflet-top, .leaflet-bottom{position: absolute;z-index: 1000;pointer-events: none;} .leaflet-top{top: 0;} .leaflet-right{right: 0;} .leaflet-bottom{bottom: 0;} .leaflet-left{left: 0;} .leaflet-control{float: left;clear: both;} .leaflet-right .leaflet-control{float: right;} .leaflet-top .leaflet-control{margin-top: 10px;} .leaflet-bottom .leaflet-control{margin-bottom: 10px;} .leaflet-left .leaflet-control{margin-left: 10px;} .leaflet-right .leaflet-control{margin-right: 10px;} .leaflet-fade-anim .leaflet-popup{opacity: 0;-webkit-transition: opacity 0.2s linear;-moz-transition: opacity 0.2s linear;transition: opacity 0.2s linear;} .leaflet-fade-anim .leaflet-map-pane .leaflet-popup{opacity: 1;} .leaflet-zoom-animated{-webkit-transform-origin: 0 0;-ms-transform-origin: 0 0;transform-origin: 0 0;} svg.leaflet-zoom-animated{will-change: transform;} .leaflet-zoom-anim .leaflet-zoom-animated{-webkit-transition: -webkit-transform 0.25s cubic-bezier(0,0,0.25,1);-moz-transition: -moz-transform 0.25s cubic-bezier(0,0,0.25,1);transition: transform 0.25s cubic-bezier(0,0,0.25,1);} .leaflet-zoom-anim .leaflet-tile, .leaflet-pan-anim .leaflet-tile{-webkit-transition: none;-moz-transition: none;transition: none;} .leaflet-zoom-anim .leaflet-zoom-hide{visibility: hidden;} .leaflet-interactive{cursor: pointer;} .leaflet-grab{cursor: -webkit-grab;cursor: -moz-grab;cursor: grab;} .leaflet-crosshair, .leaflet-crosshair .leaflet-interactive{cursor: crosshair;} .leaflet-popup-pane, .leaflet-control{cursor: auto;} .leaflet-dragging .leaflet-grab, .leaflet-dragging .leaflet-grab .leaflet-interactive, .leaflet-dragging .leaflet-marker-draggable{cursor: move;cursor: -webkit-grabbing;cursor: -moz-grabbing;cursor: grabbing;} .leaflet-marker-icon, .leaflet-marker-shadow, .leaflet-image-layer, .leaflet-pane > svg path, .leaflet-tile-container{pointer-events: none;} .leaflet-marker-icon.leaflet-interactive, .leaflet-image-layer.leaflet-interactive, .leaflet-pane > svg path.leaflet-interactive, svg.leaflet-image-layer.leaflet-interactive path{pointer-events: visiblePainted;pointer-events: auto;} .leaflet-container{background: #ddd;outline-offset: 1px;} .leaflet-container a{color: #0078A8;} .leaflet-zoom-box{border: 2px dotted #38f;background: rgba(255,255,255,0.5);} .leaflet-container{font-family: \"Helvetica Neue\", Arial, Helvetica, sans-serif;font-size: 12px;font-size: 0.75rem;line-height: 1.5;} .leaflet-bar{box-shadow: 0 1px 5px rgba(0,0,0,0.65);border-radius: 4px;} .leaflet-bar a{background-color: #fff;border-bottom: 1px solid #ccc;width: 26px;height: 26px;line-height: 26px;display: block;text-align: center;text-decoration: none;color: black;} .leaflet-bar a, .leaflet-control-layers-toggle{background-position: 50% 50%;background-repeat: no-repeat;display: block;} .leaflet-bar a:hover, .leaflet-bar a:focus{background-color: #f4f4f4;} .leaflet-bar a:first-child{border-top-left-radius: 4px;border-top-right-radius: 4px;} .leaflet-bar a:last-child{border-bottom-left-radius: 4px;border-bottom-right-radius: 4px;border-bottom: none;} .leaflet-bar a.leaflet-disabled{cursor: default;background-color: #f4f4f4;color: #bbb;} .leaflet-touch .leaflet-bar a{width: 30px;height: 30px;line-height: 30px;} .leaflet-touch .leaflet-bar a:first-child{border-top-left-radius: 2px;border-top-right-radius: 2px;} .leaflet-touch .leaflet-bar a:last-child{border-bottom-left-radius: 2px;border-bottom-right-radius: 2px;} .leaflet-control-zoom-in, .leaflet-control-zoom-out{font: bold 18px 'Lucida Console', Monaco, monospace;text-indent: 1px;} .leaflet-touch .leaflet-control-zoom-in, .leaflet-touch .leaflet-control-zoom-out{font-size: 22px;} .leaflet-control-layers{box-shadow: 0 1px 5px rgba(0,0,0,0.4);background: #fff;border-radius: 5px;} .leaflet-control-layers-toggle{width: 36px;height: 36px;} .leaflet-retina .leaflet-control-layers-toggle{background-size: 26px 26px;} .leaflet-touch .leaflet-control-layers-toggle{width: 44px;height: 44px;} .leaflet-control-layers .leaflet-control-layers-list, .leaflet-control-layers-expanded .leaflet-control-layers-toggle{display: none;} .leaflet-control-layers-expanded .leaflet-control-layers-list{display: block;position: relative;} .leaflet-control-layers-expanded{padding: 6px 10px 6px 6px;color: #333;background: #fff;} .leaflet-control-layers-scrollbar{overflow-y: scroll;overflow-x: hidden;padding-right: 5px;} .leaflet-control-layers-selector{margin-top: 2px;position: relative;top: 1px;} .leaflet-control-layers label{display: block;font-size: 13px;font-size: 1.08333em;} .leaflet-control-layers-separator{height: 0;border-top: 1px solid #ddd;margin: 5px -10px 5px -6px;} .leaflet-default-icon-path{} .leaflet-container .leaflet-control-attribution{background: #fff;background: rgba(255, 255, 255, 0.8);margin: 0;} .leaflet-control-attribution, .leaflet-control-scale-line{padding: 0 5px;color: #333;line-height: 1.4;} .leaflet-control-attribution a{text-decoration: none;} .leaflet-control-attribution a:hover, .leaflet-control-attribution a:focus{text-decoration: underline;} .leaflet-attribution-flag{display: inline !important;vertical-align: baseline !important;width: 1em;height: 0.6669em;} .leaflet-left .leaflet-control-scale{margin-left: 5px;} .leaflet-bottom .leaflet-control-scale{margin-bottom: 5px;} .leaflet-control-scale-line{border: 2px solid #777;border-top: none;line-height: 1.1;padding: 2px 5px 1px;white-space: nowrap;-moz-box-sizing: border-box;box-sizing: border-box;background: rgba(255, 255, 255, 0.8);text-shadow: 1px 1px #fff;} .leaflet-control-scale-line:not(:first-child){border-top: 2px solid #777;border-bottom: none;margin-top: -2px;} .leaflet-control-scale-line:not(:first-child):not(:last-child){border-bottom: 2px solid #777;} .leaflet-touch .leaflet-control-attribution, .leaflet-touch .leaflet-control-layers, .leaflet-touch .leaflet-bar{box-shadow: none;} .leaflet-touch .leaflet-control-layers, .leaflet-touch .leaflet-bar{border: 2px solid rgba(0,0,0,0.2);background-clip: padding-box;} .leaflet-popup{position: absolute;text-align: center;margin-bottom: 20px;} .leaflet-popup-content-wrapper{padding: 1px;text-align: left;border-radius: 12px;} .leaflet-popup-content{margin: 13px 24px 13px 20px;line-height: 1.3;font-size: 13px;font-size: 1.08333em;min-height: 1px;} .leaflet-popup-content p{margin: 17px 0;margin: 1.3em 0;} .leaflet-popup-tip-container{width: 40px;height: 20px;position: absolute;left: 50%;margin-top: -1px;margin-left: -20px;overflow: hidden;pointer-events: none;} .leaflet-popup-tip{width: 17px;height: 17px;padding: 1px;margin: -10px auto 0;pointer-events: auto;-webkit-transform: rotate(45deg);-moz-transform: rotate(45deg);-ms-transform: rotate(45deg);transform: rotate(45deg);} .leaflet-popup-content-wrapper, .leaflet-popup-tip{background: white;color: #333;box-shadow: 0 3px 14px rgba(0,0,0,0.4);} .leaflet-container a.leaflet-popup-close-button{position: absolute;top: 0;right: 0;border: none;text-align: center;width: 24px;height: 24px;font: 16px/24px Tahoma, Verdana, sans-serif;color: #757575;text-decoration: none;background: transparent;} .leaflet-container a.leaflet-popup-close-button:hover, .leaflet-container a.leaflet-popup-close-button:focus{color: #585858;} .leaflet-popup-scrolled{overflow: auto;} .leaflet-oldie .leaflet-popup-content-wrapper{-ms-zoom: 1;} .leaflet-oldie .leaflet-popup-tip{width: 24px;margin: 0 auto;-ms-filter: \"progid:DXImageTransform.Microsoft.Matrix(M11=0.70710678, M12=0.70710678, M21=-0.70710678, M22=0.70710678)\";filter: progid:DXImageTransform.Microsoft.Matrix(M11=0.70710678, M12=0.70710678, M21=-0.70710678, M22=0.70710678);} .leaflet-oldie .leaflet-control-zoom, .leaflet-oldie .leaflet-control-layers, .leaflet-oldie .leaflet-popup-content-wrapper, .leaflet-oldie .leaflet-popup-tip{border: 1px solid #999;} .leaflet-div-icon{background: #fff;border: 1px solid #666;} .leaflet-tooltip{position: absolute;padding: 6px;background-color: #fff;border: 1px solid #fff;border-radius: 3px;color: #222;white-space: nowrap;-webkit-user-select: none;-moz-user-select: none;-ms-user-select: none;user-select: none;pointer-events: none;box-shadow: 0 1px 3px rgba(0,0,0,0.4);} .leaflet-tooltip.leaflet-interactive{cursor: pointer;pointer-events: auto;} .leaflet-tooltip-top:before, .leaflet-tooltip-bottom:before, .leaflet-tooltip-left:before, .leaflet-tooltip-right:before{position: absolute;pointer-events: none;border: 6px solid transparent;background: transparent;content: \"\";} .leaflet-tooltip-bottom{margin-top: 6px;} .leaflet-tooltip-top{margin-top: -6px;} .leaflet-tooltip-bottom:before, .leaflet-tooltip-top:before{left: 50%;margin-left: -6px;} .leaflet-tooltip-top:before{bottom: 0;margin-bottom: -12px;border-top-color: #fff;} .leaflet-tooltip-bottom:before{top: 0;margin-top: -12px;margin-left: -6px;border-bottom-color: #fff;} .leaflet-tooltip-left{margin-left: -6px;} .leaflet-tooltip-right{margin-left: 6px;} .leaflet-tooltip-left:before, .leaflet-tooltip-right:before{top: 50%;margin-top: -6px;} .leaflet-tooltip-left:before{right: 0;margin-right: -12px;border-left-color: #fff;} .leaflet-tooltip-right:before{left: 0;margin-left: -12px;border-right-color: #fff;} @media print{.leaflet-control{-webkit-print-color-adjust: exact;print-color-adjust: exact;}}";
  var R = 6371008.8;
  var BASE_KEY = 'diagrama-linear.mapa-fundo';
  var BASES = {
    mapa: { name: 'Mapa', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', opt: { maxZoom: 19, maxNativeZoom: 19, attribution: '© colaboradores do OpenStreetMap' } },
    satelite: { name: 'Satélite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', opt: { maxZoom: 19, maxNativeZoom: 17, attribution: 'Imagens © Esri, Maxar, Earthstar Geographics' } },
    offline: { name: 'Offline' }
  };

  // ------------------------------------------------------------------ mapa offline (OpenStreetMap embutido)
  // Linhas em "encoded polyline" (precisão 1e-5), geradas por online/osm_build.py.
  function decodePl(s) {
    var pts = [], i = 0, lat = 0, lon = 0, b, sh, r;
    while (i < s.length) {
      sh = 0; r = 0;
      do { b = s.charCodeAt(i++) - 63; r |= (b & 31) << sh; sh += 5; } while (b >= 32);
      lat += (r & 1) ? ~(r >> 1) : (r >> 1);
      sh = 0; r = 0;
      do { b = s.charCodeAt(i++) - 63; r |= (b & 31) << sh; sh += 5; } while (b >= 32);
      lon += (r & 1) ? ~(r >> 1) : (r >> 1);
      pts.push([lat / 1e5, lon / 1e5]);
    }
    return pts;
  }
  var OFF_STYLE = {
    agua: { color: '#7FB3D5', weight: 1, fillColor: '#AAD3DF', fillOpacity: 1 },
    rio: { color: '#4F8FCB', weight: 2.6 },
    corrego: { color: '#6FA6DA', weight: 1.4 },
    tronco: { color: '#D98A1F', weight: 4.5 },
    principal: { color: '#E0A93A', weight: 3.2 },
    vicinal: { color: '#8F8169', weight: 1.8 },
    rua: { color: '#A39B8B', weight: 1.2 },
    trilha: { color: '#9E937C', weight: 1.2, dashArray: '4 3' }
  };
  // zoom mínimo de cada camada e a ordem de desenho (de baixo para cima)
  var OFF_ORDER = ['agua', 'corrego', 'rio', 'trilha', 'rua', 'vicinal', 'principal', 'tronco', 'nigarape', 'nrio', 'vila', 'cidade'];
  var OFF_MINZ = { agua: 9, corrego: 10, rio: 7, trilha: 12, rua: 12, vicinal: 9, principal: 8, tronco: 6, nigarape: 12, nrio: 11, vila: 10, cidade: 7 };

  // ------------------------------------------------------------------ km SNV <-> coordenada
  // Cada vértice traz [lon, lat, km]. Dentro de um segmento do SNV o km cresce na proporção do comprimento.
  function Ref(snv) {
    var L = snv.linha, kmMin = L[0][2], kmMax = L[L.length - 1][2];
    function idxAt(km) {
      if (km <= kmMin) return 0;
      if (km >= kmMax) return L.length - 2;
      var lo = 0, hi = L.length - 1;
      while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (L[mid][2] <= km) lo = mid; else hi = mid; }
      return lo;
    }
    function at(km) {
      km = Math.max(kmMin, Math.min(kmMax, km));
      var i = idxAt(km), a = L[i], b = L[i + 1], t = b[2] === a[2] ? 0 : (km - a[2]) / (b[2] - a[2]);
      return [a[1] + t * (b[1] - a[1]), a[0] + t * (b[0] - a[0])];
    }
    function slice(k1, k2) {
      if (k1 > k2) { var t = k1; k1 = k2; k2 = t; }
      k1 = Math.max(kmMin, k1); k2 = Math.min(kmMax, k2);
      var out = [at(k1)];
      for (var i = idxAt(k1) + 1; i < L.length && L[i][2] < k2; i++) out.push([L[i][1], L[i][0]]);
      out.push(at(k2));
      return out;
    }
    // ponto mais próximo do eixo: km, distância lateral (m) e lado (LE/LD no sentido crescente do km)
    function locate(lat, lon) {
      var k = Math.cos(lat * Math.PI / 180), f = Math.PI / 180 * R, best = null;
      for (var i = 0; i < L.length - 1; i++) {
        var ax = (L[i][0] - lon) * f * k, ay = (L[i][1] - lat) * f, bx = (L[i + 1][0] - lon) * f * k, by = (L[i + 1][1] - lat) * f;
        var dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy, t = len2 ? -(ax * dx + ay * dy) / len2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        var x = ax + t * dx, y = ay + t * dy, d = Math.sqrt(x * x + y * y);
        if (!best || d < best.dist) best = { dist: d, km: L[i][2] + t * (L[i + 1][2] - L[i][2]), side: (dx * -ay - dy * -ax) > 0 ? 'LE' : 'LD' };
      }
      return best;
    }
    return { at: at, slice: slice, locate: locate, kmMin: kmMin, kmMax: kmMax };
  }

  // ------------------------------------------------------------------ formatação
  function nf(n, d) { return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function km2(n) { return nf(n, 2); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  // coordenada no padrão do carimbo do DNIT: -03,85958/-54,05959
  function coordDnit(ll) {
    function f(v) { var s = Math.abs(v).toFixed(5).replace('.', ','); if (s.indexOf(',') < 2) s = '0' + s; return (v < 0 ? '-' : '') + s; }
    return f(ll[0]) + '/' + f(ll[1]);
  }
  function stamp(rodovia, loc) {
    var s = rodovia.replace('BR-', 'BR ') + ' - ' + km2(loc.km);
    if (loc.dist >= 10) s += ' - ' + loc.side + ' - DL: ' + Math.round(loc.dist) + ' m';
    return s;
  }
  function parseKm(v) {
    var t = String(v || '').trim().replace(/\s/g, '').replace(/^km/i, '');
    if (!t) return null;
    if (t.indexOf(',') >= 0) t = t.replace(/\./g, '').replace(',', '.');
    var n = Number(t);
    return isFinite(n) ? n : null;
  }
  function routeUrl(ll) { return 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=' + ll[0].toFixed(6) + ',' + ll[1].toFixed(6); }
  function placeUrl(ll) { return 'https://www.google.com/maps/search/?api=1&query=' + ll[0].toFixed(6) + ',' + ll[1].toFixed(6); }
  function reduced() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sem armazenamento */ } }

  // ------------------------------------------------------------------ estilo
  var CSS = [
    '.mp{--mp-bg:var(--panel-2,var(--ground,#F1F3F1));--mp-panel:var(--panel,#FFFFFF);--mp-ink:var(--ink,#17201C);--mp-ink-2:var(--ink-2,#3B4540);--mp-ink-3:var(--ink-3,#5C6661);--mp-line:var(--line,#D5DAD6);--mp-accent:var(--accent,#1D4F91);--mp-accent-ink:var(--accent-ink,#FFFFFF);--mp-road:var(--ink,#17201C);--mp-road-case:var(--panel,#FFFFFF);--mp-ctx:var(--ink-3,#5C6661);',
    '  position:relative;height:100%;min-height:360px;border:1px solid var(--mp-line);border-radius:8px;overflow:hidden;background:var(--mp-bg);color:var(--mp-ink);font-size:13px;isolation:isolate}',
    '.mp-map{position:absolute;inset:0;background:var(--mp-bg);font:inherit}',
    '.mp .leaflet-container{background:var(--mp-bg);font:inherit;outline:0}',
    '.mp.sat{--mp-road:#FFE27A;--mp-road-case:#1B1B1B;--mp-ctx:#E8E8E8}',
    '.mp.osm{--mp-road:#17201C;--mp-road-case:#FFFFFF;--mp-ctx:#5C6661}',
    '.mp-road{stroke:var(--mp-road)}.mp-road-case{stroke:var(--mp-road-case)}.mp-ctx{stroke:var(--mp-ctx);stroke-dasharray:6 6}',
    '.mp-km{stroke:var(--mp-road-case);fill:var(--mp-road)}',
    '.mp-top{position:absolute;z-index:1001;left:10px;right:10px;top:10px;display:flex;align-items:flex-start;justify-content:space-between;gap:8px;pointer-events:none}',
    '.mp-top>*{pointer-events:auto}',
    '.mp [hidden]{display:none!important}',
    /* as colunas não seguram o toque nos vãos (no iPhone tapavam o X do popup) */
    '.mp-top>.mp-left,.mp-top>.mp-tools{pointer-events:none}.mp-left>*,.mp-tools>*{pointer-events:auto}',
    '.mp-left{display:flex;flex-direction:column;gap:6px;min-width:0;max-width:min(380px,100%)}',
    '.mp-title{background:var(--mp-panel);border:1px solid var(--mp-line);border-radius:8px;padding:6px 10px;box-shadow:0 1px 3px rgba(0,0,0,.12);min-width:0}',
    '.mp-title b{display:block;font-size:13px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.mp-title span{display:block;font-size:11.5px;color:var(--mp-ink-3);font-variant-numeric:tabular-nums}',
    '.mp-find{display:flex;gap:4px;align-items:center;background:var(--mp-panel);border:1px solid var(--mp-line);border-radius:8px;padding:4px;box-shadow:0 1px 3px rgba(0,0,0,.12);width:max-content;max-width:100%}',
    '.mp-find label{font-size:12px;font-weight:600;color:var(--mp-ink-2);padding:0 4px 0 6px;white-space:nowrap}',
    '.mp-find input{width:96px;min-height:30px;border:1px solid var(--mp-line);border-radius:6px;padding:2px 8px;background:var(--mp-panel);color:var(--mp-ink);font:inherit;font-variant-numeric:tabular-nums}',
    '.mp-tools{display:flex;flex-direction:column;gap:6px;align-items:flex-end}',
    '.mp-btn{display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:5px 10px;border:1px solid var(--mp-line);border-radius:8px;background:var(--mp-panel);color:var(--mp-ink);font:inherit;font-size:12.5px;font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,.12);cursor:pointer;white-space:nowrap}',
    '.mp-btn:hover{border-color:var(--mp-ink-3)}',
    '.mp-btn[aria-pressed="true"]{background:var(--mp-accent);border-color:var(--mp-accent);color:var(--mp-accent-ink)}',
    '.mp-btn svg{width:16px;height:16px;flex:none}',
    '.mp-btn:focus-visible,.mp-chip:focus-visible,.mp-find input:focus-visible{outline:2px solid var(--mp-accent);outline-offset:2px}',
    /* fundo do mapa: um botão só; as opções abrem ao lado e fecham ao escolher */
    '.mp-layers{position:relative}',
    '.mp-bases{position:absolute;right:calc(100% + 6px);top:0;display:flex;flex-direction:column;min-width:150px;background:var(--mp-panel);border:1px solid var(--mp-line);border-radius:10px;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,.22)}',
    '.mp-bases .mp-btn{width:100%;justify-content:flex-start;border:0;border-radius:0;box-shadow:none;min-height:44px;padding:6px 12px;font-size:13.5px}',
    '.mp-bases .mp-btn+.mp-btn{border-top:1px solid var(--mp-line)}',
    '.mp-bases .mp-btn[aria-pressed="true"]{background:var(--mp-accent);color:var(--mp-accent-ink)}',
    '.mp-bottom{position:absolute;z-index:1001;left:10px;right:10px;bottom:22px;display:flex;flex-direction:column;gap:6px;pointer-events:none}',
    '.mp-bottom>*{pointer-events:auto}',
    '.mp-chips{display:flex;gap:6px;overflow-x:auto;padding:2px 2px 4px;scrollbar-width:thin;max-width:100%}',
    '.mp-chip{display:inline-flex;align-items:center;gap:6px;flex:none;min-height:32px;padding:4px 10px 4px 8px;border:1px solid var(--mp-line);border-radius:999px;background:var(--mp-panel);color:var(--mp-ink);font:inherit;font-size:12.5px;font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,.12);cursor:pointer;font-variant-numeric:tabular-nums}',
    '.mp-chip i{width:10px;height:10px;border-radius:50%;background:var(--c);flex:none;box-shadow:0 0 0 2px var(--mp-panel),0 0 0 3px var(--c)}',
    '.mp-chip small{font-weight:500;color:var(--mp-ink-3)}',
    '.mp-card{background:var(--mp-panel);border:1px solid var(--mp-line);border-radius:10px;padding:10px 12px;box-shadow:0 2px 10px rgba(0,0,0,.18);max-width:420px}',
    '.mp-stamp{font-family:var(--font-mono,ui-monospace,Consolas,monospace);font-size:15px;font-weight:600;letter-spacing:.01em;font-variant-numeric:tabular-nums}',
    '.mp-sub{font-size:12px;color:var(--mp-ink-3);font-variant-numeric:tabular-nums}',
    '.mp-next{font-size:13px;font-weight:600;margin-top:4px}',
    '.mp-card .mp-row{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}',
    '.mp-card p{margin:0 0 6px;font-size:12.5px;color:var(--mp-ink-2);line-height:1.45}',
    '.mp-card a{color:var(--mp-accent);font-weight:600}',
    '.mp-err{color:var(--danger,#B42318);font-weight:600}',
    '.mp-legend{display:flex;flex-wrap:wrap;gap:4px 10px;font-size:11.5px;color:var(--mp-ink-2);background:var(--mp-panel);border:1px solid var(--mp-line);border-radius:8px;padding:4px 8px;width:max-content;max-width:100%;box-shadow:0 1px 3px rgba(0,0,0,.12)}',
    '.mp-legend span{display:inline-flex;align-items:center;gap:5px}',
    '.mp-legend i{width:16px;height:5px;border-radius:3px;background:var(--c)}',
    '.mp .leaflet-tooltip.mp-lbl{background:var(--mp-panel);color:var(--mp-ink);border:1px solid var(--mp-line);border-radius:5px;padding:1px 6px;font:inherit;font-size:11.5px;font-weight:650;box-shadow:0 1px 2px rgba(0,0,0,.15);font-variant-numeric:tabular-nums}',
    '.mp .leaflet-tooltip.mp-lbl:before{display:none}',
    '.mp .leaflet-tooltip.mp-kml{background:transparent;border:0;box-shadow:none;color:var(--mp-ink-2);font-size:10.5px;font-weight:650;padding:0;text-shadow:0 0 3px var(--mp-panel),0 0 3px var(--mp-panel),0 0 2px var(--mp-panel)}',
    '.mp.sat .leaflet-tooltip.mp-kml{color:#FFFFFF;text-shadow:0 0 3px #000,0 0 3px #000}',
    '.mp .leaflet-tooltip.mp-kml:before{display:none}',
    '.mp .leaflet-tooltip.mp-loc{background:var(--mp-ink);color:var(--mp-panel);border:0;border-radius:4px;padding:2px 6px;font:inherit;font-size:10.5px;font-weight:700;letter-spacing:.04em}',
    '.mp .leaflet-tooltip.mp-loc:before{display:none}',
    '.mp-place{background:none;border:0}',
    '.mp-place span,.mp-rio span{position:absolute;left:0;top:0;transform:translate(-50%,-50%);white-space:nowrap;pointer-events:none;text-shadow:0 0 3px #F7F5EE,0 0 3px #F7F5EE,0 0 2px #F7F5EE}',
    '.mp-place span{font-weight:650;color:#3B4540}',
    '.mp-place.cidade span{font-size:14px;font-weight:750;color:#17201C;letter-spacing:.03em;text-transform:uppercase}',
    '.mp-place.vila span{font-size:12px}',
    '.mp-rio span{font-style:italic;font-weight:600;color:#2A67A3}',
    '.mp-rio.nrio span{font-size:12.5px}',
    '.mp-rio.nigarape span{font-size:11px}',
    '.mp .leaflet-popup-content-wrapper{background:var(--mp-panel);color:var(--mp-ink);border-radius:10px}',
    '.mp .leaflet-popup-tip{background:var(--mp-panel)}',
    '.mp .leaflet-popup-content{margin:12px 14px;font:inherit;font-size:13px;line-height:1.4;min-width:220px}',
    /* X do popup com área de toque de 44 px (o padrão de 24 px quase não pega no iPhone) */
    '.mp .leaflet-container a.leaflet-popup-close-button{width:44px;height:44px;font:26px/42px system-ui,-apple-system,sans-serif;color:var(--mp-ink-3);border-radius:0 10px 0 12px;touch-action:manipulation}',
    '.mp .leaflet-container a.leaflet-popup-close-button:active{background:var(--mp-line)}',
    '.mp-pop h3{margin:0 0 6px;padding-right:30px;font-size:15px;display:flex;align-items:center;justify-content:space-between;gap:8px}',
    '.mp-pop .tag{font-size:11px;font-weight:700;color:#FFFFFF;background:var(--c);border-radius:999px;padding:2px 8px;white-space:nowrap}',
    '.mp-pop dl{display:grid;grid-template-columns:repeat(3,auto);gap:2px 14px;margin:0 0 8px}',
    '.mp-pop dt{font-size:11px;color:var(--mp-ink-3)}',
    '.mp-pop dd{margin:0;font-weight:650;font-variant-numeric:tabular-nums}',
    '.mp-pop .co{font-family:var(--font-mono,ui-monospace,Consolas,monospace);font-size:12px;color:var(--mp-ink-2);margin:0 0 8px;user-select:all}',
    '.mp-pop ul{list-style:none;margin:0 0 8px;padding:0;display:grid;gap:2px}',
    '.mp-pop li{display:flex;justify-content:space-between;gap:10px;font-size:12px}',
    '.mp-pop li b{color:var(--c)}',
    '.mp-pop .links{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center}',
    '.mp-pop .links a{color:var(--mp-accent);font-weight:650}',
    '.mp-pop .rotas{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}',
    '.mp-pop .rotas .mp-btn{flex:1 1 auto;justify-content:center;min-height:40px;box-shadow:none;background:var(--mp-accent);border-color:var(--mp-accent);color:var(--mp-accent-ink)}',
    '.mp-pop .mp-pop-foto{margin-top:10px;width:100%;justify-content:center;box-shadow:none}',
    '.mp-pop .mp-pop-abrir{margin-top:8px;width:100%;justify-content:center;box-shadow:none;background:var(--mp-accent);border-color:var(--mp-accent);color:var(--mp-accent-ink);font-weight:600}',
    '.mp .leaflet-control-attribution{background:rgba(255,255,255,.8);color:#333;font-size:10px}',
    '.mp .leaflet-control-attribution a{color:#1D4F91}',
    '.mp .leaflet-bar a{background:var(--mp-panel);color:var(--mp-ink);border-color:var(--mp-line)}',
    '.mp .leaflet-bottom.leaflet-right{margin-bottom:58px}',
    '@media (pointer:coarse){.mp .leaflet-control-zoom{display:none}}',
    '.mp .leaflet-control-scale-line{background:rgba(255,255,255,.75);color:#222;border-color:#333}',
    '.mp-car{width:34px;height:34px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.45))}',
    /* navegação: instrução em cima, distância e chegada embaixo (como no Google Maps) */
    '.mp-navtop{flex:1 1 auto;min-width:0;max-width:560px;display:flex;align-items:center;gap:12px;background:#0E6B47;color:#FFFFFF;border-radius:12px;padding:10px 14px;box-shadow:0 4px 14px rgba(0,0,0,.3)}',
    '.mp-navtop svg{width:42px;height:42px;flex:none}',
    '.mp-nav-txt{min-width:0}',
    '.mp-nav-txt b{display:block;font-size:24px;line-height:1.1;font-variant-numeric:tabular-nums}',
    '.mp-nav-txt span{display:block;font-size:15.5px;font-weight:650;line-height:1.25}',
    '.mp-nav-txt small{display:block;font-size:12.5px;line-height:1.3;opacity:.88;margin-top:2px}',
    '.mp-navbot b{display:block;font-size:19px;font-variant-numeric:tabular-nums}',
    '.mp-navbot small{display:block;font-size:12.5px;color:var(--mp-ink-3);font-variant-numeric:tabular-nums}',
    '.mp-btn.mp-fim{background:#B42318;border-color:#B42318;color:#FFFFFF}',
    '.mp-navon .mp-left,.mp-navon .mp-chips,.mp-navon .mp-legend,.mp-navon .mp-live{display:none!important}',
    '.mp-alvo{filter:drop-shadow(0 2px 3px rgba(0,0,0,.4))}',
    '.mp-car svg{width:34px;height:34px;transition:transform .4s}',
    '.mp-full{position:fixed;inset:0;z-index:2000;border:0;border-radius:0;min-height:0;height:auto}',
    '.mp-full .mp-top{top:calc(10px + env(safe-area-inset-top,0px));left:calc(10px + env(safe-area-inset-left,0px));right:calc(10px + env(safe-area-inset-right,0px))}',
    '.mp-full .mp-bottom{bottom:calc(22px + env(safe-area-inset-bottom,0px));left:calc(10px + env(safe-area-inset-left,0px));right:calc(10px + env(safe-area-inset-right,0px))}',
    '.mp-full .leaflet-bottom{bottom:env(safe-area-inset-bottom,0px)}',
    '@media (max-width:560px){.mp-btn .t{display:none}.mp-btn{padding:5px 8px}.mp-title b{font-size:12.5px}.mp-legend{display:none}.mp-find label{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}.mp-find input{width:104px}}',
    /* dedo: botões, busca e pontos de baixo com 44 px; o nome do contrato quebra em 2 linhas em vez de cortar. Os pontos de baixo
       descem para a borda e os créditos e a escala sobem para cima deles (sem um cobrir o outro) */
    '@media (pointer:coarse),(max-width:700px){.mp-bottom{bottom:8px}.mp-full .mp-bottom{bottom:calc(8px + env(safe-area-inset-bottom,0px))}.mp .leaflet-bottom.leaflet-right{margin-bottom:62px}.mp-btn{min-height:44px;min-width:44px;justify-content:center}.mp-find input{min-height:44px;font-size:16px}.mp-chip{min-height:44px;padding:4px 14px 4px 10px}.mp-title b{white-space:normal}}',
    /* celular deitado: pouca altura. Fica a tela cheia e um botão que mostra as outras ferramentas; o nome do contrato já está na barra do topo */
    '.mp-mais{display:none}',
    '@media (max-height:500px) and (orientation:landscape) and (max-width:1100px){.mp-mais{display:inline-flex}.mp-tools:not(.abertas)>*:not([data-mp="full"]):not(.mp-mais){display:none}.mp-title,.mp-legend{display:none}}',
    /* navegação parecida com a do Google Maps: o mapa gira na direção do carro (o quadro do mapa fica maior que a tela e gira em
       volta da seta), a seta fica na parte de baixo da área livre; botões redondos à direita; deitado, os painéis vão para a esquerda */
    '.mp .leaflet-control-container{font-size:12px;line-height:1.5}',
    '.mp .leaflet-control-attribution{margin:0}',
    '.mp-map.mp-gira{inset:auto;transition:transform .9s linear;will-change:transform}',
    '.mp-girando .leaflet-tooltip{transform-origin:50% 50%}',
    '.mp-girando .mp-place span{transform:translate(-50%,-50%) rotate(var(--mp-crot,0deg))}',
    '.mp-navcar{width:44px;height:44px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.4))}',
    '.mp-navcar svg{width:44px;height:44px;transition:transform .9s linear}',
    '.mp-navtool{display:none}',
    /* o botão do fundo do mapa (camadas) fica sempre, com e sem navegação */
    '.mp.mp-navon .mp-tools>*:not(.mp-navtool):not([data-mp="full"]):not(.mp-layers){display:none!important}',
    '.mp.mp-navon .mp-tools>.mp-navtool{display:inline-flex!important}',
    '.mp.mp-navon .mp-tools>.mp-layers{display:block!important}',
    '.mp-navon .mp-tools>.mp-btn,.mp-navon .mp-tools>.mp-layers>.mp-btn{width:50px;height:50px;min-width:50px;min-height:50px;padding:0;border-radius:50%;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.25)}',
    '.mp-navon .mp-tools>.mp-btn svg,.mp-navon .mp-tools>.mp-layers>.mp-btn svg{width:22px;height:22px}',
    '.mp-navon .mp-tools>.mp-btn .t,.mp-navon .mp-tools>.mp-layers>.mp-btn .t{display:none}',
    '.mp-navon .mp-tools>[data-mp="nav-voz"]{background:var(--mp-panel);border-color:var(--mp-line);color:var(--mp-ink)}',
    '.mp-navon .mp-tools>[data-mp="nav-voz"][aria-pressed="false"]{color:#B42318}',
    '.mp-navon .mp-tools>[data-mp="nav-norte"] svg{transition:transform .9s linear}',
    '.mp-navtop{padding:8px 14px 8px 10px}',
    '.mp-navtop svg{width:38px;height:38px}',
    '.mp-navbot{max-width:460px;padding:12px 14px}',
    '.mp-nb{display:flex;align-items:center;gap:12px}',
    '.mp-nb-t{flex:1 1 auto;min-width:0}',
    '.mp-navbot .mp-nb-t b{font-size:24px;line-height:1.15;color:#0E7A43}',
    '.mp-navbot .mp-nb-t small{font-size:14.5px;color:var(--mp-ink-2);margin-top:1px}',
    '.mp-nb .mp-fim{min-height:48px;padding:0 22px;border-radius:999px;font-size:16px}',
    '.mp-navbot .mp-nb-x{display:block;margin-top:6px;font-size:12px;color:var(--mp-ink-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.mp-centro{align-self:flex-start;min-height:46px;padding:0 18px;border-radius:999px;font-size:15px;color:var(--mp-accent);box-shadow:0 2px 8px rgba(0,0,0,.25)}',
    '.mp-centro svg{width:18px;height:18px}',
    '.mp.mp-navon:not(.mp-lado) .leaflet-bottom.leaflet-right{margin-bottom:calc(var(--mp-nb-h,120px) + 16px)}',
    '.mp.mp-lado .mp-navtop{flex:0 1 auto;width:min(340px,42%)}',
    '.mp.mp-lado .mp-bottom{right:auto;width:min(340px,42%)}',
    '.mp.mp-lado .mp-navbot{max-width:none;padding:10px 12px}',
    '.mp.mp-lado .mp-nav-txt b{font-size:21px}',
    '.mp.mp-lado .mp-nav-txt span{font-size:14.5px}',
    '.mp.mp-lado .mp-nav-txt small{display:none}',
    '.mp.mp-lado .mp-navbot .mp-nb-t b{font-size:21px}',
    '.mp.mp-lado .mp-nb .mp-fim{min-height:44px;padding:0 16px}',
    '@media (prefers-reduced-motion:reduce){.mp-car svg,.mp-navcar svg,.mp-map.mp-gira,.mp-navon .mp-tools>[data-mp="nav-norte"] svg{transition:none}}'
  ].join('\n');

  function injectStyle() {
    if (document.getElementById('mp-style')) return;
    var s = document.createElement('style');
    s.id = 'mp-style';
    s.textContent = LEAFLET_CSS + '\n' + CSS;
    document.head.appendChild(s);
  }

  var ICON = {
    full: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5"/><path d="M20 9V4h-5"/><path d="M4 15v5h5"/><path d="M20 15v5h-5"/></svg>',
    exit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4v5H4"/><path d="M15 4v5h5"/><path d="M9 20v-5H4"/><path d="M15 20v-5h5"/></svg>',
    fit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17c4-1 5-9 9-10s5 6 9 4"/><circle cx="3" cy="17" r="1.5"/><circle cx="21" cy="11" r="1.5"/></svg>',
    gps: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
    cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    kml: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>',
    car: '<svg viewBox="0 0 34 34" aria-hidden="true"><circle cx="17" cy="17" r="15" fill="#1D63D8" stroke="#FFFFFF" stroke-width="3"/><path d="M17 7 L24.5 25 L17 21 L9.5 25 Z" fill="#FFFFFF"/></svg>',
    dot: '<svg viewBox="0 0 34 34" aria-hidden="true"><circle cx="17" cy="17" r="9" fill="#1D63D8" stroke="#FFFFFF" stroke-width="3"/></svg>',
    layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/></svg>',
    rota: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11 21 3l-8 18-2-8z"/></svg>',
    busca: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
    mais: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
    // seta da navegação: aponta para cima; gira junto com o rumo do carro
    navcar: '<svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="19" fill="#FFFFFF" fill-opacity=".92"/><path d="M22 7 33 34 22 28.5 11 34Z" fill="#1A73E8" stroke="#FFFFFF" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    bussola: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 16 12H8z" fill="#D93025"/><path d="M12 21.5 8 12h8z" fill="currentColor" opacity=".45"/></svg>',
    voz: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
    mudo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="m16 9 6 6M22 9l-6 6"/></svg>',
    centro: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 19 20 12 16 5 20z" fill="currentColor"/></svg>',
    pin: '<svg viewBox="0 0 30 38" aria-hidden="true"><path d="M15 37S3 26 3 16a12 12 0 0 1 24 0c0 10-12 21-12 21z" fill="#B42318" stroke="#FFFFFF" stroke-width="2.5"/><circle cx="15" cy="15.5" r="4.5" fill="#FFFFFF"/></svg>'
  };
  // setas das manobras (traço branco, sobre o verde da instrução)
  function navIco(d) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; }
  var NAV_ICO = {
    reto: navIco('<path d="M12 21V4"/><path d="m6 10 6-6 6 6"/>'),
    dir: navIco('<path d="M7 21v-8a4 4 0 0 1 4-4h9"/><path d="m15 4 5 5-5 5"/>'),
    esq: navIco('<path d="M17 21v-8a4 4 0 0 0-4-4H4"/><path d="M9 4 4 9l5 5"/>'),
    ldir: navIco('<path d="M8 21v-7l9-9"/><path d="M10 5h7v7"/>'),
    lesq: navIco('<path d="M16 21v-7L7 5"/><path d="M14 5H7v7"/>'),
    volta: navIco('<path d="M8 21V10a5 5 0 0 1 10 0v7"/><path d="m14 13 4 4 4-4"/>'),
    rotat: navIco('<circle cx="12" cy="10" r="4"/><path d="M12 14v7"/><path d="m15 7 4-4"/><path d="M15 3h4v4"/>'),
    balsa: navIco('<path d="M3 18c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5"/><path d="m5 14 2-5h10l2 5"/><path d="M12 9V5"/>'),
    chegada: navIco('<path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>')
  };

  // nome do contrato no título do mapa e no KML: o app.js passa opts.nomes; esta cópia curta, com a mesma regra, vale na página
  // online, que embute este arquivo sem o app.js ("Pontos Críticos 314", "Conservação 437", "Proarte 424"; sem nº, o Lote)
  function nomesPadrao() {
    var PAL = { pc: 'Pontos Críticos', conserva: 'Conservação', oae: 'Proarte' };
    function lp(v) { return v == null ? '' : String(v).trim().replace(/\s+/g, ' '); }
    function nome(c) {
      if (!c) return '';
      var m = /(\d{3,})\s*\/\s*\d{4}/.exec(lp(c.numero)), w = PAL[c.tipo === 'oae' ? 'oae' : c.tipo === 'conserva' ? 'conserva' : 'pc'];
      return m ? w + ' ' + String(Number(m[1])) : lp(c.lote) || w;
    }
    function numeroCT(c) { var n = lp(c && c.numero); return n ? 'CT ' + n : ''; }
    return { nome: nome, numeroCT: numeroCT };
  }

  function MapaSNV(opts) {
    var Lf = window.L, snv = opts.snv;
    if (!Lf || !snv || !opts.host) return null;
    if (Lf.Tooltip && !Lf.Tooltip.prototype._mpGira) {
      var tsp = Lf.Tooltip.prototype._setPosition;
      Lf.Tooltip.prototype._setPosition = function (pos) {
        tsp.call(this, pos);
        var el = this._container, g = el && el.closest && el.closest('.mp-girando');
        if (g) el.style.transform += ' rotate(' + (g.style.getPropertyValue('--mp-crot') || '0deg') + ')';
      };
      Lf.Tooltip.prototype._mpGira = true;
    }
    injectStyle();
    var ref = Ref(snv), host = opts.host, rodovia = snv.rodovia || 'BR-230/PA';
    var notify = opts.notify || function () {}, nomes = opts.nomes || nomesPadrao();
    // "Pontos Críticos 314 · CT 02 00314/2026 · BR-230/PA"
    function titulo(c) { return [nomes.nome(c), nomes.numeroCT(c), c.rodovia || rodovia].filter(Boolean).join(' · '); }

    host.innerHTML =
      '<div class="mp" role="region" aria-label="Mapa do trecho">' +
        '<div class="mp-map"></div>' +
        '<div class="mp-top">' +
          '<div class="mp-navtop" role="status" aria-live="polite" hidden></div>' +
          '<div class="mp-left">' +
            '<div class="mp-title"><b class="mp-t1"></b><span class="mp-t2"></span></div>' +
            '<form class="mp-find" novalidate><label for="mpFindKm">Ir para km</label><input id="mpFindKm" inputmode="decimal" autocomplete="off" placeholder="km 812,40"><button class="mp-btn mp-ir" type="submit">' + ICON.busca + 'Ir</button></form>' +
          '</div>' +
          '<div class="mp-tools">' +
            '<button class="mp-btn" type="button" data-mp="full" title="Tela cheia">' + ICON.full + '<span class="t">Tela cheia</span></button>' +
            '<button class="mp-btn mp-navtool" type="button" data-mp="nav-norte" aria-pressed="false" title="Norte para cima" aria-label="Norte para cima">' + ICON.bussola + '</button>' +
            '<button class="mp-btn mp-navtool" type="button" data-mp="nav-voz" aria-pressed="true" title="Voz" aria-label="Voz">' + ICON.voz + '</button>' +
            '<button class="mp-btn mp-navtool" type="button" data-mp="nav-ver" title="Visão geral da rota" aria-label="Visão geral da rota">' + ICON.fit + '</button>' +
            '<button class="mp-btn" type="button" data-mp="fit" title="Ver o trecho inteiro">' + ICON.fit + '<span class="t">Trecho</span></button>' +
            '<button class="mp-btn" type="button" data-mp="gps" aria-pressed="false" title="Posição ao vivo">' + ICON.gps + '<span class="t">Ao vivo</span></button>' +
            (opts.onPhoto ? '<button class="mp-btn" type="button" data-mp="foto" title="Foto com carimbo">' + ICON.cam + '<span class="t">Foto</span></button>' : '') +
            '<button class="mp-btn" type="button" data-mp="kml" title="Baixar KML">' + ICON.kml + '<span class="t">KML</span></button>' +
            (opts.tiles ? '<div class="mp-layers"><button class="mp-btn" type="button" data-mp="bases" aria-expanded="false" aria-haspopup="true" title="Fundo do mapa">' + ICON.layers + '<span class="t mp-base-nome"></span></button>' +
              '<div class="mp-bases" role="group" aria-label="Fundo do mapa" hidden></div></div>' : '') +
            '<button class="mp-btn mp-mais" type="button" data-mp="mais" aria-expanded="false" aria-label="Mais ferramentas do mapa">' + ICON.mais + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="mp-bottom">' +
          '<div class="mp-card mp-live" hidden></div>' +
          '<button class="mp-btn mp-centro" type="button" data-mp="follow" hidden>' + ICON.centro + 'Centralizar</button>' +
          '<div class="mp-card mp-navbot" hidden></div>' +
          '<div class="mp-legend"></div>' +
          '<div class="mp-chips" role="list" aria-label="Pontos do contrato"></div>' +
        '</div>' +
      '</div>';
    var root = host.querySelector('.mp');
    function q(sel) { return root.querySelector(sel); }

    var map = Lf.map(q('.mp-map'), { zoomControl: false, zoomSnap: 0.25, zoomDelta: 0.5, minZoom: 6, maxZoom: 19, worldCopyJump: false, tap: true });
    map.attributionControl.setPrefix(false);
    map.attributionControl.addAttribution('Eixo e km: SNV/DNIT ' + esc(snv.versao));
    Lf.control.zoom({ position: 'bottomright', zoomInTitle: 'Aproximar', zoomOutTitle: 'Afastar' }).addTo(map);
    Lf.control.scale({ imperial: false, position: 'bottomright' }).addTo(map);
    if (map._controlContainer) root.appendChild(map._controlContainer);
    map.createPane('mpRoad').style.zIndex = 410;
    map.createPane('mpRota').style.zIndex = 415;
    map.createPane('mpPts').style.zIndex = 420;
    map.createPane('mpCar').style.zIndex = 640;
    // mapa offline por baixo das imagens online (200): aparece no modo Offline e onde as imagens não carregam
    map.createPane('mpBg').style.zIndex = 140;
    map.getPane('mpBg').style.pointerEvents = 'none';
    map.createPane('mpBase').style.zIndex = 150;
    map.createPane('mpBaseLbl').style.zIndex = 160;
    map.getPane('mpBaseLbl').style.pointerEvents = 'none';

    // ---------------- fundo (só no site local; a página online não carrega imagens de outros sites)
    var baseLayer = null, baseKey = 'nenhum';
    function setBase(key) {
      if (key === 'nenhum') key = 'offline';   // versões anteriores guardavam "Sem fundo"
      if (!opts.tiles) key = 'offline';
      if (!BASES[key]) key = 'mapa';
      baseKey = key;
      if (baseLayer) { map.removeLayer(baseLayer); baseLayer = null; }
      if (BASES[key].url) baseLayer = Lf.tileLayer(BASES[key].url, BASES[key].opt).addTo(map);
      root.classList.toggle('sat', key === 'satelite');
      root.classList.toggle('osm', key === 'mapa' || key === 'offline');
      var g = q('.mp-bases');
      if (g) g.innerHTML = ['mapa', 'satelite', 'offline'].map(function (k) {
        return '<button class="mp-btn" type="button" data-base="' + k + '" aria-pressed="' + (k === key) + '">' + BASES[k].name + '</button>';
      }).join('');
      var nb = q('.mp-base-nome');
      if (nb) nb.textContent = BASES[key].name;
      var bb = q('[data-mp="bases"]');
      if (bb) bb.title = 'Fundo do mapa: ' + BASES[key].name;
      lsSet(BASE_KEY, key);
    }
    function basesMenu(abrir) {
      var g = q('.mp-bases'), bb = q('[data-mp="bases"]');
      if (!g || !bb) return;
      g.hidden = !abrir;
      bb.setAttribute('aria-expanded', String(!!abrir));
    }
    setBase(opts.tiles ? (lsGet(BASE_KEY) || 'mapa') : 'offline');

    // ---------------- fundo: cobertura do solo (MapBiomas) em imagens ao longo do eixo, carregadas conforme a vista
    var fundo = opts.fundo || window.FUNDO_BR230 || null, bgOn = {};
    function syncFundo() {
      if (!fundo) return;
      var vb = map.getBounds().pad(0.6);
      fundo.pedacos.forEach(function (p) {
        if (bgOn[p[0]]) return;
        var bb = Lf.latLngBounds([p[1], p[2]], [p[3], p[4]]);
        if (!bb.intersects(vb)) return;
        bgOn[p[0]] = Lf.imageOverlay(p[5] || ((fundo.pasta || 'fundo/') + p[0]), bb, { pane: 'mpBg', interactive: false }).addTo(map);
      });
    }
    if (fundo) {
      map.attributionControl.addAttribution(esc(fundo.atribuicao || 'Cobertura do solo: MapBiomas'));
      map.on('moveend', syncFundo);
    }

    // ---------------- mapa offline: estradas, rios e localidades do OpenStreetMap, conforme o zoom
    var osm = opts.osm || window.OSM_BR230 || null, off = null;
    function buildOffline() {
      if (!osm || off) return;
      var rend = Lf.canvas({ pane: 'mpBase', padding: 0.4 }), groups = {}, placed = {};
      function grp(k) { return groups[k] || (groups[k] = Lf.layerGroup()); }
      function line(pts, st, poly) {
        var o = { renderer: rend, interactive: false, pane: 'mpBase' };
        for (var k in st) o[k] = st[k];
        return poly ? Lf.polygon(pts, o) : Lf.polyline(pts, o);
      }
      function label(ll, html, cls, k) {
        Lf.marker(ll, { pane: 'mpBaseLbl', interactive: false, keyboard: false,
          icon: Lf.divIcon({ className: cls, html: html, iconSize: [0, 0] }) }).addTo(grp(k));
      }
      // nome do rio/igarapé no meio do trecho, acompanhando a direção da linha (sem repetir o nome a menos de 10 km / 4 km)
      function riverName(pts, nome, k) {
        var cl = Math.cos(pts[0][0] * Math.PI / 180), cum = [0];
        for (var i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot((pts[i][1] - pts[i - 1][1]) * cl, pts[i][0] - pts[i - 1][0]) * 111320);
        var tot = cum[cum.length - 1];
        if (tot < (k === 'nrio' ? 800 : 500)) return;
        var half = tot / 2, j = 1;
        while (j < cum.length - 1 && cum[j] < half) j++;
        var t = (half - cum[j - 1]) / ((cum[j] - cum[j - 1]) || 1);
        var mid = [pts[j - 1][0] + t * (pts[j][0] - pts[j - 1][0]), pts[j - 1][1] + t * (pts[j][1] - pts[j - 1][1])];
        var near = placed[nome] || (placed[nome] = []);
        var gap = k === 'nrio' ? 10000 : 4000;
        for (var n = 0; n < near.length; n++) if (Math.hypot((near[n][1] - mid[1]) * cl, near[n][0] - mid[0]) * 111320 < gap) return;
        near.push(mid);
        var a = Math.max(0, j - 2), z = Math.min(pts.length - 1, j + 1);
        var ang = -Math.atan2(pts[z][0] - pts[a][0], (pts[z][1] - pts[a][1]) * cl) * 180 / Math.PI;
        if (ang > 90) ang -= 180; else if (ang < -90) ang += 180;
        label(mid, '<span style="transform:translate(-50%,-50%) rotate(' + ang.toFixed(0) + 'deg)">' + esc(nome) + '</span>', 'mp-rio ' + k, k);
      }
      (osm.aguas || []).forEach(function (a) { line(decodePl(a[1]), OFF_STYLE.agua, true).addTo(grp('agua')); });
      (osm.rios || []).forEach(function (r) {
        var pts = decodePl(r[2]), k = r[0] === 'rio' ? 'rio' : 'corrego';
        line(pts, OFF_STYLE[k]).addTo(grp(k));
        if (r[1]) riverName(pts, r[1], k === 'rio' ? 'nrio' : 'nigarape');
      });
      (osm.vias || []).forEach(function (v) { line(decodePl(v[4]), OFF_STYLE[v[0]] || OFF_STYLE.vicinal).addTo(grp(v[0])); });
      // só municípios e vilas (povoados, bairros e sítios ficam de fora)
      (osm.lugares || []).forEach(function (l) {
        var k = l[0] === 'city' || l[0] === 'town' ? 'cidade' : l[0] === 'village' ? 'vila' : '';
        if (k) label([l[2], l[3]], '<span>' + esc(l[1]) + '</span>', 'mp-place ' + k, k);
      });
      off = { groups: groups, on: '' };
      map.attributionControl.addAttribution(esc(osm.atribuicao || '© colaboradores do OpenStreetMap'));
      syncOffline();
    }
    function syncOffline() {
      if (!off) return;
      var z = map.getZoom(), want = OFF_ORDER.filter(function (k) { return off.groups[k] && z >= OFF_MINZ[k]; }), key = want.join(',');
      if (key === off.on) return;
      // tira tudo e põe de novo na ordem certa (o canvas desenha na ordem em que as camadas entram)
      OFF_ORDER.forEach(function (k) { if (off.groups[k] && map.hasLayer(off.groups[k])) map.removeLayer(off.groups[k]); });
      want.forEach(function (k) { off.groups[k].addTo(map); });
      off.on = key;
    }
    map.on('zoomend', syncOffline);
    buildOffline();

    // ---------------- eixo do SNV inteiro (contexto) e localidades dos segmentos
    var full = snv.linha.map(function (v) { return [v[1], v[0]]; });
    Lf.polyline(full, { pane: 'mpRoad', className: 'mp-ctx', weight: 2, interactive: false }).addTo(map);
    var locLayer = Lf.layerGroup().addTo(map);
    var seen = {};
    snv.segmentos.forEach(function (s, i) {
      [[s.kmIni, s.de], [s.kmFim, s.ate]].forEach(function (pair, j) {
        if (j === 0 && i > 0) return;
        var key = pair[0].toFixed(1);
        if (seen[key]) return;
        seen[key] = true;
        Lf.circleMarker(ref.at(pair[0]), { pane: 'mpPts', radius: 4, weight: 2, color: '#FFFFFF', fillColor: '#17201C', fillOpacity: 1 })
          .bindTooltip(esc(pair[1]) + ' · km ' + km2(pair[0]), { permanent: true, direction: 'left', offset: [-6, 0], className: 'mp-loc' })
          .addTo(locLayer);
      });
    });

    // ---------------- camadas do contrato
    var ctLayer = Lf.layerGroup().addTo(map), ptsLayer = Lf.layerGroup().addTo(map), lblLayer = Lf.layerGroup(), kmLayer = Lf.layerGroup().addTo(map);
    var range = null, pts = [], lastCid = null, bounds = null, findMarker = null;

    function contractRange(c) {
      var a = c.kmIni, b = c.kmFim;
      if (a == null || b == null) {
        var ks = [];
        c.pontos.forEach(function (p) { if (p.kmIni != null) ks.push(p.kmIni); if (p.kmFim != null) ks.push(p.kmFim); });
        if (!ks.length) return null;
        a = Math.min.apply(null, ks) - 2; b = Math.max.apply(null, ks) + 2;
      }
      a = Math.max(ref.kmMin, Math.min(a, b)); b = Math.min(ref.kmMax, Math.max(a, b));
      // kmFimMapa: o mapa para antes do fim do contrato (264: o contorno planejado de Altamira, 624,70 a 642,40, não existe;
      // decisão D-6). As folhas e os dados do contrato continuam com o km do contrato
      if (typeof c.kmFimMapa === 'number' && c.kmFimMapa > a && c.kmFimMapa < b) b = c.kmFimMapa;
      return b > a ? [a, b] : null;
    }

    function popupHtml(p, info) {
      var a = ref.at(p.kmIni), b = ref.at(p.kmFim != null ? p.kmFim : p.kmIni), len = p.kmFim != null ? Math.max(0, p.kmFim - p.kmIni) : null;
      var h = '<div class="mp-pop" style="--c:' + info.color + '">' +
        '<h3>' + esc(p.nome || 'Ponto') + '<span class="tag">' + esc(info.status) + (info.pctText ? ' · ' + esc(info.pctText) : '') + '</span></h3>' +
        '<dl><div><dt>km inicial</dt><dd>' + km2(p.kmIni) + '</dd></div><div><dt>km final</dt><dd>' + (p.kmFim != null ? km2(p.kmFim) : '-') + '</dd></div>' +
        '<div><dt>Extensão</dt><dd>' + (len != null ? nf(len, 2) + ' km' : '-') + '</dd></div></dl>' +
        '<p class="co">Início ' + coordDnit(a) + '<br>Fim ' + coordDnit(b) + '</p>';
      if (info.servs && info.servs.length) {
        h += '<ul>' + info.servs.map(function (s) { return '<li style="--c:' + s.color + '"><span>' + esc(s.label) + '</span><b>' + esc(s.text) + '</b></li>'; }).join('') + '</ul>';
      }
      var curto = len == null || len < 0.2;
      if (opts.gps) {
        h += '<div class="rotas">' + (curto
          ? botaoRota(p.kmIni, p.nome, p.id, 'Rota até aqui')
          : botaoRota(p.kmIni, p.nome + ' (início)', p.id, 'Rota até o início') + botaoRota(p.kmFim, p.nome + ' (fim)', p.id, 'Rota até o fim')) + '</div>';
        h += '<div class="links"><a href="' + routeUrl(a) + '" target="_blank" rel="noopener">Abrir no Google Maps</a></div>';
      } else {
        h += '<div class="links"><a href="' + routeUrl(a) + '" target="_blank" rel="noopener">Rota até o início</a><a href="' + routeUrl(b) + '" target="_blank" rel="noopener">Rota até o fim</a></div>';
      }
      if (opts.onPhoto) h += '<button class="mp-btn mp-pop-foto" type="button" data-mp="foto" data-pid="' + esc(p.id) + '">' + ICON.cam + 'Foto com carimbo</button>';
      if (opts.onOpen) h += '<button class="mp-btn mp-pop-abrir" type="button" data-mp="abrir" data-pid="' + esc(p.id) + '">' + esc(opts.openLabel ? opts.openLabel(p) : 'Abrir') + '</button>';
      h += '</div>';
      return h;
    }

    // no celular o popup fica mais estreito, para caber entre a margem e a coluna de botões
    function popW() { return Math.max(220, Math.min(300, (root.clientWidth || 400) - 130)); }
    function botaoRota(km, nome, pid, rot) {
      return '<button class="mp-btn" type="button" data-mp="rota" data-km="' + km + '" data-nome="' + esc(nome) + '" data-pid="' + esc(pid || '') + '">' + ICON.rota + esc(rot) + '</button>';
    }
    function kmStep() {
      var lat = map.getCenter().lat, mpp = 156543.03 * Math.cos(lat * Math.PI / 180) / Math.pow(2, map.getZoom());
      var steps = [1, 2, 5, 10, 20, 50, 100];
      for (var i = 0; i < steps.length; i++) if (steps[i] * 1000 / mpp >= 78) return steps[i];
      return 100;
    }
    function drawKm() {
      kmLayer.clearLayers();
      if (!range) return;
      var step = kmStep(), first = Math.ceil(range[0] / step) * step;
      for (var k = first; k <= range[1] + 1e-9; k += step) {
        Lf.circleMarker(ref.at(k), { pane: 'mpRoad', className: 'mp-km', radius: 3, weight: 1.5, fillOpacity: 1, interactive: false })
          .bindTooltip('km ' + nf(k, 0), { permanent: true, direction: 'right', offset: [5, 0], className: 'mp-kml' })
          .addTo(kmLayer);
      }
    }
    function toggleLabels() {
      var on = map.getZoom() >= 11;
      if (on && !map.hasLayer(lblLayer)) lblLayer.addTo(map);
      if (!on && map.hasLayer(lblLayer)) map.removeLayer(lblLayer);
    }
    function toggleLoc() {
      var on = map.getZoom() >= 9;
      if (on && !map.hasLayer(locLayer)) locLayer.addTo(map);
      if (!on && map.hasLayer(locLayer)) map.removeLayer(locLayer);
    }
    map.on('zoomend', function () { drawKm(); toggleLabels(); toggleLoc(); });
    // rótulos que se encostam: fica o mais importante (nome do ponto, depois localidade, km, cidade e rio) e os que caem
    // embaixo das caixas do mapa (título, busca, botões, pontos de baixo) somem até o mapa mexer de novo
    var arrumaPedido = false;
    function arrumaRotulos() {
      arrumaPedido = false;
      var caixas = Array.prototype.map.call(root.querySelectorAll('.mp-left>*:not([hidden]),.mp-tools>*,.mp-chips,.mp-legend:not([hidden]),.mp-card:not([hidden])'), function (el) { return el.getBoundingClientRect(); })
        .filter(function (r) { return r.width && r.height; });
      var vistos = caixas.slice();
      ['.leaflet-tooltip.mp-lbl', '.leaflet-tooltip.mp-loc', '.leaflet-tooltip.mp-kml', '.mp-place span', '.mp-rio span'].forEach(function (sel) {
        root.querySelectorAll(sel).forEach(function (el) {
          el.style.visibility = '';
          var r = el.getBoundingClientRect();
          if (!r.width) return;
          var bate = vistos.some(function (o) { return r.left < o.right + 2 && r.right > o.left - 2 && r.top < o.bottom + 2 && r.bottom > o.top - 2; });
          if (bate) el.style.visibility = 'hidden'; else vistos.push(r);
        });
      });
    }
    function pedeArrumar() { if (!arrumaPedido) { arrumaPedido = true; requestAnimationFrame(arrumaRotulos); } }
    map.on('moveend', pedeArrumar);

    function render() {
      var c = opts.getContract();
      ctLayer.clearLayers(); ptsLayer.clearLayers(); lblLayer.clearLayers();
      pts = [];
      if (!c) { range = null; drawKm(); q('.mp-t1').textContent = 'Sem contrato'; q('.mp-t2').textContent = ''; q('.mp-chips').innerHTML = ''; return; }
      range = contractRange(c);
      q('.mp-t1').textContent = titulo(c);
      q('.mp-t2').textContent = range
        ? 'km ' + km2(range[0]) + ' a ' + km2(range[1]) + ' · SNV ' + snv.versao
        : c.kmLocal ? 'km próprio (' + (c.ramal || 'ramal') + '): o mapa ainda não desenha esta travessia' : 'Sem km cadastrado';
      if (range) {
        var line = ref.slice(range[0], range[1]);
        Lf.polyline(line, { pane: 'mpRoad', className: 'mp-road-case', weight: 8, interactive: false }).addTo(ctLayer);
        Lf.polyline(line, { pane: 'mpRoad', className: 'mp-road', weight: 4, interactive: false }).addTo(ctLayer);
        bounds = Lf.latLngBounds(line).pad(0.06);
      }
      (c.marcos || []).forEach(function (m) {
        if (m.km == null || m.km < ref.kmMin || m.km > ref.kmMax) return;
        Lf.circleMarker(ref.at(m.km), { pane: 'mpPts', radius: 6, weight: 2, color: '#FFFFFF', fillColor: '#6B4E00', fillOpacity: 1 })
          .bindTooltip(esc(m.nome || 'Marco') + ' · km ' + km2(m.km), { direction: 'top', offset: [0, -6], className: 'mp-lbl' })
          .addTo(ctLayer);
      });
      // conservação: os segmentos não entram no mapa até o passo 2.4 (só a linha do contrato e os marcos)
      var sorted = (c.tipo === 'conserva' ? [] : c.pontos).filter(function (p) { return p.kmIni != null; }).sort(function (a, b) { return a.kmIni - b.kmIni; });
      sorted.forEach(function (p) {
        var info = opts.pointInfo(p), kf = p.kmFim != null ? p.kmFim : p.kmIni;
        var line = ref.slice(p.kmIni, kf), mid = ref.at((p.kmIni + kf) / 2);
        var group = Lf.featureGroup().addTo(ptsLayer);
        Lf.polyline(line, { pane: 'mpPts', color: '#FFFFFF', weight: 13, opacity: 0.95, lineCap: 'round', interactive: false }).addTo(group);
        var seg = Lf.polyline(line, { pane: 'mpPts', color: info.color, weight: 9, lineCap: 'round' }).addTo(group);
        [[p.kmIni, 'Início'], [kf, 'Fim']].forEach(function (e) {
          Lf.circleMarker(ref.at(e[0]), { pane: 'mpPts', radius: 5, weight: 2.5, color: info.color, fillColor: '#FFFFFF', fillOpacity: 1 })
            .bindTooltip(esc(p.nome) + ' · ' + e[1] + ' km ' + km2(e[0]), { direction: 'top', offset: [0, -6], className: 'mp-lbl' })
            .addTo(group);
        });
        (p.disp || []).forEach(function (d) {
          if (d.km == null) return;
          Lf.circleMarker(ref.at(d.km), { pane: 'mpPts', radius: 3.5, weight: 1.5, color: '#FFFFFF', fillColor: '#5C6661', fillOpacity: 1 })
            .bindTooltip(esc(d.desc || 'Dispositivo') + ' · km ' + km2(d.km), { direction: 'top', offset: [0, -4], className: 'mp-lbl' })
            .addTo(group);
        });
        seg.bindTooltip(esc(p.nome) + ' · km ' + km2(p.kmIni) + ' a ' + km2(kf), { sticky: true, className: 'mp-lbl' });
        // margens do autoPan: o popup não fica por baixo do título, da busca de km nem da coluna de botões
        group.bindPopup(function () { return popupHtml(p, opts.pointInfo(p)); }, { maxWidth: popW(), autoPanPaddingTopLeft: [12, 116], autoPanPaddingBottomRight: [64, 70] });
        Lf.marker(mid, { opacity: 0, interactive: false, keyboard: false, icon: Lf.divIcon({ className: '', iconSize: [0, 0] }) })
          .bindTooltip(esc(p.nome), { permanent: true, direction: 'top', offset: [0, -8], className: 'mp-lbl' })
          .addTo(lblLayer);
        pts.push({ p: p, info: info, group: group, kf: kf });
      });
      renderChips();
      renderLegend();
      if (c.id !== lastCid) {
        // outro contrato: o "Ir para km" e a marca da busca do contrato anterior saem
        lastCid = c.id; q('#mpFindKm').value = '';
        if (findMarker) { map.removeLayer(findMarker); findMarker = null; }
        fit();
      }
      drawKm();
      toggleLabels();
      if (live.loc) updateLive();
      pedeArrumar();
    }

    function renderChips() {
      q('.mp-chips').innerHTML = pts.map(function (x, i) {
        return '<button class="mp-chip" type="button" role="listitem" data-i="' + i + '" style="--c:' + x.info.color + '" title="' + esc(x.p.nome + ' · km ' + km2(x.p.kmIni) + ' a ' + km2(x.kf)) + '"><i></i>' + esc(x.p.nome) + ' <small>' + km2(x.p.kmIni) + '</small></button>';
      }).join('');
    }
    function renderLegend() {
      var seenSt = {}, items = [];
      pts.forEach(function (x) { if (!seenSt[x.info.status]) { seenSt[x.info.status] = true; items.push(x.info); } });
      q('.mp-legend').innerHTML = items.map(function (i) { return '<span style="--c:' + i.color + '"><i></i>' + esc(i.status) + '</span>'; }).join('');
      q('.mp-legend').hidden = !items.length;
    }

    // enquadrar com o mapa escondido (tamanho zero) dá zoom 19 no lugar errado: fica pendente até ele aparecer
    var fitPend = false;
    function fit() {
      var z = map.getSize();
      fitPend = !z.x || !z.y;
      if (bounds) map.fitBounds(bounds, { animate: false, paddingTopLeft: [10, 90], paddingBottomRight: [10, 70] });
      else map.fitBounds(Lf.latLngBounds(full), { animate: false });
    }
    function focusPoint(i) {
      var x = pts[i];
      if (!x) return;
      var b = x.group.getBounds();
      map.fitBounds(b, { maxZoom: 16, animate: !reduced(), paddingTopLeft: [20, 120], paddingBottomRight: [20, 90] });
      x.group.openPopup(b.getCenter());
    }
    function goKm(v) {
      var k = parseKm(v);
      if (k == null) { notify('Digite um km, por exemplo 812,40.'); return; }
      if (k < ref.kmMin || k > ref.kmMax) { notify('O mapa cobre do km ' + km2(ref.kmMin) + ' ao km ' + km2(ref.kmMax) + '.'); return; }
      var ll = ref.at(k);
      if (findMarker) map.removeLayer(findMarker);
      findMarker = Lf.circleMarker(ll, { pane: 'mpCar', radius: 8, weight: 3, color: '#FFFFFF', fillColor: '#6B4E00', fillOpacity: 1 })
        .bindPopup('<div class="mp-pop"><h3>km ' + km2(k) + '</h3><p class="co">' + coordDnit(ll) + '</p>' +
          (opts.gps ? '<div class="rotas">' + botaoRota(k, 'km ' + km2(k), '', 'Rota até aqui') + '</div><div class="links"><a href="' + routeUrl(ll) + '" target="_blank" rel="noopener">Abrir no Google Maps</a></div>'
            : '<div class="links"><a href="' + routeUrl(ll) + '" target="_blank" rel="noopener">Rota até aqui</a><a href="' + placeUrl(ll) + '" target="_blank" rel="noopener">Ver no Google Maps</a></div>') + '</div>',
          { autoPanPaddingTopLeft: [12, 116], autoPanPaddingBottomRight: [64, 70] })
        .addTo(map);
      map.setView(ll, Math.max(map.getZoom(), 15), { animate: !reduced() });
      findMarker.openPopup();
    }

    // ---------------- KML (Google Earth, Google My Maps, Organic Maps)
    function kmlColor(hex, alpha) {
      var h = String(hex || '#59615D').replace('#', '');
      if (h.length === 3) h = h.replace(/(.)/g, '$1$1');
      return (alpha || 'ff') + h.slice(4, 6) + h.slice(2, 4) + h.slice(0, 2);
    }
    function kmlCoords(lls) { return lls.map(function (ll) { return ll[1].toFixed(6) + ',' + ll[0].toFixed(6) + ',0'; }).join(' '); }
    function xml(s) { return esc(s).replace(/'/g, '&apos;'); }
    function buildKml() {
      var c = opts.getContract();
      if (!c) return null;
      render();
      var styles = {}, out = [];
      pts.forEach(function (x) { styles[x.info.color] = true; });
      out.push('<?xml version="1.0" encoding="UTF-8"?>');
      out.push('<kml xmlns="http://www.opengis.net/kml/2.2"><Document>');
      out.push('<name>' + xml(titulo(c)) + '</name>');
      // o que o contrato tem: pontes (424), segmentos de conservação (437, 438) ou pontos críticos (314, 315)
      var itensKml = c.tipo === 'oae' ? 'Pontes' : c.tipo === 'conserva' ? 'Segmentos de conservação' : 'Pontos críticos';
      out.push('<description>' + xml(itensKml + ' com km pelo SNV do DNIT, versão ' + snv.versao + '. Gerado em ' + new Date().toLocaleString('pt-BR') + '.') + '</description>');
      out.push('<Style id="rodovia"><LineStyle><color>ff1c2017</color><width>4</width></LineStyle></Style>');
      out.push('<Style id="km"><IconStyle><scale>0.5</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle><LabelStyle><scale>0.7</scale></LabelStyle></Style>');
      Object.keys(styles).forEach(function (col, i) {
        out.push('<Style id="st' + i + '"><LineStyle><color>' + kmlColor(col) + '</color><width>8</width></LineStyle><IconStyle><color>' + kmlColor(col) + '</color><scale>0.9</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle></Style>');
        styles[col] = 'st' + i;
      });
      out.push('<Folder><name>' + xml(itensKml) + '</name>');
      pts.forEach(function (x) {
        var p = x.p, st = '#' + styles[x.info.color], a = ref.at(p.kmIni), b = ref.at(x.kf);
        var desc = 'km ' + km2(p.kmIni) + ' a ' + km2(x.kf) + ' (' + nf(Math.max(0, x.kf - p.kmIni), 2) + ' km)\n' +
          x.info.status + (x.info.pctText ? ' · ' + x.info.pctText : '') + '\nInício ' + coordDnit(a) + '\nFim ' + coordDnit(b) +
          (x.info.servs || []).map(function (s) { return '\n' + s.label + ': ' + s.text; }).join('') + (p.obs ? '\n' + p.obs : '');
        out.push('<Placemark><name>' + xml(p.nome) + '</name><description>' + xml(desc) + '</description><styleUrl>' + st + '</styleUrl><LineString><tessellate>1</tessellate><coordinates>' + kmlCoords(ref.slice(p.kmIni, x.kf)) + '</coordinates></LineString></Placemark>');
        out.push('<Placemark><name>' + xml(p.nome + ' início · km ' + km2(p.kmIni)) + '</name><description>' + xml(desc) + '</description><styleUrl>' + st + '</styleUrl><Point><coordinates>' + kmlCoords([a]) + '</coordinates></Point></Placemark>');
        out.push('<Placemark><name>' + xml(p.nome + ' fim · km ' + km2(x.kf)) + '</name><styleUrl>' + st + '</styleUrl><Point><coordinates>' + kmlCoords([b]) + '</coordinates></Point></Placemark>');
      });
      out.push('</Folder>');
      if (range) {
        out.push('<Folder><name>' + xml(rodovia + ' (eixo SNV)') + '</name><Placemark><name>' + xml(rodovia + ' · km ' + km2(range[0]) + ' a ' + km2(range[1])) + '</name><styleUrl>#rodovia</styleUrl><LineString><tessellate>1</tessellate><coordinates>' + kmlCoords(ref.slice(range[0], range[1])) + '</coordinates></LineString></Placemark></Folder>');
        out.push('<Folder><name>Marcos de km (SNV)</name>');
        for (var k = Math.ceil(range[0] / 5) * 5; k <= range[1]; k += 5) {
          out.push('<Placemark><name>km ' + nf(k, 0) + '</name><styleUrl>#km</styleUrl><Point><coordinates>' + kmlCoords([ref.at(k)]) + '</coordinates></Point></Placemark>');
        }
        out.push('</Folder>');
      }
      out.push('</Document></kml>');
      // "Mapa - Pontos Críticos 314 - CT 02 00314-2026.kml" (a barra do nº vira hífen)
      var name = ('Mapa - ' + [nomes.nome(c), nomes.numeroCT(c)].filter(Boolean).join(' - ')).replace(/[\/\\:*?"<>|]+/g, '-') + '.kml';
      return { name: name, text: out.join('\n') };
    }
    function exportKml() {
      var k = buildKml();
      if (k && opts.saveText) opts.saveText(k.name, k.text, 'application/vnd.google-earth.kml+xml');
    }

    // ---------------- tela cheia
    var isFull = false;
    function setFullBtn() {
      var b = q('[data-mp="full"]');
      b.innerHTML = (isFull ? ICON.exit : ICON.full) + '<span class="t">' + (isFull ? 'Sair' : 'Tela cheia') + '</span>';
      b.title = isFull ? 'Sair da tela cheia' : 'Tela cheia';
    }
    function openFull() {
      if (isFull) return;
      isFull = true;
      root.classList.add('mp-full');
      document.documentElement.style.overflow = 'hidden';
      setFullBtn();
      // no app do iPhone a tela cheia do sistema mostra aviso e um X por cima: lá fica só a de página, que já cobre tudo
      var nativo = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
      if (!nativo) try { var r = root.requestFullscreen && root.requestFullscreen({ navigationUI: 'hide' }); if (r && r.catch) r.catch(function () {}); } catch (e) { /* sem tela cheia do navegador: fica a de página */ }
      setTimeout(function () { map.invalidateSize(); }, 60);
    }
    function closeFull() {
      if (!isFull) return;
      isFull = false;
      root.classList.remove('mp-full');
      document.documentElement.style.overflow = '';
      setFullBtn();
      try { if (document.fullscreenElement === root && document.exitFullscreen) { var r = document.exitFullscreen(); if (r && r.catch) r.catch(function () {}); } } catch (e) { /* nada */ }
      setTimeout(function () { map.invalidateSize(); }, 60);
    }
    document.addEventListener('fullscreenchange', function () {
      if (!document.fullscreenElement && isFull) closeFull();
      setTimeout(function () { map.invalidateSize(); }, 60);
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isFull) closeFull(); });

    // ---------------- posição ao vivo
    var live = { watch: null, loc: null, ll: null, follow: true, marker: null, acc: null, hist: [], heading: null, wake: null, speed: null, accuracy: null, err: '' };
    function liveCard(html) { var el = q('.mp-live'); el.innerHTML = html; el.hidden = !html; }
    function noGpsCard() {
      liveCard('<p><b>Posição ao vivo</b></p>' +
        '<p>Dentro do link do Claude o navegador não libera a localização do aparelho. Para acompanhar o veículo:</p>' +
        '<p>1. Toque em um ponto e use <b>Rota até o início</b>: abre o Google Maps com a sua posição e o caminho até o ponto.</p>' +
        '<p>2. Ou baixe o <b>KML</b> e abra no Google Earth ou no Organic Maps (funciona sem internet). Os pontos aparecem com o km e o carro anda ao vivo.</p>' +
        '<div class="mp-row"><button class="mp-btn" type="button" data-mp="kml">' + ICON.kml + 'Baixar KML</button><button class="mp-btn" type="button" data-mp="close-live">Fechar</button></div>');
    }
    function setGpsBtn() { q('[data-mp="gps"]').setAttribute('aria-pressed', String(!!live.watch || (!opts.gps && !q('.mp-live').hidden))); }
    function wakeOn() {
      try { if (navigator.wakeLock && !live.wake) navigator.wakeLock.request('screen').then(function (w) { live.wake = w; w.addEventListener('release', function () { live.wake = null; }); }, function () {}); } catch (e) { /* sem wake lock */ }
    }
    document.addEventListener('visibilitychange', function () { if (live.watch && document.visibilityState === 'visible') wakeOn(); });
    function bearing(a, b) {
      var f1 = a[0] * Math.PI / 180, f2 = b[0] * Math.PI / 180, dl = (b[1] - a[1]) * Math.PI / 180;
      var y = Math.sin(dl) * Math.cos(f2), x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
      return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    }
    function dist(a, b) {
      var k = Math.cos(a[0] * Math.PI / 180), dx = (b[1] - a[1]) * Math.PI / 180 * R * k, dy = (b[0] - a[0]) * Math.PI / 180 * R;
      return Math.sqrt(dx * dx + dy * dy);
    }
    // ---------------- bússola do aparelho: parado ou devagar, a seta (e o mapa, na navegação) gira com o celular,
    // como no Google Maps; andando, vale o rumo do GPS
    var bus = { h: null, t: 0, ligada: false, ult: 0 };
    function anguloTela() {
      var a = 0;
      try { a = screen.orientation && typeof screen.orientation.angle === 'number' ? screen.orientation.angle : (typeof window.orientation === 'number' ? window.orientation : 0); } catch (e) { a = 0; }
      return a || 0;
    }
    function onBussola(e) {
      var h = null;
      if (typeof e.webkitCompassHeading === 'number' && isFinite(e.webkitCompassHeading)) h = e.webkitCompassHeading;   // iPhone
      else if (e.absolute && typeof e.alpha === 'number' && isFinite(e.alpha)) h = 360 - e.alpha;                        // Android
      if (h == null) return;
      h = ((h + anguloTela()) % 360 + 360) % 360;
      // suaviza (a bússola treme) pela menor volta
      if (bus.h == null || Date.now() - bus.t > 3000) bus.h = h;
      else { var d = ((h - bus.h) % 360 + 540) % 360 - 180; bus.h = ((bus.h + d * 0.35) % 360 + 360) % 360; }
      bus.t = Date.now();
      if (Date.now() - bus.ult < 200) return;
      bus.ult = Date.now();
      aplicaBussola();
    }
    function ligaBussola() {
      if (bus.ligada || typeof window.DeviceOrientationEvent === 'undefined') return;
      function escuta() {
        bus.ligada = true;
        if ('ondeviceorientationabsolute' in window) window.addEventListener('deviceorientationabsolute', onBussola);
        else window.addEventListener('deviceorientation', onBussola);
      }
      try {
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
          DeviceOrientationEvent.requestPermission().then(function (r) { if (r === 'granted') escuta(); }, function () {});
        } else escuta();
      } catch (e) { /* sem bússola: fica o rumo do GPS */ }
    }
    function andando() { return live.heading != null && (live.speed || 0) > 1.5; }
    function bussolaFresca() { return bus.h != null && Date.now() - bus.t < 3000; }
    // rumo da seta fora da navegação
    function rumoLivre() { return andando() ? live.heading : bussolaFresca() ? bus.h : live.heading; }
    function aplicaBussola() {
      if (!live.marker || andando() || !bussolaFresca()) return;
      if (nav) {
        if (!nav.rota || nav.chegou) return;
        nav.rumo = bus.h;
        desenhaSeta();
        if (live.follow && !norteCima && gira.on) giraLiga(nav.rumo);
        return;
      }
      var el = live.marker.getElement(), sv = el && el.querySelector('svg');
      if (!sv || !el.querySelector('path')) { live.marker.setIcon(iconeLivre()); return; }
      sv.style.transform = 'rotate(' + Math.round(bus.h) + 'deg)';
    }
    function startGps() {
      ligaBussola();
      if (!navigator.geolocation) { live.err = 'Este navegador não informa a localização.'; updateLive(); return; }
      live.follow = true; live.err = ''; live.hist = [];
      liveCard('<div class="mp-stamp">Procurando o GPS…</div><div class="mp-sub">Permita o acesso à localização quando o navegador perguntar.</div>');
      live.watch = navigator.geolocation.watchPosition(onFix, onFixError, { enableHighAccuracy: true, maximumAge: 2000, timeout: 30000 });
      wakeOn();
      setGpsBtn();
    }
    function stopGps() {
      if (nav) { nav.gpsNosso = false; navStop(); }
      if (live.watch != null && navigator.geolocation) navigator.geolocation.clearWatch(live.watch);
      live.watch = null; live.loc = null; live.ll = null;
      if (live.marker) { map.removeLayer(live.marker); live.marker = null; }
      if (live.acc) { map.removeLayer(live.acc); live.acc = null; }
      if (live.wake) { try { live.wake.release(); } catch (e) { /* nada */ } live.wake = null; }
      liveCard('');
      setGpsBtn();
    }
    function onFixError(e) {
      var nat = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
      live.err = e && e.code === 1 ? (nat ? 'A localização foi bloqueada. Libere nos Ajustes do aparelho, nas permissões do app VIA-230, e toque em Ao vivo de novo.'
        : 'A localização foi bloqueada. Libere a localização para este site nas permissões do navegador e toque em Ao vivo de novo.')
        : e && e.code === 3 ? 'O GPS ainda não respondeu. Fique em local aberto; a busca continua.'
        : 'Sem sinal de localização no momento.';
      if (e && e.code === 1) { if (live.watch != null) navigator.geolocation.clearWatch(live.watch); live.watch = null; setGpsBtn(); }
      updateLive();
    }
    function onFix(pos) {
      var c = pos.coords, ll = [c.latitude, c.longitude];
      live.err = '';
      if (live.ll && dist(live.ll, ll) > 4) live.heading = bearing(live.ll, ll);
      if (c.heading != null && isFinite(c.heading) && (c.speed || 0) > 1) live.heading = c.heading;
      live.ll = ll; live.speed = c.speed; live.accuracy = c.accuracy;
      live.loc = ref.locate(ll[0], ll[1]);
      live.hist.push(live.loc.km);
      if (live.hist.length > 6) live.hist.shift();
      var icon = nav ? null : iconeLivre();
      if (!live.marker) {
        if (!icon) icon = iconeLivre();
        live.acc = Lf.circle(ll, { pane: 'mpCar', radius: c.accuracy || 0, weight: 1, color: '#1D63D8', fillColor: '#1D63D8', fillOpacity: 0.12, interactive: false }).addTo(map);
        live.marker = Lf.marker(ll, { pane: 'mpCar', icon: icon, keyboard: false, interactive: false }).addTo(map);
        map.setView(ll, Math.max(map.getZoom(), 15), { animate: !reduced() });
      } else {
        live.marker.setLatLng(ll);
        if (icon) { live.marker.setIcon(icon); live.navIco = false; }
        live.acc.setLatLng(ll).setRadius(c.accuracy || 0);
        if (live.follow && !nav) map.panTo(ll, { animate: !reduced(), duration: 0.6 });
      }
      if (nav) navTick();
      updateLive();
    }
    function iconeLivre() {
      var r = rumoLivre();
      return Lf.divIcon({ className: 'mp-car', iconSize: [34, 34], iconAnchor: [17, 17], html: r == null ? ICON.dot : ICON.car.replace('<svg ', '<svg style="transform:rotate(' + Math.round(r) + 'deg)" ') });
    }
    function direction() {
      var h = live.hist;
      if (h.length < 2) return 0;
      var d = h[h.length - 1] - h[0];
      return Math.abs(d) < 0.015 ? 0 : d > 0 ? 1 : -1;
    }
    function updateLive() {
      if (nav) { navUi(); return; }
      if (!live.watch && !live.err) return;
      if (live.err && !live.loc) { liveCard('<p class="mp-err">' + esc(live.err) + '</p><div class="mp-row"><button class="mp-btn" type="button" data-mp="close-live">Fechar</button></div>'); return; }
      var loc = live.loc;
      if (!loc) return;
      var h = '';
      if (loc.dist > 2000) {
        h += '<div class="mp-stamp">Fora da ' + esc(rodovia) + '</div><div class="mp-sub">' + nf(loc.dist / 1000, 1) + ' km do eixo · ponto mais próximo no km ' + km2(loc.km) + '</div>';
      } else {
        h += '<div class="mp-stamp">' + esc(stamp(rodovia, loc)) + '</div>';
        h += '<div class="mp-sub">' + coordDnit(live.ll) + (live.speed != null && isFinite(live.speed) ? ' · ' + Math.round(live.speed * 3.6) + ' km/h' : '') + (live.accuracy ? ' · precisão ' + Math.round(live.accuracy) + ' m' : '') + '</div>';
        var dir = direction(), here = null, ahead = null, behind = null;
        pts.forEach(function (x) {
          if (loc.km >= x.p.kmIni - 0.02 && loc.km <= x.kf + 0.02) here = x;
          if (x.p.kmIni > loc.km && (!ahead || x.p.kmIni < ahead.p.kmIni)) ahead = x;
          if (x.kf < loc.km && (!behind || x.kf > behind.kf)) behind = x;
        });
        if (here) h += '<div class="mp-next" style="color:' + here.info.color + '">Você está no ' + esc(here.p.nome) + ' · km ' + km2(here.p.kmIni) + ' a ' + km2(here.kf) + '</div>';
        var next = dir < 0 ? behind : ahead;
        if (next) {
          var kmTo = dir < 0 ? next.kf : next.p.kmIni;
          h += '<div class="mp-next">' + (dir === 0 ? 'Próximo no sentido do km crescente: ' : 'Próximo: ') + esc(next.p.nome) + ' em ' + nf(Math.abs(kmTo - loc.km), 1) + ' km (km ' + km2(kmTo) + ')</div>';
        }
      }
      if (live.err) h += '<p class="mp-err">' + esc(live.err) + '</p>';
      h += '<div class="mp-row"><button class="mp-btn" type="button" data-mp="follow" aria-pressed="' + live.follow + '">Seguir veículo</button><button class="mp-btn" type="button" data-mp="gps-stop">Parar</button></div>';
      liveCard(h);
    }
    map.on('dragstart', function () { if (live.watch && live.follow) { live.follow = false; updateLive(); } });

    // ---------------- rota dentro do app
    // Na BR-230 a rota segue o eixo do SNV e funciona sem internet. Fora da rodovia, com internet, o caminho vem do OSRM
    // (servidor público com os dados do OpenStreetMap), com as manobras em português; sem internet, vai em linha reta até
    // o ponto mais próximo da rodovia e segue por ela. Saindo da rota, recalcula.
    var VOZ_KEY = 'diagrama-linear.nav-voz', NORTE_KEY = 'diagrama-linear.nav-norte';
    var OSRM = ['https://router.project-osrm.org/route/v1/driving/', 'https://routing.openstreetmap.de/routed-car/route/v1/driving/'];
    var nav = null;
    // cidades ao longo do eixo (nomes do SNV), para o "em direção a"
    var cidades = [], travessias = [];
    snv.segmentos.forEach(function (s) {
      [[s.kmIni, s.de], [s.kmFim, s.ate]].forEach(function (pr) {
        var t = String(pr[1] || ''), m = /\(([^)]+)\)/.exec(t), n = m ? m[1] : (/^(INÍCIO|INICIO|FIM|FINAL|ENTR|AV\.)/.test(t) ? '' : t);
        if (/^P\s*\//.test(n)) n = '';
        n = n.replace(/^ACESSO (LESTE|OESTE) /, '').toLowerCase().replace(/(^|\s)(\S)/g, function (a, b, c2) { return b + c2.toUpperCase(); }).replace(/ (De|Do|Da|Dos|Das) /g, function (a) { return a.toLowerCase(); });
        if (n && !cidades.some(function (x) { return x.n === n; })) cidades.push({ km: pr[0], n: n });
      });
      if (/^IN[ÍI]CIO TRAVESSIA/.test(s.de || '')) travessias.push({ km: s.kmIni, n: (/RIO ([^(]+)/.exec(s.de) || [0, ''])[1].trim() });
    });
    function sentido(kmA, kmB) {
      var up = kmB >= kmA, c = cidades.filter(function (x) { return up ? x.km > kmA + 0.5 : x.km < kmA - 0.5; }).sort(function (a, b) { return up ? a.km - b.km : b.km - a.km; })[0];
      return c ? c.n : (up ? 'km crescente' : 'km decrescente');
    }
    function fmtDist(m) { return m < 1000 ? Math.max(10, Math.round(m / 10) * 10) + ' m' : nf(m / 1000, m < 10000 ? 1 : 0) + ' km'; }
    function fmtTempo(s) { var m = Math.max(1, Math.round(s / 60)); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : ''); }
    function hora(s) { var d = new Date(Date.now() + s * 1000); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
    function montaRota(pts, passos, fonte, dur) {
      var cum = [0];
      for (var i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
      return { pts: pts, cum: cum, total: cum[cum.length - 1] || 0, passos: passos, fonte: fonte, dur: dur };
    }
    // ponto da rota mais perto da posição: distância lateral (d) e quanto já andou na rota (s)
    function naRota(rt, ll) {
      var k = Math.cos(ll[0] * Math.PI / 180), f = Math.PI / 180 * R, best = null;
      for (var i = 0; i < rt.pts.length - 1; i++) {
        var A = rt.pts[i], B = rt.pts[i + 1];
        var ax = (A[1] - ll[1]) * f * k, ay = (A[0] - ll[0]) * f, bx = (B[1] - ll[1]) * f * k, by = (B[0] - ll[0]) * f;
        var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = l2 ? -(ax * dx + ay * dy) / l2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        var x = ax + t * dx, y = ay + t * dy, d = Math.sqrt(x * x + y * y);
        if (!best || d < best.d) best = { d: d, i: i, t: t, s: rt.cum[i] + t * (rt.cum[i + 1] - rt.cum[i]) };
      }
      return best || { d: 0, i: 0, t: 0, s: 0 };
    }
    // rota pelo eixo do SNV (sem internet); deLl: posição fora da rodovia, ligada em linha reta
    function rotaEixo(kmA, alvo, deLl) {
      var kmB = alvo.km, line = ref.slice(kmA, kmB);
      if (kmB < kmA) line.reverse();
      var pts = deLl ? [deLl].concat(line) : line, passos = [], rod = 'pela ' + rodovia + ' em direção a ' + sentido(kmA, kmB);
      if (deLl) passos.push({ s: 0, t: 'Vá até a ' + rodovia + ' (' + fmtDist(dist(deLl, line[0])) + ' em linha reta)', tipo: 'reto', sub: 'Sem internet para calcular o caminho até a rodovia' });
      var rt = montaRota(pts, passos, deLl ? 'reta' : 'eixo', null);
      rt.passos.push({ s: deLl ? dist(deLl, line[0]) : 0, t: (deLl ? 'Na rodovia, siga ' : 'Siga ') + rod, tipo: deLl ? (kmB >= kmA ? 'dir' : 'esq') : 'reto' });
      travessias.forEach(function (tv) {
        if ((tv.km - kmA) * (tv.km - kmB) < 0) rt.passos.push({ s: naRota(rt, ref.at(tv.km)).s, t: 'Travessia do rio ' + (tv.n ? tv.n.charAt(0) + tv.n.slice(1).toLowerCase() : '') + ' (balsa)', tipo: 'balsa' });
      });
      rt.passos.push({ s: rt.total, t: 'Chegada: ' + alvo.nome, tipo: 'chegada' });
      rt.passos.sort(function (a, b) { return a.s - b.s; });
      return rt;
    }
    var MOD = { uturn: 'Faça o retorno', 'sharp right': 'Vire bem à direita', right: 'Vire à direita', 'slight right': 'Mantenha-se à direita', straight: 'Siga em frente', 'slight left': 'Mantenha-se à esquerda', left: 'Vire à esquerda', 'sharp left': 'Vire bem à esquerda' };
    var MOD_ICO = { uturn: 'volta', 'sharp right': 'dir', right: 'dir', 'slight right': 'ldir', straight: 'reto', 'slight left': 'lesq', left: 'esq', 'sharp left': 'esq' };
    function manobra(m, rua) {
      var na = rua ? ' na ' + rua : '', pela = rua ? ' pela ' + rua : '', mod = m.modifier || '';
      switch (m.type) {
        case 'depart': return { t: 'Siga' + pela, tipo: 'reto' };
        case 'arrive': return { t: 'Chegada ao destino', tipo: 'chegada' };
        case 'roundabout': case 'rotary': case 'roundabout turn': case 'exit roundabout': case 'exit rotary':
          return { t: 'Na rotatória, pegue a ' + (m.exit ? m.exit + 'ª saída' : 'saída') + (rua ? ' para ' + rua : ''), tipo: 'rotat' };
        case 'new name': case 'continue': return MOD[mod] && mod !== 'straight' ? { t: MOD[mod] + na, tipo: MOD_ICO[mod] } : { t: 'Continue' + pela, tipo: 'reto' };
        case 'merge': return { t: 'Entre' + na, tipo: MOD_ICO[mod] || 'reto' };
        case 'on ramp': return { t: 'Pegue o acesso' + (rua ? ' para ' + rua : ''), tipo: MOD_ICO[mod] || 'ldir' };
        case 'off ramp': return { t: 'Pegue a saída' + (rua ? ' para ' + rua : ''), tipo: MOD_ICO[mod] || 'ldir' };
        case 'fork': return { t: (mod.indexOf('left') >= 0 ? 'Na bifurcação, mantenha-se à esquerda' : mod.indexOf('right') >= 0 ? 'Na bifurcação, mantenha-se à direita' : 'Na bifurcação, siga') + na, tipo: MOD_ICO[mod] || 'reto' };
        default: return { t: (MOD[mod] || 'Siga') + na, tipo: MOD_ICO[mod] || 'reto' };
      }
    }
    function rotaOsrm(r, alvo) {
      var pts = r.geometry.coordinates.map(function (c) { return [c[1], c[0]]; }), s = 0, passos = [];
      ((r.legs && r.legs[0] && r.legs[0].steps) || []).forEach(function (st) {
        var mb = manobra(st.maneuver || {}, st.ref || st.name || '');
        if ((st.maneuver || {}).type === 'arrive') mb.t = 'Chegada: ' + alvo.nome;
        passos.push({ s: s, t: mb.t, tipo: mb.tipo });
        s += st.distance || 0;
      });
      var rt = montaRota(pts, passos, 'osrm', r.duration);
      if (!passos.length || passos[passos.length - 1].tipo !== 'chegada') rt.passos.push({ s: rt.total, t: 'Chegada: ' + alvo.nome, tipo: 'chegada' });
      return rt;
    }
    function pedeOsrm(de, para, i) {
      i = i || 0;
      var url = OSRM[i] + de[1].toFixed(6) + ',' + de[0].toFixed(6) + ';' + para[1].toFixed(6) + ',' + para[0].toFixed(6) + '?overview=full&geometries=geojson&steps=true&alternatives=false';
      var ctl = window.AbortController ? new AbortController() : null, tm = setTimeout(function () { if (ctl) ctl.abort(); }, 9000);
      return fetch(url, ctl ? { signal: ctl.signal } : {}).then(function (r) {
        clearTimeout(tm);
        if (!r.ok) throw new Error('http ' + r.status);
        return r.json();
      }).then(function (j) {
        if (!j || j.code !== 'Ok' || !j.routes || !j.routes[0]) throw new Error('sem rota');
        return j.routes[0];
      }).catch(function (e) {
        clearTimeout(tm);
        if (i + 1 < OSRM.length) return pedeOsrm(de, para, i + 1);
        throw e;
      });
    }
    function fala(t) {
      if (!nav || !nav.voz || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
      try {
        var u = new SpeechSynthesisUtterance(String(t).replace(/BR-(\d+)\/[A-Z]{2}/g, 'BR $1').replace(/km (\d+),(\d+)/g, 'quilômetro $1 vírgula $2'));
        u.lang = 'pt-BR';
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      } catch (e) { /* sem voz */ }
    }
    function distFala(m) { return m >= 1000 ? nf(m / 1000, m >= 10000 ? 0 : 1).replace(/,0$/, '') + ' quilômetros' : Math.max(50, Math.round(m / 50) * 50) + ' metros'; }
    function startNav(alvo) {
      if (!opts.gps || !navigator.geolocation) { notify('A rota dentro do app precisa da localização do aparelho. Use o link do Google Maps.'); return; }
      if (alvo.km == null || !isFinite(alvo.km)) return;
      if (nav) navStop();
      map.closePopup();
      alvo.ll = ref.at(alvo.km);
      nav = { alvo: alvo, rota: null, pedindo: false, ultPlano: 0, fora: 0, falou: {}, voz: lsGet(VOZ_KEY) !== '0', gpsNosso: !live.watch, chegou: false, s: 0 };
      nav.lay = {
        caso: Lf.polyline([], { pane: 'mpRota', color: '#FFFFFF', weight: 12, opacity: 0.95, interactive: false, lineJoin: 'round', lineCap: 'round' }).addTo(map),
        linha: Lf.polyline([], { pane: 'mpRota', color: '#1A73E8', weight: 7, interactive: false, lineJoin: 'round', lineCap: 'round' }).addTo(map),
        alvo: Lf.marker(alvo.ll, { pane: 'mpCar', keyboard: false, interactive: false, icon: Lf.divIcon({ className: 'mp-alvo', iconSize: [30, 38], iconAnchor: [15, 36], html: ICON.pin }) }).addTo(map)
      };
      if (nav.voz) fala('Calculando a rota');   // dentro do toque: libera a voz no iPhone
      ligaBussola();
      if (!live.watch) startGps(); else live.follow = true;
      if (!isFull && window.matchMedia && window.matchMedia('(pointer:coarse)').matches) openFull();
      navUi();
      if (live.ll) planeja(false);
    }
    function planeja(re) {
      if (!nav || !live.ll || nav.pedindo) return;
      var n = nav, alvo = n.alvo, de = live.ll, loc = live.loc;
      n.pedindo = true; n.ultPlano = Date.now(); n.fora = 0;
      function pronto(rt) {
        if (nav !== n) return;
        n.pedindo = false; n.rota = rt; n.falou = {};
        if (!re) live.follow = true;
        navTick();
        var p0 = rt.passos.filter(function (p) { return p.s > 15; })[0], atual = rt.passos[0];
        if (atual && atual.tipo !== 'chegada') fala((re ? 'Rota recalculada. ' : '') + atual.t + '. Destino a ' + distFala(rt.total) + '.');
        else if (p0) fala(p0.t);
      }
      var noEixo = loc && loc.dist <= 300;
      if (noEixo) { pronto(rotaEixo(loc.km, alvo, null)); return; }
      navUi();
      var semNet = function () { pronto(rotaEixo(loc ? loc.km : ref.locate(de[0], de[1]).km, alvo, de)); };
      if (navigator.onLine === false) { semNet(); return; }
      pedeOsrm(de, alvo.ll).then(function (r) { pronto(rotaOsrm(r, alvo)); }, semNet);
    }
    function navTick() {
      if (!nav || !live.ll) return;
      var n = nav;
      if (!n.rota) { planeja(false); navUi(); return; }
      if (n.chegou) { n.carLL = live.ll; desenhaSeta(); navUi(); if (live.follow) segue(16); return; }
      var rt = n.rota, pr = naRota(rt, live.ll), lim = Math.max(60, (live.accuracy || 0) * 1.5);
      n.fora = pr.d > lim ? n.fora + 1 : 0;
      if (n.fora >= 3 && Date.now() - n.ultPlano > 20000) { planeja(true); }
      n.s = pr.s;
      n.resta = Math.max(0, rt.total - pr.s);
      if (n.resta < 40 || dist(live.ll, n.alvo.ll) < 35) { chegou(); return; }
      var idx = -1;
      for (var i = 0; i < rt.passos.length; i++) if (rt.passos[i].s > pr.s + 15) { idx = i; break; }
      if (idx < 0) idx = rt.passos.length - 1;
      n.idx = idx;
      n.prox = rt.passos[idx];
      n.atual = rt.passos[Math.max(0, idx - 1)];
      n.dProx = Math.max(0, n.prox.s - pr.s);
      // falta da rota: do ponto atual até o fim
      var A = rt.pts[pr.i], B = rt.pts[Math.min(pr.i + 1, rt.pts.length - 1)], aqui = [A[0] + pr.t * (B[0] - A[0]), A[1] + pr.t * (B[1] - A[1])];
      // a seta fica sobre a rota quando o GPS está perto dela; parado, aponta para o sentido da rota
      n.carLL = pr.d <= lim ? aqui : live.ll;
      n.rumo = andando() ? live.heading : bussolaFresca() ? bus.h : dist(A, B) > 1 ? bearing(A, B) : (live.heading || 0);
      desenhaSeta();
      var resto = [aqui].concat(rt.pts.slice(pr.i + 1));
      n.lay.caso.setLatLngs(resto);
      n.lay.linha.setLatLngs(resto);
      // voz: a 2 km (em trechos longos), a 500 m e na hora da manobra
      if (n.voz && idx > 0) {
        var ths = [2000, 500, 90], leg = n.prox.s - (rt.passos[idx - 1] ? rt.passos[idx - 1].s : 0);
        for (var j = ths.length - 1; j >= 0; j--) {
          if (n.dProx <= ths[j]) {
            var key = idx + ':' + ths[j];
            if (!n.falou[key]) {
              for (var j2 = 0; j2 <= j; j2++) n.falou[idx + ':' + ths[j2]] = 1;
              if (!(ths[j] === 2000 && leg < 3000)) fala(ths[j] === 90 ? n.prox.t : 'Em ' + distFala(n.dProx) + ', ' + n.prox.t.charAt(0).toLowerCase() + n.prox.t.slice(1));
            }
            break;
          }
        }
      }
      navUi();
      if (live.follow) segue();
    }
    function chegou() {
      if (!nav || nav.chegou) return;
      nav.chegou = true;
      nav.lay.caso.setLatLngs([]);
      nav.lay.linha.setLatLngs([]);
      fala('Você chegou. ' + nav.alvo.nome);
      navUi();
    }
    function navStop() {
      if (!nav) return;
      var n = nav;
      nav = null;
      if (n.lay) { map.removeLayer(n.lay.caso); map.removeLayer(n.lay.linha); map.removeLayer(n.lay.alvo); }
      giraDesliga();
      if (live.marker && live.ll) { live.marker.setLatLng(live.ll).setIcon(iconeLivre()); live.navIco = false; }
      try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* nada */ }
      navUi();
      if (n.gpsNosso && live.watch) stopGps(); else updateLive();
    }
    function navUi() {
      var top = q('.mp-navtop'), bot = q('.mp-navbot'), centro = q('.mp-centro');
      root.classList.toggle('mp-navon', !!nav);
      root.classList.toggle('mp-lado', !!nav && root.clientWidth > root.clientHeight * 1.15);
      top.hidden = bot.hidden = !nav;
      centro.hidden = !nav || live.follow || !live.ll;
      if (!nav) { top.innerHTML = bot.innerHTML = ''; return; }
      var n = nav, bv = q('[data-mp="nav-voz"]'), bn = q('[data-mp="nav-norte"]');
      bv.setAttribute('aria-pressed', String(n.voz)); bv.innerHTML = n.voz ? ICON.voz : ICON.mudo;
      bv.title = n.voz ? 'Voz ligada (toque para silenciar)' : 'Voz desligada (toque para ligar)'; bv.setAttribute('aria-label', bv.title);
      bn.setAttribute('aria-pressed', String(norteCima));
      bn.title = norteCima ? 'Norte para cima (toque para a direção do carro)' : 'Direção do carro para cima (toque para norte)'; bn.setAttribute('aria-label', bn.title);
      if (n.chegou) {
        top.innerHTML = NAV_ICO.chegada + '<div class="mp-nav-txt"><b>Você chegou</b><span>' + esc(n.alvo.nome) + '</span></div>';
        bot.innerHTML = (live.loc && live.loc.dist < 2000 ? '<div class="mp-stamp">' + esc(stamp(rodovia, live.loc)) + '</div>' : '') +
          '<div class="mp-row">' + (opts.onPhoto ? '<button class="mp-btn" type="button" data-mp="foto" data-pid="' + esc(n.alvo.pid || '') + '">' + ICON.cam + 'Foto com carimbo</button>' : '') +
          '<button class="mp-btn mp-fim" type="button" data-mp="nav-fim">Encerrar</button></div>';
        return;
      }
      if (!n.rota) {
        top.innerHTML = NAV_ICO.rotat.replace('<circle', '<circle opacity=".5"') + '<div class="mp-nav-txt"><span>' + (live.err && !live.ll ? esc(live.err) : live.ll ? 'Calculando a rota…' : 'Procurando o GPS…') + '</span><small>Até ' + esc(n.alvo.nome) + '</small></div>';
        bot.innerHTML = '<div class="mp-row"><button class="mp-btn mp-fim" type="button" data-mp="nav-fim">Cancelar</button></div>';
        return;
      }
      var rt = n.rota, longe = n.dProx > 1500, ico = NAV_ICO[(longe ? n.atual : n.prox).tipo] || NAV_ICO.reto;
      var sub = longe && n.atual && n.atual !== n.prox ? n.atual.t : (n.prox.sub || '');
      top.innerHTML = ico + '<div class="mp-nav-txt"><b>' + fmtDist(n.dProx) + '</b><span>' + esc(n.prox.t) + '</span>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>';
      var seg = rt.dur ? rt.dur * n.resta / Math.max(1, rt.total) : n.resta / (55 / 3.6);
      var fonte = rt.fonte === 'osrm' ? 'Caminho pelo OpenStreetMap' : rt.fonte === 'reta' ? 'Sem internet: linha reta até a rodovia' : 'Pela ' + rodovia + ' (eixo do SNV), funciona sem internet';
      // como no Google Maps: o tempo em destaque, distância e hora de chegada embaixo, e o Sair ao lado
      bot.innerHTML = '<div class="mp-nb"><div class="mp-nb-t"><b>' + fmtTempo(seg) + '</b><small>' + fmtDist(n.resta) + ' · chegada ' + hora(seg) + '</small></div>' +
        '<button class="mp-btn mp-fim" type="button" data-mp="nav-fim">Sair</button></div>' +
        '<small class="mp-nb-x">' + esc(n.alvo.nome) + (live.loc && live.loc.dist < 2000 ? ' · você no km ' + km2(live.loc.km) : '') + ' · ' + esc(fonte) + '</small>';
      // créditos e escala do mapa sobem para cima do cartão (em pé)
      root.style.setProperty('--mp-nb-h', bot.offsetHeight + 'px');
    }
    function visaoGeral() {
      if (!nav) return;
      live.follow = false;
      giraDesliga();
      navUi();
      var b = nav.rota && nav.rota.pts.length > 1 ? Lf.latLngBounds(nav.rota.pts) : Lf.latLngBounds([nav.alvo.ll].concat(live.ll ? [live.ll] : []));
      var L = livre(), W = root.clientWidth, H = root.clientHeight;
      map.fitBounds(b, { animate: !reduced(), paddingTopLeft: [L.x0 + 12, L.y0 + 12], paddingBottomRight: [W - L.x1 + 12, H - L.y1 + 12], maxZoom: 16 });
    }

    // ---------------- câmera da navegação
    // área do mapa que nenhum painel cobre (px dentro do .mp); a seta fica na parte de baixo dela
    var norteCima = lsGet(NORTE_KEY) === '1';
    var gira = { on: false, ang: 0, P: null, S: 0 }, mapEl = q('.mp-map');
    function livre() {
      var W = root.clientWidth, H = root.clientHeight, rr = root.getBoundingClientRect();
      var t = q('.mp-navtop').getBoundingClientRect(), b = q('.mp-navbot').getBoundingClientRect(), tl = q('.mp-tools').getBoundingClientRect();
      if (root.classList.contains('mp-lado')) {
        var x0 = Math.max(t.width ? t.right : 0, b.width ? b.right : 0) - rr.left;
        return { x0: x0 + 8, x1: (tl.width ? tl.left - rr.left : W) - 8, y0: 8, y1: H - 8 };
      }
      return { x0: 8, x1: W - 8, y0: (t.height ? t.bottom - rr.top : 0) + 8, y1: (b.height ? b.top - rr.top : H) - 8 };
    }
    function pontoCarro() {
      var L = livre();
      return root.classList.contains('mp-lado') ? [Math.round((L.x0 + L.x1) / 2), Math.round(L.y0 + (L.y1 - L.y0) * 0.68)]
        : [Math.round(root.clientWidth / 2), Math.round(L.y0 + (L.y1 - L.y0) * 0.72)];
    }
    // o quadro do mapa vira um quadrado em volta da seta, grande o bastante para cobrir a tela em qualquer ângulo, e gira
    function giraLiga(ang) {
      var P = pontoCarro(), W = root.clientWidth, H = root.clientHeight;
      var r = Math.ceil(Math.max(Math.hypot(P[0], P[1]), Math.hypot(W - P[0], P[1]), Math.hypot(P[0], H - P[1]), Math.hypot(W - P[0], H - P[1]))) + 8;
      if (!gira.on || !gira.P || Math.abs(gira.P[0] - P[0]) > 20 || Math.abs(gira.P[1] - P[1]) > 20 || gira.S < 2 * r) {
        gira.on = true; gira.P = P; gira.S = 2 * r;
        root.classList.add('mp-girando'); mapEl.classList.add('mp-gira');
        mapEl.style.width = mapEl.style.height = gira.S + 'px';
        mapEl.style.left = (P[0] - r) + 'px'; mapEl.style.top = (P[1] - r) + 'px';
        map.invalidateSize({ pan: false });
      }
      // pela menor volta: o ângulo acumula (de 359° para 1° gira 2°, não 358°)
      var d = ((ang - gira.ang) % 360 + 540) % 360 - 180;
      if (Math.abs(d) < 1 && mapEl.style.transform) return;
      gira.ang += d;
      mapEl.style.transform = 'rotate(' + (-gira.ang).toFixed(1) + 'deg)';
      root.style.setProperty('--mp-crot', gira.ang.toFixed(1) + 'deg');
      bussola();
      if (Math.abs(d) >= 2) giraRotulos();
    }
    function giraDesliga() {
      if (!gira.on) return;
      var car = nav && nav.carLL || live.ll, P = gira.P, z = map.getZoom();
      gira.on = false; gira.ang = 0; gira.P = null; gira.S = 0;
      root.classList.remove('mp-girando'); mapEl.classList.remove('mp-gira');
      mapEl.style.cssText = '';
      root.style.removeProperty('--mp-crot');
      map.invalidateSize({ pan: false });
      if (car && P) centraEm(car, P, z, false);
      bussola();
      giraRotulos();
    }
    // põe o ponto ll na posição P da tela (mapa reto)
    function centraEm(ll, P, z, anim) {
      var W = root.clientWidth, H = root.clientHeight, pt = map.project(ll, z).subtract(Lf.point(P[0] - W / 2, P[1] - H / 2));
      map.setView(map.unproject(pt, z), z, { animate: !!anim && !reduced() });
    }
    // os nomes (km, pontos, lugares) ficam em pé com o mapa girado
    function giraRotulos() {
      map.eachLayer(function (l) { var tt = l.getTooltip && l.getTooltip(); if (tt && tt._map && tt._container && tt._latlng) tt._updatePosition(); });
    }
    function bussola() {
      var sv = q('[data-mp="nav-norte"] svg');
      if (sv) sv.style.transform = gira.on ? 'rotate(' + (-gira.ang).toFixed(1) + 'deg)' : '';
    }
    function desenhaSeta() {
      if (!nav || !live.marker) return;
      var ll = nav.carLL || live.ll;
      if (!live.navIco) { live.marker.setIcon(Lf.divIcon({ className: 'mp-navcar', iconSize: [44, 44], iconAnchor: [22, 22], html: ICON.navcar })); live.navIco = true; live.rumoSeta = 0; }
      live.marker.setLatLng(ll);
      var d = (((nav.rumo || 0) - (live.rumoSeta || 0)) % 360 + 540) % 360 - 180;
      live.rumoSeta = (live.rumoSeta || 0) + d;
      var sv = live.marker.getElement() && live.marker.getElement().querySelector('svg');
      if (sv) sv.style.transform = 'rotate(' + live.rumoSeta.toFixed(1) + 'deg)';
    }
    // a câmera segue a seta: perto quando devagar, mais longe na estrada
    function segue(zFixo) {
      var ll = nav && nav.carLL || live.ll;
      if (!ll) return;
      var v = live.speed || 0, z = zFixo || (v > 22 ? 15 : v > 11 ? 16 : 17);
      if (norteCima || !nav) { giraDesliga(); centraEm(ll, pontoCarro(), z, true); return; }
      giraLiga(nav.rumo || 0);
      map.setView(ll, z, { animate: !reduced() });
    }
    window.addEventListener('resize', function () { if (nav) { gira.P = null; setTimeout(function () { navUi(); if (live.follow) segue(); }, 150); } });
    // tocar no mapa girado: para de seguir e o mapa volta reto (o toque do Leaflet já conta com o quadro normal)
    root.addEventListener('pointerdown', function (e) {
      if (gira.on && e.target.closest && e.target.closest('.mp-map')) { live.follow = false; giraDesliga(); navUi(); }
    }, true);

    // ---------------- eventos
    root.addEventListener('click', function (e) {
      var chip = e.target.closest('.mp-chip');
      if (chip) { focusPoint(Number(chip.dataset.i)); return; }
      var base = e.target.closest('[data-base]');
      if (base) { setBase(base.dataset.base); basesMenu(false); return; }
      var b = e.target.closest('[data-mp]');
      if (!(b && b.dataset.mp === 'bases')) basesMenu(false);
      if (!b) return;
      var act = b.dataset.mp;
      if (act === 'bases') { var g = q('.mp-bases'); basesMenu(g && g.hidden); return; }
      if (act === 'rota') { startNav({ km: Number(b.dataset.km), nome: b.dataset.nome || 'destino', pid: b.dataset.pid || '' }); return; }
      if (act === 'nav-fim') { navStop(); return; }
      if (act === 'nav-ver') { visaoGeral(); return; }
      if (act === 'nav-norte') { norteCima = !norteCima; lsSet(NORTE_KEY, norteCima ? '1' : '0'); live.follow = true; navUi(); segue(); return; }
      if (act === 'nav-voz') { if (nav) { nav.voz = !nav.voz; lsSet(VOZ_KEY, nav.voz ? '1' : '0'); if (!nav.voz) try { window.speechSynthesis.cancel(); } catch (e2) { /* nada */ } navUi(); } return; }
      if (act === 'mais') { var tl = q('.mp-tools'), ab = !tl.classList.contains('abertas'); tl.classList.toggle('abertas', ab); b.setAttribute('aria-expanded', String(ab)); pedeArrumar(); return; }
      if (act === 'full') { if (isFull) closeFull(); else openFull(); }
      else if (act === 'fit') fit();
      else if (act === 'kml') exportKml();
      else if (act === 'foto') { if (opts.onPhoto) opts.onPhoto(b.dataset.pid || ''); }
      else if (act === 'abrir') { if (opts.onOpen) { map.closePopup(); opts.onOpen(b.dataset.pid || ''); } }
      else if (act === 'gps') {
        if (!opts.gps) { if (q('.mp-live').hidden) noGpsCard(); else liveCard(''); setGpsBtn(); }
        else if (live.watch) stopGps(); else startGps();
      }
      else if (act === 'gps-stop') stopGps();
      else if (act === 'close-live') { live.err = ''; liveCard(''); setGpsBtn(); }
      else if (act === 'follow') { live.follow = !live.follow; if (live.follow && live.ll) { if (nav) { navUi(); segue(); } else map.panTo(live.ll); } updateLive(); }
    });
    map.on('click', function () { basesMenu(false); });
    q('.mp-find').addEventListener('submit', function (e) { e.preventDefault(); goKm(q('#mpFindKm').value); });

    return {
      render: render,
      show: function () { setTimeout(function () { map.invalidateSize(); if (!bounds || fitPend) fit(); }, 30); },
      invalidate: function () { map.invalidateSize(); },
      openFull: openFull,
      closeFull: closeFull,
      isFull: function () { return isFull; },
      exportKml: exportKml,
      buildKml: buildKml,
      // abre o ponto pelo id (vindo da visão geral)
      foco: function (id) { for (var j = 0; j < pts.length; j++) if (pts[j].p.id === id) { focusPoint(j); return true; } return false; },
      ref: ref,
      map: map
        };
  }

  MapaSNV.Ref = Ref;
  window.MapaSNV = MapaSNV;
})();
