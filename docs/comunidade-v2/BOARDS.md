# Comunidade V2 — matriz dos 53 boards

Cada board do pacote tem HTML de referência e PNG do mesmo nome. Usar o HTML com as fontes oficiais para comparar texto; alguns PNGs usam fontes substitutas. Boards lógicos e compostos validam contratos/estados, não exigem páginas artificiais. A matriz liga cada referência ao componente/fluxo, etapa e critérios do roteiro de QA. Os grupos de testes seguem as letras do HANDOFF.

## Legenda dos testes

- **A1–A15:** rascunhos, publicação, feed, filtros, pin, arquivamento/restauração e performance.
- **B1–B9:** leitura, comentários/respostas, edição/remoção, menções, seguir/silenciar, privacidade e origem/retorno.
- **C1–C14:** criação, privacidade, membros, dono/moderador/staff, convites e capa de grupos.
- **D1–D7:** compartilhar, tokens, autorização, landing, OG e revogação.
- **E1–E11:** avisos, importância, audiência/período/dispensa, meta, fontes, renovação e avatares.
- **F1–F6:** destinos, navegação, origem, integração Salvos/Encontros e responsividade.
- **G1–G6:** teclado/foco, mobile e teclado virtual, acessibilidade, desempenho, segurança e regressão visual.

## Desktop e contratos lógicos

