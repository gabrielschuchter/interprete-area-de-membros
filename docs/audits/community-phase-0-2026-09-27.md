# Auditoria Fase 0 — Comunidade da área de membros

Data: 27/09/2026
Checkout: `C:\Users\gabsc\Documents\Codex\interprete-area-de-membros`
Branch: `main`
Baseline de código: `8b1345d541fb148d5ec24a947736f1d9135777b6`
Escopo: auditoria local, sem redesign profundo, deploy, push, alteração de
aliases/domínios ou configuração da Vercel.

Este documento registra a Fase 0 antes de qualquer alteração de interface. A
imagem `C:\Users\gabsc\Desktop\interprete comunidade banner.png` foi recebida,
mas não foi copiada nem incorporada ao produto nesta fase. Ela fica reservada
para uma fase visual posterior, se permanecer dentro do escopo aprovado.

## 1. Resultado executivo

A comunidade já é um domínio implementado dentro do member area, apoiado por
Prisma sobre PostgreSQL oficial do Supabase. O Clerk continua sendo a fonte de
identidade e sessão; `Member.role` continua sendo a fonte de autorização
interna. Não foi encontrado um segundo sistema de autenticação, duplicação de
usuário ou role concedida pelo frontend.

O baseline local está saudável nos gates estáticos, no build completo e na
conexão de leitura/migração do banco:

- 1 espaço publicado;
- 13 posts: 4 publicados, 1 rascunho e 8 arquivados;
- 14 comentários: 12 raízes e 2 respostas diretas;
- 2 votos, 2 salvos, 3 vínculos de `TopicFollow`, 3 perfis e 10 notificações;
- 28 migrações Prisma encontradas e schema oficial atualizado.

Os principais achados que precisam acompanhar a próxima fase são:

1. `docs/implementation/roadmap.md` marca a Fase 4 como `IMPLEMENTADO` na
   matriz superior, mas a seção detalhada ainda diz `IN PROGRESS`.
2. A criação aceita `parentId` em qualquer profundidade, mas a consulta da
   página carrega apenas comentários-raiz e respostas diretas. O dado atual
   não reproduz profundidade 2+, mas a inconsistência está presente no código.
3. `TopicFollow` já existe, é criado automaticamente e aparece como
   “Seguir discussão”. Isso é comportamento legado existente: não foi criado,
   ampliado ou removido nesta auditoria, pois a regra congelada proíbe adicionar
   follow e também exige preservar o que já funciona.
4. Feed, salas e comentários usam paginação por offset; “Meus tópicos” e
   “Salvos” têm limite de 100 itens. Notificações usam cursor e “Carregar mais”.
5. Há componentes antigos de composer (`NewTopicComposer`/
   `TopicDraftComposer`) sem consumidor ativo encontrado no checkout atual.

Esses pontos são achados de baseline, não autorização para redesign ou criação
de features.

## 2. Evidência e checks do baseline

| Verificação | Resultado | Observação |
| --- | --- | --- |
| `bun run env:check` | PASS | Core local READY; valores não foram impressos. |
| `prisma migrate status` pelo binário local | PASS | 28 migrações; banco atualizado. |
| `bun run check` | PASS | 376 arquivos, sem correções. |
| `bun run typecheck` | PASS | 15 tarefas Turbo. |
| `bun run boundaries` | PASS | 370 arquivos em 18 pacotes. |
| `bun run test` | PASS | App: 13 arquivos/35 testes; API: 1 arquivo/1 teste. |
| `bun run build` | PASS | 7 tarefas; app, API, Storybook, email e pacotes concluídos. |
| árvore Git antes da auditoria | LIMPA | `main` alinhada ao `origin/main` no início. |

