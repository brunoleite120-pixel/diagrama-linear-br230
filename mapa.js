/*
 * Mapa do trecho pelo SNV do DNIT: eixo da BR-230/PA, km inicial e final de cada ponto crítico,
 * ida a um km qualquer, arquivo KML e, onde o navegador libera a localização, o veículo ao vivo.
 * Usado pelo site local (index.html) e embutido na página online (build.js troca o marcador).
 * Precisa do Leaflet (window.L) e dos dados do SNV (window.SNV_BR230, arquivo snv-br230.js).
 *
 *   var m = MapaSNV({ host, snv, getContract, pointInfo, saveText, tiles, gps, notify });
 *   m.show(); m.render(); m.openFull(); m.closeFull(); m.isFull(); m.exportKml();
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
    '.mp-bases{display:flex;border:1px solid var(--mp-line);border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.12)}',
    '.mp-bases .mp-btn{border:0;border-radius:0;box-shadow:none;min-height:32px;padding:4px 9px}',
    '.mp-bases .mp-btn+.mp-btn{border-left:1px solid var(--mp-line)}',
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
    '.mp .leaflet-container a.leaflet-popup-close-button{color:var(--mp-ink-3)}',
    '.mp-pop h3{margin:0 0 6px;font-size:15px;display:flex;align-items:center;justify-content:space-between;gap:8px}',
    '.mp-pop .tag{font-size:11px;font-weight:700;color:#FFFFFF;background:var(--c);border-radius:999px;padding:2px 8px;white-space:nowrap}',
    '.mp-pop dl{display:grid;grid-template-columns:repeat(3,auto);gap:2px 14px;margin:0 0 8px}',
    '.mp-pop dt{font-size:11px;color:var(--mp-ink-3)}',
    '.mp-pop dd{margin:0;font-weight:650;font-variant-numeric:tabular-nums}',
    '.mp-pop .co{font-family:var(--font-mono,ui-monospace,Consolas,monospace);font-size:12px;color:var(--mp-ink-2);margin:0 0 8px;user-select:all}',
    '.mp-pop ul{list-style:none;margin:0 0 8px;padding:0;display:grid;gap:2px}',
    '.mp-pop li{display:flex;justify-content:space-between;gap:10px;font-size:12px}',
    '.mp-pop li b{color:var(--c)}',
    '.mp-pop .links{display:flex;flex-wrap:wrap;gap:6px 12px}',
    '.mp-pop .links a{color:var(--mp-accent);font-weight:650}',
    '.mp-pop .mp-pop-foto{margin-top:10px;width:100%;justify-content:center;box-shadow:none}',
    '.mp .leaflet-control-attribution{background:rgba(255,255,255,.8);color:#333;font-size:10px}',
    '.mp .leaflet-control-attribution a{color:#1D4F91}',
    '.mp .leaflet-bar a{background:var(--mp-panel);color:var(--mp-ink);border-color:var(--mp-line)}',
    '.mp .leaflet-bottom.leaflet-right{margin-bottom:58px}',
    '@media (pointer:coarse){.mp .leaflet-control-zoom{display:none}}',
    '.mp .leaflet-control-scale-line{background:rgba(255,255,255,.75);color:#222;border-color:#333}',
    '.mp-car{width:34px;height:34px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.45))}',
    '.mp-car svg{width:34px;height:34px;transition:transform .4s}',
    '.mp-full{position:fixed;inset:0;z-index:2000;border:0;border-radius:0;min-height:0;height:auto}',
    '.mp-full .mp-top{top:calc(10px + env(safe-area-inset-top,0px));left:calc(10px + env(safe-area-inset-left,0px));right:calc(10px + env(safe-area-inset-right,0px))}',
    '.mp-full .mp-bottom{bottom:calc(22px + env(safe-area-inset-bottom,0px));left:calc(10px + env(safe-area-inset-left,0px));right:calc(10px + env(safe-area-inset-right,0px))}',
    '.mp-full .leaflet-bottom{bottom:env(safe-area-inset-bottom,0px)}',
    '@media (max-width:560px){.mp-btn .t{display:none}.mp-btn{padding:5px 8px}.mp-title b{font-size:12.5px}.mp-legend{display:none}.mp-find label{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}.mp-find input{width:104px}}',
    '@media (prefers-reduced-motion:reduce){.mp-car svg{transition:none}}'
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
    dot: '<svg viewBox="0 0 34 34" aria-hidden="true"><circle cx="17" cy="17" r="9" fill="#1D63D8" stroke="#FFFFFF" stroke-width="3"/></svg>'
  };

  function MapaSNV(opts) {
    var Lf = window.L, snv = opts.snv;
    if (!Lf || !snv || !opts.host) return null;
    injectStyle();
    var ref = Ref(snv), host = opts.host, rodovia = snv.rodovia || 'BR-230/PA';
    var notify = opts.notify || function () {};

    host.innerHTML =
      '<div class="mp" role="region" aria-label="Mapa do trecho">' +
        '<div class="mp-map"></div>' +
        '<div class="mp-top">' +
          '<div class="mp-left">' +
            '<div class="mp-title"><b class="mp-t1"></b><span class="mp-t2"></span></div>' +
            '<form class="mp-find" novalidate><label for="mpFindKm">Ir para km</label><input id="mpFindKm" inputmode="decimal" autocomplete="off" placeholder="km 812,40"><button class="mp-btn" type="submit">Ir</button></form>' +
          '</div>' +
          '<div class="mp-tools">' +
            '<button class="mp-btn" type="button" data-mp="full" title="Tela cheia">' + ICON.full + '<span class="t">Tela cheia</span></button>' +
            '<button class="mp-btn" type="button" data-mp="fit" title="Ver o trecho inteiro">' + ICON.fit + '<span class="t">Trecho</span></button>' +
            '<button class="mp-btn" type="button" data-mp="gps" aria-pressed="false" title="Posição ao vivo">' + ICON.gps + '<span class="t">Ao vivo</span></button>' +
            (opts.onPhoto ? '<button class="mp-btn" type="button" data-mp="foto" title="Foto com carimbo">' + ICON.cam + '<span class="t">Foto</span></button>' : '') +
            '<button class="mp-btn" type="button" data-mp="kml" title="Baixar KML">' + ICON.kml + '<span class="t">KML</span></button>' +
            (opts.tiles ? '<div class="mp-bases" role="group" aria-label="Fundo do mapa"></div>' : '') +
          '</div>' +
        '</div>' +
        '<div class="mp-bottom">' +
          '<div class="mp-card mp-live" hidden></div>' +
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
    map.createPane('mpRoad').style.zIndex = 410;
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
      lsSet(BASE_KEY, key);
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
      return b > a ? [a, b] : null;
    }

    function popupHtml(p, info) {
      var a = ref.at(p.kmIni), b = ref.at(p.kmFim != null ? p.kmFim : p.kmIni), len = p.kmFim != null ? Math.max(0, p.kmFim - p.kmIni) : null;
      var h = '<div class="mp-pop" style="--c:' + info.color + '">' +
        '<h3>' + esc(p.nome || 'Ponto') + '<span class="tag">' + esc(info.status) + ' · ' + esc(info.pctText) + '</span></h3>' +
        '<dl><div><dt>km inicial</dt><dd>' + km2(p.kmIni) + '</dd></div><div><dt>km final</dt><dd>' + (p.kmFim != null ? km2(p.kmFim) : '-') + '</dd></div>' +
        '<div><dt>Extensão</dt><dd>' + (len != null ? nf(len, 2) + ' km' : '-') + '</dd></div></dl>' +
        '<p class="co">Início ' + coordDnit(a) + '<br>Fim ' + coordDnit(b) + '</p>';
      if (info.servs && info.servs.length) {
        h += '<ul>' + info.servs.map(function (s) { return '<li style="--c:' + s.color + '"><span>' + esc(s.label) + '</span><b>' + esc(s.text) + '</b></li>'; }).join('') + '</ul>';
      }
      h += '<div class="links"><a href="' + routeUrl(a) + '" target="_blank" rel="noopener">Rota até o início</a><a href="' + routeUrl(b) + '" target="_blank" rel="noopener">Rota até o fim</a></div>';
      if (opts.onPhoto) h += '<button class="mp-btn mp-pop-foto" type="button" data-mp="foto" data-pid="' + esc(p.id) + '">' + ICON.cam + 'Foto com carimbo</button>';
      h += '</div>';
      return h;
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

    function render() {
      var c = opts.getContract();
      ctLayer.clearLayers(); ptsLayer.clearLayers(); lblLayer.clearLayers();
      pts = [];
      if (!c) { range = null; drawKm(); q('.mp-t1').textContent = 'Sem contrato'; q('.mp-t2').textContent = ''; q('.mp-chips').innerHTML = ''; return; }
      range = contractRange(c);
      q('.mp-t1').textContent = [c.lote, c.numero, c.rodovia || rodovia].filter(Boolean).join(' · ');
      q('.mp-t2').textContent = range
        ? 'km ' + km2(range[0]) + ' a ' + km2(range[1]) + ' · SNV ' + snv.versao
        : 'Sem km cadastrado';
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
      var sorted = c.pontos.filter(function (p) { return p.kmIni != null; }).sort(function (a, b) { return a.kmIni - b.kmIni; });
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
        group.bindPopup(function () { return popupHtml(p, opts.pointInfo(p)); }, { maxWidth: 300, autoPanPadding: [16, 60] });
        Lf.marker(mid, { opacity: 0, interactive: false, keyboard: false, icon: Lf.divIcon({ className: '', iconSize: [0, 0] }) })
          .bindTooltip(esc(p.nome), { permanent: true, direction: 'top', offset: [0, -8], className: 'mp-lbl' })
          .addTo(lblLayer);
        pts.push({ p: p, info: info, group: group, kf: kf });
      });
      renderChips();
      renderLegend();
      if (c.id !== lastCid) { lastCid = c.id; fit(); }
      drawKm();
      toggleLabels();
      if (live.loc) updateLive();
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

    function fit() {
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
        .bindPopup('<div class="mp-pop"><h3>km ' + km2(k) + '</h3><p class="co">' + coordDnit(ll) + '</p><div class="links"><a href="' + routeUrl(ll) + '" target="_blank" rel="noopener">Rota até aqui</a><a href="' + placeUrl(ll) + '" target="_blank" rel="noopener">Ver no Google Maps</a></div></div>')
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
      out.push('<name>' + xml([c.lote, c.numero, c.rodovia || rodovia].filter(Boolean).join(' · ')) + '</name>');
      out.push('<description>' + xml('Pontos críticos com km pelo SNV do DNIT, versão ' + snv.versao + '. Gerado em ' + new Date().toLocaleString('pt-BR') + '.') + '</description>');
      out.push('<Style id="rodovia"><LineStyle><color>ff1c2017</color><width>4</width></LineStyle></Style>');
      out.push('<Style id="km"><IconStyle><scale>0.5</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle><LabelStyle><scale>0.7</scale></LabelStyle></Style>');
      Object.keys(styles).forEach(function (col, i) {
        out.push('<Style id="st' + i + '"><LineStyle><color>' + kmlColor(col) + '</color><width>8</width></LineStyle><IconStyle><color>' + kmlColor(col) + '</color><scale>0.9</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle></Style>');
        styles[col] = 'st' + i;
      });
      out.push('<Folder><name>Pontos críticos</name>');
      pts.forEach(function (x) {
        var p = x.p, st = '#' + styles[x.info.color], a = ref.at(p.kmIni), b = ref.at(x.kf);
        var desc = 'km ' + km2(p.kmIni) + ' a ' + km2(x.kf) + ' (' + nf(Math.max(0, x.kf - p.kmIni), 2) + ' km)\n' +
          x.info.status + ' · ' + x.info.pctText + '\nInício ' + coordDnit(a) + '\nFim ' + coordDnit(b) +
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
      var name = ('Pontos criticos - ' + [c.lote, c.numero].filter(Boolean).join(' - ')).replace(/[\/\\:*?"<>|]+/g, '-') + '.kml';
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
      try { var r = root.requestFullscreen && root.requestFullscreen({ navigationUI: 'hide' }); if (r && r.catch) r.catch(function () {}); } catch (e) { /* sem tela cheia do navegador: fica a de página */ }
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
    function startGps() {
      if (!navigator.geolocation) { live.err = 'Este navegador não informa a localização.'; updateLive(); return; }
      live.follow = true; live.err = ''; live.hist = [];
      liveCard('<div class="mp-stamp">Procurando o GPS…</div><div class="mp-sub">Permita o acesso à localização quando o navegador perguntar.</div>');
      live.watch = navigator.geolocation.watchPosition(onFix, onFixError, { enableHighAccuracy: true, maximumAge: 2000, timeout: 30000 });
      wakeOn();
      setGpsBtn();
    }
    function stopGps() {
      if (live.watch != null && navigator.geolocation) navigator.geolocation.clearWatch(live.watch);
      live.watch = null; live.loc = null; live.ll = null;
      if (live.marker) { map.removeLayer(live.marker); live.marker = null; }
      if (live.acc) { map.removeLayer(live.acc); live.acc = null; }
      if (live.wake) { try { live.wake.release(); } catch (e) { /* nada */ } live.wake = null; }
      liveCard('');
      setGpsBtn();
    }
    function onFixError(e) {
      live.err = e && e.code === 1 ? 'A localização foi bloqueada. Libere a localização para este site nas permissões do navegador e toque em Ao vivo de novo.'
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
      var icon = Lf.divIcon({ className: 'mp-car', iconSize: [34, 34], iconAnchor: [17, 17], html: live.heading == null ? ICON.dot : ICON.car.replace('<svg ', '<svg style="transform:rotate(' + Math.round(live.heading) + 'deg)" ') });
      if (!live.marker) {
        live.acc = Lf.circle(ll, { pane: 'mpCar', radius: c.accuracy || 0, weight: 1, color: '#1D63D8', fillColor: '#1D63D8', fillOpacity: 0.12, interactive: false }).addTo(map);
        live.marker = Lf.marker(ll, { pane: 'mpCar', icon: icon, keyboard: false, interactive: false }).addTo(map);
        map.setView(ll, Math.max(map.getZoom(), 15), { animate: !reduced() });
      } else {
        live.marker.setLatLng(ll).setIcon(icon);
        live.acc.setLatLng(ll).setRadius(c.accuracy || 0);
        if (live.follow) map.panTo(ll, { animate: !reduced(), duration: 0.6 });
      }
      updateLive();
    }
    function direction() {
      var h = live.hist;
      if (h.length < 2) return 0;
      var d = h[h.length - 1] - h[0];
      return Math.abs(d) < 0.015 ? 0 : d > 0 ? 1 : -1;
    }
    function updateLive() {
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

    // ---------------- eventos
    root.addEventListener('click', function (e) {
      var chip = e.target.closest('.mp-chip');
      if (chip) { focusPoint(Number(chip.dataset.i)); return; }
      var base = e.target.closest('[data-base]');
      if (base) { setBase(base.dataset.base); return; }
      var b = e.target.closest('[data-mp]');
      if (!b) return;
      var act = b.dataset.mp;
      if (act === 'full') { if (isFull) closeFull(); else openFull(); }
      else if (act === 'fit') fit();
      else if (act === 'kml') exportKml();
      else if (act === 'foto') { if (opts.onPhoto) opts.onPhoto(b.dataset.pid || ''); }
      else if (act === 'gps') {
        if (!opts.gps) { if (q('.mp-live').hidden) noGpsCard(); else liveCard(''); setGpsBtn(); }
        else if (live.watch) stopGps(); else startGps();
      }
      else if (act === 'gps-stop') stopGps();
      else if (act === 'close-live') { live.err = ''; liveCard(''); setGpsBtn(); }
      else if (act === 'follow') { live.follow = !live.follow; if (live.follow && live.ll) map.panTo(live.ll); updateLive(); }
    });
    q('.mp-find').addEventListener('submit', function (e) { e.preventDefault(); goKm(q('#mpFindKm').value); });

    return {
      render: render,
      show: function () { setTimeout(function () { map.invalidateSize(); if (!bounds) fit(); }, 30); },
      invalidate: function () { map.invalidateSize(); },
      openFull: openFull,
      closeFull: closeFull,
      isFull: function () { return isFull; },
      exportKml: exportKml,
      buildKml: buildKml,
      ref: ref,
      map: map
        };
  }

  MapaSNV.Ref = Ref;
  window.MapaSNV = MapaSNV;
})();
