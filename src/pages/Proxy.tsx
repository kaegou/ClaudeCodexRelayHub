import { api } from '../lib/tauri';
import type { AppConfig, ProxyStatus, RequestLogEntry } from '../lib/types';
import CopyButton from '../components/CopyButton';
import LogViewer from '../components/LogViewer';
import StatusBadge from '../components/StatusBadge';

export default function Proxy({
  config,
  status,
  logs,
  busy,
  onRefresh,
  onClearLogs
}: {
  config: AppConfig;
  status: ProxyStatus;
  logs: RequestLogEntry[];
  busy: boolean;
  onRefresh: () => Promise<void>;
  onClearLogs: () => Promise<void>;
}) {
  const codexEndpoint = `http://127.0.0.1:${config.codexProxyPort}/v1`;
  const claudeEndpoint = `http://127.0.0.1:${config.claudeProxyPort}`;

  async function run(action: () => Promise<void>) {
    await action();
    await onRefresh();
  }

  function portStatus(available: boolean, running: boolean) {
    if (running) return <span className="status ok">running</span>;
    return <span className={`status ${available ? 'idle' : 'bad'}`}>{available ? 'port free' : 'port busy'}</span>;
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
            <div className="actions">
              <StatusBadge value={status.codexRunning} />
              {portStatus(status.codexPortAvailable, status.codexRunning)}
            </div>
            <div className="code-row">
              <code>{codexEndpoint}</code>
              <CopyButton value={codexEndpoint} />
            </div>
          </div>
          {!status.codexPortAvailable && !status.codexRunning && <div className="alert error">Codex 端口已被其他进程占用，请修改端口或关闭占用进程。</div>}
          <div className="actions">
            <button disabled={busy || status.codexRunning || !status.codexPortAvailable} onClick={() => run(api.startCodexProxy)}>启动 Codex 代理</button>
            <button className="ghost" disabled={busy || !status.codexRunning} onClick={() => run(api.stopCodexProxy)}>停止</button>
          </div>
        </div>

        <div>
          <div className="section-title">
            <span>Claude 本地代理</span>
            <small>提供健康检查、模型端点和 OpenAI-compatible 转发，供 Claude Desktop Gateway 使用。</small>
          </div>
          <div className="endpoint-card">
            <div className="actions">
              <StatusBadge value={status.claudeRunning} />
              {portStatus(status.claudePortAvailable, status.claudeRunning)}
            </div>
            <div className="code-row">
              <code>{claudeEndpoint}</code>
              <CopyButton value={claudeEndpoint} />
            </div>
          </div>
          {!status.claudePortAvailable && !status.claudeRunning && <div className="alert error">Claude 端口已被其他进程占用，请修改端口或关闭占用进程。</div>}
          <div className="actions">
            <button disabled={busy || status.claudeRunning || !status.claudePortAvailable} onClick={() => run(api.startClaudeProxy)}>启动 Claude 代理</button>
            <button className="ghost" disabled={busy || !status.claudeRunning} onClick={() => run(api.stopClaudeProxy)}>停止</button>
          </div>
        </div>
      </section>

      <LogViewer logs={logs} onClear={onClearLogs} />
    </div>
  );
}
