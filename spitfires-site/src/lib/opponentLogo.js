// Maps an opponent team name to a logo file in /public/opponent_logos/.
//
// Drop a file named after the club's slug (lowercase, words joined by hyphens)
// and it appears automatically on the fixtures page. Missing logos are handled
// gracefully (the column stays hidden) — no code change needed to add one.
//
// Matching is tolerant of real-world opponent names:
//   - division suffixes are stripped        "Birmingham Lions B" -> birmingham-lions
//   - gender words are stripped (anywhere)   "Oxford Womens Blues" -> oxford-blues
//   - "and" is dropped                       "Warwick and Coventry Panthers" -> warwick-coventry-panthers
//   - falls back from specific to generic    "Cambridge Huskies" -> cambridge-huskies, then cambridge
//
// So a single "cambridge.png" covers every Cambridge team, while a specific
// "oxford-vikings.png" / "oxford-blues.png" still win for Oxford's two clubs.

const GENDER = new Set(['womens', 'women', 'mens', 'men', 'ladies', 'mixed'])
const TRAIL  = new Set(['a', 'b', 'c', 'd', 'e', '1s', '2s', '3s', 'ii', 'iii', 'dev', 'development', 'team'])
const EXTS   = ['png', 'svg', 'jpg']

function clubWords(name = '') {
  const words = name
    .toLowerCase()
    .replace(/[.'’]/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/\band\b/g, ' ')          // "warwick and coventry" -> "warwick coventry"
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(w => w && !GENDER.has(w))
  // Strip trailing division / team tokens (possibly several, e.g. "... B").
  while (words.length > 1 && TRAIL.has(words[words.length - 1])) words.pop()
  return words
}

// Ordered most-specific → most-generic candidate slugs.
export function opponentLogoCandidates(name = '') {
  const words = clubWords(name)
  const slugs = []
  for (let len = words.length; len >= 1; len--) slugs.push(words.slice(0, len).join('-'))
  return [...new Set(slugs)]
}

// Flat list of candidate URLs (each slug × each extension), tried in order.
export function opponentLogoSources(name) {
  return opponentLogoCandidates(name).flatMap(slug =>
    EXTS.map(ext => `/opponent_logos/${slug}.${ext}`)
  )
}
