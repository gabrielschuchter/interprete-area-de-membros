# Comunidade V2 — status da auditoria

**Estado:** Estágio 00 concluído; Estágio 01 em andamento. Backup GREEN e overrides Preview da branch estão verificados; falta validar um deployment criado com esses overrides e comprovar uma sessão humana Clerk.
**Atualizado:** 15/10/2026 15:20 UTC.
**Branch e base:** `codex/comunidade-v2`, a partir de `origin/main` em `b6028a37a358c0ff1d45d19297c5454318c799a3`; branch remota publicada.
**Próximo passo:** disparar e validar o deployment atualizado da branch, testar proteção Vercel e obter sessão de membro existente no Clerk Development. Não iniciar QA mutável.

## Escopo e integridade

- Handoff examinado integralmente: HANDOFF.md, 53 boards HTML e PNG, protótipo navegável, tokens, fontes de assets e sete fluxos guiados.
- Pacote entregue: C:/Users/gabsc/Downloads/files nova comunidade.zip
  SHA-256: 5C570782C1EA270DFD3514C0BEA39A4A6A8BEECDAD2E05EAFBFC8D1E7F515C44
- Protocolo de decisões: D:/roteiro-codex-comunidade-v2.md
  SHA-256: F9C6D5E4F657D320BA856D97DC31F489425FE3546B6E2BB303DE81CFC46C62E
- AGENTS.md, schema Prisma, código da main, Gestao V2, Inicio B2, editor, notificações, uploads, perfil, timers e consultas de estudo foram auditados. A fonte de implementação parte da main; o checkout original estava atrás da main.
- O checkout original permanece inalterado: branch `codex/interprete-member-area-release-2026-10-04`, HEAD `a4b68b81dc084d6de4648c488a0442e14cfb0539`, com 8 arquivos rastreados modificados e 9 não rastreados preexistentes. Nenhum foi copiado, limpo ou sobrescrito.
- O worktree V2 parte de `b6028a3`. Até agora só foram alterados os quatro documentos desta auditoria; não houve mudança funcional, migration, escrita no GREEN, alteração de configuração Production ou publicação.

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

**Estado:** backup e isolamento de ambiente concluídos; deployment e autenticação humana ainda aguardam prova. Nenhuma migration ou escrita no GREEN foi feita.

### Backup manual GREEN

- PostgreSQL: `%LOCALAPPDATA%\Codex\migrations\interprete-supabase\green-prechange-20261015T145641Z.pgdump.aesgcm`, 570.583 bytes, SHA-256 `d8796d123d962d0ae39ecc5b2152e26f78938a300523ed7440ef1b8a8f149046`. O manifesto registra os schemas `public` e `supabase_migrations`; AES-GCM e DPAPI CurrentUser foram verificados, o conteúdo descriptografado passou `pg_restore --list`, e o destino foi confirmado como GREEN com TLS `verify-full`. Nenhuma escrita ocorreu.
- Storage privado `learning-assets`: `%LOCALAPPDATA%\Codex\migrations\interprete-supabase\green-storage-prechange-20261015T150238088Z.aesgcm`, 4 objetos/11.092 bytes, SHA-256 `579a626b59993346e7b8e826f8cc3c5c1170ad67b9924449cc313dba56ac53b9`; inventário de metadados SHA-256 `c4b1350156dbf11c532f537baa68b7a5ed103e1b7513dad0d34f378e84dc498c`. Metadados foram comparados antes/depois da leitura, cada objeto foi conferido por tamanho e SHA-256 e o arquivo criptografado foi descriptografado e verificado em memória. Chave e manifesto usam DPAPI CurrentUser e ACL local.
- Os artefatos ficam fora do repositório. A restauração não foi ensaiada. O procedimento é: recuperar a chave DPAPI no mesmo perfil Windows; validar hash e autenticação AES-GCM; restaurar PostgreSQL 17 em um projeto Supabase isolado e vazio com TLS `verify-full`; reidratar os objetos no bucket privado sem sobrescrever nomes; conferir checksums do ledger, dados/RLS e contagens. Nunca usar o GREEN compartilhado como alvo de ensaio. Como a chave DPAPI depende do perfil Windows local, uma cópia fora desta máquina ainda é necessária para recuperação de desastre.

### Vercel e Clerk

