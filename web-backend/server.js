const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

const BOT_DIR = path.join(__dirname, '..');
const POSITIONS_FILE = path.join(BOT_DIR, 'positions.csv');
const SETTINGS_FILE = path.join(BOT_DIR, 'settings.json');

// Store active WebSocket connections
const clients = new Set();

// Store price history for technical indicators (per symbol)
const priceHistoryMap = new Map();
const MAX_HISTORY = 100;

// Multi-market support
const activeMarkets = new Set(['BTCUSDT']); // Default market
const marketDataMap = new Map();

// Alert system
const alerts = new Map(); // Store configured alerts
const alertHistory = []; // Store triggered alerts

// Technical indicator calculations
function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return null;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) {
      gains += change;
    } else {
      losses -= change;
    }
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateSMA(prices, period) {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b) / period;
}

function calculateEMA(prices, period) {
  if (prices.length < period) return null;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b) / period;
  
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  
  return ema;
}

function calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (prices.length < slowPeriod + signalPeriod) return null;
  
  const fastEMA = calculateEMA(prices, fastPeriod);
  const slowEMA = calculateEMA(prices, slowPeriod);
  const macdLine = fastEMA - slowEMA;
  
  // Calculate signal line (EMA of MACD line)
  const macdHistory = [];
  for (let i = slowPeriod; i < prices.length; i++) {
    const fast = calculateEMA(prices.slice(0, i + 1), fastPeriod);
    const slow = calculateEMA(prices.slice(0, i + 1), slowPeriod);
    macdHistory.push(fast - slow);
  }
  
  if (macdHistory.length < signalPeriod) return null;
  
  const signalLine = calculateEMA(macdHistory, signalPeriod);
  const histogram = macdLine - signalLine;
  
  return {
    macd: macdLine,
    signal: signalLine,
    histogram: histogram
  };
}

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('New WebSocket client connected');
  clients.add(ws);

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});

// Broadcast message to all connected clients
function broadcast(message) {
  const data = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(data);
      } catch (error) {
        console.error('Error sending to client:', error);
        clients.delete(client);
      }
    }
  });
}

// API endpoint to get positions
app.get('/api/positions', (req, res) => {
  const results = [];
  
  if (!fs.existsSync(POSITIONS_FILE)) {
    return res.json([]);
  }

  fs.createReadStream(POSITIONS_FILE)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () => {
      res.json(results);
    })
    .on('error', (error) => {
      console.error('Error reading CSV:', error);
      res.status(500).json({ error: 'Failed to read positions file' });
    });
});

// API endpoint to get portfolio performance
app.get('/api/portfolio', async (req, res) => {
  const results = [];
  
  if (!fs.existsSync(POSITIONS_FILE)) {
    return res.json({
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      totalPnL: 0,
      winRate: 0,
      averageWin: 0,
      averageLoss: 0,
      profitFactor: 0,
      trades: []
    });
  }

  try {
    // Get current market price for P&L calculation
    let currentPrice = 0;
    try {
      const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      const symbol = settings.market_name || 'BTCUSDT';
      const priceResponse = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
      currentPrice = parseFloat(priceResponse.data.price);
    } catch (error) {
      console.error('Error fetching current price:', error);
      // Use a default price if API fails
      currentPrice = 67000;
    }

    fs.createReadStream(POSITIONS_FILE)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        // Calculate portfolio metrics
        let totalPnL = 0;
        let winningTrades = 0;
        let losingTrades = 0;
        let totalWins = 0;
        let totalLosses = 0;
        
        const processedTrades = results.map(trade => {
          const entryPrice = parseFloat(trade.price);
          const size = parseFloat(trade.size);
          const side = trade.side.toLowerCase();
          
          // Calculate unrealized P&L based on current price
          // For buy positions: (current - entry) * size
          // For sell positions: (entry - current) * size
          let pnl;
          if (side === 'buy') {
            pnl = (currentPrice - entryPrice) * size;
          } else {
            pnl = (entryPrice - currentPrice) * size;
          }
          
          totalPnL += pnl;
          
          if (pnl > 0) {
            winningTrades++;
            totalWins += pnl;
          } else {
            losingTrades++;
            totalLosses += Math.abs(pnl);
          }
          
          return {
            ...trade,
            pnl: pnl,
            pnlPercent: (pnl / (size * entryPrice)) * 100,
            currentPrice: currentPrice
          };
        });
        
        const totalTrades = processedTrades.length;
        const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
        const averageWin = winningTrades > 0 ? totalWins / winningTrades : 0;
        const averageLoss = losingTrades > 0 ? totalLosses / losingTrades : 0;
        const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;
        
        res.json({
          totalTrades,
          winningTrades,
          losingTrades,
          totalPnL,
          winRate,
          averageWin,
          averageLoss,
          profitFactor: profitFactor === Infinity ? '∞' : profitFactor,
          currentPrice,
          trades: processedTrades.slice(-20)
        });
      })
      .on('error', (error) => {
        console.error('Error reading CSV:', error);
        res.status(500).json({ error: 'Failed to read positions file' });
      });
  } catch (error) {
    console.error('Error in portfolio calculation:', error);
    res.status(500).json({ error: 'Failed to calculate portfolio' });
  }
});

