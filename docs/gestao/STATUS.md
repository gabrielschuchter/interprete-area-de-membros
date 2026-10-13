# Gestão — estado atual atualizado em 13/10/2026

## Estratégia vigente — base local → QA integrado → produção (13/10/2026)

A instrução mais recente do usuário substitui as proibições históricas de
publicação **somente após** duas condições: toda a base funcional local estar
concluída e o QA integrado estar aprovado tecnicamente. Até lá, nenhum push,
merge, deploy ou alteração remota. Depois, integração/publicação autorizadas
pelo fluxo do repositório, com preflight Clerk/Supabase/Vercel, migrations
aditivas, integridade e smoke real. Bloqueio crítico impede a publicação.
Nunca transportar fixtures de QA nem executar operações destrutivas.

O goal ativo cobre a entrega inteira até produção; fechar uma unidade MVP
não encerra o objetivo final. Preview localhost:3000 permanece ativo; runtimes de QA
usam porta e distDir próprios, sem matar processos alheios. Banco, fixtures e
histórico são preservados. Evidência funcional local, integração real e aceite
visual são registros distintos. Os 101 quadros permanecem referência; nenhum
quadro/fase muda de status por gate verde ou pela prioridade de MVP.

Sequência e critérios de saída em `docs/gestao/MVP.md`. Checkpoints anteriores
abaixo são históricos quando divergirem desta instrução.


**Leia este arquivo antes do diário histórico. O produto está incompleto.**

## Unidade mais recente — item 2: turma → encontro → calendário do aluno (13/10/2026)

Fechado funcionalmente em QA local, sem promover fase/quadro. Na turma QA
ativa cmv5mu5uh000vowyp56sgazpj, a professora criou o encontro
cmv75fgiw0003foyptlld9yp6 como rascunho, saiu/recarregou, retomou, editou e
publicou. O registro foi relido por PostgreSQL com TLS: PUBLISHED,
publishedAt preenchido, um alvo ativo, zero exceções e quatro eventos de
auditoria. A edição preservou turma/alvo e histórico.

Antes da publicação, student04 não viu o encontro no calendário e recebeu 404
na rota direta. Depois, Planejamento/calendário mostrou o encontro após reload;
detalhe do aluno também mostrou título/descrição/link após reload. Professor2
recebeu 403 na rota da Gestão e a repetição da Server Action real, capturada
na sessão autorizada e enviada no perfil alheio, retornou 403. A leitura TLS
posterior confirmou descrição/status/updatedAt sem alteração e nenhuma
auditoria nova. É autorização do adaptador local de QA, não prova de Clerk real.

Editar/publicar reaproveita o escopo server-side de todas as turmas-alvo
ativas, papel/atribuição frescos, transação serializável, versão otimista,
idempotência, auditoria e revalidação. Fixtures T2/C1/C2 anteriores foram
reutilizadas sem reenvio/reset. A fixture nova tem link example.invalid e deve
permanecer somente em QA; não copiar para produção.

Browser pós-reload: Gestão e calendário do aluno sem overflow em 1440/390/320;
consoleErrors=0 na sessão do aluno e da professora. Sete testes focados
passaram, incluindo encontro legado sem horário final. Gates: check941 arquivos, typecheck16/16, boundaries873; app734,
domínio17, API9; scripts32 aprovados/1 ignorado; build8/8; performance e
diff-check aprovados. Bundles de Gestão calendário224,8KiB e Planejamento
224,6KiB, cada um abaixo do orçamento225KiB com margem estreita. Build usa
dist/cache isolado no D:, URL local documentada e conexão QA TLS; não comprova
credenciais Clerk/Supabase/Vercel reais, deployment, QA integrado ou aceite
visual.

Preview3000 permaneceu PID12524/HTTP200 e checkout original não foi tocado.
O goal integral segue ativo. Próxima unidade: item3, Ensino → aluno, conforme
MVP.md. A base funcional completa, QA integrado e preflight de produção ainda
estão pendentes.

