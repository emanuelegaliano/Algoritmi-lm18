MAIN = "Algoritmi"
OUTDIR = out

# texweb: https://github.com/emanuelegaliano/texweb, clonato accanto a questa repo
TEXWEB ?= ../texweb/bin/texweb.js
WEBDIR = $(OUTDIR)/web

.PHONY: all clean web web-dev web-check

all:
	mkdir -p $(OUTDIR)
	latexmk -pdf \
		-interaction=nonstopmode \
		-synctex=1 \
		-shell-escape \
		-outdir=$(OUTDIR) \
		$(MAIN).tex
	cp $(OUTDIR)/$(MAIN).pdf .

# versione web: sito statico in out/web
web:
	node $(TEXWEB) build . --out $(WEBDIR)

# versione web con server di sviluppo, si aggiorna a ogni salvataggio
web-dev:
	node $(TEXWEB) dev .

# controlla i sorgenti senza generare niente
web-check:
	node $(TEXWEB) check .

clean:
	latexmk -C -outdir=$(OUTDIR)
	rm -rf $(OUTDIR) .texweb
