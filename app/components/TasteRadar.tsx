'use client';

import { TasteProfile } from '../types';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';

interface TasteRadarProps {
  profile: TasteProfile;
  title: string;
}

export default function TasteRadar({ profile, title }: TasteRadarProps) {
  const topGenres = Object.entries(profile.genrePrefs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value]) => ({
      subject: name.length > 12 ? name.substring(0, 12) + '...' : name,
      A: Math.round(value * 100),
      fullMark: 100,
    }));

  if (topGenres.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-zinc-400 text-sm">
        Rate some movies to see your taste profile
      </div>
    );
  }

  return (
    <div className="h-52 sm:h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={topGenres}>
          <PolarGrid stroke="#e5e5e5" />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={{ fontSize: 10, fill: '#666' }}
          />
          <PolarRadiusAxis 
            angle={90} 
            domain={[0, 100]} 
            tickCount={5}
            tick={{ fontSize: 10 }}
          />
          <Radar
            name={title}
            dataKey="A"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.25}
            strokeWidth={2}
          />
          <Tooltip />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
