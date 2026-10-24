"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { X, Navigation } from "lucide-react";
import {
  RECYCLE_KINDS,
  RECYCLE_SITES,
  kindTotal,
  type RecycleKind,
  type RecycleSite,
} from "../../lib/data/recycleSites";
import { COOPERATIVE_MAP_OPTIONS } from "../../lib/map/cooperative";
import { cn } from "../../lib/utils";

// Glass is the green igloo bin; paper and plastic are PAKOMAK's open wire-mesh
// cages, drawn in their colour (light infill, main frame, dark base).
const KIND_META: Record<
  RecycleKind,
  { label: string; full: string; light: string; main: string; dark: string }
> = {
  glass: { label: "Стакло", full: "Стаклена амбалажа", light: "#49cb5c", main: "#07b128", dark: "#028f5d" },
  paper: { label: "Хартија", full: "Хартија и картон", light: "#bfdbfe", main: "#2563eb", dark: "#1e40af" },
  plastic: { label: "Пластика", full: "Пластика и алуминиум", light: "#fef08a", main: "#eab308", dark: "#a16207" },
};

type Filter = "all" | RecycleKind;

// The recycle-bin marker artwork, inlined so each container drops as the bin
// itself (no image request). viewBox/paths are the source SVG, sized by its host.
const BIN_SVG = `<svg viewBox="0 -1 512 512" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><path d="m22.652344 479.8125v-293.132812c0-103.101563 83.195312-186.679688 185.824218-186.679688 102.628907 0 185.824219 83.578125 185.824219 186.679688v291.023437" fill="#49cb5c"/><path d="m208.476562 0c-8.535156 0-16.929687.589844-25.160156 1.710938 90.730469 12.335937 160.667969 90.441406 160.667969 184.96875v291.023437l-321.332031 1.824219v.285156l371.648437-2.109375v-291.023437c.003907-103.101563-83.195312-186.679688-185.824219-186.679688zm0 0" fill="#07b128"/><path d="m401.078125 509.933594h-385.203125c-8.769531 0-15.875-7.109375-15.875-15.875v-.367188c0-8.765625 7.105469-15.875 15.875-15.875h385.203125c8.769531 0 15.875 7.109375 15.875 15.875v.367188c0 8.765625-7.105469 15.875-15.875 15.875zm0 0" fill="#028f5d"/><g fill="#fff"><path d="m176.597656 353.445312h-25.140625c-5.457031 0-10.355469-2.835937-13.101562-7.582031-2.777344-4.800781-2.789063-10.535156-.027344-15.339843l20.0625-34.90625.476563 2.066406c.730468 3.152344 3.292968 5.394531 6.300781 5.871094.394531.0625.792969.101562 1.199219.101562.570312 0 1.152343-.0625 1.738281-.199219 4.144531-.953125 6.726562-5.089843 5.773437-9.234375l-4.527344-19.613281c-.929687-4.035156-4.886718-6.617187-8.957031-5.828125l-20.425781 3.929688c-4.175781.804687-6.910156 4.839843-6.105469 9.019531.804688 4.175781 4.84375 6.90625 9.019531 6.105469l2.488282-.480469-20.398438 35.492187c-5.53125 9.628906-5.515625 21.117188.046875 30.726563 5.535157 9.5625 15.417969 15.273437 26.4375 15.273437h25.140625c4.253906 0 7.699219-3.449218 7.699219-7.703125 0-4.253906-3.445313-7.699219-7.699219-7.699219zm0 0"/><path d="m169.402344 260.996094c3.691406 2.121094 8.398437.847656 10.515625-2.839844l.648437-1.125 14.78125-25.726562c2.746094-4.773438 7.652344-7.621094 13.128906-7.621094 5.480469 0 10.386719 2.847656 13.128907 7.621094l26.429687 45.988281-2.082031-.488281c-2.597656-.609376-5.195313.175781-7.007813 1.867187-1.082031 1.007813-1.886718 2.332031-2.246093 3.878906-.96875 4.140625 1.601562 8.285157 5.742187 9.253907l19.519532 4.5625c.585937.140624 1.175781.207031 1.757812.207031 3.398438 0 6.496094-2.265625 7.425781-5.679688l5.492188-20.148437c1.117187-4.101563-1.304688-8.335938-5.40625-9.457032-4.105469-1.117187-8.339844 1.304688-9.457031 5.40625l-.664063 2.4375-26.148437-45.5c-5.527344-9.613281-15.425782-15.351562-26.484376-15.351562-11.058593 0-20.957031 5.738281-26.484374 15.351562l-15.429688 26.847657c-2.117188 3.6875-.847656 8.394531 2.839844 10.515625zm0 0"/><path d="m291.980469 322.847656-9.921875-17.261718c-2.117188-3.6875-6.828125-4.960938-10.515625-2.839844s-4.957031 6.828125-2.839844 10.515625l.351563.609375 9.570312 16.652344c2.761719 4.804687 2.753906 10.539062-.023438 15.339843-2.746093 4.746094-7.644531 7.582031-13.105468 7.582031h-47.503906l1.992187-2.160156c1.148437-1.246094 1.796875-2.765625 1.976563-4.328125.277343-2.363281-.539063-4.820312-2.421876-6.554687-3.125-2.886719-8-2.6875-10.882812.441406l-13.613281 14.773438c-2.796875 3.03125-2.703125 7.726562.203125 10.652343l14.707031 14.769531c1.503906 1.511719 3.480469 2.269532 5.457031 2.269532 1.964844 0 3.929688-.75 5.433594-2.246094 3.011719-3 3.023438-7.875.023438-10.890625l-1.320313-1.324219h45.949219c11.019531 0 20.902344-5.707031 26.4375-15.269531 5.5625-9.613281 5.582031-21.101563.046875-30.730469zm0 0"/></g><path d="m64.972656 150.550781c32.585938 0 59.003906-27.753906 59.003906-61.992187 0-21.304688-10.230468-40.101563-25.8125-51.261719l-.519531-.464844c-33.019531 24.6875-57.589843 60.128907-68.59375 101.160157l1.675781 1.058593c9.65625 7.242188 21.476563 11.5 34.246094 11.5zm0 0" fill="#028f5d"/><path d="m469.207031 203.488281-.042969-47.875c-.003906-3.09375 2.503907-5.605469 5.597657-5.609375 3.097656-.003906 5.601562-2.515625 5.601562-5.609375l-.023437-23.363281c-.003906-3.097656-2.515625-5.605469-5.613282-5.601562l-53.71875.054687c-3.09375 0-5.601562 2.511719-5.597656 5.609375l.019532 23.363281c.003906 3.09375 2.515624 5.601563 5.613281 5.597657 3.09375 0 5.605469 2.507812 5.609375 5.601562l.046875 47.871094c.015625 17.066406-7.804688 33.195312-21.210938 43.753906-13.410156 10.554688-21.230469 26.683594-21.214843 43.75l.199218 202.914062c.007813 8.839844 7.179688 15.996094 16.019532 15.988282l95.519531-.09375c8.839843-.007813 15.996093-7.179688 15.988281-16.019532l-.195312-202.914062c-.019532-17.0625-7.871094-33.179688-21.300782-43.707031-13.429687-10.53125-21.277344-26.644531-21.296875-43.710938zm0 0" fill="#22b27f"/><path d="m439.089844 320.597656h72.910156v99.609375h-72.910156zm0 0" fill="#ffe469"/></svg>`;

