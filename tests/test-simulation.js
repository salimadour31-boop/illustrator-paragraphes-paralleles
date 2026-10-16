// Simulation des objets Illustrator (blocs, paragraphes, lignes, double, vectorisation).
// Ne remplace pas un essai réel. / Simulated Illustrator objects — not a substitute for a real test.
var fs = require("fs"), vm = require("vm"), path = require("path");
var src = fs.readFileSync(path.join(__dirname, "..", "AlignerParagraphesParalleles.jsx"), "utf8");
var pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log("ok   " + n); } else { fail++; console.log("FAIL " + n + (e !== undefined ? " -> " + JSON.stringify(e) : "")); } }

var TextType = { POINTTEXT: 0, AREATEXT: 1, PATHTEXT: 2 }, TextOrientation = { HORIZONTAL: 0, VERTICAL: 1 };
var outlinesAlive = 0;

// Moteur de composition simulé : c caractères par ligne, ascendante 0,8 × corps,
// 1re ligne de base = haut − ascendante ; lignes suivantes = − interlignage ;
// début de paragraphe = − (espace après précédent + espace avant + interlignage).
function mkFrame(o) {
    var f = { typename: "TextFrame", kind: o.kind, locked: false, hidden: false, parent: { typename: "Document" },
              orientation: TextOrientation.HORIZONTAL, nextFrame: null, previousFrame: null, columnCount: 1, note: "" };
    // Chaque paragraphe : { text, size, lead (null = auto), sb, sa }
    f._p = o.paras.map(function (p) { return { text: p.text, size: p.size || 10, lead: p.lead === undefined ? null : p.lead, sb: p.sb || 0, sa: p.sa || 0 }; });
    f._cpl = o.cpl || 30; f._x = o.x || 0;
    if (o.kind === TextType.AREATEXT) {
        f.textPath = { pathPoints: [[0, o.top], [100, o.top], [100, o.bottom], [0, o.bottom]].map(function (a) {
            return { anchor: a.slice(), leftDirection: a.slice(), rightDirection: a.slice() }; }) };
    } else f._top = o.top;
    f.geometricBounds = [f._x, o.top, f._x + 100, o.bottom || 0];
    function top() { if (!f.textPath) return f._top; var m = -Infinity; f.textPath.pathPoints.forEach(function (p) { if (p.anchor[1] > m) m = p.anchor[1]; }); return m; }
    function bottom() { if (!f.textPath) return -Infinity; var m = Infinity; f.textPath.pathPoints.forEach(function (p) { if (p.anchor[1] < m) m = p.anchor[1]; }); return m; }
    function leadOf(p) { return p.lead === null ? p.size * 1.2 : p.lead; }
    function wrap(t, cpl) { var out = [], i = 0; if (!t.length) return [""]; while (i < t.length) { out.push(t.substr(i, cpl)); i += cpl; } return out; }
    // Mise en page : [{p, text, base, size, lead, start}]
    f._layout = function () {
        var L = [], y = null, k, j, off = 0;
        for (k = 0; k < f._p.length; k++) {
            var p = f._p[k], w = wrap(p.text, f._cpl), ld = leadOf(p);
            for (j = 0; j < w.length; j++) {
                if (y === null) y = top() - 0.8 * p.size;
                else if (j === 0) y -= f._p[k - 1].sa + p.sb + ld;
                else y -= ld;
                L.push({ p: k, text: w[j], base: y, size: p.size, lead: ld, start: off + j * f._cpl, visible: !f.textPath || (y - 0.2 * p.size >= bottom()) });
            }
            off += p.text.length + 1;
        }
        return L;
    };
    Object.defineProperty(f, "contents", { get: function () { return f._p.map(function (p) { return p.text; }).join("\r"); } });
    function charAttrs(p) { return { size: p.size, leading: leadOf(p), autoLeading: p.lead === null }; }
    function paraRange(k) {
        var p = f._p[k];
        var r = { paragraphAttributes: { get spaceBefore() { return p.sb; }, set spaceBefore(v) { p.sb = v; },
                                         get spaceAfter() { return p.sa; }, autoLeadingAmount: 120 },
                  characterAttributes: charAttrs(p) };
        Object.defineProperty(r, "contents", { get: function () { return p.text; }, set: function (v) { p.text = String(v); } });
        Object.defineProperty(r, "lines", { get: function () {
            return f._layout().filter(function (l) { return l.p === k; }).map(function (l) {
                return { characters: l.text.split("").map(function () { return { characterAttributes: charAttrs(p) }; }) }; });
        } });
        return r;
    }
    Object.defineProperty(f, "paragraphs", { get: function () { var a = []; for (var k = 0; k < f._p.length; k++) a.push(paraRange(k)); return a; } });
    Object.defineProperty(f, "lines", { get: function () {
        return f._layout().filter(function (l) { return l.visible; }).map(function (l) { return { characterOffset: l.start, length: l.text.length }; }); } });
    f.translate = function (dx, dy) {
        if (f.textPath) f.textPath.pathPoints.forEach(function (p) { p.anchor[1] += dy; p.leftDirection[1] += dy; p.rightDirection[1] += dy; });
        else f._top += dy;
    };
    f.duplicate = function () {
        var d = mkFrame({ kind: f.kind, paras: [], cpl: f._cpl, top: top(), bottom: bottom(), x: f._x });
        d._p = f._p.map(function (p) { return { text: p.text, size: p.size, lead: p.lead, sb: p.sb, sa: p.sa }; });
        if (f.textPath) d.textPath = { pathPoints: f.textPath.pathPoints.map(function (q) { return { anchor: q.anchor.slice(), leftDirection: q.leftDirection.slice(), rightDirection: q.rightDirection.slice() }; }) };
        return d;
    };
    f.createOutline = function () {
        var items = [];
        f._layout().forEach(function (l) {
            if (!l.visible) return;
            l.text.split("").forEach(function (c, i) {
                if (c === " ") return;
                var desc = /[gpqy]/.test(c) ? 0.22 : (c === "." ? 0 : 0);
                var h = c === "." ? 0.1 : 0.7;
                items.push({ typename: "PathItem", geometricBounds: [i * 5, l.base + h * l.size, i * 5 + 4, l.base - desc * l.size] });
            });
        });
        outlinesAlive++;
        return { typename: "GroupItem", pageItems: items, remove: function () { outlinesAlive--; } };
    };
    f.remove = function () {};
    f._baselines = function () { var L = f._layout(), out = [], seen = {}; L.forEach(function (l) { if (!seen[l.p] && f._p[l.p].text.replace(/\s/g, "").length) { seen[l.p] = 1; out.push(l.base); } }); return out; };
    return f;
}

