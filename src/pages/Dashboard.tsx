import type { AppConfig, ProviderProfile, ProxyStatus, RequestLogEntry } from '../lib/types';
import LogViewer from '../components/LogViewer';
import StatusBadge, { StatCard } from '../components/StatusBadge';

export default function Dashboard({
  config,
  status,
  logs,
  activeClaudeProvider
}: {
  config: AppConfig;
  status: ProxyStatus;
  logs: RequestLogEntry[];
  activeClaudeProvider: ProviderProfile | null;
}) {
  const healthyMembers = config.codexPool.members.filter((member) => member.health === 'healthy').length;
  const enabledMembers = config.codexPool.members.filter((member) => member.enabled).length;

  return (
    <div className="page-stack">
      <div className="stats-grid">
        <StatCard title="Codex Pool" value={`${healthyMembers}/${enabledMembers}`} detail="健康 / 启用成员" />
        <StatCard title="Codex Proxy" value={<StatusBadge value={status.codexRunning} />} detail={`127.0.0.1:${status.codexPort}/v1`} />
        <StatCard title="Claude Proxy" value={<StatusBadge value={status.claudeRunning} />} detail={`127.0.0.1:${status.claudePort}`} />
        <StatCard title="Last Codex Member" value={status.lastCodexMemberId ?? '-'} detail="最近被调度的池成员" />
      </div>

      <section className="panel hero-panel">
        <div>
          <p className="eyebrow">Current Claude Provider</p>
          <h2>{activeClaudeProvider?.name ?? '未配置'}</h2>
          <p>{activeClaudeProvider?.apiBase ?? '请在 Providers 页面配置 Claude 使用的第三方中转站。'}</p>
        </div>
        <div className="copy-box">
          <span>Codex 本地代理配置</span>
          <code>OPENAI_BASE_URL=http://127.0.0.1:{config.codexProxyPort}/v1</code>
          <code>OPENAI_API_KEY={config.localProxyToken}</code>
        </div>
      </section>

      <LogViewer logs={logs} />
    </div>
  );
}
