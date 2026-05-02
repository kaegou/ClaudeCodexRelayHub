import { useState } from 'react';
import CopyButton from '../components/CopyButton';
import { api } from '../lib/tauri';
import type { AppConfig } from '../lib/types';

export default function SettingsPage({
  config,
  busy,
  onSave
}: {
  config: AppConfig;
  busy: boolean;
  onSave: (config: AppConfig) => Promise<void>;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const codexBaseUrl = `http://127.0.0.1:${config.codexProxyPort}/v1`;
  const codexEnv = `OPENAI_BASE_URL=${codexBaseUrl}
OPENAI_API_KEY=${config.localProxyToken}`;

  async function run(action: () => Promise<string>) {
    setMessage(null);
    try {
      setMessage(await action());
    } catch (error) {
      setMessage(String(error));
    }
  }

  function generateToken() {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    onSave({ ...config, localProxyToken: `relay-${token}` });
  }

  function portValue(value: string) {
    const port = Number(value);
    if (!Number.isFinite(port)) return 0;
    return Math.min(65535, Math.max(1, Math.trunc(port)));
  }

  return (
    <div className="page-stack">
      <section className="panel page-header-card">
        <div>
          <p className="eyebrow">Local Settings</p>
          <h2>本地配置</h2>
          <p>代理默认只监听 127.0.0.1，不对局域网或公网开放。</p>
        </div>
      </section>

      {message && <section className="alert error">{message}</section>}

      <section className="panel form-panel">
        <div className="section-title">
          <span>代理端口</span>
          <small>修改端口后需要重启对应代理。</small>
        </div>
        <div className="form-grid">
          <label>
            Claude Proxy Port
            <input type="number" min={1} max={65535} value={config.claudeProxyPort} onChange={(event) => onSave({ ...config, claudeProxyPort: portValue(event.target.value) })} />
          </label>
          <label>
            Codex Proxy Port
            <input type="number" min={1} max={65535} value={config.codexProxyPort} onChange={(event) => onSave({ ...config, codexProxyPort: portValue(event.target.value) })} />
          </label>
          <label>
            Local Proxy Token
            <div className="input-row token-row">
              <input type={showToken ? 'text' : 'password'} value={config.localProxyToken} onChange={(event) => onSave({ ...config, localProxyToken: event.target.value })} />
              <button className="ghost small" type="button" onClick={() => setShowToken(!showToken)}>{showToken ? '隐藏' : '显示'}</button>
              <button className="ghost small" type="button" disabled={busy} onClick={generateToken}>生成</button>
            </div>
          </label>
        </div>
      </section>

      <section className="panel copy-box wide">
        <span>Codex 推荐配置</span>
        <div className="code-row">
          <code>OPENAI_BASE_URL={codexBaseUrl}</code>
          <CopyButton value={`OPENAI_BASE_URL=${codexBaseUrl}`} />
        </div>
        <div className="code-row">
          <code>OPENAI_API_KEY={config.localProxyToken}</code>
          <CopyButton value={`OPENAI_API_KEY=${config.localProxyToken}`} />
        </div>
        <p>点击下面按钮会写入当前 Windows 用户环境变量，新终端或新启动的 Codex 进程会读取到。</p>
        <div className="actions">
          <button disabled={busy} onClick={() => run(api.writeCodexEnvironment)}>写入 Codex 环境变量</button>
          <CopyButton value={codexEnv} label="复制配置" />
        </div>
      </section>

      <section className="panel warning-panel">
        <strong>Claude Desktop Gateway</strong>
        <p>写入前会自动备份现有 Claude Desktop 配置，然后把 Gateway 指向本地 Claude 代理。</p>
        <button disabled={busy} onClick={() => run(api.writeClaudeGatewayConfig)}>写入 Claude Desktop Gateway 配置</button>
      </section>

      <section className="panel warning-panel">
        <strong>安全提示</strong>
        <p>API Key 当前保存在本机应用配置目录中。不要把配置文件、截图或日志发给他人。删除池成员前会要求确认。</p>
      </section>
    </div>
  );
}
