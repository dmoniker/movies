'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Movie } from '../types';
import { DISMISS_TAGS } from '../rec-feedback';

interface DismissRecModalProps {
  movie: Movie;
  onClose: () => void;
  onConfirm: (tags: string[], note: string) => void;
  onSkip: () => void;
}

export default function DismissRecModal({ movie, onClose, onConfirm, onSkip }: DismissRecModalProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [note, setNote] = useState('');

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const hasFeedback = selectedTags.length > 0 || note.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-semibold">Not for me</h3>
            <p className="text-sm text-zinc-500 mt-1">
              Why skip <span className="font-medium text-zinc-700 dark:text-zinc-300">{movie.title}</span>?
              Optional — helps filter similar picks later.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {DISMISS_TAGS.map((tag) => {
            const active = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  active
                    ? 'bg-violet-600 text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>

        <label className="block text-xs uppercase tracking-widest text-zinc-400 mb-2">
          Your own rule (optional)
        </label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder='e.g. formulaic, message over story, DEI over plot'
          className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm outline-none focus:border-violet-500"
        />

        <div className="flex flex-wrap gap-2 mt-5">
          <button
            type="button"
            disabled={!hasFeedback}
            onClick={() => onConfirm(selectedTags, note.trim())}
            className="flex-1 min-w-[8rem] px-4 py-2.5 text-sm font-medium bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:pointer-events-none text-white rounded-xl transition-colors"
          >
            Save & hide
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="px-4 py-2.5 text-sm font-medium border border-zinc-300 dark:border-zinc-700 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
