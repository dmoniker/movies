'use client';

import { Movie, Rating } from '../types';
import { Star, Eye, EyeOff, Bookmark } from 'lucide-react';
import Image from 'next/image';

interface MovieCardProps {
  movie: Movie;
  rating?: Rating;
  onRate: (movieId: string, rating: number, seen: boolean, notes?: string, wantToSee?: boolean) => void;
}

export default function MovieCard({ movie, rating, onRate }: MovieCardProps) {
  const currentRating = rating?.rating || 0;
  const isSeen = rating?.seen || false;
  const wantToSee = Boolean(rating?.wantToSee && !isSeen);

  const handleRating = (newRating: number) => {
    onRate(movie.id, newRating, true, rating?.notes);
  };

  const directorLabel = movie.director || 'Director loading…';

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5 hover:shadow-md transition-all group">
      <div className="flex gap-3 sm:gap-4">
        {movie.poster ? (
          <div className="shrink-0 w-14 h-20 sm:w-16 sm:h-24 relative rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800">
            <Image
              src={movie.poster}
              alt=""
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        ) : null}

        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-3 mb-2 sm:mb-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-base sm:text-lg leading-tight">{movie.title}</h3>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 truncate">{movie.year} • {directorLabel}</p>
            </div>
            <div className="flex items-center gap-0.5 sm:gap-1 text-amber-500 shrink-0 self-start">
              {Array.from({ length: 5 }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Rate ${(i + 1) * 2} out of 10`}
                  className="p-1 -m-0.5 sm:p-0 sm:m-0"
                  onClick={() => handleRating((i + 1) * 2)}
                >
                  <Star
                    className={`w-5 h-5 sm:w-4 sm:h-4 transition-colors ${
                      i < Math.floor(currentRating / 2) ? 'fill-current' : 'text-zinc-300 dark:text-zinc-700'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-1 mb-3 sm:mb-4">
            {movie.genres.map(genre => (
              <span key={genre} className="inline-block px-2 py-0.5 text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full">
                {genre}
              </span>
            ))}
          </div>

          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 sm:line-clamp-3 mb-3 sm:mb-4">
            {movie.description}
          </p>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
            {wantToSee ? (
              <span className="flex items-center gap-1.5 px-3 py-2 sm:py-1 rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400">
                <Bookmark className="w-3.5 h-3.5" />
                Want to see
              </span>
            ) : null}
            <button
              onClick={() => onRate(movie.id, currentRating, !isSeen, rating?.notes, false)}
              className={`flex items-center gap-1.5 px-3 py-2 sm:py-1 rounded-lg transition-colors ${
                isSeen 
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' 
                  : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {isSeen ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              {isSeen ? 'Seen' : 'Mark Seen'}
            </button>

            {rating && currentRating > 0 && (
              <div className="text-zinc-400">
                Rated <span className="font-mono text-emerald-600">{currentRating}</span>/10
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
