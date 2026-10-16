//@target illustrator
/*
 * AlignerParagraphesParalleles.jsx — v1.0.0
 * Aligner les paragraphes de textes parallèles / Align parallel paragraphs
 *
 * FR : Mise en page bilingue ou multilingue (français | arabe, FR | EN | DE…) :
 *      chaque langue est dans son propre bloc de texte et les paragraphes
 *      correspondants doivent commencer à la même hauteur, alors que leurs
 *      longueurs diffèrent. Illustrator n'a rien pour cela : il faut régler
 *      l'espace avant de chaque paragraphe à la main et tout refaire dès que le
 *      texte change. Ce script mesure la ligne de base réelle du début de chaque
 *      paragraphe dans chaque bloc, puis ajoute juste l'espace avant nécessaire
 *      pour que les paragraphes de même rang soient alignés sur la même ligne de
 *      base. L'espacement d'origine est mémorisé : on peut le rétablir ou
 *      recalculer après une modification du texte.
 * EN : Bilingual or multilingual layouts (French | Arabic, FR | EN | DE…): each
 *      language sits in its own text frame and matching paragraphs must start
 *      at the same height although their lengths differ. Illustrator has no
 *      tool for this: you tweak each paragraph's Space Before by hand and redo
 *      it whenever the text changes. This script measures the real baseline of
 *      the start of every paragraph in every frame, then adds just the Space
 *      Before needed so paragraphs of the same rank share the same baseline.
 *      Original spacing is stored so it can be restored or recomputed.
 *
 * Auteur / Author : Amirouche Amwanes — Licence MIT / MIT License
 * Cible / Target : Adobe Illustrator CC 2018+ (ExtendScript ES3). Non testé dans Illustrator.
 * Aucun appel réseau, aucune collecte de données. / No network calls, no data collection.
 */

/* ===================================================================== */
/*  1. CŒUR (pur, sans Illustrator) / PURE CORE (no Illustrator)          */
/* ===================================================================== */

