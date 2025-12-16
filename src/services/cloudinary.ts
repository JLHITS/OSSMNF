/**
 * Cloudinary service for uploading and managing player photos
 */

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;

/**
 * Upload an image to Cloudinary via our API signature endpoint
 * @param file - The image file to upload
 * @param playerId - The player ID (used in the public_id)
 * @returns The public_id from Cloudinary
 */
export async function uploadImageToCloudinary(
  file: File,
  playerId: string
): Promise<string> {
  // Get upload signature from our serverless function
  const signatureResponse = await fetch('/api/cloudinary-signature', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ playerId }),
  });

  if (!signatureResponse.ok) {
    const error = await signatureResponse.json();
    console.error('Signature generation error:', error);
    throw new Error(`Failed to get upload signature: ${error.error || 'Unknown error'}`);
  }

  const { signature, timestamp, publicId, cloudName, apiKey, uploadPreset } = await signatureResponse.json();

  // Upload to Cloudinary with signature
  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', apiKey);
  formData.append('timestamp', timestamp.toString());
  formData.append('signature', signature);
  formData.append('public_id', publicId);
  formData.append('upload_preset', uploadPreset || 'player_avatars');

  const uploadResponse = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!uploadResponse.ok) {
    const error = await uploadResponse.json();
    console.error('Cloudinary upload error:', error);
    throw new Error(`Failed to upload image: ${error.error?.message || 'Unknown error'}`);
  }

  const data = await uploadResponse.json();
  return data.public_id;
}

/**
 * Delete an image from Cloudinary
 * @param publicId - The public_id of the image to delete
 */
export async function deleteImageFromCloudinary(publicId: string): Promise<void> {
  if (!publicId) return;

  try {
    const response = await fetch('/api/cloudinary-delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ publicId }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Cloudinary delete error:', error);
      throw new Error(`Failed to delete image: ${error.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
    throw error;
  }
}

/**
 * Get the URL for a Cloudinary image with transformations
 * @param publicId - The public_id of the image
 * @param transformations - Optional transformation string (e.g., 'c_fill,w_200,h_200,g_face')
 * @returns The full Cloudinary URL
 */
export function getCloudinaryImageUrl(
  publicId: string,
  transformations = 'c_fill,w_200,h_200,g_face,q_auto,f_auto'
): string {
  if (!publicId) return '';
  if (!CLOUDINARY_CLOUD_NAME) {
    console.warn('Cloudinary cloud name not configured');
    return '';
  }

  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${transformations}/${publicId}`;
}
