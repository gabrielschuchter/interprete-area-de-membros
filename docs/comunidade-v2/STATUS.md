# Comunidade V2 — status da auditoria

**Estado:** Estágio 00 concluído; Estágio 01 ACEITA PARA AVANÇO COM PENDÊNCIAS. Etapa 02 — Navegação e Explorar implementada no código do worktree; check, typecheck, boundaries, testes, build e orçamento de bundle passaram localmente. Runtime autenticado e persistência com dados reais ainda não foram validados nesta sessão, então a etapa permanece IN PROGRESS. A recuperação periódica Preview e Broadcast/badge seguem no OPS-01 e não bloqueiam Etapa 02. O cron GREEN, dados de produção e esquema não foram alterados.
**Atualizado:** 2026-10-15 — correção de rumo, transferência de OPS-01 e execução local da Etapa 02.
**Branch e base:** `codex/comunidade-v2`, a partir de `origin/main` em `b6028a37a358c0ff1d45d19297c5454318c799a3`; branch remota publicada.
**Próximo passo:** concluir o checkpoint de código e evidências da Etapa 02 na branch codex/comunidade-v2. Antes de marcar aceite, executar as jornadas autenticadas de leitura, filtros, paginação, Salvos e Encontros com os dados reais do Preview; OPS-01 não é dependência dessas jornadas.

## Escopo e integridade

- Handoff examinado integralmente: HANDOFF.md, 53 boards HTML e PNG, protótipo navegável, tokens, fontes de assets e sete fluxos guiados.
- Pacote entregue: C:/Users/gabsc/Downloads/files nova comunidade.zip
  SHA-256: 5C570782C1EA270DFD3514C0BEA39A4A6A8BEECDAD2E05EAFBFC8D1E7F515C44
- Protocolo de decisões: D:/roteiro-codex-comunidade-v2.md
  SHA-256: F9C6D5E4F657D320BA856D97DC31F489425FE3546B6E2BB303DE81CFC46C62E
- AGENTS.md, schema Prisma, código da main, Gestao V2, Inicio B2, editor, notificações, uploads, perfil, timers e consultas de estudo foram auditados. A fonte de implementação parte da main; o checkout original estava atrás da main.
- O checkout original permanece inalterado: branch `codex/interprete-member-area-release-2026-10-04`, HEAD `a4b68b81dc084d6de4648c488a0442e14cfb0539`, com 8 arquivos rastreados modificados e 9 não rastreados preexistentes. Nenhum foi copiado, limpo ou sobrescrito.
- O worktree V2 parte de b6028a3. Além dos documentos e da correção ambiental de write-freeze.test.ts, esta etapa implementou namespace do outbox em produtores, consumidores e atualizações de lembrete. Não houve migration, alteração de configuração/publicação Production ou escrita de conteúdo da Comunidade V2 no GREEN. Foram persistidos, com autorização explícita, quatro Members/Profiles QA e um DomainEvent de auditoria; em seguida, a validação do worker prevista para a etapa gravou uma única Notification de smoke para destinatário QA allowlisted. Os hashes dos sete Members e sete Profiles preexistentes permaneceram iguais. A instância Clerk Production não mudou.

## Fontes verificadas na main

- Sequência de produto: docs/implementation/roadmap.md; a tabela de reauditoria mantém fase 7 Comunidade, fase 8 Estudo, fase 9 Biblioteca/Encontros e fase 10 Acessibilidade/Performance/Release em IN PROGRESS.
- Contrato anterior de domínio: docs/product/community-and-profiles.md. Ele registra rascunho criado no início do composer e pin reservado a professor/admin; 20C altera o primeiro comportamento. A cardinalidade de pin muda por 18A, mantendo autorização server-side.
- Schema e acesso: packages/database/prisma/schema.prisma, packages/database/prisma.config.ts.
- Queries e mutations: apps/app/lib/community.ts, community-query.ts, community-mutations.ts, community-space-rules.ts, notifications.ts e study-dashboard.ts, study-tracking.ts, focus-timer.ts.
- UI e ações: apps/app/app/(authenticated)/comunidade/actions.ts; apps/app/components/community/community-composer.tsx, community-start-panel.tsx, mention-textarea.tsx, topic-editor.tsx, comment-composer.tsx, community-presence.tsx; apps/app/app/(authenticated)/salvos/page.tsx e apps/app/components/learning/study-dashboard.tsx.
- Identidade, assets e integrações: apps/app/lib/auth.ts, authorization.ts, apps/app/proxy.ts, packages/auth/clerk-proxy.ts, apps/app/app/api/member-assets/route.ts, apps/app/app/(authenticated)/admin/avisos/page.tsx, apps/app/components/portal/portal-view.tsx, apps/app/lib/meetings.ts, apps/api/lib/notification-outbox-consumer.ts.
- Instruções lidas: AGENTS.md, apps/app/AGENTS.md e apps/api/AGENTS.md, além das instruções fornecidas diretamente nesta conversa.

## Estado verificado do produto