var APP_CORE = (function () {
    var TAG_OPEN = "[APP1:", TAG_CLOSE = "]";
    var PT_MM = 25.4 / 72;

    // Découpe le contenu en paragraphes (séparateur \r d'Illustrator).
    // Splits contents into paragraphs (Illustrator uses \r).
    function splitParas(contents) {
        var s = String(contents).replace(/\n/g, "\r"), out = [], start = 0, i;
        var parts = s.split("\r");
        for (i = 0; i < parts.length; i++) {
            out.push({ index: i, start: start, text: parts[i], blank: isBlank(parts[i]) });
            start += parts[i].length + 1;
        }
        return out;
    }

    // Paragraphe vide ou fait seulement de blancs / empty or whitespace-only paragraph
    function isBlank(t) { return !/[^\s\u00A0\u2009\u202F\u200B\u200E\u200F\u0003\uFEFF]/.test(String(t)); }

    // Interlignage d'une ligne = le plus grand des caractères (interlignage « roman »).
    // Line leading = largest character leading (roman leading model).
    function lineLeading(runs, autoAmount) {
        var best = 0, i, v, amt = (autoAmount > 0) ? autoAmount : 120;
        for (i = 0; i < runs.length; i++) {
            v = runs[i].autoLeading ? runs[i].size * amt / 100 : runs[i].leading;
            if (v > best) best = v;
        }
        return best;
    }

    // Position relative (vers le bas, en pt) de la 1re ligne de base de chaque paragraphe.
    // Relative downward offset (pt) of each paragraph's first baseline, paragraph 0 = 0.
    // paras[k] = { spaceBefore, spaceAfter, lines: [leading of each line] }
    function modelOffsets(paras) {
        var r = [], last = 0, k, j, L;
        for (k = 0; k < paras.length; k++) {
            L = paras[k].lines && paras[k].lines.length ? paras[k].lines : [paras[k].fallbackLeading || 0];
            if (k === 0) r[0] = 0;
            else r[k] = last + (paras[k - 1].spaceAfter || 0) + (paras[k].spaceBefore || 0) + L[0];
            last = r[k];
            for (j = 1; j < L.length; j++) last += L[j];
        }
        return r;
    }

    // Calcule les espaces à ajouter. ys[f][m] = ligne de base (y Illustrator, vers le haut)
    // du m-ième paragraphe non vide du bloc f. Seuls des espaces positifs sont ajoutés.
    // Computes extra space. ys[f][m] = baseline y (Illustrator, up = +) of the m-th
    // non-blank paragraph of frame f. Only positive space is ever added.
    function solve(ys, refIdx, moveFrames, tol) {
        var F = ys.length, M = Infinity, f, m, res = { shift: [], extras: [], count: 0, before: [], counts: [] };
        tol = tol || 0.01;
        for (f = 0; f < F; f++) { res.counts.push(ys[f].length); if (ys[f].length < M) M = ys[f].length; }
        if (!(M > 0) || M === Infinity) { res.count = 0; return res; }
        res.count = M;
        var adj = [], S = [];
        for (f = 0; f < F; f++) {
            res.shift[f] = 0;
            if (moveFrames && ys[refIdx].length) res.shift[f] = ys[refIdx][0] - ys[f][0];
            var base = moveFrames ? res.shift[f] : (ys[refIdx][0] - ys[f][0]);
            adj[f] = [];
            for (m = 0; m < M; m++) adj[f][m] = ys[f][m] + base;
            res.extras[f] = [0];
            S[f] = 0;
        }
        res.before[0] = moveFrames ? spread(column(ys, 0)) : 0;
        for (m = 1; m < M; m++) {
            var cur = [], T = Infinity;
            for (f = 0; f < F; f++) { cur[f] = adj[f][m] - S[f]; if (cur[f] < T) T = cur[f]; }
            res.before[m] = spread(cur);
            for (f = 0; f < F; f++) {
                var e = cur[f] - T;
                if (e < tol) e = 0;
                res.extras[f][m] = e;
                S[f] += e;
            }
        }
        res.total = S;
        return res;
    }
    function column(ys, m) { var a = [], f; for (f = 0; f < ys.length; f++) a.push(ys[f][m]); return a; }
    function spread(a) {
        var lo = Infinity, hi = -Infinity, i;
        for (i = 0; i < a.length; i++) { if (a[i] < lo) lo = a[i]; if (a[i] > hi) hi = a[i]; }
        return a.length ? hi - lo : 0;
    }

    // Note de l'objet : mémorise l'espacement d'origine. / Object note storing original spacing.
    // Format : [APP1:dy;p=v,p=v]
    function encodeNote(note, dy, origs) {
        var clean = stripNote(note), parts = [], k;
        for (k in origs) if (origs.hasOwnProperty(k)) parts.push(k + "=" + round(origs[k], 4));
        return clean + TAG_OPEN + round(dy, 4) + ";" + parts.join(",") + TAG_CLOSE;
    }
    function decodeNote(note) {
        var s = String(note || ""), a = s.indexOf(TAG_OPEN), b, body, i, kv, out;
        if (a < 0) return null;
        b = s.indexOf(TAG_CLOSE, a);
        if (b < 0) return null;
        body = s.substring(a + TAG_OPEN.length, b).split(";");
        out = { dy: parseFloat(body[0]) || 0, origs: {} };
        if (body[1]) {
            var items = body[1].split(",");
            for (i = 0; i < items.length; i++) {
                kv = items[i].split("=");
                if (kv.length === 2 && kv[0] !== "") out.origs[parseInt(kv[0], 10)] = parseFloat(kv[1]);
            }
        }
        return out;
    }
    function stripNote(note) {
        var s = String(note || ""), a = s.indexOf(TAG_OPEN), b;
        if (a < 0) return s;
        b = s.indexOf(TAG_CLOSE, a);
        if (b < 0) return s;
        return s.substring(0, a) + s.substring(b + TAG_CLOSE.length);
    }
    function round(v, d) { var p = Math.pow(10, d); return Math.round(v * p) / p; }
    function fmt(pt) { return round(pt, 2) + " pt (" + round(pt * PT_MM, 2) + " mm)"; }

    // Extrait court d'un texte pour la liste / short excerpt for lists
    function excerpt(t, n) {
        var s = String(t).replace(/[\r\n\u0003]+/g, " ").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
        n = n || 28;
        return s.length > n ? s.substring(0, n - 1) + "…" : s;
    }

    // Choix du plus bas élément d'une liste de boîtes [g, h, d, b] / lowest bottom of bounds
    function lowestBottom(boundsList) {
        var best = null, i;
        for (i = 0; i < boundsList.length; i++) if (best === null || boundsList[i][3] < best) best = boundsList[i][3];
        return best;
    }

    return { splitParas: splitParas, isBlank: isBlank, lineLeading: lineLeading, modelOffsets: modelOffsets,
             solve: solve, spread: spread, encodeNote: encodeNote, decodeNote: decodeNote, stripNote: stripNote,
             round: round, fmt: fmt, excerpt: excerpt, lowestBottom: lowestBottom, PT_MM: PT_MM };
})();

