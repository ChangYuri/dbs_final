"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type L from "leaflet";
import type { FillExtrusionLayerSpecification, MapLayerMouseEvent, Map as MapLibreMap, Marker, StyleSpecification } from "maplibre-gl";
import type { LocationPoint, Spot } from "@/lib/spots";

export type MapVariant = "standard" | "three-d";

type LoreMapProps = {
  center: LocationPoint;
  spots: Spot[];
  selectedSpotId: string | null;
  onSelectSpot: (spot: Spot) => void;
  userLocation: LocationPoint | null;
  pinnedLocation: LocationPoint | null;
  onMapClick?: (location: LocationPoint) => void;
  onCenterChange?: (location: LocationPoint) => void;
  variant?: MapVariant;
};

type MapImplementationProps = Omit<LoreMapProps, "variant">;

const STANDARD_ZOOM = 15;
const THREE_D_ZOOM = 15.65;
const THREE_D_SELECTED_ZOOM = 16.6;
const THREE_D_PITCH = 70;
const THREE_D_SELECTED_PITCH = 73;
const THREE_D_BEARING = -32;
const THREE_D_SELECTED_BEARING_SHIFT = -10;
const THREE_D_BUILDING_SOURCE_ID = "openfreemap";
const THREE_D_BUILDING_LAYER_ID = "3d-buildings";
const THREE_D_BUILDING_SOURCE_URL = "https://tiles.openfreemap.org/planet";
const THREE_D_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
        "https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png"
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: {
        "background-color": "#eceae3"
      }
    },
    {
      id: "carto",
      type: "raster",
      source: "carto",
      paint: {
        "raster-opacity": 0.98,
        "raster-resampling": "linear",
        "raster-saturation": -0.12,
        "raster-contrast": 0.05
      }
    }
  ]
};

function findFirstLabelLayerId(map: MapLibreMap) {
  const layers = map.getStyle().layers;

  if (!layers) {
    return undefined;
  }

  return layers.find((layer) => layer.type === "symbol" && "text-field" in (layer.layout ?? {}))?.id;
}

function ensureThreeDBuildingsLayer(map: MapLibreMap) {
  if (!map.getSource(THREE_D_BUILDING_SOURCE_ID)) {
    map.addSource(THREE_D_BUILDING_SOURCE_ID, {
      type: "vector",
      url: THREE_D_BUILDING_SOURCE_URL
    });
  }

  if (map.getLayer(THREE_D_BUILDING_LAYER_ID)) {
    return;
  }

  const labelLayerId = findFirstLabelLayerId(map);

  const layer: FillExtrusionLayerSpecification = {
    id: THREE_D_BUILDING_LAYER_ID,
    type: "fill-extrusion",
    source: THREE_D_BUILDING_SOURCE_ID,
    "source-layer": "building",
    minzoom: 15,
    filter: ["!=", ["get", "hide_3d"], true],
    paint: {
      "fill-extrusion-color": [
        "interpolate",
        ["linear"],
        ["get", "render_height"],
        0,
        "#cfc7b8",
        80,
        "#b39d73",
        200,
        "#8d6e63",
        400,
        "#5d4037"
      ],
      "fill-extrusion-height": [
        "interpolate",
        ["linear"],
        ["zoom"],
        15,
        0,
        16,
        ["coalesce", ["get", "render_height"], ["get", "height"], 0]
      ],
      "fill-extrusion-base": [
        "interpolate",
        ["linear"],
        ["zoom"],
        15,
        0,
        16,
        ["coalesce", ["get", "render_min_height"], ["get", "min_height"], 0]
      ],
      "fill-extrusion-opacity": 0.88,
      "fill-extrusion-vertical-gradient": true
    }
  };

  map.addLayer(layer, labelLayerId);
}

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");

    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function createStandardSpotIcon(leaflet: typeof L, spot: Spot, selected: boolean) {
  const themeClass = spot.theme ? ` theme-${spot.theme}` : "";

  return leaflet.divIcon({
    html: `<span class="lore-marker standard${selected ? " is-selected" : ""}${themeClass}" aria-hidden="true"><span class="lore-marker-core"></span></span>`,
    className: "lore-marker-wrap",
    iconSize: selected ? [28, 28] : [18, 18],
    iconAnchor: selected ? [14, 14] : [9, 9]
  });
}

