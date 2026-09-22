import { Link } from 'expo-router';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  clasificarOrientacion,
  ETIQUETA_ORIENTACION,
  inclinaciones,
  integrarGiro,
  normalizarGravedad,
  signoGravedad,
  type Eje,
  type Orientacion,
} from '../lib/orientacion';

/**
 * PANTALLA DIDÁCTICA: GIROSCOPIO + ORIENTACIÓN DEL CELULAR
 * --------------------------------------------------------
 * Dos sensores trabajando juntos:
 *
 *  1) Giroscopio (Gyroscope): mide VELOCIDAD ANGULAR, o sea qué tan rápido
 *     gira el celular, en rad/s sobre 3 ejes (x, y, z). NO mide la posición.
 *     Para obtener el ángulo hay que integrar:  ángulo += velocidad * tiempo.
 *
 *  2) Acelerómetro (Accelerometer): en reposo lo único que mide es la gravedad
 *     (≈ 1 g). El eje que "apunta hacia arriba" es el que lee ≈ 1:
 *       z ≈ 1 -> acostado boca arriba   |  z ≈ -1 -> acostado boca abajo
 *       y ≈ 1 -> vertical (retrato)      |  x ≈ 1  -> horizontal (paisaje)
 *     Con eso sabemos en qué posición está el teléfono SIN integrar nada.
 */

type Modo = 'apagado' | 'sensor' | 'simulacion';

const CERO: Eje = { x: 0, y: 0, z: 0 };
const A_GRADOS = 180 / Math.PI;
const UMBRAL_GIRO = 0.6; // rad/s (~34 °/s): por debajo se considera "quieto"

const COLORES: Record<Orientacion, string> = {
  vertical: '#2f9e44',
  horizontal: '#f59f00',
  'boca-arriba': '#1c7ed6',
  'boca-abajo': '#9c36b5',
};

/** Posiciones del "celular de mentira" que usa el modo de demostración sin sensores. */
const POSES: { aceleracion: Eje; giroAlMoverse: Eje }[] = [
  { aceleracion: { x: 0, y: 1, z: 0 }, giroAlMoverse: { x: 0, y: 0, z: 1.6 } }, // vertical -> gira sobre Z
  { aceleracion: { x: 1, y: 0, z: 0 }, giroAlMoverse: { x: 0, y: 1.6, z: 0 } }, // horizontal -> se acuesta sobre Y
  { aceleracion: { x: 0, y: 0, z: 1 }, giroAlMoverse: { x: 1.6, y: 0, z: 0 } }, // acostado -> se levanta sobre X
];

function BarraEje({ nombre, valor, color }: { nombre: string; valor: number; color: string }) {
  const proporcion = Math.min(Math.abs(valor) / 3, 1); // tope visual: 3 rad/s
  const izquierda = valor >= 0 ? 50 : 50 - proporcion * 50;
  return (
    <View style={styles.filaEje}>
      <Text style={[styles.nombreEje, { color }]}>{nombre}</Text>
      <View style={styles.pista}>
        <View style={styles.marcaCentral} />
        <View
          style={[
            styles.barra,
            { backgroundColor: color, left: `${izquierda}%`, width: `${proporcion * 50}%` },
          ]}
        />
      </View>
      <Text style={styles.valorRad}>{valor.toFixed(2)}</Text>
      <Text style={styles.valorGrados}>{(valor * A_GRADOS).toFixed(0)} °/s</Text>
    </View>
  );
}

