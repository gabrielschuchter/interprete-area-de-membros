# Product Design System do Interprete.

Este documento traduz o Design System oficial para a área de membros. O manual e o Design System do Drive continuam sendo a autoridade de marca; aqui ficam apenas as decisões necessárias para construir produto digital sem reintroduzir defaults de starter.

## Foundations

Os tokens vivem em `packages/design-system/styles/globals.css` e são consumidos por classes semânticas do Tailwind.

| Papel | Token | Valor |
| --- | --- | --- |
| canvas/papel | `--background`, `--brand-pink-essence` | `#F1EBE8` |
| estrutura | `--brand-dark-amaranth`, `--primary` | `#8C1535` |
| profundidade local | `--brand-crimson-violet` | `#410230` |
| gesto/ação | `--brand-classic-crimson`, `--brand-action` | `#D62839` |
| accent raro | `--brand-debian-red`, `--brand-accent` | `#D60858` |
| texto principal | `--text-primary`, `--foreground` | `#40222F` |
| texto secundário | `--text-secondary`, `--muted-foreground` | `#7A5A69` |
| borda | `--border-subtle`, `--border` | `#E2D6D1` |
| papel elevado | `--surface`, `--card` | `#FFFFFF` |

Pink Essence é o canvas. Dark Amaranth organiza navegação e ação. Crimson Violet aparece em planos profundos locais. Classic Crimson marca progresso, seleção, underline e chamadas. Não usar HEX diretamente nas rotas.

## Tipografia

- `Source Serif 4` (`font-display`): títulos, perguntas, conteúdo editorial e momentos de autoridade.
- `Inter` (`font-sans`): corpo, navegação, controles e microcopy.
- `IBM Plex Mono` (`font-data`): eyebrow, metadata, referências e números.

Os pesos carregados são 400, 500 e 600; o token bold existe para integrações que o exigem, mas a interface privilegia contraste por hierarquia, não peso máximo em tudo. Títulos devem seguir a escala semântica e manter leitura confortável: `text-4xl`/`text-5xl` para entradas de página, `text-2xl`/`text-3xl` para seções e coluna de leitura em torno de 680–780px.

## Espaço, forma e superfície

- Escala base: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 120, 160.
- Raios de produto: `rounded-sm`, `rounded-md` e superfícies sem raio quando a borda deve parecer uma folha.
- Sombras: `--shadow-subtle` somente quando há elevação ou foco; preferência por borda, espaço e contraste.
- `paper-surface` é para conteúdo de estudo, estados vazios e materiais. Não transformar toda informação em card.
- Glass é reservado para headers/overlays contextuais; nunca é padrão de todos os cards.

## Componentes

Os primitives continuam em `@repo/design-system` para preservar acessibilidade e boundaries do next-forge. A adaptação atual concentra-se em:

- `Button`: alvo mínimo de 44px, raio curto, Dark Amaranth como primary e Classic Crimson apenas como gesto de estado.
- `Card`: papel elevado sem sombra genérica; usar somente quando há unidade independente.
- `Empty`: papel, borda sutil e título editorial; empty states explicam o que ocorreu e o próximo passo.
- `Input`, `Textarea`, `Select`: borda curta, superfície limpa, foco visível e altura confortável.
- `Sidebar`: Dark Amaranth estrutural, wordmark oficial, navegação com estados ativos legíveis e alvo de toque ampliado.
- `Progress`: trilho discreto e preenchimento estrutural; comunica percurso, não pontuação.

## Padrões de produto

- `MemberPage`: shell para superfícies ainda sem conteúdo, com título, contexto, descrição e asset semântico opcional.
- `LearningPageFrame`: shell editorial das páginas de Aprender, com largura de composição e coluna de leitura.
- Aula: conteúdo em papel, largura limitada, recursos separados e navegação anterior/próxima fora do texto.
- Navegação: sete destinos da área de membros; mobile mantém header compacto e abre a sidebar pelo trigger acessível.

## Motion

Tokens: `--motion-duration-instant` 120ms, `--motion-duration-fast` 180ms, `--motion-duration-normal` 280ms, `--motion-duration-slow` 420ms e `--motion-duration-editorial` 560ms. As curvas vivem em `--motion-ease-out`, `--motion-ease-in-out` e `--motion-ease-emphasis`. Motion deve comunicar foco, mudança de camada, seleção e progresso; a experiência padrão é deliberadamente controlada e não possui toggle de movimento. Não adicionar parallax, bounce, partículas ou animações simultâneas sem função.

## Regras de UX

- Toda tela declara contexto, conteúdo principal e ação primária.
- Linguagem é de escola: aprender, aula, atividade, encontro, material, discussão e feedback.
- Cor nunca é o único indicador de estado; use texto, ícone ou estrutura.
- Aulas e materiais não ultrapassam uma coluna de leitura confortável.
- Mobile é composição própria; targets de interação permanecem em torno de 44px.
- Imagens oficiais são incorporadas localmente e rastreadas em `docs/design/assets-used.md`.
- Não criar dados demo, analytics fictício, social proof, organização B2B ou funcionalidades futuras para preencher estados vazios.
