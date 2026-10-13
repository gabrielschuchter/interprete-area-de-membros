# Handoff — finalizar a Nova Gestão do Interprete

## Prioridade atualizada em 13/10/2026

A instrução mais recente é avançar para **MVP funcional local**, sem esperar
aceite visual integral do Main ou dos 101 quadros. O texto copiado abaixo é
histórico; para prioridade/estado corrente, leia STATUS.md e o final de
PROGRESS.md. Permanecem 0/101 aceitos, 42 em andamento e 59 pendentes.
Fechar a unidade semanal preservada e escolher a jornada vertical mínima:
turma/conteúdo → aluno autorizado envia atividade → professor corrige → reload,
incluindo negação fora do perfil. Não reenviar o feedback QA de student_04.
Fidelidade/acabamento, Clerk/YouTube reais e cobertura completa são backlog
identificado, salvo bloqueio do MVP. Nenhuma fase promovida, nenhum push,
merge, deploy, banco remoto ou exclusão de dados autorizado.

## Texto para colar no próximo chat

```text
Retome a implementação completa da Nova Gestão do Interprete. O usuário
interrompeu o chat anterior após um fechamento local e uma auditoria real.
Não recomece o projeto nem trate código existente como produto aceito.

WORKTREE: C:\Users\gabsc\.codex\worktrees\interprete-gestao\interprete-area-de-membros
BRANCH: gestao-v2
NÃO EDITE C:\Users\gabsc\Documents\Codex\interprete-area-de-membros:
o checkout original tem alterações alheias ao trabalho.

Leia nesta ordem:
1. AGENTS.md e apps/app/AGENTS.md.
2. docs/gestao/STATUS.md e docs/gestao/EXECUTION-LOG.md.
3. GOAL.md, DECISIONS.md e início/últimos checkpoints de PROGRESS.md.
4. Este handoff completo, interprete-gestao-handoff/HANDOFF.md, docs/01–06,
   data/routes.json e HTMLs/PNGs da unidade a executar.

ESTADO REAL: 0/101 quadros aceitos; 31 em andamento, 70 pendentes.
Só a Fase 0 está concluída. Fase 1 sem aceite; Fase 2 é o foco;
Fases 3–5 têm código parcial; Fases 6–9 pendentes.
Encontros e Medalhas da Gestão ainda renderizam placeholder;
/gestao/previa renderiza 404. Isso foi observado no navegador admin local.

Trabalhe sozinho, sem perguntas nem delegação, em unidades pequenas.
Pode implementar localmente, criar migrations aditivas apenas no QA local,
usar seeds explícitos, validar e fazer commits focados em gestao-v2.
Proibidos: banco remoto/Production, push, merge, deploy/release,
migrations destrutivas, apagar dados e expor segredos.
O objetivo antigo pede produção e também a proíbe explicitamente;
não contorne esses limites. Reconcilie a autorização no ponto de publicação.

Primeiro feche o aceite da Fase 1, depois T1–T8/C1–C5 da Fase 2.
Use os nomes de GOAL.md, não os números do roadmap geral 1–10.
Não abra outro catálogo/editor antes de encerrar a unidade vertical escolhida.
Reutilize o que tem evidência, revalide o que depende do estado atual,
e implemente as lacunas. Build verde não substitui jornada ou comparação PNG.

Para cada unidade: registre requisito e critério de saída; implemente;
salve → reload → confira persistência e comportamento como aluno;
teste URL/ação fora do perfil; compare a referência; rode gates;
atualize STATUS.md, acrescente uma linha em EXECUTION-LOG.md e faça commit.
Nenhum [x] sem os 8 itens de GOAL.md §4. Não invente porcentagem por commits.

O preview local foi deixado para continuidade. Confira se está vivo
antes de reiniciar. Ambiente, evidências e pendências estão neste handoff.
```

## Git e última unidade

Baseline anterior: `02fa927 fix(gestao): enforce meeting cohort entry policy`.
O fechamento seguinte é `d468e34 feat(gestao): create cohort meetings from
calendar days`; auditoria/handoff usa `docs(gestao): hand off audited
implementation state`. Resolva os SHAs com `git log -5 --oneline`.

