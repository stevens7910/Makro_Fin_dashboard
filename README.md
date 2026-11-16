# CZ MakroFin Terminal — Progressive Web App (PWA) Dashboard ČR

Komplexní analytický PWA dashboard pro sledování klíčových makroekonomických, úrokových a kurzových indikátorů České republiky v časové řadě **od ledna 2015 do současnosti (2026)**.

## 1. Architektura a Tech Stack
- **Frontend Framework**: React 18 + TypeScript + Vite
- **Grafová knihovna**: Recharts (`ComposedChart`, `LineChart`, `Area`, `Bar`, `ReferenceLine`, `ReferenceArea`, interaktivní vlastní tooltipy, mini sparklines)
- **Ikony & UI**: `lucide-react` + čistý analytický CSS design systém s plnou podporou **Light / Dark mode**
- **PWA Podpora**:
  - Platný [manifest.json](public/manifest.json) se zkratkami (`shortcuts`), ikonami (`SVG`, `192x192 PNG`, `512x512 PNG`) a `display: standalone`
  - Plnohodnotný Service Worker [sw.js](public/sw.js) kombinující precaching aplikačního jádra, strategii *Stale-While-Revalidate* pro statické assety a *Network-First s Cache fallbackem* pro datové soubory a API

## 2. Sledované Indikátory (2015–2026)
### Úrokové sazby a swapy (`rates`)
- **2W Repo sazba (ČNB)** (`cnb_repo_2w`)
- **PRIBOR 1M, 3M, 12M** (`pribor_1m`, `pribor_3m`, `pribor_12m`)
- **Úrokové swapy CZK IRS 3Y a 5Y** (`irs_3y`, `irs_5y`)
- Odvozené analytické ukazatele: **Tvar výnosové křivky** a **Spread IRS 5Y − PRIBOR 3M** (bps)

### Makroekonomika ČR (`macro`)
- **Inflace CPI (meziroční růst v %)** (`cpi_yoy`) s vyznačeným 2% cílem ČNB a tolerančním pásmem 1–3 %
- **Míra nezaměstnanosti v ČR (%)** (`unemployment`)
- **Růst HDP – meziroční (YoY %) i mezičtvrtletní (QoQ %)** (`gdp_yoy`, `gdp_qoq`)

### Měnové kurzy (`fx`)
- **CZK / EUR** (`fx_eur`) a **CZK / USD** (`fx_usd`) + implikovaný křížový kurz **EUR / USD**

## 3. Víceúrovňová Datová a Cache Vrstva
Implementována v [src/services/dataService.ts](src/services/dataService.ts):
1. **L1 In-Memory Singleton + Slice Memoization**: Při přepínání mezi záložkami (`Přehled`, `Sazby`, `Makro`, `Kurzy`, `API`) nebo změně časové osy (`1R`, `3R`, `5R`, `Od 2015`) nedochází k žádnému síťovému stahování – čtení probíhá okamžitě z paměti (0 ms).
2. **L2 LocalStorage Cache (TTL 6 hodin)**: Okamžité načtení při opětovném otevření prohlížeče.
3. **L3 Service Worker Cache (`CacheStorage`)**: Zajišťuje 100% funkčnost aplikace v offline režimu.
4. **Python Scraper & Veřejná API**: Skript [scripts/scraper_cz_macro.py](scripts/scraper_cz_macro.py) stahuje živá data z ČNB / ČSÚ a aktualizuje soubor [public/data/macro-data.json](public/data/macro-data.json).

## 4. Rychlé Spuštění

```bash
# 1. Instalace závislostí
npm.cmd install

# 2. Spuštění vývojového serveru (http://localhost:5173)
npm.cmd run dev

# 3. Produkční build a náhled PWA
npm.cmd run build
npm.cmd run preview

# 4. Aktualizace dat pomocí Python scraperu
python scripts/scraper_cz_macro.py --output public/data/macro-data.json
```
