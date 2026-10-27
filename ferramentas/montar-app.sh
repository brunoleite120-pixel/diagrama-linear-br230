#!/usr/bin/env bash
# Monta a pasta do app (o "www" do Capacitor) a partir do site. Usada pelas compilações iOS e Android e pelo pacote de
# atualização pelo servidor (pages.yml), para os três saírem iguais.
#   ferramentas/montar-app.sh <pasta do site (checkout git)> <pasta de destino> <oficial|previa> "<texto da versão>"
# Precisa de npm install feito na pasta do site (bibliotecas do PDF). Funciona no Linux e no Mac.
# Grava em ambiente.js: NOME, VERSAO, PACOTE (commit curto) e ORDEM (data do commit, em segundos), que atualizar.js
# compara com o versao.json do servidor.
set -euo pipefail

SRC=$1 DEST=$2 NOME=$3 TEXTO=$4
case "$NOME" in oficial|previa) ;; *) echo "Ambiente inválido: $NOME"; exit 1 ;; esac
case "$DEST" in ""|"."|"/"|".."|"$SRC") echo "Destino inválido: $DEST"; exit 1 ;; esac
PACOTE=$(git -C "$SRC" rev-parse --short=7 HEAD)
ORDEM=$(git -C "$SRC" log -1 --format=%ct)

# sed -i que funciona no Linux e no Mac
troca() { sed -i.bak "$1" "$2" && rm -f "$2.bak"; }

rm -rf "$DEST"
mkdir -p "$DEST"
# tudo o que a página carrega (scripts do index.html), mais o manifest, as bibliotecas e os ícones
cp "$SRC/index.html" "$SRC/manifest.webmanifest" "$DEST/"
for f in $(grep -o '<script src="[^"]*"' "$SRC/index.html" | sed 's/^<script src="//; s/"$//'); do
  case "$f" in lib/*) ;; *) cp "$SRC/$f" "$DEST/" ;; esac
done
cp -R "$SRC/lib" "$SRC/icons" "$DEST/"
rm -rf "$DEST/icons/android"

# no app: a página vai até a borda da tela (o CSS desvia do relógio e do recorte) e não dá zoom
# (troca o content inteiro: desde 22/10 o site tem minimum-scale e viewport-fit, e a troca antiga não achava mais a linha)
troca 's|<meta name="viewport" content="[^"]*">|<meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, viewport-fit=cover">|' "$DEST/index.html"
grep -q 'maximum-scale=1, viewport-fit=cover' "$DEST/index.html" || { echo "Não achei a linha do viewport em index.html"; exit 1; }

# ambiente e versão do pacote
TEXTO_SED=$(printf '%s' "$TEXTO" | sed 's/[|&\\]/\\&/g')
troca "s|^  var NOME = 'oficial';|  var NOME = '$NOME';|" "$DEST/ambiente.js"
troca "s|^  var VERSAO = 'dev';|  var VERSAO = '$TEXTO_SED';|" "$DEST/ambiente.js"
troca "s|^  var PACOTE = '';|  var PACOTE = '$PACOTE';|" "$DEST/ambiente.js"
troca "s|^  var ORDEM = 0;|  var ORDEM = $ORDEM;|" "$DEST/ambiente.js"
grep -q "var NOME = '$NOME';" "$DEST/ambiente.js" || { echo "Não consegui marcar o ambiente em ambiente.js"; exit 1; }
grep -q "var PACOTE = '$PACOTE';" "$DEST/ambiente.js" || { echo "Não consegui marcar o pacote em ambiente.js"; exit 1; }
grep -q "var ORDEM = $ORDEM;" "$DEST/ambiente.js" || { echo "Não consegui marcar a ordem em ambiente.js"; exit 1; }

# bibliotecas do PDF dentro do app (gera o PDF sem internet)
cp "$SRC/node_modules/jspdf/dist/jspdf.umd.min.js" "$SRC/node_modules/svg2pdf.js/dist/svg2pdf.umd.min.js" "$DEST/lib/"

# todo script que a página carrega tem de estar no app
for f in $(grep -o '<script src="[^"]*"' "$DEST/index.html" | sed 's/^<script src="//; s/"$//'); do
  [ -f "$DEST/$f" ] || { echo "Falta no app: $f"; exit 1; }
done
# nada escondido (o plugin de atualização recusa pacote com arquivo oculto)
find "$DEST" -mindepth 1 -name '.*' -prune -exec rm -rf {} +

echo "App montado em $DEST: ambiente $NOME, pacote $PACOTE (ordem $ORDEM), versão $TEXTO"
