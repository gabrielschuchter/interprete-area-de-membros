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
