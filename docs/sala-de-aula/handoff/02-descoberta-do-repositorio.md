# 02 · Fase 0: descoberta do repositório

**Antes de escrever qualquer código**, mapeie o que existe. O produto tem parte da sala e de seus dados, mas não se sabe quanto. O objetivo é decidir, para cada peça, entre **reutilizar**, **estender** ou **criar**, e registrar tudo em `docs/sala-de-aula/DISCOVERY.md`.

## Checklist de descoberta

Para cada item: caminho dos arquivos, o que faz, e decisão (reutilizar/estender/criar).

### Estrutura e infraestrutura
- [ ] Monorepo (next-forge): apps, packages, onde vive a área de membros, onde vive o design system/UI.
- [ ] Scripts: `typecheck`, `lint`, `build`, `test`, E2E (Playwright?). Anote os comandos exatos.
- [ ] Padrão de rotas (App Router): como Estudar/Aprender é organizado hoje.
- [ ] Middleware de autenticação (Clerk) e origins por ambiente. Production usa Frontend API Clerk por DNS direto; não há proxy `/__clerk`. Preserve Clerk como única fonte de identidade e anote como obter o usuário no servidor.
- [ ] Mapeamento Clerk → usuário no banco (coluna `user_id`/`clerk_id`).
- [ ] Padrão de acesso a dados: Supabase client, Prisma, SQL puro? RLS ou checagem no servidor? Anote o padrão **que as tabelas existentes seguem**.
- [ ] Mecanismo de feature flags (se não houver, use variável de ambiente; veja `14`).
- [ ] i18n: textos vêm de arquivos de mensagens ou ficam inline?
- [ ] CSP/headers de segurança (next.config, middleware): há `Content-Security-Policy`? Anote `script-src`, `frame-src`, `img-src`.
- [ ] Tokens de design e fontes já carregadas (Source Serif 4, Inter, IBM Plex Mono).

### Conteúdo e dados
- [ ] Curso, módulo, aula: tabelas/modelos, campos (título, descrição, ordem, tipo, fonte do vídeo, início/fim, publicação).
- [ ] Vídeo: onde fica o ID/URL do YouTube; verificação diária (campos de status, `checked_at`); estados de privacidade/embed.
- [ ] Liberação por cronograma (`LessonRelease` ou equivalente).
- [ ] Acesso/matrícula/turma: como decidir se o aluno pode ver um curso.
- [ ] Materiais associados à aula: biblioteca, listas de exercícios, atividades, links, arquivos.
- [ ] **Conclusão da aula:** existe tabela/campo? Como o aluno “marca como feito” hoje?
- [ ] **Posição do vídeo salva:** existe? (provavelmente não)
- [ ] **Gravações de encontros** (Minhas gravações): modelo, campo de vídeo (pode ser nulo), série/turma de agrupamento, data.
- [ ] Progresso de gravações: existe?

### Ferramentas (integração)
- [ ] Notas: tabela, editor (TipTap da Comunidade), vínculo com aula, lixeira, “Abrir em Notas” (rota). Há campo de carimbo? Há “fixada”?
- [ ] Cronômetro, Pomodoro e Contagem regressiva: onde vive o estado (store global? contexto? servidor?), persistência entre páginas, vínculo com aula (“Vinculado a esta aula”), API disponível para ler/controlar.
- [ ] Modo foco: rota/componente e como receber o contexto da aula.

### Interface existente
- [ ] A sala atual (se houver): rota, componentes, o que renderiza hoje.
- [ ] Barra lateral global: componente, **recolher/expandir** (símbolo ao lado do logo, fade), onde guarda o estado recolhido.
- [ ] Cabeçalho global (crumb em caixa alta, Salvos/Buscar/Notificações).
- [ ] Componentes de botão, chip, caixa de seleção, toast, folha (sheet), esqueleto (skeleton).
- [ ] Página do curso (destino do “voltar”) e lista de cursos (Aprender).
- [ ] Página Minhas gravações (lista, item sem vídeo hoje: desabilitado? oculto?).

## Regras de decisão

| Situação | Decisão |
|---|---|
| Já existe e atende | **Reutilizar.** Não copie nem renomeie. |
| Existe e falta um campo/comportamento | **Estender** com mudança mínima e retrocompatível. |
| Não existe | **Criar**, seguindo o padrão do repositório. |
| Existe, mas conflita com a spec | Registrar no relatório, seguir a spec **sem quebrar o comportamento atual** (use adaptadores). Se o conflito mudar o escopo, pare e pergunte. |
| Nome de rota existente difere da spec (`03`) | **Mantenha a rota existente** e ajuste a spec mentalmente: o que importa é o comportamento. |

## Formato do `DISCOVERY.md`

```
# Descoberta · Sala de Aula

## 1. Infraestrutura
- Monorepo: ...
- Comandos: typecheck=..., lint=..., build=..., test=..., e2e=...
- Auth: ... (como obter user id no servidor)
- Acesso a dados: ... (RLS? Prisma? ...)
- Feature flags: ...
- CSP: ...

## 2. Dados (tabela: Conceito | Existe? | Onde | Campos relevantes | Decisão)
## 3. Ferramentas (Notas, Tempo, Foco): ...
## 4. UI existente: ...
## 5. Rotas atuais x rotas da spec: ...
## 6. Lacunas e riscos: ...
## 7. Plano de migração mínimo: ...
```

## Saída da fase

- `DISCOVERY.md` completo.
- Nenhuma alteração de código de produto nesta fase.
- Lista de **perguntas bloqueantes** (se houver). Se não houver, siga para a Fase 1.
