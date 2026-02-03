from dataclasses import dataclass
from typing import Optional


@dataclass
class Team:
    """Represents a VALORANT team from GRID API."""
    id: str
    name: str
    abbreviation: Optional[str] = None
    logo_url: Optional[str] = None
    region: Optional[str] = None

    @classmethod
    def from_grid_response(cls, data: dict) -> 'Team':
        """Create a Team from GRID API response."""
        return cls(
            id=data.get('id', ''),
            name=data.get('name', ''),
            abbreviation=data.get('abbreviation'),
            logo_url=data.get('logoUrl'),
            region=data.get('region')
        )

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'name': self.name,
            'abbreviation': self.abbreviation,
            'logo_url': self.logo_url,
            'region': self.region
        }
