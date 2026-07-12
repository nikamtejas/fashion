"use client";

import { MapContainer, TileLayer, Marker, Polyline, Popup, CircleMarker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface RoutePoint {
  lat: number;
  lng: number;
  label?: string;
  timestamp?: string;
}

function truckIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="width:26px;height:26px;border-radius:50%;background:#C15B3C;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:12px">📦</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

export default function TrackMap({
  route,
  current,
}: {
  route: RoutePoint[];
  current: (RoutePoint & { honest?: string }) | null;
}) {
  const points = route.length > 0 ? route : current ? [current] : [];
  if (points.length === 0) return null;

  const center: [number, number] = current
    ? [current.lat, current.lng]
    : [points[points.length - 1].lat, points[points.length - 1].lng];

  return (
    <div className="h-80 overflow-hidden rounded-2xl border border-border">
      <MapContainer center={center} zoom={6} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {route.length > 1 && (
          <Polyline
            positions={route.map((p) => [p.lat, p.lng] as [number, number])}
            pathOptions={{ color: "#C15B3C", weight: 3, dashArray: "6 8" }}
          />
        )}
        {route.map((p, i) => (
          <CircleMarker
            key={i}
            center={[p.lat, p.lng]}
            radius={5}
            pathOptions={{ color: "#141414", fillColor: "#fff", fillOpacity: 1, weight: 2 }}
          >
            <Popup>
              {p.label ?? "Checkpoint"}
              {p.timestamp ? <><br />{new Date(p.timestamp).toLocaleString("en-IN")}</> : null}
            </Popup>
          </CircleMarker>
        ))}
        {current && (
          <Marker position={[current.lat, current.lng]} icon={truckIcon()}>
            <Popup>{current.honest ?? current.label ?? "Current location"}</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
