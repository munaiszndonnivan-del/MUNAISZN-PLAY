const API = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p/";

const state = {
  view: "home",
  type: "movie",
  items: [],
  selected: null,
  genre: null,
  sort: "popular",
  search: "",
  suggestions: [],
  watchlist: loadWatchlist(),
  recent: loadRecent(),
  trailerKey: null
};

const $ = id => document.getElementById(id);

const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));

function apiKey() {
  return localStorage.getItem("munaiszn_tmdb_key") || "";
}

function loadWatchlist() {
  try {
    return JSON.parse(localStorage.getItem("munaiszn_watchlist") || "[]");
  } catch {
    return [];
  }
}

function saveWatchlist() {
  localStorage.setItem("munaiszn_watchlist", JSON.stringify(state.watchlist));
}

function loadRecent() {
  try {
    return JSON.parse(localStorage.getItem("munaiszn_continue_watching") || "[]");
  } catch {
    return [];
  }
}

function saveRecent() {
  localStorage.setItem("munaiszn_continue_watching", JSON.stringify(state.recent));
}

function toast(message) {
  const element = $("toast");
  if (!element) return;
  element.textContent = message;
  element.classList.add("show");
  setTimeout(() => element.classList.remove("show"), 2600);
}

function img(path, size = "w500") {
  return path ? IMG + size + path : "";
}

function titleOf(item) {
  return item.title || item.name || item.original_name || "Untitled";
}

function yearOf(item) {
  return (item.release_date || item.first_air_date || "").slice(0, 4) || "Year unknown";
}

function kindOf(item) {
  return item.media_type || (item.first_air_date ? "tv" : "movie");
}

function isSaved(item) {
  return state.watchlist.some(saved =>
    saved.id === item.id && kindOf(saved) === kindOf(item)
  );
}

function openModal(id) {
  const modal = $(id);
  if (!modal) return;
  modal.classList.remove("hidden");
  if (id === "playerModal") modal.scrollTop = 0;
  document.body.style.overflow = "hidden";
}

function closeModal(id) {
  const modal = $(id);
  if (modal) {
    modal.classList.add("hidden");
    if (id === "playerModal") modal.scrollTop = 0;
  }

  if (id === "playerModal") {
    state.playerRequest = (state.playerRequest || 0) + 1;
    const frame = $("playerFrameWrap");
    if (frame) {
      frame.innerHTML = `
        <div class="player-empty">
          <div class="play-symbol">▶</div>
          <h3>Choose your playback source</h3>
          <p>Use sources you own or are authorized to access.</p>
        </div>`;
    }
  }

  const anyOpen = ["detailModal", "playerModal", "settingsModal"]
    .some(name => $(name) && !$(name).classList.contains("hidden"));

  if (!anyOpen) document.body.style.overflow = "";
}


async function api(path) {
  if (!apiKey()) {
    openModal("settingsModal");
    throw new Error("Add your free TMDB API key in Settings to connect your catalogue.");
  }

  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(
    API + path + separator +
    "api_key=" + encodeURIComponent(apiKey()) +
    "&language=en-US"
  );

  if (!response.ok) {
    let message = `TMDB request failed (${response.status}).`;
    try {
      const data = await response.json();
      message = data.status_message || message;
    } catch {}
    throw new Error(message);
  }

  return response.json();
}

function setLoading(message = "Discovering titles...") {
  const grid = $("contentGrid");
  if (grid) {
    grid.innerHTML = `
      <div class="loading">
        <span class="spinner"></span>
        <p>${esc(message)}</p>
      </div>`;
  }
}

function sortQuery() {
  if (state.sort === "rating") return "vote_average.desc";
  if (state.sort === "recent") {
    return state.type === "tv"
      ? "first_air_date.desc"
      : "primary_release_date.desc";
  }
  return "popularity.desc";
}

function updateNavigation() {
  document.querySelectorAll(".nav-link, .mobile-nav button").forEach(button => {
    button.classList.toggle("active", button.dataset.view === state.view);
  });
}

function setView(view) {
  state.view = view;
  state.search = "";
  setSpotlightVisible(true);
  state.genre = null;

  const search = $("searchInput");
  if (search) search.value = "";

  const suggestions = $("searchSuggestions");
  if (suggestions) suggestions.innerHTML = "";

  if (view === "movies") {
    state.type = "movie";
    $("sectionTitle").textContent = "Explore movies";
  } else if (view === "tv") {
    state.type = "tv";
    $("sectionTitle").textContent = "Explore TV shows";
  } else if (view === "watchlist") {
    $("sectionTitle").textContent = "Your watchlist";
  } else {
    state.type = "movie";
    $("sectionTitle").textContent = "Trending now";
  }

  if ($("genreBar")) $("genreBar").innerHTML = "";
  updateNavigation();
  syncHomeLayout();
  loadCatalogue();
}


function syncHomeLayout() {
  const isHome = state.view === "home" && !state.search;
  $("homeShelves")?.classList.toggle("hidden", !isHome);
  document.querySelector(".discover-section")?.classList.toggle("hidden", isHome);
  document.querySelector(".extra-shelf")?.classList.toggle("hidden", isHome);
}

