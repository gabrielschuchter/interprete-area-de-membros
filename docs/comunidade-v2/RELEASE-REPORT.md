# Comunidade V2 — resultado do go-live

## Etapa 12B publicada — 26/10/2026, 15:48 UTC

**PUBLICADO em Production.** O App e a API corretos estão READY, os domínios
públicos servem os artifacts compatíveis e a manutenção foi retirada desses
aliases. O App candidato é SHA 1c57191542316654cc3b2da1f21e3f5474529408,
deployment dpl_5T61v53srxCJnkc9ffC29W3jzB1x; os aliases
https://interprete-area-de-membros.vercel.app e
https://interprete-area-de-membros-app.vercel.app apontam para ele. A API é SHA
660595b1a83a0fec343207a35dcf09256709499a, deployment
dpl_5975utnkeZVCrQXyXUEAyk7UUNRW; o alias
https://interprete-area-de-membros-api.vercel.app está ativo e /health respondeu
OK. A integração Git da Vercel permanece desconectada intencionalmente ([estado consolidado](evidence/production-release-20261026.json)).

O host guard ativo está na versão 5: libera somente os deployments compatíveis
verificados e os aliases públicos, mantendo a negação para hosts restantes.
As regras Trusted Source temporárias de QA foram restauradas ao baseline;
SSO, Clerk, RLS e isolamento de namespaces continuam ativos.

O smoke pós-promoção autenticado usou um dos usuários QA controlados, sem
bypass de Deployment Protection e sem impersonar membro real. Clerk confirmou
a identidade; /comunidade, /comunidade/grupos e /comunidade/salvos responderam
sem erro; resumo de notificações permaneceu private/no-store, token Realtime
ficou vinculado ao usuário autenticado e o canal privado recebeu SUBSCRIBED.
O App teve zero respostas 5xx e zero erros de página durante o smoke
([evidência](evidence/production-public-auth-smoke-20261026.json)). A API

O smoke de quatro atores também comprovou autorização por papel, criação do grupo privado, bloqueio do membro não autorizado, persistência da publicação e arquivamento do grupo. A primeira rodada terminou na etapa de notificações antes do reparo; o smoke público e o probe direto de badge posteriores fecharam esses itens. [Evidência de componentes](evidence/production-smoke-20261026.json). A reconciliação final encontrou zero avisos QA ativos ([cleanup](evidence/production-qa-cleanup-reconciliation-20261026.json)).
/health foi aberta no domínio público real.

O cron interprete-member-outbox permanece ativo em */5 * * * *. Um job QA
enfileirado antes do vencimento foi recuperado pelo scheduler Production sem
POST ou execução manual de worker; criou a notificação somente para o membro
selecionado, com isolamento de namespace e destinatário. Separadamente, a ação
real de publicação no Admin confirmou a atualização imediata do badge do
destinatário, nenhum badge dos não destinatários mudou e o estado persistiu
após reload
([recuperação automática](evidence/production-scheduler-realtime-repro-20261026.json),
[badge e persistência](evidence/production-realtime-badge-probe-20261026.json)).
O probe do scheduler registrou falha apenas na observação de Broadcast/badge:
ele não capturou frames nem salvou os valores do DOM; por isso não é usado como
prova de badge. A medição direta da UI subsequente passou. A publicação
realtime.messages agora integra supabase_realtime sem mudança de grants ou
policies RLS ([reparo](evidence/realtime-publication-repair-20261026.json)).
Os ciclos Production de 15:35, 15:40 e 15:45 UTC terminaram succeeded. Na janela
de 15 minutos até 15:48 UTC, o App registrou 50 requests (37 status 200, 6
status 304 e 7 redirecionamentos 307), a API registrou quatro status 200, e
ambos tiveram zero respostas 5xx e zero entradas de erro nos logs Vercel. A
consulta de request logs não expôs percentis de latência; não há alegação de p95
pós-release.

