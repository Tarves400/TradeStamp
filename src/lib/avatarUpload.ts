/**
 * avatarUpload.ts
 *
 * Cross-platform avatar upload to Supabase Storage.
 * Works on iOS, Android, and Web via expo/fetch + ArrayBuffer.
 */

import { fetch } from 'expo/fetch';
import { supabase } from '@/client/supabase';

/**
 * Upload an avatar image to Supabase Storage.
 *
 * @param uri        Image URI from expo-image-picker (file:// on native, blob: on web)
 * @param userId     Supabase auth user ID
 * @returns          Public URL of the uploaded avatar
 */
export async function uploadAvatar(uri: string, userId: string): Promise<string> {
  // Fetch image bytes cross-platform
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const contentType = response.headers.get('content-type') || 'image/jpeg';

  // Determine file extension
  const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
  const filePath = `${userId}/avatar.${ext}`;

  // Delete any existing avatar for this user (clean up old files)
  const { data: existing } = await supabase.storage
    .from('avatars')
    .list(userId);

  if (existing && existing.length > 0) {
    const pathsToRemove = existing.map((f) => `${userId}/${f.name}`);
    await supabase.storage.from('avatars').remove(pathsToRemove);
  }

  // Upload new avatar
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, arrayBuffer, {
      contentType,
      cacheControl: '3600',
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath);

  if (!urlData?.publicUrl) {
    throw new Error('Failed to get public URL');
  }

  return urlData.publicUrl;
}

/**
 * Delete the current user's avatar from Supabase Storage.
 */
export async function deleteAvatar(userId: string): Promise<void> {
  const { data: existing } = await supabase.storage
    .from('avatars')
    .list(userId);

  if (existing && existing.length > 0) {
    const pathsToRemove = existing.map((f) => `${userId}/${f.name}`);
    await supabase.storage.from('avatars').remove(pathsToRemove);
  }
}
