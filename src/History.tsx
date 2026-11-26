import {FlatList, Text, View} from 'react-native';
import dayjs from 'dayjs';
import {useLedger} from './useLedger';
import {LoadState} from './components';
import {money} from './model';

function Row({label,value,tone}: {label:string; value:number; tone:string}) {
  return <View className="mt-2 flex-row justify-between gap-2"><Text className="text-stone-600">{label}</Text>
    <Text className={tone}>{money(value)}</Text></View>;
}
export default function History() {
  const {data,failed,failureMessage,retry} = useLedger();
  if (!data || failed) return <LoadState failed={failed} failureMessage={failureMessage} retry={retry}/>;
  return <FlatList className="bg-stone-50" contentContainerStyle={{padding:20}} data={data.history}
    keyExtractor={m=>m.month_key} renderItem={({item:m})=><View className="mb-4 rounded-3xl bg-white p-5">
      <Text className="mb-2 text-xl font-bold">{dayjs(m.month_key+'-01').format('MMMM YYYY')}</Text>
      <Row label="Opening balance" value={m.opening_balance} tone="text-stone-800"/>
      <Row label="Income" value={m.total_income} tone="text-emerald-700"/>
      <Row label="Expenses" value={m.total_expense} tone="text-rose-700"/>
      {m.credit_expense > 0 && <Row label="Of which, credit purchases" value={m.credit_expense} tone="text-rose-700"/>}
      {m.loan_net !== 0 && <Row label="Net loan activity" value={m.loan_net} tone="text-teal-800"/>}
      <View className="mt-3 border-t border-stone-200 pt-1"><Row label="Closing balance" value={m.closing_balance}
        tone={m.closing_balance < 0 ? 'font-bold text-red-700' : m.closing_balance > 0 ? 'font-bold text-green-700' : 'font-bold text-stone-800'}/></View>
    </View>}/>;
}