/* ===================================================================== */
/*  2. TEXTES (FR/EN) / STRINGS                                           */
/* ===================================================================== */

var APP_T = (function () {
    var loc = "";
    try { loc = String(app.locale || $.locale || ""); } catch (e) { loc = ""; }
    var fr = /^fr/i.test(loc);
    var FR = {
        title: "Aligner les paragraphes parallèles — v1.0.0",
        noDoc: "Aucun document ouvert.\nOuvrez un document puis relancez le script.",
        noSel: "Sélectionnez au moins deux blocs de texte (un par langue), par exemple le bloc français et le bloc arabe, puis relancez le script.",
        needTwo: "Il faut au moins deux blocs de texte utilisables.",
        frames: "Blocs sélectionnés (de gauche à droite)",
        ref: "Bloc de référence (ne bouge pas) :",
        method: "Méthode",
        measure: "Mesure réelle des lignes de base (précise, plus lente)",
        model: "Calcul par l'interlignage (rapide)",
        options: "Options",
        moveFrames: "Aligner aussi les premières lignes (déplace les autres blocs verticalement)",
        grow: "Agrandir les cadres de texte captif rectangulaires si le texte déborde",
        verify: "Vérifier après l'alignement (nouvelle mesure)",
        hint: "Les paragraphes vides sont ignorés. Les paragraphes sont associés par rang : 1er avec 1er, 2e avec 2e… Seul l'espace avant est augmenté ; l'espacement d'origine est mémorisé dans la note de chaque bloc.",
        copyTip: "Conseil : travaillez sur une copie du document.",
        analyse: "Analyser", apply: "Aligner", restore: "Rétablir l'espacement d'origine", cancel: "Fermer",
        working: "Mesure en cours…",
        skipped: "Ignorés : ",
        locked: "verrouillé ou masqué", path: "texte curviligne", threaded: "texte lié", columns: "colonnes", vertical: "texte vertical", empty: "vide",
        report: "Rapport",
        countsDiffer: "Attention : nombre de paragraphes différent selon les blocs ({c}). Seuls les {m} premiers sont alignés.",
        para: "Paragraphe", spreadNow: "écart actuel", add: "ajout",
        firstLine: "1re ligne",
        aligned: "{n} paragraphe(s) aligné(s) sur {f} blocs. Espace ajouté au total : {t}.",
        nothing: "Les paragraphes sont déjà alignés (écart inférieur à 0,01 pt).",
        overflow: "Texte en excès après alignement : ",
        grown: "Cadre agrandi : ",
        residual: "Vérification : écart maximal restant {r}.",
        residualBad: "Vérification : écart restant {r} — relancez Aligner ou passez en mesure réelle.",
        restored: "Espacement d'origine rétabli sur {n} bloc(s).",
        noTag: "Aucun bloc sélectionné n'a été aligné par ce script.",
        prevTag: "Déjà aligné par ce script : Aligner recalcule à partir de l'espacement d'origine.",
        measureFail: "Mesure impossible pour un paragraphe (texte en excès ?) : ",
        modelFail: "Lignes illisibles, passage en mesure réelle pour : ",
        undo: "Annuler : Ctrl+Z / Cmd+Z (une ou plusieurs fois), ou bouton « Rétablir l'espacement d'origine »."
    };
    var EN = {
        title: "Align parallel paragraphs — v1.0.0",
        noDoc: "No document is open.\nOpen a document and run the script again.",
        noSel: "Select at least two text frames (one per language), e.g. the English frame and the Arabic frame, then run the script again.",
        needTwo: "At least two usable text frames are needed.",
        frames: "Selected frames (left to right)",
        ref: "Reference frame (does not move):",
        method: "Method",
        measure: "Measure real baselines (accurate, slower)",
        model: "Compute from leading (fast)",
        options: "Options",
        moveFrames: "Also align first lines (moves the other frames vertically)",
        grow: "Enlarge rectangular area-type frames if text overflows",
        verify: "Verify after aligning (measure again)",
        hint: "Empty paragraphs are ignored. Paragraphs are matched by rank: 1st with 1st, 2nd with 2nd… Only Space Before is increased; the original spacing is stored in each frame's note.",
        copyTip: "Tip: work on a copy of the document.",
        analyse: "Analyse", apply: "Align", restore: "Restore original spacing", cancel: "Close",
        working: "Measuring…",
        skipped: "Skipped: ",
        locked: "locked or hidden", path: "type on a path", threaded: "threaded text", columns: "columns", vertical: "vertical type", empty: "empty",
        report: "Report",
        countsDiffer: "Warning: paragraph counts differ between frames ({c}). Only the first {m} are aligned.",
        para: "Paragraph", spreadNow: "current offset", add: "added",
        firstLine: "1st line",
        aligned: "{n} paragraph(s) aligned across {f} frames. Total space added: {t}.",
        nothing: "Paragraphs are already aligned (offset below 0.01 pt).",
        overflow: "Overset text after aligning: ",
        grown: "Frame enlarged: ",
        residual: "Verification: largest remaining offset {r}.",
        residualBad: "Verification: remaining offset {r} — run Align again or use real measuring.",
        restored: "Original spacing restored on {n} frame(s).",
        noTag: "None of the selected frames was aligned by this script.",
        prevTag: "Already aligned by this script: Align recomputes from the original spacing.",
        measureFail: "Could not measure a paragraph (overset text?): ",
        modelFail: "Lines unreadable, switching to real measuring for: ",
        undo: "Undo: Ctrl+Z / Cmd+Z (once or several times), or the \"Restore original spacing\" button."
    };
    return fr ? FR : EN;
})();

