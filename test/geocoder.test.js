const test = require('node:test');
const assert = require('node:assert/strict');
const { bairroDoEndereco, normalizarCep, localizarPolo } = require('../src/services/geocoder');
const { georreferenciar } = require('../src/services/geo');

test('bairroDoEndereco: pega o trecho depois do último traço', () => {
  assert.equal(bairroDoEndereco('RUA CISPLATINA Nº766 - IPIRANGA'), 'IPIRANGA');
  assert.equal(bairroDoEndereco('AV. JOANA ANGÉLICA - EDIF DANIEL VENTIN Nº1526 - NAZARÉ'), 'NAZARÉ');
  assert.equal(bairroDoEndereco('QNN 18, conj. H lote 17 - CEILÂNDIA SUL'), 'CEILÂNDIA SUL');
  assert.equal(bairroDoEndereco('RUA SEM BAIRRO 123'), '');
});

test('normalizarCep: completa o zero que a planilha perde', () => {
  assert.equal(normalizarCep('8010220'), '08010220');
  assert.equal(normalizarCep('04211-040'), '04211040');
  assert.equal(normalizarCep(''), '');
});

test('localizarPolo: polo conhecido sai do arquivo gerado, sem rede', async () => {
  const fetchOriginal = global.fetch;
  global.fetch = () => {
    throw new Error('não deveria chamar a rede');
  };
  try {
    const [polo] = georreferenciar([
      { uf: 'SP', estado: '', cidade: 'SÃO PAULO PAULISTA', endereco: 'X - PARAISO', cep: '4004050', megaPolo: true },
    ]);
    const coords = await localizarPolo(polo);
    assert.ok(Math.abs(coords.lat - -23.574) < 0.01 && Math.abs(coords.lon - -46.642) < 0.01);
  } finally {
    global.fetch = fetchOriginal;
  }
});
