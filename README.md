# Claude Codex Relay Hub

本地桌面工具，用于管理 Claude 与 Codex 的第三方 OpenAI-compatible 中转接口，并为 Codex 提供本地代理共享池。

首版重点：

- Codex 本地代理：`http://127.0.0.1:3458/v1`
- Codex API Key 池：多组第三方 Base URL / API Key，支持权重、优先级、冷却和健康检查
- Claude 本地代理：`http://127.0.0.1:3457`
- 内置 Longxia 模板：`https://api.longxiadev.store/v1`

敏感提示：首版配置保存在本机应用配置目录，不要分享配置文件或日志。
