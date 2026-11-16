import React from 'react';
import {
  Activity,
  BarChart3,
  Cpu,
  Download,
  Globe,
  Layers,
  Moon,
  Percent,
  RefreshCw,
  Sun,
  Wifi,
  WifiOff
} from 'lucide-react';
import { ActiveTab, CacheDiagnostics } from '../types/macro';

interface HeaderProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  isOnline: boolean;
  diagnostics: CacheDiagnostics;
  canInstallPwa: boolean;
  isInstalledPwa: boolean;
  onInstallPwa: () => void;
  onManualSync: () => void;
  isSyncing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  theme,
  onToggleTheme,
  isOnline,
  diagnostics,
  canInstallPwa,
  isInstalledPwa,
  onInstallPwa,
  onManualSync,
  isSyncing
}) => {
  const navItems: { id: ActiveTab; label: string; shortLabel: string; icon: React.ReactNode; badge?: string }[] = [
    {
      id: 'overview',
      label: 'Aktuální situace (KPI)',
      shortLabel: 'Přehled',
      icon: <Layers size={16} />,
      badge: '12 KPI'
    },
    {
      id: 'rates',
      label: 'Úrokové sazby & IRS',
      shortLabel: 'Sazby & IRS',
      icon: <Percent size={16} />,
      badge: 'ČNB / PRIBOR'
    },
    {
      id: 'macro',
      label: 'Inflace, HDP & Práce',
      shortLabel: 'Inflace & HDP',
      icon: <BarChart3 size={16} />,
      badge: 'ČSÚ'
    },
    {
      id: 'fx',
      label: 'Měnové kurzy (FX)',
      shortLabel: 'Kurzy CZK',
      icon: <Globe size={16} />,
      badge: 'EUR / USD'
    },
    {
      id: 'architecture',
      label: 'Datová vrstva & API',
      shortLabel: 'API & Cache',
      icon: <Cpu size={16} />,
      badge: `L1: ${diagnostics.memoryHits}`
    }
  ];

  return (
    <header className="app-header">
      <div className="header-top-row container">
        <div className="brand-group" onClick={() => onSelectTab('overview')} role="button" tabIndex={0}>
          <div className="brand-logo" aria-hidden="true">
            <Activity size={22} />
            <span className="brand-cz-pill">CZ</span>
          </div>
          <div className="brand-titles">
            <div className="brand-title-line">
              <h1>MakroFin Terminal ČR</h1>
              <span className="pwa-badge" title="Progressive Web App s plnou offline podporou">
                PWA Ready
              </span>
            </div>
            <p className="brand-subtitle">
              Oficiální data ČNB, ČSÚ a Eurostatu: sazby, PRIBOR, inflace, HDP, nezaměstnanost a kurzy (2015–dnes)
            </p>
          </div>
        </div>

        <div className="header-actions">
          {/* Online / Offline PWA indikátor */}
          <div
            className={`status-pill ${isOnline ? 'status-online' : 'status-offline'}`}
            title={
              isOnline
                ? 'Připojeno k síti — Service Worker a víceúrovňová cache jsou aktivní'
                : 'Offline režim — aplikace čerpá 100 % dat z lokální Service Worker / L1-L2 cache'
            }
          >
            {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span>{isOnline ? 'Online (SW Cache)' : 'Offline režim'}</span>
          </div>

          {/* Tlačítko synchronizace API */}
          <button
            type="button"
            className="action-btn"
            onClick={onManualSync}
            disabled={isSyncing}
            title="Znovu načíst nejnovější data ze serveru"
          >
            <RefreshCw size={15} className={isSyncing ? 'spin-anim' : ''} />
            <span className="hide-mobile">{isSyncing ? 'Synchronizuji...' : 'Aktualizovat data'}</span>
          </button>

          {/* Tlačítko instalace PWA */}
          {!isInstalledPwa && (
            <button
              type="button"
              className={`action-btn ${canInstallPwa ? 'action-btn-primary' : ''}`}
              onClick={onInstallPwa}
              title="Nainstalovat PWA aplikaci na plochu nebo domovskou obrazovku"
            >
              <Download size={15} />
              <span className="hide-mobile">Nainstalovat PWA</span>
            </button>
          )}

          {/* Přepínač Light / Dark mode */}
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Přepnout na světlý režim' : 'Přepnout na tmavý režim'}
            title={theme === 'dark' ? 'Přepnout na světlý režim (Light Mode)' : 'Přepnout na tmavý režim (Dark Mode)'}
          >
            {theme === 'dark' ? (
              <>
                <Sun size={16} className="theme-icon-sun" />
                <span className="theme-label">Světlý</span>
              </>
            ) : (
              <>
                <Moon size={16} className="theme-icon-moon" />
                <span className="theme-label">Tmavý</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Hlavní navigace záložek */}
      <nav className="header-nav-bar" aria-label="Hlavní navigace dashboardu">
        <div className="container nav-tabs-wrapper">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-tab-btn ${isActive ? 'active' : ''}`}
                onClick={() => onSelectTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="nav-tab-icon">{item.icon}</span>
                <span className="nav-tab-label-full">{item.label}</span>
                <span className="nav-tab-label-short">{item.shortLabel}</span>
                {item.badge && <span className="nav-tab-badge">{item.badge}</span>}
              </button>
            );
          })}
        </div>
      </nav>
    </header>
  );
};
