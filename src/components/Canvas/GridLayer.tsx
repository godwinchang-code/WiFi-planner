type Props = {
  width: number;
  height: number;
  pixelsPerMeter: number;
  zoom: number;
};

export function GridLayer({ width, height, pixelsPerMeter, zoom }: Props) {
  // One grid cell = one metre in canvas units.  The SVG group's scale()
  // transform handles visual sizing, so the cell count is always
  //   floor(width / pixelsPerMeter) × floor(height / pixelsPerMeter)
  // — independent of zoom level.
  const gridSpacing = pixelsPerMeter;

  const majorGridEvery = 5; // every 5 minor grids = major grid
  const lines: React.ReactNode[] = [];

  // Vertical lines
  let x = 0;
  let count = 0;
  while (x <= width) {
    const isMajor = count % majorGridEvery === 0;
    lines.push(
      <line
        key={`v${x}`}
        x1={x} y1={0}
        x2={x} y2={height}
        stroke={isMajor ? '#cbd5e1' : '#e2e8f0'}
        strokeWidth={isMajor ? 0.5 / zoom : 0.3 / zoom}
      />,
    );
    x += gridSpacing;
    count++;
  }

  // Horizontal lines
  let y = 0;
  count = 0;
  while (y <= height) {
    const isMajor = count % majorGridEvery === 0;
    lines.push(
      <line
        key={`h${y}`}
        x1={0} y1={y}
        x2={width} y2={y}
        stroke={isMajor ? '#cbd5e1' : '#e2e8f0'}
        strokeWidth={isMajor ? 0.5 / zoom : 0.3 / zoom}
      />,
    );
    y += gridSpacing;
    count++;
  }

  return <g>{lines}</g>;
}
