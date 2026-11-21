import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    // Prevent directory traversal
    const safeFilename = path.basename(filename);

    const filePath = path.join(process.cwd(), 'public', 'uploads', 'products', safeFilename);
    if (!fs.existsSync(filePath)) {
      return new NextResponse('Image Not Found', { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    const ext = safeFilename.split('.').pop()?.toLowerCase() || 'jpg';
    const contentType = MIME_MAP[ext] || 'application/octet-stream';

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error serving uploaded product image:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