function createThreeDSpotMarkerElement(spot: Spot, selected: boolean) {
  const marker = document.createElement("button");
  const themeClass = spot.theme ? ` theme-${spot.theme}` : "";

  marker.className = `lore-marker three-d${selected ? " is-selected" : ""}${themeClass}`;
  marker.type = "button";
  marker.setAttribute("aria-label", spot.title);

  const core = document.createElement("span");
  core.className = "lore-marker-core";
  marker.appendChild(core);

  return marker;
}

function createLocationMarkerElement() {
  const marker = document.createElement("span");
  marker.className = "lore-location-marker";
  marker.setAttribute("aria-hidden", "true");
  marker.innerHTML = '<span class="lore-location-ring"></span><span class="lore-location-core"></span>';

  return marker;
}

function createPinnedMarkerElement() {
  const marker = document.createElement("span");
  marker.className = "lore-pinned-marker";
  marker.setAttribute("aria-hidden", "true");
  marker.innerHTML = '<span class="lore-pinned-marker-tip"></span><span class="lore-pinned-marker-core"></span>';

  return marker;
}

function StandardLoreMap({
  center,
  spots,
  selectedSpotId,
  onSelectSpot,
  userLocation,
  pinnedLocation,
  onMapClick,
  onCenterChange
}: MapImplementationProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const locationLayerRef = useRef<L.LayerGroup | null>(null);
  const pinnedLayerRef = useRef<L.LayerGroup | null>(null);
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
      }).setView([center.lat, center.lng], STANDARD_ZOOM);

      leaflet.default.control.zoom({ position: "topright" }).addTo(map);
      leaflet.default.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
        updateWhenIdle: false,
        keepBuffer: 4
      }).addTo(map);

      markerLayerRef.current = leaflet.default.layerGroup().addTo(map);
      locationLayerRef.current = leaflet.default.layerGroup().addTo(map);
      pinnedLayerRef.current = leaflet.default.layerGroup().addTo(map);
      mapRef.current = map;
      setMapReady(true);

      window.setTimeout(() => map.invalidateSize(), 0);
    });

    return () => {
      disposed = true;
      setMapReady(false);
      mapRef.current?.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      locationLayerRef.current = null;
      pinnedLayerRef.current = null;
      hasInitializedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const map = mapRef.current;

    if (!container || !map || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [mapReady]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    if (!hasInitializedRef.current) {
      map.setView([center.lat, center.lng], STANDARD_ZOOM, { animate: false });
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

        leaflet.default.marker([spot.lat, spot.lng], {
          icon: createStandardSpotIcon(leaflet.default, spot, selected),
          keyboard: true,
          title: spot.title
        })
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
      leaflet.default.marker([userLocation.lat, userLocation.lng], {
        icon: leaflet.default.divIcon({
          html:
            '<span class="lore-location-marker" aria-hidden="true">' +
            '<span class="lore-location-ring"></span>' +
            '<span class="lore-location-core"></span>' +
            "</span>",
          className: "lore-location-wrap",
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        }),
        keyboard: false,
        title: "Current location"
      }).addTo(layer);
    });
  }, [mapReady, userLocation]);

  useEffect(() => {
    const layer = pinnedLayerRef.current;

    if (!mapReady || !layer) {
      return;
    }

    layer.clearLayers();

    if (!pinnedLocation) {
      return;
    }

    void import("leaflet").then((leaflet) => {
      leaflet.default.marker([pinnedLocation.lat, pinnedLocation.lng], {
        icon: leaflet.default.divIcon({
          html:
            '<span class="lore-pinned-marker" aria-hidden="true">' +
            '<span class="lore-pinned-marker-tip"></span>' +
            '<span class="lore-pinned-marker-core"></span>' +
            "</span>",
          className: "lore-pinned-wrap",
          iconSize: [28, 38],
          iconAnchor: [14, 34]
        }),
        keyboard: false,
        title: "Pinned location"
      }).addTo(layer);
    });
  }, [mapReady, pinnedLocation]);

  useEffect(() => {
    const map = mapRef.current;
    const selected = spots.find((spot) => spot.id === selectedSpotId);

    if (!map || !selected) {
      return;
    }

    map.panTo([selected.lat, selected.lng], { animate: true, duration: 0.45 });
  }, [selectedSpotId, spots]);

  useEffect(() => {
    const map = mapRef.current;

    if (!mapReady || !map || !onCenterChange) {
      return;
    }

    const emitCenter = () => {
      const nextCenter = map.getCenter();

      onCenterChange({
        lat: nextCenter.lat,
        lng: nextCenter.lng,
        label: "Pinned location"
      });
    };

    map.on("moveend", emitCenter);
    emitCenter();

    return () => {
      map.off("moveend", emitCenter);
    };
  }, [mapReady, onCenterChange]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !onMapClick) {
      return;
    }

    const handleMapClick = (event: L.LeafletMouseEvent) => {
      onMapClick({
        lat: event.latlng.lat,
        lng: event.latlng.lng,
        label: "Pinned location"
      });
    };

    map.on("click", handleMapClick);

    return () => {
      map.off("click", handleMapClick);
    };
  }, [onMapClick]);

  return <div ref={containerRef} className={`map-canvas standard${onMapClick ? " is-pinnable" : ""}`} aria-label="Lore map" />;
}

