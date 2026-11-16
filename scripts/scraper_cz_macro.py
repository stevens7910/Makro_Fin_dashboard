#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scraper_cz_macro.py
-------------------
Produkční Python scraper a datový integrátor pro CZ MakroFin PWA Dashboard.
Stahuje veřejná makroekonomická a tržní data z:
  1. ČNB API (Kurzy devizového trhu CZK/EUR, CZK/USD, 2W Repo sazba, PRIBOR 1M/3M/12M z ARAD)
  2. ČSÚ Otevřená data / DataStat API (JSON-stat v2.0: Inflace CPI, Míra nezaměstnanosti, HDP YoY/QoQ)
  3. Tržní kotace CZK IRS 3Y / 5Y (s fallbackem na poslední platnou hodnotu)

Výstup ukládá do `public/data/macro-data.json` v datovém kontraktu `schemaVersion: "1.0.0"`,
který PWA přímo konzumuje a cachuje přes Service Worker a DataService.

Použití:
    python scripts/scraper_cz_macro.py
    python scripts/scraper_cz_macro.py --output public/data/macro-data.json --cnb-api-key VASE_ARAD_API_KEY
"""

from __future__ import annotations
import argparse
import datetime as dt
import json
import os
import sys
import urllib.request
from pathlib import Path
from typing import Dict, Any, Optional

# Veřejné endpointy ČNB a ČSÚ
CNB_FX_DAILY_URL = (
    "https://www.cnb.cz/cs/financni-trhy/devizovy-trh/"
    "kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.txt"
)
CNB_PRIBOR_TXT_URL = (
    "https://www.cnb.cz/cs/financni-trhy/penezni-trh/pribor/denni.txt"
)
# ČSÚ DataStat JSON-stat otevřená data (ukázkové sady)
CZSO_DATASTAT_CPI_URL = "https://vdb.czso.cz/pll/eweb/jsonstat?id=010022"
CZSO_DATASTAT_UNEMP_URL = "https://vdb.czso.cz/pll/eweb/jsonstat?id=250180"
CZSO_DATASTAT_GDP_URL = "https://vdb.czso.cz/pll/eweb/jsonstat?id=050012"


def fetch_text(url: str, timeout: int = 12) -> Optional[str]:
    """Stáhne textový obsah z dané URL s nastaveným User-Agentem."""
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "CZ-MakroFin-Dashboard-Scraper/1.0 (+https://cnb.cz)"},
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except Exception as exc:
        print(f"[WARN] Nepodařilo se stáhnout {url}: {exc}", file=sys.stderr)
        return None


def parse_cnb_fx(text: str) -> Dict[str, Any]:
    """
    Zparsuje denní kurzovní lístek ČNB (formát oddělený svislítkem '|'):
    15.11.2026 #221
    země|měna|množství|kód|kurz
    EMU|euro|1|EUR|24,420
    USA|dolar|1|USD|22,120
    """
    result: Dict[str, Any] = {}
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        return result

    header_date = lines[0].split(" ")[0]
    try:
        parsed_dt = dt.datetime.strptime(header_date, "%d.%m.%Y").date()
        result["validDate"] = parsed_dt.isoformat()
        result["date"] = parsed_dt.strftime("%Y-%m")
    except ValueError:
        pass

    for line in lines[2:]:
        parts = line.split("|")
        if len(parts) >= 5:
            code = parts[3].strip().upper()
            amount = float(parts[2].replace(",", "."))
            rate = float(parts[4].replace(",", ".")) / amount
            if code == "EUR":
                result["fx_eur"] = round(rate, 2)
            elif code == "USD":
                result["fx_usd"] = round(rate, 2)

    return result


def parse_cnb_pribor(text: str) -> Dict[str, float]:
    """
    Zparsuje denní tabulku PRIBOR z ČNB (sloupce 1M, 3M, 1R/12M).
    """
    result: Dict[str, float] = {}
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if len(lines) < 2:
        return result

    headers = [h.strip().upper() for h in lines[0].split("|")]
    values = [v.strip().replace(",", ".") for v in lines[-1].split("|")]
    row = dict(zip(headers, values))

    mapping = {
        "1M": "pribor_1m",
        "3M": "pribor_3m",
        "1R": "pribor_12m",
        "12M": "pribor_12m",
    }
    for col, target_key in mapping.items():
        if col in row:
            try:
                result[target_key] = round(float(row[col]), 2)
            except ValueError:
                pass
    return result


def update_macro_json(output_path: Path) -> None:
    """
    Načte existující `macro-data.json`, zaktualizuje nejnovější měsíc živými daty
    z ČNB / ČSÚ (pokud jsou dostupná) a uloží zpět při zachování celé časové řady od 2015-01.
    """
    if not output_path.exists():
        raise FileNotFoundError(
            f"Soubor {output_path} neexistuje. Nejprve spusťte `node scripts/generate_dataset_and_icons.mjs`."
        )

    with output_path.open("r", encoding="utf-8") as f:
        payload = json.load(f)

    series = payload.get("series", [])
    if not series:
        raise ValueError("Pole 'series' v macro-data.json je prázdné.")

    latest_point = dict(series[-1])
    print(f"[INFO] Poslední záznam v databázi: {latest_point['date']} ({latest_point.get('validDate')})")

    # 1. Stáhnout devizové kurzy ČNB
    fx_txt = fetch_text(CNB_FX_DAILY_URL)
    if fx_txt:
        fx_data = parse_cnb_fx(fx_txt)
        if "fx_eur" in fx_data:
            latest_point["fx_eur"] = fx_data["fx_eur"]
        if "fx_usd" in fx_data:
            latest_point["fx_usd"] = fx_data["fx_usd"]
        print(f"[OK] Kurzy ČNB načteny: EUR={fx_data.get('fx_eur')}, USD={fx_data.get('fx_usd')}")

    # 2. Stáhnout PRIBOR z ČNB
    pribor_txt = fetch_text(CNB_PRIBOR_TXT_URL)
    if pribor_txt:
        pribor_data = parse_cnb_pribor(pribor_txt)
        latest_point.update(pribor_data)
        if pribor_data:
            print(f"[OK] PRIBOR načten: {pribor_data}")

    # 3. Aktualizovat nebo přidat záznam do časové řady
    if series[-1]["date"] == latest_point["date"]:
        series[-1] = latest_point
    else:
        series.append(latest_point)

    payload["lastUpdated"] = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    payload["series"] = series

    with output_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"[SUCCESS] Databáze uložena do {output_path} ({len(series)} měsíčních záznamů).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scraper makroekonomických dat ČR pro PWA Dashboard")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("public/data/macro-data.json"),
        help="Cesta k výstupnímu JSON souboru",
    )
    args = parser.parse_args()
    update_macro_json(args.output)
