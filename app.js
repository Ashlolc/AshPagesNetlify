"use strict";

/**
 * AshGames
 * - Orange glassmorph UI
 * - Cards with Play buttons that open links
 * - Search + category filter + sorting
 * - Add Game modal (saved to localStorage)
 */

const STORAGE_KEY = "ashgames_v1";

const DEFAULT_GAMES = [
  {
    id: cryptoRandom(),
    name: "AvZ",
    emoji: "🌿",
    url: "https://avza.netlify.app/",
    category: "Strategy",
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
    target: "blank"
  },
  {
    id: cryptoRandom(),
    name: "AshDash",
    emoji: "🟧",
    url: "https://ashdash.netlify.app/",
    category: "Platformer",
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
    target: "blank"
  },
];

const els = {
  grid: document.getElementById("gameGrid"),
  search: document.getElementById("searchInput"),
  clearSearch: document.getElementById("clearSearch"),
  chipRow: document.getElementById("chipRow"),
  sort: document.getElementById("sortSelect"),
  statCount: document.getElementById("statCount"),
  statShown: document.getElementById("statShown"),

  addBtn: document.getElementById("addBtn"),
  resetBtn: document.getElementById("resetBtn"),

  modal: document.getElementById("modal"),
  closeModal: document.getElementById("closeModal"),
  cancelAdd: document.getElementById("cancelAdd"),
  addForm: document.getElementById("addForm"),
  nameInput: document.getElementById("nameInput"),
  emojiInput: document.getElementById("emojiInput"),
  urlInput: document.getElementById("urlInput"),
  catInput: document.getElementById("catInput"),
  targetSelect: document.getElementById("targetSelect"),
};

let state = {
  games: loadGames(),
  query: "",
  category: "All",
  sort: "name-asc",
};

init();

function init() {
  render();

  // Search
  els.search.addEventListener("input", () => {
    state.query = els.search.value.trim();
    render();
  });

  els.clearSearch.addEventListener("click", () => {
    els.search.value = "";
    state.query = "";
    render();
    els.search.focus();
  });

  // Sort
  els.sort.addEventListener("change", () => {
    state.sort = els.sort.value;
    render();
  });

  // Add
  els.addBtn.addEventListener("click", openModal);
  els.closeModal.addEventListener("click", closeModal);
  els.cancelAdd.addEventListener("click", closeModal);

  // Close modal by clicking backdrop
  els.modal.addEventListener("click", (e) => {
    const target = e.target;
    if (target && target.dataset && target.dataset.close === "true") closeModal();
  });

  // ESC closes modal
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isModalOpen()) closeModal();
  });

  // Reset
  els.resetBtn.addEventListener("click", () => {
    state.games = structuredClone(DEFAULT_GAMES);
    state.category = "All";
    state.query = "";
    els.search.value = "";
    saveGames(state.games);
    render();
  });

  // Submit add form
  els.addForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const name = els.nameInput.value.trim();
    const emoji = (els.emojiInput.value || "🎮").trim().slice(0, 2);
    const url = els.urlInput.value.trim();
    const category = (els.catInput.value || "Unsorted").trim();
    const target = els.targetSelect.value === "self" ? "self" : "blank";

    const cleaned = sanitizeUrl(url);
    if (!cleaned) {
      shake(els.urlInput);
      return;
    }

    const game = {
      id: cryptoRandom(),
      name: name || "Untitled",
      emoji,
      url: cleaned,
      category: category || "Unsorted",
      createdAt: Date.now(),
      target,
    };

    state.games.unshift(game);
    saveGames(state.games);
    closeModal(true);
    render();
  });

  // Delegate card button clicks
  els.grid.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const game = state.games.find(g => g.id === id);
    if (!game) return;

    if (action === "play") openGame(game);
    if (action === "copy") copyLink(game.url, btn);
    if (action === "delete") deleteGame(id);
  });
}

function render() {
  const categories = ["All", ...unique(state.games.map(g => (g.category || "Unsorted").trim() || "Unsorted"))]
    .sort((a,b) => a.localeCompare(b));

  renderChips(categories);

  const filtered = applyFilters(state.games, state.query, state.category);
  const sorted = applySort(filtered, state.sort);

  els.statCount.textContent = String(state.games.length);
  els.statShown.textContent = String(sorted.length);

  if (sorted.length === 0) {
    els.grid.innerHTML = emptyStateHTML();
    return;
  }

  els.grid.innerHTML = sorted.map(gameCardHTML).join("");
}

function renderChips(categories) {
  els.chipRow.innerHTML = categories.map(cat => {
    const active = cat === state.category ? "active" : "";
    return `<button class="chip ${active}" type="button" data-chip="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`;
  }).join("");

  // one-time delegate
  if (!els.chipRow.dataset.bound) {
    els.chipRow.dataset.bound = "true";
    els.chipRow.addEventListener("click", (e) => {
      const chip = e.target.closest("button[data-chip]");
      if (!chip) return;
      state.category = chip.dataset.chip;
      render();
    });
  }
}

function applyFilters(games, query, category) {
  const q = (query || "").toLowerCase();
  return games.filter(g => {
    const inCat = (category === "All") || ((g.category || "Unsorted") === category);
    if (!inCat) return false;

    if (!q) return true;
    const hay = `${g.name} ${g.category} ${g.url}`.toLowerCase();
    return hay.includes(q);
  });
}

