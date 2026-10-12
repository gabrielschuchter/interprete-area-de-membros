# 04 · Estados, transições, interações e responsividade

Quadros de referência: `GTransicao`, `GTransicaoMobile`, `GTransicaoEstados`, `GChegada`, `GEntrada`, `GInteracoes`, `GInterrupcoes`, `GEstados`, `GRail`, `GBreakpoints`, `GCobertura`.

## 1. Como se chega à Gestão (e como se volta)

### 1.1 Entradas
1. **Menu lateral › Gestão** (área de membros). O item substitui "Professor", no fim da lista, com o ícone de capelo. Só aparece para `TEACHER` e `ADMIN` e com a flag `gestao_v2`.
2. **Portal › Menu › Gestão:** o mesmo item, na gaveta do Início em tela cheia.
3. **Notificação com link direto**, ex.: "2 entregas aguardando correção" → `/gestao/alunos/correcoes`.
4. **"Editar na Gestão"** na página que o aluno também vê (aula, curso), barra violeta no topo, só com permissão no curso.
5. **Link direto `/gestao/...`:** sem login → entrar e voltar ao destino; sem permissão → `GRestrito`.

### 1.2 Saídas
- **Voltar à área de membros** (rodapé da barra): volta à **página de origem** (guardar `returnTo` na sessão da Gestão; padrão: Estudar).
- **Ver como aluno:** abre a página equivalente do aluno com a barra de prévia; **Sair da prévia** volta ao ponto exato da Gestão.

### 1.3 Primeiro acesso
Diálogo de boas-vindas (uma vez por usuário) com três dicas: Criar, Buscar, Ver como aluno. Guardar `gestaoWelcomeDismissedAt`.

## 2. A transição Área de membros → Gestão

**Objetivo:** deixar claro que o professor entrou em **outro ambiente**, sem piscar nem perder contexto.

| Fase | Tempo | O que acontece | Propriedade animada |
|---|---|---|---|
| 0 | 0 ms | Clique/toque no item "Gestão". Item recebe estado pressionado. | — |
| 1 | 0–240 ms | A barra lateral muda de Dark Amaranth (`#8C1535`) para Crimson Violet (`#410230`) | opacidade de uma camada sobreposta (não animar `background-color`) |
| 2 | 80–240 ms | Itens da barra trocam: saem os de membro, entram os da Gestão, em *fade* de 160 ms, com 30 ms de atraso entre eles (de cima para baixo) | `opacity` |
| 3 | 160–400 ms | O conteúdo atual escurece e funde com a Visão geral, com 8 px de deslocamento | `opacity`, `transform: translateY` |
| 4 | 400 ms | URL = `/gestao`; foco no título da página; leitor de tela anuncia "Você está na Gestão" | — |

- Curva: `cubic-bezier(.45, 0, .2, 1)`. **Só `opacity` e `transform`.** Nunca animar `width`, `height`, `top`, `left` ou `background`.
- **Volta:** inverso, 300 ms; anuncia "Você voltou à área de membros".
- **Movimento reduzido** (`prefers-reduced-motion: reduce`): fusão de 120 ms, sem deslocamento, sem atraso entre itens.
- **Implementação sugerida:** dois *layouts* de raiz (`(membros)` e `(gestao)`). Use a **View Transitions API** (`document.startViewTransition`) com `view-transition-name: app-sidebar` e `main-content`; **fallback** (navegador sem suporte): animação CSS de entrada no *layout* novo. Pré-carregar (`prefetch`) a rota `/gestao` ao passar o mouse/focar o item.
- **Celular:** a gaveta fecha (200 ms), o conteúdo funde e aparece um aviso breve (4 s) "Você entrou na Gestão · Voltar à área de membros".
- Teste de aceite: sem salto de layout (CLS = 0 na transição), 60 fps em notebook comum, funciona por teclado.

## 3. Máquina de estados de entrada, saída e falha (`GTransicaoEstados`)

Estados: **Área de membros**, **Entrando** (esqueleto + "Verificando seu acesso…"), **Gestão**, **Prévia como aluno**, **Acesso restrito**, **Sessão expirada**, **Sem conexão**.

| De → Para | Gatilho | Resposta | Duração |
|---|---|---|---|
| Área → Entrando | toca em Gestão / abre `/gestao` | esqueleto do shell já visível (nunca tela em branco) | imediato |
| Entrando → Gestão | acesso confirmado | esqueleto funde para o conteúdo | 200 ms |
| Entrando → Restrito | servidor nega | funde para `GRestrito`, **sem dados** | 200 ms |
| Gestão → Área | "Voltar…" | inverso | 300 ms |
| Gestão → Prévia | "Ver como aluno" | barra de contexto desce | 240 ms |
| Prévia → Gestão | "Sair da prévia" | barra sobe | 200 ms |
| Gestão → Sessão expirada | resposta 401 | diálogo sobe **sem limpar formulários**; entradas ficam guardadas no aparelho | 200 ms |
| Gestão → Restrito | resposta 403 numa ação (papel mudou) | faixa explica e a tela recarrega como restrita | 200 ms |
| Gestão → Sem conexão | rede cai | faixa fixa; edições ficam no aparelho (IndexedDB) e sobem depois | 200 ms |

## 4. Interrupções (`GInterrupcoes`)

