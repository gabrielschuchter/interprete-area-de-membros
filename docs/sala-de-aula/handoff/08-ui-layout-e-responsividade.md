# 08 · UI: layout, medidas e responsividade

Fonte visual: `reference/A2_Oculto.dc.html` (estado inicial), `A2_Aulas`, `A2_Notas`, `A2_Cronometro`, `A2_Recolhida`. Abra os arquivos e leia o HTML/CSS inline para as medidas exatas. **Siga o que está aqui e nas telas; não improvise.** Tokens em `contracts/tokens.css`.

## 1. Estrutura da página (desktop)

```
<div class="room">                                   display:flex; min-height:100dvh
  <nav aria-label="Navegação principal">…</nav>      BARRA LATERAL GLOBAL EXISTENTE (248 px / 72 px recolhida)
  <div class="room__col">                            flex:1; min-width:0; flex-direction:column
    <header>…</header>                               CABEÇALHO GLOBAL EXISTENTE (56 px)
    <div class="room__row">                          flex:1; display:flex; min-width:0
      <main class="room__main">…</main>              flex:1; min-width:0
      <aside class="room__panel" hidden?>…</aside>   372 px, só quando aberto
      <nav class="room__dock">…</nav>                68 px, SEMPRE visível
    </div>
  </div>
</div>
```
- Sidebar e cabeçalho são **componentes existentes**. Não os duplique.
- Dentro de `main`, a sala **não** mostra as abas de Estudar.

## 2. Conteúdo principal (`main`)

| Elemento | Especificação |
|---|---|
| Container | `padding: 6px 40px 80px`; bloco interno centralizado com `max-width: 1100px` (painel fechado) ou `760px` (painel aberto); `gap: 22px` |
| Link voltar | altura mín. 44; Inter 500 14px; cor `--muted`; ícone seta-esquerda 16px; texto = nome do curso ou “Minhas gravações” |
| Título (h1) | Source Serif 4, 600, 40px/1.1, `letter-spacing:-.02em` |
| Subtítulo | Source Serif 4 **itálico** 400, 18px/1.5, `--muted`; margem-topo 10px |
| Divisor | faixa de meandro, altura 12px, cor `--vine` a 32% de opacidade, largura total (`assets/meander.svg` em padrão repetido) |
| Player | proporção 16:9, raio 8px, sobreposto a nada |
| Bloco de leitura | margem-topo 14px após o player; `max-width: 700px`; seções com `gap: 32px` |
| “Sobre a aula” | h2 Source Serif 4 600 24px/1.25; parágrafo Source Serif 4 400 19px/1.75; parágrafos separados por 12px. **Seção inexistente se a descrição for vazia.** |
| “Materiais” | h2 Source Serif 4 600 **17px**/1.25; lista abaixo (item 3). **Seção inexistente se não houver itens.** |

Explicitamente **ausentes** (LD-05): legenda sob o player; “Terminou a aula?”; setas de anterior/próxima; blocos de anterior/próxima no rodapé; qualquer botão “Concluir aula”.

### Lista “Materiais” (mínima)
- Linha: altura mín. 44; `border-top: 1px solid --line`; a última linha tem `border-bottom`.
- Conteúdo: ícone 16px (`--muted`) · título (Inter 500 14.5px, uma linha, reticências) · tipo à direita (Inter 400 12.5px, `--muted`).
- Ícones por tipo: livro (Biblioteca), lista (Lista), caixa de entrada (Atividade), seta-saindo (Link), arquivo (Arquivo).
- Tipos exibidos: `Biblioteca`, `Lista`, `Atividade`, `Link`, `Arquivo`.
- Link externo: `target="_blank" rel="noopener noreferrer"`; `aria-label="{título}, link externo, abre em nova aba"`.
- Itens internos navegam dentro do produto.

## 3. Player (visual)

### Pôster (fachada)
- Fundo: `linear-gradient(135deg, #2A0121, #7A1230)`.
- Faixa de meandro no topo: 12px, ouro `#E9C48E` a 26% de opacidade.
- Templo em linha (`assets/temple.svg`): canto inferior direito, 62% da largura × 82% da altura, traço ouro a 30%.
- Botão Play: círculo 72px, `rgba(241,235,232,.16)`, `backdrop-filter: blur(12px)`, borda `rgba(241,235,232,.34)`, ícone 29px preenchido; centralizado.
- Chip de duração: canto inferior esquerdo (16px), altura 26, raio 6, fundo `rgba(21,10,18,.5)`, IBM Plex Mono 500 12px, cor `#F1EBE8`.