| Domínio | Evidência atual | Trabalho V2 |
|---|---|---|
| Publicações | CommunityPost tem status, slug, capa, conteúdo estruturado, votos, favoritos, pin e deletedAt; consultas principais filtram publicação e exclusão lógica | Ciclo sem rascunho vazio, conflito/versionamento entre abas, fixação por escopo e restauração administrativa |
| Editor | TipTap e salvamento enfileirado já existem; editor foi corrigido para React StrictMode | Iniciar persistência apenas após primeira mudança, retries/saída e reconciliação sem duplicação |
| Discussão | CommunityComment, respostas, edição, exclusão e TopicFollow existem | Limitar resposta a um nível; reautorizar retries idempotentes; persistir comentário, menções e notificações de modo consistente |
| Menções | Nó TipTap, autocomplete, Mention e busca de membros existem | Busca limitada ao contexto, normalização de @, teclado móvel, regras de @todos e destinatários atuais |
| Grupos | CommunitySpace, owner, membros, visibilidade, entrada pública e comentários abertos/fechados existem | Papel MODERATOR, edição de configurações, membros, arquivo reversível e autorização de capa |
| Convites | Invitation, aceite e recusa persistem; convites por membro existem | Resultado individual, proteção concorrente, token/link, revogação e regeneração |
| Avisos | Announcement, tela da Gestão e leitura na Comunidade existem | Importância, público por turma, dispensa por versão, frescor e datas BRT explícitas. A V2 não integra aviso à Início |
| Estudo | StudyCampaign, StudyTrackingSession, StudyActivityInterval e FocusTimerSession; agregação SQL une sobreposição por membro | Meta opcional/configurável, renovação e snapshot, sem reescrever timers nem fabricar horas |
| Salvos | CommunityBookmark e /comunidade/salvos persistem. A página /salvos na main consulta conteúdo pessoal de aprendizagem e favoritos de questões; não consulta CommunityBookmark. | Integrar a Comunidade ao Salvos global. O roadmap registra uma integração anterior, mas a página atual não a implementa; prevalece o código executável. |
| Compartilhamento | Ações visuais existem; página pública, token revogável e OG completo não foram comprovados | Fluxo e landing real, metadados genéricos para publicação privada sem autorização |
| Encontros | Coortes, autorização e gravações existentes | Navegação e wrapper da Comunidade, mantendo contratos atuais de sala/gravação |
| Ativo agora | Presença real e dados de perfil são usados hoje em componentes existentes | Substituir somente o bloco da Comunidade por avatares decorativos habilitados, sem contagem/presença e com opt-out |

## Banco GREEN e segurança

Consulta realizada somente com leitura, TLS validado e transação read-only:

- PostgreSQL 17.11; 65 migrations completas; sem migration incompleta. Os 65 checksums conferem com os arquivos da main auditada.
- 104 tabelas públicas de domínio verificadas e 104 com RLS.
- Nenhuma duplicidade atual de convite pendente ou conflito de pin por escopo.
- Posts: 5 PUBLISHED, 11 DRAFT e 15 ARCHIVED; 14 arquivados têm deletedAt. Entre os rascunhos ativos, 10 estão sem título útil, texto, capa ou mídia. Todos precisam ser preservados.
- Um grupo público publicado e um grupo público arquivado; nenhum grupo privado presente no snapshot.
- 61 intervalos de estudo de 3 membros; 2 timers registrados; nenhuma campanha configurada.
- Snapshot original do banco: 2 jobs de outbox em `SUCCEEDED` e nenhum em outro estado; o cron `interprete-member-outbox` estava ativo a cada cinco minutos, com seis execuções bem-sucedidas nos 30 minutos observados. Na consulta pós-smoke, `notifications.create.v1` tinha 2 jobs `SUCCEEDED` e `preview.notifications.create.v1` tinha 1. O smoke não alterou nem desativou o cron compartilhado.
- No snapshot inicial: 0 convites, 3 notificações do tipo MENTION e 6 do tipo ANNOUNCEMENT. Depois desse corte foi persistida uma Notification QA pelo smoke do worker; nenhum convite foi criado.
- Existe policy autenticada de leitura da própria linha em Notification. Embora o cliente observado use API e Supabase Broadcast, validar compatibilidade e exposição de conteúdo copiado após revogação antes de restringir o caminho REST.
- Storage é privado. O proxy de assets já valida tipo/tamanho e remove EXIF; referências atuais não incluem CommunitySpace.coverUrl, então capa de grupo de outro membro não é reconhecida pela regra de acesso.

O GREEN atual é compartilhado por Preview e produção. O BLUE legado permanece congelado. Os arquivos locais de ambiente da auditoria apontam para BLUE e não servem para configurar o Preview V2.

## Reprodução dos defeitos relatados

