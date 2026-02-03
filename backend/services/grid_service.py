import requests
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime

from models.team import Team
from models.match import Match, PlayerMatchStats
from utils.cache import team_cache, match_cache, series_cache

logger = logging.getLogger(__name__)


class GridService:
    """
    GRID API client for fetching VALORANT esports data.

    GRID uses a two-endpoint architecture:
    1. Central Data API - Team metadata, tournament info, series IDs
    2. Live Data Feed / Series State API - Detailed match statistics
    """

    CENTRAL_DATA_URL = "https://api-op.grid.gg/central-data/graphql"
    SERIES_STATE_URL = "https://api-op.grid.gg/live-data-feed/series-state/graphql"

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.headers = {
            "Content-Type": "application/json",
            "x-api-key": api_key
        }

    def _execute_query(self, url: str, query: str, variables: Dict = None) -> Dict[str, Any]:
        """Execute a GraphQL query against the specified endpoint."""
        payload = {"query": query}
        if variables:
            payload["variables"] = variables

        try:
            response = requests.post(url, json=payload, headers=self.headers, timeout=30)
            response.raise_for_status()
            result = response.json()

            if "errors" in result:
                logger.error(f"GraphQL errors: {result['errors']}")
                # If we have partial data, return it anyway
                if "data" in result and result["data"]:
                    logger.warning("Returning partial data despite errors")
                    return result.get("data", {})
                raise Exception(f"GraphQL error: {result['errors'][0].get('message', 'Unknown error')}")

            return result.get("data", {})
        except requests.exceptions.RequestException as e:
            logger.error(f"Request failed: {e}")
            raise

    def get_titles(self) -> List[Dict]:
        """Discover available game titles and their IDs from GRID API."""
        cache_key = "titles"
        cached = team_cache.get(cache_key)
        if cached:
            return cached

        query = """
        query GetTitles {
            titles {
                edges {
                    node {
                        id
                        name
                    }
                }
            }
        }
        """
        try:
            data = self._execute_query(self.CENTRAL_DATA_URL, query)
            edges = data.get("titles", {}).get("edges", [])
            titles = [edge["node"] for edge in edges if edge.get("node")]
            logger.info(f"Available titles: {titles}")
            team_cache.set(cache_key, titles, ttl_seconds=86400)
            return titles
        except Exception as e:
            logger.error(f"Failed to get titles: {e}")
            return []

    def search_teams(self, search_term: str, game: str = None) -> List[Team]:
        """
        Search for teams by name.

        Args:
            search_term: Partial or full team name to search for
            game: Optional game/title ID filter

        Returns:
            List of matching Team objects
        """
        cache_key = f"team_search:{search_term.lower()}:{game or 'all'}"
        cached = team_cache.get(cache_key)
        if cached:
            return cached

        # Build filter - only include titleId if provided and valid
        filter_obj = {"name": {"contains": search_term}}
        if game:
            filter_obj["titleId"] = game

        query = """
        query SearchTeams($filter: TeamFilter, $first: Int) {
            teams(filter: $filter, first: $first) {
                edges {
                    node {
                        id
                        name
                    }
                }
            }
        }
        """
        variables = {
            "filter": filter_obj,
            "first": 20
        }

        try:
            data = self._execute_query(self.CENTRAL_DATA_URL, query, variables)
            logger.info(f"Team search response: {data}")
            edges = data.get("teams", {}).get("edges", [])
            teams = [Team.from_grid_response(edge["node"]) for edge in edges]
            logger.info(f"Found {len(teams)} teams for search '{search_term}'")
            team_cache.set(cache_key, teams)
            return teams
        except Exception as e:
            logger.error(f"Failed to search teams: {e}")
            return []

    def get_team_by_id(self, team_id: str) -> Optional[Team]:
        """Get a team by its GRID ID."""
        cache_key = f"team:{team_id}"
        cached = team_cache.get(cache_key)
        if cached:
            return cached

        query = """
        query GetTeam($id: ID!) {
            team(id: $id) {
                id
                name
            }
        }
        """
        variables = {"id": team_id}

        try:
            data = self._execute_query(self.CENTRAL_DATA_URL, query, variables)
            if data.get("team"):
                team = Team.from_grid_response(data["team"])
                team_cache.set(cache_key, team)
                return team
            return None
        except Exception as e:
            logger.error(f"Failed to get team: {e}")
            return None

    def get_recent_series(self, team_id: str, limit: int = 10) -> List[Dict]:
        """
        Get recent series/matches for a team.

        Args:
            team_id: GRID team ID
            limit: Maximum number of series to return

        Returns:
            List of series metadata with IDs
        """
        cache_key = f"series:{team_id}:{limit}"
        cached = match_cache.get(cache_key)
        if cached:
            return cached

        # Simplified query - start minimal and expand based on what works
        query = """
        query GetTeamSeries($filter: SeriesFilter, $first: Int) {
            allSeries(filter: $filter, first: $first) {
                edges {
                    node {
                        id
                        startTimeScheduled
                        format {
                            name
                        }
                        tournament {
                            name
                        }
                        teams {
                            baseInfo {
                                id
                                name
                            }
                        }
                    }
                }
            }
        }
        """
        variables = {
            "filter": {
                "teamIds": {"in": [team_id]},
                "type": "ESPORTS"
            },
            "first": limit
        }

        try:
            data = self._execute_query(self.CENTRAL_DATA_URL, query, variables)
            logger.info(f"Series query response: {data}")
            edges = data.get("allSeries", {}).get("edges", [])
            series_list = [edge["node"] for edge in edges if edge.get("node")]
            logger.info(f"Found {len(series_list)} series for team {team_id}")
            match_cache.set(cache_key, series_list)
            return series_list
        except Exception as e:
            logger.error(f"Failed to get series: {e}")
            return []

    def get_series_state(self, series_id: str) -> Optional[Dict]:
        """
        Get detailed series state including player statistics.

        Args:
            series_id: GRID series ID

        Returns:
            Detailed series state with player stats
        """
        cache_key = f"series_state:{series_id}"
        cached = series_cache.get(cache_key)
        if cached:
            return cached

        # Start with a simpler query and expand once we know the schema
        query = """
        query GetSeriesState($id: ID!) {
            seriesState(id: $id) {
                id
                finished
                games {
                    id
                    sequenceNumber
                    map {
                        name
                    }
                    teams {
                        id
                        name
                        score
                        won
                        players {
                            id
                            name
                            character {
                                name
                            }
                        }
                    }
                }
            }
        }
        """
        variables = {"id": series_id}

        try:
            data = self._execute_query(self.SERIES_STATE_URL, query, variables)
            logger.info(f"Series state response for {series_id}: {data}")
            series_state = data.get("seriesState")
            if series_state:
                series_cache.set(cache_key, series_state)
                logger.info(f"Got series state with {len(series_state.get('games', []))} games")
            else:
                logger.warning(f"No series state data for {series_id}")
            return series_state
        except Exception as e:
            logger.error(f"Failed to get series state: {e}")
            return None

    def get_matches_with_stats(self, team_id: str, limit: int = 10) -> List[Match]:
        """
        Get matches with full player statistics for a team.

        This combines data from both Central Data API (for series metadata)
        and Series State API (for detailed stats).

        Args:
            team_id: GRID team ID
            limit: Maximum number of matches to return

        Returns:
            List of Match objects with player statistics
        """
        matches = []
        series_list = self.get_recent_series(team_id, limit)
        logger.info(f"Processing {len(series_list)} series for team {team_id}")

        for series in series_list:
            series_id = series.get("id")
            if not series_id:
                continue

            # Get detailed stats from series state
            series_state = self.get_series_state(series_id)

            # Parse match date
            match_date = None
            if series.get("startTimeScheduled"):
                try:
                    match_date = datetime.fromisoformat(
                        series["startTimeScheduled"].replace("Z", "+00:00")
                    )
                except (ValueError, TypeError):
                    pass

            # Determine opponent
            teams = series.get("teams", [])
            team_info = None
            opponent_info = None
            for t in teams:
                base_info = t.get("baseInfo", {})
                if base_info.get("id") == team_id:
                    team_info = t
                else:
                    opponent_info = t

            # Process each game/map in the series
            games = series_state.get("games", []) if series_state else series.get("games", [])

            for game in games:
                map_name = game.get("map", {}).get("name", "Unknown")

                # Find team scores for this game
                game_teams = game.get("teams", [])
                team_score = 0
                opponent_score = 0
                won = False
                player_stats = []

                for gt in game_teams:
                    gt_id = gt.get("id") or gt.get("baseInfo", {}).get("id")

                    if gt_id == team_id:
                        team_score = gt.get("score", 0)
                        won = gt.get("won", False)

                        # Extract player stats from series state
                        for player in gt.get("players", []):
                            stats = self._parse_player_stats(player, game)
                            if stats:
                                player_stats.append(stats)
                    else:
                        opponent_score = gt.get("score", 0)

                match = Match(
                    series_id=series_id,
                    match_date=match_date,
                    map_name=map_name,
                    team_id=team_id,
                    team_name=team_info.get("baseInfo", {}).get("name", "") if team_info else "",
                    opponent_id=opponent_info.get("baseInfo", {}).get("id", "") if opponent_info else "",
                    opponent_name=opponent_info.get("baseInfo", {}).get("name", "") if opponent_info else "",
                    team_score=team_score,
                    opponent_score=opponent_score,
                    won=won,
                    tournament_name=series.get("tournament", {}).get("name", ""),
                    player_stats=player_stats
                )
                matches.append(match)

        return matches

    def _parse_player_stats(self, player_data: Dict, game_data: Dict) -> Optional[PlayerMatchStats]:
        """Parse player statistics from series state data."""
        try:
            player_id = player_data.get("id", "")
            player_name = player_data.get("name", "Unknown")
            agent = player_data.get("character", {}).get("name", "Unknown") if player_data.get("character") else "Unknown"

            # Try to get detailed stats if available
            stats_by_round = player_data.get("statsByRound", [])
            if stats_by_round:
                total_kills = sum(s.get("kills", 0) for s in stats_by_round)
                total_deaths = sum(s.get("deaths", 0) for s in stats_by_round)
                total_assists = sum(s.get("assists", 0) for s in stats_by_round)
                total_damage = sum(s.get("damage", 0) for s in stats_by_round)
                total_combat_score = sum(s.get("combatScore", 0) for s in stats_by_round)
                num_rounds = len(stats_by_round)
            else:
                # Fallback to direct stats if available
                total_kills = player_data.get("kills", 0) if isinstance(player_data.get("kills"), int) else 0
                total_deaths = player_data.get("deaths", 0) if isinstance(player_data.get("deaths"), int) else 0
                total_assists = player_data.get("assists", 0) if isinstance(player_data.get("assists"), int) else 0
                total_damage = 0
                total_combat_score = 0
                num_rounds = 1

            # First bloods and deaths (if detailed data available)
            kills_list = player_data.get("kills", []) if isinstance(player_data.get("kills"), list) else []
            deaths_list = player_data.get("deaths", []) if isinstance(player_data.get("deaths"), list) else []
            first_bloods = sum(1 for k in kills_list if isinstance(k, dict) and k.get("isFirstBlood"))
            first_deaths = sum(1 for d in deaths_list if isinstance(d, dict) and d.get("isFirstDeath"))
            headshots = sum(1 for k in kills_list if isinstance(k, dict) and k.get("isHeadshot"))

            # Plants and defuses
            plants = len(player_data.get("plants", [])) if isinstance(player_data.get("plants"), list) else 0
            defuses = len(player_data.get("defuses", [])) if isinstance(player_data.get("defuses"), list) else 0

            # Calculate averages
            acs = total_combat_score / num_rounds if num_rounds > 0 else 0
            adr = total_damage / num_rounds if num_rounds > 0 else 0
            hs_pct = (headshots / total_kills * 100) if total_kills > 0 else 0

            logger.debug(f"Parsed player {player_name}: agent={agent}, kills={total_kills}")

            return PlayerMatchStats(
                player_id=player_id,
                player_name=player_name,
                agent=agent,
                kills=total_kills,
                deaths=total_deaths,
                assists=total_assists,
                acs=acs,
                adr=adr,
                first_bloods=first_bloods,
                first_deaths=first_deaths,
                plants=plants,
                defuses=defuses,
                headshot_pct=hs_pct
            )
        except Exception as e:
            logger.error(f"Failed to parse player stats: {e}")
            return None
