# Comunidade V2 — status da auditoria

**Estado:** Estágio 00 concluído; Estágio 01 em andamento. Backup GREEN restaurado e reconciliado em PostgreSQL local com TLS. Isolamento de fila implementado e exercitado com retry, crash e concorrência reais. O deployment `b747ed8` dos dois projetos está READY; o override efetivo da branch mudou apenas no App para APP_WRITE_FREEZE=false e precisa de novo deployment para ativar o login Clerk. A API permanece congelada. Quatro contas QA Development já têm vínculos MEMBER/MEMBER/TEACHER/ADMIN persistidos no GREEN após autorização explícita; os sete Members e sete Profiles anteriores permaneceram intactos. A validação de papéis no browser está em execução.
**Atualizado:** 15/10/2026 21:20 UTC.
**Branch e base:** `codex/comunidade-v2`, a partir de `origin/main` em `b6028a37a358c0ff1d45d19297c5454318c799a3`; branch remota publicada.
**Próximo passo:** publicar o App com o override efetivo de freeze false, comprovar login/roles Clerk e então configurar a recuperação namespaced Preview pelo cron GREEN existente.

## Escopo e integridade

- Handoff examinado integralmente: HANDOFF.md, 53 boards HTML e PNG, protótipo navegável, tokens, fontes de assets e sete fluxos guiados.
- Pacote entregue: C:/Users/gabsc/Downloads/files nova comunidade.zip
  SHA-256: 5C570782C1EA270DFD3514C0BEA39A4A6A8BEECDAD2E05EAFBFC8D1E7F515C44
- Protocolo de decisões: D:/roteiro-codex-comunidade-v2.md
  SHA-256: F9C6D5E4F657D320BA856D97DC31F489425FE3546B6E2BB303DE81CFC46C62E
- AGENTS.md, schema Prisma, código da main, Gestao V2, Inicio B2, editor, notificações, uploads, perfil, timers e consultas de estudo foram auditados. A fonte de implementação parte da main; o checkout original estava atrás da main.
- O checkout original permanece inalterado: branch `codex/interprete-member-area-release-2026-10-04`, HEAD `a4b68b81dc084d6de4648c488a0442e14cfb0539`, com 8 arquivos rastreados modificados e 9 não rastreados preexistentes. Nenhum foi copiado, limpo ou sobrescrito.
- O worktree V2 parte de b6028a3. Além dos documentos e da correção ambiental de write-freeze.test.ts, esta etapa implementou namespace do outbox em produtores, consumidores e atualizações de lembrete. Não houve migration, alteração de configuração Production, publicação Production ou escrita funcional V2 no GREEN. A única escrita GREEN desta etapa criou quatro Members/Profiles QA e um evento de auditoria, com autorização explícita; a instância Clerk Production não mudou.

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
- 2 jobs de outbox em SUCCEEDED e nenhum em outro estado. Cron interprete-member-outbox ativo a cada cinco minutos; 6 execuções bem-sucedidas nos 30 minutos observados.
- 0 convites, 3 notificações do tipo MENTION e 6 do tipo ANNOUNCEMENT.
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

**Estado:** backup, isolamento de ambiente, build e leitura autenticada do Preview concluídos. App e API do SHA `4c032bb` estão `READY`. A sessão humana foi validada separadamente após Vercel SSO e Clerk Development. Nenhuma migration foi aplicada. O Preview continua somente leitura; os vínculos QA aditivos autorizados foram inseridos depois desse corte, conforme registro abaixo.

### Backup manual GREEN

- PostgreSQL: `%LOCALAPPDATA%\Codex\migrations\interprete-supabase\green-prechange-20261015T145641Z.pgdump.aesgcm`, 570.583 bytes, SHA-256 `d8796d123d962d0ae39ecc5b2152e26f78938a300523ed7440ef1b8a8f149046`. O manifesto registra os schemas `public` e `supabase_migrations`; AES-GCM e DPAPI CurrentUser foram verificados, o conteúdo descriptografado passou `pg_restore --list`, e o destino foi confirmado como GREEN com TLS `verify-full`. Nenhuma escrita ocorreu.
- Storage privado `learning-assets`: `%LOCALAPPDATA%\Codex\migrations\interprete-supabase\green-storage-prechange-20261015T150238088Z.aesgcm`, 4 objetos/11.092 bytes, SHA-256 `579a626b59993346e7b8e826f8cc3c5c1170ad67b9924449cc313dba56ac53b9`; inventário de metadados SHA-256 `c4b1350156dbf11c532f537baa68b7a5ed103e1b7513dad0d34f378e84dc498c`. Metadados foram comparados antes/depois da leitura, cada objeto foi conferido por tamanho e SHA-256 e o arquivo criptografado foi descriptografado e verificado em memória. Chave e manifesto usam DPAPI CurrentUser e ACL local.
- Ensaio concluído em PostgreSQL 17.11 local, loopback 127.0.0.1:54325, banco interprete_community_v2_qa, ACL do usuário Windows, senha DPAPI e TLS 1.3 com verificação do certificado. O arquivo foi descriptografado somente em memória e restaurado com pg_restore --single-transaction --no-owner, preservando ACL e RLS. As 106 tabelas e 1.486 linhas conferiram por hashes por linha com o COPY do arquivo; os 65 checksums do ledger conferiram com a branch; 104/104 tabelas de domínio mantiveram RLS. A comparação usa timezone UTC para não confundir serialização de timestamptz com diferença de dados. O helper auth.jwt oficial foi provisionado como dependência de plataforma; Realtime/Storage/API Supabase não fazem parte desse servidor local. Evidência privada: C:/Users/gabsc/AppData/Local/Codex/qa/community-v2-foundation-20261015/restore-report.json. Nenhuma conexão ao GREEN foi usada nesse ensaio. A recuperação fora do perfil Windows e a reidratação em Storage Supabase continuam sem ensaio.

