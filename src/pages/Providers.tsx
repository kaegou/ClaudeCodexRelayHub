import { useState } from 'react';
import { api } from '../lib/tauri';
import type { AppConfig, ProviderProfile } from '../lib/types';
import { joinModels, normalizeBaseUrl, splitModels, uid } from '../lib/utils';

export default function Providers({
  config,
  busy,
  onSave
}: {
  config: AppConfig;
  busy: boolean;
  onSave: (config: AppConfig) => Promise<void>;
}) {
  const [showKeys, setShowKeys] = useState(false);

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
          notes: '',
          health: 'unknown',
          lastCheckedAt: null,
          lastError: null
        }
      ]
    });
  }

  async function updateProvider(id: string, patch: Partial<ProviderProfile>) {
    await onSave({
      ...config,
      providers: config.providers.map((provider) => (provider.id === id ? { ...provider, ...patch } : provider))
    });
  }

  async function testProvider(id: string) {
    const checked = await api.testProvider(id);
    await updateProvider(id, checked);
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

  function statusClass(health: string) {
    if (health === 'healthy') return 'ok';
    if (health === 'unknown') return 'idle';
    return 'bad';
  }

  return (
    <div className="page-stack">
      <section className="panel page-header-card">
        <div>
          <p className="eyebrow">Claude Providers</p>
          <h2>Claude 第三方中转接口</h2>
          <p>Claude Desktop 使用当前 Provider；Codex 的多 Key 池在 Codex Pool 页面管理。</p>
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
            <div className="actions">
              <span className={`status ${statusClass(provider.health)}`}>{provider.health || 'unknown'}</span>
              {provider.lastCheckedAt && <small>上次测试：{new Date(provider.lastCheckedAt).toLocaleString()}</small>}
            </div>
            {provider.lastError && <div className="alert error">{provider.lastError}</div>}
            <label>名称<input value={provider.name} onChange={(event) => updateProvider(provider.id, { name: event.target.value })} /></label>
            <label>API Base URL<input value={provider.apiBase} onBlur={() => updateProvider(provider.id, { apiBase: normalizeBaseUrl(provider.apiBase) })} onChange={(event) => updateProvider(provider.id, { apiBase: event.target.value })} /></label>
            <label>
              API Key
              <div className="input-row">
                <input type={showKeys ? 'text' : 'password'} value={provider.apiKey} onChange={(event) => updateProvider(provider.id, { apiKey: event.target.value })} />
                <button className="ghost small" type="button" onClick={() => setShowKeys(!showKeys)}>{showKeys ? '隐藏' : '显示'}</button>
              </div>
            </label>
            <label>模型列表<input value={joinModels(provider.models)} onChange={(event) => updateProvider(provider.id, { models: splitModels(event.target.value) })} /></label>
            <label>默认模型<input value={provider.defaultModel} onChange={(event) => updateProvider(provider.id, { defaultModel: event.target.value })} /></label>
            <label>思考模型<input value={provider.thinkModel} onChange={(event) => updateProvider(provider.id, { thinkModel: event.target.value })} /></label>
            <label className="checkbox-row"><input type="checkbox" checked={provider.enabled} onChange={(event) => updateProvider(provider.id, { enabled: event.target.checked })} />启用</label>
            <div className="actions">
              <button className="ghost" disabled={busy || !provider.apiKey.trim()} onClick={() => testProvider(provider.id)}>测试连接</button>
              <button className="danger ghost" disabled={busy} onClick={() => removeProvider(provider.id)}>删除</button>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