- `calendar-actions.ts`: `createGestaoCohortMeeting` cria Meeting canônico,
  vínculo e auditoria na mesma transação serializable; papel/ativação e escopo
  são relidos na transação. Versão da turma evita escrita perdida. Replay
  reautoriza e confere ator/turma/fingerprint antes de retornar o resultado.
- `cohort-meeting-dialog.tsx`: data/turma preenchidas, título/descrição,
  início/fim, fuso, repetição, link, rascunho/publicação com confirmação.
  Trava imediata de submit, feedback pendente, falha de rede tratada e campos
  preservados em validação; sucesso só após resposta persistida.
- `cohort-calendar-editor.tsx`: menu pelo número do dia com **Novo encontro**
  e **Evento da turma**. `calendario/page.tsx` fornece o nome da turma.
- `gestao.css`: rascunhos tracejados e estilos responsivos de menu/formulário.
- `calendar-meeting-actions.test.ts`: 14 testes focados de publicação,
  validação, rascunho, autorização fresca/escopo, concorrência de versão,
  replay/payload e turma arquivada.

## O que falta no calendário

1. O quadro 41 tem quatro entradas no menu; **Prazo de atividade** e **Liberar
   uma aula** pelo dia ainda faltam. Não adicionar controles decorativos nem
   links que percam a data/turma selecionadas.
2. Revisar área clicável/destaque do dia sem criar botões aninhados.
3. O diálogo novo cria encontros; não substitui o editor completo da Fase 6.
   Relacionados, participantes individuais, gravação, presença, autosave,
   guard de saída e edição posterior contextual permanecem por completar.
4. Auditoria `event.published` existe; não há prova de todas as notificações/jobs.
   `consumers: []` não representa notificação entregue.
5. C1/C2 não aceitos integralmente: faltam jornada desse novo encontro como
   aluno, outros perfis, fidelidade e restante do menu. Escape foi exercitado
   nos seis tamanhos; teclado completo/retorno de foco/leitor de tela pendentes.

## Ambiente local

- App: `http://localhost:3000/gestao/alunos/turmas`.
- Calendário da fixture visual Mentoria:
  `/gestao/alunos/turmas/cmv5no8ih0024kgyp2ew3ouke/calendario`.
- PostgreSQL 17.10: `127.0.0.1:55433`, TLS e CA verificados.
- Bancos: `interprete_gestao_qa_20261012` (funcional),
  `interprete_gestao_visual_qa_20261012` (visual).
- CA: `%TEMP%\interprete-gestao-qa-20261012\local-qa-ca.crt`.
- Member visual existente: `gestao_qa_visual_admin`; funcional admin:
  `gestao_qa_functional_admin`; aluno do QA de entrada:
  `gestao_qa_functional_student_01`. São IDs de fixtures, não credenciais Clerk.
- Variáveis necessárias: `NODE_ENV=development`, `GESTAO_DEV_AUTH=true`,
  `NEXT_PUBLIC_GESTAO_DEV_AUTH=true`, `GESTAO_DEV_AUTH_USER_ID` de Member local
  persistido, `GESTAO_V2_ENABLED=true`, URL pública localhost, URL de banco
  exclusivamente local e `DATABASE_CA_CERT_PATH`.
- Iniciar: `bun run --cwd apps/app dev`. Não inventar chaves Clerk/Supabase;
  não desabilitar TLS. O adaptador local não comprova Clerk real.
- Pause dev antes de build. Se o calendário cair no catch-all após a build,
  pare dev e preserve/renomeie só `.next/dev` neste worktree, depois reinicie.
  O cache anterior foi preservado em `.next/dev-before-entry-policy-qa-20261012`.