- A branch `codex/comunidade-v2` está publicada. Os projetos app (`prj_bwG8vDd4x2flyPaRMq8HEvi7t5Lj`) e API (`prj_LzsMnY95oPtOdp6KUwUaPRQ5lfh6`) têm 43 overrides cada, todos com `target=[preview]` e `gitBranch=codex/comunidade-v2`.
- `vercel env pull` buscou os valores efetivos da branch; os 43 valores de cada projeto coincidiram com o plano esperado. Ambos apontam ao GREEN e ao par Clerk Development. `APP_WRITE_FREEZE=true`, `CRON_SECRET` vazio, seed e webhook desligados, uploads pausados e credenciais de e-mail/terceiros em branco. URLs canônicas verificados: app `https://interprete-area-de-membro-git-553be9-gabrielschuchters-projects.vercel.app`; API `https://interprete-area-de-membro-git-afba70-gabrielschuchters-projects.vercel.app`.
- Fingerprints de Production permaneceram idênticos: app `1beb15676657ebe3f7f2e6b61fbb4eabbcddacd04d9f8d692e1e8e6a18ab7b67`, API `d740ee06ecab8cbe8c1c7c035ec52c0e5840a7b2319a7f6bf3271136f50a41a9`; IDs de deployment Production também não mudaram.
- Há uma implantação do app (`dpl_3uEVkqA3r7ojbArNvUyHuiKZh8Hi`) criada antes dos overrides, estado `READY`. Ela não comprova o ambiente da V2 e não deve ser usada. A implantação API daquela tentativa foi cancelada. A próxima atualização de branch deve criar deployments com os overrides já verificados; o SSO Vercel e a autenticação Clerk devem ser testados separadamente. Nenhum bypass foi usado.
- Clerk Development tem 5 usuários; GREEN tem 7 `Member`; somente 1 identidade coincide e tem papel `MEMBER`. Nenhuma coincide com `TEACHER` ou `ADMIN`. Não foram criados usuários, papéis ou sessões. A sessão humana Clerk ainda não foi comprovada; validação positiva de staff continua pendente para o QA por papel.

### Isolamento de jobs

- O Preview está somente leitura: o proxy bloqueia métodos mutáveis por `APP_WRITE_FREEZE`, cron não recebe segredo e o webhook Clerk está desligado. Isso evita novos jobs das rotas bloqueadas durante a preparação.
- O worker de Production continua ativo. O consumidor atual reivindica jobs elegíveis por uma chave compartilhada, e `dispatchPendingNotifications` no app também pode executar o consumidor. Portanto, desligar cron no Preview não isolaria jobs criados por mutações do app. Antes de liberar escrita Preview que produza outbox, será obrigatório adicionar discriminação de origem/ambiente e provar que os dois caminhos não reivindicam jobs do outro ambiente.

## Preview e runtime no corte do Estágio 00

- Na auditoria original, o Preview redirecionava para SSO Vercel e respondia HTML 200; isso não provava `/health` nem Clerk autenticado.
- A produção respondeu 200 nos health checks da aplicação e da API contra GREEN.
- Naquele corte, as variáveis Vercel não tinham sido lidas; os ambientes locais apontavam para BLUE e não serviam para Preview V2. A configuração específica da branch e a comparação de valores estão agora registradas acima.
- A infraestrutura de outbox existe e está ativa; permanece a incompatibilidade potencial entre eventos de Preview e o consumidor global de Production, que bloqueia QA mutável.

## Verificações executadas e limites

- O protótipo foi navegado nos sete fluxos guiados; os 53 pares HTML/PNG foram examinados. Comparação visual de release ainda não existe.
- O resolvedor de @todos foi executado isoladamente com banco falso em memória; nenhum dado externo foi alterado.
- Oito arquivos focados, total de 22 testes, passaram pelo entrypoint Node/Vitest no checkout auditado. O checkout de teste estava em a4b68b8, não em b6028a3; isso não prova a suíte da main nem runtime autenticado.
- Uma tentativa usando Bun direto falhou em dois arquivos por interoperabilidade de import Zod no executor. A execução Node/Vitest passou; nenhuma mudança foi feita para contornar esse comportamento.
- Não foram executados os seis checks completos, testes de banco com escrita, percentis, comparação real de screenshots da aplicação ou jornadas Clerk autenticadas. Não declarar esses gates concluídos.

## Bloqueios e riscos que permanecem

1. A integridade dos backups foi verificada, mas a restauração completa não foi ensaiada; os artefatos dependem do DPAPI do perfil Windows local.
2. A branch agora tem variáveis GREEN/Clerk Development corretas, mas o deployment app atual foi criado antes delas. O próximo deployment precisa ficar `READY` com os valores verificados antes do teste de login.
3. A sessão Clerk Development humana não foi comprovada. Há uma identidade `MEMBER` compartilhada com o banco, mas não foi validado o acesso interativo; nenhum usuário Clerk Development corresponde a `TEACHER`/`ADMIN`.
4. GREEN é compartilhado. A escrita permanece congelada até definir identidades e escopo de QA autorizados e impedir que o worker Production reivindique outbox originado no Preview.
5. O consumer imediato no app e o cron global podem disputar a mesma chave de outbox. Desligar apenas o cron do Preview não é suficiente; antes de menções, convites ou avisos mutáveis, a origem precisa ser isolada nos produtores e consumidores.
6. Enum novo pode dificultar rollback a código antigo; usar flags compatíveis e não gravar `MODERATOR` antes de todos os consumidores estarem compatíveis.
7. Tokens, notificações privadas, REST legado, OG e caches devem revalidar permissão após revogação.
8. Os bytes de Storage estão incluídos no backup; a reidratação deles também não foi ensaiada. Não apagar objetos antigos na primeira implementação.
9. A unicidade de título atual por proprietário e o board de criação com nome repetido precisam ser reconciliados antes de alterar índice/dados.

## Próximo passo

Atualizar e publicar este registro para disparar um novo deployment da branch; aguardar `READY`, verificar SSO Vercel e autenticar com o membro Clerk Development existente. Confirmar que a página lê o GREEN e que a escrita continua bloqueada, sem alterar dados. O Estágio 01 só fecha após essas provas. Não iniciar migrations ou QA mutável até existir isolamento de escrita e outbox.
