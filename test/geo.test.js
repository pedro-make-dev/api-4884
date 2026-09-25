const test = require('node:test');
const assert = require('node:assert/strict');
const { haversineKm, findMunicipio, resolvePoloCity } = require('../src/services/geo');

test('haversineKm: Maceió → Arapiraca fica entre 95 e 110 km em linha reta', () => {
  const maceio = { lat: -9.6658, lon: -35.735 };
  const arapiraca = { lat: -9.7521, lon: -36.6612 };
  const km = haversineKm(maceio, arapiraca);
  assert.ok(km > 95 && km < 110, `distância inesperada: ${km}`);
});

test('haversineKm: mesmo ponto é 0 km', () => {
  assert.equal(haversineKm({ lat: -10, lon: -40 }, { lat: -10, lon: -40 }), 0);
});

test('findMunicipio: acha por nome sem acento e UF', () => {
  const r = findMunicipio('palmeira dos indios', 'al');
  assert.equal(r.status, 'ok');
  assert.equal(r.municipio.nome, 'Palmeira dos Índios');
  assert.equal(r.municipio.uf, 'AL');
  assert.equal(typeof r.municipio.lat, 'number');
});

test('findMunicipio: nome único no Brasil dispensa UF', () => {
  const r = findMunicipio('Arapiraca');
  assert.equal(r.status, 'ok');
  assert.equal(r.municipio.uf, 'AL');
});

test('findMunicipio: nome repetido em vários estados sem UF é ambíguo', () => {
  const r = findMunicipio('santa luzia');
  assert.equal(r.status, 'ambiguous');
  const ufs = r.candidatos.map((c) => c.uf);
  assert.ok(ufs.includes('MG'));
  assert.ok(ufs.includes('PB'));
  assert.ok(r.candidatos.every((c) => c.nome === 'Santa Luzia'));
});

test('findMunicipio: com UF informada, ignora homônimos de outros estados', () => {
  const r = findMunicipio('santa luzia', 'PB');
  assert.equal(r.status, 'ok');
  assert.equal(r.municipio.uf, 'PB');
});

test('findMunicipio: aceita apelido conhecido', () => {
  const r = findMunicipio('Santana do Livramento', 'RS');
  assert.equal(r.status, 'ok');
  assert.equal(r.municipio.nome, "Sant'Ana do Livramento");
});

test('findMunicipio: cidade inexistente retorna not_found', () => {
  assert.equal(findMunicipio('cidade que nao existe', 'SP').status, 'not_found');
});

test('findMunicipio: aceita nome parcial quando só há um candidato na UF', () => {
  const r = findMunicipio('palmeira dos ind', 'AL');
  assert.equal(r.status, 'ok');
  assert.equal(r.municipio.nome, 'Palmeira dos Índios');
});

test('resolvePoloCity: remove bairro entre parênteses', () => {
  assert.equal(resolvePoloCity('MANAUS (ZONA LESTE)', 'AM').nome, 'Manaus');
  assert.equal(resolvePoloCity('ITABUNA(RODOVIÁRIA)', 'BA').nome, 'Itabuna');
});

test('resolvePoloCity: remove sufixo com traço', () => {
  assert.equal(resolvePoloCity('PALMAS-TO', 'TO').nome, 'Palmas');
  assert.equal(resolvePoloCity('PARNAMIRIM – RN', 'RN').nome, 'Parnamirim');
  assert.equal(resolvePoloCity('MACEIO -CIDADE UNIVERSITARIA', 'AL').nome, 'Maceió');
  assert.equal(resolvePoloCity('PORTO ALEGRE – ZONA SUL', 'RS').nome, 'Porto Alegre');
});

test('resolvePoloCity: preserva hífen que faz parte do nome', () => {
  assert.equal(resolvePoloCity('XIQUE-XIQUE', 'BA').nome, 'Xique-Xique');
});

test('resolvePoloCity: usa o maior município que prefixa o texto', () => {
  assert.equal(resolvePoloCity('SÃO PAULO IPIRANGA', 'SP').nome, 'São Paulo');
  assert.equal(resolvePoloCity('FORTALEZA ALDEOTA', 'CE').nome, 'Fortaleza');
  assert.equal(resolvePoloCity('RIO DE JANEIRO BARRA DA TIJUCA', 'RJ').nome, 'Rio de Janeiro');
});

test('resolvePoloCity: corrige UF errada da planilha quando o nome é único', () => {
  const r = resolvePoloCity('TRÊS LAGOAS', 'MT');
  assert.equal(r.nome, 'Três Lagoas');
  assert.equal(r.uf, 'MS');
});

test('resolvePoloCity: UF errada com nome repetido escolhe a UF mais próxima da informada', () => {
  // Existe Campo Grande em AL e MS; a planilha marca MT, vizinho de MS.
  const r = resolvePoloCity('CAMPO GRANDE', 'MT');
  assert.equal(r.nome, 'Campo Grande');
  assert.equal(r.uf, 'MS');
});

test('resolvePoloCity: resolve apelidos conhecidos', () => {
  assert.equal(resolvePoloCity('ÁGUAS LINDAS', 'GO').nome, 'Águas Lindas de Goiás');
  assert.equal(resolvePoloCity('SANTANA DO LIVRAMENTO', 'RS').nome, "Sant'Ana do Livramento");
  assert.equal(resolvePoloCity('CATOLÉ DA ROCHA', 'PB').nome, 'Catolé do Rocha');
});

test('resolvePoloCity: retorna null quando não reconhece', () => {
  assert.equal(resolvePoloCity('LUGAR NENHUM', 'SP'), null);
});
