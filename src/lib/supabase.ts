import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured =
  Boolean(supabaseUrl && supabaseAnonKey) &&
  !supabaseUrl?.includes('your-project') &&
  !supabaseAnonKey?.includes('your-anon-key');

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

export async function sendMagicLink(email: string) {
  if (!supabase) {
    return { error: { message: 'Supabase is not configured. Add project URL and anon key in .env.' } };
  }

  return supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin,
    },
  });
}

export async function uploadDocument(file: File, folderPath: string) {
  if (!supabase) {
    return { path: '', error: { message: 'Supabase storage is not configured.' } };
  }

  const cleanName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '-');
  const fullPath = `${folderPath}/${Date.now()}-${cleanName}`;
  const { error } = await supabase.storage.from('mrf-documents').upload(fullPath, file, {
    upsert: true,
  });

  if (error) return { path: '', error };

  const { data } = supabase.storage.from('mrf-documents').getPublicUrl(fullPath);
  return { path: data.publicUrl, error: null };
}
