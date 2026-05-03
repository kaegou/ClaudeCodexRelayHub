import type { AppConfig, ProviderProfile, ProxyStatus, RequestLogEntry } from '../lib/types';
import LogViewer from '../components/LogViewer';
import StatusBadge, { StatCard } from '../components/StatusBadge';

export default function Dashboard({
  config,
  status,
  logs,
  activeClaudeProvider,
  onClearLogs
}: {
  config: AppConfig;
  status: ProxyStatus;
  logs: RequestLogEntry[];
  activeClaudeProvider: ProviderProfile | null;
  onClearLogs: () => Promise<void>;
}) {
  const healthyMembers = config.codexPool.members.filter((member) => member.health === 'healthy').length;
  const enabledMembers = config.codexPool.members.filter((member) => member.enabled).length;
  const successCount = config.codexPool.members.reduce((sum, member) => sum + member.successCount, 0);
  const failureCount = config.codexPool.members.reduce((sum, member) => sum + member.failureCount, 0);

  return (
    <div className="page-stack">
      <section className="panel hero-panel dashboard-hero">
        <div>
          <p className="eyebrow">Relay Operations Cockpit</p>
          <h2>第三方 Claude / Codex 中转控制台</h2>
          <p>统一管理 OpenAI-compatible 第三方接口、Codex API Key 池、本机代理状态和请求日志。</p>
          <div className="hero-metrics">
            <span>{config.codexPoolPolicy}</span>
            <span>{successCount} 成功</span>
            <span>{failureCount} 失败</span>
          </div>
        </div>
        <div className="copy-box hero-endpoints">
          <span>Codex 本地代理配置</span>
          <code>OPENAI_BASE_URL=http://127.0.0.1:{config.codexProxyPort}/v1</code>
          <code>OPENAI_API_KEY={config.localProxyToken}</code>
        </div>
      </section>

      <div className="stats-grid">
        <StatCard title="Codex Pool" value={`${healthyMembers}/${enabledMembers}`} detail="健康 / 启用成员" />
        <StatCard title="Codex Proxy" value={<StatusBadge value={status.codexRunning} />} detail={`127.0.0.1:${status.codexPort}/v1`} />
        <StatCard title="Claude Proxy" value={<StatusBadge value={status.claudeRunning} />} detail={`127.0.0.1:${status.claudePort}`} />
        <StatCard title="Last Codex Member" value={status.lastCodexMemberId ?? '-'} detail="最近调度的池成员" />
      </div>

      <section className="panel provider-summary">
        <div>
          <p className="eyebrow">Current Claude Provider</p>
          <h2>{activeClaudeProvider?.name ?? '未配置'}</h2>
          <p>{activeClaudeProvider?.apiBase ?? '请在 Providers 页面配置 Claude 使用的第三方中转站。'}</p>
        </div>
        <StatusBadge value={activeClaudeProvider?.health ?? 'unknown'} />
      </section>

      <LogViewer logs={logs} onClear={onClearLogs} />
    </div>
  );
}