function applySort(games, mode) {
  const arr = [...games];
  if (mode === "name-asc") arr.sort((a,b) => a.name.localeCompare(b.name));
  if (mode === "name-desc") arr.sort((a,b) => b.name.localeCompare(a.name));
  if (mode === "newest") arr.sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
  if (mode === "oldest") arr.sort((a,b) => (a.createdAt||0) - (b.createdAt||0));
  return arr;
}

function gameCardHTML(g) {
  const emoji = g.emoji ? escapeHtml(g.emoji) : "🎮";
  const name = escapeHtml(g.name || "Untitled");
  const cat = escapeHtml((g.category || "Unsorted").trim() || "Unsorted");

  const niceUrl = safePrettyUrl(g.url);

  return `
    <article class="card" aria-label="${name}">
      <div class="cardTop">
        <div class="cardTitle">
          <span style="font-size:18px" aria-hidden="true">${emoji}</span>
          <span>${name}</span>
        </div>
        <span class="badge">${cat}</span>
      </div>

      <div class="cardMeta">
        ${escapeHtml(niceUrl)}
      </div>

      <div class="cardActions">
        <button class="pill" type="button" data-action="play" data-id="${g.id}">
          Play
        </button>
        <button class="pill linkBtn" type="button" data-action="copy" data-id="${g.id}">
          Copy link
        </button>
        <button class="pill ghost" type="button" data-action="delete" data-id="${g.id}" title="Remove">
          Delete
        </button>
      </div>
    </article>
  `;
}

function emptyStateHTML() {
  return `
    <div class="card" style="grid-column: span 12;">
      <div class="cardTitle" style="font-size:18px;">
        <span aria-hidden="true">🟠</span>
        <span>No games match that.</span>
      </div>
      <div class="cardMeta" style="margin-top:10px;">
        Try clearing search, switching categories, or adding a new game link.
      </div>
      <div class="cardActions">
        <button class="pill" type="button" id="emptyAdd">Add Game</button>
        <button class="pill ghost" type="button" id="emptyClear">Clear search</button>
      </div>
    </div>
  `;
}

// Because empty state buttons are created dynamically
document.addEventListener("click", (e) => {
  if (e.target && e.target.id === "emptyAdd") openModal();
  if (e.target && e.target.id === "emptyClear") {
    els.search.value = "";
    state.query = "";
    render();
  }
});

function openGame(game) {
  const url = game.url;
  const target = game.target === "self" ? "_self" : "_blank";

  if (target === "_self") {
    window.location.href = url;
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

function deleteGame(id) {
  state.games = state.games.filter(g => g.id !== id);
  saveGames(state.games);

  // if current category disappeared, fallback
  const cats = unique(state.games.map(g => (g.category || "Unsorted").trim() || "Unsorted"));
  if (state.category !== "All" && !cats.includes(state.category)) state.category = "All";

  render();
}

async function copyLink(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    pulse(btn, "Copied!");
  } catch {
    // fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    pulse(btn, "Copied!");
  }
}

function openModal() {
  els.modal.classList.add("show");
  els.modal.setAttribute("aria-hidden", "false");

  // reset fields
  els.addForm.reset();
  els.emojiInput.value = "🎮";
  els.catInput.value = "";
  els.targetSelect.value = "blank";

  setTimeout(() => els.nameInput.focus(), 0);
}

function closeModal(didAdd = false) {
  els.modal.classList.remove("show");
  els.modal.setAttribute("aria-hidden", "true");
  if (didAdd) {
    // clear search so the new game is visible
    state.query = "";
    els.search.value = "";
  }
}

function isModalOpen() {
  return els.modal.classList.contains("show");
}

/* storage */
function loadGames() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_GAMES);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return structuredClone(DEFAULT_GAMES);

    // light validation
    return parsed
      .filter(g => g && typeof g.url === "string" && typeof g.name === "string")
      .map(g => ({
        id: typeof g.id === "string" ? g.id : cryptoRandom(),
        name: g.name.slice(0, 40),
        emoji: (g.emoji || "🎮").slice(0, 2),
        url: sanitizeUrl(g.url) || "https://example.com",
        category: (g.category || "Unsorted").slice(0, 20),
        createdAt: typeof g.createdAt === "number" ? g.createdAt : Date.now(),
        target: g.target === "self" ? "self" : "blank",
      }));
  } catch {
    return structuredClone(DEFAULT_GAMES);
  }
}

function saveGames(games) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
  } catch {
    // ignore
  }
}

/* helpers */
function unique(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function sanitizeUrl(input) {
  if (!input) return null;
  let v = input.trim();

  // allow "example.com" -> https://example.com
  if (!/^https?:\/\//i.test(v)) v = "https://" + v;

  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

function safePrettyUrl(url) {
  try {
    const u = new URL(url);
    const host = u.host.replace(/^www\./, "");
    const path = u.pathname.length > 20 ? (u.pathname.slice(0, 20) + "…") : u.pathname;
    return host + path;
  } catch {
    return url;
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cryptoRandom() {
  if (crypto && crypto.getRandomValues) {
    const buf = new Uint32Array(4);
    crypto.getRandomValues(buf);
    return [...buf].map(n => n.toString(16)).join("-");
  }
  return String(Math.random()).slice(2) + "-" + Date.now();
}

function pulse(btn, text) {
  const old = btn.textContent;
  btn.textContent = text;
  btn.style.transform = "translateY(-1px)";
  setTimeout(() => {
    btn.textContent = old;
    btn.style.transform = "";
  }, 650);
}

function shake(el) {
  el.animate(
    [{ transform: "translateX(0px)" }, { transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(0px)" }],
    { duration: 240, iterations: 1 }
  );
}