function load() {
    var ctx = { APP_NO_MAIN: true, TextType: TextType, TextOrientation: TextOrientation,
                app: { locale: "fr_FR", redraw: function () {} }, $: { locale: "fr_FR" } };
    vm.createContext(ctx); vm.runInContext(src, ctx); return ctx;
}
var X = load();

function spreadRows(frames, rel) {
    var bs = frames.map(function (f) { return f._baselines(); }), M = Math.min.apply(null, bs.map(function (b) { return b.length; })), w = 0;
    for (var m = 0; m < M; m++) {
        var col = bs.map(function (b, i) { return rel ? b[m] - b[0] + bs[0][0] : b[m]; });
        w = Math.max(w, Math.max.apply(null, col) - Math.min.apply(null, col));
    }
    return w;
}
var LONG = "Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore";
var AR = "هذا نص عربي طويل نسبيا يستعمل لاختبار المحاذاة بين الفقرات المتوازية في التصميم";

function scenario() {
    var fr = mkFrame({ kind: TextType.AREATEXT, top: 500, bottom: 100, x: 0, cpl: 30,
        paras: [{ text: "Titre français", size: 18, lead: 22 }, { text: LONG, size: 10, sb: 6 }, { text: "" }, { text: "Court.", size: 10, sb: 6 }, { text: LONG + " " + LONG, size: 10, sb: 6 }] });
    var ar = mkFrame({ kind: TextType.AREATEXT, top: 495, bottom: 100, x: 120, cpl: 24,
        paras: [{ text: "عنوان عربي طويل جدا على سطرين", size: 18, lead: 22 }, { text: "قصير", size: 11, sb: 4 }, { text: AR + " " + AR, size: 11, sb: 4 }, { text: "النهاية", size: 11, sb: 4 }] });
    return [fr, ar];
}

