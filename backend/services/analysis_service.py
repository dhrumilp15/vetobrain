import logging
from collections import defaultdict
from typing import List, Dict, Tuple, Optional
from datetime import datetime

from models.match import Match, PlayerMatchStats
from models.report import (
    ScoutReport, PlayerStats, ReportSummary, MapStats,
    VetoRecommendation, TacticalInsight, MapPoolEntry
)

logger = logging.getLogger(__name__)


class AnalysisService:
    """
    Service for analyzing match data and generating scouting insights.

    Focuses on producing opinionated, actionable insights rather than raw statistics.
    """

    # Impact thresholds based on ACS
    HIGH_IMPACT_ACS = 250
    MEDIUM_IMPACT_ACS = 200

    # All VALORANT maps in the current pool
    ALL_MAPS = ["Abyss", "Ascent", "Bind", "Breeze", "Haven", "Icebox", "Lotus", "Pearl", "Split", "Sunset"]

    def get_team_map_stats(self, matches: List[Match]) -> Dict:
        """
        Extract map statistics from matches for use in veto calculations.

        Returns a dict with 'map_stats' key containing a list of MapStats objects.
        """
        if not matches:
            return {}
        map_stats = self._analyze_map_performance(matches)
        return {'map_stats': map_stats}

    def generate_scout_report(
        self,
        team_id: str,
        team_name: str,
        matches: List[Match],
        our_team_stats: Optional[Dict] = None  # For H2H veto calculation
    ) -> ScoutReport:
        """
        Generate a comprehensive scouting report from match data.
        """
        if not matches:
            return self._generate_demo_report(team_id, team_name)

        # Aggregate player statistics across all matches
        player_aggregates = self._aggregate_player_stats(matches)

        # Analyze map performance
        map_stats = self._analyze_map_performance(matches)

        # Check if we have actual player data - if not, use demo player stats
        if not player_aggregates:
            logger.warning(f"No player data found for team {team_name}, using demo player stats")
            player_stats = self._get_demo_player_stats()
            primary_threat = "Unknown (no player data)"
            threat_reason = "insufficient data"
        else:
            # Identify primary threat
            primary_threat, threat_reason = self._identify_primary_threat(player_aggregates)
            # Generate player stat summaries
            player_stats = self._generate_player_stats(player_aggregates)

        # Determine recommended map bans (opponent's best maps)
        recommended_bans = self._get_recommended_bans(map_stats)

        # Calculate recent form
        recent_form = self._calculate_recent_form(matches)

        # Determine team playstyle
        playstyle = self._analyze_playstyle(player_aggregates, matches)

        # Generate key takeaway
        key_takeaway = self._generate_key_takeaway(
            team_name, primary_threat, playstyle, recommended_bans
        )

        # Build date range string
        date_range = self._get_date_range(matches)

        # NEW: Generate veto recommendations
        veto_recommendations = self._generate_veto_recommendations(map_stats, our_team_stats)

        # NEW: Generate tactical insights
        tactical_insights = self._generate_tactical_insights(player_aggregates, map_stats, matches)

        # NEW: Generate map pool matrix
        map_pool_matrix = self._generate_map_pool_matrix(map_stats)

        summary = ReportSummary(
            primary_threat=primary_threat,
            key_takeaway=key_takeaway,
            team_playstyle=playstyle,
            recent_form=recent_form
        )

        return ScoutReport(
            team_id=team_id,
            team_name=team_name,
            summary=summary,
            recommended_bans=recommended_bans,
            player_stats=player_stats,
            map_stats=map_stats,
            matches_analyzed=len(matches),
            date_range=date_range,
            veto_recommendations=veto_recommendations,
            tactical_insights=tactical_insights,
            map_pool_matrix=map_pool_matrix
        )

    def _generate_veto_recommendations(
        self,
        their_map_stats: List[MapStats],
        our_team_stats: Optional[Dict] = None
    ) -> List[VetoRecommendation]:
        """
        Generate map veto recommendations using a blended model that aligns
        color semantics with Tactical Insights thresholds.

        Core score (kept): Map Score = (Our Win% * 0.5) - (Their Win% * 0.5)
        Color guardrails (new):
          - Strong map (their WR >= 70% with >=2 games) → at least BAN
          - Weak map (their WR <= 40% with >=2 games) → at least PICK
          - NEUTRAL ("yellow/decider") only when their WR is in the same
            middle band used by insights (40–70%) AND the differential is small.
        """
        # Build their win rates by map (as fractions 0..1) and sample sizes
        # Use lowercase keys for case-insensitive lookup
        their_rates = {ms.map_name.lower(): ms.win_rate for ms in their_map_stats}
        their_games = {ms.map_name.lower(): ms.games_played for ms in their_map_stats}

        # Our rates: use provided team stats if available, otherwise demo baselines
        # Use lowercase keys for case-insensitive lookup
        our_rates: Dict[str, float] = {}
        if our_team_stats and 'map_stats' in our_team_stats:
            for ms in our_team_stats['map_stats']:
                our_rates[ms.map_name.lower()] = ms.win_rate
        else:
            # Demo mode: plausible "our" rates (fractions 0..1)
            our_rates = {
                "haven": 0.72, "split": 0.45, "bind": 0.58, "ascent": 0.65,
                "icebox": 0.52, "breeze": 0.48, "lotus": 0.55, "pearl": 0.60,
                "sunset": 0.50, "abyss": 0.53
            }

        recommendations: List[VetoRecommendation] = []
        for map_name in self.ALL_MAPS:
            our_wr = our_rates.get(map_name.lower(), 0.5)
            their_wr = their_rates.get(map_name.lower(), 0.5)
            their_gp = their_games.get(map_name.lower(), 0)

            # Differential score: positive = good for us, negative = bad for us
            score = (our_wr * 0.5) - (their_wr * 0.5)

            # Confidence penalty for small samples on their side
            if their_gp < 3:
                score *= 0.8

            # Align "yellow" with Tactical Insights middle band
            strong_map = (their_wr >= 0.70 and their_gp >= 2)
            weak_map = (their_wr <= 0.40 and their_gp >= 2)

            # Decide category using guardrails first, then differential
            if strong_map:
                # Never show yellow for opponent-strong maps
                if score <= -0.15:
                    rec = "MUST_BAN"
                    reason = f"They dominate this map ({their_wr*100:.0f}% WR)"
                else:
                    rec = "BAN"
                    reason = f"Opponent-strong map ({their_wr*100:.0f}% WR)"
            elif weak_map:
                # Never show yellow for clear opponent-weak maps
                if score >= 0.15:
                    rec = "MUST_PICK"
                    reason = "Clear advantage"
                else:
                    rec = "PICK"
                    reason = "They struggle here"
            else:
                # Middle band (40–70%): allow decider based on small differential
                if score >= 0.15:
                    rec = "MUST_PICK"
                    reason = f"Strong advantage (+{score*100:.0f}%)"
                elif score >= 0.05:
                    rec = "PICK"
                    reason = "Slight advantage"
                elif score <= -0.15:
                    rec = "MUST_BAN"
                    reason = f"They have a significant edge ({their_wr*100:.0f}% WR)"
                elif score <= -0.05:
                    rec = "BAN"
                    reason = "They have an edge here"
                else:
                    rec = "NEUTRAL"
                    reason = "Even matchup - decider potential"

            recommendations.append(VetoRecommendation(
                map_name=map_name,
                score=score,
                recommendation=rec,
                our_win_rate=our_wr,
                their_win_rate=their_wr,
                reason=reason
            ))

        # Sort by score descending (best picks first, worst bans last)
        recommendations.sort(key=lambda x: x.score, reverse=True)
        return recommendations

    def _generate_tactical_insights(
        self,
        player_aggregates: Dict,
        map_stats: List[MapStats],
        matches: List[Match]
    ) -> List[TacticalInsight]:
        """
        Generate tactical insights using template-based "Mad Libs" system.
        """
        insights = []

        # Calculate aggregate stats
        total_fb = sum(d['total_first_bloods'] for d in player_aggregates.values())
        total_fd = sum(d['total_first_deaths'] for d in player_aggregates.values())
        total_games = sum(d['games'] for d in player_aggregates.values()) / 5  # 5 players per game

        fb_rate = total_fb / max(total_fb + total_fd, 1)

        # Find star player
        star_player = max(player_aggregates.values(), key=lambda x: x['total_acs'] / max(x['games'], 1), default=None)

        # Calculate pistol/eco approximation (using first blood as proxy for aggression)
        # In real implementation, you'd have actual pistol round data

        # TEMPLATE 1: First Blood Aggression
        if fb_rate > 0.55:
            insights.append(TacticalInsight(
                category="OPENING",
                title="Aggressive Openers",
                description=f"They win {fb_rate*100:.0f}% of opening duels. Play passive angles on pistol rounds (1 & 13) to deny their aggression. Don't peek dry.",
                severity="WARNING",
                icon="!"
            ))
        elif fb_rate < 0.45:
            insights.append(TacticalInsight(
                category="OPENING",
                title="Vulnerable to Early Pressure",
                description=f"They lose {(1-fb_rate)*100:.0f}% of opening duels. Apply early pressure with aggressive utility and fast peeks.",
                severity="TIP",
                icon="+"
            ))

        # TEMPLATE 2: Star Player Dependency
        if star_player and star_player['games'] > 0:
            star_acs = star_player['total_acs'] / star_player['games']
            star_name = star_player['name']
            top_agent = max(star_player['agents'].items(), key=lambda x: x[1])[0] if star_player['agents'] else "Unknown"

            if star_acs > 270:
                insights.append(TacticalInsight(
                    category="KEY_PLAYER",
                    title=f"Neutralize {star_name}",
                    description=f"{star_name} averages {star_acs:.0f} ACS on {top_agent}. Dedicate utility to shut them down early. If they're quiet, the team struggles.",
                    severity="WARNING",
                    icon="*"
                ))

        # TEMPLATE 3: Map Pool Weakness
        weak_maps = [ms for ms in map_stats if ms.win_rate < 0.4 and ms.games_played >= 2]
        if weak_maps:
            weakest = min(weak_maps, key=lambda x: x.win_rate)
            insights.append(TacticalInsight(
                category="MAP_POOL",
                title=f"Exploit {weakest.map_name}",
                description=f"Only {weakest.win_rate*100:.0f}% win rate on {weakest.map_name}. Force this map in veto if possible.",
                severity="TIP",
                icon=">"
            ))

        # TEMPLATE 4: Strong Map Warning
        strong_maps = [ms for ms in map_stats if ms.win_rate > 0.7 and ms.games_played >= 2]
        if strong_maps:
            strongest = max(strong_maps, key=lambda x: x.win_rate)
            insights.append(TacticalInsight(
                category="MAP_POOL",
                title=f"Avoid {strongest.map_name}",
                description=f"They have a {strongest.win_rate*100:.0f}% win rate on {strongest.map_name}. Must ban unless you have a specific counter-strat.",
                severity="WARNING",
                icon="X"
            ))

        # TEMPLATE 5: Agent Pool Analysis
        all_agents = defaultdict(int)
        for data in player_aggregates.values():
            for agent, count in data['agents'].items():
                all_agents[agent] += count

        # Check for Duelist heavy
        duelists = {'Jett', 'Raze', 'Reyna', 'Phoenix', 'Yoru', 'Neon', 'Iso'}
        duelist_picks = sum(all_agents.get(a, 0) for a in duelists)
        total_picks = sum(all_agents.values())

        if total_picks > 0 and duelist_picks / total_picks > 0.35:
            insights.append(TacticalInsight(
                category="COMPOSITION",
                title="Duelist Heavy Comp",
                description="They run multiple duelists frequently. Expect aggressive dry peeks and trade-focused plays. Stack utility for retakes.",
                severity="INFO",
                icon="!"
            ))

        # TEMPLATE 6: Close Games Analysis
        close_games = [m for m in matches if abs(m.team_score - m.opponent_score) <= 3]
        if len(close_games) > len(matches) * 0.4:
            insights.append(TacticalInsight(
                category="MENTAL",
                title="Clutch Situations",
                description="Many of their games go to overtime or close finishes. They're dangerous in high-pressure situations - don't let rounds drag.",
                severity="INFO",
                icon="~"
            ))

        # TEMPLATE 7: Round Differential
        total_rounds_won = sum(m.team_score for m in matches)
        total_rounds_lost = sum(m.opponent_score for m in matches)
        if matches:
            avg_diff = (total_rounds_won - total_rounds_lost) / len(matches)
            if avg_diff > 3:
                insights.append(TacticalInsight(
                    category="FORM",
                    title="Dominant Form",
                    description=f"Averaging +{avg_diff:.1f} round differential. They're in peak form - expect disciplined play.",
                    severity="WARNING",
                    icon="^"
                ))
            elif avg_diff < -2:
                insights.append(TacticalInsight(
                    category="FORM",
                    title="Struggling Recently",
                    description=f"Negative round differential ({avg_diff:.1f}). Apply early pressure to tilt them further.",
                    severity="TIP",
                    icon="v"
                ))

        return insights

    def _generate_map_pool_matrix(self, map_stats: List[MapStats]) -> List[MapPoolEntry]:
        """
        Generate the map pool matrix with Win%, Attack%, Defense% per map.
        """
        matrix = []

        # Create entries for all maps in the pool (case-insensitive lookup)
        stats_by_map = {ms.map_name.lower(): ms for ms in map_stats}

        for map_name in self.ALL_MAPS:
            if map_name.lower() in stats_by_map:
                ms = stats_by_map[map_name.lower()]
                # Calculate attack/defense approximation
                # In real data, you'd have this split. For demo, estimate from round data
                total_rounds = ms.avg_rounds_won + ms.avg_rounds_lost
                if total_rounds > 0:
                    # Rough approximation: assume attack rounds are slightly harder
                    atk_estimate = ms.win_rate * 0.9  # Slightly lower on attack
                    def_estimate = ms.win_rate * 1.1  # Slightly higher on defense
                    atk_estimate = min(atk_estimate, 1.0)
                    def_estimate = min(def_estimate, 1.0)
                else:
                    atk_estimate = 0.5
                    def_estimate = 0.5

                matrix.append(MapPoolEntry(
                    map_name=map_name,
                    games_played=ms.games_played,
                    win_rate=ms.win_rate,
                    attack_win_rate=atk_estimate,
                    defense_win_rate=def_estimate,
                    avg_round_diff=ms.avg_rounds_won - ms.avg_rounds_lost
                ))
            else:
                # No data for this map
                matrix.append(MapPoolEntry(
                    map_name=map_name,
                    games_played=0,
                    win_rate=0.0,
                    attack_win_rate=0.0,
                    defense_win_rate=0.0,
                    avg_round_diff=0.0
                ))

        # Sort by win rate descending
        matrix.sort(key=lambda x: x.win_rate, reverse=True)
        return matrix

    def _get_demo_player_stats(self) -> List[PlayerStats]:
        """Return demo player stats for use when real player data is unavailable."""
        return [
            PlayerStats(name="aspas", top_agents=["Jett", "Raze", "Reyna"], impact="High", avg_acs=278.5, avg_kd=1.42, first_blood_rate=0.58, games_played=12),
            PlayerStats(name="Less", top_agents=["Sova", "Fade", "KAY/O"], impact="High", avg_acs=241.2, avg_kd=1.21, first_blood_rate=0.45, games_played=12),
            PlayerStats(name="cauanzin", top_agents=["Omen", "Astra", "Viper"], impact="Medium", avg_acs=198.7, avg_kd=1.05, first_blood_rate=0.38, games_played=12),
            PlayerStats(name="tuyz", top_agents=["Killjoy", "Cypher", "Chamber"], impact="Medium", avg_acs=185.3, avg_kd=0.98, first_blood_rate=0.32, games_played=12),
            PlayerStats(name="raafa", top_agents=["Breach", "Skye", "Gekko"], impact="Medium", avg_acs=172.1, avg_kd=0.95, first_blood_rate=0.28, games_played=10),
        ]

    def _generate_demo_report(self, team_id: str, team_name: str) -> ScoutReport:
        """Generate a demo report with realistic mock data for presentation.
        Demo now reuses the same generators used in real reports so that
        Veto Guide, Tactical Insights, and Map Pool always agree.
        """

        # Demo player stats
        player_stats = self._get_demo_player_stats()

        # Demo opponent map stats (their historical performance)
        map_stats = [
            MapStats(map_name="Haven", games_played=5, wins=4, losses=1, avg_rounds_won=13.2, avg_rounds_lost=8.4),
            MapStats(map_name="Split", games_played=4, wins=3, losses=1, avg_rounds_won=13.0, avg_rounds_lost=9.5),
            MapStats(map_name="Ascent", games_played=4, wins=3, losses=1, avg_rounds_won=13.5, avg_rounds_lost=10.0),
            MapStats(map_name="Bind", games_played=3, wins=1, losses=2, avg_rounds_won=10.3, avg_rounds_lost=13.0),
            # Make Lotus obviously strong to surface the BAN insight in demo
            MapStats(map_name="Lotus", games_played=3, wins=3, losses=0, avg_rounds_won=13.8, avg_rounds_lost=9.7),
        ]

        # Reuse the actual generators so all sections are consistent
        veto_recommendations = self._generate_veto_recommendations(map_stats)
        tactical_insights = self._generate_tactical_insights(
            self._aggregate_player_stats([]),  # empty player data for demo templates
            map_stats,
            []
        )
        map_pool_matrix = self._generate_map_pool_matrix(map_stats)

        summary = ReportSummary(
            primary_threat="aspas (Jett)",
            key_takeaway=f"{team_name} plays an aggressive duelist-focused style centered around aspas. Ban their best map and aim for their weak ones.",
            team_playstyle="Aggressive duelist-focused",
            recent_form="4W-1L in last 5"
        )

        return ScoutReport(
            team_id=team_id,
            team_name=team_name,
            summary=summary,
            recommended_bans=[m.map_name for m in map_stats if m.win_rate >= 0.7][:2],
            player_stats=player_stats,
            map_stats=map_stats,
            matches_analyzed=12,
            date_range="Jan 15 - Feb 1, 2025",
            veto_recommendations=veto_recommendations,
            tactical_insights=tactical_insights,
            map_pool_matrix=map_pool_matrix
        )

    # ==================== EXISTING METHODS ====================

    def _aggregate_player_stats(self, matches: List[Match]) -> Dict[str, Dict]:
        """Aggregate player statistics across all matches."""
        player_data = defaultdict(lambda: {
            'name': '',
            'games': 0,
            'total_kills': 0,
            'total_deaths': 0,
            'total_assists': 0,
            'total_acs': 0,
            'total_adr': 0,
            'total_first_bloods': 0,
            'total_first_deaths': 0,
            'agents': defaultdict(int),
            'agent_wins': defaultdict(int)
        })

        for match in matches:
            for player_stat in match.player_stats:
                pid = player_stat.player_id or player_stat.player_name
                data = player_data[pid]
                data['name'] = player_stat.player_name
                data['games'] += 1
                data['total_kills'] += player_stat.kills
                data['total_deaths'] += player_stat.deaths
                data['total_assists'] += player_stat.assists
                data['total_acs'] += player_stat.acs
                data['total_adr'] += player_stat.adr
                data['total_first_bloods'] += player_stat.first_bloods
                data['total_first_deaths'] += player_stat.first_deaths
                data['agents'][player_stat.agent] += 1
                if match.won:
                    data['agent_wins'][player_stat.agent] += 1

        return dict(player_data)

    def _analyze_map_performance(self, matches: List[Match]) -> List[MapStats]:
        """Analyze team performance by map."""
        map_data = defaultdict(lambda: {
            'games': 0, 'wins': 0, 'losses': 0,
            'rounds_won': 0, 'rounds_lost': 0
        })

        for match in matches:
            map_name = match.map_name or "Unknown"
            data = map_data[map_name]
            data['games'] += 1
            if match.won:
                data['wins'] += 1
            else:
                data['losses'] += 1
            data['rounds_won'] += match.team_score
            data['rounds_lost'] += match.opponent_score

        map_stats = []
        for map_name, data in map_data.items():
            if map_name == "Unknown":
                continue
            games = data['games']
            map_stats.append(MapStats(
                map_name=map_name,
                games_played=games,
                wins=data['wins'],
                losses=data['losses'],
                avg_rounds_won=data['rounds_won'] / max(games, 1),
                avg_rounds_lost=data['rounds_lost'] / max(games, 1)
            ))

        map_stats.sort(key=lambda m: m.win_rate, reverse=True)
        return map_stats

    def _identify_primary_threat(self, player_aggregates: Dict) -> Tuple[str, str]:
        """Identify the primary threat player."""
        if not player_aggregates:
            return "Unknown Threat", "insufficient data"

        scored_players = []
        for pid, data in player_aggregates.items():
            if data['games'] == 0:
                continue
            avg_acs = data['total_acs'] / data['games']
            avg_kd = data['total_kills'] / max(data['total_deaths'], 1)
            first_blood_rate = data['total_first_bloods'] / max(
                data['total_first_bloods'] + data['total_first_deaths'], 1
            )
            threat_score = (avg_acs / 300 * 0.4) + (avg_kd * 0.3) + (first_blood_rate * 0.3)
            top_agent = max(data['agents'].items(), key=lambda x: x[1])[0] if data['agents'] else "Unknown"
            scored_players.append({
                'name': data['name'], 'score': threat_score,
                'avg_acs': avg_acs, 'avg_kd': avg_kd, 'fb_rate': first_blood_rate,
                'top_agent': top_agent
            })

        if not scored_players:
            return "Unknown Threat", "no player data"

        scored_players.sort(key=lambda x: x['score'], reverse=True)
        top = scored_players[0]
        reason = "aggressive opener" if top['fb_rate'] > 0.6 else "high impact" if top['avg_acs'] > 250 else "key player"
        return f"{top['name']} ({top['top_agent']})", reason

    def _generate_player_stats(self, player_aggregates: Dict) -> List[PlayerStats]:
        """Generate player stat summaries."""
        players = []
        for pid, data in player_aggregates.items():
            if data['games'] == 0:
                continue
            avg_acs = data['total_acs'] / data['games']
            avg_kd = data['total_kills'] / max(data['total_deaths'], 1)
            fb_rate = data['total_first_bloods'] / max(data['total_first_bloods'] + data['total_first_deaths'], 1)
            impact = "High" if avg_acs >= 250 else "Medium" if avg_acs >= 200 else "Low"
            sorted_agents = sorted(data['agents'].items(), key=lambda x: x[1], reverse=True)
            top_agents = [a for a, _ in sorted_agents[:3]]
            players.append(PlayerStats(
                name=data['name'], top_agents=top_agents, impact=impact,
                avg_acs=avg_acs, avg_kd=avg_kd, first_blood_rate=fb_rate,
                games_played=data['games']
            ))
        players.sort(key=lambda p: p.avg_acs, reverse=True)
        return players

    def _get_recommended_bans(self, map_stats: List[MapStats], num_bans: int = 2) -> List[str]:
        """Get recommended map bans."""
        bans = []
        for ms in map_stats:
            if len(bans) >= num_bans:
                break
            if ms.games_played >= 2:
                bans.append(ms.map_name)
        while len(bans) < num_bans:
            bans.append("TBD")
        return bans

    def _calculate_recent_form(self, matches: List[Match]) -> str:
        """Calculate recent form string."""
        seen = set()
        results = []
        for m in matches:
            if m.series_id in seen:
                continue
            seen.add(m.series_id)
            results.append(m.won)
            if len(results) >= 5:
                break
        if not results:
            return "No recent data"
        w = sum(1 for r in results if r)
        return f"{w}W-{len(results)-w}L in last {len(results)}"

    def _analyze_playstyle(self, player_aggregates: Dict, matches: List[Match]) -> str:
        """Determine team playstyle."""
        duelists = {'Jett', 'Raze', 'Reyna', 'Phoenix', 'Yoru', 'Neon', 'Iso'}
        controllers = {'Omen', 'Brimstone', 'Viper', 'Astra', 'Harbor', 'Clove'}
        sentinels = {'Killjoy', 'Cypher', 'Sage', 'Chamber', 'Deadlock', 'Vyse'}

        d_count = c_count = s_count = 0
        total_fb = total_fd = 0

        for data in player_aggregates.values():
            for agent, count in data['agents'].items():
                if agent in duelists: d_count += count
                elif agent in controllers: c_count += count
                elif agent in sentinels: s_count += count
            total_fb += data['total_first_bloods']
            total_fd += data['total_first_deaths']

        fb_ratio = total_fb / max(total_fd, 1)

        if fb_ratio > 1.2 and d_count > c_count:
            return "Aggressive duelist-focused"
        elif s_count > d_count:
            return "Defensive utility-heavy"
        elif c_count > d_count:
            return "Methodical execute-style"
        elif fb_ratio > 1.1:
            return "Early aggression focused"
        return "Balanced approach"

    def _generate_key_takeaway(self, team_name: str, primary_threat: str, playstyle: str, bans: List[str]) -> str:
        """Generate key takeaway."""
        bans_str = " and ".join(bans[:2]) if bans else "their comfort maps"
        if "Aggressive" in playstyle:
            return f"{team_name} plays aggressively around {primary_threat}. Ban {bans_str} and force late-round engagements."
        elif "Defensive" in playstyle:
            return f"{team_name} relies on defensive setups. Ban {bans_str} and prepare fast executes."
        return f"{team_name} has a balanced approach with {primary_threat} as key threat. Ban {bans_str}."

    def _get_date_range(self, matches: List[Match]) -> str:
        """Get date range of matches."""
        dates = [m.match_date for m in matches if m.match_date]
        if not dates:
            return "Date range unavailable"
        min_d, max_d = min(dates), max(dates)
        if min_d.year == max_d.year:
            return f"{min_d.strftime('%b %d')} - {max_d.strftime('%b %d, %Y')}"
        return f"{min_d.strftime('%b %d, %Y')} - {max_d.strftime('%b %d, %Y')}"

    def _empty_report(self, team_id: str, team_name: str) -> ScoutReport:
        """Generate empty report - now redirects to demo report."""
        return self._generate_demo_report(team_id, team_name)
