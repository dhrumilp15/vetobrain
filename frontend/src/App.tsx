import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:5001';

// Map image paths - current competitive rotation
const MAP_IMAGES: { [key: string]: string } = {
  'Abyss': '/maps/abyss.png',
  'Bind': '/maps/bind.png',
  'Breeze': '/maps/breeze.png',
  'Corrode': '/maps/corrode.png',
  'Haven': '/maps/haven.png',
  'Pearl': '/maps/pearl.png',
  'Split': '/maps/split.png',
};

// Helper to get map image with fallback
const getMapImage = (mapName: string): string | null => {
  const normalized = mapName.charAt(0).toUpperCase() + mapName.slice(1).toLowerCase();
  return MAP_IMAGES[normalized] || MAP_IMAGES[mapName] || null;
};

// Map image component with fallback
const MapThumbnail = ({ mapName, size = 'sm' }: { mapName: string; size?: 'sm' | 'md' | 'lg' }) => {
  const [imgError, setImgError] = useState(false);
  const imagePath = getMapImage(mapName);

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };

  if (!imagePath || imgError) {
    return (
      <div className={`${sizeClasses[size]} rounded bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center text-xs font-bold text-gray-400`}>
        {mapName.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={imagePath}
      alt={mapName}
      className={`${sizeClasses[size]} rounded object-cover`}
      onError={() => setImgError(true)}
    />
  );
};

interface Team {
  id: string;
  name: string;
  abbreviation?: string;
  logo_url?: string;
  region?: string;
}

interface PlayerStats {
  name: string;
  top_agents: string[];
  impact: string;
  avg_acs: number;
  avg_kd: number;
  first_blood_rate: number;
  games_played: number;
}

interface MapStats {
  map_name: string;
  games_played: number;
  wins: number;
  losses: number;
  win_rate: number;
}

interface VetoRecommendation {
  map_name: string;
  score: number;
  recommendation: string; // MUST_PICK, PICK, NEUTRAL, BAN, MUST_BAN
  our_win_rate: number;
  their_win_rate: number;
  reason: string;
}

interface TacticalInsight {
  category: string;
  title: string;
  description: string;
  severity: string; // WARNING, INFO, TIP
  icon: string;
}

interface MapPoolEntry {
  map_name: string;
  games_played: number;
  win_rate: number;
  attack_win_rate: number;
  defense_win_rate: number;
  avg_round_diff: number;
}

interface PlayerBehaviorProfile {
  name: string;
  primary_role: string;
  secondary_role: string;
  aggression_score: number;
  consistency_score: number;
  impact_rating: number;
  playstyle_tags: string[];
  agent_pool: string[];
  preferred_site: string;
  round_presence: string;
}

interface TeamComposition {
  primary_comp: string[];
  comp_frequency: number;
  role_distribution: { [key: string]: number };
  flex_players: string[];
  one_tricks: string[];
  aggression_style: string;
  execute_style: string;
}

interface EconomyTendency {
  force_buy_frequency: string;
  eco_discipline: string;
  save_round_effectiveness: string;
  post_plant_focus: string;
}

interface ScoutReport {
  team_id: string;
  team_name: string;
  summary: {
    primary_threat: string;
    key_takeaway: string;
    team_playstyle: string;
    recent_form: string;
  };
  recommended_bans: string[];
  player_stats: PlayerStats[];
  map_stats: MapStats[];
  matches_analyzed: number;
  date_range: string;
  veto_recommendations: VetoRecommendation[];
  tactical_insights: TacticalInsight[];
  map_pool_matrix: MapPoolEntry[];
  player_behavior_profiles: PlayerBehaviorProfile[];
  team_composition: TeamComposition | null;
  economy_tendency: EconomyTendency | null;
}

interface MapAdvantage {
  map: string;
  your_win_rate: number;
  opponent_win_rate: number;
  advantage: 'yours' | 'opponent' | 'neutral';
}

interface ComparisonReport {
  your_team: ScoutReport;
  opponent: ScoutReport;
  map_advantages: MapAdvantage[];
  recommendation: string;
}

type ScoutMode = 'single' | 'h2h';

// Veto Recommendation Engine Component - THE HERO FEATURE
const VetoEngine = ({ recommendations, coachMode }: { recommendations: VetoRecommendation[], coachMode: boolean }) => {
  const getRecommendationStyle = (rec: string) => {
    switch (rec) {
      case 'MUST_PICK': return { bg: 'bg-green-600', text: 'text-white', label: 'PICK' };
      case 'PICK': return { bg: 'bg-green-500/50', text: 'text-green-300', label: 'PICK' };
      case 'NEUTRAL': return { bg: 'bg-yellow-500/50', text: 'text-yellow-300', label: 'DECIDER' };
      case 'BAN': return { bg: 'bg-red-500/50', text: 'text-red-300', label: 'BAN' };
      case 'MUST_BAN': return { bg: 'bg-red-600', text: 'text-white', label: 'BAN' };
      default: return { bg: 'bg-gray-500', text: 'text-white', label: rec };
    }
  };

  return (
    <section className={`p-6 rounded-lg ${coachMode ? 'border-2 border-black bg-gray-50' : 'bg-gray-800'}`}>
      <h3 className="text-2xl font-bold mb-2 text-c9-blue">Map Veto Guide</h3>
      <p className={`text-sm mb-4 ${coachMode ? 'text-gray-600' : 'text-gray-400'}`}>
        Based on win rate differentials. Green = Pick, Red = Ban, Yellow = Decider
      </p>
      <div className="space-y-2">
        {recommendations.map((rec) => {
          const style = getRecommendationStyle(rec.recommendation);
          return (
            <div
              key={rec.map_name}
              className={`flex items-center justify-between p-3 rounded-lg ${style.bg} transition-all`}
            >
              <div className="flex items-center gap-3">
                <MapThumbnail mapName={rec.map_name} size="sm" />
                <span className={`font-bold text-lg ${style.text}`}>{rec.map_name}</span>
                <span className={`text-xs px-2 py-1 rounded ${coachMode ? 'bg-black/10' : 'bg-black/30'} ${style.text}`}>
                  {style.label}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className={coachMode ? 'text-gray-700' : 'text-gray-300'}>
                  Us: {rec.our_win_rate}%
                </span>
                <span className={coachMode ? 'text-gray-700' : 'text-gray-300'}>
                  Them: {rec.their_win_rate}%
                </span>
                <span className={`hidden md:block ${style.text} opacity-80 text-xs max-w-[150px]`}>
                  {rec.reason}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

// Tactical Insights Component - "How to Beat Them"
const TacticalInsights = ({ insights, coachMode }: { insights: TacticalInsight[], coachMode: boolean }) => {
  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'WARNING': return { border: 'border-l-red-500', bg: coachMode ? 'bg-red-50' : 'bg-red-900/20', icon: '!' };
      case 'TIP': return { border: 'border-l-green-500', bg: coachMode ? 'bg-green-50' : 'bg-green-900/20', icon: '+' };
      default: return { border: 'border-l-blue-500', bg: coachMode ? 'bg-blue-50' : 'bg-blue-900/20', icon: 'i' };
    }
  };

  return (
    <section className={`p-6 rounded-lg ${coachMode ? 'border-2 border-black' : 'bg-gray-800'}`}>
      <h3 className="text-2xl font-bold mb-2 text-c9-blue">How to Beat Them</h3>
      <p className={`text-sm mb-4 ${coachMode ? 'text-gray-600' : 'text-gray-400'}`}>
        Tactical insights based on their recent performance
      </p>
      <div className="space-y-3">
        {insights.map((insight, idx) => {
          const style = getSeverityStyle(insight.severity);
          return (
            <div
              key={idx}
              className={`p-4 rounded-lg border-l-4 ${style.border} ${style.bg}`}
            >
              <div className="flex items-start gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                  insight.severity === 'WARNING' ? 'bg-red-500 text-white' :
                  insight.severity === 'TIP' ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'
                }`}>
                  {insight.icon || style.icon}
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold">{insight.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${coachMode ? 'bg-gray-200' : 'bg-gray-700'}`}>
                      {insight.category}
                    </span>
                  </div>
                  <p className={`text-sm ${coachMode ? 'text-gray-700' : 'text-gray-300'}`}>
                    {insight.description}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

// Map Pool Matrix Component - The Evidence
const MapPoolMatrix = ({ matrix, coachMode }: { matrix: MapPoolEntry[], coachMode: boolean }) => {
  const getColorClass = (value: number) => {
    if (value >= 70) return coachMode ? 'bg-green-200 text-green-900' : 'bg-green-600 text-white';
    if (value >= 50) return coachMode ? 'bg-yellow-200 text-yellow-900' : 'bg-yellow-600 text-black';
    if (value > 0) return coachMode ? 'bg-red-200 text-red-900' : 'bg-red-600 text-white';
    return coachMode ? 'bg-gray-200 text-gray-500' : 'bg-gray-700 text-gray-500';
  };

  // Only show maps with data
  const mapsWithData = matrix.filter(m => m.games_played > 0);

  return (
    <section className={`p-6 rounded-lg ${coachMode ? 'border-2 border-black' : 'bg-gray-800'}`}>
      <h3 className="text-2xl font-bold mb-2 text-c9-blue">Map Pool Matrix</h3>
      <p className={`text-sm mb-4 ${coachMode ? 'text-gray-600' : 'text-gray-400'}`}>
        Performance breakdown by map. Green = Strong, Yellow = Average, Red = Weak
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={coachMode ? 'border-b-2 border-black' : 'border-b border-gray-600'}>
              <th className="text-left py-2 px-3">Map</th>
              <th className="text-center py-2 px-3">Games</th>
              <th className="text-center py-2 px-3">Win %</th>
              <th className="text-center py-2 px-3">Atk %</th>
              <th className="text-center py-2 px-3">Def %</th>
              <th className="text-center py-2 px-3">+/-</th>
            </tr>
          </thead>
          <tbody>
            {mapsWithData.map((map) => (
              <tr key={map.map_name} className={coachMode ? 'border-b border-gray-200' : 'border-b border-gray-700'}>
                <td className="py-2 px-3">
                  <div className="flex items-center gap-2">
                    <MapThumbnail mapName={map.map_name} size="sm" />
                    <span className="font-semibold">{map.map_name}</span>
                  </div>
                </td>
                <td className="text-center py-2 px-3">{map.games_played}</td>
                <td className="text-center py-2 px-3">
                  <span className={`px-2 py-1 rounded font-bold ${getColorClass(map.win_rate)}`}>
                    {map.win_rate}%
                  </span>
                </td>
                <td className="text-center py-2 px-3">
                  <span className={`px-2 py-1 rounded ${getColorClass(map.attack_win_rate)}`}>
                    {map.attack_win_rate}%
                  </span>
                </td>
                <td className="text-center py-2 px-3">
                  <span className={`px-2 py-1 rounded ${getColorClass(map.defense_win_rate)}`}>
                    {map.defense_win_rate}%
                  </span>
                </td>
                <td className={`text-center py-2 px-3 font-mono ${
                  map.avg_round_diff > 0 ? 'text-green-500' : map.avg_round_diff < 0 ? 'text-red-500' : ''
                }`}>
                  {map.avg_round_diff > 0 ? '+' : ''}{map.avg_round_diff}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

// Player Behavior Profiles Component - Shows aggression, roles, playstyle
const PlayerBehaviorSection = ({ profiles, coachMode }: { profiles: PlayerBehaviorProfile[], coachMode: boolean }) => {
  if (!profiles || profiles.length === 0) return null;

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Duelist': return 'bg-red-500 text-white';
      case 'Controller': return 'bg-purple-500 text-white';
      case 'Sentinel': return 'bg-green-500 text-white';
      case 'Initiator': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getAggressionColor = (score: number) => {
    if (score >= 70) return 'bg-red-500';
    if (score >= 50) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  const getAggressionLabel = (score: number) => {
    if (score >= 80) return 'Very Aggressive';
    if (score >= 60) return 'Aggressive';
    if (score >= 40) return 'Balanced';
    if (score >= 20) return 'Passive';
    return 'Very Passive';
  };

  return (
    <section className={`p-6 rounded-lg ${coachMode ? 'border-2 border-black' : 'bg-gray-800'}`}>
      <h3 className="text-2xl font-bold mb-2 text-c9-blue">Player Behavior Profiles</h3>
      <p className={`text-sm mb-4 ${coachMode ? 'text-gray-600' : 'text-gray-400'}`}>
        Individual playstyles, aggression levels, and tendencies
      </p>
      <div className="space-y-4">
        {profiles.map((profile) => (
          <div key={profile.name} className={`p-4 rounded-lg ${coachMode ? 'bg-gray-100' : 'bg-gray-700/50'}`}>
            {/* Header: Name, Role, Impact */}
            <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg">{profile.name}</span>
                {profile.primary_role && profile.primary_role !== 'Unknown' && (
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${getRoleColor(profile.primary_role)}`}>
                    {profile.primary_role}
                  </span>
                )}
                {profile.secondary_role && profile.secondary_role !== 'Unknown' && (
                  <span className={`px-2 py-0.5 rounded text-xs ${coachMode ? 'bg-gray-300' : 'bg-gray-600'}`}>
                    {profile.secondary_role}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${coachMode ? 'text-gray-600' : 'text-gray-400'}`}>
                  Impact: {profile.impact_rating.toFixed(0)}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded ${coachMode ? 'bg-gray-200' : 'bg-gray-600'}`}>
                  {profile.preferred_site} Site
                </span>
              </div>
            </div>

            {/* Aggression Bar */}
            <div className="mb-3">
              <div className="flex justify-between items-center mb-1">
                <span className={`text-xs ${coachMode ? 'text-gray-600' : 'text-gray-400'}`}>Aggression</span>
                <span className={`text-xs font-semibold ${
                  profile.aggression_score >= 60 ? 'text-red-400' :
                  profile.aggression_score >= 40 ? 'text-yellow-400' : 'text-blue-400'
                }`}>
                  {getAggressionLabel(profile.aggression_score)}
                </span>
              </div>
              <div className={`h-2 rounded-full ${coachMode ? 'bg-gray-300' : 'bg-gray-600'}`}>
                <div
                  className={`h-2 rounded-full ${getAggressionColor(profile.aggression_score)} transition-all`}
                  style={{ width: `${profile.aggression_score}%` }}
                />
              </div>
            </div>

            {/* Playstyle Tags */}
            <div className="flex flex-wrap gap-1 mb-2">
              {profile.playstyle_tags.map((tag) => (
                <span
                  key={tag}
                  className={`px-2 py-0.5 rounded text-xs ${
                    tag.includes('Entry') || tag.includes('Aggressive') ? 'bg-red-500/20 text-red-300' :
                    tag.includes('Lurk') || tag.includes('Flank') ? 'bg-purple-500/20 text-purple-300' :
                    tag.includes('Anchor') || tag.includes('Support') ? 'bg-green-500/20 text-green-300' :
                    tag.includes('Clutch') ? 'bg-yellow-500/20 text-yellow-300' :
                    coachMode ? 'bg-gray-200 text-gray-700' : 'bg-gray-600 text-gray-300'
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Agent Pool */}
            <div className="flex items-center gap-2">
              <span className={`text-xs ${coachMode ? 'text-gray-600' : 'text-gray-400'}`}>Agents:</span>
              <div className="flex gap-1">
                {profile.agent_pool.map((agent) => (
                  <span key={agent} className={`px-2 py-0.5 rounded text-xs font-medium ${coachMode ? 'bg-gray-200' : 'bg-gray-600'}`}>
                    {agent}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

// Team Composition Analysis Component
const TeamCompositionSection = ({ composition, coachMode }: { composition: TeamComposition | null, coachMode: boolean }) => {
  if (!composition) return null;

  const getStyleColor = (style: string) => {
    if (style === 'Aggressive' || style === 'Fast') return 'text-red-400';
    if (style === 'Passive' || style === 'Slow') return 'text-blue-400';
    return 'text-yellow-400';
  };

  return (
    <section className={`p-6 rounded-lg ${coachMode ? 'border-2 border-black' : 'bg-gray-800'}`}>
      <h3 className="text-2xl font-bold mb-2 text-c9-blue">Team Composition Analysis</h3>
      <p className={`text-sm mb-4 ${coachMode ? 'text-gray-600' : 'text-gray-400'}`}>
        How they build their team and execute rounds
      </p>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Primary Comp */}
        <div className={`p-4 rounded-lg ${coachMode ? 'bg-gray-100' : 'bg-gray-700/50'}`}>
          <h4 className="font-semibold mb-2">Primary Composition</h4>
          <div className="flex flex-wrap gap-1 mb-2">
            {composition.primary_comp.map((agent) => (
              <span key={agent} className={`px-2 py-1 rounded text-sm font-medium ${coachMode ? 'bg-gray-200' : 'bg-gray-600'}`}>
                {agent}
              </span>
            ))}
          </div>
          <p className={`text-xs ${coachMode ? 'text-gray-600' : 'text-gray-400'}`}>
            Used in ~{composition.comp_frequency}% of games
          </p>
        </div>

        {/* Playstyle */}
        <div className={`p-4 rounded-lg ${coachMode ? 'bg-gray-100' : 'bg-gray-700/50'}`}>
          <h4 className="font-semibold mb-2">Playstyle</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className={`text-sm ${coachMode ? 'text-gray-600' : 'text-gray-400'}`}>Aggression:</span>
              <span className={`text-sm font-bold ${getStyleColor(composition.aggression_style)}`}>
                {composition.aggression_style}
              </span>
            </div>
            <div className="flex justify-between">
              <span className={`text-sm ${coachMode ? 'text-gray-600' : 'text-gray-400'}`}>Execute Speed:</span>
              <span className={`text-sm font-bold ${getStyleColor(composition.execute_style)}`}>
                {composition.execute_style}
              </span>
            </div>
          </div>
        </div>

        {/* Role Distribution */}
        <div className={`p-4 rounded-lg ${coachMode ? 'bg-gray-100' : 'bg-gray-700/50'}`}>
          <h4 className="font-semibold mb-2">Role Distribution</h4>
          <div className="space-y-1">
            {Object.entries(composition.role_distribution).map(([role, count]) => (
              <div key={role} className="flex justify-between items-center">
                <span className={`text-sm ${coachMode ? 'text-gray-600' : 'text-gray-400'}`}>{role}</span>
                <div className="flex items-center gap-2">
                  <div className={`w-16 h-2 rounded-full ${coachMode ? 'bg-gray-300' : 'bg-gray-600'}`}>
                    <div
                      className={`h-2 rounded-full ${
                        role === 'Duelist' ? 'bg-red-500' :
                        role === 'Controller' ? 'bg-purple-500' :
                        role === 'Sentinel' ? 'bg-green-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${Math.min(count / 2 * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-mono">{count.toFixed(1)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Flex Players & One-Tricks */}
        <div className={`p-4 rounded-lg ${coachMode ? 'bg-gray-100' : 'bg-gray-700/50'}`}>
          <h4 className="font-semibold mb-2">Player Flexibility</h4>
          {composition.flex_players.length > 0 && (
            <div className="mb-2">
              <span className={`text-xs ${coachMode ? 'text-gray-600' : 'text-gray-400'}`}>Flex Players: </span>
              <span className="text-sm text-green-400">{composition.flex_players.join(', ')}</span>
            </div>
          )}
          {composition.one_tricks.length > 0 && (
            <div>
              <span className={`text-xs ${coachMode ? 'text-gray-600' : 'text-gray-400'}`}>Specialists: </span>
              <span className="text-sm text-yellow-400">{composition.one_tricks.join(', ')}</span>
            </div>
          )}
          {composition.flex_players.length === 0 && composition.one_tricks.length === 0 && (
            <span className={`text-sm ${coachMode ? 'text-gray-600' : 'text-gray-400'}`}>Balanced flexibility</span>
          )}
        </div>
      </div>
    </section>
  );
};

// Economy Tendency Component
const EconomyTendencySection = ({ economy, coachMode }: { economy: EconomyTendency | null, coachMode: boolean }) => {
  if (!economy) return null;

  const getTendencyColor = (value: string) => {
    const positives = ['Strong', 'Disciplined', 'Rarely', 'High'];
    const negatives = ['Weak', 'Chaotic', 'Often', 'Low'];
    if (positives.includes(value)) return 'text-green-400';
    if (negatives.includes(value)) return 'text-red-400';
    return 'text-yellow-400';
  };

  return (
    <section className={`p-6 rounded-lg ${coachMode ? 'border-2 border-black' : 'bg-gray-800'}`}>
      <h3 className="text-2xl font-bold mb-2 text-c9-blue">Economy Tendencies</h3>
      <p className={`text-sm mb-4 ${coachMode ? 'text-gray-600' : 'text-gray-400'}`}>
        Buy patterns and economic discipline (inferred from match data)
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={`p-3 rounded-lg text-center ${coachMode ? 'bg-gray-100' : 'bg-gray-700/50'}`}>
          <p className={`text-xs mb-1 ${coachMode ? 'text-gray-600' : 'text-gray-400'}`}>Force Buys</p>
          <p className={`font-bold ${getTendencyColor(economy.force_buy_frequency)}`}>
            {economy.force_buy_frequency}
          </p>
        </div>
        <div className={`p-3 rounded-lg text-center ${coachMode ? 'bg-gray-100' : 'bg-gray-700/50'}`}>
          <p className={`text-xs mb-1 ${coachMode ? 'text-gray-600' : 'text-gray-400'}`}>Eco Discipline</p>
          <p className={`font-bold ${getTendencyColor(economy.eco_discipline)}`}>
            {economy.eco_discipline}
          </p>
        </div>
        <div className={`p-3 rounded-lg text-center ${coachMode ? 'bg-gray-100' : 'bg-gray-700/50'}`}>
          <p className={`text-xs mb-1 ${coachMode ? 'text-gray-600' : 'text-gray-400'}`}>Save Rounds</p>
          <p className={`font-bold ${getTendencyColor(economy.save_round_effectiveness)}`}>
            {economy.save_round_effectiveness}
          </p>
        </div>
        <div className={`p-3 rounded-lg text-center ${coachMode ? 'bg-gray-100' : 'bg-gray-700/50'}`}>
          <p className={`text-xs mb-1 ${coachMode ? 'text-gray-600' : 'text-gray-400'}`}>Post-Plant Focus</p>
          <p className={`font-bold ${getTendencyColor(economy.post_plant_focus)}`}>
            {economy.post_plant_focus}
          </p>
        </div>
      </div>
    </section>
  );
};

// Player Stats Component
const PlayerStatsSection = ({ players, coachMode }: { players: PlayerStats[], coachMode: boolean }) => {
  if (!players || players.length === 0) return null;

  return (
    <section className={`p-6 rounded-lg ${coachMode ? 'border-2 border-black' : 'bg-gray-800'}`}>
      <h3 className="text-xl font-bold mb-4">Player Breakdown</h3>
      <div className="space-y-3">
        {players.map(player => (
          <div key={player.name} className={`p-3 rounded ${coachMode ? 'bg-gray-100' : 'bg-gray-700/50'}`}>
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg">{player.name}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                  player.impact === 'High' ? 'bg-red-500 text-white' :
                  player.impact === 'Medium' ? 'bg-yellow-500 text-black' :
                  'bg-gray-500 text-white'
                }`}>
                  {player.impact}
                </span>
              </div>
              <span className={`text-sm ${coachMode ? 'text-gray-600' : 'text-gray-400'}`}>
                {player.games_played} maps
              </span>
            </div>
            <div className="flex flex-wrap gap-1 mb-2">
              {player.top_agents.map(agent => (
                <span key={agent} className={`px-2 py-0.5 rounded text-xs ${coachMode ? 'bg-gray-200' : 'bg-gray-600'}`}>
                  {agent}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="opacity-60">ACS:</span> <strong>{player.avg_acs}</strong></div>
              <div><span className="opacity-60">K/D:</span> <strong>{player.avg_kd}</strong></div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

// Team Search Input with Dropdown
const TeamSearchInput = ({
  label,
  placeholder,
  searchTerm,
  setSearchTerm,
  selectedTeam,
  setSelectedTeam,
  searchResults,
  searchLoading,
  coachMode
}: {
  label: string;
  placeholder: string;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedTeam: Team | null;
  setSelectedTeam: (team: Team | null) => void;
  searchResults: Team[];
  searchLoading: boolean;
  coachMode: boolean;
}) => {
  const [showDropdown, setShowDropdown] = useState(false);

  const handleSelect = (team: Team) => {
    setSelectedTeam(team);
    setSearchTerm(team.name);
    setShowDropdown(false);
  };

  return (
    <div className="w-full">
      <label className={`block text-sm font-semibold mb-2 ${coachMode ? 'text-gray-700' : 'text-gray-300'}`}>
        {label}
      </label>
      <div className="relative">
        <input
          type="text"
          placeholder={placeholder}
          className={`px-4 py-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-c9-blue ${
            coachMode ? 'bg-gray-100 text-black' : 'bg-gray-800 text-white'
          } ${selectedTeam ? 'border-2 border-green-500' : ''}`}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setSelectedTeam(null);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
        />
        {selectedTeam && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">✓</span>
        )}
        {showDropdown && (searchLoading || searchResults.length > 0) && (
          <div className={`absolute w-full mt-1 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto ${
            coachMode ? 'bg-white border border-gray-300' : 'bg-gray-800'
          }`}>
            {searchLoading ? (
              <div className="p-4 animate-pulse">Searching...</div>
            ) : (
              searchResults.map(team => (
                <button
                  key={team.id}
                  onClick={() => handleSelect(team)}
                  className={`w-full text-left px-4 py-3 ${coachMode ? 'hover:bg-gray-100' : 'hover:bg-gray-700'} transition`}
                >
                  <div className="font-semibold">{team.name}</div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Map Advantages Component for H2H
const MapAdvantagesSection = ({ advantages, yourTeamName, opponentName, coachMode }: {
  advantages: MapAdvantage[];
  yourTeamName: string;
  opponentName: string;
  coachMode: boolean;
}) => {
  return (
    <section className={`p-6 rounded-lg ${coachMode ? 'border-2 border-black bg-gray-50' : 'bg-gray-800'}`}>
      <h3 className="text-2xl font-bold mb-2 text-c9-blue">Map Advantages</h3>
      <p className={`text-sm mb-4 ${coachMode ? 'text-gray-600' : 'text-gray-400'}`}>
        Direct comparison of win rates per map
      </p>
      <div className="space-y-2">
        {advantages.map((adv) => (
          <div
            key={adv.map}
            className={`flex items-center justify-between p-3 rounded-lg ${
              adv.advantage === 'yours' ? 'bg-green-600/30' :
              adv.advantage === 'opponent' ? 'bg-red-600/30' :
              'bg-yellow-600/30'
            }`}
          >
            <div className="flex items-center gap-3">
              <MapThumbnail mapName={adv.map} size="sm" />
              <span className="font-bold text-lg">{adv.map}</span>
              <span className={`text-xs px-2 py-1 rounded ${
                adv.advantage === 'yours' ? 'bg-green-600 text-white' :
                adv.advantage === 'opponent' ? 'bg-red-600 text-white' :
                'bg-yellow-600 text-black'
              }`}>
                {adv.advantage === 'yours' ? 'YOUR ADVANTAGE' :
                 adv.advantage === 'opponent' ? 'THEIR ADVANTAGE' : 'NEUTRAL'}
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <span className={`${adv.advantage === 'yours' ? 'text-green-400 font-bold' : ''}`}>
                {yourTeamName}: {adv.your_win_rate}%
              </span>
              <span className={`${adv.advantage === 'opponent' ? 'text-red-400 font-bold' : ''}`}>
                {opponentName}: {adv.opponent_win_rate}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

function App() {
  // Mode selection
  const [scoutMode, setScoutMode] = useState<ScoutMode>('h2h');

  // Your team state (for H2H)
  const [yourTeamSearch, setYourTeamSearch] = useState('');
  const [yourTeam, setYourTeam] = useState<Team | null>(null);
  const [yourTeamResults, setYourTeamResults] = useState<Team[]>([]);
  const [yourTeamLoading, setYourTeamLoading] = useState(false);

  // Opponent team state
  const [opponentSearch, setOpponentSearch] = useState('');
  const [opponentTeam, setOpponentTeam] = useState<Team | null>(null);
  const [opponentResults, setOpponentResults] = useState<Team[]>([]);
  const [opponentLoading, setOpponentLoading] = useState(false);

  // Report state
  const [report, setReport] = useState<ScoutReport | null>(null);
  const [comparisonReport, setComparisonReport] = useState<ComparisonReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coachMode, setCoachMode] = useState(false);

  const debouncedYourTeam = useDebounce(yourTeamSearch, 300);
  const debouncedOpponent = useDebounce(opponentSearch, 300);

  // Search for your team
  useEffect(() => {
    const searchTeams = async () => {
      if (debouncedYourTeam.length < 2) {
        setYourTeamResults([]);
        return;
      }
      setYourTeamLoading(true);
      try {
        const response = await axios.get(`${API_BASE}/api/teams`, {
          params: { search: debouncedYourTeam }
        });
        setYourTeamResults(response.data.teams || []);
      } catch {
        setYourTeamResults([]);
      } finally {
        setYourTeamLoading(false);
      }
    };
    searchTeams();
  }, [debouncedYourTeam]);

  // Search for opponent team
  useEffect(() => {
    const searchTeams = async () => {
      if (debouncedOpponent.length < 2) {
        setOpponentResults([]);
        return;
      }
      setOpponentLoading(true);
      try {
        const response = await axios.get(`${API_BASE}/api/teams`, {
          params: { search: debouncedOpponent }
        });
        setOpponentResults(response.data.teams || []);
      } catch {
        setOpponentResults([]);
      } finally {
        setOpponentLoading(false);
      }
    };
    searchTeams();
  }, [debouncedOpponent]);

  const handleScout = useCallback(async () => {
    setError(null);

    if (scoutMode === 'h2h') {
      // H2H comparison mode
      if (!yourTeam || !opponentTeam) {
        setError('Please select both teams for head-to-head comparison');
        return;
      }

      setLoading(true);
      try {
        const response = await axios.post(`${API_BASE}/api/scout/compare`, {
          your_team_id: yourTeam.id,
          opponent_team_id: opponentTeam.id
        });
        setComparisonReport(response.data);
        setReport(null);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to generate comparison');
      } finally {
        setLoading(false);
      }
    } else {
      // Single team scout mode
      if (!opponentTeam && opponentSearch.length < 2) {
        setError('Please enter a team name');
        return;
      }

      setLoading(true);
      try {
        const payload = opponentTeam
          ? { team_id: opponentTeam.id, team_name: opponentTeam.name }
          : { team_name: opponentSearch };

        // Include your team ID if selected for better veto recommendations
        if (yourTeam) {
          (payload as any).our_team_id = yourTeam.id;
        }

        const response = await axios.post(`${API_BASE}/api/scout`, payload);
        setReport(response.data);
        setComparisonReport(null);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to generate report');
      } finally {
        setLoading(false);
      }
    }
  }, [scoutMode, yourTeam, opponentTeam, opponentSearch]);

  const handleReset = () => {
    setReport(null);
    setComparisonReport(null);
    setYourTeam(null);
    setOpponentTeam(null);
    setYourTeamSearch('');
    setOpponentSearch('');
    setError(null);
  };

  const hasReport = report || comparisonReport;

  return (
    <div className={`min-h-screen p-4 md:p-8 ${coachMode ? 'bg-white text-black' : 'bg-c9-dark text-white'}`}>
      <div className="max-w-5xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-c9-blue">VetoBrain</h1>
            <p className={`text-sm ${coachMode ? 'text-gray-600' : 'text-gray-400'}`}>
              VALORANT Automated Scouting Reports
            </p>
          </div>
          <button
            onClick={() => setCoachMode(!coachMode)}
            className="px-4 py-2 border-2 border-c9-blue rounded hover:bg-c9-blue hover:text-white transition text-sm"
          >
            {coachMode ? 'Dark Mode' : 'Coach Mode'}
          </button>
        </header>

        {!hasReport ? (
          <div className="py-8">
            {/* Mode Selection */}
            <div className="flex justify-center gap-4 mb-8">
              <button
                onClick={() => setScoutMode('h2h')}
                className={`px-6 py-3 rounded-lg font-semibold transition ${
                  scoutMode === 'h2h'
                    ? 'bg-c9-blue text-white'
                    : coachMode ? 'bg-gray-200 hover:bg-gray-300' : 'bg-gray-800 hover:bg-gray-700'
                }`}
              >
                Head-to-Head
              </button>
              <button
                onClick={() => setScoutMode('single')}
                className={`px-6 py-3 rounded-lg font-semibold transition ${
                  scoutMode === 'single'
                    ? 'bg-c9-blue text-white'
                    : coachMode ? 'bg-gray-200 hover:bg-gray-300' : 'bg-gray-800 hover:bg-gray-700'
                }`}
              >
                Scout Single Team
              </button>
            </div>

            {/* Team Selection */}
            <div className={`max-w-2xl mx-auto p-6 rounded-lg ${coachMode ? 'bg-gray-50 border-2 border-gray-200' : 'bg-gray-800/50'}`}>
              <h2 className="text-2xl font-bold mb-6 text-center">
                {scoutMode === 'h2h' ? 'Select Both Teams' : 'Scout an Opponent'}
              </h2>

              <div className={`space-y-6 ${scoutMode === 'h2h' ? '' : ''}`}>
                {/* Your Team (always shown in H2H, optional in single) */}
                {scoutMode === 'h2h' && (
                  <TeamSearchInput
                    label="Your Team"
                    placeholder="Search your team..."
                    searchTerm={yourTeamSearch}
                    setSearchTerm={setYourTeamSearch}
                    selectedTeam={yourTeam}
                    setSelectedTeam={setYourTeam}
                    searchResults={yourTeamResults}
                    searchLoading={yourTeamLoading}
                    coachMode={coachMode}
                  />
                )}

                {/* VS Divider for H2H */}
                {scoutMode === 'h2h' && (
                  <div className="flex items-center gap-4">
                    <div className={`flex-1 h-px ${coachMode ? 'bg-gray-300' : 'bg-gray-600'}`}></div>
                    <span className="text-2xl font-bold text-c9-blue">VS</span>
                    <div className={`flex-1 h-px ${coachMode ? 'bg-gray-300' : 'bg-gray-600'}`}></div>
                  </div>
                )}

                {/* Opponent Team */}
                <TeamSearchInput
                  label={scoutMode === 'h2h' ? 'Opponent Team' : 'Team to Scout'}
                  placeholder="Search opponent team..."
                  searchTerm={opponentSearch}
                  setSearchTerm={setOpponentSearch}
                  selectedTeam={opponentTeam}
                  setSelectedTeam={setOpponentTeam}
                  searchResults={opponentResults}
                  searchLoading={opponentLoading}
                  coachMode={coachMode}
                />
              </div>

              {/* Generate Button */}
              <div className="mt-8 text-center">
                <button
                  onClick={handleScout}
                  className="bg-c9-blue px-10 py-4 rounded-lg font-bold text-lg hover:bg-opacity-80 transition disabled:opacity-50 text-white"
                  disabled={loading || (scoutMode === 'h2h' ? (!yourTeam || !opponentTeam) : (!opponentTeam && opponentSearch.length < 2))}
                >
                  {loading ? 'Generating Report...' : scoutMode === 'h2h' ? 'Compare Teams' : 'Generate Scout Report'}
                </button>
              </div>

              {loading && (
                <div className="mt-6 text-center">
                  <div className="animate-pulse text-xl text-c9-blue">Analyzing match data...</div>
                </div>
              )}

              {error && (
                <div className="mt-6 p-4 bg-red-500/20 border border-red-500 rounded-lg text-center">
                  <p className="text-red-500">{error}</p>
                </div>
              )}
            </div>
          </div>
        ) : comparisonReport ? (
          /* H2H Comparison Report Display */
          <div className="space-y-6">
            {/* Header with both teams */}
            <div className={`p-6 rounded-lg ${coachMode ? 'bg-gray-100' : 'bg-gray-800'}`}>
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="text-center md:text-left">
                  <h2 className="text-2xl font-bold text-green-500">{comparisonReport.your_team.team_name}</h2>
                  <p className={`text-sm ${coachMode ? 'text-gray-600' : 'text-gray-400'}`}>
                    {comparisonReport.your_team.matches_analyzed} maps | {comparisonReport.your_team.summary.recent_form}
                  </p>
                </div>
                <div className="text-3xl font-bold text-c9-blue">VS</div>
                <div className="text-center md:text-right">
                  <h2 className="text-2xl font-bold text-red-500">{comparisonReport.opponent.team_name}</h2>
                  <p className={`text-sm ${coachMode ? 'text-gray-600' : 'text-gray-400'}`}>
                    {comparisonReport.opponent.matches_analyzed} maps | {comparisonReport.opponent.summary.recent_form}
                  </p>
                </div>
              </div>
            </div>

            {/* Game Plan - 3 Cards */}
            <div className="grid md:grid-cols-3 gap-4">
              {/* Maps to Pick */}
              <div className={`p-5 rounded-lg border-l-4 border-green-500 ${coachMode ? 'bg-green-50' : 'bg-green-900/20'}`}>
                <h3 className="text-sm uppercase tracking-widest text-green-500 mb-2 font-semibold">Maps to Pick</h3>
                <div className="space-y-1">
                  {comparisonReport.map_advantages
                    .filter(m => m.advantage === 'yours')
                    .slice(0, 2)
                    .map(m => (
                      <div key={m.map} className="flex items-center gap-2">
                        <MapThumbnail mapName={m.map} size="sm" />
                        <span className="font-bold text-lg">{m.map}</span>
                        <span className={`text-xs ${coachMode ? 'text-green-700' : 'text-green-400'}`}>+{(m.your_win_rate - m.opponent_win_rate).toFixed(0)}%</span>
                      </div>
                    ))}
                  {comparisonReport.map_advantages.filter(m => m.advantage === 'yours').length === 0 && (
                    <p className={`text-sm ${coachMode ? 'text-gray-600' : 'text-gray-400'}`}>No clear pick advantage</p>
                  )}
                </div>
              </div>

              {/* Maps to Ban */}
              <div className={`p-5 rounded-lg border-l-4 border-red-500 ${coachMode ? 'bg-red-50' : 'bg-red-900/20'}`}>
                <h3 className="text-sm uppercase tracking-widest text-red-500 mb-2 font-semibold">Maps to Ban</h3>
                <div className="space-y-1">
                  {comparisonReport.map_advantages
                    .filter(m => m.advantage === 'opponent')
                    .slice(0, 2)
                    .map(m => (
                      <div key={m.map} className="flex items-center gap-2">
                        <MapThumbnail mapName={m.map} size="sm" />
                        <span className="font-bold text-lg">{m.map}</span>
                        <span className={`text-xs ${coachMode ? 'text-red-700' : 'text-red-400'}`}>{(m.your_win_rate - m.opponent_win_rate).toFixed(0)}%</span>
                      </div>
                    ))}
                  {comparisonReport.map_advantages.filter(m => m.advantage === 'opponent').length === 0 && (
                    <p className={`text-sm ${coachMode ? 'text-gray-600' : 'text-gray-400'}`}>No maps to avoid</p>
                  )}
                </div>
              </div>

              {/* Key Threat */}
              <div className={`p-5 rounded-lg border-l-4 border-yellow-500 ${coachMode ? 'bg-yellow-50' : 'bg-yellow-900/20'}`}>
                <h3 className="text-sm uppercase tracking-widest text-yellow-500 mb-2 font-semibold">Key Threat</h3>
                <p className="font-bold text-xl">{comparisonReport.opponent.summary.primary_threat}</p>
                <p className={`text-sm mt-1 ${coachMode ? 'text-gray-600' : 'text-gray-400'}`}>
                  Neutralize early to disrupt their gameplan
                </p>
              </div>
            </div>

            {/* Map Advantages */}
            <MapAdvantagesSection
              advantages={comparisonReport.map_advantages}
              yourTeamName={comparisonReport.your_team.team_name}
              opponentName={comparisonReport.opponent.team_name}
              coachMode={coachMode}
            />

            {/* Veto Engine for opponent */}
            <VetoEngine recommendations={comparisonReport.opponent.veto_recommendations} coachMode={coachMode} />

            {/* Tactical Insights for opponent */}
            <TacticalInsights insights={comparisonReport.opponent.tactical_insights} coachMode={coachMode} />

            {/* NEW: Opponent Player Behavior Profiles */}
            {comparisonReport.opponent.player_behavior_profiles && comparisonReport.opponent.player_behavior_profiles.length > 0 && (
              <PlayerBehaviorSection profiles={comparisonReport.opponent.player_behavior_profiles} coachMode={coachMode} />
            )}

            {/* NEW: Opponent Team Composition */}
            {comparisonReport.opponent.team_composition && (
              <TeamCompositionSection composition={comparisonReport.opponent.team_composition} coachMode={coachMode} />
            )}

            {/* NEW: Opponent Economy Tendencies */}
            {comparisonReport.opponent.economy_tendency && (
              <EconomyTendencySection economy={comparisonReport.opponent.economy_tendency} coachMode={coachMode} />
            )}

            {/* Opponent Map Pool */}
            <MapPoolMatrix matrix={comparisonReport.opponent.map_pool_matrix} coachMode={coachMode} />

            {/* Opponent Players */}
            <PlayerStatsSection players={comparisonReport.opponent.player_stats} coachMode={coachMode} />

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
              <button
                onClick={handleReset}
                className="px-6 py-3 border-2 border-c9-blue rounded hover:bg-c9-blue hover:text-white transition"
              >
                New Comparison
              </button>
              {coachMode && (
                <button
                  onClick={() => window.print()}
                  className="px-6 py-3 bg-c9-blue rounded font-bold hover:bg-opacity-80 transition text-white"
                >
                  Print Report
                </button>
              )}
            </div>
          </div>
        ) : report ? (
          /* Single Team Report Display */
          <div className="space-y-6">
            {/* Header */}
            <div className={`p-4 rounded-lg ${coachMode ? 'bg-gray-100' : 'bg-gray-800'}`}>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                <div>
                  <h2 className="text-3xl font-bold">{report.team_name}</h2>
                  <p className={`text-sm ${coachMode ? 'text-gray-600' : 'text-gray-400'}`}>
                    {report.matches_analyzed} maps analyzed | {report.date_range}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold text-c9-blue">{report.summary.recent_form}</span>
                  <p className={`text-sm ${coachMode ? 'text-gray-600' : 'text-gray-400'}`}>
                    {report.summary.team_playstyle}
                  </p>
                </div>
              </div>
            </div>

            {/* Primary Threat - Quick Summary */}
            <section className={`p-6 border-l-8 border-c9-blue ${coachMode ? 'bg-gray-100' : 'bg-gray-800'}`}>
              <h2 className="text-sm uppercase tracking-widest text-c9-blue mb-2">Primary Threat</h2>
              <p className="text-2xl font-bold">{report.summary.primary_threat}</p>
              <p className={`mt-2 text-lg ${coachMode ? 'text-gray-700' : 'text-gray-300'}`}>
                {report.summary.key_takeaway}
              </p>
            </section>

            {/* HERO FEATURE 1: Veto Engine */}
            <VetoEngine recommendations={report.veto_recommendations} coachMode={coachMode} />

            {/* HERO FEATURE 2: Tactical Insights */}
            <TacticalInsights insights={report.tactical_insights} coachMode={coachMode} />

            {/* NEW: Player Behavior Profiles */}
            {report.player_behavior_profiles && report.player_behavior_profiles.length > 0 && (
              <PlayerBehaviorSection profiles={report.player_behavior_profiles} coachMode={coachMode} />
            )}

            {/* NEW: Team Composition Analysis */}
            {report.team_composition && (
              <TeamCompositionSection composition={report.team_composition} coachMode={coachMode} />
            )}

            {/* NEW: Economy Tendencies */}
            {report.economy_tendency && (
              <EconomyTendencySection economy={report.economy_tendency} coachMode={coachMode} />
            )}

            {/* HERO FEATURE 3: Map Pool Matrix */}
            <MapPoolMatrix matrix={report.map_pool_matrix} coachMode={coachMode} />

            {/* Player Stats */}
            <PlayerStatsSection players={report.player_stats} coachMode={coachMode} />

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
              <button
                onClick={handleReset}
                className="px-6 py-3 border-2 border-c9-blue rounded hover:bg-c9-blue hover:text-white transition"
              >
                Scout Another Team
              </button>
              {coachMode && (
                <button
                  onClick={() => window.print()}
                  className="px-6 py-3 bg-c9-blue rounded font-bold hover:bg-opacity-80 transition text-white"
                >
                  Print Report
                </button>
              )}
            </div>
          </div>
        ) : null}

        {/* Footer */}
        <footer className={`mt-12 pt-6 border-t text-center text-sm ${coachMode ? 'border-gray-200 text-gray-500' : 'border-gray-700 text-gray-500'}`}>
          <p>VALORANT Scouting Intelligence</p>
        </footer>
      </div>

      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}

export default App;
