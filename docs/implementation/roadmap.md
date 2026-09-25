# Interprete Product Roadmap

Este documento é a fonte de verdade da execução do produto. As fases são sequenciais; uma fase só muda para `DONE` depois de cumprir seus critérios de aceite e os gates técnicos do repositório.

## Matriz de execução atual

Atualizada em 24/09/2026. A implementação de código avançou por todas as superfícies principais, mas nenhuma fase abaixo é marcada como `DONE` enquanto o processo local não tiver uma credencial PostgreSQL válida para provar migrations, seed, persistência, reload e E2E autenticado.

| Fase | Escopo | Status | Evidência atual |
| --- | --- | --- | --- |
| 0 | Fundação next-forge, Bun, Prisma, Supabase, Clerk | IN PROGRESS | checks do monorepo passam; conexão Prisma local ainda bloqueada por env placeholder |
| 1 | Aprender: trilhas, cursos, módulos, aulas, progresso | IN PROGRESS | código, schema, seed opt-in e guard server-side presentes; persistência/E2E pendentes |
| 2 | Admin/Professor: autoria, editor, preview, publicação | IN PROGRESS | rotas protegidas, editor compartilhado e ordenação presentes; fluxo real pendente |
| 3 | Atividades e feedback | IN PROGRESS | submissão, revisão, feedback e proteção de hierarquia presentes; banco real pendente |
| 4 | Comunidade | IN PROGRESS | espaços, tópicos, rich text, drafts, respostas, votos, bookmarks e moderação presentes; fluxo entre usuários pendente |
| 5 | Perfis e diretório de membros | IN PROGRESS | perfil privado/público, username, diretório e papéis presentes; dados reais pendentes |
| 6 | Encontros | IN PROGRESS | agenda, detalhe, professor e vínculo opcional com curso presentes; dados reais pendentes |
| 7 | Biblioteca | IN PROGRESS | curadoria, busca, filtros, detalhe e edição administrativa presentes; dados reais pendentes |
| 8 | Home inteligente | IN PROGRESS | próxima ação determinística usa atividade, aula, encontro e discussão reais; integração DB pendente |
| 9 | Integração entre domínios | IN PROGRESS | links entre aula/atividade, encontro/curso, perfil/comunidade e home presentes; E2E pendente |
| 10 | Responsividade, loading, vazio e erro | IN PROGRESS | estados e layouts revisados em fonte; screenshots autenticados ainda bloqueados |
| 11 | QA funcional | IN PROGRESS | check/typecheck/boundaries/tests/build passam; fluxo real autenticado não executado |
| 12 | Branding/UX final | IN PROGRESS | tokens e superfícies Interprete preservados; QA visual de runtime pendente |
| 13 | Hardening | IN PROGRESS | autorização centralizada, validação e RLS deny-by-default; auditoria runtime pendente |
| 14 | Preparação de deploy | IN PROGRESS | projetos Vercel do app/API e variáveis Clerk existem; Preview aguarda `DATABASE_URL` real e validação runtime |

O bloqueio atual é específico: os arquivos locais `apps/app/.env.local` e `packages/database/.env` existem, mas as URLs do banco ainda são placeholders. Nenhum valor secreto é registrado neste documento.

## Phase 1 — Learning

Status: IN PROGRESS

### Objetivo

Permitir que um membro encontre conteúdo publicado, navegue por trilhas/cursos/módulos/aulas, consuma uma aula e salve seu progresso real.

### Escopo

- modelo relacional de conteúdo publicado e recursos;
- leitura server-side de trilhas, cursos, módulos e aulas;
- renderização de conteúdo estruturado da aula;
- matrícula/enrollment e progresso por membro;
- marcar aula como concluída sem duplicidade;
- estados de loading, vazio, erro e conteúdo não publicado;
- experiência responsiva nas larguras 375, 768, 1024 e 1440px.

Autoria de cursos, módulos e aulas, edição rich-text e publicação administrativa pertencem à Phase 2. Nesta fase, o conteúdo necessário para validar o consumo pode ser provisionado por seed/dev fixture explicitamente identificada, nunca por dados falsos embutidos no frontend.

### Principais entidades

- `LearningPath`
- `Course`
- `Module`
- `Lesson`
- `LessonResource`
- `Enrollment`
- `LessonProgress`

### Principais rotas