As 13 migrations V2 seguem aplicadas no GREEN, com 78 entradas de ledger,
integridade preservada e sem drift. O backup T0 e o fallback compatível foram
restaurados e validados em destino isolado; Production permaneceu no GREEN e BLUE continuou congelado. Os dois posts legados sem
proveniência continuam UNRESOLVED e privados. Os quatro usuários QA
controlados foram desativados após o smoke, com papéis MEMBER e perfis ocultos;
zero linhas de membros reais foram alteradas ([retirada QA](evidence/production-qa-retirement-20261026.json)). A evidência consolidada é [production-release-20261026.json](evidence/production-release-20261026.json).

## Snapshot anterior à promoção — 26/10/2026, após migrations de 10:54 UTC

**Etapa 12B em execução; manutenção ativa, membros ainda não liberados.** O
candidato de runtime é `660595b1a83a0fec343207a35dcf09256709499a`. App e API
Production principal e fallback estão READY, preparados sem atribuição dos
domínios públicos. Os aliases ainda apontam para as versões anteriores, agora
barradas pela regra WAF nos dois projetos. Requisições autenticadas por OIDC
confirmaram 403 nos aliases, leitores imutáveis antigos e Preview; apenas os
artefatos compatíveis selecionados responderam 200. Evidência:
[manutenção](evidence/maintenance-20261026.json).

A recuperação independente de banco e bytes Storage, o ensaio das 13 migrations
até 78 entradas e o runtime do fallback no destino restaurado foram comprovados.
O Preview confirmou JWT Clerk válido, assinatura no tópico privado próprio e
negação do tópico alheio. O scheduler GitHub acumula 14 sucessos automáticos,
mas recovery de job, Broadcast recebido e badge remoto persistido continuam
pendentes. O T0 de 10:50 UTC foi decifrado independentemente em Linux e restaurado
no destino novo: 106 tabelas/1.513 linhas conferidas por hash, quatro objetos
Storage/11.092 bytes, metadados corretos e acesso público negado. As 13 migrations
foram aplicadas no GREEN: 78 entradas completas, zero drift/pendências. Os 31
posts e 23 notificações existentes foram preservados; os dois publicados sem
proveniência continuam UNRESOLVED. Grants de Notification revogados, zero tabelas
de domínio sem RLS e zero constraints não validadas. Timeouts nativos 2s/60s
foram comprovados durante a execução e os defaults anteriores restaurados.
Evidências: [T0](evidence/t0-restore-20261026.json),
[migrations](evidence/green-migrations-20261026.json) e
[timeouts](evidence/migration-native-timeouts-20261026.json).

As seções anteriores abaixo são históricas onde contradizem esta execução.
Não há declaração de GO ou de publicação concluída neste checkpoint.

## Atualização final — 24/10/2026 — diagnóstico 401 seguro

**Release permanece NO-GO.** O run automático `40068889714` (SHA `bb923227`) chegou até a requisição Preview, com todos os nove checks OIDC aprovados, mas recebeu HTTP 401. Um rerun diagnóstico explícito (attempt 2, job `120837090924`), sem ser apresentado como prova de recuperação periódica, reproduziu o mesmo resultado em 24/10 às 09:26Z. Na consulta imediata à Vercel não apareceram logs do handler; ausência de logs não distingue SSO de rejeição silenciosa pela aplicação.