// 1. Analyse : ne modifie rien
var S = scenario(), before = JSON.stringify(S.map(function (f) { return f._p; }));
var rep = X.APP_run(S, { model: false, moveFrames: true, grow: true, verify: false, ref: 0 }, false, null);
ok("analyse sans modification", JSON.stringify(S.map(function (f) { return f._p; })) === before && S[1].textPath.pathPoints[0].anchor[1] === 495);
ok("analyse : rapport par paragraphe", rep.join("\n").indexOf("Paragraphe 2") >= 0 && rep.join("\n").indexOf("1re ligne") >= 0, rep);
ok("aucun contour oublié", outlinesAlive === 0, outlinesAlive);
ok("état initial désaligné", spreadRows(S, false) > 5, spreadRows(S, false));

// 2. Alignement par mesure réelle
rep = X.APP_run(S, { model: false, moveFrames: true, grow: true, verify: true, ref: 0 }, true, null);
ok("mesure : lignes de base alignées (< 0,01 pt)", spreadRows(S, false) < 0.01, spreadRows(S, false));
ok("mesure : seul l'espace avant augmente", S[0]._p[1].sb >= 6 && S[1]._p[1].sb >= 4 && S[0]._p[0].sb === 0);
ok("mesure : bloc arabe déplacé de la différence de 1re ligne", Math.abs(S[1].textPath.pathPoints[0].anchor[1] - 500) < 1e-9, S[1].textPath.pathPoints[0].anchor[1]);
ok("note posée", X.APP_CORE.decodeNote(S[1].note) !== null && X.APP_CORE.decodeNote(S[1].note).dy === 5, S[1].note);
ok("rapport de vérification", /Vérification : écart maximal restant 0 pt/.test(rep.join("\n")), rep);
ok("aucun contour oublié après", outlinesAlive === 0);

// 3. Relancer = même résultat (repart de l'origine)
var snap = JSON.stringify(S.map(function (f) { return f._p.map(function (p) { return p.sb; }); }));
X.APP_run(S, { model: false, moveFrames: true, grow: true, verify: false, ref: 0 }, true, null);
ok("relance idempotente", JSON.stringify(S.map(function (f) { return f._p.map(function (p) { return p.sb; }); })) === snap && spreadRows(S, false) < 0.01);

// 4. Rétablir
ok("rétablir", X.APP_restoreFrame(S[0]) && X.APP_restoreFrame(S[1]));
ok("espacement d'origine rétabli", JSON.stringify(S.map(function (f) { return f._p; })) === before && Math.abs(S[1].textPath.pathPoints[0].anchor[1] - 495) < 1e-9);
ok("notes nettoyées", S[0].note === "" && S[1].note === "");

// 5. Modèle rapide
S = scenario();
X.APP_run(S, { model: true, moveFrames: true, grow: true, verify: false, ref: 0 }, true, null);
ok("modèle : lignes de base alignées", spreadRows(S, false) < 0.01, spreadRows(S, false));

// 6. Sans déplacer les blocs : alignement relatif
S = scenario();
X.APP_run(S, { model: false, moveFrames: false, grow: true, verify: false, ref: 0 }, true, null);
ok("relatif : blocs non déplacés", S[1].textPath.pathPoints[0].anchor[1] === 495);
ok("relatif : écarts constants", spreadRows(S, true) < 0.01, spreadRows(S, true));

// 7. Référence = bloc de droite
S = scenario();
X.APP_run(S, { model: false, moveFrames: true, grow: true, verify: false, ref: 1 }, true, null);
ok("référence à droite : bloc arabe fixe, bloc français descend", S[1].textPath.pathPoints[0].anchor[1] === 495 && Math.abs(S[0].textPath.pathPoints[0].anchor[1] - 495) < 1e-9 && spreadRows(S, false) < 0.01);

