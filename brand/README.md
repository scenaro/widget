# Kit de marque Scenaro

Source unique, versionnée dans le dépôt. Les applications ne lisent pas `.sandbox` au runtime.

## Géométrie

Un seul tracé, `viewBox="0 0 160 140"`, `fill-rule="evenodd"` :

`M80 9 A70 61 0 1 1 80 131 A70 61 0 1 1 80 9 Z M90.5 18.5 A51.5 46 0 1 0 90.5 110.5 A51.5 46 0 1 0 90.5 18.5 Z`

Anneau fermé asymétrique : matière plus épaisse en bas à gauche, ouverture décentrée en haut à droite. Le mot `scenaro` est en Sora 700, minuscules, interlettrage −0,04 em, sans étirement. Fichier local : `fonts/sora-latin-700.woff2` (OFL, voir `fonts/OFL.txt`).

| Token | Valeur |
| --- | --- |
| Encre | `#2e2b35` |
| Nuit | `#0f0e12` |
| Crème | `#f4f0eb` |
| Toile | `#faf9f7` |
| Aube | `linear-gradient(135deg, #f2c94c, #eb6eaf)` |

Navigation et loader de base : encre sur clair, crème sur sombre. Aube est un accent de marque, pas la couleur des boutons. Le dégradé voix rose / orchidée / violet reste un état de conversation.

## Loader

Symbole élastique à gauche, `scenaro` fixe à droite, libellé d’état éventuel en dessous. Boucle `scenaro-elastic` de 3 s, `ease-in-out`, origine `80px 125px`. Le mot ne bouge pas. `prefers-reduced-motion: reduce` laisse la même composition, figée.

Tailles : `compact` (15 px, attente locale), `standard` (22 px, panneau), `large` (36 px, plein écran). Le lockup entier est mesuré, pas un carré `size-*`. Démonter le loader à la réussite, à l’erreur ou à l’annulation, sans attendre la fin de la boucle.

## Consommation

Builds indépendants, chemin relatif depuis la racine du dépôt :

- React : `brand/react/index.tsx` exporte `ScenaroMark`, `ScenaroLockup`, `ScenaroLoader`. Importer aussi `brand/scenaro-loader.css`. React 18+ est une peer dependency optionnelle.
- HTML : `scenaroLoaderMarkup` et `scenaroLockupMarkup` dans `brand/html/loader.js`, avec la même feuille CSS. Pour une iframe `srcdoc`, inliner la CSS et la police (le fichier woff2 fait ~15 Ko) afin de ne pas bloquer sur un réseau de polices.
- Fichiers : `brand/assets/` (symbole et lockup clair, sombre, Aube, favicon SVG, PNG 16/32/48, ICO, PNG email).

Aperçu local : ouvrir `brand/preview.html`. Vérifier le kit : `node --test brand/test/kit.test.mjs`.