async function loadHomeShelves() {
  const root = $("homeShelves");
  if (!root) return;

  const shelves = [
    ["shelfMyList", "My List", "YOUR PERSONAL COLLECTION"],
    ["shelfTrending", "Trending Now", "EVERYONE IS WATCHING", "trending"],
    ["shelfMovies", "Popular Movies", "MADE FOR THE BIG SCREEN", "movies"],
    ["shelfTV", "Popular TV Series", "YOUR NEXT OBSESSION", "tv"],
    ["shelfAnime", "Popular Anime", "ANIMATION FROM JAPAN", "anime"],
    ["shelfNew", "New Releases", "FRESH FROM THE CINEMA", "new"],
    ["shelfAction", "Action", "HIGH-OCTANE STORIES", "action"],
    ["shelfScifi", "Science Fiction", "BEYOND THE ORDINARY", "scifi"],
    ["shelfThriller", "Thrillers", "EXPECT THE UNEXPECTED", "thriller"],
    ["shelfComedy", "Comedy", "A LITTLE LIGHTER", "comedy"],
    ["shelfAiringAnime", "Currently Airing Anime", "NEW EPISODES AND ONGOING STORIES", "airing"]
  ];

  root.innerHTML = shelves.map(([id]) =>
    `<div id="${id}"><div class="home-shelf-empty">Loading collection...</div></div>`
  ).join("");

  const fetchResults = async path => {
    try {
      const data = await api(path);
      return data.results || [];
    } catch (error) {
      console.warn("Homepage collection unavailable:", path, error.message);
      return [];
    }
  };

  const [trending, movies, tv, anime, releases, action, scifi, thriller, comedy, airing] =
    await Promise.all([
      fetchResults("/trending/all/week?page=1"),
      fetchResults("/movie/popular?page=1"),
      fetchResults("/tv/popular?page=1"),
      fetchResults("/discover/tv?with_genres=16&with_original_language=ja&sort_by=popularity.desc&page=1"),
      fetchResults("/movie/now_playing?page=1"),
      fetchResults("/discover/movie?with_genres=28&sort_by=popularity.desc&page=1"),
      fetchResults("/discover/movie?with_genres=878&sort_by=popularity.desc&page=1"),
      fetchResults("/discover/movie?with_genres=53&sort_by=popularity.desc&page=1"),
      fetchResults("/discover/movie?with_genres=35&sort_by=popularity.desc&page=1"),
      fetchResults("/tv/on_the_air?page=1")
    ]);

  const typed = (items, type) =>
    items.map(item => ({ ...item, media_type: type }));

  const airingAnime = airing
    .filter(item =>
      (item.genre_ids || []).includes(16) &&
      item.original_language === "ja"
    );

  renderHomeShelf("shelfMyList", "My List", "YOUR PERSONAL COLLECTION",
    [...state.watchlist], { viewAll: "watchlist", type: "movie" });

  renderHomeShelf("shelfTrending", "Trending Now", "EVERYONE IS WATCHING",
    trending.filter(item => item.media_type === "movie" || item.media_type === "tv"),
    { viewAll: "trending", type: "movie" });

  renderHomeShelf("shelfMovies", "Popular Movies", "MADE FOR THE BIG SCREEN",
    typed(movies, "movie"), { viewAll: "movies", type: "movie" });

  renderHomeShelf("shelfTV", "Popular TV Series", "YOUR NEXT OBSESSION",
    typed(tv, "tv"), { viewAll: "tv", type: "tv" });

  renderHomeShelf("shelfAnime", "Popular Anime", "ANIMATION FROM JAPAN",
    typed(anime, "tv"), { viewAll: "anime", type: "tv" });

  renderHomeShelf("shelfNew", "New Releases", "FRESH FROM THE CINEMA",
    typed(releases, "movie"), { viewAll: "new", type: "movie" });

  renderHomeShelf("shelfAction", "Action", "HIGH-OCTANE STORIES",
    typed(action, "movie"), { viewAll: "action", type: "movie" });

  renderHomeShelf("shelfScifi", "Science Fiction", "BEYOND THE ORDINARY",
    typed(scifi, "movie"), { viewAll: "scifi", type: "movie" });

  renderHomeShelf("shelfThriller", "Thrillers", "EXPECT THE UNEXPECTED",
    typed(thriller, "movie"), { viewAll: "thriller", type: "movie" });

  renderHomeShelf("shelfComedy", "Comedy", "A LITTLE LIGHTER",
    typed(comedy, "movie"), { viewAll: "comedy", type: "movie" });

  renderHomeShelf("shelfAiringAnime", "Currently Airing Anime",
    "NEW EPISODES AND ONGOING STORIES",
    typed(airingAnime, "tv"), { viewAll: "airing", type: "tv" });
}

async function loadCatalogue() {
  setLoading();

  try {
    if (state.view === "watchlist" && !state.search) {
      state.items = [...state.watchlist];
      renderCards();
      return;
    }

    let data;

    if (state.search) {
      data = await api(
        `/search/multi?query=${encodeURIComponent(state.search)}&include_adult=false&page=1`
      );
    } else if (state.genre) {
      data = await api(
        `/discover/${state.type}?with_genres=${state.genre}&sort_by=${sortQuery()}&page=1`
      );
    } else if (state.view === "home") {
      data = await api("/trending/all/week?page=1");
    } else {
      data = await api(
        `/discover/${state.type}?sort_by=${sortQuery()}&include_adult=false&page=1`
      );
    }

    state.items = (data.results || []).filter(item =>
      item.media_type !== "person" &&
      (item.media_type || state.type) !== "person"
    );

    if (state.view === "home" && !state.search) {
      state.items = state.items.filter(item => item.poster_path).slice(0, 20);
    }

    renderCards();

    if (!state.search && state.view !== "home" && state.view !== "watchlist") {
      loadGenres();
    }

    if (state.view === "home" && !state.search) {
      loadHero();
      syncHomeLayout();
      loadHomeShelves();
    } else {
      syncHomeLayout();
    }
  } catch (error) {
    const grid = $("contentGrid");
    if (grid) {
      grid.innerHTML = `
        <div class="empty-state">
          <h3>Your cinema is ready.</h3>
          <p>${esc(error.message)}</p>
          <button class="primary-btn" id="connectCatalogue">Connect catalogue</button>
        </div>`;
      $("connectCatalogue")?.addEventListener("click", () => openModal("settingsModal"));
    }
  }
}