function APP_f(s, o) { for (var k in o) if (o.hasOwnProperty(k)) s = s.split("{" + k + "}").join(o[k]); return s; }

/* ===================================================================== */
/*  3. ILLUSTRATOR                                                        */
/* ===================================================================== */

// Rassemble les blocs de texte de la sélection (groupes compris).
// Collects text frames from the selection (including inside groups).
function APP_collect(sel, out) {
    var i;
    if (!sel) return out;
    if (sel.typename === "TextRange") { try { APP_collect([sel.story.textFrames[0]], out); } catch (e) {} return out; }
    for (i = 0; i < sel.length; i++) {
        var it = sel[i];
        if (!it) continue;
        if (it.typename === "TextFrame") out.push(it);
        else if (it.typename === "GroupItem") APP_collect(it.pageItems, out);
    }
    return out;
}

function APP_isLocked(it) {
    var p = it;
    try {
        while (p && p.typename !== "Document") {
            if (p.locked === true || p.hidden === true) return true;
            if (p.typename === "Layer" && p.visible === false) return true;
            p = p.parent;
        }
    } catch (e) {}
    return false;
}

// Raison pour laquelle un bloc est ignoré, ou "" / reason a frame is skipped, or ""
function APP_rejectReason(tf) {
    if (APP_isLocked(tf)) return APP_T.locked;
    if (tf.kind === TextType.PATHTEXT) return APP_T.path;
    try { if (tf.nextFrame || tf.previousFrame) return APP_T.threaded; } catch (e) {}
    try { if (tf.kind === TextType.AREATEXT && tf.columnCount > 1) return APP_T.columns; } catch (e2) {}
    try { if (tf.orientation === TextOrientation.VERTICAL) return APP_T.vertical; } catch (e3) {}
    if (APP_CORE.isBlank(tf.contents)) return APP_T.empty;
    return "";
}

// Plage de texte du paragraphe p / text range of paragraph p
function APP_paraRange(tf, info, p) {
    try {
        var ps = tf.paragraphs;
        if (ps.length === info.length) return ps[p];
    } catch (e) {}
    try { return tf.characters[info[p].start]; } catch (e2) {}
    return null;
}

