const { Router } = require('express');
const { getData } = require('../services/dataStore');
const { fuzzyMatch } = require('../utils/normalize');

const router = Router();
const LIMIT = 20;

// GET /search?q=
router.get('/', async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ ok: false, error: 'Parâmetro obrigatório: q' });
    }

    const { polos, grade, prerequisitos } = await getData();

    const polosMatch = polos
      .filter((p) => fuzzyMatch(q, `${p.cidade} ${p.estado} ${p.uf} ${p.endereco}`))
      .slice(0, LIMIT);

    const cursosVistos = new Set();
    const cursosMatch = [];
    for (const row of grade) {
      const key = `${row.curso}||${row.modalidade}`;
      if (cursosVistos.has(key)) continue;
      if (fuzzyMatch(q, row.curso)) {
        cursosVistos.add(key);
        cursosMatch.push({ curso: row.curso, modalidade: row.modalidade });
        if (cursosMatch.length >= LIMIT) break;
      }
    }

    const prereqMatch = prerequisitos
      .filter(
        (p) => fuzzyMatch(q, p.curso) || p.formacoesAceitas.some((f) => fuzzyMatch(q, f))
      )
      .slice(0, LIMIT)
      .map((p) => ({ curso: p.curso, duracaoMeses: p.duracaoMeses }));

    res.json({
      ok: true,
      data: { polos: polosMatch, cursos: cursosMatch, prerequisitos: prereqMatch },
      meta: {
        totais: {
          polos: polosMatch.length,
          cursos: cursosMatch.length,
          prerequisitos: prereqMatch.length,
        },
        limitePorTipo: LIMIT,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
