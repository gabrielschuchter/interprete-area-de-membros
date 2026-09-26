# Auditoria de marca do produto

## Escopo

Esta auditoria registra a tradução inicial da identidade oficial para a área de membros da marca Interprete. A investigação foi concluída antes de qualquer alteração de código e combinou leitura de documentos, inspeção do manual em PDF e inspeção visual de assets isolados.

Fontes efetivamente estudadas:

- [Interprete design system v1](https://drive.google.com/file/d/1CxaaN2smkAjyQYtXPe8Vxmw6IUTCou6W/view) — fonte visual normativa.
- [Manual de Marca v1](https://drive.google.com/file/d/1-YVx4_VETsFj6_jabvMKr5dV6J4CWKgq/view) — posicionamento, voz, valores e regras de marca.
- [Manual de marca em documento de trabalho](https://docs.google.com/document/d/18AllEpgRMqeBEu0xlweUSkLHfKOA6bLl/edit) — confirmação de voz, público e proibições.
- [Interprete Landing Page System v1](https://docs.google.com/document/d/1-9hHBFJTd9jpTPT_W8xojSxth4-DMlVl/edit) — tradução web de argumento, leitura e responsividade.
- [ASSET_MANIFEST.md](https://drive.google.com/file/d/1jqgIJU5DdegQu8hI7l9V-6NmyyhAyt4Y/view) e [ASSET_MAP.md](https://drive.google.com/file/d/18A0ulF6KfFxEzzPa15cP-cQYDCmBBaGi/view) — proveniência e função dos assets.
- Pastas oficiais de referências, dobras, campanhas, posts e mockups no [Drive do Interprete.](https://drive.google.com/drive/folders/1GidDINwDQU-w7f5irXIEjVfqHw5eJVFQ).

### Hierarquia de autoridade

Instruções recentes dos fundadores prevalecem. Depois vêm o Design System canônico, o manual vigente, assets oficiais, mockups aprovados e implementações anteriores. O manual PDF inspecionado traz a seção visual completa; o documento de trabalho antigo ainda marca essa seção como pendente e, por isso, não foi usado para contradizer o Design System atual.

## Identidade central

O produto deve parecer uma escola virtual contemporânea de Prática Baseada em Evidências: escola, laboratório de pensamento, caderno de estudo, cultura acadêmica, tecnologia contemporânea e humanidade.

A experiência deve tornar visíveis estudo, dúvida, descoberta, discussão, método, leitura e raciocínio. O usuário deve sentir que pessoas estudam, discutem, anotam, questionam e aprendem a pensar. O produto não deve parecer revista de luxo, universidade antiga, healthtech, infoproduto, SaaS B2B ou dashboard de métricas.

A influência de dark academia é secundária: biblioteca, papel, profundidade local e tradição intelectual podem aparecer como atmosfera. Não haverá tema escuro global, gótico, excesso de bustos, mármore, serif em toda parte ou decoração sem função.

O teste de marca sem logo é obrigatório: a composição, os gestos de interpretação, a materialidade e o comportamento devem continuar reconhecíveis sem o wordmark. O teste inverso também vale: remover imagens e bustos não pode remover a identidade, que deve sobreviver em tipografia, layout, cor, ritmo e interação.

## Cores

### Tokens canônicos e papéis

| Token | Valor | Papel no produto |
| --- | --- | --- |
| `--brand-pink-essence` | `#F1EBE8` | Canvas principal, papel, leitura e respiro. |
| `--brand-dark-amaranth` | `#8C1535` | Estrutura, navegação, autoridade, seleção e ações primárias. |
| `--brand-crimson-violet` | `#410230` | Profundidade secundária, camadas locais e estados críticos. Raro. |
| `--brand-classic-crimson` | `#D62839` | Gesto, marcação, progresso, underline, conexão e ação pontual. |
| `--brand-debian-red` | `#D60858` | Accent técnico raro, tags e variações de destaque. |
| `--text-primary` | `#40222F` | Texto principal sobre superfícies claras. |
| `--text-secondary` | `#7A5A69` | Texto de apoio e contexto. |
| `--text-muted` | `#A08A93` | Metadata e estados de baixa ênfase. |
| `--surface` | `#FFFFFF` | Papel elevado e conteúdo em foco. |
| `--border` | `#E2D6D1` | Divisão sutil e estrutura. |
| `--border-disabled` | `#C9B5AF` | Controles indisponíveis. |
| `--text-strong` | `#111111` | Dados e contraste funcional quando necessário. |

Pink Essence é o canvas. A referência perceptual do Design System é dominância, não igualdade: aproximadamente 60% Pink Essence, 20% Dark Amaranth, 12% Crimson Violet e 8% Classic Crimson. No produto educacional, Violet será reservado a camadas e momentos de alta densidade simbólica; não será o fundo padrão. Debian Red entra dentro do orçamento de accent, não somado a ele. Classic Crimson e Debian Red não serão texto corrido sobre Pink Essence.

Não serão usados gradientes, glow, neon, sombras coloridas, preto como canvas dominante ou dois vermelhos competindo na mesma composição.

## Tipografia

- `Source Serif Pro`, semi-bold: wordmark, títulos editoriais, perguntas condutoras, citações e momentos de autoridade.
- `Inter`, pesos 400/500/600: corpo, navegação, formulários, botões, cards, captions e interface.
- `IBM Plex Mono`: labels técnicos, metadata, referências, dados e medidas; sempre com parcimônia.

A hierarquia será semântica e centralizada: `display`, `h1`, `h2`, `h3`, `h4`, `body-lg`, `body`, `body-sm`, `caption`, `label`, `eyebrow` e `annotation`. Texto corrido permanece alinhado à esquerda e em coluna confortável. Elementos manuscritos são gráficos de anotação, nunca substitutos de texto estrutural ou acessível.

## Layout, ritmo e leitura

- Canvas desktop até 1440px; container principal entre 1180px e 1280px.
- Gutter desktop de 48–80px; tablet 32px; mobile 18–24px.
- Grid de 12 colunas no desktop, 8 no tablet e 4 no mobile; gap de 24px, 20–24px e 16px respectivamente.
- Escala de espaço baseada em 4: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 120, 160`.
- Largura de leitura educacional entre aproximadamente 680px e 780px; texto longo não ocupa o container de composição inteiro.
- Mobile é composição própria, começando por 390px: a ordem segue a narrativa, e não a geometria do desktop.
- Raios canônicos de produto: `0`, `2`, `4` e `8px`. A extensão de LP admite raios maiores apenas em peças específicas; eles não serão padrão da área de membros.
- Sombras são mínimas. A estrutura deve vir de espaço, bordas, contraste e planos, não de caixas empilhadas.

## Componentes e padrões

A implementação preservará os primitives acessíveis do design system compartilhado, mas trocará os defaults monocromáticos por tokens semânticos da marca.

- Navegação: escola digital, não dashboard SaaS. Wordmark oficial `Interprete.` com ponto; ícone `I.` apenas em espaço reduzido. Sidebar e header devem ter estrutura clara, superfície Pink Essence ou Dark Amaranth local, e estado ativo com gesto Classic Crimson.
- Botão: hierarquia curta entre primary, secondary, ghost, destructive e textual. Primary estrutural em Dark Amaranth; Classic Crimson somente como gesto/ação específica.
- Card: só existe quando há unidade independente com ação, estado ou destino. Conteúdo editorial, listas e progresso não serão automaticamente encerrados em retângulos.
- Paper surface: superfície branca ou Pink Essence para leitura, guias, aula, material e feedback.
- Progressão: trilhas e aulas comunicam capacidade adquirida, não pontuação ou gamificação vazia. Track neutro, preenchimento Amaranth, marcos Crimson.
- Empty state: explica o estado e o próximo passo, com papel, nota ou asset apenas quando isso melhora a compreensão.
- Formulários: superfície branca, borda sutil, raio curto, foco Dark Amaranth e erro Classic Crimson com mensagem textual.
- Comentários e feedback: margem, linha, anotação e conexão controlada; não status update corporativo.
- Iconografia: uma linguagem de traço simples, geométrica e legível. Lucide pode continuar como infraestrutura quando não houver asset proprietário; não haverá mistura ornamental de bibliotecas nem ícone decorativo em círculo por padrão.

## Elementos proprietários e materialidade

Os elementos recorrentes observados no Drive são: papel, recortes, camadas, transparências, marca-texto, underlines, círculos, setas, brackets, perguntas manuscritas, páginas de artigo, forest plots, diagramas de aplicabilidade, livros, mesas, cadernos e situações reais de estudo.

Eles devem anotar ou explicar algo. A composição ideal combina pelo menos três famílias: estudo/escola, gesto de interpretação e camada/conexão/progressão. Círculo, seta ou nota manuscrita devem reforçar uma dúvida ou relação; não podem virar scrapbook. Elementos clássicos entram como fragmento, recorte ou enquadramento em momentos narrativos, não como busto repetido em cada tela.

## Fotografia e assets

A prioridade é asset oficial isolado, seguido de extração correta e derivado aprovado. Arquivos `fallback` são último recurso. Fotografia deve mostrar pessoas, professores, grupos, mãos, papel e materiais reais ou composições explicativas; não usar stock corporativo ou cliché médico.

Assets serão incorporados localmente em estrutura de produção rastreável, sem hotlink do Drive. Cada cópia terá origem, arquivo incorporado, uso e finalidade registrados em `docs/design/assets-used.md`. O acervo estudado possui wordmark, cenas de estudo, artigos, PubMed, forest plots, perguntas, decisões, aplicabilidade, grupos, retratos editoriais, livros, bustos e citações; a seleção final deve ser semântica por rota.

## Motion

Motion deve comunicar descoberta, raciocínio, camada, anotação, foco, conexão e progresso. A interface deve parecer pensando, não se exibindo.

- Press/focus: 100–140ms.
- Hover/estado: 160–220ms.
- Navegação/expansão/camada: 240–360ms.
- Reveal editorial: 420–700ms.
- Desenho de anotação: 500–900ms, apenas quando houver motivo.
- Easing padrão: `cubic-bezier(.2, 0, 0, 1)`; desenho: `cubic-bezier(.16, 1, .3, 1)`.

Por viewport haverá um gesto dominante e no máximo dois gestos de apoio. Nada de parallax, bounce, partículas, scroll hijacking, cursor gimmick, loop decorativo ou blur pesado. A experiência de motion é única, deliberadamente controlada e sem configurações paralelas.

## Voz e UX

A voz combina professor claro e paciente com mentor socrático. Microcopy deve preferir aprender, continuar, atividade, encontro, discussão, material, feedback, professor e turma; evitar workspace, organization, pipeline, resource center e linguagem de SaaS.

Cada tela precisa responder rapidamente: onde estou, qual é a informação principal, qual é a ação primária e o que pode ser ignorado. O branding não pode prejudicar leitura de aula, descoberta de conteúdo, navegação, foco, contraste, teclado ou permanência de duas horas de estudo. Cor nunca será o único indicador de estado; alvos de toque terão pelo menos 44px.

## Anti-padrões

- Tema escuro global, fundo preto ou Violet como primeira impressão.
- “Vinho + serif + grid editorial” sem escola, método ou comportamento próprios.
- Dashboard com KPI, números grandes, fake analytics, charts decorativos ou dados demo.
- Bento/grid de três cards repetidos, carditis, cards dentro de cards e iconografia SaaS em círculos.
- Gradientes, glow, glass em todo card, blur fullscreen, sombras genéricas pesadas ou bordas bubbly.
- Foto de estetoscópio, stock corporativo, busto clássico como decoração automática ou manuscrito ilegível em lugar de conteúdo.
- Logo recriado, sem ponto final, distorcido, recolorido, sombreado ou aplicado sobre fundo sem contraste.
- Tipografia, hex, radius, shadow ou spacing hardcoded página por página.
- Texto longo sem coluna de leitura, foco invisível, estado comunicado só por cor ou navegação quebrada no mobile.

## Auditoria da aplicação antes da migração

O estado atual ainda é starter funcional, não uma tradução do Interprete.:

- `packages/design-system` usa tokens Oklch monocromáticos de shadcn, `Geist Sans`/`Geist Mono`, raio global `0.625rem` e dark mode sistêmico.
- A sidebar é `variant="inset"`, visualmente genérica, usa ícone de livro no lugar do wordmark e exibe “Interprete” sem o ponto final.
- Header e `MemberPage` são barras e cards de empty state padrão, com bordas tracejadas, sombra e alinhamento central indiferenciados.
- A superfície de Aprender usa cards repetidos, `prose-neutral`, ícones Lucide e classes de layout locais; ainda não há largura editorial, papel, gesto de anotação ou progressão com linguagem própria.
- A autenticação usa um painel `bg-muted`, ícone de livro e toggle de tema; precisa receber a mesma hierarquia e o mesmo wordmark sem alterar Clerk.
- Não há biblioteca local de assets de marca no app. Os assets oficiais ainda não estão registrados em `docs/design/assets-used.md`.
- A captura baseline por Playwright foi bloqueada pela ausência de `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`; a aplicação iniciou no Next.js, mas a rota raiz retornou 500 no `ClerkProvider`. Isso é limitação de ambiente, não evidência de qualidade visual.

## Direção de implementação

1. Foundations: tokens, fontes oficiais, escala de espaço, radius, sombra, motion e light theme canônico.
2. Core components: primitives e padrões compartilhados, mantendo acessibilidade e boundaries.
3. Navigation: wordmark, shell, sidebar, header e mobile.
4. Product surfaces: home, aprender, aula, atividades, comunidade, biblioteca, encontros, perfil e teacher/admin sem inventar negócio.
5. Assets e motion: somente onde houver função semântica.
6. UX e QA: hierarquia, mobile, acessibilidade, performance, screenshots e consistência.

A migração não altera banco, Clerk, autorização, regras de progresso ou APIs sem necessidade real. Não implementa funcionalidades futuras que hoje estão apenas como empty states.

## Implementação verificada após a fase de foundations

- O canvas agora usa Pink Essence, tokens semânticos de marca e tema claro canônico; o dark fallback permanece apenas para primitives/integrações e não é exposto como escolha do produto.
- `Source Serif 4`, `Inter` e `IBM Plex Mono` foram incorporadas ao package compartilhado, substituindo Geist na superfície do produto.
- Button, Card, Empty, Badge, Progress, Input, Textarea, Select e Sidebar receberam raios, alturas, bordas, foco e contraste alinhados à gramática do Interprete.
- A sidebar e os headers usam o wordmark oficial com ponto final; o shell mobile mantém trigger acessível e wordmark compacto.
- Home, Aprender, trilhas, cursos, aulas e estados vazios das demais rotas usam papel, leitura, hierarquia e assets oficiais locais.
- O inventário de proveniência está em `docs/design/assets-used.md`; as regras de implementação estão em `docs/design/product-design-system.md` e a matriz de rotas em `docs/design/route-audit.md`.
- A validação visual navegada continua bloqueada por credencial Clerk ausente; os checks de código devem ser reportados separadamente da evidência de runtime.

## Revalidação do produto

O Clerk local passou a carregar e a sessão autenticada alcançou a Home. A navegação de produto agora possui rotas reais para aprendizagem, atividades, comunidade, encontros, biblioteca, perfil e administração protegida. A validação visual completa dessas superfícies não foi declarada concluída: a consulta `Member` do Prisma falha em runtime com `self signed certificate in certificate chain` usando o arquivo de ambiente disponível. Portanto, tokens, componentes e revisão de fonte estão implementados, mas screenshots autenticados e QA visual final continuam pendentes de conexão PostgreSQL válida.