// Supprime dans un double tout ce qui suit le 1er caractère du paragraphe k et
// remplace ce caractère par un point posé sur la ligne de base.
// In a duplicate, removes everything after paragraph k's first character and
// replaces that character with a period sitting on the baseline.
function APP_truncateDup(dup, info, k) {
    var ps = null, j;
    try { ps = dup.paragraphs; if (ps.length !== info.length) ps = null; } catch (e) { ps = null; }
    if (ps) {
        for (j = info.length - 1; j > k; j--) { try { ps[j].contents = ""; } catch (e1) {} }
        ps[k].contents = ".";
        return;
    }
    // Repli caractère par caractère (lent) / per-character fallback (slow)
    var chars = dup.characters, n = chars.length, start = info[k].start;
    for (j = n - 1; j > start; j--) chars[j].remove();
    dup.characters[start].contents = ".";
}

// Bords de tous les tracés d'un contour vectorisé / bounds of every leaf of outlines
function APP_leafBounds(item, out) {
    var i;
    if (item.typename === "GroupItem") { for (i = 0; i < item.pageItems.length; i++) APP_leafBounds(item.pageItems[i], out); }
    else if (item.typename === "PathItem" || item.typename === "CompoundPathItem") out.push(item.geometricBounds);
    return out;
}

// Ligne de base réelle (y) du début du paragraphe k, mesurée sur un double vectorisé.
// Real baseline (y) of paragraph k's start, measured on an outlined duplicate.
function APP_measureBaseline(tf, info, k) {
    var dup = null, og = null, y = null;
    try {
        dup = tf.duplicate();
        APP_truncateDup(dup, info, k);
        og = dup.createOutline();
        dup = null; // remplacé par le contour / consumed by createOutline
        y = APP_CORE.lowestBottom(APP_leafBounds(og, []));
    } catch (e) { y = null; }
    try { if (og) og.remove(); } catch (e2) {}
    try { if (dup) dup.remove(); } catch (e3) {}
    return y;
}

// Interlignage de chaque ligne d'un paragraphe (modèle rapide).
// Leading of each line of a paragraph (fast model).
function APP_paraLines(range) {
    var res = [], lines, i, j, amt = 120;
    try { amt = range.paragraphAttributes.autoLeadingAmount || 120; } catch (e) {}
    lines = range.lines;
    for (i = 0; i < lines.length; i++) {
        var runs = [], ch = lines[i].characters;
        for (j = 0; j < ch.length; j++) {
            var ca = ch[j].characterAttributes;
            runs.push({ size: ca.size, leading: ca.leading, autoLeading: ca.autoLeading });
        }
        res.push(APP_CORE.lineLeading(runs, amt));
    }
    return res;
}
function APP_rangeLeading(range) {
    try {
        var ca = range.characterAttributes, amt = 120;
        try { amt = range.paragraphAttributes.autoLeadingAmount || 120; } catch (e) {}
        return ca.autoLeading ? ca.size * amt / 100 : ca.leading;
    } catch (e2) { return 0; }
}

// Lignes de base des paragraphes non vides d'un bloc. / Baselines of non-blank paragraphs.
// Retourne { ys: [...], idx: [indices], fail: bool }
function APP_baselines(tf, info, useModel, progress) {
    var ys = [], idx = [], k, fail = false;
    for (k = 0; k < info.length; k++) if (!info[k].blank) idx.push(k);
    if (useModel) {
        try {
            var paras = [], lastLead = 0;
            for (k = 0; k < info.length; k++) {
                var r = APP_paraRange(tf, info, k), pa = r.paragraphAttributes, L = [];
                if (!info[k].blank) L = APP_paraLines(r);
                if (!L.length) L = [APP_rangeLeading(r) || lastLead];
                lastLead = L[L.length - 1];
                paras.push({ spaceBefore: pa.spaceBefore || 0, spaceAfter: pa.spaceAfter || 0, lines: L });
            }
            var off = APP_CORE.modelOffsets(paras);
            var y0 = APP_measureBaseline(tf, info, idx[0]);
            if (y0 === null) throw new Error("y0");
            for (k = 0; k < idx.length; k++) ys.push(y0 - (off[idx[k]] - off[idx[0]]));
            if (progress) progress(idx.length);
            return { ys: ys, idx: idx, fail: false, model: true };
        } catch (eM) { ys = []; useModel = false; }
    }
    for (k = 0; k < idx.length; k++) {
        var y = APP_measureBaseline(tf, info, idx[k]);
        if (y === null) { fail = true; break; }
        ys.push(y);
        if (progress) progress(1);
    }
    return { ys: ys, idx: idx, fail: fail, model: false };
}

