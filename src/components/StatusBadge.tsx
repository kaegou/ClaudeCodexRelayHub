import type { ReactNode } from 'react';

export default function StatusBadge({ value }: { value: string | boolean }) {
  const text = typeof value === 'boolean' ? (value ? 'running' : 'stopped') : value;
  const kind = text === 'healthy' || text === 'running' ? 'ok' : text === 'unknown' || text === 'stopped' ? 'idle' : 'bad';
  return <span className={`status ${kind}`}>{text}</span>;
}

export function StatCard({ title, value, detail }: { title: string; value: ReactNode; detail?: ReactNode }) {
  return (
    <section className="panel stat-card">
      <span>{title}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </section>
  );
}
