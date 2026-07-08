const FIDENZA_LAT = 44.8659, FIDENZA_LON = 10.0631;
const API_BTC_TICKER = "https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT";
const API_BTC_KLINES = "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=8";
const API_WEATHER = `https://api.open-meteo.com/v1/forecast?latitude=${FIDENZA_LAT}&longitude=${FIDENZA_LON}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_probability_max&timezone=Europe/Rome`;

export async function fetchBitcoinPrice() {
    const res = await fetch(API_BTC_TICKER);
    if (!res.ok) throw new Error("BTC Ticker API failed");
    return await res.json();
}

export async function fetchBitcoinChart() {
    const res = await fetch(API_BTC_KLINES);
    if (!res.ok) throw new Error("BTC Klines API failed");
    return await res.json();
}

export async function fetchWeather() {
    const res = await fetch(API_WEATHER);
    if (!res.ok) throw new Error("Weather API failed");
    return await res.json();
}

export async function fetchNews() {
    const feedUrl = `https://www.ansa.it/sito/ansait_rss.xml?_cb=${Date.now()}`;
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`;
    const res = await fetch(`${apiUrl}&_t=${Date.now()}`);
    if (!res.ok) throw new Error("News API failed");
    return await res.json();
}

export async function fetchCommodities() {
    const [paxgRes, eurRes, changeRes] = await Promise.all([
        fetch("https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT"),
        fetch("https://api.binance.com/api/v3/ticker/price?symbol=EURUSDT"),
        fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=PAXGUSDT")
    ]);
    if (!paxgRes.ok || !eurRes.ok) throw new Error("Commodities API failed");
    
    const paxg = await paxgRes.json();
    const eur = await eurRes.json();
    const goldPriceGram = (parseFloat(paxg.price) / parseFloat(eur.price)) / 31.1034768;
    
    const changePct = changeRes.ok ? parseFloat((await changeRes.json()).priceChangePercent) : 0;
    
    return { goldPriceGram, changePct };
}

export async function fetchDashboardData() {
    const res = await fetch(`dashboard_data.json?_t=${Date.now()}`);
    if (!res.ok) throw new Error("Dashboard Data API failed");
    return await res.json();
}
