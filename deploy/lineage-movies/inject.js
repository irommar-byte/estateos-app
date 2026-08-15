(function () {
  const INJECT_BUILD = "20260814220407";
  const UI_VERSION = "20260814220407";

  if (window.__nostalgieMoviesBuild === INJECT_BUILD) return;

  const path = location.pathname || "";
  const IS_ADMIN = /\/admin_pro/i.test(path);
  const IS_USER_PANEL = /\/panel\.php/i.test(path);
  if (IS_ADMIN || !IS_USER_PANEL) return;

  window.__nostalgieMoviesBuild = INJECT_BUILD;
  window.__nostalgieMoviesInjected = true;
  const MOVIES_PREFIX = "/admin_pro/api/movies/proxy";
  const MOVIES_BASE =
    "/admin_pro/movies/?apiPrefix=" +
    encodeURIComponent(MOVIES_PREFIX) +
    "&ui=" +
    encodeURIComponent(UI_VERSION);

  function detectPlayerLogin() {
    const actions = document.querySelector(".nc-header__actions");
    if (actions?.querySelector('a[href*="login.php"]')) return "";

    const stop = new Set([
      "admin",
      "built",
      "by",
      "coins",
      "filmy",
      "legacy",
      "login",
      "logout",
      "movies",
      "muzyka",
      "nc",
      "nostalgie",
      "panel",
      "players",
      "premium",
      "preserved",
      "ranking",
      "register",
      "swiat",
      "wspieram",
      "wyloguj",
      "zglos",
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

    // Tylko pasek użytkownika (monety, nick, ADMIN) — nie tagline „Built by players…"
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

    const main =
      document.querySelector(".nc-page") ||
      document.querySelector("main.max-w-6xl") ||
      document.querySelector("main");
    const text = main?.innerText || document.body?.innerText || "";
    const patterns = [
      /(?:Konto|Gracz|Login|Account)[:\s]+([A-Za-z0-9_]{2,32})/i,
      /Witaj[,:\s]+([A-Za-z0-9_]{2,32})/i,
    ];
    for (const re of patterns) {
      const m = text.match(re);
      const login = pickLogin(m?.[1]);
      if (login) return login;
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
      #nostalgie-movies-dock {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 9999;
        padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
        background: linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.75) 70%, transparent 100%);
        pointer-events: none;
      }
      #nostalgie-movies-dock > button {
        pointer-events: auto;
        max-width: 42rem;
        margin: 0 auto;
      }
      #nostalgie-movies-btn {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 14px;
        width: 100%;
        padding: 20px 28px;
        border: none;
        border-radius: 20px;
        cursor: pointer;
        overflow: hidden;
        isolation: isolate;
        font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif;
        font-size: 15px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #fff;
        background: linear-gradient(135deg, #1a1030 0%, #2d1052 35%, #4a1575 70%, #1a1030 100%);
        box-shadow:
          0 4px 24px rgba(0, 0, 0, 0.45),
          inset 0 1px 0 rgba(255, 255, 255, 0.12);
        transition:
          transform 0.45s cubic-bezier(0.22, 1, 0.36, 1),
          box-shadow 0.45s cubic-bezier(0.22, 1, 0.36, 1),
          filter 0.35s ease;
      }
      #nostalgie-movies-btn::before {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: inherit;
        padding: 2px;
        background: linear-gradient(
          120deg,
          #ff375f,
          #bf5af2,
          #0071e3,
          #ff9f0a,
          #ff375f
        );
        background-size: 300% 300%;
        -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor;
        mask-composite: exclude;
        opacity: 0.55;
        transition: opacity 0.45s ease, background-position 0.8s ease;
        z-index: -1;
      }
      #nostalgie-movies-btn .nm-shine {
        position: absolute;
        top: 0;
        left: -120%;
        width: 60%;
        height: 100%;
        background: linear-gradient(
          105deg,
          transparent 40%,
          rgba(255, 255, 255, 0.35) 50%,
          transparent 60%
        );
        transform: skewX(-18deg);
        transition: left 0.65s cubic-bezier(0.22, 1, 0.36, 1);
        pointer-events: none;
      }
      #nostalgie-movies-btn .nm-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 42px;
        height: 42px;
        border-radius: 12px;
        background: rgba(255, 55, 95, 0.22);
        box-shadow: 0 0 20px rgba(255, 55, 95, 0.35);
        font-size: 18px;
        transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.45s ease;
      }
      #nostalgie-movies-btn .nm-label {
        position: relative;
        z-index: 1;
      }
      #nostalgie-movies-btn .nm-sub {
        display: block;
        font-size: 10px;
        font-weight: 500;
        letter-spacing: 0.08em;
        color: rgba(255, 255, 255, 0.55);
        margin-top: 3px;
        text-transform: none;
      }
      #nostalgie-movies-btn:hover {
        transform: translateY(-4px) scale(1.015);
        box-shadow:
          0 0 0 1px rgba(255, 55, 95, 0.35),
          0 0 48px rgba(255, 55, 95, 0.45),
          0 0 80px rgba(191, 90, 242, 0.25),
          0 20px 40px rgba(0, 0, 0, 0.55);
        filter: brightness(1.12);
      }
      #nostalgie-movies-btn:hover::before {
        opacity: 1;
        background-position: 100% 50%;
        animation: nm-border-flow 2.2s linear infinite;
      }
      #nostalgie-movies-btn:hover .nm-shine {
        left: 140%;
      }
      #nostalgie-movies-btn:hover .nm-icon {
        transform: scale(1.12) rotate(-6deg);
        box-shadow: 0 0 32px rgba(255, 55, 95, 0.65);
      }
      #nostalgie-movies-btn:active {
        transform: translateY(-1px) scale(0.995);
        transition-duration: 0.12s;
      }
      #nostalgie-movies-btn.is-active {
        background: linear-gradient(135deg, #2a0820 0%, #5c1238 50%, #2a0820 100%);
        box-shadow:
          0 0 0 2px rgba(255, 55, 95, 0.6),
          0 0 40px rgba(255, 55, 95, 0.35);
      }
      #nostalgie-movies-btn.is-active .nm-sub::after {
        content: " · kliknij, aby wrócić";
        color: rgba(255, 159, 10, 0.85);
      }
      #nostalgie-movies-dock.dock-shifted > button {
        transform: translateY(-4px) scale(0.98);
        opacity: 0.92;
      }
      #nostalgie-movies-dock.dock-shifted {
        padding-bottom: calc(6px + env(safe-area-inset-bottom, 0px));
      }
      #tab-movies {
        display: none;
        position: relative;
        z-index: 9000;
        margin: 0 0 120px;
      }
      #tab-movies.is-open {
        display: block;
      }
      body.nm-movies-open .nc-page > *:not(#tab-movies) {
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
    `;
    document.head.appendChild(style);
  }

  function findMountRoot() {
    return (
      document.querySelector(".nc-page") ||
      document.querySelector("main.max-w-6xl") ||
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
    root.appendChild(panel);
    return panel;
  }

  function loadMoviesFrame(forceReload) {
    const frame = document.getElementById("movies-iframe");
    if (!frame) return;
    const needsReload =
      forceReload ||
      !frame.src ||
      frame.dataset.nmUiVersion !== UI_VERSION;
    if (needsReload) {
      frame.src = moviesUrl() + "&_=" + Date.now();
      frame.dataset.nmUiVersion = UI_VERSION;
    }
  }

  function setBtnActive(active) {
    const btn = document.getElementById("nostalgie-movies-btn");
    if (btn) btn.classList.toggle("is-active", active);
  }

  function openMovies() {
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
    setBtnActive(false);
  }

  window.openNostalgieMovies = openMovies;
  window.closeNostalgieMovies = closeMovies;

  function mountBottomButton() {
    if (document.getElementById("nostalgie-movies-dock")) return;

    injectStyles();
    ensureMoviesPanel();

    const dock = document.createElement("div");
    dock.id = "nostalgie-movies-dock";
    dock.innerHTML =
      '<button type="button" id="nostalgie-movies-btn" aria-label="NOSTALGIE Movies">' +
      '<span class="nm-shine" aria-hidden="true"></span>' +
      '<span class="nm-icon"><i class="fa-solid fa-clapperboard"></i></span>' +
      '<span class="nm-label">NOSTALGIE™ MOVIES<span class="nm-sub">Wyszukiwarka · podgląd · pobieranie</span></span>' +
      "</button>";

    document.body.appendChild(dock);

    document.getElementById("nostalgie-movies-btn").addEventListener("click", function () {
      if (this.classList.contains("is-active")) closeMovies();
      else openMovies();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountBottomButton);
  } else {
    mountBottomButton();
  }
  setTimeout(mountBottomButton, 300);

  window.addEventListener("message", function (ev) {
    if (!ev.data || ev.data.type !== "nostalgie-movies-dock") return;
    const dock = document.getElementById("nostalgie-movies-dock");
    if (dock) dock.classList.toggle("dock-shifted", !!ev.data.active);
  });
})();
