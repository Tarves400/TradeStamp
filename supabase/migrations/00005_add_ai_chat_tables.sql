
-- AI Chat Sessions table
CREATE TABLE IF NOT EXISTS public.ai_chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  title text NOT NULL DEFAULT 'New Chat',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- AI Chat Messages table
CREATE TABLE IF NOT EXISTS public.ai_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.ai_chat_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'model')),
  text text NOT NULL DEFAULT '',
  image_mime_type text,
  image_base64 text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON public.ai_chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON public.ai_chat_messages(session_id);

-- RLS Policies for ai_chat_sessions
ALTER TABLE public.ai_chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chat sessions" 
  ON public.ai_chat_sessions FOR SELECT TO authenticated 
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own chat sessions" 
  ON public.ai_chat_sessions FOR INSERT TO authenticated 
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own chat sessions" 
  ON public.ai_chat_sessions FOR DELETE TO authenticated 
  USING (user_id = auth.uid());

-- RLS Policies for ai_chat_messages
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in own sessions" 
  ON public.ai_chat_messages FOR SELECT TO authenticated 
  USING (EXISTS (
    SELECT 1 FROM public.ai_chat_sessions s 
    WHERE s.id = session_id AND s.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert messages in own sessions" 
  ON public.ai_chat_messages FOR INSERT TO authenticated 
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ai_chat_sessions s 
    WHERE s.id = session_id AND s.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete messages in own sessions" 
  ON public.ai_chat_messages FOR DELETE TO authenticated 
  USING (EXISTS (
    SELECT 1 FROM public.ai_chat_sessions s 
    WHERE s.id = session_id AND s.user_id = auth.uid()
  ));
