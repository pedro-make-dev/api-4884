const { Router } = require('express');
const { getData } = require('../services/dataStore');
const { fuzzyMatch, normalize } = require('../utils/normalize');

const router = Router();

function distinctCursos(grade) {
  const map = new Map();
  for (const row of grade) {
    const key = `${row.curso}||${row.modalidade}`;
    if (!map.has(key)) {
      map.set(key, { curso: row.curso, modalidade: row.modalidade, totalDisciplinas: 0 });
    }
    map.get(key).totalDisciplinas += 1;
  }
  return [...map.values()];
}

// GET /cursos?modalidade=
router.get('/', async (req, res, next) => {
  try {
    const { modalidade } = req.query;
    const { grade } = await getData();
    let cursos = distinctCursos(grade);
    if (modalidade) cursos = cursos.filter((c) => fuzzyMatch(modalidade, c.modalidade));
    res.json({ ok: true, data: cursos, meta: { total: cursos.length } });
  } catch (err) {
    next(err);
  }
});

// GET /cursos/grade?curso=&modalidade=
router.get('/grade', async (req, res, next) => {
  try {
    const { curso, modalidade } = req.query;
    if (!curso) {
      return res.status(400).json({ ok: false, error: 'Parâmetro obrigatório: curso' });
    }
    const { grade } = await getData();

    let candidatos = distinctCursos(grade).filter((c) => fuzzyMatch(curso, c.curso));
    if (modalidade) candidatos = candidatos.filter((c) => fuzzyMatch(modalidade, c.modalidade));
    if (candidatos.length === 0) {
      return res.status(404).json({
        ok: false,
        error: `Nenhum curso encontrado para "${curso}". Consulte GET /cursos para a lista completa.`,
      });
    }

    // Match mais específico primeiro (nome normalizado mais curto).
    candidatos.sort((a, b) => normalize(a.curso).length - normalize(b.curso).length);
    const escolhido = candidatos[0];

    const disciplinas = grade
      .filter((r) => r.curso === escolhido.curso && r.modalidade === escolhido.modalidade)
      .sort((a, b) => a.ordem - b.ordem)
      .map(({ ordem, disciplina, cargaHoraria }) => ({ ordem, disciplina, cargaHoraria }));

    const cargaHorariaTotal = disciplinas.reduce((sum, d) => sum + (d.cargaHoraria || 0), 0);

    res.json({
      ok: true,
      data: {
        curso: escolhido.curso,
        modalidade: escolhido.modalidade,
        totalDisciplinas: disciplinas.length,
        cargaHorariaTotal,
        disciplinas,
      },
      meta: {
        outrosCursosCorrespondentes: candidatos
          .slice(1)
          .map((c) => ({ curso: c.curso, modalidade: c.modalidade })),
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
