# Interprete · Sala de Aula (aulas gravadas) · Pacote de handoff para implementação

Este pacote reúne tudo o que o Codex precisa para implementar a Sala de Aula validada, de ponta a ponta: rotas, dados, lógica, estados, textos, QA e plano de execução. O produto já existe em parte. Por isso o pacote começa por **descobrir o que há no repositório** e só depois constrói.

## Ordem de leitura

| # | Arquivo | Para quê |
|---|---|---|
| 00 | `00-PROMPT-CODEX.md` | Prompt mestre. Cole inteiro no Codex. Regras inegociáveis, fases, formato do relatório. |
| 01 | `01-contexto-e-decisoes-travadas.md` | O que é, o que não é, decisões validadas (LD-xx). |
| 02 | `02-descoberta-do-repositorio.md` | Fase 0: mapear o repositório antes de escrever código. |
| 03 | `03-rotas-e-navegacao.md` | Todas as rotas, guardas, redirecionamentos, links, teclado. |
| 04 | `04-modelo-de-dados.md` | Entidades, campos, migrações, RLS, compatibilidade com o que existe. |
| 05 | `05-api-e-acoes.md` | Leituras e mutações: contratos, validação, erros, idempotência. |
| 06 | `06-logica-e-estados.md` | Máquinas de estado, precedência, conclusão, retomada. |
| 07 | `07-player-youtube.md` | Fachada, API do YouTube, eventos, persistência de posição, CSP. |
| 08 | `08-ui-layout-e-responsividade.md` | Layout validado, medidas, componentes, breakpoints, mobile, barra lateral. |
| 09 | `09-ferramentas-aulas-notas-tempo.md` | Dock e painel: Aulas, Notas e Tempo. |
| 10 | `10-textos-e-respostas-ao-usuario.md` | Todos os textos, toasts, mensagens de erro e rótulos de acessibilidade. |
| 11 | `11-minhas-gravacoes.md` | Gravações sem vídeo abrindo na sala (QA) e gravações como conteúdo da sala. |
| 12 | `12-acessibilidade-desempenho-seguranca.md` | Requisitos não funcionais. |
| 14 | `14-plano-de-implementacao.md` | Fases, PRs, feature flag, rollout e rollback. |
| 15 | `15-plano-de-qa-e-aceite.md` | Seeds, cenários, testes, matriz de viewports, checklist final. |
| 16 | `16-decisoes-em-aberto-e-riscos.md` | O que ficou em aberto, com padrão seguro, e riscos. |

Pastas:

- `contracts/` · tipos TypeScript, textos em pt-BR, SQL de esquema e de seed, tokens CSS, esqueleto de testes E2E.
- `assets/` · SVGs da identidade (meandro grego, templo em linha, pôster).
- `reference/` · telas desenhadas (HTML com CSS inline). Veja `reference/LEIA-ME.md`.

## Precedência quando houver conflito

1. Este pacote (decisões LD-xx e regras R-xx).
2. As telas de `reference/` marcadas como **válidas**.
3. As telas de `reference/` marcadas como **só componentes** (layout antigo; usar apenas o interior do player, cartões e linhas).

## Convenções

- Texto da interface: **sempre pt-BR**. Identificadores de código: inglês.
- `LD-xx` decisão travada · `R-xx` regra · `S-xx` estado · `C-xx` chave de texto · `D-xx` decisão em aberto.
- “Reutilizar > estender > criar”: nunca recrie o que o repositório já tem (barra lateral, editor de notas, cronômetros, biblioteca, autenticação).
- Onde este pacote diz “se já existir”, o Codex confirma na Fase 0 e registra no relatório de descoberta.
