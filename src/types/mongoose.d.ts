import mongoose from 'mongoose';

// Extend the global mongoose types to fix model method signatures
declare module 'mongoose' {
  interface Model<T> {
    findOne(filter?: any, projection?: any, options?: any): Promise<T | null>;
    findById(id: any, projection?: any, options?: any): Promise<T | null>;
    find(filter?: any, projection?: any, options?: any): Promise<T[]>;
    create(doc: any): Promise<T>;
    updateOne(filter?: any, update?: any, options?: any): Promise<any>;
    updateMany(filter?: any, update?: any, options?: any): Promise<any>;
    deleteOne(filter?: any, options?: any): Promise<any>;
    deleteMany(filter?: any, options?: any): Promise<any>;
    countDocuments(filter?: any, options?: any): Promise<number>;
  }
}

export {};
