# Gestão — execução local e QA

Fonte operacional: [STATUS.md](gestao/STATUS.md). Critérios de publicação: [MVP.md](gestao/MVP.md). Este guia descreve apenas o runtime local; evidências históricas não são instruções vigentes.

## Isolamento

Trabalhe na branch isolada `gestao-v2`, sem alterar o checkout original. Configure variáveis no ambiente local ou arquivo ignorado; nunca copie segredos para logs/documentação. O preview usa `localhost:3000`. Ensaios de escrita usam exclusivamente PostgreSQL QA em loopback `127.0.0.1:55433`, com CA verificada e banco funcional ou visual explicitamente escolhido. QA auth exige `NODE_ENV=development`, host loopback, `GESTAO_DEV_AUTH=true`, `NEXT_PUBLIC_GESTAO_DEV_AUTH=true` e um `Member` QA já existente.

Seeds usam `bun run db:seed:gestao` e exigem `SEED_DEVELOPMENT_DATA=true` mais perfil `functional` ou `visual`. A seed faz upsert sem apagar dados; fixtures adicionais e feedbacks são preservados. Não executar a seed ampla para preparar ensaio da Gestão.

## Cache e runtime no Windows

A raiz ignorada `.next-local-*` fica fora do Git. Nesta máquina há junctions já configuradas para D em `apps/app/.next-local-preview3000-d`, `apps/app/.next-local-a2`, `apps/app/.next-local-a2-d`, `apps/app/.next-local-build-d` e `apps/app/.next-local-item2-d`. Confira o destino com `Get-Item` antes de usar e confirme que a unidade existe. Não remova recursivamente uma junction.

Para o preview, escolha um distDir que já tenha junction válida em D e defina ambas as variáveis antes de iniciar:

```powershell
$env:INTERPRETE_LOCAL_DIST_DIR = ".next-local-preview3000-d"
$env:INTERPRETE_NEXT_DIST_DIR = ".next-local-preview3000-d"
bun run --cwd apps/app dev
```

O primeiro valor isola o Next dev; o segundo faz `check:performance` inspecionar os manifests daquele mesmo build. A2 aceita `QA_MVP_A2_DIST_DIR`; T2 e a jornada de atividade aceitam `GESTAO_QA_DIST_DIR`. O padrão é `.next-local-a2`, distDir isolado em D nesta máquina. Não execute duas instâncias usando o mesmo distDir ao mesmo tempo.

Antes de processo pesado, confira espaço/memória, portas e destino físico do cache; execute uma carga pesada por vez. Mantenha TLS e os recursos locais existentes. Inicie ou pare somente processos que o próprio ensaio iniciou e valide PID/porta antes de encerrá-los. Se faltar espaço ou memória, pause essa carga e siga em trabalho de código/documentação independente; não apague cache, dados ou fixtures como atalho.

## Verificação

Durante uma alteração, rode apenas validações estáticas e testes focados que cobrem o comportamento afetado. Ações de acesso exigem prova de permissão e ausência de mutação não autorizada. O browser é necessário quando a evidência depende de UI, reload ou layout e deve usar fixtures QA preservadas.

Sobre candidata integrada, rode uma vez `bun run check`, `bun run typecheck`, `bun run boundaries`, `bun run test`, `bun run build` e `git diff --check`. `build` já depende de testes no Turbo e executa `check:performance`; uma medição separada do mesmo build é redundante. Após correções, repita somente os gates/cenários afetados.

A QA local usa adaptador e não prova Clerk, Storage, YouTube, Supabase ou worker real. Identifique esses limites no status e valide serviços indispensáveis no preflight de produção. Nenhuma fixture de QA deve ser publicada.
