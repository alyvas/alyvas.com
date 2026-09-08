export const VERTEX_SHADER = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const MAX_COLORS = 8;

const NOISE_LIB = `
float hash21(vec2 p) {
  p = fract(p * vec2(0.3183099, 0.3678794)) + 0.1;
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}

float valueNoise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = hash21(i);
  float b = hash21(i + vec2(1., 0.));
  float c = hash21(i + vec2(0., 1.));
  float d = hash21(i + vec2(1., 1.));
  vec2 u = f * f * (3. - 2. * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

vec2 rotate(vec2 uv, float th) {
  return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
}
`;

/**
 * Colour fields: each colour is a feathered, anisotropic mask cut from domain-warped noise
 * and laid over the paper colour. Rendered at low resolution, so it must stay smooth.
 */
export const GRADIENT_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_paper;
uniform vec3 u_colors[${MAX_COLORS}];
uniform int u_colorCount;
uniform float u_distortion;
uniform float u_coverage;
uniform float u_seed;

in vec2 v_uv;
out vec4 fragColor;

${NOISE_LIB}

// Two octaves only, so mask edges stay smooth.
float field(vec2 p) {
  return valueNoise(p) * .84 + valueNoise(p * 2.1 + vec2(3.3, 7.7)) * .16;
}

void main() {
  float shortSide = min(u_resolution.x, u_resolution.y);
  vec2 q = (v_uv - .5) * u_resolution / shortSide;
  float t = u_time;

  // Domain warp, so shapes lean and drift instead of pulsing in place.
  vec2 warp = vec2(
    field(q * 1.1 + vec2(t * .06 + u_seed, 1.3)),
    field(q * 1.1 + vec2(4.7, u_seed - t * .05))
  ) - .5;
  vec2 p = q + u_distortion * 2.2 * warp;

  // Weighted blend rather than painting one colour over the next: overlapping masks mix, and
  // paper keeps a share everywhere, so edges stay soft.
  vec3 sum = u_paper * .38;
  float weight = .38;
  for (int i = 0; i < ${MAX_COLORS}; i++) {
    if (i >= u_colorCount) break;
    float fi = float(i);

    // Per-colour stretch, angle and drift, so no mask comes out circular.
    vec2 stretch = vec2(1. + .65 * sin(fi * 1.7 + .4), 1. + .65 * cos(fi * 2.3));
    float angle = fi * .9 + .18 * sin(t * .05 + fi);
    vec2 drift = vec2(sin(t * .09 + fi * 2.1), cos(t * .07 + fi * 1.3)) * .45;
    vec2 pp = rotate(p, angle) * stretch * 1.15 + drift + fi * 7.31 + u_seed * vec2(1.7, .9);

    float n = field(pp);
    float edge = .5 - u_coverage + .05 * sin(fi * 3.1);
    float mask = smoothstep(edge - .12, edge + .62, n);
    mask *= 1.3;
    sum += u_colors[i] * mask;
    weight += mask;
  }
  vec3 color = sum / weight;

  fragColor = vec4(color, 1.);
}
`;

export const POST_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D u_gradient;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_wash;
uniform float u_washAmount;
uniform float u_grainAmount;
uniform float u_grainSeed;
uniform float u_grainScale;
uniform float u_ditherLevels;
uniform float u_ditherMix;
uniform float u_ditherPixel;
uniform vec2 u_cursor;
uniform float u_cursorRadius;
uniform float u_cursorStrength;

in vec2 v_uv;
out vec4 fragColor;

${NOISE_LIB}

// Bayer threshold in [0,1) for a 2^bits square matrix, computed from bits (no array lookup).
float bayer(ivec2 p, int bits) {
  int mask = (1 << bits) - 1;
  int x = p.x & mask;
  int y = p.y & mask;
  int q = x ^ y;
  int v = 0;
  for (int k = 0; k < bits; k++) {
    v = (v << 2) | (((q >> k) & 1) << 1) | ((y >> k) & 1);
  }
  return (float(v) + .5) / float(1 << (2 * bits));
}

// Soft dot: partial coverage near the threshold, so dots fade in instead of popping.
float softDot(float threshold, float density) {
  return smoothstep(-.02, .3, density - threshold);
}

void main() {
  vec2 px = gl_FragCoord.xy;

  // Cursor lens: pixels, and the dots printed on them, slide away from the pointer, with a
  // small rotation added so the displacement is not purely radial.
  vec2 toCursor = px - u_cursor;
  float dist = length(toCursor);
  float falloff = smoothstep(u_cursorRadius, 0., dist);
  float lens = falloff * falloff * u_cursorStrength;
  vec2 dir = toCursor / max(dist, 1.);
  vec2 swirl = vec2(-dir.y, dir.x);
  vec2 shifted = px - (dir * .95 + swirl * .22) * lens * u_cursorRadius * .8;
  vec2 uv = shifted / u_resolution;

  vec3 color = texture(u_gradient, uv).rgb;
  color = mix(color, u_wash, u_washAmount);

  // Drifting fields, in aspect-corrected screen space, that drive the halftone density.
  vec2 field = uv * vec2(u_resolution.x / u_resolution.y, 1.);
  float drift = u_time * .05;
  float broad = valueNoise(field * 2.4 + vec2(drift, -drift * .6));
  float spotty = valueNoise(field * 7.5 + vec2(3.7 - drift * 1.3, 1.9 + drift));
  float second = valueNoise(field * 1.9 + vec2(5.2 + drift * .5, 3.1 - drift * .4));
  float third = valueNoise(field * 3.3 + vec2(9.1 - drift * .8, 6.4 + drift * .3));

  float luma = dot(color, vec3(.299, .587, .114));
  // Only 20% luminance banding, or colour edges show up as stripes.
  float band = mix(1., 1. - abs(2. * fract(luma * u_ditherLevels) - 1.), .2);
  float lightness = smoothstep(.62, .86, luma);

  // One slow displacement field, shared by the screens and the grain, so neither sits on the
  // colour field as a fixed grid.
  vec2 swell = vec2(
    valueNoise(field * 1.3 + vec2(drift * .9, 4.1)) - .5,
    valueNoise(field * 1.3 + vec2(9.7, 2.6 - drift * .8)) - .5
  );
  swell += .35 * vec2(
    sin(field.x * 3.1 + u_time * .13),
    cos(field.y * 2.7 - u_time * .09)
  );
  vec2 warped = shifted + swell * u_ditherPixel * 7.;

  // Three translucent halftone layers at different cell sizes and tints. Each is a soft dot
  // mask against its own density field.
  ivec2 cellA = ivec2(floor(warped / u_ditherPixel));
  ivec2 cellB = ivec2(floor((warped + vec2(u_ditherPixel)) / (u_ditherPixel * 2.)));
  ivec2 cellC = ivec2(floor((warped + vec2(u_ditherPixel * 1.5, 0.)) / (u_ditherPixel * 3.)));

  float densityA = smoothstep(.22, .78, .62 * broad + .38 * spotty) * band * .85;
  float fleck = valueNoise(field * 11. + vec2(1.3 + drift * .9, 8.2 - drift * .6));
  float densityB = smoothstep(.45, .9, second) * smoothstep(.3, .75, fleck) * (.5 + .5 * band) * .6;
  float densityC = smoothstep(.55, .95, third) * .4;

  float dotA = softDot(bayer(cellA, 3), densityA);
  float dotB = softDot(bayer(cellB, 2), densityB);
  float dotC = softDot(bayer(cellC, 3), densityC);

  // A: light dots on colour, dark dots on paper. B: a cooler lilac screen. C: sparse warm
  // specks.
  vec3 tintA = mix(mix(color, vec3(1.), .55), mix(color, vec3(.5, .36, .6), .3), lightness);
  vec3 tintB = mix(color, vec3(.62, .5, .78), .35);
  vec3 tintC = mix(color, vec3(.9, .72, .6), .4);
  // Each screen fades on its own cycle, so the stack never settles into one grid.
  float breatheA = .7 + .3 * sin(u_time * .11);
  float breatheB = .35 + .65 * (.5 + .5 * sin(u_time * .07 + 2.1));
  float breatheC = .3 + .7 * (.5 + .5 * sin(u_time * .09 + 4.4));
  color = mix(color, tintA, dotA * u_ditherMix * breatheA);
  color = mix(color, tintB, dotB * u_ditherMix * .7 * breatheB);
  color = mix(color, tintC, dotC * u_ditherMix * .5 * breatheC);

  // Grain: soft clumps with a little fine speckle, strongest in midtones and fading out in
  // highlights and shadows. Displaced by the same field as the screens.
  vec2 grainPx = px + swell * u_grainScale * 1.6;
  vec2 seedOffset = vec2(u_grainSeed * 71.3, u_grainSeed * 37.9);
  float soft = valueNoise(grainPx / u_grainScale + seedOffset) - .5;
  float speck = hash21(floor(grainPx / (u_grainScale * .5)) + u_grainSeed) - .5;
  float grain = mix(soft, speck, .2);
  float grainLuma = dot(color, vec3(.299, .587, .114));
  float midtone = 1. - abs(2. * grainLuma - 1.);
  color += grain * u_grainAmount * (.35 + .65 * midtone);

  fragColor = vec4(color, 1.);
}
`;
