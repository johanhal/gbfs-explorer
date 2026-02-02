

import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import brain from 'brain';

interface MapPoint {
  lat: number;
  lon: number;
}

interface Props {
  fetchPoints: () => Promise<{ points: MapPoint[] }>;
  cityName?: string; // Optional city name for better initial centering
}

const OperatorMap: React.FC<Props> = ({ fetchPoints, cityName }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch Mapbox token on mount
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const response = await brain.get_config();
        const data = await response.json();
        setMapboxToken(data.mapbox_token);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch config:', err);
        setError('Failed to load map configuration');
      } finally {
        setIsLoading(false);
      }
    };

    fetchToken();
  }, []);

  // Simple function to get approximate city center coordinates
  const getCityCenter = (city: string): [number, number] => {
    const cityCoords: Record<string, [number, number]> = {
      // Major cities with approximate coordinates [longitude, latitude]
      'new york': [-74.006, 40.7128],
      'london': [-0.1276, 51.5074],
      'paris': [2.3522, 48.8566],
      'berlin': [13.4050, 52.5200],
      'tokyo': [139.6917, 35.6895],
      'oslo': [10.7522, 59.9139],
      'stockholm': [18.0686, 59.3293],
      'copenhagen': [12.5683, 55.6761],
      'amsterdam': [4.9041, 52.3676],
      'madrid': [-3.7038, 40.4168],
      'rome': [12.4964, 41.9028],
      'barcelona': [2.1734, 41.3851],
      'vienna': [16.3738, 48.2082],
      'prague': [14.4378, 50.0755],
      'budapest': [19.0402, 47.4979],
      'warsaw': [21.0122, 52.2297],
      'moscow': [37.6176, 55.7558],
      'helsinki': [24.9384, 60.1699],
      'lisbon': [-9.1393, 38.7223],
      'dublin': [-6.2603, 53.3498],
      'brussels': [4.3517, 50.8503],
      'zurich': [8.5417, 47.3769],
      'geneva': [6.1432, 46.2044],
      'montreal': [-73.5673, 45.5017],
      'toronto': [-79.3832, 43.6532],
      'vancouver': [-123.1207, 49.2827],
      'sydney': [151.2093, -33.8688],
      'melbourne': [144.9631, -37.8136],
    };
    
    const cityKey = city.toLowerCase().trim();
    return cityCoords[cityKey] || [0, 20]; // Default to world view if city not found
  };

  useEffect(() => {
    // Wait for token and DOM
    if (typeof window === 'undefined' || !containerRef.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    // Use city center if available, otherwise default
    const initialCenter = cityName ? getCityCenter(cityName) : [0, 20];
    const initialZoom = cityName ? 10 : 2;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: initialCenter,
      zoom: initialZoom,
      attributionControl: false,
    });
    mapRef.current = map;

    map.on('load', async () => {
      try {
        // Small timeout helps if the parent panel animates open
        setTimeout(() => map.resize(), 0);

        const { points } = await fetchPoints();

        if (!points || points.length === 0) {
          // Nothing to draw; leave default view
          return;
        }

        const fc: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: points.map((p) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
            properties: {},
          })),
        };

        if (!map.getSource('points')) {
          map.addSource('points', { type: 'geojson', data: fc });
        } else {
          (map.getSource('points') as mapboxgl.GeoJSONSource).setData(fc);
        }

        if (!map.getLayer('points-layer')) {
          map.addLayer({
            id: 'points-layer',
            type: 'circle',
            source: 'points',
            paint: {
              'circle-radius': 3.5,
              'circle-color': '#3B82F6', // blue-500 color to match search button
              'circle-opacity': 0.5, // 50% transparency
            },
          });
        }

        // Fit bounds to all points with some padding
        const bounds = new mapboxgl.LngLatBounds();
        for (const p of points) bounds.extend([p.lon, p.lat]);
        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, { padding: 30, duration: 1000 }); // Smoother transition
        }
      } catch (err) {
        // Keep silent in UI; log for debugging
        console.error('Failed to load map points:', err);
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [fetchPoints, mapboxToken, cityName]);

  if (isLoading) {
    return (
      <div className="w-full bg-gray-100 rounded-lg flex items-center justify-center" style={{ height: '320px' }}>
        <p className="text-gray-500">Loading map...</p>
      </div>
    );
  }

  if (error || !mapboxToken) {
    return (
      <div className="w-full bg-gray-100 rounded-lg flex items-center justify-center" style={{ height: '320px' }}>
        <p className="text-gray-500">{error || 'Map token not configured'}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full rounded-lg overflow-hidden"
      style={{ height: '320px' }}
    />
  );
};

export default OperatorMap;
