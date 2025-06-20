declare module 'compression' {
  import { RequestHandler } from 'express';
  
  interface CompressionOptions {
    filter?: (req: any, res: any) => boolean;
    level?: number;
    threshold?: number;
    windowBits?: number;
    memLevel?: number;
    strategy?: number;
    chunkSize?: number;
  }
  
  function compression(options?: CompressionOptions): RequestHandler;
  export = compression;
} 