// Texte en excès (heuristique sur les lignes visibles) / overset text heuristic
function APP_isOverset(tf) {
    if (tf.kind !== TextType.AREATEXT) return false;
    try {
        var s = String(tf.contents).replace(/[\s\r\u0003]+$/, ""), ls = tf.lines;
        if (!s.length) return false;
        if (ls.length === 0) return true;
        var last = ls[ls.length - 1];
        return (last.characterOffset + last.length) < s.length - 1;
    } catch (e) { return false; }
}

// Agrandit vers le bas un cadre captif rectangulaire / grows a rectangular area frame downward
function APP_grow(tf, first) {
    var tp, pts, i, minY = Infinity, n = 0, step;
    try { tp = tf.textPath; pts = tp.pathPoints; } catch (e) { return false; }
    if (!pts || pts.length !== 4) return false;
    for (i = 0; i < 4; i++) if (pts[i].anchor[1] < minY) minY = pts[i].anchor[1];
    step = first > 0 ? first : 6;
    for (var loop = 0; loop < 60 && APP_isOverset(tf); loop++) {
        for (i = 0; i < 4; i++) {
            var p = pts[i];
            if (Math.abs(p.anchor[1] - minY) < 0.01) {
                p.anchor = [p.anchor[0], p.anchor[1] - step];
                p.leftDirection = [p.leftDirection[0], p.leftDirection[1] - step];
                p.rightDirection = [p.rightDirection[0], p.rightDirection[1] - step];
            }
        }
        minY -= step; n++; step = 6;
    }
    return n > 0;
}

// Remet l'espacement d'origine d'un bloc (si marqué) / restores a tagged frame
function APP_restoreFrame(tf) {
    var d = APP_CORE.decodeNote(tf.note), info, p;
    if (!d) return false;
    info = APP_CORE.splitParas(tf.contents);
    for (p in d.origs) if (d.origs.hasOwnProperty(p)) {
        var idx = parseInt(p, 10);
        if (idx < info.length) { var r = APP_paraRange(tf, info, idx); if (r) r.paragraphAttributes.spaceBefore = d.origs[p]; }
    }
    if (d.dy) tf.translate(0, -d.dy);
    tf.note = APP_CORE.stripNote(tf.note);
    return true;
}

