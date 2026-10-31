// configurazione della versione web (texweb)

// KaTeX non ha il maiuscoletto (\textsc): nelle formule si imita con l'iniziale di ogni parola
// in maiuscolo normale e il resto in maiuscolo più piccolo, ad esempio Table-Insert -> T(ABLE)-I(NSERT)
const sc = (word) => `\\text{${word.replace(/([A-Za-z])([A-Za-z]*)/g,
  (_, first, rest) => `${first.toUpperCase()}${rest ? `{\\footnotesize ${rest.toUpperCase()}}` : ''}`)}}`;

const operations = {
  Push: 'Push', Pop: 'Pop', StackEmpty: 'StackEmpty', MultiPop: 'MultiPop', MultiPush: 'MultiPush',
  Increment: 'Increment', Decrement: 'Decrement', SetBit: 'Set', ResetBit: 'Reset',
  TableInsert: 'Table-Insert', TableDelete: 'Table-Delete',
  Search: 'Search', Insert: 'Insert', Delete: 'Delete', Splay: 'Splay', Ruota: 'Ruota',
  PageRead: 'Page-Read', PageWrite: 'Page-Write', AllocateNode: 'Allocate-Node',
  BTreeSearch: 'B-Tree-Search', BTreeCreate: 'B-Tree-Create', BTreeInsert: 'B-Tree-Insert',
  BTreeInsertNonfull: 'B-Tree-Insert-Nonfull', BTreeSplitChild: 'B-Tree-Split-Child', BTreeDelete: 'B-Tree-Delete',
};

export default {
  main: 'Algoritmi.tex',
  title: 'Riassunti e Appunti di Algoritmi',
  author: 'Emanuele Galiano',
  // le segnalazioni dal pulsante «Segnala un errore» finiscono nelle issue di questa repo
  repository: 'emanuelegaliano/Algoritmi-lm18',
  // caso con testo a sinistra e figura a destra (capitolo sugli splay tree): «Caso (Zig).»
  boxes: { casofig: { title: 'Caso', numbered: false, style: 'plain', split: 'tcblower' } },
  katexMacros: Object.fromEntries(Object.entries(operations).map(([macro, word]) => [`\\${macro}`, sc(word)])),
};
