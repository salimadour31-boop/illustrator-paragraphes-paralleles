# Aligner les paragraphes parallèles — script Adobe Illustrator

**AlignerParagraphesParalleles.jsx** v1.0.0 — dans une mise en page bilingue ou multilingue (français | arabe, FR | EN | DE…), aligne **sur la même ligne de base** le début des paragraphes correspondants de chaque bloc de texte, en ajoutant juste l'espace avant nécessaire.
*In bilingual or multilingual layouts (French | Arabic, EN | FR | DE…), aligns the start of matching paragraphs of each text frame on the same baseline by adding just the Space Before needed (FR/EN dialog).*

## Le problème

Emballages, notices, menus, panneaux, documents officiels, plaquettes : chaque langue est dans son propre bloc, côte à côte, et chaque paragraphe doit commencer à la même hauteur que sa traduction. Mais les traductions n'ont pas la même longueur (l'arabe et le français, l'allemand et l'anglais…), donc les paragraphes se décalent au fil du texte. Dans Illustrator, la seule solution est de régler l'espace avant de chaque paragraphe à la main, à l'œil, et de tout refaire dès qu'un mot change.

## Ce que fait le script

1. Il associe les paragraphes **par rang** (1er avec 1er, 2e avec 2e…) dans les blocs sélectionnés, classés de gauche à droite ; les paragraphes vides sont ignorés.
2. Il **mesure la ligne de base réelle** du début de chaque paragraphe : sur un double temporaire du bloc, le texte est coupé après le début du paragraphe, remplacé par un point posé sur la ligne de base, puis vectorisé et mesuré ; le double est supprimé aussitôt. Cette mesure tient compte de tout ce qu'Illustrator fait réellement (interlignage, espace avant/après, composeur Moyen-Orient pour l'arabe, première ligne de base du cadre…).
   Une méthode **rapide** calcule les positions à partir de l'interlignage de chaque ligne (une seule mesure par bloc).
3. Pour chaque rang, il prend le paragraphe le plus bas et **augmente seulement l'espace avant** des autres pour les amener à la même ligne de base. Rien n'est jamais réduit, la mise en forme et le texte ne sont pas touchés.
4. En option, il **aligne aussi les premières lignes** en déplaçant verticalement les autres blocs sur le bloc de référence (au choix), **agrandit vers le bas** les cadres de texte captif rectangulaires si le texte déborde, et **vérifie** le résultat par une nouvelle mesure (écart restant affiché).

L'espacement d'origine et le déplacement sont mémorisés dans la note de chaque bloc (Fenêtre > Attributs) : **Rétablir l'espacement d'origine** remet tout comme avant, et relancer **Aligner** après une modification du texte repart de l'espacement d'origine (pas d'accumulation).

Le bouton **Analyser** affiche, sans rien modifier, l'écart actuel de chaque rang (en pt et en mm) et l'espace qui serait ajouté dans chaque bloc. Les nombres de paragraphes différents sont signalés (seuls les premiers rangs communs sont alignés).

Ignorés et signalés : blocs verrouillés ou masqués, textes curvilignes, textes liés ou en colonnes, textes verticaux, blocs vides.

## Pourquoi c'est nouveau

Vérifié le 16 octobre 2026 :

- **Illustrator** : aucune fonction native pour aligner des paragraphes d'un bloc sur ceux d'un autre bloc. Le panneau Alignement n'aligne que les boîtes des objets ; il n'y a pas de grille de ligne de base.
- **InDesign seulement** : la question revient sur Adobe Community (« 3-Column Multilingual Book », textes parallèles anglais/hébreu/grec) ; la réponse est le script *Align Parallel Paragraphs.js* publié dans ce fil, qui utilise l'API d'InDesign (marqueurs ancrés, paragraphes d'espacement) et ne fonctionne pas dans Illustrator. Aucun code n'en est repris.
- **GitHub** : aucune recherche (« parallel paragraphs illustrator », « align paragraphs text frames illustrator jsx », « bilingual illustrator script ») ne donne de script Illustrator.
- **Auteurs connus** : rien chez creold (le plus proche, AlignTextBaseline, aligne des textes de point d'une ligne sur leur ligne de base, pas des paragraphes de plusieurs lignes entre blocs ; MultiEditText édite le contenu), Hiroyuki Sato, John Wundes, Alexander Ladygin, wckdtall, Kelso Cartography, ni dans vexy-illustrator-scripts. Les outils de traduction de fichiers Illustrator (Asset Localiser…) remplacent le texte, ils n'alignent pas.
- Le code (mesure par vectorisation d'un double tronqué, calcul cumulatif des espaces, mémorisation dans la note) est entièrement original.

## Installation

- **Ponctuelle** : Fichier > Scripts > Autre script…, puis choisir `AlignerParagraphesParalleles.jsx`.
- **Permanente** : copier le fichier dans le dossier `Presets/<langue>/Scripts` d'Illustrator (par exemple `Adobe Illustrator 2026/Presets/fr_FR/Scripts`), puis redémarrer Illustrator. Le script apparaît dans Fichier > Scripts.

## Utilisation

1. **Travaillez sur une copie** du document.
2. Avec l'outil Sélection, sélectionnez les blocs à aligner (deux ou plus : un par langue ; ils peuvent être dans des groupes).
3. Lancez le script, choisissez le bloc de référence, la méthode et les options.
4. **Analyser** pour voir les écarts, puis **Aligner**.
5. Après une modification du texte, relancez simplement **Aligner**. Ctrl+Z / Cmd+Z annule (une ou plusieurs fois selon la version), ou utilisez **Rétablir l'espacement d'origine**.

Conseils : gardez un paragraphe par idée dans chaque langue (même nombre de paragraphes) ; si une traduction a un paragraphe de plus, ajoutez un paragraphe vide ou fusionnez-les.

Limites connues : un cadre de texte captif dont l'alignement vertical n'est pas « Haut » fausse la mesure ; la mesure place le point avec les attributs du premier caractère du paragraphe (une lettrine ou un premier mot plus grand décale légèrement la mesure) ; la méthode rapide suppose l'interlignage « roman » (le plus grand de la ligne) ; la détection du texte en excès est approximative ; le bas d'un point varie de quelques centièmes de point selon la police.

## Version cible et statut des tests

- Cible : Adobe Illustrator CC 2018 et versions plus récentes (ExtendScript), Windows et macOS.
- **Non testé dans Illustrator.**
- Vérifié sur l'ordinateur de développement :
  - syntaxe ES3 validée avec acorn ;
  - `node tests/test-core.js` : 30 tests (découpe des paragraphes, interlignage, modèle de positions, calcul des espaces sur 300 cas aléatoires de 2 à 4 blocs avec et sans déplacement, ajouts toujours positifs, notes) ;
  - `node tests/test-simulation.js` : 26 tests sur des objets Illustrator simulés (composition simulée avec habillage, double, vectorisation ; analyse sans modification, alignement par mesure et par calcul, relance sans accumulation, rétablissement, référence à droite, trois blocs de point, nombres de paragraphes différents, agrandissement et texte en excès, rejets, groupes, dialogue FR/EN). Ces simulations ne remplacent pas un essai réel.
- Aucun appel réseau, aucune collecte de données. Les réglages sont enregistrés localement dans `AlignerParagraphesParalleles.cfg` (dossier des données utilisateur).

## Licence

MIT — © 2026 Amirouche Amwanes. Voir [LICENSE](LICENSE).
