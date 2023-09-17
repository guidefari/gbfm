import { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'node-fetch';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Get the URL of the file to download from the query parameters or request body
  const { fileUrl, title } = req.query;
  console.log('title:', title)

  try {
    // Download the file using the fetch function
    const response = await fetch(fileUrl as string);
    console.log('response:', response.headers.get('Content-Length'))

    // Set the appropriate headers for file downloading
    res.setHeader('Content-Type', 'audio/mp3');
    res.setHeader('Content-Disposition', `attachment; filename=${title}`);
    res.setHeader('Content-Length', response.headers.get('Content-Length'));

    // Return the downloaded file as the response body
    response.body.pipe(res);
  } catch (error) {
    res.status(500).json({ error: 'Failed to download file' });
  }
}