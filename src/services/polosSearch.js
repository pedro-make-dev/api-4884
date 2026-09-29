const { fuzzyMatch, normalize } = require('../utils/normalize');
const { findMunicipio, haversineKm } = require('./geo');
const geocoderPadrao = require('./geocoder');

const LIMITE_CIDADES_PADRAO = 5;

function filtrarMegaPolo(polos, megaPolo) {
  if (megaPolo === undefined) return polos;
  const wanted = ['true', 'sim', '1'].includes(normalize(megaPolo));
  return polos.filter((p) => p.megaPolo === wanted);
}

// Polos das `limite` cidades mais próximas da origem, ordenados por distância.
function polosMaisProximos(polos, origem, limite) {
  const comDistancia = polos
    .filter((p) => p.geo)
    .map((p) => ({ ...p, distanciaKm: Math.round(haversineKm(origem, p.geo)) }))
    .sort((a, b) => a.distanciaKm - b.distanciaKm);

  const cidades = new Set();
  return comDistancia.filter((p) => {
    const cidade = `${p.geo.municipio}/${p.geo.uf}`;
    if (!cidades.has(cidade)) {
      if (cidades.size >= limite) return false;
      cidades.add(cidade);
    }
    return true;
  });
}

// Dentro da cidade as distâncias são curtas: uma casa decimal.
function kmComUmaCasa(km) {
  return Math.round(km * 10) / 10;
}

function limiteDeCidades(limite) {
  const n = parseInt(limite, 10);
  return n > 0 ? n : LIMITE_CIDADES_PADRAO;
}

// Filtra por uf/cidade/cep/megaPolo. Se a cidade buscada não tiver polo,
// devolve os polos das cidades mais próximas em km (sem restringir a UF).
function buscarPorCidade(polos, { uf, cidade, cep, megaPolo, limite } = {}) {
  let results = polos;
  if (uf) {
    const wanted = String(uf).toUpperCase();
    results = results.filter((p) => p.uf === wanted || (p.geo && p.geo.uf === wanted));
  }
  if (cidade) results = results.filter((p) => fuzzyMatch(cidade, p.cidade));
  if (cep) {
    const prefix = String(cep).replace(/\D/g, '');
    results = results.filter((p) => p.cep.startsWith(prefix));
  }
  results = filtrarMegaPolo(results, megaPolo);

  if (results.length || !cidade) {
    return { data: results, meta: { total: results.length, fallback: false } };
  }

  const busca = findMunicipio(cidade, uf);
  if (busca.status === 'ambiguous') {
    return {
      data: [],
      meta: {
        total: 0,
        fallback: false,
        aviso: `Há mais de uma cidade com esse nome. Informe a UF para buscar os polos mais próximos.`,
        candidatos: busca.candidatos,
      },
    };
  }
  if (busca.status === 'not_found') {
    return {
      data: [],
      meta: {
        total: 0,
        fallback: false,
        aviso: `Cidade "${cidade}" não encontrada na base de municípios do IBGE. Confira a grafia e a UF.`,
      },
    };
  }

  const proximos = polosMaisProximos(filtrarMegaPolo(polos, megaPolo), busca.municipio, limiteDeCidades(limite));
  return {
    data: proximos,
    meta: {
      total: proximos.length,
      fallback: true,
      motivo: 'sem_polo_na_cidade',
      cidadeBuscada: { nome: busca.municipio.nome, uf: busca.municipio.uf },
    },
  };
}

// Coordenada mais fina do polo: CEP do endereço; sem ela, o centro do município.
async function coordenadasDoPolo(polo, geocoder) {
  if (!polo.geo) return null;
  const doCep = await geocoder.localizarCep(polo.cep);
  if (doCep && haversineKm(polo.geo, doCep) <= geocoder.RAIO_MAX_KM) return doCep;
  return polo.geo;
}

// Com bairro: os polos da cidade vêm ordenados pela distância até o bairro; sem
// polo na cidade, o fallback mede a partir do bairro. Se o bairro não for
// localizado, a resposta é a mesma da busca sem bairro, com um aviso.
async function refinarPorBairro(resultado, polos, query, geocoder) {
  const { bairro, cidade, uf, megaPolo, limite } = query;
  if (resultado.meta.aviso) return resultado;

  const busca = findMunicipio(cidade, uf);
  if (busca.status !== 'ok') return resultado;
  const municipio = busca.municipio;
  const bairroBuscado = { nome: String(bairro).trim(), cidade: municipio.nome, uf: municipio.uf };

  const origem = await geocoder.localizarBairro(bairroBuscado.nome, municipio);
  if (!origem) {
    return {
      data: resultado.data,
      meta: {
        ...resultado.meta,
        bairroBuscado,
        bairroLocalizado: false,
        aviso: `Bairro "${bairroBuscado.nome}" não localizado em ${municipio.nome}/${municipio.uf}. Polos listados sem ordenar por distância do bairro.`,
      },
    };
  }

  if (resultado.meta.fallback) {
    const proximos = polosMaisProximos(filtrarMegaPolo(polos, megaPolo), origem, limiteDeCidades(limite));
    return {
      data: proximos,
      meta: { ...resultado.meta, total: proximos.length, bairroBuscado, bairroLocalizado: true },
    };
  }

  const comDistancia = await Promise.all(
    resultado.data.map(async (p) => {
      const coords = await coordenadasDoPolo(p, geocoder);
      return coords ? { ...p, distanciaKm: kmComUmaCasa(haversineKm(origem, coords)) } : p;
    })
  );
  // Polos sem coordenada (geo: null) vão para o fim.
  comDistancia.sort((a, b) => (a.distanciaKm ?? Infinity) - (b.distanciaKm ?? Infinity));
  return {
    data: comDistancia,
    meta: {
      ...resultado.meta,
      ordenadoPor: 'distancia_do_bairro',
      bairroBuscado,
      bairroLocalizado: true,
    },
  };
}

// GET /polos. `bairro` é opcional e só vale junto com `cidade`.
async function buscarPolos(polos, query = {}, geocoder = geocoderPadrao) {
  const resultado = buscarPorCidade(polos, query);
  const bairro = String(query.bairro || '').trim();
  if (!bairro || !query.cidade) return resultado;
  return refinarPorBairro(resultado, polos, query, geocoder);
}

module.exports = { buscarPolos };
