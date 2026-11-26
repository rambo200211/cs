import dayjs from 'dayjs';

export const entryDateTimeFormat = 'YYYY-MM-DDTHH:mm';
export const formatEntryDate = (date: string) =>
  dayjs(date).format(date.length > 10 ? 'D MMM YYYY, h:mm A' : 'D MMM YYYY');

export const categories = {
  income: ['Salary', 'Freelance', 'Gift', 'Other'],
  expense: ['Food', 'Transport', 'Shopping', 'Bills', 'Other']
};
export type Kind = keyof typeof categories;
export type EntryType = Kind | 'transfer';
export type PaymentType = 'pocket' | 'account';
export type LoanDirection = 'borrowed' | 'lent';
export type LoanMethod = 'cash' | 'credit';
export const paymentLabels: Record<PaymentType, string> = { pocket: 'Pocket money', account: 'Account' };
type EntryDetails = {
  id: number;
  amount: number;
  category: string;
  date: string;
  note: string;
  payment_type: PaymentType;
};
export type Entry =
  | (EntryDetails & { type: Kind; to_payment_type?: never })
  | (EntryDetails & { type: 'transfer'; to_payment_type: PaymentType });
export type LoanRepayment = { id: number; amount: number; date: string; note: string };
export type Loan = {
  id: number;
  direction: LoanDirection;
  method: LoanMethod;
  category: string | null;
  person: string;
  amount: number;
  payment_type: PaymentType;
  date: string;
  note: string;
  repaid_amount: number;
  outstanding: number;
  repayments: LoanRepayment[];
};
export type Month = {
  month_key: string;
  opening_balance: number;
  total_income: number;
  total_expense: number;
  credit_expense: number;
  loan_net: number;
  closing_balance: number;
};
export type Ledger = { month: Month; history: Month[]; recent: Entry[]; balances: Record<PaymentType, number> };
export type Routes = { Main: undefined; Add: { entry: Entry } | undefined; Transaction: { entry: Entry } };
export const money = (value: number) =>
  `Rs. ${new Intl.NumberFormat('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;
