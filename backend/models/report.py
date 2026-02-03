from dataclasses import dataclass, field
from typing import List, Optional, Dict


@dataclass
class PlayerStats:
    """Player statistics summary for the scouting report."""
    name: str
    top_agents: List[str]
    impact: str  # "High", "Medium", "Low"
    avg_acs: float = 0.0
    avg_kd: float = 0.0
    first_blood_rate: float = 0.0
    games_played: int = 0

    def to_dict(self) -> dict:
        return {
            'name': self.name,
            'top_agents': self.top_agents,
            'impact': self.impact,
            'avg_acs': round(self.avg_acs, 1),
            'avg_kd': round(self.avg_kd, 2),
            'first_blood_rate': round(self.first_blood_rate * 100, 1),
            'games_played': self.games_played
        }


@dataclass
class ReportSummary:
    """Summary section of the scouting report."""
    primary_threat: str
    key_takeaway: str
    team_playstyle: str = ""
    recent_form: str = ""  # e.g., "3W-2L in last 5"

    def to_dict(self) -> dict:
        return {
            'primary_threat': self.primary_threat,
            'key_takeaway': self.key_takeaway,
            'team_playstyle': self.team_playstyle,
            'recent_form': self.recent_form
        }


@dataclass
class MapStats:
    """Map-specific statistics."""
    map_name: str
    games_played: int
    wins: int
    losses: int
    avg_rounds_won: float = 0.0
    avg_rounds_lost: float = 0.0

    @property
    def win_rate(self) -> float:
        total = self.wins + self.losses
        return self.wins / max(total, 1)

    def to_dict(self) -> dict:
        return {
            'map_name': self.map_name,
            'games_played': self.games_played,
            'wins': self.wins,
            'losses': self.losses,
            'win_rate': round(self.win_rate * 100, 1),
            'avg_rounds_won': round(self.avg_rounds_won, 1),
            'avg_rounds_lost': round(self.avg_rounds_lost, 1)
        }


@dataclass
class VetoRecommendation:
    """Map veto recommendation with scoring."""
    map_name: str
    score: float  # Positive = pick, Negative = ban
    recommendation: str  # "MUST_PICK", "PICK", "NEUTRAL", "BAN", "MUST_BAN"
    our_win_rate: float = 0.0
    their_win_rate: float = 0.0
    reason: str = ""

    def to_dict(self) -> dict:
        return {
            'map_name': self.map_name,
            'score': round(self.score, 2),
            'recommendation': self.recommendation,
            'our_win_rate': round(self.our_win_rate * 100, 1),
            'their_win_rate': round(self.their_win_rate * 100, 1),
            'reason': self.reason
        }


@dataclass
class TacticalInsight:
    """A tactical insight/tip based on stats analysis."""
    category: str  # "PISTOL", "ECO", "ATTACK", "DEFENSE", "CLUTCH", etc.
    title: str
    description: str
    severity: str = "INFO"  # "WARNING", "INFO", "TIP"
    icon: str = ""  # emoji or icon name

    def to_dict(self) -> dict:
        return {
            'category': self.category,
            'title': self.title,
            'description': self.description,
            'severity': self.severity,
            'icon': self.icon
        }


@dataclass
class MapPoolEntry:
    """Enhanced map stats for the map pool matrix."""
    map_name: str
    games_played: int = 0
    win_rate: float = 0.0
    attack_win_rate: float = 0.0
    defense_win_rate: float = 0.0
    avg_round_diff: float = 0.0  # positive = winning by X rounds on avg

    def to_dict(self) -> dict:
        return {
            'map_name': self.map_name,
            'games_played': self.games_played,
            'win_rate': round(self.win_rate * 100, 1),
            'attack_win_rate': round(self.attack_win_rate * 100, 1),
            'defense_win_rate': round(self.defense_win_rate * 100, 1),
            'avg_round_diff': round(self.avg_round_diff, 1)
        }


