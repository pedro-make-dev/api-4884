const { parse } = require('csv-parse/sync');

// CSV da grade: curso, modalidade, grade_arquivo, ordem, disciplina, carga_horaria
function parseGrade(csvText) {
  const rows = parse(csvText, {
    columns: (header) => header.map((h) => h.trim().toLowerCase()),
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  });

  return rows
    .filter((row) => row.curso && row.disciplina)
    .map((row) => {
      const carga = parseInt(String(row.carga_horaria || '').replace(/\D/g, ''), 10);
      return {
        curso: row.curso,
        modalidade: row.modalidade || '',
        gradeArquivo: row.grade_arquivo || '',
        ordem: parseInt(row.ordem, 10) || 0,
        disciplina: row.disciplina,
        cargaHoraria: Number.isNaN(carga) ? null : carga,
      };
    });
}

module.exports = { parseGrade };