## Unidade anterior — A2 funcional local verificada

Rascunho parcial salvo → sair/reload/retomar → aluno sem payload privado →
professor alheio403 → validação preserva comentário → envio/próxima pendente
filtrada com campos limpos → última entrega/fila vazia → aluno/reload.
Browser rodada2 passou1/1 em621s (compilação/troca de perfis incluídas).
Pós-build, retomada sem reenviar passou1/1 em191s, pageErrors=[] e
consoleErrors=[]; notas7/9 e8/8, Feedback v1, API privada de notificações com
registro próprio e sem o do outro aluno, dois jobs SUCCEEDED/attemptCount1.
Histórico externo à nova atividade idêntico antes/depois. Capturas1440/390/320
sem overflow são funcionais, não comparações com quadros.

Correções: comentário controlado sobrevive a erro; campos reiniciam por entrega;
redirect servidor após commit abre próxima/última mesmo com formulário desmontado.
Primeira fixture A2 com texto anterior enviado durante descoberta do bug está
preservada; não reenviar/sobrescrever. Rodada2 usa
`gestao-qa-mvp-a2-20261013-2`. Detalhes/fixtures em MVP.md.

Gates finais: check939, typecheck16/16, boundaries871;727app/17domínio/9API,
32scripts aprovados/1ignorado; build8/8, performance/diff. Main214,6KiB,
Correções215,4KiB, Calendário223,8KiB, Planejamento224,5KiB (teto225).
Logs em output/gestao-mvp-a2; JSON/capturas em
output/playwright/gestao-v2/mvp-a2-round2. Build isolado no D: com QA auth
false; browser pós-build é runtime dev de QA, não Clerk/produção reais.

Preview3000 e PG55433 permanecem ativos; somente QA3002 é encerrado pelo
harness. Caches/builds no D: por junctions locais ignoradas, processos ocultos;
cache corrompido e logs anteriores preservados. Guia em gestao-implementacao.md.
Sem migration, push, merge, deploy ou escrita remota. Sem promover fase/quadro:
0/101 aceitos,42 em andamento,59 pendentes. A2 não encerra matriz integral,
worker contínuo ou QA de todas as seções. Próxima unidade: item2 de MVP.md,
turma/cronograma/encontro → Aprender/calendário; goal integral continua ativo.

## Registro histórico — prioridade de MVP funcional local (13/10/2026)

Este checkpoint é anterior à estratégia de publicação condicional descrita
no início deste arquivo. Seus critérios de produto continuam válidos; a regra
de publicação vigente é a mais recente do usuário e não deve ser inferida do
texto histórico abaixo.

Instrução de 13/10/2026 substitui a prioridade de fechar todo o Main/shell
visualmente antes de continuar. Entregar em unidades verticais: gestão de
turma/conteúdo → acesso autorizado do aluno → envio de atividade → correção
→ resultado após reload, com negação real fora do perfil. Reutilizar código
e fixtures já comprovados; não abrir outro catálogo antes de fechar a unidade.

**MVP funcional** exige persistência, permissões server-side, desktop/mobile
sem overflow, controles operacionais e gates aplicáveis. **Backlog de contrato**:
101 comparações visuais, acabamento, Clerk/YouTube reais, matriz integral,
percentis e dispositivos. Se um item bloquear a jornada MVP, volta ao caminho
crítico. Nenhum quadro/fase é promovido por essa mudança de prioridade.
Limites mantidos: somente local, sem push/merge/deploy/banco remoto/exclusão.

## Resultado da auditoria

