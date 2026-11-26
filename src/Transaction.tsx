import { useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Calendar from './Calendar';
import { deleteEntry, deleteTransfer } from './database';
import { money, paymentLabels, type Routes } from './model';

export default function Transaction({ navigation, route }: NativeStackScreenProps<Routes, 'Transaction'>) {
  const { entry } = route.params;
  const busy = useRef(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const income = entry.type === 'income';
  const transfer = entry.type === 'transfer';

  async function remove() {
    if (busy.current) return;
    busy.current = true;
    setDeleting(true);
    setError('');
    try {
      if (transfer) await deleteTransfer(Math.abs(entry.id));
      else await deleteEntry(entry.id);
      if (navigation.isFocused()) navigation.goBack();
    } catch {
      setError('Could not delete this transaction. Please try again.');
    } finally {
      busy.current = false;
      setDeleting(false);
    }
  }

  function confirmDelete() {
    Alert.alert('Delete transaction?', 'This will remove the transaction from your ledger.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { void remove(); } }
    ]);
  }

  return <ScrollView className="flex-1 bg-stone-50" contentContainerStyle={{ padding: 20, gap: 16 }}>
    <View className="gap-2 rounded-2xl bg-white p-5">
      <Text className="text-stone-600">{transfer ? 'Transfer' : income ? 'Income' : 'Expense'}</Text>
      <Text className={transfer ? 'text-3xl font-bold text-teal-800' : income ? 'text-3xl font-bold text-emerald-700' : 'text-3xl font-bold text-rose-700'}>
        {money(entry.amount)}
      </Text>
      {transfer
        ? <Text className="font-semibold">{paymentLabels[entry.payment_type]} → {paymentLabels[entry.to_payment_type]}</Text>
        : <Text className="font-semibold">{entry.category}</Text>}
      {!!entry.note && <Text className="text-stone-600">{entry.note}</Text>}
    </View>
    <Calendar date={entry.date} compact/>
    {!!error && <Text accessibilityRole="alert" className="text-rose-800">{error}</Text>}
    <Pressable accessibilityRole="button" disabled={deleting} className="rounded-xl bg-teal-900 p-4"
      onPress={() => navigation.navigate('Add', { entry })}>
      <Text className="text-center font-bold text-white">Edit</Text>
    </Pressable>
    <Pressable accessibilityRole="button" disabled={deleting} className="rounded-xl bg-rose-100 p-4" onPress={confirmDelete}>
      <Text className="text-center font-bold text-rose-800">{deleting ? 'Deleting…' : 'Delete'}</Text>
    </Pressable>
  </ScrollView>;
}
