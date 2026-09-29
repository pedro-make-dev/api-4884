const { Router } = require('express');
const { getData } = require('../services/dataStore');
const { buscarPolos } = require('../services/polosSearch');

const router = Router();

// GET /polos?uf=&cidade=&bairro=&cep=&megaPolo=&limite=
// Sem polo na cidade buscada → polos das cidades mais próximas (meta.fallback = true).
// Com bairro → polos ordenados pela distância até o bairro (distanciaKm).
router.get('/', async (req, res, next) => {
  try {
    const { polos } = await getData();
    const { data, meta } = await buscarPolos(polos, req.query);
    res.json({ ok: true, data, meta });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
