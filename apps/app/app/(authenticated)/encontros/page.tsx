import { permanentRedirect } from "next/navigation";

// Encontros vive na Comunidade; /encontros/[id] continua sendo a página de
// cada encontro (calendário e notificações apontam para ela).
const LegacyMeetingsPage = () => permanentRedirect("/comunidade/encontros");

export default LegacyMeetingsPage;
