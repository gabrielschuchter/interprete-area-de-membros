# MVP funcional local — Gestão

Prioridade definida pelo usuário em 13/10/2026. Este arquivo separa entrega
funcional de aceite integral; não substitui os critérios dos 101 quadros.
Estado e gates vigentes: [STATUS.md](STATUS.md). Histórico: EXECUTION-LOG.md
e PROGRESS.md. Tudo no worktree `interprete-gestao`, branch `gestao-v2`.

## Sequência objetiva da base funcional

Reaproveitar os serviços/ações canônicos; arquivo ou rota existente não vale
como aceite. A auditoria atual encontrou CRUDs de Ensino e resolvers de turma,
mas lacunas de ligação e destinos que ainda caem no placeholder genérico.
Executar uma unidade vertical por vez nesta ordem; dividir por jornada quando
necessário, sem abrir novos editores antes de fechar a unidade corrente.

| Ordem | Unidade / reaproveitamento | Critério de saída funcional |
|---|---|---|
| 1 | A2 funcional local verificada: fila, rascunhos e feedback existentes | Salvar privado, sair/reload, retomar notas/texto, negar outro professor, enviar e abrir próxima pendente filtrada sem carregar notas da anterior; aluno vê apenas enviado |
| 2 | Turma → cronograma/encontro → Aprender/calendário | Fechar publicação/liberação e políticas de entrada/saída integradas, encontro publicado visível e rascunho oculto; reaproveitar T2 e calendário comprovados |
| 3 | Ensino → aluno: cursos/aulas, exercícios, biblioteca/coleções | Criar/editar/publicar/atribuir e consumir autorizado; validar upload/playback no ambiente disponível, sem refazer CRUD existente; erro real explícito para integração indisponível |
| 4 | Envios e acompanhamento | Destaque/pendência/aviso chega ao aluno correto; conclusão reflete no acompanhamento após reload; outbox/worker e notificação interna recuperáveis |
| 5 | Comunidade | Conectar publicações/moderação, grupos, avisos e agenda editorial aos domínios existentes, com público e permissões reais; eliminar placeholders essenciais |
| 6 | Administração | Conectar membros/papéis, origens de acesso, gravações, personalização, medalhas e auditoria existentes; mudança de papel/revogação efetiva na próxima requisição |
| 7 | Integração do shell | Busca, notificações, navegação e prévia contextual somente leitura operacionais; nenhuma rota anunciada termina em placeholder/404 nem controle sem ação |
| 8 | QA integrado + correções | Matriz de todas as seções/controles e jornadas cruzadas, perfis, vazio/erro/conflito/reload, desktop/mobile; registrar resultado e reparar sem reescrever checkpoints |
| 9 | Preflight e publicação | Somente após 1–8: verificar ambiente, Clerk real, migrations aditivas/RLS/origens, Vercel/Supabase e fluxo Git; publicar e fazer smoke real; bloquear se houver risco crítico |

Esta sequência não aceita antecipadamente todas as funcionalidades de uma
linha. A passagem exige evidência do comportamento, gates aplicáveis e commit.
Acabamento/pixel comparison dos101 quadros, movimentos detalhados e dispositivos
físicos ficam separados. Clerk real e integrações necessárias deixam de ser
backlog ao chegar ao preflight: devem ser verificadas ou registradas como
bloqueio da publicação. QA local com adaptador não satisfaz esse critério.

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

## A2 — rascunho privado e continuidade da fila (local)

Fluxo da rodada2 aprovado em `output/gestao-mvp-a2/browser-round2.log`
(1/1,621s incluindo compilação e troca de perfis). Capturas1440/390/320 e
snapshot de histórico em `output/playwright/gestao-v2/mvp-a2-round2`.

| Critério | Evidência local |
|---|---|
| Salvar e retomar | Professor1 salvou comentário e uma nota parcial, saiu para Main, voltou/recarregou e leu os mesmos valores |
| Privacidade | HTML/DOM do aluno04 após reload sem rascunho; status continuou SUBMITTED, sem Feedback publicado |
| Escopo fresco | Ação válida do professor2 alterada no POST serializado recebeu403; rascunho/status/version permaneceram iguais |
| Validação | Comentário obrigatório/notas completas; texto novo preservado após erro, sem substituir pelo rascunho salvo |
| Próxima entrega | Envio abre a próxima SUBMITTED na mesma atividade/turma/busca, limpa notas/texto e volta à primeira página |
| Última entrega | Segundo envio retorna à fila pendente vazia, sem selecionar novamente a corrigida |
| Persistência/resultado | Dois Feedback v1, notas7/9 e8/8, autor correto, rascunhos consumidos; aluno vê resultado após reload |
| Notificação interna | SQL TLS verificou duas FEEDBACK_RECEIVED com dedupe v1 e dois jobs notifications.create.v1 SUCCEEDED/attemptCount1; não comprova worker contínuo ou canal externo |
| Histórico/preview | Todos os feedbacks fora da atividade nova idênticos antes/depois; preview3000 permaneceu independente do QA3002 |

