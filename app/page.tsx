'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Users, Heart, Download, Upload, Search, X } from 'lucide-react';
import { Movie, Rating, Recommendation, UserId, DismissedRecommendation } from './types';
import { calculateTasteProfile, getRecommendations } from './utils';
import { rerankWithGrok } from './grok';
import { fetchApiConfig, type ApiConfig } from './api-client';
import { buildRulesFromDismissals, dismissalsForUser, isDismissed } from './rec-feedback';
import {
  fetchPopularMovies,
  searchCatalog,
  fetchMovieDetails,
  fetchRecommendationCandidates,
  enrichMoviesWithDirectors,
  type SearchMode,
} from './tmdb';
import {
  loadRatings,
  saveRatings,
  loadMovieCache,
  saveMovieCache,
  moviesFromCache,
  loadActiveTab,
  saveActiveTab,
  loadDismissals,
  saveDismissals,
  clearGrokCache,
  parseBackupFile,
  applyBackup,
  type ActiveTab,
} from './storage';
import MovieCard from './components/MovieCard';
import TasteRadar from './components/TasteRadar';
import RecommendationCard from './components/RecommendationCard';
import DismissRecModal from './components/DismissRecModal';

type LibraryFilter = 'seen' | 'wantToSee' | 'unseen' | 'all';
type Tab = ActiveTab;

function actionUserId(tab: Tab): UserId {
  return tab === 'wife' ? 'wife' : 'darcy';
}

function dismissUserIds(tab: Tab): UserId[] {
  return tab === 'shared' ? ['darcy', 'wife'] : [actionUserId(tab)];
}

const REC_BATCH_SIZE = 6;
const CARD_SETTLE_MS = 650;
const CARD_EXIT_MS = 300;

function filterAvailableRecs(
  recs: Recommendation[],
  tab: Tab,
  ratings: Rating[],
  dismissals: DismissedRecommendation[]
): Recommendation[] {
  const recUserId = actionUserId(tab);
  const dismissedFor = dismissUserIds(tab);
  return recs.filter((rec) => {
    if (isDismissed(dismissals, rec.movie.id, dismissedFor)) return false;
    const entry = ratings.find((r) => r.movieId === rec.movie.id && r.userId === recUserId);
    if (entry?.seen || entry?.wantToSee) return false;
    return true;
  });
}

