/**
 * Vercel Serverless Function to upload images to Cloudflare Images
 * This proxies the upload to avoid CORS issues and keep the API token secure
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Readable } from 'stream';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const CLOUDFLARE_ACCOUNT_ID = process.env.VITE_CLOUDFLARE_ACCOUNT_ID;
  const CLOUDFLARE_API_TOKEN = process.env.VITE_CLOUDFLARE_API_TOKEN;

  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
    console.error('Missing Cloudflare credentials');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    // Get the content-type header from the incoming request
    const contentType = req.headers['content-type'] || '';

    // Convert the request to a readable stream
    const stream = req as unknown as Readable;

    // Forward the multipart form data to Cloudflare
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/images/v1`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': contentType,
        },
        // @ts-ignore - Pass the request stream as body
        body: stream,
        duplex: 'half',
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Cloudflare upload error:', data);
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Upload proxy error:', error);
    return res.status(500).json({ error: 'Upload failed', details: String(error) });
  }
}