O primeiro comando `bunx prisma migrate status` não chegou a executar o Prisma:
o gerenciador tentou baixar um manifesto e falhou com
`UNABLE_TO_VERIFY_LEAF_SIGNATURE`. O binário Prisma já instalado em
`packages/database/node_modules/.bin/prisma.exe` foi usado em seguida, sem
desabilitar TLS, e confirmou o status do banco. O warning de assets grandes do
Storybook e os warnings de observabilidade do build não falharam o processo.

O snapshot agregado do PostgreSQL foi somente leitura. Nenhuma mutação,
migration ou seed foi executada nesta auditoria.

## 3. Auditoria crítica do Clerk

### Identidade, sessão e provider

- `packages/auth/provider.tsx` mantém `ClerkProvider`, locale pt-BR, aparência
  integrada ao tema e proxy same-origin apenas quando a configuração de
  produção exige isso.
- `packages/auth/server.ts` mantém as APIs server-side do Clerk.
- `packages/auth/proxy.ts` reexporta `clerkMiddleware`.
- `apps/app/proxy.ts` compõe `authMiddleware` com os headers de segurança,
  preserva o `frontendApiProxy` e as rotas especiais `__clerk`, além do
  tratamento de aliases canônicos/legados já existente.

### Sign-in, sign-up e primeiro acesso

- `packages/auth/components/sign-in.tsx` usa `useSignIn` do Clerk, incluindo
  senha, reset e MFA conforme o fluxo existente.
- `packages/auth/components/sign-up.tsx` usa `useSignUp`, verificação de
  e-mail e finalização de sessão Clerk.
- `apps/app/app/(authenticated)/layout.tsx` chama `getAuth`, usa
  `redirectToSignIn()` quando não há sessão, sincroniza o perfil interno e
  envia membros não onboarded para `/onboarding`.

### Integração Clerk ↔ Member/Profile e autorização

- `Member.id` é o Clerk user ID.
- `Profile.clerkUserId` é único e não substitui a identidade Clerk.
- `getOrCreateProfile()` sincroniza o mínimo de identidade e preserva os campos
  editoriais já preenchidos.
- `getMemberRole()` consulta `Member.role` no banco.
- `requireSession()`, `requireStaff()` e `requireAdmin()` são os guards
  server-side centrais.
- `TEACHER` e `ADMIN` são os únicos papéis de staff; o frontend não atribui
  role.
- Membro comum chega às ações de criação de post/rascunho sem passar por
  `requireStaff`; portanto, a capacidade congelada de membros comuns criarem
  conteúdo está preservada.

Conclusão: Clerk não será reconstruído, substituído, duplicado, rotacionado ou
desacoplado nesta refatoração. Nenhum arquivo de autenticação foi alterado.

## 4. Mapa da comunidade atual

### Rotas e layouts

O layout autenticado protege a família principal e executa o bootstrap
`Member/Profile` antes do conteúdo. As rotas encontradas são:

| Superfície | Rotas |
| --- | --- |
| Feed | `/comunidade` |
| Espaço | `/comunidade/[spaceSlug]` |
| Criação | `/comunidade/novo`, `/comunidade/[spaceSlug]/novo` |
| Editor atual | `/comunidade/editor/[postId]` |
| Compatibilidade/legado | `/comunidade/[spaceSlug]/[postId]`, `/comunidade/[spaceSlug]/[postId]/editar` |
| Publicação canônica | `/comunidade/publicacoes/[slug]` |
| Conteúdo próprio | `/comunidade/meus-topicos` |
| Salvos | `/comunidade/salvos` |
| Moderação | `/admin/community` |
| Perfis relacionados | `/membros`, `/membros/[username]`, `/perfil` |

### Componentes

O fluxo atual usa, entre outros:

- `CommunityStartPanel` para iniciar discussão ou publicação e criar rascunho;
- `CommunityComposer` e `TopicEditor` para rich-text, autosave, tags,
  capa, imagens e menções;
- `CommunityPostView` para publicação, voto, bookmark, follow/mute existente,
  comentários e ações do autor/staff;
