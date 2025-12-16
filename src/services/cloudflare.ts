/**
 * Cloudflare Images service for uploading and managing player photos
 */

const CLOUDFLARE_ACCOUNT_ID = import.meta.env.VITE_CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = import.meta.env.VITE_CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_ACCOUNT_HASH = import.meta.env.VITE_CLOUDFLARE_ACCOUNT_HASH;

/**
 * Upload an image to Cloudflare Images
 * @param file - The image file to upload
 * @param playerId - The player ID (used as metadata)
 * @returns The image ID from Cloudflare
 */
export async function uploadImageToCloudflare(
  file: File,
  playerId: string
): Promise<string> {
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
    throw new Error('Cloudflare credentials not configured');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('metadata', JSON.stringify({ playerId }));

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/images/v1`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response.json();
    console.error('Cloudflare upload error:', error);
    throw new Error(`Failed to upload image: ${error.errors?.[0]?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  return data.result.id;
}

/**
 * Delete an image from Cloudflare Images
 * @param imageId - The Cloudflare image ID
 */
export async function deleteImageFromCloudflare(imageId: string): Promise<void> {
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
    throw new Error('Cloudflare credentials not configured');
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/images/v1/${imageId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    console.error('Cloudflare delete error:', error);
    throw new Error(`Failed to delete image: ${error.errors?.[0]?.message || 'Unknown error'}`);
  }
}

/**
 * Get the full Cloudflare delivery URL for an image
 * @param imageId - The Cloudflare image ID
 * @param variant - The variant name (default: 'public')
 * @returns The full delivery URL
 */
export function getCloudflareImageUrl(imageId: string, variant = 'public'): string {
  if (!imageId) return '';
  if (!CLOUDFLARE_ACCOUNT_HASH) {
    console.warn('Cloudflare account hash not configured');
    return '';
  }
  return `https://imagedelivery.net/${CLOUDFLARE_ACCOUNT_HASH}/${imageId}/${variant}`;
}

/**
 * Extract image ID from a Cloudflare delivery URL
 * @param url - The full Cloudflare delivery URL
 * @returns The image ID or null if not a valid Cloudflare URL
 */
export function extractImageIdFromUrl(url: string): string | null {
  if (!url) return null;
  const match = url.match(/imagedelivery\.net\/[^/]+\/([^/]+)\//);
  return match ? match[1] : null;
}
