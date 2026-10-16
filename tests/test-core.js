// Tests du cœur pur — node tests/test-core.js / Pure-core tests.
var fs = require("fs"), vm = require("vm"), path = require("path");
var src = fs.readFileSync(path.join(__dirname, "..", "AlignerParagraphesParalleles.jsx"), "utf8");
var ctx = { APP_NO_MAIN: true }; vm.createContext(ctx); vm.runInContext(src + "\nthis.C = APP_CORE;", ctx);
var C = ctx.C, pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log("ok   " + n); } else { fail++; console.log("FAIL " + n + (e !== undefined ? " -> " + JSON.stringify(e) : "")); } }
function near(a, b, t) { return Math.abs(a - b) <= (t || 1e-9); }

// splitParas
var p = C.splitParas("Titre\rUn texte\r\r  \rFin");
ok("5 paragraphes", p.length === 5);
ok("débuts corrects", p[0].start === 0 && p[1].start === 6 && p[2].start === 15 && p[4].start === 19, p.map(function (x) { return x.start; }));
ok("vides détectés", !p[0].blank && p[2].blank && p[3].blank && !p[4].blank);
ok("\\n traité comme \\r", C.splitParas("a\nb").length === 2);
ok("retour forcé seul = vide", C.isBlank("\u0003 \u00A0") && !C.isBlank("ب"));

// lineLeading
ok("interlignage auto 120 %", near(C.lineLeading([{ size: 10, autoLeading: true }], 120), 12));
ok("plus grand de la ligne", near(C.lineLeading([{ size: 10, leading: 14 }, { size: 20, autoLeading: true }], 120), 24));
ok("montant auto par défaut", near(C.lineLeading([{ size: 10, autoLeading: true }], 0), 12));

// modelOffsets
var off = C.modelOffsets([
    { spaceBefore: 50, spaceAfter: 2, lines: [12, 12, 12] },
    { spaceBefore: 4, spaceAfter: 0, lines: [14] },
    { spaceBefore: 0, spaceAfter: 0, lines: [] , fallbackLeading: 10 },
    { spaceBefore: 6, spaceAfter: 0, lines: [12, 12] }
]);
ok("modèle : 1er = 0, espace avant du 1er ignoré", off[0] === 0);
ok("modèle : 2e = 24 + 2 + 4 + 14", near(off[1], 44), off);
ok("modèle : paragraphe vide (repli)", near(off[2], 54), off);
ok("modèle : 4e", near(off[3], 72), off);

// solve — deux blocs, y vers le haut / two frames, y up
var ys = [[100, 60, 20], [100, 76, 50]];
var r = C.solve(ys, 0, true, 0.01);
ok("3 paragraphes associés", r.count === 3);
ok("pas de décalage de bloc si 1res lignes égales", r.shift[0] === 0 && r.shift[1] === 0);
// rang 2 : bloc0 60, bloc1 76 -> cible 60, bloc1 +16
ok("ajout rang 2 = 16 sur le bloc 1", near(r.extras[1][1], 16) && near(r.extras[0][1], 0), r.extras);
// rang 3 : bloc0 20, bloc1 50-16=34 -> cible 20 -> bloc1 +14
ok("ajout rang 3 cumulatif = 14", near(r.extras[1][2], 14) && near(r.extras[0][2], 0), r.extras);
ok("écarts avant", near(r.before[1], 16) && near(r.before[2], 14), r.before);

// Vérification générique : après ajout, toutes les lignes de base coïncident.
function check(ys, ref, move) {
    var r = C.solve(ys, ref, move, 0), F = ys.length, m, f, okAll = true, neg = false;
    for (m = 0; m < r.count; m++) {
        var col = [];
        for (f = 0; f < F; f++) {
            var S = 0, j; for (j = 0; j <= m; j++) S += r.extras[f][j];
            if (r.extras[f][m] < 0) neg = true;
            var base = move ? r.shift[f] : ys[ref][0] - ys[f][0];
            col.push(ys[f][m] + base - S);
        }
        if (C.spread(col) > 1e-6) okAll = false;
    }
    if (move && Math.abs(r.shift[ref]) > 1e-12) okAll = false;
    return okAll && !neg;
}
var seed = 7; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
var good = 0, N = 300;
for (var t = 0; t < N; t++) {
    var F = 2 + Math.floor(rnd() * 3), M = 1 + Math.floor(rnd() * 8), arr = [];
    for (var f = 0; f < F; f++) { var y = 500 + rnd() * 30, a = []; for (var m = 0; m < M; m++) { a.push(y); y -= 10 + rnd() * 80; } arr.push(a); }
    var ref = Math.floor(rnd() * F);
    if (check(arr, ref, true) && check(arr, ref, false)) good++;
}
ok("300 cas aléatoires alignés, ajouts toujours ≥ 0", good === N, good);

var r2 = C.solve([[100, 50, 10], [90, 40]], 1, true, 0.01);
ok("nombres différents : min retenu", r2.count === 2 && r2.counts.join() === "3,2");
ok("décalage vers la référence", near(r2.shift[0], -10) && r2.shift[1] === 0, r2.shift);
var r3 = C.solve([[100, 50], [90, 40]], 0, false, 0.01);
ok("sans déplacement : relatif à la 1re ligne de chaque bloc", near(r3.extras[0][1], 0) && near(r3.extras[1][1], 0) && r3.shift[1] === 0, r3);
ok("bloc vide : rien", C.solve([[], [1]], 0, true).count === 0);

// Notes
var n1 = C.encodeNote("Note client", 3.5, { 2: 6, 5: 0 });
ok("note encodée en gardant le texte", n1.indexOf("Note client") === 0 && n1.indexOf("[APP1:3.5;") > 0, n1);
var d = C.decodeNote(n1);
ok("note décodée", d && d.dy === 3.5 && d.origs[2] === 6 && d.origs[5] === 0, d);
ok("note retirée", C.stripNote(n1) === "Note client");
ok("ré-encodage remplace l'ancien marqueur", C.encodeNote(n1, 0, {}).split("[APP1:").length === 2);
ok("pas de marqueur = null", C.decodeNote("abc") === null && C.decodeNote("") === null);
ok("format pt/mm", C.fmt(72) === "72 pt (25.4 mm)", C.fmt(72));
ok("extrait", C.excerpt("Bonjour\rle monde entier qui est grand", 12) === "Bonjour le …", C.excerpt("Bonjour\rle monde entier qui est grand", 12));
ok("plus bas bord", C.lowestBottom([[0, 10, 1, 2], [0, 5, 1, -3], [0, 8, 1, 0]]) === -3);

console.log("\n" + pass + " ok, " + fail + " échec(s)");
process.exit(fail ? 1 : 0);