// API endpoint to get settings
app.get('/api/settings', (req, res) => {
  if (!fs.existsSync(SETTINGS_FILE)) {
    return res.status(404).json({ error: 'Settings file not found' });
  }

  try {
    const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    res.json(settings);
  } catch (error) {
    console.error('Error reading settings:', error);
    res.status(500).json({ error: 'Failed to read settings file' });
  }
});

// Multi-market API endpoints
app.get('/api/markets', (req, res) => {
  res.json({
    activeMarkets: Array.from(activeMarkets),
    marketData: Array.from(marketDataMap.entries()).map(([symbol, data]) => ({
      symbol,
      ...data
    }))
  });
});

app.post('/api/markets', (req, res) => {
  const { symbol, action } = req.body;
  
  if (action === 'add') {
    activeMarkets.add(symbol);
    res.json({ message: `Market ${symbol} added`, activeMarkets: Array.from(activeMarkets) });
  } else if (action === 'remove') {
    activeMarkets.delete(symbol);
    marketDataMap.delete(symbol);
    priceHistoryMap.delete(symbol);
    res.json({ message: `Market ${symbol} removed`, activeMarkets: Array.from(activeMarkets) });
  } else {
    res.status(400).json({ error: 'Invalid action' });
  }
});

// Alert system API endpoints
app.get('/api/alerts', (req, res) => {
  res.json({
    configuredAlerts: Array.from(alerts.values()),
    alertHistory: alertHistory.slice(-50)
  });
});

app.post('/api/alerts', (req, res) => {
  const { id, type, symbol, condition, value, enabled } = req.body;
  
  const alert = {
    id: id || Date.now().toString(),
    type,
    symbol,
    condition, // 'above', 'below', 'crosses_above', 'crosses_below'
    value,
    enabled: enabled !== false,
    createdAt: new Date().toISOString()
  };
  
  alerts.set(alert.id, alert);
  res.json({ message: 'Alert created', alert });
});

app.delete('/api/alerts/:id', (req, res) => {
  const { id } = req.params;
  alerts.delete(id);
  res.json({ message: 'Alert deleted' });
});

// Function to check and trigger alerts
function checkAlerts(marketData) {
  alerts.forEach((alert, id) => {
    if (!alert.enabled) return;
    if (alert.symbol !== marketData.symbol) return;
    
    let triggered = false;
    let currentValue = null;
    
    switch (alert.type) {
      case 'price':
        currentValue = parseFloat(marketData.price.price);
        break;
      case 'rsi':
        currentValue = marketData.technical_indicators?.rsi;
        break;
      case 'macd':
        currentValue = marketData.technical_indicators?.macd?.macd;
        break;
      case 'bid_ask_delta':
        currentValue = marketData.bid_ask_delta;
        break;
      default:
        return;
    }
    
    if (currentValue === null) return;
    
    switch (alert.condition) {
      case 'above':
        triggered = currentValue > alert.value;
        break;
      case 'below':
        triggered = currentValue < alert.value;
        break;
      case 'crosses_above':
        triggered = currentValue > alert.value && alert.previousValue <= alert.value;
        break;
      case 'crosses_below':
        triggered = currentValue < alert.value && alert.previousValue >= alert.value;
        break;
    }
    
    if (triggered) {
      const alertEvent = {
        id: Date.now().toString(),
        alertId: id,
        type: alert.type,
        symbol: marketData.symbol,
        condition: alert.condition,
        threshold: alert.value,
        currentValue,
        timestamp: new Date().toISOString()
      };
      
      alertHistory.push(alertEvent);
      
      // Broadcast alert to all clients
      broadcast({
        type: 'alert_triggered',
        data: alertEvent
      });
      
      console.log(`Alert triggered: ${alert.type} ${alert.condition} ${alert.value} for ${marketData.symbol}`);
    }
    
    // Update previous value for crossing conditions
    alert.previousValue = currentValue;
  });
}