Correções: textarea controlado preserva comentário em erro; campos por entrega
reiniciam ao trocar aluno sem desmontar o controlador do rascunho; envio usa
redirect servidor após commit, inclusive na última entrega. Seleção seguinte
usa projeção id/findFirst na transação, autorização fresca, ordem submittedAt/id
e os filtros existentes. Sem migration, índice, cache de identidade ou provider.

Fixtures não devem ser resetadas: primeira atividade A2
`gestao-qa-mvp-a2-20261013` mantém o feedback gravado com texto do rascunho durante
a descoberta do bug (React resetava campo não controlado após validação).
Não reenviar/sobrescrever para limpar evidência. Rodada2 usa slug
`gestao-qa-mvp-a2-20261013-2`, duas entregas corrigidas, comentários exatos e
Feedback v1. Ambos os conjuntos são dados explícitos de QA, nunca de produção.

27 testes focados passaram, incluindo regressão vermelha→verde da preservação
do comentário. Retomada pós-build1/1/191s sem reenviar, pageErrors=[]/consoleErrors=[]; API
privada de notificações confirmou o feedback próprio sem o do outro aluno.
Gates finais check939/type16/boundaries871/727app/build8/performance/diff em STATUS; o fluxo acima
não aceita toda a matriz A2, Clerk real, fase ou quadro. Próxima unidade da
sequência: turma/cronograma/encontro → Aprender/calendário, reutilizando T2.

## Isolamento de atividades

Atividade sem curso e com destinatários caía no fallback global. Agora lista,
detalhe e guard de envio consultam as contagens das origens junto da projeção
existente. Ausência de acesso efetivo não abre atividade direcionada. Revogação,
expiração e FROM_JOIN continuam restritivos. Atividades legadas que nunca
tiveram destinatários continuam globais; curso/concessão individual/staff
continuam fontes independentes. Sem migration ou backfill. Oito regressões:
quatro falharam antes da correção; oito passaram depois.

## Backlog separado

- T2 e a unidade local A2 têm evidência acima. Próxima unidade: item2 da
  sequência. Criação/CSV/movimentação/duplicação de turma não recebem aceite
  integral por T2; A2 não encerra a matriz de todas as ações/perfis.
- A1: pesos inválidos na publicação real e versões completas continuam abertos.
  Worker contínuo/canais externos também; notificações internas desta A2 têm
  persistência e job concluído, não prova de entrega externa.
- Upload, curso/aula/playback e YouTube real; Clerk real; todas as ações/perfis,
  concorrência representativa, percentis e dispositivos físicos permanecem
  não verificados por essa unidade.
- Fidelidade dos 101 quadros, acabamento do Main/shell, acessibilidade completa,
  movimento e demais larguras permanecem no contrato. Nenhum quadro ou fase
  promovido: 0 aceitos, 42 em andamento, 59 pendentes.
- Comunidade/Medalhas ainda têm placeholder; `/gestao/previa` geral continua
  sem rota funcional. Não apresentar esses destinos como parte do MVP validado.

## Reexecutar e reverter

Para A2, mantenha preview3000 ativo e confirme que3002 está livre. Configure
`QA_MVP_A2_WRITE=true`, `QA_PLAYWRIGHT_MODULE` e `QA_CHROMIUM_EXECUTABLE` para
as instalações locais existentes. Execute `node scripts/qa/gestao-mvp-a2-local.mjs`.
O harness usa somente QA funcional/loopback55433/TLS validado, cria fixtures
aditivas se ausentes e retoma Feedback v1 concluído sem reenviar. Ele encerra
somente seus processos3002, com windowsHide, sem detached e com Webpack.

`INTERPRETE_LOCAL_DIST_DIR` aceita somente .next-local-<nome>, fora da Vercel;
padrão do harness .next-local-a2. Junction local para D: é configuração da
máquina, não parte do Git. Guia de cache/build isolado em
`docs/gestao-implementacao.md`. Os harnesses antigos que alternam preview3000
são evidência histórica; não reexecutá-los derrubando o preview atual.
QA auth não é Clerk; /health auth missing não demonstra autenticação real.

Reversão de código preserva fixtures e schema. Desligar `GESTAO_V2_ENABLED`
oculta a Gestão; não reabrir o fallback de acesso para simular reversão.
Durante a base local e QA integrado, nenhum push/merge/deploy ou alteração remota.
Após aprovação técnica, aplicar a estratégia vigente em GOAL/STATUS. Operações
destrutivas e transporte de fixtures para produção continuam proibidos.
