import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import dayjs from 'dayjs';
import { LoadState } from './components';
import { money } from './model';
import { useLedger } from './useLedger';

const plotHeight = 200;
const minimumMonthSpacing = 72;
const axisSteps = [1, 0.75, 0.5, 0.25, 0];
const series = [
  { key: 'total_income', label: 'Income', color: '#047857' },
  { key: 'total_expense', label: 'Expenses', color: '#be123c' }
] as const;

export default function Charts() {
  const { data, failed, failureMessage, retry } = useLedger();
  const [viewportWidth, setViewportWidth] = useState(0);
  if (!data || failed) return <LoadState failed={failed} failureMessage={failureMessage} retry={retry} />;

  const months = [...data.history].reverse().concat(data.month);
  const plotWidth = Math.max(viewportWidth, months.length * minimumMonthSpacing);
  const monthSpacing = plotWidth / months.length;
  const peak = months.reduce((highest, month) =>
    Math.max(highest, month.total_income, month.total_expense), 0);
  const step = peak > 0 ? 10 ** Math.floor(Math.log10(peak / 4)) : 25;
  const max = Math.max(1, Math.ceil(peak / (4 * step))) * 4 * step;
  return <ScrollView className="flex-1 bg-stone-50" contentContainerStyle={{ padding: 20 }}>
    <Text className="mb-3 text-lg font-bold text-stone-900">Monthly income and expenses (LKR)</Text>
    <View className="mb-4 flex-row gap-4">
      {series.map(({ label, color }) => <Text key={label} style={{ color, fontWeight: '600' }}>{label}</Text>)}
    </View>
    <View className="flex-row rounded-2xl bg-white" style={{ paddingTop: 18, paddingBottom: 16, paddingHorizontal: 12 }}>
      <View style={{ height: plotHeight, width: 60, marginRight: 8 }}>
        {axisSteps.map(fraction => <Text key={fraction} className="text-right text-xs text-stone-600"
          style={{ position: 'absolute', right: 0, top: (1 - fraction) * plotHeight - 9 }}>
          Rs. {new Intl.NumberFormat('en-LK', { notation: 'compact', maximumFractionDigits: 2 }).format(fraction * max)}
        </Text>)}
      </View>
      <ScrollView horizontal style={{ flex: 1 }}
        onLayout={event => setViewportWidth(event.nativeEvent.layout.width)}
        scrollEnabled={plotWidth > viewportWidth}
        contentContainerStyle={{ paddingTop: 5, marginTop: -5 }}>
        <View style={{ width: plotWidth }}>
          <View style={{ height: plotHeight, borderLeftWidth: 1, borderLeftColor: '#a8a29e' }}>
            {axisSteps.map(fraction => <View key={fraction} style={{
              position: 'absolute', left: 0, right: 0,
              top: (1 - fraction) * plotHeight, height: 1, backgroundColor: '#d6d3d1'
            }} />)}
            {series.map(({ key, label, color }) => {
              const points = months.map((month, index) => ({
                x: (index + 0.5) * monthSpacing,
                y: (1 - month[key] / max) * plotHeight
              }));
              return <View key={key} pointerEvents="box-none"
                style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
            {points.slice(1).map((end, index) => {
              const start = points[index];
              const dy = end.y - start.y;
              const length = Math.hypot(monthSpacing, dy);
              return <View key={months[index + 1].month_key} style={{
                position: 'absolute', width: length, height: 2, backgroundColor: color,
                left: (start.x + end.x - length) / 2, top: (start.y + end.y) / 2 - 1,
                transform: [{ rotate: Math.atan2(dy, monthSpacing) + 'rad' }]
              }} />;
            })}
            {points.map((point, index) => <View key={months[index].month_key} accessible
              accessibilityLabel={dayjs(months[index].month_key + '-01').format('MMMM YYYY') + ', ' + label + ', ' + money(months[index][key])}
              style={{
                position: 'absolute', left: point.x - 4, top: point.y - 4,
                width: 8, height: 8, borderRadius: 4, backgroundColor: color
              }} />)}
              </View>;
            })}
          </View>
          <View className="mt-3 flex-row">
            {months.map(month => <Text key={month.month_key} className="text-center text-xs text-stone-600"
              style={{ width: monthSpacing }}>{dayjs(month.month_key + '-01').format('MMM YYYY')}</Text>)}
          </View>
        </View>
      </ScrollView>
    </View>
    {peak === 0 && <Text className="mt-4 text-sm text-stone-600">No income or expenses recorded yet.</Text>}
  </ScrollView>;
}
