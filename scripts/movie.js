const TMDB_API_KEY = "7627ec01e648f70a5862bc42c79fdb3d";

const TMDB_BASE = "https://api.themoviedb.org/3";
const IMG_POSTER = "https://image.tmdb.org/t/p/w500";
const IMG_BACKDROP = "https://image.tmdb.org/t/p/original";
const IMG_PROFILE = "https://image.tmdb.org/t/p/w185";
const LANG = "uk-UA";

const params = new URLSearchParams(location.search);
const movieId = params.get("id");

const backdropEl = document.getElementById("movie-backdrop");
const contentEl = document.getElementById("movie-content");
const trailerSection = document.getElementById("trailer-section");
const trailerFrame = document.getElementById("trailer-frame");
const castSection = document.getElementById("cast-section");
const castGrid = document.getElementById("cast-grid");

function esc(str) {
	const el = document.createElement("div");
	el.textContent = str;
	return el.innerHTML;
}

async function tmdbFetch(endpoint, extra = {}) {
	const url = new URL(TMDB_BASE + endpoint);
	url.searchParams.set("api_key", TMDB_API_KEY);
	url.searchParams.set("language", LANG);
	for (const [key, value] of Object.entries(extra)) {
		url.searchParams.set(key, value);
	}
	const res = await fetch(url);
	if (!res.ok) throw new Error("Помилка " + res.status);
	return res.json();
}

function getCached() {
	if (!movieId) return null;
	try {
		return JSON.parse(sessionStorage.getItem("movie_" + movieId));
	} catch {
		return null;
	}
}

function findTrailer(videos) {
	if (!videos || !videos.results) return null;
	const trailer = videos.results.find(v => v.type === "Trailer" && v.site === "YouTube");
	if (trailer) return trailer.key;
	const any = videos.results.find(v => v.site === "YouTube");
	return any ? any.key : null;
}

function renderMovie(data) {
	document.title = data.title + " — UAKino";

	if (data.backdrop) {
		backdropEl.style.backgroundImage = `linear-gradient(to bottom, rgba(12,12,12,0.3), var(--bg)), url("${data.backdrop}")`;
	}

	const poster = data.img
		? `<img class="movie-poster" src="${esc(data.img)}" alt="${esc(data.title)}" />`
		: `<div class="no-poster movie-poster">Немає</div>`;

	const genres = data.genre || "—";
	const runtime = data.runtime ? data.runtime + " хв" : null;

	contentEl.innerHTML = `
		<div class="movie-poster-wrap">${poster}</div>
		<div class="movie-info">
			<h1 class="movie-title">${esc(data.title)}</h1>
			<div class="movie-meta">
				${data.rating !== "—" ? `<span class="rating">${esc(data.rating)}</span>` : ""}
				<span>${esc(String(data.year))}</span>
				<span>${esc(genres)}</span>
				${runtime ? `<span>${esc(runtime)}</span>` : ""}
				<span class="badge-hd">1080p</span>
			</div>
			<p class="movie-overview">${esc(data.overview || "Опис відсутній.")}</p>
			<div class="movie-actions">
				<button class="btn-watch" id="btn-play">Дивитися</button>
				<button class="btn-secondary" id="btn-trailer" ${data.trailerKey ? "" : "hidden"}>Трейлер</button>
			</div>
		</div>`;

	if (data.trailerKey) {
		trailerSection.hidden = false;
		trailerFrame.src = "https://www.youtube.com/embed/" + data.trailerKey;
		document.getElementById("btn-trailer").addEventListener("click", () => {
			trailerSection.scrollIntoView({ behavior: "smooth" });
		});
	}

	document.getElementById("btn-play").addEventListener("click", () => {
		if (data.trailerKey) {
			trailerSection.hidden = false;
			trailerFrame.src = "https://www.youtube.com/embed/" + data.trailerKey + "?autoplay=1";
			trailerSection.scrollIntoView({ behavior: "smooth" });
		}
	});
}

function renderCast(credits) {
	if (!credits || !credits.cast || !credits.cast.length) return;
	const actors = credits.cast.slice(0, 8);
	castSection.hidden = false;
	castGrid.innerHTML = actors.map(person => {
		const photo = person.profile_path
			? `<img src="${IMG_PROFILE + person.profile_path}" alt="${esc(person.name)}" loading="lazy" />`
			: `<div class="cast-no-photo">${esc(person.name.charAt(0))}</div>`;
		return `
			<div class="cast-item">
				<div class="cast-photo">${photo}</div>
				<p class="cast-name">${esc(person.name)}</p>
				<p class="cast-role">${esc(person.character || "")}</p>
			</div>`;
	}).join("");
}

function renderError() {
	contentEl.innerHTML = `<p class="status-msg error" style="grid-column:1/-1">Фільм не знайдено. <a href="index.html">Повернутись</a></p>`;
}

async function loadFromTmdb(id) {
	const data = await tmdbFetch("/movie/" + id, {
		append_to_response: "videos,credits",
	});
	const trailerKey = findTrailer(data.videos);
	return {
		title: data.title || data.original_title,
		year: (data.release_date || "").slice(0, 4) || "—",
		rating: data.vote_average ? data.vote_average.toFixed(1) : "—",
		genre: (data.genres || []).map(g => g.name).join(", ") || "—",
		runtime: data.runtime,
		overview: data.overview || "",
		img: data.poster_path ? IMG_POSTER + data.poster_path : "",
		backdrop: data.backdrop_path ? IMG_BACKDROP + data.backdrop_path : "",
		trailerKey,
		credits: data.credits,
	};
}

async function loadFromCache(cached) {
	let movie = {
		title: cached.title,
		year: cached.year || "—",
		rating: cached.rating || "—",
		genre: cached.genre || "—",
		runtime: null,
		overview: cached.overview || "",
		img: cached.img || "",
		backdrop: cached.backdrop || cached.img || "",
		trailerKey: null,
		credits: null,
	};

	if (TMDB_API_KEY && cached.title) {
		try {
			const search = await tmdbFetch("/search/movie", { query: cached.title });
			const match = search.results && search.results[0];
			if (match) {
				const full = await loadFromTmdb(match.id);
				movie = { ...movie, ...full };
			}
		} catch {}
	}

	return movie;
}

async function init() {
	if (!movieId) {
		renderError();
		return;
	}

	try {
		let movie;

		if (TMDB_API_KEY) {
			movie = await loadFromTmdb(movieId);
		} else {
			const cached = getCached();
			if (!cached) {
				renderError();
				return;
			}
			movie = await loadFromCache(cached);
		}

		renderMovie(movie);
		renderCast(movie.credits);
	} catch {
		const cached = getCached();
		if (cached) {
			renderMovie(await loadFromCache(cached));
		} else {
			renderError();
		}
	}
}

init();
