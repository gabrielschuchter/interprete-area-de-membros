# Registro compacto de execução — Gestão

Este registro complementa o Git e o diário histórico. Acrescentar uma linha por
unidade; não reescrever checkpoints antigos como se fossem estado atual.
O resumo vigente fica em `STATUS.md`. Não registrar segredos ou dados pessoais.

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

## Formato das próximas entradas

`Data | SHA | escopo e requisito fechado | teste/captura/log | pendências exatas`.

Antes de iniciar uma unidade, registrar no diário: requisito, arquivos principais,
critério de saída e o que já possui evidência. Ao terminar, informar se o critério
foi cumprido; se não foi, manter pendente e dizer exatamente por quê. Usar os
nomes dos cenários T1–T8/E1–E8/C1–C5 etc. para que cobertura seja rastreável.