function renderCards() {
  const grid = $("contentGrid");
  if (!grid) return;

  if (!state.items.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <h3>Nothing here yet</h3>
        <p>Try another search or explore a different category.</p>
      </div>`;
    return;
  }

  grid.innerHTML = state.items.map((item, index) => {
    const type = kindOf(item);
    const saved = isSaved(item);

    return `
      <article class="movie-card" data-index="${index}" tabindex="0" role="button">
        <div class="poster-wrap">
          ${item.poster_path
            ? `<img loading="lazy" src="${img(item.poster_path)}" alt="${esc(titleOf(item))} poster">`
            : `<div class="poster-placeholder">MUNAISZN<br>PLAY</div>`}
          <span class="rating">★ ${Number(item.vote_average || 0).toFixed(1)}</span>
          <button class="save-mini" data-save="${index}" aria-label="Save title">
            ${saved ? "✓" : "＋"}
          </button>
          <div class="poster-shade"></div>
        </div>
        <p class="card-title">${esc(titleOf(item))}</p>
        <p class="card-sub">${type === "tv" ? "TV SERIES" : "MOVIE"} · ${esc(yearOf(item))}</p>
      </article>`;
  }).join("");

  grid.querySelectorAll(".movie-card").forEach(card => {
    const open = () => showDetails(state.items[Number(card.dataset.index)]);

    card.addEventListener("click", event => {
      if (event.target.closest("[data-save]")) return;
      open();
    });

    card.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  });

  grid.querySelectorAll("[data-save]").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();
      const item = state.items[Number(button.dataset.save)];
      toggleWatchlist(item);
      button.textContent = isSaved(item) ? "✓" : "＋";
    });
  });
}

async function loadGenres() {
  try {
    const data = await api(`/genre/${state.type}/list`);
    const bar = $("genreBar");
    if (!bar) return;

    bar.innerHTML =
      '<button class="genre-chip active" data-genre="">All genres</button>' +
      (data.genres || []).map(genre =>
        `<button class="genre-chip" data-genre="${genre.id}">${esc(genre.name)}</button>`
      ).join("");

    bar.querySelectorAll("[data-genre]").forEach(button => {
      button.addEventListener("click", () => {
        state.genre = button.dataset.genre || null;
        bar.querySelectorAll(".genre-chip").forEach(chip =>
          chip.classList.toggle("active", chip === button)
        );
        loadCatalogue();
      });
    });
  } catch {}
}

let spotlightItems = [];
let spotlightIndex = 0;
let spotlightTimer = null;

function setSpotlightVisible(visible) {
  const hero = $("hero");
  if (hero) hero.classList.toggle("spotlight-hidden", !visible);
}

function showSpotlightSlide(index) {
  if (!spotlightItems.length) return;

  spotlightIndex = (index + spotlightItems.length) % spotlightItems.length;
  const item = spotlightItems[spotlightIndex];

  const art = $("heroArt");
  if (art) {
    art.style.backgroundImage = item.backdrop_path
      ? `url("${img(item.backdrop_path, "original")}")`
      : "none";
  }

  if ($("heroTitle")) $("heroTitle").textContent = titleOf(item);

  if ($("heroDescription")) {
    $("heroDescription").textContent =
      item.overview || "Discover one of the titles trending right now.";
  }

  const category = $("spotlightCategory");
  if (category) {
    const animation = (item.genre_ids || []).includes(16);
    category.textContent = animation
      ? "TRENDING ANIMATION"
      : kindOf(item) === "tv" ? "TRENDING SERIES" : "TRENDING MOVIE";
  }

  if ($("heroInfo")) {
    $("heroInfo").onclick = () => showDetails(item);
  }

  const dots = $("spotlightDots");
  if (dots) {
    dots.innerHTML = spotlightItems.map((_, i) =>
      `<button class="spotlight-dot ${i === spotlightIndex ? "active" : ""}"
        data-slide="${i}" aria-label="Show title ${i + 1}"></button>`
    ).join("");

    dots.querySelectorAll("[data-slide]").forEach(button => {
      button.addEventListener("click", () => {
        showSpotlightSlide(Number(button.dataset.slide));
        restartSpotlightTimer();
      });
    });
  }
}

function restartSpotlightTimer() {
  clearInterval(spotlightTimer);
  spotlightTimer = setInterval(() => {
    if (!$("hero")?.classList.contains("spotlight-hidden")) {
      showSpotlightSlide(spotlightIndex + 1);
    }
  }, 6000);
}

function loadHero() {
  spotlightItems = state.items
    .filter(item => item.backdrop_path)
    .slice(0, 7);

  if (!spotlightItems.length) return;

  showSpotlightSlide(0);
  restartSpotlightTimer();

  if ($("spotlightPrev")) {
    $("spotlightPrev").onclick = () => {
      showSpotlightSlide(spotlightIndex - 1);
      restartSpotlightTimer();
    };
  }

  if ($("spotlightNext")) {
    $("spotlightNext").onclick = () => {
      showSpotlightSlide(spotlightIndex + 1);
      restartSpotlightTimer();
    };
  }
}

function renderPeople(people) {
  const cast = $("castGrid");
  if (!cast) return;

  cast.innerHTML = (people || []).slice(0, 8).map(person => `
    <div class="cast-card">
      ${person.profile_path
        ? `<img loading="lazy" src="${img(person.profile_path, "w185")}" alt="${esc(person.name)}">`
        : `<div class="cast-placeholder">✦</div>`}
      <p>${esc(person.name)}</p>
      <small>${esc(person.character || "")}</small>
    </div>
  `).join("");
}

function renderSimilar(items) {
  const grid = $("similarGrid");
  if (!grid) return;

  grid.innerHTML = (items || []).slice(0, 6).map(item => `
    <button class="mini-title" data-similar="${item.id}" data-type="${kindOf(item)}">
      ${item.poster_path
        ? `<img loading="lazy" src="${img(item.poster_path, "w185")}" alt="">`
        : ""}
      <span>${esc(titleOf(item))}</span>
    </button>
  `).join("");

  grid.querySelectorAll("[data-similar]").forEach(button => {
    button.addEventListener("click", async () => {
      const type = button.dataset.type;
      const id = button.dataset.similar;
      try {
        const item = await api(`/${type}/${id}`);
        item.media_type = type;
        showDetails(item);
      } catch (error) {
        toast(error.message);
      }
    });
  });
}

async function loadSeasonDetails(item, details) {
  const section = $("seasonSection");
  const select = $("seasonSelect");
  const episodes = $("episodeGrid");

  if (!section || !select || !episodes) return;

  section.classList.add("hidden");
  episodes.innerHTML = "";

  if (kindOf(item) !== "tv" || !details.seasons?.length) return;

  section.classList.remove("hidden");

  const seasons = details.seasons.filter(season => season.season_number >= 0);

  select.innerHTML = seasons.map(season =>
    `<option value="${season.season_number}">${esc(season.name)}</option>`
  ).join("");

  async function showSeason(number) {
    episodes.innerHTML = "<p>Loading episodes...</p>";

    try {
      const data = await api(`/tv/${item.id}/season/${number}`);
      episodes.innerHTML = (data.episodes || []).map(episode => `
        <div class="episode-card">
          ${episode.still_path
            ? `<img loading="lazy" src="${img(episode.still_path, "w300")}" alt="">`
            : ""}
          <div>
            <strong>${episode.episode_number}. ${esc(episode.name)}</strong>
            <p>${esc(episode.overview || "Episode description unavailable.")}</p>
          </div>
        </div>
      `).join("");
    } catch {
      episodes.innerHTML = "<p>Episode information is unavailable.</p>";
    }
  }

  select.onchange = () => showSeason(select.value);
  if (seasons.length) showSeason(seasons[0].season_number);
}

async function showDetails(item) {
  if (!item) return;

  state.selected = item;
  state.trailerKey = null;

  $("detailTitle").textContent = titleOf(item);
  $("detailType").textContent =
    kindOf(item) === "tv" ? "TELEVISION SERIES" : "FEATURE FILM";

  if ($("detailBackdrop")) {
    $("detailBackdrop").style.backgroundImage = item.backdrop_path
      ? `url("${img(item.backdrop_path, "w1280")}")`
      : "none";
  }

  if ($("detailPoster")) {
    $("detailPoster").src = img(item.poster_path);
    $("detailPoster").alt = titleOf(item);
  }

  $("detailOverview").textContent =
    item.overview || "No description is available for this title.";

  $("detailMeta").innerHTML = `
    <span>${esc(yearOf(item))}</span>
    <span>★ ${Number(item.vote_average || 0).toFixed(1)} / 10</span>
    <span>${kindOf(item) === "tv" ? "TV SERIES" : "MOVIE"}</span>`;

  $("detailTags").innerHTML = "";

  $("saveButton").textContent = isSaved(item) ? "✓ In My List" : "＋ My List";
  $("saveButton").onclick = () => {
    toggleWatchlist(item);
    $("saveButton").textContent = isSaved(item) ? "✓ In My List" : "＋ My List";
  };

  $("playButton").onclick = () => {
    closeModal("detailModal");
    openPlayer(item);
  };

  if ($("detailTrailerButton")) {
    $("detailTrailerButton").onclick = () => {
      closeModal("detailModal");
      openPlayer(item);
      setTimeout(() => $("trailerButton")?.click(), 100);
    };
  }

  openModal("detailModal");

  try {
    const type = kindOf(item);

    const [details, videos, credits, similar] = await Promise.all([
      api(`/${type}/${item.id}`),
      api(`/${type}/${item.id}/videos`),
      api(`/${type}/${item.id}/credits`),
      api(`/${type}/${item.id}/similar`)
    ]);

    if (state.selected?.id !== item.id) return;

    const trailer = (videos.results || []).find(video =>
      video.site === "YouTube" && video.type === "Trailer"
    ) || (videos.results || []).find(video => video.site === "YouTube");

    state.trailerKey = trailer?.key || null;

    const genres = details.genres || [];
    $("detailTags").innerHTML = genres.map(genre =>
      `<span class="detail-tag">${esc(genre.name)}</span>`
    ).join("");

    const runtime = details.runtime ||
      (details.episode_run_time && details.episode_run_time[0]);

    if (runtime) {
      $("detailMeta").innerHTML += `<span>${runtime} min</span>`;
    }

    renderPeople(credits.cast);
    renderSimilar(similar.results);
    loadSeasonDetails(item, details);
  } catch {
    // The title information remains available even if extra details fail.
  }
}


function renderHomeShelf(id, title, eyebrow, items, options = {}) {
  const container = $(id);
  if (!container) return;

  const fullItems = (items || [])
    .filter(item => item && item.id && item.poster_path);

  const validItems = fullItems.slice(0, options.limit || 12);

  container.innerHTML = `
    <section class="home-shelf">
      <div class="home-shelf-heading">
        <div>
          <p class="eyebrow">${esc(eyebrow)}</p>
          <h2>${esc(title)}</h2>
          <span class="home-shelf-count">${validItems.length} titles</span>
        </div>
        ${options.viewAll ? `
          <button class="home-shelf-view" data-home-view="${esc(options.viewAll)}">
            View all →
          </button>` : ""}
      </div>
      <div class="home-shelf-track">
        ${validItems.length ? validItems.map((item, index) => `
          <article class="movie-card" data-home-card="${index}"
            tabindex="0" role="button" aria-label="Open ${esc(titleOf(item))}">
            <div class="poster-wrap">
              <img loading="lazy" src="${img(item.poster_path)}"
                alt="${esc(titleOf(item))} poster">
              <span class="rating">★ ${Number(item.vote_average || 0).toFixed(1)}</span>
              <button class="save-mini" data-home-save="${index}"
                aria-label="Save ${esc(titleOf(item))}">
                ${isSaved(item) ? "✓" : "＋"}
              </button>
              <div class="poster-shade"></div>
            </div>
            <p class="card-title">${esc(titleOf(item))}</p>
            <p class="card-sub">${kindOf(item) === "tv" ? "TV SERIES" : "MOVIE"} · ${esc(yearOf(item))}</p>
          </article>
        `).join("") : `
          <div class="home-shelf-empty">No titles available in this collection right now.</div>
        `}
      </div>
    </section>`;

  const cards = container.querySelectorAll("[data-home-card]");
  cards.forEach(card => {
    const item = validItems[Number(card.dataset.homeCard)];
    const open = () => showDetails(item);

    card.addEventListener("click", event => {
      if (event.target.closest("[data-home-save]")) return;
      open();
    });

    card.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  });

  container.querySelectorAll("[data-home-save]").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();
      const item = validItems[Number(button.dataset.homeSave)];
      toggleWatchlist(item);
      button.textContent = isSaved(item) ? "✓" : "＋";
    });
  });

  container.querySelector("[data-home-view]")?.addEventListener("click", () => {
    showHomeCollection(title, fullItems, options.type || "movie");
  });
}

function showHomeCollection(title, items, type = "movie") {
  state.view = "collection";
  state.type = type;
  state.search = "";
  state.genre = null;
  state.items = [...items];

  setSpotlightVisible(false);
  $("homeShelves")?.classList.add("hidden");
  $("continueSection")?.classList.add("hidden");
  document.querySelector(".discover-section")?.classList.remove("hidden");
  document.querySelector(".extra-shelf")?.classList.add("hidden");

  $("sectionTitle").textContent = title;
  if ($("genreBar")) $("genreBar").innerHTML = "";
  if ($("searchInput")) $("searchInput").value = "";
  if ($("searchSuggestions")) $("searchSuggestions").innerHTML = "";
  updateNavigation();
  renderCards();
}

function toggleWatchlist(item) {
  if (!item) return;

  const index = state.watchlist.findIndex(saved =>
    saved.id === item.id && kindOf(saved) === kindOf(item)
  );

  if (index >= 0) {
    state.watchlist.splice(index, 1);
    toast("Removed from My List");
  } else {
    state.watchlist.push(item);
    toast("Added to My List");
  }

  saveWatchlist();

  if (state.view === "home" && !state.search) {
    renderHomeShelf(
      "shelfMyList",
      "My List",
      "YOUR PERSONAL COLLECTION",
      [...state.watchlist],
      { viewAll: "watchlist", type: "movie" }
    );
  }

  if (state.view === "watchlist" && !state.search) {
    state.items = [...state.watchlist];
    renderCards();
  }
}

function addRecent(item) {
  if (!item) return;

  const existing = state.recent.find(saved =>
    saved.id === item.id && kindOf(saved) === kindOf(item)
  );

  const recentItem = {
    ...item,
    resumeSeason: existing?.resumeSeason ?? item.resumeSeason ?? null,
    resumeEpisode: existing?.resumeEpisode ?? item.resumeEpisode ?? null,
    resumeEpisodeName: existing?.resumeEpisodeName ?? item.resumeEpisodeName ?? "",
    resumeBySeason: existing?.resumeBySeason || item.resumeBySeason || {}
  };

  state.recent = state.recent.filter(saved =>
    !(saved.id === item.id && kindOf(saved) === kindOf(item))
  );

  state.recent.unshift(recentItem);
  state.recent = state.recent.slice(0, 10);
  saveRecent();
  renderRecent();
}


function renderRecent() {
  const section = $("continueSection");
  const grid = $("continueGrid");

  if (!section || !grid) return;

  if (!state.recent.length) {
    section.classList.add("hidden");
    return;
  }

  section.classList.remove("hidden");

  grid.innerHTML = state.recent.map((item, index) => `
    <button class="continue-card" data-recent="${index}">
      ${item.backdrop_path
        ? `<img loading="lazy" src="${img(item.backdrop_path, "w500")}" alt="">`
        : ""}
      <span>${esc(titleOf(item))}</span>
      <small>Recently opened</small>
    </button>
  `).join("");

  grid.querySelectorAll("[data-recent]").forEach(button => {
    button.addEventListener("click", () => {
      const item = state.recent[Number(button.dataset.recent)];
      if (item) openPlayer(item);
    });
  });
}

function savePlayerResume(item, episodeName = "") {
  if (!item || kindOf(item) !== "tv") return;

  const index = state.recent.findIndex(saved =>
    saved.id === item.id && kindOf(saved) === kindOf(item)
  );

  if (index === -1) return;

  state.recent[index] = {
    ...state.recent[index],
    resumeSeason: state.playerSeason,
    resumeEpisode: state.playerEpisode,
    resumeEpisodeName: episodeName,
    resumeBySeason: {
      ...(state.recent[index].resumeBySeason || {}),
      [state.playerSeason]: {
        episode: state.playerEpisode,
        name: episodeName
      }
    }
  };

  saveRecent();
  renderRecent();
}

async function loadPlayerSeason(item, seasonNumber, preferredEpisode = null) {
  const request = (state.playerRequest || 0) + 1;
  state.playerRequest = request;

  const episodeSelect = $("playerEpisodeSelect");
  const description = $("playerEpisodeDescription");
  const status = $("playerEpisodeStatus");

  if (!episodeSelect) return;

  episodeSelect.innerHTML = '<option value="">Loading episodes...</option>';
  if (description) description.textContent = "";
  if (status) status.textContent = "Loading season...";

  try {
    const data = await api(`/tv/${item.id}/season/${seasonNumber}`);

    if (state.selected?.id !== item.id || state.playerRequest !== request) return;

    const episodes = data.episodes || [];

    episodeSelect.innerHTML = episodes.map(ep =>
      `<option value="${ep.episode_number}">${ep.episode_number}. ${esc(ep.name || "Untitled episode")}</option>`
    ).join("");

    if (!episodes.length) {
      episodeSelect.innerHTML = '<option value="">No episodes available</option>';
      state.playerEpisode = null;
      if (status) status.textContent = "No episodes found";
      return;
    }

    state.playerSeason = Number(seasonNumber);

    const preferred = episodes.find(ep =>
      ep.episode_number === Number(preferredEpisode)
    ) || episodes[0];

    state.playerEpisode = preferred.episode_number;
    episodeSelect.value = String(state.playerEpisode);

    const updateEpisode = () => {
      const selected = episodes.find(ep =>
        ep.episode_number === Number(episodeSelect.value)
      );
      if (!selected) return;

      state.playerEpisode = selected.episode_number;

      if (status) {
        status.textContent = `Season ${state.playerSeason} · Episode ${selected.episode_number}`;
      }

      if (description) {
        description.textContent = selected.overview || "No episode description available.";
      }

      savePlayerResume(item, selected.name || "");
    };

    episodeSelect.onchange = updateEpisode;
    updateEpisode();

  } catch (error) {
    episodeSelect.innerHTML = '<option value="">Episodes unavailable</option>';
    if (status) status.textContent = "Could not load episodes";
    toast(error.message);
  }
}


async function setupPlayerEpisodePicker(item) {
  const picker = $("playerEpisodePicker");
  const seasonSelect = $("playerSeasonSelect");
  const status = $("playerEpisodeStatus");

  if (!picker || !seasonSelect) return;

  picker.classList.add("hidden");
  seasonSelect.innerHTML = "";

  if (kindOf(item) !== "tv") return;

  picker.classList.remove("hidden");
  if (status) status.textContent = "Loading seasons...";

  try {
    const details = await api(`/tv/${item.id}`);
    if (state.selected?.id !== item.id) return;

    const seasons = (details.seasons || []).filter(
      season => season.season_number >= 0
    );

    if (!seasons.length) {
      if (status) status.textContent = "Season information unavailable";
      return;
    }

    seasonSelect.innerHTML = seasons.map(season =>
      `<option value="${season.season_number}">${esc(season.name)} (${season.episode_count} episodes)</option>`
    ).join("");

    const saved = state.recent.find(entry =>
      entry.id === item.id && kindOf(entry) === kindOf(item)
    );

    const preferred = seasons.find(season =>
      season.season_number === Number(saved?.resumeSeason)
    ) || seasons.find(season => season.season_number === 1) || seasons[0];

    seasonSelect.value = String(preferred.season_number);

    seasonSelect.onchange = () => {
      const latest = state.recent.find(entry =>
        entry.id === item.id && kindOf(entry) === kindOf(item)
      );

      const seasonKey = String(seasonSelect.value);
      const seasonResume = latest?.resumeBySeason?.[seasonKey];

      const fallbackEpisode =
        Number(seasonKey) === Number(latest?.resumeSeason)
          ? latest?.resumeEpisode
          : null;

      loadPlayerSeason(
        item,
        seasonKey,
        seasonResume?.episode ?? fallbackEpisode
      );
    };

    const initialResume =
      saved?.resumeBySeason?.[String(preferred.season_number)]?.episode ??
      (Number(saved?.resumeSeason) === preferred.season_number
        ? saved?.resumeEpisode
        : null);

    await loadPlayerSeason(
      item,
      preferred.season_number,
      initialResume
    );

  } catch (error) {
    if (status) status.textContent = "Season information unavailable";
    toast(error.message);
  }
}



function renderWatchMetadata(item) {
  if (!item) return;

  const title = titleOf(item);
  const type = kindOf(item);
  const genres = Array.isArray(item.genres)
    ? item.genres.map(genre => genre.name).filter(Boolean)
    : [];

  const rating = Number(item.vote_average);
  const facts = [
    type === "tv" ? "TV SERIES" : "MOVIE",
    yearOf(item),
    Number.isFinite(rating) && rating > 0 ? `★ ${rating.toFixed(1)} / 10` : "Not rated",
    ...genres
  ];

  const titleNode = $("watchTitle");
  const typeNode = $("watchType");
  const factsNode = $("watchFacts");
  const overviewNode = $("watchOverview");

  if (titleNode) titleNode.textContent = title;
  if (typeNode) typeNode.textContent = type === "tv" ? "TV SERIES" : "FEATURE PRESENTATION";
  if (factsNode) factsNode.textContent = facts.join("  ·  ");
  if (overviewNode) {
    overviewNode.textContent = item.overview || "No synopsis is available for this title yet.";
  }
}

function openPlayer(item) {
  if (!item) return;

  state.selected = item;
  state.playerSeason = null;
  state.playerEpisode = null;
  state.playerRequest = 0;

  $("playerTitle").textContent = titleOf(item);
  renderWatchMetadata(item);

  $("playerFrameWrap").innerHTML = `
    <div class="player-empty">
      <div class="play-symbol">▶</div>
      <h3>Choose your playback source</h3>
      <p>Use sources you own or are authorized to access.</p>
    </div>`;

  $("framexButton").onclick = () => loadFrameX(item);

  $("trailerButton").onclick = () => {
    if (!state.trailerKey) {
      toast("No official YouTube trailer was found for this title.");
      return;
    }

    $("playerFrameWrap").innerHTML = `
      <iframe
        src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(state.trailerKey)}?autoplay=1"
        title="Official trailer"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowfullscreen webkitallowfullscreen mozallowfullscreen>
      </iframe>`;
  };

  addRecent(item);
  openModal("playerModal");
  setupPlayerEpisodePicker(item);
}


function loadFrameX(item) {
  if (!item) return;

  const type = kindOf(item);
  const base = `https://framextv.xyz/embed/${item.id}`;

  if (type === "tv" &&
      (state.playerSeason == null || state.playerEpisode == null)) {
    toast("Choose a season and episode first.");
    return;
  }

  const url = type === "tv"
    ? `${base}/${state.playerSeason}/${state.playerEpisode}`
    : `${base}?autoplay=1&muted=0`;

  $("playerFrameWrap").innerHTML = `
    <iframe
      src="${url}"
      title="External video player"
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowfullscreen
      webkitallowfullscreen
      mozallowfullscreen
      referrerpolicy="strict-origin-when-cross-origin">
    </iframe>`;

  toast("External player loaded. Availability is not guaranteed.");
}


