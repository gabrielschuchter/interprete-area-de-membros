# MVP funcional local — Gestão

Prioridade definida pelo usuário em 13/10/2026. Este arquivo separa entrega
funcional de aceite integral; não substitui os critérios dos 101 quadros.
Estado e gates vigentes: [STATUS.md](STATUS.md). Histórico: EXECUTION-LOG.md
e PROGRESS.md. Tudo no worktree `interprete-gestao`, branch `gestao-v2`.

## Unidade vertical: atividade de turma com rubrica

Escopo: reutilizar turma funcional existente com responsável e alunos, criar
conteúdo real pela Gestão, publicar para a turma, enviar texto como aluno,
corrigir com rubrica e ler o resultado após reload. Não abrir outro catálogo.

| Critério | Evidência local |
|---|---|
| Criar rascunho e publicar na turma | Professor 1, UI de Atividades, rubrica Raciocínio 60% / Evidência 40%; status/version relidos no PostgreSQL TLS |
| Aluno autorizado envia | Student 04 enviou texto uma vez, SUBMITTED/rubricVersion 1 relidos; textarea preservado após reload |
| Corrigir e ler resultado | Professor 1 enviou comentário/notas 8 e 9; REVIEWED/Feedback v1/autoria/criteriaScores relidos; aluno viu comentário e notas após reload |
| Isolar aluno fora da turma | Student 12 sem título de atividade na URL direta; teste de regressão também cobre lista, detalhe e guard de envio |
| Isolar professor alheio | Professor 2 não seleciona a entrega; POST de ação válido com entrega adulterada retorna 403, registro permanece igual |
| Preservar QA anterior | Snapshot da entrega de Main/feedback anterior mantém status, hashes, autor e versão; sem reenviar |
| Desktop/mobile | Capturas 1440/390/320 do editor, resposta, correção e feedback; documento sem overflow nas passadas |

Fonte: `scripts/qa/gestao-mvp-activity-local.mjs`, logs
`output/gestao-mvp-activity/browser*.log`, capturas/JSON
`output/playwright/gestao-v2/mvp-activity`. A rodada inicial gravou e leu o
ciclo; a retomada corrigiu uma expectativa do harness sobre a seleção de
entrega própria e fechou o 403 sem reenviar resposta/feedback.

Fixture adicional preservada: slug `gestao-qa-mvp-atividade-20261013`, no
banco funcional local. Não resetar essa atividade para reexecutar o ensaio.
O harness retoma registros já existentes e exige o comentário exato da fixture
se houver feedback. Não roda seed ampla, não altera papéis e não apaga dados.

Desvio de QA preservado: a rodada pós-build alterava inputs hidden antes da
hidratação terminar. React restaurou o ID e enviou o comentário de tentativa
à entrega própria `cmv5mu60x001powyp9wvyj1wh` do professor 2 (Feedback v1,
REVIEWED, rubrica 0). Isso não foi um bypass de autorização: o servidor recebeu
o ID autorizado. Não apagar/reverter esse registro para limpar evidência.
O harness passou a alterar os cinco campos do POST multipart já serializado,
em memória, e recusa envio sem essa alteração. A entrega protegida do Main e
a correção nova continuam com comentário/autoria/versão exatos. Auditoria SQL
TLS em `output/gestao-mvp-activity/preserved-fixtures-audit.json`.

## T2 — matrícula, acesso e remoção (local)

Goal solicitado em 13/10/2026: provar a jornada com persistência, isolamento
e preservação de origens, sem esperar o aceite visual completo. Usada turma
nova do professor1, `cmv6vx0ga000048ypclxtji6x`, com curso1 já publicado.

| Caso | Evidência |
|---|---|
| Criar e liberar conteúdo | Turma criada na UI, ALL_ACTIVE; curso1 associado pela UI e relido no banco |
| Matricular | Alunos04/11/12 adicionados pela UI, três memberships ACTIVE após reload |
| Ganhar acesso | Aluno11 sem acesso antes, curso visível depois da matrícula e após reload |
| União de origens | Admin concedeu acesso DIRECT independente ao12 pela UI; curso visível por ambas as origens |
| Remover | Três matrículas da turma nova encerradas pela UI; REMOVED/leftAt/activeKey null após reload, sem exclusão |
| Revogar só a turma | Aluno11 vê 404 sem payload do curso; aluno12 continua vendo o curso após reload |
| Preservar histórico | Entregas/feedbacks/notas/hashes de aluno04 e grant independente de12 idênticos antes/depois |
| Negar professor alheio | Professor2 recebe 403 na URL direta; ação válida com cohortId adulterado no POST retorna not-found sem alterar matrícula |
| Mobile | Capturas1440/390/320 sem overflow; capturas são funcionais, não aceite de quadros |

