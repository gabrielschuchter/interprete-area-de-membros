# OPS-01 — investigação delimitada — 23/10/2026

**Estado: BLOQUEADO; não resolvido.** Base do preflight: `04b5e5c`.
Nenhum job foi declarado recuperado, nenhuma notificação foi criada nesta
execução e nenhuma chamada autenticada manual do worker foi usada como prova.

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

## Ação exata pendente de autorização

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
