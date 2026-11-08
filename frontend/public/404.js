// The 404 page's helper (dist/404.html, built by src/seo/notFound.ts):
// shows the page in the address's language and suggests the station the
// visitor probably meant. Plain script, no app bundle; the page works
// without it (both languages and the full station list are in the HTML).
(function () {
  var path = window.location.pathname;
  var lang = path === "/en" || path.indexOf("/en/") === 0 ? "en" : "nl";
  var blocks = document.querySelectorAll("[data-lang]");
  for (var i = 0; i < blocks.length; i++) blocks[i].hidden = blocks[i].getAttribute("data-lang") !== lang;
  document.documentElement.lang = lang;
  if (lang === "en") document.title = "Stop not found — Amsterdam Metro Live";

  var el = document.getElementById("station-data");
  if (!el) return;
  var data = JSON.parse(el.textContent || "{}");
  var stations = data.stations || [];
  var bySlug = {};
  for (var s = 0; s < stations.length; s++) bySlug[stations[s].slug] = stations[s];

  // The last part of the address, in slug form: "/reisinfo/Zuid-WTC/" → "zuid-wtc".
  var parts = path.split("/").filter(Boolean);
  var last = parts.length ? parts[parts.length - 1] : "";
  try {
    last = decodeURIComponent(last);
  } catch (e) {}
  var wanted = last
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^station[-\s]+/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!wanted || wanted === "en" || wanted === "reisinfo") return;

  function distance(a, b) {
    var prev = [];
    for (var j = 0; j <= b.length; j++) prev[j] = j;
    for (var i = 1; i <= a.length; i++) {
      var cur = [i];
      for (var k = 1; k <= b.length; k++) {
        cur[k] = Math.min(prev[k] + 1, cur[k - 1] + 1, prev[k - 1] + (a[i - 1] === b[k - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  }

  // Own keys only: "/constructor" must not find Object's constructor.
  var has = function (obj, key) {
    return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
  };
  var matches = has(data.nicknames, wanted) ? data.nicknames[wanted] : [];
  if (!matches.length && has(bySlug, wanted)) matches = [wanted];
  if (!matches.length) {
    var flat = wanted.replace(/-/g, "");
    var scored = stations
      .map(function (st) {
        var slug = st.slug.replace(/-/g, "");
        var d = slug.indexOf(flat) >= 0 || flat.indexOf(slug) >= 0 ? 0 : distance(flat, slug);
        return { slug: st.slug, d: d };
      })
      .filter(function (x) {
        return x.d <= Math.max(2, Math.floor(flat.length / 3));
      })
      .sort(function (a, b) {
        return a.d - b.d;
      });
    matches = scored.slice(0, 3).map(function (x) {
      return x.slug;
    });
  }
  // Links are built from the page's own station list only, never from the
  // address the visitor typed.
  // (In match order: the closest first.)
  var found = matches
    .map(function (slug) {
      return stations.filter(function (st) {
        return st.slug === slug;
      })[0];
    })
    .filter(Boolean);
  if (!found.length) return;

  var base = lang === "en" ? "/en/reisinfo/" : "/reisinfo/";
  var box = document.querySelector('[data-lang="' + lang + '"] [data-suggest]');
  if (!box) return;
  box.appendChild(document.createTextNode(lang === "en" ? "Did you mean " : "Bedoelde je "));
  found.forEach(function (st, n) {
    if (n > 0) box.appendChild(document.createTextNode(n === found.length - 1 ? (lang === "en" ? " or " : " of ") : ", "));
    var a = document.createElement("a");
    a.href = base + encodeURIComponent(st.slug);
    a.textContent = st.name;
    box.appendChild(a);
  });
  box.appendChild(document.createTextNode("?"));
})();
