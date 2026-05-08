import { useEffect, useMemo, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Marker,
  useMap,
  LayersControl
} from 'react-leaflet';
import L from 'leaflet';
import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge';

const { BaseLayer, Overlay } = LayersControl;

// Fix the default Leaflet marker icon (Vite doesn't bundle PNGs by default)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

const STATUS_COLORS = {
  pending: '#ef4444',
  in_review: '#3b82f6',
  in_progress: '#f59e0b',
  resolved: '#10b981',
  rejected: '#6b7280'
};

const CATEGORY_LABEL = {
  pothole: 'Pothole',
  garbage: 'Garbage',
  water_leak: 'Water Leak',
  streetlight: 'Streetlight',
  other: 'Other'
};

/**
 * Controls re-centering AND fixes the "world view" bug.
 *
 * The bug: Leaflet calculates which tiles to load based on the map's pixel
 * dimensions. If the container's size changes after Leaflet initializes
 * (which happens with flex/grid layouts), Leaflet shows a low-zoom world
 * map instead of the intended view. invalidateSize() forces it to recompute.
 */
const MapController = ({ center, zoom }) => {
  const map = useMap();

  // 1. Fix tile-loading bug: force Leaflet to recompute container size
  useEffect(() => {
    const fixSize = () => map.invalidateSize();
    // Run immediately and a few times after mount to catch any layout shifts
    fixSize();
    const t1 = setTimeout(fixSize, 100);
    const t2 = setTimeout(fixSize, 400);
    const t3 = setTimeout(fixSize, 1000);

    // Also fix when window resizes
    window.addEventListener('resize', fixSize);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener('resize', fixSize);
    };
  }, [map]);

  // 2. Recenter when props change
  useEffect(() => {
    if (center) {
      map.setView(center, zoom || map.getZoom());
    }
  }, [center, zoom, map]);

  return null;
};

const DraggableMarker = ({ position, onDragEnd }) => {
  const markerRef = useRef(null);
  const handleDragEnd = () => {
    const m = markerRef.current;
    if (m) {
      const ll = m.getLatLng();
      onDragEnd && onDragEnd({ lat: ll.lat, lng: ll.lng });
    }
  };
  return (
    <Marker
      draggable
      position={position}
      ref={markerRef}
      eventHandlers={{ dragend: handleDragEnd }}
    />
  );
};

const MapView = ({
  complaints = [],
  center = [28.6139, 77.209],
  zoom = 13,
  draggableMarker = null,
  onMarkerDrag,
  height = '100%'
}) => {
  const safeCenter = useMemo(() => {
    if (Array.isArray(center) && center.length === 2 && !Number.isNaN(center[0])) return center;
    return [28.6139, 77.209];
  }, [center]);

  return (
    <div style={{ height, width: '100%' }}>
      <MapContainer
        center={safeCenter}
        zoom={zoom}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        <LayersControl position="topright">
          {/* Default view: Satellite imagery (Esri World Imagery — free, no API key) */}
          <BaseLayer checked name="🛰️ Satellite">
            <TileLayer
              attribution='Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
          </BaseLayer>

          {/* Alternative view: Street map */}
          <BaseLayer name="🗺️ Streets">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{y}/{x}.png"
              maxZoom={19}
            />
          </BaseLayer>

          {/* Optional minimalist style */}
          <BaseLayer name="🎨 Light">
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              maxZoom={19}
            />
          </BaseLayer>

          {/* Always-on label overlay so satellite is navigable */}
          <Overlay checked name="📍 Place Labels">
            <TileLayer
              attribution=''
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png"
              maxZoom={19}
              opacity={0.9}
            />
          </Overlay>
        </LayersControl>

        <MapController center={safeCenter} zoom={zoom} />

        {draggableMarker && (
          <DraggableMarker position={draggableMarker} onDragEnd={onMarkerDrag} />
        )}

        {complaints.map((c) => {
          if (
            !c.location ||
            !Array.isArray(c.location.coordinates) ||
            c.location.coordinates.length !== 2
          ) {
            return null;
          }
          const [lng, lat] = c.location.coordinates;
          const color = STATUS_COLORS[c.status] || '#6b7280';
          return (
            <CircleMarker
              key={c._id}
              center={[lat, lng]}
              radius={10}
              pathOptions={{
                color: '#ffffff',
                fillColor: color,
                fillOpacity: 0.95,
                weight: 3
              }}
            >
              <Popup>
                <div className="space-y-2 min-w-[180px]">
                  <h3 className="font-semibold text-gray-900">{c.title}</h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100">
                      {CATEGORY_LABEL[c.category] || 'Other'}
                    </span>
                    <StatusBadge status={c.status} />
                  </div>
                  <Link
                    to={`/complaint/${c._id}`}
                    className="text-brand-600 text-sm font-medium hover:underline block"
                  >
                    View Details →
                  </Link>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default MapView;
