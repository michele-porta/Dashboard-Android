import { escapeHTML, formatCurrentTime, formatTimeAgo, sanitizeUrl } from './utils.js';

let btcChart = null;

export function initClock() {
    const timeEl = document.querySelector("#live-clock .time");
    const dateEl = document.querySelector("#live-clock .date");
    setInterval(() => {
        const now = new Date();
        timeEl.textContent = now.toLocaleTimeString('it-IT');
        let dateString = now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        dateEl.textContent = dateString.charAt(0).toUpperCase() + dateString.slice(1);
    }, 1000);
}

export function showToast(message) {
    const toast = document.getElementById("toast");
    document.getElementById("toast-message").textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 4000);
}

export function updateCardStatus(sectionId, updateTimeId, isOnline) {
    document.getElementById(updateTimeId).textContent = isOnline ? `Ultimo agg.: ${formatCurrentTime()}` : "Aggiornamento fallito";
    const status = document.getElementById(sectionId).querySelector(".status-indicator");
    status.className = `status-indicator ${isOnline ? 'online' : 'offline'}`;
}

export function updateTrend(badgeEl, changeEl, iconEl, changePct) {
    changeEl.textContent = `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`;
    badgeEl.className = `${badgeEl.className.split(' ')[0]} ${changePct >= 0 ? 'up' : 'down'}`;
    iconEl.setAttribute("data-lucide", changePct >= 0 ? "trending-up" : "trending-down");
}

export function fillList(containerId, items) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";
    if (!items || items.length === 0) {
        container.innerHTML = "<li>Dato non disponibile</li>";
        return;
    }
    items.forEach(text => {
        const li = document.createElement("li");
        li.textContent = text;
        container.appendChild(li);
    });
}

export function renderBitcoinPrice(data) {
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
    if (window.lucide) window.lucide.createIcons();
}

export function renderBitcoinChart(rawData) {
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
}

export function renderWeather(data, WEATHER_MAP) {
    const temp = Math.round(data.current.temperature_2m);
    const wInfo = WEATHER_MAP[data.current.weather_code] || { desc: "Meteo Variabile", icon: "cloud" };
    
    document.getElementById("current-temp").textContent = temp;
    document.getElementById("weather-desc").textContent = wInfo.desc;
    document.getElementById("weather-main-icon").innerHTML = `<i data-lucide="${escapeHTML(wInfo.icon)}" class="animated-icon"></i>`;
    
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
        const dayName = new Date(data.daily.time[i]).toLocaleDateString('it-IT', { weekday: 'short' });
        
        forecastContainer.insertAdjacentHTML('beforeend', `
            <div class="forecast-day-card">
                <span class="forecast-day-name">${escapeHTML(dayName)}</span>
                <div class="forecast-icon" title="${escapeHTML(fInfo.desc)}"><i data-lucide="${escapeHTML(fInfo.icon)}"></i></div>
                <span class="forecast-temp">${Math.round(data.daily.temperature_2m_max[i])}° <span class="forecast-temp-min">${Math.round(data.daily.temperature_2m_min[i])}°</span></span>
                <span class="forecast-rain"><i data-lucide="droplets"></i> ${prob}%</span>
            </div>
        `);
    }
    updateCardStatus("weather-section", "weather-update-time", true);
    if (window.lucide) window.lucide.createIcons();
}

