import type { AppConfig } from '../lib/types';
import { normalizeBaseUrl, uid } from '../lib/utils';

export default function Providers({ config, busy, onSave }: { config: AppConfig; busy: boolean; onSave: (config: AppConfig) => Promise<void> }) {
  async function addClaudeProvider() {
    const id = uid('claude');
    await onSave({
      ...config,
      activeClaudeProviderId: id,
      providers: [
        ...config.providers,
        {
          id,
          name: 'New Claude Relay',
          target: 'claude',
          protocol: 'openai-compatible',
          apiBase: 'https://api.longxiadev.store/v1',
          apiKey: '',
          models: ['gpt-5.5', 'gpt-5.4'],
          defaultModel: 'gpt-5.5',
          thinkModel: 'gpt-5.5',
          supportsResponses: true,
          supportsChatCompletions: true,
          enabled: true,
          notes: ''
        }
      ]
    });
  }

  async function updateProvider(id: string, patch: Record<string, unknown>) {
    await onSave({
      ...config,
      providers: config.providers.map((provider) => provider.id === id ? { ...provider, ...patch } : provider)
    });
  }

  async function removeProvider(id: string) {
    if (!confirm('确认删除这个 Claude Provider？')) return;
    const providers = config.providers.filter((provider) => provider.id !== id);
    await onSave({
      ...config,
      providers,
      activeClaudeProviderId: providers[0]?.id ?? ''
    });
  }

  return (
    <div className="page-stack">
      <section className="panel page-header-card">
        <div>
          <p className="eyebrow">Claude Providers</p>
          <h2>Claude 第三方中转配置</h2>
          <p>Claude Desktop 侧使用单个当前 Provider；Codex 的多 Key 池在 Codex Pool 页面管理。</p>
        </div>
        <button disabled={busy} onClick={addClaudeProvider}>新增 Claude Provider</button>
      </section>

      <div className="cards-grid">
        {config.providers.map((provider) => (
          <section className="panel provider-card" key={provider.id}>
            <div className="section-title row">
              <div>
                <span>{provider.name}</span>
                <small>{provider.id === config.activeClaudeProviderId ? '当前启用' : provider.protocol}</small>
              </div>
              <input type="radio" checked={provider.id === config.activeClaudeProviderId} onChange={() => onSave({ ...config, activeClaudeProviderId: provider.id })} />
            </div>
            <label>名称<input value={provider.name} onChange={(event) => updateProvider(provider.id, { name: event.target.value })} /></label>
            <label>API Base URL<input value={provider.apiBase} onBlur={() => updateProvider(provider.id, { apiBase: normalizeBaseUrl(provider.apiBase) })} onChange={(event) => updateProvider(provider.id, { apiBase: event.target.value })} /></label>
            <label>API Key<input type="password" value={provider.apiKey} onChange={(event) => updateProvider(provider.id, { apiKey: event.target.value })} /></label>
            <label>默认模型<input value={provider.defaultModel} onChange={(event) => updateProvider(provider.id, { defaultModel: event.target.value })} /></label>
            <label>思考模型<input value={provider.thinkModel} onChange={(event) => updateProvider(provider.id, { thinkModel: event.target.value })} /></label>
            <div className="actions">
              <button className="danger ghost" disabled={busy} onClick={() => removeProvider(provider.id)}>删除</button>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