**Correções efetuadas nesta etapa, exclusivamente no workflow `main`:**
- Commit `5148c107`: passou a registrar somente status HTTP, exit do curl e classe de Content-Type (`json`, `html`, `other`).
- Commit `2533c8cf`: resposta 401 é classificada localmente como `application_cron_auth` apenas quando o corpo JSON corresponder exatamente ao erro de autorização da rota. O corpo é mantido em arquivo temporário de permissão restrita, removido no exit e nunca impresso. Sem segredos ou tokens em logs.
- O workflow não executou ainda em schedule com esses dois commits: não afirmar que a causa do 401 foi resolvida.
- App/API seguem desconectados da integração Git; os aliases Production verificados permanecem em App `dpl_Fa3QgVNzB9tP3x5cbquaF1kMQt3g` (SHA `de12af7`) e API `dpl_XQRUb541CcFFTLhGodnXokBtDMcc` (SHA `6c7b49a`), sem promoção desta missão.
- `CRON_SECRET` existe como secret sensível no Vercel Preview vinculado a `codex/comunidade-v2`, mas a integração não revela seu valor; tampouco permite ler o valor do segredo do environment GitHub. Não foi possível comprovar igualdade, e nenhum segredo foi substituído.
- A conexão Supabase expõe somente o projeto antigo inativo `wkclodjbrynerfgufmyb`, e acesso explícito ao GREEN `qffqhilydtnrggbcnogh` retornou **permission denied**. Nenhuma migration, restore, reclassificação de post ou alteração no GREEN foi executada.

**Ponto de decisão:** esperar o próximo evento automático já instrumentado para classificar o 401; a resolução exige acesso autenticado que permita ajustar apenas o secret Preview ou a Trusted Source Preview conforme a camada demonstrada. Para liberar 12B continuam indispensáveis fonte autoritativa dos dois posts publicados, ensaio independente de restore banco/Storage e rollback compatível. Nenhuma dessas garantias foi inventada nem removida do gate.

## Rechecagem de execução — 24/10/2026 — OPS-01 HTTP 401

**Estado: NO-GO; nenhuma operação de Production ou GREEN foi executada nesta rechecagem.**

