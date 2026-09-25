/**
 * Tipos do schema Supabase, derivados manualmente de:
 *   - supabase/migrations/20260925141018_init_schema.sql
 *   - supabase/migrations/20260925141021_rls_policies.sql
 *
 * `Relationships` foi deixado vazio (`[]`) em todas as tabelas — é exigido pelo
 * tipo `GenericTable` do @supabase/supabase-js para o `.from()` tipado funcionar,
 * mas não habilita joins embutidos tipados (`.select('*, outra_tabela(*)')`).
 *
 * Quando um projeto Supabase estiver linkado (`supabase link`), substituir por:
 *   supabase gen types typescript --linked > src/types.ts
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type ProfileRole = 'admin' | 'pm' | 'developer' | 'approver' | 'viewer';
export type ProjectStatus = 'active' | 'archived';
export type AgentCode = 'MEYLA' | 'PM' | 'DEV' | 'AUDIT' | 'QA';
export type AgentType = 'human' | 'ai';
export type TaskState =
  | 'BACKLOG'
  | 'QUEUED'
  | 'IN_DEV'
  | 'IN_AUDIT'
  | 'IN_QA'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'READY_TO_PUBLISH'
  | 'PUBLISHED'
  | 'CHANGES_REQUESTED'
  | 'BLOCKED'
  | 'CANCELLED'
  | 'REJECTED';
export type TaskDependencyType = 'blocks' | 'relates_to';
export type ActorType = 'human' | 'agent' | 'system';
export type ExecutionStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export type ReviewType = 'audit' | 'qa';
export type ReviewResult = 'approved' | 'changes_requested' | 'rejected';
export type ApprovalType = 'task_approval' | 'publish_approval' | 'destructive_op';
export type ApprovalDecision = 'pending' | 'approved' | 'rejected';
export type ConfigurationScope = 'global' | 'project';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: ProfileRole;
          name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role?: ProfileRole;
          name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          role?: ProfileRole;
          name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          repository_url: string | null;
          status: ProjectStatus;
          owner_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          repository_url?: string | null;
          status?: ProjectStatus;
          owner_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          repository_url?: string | null;
          status?: ProjectStatus;
          owner_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      agents: {
        Row: {
          id: string;
          code: AgentCode;
          name: string;
          description: string | null;
          type: AgentType;
          enabled: boolean;
          config: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: AgentCode;
          name: string;
          description?: string | null;
          type?: AgentType;
          enabled?: boolean;
          config?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: AgentCode;
          name?: string;
          description?: string | null;
          type?: AgentType;
          enabled?: boolean;
          config?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          state: TaskState;
          priority: number;
          current_version_id: string | null;
          assigned_agent_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          state?: TaskState;
          priority?: number;
          current_version_id?: string | null;
          assigned_agent_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          title?: string;
          state?: TaskState;
          priority?: number;
          current_version_id?: string | null;
          assigned_agent_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      task_versions: {
        Row: {
          id: string;
          task_id: string;
          version_number: number;
          spec: Json;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          version_number: number;
          spec?: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          version_number?: number;
          spec?: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      task_dependencies: {
        Row: {
          id: string;
          task_id: string;
          depends_on_task_id: string;
          dependency_type: TaskDependencyType;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          depends_on_task_id: string;
          dependency_type?: TaskDependencyType;
          created_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          depends_on_task_id?: string;
          dependency_type?: TaskDependencyType;
          created_at?: string;
        };
        Relationships: [];
      };
      task_state_transitions: {
        Row: {
          id: string;
          task_id: string;
          from_state: string | null;
          to_state: string;
          actor_type: ActorType;
          actor_profile_id: string | null;
          actor_agent_id: string | null;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          from_state?: string | null;
          to_state: string;
          actor_type: ActorType;
          actor_profile_id?: string | null;
          actor_agent_id?: string | null;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          from_state?: string | null;
          to_state?: string;
          actor_type?: ActorType;
          actor_profile_id?: string | null;
          actor_agent_id?: string | null;
          reason?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      executions: {
        Row: {
          id: string;
          task_id: string;
          task_version_id: string;
          agent_id: string;
          status: ExecutionStatus;
          branch_name: string | null;
          commit_sha: string | null;
          input: Json;
          output: Json | null;
          error: string | null;
          started_at: string | null;
          finished_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          task_version_id: string;
          agent_id: string;
          status?: ExecutionStatus;
          branch_name?: string | null;
          commit_sha?: string | null;
          input?: Json;
          output?: Json | null;
          error?: string | null;
          started_at?: string | null;
          finished_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          task_version_id?: string;
          agent_id?: string;
          status?: ExecutionStatus;
          branch_name?: string | null;
          commit_sha?: string | null;
          input?: Json;
          output?: Json | null;
          error?: string | null;
          started_at?: string | null;
          finished_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      reviews: {
        Row: {
          id: string;
          execution_id: string;
          task_id: string;
          review_type: ReviewType;
          reviewer_agent_id: string | null;
          reviewer_profile_id: string | null;
          result: ReviewResult;
          comments: string | null;
          checklist: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          execution_id: string;
          task_id: string;
          review_type: ReviewType;
          reviewer_agent_id?: string | null;
          reviewer_profile_id?: string | null;
          result: ReviewResult;
          comments?: string | null;
          checklist?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          execution_id?: string;
          task_id?: string;
          review_type?: ReviewType;
          reviewer_agent_id?: string | null;
          reviewer_profile_id?: string | null;
          result?: ReviewResult;
          comments?: string | null;
          checklist?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      approvals: {
        Row: {
          id: string;
          task_id: string;
          approval_type: ApprovalType;
          requested_by: string | null;
          approved_by: string | null;
          decision: ApprovalDecision;
          decision_reason: string | null;
          requested_at: string;
          decided_at: string | null;
        };
        Insert: {
          id?: string;
          task_id: string;
          approval_type: ApprovalType;
          requested_by?: string | null;
          approved_by?: string | null;
          decision?: ApprovalDecision;
          decision_reason?: string | null;
          requested_at?: string;
          decided_at?: string | null;
        };
        Update: {
          id?: string;
          task_id?: string;
          approval_type?: ApprovalType;
          requested_by?: string | null;
          approved_by?: string | null;
          decision?: ApprovalDecision;
          decision_reason?: string | null;
          requested_at?: string;
          decided_at?: string | null;
        };
        Relationships: [];
      };
      logs: {
        Row: {
          id: string;
          entity_type: string;
          entity_id: string;
          event_type: string;
          actor_type: ActorType;
          actor_id: string | null;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          entity_type: string;
          entity_id: string;
          event_type: string;
          actor_type: ActorType;
          actor_id?: string | null;
          payload?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          entity_type?: string;
          entity_id?: string;
          event_type?: string;
          actor_type?: ActorType;
          actor_id?: string | null;
          payload?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      configurations: {
        Row: {
          id: string;
          scope: ConfigurationScope;
          project_id: string | null;
          key: string;
          value: Json;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          scope?: ConfigurationScope;
          project_id?: string | null;
          key: string;
          value?: Json;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          scope?: ConfigurationScope;
          project_id?: string | null;
          key?: string;
          value?: Json;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type TypedSupabaseClient = SupabaseClient<Database>;
