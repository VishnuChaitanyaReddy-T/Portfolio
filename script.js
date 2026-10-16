(function () {
  "use strict";

  // Approximate ethanol-water VLE data at 1 atm: [x (liquid), y (vapor)] as mole fraction ethanol.
  var DATA = [
    [0, 0], [0.019, 0.170], [0.0721, 0.3891], [0.0966, 0.4375], [0.1238, 0.4704],
    [0.1661, 0.5089], [0.2337, 0.5445], [0.2608, 0.558], [0.3273, 0.5826],
    [0.3965, 0.6122], [0.5079, 0.6564], [0.5732, 0.6841], [0.6763, 0.7385],
    [0.7472, 0.7815], [0.8943, 0.8943], [0.95, 0.942], [1, 1]
  ];
  var AZEO = 0.8943;

  // Monotone cubic interpolation (Fritsch-Carlson) so the curve is smooth and never overshoots.
  var n = DATA.length, xs = DATA.map(function (p) { return p[0]; }), ys = DATA.map(function (p) { return p[1]; });
  var d = [], m = [];
  for (var i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    var a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { var t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  function vaporAt(x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    var k = 0;
    while (k < n - 2 && x > xs[k + 1]) k++;
    var h = xs[k + 1] - xs[k], u = (x - xs[k]) / h, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * ys[k] + (u3 - 2 * u2 + u) * h * m[k] +
           (-2 * u3 + 3 * u2) * ys[k + 1] + (u3 - u2) * h * m[k + 1];
  }

  // SVG setup
  var NS = "http://www.w3.org/2000/svg";
  var svg = document.getElementById("vle-plot");
  var slider = document.getElementById("vle-x");
  var xOut = document.getElementById("vle-x-out");
  var readout = document.getElementById("vle-readout");
  if (!svg || !slider) return;

  var L = 62, T = 18, SIZE = 430;            // plot box: left, top, width/height
  function px(x) { return L + x * SIZE; }
  function py(y) { return T + (1 - y) * SIZE; }
  function el(name, attrs, text) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text) e.textContent = text;
    svg.appendChild(e);
    return e;
  }

  // grid + tick labels
  for (var v = 0; v <= 1.0001; v += 0.2) {
    var tv = v.toFixed(1);
    el("line", { "class": "tick-line", x1: px(v), y1: py(0), x2: px(v), y2: py(1) });
    el("line", { "class": "tick-line", x1: px(0), y1: py(v), x2: px(1), y2: py(v) });
    el("text", { x: px(v), y: py(0) + 20, "text-anchor": "middle" }, tv);
    el("text", { x: px(0) - 10, y: py(v) + 4, "text-anchor": "end" }, tv);
  }
  el("rect", { "class": "frame", x: px(0), y: py(1), width: SIZE, height: SIZE });
  el("text", { "class": "axis-title", x: px(0.5), y: py(0) + 44, "text-anchor": "middle" }, "Ethanol in liquid, x");
  el("text", { "class": "axis-title", transform: "translate(16," + py(0.5) + ") rotate(-90)", "text-anchor": "middle" }, "Ethanol in vapor, y");

  // y = x line
  el("line", { "class": "diag", x1: px(0), y1: py(0), x2: px(1), y2: py(1) });
  el("text", { "class": "diag-label", x: px(0.1) + 6, y: py(0.1) - 10, transform: "rotate(-45 " + (px(0.1) + 6) + " " + (py(0.1) - 10) + ")" }, "y = x (same composition)");

  // equilibrium curve
  var pts = [];
  for (var j = 0; j <= 200; j++) { var xv = j / 200; pts.push((j ? "L" : "M") + px(xv).toFixed(1) + " " + py(vaporAt(xv)).toFixed(1)); }
  var curve = el("path", { "class": "curve", d: pts.join(" ") });
  svg.style.setProperty("--len", Math.ceil(curve.getTotalLength()) + 2);

  // azeotrope marker
  el("circle", { "class": "azeo", cx: px(AZEO), cy: py(AZEO), r: 6 });
  el("text", { "class": "azeo-label", x: px(AZEO) - 12, y: py(AZEO) + 28, "text-anchor": "end" }, "Azeotrope, x \u2248 0.894");

  // moving point and guides
  var gv = el("line", { "class": "guide" });
  var gh = el("line", { "class": "guide" });
  var dot = el("circle", { "class": "pt", r: 7 });

  function update() {
    var x = parseFloat(slider.value), y = vaporAt(x);
    xOut.textContent = x.toFixed(2);
    gv.setAttribute("x1", px(x)); gv.setAttribute("x2", px(x)); gv.setAttribute("y1", py(0)); gv.setAttribute("y2", py(y));
    gh.setAttribute("x1", px(0)); gh.setAttribute("x2", px(x)); gh.setAttribute("y1", py(y)); gh.setAttribute("y2", py(y));
    dot.setAttribute("cx", px(x)); dot.setAttribute("cy", py(y));

    var diff = y - x, msg;
    if (Math.abs(x - AZEO) < 0.012) {
      msg = "Vapor and liquid have the same composition here (about 89.4% ethanol), so ordinary distillation cannot go further.";
    } else if (x < 0.002 || x > 0.998) {
      msg = x < 0.5 ? "Pure water: nothing to separate." : "Pure ethanol: nothing to separate.";
    } else if (diff > 0) {
      msg = "Liquid " + x.toFixed(2) + " gives vapor " + y.toFixed(2) + ". The vapor is " + diff.toFixed(2) + " richer in ethanol, which is why distillation works.";
    } else {
      msg = "Liquid " + x.toFixed(2) + " gives vapor " + y.toFixed(2) + ". Past the azeotrope the vapor is " + Math.abs(diff).toFixed(2) + " leaner in ethanol.";
    }
    readout.textContent = msg;
  }
  slider.addEventListener("input", update);

  // click or tap the chart to move the point
  svg.addEventListener("click", function (e) {
    var r = svg.getBoundingClientRect(), scale = 520 / r.width;
    var x = ((e.clientX - r.left) * scale - L) / SIZE;
    if (x >= 0 && x <= 1) { slider.value = x.toFixed(3); update(); }
  });

  update();

  var yr = document.getElementById("year");
  if (yr) yr.textContent = new Date().getFullYear();
})();
