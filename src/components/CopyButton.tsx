import { useState } from 'react';

export default function CopyButton({
  value,
  label = '复制'
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <button className="ghost small" type="button" onClick={copy}>
      {copied ? '已复制' : label}
    </button>
  );
}