| Área | Resultado | Limite da evidência |
|---|---|---|
| Menção @todos | Reprodução determinística em memória: o resolvedor captura group:ALL, remove essa chave antes de chamar a expansão e termina com recipients=[] e nenhuma leitura de banco. Menção individual de controle retorna o membro esperado | Não foram criados dados nem enviados avisos a contas reais. Separar autocomplete, nó editor, persistência, autorização, outbox e recebimento entre dois membros no Preview |
| Convites | Código contém convite pessoal, notificação e aceite/recusa. Há retorno sem resultado por destinatário e falta unicidade de pendente no banco para disputa concorrente | GREEN não contém convites; causa do relato histórico não está comprovada. Reproduzir criação, notificação, aceitar/recusar, revogação e reload com contas de QA |
| Avisos | Announcement existente conecta Gestão e Comunidade, mas não implementa importância, turma, dispensa por versão ou atualização automática completa | Não foi publicada alteração de aviso nesta auditoria. Reproduzir público elegível/não elegível, agendamento, edição, desativação e atualização em Preview |

A alegação do handoff de vazamento de rascunho no feed não foi confirmada na consulta estática da main: a consulta atual exige status publicado e deletedAt nulo. Os dez rascunhos vazios são dados reais e continuam preservados. O documento anterior de domínio registra criação do rascunho ao iniciar o composer; o contrato 20C muda esse gatilho. O roadmap registra que Salvos global já reuniu bookmarks da Comunidade, mas a página atual em apps/app/(authenticated)/salvos/page.tsx não consulta esses bookmarks; a integração precisa ser implementada e verificada.

## Estágio 01: preparação do Preview

**Estado:** ACEITA PARA AVANÇO COM PENDÊNCIAS. Backup GREEN verificado por restore local; isolamento, leitura autenticada e teste manual do worker concluídos no Preview. Os aliases App/API da branch foram READY; Clerk Development e quatro papéis QA foram comprovados. Uma Notification QA persistiu após reload. Nenhuma migration ou escrita de conteúdo V2 ocorreu até o checkpoint documental. Recuperação periódica Preview e Broadcast/badge continuam sem comprovação e estão em OPS-01; isso não bloqueia a Etapa 02. O cron GREEN e Production permanecem inalterados.

### Backup manual GREEN

- PostgreSQL: `%LOCALAPPDATA%\Codex\migrations\interprete-supabase\green-prechange-20261015T145641Z.pgdump.aesgcm`, 570.583 bytes, SHA-256 `d8796d123d962d0ae39ecc5b2152e26f78938a300523ed7440ef1b8a8f149046`. O manifesto registra os schemas `public` e `supabase_migrations`; AES-GCM e DPAPI CurrentUser foram verificados, o conteúdo descriptografado passou `pg_restore --list`, e o destino foi confirmado como GREEN com TLS `verify-full`. Nenhuma escrita ocorreu.
- Storage privado `learning-assets`: `%LOCALAPPDATA%\Codex\migrations\interprete-supabase\green-storage-prechange-20261015T150238088Z.aesgcm`, 4 objetos/11.092 bytes, SHA-256 `579a626b59993346e7b8e826f8cc3c5c1170ad67b9924449cc313dba56ac53b9`; inventário de metadados SHA-256 `c4b1350156dbf11c532f537baa68b7a5ed103e1b7513dad0d34f378e84dc498c`. Metadados foram comparados antes/depois da leitura, cada objeto foi conferido por tamanho e SHA-256 e o arquivo criptografado foi descriptografado e verificado em memória. Chave e manifesto usam DPAPI CurrentUser e ACL local.
- Ensaio concluído em PostgreSQL 17.11 local, loopback 127.0.0.1:54325, banco interprete_community_v2_qa, ACL do usuário Windows, senha DPAPI e TLS 1.3 com verificação do certificado. O arquivo foi descriptografado somente em memória e restaurado com pg_restore --single-transaction --no-owner, preservando ACL e RLS. As 106 tabelas e 1.486 linhas conferiram por hashes por linha com o COPY do arquivo; os 65 checksums do ledger conferiram com a branch; 104/104 tabelas de domínio mantiveram RLS. A comparação usa timezone UTC para não confundir serialização de timestamptz com diferença de dados. O helper auth.jwt oficial foi provisionado como dependência de plataforma; Realtime/Storage/API Supabase não fazem parte desse servidor local. Evidência privada: C:/Users/gabsc/AppData/Local/Codex/qa/community-v2-foundation-20261015/restore-report.json. Nenhuma conexão ao GREEN foi usada nesse ensaio. A recuperação fora do perfil Windows e a reidratação em Storage Supabase continuam sem ensaio.
- Rechecagem local às 22:10 UTC: dump PostgreSQL e backup de Storage continuam presentes; tamanho do dump e SHA-256 dos dois arquivos criptografados conferem com os valores acima. Os arquivos `restore-report.json`, `green-outbox-cron-baseline.json` e `green-outbox-cron-command.dpapi` também continuam presentes. Esta rechecagem não abriu chaves, descriptografou dados nem conectou ao GREEN.

### Vercel e Clerk

