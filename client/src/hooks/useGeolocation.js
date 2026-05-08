import { useState, useCallback } from 'react';

/**
 * Hook that wraps navigator.geolocation.getCurrentPosition
 * Returns { coords, loading, error, getLocation }
 */
export const useGeolocation = () => {
  const [coords, setCoords] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return Promise.reject(new Error('Geolocation not supported'));
    }
    setLoading(true);
    setError(null);

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const next = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          };
          setCoords(next);
          setLoading(false);
          resolve(next);
        },
        (err) => {
          let message = 'Unable to retrieve your location';
          if (err.code === 1) message = 'Location permission denied';
          else if (err.code === 2) message = 'Location unavailable';
          else if (err.code === 3) message = 'Location request timed out';
          setError(message);
          setLoading(false);
          reject(new Error(message));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  }, []);

  return { coords, loading, error, getLocation };
};