export default function GiroscopioScreen() {
  const [giro, setGiro] = useState<Eje>(CERO); // rad/s
  const [acelerometro, setAcelerometro] = useState<Eje>(CERO); // g (crudo)
  const [acumulado, setAcumulado] = useState<Eje>(CERO); // radianes integrados
  const [orientacion, setOrientacion] = useState<Orientacion>('vertical');
  const [modo, setModo] = useState<Modo>('apagado');
  const [intervalo, setIntervalo] = useState(60);
  const [aviso, setAviso] = useState<string | null>(null);
  const [invertir, setInvertir] = useState(false);

  const subGiro = useRef<ReturnType<typeof Gyroscope.addListener> | null>(null);
  const subAccel = useRef<ReturnType<typeof Accelerometer.addListener> | null>(null);
  const ultimoTiempo = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const orientacionRef = useRef<Orientacion>('vertical');

  // Vector "hacia arriba" normalizado (aguas arriba = positivo) en todas las plataformas.
  const signo = signoGravedad(
    Platform.OS,
    Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  ) * (invertir ? -1 : 1);
  const gravedad = normalizarGravedad(acelerometro, signo);
  const { x: gx, y: gy, z: gz } = gravedad;
  const { pitch, roll } = inclinaciones(gravedad);

  // Clasifica la posición en cada lectura nueva del acelerómetro.
  useEffect(() => {
    const nueva = clasificarOrientacion({ x: gx, y: gy, z: gz });
    if (nueva && nueva !== orientacionRef.current) {
      orientacionRef.current = nueva;
      setOrientacion(nueva);
    }
  }, [gx, gy, gz]);

  /** Recibe una lectura del giroscopio y la integra para obtener el ángulo acumulado. */
  const registrarGiro = (g: Eje) => {
    const ahora = Date.now();
    const dt =
      ultimoTiempo.current === null ? 0 : Math.min((ahora - ultimoTiempo.current) / 1000, 0.25);
    ultimoTiempo.current = ahora;
    setGiro(g);
    if (dt > 0) {
      setAcumulado((p) => integrarGiro(p, g, dt));
    }
  };

  const registrarAccel = (a: Eje) => setAcelerometro(a);

  const detener = () => {
    subGiro.current?.remove();
    subAccel.current?.remove();
    subGiro.current = null;
    subAccel.current = null;
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    ultimoTiempo.current = null;
    setGiro(CERO);
    setModo('apagado');
  };

  const iniciarSensor = async () => {
    setAviso(null);
    // iOS y el web móvil piden permiso de movimiento antes de entregar datos.
    if (Platform.OS !== 'android') {
      try {
        const permiso = await Gyroscope.requestPermissionsAsync();
        if (!permiso.granted) {
          setAviso('Permiso de movimiento denegado: puede que no lleguen datos.');
        }
      } catch {
        // Si la plataforma no expone permisos, seguimos igual.
      }
    }

    const [giroOk, accelOk] = await Promise.all([
      Gyroscope.isAvailableAsync(),
      Accelerometer.isAvailableAsync(),
    ]);
    if (!giroOk || !accelOk) {
      setAviso(
        'Este equipo no tiene giroscopio/acelerómetro (¿PC?). Pulsa "Simular" para ver el ejemplo con datos sintéticos, o abrí la app en un celular con Expo Go.',
      );
      return;
    }

    detener();
    Gyroscope.setUpdateInterval(intervalo);
    Accelerometer.setUpdateInterval(intervalo);
    ultimoTiempo.current = null;
    subGiro.current = Gyroscope.addListener(registrarGiro);
    subAccel.current = Accelerometer.addListener(registrarAccel);
    setModo('sensor');
  };

  const iniciarSimulacion = () => {
    detener();
    setAviso('Modo demostración: estos datos son sintéticos, no vienen del teléfono.');
    ultimoTiempo.current = null;
    const inicio = Date.now();
    const DURACION = 3.5; // 2.5 s quieta + 1 s moviéndose
    timer.current = setInterval(() => {
      const t = (Date.now() - inicio) / 1000;
      const local = t % (DURACION * POSES.length);
      const idx = Math.floor(local / DURACION);
      const dentro = local - idx * DURACION;
      const desde = POSES[idx];
      const hacia = POSES[(idx + 1) % POSES.length];

      if (dentro < 2.5) {
        registrarGiro(CERO);
        registrarAccel(desde.aceleracion);
        return;
      }
      // Transición: interpola la gravedad entre poses y gira sobre el eje correspondiente.
      const k = (dentro - 2.5) / 1;
      const lerp = (a: number, b: number) => a + (b - a) * k;
      const a = {
        x: lerp(desde.aceleracion.x, hacia.aceleracion.x),
        y: lerp(desde.aceleracion.y, hacia.aceleracion.y),
        z: lerp(desde.aceleracion.z, hacia.aceleracion.z),
      };
      const n = Math.hypot(a.x, a.y, a.z) || 1;
      registrarAccel({ x: a.x / n, y: a.y / n, z: a.z / n });
      registrarGiro(desde.giroAlMoverse);
    }, 50);
    setModo('simulacion');
  };

  const reiniciarAngulos = () => setAcumulado(CERO);

  // Cambia la frecuencia de muestreo en caliente.
  useEffect(() => {
    if (modo === 'sensor') {
      Gyroscope.setUpdateInterval(intervalo);
      Accelerometer.setUpdateInterval(intervalo);
    }
  }, [intervalo, modo]);

  // Limpia sensores y temporizadores al desmontar la pantalla.
  useEffect(() => {
    return () => {
      subGiro.current?.remove();
      subAccel.current?.remove();
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const magnitud = Math.hypot(giro.x, giro.y, giro.z);
  const girando = magnitud > UMBRAL_GIRO;
  const esPlano = orientacion === 'boca-arriba' || orientacion === 'boca-abajo';
  const rotacionGrafica = orientacion === 'horizontal' ? (gx > 0 ? -90 : 90) : 0;

  return (
    <ScrollView style={styles.pagina} contentContainerStyle={styles.contenido}>
      <Text style={styles.titulo}>Giroscopio y Orientación - Titán V</Text>

      <View style={styles.botonesFila}>
        <TouchableOpacity
          style={[styles.boton, modo !== 'apagado' ? styles.botonPeligro : styles.botonPrimario]}
          onPress={modo === 'apagado' ? iniciarSensor : detener}
        >
          <Text style={styles.textoBoton}>
            {modo === 'apagado' ? 'Usar sensores reales' : 'Detener'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.boton, styles.botonSecundario]} onPress={iniciarSimulacion}>
          <Text style={styles.textoBoton}>Simular</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.botonesFila}>
        <TouchableOpacity
          style={[styles.botonPequeno, intervalo === 200 && styles.botonActivo]}
          onPress={() => setIntervalo(200)}
        >
          <Text style={styles.textoPequeno}>Lento (5 Hz)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.botonPequeno, intervalo === 60 && styles.botonActivo]}
          onPress={() => setIntervalo(60)}
        >
          <Text style={styles.textoPequeno}>Rápido (~16 Hz)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.botonPequeno} onPress={reiniciarAngulos}>
          <Text style={styles.textoPequeno}>Reiniciar ángulos</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.estadoModo}>
        {modo === 'apagado'
          ? 'Sensores detenidos'
          : modo === 'sensor'
            ? 'Leyendo sensores reales del dispositivo'
            : 'Demostración con datos simulados'}
      </Text>
      {aviso ? <Text style={styles.aviso}>{aviso}</Text> : null}

      {/* ---------------- ORIENTACIÓN (acelerómetro / gravedad) ---------------- */}
      <View style={styles.tarjeta}>
        <Text style={styles.tituloTarjeta}>¿En qué posición está el celular?</Text>
        <Text style={styles.subtituloTarjeta}>Detectado con el acelerómetro (vector de gravedad)</Text>

        <View style={styles.filaContenido}>
          <View
            style={[
              styles.telefono,
              {
                backgroundColor: COLORES[orientacion],
                // Acostado se ve "aplastado": da la idea de que lo mirás de frente.
                transform: [
                  { rotate: `${rotacionGrafica}deg` },
                  { scaleX: esPlano ? 1.25 : 1 },
                  { scaleY: esPlano ? 0.7 : 1 },
                ],
              },
            ]}
          >
            <View style={styles.camara} />
            <Text style={styles.textoTelefono}>
              {orientacion === 'vertical' ? 'V' : orientacion === 'horizontal' ? 'H' : '▬'}
            </Text>
          </View>

          <View style={styles.datosOrientacion}>
            <Text style={[styles.etiquetaOrientacion, { color: COLORES[orientacion] }]}>
              {ETIQUETA_ORIENTACION[orientacion]}
            </Text>
            <Text style={styles.lineaDato}>
              Inclinación adelante/atrás (pitch): {pitch.toFixed(0)}°
            </Text>
            <Text style={styles.lineaDato}>Giro lateral (roll): {roll.toFixed(0)}°</Text>
            <Text style={styles.lineaDato}>
              Gravedad: x {acelerometro.x.toFixed(2)} · y {acelerometro.y.toFixed(2)} · z{' '}
              {acelerometro.z.toFixed(2)} g
            </Text>
            <TouchableOpacity style={styles.enlaceCalibrar} onPress={() => setInvertir(!invertir)}>
              <Text style={styles.textoCalibrar}>
                {invertir ? 'Signo invertido (tocá para normalizar)' : 'Invertir signo (calibrar)'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ---------------- GIROSCOPIO ---------------- */}
      <View style={styles.tarjeta}>
        <Text style={styles.tituloTarjeta}>Giroscopio (velocidad angular)</Text>
        <Text style={styles.subtituloTarjeta}>
          Girá el celular: las barras se mueven. Quietud &lt; {UMBRAL_GIRO} rad/s
        </Text>

        <View style={[styles.pastilla, girando ? styles.pastillaActiva : styles.pastillaQuieta]}>
          <Text style={styles.textoPastilla}>
            {girando ? `GIRANDO · ${magnitud.toFixed(2)} rad/s` : 'QUIETO'}
          </Text>
        </View>

        <BarraEje nombre="X" valor={giro.x} color="#e5484d" />
        <BarraEje nombre="Y" valor={giro.y} color="#2f9e44" />
        <BarraEje nombre="Z" valor={giro.z} color="#1c7ed6" />

        <Text style={styles.tituloAcumulado}>
          Giro acumulado (integración ω · Δt, ya en grados)
        </Text>
        <View style={styles.filaAcumulado}>
          <Text style={styles.datoAcumulado}>X {(acumulado.x * A_GRADOS).toFixed(0)}°</Text>
          <Text style={styles.datoAcumulado}>Y {(acumulado.y * A_GRADOS).toFixed(0)}°</Text>
          <Text style={styles.datoAcumulado}>Z {(acumulado.z * A_GRADOS).toFixed(0)}°</Text>
        </View>
        <Text style={styles.nota}>
          Este ángulo NO es absoluto: se calcula sumando velocidad × tiempo, por eso “deriva”
          (se desvía) y hay que reiniciarlo.
        </Text>
      </View>

      {/* ---------------- EXPLICACIÓN DIDÁCTICA ---------------- */}
      <View style={styles.tarjeta}>
        <Text style={styles.tituloTarjeta}>¿Cómo sabe el celular si está horizontal o vertical?</Text>

        <Text style={styles.parrafo}>
          <Text style={styles.negrita}>1. El giroscopio mide cuánto gira, no dónde está. </Text>
          Devuelve la velocidad de rotación en rad/s sobre 3 ejes (x, y, z). Si querés la posición
          tenés que integrar: ángulo = ángulo + velocidad × tiempo. Como cada lectura tiene error,
          el error se acumula (deriva): por eso el “giro acumulado” de arriba nunca es confiable a
          largo plazo.
        </Text>

        <Text style={styles.parrafo}>
          <Text style={styles.negrita}>2. El acelerómetro mide la gravedad. </Text>
          Con el celular quieto, el único vector que existe es la gravedad (1 g). El eje que apunta
          hacia arriba es el que lee ≈ 1 y los otros quedan en ≈ 0:
        </Text>
        <Text style={styles.item}>• z ≈ 1 → ACOSTADO boca arriba (pantalla al cielo)</Text>
        <Text style={styles.item}>• z ≈ -1 → ACOSTADO boca abajo (contra la mesa)</Text>
        <Text style={styles.item}>• y ≈ 1 → VERTICAL, en retrato</Text>
        <Text style={styles.item}>• x ≈ 1 → HORIZONTAL, en paisaje</Text>

        <Text style={styles.parrafo}>
          <Text style={styles.negrita}>3. La regla del 75 %. </Text>
          Sólo decidimos si un eje concentra al menos el 75 % de la gravedad. Al celular lo tenés a
          ~45° durante el movimiento: en ese caso no decidimos y mantenemos la posición anterior
          (histéresis) para que el texto no parpadee.
        </Text>

        <Text style={styles.parrafo}>
          <Text style={styles.negrita}>4. ¿Y por qué no uso sólo el giroscopio? </Text>
          Porque exigiría partir de una posición conocida e integrar siempre, y la deriva te saca de
          eje. Por eso las apps reales (y el rotado automático de pantalla) combinan ambos:
          acelerómetro para la posición en reposo + giroscopio para reaccionar rápido al
          movimiento.
        </Text>

        <Text style={styles.parrafo}>
          <Text style={styles.negrita}>5. Dato de plataformas: </Text>
          Android y iOS no usan el mismo signo para el eje Z (teléfono acostado: Android z ≈ +1,
          iOS z ≈ -1). Por eso la app normaliza el vector; si tu equipo muestra la posición
          invertida, usá el botón “Invertir signo”.
        </Text>
      </View>

      <Link href="/" style={styles.linkVolver}>
        <Text style={styles.textoVolver}>Volver al inicio</Text>
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: '#f4f6f8' },
  contenido: { padding: 16, paddingBottom: 40 },
  titulo: { fontSize: 22, fontWeight: 'bold', color: '#333', textAlign: 'center', marginVertical: 12 },
  botonesFila: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  boton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  botonPrimario: { backgroundColor: '#007AFF' },
  botonPeligro: { backgroundColor: '#dc3545' },
  botonSecundario: { backgroundColor: '#495057' },
  botonActivo: { backgroundColor: '#007AFF' },
  botonPequeno: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ced4da',
  },
  textoBoton: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  textoPequeno: { color: '#495057', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  estadoModo: { textAlign: 'center', color: '#495057', marginBottom: 10, fontStyle: 'italic' },
  aviso: {
    backgroundColor: '#fff3cd',
    color: '#664d03',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    fontSize: 13,
    textAlign: 'center',
  },
  tarjeta: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  tituloTarjeta: { fontSize: 17, fontWeight: 'bold', color: '#222' },
  subtituloTarjeta: { fontSize: 12, color: '#868e96', marginTop: 2, marginBottom: 12 },
  filaContenido: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  telefono: {
    width: 74,
    height: 130,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  camara: {
    position: 'absolute',
    top: 8,
    width: 18,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  textoTelefono: { color: '#fff', fontSize: 30, fontWeight: 'bold' },
  datosOrientacion: { flex: 1 },
  etiquetaOrientacion: { fontSize: 16, fontWeight: 'bold', marginBottom: 6 },
  lineaDato: { fontSize: 13, color: '#495057', marginBottom: 3 },
  enlaceCalibrar: { marginTop: 6 },
  textoCalibrar: { fontSize: 12, color: '#007AFF', textDecorationLine: 'underline' },
  pastilla: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 12 },
  pastillaQuieta: { backgroundColor: '#e9ecef' },
  pastillaActiva: { backgroundColor: '#ffe3e3' },
  textoPastilla: { fontWeight: 'bold', color: '#495057', fontSize: 13 },
  filaEje: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  nombreEje: { width: 16, fontWeight: 'bold', fontSize: 14 },
  pista: {
    flex: 1,
    height: 16,
    backgroundColor: '#f1f3f5',
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  marcaCentral: {
    position: 'absolute',
    alignSelf: 'center',
    width: 1,
    height: 16,
    backgroundColor: '#adb5bd',
  },
  barra: { position: 'absolute', height: 16, borderRadius: 8 },
  valorRad: { width: 44, textAlign: 'right', fontSize: 12, color: '#495057', fontVariant: ['tabular-nums'] },
  valorGrados: { width: 52, textAlign: 'right', fontSize: 12, color: '#868e96', fontVariant: ['tabular-nums'] },
  tituloAcumulado: { fontSize: 14, fontWeight: 'bold', color: '#222', marginTop: 10, marginBottom: 6 },
  filaAcumulado: { flexDirection: 'row', gap: 10 },
  datoAcumulado: {
    flex: 1,
    backgroundColor: '#f1f3f5',
    borderRadius: 8,
    paddingVertical: 8,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: '#343a40',
  },
  nota: { fontSize: 12, color: '#868e96', marginTop: 8, lineHeight: 17 },
  parrafo: { fontSize: 14, color: '#343a40', lineHeight: 21, marginTop: 12 },
  negrita: { fontWeight: 'bold', color: '#212529' },
  item: { fontSize: 14, color: '#343a40', lineHeight: 22, marginLeft: 6 },
  linkVolver: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  textoVolver: { color: '#fff', fontWeight: 'bold', fontSize: 15, textAlign: 'center' },
});
