'use client';

import { Movie, Rating } from '../types';
import { Star, Eye, EyeOff, Bookmark, Calendar, Users, DollarSign, Clock } from 'lucide-react';
import Image from 'next/image';

interface BrowseMovieCardProps {
  movie: Movie;
  rating?: Rating;
  layout: 'grid' | 'list';
  onRate: (movieId: string, rating: number, seen: boolean, notes?: string, wantToSee?: boolean) => void;
  onWantToSee?: (movie: Movie) => void;
}

function formatBudget(value?: number): string | null {
  if (!value || value <= 0) return null;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
  return `$${(value / 1_000).toFixed(0)}K`;
}

function MetadataChip({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <span
      title={`${label}: ${value}`}
      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full"
    >
      <Icon className="w-3 h-3 shrink-0 opacity-70" />
      {value}
    </span>
  );
}

export default function BrowseMovieCard({
  movie,
  rating,
  layout,
  onRate,
  onWantToSee,
}: BrowseMovieCardProps) {
  const currentRating = rating?.rating || 0;
  const isSeen = rating?.seen || false;
  const wantToSee = Boolean(rating?.wantToSee && !isSeen);
  const directorLabel = movie.director || 'Director loading…';
  const budgetLabel = formatBudget(movie.budget);

  const handleRating = (newRating: number) => {
    onRate(movie.id, newRating, true, rating?.notes);
  };

  const metadata = (
    <div className="flex flex-wrap gap-1.5 mb-2">
      {movie.voteAverage !== undefined ? (
        <MetadataChip icon={Star} label="Rating" value={`${movie.voteAverage.toFixed(1)} ★`} />
      ) : null}
      {movie.voteCount !== undefined && movie.voteCount > 0 ? (
        <MetadataChip icon={Users} label="Votes" value={`${movie.voteCount.toLocaleString()} votes`} />
      ) : null}
      {movie.releaseDate ? (
        <MetadataChip icon={Calendar} label="Released" value={movie.releaseDate} />
      ) : null}
      {movie.runtime ? (
        <MetadataChip icon={Clock} label="Runtime" value={`${movie.runtime}m`} />
      ) : null}
      {budgetLabel ? (
        <MetadataChip icon={DollarSign} label="Budget" value={budgetLabel} />
      ) : null}
    </div>
  );

  const genres = (
    <div className="flex flex-wrap gap-1 mb-2">
      {movie.genres.map((genre) => (
        <span
          key={genre}
          className="inline-block px-2 py-0.5 text-[10px] font-medium bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 rounded-full"
        >
          {genre}
        </span>
      ))}
      {movie.inCollection ? (
        <span className="inline-block px-2 py-0.5 text-[10px] font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded-full">
          Franchise
        </span>
      ) : null}
    </div>
  );

  const actions = (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {isSeen ? (
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
          <Eye className="w-3.5 h-3.5" />
          Seen
          {currentRating > 0 ? <span className="font-mono">• {currentRating}/10</span> : null}
        </span>
      ) : wantToSee ? (
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400">
          <Bookmark className="w-3.5 h-3.5" />
          Want to see
        </span>
      ) : onWantToSee ? (
        <button
          type="button"
          onClick={() => onWantToSee(movie)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white transition-colors"
        >
          <Bookmark className="w-3.5 h-3.5" />
          Want to see
        </button>
      ) : null}
      {!isSeen ? (
        <button
          type="button"
          onClick={() => onRate(movie.id, currentRating, true, rating?.notes, false)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        >
          <EyeOff className="w-3.5 h-3.5" />
          Mark Seen
        </button>
      ) : null}
    </div>
  );

  const stars = (
    <div className="flex items-center gap-0.5 text-amber-500">
      {Array.from({ length: 5 }).map((_, i) => (
        <button
          key={i}
          type="button"
          aria-label={`Rate ${(i + 1) * 2} out of 10`}
          className="p-0.5"
          onClick={() => handleRating((i + 1) * 2)}
        >
          <Star
            className={`w-4 h-4 transition-colors ${
              i < Math.floor(currentRating / 2) ? 'fill-current' : 'text-zinc-300 dark:text-zinc-700'
            }`}
          />
        </button>
      ))}
    </div>
  );

  if (layout === 'grid') {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden hover:shadow-md transition-all group flex flex-col">
        {movie.poster ? (
          <div className="relative w-full aspect-[2/3] bg-zinc-100 dark:bg-zinc-800">
            <Image src={movie.poster} alt="" fill className="object-cover" unoptimized />
            {movie.voteAverage !== undefined ? (
              <span className="absolute top-2 right-2 px-2 py-0.5 text-xs font-semibold bg-black/70 text-white rounded-full">
                {movie.voteAverage.toFixed(1)}
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="p-4 flex flex-col flex-1">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-semibold text-sm leading-tight line-clamp-2">{movie.title}</h3>
            {stars}
          </div>
          <p className="text-xs text-zinc-500 mb-2 truncate">
            {movie.year} • {directorLabel}
          </p>
          {metadata}
          {genres}
          <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-3 mb-3 flex-1">
            {movie.description}
          </p>
          {actions}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5 hover:shadow-md transition-all">
      <div className="flex gap-3 sm:gap-4">
        {movie.poster ? (
          <div className="shrink-0 w-14 h-20 sm:w-16 sm:h-24 relative rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800">
            <Image src={movie.poster} alt="" fill className="object-cover" unoptimized />
          </div>
        ) : null}
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-base sm:text-lg leading-tight">{movie.title}</h3>
              <p className="text-xs sm:text-sm text-zinc-500 truncate">
                {movie.year} • {directorLabel}
              </p>
            </div>
            {stars}
          </div>
          {metadata}
          {genres}
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 mb-3">
            {movie.description}
          </p>
          {actions}
        </div>
      </div>
    </div>
  );
}
