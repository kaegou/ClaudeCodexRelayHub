import type { RequestLogEntry } from '../lib/types';

export default function LogViewer({ logs }: { logs: RequestLogEntry[] }) {
  return (
    <section className="panel log-panel">
      <div className="section-title">
        <span>请求与系统日志</span>
        <small>最多显示最近 500 条，敏感头和 Key 会在后端脱敏。</small>
      </div>
      <div className="log-list">
        {logs.length === 0 ? (
          <div className="empty">暂无日志</div>
        ) : (
          logs.map((log, index) => (
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
