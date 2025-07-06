import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { animate, utils } from 'animejs';
import Aurora from './Aurora';

function App() {
  const [ticker, setTicker] = useState('AAPL');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedStock, setSelectedStock] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [predictionClose, setPredictionClose] = useState(null);
  const [news, setNews] = useState([]);
  const [showAllNews, setShowAllNews] = useState(false);

  const [open, setOpen] = useState('');
  const [high, setHigh] = useState('');
  const [low, setLow] = useState('');
  const [close, setClose] = useState('');
  const [volume, setVolume] = useState('');

  const tradingViewWidget = useRef();

  const getPrediction = async () => {
  if (!ticker) return;

  // Predict High
  fetch('http://127.0.0.1:5000/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ticker,
      Open: Number(open),
      High: Number(high),
      Low: Number(low),
      Close: Number(close),
      Volume: Number(volume),
      Dividends: 0,
      "Stock Splits": 0,
    }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.prediction_high !== undefined) {
        setPrediction(data.prediction_high);
      } else {
        setPrediction(`Error: ${data.error || 'Prediction failed'}`);
      }
    })
    .catch((err) => {
      console.error(err);
      setPrediction('Error fetching prediction.');
    });

  // Predict Close
  fetch('http://127.0.0.1:5000/predict-close', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ticker,
      Prev_Open: Number(open),
      Prev_High: Number(high),
      Prev_Low: Number(low),
      Prev_Close: Number(close),
      Prev_Volume: Number(volume),
    }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.prediction_close !== undefined) {
        setPredictionClose(data.prediction_close);
      } else {
        setPredictionClose(`Error: ${data.error || 'Prediction failed'}`);
      }
    })
    .catch((err) => {
      console.error(err);
      setPredictionClose('Error fetching close prediction.');
    });
};

  const fetchOHLCV = async () => {
    if (!ticker) return;
    try {
      const res = await fetch('http://127.0.0.1:5000/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker }),
      });
      const data = await res.json();
      if (data.error) {
        console.error("Fetch error:", data.error);
        return;
      }
      setOpen(data.open);
      setHigh(data.high);
      setLow(data.low);
      setClose(data.close);
      setVolume(data.volume);
    } catch (err) {
      console.error("Failed to fetch OHLCV:", err);
    }
  };

  useEffect(() => {
    if (searchQuery.length > 1) {
      fetch(`https://finnhub.io/api/v1/search?q=${searchQuery}&token=${process.env.REACT_APP_FINNHUB_API_KEY}`)
        .then((res) => res.json())
        .then((data) => setSearchResults(data.result || []))
        .catch(() => setSearchResults([]));
    }
  }, [searchQuery]);

  useEffect(() => {
    if (selectedStock) {
      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/tv.js';
      script.async = true;
      script.onload = () => {
        if (tradingViewWidget.current) tradingViewWidget.current.innerHTML = '';
        new window.TradingView.widget({
          autosize: true,
          symbol: selectedStock.symbol,
          interval: 'D',
          timezone: 'Etc/UTC',
          theme: 'dark',
          style: '1',
          locale: 'en',
          container_id: 'tradingview_chart',
        });
      };
      document.body.appendChild(script);
    }
  }, [selectedStock]);

  useEffect(() => {
    utils.set('.square', {
      '--radius': '4px',
      '--x': '0rem',
      '--pseudo-el-after-scale': '1',
      borderRadius: 'var(--radius)',
      translateX: 'var(--x)',
    });

    animate('.square', {
      '--radius': '20px',
      '--x': '0rem',
      '--pseudo-el-after-scale': '1.2',
      duration: 1200,
      easing: 'easeInOutQuad',
    });
  }, []);

  useEffect(() => {
    const query = selectedStock?.description || ticker;
    if (!query) return;

    fetch(`https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&apiKey=${process.env.REACT_APP_NEWS_API_KEY}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'ok') {
          setNews(data.articles || []);
        } else {
          setNews([]);
          console.error("NewsAPI error:", data);
        }
      })
      .catch((err) => {
        console.error("Error fetching news:", err);
        setNews([]);
      });
  }, [selectedStock, ticker]);

  return (
    <div className="app">
      {/* NAVBAR */}
      <nav className="navbar">
        <div className="logo">
          <span role="img" aria-label="logo"></span> <span className="text-green">Stock Vision</span>
        </div>
        <div className="search-container">
          <input
            type="text"
            placeholder="Search stocks by name or symbol (e.g., AAPL)"
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchResults.length > 0 && (
            <ul className="search-results">
              {searchResults.map((stock) => (
                <li key={stock.symbol} onClick={() => {
                  setSelectedStock(stock);
                  setSearchQuery('');
                  setTicker(stock.symbol);
                  setSearchResults([]);
                  // Automatically fetch OHLCV data when a stock is selected
                  setTimeout(() => fetchOHLCV(), 100);
                }}>
                  {stock.description} ({stock.symbol})
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#News">News</a>
          <a href="#MoreStats">More Stats</a>
          <a href="#predict" className="start-btn">Start predicting</a>
        </div>
      </nav>

{/* HERO SECTION with Full-Width Aurora Background */}
<section className="hero-section relative w-full bg-black pt-32 pb-20 overflow-hidden">
  {/* Aurora Background */}
  <div className="absolute inset-0 top-0 left-0 w-full h-[200px] pointer-events-none blur-lg opacity-80 mix-blend-screen z-0">
    <Aurora
      colorStops={["#5227FF", "#7cff67", "#5227FF"]}
      amplitude={1}
      blend={0.5}
    />
  </div>

  {/* Hero Content */}
  <div className="relative z-10 max-w-7xl mx-auto px-4 text-center">
    <h1 className="text-4xl md:text-6xl font-bold mb-4">
      <span className="text-white">Trade with </span>
      <span className="text-green-400">Confidence</span>
    </h1>
    <p className="text-gray-300 mb-6 max-w-xl mx-auto">
      Predict stock prices with precision. Stay ahead in the market with real-time
      price predictions powered by advanced machine learning algorithms.
    </p>
    <div className="flex justify-center gap-4">
      <button className="primary-btn">Get Started</button>
      <button className="secondary-btn" onClick={fetchOHLCV}>
        Fetch Latest Data
      </button>
    </div>
  </div>
</section>




      {/* TRADINGVIEW CHART */}
      {selectedStock && (
        <section className="tradingview-chart-container">
          <div id="tradingview_chart" ref={tradingViewWidget}></div>
        </section>
      )}

      {/* FEATURES */}
      <section className="features-section px-8 py-20 text-white w-full" id="features">
        <div className="max-w-3xl mx-auto flex flex-col items-center text-center">
          <h2 className="text-4xl font-bold mb-6 leading-tight">
            <span className="text-white">Advanced Trading </span>
            <span className="text-green-500">Features & Tools</span>
          </h2>
          <p className="text-gray-400 mb-10 max-w-2xl">
            Experience professional-grade trading tools and features designed for both novice and experienced traders.
          </p>

          <div className="space-y-9 text-left w-full">
            {[
              {
                icon: "/9100_1_2_10.jpg",
                title: "Daily High Price Prediction",
                desc: "Get tomorrow’s predicted high price for your selected stock using advanced machine learning models — so you can plan ahead with confidence.",
              },
              {
                icon: "/6200_6_02.jpg",
                title: "Interactive Stock Charts",
                desc: "Explore historical data and price movements with beautiful, interactive charts that update in real-time to give you the full market picture.",
              },
              {
                icon: "/6200_6_01.jpg",
                title: "Latest Market News",
                desc: "Stay informed with the most relevant and recent stock-related news curated specifically for your selected company.",
              },
              {
                icon: "/1234_2 .jpg",
                title: "Hold or Sell Suggestions",
                desc: "Not sure what to do? Let our AI suggest whether to hold or sell based on market trends, sentiment, and price predictions.",
              },
            ].map(({ icon, title, desc }, i) => (
              <div className="flex items-start gap-8" key={i}>
                <img src={icon} alt="Icon" className="w-12 h-12 object-contain mt-1" />
                <div>
                  <h4 className="text-base font-semibold">{title}</h4>
                  <p className="text-gray-400 text-sm">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PREDICTION SECTION */}
      <section className="predict py-16 px-4 text-white" id="predict">
        <h3 className="text-4xl font-extrabold text-green-400 text-center drop-shadow-[0_0_10px_rgba(34,197,94,0.7)] mb-10">
          Predict Stock High & Close
        </h3>

        <div className="max-w-2xl mx-auto flex flex-col gap-6 items-center w-full">
          <div className="w-full flex flex-col items-center gap-4">
            <div className="w-full">
              <label className="block text-sm font-medium text-gray-300 mb-1 text-center">Ticker Symbol</label>
              <input
                type="text"
                placeholder="e.g., AAPL"
                className="w-full px-4 py-3 bg-[#1B1B1B] border border-gray-600 rounded-md text-center"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
              />
            </div>
            <button
              className="px-4 py-2 bg-blue-500 text-white font-semibold rounded-md hover:bg-blue-400 transition"
              onClick={fetchOHLCV}
            >
              Fetch Latest Data
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
            <InputField label="Open" value={open} onChange={setOpen} />
            <InputField label="High" value={high} onChange={setHigh} />
            <InputField label="Low" value={low} onChange={setLow} />
            <InputField label="Close" value={close} onChange={setClose} />
          </div>

          <div className="w-full">
            <label className="block text-sm font-medium text-gray-300 mb-1">Volume</label>
            <input
              type="number"
              step="any"
              placeholder="Volume"
              className="w-full px-4 py-3 bg-[#1B1B1B] border border-gray-600 rounded-md"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
            />
          </div>

          <button
            className="mt-4 px-6 py-3 bg-green-400 text-black font-semibold rounded-md hover:bg-green-300 transition"
            onClick={getPrediction}
          >
            Predict
          </button>

          {(prediction !== null || predictionClose !== null) && (
            <div className="prediction-result mt-6 flex flex-col md:flex-row gap-4 justify-center items-center w-full">
              {prediction !== null && (
                <div className="p-6 bg-[#1B1B1B] border border-green-500 rounded-xl shadow-lg text-2xl font-bold text-green-400 text-center w-full md:w-3/4">
                  Predicted High: {prediction}
                </div>
              )}
              {predictionClose !== null && (
                <div className="p-6 bg-[#1B1B1B] border border-blue-500 rounded-xl shadow-lg text-2xl font-bold text-blue-400 text-center w-full md:w-3/4">
                  Predicted Close: {predictionClose}
                </div>
              )}
            </div>
          )}
        </div>
      </section>


{/* MORE STAT SECTION */}
<section className="more-stat-section py-12 px-4 text-white text-center" id="MoreStats">
  <p className="text-lg text-gray-300">
    To know more about the stock, you can visit here
    <a
      href="https://stock-predict-mnvrzbbrudp6ogzysajaqo.streamlit.app/"
      target="_blank"
      rel="noopener noreferrer"
      className="ml-2 inline-block px-4 py-2 bg-green-500 text-black font-semibold rounded-md hover:bg-green-400 transition"
    >
      Know More
    </a>
  </p>
</section>





            {/* NEWS SECTION */}
      <section className="news-section py-16 px-8 text-white" id="News">
        <h2 className="text-3xl font-bold mb-6 text-green-400 text-center">
          Latest News on {selectedStock?.description?.toUpperCase() || ticker}
        </h2>

        <div className="news-cards">
          {(showAllNews ? news : news.slice(0, 4)).map((article, idx) => (
            <a
              key={idx}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="news-card"
            >
              <h3 className="text-lg font-semibold text-white mb-2">{article.title}</h3>
              <p className="text-sm text-gray-400">
                {article.description?.slice(0, 100)}...
              </p>
              <div className="mt-3 text-xs text-gray-500">
                {new Date(article.publishedAt).toLocaleString()}
              </div>
            </a>
          ))}
        </div>

        {news.length > 4 && (
          <div className="text-center mt-8">
            <button
              className="primary-btn"
              onClick={() => setShowAllNews(!showAllNews)}
            >
              {showAllNews ? 'Show Less' : 'More News'}
            </button>
          </div>
        )}
      </section>


      {/* FOOTER */}
<footer className="footer bg-black text-gray-400 py-10 px-8 border-t border-gray-800">
  <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
    {/* Company */}
    <div>
      <h4 className="text-white font-bold mb-2">StockPredict</h4>
      <p>Empowering your trading decisions with AI-driven predictions and real-time data.</p>
    </div>

    {/* Navigation */}
    <div>
      <h4 className="text-white font-bold mb-2">Quick Links</h4>
      <ul className="space-y-1">
        <li><a href="#features" className="hover:text-green-400">Features</a></li>
        <li><a href="#prices" className="hover:text-green-400">News</a></li>
        <li><a href="#testimonials" className="hover:text-green-400">Charts</a></li>
        <li><a href="#predict" className="hover:text-green-400">Start Predicting</a></li>
      </ul>
    </div>

    {/* Contact & Team */}
    <div>
      <h4 className="text-white font-bold mb-2">Made with <span className="text-red-400">❤</span> and effort by finance Team</h4>
      <ul className="space-y-1">
        <li>1. <a
        href='https://github.com/MehulEXE'
        target='_blank'
        rel='noopener noreferrer'
        className="text-green-400 hover:underline hover:text-pink-400"
       >Mehul</a></li>
        <li>2. Prisha</li>
        <li>3. Pooja</li>
      </ul>
    </div>
  </div>

  {/* Bottom Line */}
  <div className="text-center mt-8 border-t border-gray-700 pt-6 text-xs text-gray-500">
    © {new Date().getFullYear()} StockPredict. All rights reserved.
  </div>
</footer>

    </div>
  );
}

// ✅ Utility Component to keep input code DRY
const InputField = ({ label, value, onChange }) => (
  <div>
    <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
    <input
      type="number"
      step="any"
      placeholder={`${label} Price`}
      className="w-full px-4 py-3 bg-[#1B1B1B] border border-gray-600 rounded-md"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

export default App;
