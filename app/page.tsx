'use client';

import { useState, useEffect, useMemo } from 'react';
import { Star, Users, Heart, Plus, Download, Search, Filter } from 'lucide-react';
import { Movie, Rating, TasteProfile, UserId, Recommendation } from './types';
import { getAllMovies, calculateTasteProfile, getRecommendations } from './utils';
import { seedMovies } from './seed';
import MovieCard from './components/MovieCard';
import TasteRadar from './components/TasteRadar';

type Tab = 'darcy' | 'wife' | 'shared';

export default function MovieTasteApp() {
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('darcy');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSeen, setFilterSeen] = useState<'all' | 'seen' | 'unseen'>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMovieTitle, setNewMovieTitle] = useState('');
  const [newMovieYear, setNewMovieYear] = useState(new Date().getFullYear());

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('movieRatings');
    if (saved) {
      setRatings(JSON.parse(saved));
    } else {
      // Seed some initial ratings for demo
      const initialRatings: Rating[] = [
        { movieId: '1', userId: 'darcy', rating: 9, seen: true, notes: 'Mind-bending masterpiece', dateRated: '2025-01-15' },
        { movieId: '2', userId: 'darcy', rating: 10, seen: true, notes: 'Best superhero film ever', dateRated: '2025-01-10' },
        { movieId: '6', userId: 'darcy', rating: 8, seen: true, dateRated: '2025-02-01' },
        { movieId: '7', userId: 'darcy', rating: 9, seen: true, dateRated: '2024-12-20' },
        
        { movieId: '4', userId: 'wife', rating: 9, seen: true, notes: 'Brilliant social commentary', dateRated: '2025-01-20' },
        { movieId: '5', userId: 'wife', rating: 10, seen: true, notes: 'Absolutely loved this', dateRated: '2025-02-05' },
        { movieId: '10', userId: 'wife', rating: 8, seen: true, dateRated: '2025-01-05' },
        { movieId: '15', userId: 'wife', rating: 9, seen: true, dateRated: '2025-02-10' },
      ];
      setRatings(initialRatings);
      localStorage.setItem('movieRatings', JSON.stringify(initialRatings));
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (ratings.length > 0) {
      localStorage.setItem('movieRatings', JSON.stringify(ratings));
    }
  }, [ratings]);

  const movies = getAllMovies();
  const darcyProfile = useMemo(() => calculateTasteProfile(ratings, movies, 'darcy'), [ratings, movies]);
  const wifeProfile = useMemo(() => calculateTasteProfile(ratings, movies, 'wife'), [ratings, movies]);

  const darcyRecs = useMemo(() => getRecommendations(ratings, movies, 'darcy'), [ratings, movies]);
  const wifeRecs = useMemo(() => getRecommendations(ratings, movies, 'wife'), [ratings, movies]);
  const sharedRecs = useMemo(() => getRecommendations(ratings, movies, 'darcy', 'wife'), [ratings, movies]);

  const currentProfile = activeTab === 'darcy' ? darcyProfile : wifeProfile;
  const currentRecs = activeTab === 'darcy' ? darcyRecs : (activeTab === 'wife' ? wifeRecs : sharedRecs.filter(r => r.forBoth));

  const filteredMovies = useMemo(() => {
    return movies
      .filter(movie => {
        const matchesSearch = movie.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            movie.director.toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;

        const userRating = ratings.find(r => r.movieId === movie.id && r.userId === (activeTab === 'shared' ? 'darcy' : activeTab));
        
        if (filterSeen === 'seen') return userRating?.seen;
        if (filterSeen === 'unseen') return !userRating?.seen;
        return true;
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [movies, ratings, searchTerm, filterSeen, activeTab]);

  const handleRate = (movieId: string, rating: number, seen: boolean, notes?: string) => {
    setRatings(prev => {
      const existingIndex = prev.findIndex(r => r.movieId === movieId && r.userId === (activeTab === 'shared' ? 'darcy' : activeTab));
      
      const newRating: Rating = {
        movieId,
        userId: activeTab === 'shared' ? 'darcy' : activeTab,
        rating: Math.max(1, Math.min(10, rating)),
        seen,
        notes: notes || prev[existingIndex]?.notes,
        dateRated: new Date().toISOString().split('T')[0],
      };

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = newRating;
        return updated;
      } else {
        return [...prev, newRating];
      }
    });
  };

  const addNewMovie = () => {
    if (!newMovieTitle.trim()) return;
    
    const newMovie: Movie = {
      id: 'custom-' + Date.now(),
      title: newMovieTitle.trim(),
      year: newMovieYear,
      genres: ['Drama'],
      director: 'Unknown',
      actors: [],
      description: 'User added movie',
    };
    
    // In a real app we'd update seedMovies, but for now just rate it
    handleRate(newMovie.id, 7, true, 'New addition');
    setNewMovieTitle('');
    setShowAddForm(false);
  };

  const exportData = () => {
    const dataStr = JSON.stringify({ ratings, movies: seedMovies }, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `movie-taste-backup-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const userNames = {
    darcy: "Darcy's Taste",
    wife: "Wife's Taste",
    shared: "Shared Recommendations"
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-violet-600 rounded-2xl flex items-center justify-center">
              <span className="text-white text-2xl">🎬</span>
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Movie Taste</h1>
              <p className="text-sm text-zinc-500">Learn • Track • Recommend Together</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={exportData}
              className="flex items-center gap-2 px-4 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <div className="text-xs px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full font-mono text-zinc-500">
              {ratings.length} ratings
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-8 border-t border-zinc-100 dark:border-zinc-800">
          <div className="flex">
            {(['darcy', 'wife', 'shared'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setSearchTerm('');
                }}
                className={`px-8 py-4 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === tab 
                    ? 'border-violet-600 text-violet-600' 
                    : 'border-transparent hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {tab === 'shared' ? <Users className="w-4 h-4" /> : <Heart className="w-4 h-4" />}
                {userNames[tab]}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-8 py-8">
        <div className="grid grid-cols-12 gap-8">
          {/* Sidebar - Taste Profile */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">{userNames[activeTab]}</h2>
                {activeTab !== 'shared' && (
                  <div className="text-right">
                    <div className="text-4xl font-semibold text-violet-600">{currentProfile.avgRating}</div>
                    <div className="text-xs text-zinc-500 -mt-1">AVG RATING</div>
                  </div>
                )}
              </div>

              {activeTab !== 'shared' ? (
                <>
                  <TasteRadar profile={currentProfile} title={activeTab === 'darcy' ? "You" : "Wife"} />
                  
                  <div className="mt-8 grid grid-cols-2 gap-6 text-center">
                    <div>
                      <div className="text-3xl font-semibold">{currentProfile.totalRated}</div>
                      <div className="text-xs uppercase tracking-widest text-zinc-500 mt-1">Movies Rated</div>
                    </div>
                    <div>
                      <div className="text-3xl font-semibold">
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

            {/* Quick Add */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6">
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-950 text-sm font-medium"
              >
                <Plus className="w-4 h-4" /> Add a new movie
              </button>
              
              {showAddForm && (
                <div className="mt-4 space-y-4">
                  <input
                    type="text"
                    value={newMovieTitle}
                    onChange={(e) => setNewMovieTitle(e.target.value)}
                    placeholder="Movie title"
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm focus:outline-none focus:border-violet-500"
                  />
                  <div className="flex gap-3">
                    <input
                      type="number"
                      value={newMovieYear}
                      onChange={(e) => setNewMovieYear(parseInt(e.target.value))}
                      className="w-28 px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm focus:outline-none"
                    />
                    <button
                      onClick={addNewMovie}
                      className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-2xl py-3 transition-colors"
                    >
                      Add + Rate
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="col-span-12 lg:col-span-8 space-y-10">
            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-3.5 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search movies or directors..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl py-3.5 text-sm focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="flex gap-2">
                {(['all', 'seen', 'unseen'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilterSeen(f)}
                    className={`px-6 py-3 text-sm font-medium rounded-3xl transition-all ${
                      filterSeen === f 
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' 
                        : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100'
                    }`}
                  >
                    {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Recommendations Section */}
            {(activeTab === 'shared' || currentRecs.length > 0) ? (
              <div>
                <div className="flex items-baseline justify-between mb-6">
                  <h2 className="text-2xl font-semibold">Recommended for {activeTab === 'shared' ? 'Both' : 'You'}</h2>
                  <span className="text-xs uppercase tracking-widest text-zinc-400">Based on your taste profile</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentRecs.slice(0, 6).map((rec, index) => (
                    <div key={rec.movie.id} className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl p-6 flex gap-5 group">
                      <div className="flex-1">
                        <div className="flex justify-between">
                          <div>
                            <div className="font-semibold">{rec.movie.title}</div>
                            <div className="text-xs text-zinc-500">{rec.movie.year} • {rec.movie.genres[0]}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-mono text-emerald-500">{rec.score}</div>
                            <div className="text-[10px] text-emerald-600">MATCH</div>
                          </div>
                        </div>
                        <p className="text-xs mt-3 text-zinc-500 line-clamp-2">{rec.movie.description}</p>
                        <div className="mt-4 text-[10px] text-violet-600 font-medium">{rec.reason}</div>
                      </div>
                      <div className="flex flex-col gap-2 pt-1">
                        <button
                          onClick={() => handleRate(rec.movie.id, 7, true)}
                          className="px-5 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                        >
                          ✓ I've seen this
                        </button>
                        <button
                          onClick={() => handleRate(rec.movie.id, 8, true)}
                          className="px-5 py-2 text-xs font-medium border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-2xl transition-colors"
                        >
                          Rate later
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Your Movies / Library */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold flex items-center gap-3">
                  {activeTab === 'shared' ? 'Shared Library' : 'Your Movies'}
                  <span className="text-sm font-normal text-zinc-400">({filteredMovies.length})</span>
                </h2>
              </div>

              {filteredMovies.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredMovies.map(movie => {
                    const userRating = ratings.find(
                      r => r.movieId === movie.id && 
                           (activeTab === 'shared' ? true : r.userId === activeTab)
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
                <div className="bg-white dark:bg-zinc-900 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-3xl p-16 text-center">
                  <p className="text-zinc-400">No movies match your filters.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-8 text-center text-xs text-zinc-400 mt-16">
        Data saved in browser • Built with Next.js + Recharts • Your movie journey starts here
      </footer>
    </div>
  );
}
