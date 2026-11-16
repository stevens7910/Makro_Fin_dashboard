import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, Info, X } from 'lucide-react';
import { INDICATORS } from './config/indicators';
import { DataArchitectureTab } from './components/DataArchitectureTab';
import { FxTab } from './components/FxTab';
import { Header } from './components/Header';
import { MacroTab } from './components/MacroTab';
import { OverviewTab } from './components/OverviewTab';
import { RatesTab } from './components/RatesTab';
import {
  clearAllCachesAndReload,
  computeKpiSummaries,
  formatValidDateCz,
  getCacheDiagnostics,
  getMacroDataset,
  subscribeDiagnostics,
  syncWithLivePublicApis
} from './services/dataService';
import { ActiveTab, IndicatorId, MacroDatasetPayload } from './types/macro';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const App: React.FC = () => {
  // Inicializace aktivní záložky (podporuje i PWA shortcuts ?tab=rates apod.)
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab') as ActiveTab | null;
    if (tabParam && ['overview', 'rates', 'macro', 'fx', 'architecture'].includes(tabParam)) {
      return tabParam;
    }
    return 'overview';
  });

  // Světlý / Tmavý režim uložený v localStorage
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('cz_makrofin_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      // ignore
    }
    return 'dark';
  });

  const [dataset, setDataset] = useState<MacroDatasetPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [focusedIndicator, setFocusedIndicator] = useState<IndicatorId | null>(null);

  // Stav připojení a diagnostiky cache
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [diagnostics, setDiagnostics] = useState(() => getCacheDiagnostics());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // PWA Instalace
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalledPwa, setIsInstalledPwa] = useState<boolean>(
    window.matchMedia('(display-mode: standalone)').matches
  );
  const [showInstallModal, setShowInstallModal] = useState<boolean>(false);

  // Aplikace tématu na <html> a <meta name="theme-color">
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    const metaTheme = document.getElementById('meta-theme-color');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'dark' ? '#0f172a' : '#f8fafc');
    }
    try {
      localStorage.setItem('cz_makrofin_theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  // Načtení dat přes víceúrovňovou DataService vrstvu
  useEffect(() => {
    let mounted = true;
    getMacroDataset(false)
      .then((data) => {
        if (!mounted) return;
        setDataset(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Nepodařilo se načíst makroekonomická data.');
        setLoading(false);
      });

    const unsub = subscribeDiagnostics(() => {
      if (mounted) {
        setDiagnostics(getCacheDiagnostics());
      }
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  // Sledování online/offline stavu a PWA install události
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalledPwa(true);
      setDeferredPrompt(null);
      setShowInstallModal(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Při přepnutí záložky čteme z L1 cache (bez síťového požadavku)
  const handleSelectTab = useCallback((tab: ActiveTab) => {
    setActiveTab(tab);
    getMacroDataset(false).then((cached) => {
      setDataset(cached);
    });
  }, []);

  // Proklik z KPI karty na hlavní stránce do příslušné detailní záložky
  const handleInspectIndicator = useCallback((indicatorId: IndicatorId) => {
    const def = INDICATORS[indicatorId];
    setFocusedIndicator(indicatorId);
    if (def.category === 'rates') {
      handleSelectTab('rates');
    } else if (def.category === 'macro') {
      handleSelectTab('macro');
    } else if (def.category === 'fx') {
      handleSelectTab('fx');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [handleSelectTab]);

  // Synchronizace s veřejnými API ČNB / ČSÚ
  const handleManualSync = useCallback(async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const result = await syncWithLivePublicApis();
      const updated = await getMacroDataset(false);
      setDataset({ ...updated });
      setSyncMessage(result.message);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Kompletní vyčištění cache a znovunačtení
  const handleClearCaches = useCallback(async () => {
    setIsSyncing(true);
    try {
      const fresh = await clearAllCachesAndReload();
      setDataset({ ...fresh });
      setSyncMessage('Všechny úrovně cache (L1 Memory, L2 LocalStorage, L3 Service Worker) byly vyčištěny a data znovu načtena.');
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Spuštění PWA instalace
  const handleInstallPwa = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      setShowInstallModal(true);
    }
  }, [deferredPrompt]);

  const kpiSummaries = useMemo(
    () => (dataset ? computeKpiSummaries(dataset.series) : []),
    [dataset]
  );

  const latestPoint = dataset?.series[dataset.series.length - 1];

  return (
    <div className="app-shell">
      <Header
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
        isOnline={isOnline}
        diagnostics={diagnostics}
        canInstallPwa={!!deferredPrompt}
        isInstalledPwa={isInstalledPwa}
        onInstallPwa={handleInstallPwa}
        onManualSync={handleManualSync}
        isSyncing={isSyncing}
      />

      <main className="main-content container">
        {syncMessage && activeTab !== 'architecture' && (
          <div className="toast-notification" role="status">
            <div className="toast-left">
              <CheckCircle2 size={16} />
              <span>{syncMessage}</span>
            </div>
            <button
              type="button"
              className="toast-close"
              onClick={() => setSyncMessage(null)}
              aria-label="Zavřít oznámení"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {loading && (
          <div className="loading-state">
            <div className="spinner" />
            <p>Načítám makroekonomickou databázi ČR (2015–2026)...</p>
          </div>
        )}

        {error && (
          <div className="error-state" role="alert">
            <h3>Chyba při načítání dat</h3>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && dataset && (
          <>
            {activeTab === 'overview' && (
              <OverviewTab
                summaries={kpiSummaries}
                series={dataset.series}
                onInspectIndicator={handleInspectIndicator}
              />
            )}

            {activeTab === 'rates' && (
              <RatesTab
                series={dataset.series}
                focusedIndicator={focusedIndicator}
              />
            )}

            {activeTab === 'macro' && (
              <MacroTab
                series={dataset.series}
                focusedIndicator={focusedIndicator}
              />
            )}

            {activeTab === 'fx' && (
              <FxTab
                series={dataset.series}
                focusedIndicator={focusedIndicator}
              />
            )}

            {activeTab === 'architecture' && (
              <DataArchitectureTab
                dataset={dataset}
                diagnostics={diagnostics}
                onSyncLiveApi={handleManualSync}
                onClearCaches={handleClearCaches}
                isSyncing={isSyncing}
                syncStatusMessage={syncMessage}
              />
            )}
          </>
        )}
      </main>

      <footer className="app-footer">
        <div className="container footer-inner">
          <div className="footer-left">
            <strong>CZ MakroFin Terminal PWA</strong>
            <span>•</span>
            <span>
              Rozsah dat: Leden 2015 – {latestPoint ? formatValidDateCz(latestPoint.validDate) : 'Listopad 2026'} ({dataset?.series.length ?? 0} měsíčních záznamů)
            </span>
          </div>
          <div className="footer-right">
            <span>Zdroje: ČNB ARAD, ČSÚ Otevřená data (JSON-stat), CFBF PRIBOR &amp; CZK IRS</span>
            <span>•</span>
            <span>L1 Cache hits: {diagnostics.memoryHits}</span>
          </div>
        </div>
      </footer>

      {/* Modální okno s návodem k instalaci PWA (pokud prohlížeč nevyvolal nativní prompt automaticky) */}
      {showInstallModal && (
        <div className="modal-backdrop" onClick={() => setShowInstallModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="modal-header">
              <div className="modal-title-group">
                <Download size={18} />
                <h3>Instalace aplikace CZ MakroFin (PWA)</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowInstallModal(false)}
                aria-label="Zavřít"
              >
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                Tato aplikace splňuje standard <strong>Progressive Web App (PWA)</strong> a má aktivní{' '}
                <code>manifest.json</code> i <code>Service Worker (sw.js)</code> pro <strong>100% offline provoz</strong>.
              </p>
              <div className="install-steps">
                <div className="install-step">
                  <Info size={16} />
                  <div>
                    <strong>Chrome / Edge (Desktop):</strong> Klikněte na ikonu instalace v pravé části adresního řádku (<em>Nainstalovat aplikaci CZ MakroFin</em>).
                  </div>
                </div>
                <div className="install-step">
                  <Info size={16} />
                  <div>
                    <strong>iOS Safari / Android Chrome:</strong> Zvolte <em>Sdílet</em> &rarr; <em>Přidat na plochu (Add to Home Screen)</em>.
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="action-btn action-btn-primary"
                onClick={() => setShowInstallModal(false)}
              >
                Rozumím
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
