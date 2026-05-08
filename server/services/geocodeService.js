/**
 * Reverse geocoding using OpenStreetMap Nominatim (free, no API key required)
 * NOTE: Nominatim requests must include a User-Agent identifying the application.
 */

const reverseGeocode = async (lat, lng) => {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'CivicReporter/1.0 (civic-reporter-app)',
        'Accept-Language': 'en'
      }
    });

    if (!res.ok) {
      console.warn('Nominatim non-OK response:', res.status);
      return '';
    }

    const data = await res.json();
    return data && data.display_name ? data.display_name : '';
  } catch (err) {
    console.error('Reverse geocode error:', err.message);
    return '';
  }
};

module.exports = { reverseGeocode };