// Analyse ou alignement complet / full analyse or align run
function APP_run(frames, opt, doApply, progress) {
    var T = APP_T, C = APP_CORE, lines = [], f, m, i;
    var infos = [], bl = [], tagged = false;
    if (doApply) { for (f = 0; f < frames.length; f++) if (APP_restoreFrame(frames[f])) tagged = true; }
    else { for (f = 0; f < frames.length; f++) if (C.decodeNote(frames[f].note)) tagged = true; }
    if (tagged && !doApply) lines.push(T.prevTag);
    for (f = 0; f < frames.length; f++) {
        infos[f] = C.splitParas(frames[f].contents);
        bl[f] = APP_baselines(frames[f], infos[f], opt.model, progress);
        if (bl[f].fail) lines.push(T.measureFail + C.excerpt(frames[f].contents) + " (" + T.para + " " + (bl[f].ys.length + 1) + ")");
    }
    var ys = []; for (f = 0; f < frames.length; f++) ys.push(bl[f].ys);
    var res = C.solve(ys, opt.ref, opt.moveFrames, 0.01);
    var counts = []; for (f = 0; f < frames.length; f++) counts.push(bl[f].idx.length);
    var differ = false; for (f = 1; f < counts.length; f++) if (counts[f] !== counts[0]) differ = true;
    if (differ) lines.push(APP_f(T.countsDiffer, { c: counts.join(" / "), m: res.count }));
    var total = 0, maxBefore = 0;
    for (m = 0; m < res.count; m++) {
        var adds = [];
        for (f = 0; f < frames.length; f++) adds.push(C.round(res.extras[f][m], 2));
        if (res.before[m] > maxBefore) maxBefore = res.before[m];
        if (m === 0 && !opt.moveFrames) continue;
        var label = m === 0 ? T.firstLine : T.para + " " + (m + 1);
        var extraTxt = m === 0 ? "" : "  " + T.add + " : " + adds.join(" | ") + " pt";
        lines.push(label + " — " + T.spreadNow + " " + C.fmt(res.before[m]) + extraTxt + "  « " + C.excerpt(infos[0][bl[0].idx[m]] ? infos[0][bl[0].idx[m]].text : "", 18) + " »");
    }
    for (f = 0; f < frames.length; f++) total += res.total ? res.total[f] : 0;
    if (!doApply) { if (maxBefore < 0.01 && res.count) lines.push(T.nothing); return lines; }

    // Application / apply
    for (f = 0; f < frames.length; f++) {
        var tf = frames[f], origs = {}, any = false, dy = res.shift[f] || 0;
        for (m = 1; m < res.count; m++) {
            var e = res.extras[f][m];
            if (!(e > 0)) continue;
            var p = bl[f].idx[m], r = APP_paraRange(tf, infos[f], p);
            if (!r) continue;
            var pa = r.paragraphAttributes, sb = pa.spaceBefore || 0;
            origs[p] = sb; pa.spaceBefore = sb + e; any = true;
        }
        if (Math.abs(dy) >= 0.01) { tf.translate(0, dy); any = true; } else dy = 0;
        if (any) tf.note = C.encodeNote(tf.note, dy, origs);
        if (APP_isOverset(tf)) {
            if (opt.grow && APP_grow(tf, res.total[f])) lines.push(T.grown + C.excerpt(tf.contents));
            if (APP_isOverset(tf)) lines.push(T.overflow + C.excerpt(tf.contents));
        }
    }
    try { app.redraw(); } catch (eR) {}
    lines.unshift(APP_f(T.aligned, { n: res.count, f: frames.length, t: C.fmt(total) }));
    if (opt.verify) {
        var ys2 = [];
        for (f = 0; f < frames.length; f++) ys2.push(APP_baselines(frames[f], C.splitParas(frames[f].contents), false, progress).ys);
        var worst = 0;
        for (m = (opt.moveFrames ? 0 : 1); m < res.count; m++) {
            var col = [];
            for (f = 0; f < frames.length; f++) {
                if (ys2[f].length <= m) continue;
                col.push(opt.moveFrames ? ys2[f][m] : ys2[f][m] - ys2[f][0] + ys2[opt.ref][0]);
            }
            var sp = C.spread(col); if (sp > worst) worst = sp;
        }
        lines.push(APP_f(worst <= 0.3 ? T.residual : T.residualBad, { r: C.fmt(worst) }));
    }
    lines.push(T.undo);
    return lines;
}

/* ===================================================================== */
/*  4. RÉGLAGES ET DIALOGUE / SETTINGS AND DIALOG                         */
/* ===================================================================== */

function APP_cfgFile() { return new File(Folder.userData + "/AlignerParagraphesParalleles.cfg"); }
function APP_loadCfg() {
    var c = { model: false, moveFrames: true, grow: true, verify: true }, f = APP_cfgFile();
    try {
        if (f.exists && f.open("r")) {
            var s = f.read(); f.close();
            var parts = s.split("\n");
            for (var i = 0; i < parts.length; i++) {
                var kv = parts[i].split("=");
                if (kv.length === 2 && c.hasOwnProperty(kv[0])) c[kv[0]] = (kv[1] === "1");
            }
        }
    } catch (e) {}
    return c;
}
function APP_saveCfg(c) {
    var f = APP_cfgFile();
    try {
        if (f.open("w")) {
            f.write("model=" + (c.model ? 1 : 0) + "\nmoveFrames=" + (c.moveFrames ? 1 : 0) + "\ngrow=" + (c.grow ? 1 : 0) + "\nverify=" + (c.verify ? 1 : 0));
            f.close();
        }
    } catch (e) {}
}

