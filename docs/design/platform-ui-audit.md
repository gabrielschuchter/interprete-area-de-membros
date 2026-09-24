# Auditoria da UI da plataforma

Atualizada em 24/09/2026. Esta matriz descreve o estado da interface real antes da
productização desta rodada. `NEEDS WORK` significa que a rota existe, mas ainda
tem densidade, hierarquia ou fluxo insuficiente para ser considerada produto.

| Rota | Existe | Funciona | UI completa | UX completa | Mobile | Estados | Interprete. | QA | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | sim | parcial | não | não | fonte | não | parcial | bloqueado por banco | NEEDS WORK |
| `/aprender` | sim | parcial | não | não | fonte | parcial | parcial | bloqueado por banco | IN PROGRESS |
| `/aprender/trilhas/[slug]` | sim | parcial | não | não | fonte | parcial | parcial | bloqueado por banco | IN PROGRESS |
| `/aprender/cursos/[slug]` | sim | parcial | não | não | fonte | parcial | parcial | bloqueado por banco | IN PROGRESS |
| `/aprender/cursos/[slug]/[lessonSlug]` | sim | parcial | não | não | fonte | parcial | parcial | bloqueado por banco | IN PROGRESS |
| `/atividades` | sim | sim | não | não | fonte | sim, vazio honesto | parcial | não executado | NEEDS WORK |
| `/comunidade` | sim | sim | não | não | fonte | sim, vazio honesto | parcial | não executado | NEEDS WORK |
| `/biblioteca` | sim | sim | não | não | fonte | sim, vazio honesto | parcial | não executado | NEEDS WORK |
| `/encontros` | sim | sim | não | não | fonte | sim, vazio honesto | parcial | não executado | NEEDS WORK |
| `/perfil` | sim | sim | não | não | fonte | sim, vazio honesto | parcial | não executado | NEEDS WORK |
| `/sign-in` | sim | sim | parcial | parcial | fonte | Clerk | parcial | runtime autenticado validado | NEEDS WORK |
| `/sign-up` | sim | sim | parcial | parcial | fonte | Clerk | parcial | runtime autenticado validado | NEEDS WORK |

## Critério de revisão

Cada rota será marcada `DONE` somente quando houver fluxo principal navegável,
hierarquia visual completa, estados explícitos, revisão em desktop e mobile,
contraste/foco adequados e evidência de runtime. A matriz não trata compilação
como prova de experiência real.

## Próximo recorte

O trabalho começa por Learning, porque é a fase atual do roadmap: índice de
estudo, trilha, curso e aula. As rotas de domínios futuros permanecem honestas e
sem modelos especulativos até que suas fases sejam iniciadas.
