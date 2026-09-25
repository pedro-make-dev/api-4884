const { Router } = require('express');
const { refresh, cacheInfo } = require('../services/dataStore');

const router = Router();

// POST /refresh — força recarga dos 3 documentos Google.
router.post('/refresh', async (req, res, next) => {
  try {
    const data = await refresh();
    res.json({
      ok: true,
      data: {
        prerequisitos: data.prerequisitos.length,
        linhasGrade: data.grade.length,
        polos: data.polos.length,
      },
      meta: { cache: cacheInfo() },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