@dataclass
class PlayerBehaviorProfile:
    """Detailed behavior profile for a player."""
    name: str
    primary_role: str  # "Duelist", "Controller", "Sentinel", "Initiator"
    secondary_role: str = ""
    aggression_score: float = 50.0  # 0-100, higher = more aggressive
    consistency_score: float = 50.0  # 0-100, higher = more consistent
    impact_rating: float = 50.0  # 0-100, overall impact
    playstyle_tags: List[str] = field(default_factory=list)  # ["Entry Fragger", "Lurker", "Anchor", etc.]
    agent_pool: List[str] = field(default_factory=list)
    preferred_site: str = ""  # "A", "B", "C", "Flex" - inferred from agent
    round_presence: str = ""  # "Early", "Mid", "Late" - when they tend to have impact

    def to_dict(self) -> dict:
        return {
            'name': self.name,
            'primary_role': self.primary_role,
            'secondary_role': self.secondary_role,
            'aggression_score': round(self.aggression_score, 1),
            'consistency_score': round(self.consistency_score, 1),
            'impact_rating': round(self.impact_rating, 1),
            'playstyle_tags': self.playstyle_tags,
            'agent_pool': self.agent_pool,
            'preferred_site': self.preferred_site,
            'round_presence': self.round_presence
        }


@dataclass
class TeamComposition:
    """Team composition analysis."""
    primary_comp: List[str]  # Most used agent comp
    comp_frequency: float  # How often they run this comp (0-1)
    role_distribution: dict  # {"Duelist": 1.2, "Controller": 1.0, ...} - avg per game
    flex_players: List[str]  # Players who switch roles often
    one_tricks: List[str]  # Players who rarely switch agents
    aggression_style: str  # "Aggressive", "Balanced", "Passive"
    execute_style: str  # "Fast", "Default", "Slow" - inferred from agent picks

    def to_dict(self) -> dict:
        return {
            'primary_comp': self.primary_comp,
            'comp_frequency': round(self.comp_frequency * 100, 1),
            'role_distribution': {k: round(v, 2) for k, v in self.role_distribution.items()},
            'flex_players': self.flex_players,
            'one_tricks': self.one_tricks,
            'aggression_style': self.aggression_style,
            'execute_style': self.execute_style
        }


@dataclass
class EconomyTendency:
    """Economy and buy round tendencies."""
    force_buy_frequency: str  # "Often", "Sometimes", "Rarely"
    eco_discipline: str  # "Disciplined", "Mixed", "Chaotic"
    save_round_effectiveness: str  # "Strong", "Average", "Weak"
    post_plant_focus: str  # "High", "Medium", "Low" - inferred from sentinel picks

    def to_dict(self) -> dict:
        return {
            'force_buy_frequency': self.force_buy_frequency,
            'eco_discipline': self.eco_discipline,
            'save_round_effectiveness': self.save_round_effectiveness,
            'post_plant_focus': self.post_plant_focus
        }


@dataclass
class ScoutReport:
    """The complete scouting report."""
    team_id: str
    team_name: str
    summary: ReportSummary
    recommended_bans: List[str]
    player_stats: List[PlayerStats]
    map_stats: List[MapStats] = field(default_factory=list)
    matches_analyzed: int = 0
    date_range: str = ""  # e.g., "Jan 15 - Feb 1, 2025"
    # New fields for enhanced features
    veto_recommendations: List[VetoRecommendation] = field(default_factory=list)
    tactical_insights: List[TacticalInsight] = field(default_factory=list)
    map_pool_matrix: List[MapPoolEntry] = field(default_factory=list)
    # Player behavior analytics
    player_behavior_profiles: List[PlayerBehaviorProfile] = field(default_factory=list)
    team_composition: Optional[TeamComposition] = None
    economy_tendency: Optional[EconomyTendency] = None

    def to_dict(self) -> dict:
        return {
            'team_id': self.team_id,
            'team_name': self.team_name,
            'summary': self.summary.to_dict(),
            'recommended_bans': self.recommended_bans,
            'player_stats': [p.to_dict() for p in self.player_stats],
            'map_stats': [m.to_dict() for m in self.map_stats],
            'matches_analyzed': self.matches_analyzed,
            'date_range': self.date_range,
            'veto_recommendations': [v.to_dict() for v in self.veto_recommendations],
            'tactical_insights': [t.to_dict() for t in self.tactical_insights],
            'map_pool_matrix': [m.to_dict() for m in self.map_pool_matrix],
            'player_behavior_profiles': [p.to_dict() for p in self.player_behavior_profiles],
            'team_composition': self.team_composition.to_dict() if self.team_composition else None,
            'economy_tendency': self.economy_tendency.to_dict() if self.economy_tendency else None
        }
