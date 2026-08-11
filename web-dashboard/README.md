# Trading Bot Web Dashboard

Real-time web dashboard for visualizing the trading bot's environment, including live price data, orderbook delta analysis, and position history.

## Features

- **Real-time Price Charts**: Live price updates from Binance API
- **Orderbook Delta Visualization**: Track bid-ask volume imbalances
- **Volume Comparison**: Side-by-side bid vs ask volume charts
- **Position History**: View recent trading positions
- **Bot Configuration**: Display current bot settings
- **WebSocket Updates**: Live data streaming without page refresh

## Architecture

- **Backend**: Node.js + Express with WebSocket support
- **Frontend**: React + Vite with Tailwind CSS
- **Charts**: Recharts for data visualization
- **Data Source**: Binance API + bot's positions.csv and settings.json

## Setup Instructions

### Prerequisites

- Node.js 16+
- npm or yarn

### Backend Setup

1. Navigate to the web-backend directory:
```bash
cd web-backend
```

2. Install Node.js dependencies:
```bash
npm install
```

3. Start the backend server:
```bash
npm start
```

The backend will start on `http://localhost:8080`

### Frontend Setup

1. Navigate to the web-frontend directory:
```bash
cd web-frontend
```

2. Install Node.js dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend will start on `http://localhost:3000`

## Running the Complete System

1. **Start the trading bot** (in the main trading-bot directory):
```bash
cd ..
cargo run
```

2. **Start the backend** (in a new terminal):
```bash
cd web-backend
npm start
```

3. **Start the frontend** (in another terminal):
```bash
cd web-frontend
npm run dev
```

4. Open your browser to `http://localhost:3000`

## API Endpoints

- `GET /api/positions` - Get historical positions from positions.csv
- `GET /api/settings` - Get bot configuration from settings.json
- `GET /api/market-data/{symbol}` - Get current market data from Binance
- `WS /ws` - WebSocket endpoint for real-time updates (ws://localhost:8080)

## Dashboard Components

### Market Overview Cards
- Current Price
- Bid-Ask Delta
- Total Bid Volume
- Total Ask Volume

### Charts
- **Price History**: Area chart showing price over time
- **Orderbook Delta**: Line chart tracking bid-ask volume differences
- **Bid vs Ask Volume**: Bar chart comparing bid and ask volumes

### Data Tables
- **Recent Positions**: Table showing recent trading positions with time, price, size, and side

### Configuration Display
- Market name
- Bollinger Band period and standard deviation
- Orderbook depth
- Sampling time
- Take profit and stop loss percentages
- Live trading status

## Data Flow

1. The trading bot writes positions to `positions.csv`
2. The backend reads `positions.csv` and `settings.json`
3. The backend fetches live market data from Binance API
4. The backend streams data via WebSocket to the frontend
5. The frontend updates charts and displays in real-time

## Customization

### Change Market Symbol
Edit `settings.json` in the main trading-bot directory to change the market symbol (e.g., "BTCUSDT", "ETHUSDT").

### Update Refresh Rate
Modify the `await asyncio.sleep(2)` line in `web-backend/main.py` to change the WebSocket update frequency.

### Add More Charts
The frontend uses Recharts. Add new chart components in `src/App.jsx` following the existing pattern.

## Troubleshooting

### Backend not starting
- Ensure Python 3.8+ is installed
- Check that all dependencies are installed: `pip install -r requirements.txt`
- Verify port 8000 is not in use

### Frontend not connecting to backend
- Ensure the backend is running on port 8000
- Check the Vite proxy configuration in `vite.config.js`
- Verify WebSocket connection in browser console

### No data displaying
- Ensure the trading bot is running and has generated data
- Check that `positions.csv` exists in the main trading-bot directory
- Verify `settings.json` exists and is properly formatted
- Check browser console for WebSocket connection errors

### Binance API errors
- The dashboard uses public Binance endpoints that don't require API keys
- If you see rate limiting errors, increase the sleep time in the backend
- Some regions may have Binance API restrictions

## Technology Stack

- **Backend**: FastAPI, Uvicorn, WebSockets, Pandas, Aiohttp
- **Frontend**: React 18, Vite, Tailwind CSS, Recharts, Lucide React
- **Data**: Binance API, CSV files
