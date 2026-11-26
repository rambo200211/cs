import {useRef,useState} from 'react';
import dayjs from 'dayjs';
import Calendar from './Calendar';
import {KeyboardAvoidingView,Platform,Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {SafeAreaView} from 'react-native-safe-area-context';
import {addEntry,addTransfer,updateEntry,updateTransfer} from './database';
import {categories,entryDateTimeFormat,EntryType,Kind,money,paymentLabels,PaymentType,Routes} from './model';
import {useLedger} from './useLedger';

function Choice({label,selected,onPress}: {label:string; selected:boolean; onPress:()=>void}) {
  return <Pressable accessibilityRole="button" accessibilityState={{selected}} onPress={onPress}
    className={selected?'rounded-full bg-teal-900 px-5 py-3':'rounded-full bg-white px-5 py-3'}>
    <Text className={selected?'font-semibold text-white':'text-stone-700'}>{label}</Text></Pressable>;
}
export default function Add({navigation,route}: NativeStackScreenProps<Routes,'Add'>) {
  const entry = route.params?.entry;
  const [date,setDate] = useState(() => entry?.date ?? dayjs().format(entryDateTimeFormat));
  const [type,setType] = useState<EntryType>(entry?.type ?? 'expense');
  const [paymentType,setPaymentType] = useState<PaymentType>(entry?.payment_type ?? 'pocket');
  const [destinationType,setDestinationType] = useState<PaymentType>(entry?.to_payment_type ?? 'account');
  const [category,setCategory] = useState(entry?.category ?? 'Food');
  const [amount,setAmount] = useState(entry ? String(entry.amount) : '');
  const [note,setNote] = useState(entry?.note ?? '');
  const [error,setError] = useState('');
  const [saving,setSaving] = useState(false);
  const busy = useRef(false);
  const ledger = useLedger();
  const amountValue = Number(amount.trim().replace(',', '.'));
  const availableBalance = (ledger.data?.balances[paymentType] ?? 0) +
    (entry?.type === 'transfer' && entry.payment_type === paymentType ? entry.amount : 0);
  const insufficientFunds = type === 'transfer' && Boolean(ledger.data) &&
    Number.isFinite(amountValue) && amountValue > 0 &&
    Math.round(amountValue * 100) > Math.round(availableBalance * 100);
  async function save() {
    if (busy.current) return;
    const value = amount.trim().replace(',', '.');
    if (!/^\d{1,10}(\.\d{1,2})?$/.test(value) || Number(value)<=0) {
      setError('Enter a positive amount with up to 10 digits and 2 decimal places.'); return;
    }
    if (type==='transfer' && paymentType===destinationType) {
      setError('Choose different payment types for the transfer.'); return;
    }
    busy.current = true;
    setSaving(true);
    setError('');
    try {
      if (type === 'transfer') {
        if (entry) await updateTransfer(Math.abs(entry.id),value,paymentType,destinationType,note,date);
        else await addTransfer(value,paymentType,destinationType,note,date);
      } else if (entry) await updateEntry(entry.id,type,category,value,note,date,paymentType);
      else await addEntry(type,category,value,note,date,paymentType);
      if (navigation.isFocused()) navigation.pop(entry ? 2 : 1);
    }
    catch (saveError) {
      setError(saveError instanceof Error && saveError.message.startsWith('Insufficient balance')
        ? saveError.message
        : 'Couldn’t save this transaction. Please try again.');
    }
    finally { busy.current=false; setSaving(false); }
  }
  return <SafeAreaView edges={['bottom']} className="flex-1 bg-stone-50">
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS==='ios'?'padding':undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:22,gap:14}}>
        <View className="flex-row flex-wrap gap-2">{(entry
          ? [entry.type]
          : ['expense','income','transfer'] as EntryType[]).map(t=>
          <Choice key={t} label={t==='expense'?'Expense':t==='income'?'Income':'Transfer'} selected={type===t}
            onPress={()=>{setType(t);if(t!=='transfer')setCategory(categories[t][0]);}}/>)}</View>
        <Text className="mt-3 font-semibold">Amount (LKR)</Text>
        <TextInput accessibilityLabel="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad"
          placeholder="0.00" className="rounded-2xl bg-white p-4 text-3xl"/>
        <Text className="font-semibold">{type==='transfer'?'From payment type':'Payment type'}</Text>
        <View className="flex-row flex-wrap gap-2">{(['pocket','account'] as const).map(payment =>
          <Choice key={payment} label={paymentLabels[payment]} selected={paymentType===payment}
            onPress={()=>{setPaymentType(payment);if(payment===destinationType)setDestinationType(payment==='pocket'?'account':'pocket');}}/>)}</View>
        {type==='transfer' && <>
          {!ledger.data && ledger.failed
            ? <Text accessibilityRole="alert" className="text-rose-800">Couldn’t load the available balance. Saving will still verify it.</Text>
            : <Text className="text-stone-600">{ledger.data
              ? `Available in ${paymentLabels[paymentType]}: ${money(availableBalance)}`
              : 'Checking available balance…'}</Text>}
          {insufficientFunds && <Text accessibilityRole="alert" className="text-rose-800">
            Not enough money in {paymentLabels[paymentType]} for this transfer.
          </Text>}
        </>}
        {type==='transfer' && <>
          <Text className="font-semibold">To payment type</Text>
          <View className="flex-row flex-wrap gap-2">{(['pocket','account'] as const).map(payment =>
            <Choice key={payment} label={paymentLabels[payment]} selected={destinationType===payment}
              onPress={()=>setDestinationType(payment)}/>)}</View>
        </>}
        <Calendar date={date} onChange={setDate}/>
        {type!=='transfer' && <>
          <Text className="font-semibold">Category</Text>
          <View className="flex-row flex-wrap gap-2">{categories[type].map(c=><Choice key={c} label={c}
            selected={category===c} onPress={()=>setCategory(c)}/>)}</View>
        </>}
        <Text className="font-semibold">Note (optional)</Text>
        <TextInput accessibilityLabel="Note" value={note} onChangeText={setNote} multiline maxLength={500}
          placeholder="Add a note" className="min-h-20 rounded-2xl bg-white p-4" />
        {!!error && <Text accessibilityRole="alert" className="text-rose-800">{error}</Text>}
        <Pressable accessibilityRole="button" disabled={saving || insufficientFunds} onPress={save} className="rounded-2xl bg-teal-900 p-4">
          <Text className="text-center font-bold text-white">{saving?'Saving…':entry?'Save changes':type==='transfer'?'Save transfer':'Save transaction'}</Text></Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
