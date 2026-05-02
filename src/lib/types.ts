export type ProviderProfile = {
  id: string;
  name: string;
  target: 'claude' | 'codex';
  protocol: string;
  apiBase: string;
  apiKey: string;
  models: string[];
  defaultModel: string;
  thinkModel: string;
  supportsResponses: boolean;
  supportsChatCompletions: boolean;
  enabled: boolean;
  notes: string;
};

export type CodexPoolMember = {
  id: string;
  name: string;
  apiBase: string;
  apiKey: string;
  models: string[];
  defaultModel: string;
  weight: number;
  priority: number;
  enabled: boolean;
  maxConcurrentRequests: number;
  cooldownSeconds: number;
  health: string;
  lastCheckedAt: string | null;
  lastError: string | null;
  cooldownUntil: string | null;
  inflight: number;
  successCount: number;
  failureCount: number;
};

export type CodexPool = {
  id: string;
  name: string;
  members: CodexPoolMember[];
  roundRobinCursor: number;
};

export type AppConfig = {
  activeClaudeProviderId: string;
  codexPoolId: string;
  claudeProxyPort: number;
  codexProxyPort: number;
  codexPoolPolicy: 'priority-failover' | 'round-robin' | 'weighted-failover';
  localProxyToken: string;
  providers: ProviderProfile[];
  codexPool: CodexPool;
};

export type ProxyStatus = {
  codexRunning: boolean;
  claudeRunning: boolean;
  codexPort: number;
  claudePort: number;
  lastCodexMemberId: string | null;
};

export type RequestLogEntry = {
  timestamp: string;
  target: string;
  memberId: string | null;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  message: string;
};