- `/aprender`
- `/aprender/trilhas/[slug]`
- `/aprender/cursos/[slug]`
- `/aprender/cursos/[slug]/[lessonSlug]`

### Critérios de aceite

- membro autenticado vê somente conteúdo publicado e permitido;
- draft/archived não aparece nas consultas de membro;
- curso, módulo e aula possuem ordenação persistida;
- aula suporta documento estruturado e recursos sem assumir que toda aula é vídeo;
- conclusão usa constraint única por membro/aula e sobrevive a reload;
- progresso de um membro não pode ser lido ou alterado por outro;
- queries e mutações sensíveis permanecem server-side;
- testes cobrem publicação, autorização, conclusão idempotente e progresso isolado;
- lint, typecheck, boundaries, testes relevantes e build passam;
- E2E do fluxo membro é executado quando Clerk/Supabase estiverem disponíveis.

### Pendências

- `DATABASE_URL`/`DIRECT_URL` locais com a senha do projeto oficial para validar o Prisma pelo processo da aplicação;
- decisão de provider de vídeo, que permanece fora desta fase;
- autoria/admin e editor reutilizável, reservados para Phase 2.

### Evidência desta execução

- schema Prisma, migration SQL, seed de desenvolvimento e fluxo de leitura/progresso foram implementados;
- `bun install --frozen-lockfile`, `bun run check`, `bun run typecheck`, `bun run boundaries`, `bun run test` e `bun run build` passaram após a correção do empacotamento de `pg`;
- o projeto Supabase oficial `wkclodjbrynerfgufmyb` foi confirmado `ACTIVE_HEALTHY` em `sa-east-1`, PostgreSQL 17.6, com as duas migrations da fundação aplicadas;
- as sete tabelas da aprendizagem existem no Supabase com RLS habilitado e índices de cobertura das FKs;
- Clerk CLI, proxy, login real e acesso autenticado ao shell foram validados; o percurso do membro até `/aprender` chega ao guard e ao carregamento server-side;
- a consulta real da aplicação ainda falha localmente porque `DATABASE_URL` está sendo executada com placeholder: persistência, conteúdo e conclusão da aula continuam `BLOCKED_BY_CREDENTIALS`;
- a Phase 1 permanece `IN PROGRESS` até validar o processo Prisma da aplicação com credenciais PostgreSQL locais e executar o fluxo completo com seed de desenvolvimento.
- a proteção das páginas de membro usa o mesmo guard server-side da aplicação; sem sessão, `/` e `/aprender` respondem com redirect 307 para o fluxo do Clerk.

## Phase 2 — Teacher/Admin

Status: IN PROGRESS

### Objetivo

Permitir que professor/admin crie, edite, ordene, visualize e publique conteúdo de aprendizagem com autorização server-side.

### Escopo

- guards de papel e autorização centralizada;
- criar/editar curso, módulo e aula;
- ordenação persistida;
- draft, preview e publish;
- rich editor compartilhado, após avaliação de editorcn/Tiptap;
- recursos e storage somente quando houver necessidade validada.

### Principais entidades

- `MemberRole`/fonte de autorização;
- entidades de conteúdo da Phase 1;
- `LessonRevision` ou equivalente, se necessário após decisão de versionamento;
- recursos de conteúdo.

### Principais rotas

- `/admin/learning`
- `/admin/courses`
- `/admin/courses/new`
- `/admin/courses/[id]`
- `/admin/courses/[id]/modules/[moduleId]`
- `/admin/courses/[id]/lessons/[lessonId]`

### Critérios de aceite

- professor só gerencia conteúdo permitido;
- membro não acessa rotas administrativas nem drafts;
- fluxo criar curso → módulo → aula → editar → preview → publicar funciona ponta a ponta;
- publicação é transacional e auditável;
- editor é reutilizável por presets, não quatro implementações isoladas;
- checks e E2E de professor/membro passam.

### Pendências

- validação ponta a ponta depende de uma conexão PostgreSQL válida;
- editor de texto estruturado usa o documento JSON existente e ainda pode receber uma UI rich-text dedicada após validação de necessidade;
- buckets/policies do Supabase Storage permanecem fora do fluxo até existir upload real.

### Evidência desta execução

