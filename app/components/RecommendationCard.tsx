'use client';

import { Bookmark, Star, ThumbsDown } from 'lucide-react';
import Image from 'next/image';
import { Movie, Rating, Recommendation } from '../types';

interface RecommendationCardProps {
  rec: Recommendation;
  rating?: Rating;
  isExiting?: boolean;
  onRate: (movieId: string, rating: number, seen: boolean, notes?: string, wantToSee?: boolean) => void;
  onWantToSee: (movie: Movie) => void;
  onNotForMe: (movie: Movie) => void;
}

export default function RecommendationCard({
  rec,
  rating,
  isExiting = false,
  onRate,
  onWantToSee,
  onNotForMe,
}: RecommendationCardProps) {
  const { movie } = rec;
  const isSeen = rating?.seen ?? false;
  const wantToSee = Boolean(rating?.wantToSee && !isSeen);
  const currentRating = rating?.rating ?? 0;
  const directorLabel = movie.director || 'Director loading…';

  const handleRating = (newRating: number) => {
    onRate(movie.id, newRating, true, rating?.notes);
  };

  return (
    <div
      className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5 hover:shadow-md transition-all duration-300 ${
        isExiting ? 'opacity-0 scale-95 max-h-0 overflow-hidden py-0 my-0 pointer-events-none' : ''
      }`}
    >
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
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 truncate">
                {movie.year} • {directorLabel}
              </p>
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
                      i < Math.floor(currentRating / 2)
                        ? 'fill-current'
                        : 'text-zinc-300 dark:text-zinc-700'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-1 mb-2 sm:mb-3">
            {movie.genres.map((genre) => (
              <span
                key={genre}
                className="inline-block px-2 py-0.5 text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full"
              >
                {genre}
              </span>
            ))}
            <span className="inline-block px-2 py-0.5 text-[10px] font-medium bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 rounded-full font-mono">
              {rec.score} match
            </span>
          </div>

          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 sm:line-clamp-3 mb-2">
            {movie.description}
          </p>

          <p className="text-xs text-violet-600 dark:text-violet-400 font-medium mb-3 sm:mb-4 line-clamp-2">
            {rec.reason}
          </p>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
            {isSeen ? (
              <span className="flex items-center gap-1.5 px-3 py-2 sm:py-1 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                Seen
                {currentRating > 0 ? (
                  <span className="font-mono">• {currentRating}/10</span>
                ) : null}
              </span>
            ) : wantToSee ? (
              <span className="flex items-center gap-1.5 px-3 py-2 sm:py-1 rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400">
                <Bookmark className="w-3.5 h-3.5" />
                Want to see
              </span>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onWantToSee(movie)}
                  className="flex items-center gap-1.5 px-3 py-2 sm:py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white transition-colors"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  Want to see
                </button>
                <button
                  type="button"
                  onClick={() => onNotForMe(movie)}
                  className="flex items-center gap-1.5 px-3 py-2 sm:py-1 rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                  Not for me
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