// Follow the ORIGINAL embedded player's fullscreen control.
function syncPlayerFullscreen() {
  const playerFrame = $("playerFrameWrap");
  const activeFrame = document.fullscreenElement ||
    document.webkitFullscreenElement;

  const isPlayerFullscreen =
    !!activeFrame && !!playerFrame && playerFrame.contains(activeFrame);

  if (isPlayerFullscreen) {
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock("landscape").catch(() => {
        toast("If rotation is blocked, enable Android Auto-rotate.");
      });
    }
  } else if (screen.orientation && screen.orientation.unlock) {
    try {
      screen.orientation.unlock();
    } catch (error) {}
  }
}

document.addEventListener("fullscreenchange", syncPlayerFullscreen);
document.addEventListener("webkitfullscreenchange", syncPlayerFullscreen);

let searchTimer;

async function searchTitles(query) {
  if (!query.trim()) return;

  try {
    const data = await api(
      `/search/multi?query=${encodeURIComponent(query)}&include_adult=false&page=1`
    );

    if (query !== state.search) return;

    state.items = (data.results || []).filter(item =>
      item.media_type !== "person" &&
      (item.media_type === "movie" || item.media_type === "tv")
    );

    renderCards();
  } catch (error) {
    toast(error.message);
  }
}

async function showSuggestions(query) {
  const panel = $("searchSuggestions");
  if (!panel) return;

  if (!query.trim()) {
    panel.innerHTML = "";
    return;
  }

  try {
    const data = await api(
      `/search/multi?query=${encodeURIComponent(query)}&include_adult=false&page=1`
    );

    if ($("searchInput")?.value.trim() !== query) return;

    const results = (data.results || []).filter(item =>
      item.media_type === "movie" || item.media_type === "tv"
    ).slice(0, 5);

    panel.innerHTML = results.map((item, index) => `
      <button class="suggestion-item" data-suggestion="${index}">
        ${item.poster_path
          ? `<img src="${img(item.poster_path, "w92")}" alt="">`
          : ""}
        <span>
          <strong>${esc(titleOf(item))}</strong>
          <small>${kindOf(item) === "tv" ? "TV SHOW" : "MOVIE"} · ${esc(yearOf(item))}</small>
        </span>
      </button>
    `).join("");

    panel.querySelectorAll("[data-suggestion]").forEach(button => {
      button.addEventListener("click", () => {
        showDetails(results[Number(button.dataset.suggestion)]);
        panel.innerHTML = "";
      });
    });
  } catch {
    panel.innerHTML = "";
  }
}

