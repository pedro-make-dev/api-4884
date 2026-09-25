const test = require('node:test');
const assert = require('node:assert/strict');
const { georreferenciar } = require('../src/services/geo');
const { buscarPolos } = require('../src/services/polosSearch');

function polo(uf, cidade, extras = {}) {
  return { uf, estado: '', cidade, endereco: `END ${cidade}`, cep: '', megaPolo: false, ...extras };
}

// Distâncias aproximadas a partir de Palmeira dos Índios/AL:
// Arapiraca ~39 km, Garanhuns/PE ~60 km, Maceió ~110 km, Salvador ~380 km.
const POLOS = georreferenciar([
  polo('AL', 'ARAPIRACA (CENTRO)'),
  polo('AL', 'ARAPIRACA (ALTO DO CRUZEIRO)'),
  polo('PE', 'GARANHUNS'),
  polo('AL', 'MACEIO -CIDADE UNIVERSITARIA', { megaPolo: true }),
  polo('BA', 'SALVADOR (CENTRO)', { megaPolo: true }),
  polo('SP', 'SÃO PAULO IPIRANGA'),
  polo('MT', 'CAMPO GRANDE'),
  polo('XX', 'LUGAR NENHUM'),
]);

test('georreferenciar: adiciona município e coordenadas, ou null se não reconhecer', () => {
  const [arapiraca] = POLOS;
  assert.equal(arapiraca.geo.municipio, 'Arapiraca');
  assert.equal(arapiraca.geo.uf, 'AL');
  assert.equal(typeof arapiraca.geo.lat, 'number');
  assert.equal(POLOS.at(-1).geo, null);
});

test('cidade com polo: retorna os polos da cidade sem fallback', () => {
  const { data, meta } = buscarPolos(POLOS, { cidade: 'arapiraca', uf: 'AL' });
  assert.equal(data.length, 2);
  assert.equal(meta.fallback, false);
  assert.equal(meta.total, 2);
  assert.ok(data.every((p) => p.distanciaKm === undefined));
});

test('sem filtro de cidade não há fallback, mesmo sem resultados', () => {
  const { data, meta } = buscarPolos(POLOS, { uf: 'RS' });
  assert.equal(data.length, 0);
  assert.equal(meta.fallback, false);
});

test('cidade sem polo: retorna polos das cidades mais próximas ordenados por km', () => {
  const { data, meta } = buscarPolos(POLOS, { cidade: 'palmeira dos indios', uf: 'AL' });
  assert.equal(meta.fallback, true);
  assert.equal(meta.motivo, 'sem_polo_na_cidade');
  assert.deepEqual(meta.cidadeBuscada, { nome: 'Palmeira dos Índios', uf: 'AL' });
  const kms = data.map((p) => p.distanciaKm);
  assert.deepEqual(kms, [...kms].sort((a, b) => a - b));
  assert.ok(Number.isInteger(kms[0]));
  assert.equal(data[0].geo.municipio, 'Arapiraca');
});

test('fallback atravessa a divisa do estado quando a outra UF é mais perto', () => {
  const { data } = buscarPolos(POLOS, { cidade: 'palmeira dos indios', uf: 'AL' });
  const cidades = data.map((p) => p.geo.municipio);
  assert.ok(cidades.indexOf('Garanhuns') < cidades.indexOf('Maceió'));
});

test('limite conta cidades, não polos', () => {
  const { data, meta } = buscarPolos(POLOS, { cidade: 'palmeira dos indios', uf: 'AL', limite: '1' });
  assert.equal(data.length, 2);
  assert.ok(data.every((p) => p.geo.municipio === 'Arapiraca'));
  assert.equal(meta.total, 2);
});

test('limite padrão é 5 cidades', () => {
  const { data } = buscarPolos(POLOS, { cidade: 'palmeira dos indios', uf: 'AL' });
  const cidades = new Set(data.map((p) => `${p.geo.municipio}/${p.geo.uf}`));
  assert.equal(cidades.size, 5);
  assert.ok(!cidades.has('Campo Grande/MS'), 'a cidade mais distante deveria ficar de fora');
});

test('fallback respeita o filtro megaPolo', () => {
  const { data } = buscarPolos(POLOS, { cidade: 'palmeira dos indios', uf: 'AL', megaPolo: 'true' });
  assert.ok(data.length > 0);
  assert.ok(data.every((p) => p.megaPolo));
  assert.equal(data[0].geo.municipio, 'Maceió');
});

test('filtro uf também casa a UF corrigida pelo IBGE', () => {
  const { data, meta } = buscarPolos(POLOS, { cidade: 'campo grande', uf: 'MS' });
  assert.equal(meta.fallback, false);
  assert.equal(data.length, 1);
});

test('cidade ambígua sem UF: não faz fallback e pede a UF', () => {
  const { data, meta } = buscarPolos(POLOS, { cidade: 'santa luzia' });
  assert.equal(data.length, 0);
  assert.equal(meta.fallback, false);
  assert.match(meta.aviso, /UF/);
  assert.ok(meta.candidatos.some((c) => c.uf === 'PB'));
});

test('cidade inexistente: não faz fallback e avisa', () => {
  const { data, meta } = buscarPolos(POLOS, { cidade: 'cidade que nao existe', uf: 'SP' });
  assert.equal(data.length, 0);
  assert.equal(meta.fallback, false);
  assert.match(meta.aviso, /não encontrada/);
});
