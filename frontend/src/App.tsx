import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:5001';

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
              <div className="flex items-center gap-4">
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
                <td className="py-2 px-3 font-semibold">{map.map_name}</td>
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
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div><span className="opacity-60">ACS:</span> <strong>{player.avg_acs}</strong></div>
              <div><span className="opacity-60">K/D:</span> <strong>{player.avg_kd}</strong></div>
              <div><span className="opacity-60">FB%:</span> <strong>{player.first_blood_rate}%</strong></div>
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
            <div className="flex items-center gap-4">
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
            <h1 className="text-3xl md:text-4xl font-bold text-c9-blue">C9 Scout</h1>
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

            {/* Recommendation Summary */}
            <section className={`p-6 border-l-8 border-c9-blue ${coachMode ? 'bg-gray-100' : 'bg-gray-800'}`}>
              <h2 className="text-sm uppercase tracking-widest text-c9-blue mb-2">Game Plan</h2>
              <p className="text-xl font-bold">{comparisonReport.recommendation}</p>
            </section>

            {/* Map Advantages */}
            <MapAdvantagesSection
              advantages={comparisonReport.map_advantages}
              yourTeamName={comparisonReport.your_team.team_name}
              opponentName={comparisonReport.opponent.team_name}
              coachMode={coachMode}
            />

            {/* Opponent Analysis Section */}
            <div className={`p-4 rounded-lg ${coachMode ? 'bg-blue-50 border-2 border-blue-200' : 'bg-blue-900/20'}`}>
              <h2 className="text-xl font-bold mb-4 text-c9-blue">Opponent Analysis: {comparisonReport.opponent.team_name}</h2>
            </div>

            {/* Veto Engine for opponent */}
            <VetoEngine recommendations={comparisonReport.opponent.veto_recommendations} coachMode={coachMode} />

            {/* Tactical Insights for opponent */}
            <TacticalInsights insights={comparisonReport.opponent.tactical_insights} coachMode={coachMode} />

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
          <p>Built for Cloud9 x JetBrains Hackathon 2025</p>
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
