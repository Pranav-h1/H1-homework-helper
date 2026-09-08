// Quotes Factory — browse, search, filter, favorite, copy, and share from the full 200-quote
// vault in quotesData.js. Favorites persist through the same safeGetJson/safeSetJson pattern
// used everywhere else in H1; nothing here is faked (search/filter run against the real
// array, "random" genuinely randomizes, share only appears where navigator.share exists).
import { QUOTES, CATEGORY_LABELS, CATEGORY_ORDER, H1_FAVORITE_IDS, isShortAndPowerful } from "./quotesData.js";
import { safeGetJson, safeSetJson } from "./storage.js";
import { showToast } from "./toast.js";

const FAVORITES_KEY = "h1-quote-favorites";

const featuredText = document.getElementById("quotesFeaturedText");
const featuredCategory = document.getElementById("quotesFeaturedCategory");
const inspireBtn = document.getElementById("quotesInspireBtn");
const featuredFavBtn = document.getElementById("quotesFeaturedFavBtn");
const featuredCopyBtn = document.getElementById("quotesFeaturedCopyBtn");
const featuredShareBtn = document.getElementById("quotesFeaturedShareBtn");
const searchInput = document.getElementById("quotesSearchInput");
const countEl = document.getElementById("quotesCount");
const chipRow = document.getElementById("quotesCategoryChips");
const emptyState = document.getElementById("quotesEmptyState");
const grid = document.getElementById("quotesGrid");

let favorites = new Set(safeGetJson(FAVORITES_KEY, []));
let activeFilter = "all";
let query = "";
let featuredQuote = null;

function saveFavorites() {
  safeSetJson(FAVORITES_KEY, [...favorites]);
}

function isFavorite(id) {
  return favorites.has(id);
}

function toggleFavorite(id) {
  if (favorites.has(id)) favorites.delete(id);
  else favorites.add(id);
  saveFavorites();
}

async function copyQuote(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    showToast("Quote copied!", "success", 1800);
  } catch {
    showToast("Couldn't copy that quote.", "error");
  }
}

function shareQuote(text) {
  if (!navigator.share) return;
  navigator.share({ text: `"${text}" — H1 Quotes Factory` }).catch(() => {
    // Share sheet dismissed or unavailable mid-call — no error needed, this isn't a failure.
  });
}

function pickRandomQuote(excludeId) {
  if (QUOTES.length <= 1) return QUOTES[0];
  let next = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  let attempts = 0;
  while (next.id === excludeId && attempts < 10) {
    next = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    attempts += 1;
  }
  return next;
}

function renderFeatured(quote) {
  featuredQuote = quote;
  featuredText.textContent = `“${quote.text}”`;
  featuredCategory.textContent = CATEGORY_LABELS[quote.category];
  featuredFavBtn.setAttribute("aria-pressed", String(isFavorite(quote.id)));
  featuredText.style.animation = "none";
  // Force a reflow so the fade-in keyframe replays on every new quote, not just the first render.
  void featuredText.offsetWidth;
  featuredText.style.animation = "";
}

inspireBtn.addEventListener("click", () => {
  renderFeatured(pickRandomQuote(featuredQuote?.id));
});

featuredFavBtn.addEventListener("click", () => {
  if (!featuredQuote) return;
  toggleFavorite(featuredQuote.id);
  featuredFavBtn.setAttribute("aria-pressed", String(isFavorite(featuredQuote.id)));
  renderGrid();
});

featuredCopyBtn.addEventListener("click", () => featuredQuote && copyQuote(featuredQuote.text));
featuredShareBtn.addEventListener("click", () => featuredQuote && shareQuote(featuredQuote.text));

function buildChips() {
  const chips = [
    { key: "all", label: "All quotes" },
    { key: "favorites", label: "★ Favorites" },
    { key: "h1", label: "H1 Favorites" },
    { key: "short", label: "Short & Powerful" },
    ...CATEGORY_ORDER.map((key) => ({ key, label: CATEGORY_LABELS[key] })),
  ];
  chipRow.innerHTML = "";
  chips.forEach(({ key, label }) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip" + (key === activeFilter ? " active" : "");
    btn.textContent = label;
    btn.addEventListener("click", () => {
      activeFilter = key;
      buildChips();
      renderGrid();
    });
    chipRow.appendChild(btn);
  });
}

function matchesFilter(quote) {
  if (activeFilter === "all") return true;
  if (activeFilter === "favorites") return isFavorite(quote.id);
  if (activeFilter === "h1") return H1_FAVORITE_IDS.has(quote.id);
  if (activeFilter === "short") return isShortAndPowerful(quote.text);
  return quote.category === activeFilter;
}

function matchesQuery(quote) {
  if (!query) return true;
  const q = query.toLowerCase();
  return quote.text.toLowerCase().includes(q) || CATEGORY_LABELS[quote.category].toLowerCase().includes(q) || quote.category.includes(q);
}

function buildCard(quote) {
  const card = document.createElement("div");
  card.className = "quote-card";
  card.innerHTML = `
    <span class="quote-card-mark">“</span>
    <p class="quote-card-text"></p>
    <div class="quote-card-footer">
      <span class="quote-card-category"></span>
      <div class="quote-card-actions">
        <button type="button" class="quote-fav-btn" aria-label="Favorite" aria-pressed="false">★</button>
        <button type="button" class="quote-copy-btn" aria-label="Copy">⧉</button>
        <button type="button" class="quote-share-btn" aria-label="Share" hidden>↗</button>
      </div>
    </div>`;
  card.querySelector(".quote-card-text").textContent = quote.text;
  card.querySelector(".quote-card-category").textContent = CATEGORY_LABELS[quote.category];

  const favBtn = card.querySelector(".quote-fav-btn");
  const syncFav = () => {
    const fav = isFavorite(quote.id);
    favBtn.classList.toggle("favorited", fav);
    favBtn.setAttribute("aria-pressed", String(fav));
  };
  syncFav();
  favBtn.addEventListener("click", () => {
    toggleFavorite(quote.id);
    syncFav();
    if (activeFilter === "favorites") renderGrid();
    if (featuredQuote?.id === quote.id) featuredFavBtn.setAttribute("aria-pressed", String(isFavorite(quote.id)));
  });

  card.querySelector(".quote-copy-btn").addEventListener("click", () => copyQuote(quote.text));

  const shareBtn = card.querySelector(".quote-share-btn");
  if (navigator.share) {
    shareBtn.hidden = false;
    shareBtn.addEventListener("click", () => shareQuote(quote.text));
  }

  return card;
}

function renderGrid() {
  const filtered = QUOTES.filter((q) => matchesFilter(q) && matchesQuery(q));
  countEl.textContent = `${filtered.length} of ${QUOTES.length} quotes`;
  grid.innerHTML = "";
  emptyState.hidden = filtered.length > 0;
  filtered.forEach((q) => grid.appendChild(buildCard(q)));
}

searchInput.addEventListener("input", () => {
  query = searchInput.value.trim();
  renderGrid();
});

if (navigator.share) featuredShareBtn.hidden = false;

export function initQuotes() {
  buildChips();
  renderFeatured(pickRandomQuote());
  renderGrid();
}