// Search
$("searchInput")?.addEventListener("input", event => {
  const query = event.target.value.trim();
  state.search = query;
  setSpotlightVisible(!query);
  syncHomeLayout();

  clearTimeout(searchTimer);

  if ($("searchClear")) {
    $("searchClear").classList.toggle("hidden", !query);
  }

  if (!query) {
    if ($("searchSuggestions")) $("searchSuggestions").innerHTML = "";
    loadCatalogue();
    return;
  }

  searchTimer = setTimeout(() => {
    showSuggestions(query);
    searchTitles(query);
  }, 350);
});

$("searchClear")?.addEventListener("click", () => {
  $("searchInput").value = "";
  state.search = "";
  setSpotlightVisible(true);
  syncHomeLayout();
  $("searchSuggestions").innerHTML = "";
  $("searchClear").classList.add("hidden");
  loadCatalogue();
});

document.addEventListener("click", event => {
  if (!event.target.closest(".search-area")) {
    if ($("searchSuggestions")) $("searchSuggestions").innerHTML = "";
  }
});

// Navigation
document.querySelectorAll(".nav-link, .mobile-nav button").forEach(button => {
  button.addEventListener("click", () => {
    if (button.dataset.view) setView(button.dataset.view);
  });
});

// Collections
document.querySelectorAll("[data-collection]").forEach(button => {
  button.addEventListener("click", () => {
    const collection = button.dataset.collection;

    if (collection === "movies") setView("movies");
    else if (collection === "tv") setView("tv");
    else setView("home");
  });
});

