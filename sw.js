// Service worker do app instalado: guarda os arquivos do site para abrir sem internet na estrada.
// Arquivos do site: busca na rede primeiro (para receber as atualizações) e usa a cópia guardada
// se a rede falhar ou demorar mais de 4 s. Bibliotecas do PDF (endereço com versão fixa): cópia guardada primeiro.
// O mapa offline (osm-br230.js, OpenStreetMap) e o fundo (fundo-br230.js, MapBiomas, imagens embutidas) vêm junto;
// as imagens online (OSM/Esri) ficam no cache normal do navegador.
// A prévia (/previa/) tem o próprio service worker e o próprio cache; o do site oficial não mexe nela.
var PREVIA = /\/previa\/$/.test(self.registration.scope);
var FAMILIA = (PREVIA ? 'previa-' : '') + 'diagrama-linear-';
var CACHE = FAMILIA + 'v90';
var PASTA_PREVIA = PREVIA ? null : self.registration.scope + 'previa/';
// endereço antigo (GitHub Pages), que sai do ar quando o repositório ficar privado: com a página fora do ar (404), o app
// instalado por ele abre a cópia guardada, que mostra o aviso do endereço novo (aviso-endereco.js) e ainda envia o que ficou
// pendente neste aparelho, em vez da página de erro do GitHub
var ANTIGO = self.location.hostname === 'brunoleite120-pixel.github.io';
var SHELL = [
  './', 'index.html', 'app.js', 'banco.js', 'drive.js', 'galeria.js', 'foto.js', 'mapa.js', 'snv-br230.js', 'snv-conversao.js', 'osm-br230.js', 'tela-cheia.js', 'logo.js', 'logo-dnit.js',
  'dados-iniciais.js', 'fundo-br230.js', 'lib/leaflet.js', 'manifest.webmanifest',
  'ambiente.js', 'atualizar.js', 'relatorio.js', 'visao.js', 'medicoes.js', 'relatorio-logos.js', 'aviso-endereco.js', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'
];
var LIBS = [
  'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/svg2pdf.js@2.2.3/dist/svg2pdf.umd.min.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(SHELL).then(function () {
      return Promise.all(LIBS.map(function (u) {
        return fetch(u, { mode: 'no-cors' }).then(function (r) { return c.put(u, r); }).catch(function () { /* sem rede: guarda no primeiro uso */ });
      }));
    });
  }));
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE && k.indexOf(FAMILIA) === 0; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function cached(c, req) {
  return c.match(req, { ignoreSearch: true }).then(function (r) {
    return r || (req.mode === 'navigate' ? c.match('./') : undefined);
  });
}

function networkFirst(req) {
  return caches.open(CACHE).then(function (c) {
    return new Promise(function (resolve) {
      var done = false;
      function finish(r) { if (!done && r) { done = true; resolve(r); } }
      fetch(req).then(function (res) {
        if (res && res.ok) c.put(req, res.clone());
        if (ANTIGO && res && res.status === 404) { cached(c, req).then(function (r) { finish(r || res); }); return; }
        finish(res);
      }, function () {
        cached(c, req).then(function (r) { if (!done) { done = true; resolve(r || Response.error()); } });
      });
      setTimeout(function () { if (!done) cached(c, req).then(finish); }, 4000);
    });
  });
}

function cacheFirst(req) {
  return caches.open(CACHE).then(function (c) {
    return c.match(req).then(function (r) {
      return r || fetch(req).then(function (res) { c.put(req, res.clone()); return res; });
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (PASTA_PREVIA && req.url.indexOf(PASTA_PREVIA) === 0) return;
  if (url.origin === self.location.origin) { e.respondWith(networkFirst(req)); return; }
  if (LIBS.indexOf(req.url) >= 0) e.respondWith(cacheFirst(req));
});