- `CommentComposer` e `MentionTextarea` para comentários e replies;
- `MemberIdentity` para nome, avatar, perfil público e papel visível;
- `loading.tsx` e `error.tsx` na rota da comunidade;
- `SingleFlightForm`/`SingleFlightSubmit` e chaves de idempotência para evitar
  duplicação acidental em mutações.

Os composers `NewTopicComposer` e `TopicDraftComposer` ainda existem no código,
mas a busca de referências encontrou apenas a relação entre suas próprias
definições; as rotas atuais usam `CommunityStartPanel` e `CommunityComposer`.

### Queries e leitura

`apps/app/lib/community.ts` concentra a leitura server-side:

- `getCommunitySpaces()` lista espaços publicados, contagem de posts visíveis e
  destaques;
- `getCommunityFeed()` filtra por texto, autor, espaço e tags, ordena por
  recente/popular e retorna voto/bookmark do membro atual;
- `getCommunitySpace()` carrega uma sala publicada;
- `getPublishedPost()` impõe post publicado, não removido e espaço publicado;
- `getPostWithComments()` pagina raízes e busca suas respostas diretas;
- `getCommunityCommentPage()` encontra a página da raiz de um comentário;
- `getMyCommunityPosts()` e `getSavedCommunityPosts()` são consultas privadas
  por membro;
- loaders staff listam espaços/posts para `/admin/community`.

O feed e as salas usam `POST_PAGE_SIZE = 20`; comentários usam
`COMMENT_PAGE_SIZE = 40`. A paginação é por `skip/take`, com uma linha extra
para detectar próxima página.

### Server Actions e APIs

`apps/app/app/(authenticated)/comunidade/actions.ts` contém as mutações de:

- início/criação de rascunho e publicação;
- edição de rascunho/publicação;
- mudança de status e soft delete;
- bookmark;
- follow/mute de tópico já existente;
- comentário, edição e soft delete de comentário;
- voto de post/comentário;
- pin/featured e moderação de posts;
- criação, edição, publicação/arquivamento e fechamento de comentários de
  espaços.

`apps/app/lib/community-mutations.ts` centraliza a criação de comentário,
validação da discussão publicada, `commentsClosed`, parent pertencente ao post,
rate limit e idempotência. `POST /api/community/comments` oferece o mesmo
contrato para o composer client-side. As ações derivam o ator de `auth()` e
validam novamente post/espaço no servidor.

### Schema e migrações

O schema Prisma contém:

- `Member` + `MemberRole` (`MEMBER`, `TEACHER`, `ADMIN`);
- `Profile` vinculado ao Clerk;
- `CommunitySpace`;
- `CommunityPost` com `DRAFT`/`PUBLISHED`/`ARCHIVED`, `DISCUSSION`/
  `PUBLICATION`, slug, tags, capa, pin, destaque e soft delete;
- `CommunityComment` com `parentId`, conteúdo plain text e `contentJson`;
- `PostVote` e `CommentVote`, ambos com `CommunityVoteKind.UP`;
- `CommunityBookmark` com unique composto por post/membro;
- `TopicFollow` com mute opcional;
- `Notification`, `Mention` e `NotificationPreference`.

As migrações relevantes vão de `20260924230000_product_domains` até
`20260926170000_mutation_reliability` e as migrações subsequentes de gestão,
notificações e onboarding. As tabelas de comunidade e notificações têm RLS
habilitado e não há policy pública ampla; o acesso de aplicação ocorre
server-side pelo Prisma/guards.

### Espaços, categorias, tópicos e posts

Espaços têm título, slug, descrição, ícone, posição, status e
`commentsClosed`. Não há uma tabela separada de “categorias”: a organização
atual é feita por espaço, `kind` e até cinco tags normalizadas. O estado real
do banco nesta auditoria tem um espaço publicado (`perguntas-de-metodo`).

