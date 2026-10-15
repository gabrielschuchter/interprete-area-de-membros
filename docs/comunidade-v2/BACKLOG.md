# Comunidade V2 — backlog operacional

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