export function renderNewsList(newsArticles, activeNewsIndex, onSelectNews) {
    if (!newsArticles || !newsArticles.length) return;
    const container = document.getElementById("news-container");
    
    const featured = newsArticles[activeNewsIndex];
    const featuredTimeAgo = formatTimeAgo(featured.pubDate);
    const safeFeaturedTitle = escapeHTML(featured.title);
    const safeFeaturedLink = sanitizeUrl(featured.link) || '#';
    const safeFeaturedThumbnail = sanitizeUrl(featured.thumbnail);
    
    container.innerHTML = "";
    
    const featuredA = document.createElement("a");
    featuredA.href = safeFeaturedLink;
    featuredA.target = "_blank";
    featuredA.rel = "noopener noreferrer";
    featuredA.className = "news-item featured-news fade-in";
    
    const imgWrapperF = document.createElement("div");
    imgWrapperF.className = "news-img-featured-wrapper";
    
    const fallbackF = document.createElement("div");
    fallbackF.className = "news-fallback-featured";
    fallbackF.style.display = safeFeaturedThumbnail ? "none" : "flex";
    fallbackF.innerHTML = `<i data-lucide="newspaper"></i><span>ANSA NEWS</span>`;

    if (safeFeaturedThumbnail) {
        const imgF = document.createElement("img");
        imgF.src = safeFeaturedThumbnail;
        imgF.className = "news-img";
        imgF.alt = "Notizia";
        imgF.addEventListener('error', () => {
            imgF.style.display = 'none';
            fallbackF.style.display = 'flex';
        });
        imgWrapperF.appendChild(imgF);
    }
    imgWrapperF.appendChild(fallbackF);
    
    const contentF = document.createElement("div");
    contentF.className = "news-content-featured";
    contentF.innerHTML = `
        <span class="news-badge-featured">In Evidenza</span>
        <h3 class="news-title-featured" title="${safeFeaturedTitle}">${safeFeaturedTitle}</h3>
        <div class="news-meta">
            <span class="news-source">ANSA.it</span>
            <span class="news-date"><i data-lucide="clock"></i> ${featuredTimeAgo}</span>
        </div>
    `;

    featuredA.appendChild(imgWrapperF);
    featuredA.appendChild(contentF);
    container.appendChild(featuredA);

    const listContainer = document.createElement("div");
    listContainer.className = "news-list";

    newsArticles.forEach((art, index) => {
        const timeAgo = formatTimeAgo(art.pubDate);
        const safeTitle = escapeHTML(art.title);
        const safeThumbnail = sanitizeUrl(art.thumbnail);
        const isActive = index === activeNewsIndex;

        const itemClickable = document.createElement("div");
        itemClickable.className = "news-item-clickable";
        itemClickable.addEventListener("click", () => onSelectNews(index));

        const itemDiv = document.createElement("div");
        itemDiv.className = `news-item ${isActive ? 'active-selector' : ''}`;
        
        const imgWrapperS = document.createElement("div");
        imgWrapperS.className = "news-img-wrapper";
        
        const fallbackS = document.createElement("div");
        fallbackS.className = "news-fallback-standard";
        fallbackS.style.display = safeThumbnail ? "none" : "flex";
        fallbackS.innerHTML = `<i data-lucide="newspaper"></i>`;
        
        if (safeThumbnail) {
            const imgS = document.createElement("img");
            imgS.src = safeThumbnail;
            imgS.className = "news-img";
            imgS.alt = "Notizia";
            imgS.addEventListener('error', () => {
                imgS.style.display = 'none';
                fallbackS.style.display = 'flex';
            });
            imgWrapperS.appendChild(imgS);
        }
        imgWrapperS.appendChild(fallbackS);
        
        const contentS = document.createElement("div");
        contentS.className = "news-content";
        contentS.innerHTML = `
            <h4 class="news-title" title="${safeTitle}">${safeTitle}</h4>
            <div class="news-meta">
                <span class="news-source">ANSA.it</span>
                <span class="news-date"><i data-lucide="clock"></i> ${timeAgo}</span>
            </div>
        `;
        
        itemDiv.appendChild(imgWrapperS);
        itemDiv.appendChild(contentS);
        itemClickable.appendChild(itemDiv);
        listContainer.appendChild(itemClickable);
    });

    container.appendChild(listContainer);
    if (window.lucide) window.lucide.createIcons();
}

export function renderCommodities(goldPriceGram, changePct) {
    document.getElementById("gold-price").textContent = goldPriceGram.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    updateTrend(
        document.getElementById("gold-change-group"),
        document.getElementById("gold-change-pct"),
        document.getElementById("gold-trend-icon"),
        changePct
    );
    updateCardStatus("commodities-section", "commodities-update-time", true);
    if (window.lucide) window.lucide.createIcons();
}

