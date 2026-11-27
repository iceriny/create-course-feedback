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
  bevelRatio: 0.42,
  minBevelWidth: 14,
  maxBevelWidth: 28,
  mapPixelLimit: 64_000,
  blur: 2.8,
  // Scale peaks dynamically with rim width; keeping all three channels above
  // the 0.324 fold threshold ensures symmetric, true-to-color caustic reflections
  // along both top and bottom bevels instead of dropping blue into yellow-green.
  redPeakRatio: 0.44,
  greenPeakRatio: 0.38,
  bluePeakRatio: 0.33,
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
};

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
      // Bell profile: 0 displacement and 0 slope at both outer edge (u=0) and
      // inner core (u=1), peaking smoothly at u=0.5 without folding back.
      const bell = 16 * u * u * (1 - u) * (1 - u);
      const strength = 127 * bell;
      const normalX = outside ? outsideX / outside : Number(dx >= dy);
      const normalY = outside ? outsideY / outside : Number(dy > dx);
      const index = (row * canvas.width + column) * 4;
      pixels.data[index] = Math.round(128 - Math.sign(x) * normalX * strength);
      pixels.data[index + 1] = 128;
      pixels.data[index + 2] = Math.round(
        128 - Math.sign(y) * normalY * strength,
      );
      pixels.data[index + 3] = 255;
    }
  }

  context.putImageData(pixels, 0, 0);
  return { href: canvas.toDataURL(), rim };
}

export default function LiquidGlass() {
  const surface = useRef<HTMLSpanElement>(null);
  const [map, setMap] = useState<GlassMap>();
  const filterId = `workbench-glass-${useId().replace(/[^\w-]/g, "")}`;

  useEffect(() => {
    const element = surface.current;
    // A reference filter can parse successfully without affecting the backdrop.
    if (
      !element ||
      !navigator.userAgent.includes("Chrome/") ||
      !CSS.supports("backdrop-filter", `url(#${filterId})`)
    )
      return;
    const observer = new ResizeObserver(
      ([
        {
          contentRect: { width, height },
        },
      ]) => {
        if (width < 1 || height < 1) return;
        const radius =
          parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0;
        setMap(createDisplacementMap(width, height, radius));
      },
    );
    observer.observe(element);
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
          width="0"
          height="0"
          focusable="false"
        >
          <defs>
            <filter
              id={filterId}
              x="0%"
              y="0%"
              width="100%"
              height="100%"
              colorInterpolationFilters="sRGB"
            >
              <feImage
                href={map.href}
                x="0"
                y="0"
                width="100%"
                height="100%"
                preserveAspectRatio="none"
                result="map"
              />
              <feGaussianBlur
                in="SourceGraphic"
                stdDeviation={glassConfig.blur}
                edgeMode="duplicate"
                result="baseBlur"
              />
              {channelSpecs.map(({ name, ratio, matrix }) => (
                <Fragment key={name}>
                  <feDisplacementMap
                    in="SourceGraphic"
                    in2="map"
                    scale={map.rim * ratio * 2}
                    xChannelSelector="R"
                    yChannelSelector="B"
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
              <feBlend in="rg" in2="blue" mode="screen" result="output" />
              <feGaussianBlur
                in="output"
                stdDeviation={glassConfig.blur}
                edgeMode="duplicate"
                result="dispBlur"
              />
              <feComposite in="dispBlur" in2="baseBlur" operator="over" />
            </filter>
          </defs>
        </svg>
      )}
    </span>
  );
}
