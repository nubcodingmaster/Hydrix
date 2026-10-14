import { fromUrl } from 'geotiff';
/** Read native pixels at supplied WGS84 centers; never resample missing values. */
export async function sampleRaster(url, plots, { scaled = false } = {}) {
  const signal = AbortSignal.timeout(90000);
  const tiff = await fromUrl(url, { allowFullFile: false }, signal);
  const image = await tiff.getImage();
  const origin = image.getOrigin(), resolution = image.getResolution();
  const bandMetadata = await image.getGDALMetadata(0) || {};
  const scale = scaled ? Number(bandMetadata.SCALE ?? 1) : 1;
  const offset = scaled ? Number(bandMetadata.OFFSET ?? 0) : 0;
  const nodata = image.getGDALNoData();
  const pixels = plots.map(p => [Math.floor((p.center[0] - origin[0]) / resolution[0]), Math.floor((p.center[1] - origin[1]) / resolution[1])]);
  if (pixels.some(([x,y]) => x < 0 || y < 0 || x >= image.getWidth() || y >= image.getHeight())) throw new Error(`Source raster does not cover the pilot: ${url}`);
  const x0 = Math.min(...pixels.map(p => p[0])), y0 = Math.min(...pixels.map(p => p[1]));
  const x1 = Math.max(...pixels.map(p => p[0])) + 1, y1 = Math.max(...pixels.map(p => p[1])) + 1;
  const raster = await image.readRasters({ window: [x0,y0,x1,y1], samples: [0], signal });
  return { origin, resolution, scale, offset, nodata, samples: plots.map((plot,index) => {
    const [x,y] = pixels[index];
    const raw = Number(raster[0][(y-y0)*raster.width+x-x0]);
    const value = Number.isFinite(raw) && raw !== nodata && raw >= 0 ? Number((raw*scale+offset).toFixed(2)) : null;
    return { id: plot.id, pixel: `${x}:${y}`, value };
  }) };
}
