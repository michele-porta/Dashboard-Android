import { 
    initClock, showToast, updateCardStatus, renderBitcoinPrice, renderBitcoinChart, 
    renderWeather, renderNewsList, renderCommodities, renderDashboardData, 
    renderSportsMatches, renderCalciomercatoNews, handleSportsTabSwitch, resetDashboardDataUI
} from './ui.js';

import { 
    fetchBitcoinPrice, fetchBitcoinChart, fetchWeather, fetchNews, 
    fetchCommodities, fetchDashboardData
} from './api.js';

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

let newsArticles = [];
let activeNewsIndex = 0;
let newsRotationInterval = null;
let activeSportsLeague = "calciomercato";
let sportsData = {};

document.addEventListener("DOMContentLoaded", () => {
    initClock();
    refreshDashboard();
    
    document.getElementById("refresh-btn").addEventListener("click", refreshDashboard);
    
    document.querySelectorAll(".sports-tab").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const league = e.target.getAttribute("data-league");
            if (league) switchSportsLeague(league);
        });
    });
});

async function refreshDashboard() {
    const btn = document.getElementById("refresh-btn");
    btn.classList.add("loading");
    await Promise.allSettled([
        updateBitcoin(), updateWeatherWidget(), 
        updateNewsWidget(), updateCommoditiesWidget(), updateDashboardDataWidget()
    ]);
    setTimeout(() => btn.classList.remove("loading"), 600);
}

async function updateBitcoin() {
    try {
        const data = await fetchBitcoinPrice();
        renderBitcoinPrice(data);
    } catch (e) {
        showToast("Errore nell'aggiornamento di Bitcoin.");
        updateCardStatus("btc-section", "btc-update-time", false);
    }
    
    try {
        const rawData = await fetchBitcoinChart();
        renderBitcoinChart(rawData);
    } catch (e) {
        console.error(e);
    }
}

async function updateWeatherWidget() {
    try {
        const data = await fetchWeather();
        renderWeather(data, WEATHER_MAP);
    } catch (e) {
        showToast("Impossibile caricare il meteo per Fidenza.");
        updateCardStatus("weather-section", "weather-update-time", false);
    }
}

async function updateNewsWidget() {
    try {
        const data = await fetchNews();
        newsArticles = data.items
            .sort((a, b) => new Date(b.pubDate.replace(/-/g, "/")) - new Date(a.pubDate.replace(/-/g, "/")))
            .slice(0, 5);
            
        activeNewsIndex = 0;
        
        renderNewsList(newsArticles, activeNewsIndex, onSelectNews);
        
        if (newsRotationInterval) clearInterval(newsRotationInterval);
        startNewsRotation();
        
        updateCardStatus("news-section", "news-update-time", true);
    } catch (e) {
        showToast("Errore nel recupero delle notizie del giorno.");
        updateCardStatus("news-section", "news-update-time", false);
    }
}

function onSelectNews(index) {
    if (index === activeNewsIndex) return;
    activeNewsIndex = index;
    renderNewsList(newsArticles, activeNewsIndex, onSelectNews);
    
    if (newsRotationInterval) clearInterval(newsRotationInterval);
    startNewsRotation();
}

function startNewsRotation() {
    newsRotationInterval = setInterval(() => {
        if (newsArticles.length) {
            activeNewsIndex = (activeNewsIndex + 1) % newsArticles.length;
            renderNewsList(newsArticles, activeNewsIndex, onSelectNews);
        }
    }, 30000);
}

async function updateCommoditiesWidget() {
    try {
        const { goldPriceGram, changePct } = await fetchCommodities();
        renderCommodities(goldPriceGram, changePct);
    } catch (e) {
        showToast("Errore nel recupero delle quotazioni oro.");
        updateCardStatus("commodities-section", "commodities-update-time", false);
    }
}

async function updateDashboardDataWidget() {
    try {
        const data = await fetchDashboardData();
        renderDashboardData(data);
        
        sportsData = data.sports || {};
        updateSportsDataUI();
    } catch (e) {
        resetDashboardDataUI();
        sportsData = {};
        updateSportsDataUI();
        
        updateCardStatus("canteen-section", "canteen-update-time", false);
        showToast("Errore nel caricamento del menù e delle tariffe.");
    }
}

function updateSportsDataUI() {
    try {
        if (activeSportsLeague === "calciomercato") {
            const data = sportsData["calciomercato"] || [];
            renderCalciomercatoNews(data);
        } else {
            const data = sportsData[activeSportsLeague] || { past: [], next: [] };
            renderSportsMatches(data.past, data.next);
        }
        updateCardStatus("sports-section", "sports-update-time", true);
    } catch (e) {
        console.error("Sports render error:", e);
        updateCardStatus("sports-section", "sports-update-time", false);
    }
}

function switchSportsLeague(league) {
    if (league === activeSportsLeague) return;
    activeSportsLeague = league;
    handleSportsTabSwitch(league);
    updateSportsDataUI();
}