- A branch `codex/comunidade-v2` está publicada. Os projetos App (`prj_bwG8vDd4x2flyPaRMq8HEvi7t5Lj`) e API (`prj_LzsMnY95oPtOdp6KUwUaPRQ5lfh6`) mantêm overrides exclusivos da branch Preview: `OUTBOX_QUEUE_NAMESPACE=preview` e allowlist limitada às quatro identidades QA. Ambos usam freeze false para autenticação e smoke controlado; API tem `CRON_SECRET` aleatório só na branch, guardado localmente com DPAPI. Não há credenciais de webhook Clerk, e-mail ou terceiros.
- Os pulls efetivos pós-configuração confirmam GREEN no pooler de transação, TLS e Clerk Development nos dois projetos; `OUTBOX_QUEUE_NAMESPACE=preview`; os quatro Clerk IDs coincidem exatamente com a allowlist; seeds desligados; uploads pausados; webhook e serviços terceiros sem credenciais. `APP_WRITE_FREEZE=false` em ambos e API `CRON_SECRET` está configurado na branch. Endereços estáveis: App `https://interprete-area-de-membro-git-553be9-gabrielschuchters-projects.vercel.app`; API `https://interprete-area-de-membro-git-afba70-gabrielschuchters-projects.vercel.app`.
- Após o push documental `8c39070`, às 21:51 UTC os aliases estáveis apontaram para App `dpl_Hp5ywtwNSiPJT6xFFDGMwhfFRc8H` e API `dpl_4aw8QMDvZCujMvueShqxXocMSfYD`, ambos Preview/`READY`. A API permanece protegida por Vercel SSO e exige também Bearer no worker.
- Fingerprints de Production permaneceram idênticos: app `1beb15676657ebe3f7f2e6b61fbb4eabbcddacd04d9f8d692e1e8e6a18ab7b67`, API `d740ee06ecab8cbe8c1c7c035ec52c0e5840a7b2319a7f6bf3271136f50a41a9`; IDs de deployment Production também não mudaram.
- A implantação do app `dpl_3uEVkqA3r7ojbArNvUyHuiKZh8Hi`, criada antes dos overrides, não comprova o ambiente da V2. O app `dpl_3vYbK1TmMm7CJyjxSSHKj5Df9CM8` do SHA `84fb480` falhou porque o teste de `write-freeze` dependia de `APP_WRITE_FREEZE` estar ausente; o teste agora fixa temporariamente a variável vazia. O app `dpl_G1Q1VrYg1kjxvRFvYtFdFYdLmofB` e a API `dpl_6nkPwL1xUoUzGwiXcTjQktChHER3` do SHA `4c032bb` estão `READY`; a suíte local passou com freeze ativo. Após o commit documental `222b211`, os deployments do app (`interprete-area-de-membros-bycqkpa9m-gabrielschuchters-projects.vercel.app`) e da API (`interprete-area-de-membros-k5ety59rb-gabrielschuchters-projects.vercel.app`) também ficaram `READY`. A recarga do alias de branch autenticado continuou mostrando os registros existentes. Nenhum bypass Vercel foi usado.
- Depois da autorização, foram adicionados quatro membros/identidades Clerk Development. A identidade humana preexistente permanece intacta. A validação automatizada abaixo usa Vercel OIDC de Development só no host App e sessões oficiais de teste Clerk reais; o visitor sem Clerk é negado pelo proxy. Nenhum bypass de Deployment Protection foi usado.

### Provas autenticadas e fail-closed

- Na prova autenticada anterior, a sessão Vercel SSO + Clerk Development abriu `/comunidade` e exibiu dados GREEN existentes. Essa navegação/recarga não escreveu dados. Uma prova separada, documentada abaixo, gravou somente uma Notification QA por meio do worker.
- Navegar por GET para `/cron/outbox` e `/api/cron/activity-deadlines` retornou `WRITE_FREEZE` no deployment antigo: evidência histórica de bloqueio fail-closed, sem reivindicar jobs. No deployment API `dpl_8hT5EeQj1fFQiDpBMGc8YPfAbwxv` usado no smoke, um POST autorizado de `/cron/outbox` com OIDC de Development do projeto API e o Bearer `CRON_SECRET` processou um job namespaced (HTTP 200: `claimed=1`, `succeeded=1`, sem retry, dead ou stale).
- A destinatária QA MEMBER B abriu `/notificacoes` no App Preview usando Clerk Development. A notificação do smoke apareceu uma vez e continuou visível após recarga. O relatório de navegação sem escrita registra apenas o fluxo de leitura; a escrita da Notification ocorreu separadamente pelo worker. Isso prova entrega persistente no banco e leitura autenticada, não Broadcast nem badge de não lidas.
- Quatro sessões Clerk foram comprovadas no deployment `18dd88b`: dois `MEMBER`, um `TEACHER` e um `ADMIN`. Cada sessão conferiu o Clerk user ID exato da fixture, abriu/recarregou `/comunidade` (HTTP 200, conteúdo GREEN) e testou `/admin/avisos`. Ambos os Members foram redirecionados para `/`; TEACHER e ADMIN carregaram a página de Gestão. A decisão foi tomada pelo papel persistido em `Member.role`. Os percursos foram só de leitura e o harness registrou `writesToProduct=false`. Evidência privada: `preview-role-report.json` e screenshots sob `output/playwright/community-v2-foundation`.

