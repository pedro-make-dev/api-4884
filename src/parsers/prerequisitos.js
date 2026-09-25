// Converte o texto exportado do Google Doc de pré-requisitos em dados estruturados.
// O documento tem seções no padrão (com variações e typos):
//   "2º GRADUAÇÃO EM <CURSO> – DURAÇÃO DO CURSO – 12 MESES:"
// seguidas de uma lista de formações aceitas.

const HEADER_RE = /2\s*[ºª°]?\s*GRADUA[ÇC][ÃA]O\s+EM\s+(.+)/i;
const MONTHS_RE = /(\d+)\s*MESES/i;
// Separa o nome do curso do trecho de duração ("– DURAÇÃO..." / "- TEMPO...").
const NAME_SPLIT_RE = /\s*[–—-]+\s*(?:DURA[ÇC]|TEMPO)/i;

// Corrige typos conhecidos do documento original nos nomes de curso.
function fixTypos(name) {
  return name
    .replace(/\s+/g, ' ')
    .replace(/ADMINMISTRA/gi, 'ADMINISTRA')
    .replace(/ÇAÕ/g, 'ÇÃO')
    .replace(/CIVÍL/g, 'CIVIL');
}

function cleanLine(line) {
  return line
    .replace(/\*\*/g, '')
    .replace(/^[\s\-–—•*●▪\t]+/, '')
    .replace(/[\s:]+$/, '')
    .trim();
}

function parsePrerequisitos(text) {
  const lines = text.split(/\r?\n/);
  const sections = [];
  let current = null;

  for (const rawLine of lines) {
    const line = cleanLine(rawLine);
    if (!line) continue;

    const headerMatch = line.match(HEADER_RE);
    if (headerMatch) {
      if (current && current.formacoesAceitas.length > 0) sections.push(current);
      const rest = headerMatch[1];
      const monthsMatch = rest.match(MONTHS_RE);
      const curso = fixTypos(rest.split(NAME_SPLIT_RE)[0].replace(/[\s:–—-]+$/, '').trim());
      current = {
        curso,
        duracaoMeses: monthsMatch ? parseInt(monthsMatch[1], 10) : null,
        formacoesAceitas: [],
      };
      continue;
    }

    if (!current) continue; // ignora título/preâmbulo antes da primeira seção
    if (/TABELA DE PR[ÉE]-?REQUISITOS/i.test(line)) continue;
    if (line.length < 3) continue;

    current.formacoesAceitas.push(line);
  }
  if (current && current.formacoesAceitas.length > 0) sections.push(current);

  return sections;
}

module.exports = { parsePrerequisitos };
