import { Movie, Rating, TasteProfile, Recommendation, UserId } from './types';

export function calculateTasteProfile(ratings: Rating[], movies: Movie[], userId: UserId): TasteProfile {
  const userRatings = ratings.filter(r => r.userId === userId && r.seen);
  if (userRatings.length === 0) {
    return {
      userId,
      genrePrefs: {},
      actorPrefs: {},
      directorPrefs: {},
      decadePrefs: {},
      avgRating: 0,
      totalRated: 0,
    };
  }

  const genreCount: Record<string, number> = {};
  const actorCount: Record<string, number> = {};
  const directorCount: Record<string, number> = {};
  const decadeCount: Record<string, number> = {};
  let totalRating = 0;

  userRatings.forEach(rating => {
    const movie = movies.find(m => m.id === rating.movieId);
    if (!movie) return;

    totalRating += rating.rating;

    // Genre prefs
    movie.genres.forEach(genre => {
      genreCount[genre] = (genreCount[genre] || 0) + rating.rating;
    });

    // Actor prefs (simple count)
    movie.actors.forEach(actor => {
      actorCount[actor] = (actorCount[actor] || 0) + 1;
    });

    // Director
    directorCount[movie.director] = (directorCount[movie.director] || 0) + rating.rating;

    // Decade
    const decade = Math.floor(movie.year / 10) * 10;
    decadeCount[decade.toString()] = (decadeCount[decade.toString()] || 0) + rating.rating;
  });

  const totalRated = userRatings.length;
  const avgRating = totalRating / totalRated;

  // Normalize to 0-1
  const normalize = (counts: Record<string, number>) => {
    const max = Math.max(...Object.values(counts));
    if (max === 0) return {};
    return Object.fromEntries(
      Object.entries(counts).map(([k, v]) => [k, v / max])
    );
  };

  return {
    userId,
    genrePrefs: normalize(genreCount),
    actorPrefs: normalize(actorCount),
    directorPrefs: normalize(directorCount),
    decadePrefs: normalize(decadeCount),
    avgRating: Math.round(avgRating * 10) / 10,
    totalRated,
  };
}

export function getRecommendations(
  ratings: Rating[],
  movies: Movie[],
  userId: UserId,
  otherUserId?: UserId,
  limit = 12
): Recommendation[] {
  const userRatings = ratings.filter(r => r.userId === userId);
  const ratedIds = new Set(userRatings.map(r => r.movieId));
  const profile = calculateTasteProfile(ratings, movies, userId);
  
  let otherProfile: TasteProfile | null = null;
  if (otherUserId) {
    otherProfile = calculateTasteProfile(ratings, movies, otherUserId);
  }

  const candidates = movies.filter(m => !ratedIds.has(m.id));

  const scored = candidates.map(movie => {
    let score = 0;
    let reasons: string[] = [];

    // Genre match
    let genreScore = 0;
    movie.genres.forEach(g => {
      if (profile.genrePrefs[g]) {
        genreScore += profile.genrePrefs[g];
      }
    });
    score += genreScore * 3;
    if (genreScore > 0.5) reasons.push('Strong genre match');

    // Director match
    if (profile.directorPrefs[movie.director]) {
      score += profile.directorPrefs[movie.director] * 2;
      reasons.push('Director affinity');
    }

    // Actor overlap
    let actorScore = 0;
    movie.actors.forEach(a => {
      if (profile.actorPrefs[a]) actorScore += 0.5;
    });
    score += actorScore;
    if (actorScore > 1) reasons.push('Familiar cast');

    // Decade preference
    const decade = Math.floor(movie.year / 10) * 10;
    if (profile.decadePrefs[decade.toString()]) {
      score += profile.decadePrefs[decade.toString()] * 1.5;
      reasons.push(`${decade}s favorite era`);
    }

    // Recency bias for newer movies
    if (movie.year >= 2020) score += 1.2;
    else if (movie.year >= 2010) score += 0.6;

    // Shared scoring if both users
    let forBoth = false;
    if (otherProfile) {
      let sharedScore = 0;
      movie.genres.forEach(g => {
        if (profile.genrePrefs[g] && otherProfile!.genrePrefs[g]) {
          sharedScore += Math.min(profile.genrePrefs[g], otherProfile!.genrePrefs[g]);
        }
      });
      if (sharedScore > 1.2) {
        score += sharedScore * 2;
        reasons.push('High shared appeal');
        forBoth = true;
      }
    }

    const finalScore = Math.min(Math.max(Math.round(score * 10) / 10, 0), 10);

    return {
      movie,
      score: finalScore,
      reason: reasons.length > 0 ? reasons[0] : 'Good match',
      forBoth,
    };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
