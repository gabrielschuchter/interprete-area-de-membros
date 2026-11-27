const SEPARATOR = /[,;\n]/;
const MAX_TOPICS = 12;
const MAX_TOPIC_LENGTH = 40;

/**
 * Lê o campo "Temas" cadastrado pelo professor ("perguntas clínicas, busca,
 * desenhos"): tira espaços e repetições (sem diferenciar maiúsculas) e limita
 * a quantidade e o tamanho para o card não quebrar.
 */
export const parseExerciseListTopics = (raw: string): string[] => {
  const seen = new Set<string>();
  const topics: string[] = [];
  for (const part of raw.split(SEPARATOR)) {
    const topic = part.trim().slice(0, MAX_TOPIC_LENGTH).trim();
    const key = topic.toLocaleLowerCase("pt-BR");
    if (topic && !seen.has(key)) {
      seen.add(key);
      topics.push(topic);
    }
  }
  return topics.slice(0, MAX_TOPICS);
};
