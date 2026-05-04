"use client";

import { useEffect, useRef, useState } from "react";
import type L from "leaflet";
import type { LocationPoint, Spot } from "@/lib/spots";

type LoreMapProps = {
  center: LocationPoint;
  spots: Spot[];
  selectedSpotId: string | null;
  onSelectSpot: (spot: Spot) => void;
  userLocation: LocationPoint | null;
};

export default function LoreMap({ center, spots, selectedSpotId, onSelectSpot, userLocation }: LoreMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const locationLayerRef = useRef<L.LayerGroup | null>(null);
  const hasInitializedRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    let disposed = false;

    void import("leaflet").then((leaflet) => {
      if (disposed || !containerRef.current || mapRef.current) {
        return;
      }

      const map = leaflet.default.map(containerRef.current, {
        zoomControl: false,
        attributionControl: true
      }).setView([center.lat, center.lng], 15);

      leaflet.default.control.zoom({ position: "topright" }).addTo(map);

      leaflet.default.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20
      }).addTo(map);

      markerLayerRef.current = leaflet.default.layerGroup().addTo(map);
      locationLayerRef.current = leaflet.default.layerGroup().addTo(map);
      mapRef.current = map;
      setMapReady(true);
    });

    return () => {
      disposed = true;
      setMapReady(false);
      mapRef.current?.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      locationLayerRef.current = null;
    };
  }, [center.lat, center.lng]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    if (!hasInitializedRef.current) {
      map.setView([center.lat, center.lng], 15, { animate: false });
      hasInitializedRef.current = true;
      return;
    }

    map.panTo([center.lat, center.lng], { animate: true, duration: 0.7 });
  }, [center.lat, center.lng]);

  useEffect(() => {
    const layer = markerLayerRef.current;

    if (!mapReady || !layer) {
      return;
    }

    layer.clearLayers();

    void import("leaflet").then((leaflet) => {
      spots.forEach((spot) => {
        const selected = spot.id === selectedSpotId;
        const themeClass = spot.theme ? ` theme-${spot.theme}` : "";
        const icon = leaflet.default.divIcon({
          html: `<span class="lore-marker${selected ? " is-selected" : ""}${themeClass}" aria-hidden="true"></span>`,
          className: "lore-marker-wrap",
          iconSize: selected ? [34, 34] : [28, 28],
          iconAnchor: selected ? [17, 34] : [14, 28]
        });

        leaflet.default.marker([spot.lat, spot.lng], { icon, keyboard: true, title: spot.title })
          .on("click", () => onSelectSpot(spot))
          .addTo(layer);
      });
    });
  }, [mapReady, onSelectSpot, selectedSpotId, spots]);

  useEffect(() => {
    const layer = locationLayerRef.current;

    if (!mapReady || !layer) {
      return;
    }

    layer.clearLayers();

    if (!userLocation) {
      return;
    }

    void import("leaflet").then((leaflet) => {
      const icon = leaflet.default.divIcon({
        html: '<span class="lore-location-dot" aria-hidden="true"></span>',
        className: "lore-location-wrap",
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      });

      leaflet.default.marker([userLocation.lat, userLocation.lng], {
        icon,
        keyboard: false,
        title: "Current location"
      }).addTo(layer);
    });
  }, [mapReady, userLocation]);

  useEffect(() => {
    const map = mapRef.current;
    const selected = spots.find((spot) => spot.id === selectedSpotId);

    if (!map || !selected) {
      return;
    }

    map.panTo([selected.lat, selected.lng], { animate: true, duration: 0.45 });
  }, [selectedSpotId, spots]);

  return <div ref={containerRef} className="map-canvas" aria-label="Lore map" />;
}
