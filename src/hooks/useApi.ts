import { useState, useCallback } from "react";
import { csrfFetch } from "@/lib/csrfClient";

interface UseApiOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
}

export function useApi<T = any>(options?: UseApiOptions) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const execute = useCallback(
    async (
      url: string,
      method: string = "GET",
      body?: any,
    ): Promise<T | null> => {
      setLoading(true);
      setError("");
      try {
        const headers: Record<string, string> = body
          ? { "Content-Type": "application/json" }
          : {};
        const res = await csrfFetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.message || "حدث خطأ");
        setData(result.data ?? result);
        options?.onSuccess?.(result.data ?? result);
        return result.data ?? result;
      } catch (err: any) {
        const msg = err.message || "حدث خطأ";
        setError(msg);
        options?.onError?.(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [options?.onSuccess, options?.onError],
  );

  const reset = useCallback(() => {
    setData(null);
    setError("");
    setLoading(false);
  }, []);

  return { data, error, loading, execute, reset };
}
