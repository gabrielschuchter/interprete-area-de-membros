# Registro compacto de execução — Gestão

> **Histórico congelado.** Não acrescente novas entradas. Para estado atual consulte `STATUS.md`; critérios e estratégia ficam em `MVP.md` e `GOAL.md`.

Registro preservado para rastreabilidade; as instruções de atualização acima foram substituídas. Não contém segredos ou dados pessoais.

| Data | Commit/unidade | Mudança concreta | Evidência | Limitação / próximo passo |
|---|---|---|---|---|
| 12/10/2026 | `f39de36` | Flags de autenticação local conjuntas | Testes/configuração; gates no diário | QA local não é Clerk real |
| 12/10/2026 | `9ee3053` | Seeds separados e schema aditivo de agenda | Guard local, fixtures e migrations posteriormente verificadas | Visual sem histórico Prisma |
| 12/10/2026 | `5581041` | Calendário de quatro fontes, exceções, cópia, ICS | QA de salvar/reload/revogação; capturas e gates | Menu por tipo e aceite visual pendentes |
| 12/10/2026 | `14cbf54` | Seleção de turma para aluno sem turma | Atribuir/reload/remover/reload | Matriz completa pendente |
| 12/10/2026 | `1bdf18a` | Escopo de alteração de encontro compartilhado | 6 testes focados; 12 capturas, gates | Matrizes reais e fidelidade pendentes |
| 12/10/2026 | `02fa927` | Política de entrada/publicação dos encontros; shell de QA do aluno | URLs before/after/direct; 613 testes app e gates | ICS do aluno/fluxos completos pendentes |
| 12/10/2026 | `d468e34` | Menu encontro/evento, formulário predefinido, publicação/rascunho persistentes e estilo tracejado | 14 testes focados; duas criações pela UI + reload + SQL TLS; 12 capturas | Faltam prazo/liberação pelo menu, editor completo, aluno e aceite C1/C2 integral |
| 12/10/2026 | Auditoria/handoff, identificar por `docs(gestao): hand off audited implementation state` | Contagem de quadros, inventário de rotas e sondagens reais; resumo vigente e instrução de continuidade | 0/101 aceitos; 53 rotas, 38 páginas, 18 matches exatos; 2 placeholders e prévia 404 | Trabalho interrompido a pedido do usuário; nenhuma fase promovida |
| 12/10/2026 | Unidade R1/R3, identificar por `fix(gestao): make rail and drawer navigation accessible` | Submenus do trilho por hover/toque/teclado; gaveta modal com Escape, foco contido/retornado, menu da conta aninhado e resize | Harness local 12/12; JSON/12 capturas em `output/playwright/gestao-v2/shell-navigation`; comparação com PNGs 30/93; gates em `output/gestao-shell-navigation` | GRail/GMMenu em andamento, sem aceite visual; Fase 1 e matriz completa continuam abertas; nenhum dado ou migration alterado |

| 12/10/2026 | Unidade N2/N3, identificar por `fix(gestao): preserve origin and coordinate environment navigation` | Origem sanitizada por aba/usuário após links sem `from` e reload; snapshots/fallback, foco/anúncio, offline/retry e limite de espera | 12/12 combinações, duração 400/120 ms, feedback 20,4–85 ms, CLS local zero; cinco testes novos e gates completos em `output/gestao-shell-entry` | N2 integral e quadros 13–17 sem aceite visual; matriz N1 e guard restrito são próximos; título após >4 s ainda sem aceite; preview admin visual reaberto |

| 13/10/2026 | N1/GRestrito, identificar por `fix(gestao): enforce private 403 responses before streaming` | Login com destino; negação fresca de membro/admin/turma no proxy e DAL, sem ciclo; estado restrito com retorno/ajuda | 47 testes focados; quatro atores, status HTTP 403, POST barrado, 36 capturas, no payload conferido; gates completos em `output/gestao-entry-permissions` | 0/101 aceitos; 39 em andamento; Clerk real, matriz de ações válidas e visual integral pendentes; P2002 de focus-timer é a próxima dependência; preview admin visual reaberto |

| 13/10/2026 | Dependência N1/N2, identificar por `fix(timer): avoid provisioning preferences during reads` | GETs do timer usam padrões sem criar preferências; Start explícito provisiona sem sobrescrever | 40 GETs/zero linhas; Starts 200/409/uma linha; Stop sem apagar; dois testes novos; browser e gates completos em `output/gestao-timer-preferences` | Timers de QA de student_02/03 preservados com revisão pendente; ciclo legado de expiração fora do escopo; foco tardio e visual da Fase 1 seguem pendentes |

