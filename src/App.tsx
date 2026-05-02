import { useEffect, useMemo, useState } from 'react';
import { Activity, Database, KeyRound, Router, Settings, ShieldCheck } from 'lucide-react';
import { api } from './lib/tauri';
import type { AppConfig, CodexPoolMember, ProxyStatus, RequestLogEntry } from './lib/types';
import Dashboard from './pages/Dashboard';
import CodexPool from './pages/CodexPool';
import Providers from './pages/Providers';
import Proxy from './pages/Proxy';
import SettingsPage from './pages/Settings';

const tabs = [
  { id: 'dashboard', label: 'Dashboard', icon: Activity },
  { id: 'pool', label: 'Codex Pool', icon: Database },
  { id: 'providers', label: 'Providers', icon: KeyRound },
  { id: 'proxy', label: 'Proxy', icon: Router },
  { id: 'settings', label: 'Settings', icon: Settings }
] as const;

type TabId = (typeof tabs)[number]['id'];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [status, setStatus] = useState<ProxyStatus | null>(null);
  const [logs, setLogs] = useState<RequestLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const activeClaudeProvider = useMemo(() => {
    return config?.providers.find((provider) => provider.id === config.activeClaudeProviderId) ?? config?.providers[0] ?? null;
  }, [config]);

  async function refresh() {
    try {
      const [nextConfig, nextStatus, nextLogs] = await Promise.all([api.getConfig(), api.proxyStatus(), api.getLogs()]);
      setConfig(nextConfig);
      setStatus(nextStatus);
      setLogs(nextLogs.reverse());
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }

  async function saveConfig(nextConfig: AppConfig) {
    setBusy(true);
    try {
      const saved = await api.saveConfig(nextConfig);
      setConfig(saved);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function updateMember(nextMember: CodexPoolMember) {
    if (!config) return;
    await saveConfig({
      ...config,
      codexPool: {
        ...config.codexPool,
        members: config.codexPool.members.map((member) => (member.id === nextMember.id ? nextMember : member))
      }
    });
  }

  async function testMember(memberId: string) {
    setBusy(true);
    try {
      const checked = await api.testPoolMember(memberId);
      await updateMember(checked);
    } finally {
      setBusy(false);
    }
  }

  async function refreshHealth() {
    setBusy(true);
    try {
      const nextConfig = await api.refreshHealth();
      setConfig(nextConfig);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function clearLogs() {
    setBusy(true);
    try {
      await api.clearLogs();
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => window.clearInterval(timer);
  }, []);

  if (!config || !status) {
    return <div className="boot">正在加载 Claude Codex Relay Hub...</div>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <ShieldCheck size={30} />
          <div>
            <strong>Relay Hub</strong>
            <span>Claude / Codex 本地中转</span>
          </div>
        </div>
        <nav>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}>
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">OpenAI-Compatible Relay Control Center</p>
            <h1>第三方中转接口管理器</h1>
          </div>
          <div className="actions">
            <button className="ghost" disabled={busy} onClick={refreshHealth}>刷新健康状态</button>
            <button className="ghost" disabled={busy} onClick={refresh}>刷新</button>
          </div>
        </header>

        {error && <div className="alert error">{error}</div>}

        {activeTab === 'dashboard' && (
          <Dashboard config={config} status={status} logs={logs} activeClaudeProvider={activeClaudeProvider} onClearLogs={clearLogs} />
        )}
        {activeTab === 'pool' && (
          <CodexPool config={config} busy={busy} onSave={saveConfig} onTestMember={testMember} />
        )}
        {activeTab === 'providers' && (
          <Providers config={config} busy={busy} onSave={saveConfig} />
        )}
        {activeTab === 'proxy' && (
          <Proxy config={config} status={status} logs={logs} busy={busy} onRefresh={refresh} onClearLogs={clearLogs} />
        )}
        {activeTab === 'settings' && (
          <SettingsPage config={config} busy={busy} onSave={saveConfig} />
        )}
      </main>
    </div>
  );
}
