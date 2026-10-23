# Comunidade V2 — backlog operacional

## OPS-01 — retomada delimitada de 23/10/2026

**OPS-01 BLOQUEADO; não resolvido.** Acesso Vercel autorizado comprovado pelo
navegador; o 403 local corresponde a credencial expirada desde 21/10 e não
demonstra ausência total de acesso. SSO e Trusted Source Preview foram lidos
sem alteração. As 48 falhas continuam sem causa HTTP comprovada.

Patch diagnóstico testado 7/7 e preparado no [PR draft #16](https://github.com/gabrielschuchter/interprete-area-de-membros/pull/16),
sem merge em main. A ativação desse único workflow em main, sem efeito sobre
Production, é a ação exata pendente de autorização conforme RELEASE-PLAN.
Nenhum job QA novo, execução manual do worker, prova de recovery/Broadcast/badge,
migration ou mudança de credencial/proteção/cron ocorreu.
Detalhes e limites em [OPS-01.md](OPS-01.md). Os demais gates 12A não foram reabertos.


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