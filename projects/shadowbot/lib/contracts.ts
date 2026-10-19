export type User = { id: string; name: string; email: string };
export type Bot = {
  id: string;
  name: string;
  description: string;
  greeting: string;
  color: string;
  is_public: number;
  owner_id?: string;
  system_prompt?: string;
  created_at?: number;
  updated_at?: number;
  document_count?: number;
  conversation_count?: number;
};
export type Conversation = {
  id: string;
  bot_id: string;
  title: string;
  updated_at: number;
  bot_name?: string;
  color?: string;
};
export type Source = {
  id: string;
  name: string;
  excerpt: string;
  position: number;
};
export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: Source[];
  status: "complete" | "streaming" | "failed" | "stopped";
};
export type KnowledgeDocument = {
  id: string;
  name: string;
  bytes: number;
  chunk_count: number;
  created_at: number;
};
export type ProviderInfo = {
  ready: boolean;
  label: string;
  model: string;
  retrieval: string;
  dailyLimit: number;
};
