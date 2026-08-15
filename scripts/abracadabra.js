const TMDB_API_KEY = "7627ec01e648f70a5862bc42c79fdb3d";

const TMDB_BASE = "https://api.themoviedb.org/3";
const IMG_POSTER = "https://image.tmdb.org/t/p/w500";
const IMG_BACKDROP = "https://image.tmdb.org/t/p/w1280";
const LANG = "uk-UA";

const TAB_CONFIG = {
	latest: { label: "Останні додані", endpoint: "/movie/now_playing" },
	online: { label: "Дивляться зараз", endpoint: "/trending/movie/day" },
	best: { label: "Найкращі", endpoint: "/movie/top_rated" },
};

const CATEGORY_CONFIG = {
	movies: {
		label: "Фільми",
		type: "movie",
		endpoint: "/discover/movie",
		params: {
			sort_by: "popularity.desc"
		}
	},

	series: {
		label: "Серіали",
		type: "tv",
		endpoint: "/discover/tv",
		params: {
			sort_by: "popularity.desc"
		}
	},

	cartoons: {
		label: "Мультфільми",
		type: "movie",
		endpoint: "/discover/movie",
		params: {
			with_genres: "16",
			sort_by: "popularity.desc"
		}
	},

	anime: {
		label: "Аніме",
		type: "movie",
		endpoint: "/discover/movie",
		params: {
			with_genres: "16",
			with_original_language: "ja",
			sort_by: "popularity.desc"
		}
	},

	new: {
		label: "Новинки",
		type: "movie",
		endpoint: "/movie/now_playing",
		params: {}
	},

	top: {
		label: "Топ рейтинг",
		type: "movie",
		endpoint: "/movie/top_rated",
		params: {}
	}
};

const SAMPLE_CATEGORIES = [
	{ slug: "action", label: "Екшн" },
	{ slug: "drama", label: "Драма" },
	{ slug: "comedy", label: "Комедія" },
	{ slug: "scifi", label: "Фантастика" },
	{ slug: "horror", label: "Жахи" },
	{ slug: "animation", label: "Анімація" },
];

const grid = document.getElementById("movie-grid");
const loadMoreBtn = document.getElementById("load-more");
const heroBanner = document.getElementById("hero-banner");
const heroWatch = document.getElementById("hero-watch");
const favoritesMode = new URLSearchParams(location.search).get("favorites") === "true";

let genreMap = {};
let currentTab = "latest";
let currentCategory = null;
let currentPage = 1;
let totalPages = 1;
let allMovies = [];
let searchTimeout = null;
let usingTmdb = Boolean(TMDB_API_KEY);
let featuredMovie = null;
let visibleMovies = [];

async function tmdbFetch(endpoint, params = {}) {
	const url = new URL(TMDB_BASE + endpoint);
	url.searchParams.set("api_key", TMDB_API_KEY);
	url.searchParams.set("language", LANG);
	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, value);
	}
	const res = await fetch(url);
	if (!res.ok) throw new Error("Помилка " + res.status);
	return res.json();
}

async function loadGenres() {
	const data = await tmdbFetch("/genre/movie/list");
	genreMap = Object.fromEntries(data.genres.map(g => [g.id, g.name]));
}

function mapTmdb(movie) {
	const genres = (movie.genre_ids || [])
		.map(id => genreMap[id])
		.filter(Boolean)
		.join(", ");

	const title = movie.title || movie.name || movie.original_title || movie.original_name;

	const releaseDate = movie.release_date || movie.first_air_date || "";

	return {
		id: movie.id,
		title: title,
		genre: genres || (movie.genres || []).map(g => g.name).join(", ") || "—",
		year: releaseDate.slice(0, 4) || "—",
		rating: movie.vote_average ? movie.vote_average.toFixed(1) : "—",
		views: Math.max(1, Math.round(movie.popularity || 0)),
		img: movie.poster_path ? IMG_POSTER + movie.poster_path : "",
		backdrop: movie.backdrop_path ? IMG_BACKDROP + movie.backdrop_path : "",
		overview: movie.overview || "",
		mediaType: movie.media_type || "movie"
	};
}

