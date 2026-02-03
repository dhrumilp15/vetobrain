import os
import logging
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv

from services.grid_service import GridService
from services.analysis_service import AnalysisService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

load_dotenv()

app = Flask(__name__)
CORS(app)

GRID_API_KEY = os.getenv("GRID_API_KEY")

# Initialize services
grid_service = GridService(GRID_API_KEY) if GRID_API_KEY else None
analysis_service = AnalysisService()


def validate_api_key():
    """Check if API key is configured."""
    if not GRID_API_KEY:
        return False, {"error": "GRID API key not configured", "code": "MISSING_API_KEY"}
    return True, None


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        "status": "healthy",
        "api_key_configured": bool(GRID_API_KEY),
        "version": "2.0.0"
    })


@app.route('/api/titles', methods=['GET'])
def get_titles():
    """
    Get available game titles from GRID API.
    Useful for discovering correct title IDs.
    """
    valid, error = validate_api_key()
    if not valid:
        return jsonify(error), 500

    try:
        titles = grid_service.get_titles()
        return jsonify({
            "titles": titles,
            "count": len(titles)
        })
    except Exception as e:
        logger.error(f"Get titles failed: {e}")
        return jsonify({"error": "Failed to get titles", "code": "GET_FAILED"}), 500


@app.route('/api/teams', methods=['GET'])
def search_teams():
    """
    Search for teams by name.

    Query params:
        search: Team name to search for (required)
        game: Optional game/title ID filter

    Returns:
        List of matching teams with IDs
    """
    valid, error = validate_api_key()
    if not valid:
        return jsonify(error), 500

    search_term = request.args.get('search', '').strip()
    if not search_term:
        return jsonify({"error": "Search term is required", "code": "MISSING_SEARCH"}), 400

    if len(search_term) < 2:
        return jsonify({"error": "Search term must be at least 2 characters", "code": "INVALID_SEARCH"}), 400

    # Optional game filter - don't default to anything
    game = request.args.get('game')

    try:
        teams = grid_service.search_teams(search_term, game)
        return jsonify({
            "teams": [t.to_dict() for t in teams],
            "count": len(teams)
        })
    except Exception as e:
        logger.error(f"Team search failed: {e}")
        return jsonify({"error": "Failed to search teams", "code": "SEARCH_FAILED"}), 500


@app.route('/api/teams/<team_id>', methods=['GET'])
def get_team(team_id: str):
    """
    Get a team by ID.

    Path params:
        team_id: GRID team ID

    Returns:
        Team details
    """
    valid, error = validate_api_key()
    if not valid:
        return jsonify(error), 500

    try:
        team = grid_service.get_team_by_id(team_id)
        if not team:
            return jsonify({"error": "Team not found", "code": "NOT_FOUND"}), 404
        return jsonify(team.to_dict())
    except Exception as e:
        logger.error(f"Get team failed: {e}")
        return jsonify({"error": "Failed to get team", "code": "GET_FAILED"}), 500


@app.route('/api/teams/<team_id>/matches', methods=['GET'])
def get_team_matches(team_id: str):
    """
    Get recent matches for a team.

    Path params:
        team_id: GRID team ID

    Query params:
        limit: Number of matches to return (default: 10, max: 20)

    Returns:
        List of matches with player stats
    """
    valid, error = validate_api_key()
    if not valid:
        return jsonify(error), 500

    limit = min(int(request.args.get('limit', 10)), 20)

    try:
        matches = grid_service.get_matches_with_stats(team_id, limit)
        return jsonify({
            "matches": [m.to_dict() for m in matches],
            "count": len(matches)
        })
    except Exception as e:
        logger.error(f"Get matches failed: {e}")
        return jsonify({"error": "Failed to get matches", "code": "GET_FAILED"}), 500


@app.route('/api/scout', methods=['POST'])
def scout_team():
    """
    Generate a scouting report for a team.

    Request body:
        team_id: GRID team ID (required if team_name not provided)
        team_name: Team name to search for (required if team_id not provided)
        match_count: Number of matches to analyze (default: 10, max: 20)

    Returns:
        Comprehensive scouting report
    """
    valid, error = validate_api_key()
    if not valid:
        return jsonify(error), 500

    data = request.json or {}
    team_id = data.get('team_id')
    team_name = data.get('team_name', '').strip()
    match_count = min(int(data.get('match_count', 10)), 20)

    # Validate input
    if not team_id and not team_name:
        return jsonify({
            "error": "Either team_id or team_name is required",
            "code": "MISSING_TEAM"
        }), 400

    try:
        # If only team_name provided, search for the team first
        if not team_id:
            teams = grid_service.search_teams(team_name)
            if not teams:
                return jsonify({
                    "error": f"No team found matching '{team_name}'",
                    "code": "TEAM_NOT_FOUND"
                }), 404

            # Use the first matching team
            team = teams[0]
            team_id = team.id
            team_name = team.name
        else:
            # Get team details by ID
            team = grid_service.get_team_by_id(team_id)
            if not team:
                return jsonify({
                    "error": f"Team with ID '{team_id}' not found",
                    "code": "TEAM_NOT_FOUND"
                }), 404
            team_name = team.name

        # Fetch matches with stats
        logger.info(f"Fetching matches for team: {team_name} ({team_id})")
        matches = grid_service.get_matches_with_stats(team_id, match_count)

        if not matches:
            logger.warning(f"No matches found for team: {team_name}")

        # Generate the scouting report
        logger.info(f"Generating report from {len(matches)} matches")
        report = analysis_service.generate_scout_report(team_id, team_name, matches)

        return jsonify(report.to_dict())

    except Exception as e:
        logger.error(f"Scout report generation failed: {e}", exc_info=True)
        return jsonify({
            "error": "Failed to generate scouting report",
            "code": "REPORT_FAILED",
            "details": str(e)
        }), 500


