import time
import json
import re
import urllib.request
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def fetch_and_parse():
    print("=== Mensa Greenlife & MIMIT Fuel Scraper ===")
    chrome_options = Options()
    chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("--lang=it-IT")
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    chrome_options.add_experimental_option('useAutomationExtension', False)
    
    print("Avvio del browser headless...")
    driver = webdriver.Chrome(options=chrome_options)
    
    try:
        menu = {
            "primi": [], "secondi": [], "contorni": [], "date": "", "gas_price": "N/D",
            "oct_luce_price": "N/D", "oct_luce_fee": "N/D",
            "oct_gas_price": "N/D", "oct_gas_fee": "N/D"
        }
        # 1. Scrape Fuel Prices
        try:
            url_gas = "https://www.mimit.gov.it/it/prezzo-medio-carburanti/regioni"
            print(f"Caricamento prezzi carburanti: {url_gas}")
            driver.get(url_gas)
            time.sleep(6)
            
            soup_gas = BeautifulSoup(driver.page_source, 'html.parser')
            anchor = soup_gas.find(id="er")
            gas_price = "N/D"
            if anchor:
                table = anchor.parent.find_next_sibling("table")
                if table:
                    for row in table.find_all("tr"):
                        cells = row.find_all(["td", "th"])
                        if len(cells) >= 3:
                            fuel_type = cells[0].text.strip().lower()
                            service = cells[1].text.strip().lower()
                            price = cells[2].text.strip()
                            if "benzina" in fuel_type and "self" in service:
                                gas_price = price
                                break
            print(f"Prezzo benzina Emilia Romagna rilevato: {gas_price}")
            menu["gas_price"] = gas_price
        except Exception as e_gas:
            print("Errore durante il recupero dei prezzi del carburante:", e_gas)
            menu["gas_price"] = "N/D"

        # 2. Scrape Canteen Menu (using direct JSON API with proxy failover)
        try:
            from datetime import datetime, timedelta
            today_dt = datetime.now()
            # Range: from 2 days ago to 5 days in the future to capture current week
            date_start = (today_dt - timedelta(days=2)).strftime("%Y-%m-%dT22:00:00.000Z")
            date_end = (today_dt + timedelta(days=5)).strftime("%Y-%m-%dT22:00:00.000Z")
            
            api_url = f"https://www.menuchiaro.it/greenlife/it/Menu/GetMenu/MTA5OTg3XzEwOTk4Nw%3d%3d?utenzaId=QURVTFRJ&dataInizio={date_start}&dataFine={date_end}"
            print(f"Richiesta API Menu: {api_url}")
            
            def fetch_json(url, proxy=None):
                req = urllib.request.Request(url, headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/plain, */*'
                })
                if proxy:
                    proxy_support = urllib.request.ProxyHandler({'http': proxy, 'https': proxy})
                    opener = urllib.request.build_opener(proxy_support)
                else:
                    opener = urllib.request.build_opener()
                with opener.open(req, timeout=10) as r:
                    return json.loads(r.read().decode('utf-8'))

            def get_it_proxies():
                try:
                    px_url = 'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=10000&country=IT&ssl=all&anonymity=all'
                    req = urllib.request.Request(px_url, headers={'User-Agent': 'Mozilla/5.0'})
                    with urllib.request.urlopen(req, timeout=5) as r:
                        proxies = r.read().decode('utf-8').strip().split('\r\n')
                        return [p.strip() for p in proxies if p.strip()]
                except Exception as e_px:
                    print("Impossibile recuperare lista proxy:", e_px)
                    return []

            data = None
            try:
                print("Tentativo di caricamento diretto dell'API...")
                data = fetch_json(api_url)
                print("Caricamento diretto riuscito!")
            except Exception as e_direct:
                print(f"Caricamento diretto fallito ({e_direct}). Avvio rotazione proxy...")
                proxies = get_it_proxies()
                print(f"Trovati {len(proxies)} proxy da testare.")
                for px in proxies:
                    try:
                        print(f"Tentativo con proxy: {px}")
                        data = fetch_json(api_url, proxy=px)
                        print(f"SUCCESS con proxy: {px}!")
                        break
                    except Exception as e_px_fail:
                        print(f"Proxy {px} fallito: {e_px_fail}")
                
            if not data:
                raise ValueError("Impossibile recuperare il menu sia direttamente che tramite proxy.")

            # Parse Canteen JSON
            target_date = today_dt.date()
            dettagli = data.get("DettaglioGiorno", [])
            found = False
            for giorno in dettagli:
                date_str = giorno.get("DataRiferimento", "")
                m = re.search(r'/Date\((\d+)', date_str)
                if not m:
                    continue
                ts = int(m.group(1)) / 1000.0
                dt = datetime.fromtimestamp(ts)
                if dt.date() == target_date:
                    found = True
                    wd_map = ["LUN", "MAR", "MER", "GIO", "VEN", "SAB", "DOM"]
                    m_map = ["GEN", "FEB", "MAR", "APR", "MAG", "GIU", "LUG", "AGO", "SET", "OTT", "NOV", "DIC"]
                    menu["date"] = f"{wd_map[dt.weekday()]} {dt.day} {m_map[dt.month - 1]}"
                    
                    for cat in giorno.get("Categorie", []):
                        cat_desc = cat.get("Descrizione", "").lower()
                        dishes = [p.get("Descrizione") for p in cat.get("Piatti", []) if p.get("Descrizione")]
                        if "primo" in cat_desc:
                            menu["primi"] = dishes[:2]
                        elif "secondo" in cat_desc:
                            menu["secondi"] = dishes[:3]
                        elif "contorn" in cat_desc:
                            menu["contorni"] = dishes[:1]
                    break
            
            if not found:
                print(f"Nessun menu trovato per la data di oggi: {target_date}")
                menu["date"] = "OGGI"
                menu["primi"] = []
                menu["secondi"] = []
                menu["contorni"] = []
                
        except Exception as e_canteen:
            print("Errore durante il recupero del menu della mensa:", e_canteen)
            raise e_canteen

        # 3. Scrape Octopus Energy Tariffs
        try:
            url_oct = "https://octopusenergy.it/offerta/tariffe"
            print(f"Caricamento tariffe Octopus: {url_oct}")
            driver.get(url_oct)
            time.sleep(8)
            
            page_src = driver.page_source
            matches = list(re.finditer(r'"displayName"\s*:\s*"([^"]*?Fissa 12M[^"]*?)"', page_src))
            for m in matches:
                name = m.group(1)
                subtext = page_src[m.start():m.start() + 3000]
                charge_m = re.search(r'"consumptionCharge"\s*:\s*"([^"]*?)"', subtext)
                fee_m = re.search(r'"annualStandingCharge"\s*:\s*"([^"]*?)"', subtext)
                
                charge_val = charge_m.group(1) if charge_m else "N/D"
                fee_val = fee_m.group(1) if fee_m else "N/D"
                
                if "Gas" in name:
                    menu["oct_gas_price"] = charge_val
                    menu["oct_gas_fee"] = fee_val
                else:
                    menu["oct_luce_price"] = charge_val
                    menu["oct_luce_fee"] = fee_val
            
            print(f"Tariffe Octopus rilevate: Luce={menu.get('oct_luce_price')}/{menu.get('oct_luce_fee')}, Gas={menu.get('oct_gas_price')}/{menu.get('oct_gas_fee')}")
        except Exception as e_oct:
            print("Errore durante il recupero delle tariffe Octopus:", e_oct)

        # Save to JSON
        with open("dashboard_data.json", "w", encoding="utf-8") as f_out:
            json.dump(menu, f_out, indent=4, ensure_ascii=False)
        print("Aggiornamento di dashboard_data.json completato con successo!")
        
    except Exception as e:
        print("Errore durante lo scraping:", e)
    finally:
        driver.quit()

if __name__ == "__main__":
    fetch_and_parse()
