# C9 Scouting Generator (VALORANT)

Our submission for Category 2 of the Cloud9 x JetBrains Hackathon.

## Features
- **Opinionated One-Pager:** No complex filters, just immediate coaching insights.
- **Primary Threat Detection:** Automatically identifies the key player and strategy to watch out for.
- **Recommended Bans:** Suggested map/agent bans based on win rates and performance deltas.
- **Coach Mode:** High-contrast, printable view for professional use on stage.

## Tech Stack
- **Backend:** Python Flask
- **Frontend:** React + Tailwind CSS
- **Data Source:** GRID API (Official Data Provider)

## Getting Started

### Prerequisites
- Python 3.x
- Node.js & npm
- GRID API Key

### Backend Setup
1. `cd backend`
2. `python3 -m venv venv`
3. `source venv/bin/activate`
4. `pip install -r requirements.txt`
5. Create a `.env` file in the root directory and add:
   ```
   GRID_API_KEY=your_key_here
   ```
6. `python app.py` (Runs on port 5001)

### Frontend Setup
1. `cd frontend`
2. `npm install`
3. `npm start` (Runs on port 3000)

## GRID API Integration
The tool uses GRID's VALORANT series and match data to aggregate player performance and spatial positioning. The analysis engine focuses on "Opinionated" conclusions rather than raw data tables, as preferred by competitive coaches.
# vetobrain