### Cartão de vidro (retomar, indisponível, sem vídeo, bloqueada, timeout, offline)
- `background: rgba(241,235,232,.14); backdrop-filter: blur(14px); border: 1px solid rgba(241,235,232,.26); border-radius: 12px; color: #F1EBE8`.
- Camada de esmaecimento sobre o pôster: `rgba(21,10,18,.38)` (todos exceto retomar e idle).
- **Retomar**: cartão no canto inferior esquerdo (16px, 22px do fundo), padding 16/18: linha “Você parou em” (Inter 13px, 86% de opacidade) + tempo (IBM Plex Mono 500 20px); botões “Retomar” (primário claro) e “Do início” (secundário vidro), altura 40. Fio de 3px na base: trilho `rgba(241,235,232,.25)`, preenchimento ouro com o %.
- **Estados de erro/bloqueio**: cartão centralizado, `max-width: 440px`, padding 24/30, ícone ouro 30px, título Source Serif 4 600 21px/1.25, texto Inter 14px/1.55 (90%), botões altura 42.
- **Carregando**: sem pôster; fundo `linear-gradient(135deg,#E9DFDA,#DDD0CA)`, spinner 34px (trilho `--line`, arco `--vine`), texto Inter 500 14px `--muted`.
- Primário claro sobre vidro: fundo `#F1EBE8`, texto `--ink`, raio 6, altura 40–44, Inter 600 13.5–14px.

## 4. Dock (`room__dock`)

- `width: 68px; border-left: 1px solid --line; background: --bg; padding: 12px 0; display:flex; flex-direction:column; gap:6px`.
- Três botões: **Aulas** (ou **Gravações** no contexto de gravação), **Notas**, **Tempo**.
- Botão: `width:56px; min-height:60px; margin:0 auto; border-radius:8px; border:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:5px`; ícone 20px; rótulo Inter 10.5px (500; 600 quando ativo).
- Inativo: fundo transparente, cor `--muted`. **Ativo** (`aria-pressed="true"`): fundo `--tint`, cor `--vine`.
- Ícones: lista (Aulas/Gravações), nota (Notas), cronômetro (Tempo).
- Quando o **Tempo está rodando**: sob o rótulo, o tempo restante/decorrido em IBM Plex Mono 500 10px, `--muted` (atualiza a cada segundo).
- Notas: sem contador no dock.
- Atributos: `aria-label` com o nome da ferramenta; `aria-controls="room-panel"`; `aria-expanded` conforme o painel.

## 5. Painel (`room__panel`)

- `width: 372px; border-left: 1px solid --line; background:#fff; padding: 14px 14px 28px; display:flex; flex-direction:column; gap:14px`.
- Desktop ≥1280: `position: sticky; top: 56px; height: calc(100dvh - 56px); overflow-y:auto`.
- Cabeçalho: h2 Source Serif 4 600 21px/1.25 + botão fechar (44×44, ícone X 19px). Em Notas, à esquerda do X, o link “Abrir em Notas” (Inter 500 13px, `--vine`).
- Conteúdo por ferramenta: `09`.
- `role="region"`, `id="room-panel"`, `aria-label="Painel da aula: {Aulas|Gravações|Notas|Tempo}"`.
- Abrir/fechar: translação horizontal 200ms `ease-out` + opacidade; o conteúdo principal ajusta a largura **sem animar o reflow** (apenas aplica `max-width`). `prefers-reduced-motion`: sem transição.

## 6. Barra lateral global (reutilizar; implementar só se não existir)

- Expandida: 248px. Linha do logo: “Interprete.” (Source Serif 4 600 24px) à esquerda e, na mesma linha à direita, o botão recolher (36×36, ícone “painel lateral” 20px, cor creme, raio 6; hover `rgba(241,235,232,.16)`).
- Recolhida: 72px, ícones centralizados (44×44) com `aria-label` e `title`; o espaço do logo mostra “I.” (serifa 24px).
- Troca com fade (0,18s): na barra **recolhida**, ao passar o mouse ou focar (`:hover`/`:focus-within`) no espaço do logo, o “I.” some (opacity 0) e o símbolo de expandir aparece (opacity 1), no mesmo lugar. Sem movimento reduzido: sem transição.
- Estado recolhido persiste como já faz o produto hoje. Não alterar o mecanismo.
- CSS de referência em `contracts/tokens.css` (`.sbswap`, `.sbtg`).

## 7. Estados de página inteira (404, 403, erro)

Layout dentro de `main`, centralizado verticalmente, `max-width: 520px`, alinhado ao centro:
- Ícone em círculo 52px (`--tint`, ícone `--vine`).
- Meandro de 72×10 acima do círculo (apenas 404 e 403).
- Título Source Serif 4 600 24px/1.25.
- Texto Inter 14.5px/1.6 `--muted`.
- Botões: primário/secundário de 44px conforme `10`.
O mesmo layout vale para “Curso sem aulas publicadas” (na página do curso).

## 8. Breakpoints

| Faixa | Barra lateral | Dock | Painel | Conteúdo |
|---|---|---|---|---|
| **≥ 1280 px** | fixa (248/72) | 68px à direita | **acoplado**: empurra o conteúdo (`max-width` 760); sticky | Como a seção 2 |
| **1024–1279 px** | fixa | 68px | **sobreposto**: `position:fixed; top:56px; right:68px; bottom:0; width:372px`; sombra `-10px 0 28px rgba(64,34,47,.14)`; sem fundo escurecido | Conteúdo sem reduzir (`max-width` 1100) |
| **768–1023 px** | vira gaveta (ícone de menu no cabeçalho; já existe) | 68px | sobreposto com **fundo escurecido** `rgba(64,34,47,.38)`; fecha ao tocar fora ou com Esc | Margens laterais de 24px |
| **≤ 767 px** | gaveta | **vira barra inferior** | **folha de tela cheia** | Outra composição (seção 9) |