// API endpoint to get market data from Binance
app.get('/api/market-data/:symbol', async (req, res) => {
  const { symbol } = req.params;
  
  try {
    // Get current price
    const priceResponse = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
    
    // Get orderbook
    const orderbookResponse = await axios.get(`https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=5`);
    
    res.json({
      price: priceResponse.data,
      orderbook: orderbookResponse.data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching market data:', error);
    res.status(500).json({ error: 'Failed to fetch market data' });
  }
});

// API endpoint to get historical klines data for backtesting
app.get('/api/historical/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const { interval = '1h', limit = 500 } = req.query;
  
  try {
    const response = await axios.get(`https://api.binance.com/api/v3/klines`, {
      params: {
        symbol: symbol,
        interval: interval,
        limit: limit
      }
    });
    
    // Format the klines data
    const klines = response.data.map(kline => ({
      openTime: kline[0],
      open: parseFloat(kline[1]),
      high: parseFloat(kline[2]),
      low: parseFloat(kline[3]),
      close: parseFloat(kline[4]),
      volume: parseFloat(kline[5]),
      closeTime: kline[6],
      quoteVolume: parseFloat(kline[7]),
      trades: kline[8],
      takerBuyBase: parseFloat(kline[9]),
      takerBuyQuote: parseFloat(kline[10])
    }));
    
    res.json(klines);
  } catch (error) {
    console.error('Error fetching historical data:', error);
    res.status(500).json({ error: 'Failed to fetch historical data' });
  }
});

// API endpoint to run backtest
app.post('/api/backtest', async (req, res) => {
  const { symbol, strategy, parameters, startDate, endDate } = req.body;
  
  try {
    // Fetch historical data
    const response = await axios.get(`https://api.binance.com/api/v3/klines`, {
      params: {
        symbol: symbol,
        interval: '1h',
        limit: 1000
      }
    });
    
    const klines = response.data.map(kline => ({
      open: parseFloat(kline[1]),
      high: parseFloat(kline[2]),
      low: parseFloat(kline[3]),
      close: parseFloat(kline[4]),
      volume: parseFloat(kline[5])
    }));
    
    // Run backtest based on strategy
    const results = runBacktest(klines, strategy, parameters);
    
    res.json(results);
  } catch (error) {
    console.error('Error running backtest:', error);
    res.status(500).json({ error: 'Failed to run backtest' });
  }
});

// API endpoint to run strategy optimization
app.post('/api/optimize', async (req, res) => {
  const { symbol, strategy, parameterRanges } = req.body;
  
  try {
    // Fetch historical data
    const response = await axios.get(`https://api.binance.com/api/v3/klines`, {
      params: {
        symbol: symbol,
        interval: '1h',
        limit: 1000
      }
    });
    
    const klines = response.data.map(kline => ({
      open: parseFloat(kline[1]),
      high: parseFloat(kline[2]),
      low: parseFloat(kline[3]),
      close: parseFloat(kline[4]),
      volume: parseFloat(kline[5])
    }));
    
    // Run optimization
    const results = runOptimization(klines, strategy, parameterRanges);
    
    res.json(results);
  } catch (error) {
    console.error('Error running optimization:', error);
    res.status(500).json({ error: 'Failed to run optimization' });
  }
});

// Backtesting engine
function runBacktest(data, strategy, parameters) {
  const trades = [];
  let balance = 10000; // Starting balance
  let position = null;
  let totalTrades = 0;
  let winningTrades = 0;
  let losingTrades = 0;
  let totalPnL = 0;
  let maxDrawdown = 0;
  let peakBalance = balance;
  
  const prices = data.map(d => d.close);
  
  for (let i = 50; i < data.length; i++) {
    const currentData = data.slice(0, i + 1);
    const currentPrice = data[i].close;
    
    if (strategy === 'bollinger_bands') {
      const bbPeriod = parameters.bbPeriod || 20;
      const bbStdDev = parameters.bbStdDev || 2;
      
      if (currentData.length >= bbPeriod) {
        const slice = currentData.slice(-bbPeriod);
        const mean = slice.reduce((a, b) => a + b.close, 0) / bbPeriod;
        const variance = slice.reduce((a, b) => a + Math.pow(b.close - mean, 2), 0) / bbPeriod;
        const stdDev = Math.sqrt(variance);
        
        const upperBand = mean + (stdDev * bbStdDev);
        const lowerBand = mean - (stdDev * bbStdDev);
        
        // Entry logic
        if (!position) {
          if (currentPrice < lowerBand) {
            // Long entry
            position = {
              type: 'long',
              entryPrice: currentPrice,
              entryTime: i,
              size: balance * 0.1 // Use 10% of balance
            };
          } else if (currentPrice > upperBand) {
            // Short entry
            position = {
              type: 'short',
              entryPrice: currentPrice,
              entryTime: i,
              size: balance * 0.1
            };
          }
        } else {
          // Exit logic (simple: exit when price crosses mean)
          const tpPercent = parameters.tpPercent || 0.02;
          const slPercent = parameters.slPercent || 0.01;
          
          if (position.type === 'long') {
            const pnl = (currentPrice - position.entryPrice) / position.entryPrice;
            if (pnl >= tpPercent || pnl <= -slPercent) {
              const tradePnL = position.size * pnl;
              balance += tradePnL;
              trades.push({
                type: 'long',
                entryPrice: position.entryPrice,
                exitPrice: currentPrice,
                pnl: tradePnL,
                entryTime: position.entryTime,
                exitTime: i
              });
              totalTrades++;
              if (tradePnL > 0) winningTrades++;
              else losingTrades++;
              totalPnL += tradePnL;
              position = null;
              
              // Track drawdown
              if (balance > peakBalance) peakBalance = balance;
              const drawdown = (peakBalance - balance) / peakBalance;
              if (drawdown > maxDrawdown) maxDrawdown = drawdown;
            }
          } else {
            const pnl = (position.entryPrice - currentPrice) / position.entryPrice;
            if (pnl >= tpPercent || pnl <= -slPercent) {
              const tradePnL = position.size * pnl;
              balance += tradePnL;
              trades.push({
                type: 'short',
                entryPrice: position.entryPrice,
                exitPrice: currentPrice,
                pnl: tradePnL,
                entryTime: position.entryTime,
                exitTime: i
              });
              totalTrades++;
              if (tradePnL > 0) winningTrades++;
              else losingTrades++;
              totalPnL += tradePnL;
              position = null;
              
              // Track drawdown
              if (balance > peakBalance) peakBalance = balance;
              const drawdown = (peakBalance - balance) / peakBalance;
              if (drawdown > maxDrawdown) maxDrawdown = drawdown;
            }
          }
        }
      }
    }
  }
  
  return {
    initialBalance: 10000,
    finalBalance: balance,
    totalPnL: totalPnL,
    totalPnLPercent: ((balance - 10000) / 10000) * 100,
    totalTrades: totalTrades,
    winningTrades: winningTrades,
    losingTrades: losingTrades,
    winRate: totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0,
    maxDrawdown: maxDrawdown * 100,
    trades: trades.slice(-20) // Return last 20 trades
  };
}

// Strategy optimization engine (grid search)
function runOptimization(data, strategy, parameterRanges) {
  const results = [];
  
  if (strategy === 'bollinger_bands') {
    const bbPeriodRange = parameterRanges.bbPeriod || [10, 15, 20, 25, 30];
    const bbStdDevRange = parameterRanges.bbStdDev || [1.5, 2.0, 2.5];
    const tpPercentRange = parameterRanges.tpPercent || [0.01, 0.02, 0.03];
    const slPercentRange = parameterRanges.slPercent || [0.005, 0.01, 0.015];
    
    // Grid search over all parameter combinations
    for (const bbPeriod of bbPeriodRange) {
      for (const bbStdDev of bbStdDevRange) {
        for (const tpPercent of tpPercentRange) {
          for (const slPercent of slPercentRange) {
            const parameters = { bbPeriod, bbStdDev, tpPercent, slPercent };
            const backtestResult = runBacktest(data, strategy, parameters);
            
            results.push({
              parameters,
              metrics: {
                totalPnL: backtestResult.totalPnL,
                totalPnLPercent: backtestResult.totalPnLPercent,
                winRate: backtestResult.winRate,
                totalTrades: backtestResult.totalTrades,
                maxDrawdown: backtestResult.maxDrawdown,
                profitFactor: backtestResult.totalPnL > 0 ? backtestResult.totalPnL / Math.abs(backtestResult.maxDrawdown) : 0
              }
            });
          }
        }
      }
    }
  }
  
  // Sort results by total P&L (descending)
  results.sort((a, b) => b.metrics.totalPnL - a.metrics.totalPnL);
  
  return {
    bestResult: results[0] || null,
    topResults: results.slice(0, 10),
    totalCombinations: results.length
  };
}

// Function to fetch and broadcast market data for all active markets
async function fetchAndBroadcastMarketData() {
  // Read settings to get market symbol (do this outside try block for error handling)
  let symbol = 'BTCUSDT';
  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      symbol = settings.market_name || 'BTCUSDT';
    } catch (error) {
      console.error('Error reading settings for symbol:', error);
    }
  }

  // Use active markets if set, otherwise use settings symbol
  const marketsToFetch = activeMarkets.size > 0 ? Array.from(activeMarkets) : [symbol];

  for (const marketSymbol of marketsToFetch) {
    try {
      // Get current price
      const priceResponse = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${marketSymbol}`);
      const currentPrice = parseFloat(priceResponse.data.price);
      
      // Get price history for this symbol
      if (!priceHistoryMap.has(marketSymbol)) {
        priceHistoryMap.set(marketSymbol, []);
      }
      const symbolPriceHistory = priceHistoryMap.get(marketSymbol);
      
      // Update price history
      symbolPriceHistory.push(currentPrice);
      if (symbolPriceHistory.length > MAX_HISTORY) {
        symbolPriceHistory.shift();
      }
      
      // Calculate technical indicators
      const rsi = calculateRSI(symbolPriceHistory, 14);
      const sma20 = calculateSMA(symbolPriceHistory, 20);
      const sma50 = calculateSMA(symbolPriceHistory, 50);
      const ema12 = calculateEMA(symbolPriceHistory, 12);
      const ema26 = calculateEMA(symbolPriceHistory, 26);
      const macd = calculateMACD(symbolPriceHistory, 12, 26, 9);
      
      // Get orderbook
      const orderbookResponse = await axios.get(`https://api.binance.com/api/v3/depth?symbol=${marketSymbol}&limit=5`);
      
      // Calculate orderbook delta
      const totalBidVolume = orderbookResponse.data.bids.reduce((sum, bid) => sum + parseFloat(bid[1]), 0);
      const totalAskVolume = orderbookResponse.data.asks.reduce((sum, ask) => sum + parseFloat(ask[1]), 0);
      const bidAskDelta = totalBidVolume - totalAskVolume;

      // Store market data
      const marketData = {
        price: priceResponse.data,
        orderbook: orderbookResponse.data,
        bid_ask_delta: bidAskDelta,
        total_bid_volume: totalBidVolume,
        total_ask_volume: totalAskVolume,
        technical_indicators: {
          rsi: rsi,
          sma20: sma20,
          sma50: sma50,
          ema12: ema12,
          ema26: ema26,
          macd: macd
        },
        timestamp: new Date().toISOString()
      };
      
      marketDataMap.set(marketSymbol, marketData);
      
      // Check alerts for this market
      checkAlerts(marketData);

      // Get recent positions (only for primary market)
      let recentPositions = [];
      if (marketSymbol === symbol && fs.existsSync(POSITIONS_FILE)) {
        try {
          const positions = [];
          await new Promise((resolve, reject) => {
            fs.createReadStream(POSITIONS_FILE)
              .pipe(csv())
              .on('data', (data) => positions.push(data))
              .on('end', resolve)
              .on('error', reject);
          });
          recentPositions = positions.slice(-10);
        } catch (error) {
          console.error('Error reading positions:', error);
        }
      }

      // Broadcast data to all connected clients
      broadcast({
        type: 'market_update',
        data: {
          symbol: marketSymbol,
          price: priceResponse.data,
          orderbook: orderbookResponse.data,
          bid_ask_delta: bidAskDelta,
          total_bid_volume: totalBidVolume,
          total_ask_volume: totalAskVolume,
          timestamp: new Date().toISOString(),
          recent_positions: recentPositions,
          technical_indicators: {
            rsi: rsi,
            sma20: sma20,
            sma50: sma50,
            ema12: ema12,
            ema26: ema26,
            macd: macd
          }
        }
      });

    } catch (error) {
      console.error(`Error in market data fetch loop for ${marketSymbol}:`, error.message);
      
      // If Binance API is blocked (451 error), use mock data
      if (error.response && error.response.status === 451) {
        console.log('Binance API blocked in your region. Using mock data for demonstration.');
        
        // Generate mock data
        const mockPrice = 67000 + Math.random() * 1000;
        const mockBidVolume = 100 + Math.random() * 50;
        const mockAskVolume = 100 + Math.random() * 50;
        
        // Get price history for this symbol
        if (!priceHistoryMap.has(marketSymbol)) {
          priceHistoryMap.set(marketSymbol, []);
        }
        const symbolPriceHistory = priceHistoryMap.get(marketSymbol);
        
        // Update price history with mock data
        symbolPriceHistory.push(mockPrice);
        if (symbolPriceHistory.length > MAX_HISTORY) {
          symbolPriceHistory.shift();
        }
        
        // Calculate technical indicators with mock data
        const rsi = calculateRSI(symbolPriceHistory, 14);
        const sma20 = calculateSMA(symbolPriceHistory, 20);
        const sma50 = calculateSMA(symbolPriceHistory, 50);
        const ema12 = calculateEMA(symbolPriceHistory, 12);
        const ema26 = calculateEMA(symbolPriceHistory, 26);
        const macd = calculateMACD(symbolPriceHistory, 12, 26, 9);
        
        // Get recent positions (still try to read real positions)
        let recentPositions = [];
        if (marketSymbol === symbol && fs.existsSync(POSITIONS_FILE)) {
          try {
            const positions = [];
            await new Promise((resolve, reject) => {
              fs.createReadStream(POSITIONS_FILE)
                .pipe(csv())
                .on('data', (data) => positions.push(data))
                .on('end', resolve)
                .on('error', reject);
            });
            recentPositions = positions.slice(-10);
          } catch (error) {
            console.error('Error reading positions:', error);
          }
        }

        // Store mock market data
        const mockMarketData = {
          price: { symbol: marketSymbol, price: mockPrice.toString() },
          orderbook: {
            bids: [[mockPrice.toString(), mockBidVolume.toString()], [(mockPrice - 100).toString(), mockBidVolume.toString()]],
            asks: [[(mockPrice + 100).toString(), mockAskVolume.toString()], [(mockPrice + 200).toString(), mockAskVolume.toString()]]
          },
          bid_ask_delta: mockBidVolume - mockAskVolume,
          total_bid_volume: mockBidVolume,
          total_ask_volume: mockAskVolume,
          technical_indicators: {
            rsi: rsi,
            sma20: sma20,
            sma50: sma50,
            ema12: ema12,
            ema26: ema26,
            macd: macd
          },
          timestamp: new Date().toISOString(),
          mock_data: true
        };
        
        marketDataMap.set(marketSymbol, mockMarketData);
        
        // Check alerts for this market
        checkAlerts(mockMarketData);

        broadcast({
          type: 'market_update',
          data: {
            symbol: marketSymbol,
            price: { symbol: marketSymbol, price: mockPrice.toString() },
            orderbook: {
              bids: [[mockPrice.toString(), mockBidVolume.toString()], [(mockPrice - 100).toString(), mockBidVolume.toString()]],
              asks: [[(mockPrice + 100).toString(), mockAskVolume.toString()], [(mockPrice + 200).toString(), mockAskVolume.toString()]]
            },
            bid_ask_delta: mockBidVolume - mockAskVolume,
            total_bid_volume: mockBidVolume,
            total_ask_volume: mockAskVolume,
            timestamp: new Date().toISOString(),
            recent_positions: recentPositions,
            mock_data: true,
            technical_indicators: {
              rsi: rsi,
              sma20: sma20,
              sma50: sma50,
              ema12: ema12,
              ema26: ema26,
              macd: macd
            }
          }
        });
      }
    }
  }
}

// Start broadcasting market data every 2 seconds
setInterval(fetchAndBroadcastMarketData, 2000);

// Start server
const PORT = 8080;
server.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log('WebSocket endpoint: ws://localhost:8080');
  console.log('Starting market data broadcasts...');
  
  // Initial fetch
  fetchAndBroadcastMarketData();
});
