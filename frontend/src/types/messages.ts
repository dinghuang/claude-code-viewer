// frontend/src/types/messages.ts
/** Process message types from SSE stream */

export type ProcessMessageType =
  | "thinking"
  | "tool_use"
  | "tool_result"
  | "text"
  | "permission"
  | "result"
  | "error";

export interface ProcessMessage {
  id: string;
  type: ProcessMessageType;
  content: string;
  timestamp: number;

  // Tool related
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_result?: unknown;

  // Permission related
  risk_level?: "low" | "medium" | "high";

  // Result related
  actions?: string[];
  cost?: number;
}