// Hero actions
$("heroExplore")?.addEventListener("click", () => {
  $("contentGrid")?.scrollIntoView({ behavior: "smooth" });
});

$("surpriseBtn")?.addEventListener("click", () => {
  if (!state.items.length) {
    toast("Load the catalogue first.");
    return;
  }

  const item = state.items[Math.floor(Math.random() * state.items.length)];
  showDetails(item);
});

$("sortSelect")?.addEventListener("change", event => {
  state.sort = event.target.value;
  loadCatalogue();
});

// Settings
$("settingsOpen")?.addEventListener("click", () => {
  $("apiKey").value = apiKey();
  openModal("settingsModal");
});

$("saveSettings")?.addEventListener("click", () => {
  const key = $("apiKey").value.trim();

  if (!key) {
    toast("Paste your TMDB API key first.");
    return;
  }

  localStorage.setItem("munaiszn_tmdb_key", key);
  closeModal("settingsModal");
  setView("home");
  toast("TMDB catalogue connected on this device.");
});

$("clearSettings")?.addEventListener("click", () => {
  localStorage.removeItem("munaiszn_tmdb_key");
  $("apiKey").value = "";
  toast("Saved API key cleared.");
});

// Modal close controls
document.querySelectorAll("[data-close]").forEach(button => {
  button.addEventListener("click", () => closeModal(button.dataset.close));
});

