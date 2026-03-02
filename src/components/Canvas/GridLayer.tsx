type Props = {
  width: number;
  height: number;
  pixelsPerMeter: number;
  zoom: number;
};

export function GridLayer({ width, height, pixelsPerMeter, zoom }: Props) {
  const safeSpacing = Number.isFinite(pixelsPerMeter) && pixelsPerMeter > 0 ? pixelsPerMeter : 20;
  const gridSpacing = Math.max(1, safeSpacing);
  const majorGridEvery = 5; // every 5 minor grids = major grid
  const maxLinesPerAxis = 5000;
  const verticalLineCount = Math.min(maxLinesPerAxis, Math.floor(width / gridSpacing));
  const horizontalLineCount = Math.min(maxLinesPerAxis, Math.floor(height / gridSpacing));
  const lines: React.ReactNode[] = [];

  // Vertical lines
  for (let count = 0; count <= verticalLineCount; count++) {
    const x = Math.min(width, count * gridSpacing);
    const isMajor = count % majorGridEvery === 0;
    lines.push(
      <line
        key={`v${count}`}
        x1={x} y1={0}
        x2={x} y2={height}
        stroke={isMajor ? '#cbd5e1' : '#e2e8f0'}
        strokeWidth={isMajor ? 0.5 / zoom : 0.3 / zoom}
      />,
    );
  }

  // Horizontal lines
  for (let count = 0; count <= horizontalLineCount; count++) {
    const y = Math.min(height, count * gridSpacing);
    const isMajor = count % majorGridEvery === 0;
    lines.push(
      <line
        key={`h${count}`}
        x1={0} y1={y}
        x2={width} y2={y}
        stroke={isMajor ? '#cbd5e1' : '#e2e8f0'}
        strokeWidth={isMajor ? 0.5 / zoom : 0.3 / zoom}
      />,
    );
  }

  return <g>{lines}</g>;
}
