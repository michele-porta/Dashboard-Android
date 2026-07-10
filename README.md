# AuraDash - Smart Dashboard

AuraDash è una dashboard interattiva, moderna e responsiva progettata per tablet e PC. Mostra informazioni finanziarie in tempo reale, ultime notizie, risultati sportivi, tariffe energetiche e utilità locali.

---

## Funzionalità Principali

* **Bitcoin (BTC) & Oro (PAXG)**: Prezzo in tempo reale (Binance API), variazioni nelle 24h e grafico del trend degli ultimi 7 giorni con **Chart.js**.
* **Meteo (Fidenza)**: Temperatura, vento, pioggia, indice UV e previsioni a 3 giorni tramite **Open-Meteo API**.
* **Notizie (ANSA)**: Ultime notizie lette da feed RSS, elaborate in modo sicuro contro attacchi XSS.
* **Mensa & Carburanti**:
  - Menu del giorno della mensa Greenlife a **Parma** (Mila/Greenlife API).
  - Prezzo medio regionale della benzina self-service (dati MIMIT).
* **Tariffe Octopus Energy**: Monitoraggio in tempo reale dei costi di consumo e commercializzazione per Luce e Gas (Fissa 12M).
* **Risultati Sportivi (TheSportsDB)**: Ultimi incontri e prossimi match (con risultati e scudetti delle squadre) per Serie A, Champions League e World Cup.

---

## Architettura del Progetto

### 1. Frontend Modulare (ES6+)
Il codice JavaScript è stato completamente rifattorizzato da un blocco monolitico in moduli ES6 puliti situati nella cartella `/js`:
* `main.js`: Punto di ingresso, orchestrazione e gestione del ciclo di vita della pagina.
* `ui.js`: Generazione sicura del DOM e binding dei listener di evento.
* `api.js`: Centralizzazione di tutte le chiamate ad API esterne.
* `utils.js`: Funzioni di utilità per formattazione, gestione date ed escape HTML.

### 2. Sicurezza & Protezione XSS
* **Content Security Policy (CSP)**: Implementato un meta tag CSP rigido per limitare il caricamento delle risorse e prevenire code injection.
* **Rimozione Eventi Inline**: Eliminati tutti i gestori inline (`onclick`, `onerror`, ecc.) da HTML e stringhe dinamiche in favore di `addEventListener`.
* **Sanificazione DOM**: Implementata una funzione custom `escapeHTML` per sterilizzare qualsiasi input proveniente da feed esterni (ANSA/Sport).

---

## Scraper & Automazione CI/CD

Lo scraper headless estrae i dati complessi non disponibili tramite API pubbliche e li centralizza in `dashboard_data.json`:

1. **Scraping Headless (Python + Selenium)**: Estrae in modo asincrono i prezzi medi dei carburanti e le tariffe Octopus Energy.
2. **Localizzazione Fuso Orario (Europe/Rome)**: Configurato tramite `tzdata` per garantire che lo scraper calcoli correttamente i menù della mensa sul fuso orario italiano anche se eseguito su runner esteri.
3. **Resilienza WAF con Proxy Paralleli**: Per aggirare i blocchi `403 Forbidden` imposti dal server della mensa agli IP dei data center di GitHub Actions, lo scraper implementa un meccanismo di autoguarigione:
   - Tenta la connessione diretta tramite Selenium.
   - In caso di blocco, interroga le API di Geonode per ottenere **30 proxy freschi** e li testa **in parallelo** (utilizzando 15 worker threads). Il primo proxy valido che risponde entro 6 secondi viene usato per salvare il menù della mensa.
4. **Deploy statico ultra-rapido**: 
   - Workflow personalizzato `.github/workflows/static.yml` che scavalca il motore Jekyll tramite `.nojekyll`, riducendo i tempi di rilascio su GitHub Pages a soli 20-30 secondi.
   - Sblocco automatico integrato delle code di deploy in caso di crash delle pipeline precedenti.
5. **Schedulazione**: Il workflow gira su GitHub Actions ogni giorno alle **03:33 (ora italiana)**.

---

## Tecnologie Utilizzate

* **Frontend**: HTML5, CSS3 (Glassmorphism), JavaScript (ES6 Modules), Chart.js, Lucide Icons, Google Fonts.
* **Scraper & CI/CD**: Python 3.10 (Selenium, BeautifulSoup4, concurrent.futures), GitHub Actions, GitHub Pages.

---

## Sviluppo AI

Questo progetto è stato sviluppato, ottimizzato e configurato con il supporto di:
* **Antigravity**: L'assistente di programmazione AI di Google DeepMind.
* **Gemini 3.5 Flash (Medium)**: Il modello LLM che ha guidato lo sviluppo, l'audit di sicurezza, le ottimizzazioni di rete e la configurazione dell'automazione CI/CD.

