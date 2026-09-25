const { Router } = require('express');
const { getData } = require('../services/dataStore');
const { fuzzyMatch } = require('../utils/normalize');

const router = Router();

// GET /prerequisitos?curso=
router.get('/', async (req, res, next) => {
  try {
    const { curso } = req.query;
    const { prerequisitos } = await getData();
    const results = curso
      ? prerequisitos.filter((p) => fuzzyMatch(curso, p.curso))
      : prerequisitos;
    res.json({ ok: true, data: results, meta: { total: results.length } });
  } catch (err) {
    next(err);
  }
});

// GET /prerequisitos/verificar?cursoDesejado=&formacao=
router.get('/verificar', async (req, res, next) => {
  try {
    const { cursoDesejado, formacao } = req.query;
    if (!cursoDesejado || !formacao) {
      return res.status(400).json({
        ok: false,
        error: 'Parâmetros obrigatórios: cursoDesejado e formacao',
      });
    }

    const { prerequisitos } = await getData();
    const cursos = prerequisitos.filter((p) => fuzzyMatch(cursoDesejado, p.curso));
    if (cursos.length === 0) {
      return res.status(404).json({
        ok: false,
        error: `Curso de 2ª graduação não encontrado para "${cursoDesejado}". Consulte GET /prerequisitos para a lista completa.`,
      });
    }

    // O mesmo curso pode ter mais de uma duração (ex: 6 e 12 meses).
    const resultados = cursos.map((c) => {
      const formacaoCorrespondente = c.formacoesAceitas.find((f) => fuzzyMatch(formacao, f));
      return {
        curso: c.curso,
        duracaoMeses: c.duracaoMeses,
        elegivel: Boolean(formacaoCorrespondente),
        formacaoCorrespondente: formacaoCorrespondente || null,
      };
    });

    res.json({
      ok: true,
      data: {
        cursoDesejado,
        formacaoInformada: formacao,
        elegivel: resultados.some((r) => r.elegivel),
        opcoes: resultados,
      },
      meta: { total: resultados.length },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
