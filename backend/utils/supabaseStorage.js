// backend/utils/supabaseStorage.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

console.log('[SupabaseStorage] Loading...');
console.log('[SupabaseStorage] SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : 'NOT SET');
console.log('[SupabaseStorage] SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'SET' : 'NOT SET');
console.log('[SupabaseStorage] SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET');

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Use service role key for storage operations (bypasses RLS)
const storageKey = serviceRoleKey || supabaseKey;

if (!supabaseUrl || !storageKey) {
  console.warn('⚠️ Supabase not configured - uploads will use local storage');
}

const supabase = supabaseUrl && storageKey ? createClient(supabaseUrl, storageKey) : null;

if (supabase) {
  console.log('✅ Supabase client initialized');
} else {
  console.warn('❌ Supabase client not initialized - will use local storage fallback');
}

const BUCKET_NAME = 'uploads';

// Map folder names to bucket names
const BUCKET_MAP = {
  posts: 'posts',
  profiles: 'profile-photos',
  covers: 'covers',
  stories: 'stories',
  chats: 'chats',
  communities: 'communities',
  album: 'album',
  general: 'uploads'
};

function getBucketForFolder(folder) {
  return BUCKET_MAP[folder] || BUCKET_MAP.general;
}

async function ensureBucketExists(bucketName) {
  if (!supabase) return false;
  
  try {
    console.log(`[SupabaseStorage] Checking bucket: ${bucketName}`);
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) {
      console.error('[SupabaseStorage] Error listing buckets:', error);
      throw error;
    }
    
    console.log('[SupabaseStorage] Existing buckets:', buckets?.map(b => b.name) || 'none');
    
    const bucketExists = buckets?.some(b => b.name === bucketName);
    if (!bucketExists) {
      console.log(`[SupabaseStorage] Creating bucket: ${bucketName}`);
      
      const { error: createError } = await supabase.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: '50MB',
        allowedMimeTypes: ['image/*', 'video/*']
      });
      
      if (createError) {
        console.error(`[SupabaseStorage] Error creating bucket ${bucketName}:`, createError.message);
        console.log('[SupabaseStorage] Will attempt upload anyway - bucket may need manual creation');
        return true;
      }
      console.log(`[SupabaseStorage] Bucket ${bucketName} created successfully`);
    } else {
      console.log(`[SupabaseStorage] Bucket ${bucketName} already exists`);
    }
    return true;
  } catch (error) {
    console.error(`[SupabaseStorage] ensureBucketExists error for ${bucketName}:`, error.message);
    return true;
  }
}

async function uploadFile(buffer, fileName, mimeType, folder = 'general') {
  if (!supabase) {
    throw new Error('Supabase not configured - check SUPABASE_URL and SUPABASE_ANON_KEY in .env');
  }

  const bucketName = getBucketForFolder(folder);
  
  try {
    const bucketReady = await ensureBucketExists(bucketName);
    if (!bucketReady) {
      throw new Error(`Storage bucket ${bucketName} not available`);
    }

    const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    // Keep the original extension from filename if it exists
    const filePath = `${Date.now()}-${safeFileName}`;
    
    // Determine content type - default to image/jpeg if not specified
    let contentType = 'application/octet-stream';
    const mimeTypeLower = mimeType.toLowerCase();
    
    if (mimeTypeLower.startsWith('image/')) {
      contentType = mimeType;
    } else if (mimeTypeLower === 'jpeg' || mimeTypeLower === 'jpg') {
      contentType = 'image/jpeg';
    } else if (mimeTypeLower === 'png') {
      contentType = 'image/png';
    } else if (mimeTypeLower === 'gif') {
      contentType = 'image/gif';
    } else if (mimeTypeLower === 'webp') {
      contentType = 'image/webp';
    } else {
      // Default to jpeg for unknown types
      contentType = 'image/jpeg';
    }
    
    console.log(`[SupabaseStorage] Uploading to ${bucketName}: ${filePath} (${contentType}, ${buffer.length} bytes)`);
    
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, buffer, {
        contentType: contentType,
        upsert: false
      });

    if (error) {
      console.error('[SupabaseStorage] Upload error:', error);
      throw new Error(`Supabase upload failed: ${error.message}`);
    }

    console.log('[SupabaseStorage] Upload successful:', data.path);

    // Build public URL manually since getPublicUrl might not work correctly
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${filePath}`;
    console.log('[SupabaseStorage] Public URL:', publicUrl);
    return publicUrl;
  } catch (error) {
    console.error('[SupabaseStorage] Full error:', error);
    throw error;
  }
}

async function deleteFile(filePath) {
  if (!supabase) return false;

  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
}

module.exports = {
  supabase,
  uploadFile,
  deleteFile,
  ensureBucketExists
};