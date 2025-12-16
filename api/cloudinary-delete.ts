/**
 * Vercel Serverless Function to delete images from Cloudinary
 * This keeps the API secret secure on the server side
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const CLOUDINARY_CLOUD_NAME = process.env.VITE_CLOUDINARY_CLOUD_NAME;
  const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
  const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    console.error('Missing Cloudinary credentials');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const { publicId } = req.body;

    if (!publicId) {
      return res.status(400).json({ error: 'Public ID is required' });
    }

    // Generate timestamp
    const timestamp = Math.round(Date.now() / 1000);

    // Create signature string for deletion
    const paramsToSign = `public_id=${publicId}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
    const signature = createHash('sha256').update(paramsToSign).digest('hex');

    // Call Cloudinary delete API
    const formData = new URLSearchParams();
    formData.append('public_id', publicId);
    formData.append('timestamp', timestamp.toString());
    formData.append('api_key', CLOUDINARY_API_KEY);
    formData.append('signature', signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/destroy`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      }
    );

    const data = await response.json();

    if (!response.ok || data.result !== 'ok') {
      console.error('Cloudinary delete error:', data);
      return res.status(response.status || 500).json({ error: 'Failed to delete image', details: data });
    }

    return res.status(200).json({ success: true, result: data.result });
  } catch (error) {
    console.error('Delete error:', error);
    return res.status(500).json({ error: 'Failed to delete image', details: String(error) });
  }
}
