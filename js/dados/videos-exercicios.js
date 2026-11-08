/*
 * J.S. — vídeos de execução da biblioteca de exercícios (YouTube, em português).
 * Cada vídeo foi conferido: existe, permite ser incorporado e o título corresponde ao exercício.
 * Os vídeos são dos canais indicados; o app só os mostra pelo player oficial do YouTube.
 */
(function (root) {
  'use strict';
  var V = {
    "abdominal-infra": { id: "ixJcUH8AlL8", channel: "Leandro Twin", title: "Como fazer abdominal infra" },
    "abdominal-supra": { id: "7YxVRiATugo", channel: "Leandro Twin", title: "Como fazer abdominal supra" },
    "abdutora": { id: "e2gmqTG1OgQ", channel: "Leandro Twin", title: "Como fazer cadeira abdutora" },
    "adutora": { id: "Wf602gn_9zU", channel: "Leandro Twin", title: "Como fazer cadeira adutora" },
    "afundo": { id: "Umzor-_g-tQ", channel: "Leandro Twin", title: "Como fazer afundos" },
    "agachamento-livre": { id: "rM6SDUdl9fs", channel: "Treino Mestre", title: "Agachamento livre com barra - Como fazer corretamente" },
    "agachamento-smith": { id: "EiZnx6a0zyw", channel: "Laércio Refundini - Aulas", title: "Como Fazer o Agachamento no Smith" },
    "agachamento-sumo": { id: "O6Cmxez6D0k", channel: "Leandro Twin", title: "Como fazer agachamento sumo" },
    "bicicleta": { id: "RKi8h4aL75E", channel: "Ana Alves - Personal Elite", title: "Melhore sua postura na bicicleta ergométrica." },
    "bulgaro": { id: "IGf9fR4Y7Iw", channel: "Leandro Twin", title: "Como fazer agachamento búlgaro" },
    "cadeira-extensora": { id: "el3oHblB5DM", channel: "Leandro Twin", title: "Como fazer cadeira extensora" },
    "cadeira-flexora": { id: "Zss6E3VU6X0", channel: "Leandro Twin", title: "Como fazer cadeira flexora" },
    "crucifixo": { id: "uDMmccuPVPQ", channel: "Leandro Twin", title: "Como fazer crucifixo reto" },
    "crucifixo-inverso": { id: "5HDkxzxe400", channel: "Leandro Twin", title: "Como fazer crucifixo inverso" },
    "desenvolvimento": { id: "EuQAfhXBEvs", channel: "Leandro Twin", title: "Como fazer desenvolvimento" },
    "elevacao-frontal": { id: "NxSuojHZa8k", channel: "Leandro Twin", title: "Como fazer elevação frontal halteres" },
    "elevacao-lateral": { id: "IwWvZ0rlNXs", channel: "Leandro Twin", title: "Como fazer elevação lateral" },
    "elevacao-pelvica": { id: "ptK0azwOXwM", channel: "Leandro Twin", title: "Como fazer elevação pélvica" },
    "eliptico": { id: "Rltlu55sBLE", channel: "Academia Sport Extrema", title: "Aprenda como fazer o Aparelho Elíptico corretamente | Sport Extrema" },
    "escada": { id: "atZhl0iCRIo", channel: "Strong Impacto Academia", title: "Explicação básica de uso do Simulador de Escada – Strong Impacto Academia" },
    "esteira": { id: "raa5u4CF2Q4", channel: "Smart Fit", title: "Treino na Esteira: Dicas e Benefícios" },
    "flexao": { id: "dHgoYiCraCw", channel: "Leandro Twin", title: "Como fazer flexão de braço" },
    "gluteo-cabo": { id: "sxROPw3Ur6I", channel: "Vane Fit", title: "Glúteo coice na polia: PASSO A PASSO" },
    "hack": { id: "zHCuW-5wNcw", channel: "Laércio Refundini", title: "Como executar agachamento Hack da forma correta?" },
    "leg-press": { id: "waAxlYvtCcI", channel: "Treino Mestre", title: "Exercício Leg Press 45° -  Execução Correta" },
    "levantamento-terra": { id: "50AkPBZwACQ", channel: "Leandro Twin", title: "Como fazer levantamento terra" },
    "mesa-flexora": { id: "2-ULaRrQa7c", channel: "Leandro Twin", title: "Como fazer mesa flexora" },
    "obliquo": { id: "Smr8ipkN5A0", channel: "Leandro Twin", title: "Como fazer abdominal oblíquo" },
    "panturrilha-pe": { id: "kWIIjmqbC_A", channel: "BlueFit", title: "Panturrilha em Pé Bilateral: Execução, Benefícios e Músculos Trabalhados | Leandro Twin" },
    "panturrilha-sentada": { id: "qP9GavDpYmw", channel: "Laércio Refundini - Aulas", title: "Como Fazer PANTURRILHA SENTADO do Jeito Certo (Aprenda em 1 Minuto)" },
    "peck-deck": { id: "FzCnfD0gOXo", channel: "Leandro Twin", title: "Como fazer peck deck ou crucifixo na máquina" },
    "prancha": { id: "qNRqGqESAWU", channel: "Leandro Twin", title: "Como fazer abdominal prancha" },
    "pulldown": { id: "v6-QIOY0nW0", channel: "Leandro Twin", title: "Como fazer pull down" },
    "puxada-frente": { id: "Hu3TbPgEGDo", channel: "Laércio Refundini - Aulas", title: "Como Fazer o Pulley Frente (Aprenda em 1 Minuto)" },
    "remada-baixa": { id: "f8AVh4VBbos", channel: "Laércio Refundini - Aulas", title: "Como Fazer a REMADA BAIXA (Aprenda em 1 Minuto)" },
    "remada-curvada": { id: "TfxJMertfsw", channel: "Leandro Twin", title: "Como fazer remada curvada barra" },
    "remada-unilateral": { id: "m4h4jT9patY", channel: "Leandro Twin", title: "Como fazer remada halteres unilateral" },
    "rosca-alternada": { id: "S1HAcTVQVYE", channel: "Leandro Twin", title: "Como fazer rosca alternada" },
    "rosca-direta": { id: "Q8TqfD8E7BU", channel: "Leandro Twin", title: "Como fazer rosca direta" },
    "rosca-martelo": { id: "0qkQy8V2FC0", channel: "Leandro Twin", title: "Como fazer rosca martelo" },
    "rosca-scott": { id: "zpTK6eihdSA", channel: "Leandro Twin", title: "Como fazer rosca scott" },
    "stiff": { id: "u1E3_u2gJYE", channel: "Leandro Twin", title: "Como fazer stiff" },
    "supino-inclinado": { id: "WP1VLAt8hbM", channel: "Leandro Twin", title: "Como fazer supino inclinado" },
    "supino-reto": { id: "EZMYCLKuGow", channel: "Leandro Twin", title: "Como fazer supino reto" },
    "triceps-banco": { id: "p_DeBmkbCUc", channel: "Mariana Lassala", title: "Tríceps mergulho no banco! Execução correta!" },
    "triceps-corda": { id: "oNfGj0QtT9Q", channel: "BlueFit", title: "Como Fazer Tríceps na Polia com Corda Corretamente | Leandro Twin Ensina" },
    "triceps-frances": { id: "mfXokM_VnMY", channel: "Isabella Duarte Personal Online", title: "Tríceps Francês com Halter" },
    "triceps-pulley": { id: "dTqDKC0D6P4", channel: "Leandro Twin", title: "Como fazer tríceps pulley bilateral" }
  };
  if (typeof module === 'object' && module.exports) module.exports = V;
  else root.JSVideos = V;
})(typeof self !== 'undefined' ? self : this);