async function fetchTmdbMovies(tab, page = 1) {
	const { endpoint } = TAB_CONFIG[tab];
	const data = await tmdbFetch(endpoint, { page });
	return { movies: data.results.map(mapTmdb), totalPages: data.total_pages };
}

async function searchTmdb(query) {
	const data = await tmdbFetch("/search/movie", { query, page: 1 });
	return data.results.map(mapTmdb);
}

async function fetchSampleMovies() {
	const results = await Promise.all(
		SAMPLE_CATEGORIES.map(({ slug, label }) =>
			fetch("https://api.sampleapis.com/movies/" + slug)
				.then(r => (r.ok ? r.json() : []))
				.then(list => list.map(m => ({ ...m, category: label })))
				.catch(() => [])
		)
	);
	const seen = new Set();
	return results.flat().filter(m => {
		if (seen.has(m.id)) return false;
		seen.add(m.id);
		return true;
	}).map(m => ({
		id: m.id,
		title: m.title,
		genre: m.category,
		year: "—",
		rating: "—",
		views: 100 + (m.id % 900),
		img: m.posterURL || "",
		backdrop: m.posterURL || "",
		overview: "",
	}));
}

async function fetchCategory(category, page = 1) {
	const config = CATEGORY_CONFIG[category];

	if (!config) {
		return {
			movies: [],
			totalPages: 1
		};
	}

	const params = {
		page,
		...config.params
	};

	const data = await tmdbFetch(config.endpoint, params);

	const movies = data.results.map(movie => ({
		...mapTmdb(movie),
		mediaType: config.type
	}));

	return {
		movies,
		totalPages: data.total_pages
	};
}
function getFavorites() {
	try {
		const saved = JSON.parse(localStorage.getItem("favorites") || "[]");
		return Array.isArray(saved) ? saved : [];
	} catch {
		return [];
	}
}

function saveFavorites(favorites) {
	localStorage.setItem("favorites", JSON.stringify(favorites));
}

function isFavorite(movieId) {
	return getFavorites().some(movie => String(movie.id) === String(movieId));
}

function toggleFavorite(movie) {
	const favorites = getFavorites();
	const index = favorites.findIndex(item => String(item.id) === String(movie.id));

	if (index === -1) {
		favorites.push(movie);
	} else {
		favorites.splice(index, 1);
	}

	saveFavorites(favorites);
}

function esc(str) {
	const el = document.createElement("div");
	el.textContent = str;
	return el.innerHTML;
}

function renderSkeleton(count = 8) {
	grid.innerHTML = Array.from({ length: count }, () => `
		<div class="skeleton">
			<div class="skeleton-poster"></div>
			<div class="skeleton-lines">
				<div class="skeleton-line"></div>
				<div class="skeleton-line short"></div>
			</div>
		</div>`).join("");
}

function renderCard(movie, index) {
	const poster = movie.img
		? `<img src="${esc(movie.img)}" alt="${esc(movie.title)}" loading="lazy" />`
		: `<div class="no-poster">Немає</div>`;
	const rating = movie.rating !== "—" ? esc(movie.rating) : "—";
	return `
		<article class="card" data-id="${esc(String(movie.id))}" style="animation-delay:${(index % 8) * 0.05}s">
			<div class="poster-wrap">
				${poster}
				<button class="favorite-btn" type="button" aria-label="${isFavorite(movie.id) ? "\u0412\u0438\u0434\u0430\u043b\u0438\u0442\u0438 \u0437 \u043e\u0431\u0440\u0430\u043d\u043e\u0433\u043e" : "\u0414\u043e\u0434\u0430\u0442\u0438 \u0434\u043e \u043e\u0431\u0440\u0430\u043d\u043e\u0433\u043e"}">${isFavorite(movie.id) ? "&#9829;" : "&#9825;"}</button>
				<div class="poster-badges">
					<span class="badge-views">+${movie.views}</span>
					<span class="badge-hd">1080p</span>
				</div>
				<div class="play-overlay"><span class="play-btn">HD</span></div>
			</div>
			<div class="card-body">
				<h3 class="card-title">${esc(movie.title)}</h3>
				<div class="card-meta">
					<span class="rating">${rating}</span>
					<span>${esc(String(movie.year))}</span>
				</div>
				<p class="card-genre">${esc(movie.genre)}</p>
			</div>
		</article>`;
}

