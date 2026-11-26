import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import { useLedger } from './useLedger';
import { formatEntryDate, money, paymentLabels, Routes } from './model';
import { LoadState } from './components';

export default function Home() {
  const nav = useNavigation<NativeStackNavigationProp<Routes>>();
  const [selectedMonth,setSelectedMonth] = useState<string>();
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const {data,monthLoading,failed,failureMessage,retry} = useLedger(selectedMonth);
  const missingMonth = Boolean(data && selectedMonth && data.month.month_key !== selectedMonth &&
    !data.history.some(month=>month.month_key===selectedMonth));
  useEffect(() => {
    if (missingMonth) setSelectedMonth(undefined);
  }, [missingMonth]);
  if (!data || failed) return <LoadState failed={failed} failureMessage={failureMessage} retry={retry}/>;
  const months = [data.month,...data.history];
  const m = months.find(month => month.month_key === selectedMonth) ?? data.month;
  const currentBalance = data.month.closing_balance;
  return <View className="flex-1 bg-stone-50">
    <Modal transparent visible={monthPickerOpen} animationType="fade" onRequestClose={() => setMonthPickerOpen(false)}>
      <View className="flex-1 justify-center bg-black/40 p-6">
        <View className="max-h-[75%] rounded-2xl bg-white p-4">
          <Text className="mb-2 text-xl font-bold">Choose month</Text>
          <FlatList data={months} keyExtractor={month => month.month_key}
            renderItem={({item}) => <Pressable accessibilityRole="button"
              accessibilityState={{selected: item.month_key === m.month_key}}
              className={item.month_key === m.month_key ? 'rounded-xl bg-teal-100 p-3' : 'p-3'}
              onPress={() => {
                setSelectedMonth(item.month_key === data.month.month_key ? undefined : item.month_key);
                setMonthPickerOpen(false);
              }}>
              <Text>{dayjs(item.month_key + '-01').format('MMMM YYYY')}</Text>
            </Pressable>}/>
          <Pressable accessibilityRole="button" onPress={() => setMonthPickerOpen(false)}>
            <Text className="p-3 text-center font-semibold text-teal-800">Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
    <FlatList data={monthLoading || missingMonth ? [] : data.recent} keyExtractor={e=>String(e.id)} contentContainerStyle={{padding:20,paddingBottom:100}}
      ListHeaderComponent={<>
        <Pressable accessibilityRole="button" accessibilityHint="Opens the month picker"
          onPress={() => setMonthPickerOpen(true)} className="mb-3 flex-row items-center justify-between rounded-xl bg-white p-4">
          <Text className="font-semibold">{dayjs(m.month_key+'-01').format('MMMM YYYY')}</Text>
          <Text className="text-teal-800">Change month</Text>
        </Pressable>
        <View className="rounded-3xl bg-teal-950 p-6">
          <Text className="text-teal-100">Current balance</Text>
          <Text className={`my-3 text-4xl font-bold ${currentBalance < 0 ? 'text-red-300' : currentBalance > 0 ? 'text-green-300' : 'text-white'}`}>
            {money(currentBalance)}
          </Text>
          <Text className="text-teal-100">Carried forward  {money(data.month.opening_balance)}</Text>
          <View className="mt-4 gap-2 border-t border-teal-800 pt-3">
            <View className="flex-row flex-wrap justify-between gap-x-2">
              <Text className="text-sm text-teal-100">Account balance</Text>
              <Text className="text-sm font-semibold text-white">{money(data.balances.account)}</Text>
            </View>
            <View className="flex-row flex-wrap justify-between gap-x-2">
              <Text className="text-sm text-teal-100">Pocket money</Text>
              <Text className="text-sm font-semibold text-white">{money(data.balances.pocket)}</Text>
            </View>
          </View>
        </View>
        <View className="my-4 flex-row gap-3">
          <View className="flex-1 rounded-2xl bg-emerald-50 p-4"><Text>Income</Text><Text className="mt-1 font-bold text-emerald-800">{money(m.total_income)}</Text></View>
          <View className="flex-1 rounded-2xl bg-rose-50 p-4"><Text>Expenses</Text><Text className="mt-1 font-bold text-rose-800">{money(m.total_expense)}</Text></View>
        </View>
        <Text className="mb-3 mt-2 text-xl font-bold">Transactions</Text>
      </>}
      ListEmptyComponent={<Text className="rounded-2xl bg-white p-5 text-stone-600">{monthLoading ? 'Loading transactions…' : 'No transactions this month.'}</Text>}
      renderItem={({item})=><Pressable accessibilityRole="button" onPress={()=>nav.navigate('Transaction',{entry:item})} className="mb-2 flex-row items-center justify-between rounded-2xl bg-white p-4">
        <View className="mr-3 flex-1"><Text className="font-bold">{item.type==='transfer'
            ? `${paymentLabels[item.payment_type]} → ${paymentLabels[item.to_payment_type]}`
            : item.category}</Text>
          <Text className="text-xs text-stone-600">{formatEntryDate(item.date)}</Text></View>
        <Text className={item.type==='transfer'?'font-bold text-teal-800':item.type==='income'?'font-bold text-emerald-700':'font-bold text-rose-700'}>
          {item.type==='income'?'+':item.type==='expense'?'−':''}{money(item.amount)}</Text>
      </Pressable>}/>
    <Pressable accessibilityRole="button" accessibilityLabel="Add transaction" onPress={()=>nav.navigate('Add')}
      className="absolute bottom-5 right-5 h-16 w-16 items-center justify-center rounded-full bg-teal-800">
      <Text className="text-4xl text-white">+</Text></Pressable>
  </View>;
}