- `Member.role` foi criado como fonte server-side de autorização;
- professor/admin possui rotas protegidas para conteúdo, preview, publish/archive, atividades, comunidade, encontros e biblioteca;
- o fluxo de criação e publicação está implementado, mas ainda não foi executado com dados persistidos por causa do bloqueio de credenciais.
- o fluxo administrativo agora inclui edição de percurso, curso, módulo e aula, preview com o documento estruturado renderizado e controles de publicar/arquivar;
- novas entidades recebem a próxima posição persistida dentro de transação, evitando colisões da constraint de ordenação ao criar o segundo curso, módulo ou aula;
- as ações administrativas mantêm autorização server-side por `Member.role` e atualizam o responsável por alterações onde o modelo oferece esse campo.

## Phase 3 — Activities

Status: IN PROGRESS

### Objetivo

Permitir prática deliberada, entrega do membro e feedback autorizado do professor.

### Escopo

- atividades publicadas;
- submissions próprias;
- revisão e feedback do professor;
- status simples e auditável.

### Principais entidades

- `Activity`
- `ActivitySubmission`
- `Feedback`

### Principais rotas

- `/atividades`
- `/atividades/[activityId]`
- `/admin/activities`
- `/admin/activities/[activityId]/submissions`

### Critérios de aceite

- membro envia somente a própria submission;
- professor autorizado revisa e fornece feedback;
- estados `DRAFT`, `SUBMITTED` e `REVIEWED` são respeitados;
- persistência, autorização, mobile e E2E passam.

### Pendências

- validação de persistência e E2E depende do PostgreSQL acessível;
- sem anexos ou workflow acadêmico além de `DRAFT`, `SUBMITTED` e `REVIEWED`.

### Evidência desta execução

- criação de atividades aceita prazo opcional validado, e o admin possui publicação/arquivamento;
- submissão própria, feedback staff e estados `DRAFT`/`SUBMITTED`/`REVIEWED` continuam protegidos por ações server-side.

## Phase 4 — Community

Status: IN PROGRESS

### Objetivo

Criar espaços de discussão com posts, comentários threadados e reação positiva simples.

### Escopo

- espaços configuráveis;
- posts rich-text;
- comentários com nesting;
- voto/reação única e reversível;
- rascunho com autosave persistente;
- bookmarks/salvos por membro;
- tags simples e metadados de publicação;
- moderação mínima e soft delete.

### Principais entidades

- `CommunitySpace`
- `CommunityPost`
- `CommunityComment`
- `PostVote`
- `CommentVote`
- `CommunityBookmark`
- `Profile` (vinculado ao `clerkUserId`, enquanto `Member.role` permanece a fonte de autorização)

### Principais rotas

- `/comunidade`
- `/comunidade/novo`
- `/comunidade/meus-topicos`
- `/comunidade/salvos`
- `/comunidade/[spaceSlug]`
- `/comunidade/[spaceSlug]/novo`
- `/comunidade/[spaceSlug]/[postId]`
- `/membros/[username]`

### Critérios de aceite

- membro cria post, comenta e vota conforme autorização;
- constraints impedem voto duplicado;
- rascunho é salvo automaticamente e pode ser retomado após reload;
- membro salva/remove tópico e encontra a publicação em `/comunidade/salvos`;
- threads continuam íntegras após soft delete;
- feed e comentários possuem paginação e funcionam no mobile.

### Pendências

- validação do fluxo entre membros depende do PostgreSQL acessível;
- não há chat, DM, karma, leaderboard ou badges.

### Evidência desta execução

- posts, comentários e votos validam a relação entre espaço, post e comentário antes de mutar;
- feed e discussões têm paginação; a paginação da discussão é por comentários-raiz e inclui toda a descendência carregada, evitando separar uma resposta do seu pai;
- contagens públicas excluem posts/comentários removidos e a moderação permanece em soft delete.
- a migration `profiles_and_rich_topics` foi aplicada ao Supabase oficial e adiciona `Profile`, `contentJson`, `isPinned` e `CommunitySpace.icon`, mantendo RLS deny-by-default;
- o membro autenticado recebe um perfil básico sincronizado com Clerk sem sobrescrever os campos editoriais já preenchidos;
- `/comunidade` agora possui feed plano com busca textual, filtro de espaço, ordenação recente/popular, autor identificável e criação editorial com Tiptap;
- tópicos suportam `DRAFT`, `PUBLISHED` e `ARCHIVED`, edição do autor, soft delete, fixação para professor/admin e consulta em `/comunidade/meus-topicos`;
- respostas são editáveis pelo próprio autor, possuem identidade pública e preservam `parentId` para threading futuro;
- `/perfil` edita username, avatar URL opcional, bio, contexto, links e interesses; `/membros/[username]` omite e-mail e exibe apenas atividade publicada;
- rascunhos são criados no início do composer, salvos por server action com debounce, possuem preview baseado no mesmo renderer publicado e podem receber até cinco tags;
- tópicos publicados recebem slug/metadados de publicação, e `/comunidade/salvos` persiste bookmarks com unique composto;
- lint, typecheck, boundaries, testes e build foram executados após essa evolução; E2E autenticado e persistência via processo Prisma continuam pendentes por credencial local.

