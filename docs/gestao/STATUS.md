# Gestão V2 — estado operacional

> **Atualização de domínio — 30/10/2026:** o app Production foi promovido para
> `https://membros.escolainterprete.com.br` no deployment
> `dpl_GjqW96cC3peZVjaCuSmZeLepUx5Q` (construído a partir do SHA
> `76a62e94d0f1137068925e8600d7e2a21b2f6ab4`). A tabela e os endereços Vercel
> abaixo documentam o release de Gestão de 14/10; não são os endpoints
> canônicos atuais. O histórico de produto e a API não foram alterados por este
> cutover. Estado e rollback atuais: [`docs/deployment/vercel.md`](../deployment/vercel.md).

**Base funcional do MVP publicada e smoke concluído em 14/10/2026, às 15:12 BRT.** YouTube foi adiado expressamente pelo usuário; os 101 quadros continuam como referência integral, com aceite visual separado. Nenhum bloqueador funcional conhecido permanece nesta publicação.

## Versão publicada

| Serviço | Código / deployment Production | Endereço verificado |
|---|---|---|
| App | `830a849` · `dpl_5qmQByzGGr4ycr6tFCip8K8twr2J` · READY | https://interprete-area-de-membros.vercel.app/gestao |
| API | `7d0f12c` · `dpl_49eSqmSjL2Tx9jtxfzLepiCDFsZ2` · READY | https://interprete-area-de-membros-api.vercel.app |

O commit 830a849 altera somente uma linha CSS sobre 7d0f12c; o código da API é idêntico. O deployment de API desse commit foi cancelado pela Vercel como projeto sem alteração. Ambos os serviços respondem health200, Clerk configurado e banco GREEN correto, na região gru1. O alias canônico do app foi atualizado explicitamente para o deployment aprovado: o Git promovia somente o alias do projeto. Hostname e proxy Clerk `/__clerk` preservados.

Worktree: `C:/Users/gabsc/.codex/worktrees/interprete-gestao/interprete-area-de-membros`, branch `gestao-v2`; código enviado à main. O CSS preexistente de cinco linhas foi preservado integralmente em `f1814ca`, sem alterar seu conteúdo. O checkout original permanece em `codex/interprete-member-area-release-2026-10-04`, HEAD a4b68b8, com o trabalho de outra frente preservado; nenhuma edição desta intervenção foi feita nele.

## Capacidades essenciais — contrato MVP

As provas locais demonstram comportamento, persistência e autorização; não representam dados reais de produção. O smoke publicado usa a conta existente do proprietário, sem criar curso, aluno, turma ou conteúdo de QA em produção. Jornadas comprovadas não foram reconstruídas.

| Capacidade | Evidência funcional reutilizada / acrescentada | Fechamento |
|---|---|---|
| Ensino → aluno: curso, módulo, aula, exercícios, biblioteca e coleção | Curso/aula/progresso: f206977, b6dfa6d, 8b3b562. `release-closure/evidence.md`: criação/publicação, consumo/reload, lista respondida e resultado persistido, rascunho indisponível e coleção isolada por grupo | Comprovada localmente; entradas publicadas200 |
| Vídeo privado | UI enviou MP4 ao Storage real, conferiu, vinculou/recarregou e publicou em banco QA local. Aluno autorizado reproduziu até fim sem erro; outro aluno recebeu404 na página e no asset, sem URL assinada | Integração real comprovada; limite50MiB |
| Turmas, matrícula, responsáveis, cronograma e origens de acesso | `output/gestao-mvp-t2/`, `output/gestao-mvp-item2/local-browser-smoke.md`; revogação por origem preserva histórico. Acesso global ativado/revogado pela UI sem remover atribuição independente | Comprovada localmente; entrada publicada200 |
| Atividades, envio, rascunho privado, correção e feedback | `output/gestao-mvp-a2/`, `output/playwright/gestao-v2/item3-a1-a3/`; rubrica inválida recusada, envio/reload, isolamento e destinatários conferidos por SQL/TLS | Comprovada; worker real ativo |
| Comunidade, avisos, grupos e encontros | `output/gestao-mvp-administration/local-browser-smoke.md` e Item2; público, associação e leitura por outro membro/reload. Destinos legados operacionais preservados | Comprovada; Comunidade publicada redireciona para /admin/community200 |
| Administração: papéis, grants e revogação | Evidência Administração: professor negado, papel persistido, revogação404 e origens independentes mantidas | Comprovada; entrada publicada200 |
| Shell e experiência essencial | Matriz local dos quatro atores com sessão + contexto anônimo, larguras1440/1280/1024/820/390/320, navegação, busca/teclado e notificações. Painel assíncrono abriu, exibiu vazio real e fechou por Escape | Smoke publicado nas9 entradas; catálogo sem overflow em1440/390/320 |

Comparações essenciais das referências48/54/63 e imagens locais estão em `output/playwright/gestao-v2/release-closure/`. Isso não equivale ao aceite visual dos101 quadros.

## Gates e integrações aprovados

