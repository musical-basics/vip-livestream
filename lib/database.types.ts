export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  vip_livestream: {
    Tables: {
      members: {
        Row: {
          id: string
          name: string
          email: string
          password_token: string
          access_badges: string[]
          display_name: string | null
          is_moderator: boolean
          is_banned: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          password_token: string
          access_badges?: string[]
          display_name?: string | null
          is_moderator?: boolean
          is_banned?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          password_token?: string
          access_badges?: string[]
          display_name?: string | null
          is_moderator?: boolean
          is_banned?: boolean
          created_at?: string
        }
      }
      streams: {
        Row: {
          id: string
          title: string
          youtube_video_id: string
          stream_start_utc: string | null
          is_live: boolean
          setlist: Json | null
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          youtube_video_id: string
          stream_start_utc?: string | null
          is_live?: boolean
          setlist?: Json | null
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          youtube_video_id?: string
          stream_start_utc?: string | null
          is_live?: boolean
          setlist?: Json | null
          description?: string | null
          created_at?: string
        }
      }
      chat_messages: {
        Row: {
          id: string
          stream_id: string
          member_id: string
          display_name: string
          content: string | null
          emoji: string | null
          is_muted: boolean
          created_at: string
          reactions: Record<string, string[]> | null
        }
        Insert: {
          id?: string
          stream_id: string
          member_id: string
          display_name: string
          content?: string | null
          emoji?: string | null
          is_muted?: boolean
          created_at?: string
          reactions?: Record<string, string[]> | null
        }
        Update: {
          id?: string
          stream_id?: string
          member_id?: string
          display_name?: string
          content?: string | null
          emoji?: string | null
          is_muted?: boolean
          created_at?: string
          reactions?: Record<string, string[]> | null
        }
      }
      member_timeouts: {
        Row: {
          id: string
          member_id: string
          stream_id: string
          muted_by: string
          timeout_until: string | null
          created_at: string
        }
        Insert: {
          id?: string
          member_id: string
          stream_id: string
          muted_by: string
          timeout_until?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          member_id?: string
          stream_id?: string
          muted_by?: string
          timeout_until?: string | null
          created_at?: string
        }
      }
      comments: {
        Row: {
          id: string
          stream_id: string
          member_id: string
          display_name: string
          content: string
          is_approved: boolean
          created_at: string
        }
        Insert: {
          id?: string
          stream_id: string
          member_id: string
          display_name: string
          content: string
          is_approved?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          stream_id?: string
          member_id?: string
          display_name?: string
          content?: string
          is_approved?: boolean
          created_at?: string
        }
      }
      tips: {
        Row: {
          id: string
          stream_id: string
          member_id: string
          amount_cents: number
          stripe_session_id: string | null
          message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          stream_id: string
          member_id: string
          amount_cents: number
          stripe_session_id?: string | null
          message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          stream_id?: string
          member_id?: string
          amount_cents?: number
          stripe_session_id?: string | null
          message?: string | null
          created_at?: string
        }
      }
      setlists: {
        Row: {
          id: string
          slug: string
          data: Json
          updated_at: string
          created_at: string
        }
        Insert: {
          id?: string
          slug: string
          data: Json
          updated_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          slug?: string
          data?: Json
          updated_at?: string
          created_at?: string
        }
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
    CompositeTypes: {}
  }
}

export type Member = Database['vip_livestream']['Tables']['members']['Row']
export type Stream = Database['vip_livestream']['Tables']['streams']['Row']
export type ChatMessage = Database['vip_livestream']['Tables']['chat_messages']['Row']
export type MemberTimeout = Database['vip_livestream']['Tables']['member_timeouts']['Row']
export type Comment = Database['vip_livestream']['Tables']['comments']['Row']
export type Tip = Database['vip_livestream']['Tables']['tips']['Row']
export type SetlistRecord = Database['vip_livestream']['Tables']['setlists']['Row']

/**
 * Arrangement category for a setlist piece, surfaced as a badge on the
 * programme. Mirrors the Belgium concert planning sheet: solo piano, an EDM
 * arrangement (solo piano with electronic backing track), the piano trio
 * (violin + cello), or the violin + piano duet.
 */
export type SetlistCategory = 'solo' | 'edm' | 'trio' | 'duet'

export interface SetlistItem {
  id: string
  piece: string
  composer: string
  composerYears?: string
  performer: string
  duration?: string
  notes?: string
  category?: SetlistCategory
}
