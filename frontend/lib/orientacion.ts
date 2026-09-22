/**
 * Lógica de ORIENTACIÓN del celular (pure functions, sin dependencias de React/Expo).
 * Así se puede testear y reutilizar en cualquier pantalla.
 *
 * Dos fuentes de datos:
 *  - Acelerómetro: en reposo mide sólo la gravedad (≈ 1 g). El eje que "apunta
 *    hacia arriba" es el que lee ≈ 1. Con eso clasificamos la posición.
 *  - Giroscopio: mide velocidad angular (rad/s). Para conocer el ángulo hay que
 *    integrar (ángulo += ω · Δt) y el error se acumula: deriva.
 */

export type Eje = { x: number; y: number; z: number };
export type Orientacion = 'vertical' | 'horizontal' | 'boca-arriba' | 'boca-abajo';

/** % mínimo de la gravedad que debe concentrar un solo eje para que decidamos. */
export const DOMINIO_MINIMO = 0.75;

export const ETIQUETA_ORIENTACION: Record<Orientacion, string> = {
  vertical: 'VERTICAL (retrato)',
  horizontal: 'HORIZONTAL (paisaje)',
  'boca-arriba': 'ACOSTADO, pantalla arriba',
  'boca-abajo': 'ACOSTADO, pantalla abajo',
};

/**
 * Android y iOS usan signos opuestos: teléfono acostado -> Android z ≈ +1,
 * iOS z ≈ -1 (misma diferencia para el resto de los ejes).
 * Devuelve +1 o -1 para llevar cualquier lectura a la convención "aguas arriba = positivo".
 */
export function signoGravedad(plataforma: string, userAgent?: string): number {
  if (plataforma === 'ios') return -1;
  if (plataforma === 'web' && userAgent) return /iP(hone|ad|od)/.test(userAgent) ? -1 : 1;
  return 1;
}

/** Lleva la lectura cruda del acelerómetro a la convención común (aguas arriba = positivo). */
export function normalizarGravedad(bruto: Eje, signo: number): Eje {
  return { x: bruto.x * signo, y: bruto.y * signo, z: bruto.z * signo };
}

/**
 * Clasifica la posición del celular a partir del vector de gravedad normalizado.
 * Devuelve null cuando está en transición (~45°): no se decide y se mantiene
 * el estado anterior (histéresis) para que la interfaz no parpadee.
 */
export function clasificarOrientacion(g: Eje): Orientacion | null {
  const ax = Math.abs(g.x);
  const ay = Math.abs(g.y);
  const az = Math.abs(g.z);
  const norm = Math.hypot(ax, ay, az) || 1;
  const dominante = Math.max(ax, ay, az);

  if (dominante / norm < DOMINIO_MINIMO) return null;

  if (dominante === az) return g.z > 0 ? 'boca-arriba' : 'boca-abajo';
  if (dominante === ay) return 'vertical';
  return 'horizontal';
}

/**
 * Ángulos de inclinación en grados:
 *  - pitch: 0° = tumbado, 90° = vertical (adelante/atrás)
 *  - roll : 0° = centrado, ±90° = horizontal (giro lateral)
 */
export function inclinaciones(g: Eje): { pitch: number; roll: number } {
  const grados = 180 / Math.PI;
  const pitch = Math.atan2(g.y, Math.hypot(g.x, g.z)) * grados;
  const roll = Math.atan2(g.x, Math.hypot(g.y, g.z)) * grados;
  return { pitch, roll };
}

/** Integra una lectura del giroscopio (rad/s) durante dt segundos -> radianes acumuladas. */
export function integrarGiro(acumulado: Eje, g: Eje, dt: number): Eje {
  return {
    x: acumulado.x + g.x * dt,
    y: acumulado.y + g.y * dt,
    z: acumulado.z + g.z * dt,
  };
}