### Isolamento de jobs

- Os deployments atuais usam `APP_WRITE_FREEZE=false` apenas nos overrides da branch para permitir sessão Clerk e o smoke QA controlado. API exige Bearer além de SSO. Webhook Clerk e upload continuam desligados/pausados. Os testes de escrita permanecem limitados a atores/destinatários allowlisted.
- Produtores e worker usam resolveOutboxConsumerKey: Production preserva notifications.create.v1; Preview usa preview.notifications.create.v1. VERCEL_ENV=preview ativa o namespace por segurança, mesmo sem a variável explícita. Configurar namespace de Preview em Production falha antes de persistir ou reivindicar jobs.
- Ajustes/cancelamentos de lembretes filtram também a chave do consumidor, para não atingir jobs do outro ambiente quando um DomainEvent idempotente é compartilhado. Nenhuma tabela, enum ou índice novo foi criado.
- O ensaio opt-in scripts/community-v2/outbox-postgres.test.mjs rodou contra o PostgreSQL restaurado, sem mocks: claims separados, rollback dos efeitos transacionais, retry após availableAt, processo encerrado após claim durável e recuperação após lease expirar, enqueue duplicado e dois processos concorrentes com SKIP LOCKED. Todos passaram, incluindo a recusa de destinatário fora da lista antes da persistência e um job adulterado levado a DEAD sem gravar Notification. Os registros de ensaio permanecem apenas nesse banco local.
- Os ensaios locais comprovam o mecanismo transacional do worker em PostgreSQL real. A chamada manual no API Preview comprovou processamento namespaced e entrega de uma Notification QA; não comprovou Broadcast nem execução periódica/recuperação HTTP automática.
- Notification continua compartilhada. O namespace da fila é acompanhado por validação fail-closed de ator e destinatários em `OUTBOX_PREVIEW_MEMBER_IDS` no produtor e no consumidor. A lista vazia bloqueia; Production preserva a semântica anterior. A prova remota usou somente MEMBER QA A como ator e MEMBER QA B como destinatária.
- O cron GREEN existente continua sendo o job `interprete-member-outbox` (jobid 1), ativo a cada cinco minutos e apontando à API Production. O baseline reversível do comando está criptografado com DPAPI em `C:/Users/gabsc/AppData/Local/Codex/qa/community-v2-foundation-20261015/green-outbox-cron-command.dpapi`; SHA-256 do comando: `7723899ba5ac9abc17d19be253de93a4ce1253c07730f572ec43f9d8a1101290`. O worker manual não alterou o job.
- A revisão automática rejeitou criar um Vercel Automation Bypass de escopo do projeto API; a [documentação Vercel](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation) confirma que ele alcança todos os deployments do projeto. Nenhum bypass foi criado e nenhum cron foi alterado. A [documentação Vercel](https://vercel.com/docs/cron-jobs) confirma que Vercel Cron chama a URL Production; `apps/api/vercel.json` não configura cron e o repositório não tem workflow agendado. [Shareable Links](https://vercel.com/docs/deployments/sharing-deployments) permitem acesso ao deployment por qualquer portador do link, portanto não são uma credencial restrita de worker e não foram criados. [Trusted Sources com OIDC curto](https://vercel.com/changelog/trusted-sources-for-deployment-protection) aceitam GitHub Actions como provedor externo, mas `schedule` do GitHub só executa workflows presentes no branch default e pode atrasar ou descartar execuções ([documentação](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)). A leitura read-only da API GitHub confirmou que o repo é público, Actions está habilitado, todas as actions são permitidas, não há pin por SHA obrigatório, as permissões padrão do workflow são `read` e `main` não tem proteção de branch (API respondeu `Branch not protected`). Uma automação candidata exigiria mudança revisável, job sem checkout, sem actions de terceiros (ou todas fixadas em SHA), `id-token: write` restrito ao job, claims OIDC que identifiquem repositório/workflow/evento e segredo de rota escopado ao ambiente do workflow; mesmo assim, a recuperação teria de ser medida. O [OAuth Server Supabase](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows) oferece authorization code + PKCE/refresh, sem grant client_credentials para o pg_cron existente. Também não foi alterado o worker Production para servir de relay.
- Credenciais em pg_net: em leitura somente com TLS e `BEGIN READ ONLY`, a verificação de permissão mostrou que os papéis `anon`, `authenticated` e `service_role` conseguem consultar `net.http_request_queue`; a sondagem usou `LIMIT 0`, retornou zero linhas e não leu requests nem headers. O [Supabase alerta](https://supabase.com/docs/guides/troubleshooting/database-roles-can-read-request-headers-queued-by-pg_net-ad6357) que quem tem acesso à fila pode ler headers enfileirados. Vault protege o repouso, mas não elimina a exposição transitória. Não colocar tokens Vercel, CRON ou Bearer nessa fila sem revisar privilégios e aprovar explicitamente o desenho.

### Segredos do cron e identidades QA

- O usuário delegou a escolha/preparação das contas de teste. Foram criadas quatro identidades exclusivas no Clerk Development ins_3Jn11qozddvhARaPkPLdQR6eAoo, com external_id community-v2-qa-20261015-{member-a,member-b,teacher,admin}, e-mails de teste +clerk_test@example.com e metadata privada de fixture. Nenhuma mensagem/e-mail foi solicitado e nenhuma conta existente ou instância Production foi alterada.
- A revisão automática inicialmente bloqueou o vínculo GREEN. Após o usuário autorizar explicitamente essas inserções, a transação serializável criou/verificou quatro Members (MEMBER, MEMBER, TEACHER, ADMIN), quatro Profiles com showInDirectory=false e um DomainEvent de auditoria. Os hashes dos sete Members e sete Profiles preexistentes conferiram antes/depois. Nenhum job de notificação foi criado e nenhum papel real mudou. Evidência privada: green-qa-provision-report.json no diretório QA.
- Ledger privado das identidades criadas: C:/Users/gabsc/AppData/Local/Codex/qa/community-v2-foundation-20261015/clerk-qa-ledger.json. Os papéis acima estão persistidos em Member; metadata Clerk não concede autoridade.

## Preview e runtime no corte do Estágio 00

- Na auditoria original, o Preview redirecionava para SSO Vercel e respondia HTML 200; isso não provava `/health` nem Clerk autenticado.
- A produção respondeu 200 nos health checks da aplicação e da API contra GREEN.
- Naquele corte, as variáveis Vercel não tinham sido lidas; os ambientes locais apontavam para BLUE e não serviam para Preview V2. A configuração específica da branch e a comparação de valores estão agora registradas acima.
- A infraestrutura de outbox está ativa. A configuração branch-only, allowlist, quatro identidades QA, Browser Preview e worker manual foram publicados e testados. Somente uma Notification de smoke foi escrita; nenhuma publicação, comentário, convite, aviso ou alteração de conteúdo comunitário foi criada.

## Verificações executadas e limites

- O protótipo foi navegado nos sete fluxos guiados; os 53 pares HTML/PNG foram examinados. Comparação visual de release ainda não existe.
- O resolvedor de @todos foi executado isoladamente com banco falso em memória; nenhum dado externo foi alterado.
- Oito arquivos focados, total de 22 testes, passaram pelo entrypoint Node/Vitest no checkout auditado. O checkout de teste estava em a4b68b8, não em b6028a3; isso não prova a suíte da main nem runtime autenticado.
- Uma tentativa usando Bun direto falhou em dois arquivos por interoperabilidade de import Zod no executor. A execução Node/Vitest passou; nenhuma mudança foi feita para contornar esse comportamento.
- No código atual do worktree V2, passaram check, typecheck (16 tarefas), boundaries (888 arquivos), test (app 779, API 9, domínio 24, scripts 32 com 1 skip), build completo (8 tarefas) e performance:check. O build local usou o ambiente Preview da branch, GREEN, Clerk Development, namespace preview e freeze. A geração do Prisma Client não aplica migrations.
- O primeiro build com variáveis Preview detectou uma expectativa ambiental implícita em events.test.ts; o teste agora fixa o ambiente Production antes de cada caso e testa Preview explicitamente. A repetição completa do build passou.
- O gate mediu Comunidade em 213,4 KiB gzip sob o teto de 225 KiB. O ensaio CLI local passou no runner Bun contra PostgreSQL real, cobrindo nove invariantes. O build final da branch passou 8/8 tarefas; check, typecheck, boundaries, test, build e performance:check estão registrados. O teste browser separado provou visitante, dois alunos, professor e admin reais no Preview. Percentis, QA visual e Broadcast permanecem abertos.

## Bloqueios e riscos por gate

Os itens abaixo são dependências de jornadas futuras ou do preflight de release; não formam bloqueio global para a Etapa 02. OPS-01 registra a recuperação periódica Preview e Broadcast/badge com seus gatilhos de retomada em docs/comunidade-v2/BACKLOG.md.

1. A restauração de domínio foi verificada localmente. A recuperação em outra máquina depende de chave recuperável fora do DPAPI deste perfil; Storage/Realtime/cron da plataforma não foram reidratados no ensaio local.
2. Os quatro vínculos QA e papéis já foram provados. Clerk MEMBER B abriu `/notificacoes`; a Notification criada pelo worker ficou visível após reload. Broadcast e badge não foram comprovados.
3. O worker foi exercitado com falha/concorrência em PostgreSQL local e processou um job QA no API Preview. A entrega Notification persistente foi confirmada no banco e navegador. Falta a execução periódica/recuperação automática, além do Broadcast. O único cron GREEN existente continua apontando para Production; não foi redirecionado.
4. GREEN e Notification são compartilhados. O namespace e a allowlist limitam o smoke a quatro fixtures; o teste remoto usou um único destinatário QA. Nenhum conteúdo comunitário V2 foi gravado.
5. O isolamento do outbox está publicado em App/API; os aliases estáveis ficaram `READY` após o push documental `8c39070`. Não voltar um Preview conectado ao GREEN a código que usa chaves legadas; reverter primeiro a configuração branch congelando workers e manter jobs namespaced.
6. Enum novo pode dificultar rollback; não gravar MODERATOR antes de todos os consumidores estarem compatíveis. Nenhum schema V2 foi antecipado.
7. Tokens, notificações privadas, REST legado, OG e caches precisam revalidar permissão após revogação.
8. Preservar os bytes de Storage anteriores; o ensaio de reidratação no bucket continua pendente.
9. Reconciliar a unicidade de título por proprietário com o board de nomes repetidos antes de alterar índices/dados.
10. O Preview não dispõe de scheduler nativo: Vercel Cron roda somente em Production. Um link compartilhável liberaria acesso a qualquer portador; o bypass de Automation de escopo de projeto foi rejeitado. A exceção GitHub OIDC foi autorizada. Em 15/10/2026, o Trusted Source foi configurado para o API Preview com claims exatas deste repositório, workflow, evento `schedule`, `main` e ambiente Actions; Vercel `Require Log In` continua ativo. PR #10 foi integrado por squash como `90aa250`; não havia run agendado observável às 23:28 UTC.
11. Papéis SQL `anon`, `authenticated` e `service_role` podem consultar a tabela `net.http_request_queue`. A checagem read-only não leu linhas; ainda assim, headers de chamadas futuras poderiam ficar expostos na fila. Não gravar nela credenciais de Vercel/cron sem revisar e alterar o modelo de privilégios com aprovação.
12. GitHub Actions não é scheduler com intervalo garantido: eventos schedule podem atrasar ou ser descartados. O ambiente `community-v2-preview` foi criado e está limitado à branch `main`; nele existe `PREVIEW_OUTBOX_CRON_SECRET`, copiado do `CRON_SECRET` da branch API Preview `codex/comunidade-v2` sem registrar o valor. O workflow OIDC está integrado em `main` pelo PR #10; a execução e a recuperação real ainda são gates.
13. `main` não tem proteção de branch. O PR #10 foi revisado com checks verdes e integrado por squash; não foi feito push direto. A confiança OIDC foi restrita e verificada antes da ativação do workflow; conservar a revisão via PR para mudanças futuras.

## Próximo passo

O código da Etapa 02 está implementado e passou os gates locais listados na seção seguinte. O runtime QA autenticado continua necessário para demonstrar persistência após reload, autorização por membro e comportamento responsivo com os dados reais. As evidências do Estágio 01 permitem esse avanço com pendências transferidas; não declarar recovery periódico como validado. OPS-01 só será retomado quando a primeira jornada depender de recuperação/Broadcast/badge ou no preflight de release. Até lá, preservar Vercel SSO, o cron GREEN, credenciais, Production e dados existentes.

### Etapa 02 — implementação e validação local 15/10/2026

- A branch de trabalho codex/comunidade-v2 preserva o checkpoint documental 191c8f1 e a base de código recebida; o checkout original não foi alterado.
- Implementados os cinco destinos de navegação, filtros reais na URL, paginação por cursor, preservação segura da origem/retorno, rotas canônicas de grupos/publicações, integração de CommunityBookmark no Salvos global e wrappers de Encontros/Gravações que reutilizam autorização e dados existentes. Nenhuma migration, fixture de produção ou mutação externa foi criada.
- Referências visuais consultadas para a Etapa 02: boards 02, 03, 03b, 08, 09, 11, 19, 32, 33, 35, 37, 38, 43 e 50. Os recortes responsivos foram implementados para desktop/tablet/mobile; a navegação móvel mantém o drawer e carrega sua implementação fora do bundle inicial.
- Evidência local: bun run check, bun run typecheck, bun run boundaries, bun run test e bun run performance:check aprovados nesta revisão; 782 testes do app passaram, além das suítes de API, domínio e guards. Build de apps/app aprovado com SKIP_ENV_VALIDATION=true e NEXT_PUBLIC_APP_URL=http://localhost:3000; bundle da rota Comunidade em 210,8 KiB gzip (limite 225 KiB). Esses valores são de compilação local.
- A tentativa de graphify update . não pôde ser executada porque o binário graphify não está instalado neste ambiente; graphify-out/graph.json também não existe no worktree.
- Limite: não havia variáveis locais de Clerk/Supabase/PostgreSQL no worktree. Não foram importadas credenciais, acessado Preview/Production nem escritas linhas. Portanto não há evidência de sessão autenticada, renderização com dados persistidos reais, isolamento entre membros ou interação no navegador autenticado.
- Estado: código pronto para checkpoint na branch; Etapa 02 continua IN PROGRESS até o runtime QA autenticado demonstrar os fluxos acima. Não transferir esse limite para OPS-01 nem usar credenciais/cron de produção para removê-lo.

### Diagnóstico da ativação de sessão com freeze

O primeiro teste de login com freeze retornou 503 no Server Action interno Clerk `invalidateCacheAction`. Após atualizar o override somente App/Preview para false, o login oficial passou. As observações antigas sobre deployment pendente foram superadas: os aliases App e API ficaram `READY` depois do push `8c39070`. Não foi aberta exceção genérica de Server Actions, nem alterada a proteção SSO dos projetos.

### Scheduler GitHub OIDC — evidência 15/10/2026 22:27 UTC

- A exceção ao no-parallel-scheduler foi autorizada explicitamente para a fila namespaced do Preview; a chamada do cron GREEN continua apontando para Production.
- PR workflow-only #10 (`https://github.com/gabrielschuchter/interprete-area-de-membros/pull/10`), branch `codex/preview-outbox-oidc`, commit `e417743`, contém `.github/workflows/community-v2-preview-outbox.yml` e o runbook. O workflow agenda a cada cinco minutos fora do início da hora, usa OIDC de curta duração, exige a secret de rota do Preview em ambiente Actions `main`-only, chama apenas o alias API Preview atual, sem follow redirect, e só aceita HTTP 200. `git diff --check` e `bash -n` do bloco executável passaram; os checks Vercel App e API do PR concluíram `pass`. Não há validação de parser GitHub Actions local nem execução do job, pois o arquivo ainda não está em `main`.
- No painel Vercel API, `Require Log In` estava ativo e Trusted Sources listava apenas o próprio projeto; não foi adicionada exceção de SSO. A API do GitHub confirmou o ambiente `community-v2-preview` ausente, repositório público, Actions habilitado e `main` sem proteção de branch. A configuração externa do OIDC permanece pendente.
- Não houve merge, chamada do novo workflow, alteração do cron GREEN, migration, deploy Production ou escrita de conteúdo V2.

### Scheduler GitHub OIDC — atualização 15/10/2026 23:09 UTC

- O PR #10 foi integrado por squash em `main`; commit de squash `90aa250e3d50a077df013edec38f90ce3e828316`. Os checks do SHA `1137eda` foram três sucessos, os projetos App/API ficaram `Ready` e o PR não tinha conflitos.
- GitHub Actions environment `community-v2-preview`: branch policy verificada como somente `main` (um branch, zero tags); secret `PREVIEW_OUTBOX_CRON_SECRET` presente e derivado do `CRON_SECRET` do API Preview para `codex/comunidade-v2`. O valor não foi exibido nem registrado.
- Vercel API project `interprete-area-de-membros-api`: Trusted Source GitHub OIDC exige audience `https://github.com/gabrielschuchter`, repository `gabrielschuchter/interprete-area-de-membros`, `ref=refs/heads/main`, `event_name=schedule`, `workflow_ref=gabrielschuchter/interprete-area-de-membros/.github/workflows/community-v2-preview-outbox.yml@refs/heads/main`, environment `community-v2-preview` e subject correspondente; alvo Preview somente. `Require Log In` continua habilitado.
- Às 23:09 UTC ainda não havia run schedule. O merge acionou deployments Production automáticos: API `BAqNXkdPWoZWXgaB44napP9AYXUQ` ficou `Ready` às 20:09:53 BRT e App também ficou `Ready` para `90aa250` às 20:09:34 BRT. O diff integrado não altera código de produto ou schema. Não houve chamada manual do workflow, alteração do cron GREEN, migration ou escrita de conteúdo V2 nesta integração.

### Scheduler GitHub OIDC — atualização 15/10/2026 23:20 UTC

- API GitHub: workflow `.github/workflows/community-v2-preview-outbox.yml` está `active` e branch default é `main`; runs consultados por `event=schedule` ainda vazios após o merge.
- Vercel Production App/API mostraram ambos `Ready` para o commit `90aa250`; essa promoção foi automática pelo push em `main` e corresponde a um diff apenas de workflow/documentação.
- O workflow não tem `workflow_dispatch`; nenhum run foi disparado manualmente. Aguarda-se schedule best-effort; o cron GREEN e as escritas de conteúdo seguem inalterados.

### Scheduler GitHub OIDC — atualização 15/10/2026 23:28 UTC

- O workflow permanece `active` em `main`, branch default pública. As consultas GitHub Actions às 23:23 e 23:28 UTC não encontraram nenhum run `schedule`; a página do workflow mostra zero execuções. O Status do GitHub reportava os sistemas operacionais na consulta. Portanto, OIDC e a rota ainda não foram exercitados por este scheduler.
- O status permanece `IN PROGRESS`; não houve claim de job nem escrita nova no GREEN. Os deployments Production `Ready` do commit `90aa250` permanecem o efeito automático já descrito; sem alterações de produto ou schema.
- A documentação oficial diz que `schedule` pode atrasar ou ter execuções descartadas sob carga. Fonte: [eventos que acionam workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows).