- Worktree autorizado: `C:\Users\gabsc\.codex\worktrees\interprete-gestao\interprete-area-de-membros`, branch `gestao-v2`.
- O checkout original em Documents tem trabalho alheio e não foi alterado.
- **0/101 quadros aceitos**, 42 em andamento e 59 pendentes no inventário de `PROGRESS.md`. Main/GVisaoAdmin/GVisaoLimpa têm o primeiro trecho real de feedback/filtro, sem aceite integral.
- Só a Fase 0 (auditoria inicial) está registrada como concluída. Fase 1 sem aceite; Fases 2–5 têm trabalho parcial; Fases 6–9 estão pendentes. A prioridade vigente é a jornada MVP, mantendo o aceite integral separado.
- 53 rotas no contrato; 38 arquivos `page.tsx` na Gestão; **18 correspondências exatas** após normalizar nomes de parâmetros. Os 35 caminhos sem correspondência incluem funcionalidades parcialmente disponíveis em rotas diferentes. Esses números **não medem telas prontas**.
- Inventário histórico da auditoria inicial: `estado-auditado-20261012.json` (31 em andamento naquele momento). A presença de arquivo não comprova funcionalidade, autorização ou fidelidade.
- Não houve push, merge, deploy ou escrita em banco remoto nesta execução.

## Evidência atual versus lacunas

| Área | Evidência inspecionada | O que não está concluído |
|---|---|---|
| Shell e entrada | R1/R3, N2/N3 e N1 locais; HTTP 403 e ausência de payload; timer sem provisionar preferências no GET; foco tardio por 6 s. Main conta feedback e números semanais reais com filtro de turma; abre a fila correspondente | Comparação integral 13–30; Main ainda sem outras categorias de atenção, próximos encontros, movimentação, Institucional e atalhos/prévia; shell/topbar divergente, stagger/timing integral, restante do teclado, leitor de tela, Clerk reais, matriz de todas as ações e rede lenta real pendentes |
| Turmas | T2 funcional local: criar turma/curso, matricular três alunos, acesso/reload, remover, revogar só origem da turma, preservar grant direto e histórico; URL alheia403 e ação alheia recusada | T1–T8 completos, concessão temporária, CSV/movimentação/duplicação e matriz integral não têm aceite conjunto |
| Calendário | Quatro fontes, camadas, recorrência/exceções, cópia e ICS revogável; edição/publicação contextual do encontro, rascunho oculto ao aluno e calendário/detalhe após reload comprovados em QA local | Prazo/liberação pelo menu do dia, fidelidade, restantes das políticas combinadas e matriz completa não aceitos |
| Novo encontro pelo dia | Criar e retomar rascunho, editar/publicar pela turma, reload, SQL/TLS, calendário e detalhe do aluno; professor alheio 403 na rota e na Server Action; 7 testes focados | C1/C2 e calendário completo não aceitos; ficam pendentes outras combinações de acesso/perfis, restante do menu e comparação visual |
| Acesso a encontros | Commit `02fa927`; publicação/atribuição e FROM_JOIN, histórico ALL_ACTIVE, convite individual; URLs locais de aluno verificadas | Política integrada de todas as fontes e ICS do aluno não têm aceite completo |
| Ensino | Páginas próprias de cursos, atividades, exercícios, biblioteca, coleções, percursos e aula; testes e bundles | Fluxos e fidelidade completos, upload/playback real, YouTube real e rotas canônicas divergentes |
| Envios/Aprender/correções | Jornada MVP local: professor publica atividade com rubrica, aluno envia, professor corrige, aluno vê comentário/notas após reload; aluno alheio sem payload e professor alheio 403 na ação | Destaques/envios configuráveis, personalização, A1/A2 integrais, notificações contínuas e comparação visual continuam sem aceite |
| Comunidade | `/gestao/comunidade/encontros` abriu **“Este fluxo está sendo conectado”** no browser admin local | Página/editor editorial de encontros, publicações, grupos e avisos da Gestão |
| Administração | `/gestao/administracao/medalhas` abriu **“Este fluxo está sendo conectado”** | Gestão de membros/acessos/medalhas/integrações/auditoria completa |
| Ver como aluno | `/gestao/previa` renderizou **404** no browser admin local | Prévia contextual com acesso do aluno e bloqueio de escrita |

As três sondagens de rotas acima retornaram HTTP 200 pelo streaming do Next;
o conteúdo renderizado é a evidência. HTTP 200 não indica tela funcional.

