// Gera src/data/polosCoordenadas.json: coordenadas de cada polo da planilha,
// por CEP. Rode na sua máquina (a AwesomeAPI bloqueia servidores em nuvem)
// sempre que entrarem polos novos na planilha, e faça commit do arquivo:
//   npm run geocodificar-polos
const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const { parsePolos } = require('../src/parsers/polos');
const { georreferenciar, haversineKm } = require('../src/services/geo');
const {
  localizarCep,
  localizarBairro,
  normalizarCep,
  bairroDoEndereco,
  RAIO_MAX_KM,
} = require('../src/services/geocoder');

const ARQUIVO = path.join(__dirname, '../src/data/polosCoordenadas.json');

async function coordenadas(polo) {
  const municipio = { nome: polo.geo.municipio, uf: polo.geo.uf, lat: polo.geo.lat, lon: polo.geo.lon };
  const doCep = await localizarCep(polo.cep);
  if (doCep && haversineKm(municipio, doCep) <= RAIO_MAX_KM) return { coords: doCep, fonte: 'cep' };
  const bairro = bairroDoEndereco(polo.endereco);
  const doBairro = bairro && (await localizarBairro(bairro, municipio));
  if (doBairro) return { coords: doBairro, fonte: `bairro "${bairro}"` };
  return null;
}

async function main() {
  const res = await fetch(config.docs.polos.url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Falha ao baixar a planilha de polos: HTTP ${res.status}`);
  const polos = georreferenciar(parsePolos(await res.text()));

  const resultado = {};
  const semLocalizacao = [];
  for (const polo of polos) {
    const cep = normalizarCep(polo.cep);
    if (!polo.geo || !cep || resultado[cep]) continue;
    const r = await coordenadas(polo);
    if (!r) {
      semLocalizacao.push(`${polo.cidade}/${polo.uf} (CEP ${cep})`);
      continue;
    }
    if (r.fonte !== 'cep') console.log(`${polo.cidade}/${polo.uf}: CEP não localizado, usei o ${r.fonte}`);
    resultado[cep] = [Number(r.coords.lat.toFixed(5)), Number(r.coords.lon.toFixed(5))];
  }

  const linhas = Object.keys(resultado)
    .sort()
    .map((cep) => `"${cep}":${JSON.stringify(resultado[cep])}`);
  fs.writeFileSync(ARQUIVO, `{${linhas.join(',\n')}}\n`);
  console.log(`\n${linhas.length} CEPs de polos gravados em src/data/polosCoordenadas.json`);
  if (semLocalizacao.length) {
    console.log(`Sem localização (ficam sem distância na busca por bairro):\n  ${semLocalizacao.join('\n  ')}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
