-- Create storage bucket for AI-generated audio files
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('generated-media', 'generated-media', true, 10485760, array['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3', 'application/octet-stream'])
on conflict (id) do nothing;

-- Allow authenticated users to upload and read
CREATE POLICY "Allow authenticated uploads" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'generated-media');

CREATE POLICY "Allow authenticated reads" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'generated-media');

CREATE POLICY "Allow public reads" ON storage.objects
FOR SELECT TO anon USING (bucket_id = 'generated-media');