const FIDENZA_LAT = 44.8659, FIDENZA_LON = 10.0631;
const API_BTC_TICKER = "https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT";
const API_BTC_KLINES = "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=8";
const API_WEATHER = `https://api.open-meteo.com/v1/forecast?latitude=${FIDENZA_LAT}&longitude=${FIDENZA_LON}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_probability_max&timezone=Europe/Rome`;


const WEATHER_MAP = {
    0: { desc: "Sereno", icon: "sun" }, 1: { desc: "Prevalentemente sereno", icon: "cloud-sun" },
    2: { desc: "Parzialmente nuvoloso", icon: "cloud-sun" }, 3: { desc: "Nuvoloso", icon: "cloud" },
    45: { desc: "Nebbia", icon: "cloud-fog" }, 48: { desc: "Nebbia con brina", icon: "cloud-fog" },
    51: { desc: "Pioggerella leggera", icon: "cloud-drizzle" }, 53: { desc: "Pioggerella mod.", icon: "cloud-drizzle" },
    55: { desc: "Pioggerella densa", icon: "cloud-drizzle" }, 56: { desc: "Pioggerella gelida", icon: "snowflake" },
    57: { desc: "Pioggerella gelida int.", icon: "snowflake" }, 61: { desc: "Pioggia leggera", icon: "cloud-rain" },
    63: { desc: "Pioggia moderata", icon: "cloud-rain" }, 65: { desc: "Pioggia forte", icon: "cloud-rain-wind" },
    66: { desc: "Pioggia gelida leg.", icon: "snowflake" }, 67: { desc: "Pioggia gelida forte", icon: "snowflake" },
    71: { desc: "Neve leggera", icon: "snowflake" }, 73: { desc: "Neve moderata", icon: "snowflake" },
    75: { desc: "Neve intensa", icon: "snowflake" }, 77: { desc: "Nevischio", icon: "snowflake" },
    80: { desc: "Rovesci pioggia deboli", icon: "cloud-rain" }, 81: { desc: "Rovesci pioggia forti", icon: "cloud-rain" },
    82: { desc: "Rovesci pioggia violenti", icon: "cloud-rain-wind" }, 85: { desc: "Rovesci neve deboli", icon: "snowflake" },
    86: { desc: "Rovesci neve forti", icon: "snowflake" }, 95: { desc: "Temporale", icon: "cloud-lightning" },
    96: { desc: "Temporale con grandine", icon: "cloud-lightning" }, 99: { desc: "Temporale violento", icon: "cloud-lightning" }
};

let btcChart = null;
let newsArticles = [];
let activeNewsIndex = 0;
let newsRotationInterval = null;

document.addEventListener("DOMContentLoaded", () => {
    initClock();
    refreshDashboard();
    document.getElementById("refresh-btn").addEventListener("click", refreshDashboard);
});

function initClock() {
    const timeEl = document.querySelector("#live-clock .time");
    const dateEl = document.querySelector("#live-clock .date");
    setInterval(() => {
        const now = new Date();
        timeEl.textContent = now.toLocaleTimeString('it-IT');
        let dateString = now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        dateEl.textContent = dateString.charAt(0).toUpperCase() + dateString.slice(1);
    }, 1000);
}

async function refreshDashboard() {
    const btn = document.getElementById("refresh-btn");
    btn.classList.add("loading");
    await Promise.allSettled([
        updateBitcoinPrice(), updateBitcoinChart(), updateWeather(), 
        updateNews(), updateCommodities(), updateDashboardData()
    ]);
    setTimeout(() => btn.classList.remove("loading"), 600);
}

function updateCardStatus(sectionId, updateTimeId, isOnline) {
    document.getElementById(updateTimeId).textContent = isOnline ? `Ultimo agg.: ${formatCurrentTime()}` : "Aggiornamento fallito";
    const status = document.getElementById(sectionId).querySelector(".status-indicator");
    status.className = `status-indicator ${isOnline ? 'online' : 'offline'}`;
}

function formatCurrentTime() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function updateTrend(badgeEl, changeEl, iconEl, changePct) {
    changeEl.textContent = `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`;
    badgeEl.className = `${badgeEl.className.split(' ')[0]} ${changePct >= 0 ? 'up' : 'down'}`;
    iconEl.setAttribute("data-lucide", changePct >= 0 ? "trending-up" : "trending-down");
}