export function renderDashboardData(data) {
    document.getElementById("canteen-date").textContent = escapeHTML(data.date) || "OGGI";
    fillList("canteen-primi", data.primi);
    fillList("canteen-secondi", data.secondi);
    fillList("canteen-contorni", data.contorni);
    
    document.getElementById("fuel-price").textContent = escapeHTML(data.gas_price) || "--.--";
    
    document.getElementById("oct-luce-price").textContent = escapeHTML(data.oct_luce_price) || "--.----";
    document.getElementById("oct-luce-fee").textContent = escapeHTML(data.oct_luce_fee) || "--";
    document.getElementById("oct-gas-price").textContent = escapeHTML(data.oct_gas_price) || "--.--";
    document.getElementById("oct-gas-fee").textContent = escapeHTML(data.oct_gas_fee) || "--";
    
    updateCardStatus("canteen-section", "canteen-update-time", true);
}

export function renderSportsMatches(past, next) {
    const container = document.getElementById("sports-container");
    container.innerHTML = "";
    
    if (past.length === 0 && next.length === 0) {
        container.innerHTML = `<div class="sports-no-matches">Nessun match recente o in programma.</div>`;
        return;
    }
    
    if (past.length > 0) {
        const titleDiv = document.createElement('div');
        titleDiv.className = 'match-round';
        titleDiv.textContent = 'Ultimi Risultati';
        container.appendChild(titleDiv);
        
        past.forEach(match => {
            const homeScore = match.home_score !== null && match.home_score !== undefined ? match.home_score : "-";
            const awayScore = match.away_score !== null && match.away_score !== undefined ? match.away_score : "-";
            const homeBadge = sanitizeUrl(match.home_badge) || 'https://r2.thesportsdb.com/images/media/team/badge/placeholder.png';
            const awayBadge = sanitizeUrl(match.away_badge) || 'https://r2.thesportsdb.com/images/media/team/badge/placeholder.png';
            const homeName = escapeHTML(match.home);
            const awayName = escapeHTML(match.away);
            
            const matchItem = createMatchItem(homeName, homeBadge, awayName, awayBadge, `${homeScore} - ${awayScore}`, false);
            container.appendChild(matchItem);
        });
    }
    
    if (next.length > 0) {
        const titleDiv = document.createElement('div');
        titleDiv.className = 'match-round';
        titleDiv.style.marginTop = '1rem';
        titleDiv.textContent = 'Prossimi Incontri';
        container.appendChild(titleDiv);
        
        next.forEach(match => {
            const homeBadge = sanitizeUrl(match.home_badge) || 'https://r2.thesportsdb.com/images/media/team/badge/placeholder.png';
            const awayBadge = sanitizeUrl(match.away_badge) || 'https://r2.thesportsdb.com/images/media/team/badge/placeholder.png';
            const homeName = escapeHTML(match.home);
            const awayName = escapeHTML(match.away);
            
            let displayTime = "Da def.";
            if (match.date) {
                const parts = match.date.split("-");
                if (parts.length === 3) displayTime = `${parts[2]}/${parts[1]}`;
            }
            if (match.time) {
                const tParts = match.time.split(":");
                if (tParts.length >= 2) displayTime += ` ${tParts[0]}:${tParts[1]}`;
            }
            
            const matchItem = createMatchItem(homeName, homeBadge, awayName, awayBadge, displayTime, true);
            container.appendChild(matchItem);
        });
    }
}

