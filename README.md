# Interprete — área de membros

Área de membros do Interprete. O projeto usa o next-forge como fundação de monorepo e evolui por fases documentadas em [`docs/implementation/roadmap.md`](docs/implementation/roadmap.md). A implementação local cobre Learning, autoria protegida, Atividades, Comunidade, Perfis, Encontros, Biblioteca e Home; o roadmap só marca uma fase como concluída após validação real contra o Supabase oficial.

## Fundação atual

- Bun 1.4.2, Turborepo, Next.js 16, React 19 e TypeScript strict.
- Clerk como camada inicial de autenticação.
- Prisma 7 com `@prisma/adapter-pg` e PostgreSQL do Supabase.
- `DATABASE_URL` para o pooler de transação em runtime/serverless.
- `DIRECT_URL` para migrações e introspecção do Prisma.
- `Lesson.content` armazena documento estruturado; progresso é persistido por membro/aula.
- Teacher/Admin, atividades, comunidade, perfis, encontros, biblioteca e Home usam Prisma server-side, com autorização Clerk/`Member.role`.
- Design system do starter preservado e adaptado para uma escola contemporânea do Interprete., com tokens e superfícies editoriais compartilhadas.

O projeto Supabase é `wkclodjbrynerfgufmyb`, na região `sa-east-1`. Nenhum segredo é versionado.

## Estrutura

| Caminho | Responsabilidade |
| --- | --- |
| `apps/app` | Área de membros e autenticação Clerk |
| `apps/api` | API e webhooks mantidos como infraestrutura opcional |
| `apps/email` | Exportação dos templates; preview local continua disponível em desenvolvimento |
| `apps/storybook` | Catálogo do design system |
| `apps/studio` | Prisma Studio |
| `packages/database` | Cliente Prisma e configuração Supabase |
| `packages/auth` | Integração Clerk |
| `packages/design-system` | Componentes e tokens compartilhados |
| `packages/observability` | Sentry/logging, sem credenciais por padrão |

## Desenvolvimento local

```powershell
bun install --frozen-lockfile
Copy-Item apps/app/.env.example apps/app/.env.local
Copy-Item packages/database/.env.example packages/database/.env
bun run dev
```

Preencha os valores locais de Clerk e as duas URLs do Supabase antes de usar a autenticação ou executar comandos Prisma. A senha do banco não deve ser colocada neste repositório.

Para o banco, use o pooler de transação do Supabase na porta `6543` com `pgbouncer=true`, `connection_limit=1` e `sslmode=require` no `DATABASE_URL`. O `DIRECT_URL` deve apontar para o pooler de sessão na porta `5432` com `sslmode=require`. A configuração completa está em [docs/architecture/foundation.md](docs/architecture/foundation.md).

## Verificações

```powershell
bun run check
bun run typecheck
bun run boundaries
bun run test
bun run build
```

O `build` percorre os apps do workspace. Testes que dependam de credenciais externas devem ser executados depois que os ambientes locais forem preenchidos.

Para conferir nomes, placeholders e prefixos sem exibir valores sensíveis:

```powershell
bun run env:check
```

Para aplicar as migrations e carregar conteúdo de desenvolvimento explicitamente identificado:

```powershell
bun run migrate:deploy
bun run db:seed
```

O seed base é idempotente. Para fixtures opcionais dos domínios de produto, defina `SEED_DEVELOPMENT_DATA=true`; para provisionar um professor de desenvolvimento, informe `SEED_STAFF_CLERK_USER_ID` e, opcionalmente, `SEED_STAFF_ROLE=TEACHER` ou `ADMIN`. Nunca copie esses valores para produção.

## Rotas principais

A área autenticada possui `/`, `/aprender`, `/atividades`, `/comunidade`, `/encontros`, `/biblioteca` e `/perfil`. A comunidade inclui criação editorial, rascunhos, tópicos salvos, respostas, votos e `/comunidade/meus-topicos`. Perfis públicos ficam em `/membros/[username]`, o diretório em `/membros` e a gestão de papéis em `/admin/membros`. Encontros e itens da biblioteca possuem páginas de detalhe.

## Escopo atual

A área de Professor/Admin possui rotas protegidas para conteúdo, atividades, comunidade, encontros, biblioteca e membros. O status real e os gates de validação ficam em [`docs/implementation/roadmap.md`](docs/implementation/roadmap.md); conexão, seed, persistência e E2E continuam pendentes enquanto a credencial local do Supabase não for válida. O inventário de ambientes e o estado dos projetos Vercel ficam em [`docs/infrastructure/environment.md`](docs/infrastructure/environment.md).
