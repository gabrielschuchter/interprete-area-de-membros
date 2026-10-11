# Release e QA da área de membros — 11/10/2026

## Consolidação publicada

- Commit: `bed84e8` (inclui a812be6 e integração dos designs aprovados).
- App: `dpl_4iEGNQNPVshEbzTNKL3S4nMWUUp4`.
- API: `dpl_BP4qMe2FCYyEaaVGZzANpQrd3zTc`.
- Alias canônico: https://interprete-area-de-membros.vercel.app ; conferir e atualizar explicitamente após cada deployment da app.
- GREEN: 53 migrations, zero drift/falha; 88 tabelas de domínio com RLS. BLUE preservado.
- Backup anterior à migration: 19:35:52 UTC, AES-GCM/DPAPI, TLS verify-full e pg_restore --list. Não houve ensaio completo de restauração.
- Rollback prefere correção adiante: clientes anteriores podem desconhecer PERSONAL_TIMER; retorno de alias não é prova de compatibilidade com novos registros.

## Ciclo visual e funcional

Referências: ZIP original preservado; HTML/PNG 20/21/24 e mobile 76/80/81, protótipo navegável. Alterações e gates constam na entrada datada do roadmap e performance. Artefatos locais sanitizados em output/playwright (ignorados pelo Git). Fixtures locais identificadas como QA, com seed explícito e guarda de alvo 127.0.0.1:55432/interprete_member_qa2; nenhuma fixture foi aplicada remotamente.

Produção: timer privado controlado persistiu iniciar/reload/pausar/retomar/registrar. As visitas locais em 22 rotas não provam todos os controles nem autorização entre papéis. Upload real de arquivo e acessibilidade completa permanecem sem aceite. Correções do ciclo visual ainda exigem a publicação e repetição autenticada correspondente; não marcar fases 9/10 DONE.

## Primeiro ciclo publicado

Commit f1d8fb8; app dpl_JECLu4D6gzUsrF8ewfEUG1Np3KjY (READY), alias canônico atualizado explicitamente. A CLI perdeu a conexão durante a espera, mas inspect confirmou READY antes da troca do alias. QA autenticado confirmou composição/rotas e filtro. Captura de tela pela extensão Edge falhou por timeout; não considerar comparação visual de produção concluída. Uma nota privada de QA confirmou autosave e reload. Console encontrou hidratação de datas (React 418); correção de fuso em andamento com novo ciclo de gates.

## Correção de fuso publicada

Commit f83f521; app dpl_BvkxycmfzvTeXqqgqqRj43z4eUzX, READY, alias canônico atualizado. Saúde app/API 200 em gru1, GREEN saudável, cron não autorizado 401. Reload autenticado de Notas preservou conteúdo e horário sem novo React 418 no intervalo observado. O ensaio privado de modo foco foi interrompido pela troca humana de conta; somente o timer identificado como QA desta execução foi encerrado/registrado pelo domínio com Prisma, sem exclusão. Não contar esse encerramento como prova de clique final no navegador. Sidebar publicada com defeito reproduzido; correção seguinte passou gates e aguarda deployment.

## Sidebar publicada

Commit f3e219f; app dpl_6Dr5JS8dq11gTtK7o4R4Zy1jLWL9 READY; alias canônico atualizado explicitamente. A sessão staff publicada confirmou menu estável aberto e navegação até Minhas gravações. Ajuste adicional de tooltip/Escape mobile reproduzido e corrigido localmente; aguardando gates/publicação. A matriz integral permanece aberta.
