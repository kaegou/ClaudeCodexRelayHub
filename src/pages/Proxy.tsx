import { api } from '../lib/tauri';
import type { AppConfig, ProxyStatus, RequestLogEntry } from '../lib/types';
import LogViewer from '../components/LogViewer';
import StatusBadge from '../components/StatusBadge';

export default function Proxy({
  config,
  status,
  logs,
  busy,
  onRefresh
}: {
  config: AppConfig;
  status: ProxyStatus;
  logs: RequestLogEntry[];
  busy: boolean;
  onRefresh: () => Promise<void>;
}) {
  async function run(action: () => Promise<void>) {
    await action();
    await onRefresh();
  }

  return (
    <div className="page-stack">
      <section className="panel two-column">
        <div>
          <div className="section-title">
            <span>Codex 本地代理</span>
            <small>Codex 指向这个 OpenAI-compatible 端点，后端会按池调度到第三方 API Key。</small>
          </div>
          <div className="endpoint-card">
            <StatusBadge value={status.codexRunning} />
            <code>http://127.0.0.1:{config.codexProxyPort}/v1</code>
          </div>
          <div className="actions">
            <button disabled={busy || status.codexRunning} onClick={() => run(api.startCodexProxy)}>启动 Codex 代理</button>
            <button className="ghost" disabled={busy || !status.codexRunning} onClick={() => run(api.stopCodexProxy)}>停止</button>
          </div>
        </div>

        <div>
          <div className="section-title">
            <span>Claude 本地代理</span>
            <small>提供健康检查、模型端点和 OpenAI-compatible 转发，供 Claude Desktop Gateway 使用。</small>
          </div>
          <div className="endpoint-card">
            <StatusBadge value={status.claudeRunning} />
            <code>http://127.0.0.1:{config.claudeProxyPort}</code>
          </div>
          <div className="actions">
            <button disabled={busy || status.claudeRunning} onClick={() => run(api.startClaudeProxy)}>启动 Claude 代理</button>
            <button className="ghost" disabled={busy || !status.claudeRunning} onClick={() => run(api.stopClaudeProxy)}>停止</button>
          </div>
        </div>
      </section>

      <LogViewer logs={logs} />
    </div>
  );
}
