const { fuzzyMatch, normalize } = require('../utils/normalize');
const { findMunicipio, haversineKm } = require('./geo');

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

// GET /polos: filtra por uf/cidade/cep/megaPolo. Se a cidade buscada não tiver
// polo, devolve os polos das cidades mais próximas em km (sem restringir a UF).
function buscarPolos(polos, { uf, cidade, cep, megaPolo, limite } = {}) {
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

  const n = parseInt(limite, 10);
  const proximos = polosMaisProximos(
    filtrarMegaPolo(polos, megaPolo),
    busca.municipio,
    n > 0 ? n : LIMITE_CIDADES_PADRAO
  );
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

module.exports = { buscarPolos };
