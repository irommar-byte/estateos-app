(function () {
  const INJECT_BUILD = "20261023190943";
  const UI_VERSION = "20261023190943";

  if (window.__nostalgieMoviesBuild === INJECT_BUILD) return;

  const path = location.pathname || "";
  // Skip admin / movies app itself; chip can appear on any public site page.
  if (/\/admin_pro\//i.test(path)) return;

  window.__nostalgieMoviesBuild = INJECT_BUILD;
  window.__nostalgieMoviesInjected = true;
  const MOVIES_PREFIX = "/admin_pro/api/movies/proxy";
  const MOVIES_BASE =
    "/admin_pro/movies/?apiPrefix=" +
    encodeURIComponent(MOVIES_PREFIX) +
    "&ui=" +
    encodeURIComponent(UI_VERSION) +
    "&watchOnly=1";

  function isPatron() {
    if (document.documentElement.getAttribute("data-patron") === "1") return true;
    if (document.body && document.body.getAttribute("data-patron") === "1") return true;
    const chips = document.querySelectorAll(".np-chip.on");
    for (const chip of chips) {
      if (/Patron/i.test(chip.textContent || "")) return true;
    }
    return false;
  }

  function detectPlayerLogin() {
    const actions = document.querySelector(".nc-header__actions");
    if (actions?.querySelector('a[href*="login.php"]')) return "";

    const stop = new Set([
      "admin", "built", "by", "coins", "filmy", "legacy", "login", "logout",
      "movies", "muzyka", "nc", "nostalgie", "panel", "players", "premium",
      "preserved", "ranking", "register", "swiat", "wspieram", "wyloguj", "zglos",
      "patron", "fundamentu", "standard",
    ]);

    function pickLogin(raw) {
      const login = String(raw || "").trim().toLowerCase();
      if (!login || !/^[a-z0-9_]{2,32}$/.test(login)) return "";
      if (stop.has(login)) return "";
      return login;
    }

    for (const el of document.querySelectorAll("[data-login],[data-account],[data-user]")) {
      const login = pickLogin(
        el.getAttribute("data-login") ||
          el.getAttribute("data-account") ||
          el.getAttribute("data-user")
      );
      if (login) return login;
    }

    const pill = document.querySelector(".nc-user-pill__name");
    if (pill) {
      const login = pickLogin(pill.textContent);
      if (login) return login;
    }

    if (actions) {
      const tokens = String(actions.innerText || "")
        .split(/[\s·|•,]+/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      for (const token of tokens) {
        const login = pickLogin(token);
        if (login) return login;
      }
    }
    return "";
  }

  function moviesUrl() {
    const login = detectPlayerLogin();
    if (login) window.__nostalgiePlayerLogin = login;
    return login ? MOVIES_BASE + "&ncLogin=" + encodeURIComponent(login) : MOVIES_BASE;
  }

  function injectStyles() {
    if (document.getElementById("nostalgie-movies-styles")) return;
    const style = document.createElement("style");
    style.id = "nostalgie-movies-styles";
    style.textContent = `
      #nostalgie-movies-chip {
        display: inline-flex;
        align-items: center;
        gap: 0;
        flex-shrink: 0;
        width: 36px;
        height: 36px;
        max-width: 36px;
        padding: 0;
        justify-content: center;
        border-radius: 980px;
        border: 1px solid rgba(191, 90, 242, 0.35);
        background: linear-gradient(135deg, rgba(45, 16, 82, 0.85), rgba(26, 16, 48, 0.9));
        color: #fff;
        text-decoration: none !important;
        cursor: pointer;
        font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
        transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
      }
      #nostalgie-movies-chip:hover {
        transform: translateY(-1px);
        border-color: rgba(255, 55, 95, 0.55);
        box-shadow: 0 0 18px rgba(191, 90, 242, 0.28);
      }
      #nostalgie-movies-chip .nm-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background: rgba(255, 55, 95, 0.22);
        font-size: 12px;
        line-height: 1;
      }
      #nostalgie-movies-chip .nm-text { display: flex; flex-direction: column; gap: 1px; line-height: 1.05; }
      @media (max-width: 900px) { #nostalgie-movies-chip .nm-text { display: none; } }
      #nostalgie-movies-chip .nm-title {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        white-space: nowrap;
      }
      #nostalgie-movies-chip .nm-sub {
        font-size: 9px;
        font-weight: 500;
        color: rgba(255,255,255,0.55);
        white-space: nowrap;
      }
      #nostalgie-movies-chip.is-active {
        border-color: rgba(255, 55, 95, 0.7);
        box-shadow: 0 0 0 1px rgba(255, 55, 95, 0.35);
      }
      #tab-movies {
        display: none !important;
        position: relative;
        z-index: 9000;
        margin: 0 0 40px;
        pointer-events: none !important;
      }
      #tab-movies.is-open {
        display: block !important;
        pointer-events: auto !important;
      }
      body.nm-movies-open .nc-page > *:not(#tab-movies),
      body.nm-movies-open .np > *:not(#tab-movies) {
        display: none !important;
      }
      #tab-movies .nm-frame-wrap {
        padding: 12px;
        border-radius: 20px;
        background: rgba(0, 0, 0, 0.35);
        border: 1px solid rgba(255, 255, 255, 0.08);
      }
      #movies-iframe {
        width: 100%;
        min-height: 78vh;
        height: 78vh;
        border: none;
        border-radius: 16px;
        background: rgba(0, 0, 0, 0.4);
      }
      @media (max-width: 900px) {
        #nostalgie-movies-chip { width: 36px; height: 36px; }
      }
    `;
    document.head.appendChild(style);
  }

  function findMountRoot() {
    return (
      document.querySelector(".np") ||
      document.querySelector(".nc-page") ||
      document.querySelector("main") ||
      document.body
    );
  }

  function ensureMoviesPanel() {
    let panel = document.getElementById("tab-movies");
    if (panel) return panel;
    const root = findMountRoot();
    if (!root) return null;
    panel = document.createElement("div");
    panel.id = "tab-movies";
    panel.innerHTML =
      '<div class="nm-frame-wrap">' +
      '<iframe id="movies-iframe" title="NOSTALGIE Movies" scrolling="yes" allow="autoplay; fullscreen; airplay *"></iframe>' +
      "</div>";
    root.insertBefore(panel, root.firstChild);
    return panel;
  }

  function loadMoviesFrame(forceReload) {
    const frame = document.getElementById("movies-iframe");
    if (!frame) return;
    const needsReload =
      forceReload || !frame.src || frame.dataset.nmUiVersion !== UI_VERSION;
    if (needsReload) {
      frame.src = moviesUrl() + "&_=" + Date.now();
      frame.dataset.nmUiVersion = UI_VERSION;
    }
  }

  function setBtnActive(active) {
    const btn = document.getElementById("nostalgie-movies-chip");
    if (btn) btn.classList.toggle("is-active", active);
  }

  function openMovies() {
    document.body.classList.remove("nc-menu-open");
    const menu = document.getElementById("nc-header-menu");
    const toggle = document.getElementById("nc-header-toggle");
    if (menu) menu.classList.remove("is-open");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
    ensureMoviesPanel();
    const panel = document.getElementById("tab-movies");
    if (panel) {
      panel.classList.add("is-open");
      document.body.classList.add("nm-movies-open");
    }
    loadMoviesFrame(true);
    setBtnActive(true);
    panel?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeMovies() {
    const panel = document.getElementById("tab-movies");
    if (panel) panel.classList.remove("is-open");
    document.body.classList.remove("nm-movies-open");
    const frame = document.getElementById("movies-iframe");
    if (frame) {
      try { frame.src = "about:blank"; } catch (e) {}
      delete frame.dataset.nmUiVersion;
    }
    setBtnActive(false);
  }

  window.openNostalgieMovies = openMovies;
  window.closeNostalgieMovies = closeMovies;

  function mountHeaderChip() {
    if (document.getElementById("nostalgie-movies-chip")) return;
    if (!isPatron()) return;

    injectStyles();

    const actions = document.querySelector(".nc-header__actions");
    if (!actions) return;

    const chip = document.createElement("button");
    chip.type = "button";
    chip.id = "nostalgie-movies-chip";
    chip.setAttribute("aria-label", "Nostalgie Movies — tylko Patron");
    chip.title = "Nostalgie™ Movies · tylko Patron";
    chip.innerHTML =
      '<span class="nm-icon" aria-hidden="true">▶</span>' +
      '<span class="nm-text"><span class="nm-title">Movies</span>' +
      '<span class="nm-sub">tylko Patron</span></span>';

    const coins = actions.querySelector(".nc-coins-chip");
    if (coins && coins.parentNode === actions) {
      actions.insertBefore(chip, coins.nextSibling);
    } else {
      actions.insertBefore(chip, actions.firstChild);
    }

    chip.addEventListener("click", function () {
      if (this.classList.contains("is-active")) closeMovies();
      else openMovies();
    });

  }

  function boot() {
    mountHeaderChip();
    setTimeout(mountHeaderChip, 250);
    setTimeout(mountHeaderChip, 900);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
