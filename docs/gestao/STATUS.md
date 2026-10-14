# Gestão V2 — estado operacional

Atualizado em 14/10/2026 após comprovar a conclusão de aula no fluxo Ensino → aluno e corrigir o agendamento UTC do outbox. Fonte única para retomada; decisões de produto ficam em `DECISIONS.md`, critérios de primeira publicação em `MVP.md`, e o contrato visual/funcional completo no pacote de referência.

## Git e ambiente

- Worktree: `C:\Users\gabsc\.codex\worktrees\interprete-gestao\interprete-area-de-membros`; branch `gestao-v2`. `2b8d1b7` corrige timestamps UTC do outbox; `541ffe9` corrige duplicação de curso atribuído; `f206977`, `2fc6773` e `b6dfa6d` registram evidência; `8b3b562` cobre o contrato de conclusão.
- A autorização da lista de atividades está em `c5fb778`; simplificação operacional/runtime compartilhado em `a26d0f4`; prontidão do runtime frio em `28c9096`; escopo de atribuição em `46c1d59`. O único diff de código local é o ajuste CSS preexistente de cinco linhas responsivas em `apps/app/app/(authenticated)/gestao/gestao.css`; preserve-o. O checkout original em `Documents\Codex\interprete-area-de-membros` contém alterações de outro trabalho; não o use para esta frente.
- Após os smoke locais, as portas 3000 e 3002 estão sem listener; PostgreSQL QA segue no loopback `127.0.0.1:55433`. Confira ambos antes de reutilizar e preserve a base e as fixtures existentes.
- Sondagem de recursos de 13/10: aproximadamente 17 GiB livres em C, 16 GiB em D e 3,3 GiB de memória física livre; é uma amostra, não garantia. Junctions existentes direcionam `.next-local-a2`, `.next-local-a2-d`, `.next-local-build-d`, `.next-local-item2-d` e `.next-local-preview3000-d` para D; preserve-as e confira o destino se um processo pesado voltar a ser necessário.

## Capacidades comprovadas que podem ser reutilizadas

| Jornada | Evidência local existente | Limite que continua aberto |
|---|---|---|
| Envio, rascunho privado, correção e feedback após reload | `output/gestao-mvp-a2/`, resumo do fluxo em `MVP.md`; testes focados, navegação professor/aluno, API e PostgreSQL/TLS | Adaptador QA não comprova Clerk real, worker contínuo, canal externo ou matriz integral |
| Turma, matrícula, acesso, remoção e revogação por origem | `output/gestao-mvp-t2/`; grant direto e histórico foram preservados | CSV, movimentação, convite, concessão temporária e matriz integral |
| Encontro de turma em rascunho, edição, publicação e calendário do aluno | `output/gestao-mvp-item2/local-browser-smoke.md`; `output/gestao-final-audit/`; teste com TLS e reload | C1/C2 integral, restantes das fontes/menu e fidelidade visual |
| Atividade direcionada e isolamento de aluno/professor fora do escopo | `9d7e48a`, testes de acesso e jornada em `output/gestao-mvp-activity/` | A1 e demais fluxos/perfis não estão integralmente aceitos |

As evidências são locais e preservam fixtures mutáveis. Consultá-las antes de reexecutar escrita. Reexecutar apenas se a alteração em análise atingir a jornada ou o controle que a evidência prova.

## Estado e próxima etapa

**Ensino → aluno — base funcional local concluída.** Cursos, aulas, exercícios, biblioteca e coleções reutilizam os serviços existentes e aplicam publicação, escopo de acesso, atribuição e liberação no servidor; as evidências anteriores de criação, atribuição, acesso/reload, negação (404/403) e remoção de duplicação continuam válidas. Nesta retomada, a aluna autorizada concluiu a aula publicada pela interface; após reload, a UI continuou em “Aula concluída” e o PostgreSQL local registrou `LessonProgress=COMPLETED` e a atribuição de curso como `COMPLETED`. Isso fecha a persistência real que faltava no fluxo de aluno. A conclusão gerou a notificação de medalha esperada; dois jobs mais antigos continuaram intocados. A investigação identificou comparação de `timestamp without time zone` com `CURRENT_TIMESTAMP` sob sessão `America/Sao_Paulo`; `2b8d1b7` usa UTC explícito para elegibilidade e lease. Seu teste focado passou (1/1), assim como typecheck de `@repo/member-domain` e Biome nos dois arquivos. O consumo real do worker após a correção ainda não foi comprovado e entra no QA integrado; dev auth não comprova Clerk publicado, nem Storage/upload/playback ou YouTube reais. QA integrado dos cinco contextos e visual essencial segue aberto.

