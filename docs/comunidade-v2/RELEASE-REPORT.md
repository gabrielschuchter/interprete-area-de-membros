# Comunidade V2 — resultado do preflight de go-live

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
| OPS-01 — schedule/outbox | Correção OIDC publicada. A única consulta após o merge, às `02:52Z`, ainda retornou como último run `40049295827`, falha no SHA antigo `b5a2f06`, anterior à correção. Nenhum run com `1586ed5` foi observado. | Configuração alinhada não prova autenticação aceita nem recovery. Não há prova real de job `preview.*`, isolamento/dedupe, Broadcast/Realtime ou unread/badge. | Aguardar um schedule automático pós-`1586ed5`. Se passar, acompanhar um job QA isolado criado no namespace `preview.*` até persistência, emissão/recepção Broadcast e badge após reload; não usar dispatch, rerun ou chamada manual como substituto. |
| Proveniência legada | GREEN contém 28 posts sem grupo: 8 DRAFT, 2 PUBLISHED, 18 ARCHIVED. Busca read-only não encontrou DomainEvent para os dois PUBLISHED sem `spaceId`. | A migration de escopo preserva esses registros como `UNRESOLVED`, deixando dois conteúdos publicados indisponíveis na V2. Não há evidência para classificá-los como globais. | Obter fonte/proveniência autoritativa dos dois registros e reconciliar revisado; se não existir, obter decisão explícita de mantê-los indisponíveis. Não alterar conteúdo nem classificá-los por suposição. |
| Migrations e integridade | GREEN em PostgreSQL 17.11; 65 migrations completas, zero incompletas e 11 migrations V2 pendentes, sem drift informado no preflight. A consulta atual confirmou o ledger aplicado, mas não aplicou SQL. | As migrations não foram ensaiadas em GREEN sob freeze/limites reais de lock. A migration 1300 mantém 28 posts ambíguos como `UNRESOLVED`; a sequência de audiência deve permanecer sem leitores incompatíveis entre os passos. | Resolver proveniência/decisão acima, repetir somente os contadores T0 e lock prechecks no início da janela; aplicar a sequência exata já listada em [RELEASE-PLAN.md](RELEASE-PLAN.md#ordem-das-11-migrations-e-riscos), interrompendo em drift, lock ou contagem divergente. |
| Notification / Data API | RLS está ativo; `anon SELECT=false`, mas `authenticated SELECT=true`. | O grant autenticado ainda permite acesso direto pela Data API. RLS por destinatário não substitui o grant `REVOKE` aprovado. A negação com JWT Clerk válido não foi provada. | Aplicar a migration 1100 durante a janela depois de aprovar os gates; conferir grants/RLS no catálogo e testar negação PostgREST com JWT válido, além do acesso autorizado pela API. |
| Backup PostgreSQL | Dump novo foi reaberto, hash conferido e listado por `pg_restore`; envelope usa DPAPI do perfil Windows atual. Restauração histórica anterior continua evidência local válida. | Não houve restore deste backup novo em destino PostgreSQL isolado; a chave não foi demonstrada fora do perfil atual. | Preparar acesso aprovado a chave recuperável por operador/host independente e restaurar em banco novo isolado, conferindo ledger, contagens e referências. Nunca usar GREEN ou BLUE como alvo de ensaio. |
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
zero correspondências aos dois posts publicados sem grupo. Não foram impressos
tokens, headers, corpos privados, nomes de objetos Storage ou arquivos de
backup. A integração Vercel MCP desta sessão retornou indisponível; a
configuração e os deployments foram conferidos pelo painel web já autenticado.
A evidência sanitizada do contrato OIDC e schedule está em
[ops01-oidc-repair-20261024.json](evidence/ops01-oidc-repair-20261024.json).

O spec local protegido `apps/app/e2e/community-v2/community-groups.spec.ts`
permaneceu fora dos commits, hash Git
`43bb75e8482c3638840cbfa760a91e01927ed770`. Não foram repetidos RV-01, QA
visual, E2E geral ou migrations.