- `pg_hba.conf` tem regras temporárias hostssl/trust restritas aos dois bancos,
  usuário postgres e loopback. Ao encerrar **de vez** o preview, restaurar
  `%TEMP%\interprete-gestao-qa-20261012\pg_hba.before-live-preview-20261012.conf`
  sobre `postgres-data\pg_hba.conf` e executar `pg_ctl reload` no data-dir correto.
  Não restaurar enquanto o usuário ainda usa o preview. Veja `DECISIONS.md`.

## Fixtures e migrations

- Seed separada: `bun run db:seed:gestao`, perfil explícito functional/visual,
  development, `SEED_DEVELOPMENT_DATA=true` e destino QA exato. Não usar a seed
  ampla em `packages/database/prisma/seed.ts` sem auditoria.
- Migrations de agenda/publicação recentes estão aplicadas no funcional;
  visual tem schema sem `_prisma_migrations`. Rollback preserva dados/schema.
- Foram criados pela UI dois extras **no visual**: “QA local — encontro de
  handoff 20261012” (publicado em 19/10, 09h São Paulo) e “QA local — rascunho
  de handoff 20261012” (20/10, 09h). SQL TLS confirmou 12:00Z–13:00Z, um alvo
  ativo cada e publishedAt preenchido só no publicado. Preserve-os; eles
  alteram contagens/referências visuais. Não são dados de produção.
- Funcional também contém extras `gestao_entry_qa_` para antes/depois/convite
  direto. Nunca apagar fixtures para “limpar” a comparação de imagem.

## Evidências e limitações

- `output/gestao-final-audit/*.log`: logs separados dos gates de fechamento.
  Resultados consolidados no fim de `PROGRESS.md` e em `STATUS.md`.
- Build local usa `SKIP_ENV_VALIDATION=true` e URL local; não comprova
  credenciais/Clerk/banco de produção ou entrega pública.
- `output/playwright/gestao-v2/meeting-entry-qa-20261012.json`: negação,
  permitido e convite individual com ator de aluno local.
- `handoff-meeting-{largura}-{movimento}.png`: 12 capturas do novo formulário
  em 1440/1280/1024/820/390/320, normal/reduce, data preenchida, sem overflow
  ou pageerror na passada. Não são aceite visual.
- Capturas anteriores `calendar-entry-policy-20261012-{1440|320}.png` foram
  inspecionadas, e a desktop comparada ao PNG 41: shell/toolbar/itens/menu
  continuam divergentes. A referência PNG continua sendo o contrato.
- `/gestao/comunidade/encontros` e `/gestao/administracao/medalhas` mostraram
  placeholder; `/gestao/previa` mostrou 404. O streaming respondeu HTTP 200,
  que não prova rota operacional. Fonte atual: STATUS + JSON + Git.
- 53 rotas/38 páginas/18 matches são inventário de URLs, não taxa de conclusão.
  Percursos e listas têm código em caminhos diferentes do contrato.
- `docs/gestao-auditoria.md` é histórico inicial e ficou parcialmente obsoleto;
  os resolvers agora existem em content-access/student-feed/student-calendar.
- `requireStaff()` legado não equivale a escopo de turma. Auditar os caminhos
  legados que continuam alcançáveis, sem presumir proteção por UI.
- Houve 500 na primeira provisão concorrente de PlannerPreferences/focus-timer;
  leituras posteriores 200. Ensaio/correção específica ainda pendentes.
- publishedAt legado desconhecido usa createdAt como fallback, sem backfill.
- Clerk real, YouTube real, playback autenticado, percentis, concorrência,
  matriz completa de papéis e comparação dos 101 quadros não foram aceitos.
- Não foi comprovada remoção de todo marcador público de QA nos chunks SSR
  de produção; não declarar essa auditoria concluída.

## Regra de continuidade

Antes de implementar: requisito, arquivos principais, critério de saída e
evidência já existente. Depois: resultado real, teste/captura/log, lacunas e
SHA. Atualize `STATUS.md` e acrescente uma linha em `EXECUTION-LOG.md`.
Use T1–T8/E1–E8/C1–C5 etc. para rastrear cobertura. Não promover fases apenas
porque há código e gates. Não reauditar o repositório inteiro em cada ajuste.