### Vercel e Clerk

- A branch `codex/comunidade-v2` está publicada. Os projetos app (`prj_bwG8vDd4x2flyPaRMq8HEvi7t5Lj`) e API (`prj_LzsMnY95oPtOdp6KUwUaPRQ5lfh6`) tinham 43 overrides iniciais cada, todos exclusivos de Preview/branch. Foi acrescentado OUTBOX_QUEUE_NAMESPACE=preview nos dois projetos, e acrescentado OUTBOX_PREVIEW_MEMBER_IDS com somente as quatro identidades QA, totalizando 45 overrides de branch. O pull efetivo do app confirmou novamente GREEN, Clerk Development, namespace preview e freeze antes do build local.
- `vercel env pull` buscou os valores efetivos da branch; os 43 valores de cada projeto coincidiram com o plano esperado. Ambos apontam ao GREEN e ao par Clerk Development. `APP_WRITE_FREEZE=true`, `CRON_SECRET` vazio, seed e webhook desligados, uploads pausados e credenciais de e-mail/terceiros em branco. URLs canônicas verificados: app `https://interprete-area-de-membro-git-553be9-gabrielschuchters-projects.vercel.app`; API `https://interprete-area-de-membro-git-afba70-gabrielschuchters-projects.vercel.app`.
- Fingerprints de Production permaneceram idênticos: app `1beb15676657ebe3f7f2e6b61fbb4eabbcddacd04d9f8d692e1e8e6a18ab7b67`, API `d740ee06ecab8cbe8c1c7c035ec52c0e5840a7b2319a7f6bf3271136f50a41a9`; IDs de deployment Production também não mudaram.
- A implantação do app `dpl_3uEVkqA3r7ojbArNvUyHuiKZh8Hi`, criada antes dos overrides, não comprova o ambiente da V2. O app `dpl_3vYbK1TmMm7CJyjxSSHKj5Df9CM8` do SHA `84fb480` falhou porque o teste de `write-freeze` dependia de `APP_WRITE_FREEZE` estar ausente; o teste agora fixa temporariamente a variável vazia. O app `dpl_G1Q1VrYg1kjxvRFvYtFdFYdLmofB` e a API `dpl_6nkPwL1xUoUzGwiXcTjQktChHER3` do SHA `4c032bb` estão `READY`; a suíte local passou com freeze ativo. Após o commit documental `222b211`, os deployments do app (`interprete-area-de-membros-bycqkpa9m-gabrielschuchters-projects.vercel.app`) e da API (`interprete-area-de-membros-k5ety59rb-gabrielschuchters-projects.vercel.app`) também ficaram `READY`. A recarga do alias de branch autenticado continuou mostrando os registros existentes. Nenhum bypass Vercel foi usado.
- No inventário anterior ao provisionamento QA, Clerk Development tinha 5 usuários; GREEN tem 7 `Member`; somente 1 identidade coincide e tem papel `MEMBER`. A sessão humana dessa identidade foi concluída pelo usuário no navegador. `/comunidade` carregou conteúdo existente após autenticação (publicações, grupo, aviso e comentários), comprovando leitura do Preview conectado ao GREEN. A tentativa de `/admin/avisos` redirecionou para `/`, confirmando a negação ao papel MEMBER nesse caminho. Naquele corte, nenhuma identidade Clerk Development coincidia com `TEACHER`/`ADMIN`; nenhum usuário ou papel havia sido criado naquele corte. Os quatro vínculos QA foram adicionados depois, conforme registro abaixo; a jornada positiva de staff aguarda o resultado do browser.

### Provas autenticadas e fail-closed

