# Gestão — estado atual auditado em 12/10/2026

**Leia este arquivo antes do diário histórico. O produto está incompleto.**

## Resultado da auditoria

- Worktree autorizado: `C:\Users\gabsc\.codex\worktrees\interprete-gestao\interprete-area-de-membros`, branch `gestao-v2`.
- O checkout original em Documents tem trabalho alheio e não foi alterado.
- **0/101 quadros aceitos**, 33 em andamento e 68 pendentes no inventário de `PROGRESS.md`. GRail/GMMenu entraram em andamento na unidade de navegação da Fase 1.
- Só a Fase 0 (auditoria inicial) está registrada como concluída. Fase 1 sem aceite; Fase 2 é o foco; Fases 3–5 têm trabalho parcial; Fases 6–9 estão pendentes.
- 53 rotas no contrato; 38 arquivos `page.tsx` na Gestão; **18 correspondências exatas** após normalizar nomes de parâmetros. Os 35 caminhos sem correspondência incluem funcionalidades parcialmente disponíveis em rotas diferentes. Esses números **não medem telas prontas**.
- Inventário histórico da auditoria inicial: `estado-auditado-20261012.json` (31 em andamento naquele momento). A presença de arquivo não comprova funcionalidade, autorização ou fidelidade.
- Não houve push, merge, deploy ou escrita em banco remoto nesta execução.

## Evidência atual versus lacunas

| Área | Evidência inspecionada | O que não está concluído |
|---|---|---|
| Shell e entrada | Shell/flag, papel no servidor, retorno seguro e QA local; trilho com submenus e gaveta modal, ensaio local R1/R3 em 12 combinações de largura/movimento | Comparação integral dos quadros 13–30, transições, restante do teclado e matriz completa de papéis; GRail/GMMenu ainda divergem visualmente |
| Turmas | Páginas próprias, matrículas, atribuição de aluno sem turma, fixtures persistentes | T1–T8 completos no navegador; importação/movimentação/duplicação e isolamento de todos os perfis não têm aceite conjunto |
| Calendário | Quatro fontes, camadas, recorrência/exceções, cópia, ICS revogável; QA local anterior de persistência/revogação | Menu do dia só tem encontro/evento; prazo/liberação pelo menu faltam; fidelidade, calendário do aluno e matriz completa não aceitos |
| Novo encontro pelo dia | Publicado e rascunho criados pela UI, reload e leitura SQL confirmaram persistência/vínculo; rascunho tracejado; 14 testes focados | C1/C2 completos ainda precisam de navegação como aluno, demais papéis, edição completa e comparação visual |
| Acesso a encontros | Commit `02fa927`; publicação/atribuição e FROM_JOIN, histórico ALL_ACTIVE, convite individual; URLs locais de aluno verificadas | Política integrada de todas as fontes e ICS do aluno não têm aceite completo |
| Ensino | Páginas próprias de cursos, atividades, exercícios, biblioteca, coleções, percursos e aula; testes e bundles | Fluxos e fidelidade completos, upload/playback real, YouTube real e rotas canônicas divergentes |
| Envios/Aprender/correções | Resolvers existem em `content-access.ts`, `student-feed.ts`, `student-calendar.ts`; fila/rubrica têm código | Destaques/envios configuráveis, personalização e jornadas de aluno/correção ainda sem aceite |
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
- Funcional: `interprete_gestao_qa_20261012`; visual: `interprete_gestao_visual_qa_20261012`.
- CA: `%TEMP%\interprete-gestao-qa-20261012\local-qa-ca.crt`.
- Migrations aditivas recentes: `20261012180000_cohort_calendar_projection` e `20261012223000_meeting_publication_time`, aplicadas no funcional. Visual tem schema, mas **não** tem `_prisma_migrations`; não afirmar aplicação versionada nele.
- Releitura SQL no fechamento confirmou as duas migrations terminadas sem rollback no funcional e RLS ativo em `CohortCalendarFeed`, `CohortEventOccurrenceException`, `MeetingCohortTarget` e `MeetingOccurrenceException`, por conexão loopback com TLS validado.
- O visual contém **dois extras preservados de QA**: “QA local — encontro de handoff 20261012” (publicado, 19/10 às 09h São Paulo) e “QA local — rascunho de handoff 20261012” (rascunho, 20/10 às 09h). Ambos têm um vínculo ativo com Mentoria. Eles alteram as contagens visuais; não são dados de produção.
- Funcional também tem extras `gestao_entry_qa_` para política de entrada. Não apagar registros para reproduzir imagens.
- `pg_hba.conf` recebeu regras temporárias `hostssl/trust` só para os dois bancos QA, usuário postgres e loopback. Ao **encerrar** o preview, restaurar `%TEMP%\interprete-gestao-qa-20261012\pg_hba.before-live-preview-20261012.conf` sobre `postgres-data\pg_hba.conf` e executar `pg_ctl reload` no data-dir correto. Procedimento em `DECISIONS.md`.

## Qualidade e capturas

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
3. Fechar o aceite da Fase 1; depois T1–T8/C1–C5 da Fase 2. Reutilizar o código e as fixtures existentes. A aparência do quadro 41 continua divergente.
4. Atualizar este resumo, adicionar uma linha em `EXECUTION-LOG.md`, anexar a evidência e commitar. Nenhum `[x]` sem os 8 requisitos.
5. Só depois avançar o aceite das fases seguintes. Os números de fases são os de `GOAL.md`, não os do roadmap geral 1–10.
