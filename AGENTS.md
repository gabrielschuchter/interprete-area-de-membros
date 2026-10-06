# AGENTS.md

## Objetivo

Este repositório é o produto da área de membros do Interprete. A fundação next-forge já existe e deve ser preservada. O desenvolvimento de produto é sequencial e a fonte de verdade da ordem é `docs/implementation/roadmap.md`. Uma fase em `IN PROGRESS` precisa ser validada antes de receber `DONE`.

## Regras de escopo

- Leia a especificação mestre antes de ampliar o trabalho.
- Implemente as fases do roadmap em ordem; não marque uma fase como concluída sem persistência real, autorização, responsividade e os checks do monorepo.
- Ao implementar uma fase autorizada pelo roadmap, prefira o menor modelo e fluxo que cubra o aceite; não crie features fora dele.
- Não use dados falsos embutidos no frontend. Seeds de desenvolvimento devem ser explícitos, resetáveis e nunca usados como produção.
- Fixtures opcionais usam `SEED_DEVELOPMENT_DATA=true`; não são evidência de dados de produção.
- Cada fase precisa funcionar ponta a ponta, persistir dados reais, ter autorização adequada e passar os checks antes de avançar.
- Preserve o design system e a arquitetura do next-forge quando não houver conflito com as decisões do projeto.
- Não reintroduza conceitos de SaaS B2B, como organização, workspace, billing, projetos, teams ou demo data, na navegação da área de membros.

## Stack e dados

- Use Bun e scripts do Turborepo na raiz.
- O PostgreSQL oficial é o Supabase. Não adicione Neon ou outro banco.
- Runtime usa `DATABASE_URL` com pooler de transação Supabase (`6543`, `pgbouncer=true`, limite de conexão explícito).
- Prisma CLI usa `DIRECT_URL` para o pooler de sessão Supavisor (`5432`).
- Mantenha SSL com verificação de certificado. Nunca desabilite TLS para contornar a CA local.
- Clerk é a fonte inicial de identidade. Não crie autenticação paralela.
- Não versione `.env`, senhas, tokens ou chaves.

## Organização

- `apps/app`: área autenticada e entrada Clerk.
- `apps/api`: endpoints e webhooks de infraestrutura, sem configurar provedores futuros.
- `packages/database`: único ponto de acesso Prisma/Supabase.
- `packages/auth`, `packages/design-system`, `packages/observability`: fundações compartilhadas.
- `docs/implementation/roadmap.md`: status, escopo e gates das fases de produto.
- Documentação arquitetural fica em `docs/architecture/`; documentação de domínio entra em `docs/product/` somente quando a fase começar.
- Professor/admin é autorizado por `Member.role` (`TEACHER`/`ADMIN`) associado ao `userId` do Clerk; nunca por e-mail, metadata pública ou esconder links.
- Todo domínio público mantém RLS habilitado no Supabase e nenhuma policy anon/authenticated permissiva enquanto o acesso for exclusivamente Prisma server-side.

## Performance permanente

- Performance é requisito de aceite de toda rota, componente e ação. Declare o caminho crítico, o orçamento, a projeção mínima, a paginação e a invalidação.
- Responda visualmente a cada clique/toque/submit em até 100 ms. Sucesso só aparece após persistência; UI otimista exige reconciliação, rollback, prevenção de duplicidade e teste de concorrência.
- Não bloqueie a navegação por Clerk Backend API ou por árvore/progresso completo quando `Member`/`Profile` e uma projeção `EXISTS` autorizada atendem o caso.
- Mantenha autorização fresca. `React.cache` deduplica dentro da requisição; cache persistente compartilhado nunca contém papel, identidade, grant, revogação, grupo privado ou dado pessoal.
- Paginação e projeções acontecem no banco. Índices e aumento do pool exigem plano SQL, dados representativos e ensaio de concorrência; mantenha Supavisor de transação e TLS validado.
- Trabalho secundário usa o outbox transacional existente, consumidores idempotentes e worker de recuperação ativo. `after()` e promises soltas não substituem persistência ou retry durável.
- Prefetch é intencional, limitado e sem mutações. Respeite rede restrita/economia de dados; conteúdo disponível não começa oculto por animação e movimento reduzido é respeitado.
- Telemetria é amostrada e sanitizada; nunca envie IDs, títulos, conteúdo pessoal, corpo de requisição, cookies, tokens, cabeçalhos de autorização ou URLs assinadas.
- Preserve e atualize `docs/architecture/performance.md` e `packages/design-system/PERFORMANCE.md`. A fase 10 continua aberta até evidência de autorização, responsividade, percentis, mobile, persistência, isolamento de cache e deployment.

## Checks obrigatórios

Antes de entregar mudanças relevantes, rode:

```powershell
bun run check
bun run typecheck
bun run boundaries
bun run test
bun run build
bun run performance:check
```

Se uma verificação precisar de credencial externa, registre claramente o bloqueio e valide tudo que for possível sem inventar valores.