## Phase 5 — Meetings

Status: IN PROGRESS

### Objetivo

Exibir próximos e passados encontros com clareza, usando links externos.

### Escopo

- próximos encontros;
- encontros passados;
- link externo e gravação opcional;
- sem videoconferência própria.

### Principais entidades

- `Meeting`

### Principais rotas

- `/encontros`
- `/admin/meetings`

### Critérios de aceite

- próximo encontro é prioritário;
- datas e timezone são exibidos corretamente;
- acesso é autorizado e responsivo;
- nenhum WebRTC ou provider de vídeo é criado.

### Pendências

- links externos são aceitos somente com `http`/`https`;
- não foi criado provider de vídeo nem integração de calendário.

### Evidência desta execução

- timezone informado pelo professor é validado com `Intl.DateTimeFormat` antes de persistir, evitando falha posterior de renderização;
- próximo e passados continuam separados server-side por data e status publicado.

## Phase 6 — Library

Status: IN PROGRESS

### Objetivo

Centralizar recursos curados com busca simples e filtros úteis.

### Escopo

- artigos, PDFs, guias, links e vídeos externos;
- categorias/tags;
- busca por título/descrição/tags;
- filtros pequenos e previsíveis.

### Principais entidades

- `LibraryItem`

### Principais rotas

- `/biblioteca`
- `/admin/library`

### Critérios de aceite

- biblioteca não vira file manager;
- itens respeitam visibilidade e autorização;
- busca e filtros são paginados e funcionam no mobile;
- arquivos privados usam Storage seguro quando aplicável.

### Pendências

- URLs externas estão implementadas; upload/Storage fica pendente até haver necessidade real e policy validada;
- não há busca semântica ou IA.

### Evidência desta execução

- busca e filtros da biblioteca agora retornam páginas de tamanho limitado, preservando query, tipo e categoria nos links de navegação;
- itens publicados continuam sendo a única superfície de membro e URLs são validadas na criação administrativa.

## Phase 7 — Smart Home

Status: IN PROGRESS

### Objetivo

Responder de forma determinística “o que devo fazer agora?” usando dados reais das fases anteriores.

### Escopo

- continuar aula iniciada;
- próxima aula;
- atividade urgente;
- encontro próximo;
- aviso importante quando houver fonte real.

### Principais entidades

- `NextAction` como projeção/regra, não necessariamente tabela;
- dados derivados de progresso, activities, meetings e community.

### Principais rotas

- `/`

### Critérios de aceite

- nenhuma métrica ou conteúdo falso;
- prioridade determinística documentada;
- home não vira dashboard supercarregado;
- recomendações respeitam autorização e não vazam dados personalizados.

### Pendências

- depende da validação dos domínios com dados reais;
- não implementa IA ou recommendation engine.

## Phase 8 — Visual / Branding / UX

Status: IN PROGRESS

### Objetivo

Consolidar a tradução do Design System oficial do Interprete. em todas as superfícies funcionais, preservando a engenharia next-forge e priorizando leitura, escola contemporânea e prática baseada em evidências.

### Evidência desta execução

- tokens, tipografia, superfícies, navegação e padrões editoriais foram centralizados em `@repo/design-system`;
- as rotas funcionais novas usam o canvas Pink Essence, Dark Amaranth estrutural, Classic Crimson como gesto e estados de leitura responsivos;
- a auditoria final de screenshots, autenticação e dados reais ainda depende da conexão operacional.

### Gate

- desktop/mobile, acessibilidade, lint, typecheck, boundaries, testes e build;
- screenshots e navegação real nas rotas principais;
- nenhuma superfície pode voltar a depender de dados demo ou visual SaaS genérico.
