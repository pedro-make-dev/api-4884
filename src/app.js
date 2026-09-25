const express = require('express');
const config = require('./config');
const { cacheInfo } = require('./services/dataStore');

const app = express();
app.disable('x-powered-by');
app.use(express.json());

// /health fica aberto para o health check do Render e pings de keep-alive.
app.get('/health', (req, res) => {
  res.json({ ok: true, data: { status: 'up', cache: cacheInfo() } });
});

// Autenticação por API key em todas as demais rotas.
app.use((req, res, next) => {
  if (!config.apiKey) return next(); // sem API_KEY configurada, API fica aberta (dev local)
  if (req.get('x-api-key') === config.apiKey) return next();
  res.status(401).json({ ok: false, error: 'API key inválida ou ausente (header x-api-key)' });
});

app.use('/polos', require('./routes/polos'));
app.use('/cursos', require('./routes/cursos'));
app.use('/prerequisitos', require('./routes/prerequisitos'));
app.use('/search', require('./routes/search'));
app.use('/', require('./routes/admin'));

app.use((req, res) => {
  res.status(404).json({ ok: false, error: `Rota não encontrada: ${req.method} ${req.path}` });
});

// Handler de erros sempre em JSON (nunca HTML) para facilitar o tratamento no n8n.
app.use((err, req, res, next) => {
  console.error('[app] erro:', err);
  res.status(500).json({ ok: false, error: err.message || 'Erro interno' });
});

module.exports = app;