function openMovie(movie) {
	if (!movie || movie.id == null) return;
	try {
		sessionStorage.setItem("movie_" + movie.id, JSON.stringify(movie));
	} catch {}
	window.location.href = "movie.html?id=" + encodeURIComponent(movie.id);
}

function renderGrid(list) {
	visibleMovies = list;
	if (!list.length) {
		grid.innerHTML = `<p class="status-msg">Нічого не знайдено</p>`;
		return;
	}
	grid.innerHTML = list.map(renderCard).join("");
}

function updateHero(movie) {
	if (!movie) return;
	featuredMovie = movie;
	heroWatch.href = "movie.html?id=" + encodeURIComponent(movie.id);
	document.getElementById("hero-title").textContent = movie.title;
	document.getElementById("hero-meta").innerHTML = `
		<span class="rating">${movie.rating !== "—" ? esc(movie.rating) : "—"}</span>
		<span>${esc(String(movie.year))}</span>
		<span>${esc(movie.genre.split(", ").slice(0, 2).join(", "))}</span>
		<span>1080p</span>`;
	document.getElementById("hero-desc").textContent = movie.overview || "";
	if (movie.backdrop) {
		heroBanner.style.backgroundImage = `url("${movie.backdrop}")`;
		heroBanner.classList.add("has-backdrop");
	}
}

function showStatus(msg, isError = false) {
	grid.innerHTML = `<p class="status-msg${isError ? " error" : ""}">${msg}</p>`;
}

async function loadMovies(tab = currentTab, page = 1, append = false) {
	renderSkeleton();
	loadMoreBtn.disabled = true;

	try {
		let movies;
		let pages;

		if (usingTmdb) {
			if (!Object.keys(genreMap).length) await loadGenres();
			({ movies, totalPages: pages } = await fetchTmdbMovies(tab, page));
		} else {
			if (!allMovies.length) allMovies = await fetchSampleMovies();
			movies = allMovies;
			pages = 1;
			if (tab === "online") movies = [...allMovies].sort((a, b) => b.views - a.views);
			if (tab === "best") movies = [...allMovies].reverse();
		}

		currentPage = page;
		totalPages = pages;

		if (append) {
			allMovies = [...allMovies, ...movies];
			renderGrid(allMovies);
		} else {
			allMovies = movies;
			renderGrid(movies);
			updateHero(movies[0]);
		}

		loadMoreBtn.style.display = usingTmdb && page < pages ? "block" : "none";
		loadMoreBtn.disabled = false;
		loadMoreBtn.textContent = "Завантажити ще";
	} catch (err) {
		showStatus("Не вдалося завантажити дані", true);
		loadMoreBtn.disabled = false;
	}
}

grid.addEventListener("click", event => {
	const card = event.target.closest(".card");
	if (!card) return;
	const movie = visibleMovies.find(item => String(item.id) === card.dataset.id);
	if (!movie) return;

	if (event.target.closest(".favorite-btn")) {
		event.stopPropagation();
		toggleFavorite(movie);
		if (favoritesMode) {
			renderFavorites();
		} else {
			renderGrid(visibleMovies);
		}
		return;
	}

	openMovie(movie);
});

heroWatch.addEventListener("click", event => {
	if (!featuredMovie) {
		event.preventDefault();
		return;
	}
	try {
		sessionStorage.setItem("movie_" + featuredMovie.id, JSON.stringify(featuredMovie));
	} catch {}
});

