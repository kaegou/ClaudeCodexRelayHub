import { useMemo, useState } from 'react';
import type { RequestLogEntry } from '../lib/types';

export default function LogViewer({
  logs,
  onClear
}: {
  logs: RequestLogEntry[];
  onClear?: () => Promise<void>;
}) {
  const [targetFilter, setTargetFilter] = useState('all');
  const [keyword, setKeyword] = useState('');

  const targets = useMemo(() => Array.from(new Set(logs.map((log) => log.target))).sort(), [logs]);
  const filteredLogs = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return logs.filter((log) => {
      const targetMatches = targetFilter === 'all' || log.target === targetFilter;
      if (!targetMatches) return false;
      if (!normalizedKeyword) return true;
      return [log.target, log.method, log.path, log.memberId ?? '', log.message, String(log.status)]
        .join(' ')
        .toLowerCase()
        .includes(normalizedKeyword);
    });
  }, [keyword, logs, targetFilter]);

  function exportLogs() {
    const blob = new Blob([JSON.stringify(filteredLogs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relay-hub-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="panel log-panel">
      <div className="section-title row">
        <div>
          <span>代理与系统日志</span>
          <small>最多显示最近 500 条，请求头和 Key 会在后端脱敏</small>
        </div>
        <div className="actions">
          <button className="ghost small" type="button" disabled={filteredLogs.length === 0} onClick={exportLogs}>导出 JSON</button>
          {onClear && <button className="ghost small" type="button" onClick={onClear}>清空日志</button>}
        </div>
      </div>
      <div className="log-filters">
        <select value={targetFilter} onChange={(event) => setTargetFilter(event.target.value)}>
          <option value="all">全部目标</option>
          {targets.map((target) => (
            <option key={target} value={target}>{target}</option>
          ))}
        </select>
        <input value={keyword} placeholder="按路径、成员、状态或消息搜索" onChange={(event) => setKeyword(event.target.value)} />
        <small>{filteredLogs.length} / {logs.length}</small>
      </div>
      <div className="log-list">
        {filteredLogs.length === 0 ? (
          <div className="empty">暂无匹配日志</div>
        ) : (
          filteredLogs.map((log, index) => (
            <div className="log-row" key={`${log.timestamp}-${index}`}>
              <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
              <strong>{log.target}</strong>
              <code>{log.method} {log.path}</code>
              <em>{log.status || '-'}</em>
              <small>{log.memberId ?? '-'}</small>
              <p>{log.message}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
