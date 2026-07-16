/*
 * Swappable avatar component for the Nigiri Counter.
 * ---------------------------------------------------
 * The counter talks to this module through a small, style-agnostic interface,
 * so the look can be swapped without touching index.html:
 *
 *     const avatar = NigiriAvatar.create(mountEl);
 *     avatar.bite();        // play one chomp -> {remaining, finished, ignored}
 *     avatar.freshPiece();  // bring in a new full nigiri
 *     avatar.reset();       // back to idle, full nigiri
 *     avatar.remaining      // bites left on the current piece
 *     NigiriAvatar.BITES    // bites per piece
 *
 * Current style: PIXEL. Frames are pre-rendered PNGs in ./frames produced by
 * gen_avatar.py (edit + rerun that script to restyle, e.g. to a chibi look).
 * Every frame shares one canvas and is drawn in place, so the person and
 * nigiri layers line up just by stacking them.
 */
(function () {
  "use strict";

  var STYLE = "pixel";
  var BITES = 8;
  var DIR = "frames/";
  var PERSON = { idle: "person_idle", blink: "person_blink", open: "person_open", chew: "person_chew" };

  // preload every frame so bites never flicker
  var cache = {};
  function preload(name) { var i = new Image(); i.src = DIR + name + ".png"; cache[name] = i; }
  Object.keys(PERSON).forEach(function (k) { preload(PERSON[k]); });
  for (var r = 0; r <= BITES; r++) preload("nigiri_" + r);

  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }

  function create(container) {
    var stage = el("div", "av-stage");
    var person = el("img", "av-layer av-person");
    person.src = DIR + PERSON.idle + ".png";
    person.alt = "Pixel-art avatar eating nigiri";
    var nigiri = el("img", "av-layer av-nigiri");
    nigiri.src = DIR + "nigiri_" + BITES + ".png";
    nigiri.alt = "";
    var crumbs = el("div", "av-crumbs");
    stage.appendChild(person);
    stage.appendChild(nigiri);
    stage.appendChild(crumbs);
    container.appendChild(stage);

    var remaining = BITES;
    var timers = [];
    var blinkTimer = null;

    function clearTimers() { timers.forEach(clearTimeout); timers = []; }
    function after(ms, fn) { timers.push(setTimeout(fn, ms)); }
    function setPerson(k) { person.src = DIR + PERSON[k] + ".png"; }
    function isPerson(k) { return person.src.indexOf(PERSON[k] + ".png") >= 0; }
    function setNigiri(n) { nigiri.src = DIR + "nigiri_" + Math.max(0, n) + ".png"; }

    function spawnCrumbs() {
      var rect = stage.getBoundingClientRect();
      if (!rect.width) return;
      var ox = rect.width * 0.45;   // roughly the mouth
      var oy = rect.height * 0.5;
      var colors = ["#ff8a5c", "#ffb488", "#fbf3df", "#e9dcc4"];
      for (var i = 0; i < 5; i++) {
        var c = el("span", "av-crumb");
        c.style.left = ox + "px";
        c.style.top = oy + "px";
        c.style.background = colors[i % colors.length];
        crumbs.appendChild(c);
        var ang = -(0.15 + Math.random() * 0.7) * Math.PI;
        var dist = 16 + Math.random() * 30;
        var dx = Math.cos(ang) * dist;
        var dy = Math.sin(ang) * dist;
        c.animate(
          [
            { transform: "translate(-50%,-50%) scale(1)", opacity: 1 },
            { transform: "translate(calc(-50% + " + dx + "px), calc(-50% + " + dy + "px)) scale(0.3)", opacity: 0 }
          ],
          { duration: 520 + Math.random() * 160, easing: "cubic-bezier(.2,.7,.3,1)" }
        ).onfinish = function () { this.remove(); }.bind(c);
      }
    }

    function bite() {
      if (remaining <= 0) return { remaining: 0, finished: false, ignored: true };
      clearTimers();
      remaining--;
      var finished = remaining === 0;

      setPerson("open");             // mouth opens
      nigiri.classList.add("lift");  // food rises into the mouth
      spawnCrumbs();
      after(110, function () { setNigiri(remaining); });                 // a bite disappears
      after(185, function () { nigiri.classList.remove("lift"); if (!finished) setPerson("chew"); });
      after(350, function () { if (!finished) setPerson("idle"); });

      return { remaining: remaining, finished: finished, ignored: false };
    }

    function freshPiece() {
      clearTimers();
      remaining = BITES;
      setPerson("idle");
      setNigiri(BITES);
      nigiri.classList.remove("lift");
      nigiri.classList.remove("pop");
      void nigiri.offsetWidth;
      nigiri.classList.add("pop");
    }

    function reset() {
      clearTimers();
      remaining = BITES;
      setPerson("idle");
      setNigiri(BITES);
      nigiri.classList.remove("lift");
    }

    // gentle idle blink
    (function blinkLoop() {
      blinkTimer = setTimeout(function () {
        if (isPerson("idle")) {
          setPerson("blink");
          setTimeout(function () { if (isPerson("blink")) setPerson("idle"); }, 130);
        }
        blinkLoop();
      }, 2600 + Math.random() * 2800);
    })();

    return {
      el: stage,
      bite: bite,
      freshPiece: freshPiece,
      reset: reset,
      get remaining() { return remaining; },
      BITES: BITES
    };
  }

  window.NigiriAvatar = { STYLE: STYLE, BITES: BITES, create: create };
})();
