/*
 * Swappable avatar component for the Nigiri Counter.
 * ---------------------------------------------------
 * The counter talks to this module through a small, style-agnostic interface,
 * so the look can be swapped without touching index.html:
 *
 *     const avatar = NigiriAvatar.create(mountEl);
 *     avatar.bite();        // eat the piece -> {remaining, finished, ignored}
 *     avatar.freshPiece();  // bring in a new full nigiri
 *     avatar.reset();       // back to idle, full nigiri
 *     avatar.remaining      // bites left on the current piece
 *     NigiriAvatar.BITES    // bites per piece
 *
 * Current style: PIXEL. Frames are pre-rendered PNGs in ./frames produced by
 * gen_avatar.py (edit + rerun that script to restyle, e.g. to a chibi look).
 * Every frame shares one canvas and is drawn in place, so the person and
 * nigiri layers line up just by stacking them.
 *
 * One bite per piece: a single tap eats the whole nigiri and the next full
 * piece is served in the same beat. The piece on the plate is a persistent
 * element that is ALWAYS opaque -- it only scales (a "pop"), never fades to
 * zero -- so the plate can never be empty even if an animation is interrupted
 * or throttled. The eaten piece is a separate transient "ghost" that flies up
 * into the mouth and removes itself.
 */
(function () {
  "use strict";

  var STYLE = "pixel";
  var BITES = 1;            // bites needed to finish one piece
  var FULL = 8;            // frame index of a full, untouched piece (nigiri_8)
  var DIR = "frames/";
  var PERSON = { idle: "person_idle", blink: "person_blink", open: "person_open", chew: "person_chew" };

  // preload every frame so bites never flicker
  var cache = {};
  function preload(name) { var i = new Image(); i.src = DIR + name + ".png"; cache[name] = i; }
  Object.keys(PERSON).forEach(function (k) { preload(PERSON[k]); });
  for (var r = 0; r <= FULL; r++) preload("nigiri_" + r);

  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }

  function create(container) {
    var stage = el("div", "av-stage");
    var person = el("img", "av-layer av-person");
    person.src = DIR + PERSON.idle + ".png";
    person.alt = "Pixel-art avatar eating nigiri";
    // The persistent piece on the plate. It is never hidden -- see the note above.
    var nigiri = el("img", "av-layer av-nigiri");
    nigiri.src = DIR + "nigiri_" + FULL + ".png";
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

    function removeGhosts() {
      var gs = stage.querySelectorAll(".av-nigiri-ghost");
      for (var i = 0; i < gs.length; i++) gs[i].remove();
    }

    // Restart the scale "pop" so a fresh full piece visibly drops onto the
    // plate. Opacity is never touched here, so the piece stays visible even if
    // this animation is interrupted, throttled, or never runs.
    function popPlate() {
      nigiri.classList.remove("refill");
      void nigiri.offsetWidth;
      nigiri.classList.add("refill");
    }

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
      remaining--;                     // one bite finishes the whole piece
      var finished = remaining === 0;

      setPerson("open");               // mouth opens

      // A ghost copy of the piece flies up into the mouth (the "eaten" piece)...
      var ghost = el("img", "av-nigiri-ghost");
      ghost.src = DIR + "nigiri_" + FULL + ".png";
      ghost.alt = "";
      stage.insertBefore(ghost, crumbs);
      ghost.addEventListener("animationend", function () { ghost.remove(); });
      setTimeout(function () { if (ghost.parentNode) ghost.remove(); }, 700); // safety cleanup

      spawnCrumbs();

      // ...while the plate immediately pops a fresh full piece in. The plate
      // piece never leaves, so there is always a nigiri on screen.
      setNigiri(FULL);
      popPlate();

      remaining = BITES;               // ready for the next tap right away

      // chew, then settle back to idle
      after(150, function () { setPerson("chew"); });
      after(380, function () { setPerson("idle"); });

      return { remaining: remaining, finished: finished, ignored: false };
    }

    function freshPiece() {
      clearTimers();
      remaining = BITES;
      setPerson("idle");
      removeGhosts();
      setNigiri(FULL);
      popPlate();
    }

    function reset() {
      clearTimers();
      remaining = BITES;
      setPerson("idle");
      removeGhosts();
      nigiri.classList.remove("refill");
      setNigiri(FULL);
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
