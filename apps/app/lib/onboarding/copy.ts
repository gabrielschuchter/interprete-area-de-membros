// Approved onboarding copy (handoff docs/03-copy.md, assets/copy.pt-BR.json).
// Literal, emoticons included. The one deliberate change is `invalido`: the
// approved text lists "ponto" and "sublinhado", which the app's username
// alphabet does not accept (mentions and /membros/{username} depend on it).
export const onboardingCopy = {
  marca: "Interprete.",
  salvo: {
    inicial: "Salva sozinho",
    salvando: "Salvando…",
    ok: "Salvo agora há pouco",
    final: "Tudo salvo",
  },
  acao: {
    continuar: "Continuar",
    voltar: "Voltar",
    pular: "Pular",
    sair: "Sair",
    tentar: "Tentar de novo",
  },
  a11yEtapa: (n: number, nome: string) => `Etapa ${n} de 7: ${nome}`,
  boasVindas: {
    titulo: "Oi :)",
    subtitulo: "Que bom que você chegou.",
    texto:
      "Antes de abrir as portas, a gente quer te conhecer um pouquinho. São poucas perguntas, uma de cada vez, e a primeira é só o seu nome.",
    cta: "Vamos lá",
    rodape: "Tudo é salvo sozinho. Pode fechar a aba e voltar quando quiser.",
    rodapeCurto: "Tudo é salvo sozinho.",
    nota: "sua carteirinha ainda está em branco. vamos preencher juntos? :)",
  },
  carteirinha: {
    tipo: "CARTEIRINHA DE ALUNO",
    nome: "seu nome aqui",
    username: "@username",
    legenda: "ainda em branco :)",
    contexto: "profissão e instituição: a preencher",
    desde: (data: string) => `ALUNO DESDE ${data}`,
    temas: (n: number) => (n === 1 ? "1 tema" : `${n} temas`),
    carimbo: "MATRICULADO",
  },
  identidade: {
    titulo: "Como a gente te chama?",
    texto:
      "É o nome que as pessoas vão ver nas aulas, nas discussões e nos encontros. O username vira o seu endereço por aqui.",
    campoNome: "Nome de exibição",
    placeholderNome: "Como você gosta de ser chamado",
    campoUsername: "Username",
    placeholderUsername: "seu-username",
    seloCadastro: "do seu cadastro",
    verificando: "Conferindo se está livre…",
    livre: "Livre. É seu :)",
    endereco: (username: string) => `Seu endereço fica /membros/${username}`,
    curto: "Precisa de pelo menos 3 letras ou números, tá?",
    invalido: "Só letras minúsculas, números e hífen.",
    ocupado: "Esse já tem dono. Que tal",
    reservado: "Esse nome é reservado pela escola. Que tal",
    nomeLongo: "Cabe até 60 caracteres. Dá pra abreviar um pouquinho?",
    checagemFalhou:
      "Não deu pra conferir agora. A gente tenta de novo quando você continuar.",
    pendenteNome: "Falta só o seu nome.",
    pendenteUsername: "Falta só acertar o username.",
    eco: (primeiroNome: string) => `Prazer, ${primeiroNome} :)`,
    nota: "olha: enquanto você escreve, sua carteirinha vai mudando :)",
  },
  foto: {
    titulo: "Que tal um rosto pra essas conversas?",
    texto:
      "Uma foto ajuda o pessoal a reconhecer quem está por trás das perguntas e das ideias.",
    escolher: "Escolher foto",
    trocar: "Trocar foto",
    remover: "Remover",
    conta: "Usar a foto da minha conta",
    enquadramento: "Ajustar enquadramento",
    dica: "JPG, PNG ou WebP · até 5 MB",
    semFoto:
      "Sem foto, a gente usa a sua inicial. Você troca quando quiser, no Perfil ;)",
    arrastando: "Solta aqui :)",
    enviando: "Subindo sua foto…",
    enviandoBotao: "Enviando…",
    erroTamanho: (mb: string) =>
      `Essa foto tem ${mb} MB. Tenta uma de até 5 MB?`,
    erroFormato: "Esse formato a gente não lê. Tenta JPG, PNG ou WebP?",
    erroUpload: "A foto não subiu. Tenta de novo?",
    erroConta: "Não encontramos uma foto na sua conta. Que tal escolher uma?",
    removida: "Foto removida. Você aparece com a sua inicial.",
    desfazer: "Desfazer",
    folhaTitulo: "Escolher foto",
    folhaCamera: "Tirar uma foto",
    folhaGaleria: "Escolher da galeria",
    folhaRemover: "Remover foto",
    folhaCancelar: "Cancelar",
    nota: "ficou bom! o pessoal vai te reconhecer de longe :)",
  },
  sobre: {
    titulo: "O que você faz por aí?",
    texto:
      "Conta onde você atua ou estuda. Quando você comentar numa discussão, as pessoas vão entender melhor de onde vem o seu olhar.",
    textoCurto:
      "Conta onde você atua ou estuda. Isso ajuda a turma a entender de onde vem o seu olhar.",
    profissao: "Profissão ou área",
    instituicao: "Instituição",
    bio: "Bio curta",
    bioPlaceholder: "O que você quer investigar por aqui?",
    bioAjuda: "Uma ou duas frases já bastam :)",
    bioCortada:
      "Cortamos o final pra caber em 240 caracteres. Dá uma conferida?",
    linksAbrir: "Deixar um caminho até você",
    linksAbrirDetalhe: "(site, Instagram, LinkedIn)",
    site: "Site",
    instagram: "Instagram",
    linkedin: "LinkedIn",
    sitePlaceholder: "https://seusite.com",
    instagramPlaceholder: "@seuusuario",
    linkedinPlaceholder: "linkedin.com/in/seu-nome",
    linksErro: "Esse link não parece certo. Confere se começa com https://?",
    seloPerfil: "já estava no perfil",
    nota: "isso aparece no seu perfil, pra turma saber de onde você fala :)",
  },
  interesses: {
    titulo: "O que tira o seu sono, no bom sentido?",
    texto:
      "Escolhe os temas que te interessam. Pode marcar quantos quiser, e dá pra mudar sempre que a vontade mudar.",
    textoCurto:
      "Marque quantos quiser. Dá pra mudar sempre que a vontade mudar.",
    contador: (n: number) => {
      if (n === 0) {
        return "NENHUM TEMA AINDA. SEM PRESSA :)";
      }
      return n === 1 ? "1 TEMA ESCOLHIDO" : `${n} TEMAS ESCOLHIDOS`;
    },
    nota: "com isso a gente sugere discussões e materiais da Biblioteca que combinam com você ;)",
  },
  avisos: {
    titulo: "Quer que a gente te avise das novidades?",
    texto:
      "Escolhe o jeitinho que prefere por enquanto. Cada aviso pode ser ajustado depois, em Configurações.",
    tudo: "Tudo ligado",
    tudoSelo: "sugerido",
    tudoDetalhe:
      "Menções, respostas, novas aulas e módulos, atividades, feedbacks, prazos e avisos dos professores.",
    essencial: "Só o essencial",
    essencialDetalhe:
      "Menções, respostas aos seus comentários, prazos e comunicados dos professores. O resto fica quieto.",
    um: "Prefiro ajustar um por um",
    umDetalhe: "Abre a lista completa para você escolher aviso por aviso.",
    cta: "Guardar e continuar",
    erroGuardar:
      "Não conseguimos guardar suas preferências agora. Elas continuam como estavam. Tenta de novo?",
    nota: "é só um exemplo do que pode chegar até você :)",
  },
  conclusao: {
    titulo: "Aí sim :)",
    subtitulo: (primeiroNome: string) =>
      `Pronto, ${primeiroNome}. Agora a escola também tem um pouquinho de você.`,
    semTurma:
      "Sem turma por enquanto? Tudo bem: você entra do mesmo jeito. Os conteúdos aparecem por aqui assim que a turma te liberar.",
    cta: "Entrar no Interprete",
    secundario: "Revisar meu perfil",
    pendenciasTitulo: "Ficou pra depois",
    pendenciasLink: "completar no Perfil",
    finalizando: "Guardando tudo…",
    erroFinalizar:
      "Não conseguimos finalizar agora. Seus dados estão guardados. Tenta de novo?",
    nota: "entra, a casa é sua ;)",
  },
  retomada: {
    titulo: (primeiroNome: string) =>
      primeiroNome
        ? `Que bom te ver de novo, ${primeiroNome} :)`
        : "Que bom te ver de novo :)",
    texto: (etapa: string) =>
      `Você parou em “${etapa}”. Tudo o que você já preencheu está guardado.`,
    continuar: "Continuar de onde parei",
    recomecar: "Rever do começo",
  },
  antigo: {
    titulo: "Já tínhamos algumas coisas suas :)",
    texto: "É só conferir. Nada aqui pede de novo o que já está no seu perfil.",
  },
  offline:
    "Você está sem conexão. A gente guarda o que você escreve aqui e salva assim que a internet voltar :)",
  offlineBotao: "Volta a funcionar quando a conexão voltar.",
  sessao: {
    titulo: "Sua sessão expirou.",
    texto:
      "Entra de novo e a gente continua de onde você parou. Nada do que você escreveu se perdeu.",
    botao: "Entrar de novo",
  },
  erroGenerico:
    "Não conseguimos salvar agora. Tenta de novo em instantes? O que você escreveu continua aqui.",
} as const;