Posts podem ser discussão ou publicação, começam publicados ou como rascunho,
possuem autosave persistente, slug para publicação, tags, capa, destaque/pin,
status e soft delete. A leitura pública exclui posts removidos e espaços não
publicados.

### Comentários e interação

Comentários suportam edição do autor, soft delete do autor/staff, voto positivo
reversível, menções, resposta e `commentsClosed` por espaço. O parent é
validado para pertencer ao mesmo post e não estar removido.

O código de escrita aceita replies em profundidade arbitrária. O loader da
página, entretanto, retorna somente as raízes selecionadas e registros cujo
`parentId` é uma dessas raízes. O renderer recursivo consegue desenhar uma
árvore, mas não recebe netos dessa consulta. É o achado estrutural registrado
na seção de problemas.

### Imagens, uploads e storage

O editor suporta imagens inline e capa. Uploads passam por
`/api/member-assets`, são normalizados via Sharp para WebP, recebem caminho por
membro e ficam no bucket privado `learning-assets` do Supabase. A rota GET
autoriza o caminho no servidor, gera URL assinada e responde com cache privado
`no-store`.

No domínio da comunidade não há upload de vídeo nem arquivo genérico. Há links
externos `http/https` e URLs same-origin para assets privados autorizados. O
sanitizer limita nodes/marks, remove esquemas perigosos, limita profundidade,
texto e quantidade de filhos.

### Busca, notificações, cache e realtime

- Busca do feed: título, excerpt, texto, tag, espaço e autor.
- Busca global: posts publicados/visíveis e perfis; não é uma busca de
  comentários.
- Notificações: menções, respostas, comentários do tópico, atividades e
  novidades; deduplicação por chave e preferências por membro.
- Realtime Supabase: somente `Notification` do próprio membro, com token
  derivado do Clerk e fallback de polling. Posts/comentários da comunidade não
  têm realtime.
- Cache: loaders usam `cache()` apenas para identidade/guards e mutações usam
  `revalidatePath()` para as rotas da comunidade, perfil e admin. Não foi
  encontrada `unstable_cache()` na superfície auditada.
- Notificações têm paginação por cursor e botão “Carregar mais”; comunidade usa
  links numéricos por offset.

## 5. Matriz FUNÇÃO | EXISTE | FUNCIONA | PROBLEMA | SERÁ ALTERADA?

“Funciona” abaixo significa que a implementação está presente, passa nos gates
locais e, quando indicado, foi conferida com leitura do banco. Isso não
substitui E2E autenticado completo nem prova de dispositivo físico.

