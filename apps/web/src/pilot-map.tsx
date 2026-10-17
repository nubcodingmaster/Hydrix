import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Layers, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/motion/button';
import type { Plot } from './data/live';

export default function PilotMap({ plots, selected, onSelect, onDismiss }: { plots: Plot[]; selected: Plot | null; onSelect: (id: string) => void; onDismiss: () => void }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const callback = useRef(onSelect); callback.current = onSelect;
  const dismiss = useRef(onDismiss); dismiss.current = onDismiss;
  const [failed, setFailed] = useState(false);
  const [basemap, setBasemap] = useState(true);
  useEffect(() => {
    if (!container.current || !plots.length) return;
    const instance = new maplibregl.Map({ container: container.current, center: [108.27, -6.88], zoom: 11, attributionControl: { compact: true }, style: { version: 8, sources: { base: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap contributors' } }, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#f2f4ef' } }, { id: 'base', type: 'raster', source: 'base', paint: { 'raster-saturation': -.6, 'raster-opacity': .85 } }] } });
    map.current = instance;
    instance.on('error', () => setFailed(true));
    instance.on('load', () => {
      instance.addSource('plots', { type: 'geojson', data: { type: 'FeatureCollection', features: plots.map(p => ({ type: 'Feature', properties: { id: p.id }, geometry: p.geometry })) } });
      instance.addLayer({ id: 'fields', type: 'fill', source: 'plots', paint: { 'fill-color': '#42775c', 'fill-opacity': .4 } });
      instance.addLayer({ id: 'outlines', type: 'line', source: 'plots', paint: { 'line-color': '#205b43', 'line-width': 1.5 } });
      // Survey boundaries remain at native scale; markers make small fields selectable.
      plots.forEach(p => {
        const marker = document.createElement('button');
        marker.className = 'map-marker real-field-marker';
        marker.setAttribute('aria-label', `Select ${p.name}`);
        marker.title = `${p.name} · ${p.district}`;
        marker.onclick = event => { event.stopPropagation(); callback.current(p.id); };
        new maplibregl.Marker({ element: marker }).setLngLat(p.center).addTo(instance);
      });
      instance.on('click', 'fields', event => {
        const id = event.features?.[0].properties?.id;
        if (id) callback.current(String(id));
      });
      instance.on('click', event => {
        if (!instance.queryRenderedFeatures(event.point, { layers: ['fields'] }).length) dismiss.current();
      });
      instance.on('mouseenter', 'fields', () => { instance.getCanvas().style.cursor = 'pointer'; });
      instance.on('mouseleave', 'fields', () => { instance.getCanvas().style.cursor = ''; });
      const bounds = new maplibregl.LngLatBounds();
      plots.forEach(p => bounds.extend(p.center));
      instance.fitBounds(bounds, { padding: 65, duration: 0, maxZoom: 13 });
    });
    const resize = new ResizeObserver(() => instance.resize());
    resize.observe(container.current);
    return () => { resize.disconnect(); instance.remove(); map.current = null; };
  }, [plots]);
  useEffect(() => {
    if (selected) map.current?.easeTo({ center: selected.center, duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 400 });
  }, [selected]);
  function toggleBase() {
    const next = !basemap;
    if (map.current?.getLayer('base')) map.current.setLayoutProperty('base', 'visibility', next ? 'visible' : 'none');
    setBasemap(next);
  }
  return <div className="map-wrap"><div ref={container} className="map-canvas" aria-label="Kementan survey polygons in Majalengka"/>
    <div className="map-top"><span className="map-pill">{plots.length} polygons · Kementan survey</span><Button size="sm" variant="secondary" onClick={toggleBase}><Layers size={14}/>{basemap ? 'Basemap' : 'No basemap'}</Button></div>
    <div className="map-zoom"><Button size="icon" variant="secondary" aria-label="Zoom in" onClick={() => map.current?.zoomIn()}><Plus size={16}/></Button><Button size="icon" variant="secondary" aria-label="Zoom out" onClick={() => map.current?.zoomOut()}><Minus size={16}/></Button></div>
    {failed && <span className="map-fallback">Basemap unavailable. Survey markers and polygons remain selectable.</span>}
    <div className="map-legend"><i/> Original survey boundaries · current conditions unconfirmed</div>
  </div>;
}
