# Algoritmi-lm18

Comandi da usare:
- `make` per compilare i sorgenti latex
- `make clean` per pulire
- `make web` per generare la versione web in `out/web`
- `make web-dev` per la versione web con server di sviluppo (http://localhost:5180), che si aggiorna a ogni salvataggio
- `make web-check` per controllare i sorgenti senza generare niente

La versione web usa [texweb](https://github.com/emanuelegaliano/texweb), da clonare accanto a questa repo (`../texweb`, con `npm install`). Se è altrove: `make web TEXWEB=/percorso/di/texweb/bin/texweb.js`.

A ogni push su `main` la GitHub Action in `.github/workflows/web.yml` compila il PDF e la versione web e li pubblica su GitHub Pages (in Settings → Pages la sorgente deve essere «GitHub Actions»). Il PDF è anche nel sito, come `Algoritmi.pdf`.

Le figure interattive della versione web sono in `widgets/` (il codice comune ai widget sugli alberi è in `widgets/lib/`): nel PDF ciascuna di queste figure resta la figura TikZ di sempre.
