/*
 * J.S. — opções de cardápio para as sugestões da Alimentação.
 * Cada item é [nome exato na Tabela TACO, gramas da porção base, fixo?]. Itens "fixos" (café,
 * folhas, legumes, azeite) não mudam com a meta de calorias; os outros são ajustados para
 * a parte da meta de cada refeição. São combinações gerais e equilibradas, não uma dieta prescrita.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JSCardapios = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var CAFE = ['Café, infusão 10%', 100, true];
  var AZEITE = ['Azeite, de oliva, extra virgem', 5, true];
  var OVO = 'Ovo, de galinha, inteiro, cozido/10minutos';

  var CARDAPIOS = {
    breakfast: [
      { nome: 'Pão francês com ovo e mamão', itens: [['Pão, trigo, francês', 50], [OVO, 50], ['Mamão, Papaia, cru', 150], CAFE] },
      { nome: 'Iogurte com aveia e frutas', itens: [['Iogurte, natural', 170], ['Aveia, flocos, crua', 30], ['Banana, prata, crua', 80], ['Morango, cru', 80]] },
      { nome: 'Pão integral com queijo branco e maçã', itens: [['Pão, trigo, forma, integral', 50], ['Queijo, minas, frescal', 30], ['Maçã, Fuji, com casca, crua', 130], CAFE] },
      { nome: 'Tapioca com ovo e melão', itens: [['Tapioca, com manteiga', 60], [OVO, 50], ['Melão, cru', 150], CAFE] },
      { nome: 'Cuscuz com ovo e banana', itens: [['Cuscuz, de milho, cozido com sal', 120], [OVO, 50], ['Banana, prata, crua', 80], CAFE] },
      { nome: 'Ovos cozidos com pão integral e abacaxi', itens: [[OVO, 100], ['Pão, trigo, forma, integral', 25], ['Abacaxi, cru', 130], CAFE] }
    ],
    lunch: [
      { nome: 'Arroz, feijão, frango grelhado e salada', itens: [['Arroz, tipo 1, cozido', 120], ['Feijão, carioca, cozido', 100], ['Frango, peito, sem pele, grelhado', 110], ['Alface, crespa, crua', 40, true], ['Tomate, com semente, cru', 60, true], AZEITE] },
      { nome: 'Arroz integral, feijão preto, carne magra e legumes', itens: [['Arroz, integral, cozido', 120], ['Feijão, preto, cozido', 100], ['Carne, bovina, patinho, sem gordura, grelhado', 100], ['Brócolis, cozido', 80, true], ['Cenoura, cozida', 50, true]] },
      { nome: 'Peixe assado com batata, arroz e legumes', itens: [['Merluza, filé, assado', 140], ['Batata, inglesa, cozida', 120], ['Arroz, tipo 1, cozido', 80], ['Abobrinha, italiana, cozida', 80, true], ['Cenoura, cozida', 50, true], AZEITE] },
      { nome: 'Arroz, lentilha, frango e legumes', itens: [['Arroz, tipo 1, cozido', 120], ['Lentilha, cozida', 100], ['Frango, coxa, sem pele, cozida', 100], ['Chuchu, cozido', 80, true], ['Beterraba, cozida', 50, true]] },
      { nome: 'Batata-doce, carne moída, feijão e salada', itens: [['Batata, doce, cozida', 150], ['Carne, bovina, acém, moído, cozido', 100], ['Feijão, carioca, cozido', 80], ['Rúcula, crua', 30, true], ['Tomate, com semente, cru', 60, true], AZEITE] },
      { nome: 'Salmão grelhado, arroz integral e brócolis', itens: [['Salmão, sem pele, fresco, grelhado', 100], ['Arroz, integral, cozido', 120], ['Feijão, carioca, cozido', 60], ['Brócolis, cozido', 100, true]] }
    ],
    dinner: [
      { nome: 'Frango grelhado com abóbora, arroz integral e salada', itens: [['Frango, peito, sem pele, grelhado', 100], ['Abóbora, cabotian, cozida', 150], ['Arroz, integral, cozido', 80], ['Alface, crespa, crua', 40, true], ['Tomate, com semente, cru', 60, true]] },
      { nome: 'Peixe grelhado com mandioca e brócolis', itens: [['Pintado, grelhado', 120], ['Mandioca, cozida', 100], ['Brócolis, cozido', 80, true], AZEITE] },
      { nome: 'Arroz, feijão, ovos e couve', itens: [['Arroz, tipo 1, cozido', 100], ['Feijão, carioca, cozido', 80], [OVO, 100], ['Couve, manteiga, refogada', 40, true], ['Tomate, com semente, cru', 60, true]] },
      { nome: 'Carne magra com batata e salada', itens: [['Carne, bovina, patinho, sem gordura, grelhado', 100], ['Batata, inglesa, cozida', 150], ['Cenoura, crua', 40, true], ['Pepino, cru', 50, true], AZEITE] },
      { nome: 'Tofu com arroz integral e legumes', itens: [['Soja, queijo (tofu)', 120], ['Arroz, integral, cozido', 120], ['Feijão, preto, cozido', 60], ['Brócolis, cozido', 80, true], ['Abobrinha, italiana, refogada', 80, true]] },
      { nome: 'Sanduíche de frango com queijo branco e salada', itens: [['Pão, trigo, forma, integral', 50], ['Frango, peito, sem pele, cozido', 80], ['Queijo, minas, frescal', 30], ['Alface, crespa, crua', 20, true], ['Tomate, com semente, cru', 40, true]] }
    ],
    snack: [
      { nome: 'Iogurte natural com morango', itens: [['Iogurte, natural', 170], ['Morango, cru', 100]] },
      { nome: 'Banana com castanha-do-pará', itens: [['Banana, prata, crua', 90], ['Castanha-do-Brasil, crua', 10]] },
      { nome: 'Pão integral com queijo branco', itens: [['Pão, trigo, forma, integral', 25], ['Queijo, minas, frescal', 30]] },
      { nome: 'Maçã com amendoim', itens: [['Maçã, Fuji, com casca, crua', 130], ['Amendoim, grão, cru', 15]] },
      { nome: 'Iogurte desnatado com aveia', itens: [['Iogurte, natural, desnatado', 170], ['Aveia, flocos, crua', 20]] },
      { nome: 'Ovo cozido e mamão', itens: [[OVO, 50], ['Mamão, Papaia, cru', 150]] },
      { nome: 'Melancia e kiwi', itens: [['Melancia, crua', 200], ['Kiwi, cru', 80]] }
    ]
  };
  return { CARDAPIOS: CARDAPIOS };
});
