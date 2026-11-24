# Borger Wedge Atelier

The contour editor of the Borger Akkadian fonts (electronic Babylonian Library), as a web page:
https://electronicbabylonianliterature.github.io/borger-atelier/

This repository holds only the program. The signs and every edit are kept in the private repository
`ElectronicBabylonianLiterature/ebl-api-data-preparation` (branch `atelier`, folder `borger-fonts/pipeline/`) and are
read and written with your own GitHub token, which stays in your browser. Each save is a commit on that branch, and
every push there builds the fonts (GitHub Actions, workflow "Borger fonts").

The page is generated: edit it in the private repository (`borger-fonts/pipeline/atelier/`, `make_page.py`,
`make_site.py`), not here.

Libraries: polygon-clipping (MIT), clipper-lib (Boost Software License).
