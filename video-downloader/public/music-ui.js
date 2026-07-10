/* global moviesApiFetch, apiUrl, fmtBytes */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const state = {
    folders: [],
    tracks: [],
    view: "home",
    folder: null,
    folderTracks: [],
    queue: [],
    queueIndex: 0,
    shuffle: false,
    repeat: "all",
    playOrder: [],
    orderCursor: 0,
    favorites: new Set(),
    audio: null,
    audioCtx: null,
    analyser: null,
    animFrame: null,
    pollTimer: null,
  };

  function fmtTime(sec) {
    if (!sec || !Number.isFinite(sec)) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function folderCountLabel(f) {
    const total = f.trackCount || 0;
    const onServer = f.downloadedTrackCount ?? f.fileCount ?? 0;
    if (total > 0 && onServer > 0 && onServer < total) {
      return `${onServer} z ${total} na serwerze`;
    }
    if (onServer > 0) return `${onServer} utworów na serwerze`;
    return `${total} utworów`;
  }

  function folderDetailSubtitle(f, tracks) {
    const total = f.trackCount || tracks.length || 0;
    const onServer = f.downloadedTrackCount ?? f.fileCount ?? 0;
    const downloaded = tracks.filter((t) => t.downloadJobId).length;
    if (onServer > 0 && onServer < total) {
      return `${onServer} z ${total} na serwerze · odtwarzaj playlistę po kolei`;
    }
    if (downloaded > 0 && downloaded < total) {
      return `${downloaded} z ${total} pobranych · odtwarzaj playlistę po kolei`;
    }
    return `${total} utworów · odtwarzaj playlistę po kolei`;
  }

  async function api(path, opts = {}) {
    const r = await moviesApiFetch(path, opts);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    return data;
  }

  async function loadLibrary() {
    try {
      const data = await api("/api/music/library");
      state.folders = data.folders || [];
      state.tracks = data.tracks || [];
    } catch (err) {
      state.folders = [];
      state.tracks = [];
      if (/Brak konta/i.test(err.message || "")) throw err;
      throw err;
    }
    try {
      const fav = await api("/api/favorites");
      state.favorites = new Set((fav.items || fav || []).map((i) => i.url));
    } catch {
      state.favorites = new Set();
    }
  }

  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s || "";
    return d.innerHTML;
  }

  function renderHome() {
    state.view = "home";
    state.folder = null;
    const el = $("musicPanelBody");
    if (!el) return;

    const loginHint = window.__NC_LOGIN
      ? `<p class="music-section-sub">Konto: <strong>${esc(window.__NC_LOGIN)}</strong> — ta sama biblioteka co na Apple TV.</p>`
      : `<p class="music-section-sub" style="color:#ff9f0a">Nie wykryto loginu gry — otwórz Movies z panel.php (zielona kropka przy nicku).</p>`;

    el.innerHTML = `
      <p class="music-hero-label">APPLE MUSIC · MP3</p>
      <h2 class="music-section-title">Playlisty i foldery</h2>
      ${loginHint}
      <div class="music-search-row">
        <input id="musicCatalogQ" type="search" placeholder="Wykonawca, album, utwór…" />
        <button type="button" class="music-btn music-btn-primary" id="musicCatalogBtn">Szukaj</button>
      </div>
      <div id="musicCatalogResults"></div>
      <div class="music-toolbar">
        <button type="button" class="music-btn music-btn-primary" id="musicImportBtn">Importuj playlistę</button>
        <button type="button" class="music-btn" id="musicNewFolderBtn">Nowy folder</button>
      </div>
      <div class="music-grid" id="musicFolderGrid"></div>
    `;

    const grid = $("musicFolderGrid");
    if (!state.folders.length) {
      grid.innerHTML = '<p class="music-section-sub">Brak folderów — zaimportuj playlistę Apple Music.</p>';
    } else {
      grid.innerHTML = state.folders
        .map(
          (f) => `
        <button type="button" class="music-folder-card" data-folder-id="${esc(f.id)}">
          <div class="music-folder-cover">${f.thumbnail ? `<img src="${esc(f.thumbnail)}" alt="" />` : "🎵"}</div>
          <div class="music-folder-name">${esc(f.name)}</div>
          <div class="music-folder-meta">${folderCountLabel(f)}</div>
        </button>`
        )
        .join("");
      grid.querySelectorAll(".music-folder-card").forEach((btn) => {
        btn.onclick = () => openFolder(btn.dataset.folderId);
      });
    }

    $("musicImportBtn").onclick = () => $("musicImportModal").classList.add("open");
    $("musicNewFolderBtn").onclick = async () => {
      const name = prompt("Nazwa folderu:");
      if (!name?.trim()) return;
      await api("/api/music/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      await refresh();
    };
    $("musicCatalogBtn").onclick = runCatalogSearch;
    $("musicCatalogQ")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") runCatalogSearch();
    });
  }

  async function runCatalogSearch() {
    const q = $("musicCatalogQ")?.value?.trim();
    if (!q) return;
    const box = $("musicCatalogResults");
    box.innerHTML = '<p class="music-section-sub">Szukam…</p>';
    try {
      const data = await api(`/api/music/catalog/search?q=${encodeURIComponent(q)}`);
      const songs = data.songs || [];
      const artists = data.artists || [];
      const albums = data.albums || [];
      if (!songs.length && !artists.length && !albums.length) {
        box.innerHTML = '<p class="music-section-sub">Brak wyników.</p>';
        return;
      }
      box.innerHTML = `
        ${artists.length ? `<div class="music-catalog-section"><h3>Wykonawcy</h3><div class="music-chip-row">${artists.slice(0, 8).map((a) => `<button type="button" class="music-chip" data-artist="${esc(a.id)}">${esc(a.name)}</button>`).join("")}</div></div>` : ""}
        ${albums.length ? `<div class="music-catalog-section"><h3>Albumy</h3><div class="music-chip-row">${albums.slice(0, 8).map((a) => `<button type="button" class="music-chip" data-album="${esc(a.id)}">${esc(a.title)}</button>`).join("")}</div></div>` : ""}
        ${songs.length ? `<div class="music-catalog-section"><h3>Utwory</h3><div class="music-track-list">${songs.slice(0, 12).map((s, i) => trackRowHtml(s, i + 1, "catalog")).join("")}</div></div>` : ""}
      `;
      box.querySelectorAll("[data-artist]").forEach((b) => {
        b.onclick = () => openArtist(b.dataset.artist);
      });
      box.querySelectorAll("[data-album]").forEach((b) => {
        b.onclick = () => openAlbum(b.dataset.album);
      });
      bindTrackRows(box, songs.slice(0, 12));
    } catch (err) {
      box.innerHTML = `<p class="music-section-sub" style="color:#ff375f">${esc(err.message)}</p>`;
    }
  }

  function trackRowHtml(t, idx, ctx) {
    const sub = [t.uploader || t.artist, t.album].filter(Boolean).join(" · ");
    const dl = state.tracks.some((x) => x.url === t.url && x.downloadJobId);
    return `
      <button type="button" class="music-track-row" data-url="${esc(t.url)}" data-ctx="${ctx}">
        <span class="music-track-idx">${idx}</span>
        <div><div class="music-track-title">${esc(t.title)}</div><div class="music-track-sub">${esc(sub)}</div></div>
        ${dl ? '<span class="music-dl-ok">✓</span>' : "<span></span>"}
        <span class="music-track-dur">${fmtTime(t.duration)}</span>
      </button>`;
  }

  function bindTrackRows(root, tracks, asQueue) {
    root.querySelectorAll(".music-track-row").forEach((row) => {
      row.onclick = () => {
        const url = row.dataset.url;
        const track = tracks.find((t) => t.url === url) || state.folderTracks.find((t) => t.url === url);
        if (!track) return;
        if (asQueue) {
          startPlayerQueue(tracks, tracks.findIndex((t) => t.url === url));
        } else {
          const q = state.folderTracks.length ? state.folderTracks : [track];
          const idx = q.findIndex((t) => t.url === url);
          startPlayerQueue(q, Math.max(0, idx));
        }
      };
    });
  }

  async function openFolder(folderId) {
    const data = await api(`/api/music/folders/${folderId}/tracks`);
    state.folder = data.folder;
    state.folderTracks = data.tracks || [];
    state.view = "folder";
    renderFolder();
  }

  function renderFolder() {
    const el = $("musicPanelBody");
    const f = state.folder;
    if (!el || !f) return;
    el.innerHTML = `
      <button type="button" class="music-btn" id="musicBackHome">← Muzyka</button>
      <div style="display:flex;gap:20px;align-items:flex-start;margin:16px 0">
        ${f.thumbnail ? `<img src="${esc(f.thumbnail)}" alt="" style="width:120px;height:120px;border-radius:14px;object-fit:cover" />` : ""}
        <div>
          <h2 class="music-section-title">${esc(f.name)}</h2>
          <p class="music-section-sub">${folderDetailSubtitle(f, state.folderTracks)}</p>
        </div>
      </div>
      <div class="music-toolbar">
        ${f.applePlaylistUrl ? `<button type="button" class="music-btn" id="musicSyncBtn">Odśwież</button>` : `<button type="button" class="music-btn" id="musicLinkBtn">Powiąż playlistę</button>`}
        <button type="button" class="music-btn music-btn-primary" id="musicPlayAllBtn">Odtwórz playlistę</button>
        <button type="button" class="music-btn" id="musicDlAllBtn">Pobierz brakujące</button>
      </div>
      <div class="music-track-list" id="musicFolderTracks"></div>
    `;

    $("musicBackHome").onclick = () => renderHome();
    $("musicPlayAllBtn").onclick = () => {
      if (state.folderTracks.length) startPlayerQueue(state.folderTracks, 0);
    };
    $("musicSyncBtn") && ($("musicSyncBtn").onclick = syncFolder);
    $("musicLinkBtn") && ($("musicLinkBtn").onclick = () => {
      $("musicImportModal").classList.add("open");
      $("musicImportModal").dataset.folderId = f.id;
    });
    $("musicDlAllBtn").onclick = downloadMissingInFolder;

    const list = $("musicFolderTracks");
    list.innerHTML = state.folderTracks
      .map((t, i) => {
        const sub = [t.artist, t.album].filter(Boolean).join(" · ");
        const dl = t.downloadJobId ? '<span class="music-dl-ok">✓</span>' : "<span></span>";
        return `
        <div class="music-track-row-wrap">
        <button type="button" class="music-track-row" data-url="${esc(t.url)}">
          <span class="music-track-idx">${i + 1}</span>
          <div><div class="music-track-title">${esc(t.title)}</div><div class="music-track-sub">${esc(sub)}</div></div>
          ${dl}
          <span class="music-track-dur">${fmtTime(t.duration)}</span>
        </button>
        <button type="button" class="music-btn music-track-add-btn" data-add-url="${esc(t.url)}" title="Dodaj do innej playlisty">＋</button>
        </div>`;
      })
      .join("");
    bindTrackRows(list, state.folderTracks, true);
    list.querySelectorAll(".music-track-add-btn").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const track = state.folderTracks.find((t) => t.url === btn.dataset.addUrl);
        if (track) openAddToPlaylistModal(track);
      };
    });
  }

  async function syncFolder() {
    if (!state.folder) return;
    try {
      const data = await api(`/api/music/folders/${state.folder.id}/sync-playlist`, { method: "POST" });
      alert(data.added ? `Dodano ${data.added} nowych utworów.` : "Playlista aktualna.");
      await openFolder(state.folder.id);
    } catch (err) {
      alert(err.message);
    }
  }

  async function downloadMissingInFolder() {
    for (const t of state.folderTracks) {
      if (t.downloadJobId) continue;
      try {
        const r = await api("/api/download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: t.url, folderId: state.folder.id, trackUrl: t.url }),
        });
        const jobId = r.jobId;
        await waitJob(jobId);
        await api(`/api/music/folders/${state.folder.id}/tracks/download`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: t.url, downloadJobId: jobId }),
        });
      } catch (e) {
        console.warn("download", t.title, e);
      }
    }
    await openFolder(state.folder.id);
  }

  async function waitJob(jobId) {
    for (let i = 0; i < 120; i++) {
      const j = await api(`/api/job/${jobId}`);
      if (j.ready || j.status === "done") return;
      if (j.status === "error") throw new Error(j.error || "Błąd pobierania");
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  function rebuildPlayOrder(startIdx) {
    state.playOrder = state.queue.map((_, i) => i);
    if (state.shuffle) {
      for (let i = state.playOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [state.playOrder[i], state.playOrder[j]] = [state.playOrder[j], state.playOrder[i]];
      }
      const pos = state.playOrder.indexOf(startIdx);
      if (pos > 0) {
        state.playOrder.splice(pos, 1);
        state.playOrder.unshift(startIdx);
      }
    }
    state.orderCursor = state.playOrder.indexOf(startIdx);
    if (state.orderCursor < 0) state.orderCursor = 0;
  }

  function normalizeTrack(raw) {
    return {
      url: raw.url,
      title: raw.title,
      artist: raw.artist || raw.uploader,
      album: raw.album,
      thumbnail: raw.thumbnail,
      duration: raw.duration,
      folderId: raw.folderId || state.folder?.id,
      downloadJobId: raw.downloadJobId,
      artistId: raw.artistId || "",
      albumId: raw.albumId || "",
    };
  }

  function currentTrack() {
    const idx = state.playOrder[state.orderCursor];
    return state.queue[idx] || null;
  }

  function showPlayerBrowse() {
    const box = $("musicPlayerBrowse");
    const overlay = $("musicPlayerOverlay");
    if (!box) return;
    box.classList.remove("hidden");
    box.setAttribute("aria-hidden", "false");
    overlay?.classList.add("music-player-browsing");
  }

  function hidePlayerBrowse() {
    const box = $("musicPlayerBrowse");
    const overlay = $("musicPlayerOverlay");
    if (!box) return;
    box.classList.add("hidden");
    box.setAttribute("aria-hidden", "true");
    box.innerHTML = "";
    overlay?.classList.remove("music-player-browsing");
  }

  function albumCardHtml(a) {
    const thumb = a.thumbnail
      ? `<img src="${esc(a.thumbnail)}" alt="" />`
      : '<div style="aspect-ratio:1;background:rgba(255,255,255,.06);border-radius:10px"></div>';
    const year = a.releaseDate ? String(a.releaseDate).slice(0, 4) : "";
    return `
      <button type="button" class="music-album-card" data-album="${esc(a.id)}">
        ${thumb}
        <div class="music-album-card-title">${esc(a.title)}</div>
        <div class="music-album-card-meta">${esc([year, a.artist].filter(Boolean).join(" · "))}</div>
      </button>`;
  }

  async function resolveArtistId(track) {
    if (track?.artistId) return track.artistId;
    const name = String(track?.artist || "").trim();
    if (!name) return null;
    try {
      const data = await api(`/api/music/catalog/search?q=${encodeURIComponent(name)}`);
      const hit =
        (data.artists || []).find((a) => a.name?.toLowerCase() === name.toLowerCase()) ||
        (data.artists || [])[0];
      return hit?.id || null;
    } catch {
      return null;
    }
  }

  async function renderArtistBrowse(artistId, opts = {}) {
    const target = opts.inPlayer ? $("musicPlayerBrowse") : $("musicCatalogResults");
    if (!target) return;
    if (opts.inPlayer) showPlayerBrowse();
    target.innerHTML = '<p class="music-section-sub">Wczytuję wykonawcę…</p>';
    const data = await api(`/api/music/catalog/artist/${artistId}`);
    const songs = data.topSongs || [];
    const albums = data.albums || [];
    target.innerHTML = `
      <div class="music-catalog-section">
        <button type="button" class="music-btn" data-browse-back>← ${opts.inPlayer ? "Player" : "Wróć"}</button>
        <h3 class="music-section-title">${esc(data.artist?.name)}</h3>
        ${albums.length ? `<h4 class="music-section-sub" style="margin-top:14px">Albumy</h4><div class="music-grid" style="margin-top:10px">${albums.slice(0, 24).map(albumCardHtml).join("")}</div>` : ""}
        ${songs.length ? `<h4 class="music-section-sub" style="margin-top:18px">Popularne utwory</h4><div class="music-track-list">${songs.map((t, i) => trackRowHtml(t, i + 1, "catalog")).join("")}</div>` : ""}
      </div>`;
    target.querySelector("[data-browse-back]")?.addEventListener("click", () => {
      if (opts.inPlayer) hidePlayerBrowse();
      else target.innerHTML = "";
    });
    target.querySelectorAll("[data-album]").forEach((btn) => {
      btn.onclick = () => openAlbum(btn.dataset.album, { inPlayer: opts.inPlayer });
    });
    bindTrackRows(target, songs);
  }

  async function openArtist(id, opts = {}) {
    if (!id) return;
    await renderArtistBrowse(id, opts);
  }

  async function openArtistFromPlayer() {
    const track = currentTrack();
    if (!track) return;
    const id = await resolveArtistId(track);
    if (!id) {
      alert("Nie udało się znaleźć wykonawcy w katalogu Apple Music.");
      return;
    }
    track.artistId = id;
    await openArtist(id, { inPlayer: true });
  }

  async function openAlbumFromPlayer() {
    const track = currentTrack();
    if (!track?.albumId) {
      alert("Brak albumu dla tego utworu.");
      return;
    }
    await openAlbum(track.albumId, { inPlayer: true });
  }

  function startPlayerQueue(tracks, startIndex) {
    state.queue = tracks.map(normalizeTrack);
    rebuildPlayOrder(startIndex);
    $("musicPlayerOverlay").classList.add("open");
    playAtOrderCursor();
  }

  async function resolveStreamUrl(track) {
    let jobId = track.downloadJobId;
    if (!jobId) {
      const lib = state.tracks.find((t) => t.url === track.url);
      jobId = lib?.downloadJobId;
    }
    if (jobId) {
      try {
        const tok = await api(`/api/music/play-token/${jobId}`);
        return apiUrl(`/api/music/stream/${jobId}?token=${encodeURIComponent(tok.token)}`);
      } catch {
        /* fall through */
      }
    }
    const play = await api("/api/music/play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: track.url }),
    });
    jobId = play.jobId;
    for (let i = 0; i < 90; i++) {
      const j = await api(`/api/job/${jobId}`);
      if (j.ready || j.status === "done") break;
      if (j.status === "error") throw new Error(j.error || "Błąd streamu");
      await new Promise((r) => setTimeout(r, 500));
    }
    const tok = await api(`/api/music/play-token/${jobId}`);
    return apiUrl(`/api/music/stream/${jobId}?token=${encodeURIComponent(tok.token)}`);
  }

  async function playAtOrderCursor() {
    const idx = state.playOrder[state.orderCursor];
    const track = state.queue[idx];
    if (!track) return;
    state.queueIndex = idx;
    updatePlayerUI(track);

    stopAudio();
    try {
      const src = await resolveStreamUrl(track);
      state.audio = new Audio(src);
      state.audio.crossOrigin = "anonymous";
      setupAnalyser(state.audio);
      state.audio.onended = () => skipNext();
      state.audio.onerror = () => alert("Nie udało się odtworzyć utworu.");
      await state.audio.play();
      setupMediaSession(track);
      startOscillograph();
    } catch (err) {
      alert(err.message || "Błąd odtwarzania");
    }
  }

  function stopAudio() {
    if (state.animFrame) cancelAnimationFrame(state.animFrame);
    state.animFrame = null;
    if (state.audio) {
      state.audio.pause();
      state.audio.src = "";
      state.audio = null;
    }
    if (state.audioCtx) {
      try {
        state.audioCtx.close();
      } catch {
        /* ignore */
      }
      state.audioCtx = null;
      state.analyser = null;
    }
  }

  function setupAnalyser(audio) {
    try {
      state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const src = state.audioCtx.createMediaElementSource(audio);
      state.analyser = state.audioCtx.createAnalyser();
      state.analyser.fftSize = 128;
      src.connect(state.analyser);
      state.analyser.connect(state.audioCtx.destination);
    } catch {
      /* CORS or unsupported */
    }
  }

  function startOscillograph() {
    const canvas = $("musicOscCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const buf = state.analyser ? new Uint8Array(state.analyser.frequencyBinCount) : null;

    const draw = () => {
      state.animFrame = requestAnimationFrame(draw);
      const w = (canvas.width = canvas.offsetWidth * devicePixelRatio);
      const h = (canvas.height = canvas.offsetHeight * devicePixelRatio);
      ctx.clearRect(0, 0, w, h);
      const bars = 40;
      const gap = 4 * devicePixelRatio;
      const barW = (w - gap * (bars - 1)) / bars;
      for (let i = 0; i < bars; i++) {
        let v = 0.08;
        if (buf && state.analyser) {
          state.analyser.getByteFrequencyData(buf);
          const idx = Math.floor((i / bars) * buf.length);
          v = Math.max(0.06, buf[idx] / 255);
        } else if (state.audio && !state.audio.paused) {
          v = 0.15 + Math.random() * 0.35;
        }
        const bh = h * 0.42 * v;
        const x = i * (barW + gap);
        const grad = ctx.createLinearGradient(0, h, 0, h - bh);
        grad.addColorStop(0, "#ff375f");
        grad.addColorStop(0.5, "#bf5af2");
        grad.addColorStop(1, "#5ac8fa");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, h / 2 - bh / 2, barW, bh, barW / 2);
        ctx.fill();
      }
    };
    draw();
  }

  function setupMediaSession(track) {
    if (!navigator.mediaSession) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist || "",
      album: track.album || "",
      artwork: track.thumbnail ? [{ src: track.thumbnail, sizes: "512x512", type: "image/jpeg" }] : [],
    });
    navigator.mediaSession.setActionHandler("play", () => state.audio?.play());
    navigator.mediaSession.setActionHandler("pause", () => state.audio?.pause());
    navigator.mediaSession.setActionHandler("previoustrack", () => skipPrev());
    navigator.mediaSession.setActionHandler("nexttrack", () => skipNext());
  }

  function skipNext() {
    if (state.orderCursor < state.playOrder.length - 1) state.orderCursor++;
    else if (state.repeat === "all") state.orderCursor = 0;
    else return;
    playAtOrderCursor();
  }

  function skipPrev() {
    if (state.audio && state.audio.currentTime > 3) {
      state.audio.currentTime = 0;
      return;
    }
    if (state.orderCursor > 0) state.orderCursor--;
    else if (state.repeat === "all") state.orderCursor = state.playOrder.length - 1;
    else return;
    playAtOrderCursor();
  }

  function updatePlayerUI(track) {
    $("musicPlayerTitle").textContent = track.title;
    const artistBtn = $("musicPlayerArtistBtn");
    const albumBtn = $("musicPlayerAlbumBtn");
    if (track.artist && artistBtn) {
      artistBtn.textContent = track.artist;
      artistBtn.hidden = false;
    } else if (artistBtn) {
      artistBtn.hidden = true;
    }
    if (track.album && albumBtn) {
      albumBtn.textContent = track.album;
      albumBtn.hidden = false;
    } else if (albumBtn) {
      albumBtn.hidden = true;
    }
    $("musicPlayerPos").textContent = `${state.orderCursor + 1} / ${state.queue.length}`;
    const art = $("musicPlayerArt");
    if (track.thumbnail) {
      art.src = track.thumbnail;
      art.style.display = "block";
    } else {
      art.style.display = "none";
    }
    $("musicFavBtn").textContent = state.favorites.has(track.url) ? "♥ Ulubione" : "♡ Ulubione";
    const openPl = $("musicOpenPlaylistBtn");
    if (openPl) {
      const hasFolder = !!(track.folderId && state.folders.some((f) => f.id === track.folderId));
      openPl.hidden = !hasFolder;
    }
    hidePlayerBrowse();
  }

  function trackPayload(track) {
    return {
      url: track.url,
      title: track.title,
      artist: track.artist,
      album: track.album,
      thumbnail: track.thumbnail,
      duration: track.duration,
      artistId: track.artistId || undefined,
      albumId: track.albumId || undefined,
      source: "apple-music",
    };
  }

  function openAddToPlaylistModal(track) {
    const modal = $("musicAddToPlaylistModal");
    const list = $("musicAddToPlaylistList");
    if (!modal || !list || !track) return;
    $("musicAddToPlaylistTrack").textContent = `${track.title}${track.artist ? ` · ${track.artist}` : ""}`;
    if (!state.folders.length) {
      list.innerHTML = '<p class="music-section-sub">Brak folderów — utwórz nowy.</p>';
    } else {
      list.innerHTML = state.folders
        .map(
          (f) => `
        <button type="button" class="music-playlist-pick-row" data-folder-id="${esc(f.id)}">
          ${f.thumbnail ? `<img src="${esc(f.thumbnail)}" alt="" />` : '<span style="width:44px;text-align:center">🎵</span>'}
          <span>
            <div style="font-weight:600">${esc(f.name)}</div>
            <div style="font-size:12px;opacity:.55">${folderCountLabel(f)}</div>
          </span>
        </button>`
        )
        .join("");
      list.querySelectorAll("[data-folder-id]").forEach((btn) => {
        btn.onclick = async () => {
          try {
            await api(`/api/music/folders/${btn.dataset.folderId}/tracks`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ track: trackPayload(track) }),
            });
            modal.classList.remove("open");
            await loadLibrary();
            alert(`Dodano do «${state.folders.find((f) => f.id === btn.dataset.folderId)?.name || "playlisty"}».`);
          } catch (err) {
            alert(err.message || "Nie udało się dodać utworu.");
          }
        };
      });
    }
    modal.dataset.trackUrl = track.url;
    modal.classList.add("open");
  }

  function openCurrentPlaylist() {
    const track = currentTrack();
    if (!track?.folderId) return;
    closePlayer();
    openFolder(track.folderId);
  }

  function bindPlayerControls() {
    $("musicPlayerClose").onclick = closePlayer;
    $("musicPlayPauseBtn").onclick = () => {
      if (!state.audio) return;
      if (state.audio.paused) state.audio.play();
      else state.audio.pause();
    };
    $("musicNextBtn").onclick = () => skipNext();
    $("musicPrevBtn").onclick = () => skipPrev();
    $("musicShuffleBtn").onclick = () => {
      state.shuffle = !state.shuffle;
      $("musicShuffleBtn").style.color = state.shuffle ? "#30d158" : "";
      rebuildPlayOrder(state.queueIndex);
    };
    $("musicRepeatBtn").onclick = () => {
      state.repeat = state.repeat === "all" ? "one" : state.repeat === "one" ? "off" : "all";
      const labels = { all: "Powt. playlistę", one: "Powt. utwór", off: "Bez powt." };
      $("musicRepeatBtn").textContent = labels[state.repeat];
    };
    $("musicFavBtn").onclick = async () => {
      const track = currentTrack();
      if (!track) return;
      try {
        if (state.favorites.has(track.url)) {
          await api(`/api/favorites?url=${encodeURIComponent(track.url)}`, { method: "DELETE" });
          state.favorites.delete(track.url);
        } else {
          await api("/api/favorites", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              item: {
                id: track.url,
                type: "music",
                url: track.url,
                title: track.title,
                thumbnail: track.thumbnail,
                source: "apple-music",
                detail: track.artist,
                duration: track.duration,
              },
            }),
          });
          state.favorites.add(track.url);
        }
        updatePlayerUI(track);
      } catch (err) {
        alert(err.message);
      }
    };
    $("musicPlayerArtistBtn")?.addEventListener("click", () => openArtistFromPlayer());
    $("musicPlayerAlbumBtn")?.addEventListener("click", () => openAlbumFromPlayer());
    $("musicAddPlaylistBtn")?.addEventListener("click", () => {
      const track = currentTrack();
      if (track) openAddToPlaylistModal(track);
    });
    $("musicOpenPlaylistBtn")?.addEventListener("click", () => openCurrentPlaylist());
    $("musicAddToPlaylistCancel")?.addEventListener("click", () => {
      $("musicAddToPlaylistModal")?.classList.remove("open");
    });
    $("musicAddToPlaylistNew")?.addEventListener("click", async () => {
      const name = prompt("Nazwa nowej playlisty:");
      if (!name?.trim()) return;
      try {
        const created = await api("/api/music/folders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() }),
        });
        await loadLibrary();
        const track =
          currentTrack() ||
          state.folderTracks.find((t) => t.url === $("musicAddToPlaylistModal")?.dataset.trackUrl);
        if (track && created.folder?.id) {
          await api(`/api/music/folders/${created.folder.id}/tracks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ track: trackPayload(track) }),
          });
        }
        $("musicAddToPlaylistModal")?.classList.remove("open");
        await refresh();
        alert("Utworzono playlistę i dodano utwór.");
      } catch (err) {
        alert(err.message);
      }
    });

    $("musicProgress")?.addEventListener("input", (e) => {
      if (!state.audio || !state.audio.duration) return;
      state.audio.currentTime = (Number(e.target.value) / 100) * state.audio.duration;
    });

    setInterval(() => {
      if (!state.audio || !$("musicPlayerOverlay").classList.contains("open")) return;
      $("musicTimeCur").textContent = fmtTime(state.audio.currentTime);
      $("musicTimeDur").textContent = fmtTime(state.audio.duration || 0);
      const prog = $("musicProgress");
      if (prog && state.audio.duration) prog.value = (state.audio.currentTime / state.audio.duration) * 100;
      $("musicPlayPauseBtn").textContent = state.audio.paused ? "▶" : "⏸";
    }, 400);
  }

  function closePlayer() {
    stopAudio();
    hidePlayerBrowse();
    $("musicPlayerOverlay").classList.remove("open");
    if (navigator.mediaSession) navigator.mediaSession.metadata = null;
  }

  async function openAlbum(id, opts = {}) {
    const target = opts.inPlayer ? $("musicPlayerBrowse") : $("musicCatalogResults");
    if (!target) return;
    if (opts.inPlayer) {
      showPlayerBrowse();
      target.innerHTML = '<p class="music-section-sub">Wczytuję album…</p>';
    }
    const data = await api(`/api/music/catalog/album/${id}`);
    if (!target) return;
    target.innerHTML = `
      <div class="music-catalog-section">
        <button type="button" class="music-btn" data-browse-back>← ${opts.inPlayer ? "Player" : "Wróć"}</button>
        <h3 class="music-section-title">${esc(data.album?.title)}</h3>
        <p class="music-section-sub">${esc([data.album?.artist, data.album?.releaseDate?.slice?.(0, 4)].filter(Boolean).join(" · "))}</p>
        <div class="music-track-list">${(data.tracks || []).map((t, i) => trackRowHtml(t, i + 1, "catalog")).join("")}</div>
      </div>`;
    target.querySelector("[data-browse-back]")?.addEventListener("click", () => {
      if (opts.inPlayer) hidePlayerBrowse();
      else target.innerHTML = "";
    });
    bindTrackRows(target, data.tracks || []);
  }

  async function importPlaylist(url, folderId) {
    const body = { url };
    if (folderId) body.folderId = folderId;
    await api("/api/music/playlists/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    $("musicImportModal").classList.remove("open");
    delete $("musicImportModal").dataset.folderId;
    await refresh();
  }

  async function refresh() {
    try {
      await loadLibrary();
    } catch (err) {
      const el = $("musicPanelBody");
      if (el) {
        el.innerHTML = `<p class="music-section-sub" style="color:#ff375f">${esc(err.message || "Nie udało się wczytać biblioteki.")}</p>`;
      }
      return;
    }
    if (state.view === "folder" && state.folder) await openFolder(state.folder.id);
    else renderHome();
  }

  window.MusicUI = {
    async init() {
      bindPlayerControls();
      $("musicImportCancel")?.addEventListener("click", () => {
        $("musicImportModal").classList.remove("open");
      });
      $("musicImportConfirm")?.addEventListener("click", async () => {
        const url = $("musicImportUrl")?.value?.trim();
        if (!url) return;
        try {
          await importPlaylist(url, $("musicImportModal").dataset.folderId || null);
        } catch (err) {
          alert(err.message);
        }
      });
      await refresh();
    },
    onTabShow() {
      document.body.classList.add("music-mode");
      refresh();
    },
    onTabHide() {
      document.body.classList.remove("music-mode");
      closePlayer();
    },
  };
})();