| Função | Existe | Funciona | Problema | Será alterada? |
| --- | --- | --- | --- | --- |
| Rota da comunidade | Sim | Sim, build e loaders | E2E autenticado não executado nesta fase | Não nesta Fase 0 |
| Componentes | Sim | Sim, compilam | Há composer legado sem consumidor ativo | Não nesta Fase 0 |
| Layouts | Sim | Sim, layout autenticado | Depende de Clerk e bootstrap Member/Profile | Não nesta Fase 0 |
| Queries | Sim | Sim, Prisma conecta e schema está atualizado | Paginação e leitura de replies têm limites | Não nesta Fase 0 |
| APIs/server actions | Sim | Sim, build/testes e guards presentes | Mutação real autenticada não foi exercitada | Não nesta Fase 0 |
| Schema Prisma | Sim | Sim, 28 migrações aplicadas | Documentação de fase está divergente | Não nesta Fase 0 |
| Tabelas relacionadas | Sim | Sim, snapshot agregado conferido | Dados atuais ainda são pequenos | Não nesta Fase 0 |
| Espaços | Sim | Sim, 1 publicado | Não há categoria separada; depende de staff | Não nesta Fase 0 |
| Categorias | Parcial | `kind`/tags/espaços funcionam | Não há entidade `Category` | Não nesta Fase 0 |
| Tópicos/posts | Sim | Sim, 13 registros no banco | 8 estão arquivados no baseline | Não nesta Fase 0 |
| Comentários | Sim | Sim, 14 registros; criação/soft delete codificados | Loader não carrega netos | Não nesta Fase 0 |
| Reações | Sim | Sim, voto UP único e reversível | Não há novo sistema de reação, por regra | Não nesta Fase 0 |
| Salvos | Sim | Sim, unique post/membro | Lista limita a 100 | Não nesta Fase 0 |
| Posts fixados | Sim | Sim, staff-only | Pin é parte de moderação, não ranking | Não nesta Fase 0 |
| Criação | Sim | Sim, membro comum entra no fluxo | E2E autenticado ainda pendente | Não nesta Fase 0 |
| Edição | Sim | Sim, autor; staff modera status/remoção | Não há edição staff geral | Não nesta Fase 0 |
| Exclusão | Sim | Sim, soft delete e archive | Fio depende da consulta correta | Não nesta Fase 0 |
| Imagens | Sim | Sim, sanitizer e assets privados | Sem vídeo/arquivo no editor | Não nesta Fase 0 |
| Uploads | Sim | Implementado server-side | Upload real autenticado não foi exercitado | Não nesta Fase 0 |
| Storage | Sim | Sim, Supabase privado + URL assinada | Boundary depende das credenciais locais | Não nesta Fase 0 |
| Vídeos | Não | Não aplicável à comunidade atual | Não adicionar nesta fase | Não nesta Fase 0 |
| Arquivos | Não | Não aplicável à comunidade atual | Não há attachment genérico | Não nesta Fase 0 |
| Links | Sim | Sim, `http/https` e asset same-origin | Sanitizer limita os esquemas | Não nesta Fase 0 |
| Busca | Sim | Parcial: feed/global search | Comentários não entram na busca global | Não nesta Fase 0 |
| Notificações | Sim | Sim, dados e tela; realtime dedicado | Realtime é somente de notificações | Não nesta Fase 0 |
| Perfis | Sim | Sim, `Profile`/diretório/página pública | E-mail não é público; campos dependem de edição | Não nesta Fase 0 |
| Permissões | Sim | Sim, guards e validação server-side | E2E negativo autenticado não executado | Não nesta Fase 0 |
| Admin/professor/membro | Sim | Sim, role do `Member` | Matriz documental superior/inferior diverge | Não nesta Fase 0 |
| Mobile | Parcial | Classes responsivas e layout adaptativo | QA visual autenticado desta rodada não executado | Não nesta Fase 0 |
| Loading/skeletons | Sim | Sim, `loading.tsx` e error boundary | Cobertura visual não exercitada | Não nesta Fase 0 |
| Paginação/infinite loading | Parcial | Paginação numérica; cursor em notificações | Comunidade não usa infinite loading; limites 100 | Não nesta Fase 0 |
| Cache | Sim | Revalidação por rota presente | Não há teste de cache por sessão nesta rodada | Não nesta Fase 0 |
| Clerk | Sim | Provider, middleware, sessão e redirects presentes | Não tocar na arquitetura | Não nesta Fase 0 |
| Supabase | Sim | Prisma/migrações e storage configurados | E2E de upload/realtime não executado | Não nesta Fase 0 |
| Realtime | Parcial | Notificações com fallback | Comunidade não é realtime | Não nesta Fase 0 |
| Problemas conhecidos | Sim | Registrados neste documento | Devem virar gates específicos | Não nesta Fase 0 |

## 6. Regras funcionais congeladas

Nenhum item abaixo foi adicionado:

- follow de pessoas, espaços ou novo follow de tópicos;
- follower count, ranking, gamificação, badges ou karma;
- novo sistema de reação;
- novo nível de comentários/threading;
- Discord, chat ou DM.

