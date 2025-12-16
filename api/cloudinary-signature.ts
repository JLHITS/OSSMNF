/**
 * Vercel Serverless Function to generate Cloudinary upload signatures
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
  const CLOUDINARY_UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET || 'player_avatars';

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    console.error('Missing Cloudinary credentials');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const { playerId } = req.body;

    if (!playerId) {
      return res.status(400).json({ error: 'Player ID is required' });
    }

    // Generate timestamp
    const timestamp = Math.round(Date.now() / 1000);

    // Create public_id using player ID (keep folder stable for signatures)
    const publicId = `player_avatars/player-${playerId}`;

    // Create signature string (parameters must be in alphabetical order)
    const paramsToSign = `public_id=${publicId}&timestamp=${timestamp}&upload_preset=${CLOUDINARY_UPLOAD_PRESET}${CLOUDINARY_API_SECRET}`;

    // Generate SHA256 signature
    const signature = createHash('sha256').update(paramsToSign).digest('hex');

    return res.status(200).json({
      signature,
      timestamp,
      publicId,
      cloudName: CLOUDINARY_CLOUD_NAME,
      apiKey: CLOUDINARY_API_KEY,
      uploadPreset: CLOUDINARY_UPLOAD_PRESET,
    });
  } catch (error) {
    console.error('Signature generation error:', error);
    return res.status(500).json({ error: 'Failed to generate signature', details: String(error) });
  }
}
