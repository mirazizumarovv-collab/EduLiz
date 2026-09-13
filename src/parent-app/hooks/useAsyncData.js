import { useEffect, useRef, useState, useCallback } from "react";

// Used by every screen that pulls from the service layer, so loading and
// error states are consistent everywhere instead of being reinvented per
// screen (requirements #28/#29).
export function useAsyncData(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetcher()
      .then(result => { if (mountedRef.current) setData(result); })
      .catch(err => { if (mountedRef.current) setError(err); })
      .finally(() => { if (mountedRef.current) setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => { mountedRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, reload: load };
}
