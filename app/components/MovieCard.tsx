'use client';

import { Movie, Rating } from '../types';
import { Star, Eye, EyeOff } from 'lucide-react';

interface MovieCardProps {
  movie: Movie;
  rating?: Rating;
  onRate: (movieId: string, rating: number, seen: boolean, notes?: string) => void;
}

export default function MovieCard({ movie, rating, onRate }: MovieCardProps) {
  const currentRating = rating?.rating || 0;
  const isSeen = rating?.seen || false;

  const handleRating = (newRating: number) => {
    onRate(movie.id, newRating, true, rating?.notes);
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 hover:shadow-md transition-all group">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold text-lg leading-tight">{movie.title}</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{movie.year} • {movie.director}</p>
        </div>
        <div className="flex items-center gap-1 text-amber-500">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`w-4 h-4 cursor-pointer transition-colors ${
                i < Math.floor(currentRating / 2) ? 'fill-current' : 'text-zinc-300 dark:text-zinc-700'
              }`}
              onClick={() => handleRating((i + 1) * 2)}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 mb-4">
        {movie.genres.map(genre => (
          <span key={genre} className="inline-block px-2.5 py-0.5 text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full">
            {genre}
          </span>
        ))}
      </div>

      <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-3 mb-4">
        {movie.description}
      </p>

      <div className="flex items-center gap-3 text-xs">
        <button
          onClick={() => onRate(movie.id, currentRating, !isSeen, rating?.notes)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-colors ${
            isSeen 
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' 
              : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700'
          }`}
        >
          {isSeen ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          {isSeen ? 'Seen' : 'Mark Seen'}
        </button>

        {rating && (
          <div className="text-zinc-400">
            Rated <span className="font-mono text-emerald-600">{currentRating}</span>/10
          </div>
        )}
      </div>
    </div>
  );
}
