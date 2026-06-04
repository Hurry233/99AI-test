export type AgentTraceStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface AttachmentRef {
  id: string;
  type: "image" | "file" | "audio" | "video" | "link";
  name?: string;
  url: string;
  mimeType?: string;
  size?: number;
  source?: "upload" | "generated" | "tool" | "legacy";
  metadata?: Record<string, unknown>;
}

export interface Artifact {
  id: string;
  type:
    | "image"
    | "file"
    | "audio"
    | "video"
    | "text"
    | "html"
    | "markdown"
    | "json";
  title?: string;
  content?: string;
  url?: string;
  attachments?: AttachmentRef[];
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

export interface ToolCallEvent {
  id: string;
  type: "tool_call";
  name: string;
  status?: AgentTraceStatus;
  arguments?: unknown;
  startedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface ToolResultEvent {
  id: string;
  type: "tool_result";
  toolCallId?: string;
  name: string;
  status?: AgentTraceStatus;
  output?: unknown;
  attachments?: AttachmentRef[];
  completedAt?: string;
  metadata?: Record<string, unknown>;
}

export type ResponseItem =
  | {
      id: string;
      type: "message" | "message_delta";
      role: "assistant" | "user" | "system";
      text: string;
      createdAt?: string;
      attachments?: AttachmentRef[];
      metadata?: Record<string, unknown>;
    }
  | {
      id: string;
      type: "reasoning" | "reasoning_delta";
      text: string;
      createdAt?: string;
      metadata?: Record<string, unknown>;
    }
  | ToolCallEvent
  | ToolResultEvent
  | {
      id: string;
      type: "artifact";
      artifact: Artifact;
      createdAt?: string;
      metadata?: Record<string, unknown>;
    };

export interface ConversationTurn {
  id: string | number;
  role: "user" | "assistant" | "system";
  content: string;
  responseItems?: ResponseItem[];
  artifacts?: Artifact[];
  attachments?: AttachmentRef[];
  createdAt?: string | Date;
  metadata?: Record<string, unknown>;
}

export interface AgentRun {
  runId: string;
  status: AgentTraceStatus;
  turns: ConversationTurn[];
  responseItems: ResponseItem[];
  artifacts: Artifact[];
  toolSummary?: string;
  startedAt?: string | Date;
  completedAt?: string | Date;
  metadata?: Record<string, unknown>;
}
