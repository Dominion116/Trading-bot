import { useState, useEffect } from 'react'
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { Activity, TrendingUp, TrendingDown, DollarSign, Clock, Zap, Play, Settings } from 'lucide-react'

function App() {
  const [marketData, setMarketData] = useState(null)
  const [priceHistory, setPriceHistory] = useState([])
  const [deltaHistory, setDeltaHistory] = useState([])
  const [positions, setPositions] = useState([])
  const [settings, setSettings] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [technicalIndicators, setTechnicalIndicators] = useState(null)
  const [rsiHistory, setRsiHistory] = useState([])
  const [macdHistory, setMacdHistory] = useState([])
  const [smaHistory, setSmaHistory] = useState([])
  const [backtestResults, setBacktestResults] = useState(null)
  const [backtestLoading, setBacktestLoading] = useState(false)
  const [backtestParams, setBacktestParams] = useState({
    symbol: 'BTCUSDT',
    strategy: 'bollinger_bands',
    bbPeriod: 20,
    bbStdDev: 2,
    tpPercent: 0.02,
    slPercent: 0.01
  })
  const [portfolioData, setPortfolioData] = useState(null)
  const [activeMarkets, setActiveMarkets] = useState(['BTCUSDT'])
  const [newMarketSymbol, setNewMarketSymbol] = useState('')
  const [alerts, setAlerts] = useState([])
  const [alertHistory, setAlertHistory] = useState([])
  const [newAlert, setNewAlert] = useState({
    type: 'price',
    symbol: 'BTCUSDT',
    condition: 'above',
    value: 0,
    enabled: true
  })
  const [optimizationResults, setOptimizationResults] = useState(null)
  const [optimizationLoading, setOptimizationLoading] = useState(false)
  const [optimizationParams, setOptimizationParams] = useState({
    symbol: 'BTCUSDT',
    strategy: 'bollinger_bands',
    bbPeriod: [10, 15, 20, 25, 30],
    bbStdDev: [1.5, 2.0, 2.5],
    tpPercent: [0.01, 0.02, 0.03],
    slPercent: [0.005, 0.01, 0.015]
  })

  useEffect(() => {
    // Fetch initial settings
    fetchSettings()
    
    // Fetch initial positions
    fetchPositions()
    
    // Fetch portfolio data
    fetchPortfolio()
    
    // Fetch active markets
    fetchMarkets()
    
    // Fetch alerts
    fetchAlerts()
    
    // Setup WebSocket connection
    const ws = new WebSocket('ws://localhost:8080')
    
    ws.onopen = () => {
      setIsConnected(true)
      console.log('WebSocket connected')
    }
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      if (message.type === 'market_update') {
        const data = message.data
        setMarketData(data)
        
        // Update technical indicators
        if (data.technical_indicators) {
          setTechnicalIndicators(data.technical_indicators)
          
          // Update RSI history
          setRsiHistory(prev => {
            if (data.technical_indicators.rsi !== null) {
              const newHistory = [...prev, {
                time: new Date(data.timestamp).toLocaleTimeString(),
                rsi: data.technical_indicators.rsi,
              }]
              return newHistory.slice(-50)
            }
            return prev
          })
          
          // Update MACD history
          setMacdHistory(prev => {
            if (data.technical_indicators.macd !== null) {
              const newHistory = [...prev, {
                time: new Date(data.timestamp).toLocaleTimeString(),
                macd: data.technical_indicators.macd.macd,
                signal: data.technical_indicators.macd.signal,
                histogram: data.technical_indicators.macd.histogram,
              }]
              return newHistory.slice(-50)
            }
            return prev
          })
          
          // Update SMA history
          setSmaHistory(prev => {
            const newPoint = {
              time: new Date(data.timestamp).toLocaleTimeString(),
              price: parseFloat(data.price.price),
            }
            if (data.technical_indicators.sma20 !== null) {
              newPoint.sma20 = data.technical_indicators.sma20
            }
            if (data.technical_indicators.sma50 !== null) {
              newPoint.sma50 = data.technical_indicators.sma50
            }
            const newHistory = [...prev, newPoint]
            return newHistory.slice(-50)
          })
        }
        
        // Update price history
        setPriceHistory(prev => {
          const newHistory = [...prev, {
            time: new Date(data.timestamp).toLocaleTimeString(),
            price: parseFloat(data.price.price),
          }]
          return newHistory.slice(-50) // Keep last 50 points
        })
        
        // Update delta history
        setDeltaHistory(prev => {
          const newHistory = [...prev, {
            time: new Date(data.timestamp).toLocaleTimeString(),
            delta: data.bid_ask_delta,
            bidVolume: data.total_bid_volume,
            askVolume: data.total_ask_volume,
          }]
          return newHistory.slice(-50) // Keep last 50 points
        })
        
        // Update positions if available
        if (data.recent_positions) {
          setPositions(data.recent_positions)
        }
      } else if (message.type === 'alert_triggered') {
        // Handle alert triggered
        setAlertHistory(prev => [message.data, ...prev].slice(0, 50))
      }
    }
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      setIsConnected(false)
    }
    
    ws.onclose = () => {
      setIsConnected(false)
      console.log('WebSocket disconnected')
    }
    
    return () => {
      ws.close()
    }
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings')
      if (response.ok) {
        const data = await response.json()
        setSettings(data)
        setBacktestParams(prev => ({ ...prev, symbol: data.market_name || 'BTCUSDT' }))
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    }
  }

  const fetchPositions = async () => {
    try {
      const response = await fetch('/api/positions')
      if (response.ok) {
        const data = await response.json()
        setPositions(data)
      }
    } catch (error) {
      console.error('Error fetching positions:', error)
    }
  }

  const fetchPortfolio = async () => {
    try {
      const response = await fetch('/api/portfolio')
      if (response.ok) {
        const data = await response.json()
        setPortfolioData(data)
      }
    } catch (error) {
      console.error('Error fetching portfolio:', error)
    }
  }

  const fetchMarkets = async () => {
    try {
      const response = await fetch('/api/markets')
      if (response.ok) {
        const data = await response.json()
        setActiveMarkets(data.activeMarkets)
      }
    } catch (error) {
      console.error('Error fetching markets:', error)
    }
  }

  const addMarket = async () => {
    if (!newMarketSymbol) return
    try {
      const response = await fetch('/api/markets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: newMarketSymbol, action: 'add' })
      })
      if (response.ok) {
        const data = await response.json()
        setActiveMarkets(data.activeMarkets)
        setNewMarketSymbol('')
      }
    } catch (error) {
      console.error('Error adding market:', error)
    }
  }

  const removeMarket = async (symbol) => {
    try {
      const response = await fetch('/api/markets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, action: 'remove' })
      })
      if (response.ok) {
        const data = await response.json()
        setActiveMarkets(data.activeMarkets)
      }
    } catch (error) {
      console.error('Error removing market:', error)
    }
  }

  const fetchAlerts = async () => {
    try {
      const response = await fetch('/api/alerts')
      if (response.ok) {
        const data = await response.json()
        setAlerts(data.configuredAlerts)
        setAlertHistory(data.alertHistory)
      }
    } catch (error) {
      console.error('Error fetching alerts:', error)
    }
  }

  const createAlert = async () => {
    try {
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAlert)
      })
      if (response.ok) {
        const data = await response.json()
        setAlerts([...alerts, data.alert])
        setNewAlert({
          type: 'price',
          symbol: 'BTCUSDT',
          condition: 'above',
          value: 0,
          enabled: true
        })
        fetchAlerts()
      }
    } catch (error) {
      console.error('Error creating alert:', error)
    }
  }

  const deleteAlert = async (id) => {
    try {
      const response = await fetch(`/api/alerts/${id}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        setAlerts(alerts.filter(alert => alert.id !== id))
      }
    } catch (error) {
      console.error('Error deleting alert:', error)
    }
  }

  const runBacktest = async () => {
    setBacktestLoading(true)
    try {
      const response = await fetch('/api/backtest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(backtestParams)
      })
      if (response.ok) {
        const data = await response.json()
        setBacktestResults(data)
      }
    } catch (error) {
      console.error('Error running backtest:', error)
    }
    setBacktestLoading(false)
  }

  const runOptimization = async () => {
    setOptimizationLoading(true)
    try {
      const response = await fetch('/api/optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          symbol: optimizationParams.symbol,
          strategy: optimizationParams.strategy,
          parameterRanges: {
            bbPeriod: optimizationParams.bbPeriod,
            bbStdDev: optimizationParams.bbStdDev,
            tpPercent: optimizationParams.tpPercent,
            slPercent: optimizationParams.slPercent
          }
        })
      })
      if (response.ok) {
        const data = await response.json()
        setOptimizationResults(data)
      }
    } catch (error) {
      console.error('Error running optimization:', error)
    }
    setOptimizationLoading(false)
  }

  return (
    <div className="min-h-screen bg-darker text-gray-100">
      {/* Header */}
      <header className="bg-dark border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="w-8 h-8 text-primary" />
            <h1 className="text-2xl font-bold">Trading Bot Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${isConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
              <span className="text-sm">{isConnected ? 'Live' : 'Disconnected'}</span>
            </div>
            {settings && (
              <div className="text-sm text-gray-400">
                Market: <span className="text-primary font-semibold">{settings.market_name}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Market Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-dark rounded-lg p-4 border border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Current Price</span>
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
            <div className="text-2xl font-bold">
              {marketData ? parseFloat(marketData.price.price).toFixed(2) : '---'}
            </div>
          </div>
          
          <div className="bg-dark rounded-lg p-4 border border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Bid-Ask Delta</span>
              <Activity className="w-5 h-5 text-secondary" />
            </div>
            <div className={`text-2xl font-bold ${marketData?.bid_ask_delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {marketData ? marketData.bid_ask_delta.toFixed(2) : '---'}
            </div>
          </div>
          
          <div className="bg-dark rounded-lg p-4 border border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Total Bid Volume</span>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-green-400">
              {marketData ? marketData.total_bid_volume.toFixed(2) : '---'}
            </div>
          </div>
          
          <div className="bg-dark rounded-lg p-4 border border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Total Ask Volume</span>
              <TrendingDown className="w-5 h-5 text-red-500" />
            </div>
            <div className="text-2xl font-bold text-red-400">
              {marketData ? marketData.total_ask_volume.toFixed(2) : '---'}
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Price Chart */}
          <div className="bg-dark rounded-lg p-6 border border-gray-800">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              Price History
            </h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={priceHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="time" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                    labelStyle={{ color: '#e5e7eb' }}
                  />
                  <Area type="monotone" dataKey="price" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Orderbook Delta Chart */}
          <div className="bg-dark rounded-lg p-6 border border-gray-800">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-secondary" />
              Orderbook Delta
            </h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={deltaHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="time" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                    labelStyle={{ color: '#e5e7eb' }}
                  />
                  <Line type="monotone" dataKey="delta" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Volume Comparison Chart */}
        <div className="bg-dark rounded-lg p-6 border border-gray-800">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Bid vs Ask Volume
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deltaHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="time" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                  labelStyle={{ color: '#e5e7eb' }}
                />
                <Bar dataKey="bidVolume" fill="#10b981" name="Bid Volume" />
                <Bar dataKey="askVolume" fill="#ef4444" name="Ask Volume" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Technical Indicators Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* RSI Chart */}
          <div className="bg-dark rounded-lg p-6 border border-gray-800">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-500" />
              RSI (14)
            </h2>
            <div className="text-2xl font-bold mb-4">
              {technicalIndicators?.rsi ? technicalIndicators.rsi.toFixed(2) : '---'}
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rsiHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="time" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                    labelStyle={{ color: '#e5e7eb' }}
                  />
                  <Line type="monotone" dataKey="rsi" stroke="#a855f7" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* MACD Chart */}
          <div className="bg-dark rounded-lg p-6 border border-gray-800">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-500" />
              MACD
            </h2>
            <div className="grid grid-cols-3 gap-2 mb-4 text-sm">
              <div>
                <div className="text-gray-400">MACD</div>
                <div className="font-semibold">{technicalIndicators?.macd ? technicalIndicators.macd.macd.toFixed(2) : '---'}</div>
              </div>
              <div>
                <div className="text-gray-400">Signal</div>
                <div className="font-semibold">{technicalIndicators?.macd ? technicalIndicators.macd.signal.toFixed(2) : '---'}</div>
              </div>
              <div>
                <div className="text-gray-400">Hist</div>
                <div className="font-semibold">{technicalIndicators?.macd ? technicalIndicators.macd.histogram.toFixed(2) : '---'}</div>
              </div>
            </div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={macdHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="time" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                    labelStyle={{ color: '#e5e7eb' }}
                  />
                  <Line type="monotone" dataKey="macd" stroke="#3b82f6" strokeWidth={2} dot={false} name="MACD" />
                  <Line type="monotone" dataKey="signal" stroke="#f59e0b" strokeWidth={2} dot={false} name="Signal" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Moving Averages Chart */}
          <div className="bg-dark rounded-lg p-6 border border-gray-800">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-500" />
              Moving Averages
            </h2>
            <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
              <div>
                <div className="text-gray-400">SMA 20</div>
                <div className="font-semibold">{technicalIndicators?.sma20 ? technicalIndicators.sma20.toFixed(2) : '---'}</div>
              </div>
              <div>
                <div className="text-gray-400">SMA 50</div>
                <div className="font-semibold">{technicalIndicators?.sma50 ? technicalIndicators.sma50.toFixed(2) : '---'}</div>
              </div>
            </div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={smaHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="time" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                    labelStyle={{ color: '#e5e7eb' }}
                  />
                  <Line type="monotone" dataKey="price" stroke="#6b7280" strokeWidth={1} dot={false} name="Price" />
                  <Line type="monotone" dataKey="sma20" stroke="#10b981" strokeWidth={2} dot={false} name="SMA 20" />
                  <Line type="monotone" dataKey="sma50" stroke="#f59e0b" strokeWidth={2} dot={false} name="SMA 50" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Recent Positions */}
        <div className="bg-dark rounded-lg p-6 border border-gray-800">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Recent Positions
          </h2>
          {positions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-700">
                    <th className="pb-3">Time</th>
                    <th className="pb-3">Price</th>
                    <th className="pb-3">Size</th>
                    <th className="pb-3">Side</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.slice().reverse().map((position, index) => (
                    <tr key={index} className="border-b border-gray-800">
                      <td className="py-3 text-sm">{new Date(position.utc_time).toLocaleString()}</td>
                      <td className="py-3 font-mono">${parseFloat(position.price).toFixed(2)}</td>
                      <td className="py-3 font-mono">{position.size}</td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          position.side === 'buy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {position.side.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No positions recorded yet</p>
          )}
        </div>

        {/* Bot Settings */}
        {settings && (
          <div className="bg-dark rounded-lg p-6 border border-gray-800">
            <h2 className="text-lg font-semibold mb-4">Bot Configuration</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <span className="text-gray-400 text-sm">Market</span>
                <p className="font-semibold">{settings.market_name}</p>
              </div>
              <div>
                <span className="text-gray-400 text-sm">BB Period</span>
                <p className="font-semibold">{settings.bb_period}</p>
              </div>
              <div>
                <span className="text-gray-400 text-sm">BB Std Dev</span>
                <p className="font-semibold">{settings.bb_std_dev}</p>
              </div>
              <div>
                <span className="text-gray-400 text-sm">Orderbook Depth</span>
                <p className="font-semibold">{settings.orderbook_depth}</p>
              </div>
              <div>
                <span className="text-gray-400 text-sm">Sampling Time</span>
                <p className="font-semibold">{settings.sampling_time}s</p>
              </div>
              <div>
                <span className="text-gray-400 text-sm">Take Profit %</span>
                <p className="font-semibold">{settings.tp_percent}%</p>
              </div>
              <div>
                <span className="text-gray-400 text-sm">Stop Loss %</span>
                <p className="font-semibold">{settings.sl_percent}%</p>
              </div>
              <div>
                <span className="text-gray-400 text-sm">Live Trading</span>
                <p className={`font-semibold ${settings.live ? 'text-green-400' : 'text-yellow-400'}`}>
                  {settings.live ? 'Enabled' : 'Disabled'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Backtesting Section */}
        <div className="bg-dark rounded-lg p-6 border border-gray-800">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Play className="w-5 h-5 text-primary" />
            Backtesting Engine
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
            <div>
              <label className="text-gray-400 text-sm">Symbol</label>
              <input
                type="text"
                value={backtestParams.symbol}
                onChange={(e) => setBacktestParams({ ...backtestParams, symbol: e.target.value })}
                className="w-full bg-darker border border-gray-700 rounded px-3 py-2 mt-1 text-white"
              />
            </div>
            <div>
              <label className="text-gray-400 text-sm">Strategy</label>
              <select
                value={backtestParams.strategy}
                onChange={(e) => setBacktestParams({ ...backtestParams, strategy: e.target.value })}
                className="w-full bg-darker border border-gray-700 rounded px-3 py-2 mt-1 text-white"
              >
                <option value="bollinger_bands">Bollinger Bands</option>
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-sm">BB Period</label>
              <input
                type="number"
                value={backtestParams.bbPeriod}
                onChange={(e) => setBacktestParams({ ...backtestParams, bbPeriod: parseInt(e.target.value) })}
                className="w-full bg-darker border border-gray-700 rounded px-3 py-2 mt-1 text-white"
              />
            </div>
            <div>
              <label className="text-gray-400 text-sm">BB Std Dev</label>
              <input
                type="number"
                step="0.1"
                value={backtestParams.bbStdDev}
                onChange={(e) => setBacktestParams({ ...backtestParams, bbStdDev: parseFloat(e.target.value) })}
                className="w-full bg-darker border border-gray-700 rounded px-3 py-2 mt-1 text-white"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={runBacktest}
                disabled={backtestLoading}
                className="w-full bg-primary hover:bg-blue-600 disabled:bg-gray-600 text-white font-semibold py-2 px-4 rounded transition"
              >
                {backtestLoading ? 'Running...' : 'Run Backtest'}
              </button>
            </div>
          </div>

          {backtestResults && (
            <div className="mt-6">
              <h3 className="text-md font-semibold mb-3">Backtest Results</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-darker rounded p-3">
                  <div className="text-gray-400 text-sm">Initial Balance</div>
                  <div className="text-xl font-bold">${backtestResults.initialBalance.toLocaleString()}</div>
                </div>
                <div className="bg-darker rounded p-3">
                  <div className="text-gray-400 text-sm">Final Balance</div>
                  <div className={`text-xl font-bold ${backtestResults.finalBalance >= backtestResults.initialBalance ? 'text-green-400' : 'text-red-400'}`}>
                    ${backtestResults.finalBalance.toLocaleString()}
                  </div>
                </div>
                <div className="bg-darker rounded p-3">
                  <div className="text-gray-400 text-sm">Total P&L</div>
                  <div className={`text-xl font-bold ${backtestResults.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${backtestResults.totalPnL.toFixed(2)} ({backtestResults.totalPnLPercent.toFixed(2)}%)
                  </div>
                </div>
                <div className="bg-darker rounded p-3">
                  <div className="text-gray-400 text-sm">Win Rate</div>
                  <div className="text-xl font-bold">{backtestResults.winRate.toFixed(2)}%</div>
                </div>
                <div className="bg-darker rounded p-3">
                  <div className="text-gray-400 text-sm">Total Trades</div>
                  <div className="text-xl font-bold">{backtestResults.totalTrades}</div>
                </div>
                <div className="bg-darker rounded p-3">
                  <div className="text-gray-400 text-sm">Winning Trades</div>
                  <div className="text-xl font-bold text-green-400">{backtestResults.winningTrades}</div>
                </div>
                <div className="bg-darker rounded p-3">
                  <div className="text-gray-400 text-sm">Losing Trades</div>
                  <div className="text-xl font-bold text-red-400">{backtestResults.losingTrades}</div>
                </div>
                <div className="bg-darker rounded p-3">
                  <div className="text-gray-400 text-sm">Max Drawdown</div>
                  <div className="text-xl font-bold text-red-400">{backtestResults.maxDrawdown.toFixed(2)}%</div>
                </div>
              </div>

              {backtestResults.trades && backtestResults.trades.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Recent Trades</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-400 border-b border-gray-700">
                          <th className="pb-2">Type</th>
                          <th className="pb-2">Entry Price</th>
                          <th className="pb-2">Exit Price</th>
                          <th className="pb-2">P&L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {backtestResults.trades.slice(-10).reverse().map((trade, index) => (
                          <tr key={index} className="border-b border-gray-800">
                            <td className="py-2">
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                trade.type === 'long' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                              }`}>
                                {trade.type.toUpperCase()}
                              </span>
                            </td>
                            <td className="py-2 font-mono">${trade.entryPrice.toFixed(2)}</td>
                            <td className="py-2 font-mono">${trade.exitPrice.toFixed(2)}</td>
                            <td className={`py-2 font-mono ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              ${trade.pnl.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Portfolio Performance Section */}
        <div className="bg-dark rounded-lg p-6 border border-gray-800">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-500" />
            Portfolio Performance
          </h2>
          {portfolioData ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-darker rounded p-3">
                  <div className="text-gray-400 text-sm">Total Trades</div>
                  <div className="text-xl font-bold">{portfolioData.totalTrades}</div>
                </div>
                <div className="bg-darker rounded p-3">
                  <div className="text-gray-400 text-sm">Total P&L</div>
                  <div className={`text-xl font-bold ${portfolioData.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${portfolioData.totalPnL.toFixed(2)}
                  </div>
                </div>
                <div className="bg-darker rounded p-3">
                  <div className="text-gray-400 text-sm">Win Rate</div>
                  <div className="text-xl font-bold">{portfolioData.winRate.toFixed(2)}%</div>
                </div>
                <div className="bg-darker rounded p-3">
                  <div className="text-gray-400 text-sm">Profit Factor</div>
                  <div className="text-xl font-bold">{portfolioData.profitFactor}</div>
                </div>
                <div className="bg-darker rounded p-3">
                  <div className="text-gray-400 text-sm">Average Win</div>
                  <div className="text-xl font-bold text-green-400">${portfolioData.averageWin.toFixed(2)}</div>
                </div>
                <div className="bg-darker rounded p-3">
                  <div className="text-gray-400 text-sm">Average Loss</div>
                  <div className="text-xl font-bold text-red-400">${portfolioData.averageLoss.toFixed(2)}</div>
                </div>
                <div className="bg-darker rounded p-3">
                  <div className="text-gray-400 text-sm">Winning Trades</div>
                  <div className="text-xl font-bold text-green-400">{portfolioData.winningTrades}</div>
                </div>
                <div className="bg-darker rounded p-3">
                  <div className="text-gray-400 text-sm">Losing Trades</div>
                  <div className="text-xl font-bold text-red-400">{portfolioData.losingTrades}</div>
                </div>
              </div>

              {portfolioData.trades && portfolioData.trades.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Recent Trade Performance</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-400 border-b border-gray-700">
                          <th className="pb-2">Time</th>
                          <th className="pb-2">Side</th>
                          <th className="pb-2">Price</th>
                          <th className="pb-2">Size</th>
                          <th className="pb-2">P&L</th>
                          <th className="pb-2">P&L %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {portfolioData.trades.slice(-10).reverse().map((trade, index) => (
                          <tr key={index} className="border-b border-gray-800">
                            <td className="py-2">{new Date(trade.utc_time).toLocaleString()}</td>
                            <td className="py-2">
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                trade.side === 'buy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                              }`}>
                                {trade.side.toUpperCase()}
                              </span>
                            </td>
                            <td className="py-2 font-mono">${parseFloat(trade.price).toFixed(2)}</td>
                            <td className="py-2 font-mono">{trade.size}</td>
                            <td className={`py-2 font-mono ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              ${trade.pnl.toFixed(2)}
                            </td>
                            <td className={`py-2 font-mono ${trade.pnlPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {trade.pnlPercent.toFixed(2)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-gray-500 text-center py-4">No portfolio data available</p>
          )}
        </div>

        {/* Multi-Market Section */}
        <div className="bg-dark rounded-lg p-6 border border-gray-800">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Multi-Market Support
          </h2>
          <div className="mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={newMarketSymbol}
                onChange={(e) => setNewMarketSymbol(e.target.value.toUpperCase())}
                placeholder="Enter symbol (e.g., ETHUSDT)"
                className="flex-1 bg-darker border border-gray-700 rounded px-3 py-2 text-white"
              />
              <button
                onClick={addMarket}
                className="bg-primary hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded transition"
              >
                Add Market
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {activeMarkets.map((market) => (
              <div key={market} className="bg-darker rounded p-3 flex items-center justify-between">
                <span className="font-semibold">{market}</span>
                <button
                  onClick={() => removeMarket(market)}
                  className="text-red-400 hover:text-red-300 text-sm"
                  disabled={market === 'BTCUSDT'}
                >
                  {market === 'BTCUSDT' ? 'Primary' : 'Remove'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Alert System Section */}
        <div className="bg-dark rounded-lg p-6 border border-gray-800">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            Alert System
          </h2>
          
          {/* Create Alert Form */}
          <div className="mb-6 p-4 bg-darker rounded-lg">
            <h3 className="text-md font-semibold mb-3">Create New Alert</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div>
                <label className="text-gray-400 text-sm">Type</label>
                <select
                  value={newAlert.type}
                  onChange={(e) => setNewAlert({ ...newAlert, type: e.target.value })}
                  className="w-full bg-dark border border-gray-700 rounded px-3 py-2 mt-1 text-white"
                >
                  <option value="price">Price</option>
                  <option value="rsi">RSI</option>
                  <option value="macd">MACD</option>
                  <option value="bid_ask_delta">Bid-Ask Delta</option>
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-sm">Symbol</label>
                <select
                  value={newAlert.symbol}
                  onChange={(e) => setNewAlert({ ...newAlert, symbol: e.target.value })}
                  className="w-full bg-dark border border-gray-700 rounded px-3 py-2 mt-1 text-white"
                >
                  {activeMarkets.map(market => (
                    <option key={market} value={market}>{market}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-sm">Condition</label>
                <select
                  value={newAlert.condition}
                  onChange={(e) => setNewAlert({ ...newAlert, condition: e.target.value })}
                  className="w-full bg-dark border border-gray-700 rounded px-3 py-2 mt-1 text-white"
                >
                  <option value="above">Above</option>
                  <option value="below">Below</option>
                  <option value="crosses_above">Crosses Above</option>
                  <option value="crosses_below">Crosses Below</option>
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-sm">Value</label>
                <input
                  type="number"
                  step="0.01"
                  value={newAlert.value}
                  onChange={(e) => setNewAlert({ ...newAlert, value: parseFloat(e.target.value) })}
                  className="w-full bg-dark border border-gray-700 rounded px-3 py-2 mt-1 text-white"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={createAlert}
                  className="w-full bg-primary hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded transition"
                >
                  Create Alert
                </button>
              </div>
            </div>
          </div>

          {/* Configured Alerts */}
          <div className="mb-6">
            <h3 className="text-md font-semibold mb-3">Configured Alerts</h3>
            {alerts.length > 0 ? (
              <div className="space-y-2">
                {alerts.map((alert) => (
                  <div key={alert.id} className="bg-darker rounded p-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${alert.enabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                        {alert.enabled ? 'Active' : 'Disabled'}
                      </span>
                      <span className="font-semibold">{alert.type}</span>
                      <span className="text-gray-400">{alert.symbol}</span>
                      <span className="text-gray-400">{alert.condition}</span>
                      <span className="font-mono">{alert.value}</span>
                    </div>
                    <button
                      onClick={() => deleteAlert(alert.id)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No alerts configured</p>
            )}
          </div>

          {/* Alert History */}
          <div>
            <h3 className="text-md font-semibold mb-3">Alert History</h3>
            {alertHistory.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {alertHistory.slice(0, 10).map((alert) => (
                  <div key={alert.id} className="bg-darker rounded p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-yellow-400">{alert.type} {alert.condition} {alert.threshold}</span>
                      <span className="text-gray-400">{new Date(alert.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="text-gray-400 mt-1">
                      {alert.symbol} - Current: {alert.currentValue?.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No alerts triggered yet</p>
            )}
          </div>
        </div>

        {/* Strategy Optimization Section */}
        <div className="bg-dark rounded-lg p-6 border border-gray-800">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-500" />
            Strategy Optimization
          </h2>
          
          <div className="mb-4 p-4 bg-darker rounded-lg">
            <h3 className="text-md font-semibold mb-3">Parameter Ranges</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-gray-400 text-sm">BB Period (comma-separated)</label>
                <input
                  type="text"
                  value={optimizationParams.bbPeriod.join(',')}
                  onChange={(e) => setOptimizationParams({ ...optimizationParams, bbPeriod: e.target.value.split(',').map(Number) })}
                  className="w-full bg-dark border border-gray-700 rounded px-3 py-2 mt-1 text-white"
                  placeholder="10,15,20,25,30"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm">BB Std Dev (comma-separated)</label>
                <input
                  type="text"
                  value={optimizationParams.bbStdDev.join(',')}
                  onChange={(e) => setOptimizationParams({ ...optimizationParams, bbStdDev: e.target.value.split(',').map(Number) })}
                  className="w-full bg-dark border border-gray-700 rounded px-3 py-2 mt-1 text-white"
                  placeholder="1.5,2.0,2.5"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm">TP Percent (comma-separated)</label>
                <input
                  type="text"
                  value={optimizationParams.tpPercent.join(',')}
                  onChange={(e) => setOptimizationParams({ ...optimizationParams, tpPercent: e.target.value.split(',').map(Number) })}
                  className="w-full bg-dark border border-gray-700 rounded px-3 py-2 mt-1 text-white"
                  placeholder="0.01,0.02,0.03"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm">SL Percent (comma-separated)</label>
                <input
                  type="text"
                  value={optimizationParams.slPercent.join(',')}
                  onChange={(e) => setOptimizationParams({ ...optimizationParams, slPercent: e.target.value.split(',').map(Number) })}
                  className="w-full bg-dark border border-gray-700 rounded px-3 py-2 mt-1 text-white"
                  placeholder="0.005,0.01,0.015"
                />
              </div>
            </div>
            <button
              onClick={runOptimization}
              disabled={optimizationLoading}
              className="w-full bg-primary hover:bg-blue-600 disabled:bg-gray-600 text-white font-semibold py-2 px-4 rounded transition"
            >
              {optimizationLoading ? 'Running Optimization...' : 'Run Grid Search Optimization'}
            </button>
          </div>

          {optimizationResults && (
            <div className="mt-6">
              <h3 className="text-md font-semibold mb-3">Optimization Results</h3>
              <div className="text-sm text-gray-400 mb-4">
                Tested {optimizationResults.totalCombinations} parameter combinations
              </div>
              
              {optimizationResults.bestResult && (
                <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <h4 className="text-md font-semibold mb-3 text-green-400">Best Parameters</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    <div>
                      <span className="text-gray-400">BB Period:</span>
                      <span className="ml-2 font-semibold">{optimizationResults.bestResult.parameters.bbPeriod}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">BB Std Dev:</span>
                      <span className="ml-2 font-semibold">{optimizationResults.bestResult.parameters.bbStdDev}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">TP %:</span>
                      <span className="ml-2 font-semibold">{(optimizationResults.bestResult.parameters.tpPercent * 100).toFixed(2)}%</span>
                    </div>
                    <div>
                      <span className="text-gray-400">SL %:</span>
                      <span className="ml-2 font-semibold">{(optimizationResults.bestResult.parameters.slPercent * 100).toFixed(2)}%</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <span className="text-gray-400">Total P&L:</span>
                      <span className={`ml-2 font-semibold ${optimizationResults.bestResult.metrics.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        ${optimizationResults.bestResult.metrics.totalPnL.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Win Rate:</span>
                      <span className="ml-2 font-semibold">{optimizationResults.bestResult.metrics.winRate.toFixed(2)}%</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Total Trades:</span>
                      <span className="ml-2 font-semibold">{optimizationResults.bestResult.metrics.totalTrades}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Max Drawdown:</span>
                      <span className="ml-2 font-semibold text-red-400">{optimizationResults.bestResult.metrics.maxDrawdown.toFixed(2)}%</span>
                    </div>
                  </div>
                </div>
              )}

              {optimizationResults.topResults && optimizationResults.topResults.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Top 10 Results</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-400 border-b border-gray-700">
                          <th className="pb-2">BB Period</th>
                          <th className="pb-2">BB Std</th>
                          <th className="pb-2">TP %</th>
                          <th className="pb-2">SL %</th>
                          <th className="pb-2">P&L</th>
                          <th className="pb-2">Win Rate</th>
                          <th className="pb-2">Trades</th>
                        </tr>
                      </thead>
                      <tbody>
                        {optimizationResults.topResults.map((result, index) => (
                          <tr key={index} className="border-b border-gray-800">
                            <td className="py-2">{result.parameters.bbPeriod}</td>
                            <td className="py-2">{result.parameters.bbStdDev}</td>
                            <td className="py-2">{(result.parameters.tpPercent * 100).toFixed(2)}%</td>
                            <td className="py-2">{(result.parameters.slPercent * 100).toFixed(2)}%</td>
                            <td className={`py-2 ${result.metrics.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              ${result.metrics.totalPnL.toFixed(2)}
                            </td>
                            <td className="py-2">{result.metrics.winRate.toFixed(2)}%</td>
                            <td className="py-2">{result.metrics.totalTrades}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