function ThreeDLoreMap({
  center,
  spots,
  selectedSpotId,
  onSelectSpot,
  userLocation,
  pinnedLocation,
  onMapClick,
  onCenterChange
}: MapImplementationProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const spotMarkersRef = useRef<Marker[]>([]);
  const userMarkerRef = useRef<Marker | null>(null);
  const pinnedMarkerRef = useRef<Marker | null>(null);
  const hasInitializedRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);

  const selectedSpot = useMemo(
    () => spots.find((spot) => spot.id === selectedSpotId) ?? null,
    [selectedSpotId, spots]
  );

  useEffect(() => {
    if (mapFailed || !containerRef.current || mapRef.current) {
      return;
    }

    let disposed = false;

    void import("maplibre-gl").then((maplibre) => {
      if (disposed || !containerRef.current || mapRef.current) {
        return;
      }

      if (!supportsWebGL()) {
        setMapFailed(true);
        return;
      }

      let map: MapLibreMap;

      try {
        map = new maplibre.Map({
          container: containerRef.current,
          style: THREE_D_STYLE,
          center: [center.lng, center.lat],
          zoom: THREE_D_ZOOM,
          pitch: THREE_D_PITCH,
          bearing: THREE_D_BEARING,
          maxPitch: 78,
          canvasContextAttributes: {
            antialias: true
          },
          attributionControl: {
            compact: true
          }
        });
      } catch {
        setMapFailed(true);
        return;
      }

      map.addControl(
        new maplibre.NavigationControl({
          visualizePitch: true
        }),
        "top-right"
      );

      map.once("load", () => {
        if (disposed) {
          return;
        }

        try {
          ensureThreeDBuildingsLayer(map);
        } catch {
          // Keep the pitched map usable even if the external building tiles fail.
        }

        map.resize();
        setMapReady(true);
      });

      mapRef.current = map;

      window.setTimeout(() => map.resize(), 0);
    }).catch(() => {
      setMapFailed(true);
    });

    return () => {
      disposed = true;
      setMapReady(false);
      spotMarkersRef.current.forEach((marker) => marker.remove());
      spotMarkersRef.current = [];
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      pinnedMarkerRef.current?.remove();
      pinnedMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      hasInitializedRef.current = false;
    };
  }, [mapFailed]);

  useEffect(() => {
    const map = mapRef.current;

    if (!mapReady || !map) {
      return;
    }

    if (!hasInitializedRef.current) {
      map.jumpTo({
        center: [center.lng, center.lat],
        zoom: THREE_D_ZOOM,
        pitch: THREE_D_PITCH,
        bearing: THREE_D_BEARING
      });
      hasInitializedRef.current = true;
      return;
    }

    map.easeTo({
      center: [center.lng, center.lat],
      zoom: Math.max(map.getZoom(), THREE_D_ZOOM),
      pitch: THREE_D_PITCH,
      bearing: map.getBearing(),
      duration: 800,
      essential: true
    });
  }, [center.lat, center.lng, mapReady]);

  useEffect(() => {
    const container = containerRef.current;
    const map = mapRef.current;

    if (!container || !map || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      map.resize();
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [mapReady]);

  useEffect(() => {
    const map = mapRef.current;

    if (!mapReady || !map) {
      return;
    }

    spotMarkersRef.current.forEach((marker) => marker.remove());
    spotMarkersRef.current = [];

    void import("maplibre-gl").then((maplibre) => {
      if (!mapRef.current) {
        return;
      }

      spotMarkersRef.current = spots.map((spot) => {
        const selected = spot.id === selectedSpotId;
        const element = createThreeDSpotMarkerElement(spot, selected);

        element.addEventListener("click", (event) => {
          event.stopPropagation();
          onSelectSpot(spot);
        });

        return new maplibre.Marker({
          element,
          anchor: "center",
          pitchAlignment: "map",
          rotationAlignment: "map"
        })
          .setLngLat([spot.lng, spot.lat])
          .addTo(map);
      });
    });
  }, [mapReady, onSelectSpot, selectedSpotId, spots]);

  useEffect(() => {
    const map = mapRef.current;

    if (!mapReady || !map) {
      return;
    }

    userMarkerRef.current?.remove();
    userMarkerRef.current = null;

    if (!userLocation) {
      return;
    }

    void import("maplibre-gl").then((maplibre) => {
      if (!mapRef.current) {
        return;
      }

      userMarkerRef.current = new maplibre.Marker({
        element: createLocationMarkerElement(),
        anchor: "center",
        pitchAlignment: "map",
        rotationAlignment: "map"
      })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(map);
    });
  }, [mapReady, userLocation]);

  useEffect(() => {
    const map = mapRef.current;

    if (!mapReady || !map) {
      return;
    }

    pinnedMarkerRef.current?.remove();
    pinnedMarkerRef.current = null;

    if (!pinnedLocation) {
      return;
    }

    void import("maplibre-gl").then((maplibre) => {
      if (!mapRef.current) {
        return;
      }

      pinnedMarkerRef.current = new maplibre.Marker({
        element: createPinnedMarkerElement(),
        anchor: "bottom",
        pitchAlignment: "map",
        rotationAlignment: "map"
      })
        .setLngLat([pinnedLocation.lng, pinnedLocation.lat])
        .addTo(map);
    });
  }, [mapReady, pinnedLocation]);

  useEffect(() => {
    const map = mapRef.current;

    if (!mapReady || !map || !selectedSpot) {
      return;
    }

    map.flyTo({
      center: [selectedSpot.lng, selectedSpot.lat],
      zoom: Math.max(map.getZoom(), THREE_D_SELECTED_ZOOM),
      pitch: THREE_D_SELECTED_PITCH,
      bearing: map.getBearing() + THREE_D_SELECTED_BEARING_SHIFT,
      speed: 0.75,
      curve: 1.2,
      essential: true
    });
  }, [mapReady, selectedSpot]);

  useEffect(() => {
    const map = mapRef.current;

    if (!mapReady || !map || !onCenterChange) {
      return;
    }

    const emitCenter = () => {
      const nextCenter = map.getCenter();

      onCenterChange({
        lat: nextCenter.lat,
        lng: nextCenter.lng,
        label: "Pinned location"
      });
    };

    map.on("moveend", emitCenter);
    emitCenter();

    return () => {
      map.off("moveend", emitCenter);
    };
  }, [mapReady, onCenterChange]);

  useEffect(() => {
    const map = mapRef.current;

    if (!mapReady || !map || !onMapClick) {
      return;
    }

    const handleMapClick = (event: MapLayerMouseEvent) => {
      onMapClick({
        lat: event.lngLat.lat,
        lng: event.lngLat.lng,
        label: "Pinned location"
      });
    };

    map.on("click", handleMapClick);

    return () => {
      map.off("click", handleMapClick);
    };
  }, [mapReady, onMapClick]);

  if (mapFailed) {
    return (
      <StandardLoreMap
        center={center}
        spots={spots}
        selectedSpotId={selectedSpotId}
        onSelectSpot={onSelectSpot}
        userLocation={userLocation}
        pinnedLocation={pinnedLocation}
        onMapClick={onMapClick}
        onCenterChange={onCenterChange}
      />
    );
  }

  return <div ref={containerRef} className={`map-canvas three-d${onMapClick ? " is-pinnable" : ""}`} aria-label="Lore 3D map" />;
}

export default function LoreMap({ variant = "standard", ...props }: LoreMapProps) {
  return variant === "three-d" ? <ThreeDLoreMap {...props} /> : <StandardLoreMap {...props} />;
}