// An open wire-mesh cage on the same 512 grid as the bin: see-through infill,
// a solid frame and rim, a mesh of bars and a ground bar like the bin's.
// (The mobile app's paper-/plastic-bin PNGs are rasterized from this.)
const meshSvg = ({ light, main, dark }: { light: string; main: string; dark: string }) => {
  const bars = [140, 216, 296, 372]
    .map((x) => `<path d="M${x} 124V478"/>`)
    .concat([206, 288, 370].map((y) => `<path d="M60 ${y}H452"/>`))
    .join("");
  return `<svg viewBox="0 0 512 512" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><rect x="60" y="110" width="392" height="368" fill="${light}" fill-opacity="0.75"/><g stroke="${main}" stroke-width="14" stroke-linecap="round">${bars}</g><rect x="60" y="110" width="392" height="368" fill="none" stroke="${main}" stroke-width="28" stroke-linejoin="round"/><rect x="36" y="78" width="440" height="52" rx="14" fill="${dark}"/><rect x="16" y="478" width="480" height="32" rx="16" fill="${dark}"/></svg>`;
};

const binSvg = (kind: RecycleKind) => (kind === "glass" ? BIN_SVG : meshSvg(KIND_META[kind]));

// Prilep bounding box — users can't pan outside the city (same lock the issue map
// and bus map use).
const PRILEP_BOUNDS: [[number, number], [number, number]] = [
  [21.44, 41.28], // SW
  [21.67, 41.42], // NE
];

