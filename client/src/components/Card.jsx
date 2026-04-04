/**
 * Card.jsx
 * Renders a faithful SVG reproduction of a SET card.
 *
 * Props:
 *   card        – { number, color, shape, shading }
 *   selected    – bool
 *   highlighted – bool  (flash green on valid set)
 *   invalid     – bool  (flash red on invalid set)
 *   onClick     – fn
 *   disabled    – bool
 */

const COLOR_MAP = {
  red:    '#CC2222',
  green:  '#2A8A2A',
  purple: '#7722CC'
};

// ─── Shape paths (centered at 0,0, ~50×80 bounding box) ─────────────────────

const OVAL_EL = ({ fill, stroke, strokeWidth }) => (
  <ellipse cx="0" cy="0" rx="22" ry="36" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
);

const DIAMOND_EL = ({ fill, stroke, strokeWidth }) => (
  <polygon
    points="0,-38 24,0 0,38 -24,0"
    fill={fill} stroke={stroke} strokeWidth={strokeWidth}
  />
);

// S-shaped squiggle — outer then inner path, closed
const SQUIGGLE_PATH =
  'M 10,-42 C 24,-42 30,-24 24,-12 C 18,0 2,4 -2,18 C -6,30 0,42 14,42 ' +
  'C 2,44 -12,36 -10,22 C -8,8 6,2 10,-12 C 14,-26 8,-42 10,-42 Z';

const SQUIGGLE_EL = ({ fill, stroke, strokeWidth }) => (
  <path d={SQUIGGLE_PATH} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
);

const SHAPE_COMPONENTS = {
  oval:     OVAL_EL,
  diamond:  DIAMOND_EL,
  squiggle: SQUIGGLE_EL
};

// ─── Symbol positions per count ──────────────────────────────────────────────

const SYMBOL_Y = {
  1: [0],
  2: [-39, 39],
  3: [-78, 0, 78]
};

// ─── Individual symbol ────────────────────────────────────────────────────────

function Symbol({ shape, color, shading, patternId }) {
  const ShapeEl   = SHAPE_COMPONENTS[shape];
  const colorHex  = COLOR_MAP[color];

  let fill, stroke, strokeWidth;

  if (shading === 'solid') {
    fill        = colorHex;
    stroke      = colorHex;
    strokeWidth = 1.5;
  } else if (shading === 'open') {
    fill        = 'none';
    stroke      = colorHex;
    strokeWidth = 3;
  } else {
    // striped — fill with pattern, stroke outline
    fill        = `url(#${patternId})`;
    stroke      = colorHex;
    strokeWidth = 3;
  }

  return <ShapeEl fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export default function Card({ card, selected, highlighted, invalid, onClick, disabled }) {
  if (!card) return null;

  const { number, color, shape, shading } = card;
  const colorHex = COLOR_MAP[color];

  // Unique pattern id per card instance (color is sufficient — 3 patterns)
  const patternId = `stripe-${color}`;

  const cardW = 200;
  const cardH = 232;

  const yPositions = SYMBOL_Y[number];

  // Scale symbols slightly for 1/2/3 so they all fit nicely
  const scale = number === 3 ? 0.82 : number === 2 ? 0.9 : 1;

  let borderColor = '#ccc';
  let borderWidth = 3;
  let bgColor     = '#fff';

  if (selected)     { borderColor = '#f5c518'; borderWidth = 6; }
  if (highlighted)  { bgColor = '#d4f7d4'; borderColor = '#22aa22'; borderWidth = 6; }
  if (invalid)      { bgColor = '#fdd'; borderColor = '#cc0000'; borderWidth = 6; }

  return (
    <svg
      viewBox={`0 0 ${cardW} ${cardH}`}
      style={{ cursor: disabled ? 'default' : 'pointer', display: 'block', width: '100%', height: '100%' }}
      onClick={disabled ? undefined : onClick}
      role="button"
      aria-pressed={selected}
    >
      <defs>
        {/* Stripe patterns for each color — defined per card but identical per color */}
        <pattern id={patternId} patternUnits="userSpaceOnUse" width="8" height="8">
          <line x1="0" y1="4" x2="8" y2="4" stroke={colorHex} strokeWidth="2.5" />
        </pattern>

        {/* Clip to shape for stripes */}
        {shading === 'striped' && (
          <>
            {shape === 'oval' && (
              <clipPath id={`clip-${patternId}-oval`}>
                <ellipse cx="0" cy="0" rx="22" ry="36" />
              </clipPath>
            )}
            {shape === 'diamond' && (
              <clipPath id={`clip-${patternId}-diamond`}>
                <polygon points="0,-38 24,0 0,38 -24,0" />
              </clipPath>
            )}
            {shape === 'squiggle' && (
              <clipPath id={`clip-${patternId}-squiggle`}>
                <path d={SQUIGGLE_PATH} />
              </clipPath>
            )}
          </>
        )}
      </defs>

      {/* Card background */}
      <rect
        x={borderWidth / 2} y={borderWidth / 2}
        width={cardW - borderWidth} height={cardH - borderWidth}
        rx="16" ry="16"
        fill={bgColor}
        stroke={borderColor}
        strokeWidth={borderWidth}
      />

      {/* Symbols */}
      {yPositions.map((yOff, idx) => (
        <g key={idx} transform={`translate(${cardW / 2}, ${cardH / 2 + yOff}) rotate(90) scale(${scale})`}>
          <Symbol
            shape={shape}
            color={color}
            shading={shading}
            patternId={patternId}
          />
          {/* For striped: also render clipped pattern on top */}
          {shading === 'striped' && (
            <g clipPath={`url(#clip-${patternId}-${shape})`}>
              {shape === 'oval'     && <ellipse cx="0" cy="0" rx="22" ry="36" fill={`url(#${patternId})`} />}
              {shape === 'diamond'  && <polygon points="0,-38 24,0 0,38 -24,0" fill={`url(#${patternId})`} />}
              {shape === 'squiggle' && <path d={SQUIGGLE_PATH} fill={`url(#${patternId})`} />}
            </g>
          )}
        </g>
      ))}
    </svg>
  );
}