O `TopicFollow` existente é explicitamente tratado como legado preservado. Ele
tem auto-follow em criação/resposta, follow/mute na publicação e notificações
de atividade. Qualquer remoção ou mudança dessa superfície exige decisão
explícita em fase posterior, porque a solicitação atual também manda preservar
o comportamento que já funciona.

Continuam protegidos como invariantes: comentários, voto atual, salvar,
publicar, editar, excluir por soft delete, permissões, perfis e criação por
membros comuns.

## 7. Problemas e riscos preexistentes

| ID | Achado | Evidência | Classificação para a próxima fase |
| --- | --- | --- | --- |
| C0-01 | Status da Fase 4 diverge na própria roadmap | Matriz superior `IMPLEMENTADO`; seção `Phase 4` `IN PROGRESS` | Corrigir fonte documental antes de usar como critério de aceite |
| C0-02 | Escrita aceita nesting arbitrário, leitura traz apenas raiz + reply direto | `createCommunityComment()` valida qualquer parent; `getPostWithComments()` filtra só `parentId in visibleRootIds` | Bug estrutural potencial; não criar novos níveis, decidir semântica antes de corrigir |
| C0-03 | `TopicFollow` já é feature existente apesar da regra de não adicionar follow | Schema, actions, UI e 3 registros no banco | Congelar; não ampliar nem remover nesta fase |
| C0-04 | Paginação da comunidade é offset e há coleções limitadas a 100 | `skip/take` no feed/sala/comentários; `take: 100` em próprios/salvos | Risco de escala/UX, não falha do baseline pequeno |
| C0-05 | Composers legados sem rota consumidora ativa | `NewTopicComposer`/`TopicDraftComposer` encontrados somente em suas definições | Limpeza futura somente após confirmar compatibilidade e testes |
| C0-06 | Geração de slug faz `findUnique` antes do create/update | `uniquePostSlug()` em loop fora de transação | Possível corrida concorrente; unique do banco é a última barreira |
| C0-07 | Vídeo e arquivo não são capacidades da comunidade | Nodes permitidos são texto/listas/imagem/menção; upload aceita imagem para community | Ausência deliberada; não inventar feature |
| C0-08 | Realtime não cobre posts/comentários | Subscription Supabase é somente `Notification` | Ausência deliberada; não adicionar chat/realtime nesta fase |

O snapshot atual não contém replies de profundidade 2+, portanto C0-02 não foi
reproduzido com dados existentes. Ele foi identificado por inspeção conjunta do
contrato de escrita, consulta e renderer, e deve permanecer separado de bugs
confirmados por dados.

## 8. Testes e lacunas de prova

Os testes atuais protegem especialmente sanitizer de rich content, contratos
de mutação/idempotência, domínio de notificações e fluxos unitários de auth.
Não há uma suíte de integração que exercite todas as server actions da
comunidade contra um banco transacional, nem E2E autenticado cobrindo:

- criar membro comum → rascunho → reload → publicar;
- editar/excluir próprio post e negar edição/exclusão alheia;
- comentário, reply, voto e bookmark com persistência após reload;
- staff pin/featured/soft delete e membro comum negado;
- upload/remoção de imagem com URL assinada;
- mobile autenticado em feed, editor, publicação e comentários.

Essas lacunas não foram mascaradas pelo build. O build prova compilação e
geração das rotas; não prova sessão Clerk real, persistência de uma mutação,
upload, subscription Realtime ou cobertura de dispositivo físico.

## 9. Alterações desta Fase 0

- Nenhuma alteração de código de produto, autenticação, schema ou migration.
- Nenhuma alteração de interface profunda.
- Nenhuma alteração de configuração da Vercel.
- Nenhum deploy, `vercel --prod`, push ou alteração de alias/domínio.
- Adicionado somente este relatório de auditoria/baseline.

Próxima fase deve começar a partir deste checkpoint e tratar explicitamente os
achados C0-01/C0-02 antes de qualquer decisão visual, mantendo Clerk, Member,
Profile, roles e invariantes funcionais intactos.