| Board | Referência HTML | Componente ou fluxo | Etapa | QA |
|---|---|---|---|---|
| 01 | 01-leitura-rapida-o-que-muda-e-onde-ver.html | Contrato geral, hierarquia e jornadas; usar como índice de aceitação | 00–12 | A–G |
| 02 | 02-arquitetura-mapa-e-rotas.html | Rotas canônicas, alias/redirect e fronteira entre Comunidade e shell | 02 | F1 |
| 03 | 03-navegacao-voltar-salvos-e-permanencia.html | Origem, retorno, filtros, scroll e preservação do contexto | 02, 04 | B9, F2–F3 |
| 03b | 03b-navegacao-cada-elemento-clicavel-e-seu-destino.html | Destino de cada link, menu, botão e ação | 02 | F1 |
| 04 | 04-logica-rascunhos-e-feed.html | Ciclo de rascunho, publicação, visibilidade e feed | 03 | A1–A11, A14 |
| 05 | 05-logica-grupos-de-estudo.html | Regras de grupo, membership, convite e papéis | 05–06 | C1–C14 |
| 06 | 06-logica-mencoes-convites-e-links.html | Menções, convites e compartilhamento/token | 04, 06–07 | B3–B5, C3–C9, D1–D7 |
| 07 | 07-logica-avisos-e-meta-coletiva.html | Avisos, público, períodos e horas de estudo | 08–09 | E1–E10 |
| 08 | 08-layout-respiro-e-componentes.html | Tokens, shell, medidas, tipografia e componentes comuns | 02–10 | A15, F4–F6 |
| 09 | 09-explorar-feed-com-capa-grande-e-lateral-completa.html | Explorar, CommunityFeedCard, capa e sidebar | 02 | A5, A14–A15 |
| 10 | 10-explorar-com-aviso-importante-ativo.html | Aviso importante no topo do feed da Comunidade | 08 | E1, E3–E6 |
| 11 | 11-estados-do-feed.html | Feed carregando, vazio/erro e card/capa | 02–03 | B8, F4, G5 |
| 12 | 12-ativo-agora-fotos-que-rotacionam-sem-contador.html | Avatares decorativos sem contagem/presença, opt-out | 09 | E11 |
| 13 | 13-meta-coletiva-estados-e-edicao.html | Meta sem configuração, edição, período e progresso real | 09 | E7–E10 |
| 14 | 14-publicacao-foco-no-texto-sem-lateral-e-sem-secao-de-acoes.html | CommunityPostView, conteúdo e leitura sem lateral | 04 | B1, B8–B9 |
| 15 | 15-comentarios-campo-mencao-e-discussao.html | Comentários, resposta de um nível, composer e autocomplete | 04 | B2–B7 |
| 16b | 16b-escrever-status-do-rascunho-saida-e-capa-para-o-editor.html | Editor atual, status, saída, upload e capa | 03 | A1–A12 |
| 17 | 17-minhas-publicacoes-rascunhos-separados-com-acao-principal.html | Minhas publicações e separação por status | 03 | A5–A9 |
| 18 | 18-minhas-publicacoes-estados-e-confirmacoes.html | Menus, confirmação, undo/arquivo e restauração | 03 | A6, A9 |
| 19 | 19-salvos-so-o-que-e-da-comunidade-com-atalho-para-o-global.html | Salvos da Comunidade e link para a coleção global | 02 | F3 |
| 20 | 20-grupos-meus-grupos-e-descoberta-com-capa.html | Descoberta e meus grupos, entrada pública, card/capa | 05 | C1–C2, C10 |
| 21 | 21-grupo-pagina-com-identidade-acoes-e-publicacoes.html | Página do grupo, publicações e ações conforme papel | 05 | C10–C13 |
| 22 | 22-grupo-membros-papeis-e-convites-pendentes.html | Lista de membros, papéis e convites pendentes | 05–06 | C6–C12 |
| 23 | 23-novo-grupo-upload-de-capa-e-privacidade-explicada.html | Criar grupo, capa, visibilidade e explicação de privacidade | 05 | C1–C2 |
| 24 | 24-convidar-link-e-mail-e-pessoas.html | Folha Convidar, membro individual, link e estado de e-mail | 06 | C3–C9 |
| 25 | 25-convidar-estados-e-respostas.html | Sucesso, falha parcial, duplicado, revogado e feedback por pessoa | 06 | C6–C9 |
| 26 | 26-entrar-por-link-chegada-do-convite.html | Landing do convite, Clerk, aceite e retorno ao grupo | 06 | C3, C5–C6 |
| 27 | 27-compartilhar-folha-e-cartao-recebido.html | Folha Compartilhar e conteúdo do card recebido | 07 | D1, D3–D5 |
| 28 | 28-previa-do-link-conversa-e-e-mail.html | Prévia OG e preparação de templates/canais | 07 | D2–D3 |
| 29 | 29-pagina-compartilhada-quem-chega-de-fora-e-a-chamada-para.html | Landing pública, visitante, login e retorno | 07 | D1, D5, D7 |
| 30 | 30-perfil-de-membro-voltar-leva-a-discussao-de-onde-a-pessoa.html | Perfil existente em contexto de publicação e retorno | 04–05 | B9, C14 |
| 31 | 31-gestao-criar-aviso-e-ver-onde-aparece.html | Gestão existente, público/período e caminho até a Comunidade | 08 | E1–E6 |
| 32 | 32-encontros-proximos-e-anteriores-dentro-da-comunidade.html | Wrapper Encontros, autorização, janelas de sala e gravações existentes | 02 | F1 e autorização da sala |
| 33 | 33-encontros-estados.html | Processamento, falha, vazio e estados de gravação/encontro | 02 | F4 e estados de erro |
| 34 | 34-responsividade-regras-por-elemento.html | Contrato de reorganização por breakpoint, sem overflow | 10 | F4–F6, G1–G3 |

## Tablet e mobile

