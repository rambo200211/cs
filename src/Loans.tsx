import { useCallback, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import dayjs from 'dayjs';
import Calendar from './Calendar';
import { addLoan, addLoanRepayment, readLoans } from './database';
import { categories, formatEntryDate, Loan, LoanDirection, LoanMethod, money, paymentLabels, PaymentType } from './model';
import { LoadState } from './components';
import { useLedger } from './useLedger';

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress}
    className={selected ? 'rounded-full bg-teal-900 px-4 py-3' : 'rounded-full bg-stone-100 px-4 py-3'}>
    <Text className={selected ? 'font-semibold text-white' : 'font-semibold text-stone-700'}>{label}</Text>
  </Pressable>;
}

export default function Loans() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const ledger = useLedger();
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState<number>();
  const [direction, setDirection] = useState<LoanDirection>('borrowed');
  const [method, setMethod] = useState<LoanMethod>('cash');
  const [category, setCategory] = useState(categories.expense[0]);
  const [person, setPerson] = useState('');
  const [principal, setPrincipal] = useState('');
  const [paymentType, setPaymentType] = useState<PaymentType>('pocket');
  const [date, setDate] = useState(() => dayjs().format('YYYY-MM-DDTHH:mm'));
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [repayment, setRepayment] = useState('');
  const [repaymentNote, setRepaymentNote] = useState('');
  const [repaymentError, setRepaymentError] = useState('');
  const [repaying, setRepaying] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    readLoans().then(value => {
      if (active) { setLoans(value); setFailed(false); }
    }).catch(() => {
      if (active) setFailed(true);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [reload]));

  const selectedLoan = loans.find(loan => loan.id === selectedId);
  const availableBalance = ledger.data?.balances[paymentType] ?? 0;
  const principalValue = Number(principal.trim().replace(',', '.'));
  const insufficientFunds = direction === 'lent' && Boolean(ledger.data) &&
    Number.isFinite(principalValue) && principalValue > 0 &&
    Math.round(principalValue * 100) > Math.round(availableBalance * 100);

  function openAdd() {
    setDirection('borrowed');
    setMethod('cash');
    setCategory(categories.expense[0]);
    setPerson('');
    setPrincipal('');
    setPaymentType('pocket');
    setDate(dayjs().format('YYYY-MM-DDTHH:mm'));
    setNote('');
    setFormError('');
    setAdding(true);
  }

  async function saveLoan() {
    const value = principal.trim().replace(',', '.');
    if (!/^\d{1,10}(\.\d{1,2})?$/.test(value) || Number(value) <= 0) {
      setFormError('Enter a positive amount with up to 2 decimal places.');
      return;
    }
    if (!person.trim()) { setFormError('Enter the person or lender name.'); return; }
    if (insufficientFunds) {
      setFormError(`Not enough money in ${paymentLabels[paymentType]} to lend this amount.`);
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await addLoan(direction, method, person, value, paymentType,
        direction === 'borrowed' && method === 'credit' ? category : null, note, date);
      setAdding(false);
      ledger.retry();
      setReload(value => value + 1);
    } catch (error) {
      setFormError(error instanceof Error && error.message.startsWith('Insufficient balance')
        ? error.message
        : 'Couldn’t save this loan. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function saveRepayment() {
    if (!selectedLoan) return;
    const value = repayment.trim().replace(',', '.');
    if (!/^\d{1,10}(\.\d{1,2})?$/.test(value) || Number(value) <= 0) {
      setRepaymentError('Enter a positive repayment amount with up to 2 decimal places.');
      return;
    }
    setRepaying(true);
    setRepaymentError('');
    try {
      await addLoanRepayment(selectedLoan.id, value, repaymentNote);
      setRepayment('');
      setRepaymentNote('');
      const updated = await readLoans();
      setLoans(updated);
      ledger.retry();
    } catch (error) {
      setRepaymentError(error instanceof Error &&
        (error.message.startsWith('Insufficient balance') || error.message.startsWith('Repayment exceeds'))
        ? error.message
        : 'Couldn’t save this repayment. Please try again.');
    } finally {
      setRepaying(false);
    }
  }

  function openLoan(loanId: number) {
    setSelectedId(loanId);
    setRepayment('');
    setRepaymentNote('');
    setRepaymentError('');
  }

  if (failed && !loans.length) {
    return <LoadState failed failureMessage="Couldn’t load your loans. Please try again."
      retry={() => setReload(value => value + 1)}/>;
  }

  return <View className="flex-1 bg-stone-50">
    <FlatList data={loading ? [] : loans} keyExtractor={loan => String(loan.id)}
      contentContainerStyle={{ padding: 20, paddingBottom: 100, gap: 12 }}
      ListHeaderComponent={<>
        <Text className="mb-1 text-2xl font-bold text-stone-900">Borrowed and lent</Text>
        <Text className="mb-4 text-stone-600">Track repayments and what is still owed.</Text>
        <View className="mb-2 flex-row gap-3">
          <View className="flex-1 rounded-2xl bg-white p-4">
            <Text className="text-stone-600">Pocket money</Text>
            <Text className="mt-1 font-bold">{money(ledger.data?.balances.pocket ?? 0)}</Text>
          </View>
          <View className="flex-1 rounded-2xl bg-white p-4">
            <Text className="text-stone-600">Account</Text>
            <Text className="mt-1 font-bold">{money(ledger.data?.balances.account ?? 0)}</Text>
          </View>
        </View>
        <Pressable accessibilityRole="button" onPress={openAdd} className="mb-2 rounded-xl bg-teal-900 p-4">
          <Text className="text-center font-bold text-white">Add borrowed or lent money</Text>
        </Pressable>
      </>}
      ListEmptyComponent={<Text className="rounded-2xl bg-white p-5 text-stone-600">
        {loading ? 'Loading loans…' : 'No loans recorded yet.'}
      </Text>}
      renderItem={({ item }) => <View className={item.direction === 'borrowed'
        ? 'rounded-2xl bg-emerald-50 p-4' : 'rounded-2xl bg-sky-50 p-4'}>
        <Pressable accessibilityRole="button"
          accessibilityLabel={`${item.direction === 'borrowed' ? 'Borrowed from' : 'Lent to'} ${item.person}, ${money(item.outstanding)} outstanding`}
          onPress={() => openLoan(item.id)}>
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="font-bold text-stone-900">{item.person}</Text>
              <Text className="mt-1 text-sm text-stone-600">
                {item.direction === 'borrowed'
                  ? item.method === 'credit' ? 'Bought on credit' : 'Borrowed'
                  : 'Lent'} · {item.category ? `${item.category} · ` : ''}{paymentLabels[item.payment_type]}
              </Text>
              <Text className="mt-1 text-xs text-stone-500">{formatEntryDate(item.date)}</Text>
            </View>
            <View className="items-end">
              <Text className={item.direction === 'borrowed'
                ? 'font-bold text-emerald-800' : 'font-bold text-sky-800'}>{money(item.outstanding)}</Text>
              <Text className="mt-1 text-xs text-stone-500">Outstanding</Text>
            </View>
          </View>
        </Pressable>
        {item.outstanding > 0 && <Pressable accessibilityRole="button" onPress={() => openLoan(item.id)}
          className={item.direction === 'borrowed'
            ? 'mt-3 rounded-xl bg-emerald-700 p-3' : 'mt-3 rounded-xl bg-sky-700 p-3'}>
          <Text className="text-center font-bold text-white">Add repayment</Text>
        </Pressable>}
      </View>}/>

    <Modal transparent visible={adding} animationType="slide" onRequestClose={() => setAdding(false)}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-end bg-black/40">
        <ScrollView keyboardShouldPersistTaps="handled" className="max-h-[90%] rounded-t-3xl bg-stone-50"
          contentContainerStyle={{ padding: 22, gap: 14 }}>
          <Text className="text-2xl font-bold">Add a loan</Text>
          <View className="flex-row gap-2">
            <Choice label="I borrowed" selected={direction === 'borrowed'}
              onPress={() => setDirection('borrowed')}/>
            <Choice label="I lent" selected={direction === 'lent'}
              onPress={() => { setDirection('lent'); setMethod('cash'); }}/>
          </View>
          {direction === 'borrowed' && <>
            <Text className="font-semibold">How did you borrow?</Text>
            <View className="flex-row flex-wrap gap-2">
              <Choice label="Cash received" selected={method === 'cash'} onPress={() => setMethod('cash')}/>
              <Choice label="Bought on credit" selected={method === 'credit'} onPress={() => setMethod('credit')}/>
            </View>
          </>}
          <Text className="font-semibold">{direction === 'borrowed' ? 'Borrowed from' : 'Lent to'}</Text>
          <TextInput accessibilityLabel="Person name" value={person} onChangeText={setPerson}
            maxLength={100} placeholder="Name" className="rounded-xl bg-white p-4"/>
          <Text className="font-semibold">Amount (LKR)</Text>
          <TextInput accessibilityLabel="Loan amount" value={principal} onChangeText={setPrincipal}
            keyboardType="decimal-pad" placeholder="0.00" className="rounded-xl bg-white p-4 text-2xl"/>
          <Text className="font-semibold">{direction === 'borrowed'
            ? method === 'credit' ? 'Repay from' : 'Received into'
            : 'Paid from'}</Text>
          <View className="flex-row flex-wrap gap-2">{(['pocket', 'account'] as const).map(type =>
            <Choice key={type} label={paymentLabels[type]} selected={paymentType === type}
              onPress={() => setPaymentType(type)}/>)}</View>
          {direction === 'lent' && <Text className="text-stone-600">
            {ledger.data
              ? `Available in ${paymentLabels[paymentType]}: ${money(availableBalance)}`
              : ledger.failed ? 'Couldn’t load the available balance; saving will still verify it.'
                : 'Checking available balance…'}
          </Text>}
          {insufficientFunds && <Text accessibilityRole="alert" className="text-rose-800">
            Not enough money in {paymentLabels[paymentType]} to lend this amount.
          </Text>}
          {direction === 'borrowed' && method === 'credit' && <>
            <Text className="font-semibold">Expense category</Text>
            <View className="flex-row flex-wrap gap-2">{categories.expense.map(value =>
              <Choice key={value} label={value} selected={category === value} onPress={() => setCategory(value)}/>)}</View>
            <Text className="text-sm text-stone-600">
              This increases expenses and the amount owed, but does not change your cash balance.
            </Text>
          </>}
          <Calendar date={date} onChange={setDate}/>
          <Text className="font-semibold">Note (optional)</Text>
          <TextInput accessibilityLabel="Loan note" value={note} onChangeText={setNote}
            multiline maxLength={500} placeholder="Add a note" className="min-h-20 rounded-xl bg-white p-4"/>
          {!!formError && <Text accessibilityRole="alert" className="text-rose-800">{formError}</Text>}
          <Pressable accessibilityRole="button" disabled={saving || insufficientFunds} onPress={() => { void saveLoan(); }}
            className="rounded-xl bg-teal-900 p-4">
            <Text className="text-center font-bold text-white">{saving ? 'Saving…' : 'Save loan'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setAdding(false)}>
            <Text className="p-2 text-center font-semibold text-teal-800">Cancel</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>

    <Modal transparent visible={selectedId !== undefined} animationType="slide"
      onRequestClose={() => setSelectedId(undefined)}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-end bg-black/40">
        <ScrollView keyboardShouldPersistTaps="handled" className="max-h-[90%] rounded-t-3xl bg-stone-50"
          contentContainerStyle={{ padding: 22, gap: 12 }}>
          {selectedLoan ? <>
            <Text className={selectedLoan.direction === 'borrowed'
              ? 'text-2xl font-bold text-emerald-800' : 'text-2xl font-bold text-sky-800'}>
              {selectedLoan.direction === 'borrowed' ? 'Borrowed from' : 'Lent to'} {selectedLoan.person}
            </Text>
            <View className="rounded-2xl bg-white p-4">
              <Text className="text-stone-600">
                {selectedLoan.method === 'credit' ? `Credit purchase · ${selectedLoan.category}` : 'Original amount'}
                {' · '}{paymentLabels[selectedLoan.payment_type]}
              </Text>
              <Text className="mt-1 text-xl font-bold">{money(selectedLoan.amount)}</Text>
              <Text className="mt-3 text-stone-600">Repaid</Text>
              <Text className="font-semibold">{money(selectedLoan.repaid_amount)}</Text>
              <Text className="mt-3 text-stone-600">Still owed</Text>
              <Text className="text-2xl font-bold text-teal-800">{money(selectedLoan.outstanding)}</Text>
            </View>
            {!!selectedLoan.note && <Text className="rounded-xl bg-white p-4 text-stone-600">{selectedLoan.note}</Text>}
            <Text className="text-lg font-bold">Repayments</Text>
            {selectedLoan.repayments.length
              ? selectedLoan.repayments.map(payment => <View key={payment.id} className="rounded-xl bg-white p-3">
                  <View className="flex-row justify-between gap-2">
                    <Text className="font-semibold">{money(payment.amount)}</Text>
                    <Text className="text-stone-600">{formatEntryDate(payment.date)}</Text>
                  </View>
                  {!!payment.note && <Text className="mt-1 text-stone-600">{payment.note}</Text>}
                </View>)
              : <Text className="text-stone-600">No repayments recorded.</Text>}
            {selectedLoan.outstanding > 0 && <>
              <Text className="mt-2 text-lg font-bold">Add a repayment</Text>
              <TextInput accessibilityLabel="Repayment amount" value={repayment} onChangeText={setRepayment}
                keyboardType="decimal-pad" placeholder="Amount (LKR)" className="rounded-xl bg-white p-4"/>
              <TextInput accessibilityLabel="Repayment note" value={repaymentNote} onChangeText={setRepaymentNote}
                maxLength={500} placeholder="Note (optional)" className="rounded-xl bg-white p-4"/>
              {!!repaymentError && <Text accessibilityRole="alert" className="text-rose-800">{repaymentError}</Text>}
              <Pressable accessibilityRole="button" disabled={repaying} onPress={() => { void saveRepayment(); }}
                className="rounded-xl bg-teal-900 p-4">
                <Text className="text-center font-bold text-white">{repaying ? 'Saving…' : 'Add repayment'}</Text>
              </Pressable>
            </>}
            {selectedLoan.outstanding <= 0 && <Text className="rounded-xl bg-emerald-50 p-4 font-semibold text-emerald-800">
              This loan has been fully repaid.
            </Text>}
          </> : <Text className="p-8 text-center text-stone-600">Loading loan details…</Text>}
          <Pressable accessibilityRole="button" onPress={() => setSelectedId(undefined)}>
            <Text className="p-2 text-center font-semibold text-teal-800">Close</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  </View>;
}
