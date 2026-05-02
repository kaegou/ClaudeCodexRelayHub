import { useState } from 'react';
import type { AppConfig, CodexPoolMember } from '../lib/types';
import { joinModels, normalizeBaseUrl, splitModels, uid } from '../lib/utils';
import StatusBadge from '../components/StatusBadge';

const emptyMember = (): CodexPoolMember => ({
  id: uid('pool'),
  name: 'New API Key',
  apiBase: 'https://api.longxiadev.store/v1',
  apiKey: '',
  models: ['gpt-5.5', 'gpt-5.4'],
  defaultModel: 'gpt-5.5',
  weight: 100,
  priority: 1,
  enabled: true,
  maxConcurrentRequests: 2,
  cooldownSeconds: 120,
  health: 'unknown',
  lastCheckedAt: null,
  lastError: null,
  cooldownUntil: null,
  inflight: 0,
  successCount: 0,
  failureCount: 0
});

export default function CodexPool({
  config,
  busy,
  onSave,
  onTestMember
}: {
  config: AppConfig;
  busy: boolean;
  onSave: (config: AppConfig) => Promise<void>;
  onTestMember: (memberId: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState<CodexPoolMember | null>(null);
  const [modelsText, setModelsText] = useState('');
  const [showKey, setShowKey] = useState(false);

  function edit(member: CodexPoolMember) {
    setEditing({ ...member });
    setModelsText(joinModels(member.models));
    setShowKey(false);
  }

  function add() {
    const member = emptyMember();
    setEditing(member);
    setModelsText(joinModels(member.models));
    setShowKey(false);
  }

  async function saveMember() {
    if (!editing) return;
    const nextMember = {
      ...editing,
      apiBase: normalizeBaseUrl(editing.apiBase),
      models: splitModels(modelsText)
    };
    const exists = config.codexPool.members.some((member) => member.id === nextMember.id);
    await onSave({
      ...config,
      codexPool: {
        ...config.codexPool,
        members: exists
          ? config.codexPool.members.map((member) => (member.id === nextMember.id ? nextMember : member))
          : [...config.codexPool.members, nextMember]
      }
    });
    setEditing(null);
  }

  async function remove(memberId: string) {
    if (!confirm('确认删除这个池成员？')) return;
    await onSave({
      ...config,
      codexPool: {
        ...config.codexPool,
        members: config.codexPool.members.filter((member) => member.id !== memberId)
      }
    });
  }

  function formatTime(value: string | null) {
    return value ? new Date(value).toLocaleString() : '未检查';
  }

  return (
    <div className="page-stack">
      <section className="panel page-header-card">
        <div>
          <p className="eyebrow">Codex Local Proxy Pool</p>
          <h2>Codex 第三方接口共享池</h2>
          <p>Codex 请求进入本地代理后，会按策略从这里选择一个可用 OpenAI-compatible API Key 转发。</p>
        </div>
        <div className="actions">
          <select value={config.codexPoolPolicy} onChange={(event) => onSave({ ...config, codexPoolPolicy: event.target.value as AppConfig['codexPoolPolicy'] })}>
            <option value="weighted-failover">weighted-failover</option>
            <option value="priority-failover">priority-failover</option>
            <option value="round-robin">round-robin</option>
          </select>
          <button onClick={add}>新增池成员</button>
        </div>
      </section>

      <section className="panel table-panel">
        <table>
          <thead>
            <tr>
              <th>名称</th>
              <th>Base URL</th>
              <th>模型</th>
              <th>状态</th>
              <th>权重/优先级</th>
              <th>成功/失败</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {config.codexPool.members.map((member) => (
              <tr key={member.id}>
                <td>
                  <strong>{member.name}</strong>
                  <small>{member.enabled ? 'enabled' : 'disabled'}</small>
                </td>
                <td><code>{member.apiBase}</code></td>
                <td>{member.defaultModel}</td>
                <td>
                  <StatusBadge value={member.health} />
                  <small>上次检查：{formatTime(member.lastCheckedAt)}</small>
                  {member.cooldownUntil && <small>冷却至：{formatTime(member.cooldownUntil)}</small>}
                  {member.lastError && <small className="inline-error">{member.lastError}</small>}
                </td>
                <td>
                  {member.weight} / {member.priority}
                  <small>并发：{member.inflight}/{member.maxConcurrentRequests || '∞'}</small>
                  <small>冷却：{member.cooldownSeconds}s</small>
                </td>
                <td>{member.successCount} / {member.failureCount}</td>
                <td className="row-actions">
                  <button className="ghost" disabled={busy} onClick={() => edit(member)}>编辑</button>
                  <button className="ghost" disabled={busy || !member.apiKey} onClick={() => onTestMember(member.id)}>测试</button>
                  <button className="danger ghost" disabled={busy} onClick={() => remove(member.id)}>删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {editing && (
        <section className="panel form-panel">
          <div className="section-title">
            <span>编辑池成员</span>
            <small>API Key 只用于本机代理转发，日志会脱敏。</small>
          </div>
          <div className="form-grid">
            <label>名称<input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label>
            <label>API Base URL<input value={editing.apiBase} onChange={(event) => setEditing({ ...editing, apiBase: event.target.value })} /></label>
            <label>
              API Key
              <div className="input-row">
                <input type={showKey ? 'text' : 'password'} value={editing.apiKey} onChange={(event) => setEditing({ ...editing, apiKey: event.target.value })} />
                <button className="ghost small" type="button" onClick={() => setShowKey(!showKey)}>{showKey ? '隐藏' : '显示'}</button>
              </div>
            </label>
            <label>模型列表<input value={modelsText} onChange={(event) => setModelsText(event.target.value)} /></label>
            <label>默认模型<input value={editing.defaultModel} onChange={(event) => setEditing({ ...editing, defaultModel: event.target.value })} /></label>
            <label>权重<input type="number" value={editing.weight} onChange={(event) => setEditing({ ...editing, weight: Number(event.target.value) })} /></label>
            <label>优先级<input type="number" value={editing.priority} onChange={(event) => setEditing({ ...editing, priority: Number(event.target.value) })} /></label>
            <label>并发上限<input type="number" value={editing.maxConcurrentRequests} onChange={(event) => setEditing({ ...editing, maxConcurrentRequests: Number(event.target.value) })} /></label>
            <label>冷却秒数<input type="number" value={editing.cooldownSeconds} onChange={(event) => setEditing({ ...editing, cooldownSeconds: Number(event.target.value) })} /></label>
            <label className="checkbox-row"><input type="checkbox" checked={editing.enabled} onChange={(event) => setEditing({ ...editing, enabled: event.target.checked })} />启用</label>
          </div>
          <div className="actions">
            <button disabled={busy} onClick={saveMember}>保存</button>
            <button className="ghost" onClick={() => setEditing(null)}>取消</button>
          </div>
        </section>
      )}
    </div>
  );
}
