import { Document, Schema } from 'mongoose';
import { IProductsData, productsDataSchema } from './jobs';
import { field, schemaHooksWrapper } from './utils';

export interface IWork {
  name: string;
  status: string;
  dueDate: Date;
  startAt: Date;
  endAt: Date;
  jobId: string;
  flowId: string;
  productId: string;
  count: string;
  branchId: string;
  departmentId: string;
  needProducts: IProductsData;
  resultProducts: IProductsData;
}

export interface IWorkDocument extends IWork, Document {
  _id: string;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
}

export const workSchema = schemaHooksWrapper(
  new Schema({
    _id: field({ pkey: true }),
    name: field({ type: String, label: 'Name' }),
    status: field({ type: String, label: 'Status' }),
    jobId: field({ type: String, label: 'jobId' }),
    flowId: field({ type: String, label: 'flowId' }),
    productId: field({ type: String, label: 'productId' }),
    count: field({ type: String, label: 'count' }),
    branchId: field({ type: String, label: 'branchId' }),
    departmentId: field({ type: String, label: 'departmentId' }),
    needProducts: field({ type: productsDataSchema, label: 'Need products' }),
    resultProducts: field({
      type: productsDataSchema,
      label: 'Result products'
    }),
    createdAt: field({
      type: Date,
      default: new Date(),
      label: 'Created date'
    }),
    dueDate: field({ type: Date, label: 'Due Date' }),
    startAt: field({ type: Date, optional: true, label: 'Start at' }),
    endAt: field({ type: Date, optional: true, label: 'End at' })
  }),
  'erxes_works'
);

// for workSchema query. increases search speed, avoids in-memory sorting
workSchema.index({ status: 1 });