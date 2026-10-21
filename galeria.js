/*
 * Galeria de fotos do app: as guardadas neste aparelho (drive.js) e as da equipe (banco: dados e miniatura; foto inteira no Drive).
 *   No aparelho     tudo o que está guardado aqui, com a situação do envio (só aqui, na fila, subindo, no Drive) e a barra de envio
 *   Minhas          as que eu enviei, de qualquer aparelho (o analista também)
 *   Equipe          as de toda a equipe, por pessoa (engenheiro e criador)
 *   Relatório ★     as marcadas com ★ para o relatório fotográfico, que sai em PDF (relatorio.js) (engenheiro e Administrador)
 *   Lixeira         as apagadas do Drive por engenheiros (pasta Deletados do Drive; só o criador; dá para restaurar)
 * A galeria mostra só a miniatura leve; a foto inteira vem do aparelho (se estiver aqui) ou do Drive ao abrir ou baixar.
 * Período em fichas (Esta semana, 2 semanas, Mês, 3 meses, Escolher…): só filtra o que já veio do banco, a grade não recarrega.
 * Baixar várias: para o app (abrir sem sinal), para a galeria do celular (o compartilhar do celular; no computador, .zip) ou só
 * as miniaturas, com a barra de download (quantas, MB) que segue enquanto o app estiver aberto, mesmo com a galeria fechada.
 * As baixadas para o app ficam em "diagrama-linear-inteiras" (foto inteira, loja "arq", e os dados com a miniatura, loja "item"):
 * sem sinal, as abas do banco mostram essas. "Espaço e envio" (No aparelho): espaço usado, envio automático, só no Wi-Fi
 * (Android), por quanto tempo as já enviadas ficam no aparelho e liberar espaço.
 *
 * As fotos ficam separadas por contrato (fila de contratos no alto). Na foto aberta ou em várias selecionadas, "Contrato e ponto"
 * corrige o contrato e o ponto (ou ponte): no aparelho e, se já foi enviada, no banco (migração 06). Quem tirou corrige as dele;
 * engenheiro e Administrador, qualquer uma. Foto sem ponto não entra no relatório.
 * O Administrador traz para a galeria as fotos que estão no Drive e não no banco ("Trazer fotos do Drive", em Todas), e troca uma
 * vez as pastas de contrato do Drive do Lote para o nº do contrato ("Pastas do Drive pelo nº do contrato", script versão 4).
 * Restaurar da lixeira manda a pasta do contrato e do ponto, para quando a pasta original não existe mais.
 * Segurança (análise de 19/10/2026): "Abrir no Drive" monta o link pelo id do arquivo (nunca pelo endereço gravado); "Contrato e
 * ponto" grava primeiro no banco, em partes de até 300, e muda a cópia do aparelho só nas que o banco aceitou; o km que está no
 * trecho de mais de um contrato mostra todos, cada um com o seu "Passar para…" (folga de 50 m, a mesma da tela Foto); em
 * Deletados, o Administrador confere a galeria com a pasta do Drive ("Conferir com o Drive", script versão 6).
 *
 *   var g = Galeria({ drive, Banco, getLogin, nivel, driveUrl, ambiente, contratos, ativo, toast, confirmar, saveBlob, entrar, nomes });
 *   g.open({ cid, pid })   abre (opcional: já filtrada num ponto)      g.changed()   a fila do aparelho mudou
 *   g.open({ cid, pagina: true, aoFechar })   celular: a galeria vira uma página entre a barra do topo e a das páginas (app.js),
 *                          sem o "Voltar" e sem a fila de contratos (vale o contrato aberto no app); aoFechar avisa quando ela
 *                          fecha sozinha (Esc, "Entrar"). g.close(true) fecha sem avisar
 * Aba Drive (script versão 7): a pasta do Drive como ela é, por contrato (ou por pessoa) e ponto, com miniaturas; abrir baixa a
 * foto inteira (fica guardada aqui) e selecionar usa a mesma janela de baixar. Engenheiro e Administrador veem todas; os outros, as
 * que tiraram. Só lê o Drive (ver_listar, ver_minis, ver_baixar).
 * nomes: funções de nome do contrato do app.js (nome de tela, formal, pasta do Drive); sem elas, vale a cópia curta daqui.
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
    '.gl-cts{display:flex;gap:6px;padding:10px 16px 0;overflow-x:auto;scrollbar-width:none}',
    '.gl-cts::-webkit-scrollbar{display:none}',
    '.gl-cts:empty{display:none}',
    '.gl-ct{flex:none;display:flex;align-items:baseline;gap:6px;border:1px solid var(--line,#D5DAD6);background:var(--panel,#fff);color:var(--ink-2,#3B4540);border-radius:8px;padding:6px 12px;font-size:13px;font-weight:600;white-space:nowrap}',
    '.gl-ct small{font-weight:400;color:var(--ink-3,#5C6661);font-variant-numeric:tabular-nums}',
    '.gl-ct[aria-pressed="true"]{background:var(--accent,#1D4F91);border-color:var(--accent,#1D4F91);color:#fff}',
    '.gl-ct[aria-pressed="true"] small{color:#D6E2F3}',
    '.gl-ct.sem{border-style:dashed}',
    '.gl-fil{display:flex;flex-wrap:wrap;gap:8px;padding:10px 16px 0}',
    '.gl-fil select{min-height:32px;max-width:100%;padding:4px 8px;border:1px solid var(--line,#D5DAD6);border-radius:6px;background:var(--panel,#fff);font-size:13px}',
    '.gl-info{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 16px;font-size:12.5px;color:var(--ink-2,#3B4540)}',
    '.gl-info .gl-txt{flex:1 1 220px;min-width:0}',
    '.gl-info .gl-txt b{color:var(--ink,#17201C);font-weight:600}',
    '.gl-warn{color:#B54708}',
    '.gl-err{color:#B42318;font-weight:650}',
    '.gl-body{flex:1;overflow:auto;padding:0 16px calc(84px + env(safe-area-inset-bottom,0px));-webkit-overflow-scrolling:touch}',
    '.gl-g{display:flex;align-items:baseline;gap:8px;margin:14px 0 8px;font-size:13px;font-weight:650}',
    '.gl-g small{font-weight:400;color:var(--ink-3,#5C6661);font-variant-numeric:tabular-nums}',
    '.gl-g button{margin-left:auto;border:0;background:none;color:var(--accent,#1D4F91);font-size:12.5px;padding:2px 4px}',
    '.gl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(108px,1fr));gap:6px}',
    '.gl-t{position:relative;display:block;padding:0;border:0;border-radius:6px;overflow:hidden;background:var(--line-2,#E6E9E6);aspect-ratio:1/1;max-width:100%}',
    '.gl-t img{display:block;width:100%;height:100%;object-fit:cover}',
    '.gl-t .gl-cap{position:absolute;left:0;right:0;bottom:0;padding:14px 6px 4px;background:linear-gradient(transparent,rgba(0,0,0,.7));color:#fff;font-size:11px;line-height:1.25;text-align:left}',
    // legenda em duas linhas: ponto e km na frente (em destaque); embaixo o dia (ou a hora) e quem tirou
    '.gl-cap b,.gl-cap span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.gl-cap b{font-size:12px;font-weight:700}',
    '.gl-cap span{color:#E3E8E5}',
    // período: botão ao lado dos filtros, faixa da semana (‹ ›) e a janela que sobe de baixo
    '.gl-per{display:flex;align-items:center;gap:6px;min-height:32px;max-width:100%;padding:4px 10px;border:1px solid var(--line,#D5DAD6);border-radius:6px;background:var(--panel,#fff);color:var(--ink,#17201C);font-size:13px;font-weight:600}',
    '.gl-per.on{border:2px solid var(--accent,#1D4F91);background:var(--accent-soft,#E7EEF7);padding:3px 9px}',
    '.gl-per svg{flex:none}',
    '.gl-sem{flex:1 1 100%;display:flex;align-items:center;gap:8px;padding:4px;background:var(--panel,#fff);border:1px solid var(--line,#D5DAD6);border-radius:10px}',
    '.gl-sem button{flex:none;width:44px;height:38px;border:0;border-radius:8px;background:var(--line-2,#EEF2EF);color:var(--ink,#17201C);font-size:20px;line-height:1}',
    '.gl-sem button:disabled{color:#9AA29E;background:#F4F6F5}',
    '.gl-sem div{flex:1;min-width:0;text-align:center;line-height:1.25}',
    '.gl-sem b{display:block;font-size:14px}',
    '.gl-sem small{display:block;font-size:12px;color:var(--ink-3,#5C6661)}',
    '.gl-pf{position:absolute;inset:0;z-index:3;display:flex;align-items:flex-end;justify-content:center;background:rgba(14,19,17,.45)}',
    '.gl-pf-box{width:100%;max-width:520px;max-height:92%;overflow:auto;display:grid;gap:10px;padding:14px 16px calc(18px + env(safe-area-inset-bottom,0px));background:var(--panel,#fff);color:var(--ink,#17201C);border-radius:16px 16px 0 0;box-shadow:0 -8px 30px rgba(0,0,0,.25)}',
    '@media (min-width:640px){.gl-pf{align-items:center}.gl-pf-box{border-radius:16px}}',
    '.gl-pf-top{display:flex;align-items:center;justify-content:space-between;gap:8px}',
    '.gl-pf-top h3{margin:0;font-size:17px;font-weight:700}',
    '.gl-pf-ops{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}',
    '.gl-pf-op{min-height:52px;border:1px solid var(--line,#C9D0CB);border-radius:12px;background:var(--panel,#fff);color:var(--ink,#17201C);text-align:left;padding:6px 12px;line-height:1.2}',
    '.gl-pf-op b{display:block;font-size:14px}',
    '.gl-pf-op small{display:block;font-size:12px;color:var(--ink-3,#5C6661)}',
    '.gl-pf-op[aria-pressed="true"]{border:2px solid var(--accent,#1D4F91);background:var(--accent-soft,#E7EEF7);padding:5px 11px}',
    '.gl-pf-datas{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:12px;border-radius:12px;background:#F4F7F5;border:1px solid var(--line,#D5DAD6)}',
    '.gl-pf-datas label{display:grid;gap:4px;font-size:12px;font-weight:700;color:var(--ink-2,#3B4540)}',
    '.gl-pf-datas input{min-height:44px;min-width:0;width:100%;box-sizing:border-box;border:1px solid #9AA29E;border-radius:10px;padding:0 10px;font-size:15px;background:var(--panel,#fff);color:var(--ink,#17201C)}',
    '.gl-pf-atal{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:6px}',
    '.gl-pf-atal button{min-height:36px;padding:0 12px;border-radius:18px;border:1px solid var(--line,#C9D0CB);background:var(--panel,#fff);font-size:13px;color:var(--ink,#17201C)}',
    '.gl-pf-acts{display:flex;gap:8px}',
    '.gl-pf-acts .btn{flex:1;min-height:46px;justify-content:center}',
    '.gl-b{position:absolute;top:5px;left:5px;padding:2px 6px;border-radius:999px;font-size:10.5px;font-weight:650;background:rgba(255,255,255,.92);color:var(--ink,#17201C)}',
    '.gl-b.fila{background:#FEF0C7;color:#7A2E0E}',
    '.gl-b.erro{background:#FEE4E2;color:#912018}',
    '.gl-b.ok{background:#D1FADF;color:#05603A}',
    '.gl-b.ap{background:#E4E7EC;color:#344054}',
    '.gl-b.sp{background:#FEF0C7;color:#7A2E0E}',
    '.gl-info .gl-lk{border:0;background:none;padding:0;color:var(--accent,#1D4F91);font-size:12.5px;text-decoration:underline}',
    '.gl-star{position:absolute;top:4px;right:6px;color:#FDB022;font-size:17px;text-shadow:0 1px 2px rgba(0,0,0,.5)}',
    '.gl-ck{position:absolute;top:5px;left:5px;width:22px;height:22px;border-radius:50%;border:2px solid #fff;background:rgba(0,0,0,.25);box-shadow:0 1px 3px rgba(0,0,0,.4)}',
    '.gl-t[aria-pressed="true"]{outline:3px solid var(--accent,#1D4F91);outline-offset:-3px}',
    '.gl-t[aria-pressed="true"] .gl-ck{background:var(--accent,#1D4F91)}',
    '.gl-t[aria-pressed="true"] .gl-ck::after{content:"";position:absolute;left:6px;top:2px;width:5px;height:10px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg)}',
    '.gl-vazio{padding:40px 8px;text-align:center;color:var(--ink-3,#5C6661)}',
    '.gl-dr-top{flex:1 1 100%;display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
    '.gl-dr-busca{flex:1 1 220px;min-width:0;min-height:36px;box-sizing:border-box;padding:6px 10px;border:1px solid var(--line,#D5DAD6);border-radius:8px;background:var(--panel,#fff);color:inherit;font:inherit;font-size:14px}',
    '.gl-dr-top .gl-chips{flex:0 0 auto}',
    '.gl-dr-resto{flex:1 1 100%;display:flex;flex-direction:column;gap:8px;min-width:0}',
    '.gl-dr-resto:empty{display:none}',
    '.gl-trilha{display:flex;flex-wrap:wrap;align-items:center;gap:2px 5px;font-size:12.5px;color:var(--ink-3,#5C6661)}',
    '.gl-trilha button{border:0;background:none;padding:2px 0;color:var(--accent,#1D4F91);font-weight:600;font-size:12.5px;cursor:pointer}',
    '.gl-trilha b{color:var(--ink,#17201C);font-weight:650}',
    '.gl-dr-pastas{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(320px,100%),1fr));gap:8px;padding-top:4px}',
    '.gl-pasta{display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--line,#D5DAD6);border-radius:10px;background:var(--panel,#fff);color:inherit;font:inherit;text-align:left;cursor:pointer}',
    '.gl-pasta:hover{border-color:var(--accent,#1D4F91)}',
    '.gl-pasta svg{flex:none;width:32px;height:32px}',
    '.gl-pasta>span{flex:1;min-width:0}',
    '.gl-pasta b{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.gl-pasta small{display:block;font-size:12px;color:var(--ink-3,#5C6661);font-variant-numeric:tabular-nums}',
    '.gl-pasta i{flex:none;font-style:normal;padding:2px 8px;border-radius:999px;background:#FCF1DC;color:#9A5B00;font-size:11px;font-weight:700}',
    '.gl-pasta em{flex:none;font-style:normal;color:var(--ink-3,#5C6661);font-size:18px}',
    '.gl-dr-nota{margin:12px 0 0;padding:9px 12px;border-radius:10px;background:var(--accent-soft,#E7EEF7);font-size:12px;line-height:1.45;color:var(--ink-2,#3B4540)}',
    '.gl-dr-arv{display:none}',
    '@media (min-width:1000px){.gl-dr{display:grid;grid-template-columns:260px minmax(0,1fr);gap:16px;align-items:start}.gl-dr-arv{display:flex;flex-direction:column;gap:2px;position:sticky;top:8px;max-height:calc(100vh - 240px);overflow:auto;margin-top:8px;padding:8px 6px;border:1px solid var(--line,#D5DAD6);border-radius:10px;background:var(--panel,#fff)}}',
    '.gl-dr-arv button{display:flex;align-items:center;gap:6px;width:100%;padding:6px 8px;border:0;border-radius:6px;background:none;color:inherit;font:inherit;font-size:13px;text-align:left;cursor:pointer}',
    '.gl-dr-arv button:hover{background:#F3F5F4}',
    '.gl-dr-arv button span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.gl-dr-arv button small{color:var(--ink-3,#5C6661);font-size:12px;font-variant-numeric:tabular-nums}',
    '.gl-dr-arv button[aria-current="true"]{background:var(--accent-soft,#E7EEF7);color:var(--accent,#1D4F91);font-weight:650}',
    '.gl-dr-arv p{margin:6px 8px 0;padding-top:8px;border-top:1px solid var(--line,#D5DAD6);font-size:12px;color:var(--ink-3,#5C6661)}',
    '.gl-vazio .btn{margin-top:12px}',
    '.gl-bar{position:absolute;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));display:flex;flex-wrap:wrap;align-items:center;gap:8px;max-width:760px;margin:0 auto;',
    '  padding:10px 12px;background:var(--panel,#fff);border:1px solid var(--line,#D5DAD6);border-radius:10px;box-shadow:0 6px 24px rgba(23,32,28,.16)}',
    '.gl-bar .gl-n{flex:1 1 120px;font-size:13px;font-weight:600;font-variant-numeric:tabular-nums}',
    '.gl-prog{flex:1 1 200px;font-size:13px;font-variant-numeric:tabular-nums}',
    '.gl-ver{position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;background:#0E1311;color:#fff}',
    // a foto aberta cobre a tela toda (por cima da margem da .gl): a barra de cima desce abaixo do relógio do iPhone, onde o toque não chega
    '.gl-ver-top{display:flex;align-items:center;gap:8px;padding:calc(10px + env(safe-area-inset-top,0px)) calc(12px + env(safe-area-inset-right,0px)) 10px calc(12px + env(safe-area-inset-left,0px))}',
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
    '.gl-ver-info .gl-warn{color:#FEC84B}',
    '.gl-mv{position:absolute;inset:0;z-index:3;display:flex;align-items:flex-end;justify-content:center;background:rgba(14,19,17,.5)}',
    '.gl-mv-box{width:100%;max-width:560px;max-height:92%;overflow:auto;display:grid;gap:12px;padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px));background:var(--panel,#fff);color:var(--ink,#17201C);border-radius:14px 14px 0 0;box-shadow:0 -8px 30px rgba(0,0,0,.25)}',
    '@media (min-width:640px){.gl-mv{align-items:center}.gl-mv-box{border-radius:14px}}',
    '.gl-mv-box h3{margin:0;font-size:16px;font-weight:650}',
    '.gl-mv-box h3 small{font-weight:400;color:var(--ink-3,#5C6661);font-size:13px}',
    '.gl-mv-now{font-size:13px;color:var(--ink-2,#3B4540)}',
    '.gl-mv-box label{display:grid;gap:4px;font-size:12.5px;font-weight:600;color:var(--ink-2,#3B4540)}',
    '.gl-mv-box select{min-height:42px;width:100%;max-width:100%;padding:6px 10px;border:1px solid var(--line,#D5DAD6);border-radius:8px;background:var(--panel,#fff);color:var(--ink,#17201C);font-size:15px;font-weight:400}',
    '.gl-mv-sug{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;background:var(--accent-soft,#E7EEF7);font-size:13px}',
    '.gl-mv-sug:empty{display:none}',
    '.gl-mv-sug.fora{background:#FEF0C7;color:#7A2E0E}',
    '.gl-mv-nota{margin:0;font-size:12px;color:var(--ink-3,#5C6661);line-height:1.45}',
    '.gl-mv-acts{display:flex;gap:8px;justify-content:flex-end}',
    // lista das pastas do Drive (janela "Pastas do Drive pelo nº do contrato")
    '.gl-pastas{margin:6px 0 10px;padding-left:18px;max-height:40vh;overflow:auto;font-size:13px;line-height:1.45;overflow-wrap:anywhere}',
    // como página do celular: entre as barras do app (--topbar-h e --pgnav-h vêm do app.js e do index.html), por baixo das listas
    // que descem da barra do topo; a foto aberta e o painel de contrato e ponto voltam a cobrir a tela toda
    '.gl.gl-pag{top:var(--topbar-h,61px);bottom:var(--pgnav-h,0px);z-index:10;padding-top:0;padding-bottom:0}',
    '.gl-pag .gl-top,.gl-pag .gl-cts{display:none}',
    '.gl-pag .gl-body{padding-bottom:84px}',
    '.gl.gl-pag:has(.gl-ver),.gl.gl-pag:has(.gl-mv){top:0;bottom:0;z-index:3000;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}',
    // situação de cada foto, no canto de cima à direita: ☁ no Drive, ▯ só aqui, fila, subindo, ⤓ só no Drive (não baixada)
    '.gl-s{position:absolute;top:5px;right:5px;min-width:20px;height:20px;box-sizing:border-box;padding:0 5px;border-radius:999px;background:rgba(255,255,255,.93);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;line-height:1;color:var(--ink-2,#3B4540);box-shadow:0 1px 2px rgba(0,0,0,.2)}',
    '.gl-s svg{width:13px;height:13px}',
    '.gl-s.ok{color:#1E7A47}.gl-s.fila{color:#9A5B00;font-size:10px}.gl-s.nuvem{color:var(--accent,#1D4F91)}.gl-s.erro{color:#B42318}',
    '.gl-s.sobe{padding:0;width:20px}.gl-s.sobe::after{content:"";width:11px;height:11px;box-sizing:border-box;border-radius:50%;border:2px solid #C9D8EC;border-top-color:var(--accent,#1D4F91);animation:glgira 1s linear infinite}',
    '@keyframes glgira{to{transform:rotate(360deg)}}',
    '@media (prefers-reduced-motion:reduce){.gl-s.sobe::after{animation:none}}',
    '.gl-t .gl-star{right:30px}',
    '.gl-leg{display:flex;flex-wrap:wrap;justify-content:center;gap:4px 12px;margin:16px auto 0;padding:6px 12px;width:max-content;max-width:100%;box-sizing:border-box;border:1px solid var(--line,#D5DAD6);border-radius:14px;background:var(--panel,#fff);font-size:11.5px;color:var(--ink-2,#3B4540)}',
    '.gl-leg span{display:inline-flex;align-items:center;gap:4px;white-space:nowrap}',
    '.gl-leg .gl-s{position:static;box-shadow:none;border:1px solid var(--line,#D5DAD6)}',
    // barra de envio ao Drive e barra de download (no alto da galeria)
    '.gl-prg{margin:10px 16px 0;padding:10px 12px;border-radius:10px;background:var(--accent-soft,#E7EEF7);border:1px solid #C5D5EA;font-size:13px}',
    '.gl-prg.pausa{background:#FCF1DC;border-color:#F0D49A}',
    '.gl-prg-l{display:flex;justify-content:space-between;align-items:baseline;gap:8px}',
    '.gl-prg-l b{color:var(--accent,#1D4F91)}',
    '.gl-prg.pausa .gl-prg-l b{color:#7A4A00}',
    '.gl-prg-l span{font-variant-numeric:tabular-nums;color:var(--ink-2,#3B4540);white-space:nowrap}',
    '.gl-prg-b{height:7px;border-radius:7px;background:#C9D8EC;overflow:hidden;margin:7px 0 6px}',
    '.gl-prg.pausa .gl-prg-b{background:#EED9AE}',
    '.gl-prg-b i{display:block;height:100%;background:var(--accent,#1D4F91);border-radius:7px;transition:width .3s}',
    '.gl-prg-r{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;font-size:11.5px;color:var(--ink-3,#5C6661)}',
    '.gl-prg-r span{flex:1 1 160px;min-width:0}',
    '.gl-prg-r button{border:0;background:none;padding:4px 0;color:var(--accent,#1D4F91);font-weight:650;font-size:12.5px}',
    // filtros do aparelho (Todas, Só aqui, Na fila, No Drive) e do período (Esta semana, 2 semanas, Mês, 3 meses, Escolher…)
    '.gl-chips{flex:1 1 100%;display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}',
    '.gl-chips::-webkit-scrollbar{display:none}',
    '.gl-chip{flex:none;min-height:32px;padding:0 11px;border:1px solid var(--line,#D5DAD6);border-radius:8px;background:var(--panel,#fff);color:var(--ink-2,#3B4540);font-size:12.5px;white-space:nowrap;display:inline-flex;align-items:center;gap:5px}',
    '.gl-chip[aria-pressed="true"]{border-color:var(--accent,#1D4F91);background:var(--accent-soft,#E7EEF7);color:var(--accent,#1D4F91);font-weight:650}',
    '.gl-chip svg{flex:none}',
    '.gl-info .gl-cfg{border:0;background:none;padding:2px 0;color:var(--accent,#1D4F91);font-weight:650;font-size:12.5px;display:inline-flex;align-items:center;gap:4px}',
    // janelas que sobem de baixo: baixar e "Fotos neste aparelho"
    '.gl-sh{position:absolute;inset:0;z-index:3;display:flex;align-items:flex-end;justify-content:center;background:rgba(14,19,17,.45)}',
    '.gl-sh-box{width:100%;max-width:520px;max-height:92%;overflow:auto;display:grid;gap:10px;padding:8px 16px calc(18px + env(safe-area-inset-bottom,0px));background:var(--panel,#fff);color:var(--ink,#17201C);border-radius:16px 16px 0 0;box-shadow:0 -8px 30px rgba(0,0,0,.25);box-sizing:border-box}',
    '.gl-sh-box::before{content:"";justify-self:center;width:40px;height:4px;border-radius:2px;background:#C9CFCB}',
    '@media (min-width:640px){.gl-sh{align-items:center}.gl-sh-box{border-radius:16px;padding-top:16px}.gl-sh-box::before{display:none}}',
    '.gl-sh-top{display:flex;align-items:center;justify-content:space-between;gap:8px}',
    '.gl-sh-top h3{margin:0;font-size:16px;font-weight:700}',
    '.gl-op{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:10px;border:1px solid var(--line,#D5DAD6);background:var(--panel,#fff);text-align:left;color:var(--ink,#17201C);font:inherit}',
    '.gl-op i{flex:none;width:20px;height:20px;box-sizing:border-box;border-radius:50%;border:2px solid #9AA39E;margin-top:1px;display:flex;align-items:center;justify-content:center}',
    '.gl-op[aria-pressed="true"]{border:2px solid var(--accent,#1D4F91);background:var(--accent-soft,#E7EEF7);padding:9px 11px}',
    '.gl-op[aria-pressed="true"] i{border-color:var(--accent,#1D4F91)}',
    '.gl-op[aria-pressed="true"] i::after{content:"";width:10px;height:10px;border-radius:50%;background:var(--accent,#1D4F91)}',
    '.gl-op b{display:block;font-size:14px}',
    '.gl-op small{display:block;font-size:12px;color:var(--ink-3,#5C6661);line-height:1.35}',
    '.gl-ckl{display:flex;gap:8px;align-items:center;font-size:12.5px;color:var(--ink-2,#3B4540)}',
    '.gl-ckl input{width:18px;height:18px;margin:0;flex:none}',
    '.gl-sh-acts{display:flex;gap:8px}',
    '.gl-sh-acts .btn{flex:1;min-height:46px;justify-content:center}',
    '.gl-uso{padding:12px;border-radius:10px;border:1px solid var(--line,#D5DAD6)}',
    '.gl-uso-t{display:flex;justify-content:space-between;font-weight:650;font-variant-numeric:tabular-nums}',
    '.gl-uso-b{display:flex;height:10px;border-radius:5px;overflow:hidden;margin:8px 0 6px;background:#E6EAE7}',
    '.gl-uso-l{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:11.5px;color:var(--ink-2,#3B4540)}',
    '.gl-cx{border-radius:10px;border:1px solid var(--line,#D5DAD6);overflow:hidden}',
    '.gl-cx h4{margin:0;padding:9px 12px 2px;font-size:11.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-3,#5C6661)}',
    '.gl-ln{display:flex;gap:10px;align-items:center;padding:10px 12px;border-top:1px solid #EEF0EE}',
    '.gl-cx h4+.gl-ln{border-top:0}',
    '.gl-ln div{flex:1;min-width:0}',
    '.gl-ln b{display:block;font-size:14px}',
    '.gl-ln small{display:block;font-size:12px;color:var(--ink-3,#5C6661);line-height:1.35}',
    '.gl-ln select{flex:none;min-height:36px;max-width:46%;border:1px solid var(--line,#D5DAD6);border-radius:8px;background:var(--panel,#fff);font-size:13px;color:var(--ink,#17201C)}',
    '.gl-ln .btn{flex:none}',
    '.gl-sw{flex:none;position:relative;width:44px;height:26px;border-radius:13px;border:0;padding:0;background:#C9CFCB}',
    '.gl-sw::after{content:"";position:absolute;left:3px;top:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:left .15s}',
    '.gl-sw[aria-checked="true"]{background:var(--accent,#1D4F91)}',
    '.gl-sw[aria-checked="true"]::after{left:21px}',
    '.gl-off{margin:10px 16px 0;padding:8px 12px;border-radius:10px;background:#FCF1DC;color:#7A4A00;font-size:12.5px}',
    '@media (max-width:560px){.gl-top{padding:8px 12px}.gl-tabs,.gl-cts,.gl-fil,.gl-info{padding-left:12px;padding-right:12px}.gl-body{padding-left:12px;padding-right:12px}',
    '  .gl-prg,.gl-off{margin-left:12px;margin-right:12px}',
    '  .gl-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}}'
  ].join('\n');

  var MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var SEM = '__sem';   // filtro "Sem contrato" / "Sem ponto"
  var POR_ZIP = 40;
  // o script do Drive (versão 6) não abriu a pasta principal das fotos e não criou outra: as fotos esperam no celular
  var PASTA_FORA = 'pasta_principal_indisponivel';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function data(iso) { var d = iso ? new Date(iso) : null; return d && isFinite(d.getTime()) ? d : null; }
  function dia(iso) { var d = data(iso); return d ? pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() : ''; }
  function hora(iso) { var d = data(iso); return d ? dia(iso) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) : ''; }
  function mesKey(iso) { var d = data(iso); return d ? d.getFullYear() + '-' + pad(d.getMonth() + 1) : ''; }
  function mesNome(k) { var p = k.split('-'); return MESES[+p[1] - 1] + '/' + p[0]; }
  function kmCurto(km) { return km == null || km === '' ? '' : 'km ' + Number(km).toFixed(2).replace('.', ','); }
  function kmTxt(km) { return km == null || km === '' ? '' : 'km ' + Number(km).toFixed(3).replace('.', ','); }
  function tam(b) { return !b ? '' : b >= 1073741824 ? (b / 1073741824).toFixed(1).replace('.', ',') + ' GB' : b >= 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' kB'; }
  function plural(n, um, varios) { return n + ' ' + (n === 1 ? um : varios); }
  // ---------------------------------------------------------------- período (dia, semana de segunda a domingo, mês, datas)
  // datas em "aaaa-mm-dd" no fuso do aparelho; a escolha fica neste aparelho (PER_KEY) e vale para todas as abas
  var MESL = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
  var SEMN = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  var PER_KEY = 'diagrama-linear.galeria-periodo', PER_MODOS = ['tudo', 'hoje', 'semana', 'sem2', 'mes', 'mes3', 'datas'];
  function isoDia(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dDia(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function maisDias(s, n) { var d = dDia(s); d.setDate(d.getDate() + n); return isoDia(d); }
  function segundaDe(s) { var d = dDia(s); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return isoDia(d); }
  function hojeIso() { return isoDia(new Date()); }
  function diaLongo(s) { var d = dDia(s); return d.getDate() + ' de ' + MESL[d.getMonth()]; }
  function ddmm(s) { var d = dDia(s); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1); }
  function faixaTxt(a, b) {
    if (a === b) return diaLongo(a);
    var da = dDia(a), db = dDia(b);
    return da.getMonth() === db.getMonth() && da.getFullYear() === db.getFullYear() ? da.getDate() + ' a ' + diaLongo(b) : diaLongo(a) + ' a ' + diaLongo(b);
  }
  function diaDaFoto(iso) { var d = data(iso); return d ? isoDia(d) : ''; }
  function validoIso(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }
  // [início, fim] do período, ou null (todas as datas)
  function intervaloPer(p) {
    var h = hojeIso();
    if (!p || p.modo === 'tudo') return null;
    if (p.modo === 'hoje') return [h, h];
    if (p.modo === 'semana') { var s = maisDias(segundaDe(h), 7 * (p.off || 0)), e = maisDias(s, 6); return [s, e > h ? h : e]; }
    if (p.modo === 'sem2') return [maisDias(h, -13), h];
    if (p.modo === 'mes') return [h.slice(0, 8) + '01', h];
    if (p.modo === 'mes3') { var m3 = dDia(h.slice(0, 8) + '01'); m3.setMonth(m3.getMonth() - 2); return [isoDia(m3), h]; }
    if (p.modo === 'datas' && validoIso(p.de) && validoIso(p.ate)) return p.de <= p.ate ? [p.de, p.ate] : [p.ate, p.de];
    return null;
  }
  function rotuloPer(p) {
    var iv = intervaloPer(p);
    if (!iv) return 'Todas as datas';
    if (p.modo === 'hoje') return 'Hoje';
    if (p.modo === 'mes') return 'Este mês';
    if (p.modo === 'sem2') return '2 semanas';
    if (p.modo === 'mes3') return '3 meses';
    if (p.modo === 'datas') return ddmm(iv[0]) + ' a ' + ddmm(iv[1]);
    return !p.off ? 'Esta semana' : p.off === -1 ? 'Semana passada' : 'Semana ' + ddmm(iv[0]) + '–' + ddmm(maisDias(iv[0], 6));
  }
  function lerPer() {
    try {
      var p = JSON.parse(localStorage.getItem(PER_KEY) || 'null');
      if (p && PER_MODOS.indexOf(p.modo) >= 0) return { modo: p.modo, off: Math.min(0, Math.round(+p.off || 0)), de: p.de || '', ate: p.ate || '' };
    } catch (e) { /* sem armazenamento */ }
    return { modo: 'semana', off: 0, de: '', ate: '' };
  }
  function salvarPer(p) { try { localStorage.setItem(PER_KEY, JSON.stringify(p)); } catch (e) { /* sem armazenamento */ } }
  var CAL = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>';
  function b64Blob(s, type) {
    var bin = atob(s), u8 = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new Blob([u8], { type: type || 'image/jpeg' });
  }

  // .zip sem compressão (o JPEG já é comprimido); nomes em UTF-8
  // fotos inteiras trazidas do Drive ficam guardadas neste aparelho (IndexedDB "diagrama-linear-inteiras", pela id do
  // arquivo no Drive): abrir de novo, baixar ou pôr no relatório não baixa outra vez. Loja "info" (tamanho, último uso)
  // separada da loja "arq" (o arquivo), para a limpeza não precisar ler as fotos; passou do limite, saem as menos usadas.
  // versão 2: loja "item" (dados da foto e a miniatura, pela id da foto), para as abas do banco abrirem sem sinal
  var CDB = 'diagrama-linear-inteiras', CINFO = 'info', CARQ = 'arq', CITEM = 'item', CACHE_MAX = 250 * 1048576;
  function cacheTx(mode, fn) {
    return new Promise(function (ok, no) {
      if (!window.indexedDB) { no(new Error('sem_indexeddb')); return; }
      var r = indexedDB.open(CDB, 2);
      r.onupgradeneeded = function () {
        var db = r.result;
        [CINFO, CARQ, CITEM].forEach(function (n) { if (!db.objectStoreNames.contains(n)) db.createObjectStore(n, { keyPath: 'id' }); });
      };
      r.onerror = function () { no(r.error); };
      r.onsuccess = function () {
        var db = r.result, t = db.transaction([CINFO, CARQ, CITEM], mode), req = fn(t.objectStore(CINFO), t.objectStore(CARQ), t.objectStore(CITEM));
        t.oncomplete = function () { db.close(); ok(req && 'result' in req ? req.result : undefined); };
        t.onerror = t.onabort = function () { db.close(); no(t.error); };
      };
    });
  }
  // ao sair (ou entrar outra pessoa) no aparelho: as fotos inteiras guardadas eram do acesso anterior (app.js, limparDadosAparelho)
  window.GaleriaLimparCache = function () { try { if (window.indexedDB) indexedDB.deleteDatabase(CDB); } catch (e) { /* sem IndexedDB */ } };
  function cacheLer(id) {
    return cacheTx('readonly', function (i, a) { return a.get(id); }).then(function (r) {
      if (!r || !r.buf) return null;
      cacheTx('readwrite', function (i) { var g = i.get(id); g.onsuccess = function () { if (g.result) { g.result.usada = Date.now(); i.put(g.result); } }; }).catch(function () {});
      return new Blob([r.buf], { type: r.tipo || 'image/jpeg' });
    }, function () { return null; });
  }
  function cacheGravar(id, blob) {
    return new Response(blob).arrayBuffer().then(function (buf) {
      return cacheTx('readwrite', function (i, a) {
        a.put({ id: id, buf: buf, tipo: blob.type || 'image/jpeg' });
        i.put({ id: id, tam: buf.byteLength, usada: Date.now() });
      });
    }).then(function () {
      return cacheTx('readwrite', function (i, a) {
        var g = i.getAll();
        g.onsuccess = function () {
          var l = (g.result || []).sort(function (x, y) { return x.usada - y.usada; }), tot = l.reduce(function (t, x) { return t + (x.tam || 0); }, 0);
          for (var k = 0; k < l.length - 1 && tot > CACHE_MAX; k++) { i.delete(l[k].id); a.delete(l[k].id); tot -= l[k].tam || 0; }
        };
      });
    }).catch(function () { /* sem espaço ou sem IndexedDB: só não guarda */ });
  }
  // espaço das baixadas: fotos inteiras (bytes, quantas) e itens guardados com a miniatura
  function cacheUso() {
    return cacheTx('readonly', function (i, a, it) { var r = { info: i.getAll(), itens: it.getAll() }; return { result: r }; }).then(function (r) {
      var inf = (r && r.info && r.info.result) || [], its = (r && r.itens && r.itens.result) || [];
      return { bytes: inf.reduce(function (t, x) { return t + (x.tam || 0); }, 0), n: inf.length, itens: its.length,
        mini: its.reduce(function (t, x) { return t + (x.mini ? x.mini.length * 0.75 : 0); }, 0) };
    }, function () { return { bytes: 0, n: 0, itens: 0, mini: 0 }; });
  }
  function itemGravar(it, mini) {
    var d = {}; Object.keys(it).forEach(function (k) { if (k !== 'mini') d[k] = it[k]; });
    return cacheTx('readwrite', function (i, a, s) { s.put({ id: it.id, dados: d, mini: mini || null, em: Date.now() }); }).catch(function () { /* sem espaço: só não guarda */ });
  }
  function itensLer() { return cacheTx('readonly', function (i, a, s) { return s.getAll(); }).then(function (l) { return l || []; }, function () { return []; }); }
  function cacheIds() { return cacheTx('readonly', function (i) { return i.getAllKeys(); }).then(function (l) { var m = {}; (l || []).forEach(function (k) { m[k] = 1; }); return m; }, function () { return {}; }); }

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
    { k: 'local', t: 'No aparelho', nivel: 0 },
    { k: 'minhas', t: 'Minhas', nivel: 0, login: true },   // também o analista (o banco lista as dele: _faz_fotos)
    { k: 'todas', t: 'Equipe', nivel: 2 },
    { k: 'drive', t: 'Drive', nivel: 0, login: true, drive: true },   // a pasta do Drive como ela é (script versão 7)
    { k: 'relatorio', t: 'Relatório ★', nivel: 2 },
    { k: 'deletadas', t: 'Lixeira', nivel: 3 }   // a pasta "Deletados" do Drive
  ];
  var DRIVE_KEY = 'diagrama-linear.foto-drive', MANTER_KEY = 'diagrama-linear.manter-enviadas';
  // aba Drive: por contrato ou por pessoa, e quando cada pasta foi aberta (para contar as novas)
  var DMODO_KEY = 'diagrama-linear.drive-ver-modo', DVISTO_KEY = 'diagrama-linear.drive-ver-vistos';
  var IC_PASTA = '<svg viewBox="0 0 24 24" fill="#E9B949" stroke="#B8860B" stroke-width="1" stroke-linejoin="round" aria-hidden="true"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.3l2 2h8.7A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z"/></svg>';   // DRIVE_KEY: a mesma da tela Foto (foto.js)
  function lsLer(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsPor(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* sem armazenamento */ } }
  function rede() { var c = navigator.connection; return c && c.type ? c.type : ''; }
  function mb(b) { return b ? tam(b) : '0 MB'; }
  var IC_NUVEM = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 19a5 5 0 0 1-.7-9.95A6.5 6.5 0 0 1 18.6 9 4.5 4.5 0 0 1 17.5 19z"/></svg>';
  var IC_APAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><rect x="7" y="3" width="10" height="18" rx="2"/></svg>';
  var IC_BAIXA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>';
  var IC_SOBE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20V9M7 14l5-5 5 5M5 4h14"/></svg>';
  var IC_CFG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>';
  // as já enviadas saem deste aparelho depois de N dias ("Espaço e envio" › Manter no aparelho); as que não subiram, nunca
  function limparEnviadas(drive) {
    var d = +lsLer(MANTER_KEY);
    if (!drive || !drive.list || !drive.apagar || !(d > 0)) return Promise.resolve(0);
    var lim = Date.now() - d * 864e5;
    return drive.list().then(function (l) {
      var ids = l.filter(function (r) { return r.situacao === 'enviada' && r.enviada && r.enviada < lim; }).map(function (r) { return r.id; });
      return ids.length ? drive.apagar(ids).then(function () { return ids.length; }) : 0;
    }).catch(function () { return 0; });
  }
  // agrupar: por mês ou por pessoa (escolha só para engenheiro e Administrador; o fiscal só vê as fotos dele, por mês)
  var AGRUPAR = { mes: 'Por data', pessoa: 'Por pessoa' };   // por data: por dia até 16 dias; período maior, por semana
  var MESES_NOME = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  function mesLongo(k) { var p = k.split('-'); return MESES_NOME[+p[1] - 1] + ' de ' + p[0]; }
  function agruparPadrao(aba) { return aba === 'todas' ? 'pessoa' : 'mes'; }
  // cópia curta das funções de nome do app.js (o app passa as dele em o.nomes), com a mesma regra: nome de tela pelo tipo e
  // número ("Pontos Críticos 314"), nome formal com o Lote da licitação e o nº do CT, pasta do Drive pelo número
  // ("CT 02 00314-2026") e a pasta usada até a versão 51 (o Lote), que o script do Drive renomeia no primeiro envio
  function nomesPadrao() {
    // sinal: a conservação com rotuloTipo 'sinal' (709) tem o nome "Sinalização" (por baixo, conservação)
    var PAL = { pc: 'Pontos Críticos', conserva: 'Conservação', oae: 'Proarte', sinal: 'Sinalização' };
    function lp(v) { return v == null ? '' : String(v).trim().replace(/\s+/g, ' '); }
    function tipo(c) { return c && c.tipo === 'oae' ? 'oae' : c && c.tipo === 'conserva' ? 'conserva' : 'pc'; }
    function numeroCurto(c) { var m = /(\d{3,})\s*\/\s*\d{4}/.exec(lp(c && c.numero)); return m ? String(Number(m[1])) : ''; }
    function nome(c) { if (!c) return ''; var n = numeroCurto(c), w = PAL[c.rotuloTipo === 'sinal' && tipo(c) === 'conserva' ? 'sinal' : tipo(c)]; return n ? w + ' ' + n : lp(c.lote) || w; }
    function loteReal(c) { var l = lp(c && c.lote); return /^lote\b/i.test(l) ? l : ''; }
    function numeroCT(c) { var n = lp(c && c.numero); return n ? 'CT ' + n : ''; }
    function formal(c) { return c ? [loteReal(c), numeroCT(c)].filter(Boolean).join(' · ') || nome(c) : ''; }
    function completo(c) { var out = []; [nome(c), loteReal(c), numeroCT(c)].forEach(function (x) { if (x && out.indexOf(x) < 0) out.push(x); }); return out.join(' · '); }
    // sem número e sem Lote, o id entra no nome (dois contratos novos não dividem a pasta)
    function pasta(c) { if (!c) return ''; var n = lp(c.numero); return n ? 'CT ' + n.replace(/\s*\/\s*/g, '-') : lp(c.lote) || nome(c) + (c.id ? ' (' + c.id + ')' : ''); }
    // as pastas que existiam até a versão 51, pelo nº (não dependem do Lote de hoje); dos outros, o Lote ou "CT nº", letra por letra
    var ANTES = { '0200314/2026': 'Lote 01', '0200315/2026': 'Lote 02', '0200424/2024': 'CT 424 · OAEs' };
    function pastaAntes(c) { var k = lp(c && c.numero).replace(/\s+/g, ''); return Object.prototype.hasOwnProperty.call(ANTES, k) ? ANTES[k] : ''; }
    function pastaAntiga(c) { return c ? pastaAntes(c) || String(c.lote || (c.numero ? 'CT ' + c.numero : '') || 'Contrato') : 'Sem lote'; }
    return { tipo: tipo, numeroCurto: numeroCurto, nome: nome, loteReal: loteReal, numeroCT: numeroCT, formal: formal, completo: completo,
      pasta: pasta, pastaAntiga: pastaAntiga, pastaAntes: pastaAntes };
  }
  // nº do contrato num texto ("CT 02 00314/2026" ou, no nome da pasta do Drive, "CT 02 00314-2026") -> "0200314/2026"
  function chaveCT(s) { var m = /(\d{2})\s*(\d{3,})\s*[\/-]\s*(\d{4})/.exec(String(s == null ? '' : s)); return m ? m[1] + m[2] + '/' + m[3] : ''; }
  // nome comparável: como o script do Drive limpa o nome da pasta (barra vira hífen, espaços juntos), sem diferença de maiúscula
  function chaveNome(s) { return String(s == null ? '' : s).replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().toLowerCase(); }

  // ---------------------------------------------------------------- pontos e trecho do contrato (km)
  // conservação: vazio até o passo 2.5 (os segmentos não entram na sugestão pelo km, na lista do "Contrato e ponto" nem no trecho,
  // que vem do km do contrato)
  function pontosDe(c) {
    return (c && c.tipo === 'conserva' ? [] : (c && c.pontos) || []).slice().sort(function (a, b) {
      var ka = a.kmIni != null ? a.kmIni : 1e9, kb = b.kmIni != null ? b.kmIni : 1e9;
      return ka - kb || String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { numeric: true });
    });
  }
  // distância (km) do km da foto ao ponto: zero dentro do trecho do ponto
  function dist(p, km) {
    if (p.kmIni == null || km == null) return null;
    var a = p.kmIni, b = p.kmFim != null ? p.kmFim : p.kmIni;
    return km < a ? a - km : km > b ? km - b : 0;
  }
  function maisPerto(c, km) {
    var best = null;
    pontosDe(c).forEach(function (p) { var d = dist(p, km); if (d != null && (!best || d < best.d)) best = { p: p, d: d }; });
    return best;
  }
  function trecho(c) {
    var ks = pontosDe(c).filter(function (p) { return p.kmIni != null; });
    var a = c.kmIni != null ? c.kmIni : ks.length ? ks[0].kmIni - 0.5 : null;
    var b = c.kmFim != null ? c.kmFim : ks.length ? Math.max.apply(null, ks.map(function (p) { return p.kmFim != null ? p.kmFim : p.kmIni; })) + 0.5 : null;
    return a != null && b != null ? [a, b] : null;
  }
  // folga do km: 50 m, a mesma da tela Foto (foto.js), no trecho do contrato e no ponto
  var FOLGA_KM = 0.05;
  // o km da foto escolhe a ponte (Proarte) a até 150 m dela; os outros pontos, a até 50 m
  function raioPonto(c) { return c && c.tipo === 'oae' ? 0.15 : FOLGA_KM; }
  function noTrecho(c, km) { var t = c && trecho(c); return !!t && km >= t[0] - FOLGA_KM && km <= t[1] + FOLGA_KM; }
  // todos os contratos cujo trecho tem o km, na ordem da lista (nunca só "o primeiro": o de conservação e o de pontos críticos
  // cobrem o mesmo trecho, e a ordem não diz qual serviço foi fotografado)
  function ctsDoKm(cs, km) {
    if (km == null || km === '' || !isFinite(km)) return [];
    km = Number(km);
    return (cs || []).filter(function (c) { return noTrecho(c, km); });
  }

  // ---------------------------------------------------------------- link "Abrir no Drive"
  // sai do id do arquivo, no formato do Google (letras, números, - e _), e nunca do endereço gravado no banco: esse vem do
  // celular de quem enviou, e um "endereço" que é um comando rodaria no app de quem tocasse nele
  var ID_DRIVE = /^[A-Za-z0-9_-]{20,120}$/;
  function linkDrive(id) { return typeof id === 'string' && ID_DRIVE.test(id) ? 'https://drive.google.com/file/d/' + id + '/view' : ''; }

  // ---------------------------------------------------------------- "Contrato e ponto" em partes
  // o banco aceita até 300 fotos por pedido (fotos_mover); "Selecionar todas" marca até 1.000
  var POR_MOVER = 300;
  function partes(ls, n) { var out = []; for (var i = 0; i < (ls || []).length; i += n) out.push(ls.slice(i, i + n)); return out; }
  // aviso final com o que mudou de verdade: "18 corrigidas, 2 não (sem conexão)"
  function resumoMover(feitas, nao, motivo) {
    if (!nao) return '';
    return (feitas ? plural(feitas, 'corrigida', 'corrigidas') + ', ' + nao + ' não' : plural(nao, 'foto não mudou', 'fotos não mudaram')) + (motivo ? ' (' + motivo + ')' : '') + '.';
  }

  // ---------------------------------------------------------------- de qual contrato é um arquivo do Drive ("Trazer do Drive")
  // cs: os contratos do aparelho; nm: as funções de nome (o.nomes do app.js ou a cópia curta)
  function ctsPorNumero(cs, k) { return k ? cs.filter(function (c) { return chaveCT(c.numero) === k; }) : []; }
  // os contratos que têm um nome igual ao texto: o de tela, o formal, o completo, a pasta do Drive (a nova e a de antes), o Lote e o
  // formato antigo "Lote 01 · CT 02 00314/2026"
  function ctsPorNome(cs, nm, t) {
    var k = chaveNome(t);
    if (!k) return [];
    return cs.filter(function (c) {
      return [nm.nome(c), nm.formal(c), nm.completo(c), nm.pasta(c), nm.pastaAntiga(c), c.lote,
        [c.lote, c.numero ? 'CT ' + c.numero : ''].filter(Boolean).join(' · ')].some(function (n) { return n && chaveNome(n) === k; });
    });
  }
  // linha que o app grava com o contrato: a que termina no nº do CT e é só ele ou vem depois de " · " ("CT 02 00314/2026",
  // "Lote 01 · CT 02 00314/2026", "CT 424 · OAEs · CT 02 00424/2024"), ou igual a um nome conhecido. A frase da descrição que cita
  // um CT ("CT 02 00315/2026 também atende este bueiro", "Medição do CT ...") fica na descrição
  function linhaContrato(cs, nm, l) {
    var k = /^(?:.*·\s*)?CT\s+\d{2}\s*\d{3,}\s*[\/-]\s*\d{4}$/.test(l) ? chaveCT(l) : '';
    return { num: k, nomes: k ? [] : ctsPorNome(cs, nm, l) };
  }
  function comuns(a, b) { return a.filter(function (x) { return b.indexOf(x) >= 0; }); }
  // pelo km: o único da lista cujo trecho tem o km; senão, o único com um ponto a até 50 m; senão, nenhum
  function porKm(lista, km) {
    if (km == null || !isFinite(km)) return null;
    var dentro = ctsDoKm(lista, km);
    if (dentro.length === 1) return dentro[0];
    var perto = lista.filter(function (c) { var b = maisPerto(c, km); return b && b.d <= FOLGA_KM; });
    return perto.length === 1 ? perto[0] : null;
  }
  // o contrato do arquivo, nesta ordem (nunca "o primeiro da lista"):
  //   1º o nº do CT no texto ou no nome de uma pasta ("CT 02 00314-2026"); um nº que não é de nenhum contrato daqui: sem contrato;
  //   2º um nome conhecido nas linhas do texto ou na pasta do contrato, quando dá um contrato só;
  //   3º o nome serve a mais de um (a pasta "Lote 01" do 314 e do 437): decide o km, só entre eles;
  //   4º sem nome nenhum: o km, quando um só contrato tem o km ou um ponto a até 50 m;
  //   5º senão, sem contrato (fica em "Sem contrato", para corrigir em "Contrato e ponto").
  // p: { numero: o nº do CT achado no texto, nomes: [os contratos de cada linha com nome], pastas: [contrato, ponto], km }
  function ligarContrato(cs, nm, p) {
    var k = p.numero || '';
    if (!k) (p.pastas || []).some(function (n) { k = /^\s*CT\s+\d/.test(n) ? chaveCT(n) : ''; return !!k; });
    if (k) { var l1 = ctsPorNumero(cs, k); return l1.length === 1 ? l1[0] : porKm(l1, p.km); }
    // as linhas do texto se somam (o nome de tela e o formal); a pasta desempata entre elas
    var tx = (p.nomes || []).reduce(function (a, l) { return !a ? l : comuns(a, l).length ? comuns(a, l) : a; }, null) || [];
    var pa = p.pastas && p.pastas[0] ? ctsPorNome(cs, nm, p.pastas[0]) : [];
    var cand = tx.length && pa.length && comuns(tx, pa).length ? comuns(tx, pa) : tx.length ? tx : pa;
    if (cand.length === 1) return cand[0];
    return porKm(cand.length ? cand : cs, p.km);
  }
  // os dados da galeria para um arquivo do Drive (f: o que o script lista). Contrato, ponto, km, posição, data e quem tirou vêm
  // do texto que o app grava em cada arquivo; faltando, da pasta e do nome do arquivo
  function lerArquivo(f, cs, nm) {
    var r = { autor: '', idApp: '', km: null, lat: null, lng: null, em: null, pnome: '', desc: [] }, m;
    var numero = '', nomes = [];   // contrato pelo nº do CT e pelos nomes, achados no texto do arquivo
    String(f.descricao || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean).forEach(function (l) {
      if ((m = /^(?:Tirada|Enviada) por (.+?)(?: \([^)]*\))?$/.exec(l))) r.autor = m[1];
      else if ((m = /^ID (\S+)$/.exec(l))) r.idApp = m[1];
      else if (/^(Cópia do oficial|Pasta original|Apagada por) /.test(l) || l === 'Sem ponto') return;
      else if ((m = /^Ponto (.+)$/.exec(l))) r.pnome = m[1];
      else if ((m = /^BR\s[^-]*-\s*(\d+(?:,\d+)?)/.exec(l))) r.km = Number(m[1].replace(',', '.'));
      else if ((m = /^(-?\d+,\d+)\/(-?\d+,\d+)$/.exec(l))) { r.lat = Number(m[1].replace(',', '.')); r.lng = Number(m[2].replace(',', '.')); }
      else if ((m = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/.exec(l))) r.em = new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]).toISOString();
      else {
        // as linhas do contrato (o app novo grava duas: o nome de tela e o formal) não vão para a descrição
        var lc = linhaContrato(cs, nm, l);
        if (lc.num) { if (!numero) numero = lc.num; }
        else if (lc.nomes.length) nomes.push(lc.nomes);
        else r.desc.push(l);
      }
    });
    var ps = (f.pastas || []).slice(), n = String(f.nome || '');
    if (ps[0] === 'Fotos por pessoa') { if (!r.autor && ps[1]) r.autor = ps[1]; ps = ps.slice(2); }
    if (!r.pnome && ps[1] && ps[1] !== 'Sem ponto') r.pnome = ps[1];
    // nome do arquivo: "Foto BR-230-PA km 822+720 P13 2026-06-23 12h09 (2).jpg"
    if (r.km == null && (m = /km (\d+)\+(\d{3})/.exec(n))) r.km = Number(m[1]) + Number(m[2]) / 1000;
    if (!r.em && (m = /(\d{4})-(\d{2})-(\d{2}) (\d{2})h(\d{2})/.exec(n))) r.em = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).toISOString();
    var c = ligarContrato(cs, nm, { numero: numero, nomes: nomes, pastas: ps, km: r.km }), p = null;
    if (c) {
      p = r.pnome ? pontosDe(c).find(function (x) { return x.nome === r.pnome; }) : null;
      if (!p && r.km != null) { var pp = maisPerto(c, r.km); if (pp && pp.d <= raioPonto(c)) p = pp.p; }
    }
    return { id: r.idApp && r.idApp.length >= 4 ? r.idApp.slice(0, 80) : 'drv_' + f.id, drive_id: f.id, drive_url: linkDrive(f.id) || null, nome_arquivo: n || 'foto.jpg',
      tamanho: f.tamanho || null, autor_nome: r.autor || 'Sem nome', contrato_id: c ? c.id : null, ponto_id: p ? p.id : null, ponto_nome: p ? p.nome : null,
      lote: c ? nm.formal(c) : null, km: r.km != null ? Math.round(r.km * 1000) / 1000 : null, lat: r.lat, lng: r.lng,
      tirada_em: r.em || f.criado || null, descricao: r.desc.join('\n') || null, enviada_em: f.criado || null };
  }

  // ---------------------------------------------------------------- pastas do Drive pelo nº do contrato (Administrador)
  // o formato da pasta nova ("CT 02 00314-2026") e o nome como o script do Drive limpa (a barra vira hífen, espaços juntos)
  var FORMATO_PASTA = /^CT \d{2} \d{5}-\d{4}$/;
  function limparPasta(s) { return String(s == null ? '' : s).replace(/[\\\/:*?"<>|\u0000-\u001f]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 150); }
  // o mapa que o script usa para renomear (até 20 pares): de = a pasta de antes (o Lote), para = a pasta pelo nº do contrato.
  // Fica de fora o que já está pelo número e, com aviso: o contrato sem número (ou com o número fora do formato 02 00000/0000);
  // o nome antigo que serve a mais de um contrato (o "Lote 01" do 314 e do 437), a não ser que só um deles já tivesse essa pasta
  // até a versão 51 (pastaAntes: o 314): vai o par dele, e em cada pessoa o script confere o nº do CT nas fotos antes de renomear;
  // e o mesmo número em dois contratos
  function mapaPastas(cs, nm) {
    var lista = [], avisos = [], porDe = {}, porPara = {};
    cs.forEach(function (c) {
      var nome = nm.nome(c) || 'Contrato', de = limparPasta(nm.pastaAntiga(c)), para = limparPasta(nm.pasta(c));
      if (!String(c.numero || '').trim()) { avisos.push(nome + ': sem nº do contrato; as fotos continuam na pasta "' + para + '".'); return; }
      if (!FORMATO_PASTA.test(para)) { avisos.push(nome + ': o nº "' + String(c.numero).trim() + '" não está no formato 02 00000/0000; a pasta "' + de + '" fica como está.'); return; }
      if (!de || de === para) return;   // já está pelo número
      if (FORMATO_PASTA.test(de)) { avisos.push(nome + ': o Lote "' + de + '" parece o nº de outro contrato; a pasta fica como está.'); return; }
      var x = { de: de, para: para, nome: nome, antes: !!(nm.pastaAntes && nm.pastaAntes(c)) };
      lista.push(x);
      (porDe[chaveNome(de)] = porDe[chaveNome(de)] || []).push(x);
      (porPara[para] = porPara[para] || []).push(x);
    });
    var nomes = function (l) { return l.map(function (x) { return x.nome; }).join(', '); };
    // de vários contratos: vale o único que já tinha a pasta (null: nenhum, ou mais de um)
    var dono = function (g) { var a = g.filter(function (x) { return x.antes; }); return a.length === 1 ? a[0] : null; };
    Object.keys(porDe).forEach(function (k) {
      if (porDe[k].length < 2) return;
      var d = dono(porDe[k]);
      avisos.push('A pasta "' + porDe[k][0].de + '" é de mais de um contrato (' + nomes(porDe[k]) + '): ' +
        (d ? 'vai para "' + d.para + '", de ' + d.nome + ', que já tinha essa pasta. Em cada pessoa, o script confere o nº do CT nas fotos antes de renomear.'
          : 'fica como está aqui. O script renomeia a de cada pessoa no primeiro envio de foto do contrato certo (confere o nº do CT nas fotos da pasta).'));
    });
    Object.keys(porPara).forEach(function (k) {
      if (porPara[k].length > 1) avisos.push('Mais de um contrato com o nº da pasta "' + k + '" (' + nomes(porPara[k]) + '): confira os dados; as pastas ficam como estão.');
    });
    var vale = lista.filter(function (x) { var g = porDe[chaveNome(x.de)]; return (g.length === 1 || dono(g) === x) && porPara[x.para].length === 1; });
    if (vale.length > 20) { avisos.push('Mais de 20 contratos: vão só os 20 primeiros.'); vale = vale.slice(0, 20); }
    return { mapa: vale.map(function (x) { return { de: x.de, para: x.para }; }), contratos: vale, avisos: avisos };
  }
  // junta as partes do relatório do script (um pedido a cada ~25 s): a mesma pessoa e pasta volta no pedido seguinte quando o
  // tempo acabou no meio dela; as fotos somam, e vale a primeira ação que mexeu
  function juntarRelatorio(acc, itens) {
    var parada = function (a) { return a === 'nada' || a === 'ja_feito'; };
    (itens || []).forEach(function (x) {
      var k = x.pessoa + '\u0000' + x.de, a = acc.idx[k];
      if (!a) { a = acc.idx[k] = { pessoa: x.pessoa, de: x.de, para: x.para, acao: x.acao, fotos: 0, antigas: x.antigas || 0, nova: !!x.nova }; acc.lista.push(a); }
      else if (parada(a.acao) && !parada(x.acao)) { a.acao = x.acao; a.antigas = x.antigas || 0; a.nova = !!x.nova; }
      if (!parada(x.acao)) a.fotos += x.fotos || 0;
    });
    return acc;
  }

  window.Galeria = function (o) {
    var nomesCt = o.nomes || nomesPadrao();   // funções de nome do contrato (o.nomes do app.js ou a cópia curta)
    var root = null, aba = 'local', filtro = { cid: '', pid: '', autor: '', mes: '' }, agrupar = '';
    var per = lerPer(), pf = null;   // período escolhido; pf: rascunho da janela do período (null = fechada)
    var itens = [], locais = {}, lista = [], sel = {}, selecionando = false, carregando = false, erroTxt = '', geracao = 0;
    var minis = {}, pedindo = {}, fila = {}, filaT = null, obs = null, urlsLocais = [];
    var ver = -1, grande = null, ocupado = null, cancelar = false, cidAuto = false, mv = null, guardadas = {}, carregando = null;
    // fLocal: filtro de No aparelho ('aparelho' só aqui, 'fila', 'enviada' no Drive); lote: as fotos que entraram na fila nesta
    // leva (id -> tamanho), para a barra contar "3 de 7" e os MB até a fila esvaziar; semRede: a aba do banco mostra as guardadas
    var fLocal = '', lote = {}, semRede = 0, bx = null, bs = null, cfg = false;
    // aba Drive: dpath = a pasta aberta (nomes, a partir da raiz; em "por pessoa" o 1º é a pessoa); dlista = a última leitura do Drive
    var dpath = [], dmodo = lsLer(DMODO_KEY) === 'pessoa' ? 'pessoa' : 'contrato', dbusca = '', dlista = null, semMini = {}, dvistos = {};
    try { dvistos = JSON.parse(lsLer(DVISTO_KEY) || '{}') || {}; } catch (e) { dvistos = {}; }
    cacheIds().then(function (m) { guardadas = m; });

    function login() { return o.getLogin ? o.getLogin() : null; }
    function nv() { return o.nivel ? o.nivel() : 0; }
    function modo() { return nv() >= 2 ? agrupar || agruparPadrao(aba) : 'mes'; }
    function abasVisiveis() {
      return ABAS.filter(function (a) { return ((a.nivel === 0 && !a.login) || (login() && nv() >= a.nivel)) && (!a.drive || !!(o.driveUrl && o.driveUrl() && o.drive && o.drive.post)); });
    }
    function q(s) { return root.querySelector(s); }
    function msgErro(e) {
      var c = (e && (e.code || e.erro || e.message)) || '';
      if (c === 'sem_rede') return 'Sem conexão. As fotos guardadas neste aparelho continuam em "No aparelho"; as baixadas aparecem aqui quando houver alguma.';
      if (c === 'codigo_invalido') return 'Seu acesso expirou ou mudou. Entre de novo.';
      if (c === 'sem_permissao' || c === 'so_criador') return 'Seu acesso não permite ver estas fotos.';
      if (c === 'sem_login') return 'Entre com o seu código para ver as fotos enviadas.';
      if (c === 'acao_invalida') return 'O script do Drive ainda é a versão antiga: a aba Drive precisa da versão 7.';
      if (c === PASTA_FORA) return 'A pasta principal do Drive está indisponível agora.';
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
        driveId: f.drive_id || null, tamanho: f.tamanho, autorUid: f.autor_uid || null };   // o drive_url gravado não é usado (linkDrive)
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
        semRede = 0;
        if (aba === 'drive') return listarDrive(l);
        return o.Banco.fotosListar(l.codigo, aba, 1000).then(function (arr) { return arr.map(deBanco); }, function (e) {
          if (!e || (e.code || e.erro || e.message) !== 'sem_rede') throw e;
          // sem sinal: as fotos baixadas para o app (dados e miniatura guardados), na regra da aba
          return itensLer().then(function (gs) {
            var uid = l.uid || null;
            var arr = gs.map(function (x) { if (x.mini) minis[x.id] = x.mini; return x.dados; }).filter(function (it) {
              return aba === 'todas' ? true : aba === 'relatorio' ? !!it.relatorio : aba === 'minhas' ? (uid ? it.autorUid === uid : it.autor === l.nome) : false;
            });
            if (!arr.length) throw e;
            semRede = arr.length;
            return arr;
          });
        });
      }).then(function (arr) {
        if (g !== geracao || !arr) return;
        arr.sort(function (a, b) { return String(b.em || '').localeCompare(String(a.em || '')); });
        itens = arr; carregando = false;
        if (cidAuto) {
          cidAuto = false;
          var at = o.ativo ? o.ativo() : '';
          if (!filtro.cid && at && itens.some(function (x) { return x.cid === at; })) filtro.cid = at;
        }
        render();
      }, function (e) {
        if (g !== geracao) return;
        itens = []; carregando = false; erroTxt = msgErro(e);
        render();
      });
    }
    // ---------------------------------------------------------------- aba Drive
    function deDrive(f) {
      var x = deArquivo(f), ps = (f.pastas || []).slice();
      return { id: 'drv:' + f.id, nome: x.nome_arquivo, origem: 'drive', cid: x.contrato_id || '', pid: x.ponto_id || '',
        pnome: x.ponto_nome || (ps[1] && ps[1] !== 'Sem ponto' ? ps[1] : ''), lote: x.lote || '', km: x.km, lat: x.lat, lng: x.lng, em: x.tirada_em,
        desc: x.descricao || '', autor: x.autor_nome === 'Sem nome' ? '' : x.autor_nome, driveId: f.id, tamanho: f.tamanho || null, pastas: ps,
        criado: f.criado || null, situacao: 'ativa' };
    }
    // a lista do Drive vale 3 min (trocar de aba ou de pasta não lê de novo); "Atualizar" lê na hora. Sem sinal: as baixadas daqui
    function listarDrive(l) {
      if (dlista && Date.now() - dlista.t < 180000) return Promise.resolve(dlista.itens.slice());
      var url = o.driveUrl ? o.driveUrl() : null;
      if (!url) { var e0 = new Error('sem_url'); e0.code = 'sem_url'; return Promise.reject(e0); }
      return postDrive(url, { acao: 'ver_listar', ambiente: o.ambiente || 'oficial', codigo: l.codigo }).then(function (r) {
        if (!r || !r.ok) { var e = new Error((r && r.erro) || 'erro'); e.code = (r && r.erro) || 'erro'; throw e; }
        var arr = (r.fotos || []).map(deDrive);
        dlista = { t: Date.now(), itens: arr, limite: !!r.limite, amplo: !!r.amplo };
        if (!dvistos._base) { dvistos._base = new Date().toISOString(); guardarVistos(); }
        return arr.slice();
      }, function () {
        return itensLer().then(function (gs) {
          var arr = gs.filter(function (x) { return x.dados && x.dados.origem === 'drive'; }).map(function (x) { if (x.mini) minis[x.id] = x.mini; return x.dados; });
          if (!arr.length) { var e = new Error('sem_rede'); e.code = 'sem_rede'; throw e; }
          semRede = arr.length;
          return arr;
        });
      });
    }
    function guardarVistos() { try { localStorage.setItem(DVISTO_KEY, JSON.stringify(dvistos)); } catch (e) { /* sem armazenamento */ } }
    function caminhoDe(it) { return dmodo === 'pessoa' ? [it.autor || 'Sem nome'].concat(it.pastas || []) : (it.pastas || []); }
    function dentro(c, path) { if (c.length < path.length) return false; for (var i = 0; i < path.length; i++) if (c[i] !== path[i]) return false; return true; }
    function noCaminho(it) { return dentro(caminhoDe(it), dpath); }
    function naBusca(it) {
      var b = dbusca.trim().toLowerCase().replace(/^km\s+/, '');
      if (!b) return true;
      var c = caminhoDe(it);
      return [it.nome, it.pnome, it.autor, it.desc, kmTxt(it.km), it.km != null ? String(it.km) : '', nomePasta(c[0] || '')].concat(c).join(' \u2022 ').toLowerCase().indexOf(b) >= 0;
    }
    // até aqui, cartões de pasta (contratos; em "por pessoa", pessoas e contratos); daqui para dentro, fichas dos pontos e a grade
    function nivelGrade() { return dmodo === 'pessoa' ? 2 : 1; }
    function emCartoes() { return aba === 'drive' && !dbusca.trim() && dpath.length < nivelGrade(); }
    function chaveVisto(path) { return dmodo + ':' + path.join('/'); }
    function filhosDe(path) {
      var m = {}, ordem = [], base = dvistos._base || '';
      itens.forEach(function (it) {
        var c = caminhoDe(it);
        if (c.length <= path.length || !dentro(c, path)) return;
        var k = c[path.length];
        if (!m[k]) { m[k] = { nome: k, n: 0, bytes: 0, novas: 0, sub: {} }; ordem.push(k); }
        var x = m[k], v = dvistos[chaveVisto(path.concat([k]))] || base;
        x.n++; x.bytes += it.tamanho || 0;
        if (c.length > path.length + 1) x.sub[c[path.length + 1]] = 1;
        if (v && it.criado && it.criado > v) x.novas++;
      });
      var ord = contratos().map(function (c) { return nomesCt.pasta(c); });
      return ordem.map(function (k) { return m[k]; }).sort(function (a, b) {
        var ia = ord.indexOf(a.nome), ib = ord.indexOf(b.nome);
        if (ia >= 0 || ib >= 0) return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
        return a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true });
      });
    }
    // "CT 02 00315-2026" -> o nome do contrato no app ("Pontos Críticos 315")
    function nomePasta(k) {
      var ch = chaveCT(k), c = contratos().find(function (x) { return nomesCt.pasta(x) === k || (ch && chaveCT(x.numero) === ch); });
      return c ? curto(c.id) : '';
    }
    function rotuloPasta(path, k) {
      var nivelCt = dmodo === 'pessoa' ? 1 : 0;
      if (path.length === nivelCt) { var n = nomePasta(k); return n ? n + ' \u00b7 ' + k : k; }
      return k;
    }
    function irPasta(path) {
      dpath = path; sel = {}; dbusca = '';
      if (path.length) { dvistos[chaveVisto(path)] = new Date().toISOString(); guardarVistos(); }
      render();
      var corpo = q('.gl-body'); if (corpo) corpo.scrollTop = 0;
    }
    function botaoIr(path, html, extra) { return '<button type="button" data-g="dr-ir" data-p="' + esc(JSON.stringify(path)) + '"' + (extra || '') + '>' + html + '</button>'; }
    function trilhaHtml() {
      if (!dpath.length) return '';
      var h = '<nav class="gl-trilha" aria-label="Pasta aberta">' + botaoIr([], 'Drive') + '<span aria-hidden="true">\u203a</span>';
      dpath.forEach(function (k, i) {
        var r = rotuloPasta(dpath.slice(0, i), k);
        h += i === dpath.length - 1 ? '<b aria-current="page">' + esc(r) + '</b>' : botaoIr(dpath.slice(0, i + 1), esc(r)) + '<span aria-hidden="true">\u203a</span>';
      });
      return h + '</nav>';
    }
    function driveFil() {
      var chipM = function (v, t) { return '<button type="button" class="gl-chip" data-g="dr-modo" data-v="' + v + '" aria-pressed="' + (dmodo === v) + '">' + t + '</button>'; };
      var h = '<div class="gl-dr-top"><input type="search" class="gl-dr-busca" data-f="dbusca" value="' + esc(dbusca) + '" placeholder="Buscar pasta, ponto ou km" aria-label="Buscar no Drive" enterkeyhint="search">' +
        '<div class="gl-chips" role="group" aria-label="Organizar">' + chipM('contrato', 'Por contrato') + chipM('pessoa', 'Por pessoa') + '</div></div><div class="gl-dr-resto">';
      h += trilhaHtml();
      if (!emCartoes()) {
        var base = dpath.slice(0, nivelGrade()), fs = !dbusca.trim() ? filhosDe(base) : [];
        if (fs.length > 1 || (fs.length === 1 && dpath.length > base.length)) {
          h += '<div class="gl-chips" role="group" aria-label="Pastas">' + botaoIr(base, 'Todas \u00b7 ' + itens.filter(function (it) { return dentro(caminhoDe(it), base); }).length, ' class="gl-chip" aria-pressed="' + (dpath.length === base.length) + '"') +
            fs.map(function (f) { return botaoIr(base.concat([f.nome]), esc(f.nome) + ' \u00b7 ' + f.n, ' class="gl-chip" aria-pressed="' + (dpath[base.length] === f.nome) + '"'); }).join('') + '</div>';
        }
        h += perHtml();
      }
      return h + '</div>';
    }
    function cartoesHtml() {
      var fs = filhosDe(dpath);
      if (!fs.length) return '<div class="gl-vazio">Nenhuma pasta aqui.</div>';
      var h = '<div class="gl-dr-pastas">' + fs.map(function (f) {
        var nSub = Object.keys(f.sub).length, nivelCt = dmodo === 'pessoa' ? 1 : 0;
        var sub = (nSub ? plural(nSub, dpath.length === nivelCt ? 'pasta de ponto' : 'pasta', dpath.length === nivelCt ? 'pastas de ponto' : 'pastas') + ' \u00b7 ' : '') + plural(f.n, 'foto', 'fotos') + (f.bytes ? ' \u00b7 ' + tam(f.bytes) : '');
        return botaoIr(dpath.concat([f.nome]), IC_PASTA + '<span><b>' + esc(rotuloPasta(dpath, f.nome)) + '</b><small>' + esc(sub) + '</small></span>' +
          (f.novas ? '<i>' + plural(f.novas, 'nova', 'novas') + '</i>' : '') + '<em aria-hidden="true">\u203a</em>', ' class="gl-pasta"');
      }).join('') + '</div>';
      if (!dpath.length) h += '<p class="gl-dr-nota"><b>Só o que existe no Drive.</b> Aparecem também as fotos que alguém pôs direto na pasta pelo computador e que não estão na galeria da equipe.' +
        (dlista && !dlista.amplo ? ' Aqui ficam só as fotos que você tirou.' : '') + '</p>';
      return h;
    }
    function arvoreHtml() {
      var h = '';
      function nivel(path, prof) {
        filhosDe(path).forEach(function (f) {
          var p = path.concat([f.nome]), aberto = dentro(dpath, p), atual = dpath.length === p.length && aberto;
          h += botaoIr(p, '<span style="padding-left:' + (prof * 14) + 'px">' + (aberto ? '\u25be ' : Object.keys(f.sub).length ? '\u25b8 ' : '') + esc(rotuloPasta(path, f.nome)) + '</span><small>' + f.n + '</small>', atual ? ' aria-current="true"' : '');
          if (aberto && prof < 3) nivel(p, prof + 1);
        });
      }
      nivel([], 0);
      var bytes = itens.reduce(function (a, x) { return a + (x.tamanho || 0); }, 0), aqui = itens.filter(noAparelho).length;
      return h + '<p>' + (dlista && dlista.amplo ? 'Drive da equipe' : 'Suas fotos no Drive') + ' \u00b7 ' + plural(itens.length, 'foto', 'fotos') + (bytes ? ' \u00b7 ' + tam(bytes) : '') + (aqui ? '<br>Neste aparelho: ' + aqui : '') + '</p>';
    }
    function miniDe(it) { var l = locais[it.id]; return (l && l.mini) || it.mini || minis[it.id] || null; }

    // miniaturas do banco: só as que aparecem na tela, em lotes de 40
    function pedirMini(id) {
      if (minis[id] || pedindo[id] || semMini[id] || (locais[id] && locais[id].mini)) return;
      fila[id] = 1;
      clearTimeout(filaT);
      filaT = setTimeout(buscarMinis, 60);
    }
    function buscarMinis() {
      var l = login(), ids = Object.keys(fila);
      fila = {};
      if (!l || !ids.length) return;
      var drv = ids.filter(function (id) { return id.indexOf('drv:') === 0; });
      if (drv.length) { minisDrive(drv); ids = ids.filter(function (id) { return id.indexOf('drv:') !== 0; }); }
      for (var i = 0; i < ids.length; i += 40) (function (lote) {
        lote.forEach(function (id) { pedindo[id] = 1; });
        o.Banco.fotosMini(l.codigo, lote).then(function (arr) {
          arr.forEach(function (m) { minis[m.id] = 'data:image/jpeg;base64,' + m.jpeg; mostrarMini(m.id); });
          lote.forEach(function (id) { delete pedindo[id]; });
        }, function () { lote.forEach(function (id) { delete pedindo[id]; }); });
      })(ids.slice(i, i + 40));
    }
    // miniaturas do Drive (aba Drive): 12 por pedido, uma leva de cada vez; a grande que o Drive às vezes manda é reduzida aqui
    function minisDrive(ids) {
      var l = login(), url = o.driveUrl ? o.driveUrl() : null, cadeia = Promise.resolve();
      if (!l || !url) return cadeia;
      ids.forEach(function (id) { pedindo[id] = 1; });
      partes(ids, 12).forEach(function (lote) {
        cadeia = cadeia.then(function () {
          return postDrive(url, { acao: 'ver_minis', ambiente: o.ambiente || 'oficial', codigo: l.codigo, ids: lote.map(function (id) { return id.slice(4); }) }).then(function (r) {
            var cad = Promise.resolve();
            ((r && r.minis) || []).forEach(function (m) {
              var id = 'drv:' + m.id;
              if (!m.jpeg) { semMini[id] = 1; return; }
              cad = cad.then(function () { return m.leve ? m.jpeg : reduzir(b64Blob(m.jpeg, 'image/jpeg')); }).then(function (j) {
                if (j) { minis[id] = 'data:image/jpeg;base64,' + j; mostrarMini(id); } else semMini[id] = 1;
              });
            });
            return cad;
          }, function () { /* sem sinal: tenta de novo na próxima vez que aparecer */ }).then(function () { lote.forEach(function (id) { delete pedindo[id]; }); });
        });
      });
      return cadeia;
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

    // foto inteira: do aparelho (tirada aqui ou já baixada antes), ou do Drive pelo script (confere quem pode ver);
    // a que vem do Drive fica guardada para a próxima vez
    function arquivo(it) {
      var l = locais[it.id];
      var aqui = l && l.temArquivo && o.drive ? o.drive.arquivo(it.id) : Promise.resolve(null);
      return aqui.then(function (b) {
        if (b) return b;
        if (!it.driveId) throw { code: 'sem_drive' };
        return cacheLer(it.driveId).then(function (c) {
          if (c) return c;
          var url = o.driveUrl ? o.driveUrl() : null, lg = login();
          if (!url) throw { code: 'sem_url' };
          if (!lg) throw { code: 'sem_login' };
          return o.drive.post(url, { acao: it.origem === 'drive' ? 'ver_baixar' : 'baixar', ambiente: o.ambiente || 'oficial', codigo: lg.codigo, driveId: it.driveId }).then(function (r) {
            if (!r || !r.ok) throw { code: (r && r.erro) || 'erro' };
            var bl = b64Blob(r.dados, r.mime);
            cacheGravar(it.driveId, bl).then(function () { guardadas[it.driveId] = 1; retile(it.id); });
            return bl;
          }, function () { throw { code: 'sem_rede' }; });
        });
      });
    }
    // o motivo de um apagar/restaurar que o script do Drive não fez
    function motivoDrive(c) {
      return c === 'sem_rede' ? 'sem conexão' : c === 'banco_nao_marcou' ? 'o banco não confirmou; o arquivo ficou onde estava'
        : c === 'nao_desfeito' ? 'o banco não confirmou e o arquivo não voltou: confira em "Conferir com o Drive"'
        : c === PASTA_FORA ? 'pasta principal do Drive indisponível' : c === 'fora_da_pasta' ? 'o arquivo está fora da pasta do Drive da equipe'
        : c === 'sem_permissao' || c === 'so_criador' ? 'sem permissão' : c || 'erro';
    }
    function erroArquivo(e) {
      var c = e && e.code;
      if (c === PASTA_FORA) return 'A pasta principal do Drive está indisponível. Avise o Administrador.';
      return c === 'sem_drive' ? 'Esta foto ainda não chegou ao Drive.' : c === 'sem_rede' ? 'Sem conexão com o Drive.' : c === 'sem_login' ? 'Entre com o seu código.'
        : c === 'sem_url' ? 'O envio ao Drive não está configurado.' : c === 'codigo_invalido' ? 'Seu acesso expirou. Entre de novo.'
        : c === 'sem_permissao' ? 'Seu acesso não permite esta foto.' : 'Não foi possível pegar a foto (' + (c || 'erro') + ').';
    }

    // ---------------------------------------------------------------- filtros
    function contratos() { return (o.contratos ? o.contratos() : []) || []; }
    // conservação: a foto vai ao relatório só com o contrato e o km (os segmentos são divisão nossa; não se escolhe ponto)
    function ehCons(cid) { var c = cid && contratos().find(function (x) { return x.id === cid; }); return !!c && c.tipo === 'conserva'; }
    // nome completo, para a foto aberta ("Pontos Críticos 314 · Lote 01 · CT 02 00314/2026"); contrato que não está neste
    // aparelho: o texto gravado com a foto
    function nomeContrato(cid, it) {
      var c = contratos().find(function (x) { return x.id === cid; });
      return c ? nomesCt.completo(c) || 'Contrato' : (it && it.lote) || 'Sem contrato';
    }
    // nome de tela, para a fila de contratos, as legendas e as escolhas ("Pontos Críticos 314", "Proarte 424")
    function curto(cid) {
      var c = contratos().find(function (x) { return x.id === cid; });
      return c ? nomesCt.nome(c) || 'Contrato' : 'Sem contrato';
    }
    function semPeriodo(it) {
      if (aba === 'drive') return (dbusca.trim() ? true : noCaminho(it)) && naBusca(it);   // a busca vale para o Drive todo
      return (!filtro.cid || (filtro.cid === SEM ? !it.cid : it.cid === filtro.cid)) && (!filtro.pid || (filtro.pid === SEM ? !it.pid : it.pid === filtro.pid)) &&
        (!filtro.km || (it.km != null && isFinite(it.km) && Number(it.km) >= filtro.km[0] - FOLGA_KM && Number(it.km) <= filtro.km[1] + FOLGA_KM)) &&
        (!filtro.autor || (it.autor || 'Sem nome') === filtro.autor) && (!filtro.mes || mesKey(it.em) === filtro.mes) &&
        (aba !== 'local' || !fLocal || (!!locais[it.id] && locais[it.id].situacao === fLocal));
    }
    function noPeriodo(it, iv) { if (!iv) return true; var k = diaDaFoto(it.em); return !!k && k >= iv[0] && k <= iv[1]; }
    function filtrar() {
      var iv = intervaloPer(per);
      lista = itens.filter(function (it) { return semPeriodo(it) && noPeriodo(it, iv); });
    }
    // fotos que os outros filtros mostrariam, mas ficam fora do período (para não sumirem sem aviso)
    function foraDoPeriodo() {
      var iv = intervaloPer(per);
      return iv ? itens.filter(function (it) { return semPeriodo(it) && !noPeriodo(it, iv); }).length : 0;
    }
    function contarPeriodo(p) { var iv = intervaloPer(p); return itens.filter(function (it) { return semPeriodo(it) && noPeriodo(it, iv); }).length; }
    function mudarPer(p) { per = p; salvarPer(per); sel = {}; render(); }
    function opcoes(sel0, vazio, pares) {
      return '<option value="">' + esc(vazio) + '</option>' + pares.map(function (p) {
        return '<option value="' + esc(p[0]) + '"' + (p[0] === sel0 ? ' selected' : '') + '>' + esc(p[1]) + '</option>';
      }).join('');
    }
    // fila de contratos: Todos, cada contrato com fotos e as sem contrato (cada uma com a quantidade)
    function contratosHtml() {
      if (!itens.length && !filtro.cid) return '';
      var n = {}, sem = 0, ordem = contratos().map(function (c) { return c.id; });
      itens.forEach(function (it) { if (it.cid) n[it.cid] = (n[it.cid] || 0) + 1; else sem++; });
      if (filtro.cid && filtro.cid !== SEM && !n[filtro.cid]) n[filtro.cid] = 0;
      var ids = Object.keys(n).sort(function (a, b) { var ia = ordem.indexOf(a), ib = ordem.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
      function chip(v, t, k, cls) {
        return '<button type="button" class="gl-ct' + (cls ? ' ' + cls : '') + '" data-ct="' + esc(v) + '" aria-pressed="' + (filtro.cid === v) + '">' + esc(t) + '<small>' + k + '</small></button>';
      }
      return chip('', 'Todos', itens.length) + ids.map(function (id) { return chip(id, curto(id), n[id]); }).join('') +
        (sem || filtro.cid === SEM ? chip(SEM, 'Sem contrato', sem, 'sem') : '');
    }
    function filtrosHtml() {
      if (aba === 'drive') return driveFil();
      var ps = {}, as = {}, ms = {}, semPonto = 0;
      itens.forEach(function (it) {
        var noCt = !filtro.cid || (filtro.cid === SEM ? !it.cid : it.cid === filtro.cid);
        if (it.pid && noCt) ps[it.pid] = it.pnome || 'Ponto';
        if (!it.pid && noCt && !ehCons(it.cid)) semPonto++;
        as[it.autor || 'Sem nome'] = 1;
        var k = mesKey(it.em); if (k) ms[k] = 1;
      });
      // aberta num ponto sem fotos: o filtro continua visível
      if (filtro.pid && filtro.pid !== SEM && !ps[filtro.pid]) {
        var c0 = contratos().find(function (x) { return x.id === filtro.cid; }), p0 = c0 && (c0.pontos || []).find(function (x) { return x.id === filtro.pid; });
        ps[filtro.pid] = (p0 && p0.nome) || 'Ponto';
      }
      var ordem = function (m) { return Object.keys(m).map(function (k) { return [k, m[k] === 1 ? k : m[k]]; }).sort(function (a, b) { return a[1].localeCompare(b[1], 'pt-BR', { numeric: true }); }); };
      var h = '';
      // No aparelho: Todas · Só aqui · Na fila · No Drive (cada uma com a quantidade; só as que têm foto)
      if (aba === 'local' && itens.length) {
        var cs = { aparelho: 0, fila: 0, enviada: 0 };
        itens.forEach(function (it) { var lo = locais[it.id]; if (lo && cs[lo.situacao] != null) cs[lo.situacao]++; });
        var chipL = function (v, t, k) { return '<button type="button" class="gl-chip" data-g="fl" data-v="' + v + '" aria-pressed="' + (fLocal === v) + '">' + t + ' · ' + k + '</button>'; };
        h += '<div class="gl-chips" role="group" aria-label="Situação das fotos">' + chipL('', 'Todas', itens.length) +
          [['aparelho', 'Só aqui'], ['fila', 'Na fila'], ['enviada', 'No Drive']].filter(function (x) { return cs[x[0]] || fLocal === x[0]; })
            .map(function (x) { return chipL(x[0], x[1], cs[x[0]]); }).join('') + '</div>';
      }
      if (filtro.km) h += '<button type="button" class="gl-chip" data-g="km-tirar" aria-pressed="true" aria-label="Tirar o filtro do km">' + esc((filtro.km[2] ? filtro.km[2] + ' · ' : '') + 'km ' + String(filtro.km[0]).replace('.', ',') + ' a ' + String(filtro.km[1]).replace('.', ',')) + ' ✕</button>';
      if ((Object.keys(ps).length || filtro.pid || semPonto) && !ehCons(filtro.cid)) {
        h += '<select data-f="pid" aria-label="Ponto">' + opcoes(filtro.pid, 'Todos os pontos', ordem(ps).concat(semPonto || filtro.pid === SEM ? [[SEM, 'Sem ponto (' + semPonto + ')']] : [])) + '</select>';
      }
      if (aba !== 'local' && aba !== 'minhas' && (Object.keys(as).length > 1 || filtro.autor)) h += '<select data-f="autor" aria-label="Pessoa">' + opcoes(filtro.autor, 'Todas as pessoas', ordem(as)) + '</select>';
      var iv = intervaloPer(per);
      if (itens.length && nv() >= 2) {
        var g = modo();
        h += '<select data-f="agrupar" aria-label="Agrupar">' + Object.keys(AGRUPAR).map(function (k) {
          return '<option value="' + k + '"' + (k === g ? ' selected' : '') + '>' + AGRUPAR[k] + '</option>';
        }).join('') + '</select>';
      }
      return h + perHtml();
    }
    // período em fichas; "Escolher…" abre a janela (hoje, semana passada, todas as datas, de… até…) e mostra o escolhido nela
    function perHtml() {
      var h = '', iv = intervaloPer(per);
      var atual = per.modo === 'semana' ? (per.off ? '' : 'semana0') : per.modo, fichas = [['semana0', 'Esta semana'], ['sem2', '2 semanas'], ['mes', 'Mês'], ['mes3', '3 meses']];
      var outro = !fichas.some(function (f2) { return f2[0] === atual; });
      h += '<div class="gl-chips gl-pers" role="group" aria-label="Período">' + fichas.map(function (f2) {
        return '<button type="button" class="gl-chip" data-g="per-chip" data-k="' + f2[0] + '" aria-pressed="' + (atual === f2[0]) + '">' + f2[1] + '</button>';
      }).join('') + '<button type="button" class="gl-chip gl-per" data-g="per" aria-haspopup="dialog" aria-pressed="' + outro + '" aria-label="Período: ' + esc(outro ? rotuloPer(per) : 'escolher') + '">' +
        CAL + '<span>' + esc(outro ? rotuloPer(per) : 'Escolher…') + '</span></button></div>';
      if (per.modo === 'semana' && iv && per.off) {
        var off = per.off || 0;
        h += '<div class="gl-sem"><button type="button" data-g="per-ant" aria-label="Semana anterior">‹</button><div><b>' +
          esc(!off ? 'Esta semana' : off === -1 ? 'Semana passada' : 'Semana') + '</b><small>' + esc(faixaTxt(iv[0], maisDias(iv[0], 6))) + ' · segunda a domingo</small></div>' +
          '<button type="button" data-g="per-prox" aria-label="Próxima semana"' + (off >= 0 ? ' disabled' : '') + '>›</button></div>';
      }
      return h;
    }
    // por data: um grupo por dia quando o período tem até 16 dias; maior (ou todas as datas), um por semana (segunda a domingo)
    function porDia() { var iv = intervaloPer(per); return !!iv && (dDia(iv[1]) - dDia(iv[0])) / 864e5 <= 16; }
    function grupoData(it, diario) {
      var k = diaDaFoto(it.em);
      if (!k) return 'Sem data';
      if (diario) return SEMN[dDia(k).getDay()] + ', ' + diaLongo(k);
      var s = segundaDe(k), e = maisDias(s, 6), h = hojeIso();
      return 'Semana de ' + faixaTxt(s, e > h ? h : e);
    }
    function grupos() {
      var g = modo(), mapa = {}, ordem = [], diario = porDia();
      lista.forEach(function (it, i) {
        var k = g === 'pessoa' ? it.autor || 'Sem nome' : grupoData(it, diario);
        if (!mapa[k]) { mapa[k] = []; ordem.push(k); }
        mapa[k].push(i);
      });
      if (g !== 'mes') ordem.sort(function (a, b) { return a.localeCompare(b, 'pt-BR', { numeric: true }); });
      return ordem.map(function (k) { return { nome: k, idx: mapa[k] }; });
    }

    // ---------------------------------------------------------------- tela
    // onde a foto está, no canto de cima à direita: ☁ no Drive (e aqui), ▯ só aqui, fila, subindo, ! tentando de novo;
    // da equipe: ▯ baixada neste aparelho, ⤓ só no Drive
    function estado(it) {
      if (aba === 'deletadas') return '';
      var lo = locais[it.id];
      if (lo) {
        var sobe = o.drive && o.drive.info ? o.drive.info().emEnvio : null;
        if (lo.situacao === 'enviada') return '<span class="gl-s ok" title="No Drive e neste aparelho">' + IC_NUVEM + '</span>';
        if (lo.situacao === 'aparelho') return '<span class="gl-s" title="Só neste aparelho">' + IC_APAR + '</span>';
        if (it.id === sobe) return '<span class="gl-s sobe" title="Subindo para o Drive"></span>';
        if (lo.erro && lo.erro !== 'rede') return '<span class="gl-s erro" title="Tentando de novo">!</span>';
        return '<span class="gl-s fila" title="Na fila do Drive">fila</span>';
      }
      if (it.origem !== 'banco' && it.origem !== 'drive') return '';
      // no download em andamento: a vez de cada uma
      if (bx && bx.pos && bx.pos[it.id] != null && bx.alvo !== 'mini' && !(it.driveId && guardadas[it.driveId])) {
        if (bx.pos[it.id] === bx.i) return '<span class="gl-s sobe" title="Baixando"></span>';
        if (bx.pos[it.id] > bx.i) return '<span class="gl-s fila" title="Na fila do download">fila</span>';
      }
      return it.driveId && guardadas[it.driveId] ? '<span class="gl-s" title="Baixada neste aparelho">' + IC_APAR + '</span>'
        : '<span class="gl-s nuvem" title="Só no Drive">' + IC_BAIXA + '</span>';
    }
    function badge(it) {
      if (selecionando) return '';
      if (aba === 'deletadas') return '<span class="gl-b erro">Apagada</span>';
      if (it.origem === 'banco' && !it.pid && !ehCons(it.cid)) return '<span class="gl-b sp">Sem ponto</span>';
      return '';
    }
    function legendaHtml() {
      var s1 = function (c, ic, t) { return '<span><span class="gl-s ' + c + '">' + ic + '</span>' + t + '</span>'; };
      if (aba === 'local') return '<div class="gl-leg">' + s1('ok', IC_NUVEM, 'no Drive') + s1('', IC_APAR, 'só aqui') + s1('fila', 'fila', 'vai subir') + s1('sobe', '', 'subindo') + '</div>';
      if (aba === 'deletadas') return '';
      return '<div class="gl-leg">' + s1('nuvem', IC_BAIXA, 'só no Drive') + s1('', IC_APAR, 'baixada neste aparelho') + '</div>';
    }
    // legenda em duas linhas: "P14 · km 756,30" em destaque; embaixo o dia (a hora, quando o grupo já é o dia) e quem tirou.
    // Em "Todos" os contratos, o nº do contrato na frente da 2ª linha ("314 · 16/10 · Bruno")
    function tile(it, i) {
      var m = miniDe(it), l1 = [it.pnome, kmCurto(it.km)].filter(Boolean).join(' · ') || (ehCons(it.cid) ? 'Sem km' : 'Sem ponto');
      var d = data(it.em), quando = !d ? '' : modo() === 'mes' && porDia() ? pad(d.getHours()) + ':' + pad(d.getMinutes()) : pad(d.getDate()) + '/' + pad(d.getMonth() + 1);
      var quem = (aba === 'todas' || aba === 'relatorio' || aba === 'deletadas' || aba === 'drive') && modo() !== 'pessoa' && it.autor ? it.autor.split(' ')[0] : '';
      var nCt = !filtro.cid ? ((/(\d+)\s*$/.exec(curto(it.cid)) || [])[1] || curto(it.cid)) : '';
      var l2 = [nCt, quando, quem].filter(Boolean).join(' · ');
      var cap = l1 + (l2 ? ' · ' + l2 : '');
      var rotulo = [it.pid || ehCons(it.cid) ? '' : 'Sem ponto', it.pnome, kmTxt(it.km), quem ? it.autor : '', hora(it.em)].filter(Boolean).join(', ');
      return '<button type="button" class="gl-t" data-i="' + i + '" data-id="' + esc(it.id) + '"' + (m ? '' : ' data-falta') +
        (selecionando ? ' aria-pressed="' + !!sel[it.id] + '"' : '') + ' aria-label="' + esc(rotulo) + '">' +
        (m ? '<img alt="" src="' + esc(m) + '">' : '<img alt="">') + badge(it) + estado(it) +
        (it.relatorio && !selecionando ? '<span class="gl-star" title="No relatório">★</span>' : '') +
        (selecionando ? '<span class="gl-ck"></span>' : '') + '<span class="gl-cap" title="' + esc(cap) + '"><b>' + esc(l1) + '</b>' + (l2 ? '<span>' + esc(l2) + '</span>' : '') + '</span></button>';
    }
    function infoHtml() {
      if (aba === 'local') {
        var all = Object.keys(locais).map(function (k) { return locais[k]; });
        if (!all.length) return '';
        var pend = all.filter(function (x) { return x.situacao === 'fila'; }).length, soAp = all.filter(function (x) { return x.situacao === 'aparelho'; }).length;
        var env = all.filter(function (x) { return x.situacao === 'enviada'; }).length, bytes = all.reduce(function (a, x) { return a + (x.temArquivo ? x.tamanho || 0 : 0); }, 0);
        var inf = o.drive ? o.drive.info() : {}, pd = inf.prox ? new Date(inf.prox) : null, quando = pd ? '; tenta de novo às ' + pad(pd.getHours()) + ':' + pad(pd.getMinutes()) : '';
        var t = '<b>' + plural(all.length, 'foto guardada', 'fotos guardadas') + '</b> neste aparelho' + (bytes ? ' · ' + tam(bytes) : '');
        if (pend) {
          t += ' · <span class="gl-warn">' + plural(pend, 'esperando envio', 'esperando envio') + '</span>';
          if (!login()) t += ' (só vão para o Drive depois que você entrar com o seu código)';
          else if (inf.erro === 'codigo') t += ' (seu acesso mudou: entre de novo para enviar)';
          else if (inf.erro === PASTA_FORA) {
            // a pasta principal do Drive não abriu e o script não criou outra (versão 6): as fotos esperam aqui
            t += ' <span class="gl-err">(a pasta principal do Drive está indisponível; as fotos esperam neste aparelho' + quando + '. ' +
              (nv() >= 3 ? 'Confira a pasta no Drive (se foi para a lixeira, restaure). Outra pasta, só pelo editor do script: ' + (o.ambiente === 'previa' ? 'criarPastaPrevia' : 'criarPastaOficial') + '.'
                : 'Avise o Administrador.') + ')</span>';
          }
          else if (inf.busy) t += ' (enviando…)';
          else if (inf.erro === 'rede' || navigator.onLine === false) t += ' (sem sinal; envia sozinho depois' + quando + ')';
          else if (inf.erro === 'tempo') t += ' (o envio demorou demais' + (quando || '; tenta de novo sozinho') + ')';
          else if (inf.erro === 'recusado') t += ' (o envio foi recusado e o acesso não pôde ser conferido agora' + quando + ')';
          else if (inf.erro === 'script') t += ' (o Drive recusou o envio, mas o seu acesso está certo' + quando + ')';
          else if (inf.erro === 'banco') t += ' (o banco não aceitou o registro agora' + (quando || '; tenta de novo sozinho') + ')';
          else if (!(o.driveUrl && o.driveUrl())) t += ' (envio ao Drive não configurado)';
        } else if (!soAp) t += ' · todas já foram enviadas';
        if (soAp) t += ' · ' + plural(soAp, 'só no aparelho (não vai para o Drive)', 'só no aparelho (não vão para o Drive)');
        var b = '';
        if (soAp) b += '<button type="button" class="btn small primary" data-g="enviar-ap">Enviar ' + (soAp === 1 ? 'esta' : 'as ' + soAp) + ' ao Drive</button>';
        if (pend && !login() && o.entrar) b += '<button type="button" class="btn small primary" data-g="entrar">Entrar para enviar</button>';
        b += '<button type="button" class="gl-cfg" data-g="cfg">' + IC_CFG + 'Espaço e envio</button>';
        return '<span class="gl-txt">' + t + foraHtml() + '</span>' + b + selBtn();
      }
      if (aba === 'drive') {
        var cartoes = emCartoes(), base = cartoes ? itens.filter(noCaminho) : lista;
        var bD = base.reduce(function (a, x) { return a + (x.tamanho || 0); }, 0), aquiD = base.filter(noAparelho).length;
        var ivD = cartoes ? null : intervaloPer(per), faltamD = selecionando ? lista.filter(function (x) { return !noAparelho(x); }).length : 0;
        return '<span class="gl-txt">' + (ivD ? esc(faixaTxt(ivD[0], ivD[1])) + ' \u00b7 ' : '') + '<b>' + plural(base.length, 'foto', 'fotos') + '</b>' + (bD ? ' \u00b7 ' + tam(bD) : '') +
          (aquiD ? ' \u00b7 ' + aquiD + ' j\u00e1 neste aparelho' : '') + (cartoes ? '' : foraHtml()) +
          (dlista && dlista.limite ? ' \u00b7 <span class="gl-warn">o Drive tem mais fotos do que a lista mostra (as primeiras 4.000)</span>' : '') +
          ' \u00b7 <button type="button" class="gl-lk" data-g="dr-atualizar">Atualizar</button></span>' +
          (faltamD && faltamD < lista.length ? '<button type="button" class="btn small" data-g="dr-falta">S\u00f3 as que n\u00e3o tenho (' + faltamD + ')</button>' : '') + (cartoes ? '' : selBtn());
      }
      var txt = {
        minhas: 'Fotos que você enviou, de qualquer aparelho.',
        todas: 'Fotos de toda a equipe. Marque com ★ as que vão para o relatório fotográfico.',
        relatorio: 'Fotos escolhidas para o relatório fotográfico.',
        deletadas: 'Apagadas do Drive por engenheiros. Ficam na pasta Deletados até você restaurar.'
      }[aba];
      var semP = aba === 'relatorio' ? lista.filter(function (x) { return !x.pid && !ehCons(x.cid); }).length : 0;
      if (semP && filtro.pid !== SEM) txt += ' <span class="gl-warn">' + plural(semP, 'está sem ponto e não entra', 'estão sem ponto e não entram') + ' no PDF.</span> <button type="button" class="gl-lk" data-g="ver-sem">Ver ' + (semP === 1 ? 'a foto' : 'as ' + semP) + '</button>';
      var trazer = aba === 'todas' && nv() >= 3 && !selecionando && o.driveUrl && o.driveUrl() ? '<button type="button" class="btn small" data-g="drive-trazer">Trazer fotos do Drive</button>' +
        '<button type="button" class="btn small" data-g="drive-pastas">Pastas do Drive pelo nº do contrato</button>' : '';
      // Administrador: confere se a galeria e a pasta Deletados do Drive dizem a mesma coisa (só lê; nada muda)
      if (aba === 'deletadas' && nv() >= 3 && !selecionando && o.driveUrl && o.driveUrl()) trazer += '<button type="button" class="btn small" data-g="drive-conferir">Conferir com o Drive</button>';
      var ivI = intervaloPer(per), bytesL = lista.reduce(function (a, x) { return a + (x.tamanho || 0); }, 0);
      return '<span class="gl-txt">' + (ivI ? esc(faixaTxt(ivI[0], ivI[1])) + ' · ' : '') + '<b>' + plural(lista.length, 'foto', 'fotos') + '</b>' +
        (bytesL ? ' · ' + tam(bytesL) + ' no tamanho original' : '') + foraHtml() + ' · ' + txt + '</span>' + trazer +
        (aba === 'relatorio' && o.relatorioPdf && itens.length && !selecionando ? '<button type="button" class="btn small primary" data-g="rel-pdf">Gerar o relatório em PDF</button>' : '') + selBtn();
    }
    function foraHtml() {
      var n = foraDoPeriodo();
      return n ? ' · <button type="button" class="gl-lk" data-g="per-tudo">' + plural(n, 'foto fora do período', 'fotos fora do período') + ': ver todas as datas</button>' : '';
    }
    function selBtn() {
      if (!lista.length) return '';
      return selecionando ? '<button type="button" class="btn small" data-g="todas">' + (intervaloPer(per) ? 'Tudo do período' : 'Selecionar todas') + ' (' + lista.length + ')</button>'
        : '<button type="button" class="btn small" data-g="selecionar">Selecionar</button>' +
          '<button type="button" class="btn small" data-g="baixar-tudo">Baixar ' + (lista.length === 1 ? 'a foto' : 'as ' + lista.length) + '</button>';
    }
    function corpoHtml() {
      if (aba !== 'drive') return corpoAba();
      var dentroH = itens.length && !erroTxt && emCartoes() ? cartoesHtml() : corpoAba();
      return itens.length && !erroTxt ? '<div class="gl-dr"><nav class="gl-dr-arv" aria-label="Pastas do Drive">' + arvoreHtml() + '</nav><div class="gl-dr-main">' + dentroH + '</div></div>' : dentroH;
    }
    function corpoAba() {
      if (carregando && !itens.length) return '<div class="gl-vazio">Carregando…</div>';
      if (erroTxt) return '<div class="gl-vazio">' + esc(erroTxt) + (login() ? '' : '<br><button type="button" class="btn small primary" data-g="entrar">Entrar</button>') + '</div>';
      if (!itens.length) {
        return '<div class="gl-vazio">' + ({
          local: 'Nenhuma foto guardada neste aparelho. As fotos com carimbo (botão Foto) ficam aqui assim que você tira.',
          minhas: 'Você ainda não enviou fotos.', todas: 'Nenhuma foto enviada pela equipe ainda.',
          relatorio: 'Nenhuma foto marcada para o relatório. Marque com ★ em "Equipe".', deletadas: 'Nenhuma foto na lixeira.',
          drive: 'Nenhuma foto no Drive ainda' + (dlista && !dlista.amplo ? ' tirada por você' : '') + '.'
        }[aba]) + '</div>';
      }
      if (!lista.length) {
        if (foraDoPeriodo()) {
          return '<div class="gl-vazio">Nenhuma foto neste período (' + esc(rotuloPer(per).toLowerCase()) + ').<br>' +
            (per.modo === 'semana' ? '<button type="button" class="btn small" data-g="per-ant">Ver a semana anterior</button> ' : '') +
            '<button type="button" class="btn small" data-g="per-tudo">Todas as datas</button></div>';
        }
        return '<div class="gl-vazio">' + (aba === 'drive' && dbusca.trim() ? 'Nada no Drive com “' + esc(dbusca.trim()) + '” aqui.' : 'Nenhuma foto com esses filtros.') + '</div>';
      }
      var rotG = modo() === 'pessoa' ? 'Selecionar as da pessoa' : porDia() ? 'Selecionar o dia' : 'Selecionar a semana';
      return grupos().map(function (g) {
        var bg = g.idx.reduce(function (a, i) { return a + (lista[i].tamanho || 0); }, 0);
        return '<h3 class="gl-g">' + esc(g.nome) + ' <small>' + plural(g.idx.length, 'foto', 'fotos') + (bg && !selecionando ? ' · ' + tam(bg) : '') + '</small>' +
          (selecionando ? '<button type="button" data-g="sel-grupo" data-idx="' + g.idx.join(',') + '">' + rotG + '</button>' : '') + '</h3>' +
          '<div class="gl-grid">' + g.idx.map(function (i) { return tile(lista[i], i); }).join('') + '</div>';
      }).join('') + legendaHtml();
    }
    // ---------------------------------------------------------------- janela do período
    function pfAbrir() {
      var off = per.off || 0, r = per.modo === 'semana' ? (off === 0 ? 'semana0' : off === -1 ? 'semana1' : 'semanaX') : per.modo;
      var iv = intervaloPer(per) || [maisDias(hojeIso(), -6), hojeIso()];
      pf = { r: r, de: iv[0], ate: iv[1] };
      renderPf();
      var b = q('.gl-pf-op[aria-pressed="true"]') || q('.gl-pf-op'); if (b) b.focus();
    }
    function pfFechar() { var aberta = !!pf; pf = null; var el = q('.gl-pf'); if (el) el.remove(); var b = aberta && q('.gl-per'); if (b) b.focus(); }
    function pfPer() {
      if (!pf) return per;
      if (pf.r === 'semana0') return { modo: 'semana', off: 0, de: '', ate: '' };
      if (pf.r === 'semana1') return { modo: 'semana', off: -1, de: '', ate: '' };
      if (pf.r === 'semanaX') return { modo: 'semana', off: per.off || 0, de: '', ate: '' };
      if (pf.r === 'datas') return { modo: 'datas', off: 0, de: pf.de <= pf.ate ? pf.de : pf.ate, ate: pf.de <= pf.ate ? pf.ate : pf.de };
      return { modo: pf.r, off: 0, de: '', ate: '' };
    }
    function renderPf() {
      if (!root || !pf) return;
      var h = hojeIso(), s0 = segundaDe(h);
      var ops = [
        ['hoje', 'Hoje', diaLongo(h)], ['semana0', 'Esta semana', faixaTxt(s0, h)],
        ['semana1', 'Semana passada', faixaTxt(maisDias(s0, -7), maisDias(s0, -1))], ['mes', 'Este mês', MESL[dDia(h).getMonth()].replace('.', '') + ' de ' + h.slice(0, 4)],
        ['tudo', 'Todas as datas', plural(itens.filter(semPeriodo).length, 'foto', 'fotos')], ['datas', 'Escolher datas', 'início e fim']
      ];
      var marc = pf.r === 'semanaX' ? 'semana1' : pf.r, n = contarPeriodo(pfPer());
      var html = '<div class="gl-pf-box" role="dialog" aria-modal="true" aria-labelledby="glPfT">' +
        '<div class="gl-pf-top"><h3 id="glPfT">Período das fotos</h3><button type="button" class="btn small" data-g="pf-fechar" aria-label="Fechar">✕</button></div>' +
        '<div class="gl-pf-ops">' + ops.map(function (o2) {
          return '<button type="button" class="gl-pf-op" data-g="pf-op" data-k="' + o2[0] + '" aria-pressed="' + (o2[0] === marc) + '"><b>' + esc(o2[1]) + '</b><small>' + esc(o2[2]) + '</small></button>';
        }).join('') + '</div>' +
        (pf.r === 'datas' ? '<div class="gl-pf-datas"><label>De (início)<input type="date" id="glPfDe" value="' + esc(pf.de) + '" max="' + esc(h) + '"></label>' +
          '<label>Até (fim)<input type="date" id="glPfAte" value="' + esc(pf.ate) + '" max="' + esc(h) + '"></label>' +
          '<div class="gl-pf-atal"><button type="button" data-g="pf-ult" data-n="7">Últimos 7 dias</button><button type="button" data-g="pf-ult" data-n="15">Últimos 15 dias</button>' +
          '<button type="button" data-g="pf-ult" data-n="30">Últimos 30 dias</button></div></div>' : '') +
        '<div class="gl-pf-acts"><button type="button" class="btn" data-g="per-tudo">Todas as datas</button>' +
        '<button type="button" class="btn primary" data-g="pf-aplicar">' + (n ? 'Ver ' + plural(n, 'foto', 'fotos') : 'Nenhuma foto: aplicar') + '</button></div></div>';
      var el = q('.gl-pf');
      if (!el) { el = document.createElement('div'); el.className = 'gl-pf'; root.appendChild(el); }
      el.innerHTML = html;
    }
    function selecionadas() { return lista.filter(function (it) { return sel[it.id]; }); }
    // ações possíveis para um conjunto de fotos, conforme a aba e o acesso
    function acoes(ls) {
      var n = nv(), a = [];
      if (!ls.length) return a;
      a.push({ k: 'baixar', t: ls.length === 1 ? 'Baixar' : 'Baixar (' + ls.length + ')', c: 'primary' });
      if (n >= 2 && aba !== 'local' && aba !== 'deletadas' && aba !== 'drive') {
        var todas = ls.every(function (x) { return x.relatorio; });
        a.push({ k: todas ? 'tirar-rel' : 'por-rel', t: todas ? '☆ Tirar do relatório' : '★ Relatório' });
      }
      var ap = ls.filter(function (x) { return locais[x.id] && locais[x.id].situacao === 'aparelho'; }).length;
      // a que está subindo agora não dá para segurar: o arquivo já vai a caminho do Drive
      var sobe = o.drive && o.drive.info ? o.drive.info().emEnvio : null;
      var fi = ls.filter(function (x) { return locais[x.id] && locais[x.id].situacao === 'fila' && locais[x.id].etapa !== 'registro' && x.id !== sobe; }).length;
      var mov = aba !== 'deletadas' ? ls.filter(podeMover).length : 0;
      if (mov) a.push({ k: 'mover', t: 'Contrato e ponto' + (ls.length > 1 ? ' (' + mov + ')' : '') });
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
      var bs0 = ls.reduce(function (a, x) { return a + (x.tamanho || 0); }, 0);
      return '<div class="gl-bar"><span class="gl-n">' + (ls.length ? plural(ls.length, 'selecionada', 'selecionadas') + (bs0 ? ' · ' + tam(bs0) : '') : 'Toque nas fotos') + '</span>' +
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
      renderEnv();
      q('.gl-cts').innerHTML = aba === 'drive' ? '' : contratosHtml();
      var fil = q('.gl-fil'), bus = fil.querySelector('.gl-dr-busca');
      if (aba === 'drive' && bus && document.activeElement === bus) {   // digitando: só o resto do filtro muda
        var tmp = document.createElement('div'); tmp.innerHTML = filtrosHtml();
        var r0 = fil.querySelector('.gl-dr-resto'), r1 = tmp.querySelector('.gl-dr-resto');
        if (r0 && r1) r0.innerHTML = r1.innerHTML;
        var m0 = fil.querySelector('.gl-dr-top .gl-chips'), m1 = tmp.querySelector('.gl-dr-top .gl-chips');
        if (m0 && m1) m0.innerHTML = m1.innerHTML;
      } else fil.innerHTML = filtrosHtml();
      q('.gl-info').innerHTML = carregando && !itens.length ? '' : infoHtml();
      corpo.innerHTML = corpoHtml();
      corpo.scrollTop = top;
      q('.gl-barhost').innerHTML = barHtml();
      observar();
      if (ver >= 0) renderVer();
    }
    function renderBar() { if (root) q('.gl-barhost').innerHTML = barHtml(); }
    function renderEnv() { if (root) { var e = q('.gl-env'); if (e) e.innerHTML = envioHtml() + baixaHtml() + (semRede && aba !== 'local' ? '<div class="gl-off">Sem conexão: mostrando ' + (semRede === 1 ? 'a foto baixada' : 'as ' + semRede + ' fotos baixadas') + ' neste aparelho.</div>' : ''); } }

    // ---------------------------------------------------------------- barra de envio ao Drive
    function envioHtml() {
      if (!o.drive || !o.drive.info) return '';
      var fila = Object.keys(locais).filter(function (k) { return locais[k].situacao === 'fila'; });
      if (!fila.length) { lote = {}; return ''; }
      fila.forEach(function (k) { lote[k] = locais[k].tamanho || 0; });
      var ids = Object.keys(lote).filter(function (k) { return locais[k]; }), tot = 0, feito = 0, nf0 = 0;
      ids.forEach(function (k) { tot += lote[k]; if (locais[k].situacao === 'enviada') { feito += lote[k]; nf0++; } });
      var inf = o.drive.info(), n = ids.length, agora = Math.min(n, nf0 + (inf.busy ? 1 : 0)) || 1;
      var pd = inf.prox ? new Date(inf.prox) : null, quando = pd ? ' (tenta às ' + pad(pd.getHours()) + ':' + pad(pd.getMinutes()) + ')' : '';
      var parado = !login() || inf.pausado || inf.esperaWifi || inf.erro === 'codigo';
      var motivo = !login() ? 'Entre com o seu código para enviar.' : inf.erro === 'codigo' ? 'Seu acesso mudou: entre de novo para enviar.'
        : inf.pausado ? 'Pausado por você. As fotos esperam neste aparelho.' : inf.esperaWifi ? 'Esperando o Wi-Fi ("só no Wi-Fi" está ligado).'
        : inf.erro === 'rede' || navigator.onLine === false ? 'Sem sinal: envia sozinho quando voltar' + quando + '.'
        : inf.busy ? 'Segue sozinho enquanto o app estiver aberto.' : 'Esperando a vez' + quando + '.';
      var bts = !login() ? (o.entrar ? '<button type="button" data-g="entrar">Entrar</button>' : '')
        : inf.pausado ? '<button type="button" data-g="env-cont">Continuar</button>'
        : '<button type="button" data-g="env-pausa">Pausar</button>' + (!inf.busy && inf.erro !== 'codigo' ? '<button type="button" data-g="enviar">Enviar agora</button>' : '');
      var pct = tot ? Math.round(100 * feito / tot) : Math.round(100 * nf0 / n);
      return '<div class="gl-prg' + (parado ? ' pausa' : '') + '" role="status"><div class="gl-prg-l"><b>' + IC_SOBE + ' ' + (parado ? 'Envio ao Drive parado · ' + nf0 + ' de ' + n + (n === 1 ? ' enviada' : ' enviadas') : 'Enviando ao Drive · ' + agora + ' de ' + n) + '</b>' +
        '<span>' + mb(feito) + ' de ' + mb(tot) + '</span></div><div class="gl-prg-b"><i style="width:' + pct + '%"></i></div>' +
        '<div class="gl-prg-r"><span>' + esc(motivo) + '</span>' + bts + '</div></div>';
    }

    // ---------------------------------------------------------------- baixar várias: para onde, quanto ocupa e o andamento
    function noAparelho(it) { return !!((locais[it.id] && locais[it.id].temArquivo) || (it.driveId && guardadas[it.driveId])); }
    function abrirBaixar(ls) {
      var faltam = ls.filter(function (x) { return !noAparelho(x); });
      bs = { ls: ls, alvo: faltam.length && aba !== 'local' ? 'app' : 'galeria', wifi: false };
      renderBaixar();
    }
    function fecharBaixar() { bs = null; var el = root && q('.gl-sh.bx'); if (el) el.remove(); }
    function renderBaixar() {
      if (!root || !bs) return;
      var ls = bs.ls, n = ls.length, faltam = ls.filter(function (x) { return !noAparelho(x); });
      var soma = function (l) { return l.reduce(function (a, x) { return a + (x.tamanho || 0); }, 0); }, bTot = soma(ls), bFal = soma(faltam);
      var comp = o.podeCompartilharFotos ? o.podeCompartilharFotos() : false;
      var op = function (v, t, d) { return '<button type="button" class="gl-op" data-g="bx-op" data-v="' + v + '" aria-pressed="' + (bs.alvo === v) + '"><i aria-hidden="true"></i><span><b>' + t + '</b><small>' + d + '</small></span></button>'; };
      var h = '<div class="gl-sh-box" role="dialog" aria-modal="true" aria-labelledby="glBxT"><div class="gl-sh-top"><h3 id="glBxT">Baixar ' + plural(n, 'foto', 'fotos') + (bTot ? ' · ' + tam(bTot) : '') + '</h3>' +
        '<button type="button" class="btn small" data-g="bx-fechar" aria-label="Fechar">✕</button></div>';
      if (aba !== 'local') h += op('app', 'No app (abrir sem internet)', faltam.length ? 'Ficam nesta galeria para abrir sem sinal. Ocupa ' + mb(bFal) + ' neste aparelho' + (faltam.length < n ? ' (' + (n - faltam.length) + ' já estão aqui)' : '') + '.' : 'Todas já estão neste aparelho.');
      h += comp ? op('galeria', 'Na galeria de fotos do celular', 'Abre o compartilhar do celular: no iPhone, toque em <b>Salvar ' + (n === 1 ? 'imagem' : n + ' imagens') + '</b>; no Android, escolha Galeria, Fotos ou Arquivos.')
        : op('galeria', 'No computador (.zip)', 'Vai para a pasta de downloads' + (n > POR_ZIP ? ', em ' + Math.ceil(n / POR_ZIP) + ' arquivos .zip de até ' + POR_ZIP + ' fotos' : ', num arquivo .zip') + '.');
      if (aba !== 'local') h += op('mini', 'Só as miniaturas', 'Para ver sem sinal sem ocupar espaço: cerca de ' + mb(n * 25000) + '.');
      if (o.drive && o.drive.sabeRede && o.drive.sabeRede()) h += '<label class="gl-ckl"><input type="checkbox" id="glBxWifi"' + (bs.wifi ? ' checked' : '') + '> Só no Wi-Fi' + (rede() === 'cellular' ? ' (você está nos dados móveis: começa quando conectar)' : '') + '</label>';
      h += '<p class="gl-mv-nota">O download segue enquanto o app estiver aberto, mesmo com a galeria fechada; a barra mostra quantas faltam e os MB.</p>';
      var bt = bs.alvo === 'app' ? (faltam.length ? 'Baixar ' + mb(bFal) : 'Já estão aqui') : bs.alvo === 'mini' ? 'Guardar miniaturas' : 'Baixar' + (bTot ? ' ' + tam(bTot) : '');
      h += '<div class="gl-sh-acts"><button type="button" class="btn" data-g="bx-fechar">Cancelar</button><button type="button" class="btn primary" data-g="bx-ir"' + (bs.alvo === 'app' && !faltam.length ? ' disabled' : '') + '>' + IC_BAIXA.replace('aria-hidden', 'width="15" height="15" aria-hidden') + ' ' + bt + '</button></div></div>';
      var el = q('.gl-sh.bx');
      if (!el) { el = document.createElement('div'); el.className = 'gl-sh bx'; root.appendChild(el); }
      el.innerHTML = h;
    }
    function baixaHtml() {
      if (!bx) return '';
      var n = bx.ls.length, pct = bx.total ? Math.round(100 * bx.feitos / bx.total) : Math.round(100 * bx.i / n), parado = bx.pausa || bx.esperaWifi;
      var oque = bx.alvo === 'mini' ? 'Guardando miniaturas' : bx.alvo === 'app' ? 'Baixando para o app' : 'Baixando';
      var motivo = bx.pausa ? 'Pausado.' : bx.esperaWifi ? 'Esperando o Wi-Fi.' : bx.montando ? 'Preparando os arquivos…' : 'Segue enquanto o app estiver aberto, mesmo com a galeria fechada.';
      return '<div class="gl-prg' + (parado ? ' pausa' : '') + '" role="status"><div class="gl-prg-l"><b>' + IC_BAIXA.replace('aria-hidden', 'width="14" height="14" aria-hidden') + ' ' + oque + ' · ' + Math.min(n, bx.i + 1) + ' de ' + n + '</b>' +
        (bx.total ? '<span>' + mb(bx.feitos) + ' de ' + mb(bx.total) + '</span>' : '') + '</div><div class="gl-prg-b"><i style="width:' + pct + '%"></i></div>' +
        '<div class="gl-prg-r"><span>' + esc(motivo) + (bx.falhas ? ' ' + plural(bx.falhas, 'não veio', 'não vieram') + '.' : '') + '</span>' +
        (bx.montando ? '' : (bx.pausa ? '<button type="button" data-g="bx-cont">Continuar</button>' : '<button type="button" data-g="bx-pausa">Pausar</button>') + '<button type="button" data-g="bx-parar">Cancelar</button>') + '</div></div>';
    }
    function avisaBaixa() { renderEnv(); if (o.onBaixa) o.onBaixa(); }
    function iniciarBaixa() {
      if (!bs || bx) return;
      var alvo = bs.alvo, ls = alvo === 'app' ? bs.ls.filter(function (x) { return !noAparelho(x); }) : bs.ls.slice();
      var wifi = bs.wifi;
      fecharBaixar();
      if (!ls.length) return;
      var nomes = nomesUnicos(ls);
      bx = { ls: ls, nomes: nomes, alvo: alvo, wifi: wifi, i: 0, ok: 0, falhas: 0, feitos: 0, arquivos: [], rotulo: ({ local: 'Fotos deste aparelho', minhas: 'Minhas fotos', todas: 'Fotos da equipe', relatorio: 'Relatório fotográfico', deletadas: 'Fotos apagadas', drive: 'Fotos do Drive' }[aba]) + ' ' + new Date().toISOString().slice(0, 10),
        total: alvo === 'mini' ? 0 : ls.reduce(function (a, x) { return a + (x.tamanho || 0); }, 0) };
      bx.pos = {}; ls.forEach(function (x, k) { bx.pos[x.id] = k; });
      selecionando = false; sel = {};
      render();
      baixaPasso();
    }
    function miniPara(it) {
      if (minis[it.id]) return Promise.resolve(minis[it.id]);
      if (it.origem === 'drive') return minisDrive([it.id]).then(function () { return minis[it.id] || null; });
      var lg = login();
      if (!lg || !o.Banco || !o.Banco.fotosMini) return Promise.resolve(null);
      return o.Banco.fotosMini(lg.codigo, [it.id]).then(function (arr) {
        var m = arr && arr[0] ? 'data:image/jpeg;base64,' + arr[0].jpeg : null;
        if (m) { minis[it.id] = m; mostrarMini(it.id); }
        return m;
      }, function () { return null; });
    }
    function baixaPasso() {
      if (!bx || bx.rodando) return;
      if (bx.parar) { bx = null; avisaBaixa(); if (o.toast) o.toast('Download cancelado.'); return; }
      if (bx.pausa) { avisaBaixa(); return; }
      if (bx.wifi && rede() === 'cellular') { bx.esperaWifi = true; avisaBaixa(); return; }   // volta no evento da rede
      bx.esperaWifi = false;
      if (bx.i >= bx.ls.length) { concluirBaixa(); return; }
      var b = bx, it = b.ls[b.i], k = b.i;
      b.rodando = true;
      avisaBaixa();
      var passo = b.alvo === 'mini' ? miniPara(it).then(function (m) { if (!m) throw { code: 'sem_mini' }; return itemGravar(it, m); })
        : arquivo(it).then(function (bl) {
          if (b.alvo === 'galeria') b.arquivos.push({ name: b.nomes[k], blob: bl, date: data(it.em) || new Date() });
          else if (it.origem === 'banco' || it.origem === 'drive') return miniPara(it).then(function (m) { return itemGravar(it, m); }).then(function () { return bl; });
          return bl;
        });
      passo.then(function (bl) { b.ok++; b.feitos += (bl && bl.size) || it.tamanho || 0; if (b.alvo === 'app' && it.driveId) guardadas[it.driveId] = 1; }, function () { b.falhas++; }).then(function () {
        b.rodando = false;
        if (bx !== b) return;
        b.i++;
        retile(it.id); if (b.ls[b.i]) retile(b.ls[b.i].id);
        baixaPasso();
      });
    }
    // o selo de uma miniatura na tela, sem desenhar a grade de novo
    function retile(id) {
      var t = root && root.querySelector('.gl-t[data-id="' + cssId(id) + '"]'), it = lista.find(function (x) { return x.id === id; });
      if (!t || !it) return;
      var s0 = t.querySelector('.gl-s'), novo = estado(it);
      if (s0) s0.outerHTML = novo; else if (novo) t.insertAdjacentHTML('beforeend', novo);
    }
    function concluirBaixa() {
      var b = bx;
      var fim = function (t) {
        bx = null;
        cacheIds().then(function (m) { guardadas = m; if (root && !selecionando) render(); });
        avisaBaixa();
        if (o.toast && t) o.toast(t + (b.falhas ? ' ' + plural(b.falhas, 'foto não veio', 'fotos não vieram') + ' (sem conexão ou ainda não chegaram ao Drive).' : ''), b.falhas ? 7000 : 4000);
      };
      if (b.alvo !== 'galeria') { fim(b.alvo === 'mini' ? plural(b.ok, 'miniatura guardada', 'miniaturas guardadas') + ' para ver sem sinal.' : plural(b.ok, 'foto baixada', 'fotos baixadas') + ' para o app (abre sem sinal).'); return; }
      if (!b.arquivos.length) { fim('Nenhuma foto veio.'); return; }
      b.montando = true; avisaBaixa();
      (o.salvarFotos && o.podeCompartilharFotos && o.podeCompartilharFotos() ? o.salvarFotos(b.arquivos, b.rotulo) : salvarZip(b.arquivos, b.rotulo)).then(function () { fim(''); }, function () { fim('Não foi possível entregar as fotos. Tente com menos fotos.'); });
    }
    function salvarZip(files, rotulo) {
      var partes = Math.ceil(files.length / POR_ZIP), cadeia = Promise.resolve();
      for (var i = 0; i < partes; i++) (function (i) {
        cadeia = cadeia.then(function () { return zip(files.slice(i * POR_ZIP, (i + 1) * POR_ZIP)); }).then(function (z) { return o.saveBlob(rotulo + (partes > 1 ? ' - parte ' + (i + 1) : '') + '.zip', z); });
      })(i);
      return cadeia;
    }
    if (navigator.connection && navigator.connection.addEventListener) navigator.connection.addEventListener('change', function () { if (bx && bx.esperaWifi) baixaPasso(); });

    // ---------------------------------------------------------------- Espaço e envio (No aparelho)
    function abrirCfg() { cfg = true; renderCfg(); }
    function fecharCfg() { cfg = false; var el = root && q('.gl-sh.cf'); if (el) el.remove(); }
    function renderCfg() {
      if (!root || !cfg) return;
      cacheUso().then(function (u) {
        if (!root || !cfg) return;
        var all = Object.keys(locais).map(function (k) { return locais[k]; }).filter(function (x) { return x.temArquivo; });
        var aqui = all.filter(function (x) { return x.situacao !== 'enviada'; }).reduce(function (a, x) { return a + (x.tamanho || 0); }, 0);
        var envs = all.filter(function (x) { return x.situacao === 'enviada'; }), noDrive = envs.reduce(function (a, x) { return a + (x.tamanho || 0); }, 0);
        var tot = aqui + noDrive + u.bytes + u.mini, pc = function (b) { return tot ? Math.max(b ? 1 : 0, Math.round(100 * b / tot)) : 0; };
        var auto = lsLer(DRIVE_KEY) !== '0', manter = lsLer(MANTER_KEY) || '';
        var sw = function (g, on, rot) { return '<button type="button" class="gl-sw" role="switch" data-g="' + g + '" aria-checked="' + on + '" aria-label="' + esc(rot) + '"></button>'; };
        var h = '<div class="gl-sh-box" role="dialog" aria-modal="true" aria-labelledby="glCfT"><div class="gl-sh-top"><h3 id="glCfT">Fotos neste aparelho</h3><button type="button" class="btn small" data-g="cfg-fechar" aria-label="Fechar">✕</button></div>' +
          '<div class="gl-uso"><div class="gl-uso-t"><span>Espaço usado pelas fotos</span><span>' + mb(tot) + '</span></div>' +
          '<div class="gl-uso-b"><span style="width:' + pc(aqui) + '%;background:#9A5B00"></span><span style="width:' + pc(noDrive) + '%;background:#1E7A47"></span><span style="width:' + pc(u.bytes) + '%;background:var(--accent,#1D4F91)"></span><span style="width:' + pc(u.mini) + '%;background:#8E9A93"></span></div>' +
          '<div class="gl-uso-l"><span><b style="color:#9A5B00">■</b> só aqui ' + mb(aqui) + '</span><span><b style="color:#1E7A47">■</b> já no Drive ' + mb(noDrive) + '</span><span><b style="color:var(--accent,#1D4F91)">■</b> baixadas do Drive ' + mb(u.bytes) + '</span><span><b style="color:#8E9A93">■</b> miniaturas ' + mb(u.mini) + '</span></div></div>' +
          '<div class="gl-cx"><h4>Ao tirar a foto</h4>' +
          '<div class="gl-ln"><div><b>Enviar ao Drive automaticamente</b><small>Vai para a fila ao sair da foto (Tirar outra, Ver na galeria, fechar); sobe quando houver sinal.</small></div>' + sw('cfg-auto', auto, 'Enviar ao Drive automaticamente') + '</div>' +
          (o.drive && o.drive.sabeRede && o.drive.sabeRede() ? '<div class="gl-ln"><div><b>Enviar só no Wi-Fi</b><small>Nos dados móveis a foto espera na fila.</small></div>' + sw('cfg-wifi', o.drive.soWifi(), 'Enviar só no Wi-Fi') + '</div>' : '') +
          '</div><div class="gl-cx"><h4>Manter no aparelho</h4>' +
          '<div class="gl-ln"><div><b>Fotos já enviadas</b><small>Depois disso saem deste aparelho e ficam só no Drive (continuam em Minhas e Equipe).</small></div><select id="glCfManter" aria-label="Manter as já enviadas">' +
            [['', 'Sempre'], ['7', '1 semana'], ['14', '2 semanas'], ['30', '1 mês'], ['90', '3 meses']].map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === manter ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></div>' +
          '<div class="gl-ln"><div><b>Fotos que ainda não subiram</b><small>Nunca saem sozinhas.</small></div></div>' +
          '<div class="gl-ln"><div><b>Liberar espaço agora</b><small>' + (envs.length ? 'Tirar deste aparelho as ' + plural(envs.length, 'foto', 'fotos') + ' que já estão no Drive (' + mb(noDrive) + ').' : 'Nenhuma foto enviada guardada aqui.') + '</small></div>' +
            '<button type="button" class="btn small danger" data-g="limpar"' + (envs.length ? '' : ' disabled') + '>Liberar</button></div>' +
          '<div class="gl-ln"><div><b>Baixadas do Drive</b><small>' + (u.n || u.itens ? plural(u.n, 'foto inteira', 'fotos inteiras') + ' (' + mb(u.bytes) + ')' + (u.itens ? ' e ' + plural(u.itens, 'miniatura', 'miniaturas') : '') + '.' : 'Nenhuma.') + '</small></div>' +
            '<button type="button" class="btn small danger" data-g="cfg-cache"' + (u.n || u.itens ? '' : ' disabled') + '>Apagar</button></div>' +
          '</div></div>';
        var el = q('.gl-sh.cf');
        if (!el) { el = document.createElement('div'); el.className = 'gl-sh cf'; root.appendChild(el); }
        el.innerHTML = h;
      });
    }
    function apagarCache() {
      o.confirmar({ titulo: 'Apagar as fotos baixadas do Drive?', botao: 'Apagar', perigo: true,
        html: '<p>Saem só deste aparelho: continuam no Drive e na galeria da equipe. Sem sinal, elas não abrem mais aqui.</p>' }).then(function (ok) {
        if (!ok) return;
        window.GaleriaLimparCache();
        guardadas = {};
        o.toast('Fotos baixadas apagadas deste aparelho.');
        render(); renderCfg();
      });
    }

    // ---------------------------------------------------------------- foto aberta
    function soltarGrande() { if (grande) { URL.revokeObjectURL(grande.url); grande = null; } }
    function abrir(i) { soltarGrande(); ver = i; var it = lista[i]; if (it && ((locais[it.id] && locais[it.id].temArquivo) || it.driveId)) carregando = it.id; renderVer(); if (carregando === (it && it.id)) carregarGrande(); }
    function fecharVer() { soltarGrande(); ver = -1; var v = q('.gl-ver'); if (v) v.remove(); }
    function carregarGrande() {
      var it = lista[ver];
      if (!it) return;
      carregando = it.id;
      var lv = q('.gl-leve');
      if (lv) lv.innerHTML = 'Carregando a foto inteira…';
      arquivo(it).then(function (b) {
        if (carregando === it.id) carregando = null;
        if (lista[ver] !== it) return;
        soltarGrande();
        grande = { id: it.id, blob: b, url: URL.createObjectURL(b) };
        var im = q('.gl-ver-img img'); if (im) im.src = grande.url;
        var l2 = q('.gl-leve'); if (l2) l2.remove();
      }, function (e) {
        if (carregando === it.id) carregando = null;
        if (lista[ver] !== it) return;
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
      var oae = ehOae(contratos().find(function (x) { return x.id === it.cid; })), cons = ehCons(it.cid);
      linhas.push('<b>' + esc([it.cid ? nomeContrato(it.cid, it) : it.lote || 'Sem contrato', it.pnome && !cons ? (oae ? 'Ponte ' : 'Ponto ') + it.pnome : cons ? '' : oae ? 'Sem ponte' : 'Sem ponto'].filter(Boolean).join(' · ')) + '</b>' +
        (!it.pid && !cons && podeMover(it) ? ' <span class="gl-warn">· não entra no relatório</span>' : '') +
        (cons && it.relatorio && it.km == null ? ' <span class="gl-warn">· sem km: vai ao relatório sem o km</span>' : ''));
      linhas.push(esc([kmTxt(it.km), it.lat != null ? Number(it.lat).toFixed(5) + ', ' + Number(it.lng).toFixed(5) : '', hora(it.em)].filter(Boolean).join(' · ')));
      if (it.autor) linhas.push('Tirada por ' + esc(it.autor));
      if (it.origem === 'local') {
        linhas.push(it.situacao === 'enviada' ? 'Enviada ao Drive' + (it.enviada ? ' em ' + esc(hora(new Date(it.enviada).toISOString())) : '') + ' · também guardada neste aparelho'
          : it.situacao === 'aparelho' ? 'Guardada só neste aparelho · não vai para o Drive (toque em Enviar ao Drive se quiser)'
          : 'Guardada neste aparelho · <span class="gl-warn">ainda não enviada</span>');
      } else {
        if (it.relatorio) linhas.push('★ No relatório fotográfico' + (it.relPor ? ' (marcada por ' + esc(it.relPor) + ')' : ''));
        if (it.situacao === 'deletada') linhas.push('Apagada do Drive' + (it.delPor ? ' por ' + esc(it.delPor) : '') + (it.delEm ? ' em ' + esc(hora(it.delEm)) : ''));
        if (it.origem === 'drive' && (it.pastas || []).length) linhas.push('No Drive: ' + esc(it.pastas.join(' › ')));
        if (locais[it.id]) linhas.push('Também guardada neste aparelho');
        else if (it.driveId && guardadas[it.driveId]) linhas.push(it.origem === 'drive' ? 'Já guardada neste aparelho (abre sem sinal)' : 'Foto inteira já baixada neste aparelho');
      }
      if (it.tamanho) linhas.push(esc(it.nome) + ' · ' + tam(it.tamanho));
      if (it.desc) linhas.push('<span class="gl-desc">' + esc(it.desc) + '</span>');
      var temGrande = grande && grande.id === it.id;
      var local = locais[it.id] && locais[it.id].temArquivo;
      var leve = temGrande ? ''
        : carregando === it.id ? '<div class="gl-leve">Carregando a foto inteira' + (it.tamanho && !local && !guardadas[it.driveId] ? ' (' + tam(it.tamanho) + ')' : '') + '…</div>'
        : !local && it.driveId ? '<div class="gl-leve">Prévia leve <button type="button" class="btn small" data-g="grande">Ver a foto inteira' + (it.tamanho ? ' (' + tam(it.tamanho) + ')' : '') + '</button></div>' : '';
      var acts = acoes([it]).map(function (a) { return '<button type="button" class="btn small ' + (a.c || '') + '" data-g="' + a.k + '" data-um="1">' + esc(a.t) + '</button>'; }).join('');
      var lk = nv() >= 3 ? linkDrive(it.driveId) : '';
      if (lk) acts += '<a class="btn small" href="' + esc(lk) + '" target="_blank" rel="noopener noreferrer">Abrir no Drive</a>';
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
      if (bx && ls.length > 1) { o.toast('Espere o download que está em andamento (ou cancele na barra).', 5000); return; }
      if (ls.length === 1) {
        var it = ls[0];
        if (o.toast) o.toast('Baixando a foto…');
        var p = grande && grande.id === it.id ? Promise.resolve(grande.blob) : arquivo(it);
        p.then(function (b) { return o.saveBlob(nomesUnicos([it])[0], b); }, function (e) { o.toast(erroArquivo(e), 5000); });
        return;
      }
      abrirBaixar(ls);
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
        if (!loc.length) { o.toast('Estas fotos ainda não foram enviadas. Espere o envio para apagar do celular.', 7000); return; }
        nao = loc.filter(function (x) { return x.situacao !== 'enviada'; });
      }
      if (!loc.length) return;
      var n = loc.length, sobe = o.drive && o.drive.info ? o.drive.info().emEnvio : null;
      // a que está subindo agora: o envio em curso não para (o arquivo, ou o registro, pode chegar do outro lado)
      var subindo = sobe && loc.some(function (x) { return x.id === sobe && x.situacao === 'fila'; });
      o.confirmar({
        titulo: 'Apagar do celular ' + (n === 1 ? 'esta foto' : n + ' fotos') + '?', perigo: true, botao: 'Apagar do celular',
        html: (nao.length
          ? '<p class="modal-err">' + (nao.length === n ? (n === 1 ? 'Esta foto ainda não foi enviada' : 'Nenhuma delas foi enviada ainda') : plural(nao.length, 'delas ainda não foi enviada', 'delas ainda não foram enviadas')) +
            ' ao Drive: ' + (nao.length === 1 ? 'ela se perde' : 'elas se perdem') + ' de vez.</p>'
          : '<p>' + (n === 1 ? 'Ela continua' : 'Elas continuam') + ' no Drive e na galeria da equipe. Sai só deste aparelho, para liberar espaço.</p>') +
          (subindo ? '<p class="modal-err">' + (n === 1 ? 'Ela' : 'Uma delas') + ' já está sendo enviada agora: pode chegar mesmo assim ao Drive e à galeria da equipe. ' +
            'Se quiser, espere o envio terminar e apague depois pelo "Apagar do Drive".</p>' : ''),
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
      var sobe = !sim && o.drive.info ? o.drive.info().emEnvio : null;
      o.drive.enviar(ids, sim).then(function (m) {
        // a que estava subindo não fica para trás (o drive.js não segura): avisa, em vez de dizer que ficou só no aparelho
        var ja = sobe && ids.indexOf(sobe) >= 0 ? ' A que já estava subindo continua: ela chega ao Drive.' : '';
        if (!m) { if (ja) o.toast(ja.slice(1), 6000); return; }
        o.toast((sim ? plural(m, 'foto na fila', 'fotos na fila') + ' para o Drive' + (login() ? '.' : ': entre com o seu código para enviar.')
          : plural(m, 'foto fica', 'fotos ficam') + ' só neste aparelho (não ' + (m === 1 ? 'vai' : 'vão') + ' para o Drive).') + ja, ja ? 7000 : 5000);
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
        html: '<p>' + (n === 1 ? 'Ela volta' : 'Elas voltam') + ' para a pasta original no Drive (se ela não existir mais, para a pasta do contrato e do ponto) ' +
          'e para a galeria da equipe.</p>'
      }).then(function (ok) {
        if (!ok) return;
        cancelar = false;
        var feitos = 0, falhas = [], cadeia = Promise.resolve();
        ls.forEach(function (it, i) {
          cadeia = cadeia.then(function () {
            if (cancelar) return;
            ocupado = (apagar ? 'Apagando ' : 'Restaurando ') + (i + 1) + ' de ' + n + '…'; renderBar();
            var corpo = { acao: apagar ? 'apagar' : 'restaurar', ambiente: o.ambiente || 'oficial', codigo: l.codigo, driveId: it.driveId };
            // restaurar: se a pasta original não existe mais (juntada na pasta nova do contrato), o script usa estas (versão 4)
            var pr = apagar ? null : pastasDaFoto(it);
            if (pr) corpo.pastas = pr;
            return o.drive.post(url, corpo).then(function (r) {
              // o banco não marcou e o script não conseguiu devolver o arquivo (versão 6): Drive e galeria ficaram diferentes
              if (r && r.ok) feitos++; else falhas.push(r && r.erro === 'banco_nao_marcou' && r.desfeito === false ? 'nao_desfeito' : (r && r.erro) || 'erro');
            }, function () { falhas.push('sem_rede'); });
          });
        });
        cadeia.then(function () {
          ocupado = null;
          if (ver >= 0) fecharVer();
          sel = {}; selecionando = false;
          var t = feitos ? plural(feitos, apagar ? 'foto foi para a Lixeira' : 'foto restaurada', apagar ? 'fotos foram para a Lixeira' : 'fotos restauradas') + '.' : '';
          var f0 = falhas.indexOf('nao_desfeito') >= 0 ? 'nao_desfeito' : falhas.indexOf('sem_rede') >= 0 ? 'sem_rede' : falhas[0];
          if (falhas.length) t += ' ' + plural(falhas.length, 'não foi', 'não foram') + ' (' + motivoDrive(f0) + ').';
          o.toast(t.trim(), 6000);
          carregar();
        });
      });
    }
    // a pasta do Drive da foto, como a tela Foto monta: [pasta do contrato pelo nº, ponto]; contrato que não está neste aparelho: nenhuma
    function pastasDaFoto(it) {
      var c = contratos().find(function (x) { return x.id === it.cid; }), pa = c ? nomesCt.pasta(c) : '';
      if (!pa) return null;
      var p = it.pid ? (c.pontos || []).find(function (x) { return x.id === it.pid; }) : null;
      return [pa, it.pid ? (p && p.nome) || it.pnome || 'Ponto sem nome' : 'Sem ponto'];
    }
    // ---------------------------------------------------------------- contrato e ponto da foto
    // quem tirou corrige as dele; engenheiro e Administrador, qualquer uma; a que está neste aparelho, quem tem o aparelho
    function podeMover(it) {
      if (!it || it.situacao === 'deletada') return false;
      if (locais[it.id]) return true;
      var l = login();
      return it.origem === 'banco' && !!l && (nv() >= 2 || (!!it.autorUid && it.autorUid === l.uid));
    }
    function nf(v, d) { return Number(v).toFixed(d).replace('.', ','); }
    function ehOae(c) { return !!c && c.tipo === 'oae'; }
    // pontosDe, dist, maisPerto e trecho: no começo do arquivo (servem também para ligar os arquivos do Drive aos contratos)
    function rotuloPonto(c, p) {
      var km = p.kmIni == null ? '' : 'km ' + nf(p.kmIni, 2) + (p.kmFim != null && p.kmFim !== p.kmIni && !ehOae(c) ? ' a ' + nf(p.kmFim, 2) : '');
      return [ehOae(c) ? p.nome || p.codigo || 'Ponte' : 'Ponto ' + (p.nome || '?'), ehOae(c) && p.codigo && p.codigo !== p.nome ? p.codigo : '', km].filter(Boolean).join(' · ');
    }
    function metr(d) { return d < 1 ? Math.round(d * 1000) + ' m' : nf(d, 1) + ' km'; }
    function abrirMover(ls) {
      if (!ls.length) return;
      var cs = contratos();
      if (!cs.length) { o.toast('Nenhum contrato cadastrado.'); return; }
      var c0 = ls[0].cid, p0 = ls[0].pid, mesmoC = ls.every(function (x) { return x.cid === c0; }), mesmoP = mesmoC && ls.every(function (x) { return x.pid === p0; });
      var kms = ls.filter(function (x) { return x.km != null && x.km !== ''; }).map(function (x) { return Number(x.km); });
      var cid = mesmoC && c0 && cs.some(function (c) { return c.id === c0; }) ? c0 : (filtro.cid && filtro.cid !== SEM ? filtro.cid : (o.ativo && o.ativo()) || cs[0].id);
      mv = { ls: ls, km: kms.length ? kms.reduce(function (a, b) { return a + b; }, 0) / kms.length : null, varios: kms.length > 1 && Math.max.apply(null, kms) - Math.min.apply(null, kms) > 0.2,
        pid0: mesmoP ? p0 : null, sug: null };
      var agora = mesmoP ? [c0 ? curto(c0) : 'Sem contrato', ls[0].pnome ? (ls[0].pnome) : 'sem ponto'].join(' · ') : 'contratos ou pontos diferentes';
      var enviadas = ls.filter(function (x) { return x.origem === 'banco' || (locais[x.id] && locais[x.id].situacao === 'enviada'); }).length;
      var el = document.createElement('div');
      el.className = 'gl-mv';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-label', 'Contrato e ponto');
      el.innerHTML = '<div class="gl-mv-box"><h3>Contrato e ponto' + (ls.length > 1 ? ' <small>' + plural(ls.length, 'foto', 'fotos') + '</small>' : '') + '</h3>' +
        '<div class="gl-mv-now">Agora: <b>' + esc(agora) + '</b>' + (mv.km != null ? ' · ' + (mv.varios ? 'km de ' + nf(Math.min.apply(null, kms), 2) + ' a ' + nf(Math.max.apply(null, kms), 2) : kmTxt(mv.km)) : '') + '</div>' +
        '<label for="glMvC">Contrato<select id="glMvC">' + cs.map(function (c) {
          return '<option value="' + esc(c.id) + '"' + (c.id === cid ? ' selected' : '') + '>' + esc(curto(c.id)) + '</option>';
        }).join('') + '</select></label>' +
        '<label for="glMvP"><span id="glMvPl">Ponto</span><select id="glMvP"></select></label>' +
        '<div class="gl-mv-sug" aria-live="polite"></div>' +
        '<p class="gl-mv-nota">O carimbo gravado na foto não muda. A galeria e o relatório passam a usar o contrato e o ponto escolhidos aqui.' +
        (enviadas ? ' No Drive, o arquivo continua na pasta em que foi guardado.' : '') + '</p>' +
        '<div class="gl-mv-acts"><button type="button" class="btn" data-g="mv-fechar">Cancelar</button><button type="button" class="btn primary" data-g="mv-salvar">Salvar</button></div></div>';
      root.appendChild(el);
      pontosMover(true);
      var s0 = q('#glMvC'); if (s0) s0.focus();
    }
    // lista de pontos do contrato escolhido; já escolhe o ponto atual ou o do km da foto (até 50 m)
    function pontosMover(primeira) {
      var c = contratos().find(function (x) { return x.id === q('#glMvC').value; }), sp = q('#glMvP');
      q('#glMvPl').textContent = ehOae(c) ? 'Ponte' : 'Ponto';
      sp.closest('label').hidden = !!c && c.tipo === 'conserva';
      var ps = pontosDe(c), perto = mv.km != null && !mv.varios ? maisPerto(c, mv.km) : null, vai = '';
      if (primeira && mv.pid0 && ps.some(function (p) { return p.id === mv.pid0; })) vai = mv.pid0;
      else if (perto && perto.d <= raioPonto(c)) vai = perto.p.id;
      sp.innerHTML = '<option value="">' + (ehOae(c) ? 'Sem ponte (não entra no relatório)' : 'Sem ponto (não entra no relatório)') + '</option>' +
        ps.map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === vai ? ' selected' : '') + '>' + esc(rotuloPonto(c, p)) + '</option>'; }).join('');
      sugestao();
    }
    // um botão "Passar para…" para cada contrato
    function botoesCt(ls) {
      return ls.map(function (x) { return '<button type="button" class="btn small" data-g="mv-ct" data-id="' + esc(x.id) + '">Passar para o ' + esc(curto(x.id)) + '</button>'; }).join(' ');
    }
    // pelo km da foto: o ponto mais perto, e aviso se o km cai fora do trecho do contrato. Os outros contratos que têm o km aparecem
    // todos, cada um com o seu botão: quem corrige escolhe o do serviço fotografado (a galeria não escolhe por ele)
    function sugestao() {
      var box = q('.gl-mv-sug');
      if (!box || !mv) return;
      var c = contratos().find(function (x) { return x.id === q('#glMvC').value; }), sp = q('#glMvP');
      mv.sug = null;
      box.className = 'gl-mv-sug';
      if (mv.km == null) { box.innerHTML = ''; return; }
      var tr = trecho(c), outros = ctsDoKm(contratos(), mv.km).filter(function (x) { return !c || x.id !== c.id; });
      if (tr && !noTrecho(c, mv.km)) {
        box.className = 'gl-mv-sug fora';
        box.innerHTML = 'O km da foto (' + nf(mv.km, 2) + ') fica fora do trecho deste contrato (km ' + nf(tr[0], 2) + ' a ' + nf(tr[1], 2) + ').' +
          (!outros.length ? ' Confira o contrato.'
            : (outros.length === 1 ? ' Está no trecho do ' + esc(curto(outros[0].id)) + '. '
              : ' Está no trecho de ' + outros.length + ' contratos: escolha o do serviço fotografado. ') + botoesCt(outros));
        return;
      }
      // o km também está no trecho de outro contrato (conservação e pontos críticos no mesmo trecho): mostra, sem escolher
      var tambem = outros.length ? '<span>O km também está no trecho ' + (outros.length === 1 ? 'do ' + esc(curto(outros[0].id)) : 'de ' + outros.length + ' outros contratos') +
        '. ' + botoesCt(outros) + '</span>' : '';
      if (mv.varios) { box.innerHTML = 'As fotos foram tiradas em km diferentes: confira se são todas do mesmo ponto.' + (tambem ? ' ' + tambem : ''); return; }
      var perto = maisPerto(c, mv.km);
      if (perto && ehOae(c) && perto.d > raioPonto(c)) perto = null;   // Proarte: só sugere a ponte a até 150 m dela, não no trecho todo
      if (!perto) { box.innerHTML = tambem; return; }
      mv.sug = perto.p;
      var rot = esc(ehOae(c) ? perto.p.nome || perto.p.codigo : 'Ponto ' + perto.p.nome);
      box.innerHTML = 'Pelo km da foto (' + nf(mv.km, 2) + '): ' + (perto.d <= raioPonto(c) ? 'fica no ' + rot : 'o mais perto é ' + rot + ', a ' + metr(perto.d)) +
        (sp.value === perto.p.id ? '' : ' <button type="button" class="btn small" data-g="mv-usar">Usar</button>') + (tambem ? ' ' + tambem : '');
    }
    function fecharMover() { mv = null; var el = root && q('.gl-mv'); if (el) el.remove(); }
    // o motivo, em poucas palavras, de uma parte que o banco não aceitou
    function motivoMover(cd) {
      return cd === 'sem_rede' ? 'sem conexão; tente de novo com sinal' : cd === 'sem_permissao' ? 'você só pode corrigir as fotos que você tirou'
        : cd === 'codigo_invalido' ? 'seu acesso expirou; entre de novo' : cd === 'sem_login' ? 'acabaram de ser enviadas: entre com o seu código e corrija de novo'
        : cd === 'nao_mudou' ? 'não estão mais ativas na galeria da equipe' : cd === 'muitas' ? 'muitas de uma vez'
        : /fotos_mover|PGRST202/.test(cd || '') ? 'o banco ainda não tem esta correção' : 'erro: ' + (cd || 'desconhecido');
    }
    // as fotos já registradas vão ao banco em partes de até 300, uma parte de cada vez. Devolve o que o banco aceitou: aceitas (os
    // ids, quando o banco diz quais: migração 16), semId (quantas mudaram sem o banco dizer quais: banco sem a migração 16), nao e
    // o motivo. Sem conexão no meio, as partes seguintes nem vão (ficam como estavam). Não falha: o que deu errado vem em nao
    function moverNoBanco(l, ids, cid, pid, prog) {
      var r = { aceitas: [], semId: 0, nao: 0, motivo: '' }, cadeia = Promise.resolve(), feitas = 0;
      partes(ids, POR_MOVER).forEach(function (p) {
        cadeia = cadeia.then(function () {
          if (r.motivo === 'sem_rede') { r.nao += p.length; return; }
          if (prog) prog(feitas, ids.length);
          return o.Banco.fotosMover(l.codigo, p, cid, pid).then(function (res) {
            // resposta sem o resumo do banco: vale como antes (o banco não recusou a parte)
            if (!res || typeof res !== 'object') { r.aceitas = r.aceitas.concat(p); return; }
            var m = Math.max(0, Math.min(p.length, res.movidas || 0));
            if (Array.isArray(res.ids)) {
              var ok = p.filter(function (id) { return res.ids.indexOf(id) >= 0; });
              r.aceitas = r.aceitas.concat(ok);
              m = ok.length;
            } else if (m === p.length) r.aceitas = r.aceitas.concat(p);
            else r.semId += m;
            if (m < p.length) { r.nao += p.length - m; if (!r.motivo) r.motivo = 'nao_mudou'; }
          }, function (e) {
            var cd = (e && (e.code || e.message)) || 'erro';
            r.nao += p.length;
            if (!r.motivo || r.motivo === 'nao_mudou' || cd === 'sem_rede') r.motivo = cd;
          }).then(function () { feitas += p.length; });
        });
      });
      return cadeia.then(function () { return r; });
    }
    // banco primeiro: as fotos já registradas vão ao banco (em partes de até 300, com o progresso no botão) e a cópia deste aparelho
    // muda só nas que o banco aceitou; as que ainda não subiram mudam só aqui, como antes (vão para a pasta nova ao subir). Sem
    // conexão, nada muda. O aviso final conta o que mudou de verdade ("18 corrigidas, 2 não (motivo)")
    function salvarMover() {
      if (!mv || mv.salvando) return;
      var cid = q('#glMvC').value, pid = q('#glMvP').value || null, ls = mv.ls;
      var c = contratos().find(function (x) { return x.id === cid; }), p = pid ? (c.pontos || []).find(function (x) { return x.id === pid; }) : null;
      var lote = nomesCt.formal(c) || 'Contrato';   // o texto gravado com a foto: Lote e nº do CT
      var meta = { cid: cid, pid: pid, pnome: p ? p.nome || null : null, lote: lote };
      // como o foto.js monta: pasta pelo nº do contrato; a antiga (o Lote) vai junto para o script renomear a da pessoa
      var pastas = [nomesCt.pasta(c) || 'Sem lote', p ? p.nome || 'Ponto sem nome' : 'Sem ponto'], pastaAntiga = nomesCt.pastaAntiga(c);
      var banIds = ls.filter(function (x) { return x.origem === 'banco' ? x.situacao === 'ativa' : locais[x.id] && locais[x.id].situacao === 'enviada'; }).map(function (x) { return x.id; });
      var soAqui = ls.filter(function (x) { return locais[x.id] && banIds.indexOf(x.id) < 0; }).map(function (x) { return x.id; });
      var l = login();
      if (banIds.length && !l) { o.toast('Entre com o seu código para corrigir as fotos que já foram enviadas.', 6000); return; }
      if (banIds.length && navigator.onLine === false) { o.toast('Sem conexão: nenhuma foto mudou. Tente de novo com sinal.', 6000); return; }
      var b = q('[data-g="mv-salvar"]'), bc = q('[data-g="mv-fechar"]');
      mv.salvando = true;
      if (bc) bc.disabled = true;
      function prog(feitas, total) { if (b) { b.disabled = true; b.textContent = total > POR_MOVER ? 'Salvando ' + feitas + ' de ' + total + '…' : 'Salvando…'; } }
      function solta() { if (mv) mv.salvando = false; if (b) { b.disabled = false; b.textContent = 'Salvar'; } if (bc) bc.disabled = false; }
      prog(0, banIds.length);
      var r = { aceitas: [], semId: 0, nao: 0, motivo: '' }, mudouAqui = [], tarde = { nao: 0, motivo: '' };
      (banIds.length ? moverNoBanco(l, banIds, cid, pid, prog) : Promise.resolve(r)).then(function (res) {
        r = res;
        // sem conexão logo de cara: nada mudou no banco, e nada muda aqui
        if (r.motivo === 'sem_rede' && !r.aceitas.length && !r.semId) return 'nada';
        var locIds = soAqui.concat(r.aceitas.filter(function (id) { return locais[id]; }));
        if (!locIds.length || !o.drive || !o.drive.corrigir) return null;
        return o.drive.corrigir(locIds, meta, pastas, pastaAntiga).then(function (rl) {
          mudouAqui = locIds;
          // as que chegaram ao banco com o painel aberto (a tela ainda dizia "na fila"): o aparelho diz na própria gravação; vão ao
          // banco agora (a cópia daqui já mudou)
          var extras = ((rl && rl.enviadas) || []).filter(function (id) { return banIds.indexOf(id) < 0; });
          if (!extras.length) return null;
          if (!l) { tarde = { nao: extras.length, motivo: 'sem_login' }; return null; }
          return moverNoBanco(l, extras, cid, pid, null).then(function (r2) { tarde = { nao: r2.nao, motivo: r2.motivo }; });
        }, function () { tarde = { nao: soAqui.length, motivo: 'aparelho' }; });
      }).then(function (nada) {
        solta();
        if (nada === 'nada') { o.toast('Sem conexão: nenhuma foto mudou. Tente de novo com sinal.', 6000); return; }
        var feitos = {};
        r.aceitas.concat(mudouAqui).forEach(function (id) { feitos[id] = 1; });
        ls.forEach(function (x) {
          if (!feitos[x.id]) return;
          var it = itens.find(function (y) { return y.id === x.id; });
          [it, locais[x.id]].forEach(function (y) { if (y) { y.cid = cid; y.pid = pid || ''; y.pnome = meta.pnome || ''; y.lote = lote; } });
        });
        // as que mudaram aqui e o banco recusou depois (extras) não contam como corrigidas; as que não mudaram aqui já não contam
        var nao = r.nao + tarde.nao, feitas = Math.max(0, Object.keys(feitos).length + r.semId - (tarde.motivo === 'aparelho' ? 0 : tarde.nao));
        var motivo = tarde.motivo === 'aparelho' && !r.motivo ? 'não foi possível mudar neste aparelho' : motivoMover(r.motivo || tarde.motivo);
        if (!feitas) { o.toast(resumoMover(0, nao, motivo) || 'Nenhuma foto mudou.', 7000); return; }
        o.toast(nao ? curto(cid) + ': ' + resumoMover(feitas, nao, motivo)
          : (feitas === 1 ? 'Foto agora em ' : feitas + ' fotos agora em ') + curto(cid) + ' · ' + (p ? (ehOae(c) ? p.nome : 'ponto ' + p.nome) : 'sem ponto') + '.', nao ? 8000 : 5000);
        fecharMover();
        // a foto foi para outro contrato: a fila de contratos acompanha, para ela continuar à vista
        if (filtro.cid && filtro.cid !== cid) filtro.cid = cid;
        if (filtro.pid && filtro.pid !== (pid || SEM)) filtro.pid = '';
        var aberta = ver >= 0 && lista[ver] ? lista[ver].id : null;
        // as que não mudaram continuam selecionadas, para tentar de novo
        var falta = ls.length > 1 && !r.semId ? banIds.filter(function (id) { return !feitos[id]; }) : [];
        sel = {}; selecionando = falta.length > 0;
        falta.forEach(function (id) { sel[id] = 1; });
        filtrar();
        ver = aberta ? lista.findIndex(function (y) { return y.id === aberta; }) : -1;
        if (ver < 0 && aberta) fecharVer();
        render();
        // o banco mudou algumas sem dizer quais (banco sem a migração 16): a galeria lê de novo
        if (r.semId) carregar();
      }, function (e) {
        solta();
        o.toast('Não foi possível corrigir (' + ((e && (e.code || e.message)) || 'erro') + ').', 6000);
      });
    }
    // ---------------------------------------------------------------- fotos do Drive que não estão na galeria (Administrador)
    // O script do Drive lista as fotos da pasta do ambiente (na prévia, antes copia as do Drive oficial); cada arquivo vira uma foto
    // da galeria por lerArquivo (no começo do arquivo), que acha o contrato pelo nº do CT, depois pelo nome e por último pelo km
    function deArquivo(f) { return lerArquivo(f, contratos(), nomesCt); }
    // miniatura feita aqui (~360 px), quando o Drive ainda não tem a dele
    function reduzir(blob) {
      return new Promise(function (resolve) {
        var u = URL.createObjectURL(blob), img = new Image();
        img.onload = function () {
          URL.revokeObjectURL(u);
          var k = Math.min(1, 360 / Math.max(img.width, img.height)), cv = document.createElement('canvas');
          cv.width = Math.max(1, Math.round(img.width * k)); cv.height = Math.max(1, Math.round(img.height * k));
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          resolve(cv.toDataURL('image/jpeg', 0.62).split(',')[1]);
        };
        img.onerror = function () { URL.revokeObjectURL(u); resolve(null); };
        img.src = u;
      });
    }
    // o script do Drive às vezes devolve uma página de erro do Google numa chamada solta: tenta de novo até 2 vezes
    function postDrive(url, corpo, n) {
      n = n == null ? 2 : n;
      return o.drive.post(url, corpo).then(function (r) {
        return r && r.erro === 'resposta_invalida' && n > 0 ? postDrive(url, corpo, n - 1) : r;
      });
    }
    function trazerDoDrive() {
      var l = login(), url = o.driveUrl ? o.driveUrl() : null, amb = o.ambiente || 'oficial', previa = amb === 'previa';
      if (!l || !url || ocupado || !o.drive || !o.drive.post) return;
      cancelar = false;
      var copiadas = 0, voltas = 0;
      // na prévia: primeiro as cópias das fotos do Drive oficial, em partes de ~25 s (o script diz quantas faltam)
      function copiar() {
        if (!previa || cancelar) return Promise.resolve();
        ocupado = 'Copiando as fotos do Drive oficial para a prévia' + (copiadas ? ' (' + copiadas + ' até agora)' : '') + '…'; renderBar();
        return postDrive(url, { acao: 'drive_copiar', ambiente: amb, codigo: l.codigo }).then(function (r) {
          if (!r || !r.ok) throw { code: (r && r.erro) || 'erro' };
          copiadas += r.copiadas || 0;
          if (r.faltam !== 0 && ++voltas < 40) return copiar();
        });
      }
      copiar().then(function () {
        if (cancelar) throw { code: 'parado' };
        ocupado = 'Procurando no Drive as fotos que faltam na galeria…'; renderBar();
        return Promise.all([
          postDrive(url, { acao: 'drive_listar', ambiente: amb, codigo: l.codigo }),
          o.Banco.fotosListar(l.codigo, 'todas', 1000),
          o.Banco.fotosListar(l.codigo, 'deletadas', 1000).catch(function () { return []; })
        ]);
      }).then(function (r) {
        var res = r[0], ja = {};
        if (!res || !res.ok) throw { code: (res && res.erro) || 'erro' };
        res.copiadas = copiadas;
        r[1].concat(r[2]).forEach(function (f) { if (f.drive_id) ja[f.drive_id] = 1; ja['id:' + f.id] = 1; });
        var novos = [], ids = {};
        (res.fotos || []).forEach(function (f) {
          if (ja[f.id]) return;
          var foto = deArquivo(f);
          if (ja['id:' + foto.id] || ids[foto.id]) return;   // o mesmo envio repetido
          ids[foto.id] = 1;
          novos.push({ f: f, foto: foto });
        });
        ocupado = null; renderBar();
        var cop = res.copiadas ? ' ' + plural(res.copiadas, 'foto foi copiada', 'fotos foram copiadas') + ' do Drive oficial para a pasta da prévia (o oficial não muda).' : '';
        if (!novos.length) { o.toast('Todas as fotos do Drive já estão na galeria.' + cop, 6000); return; }
        var por = {}, ordem = [];
        novos.forEach(function (x) { var k = x.foto.contrato_id ? curto(x.foto.contrato_id) : 'Sem contrato'; if (!por[k]) { por[k] = 0; ordem.push(k); } por[k]++; });
        var semP = novos.filter(function (x) { return !x.foto.ponto_id; }).length;
        return o.confirmar({ titulo: 'Trazer ' + plural(novos.length, 'foto', 'fotos') + ' do Drive?', botao: 'Trazer para a galeria',
          html: '<p>Estão no Drive e ainda não aparecem na galeria: ' + ordem.map(function (k) { return '<b>' + esc(k) + '</b> ' + por[k]; }).join(' · ') + '.</p>' +
            (semP ? '<p>' + plural(semP, 'fica sem ponto', 'ficam sem ponto') + ': dá para definir depois em <b>Contrato e ponto</b>.</p>' : '') +
            '<p>Contrato, ponto, km, data e quem tirou vêm do texto de cada arquivo no Drive.' + cop + '</p>'
        }).then(function (ok) { if (ok) importar(novos); });
      }).catch(function (e) {
        ocupado = null; renderBar();
        var c = e && (e.code || e.erro);
        if (c === 'parado') { o.toast('Parado. Toque de novo para continuar de onde parou.', 5000); return; }
        o.toast(c === 'so_criador' ? 'Só o Administrador traz fotos do Drive.' : c === PASTA_FORA ? 'A pasta principal do Drive está indisponível.' : c === 'acao_invalida' ? 'O script do Drive ainda é a versão antiga (precisa da versão 3).'
          : (e && e.name === 'AbortError') || c === 20 ? 'O Drive demorou demais. Toque de novo: continua de onde parou.'
          : c === 'sem_rede' || !c ? 'Sem conexão com o Drive.' : 'Não foi possível ler o Drive (' + c + ').', 7000);
      });
    }
    function importar(novos) {
      var l = login(), url = o.driveUrl(), amb = o.ambiente || 'oficial', feitas = 0, falhas = 0;
      cancelar = false;
      function lote(ini) {
        if (cancelar || ini >= novos.length) return Promise.resolve();
        var parte = novos.slice(ini, ini + 10);
        ocupado = 'Trazendo ' + (ini + 1) + ' de ' + novos.length + '…'; renderBar();
        return postDrive(url, { acao: 'drive_minis', ambiente: amb, codigo: l.codigo, ids: parte.map(function (x) { return x.f.id; }) }).catch(function () { return null; }).then(function (rm) {
          var mm = {}, cadeia = Promise.resolve();
          ((rm && rm.minis) || []).forEach(function (m) { if (m.jpeg) mm[m.id] = m.jpeg; });
          parte.forEach(function (x, k) {
            cadeia = cadeia.then(function () {
              if (cancelar) return;
              ocupado = 'Trazendo ' + (ini + k + 1) + ' de ' + novos.length + '…'; renderBar();
              // a "miniatura" do Drive vem grande (~1600 px): reduz aqui para ~360 px, como as do app
              var pm = mm[x.f.id] ? reduzir(b64Blob(mm[x.f.id], 'image/jpeg')) : postDrive(url, { acao: 'drive_baixar', ambiente: amb, codigo: l.codigo, driveId: x.f.id }).then(function (r) {
                return r && r.ok ? reduzir(b64Blob(r.dados, r.mime)) : null;
              }, function () { return null; });
              return pm.then(function (mini) { return o.Banco.fotoImportar(l.codigo, x.foto, mini); }).then(function (r) { if (r && r.nova) feitas++; }, function () { falhas++; });
            });
          });
          return cadeia;
        }).then(function () { return lote(ini + 10); });
      }
      lote(0).then(function () {
        ocupado = null;
        o.toast((feitas ? plural(feitas, 'foto do Drive entrou', 'fotos do Drive entraram') + ' na galeria.' : 'Nenhuma foto nova.') +
          (falhas ? ' ' + plural(falhas, 'não entrou', 'não entraram') + ' (tente de novo).' : '') + (cancelar ? ' (parado)' : ''), 7000);
        carregar();
      });
    }
    // ---------------------------------------------------------------- pastas do Drive pelo nº do contrato (Administrador)
    // Até a versão 51 a pasta do contrato era o Lote ("Lote 01"); agora é o nº ("CT 02 00314-2026"). O script (versão 4) renomeia a
    // pasta antiga dentro da pasta de cada pessoa: primeiro só conferindo (testar), depois de verdade; ~25 s por pedido, até acabar.
    function esperar(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    function rodarPastas(url, l, amb, mapa, testar) {
      var acc = { lista: [], idx: {} }, voltas = 0, esperas = 0, raizNome = '', total = 0;
      function passo(desde) {
        if (cancelar) return Promise.reject({ code: 'parado' });
        ocupado = (testar ? 'Conferindo' : 'Renomeando') + ' as pastas do Drive' + (total ? ' (' + Math.min(desde, total) + ' de ' + plural(total, 'pessoa', 'pessoas') + ')' : '') + '…';
        renderBar();
        return postDrive(url, { acao: 'pastas_renomear', ambiente: amb, codigo: l.codigo, mapa: mapa, testar: testar, desde: desde }).then(function (r) {
          if (!r || !r.ok) throw { code: (r && r.erro) || 'erro' };
          // outro pedido mexendo no Drive (um envio, a cópia da prévia): espera um pouco e tenta de novo
          if (r.faltam === -1) { if (++esperas > 40) throw { code: 'ocupado' }; return esperar(3000).then(function () { return passo(desde); }); }
          if (++voltas > 300) throw { code: 'demorou' };
          raizNome = r.raiz || raizNome;
          total = r.pessoas || total;
          juntarRelatorio(acc, r.itens);
          if (r.faltam > 0) return passo(r.proxima);
          return { itens: acc.lista, raiz: raizNome, pessoas: total };
        });
      }
      return passo(0);
    }
    function ondeRaiz(amb, nome) {
      return (amb === 'previa' ? 'Pasta raiz da <b>prévia</b> (testes)' : 'Pasta raiz <b>oficial</b>') + (nome ? ': <b>' + esc(nome) + '</b>' : '') + '.';
    }
    // "Fotos por pessoa / Ana / Lote 01 → CT 02 00314-2026 · renomear · 34 fotos"
    function linhaPasta(x) {
      var oque = x.acao === 'renomear' ? 'renomear'
        : x.acao === 'juntar' ? (x.nova ? 'juntar com a pasta nova, que já existe' : 'juntar as ' + (x.antigas || 2) + ' pastas com o nome antigo')
        : x.acao === 'duas_pastas' ? 'fica como está: ' + (x.nova ? 'a pasta nova já existe' : 'há ' + (x.antigas || 2) + ' pastas com o nome antigo') + ' (nenhuma foto muda de lugar)'
        : 'fica como está: as fotos são de outro contrato';
      // "(raiz)": as pastas soltas na raiz, das fotos do app antigo (sem a pasta da pessoa)
      return '<li>' + (x.pessoa === '(raiz)' ? 'Raiz' : 'Fotos por pessoa / ' + esc(x.pessoa)) + ' / ' + esc(x.de) + ' → <b>' + esc(x.para) + '</b> · ' + oque +
        (x.fotos || (x.acao !== 'outro_contrato' && x.acao !== 'duas_pastas') ? ' · ' + plural(x.fotos || 0, 'foto', 'fotos') : '') + '</li>';
    }
    function listaPastas(ls) {
      return '<ul class="gl-pastas">' + ls.slice(0, 80).map(linhaPasta).join('') + (ls.length > 80 ? '<li>e mais ' + (ls.length - 80) + '…</li>' : '') + '</ul>';
    }
    function msgPastas(e) {
      var c = e && (e.code || e.erro);
      return c === 'parado' ? 'Parado. O que já mudou fica; toque de novo para continuar.'
        : c === 'acao_invalida' ? 'O script do Drive ainda é a versão antiga: reimplante o Codigo.gs (versão 4).'
        : c === 'so_criador' ? 'Só o Administrador renomeia as pastas do Drive.'
        : c === PASTA_FORA ? 'A pasta principal do Drive está indisponível: nada mudou.'
        : c === 'codigo_invalido' ? 'Seu acesso expirou ou mudou. Entre de novo.'
        : c === 'mapa_invalido' ? 'O script recusou a lista de pastas. Confira os números dos contratos.'
        : c === 'ocupado' ? 'O Drive está ocupado com outro pedido (um envio ou a cópia da prévia). Tente de novo em instantes.'
        : c === 'tempo' || c === 'demorou' || (e && e.name === 'AbortError') ? 'O Drive demorou demais. Toque de novo: continua de onde parou.'
        : c === 'sem_rede' || !c ? 'Sem conexão com o Drive.' : 'Não foi possível mexer nas pastas do Drive (' + c + ').';
    }
    function pastasDrive() {
      var l = login(), url = o.driveUrl ? o.driveUrl() : null, amb = o.ambiente || 'oficial';
      if (!l || !url || ocupado || !o.drive || !o.drive.post) return;
      var mp = mapaPastas(contratos(), nomesCt);
      var avisos = mp.avisos.map(function (t) { return '<p class="gl-mv-nota">' + esc(t) + '</p>'; }).join('');
      if (!mp.mapa.length) { o.toast('Nenhuma pasta para renomear. ' + (mp.avisos.join(' ') || 'As pastas já estão pelo nº do contrato.'), 9000); return; }
      // o app não pede "juntar": quando a pasta nova já existe, as duas ficam como estão ("duas_pastas") e nenhuma foto muda de lugar
      var mexeu = function (x) { return x.acao === 'renomear' || x.acao === 'juntar'; };
      var ficam = function (x) { return x.acao === 'outro_contrato' || x.acao === 'duas_pastas'; };
      var fotos = function (ls) { return ls.reduce(function (s, x) { return s + (x.fotos || 0); }, 0); };
      cancelar = false;
      rodarPastas(url, l, amb, mp.mapa, true).then(function (r) {
        ocupado = null; renderBar();
        var mexe = r.itens.filter(mexeu), fora = r.itens.filter(ficam);
        var ja = r.itens.filter(function (x) { return x.acao === 'ja_feito'; }).length;
        return o.confirmar({
          titulo: 'Pastas do Drive pelo nº do contrato', botao: mexe.length ? 'Renomear' : 'Confirmar',
          html: '<p>' + ondeRaiz(amb, r.raiz) + '</p>' +
            (mexe.length ? '<p><b>' + plural(mexe.length, 'pasta muda', 'pastas mudam') + '</b> (' + plural(fotos(mexe), 'foto', 'fotos') + '):</p>' + listaPastas(mexe)
              : '<p>Nenhuma pasta para renomear agora.</p>') +
            (fora.length ? '<p>Ficam como estão:</p>' + listaPastas(fora) : '') +
            (ja ? '<p class="gl-mv-nota">' + plural(ja, 'pasta já está', 'pastas já estão') + ' pelo nº do contrato.</p>' : '') + avisos +
            '<p class="gl-mv-nota">Renomear não tira nenhuma foto do lugar. Depois, o script guarda na pasta nova de cada pessoa as fotos que ainda ' +
            'chegarem com o nome antigo (celulares com o app antigo). As pastas soltas na raiz, do app antigo, ficam com o nome de hoje.</p>'
        }).then(function (ok) {
          if (!ok) return;
          cancelar = false;
          return rodarPastas(url, l, amb, mp.mapa, false).then(function (r2) {
            ocupado = null; renderBar();
            var feitas = r2.itens.filter(mexeu), ren = feitas.filter(function (x) { return x.acao === 'renomear'; }).length, jun = feitas.length - ren;
            var fora2 = r2.itens.filter(ficam);
            o.confirmar({
              titulo: 'Pastas do Drive', botao: 'OK', cancelar: 'Fechar',
              html: '<p>' + ondeRaiz(amb, r2.raiz) + '</p>' +
                (feitas.length ? '<p>' + [ren ? plural(ren, 'pasta renomeada', 'pastas renomeadas') : '', jun ? plural(jun, 'pasta juntada', 'pastas juntadas') + ' na nova' : '']
                  .filter(Boolean).join(' e ') + ' (' + plural(fotos(feitas), 'foto', 'fotos') + ').</p>' + listaPastas(feitas) : '<p>Nenhuma pasta precisou mudar.</p>') +
                (fora2.length ? '<p>Ficaram como estavam:</p>' + listaPastas(fora2) : '') +
                '<p class="gl-mv-nota">O script guardou a troca de nomes desta pasta raiz: as fotos que ainda chegarem com o nome antigo vão para a pasta nova de cada pessoa.</p>'
            });
          });
        });
      }).catch(function (e) {
        ocupado = null; renderBar();
        o.toast(msgPastas(e), 8000);
      });
    }
    // ---------------------------------------------------------------- galeria e pasta Deletados (Administrador, script versão 6)
    // lista as fotos "ativas" na galeria com o arquivo em Deletados e as apagadas com o arquivo fora dela (só lê; nada muda)
    function conferirDrive() {
      var l = login(), url = o.driveUrl ? o.driveUrl() : null, amb = o.ambiente || 'oficial';
      if (!l || !url || ocupado || !o.drive || !o.drive.post) return;
      cancelar = false;
      ocupado = 'Conferindo a galeria com a pasta Deletados do Drive…'; renderBar();
      postDrive(url, { acao: 'conferir_deletados', ambiente: amb, codigo: l.codigo }).then(function (r) {
        ocupado = null; renderBar();
        if (cancelar) return;
        if (!r || !r.ok) throw { code: (r && r.erro) || 'erro' };
        var a = r.ativasEmDeletados || [], d = r.deletadasFora || [];
        function linha(x) { return '<li>' + esc([x.ponto ? 'Ponto ' + x.ponto : 'Sem ponto', x.autor, x.nome].filter(Boolean).join(' · ')) + '</li>'; }
        function lista2(ls, n) { return '<ul class="gl-pastas">' + ls.map(linha).join('') + (n > ls.length ? '<li>e mais ' + (n - ls.length) + '…</li>' : '') + '</ul>'; }
        o.confirmar({
          titulo: 'Galeria e Drive', botao: 'OK', cancelar: 'Fechar',
          html: '<p>' + ondeRaiz(amb, r.raiz) + '</p>' +
            (!a.length && !d.length ? '<p>Tudo certo: a galeria e a pasta Deletados dizem a mesma coisa.</p>' : '') +
            (a.length ? '<p><b>' + plural(r.nAtivasEmDeletados || a.length, 'foto ativa', 'fotos ativas') + '</b> na galeria com o arquivo em Deletados:</p>' + lista2(a, r.nAtivasEmDeletados || a.length) : '') +
            (d.length ? '<p><b>' + plural(r.nDeletadasFora || d.length, 'foto apagada', 'fotos apagadas') + '</b> na galeria com o arquivo fora de Deletados:</p>' + lista2(d, r.nDeletadasFora || d.length) : '') +
            (r.semArquivo ? '<p class="gl-mv-nota">' + plural(r.semArquivo, 'foto da galeria não tem', 'fotos da galeria não têm') + ' o arquivo na pasta do Drive deste ambiente.</p>' : '') +
            '<p class="gl-mv-nota">Conferidas ' + plural(r.ativas || 0, 'foto ativa', 'fotos ativas') + ' e ' + plural(r.deletadas || 0, 'apagada', 'apagadas') + '. Nada foi mudado.' +
            (a.length || d.length ? ' Para acertar: apague de novo (a ativa) ou restaure (a apagada); o script versão 6 só marca o banco quando o arquivo já está no lugar.' : '') + '</p>'
        });
      }).catch(function (e) {
        ocupado = null; renderBar();
        var c = e && (e.code || e.erro);
        o.toast(c === 'so_criador' ? 'Só o Administrador confere o Drive.' : c === 'acao_invalida' ? 'O script do Drive ainda é a versão antiga: reimplante o Codigo.gs (versão 6).'
          : c === PASTA_FORA ? 'A pasta principal do Drive está indisponível.' : c === 'codigo_invalido' ? 'Seu acesso expirou ou mudou. Entre de novo.'
          : (e && e.name === 'AbortError') ? 'O Drive demorou demais. Tente de novo.'
          : c === 'sem_rede' || !c ? 'Sem conexão com o Drive.' : 'Não foi possível conferir o Drive (' + c + ').', 7000);
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
      else if (k === 'mover') abrirMover(ls.filter(podeMover));
    }

    function onClick(e) {
      if (pf && e.target.classList && e.target.classList.contains('gl-pf')) { pfFechar(); return; }   // toque no fundo escuro
      if (e.target.classList && e.target.classList.contains('gl-sh')) { if (bs) fecharBaixar(); else fecharCfg(); return; }
      var t = e.target.closest('[data-g],[data-aba],[data-ct],.gl-t');
      if (!t || !root.contains(t)) return;
      if (t.hasAttribute('data-ct')) {
        var v = t.getAttribute('data-ct');
        if (v === filtro.cid) return;
        filtro.cid = v; filtro.pid = '';
        render();
        return;
      }
      if (t.hasAttribute('data-aba')) {
        var a = t.getAttribute('data-aba');
        if (a === aba) return;
        aba = a; agrupar = ''; filtro.autor = ''; sel = {}; selecionando = false; itens = []; fLocal = ''; semRede = 0;
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
      if (g === 'per') { pfAbrir(); return; }
      if (g === 'per-chip') { var kc = t.getAttribute('data-k'); mudarPer(kc === 'semana0' ? { modo: 'semana', off: 0, de: '', ate: '' } : { modo: kc, off: 0, de: '', ate: '' }); return; }
      if (g === 'fl') { fLocal = t.getAttribute('data-v') || ''; sel = {}; render(); return; }
      if (g === 'dr-ir') { var pth = []; try { pth = JSON.parse(t.getAttribute('data-p') || '[]'); } catch (e2) { pth = []; } irPasta(Array.isArray(pth) ? pth : []); return; }
      if (g === 'dr-modo') { var mv0 = t.getAttribute('data-v') === 'pessoa' ? 'pessoa' : 'contrato'; if (mv0 !== dmodo) { dmodo = mv0; lsPor(DMODO_KEY, mv0); irPasta([]); } return; }
      if (g === 'dr-atualizar') { dlista = null; semMini = {}; carregar(); return; }
      if (g === 'dr-falta') { sel = {}; lista.forEach(function (x) { if (!noAparelho(x)) sel[x.id] = 1; }); render(); return; }
      if (g === 'env-pausa' || g === 'env-cont') { if (o.drive && o.drive.pausar) o.drive.pausar(g === 'env-pausa'); setTimeout(renderEnv, 50); return; }
      if (g === 'bx-pausa' && bx) { bx.pausa = true; avisaBaixa(); return; }
      if (g === 'bx-cont' && bx) { bx.pausa = false; baixaPasso(); return; }
      if (g === 'bx-parar' && bx) { if (bx.rodando) { bx.parar = true; avisaBaixa(); } else { bx.parar = true; baixaPasso(); } return; }
      if (g === 'bx-fechar') { fecharBaixar(); return; }
      if (g === 'bx-op' && bs) { bs.alvo = t.getAttribute('data-v'); renderBaixar(); return; }
      if (g === 'bx-ir') { iniciarBaixa(); return; }
      if (g === 'cfg') { abrirCfg(); return; }
      if (g === 'cfg-fechar') { fecharCfg(); return; }
      if (g === 'cfg-auto') { var on = lsLer(DRIVE_KEY) === '0'; lsPor(DRIVE_KEY, on ? '1' : '0'); renderCfg(); return; }
      if (g === 'cfg-wifi' && o.drive && o.drive.soWifi) { o.drive.soWifi(!o.drive.soWifi()); renderCfg(); setTimeout(renderEnv, 50); return; }
      if (g === 'cfg-cache') { apagarCache(); return; }
      if (t.closest('.gl-sh') && g !== 'limpar') return;
      if (e.target.classList && e.target.classList.contains('gl-sh')) { fecharBaixar(); fecharCfg(); return; }
      if (g === 'per-ant') { mudarPer({ modo: 'semana', off: (per.modo === 'semana' ? per.off || 0 : 0) - 1, de: '', ate: '' }); return; }
      if (g === 'per-prox') { if (per.modo === 'semana' && (per.off || 0) < 0) mudarPer({ modo: 'semana', off: (per.off || 0) + 1, de: '', ate: '' }); return; }
      if (g === 'per-tudo') { pfFechar(); mudarPer({ modo: 'tudo', off: 0, de: '', ate: '' }); return; }
      if (g === 'pf-fechar') { pfFechar(); return; }
      if (g === 'pf-op' && pf) { pf.r = t.getAttribute('data-k'); renderPf(); var b2 = q('.gl-pf-op[data-k="' + pf.r + '"]'); if (b2) b2.focus(); return; }
      if (g === 'pf-ult' && pf) { var nd = +t.getAttribute('data-n'); pf.r = 'datas'; pf.ate = hojeIso(); pf.de = maisDias(pf.ate, -(nd - 1)); renderPf(); return; }
      if (g === 'pf-aplicar') { var np = pfPer(); pfFechar(); mudarPer(np); return; }
      if (t.closest('.gl-pf')) return;
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
      else if (g === 'enviar') { if (o.drive) o.drive.pump(true); setTimeout(render, 300); }   // a pessoa pediu: não espera as pausas da fila
      else if (g === 'enviar-ap') enviarDrive(Object.keys(locais).map(function (k) { return locais[k]; }).filter(function (x) { return x.situacao === 'aparelho'; }), true);
      else if (g === 'limpar') {
        var env = Object.keys(locais).map(function (k) { return locais[k]; }).filter(function (x) { return x.situacao === 'enviada'; });
        fecharCfg();
        apagarLocal(env);
      }
      else if (g === 'cancelar') { cancelar = true; ocupado = 'Parando…'; renderBar(); }
      else if (g === 'fechar-ver') fecharVer();
      else if (g === 'ant' && ver > 0) abrir(ver - 1);
      else if (g === 'prox' && ver < lista.length - 1) abrir(ver + 1);
      else if (g === 'grande') carregarGrande();
      else if (g === 'ver-sem') { filtro.pid = SEM; render(); }
      else if (g === 'km-tirar') { filtro.km = null; render(); }
      else if (g === 'drive-trazer') trazerDoDrive();
      else if (g === 'drive-pastas') pastasDrive();
      else if (g === 'drive-conferir') conferirDrive();
      else if (g === 'mv-fechar') fecharMover();
      else if (g === 'mv-usar') { var sp = q('#glMvP'); if (sp && mv && mv.sug) { sp.value = mv.sug.id; sugestao(); } }
      else if (g === 'mv-salvar') salvarMover();
      else if (g === 'mv-ct') { var sc = q('#glMvC'); if (sc) { sc.value = t.getAttribute('data-id'); pontosMover(); } }
      else fazer(g, t.hasAttribute('data-um') ? [lista[ver]] : selecionadas());
    }
    function onChange(e) {
      if (e.target.id === 'glPfDe' || e.target.id === 'glPfAte') {
        if (pf && validoIso(e.target.value)) { pf.r = 'datas'; pf[e.target.id === 'glPfDe' ? 'de' : 'ate'] = e.target.value; renderPf(); }
        return;
      }
      if (e.target.id === 'glMvC') { pontosMover(); return; }
      if (e.target.id === 'glBxWifi' && bs) { bs.wifi = e.target.checked; return; }
      if (e.target.id === 'glCfManter') { lsPor(MANTER_KEY, e.target.value || null); limparEnviadas(o.drive).then(function (k) { if (k) { o.toast(plural(k, 'foto enviada saiu', 'fotos enviadas saíram') + ' deste aparelho (continuam no Drive).'); carregar(); } renderCfg(); }); return; }
      if (e.target.id === 'glMvP') { sugestao(); return; }
      var f = e.target.getAttribute('data-f');
      if (!f || f === 'dbusca') return;
      if (f === 'agrupar') agrupar = e.target.value;
      else { filtro[f] = e.target.value; if (f === 'cid') filtro.pid = ''; }
      render();
    }
    function onInput(e) {
      if (!e.target.getAttribute || e.target.getAttribute('data-f') !== 'dbusca') return;
      dbusca = e.target.value; sel = {};
      render();
    }
    function onKey(e) {
      if (!root || document.querySelector('.modal')) return;
      if (mv && (e.key !== 'Escape' || mv.salvando)) return;   // no painel de contrato e ponto as setas são das listas (e salvando, nada)
      if (pf) { if (e.key === 'Escape') pfFechar(); return; }
      if (bs || cfg) { if (e.key === 'Escape') { fecharBaixar(); fecharCfg(); } return; }
      if (e.key === 'Escape') { if (mv) fecharMover(); else if (ver >= 0) fecharVer(); else if (selecionando) { selecionando = false; sel = {}; render(); } else close(); }
      else if (ver >= 0 && e.key === 'ArrowLeft' && ver > 0) abrir(ver - 1);
      else if (ver >= 0 && e.key === 'ArrowRight' && ver < lista.length - 1) abrir(ver + 1);
    }

    var aoFechar = null;
    function open(f) {
      f = f || {};
      if (!document.getElementById('glCss')) { var st = document.createElement('style'); st.id = 'glCss'; st.textContent = CSS; document.head.appendChild(st); }
      if (!root) {
        root = document.createElement('div');
        root.className = 'gl';
        root.setAttribute('aria-label', 'Fotos');
        root.innerHTML = '<div class="gl-top"><button type="button" class="btn small" data-g="fechar">← Voltar</button><h2>Fotos</h2></div>' +
          '<div class="gl-tabs" role="tablist"></div><div class="gl-env"></div><div class="gl-cts" role="group" aria-label="Contrato"></div><div class="gl-fil"></div><div class="gl-info"></div><div class="gl-body"></div><div class="gl-barhost"></div>';
        root.addEventListener('click', onClick);
        root.addEventListener('change', onChange);
        root.addEventListener('input', onInput);
        document.addEventListener('keydown', onKey);
        document.body.appendChild(root);
      }
      // página do celular: uma região da tela (o app continua em volta); janela: cobre tudo e trava a rolagem de trás
      var pagina = !!f.pagina;
      aoFechar = pagina && f.aoFechar ? f.aoFechar : null;
      root.classList.toggle('gl-pag', pagina);
      root.setAttribute('role', pagina ? 'region' : 'dialog');
      if (pagina) root.removeAttribute('aria-modal'); else root.setAttribute('aria-modal', 'true');
      document.body.style.overflow = pagina ? '' : 'hidden';
      filtro = { cid: f.cid || '', pid: f.pid || '', autor: '', mes: '' };
      // "Fotos do segmento" (Medições, conservação): as fotos do contrato no km do segmento
      filtro.km = f.km && isFinite(f.km[0]) && isFinite(f.km[1]) ? [Math.min(f.km[0], f.km[1]), Math.max(f.km[0], f.km[1]), String(f.kmNome || '')] : null;
      // "Fotos deste ponto": todas as datas do ponto (sem trocar a escolha guardada); senão, o período guardado neste aparelho
      per = f.pid || filtro.km ? { modo: 'tudo', off: 0, de: '', ate: '' } : lerPer();
      pf = null;
      cidAuto = !f.cid;
      fecharMover();
      var vis = abasVisiveis().map(function (a) { return a.k; });
      aba = f.aba && vis.indexOf(f.aba) >= 0 ? f.aba : (f.pid || filtro.km ? (vis.indexOf('todas') >= 0 ? 'todas' : vis.indexOf('minhas') >= 0 ? 'minhas' : 'local') : (vis.indexOf(aba) >= 0 ? aba : 'local'));
      sel = {}; selecionando = false; ver = -1; itens = []; fLocal = ''; semRede = 0; bs = null; cfg = false;
      cacheIds().then(function (m) { guardadas = m; });
      limparEnviadas(o.drive).then(function (k) { if (k && root && aba === 'local') carregar(); });
      carregar();
    }
    function close(semAviso) {
      if (!root) return;
      cancelar = true;
      if (obs) obs.disconnect();
      soltarGrande(); soltarUrls();
      document.removeEventListener('keydown', onKey);
      root.remove(); root = null; ver = -1;
      document.body.style.overflow = '';
      var cb = aoFechar;
      aoFechar = null;
      if (cb && semAviso !== true) cb();
    }
    var mudouT = null;
    // a fila do aparelho mudou: No aparelho recarrega; nas outras abas, só a barra de envio (os dados do aparelho de novo)
    function changed() {
      if (!root || ocupado) return;
      clearTimeout(mudouT);
      mudouT = setTimeout(function () {
        if (!root) return;
        if (aba === 'local' && ver < 0 && !selecionando && !bs && !cfg) { carregar(); return; }
        (o.drive ? o.drive.list().catch(function () { return null; }) : Promise.resolve(null)).then(function (loc) {
          if (!root || !loc) return;
          loc.forEach(function (r) { var m = locais[r.id]; if (m) { m.situacao = r.situacao; m.erro = r.erro; m.enviada = r.enviada; m.etapa = r.etapa; } });
          renderEnv();
          if (aba === 'local') { var i = q('.gl-info'); if (i) i.innerHTML = infoHtml(); }
        });
      }, 400);
    }
    return { open: open, close: close, changed: changed, isOpen: function () { return !!root; }, baixando: function () { return bx ? bx.ls.length - bx.i : 0; } };
  };
  // as contas sem tela, para o teste em ferramentas/teste-galeria.js (node, sem banco)
  window.Galeria.limparEnviadas = limparEnviadas;
  window.Galeria.puras = { linkDrive: linkDrive, ctsDoKm: ctsDoKm, porKm: porKm, partes: partes, resumoMover: resumoMover, FOLGA_KM: FOLGA_KM, POR_MOVER: POR_MOVER };
})();
