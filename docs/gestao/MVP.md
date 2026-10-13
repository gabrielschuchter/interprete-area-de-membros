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

## Correção necessária ao MVP

Atividade sem curso e com destinatários caía no fallback global. Agora lista,
detalhe e guard de envio consultam as contagens das origens junto da projeção
existente. Ausência de acesso efetivo não abre atividade direcionada. Revogação,
expiração e FROM_JOIN continuam restritivos. Atividades legadas que nunca
tiveram destinatários continuam globais; curso/concessão individual/staff
continuam fontes independentes. Sem migration ou backfill. Oito regressões:
quatro falharam antes da correção; oito passaram depois.

## Backlog separado

- Próxima unidade MVP: adicionar/remover aluno de turma com conteúdo liberado,
  provar acesso/revogação e preservar entregas/concessão direta (T2), reutilizando
  formulário/fixtures existentes. Criação, CSV, movimentação e duplicação de
  turma não estão integralmente aceitos nesta unidade.
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