## Por que o trabalho não fechou fases

O histórico mostra expansão para Ensino e Correções antes de aceitar Shell e
Turmas. Houve commits e validações de código reais, mas eles não fecharam o
contrato de produto: jornadas, permissões, todos os controles e fidelidade.
O diário acumulou checkpoints com limitações posteriormente superadas, sem
um resumo atual suficientemente claro. A auditoria inicial também ficou
desatualizada (por exemplo, dizia que os resolvers ainda não existiam).

**Não falta código apenas. Falta fechar unidades de aceite, sem recomeçar as
que já têm evidência e sem chamar gates verdes de conclusão do produto.**

## Ambiente e dados

- Preview: `http://localhost:3000/gestao/alunos/turmas`; adaptador de QA local com admin visual, sem Clerk real.
- PostgreSQL local: `127.0.0.1:55433`, TLS com CA validada.
- Após reinício do ambiente em 13/10, faltavam diretórios auxiliares no PGDATA. Cópia física preservada em `%TEMP%/interprete-gestao-qa-20261012/postgres-data-before-directory-recovery-20261013`; somente diretórios ausentes recriados. PostgreSQL fez recovery normal do WAL. SQL TLS confirmou os dois bancos, contagens e os dois encontros de handoff preservados; log `output/gestao-entry-permissions/db-recovery.log`. Sem initdb/reset de WAL ou exclusão.
- Funcional: `interprete_gestao_qa_20261012`; visual: `interprete_gestao_visual_qa_20261012`.
- CA: `%TEMP%\interprete-gestao-qa-20261012\local-qa-ca.crt`.
- Migrations aditivas recentes: `20261012180000_cohort_calendar_projection` e `20261012223000_meeting_publication_time`, aplicadas no funcional. Visual tem schema, mas **não** tem `_prisma_migrations`; não afirmar aplicação versionada nele.
- Releitura SQL no fechamento confirmou as duas migrations terminadas sem rollback no funcional e RLS ativo em `CohortCalendarFeed`, `CohortEventOccurrenceException`, `MeetingCohortTarget` e `MeetingOccurrenceException`, por conexão loopback com TLS validado.
- O visual contém **dois extras preservados de QA**: “QA local — encontro de handoff 20261012” (publicado, 19/10 às 09h São Paulo) e “QA local — rascunho de handoff 20261012” (rascunho, 20/10 às 09h). Ambos têm um vínculo ativo com Mentoria. Eles alteram as contagens visuais; não são dados de produção.
- Funcional também tem extras `gestao_entry_qa_` para política de entrada. Não apagar registros para reproduzir imagens.
- `pg_hba.conf` recebeu regras temporárias `hostssl/trust` só para os dois bancos QA, usuário postgres e loopback. Ao **encerrar** o preview, restaurar `%TEMP%\interprete-gestao-qa-20261012\pg_hba.before-live-preview-20261012.conf` sobre `postgres-data\pg_hba.conf` e executar `pg_ctl reload` no data-dir correto. Procedimento em `DECISIONS.md`.

## Qualidade e capturas

