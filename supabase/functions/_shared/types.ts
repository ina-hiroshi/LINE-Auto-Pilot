/**
 * 共通型定義ファイル
 * Edge Functions で使用する型を集約
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// Supabase Client 型（any を避けるため）
export type SupabaseClientType = SupabaseClient

// Google Calendar Event 型
export type GoogleCalendarEvent = {
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
  summary?: string
  description?: string
  location?: string
  id?: string
  status?: string
}

// Google Calendar API Response 型
export type GoogleCalendarListResponse = {
  items?: GoogleCalendarEvent[]
  nextSyncToken?: string
  nextPageToken?: string
}

// AI Settings 型
export type AISettings = {
  is_enabled?: boolean
  gemini_api_key?: string
  personality?: string
  knowledge_source?: string
  fallback_message?: string
  system_prompt?: string
  tone?: string
  persona_prompt?: string
}

// Knowledge Base Document 型
export type KnowledgeDocument = {
  id?: string
  extracted_text?: string
  file_name?: string
  file_type?: string
  is_active?: boolean
}

// LINE Profile 型
export type LineProfile = {
  userId: string
  displayName: string
  pictureUrl?: string
  statusMessage?: string
}

// Store Settings 型
export type StoreSettings = {
  slot_interval_minutes?: number
  capacity_per_slot?: number
  business_hours?: unknown
}