| Board | Referência HTML | Componente ou fluxo | Etapa | QA |
|---|---|---|---|---|
| 35 | 35-tablet-explorar-lateral-desce-para-baixo-do-feed.html | Explorar a 820 px; sidebar sob o feed | 02 | F4 |
| 36 | 36-tablet-grupo.html | Grupo a 820 px; abas e membros acessíveis | 05 | C12, F4 |
| 37 | 37-mobile-explorar-com-grupos-e-sobre-no-fim.html | Explorar mobile, cards, sidebar empilhada e estados | 02 | A15, F4–F6 |
| 37b | 37b-mobile-explorar-com-aviso-importante.html | Aviso importante no feed mobile da Comunidade | 08 | E1, F4 |
| 38 | 38-mobile-seletor-das-cinco-visoes-lista-sem-abas.html | Seletor mobile em bottom sheet, cinco destinos e foco | 02 | F1, F5, G1 |
| 39 | 39-mobile-publicacao.html | Página de publicação no mobile e fluxo de leitura | 04 | B1–B2, F4 |
| 40 | 40-mobile-responder-com-a-lista-de-mencao-acima-do-teclado.html | Composer, autocomplete acima do teclado e visualViewport | 04 | B3–B6, G1 |
| 41b | 41b-mobile-escrever-status-saida-e-capa-para-o-editor-atual.html | Editor existente mobile: salvar, sair, estado e capa | 03 | A1–A12 |
| 42 | 42-mobile-minhas-publicacoes-situacao-em-lista-sem-segmentos.html | Minhas publicações mobile sem segmentos horizontais | 03 | A6, A9, F5 |
| 43 | 43-mobile-salvos-so-da-comunidade-com-atalho-para-o-global.html | Salvos da Comunidade mobile e atalho ao global | 02 | F3–F5 |
| 44 | 44-mobile-grupos.html | Descoberta/meus grupos mobile | 05 | C1, C10, F4 |
| 45 | 45-mobile-grupo-membros-e-sobre-viram-linhas-com-voltar.html | Grupo, Membros e Sobre em linhas com navegação de retorno | 05 | C12, F1, F5 |
| 46 | 46-mobile-convidar-tres-caminhos-em-lista.html | Convite mobile: pessoas, link, estado honesto de e-mail | 06 | C3–C9, F5 |
| 47 | 47-mobile-compartilhar-publicacao.html | Folha Compartilhar mobile e ação de copiar/link | 07 | D1, D4, F4 |
| 48 | 48-mobile-pagina-compartilhada-para-quem-chega-de-fora.html | Landing compartilhada mobile e retorno após login | 07 | D1, D3, D7 |
| 49 | 49-mobile-perfil-de-membro-o-voltar-leva-a-discussao.html | Perfil contextual mobile e retorno à discussão | 04–05 | B9, C14 |
| 50 | 50-mobile-encontros.html | Encontros e gravações no mobile | 02 | F1, F4 |
| 51 | 51-mobile-meta-coletiva-ativo-agora-e-edicao.html | Meta, edição e avatares decorativos no mobile | 09 | E7–E11, F4 |

## Exceções aprovadas e leitura do aceite

- Boards 10 e 37b continuam válidos para avisos importantes **na Comunidade**. A integração de aviso com Início/portal foi expressamente retirada do escopo.
- Boards 24 e 28 podem apresentar e-mail, mas nenhum e-mail real é enviado nesta entrega. A ação deve estar desabilitada/oculta com motivo claro.
- Boards 12 e 51 mostram avatares decorativos; nenhuma presença online ou contagem é exibida. Pausar rotação com a aba oculta e limpar timers; não implementar prefers-reduced-motion.
- Board 13 aceita estado sem meta configurada e total vazio/zero quando não há fontes elegíveis; nunca inventar horas.
- Boards 27–29 permitem link de publicação privada, mas visitante sem permissão recebe landing e OG genéricos. Compartilhamento de página de grupo privado continua indisponível.
- Board 31 conserva a Gestão existente e o aviso na Comunidade; não deve criar aviso no portal/Início.
- Boards 16b e 41b referenciam o editor atual. Não implementar um editor paralelo.
- Nenhum board autoriza limpar os rascunhos antigos. Nenhum board substitui as decisões de autorização, RLS, persistência ou performance.
- Capturas de referência precisam usar HTML e fontes corretas. PNG é comparação auxiliar quando a fonte embutida for substituta.
- Dimensões-alvo para comparação: 320, 360, 390, 768, 820, 1024, 1280 e 1440 px; boards mobile têm PNG 2x. O board 34 define regras por elemento e não uma rota.
