# CZ MakroFin Terminal — PWA dashboard makroekonomických indikátorů ČR

React + Vite + Recharts, plná offline podpora (Service Worker), světlý/tmavý režim.
Živá aplikace: https://stevens7910.github.io/Makro_Fin_dashboard/

## Zdroje dat (všechno oficiální, žádné odhady)

| Indikátor | Zdroj |
|---|---|
| 2W repo sazba | ČNB – [historie repo sazby](https://www.cnb.cz/cs/casto-kladene-dotazy/Jak-se-vyvijela-dvoutydenni-repo-sazba-CNB/) |
| PRIBOR 1M / 3M / 12M | ČNB – roční soubory fixingů PRIBOR |
| CZK/EUR, CZK/USD | ČNB – `api.cnb.cz/cnbapi/exrates/daily-year` |
| Inflace CPI (y/y) | ČSÚ DataStat, sada `WCEN01` (index „stejné období předchozího roku“ − 100) |
| Nezaměstnanost | Eurostat `une_rt_m` (ILO, sezónně očištěno, 15–74) |
| HDP y/y, q/q | Eurostat `namq_10_gdp` (reálný, sez. a kal. očištěný) |
| CZK IRS 3Y / 5Y | **žádný veřejný bezplatný zdroj** → zobrazeno „—“; lze doplnit do `data/irs_manual.csv` (`date;irs_3y;irs_5y`) |

Měsíční hodnota sazeb a kurzů = poslední pozorování v měsíci. Nepublikované údaje jsou `null`
(např. CPI za listopad vyjde v prosinci); každá KPI karta ukazuje vlastní poslední známé pozorování.

## Příkazy

```bash
npm install
npm run update-data   # stáhne ČNB/ČSÚ/Eurostat -> public/data/macro-data.json
npm run audit-data    # nezávislá kontrola proti zdrojům -> public/data/audit-report.json
npm run dev           # http://localhost:5173
npm run build && npm run preview
```

`audit-data` přepočítá každý měsíc od 2015 ze zdrojů, porovná s dashboardem a navíc křížově ověří
kurzy a PRIBOR přes jiné rozhraní ČNB (`exrates/daily`, `pribor/daily`) pro všech 143 měsíců.

## Automatická aktualizace

Workflow `.github/workflows/update-and-deploy.yml` denně spustí `update-data`, `audit-data`, build a nasadí na GitHub Pages.
Tlačítko **Aktualizovat data** v aplikaci znovu načte nejnovější data ze serveru (prohlížeč nemůže volat `api.cnb.cz`
napřímo – API neposílá CORS hlavičky).
