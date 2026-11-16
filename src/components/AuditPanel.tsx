import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ShieldCheck, XCircle } from 'lucide-react';

interface AuditCheck {
  id: string;
  name: string;
  source: string;
  compared: number;
  mismatches: number;
  maxAbsDiff: number;
  status: 'OK' | 'CHYBA' | 'N/A';
  details: string[];
}

interface AuditReport {
  generatedAt: string;
  status: 'OK' | 'CHYBA';
  checks: AuditCheck[];
  unverified: { id: string; reason: string }[];
}

export const AuditPanel: React.FC = () => {
  const [report, setReport] = useState<AuditReport | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch('./data/audit-report.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setReport)
      .catch(() => setFailed(true));
  }, []);

  return (
    <div className="chart-panel">
      <div className="chart-panel-header">
        <div>
          <span className="panel-eyebrow">Audit správnosti dat</span>
          <h3>Porovnání s oficiálními zdroji (ČNB, ČSÚ, Eurostat)</h3>
          <p className="panel-subtitle">
            Skript <code>npm run audit-data</code> znovu stáhne zdroje, přepočítá každý měsíc od 2015 a porovná je s dashboardem.
            {report && <> Poslední běh: {new Date(report.generatedAt).toLocaleString('cs-CZ')}.</>}
          </p>
        </div>
        {report && (
          <span className={`change-badge ${report.status === 'OK' ? 'change-positive' : 'change-negative'}`}>
            <ShieldCheck size={13} /> {report.status === 'OK' ? 'Všechny kontroly v pořádku' : 'Nalezeny rozdíly'}
          </span>
        )}
      </div>

      {failed && <p className="panel-subtitle">Zpráva o auditu není k dispozici.</p>}

      {report && (
        <div className="stats-table-wrapper">
          <table className="analytical-table">
            <thead>
              <tr>
                <th>Kontrola</th>
                <th>Zdroj</th>
                <th>Porovnáno</th>
                <th>Rozdíly</th>
                <th>Stav</th>
              </tr>
            </thead>
            <tbody>
              {report.checks.map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.name}
                    {c.details.map((d) => (
                      <span key={d} className="table-subcode">{d}</span>
                    ))}
                  </td>
                  <td>{c.source}</td>
                  <td className="num-col">{c.compared}</td>
                  <td className="num-col">{c.mismatches}</td>
                  <td>
                    {c.status === 'OK' ? (
                      <span className="text-positive"><CheckCircle2 size={14} /> OK</span>
                    ) : (
                      <span className="text-negative"><XCircle size={14} /> {c.status}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {report?.unverified.length ? (
        <div className="sync-alert-banner" style={{ background: 'rgba(245,158,11,0.14)', color: '#f59e0b', borderColor: 'rgba(245,158,11,0.35)' }}>
          <AlertTriangle size={16} />
          <span>
            Neověřeno / nezobrazeno: CZK IRS 3Y a 5Y – {report.unverified[0].reason}.
          </span>
        </div>
      ) : null}
    </div>
  );
};