function fillList(containerId, items) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";
    if (items.length === 0) {
        container.innerHTML = "<li>Dato non disponibile</li>";
        return;
    }
    items.forEach(text => {
        const li = document.createElement("li");
        li.textContent = text;
        container.appendChild(li);
    });
}

function escapeHTML(str) {
    if (!str) return "";
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

function showToast(message) {
    const toast = document.getElementById("toast");
    document.getElementById("toast-message").textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 4000);
}

async function updateBitcoinPrice() {
    try {
        const response = await fetch(API_BTC_TICKER);
        if (!response.ok) throw new Error();
        const data = await response.json();
        
        document.getElementById("btc-price").textContent = parseFloat(data.lastPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        document.getElementById("btc-high").textContent = "$" + parseFloat(data.highPrice).toLocaleString('en-US', { maximumFractionDigits: 0 });
        document.getElementById("btc-low").textContent = "$" + parseFloat(data.lowPrice).toLocaleString('en-US', { maximumFractionDigits: 0 });
        
        updateTrend(
            document.getElementById("btc-change-badge"),
            document.getElementById("btc-change-pct"),
            document.getElementById("btc-trend-icon"),
            parseFloat(data.priceChangePercent)
        );
        updateCardStatus("btc-section", "btc-update-time", true);
        lucide.createIcons();
    } catch {
        showToast("Errore nell'aggiornamento di Bitcoin.");
        updateCardStatus("btc-section", "btc-update-time", false);
    }
}

async function updateBitcoinChart() {
    try {
        const response = await fetch(API_BTC_KLINES);
        if (!response.ok) return;
        const rawData = await response.json();
        
        const prices = [], labels = [];
        const startIndex = Math.max(0, rawData.length - 7);
        for (let i = startIndex; i < rawData.length; i++) {
            prices.push(parseFloat(rawData[i][4]));
            labels.push(new Date(rawData[i][0]).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }));
        }
        
        const ctx = document.getElementById('btc-chart').getContext('2d');
        if (btcChart) btcChart.destroy();
        
        const gradient = ctx.createLinearGradient(0, 0, 0, 150);
        gradient.addColorStop(0, 'rgba(247, 147, 26, 0.25)');
        gradient.addColorStop(1, 'rgba(247, 147, 26, 0.0)');
        
        btcChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    data: prices,
                    borderColor: '#f7931a',
                    borderWidth: 3,
                    pointBackgroundColor: '#f7931a',
                    pointBorderColor: '#ffffff',
                    pointRadius: 3,
                    fill: true,
                    backgroundColor: gradient,
                    tension: 0.35
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 9 } } },
                    y: { grid: { color: 'rgba(255, 255, 255, 0.03)' }, ticks: { color: '#64748b', font: { size: 9 }, callback: v => '$' + (v / 1000) + 'k' } }
                }
            }
        });
    } catch (e) {
        console.error(e);
    }
}

