# Diagrama Linear BR-230

Acompanhamento dos pontos críticos da BR-230/PA (Lote 01 · CT 02 00314/2026 e Lote 02 · CT 02 00315/2026):
diagrama linear com exportação em PDF, mapa com o km do SNV (DNIT, versão 202607A) e GPS ao vivo, e foto com carimbo.

## Instalar no iPhone
1. Abra o endereço deste site no **Safari**.
2. Toque em **Compartilhar** e depois em **Adicionar à Tela de Início**.
3. Abra pelo ícone "Diagrama 230". Depois da primeira abertura, funciona sem internet.

## Mapa sem sinal
O botão **Offline** do mapa usa um mapa embutido no app, montado com dados do OpenStreetMap numa faixa de 5 km de cada lado
da BR-230/PA, do km 280 ao km 1000: estradas, vicinais, ruas, rios, igarapés e localidades. Ele também aparece por baixo das
imagens Mapa/Satélite quando elas não carregam. Os nomes de municípios, vilas, rios e igarapés aparecem no próprio mapa.

O fundo do mapa offline mostra a cobertura do solo (floresta, pasto, agricultura, área urbana e água) do MapBiomas 2024.

Fontes: eixo e km do SNV/DNIT (versão 202607A); estradas, rios e localidades © colaboradores do OpenStreetMap (licença ODbL);
cobertura do solo: Projeto MapBiomas, Coleção 10 (2024), licença CC-BY 4.0.

Os dados ficam guardados no próprio aparelho. Use **Dados → Salvar backup (.json)** com frequência e
**Dados → Abrir backup…** para levar os dados de um aparelho para outro.

## App iOS (TestFlight)
O mesmo site vira app nativo com o [Capacitor](https://capacitorjs.com). A compilação roda num Mac do GitHub
(`.github/workflows/ios.yml`, aba **Actions → App iOS (TestFlight) → Run workflow**) e envia o app ao TestFlight.
Identificador do app: `br.com.magnaenecon.diagrama230`. Segredos do repositório, cadastrados pelo dono da conta Apple:
`APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID` e `ASC_KEY_P8` (chave da App Store Connect API com acesso Admin).

## Atualização do app pelo servidor
Os apps iOS e Android se atualizam sozinhos pelo site, sem compilar de novo (`atualizar.js`, plugin
`@capgo/capacitor-updater` em modo manual, sem a nuvem deles e sem estatísticas). A cada publicação, o `pages.yml` monta
o pacote do app (`ferramentas/montar-app.sh`, a mesma montagem das compilações) em `app/versao.json` + `app-<commit>.zip`
(oficial) e `previa/app/...` (prévia). O app confere ao abrir e a cada 30 min de uso, baixa em segundo plano, confere o
SHA-256 e troca quando o app é aberto de novo (ou no botão **Atualizar agora**); nunca troca no meio do uso. Se a versão
nova não abrir, o plugin volta para a anterior. Só troca por versão mais nova do mesmo ambiente.
Ainda precisa compilar de novo: ícone, nome, permissões, plugins nativos novos e versão do Capacitor.