Regras:
- Em 1024–1279, ao abrir o painel, mover o foco para o primeiro elemento focável do painel; ao fechar, devolver ao botão do dock.
- Largura do `main` nunca provoca rolagem horizontal. Em 1024 px com painel acoplado, o conteúdo nunca fica abaixo de 560px de largura (por isso o painel sobrepõe abaixo de 1280).

## 9. Mobile (≤ 767 px): **não foi desenhado**; implemente por esta especificação

Mobile é composição própria, **sem abas horizontais** e sem seletor segmentado (LD-12).

### 9.1 Tela principal

```
┌────────────────────────────────┐
│ ‹   Aula              ▢  ⌕  🔔 │  cabeçalho 56px (voltar, título curto, 3 ícones existentes)
├────────────────────────────────┤
│ ████████ PLAYER 16:9 ████████ │  sticky: top 56px, z-index 4, largura total, raio 0
├────────────────────────────────┤
│ Formulando a pergunta (PICO)   │  h1 Source Serif 4 600 26px/1.15
│ Mentoria em PBE — Módulo 2     │  subtítulo itálico serifa 15px, muted
│ ▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭   │  meandro 12px
│ Sobre a aula                   │  h2 serifa 20px
│ Nesta aula, transformamos…     │  serifa 17px/1.65, 3 linhas + “Ler mais”
│ Materiais                      │  h2 serifa 17px
│ ▤ Asking focused…  Biblioteca  │  linhas de 48px
│ ▤ Lista: PBE | 10…   Lista     │
├────────────────────────────────┤
│  ☰ Aulas   ✎ Notas   ⏱ Tempo   │  barra inferior fixa (a “gêmea” do dock)
└────────────────────────────────┘
```
- Padding horizontal 16px; conteúdo rola **abaixo** do player fixo.
- Barra inferior: altura 64px + `env(safe-area-inset-bottom)`; fundo `rgba(241,235,232,.9)` com `backdrop-filter: blur(14px)`; borda superior `--line`; três botões iguais (ícone 20px + rótulo 11px), alvo mínimo 44px. **Não é aba**: cada botão **abre uma folha** e não guarda estado selecionado. No contexto de gravações, “Aulas” vira “Gravações”.
- Padding inferior do conteúdo: `96px` para não ficar atrás da barra.
- “Ler mais” expande a descrição no próprio lugar (sem navegar).
- Estados de player em mobile: mesmos cartões, em escala menor: título serifa 17px, texto 12.5px, botões 36px.

### 9.2 Folhas (Aulas, Notas, Tempo)
- Tela cheia (`inset:0`, `100dvh`), entra por baixo (`translateY`, 220ms ease-out), cabeçalho 56px com botão voltar “‹” (44px) e título; conteúdo rola.
- **Aulas**: mesmo conteúdo do painel (módulos recolhíveis, linhas com caixa, miniatura 88×50). Escolher uma aula navega e fecha a folha.
- **Notas**: composer no topo (botão “Nova nota” abre o editor focado), lista abaixo. O editor usa `visualViewport` para ficar visível acima do teclado.
- **Tempo**: **sem seletor segmentado**: três linhas de rádio empilhadas (Cronômetro, Pomodoro, Regressivo), depois o cartão do cronômetro e os botões (`09`).
- Voltar do sistema (gesto/botão) fecha a folha antes de sair da sala. Implementar com estado de histórico (`pushState`) apenas se o repositório já usa esse padrão para folhas; senão, só o botão voltar.

### 9.3 Paisagem de celular (altura ≤ 500px)
- Esconder cabeçalho e barra inferior; player com `height: 100dvh` à esquerda; o restante abaixo, rolando. Tela cheia do YouTube é nativa.

## 10. Tablet

- 768–1023 retrato/paisagem: dock à direita, painel sobreposto com fundo escurecido, margens 24px; barra lateral em gaveta.
- 1024–1279 paisagem: barra lateral fixa; painel sobreposto sem escurecimento.
- Alvos de toque ≥ 44px sempre.

## 11. Movimento

| Elemento | Duração | Curva | Propriedades |
|---|---|---|---|
| Painel abrir/fechar | 200ms | ease-out | `transform`, `opacity` |
| Folhas mobile | 220ms | ease-out | `transform` |
| Troca “I.” ↔ símbolo | 180ms | ease | `opacity` |
| Hover de botões | 150ms | ease | `background-color` |
| Spinner | contínuo | linear | rotação (única animação contínua; some com `prefers-reduced-motion`, trocando por texto estático) |

## 12. Fora de escopo visual

- Tema escuro da sala (o **Modo foco** existente continua sendo uma funcionalidade à parte, aberta pelo painel Tempo).
- Editor de aulas, Gestão, Comunidade.
