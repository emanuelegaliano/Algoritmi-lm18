// utilità comuni ai widget (questa cartella non ha index.js, quindi non è un widget)

// KaTeX non ha il maiuscoletto: i nomi delle operazioni si scrivono con l'iniziale di ogni parola
// in maiuscolo normale e il resto in maiuscolo più piccolo, come nella configurazione di texweb
export const sc = (word) => `\\text{${word.replace(/([A-Za-z])([A-Za-z]*)/g,
  (_, first, rest) => `${first.toUpperCase()}${rest ? `{\\footnotesize ${rest.toUpperCase()}}` : ''}`)}}`;

// un numero per le formule: interi così come sono, gli altri con al più due decimali
export const num = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, ''));