- T2/goal local: turma nova `cmv6vx0ga000048ypclxtji6x` criada por professor1,
  curso publicado vinculado, alunos04/11/12 matriculados/removidos pela UI e
  relidos após reload. Aluno11 ganha e perde acesso somente pela turma;12
  mantém grant DIRECT criado pelo admin. Histórico04 e grant12 idênticos.
  Professor2 recebe URL403; Server Action válida adulterada no POST retorna
  not-found sem escrita (HTTP200 é envelope de erro tipado, não sucesso).
  `browser-settled` passou1/1 em106s, errors=[]; capturas1440/390/320 e logs
  em `output/playwright/gestao-v2/mvp-t2` / `output/gestao-mvp-t2`.
  Oito regressões do guard transacional passaram; papel/ativação frescos antes
  de lookup/replay. Corrigidos rótulo de remoção e keys duplicadas no cronograma.
  Smoke adicional achou cabeçalho de aulas transbordando329px em320; flex-wrap
  mobile específico aplicado, sem esconder o overflow global. Gates de código:
  check934, typecheck16/16, boundaries867,707app/17domínio/9API,
  32scripts aprovados/1ignorado,build8/8/performance/diff. Main214,6KiB,
  Calendário223,8KiB,Planejamento224,5KiB (teto225). Logs finais build-closed.
  Fixtures novas preservadas: turma ativa/vazia, curso vinculado, três
  memberships REMOVED e grant DIRECT12. Sem exclusão/migration/remoto.
  Clerk real, matriz integral e concessão30dias não são prova desta unidade;
  nenhum quadro/fase promovido. Próximo A2 privado/retomada/próxima entrega.
  Fechamento pós-ajuste: `browser-closed`1/1/73s,errors=[], cronograma/roster
  1440/390/320 sem overflow; audit.json confirma histórico/grant e matrícula
  original04 preservados. Preview admin visual/Main renderizado restaurados.

- Jornada MVP/atividade com rubrica: turma funcional existente, professor 1
  criou rascunho/publicou pela UI, student_04 enviou texto, professor gravou
  notas 8/9 e comentário, aluno viu ambos após reload. Fixture adicional
  `gestao-qa-mvp-atividade-20261013` preservada. O fallback global indevido
  foi corrigido em lista/detalhe/guard de envio; quatro regressões vermelhas
  antes e oito verdes depois. Outro aluno sem título/payload na URL direta;
  professor alheio não seleciona a entrega e ação adulterada retorna 403.
  Capturas 1440/390/320 em `output/playwright/gestao-v2/mvp-activity`; logs em
  `output/gestao-mvp-activity`. Não é Clerk real nem A1/A2 integral.
  Gates: check932, typecheck16/16, boundaries866, 699app/17domínio/9API,
  32scripts aprovados/1ignorado, build8/8, performance/diff. Main214,6KiB,
  Correções215,3KiB, Planejamento224,5KiB; teto225KiB. Sem migration/remoto.
  Desvio do harness pós-build: hidratação restaurou hidden IDs e enviou
  feedback à entrega própria `cmv5mu60x001powyp9wvyj1wh` do professor 2,
  agora REVIEWED/Feedback v1; preservado, não resetar. POST serializado
  substitui a adulteração do DOM. SQL TLS confirma intactos o feedback
  protegido anterior e a nova rubrica. Detalhes e limites em `MVP.md`.
  Fechamento `browser-serialized.log`: 1/1 passou em45s, cinco campos alterados,
  HTTP403/registro intacto, HTML do aluno sem payload, pageErrors=[], smoke
  1440/390/320 sem overflow; preview admin visual restaurado.

- Main/semana preservado e fechado como unidade local de MVP em 13/10:
  agregado SQL por papel/turma, alunos únicos, união de intervalos, segunda
  em São Paulo, comparação com período equivalente e denominador vazio.
  Logs anteriores inspecionados: 102/102 verificações, 48 capturas em quatro
  perfis/seis larguras/dois movimentos; JSON em `overview-week`, logs em
  `output/gestao-overview-week`. Não se repetiu seed nem feedback anterior.
  Gates finais no diff corrente: check 930, typecheck 16/16, boundaries 865,
  691 app/17 domínio/9 API, 32 scripts aprovados/1 ignorado; build 8/8,
  performance e diff aprovados em `output/gestao-mvp-week`. Build local com
  flags QA desligadas e TLS/URL de banco local, sem validação externa de env.
  MVP do bloco não é aceite visual, Clerk real ou conclusão de Main/fase.
  Próxima unidade: atividade com rubrica, corrigindo fallback global indevido
  para conteúdo sem curso com destinatários e provando envio/correção/reload.