function APP_dialog(frames, skipped) {
    var T = APP_T, cfg = APP_loadCfg(), i;
    var w = new Window("dialog", T.title);
    w.orientation = "column"; w.alignChildren = ["fill", "top"];

    var pF = w.add("panel", undefined, T.frames); pF.alignChildren = ["fill", "top"];
    var lb = pF.add("listbox", undefined, []);
    lb.preferredSize = [460, 90];
    for (i = 0; i < frames.length; i++) {
        var n = APP_CORE.splitParas(frames[i].contents), cnt = 0;
        for (var k = 0; k < n.length; k++) if (!n[k].blank) cnt++;
        lb.add("item", (i + 1) + ". " + APP_CORE.excerpt(frames[i].contents, 40) + "  (" + cnt + " ¶)");
    }
    if (skipped.length) pF.add("statictext", undefined, T.skipped + skipped.join(" ; "), { multiline: true }).preferredSize = [460, 30];
    var gR = pF.add("group"); gR.add("statictext", undefined, T.ref);
    var dd = gR.add("dropdownlist", undefined, []);
    for (i = 0; i < frames.length; i++) dd.add("item", (i + 1) + ". " + APP_CORE.excerpt(frames[i].contents, 24));
    dd.selection = 0;

    var pM = w.add("panel", undefined, T.method); pM.alignChildren = ["left", "top"];
    var rMeas = pM.add("radiobutton", undefined, T.measure), rMod = pM.add("radiobutton", undefined, T.model);
    rMeas.value = !cfg.model; rMod.value = cfg.model;

    var pO = w.add("panel", undefined, T.options); pO.alignChildren = ["left", "top"];
    var cMove = pO.add("checkbox", undefined, T.moveFrames); cMove.value = cfg.moveFrames;
    var cGrow = pO.add("checkbox", undefined, T.grow); cGrow.value = cfg.grow;
    var cVer = pO.add("checkbox", undefined, T.verify); cVer.value = cfg.verify;
    var hint = pO.add("statictext", undefined, T.hint + "\n" + T.copyTip, { multiline: true }); hint.preferredSize = [460, 58];

    var pRep = w.add("panel", undefined, T.report); pRep.alignChildren = ["fill", "top"];
    var rep = pRep.add("edittext", undefined, "", { multiline: true, readonly: true, scrolling: true });
    rep.preferredSize = [460, 150];

    var gB = w.add("group"); gB.alignment = ["right", "top"];
    var bA = gB.add("button", undefined, T.analyse), bR = gB.add("button", undefined, T.restore);
    var bOk = gB.add("button", undefined, T.apply), bC = gB.add("button", undefined, T.cancel, { name: "cancel" });

    function opts() {
        var o = { model: rMod.value, moveFrames: cMove.value, grow: cGrow.value, verify: cVer.value, ref: dd.selection ? dd.selection.index : 0 };
        APP_saveCfg(o);
        return o;
    }
    function runWith(apply) {
        var o = opts(), done = 0, total = 0, f;
        for (f = 0; f < frames.length; f++) total += APP_CORE.splitParas(frames[f].contents).length;
        if (apply && o.verify) total *= 2;
        var pw = new Window("palette", T.working), pb = pw.add("progressbar", undefined, 0, Math.max(total, 1));
        pb.preferredSize = [300, 12];
        try { pw.show(); } catch (e0) {}
        var res;
        try { res = APP_run(frames, o, apply, function (n) { done += n; pb.value = Math.min(done, total); try { pw.update(); } catch (e1) {} }); }
        catch (e) { res = ["Erreur / Error : " + e]; }
        try { pw.close(); } catch (e2) {}
        rep.text = res.join("\n");
    }
    bA.onClick = function () { runWith(false); };
    bOk.onClick = function () { runWith(true); };
    bR.onClick = function () {
        var n = 0;
        for (var f = 0; f < frames.length; f++) if (APP_restoreFrame(frames[f])) n++;
        try { app.redraw(); } catch (e) {}
        rep.text = n ? APP_f(T.restored, { n: n }) : T.noTag;
    };
    w.show();
}

function APP_main() {
    var T = APP_T;
    if (app.documents.length === 0) { alert(T.noDoc); return; }
    var doc = app.activeDocument, all = APP_collect(doc.selection, []), frames = [], skipped = [], i, why;
    if (!all.length) { alert(T.noSel); return; }
    for (i = 0; i < all.length; i++) {
        why = APP_rejectReason(all[i]);
        if (why) skipped.push(APP_CORE.excerpt(all[i].contents, 16) + " (" + why + ")");
        else frames.push(all[i]);
    }
    if (frames.length < 2) { alert(T.needTwo + (skipped.length ? "\n" + T.skipped + skipped.join(" ; ") : "") + "\n\n" + T.noSel); return; }
    // De gauche à droite / left to right
    frames.sort(function (a, b) { return a.geometricBounds[0] - b.geometricBounds[0]; });
    APP_dialog(frames, skipped);
}

if (typeof app !== "undefined" && typeof APP_NO_MAIN === "undefined") {
    try { APP_main(); } catch (e) { alert("AlignerParagraphesParalleles : " + e); }
}
