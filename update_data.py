import time
import json
import re
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

        # 2. Scrape Canteen Menu
        try:
            url = "https://www.menuchiaro.it/greenlife/it/"
            print(f"Caricamento menu: {url}")
            driver.get(url)
            
            # Wait for menu button to be present and click it via JS to bypass overlays
            try:
                btn = WebDriverWait(driver, 20).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, "a.func-menu"))
                )
                driver.execute_script("arguments[0].click();", btn)
            except Exception as e_click:
                print(f"Errore: impossibile cliccare il menu. Titolo pagina: '{driver.title}'")
                print(f"Sorgente pagina (primi 600 caratteri): {driver.page_source[:600]}")
                raise e_click
            
            # Wait for menu content to load (wait for dish items inside elenco)
            WebDriverWait(driver, 20).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "div.elenco li"))
            )
            
            soup = BeautifulSoup(driver.page_source, 'html.parser')
            
            selected_day = soup.find('div', class_='selected')
            if selected_day:
                dw = selected_day.find('span', class_='dayofweek')
                dn = selected_day.find('span', class_='day')
                m = selected_day.find('span', class_='month')
                menu["date"] = f"{dw.text.strip() if dw else ''} {dn.text.strip() if dn else ''} {m.text.strip() if m else ''}".upper()
            else:
                menu["date"] = "OGGI"
                
            for row in soup.find_all('div', class_='elenco'):
                header = row.find('h3')
                if not header:
                    continue
                header_text = header.text.strip().lower()
                
                dishes = []
                for li in row.find_all('li'):
                    a_tag = li.find('a')
                    if a_tag:
                        dish_text = a_tag.text.strip()
                        p_tag = a_tag.find('p')
                        if p_tag:
                            p_text = p_tag.text.strip()
                            if p_text:
                                dish_text = dish_text.replace(p_text, "").strip()
                        dish_name = dish_text.split('\n')[0].strip()
                        if dish_name and dish_name not in dishes:
                            dishes.append(dish_name)
                            
                if "primo" in header_text:
                    menu["primi"] = dishes[:2]
                elif "secondo" in header_text:
                    menu["secondi"] = dishes[:3]
                elif "contorn" in header_text:
                    menu["contorni"] = dishes[:1]
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