| Situação | Comportamento obrigatório |
|---|---|
| **Sair com alterações não salvas** | Interceptar links, voltar do navegador e `beforeunload`; diálogo "Sair sem salvar?" com **Continuar editando** (padrão, foco aqui) e Sair. Implementar `UnsavedChangesGuard` (o App Router não oferece pronto). |
| **Sessão expirada** | Diálogo "Entre de novo"; após entrar, voltar à mesma URL e **restaurar o que foi digitado**. |
| **Conflito de edição** (alguém salvou antes) | Diálogo com **Ver diferenças**, **Manter a minha versão**, **Usar a dele**. Baseia-se em `version`. |
| **Papel alterado durante o uso** | Faixa "Você não tem mais acesso a esta área", recarrega restrito. |
| **Sem conexão** | Faixa fixa; fila local de escritas; ao voltar, sobe em ordem; mostra falhas. |
| **Entrando (verificando acesso)** | Esqueleto do shell; nunca mostrar dados antes da autorização. |

## 5. Respostas às interações (`GInteracoes`)

| Interação | Resposta imediata | Sucesso | Erro | Duração |
|---|---|---|---|---|
| Salvar formulário | Botão carrega; campos bloqueiam | Toast "Salvo agora" (4 s) + selo no cabeçalho | Mensagem no campo; foco no primeiro erro; dados preservados | 160 ms |
| Publicar | Diálogo com checklist; botão carrega | Estado "Publicado"; link de prévia | Diálogo explica o que falta, sem fechar | 200 ms |
| Excluir/arquivar | Diálogo de consequências | Toast com **Desfazer** (8 s) | Mensagem; item permanece | 200 ms |
| Arrastar para ordenar | Item sobe com sombra; destino tracejado | Ordem salva na hora; "Ordem salva" | Item volta; faixa de erro | 120 ms |
| Atribuir/enviar | Resumo com nº de destinatários | "Enviado a 19 alunos" + link para o histórico | Lista quem falhou; reenviar | 200 ms |
| Enviar feedback | Botão carrega; texto bloqueia | Entrega vira Corrigida; abre a próxima | Rascunho mantido | 200 ms |
| Trocar a turma no filtro | Lista esmaece (60%) com barra fina | Lista funde; URL ganha `?turma=` | Mantém a anterior e avisa | 160 ms |

**Estados de todo controle:** padrão, hover, foco (anel visível), pressionado, carregando, desabilitado (com motivo quando não óbvio). **Linhas de tabela:** padrão, hover, foco, selecionada, arrastando, carregando.

**Atalhos:** `Ctrl K` busca; `C` abre Criar (fora de campos de texto); `/` foca a busca da lista; `Esc` fecha camadas. Nunca atalho global de teclado que atrapalhe leitores de tela.

**Regras gerais de movimento:** só `opacity` e `transform`; nada anima por mais de 400 ms; sempre há versão reduzida; **toda resposta tem texto** (nunca só cor ou ícone).

## 6. Estados de página (`GEstados`)

Toda tela com dados implementa: **carregando** (esqueleto com o formato real da lista), **vazio** (explica e oferece criar), **sem resultados** (limpar filtros), **erro** (tentar de novo; dados salvos não se perdem), **sem permissão**, **recurso indisponível** (ex.: Gravações históricas desativado em Personalização).

## 7. Responsividade (`GBreakpoints`, `GRail`, `GCobertura`)

| Largura | Navegação | Layout |
|---|---|---|
| ≥ 1280 px | Barra lateral completa (264 px), área aberta expandida | Tabelas completas; editores com coluna lateral |
| 1024–1279 px | **Trilho** de 72 px só com ícones; passar o mouse/tocar abre o submenu em painel (`GRail`) | Tabelas escondem colunas secundárias |
| 768–1023 px | Sem barra; botão abre a **gaveta** | Editores em uma coluna; coluna lateral desce; modais viram painéis largos |
| < 768 px | Gaveta | Tabelas viram **cartões**; painéis e modais viram **folhas**; ação principal em **barra fixa** embaixo; **abas viram seletor**; barra fixa nunca cobre o último campo (espaço extra no fim) |

Regras específicas:
- **Calendário** no celular: mês compacto com pontos + lista do dia; seletor "Exibir".
- **Quadro de arrastar** (ordem de itens): no celular, **não arrasta**: botões "Mover para cima/baixo" e "Mover para…".
- **Correções** no celular: fila → detalhe → barra fixa "Enviar feedback / Rascunho".
- **Medalhas (museu)**: 4 colunas ≥ 1280; 3 colunas ≥ 768; 2 no celular; palco da medalha em coluna única.
- **Alvos de toque ≥ 44 px.** Sem rolagem horizontal de 320 a 1920 px (tabelas largas rolam dentro do próprio contêiner **somente** quando indispensável).

## 8. Acessibilidade (parte do "pronto")

- Contraste AA em texto e controles; foco visível; ordem de tabulação lógica; `aria-live` para toasts e anúncios de transição; `aria-current` na navegação; `aria-selected` nas abas; diálogos com armadilha de foco e retorno do foco ao gatilho; **arrastar com teclado** (setas + Enter) e anúncio da nova posição.
- Imagens decorativas com `aria-hidden`; símbolos de medalha com texto alternativo ("Medalha: {nome}, conquistada/bloqueada").
- Nenhuma informação apenas por cor (estado sempre tem texto).
- Testar com leitor de tela (NVDA/VoiceOver) nas transições, no diálogo de conflito e na correção.

## 9. Desempenho

- Listas paginadas no servidor; busca com *debounce* (250 ms); imagens com tamanhos corretos (variantes); *prefetch* só do que o usuário provavelmente abrirá.
- Orçamento: transição sem tarefa longa (> 50 ms); LCP da Visão geral < 2,5 s em rede comum; sem *layout shift*.
- Esqueletos têm a altura real dos itens para evitar saltos.
