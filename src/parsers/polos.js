const { parse } = require('csv-parse/sync');

// CSV de polos: UF, Estado, Cidade, Endereço, CEP, Mega_polo
function parsePolos(csvText) {
  const rows = parse(csvText, {
    columns: (header) => header.map((h) => h.trim().toLowerCase()),
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  });

  return rows
    .filter((row) => row.uf && row.cidade)
    .map((row) => ({
      uf: row.uf.toUpperCase(),
      estado: row.estado || '',
      cidade: row.cidade || '',
      endereco: row['endereço'] || row.endereco || '',
      cep: String(row.cep || '').replace(/\D/g, ''),
      megaPolo: String(row.mega_polo || '').trim().toLowerCase() === 'sim',
    }));
}

module.exports = { parsePolos };