- Main/feedback parcial (`95c8aea`): matriz com admin, dois professores, membro e professor
  visual sem vínculo; count/filtro/reload iguais ao SQL e à fila, turma alheia
  403, busca vazia preservando contagem. 48 capturas de filtro em seis larguras
  e dois movimentos, sem overflow/pageerror. Feedback real de student_04
  persistido por teacher_1, resposta preservada, contagem 4 → 3 após reload;
  teacher_2 recebeu 403 no formulário adulterado e replay válido; aluno vê
  comentário após reload. Uma notificação interna e job SUCCEEDED confirmados
  após recuperação local explícita. Log inicial browser-write-visible prova
  a gravação; browser-write-recovered passou 30/30 retomando sem reenviar.
  JSON/capturas em overview-feedback; logs em output/gestao-overview-feedback.
  PNG 23 comparado: blocos/atalhos ausentes e shell/topbar divergentes; nenhum
  quadro aceito. Rubrica dessa fixture é versão 0: não comprova A1 integral,
  próxima entrega automática de A2, worker agendado ou serviço externo.
  Gates: check 925, typecheck 16/16, boundaries 862, testes 682 app/17 domínio/
  9 API e 32 scripts aprovados/1 ignorado; build 8/8, performance/diff.
  Main 214,6 KiB/17 chunks; Calendário 223,8, Planejamento 224,5 e Ferramentas
  222,9 KiB, teto 225. Preview visual reaberto em loopback e smoke 1440/390/320
  com reload, sem overflow/pageerror. Funcional usa UTC; visual preservado.

- N2/N3 título tardio: sete testes focados (dois novos), 12/12 atrasados e
  12/12 normais, mais offline/fallback/retorno. Retenção do DOM por 6 s é
  controlada; não comprova rede lenta real. Foco respeita diálogo e cancela
  na troca de rota. Feedback normal 13,77–38,82 ms, CLS normal zero; CLS
  artificial da rodada atrasada não é métrica da rota. Gates: check 917,
  typecheck 16/16, boundaries 857, 662 app/17 domínio/9 API e 32 scripts
  aprovados/1 ignorado; build 8/8, performance/diff. Calendário 223,8 KiB,
  Planejamento 224,5 KiB, Ferramentas 222,9 KiB. Logs em
  `output/gestao-shell-late-title`; capturas/JSON em `shell-entry-delayed`
  e `shell-entry`. Nenhum quadro/fase aceito; preview admin visual ativo.

- Dependência de entrada/cronômetro: dois testes novos, 40 GETs reais e um
  início concorrente 200/409; zero linhas de preferências após os GETs, uma
  após Start e zero timers ativos após Stop. Registros de student_02/03
  preservados com revisão pendente, sem estudo registrado ou exclusão.
  Browser Biblioteca → Gestão → reload: duas respostas de timer 200, sem
  pageerror, preferências do admin visual inalteradas. Gates: check 917,
  typecheck 16/16, boundaries 857, 660 app/17 domínio/9 API e 32 scripts
  aprovados/1 ignorado; build 8/8, performance/diff. Calendário 223,7 KiB,
  Planejamento 224,5 KiB, Ferramentas 222,8 KiB (teto 225). Logs em
  `output/gestao-timer-preferences`, JSON/captura em `timer-preferences`.
  Nenhum novo quadro/fase aceito; preview admin visual ativo.

- N1/GRestrito: 47 testes focados; quatro atores locais com HTTP 403 e payloads
  negados conferidos; POST barrado antes do despacho; 36 capturas em seis
  larguras/dois movimentos sem overflow/pageerror, Escape e foco restaurado.
  Gates: check 915 arquivos, typecheck 16/16, boundaries 856, 658 testes app,
  17 domínio/9 API e 32 scripts aprovados/1 ignorado; build 8/8,
  performance:check/diff passaram. Calendário 223,7 KiB/18 chunks e
  Planejamento 224,5 KiB/17, teto 225 KiB. Logs em
  `output/gestao-entry-permissions`; JSON/capturas em `entry-permissions`.
  Referência 27 comparada; fonte/medidas ajustadas, shell ainda divergente.
  Preview visual reaberto após build; sem migration ou alteração de fixtures.

