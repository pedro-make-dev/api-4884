// Normaliza texto para matching tolerante: minúsculas, sem acentos, sem pontuação.
function normalize(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Match flexível: um contém o outro, ou todos os tokens da consulta aparecem no alvo.
function fuzzyMatch(query, target) {
  const q = normalize(query);
  const t = normalize(target);
  if (!q || !t) return false;
  if (t.includes(q) || q.includes(t)) return true;
  const tokens = q.split(' ').filter((tok) => tok.length > 1);
  return tokens.length > 0 && tokens.every((tok) => t.includes(tok));
}

module.exports = { normalize, fuzzyMatch };