| 13/10/2026 | N2/N3 título tardio, identificar por `fix(gestao): retain destination focus after arrival notice` | Observer de foco separado do aviso de 4 s; respeita diálogo e cancela na troca de rota | Sete testes focados; 12 combinações normais e 12 com h1 retido por 6 s; gates em `output/gestao-shell-late-title` | Atraso do DOM não é rede lenta real; visual, cronologia/stagger e demais unidades da Fase 1 continuam pendentes; próximo shell/visão geral |

| 13/10/2026 | `95c8aea` — Main/feedback | Count SQL compartilhado com fila, filtro paginado, negação de turma alheia, correção da paginação e papel fresco na transação; invalidação após feedback | UI funcional 4 → 3/reload, aluno/reload, formulário adulterado e replay 403; notificação interna/job SUCCEEDED após recovery local UTC; 30/30 na retomada, 48 capturas e gates completos em output/gestao-overview-feedback | 0/101 aceitos, 42 em andamento/59 pendentes; Main parcial, A1/rubrica/A2/próxima entrega/Clerk/worker agendado não aceitos; preservar feedback de student_04 |

| 13/10/2026 | `6316cb3` — Main/semana | Preservado diff de nove arquivos, agregado semanal real e prioridade MVP separada do contrato visual | 102/102 e 48 capturas anteriores auditadas; gates atualizados em output/gestao-mvp-week: check930/typecheck16/boundaries865/691app/build8/performance/diff | 0/101 aceitos; próximo ciclo atividade com rubrica e isolamento, sem bloquear por acabamento do Main; somente local |

| 13/10/2026 | MVP/atividade, identificar por `fix(gestao): keep targeted activities private and verify MVP journey` | Corrigido fallback global; professor publica com rubrica, aluno envia, professor corrige e aluno relê notas/comentário | 8 regressões; gravações iniciais/SQL/capturas1440/390/320; retomada multipart passa com 403/sem payload/pageerrors0; check932/typecheck16/boundaries866/699app/build8/performance/diff em output/gestao-mvp-activity | 0/101 aceitos; A1/A2 integrais/Clerk/YouTube/worker/fidelidade pendentes; desvio de QA criou feedback próprio do professor2, preservado e documentado em MVP.md; próximo T2 |

| 13/10/2026 | T2/goal, identificar por `fix(gestao): validate cohort membership MVP and fresh mutation roles` | Matrícula/acesso/reload/remoção; grant direto e histórico preservados; papel transacional, rótulo correto, keys únicas e quebra mobile | 8 regressões,707app e gates completos; browser-settled1/1/106s, URL403/ação alheia sem escrita; logs output/gestao-mvp-t2 | 0/101 aceitos; turma nova com três vínculos REMOVED/grant12 preservados; Clerk real/matriz integral/30dias pendentes; próximo A2 |

## Formato das próximas entradas

`Data | SHA | escopo e requisito fechado | teste/captura/log | pendências exatas`.

Antes de iniciar uma unidade, registrar no diário: requisito, arquivos principais,
critério de saída e o que já possui evidência. Ao terminar, informar se o critério
foi cumprido; se não foi, manter pendente e dizer exatamente por quê. Usar os
nomes dos cenários T1–T8/E1–E8/C1–C5 etc. para que cobertura seja rastreável.

### 13/10/2026 — início A2 / estratégia definitiva

Estado inicial limpo em058516e; preview3000 PID14224 e PG55433 PID7732
verificados. Requisito: rascunho privado persistente/retomada e próxima entrega
pendente filtrada após envio. Reusar ações/fila existentes; corrigir navegação e
identidade do formulário, testar versões/escopo e browser1440/390/320. Critério
de saída ainda pendente; estratégia integral e publicação condicionada em MVP.

### 13/10/2026 — A2 em execução; QA discreto e cache no D:

Base058516e preservada; nenhuma unidade nova encerrada/commitada ainda.
Estratégia vigente em GOAL/STATUS/MVP: base funcional inteira local → QA
integrado/correções → preflight/publicação autorizada condicionalmente. Goal
integral permanece ativo; nenhum push/merge/deploy/remoto nesta retomada.

A2 acrescenta seleção transacional da próxima pendente pelos filtros e papel
fresco. Formulário separa controlador de ação/campos por entrega, evitando
transportar notas/texto ou cancelar navegação quando o servidor troca a seleção.
23 testes focados de ação/navegação e3 de formulário passaram (inclui navegação
com props alteradas antes da resposta). Check938, boundaries870 e teste geral
723app/17domínio/9API passaram antes da última alteração do formulário; precisam
ser relidos/atualizados para o diff final. Typecheck anterior16/16 passou;
retentativa concorrente teve OOM emAPI/storybook. Build/performance ainda não
rodados neste diff; não registrar todos os gates como fechados.