export default function MovieTasteApp() {
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [movieCache, setMovieCache] = useState<Record<string, Movie>>({});
  const [browseMovies, setBrowseMovies] = useState<Movie[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('darcy');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('title');
  const [matchedDirector, setMatchedDirector] = useState<string | null>(null);
  const [filterSeen, setFilterSeen] = useState<LibraryFilter>('seen');
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [apiConfig, setApiConfig] = useState<ApiConfig>({ tmdb: false, xai: false });
  const [dismissals, setDismissals] = useState<DismissedRecommendation[]>([]);
  const [dismissTarget, setDismissTarget] = useState<Movie | null>(null);
  const [recBatchByTab, setRecBatchByTab] = useState<Partial<Record<Tab, Recommendation[]>>>({});
  const [recBatchLoading, setRecBatchLoading] = useState(false);
  const [batchUsedGrok, setBatchUsedGrok] = useState(false);
  const [grokError, setGrokError] = useState<string | null>(null);
  const [exitingCardIds, setExitingCardIds] = useState<Set<string>>(new Set());

  const cachedMovies = useMemo(() => moviesFromCache(movieCache), [movieCache]);

  const ratingsRef = useRef(ratings);
  ratingsRef.current = ratings;
  const dismissalsRef = useRef(dismissals);
  dismissalsRef.current = dismissals;
  const cachedMoviesRef = useRef(cachedMovies);
  cachedMoviesRef.current = cachedMovies;
  const importInputRef = useRef<HTMLInputElement>(null);

  const cacheMovie = useCallback((movie: Movie) => {
    setMovieCache((prev) => {
      const next = { ...prev, [movie.id]: movie };
      saveMovieCache(next);
      return next;
    });
  }, []);

  useEffect(() => {
    setRatings(loadRatings());
    setMovieCache(loadMovieCache());
    setActiveTab(loadActiveTab());
    setDismissals(loadDismissals());
    fetchApiConfig()
      .then(setApiConfig)
      .catch(() => setApiConfig({ tmdb: false, xai: false }));
  }, []);

  useEffect(() => {
    saveActiveTab(activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (ratings.length > 0) {
      saveRatings(ratings);
    }
  }, [ratings]);

  useEffect(() => {
    if (dismissals.length > 0) {
      saveDismissals(dismissals);
    }
  }, [dismissals]);

  useEffect(() => {
    if (!apiConfig.tmdb) {
      setCatalogError(
        'Add TMDB_API_KEY to .env.local on the server. Get a free key at themoviedb.org/settings/api'
      );
      setCatalogLoading(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setCatalogLoading(true);
      setCatalogError(null);

      try {
        if (!searchTerm.trim()) {
          if (!cancelled) {
            setMatchedDirector(null);
            setBrowseMovies([]);
          }
          return;
        }

        const { movies: results, matchedDirector: director } = await searchCatalog(
          searchTerm.trim(),
          searchMode
        );
        if (!cancelled) {
          setMatchedDirector(director ?? null);
          setBrowseMovies(results);
        }

        const needsDirectorEnrich = searchMode === 'title' || searchMode === 'all';
        const enriched = needsDirectorEnrich
          ? await enrichMoviesWithDirectors(results)
          : results;
        if (!cancelled) {
          setBrowseMovies(enriched);
          for (const movie of enriched) {
            if (movie.director) cacheMovie(movie);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setCatalogError(error instanceof Error ? error.message : 'Failed to load movies');
        }
      } finally {
        if (!cancelled) {
          setCatalogLoading(false);
        }
      }
    }, searchTerm.trim() ? 350 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchTerm, searchMode, cacheMovie, apiConfig.tmdb]);

  const searchPlaceholder =
    searchMode === 'title'
      ? 'Search by movie title…'
      : searchMode === 'director'
        ? 'Search by director name…'
        : 'Search titles and directors…';

  useEffect(() => {
    if (!apiConfig.tmdb) return;

    const ratedIds = [...new Set(ratings.map((r) => r.movieId))];
    for (const movieId of ratedIds) {
      const cached = movieCache[movieId];
      if (!cached?.director) {
        fetchMovieDetails(movieId)
          .then(cacheMovie)
          .catch(() => undefined);
      }
    }
  }, [ratings, movieCache, cacheMovie, apiConfig.tmdb]);

  const loadRecBatch = useCallback(async () => {
    if (!apiConfig.tmdb) return;

    const tab = activeTab;
    setRecBatchLoading(true);
    setGrokError(null);

    const currentRatings = ratingsRef.current;
    const currentDismissals = dismissalsRef.current;
    const movies = cachedMoviesRef.current;
    const userId = actionUserId(tab);
    const otherUserId = tab === 'shared' ? 'wife' : undefined;

    try {
      let candidates: Movie[];
      if (currentRatings.length === 0) {
        candidates = await fetchPopularMovies();
      } else {
        candidates = await fetchRecommendationCandidates(
          currentRatings,
          movies,
          userId,
          otherUserId
        );
      }
      let batch = getRecommendations(
        currentRatings,
        candidates,
        tab === 'wife' ? 'wife' : 'darcy',
        otherUserId,
        30
      );
      if (tab === 'shared') {
        batch = batch.filter((r) => r.forBoth);
      }

      let usedGrok = false;
      if (apiConfig.xai && currentRatings.length > 0 && batch.length > 0) {
        const profile = calculateTasteProfile(
          currentRatings,
          movies,
          tab === 'wife' ? 'wife' : 'darcy'
        );
        const otherProfile =
          tab === 'shared' ? calculateTasteProfile(currentRatings, movies, 'wife') : undefined;
        const grokDismissals =
          tab === 'shared' ? currentDismissals : dismissalsForUser(currentDismissals, userId);

        clearGrokCache();
        try {
          const result = await rerankWithGrok({
            ratings: currentRatings,
            movies,
            profile,
            otherProfile,
            userId,
            otherUserId,
            candidates: batch,
            mode: tab === 'shared' ? 'shared' : 'personal',
            dismissals: grokDismissals,
            avoidanceRules: buildRulesFromDismissals(grokDismissals),
          });
          if (result?.length) {
            batch = result;
            usedGrok = true;
          }
        } catch (error) {
          setGrokError(error instanceof Error ? error.message : 'Grok request failed');
        }
      }

      const filtered = filterAvailableRecs(batch, tab, currentRatings, currentDismissals).slice(
        0,
        REC_BATCH_SIZE
      );
      setBatchUsedGrok(usedGrok);
      setRecBatchByTab((prev) => ({ ...prev, [tab]: filtered }));
    } catch {
      setRecBatchByTab((prev) => ({ ...prev, [tab]: [] }));
    } finally {
      setRecBatchLoading(false);
    }
  }, [activeTab, apiConfig.tmdb, apiConfig.xai]);

  const loadRecBatchRef = useRef(loadRecBatch);
  loadRecBatchRef.current = loadRecBatch;

  useEffect(() => {
    if (!apiConfig.tmdb) return;
    loadRecBatch();
  }, [activeTab, apiConfig.tmdb, apiConfig.xai, loadRecBatch]);

  const darcyProfile = useMemo(
    () => calculateTasteProfile(ratings, cachedMovies, 'darcy'),
    [ratings, cachedMovies]
  );
  const wifeProfile = useMemo(
    () => calculateTasteProfile(ratings, cachedMovies, 'wife'),
    [ratings, cachedMovies]
  );

  const displayedRecBatch = recBatchByTab[activeTab] ?? [];

  const currentProfile = activeTab === 'darcy' ? darcyProfile : wifeProfile;

  const filteredMovies = useMemo(() => {
    const userId: UserId = activeTab === 'wife' ? 'wife' : 'darcy';
    const isSearching = searchTerm.trim().length > 0;

    let pool: Movie[];

    if (isSearching) {
      pool = browseMovies;
    } else {
      const relevantRatings =
        activeTab === 'shared' ? ratings : ratings.filter((r) => r.userId === userId);
      const byId = new Map(cachedMovies.map((m) => [m.id, m]));
      pool = relevantRatings
        .map((r) => byId.get(r.movieId))
        .filter((movie): movie is Movie => Boolean(movie));
      const seen = new Set<string>();
      pool = pool.filter((movie) => {
        if (seen.has(movie.id)) return false;
        seen.add(movie.id);
        return true;
      });
    }

    return pool
      .filter((movie) => {
        const userRating =
          activeTab === 'shared'
            ? ratings.find((r) => r.movieId === movie.id)
            : ratings.find((r) => r.movieId === movie.id && r.userId === userId);

        if (filterSeen === 'seen') return userRating?.seen;
        if (filterSeen === 'wantToSee') return userRating?.wantToSee && !userRating.seen;
        if (filterSeen === 'unseen') return !userRating?.seen && !userRating?.wantToSee;
        return true;
      })
      .sort((a, b) =>
        isSearching && searchMode === 'director'
          ? b.year - a.year
          : a.title.localeCompare(b.title)
      );
  }, [browseMovies, cachedMovies, ratings, filterSeen, activeTab, searchTerm, searchMode]);

  const handleRate = (
    movieId: string,
    rating: number,
    seen: boolean,
    notes?: string,
    wantToSee = false
  ) => {
    const userId = actionUserId(activeTab);
    const browseMovie = browseMovies.find((m) => m.id === movieId);
    const cachedMovie = movieCache[movieId];
    const movie = browseMovie ?? cachedMovie;

    if (movie) {
      cacheMovie(movie);
      if (!movie.director) {
        fetchMovieDetails(movieId).then(cacheMovie).catch(() => undefined);
      }
    }

    setRatings((prev) => {
      const existingIndex = prev.findIndex((r) => r.movieId === movieId && r.userId === userId);

      const newRating: Rating = {
        movieId,
        userId,
        rating: seen && rating > 0 ? Math.max(1, Math.min(10, rating)) : 0,
        seen,
        wantToSee: seen ? false : wantToSee,
        notes: notes || prev[existingIndex]?.notes,
        dateRated: new Date().toISOString().split('T')[0],
      };

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = newRating;
        return updated;
      }
      return [...prev, newRating];
    });
  };

  const scheduleBatchRemoval = useCallback((movieId: string) => {
    const tab = activeTab;
    window.setTimeout(() => {
      setExitingCardIds((prev) => new Set(prev).add(movieId));
      window.setTimeout(() => {
        setRecBatchByTab((prev) => {
          const next = (prev[tab] ?? []).filter((r) => r.movie.id !== movieId);
          if (next.length === 0) {
            window.setTimeout(() => loadRecBatchRef.current(), 0);
          }
          return { ...prev, [tab]: next };
        });
        setExitingCardIds((prev) => {
          const next = new Set(prev);
          next.delete(movieId);
          return next;
        });
      }, CARD_EXIT_MS);
    }, CARD_SETTLE_MS);
  }, [activeTab]);

  const ensureMovieCached = (movie: Movie) => {
    cacheMovie(movie);
    if (!movie.director) {
      fetchMovieDetails(movie.id).then(cacheMovie).catch(() => undefined);
    }
  };

  const handleWantToSee = (movie: Movie) => {
    ensureMovieCached(movie);
    handleRate(movie.id, 0, false, undefined, true);
  };

  const handleRecRate = (
    movieId: string,
    rating: number,
    seen: boolean,
    notes?: string,
    wantToSee = false
  ) => {
    handleRate(movieId, rating, seen, notes, wantToSee);
    scheduleBatchRemoval(movieId);
  };

  const handleRecWantToSee = (movie: Movie) => {
    handleWantToSee(movie);
    scheduleBatchRemoval(movie.id);
  };

  const handleDismissRec = (movie: Movie, tags: string[], note: string) => {
    const userId = actionUserId(activeTab);
    ensureMovieCached(movie);
    setDismissals((prev) => [
      ...prev,
      {
        movieId: movie.id,
        userId,
        title: movie.title,
        tags,
        note: note || undefined,
        dateDismissed: new Date().toISOString().split('T')[0],
      },
    ]);
    setDismissTarget(null);
    scheduleBatchRemoval(movie.id);
  };

  const exportData = () => {
    const dataStr = JSON.stringify({ ratings, movieCache, dismissals }, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `movie-taste-backup-${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const data = parseBackupFile(await file.text());
      const hasExisting =
        ratings.length > 0 || Object.keys(movieCache).length > 0 || dismissals.length > 0;

      if (
        hasExisting &&
        !window.confirm(
          'Import will replace your current ratings, cached movies, and dismissals. Continue?'
        )
      ) {
        return;
      }

      applyBackup(data);
      setRatings(data.ratings);
      setMovieCache(data.movieCache);
      setDismissals(data.dismissals);
      setRecBatchByTab({});
      setGrokError(null);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not import backup file');
    }
  };

  const userNames = {
    darcy: "Darcy's Taste",
    wife: "Wife's Taste",
    shared: 'Shared Recommendations',
  };

  const tabLabels = {
    darcy: 'Darcy',
    wife: 'Wife',
    shared: 'Both',
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-violet-600 rounded-2xl flex items-center justify-center shrink-0">
              <span className="text-white text-xl sm:text-2xl">🎬</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-tight truncate">Movie Taste</h1>
              <p className="text-xs sm:text-sm text-zinc-500 truncate">Learn • Track • Recommend Together</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <input
              ref={importInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImportFile}
            />
            <button
              onClick={handleImportClick}
              className="flex items-center gap-2 p-2.5 sm:px-4 sm:py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Import backup"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Import</span>
            </button>
            <button
              onClick={exportData}
              className="flex items-center gap-2 p-2.5 sm:px-4 sm:py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Export ratings"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <div className="text-xs px-2.5 sm:px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full font-mono text-zinc-500 whitespace-nowrap">
              {ratings.length} ratings
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-zinc-100 dark:border-zinc-800 overflow-x-auto">
          <div className="flex min-w-max sm:min-w-0">
            {(['darcy', 'wife', 'shared'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 sm:flex-none px-4 sm:px-8 py-3 sm:py-4 font-medium text-xs sm:text-sm border-b-2 transition-colors flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap ${
                  activeTab === tab
                    ? 'border-violet-600 text-violet-600'
                    : 'border-transparent hover:text-zinc-900 dark:hover:text-white text-zinc-500'
                }`}
              >
                {tab === 'shared' ? <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                <span className="sm:hidden">{tabLabels[tab]}</span>
                <span className="hidden sm:inline">{userNames[tab]}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8">
        {catalogError ? (
          <div className="mb-8 rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-6 py-4 text-sm text-amber-900 dark:text-amber-200">
            {catalogError}
          </div>
        ) : null}

        <div className="grid grid-cols-12 gap-5 sm:gap-8">
          <div className="col-span-12 lg:col-span-4 space-y-4 sm:space-y-6 order-2 lg:order-1">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl sm:rounded-3xl p-5 sm:p-8">
              <div className="flex items-center justify-between mb-4 sm:mb-6 gap-3">
                <h2 className="text-lg sm:text-xl font-semibold truncate">{userNames[activeTab]}</h2>
                {activeTab !== 'shared' && (
                  <div className="text-right shrink-0">
                    <div className="text-3xl sm:text-4xl font-semibold text-violet-600">{currentProfile.avgRating}</div>
                    <div className="text-xs text-zinc-500 -mt-1">AVG RATING</div>
                  </div>
                )}
              </div>

              {activeTab !== 'shared' ? (
                <>
                  <TasteRadar profile={currentProfile} title={activeTab === 'darcy' ? 'You' : 'Wife'} />

                  <div className="mt-6 sm:mt-8 grid grid-cols-2 gap-4 sm:gap-6 text-center">
                    <div>
                      <div className="text-2xl sm:text-3xl font-semibold">{currentProfile.totalRated}</div>
                      <div className="text-xs uppercase tracking-widest text-zinc-500 mt-1">Movies Rated</div>
                    </div>
                    <div>
                      <div className="text-2xl sm:text-3xl font-semibold">
                        {Object.keys(currentProfile.genrePrefs).length}
                      </div>
                      <div className="text-xs uppercase tracking-widest text-zinc-500 mt-1">Genres Explored</div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-8 text-center">
                  <div className="mx-auto w-16 h-16 bg-rose-100 dark:bg-rose-950 rounded-2xl flex items-center justify-center mb-6">
                    ❤️
                  </div>
                  <h3 className="font-medium mb-2">Date Night Recommender</h3>
                  <p className="text-sm text-zinc-500 max-w-[260px] mx-auto">
                    Movies with strong overlap between both of your tastes. Perfect for watching together.
                  </p>
                </div>
              )}
            </div>

            <div className="hidden sm:block bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl sm:rounded-3xl p-5 sm:p-6 text-sm text-zinc-500">
              Movies are loaded live from{' '}
              <a
                href="https://www.themoviedb.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-600 hover:underline"
              >
                TMDB
              </a>
              . Search to find anything in their catalog, then rate what you&apos;ve seen.
            </div>
          </div>

          <div className="col-span-12 lg:col-span-8 space-y-6 sm:space-y-10 order-1 lg:order-2">
            <div className="space-y-3">
              <div className="flex flex-col gap-3 sm:gap-4">
                <div className="relative flex-1 flex items-center gap-2 pl-4 pr-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl sm:rounded-3xl focus-within:border-violet-500 transition-colors">
                  <Search className="w-4 h-4 text-zinc-400 shrink-0 pointer-events-none" />
                  <input
                    type="text"
                    placeholder={searchPlaceholder}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 min-w-0 py-3 sm:py-3.5 bg-transparent border-0 outline-none text-base sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
                  />
                  {searchTerm ? (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      aria-label="Clear search"
                      className="shrink-0 p-2 rounded-full text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase tracking-widest text-zinc-400 w-full sm:w-auto sm:mr-1">Search by</span>
                {(
                  [
                    { id: 'title' as const, label: 'Title' },
                    { id: 'director' as const, label: 'Director' },
                    { id: 'all' as const, label: 'Both' },
                  ] as const
                ).map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setSearchMode(id)}
                    className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${
                      searchMode === id
                        ? 'bg-violet-600 text-white'
                        : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-violet-400'
                    }`}
                  >
                    {label}
                  </button>
                ))}
                {matchedDirector && searchMode !== 'title' ? (
                  <span className="text-xs text-zinc-500 w-full sm:w-auto sm:ml-2">
                    Showing films directed by{' '}
                    <span className="text-violet-600 font-medium">{matchedDirector}</span>
                  </span>
                ) : null}
              </div>
            </div>

            {(activeTab === 'shared' || displayedRecBatch.length > 0 || recBatchLoading) && (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 mb-4 sm:mb-6">
                  <h2 className="text-xl sm:text-2xl font-semibold">
                    Recommended for {activeTab === 'shared' ? 'Both' : 'You'}
                  </h2>
                  <span className="text-xs uppercase tracking-widest text-zinc-400">
                    {recBatchLoading
                      ? apiConfig.xai && ratings.length > 0
                        ? 'Finding your next picks…'
                        : 'Loading from TMDB…'
                      : batchUsedGrok
                        ? 'Powered by Grok'
                        : 'Based on your taste profile'}
                  </span>
                </div>

                {grokError ? (
                  <div className="text-sm text-amber-600 dark:text-amber-400 mb-3">{grokError}</div>
                ) : null}

                {recBatchLoading && displayedRecBatch.length === 0 ? (
                  <div className="text-sm text-zinc-400">Finding movies you might like…</div>
                ) : displayedRecBatch.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {displayedRecBatch.map((rec) => {
                      const recUserId = actionUserId(activeTab);
                      const recRating = ratings.find(
                        (r) => r.movieId === rec.movie.id && r.userId === recUserId
                      );

                      return (
                        <RecommendationCard
                          key={rec.movie.id}
                          rec={rec}
                          rating={recRating}
                          isExiting={exitingCardIds.has(rec.movie.id)}
                          onRate={handleRecRate}
                          onWantToSee={handleRecWantToSee}
                          onNotForMe={setDismissTarget}
                        />
                      );
                    })}
                  </div>
                ) : null}
              </div>
            )}

            <div>
              <div className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl sm:text-2xl font-semibold flex items-center gap-2 sm:gap-3 min-w-0">
                    <span className="truncate">{activeTab === 'shared' ? 'Shared Library' : 'Your Movies'}</span>
                    <span className="text-sm font-normal text-zinc-400 shrink-0">({filteredMovies.length})</span>
                  </h2>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-1 px-1">
                  {(['seen', 'wantToSee', 'all', 'unseen'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilterSeen(f)}
                      className={`flex-1 sm:flex-none min-w-[4.5rem] px-4 sm:px-6 py-2.5 sm:py-3 text-sm font-medium rounded-2xl sm:rounded-3xl transition-all whitespace-nowrap ${
                        filterSeen === f
                          ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                          : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100'
                      }`}
                    >
                      {f === 'wantToSee'
                        ? 'Want to see'
                        : f === 'all'
                          ? 'All'
                          : f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {catalogLoading ? (
                <div className="text-sm text-zinc-400">Loading movies from TMDB…</div>
              ) : filteredMovies.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredMovies.map((movie) => {
                    const userId: UserId = activeTab === 'wife' ? 'wife' : 'darcy';
                    const userRating = ratings.find(
                      (r) => r.movieId === movie.id && (activeTab === 'shared' ? true : r.userId === userId)
                    );
                    return (
                      <MovieCard
                        key={movie.id}
                        movie={movie}
                        rating={userRating}
                        onRate={handleRate}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white dark:bg-zinc-900 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl sm:rounded-3xl p-10 sm:p-16 text-center">
                  <p className="text-zinc-400">
                    {searchTerm.trim() && searchMode === 'director' && !matchedDirector
                      ? `No director found matching "${searchTerm.trim()}". Try a full name.`
                      : filterSeen === 'seen' && !searchTerm.trim()
                        ? "No movies marked seen yet. Search TMDB to find titles and rate what you've watched."
                        : filterSeen === 'wantToSee' && !searchTerm.trim()
                          ? 'Nothing on your want-to-see list. Tap Want to see on a recommendation or search for films.'
                          : searchTerm.trim()
                          ? 'No movies match your search.'
                          : 'No movies match your filters.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {dismissTarget ? (
        <DismissRecModal
          movie={dismissTarget}
          onClose={() => setDismissTarget(null)}
          onConfirm={(tags, note) => handleDismissRec(dismissTarget, tags, note)}
          onSkip={() => handleDismissRec(dismissTarget, [], '')}
        />
      ) : null}

      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-6 sm:py-8 px-4 text-center text-xs text-zinc-400 mt-10 sm:mt-16">
        Ratings saved in browser • Movie data from TMDB • Built with Next.js + Recharts
      </footer>
    </div>
  );
}
