/**
 * MSP 公共桥接层：统一从 ../msp-ts 导入，并提供各 World 节点共用的生命周期/配置辅助。
 */

export {
  MSPNode,
  Manifest,
  SignalType,
  ToolResult,
  textContent,
  imageContent,
  audioContent,
  blobRef,
  isValidNodeId,
  isValidSignalPath,
  isValidToolName,
  patternMatches,
} from "../../msp-ts/src/index.ts";

export type {
  MSPNodeOptions,
  Signal,
  SkillSpec,
  ToolSpec,
  ToolHandler,
  SignalHandler,
  Endpoint,
  ContentBlock,
  GrantsConfig,
  PeerGrant,
} from "../../msp-ts/src/index.ts";

import {
  MSPNode,
  isValidNodeId,
  isValidSignalPath,
  isValidToolName,
} from "../../msp-ts/src/index.ts";
import type { Endpoint } from "../../msp-ts/src/index.ts";

export interface WorldNodeRuntime {
  node: MSPNode;
  endpoint: Endpoint;
  stop: () => void;
}

/** 从环境变量读取通用 MSP 节点选项（nodesDir / host / port / connectPolicy）。 */
export function mspOptionsFromEnv(prefix = "MSP"): {
  nodesDir?: string;
  host?: string;
  port?: number;
  connectPolicy?: "eager" | "lazy";
} {
  const nodesDir = process.env[`${prefix}_NODES_DIR`] || process.env.MSP_NODES_DIR || undefined;
  const host = process.env[`${prefix}_HOST`] || process.env.MSP_HOST || undefined;
  const rawPort = process.env[`${prefix}_PORT`] || process.env.MSP_PORT;
  const port = rawPort ? Number(rawPort) : undefined;
  const policy = process.env[`${prefix}_CONNECT_POLICY`] || process.env.MSP_CONNECT_POLICY;
  const connectPolicy = policy === "eager" || policy === "lazy" ? policy : undefined;
  return {
    ...(nodesDir ? { nodesDir } : {}),
    ...(host ? { host } : {}),
    ...(port && Number.isInteger(port) && port > 0 ? { port } : {}),
    ...(connectPolicy ? { connectPolicy } : {}),
  };
}

/** 绑定 SIGINT / SIGTERM 优雅退出。 */
export function installShutdownHooks(stopFn: () => void): void {
  let stopping = false;
  const onSignal = () => {
    if (stopping) return;
    stopping = true;
    stopFn();
    process.exit(0);
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
}

/** 对齐 msp-py 0.1.0a2 lint_skills() + grammar 校验节点 Manifest。 */
export function lintManifest(node: MSPNode): string[] {
  const problems: string[] = [];
  if (!isValidNodeId(node.nodeId)) {
    problems.push(`非法 nodeId: ${JSON.stringify(node.nodeId)}`);
  }
  const toolNames = new Set(node.manifest.tools.map((t) => t.name));
  for (const t of node.manifest.tools) {
    if (!isValidToolName(t.name)) {
      problems.push(`节点 ${node.nodeId} 含非法工具名: ${JSON.stringify(t.name)}`);
    }
  }
  for (const s of node.manifest.signals) {
    if (!isValidSignalPath(s.path)) {
      problems.push(`节点 ${node.nodeId} 含非法信号路径: ${JSON.stringify(s.path)}`);
    }
  }
  for (const sk of node.manifest.skills) {
    if (!sk.whenToUse || !sk.whenToUse.trim()) {
      problems.push(`技能 ${sk.name} 的 whenToUse 为空`);
    }
    for (const tool of sk.toolsUsed ?? []) {
      if (!toolNames.has(tool)) {
        problems.push(`技能 ${sk.name} 引用了不存在的工具 ${JSON.stringify(tool)}`);
      }
    }
  }
  return problems;
}
