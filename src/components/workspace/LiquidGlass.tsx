import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import "./liquid-glass.css";

const glassConfig = {
  bevelRatio: 0.44,
  minBevelWidth: 16,
  maxBevelWidth: 28,
  mapPixelLimit: 64_000,
  // Subtle concave minification in the thin center (capped per axis so wide bars stay anchored).
  centerMinify: 0.025,
  maxCenterShiftX: 1.2,
  maxCenterShiftY: 1.0,
  // Symmetric convex bevel peak ratios relative to rim width (zero shift at u=0 and u=1).
  // Moderate RGB spread (~3.6px at bevel peak, 0px in center) gives vivid yet refined prism edges.
  redPeakRatio: 0.37,
  greenPeakRatio: 0.28,
  bluePeakRatio: 0.19,
} as const;

const channelSpecs = [
  {
    name: "red",
    ratio: glassConfig.redPeakRatio,
    matrix: "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0",
  },
  {
    name: "green",
    ratio: glassConfig.greenPeakRatio,
    matrix: "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0",
  },
  {
    name: "blue",
    ratio: glassConfig.bluePeakRatio,
    matrix: "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0",
  },
] as const;

type GlassMap = {
  href: string;
  rim: number;
  maxShift: number;
};

const softCap = (value: number, limit: number) =>
  limit * Math.tanh(value / limit);

function createDisplacementMap(
  width: number,
  height: number,
  radius: number,
): GlassMap | undefined {
  const resolution = Math.min(
    1,
    Math.sqrt(glassConfig.mapPixelLimit / (width * height)),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width * resolution));
  canvas.height = Math.max(1, Math.ceil(height * resolution));
  const context = canvas.getContext("2d");
  if (!context) return;

  const pixels = context.createImageData(canvas.width, canvas.height);
  const minDimension = Math.min(width, height);
  const corner = Math.min(radius, width / 2, height / 2);
  const rim = Math.max(
    glassConfig.minBevelWidth,
    Math.min(glassConfig.maxBevelWidth, minDimension * glassConfig.bevelRatio),
  );
  // Encode normalized displacement in [-1, 1] relative to maxShift = rim * greenPeakRatio.
  const basePeak = rim * glassConfig.greenPeakRatio;
  const maxShift = Math.max(1, basePeak);

  for (let row = 0; row < canvas.height; row++) {
    const y = ((row + 0.5) / canvas.height - 0.5) * height;
    const dy = Math.abs(y) - (height / 2 - corner);
    for (let column = 0; column < canvas.width; column++) {
      const x = ((column + 0.5) / canvas.width - 0.5) * width;
      const dx = Math.abs(x) - (width / 2 - corner);
      const outsideX = Math.max(dx, 0);
      const outsideY = Math.max(dy, 0);
      const outside = Math.hypot(outsideX, outsideY);
      const depth = corner - outside - Math.min(Math.max(dx, dy), 0);
      const u = Math.min(1, Math.max(0, depth) / rim);

      // Convex rim bevel: zero at outer border (u=0) and inner core (u=1), curving inward at u=0.5.
      const bell = 16 * u * u * (1 - u) * (1 - u);
      const normalX = outside ? outsideX / outside : Number(dx >= dy);
      const normalY = outside ? outsideY / outside : Number(dy > dx);
      const bevelX = -Math.sign(x) * normalX * basePeak * bell;
      const bevelY = -Math.sign(y) * normalY * basePeak * bell;

      // Subtle concave dish in the center (smoothly ramps in as u -> 1, 0 at center point).
      const centerWeight = u * u * (3 - 2 * u);
      const dishX =
        centerWeight *
        softCap(x * glassConfig.centerMinify, glassConfig.maxCenterShiftX);
      const dishY =
        centerWeight *
        softCap(y * glassConfig.centerMinify, glassConfig.maxCenterShiftY);

      const shiftX = Math.max(-1, Math.min(1, (bevelX + dishX) / maxShift));
      const shiftY = Math.max(-1, Math.min(1, (bevelY + dishY) / maxShift));

      const index = (row * canvas.width + column) * 4;
      pixels.data[index] = Math.round(128 + shiftX * 127);
      pixels.data[index + 1] = Math.round(128 + shiftY * 127);
      pixels.data[index + 2] = 128;
      pixels.data[index + 3] = 255;
    }
  }

  context.putImageData(pixels, 0, 0);
  return { href: canvas.toDataURL(), rim, maxShift };
}

export default function LiquidGlass() {
  const surface = useRef<HTMLSpanElement>(null);
  const [map, setMap] = useState<GlassMap>();
  const filterId = `workbench-glass-${useId().replace(/[^\w-]/g, "")}`;

  useEffect(() => {
    const element = surface.current;
    // Only Chromium supports SVG url() inside backdrop-filter on live DOM.
    if (
      !element ||
      !navigator.userAgent.includes("Chrome/") ||
      !CSS.supports("backdrop-filter", `url(#${filterId})`)
    )
      return;

    const update = () => {
      const rect = element.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const radius =
        parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0;
      setMap(createDisplacementMap(rect.width, rect.height, radius));
    };

    const observer = new ResizeObserver(update);
    observer.observe(element);
    update();
    return () => observer.disconnect();
  }, [filterId]);

  return (
    <span
      ref={surface}
      className="liquid-glass"
      aria-hidden="true"
      data-refractive={Boolean(map)}
      style={{ "--glass-filter": `url(#${filterId})` } as CSSProperties}
    >
      {map && (
        <svg
          className="liquid-glass-definitions"
          xmlns="http://www.w3.org/2000/svg"
          focusable="false"
        >
          <defs>
            <filter
              id={filterId}
              colorInterpolationFilters="sRGB"
              x="0%"
              y="0%"
              width="100%"
              height="100%"
            >
              <feImage
                href={map.href}
                preserveAspectRatio="none"
                result="map"
              />
              {channelSpecs.map(({ name, ratio, matrix }) => (
                <Fragment key={name}>
                  <feDisplacementMap
                    in="SourceGraphic"
                    in2="map"
                    scale={
                      map.maxShift * (ratio / glassConfig.greenPeakRatio) * 2
                    }
                    xChannelSelector="R"
                    yChannelSelector="G"
                    result={`disp-${name}`}
                  />
                  <feColorMatrix
                    in={`disp-${name}`}
                    type="matrix"
                    values={matrix}
                    result={name}
                  />
                </Fragment>
              ))}
              <feBlend in="red" in2="green" mode="screen" result="rg" />
              <feBlend in="rg" in2="blue" mode="screen" />
            </filter>
          </defs>
        </svg>
      )}
    </span>
  );
}