Fontes: `scripts/qa/gestao-mvp-t2-local.mjs`, logs em
`output/gestao-mvp-t2`, JSON/capturas em `output/playwright/gestao-v2/mvp-t2`.
A rodada `browser-resumed` criou turma/grant/matrículas; interrompeu na leitura
prematura do skeleton. `browser-settled` passou1/1 em106s, incluindo remoção,
acesso/revogação e ação alheia. Retomadas preservam memberships encerradas e
não repetem as escritas concluídas. O teste espera conteúdo real/404 e mantém
o caret nas capturas para não injetar estilos durante a hidratação.

Correções concretas: papel/ativação relidos dentro da transação antes de
lookup/replay (oito regressões); mensagem de remoção agora diz removidos;
keys de curso/liberação no cronograma são distintas. O aviso de hidratação
da captura anterior vinha de caret-color aplicado pelo screenshot antes de
hidratar; não foi usado como prova de bug do produto. Clerk real, matriz
integral, concessão temporária de30dias e mover/CSV continuam sem aceite.

O smoke adicional do cronograma revelou contador de aulas transbordando até
329px em viewport320; o cabeçalho de liberação agora permite quebra de linha
no mobile. O ensaio CSS específico voltou a scrollWidth320 sem ocultar o
overflow do documento. Evidência final desse ajuste registrada em STATUS.

Fechamento pós-build: `browser-closed.log` passou1/1 em73s, errors=[] incluindo
console, cronograma/roster1440/390/320 sem overflow. `audit.json` confirma
histórico antes/depois, grant DIRECT12 e matrícula original04 ACTIVE. Gates
completos aprovados em output/gestao-mvp-t2 (build-closed/performance-closed,
707testesapp); preview admin visual reaberto. Critérios locais do goal T2
cumpridos; isso não aceita a fase inteira nem os quadros correspondentes.

Fixtures preservadas: turma nova ativa/vazia, vínculo do curso publicado,
três memberships REMOVED e uma origem DIRECT ao12. Elas alteram contagens de
QA; não apagar/resetar para restaurar os totais antigos. Turmas anteriores e
feedbacks das unidades anteriores foram preservados.

## Isolamento de atividades

Atividade sem curso e com destinatários caía no fallback global. Agora lista,
detalhe e guard de envio consultam as contagens das origens junto da projeção
existente. Ausência de acesso efetivo não abre atividade direcionada. Revogação,
expiração e FROM_JOIN continuam restritivos. Atividades legadas que nunca
tiveram destinatários continuam globais; curso/concessão individual/staff
continuam fontes independentes. Sem migration ou backfill. Oito regressões:
quatro falharam antes da correção; oito passaram depois.

## Backlog separado

- T2 funcional local comprovado na unidade acima. Próxima unidade MVP: A2,
  rascunho privado de correção → sair/reload → retomar sem expor ao aluno e
  próxima entrega após envio, reutilizando fila e novas fixtures explícitas.
  Criação/CSV/movimentação/duplicação de turma não recebem aceite integral.
- A1/A2 integrais: pesos inválidos na publicação real, rascunho privado/reload,
  próxima entrega automática e notificações com worker contínuo não recebem
  aceite por esse ciclo. Outbox não equivale a entrega externa comprovada.
- Upload, curso/aula/playback e YouTube real; Clerk real; todas as ações/perfis,
  concorrência representativa, percentis e dispositivos físicos permanecem
  não verificados por essa unidade.
- Fidelidade dos 101 quadros, acabamento do Main/shell, acessibilidade completa,
  movimento e demais larguras permanecem no contrato. Nenhum quadro ou fase
  promovido: 0 aceitos, 42 em andamento, 59 pendentes.
- Comunidade/Medalhas ainda têm placeholder; `/gestao/previa` geral continua
  sem rota funcional. Não apresentar esses destinos como parte do MVP validado.

## Reexecutar e reverter

Pare somente o preview pertencente a este worktree antes do harness. Configure
`QA_MVP_ACTIVITY_WRITE=true`, `QA_PLAYWRIGHT_MODULE` para o Playwright instalado
e, se necessário, `QA_CHROMIUM_EXECUTABLE` para um Chromium local compatível.
Execute `node scripts/qa/gestao-mvp-activity-local.mjs` na raiz. O destino QA,
loopback/55433 e CA TLS são fixos e validados; o processo restaura admin visual.
Não inventar chave Clerk. `/health` pode ter 503 com auth missing mesmo com
database ok no adaptador QA; isso não comprova autenticação Clerk.

Reversão de código preserva fixtures e schema. Desligar `GESTAO_V2_ENABLED`
oculta a Gestão; não reabrir o fallback de acesso para simular reversão.
Nenhum push/merge/deploy, banco remoto ou exclusão está autorizado.
