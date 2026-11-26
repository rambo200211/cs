import { ActivityIndicator, Pressable, Text, View } from 'react-native';
export function LoadState({failed,failureMessage,retry}: {failed:boolean; failureMessage:string; retry:()=>void}) {
  return <View className="flex-1 items-center justify-center gap-4 bg-stone-50 px-6">
    {failed ? <><Text className="text-center">{failureMessage}</Text>
      <Pressable accessibilityRole="button" onPress={retry}><Text className="p-3 font-bold text-teal-800">Try again</Text></Pressable></> : <ActivityIndicator accessibilityLabel="Loading ledger" />}
  </View>;
}