// 8. Trois langues, texte de point
var a = mkFrame({ kind: TextType.POINTTEXT, top: 300, x: 0, cpl: 1000, paras: [{ text: "One", size: 12 }, { text: "Two", size: 12, sb: 3 }, { text: "Three", size: 20 }] });
var b = mkFrame({ kind: TextType.POINTTEXT, top: 300, x: 50, cpl: 1000, paras: [{ text: "Un", size: 12 }, { text: "Deux", size: 16 }, { text: "Trois", size: 12 }] });
var c = mkFrame({ kind: TextType.POINTTEXT, top: 300, x: 99, cpl: 1000, paras: [{ text: "واحد", size: 12 }, { text: "اثنان", size: 12 }, { text: "ثلاثة", size: 30 }] });
X.APP_run([a, b, c], { model: false, moveFrames: true, grow: false, verify: false, ref: 0 }, true, null);
ok("3 blocs de point alignés", spreadRows([a, b, c], false) < 0.01, spreadRows([a, b, c], false));

// 9. Nombre de paragraphes différent
S = scenario(); S[1]._p.pop();
rep = X.APP_run(S, { model: false, moveFrames: true, grow: true, verify: false, ref: 0 }, true, null).join("\n");
ok("avertissement nombres différents", rep.indexOf("nombre de paragraphes différent") >= 0 && rep.indexOf("4 / 3") >= 0, rep);

// 10. Débordement et agrandissement du cadre
S = scenario(); S[0].textPath.pathPoints.forEach(function (p) { if (p.anchor[1] === 100) { p.anchor[1] = 330; } });
S[1].textPath.pathPoints.forEach(function (p) { if (p.anchor[1] === 100) { p.anchor[1] = 330; } });
var initiallyOverset = X.APP_isOverset(S[0]) || X.APP_isOverset(S[1]);
rep = X.APP_run(S, { model: true, moveFrames: true, grow: true, verify: false, ref: 0 }, true, null).join("\n");
ok("cadre trop court agrandi, plus de texte en excès", !X.APP_isOverset(S[0]) && !X.APP_isOverset(S[1]) && rep.indexOf("Cadre agrandi") >= 0, { initiallyOverset: initiallyOverset, rep: rep });
S = scenario(); S[1].textPath.pathPoints.forEach(function (p) { if (p.anchor[1] === 100) { p.anchor[1] = 380; } });
rep = X.APP_run(S, { model: true, moveFrames: true, grow: false, verify: false, ref: 0 }, true, null).join("\n");
ok("sans agrandissement : texte en excès signalé", rep.indexOf("Texte en excès") >= 0, rep);

// 11. Rejets
var lk = mkFrame({ kind: TextType.AREATEXT, top: 10, bottom: 0, paras: [{ text: "x" }] }); lk.locked = true;
var pt = mkFrame({ kind: TextType.PATHTEXT, top: 10, paras: [{ text: "x" }] });
var th = mkFrame({ kind: TextType.AREATEXT, top: 10, bottom: 0, paras: [{ text: "x" }] }); th.nextFrame = {};
var em = mkFrame({ kind: TextType.POINTTEXT, top: 10, paras: [{ text: "  " }] });
ok("rejets : verrouillé, curviligne, lié, vide", X.APP_rejectReason(lk) && X.APP_rejectReason(pt) && X.APP_rejectReason(th) && X.APP_rejectReason(em) && X.APP_rejectReason(scenario()[0]) === "");
var calque = { typename: "Layer", locked: true, visible: true, parent: { typename: "Document" } };
var surCalque = mkFrame({ kind: TextType.POINTTEXT, top: 10, paras: [{ text: "x" }] }); surCalque.parent = calque;
ok("rejet : calque verrouillé", X.APP_rejectReason(surCalque) !== "");

// 12. Sélection dans des groupes
var g = { typename: "GroupItem", pageItems: [scenario()[0], { typename: "PathItem" }, { typename: "GroupItem", pageItems: [scenario()[1]] }] };
ok("blocs trouvés dans les groupes", X.APP_collect([g], []).length === 2);

// 13. Dialogue anglais
var ctxEN = { APP_NO_MAIN: true, TextType: TextType, TextOrientation: TextOrientation, app: { locale: "en_US" }, $: { locale: "en_US" } };
vm.createContext(ctxEN); vm.runInContext(src, ctxEN);
ok("textes anglais", ctxEN.APP_T.apply === "Align" && X.APP_T.apply === "Aligner");

console.log("\n" + pass + " ok, " + fail + " échec(s)");
process.exit(fail ? 1 : 0);
