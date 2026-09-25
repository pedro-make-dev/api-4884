const { normalize } = require('../utils/normalize');

// Municípios do IBGE com coordenadas: [uf, nome, lat, lon].
// Fonte: github.com/kelvins/municipios-brasileiros (MIT).
const MUNICIPIOS = require('../data/municipios.json').map(([uf, nome, lat, lon]) => ({
  uf,
  nome,
  lat,
  lon,
  chave: normalize(nome),
}));

const POR_UF = new Map();
for (const m of MUNICIPIOS) {
  if (!POR_UF.has(m.uf)) POR_UF.set(m.uf, []);
  POR_UF.get(m.uf).push(m);
}

// Grafias usadas na planilha/pelos leads que diferem do nome oficial do IBGE.
const APELIDOS = {
  'aguas lindas': 'aguas lindas de goias',
  'santana do livramento': 'sant ana do livramento',
  'catole da rocha': 'catole do rocha',
};

const RAIO_TERRA_KM = 6371;

function haversineKm(a, b) {
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * RAIO_TERRA_KM * Math.asin(Math.sqrt(h));
}

function chaveDe(texto) {
  const chave = normalize(texto);
  return APELIDOS[chave] || chave;
}

function listaDaUf(uf) {
  return uf ? POR_UF.get(String(uf).toUpperCase()) || [] : MUNICIPIOS;
}

function publico(m) {
  return { nome: m.nome, uf: m.uf, lat: m.lat, lon: m.lon };
}

function resultado(candidatos) {
  if (candidatos.length === 1) return { status: 'ok', municipio: publico(candidatos[0]) };
  return {
    status: 'ambiguous',
    candidatos: candidatos.map((m) => ({ nome: m.nome, uf: m.uf })),
  };
}

// Localiza a cidade informada pelo lead. Tenta nome exato; se não houver,
// aceita correspondência parcial (todos os termos presentes no nome).
function findMunicipio(nome, uf) {
  const chave = chaveDe(nome);
  if (!chave) return { status: 'not_found' };
  const lista = listaDaUf(uf);

  const exatos = lista.filter((m) => m.chave === chave);
  if (exatos.length) return resultado(exatos);

  const termos = chave.split(' ');
  const parciais = lista.filter((m) => {
    const palavras = m.chave.split(' ');
    return termos.every((t) => palavras.some((p) => p.startsWith(t)));
  });
  if (parciais.length) return resultado(parciais);

  return { status: 'not_found' };
}

// Município cujo nome é o maior prefixo do texto ("sao paulo ipiranga" → São Paulo).
function maioresPrefixos(texto, lista) {
  let melhor = [];
  let tamanho = 0;
  for (const m of lista) {
    if (texto !== m.chave && !texto.startsWith(`${m.chave} `)) continue;
    if (m.chave.length > tamanho) {
      melhor = [m];
      tamanho = m.chave.length;
    } else if (m.chave.length === tamanho) {
      melhor.push(m);
    }
  }
  return melhor;
}

const centroides = new Map();
function centroideDaUf(uf) {
  if (!centroides.has(uf)) {
    const lista = POR_UF.get(uf) || [];
    if (!lista.length) return null;
    centroides.set(uf, {
      lat: lista.reduce((s, m) => s + m.lat, 0) / lista.length,
      lon: lista.reduce((s, m) => s + m.lon, 0) / lista.length,
    });
  }
  return centroides.get(uf);
}

// Descobre o município de um polo a partir do texto livre da planilha, que pode
// trazer bairro ("MANAUS (ZONA LESTE)"), sufixo ("PALMAS-TO") ou UF errada.
function resolvePoloCity(cidade, uf) {
  const texto = chaveDe(String(cidade || '').replace(/\(.*$/, ''));
  if (!texto) return null;
  const ufNorm = String(uf || '').toUpperCase();

  const naUf = maioresPrefixos(texto, listaDaUf(ufNorm));
  if (naUf.length) return publico(naUf[0]);

  // UF da planilha errada: procura no Brasil todo e, se houver homônimos,
  // fica com o mais próximo da UF informada.
  const noBrasil = maioresPrefixos(texto, MUNICIPIOS);
  if (!noBrasil.length) return null;
  const centro = centroideDaUf(ufNorm);
  if (centro) noBrasil.sort((a, b) => haversineKm(centro, a) - haversineKm(centro, b));
  return publico(noBrasil[0]);
}

// Anexa a cada polo o município IBGE e suas coordenadas (geo: null se não reconhecido).
function georreferenciar(polos) {
  return polos.map((p) => {
    const m = resolvePoloCity(p.cidade, p.uf);
    return { ...p, geo: m ? { municipio: m.nome, uf: m.uf, lat: m.lat, lon: m.lon } : null };
  });
}

module.exports = { haversineKm, findMunicipio, resolvePoloCity, georreferenciar };
