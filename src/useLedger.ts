import { useCallback, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import dayjs from 'dayjs';
import { readLedger } from './database';
import { Ledger } from './model';

export function useLedger(selectedMonth?: string) {
  const [data, setData] = useState<Ledger>();
  const [loadedMonth, setLoadedMonth] = useState<string>();
  const [failed, setFailed] = useState(false);
  const [failureMessage, setFailureMessage] = useState('Couldn\'t open your ledger. Please try again.');
  const [attempt, setAttempt] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    function refresh() {
      clearTimeout(timer);
      const now = dayjs();
      timer = setTimeout(refresh, now.add(1,'day').startOf('day').diff(now)+50);
      readLedger(selectedMonth).then(value => {
        if (active) { setData(value); setLoadedMonth(selectedMonth); setFailed(false); }
      }).catch(error => {
        if (active) {
          setFailureMessage(error instanceof Error ? error.message : 'Couldn\'t open your ledger. Please try again.');
          setFailed(true);
        }
      });
    }
    refresh();
    const sub = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { active = false; clearTimeout(timer); sub.remove(); };
  }, [attempt, selectedMonth]));
  return { data, monthLoading: loadedMonth !== selectedMonth, failed, failureMessage, retry: () => setAttempt(n => n+1) };
}
