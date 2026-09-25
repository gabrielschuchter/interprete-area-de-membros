# Comunidade e perfis

## Fonte de identidade

O Clerk identifica a sessão. `Member.id` continua sendo o Clerk user ID e `Member.role` é a fonte server-side para `MEMBER`, `TEACHER` e `ADMIN`. `Profile.clerkUserId` é único e guarda a camada editorial pública do membro: username, nome de exibição, avatar, contexto, bio, links e interesses.

O perfil é criado sob demanda no layout autenticado. O primeiro username é derivado de dados do Clerk, normalizado e tornado único. Depois disso, os campos editoriais do perfil não são sobrescritos pela sincronização automática.

`/membros` é o diretório público autenticado da escola, com busca por nome, username, headline ou interesse. `/membros/[username]` é a página pública interna do membro e exibe apenas campos editoriais, papel e atividade publicada. O admin pode ajustar `Member.role` em `/admin/membros`; a tela não expõe essa informação como autorização implícita e a mutation exige `requireAdmin`.

## Tópicos

`CommunityPost.content` mantém texto plano para preview e busca. `contentJson` guarda o documento estruturado compatível com Tiptap e permite evoluir o editor sem invalidar publicações antigas. A renderização passa por `RichDocument`, que aceita apenas nós e marcas suportados e links `http`/`https`.

O status de um tópico é `DRAFT`, `PUBLISHED` ou `ARCHIVED`. O feed de membros consulta apenas publicados não removidos; a área `Meus tópicos` exibe os três estados que não foram soft-deleted. `isPinned` ordena tópicos fixados antes do restante e só pode ser alterado por professor/admin.

Rascunhos são criados no início da composição e recebem autosave server-side com debounce; `content` continua sendo o texto plano para busca/preview e `contentJson` permanece a fonte estruturada do editor. Tópicos publicados recebem `slug`, `publishedAt` e até cinco tags normalizadas. `CommunityBookmark` usa unique composto por post e membro para permitir salvar/remover sem duplicidade.

## Autorização

Todas as mutations derivam o autor da sessão Clerk. O formulário fornece apenas IDs de contexto; o servidor confirma espaço, tópico, parent, status e ownership antes de gravar. Votos têm unique composto por recurso e membro, permitindo alternar sem duplicação. Perfil público nunca seleciona e-mail.

## Acesso ao banco

As tabelas continuam com RLS habilitado e sem policies públicas porque o caminho oficial da aplicação é Prisma server-side. A evolução de schema está em `packages/database/prisma/migrations/20260924234500_profiles_and_rich_topics/migration.sql`; as migrations seguintes restringem o helper interno de RLS (`20260925010000_restrict_rls_helper` e `20260925011000_revoke_public_rls_helper`) e adicionam drafts/metadados/bookmarks (`20260925020000_community_drafts_bookmarks`). Todas foram aplicadas ao projeto Supabase oficial.

O teste local de Prisma ainda depende de preencher a senha real do pooler nos arquivos ignorados `.env`/`.env.local`. A aplicação das DDLs via integração de gerenciamento do Supabase não substitui a verificação do histórico local do Prisma: o próximo passo, com a credencial disponível, é executar `prisma migrate status` e concluir o baseline/registro da história Prisma se necessário, antes de declarar a estratégia de migrations totalmente validada.

As migrations `profile_member_identity` e `meeting_course_relation` foram aplicadas ao projeto oficial e validam, respectivamente, o vínculo obrigatório `Profile.clerkUserId -> Member.id` e o vínculo opcional `Meeting.courseId -> Course.id`. Não há dados de produção ou fixtures persistidos no banco remoto; o seed continua opt-in e somente para desenvolvimento.
