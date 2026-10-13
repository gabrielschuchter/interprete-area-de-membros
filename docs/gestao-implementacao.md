# Gestão: execução e QA local

Estado atual: implementação em andamento. `GOAL.md` define o aceite;
`PROGRESS.md` registra evidências, capturas e lacunas por unidade. As fases 1
e 2 ainda não foram aceitas. Este guia não autoriza publicação remota.

## Rodar o preview

Use o worktree `interprete-gestao`, branch `gestao-v2`. Preserve o checkout
original com alterações alheias. Instale/use as dependências com Bun e
configure as variáveis localmente, sem versionar arquivos de ambiente.

| Variável | Uso |
|---|---|
| `GESTAO_V2_ENABLED=true` | Habilita a Gestão para professores/admin autorizados; corresponde à flag de liberação `gestao_v2`. |
| `NEXT_PUBLIC_APP_URL=http://localhost:3000` | Origem do preview. Abra o mesmo host no navegador para o HMR. |
| `DATABASE_URL` | Banco QA isolado em loopback; nunca reutilizar o destino remoto para testes com escrita. |
| `DATABASE_CA_CERT_PATH` | CA local verificada; não desabilitar TLS. |
| `GESTAO_DEV_AUTH=true` + `NEXT_PUBLIC_GESTAO_DEV_AUTH=true` | Autenticação de QA somente com `NODE_ENV=development` e host loopback. |
| `GESTAO_DEV_AUTH_USER_ID` | ID de um `Member` de QA já existente; papel e ativação são consultados no servidor. |

Prefira Clerk Development quando disponível. O modo local não comprova o
fluxo real de Clerk; flags desencontradas ou runtime incompatível falham.
Ainda não foi comprovada a ausência de todo marcador da flag pública nos
chunks de servidor da build de produção; não considerar essa auditoria aceita.

Na raiz, com o ambiente configurado:

```powershell
bun run --cwd apps/app dev
```

Abra `http://localhost:3000/gestao/alunos/turmas`. Pause o dev antes da build
e reabra depois, evitando disputa pelos artefatos do Next.

## Fixtures e migrations

A seed separada `bun run db:seed:gestao` exige explicitamente
`NODE_ENV=development`, `SEED_DEVELOPMENT_DATA=true` e
`GESTAO_SEED_PROFILE=functional` ou `visual`. Todas as URLs configuradas
devem apontar para o mesmo banco de loopback na porta `55433`:

- `functional`: `interprete_gestao_qa_20261012`.
- `visual`: `interprete_gestao_visual_qa_20261012`.

A seed faz upserts determinísticos e não apaga dados; registros extras de QA
devem ser preservados e documentados. Não executar a seed ampla de produto
para preparar este cenário. Fixtures não representam dados de produção.

Migrations são aditivas e somente locais. O histórico funcional confirma
`20261012180000_cohort_calendar_projection`; o banco visual tem o schema,
mas não tem `_prisma_migrations`. Não afirmar aplicação versionada nele.
Rollback da aplicação preserva os objetos aditivos e volta o código; não
executar exclusões de tabelas/dados como rollback. A reversão da configuração
temporária de conexão do preview está em `DECISIONS.md`.

A migration aditiva `20261012223000_meeting_publication_time` acrescenta
`Meeting.publishedAt` nullable. Foi aplicada via `migrate deploy` no funcional;
o SQL exato foi aplicado no visual após conferir banco, loopback, porta e TLS.
O visual continua sem histórico Prisma. Publicações novas registram o primeiro
instante; legados usam `createdAt` na política de entrada, sem backfill.
O rollback preserva a coluna e volta o código, sem apagar dados.

Há três encontros e uma turma adicionais de QA no funcional, prefixados
`gestao_entry_qa_`, para conferir publicação anterior/posterior à entrada e
convite individual. São fixtures locais explícitas, preservadas fora da seed
padrão; não representam os totais definidos pelos perfis da seed.

## Verificar

```powershell
bun run check
bun run typecheck
bun run boundaries
bun run test
bun run build
bun run performance:check
git diff --check
```

A build local registrada usa `SKIP_ENV_VALIDATION=true` e URL local; isso
permite validar o código sem inventar credenciais externas e não comprova
configuração de produção. O build não precisa conectar ao banco.

Em cada fluxo, salvar → recarregar → conferir persistência e permissões.
Comparar capturas com `interprete-gestao-handoff/referencia-png/`, nas larguras
1440/1280/1024/820/390/320, com e sem movimento reduzido. As capturas atuais
ficam em `output/playwright/gestao-v2/`; testes de overflow e build não
equivalem a aceite visual.

## Ainda não verificado

Regressão local do shell (R1/R3): `node scripts/qa/gestao-shell-local.mjs`.
Usa Playwright instalado no ambiente; se necessário, definir
`QA_PLAYWRIGHT_MODULE` para o caminho absoluto de `playwright/index.mjs`, sem
instalar dependência de produto. O destino `QA_BASE_URL` é limitado a localhost
ou 127.0.0.1. Requer o preview com a fixture visual admin existente. O ensaio
navega, abre menus e captura imagens; não cria fixtures nem chama mutações de
domínio. Evidências em `output/playwright/gestao-v2/shell-navigation/`.
Esse ensaio não prova papéis diferentes, Clerk real ou fidelidade integral.

Entrada/retorno N2/N3: `node scripts/qa/gestao-shell-entry-local.mjs`, com as
mesmas variáveis e preview visual. Valida origem com busca/fragmento, navegação
interna sem `from`, reload, foco, anúncio, duração das animações, feedback até
100 ms, ausência de overflow, offline/retry e fallback sem View Transitions.
`QA_WIDTH` limita uma rodada de diagnóstico a uma largura. Evidências em
`output/playwright/gestao-v2/shell-entry/`. A origem usa sessionStorage local
por aba/usuário e é sanitizada ao ler/gravar; o padrão é `/estudar`. Não há
migration. Isso não implementa fila offline de escritas ou autenticação Clerk.

- Matriz completa de papéis, URLs e Server Actions dos cenários de `docs/05`
  do handoff; Clerk real, concorrência representativa e latência por percentil.
- Fidelidade de todos os quadros, teclado completo e jornadas de aluno.
- Menu do dia com criação por tipo e edição de todas as fontes do calendário.
- YouTube real: o adaptador `YOUTUBE_DEVELOPMENT_ADAPTER=true` é apenas local;
  `YOUTUBE_API_KEY` deve vir de configuração real, sem valores inventados.
  Cenários validados com adaptador permanecem **NÃO VERIFICADOS COM API REAL**.
- Demais lacunas por fase listadas em `PROGRESS.md`; nenhum deploy faz parte
  da evidência local.
