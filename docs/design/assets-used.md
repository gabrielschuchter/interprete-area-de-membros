# Assets oficiais incorporados

## Critério

Esta lista registra somente arquivos oficiais que foram copiados para o app e têm função semântica em uma superfície existente. A origem é a pasta oficial `03_ASSETS` do Drive e os nomes correspondem ao `ASSET_MANIFEST.md`. O app não faz hotlink para o Drive.

Fonte: [pasta oficial de assets](https://drive.google.com/drive/folders/1eAxGltr6YZn1VLwNOIuVQLkFtP5PBXIq) · [ASSET_MANIFEST.md](https://drive.google.com/file/d/1jqgIJU5DdegQu8hI7l9V-6NmyyhAyt4Y/view)

| Original no Drive | Arquivo incorporado | Uso atual | Finalidade |
| --- | --- | --- | --- |
| `site_01.svg` | `apps/app/public/brand/logo/wordmark-amaranto.svg` | headers claros | Wordmark oficial com ponto final. |
| `wordmark-branco.svg` | `apps/app/public/brand/logo/wordmark-branco.svg` | sidebar e autenticação | Wordmark em superfícies Dark Amaranth/Crimson Violet. |
| `site_14.png` | `apps/app/public/brand/editorial/study-desk.png` | Início | Mesa de estudo, artigo, livros e anotação como contexto de entrada. |
| `site_27.png` | `apps/app/public/brand/community/study-group.png` | Comunidade vazia | Estudo concentrado e material de leitura; não simula posts ou usuários. |
| `site_30.png` | `apps/app/public/brand/meetings/classroom.png` | Encontros vazio | Professor e turma como sinal da sala de aula. |
| `site_33.png` | `apps/app/public/brand/activities/progress-note.png` | Atividades vazia | Progresso pedagógico e feedback, sem gamificação. |
| `site_34.png` | `apps/app/public/brand/library/study-books.png` | Biblioteca vazia | Arquivo, livros e curadoria de estudo. |
| `site_46.png` | `apps/app/public/brand/learning/evidence-screen.png` | Aprender vazio | Artigo, tela e pergunta como ponto de partida para a aprendizagem. |
| `site_02.png` | `apps/app/public/brand/learning/reading-notes.png` | aula | Recorte editorial de leitura e anotação usado na nota lateral do ambiente de leitura. |

## Regras de uso

- Assets de fallback não são primeira escolha.
- Cada imagem precisa explicar contexto, estado ou ação; não é preenchimento de espaço.
- Imagens de pessoas representam situações de estudo, não depoimentos ou prova social.
- O wordmark não é recriado em CSS, não recebe sombra, distorção ou recoloração.
- A seleção permanece pequena: o acervo do Drive tem muitos derivados, mas esta fundação incorpora apenas o que já possui uso claro.
