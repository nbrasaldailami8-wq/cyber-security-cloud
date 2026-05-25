import { useState, useEffect, useCallback } from "react";

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  useEffect(() => {
    try {
      const item = localStorage.getItem(key);
      if (item !== null) setStoredValue(JSON.parse(item) as T);
    } catch { /* SSR */ }
  }, [key]);

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const next = value instanceof Function ? value(prev) : value;
        try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* quota */ }
        return next;
      });
    },
    [key],
  );

  return [storedValue, setValue];
}
