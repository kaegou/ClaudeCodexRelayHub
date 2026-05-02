import { invoke } from '@tauri-apps/api/core';
import type { AppConfig, CodexPoolMember, ProviderProfile, ProxyStatus, RequestLogEntry } from './types';

export const api = {
  getConfig: () => invoke<AppConfig>('get_config'),
  saveConfig: (nextConfig: AppConfig) => invoke<AppConfig>('save_app_config', { nextConfig }),
  testPoolMember: (memberId: string) => invoke<CodexPoolMember>('test_pool_member', { memberId }),
  testProvider: (providerId: string) => invoke<ProviderProfile>('test_provider', { providerId }),
  startCodexProxy: () => invoke<void>('start_codex_proxy'),
  stopCodexProxy: () => invoke<void>('stop_codex_proxy'),
  startClaudeProxy: () => invoke<void>('start_claude_proxy'),
  stopClaudeProxy: () => invoke<void>('stop_claude_proxy'),
  proxyStatus: () => invoke<ProxyStatus>('proxy_status'),
  getLogs: () => invoke<RequestLogEntry[]>('get_logs'),
  writeCodexEnvironment: () => invoke<string>('write_codex_environment'),
  writeClaudeGatewayConfig: () => invoke<string>('write_claude_gateway_config')
};
