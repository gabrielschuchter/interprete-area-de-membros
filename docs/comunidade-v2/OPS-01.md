# OPS-01 — recuperação operacional — 24/10/2026

**Estado: BLOQUEADO; contrato OIDC corrigido, recuperação real ainda não comprovada.**
Este registro atualiza o diagnóstico da base `04b5e5c` sem substituir as provas
pendentes de scheduler, outbox, Broadcast/Realtime e badge.

## Correção autorizada do contrato OIDC — 24/10/2026

O repositório GitHub declara `use_immutable_subject=true`; seu subject efetivo
é `repo:gabrielschuchter@291341266/interprete-area-de-membros@1386145986:environment:community-v2-preview`.
O guard do workflow e a Trusted Source da **API Preview** foram alinhados a esse
valor exato. A política salva mantém issuer `https://token.actions.githubusercontent.com`,
audience `https://github.com/gabrielschuchter`, repositório, branch `main`,
workflow, evento `schedule` e ambiente `community-v2-preview`; a origem continua
restrita a Preview. `use_immutable_subject` permaneceu habilitado. Não foram
alteradas outras Trusted Sources, Production, Clerk, cron GREEN, segredos ou
políticas globais.

O patch mínimo de uma linha foi integrado pelo PR
[#17](https://github.com/gabrielschuchter/interprete-area-de-membros/pull/17),
commit `1586ed53240dd533dd3a38bc244ed49cfabf31ae` em `main`. Antes do merge, a
configuração efetiva dos projetos App e API foi recarregada no painel Vercel e
confirmou ambos sem conexão Git; assim não houve integração Git que pudesse
acionar deploy automático. As integrações permanecem desconectadas.

Às `2026-10-24T02:52Z`, uma consulta de schedules ainda mostrava como mais
recente o run `40049295827`, SHA `b5a2f067`, criado às `01:19:58Z` e encerrado
com falha antes do commit `1586ed5`. Uma segunda consulta, feita até `03:01Z`,
retornou o mesmo run; não havia execução real com o patch novo.
Não foi feito dispatch, rerun, POST manual ou job QA para substituir essa prova.
Evidência sanitizada: [ops01-oidc-repair-20261024.json](evidence/ops01-oidc-repair-20261024.json).

**Próxima prova exata:** aguardar um evento `schedule` automático em `main` com
o blob do workflow pós-`1586ed5`; conferir os checks booleanos sem expor token,
e só então acompanhar a recuperação de um job QA com namespace isolado. OPS-01
só pode fechar depois de recuperação por scheduler, isolamento/dedupe, entrega
Broadcast/Realtime e atualização persistida do unread/badge serem observados.
O tempo sem evento não autoriza chamada manual nem comprova recuperação.

As seções seguintes registram o diagnóstico anterior e continuam válidas como
histórico; a divergência de `sub` descrita nelas foi corrigida pelo PR #17.

## Diagnóstico encerrado — primeiro schedule com o patch

O primeiro evento real após o PR #16 foi o run
[`40036220515`](https://github.com/gabrielschuchter/interprete-area-de-membros/actions/runs/40036220515),
criado em **23/10 às 22:51:14 UTC (19:51 BRT)**, SHA `b5a2f06`, com falha.
O blob do workflow nesse SHA é `f7a3ba70483ee8ab10334c3413733b4dddedf2f1`,
idêntico ao head aprovado do PR. Foi analisado somente esse primeiro run;
nenhum rerun, dispatch ou POST manual foi executado.

O log comprova `phase=oidc_claims exit=1`: **`sub=false`**, enquanto `aud`,
`environment`, `event_name`, `iss`, `not_expired`, `ref`, `repository` e
`workflow_ref` são `true`. O job parou antes do request Preview; portanto
**não há `curl_exit` nem status HTTP desse run**.

A consulta read-only ao endpoint GitHub de configuração OIDC do repositório
retornou `use_default=true`, `use_immutable_subject=true` e o prefixo
`repo:gabrielschuchter@291341266/interprete-area-de-membros@1386145986`.
O guard e a Trusted Source Preview inspecionada exigem o formato anterior:
`repo:gabrielschuchter/interprete-area-de-membros:environment:community-v2-preview`.
Essa incompatibilidade de subject é um bloqueador concreto. O payload não foi
gravado e a checagem booleana não constitui validação criptográfica. A resposta
HTTP das 48/49 falhas anteriores continua sem comprovação; este run diagnóstico
não chegou a exercitar a decisão da Vercel.

**Próxima ação exata, fora da autorização atual:** autorizar o alinhamento do
`sub` exigido pela Trusted Source **somente Preview da API** e pelo guard do
workflow ao subject imutável do repositório, preservando todos os demais claims
e restrições. Não desabilitar subjects imutáveis nem flexibilizar a regra para
fazer passar. É alteração de política de autenticação, expressamente vedada
nesta tarefa; não foi aplicada. Após autorização/correção, a prova deverá voltar
a ser um schedule real, antes de qualquer prova de job QA.

**OPS-01 permanece BLOQUEADO / NO-GO.** Recovery, Broadcast e badge não foram
comprovados. App e API permanecem com Git desconectado; nenhuma reconexão,
publicação, mudança de credencial, cron GREEN ou migration foi realizada.
O acompanhamento `ops-01-pr-ximo-schedule-ap-s-pr-16` foi **excluído** após
obter o diagnóstico. Não há novo ciclo de investigação em andamento.
Evidência: [first-scheduled-diagnostic.json](evidence/ops01-20261023/first-scheduled-diagnostic.json).
As seções seguintes são históricas onde divergirem deste fechamento.

## Ativação condicional do PR #16 — 23/10, 20:19 UTC

A autorização posterior do usuário permitiu integrar exclusivamente o patch
diagnóstico, condicionada à proteção comprovada contra deployments Production.
Essa condição foi cumprida antes do merge: o Git foi desconectado separadamente
nos projetos App e API pelo painel autorizado; ambas as páginas foram recarregadas
e confirmaram ausência de repositório conectado. Configurações preservadas pelo
Vercel; nenhum Pause Project, alteração de política, credencial ou cron foi usado.

Antes da proteção, ambos rastreavam `main` como Production, com atribuição
automática dos domínios ativa. Ignored Build Step, projeto não afetado e mensagem
`[skip ci]` não foram adotados como garantia. Não havia deploy hooks em nenhum
projeto; o único workflow de `main` era o scheduler Preview, sem etapa de deploy.
A [documentação Git da Vercel](https://vercel.com/docs/git) confirma o disparo
de Production ao integrar a branch produtiva; apenas desligar a atribuição de
domínios ainda permitiria um deployment de Production.

O [PR #16](https://github.com/gabrielschuchter/interprete-area-de-membros/pull/16)
foi integrado por squash às `20:19:37Z`, commit
`b5a2f067d75adf16bf84193ecea290c1bd318f5e`, com conferência do head aprovado
`1cb2660` e diff de **um workflow, 41 adições, zero remoções**. Nenhum código
de produto V2 foi integrado em `main`.

Production manteve os mesmos deployments e aliases antes/depois do merge:

| Projeto | Deployment ativo | SHA de produto preservado |
|---|---|---|
| App | `67N5ST2Dn3NR5XF2n4aekveAaXWF` | `7a7c8e4d0167490308f54bb8d79b3577c2f0aaa6` |
| API | `XQRUb541CcFFTLhGodnXokBtDMcc` | `6c7b49a3fecab3bda8e2f6ad41789972ad711dd9` |

As listas de deployments consultadas após o merge não mostraram deployment de
`b5a2f06`. Evidência sanitizada: [production-guard.json](evidence/ops01-20261023/production-guard.json).
Screenshots e árvores do painel ficam no diretório local indicado nesse JSON.

**Git permanece desconectado nos dois projetos.** Isso suspende novos deployments
automáticos Git, inclusive Preview. Reconectar exige handoff controlado: a branch
Production continua sendo `main`, e não foi demonstrado que reconectar deixaria
de disparar um deployment. Não reconectar para encerrar esta tarefa.

Após a ativação, aguarda-se exclusivamente o próximo evento real `schedule`.
A consulta atual contabilizou **49 falhas, zero sucessos**, última execução
`40014660675`, `19:51:09Z`, anterior ao patch. Os últimos oito eventos chegaram
com intervalos aproximados de 2–6 horas apesar do cron de cinco minutos.
Workflow ativo. Não houve dispatch, rerun, POST manual ou job QA novo.
O acompanhamento nesta conversa está ativo a cada cinco minutos, ID
`ops-01-pr-ximo-schedule-ap-s-pr-16`: uma consulta por ativação, silencioso
enquanto não houver o evento; encerra após entregar diagnóstico e próximo passo.
Não autoriza correção adicional, reconexão Git ou novo ciclo de auditoria.
Os registros abaixo são o snapshot anterior onde divergirem desta ativação.

## Diagnóstico comprovado

- Permanecem 48 runs `schedule` com falha e zero sucesso na consulta feita
  nesta execução. Último: [39982199840](https://github.com/gabrielschuchter/interprete-area-de-membros/actions/runs/39982199840),
  SHA `90aa250`, 23/10 às 12:53 BRT. O passo falha em menos de um segundo,
  com exit 1, sem fase, status HTTP ou diagnóstico de curl no log. A causa
  concreta dessas falhas **continua não comprovada**.
- A credencial Vercel local tem `expiresAt=2026-10-21T20:02:44Z`, anterior
  à consulta. O 403 dessa credencial expirada não demonstra ausência de acesso
  aos projetos, nem determina o escopo da integração ChatGPT. Não houve refresh,
  rotação, cópia ou substituição de credenciais.
- As chamadas Vercel conectadas, com team e sem team, retornaram ferramenta
  indisponível **nesta sessão**. A sessão existente do Edge permitiu consultar
  o projeto API, seus deployments, logs e proteção, além do build setting App.
  Portanto, acesso autorizado ao painel foi comprovado e utilizado.
- No API, `Require Log In` continua ativo/Standard Protection. Não há bypass
  de Automation nem shareable link ativo. O Trusted Source GitHub existente
  aplica-se somente a Preview, com os claims abaixo. A inspeção abriu o editor
  e saiu por Cancel, sem Save e sem alterar a regra.
- O deployment API `dpl_BLNMNrdxd5ZjVjUUsRGUA5GGRwKr`, SHA `80f6c13`,
  está identificado como Preview/Ready/Stale no painel e lista o alias usado
  pelo workflow. Esse é um deployment observado, não confirmação de qual build
  o alias serve em cada instante nem de runtime V2 migrado.
- Abrir `/cron/outbox` no alias Preview pela sessão Vercel existente, sem
  Bearer da rota, devolveu `{"error":"Não autorizado."}`. Não executou o worker.
  Isso comprova a barreira própria da rota, não que GitHub OIDC foi aceito.
- Os logs disponíveis no plano Hobby permitem a última hora; a falha das
  12:53 já estava fora dessa retenção. Na janela recente, os POSTs de cron
  observados eram do host Production atual, com 200. Não foram atribuídos
  ao scheduler Preview nem usados para fechar OPS-01.

## Trusted Source observado, sem alteração

Issuer: `https://token.actions.githubusercontent.com`; alvo: **Preview somente**.

| Claim | Valor exigido |
|---|---|
| aud | `https://github.com/gabrielschuchter` |
| repository | `gabrielschuchter/interprete-area-de-membros` |
| sub | `repo:gabrielschuchter/interprete-area-de-membros:environment:community-v2-preview` |
| ref | `refs/heads/main` |
| event_name | `schedule` |
| workflow_ref | `gabrielschuchter/interprete-area-de-membros/.github/workflows/community-v2-preview-outbox.yml@refs/heads/main` |
| environment | `community-v2-preview` |

Os valores declarados correspondem ao desenho aprovado. Não há token emitido
pelo run disponível para provar os claims recebidos ou a validação da assinatura.
A documentação [Trusted Sources](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/trusted-sources)
confirma a exigência de assinatura, claims e ambiente, com o header
`x-vercel-trusted-oidc-idp-token`. A [referência OIDC GitHub](https://docs.github.com/en/actions/reference/security/oidc)
descreve os claims usados. Nenhum deles foi relaxado para fazer o teste passar.

## Patch preparado

Somente `.github/workflows/community-v2-preview-outbox.yml`:

- Identifica a fase/guard em que o shell termina.
- Compara os claims com os valores já exigidos e imprime apenas booleanos;
  isso é um diagnóstico local do payload, não verificação criptográfica.
- Registra `curl_exit` e `http_status` antes de exigir 200, permitindo separar
  redirect da proteção, 401 da rota, timeout e falha anterior de OIDC.
- Não imprime JWT, segredo, headers, Location ou corpo. Preserva schedule,
  host, ambiente, permissions, método e headers. Não adiciona dispatch manual,
  checkout ou actions de terceiros.

**Não é correção comprovada da causa das 48 falhas.** Corrige a ausência de
diagnóstico necessária para localizar a falha real na execução agendada.
O workflow existe em `main`; incluí-lo na branch V2 não ativa schedules nela.

Validação proporcional: parse YAML, `bash -n` e **7/7** cenários focados
(200, 302, 401, timeout, environment ausente, token expirado e ref errada).
O harness usa curl stubado e tokens sintéticos exclusivamente de teste, sem
qualquer acesso remoto. Resultados em
[workflow-check.json](evidence/ops01-20261023/workflow-check.json).
Não é prova de scheduler, recuperação, Broadcast ou badge.
Graphify AST atualizado: 8.481 nós/22.178 arestas; 78 SQLs não extraídos por
ausência de `tree_sitter_sql`, sem relação com o patch YAML. Nenhuma migration
ou auditoria SQL foi realizada.

## Snapshot anterior — ação que estava pendente de autorização

**Integrar/ativar este único patch de workflow em `main`, com garantia de que
isso não criará/promoverá deployment Production, e observar um novo evento
`schedule` real.** Não houve essa integração nesta execução.

O [RELEASE-PLAN.md](RELEASE-PLAN.md), seção “Sequência de execução da 12B”,
determina: “Não fazer push/merge em `main` para preparar release: a integração
Git pode promover Production automaticamente.” A autorização atual também
proíbe alterar Production. O App está com Ignored Build Step `Automatic` e
skip de projetos não afetados ativo; a API declara `node scripts/skip-ci.js`.
Esses controles e `[skip ci]` não foram tratados como garantia suficiente de
que uma integração em `main`, que recebeu alterações alheias durante a tarefa,
não promoverá Production. Não foram modificados para liberar a execução.

O patch está no [PR draft #16](https://github.com/gabrielschuchter/interprete-area-de-membros/pull/16),
branch `codex/ops01-preview-diagnostics-20261023`, commit
`1cb2660fbd1aec9070460d32858d056dbe853032`, isolado de `main`, com somente o
workflow alterado e sem integrar código V2.
Depois de ativado com autorização, uma falha classificada pode exigir uma ação
adicional específica. Se envolver credencial, Trusted Source, migration ou
Production, deve parar no limite correspondente; não ampliar escopo por conta própria.

## Critério que continua faltando

Somente após classificar/corrigir a causa real: observar pelo menos três
schedules consecutivos bem-sucedidos e um job QA allowlisted em `preview.*`
recuperado de RETRY/lease expirado, sem visita ao App, dispatch, rerun ou POST
manual substituindo a recuperação. Conferir persistência/dedupe no banco,
Broadcast do tópico privado e badge de não lidas após entrega/reload.

Essas provas **não ocorreram**. Nenhum job novo foi deixado na fila apenas
para aguardar um scheduler ainda falho. A award de perfil e a entrega manual
histórica não são prova de Broadcast/badge atual. Não foi repetido QA visual,
E2E geral, RV-01 ou migration. GREEN cron, proteções, credenciais e Production
permaneceram sem alteração por esta execução. Demais gates da 12A não foram
reabertos. O spec local protegido permanece fora dos commits com hash Git
`43bb75e8482c3638840cbfa760a91e01927ed770`.