- Após a sessão Vercel SSO + Clerk Development, o navegador exibiu a rota autenticada `/comunidade` e registros reais já existentes, incluindo o post fixado “Como transformar evidência em decisão mais nítida”, o grupo “Nerds da Bioestatística” e o aviso “Teste!”. A navegação/leitura e a recarga não criaram nem alteraram dados.
- Navegar por GET para o endpoint de API `/cron/outbox` e para o endpoint do app `/api/cron/activity-deadlines` retornou o código JSON `WRITE_FREEZE` e a mensagem de manutenção. São provas de bloqueio fail-closed; nenhum job foi reivindicado. Não provam recuperação de job em falha nem isolamento entre origens.
- O browser confirmou sessão autenticada como membro, não oferece prova positiva de `TEACHER`/`ADMIN`. A política continua sendo `Member.role`, nunca e-mail ou metadata Clerk.

### Isolamento de jobs

- O Preview continua com APP_WRITE_FREEZE=true, sem segredo de cron e com webhook desligado. Os endpoints consultados retornaram WRITE_FREEZE. O código novo ainda precisa ser publicado e conferido no Preview antes de ser considerado evidência remota.
- Produtores e worker usam resolveOutboxConsumerKey: Production preserva notifications.create.v1; Preview usa preview.notifications.create.v1. VERCEL_ENV=preview ativa o namespace por segurança, mesmo sem a variável explícita. Configurar namespace de Preview em Production falha antes de persistir ou reivindicar jobs.
- Ajustes/cancelamentos de lembretes filtram também a chave do consumidor, para não atingir jobs do outro ambiente quando um DomainEvent idempotente é compartilhado. Nenhuma tabela, enum ou índice novo foi criado.
- O ensaio opt-in scripts/community-v2/outbox-postgres.test.mjs rodou contra o PostgreSQL restaurado, sem mocks: claims separados, rollback dos efeitos transacionais, retry após availableAt, processo encerrado após claim durável e recuperação após lease expirar, enqueue duplicado e dois processos concorrentes com SKIP LOCKED. Todos passaram, incluindo a recusa de destinatário fora da lista antes da persistência e um job adulterado levado a DEAD sem gravar Notification. Os registros de ensaio permanecem apenas nesse banco local.
- Isso comprova o mecanismo do worker em PostgreSQL real. Não comprova entrega de notificação, Broadcast, execução periódica ou recuperação HTTP no Preview protegido.
- Notification continua compartilhada. O namespace de fila é acompanhado de validação fail-closed de ator e destinatários em OUTBOX_PREVIEW_MEMBER_IDS no produtor e no consumidor. A lista vazia também bloqueia; Production preserva a semântica anterior. Manter freeze da aplicação até publicar a proteção e verificar a entrega autenticada.

### Identidades QA e revisão automática

- O usuário delegou a escolha/preparação das contas de teste. Foram criadas quatro identidades exclusivas no Clerk Development ins_3Jn11qozddvhARaPkPLdQR6eAoo, com external_id community-v2-qa-20261015-{member-a,member-b,teacher,admin}, e-mails de teste +clerk_test@example.com e metadata privada de fixture. Nenhuma mensagem/e-mail foi solicitado e nenhuma conta existente ou instância Production foi alterada.
- A revisão automática inicialmente bloqueou o vínculo GREEN. Após o usuário autorizar explicitamente essas inserções, a transação serializável criou/verificou quatro Members (MEMBER, MEMBER, TEACHER, ADMIN), quatro Profiles com showInDirectory=false e um DomainEvent de auditoria. Os hashes dos sete Members e sete Profiles preexistentes conferiram antes/depois. Nenhum job de notificação foi criado e nenhum papel real mudou. Evidência privada: green-qa-provision-report.json no diretório QA.
- Ledger privado das identidades criadas: C:/Users/gabsc/AppData/Local/Codex/qa/community-v2-foundation-20261015/clerk-qa-ledger.json. Os papéis acima estão persistidos em Member; metadata Clerk não concede autoridade.

## Preview e runtime no corte do Estágio 00

- Na auditoria original, o Preview redirecionava para SSO Vercel e respondia HTML 200; isso não provava `/health` nem Clerk autenticado.
- A produção respondeu 200 nos health checks da aplicação e da API contra GREEN.
- Naquele corte, as variáveis Vercel não tinham sido lidas; os ambientes locais apontavam para BLUE e não serviam para Preview V2. A configuração específica da branch e a comparação de valores estão agora registradas acima.
- A infraestrutura de outbox existe e está ativa. O isolamento foi implementado/testado localmente nesta etapa; QA mutável continua condicionado à publicação desse código, restrição de destinatários e identidades QA autorizadas.

## Verificações executadas e limites

