# Comunidade V2 — backlog operacional

## OPS-01 — ativação condicional do PR #16 — 23/10/2026

**OPS-01 BLOQUEADO; divergência de subject OIDC comprovada.** O patch exclusivo do
[PR #16](https://github.com/gabrielschuchter/interprete-area-de-membros/pull/16)
foi integrado em main: `b5a2f06`, 20:19:37 UTC. Antes do merge, App e API foram
desconectados do Git e a proteção foi confirmada por reload no painel.
Production manteve os mesmos deployments, SHAs e aliases; nenhum deployment
do merge foi observado. **Git permanece desconectado nos dois projetos.**
Reconectar exige handoff controlado para evitar publicação.

Diagnóstico encerrado: primeiro schedule com o patch, run
[`40036220515`](https://github.com/gabrielschuchter/interprete-area-de-membros/actions/runs/40036220515),
23/10 às 22:51 UTC, falhou em `oidc_claims`: `sub=false`, demais oito checks
`true`. Repositório usa subject imutável com prefixo
`repo:gabrielschuchter@291341266/interprete-area-de-membros@1386145986`;
guard e Trusted Source Preview inspecionada esperam o formato sem IDs.
O request Preview não foi alcançado; não há status HTTP desse run.

Próxima ação requer autorização para alinhar o `sub` da regra Trusted Source
somente Preview da API e do guard diagnóstico ao subject imutável, mantendo
todas as demais restrições. Nenhuma política foi alterada. Acompanhamento
`ops-01-pr-ximo-schedule-ap-s-pr-16` excluído após o diagnóstico.

Não houve job QA novo, chamada manual, prova de recovery/Broadcast/badge,
migration ou mudança de credencial, autenticação ou cron GREEN.
Detalhes, proteção e evidências em [OPS-01.md](OPS-01.md).
Os registros abaixo são históricos onde divergirem desta ativação.


## Fechamento do preflight 12A — 23/10/2026

**NO-GO; 12A encerrada, publicação 12B não iniciada.** OPS-01 foi investigado:
48 schedules falharam, nenhum teve sucesso; causa exata ainda não identificada.
Cron GREEN preservado por hash, ativo e com respostas HTTP 200; essa prova não
substitui recovery V2, Broadcast ou badge. Ações exatas e demais bloqueadores
concentrados em [RELEASE-PLAN.md](RELEASE-PLAN.md).

RV-04/convites: consulta atual com zero PENDING e zero reclassificações; resolvido
no snapshot, recontar sob freeze. Proveniência de dois posts publicados, grant
SELECT de Notification, acesso Vercel 403, recuperação completa/fallback e provas
remotas dependentes do schema continuam bloqueando a publicação. Nenhum novo
projeto foi aberto por warnings. O registro de 15/10 abaixo é histórico.


Atualizado em 2026-10-15. Itens aqui são gates específicos, não bloqueios globais do produto.

## OPS-01 — recuperação periódica Preview e Broadcast/badge

- **Classe:** GATE-DEPENDÊNCIA.
- **Estado:** pendente; a execução periódica do workflow Preview e a recuperação real de um job não foram comprovadas. Broadcast e badge também não têm evidência de funcionamento.
- **Evidência mais recente registrada:** em 15/10/2026 às 23:28 UTC não havia run schedule observado. A chamada manual autenticada do worker processou um job namespaced e a Notification QA persistiu após reload. Isso comprova o caminho manual e a persistência, não o scheduler, a recuperação periódica, o Broadcast ou o badge.
- **Não bloqueia:** Etapa 02 — os cinco destinos, navegação, Explorar de leitura, filtros, Salvos e Encontros. A etapa não depende de entrega periódica de notificações.
- **Primeiro gatilho de retomada:** a primeira jornada de produto que exigir entrega/recuperação periódica ou Broadcast/badge, prevista na Etapa 04 para discussão e notificações; ou o preflight de release, o que ocorrer primeiro.
- **Ao retomar:** verificar o estado atual do workflow, Trusted Source, SSO e runs; provar recuperação periódica suficiente para a topologia final. Preservar o cron GREEN que aponta para Production. Não ampliar bypass, não mover secrets para pg_net e não alterar Production para liberar a Etapa 02.

### Outras dependências por etapa

Os riscos já documentados em STATUS.md continuam ligados ao primeiro fluxo que os exige: isolamento de escrita no GREEN antes de QA mutável; autorização/enum MODERATOR e unicidade de título na Etapa 05; Storage e compartilhamento nos fluxos de capa/link; gates de backup, compatibilidade e rollback no preflight da Etapa 12. Nenhum deles autoriza antecipar migrations ou alterar dados existentes durante a Etapa 02.
