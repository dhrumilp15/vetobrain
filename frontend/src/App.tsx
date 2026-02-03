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

// Team Search Dropdown
const TeamSearchDropdown = ({
  teams, onSelect, loading, coachMode
}: { teams: Team[], onSelect: (team: Team) => void, loading: boolean, coachMode: boolean }) => {
  if (loading) {
    return (
      <div className={`absolute w-full mt-1 p-4 rounded-lg shadow-lg z-10 ${coachMode ? 'bg-gray-100' : 'bg-gray-800'}`}>
        <div className="animate-pulse">Searching...</div>
      </div>
    );
  }
  if (teams.length === 0) return null;

  return (
    <div className={`absolute w-full mt-1 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto ${coachMode ? 'bg-white border border-gray-300' : 'bg-gray-800'}`}>
      {teams.map(team => (
        <button
          key={team.id}
          onClick={() => onSelect(team)}
          className={`w-full text-left px-4 py-3 ${coachMode ? 'hover:bg-gray-100' : 'hover:bg-gray-700'} transition`}
        >
          <div className="font-semibold">{team.name}</div>
        </button>
      ))}
    </div>
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
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [searchResults, setSearchResults] = useState<Team[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [report, setReport] = useState<ScoutReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coachMode, setCoachMode] = useState(false);

  const debouncedSearch = useDebounce(searchTerm, 300);

  useEffect(() => {
    const searchTeams = async () => {
      if (debouncedSearch.length < 2) {
        setSearchResults([]);
        return;
      }
      setSearchLoading(true);
      try {
        const response = await axios.get(`${API_BASE}/api/teams`, {
          params: { search: debouncedSearch }
        });
        setSearchResults(response.data.teams || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    };
    searchTeams();
  }, [debouncedSearch]);

  const handleTeamSelect = (team: Team) => {
    setSelectedTeam(team);
    setSearchTerm(team.name);
    setSearchResults([]);
  };

  const handleScout = useCallback(async () => {
    if (!selectedTeam && searchTerm.length < 2) {
      setError('Please enter a team name');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = selectedTeam
        ? { team_id: selectedTeam.id, team_name: selectedTeam.name }
        : { team_name: searchTerm };

      const response = await axios.post(`${API_BASE}/api/scout`, payload);
      setReport(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  }, [selectedTeam, searchTerm]);

  const handleReset = () => {
    setReport(null);
    setSelectedTeam(null);
    setSearchTerm('');
    setError(null);
  };

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

        {!report ? (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold mb-6">Scout an Opponent</h2>
            <div className="relative inline-block w-full max-w-md">
              <input
                type="text"
                placeholder="Search team (e.g. Sentinels, LOUD)"
                className={`px-6 py-4 rounded-lg w-full text-lg focus:outline-none focus:ring-2 focus:ring-c9-blue ${
                  coachMode ? 'bg-gray-100 text-black' : 'bg-gray-800 text-white'
                }`}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setSelectedTeam(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleScout()}
              />
              <TeamSearchDropdown
                teams={searchResults}
                onSelect={handleTeamSelect}
                loading={searchLoading}
                coachMode={coachMode}
              />
            </div>

            <div className="mt-6">
              <button
                onClick={handleScout}
                className="bg-c9-blue px-10 py-4 rounded-lg font-bold text-lg hover:bg-opacity-80 transition disabled:opacity-50"
                disabled={loading || (searchTerm.length < 2 && !selectedTeam)}
              >
                {loading ? 'Generating Report...' : 'Generate Scout Report'}
              </button>
            </div>

            {loading && (
              <div className="mt-8">
                <div className="animate-pulse text-xl text-c9-blue">Analyzing match data...</div>
              </div>
            )}

            {error && (
              <div className="mt-8 p-4 bg-red-500/20 border border-red-500 rounded-lg inline-block">
                <p className="text-red-500">{error}</p>
              </div>
            )}
          </div>
        ) : (
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
                  className="px-6 py-3 bg-c9-blue rounded font-bold hover:bg-opacity-80 transition"
                >
                  Print Report
                </button>
              )}
            </div>
          </div>
        )}

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