**Comunidade — funcional local concluído.** Aviso direcionado, isolamento de destinatário, criação/publicação de grupo, associação persistida e postagem lida por outro membro após reload foram comprovados pela interface. A jornada de encontro usa evidência anterior; não foi repetida. Os sete testes de navegação continuam válidos. Veja `output/gestao-mvp-administration/local-browser-smoke.md`. Clerk/realtime reais permanecem sem prova.

**Administração — funcional local concluído.** A lista e o detalhe de membros agora exigem `ADMIN`, pois expõem papéis, e-mail, progresso e respostas; professores foram redirecionados também no acesso direto. Alterar papel persistiu após reload e a fixture voltou a `MEMBER`. A concessão direta exibe origem registrada, efeito herdado e validade; nova requisição do aluno perdeu acesso após revogação (404). Matrícula, atribuição e grupo continuam com suas origens independentes. Veja `output/gestao-mvp-administration/local-browser-smoke.md`.

**Shell — funcional local concluído.** Busca global retornou resultados e o popover abriu com estado vazio explícito; os destinos de navegação, aviso, atribuição e prévias mantêm as rotas existentes e oito testes de mapeamento. As páginas administrativas alteradas não tiveram overflow a 320 px. O endpoint de realtime retornou `503` no runtime local de dev auth (`auth: missing`, banco `ok`); não comprova Clerk/realtime publicado. Veja o registro local acima.

**Fechamento técnico da candidata (14/10, após `2b8d1b7`):** `bun run check` passou em 949 arquivos; `bun run typecheck` em 16 tarefas; `bun run boundaries` em 880 arquivos/19 pacotes. Um único `bun run build --concurrency=1`, com `INTERPRETE_LOCAL_DIST_DIR=.next-local-build-d` (junction para D) e `SKIP_ENV_VALIDATION=true`, terminou com 8 tarefas bem-sucedidas. App e API compilaram; a suíte incluída no build passou (app: 157 arquivos/761 testes; API: 3/9; member-domain: 4/18) e o `check:performance` incluído no build passou. Não repeti `test` e `performance:check` separadamente. Os checks locais não comprovam Clerk, Storage ou YouTube reais.

**QA integrado da candidata — em andamento.** Cruzar Gestão → aluno e os cinco contextos, reutilizando A2/T2, calendário, Administração e Shell onde não houve mudança. Incluir o consumo idempotente da notificação da medalha sob sessão com timezone não-UTC. A tentativa de leitura dos jobs pelo runner do workspace abortou antes de conectar: `.env.development.local` não contém `DATABASE_URL`; não usei outro banco como substituto. O consumo real após a correção segue sem prova. **Depois:** preflight real de Clerk, banco/migrations/RLS, Storage/YouTube indispensáveis e Vercel, seguido de publicação e smoke real. Ensino → aluno está funcionalmente fechado; QA integrado e preflight de publicação permanecem abertos.

## Release e verificação

A primeira publicação exige as capacidades de `MVP.md`, autorização fresca em rotas e ações, persistência, QA integrado nos cinco contextos de acesso, fluxos Gestão → aluno, interface essencial utilizável em desktop/mobile e ausência de risco crítico. Clerk e demais integrações indispensáveis precisam de prova real no preflight. Comparação exaustiva dos 101 quadros é backlog separado.

Durante desenvolvimento, usar testes focados e validação estática conforme o alcance. Retestar imediatamente mudanças de autorização/dados. Usar browser quando necessário para provar persistência/layout/comportamento. Build e gates completos são um único fechamento da candidata; `build` já executa testes e `check:performance`. Correções posteriores invalidam somente checks/cenários afetados.

## Causa operacional recente

Os registros em `output/gestao-mvp-a2/` e nos logs de build anteriores incluem ENOSPC/cache corrompido e falha de typecheck por memória; a recuperação do PG local também interrompeu QA. A configuração de C/D e o encerramento dos processos variam por sessão. Antes de browser/build, conferir Git, listener da porta alvo, destino físico do distDir, espaço e memória. Nunca mover ou apagar cache/junction, base ou fixture para liberar espaço sem necessidade e autorização explícita.
