"use client";

import * as React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapStore {
  id: string;
  name: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
}

// Styled dot markers avoid Leaflet's bundler-broken default icon assets.
function dotIcon(selected: boolean) {
  return L.divIcon({
    className: "",
    html: `<div style="width:18px;height:18px;border-radius:50%;background:${selected ? "#C15B3C" : "#141414"};border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

export default function StoreMap({
  stores,
  selectedId,
  onSelect,
}: {
  stores: MapStore[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const center: [number, number] =
    stores.length > 0
      ? [stores.reduce((s, x) => s + x.lat, 0) / stores.length, stores.reduce((s, x) => s + x.lng, 0) / stores.length]
      : [20.5937, 78.9629]; // India centroid

  return (
    <div className="h-80 overflow-hidden rounded-2xl border border-border">
      <MapContainer center={center} zoom={stores.length > 1 ? 4 : 11} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {stores.map((s) => (
          <Marker
            key={s.id}
            position={[s.lat, s.lng]}
            icon={dotIcon(s.id === selectedId)}
            eventHandlers={{ click: () => onSelect(s.id) }}
          >
            <Popup>
              <strong>{s.name}</strong>
              <br />
              {s.address}, {s.city}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
