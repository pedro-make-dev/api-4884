const app = require('./app');
const config = require('./config');
const { getData } = require('./services/dataStore');

if (!config.apiKey) {
  console.warn('[server] AVISO: API_KEY não definida — a API está aberta sem autenticação.');
}

app.listen(config.port, () => {
  console.log(`[server] API ouvindo na porta ${config.port}`);
  // Pré-carrega os dados para a primeira requisição já responder rápido.
  getData().catch((err) => {
    console.error('[server] falha no carregamento inicial dos dados:', err.message);
  });
});
