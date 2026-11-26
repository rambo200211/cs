import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import dayjs from 'dayjs';

export default function Calendar({ date, onChange, compact = false }: {
  date: string;
  onChange?: (date: string) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => dayjs(date).startOf('month'));
  const [timeOpen, setTimeOpen] = useState(false);
  const [hour, setHour] = useState('');
  const [minute, setMinute] = useState('');
  const validTime = /^\d{1,2}$/.test(hour) && Number(hour) < 24 &&
    /^\d{1,2}$/.test(minute) && Number(minute) < 60;
  const dayKey = date.slice(0, 10);
  const hasTime = date.length > 10;
  const today = dayjs().format('YYYY-MM-DD');
  const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const cells = month.day() + month.daysInMonth();

  return <View className="gap-2">
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }}
      className={compact ? 'rounded-xl bg-white px-3 py-2' : 'rounded-xl bg-white p-4'} onPress={() => {
        if (!open) setMonth(dayjs(date).startOf('month'));
        setOpen(!open);
      }}>
      <Text className={compact ? 'text-sm font-semibold' : 'font-semibold'}>
        Date · {dayjs(date).format('D MMMM YYYY')}
      </Text>
    </Pressable>
    {open && <View className="rounded-xl bg-white p-3">
      <View className="flex-row items-center justify-between">
        <Pressable accessibilityRole="button" accessibilityLabel="Previous month"
          onPress={() => setMonth(month.subtract(1, 'month'))}><Text className="p-3">{'<'}</Text></Pressable>
        <Text className="font-bold">{month.format('MMMM YYYY')}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Next month"
          onPress={() => setMonth(month.add(1, 'month'))}><Text className="p-3">{'>'}</Text></Pressable>
      </View>
      <View className="flex-row">
        {weekdays.map(day => <Text key={day} className="flex-1 text-center text-stone-600">{day}</Text>)}
      </View>
      <View className="flex-row flex-wrap">
        {Array.from({ length: cells }, (_, index) => {
          const day = index - month.day() + 1;
          if (day < 1) return <View key={index} style={{ width: '14.285%' }} />;
          const value = month.date(day).format('YYYY-MM-DD');
          const selected = dayKey === value;
          const disabled = !onChange || value > today;
          return <Pressable key={index} accessibilityRole="button"
            accessibilityLabel={month.date(day).format('D MMMM YYYY')}
            accessibilityState={{ selected, disabled }} disabled={disabled}
            style={{ width: '14.285%' }} onPress={() => { onChange?.(value + date.slice(10)); setOpen(false); }}>
            <Text className={selected ? 'rounded-lg bg-teal-800 py-3 text-center text-white' :
              value > today ? 'py-3 text-center text-stone-400' : 'py-3 text-center text-stone-900'}>{day}</Text>
          </Pressable>;
        })}
      </View>
    </View>}
    {onChange ? <Pressable accessibilityRole="button" accessibilityHint="Opens the time picker"
      className={compact ? 'rounded-xl bg-white px-3 py-2' : 'rounded-xl bg-white p-4'} onPress={() => {
        const time = hasTime ? dayjs(date) : dayjs();
        setHour(time.format('HH'));
        setMinute(time.format('mm'));
        setTimeOpen(true);
      }}>
      <Text className={compact ? 'text-sm font-semibold' : 'font-semibold'}>
        Time · {hasTime ? dayjs(date).format('h:mm A') : 'Choose time'}
      </Text>
    </Pressable> : <Text className={compact
      ? 'rounded-xl bg-white px-3 py-2 text-sm font-semibold'
      : 'rounded-xl bg-white p-4 font-semibold'}>
      Time · {hasTime ? dayjs(date).format('h:mm A') : 'Not recorded'}
    </Text>}
    {onChange && <Modal transparent visible={timeOpen} animationType="fade" onRequestClose={() => setTimeOpen(false)}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-center bg-black/40 p-6">
        <View className="gap-3 rounded-2xl bg-white p-5">
          <Text className="text-xl font-bold">Choose time</Text>
          <View className="flex-row gap-3">
            <View className="flex-1 gap-1">
              <Text>Hour (00–23)</Text>
              <TextInput accessibilityLabel="Hour" className="rounded-xl bg-stone-100 p-3 text-lg"
                keyboardType="number-pad" maxLength={2} value={hour} onChangeText={setHour}/>
            </View>
            <View className="flex-1 gap-1">
              <Text>Minute (00–59)</Text>
              <TextInput accessibilityLabel="Minute" className="rounded-xl bg-stone-100 p-3 text-lg"
                keyboardType="number-pad" maxLength={2} value={minute} onChangeText={setMinute}/>
            </View>
          </View>
          <Pressable accessibilityRole="button" disabled={!validTime}
            className={validTime ? 'rounded-xl bg-teal-900 p-3' : 'rounded-xl bg-stone-400 p-3'}
            onPress={() => {
              onChange(`${dayKey}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`);
              setTimeOpen(false);
            }}>
            <Text className="text-center font-bold text-white">Set time</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setTimeOpen(false)}>
            <Text className="p-2 text-center font-semibold text-teal-800">Cancel</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>}
  </View>;
}
