export const clamp = (v: number, min = 0, max = 1) => (v < min ? min : v > max ? max : v)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const smoothstep = (t: number) => t * t * (3 - 2 * t)
export const fract = (v: number) => v - Math.floor(v)
export const deg2rad = (d: number) => (d * Math.PI) / 180