function createMatchItem(homeName, homeBadge, awayName, awayBadge, centerText, isScheduled) {
    const item = document.createElement("div");
    item.className = "match-item";
    
    const homeDiv = document.createElement("div");
    homeDiv.className = "team-box home";
    
    const homeSpan = document.createElement("span");
    homeSpan.className = "team-name";
    homeSpan.title = homeName;
    homeSpan.textContent = homeName;
    
    const homeImg = document.createElement("img");
    homeImg.src = homeBadge;
    homeImg.className = "team-logo";
    homeImg.alt = homeName;
    homeImg.addEventListener('error', () => { homeImg.src = 'https://r2.thesportsdb.com/images/media/team/badge/placeholder.png'; });
    
    homeDiv.appendChild(homeSpan);
    homeDiv.appendChild(homeImg);
    
    const scoreDiv = document.createElement("div");
    scoreDiv.className = "score-box" + (isScheduled ? " scheduled" : "");
    if (!isScheduled) {
        const parts = centerText.split('-');
        scoreDiv.innerHTML = `<span>${escapeHTML(parts[0].trim())}</span><span>-</span><span>${escapeHTML(parts[1].trim())}</span>`;
    } else {
        scoreDiv.innerHTML = `<span>${escapeHTML(centerText)}</span>`;
    }

    const awayDiv = document.createElement("div");
    awayDiv.className = "team-box away";
    
    const awaySpan = document.createElement("span");
    awaySpan.className = "team-name";
    awaySpan.title = awayName;
    awaySpan.textContent = awayName;
    
    const awayImg = document.createElement("img");
    awayImg.src = awayBadge;
    awayImg.className = "team-logo";
    awayImg.alt = awayName;
    awayImg.addEventListener('error', () => { awayImg.src = 'https://r2.thesportsdb.com/images/media/team/badge/placeholder.png'; });
    
    awayDiv.appendChild(awayImg);
    awayDiv.appendChild(awaySpan);
    
    item.appendChild(homeDiv);
    item.appendChild(scoreDiv);
    item.appendChild(awayDiv);
    
    return item;
}

export function renderCalciomercatoNews(newsItems) {
    const container = document.getElementById("sports-container");
    container.innerHTML = "";
    
    if (!newsItems || newsItems.length === 0) {
        container.innerHTML = `<div class="sports-no-matches">Nessuna notizia di calciomercato disponibile.</div>`;
        return;
    }
    
    newsItems.forEach(item => {
        const linkElem = document.createElement("a");
        linkElem.href = item.link;
        linkElem.target = "_blank";
        linkElem.className = "match-item";
        linkElem.style.textDecoration = "none";
        linkElem.style.color = "inherit";
        linkElem.style.display = "flex";
        linkElem.style.flexDirection = "column";
        linkElem.style.alignItems = "flex-start";
        linkElem.style.gap = "0.25rem";
        
        const titleSpan = document.createElement("span");
        titleSpan.className = "team-name";
        titleSpan.style.width = "100%";
        titleSpan.style.whiteSpace = "normal";
        titleSpan.style.display = "-webkit-box";
        titleSpan.style.webkitLineClamp = "2";
        titleSpan.style.webkitBoxOrient = "vertical";
        titleSpan.style.overflow = "hidden";
        titleSpan.style.fontSize = "0.9rem";
        titleSpan.style.lineHeight = "1.3";
        titleSpan.textContent = item.title;
        
        const dateSpan = document.createElement("span");
        dateSpan.style.fontSize = "0.7rem";
        dateSpan.style.color = "var(--text-muted)";
        dateSpan.style.fontWeight = "600";
        dateSpan.textContent = item.date;
        
        linkElem.appendChild(titleSpan);
        linkElem.appendChild(dateSpan);
        container.appendChild(linkElem);
    });
}

export function handleSportsTabSwitch(league) {
    document.querySelectorAll(".sports-tab").forEach(tab => {
        tab.classList.remove("active");
    });
    const targetTab = document.getElementById(`tab-${league}`);
    if (targetTab) targetTab.classList.add("active");
}

export function resetDashboardDataUI() {
    fillList("canteen-primi", []);
    fillList("canteen-secondi", []);
    fillList("canteen-contorni", []);
    document.getElementById("fuel-price").textContent = "--.--";
    document.getElementById("oct-luce-price").textContent = "--.----";
    document.getElementById("oct-luce-fee").textContent = "--";
    document.getElementById("oct-gas-price").textContent = "--.--";
    document.getElementById("oct-gas-fee").textContent = "--";
}
