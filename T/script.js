document.addEventListener('DOMContentLoaded', () => {
    // --- STATE ---
    const API_V3_KEY = '329f898e5642c90715fd2b4a81f0e2d6';
    const API_READ_ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIzMjlmODk4ZTU2NDJjOTA3MTVmZDJiNGE4MWYwZTJkNiIsIm5iZiI6MTcyODkxNTY1OS42NTAyMTksInN1YiI6IjYzYTRkNWQ3MzM0NGM2MDA3ZGMwYzRlOSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.7JRz28RfwmrRWR058vIiUztw_4L-FbBfL8BICq73-vc';
    const API_BASE_URL = 'https://api.themoviedb.org/3';
    const UNAVAILABLE_IMAGE_URL = 'https://tinyurl.com/28qhm7ep';
    const EXCLUDED_GENRE_NAMES = ['Reality', 'Talk', 'Soap', 'Kids', 'Animation', 'News', 'Documentary'];
    const EXCLUDED_KEYWORDS = ['wwe', 'award', 'awards', 'oscar', 'emmy', 'grammy', 'golden globe'];
    const EXCLUDED_TITLES = [
        "the jonathan ross show", "Good Mythical Morning", "Would I Lie to You?", "", "loose women", "the jeremy kyle show", "the graham norton show", "big brother", "love island", "the great british bake off", "strictly come dancing", "the apprentice", "i'm a celebrity... get me out of here!", "the only way is essex", "gogglebox", "rupaul’s drag race uk", "made in chelsea", "britain's got talent", "the masked singer", "the voice", "america's next top model", "top chef", "shark tank", "keeping up with the kardashians", "american idol", "the bachelor", "the bachelorette", "survivor", "good morning america", "live with kelly and mark", "the today show", "the drew barrymore show", "dr. phil", "the tonight show starring jimmy fallon", "jimmy kimmel live", "late night with seth meyers", "the late show with stephen colbert", "the daily show", "real time with bill maher", "judge judy", "mock the week", "a league of their own", "taskmaster", "never mind the buzzcocks", "8 out of 10 cats", "would i lie to you", "meet the richardsons", "big fat quiz", "hypothetical", "the danny kaye show", "deal or no deal"
    ].map(t => t.toLowerCase());
    const ADMIN_EMAILS = ['admin@cinehub.com', 'master@cinehub.com'];

    let mediaType = 'movie';
    let currentPage = 1;
    let totalPages = 1;
    let searchTerm = '';
    let isLoading = false;
    let currentFetchAbortController = null;
    let modalHistory = [];

    // Search & Watchlist state
    let isActorSearchMode = false;
    let isWatchlistMode = false;
    let isWatchingMode = false;
    let watchlistItems = [];
    let watchingItems = [];
    // NEW: Firestore-backed progress tracking
    let watchedProgress = {};
    let selectedSort = 'date_added_desc';
    let selectedNetwork = '';
    let lastPlayedItem = null;
    let heroItems = [];
    let currentHeroIndex = 0;
    let heroTimeoutId = null;
    let heroSlideStartTime = 0;
    let heroTimeRemaining = 8000;
    let isHeroPausedByModal = false;
    const heroCarouselController = { resume: null };
    let sessionListenerUnsubscribe = null;
    
    // Sort state
    let activeSort = 'default';
    let sortOrder = 'desc';
    let sortableInstance = null;

    // Filter states
    let selectedGenre = '';
    let selectedYear = '';
    let selectedCountry = '';
    let selectedLanguage = '';
    
    const networkToProviderMap = { '213': '8', '2552': '350', '1024': '9', '49': '384', '3186': '384', '6783': '384', '67': '37', '3353': '387', '4330': '531', '6219': '391', '318': '31', '453': '15', '174': '257', '1436': '188', '4692': '207', '2739': '337', '214': '39', '4': '2', '332': '2', '3': '2', '5871': '103', '26': '1796', '99': '138', '4025': '210', '19': '15', '6': '387' };

    // --- DOM ELEMENTS ---
    const header = document.getElementById('app-header');
    const heroBanner = document.getElementById('hero-banner');
    const movieTypeBtn = document.getElementById('movie-type-btn');
    const tvTypeBtn = document.getElementById('tv-type-btn');
    const watchingBtn = document.getElementById('watching-btn');
    const watchlistBtn = document.getElementById('watchlist-btn');
    const actorSearchToggle = document.getElementById('actor-search-toggle');
    const searchInput = document.getElementById('search-input');
    const searchResultsDropdown = document.getElementById('search-results-dropdown');
    const mediaContainer = document.getElementById('media-container');
    const loader = document.getElementById('loader');
    const noResults = document.getElementById('no-results');
    const sentinel = document.getElementById('sentinel');
    const resetBtn = document.getElementById('reset-filters-btn');
    const modalContainer = document.getElementById('modal-container');
    const filtersBar = document.querySelector('.filters-bar');
    const backToTopBtn = document.getElementById('back-to-top-btn');
    const toast = document.getElementById('toast-notification');
    const sortByWrapper = document.getElementById('sort-by-wrapper');
    const networkFilterWrapper = document.getElementById('network-filter-wrapper');
    const genreFilterWrapper = document.getElementById('genre-filter-wrapper');
    const yearFilterWrapper = document.getElementById('year-filter-wrapper');
    const countryFilterWrapper = document.getElementById('country-filter-wrapper');
    const languageFilterWrapper = document.getElementById('language-filter-wrapper');
    const sortControls = document.getElementById('sort-controls');
    const sortDefaultBtn = document.getElementById('sort-default-btn');
    const sortYearBtn = document.getElementById('sort-year-btn');
    const sortRateBtn = document.getElementById('sort-rate-btn');
    const sortPopularityBtn = document.getElementById('sort-popularity-btn');
    
    // --- AUTH DOM ELEMENTS (Updated) ---
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const loginModalBackdrop = document.getElementById('login-modal-backdrop');
    const loginModalClose = document.getElementById('login-modal-close');
    const loginSubmitBtn = document.getElementById('login-submit-btn');
    const loginEmailInput = document.getElementById('login-email');
    const loginPasswordInput = document.getElementById('login-password');

    // --- HELPERS ---
    const calculateAge = (birthday) => { if (!birthday) return 'N/A'; const ageDifMs = Date.now() - new Date(birthday).getTime(); const ageDate = new Date(ageDifMs); return Math.abs(ageDate.getUTCFullYear() - 1970); };
    const isExcludedByKeyword = (title) => { if (!title) return false; return EXCLUDED_KEYWORDS.some(keyword => title.toLowerCase().includes(keyword)); };
    const isItemExcluded = (item, excludedGenreIds) => { const title = (item.title || item.name || '').toLowerCase(); if (EXCLUDED_TITLES.includes(title)) return true; if (isExcludedByKeyword(title)) return true; if (!item.genre_ids || item.genre_ids.length === 0) return true; if (excludedGenreIds && item.genre_ids.some(id => excludedGenreIds.includes(id))) return true; return false; };
    const shuffleArray = (array) => { for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; } return array; };

    // --- API SERVICE ---
    const fetchFromApi = async (endpoint, options = {}, useV4Auth = false) => {
        const separator = endpoint.includes('?') ? '&' : '?';
        const url = `${API_BASE_URL}/${endpoint}${useV4Auth ? '' : `${separator}api_key=${API_V3_KEY}`}`;
        const fetchOptions = { ...options, headers: useV4Auth ? { 'Authorization': `Bearer ${API_READ_ACCESS_TOKEN}`, 'Content-Type': 'application/json;charset=utf-8', ...options.headers, } : options.headers, };
        try { const response = await fetch(url, fetchOptions); if (!response.ok) { throw new Error(`API Error: ${response.status}`); } return response.json(); } catch (error) { if (error.name !== 'AbortError') { console.error(`Fetch error for endpoint "${endpoint}":`, error); } throw error; }
    };
    const getExcludedGenreIds = async (type) => { try { const data = await fetchFromApi(`genre/${type}/list?language=en`); const genres = data.genres || []; return genres.filter(g => EXCLUDED_GENRE_NAMES.includes(g.name)).map(g => g.id); } catch (error) { console.error("Could not fetch excluded genre IDs", error); return []; } };
    
    // --- [ The following large, unchanged functions are included for completeness ] ---
    const fetchAndDisplayHeroBanner = async () => { const isDiscover = !isActorSearchMode && !isWatchlistMode && !isWatchingMode; if (window.innerWidth < 1024 || !isDiscover) { heroBanner.classList.add('hidden'); header.classList.remove('header-with-hero'); if (heroTimeoutId) clearTimeout(heroTimeoutId); heroItems = []; return; } try { if (heroTimeoutId) clearTimeout(heroTimeoutId); const excludedIds = await getExcludedGenreIds(mediaType); const fetchPromises = [fetchFromApi(`trending/${mediaType}/week?page=1`), fetchFromApi(`trending/${mediaType}/week?page=2`)]; const responses = await Promise.all(fetchPromises); let allResults = responses.flatMap(data => data.results || []); const validItems = allResults.filter(item => item.backdrop_path && item.overview && item.original_language === 'en' && !isItemExcluded(item, excludedIds)); if (validItems.length < 1) { heroBanner.classList.add('hidden'); header.classList.remove('header-with-hero'); return; } heroItems = shuffleArray(validItems).slice(0, 10); if (heroItems.length > 0) { header.classList.add('header-with-hero'); setupHeroCarousel(); } else { heroBanner.classList.add('hidden'); header.classList.remove('header-with-hero'); } } catch (error) { console.error("Failed to fetch hero banner:", error); heroBanner.classList.add('hidden'); header.classList.remove('header-with-hero'); } };
    const setupHeroCarousel = () => { if (heroTimeoutId) clearTimeout(heroTimeoutId); heroBanner.innerHTML = `<div id="hero-background-1" class="hero-background" style="opacity: 0;"></div><div id="hero-background-2" class="hero-background" style="opacity: 0;"></div><div class="hero-overlay"></div><div id="hero-content-wrapper" class="container"></div><div class="hero-controls"><button id="hero-prev-btn" class="hero-nav-btn" title="Previous"><i class="fas fa-chevron-left"></i></button><div class="hero-countdown"><div class="hero-countdown-bar animate"></div></div><button id="hero-next-btn" class="hero-nav-btn" title="Next"><i class="fas fa-chevron-right"></i></button></div>`; document.getElementById('hero-prev-btn').onclick = () => { const newIndex = (currentHeroIndex - 1 + heroItems.length) % heroItems.length; displayHeroSlide(newIndex, 'prev'); }; document.getElementById('hero-next-btn').onclick = () => { const newIndex = (currentHeroIndex + 1) % heroItems.length; displayHeroSlide(newIndex, 'next'); }; heroBanner.classList.remove('hidden'); displayHeroSlide(0); };
    const displayHeroSlide = async (index, direction = 'next') => { if (heroTimeoutId) clearTimeout(heroTimeoutId); if (!heroItems || heroItems.length === 0) return; currentHeroIndex = index; const heroItem = heroItems[currentHeroIndex]; const itemMediaType = heroItem.media_type || mediaType; const details = await fetchFromApi(`${itemMediaType}/${heroItem.id}?language=en-US`); const backdropUrl = `https://image.tmdb.org/t/p/original${details.backdrop_path}`; const title = details.title || details.name; const overview = details.overview; const genres = details.genres?.map(g => g.name).slice(0, 2).join(' • '); const releaseYear = (details.release_date || details.first_air_date || '').substring(0, 4); const escapedTitle = title.replace(/'/g, "\\'"); const truncatedOverview = overview.length > 250 ? overview.substring(0, 250) + '...' : overview; const heroMetaParts = []; if (releaseYear) heroMetaParts.push(releaseYear); if (genres) heroMetaParts.push(genres); const heroMeta = heroMetaParts.join(' | '); const contentWrapper = document.getElementById('hero-content-wrapper'); const newSlide = document.createElement('div'); newSlide.className = 'hero-content'; newSlide.innerHTML = `<h2 class="hero-title">${title}</h2><p class="hero-genres">${heroMeta}</p><p class="hero-description">${truncatedOverview}</p><div class="hero-buttons"><button class="hero-btn trailer-btn"><i class="fas fa-play"></i> Play Trailer</button><button class="hero-btn watchlist-btn" title="Add to Watchlist"><i class="fas fa-bookmark"></i> Watchlist</button><button class="hero-btn info-btn"><i class="fas fa-info-circle"></i> More Info</button><button class="hero-btn cast-btn"><i class="fa-solid fa-user-group"></i> View Cast</button></div>`; const bg1 = document.getElementById('hero-background-1'); const bg2 = document.getElementById('hero-background-2'); const activeBg = bg1.style.opacity === '1' ? bg1 : bg2; const inactiveBg = activeBg === bg1 ? bg2 : bg1; inactiveBg.style.backgroundImage = `url('${backdropUrl}')`; inactiveBg.style.opacity = '1'; if (activeBg) activeBg.style.opacity = '0'; contentWrapper.querySelectorAll('.hero-content.fade-out').forEach(el => el.remove()); const currentSlide = contentWrapper.querySelector('.hero-content'); newSlide.classList.add('fade-in'); contentWrapper.appendChild(newSlide); if (currentSlide) { currentSlide.classList.remove('fade-in'); currentSlide.classList.add('fade-out'); currentSlide.addEventListener('animationend', () => { if (currentSlide.parentNode) { currentSlide.remove(); } }, { once: true }); } const watchlistBtnEl = newSlide.querySelector('.hero-btn.watchlist-btn'); const countdownBar = heroBanner.querySelector('.hero-countdown-bar'); const advanceSlide = () => { const nextIndex = (currentHeroIndex + 1) % heroItems.length; displayHeroSlide(nextIndex, 'next'); }; const pauseCarousel = () => { if (heroTimeoutId) { clearTimeout(heroTimeoutId); heroTimeoutId = null; heroTimeRemaining -= (Date.now() - heroSlideStartTime); if (countdownBar) { countdownBar.style.animationPlayState = 'paused'; } } }; const performResume = () => { if (heroTimeoutId === null && heroTimeRemaining > 0) { heroSlideStartTime = Date.now(); if (countdownBar) { countdownBar.style.animationPlayState = 'running'; } heroTimeoutId = setTimeout(advanceSlide, heroTimeRemaining); } }; const resumeCarousel = () => { if (isHeroPausedByModal) return; performResume(); }; heroCarouselController.resume = performResume; newSlide.querySelector('.trailer-btn').onclick = () => { isHeroPausedByModal = true; pauseCarousel(); showTrailer(details.id, itemMediaType); }; newSlide.querySelector('.info-btn').onclick = () => { isHeroPausedByModal = true; pauseCarousel(); showSynopsis(details.id, itemMediaType, escapedTitle); }; newSlide.querySelector('.cast-btn').onclick = () => { isHeroPausedByModal = true; pauseCarousel(); showCast(details.id, itemMediaType); }; watchlistBtnEl.onclick = (e) => toggleWatchlistAction(details.id, itemMediaType, e.currentTarget); const isInWatchlist = watchlistItems.some(item => item.id == details.id); watchlistBtnEl.classList.toggle('in-watchlist', isInWatchlist); watchlistBtnEl.title = isInWatchlist ? "Remove from Watchlist" : "Add to Watchlist"; const heroButtonsContainer = newSlide.querySelector('.hero-buttons'); heroButtonsContainer.addEventListener('mouseenter', pauseCarousel); heroButtonsContainer.addEventListener('mouseleave', resumeCarousel); if (countdownBar) { countdownBar.style.animationPlayState = 'running'; countdownBar.classList.remove('animate'); void countdownBar.offsetWidth; countdownBar.classList.add('animate'); } heroTimeRemaining = 8000; heroSlideStartTime = Date.now(); heroTimeoutId = setTimeout(advanceSlide, heroTimeRemaining); };
    const fetchAndDisplayMedia = async (page = 1, append = false) => { if (isLoading) { if (currentFetchAbortController) currentFetchAbortController.abort(); } isLoading = true; currentFetchAbortController = new AbortController(); if (page === 1) { mediaContainer.innerHTML = ''; noResults.classList.add('hidden'); } loader.classList.remove('hidden'); try { let endpoint; const params = new URLSearchParams({ page: String(page), 'include_adult': 'false', }); if (searchTerm.length > 2) { params.append('language', 'en-US'); params.append('query', searchTerm); if (selectedYear) { params.append(mediaType === 'movie' ? 'primary_release_year' : 'first_air_date_year', selectedYear); } endpoint = `search/${mediaType}?${params.toString()}`; } else { const excludedIds = await getExcludedGenreIds(mediaType); let sortByParam; if (activeSort !== 'default') { let sortKey; if (activeSort === 'year') { sortKey = mediaType === 'movie' ? 'primary_release_date' : 'first_air_date'; const today = new Date().toISOString().split('T')[0]; params.append(mediaType === 'movie' ? 'primary_release_date.lte' : 'first_air_date.lte', today); } else if (activeSort === 'rate') { sortKey = 'vote_average'; params.append('vote_count.gte', '50'); } else { sortKey = 'popularity'; } sortByParam = `${sortKey}.${sortOrder}`; } else { sortByParam = 'popularity.desc'; } params.append('sort_by', sortByParam); if (excludedIds.length > 0) params.append('without_genres', excludedIds.join(',')); if (selectedGenre) params.append('with_genres', selectedGenre); if (selectedYear) params.append(mediaType === 'movie' ? 'primary_release_year' : 'first_air_date_year', selectedYear); if (selectedCountry) params.append('with_origin_country', selectedCountry); if (selectedLanguage) { params.append('with_original_language', selectedLanguage); } else { params.append('with_original_language', 'en|pt|es|it|fr'); } if (selectedNetwork) { if (mediaType === 'tv') { params.append('with_networks', selectedNetwork); } else if (mediaType === 'movie') { const providerId = networkToProviderMap[selectedNetwork]; if (providerId) { params.append('with_watch_providers', providerId); params.append('watch_region', selectedCountry || 'US'); params.append('with_watch_monetization_types', 'flatrate'); } } } endpoint = `discover/${mediaType}?${params.toString()}`; } const data = await fetchFromApi(endpoint, { signal: currentFetchAbortController.signal }); if (!append) mediaContainer.innerHTML = ''; let results = data.results || []; if (searchTerm.length <= 2) { const excludedIds = await getExcludedGenreIds(mediaType); results = results.filter(item => !isItemExcluded(item, excludedIds)); } const areAnyFiltersActive = searchTerm.length > 2 || selectedNetwork || selectedGenre || selectedYear || selectedCountry || selectedLanguage; if (activeSort === 'default' && !append && !areAnyFiltersActive) { for (let i = results.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[results[i], results[j]] = [results[j], results[i]]; } } results.forEach(item => { const card = createMediaCardElement(item); if(card) mediaContainer.appendChild(card); }); if (page === 1) { totalPages = Math.min(data.total_pages || 1, 500); if (results.length === 0) { noResults.innerHTML = `<i class="fas fa-ghost"></i><p>No results found.</p><p>Try adjusting your search or filters.</p>`; noResults.classList.remove('hidden'); } } updateAllCardWatchlistIcons(); } catch (error) { if (error.name !== 'AbortError') { console.error("Failed to fetch media:", error); if (!append) { mediaContainer.innerHTML = ''; noResults.innerHTML = `<i class="fas fa-exclamation-triangle"></i><p>API Error</p><p>Could not fetch data. Please try again later.</p>`; noResults.classList.remove('hidden'); } else { showToast('Error loading more results.'); currentPage = totalPages; } } } finally { isLoading = false; loader.classList.add('hidden'); currentFetchAbortController = null; } };
    const fetchAndDisplayPopularActors = async (page = 1, append = false) => { if (isLoading) { if (currentFetchAbortController) currentFetchAbortController.abort(); } isLoading = true; currentFetchAbortController = new AbortController(); if (!append) { mediaContainer.innerHTML = ''; noResults.classList.add('hidden'); } loader.classList.remove('hidden'); try { const data = await fetchFromApi(`person/popular?page=${page}`, { signal: currentFetchAbortController.signal }); let results = data.results || []; if (page === 1 && !append) { for (let i = results.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[results[i], results[j]] = [results[j], results[i]]; } } totalPages = data.total_pages || 1; if (results.length > 0) { results.forEach(person => { const personCard = createPersonCardElement(person); if (personCard) mediaContainer.appendChild(personCard); }); } else if (!append) { noResults.classList.remove('hidden'); } } catch (error) { if (error.name !== 'AbortError') { console.error("Popular actor fetch failed", error); if (!append) noResults.classList.remove('hidden'); } } finally { isLoading = false; loader.classList.add('hidden'); currentFetchAbortController = null; } };
    const fetchAndDisplayActors = async () => { if (isLoading) { if (currentFetchAbortController) currentFetchAbortController.abort(); } isLoading = true; currentFetchAbortController = new AbortController(); mediaContainer.innerHTML = ''; loader.classList.remove('hidden'); noResults.classList.add('hidden'); try { const personData = await fetchFromApi(`search/person?query=${encodeURIComponent(searchTerm)}&include_adult=false&language=en-US&page=1`, { signal: currentFetchAbortController.signal }); const actingPersons = personData.results?.filter(p => p.known_for_department === 'Acting' && p.profile_path); if (actingPersons && actingPersons.length > 0) { actingPersons.sort((a, b) => b.popularity - a.popularity); actingPersons.forEach(person => { const personCard = createPersonCardElement(person); mediaContainer.appendChild(personCard); }); } else { noResults.classList.remove('hidden'); } } catch (error) { if (error.name !== 'AbortError') { console.error("Actor search failed", error); noResults.classList.remove('hidden'); } } finally { isLoading = false; loader.classList.add('hidden'); currentFetchAbortController = null; } };
    const createCustomSelect = (wrapper, placeholder, options, onSelect) => { wrapper.innerHTML = ''; const selectContainer = document.createElement('div'); selectContainer.className = 'custom-select'; const input = document.createElement('input'); input.type = 'text'; input.className = 'custom-select-input'; input.placeholder = placeholder; input.setAttribute('aria-label', placeholder); input.setAttribute('autocomplete', 'off'); const arrow = document.createElement('i'); arrow.className = 'fas fa-chevron-down custom-select-arrow'; const optionsContainer = document.createElement('div'); optionsContainer.className = 'custom-select-options'; const closeAllSelects = (exceptThisOne = null) => { document.querySelectorAll('.custom-select-options.open').forEach(openContainer => { if (openContainer !== exceptThisOne) { openContainer.classList.remove('open'); } }); }; const toggleOptions = (forceOpen = null) => { const currentlyOpen = optionsContainer.classList.contains('open'); const shouldOpen = forceOpen !== null ? forceOpen : !currentlyOpen; closeAllSelects(shouldOpen ? optionsContainer : null); if (shouldOpen) { optionsContainer.classList.add('open'); } else { optionsContainer.classList.remove('open'); } }; const handleSelect = (optionEl) => { input.value = optionEl.dataset.value === '' ? '' : optionEl.textContent; if (input.value === '') input.placeholder = placeholder; onSelect(optionEl.dataset.value); toggleOptions(false); }; const allOption = document.createElement('div'); allOption.className = 'custom-select-option'; allOption.textContent = placeholder; allOption.dataset.value = ''; allOption.onclick = () => handleSelect(allOption); optionsContainer.appendChild(allOption); options.forEach(opt => { const optionEl = document.createElement('div'); optionEl.className = 'custom-select-option'; optionEl.textContent = opt.name; optionEl.dataset.value = opt.value; optionEl.onclick = () => handleSelect(optionEl); optionsContainer.appendChild(optionEl); }); input.addEventListener('input', () => { const filter = input.value.toLowerCase(); optionsContainer.querySelectorAll('.custom-select-option').forEach(opt => { const text = opt.textContent.toLowerCase(); opt.style.display = text.includes(filter) ? '' : 'none'; }); }); input.addEventListener('focus', () => toggleOptions(true)); selectContainer.addEventListener('click', (e) => e.stopPropagation()); input.addEventListener('keydown', (e) => { const isOptionsOpen = optionsContainer.classList.contains('open'); if (e.key === 'Escape') { toggleOptions(false); return; } if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!isOptionsOpen) toggleOptions(true); const visibleOptions = Array.from(optionsContainer.querySelectorAll('.custom-select-option')).filter(o => o.style.display !== 'none'); if (!visibleOptions.length) return; let highlightedIndex = visibleOptions.findIndex(opt => opt.classList.contains('highlighted')); if (highlightedIndex !== -1) { visibleOptions[highlightedIndex].classList.remove('highlighted'); } if (e.key === 'ArrowDown') { highlightedIndex = (highlightedIndex + 1) % visibleOptions.length; } else { highlightedIndex = (highlightedIndex - 1 + visibleOptions.length) % visibleOptions.length; } visibleOptions[highlightedIndex].classList.add('highlighted'); visibleOptions[highlightedIndex].scrollIntoView({ block: 'nearest' }); } if (e.key === 'Enter' && isOptionsOpen) { e.preventDefault(); const highlighted = optionsContainer.querySelector('.highlighted'); if (highlighted) { handleSelect(highlighted); } } }); selectContainer.append(input, arrow, optionsContainer); wrapper.appendChild(selectContainer); return { reset: () => { input.value = ''; input.placeholder = placeholder; } }; };
    let customSelects = {};
    const fetchFilterOptions = async () => { try { const [genresData, countriesData] = await Promise.all([fetchFromApi(`genre/movie/list?language=en`), fetchFromApi(`genre/tv/list?language=en`), fetchFromApi(`configuration/countries`),]); const allGenres = [...(genresData.genres || []), ...(countriesData.genres || [])]; const uniqueGenres = Array.from(new Map(allGenres.map(item => [item['id'], item])).values()); const excludedLower = EXCLUDED_GENRE_NAMES.map(name => name.toLowerCase()); const genreOptions = uniqueGenres.filter(g => !excludedLower.includes(g.name.toLowerCase())).sort((a,b) => a.name.localeCompare(b.name)).map(g => ({ value: g.id, name: g.name })); const languageOptions = [{ value: 'en', name: 'English' }, { value: 'pt', name: 'Portuguese' }, { value: 'fr', name: 'French' }, { value: 'es', name: 'Spanish' }, { value: 'it', name: 'Italian' }]; const countryOptions = (await fetchFromApi(`configuration/countries`) || []).sort((a,b) => a.english_name.localeCompare(b.english_name)).map(c => ({ value: c.iso_3166_1, name: c.english_name })); const yearOptions = []; const currentYear = new Date().getFullYear(); for(let i=0; i<70; i++) yearOptions.push({value: currentYear-i, name: String(currentYear-i)}); const networkOptions = [{ value: '213', name: 'Netflix' }, { value: '2552', name: 'Apple TV+' }, { value: '1024', name: 'Amazon Prime' }, { value: '49', name: 'HBO' }, { value: '3186', name: 'HBO Max' }, { value: '67', name: 'Showtime' }, { value: '3353', name: 'Peacock' }, { value: '4330', name: 'Paramount+' }, { value: '6219', name: 'MGM+' }, { value: '318', name: 'Starz' }, { value: '19', name: 'Fox' }, { value: '6', name: 'NBC' }, { value: '453', name: 'Hulu' }, { value: '174', name: 'AMC+' }, { value: '6783', name: 'Max' }, { value: '1436', name: 'YouTube' }, { value: '4692', name: 'Roku' }, { value: '2739', name: 'Disney+' }, { value: '214', name: 'Sky' }, { value: '4', name: 'BBC One' }, { value: '332', name: 'BBC Two' }, { value: '3', name: 'BBC Three' }, { value: '5871', name: 'ITV X' }, { value: '26', name: 'Channel 4' }, { value: '99', name: 'Channel 5' }, { value: '4025', name: 'BritBox' }].sort((a, b) => a.name.localeCompare(b.name)); const handleFilterChange = () => (isWatchlistMode || isWatchingMode) ? displayUserLists() : resetAndFetch(); customSelects.network = createCustomSelect(networkFilterWrapper, 'All Networks', networkOptions, (value) => { selectedNetwork = value; handleFilterChange(); }); customSelects.genre = createCustomSelect(genreFilterWrapper, 'All Genres', genreOptions, (value) => { selectedGenre = value; handleFilterChange(); }); customSelects.year = createCustomSelect(yearFilterWrapper, 'All Years', yearOptions, (value) => { selectedYear = value; handleFilterChange(); }); customSelects.country = createCustomSelect(countryFilterWrapper, 'All Countries', countryOptions, (value) => { selectedCountry = value; handleFilterChange(); }); customSelects.language = createCustomSelect(languageFilterWrapper, 'All Languages', languageOptions, (value) => { selectedLanguage = value; handleFilterChange(); }); } catch (error) { console.error("Failed to fetch filter options:", error); } };
    const destroySortable = () => { if (sortableInstance) { sortableInstance.destroy(); sortableInstance = null; } mediaContainer.classList.remove('sortable-active'); };
    const resetAndFetch = () => { destroySortable(); currentPage = 1; totalPages = 1; fetchAndDisplayMedia(1, false); };
    const updateSortButtonsUI = () => { const buttons = [{ el: sortDefaultBtn, key: 'default' }, { el: sortYearBtn, key: 'year' }, { el: sortRateBtn, key: 'rate' }, { el: sortPopularityBtn, key: 'popularity' }]; buttons.forEach(btn => { btn.el.classList.remove('active'); const oldIcon = btn.el.querySelector('.sort-icon'); if (oldIcon) oldIcon.remove(); if (btn.key === activeSort) { btn.el.classList.add('active'); if (activeSort !== 'default') { const icon = document.createElement('i'); icon.className = `fas fa-arrow-${sortOrder === 'desc' ? 'down' : 'up'} sort-icon`; btn.el.appendChild(icon); } } }); };
    const updateFiltersUI = () => { const isDiscover = !isActorSearchMode && !isWatchlistMode && !isWatchingMode; const canShowHero = window.innerWidth >= 1024; const showHero = isDiscover && canShowHero; const mediaTypeToggleContainer = movieTypeBtn.parentElement; const mainElement = document.querySelector('main.container'); if(heroBanner) { heroBanner.classList.toggle('hidden', !showHero); header.classList.toggle('header-with-hero', showHero); } if (mainElement) mainElement.style.paddingTop = showHero ? '2rem' : '8rem'; mediaTypeToggleContainer.classList.toggle('hidden', isWatchingMode); const allFilters = [networkFilterWrapper, genreFilterWrapper, yearFilterWrapper, countryFilterWrapper, languageFilterWrapper, resetBtn]; allFilters.forEach(el => el.classList.toggle('hidden', isActorSearchMode)); const showNetworkFilter = (isDiscover || isWatchlistMode) && mediaType === 'tv'; networkFilterWrapper.classList.toggle('hidden', !showNetworkFilter); sortControls.classList.toggle('hidden', !isDiscover); if (isActorSearchMode) { searchInput.placeholder = 'Search for Actors...'; } else if (mediaType === 'tv') { searchInput.placeholder = 'Search for TV Series...'; } else { searchInput.placeholder = 'Search for Films...'; } };
    
    // CHANGED: Now uses the global `watchedProgress` object
    const calculateNextEpisode = (item, progress) => {
        const itemProgress = progress[item.id];
        let nextUp = { season: 1, episode: 1 };
        if (!itemProgress || !item.seasons) return nextUp;
        const validSeasons = item.seasons.filter(s => s.season_number > 0 && s.episode_count > 0);
        if (validSeasons.length === 0) return nextUp;
        const lastWatchedSeason = validSeasons.find(s => s.season_number === itemProgress.season);
        if (lastWatchedSeason) {
            if (itemProgress.episode < lastWatchedSeason.episode_count) {
                nextUp = { season: itemProgress.season, episode: itemProgress.episode + 1 };
            } else {
                const nextSeason = validSeasons.find(s => s.season_number === itemProgress.season + 1);
                if (nextSeason) {
                    nextUp = { season: nextSeason.season_number, episode: 1 };
                } else {
                    nextUp = { season: itemProgress.season, episode: itemProgress.episode }; // Stay on last episode
                }
            }
        }
        return nextUp;
    };

    const formatRuntime = (minutes) => { if (!minutes || minutes === 0) return 'N/A'; const hours = Math.floor(minutes / 60); const mins = minutes % 60; return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`; };
    const generateEpisodeOptions = (episodeCount) => { if (!episodeCount || episodeCount === 0) return '<option>N/A</option>'; return Array.from({ length: episodeCount }, (_, i) => `<option value="${i + 1}">Ep ${i + 1}</option>`).join(''); };

    // CHANGED: Now saves progress to Firestore
    const openPlayer = async (id, type, controlsContainer, mediaDetails) => {
        const user = auth.currentUser;
        const isTV = type === 'tv';
        let src;
    
        if (isTV) {
            const seasonSelect = controlsContainer.querySelector('.player-season-select');
            const episodeSelect = controlsContainer.querySelector('.player-episode-select');
            const season = seasonSelect?.value || '1';
            const episode = episodeSelect?.value || '1';
            src = `https://vidsrc.to/embed/tv/${id}/${season}/${episode}`;
    
            if (user) {
                const progressRef = db.collection('users').doc(user.uid).collection('progress').doc(String(id));
                const newProgress = { season: parseInt(season, 10), episode: parseInt(episode, 10) };
                try {
                    await progressRef.set(newProgress);
                    watchedProgress[id] = newProgress; // Update local state
                } catch (error) {
                    console.error("Failed to save progress:", error);
                }
            }
    
            lastPlayedItem = { id, type, season: parseInt(season, 10), episode: parseInt(episode, 10), title: mediaDetails.title || mediaDetails.name };
            addToWatchingList(id, type);
        } else {
            src = `https://vidsrc.to/embed/movie/${id}`;
            lastPlayedItem = null;
        }
        window.open(src, '_blank');
    };

    const createPersonCardElement = (person) => { if (!person.profile_path) return null; const title = person.name; const posterUrl = `https://image.tmdb.org/t/p/w500${person.profile_path}`; const escapedName = title.replace(/'/g, "\\'"); const wrapper = document.createElement('div'); wrapper.className = 'media-card-wrapper'; const card = document.createElement('div'); card.className = 'media-card'; card.dataset.id = person.id; card.dataset.type = 'person'; card.dataset.detailsLoaded = 'false'; card.onclick = () => showFilmography(person.id, escapedName); card.innerHTML = `<img src="${posterUrl}" alt="Photo of ${title}" class="media-card-poster" loading="lazy"/><div class="media-card-overlay"><div class="details-pane"><div class="details-spinner"><div class="spinner-small"></div></div><div class="details-content hidden"><div class="details-text-container"><div class="person-name-text"><strong>${title}</strong></div><div class="nationality-text-container hidden"><strong><i class="fa-solid fa-location-dot" aria-hidden="true"></i></strong>⠀<span class="nationality-text"></span></div><div class="age-text-container hidden"><strong><i class="fa-solid fa-cake-candles" aria-hidden="true"></i></strong>⠀<span class="age-text"></span></div></div></div></div></div>`; wrapper.appendChild(card); return wrapper; };
    
    // CHANGED: Moved status tag container inside the overlay and added "On Air" logic.
    const createMediaCardElement = (media) => {
        const type = media.media_type || (media.first_air_date ? 'tv' : 'movie');
        const title = media.title || media.name || 'Unknown Title';
        const posterUrl = media.poster_path ? `https://image.tmdb.org/t/p/w500${media.poster_path}` : UNAVAILABLE_IMAGE_URL;
        const escapedTitle = title.replace(/'/g, "\\'");
        const wrapper = document.createElement('div');
        wrapper.className = 'media-card-wrapper';
        const card = document.createElement('div');
        card.className = 'media-card';
        card.dataset.id = media.id;
        card.dataset.type = type;
        const releaseYear = (media.release_date || media.first_air_date || 'N/A').substring(0, 4);
        const voteAverage = media.vote_average ? media.vote_average.toFixed(1) : '0.0';
        
        card.innerHTML = `
            <img src="${posterUrl}" alt="Poster for ${title}" class="media-card-poster" loading="lazy"/>
            <div class="media-card-overlay">
                <div class="status-tag-container"></div>
                <div class="media-card-meta">
                    <span>${releaseYear}</span>
                    <div class="media-card-rating">
                        <i class="fas fa-star"></i>
                        <span>${voteAverage}</span>
                    </div>
                </div>
                <div class="details-pane">
                    <div class="details-spinner"><div class="spinner-small"></div></div>
                    <div class="details-content hidden">
                        <div class="details-text-container">
                            <div class="country-text-container hidden"><i class="fa-solid fa-earth-americas" aria-hidden="true"></i><span class="country-text"></span></div>
                            <div class="language-text-container hidden"><i class="fa-regular fa-message" aria-hidden="true"></i><span class="language-text"></span></div>
                            <div class="genres-text-container hidden"><i class="fa-solid fa-clapperboard" aria-hidden="true"></i><span class="genres-text"></span></div>
                            <div class="series-text-container hidden"><i class="fa-regular fa-rectangle-list" aria-hidden="true"></i><span class="series-text"></span></div>
                            <div class="network-text-container hidden"><i class="fa-solid fa-tv" aria-hidden="true"></i><span class="network-text"></span></div>
                            <div class="runtime-text-container hidden"><i class="fa-regular fa-clock" aria-hidden="true"></i><span class="runtime-text"></span></div>
                        </div>
                        <div class="details-buttons">
                            <button class="details-btn watchlist-btn" title="Add to Watchlist"><i class="fas fa-bookmark"></i></button>
                            <button class="details-btn trailer-btn" title="Watch Trailer"><i class="fas fa-play"></i></button>
                            <button class="details-btn synopsis-btn" title="Read Synopsis"><i class="fas fa-info-circle"></i></button>
                            <button class="details-btn cast-btn" title="View Cast"><i class="fa-solid fa-user-group"></i></button>
                        </div>
                    </div>
                </div>
            </div>`;
    
        wrapper.appendChild(card);
    
        // Logic to populate details if already available in the media object
        if (media.genres) {
            const spinner = card.querySelector('.details-spinner');
            const content = card.querySelector('.details-content');
    
            if (type === 'tv' && media.status) {
                const statusTagContainer = card.querySelector('.status-tag-container');
                const status = media.status.replace(' Series', '');
                let displayStatus = status;
                let statusClass = status.toLowerCase().replace(' ', '-');

                if (media.status === 'Returning Series' && media.last_episode_to_air?.air_date) {
                    const lastAirDate = new Date(media.last_episode_to_air.air_date);
                    const today = new Date();
                    const timeDifference = today.getTime() - lastAirDate.getTime();
                    const daysDifference = timeDifference / (1000 * 3600 * 24);

                    if (daysDifference >= 0 && daysDifference < 8) {
                        displayStatus = 'On Air';
                        statusClass = 'on-air';
                    }
                }
                statusTagContainer.innerHTML = `<span class="status-tag status-${statusClass}">${displayStatus}</span>`;
            }
            if (type === 'tv') { const network = media.networks?.[0]?.name; if(network) { card.querySelector('.network-text').textContent = network; card.querySelector('.network-text-container').classList.remove('hidden'); } const seasons = media.number_of_seasons; if (seasons) { card.querySelector('.series-text').textContent = `${seasons} Season${seasons > 1 ? 's' : ''}`; card.querySelector('.series-text-container').classList.remove('hidden'); } } const runtime = media.runtime || (media.episode_run_time ? media.episode_run_time[0] : null); if (runtime) { card.querySelector('.runtime-text').textContent = formatRuntime(runtime); card.querySelector('.runtime-text-container').classList.remove('hidden'); } const country = media.production_countries?.[0]?.name; if(country) { let displayCountry = country; if (country === 'United States of America') displayCountry = 'USA'; if (country === 'United Kingdom') displayCountry = 'UK'; card.querySelector('.country-text').textContent = displayCountry; card.querySelector('.country-text-container').classList.remove('hidden'); } const language = media.spoken_languages?.[0]?.english_name; if(language) { card.querySelector('.language-text').textContent = language; card.querySelector('.language-text-container').classList.remove('hidden'); } const genres = media.genres?.map(g => g.name).join(', '); if (genres) { card.querySelector('.genres-text').textContent = genres; card.querySelector('.genres-text-container').classList.remove('hidden'); } spinner.classList.add('hidden'); content.classList.remove('hidden'); card.dataset.detailsLoaded = 'true'; } else { card.dataset.detailsLoaded = 'false'; } if (isWatchlistMode || isWatchingMode) { const playerControls = document.createElement('div'); playerControls.className = 'watchlist-player-controls'; if (type === 'tv' && media.seasons) { const validSeasons = media.seasons.filter(s => s.season_number > 0 && s.episode_count > 0); if (validSeasons.length > 0) {
            const nextUp = calculateNextEpisode(media, watchedProgress);
            const initialSeasonData = validSeasons.find(s => s.season_number === nextUp.season) || validSeasons[0]; playerControls.innerHTML = `<select class="player-season-select">${validSeasons.map(s => `<option value="${s.season_number}" ${s.season_number === nextUp.season ? 'selected' : ''}>S ${s.season_number}</option>`).join('')}</select><select class="player-episode-select">${generateEpisodeOptions(initialSeasonData.episode_count)}</select><button class="details-btn player-play-btn" title="Play Episode"><i class="fas fa-play"></i></button>`; const seasonSelect = playerControls.querySelector('.player-season-select'); const episodeSelect = playerControls.querySelector('.player-episode-select'); if (episodeSelect) episodeSelect.value = nextUp.episode; seasonSelect.addEventListener('change', () => { const selectedSeasonData = validSeasons.find(s => s.season_number == seasonSelect.value); if (selectedSeasonData) { episodeSelect.innerHTML = generateEpisodeOptions(selectedSeasonData.episode_count); } }); } } else if (type === 'movie') { playerControls.innerHTML = `<button class="details-btn player-play-btn movie" title="Play Movie"><i class="fas fa-play"></i></button>`; } if (playerControls.hasChildNodes()) { const playBtn = playerControls.querySelector('.player-play-btn'); if (playBtn) { playBtn.addEventListener('click', (e) => { e.stopPropagation(); openPlayer(media.id, type, playerControls, media); }); } wrapper.appendChild(playerControls); } } card.querySelector('.trailer-btn').onclick = (e) => { e.stopPropagation(); showTrailer(media.id, type); }; card.querySelector('.synopsis-btn').onclick = (e) => { e.stopPropagation(); showSynopsis(media.id, type, escapedTitle); }; card.querySelector('.cast-btn').onclick = (e) => { e.stopPropagation(); showCast(media.id, type); }; card.querySelector('.watchlist-btn').onclick = (e) => { e.stopPropagation(); toggleWatchlistAction(media.id, type, e.currentTarget); }; return wrapper; };
    const showToast = (message) => { toast.innerHTML = `<span>${message}</span>`; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3000); };
    const showNextEpisodeToast = (message, buttonText, onAction) => { toast.classList.remove('show'); toast.innerHTML = `<span>${message}</span><div class="toast-buttons-container"><button class="toast-action-btn">${buttonText}</button><button class="toast-close-btn">&times;</button></div>`; const actionBtn = toast.querySelector('.toast-action-btn'); const closeBtn = toast.querySelector('.toast-close-btn'); const closeToast = () => toast.classList.remove('show'); actionBtn.onclick = () => { onAction(); closeToast(); }; closeBtn.onclick = closeToast; toast.classList.add('show'); };
    const _setModalContent = (content, { isTrailer = false, isNavigable = false } = {}) => { const modalId = 'modal-backdrop'; const modal = document.createElement('div'); modal.id = modalId; modal.className = isTrailer ? 'modal-backdrop-trailer' : 'modal-backdrop'; const contentWrapper = document.createElement('div'); contentWrapper.className = isTrailer ? 'modal-content-trailer' : 'modal-content'; const singleClickHandler = (e) => { if (e.target.id === modalId) { isNavigable ? goBackInModal() : closeModal(); } }; const dblClickHandler = (e) => { if (e.target.id === modalId) { closeModal(); } }; modal.onclick = singleClickHandler; modal.ondblclick = dblClickHandler; const closeBtn = document.createElement('button'); closeBtn.className = isTrailer ? 'modal-close-btn-trailer' : 'modal-close-btn'; closeBtn.innerHTML = '<i class="fas fa-times fa-lg"></i>'; closeBtn.setAttribute('aria-label', 'Close modal'); closeBtn.onclick = closeModal; if (typeof content === 'string') { contentWrapper.innerHTML += content; } else { contentWrapper.appendChild(content); } contentWrapper.prepend(closeBtn); modal.appendChild(contentWrapper); modalContainer.innerHTML = ''; modalContainer.appendChild(modal); const filmographyContent = contentWrapper.querySelector('[data-filmography-person-id]'); if (filmographyContent) { const personId = filmographyContent.dataset.filmographyPersonId; const scrollKey = `filmography-scroll-${personId}`; const savedScrollTop = sessionStorage.getItem(scrollKey); if (savedScrollTop) { setTimeout(() => { contentWrapper.scrollTop = parseInt(savedScrollTop, 10); }, 0); } contentWrapper.addEventListener('scroll', () => { sessionStorage.setItem(scrollKey, contentWrapper.scrollTop); }); } document.documentElement.classList.add('is-modal-open'); };
    window.closeModal = () => { modalContainer.innerHTML = ''; document.documentElement.classList.remove('is-modal-open'); modalHistory = []; if (isHeroPausedByModal) { if (heroCarouselController.resume) { heroCarouselController.resume(); } isHeroPausedByModal = false; } };
    const goBackInModal = () => { if (modalHistory.length <= 1) { closeModal(); return; } modalHistory.pop(); const prevState = modalHistory[modalHistory.length - 1]; _setModalContent(prevState.content, prevState.options); };
    const createSpinnerHTML = () => `<div class="loader-container"><div class="spinner"></div></div>`;
    
    // CHANGED: Added "On Air" logic.
    const handleCardHover = async (e) => {
        const card = e.target.closest('.media-card');
        if (!card || card.dataset.detailsLoaded === 'true') return;
        const id = card.dataset.id;
        const type = card.dataset.type;
        card.dataset.detailsLoaded = 'true'; 
        const spinner = card.querySelector('.details-spinner');
        const content = card.querySelector('.details-content');
    
        try {
            if (type === 'person') {
                const details = await fetchFromApi(`person/${id}?language=en-US`);
                const age = calculateAge(details.birthday);
                if (age && age !== 'N/A') { card.querySelector('.age-text').textContent = age; card.querySelector('.age-text-container').classList.remove('hidden'); }
                const nationality = details.place_of_birth ? details.place_of_birth.split(',').pop().trim() : null;
                if (nationality) { card.querySelector('.nationality-text').textContent = nationality; card.querySelector('.nationality-text-container').classList.remove('hidden'); }
            } else {
                const details = await fetchFromApi(`${type}/${id}?language=en-US`);
                if (type === 'tv' && details.status) {
                    const statusTagContainer = card.querySelector('.status-tag-container');
                    const status = details.status.replace(' Series', '');
                    let displayStatus = status;
                    let statusClass = status.toLowerCase().replace(' ', '-');

                    if (details.status === 'Returning Series' && details.last_episode_to_air?.air_date) {
                        const lastAirDate = new Date(details.last_episode_to_air.air_date);
                        const today = new Date();
                        const timeDifference = today.getTime() - lastAirDate.getTime();
                        const daysDifference = timeDifference / (1000 * 3600 * 24);
                        
                        if (daysDifference >= 0 && daysDifference < 8) {
                            displayStatus = 'On Air';
                            statusClass = 'on-air';
                        }
                    }
                    statusTagContainer.innerHTML = `<span class="status-tag status-${statusClass}">${displayStatus}</span>`;
                }
                if (type === 'tv') { const network = details.networks?.[0]?.name; if (network) { card.querySelector('.network-text').textContent = network; card.querySelector('.network-text-container').classList.remove('hidden'); } const seasons = details.number_of_seasons; if (seasons) { card.querySelector('.series-text').textContent = `${seasons} Season${seasons > 1 ? 's' : ''}`; card.querySelector('.series-text-container').classList.remove('hidden'); } } const runtime = details.runtime || (details.episode_run_time ? details.episode_run_time[0] : null); if (runtime) { card.querySelector('.runtime-text').textContent = formatRuntime(runtime); card.querySelector('.runtime-text-container').classList.remove('hidden'); } const country = details.production_countries?.[0]?.name; if (country) { let displayCountry = country; if (country === 'United States of America') displayCountry = 'USA'; if (country === 'United Kingdom') displayCountry = 'UK'; card.querySelector('.country-text').textContent = displayCountry; card.querySelector('.country-text-container').classList.remove('hidden'); } const language = details.spoken_languages?.[0]?.english_name; if (language) { card.querySelector('.language-text').textContent = language; card.querySelector('.language-text-container').classList.remove('hidden'); } const genres = details.genres?.map(g => g.name).join(', '); if (genres) { card.querySelector('.genres-text').textContent = genres; card.querySelector('.genres-text-container').classList.remove('hidden'); }
            }
            spinner.classList.add('hidden');
            content.classList.remove('hidden');
        } catch (err) {
            console.error(`Error fetching details for ${type} on hover`, err);
            if (spinner) {
                spinner.innerHTML = `<p class="details-error-text">Could not load details.</p>`;
            }
        }
    };
    
    window.showTrailer = async (id, type) => {
        let content;
        try {
            const videos = await fetchFromApi(`${type}/${id}/videos?language=en-US`);
            const trailer = videos.results.find(v => v.type === 'Trailer' && v.site === 'YouTube');
            
            if (trailer) {
                // The key fix: use the standard youtube.com domain and set mute=1 to comply with browser autoplay policies.
                content = `
                    <div class="trailer-wrapper">
                        <iframe class="trailer-iframe" src="https://www.youtube.com/embed/${trailer.key}?autoplay=1&mute=1&modestbranding=1&rel=0" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                    </div>
                `;
            } else {
                content = `<div class="trailer-unavailable"><p>No trailer available</p></div>`;
            }
        } catch (error) {
            console.error("Could not fetch trailer:", error);
            content = `<div class="trailer-unavailable"><p>Could not load trailer.</p></div>`;
        }
        const options = { isTrailer: true, isNavigable: modalHistory.length > 0 };
        _setModalContent(content, options);
        modalHistory.push({ content, options });
    };

    window.showSynopsis = async (id, type, title) => { let content; try { const details = await fetchFromApi(`${type}/${id}?language=en-US`); const overview = details.overview || "No synopsis available for this title."; content = `<h2 class="modal-title">${title}</h2><p class="modal-body-text">${overview}</p>`; } catch (error) { content = `<h2 class="modal-title">${title}</h2><p class="modal-body-text">Could not load synopsis.</p>`; } const options = { isNavigable: modalHistory.length > 0 }; _setModalContent(content, options); modalHistory.push({ content, options }); };
    window.showCast = async (id, type) => { let content; try { const [{ cast }, mediaDetails] = await Promise.all([fetchFromApi(`${type}/${id}/credits?language=en-US`), fetchFromApi(`${type}/${id}?language=en-US`)]); const releaseDateStr = mediaDetails.release_date || mediaDetails.first_air_date; const releaseDate = releaseDateStr ? new Date(releaseDateStr) : null; const castToDisplay = (cast || []).slice(0, 15); const personDetailsPromises = castToDisplay.map(member => fetchFromApi(`person/${member.id}?language=en-US`)); const personDetails = await Promise.all(personDetailsPromises); let castGridHTML = ''; castToDisplay.forEach((member, index) => { const details = personDetails[index]; const profileUrl = member.profile_path ? `https://image.tmdb.org/t/p/w200${member.profile_path}` : UNAVAILABLE_IMAGE_URL; const currentAge = calculateAge(details.birthday); let ageDisplay = currentAge; if (releaseDate && details.birthday) { const birthDate = new Date(details.birthday); let ageAtRelease = releaseDate.getFullYear() - birthDate.getFullYear(); const monthDiff = releaseDate.getMonth() - birthDate.getMonth(); if (monthDiff < 0 || (monthDiff === 0 && releaseDate.getDate() < birthDate.getDate())) { ageAtRelease--; } if (ageAtRelease >= 0) { ageDisplay += ` (${ageAtRelease})`; } } const nationality = details.place_of_birth ? details.place_of_birth.split(',').pop().trim() : 'N/A'; const escapedName = member.name.replace(/'/g, "\\'"); castGridHTML += `<div class="cast-member" onclick="showFilmography(${member.id}, '${escapedName}')"><img src="${profileUrl}" alt="${member.name}" class="cast-member-image" /><p class="cast-member-name">${member.name}</p><p class="cast-member-character"><i class="fa-solid fa-masks-theater"></i> ${member.character}</p><p class="cast-member-meta"><i class="fa-solid fa-location-dot"></i> ${nationality}</p><p class="cast-member-meta"><i class="fa-solid fa-cake-candles"></i> ${ageDisplay}</p></div>`; }); content = `<h2 class="modal-title">Cast</h2><div class="cast-grid">${castGridHTML}</div>`; } catch (error) { console.error("Failed to fetch person details for cast:", error); content = `<h2 class="modal-title">Cast</h2><p class="modal-body-text" style="text-align: center;">Could not load cast details.</p>`; } const options = { isNavigable: modalHistory.length > 0 }; _setModalContent(content, options); modalHistory.push({ content, options }); };
    window.showFilmography = async (personId, name) => { let content; try { const [{ cast }, personDetails, excludedFilmographyGenreIds] = await Promise.all([fetchFromApi(`person/${personId}/combined_credits?language=en-US`), fetchFromApi(`person/${personId}?language=en-US`), Promise.all([getExcludedGenreIds('movie'), getExcludedGenreIds('tv')]).then(res => [...new Set(res.flat())])]); const filteredCredits = (cast || []).filter(item => { if (item.media_type !== 'movie' && item.media_type !== 'tv') return false; if (!item.poster_path) return false; if (item.media_type === 'movie' && !item.release_date) return false; if (item.media_type === 'tv' && !item.first_air_date) return false; return !isItemExcluded(item, excludedFilmographyGenreIds); }); const films = filteredCredits.filter(item => item.media_type === 'movie').sort((a, b) => new Date(b.release_date) - new Date(a.release_date)); const tvSeries = filteredCredits.filter(item => item.media_type === 'tv').sort((a, b) => new Date(b.first_air_date) - new Date(a.first_air_date)); const createGridHTML = (items) => { if (!items || items.length === 0) return ''; let gridHTML = '<div class="filmography-grid">'; items.forEach(item => { const posterUrl = `https://image.tmdb.org/t/p/w200${item.poster_path}`; const title = (item.title || item.name || '').replace(/'/g, "\\'"); const releaseYear = (item.release_date || item.first_air_date || 'N/A').substring(0, 4); const voteAverage = item.vote_average ? item.vote_average.toFixed(1) : 'N/A'; gridHTML += `<div class="filmography-item" onclick="showFilmographyItemDetails(${item.id}, '${item.media_type}')"><img src="${posterUrl}" alt="${title}" class="filmography-item-poster"/><div class="filmography-item-overlay"><div class="filmography-item-meta"><span>${releaseYear}</span><div class="filmography-item-rating"><i class="fas fa-star"></i><span>${voteAverage}</span></div></div></div></div>`; }); gridHTML += '</div>'; return gridHTML; }; const encodedName = encodeURIComponent(name); const imdbId = personDetails.imdb_id; let finalHTML = `<div class="modal-title-container"><h2 class="modal-title">Filmography of ${name}</h2><a href="https://www.google.com/search?q=${encodedName}" target="_blank" class="external-link-btn" title="Search for ${name} on Google"><i class="fab fa-google"></i></a>`; if (imdbId) { finalHTML += `<a href="https://www.imdb.com/name/${imdbId}/" target="_blank" class="external-link-btn" title="View ${name} on IMDb"><i class="fab fa-imdb"></i></a>`; } finalHTML += '</div>'; if (films.length > 0) { finalHTML += `<h4 style="font-size: 1.25rem; font-weight: 600; color: #3c4148; margin-top: 1.5rem;">Films</h4>`; finalHTML += createGridHTML(films); } if (tvSeries.length > 0) { finalHTML += `<h4 style="font-size: 1.25rem; font-weight: 600; color: #3c4148; margin-top: 1.5rem;">TV Series</h4>`; finalHTML += createGridHTML(tvSeries); } if (films.length === 0 && tvSeries.length === 0) { finalHTML += `<p class="modal-body-text" style="text-align: center; margin-top: 1rem;">No filmography found.</p>`; } content = `<div data-filmography-person-id="${personId}">${finalHTML}</div>`; } catch (error) { content = `<h2 class="modal-title">Filmography of ${name}</h2><p class="modal-body-text" style="text-align: center;">Could not load filmography.</p>`; } const options = { isNavigable: modalHistory.length > 0 }; _setModalContent(content, options); modalHistory.push({ content, options }); };
    window.showFilmographyItemDetails = async (itemId, itemType) => { let content; try { const details = await fetchFromApi(`${itemType}/${itemId}?language=en-US`); const posterUrl = details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : UNAVAILABLE_IMAGE_URL; const title = details.title || details.name || "Unknown Title"; const overview = details.overview || "No synopsis available."; const releaseYear = (details.release_date || details.first_air_date || 'N/A').substring(0, 4); const rating = details.vote_average ? `${details.vote_average.toFixed(1)}/10` : 'N/A'; const country = details.production_countries?.[0]?.name.replace('United States of America', 'USA').replace('United Kingdom', 'UK') || 'N/A'; const language = details.spoken_languages?.[0]?.english_name || 'N/A'; const genres = details.genres?.map(g => g.name).join(', ') || 'N/A'; const runtime = details.runtime || (details.episode_run_time ? details.episode_run_time[0] : null); const formattedRuntime = runtime ? `${Math.floor(runtime/60)}h ${runtime%60}m` : 'N/A'; content = document.createElement('div'); content.className = 'filmography-detail-container'; content.dataset.id = itemId; content.innerHTML = `<div class="filmography-detail-view"><img src="${posterUrl}" alt="Poster for ${title}" class="filmography-detail-poster"/><div class="filmography-detail-info"><h3>${title}</h3><div class="film-meta-grid"><div><strong><i class="fa-regular fa-star"></i></strong> ${rating}</div><div><strong><i class="fa-regular fa-calendar"></i></strong> ${releaseYear}</div><div><strong><i class="fa-solid fa-earth-americas"></i></strong> ${country}</div><div><strong><i class="fa-regular fa-message"></i></strong> ${language}</div><div><strong><i class="fa-solid fa-clapperboard"></i></strong> ${genres}</div><div><strong><i class="fa-regular fa-clock"></i></strong> ${formattedRuntime}</div></div><p class="filmography-detail-synopsis">${overview}</p><div class="details-buttons full-width"><button class="details-btn watchlist-btn" title="Add to Watchlist"><i class="fas fa-bookmark"></i> Watchlist</button><button class="details-btn trailer-btn" title="Watch Trailer"><i class="fas fa-play"></i> Trailer</button><button class="details-btn cast-btn" title="View Cast"><i class="fa-solid fa-user-group"></i> Cast</button></div></div></div>`; updateAllCardWatchlistIcons(); content.querySelector('.watchlist-btn').onclick = (e) => { e.stopPropagation(); toggleWatchlistAction(itemId, itemType, e.currentTarget); }; content.querySelector('.trailer-btn').onclick = (e) => { e.stopPropagation(); showTrailer(itemId, itemType); }; content.querySelector('.cast-btn').onclick = (e) => { e.stopPropagation(); showCast(itemId, itemType); }; } catch (error) { console.error("Failed to fetch item details from filmography:", error); content = document.createElement('div'); content.innerHTML = `<p class="modal-body-text" style="text-align: center;">Could not load details.</p>`; } const options = { isNavigable: true }; _setModalContent(content, options); modalHistory.push({ content, options }); };
    
    const debounce = (func, delay) => {
        let timeout;
        const debounced = (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
        debounced.cancel = () => {
            clearTimeout(timeout);
        };
        return debounced;
    };
    const throttle = (func, limit) => { let inThrottle; return function(...args) { const context = this; if (!inThrottle) { func.apply(context, args); inThrottle = true; setTimeout(() => inThrottle = false, limit); } }; };
    
    const handleSearch = () => { currentPage = 1; totalPages = 1; if (isActorSearchMode) { if (searchTerm.length > 2) { fetchAndDisplayActors(); } else if (searchTerm.length === 0) { fetchAndDisplayPopularActors(); } else { mediaContainer.innerHTML = ''; noResults.classList.add('hidden'); loader.classList.add('hidden'); } } else { (isWatchlistMode || isWatchingMode) ? displayUserLists() : resetAndFetch(); } };
    const debouncedSearch = debounce(handleSearch, 1000);
    
    const handleResize = debounce(() => { updateFiltersUI(); const canShowHero = window.innerWidth >= 1024; const isDiscover = !isActorSearchMode && !isWatchlistMode && !isWatchingMode; const heroHasContent = heroItems.length > 0; if (canShowHero && isDiscover && !heroHasContent) { fetchAndDisplayHeroBanner(); } }, 250);
    const handleSortChange = (newSort) => { if (isActorSearchMode || isWatchlistMode || isWatchingMode) return; if (activeSort === newSort && newSort !== 'default') { sortOrder = sortOrder === 'desc' ? 'asc' : 'desc'; } else { sortOrder = 'desc'; } activeSort = newSort; updateSortButtonsUI(); resetAndFetch(); };

    // --- LIVE SEARCH LOGIC ---
    const renderSearchResults = ({ movies, tvSeries, actors }) => {
        searchResultsDropdown.innerHTML = '';
        if (movies.length === 0 && tvSeries.length === 0 && actors.length === 0) {
            searchResultsDropdown.classList.add('hidden');
            return;
        }

        let html = '';
        const createItemHTML = (item, type) => {
            const posterPath = type === 'person' ? item.profile_path : item.poster_path;
            const posterUrl = posterPath ? `https://image.tmdb.org/t/p/w92${posterPath}` : UNAVAILABLE_IMAGE_URL;
            const title = type === 'movie' ? item.title : item.name;
            const year = type === 'person' ? 'Actor' : ((item.release_date || item.first_air_date || '').substring(0, 4) || 'N/A');
            const nameAttr = type === 'person' ? `data-name="${title.replace(/'/g, "\\'")}"` : '';

            return `
                <div class="search-result-item" data-id="${item.id}" data-type="${type}" ${nameAttr}>
                    <img src="${posterUrl}" alt="${title}" class="search-result-thumbnail" loading="lazy" />
                    <div class="search-result-info">
                        <div class="search-result-title">${title}</div>
                        <div class="search-result-meta">${year}</div>
                    </div>
                </div>`;
        };

        if (movies.length > 0) {
            html += `<div class="search-result-category">Films</div>`;
            movies.forEach(item => html += createItemHTML(item, 'movie'));
        }
        if (tvSeries.length > 0) {
            html += `<div class="search-result-category">TV Series</div>`;
            tvSeries.forEach(item => html += createItemHTML(item, 'tv'));
        }
        if (actors.length > 0) {
            html += `<div class="search-result-category">Actors</div>`;
            actors.forEach(item => html += createItemHTML(item, 'person'));
        }

        searchResultsDropdown.innerHTML = html;
        searchResultsDropdown.classList.remove('hidden');

        searchResultsDropdown.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                debouncedSearch.cancel(); // Prevent full search from triggering
                const id = item.dataset.id;
                const type = item.dataset.type;
                if (type === 'person') {
                    showFilmography(id, item.dataset.name);
                } else {
                    showFilmographyItemDetails(id, type);
                }
                searchResultsDropdown.classList.add('hidden');
            });
        });
    };

    const fetchLiveSearchResults = async (query) => {
        try {
            const data = await fetchFromApi(`search/multi?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`);
            const results = data.results || [];
            const movies = results.filter(r => r.media_type === 'movie' && r.poster_path).slice(0, 3);
            const tvSeries = results.filter(r => r.media_type === 'tv' && r.poster_path).slice(0, 2);
            const actors = results.filter(r => r.media_type === 'person' && r.profile_path && r.known_for_department === 'Acting').slice(0, 2);
            renderSearchResults({ movies, tvSeries, actors });
        } catch (error) {
            console.error("Live search failed:", error);
            searchResultsDropdown.classList.add('hidden');
        }
    };

    // --- WATCHLIST LOGIC (UPDATED FOR FIREBASE) ---
    const initSortable = () => {
        destroySortable();
        if (!isWatchlistMode || !auth.currentUser) return;

        mediaContainer.classList.add('sortable-active');
        sortableInstance = new Sortable(mediaContainer, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            delay: 500, // Long-press delay for touch devices
            delayOnTouchOnly: true, // Only delay on touch
            onEnd: async (evt) => {
                const user = auth.currentUser;
                if (!user) return;

                const items = Array.from(mediaContainer.querySelectorAll('.media-card-wrapper'));
                const newOrderedIds = items.map(wrapper => wrapper.querySelector('.media-card').dataset.id);

                watchlistItems.sort((a, b) => newOrderedIds.indexOf(String(a.id)) - newOrderedIds.indexOf(String(b.id)));

                const batch = db.batch();
                newOrderedIds.forEach((id, index) => {
                    const itemRef = db.collection('users').doc(user.uid).collection('watchlist').doc(String(id));
                    batch.update(itemRef, { order: index });
                });

                try {
                    await batch.commit();
                    showToast('Watchlist order saved!');
                } catch (error) {
                    console.error("Error saving watchlist order:", error);
                    showToast("Could not save new order.");
                    fetchUserLists();
                }
            },
        });
    };
    const fetchUserLists = async () => {
        const user = auth.currentUser;
        if (!user) {
            watchlistItems = [];
            watchingItems = [];
            watchedProgress = {};
            updateAllCardWatchlistIcons();
            return;
        }
        try {
            const watchlistPromise = db.collection('users').doc(user.uid).collection('watchlist').get();
            const watchingPromise = db.collection('users').doc(user.uid).collection('watching').get();
            // NEW: Fetch progress data
            const progressPromise = db.collection('users').doc(user.uid).collection('progress').get();

            const [watchlistSnapshot, watchingSnapshot, progressSnapshot] = await Promise.all([watchlistPromise, watchingPromise, progressPromise]);
            
            watchlistItems = watchlistSnapshot.docs.map(doc => doc.data());
            watchlistItems.sort((a, b) => {
                const orderA = typeof a.order === 'number' ? a.order : Infinity;
                const orderB = typeof b.order === 'number' ? b.order : Infinity;
                if (orderA !== Infinity || orderB !== Infinity) {
                    return orderA - orderB;
                }
                const dateA = a.date_added?.toDate ? a.date_added.toDate() : new Date(0);
                const dateB = b.date_added?.toDate ? b.date_added.toDate() : new Date(0);
                return dateB - dateA;
            });

            watchingItems = watchingSnapshot.docs.map(doc => doc.data());

            // NEW: Populate local progress object
            watchedProgress = {};
            progressSnapshot.forEach(doc => {
                watchedProgress[doc.id] = doc.data();
            });

            updateAllCardWatchlistIcons();
            if(isWatchlistMode || isWatchingMode) {
                displayUserLists();
            }
        } catch (error) {
            console.error("Failed to fetch user lists:", error);
            showToast("Could not load your lists.");
        }
    };
    const displayUserLists = () => {
        destroySortable();
        mediaContainer.innerHTML = '';
        noResults.classList.add('hidden');
        loader.classList.remove('hidden');
        let itemsToDisplay = isWatchingMode ? watchingItems : watchlistItems;
        let filtered = itemsToDisplay.filter(item => {
            const title = item.title || item.name || '';
            const releaseYear = (item.release_date || item.first_air_date || 'N/A').substring(0, 4);
            if (mediaType !== 'all' && item.media_type !== mediaType) return false;
            if (searchTerm.length > 2 && !title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
            if (selectedGenre && !item.genres.some(g => g.id == selectedGenre)) return false;
            if (selectedYear && releaseYear !== selectedYear) return false;
            if (selectedCountry && !(item.production_countries?.some(c => c.iso_3166_1 === selectedCountry))) return false;
            if (selectedLanguage && item.original_language !== selectedLanguage) return false;
            if (selectedNetwork && item.media_type === 'tv' && !item.networks?.some(n => n.id == selectedNetwork)) return false;
            return true;
        });

        if (!isWatchlistMode) {
             filtered.sort((a, b) => {
                const dateA = a.date_added?.toDate ? a.date_added.toDate() : new Date(0);
                const dateB = b.date_added?.toDate ? b.date_added.toDate() : new Date(0);
                return dateB - dateA;
            });
        }
       
        loader.classList.add('hidden');
        if (filtered.length === 0) {
            noResults.innerHTML = `<i class="fas fa-list-alt"></i><p>This list is empty.</p><p>Add some titles to get started!</p>`;
            noResults.classList.remove('hidden');
        } else {
            filtered.forEach(item => {
                const card = createMediaCardElement(item);
                if(card) mediaContainer.appendChild(card);
            });
            updateAllCardWatchlistIcons();
            initSortable();
        }
    };
    
    // CHANGED: Now checks both `watchlistItems` and `watchingItems`
    const updateAllCardWatchlistIcons = () => {
        const cards = document.querySelectorAll('.watchlist-btn');
        cards.forEach(btn => {
            const card = btn.closest('.media-card, .filmography-detail-container, .hero-banner');
            if (card) {
                const id = card.dataset.id;
                if (!id) return;
                const isInWatchlist = watchlistItems.some(item => item.id == id);
                const isInWatching = watchingItems.some(item => item.id == id);
                const isActive = isInWatchlist || isInWatching; // Activate if in either list
                btn.classList.toggle('in-watchlist', isActive);
                btn.title = isActive ? "Remove from My Lists" : "Add to Watchlist";
            }
        });
    };

    // CHANGED: Now handles removal from 'Watching' list as well
    const toggleWatchlistAction = async (id, type, button) => {
        const user = auth.currentUser;
        if (!user) {
            showToast('Please login to use this feature.');
            loginModalBackdrop.classList.remove('hidden');
            return;
        }
    
        const isInWatchlist = watchlistItems.some(item => item.id == id);
        const isInWatching = watchingItems.some(item => item.id == id);
        const isCurrentlyActive = isInWatchlist || isInWatching;
    
        const watchlistItemRef = db.collection('users').doc(user.uid).collection('watchlist').doc(String(id));
        const watchingItemRef = db.collection('users').doc(user.uid).collection('watching').doc(String(id));
    
        if (button) {
            button.disabled = true;
            button.classList.toggle('in-watchlist', !isCurrentlyActive);
            button.title = !isCurrentlyActive ? "Remove from My Lists" : "Add to Watchlist";
        }
    
        try {
            if (isCurrentlyActive) {
                // If it's active, it could be in either list, so we try to delete from both.
                if (isInWatchlist) await watchlistItemRef.delete();
                if (isInWatching) await watchingItemRef.delete();
                
                showToast('Removed from your lists');
                watchlistItems = watchlistItems.filter(item => item.id != id);
                watchingItems = watchingItems.filter(item => item.id != id);
                
                if ((isWatchlistMode || isWatchingMode) && button && button.closest('.media-card-wrapper')) {
                    button.closest('.media-card-wrapper')?.remove();
                    if (mediaContainer.children.length === 0) noResults.classList.remove('hidden');
                }
            } else {
                // If it's not active, add it to the standard watchlist.
                const itemDetails = await fetchFromApi(`${type}/${id}?append_to_response=seasons`);
                const maxOrder = watchlistItems.reduce((max, item) => Math.max(max, typeof item.order === 'number' ? item.order : -1), -1);
                const dataToSave = { ...itemDetails, media_type: type, date_added: new Date(), order: maxOrder + 1 };
                await watchlistItemRef.set(dataToSave);
                showToast('Added to Watchlist');
                watchlistItems.push(dataToSave);
            }
            updateAllCardWatchlistIcons();
        } catch (error) {
            console.error("Failed to update user lists:", error);
            showToast("Error updating lists.");
            if (button) {
                button.classList.toggle('in-watchlist', isCurrentlyActive);
                button.title = isCurrentlyActive ? "Remove from My Lists" : "Add to Watchlist";
            }
        } finally {
            if (button) {
                button.disabled = false;
            }
        }
    };

    const addToWatchingList = async (id, type) => {
        const user = auth.currentUser;
        if (!user || type !== 'tv') return;

        const isAlreadyWatching = watchingItems.some(item => item.id == id);
        if (isAlreadyWatching) return;

        const watchingItemRef = db.collection('users').doc(user.uid).collection('watching').doc(String(id));
        const watchlistItemRef = db.collection('users').doc(user.uid).collection('watchlist').doc(String(id));

        try {
            const itemDetails = await fetchFromApi(`${type}/${id}?append_to_response=seasons`);
            if (!itemDetails) throw new Error("Could not fetch item details.");

            const dataToSave = { ...itemDetails, media_type: type, date_added: new Date() };
            await watchingItemRef.set(dataToSave);
            watchingItems.push(dataToSave);
            showToast(`Moved '${itemDetails.name}' to Watching`);

            if (watchlistItems.some(item => item.id == id)) {
                await watchlistItemRef.delete();
                watchlistItems = watchlistItems.filter(item => item.id != id);
                if (isWatchlistMode) {
                    displayUserLists();
                }
            }
            updateAllCardWatchlistIcons();

        } catch (error) {
            console.error("Failed to add to watching list:", error);
            showToast("Error adding to watching list.");
        }
    };

    // --- AUTHENTICATION LOGIC (Updated for Login Only) ---
    const showLoginModal = () => { loginModalBackdrop.classList.remove('hidden'); }
    const closeAuthModal = () => { loginModalBackdrop.classList.add('hidden'); }

    loginBtn.addEventListener('click', showLoginModal);
    loginModalClose.addEventListener('click', closeAuthModal);

    // NEW/CHANGED LOGIC: Complete rewrite of the login handler for robust session management.
    loginSubmitBtn.addEventListener('click', async () => {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        if (!email || !password) {
            showToast('Please enter email and password.');
            return;
        }

        try {
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Admin users bypass the session check entirely.
            if (ADMIN_EMAILS.includes(user.email)) {
                showToast(`Admin login successful: ${user.email}`);
                closeAuthModal();
                return;
            }

            // For regular users, implement the "Last Login Wins" strategy.
            const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            const sessionRef = db.collection('sessions').doc(user.uid);

            // Overwrite any existing session with our new one. This allows login.
            await sessionRef.set({
                sessionId: newSessionId,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Store our unique session ID locally in Session Storage.
            sessionStorage.setItem('cinehubSessionId', newSessionId);

            showToast(`Logged in as ${user.email}`);
            closeAuthModal();

        } catch (error) {
            // This will now only catch standard auth errors (wrong password, etc.)
            showToast(`Login Error: ${error.message}`);
        }
    });
    
    // NEW/CHANGED LOGIC: Logout must clean up the session document and local storage.
    logoutBtn.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (user) {
            // Clean up the session document in Firestore.
            const sessionRef = db.collection('sessions').doc(user.uid);
            // We don't need to wait for this to complete to log the user out.
            sessionRef.delete().catch(e => console.error("Error deleting session on logout", e));
        }
        // Clean up local session storage.
        sessionStorage.removeItem('cinehubSessionId');
        
        auth.signOut().then(() => {
            showToast('You have been logged out.');
        }).catch(error => showToast(`Logout Error: ${error.message}`));
    });

    // NEW/CHANGED LOGIC: The auth state observer now manages the real-time session listener.
    auth.onAuthStateChanged(user => {
        // If a listener from a previous session exists, kill it.
        if (sessionListenerUnsubscribe) {
            sessionListenerUnsubscribe();
            sessionListenerUnsubscribe = null;
        }

        if (user) {
            // User is signed in.
            loginBtn.classList.add('hidden');
            logoutBtn.classList.remove('hidden');
            watchingBtn.disabled = false;
            watchlistBtn.disabled = false;
            fetchUserLists();

            // Do not attach a listener for admin users.
            if (!ADMIN_EMAILS.includes(user.email)) {
                const sessionRef = db.collection('sessions').doc(user.uid);
                // Attach the real-time listener.
                sessionListenerUnsubscribe = sessionRef.onSnapshot(doc => {
                    const localSessionId = sessionStorage.getItem('cinehubSessionId');
                    const remoteSessionId = doc.data()?.sessionId;

                    // If the doc is gone, or if the remote ID doesn't match our local one,
                    // it means another session has taken over. Sign this one out.
                    if (!doc.exists || (localSessionId && remoteSessionId && remoteSessionId !== localSessionId)) {
                        if (auth.currentUser) {
                           showToast('Signed out. New login detected elsewhere.');
                           // We call signOut(), which will trigger this onAuthStateChanged listener again
                           // for the 'logged out' state, cleaning everything up.
                           auth.signOut();
                        }
                    }
                });
            }

        } else {
            // User is signed out.
            loginBtn.classList.remove('hidden');
            logoutBtn.classList.add('hidden');
            watchingBtn.disabled = false;
            watchlistBtn.disabled = false;
            watchingItems = [];
            watchlistItems = [];
            watchedProgress = {};
            if(isWatchingMode || isWatchlistMode) {
                isWatchingMode = false;
                isWatchlistMode = false;
                watchingBtn.classList.remove('active');
                watchlistBtn.classList.remove('active');
                resetAndFetch();
            }
            updateAllCardWatchlistIcons();
        }
    });

    // --- EVENT LISTENERS (Updated) ---
    window.addEventListener('resize', handleResize);
    watchingBtn.addEventListener('click', () => {
        if (!auth.currentUser) {
            showToast('Please login to view your Watching list.');
            showLoginModal();
            return;
        }
        isWatchingMode = !isWatchingMode;
        watchingBtn.classList.toggle('active', isWatchingMode);
        if (isWatchingMode) {
            isWatchlistMode = false;
            watchlistBtn.classList.remove('active');
            isActorSearchMode = false;
            actorSearchToggle.classList.remove('active');
            mediaType = 'tv';
            movieTypeBtn.classList.remove('active');
            tvTypeBtn.classList.add('active');
            displayUserLists();
        } else {
            resetAndFetch();
        }
        updateFiltersUI();
    });
    watchlistBtn.addEventListener('click', () => {
        if (!auth.currentUser) {
            showToast('Please login to view your Watchlist.');
            showLoginModal();
            return;
        }
        isWatchlistMode = !isWatchlistMode;
        watchlistBtn.classList.toggle('active', isWatchlistMode);
        if (isWatchlistMode) {
            isWatchingMode = false;
            watchingBtn.classList.remove('active');
            isActorSearchMode = false;
            actorSearchToggle.classList.remove('active');
            if (!movieTypeBtn.classList.contains('active') && !tvTypeBtn.classList.contains('active')) {
                movieTypeBtn.classList.add('active');
                mediaType = 'movie';
            }
            displayUserLists();
        } else {
            resetAndFetch();
        }
        updateFiltersUI();
    });
    actorSearchToggle.addEventListener('click', () => { isActorSearchMode = !isActorSearchMode; actorSearchToggle.classList.toggle('active', isActorSearchMode); currentPage = 1; totalPages = 1; if (isActorSearchMode) { isWatchlistMode = false; watchlistBtn.classList.remove('active'); isWatchingMode = false; watchingBtn.classList.remove('active'); movieTypeBtn.classList.remove('active'); tvTypeBtn.classList.remove('active'); destroySortable(); if (searchTerm) { handleSearch(); } else { fetchAndDisplayPopularActors(); } } else { movieTypeBtn.classList.add('active'); mediaType = 'movie'; resetAndFetch(); } updateFiltersUI(); });
    movieTypeBtn.addEventListener('click', () => { if (mediaType === 'movie' && !isActorSearchMode) return; if (mediaType !== 'movie') { selectedNetwork = ''; if (customSelects.network) customSelects.network.reset(); } isActorSearchMode = false; actorSearchToggle.classList.remove('active'); isWatchingMode = false; watchingBtn.classList.remove('active'); mediaType = 'movie'; movieTypeBtn.classList.add('active'); tvTypeBtn.classList.remove('active'); fetchAndDisplayHeroBanner(); updateFiltersUI(); isWatchlistMode ? displayUserLists() : resetAndFetch(); });
    tvTypeBtn.addEventListener('click', () => { if (mediaType === 'tv' && !isActorSearchMode) return; isActorSearchMode = false; actorSearchToggle.classList.remove('active'); isWatchingMode = false; watchingBtn.classList.remove('active'); mediaType = 'tv'; tvTypeBtn.classList.add('active'); movieTypeBtn.classList.remove('active'); fetchAndDisplayHeroBanner(); updateFiltersUI(); isWatchlistMode ? displayUserLists() : resetAndFetch(); });
    
    let liveSearchDebounceTimeout = null;
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value;
        searchTerm = query;
    
        clearTimeout(liveSearchDebounceTimeout);
        if (query.length > 2) {
            liveSearchDebounceTimeout = setTimeout(() => {
                fetchLiveSearchResults(query);
            }, 300);
        } else {
            searchResultsDropdown.classList.add('hidden');
        }
    
        debouncedSearch();
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            searchResultsDropdown.classList.add('hidden');
            debouncedSearch.cancel();
            handleSearch();
        }
    });

    resetBtn.addEventListener('click', () => { searchTerm = ''; selectedGenre = ''; selectedYear = ''; selectedCountry = ''; selectedLanguage = ''; selectedNetwork = ''; activeSort = 'default'; sortOrder = 'desc'; updateSortButtonsUI(); currentPage = 1; totalPages = 1; searchInput.value = ''; Object.values(customSelects).forEach(s => s.reset()); if (isWatchlistMode || isWatchingMode) { displayUserLists(); } else if (isActorSearchMode) { fetchAndDisplayPopularActors(); } else { resetAndFetch(); } });
    sortDefaultBtn.addEventListener('click', () => handleSortChange('default'));
    sortYearBtn.addEventListener('click', () => handleSortChange('year'));
    sortRateBtn.addEventListener('click', () => handleSortChange('rate'));
    sortPopularityBtn.addEventListener('click', () => handleSortChange('popularity'));
    mediaContainer.addEventListener('mouseover', handleCardHover);
    const handleScroll = () => { const scrollTop = window.scrollY || document.documentElement.scrollTop; header.classList.toggle('scrolled', scrollTop > 50); if (filtersBar) { backToTopBtn.classList.toggle('hidden', scrollTop < filtersBar.offsetHeight + filtersBar.offsetTop); } };
    window.addEventListener('scroll', throttle(handleScroll, 150));
    backToTopBtn.addEventListener('click', () => { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (modalHistory.length > 0) { goBackInModal(); } else if (searchInput.value.trim() !== '') { searchInput.value = ''; searchTerm = ''; handleSearch(); } else { closeAuthModal(); } } });
    
    const handleLoginKeyPress = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            loginSubmitBtn.click();
        }
    };
    loginEmailInput.addEventListener('keydown', handleLoginKeyPress);
    loginPasswordInput.addEventListener('keydown', handleLoginKeyPress);

    document.addEventListener('click', (e) => { 
        document.querySelectorAll('.custom-select-options.open').forEach(optionsContainer => { optionsContainer.classList.remove('open'); });
        if (!searchResultsDropdown.classList.contains('hidden') && !searchInput.contains(e.target) && !searchResultsDropdown.contains(e.target)) {
            searchResultsDropdown.classList.add('hidden');
        }
    });
    
    // CHANGED: Now saves progress to Firestore instead of localStorage
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && lastPlayedItem && lastPlayedItem.type === 'tv') {
            const itemToProcess = { ...lastPlayedItem };
            lastPlayedItem = null;
            const seriesData = watchingItems.find(item => item.id === itemToProcess.id);
            if (!seriesData || !seriesData.seasons) { return; }
    
            let nextUp = null;
            const currentSeasonData = seriesData.seasons.find(s => s.season_number === itemToProcess.season);
            if (currentSeasonData && itemToProcess.episode < currentSeasonData.episode_count) {
                nextUp = { season: itemToProcess.season, episode: itemToProcess.episode + 1 };
            } else {
                const nextSeasonData = seriesData.seasons.find(s => s.season_number === itemToProcess.season + 1);
                if (nextSeasonData && nextSeasonData.episode_count > 0) {
                    nextUp = { season: nextSeasonData.season_number, episode: 1 };
                }
            }
    
            if (nextUp) {
                const message = `Finished S${itemToProcess.season}:E${itemToProcess.episode} of ${itemToProcess.title}?`;
                const buttonText = `Watch Next`;
                const onAction = async () => {
                    const user = auth.currentUser;
                    const src = `https://vidsrc.to/embed/tv/${itemToProcess.id}/${nextUp.season}/${nextUp.episode}`;
                    
                    if (user) {
                        const progressRef = db.collection('users').doc(user.uid).collection('progress').doc(String(itemToProcess.id));
                        const newProgress = { season: nextUp.season, episode: nextUp.episode };
                        try {
                            await progressRef.set(newProgress);
                            watchedProgress[itemToProcess.id] = newProgress;
                        } catch (error) { console.error("Failed to save next episode progress:", error); }
                    }
    
                    lastPlayedItem = { ...itemToProcess, season: nextUp.season, episode: nextUp.episode };
                    window.open(src, '_blank');
                    
                    const cardWrapper = document.querySelector(`.media-card[data-id="${seriesData.id}"]`)?.closest('.media-card-wrapper');
                    if (cardWrapper) {
                        const seasonSelect = cardWrapper.querySelector('.player-season-select');
                        const episodeSelect = cardWrapper.querySelector('.player-episode-select');
                        if(seasonSelect) seasonSelect.value = nextUp.season;
                        const selectedSeasonData = seriesData.seasons.find(s => s.season_number == nextUp.season);
                        if (selectedSeasonData && episodeSelect) {
                            episodeSelect.innerHTML = generateEpisodeOptions(selectedSeasonData.episode_count);
                            episodeSelect.value = nextUp.episode;
                        }
                    }
                };
                showNextEpisodeToast(message, buttonText, onAction);
            }
        }
    });

    const observer = new IntersectionObserver(entries => { if (entries[0].isIntersecting && !isLoading) { if (isActorSearchMode && searchTerm.length === 0) { if (currentPage < totalPages) { currentPage++; fetchAndDisplayPopularActors(currentPage, true); } } else if (!isWatchlistMode && !isWatchingMode && !isActorSearchMode) { if (currentPage < totalPages) { currentPage++; fetchAndDisplayMedia(currentPage, true); } } } }, { rootMargin: '200px' });
    observer.observe(sentinel);
    
    // --- INITIALIZATION ---
    fetchFilterOptions();
    updateFiltersUI();
    updateSortButtonsUI();
    resetAndFetch();
    fetchAndDisplayHeroBanner();
});
