import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { requireGestaoActor } from "@/lib/gestao-authorization";

export const metadata: Metadata = { title: "Guia da Gestão" };

interface GuideSection {
  readonly id: string;
  readonly paragraphs: readonly string[];
  readonly title: string;
}

const sections: readonly GuideSection[] = [
  {
    id: "como-funciona",
    title: "Como a Gestão funciona",
    paragraphs: [
      "A Gestão é o lugar em que a equipe cria e organiza tudo o que o membro vê na plataforma. O menu lateral tem quatro áreas: Ensino (o que se estuda), Alunos (quem estuda e como vai), Comunidade (o que se conversa) e Administração (quem tem acesso e como a plataforma se comporta). Só administradores e professores entram aqui, e a área de Administração é exclusiva de administradores.",
      "Quase tudo segue o mesmo caminho: uma lista, um botão de criar no alto, uma página de edição e um menu de três pontos em cada linha. O que está em rascunho não aparece para o membro. Só vira realidade para quem estuda depois de publicado. Por isso o fluxo comum é criar, revisar, publicar e só então atribuir.",
      "O botão Ver como aluno, no alto, mostra a plataforma do jeito que um aluno de uma turma a enxerga. Use antes de publicar algo grande. A barra leve que aparece nas telas do membro é um atalho da equipe para voltar à edição.",
    ],
  },
  {
    id: "ensino",
    title: "Ensino",
    paragraphs: [
      "Cursos e percursos. Um curso reúne módulos e aulas gravadas. A seção Cursos do membro mostra apenas cursos de aulas gravadas, nunca tarefas ou exercícios. Um percurso encadeia cursos e outros conteúdos numa ordem sugerida. Crie o curso, adicione módulos, adicione aulas (vídeo do YouTube ou arquivo) e publique. Dentro de cada aula é possível ajustar título, ordem e visibilidade. O membro conclui uma aula sozinho ao passar de 90% do vídeo, ou marcando a caixa de conclusão.",
      "Exercícios. Os bancos de questões guardam as perguntas; as listas de exercícios escolhem quais perguntas formam uma prática. Uma lista só pode ser atribuída depois de publicada.",
      "Atividades. São tarefas com entrega: texto, arquivo ou resposta. As entregas chegam em Alunos, Correções.",
      "Biblioteca e Coleções. A biblioteca guarda materiais soltos (PDFs, links, leituras). Uma coleção agrupa itens de qualquer tipo para o membro encontrar num só lugar. Apagar uma coleção não apaga os itens que estavam nela.",
    ],
  },
  {
    id: "alunos",
    title: "Alunos",
    paragraphs: [
      "Turmas. Uma turma é o grupo que recebe conteúdo e atribuições juntas. Cada aluno pertence a uma ou mais turmas. A página da turma mostra membros, conteúdos liberados e andamento.",
      "Acompanhamento e Correções. O acompanhamento mostra quem está ativo, quem parou e onde. As correções reúnem as entregas esperando retorno. Responder uma correção notifica o aluno.",
      "Atribuições. Uma atribuição entrega um conteúdo publicado a uma turma ou a pessoas específicas, com prazo opcional. Só aparece para escolha o que está publicado e disponível. Apagar uma atribuição retira a entrega dos alunos.",
      "Tarefas e metas. A aba Tarefas lista as tarefas da equipe e dos alunos. A aba Metas guarda as metas coletivas. A meta coletiva soma o tempo de estudo medido (aulas, gravações, exercícios, leituras e cronômetro) e o tempo de presença na plataforma, sem contar duas vezes o mesmo minuto. O total da Gestão é o mesmo da Comunidade, porque os dois leem a mesma conta.",
      "Reconhecimento. Mostra as medalhas e quem as conquistou.",
    ],
  },
  {
    id: "comunidade",
    title: "Comunidade",
    paragraphs: [
      "Publicações. Moderação das publicações dos membros: ocultar, restaurar ou apagar de vez.",
      "Grupos. Grupos de estudo criados pela equipe ou pelos membros. Apagar um grupo remove também as publicações e participações dele.",
      "Avisos. Um aviso importante fica fixo no alto da Comunidade para todos e o membro não pode dispensá-lo. Para tirá-lo do ar, encerre (volta a rascunho) ou apague. Apagar é definitivo; as notificações já enviadas continuam nas caixas de entrada.",
      "Encontros. Cada encontro tem data, tipo e link da sala. Depois que acontece, a gravação pode ser ligada ao encontro pelo painel Gravações do próprio encontro. Quem participou, ou tem acesso ao encontro, passa a ver a gravação em Minhas gravações.",
    ],
  },
  {
    id: "administracao",
    title: "Administração",
    paragraphs: [
      "Membros e papéis. Mude o papel (aluno, professor, administrador) ou desative uma conta. Apagar os dados de uma pessoa é irreversível, exige confirmação e não vale para a sua própria conta nem para o último administrador.",
      "Acessos. Libera para um aluno cursos inteiros, módulos ou aulas avulsas, com data de expiração opcional. Remover o acesso tira o conteúdo da área do aluno na hora.",
      "Gravações históricas. Importação das gravações antigas. Gravações importadas não podem ser apagadas por aqui.",
      "Medalhas. Cada medalha tem nome, símbolo e critério. Trocar o símbolo vale para a plataforma inteira: Reconhecimento, perfil pessoal e perfil público. Mudar o critério ou a meta cria uma nova versão e reavalia todos os membros em seguida, então quem já cumpre o novo critério recebe a medalha e a contagem reflete o efeito real. Uma medalha pode ser arquivada (deixa de ser concedida, mas quem já tem continua com ela) ou apagada de vez.",
      "Personalização, Integrações e Registro de atividades. Personalização ajusta a aparência e os textos da plataforma. Integrações mostra o estado do YouTube. O Registro de atividades guarda quem fez o quê, com data, e é a primeira parada quando algo muda sem explicação.",
    ],
  },
  {
    id: "apagar",
    title: "Apagar de verdade",
    paragraphs: [
      "Cursos, percursos, módulos, aulas, bancos e listas de exercícios, atividades, itens da biblioteca, coleções, turmas, publicações, grupos, avisos, encontros, medalhas e atribuições podem ser apagados de vez, pelo menu de três pontos ou pela página do item. A plataforma pede que você digite APAGAR e descreve o que se perde junto. Não há como desfazer, e cada exclusão fica no Registro de atividades.",
      "Prefira arquivar ou encerrar quando houver chance de querer o conteúdo de volta. Apagar um curso leva embora o progresso dos alunos nele.",
    ],
  },
  {
    id: "rotina",
    title: "Rotina sugerida",
    paragraphs: [
      "Para abrir uma turma nova: crie a turma, publique os cursos, atribua o primeiro conteúdo, marque o primeiro encontro e confira tudo em Ver como aluno. Durante o ciclo, olhe o Acompanhamento uma vez por semana, responda as Correções e use os Avisos só para o que precisa ser visto por todos.",
      "Se algo não aparece para o aluno, verifique nesta ordem: está publicado, está atribuído ou liberado em Acessos, a pessoa está na turma certa, a conta está ativa.",
    ],
  },
];

const GestaoGuidePage = async () => {
  const actor = await requireGestaoActor();
  if (actor.role !== "ADMIN" && actor.role !== "TEACHER") {
    forbidden();
  }
  return (
    <section className="gt-page">
      <header className="gk-head">
        <div className="gk-head-copy">
          <h1>Guia da Gestão</h1>
          <p>Como cada área funciona e em que ordem fazer as coisas.</p>
        </div>
      </header>
      <nav aria-label="Seções do guia" className="gk-guide-index">
        {sections.map((section) => (
          <a href={`#${section.id}`} key={section.id}>
            {section.title}
          </a>
        ))}
      </nav>
      <div className="gk-guide">
        {sections.map((section) => (
          <article
            className="gk-card gk-guide-section"
            id={section.id}
            key={section.id}
          >
            <h2>{section.title}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
          </article>
        ))}
      </div>
    </section>
  );
};

export default GestaoGuidePage;