document.querySelectorAll(".modal-backdrop").forEach(modal => {
  modal.addEventListener("click", event => {
    if (event.target === modal) closeModal(modal.id);
  });
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    document.querySelectorAll(".modal-backdrop:not(.hidden)").forEach(modal => {
      closeModal(modal.id);
    });
  }
});

// MUNAISZN PLAY — player viewing size controls
(function setupPlayerViewingModes() {
  const section = document.querySelector(".watch-player-section");
  const frame = document.querySelector(".watch-player-frame");
  const buttons = document.querySelectorAll("[data-player-size]");

  if (!section || !frame || !buttons.length) return;

  function setPlayerSize(mode) {
    if (mode === "fullscreen") {
      const request = frame.requestFullscreen ||
        frame.webkitRequestFullscreen;

      if (!request) {
        toast("Fullscreen is not supported by this browser.");
        return;
      }

      const result = request.call(frame);
      if (result && result.catch) {
        result.catch(() => toast("Fullscreen was blocked by the browser."));
      }
      return;
    }

    if (document.fullscreenElement || document.webkitFullscreenElement) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) {
        const result = exit.call(document);
        if (result && result.catch) result.catch(() => {});
      }
    }

    section.dataset.playerSize = mode;

    buttons.forEach(button => {
      const active = button.dataset.playerSize === mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  buttons.forEach(button => {
    button.addEventListener("click", () => {
      setPlayerSize(button.dataset.playerSize);
    });
  });

  function syncFullscreenButton() {
    const isFullscreen =
      document.fullscreenElement === frame ||
      document.webkitFullscreenElement === frame;

    buttons.forEach(button => {
      if (button.dataset.playerSize === "fullscreen") {
        button.classList.toggle("active", isFullscreen);
        button.setAttribute("aria-pressed", String(isFullscreen));
      }
    });

    if (screen.orientation && screen.orientation.lock) {
      if (isFullscreen) {
        screen.orientation.lock("landscape").catch(() => {});
      } else if (screen.orientation.unlock) {
        try { screen.orientation.unlock(); } catch (error) {}
      }
    }
  }

  document.addEventListener("fullscreenchange", syncFullscreenButton);
  document.addEventListener("webkitfullscreenchange", syncFullscreenButton);

  setPlayerSize("cinema");
})();

// Start the experience
renderRecent();
updateNavigation();

if (!apiKey()) {
  if ($("contentGrid")) {
    $("contentGrid").innerHTML = `
      <div class="empty-state">
        <h3>Your cinema is ready.</h3>
        <p>Connect your free TMDB API key in Settings to explore real movie and TV information.</p>
        <button class="primary-btn" id="connectCatalogue">Connect catalogue</button>
      </div>`;
    $("connectCatalogue").addEventListener("click", () => openModal("settingsModal"));
  }
} else {
  loadCatalogue();
}
