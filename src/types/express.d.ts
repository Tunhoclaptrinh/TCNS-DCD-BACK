declare global {
  namespace Express {
    interface Request {
      user?: Record<string, any>;
      parsedQuery?: {
        filter: Record<string, any> | null;
        page: number;
        limit: number;
        sort?: string;
        order: 'asc' | 'desc';
        q?: any;
        embed?: any;
        expand?: any;
        [key: string]: any;
      };
      file?: any;
      files?: any;
    }
  }
}

export {};