Fixture A2 adicional slug gestao-qa-mvp-a2-20261013, atividade
cmv70flfx0000noypmsq4njxd, duas respostas novas04/02. Primeira resposta04
cmv70gke10000n0ypxkv6lr99 tem rascunho privado ainda não enviado. Um fill antes
da hidratação duplicou o texto do rascunho; harness passou a esperar props React
antes de editar e só retoma as duas formas exatas conhecidas desse rascunho
inacabado. Não resetar fixtures nem reenviar feedbacks concluídos. Browser A2
não aprovado: houve timeout, saída de runtime e ENOSPC; logs preservados em
output/gestao-mvp-a2. Rodada corrente browser-d-cache.log usa porta3002,
Webpack, windowsHide e processo sem detached; preview3000 independente.

Usuário relatou CMDs visíveis: wrapper passou a ocultar seu filho Next; QA A2
usa Webpack para evitar subprocessos Turbopack. Não encerrar CMDs alheios.
C: quase cheio; D: local NTFS saudável,25GiB livres e escrita confirmada.
Cache gerado1,08GB movido integralmente com caminhos absolutos verificados,
sem exclusão, para D:/CodexCache/interprete-gestao-20261013/next-a2-preserved.
Junction apps/app/.next-local-a2 mantém o caminho lógico/cache e novas escritas
no D:. .next-local-a2-d também aponta ao diretório preparado next-a2 (somente
marcador). C: recuperou de0,78GB para1,60GB; banco, fixtures, código e checkout
original não foram movidos. Preview3000 PID12524 (reinício automático do Next
por config), pai original35340; PG55433 PID7732 continuam ativos.

Próximo: concluir browser A2/histórico/privacidade/próxima e última entrega;
rodar gates finais sequencialmente, preferindo build isolado no D: com diretório
local validado e INTERPRETE_NEXT_DIST_DIR correspondente para performance.
Atualizar evidência/limitações e commit focado antes da unidade2 de MVP.md.

A primeira partida do cache no D: revelou resolução de módulos pelo caminho
físico, sem encontrar React. Foi criada junction node_modules no diretório
exclusivo D:/CodexCache/interprete-gestao-20261013 apontando às dependências
existentes de apps/app (sem copiar/reinstalar). Prova via createRequire do
caminho D: resolve react/jsx-runtime, next e @repo/database. QA retomado em
browser-d-resolved.log; isso ainda não comprova todo A2. Cache e dependências
continuam ignorados pelo Git. Não excluir recursivamente diretórios de junction.

### 13/10/2026 — A2: validação preserva comentário; rodada adicional explícita

Browser d-resolved comprovou rascunho parcial/reload, HTML do aluno sem
rascunho e POST alheio403/registro intacto. Ao tentar enviar sem todas as notas,
React resetou textarea não controlado para o rascunho anterior; depois o ensaio
enviou esse texto salvo em vez do novo comentário. É um bug de preservação
de campos após validação, não prova de bypass. O feedback já gravado na primeira
fixture A2 permanece preservado, sem reenviar/sobrescrever. Teste do componente
reproduziu exatamente saved first no lugar do texto novo (vermelho); textarea
controlado o corrigiu. Quatro testes de componente e23 de ações/navegação
passaram após o ajuste. Envio final agora usa redirect servidor após commit,
para continuar mesmo quando a última entrega desmonta o formulário da fila.

Nova fixture explícita de QA rodada2: gestao-qa-mvp-a2-20261013-2, atividade
cmv71ileu0000y0yp67ck1bwy. Harness espera hidratação antes de editar, verifica
que comentário sobrevive à validação e compara snapshots de todos os feedbacks
fora dessa nova atividade. Rodada atual browser-round2.log ainda em execução.
O cache webpack corrompido por ENOSPC foi movido, não apagado, para
D:/CodexCache/interprete-gestao-20261013/next-a2-preserved/dev/cache/webpack-before-enospc-20261013.
Logs/capturas da primeira A2 foram movidos ao D:/CodexCache/interprete-gestao-20261013/a2-first-logs;
junction no caminho anterior preserva referências. Novo cache é gerado no D:.
Typecheck serial16/16 passou; gates ainda precisam ser fechados no diff final.

| Data | Unidade | Mudança | Evidência | Próximo / limite |
|---|---|---|---|---|
| 13/10/2026 | A2 `347ba84`; runtime `406dd2d` | Comentário controlado, campos por entrega, redirect pós-commit/próxima filtrada; runtime QA oculto/isolado/cache D; estratégia base→QA→publicação |27 focados; browser1/1/621s+pós-build1/1/191s, API/notificação/job/histórico; check939/type16/bound871/727app/build8/perf/diff | Item2 MVP: turma/cronograma/encontro→Aprender/calendário. Sem fase/quadro promovido; goal integral ativo, produção condicionada ao QA completo |

