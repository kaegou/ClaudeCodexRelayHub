import { useState } from 'react';
import { CheckCircle2, CircleAlert, CircleDot } from 'lucide-react';
import CopyButton from '../components/CopyButton';
import { api } from '../lib/tauri';
import type { AppConfig, LocalProxyDiagnostics, ProviderProfile, ProxyStatus } from '../lib/types';

type CheckState = 'pass' | 'warn' | 'todo';

type CheckItem = {
  title: string;
  detail: string;
  state: CheckState;
};

export default function ReadinessPage({
  config,
  status,
  activeClaudeProvider
}: {
  config: AppConfig;
  status: ProxyStatus;
  activeClaudeProvider: ProviderProfile | null;
}) {
  const [diagnostics, setDiagnostics] = useState<LocalProxyDiagnostics | null>(null);
  const [diagnosticsBusy, setDiagnosticsBusy] = useState(false);
  const [diagnosticsError, setDiagnosticsError] = useState<string | null>(null);
  const enabledMembers = config.codexPool.members.filter((member) => member.enabled);
  const healthyMembers = enabledMembers.filter((member) => member.health === 'healthy');
  const membersWithKeys = enabledMembers.filter((member) => member.apiBase.trim() && member.apiKey.trim() && member.defaultModel.trim());
  const enabledClaudeProviders = config.providers.filter((provider) => provider.enabled && provider.target === 'claude');
  const codexEndpoint = `http://127.0.0.1:${config.codexProxyPort}/v1`;
  const claudeEndpoint = `http://127.0.0.1:${config.claudeProxyPort}`;
  const codexEnv = `OPENAI_BASE_URL=${codexEndpoint}\nOPENAI_API_KEY=${config.localProxyToken}`;

  const checks: CheckItem[] = [
    {
      title: 'Codex Pool 已配置',
      detail: `${membersWithKeys.length}/${enabledMembers.length} 个启用成员包含 Base URL、API Key 和默认模型。`,
      state: enabledMembers.length > 0 && membersWithKeys.length === enabledMembers.length ? 'pass' : 'todo'
    },
    {
      title: 'Codex Pool 健康状态',
      detail: healthyMembers.length > 0 ? `${healthyMembers.length} 个成员健康，可直接调度。` : '还没有健康成员，请在 Codex Pool 页面测试或刷新健康状态。',
      state: healthyMembers.length > 0 ? 'pass' : membersWithKeys.length > 0 ? 'warn' : 'todo'
    },
    {
      title: 'Codex 本地代理',
      detail: status.codexRunning ? `运行中：${codexEndpoint}` : status.codexPortAvailable ? '端口可用，但代理尚未启动。' : '端口被占用，请在 Settings 修改端口或关闭占用进程。',
      state: status.codexRunning ? 'pass' : status.codexPortAvailable ? 'warn' : 'todo'
    },
    {
      title: 'Claude Provider 已配置',
      detail: activeClaudeProvider?.apiKey.trim() ? `${activeClaudeProvider.name} 已配置 API Key。` : '请在 Providers 页面为 Claude Provider 填入第三方 API Key。',
      state: activeClaudeProvider?.apiKey.trim() ? 'pass' : enabledClaudeProviders.length > 0 ? 'warn' : 'todo'
    },
    {
      title: 'Claude 本地代理',
      detail: status.claudeRunning ? `运行中：${claudeEndpoint}` : status.claudePortAvailable ? '端口可用；写入 Claude Desktop Gateway 前建议先启动。' : '端口被占用，请在 Settings 修改端口或关闭占用进程。',
      state: status.claudeRunning ? 'pass' : status.claudePortAvailable ? 'warn' : 'todo'
    },
    {
      title: '本地 Token',
      detail: config.localProxyToken.trim() ? '已配置本地代理 Token，Codex/Claude Desktop 需要使用它访问本机代理。' : '请在 Settings 生成本地代理 Token。',
      state: config.localProxyToken.trim() ? 'pass' : 'todo'
    }
  ];

  async function runDiagnostics() {
    setDiagnosticsBusy(true);
    setDiagnosticsError(null);
    try {
      setDiagnostics(await api.localProxyDiagnostics());
    } catch (error) {
      setDiagnosticsError(String(error));
    } finally {
      setDiagnosticsBusy(false);
    }
  }

  const passed = checks.filter((check) => check.state === 'pass').length;
  const score = Math.round((passed / checks.length) * 100);

  return (
    <div className="page-stack">
      <section className="panel page-header-card">
        <div>
          <p className="eyebrow">Release Readiness</p>
          <h2>上线自检</h2>
          <p>这里集中检查本机试用前最关键的配置、健康状态和代理状态。</p>
        </div>
        <div className="readiness-score">
          <strong>{score}%</strong>
          <span>{passed}/{checks.length} 项通过</span>
        </div>
      </section>

      <section className="panel readiness-grid">
        {checks.map((check) => (
          <div className={`readiness-card ${check.state}`} key={check.title}>
            {check.state === 'pass' && <CheckCircle2 size={22} />}
            {check.state === 'warn' && <CircleAlert size={22} />}
            {check.state === 'todo' && <CircleDot size={22} />}
            <div>
              <strong>{check.title}</strong>
              <p>{check.detail}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="panel">
        <div className="section-title row">
          <div>
            <span>本地代理 Health 自检</span>
            <small>直接请求 Claude / Codex 本机代理的 /health，确认端口和服务真实可达。</small>
          </div>
          <button className="ghost" disabled={diagnosticsBusy} onClick={runDiagnostics}>运行本地自检</button>
        </div>
        {diagnosticsError && <div className="alert error">{diagnosticsError}</div>}
        <div className="diagnostics-grid">
          {(['codex', 'claude'] as const).map((target) => {
            const item = diagnostics?.[target];
            return (
              <div className={`diagnostic-card ${item?.ok ? 'pass' : 'todo'}`} key={target}>
                <strong>{target === 'codex' ? 'Codex Proxy' : 'Claude Proxy'}</strong>
                <code>{item?.url ?? (target === 'codex' ? `${codexEndpoint.replace('/v1', '')}/health` : `${claudeEndpoint}/health`)}</code>
                <p>{item ? item.message : '尚未运行本地自检。'}</p>
                <small>{item ? `HTTP ${item.status ?? '-'} · ${item.durationMs}ms` : '点击按钮检测'}</small>
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel two-column">
        <div className="guide-list">
          <div className="section-title">
            <span>Codex 试用步骤</span>
            <small>适合 OpenAI-compatible 第三方中转 API。</small>
          </div>
          <ol>
            <li>在 Codex Pool 填入第三方 Base URL、API Key 和默认模型。</li>
            <li>点击“刷新健康状态”或单独测试 Pool Member。</li>
            <li>在 Proxy 页面启动 Codex 本地代理。</li>
            <li>把下面两行环境变量写入新终端或使用 Settings 的写入按钮。</li>
          </ol>
          <div className="copy-box wide">
            <div className="code-row">
              <code>OPENAI_BASE_URL={codexEndpoint}</code>
              <CopyButton value={`OPENAI_BASE_URL=${codexEndpoint}`} />
            </div>
            <div className="code-row">
              <code>OPENAI_API_KEY={config.localProxyToken}</code>
              <CopyButton value={`OPENAI_API_KEY=${config.localProxyToken}`} />
            </div>
            <CopyButton value={codexEnv} label="复制 Codex 环境变量" />
          </div>
        </div>

        <div className="guide-list">
          <div className="section-title">
            <span>Claude Desktop 试用步骤</span>
            <small>用于 Claude Desktop Gateway 指向本机 Claude 代理。</small>
          </div>
          <ol>
            <li>在 Providers 配置 Claude 使用的第三方中转 Provider。</li>
            <li>启动 Claude 本地代理。</li>
            <li>在 Settings 点击写入 Claude Desktop Gateway 配置。</li>
            <li>重启 Claude Desktop 后验证请求日志是否出现 Claude 代理调用。</li>
          </ol>
          <div className="copy-box wide">
            <div className="code-row">
              <code>{claudeEndpoint}</code>
              <CopyButton value={claudeEndpoint} />
            </div>
          </div>
        </div>
      </section>

      <section className="panel warning-panel">
        <strong>最终联调提示</strong>
        <p>安装包能验证桌面程序可启动；真正的 100% 完成还需要使用你的真实第三方 API Key 实测模型列表、普通对话、Responses 和流式请求。</p>
      </section>
    </div>
  );
}
