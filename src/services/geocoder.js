const { haversineKm } = require('./geo');

// Coordenadas finas (bairro do lead e endereço do polo) para ordenar polos
// dentro de uma cidade. Falhas viram null: quem chama segue sem ordenação.
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const CEP_URL = 'https://cep.awesomeapi.com.br/json/';
const USER_AGENT = '4884-api/1.0';
const TIMEOUT_MS = 5000;
// Resultado mais longe que isso do centro do município é de outra cidade.
const RAIO_MAX_KM = 40;
// Política de uso do Nominatim: no máximo 1 requisição por segundo.
const INTERVALO_NOMINATIM_MS = 1100;

const cacheCep = new Map();
const cacheBairro = new Map();

async function getJson(url, params) {
  const res = await fetch(`${url}?${new URLSearchParams(params)}`, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'pt-BR' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

let filaNominatim = Promise.resolve();
function nominatim(params) {
  const chamada = filaNominatim.then(() =>
    getJson(NOMINATIM_URL, { format: 'jsonv2', countrycodes: 'br', limit: '5', ...params })
  );
  filaNominatim = chamada
    .catch(() => {})
    .then(() => new Promise((r) => setTimeout(r, INTERVALO_NOMINATIM_MS)));
  return chamada;
}

function maisProximoDoCentro(resultados, municipio) {
  return resultados
    .map((r) => ({ lat: Number(r.lat), lon: Number(r.lon) }))
    .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lon))
    .map((c) => ({ ...c, km: haversineKm(municipio, c) }))
    .filter((c) => c.km <= RAIO_MAX_KM)
    .sort((a, b) => a.km - b.km)
    .map(({ lat, lon }) => ({ lat, lon }))[0] || null;
}

// Bairro do lead → { lat, lon }. Primeiro busca "bairro, cidade, UF"; se o OSM
// não ligar o bairro à cidade (ex.: regiões administrativas do DF), busca só o
// nome do bairro numa caixa em volta do município.
async function localizarBairro(bairro, municipio) {
  const chave = `${bairro}|${municipio.nome}|${municipio.uf}`.toLowerCase();
  if (cacheBairro.has(chave)) return cacheBairro.get(chave);

  let coords = null;
  try {
    const porEndereco = await nominatim({ q: `${bairro}, ${municipio.nome}, ${municipio.uf}, Brasil` });
    coords = maisProximoDoCentro(porEndereco, municipio);
    if (!coords) {
      const d = 0.4; // ~44 km
      const naRegiao = await nominatim({
        q: bairro,
        viewbox: [municipio.lon - d, municipio.lat + d, municipio.lon + d, municipio.lat - d].join(','),
        bounded: '1',
      });
      coords = maisProximoDoCentro(naRegiao, municipio);
    }
  } catch (err) {
    console.warn(`[geocoder] falha ao localizar bairro "${bairro}" (${municipio.nome}/${municipio.uf}):`, err.message);
    return null; // erro de rede não vai para o cache
  }
  cacheBairro.set(chave, coords);
  return coords;
}

// CEP do polo → { lat, lon } do logradouro.
async function localizarCep(cep) {
  const digitos = String(cep || '').replace(/\D/g, '').padStart(8, '0');
  if (digitos === '00000000') return null;
  if (cacheCep.has(digitos)) return cacheCep.get(digitos);

  let coords = null;
  try {
    const r = await getJson(`${CEP_URL}${digitos}`, {});
    const lat = Number(r.lat);
    const lon = Number(r.lng);
    if (r.lat && r.lng && Number.isFinite(lat) && Number.isFinite(lon)) coords = { lat, lon };
  } catch (err) {
    // A AwesomeAPI responde 404 para CEP inexistente: esse vai para o cache como null.
    if (!/HTTP 404/.test(err.message)) {
      console.warn(`[geocoder] falha ao localizar CEP ${digitos}:`, err.message);
      return null;
    }
  }
  cacheCep.set(digitos, coords);
  return coords;
}

module.exports = { localizarBairro, localizarCep, RAIO_MAX_KM };