### 13/10/2026 — início do item 2: turma → encontro → calendário do aluno

Requisito vigente em `MVP.md`: fechar publicação/liberação e as políticas de
entrada/saída integradas; encontro publicado deve aparecer ao aluno e rascunho
deve permanecer oculto. O recorte funcional pedido mantém a criação pelo dia,
retomada, edição/publicação, autorização fresca, reload e layouts 1440/390/320.

Provas existentes reutilizadas, sem repetir escritas: T2 (origens de acesso e
histórico preservados); criação de encontro publicado/rascunho pelo calendário,
persistência após reload e SQL, rascunho tracejado; resolvers de calendário e
política de encontro `ALL_ACTIVE`/`FROM_JOIN`; 14 testes focados registrados
em `STATUS.md`/`PROGRESS.md`. A página do aluno usa `getPublishedMeeting`.

Lacuna observada: o calendário da Gestão monta `/encontros/{id}` também para
rascunhos; esse destino filtra `PUBLISHED`. O diálogo atual só cria e encerra
após salvar; não permite retomar/editar/publicar depois. `updateMeeting` e
`setMeetingStatus` legados não demonstram escopo de turma nessa operação. A
política para encontro compartilhado exige responsabilidade por todas as
turmas-alvo e deve ser mantida com a validação do servidor.

Arquivos principais já localizados: `calendar-actions.ts`,
`calendar-occurrence-actions.ts`, `cohort-calendar-editor.tsx`,
`cohort-meeting-dialog.tsx`, `gestao-cohorts.ts`, `meetings.ts`, página
`/encontros/[id]` e testes/harness de calendário. Nenhuma implementação da
unidade começou neste registro.

Critério de saída: professor/admin cria ou retoma encontro; rascunho persiste,
aparece na Gestão e fica ausente da rota/calendário do aluno; editar/publicar
atualiza detalhe e calendário do aluno após reload; professor sem vínculo é
negado na rota/ação real; compartilhamento e histórico são preservados; sem
overflow em 1440/390/320. Reutilizar a criação, T2, resolvers e recorrência já
comprovados. Não reenviar nem resetar fixtures A2/T2. Sem promover fase/quadro.

Ambiente retomado para esta unidade: PID 12524 do preview3000 permaneceu ativo.
O PG local estava parado com PID salvo obsoleto; o mesmo PostgreSQL 17.10 foi
iniciado sobre o PGDATA existente, com loopback e SSL/TLS. Recovery nativo
concluiu e a rota `/gestao/alunos/turmas` voltou a HTTP 200; sem reseed,
restauração de backup ou alteração de fixtures.

### 13/10/2026 — item 2: encontro contextual editável/publicável

Implementação local: gestão de encontro DRAFT/PUBLISHED no contexto da turma,
com alvo compartilhado protegido pela responsabilidade sobre todas as turmas
ativas, papel/atribuição frescos, transação serializável, versão otimista,
idempotência, auditoria e revalidação. O editor reutiliza campos, validação,
fuso e recorrência; rascunhos passaram a abrir para edição em vez de apontar
para uma rota do aluno que os oculta. Planner recebeu o ajuste responsivo do
cabeçalho para 320 px.

QA funcional: a fixture cmv75fgiw0003foyptlld9yp6, na turma
cmv5mu5uh000vowyp56sgazpj, foi criada DRAFT, retomada após reload, editada e
publicada pela Professora QA Ana. Student04 não a viu antes da publicação e
recebeu 404 direto; depois viu calendário e detalhe após reload. Professor2
recebeu 403 na rota e no replay da Server Action real. SQL TLS confirmou que o
replay não alterou registro/auditoria; após publicação, status PUBLISHED,
um alvo ativo, zero exceções e quatro eventos. A fixture example.invalid é
somente de QA. Fixtures/históricos T2/A2 e demais feedbacks foram preservados.
Detalhe em output/gestao-mvp-item2/local-browser-smoke.md.

Sete testes focados, incluindo encontro legado sem término; gates finais
check941, typecheck16/16, boundaries873,
app734/domínio17/API9, scripts32 aprovados/1ignorado, build8/8,
performance:check e diff-check. Bundles Gestão calendário224,8KiB e
Planejamento224,6KiB/225KiB. Build/cache isolado em D: com URL local
documentada e banco QA/TLS; não é prova de Clerk ou produção. Nenhuma
migration, push, merge, deploy, escrita remota ou promoção de fase/quadro.
Goal integral ativo; próxima unidade item3, Ensino → aluno.