document.querySelectorAll(".section-tabs button").forEach(btn => {
	btn.addEventListener("click", () => {
		document.querySelectorAll(".section-tabs button").forEach(b => b.classList.remove("active"));
		btn.classList.add("active");
		currentTab = btn.dataset.tab;
		document.getElementById("section-label").textContent = TAB_CONFIG[currentTab].label;
		loadMovies(currentTab, 1);
	});
});

loadMoreBtn.addEventListener("click", async () => {
	if (!usingTmdb || currentPage >= totalPages) return;

	const nextPage = currentPage + 1;

	loadMoreBtn.disabled = true;
	loadMoreBtn.textContent = "Завантаження...";

	try {
		if (currentCategory) {
			const { movies } = await fetchCategory(
				currentCategory,
				nextPage
			);

			currentPage = nextPage;
			allMovies = [...allMovies, ...movies];

			renderGrid(allMovies);
		} else {
			await loadMovies(
				currentTab,
				nextPage,
				true
			);
		}

		if (currentPage >= totalPages) {
			loadMoreBtn.style.display = "none";
		}

	} catch (error) {
		console.error(error);
		showStatus("Не вдалося завантажити більше", true);
	}

	loadMoreBtn.disabled = false;
	loadMoreBtn.textContent = "Завантажити ще";
});

document.getElementById("search").addEventListener("input", e => {
	clearTimeout(searchTimeout);
	const q = e.target.value.trim();
	searchTimeout = setTimeout(async () => {
		if (!q) {
			if (favoritesMode) {
				renderFavorites();
			} else {
				loadMovies(currentTab, 1);
			}
			return;
		}
		renderSkeleton(4);
		try {
			const results = favoritesMode
				? getFavorites().filter(m =>
					m.title.toLowerCase().includes(q.toLowerCase()) ||
					m.genre.toLowerCase().includes(q.toLowerCase())
				)
				: usingTmdb
				? await searchTmdb(q)
				: allMovies.filter(m =>
					m.title.toLowerCase().includes(q.toLowerCase()) ||
					m.genre.toLowerCase().includes(q.toLowerCase())
				);
			renderGrid(results);
		} catch {
			showStatus("Помилка пошуку", true);
		}
	}, 400);
});

function renderFavorites() {
	const favorites = getFavorites();
	document.getElementById("section-label").textContent = "\u041e\u0431\u0440\u0430\u043d\u0435";
	loadMoreBtn.style.display = "none";
	renderGrid(favorites);
}
document.querySelectorAll(".nav > a[data-category]").forEach(link => {
	link.addEventListener("click", async event => {
		event.preventDefault();

		const category = link.dataset.category;
		const config = CATEGORY_CONFIG[category];

		if (!config) return;

	
		document.querySelectorAll(".nav > a[data-category]")
			.forEach(item => item.classList.remove("active"));

		link.classList.add("active");

		const nav = document.getElementById("main-nav");
		const toggle = document.getElementById("menu-toggle");
		const overlay = document.getElementById("nav-overlay");

		nav?.classList.remove("open");
		overlay?.classList.remove("visible");
		toggle?.setAttribute("aria-expanded", "false");
		document.body.classList.remove("menu-open");

		currentCategory = category;
		currentPage = 1;

		document.getElementById("section-label").textContent = config.label;

		renderSkeleton();
		loadMoreBtn.disabled = true;

		try {
			const { movies, totalPages: pages } = await fetchCategory(category, 1);

			allMovies = movies;
			visibleMovies = movies;
			totalPages = pages;

			renderGrid(movies);

			if (movies.length) {
				updateHero(movies[0]);
			}

			loadMoreBtn.style.display =
				pages > 1 ? "block" : "none";

			loadMoreBtn.disabled = false;

		} catch (error) {
			console.error(error);
			showStatus("Не вдалося завантажити категорію", true);
			loadMoreBtn.disabled = false;
		}
	});
});
if (!TMDB_API_KEY) {
	usingTmdb = false;
}

if (favoritesMode) {
	document.querySelector(".hero").hidden = true;
	document.querySelector(".section-tabs").hidden = true;
	renderFavorites();
} else {
	loadMovies("latest", 1);
}
