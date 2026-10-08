# ipcalc

Calculateur de réseaux IPv4 en application web progressive (PWA), aux couleurs du Système de design de l'État (DSFR). Il reprend les fonctionnalités du calculateur [ipcalc de Krischan Jodies](https://jodies.de/ipcalc).

L'application fonctionne entièrement dans le navigateur. Après la première visite, elle marche aussi sans connexion. Aucune donnée saisie ne quitte l'appareil.

## Fonctionnalités

- Saisie d'une adresse (hôte ou réseau) et d'un masque, sous forme de préfixe (`24`, `/24`), de masque pointé (`255.255.255.0`) ou de wildcard (`0.0.0.255`). On peut aussi écrire `192.168.0.1/24` directement dans le champ adresse.
- Champs vides : l'adresse par défaut est 192.168.0.1 et le masque par défaut est celui de la classe de l'adresse (comme ipcalc).
- Résultat : adresse, masque, wildcard, réseau, broadcast, hôte min, hôte max, nombre d'hôtes, classe (A à E) et nature de la plage. Les plages reconnues sont : privée RFC 1918, CGNAT, boucle locale, APIPA, documentation, multicast, réservée, etc.
- Représentation binaire colorée : bits de classe, partie réseau et partie hôte, avec un espace à la frontière du masque. Elle peut être masquée.
- Cas particuliers : /31 lien point à point (RFC 3021) et /32 route d'hôte.
- Second masque facultatif :
  - plus long que le premier : liste des sous-réseaux avec le total des sous-réseaux et des hôtes (affichage limité aux 1 024 premiers) ;
  - plus court : le sur-réseau.
- « Se déplacer vers » : réseau précédent ou suivant, en gardant la position de l'hôte dans le réseau.
- Lien partageable : les paramètres `?host=…&mask1=…&mask2=…` sont ceux de jodies.de.
- Copie du résultat au format texte, dans la disposition d'ipcalc.
- Thèmes clair, sombre ou système (paramètres d'affichage du DSFR). Affichage adapté au mobile.
- Installation en application (bouton « Installer l'application » quand le navigateur le propose) et fonctionnement hors ligne grâce au service worker.

## Utilisation

En ligne, sur GitHub Pages : https://guiraudjb.github.io/ipcalc/

En local, il suffit de n'importe quel serveur statique. Le service worker ne fonctionne pas en `file://`.

```bash
python3 -m http.server 8000
# puis http://localhost:8000/
```

## Développement

| Fichier | Rôle |
| --- | --- |
| `ipcalc.js` | Moteur de calcul pur, sans dépendance (navigateur et Node) |
| `app.js` | Interface : formulaire, rendu, copie, installation PWA |
| `index.html`, `styles.css` | Page DSFR et styles complémentaires (jetons de couleur DSFR) |
| `sw.js`, `manifest.webmanifest`, `icons/` | PWA |
| `dsfr/` | Sous-ensemble du DSFR v1.14.3 embarqué (CSS, JS, polices, icônes utilisées) |
| `tools/maj_cache.py` | Regénère la liste des fichiers mis en cache et la version du cache |
| `test/` | Tests du moteur |

```bash
node --test test/*.test.js   # tests du moteur
python3 tools/maj_cache.py   # à lancer après toute modification, avant de pousser
```

## Crédits et licences

- Fonctionnalités inspirées d'[ipcalc](https://jodies.de/ipcalc) de Krischan Jodies (GPL). Le code est réécrit et ne reprend pas celui d'origine.
- [Système de design de l'État](https://www.systeme-de-design.gouv.fr/) (DSFR), licence MIT. La police Marianne et la marque de l'État sont réservées aux sites de l'État.
