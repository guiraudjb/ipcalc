#!/usr/bin/env python3
"""Met à jour la liste des fichiers mis en cache par sw.js et la version du cache.

À lancer après toute modification de l'application : python3 tools/maj_cache.py
La version dérive du contenu des fichiers : le cache n'est renouvelé que si quelque chose a changé.
"""
import hashlib
import json
import re
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
FICHIERS = ['./', 'index.html', 'app.js', 'ipcalc.js', 'styles.css', 'manifest.webmanifest']
DOSSIERS = ['icons', 'dsfr']
EXCLUS = ('.woff',)  # les navigateurs actuels n'utilisent que les .woff2

liste = list(FICHIERS)
for dossier in DOSSIERS:
    for f in sorted((RACINE / dossier).rglob('*')):
        if f.is_file() and not f.name.endswith(EXCLUS) and f.suffix != '.md':
            liste.append(f.relative_to(RACINE).as_posix())

empreinte = hashlib.sha256()
for f in liste:
    if f != './':
        empreinte.update(f.encode())
        empreinte.update((RACINE / f).read_bytes())
version = empreinte.hexdigest()[:10]

sw = RACINE / 'sw.js'
texte = sw.read_text(encoding='utf-8')
texte = re.sub(r"const VERSION = '[^']*';", "const VERSION = '{}';".format(version), texte)
texte = re.sub(r"const ASSETS = \[.*?\];", 'const ASSETS = ' + json.dumps(liste, indent=2) + ';', texte, flags=re.S)
sw.write_text(texte, encoding='utf-8')
print('sw.js : {} fichiers, version {}'.format(len(liste), version))
