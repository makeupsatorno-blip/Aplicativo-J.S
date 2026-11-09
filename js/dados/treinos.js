/*
 * J.S. — treinos prontos: fichas avulsas e semanas completas para adicionar com um toque
 * (Treino → Fichas → Treinos prontos). Depois de adicionadas, viram fichas normais da usuária:
 * dá para editar exercícios, séries, repetições e cargas.
 * Cada exercício: [id do exercício (js/dados/exercicios.js), séries, repetições, descanso em segundos].
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JSTreinos = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LOCAIS = { academia: 'Academia', casa: 'Em casa', cardio: 'Cardio e abdômen' };

  var FICHAS = {
    /* ---------------- Academia ---------------- */
    'gluteos-foco': { name: 'Glúteos — foco total', local: 'academia', nivel: 'Intermediária', min: 55, items: [
      ['elevacao-pelvica', 4, '10-12', 90], ['bulgaro', 3, '10 cada', 90], ['agachamento-sumo', 3, '12', 60],
      ['gluteo-cabo', 3, '12 cada', 45], ['abdutora', 4, '15-20', 45], ['elevacao-pelvica-unilateral', 3, '12 cada', 45]] },
    'inferior-quadriceps': { name: 'Inferior — Quadríceps e glúteos', local: 'academia', nivel: 'Intermediária', min: 60, items: [
      ['agachamento-livre', 4, '8-10', 120], ['leg-press', 4, '10-12', 90], ['afundo', 3, '10 cada', 60],
      ['cadeira-extensora', 3, '12-15', 60], ['elevacao-pelvica', 3, '12', 90], ['panturrilha-pe', 4, '15', 45]] },
    'posterior-gluteos': { name: 'Posterior e glúteos', local: 'academia', nivel: 'Intermediária', min: 55, items: [
      ['stiff', 4, '10', 90], ['mesa-flexora', 4, '10-12', 60], ['elevacao-pelvica', 4, '10', 90],
      ['cadeira-flexora', 3, '12', 60], ['good-morning', 3, '10', 90], ['abducao-cabo', 3, '15 cada', 45]] },
    'pernas-completo': { name: 'Pernas completo', local: 'academia', nivel: 'Intermediária', min: 65, items: [
      ['agachamento-livre', 4, '8-10', 120], ['hack', 3, '10', 90], ['mesa-flexora', 3, '12', 60], ['cadeira-extensora', 3, '12', 60],
      ['stiff', 3, '10', 90], ['adutora', 3, '15', 45], ['panturrilha-sentada', 4, '15', 45]] },
    'costas-biceps': { name: 'Costas e bíceps', local: 'academia', nivel: 'Intermediária', min: 50, items: [
      ['puxada-frente', 4, '10-12', 90], ['remada-baixa', 4, '10-12', 90], ['remada-unilateral', 3, '10 cada', 60],
      ['pulldown', 3, '12', 60], ['rosca-direta', 3, '10-12', 60], ['rosca-martelo', 3, '12', 45]] },
    'peito-ombro-triceps': { name: 'Peito, ombros e tríceps', local: 'academia', nivel: 'Intermediária', min: 50, items: [
      ['supino-reto', 4, '8-10', 90], ['supino-inclinado', 3, '10', 90], ['desenvolvimento', 3, '10', 90],
      ['elevacao-lateral', 3, '12-15', 45], ['triceps-corda', 3, '12', 45], ['triceps-frances', 3, '12', 45]] },
    'superior-completo': { name: 'Superior completo', local: 'academia', nivel: 'Iniciante', min: 50, items: [
      ['puxada-frente', 3, '12', 60], ['supino-maquina', 3, '12', 60], ['remada-baixa', 3, '12', 60], ['desenvolvimento', 3, '12', 60],
      ['elevacao-lateral', 3, '15', 45], ['rosca-direta', 3, '12', 45], ['triceps-pulley', 3, '12', 45]] },
    'ombros-abdomen': { name: 'Ombros e abdômen', local: 'academia', nivel: 'Intermediária', min: 45, items: [
      ['desenvolvimento-arnold', 4, '10', 90], ['elevacao-lateral', 4, '12-15', 45], ['elevacao-frontal', 3, '12', 45], ['face-pull', 3, '15', 45],
      ['abdominal-polia', 3, '15', 45], ['prancha', 3, '40 s', 30], ['abdominal-infra', 3, '15', 30]] },
    'bracos': { name: 'Braços — bíceps e tríceps', local: 'academia', nivel: 'Intermediária', min: 40, items: [
      ['rosca-scott', 3, '10', 60], ['triceps-testa', 3, '10', 60], ['rosca-alternada', 3, '12', 45],
      ['triceps-corda', 3, '12', 45], ['rosca-concentrada', 3, '12 cada', 45], ['triceps-banco', 3, '12', 45]] },
    'full-body-a': { name: 'Full body A', local: 'academia', nivel: 'Iniciante', min: 45, items: [
      ['agachamento-goblet', 3, '12', 90], ['supino-maquina', 3, '12', 60], ['puxada-frente', 3, '12', 60],
      ['elevacao-pelvica', 3, '12', 90], ['desenvolvimento', 3, '12', 60], ['prancha', 3, '30 s', 30]] },
    'full-body-b': { name: 'Full body B', local: 'academia', nivel: 'Iniciante', min: 45, items: [
      ['leg-press', 3, '12', 90], ['remada-baixa', 3, '12', 60], ['flexao-inclinada', 3, '10', 60],
      ['stiff', 3, '12', 90], ['elevacao-lateral', 3, '15', 45], ['dead-bug', 3, '10 cada', 30]] },
    'adaptacao': { name: 'Adaptação — primeiras semanas', local: 'academia', nivel: 'Iniciante', min: 40, items: [
      ['leg-press', 2, '15', 60], ['cadeira-extensora', 2, '15', 60], ['mesa-flexora', 2, '15', 60], ['puxada-frente', 2, '15', 60],
      ['supino-maquina', 2, '15', 60], ['abdutora', 2, '15', 45], ['abdominal-supra', 2, '15', 30]] },
    'funcional': { name: 'Funcional — corpo todo', local: 'academia', nivel: 'Intermediária', min: 40, items: [
      ['kettlebell-swing', 4, '15', 45], ['agachamento-goblet', 3, '12', 45], ['remada-invertida', 3, '10', 45], ['corda-naval', 4, '30 s', 30],
      ['terra-sumo', 3, '10', 60], ['abdominal-russo', 3, '20', 30], ['burpee', 3, '8', 45]] },

    /* ---------------- Em casa ---------------- */
    'casa-pernas': { name: 'Em casa — Pernas e glúteos', local: 'casa', nivel: 'Iniciante', min: 40, items: [
      ['agachamento-goblet', 4, '15', 60], ['bulgaro', 3, '10 cada', 60], ['ponte', 4, '15', 45], ['agachamento-sumo', 3, '15', 45],
      ['gluteo-quatro-apoios', 3, '15 cada', 30], ['agachamento-lateral', 3, '10 cada', 45], ['panturrilha-pe', 3, '20', 30]] },
    'casa-superior': { name: 'Em casa — Superior e core', local: 'casa', nivel: 'Iniciante', min: 40, items: [
      ['flexao-joelhos', 3, '10-12', 60], ['remada-curvada', 3, '12', 60], ['desenvolvimento', 3, '12', 60], ['elevacao-lateral', 3, '15', 45],
      ['triceps-banco', 3, '12', 45], ['rosca-alternada', 3, '12', 45], ['superman', 3, '12', 30], ['prancha', 3, '30 s', 30]] },
    'casa-iniciante': { name: 'Em casa — Começando', local: 'casa', nivel: 'Iniciante', min: 30, items: [
      ['agachamento-banco', 3, '12', 60], ['ponte', 3, '15', 45], ['flexao-inclinada', 3, '8', 60],
      ['superman', 3, '10', 30], ['dead-bug', 2, '8 cada', 30], ['polichinelo', 3, '30 s', 30]] },
    'hiit-20': { name: 'HIIT 20 min — sem aparelho', local: 'casa', nivel: 'Intermediária', min: 20, items: [
      ['polichinelo', 4, '40 s', 20], ['agachamento-salto', 4, '12', 30], ['escalador', 4, '30 s', 20],
      ['burpee', 4, '10', 30], ['skipping', 4, '30 s', 20]] },

    /* ---------------- Cardio e abdômen ---------------- */
    'abdomen-15': { name: 'Abdômen e core — 15 min', local: 'cardio', nivel: 'Todos os níveis', min: 15, items: [
      ['prancha', 3, '40 s', 20], ['abdominal-supra', 3, '15', 20], ['abdominal-infra', 3, '15', 20],
      ['abdominal-bicicleta', 3, '20', 20], ['dead-bug', 3, '10 cada', 20], ['prancha-lateral', 2, '30 s cada', 20]] },
    'abdomen-forte': { name: 'Abdômen forte', local: 'cardio', nivel: 'Intermediária', min: 20, items: [
      ['abdominal-canivete', 3, '12', 30], ['elevacao-pernas-barra', 3, '10', 45], ['abdominal-russo', 3, '20', 30],
      ['abdominal-polia', 3, '15', 45], ['obliquo', 3, '15 cada', 30], ['prancha', 3, '45 s', 30]] },
    'cardio-academia': { name: 'Cardio na academia', local: 'cardio', nivel: 'Todos os níveis', min: 45, items: [
      ['esteira', 1, '20 min', 0], ['bicicleta', 1, '15 min', 0], ['eliptico', 1, '10 min', 0]] }
  };

  // Semanas completas: [dia da semana (0 = domingo ... 6 = sábado), ficha]. Os outros dias ficam de descanso.
  var PROGRAMAS = [
    { id: 'abc', name: 'ABC — 3 dias', nivel: 'Iniciante e intermediária', desc: 'Pernas e glúteos duas vezes por semana e o superior uma vez. Bom para quem treina 3 dias.',
      dias: [[1, 'inferior-quadriceps'], [3, 'superior-completo'], [5, 'posterior-gluteos']] },
    { id: 'abcd', name: 'ABCD — 4 dias', nivel: 'Intermediária', desc: 'Cada grupo com um dia só para ele: quadríceps, costas, posterior e glúteos, peito e ombros.',
      dias: [[1, 'inferior-quadriceps'], [2, 'costas-biceps'], [4, 'posterior-gluteos'], [5, 'peito-ombro-triceps']] },
    { id: 'abcde', name: 'ABCDE — 5 dias', nivel: 'Intermediária e avançada', desc: 'Um treino diferente por dia, com glúteos em dia próprio.',
      dias: [[1, 'inferior-quadriceps'], [2, 'costas-biceps'], [3, 'gluteos-foco'], [4, 'peito-ombro-triceps'], [5, 'posterior-gluteos']] },
    { id: 'gluteos', name: 'Foco em glúteos e pernas — 4 dias', nivel: 'Intermediária', desc: 'Três dias de inferior (glúteos, quadríceps e posterior) e um de superior.',
      dias: [[1, 'gluteos-foco'], [2, 'superior-completo'], [4, 'inferior-quadriceps'], [5, 'posterior-gluteos']] },
    { id: 'full-body', name: 'Full body — 3 dias', nivel: 'Iniciante', desc: 'Corpo todo em cada treino, alternando A e B. Ideal para começar ou voltar a treinar.',
      dias: [[1, 'full-body-a'], [3, 'full-body-b'], [5, 'full-body-a']] },
    { id: 'adaptacao', name: 'Adaptação — 3 dias', nivel: 'Iniciante', desc: 'Para as primeiras 4 semanas: máquinas, poucas séries e carga leve para aprender os movimentos.',
      dias: [[1, 'adaptacao'], [3, 'adaptacao'], [5, 'adaptacao']] },
    { id: 'casa', name: 'Em casa — 3 dias', nivel: 'Iniciante', desc: 'Sem academia: peso do corpo e um par de halteres. Pernas, superior e um HIIT curto.',
      dias: [[1, 'casa-pernas'], [3, 'casa-superior'], [5, 'hiit-20']] }
  ];

  return { LOCAIS: LOCAIS, FICHAS: FICHAS, PROGRAMAS: PROGRAMAS };
});
