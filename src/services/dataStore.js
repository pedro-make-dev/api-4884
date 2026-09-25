const config = require('../config');
const { parsePrerequisitos } = require('../parsers/prerequisitos');
const { parseGrade } = require('../parsers/grade');
const { parsePolos } = require('../parsers/polos');
const { georreferenciar } = require('./geo');

const state = {
  data: null,
  loadedAt: 0,
  reloading: null,
};

async function fetchText(name, url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`Falha ao baixar "${name}": HTTP ${res.status}`);
  }
  return res.text();
}

async function loadAll() {
  const [prereqText, gradeCsv, polosCsv] = await Promise.all([
    fetchText('prerequisitos', config.docs.prerequisitos.url),
    fetchText('grade', config.docs.grade.url),
    fetchText('polos', config.docs.polos.url),
  ]);

  const data = {
    prerequisitos: parsePrerequisitos(prereqText),
    grade: parseGrade(gradeCsv),
    polos: georreferenciar(parsePolos(polosCsv)),
  };

  console.log(
    `[dataStore] dados carregados: ${data.prerequisitos.length} cursos de pré-requisitos, ` +
      `${data.grade.length} linhas de grade, ${data.polos.length} polos`
  );
  const semCoordenadas = polosSemCoordenadas(data.polos);
  if (semCoordenadas.length) {
    console.warn('[dataStore] polos sem município reconhecido (sem fallback por km):', semCoordenadas);
  }
  return data;
}

function polosSemCoordenadas(polos) {
  return polos.filter((p) => !p.geo).map((p) => `${p.cidade}/${p.uf}`);
}

function isStale() {
  return Date.now() - state.loadedAt > config.cacheTtlMinutes * 60 * 1000;
}

async function refresh() {
  if (!state.reloading) {
    state.reloading = loadAll()
      .then((data) => {
        state.data = data;
        state.loadedAt = Date.now();
        return data;
      })
      .finally(() => {
        state.reloading = null;
      });
  }
  return state.reloading;
}

// Retorna os dados em cache; se expirados, dispara recarga em background
// mantendo os dados antigos em caso de falha (resiliente a cold start do Render).
async function getData() {
  if (!state.data) return refresh();
  if (isStale()) {
    refresh().catch((err) => {
      console.error('[dataStore] recarga em background falhou, mantendo cache antigo:', err.message);
    });
  }
  return state.data;
}

function cacheInfo() {
  return {
    carregado: Boolean(state.data),
    carregadoEm: state.loadedAt ? new Date(state.loadedAt).toISOString() : null,
    idadeSegundos: state.loadedAt ? Math.round((Date.now() - state.loadedAt) / 1000) : null,
    ttlMinutos: config.cacheTtlMinutes,
    polosSemCoordenadas: state.data ? polosSemCoordenadas(state.data.polos) : [],
  };
}

module.exports = { getData, refresh, cacheInfo };
