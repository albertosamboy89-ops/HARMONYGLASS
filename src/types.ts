import { Timestamp } from 'firebase/firestore';

export interface Advance {
  id: string;
  amount: number;
  voucherUrl?: string;
  createdAt: Timestamp;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  location: string;
  totalAmount: number;
  advanceAmount: number;
  advances?: Advance[];
  progressPercentage: number;
  currentWork: string;
  status?: 'active' | 'finished';
  createdAt: Timestamp;
  ownerId: string;
}

export interface Expense {
  id: string;
  clientId: string;
  store: string;
  detail: string;
  amount: number;
  paymentMethod: 'cash' | 'card';
  createdAt: Timestamp;
}

export interface MiscExpense {
  id: string;
  store: string;
  detail: string;
  amount: number;
  paymentMethod: 'cash' | 'card';
  createdAt: Timestamp;
  ownerId: string;
}

export interface CashAdjustment {
  id: string;
  amount: number;
  reason: string;
  createdAt: Timestamp;
}
