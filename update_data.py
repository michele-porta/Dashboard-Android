import time
import json
import re
import urllib.request
import concurrent.futures
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By

def get_geonode_proxies():
    # Fetch 100 HTTP/HTTPS proxies worldwide sorted by lastChecked
    url = "https://proxylist.geonode.com/api/proxy-list?limit=100&page=1&sort_by=lastChecked&sort_type=desc&protocols=http%2Chttps"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read().decode('utf-8'))
        proxies = data.get('data', [])
        return [f"{p.get('ip')}:{p.get('port')}" for p in proxies]
    except Exception as e:
        print(f"Errore nel recupero dei proxy da Geonode: {e}")
        return []

def try_proxy_fetch(api_url, proxy):
    req = urllib.request.Request(api_url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
    })
    proxy_support = urllib.request.ProxyHandler({'http': proxy, 'https': proxy})
    opener = urllib.request.build_opener(proxy_support)
    try:
        with opener.open(req, timeout=8) as r:
            res_data = json.loads(r.read().decode('utf-8'))
            if "DettaglioGiorno" in res_data:
                return res_data
    except Exception:
        pass
    return None

def clean_match(m, is_past=True):
    return {
        "home": m.get("strHomeTeam", "N/D"),
        "away": m.get("strAwayTeam", "N/D"),
        "home_score": m.get("intHomeScore") if is_past else None,
        "away_score": m.get("intAwayScore") if is_past else None,
        "home_badge": m.get("strHomeTeamBadge") or "",
        "away_badge": m.get("strAwayTeamBadge") or "",
        "date": m.get("dateEvent") or "",
        "time": m.get("strTime") or ""
    }

def fetch_and_parse():
    print("=== Mensa Greenlife & MIMIT Fuel Scraper ===")
    chrome_options = Options()
    chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
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
            driver.set_page_load_timeout(15)
            driver.get(url_gas)
            time.sleep(4)
            
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
            print(f"Errore carburante: {e_gas}")

        # 2. Scrape Canteen Menu
        try:
            tz_rome = ZoneInfo("Europe/Rome")
            today_dt = datetime.now(tz_rome)
            date_start = (today_dt - timedelta(days=2)).strftime("%Y-%m-%dT22:00:00.000Z")
            date_end = (today_dt + timedelta(days=5)).strftime("%Y-%m-%dT22:00:00.000Z")
            
            api_url = f"https://www.menuchiaro.it/greenlife/it/Menu/GetMenu/MTA5OTg3XzEwOTk4Nw%3d%3d?utenzaId=QURVTFRJ&dataInizio={date_start}&dataFine={date_end}"
            print(f"Caricamento API Menu via Selenium: {api_url}")
            
            data = None
            try:
                driver.get(api_url)
                time.sleep(3)
                body_element = driver.find_element(By.TAG_NAME, "body")
                json_text = body_element.text
                data = json.loads(json_text)
                print("Menu caricato ed elaborato con successo tramite Selenium!")
            except Exception as e_sel:
                print(f"Caricamento via Selenium fallito ({e_sel}). Avvio recupero parallelo tramite proxy...")
                proxies = get_geonode_proxies()
                if proxies:
                    print(f"Avvio test di {len(proxies)} proxy in parallelo...")
                    with concurrent.futures.ThreadPoolExecutor(max_workers=30) as executor:
                        futures = {executor.submit(try_proxy_fetch, api_url, px): px for px in proxies}
                        for future in concurrent.futures.as_completed(futures):
                            res = future.result()
                            if res:
                                data = res
                                print(f"Menu caricato con successo tramite proxy: {futures[future]}")
                                break
                
            if not data:
                raise ValueError("Impossibile recuperare il menu sia direttamente che tramite proxy paralleli.")

            target_date = today_dt.date()
            dettagli = data.get("DettaglioGiorno", [])
            found = False
            for giorno in dettagli:
                date_str = giorno.get("DataRiferimento", "")
                m = re.search(r'/Date\((\d+)', date_str)
                if not m:
                    continue
                ts = int(m.group(1)) / 1000.0
                dt = datetime.fromtimestamp(ts, tz=tz_rome)
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
            print(f"Errore mensa: {e_canteen}")

        # 3. Scrape Octopus Energy Tariffs
        try:
            url_oct = "https://octopusenergy.it/offerta/tariffe"
            print(f"Caricamento tariffe Octopus: {url_oct}")
            driver.get(url_oct)
            time.sleep(5)
            
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
            
            print(f"Tariffe Octopus rilevate: Luce={menu.get('oct_luce_price')}, Gas={menu.get('oct_gas_price')}")
        except Exception as e_oct:
            print(f"Errore tariffe Octopus: {e_oct}")

        # 4. Scrape Sports Data
        try:
            print("Caricamento risultati sportivi da TheSportsDB...")
            leagues = {
                "worldcup": "4429",
                "seriea": "4332",
                "champions": "4480"
            }
            menu["sports"] = {}
            for name, lid in leagues.items():
                try:
                    past_url = f"https://www.thesportsdb.com/api/v1/json/3/eventspastleague.php?id={lid}"
                    req_p = urllib.request.Request(past_url, headers={'User-Agent': 'Mozilla/5.0'})
                    with urllib.request.urlopen(req_p, timeout=10) as rp:
                        p_data = json.loads(rp.read().decode('utf-8'))
                        
                    next_url = f"https://www.thesportsdb.com/api/v1/json/3/eventsnextleague.php?id={lid}"
                    req_n = urllib.request.Request(next_url, headers={'User-Agent': 'Mozilla/5.0'})
                    with urllib.request.urlopen(req_n, timeout=10) as rn:
                        n_data = json.loads(rn.read().decode('utf-8'))
                        
                    p_events = p_data.get("events") or []
                    n_events = n_data.get("events") or []
                    
                    menu["sports"][name] = {
                        "past": [clean_match(m, True) for m in reversed(p_events[-5:])],
                        "next": [clean_match(m, False) for m in n_events[:5]]
                    }
                    print(f"Lega {name} caricata con successo.")
                except Exception as e_league:
                    print(f"Errore caricamento lega {name}: {e_league}")
                    menu["sports"][name] = {"past": [], "next": []}
        except Exception as e_sports:
            print(f"Errore generale risultati sportivi: {e_sports}")

        # Save to JSON
        with open("dashboard_data.json", "w", encoding="utf-8") as f_out:
            json.dump(menu, f_out, indent=4, ensure_ascii=False)
        print("Aggiornamento di dashboard_data.json completato con successo!")
        
    except Exception as e:
        print(f"Errore generale nello script: {e}")
    finally:
        driver.quit()

if __name__ == "__main__":
    fetch_and_parse()
