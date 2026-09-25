const { Router } = require('express');
const { getData } = require('../services/dataStore');
const { buscarPolos } = require('../services/polosSearch');

const router = Router();

// GET /polos?uf=&cidade=&cep=&megaPolo=&limite=
// Sem polo na cidade buscada → polos das cidades mais próximas (meta.fallback = true).
router.get('/', async (req, res, next) => {
  try {
    const { polos } = await getData();
    const { data, meta } = buscarPolos(polos, req.query);
    res.json({ ok: true, data, meta });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
