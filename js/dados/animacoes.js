/*
 * J.S. — desenhos animados da execução de cada exercício (motor em js/exanim.js).
 * Coordenadas num quadro de 200 × 125 (chão em y = 120). Cada posição:
 *   p: quadril [x, y]   t: inclinação do tronco (graus; 90 = em pé, 180 = deitado com a cabeça à esquerda)
 *   an/af: braço (perto/longe)  ln/lf: perna (perto/longe) — {t:[x,y], b:±1} alvo da mão/tornozelo, ou {a:[ângulo1, ângulo2]}
 *   fn/ff: ângulo do pé   hd: inclinação da cabeça   l: comprimentos (encurtar membros vistos de frente)
 * Ângulos: 0 = direita, 90 = para cima, -90 = para baixo, 180 = esquerda.
 */
(function (root) {
  'use strict';
  var F = { k: 'floor', y: 121 };
  function bench(x1, x2, y, legs) { return { k: 'pad', a: [x1, y], b: [x2, y], legs: legs || [x1 + 6, x2 - 6] }; }
  function stand(x, an, af) { return { p: [x, 63], t: 90, an: an, af: af, ln: { t: [x + 2, 117] }, fn: 0 }; }

  var A = {};

  /* ---------------- Peito ---------------- */
  A['supino-reto'] = { dur: 2.6, props: [F, bench(44, 130, 93), { k: 'line', pts: [[58, 93], [58, 38], [64, 38]] }, { k: 'plate', at: 'hn', front: true }],
    frames: [
      { p: [112, 85], t: 180, an: { t: [72, 44] }, ln: { t: [140, 116] } },
      { p: [112, 85], t: 180, an: { t: [84, 75], b: -1 }, ln: { t: [140, 116] } }] };
  A['supino-inclinado'] = { dur: 2.6, props: [F, { k: 'pad', a: [100, 95], b: [64, 67] }, bench(100, 128, 95, [104, 122]), { k: 'plate', at: 'hn', front: true }],
    frames: [
      { p: [104, 88], t: 145, an: { t: [72, 24] }, ln: { t: [136, 116] } },
      { p: [104, 88], t: 145, an: { t: [82, 60], b: -1 }, ln: { t: [136, 116] } }] };
  A['crucifixo'] = { view: 'front', dur: 2.8, props: [{ k: 'rect', x: 84, y: 18, w: 32, h: 100, r: 6 }, { k: 'db', at: 'hn', v: 1, front: true }, { k: 'db', at: 'hf', v: 1, front: true }],
    frames: [
      { p: [100, 74], t: 90, an: { t: [104, 36] }, ln: { a: [-88, -90] }, l: { th: 24, sh: 22 } },
      { p: [100, 74], t: 90, an: { t: [146, 46], b: -1 }, ln: { a: [-88, -90] }, l: { th: 24, sh: 22 } }] };
  A['peck-deck'] = { view: 'front', dur: 2.6, props: [{ k: 'rect', x: 82, y: 14, w: 36, h: 70, r: 6 }, { k: 'roll', at: 'en', r: 5, front: true }, { k: 'roll', at: 'ef', r: 5, front: true }],
    frames: [
      { p: [100, 76], t: 90, an: { a: [2, 90] }, ln: { a: [-80, -90] }, l: { th: 14 } },
      { p: [100, 76], t: 90, an: { a: [180, 90] }, ln: { a: [-80, -90] }, l: { th: 14, ua: 9 } }] };
  A['flexao'] = { dur: 2.4, props: [F],
    frames: [
      { p: [100, 90], t: 20, an: { t: [138, 117] }, ln: { a: [200, 200] }, fn: -100 },
      { p: [100, 104], t: 7, an: { t: [137, 117], b: -1 }, ln: { a: [187, 187] }, fn: -100 }] };

  /* ---------------- Costas ---------------- */
  A['puxada-frente'] = { dur: 2.6, props: [F, bench(78, 112, 97, [95]), { k: 'roll', at: [117, 85], r: 6 }, { k: 'cable', from: [86, 2], to: 'hn' }, { k: 'handle', at: 'hn', len: 10, v: 0, front: true }],
    frames: [
      { p: [95, 92], t: 100, an: { t: [85, 11] }, ln: { t: [123, 118] } },
      { p: [95, 92], t: 104, an: { t: [99, 56], b: -1 }, ln: { t: [123, 118] } }] };
  A['remada-baixa'] = { dur: 2.6, props: [F, bench(46, 92, 104, [52, 86]), { k: 'line', pts: [[130, 86], [130, 112]], w: 4 }, { k: 'cable', from: [178, 90], to: 'hn' }, { k: 'handle', at: 'hn', len: 8, v: 1, front: true }],
    frames: [
      { p: [70, 98], t: 72, an: { t: [122, 70] }, ln: { t: [124, 100] }, fn: 78 },
      { p: [70, 98], t: 96, an: { t: [76, 77], b: -1 }, ln: { t: [124, 100] }, fn: 78 }] };
  A['remada-curvada'] = { dur: 2.4, props: [F, { k: 'plate', at: 'hn', front: true }],
    frames: [
      { p: [93, 65], t: 30, an: { t: [127, 88] }, ln: { t: [101, 117] } },
      { p: [93, 65], t: 32, an: { t: [107, 72], b: -1 }, ln: { t: [101, 117] } }] };
  A['remada-unilateral'] = { dur: 2.6, props: [F, bench(40, 134, 108, [48, 126]), { k: 'db', at: 'hn', front: true }],
    frames: [
      { p: [80, 79], t: 8, an: { t: [119, 115] }, af: { t: [121, 105], b: 1 }, ln: { t: [76, 117] }, lf: { a: [-90, 180] }, ff: 190 },
      { p: [80, 79], t: 10, an: { t: [100, 96], b: -1 }, af: { t: [121, 105], b: 1 }, ln: { t: [76, 117] }, lf: { a: [-90, 180] }, ff: 190 }] };
  A['pulldown'] = { dur: 2.6, props: [F, { k: 'line', pts: [[168, 2], [168, 121]], w: 4 }, { k: 'cable', from: [162, 4], to: 'hn' }, { k: 'handle', at: 'hn', len: 10, v: 1, front: true }],
    frames: [
      { p: [90, 63], t: 80, an: { t: [125, 10] }, ln: { t: [95, 117] } },
      { p: [90, 63], t: 80, an: { t: [105, 62] }, ln: { t: [95, 117] } }] };

  /* ---------------- Ombros ---------------- */
  A['desenvolvimento'] = { dur: 2.6, props: [F, bench(74, 112, 96, [80, 106]), { k: 'line', pts: [[76, 96], [76, 44]], w: 5 }, { k: 'plate', at: 'hn', front: true }],
    frames: [
      { p: [95, 90], t: 90, an: { t: [104, 51], b: -1 }, ln: { t: [124, 117] } },
      { p: [95, 90], t: 90, an: { t: [97, 9] }, ln: { t: [124, 117] } }] };
  A['elevacao-lateral'] = { view: 'front', dur: 2.6, props: [F, { k: 'db', at: 'hn', front: true }, { k: 'db', at: 'hf', front: true }],
    frames: [
      { p: [100, 63], t: 90, an: { a: [-86, -88] }, ln: { a: [-86, -90] } },
      { p: [100, 63], t: 90, an: { a: [6, 0] }, ln: { a: [-86, -90] } }] };
  A['elevacao-frontal'] = { dur: 2.6, props: [F, { k: 'db', at: 'hn', front: true }],
    frames: [
      Object.assign(stand(95, { a: [-86, -86] }), {}),
      Object.assign(stand(95, { a: [2, 2] }), {})] };
  A['crucifixo-inverso'] = { view: 'front', dur: 2.8, props: [F, { k: 'db', at: 'hn', front: true }, { k: 'db', at: 'hf', front: true }],
    frames: [
      { p: [100, 66], t: 90, hd: 0, an: { a: [-98, -95] }, ln: { a: [-84, -92] }, l: { torso: 24 } },
      { p: [100, 66], t: 90, hd: 0, an: { a: [4, -6] }, ln: { a: [-84, -92] }, l: { torso: 24 } }] };

  /* ---------------- Bíceps ---------------- */
  A['rosca-direta'] = { dur: 2.4, props: [F, { k: 'plate', at: 'hn', r: 8, front: true }],
    frames: [stand(95, { a: [-93, -86] }), stand(95, { a: [-93, 82] })] };
  A['rosca-alternada'] = { mode: 'loop', dur: 3.6, props: [F, { k: 'db', at: 'hf' }, { k: 'db', at: 'hn', front: true }],
    frames: [
      stand(95, { a: [-93, 82] }, { a: [-93, -86] }), stand(95, { a: [-93, -86] }, { a: [-93, -86] }),
      stand(95, { a: [-93, -86] }, { a: [-93, 82] }), stand(95, { a: [-93, -86] }, { a: [-93, -86] })] };
  A['rosca-martelo'] = { dur: 2.4, props: [F, { k: 'db', at: 'hn', v: 1, front: true }],
    frames: [stand(95, { a: [-93, -86] }), stand(95, { a: [-93, 80] })] };
  A['rosca-scott'] = { dur: 2.6, props: [F, bench(68, 96, 98, [82]), { k: 'line', pts: [[102, 80], [102, 121]], w: 4 }, { k: 'pad', a: [89, 66], b: [110, 81] }, { k: 'plate', at: 'hn', r: 8, front: true }],
    frames: [
      { p: [82, 92], t: 85, an: { a: [-35, -45] }, ln: { t: [108, 117] } },
      { p: [82, 92], t: 85, an: { a: [-35, 96] }, ln: { t: [108, 117] } }] };

  /* ---------------- Tríceps ---------------- */
  var tri = [F, { k: 'line', pts: [[160, 2], [160, 121]], w: 4 }, { k: 'cable', from: [154, 4], to: 'hn' }];
  A['triceps-pulley'] = { dur: 2.4, props: tri.concat([{ k: 'handle', at: 'hn', len: 10, front: true }]),
    frames: [
      { p: [88, 63], t: 85, an: { a: [-97, 35] }, ln: { t: [92, 117] } },
      { p: [88, 63], t: 85, an: { a: [-97, -82] }, ln: { t: [92, 117] } }] };
  A['triceps-corda'] = { dur: 2.4, props: tri.concat([{ k: 'rope', at: 'hn', spread: 3, front: true }]),
    frames: [
      { p: [88, 63], t: 85, an: { a: [-97, 35] }, ln: { t: [92, 117] } },
      { p: [88, 63], t: 85, an: { a: [-97, -82] }, ln: { t: [92, 117] } }] };
  A['triceps-frances'] = { dur: 2.6, props: [F, bench(76, 114, 98, [82, 108]), { k: 'db', at: 'hn', front: true }],
    frames: [
      { p: [95, 92], t: 90, an: { a: [96, -118] }, ln: { t: [124, 117] } },
      { p: [95, 92], t: 90, an: { a: [96, 93] }, ln: { t: [124, 117] } }] };
  A['triceps-banco'] = { dur: 2.4, props: [F, bench(28, 76, 88, [34, 70])],
    frames: [
      { p: [79, 82], t: 92, an: { t: [73, 84], b: -1 }, ln: { t: [132, 116] }, fn: 70 },
      { p: [81, 100], t: 92, an: { t: [73, 84], b: -1 }, ln: { t: [132, 116] }, fn: 70 }] };

  /* ---------------- Pernas ---------------- */
  A['agachamento-livre'] = { dur: 2.8, props: [F, { k: 'plate', at: 'hn' }],
    frames: [
      { p: [101, 63], t: 88, an: { t: [94, 20], b: 1 }, ln: { t: [110, 117] } },
      { p: [91, 90], t: 52, an: { t: [107, 55], b: 1 }, ln: { t: [110, 117] } }] };
  A['agachamento-smith'] = { dur: 2.8, props: [F, { k: 'line', pts: [[86, 4], [86, 121]], w: 3, c: '#C9BBC2' }, { k: 'line', pts: [[102, 4], [102, 121]], w: 3, c: '#C9BBC2' }, { k: 'plate', at: 'hn' }],
    frames: [
      { p: [99, 63], t: 88, an: { t: [94, 20], b: 1 }, ln: { t: [114, 117] } },
      { p: [88, 88], t: 70, an: { t: [94, 47], b: 1 }, ln: { t: [114, 117] } }] };
  A['agachamento-sumo'] = { view: 'front', dur: 2.8, props: [F, { k: 'db', at: 'mh', v: 1, front: true }],
    frames: [
      { p: [100, 64], t: 90, an: { t: [102, 104] }, ln: { t: [128, 117] }, fn: -60 },
      { p: [100, 86], t: 90, an: { t: [102, 117] }, ln: { t: [128, 117] }, fn: -60 }] };
  A['leg-press'] = { dur: 2.8, props: [F, { k: 'line', pts: [[96, 84], [156, 34]], w: 3, c: '#C9BBC2' }, { k: 'pad', a: [70, 104], b: [40, 74] }, bench(66, 92, 104, [74, 86]), { k: 'sled', front: true }],
    frames: [
      { p: [70, 96], t: 128, an: { t: [76, 99] }, ln: { t: [104, 70] }, fn: 120 },
      { p: [70, 96], t: 128, an: { t: [76, 99] }, ln: { t: [120, 56] }, fn: 120 }] };
  A['cadeira-extensora'] = { dur: 2.6, props: [F, bench(70, 116, 92, [92]), { k: 'pad', a: [72, 92], b: [64, 48] }, { k: 'roll', at: 'an', d: [2, -3], r: 5, front: true }],
    frames: [
      { p: [88, 85], t: 98, an: { t: [97, 88] }, ln: { a: [0, -88] }, fn: 0 },
      { p: [88, 85], t: 98, an: { t: [97, 88] }, ln: { a: [0, -4] }, fn: 80 }] };
  A['cadeira-flexora'] = { dur: 2.6, props: [F, bench(70, 116, 92, [92]), { k: 'pad', a: [72, 92], b: [64, 48] }, { k: 'roll', at: 'kn', d: [-4, -9], r: 6, front: true }, { k: 'roll', at: 'an', d: [0, 5], r: 5, front: true }],
    frames: [
      { p: [88, 85], t: 98, an: { t: [97, 88] }, ln: { a: [0, -6] }, fn: 80 },
      { p: [88, 85], t: 98, an: { t: [97, 88] }, ln: { a: [0, -112] }, fn: -20 }] };
  A['mesa-flexora'] = { dur: 2.6, props: [F, bench(34, 150, 84, [44, 140]), { k: 'roll', at: 'an', d: [-2, -6], r: 5, front: true }],
    frames: [
      { p: [86, 77], t: 0, hd: 18, an: { t: [146, 90], b: -1 }, ln: { a: [180, 180] }, fn: 270 },
      { p: [86, 77], t: 0, hd: 18, an: { t: [146, 90], b: -1 }, ln: { a: [180, 72] }, fn: 160 }] };
  A['stiff'] = { dur: 2.8, props: [F, { k: 'plate', at: 'hn', front: true }],
    frames: [
      { p: [100, 63], t: 90, an: { t: [103, 104] }, ln: { t: [108, 117] } },
      { p: [95, 67], t: 28, an: { t: [131, 108] }, ln: { t: [108, 117] } }] };
  A['levantamento-terra'] = { dur: 3, props: [F, { k: 'plate', at: 'hn', front: true }],
    frames: [
      { p: [86, 82], t: 42, an: { t: [113, 110] }, ln: { t: [106, 117] } },
      { p: [100, 63], t: 90, an: { t: [102, 104] }, ln: { t: [106, 117] } }] };
  A['afundo'] = { dur: 2.8, props: [F, { k: 'db', at: 'hn', front: true }],
    frames: [
      { p: [100, 69], t: 90, an: { a: [-91, -90] }, ln: { t: [128, 117] }, lf: { t: [74, 112] }, ff: -45 },
      { p: [99, 93], t: 90, an: { a: [-91, -90] }, ln: { t: [128, 117] }, lf: { t: [74, 113] }, ff: -45 }] };
  A['bulgaro'] = { dur: 2.8, props: [F, bench(26, 66, 92, [32, 60]), { k: 'db', at: 'hn', front: true }],
    frames: [
      { p: [96, 67], t: 86, an: { a: [-91, -90] }, ln: { t: [120, 117] }, lf: { t: [62, 84] }, ff: 195 },
      { p: [92, 91], t: 84, an: { a: [-93, -90] }, ln: { t: [120, 117] }, lf: { t: [62, 84] }, ff: 195 }] };
  A['hack'] = { dur: 2.8, props: [F, { k: 'line', pts: [[104, 30], [50, 121]], w: 3, c: '#C9BBC2' }, { k: 'line', pts: [[96, 121], [128, 108]], w: 5 }, { k: 'seg', a: 'pelvis', b: 'neck', off: [-7, -2], w: 9 }],
    frames: [
      { p: [88, 61], t: 106, an: { t: [86, 28], b: -1 }, ln: { t: [110, 109] } },
      { p: [74, 88], t: 106, an: { t: [72, 55], b: -1 }, ln: { t: [110, 109] } }] };

  /* ---------------- Glúteos ---------------- */
  A['elevacao-pelvica'] = { dur: 2.6, props: [F, bench(36, 82, 97, [44, 76]), { k: 'plate', at: 'pelvis', d: [1, -10], r: 9, front: true }],
    frames: [
      { p: [120, 105], t: 160, an: { t: [118, 99] }, ln: { t: [141, 116] } },
      { p: [114, 90], t: 180, an: { t: [112, 84] }, ln: { t: [141, 116] } }] };
  A['gluteo-cabo'] = { dur: 2.6, props: [F, { k: 'line', pts: [[146, 4], [146, 121]], w: 4 }, { k: 'line', pts: [[146, 48], [134, 48]], w: 3 }, { k: 'cable', from: [140, 112], to: 'an' }, { k: 'roll', at: 'an', r: 3.5, front: true }],
    frames: [
      { p: [90, 63], t: 76, an: { t: [134, 50] }, ln: { t: [88, 114] }, lf: { t: [95, 117] }, fn: -20 },
      { p: [90, 63], t: 72, an: { t: [134, 50] }, ln: { t: [50, 96] }, lf: { t: [95, 117] }, fn: -40 }] };
  A['abdutora'] = { view: 'front', dur: 2.6, props: [{ k: 'rect', x: 80, y: 30, w: 40, h: 56, r: 6 }, F, { k: 'roll', at: 'kn', d: [5, 0], r: 4, front: true }, { k: 'roll', at: 'kf', d: [-5, 0], r: 4, front: true }],
    frames: [
      { p: [100, 80], t: 90, an: { t: [124, 84], b: 1 }, ln: { a: [-75, -90] }, l: { th: 14 }, fn: -70 },
      { p: [100, 80], t: 90, an: { t: [124, 84], b: 1 }, ln: { a: [-12, -90] }, l: { th: 14 }, fn: -70 }] };
  A['adutora'] = { view: 'front', dur: 2.6, props: [{ k: 'rect', x: 80, y: 30, w: 40, h: 56, r: 6 }, F, { k: 'roll', at: 'kn', d: [-5, 0], r: 4, front: true }, { k: 'roll', at: 'kf', d: [5, 0], r: 4, front: true }],
    frames: [
      { p: [100, 80], t: 90, an: { t: [124, 84], b: 1 }, ln: { a: [-12, -90] }, l: { th: 14 }, fn: -70 },
      { p: [100, 80], t: 90, an: { t: [124, 84], b: 1 }, ln: { a: [-75, -90] }, l: { th: 14 }, fn: -70 }] };

  /* ---------------- Panturrilha ---------------- */
  A['panturrilha-pe'] = { dur: 2.2, vb: '0 -14 200 139', props: [F, { k: 'rect', x: 103, y: 112, w: 30, h: 9, r: 2 }],
    frames: [
      { p: [100, 61], t: 90, an: { a: [-92, -88] }, ln: { t: [100, 116] }, fn: 25 },
      { p: [103, 50], t: 90, an: { a: [-92, -88] }, ln: { t: [103, 105] }, fn: -55 }] };
  A['panturrilha-sentada'] = { dur: 2.2, props: [F, bench(58, 92, 92, [74]), { k: 'rect', x: 110, y: 110, w: 18, h: 11, r: 2 }, { k: 'roll', at: 'kn', d: [-2, -7], r: 6, front: true }],
    frames: [
      { p: [80, 86], t: 90, an: { t: [104, 82] }, ln: { t: [108, 113] }, fn: 25 },
      { p: [80, 86], t: 90, an: { t: [104, 76] }, ln: { t: [109, 103] }, fn: -40 }] };

  /* ---------------- Abdômen ---------------- */
  A['abdominal-supra'] = { dur: 2.4, props: [F],
    frames: [
      { p: [100, 112], t: 172, an: { t: [72, 101], b: 1 }, ln: { t: [131, 115] } },
      { p: [100, 112], t: 140, hd: -12, an: { t: [80, 90], b: 1 }, ln: { t: [131, 115] } }] };
  A['abdominal-infra'] = { dur: 2.8, props: [F],
    frames: [
      { p: [112, 113], t: 180, an: { a: [-4, -2] }, ln: { a: [8, 8] }, fn: 20 },
      { p: [112, 113], t: 180, an: { a: [-4, -2] }, ln: { a: [82, 82] }, fn: 100 }] };
  A['obliquo'] = { dur: 2.6, props: [F],
    frames: [
      { p: [100, 112], t: 172, an: { t: [52, 100], b: -1 }, ln: { t: [131, 115] } },
      { p: [100, 112], t: 132, hd: -10, an: { t: [72, 72], b: -1 }, ln: { t: [118, 90] }, lf: { t: [131, 115] } }] };
  A['prancha'] = { dur: 3.2, props: [F],
    frames: [
      { p: [95, 100], t: 6, an: { a: [-90, 0] }, ln: { a: [186, 186] }, fn: -95 },
      { p: [95, 97], t: 7, an: { a: [-90, 0] }, ln: { a: [185, 185] }, fn: -95 }] };

  /* ---------------- Cardio ---------------- */
  var esteira = [{ k: 'rect', x: 34, y: 112, w: 120, h: 7, r: 3, c: '#CFC2C8' }, { k: 'line', pts: [[150, 116], [160, 62], [174, 58]], w: 4 }, { k: 'line', pts: [[158, 70], [126, 66]], w: 3 }];
  A['esteira'] = { mode: 'loop', linear: true, dur: 1.4, props: esteira,
    frames: [
      { p: [95, 61], t: 86, an: { a: [-118, -96] }, af: { a: [-62, -30] }, ln: { t: [114, 110] }, lf: { t: [78, 106] }, fn: 12, ff: -40 },
      { p: [95, 58], t: 86, an: { a: [-92, -70] }, af: { a: [-92, -70] }, ln: { t: [97, 110] }, lf: { t: [93, 100], b: 1 }, fn: 0, ff: -25 },
      { p: [95, 61], t: 86, an: { a: [-62, -30] }, af: { a: [-118, -96] }, ln: { t: [78, 106] }, lf: { t: [114, 110] }, fn: -40, ff: 12 },
      { p: [95, 58], t: 86, an: { a: [-92, -70] }, af: { a: [-92, -70] }, ln: { t: [93, 100], b: 1 }, lf: { t: [97, 110] }, fn: -25, ff: 0 }] };

  // Bicicleta: os pés acompanham o pedal girando (8 posições numa volta).
  var bikeFrames = [];
  for (var i = 0; i < 8; i++) {
    var a = -i * 45 * Math.PI / 180, cx = 104, cy = 96, r = 11;
    var pn = [cx + r * Math.cos(a), cy - r * Math.sin(a)], pf = [cx - r * Math.cos(a), cy + r * Math.sin(a)];
    bikeFrames.push({ p: [88, 62], t: 70, an: { t: [128, 47] }, ln: { t: [pn[0] - 1, pn[1] - 3] }, lf: { t: [pf[0] - 1, pf[1] - 3] }, fn: -12, ff: -12 });
  }
  A['bicicleta'] = { mode: 'loop', linear: true, dur: 1.6, props: [F, { k: 'line', pts: [[80, 121], [150, 121]], w: 4 }, { k: 'wheel', x: 142, y: 98, r: 15 },
    { k: 'line', pts: [[88, 66], [100, 100], [142, 98]], w: 4 }, { k: 'line', pts: [[100, 100], [96, 121]], w: 4 }, { k: 'line', pts: [[142, 98], [130, 48], [124, 46]], w: 4 },
    { k: 'line', pts: [[80, 65], [94, 65]], w: 5, c: '#5F4F59' }, { k: 'crank', c: [104, 96], at: 'an', front: true }], frames: bikeFrames };

  var elFrames = [];
  for (var j = 0; j < 8; j++) {
    var b = -j * 45 * Math.PI / 180, ex = 100, ey = 108;
    var qn = [ex + 18 * Math.cos(b), ey - 5 * Math.sin(b)], qf = [ex - 18 * Math.cos(b), ey + 5 * Math.sin(b)];
    var hnx = 126 + 10 * Math.cos(b + Math.PI), hfx = 126 + 10 * Math.cos(b);
    elFrames.push({ p: [97, 55 + Math.abs(Math.sin(b)) * 2], t: 86, an: { t: [hnx, 52] }, af: { t: [hfx, 52] }, ln: { t: qn }, lf: { t: qf }, fn: -8, ff: -8 });
  }
  A['eliptico'] = { mode: 'loop', linear: true, dur: 1.8, vb: '0 -12 200 137', props: [F, { k: 'line', pts: [[60, 118], [150, 118]], w: 5 }, { k: 'line', pts: [[140, 118], [150, 60], [162, 56]], w: 4 },
    { k: 'line', pts: [[66, 112], [134, 104]], w: 3, c: '#C9BBC2' }, { k: 'handle', at: 'hn', len: 14, v: 1, front: true }], frames: elFrames };

  A['escada'] = { mode: 'loop', dur: 1.6, vb: '0 -14 200 139', props: [F, { k: 'line', pts: [[70, 121], [70, 110], [96, 110], [96, 99], [122, 99], [122, 88], [146, 88]], w: 4 }, { k: 'line', pts: [[150, 121], [150, 52], [128, 52]], w: 4 }],
    // Pisa alternando as pernas sem sair do lugar (os degraus é que descem).
    frames: [
      { p: [96, 57], t: 84, an: { t: [128, 54] }, ln: { t: [109, 95] }, lf: { t: [85, 106] }, fn: 0, ff: -12 },
      { p: [96, 54], t: 85, an: { t: [128, 54] }, ln: { t: [85, 106] }, lf: { t: [109, 95] }, fn: -12, ff: 0 }] };

  /* ================= Versão 2.3: mais exercícios ================= */

  // Peito
  A['supino-declinado'] = { dur: 2.6, props: [F, { k: 'line', pts: [[70, 99], [70, 121]], w: 3 }, { k: 'line', pts: [[106, 88], [106, 121]], w: 3 }, { k: 'pad', a: [116, 86], b: [62, 100] }, { k: 'roll', at: [142, 92], r: 5 }, { k: 'plate', at: 'hn', front: true }],
    frames: [
      { p: [110, 80], t: 195, an: { t: [73, 49] }, ln: { t: [138, 99] }, fn: 60 },
      { p: [110, 80], t: 195, an: { t: [78, 80], b: -1 }, ln: { t: [138, 99] }, fn: 60 }] };
  A['crossover'] = { view: 'front', dur: 2.6, props: [F, { k: 'line', pts: [[8, 2], [8, 121]], w: 4 }, { k: 'line', pts: [[192, 2], [192, 121]], w: 4 }, { k: 'cable', from: [188, 8], to: 'hn' }, { k: 'cable', from: [12, 8], to: 'hf' }],
    frames: [
      { p: [100, 63], t: 90, an: { t: [146, 26], b: -1 }, ln: { a: [-86, -90] } },
      { p: [100, 63], t: 90, an: { t: [104, 66], b: -1 }, ln: { a: [-86, -90] } }] };
  A['supino-maquina'] = { dur: 2.6, props: [F, { k: 'pad', a: [70, 97], b: [62, 46] }, bench(62, 100, 97, [80]), { k: 'line', pts: [[132, 30], [132, 121]], w: 4 }, { k: 'line', pts: [[132, 52], [122, 52]], w: 3 }, { k: 'handle', at: 'hn', len: 12, v: 1, front: true }],
    frames: [
      { p: [80, 90], t: 96, an: { t: [90, 52], b: -1 }, ln: { t: [110, 117] } },
      { p: [80, 90], t: 96, an: { t: [118, 51] }, ln: { t: [110, 117] } }] };
  A['pullover'] = { dur: 3, props: [F, bench(44, 130, 93), { k: 'db', at: 'hn', v: 1, front: true }],
    frames: [
      { p: [112, 85], t: 180, an: { a: [92, 92] }, ln: { t: [140, 116] } },
      { p: [112, 85], t: 180, an: { a: [158, 168] }, ln: { t: [140, 116] } }] };
  A['flexao-joelhos'] = { dur: 2.4, props: [F],
    frames: [
      { p: [98, 93], t: 24, an: { t: [134, 118] }, ln: { a: [-138, 165] }, fn: 150 },
      { p: [98, 103], t: 10, an: { t: [135, 118], b: -1 }, ln: { a: [-150, 168] }, fn: 150 }] };

  // Costas
  A['barra-fixa'] = { dur: 2.8, vb: '0 -6 200 140', props: [{ k: 'line', pts: [[66, 134], [66, 2], [134, 2], [134, 134]], w: 4 }],
    frames: [
      { p: [100, 86], t: 90, an: { t: [101, 3] }, ln: { a: [-100, -150] } },
      { p: [100, 60], t: 90, an: { t: [104, 3], b: -1 }, ln: { a: [-100, -150] } }] };
  A['remada-cavalinho'] = { dur: 2.4, props: [F, { k: 'bar', from: [40, 118], to: 'hn', w: 5 }, { k: 'plate', at: 'hn', d: [-12, 4], r: 9 }],
    frames: [
      { p: [88, 70], t: 35, an: { t: [120, 92] }, ln: { t: [100, 117] } },
      { p: [88, 70], t: 37, an: { t: [108, 76], b: -1 }, ln: { t: [100, 117] } }] };
  A['hiperextensao'] = { dur: 2.8, props: [F, { k: 'line', pts: [[100, 74], [82, 121]], w: 4 }, { k: 'pad', a: [92, 80], b: [110, 62] }, { k: 'line', pts: [[52, 121], [70, 104]], w: 5 }, { k: 'roll', at: [63, 103], r: 4 }],
    frames: [
      { p: [100, 70], t: -70, an: { t: [110, 100], b: 1 }, ln: { a: [225, 225] }, fn: 135 },
      { p: [100, 70], t: 42, an: { t: [124, 52], b: 1 }, ln: { a: [225, 225] }, fn: 135 }] };

  // Ombros
  A['encolhimento'] = { view: 'front', dur: 2.2, props: [F, { k: 'db', at: 'hn', front: true }, { k: 'db', at: 'hf', front: true }],
    frames: [
      { p: [100, 63], t: 90, an: { a: [-87, -90] }, ln: { a: [-86, -90] }, l: { torso: 40, neck: 11 } },
      { p: [100, 63], t: 90, an: { a: [-87, -90] }, ln: { a: [-86, -90] }, l: { torso: 46, neck: 5 } }] };
  A['remada-alta'] = { view: 'front', dur: 2.4, props: [F, { k: 'handle', at: 'mh', len: 30, front: true }],
    frames: [
      { p: [100, 63], t: 90, an: { a: [-92, -97] }, ln: { a: [-86, -90] } },
      { p: [100, 63], t: 90, an: { a: [25, 192] }, ln: { a: [-86, -90] } }] };
  A['face-pull'] = { dur: 2.4, props: [F, { k: 'line', pts: [[176, 2], [176, 121]], w: 4 }, { k: 'cable', from: [170, 22], to: 'hn' }, { k: 'rope', at: 'hn', spread: 3, front: true }],
    frames: [
      { p: [92, 63], t: 88, an: { t: [134, 24] }, ln: { t: [96, 117] } },
      { p: [92, 63], t: 90, an: { t: [110, 18], b: 1 }, ln: { t: [96, 117] } }] };

  // Bíceps e tríceps
  A['rosca-concentrada'] = { dur: 2.4, props: [F, bench(56, 96, 98, [76]), { k: 'db', at: 'hn', front: true }],
    frames: [
      { p: [80, 92], t: 62, an: { a: [-80, -86] }, ln: { t: [112, 117] } },
      { p: [80, 92], t: 62, an: { a: [-80, 96] }, ln: { t: [112, 117] } }] };
  A['rosca-polia'] = { dur: 2.4, props: [F, { k: 'line', pts: [[156, 2], [156, 121]], w: 4 }, { k: 'cable', from: [150, 114], to: 'hn' }, { k: 'handle', at: 'hn', len: 10, front: true }],
    frames: [stand(95, { a: [-93, -80] }), stand(95, { a: [-93, 82] })] };
  A['triceps-testa'] = { dur: 2.6, props: [F, bench(44, 130, 93), { k: 'plate', at: 'hn', r: 8, front: true }],
    frames: [
      { p: [112, 85], t: 180, an: { a: [100, 94] }, ln: { t: [140, 116] } },
      { p: [112, 85], t: 180, an: { a: [100, -148] }, ln: { t: [140, 116] } }] };
  A['triceps-coice'] = { dur: 2.4, props: [F, { k: 'db', at: 'hn', front: true }],
    frames: [
      { p: [93, 65], t: 25, an: { a: [186, -88] }, ln: { t: [101, 117] } },
      { p: [93, 65], t: 25, an: { a: [186, 182] }, ln: { t: [101, 117] } }] };
  A['mergulho-paralelas'] = { dur: 2.6, props: [F, { k: 'line', pts: [[70, 121], [70, 64], [130, 64], [130, 121]], w: 4 }],
    frames: [
      { p: [100, 62], t: 90, an: { t: [101, 63] }, ln: { a: [-100, -150] } },
      { p: [102, 80], t: 86, an: { t: [101, 63], b: -1 }, ln: { a: [-110, -160] } }] };
  A['supino-fechado'] = { dur: 2.6, props: [F, bench(44, 130, 93), { k: 'line', pts: [[58, 93], [58, 38], [64, 38]] }, { k: 'plate', at: 'hn', front: true }],
    frames: [
      { p: [112, 85], t: 180, an: { t: [74, 44] }, ln: { t: [140, 116] } },
      { p: [112, 85], t: 180, an: { t: [88, 76], b: -1 }, ln: { t: [140, 116] } }] };

  // Pernas, glúteos e panturrilha
  A['agachamento-goblet'] = { dur: 2.8, props: [F, { k: 'db', at: 'hn', v: 1, front: true }],
    frames: [
      { p: [101, 63], t: 88, an: { t: [106, 45], b: 1 }, ln: { t: [110, 117] } },
      { p: [93, 90], t: 62, an: { t: [115, 77], b: 1 }, ln: { t: [110, 117] } }] };
  A['subida-banco'] = { dur: 2.8, vb: '0 -26 200 151', props: [F, { k: 'rect', x: 104, y: 92, w: 40, h: 29, r: 3 }],
    frames: [
      { p: [95, 64], t: 88, an: { a: [-92, -88] }, ln: { t: [116, 88] }, lf: { t: [88, 117] } },
      { p: [112, 36], t: 90, an: { a: [-92, -88] }, ln: { t: [116, 88] }, lf: { t: [104, 70], b: 1 } }] };
  A['ponte'] = { dur: 2.4, props: [F],
    frames: [
      { p: [110, 112], t: 180, an: { a: [-4, -2] }, ln: { t: [140, 116] } },
      { p: [104, 92], t: 210, hd: -30, an: { a: [-2, 0] }, ln: { t: [140, 116] } }] };
  A['abducao-cabo'] = { view: 'front', dur: 2.6, props: [F, { k: 'line', pts: [[48, 121], [48, 30]], w: 4 }, { k: 'cable', from: [52, 116], to: 'an' }, { k: 'roll', at: 'an', r: 3.5, front: true }],
    frames: [
      { p: [100, 63], t: 90, an: { a: [-80, -90] }, af: { t: [52, 50], b: 1 }, ln: { a: [-90, -90] }, lf: { a: [-92, -90] } },
      { p: [100, 63], t: 90, an: { a: [-80, -90] }, af: { t: [52, 50], b: 1 }, ln: { a: [-48, -50] }, lf: { a: [-92, -90] } }] };
  A['gluteo-quatro-apoios'] = { dur: 2.4, props: [F],
    frames: [
      { p: [84, 90], t: 20, an: { t: [122, 118] }, ln: { a: [-90, 180] }, lf: { a: [-90, 180] }, fn: 180, ff: 180 },
      { p: [84, 90], t: 20, an: { t: [122, 118] }, ln: { a: [155, 92] }, lf: { a: [-90, 180] }, fn: 182, ff: 180 }] };
  A['panturrilha-leg'] = { dur: 2.2, props: [F, { k: 'line', pts: [[96, 84], [156, 34]], w: 3, c: '#C9BBC2' }, { k: 'pad', a: [70, 104], b: [40, 74] }, bench(66, 92, 104, [74, 86]), { k: 'sled', at: 'tn', front: true }],
    frames: [
      { p: [70, 96], t: 128, an: { t: [76, 99] }, ln: { t: [114, 60] }, fn: 132 },
      { p: [70, 96], t: 128, an: { t: [76, 99] }, ln: { t: [114, 60] }, fn: 72 }] };

  // Abdômen
  A['abdominal-bicicleta'] = { mode: 'loop', dur: 2.2, props: [F],
    frames: [
      { p: [100, 113], t: 148, hd: -10, an: { t: [60, 84], b: -1 }, ln: { a: [72, -15] }, lf: { a: [12, 10] }, fn: 10, ff: 10 },
      { p: [100, 113], t: 148, hd: -10, an: { t: [60, 84], b: -1 }, ln: { a: [12, 10] }, lf: { a: [72, -15] }, fn: 10, ff: 10 }] };
  A['elevacao-pernas-barra'] = { dur: 2.8, vb: '0 -6 200 156', props: [{ k: 'line', pts: [[66, 150], [66, 2], [134, 2], [134, 150]], w: 4 }],
    frames: [
      { p: [100, 86], t: 90, an: { t: [101, 3] }, ln: { a: [-92, -92] }, fn: -10 },
      { p: [100, 86], t: 92, an: { t: [101, 3] }, ln: { a: [-2, -8] }, fn: 80 }] };
  A['prancha-lateral'] = { dur: 3, props: [F],
    frames: [
      { p: [94.2, 100.2], t: 6, an: { a: [-90, 0] }, af: { a: [90, 90] }, ln: { t: [42, 116] }, fn: -90 },
      { p: [96.2, 109], t: 19, an: { a: [-90, 0] }, af: { a: [90, 90] }, ln: { t: [42, 116] }, fn: -90 }] };
  A['abdominal-remador'] = { dur: 2.6, props: [F],
    frames: [
      { p: [100, 113], t: 180, an: { a: [178, 178] }, ln: { t: [155, 111] }, fn: 20 },
      { p: [100, 113], t: 112, an: { a: [8, 6] }, ln: { t: [122, 106] }, fn: 10 }] };
  A['escalador'] = { mode: 'loop', dur: 1.2, props: [F],
    frames: [
      { p: [98, 92], t: 22, an: { t: [135, 118] }, ln: { t: [112, 112], b: 1 }, lf: { t: [48, 110] }, fn: -60, ff: -100 },
      { p: [98, 92], t: 22, an: { t: [135, 118] }, ln: { t: [48, 110] }, lf: { t: [112, 112], b: 1 }, fn: -100, ff: -60 }] };

  // Cardio e funcional
  A['polichinelo'] = { view: 'front', mode: 'loop', dur: 1.1, vb: '0 -26 200 151', props: [F],
    frames: [
      { p: [100, 63], t: 90, an: { a: [-80, -86] }, ln: { a: [-88, -90] }, fn: -80 },
      { p: [100, 58], t: 90, an: { a: [62, 76] }, ln: { a: [-66, -70] }, fn: -60 }] };
  A['burpee'] = { mode: 'loop', dur: 4, vb: '0 -30 200 155', props: [F],
    frames: [
      { p: [95, 63], t: 90, an: { t: [96, 64] }, ln: { t: [97, 117] }, fn: 0 },
      { p: [86, 92], t: 48, an: { t: [124, 118] }, ln: { t: [100, 117] }, fn: 0 },
      { p: [100, 90], t: 20, an: { t: [137, 118] }, ln: { t: [48, 109] }, fn: -100 },
      { p: [86, 92], t: 48, an: { t: [124, 118] }, ln: { t: [100, 117] }, fn: 0 },
      { p: [95, 50], t: 90, an: { t: [110, -24] }, ln: { t: [97, 106] }, fn: -30 }] };
  A['pular-corda'] = { view: 'front', mode: 'loop', dur: 0.9, props: [F, { k: 'jrope' }],
    frames: [
      { p: [100, 63], t: 90, an: { t: [124, 66], b: 1 }, ln: { a: [-88, -90] }, fn: -80, rope: -70 },
      { p: [100, 57], t: 90, an: { t: [124, 62], b: 1 }, ln: { a: [-88, -92] }, fn: -60, rope: 186 }] };
  A['remo-ergometro'] = { dur: 2.6, props: [F, { k: 'line', pts: [[14, 112], [150, 112]], w: 4 }, { k: 'wheel', x: 160, y: 98, r: 13 }, { k: 'line', pts: [[112, 112], [118, 96]], w: 5 }, { k: 'roll', at: 'pelvis', d: [0, 5], r: 5 }, { k: 'cable', from: [150, 96], to: 'hn' }, { k: 'handle', at: 'hn', len: 10, v: 1, front: true }],
    frames: [
      { p: [72, 103], t: 62, an: { t: [118, 90] }, ln: { t: [113, 100], b: 1 }, fn: 70 },
      { p: [59, 103], t: 106, an: { t: [64, 74], b: -1 }, ln: { t: [113, 100], b: 1 }, fn: 70 }] };

  /* ================= Versão 2.5: mais exercícios ================= */

  // Glúteos
  A['elevacao-pelvica-unilateral'] = { dur: 2.6, props: [F, bench(36, 82, 97, [44, 76])],
    frames: [
      { p: [120, 105], t: 160, an: { t: [118, 99] }, ln: { t: [141, 116] }, lf: { a: [30, 30] }, ff: 115 },
      { p: [114, 90], t: 180, an: { t: [112, 84] }, ln: { t: [141, 116] }, lf: { a: [6, 6] }, ff: 95 }] };
  A['terra-sumo'] = { view: 'front', dur: 2.8, props: [F, { k: 'handle', at: 'mh', len: 76, v: 0, front: true }, { k: 'plate', at: 'mh', d: [-38, 0], r: 10, front: true }, { k: 'plate', at: 'mh', d: [38, 0], r: 10, front: true }],
    frames: [
      { p: [100, 86], t: 90, an: { t: [106, 104] }, ln: { t: [130, 117] }, fn: -60, l: { torso: 26 } },
      { p: [100, 66], t: 90, an: { t: [105, 68] }, ln: { t: [130, 117] }, fn: -60, l: { torso: 40 } }] };
  A['agachamento-lateral'] = { view: 'front', dur: 2.8, props: [F],
    frames: [
      // Mãos na cintura (o outro braço é espelhado).
      { p: [100, 67], t: 90, an: { t: [110, 64] }, ln: { t: [126, 117] }, lf: { t: [74, 117] }, fn: -60 },
      { p: [116, 86], t: 90, an: { t: [126, 83] }, ln: { t: [130, 117] }, lf: { t: [70, 117] }, fn: -60 }] };
  A['kettlebell-swing'] = { dur: 1.6, props: [F, { k: 'db', at: 'hn', d: [0, 4], r: 6, front: true }],
    frames: [
      { p: [86, 70], t: 32, an: { t: [102, 96] }, ln: { t: [100, 117] } },
      { p: [96, 63], t: 92, an: { t: [136, 22] }, ln: { t: [100, 117] } }] };

  // Posterior de coxa
  A['stiff-unilateral'] = { dur: 2.8, props: [F, { k: 'db', at: 'hn', v: 1, front: true }],
    frames: [
      { p: [100, 63], t: 90, an: { t: [103, 104] }, ln: { t: [108, 117] }, lf: { a: [-100, -97] }, ff: 0 },
      { p: [95, 67], t: 28, an: { t: [131, 108] }, ln: { t: [108, 117] }, lf: { a: [208, 208] }, ff: -62 }] };
  A['good-morning'] = { dur: 2.8, props: [F, { k: 'plate', at: 'hn' }],
    frames: [
      { p: [100, 63], t: 90, an: { t: [93, 21], b: 1 }, ln: { t: [108, 117] } },
      { p: [93, 67], t: 20, an: { t: [127, 45], b: 1 }, ln: { t: [108, 117] } }] };
  A['flexora-em-pe'] = { dur: 2.6, props: [F, { k: 'line', pts: [[130, 18], [130, 121]], w: 4 }, { k: 'rect', x: 108, y: 34, w: 8, h: 40, r: 3 }, { k: 'handle', at: 'hn', len: 10, v: 1, front: true }, { k: 'roll', at: 'an', d: [-4, -4], r: 4.5, front: true }],
    frames: [
      { p: [92, 63], t: 82, an: { t: [118, 42] }, ln: { a: [-88, -91] }, lf: { t: [96, 117] }, fn: 0, ff: 0 },
      { p: [92, 63], t: 82, an: { t: [118, 42] }, ln: { a: [-84, 172] }, lf: { t: [96, 117] }, fn: -95, ff: 0 }] };

  // Quadríceps
  // Barra apoiada na frente dos ombros, cotovelos para a frente (a anilha fica atrás da cabeça no desenho).
  A['agachamento-frontal'] = { dur: 2.8, props: [F, { k: 'plate', at: 'hn', d: [3, 4], r: 8 }],
    frames: [
      { p: [101, 63], t: 88, an: { t: [105, 19], b: -1 }, ln: { t: [110, 117] } },
      { p: [95, 92], t: 72, an: { t: [110, 50], b: -1 }, ln: { t: [110, 117] } }] };
  A['agachamento-banco'] = { dur: 2.8, props: [F, bench(50, 84, 97, [56, 78])],
    frames: [
      { p: [96, 63], t: 90, an: { a: [0, 0] }, ln: { t: [106, 117] } },
      { p: [82, 89], t: 66, an: { a: [8, 6] }, ln: { t: [106, 117] } }] };

  // Costas
  A['remada-invertida'] = { dur: 2.6, props: [F, { k: 'line', pts: [[98, 18], [98, 121]], w: 3, c: '#C9BBC2' }, { k: 'plate', at: [98, 65], r: 4, front: true }],
    frames: [
      { p: [114.2, 105.6], t: 168, an: { t: [98, 65], b: -1 }, ln: { a: [-12, -12] }, fn: 78 },
      { p: [121.4, 87.9], t: 148, an: { t: [98, 65], b: -1 }, ln: { a: [-32, -32] }, fn: 58 }] };
  A['superman'] = { dur: 2.6, props: [F],
    frames: [
      { p: [116, 113], t: 180, an: { a: [180, 180] }, ln: { a: [0, 0] }, fn: 0 },
      { p: [116, 112], t: 166, an: { a: [168, 170] }, ln: { a: [10, 10] }, fn: 10 }] };

  // Ombros e peito
  A['desenvolvimento-arnold'] = { dur: 2.8, props: [F, bench(74, 112, 96, [80, 106]), { k: 'line', pts: [[76, 96], [76, 44]], w: 5 }, { k: 'db', at: 'hn', v: 1, front: true }],
    frames: [
      { p: [95, 90], t: 90, an: { t: [106, 42], b: -1 }, ln: { t: [124, 117] } },
      { p: [95, 90], t: 90, an: { t: [97, 9] }, ln: { t: [124, 117] } }] };
  A['flexao-inclinada'] = { dur: 2.4, props: [F, bench(112, 162, 109, [118, 156])],
    frames: [
      { p: [93.9, 85.6], t: 33.5, an: { t: [132, 105] }, ln: { a: [213.5, 213.5] }, fn: -100 },
      { p: [99.7, 97.2], t: 20, an: { t: [132, 105], b: -1 }, ln: { a: [200, 200] }, fn: -100 }] };

  // Abdômen
  A['abdominal-canivete'] = { dur: 2.6, props: [F],
    frames: [
      { p: [108, 114], t: 180, an: { a: [178, 178] }, ln: { a: [2, 2] }, fn: 90 },
      { p: [108, 114], t: 125, hd: -10, an: { a: [52, 50] }, ln: { a: [55, 55] }, fn: 145 }] };
  A['dead-bug'] = { dur: 2.8, props: [F],
    frames: [
      { p: [112, 113], t: 180, an: { a: [90, 90] }, af: { a: [90, 90] }, ln: { a: [90, 0] }, lf: { a: [90, 0] }, fn: 90, ff: 90 },
      { p: [112, 113], t: 180, an: { a: [168, 172] }, af: { a: [90, 90] }, ln: { a: [90, 0] }, lf: { a: [10, 8] }, fn: 90, ff: 98 }] };
  A['abdominal-polia'] = { dur: 2.6, props: [F, { k: 'line', pts: [[174, 2], [174, 121]], w: 4 }, { k: 'cable', from: [168, 6], to: 'hn' }, { k: 'rope', at: 'hn', front: true }],
    frames: [
      { p: [100, 89], t: 80, an: { t: [110, 41], b: 1 }, ln: { a: [-90, 180] }, fn: 180 },
      { p: [98, 89], t: 22, hd: -40, an: { t: [140, 70], b: 1 }, ln: { a: [-88, 180] }, fn: 180 }] };
  A['abdominal-russo'] = { view: 'front', dur: 2.2, props: [F, { k: 'plate', at: 'mh', r: 6, front: true }],
    frames: [
      { p: [100, 112], t: 88, hd: -8, an: { t: [122, 98], b: 1 }, af: { t: [120, 100], b: 1 }, ln: { a: [62, -96] }, l: { torso: 34, th: 14, sh: 16 }, fn: -80 },
      { p: [100, 112], t: 92, hd: 8, an: { t: [80, 100], b: -1 }, af: { t: [78, 98], b: -1 }, ln: { a: [62, -96] }, l: { torso: 34, th: 14, sh: 16 }, fn: -80 }] };

  // Cardio e funcional
  A['agachamento-salto'] = { dur: 1.8, vb: '0 -28 200 153', props: [F],
    frames: [
      { p: [91, 90], t: 52, an: { a: [-120, -100] }, ln: { t: [110, 117] }, fn: 0 },
      { p: [100, 56], t: 88, an: { a: [70, 75] }, ln: { t: [104, 108] }, fn: -30 }] };
  A['skipping'] = { mode: 'loop', dur: 0.9, props: [F],
    frames: [
      { p: [98, 60], t: 92, an: { t: [86, 50], b: 1 }, af: { t: [116, 34], b: -1 }, ln: { a: [-2, -95] }, lf: { a: [-88, -92] }, fn: -20, ff: 0 },
      { p: [98, 60], t: 92, an: { t: [116, 34], b: -1 }, af: { t: [86, 50], b: 1 }, ln: { a: [-88, -92] }, lf: { a: [-2, -95] }, fn: 0, ff: -20 }] };
  A['corda-naval'] = { mode: 'loop', dur: 0.8, props: [F, { k: 'cable', from: [186, 114], to: 'hn' }, { k: 'cable', from: [186, 114], to: 'hf' }],
    frames: [
      { p: [86, 78], t: 70, an: { t: [124, 58] }, af: { t: [118, 76] }, ln: { t: [104, 117] }, lf: { t: [74, 117] }, fn: 0, ff: 0 },
      { p: [86, 78], t: 70, an: { t: [118, 76] }, af: { t: [124, 58] }, ln: { t: [104, 117] }, lf: { t: [74, 117] }, fn: 0, ff: 0 }] };

  if (typeof module === 'object' && module.exports) module.exports = A;
  else root.JSAnimacoes = A;
})(typeof self !== 'undefined' ? self : this);
