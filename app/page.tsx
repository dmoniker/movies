'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Users, Heart, Download, Upload, Search, X, ChevronDown } from 'lucide-react';
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
  fetchDiscoverBrowse,
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
  loadDiscoveryMode,
  saveDiscoveryMode,
  loadBrowseStreamingPrefs,
  loadSavedBrowseFilters,
  saveBrowseFilters,
  persistStreamingSelections,
  clearAllBrowsePrefs,
  loadDismissals,
  saveDismissals,
  clearGrokCache,
  parseBackupFile,
  applyBackup,
  type ActiveTab,
  type DiscoveryMode,
} from './storage';
import MovieCard from './components/MovieCard';
import BrowseMovieCard from './components/BrowseMovieCard';
import TmdbFilterPanel from './components/TmdbFilterPanel';
import TasteRadar from './components/TasteRadar';
import RecommendationCard from './components/RecommendationCard';
import DismissRecModal from './components/DismissRecModal';
import {
  extractNetflixMovies,
  formatNetflixImportSummary,
  importNetflixMovies,
  type NetflixImportProgress,
} from './netflix-import';
import {
  DEFAULT_BROWSE_FILTERS,
  type BrowseLayout,
  type TmdbBrowseFilters,
} from './tmdb-browse';

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

function resolveDisplayMovie(movie: Movie, cache: Record<string, Movie>): Movie {
  const cached = cache[movie.id];
  if (cached?.director) {
    return { ...movie, ...cached };
  }
  return movie;
}

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
  const [discoveryMode, setDiscoveryMode] = useState<DiscoveryMode>('taste');
  const [browseFilters, setBrowseFilters] = useState<TmdbBrowseFilters>(DEFAULT_BROWSE_FILTERS);
  const [browseResults, setBrowseResults] = useState<Movie[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseTotalPages, setBrowseTotalPages] = useState(1);
  const [browseTotalResults, setBrowseTotalResults] = useState(0);
  const [browseLayout, setBrowseLayout] = useState<BrowseLayout>('grid');
  const [browsePrefsLoaded, setBrowsePrefsLoaded] = useState(false);

  const cachedMovies = useMemo(() => moviesFromCache(movieCache), [movieCache]);

  const ratingsRef = useRef(ratings);
  ratingsRef.current = ratings;
  const dismissalsRef = useRef(dismissals);
  dismissalsRef.current = dismissals;
  const cachedMoviesRef = useRef(cachedMovies);
  cachedMoviesRef.current = cachedMovies;
  const backupInputRef = useRef<HTMLInputElement>(null);
  const netflixInputRef = useRef<HTMLInputElement>(null);
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [netflixImportProgress, setNetflixImportProgress] = useState<NetflixImportProgress | null>(
    null
  );
  const pendingDirectorFetches = useRef(new Set<string>());

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
    setDiscoveryMode(loadDiscoveryMode());
    setDismissals(loadDismissals());
    const savedFilters = loadSavedBrowseFilters();
    const streamingPrefs = loadBrowseStreamingPrefs();
    setBrowseFilters({
      ...savedFilters,
      watchRegion: streamingPrefs.watchRegion,
      watchProviderIds:
        streamingPrefs.selectionsByRegion[streamingPrefs.watchRegion] ??
        savedFilters.watchProviderIds,
      page: 1,
    });
    setBrowsePrefsLoaded(true);
    fetchApiConfig()
      .then(setApiConfig)
      .catch(() => setApiConfig({ tmdb: false, xai: false }));
  }, []);

  useEffect(() => {
    saveActiveTab(activeTab);
  }, [activeTab]);

  useEffect(() => {
    saveDiscoveryMode(discoveryMode);
  }, [discoveryMode]);

  useEffect(() => {
    if (!browsePrefsLoaded) return;
    const timer = setTimeout(() => {
      saveBrowseFilters(browseFilters);
      persistStreamingSelections(browseFilters.watchRegion, browseFilters.watchProviderIds);
    }, 400);
    return () => clearTimeout(timer);
  }, [browseFilters, browsePrefsLoaded]);

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

      let filtered = filterAvailableRecs(batch, tab, currentRatings, currentDismissals).slice(
        0,
        REC_BATCH_SIZE
      );
      if (filtered.length > 0) {
        try {
          const enrichedMovies = await enrichMoviesWithDirectors(filtered.map((rec) => rec.movie));
          const enrichedById = new Map(enrichedMovies.map((movie) => [movie.id, movie]));
          filtered = filtered.map((rec) => ({
            ...rec,
            movie: enrichedById.get(rec.movie.id) ?? rec.movie,
          }));
          for (const rec of filtered) {
            if (rec.movie.director) {
              cacheMovie(rec.movie);
            }
          }
        } catch {
          // Keep recommendations even if director enrichment fails.
        }
      }
      setBatchUsedGrok(usedGrok);
      setRecBatchByTab((prev) => ({ ...prev, [tab]: filtered }));
    } catch {
      setRecBatchByTab((prev) => ({ ...prev, [tab]: [] }));
    } finally {
      setRecBatchLoading(false);
    }
  }, [activeTab, apiConfig.tmdb, apiConfig.xai, cacheMovie]);

  const loadRecBatchRef = useRef(loadRecBatch);
  loadRecBatchRef.current = loadRecBatch;

  useEffect(() => {
    if (!apiConfig.tmdb || discoveryMode !== 'taste') return;
    loadRecBatch();
  }, [activeTab, apiConfig.tmdb, apiConfig.xai, loadRecBatch, discoveryMode]);

  useEffect(() => {
    if (!apiConfig.tmdb || discoveryMode !== 'tmdbBrowse' || searchTerm.trim() || !browsePrefsLoaded)
      return;

    let cancelled = false;
    let loadingTimer: ReturnType<typeof setTimeout> | null = null;

    const debounceTimer = setTimeout(() => {
      const userId = actionUserId(activeTab);
      const excludeIds = ratings
        .filter((r) => {
          if (activeTab === 'shared') return r.seen || r.wantToSee;
          return r.userId === userId && (r.seen || r.wantToSee);
        })
        .map((r) => r.movieId);

      loadingTimer = setTimeout(() => {
        if (!cancelled) setBrowseLoading(true);
      }, 300);

      fetchDiscoverBrowse(browseFilters, excludeIds)
        .then(async (result) => {
          if (cancelled) return;
          const enriched = await enrichMoviesWithDirectors(result.movies);
          if (cancelled) return;
          setBrowseResults(enriched);
          setBrowseTotalPages(result.totalPages);
          setBrowseTotalResults(result.totalResults);
          for (const movie of enriched) {
            if (movie.director) cacheMovie(movie);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setBrowseResults([]);
            setBrowseTotalPages(1);
            setBrowseTotalResults(0);
          }
        })
        .finally(() => {
          if (loadingTimer) clearTimeout(loadingTimer);
          if (!cancelled) setBrowseLoading(false);
        });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(debounceTimer);
      if (loadingTimer) clearTimeout(loadingTimer);
    };
  }, [
    apiConfig.tmdb,
    discoveryMode,
    browseFilters,
    activeTab,
    ratings,
    searchTerm,
    cacheMovie,
    browsePrefsLoaded,
  ]);

  const darcyProfile = useMemo(
    () => calculateTasteProfile(ratings, cachedMovies, 'darcy'),
    [ratings, cachedMovies]
  );
  const wifeProfile = useMemo(
    () => calculateTasteProfile(ratings, cachedMovies, 'wife'),
    [ratings, cachedMovies]
  );

  const displayedRecBatch = recBatchByTab[activeTab] ?? [];

  useEffect(() => {
    if (!apiConfig.tmdb) return;

    const movieIds = new Set<string>();
    for (const rating of ratings) {
      movieIds.add(rating.movieId);
    }
    for (const rec of displayedRecBatch) {
      movieIds.add(rec.movie.id);
    }
    if (searchTerm.trim()) {
      for (const movie of browseMovies) {
        movieIds.add(movie.id);
      }
    }

    for (const movieId of movieIds) {
      const cached = movieCache[movieId];
      if (cached?.director || pendingDirectorFetches.current.has(movieId)) {
        continue;
      }

      pendingDirectorFetches.current.add(movieId);
      fetchMovieDetails(movieId)
        .then(cacheMovie)
        .catch(() => undefined)
        .finally(() => {
          pendingDirectorFetches.current.delete(movieId);
        });
    }
  }, [
    ratings,
    displayedRecBatch,
    browseMovies,
    searchTerm,
    movieCache,
    cacheMovie,
    apiConfig.tmdb,
  ]);

  const currentProfile = activeTab === 'darcy' ? darcyProfile : wifeProfile;

  const filteredMovies = useMemo(() => {
    const userId: UserId = activeTab === 'wife' ? 'wife' : 'darcy';
    const isSearching = searchTerm.trim().length > 0;

    let pool: Movie[];

    if (isSearching) {
      pool = browseMovies;
    } else if (discoveryMode === 'tmdbBrowse') {
      pool = browseResults;
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
      .map((movie) => resolveDisplayMovie(movie, movieCache))
      .filter((movie) => {
        if (isSearching || discoveryMode === 'tmdbBrowse') return true;

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
  }, [browseMovies, browseResults, cachedMovies, movieCache, ratings, filterSeen, activeTab, searchTerm, searchMode, discoveryMode]);

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

  const handleBackupImportClick = () => {
    setImportMenuOpen(false);
    backupInputRef.current?.click();
  };

  const handleNetflixImportClick = () => {
    setImportMenuOpen(false);
    netflixInputRef.current?.click();
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

  const handleNetflixImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!apiConfig.tmdb) {
      window.alert('TMDB must be configured before importing Netflix history.');
      return;
    }

    if (activeTab === 'shared') {
      window.alert('Switch to the Darcy or Wife tab first — Netflix import is added to that profile.');
      return;
    }

    let movies;
    let stats;
    try {
      ({ movies, stats } = extractNetflixMovies(await file.text()));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not read Netflix CSV file');
      return;
    }

    if (movies.length === 0) {
      window.alert('No movies found in this Netflix export. TV episodes are skipped automatically.');
      return;
    }

    const userId = actionUserId(activeTab);
    const profileLabel = tabLabels[activeTab];

    if (
      !window.confirm(
        `Import up to ${movies.length} movies from Netflix for ${profileLabel}? Titles will be matched on TMDB and marked as seen (without a rating).`
      )
    ) {
      return;
    }

    setNetflixImportProgress({ current: 0, total: movies.length });

    try {
      const seenMovieIds = new Set(
        ratings.filter((rating) => rating.userId === userId && rating.seen).map((rating) => rating.movieId)
      );

      const { matched, alreadySeen, unmatched } = await importNetflixMovies(movies, {
        searchMovies: async (query) => (await searchCatalog(query, 'title')).movies,
        isAlreadySeen: (movieId) => seenMovieIds.has(movieId),
        onProgress: setNetflixImportProgress,
      });

      if (matched.length === 0) {
        window.alert(
          formatNetflixImportSummary(
            { matched: 0, alreadySeen: alreadySeen.length, unmatched, stats },
            profileLabel
          )
        );
        return;
      }

      const watchedAtByMovieId = new Map(
        matched.map(({ candidate, movie }) => [movie.id, candidate.watchedAt])
      );

      setMovieCache((prev) => {
        const next = { ...prev };
        for (const { movie } of matched) {
          next[movie.id] = movie;
        }
        saveMovieCache(next);
        return next;
      });

      setRatings((prev) => {
        const next = [...prev];
        for (const { movie } of matched) {
          const existingIndex = next.findIndex(
            (rating) => rating.movieId === movie.id && rating.userId === userId
          );
          const watchedAt = watchedAtByMovieId.get(movie.id);
          const dateRated =
            watchedAt ?? next[existingIndex]?.dateRated ?? new Date().toISOString().split('T')[0];

          const newRating: Rating = {
            movieId: movie.id,
            userId,
            rating: 0,
            seen: true,
            wantToSee: false,
            notes: next[existingIndex]?.notes,
            dateRated,
          };

          if (existingIndex >= 0) {
            next[existingIndex] = newRating;
          } else {
            next.push(newRating);
          }

          seenMovieIds.add(movie.id);
        }
        return next;
      });

      for (const { movie } of matched) {
        if (!movie.director) {
          fetchMovieDetails(movie.id).then(cacheMovie).catch(() => undefined);
        }
      }

      window.alert(
        formatNetflixImportSummary(
          {
            matched: matched.length,
            alreadySeen: alreadySeen.length,
            unmatched,
            stats,
          },
          profileLabel
        )
      );
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Netflix import failed');
    } finally {
      setNetflixImportProgress(null);
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

  const isSearching = searchTerm.trim().length > 0;

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <header className="w-full overflow-x-hidden border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex items-center justify-between gap-3 min-w-0">
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
              ref={backupInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImportFile}
            />
            <input
              ref={netflixInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleNetflixImportFile}
            />
            <div className="relative">
              <button
                onClick={() => setImportMenuOpen((open) => !open)}
                disabled={netflixImportProgress !== null}
                className="flex items-center gap-2 p-2.5 sm:px-4 sm:py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-60"
                aria-label="Import data"
                aria-expanded={importMenuOpen}
                aria-haspopup="menu"
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {netflixImportProgress
                    ? `Importing ${netflixImportProgress.current}/${netflixImportProgress.total}`
                    : 'Import'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 opacity-60" />
              </button>
              {importMenuOpen ? (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-40 cursor-default"
                    aria-label="Close import menu"
                    onClick={() => setImportMenuOpen(false)}
                  />
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-50 mt-1 min-w-52 rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleBackupImportClick}
                      className="block w-full px-4 py-2.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      App backup (JSON)
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleNetflixImportClick}
                      className="block w-full px-4 py-2.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      Netflix history (CSV)
                    </button>
                  </div>
                </>
              ) : null}
            </div>
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

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-zinc-100 dark:border-zinc-800">
          <div className="flex w-full">
            {(['darcy', 'wife', 'shared'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 min-w-0 px-2 sm:px-8 py-3 sm:py-4 font-medium text-xs sm:text-sm border-b-2 transition-colors flex items-center justify-center gap-1.5 sm:gap-2 ${
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 min-w-0">
        {catalogError ? (
          <div className="mb-8 rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-6 py-4 text-sm text-amber-900 dark:text-amber-200">
            {catalogError}
          </div>
        ) : null}

        <div className="grid grid-cols-12 gap-5 sm:gap-8 min-w-0">
          <div className="col-span-12 lg:col-span-4 space-y-4 sm:space-y-6 order-2 lg:order-1 min-w-0">
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

          <div className="col-span-12 lg:col-span-8 space-y-6 sm:space-y-10 order-1 lg:order-2 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 min-w-0">
              <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-2xl w-full sm:w-auto min-w-0">
                <button
                  type="button"
                  onClick={() => setDiscoveryMode('taste')}
                  className={`flex-1 sm:flex-none px-4 sm:px-5 py-2.5 text-sm font-medium rounded-xl transition-all ${
                    discoveryMode === 'taste'
                      ? 'bg-white dark:bg-zinc-900 text-violet-600 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  For You
                </button>
                <button
                  type="button"
                  onClick={() => setDiscoveryMode('tmdbBrowse')}
                  className={`flex-1 sm:flex-none px-4 sm:px-5 py-2.5 text-sm font-medium rounded-xl transition-all ${
                    discoveryMode === 'tmdbBrowse'
                      ? 'bg-white dark:bg-zinc-900 text-violet-600 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  Browse TMDB
                </button>
              </div>
              <p className="text-xs text-zinc-500 sm:max-w-xs sm:text-right min-w-0">
                {discoveryMode === 'taste'
                  ? 'Watched history + Grok rerank picks for you'
                  : 'Hard filters on TMDB metadata — indie-first discovery'}
              </p>
            </div>

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

            {(activeTab === 'shared' || displayedRecBatch.length > 0 || recBatchLoading) &&
            !isSearching &&
            discoveryMode === 'taste' ? (
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
                          rec={{ ...rec, movie: resolveDisplayMovie(rec.movie, movieCache) }}
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
            ) : null}

            {discoveryMode === 'tmdbBrowse' && !isSearching ? (
              <TmdbFilterPanel filters={browseFilters} onChange={setBrowseFilters} />
            ) : null}

            <div>
              {!isSearching && discoveryMode === 'tmdbBrowse' ? (
                <div className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-6">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-xl sm:text-2xl font-semibold flex items-center gap-2 sm:gap-3 min-w-0">
                      <span className="truncate">TMDB Results</span>
                      <span className="text-sm font-normal text-zinc-400 shrink-0">
                        ({browseTotalResults.toLocaleString()} total)
                      </span>
                    </h2>
                    <div className="flex gap-2 shrink-0">
                      {(['grid', 'list'] as const).map((layout) => (
                        <button
                          key={layout}
                          type="button"
                          onClick={() => setBrowseLayout(layout)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                            browseLayout === layout
                              ? 'bg-violet-600 text-white'
                              : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600'
                          }`}
                        >
                          {layout === 'grid' ? 'Grid' : 'List'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : !isSearching && discoveryMode === 'taste' ? (
                <div className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-6">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-xl sm:text-2xl font-semibold flex items-center gap-2 sm:gap-3 min-w-0">
                      <span className="truncate">{activeTab === 'shared' ? 'Shared Library' : 'Your Movies'}</span>
                      <span className="text-sm font-normal text-zinc-400 shrink-0">({filteredMovies.length})</span>
                    </h2>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2 sm:overflow-x-auto sm:pb-0.5">
                    {(['seen', 'wantToSee', 'all', 'unseen'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFilterSeen(f)}
                        className={`min-w-0 px-3 sm:px-6 py-2.5 sm:py-3 text-sm font-medium rounded-2xl sm:rounded-3xl transition-all sm:whitespace-nowrap ${
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
              ) : (
                <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
                  <h2 className="text-xl sm:text-2xl font-semibold flex items-center gap-2 sm:gap-3 min-w-0">
                    <span className="truncate">Search Results</span>
                    <span className="text-sm font-normal text-zinc-400 shrink-0">({filteredMovies.length})</span>
                  </h2>
                </div>
              )}

              {(discoveryMode === 'tmdbBrowse' ? browseLoading : catalogLoading) ? (
                <div className="text-sm text-zinc-400">Loading movies from TMDB…</div>
              ) : filteredMovies.length > 0 ? (
                <>
                  <div
                    className={
                      discoveryMode === 'tmdbBrowse' && browseLayout === 'grid' && !isSearching
                        ? 'grid grid-cols-2 md:grid-cols-3 gap-4 min-w-0'
                        : 'grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0'
                    }
                  >
                    {filteredMovies.map((movie) => {
                      const userId: UserId = activeTab === 'wife' ? 'wife' : 'darcy';
                      const userRating = ratings.find(
                        (r) => r.movieId === movie.id && (activeTab === 'shared' ? true : r.userId === userId)
                      );

                      if (discoveryMode === 'tmdbBrowse' && !isSearching) {
                        return (
                          <BrowseMovieCard
                            key={movie.id}
                            movie={movie}
                            rating={userRating}
                            layout={browseLayout}
                            onRate={handleRate}
                            onWantToSee={handleWantToSee}
                          />
                        );
                      }

                      return (
                        <MovieCard
                          key={movie.id}
                          movie={movie}
                          rating={userRating}
                          onRate={handleRate}
                          onWantToSee={isSearching || discoveryMode === 'tmdbBrowse' ? handleWantToSee : undefined}
                        />
                      );
                    })}
                  </div>

                  {discoveryMode === 'tmdbBrowse' && !isSearching && browseTotalPages > 1 ? (
                    <div className="flex items-center justify-center gap-4 mt-6">
                      <button
                        type="button"
                        disabled={browseFilters.page <= 1 || browseLoading}
                        onClick={() =>
                          setBrowseFilters((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))
                        }
                        className="px-4 py-2 text-sm font-medium rounded-xl border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-zinc-500">
                        Page {browseFilters.page} of {browseTotalPages}
                      </span>
                      <button
                        type="button"
                        disabled={browseFilters.page >= browseTotalPages || browseLoading}
                        onClick={() =>
                          setBrowseFilters((prev) => ({
                            ...prev,
                            page: Math.min(browseTotalPages, prev.page + 1),
                          }))
                        }
                        className="px-4 py-2 text-sm font-medium rounded-xl border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="bg-white dark:bg-zinc-900 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl sm:rounded-3xl p-10 sm:p-16 text-center">
                  <p className="text-zinc-400">
                    {isSearching && searchMode === 'director' && !matchedDirector
                      ? `No director found matching "${searchTerm.trim()}". Try a full name.`
                      : isSearching
                        ? 'No movies match your search.'
                        : discoveryMode === 'tmdbBrowse'
                          ? 'No movies match your TMDB filters. Try widening the release window or lowering vote thresholds.'
                          : filterSeen === 'seen'
                            ? "No movies marked seen yet. Search TMDB to find titles and rate what you've watched."
                            : filterSeen === 'wantToSee'
                              ? 'Nothing on your want-to-see list. Tap Want to see on a recommendation or search for films.'
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
