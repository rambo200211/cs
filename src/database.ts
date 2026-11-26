import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import { getRandomBytesAsync } from 'expo-crypto';
import dayjs from 'dayjs';
import { categories, entryDateTimeFormat, Entry, Kind, Ledger, Loan, LoanDirection, LoanMethod, LoanRepayment, Month, PaymentType } from './model';

let connection: SQLite.SQLiteDatabase | undefined;
let pending = Promise.resolve();
function serialized<T>(work: () => Promise<T>): Promise<T> {
  const task = pending.then(work);
  pending = task.then(() => {}, () => {});
  return task;
}

async function database() {
  if (connection) return connection;
  const db = await SQLite.openDatabaseAsync('ledger.db');
  try {
    const cipher = await db.getFirstAsync<{cipher_version: string}>('PRAGMA cipher_version');
    if (cipher?.cipher_version) {
      const keyName = 'pocket-ledger-key-v1';
      let key = await SecureStore.getItemAsync(keyName);
      if (!key) {
        const bytes = await getRandomBytesAsync(32);
        key = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
        await SecureStore.setItemAsync(keyName, key, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
      }
      if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('Invalid storage key');
      await db.execAsync(`PRAGMA key = "x'${key}'"`);
    }
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT, amount REAL NOT NULL CHECK(amount > 0),
          type TEXT NOT NULL CHECK(type IN ('income','expense')), category TEXT NOT NULL,
          date TEXT NOT NULL, note TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX IF NOT EXISTS entries_by_date ON transactions(date, id);
        CREATE TABLE IF NOT EXISTS transfers (
          id INTEGER PRIMARY KEY AUTOINCREMENT, amount REAL NOT NULL CHECK(amount > 0),
          from_payment_type TEXT NOT NULL CHECK(from_payment_type IN ('pocket','account')),
          to_payment_type TEXT NOT NULL CHECK(to_payment_type IN ('pocket','account')),
          date TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
          CHECK(from_payment_type != to_payment_type)
        );
        CREATE INDEX IF NOT EXISTS transfers_by_date ON transfers(date, id);
        CREATE TABLE IF NOT EXISTS loans (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          direction TEXT NOT NULL CHECK(direction IN ('borrowed','lent')),
          method TEXT NOT NULL DEFAULT 'cash' CHECK(method IN ('cash','credit')),
          category TEXT,
          person TEXT NOT NULL, amount REAL NOT NULL CHECK(amount > 0),
          payment_type TEXT NOT NULL CHECK(payment_type IN ('pocket','account')),
          date TEXT NOT NULL, note TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX IF NOT EXISTS loans_by_date ON loans(date, id);
        CREATE TABLE IF NOT EXISTS loan_repayments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          loan_id INTEGER NOT NULL REFERENCES loans(id),
          amount REAL NOT NULL CHECK(amount > 0), date TEXT NOT NULL,
          note TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX IF NOT EXISTS repayments_by_loan ON loan_repayments(loan_id, date, id);
        CREATE TABLE IF NOT EXISTS monthly_summary (
          month_key TEXT PRIMARY KEY, total_income REAL NOT NULL, total_expense REAL NOT NULL,
          opening_balance REAL NOT NULL, credit_expense REAL NOT NULL DEFAULT 0,
          loan_net REAL NOT NULL DEFAULT 0, closing_balance REAL NOT NULL
        );`);
      const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(transactions)');
      if (!columns.some(column => column.name === 'payment_type')) {
        await db.execAsync(`ALTER TABLE transactions ADD COLUMN payment_type TEXT NOT NULL
          DEFAULT 'pocket' CHECK(payment_type IN ('pocket','account'))`);
      }
      const summaryColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(monthly_summary)');
      if (!summaryColumns.some(column => column.name === 'loan_net')) {
        await db.execAsync('ALTER TABLE monthly_summary ADD COLUMN loan_net REAL NOT NULL DEFAULT 0');
      }
      if (!summaryColumns.some(column => column.name === 'credit_expense')) {
        await db.execAsync('ALTER TABLE monthly_summary ADD COLUMN credit_expense REAL NOT NULL DEFAULT 0');
      }
      const loanColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(loans)');
      if (!loanColumns.some(column => column.name === 'method')) {
        await db.execAsync("ALTER TABLE loans ADD COLUMN method TEXT NOT NULL DEFAULT 'cash' CHECK(method IN ('cash','credit'))");
      }
      if (!loanColumns.some(column => column.name === 'category')) {
        await db.execAsync('ALTER TABLE loans ADD COLUMN category TEXT');
      }
    });
    connection = db;
    return db;
  } catch (error) {
    await db.closeAsync();
    throw error;
  }
}

async function summarize(db: SQLite.SQLiteDatabase, month: string, opening: number): Promise<Month> {
  const next = dayjs(month + '-01').add(1, 'month').format('YYYY-MM-DD');
  const totals = await db.getFirstAsync<{income: number; expense: number}>(`
    SELECT COALESCE(SUM(CASE WHEN type='income' THEN CAST(ROUND(amount*100) AS INTEGER) END),0) income,
           COALESCE(SUM(CASE WHEN type='expense' THEN CAST(ROUND(amount*100) AS INTEGER) END),0) expense
    FROM transactions WHERE date >= ? AND date < ?`, month + '-01', next);
  const creditTotal = await db.getFirstAsync<{cents: number}>(`
    SELECT COALESCE(SUM(CAST(ROUND(amount * 100) AS INTEGER)), 0) AS cents
    FROM loans WHERE direction = 'borrowed' AND method = 'credit' AND date >= ? AND date < ?`,
    month + '-01', next);
  const loanTotal = await db.getFirstAsync<{cents: number}>(`
    SELECT COALESCE(SUM(cents), 0) AS cents FROM (
      SELECT CASE WHEN direction = 'borrowed' THEN 1 ELSE -1 END *
        CAST(ROUND(amount * 100) AS INTEGER) AS cents
      FROM loans WHERE method = 'cash' AND date >= ? AND date < ?
      UNION ALL
      SELECT CASE WHEN loans.direction = 'borrowed' THEN -1 ELSE 1 END *
        CAST(ROUND(loan_repayments.amount * 100) AS INTEGER) AS cents
      FROM loan_repayments JOIN loans ON loans.id = loan_repayments.loan_id
      WHERE loan_repayments.date >= ? AND loan_repayments.date < ?
    )`, month + '-01', next, month + '-01', next);
  const income = totals!.income;
  const expense = totals!.expense;
  const creditExpense = creditTotal!.cents;
  const loanNet = loanTotal!.cents;
  return {month_key: month, opening_balance: opening, total_income: income/100,
    total_expense: (expense + creditExpense)/100, credit_expense: creditExpense/100, loan_net: loanNet/100,
    closing_balance: (Math.round(opening*100)+income-expense+loanNet)/100};
}

export function readLedger(selectedMonth?: string): Promise<Ledger> {
  return serialized(async () => {
    const db = await database();
    const current = dayjs().startOf('month');
    const key = current.format('YYYY-MM');
    let ledger!: Ledger;
    await db.withTransactionAsync(async () => {
      const last = await db.getFirstAsync<Month>('SELECT * FROM monthly_summary WHERE month_key < ? ORDER BY month_key DESC LIMIT 1', key);
      const first = await db.getFirstAsync<{date: string | null}>(`
        SELECT MIN(date) AS date FROM (
          SELECT date FROM transactions
          UNION ALL SELECT date FROM loans
          UNION ALL SELECT date FROM loan_repayments
        )`);
      const previous = current.subtract(1, 'month');
      let cursor = last ? dayjs(last.month_key+'-01').add(1,'month') : previous;
      if (!last && first?.date && dayjs(first.date).isBefore(previous)) cursor = dayjs(first.date).startOf('month');
      let opening = last?.closing_balance ?? 0;
      while (cursor.isBefore(current)) {
        const m = await summarize(db, cursor.format('YYYY-MM'), opening);
        await db.runAsync('INSERT INTO monthly_summary(month_key,total_income,total_expense,opening_balance,loan_net,closing_balance) VALUES(?,?,?,?,?,?)',
          m.month_key,m.total_income,m.total_expense,m.opening_balance,m.loan_net,m.closing_balance);
        opening = m.closing_balance;
        cursor = cursor.add(1,'month');
      }
      const transactionMonth = selectedMonth || key;
      const start = transactionMonth + '-01';
      const balances = { pocket: 0, account: 0 };
      const paymentTotals = await db.getAllAsync<{ payment_type: PaymentType; cents: number }>(`
        SELECT payment_type, SUM(cents) AS cents FROM (
          SELECT payment_type, CASE WHEN type = 'income' THEN 1 ELSE -1 END *
            CAST(ROUND(amount * 100) AS INTEGER) AS cents
          FROM transactions WHERE date < ?
          UNION ALL
          SELECT from_payment_type AS payment_type, -CAST(ROUND(amount * 100) AS INTEGER) AS cents
          FROM transfers WHERE date < ?
          UNION ALL
          SELECT to_payment_type AS payment_type, CAST(ROUND(amount * 100) AS INTEGER) AS cents
          FROM transfers WHERE date < ?
          UNION ALL
          SELECT payment_type, CASE WHEN direction = 'borrowed' THEN 1 ELSE -1 END *
            CAST(ROUND(amount * 100) AS INTEGER) AS cents
          FROM loans WHERE method = 'cash' AND date < ?
          UNION ALL
          SELECT loans.payment_type, CASE WHEN loans.direction = 'borrowed' THEN -1 ELSE 1 END *
            CAST(ROUND(loan_repayments.amount * 100) AS INTEGER) AS cents
          FROM loan_repayments JOIN loans ON loans.id = loan_repayments.loan_id
          WHERE loan_repayments.date < ?
        ) GROUP BY payment_type`,
        current.add(1, 'month').format('YYYY-MM-DD'),
        current.add(1, 'month').format('YYYY-MM-DD'),
        current.add(1, 'month').format('YYYY-MM-DD'),
        current.add(1, 'month').format('YYYY-MM-DD'),
        current.add(1, 'month').format('YYYY-MM-DD'));
      for (const total of paymentTotals) balances[total.payment_type] = total.cents / 100;
      const monthEnd = dayjs(start).add(1, 'month').format('YYYY-MM-DD');
      const transactions = await db.getAllAsync<Entry>(
        'SELECT * FROM transactions WHERE date >= ? AND date < ? ORDER BY date DESC,id DESC',
        start,monthEnd);
      const transfers = await db.getAllAsync<{
        id: number; amount: number; from_payment_type: PaymentType; to_payment_type: PaymentType;
        date: string; note: string;
      }>('SELECT * FROM transfers WHERE date >= ? AND date < ? ORDER BY date DESC,id DESC', start,monthEnd);
      const recent: Entry[] = transactions.concat(transfers.map(transfer => ({
        id: -transfer.id,
        amount: transfer.amount,
        type: 'transfer' as const,
        category: 'Transfer',
        date: transfer.date,
        note: transfer.note,
        payment_type: transfer.from_payment_type,
        to_payment_type: transfer.to_payment_type
      }))).sort((a, b) => b.date.localeCompare(a.date) || Math.abs(b.id) - Math.abs(a.id));
      ledger = { month: await summarize(db,key,opening), balances,
        history: await db.getAllAsync<Month>('SELECT * FROM monthly_summary WHERE month_key < ? ORDER BY month_key DESC',key),
        recent };
    });
    return ledger;
  });
}

export function addEntry(type: Kind, category: string, input: string, note: string, date = dayjs().format(entryDateTimeFormat), paymentType: PaymentType = 'pocket') {
  return serialized(async () => {
    if (!/^\d{1,10}(\.\d{1,2})?$/.test(input) || Number(input)<=0 || !categories[type].includes(category))
      throw new Error('Invalid transaction');
    const db = await database();
    await db.withTransactionAsync(async () => {
      await db.runAsync('INSERT INTO transactions(amount,type,category,date,note,payment_type) VALUES(?,?,?,?,?,?)',
        Number(input),type,category,date,note.trim(),paymentType);
      await db.runAsync('DELETE FROM monthly_summary WHERE month_key >= ?',date.slice(0,7));
    });
  });
}

function validTransfer(from: PaymentType, to: PaymentType, input: string) {
  return /^\d{1,10}(\.\d{1,2})?$/.test(input) && Number(input) > 0 &&
    (from === 'pocket' || from === 'account') && (to === 'pocket' || to === 'account') && from !== to;
}

async function assertAvailableFunds(
  db: SQLite.SQLiteDatabase,
  from: PaymentType,
  amount: number,
  excludingTransferId?: number
) {
  const cutoff = dayjs().add(1, 'month').startOf('month').format('YYYY-MM-DD');
  const balance = await db.getFirstAsync<{ cents: number }>(`
    SELECT COALESCE(SUM(cents), 0) AS cents FROM (
      SELECT CASE WHEN type = 'income' THEN 1 ELSE -1 END *
        CAST(ROUND(amount * 100) AS INTEGER) AS cents
      FROM transactions WHERE payment_type = ? AND date < ?
      UNION ALL
      SELECT -CAST(ROUND(amount * 100) AS INTEGER) AS cents
      FROM transfers WHERE from_payment_type = ? AND date < ? AND id != COALESCE(?, -1)
      UNION ALL
      SELECT CAST(ROUND(amount * 100) AS INTEGER) AS cents
      FROM transfers WHERE to_payment_type = ? AND date < ? AND id != COALESCE(?, -1)
      UNION ALL
      SELECT CASE WHEN direction = 'borrowed' THEN 1 ELSE -1 END *
        CAST(ROUND(amount * 100) AS INTEGER) AS cents
      FROM loans WHERE method = 'cash' AND payment_type = ? AND date < ?
      UNION ALL
      SELECT CASE WHEN loans.direction = 'borrowed' THEN -1 ELSE 1 END *
        CAST(ROUND(loan_repayments.amount * 100) AS INTEGER) AS cents
      FROM loan_repayments JOIN loans ON loans.id = loan_repayments.loan_id
      WHERE loans.payment_type = ? AND loan_repayments.date < ?
    )`,
    from, cutoff, from, cutoff, excludingTransferId ?? null,
    from, cutoff, excludingTransferId ?? null,
    from, cutoff, from, cutoff);
  if ((balance?.cents ?? 0) < Math.round(amount * 100)) {
    throw new Error(`Insufficient balance in ${from === 'pocket' ? 'Pocket money' : 'Account'}.`);
  }
}

export function addTransfer(input: string, from: PaymentType, to: PaymentType, note: string, date = dayjs().format(entryDateTimeFormat)) {
  return serialized(async () => {
    if (!validTransfer(from, to, input)) throw new Error('Invalid transfer');
    const db = await database();
    await db.withTransactionAsync(async () => {
      await assertAvailableFunds(db, from, Number(input));
      await db.runAsync(
        'INSERT INTO transfers(amount,from_payment_type,to_payment_type,date,note) VALUES(?,?,?,?,?)',
        Number(input),from,to,date,note.trim());
    });
  });
}

function changeEntry(id: number, change: (db: SQLite.SQLiteDatabase) => Promise<unknown>, newDate?: string) {
  return serialized(async () => {
    const db = await database();
    await db.withTransactionAsync(async () => {
      const entry = await db.getFirstAsync<{date: string}>('SELECT date FROM transactions WHERE id = ?',id);
      if (!entry) throw new Error('Transaction no longer exists');
      await change(db);
      const earliestDate = newDate && newDate < entry.date ? newDate : entry.date;
      await db.runAsync('DELETE FROM monthly_summary WHERE month_key >= ?',earliestDate.slice(0,7));
    });
  });
}

export async function updateEntry(id: number, type: Kind, category: string, input: string, note: string, date: string, paymentType: PaymentType) {
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(input) || Number(input)<=0 || !categories[type].includes(category))
    throw new Error('Invalid transaction');
  await changeEntry(id, db => db.runAsync(
    'UPDATE transactions SET amount = ?, type = ?, category = ?, note = ?, date = ?, payment_type = ? WHERE id = ?',
    Number(input),type,category,note.trim(),date,paymentType,id), date);
}

export async function updateTransfer(id: number, input: string, from: PaymentType, to: PaymentType, note: string, date: string) {
  if (!validTransfer(from, to, input)) throw new Error('Invalid transfer');
  await serialized(async () => {
    const db = await database();
    await db.withTransactionAsync(async () => {
      const transfer = await db.getFirstAsync<{date: string}>('SELECT date FROM transfers WHERE id = ?',id);
      if (!transfer) throw new Error('Transfer no longer exists');
      await assertAvailableFunds(db, from, Number(input), id);
      await db.runAsync(
        'UPDATE transfers SET amount = ?, from_payment_type = ?, to_payment_type = ?, note = ?, date = ? WHERE id = ?',
        Number(input),from,to,note.trim(),date,id);
    });
  });
}

export function deleteEntry(id: number) {
  return changeEntry(id, db => db.runAsync('DELETE FROM transactions WHERE id = ?',id));
}

export function deleteTransfer(id: number) {
  return serialized(async () => {
    const db = await database();
    await db.withTransactionAsync(async () => {
      const transfer = await db.getFirstAsync<{id: number}>('SELECT id FROM transfers WHERE id = ?',id);
      if (!transfer) throw new Error('Transfer no longer exists');
      await db.runAsync('DELETE FROM transfers WHERE id = ?',id);
    });
  });
}

export function readLoans(): Promise<Loan[]> {
  return serialized(async () => {
    const db = await database();
    const loans = await db.getAllAsync<{
      id: number; direction: LoanDirection; method: LoanMethod; category: string | null;
      person: string; amount: number;
      payment_type: PaymentType; date: string; note: string;
      repaid_cents: number | null;
    }>(`
      SELECT loans.*,
        COALESCE(SUM(CAST(ROUND(loan_repayments.amount * 100) AS INTEGER)), 0) AS repaid_cents
      FROM loans LEFT JOIN loan_repayments ON loan_repayments.loan_id = loans.id
      GROUP BY loans.id ORDER BY loans.date DESC, loans.id DESC`);
    const repayments = await db.getAllAsync<LoanRepayment & { loan_id: number }>(
      'SELECT id, loan_id, amount, date, note FROM loan_repayments ORDER BY date DESC, id DESC');
    return loans.map(loan => {
      const repaid = (loan.repaid_cents ?? 0) / 100;
      return {
        ...loan,
        repaid_amount: repaid,
        outstanding: Math.max(0, Math.round((loan.amount - repaid) * 100) / 100),
        repayments: repayments.filter(repayment => repayment.loan_id === loan.id)
      };
    });
  });
}

export function addLoan(
  direction: LoanDirection,
  method: LoanMethod,
  person: string,
  input: string,
  paymentType: PaymentType,
  category: string | null,
  note: string,
  date = dayjs().format(entryDateTimeFormat)
) {
  return serialized(async () => {
    const name = person.trim();
    if (!/^\d{1,10}(\.\d{1,2})?$/.test(input) || Number(input) <= 0 ||
      !name || name.length > 100 || !['borrowed', 'lent'].includes(direction) ||
      !['pocket', 'account'].includes(paymentType) ||
      !['cash', 'credit'].includes(method) ||
      (method === 'credit' && (direction !== 'borrowed' || !category || !categories.expense.includes(category))) ||
      (method === 'cash' && category !== null)) throw new Error('Invalid loan');
    const db = await database();
    await db.withTransactionAsync(async () => {
      if (direction === 'lent') await assertAvailableFunds(db, paymentType, Number(input));
      await db.runAsync(
        'INSERT INTO loans(direction,method,category,person,amount,payment_type,date,note) VALUES(?,?,?,?,?,?,?,?)',
        direction, method, category, name, Number(input), paymentType, date, note.trim());
      await db.runAsync('DELETE FROM monthly_summary WHERE month_key >= ?', date.slice(0, 7));
    });
  });
}

export function addLoanRepayment(loanId: number, input: string, note: string, date = dayjs().format(entryDateTimeFormat)) {
  return serialized(async () => {
    if (!/^\d{1,10}(\.\d{1,2})?$/.test(input) || Number(input) <= 0)
      throw new Error('Enter a valid repayment amount.');
    const db = await database();
    await db.withTransactionAsync(async () => {
      const loan = await db.getFirstAsync<{direction: LoanDirection; amount: number; payment_type: PaymentType}>(
        'SELECT direction, amount, payment_type FROM loans WHERE id = ?', loanId);
      if (!loan) throw new Error('Loan no longer exists.');
      const paid = await db.getFirstAsync<{cents: number}>(
        'SELECT COALESCE(SUM(CAST(ROUND(amount * 100) AS INTEGER)), 0) AS cents FROM loan_repayments WHERE loan_id = ?',
        loanId);
      const amountCents = Math.round(Number(input) * 100);
      const outstandingCents = Math.round(loan.amount * 100) - (paid?.cents ?? 0);
      if (amountCents > outstandingCents) throw new Error('Repayment exceeds the outstanding loan balance.');
      if (loan.direction === 'borrowed') await assertAvailableFunds(db, loan.payment_type, Number(input));
      await db.runAsync(
        'INSERT INTO loan_repayments(loan_id,amount,date,note) VALUES(?,?,?,?)',
        loanId, Number(input), date, note.trim());
      await db.runAsync('DELETE FROM monthly_summary WHERE month_key >= ?', date.slice(0, 7));
    });
  });
}
