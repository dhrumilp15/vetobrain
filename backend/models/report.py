from dataclasses import dataclass, field
from typing import List, Optional


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
            'map_pool_matrix': [m.to_dict() for m in self.map_pool_matrix]
        }