@app.route('/api/scout/compare', methods=['POST'])
def compare_teams():
    """
    Generate a head-to-head comparison between two teams.

    Request body:
        your_team_id: Your team's GRID ID
        opponent_team_id: Opponent team's GRID ID
        match_count: Number of matches to analyze per team (default: 10)

    Returns:
        Comparison report highlighting advantages and matchup insights
    """
    valid, error = validate_api_key()
    if not valid:
        return jsonify(error), 500

    data = request.json or {}
    your_team_id = data.get('your_team_id')
    opponent_team_id = data.get('opponent_team_id')
    match_count = min(int(data.get('match_count', 10)), 20)

    if not your_team_id or not opponent_team_id:
        return jsonify({
            "error": "Both your_team_id and opponent_team_id are required",
            "code": "MISSING_TEAMS"
        }), 400

    try:
        # Get both teams' data
        your_team = grid_service.get_team_by_id(your_team_id)
        opponent_team = grid_service.get_team_by_id(opponent_team_id)

        if not your_team or not opponent_team:
            return jsonify({
                "error": "One or both teams not found",
                "code": "TEAM_NOT_FOUND"
            }), 404

        # Get matches for both teams
        your_matches = grid_service.get_matches_with_stats(your_team_id, match_count)
        opponent_matches = grid_service.get_matches_with_stats(opponent_team_id, match_count)

        # Generate reports for both
        your_report = analysis_service.generate_scout_report(
            your_team_id, your_team.name, your_matches
        )
        opponent_report = analysis_service.generate_scout_report(
            opponent_team_id, opponent_team.name, opponent_matches
        )

        # Find map advantages
        your_maps = {m.map_name: m for m in your_report.map_stats}
        opponent_maps = {m.map_name: m for m in opponent_report.map_stats}

        map_advantages = []
        for map_name in set(your_maps.keys()) | set(opponent_maps.keys()):
            your_wr = your_maps.get(map_name, MapStats(map_name, 0, 0, 0)).win_rate if map_name in your_maps else 0
            opp_wr = opponent_maps.get(map_name, MapStats(map_name, 0, 0, 0)).win_rate if map_name in opponent_maps else 0

            if your_wr > opp_wr + 0.1:
                advantage = "yours"
            elif opp_wr > your_wr + 0.1:
                advantage = "opponent"
            else:
                advantage = "neutral"

            map_advantages.append({
                "map": map_name,
                "your_win_rate": round(your_wr * 100, 1),
                "opponent_win_rate": round(opp_wr * 100, 1),
                "advantage": advantage
            })

        return jsonify({
            "your_team": your_report.to_dict(),
            "opponent": opponent_report.to_dict(),
            "map_advantages": map_advantages,
            "recommendation": _generate_h2h_recommendation(your_report, opponent_report, map_advantages)
        })

    except Exception as e:
        logger.error(f"Comparison failed: {e}", exc_info=True)
        return jsonify({
            "error": "Failed to generate comparison",
            "code": "COMPARE_FAILED",
            "details": str(e)
        }), 500


def _generate_h2h_recommendation(your_report, opponent_report, map_advantages) -> str:
    """Generate a head-to-head recommendation string."""
    # Find maps to pick (your advantage)
    picks = [m['map'] for m in map_advantages if m['advantage'] == 'yours']
    # Find maps to ban (opponent advantage)
    bans = [m['map'] for m in map_advantages if m['advantage'] == 'opponent']

    rec_parts = []
    if picks:
        rec_parts.append(f"Pick: {', '.join(picks[:2])}")
    if bans:
        rec_parts.append(f"Ban: {', '.join(bans[:2])}")

    threat = opponent_report.summary.primary_threat
    rec_parts.append(f"Key threat to neutralize: {threat}")

    return " | ".join(rec_parts)


# Import MapStats for the comparison endpoint
from models.report import MapStats


@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Endpoint not found", "code": "NOT_FOUND"}), 404


@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal server error", "code": "SERVER_ERROR"}), 500


if __name__ == '__main__':
    if not GRID_API_KEY:
        logger.warning("GRID_API_KEY not set - API calls will fail")
    app.run(debug=True, port=5001)
