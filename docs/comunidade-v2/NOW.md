# Comunidade V2 — estado para continuidade

**Branch/SHA base:** codex/comunidade-v2 @ 60ebe27e0fa3c2d01a503247bf4288b3d13a64ca. Esta é a base recebida antes do checkpoint documental.
**Etapa ativa:** 02 — Navegação e Explorar.
**Estado do código da Etapa 02:** ainda não iniciado neste checkpoint documental.
**Resultado de produto comprovado nesta retomada:** nenhum fluxo novo ainda; Etapa 01 aceita para avanço com pendências transferidas. Não declarar recuperação periódica, Broadcast ou badge como validados.

## Escopo ativo

Cinco destinos da Comunidade; Explorar com dados reais, filtros na URL e paginação; navegação, origem/retorno; Salvos da Comunidade integrado ao Salvos global; wrapper de Encontros/Gravações existentes; estados vazios/erro e desktop/tablet/mobile. Boards principais: 02, 03, 03b, 08, 09, 11, 19, 32, 33, 35, 37, 38, 43 e 50.

## Evidência e gates

- Preview já teve autenticação Clerk Development validada para MEMBER, TEACHER e ADMIN; isso não é prova das jornadas da Etapa 02.
- Worker manual entregou Notification QA persistente após reload.
- OPS-01: GATE-DEPENDÊNCIA para jornadas de notificação que precisem de recuperação periódica/Broadcast/badge e para release. Não bloqueia Etapa 02. Ver BACKLOG.md.
- Bloqueio local da Etapa 02: nenhum demonstrado até aqui.
- Screenshots e testes das telas Etapa 02: ainda não existem neste checkpoint.

## Próximas 3 ações exatas

1. Implementar a navegação dos cinco destinos e o feed Explorar real usando as queries, permissões e dados existentes.
2. Integrar CommunityBookmark ao Salvos global e conectar Encontros/Gravações às rotas existentes.
3. Testar navegação/origem/retorno, filtros, estados e larguras da matriz; comparar screenshots com os boards; corrigir o recorte e atualizar este arquivo com evidências.

## Preservar

Manter a branch e o worktree V2 existentes, as 25 decisões, o handoff, o código/dados e as alterações preexistentes do checkout original. Não tocar no cron GREEN, segredos, bypass, OIDC, SSO ou Production para a Etapa 02. Não antecipar migrations de etapas futuras.