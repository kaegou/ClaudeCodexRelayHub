import type { AppConfig } from '../lib/types';

export default function SettingsPage({ config, busy, onSave }: { config: AppConfig; busy: boolean; onSave: (config: AppConfig) => Promise<void> }) {
  return (
    <div className="page-stack">
      <section className="panel page-header-card">
        <div>
          <p className="eyebrow">Local Settings</p>
          <h2>本地配置</h2>
          <p>代理默认仅绑定 127.0.0.1，不对局域网或公网开放。</p>
        </div>
      </section>

      <section className="panel form-panel">
        <div className="section-title">
          <span>代理端口</span>
          <small>修改端口后需要重启对应代理。</small>
        </div>
        <div className="form-grid">
          <label>
            Claude Proxy Port
            <input type="number" value={config.claudeProxyPort} onChange={(event) => onSave({ ...config, claudeProxyPort: Number(event.target.value) })} />
          </label>
          <label>
            Codex Proxy Port
            <input type="number" value={config.codexProxyPort} onChange={(event) => onSave({ ...config, codexProxyPort: Number(event.target.value) })} />
          </label>
          <label>
            Local Proxy Token
            <input value={config.localProxyToken} onChange={(event) => onSave({ ...config, localProxyToken: event.target.value })} />
          </label>
        </div>
      </section>

      <section className="panel copy-box wide">
        <span>Codex 推荐配置</span>
        <code>OPENAI_BASE_URL=http://127.0.0.1:{config.codexProxyPort}/v1</code>
        <code>OPENAI_API_KEY={config.localProxyToken}</code>
        <p>首版不直接写 Codex 配置文件，避免误改未知客户端；后续可按你的 Codex 客户端格式增加一键写入。</p>
      </section>

      <section className="panel warning-panel">
        <strong>安全提示</strong>
        <p>API Key 当前保存在本机应用配置目录中。不要把配置文件、截图或日志发给他人。删除池成员前会要求确认。</p>
        <button disabled={busy} onClick={() => alert('Claude Desktop Gateway 写入将在下一批实现。')}>Claude Desktop 写入配置</button>
      </section>
    </div>
  );
}
