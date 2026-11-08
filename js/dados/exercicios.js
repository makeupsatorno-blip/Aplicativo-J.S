/*
 * J.S. — biblioteca de exercícios (padrão). A usuária pode criar os seus em Treino → Fichas.
 * "dica" é um lembrete curto de execução; para ver em vídeo, o app abre uma busca pelo nome.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JSExercicios = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var GRUPOS = {
    peito: 'Peito', costas: 'Costas', ombros: 'Ombros', biceps: 'Bíceps', triceps: 'Tríceps',
    quadriceps: 'Quadríceps', posterior: 'Posterior de coxa', gluteos: 'Glúteos', panturrilha: 'Panturrilha',
    abdomen: 'Abdômen', cardio: 'Cardio', outro: 'Outro'
  };

  // [id, nome, grupo, aparelho, dica]
  var LISTA = [
    ['supino-reto', 'Supino reto', 'peito', 'Barra ou halteres', 'Escápulas encaixadas, pés firmes no chão. Desça até a linha do peito e empurre sem tirar o quadril do banco.'],
    ['supino-inclinado', 'Supino inclinado', 'peito', 'Barra ou halteres', 'Banco a 30–45°. Desça controlando até a parte alta do peito e suba sem travar os cotovelos.'],
    ['crucifixo', 'Crucifixo', 'peito', 'Halteres', 'Cotovelos levemente dobrados o tempo todo. Abra até sentir o peito alongar e feche como num abraço.'],
    ['peck-deck', 'Peck deck (voador)', 'peito', 'Máquina', 'Costas apoiadas e cotovelos na altura dos ombros. Feche à frente do peito e volte devagar.'],
    ['flexao', 'Flexão de braço', 'peito', 'Peso do corpo', 'Corpo alinhado da cabeça aos pés. Desça até o peito quase tocar o chão; dá para apoiar os joelhos.'],
    ['puxada-frente', 'Puxada na frente (pulley)', 'costas', 'Máquina', 'Peito aberto, puxe a barra até a parte alta do peito levando os cotovelos para baixo. Volte controlando.'],
    ['remada-baixa', 'Remada baixa', 'costas', 'Máquina / cabo', 'Coluna reta, puxe o triângulo até o abdômen juntando as escápulas. Não balance o tronco.'],
    ['remada-curvada', 'Remada curvada', 'costas', 'Barra ou halteres', 'Tronco inclinado com a coluna neutra. Puxe em direção ao umbigo e desça devagar.'],
    ['remada-unilateral', 'Remada unilateral (serrote)', 'costas', 'Halter', 'Apoie mão e joelho no banco. Puxe o halter ao lado do corpo levando o cotovelo para trás.'],
    ['pulldown', 'Pulldown braço estendido', 'costas', 'Cabo', 'Braços quase estendidos, leve a barra da altura dos olhos até as coxas usando as costas.'],
    ['desenvolvimento', 'Desenvolvimento', 'ombros', 'Halteres ou máquina', 'Abdômen firme. Empurre acima da cabeça sem arquear a lombar e desça até a linha das orelhas.'],
    ['elevacao-lateral', 'Elevação lateral', 'ombros', 'Halteres', 'Cotovelos levemente dobrados. Suba até a altura dos ombros, sem impulso, e desça devagar.'],
    ['elevacao-frontal', 'Elevação frontal', 'ombros', 'Halteres ou anilha', 'Suba à frente até a altura dos ombros, sem balançar o tronco.'],
    ['crucifixo-inverso', 'Crucifixo inverso', 'ombros', 'Halteres ou máquina', 'Tronco inclinado ou na máquina. Abra os braços para trás focando na parte de trás do ombro.'],
    ['rosca-direta', 'Rosca direta', 'biceps', 'Barra ou halteres', 'Cotovelos colados ao corpo. Suba sem balançar e desça até quase estender o braço.'],
    ['rosca-alternada', 'Rosca alternada', 'biceps', 'Halteres', 'Um braço de cada vez, girando o punho na subida. Cotovelo parado.'],
    ['rosca-martelo', 'Rosca martelo', 'biceps', 'Halteres', 'Pegada neutra (palmas viradas uma para a outra). Suba e desça controlando.'],
    ['rosca-scott', 'Rosca Scott', 'biceps', 'Barra ou máquina', 'Braços apoiados no banco Scott. Desça devagar sem estender totalmente com tranco.'],
    ['triceps-pulley', 'Tríceps no pulley', 'triceps', 'Cabo', 'Cotovelos fixos ao lado do corpo. Estenda os braços para baixo e volte até 90°.'],
    ['triceps-corda', 'Tríceps corda', 'triceps', 'Cabo', 'Estenda os braços abrindo a corda no final. Cotovelos parados.'],
    ['triceps-frances', 'Tríceps francês', 'triceps', 'Halter', 'Halter atrás da cabeça, cotovelos apontando para cima. Estenda sem abrir os cotovelos.'],
    ['triceps-banco', 'Tríceps no banco', 'triceps', 'Peso do corpo', 'Mãos no banco, desça dobrando os cotovelos para trás e empurre de volta.'],
    ['agachamento-livre', 'Agachamento livre', 'quadriceps', 'Barra', 'Pés na largura dos ombros, joelhos acompanham a ponta dos pés. Desça com o peito aberto e suba empurrando o chão.'],
    ['agachamento-smith', 'Agachamento no Smith', 'quadriceps', 'Máquina Smith', 'Pés um pouco à frente da barra. Desça controlando e suba sem travar os joelhos.'],
    ['agachamento-sumo', 'Agachamento sumô', 'gluteos', 'Halter ou kettlebell', 'Pés afastados e virados para fora. Desça com o tronco ereto e suba apertando os glúteos.'],
    ['leg-press', 'Leg press 45°', 'quadriceps', 'Máquina', 'Lombar apoiada no encosto. Desça até ~90° nos joelhos e empurre sem travar.'],
    ['cadeira-extensora', 'Cadeira extensora', 'quadriceps', 'Máquina', 'Ajuste o encosto para o joelho ficar no eixo da máquina. Estenda e desça devagar.'],
    ['afundo', 'Afundo / passada', 'quadriceps', 'Halteres ou peso do corpo', 'Passo largo; desça até os dois joelhos ficarem perto de 90°. Tronco ereto.'],
    ['bulgaro', 'Agachamento búlgaro', 'gluteos', 'Halteres', 'Pé de trás apoiado no banco. Desça na vertical e suba pelo calcanhar da frente.'],
    ['hack', 'Agachamento hack', 'quadriceps', 'Máquina', 'Costas apoiadas, pés na plataforma. Desça controlando e suba sem tirar o quadril do encosto.'],
    ['mesa-flexora', 'Mesa flexora', 'posterior', 'Máquina', 'Quadril colado no banco. Flexione os joelhos trazendo o rolo até o glúteo e volte devagar.'],
    ['cadeira-flexora', 'Cadeira flexora', 'posterior', 'Máquina', 'Joelho alinhado ao eixo da máquina. Puxe para baixo e volte controlando.'],
    ['stiff', 'Stiff', 'posterior', 'Barra ou halteres', 'Joelhos levemente dobrados, leve o quadril para trás descendo o peso rente às pernas. Coluna neutra.'],
    ['levantamento-terra', 'Levantamento terra', 'posterior', 'Barra', 'Barra perto da canela, coluna neutra. Suba estendendo quadril e joelhos juntos.'],
    ['elevacao-pelvica', 'Elevação pélvica', 'gluteos', 'Barra ou máquina', 'Costas apoiadas no banco, pés firmes. Suba o quadril até alinhar com o tronco e aperte os glúteos.'],
    ['gluteo-cabo', 'Glúteo no cabo (coice)', 'gluteos', 'Cabo', 'Tronco firme, leve a perna para trás sem arquear a lombar.'],
    ['abdutora', 'Cadeira abdutora', 'gluteos', 'Máquina', 'Abra as pernas contra a resistência e volte devagar, sem bater o peso.'],
    ['adutora', 'Cadeira adutora', 'quadriceps', 'Máquina', 'Feche as pernas controlando, sem impulso.'],
    ['panturrilha-pe', 'Panturrilha em pé', 'panturrilha', 'Máquina ou degrau', 'Suba na ponta dos pés o máximo possível e desça alongando.'],
    ['panturrilha-sentada', 'Panturrilha sentada', 'panturrilha', 'Máquina', 'Joelhos a 90°. Suba e desça com amplitude completa.'],
    ['abdominal-supra', 'Abdominal supra', 'abdomen', 'Colchonete', 'Lombar no chão, suba o tronco "enrolando" a coluna sem puxar o pescoço.'],
    ['prancha', 'Prancha', 'abdomen', 'Peso do corpo', 'Antebraços no chão e corpo alinhado. Contraia o abdômen; anote os segundos nas repetições.'],
    ['abdominal-infra', 'Abdominal infra', 'abdomen', 'Colchonete ou barra', 'Eleve as pernas tirando o quadril do chão no final, sem embalo.'],
    ['obliquo', 'Abdominal oblíquo', 'abdomen', 'Colchonete', 'Leve o ombro em direção ao joelho oposto, alternando os lados.'],
    ['esteira', 'Esteira', 'cardio', 'Esteira', 'Anote minutos em "repetições" e a velocidade ou inclinação em "carga".'],
    ['bicicleta', 'Bicicleta', 'cardio', 'Bicicleta ergométrica', 'Anote minutos em "repetições" e o nível em "carga".'],
    ['eliptico', 'Elíptico (transport)', 'cardio', 'Elíptico', 'Anote minutos em "repetições" e o nível em "carga".'],
    ['escada', 'Escada', 'cardio', 'Simulador de escada', 'Anote minutos em "repetições" e o nível em "carga".']
  ];

  var ITENS = LISTA.map(function (r) {
    return { id: 'ex:' + r[0], name: r[1], group: r[2], equipment: r[3], tips: r[4], builtIn: true };
  });

  return { GRUPOS: GRUPOS, ITENS: ITENS };
});
