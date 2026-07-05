# AuraDash - Smart Dashboard

AuraDash è una dashboard interattiva, moderna e responsiva progettata per tablet e PC. Mostra informazioni finanziarie in tempo reale, ultime notizie e utilità locali.

---

## Funzionalità Principali

* **Bitcoin (BTC)**: Prezzo in tempo reale (Binance API), variazioni nelle 24h e grafico del trend degli ultimi 7 giorni con **Chart.js**.
* **Meteo (Fidenza)**: Temperatura, vento, pioggia, indice UV e previsioni a 3 giorni tramite **Open-Meteo API**.
* **Notizie (ANSA)**: Ultime notizie lette da feed RSS, sanificate contro attacchi DOM-based XSS.
* **Quotazione Oro**: Prezzo dell'oro al grammo in EUR (via API Binance PAXG/EUR).
* **Mensa & Carburanti**: 
  - Menu del giorno della mensa Greenlife a **Parma**.
  - Prezzo medio regionale della benzina self-service (dati MIMIT).

---

## Architettura e Automazione

L'applicazione è serverless e non richiede un PC/server locale sempre acceso:
1. **Frontend (Netlify)**: Sito statico responsivo (HTML5/CSS3/JS) ospitato gratuitamente su Netlify.
2. **Scraper (Python + Selenium)**: Script Python (`update_data.py`) in modalità headless che estrae i dati di utenze, mensa e carburante.
3. **Automazione (GitHub Actions)**: Un workflow automatico (`.github/workflows/update_data.yml`) esegue lo scraper ogni giorno alle **07:00 del mattino** (ora italiana), aggiorna `dashboard_data.json` e lo carica nel repository, aggiornando in tempo reale il sito web.

---

## Tecnologie Utilizzate

* **Frontend**: HTML5, CSS3 (Glassmorphism), JavaScript (ES6+), Chart.js, Lucide Icons, Google Fonts.
* **Scraper & CI/CD**: Python 3.10 (Selenium, BeautifulSoup4), GitHub Actions, Netlify.

---

## Sviluppo AI

Questo progetto è stato sviluppato e configurato con il supporto di:
* **Antigravity**: L'assistente di programmazione AI di Google DeepMind.
* **Gemini 3.5 Flash (Medium)**: Il modello LLM che ha guidato la scrittura del codice, l'audit di sicurezza e la configurazione del deployment.