- O protótipo foi navegado nos sete fluxos guiados; os 53 pares HTML/PNG foram examinados. Comparação visual de release ainda não existe.
- O resolvedor de @todos foi executado isoladamente com banco falso em memória; nenhum dado externo foi alterado.
- Oito arquivos focados, total de 22 testes, passaram pelo entrypoint Node/Vitest no checkout auditado. O checkout de teste estava em a4b68b8, não em b6028a3; isso não prova a suíte da main nem runtime autenticado.
- Uma tentativa usando Bun direto falhou em dois arquivos por interoperabilidade de import Zod no executor. A execução Node/Vitest passou; nenhuma mudança foi feita para contornar esse comportamento.
- No código atual do worktree V2, passaram check, typecheck (16 tarefas), boundaries (888 arquivos), test (app 779, API 9, domínio 24, scripts 32 com 1 skip), build completo (8 tarefas) e performance:check. O build local usou exclusivamente o ambiente efetivo da branch Preview, guardado para GREEN, Clerk Development, namespace preview e freeze. A geração do Prisma Client não aplica migrations.
- O primeiro build com variáveis Preview detectou uma expectativa ambiental implícita em events.test.ts; o teste agora fixa o ambiente Production antes de cada caso e testa Preview explicitamente. A repetição completa do build passou.
- O gate mediu Comunidade em 213,4 KiB gzip sob o teto de 225 KiB. O novo ensaio CLI local permanece opt-in e valida seu alvo loopback/TLS antes de conectar; sua versão final passou no runner Bun contra PostgreSQL real, cobrindo nove invariantes. O build final com a proteção de audiência passou em sequência (8/8 tarefas); os timeouts anteriores ocorreram durante suítes concorrentes e não exigiram aumentar limites de testes. Percentis reais, QA visual, Broadcast e papéis staff no Preview não foram comprovados por esses checks.

## Bloqueios e riscos que permanecem

1. A restauração de domínio foi verificada localmente. A recuperação em outra máquina depende de chave recuperável fora do DPAPI deste perfil; Storage/Realtime/cron da plataforma não foram reidratados no ensaio local.
2. Os quatro vínculos QA já existem com autorização explícita. A prova autenticada de TEACHER/ADMIN, dois alunos e visitante no Preview está em execução.
3. O worker foi exercitado com falha e concorrência reais em PostgreSQL local. Faltam processamento, entrega e recuperação no Preview protegido usando a infraestrutura existente.
4. GREEN e Notification são compartilhados. A lista explícita QA já é validada pelo produtor/consumidor e foi exercitada em PostgreSQL real. Manter freeze até essa versão estar publicada e a entrega ser comprovada.
5. O namespace e a proteção de destinatários estão publicados nos deployments `b747ed8` App/API `READY`. A alteração recente de `APP_WRITE_FREEZE=false` exige novo deployment App para ativar login. Nunca voltar um Preview gravável a código que usa a chave legada.
6. Enum novo pode dificultar rollback; não gravar MODERATOR antes de todos os consumidores estarem compatíveis. Nenhum schema V2 foi antecipado.
7. Tokens, notificações privadas, REST legado, OG e caches precisam revalidar permissão após revogação.
8. Preservar os bytes de Storage anteriores; o ensaio de reidratação no bucket continua pendente.
9. Reconciliar a unicidade de título por proprietário com o board de nomes repetidos antes de alterar índices/dados.

## Próximo passo

O isolamento está publicado em App/API. O novo override App false aguarda deployment. Concluir login/papéis, ativar e validar a recuperação preview pelo worker existente, e em seguida restaurar o freeze até haver execução controlada da próxima etapa. Etapa 01 permanece IN PROGRESS; nenhuma funcionalidade visual V2 ou migration começa antes dos gates.

### Diagnóstico da ativação de sessão com freeze

O browser de QA alcançou o Preview protegido usando OIDC temporário do mesmo projeto e carregou Clerk Development. No deployment ainda configurado com freeze, o helper oficial criou a tentativa de sessão, mas a ativação ficou esperando o POST de invalidateCacheAction do SDK Next.js, respondido com 503. O override da branch App foi então alterado para `APP_WRITE_FREEZE=false`; o novo deployment ainda não foi criado. API continua freeze true. O código instalado confirma que esse callback espera o Server Action sem tratar sua rejeição. A leitura humana com sessão já ativa continua sendo evidência válida; o fluxo de login novo durante manutenção não foi comprovado. Não abrir exceção genérica de POST em /sign-in, pois Server Actions de produto também podem ser despachadas por essa rota. Publicar/conferir primeiro namespace e audiência QA; preparar depois uma janela controlada de QA com a configuração de escrita apropriada, mantendo Production intacta. A restrição temporária da revisão automática de permissões foi revalidada e a leitura seguinte executou normalmente.