- **Clerk/Supabase:** OAuth renovado pelo usuário. Conta Production corresponde ao Member ADMIN ativo/Profile/onboarding existentes. Sessão real em navegador isolado por ticket oficial de uso único; /perfil, notificações e realtime-token200. JWT com issuer canônico /__clerk, role authenticated e subject correto aceito pelo Supabase REST200. Sessões temporárias revogadas; nenhum papel/identidade alterado. Não afirma teste de senha/MFA de outros usuários.
- **Banco:** 65/65 migrations, zero pendente/incompleta/checksum divergente;104 tabelas públicas com RLS. As12 migrations aditivas foram aplicadas via Prisma migrate deploy com TLS verify-full. Conferência pós-migração preservou as identidades dos1.442 registros das90 tabelas anteriores, sem redução de contagens. Nenhuma fixture de banco transportada para produção.
- **Storage:** bucket learning-assets permanece privado, com tipos anteriores preservados e MP4/WebM acrescentados. Bucket e `GESTAO_VIDEO_MAX_UPLOAD_BYTES` alinhados a52.428.800 bytes. TUS assinado201/204, readback com hash idêntico, Range206/assinatura MP4 e rota pública negada400. Dois arquivos mínimos de integração, privados e não publicados como conteúdo, foram preservados; nenhum objeto anterior foi alterado/excluído.
- **Worker/custo:** Supabase Cron existente `interprete-member-outbox`, a cada5min, Vault e HTTP autenticado para a API correta. Execuções reais15:05/15:10 BRT retornaram200 e contrato do worker, sem invocação manual/replay. Cron Vercel de minuto removido; limpeza de uploads agora diária13UTC, compatível com Hobby. Expiração/autorização permanecem imediatas nas actions. Nenhum serviço contratado ou plano alterado.
- **Checks:** check/typecheck/boundaries e gates dos pacotes não afetados reutilizados. Correções de acesso/constraint e23 testes focados de vídeo passaram. Build Linux final:768 testes do app,18 do domínio, TypeScript e4/4 tarefas Turbo aprovados. Budget de225KiB preservado; calendário223,1KiB, editor221,2KiB, planner222,7KiB e ferramentas221,0KiB. O verificador local foi corrigido para medir o distDir efetivamente gerado pelo Next.
- **Smoke real:**9 entradas principais200, autenticação/issuer reais, APIs privadas401 sem sessão e Gestão307 para login. Após o achado responsivo, 830a849 corrigiu o rótulo acessível que escapava da rolagem da tabela. Somente o cenário afetado foi repetido;1440/390/320 passaram no app final, sem injeção de estilos. As demais8 entradas mantêm código idêntico ao smoke anterior.

## Evidências e rollback

Relatórios sanitizados em `output/gestao-release-candidate/`: `clerk-production-smoke.json` (9 entradas aprovadas e achado responsivo inicial), `production-responsive-smoke.json` (correção final aprovada), `production-http-smoke.json`, `production-worker-smoke.json`, `canonical-app-final.json`, `canonical-api-final.json`, `app-cloud-build-final.log`, `preflight-read.json`, `post-migrate-integrity.json`, `storage-video-release.json` e `clerk-browser-preflight.json`. Detalhes das jornadas em `output/playwright/gestao-v2/release-closure/evidence.md`.

Backup fresco anterior às migrations: `C:/Users/gabsc/AppData/Local/Codex/migrations/interprete-supabase/green-release-domain-20261014T173129Z.pgdump.aesgcm`, manifest e chave DPAPI CurrentUser no mesmo diretório com ACL restrita. AES-GCM, SHA256, decodificação pg_restore, contagens e ledger verificados; registro `green-pre-migrate-result.json`. Ferramentas portáteis EDB17.11 preservadas em `C:/Users/gabsc/AppData/Local/Codex/tools/postgresql-17.11/bin`, fora de Temp. Helpers operacionais GREEN em `output/gestao-release-candidate/green-backup/`, com sincronização proibida; helpers BLUE originais preservados.

Rollback de aplicação anterior à Gestão: app `dpl_Fgze9yVPDynkAeKche8J8HW7iENb`, API `dpl_7KDLvsN8xEBidyi3RY7DBi9ibgSm`; aliases anteriores salvos em `app-before-release.json`/`api-before-release.json`. Deployments preservados. Migrations são aditivas; rollback de app não exige apagar tabelas ou restaurar dados sobre escritas posteriores.

## Pendências preservadas, sem bloquear esta entrega

- YouTube: configuração/chave e validação real adiadas pelo usuário. Implementação preservada; publicação de vídeo YouTube sem validação server-side continua recusada explicitamente. Não declarar integração validada.
- Comparação integral dos101 quadros, fidelidade fina de espaçamento/cabeçalhos/movimento, dispositivos físicos e percentis continuam no aceite próprio. As referências completas permanecem intactas em `interprete-gestao-handoff/`.
- Acabamento/acessibilidade não bloqueante já identificado: foco após fechar busca pode retornar ao body, landmarks main aninhados e warning de encType no editor. Não impediram as jornadas persistidas; não foram incluídos em refatoração de fechamento.

## Ambiente local preservado

PostgreSQL QA nativo17.10 em127.0.0.1:55433, com bancos funcional/visual e fixtures preservados. Binários originais: `%TEMP%/interprete-postgres-qa-20261011/node_modules/@embedded-postgres/windows-x64/native/bin/pg_ctl.exe`; PGDATA `%TEMP%/interprete-gestao-qa-20261012/postgres-data`, CA `local-qa-ca.crt` no diretório QA. Recuperação e snapshots físicos históricos permanecem documentados no Git e nos registros congelados. Nenhum cluster recriado, reset de WAL, Docker/WSL ou TLS desabilitado. Runtimes próprios de QA3002 encerrados; caches/junctions em D preservados. GOAL/MVP continuam definindo contrato; PROGRESS, EXECUTION-LOG e handoff original são histórico/especificação, sem novos relatos duplicados.
