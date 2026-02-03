from dataclasses import dataclass, field
from typing import Optional, List
from datetime import datetime


@dataclass
class PlayerMatchStats:
    """Player statistics for a single match/map."""
    player_id: str
    player_name: str
    agent: str
    kills: int = 0
    deaths: int = 0
    assists: int = 0
    acs: float = 0.0  # Average Combat Score
    adr: float = 0.0  # Average Damage per Round
    first_bloods: int = 0
    first_deaths: int = 0
    plants: int = 0
    defuses: int = 0
    clutches_won: int = 0
    clutches_played: int = 0
    headshot_pct: float = 0.0

    @property
    def kd_ratio(self) -> float:
        return self.kills / max(self.deaths, 1)

    @property
    def kda_ratio(self) -> float:
        return (self.kills + self.assists) / max(self.deaths, 1)

    @property
    def first_blood_rate(self) -> float:
        total = self.first_bloods + self.first_deaths
        return self.first_bloods / max(total, 1)

    def to_dict(self) -> dict:
        return {
            'player_id': self.player_id,
            'player_name': self.player_name,
            'agent': self.agent,
            'kills': self.kills,
            'deaths': self.deaths,
            'assists': self.assists,
            'acs': self.acs,
            'adr': self.adr,
            'first_bloods': self.first_bloods,
            'first_deaths': self.first_deaths,
            'kd_ratio': round(self.kd_ratio, 2),
            'kda_ratio': round(self.kda_ratio, 2),
            'first_blood_rate': round(self.first_blood_rate, 2),
            'headshot_pct': self.headshot_pct
        }


@dataclass
class Match:
    """Represents a VALORANT match/series from GRID API."""
    series_id: str
    match_date: Optional[datetime] = None
    map_name: str = ""
    team_id: str = ""
    team_name: str = ""
    opponent_id: str = ""
    opponent_name: str = ""
    team_score: int = 0
    opponent_score: int = 0
    won: bool = False
    tournament_name: str = ""
    player_stats: List[PlayerMatchStats] = field(default_factory=list)

    @property
    def total_rounds(self) -> int:
        return self.team_score + self.opponent_score

    def to_dict(self) -> dict:
        return {
            'series_id': self.series_id,
            'match_date': self.match_date.isoformat() if self.match_date else None,
            'map_name': self.map_name,
            'team_name': self.team_name,
            'opponent_name': self.opponent_name,
            'team_score': self.team_score,
            'opponent_score': self.opponent_score,
            'won': self.won,
            'tournament_name': self.tournament_name,
            'player_stats': [p.to_dict() for p in self.player_stats]
        }