// Open Google Maps walking directions to a container. When we know the visitor's
// location we pass it as the explicit origin; otherwise Google Maps resolves
// "current location" itself.
function openDirections(dest: RecycleSite, origin: [number, number] | null) {
  const o = origin ? `&origin=${origin[1]},${origin[0]}` : "";
  const url = `https://www.google.com/maps/dir/?api=1${o}&destination=${dest.lat},${dest.lng}&travelmode=walking`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function distMeters(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
// "240 м" under a km, "1.2 км" above.
function fmtDist(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10} м` : `${(m / 1000).toFixed(1)} км`;
}

// The kinds at a site that the current filter shows.
function visibleKinds(site: RecycleSite, filter: Filter): RecycleKind[] {
  return RECYCLE_KINDS.filter((k) => site.counts[k] > 0 && (filter === "all" || filter === k));
}

function createMarkerEl(kinds: RecycleKind[]) {
  // One bin per kind, standing side by side, every bin the same size whether
  // it stands alone or in a group. The group scales up on hover without
  // moving its base.
  const size = 30;
  const wrapper = document.createElement("div");
  wrapper.style.cssText = `
    height:${size}px;
    display:flex;align-items:flex-end;justify-content:center;
    cursor:pointer;
    filter:drop-shadow(0 1px 2px rgba(0,0,0,0.35));
  `;

  const group = document.createElement("div");
  group.style.cssText = `
    display:flex;align-items:flex-end;gap:1px;
    transform-origin:bottom center;
    transition:transform 0.12s ease;
    pointer-events:none;
  `;
  for (const k of kinds) {
    const bin = document.createElement("div");
    bin.style.cssText = `width:${size}px;height:${size}px;`;
    bin.innerHTML = binSvg(k);
    group.appendChild(bin);
  }

  wrapper.appendChild(group);
  wrapper.addEventListener("mouseenter", () => {
    group.style.transform = "scale(1.25)";
  });
  wrapper.addEventListener("mouseleave", () => {
    group.style.transform = "scale(1)";
  });
  return wrapper;
}

export default function RecycleMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [selected, setSelected] = useState<RecycleSite | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  // The visitor's location once they use the locate control — powers the
  // distance line and the directions origin. Null until granted.
  const [userLoc, setUserLoc] = useState<[number, number] | null>(null);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://tiles.openfreemap.org/styles/positron",
      center: [21.5551, 41.3458],
      zoom: 13,
      minZoom: 11,
      maxZoom: 19,
      maxBounds: PRILEP_BOUNDS,
      attributionControl: { compact: true },
      ...COOPERATIVE_MAP_OPTIONS,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    // Locate button + pulsing "you are here" dot, tracking the visitor. We also
    // capture the coordinates so directions can pass a precise origin.
    const geo = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserLocation: true,
    });
    map.addControl(geo, "top-right");
    geo.on("geolocate", (e: GeolocationPosition) => {
      setUserLoc([e.coords.longitude, e.coords.latitude]);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // (Re)drop the markers for the sites the filter shows.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    RECYCLE_SITES.forEach((s) => {
      const kinds = visibleKinds(s, filter);
      if (kinds.length === 0) return;
      const el = createMarkerEl(kinds);
      // Anchor the bins' base on the coordinate so they "stand" on their spot.
      const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([s.lng, s.lat])
        .addTo(map);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelected(s);
      });
      markersRef.current.push(marker);
    });
  }, [filter]);

  const selectedDist =
    selected && userLoc
      ? distMeters(userLoc, [selected.lng, selected.lat])
      : null;

  const popupCard = selected && (
    <>
      {selected.photos && selected.photos.length > 0 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={selected.photos[0]}
          alt={selected.name}
          className="h-32 w-full object-cover"
        />
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-snug text-zinc-800">
              {selected.name}
            </p>
            {selectedDist !== null && (
              <p className="mt-0.5 text-xs text-zinc-500">
                {fmtDist(selectedDist)} од вас
              </p>
            )}
          </div>
          <button
            onClick={() => setSelected(null)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100"
            aria-label="Затвори">
            <X size={13} />
          </button>
        </div>

        {/* What can be thrown here */}
        <ul className="mt-3 space-y-1.5">
          {RECYCLE_KINDS.filter((k) => selected.counts[k] > 0).map((k) => (
            <li key={k} className="flex items-center gap-2 text-xs text-zinc-700">
              <span
                className="inline-block h-5 w-5 shrink-0"
                dangerouslySetInnerHTML={{ __html: binSvg(k) }}
              />
              <span className="flex-1 font-medium">{KIND_META[k].full}</span>
              {selected.counts[k] > 1 && (
                <span className="text-zinc-400">×{selected.counts[k]}</span>
              )}
            </li>
          ))}
        </ul>

        {/* Take-me-there — opens Google Maps directions, with the visitor's
            location as origin when the locate control has been used. */}
        <button
          onClick={() => openDirections(selected, userLoc)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700">
          <Navigation size={15} />
          Однеси ме
        </button>
      </div>
    </>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Filters — double as the legend */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Филтер по вид контејнер">
        {(["all", ...RECYCLE_KINDS] as Filter[]).map((f) => {
          const active = filter === f;
          return (
            <button
              key={f}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setFilter(f);
                setSelected(null);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                active
                  ? "border-zinc-800 bg-zinc-800 text-white"
                  : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400",
              )}>
              {f === "all" ? (
                "Сите"
              ) : (
                <>
                  <span
                    className="inline-block h-4 w-4 shrink-0"
                    dangerouslySetInnerHTML={{ __html: binSvg(f) }}
                  />
                  {KIND_META[f].label}
                  <span className={active ? "text-white/60" : "text-zinc-400"}>
                    {kindTotal(f)}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Map frame */}
      <div className="relative h-125 overflow-hidden rounded-2xl border border-zinc-200">
        <div
          ref={containerRef}
          className="h-full w-full"
          onClick={() => setSelected(null)}
        />

        {/* Container popup — left-docked & vertically centered on desktop
            (soft slide-in from the left), bottom drawer on mobile.
            Mirrors the bus map's pp-panel-left / pp-panel-up behavior. */}
        {selected && (
          <>
            {/* Desktop: left middle */}
            <div
              className="pp-panel-left absolute top-0 bottom-0 left-3 z-20 my-auto hidden h-fit w-72 max-w-[calc(100%-1.5rem)] overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-2xl lg:block"
              onClick={(e) => e.stopPropagation()}>
              {popupCard}
            </div>
            {/* Mobile: bottom drawer */}
            <div
              className="pp-panel-up absolute right-4 bottom-4 left-4 z-20 overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-2xl lg:hidden"
              onClick={(e) => e.stopPropagation()}>
              {popupCard}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