- O GitHub Actions executou automaticamente o schedule [#52](https://github.com/gabrielschuchter/interprete-area-de-membros/actions/runs/40068889714), run `40068889714`, SHA de main `bb92322703e017e9d633074784f9d883392d8599`, em 24/10 às 06:06 UTC. Os **nove** checks booleanos OIDC foram true, inclusive subject imutável. A chamada `POST /cron/outbox` ao Preview retornou **HTTP 401** (`curl_exit=22`). Não houve prova de recuperação, entrega, Broadcast ou badge.
- O 401 **não foi localizado com segurança**: pode decorrer da proteção Trusted Sources da Vercel ou da autenticação própria do endpoint, que responde 401 quando `CRON_SECRET` não confere. A variável `CRON_SECRET` consta no catálogo de metadados do Preview da API, mas seu valor não foi lido, comparado nem alterado. O GitHub não expõe o valor do segredo equivalente. Logs de runtime no horário do evento estão fora da retenção disponível nesta sessão; consulta dos 30 minutos mais recentes não permite classificar o evento antigo.
- A alias Preview da API usada pelo scheduler resolve o deployment READY `dpl_BLNMNrdxd5ZjVjUUsRGUA5GGRwKr`, SHA `80f6c13`, que difere do candidato de código `4e026b59` registrado no preflight. Alinhar o artefato requer estratégia de deploy isolado e as demais garantias, não mudança de alias sem controle.
- O inventário Vercel atual indica Production da API SHA `6c7b49a` e alias principal do App associada a um deployment Production SHA `de12af7` (outra frente, Gestão); revalidar ambos como baseline no eventual rollout. Os dois projetos App/API não aparecem como Git-linked no contexto conectado, coerente com a desconexão documentada.
- A integração Supabase acessível nesta sessão lista somente um projeto **inativo e distinto**, não o GREEN ativo referido no plano. Por isso não foi possível fazer preflight/migrations/restore reais no GREEN por esta conexão, e nenhum projeto alternativo foi utilizado.
- Permanecem bloqueios de release: duas publicações PUBLISHED com proveniência não demonstrada, restauração independente do banco/Storage não aprovada, fallback/leitores antigos não comprovados e onze migrations V2 ainda não liberadas. Não classificar registros como globais por inferência; não promover tráfego antes dessas condições.

**Próxima ação mínima de OPS-01:** na próxima execução agendada, distinguir 401 de proteção externa versus endpoint de cron por metadados **sanitizados** de resposta/logs no período de retenção, sem imprimir token, segredo, body, headers completos ou conteúdo privado. Se for o endpoint, sincronizar o segredo por mecanismo seguro e controlado; se for Deployment Protection, reparar a regra exata sem bypass amplo. Só fechar OPS-01 após recovery automático QA namespaced, Broadcast/Realtime e contagem/badge persistentes. Não usar POST manual para substituir a evidência.


**Resultado: B — RELEASE BLOQUEADO COM SEGURANÇA.** Revisão encerrada em
24/10/2026. Nenhuma migration, escrita de produto, alteração de tráfego,
promoção ou deployment Production foi executado nesta etapa. O Supabase GREEN
permanece compartilhado por Preview/Production; BLUE continua congelado.

## O que foi resolvido

O scheduler falhava antes de chamar a API porque o GitHub emitia subject OIDC
imutável e o guard/Trusted Source exigiam o formato anterior. O repositório
confirma `use_immutable_subject=true`; o workflow e a Trusted Source **somente
da API Preview** agora exigem o subject imutável exato:

`repo:gabrielschuchter@291341266/interprete-area-de-membros@1386145986:environment:community-v2-preview`

O PR [#17](https://github.com/gabrielschuchter/interprete-area-de-membros/pull/17)
foi integrado em `main` no commit
`1586ed53240dd533dd3a38bc244ed49cfabf31ae`. Foram preservadas as restrições de
issuer, audience, repositório, branch `main`, workflow exato, evento
`schedule` e ambiente `community-v2-preview`; `use_immutable_subject` continua
ativo. A política salva se aplica somente ao Preview da API. Production,
Clerk, cron GREEN, credenciais, segredos e políticas globais não foram
alterados.

Antes do merge, as configurações efetivas da Vercel foram recarregadas e
confirmaram que os projetos App e API não estavam conectados a um repositório
Git. Essa proteção impediu deployment Git automático durante a integração e
ambos continuam desconectados. Não houve deploy manual. O último inventário
das listas de deployments foi atualizado após o PR #17: os aliases Production
continuam apontando para App SHA
`7a7c8e4d0167490308f54bb8d79b3577c2f0aaa6` e API SHA
`6c7b49a3fecab3bda8e2f6ad41789972ad711dd9`, ambos listados como Ready. Não há
deployment de `1586ed5` nessas listas. O commit mesclado alterou apenas o
workflow, e nenhuma implantação manual foi solicitada ou realizada.

## Gates que impedem GO

| Gate | Estado comprovado | Por que bloqueia | Menor próximo passo seguro |
|---|---|---|---|
| OPS-01 — schedule/outbox | Correção OIDC publicada. As consultas até `03:01Z` ainda retornavam como último run `40049295827`, falha no SHA antigo `b5a2f06`, anterior à correção. Nenhum run com `1586ed5` foi observado. | Configuração alinhada não prova autenticação aceita nem recovery. Não há prova real de job `preview.*`, isolamento/dedupe, Broadcast/Realtime ou unread/badge. | Aguardar um schedule automático pós-`1586ed5`. Se passar, acompanhar um job QA isolado criado no namespace `preview.*` até persistência, emissão/recepção Broadcast e badge após reload; não usar dispatch, rerun ou chamada manual como substituto. |
| Proveniência legada | GREEN contém 28 posts sem grupo: 8 DRAFT, 2 PUBLISHED, 18 ARCHIVED. Busca read-only não encontrou DomainEvent para os dois PUBLISHED sem `spaceId`. O snapshot de origem de 14/10 registra 31 CommunityPost, 2 CommunitySpace e 1 DomainEvent, mas guarda só hashes por linha, sem valores de colunas. | A migration de escopo preserva esses registros como `UNRESOLVED`, deixando dois conteúdos publicados indisponíveis na V2. O snapshot disponível não permite reconstruir a origem/grupo e não há evidência para classificá-los como globais. | Obter fonte/proveniência autoritativa dos dois registros e reconciliar revisado; se não existir, obter decisão explícita de mantê-los indisponíveis. Não alterar conteúdo nem classificá-los por suposição. |
| Migrations e integridade | GREEN em PostgreSQL 17.11; 65 migrations completas, zero incompletas e 11 migrations V2 pendentes, sem drift informado no preflight. A consulta atual confirmou o ledger aplicado, mas não aplicou SQL. | As migrations não foram ensaiadas em GREEN sob freeze/limites reais de lock. A migration 1300 mantém 28 posts ambíguos como `UNRESOLVED`; a sequência de audiência deve permanecer sem leitores incompatíveis entre os passos. | Resolver proveniência/decisão acima, repetir somente os contadores T0 e lock prechecks no início da janela; aplicar a sequência exata já listada em [RELEASE-PLAN.md](RELEASE-PLAN.md#ordem-das-11-migrations-e-riscos), interrompendo em drift, lock ou contagem divergente. |
| Notification / Data API | RLS está ativo; `anon SELECT=false`, mas `authenticated SELECT=true`. | O grant autenticado ainda permite acesso direto pela Data API. RLS por destinatário não substitui o grant `REVOKE` aprovado. A negação com JWT Clerk válido não foi provada. | Aplicar a migration 1100 durante a janela depois de aprovar os gates; conferir grants/RLS no catálogo e testar negação PostgREST com JWT válido, além do acesso autorizado pela API. |
| Backup PostgreSQL | Dump novo foi reaberto, hash conferido e listado por `pg_restore`; envelope usa DPAPI do perfil Windows atual. A tentativa 1 em container PostgreSQL 17.11 descartável passou a listagem do archive, mas `pg_restore` encerrou com código 1. A tentativa 2 tentou preparar outra instância isolada com roles/schema-only de autenticação lidos da QA local, mas falhou no bootstrap de roles antes do restore. Ambos os containers foram removidos. | Nenhum restore foi comprovado. As falhas sanitizadas não permitem atribuir causa ao artefato; não se declara corrupção nem recuperação efetiva. A chave também não foi demonstrada fora do perfil atual. As duas abordagens locais foram encerradas sem tocar QA, GREEN ou BLUE. | Usar um destino Supabase/PostgreSQL isolado, plenamente inicializado e com acesso aprovado a chave recuperável por operador/host independente; restaurar o snapshot e conferir ledger, contagens e referências. Nunca usar GREEN ou BLUE como alvo de ensaio. |
| Storage / capas | Quatro objetos privados, total 11.092 bytes, foram baixados e os hashes do snapshot conferidos. Bucket `learning-assets` é privado. | Os bytes ainda não foram reidratados em Storage isolado nem lidos/revogados pela aplicação V2. Metadados de banco não recuperam bytes. | Reidratar os quatro objetos em bucket isolado autorizado e conferir hashes, metadados e referências por leitura autenticada da aplicação. |
| Rollback / leitores antigos | `APP_WRITE_FREEZE` pausa mutações e cron/webhook; `UPLOADS_PAUSED_FOR_ROLLBACK` pausa uploads. | Flags não retiram leitura. Não há inventário certificado de todos os deployments imutáveis, consumidores e leitores antigos, nem fallback remoto compatível ensaiado para o schema final. Downgrade para código antigo após migrations de audiência pode expor/interpretar incorretamente dados. | Inventariar e retirar do caminho de leitura todos os SHAs antigos, preparar e ensaiar em alvo isolado um artefato App/API que compreenda o schema final, enums, namespaces e escritas posteriores. Sem isso, manter manutenção e corrigir por avanço compatível. |
| Vercel / Clerk / proteções | Projetos App/API permanecem sem Git conectado. Trusted Source da API Preview salva com escopo e claims restritos. Proteção SSO observada anteriormente em ambos. | Deployments READY ou proteção SSO não comprovam runtime V2. Autenticação remota por papéis, Clerk, flags/consumers efetivos, crawler protegido e leitores imutáveis não foram validados após a migração. | Com os gates de dados/restore aprovados, executar o smoke autenticado em Preview protegido para App/API, permissões, share SSR/OG/crawler e Storage; conferir configurações de runtime dos deployments selecionados sem reconectar Git automaticamente. |
| Operação / desempenho | Evidência local anterior de responsividade e bundles pode ser reutilizada dentro do seu limite. | Não há percentis autenticados representativos após migrations nem observação do cron, disponibilidade, erros e consumo de fila em produção. | Depois do deploy coordenado e smoke aprovado, observar pelo menos 15 minutos/três ciclos como define o plano, além dos orçamentos autenticados desktop/mobile. Interromper por falha de auth, vazamento, perda/divergência, job DEAD, cross-namespace ou timeout de lock. |

## Estado de Production e sequência de retomada

Não foram aplicadas migrations, alterados aliases/domínios, habilitados cron ou
consumers, reconectado Git, alteradas credenciais ou movido tráfego. GREEN não
recebeu escrita nesta execução; BLUE não foi tocado. O deployment Vercel `READY`
existente não foi usado como prova de release.

Retomar a Etapa 12B apenas depois de remover os bloqueadores de dados e de
recuperação. Dentro da janela autorizada e mantendo App/API em manutenção:

1. Confirmar proveniência/decisão sobre os dois posts, conferir o SHA/artifact
   e o inventário de leitores e validar restore independente de banco e Storage.
2. Fazer backup coordenado e repetir contagens T0. Aplicar as 11 migrations na
   ordem da tabela do [plano](RELEASE-PLAN.md#ordem-das-11-migrations-e-riscos),
   com limites de lock/statement e sem abrir escritores antigos entre as
   migrations corretivas de audiência. Confirmar ledger, checksum, RLS e grants.
3. Fazer deploy do API compatível e depois App compatível em Production usando
   artefatos imutáveis conferidos; manter a manutenção até ambos servirem os
   SHAs previstos. Remover rotas/consumers antigos inclusive por URLs
   imutáveis. Não reconectar a integração Git para esse passo.
4. Executar smoke real de identidade/autorização, grupos, convites,
   compartilhamentos, anúncios, metas, notificações, capas/Storage e
   SSR/OG/crawler. Só depois ativar consumer/outbox canônico e abrir escrita/
   tráfego, mantendo `preview.*` isolado.
5. Validar pelo menos três ciclos automáticos, recuperação namespaced,
   Broadcast/Realtime, contagens/badge após reload, disponibilidade, erros e
   percentis. Se algum gate falhar, manter ou reativar manutenção e usar apenas
   fallback compatível ensaiado, preservando escritas posteriores.

## Evidências e limites

As observações remotas de banco foram somente leitura e agregadas; nenhum
conteúdo ou ID dos posts foi registrado. A consulta de DomainEvent encontrou
zero correspondências aos dois posts publicados sem grupo. A leitura local do
snapshot DPAPI limitou-se ao formato, contagens e nomes de tabelas/colunas
disponíveis; nenhum hash de identidade, conteúdo ou linha foi exibido. O ensaio
de restore usou somente container novo e descartável e não alterou QA, GREEN ou
BLUE. Não foram impressos tokens, headers, corpos privados, nomes de objetos
Storage ou arquivos de backup. A integração Vercel MCP desta sessão retornou
indisponível; configuração e deployments foram conferidos pelo painel web já
autenticado. Evidências sanitizadas: [OIDC e schedule](evidence/ops01-oidc-repair-20261024.json)
e [snapshot/restore](evidence/recovery-provenance-20261024.json).

O spec local protegido `apps/app/e2e/community-v2/community-groups.spec.ts`
permaneceu fora dos commits, hash Git
`43bb75e8482c3638840cbfa760a91e01927ed770`. Não foram repetidos RV-01, QA
visual, E2E geral ou migrations.