async function updateWeather() {
    try {
        const response = await fetch(API_WEATHER);
        if (!response.ok) throw new Error();
        const data = await response.json();
        
        const temp = Math.round(data.current.temperature_2m);
        const wInfo = WEATHER_MAP[data.current.weather_code] || { desc: "Meteo Variabile", icon: "cloud" };
        
        document.getElementById("current-temp").textContent = temp;
        document.getElementById("weather-desc").textContent = wInfo.desc;
        document.getElementById("weather-main-icon").innerHTML = `<i data-lucide="${wInfo.icon}" class="animated-icon"></i>`;
        
        document.getElementById("weather-today-range").textContent = `${Math.round(data.daily.temperature_2m_max[0])}°C / ${Math.round(data.daily.temperature_2m_min[0])}°C`;
        document.getElementById("weather-rain").textContent = `${data.current.precipitation} mm`;
        document.getElementById("weather-wind").textContent = `${data.current.wind_speed_10m} km/h`;
        document.getElementById("weather-uv").textContent = data.daily.uv_index_max[0].toFixed(1);
        
        const forecastContainer = document.getElementById("forecast-container");
        forecastContainer.innerHTML = "";
        
        for (let i = 1; i <= 3; i++) {
            let code = data.daily.weather_code[i];
            const prob = data.daily.precipitation_probability_max[i];
            if (prob <= 30 && [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) {
                code = 2;
            }
            const fInfo = WEATHER_MAP[code] || { desc: "N/A", icon: "cloud" };
            forecastContainer.insertAdjacentHTML('beforeend', `
                <div class="forecast-day-card">
                    <span class="forecast-day-name">${new Date(data.daily.time[i]).toLocaleDateString('it-IT', { weekday: 'short' })}</span>
                    <div class="forecast-icon" title="${fInfo.desc}"><i data-lucide="${fInfo.icon}"></i></div>
                    <span class="forecast-temp">${Math.round(data.daily.temperature_2m_max[i])}° <span class="forecast-temp-min">${Math.round(data.daily.temperature_2m_min[i])}°</span></span>
                    <span class="forecast-rain"><i data-lucide="droplets"></i> ${prob}%</span>
                </div>
            `);
        }
        updateCardStatus("weather-section", "weather-update-time", true);
        lucide.createIcons();
    } catch {
        showToast("Impossibile caricare il meteo per Fidenza.");
        updateCardStatus("weather-section", "weather-update-time", false);
    }
}

async function updateNews() {
    try {
        // Bypass rss2json cache by attaching a timestamp directly to the ANSA feed URL
        const feedUrl = `https://www.ansa.it/sito/ansait_rss.xml?_cb=${Date.now()}`;
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`;
        const response = await fetch(`${apiUrl}&_t=${Date.now()}`);
        if (!response.ok) throw new Error();
        const data = await response.json();
        
        newsArticles = data.items
            .sort((a, b) => new Date(b.pubDate.replace(/-/g, "/")) - new Date(a.pubDate.replace(/-/g, "/")))
            .slice(0, 5);
            
        activeNewsIndex = 0;
        renderNews();
        
        if (newsRotationInterval) clearInterval(newsRotationInterval);
        startNewsRotation();
        
        updateCardStatus("news-section", "news-update-time", true);
    } catch {
        showToast("Errore nel recupero delle notizie del giorno.");
        updateCardStatus("news-section", "news-update-time", false);
    }
}

function renderNews() {
    if (!newsArticles.length) return;
    
    const container = document.getElementById("news-container");
    container.innerHTML = "";
    
    // 1. Render Featured News Card
    const featured = newsArticles[activeNewsIndex];
    const featuredTimeAgo = formatTimeAgo(featured.pubDate);
    const safeFeaturedTitle = escapeHTML(featured.title);
    const safeFeaturedLink = (featured.link && (featured.link.startsWith('http://') || featured.link.startsWith('https://'))) ? featured.link : '#';
    const safeFeaturedThumbnail = (featured.thumbnail && (featured.thumbnail.startsWith('http://') || featured.thumbnail.startsWith('https://'))) ? featured.thumbnail : '';
    
    const featuredImageHTML = safeFeaturedThumbnail 
        ? `<img src="${safeFeaturedThumbnail}" class="news-img" alt="Notizia" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
           <div class="news-fallback-featured" style="display:none;">
               <i data-lucide="newspaper"></i>
               <span>ANSA NEWS</span>
           </div>`
        : `<div class="news-fallback-featured">
               <i data-lucide="newspaper"></i>
               <span>ANSA NEWS</span>
           </div>`;
           
    let html = `
        <a href="${safeFeaturedLink}" target="_blank" rel="noopener noreferrer" class="news-item featured-news fade-in">
            <div class="news-img-featured-wrapper">${featuredImageHTML}</div>
            <div class="news-content-featured">
                <span class="news-badge-featured">In Evidenza</span>
                <h3 class="news-title-featured" title="${safeFeaturedTitle}">${safeFeaturedTitle}</h3>
                <div class="news-meta">
                    <span class="news-source">ANSA.it</span>
                    <span class="news-date"><i data-lucide="clock"></i> ${featuredTimeAgo}</span>
                </div>
            </div>
        </a>
    `;
    
    // 2. Render List of Headline Selectors
    let listHTML = `<div class="news-list">`;
    newsArticles.forEach((art, index) => {
        const timeAgo = formatTimeAgo(art.pubDate);
        const safeTitle = escapeHTML(art.title);
        const safeThumbnail = (art.thumbnail && (art.thumbnail.startsWith('http://') || art.thumbnail.startsWith('https://'))) ? art.thumbnail : '';
        const isActive = index === activeNewsIndex;
        
        const imageHTML = safeThumbnail 
            ? `<img src="${safeThumbnail}" class="news-img" alt="Notizia" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
               <div class="news-fallback-standard" style="display:none;">
                   <i data-lucide="newspaper"></i>
               </div>`
            : `<div class="news-fallback-standard">
                   <i data-lucide="newspaper"></i>
               </div>`;
               
        listHTML += `
            <div class="news-item-clickable" onclick="selectNewsArticle(${index})">
                <div class="news-item ${isActive ? 'active-selector' : ''}">
                    <div class="news-img-wrapper">${imageHTML}</div>
                    <div class="news-content">
                        <h4 class="news-title" title="${safeTitle}">${safeTitle}</h4>
                        <div class="news-meta">
                            <span class="news-source">ANSA.it</span>
                            <span class="news-date"><i data-lucide="clock"></i> ${timeAgo}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    listHTML += `</div>`;
    
    html += listHTML;
    container.innerHTML = html;
    
    lucide.createIcons();
}

function selectNewsArticle(index) {
    if (index === activeNewsIndex) return;
    activeNewsIndex = index;
    renderNews();
    
    if (newsRotationInterval) clearInterval(newsRotationInterval);
    startNewsRotation();
}

function startNewsRotation() {
    newsRotationInterval = setInterval(() => {
        if (newsArticles.length) {
            activeNewsIndex = (activeNewsIndex + 1) % newsArticles.length;
            renderNews();
        }
    }, 30000);
}

function formatTimeAgo(pubDateStr) {
    if (!pubDateStr) return "recentemente";
    const diffMins = Math.floor((new Date() - new Date(pubDateStr)) / 60000);
    if (diffMins < 1) return "ora";
    if (diffMins < 60) return `${diffMins} min fa`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} ore fa`;
    return `${Math.floor(diffHours / 24)} gg fa`;
}

async function updateCommodities() {
    try {
        const [paxgRes, eurRes] = await Promise.all([
            fetch("https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT"),
            fetch("https://api.binance.com/api/v3/ticker/price?symbol=EURUSDT")
        ]);
        if (!paxgRes.ok || !eurRes.ok) throw new Error();
        
        const goldPriceGram = (parseFloat((await paxgRes.json()).price) / parseFloat((await eurRes.json()).price)) / 31.1034768;
        
        const changeRes = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=PAXGUSDT");
        const changePct = changeRes.ok ? parseFloat((await changeRes.json()).priceChangePercent) : 0;
        
        document.getElementById("gold-price").textContent = goldPriceGram.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        updateTrend(
            document.getElementById("gold-change-group"),
            document.getElementById("gold-change-pct"),
            document.getElementById("gold-trend-icon"),
            changePct
        );
        updateCardStatus("commodities-section", "commodities-update-time", true);
        lucide.createIcons();
    } catch {
        showToast("Errore nel recupero delle quotazioni oro.");
        updateCardStatus("commodities-section", "commodities-update-time", false);
    }
}

async function updateDashboardData() {
    try {
        const response = await fetch(`dashboard_data.json?_t=${Date.now()}`);
        if (!response.ok) throw new Error();
        const data = await response.json();
        
        document.getElementById("canteen-date").textContent = data.date || "OGGI";
        fillList("canteen-primi", data.primi);
        fillList("canteen-secondi", data.secondi);
        fillList("canteen-contorni", data.contorni);
        
        document.getElementById("fuel-price").textContent = data.gas_price || "--.--";
        
        // Octopus Tariffs
        document.getElementById("oct-luce-price").textContent = data.oct_luce_price || "--.----";
        document.getElementById("oct-luce-fee").textContent = data.oct_luce_fee || "--";
        document.getElementById("oct-gas-price").textContent = data.oct_gas_price || "--.--";
        document.getElementById("oct-gas-fee").textContent = data.oct_gas_fee || "--";
        
        updateCardStatus("canteen-section", "canteen-update-time", true);
        lucide.createIcons();
    } catch {
        fillList("canteen-primi", []);
        fillList("canteen-secondi", []);
        fillList("canteen-contorni", []);
        document.getElementById("fuel-price").textContent = "--.--";
        document.getElementById("oct-luce-price").textContent = "--.----";
        document.getElementById("oct-luce-fee").textContent = "--";
        document.getElementById("oct-gas-price").textContent = "--.--";
        document.getElementById("oct-gas-fee").textContent = "--";
        updateCardStatus("canteen-section", "canteen-update-time", false);
        showToast("Errore nel caricamento del menù e delle tariffe.");
    }
}
