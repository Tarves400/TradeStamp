import { supabase } from '@/client/supabase';

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'model';
  text: string;
  image_mime_type?: string;
  image_base64?: string;
  created_at: string;
}

/** Create a new chat session */
export async function createChatSession(title: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('ai_chat_sessions')
    .insert({ title })
    .select('id')
    .single();

  if (error) {
    console.error('[ChatAPI] create session error:', error);
    return null;
  }
  return data?.id ?? null;
}

/** Save a message to a session */
export async function saveChatMessage(
  sessionId: string,
  role: 'user' | 'model',
  text: string,
  imageMimeType?: string,
  imageBase64?: string
): Promise<boolean> {
  const { error } = await supabase.from('ai_chat_messages').insert({
    session_id: sessionId,
    role,
    text,
    image_mime_type: imageMimeType || null,
    image_base64: imageBase64 || null,
  });

  if (error) {
    console.error('[ChatAPI] save message error:', error);
    return false;
  }

  // Update session updated_at
  await supabase
    .from('ai_chat_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', sessionId);

  return true;
}

/** Get all chat sessions ordered by updated_at desc */
export async function getChatSessions(): Promise<ChatSession[]> {
  const { data, error } = await supabase
    .from('ai_chat_sessions')
    .select('id, title, created_at, updated_at')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[ChatAPI] get sessions error:', error);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

/** Get messages for a session */
export async function getChatMessages(sessionId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('ai_chat_messages')
    .select('id, session_id, role, text, image_mime_type, image_base64, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[ChatAPI] get messages error:', error);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

/** Delete a session and its messages (cascade) */
export async function deleteChatSession(sessionId: string): Promise<boolean> {
  const { error } = await supabase
    .from('ai_chat_sessions')
    .delete()
    .eq('id', sessionId);

  if (error) {
    console.error('[ChatAPI] delete session error:', error);
    return false;
  }
  return true;
}
