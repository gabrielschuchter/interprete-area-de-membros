# ADR 0001 — Conteúdo de aula estruturado em JSON

## Status

Accepted for Phase 1

## Contexto

Uma aula do Interprete não deve ser tratada como sinônimo de vídeo. Ela pode conter texto, headings, listas, citações, links e recursos complementares. O editor de autoria ainda será avaliado na Phase 2.

## Decisão

Persistir o documento principal em `Lesson.content` como JSON estruturado compatível com Tiptap/ProseMirror. Recursos externos ficam em `LessonResource`, com tipo e ordem próprios.

O consumo usa um renderer server-side restrito a nós e marks conhecidos. Links são aceitos somente com protocolos `http` ou `https`; HTML arbitrário não é injetado.

## Consequências

- o schema não fica acoplado a HTML;
- versões futuras podem migrar o documento com transformações explícitas;
- busca e renderização precisam considerar o formato estruturado;
- o editor de autoria deve compartilhar a mesma representação na Phase 2;
- nós e marks desconhecidos degradam sem quebrar a página.

## Fora desta decisão

Vídeo, upload, Supabase Storage, embeds avançados, busca semântica e editor administrativo não entram nesta fase.
