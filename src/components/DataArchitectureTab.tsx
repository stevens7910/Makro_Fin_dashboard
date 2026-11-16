import React from 'react';
import {
  CheckCircle2,
  Code2,
  Database,
  HardDrive,
  RefreshCw,
  Server,
  Shield,
  Terminal,
  Trash2
} from 'lucide-react';
import { INDICATOR_LIST } from '../config/indicators';
import { CacheDiagnostics, MacroDatasetPayload } from '../types/macro';
import { AuditPanel } from './AuditPanel';

interface DataArchitectureTabProps {
  dataset: MacroDatasetPayload;
  diagnostics: CacheDiagnostics;
  onSyncLiveApi: () => void;
  onClearCaches: () => void;
  isSyncing: boolean;
  syncStatusMessage: string | null;
}

export const DataArchitectureTab: React.FC<DataArchitectureTabProps> = ({
  dataset,
  diagnostics,
  onSyncLiveApi,
  onClearCaches,
  isSyncing,
  syncStatusMessage
}) => {
  const sampleLatestRecord = dataset.series[dataset.series.length - 1];

  return (
    <div className="tab-view architecture-tab">
      {/* Horní přehled víceúrovňové Cache a PWA Service Workeru */}
      <div className="chart-panel">
        <div className="chart-panel-header">
          <div>
            <span className="panel-eyebrow">Víceúrovňová Data-Fetching &amp; Offline PWA Architektura</span>
            <h2>Stav datové vrstvy, Cache paměti a napojení na veřejná API (ČNB ARAD &amp; ČSÚ DataStat)</h2>
            <p className="panel-subtitle">
              Přepínání mezi záložkami a časovými horizonty čerpá data z L1 In-Memory Singletonu (0 ms latence, žádné znovustahování historie)
            </p>
          </div>
          <div className="arch-action-buttons">
            <button
              type="button"
              className="action-btn action-btn-primary"
              onClick={onSyncLiveApi}
              disabled={isSyncing}
            >
              <RefreshCw size={15} className={isSyncing ? 'spin-anim' : ''} />
              <span>{isSyncing ? 'Načítám...' : 'Aktualizovat data'}</span>
            </button>
            <button
              type="button"
              className="action-btn"
              onClick={onClearCaches}
              title="Vymaže L1 Memory, L2 LocalStorage i L3 Service Worker cache a načte čerstvá data"
            >
              <Trash2 size={15} />
              <span>Invalidovat cache &amp; Reload</span>
            </button>
          </div>
        </div>

        {syncStatusMessage && (
          <div className="sync-alert-banner">
            <CheckCircle2 size={16} />
            <span>{syncStatusMessage}</span>
          </div>
        )}

        <div className="cache-tiers-grid">
          <div className="cache-tier-card">
            <div className="tier-head">
              <Database size={18} className="tier-icon-blue" />
              <span className="tier-badge">L1 In-Memory Cache</span>
            </div>
            <h4>RAM Singleton + Slice Memoization</h4>
            <p>
              Drží zparsovanou časovou řadu ({diagnostics.recordCount} měsíců od 01/2015) a vyfiltrované výřezy (1R, 3R, 5R, Od 2015) přímo v paměti.
            </p>
            <div className="tier-metric">
              <span>Zásahy v paměti (Tab/Range hits):</span>
              <strong>{diagnostics.memoryHits}× (0 ms)</strong>
            </div>
          </div>

          <div className="cache-tier-card">
            <div className="tier-head">
              <HardDrive size={18} className="tier-icon-emerald" />
              <span className="tier-badge">L2 LocalStorage Cache</span>
            </div>
            <h4>Persistentní JSON Úložiště (TTL 6h)</h4>
            <p>
              Ukládá dataset v prohlížeči pro okamžitý studený start aplikace bez čekání na síť.
            </p>
            <div className="tier-metric">
              <span>Velikost datasetu:</span>
              <strong>{diagnostics.payloadSizeKb} KB ({diagnostics.recordCount} záznamů)</strong>
            </div>
          </div>

          <div className="cache-tier-card">
            <div className="tier-head">
              <Shield size={18} className="tier-icon-indigo" />
              <span className="tier-badge">L3 Service Worker PWA</span>
            </div>
            <h4>Offline CacheStorage ({diagnostics.serviceWorkerVersion})</h4>
            <p>
              Strategie <em>Stale-While-Revalidate</em> pro <code>/data/macro-data.json</code> a aplikační assety zajišťuje 100% funkčnost bez internetu.
            </p>
            <div className="tier-metric">
              <span>Stav Service Workeru:</span>
              <strong>{diagnostics.serviceWorkerActive ? 'Aktivní (Kontroluje stránku)' : 'Registrován / Připraven'}</strong>
            </div>
          </div>
        </div>
      </div>

      <AuditPanel />

      {/* Dvousloupcový přehled: JSON kontrakt pro Python scraper & Veřejné API endpointy */}
      <div className="two-col-detail-grid">
        <div className="chart-panel">
          <div className="chart-panel-header">
            <div>
              <span className="panel-eyebrow">Integrace na vlastní Python Scraper</span>
              <h3>Struktura souboru <code>/public/data/macro-data.json</code></h3>
              <p className="panel-subtitle">
                Soubor generuje skript <code>scripts/update-data.mjs</code> (Node.js) z oficiálních zdrojů; chybějící údaje jsou <code>null</code>:
              </p>
            </div>
          </div>

          <div className="code-block-wrapper">
            <div className="code-block-header">
              <Code2 size={14} />
              <span>Ukázka záznamu v poli "series" (od 2015-01 do {sampleLatestRecord?.date})</span>
            </div>
            <pre className="code-pre">
              {JSON.stringify(sampleLatestRecord, null, 2)}
            </pre>
          </div>

          <div className="code-block-wrapper" style={{ marginTop: '14px' }}>
            <div className="code-block-header">
              <Terminal size={14} />
              <span>Aktualizace a audit dat (GitHub Actions je spouští denně)</span>
            </div>
            <pre className="code-pre">
{`npm run update-data   # stáhne ČNB / ČSÚ / Eurostat -> public/data/macro-data.json
npm run audit-data    # nezávislá kontrola proti zdrojům -> public/data/audit-report.json`}
            </pre>
          </div>
        </div>

        <div className="chart-panel">
          <div className="chart-panel-header">
            <div>
              <span className="panel-eyebrow">Mapování datových zdrojů</span>
              <h3>Katalog indikátorů a veřejných API endpointů (ČNB &amp; ČSÚ)</h3>
              <p className="panel-subtitle">
                Přehled všech 12 sledovaných indikátorů, jejich primárních zdrojů a identifikátorů sad
              </p>
            </div>
          </div>

          <div className="stats-table-wrapper">
            <table className="analytical-table">
              <thead>
                <tr>
                  <th>ID klíče v JSON</th>
                  <th>Indikátor</th>
                  <th>Zdroj / Kód sady</th>
                  <th>Frekvence</th>
                </tr>
              </thead>
              <tbody>
                {INDICATOR_LIST.map((ind) => (
                  <tr key={ind.id}>
                    <td>
                      <code className="json-key-pill">{ind.id}</code>
                    </td>
                    <td>
                      <div className="table-ind-cell">
                        <span className="table-dot" style={{ backgroundColor: ind.color }} />
                        <strong>{ind.name}</strong>
                      </div>
                    </td>
                    <td>
                      <span className="source-code-badge">
                        <Server size={11} />
                        {ind.sourceCode}
                      </span>
                    </td>
                    <td>{ind.frequency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