- N2/N3: harness 12/12 mais offline/retry/fallback; duração nativa 400/120 ms,
  feedback 20,4–85 ms e CLS local zero. Cinco testes novos; check 910 arquivos,
  typecheck 16/16, boundaries 852, testes 632 app/17 domínio/9 API e 32 scripts
  aprovados/1 ignorado, build 8/8, performance/diff passaram. Calendário
  223,7 KiB/18 chunks; Planejamento 224,5 KiB/17 (teto 225 KiB). Logs em
  `output/gestao-shell-entry/`; JSON/capturas em `shell-entry/`. Comparação de
  15/17 registra divergências, sem aceite. Espera >4 s agora coberta pelo
  atraso controlado descrito acima; rede real segue pendente. Build com NODE_ENV não definido no orquestrador e flags
  QA desligadas; Next gera produção, sem comprovar credenciais ou entrega.

- Unidade local R1/R3: harness 12/12 combinações de largura/movimento, sem pageerror/overflow, em `output/playwright/gestao-v2/shell-navigation/`. Comparação de 30/93 realizada com diferenças registradas; nenhum quadro aceito.
- Gates da unidade R1/R3 passaram: check 905 arquivos, typecheck 16/16, boundaries 848, testes 627 app/17 domínio/9 API e 32 scripts aprovados/1 ignorado, build 8/8, performance:check e diff. Logs em `output/gestao-shell-navigation/`. Calendário 222,7 KiB/18 chunks; Planejamento 223,5 KiB/17 (teto 225 KiB). Build com URLs locais, sem autenticação QA de desenvolvimento; não comprova Clerk/produção.

- Baseline `02fa927`: 613 testes app, 17 domínio, 9 API e 32 scripts aprovados/1 ignorado; gates completos registrados no diário.
- Unidade de fechamento `d468e34`: 14 testes focados; gates finais passaram: check 904 arquivos, typecheck 16/16, boundaries 848, testes 627 app/17 domínio/9 API e 32 scripts aprovados/1 ignorado, build 8/8, performance:check e git diff --check. Logs em `output/gestao-final-audit/*.log`.
- Calendário: 222,2 KiB gzip/18 chunks; Planejamento: 223,5 KiB/17, abaixo do teto de 225 KiB. Build usa validação externa de ambiente dispensada; não comprova produção.
- `output/playwright/gestao-v2/handoff-meeting-{largura}-{movimento}.png`: 6 larguras × 2 modos; data preenchida, Escape fechou, nenhum overflow do documento nem `pageerror` durante a passada.
- Não houve aceite visual dessas 12 imagens. Capturas anteriores `calendar-entry-policy-20261012-{1440|320}.png` foram inspecionadas; a desktop foi comparada ao PNG 41 e apresenta diferenças de shell/toolbar/itens/menu.
- Percentis, concorrência representativa, Clerk real, comparação completa dos 101 quadros e testes de todos os cenários de `docs/05` **não estão comprovados**.

## Próxima execução

1. Ler `HANDOFF-PROXIMO-CHAT.md`, este estado, `GOAL.md`, `DECISIONS.md` e o trecho relevante do diário.
2. Escolher uma unidade vertical com critério de saída e casos de teste nomeados. Não reauditar todo o repositório a cada pequeno ajuste.
3. Main/semana, atividade/rubrica, T2, A2 e item2 de turma/encontro têm provas locais separadas em STATUS/MVP/PROGRESS. Próxima unidade da sequência: item3, Ensino → aluno. Reutilizar CRUDs/serviços e fixtures autorizadas; preservar os históricos já verificados. Aparência dos 101 quadros continua separada.
4. Atualizar este resumo, adicionar uma linha em `EXECUTION-LOG.md`, anexar a evidência e commitar. Nenhum `[x]` sem os 8 requisitos.
5. Manter aceite integral separado do MVP. Os números de fases são os de `GOAL.md`, não os do roadmap geral 1–10.
