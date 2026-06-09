'use client';

import { useState } from 'react';
import { Movie } from '../types';
import { fetchMovieTrailer } from '../tmdb';
import { Star, Calendar, Users, DollarSign, Clock, Sparkles, Play } from 'lucide-react';
import Image from 'next/image';
import TrailerModal from './TrailerModal';

interface BrowseMovieCardProps {
  movie: Movie;
  layout: 'grid' | 'list';
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

export default function BrowseMovieCard({ movie, layout }: BrowseMovieCardProps) {
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [trailerLoading, setTrailerLoading] = useState(false);
  const [trailerUnavailable, setTrailerUnavailable] = useState(false);

  const directorLabel = movie.director || 'Unknown director';
  const budgetLabel = formatBudget(movie.budget);

  const openTrailer = async () => {
    if (trailerLoading) return;
    setTrailerLoading(true);
    setTrailerUnavailable(false);
    try {
      const { youtubeKey } = await fetchMovieTrailer(movie.id);
      if (youtubeKey) {
        setTrailerKey(youtubeKey);
      } else {
        setTrailerUnavailable(true);
      }
    } catch {
      setTrailerUnavailable(true);
    } finally {
      setTrailerLoading(false);
    }
  };

  const trailerButton = (
    <button
      type="button"
      onClick={openTrailer}
      disabled={trailerLoading}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white transition-colors"
    >
      <Play className="w-3.5 h-3.5 fill-current" />
      {trailerLoading ? 'Loading…' : 'Trailer'}
    </button>
  );

  const metadata = (
    <div className="flex flex-wrap gap-1.5 mb-2">
      {movie.voteAverage !== undefined ? (
        <MetadataChip icon={Star} label="Rating" value={`${movie.voteAverage.toFixed(1)} ★`} />
      ) : null}
      {movie.voteCount !== undefined && movie.voteCount > 0 ? (
        <MetadataChip icon={Users} label="Votes" value={`${movie.voteCount.toLocaleString()} votes`} />
      ) : null}
      {movie.popularity !== undefined ? (
        <MetadataChip
          icon={Sparkles}
          label="Popularity"
          value={movie.popularity < 3 ? 'Obscure' : movie.popularity.toFixed(1)}
        />
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

  const posterOverlay = (
    <button
      type="button"
      onClick={openTrailer}
      disabled={trailerLoading}
      aria-label={`Play ${movie.title} trailer`}
      className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/40 transition-colors group disabled:cursor-wait"
    >
      <span className="flex items-center justify-center w-12 h-12 rounded-full bg-white/90 text-violet-700 opacity-0 group-hover:opacity-100 group-disabled:opacity-70 transition-opacity shadow-lg">
        <Play className="w-5 h-5 fill-current ml-0.5" />
      </span>
    </button>
  );

  if (layout === 'grid') {
    return (
      <>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden hover:shadow-md transition-all flex flex-col">
          {movie.poster ? (
            <div className="relative w-full aspect-[2/3] bg-zinc-100 dark:bg-zinc-800">
              <Image src={movie.poster} alt="" fill className="object-cover" unoptimized />
              {posterOverlay}
              {movie.voteAverage !== undefined ? (
                <span className="absolute top-2 right-2 px-2 py-0.5 text-xs font-semibold bg-black/70 text-white rounded-full pointer-events-none">
                  {movie.voteAverage.toFixed(1)}
                </span>
              ) : null}
            </div>
          ) : (
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">{trailerButton}</div>
          )}
          <div className="p-4 flex flex-col flex-1">
            <h3 className="font-semibold text-sm leading-tight line-clamp-2 mb-1">{movie.title}</h3>
            <p className="text-xs text-zinc-500 mb-2 truncate">
              {movie.year} • {directorLabel}
            </p>
            {metadata}
            {genres}
            <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-3 flex-1 mb-3">
              {movie.description}
            </p>
            {movie.poster ? (
              <div className="flex items-center gap-2">
                {trailerButton}
                {trailerUnavailable ? (
                  <span className="text-xs text-zinc-400">No trailer on TMDB</span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        {trailerKey ? (
          <TrailerModal title={movie.title} youtubeKey={trailerKey} onClose={() => setTrailerKey(null)} />
        ) : null}
      </>
    );
  }

  return (
    <>
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5 hover:shadow-md transition-all">
        <div className="flex gap-3 sm:gap-4">
          {movie.poster ? (
            <div className="shrink-0 w-14 h-20 sm:w-16 sm:h-24 relative rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800">
              <Image src={movie.poster} alt="" fill className="object-cover" unoptimized />
              {posterOverlay}
            </div>
          ) : null}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base sm:text-lg leading-tight mb-1">{movie.title}</h3>
            <p className="text-xs sm:text-sm text-zinc-500 truncate mb-2">
              {movie.year} • {directorLabel}
            </p>
            {metadata}
            {genres}
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 mb-3">
              {movie.description}
            </p>
            <div className="flex items-center gap-2">
              {trailerButton}
              {trailerUnavailable ? (
                <span className="text-xs text-zinc-400">No trailer on TMDB</span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      {trailerKey ? (
        <TrailerModal title={movie.title} youtubeKey={trailerKey} onClose={() => setTrailerKey(null)} />
      ) : null}
    </>
  );
}
