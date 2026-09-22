# INFORME: Cómo funciona la pantalla de Giroscopio y Orientación

> Documento explicativo para exponer ante el instructor.
> Función implementada en: `frontend/app/giroscopio.tsx` + `frontend/lib/orientacion.ts`

---

## 1. La idea central (resumen en 30 segundos)

> La app detecta **en qué posición está el celular** (vertical, horizontal o acostado) usando **dos sensores del teléfono**: el **acelerómetro** (que mide la gravedad y dice la posición en reposo) y el **giroscopio** (que mide qué tan rápido gira y sirve para reaccionar al movimiento). La lógica matemática está separada de la pantalla en un archivo propio para poder testearla.

---

## 2. Los dos sensores: qué hace cada uno

| | **Giroscopio** | **Acelerómetro** |
|---|---|---|
| **Mide** | Velocidad de rotación (¿qué tan rápido gira?) | Aceleración (en reposo: solo la gravedad ≈ 1 g) |
| **Unidades** | rad/s sobre 3 ejes (x, y, z) | g sobre 3 ejes (x, y, z) |
| **¿Da la posición?** | ❌ No: hay que **integrar** en el tiempo | ✅ Sí, directo: el eje "hacia arriba" lee ≈ 1 |
| **Problema** | **Deriva**: el error se acumula | Se confunde si el teléfono se mueve |
| **Analogía** | La perilla de una olla: cuánto la giras *por segundo* | El nivel de agua en una botella: siempre se aplana hacia la gravedad |

---

## 3. Archivos que forman la función

| Archivo | Rol |
|---|---|
| `frontend/lib/orientacion.ts` | **El cerebro**: funciones puras (matemática), sin React ni Expo → testeable |
| `frontend/app/giroscopio.tsx` | **La pantalla**: pide permisos, escucha los sensores y dibuja la interfaz |
| `frontend/app/index.tsx` | Botón de entrada desde el home |
| `frontend/app.json` | Configura el **permiso de movimiento** de iOS (plugin `expo-sensors`) |

---

## 4. La lógica, función por función

### 4.1 `lib/orientacion.ts` (el cerebro)

#### ① `clasificarOrientacion(g)` — línea 46: la regla del 75 % con histéresis

```typescript
export function clasificarOrientacion(g: Eje): Orientacion | null {
  const ax = Math.abs(g.x), ay = Math.abs(g.y), az = Math.abs(g.z);
  const norm = Math.hypot(ax, ay, az) || 1;           // longitud del vector
  const dominante = Math.max(ax, ay, az);             // eje más fuerte
  if (dominante / norm < DOMINIO_MINIMO) return null; // 0.75 → "no sé, no decido"
  if (dominante === az) return g.z > 0 ? 'boca-arriba' : 'boca-abajo';
  if (dominante === ay) return 'vertical';
  return 'horizontal';
}
```

**Cómo explicarlo:** "Si un eje concentra **75 % o más** de la gravedad, decidimos. Si no, devuelvo `null` = *no decido* y me quedo con la posición anterior".

- **Ejemplo real:** celular a ~45° → `x = z ≈ 0.707` → `0.707 / 1 = 0.707 < 0.75` → `null`.
- Eso es la **histéresis**: evita que el texto **parpadee** entre VERTICAL y HORIZONTAL durante el movimiento.
- `DOMINIO_MINIMO = 0.75` está en la línea 16 como constante "calibrable".

#### ② `signoGravedad()` (línea 30) + `normalizarGravedad()` (línea 37) — diferencia Android/iOS

| Teléfono acostado | Android lee | iOS lee |
|---|---|---|
| Pantalla arriba | `z ≈ +1` | `z ≈ -1` |

```typescript
export function signoGravedad(plataforma: string): number {
  if (plataforma === 'ios') return -1;   // iOS usa signo opuesto
  return 1;                              // Android y web: normal
}
```

Todas las lecturas se llevan a una **convención única** ("aguas arriba = positivo") con `normalizarGravedad`. Por eso la pantalla tiene el botón *"Invertir signo"* por si algún equipo necesita calibración.

#### ③ `inclinaciones(g)` (línea 65) — pitch y roll con trigonometría

```typescript
const pitch = Math.atan2(g.y, Math.hypot(g.x, g.z)) * 180 / Math.PI; // adelante/atrás
const roll  = Math.atan2(g.x, Math.hypot(g.y, g.z)) * 180 / Math.PI; // lateral
```

**Explicación:** `atan2` convierte el vector de gravedad en **grados de inclinación**. Pitch 90° = el celular parado en retrato; roll ±90° = acostado de costado.

#### ④ `integrarGiro(acumulado, g, dt)` (línea 73) — la integración numérica

```typescript
// Método de Euler: el ángulo nuevo = ángulo viejo + velocidad × tiempo
return { x: acumulado.x + g.x * dt, /* y, z igual */ };
```

**Explicación:** el giroscopio da *velocidad* (rad/s). Para obtener el **ángulo** hay que sumar vel × tiempo en cada lectura. Como cada lectura tiene un error chiquito y se suma siempre, el error **crece sin límite** → eso es la **deriva** → por eso existe el botón *"Reiniciar ángulos"*.

---

### 4.2 `app/giroscopio.tsx` (la pantalla)

#### ⑤ El estado de la pantalla (líneas 74–81)

```typescript
const [giro, setGiro] = useState(CERO);                  // velocidad angular (rad/s)
const [acelerometro, setAcelerometro] = useState(CERO);  // gravedad (g)
const [acumulado, setAcumulado] = useState(CERO);        // ángulos integrados (rad)
const [orientacion, setOrientacion] = useState('vertical'); // posición detectada
const [modo, setModo] = useState('apagado');             // apagado | sensor | simulacion
const [intervalo, setIntervalo] = useState(60);           // ms entre lecturas
```

#### ⑥ Las referencias (`useRef`, líneas 83–87)

Datos que **no** deben redibujar la pantalla:

```typescript
const subGiro = useRef(...);        // "suscripción" para poder DESVINCULAR el sensor
const ultimoTiempo = useRef(null);  // última lectura → calcula Δt entre lecturas
const timer = useRef(null);         // timer del modo simulación
const orientacionRef = useRef(...); // recuerda la posición anterior (histéresis)
```

#### ⑦ Encender sensores: `iniciarSensor()` (líneas 135–167), paso a paso

1. **Pedir permiso** (solo iOS/web móvil): `Gyroscope.requestPermissionsAsync()` — en Android no hace falta pedirlo.
2. **¿Existe el sensor?**: `Gyroscope.isAvailableAsync()` — en PC no existe → muestra el aviso de usar *Simular*.
3. **Frecuencia**: `setUpdateInterval(60)` → una lectura cada **60 ms ≈ 16 Hz**.
4. **Escuchar**: `subGiro.current = Gyroscope.addListener(registrarGiro)` → desde ahí la función se llama **sola**, automáticamente, 16 veces por segundo.
5. `setModo('sensor')` → la UI muestra "Leyendo sensores reales".

#### ⑧ Integración con protección: `registrarGiro()` (líneas 108–117)

```typescript
const dt = Math.min((ahora - ultimoTiempo.current) / 1000, 0.25); // tope 0.25 s
if (dt > 0) setAcumulado((p) => integrarGiro(p, g, dt));
```

El **tope de 0.25 s** es importante: si la app se congela un segundo (cambio de pantalla), sin el tope el ángulo saltaría de golpe. `dt = 0` en la primera lectura evita un salto inicial.

#### ⑨ Detección de posición: el `useEffect` de la línea 99

```typescript
useEffect(() => {
  const nueva = clasificarOrientacion({ x: gx, y: gy, z: gz });
  if (nueva && nueva !== orientacionRef.current) {   // null → no cambia nada
    orientacionRef.current = nueva;
    setOrientacion(nueva);
  }
}, [gx, gy, gz]);
```

Se ejecuta **cada vez que cambia una lectura del acelerómetro**. Si la función devuelve `null` (45°), **no toca nada** → la posición anterior se mantiene (histéresis otra vez).

#### ⑩ Modo simulación: `iniciarSimulacion()` (líneas 169–201)

Para probar en PC (que no tiene giroscopio):

```typescript
const POSES = [                                  // 3 poses que ciclan cada 3.5 s
  { aceleracion: { x: 0, y: 1, z: 0 }, /* ... */ },  // vertical
  { aceleracion: { x: 1, y: 0, z: 0 }, /* ... */ },  // horizontal
  { aceleracion: { x: 0, y: 0, z: 1 }, /* ... */ },  // acostado
];
```

Cada ciclo: **2.5 s quieta** (para que se vea la posición) + **1 s de transición** interpolando (`lerp`) el vector gravedad entre una pose y la otra, con giro sintético sobre el eje correspondiente. Usa el **mismo `registrarGiro`/`registrarAccel` y la misma lógica** que los sensores reales.

#### ⑪ Limpieza (líneas 121–133 y 214–220)

```typescript
return () => { subGiro.current?.remove(); subAccel.current?.remove(); /* ... */ };
```

Al salir de la pantalla se **desvinculan los listeners** y se limpian timers. Si no se hiciera, los sensores seguirían corriendo en segundo plano → **batería** y errores.

#### ⑫ La barra visual `BarraEje` (línea 52)

```typescript
const proporcion = Math.min(Math.abs(valor) / 3, 1);   // tope visual: 3 rad/s
const izquierda = valor >= 0 ? 50 : 50 - proporcion * 50;
// barra crece desde el centro; izquierda = negativo, derecha = positivo
```

---

## 5. El recorrido completo de los datos (para dibujar en la pizarra)

```
Tocás "Usar sensores reales"
        │
        ▼
1. Pide permiso (iOS) ──► 2. ¿Tiene sensor? ──► 3. setUpdateInterval(60 ms)
        │
        ▼
4. addListener(...)  ← el sensor nos "llama" 16 veces por segundo
        │
        ├──► Giroscopio ──► registrarGiro() ──► integrarGiro() ──► "Giro acumulado"
        │                        │
        │                        └──► setGiro() ──► barras X, Y, Z
        │
        └──► Acelerómetro ──► setAcelerometro() ──► signoGravedad() ──► normalizar()
                                     │
                                     ▼
                          useEffect([gx, gy, gz])
                                     │
                                     ▼
                       clasificarOrientacion() ──► ≥ 75 %: nueva posición
                                     │              < 75 %: null (mantiene la anterior)
                                     ▼
                          setOrientacion() ──► cuadro de color + texto
```

---

## 6. Fórmulas que pueden preguntar

| Fórmula | Dónde | Significado |
|---|---|---|
| `ángulo += ω · Δt` | `integrarGiro` | Integración de Euler: sumar velocidad × tiempo |
| `dominante / ‖g‖ ≥ 0.75` | `clasificarOrientacion` | Un eje debe concentrar ≥ 75 % de la gravedad |
| `pitch = atan2(y, √(x² + z²))` | `inclinaciones` | Inclinación adelante/atrás en grados |
| `roll = atan2(x, √(y² + z²))` | `inclinaciones` | Inclinación lateral en grados |
| `Hz = 1000 / intervalo` | `setUpdateInterval` | 60 ms → ≈ 16 Hz; 200 ms → 5 Hz |

---

## 7. ¿Por qué no usar SOLO el giroscopio? (la pregunta clásica)

Con un sesgo típico de **0.005 rad/s**, la integración acumula:

- en **1 minuto**: ≈ **17°** de error
- en **5 minutos**: ≈ **86°** de error → "dice" que el celular está vertical cuando está acostado

Por eso las apps reales (y el rotado automático del celular) combinan:
**acelerómetro = posición confiable en reposo** + **giroscopio = reacción rápida al movimiento**.

---

## 8. Configuración y permisos

**`app.json`:**

```json
["expo-sensors", { "motionPermission": "Necesitamos leer el giroscopio y el acelerómetro..." }]
```

- **iOS**: eso llena el `NSMotionUsageDescription` (texto que ve el usuario al pedir permiso).
- **Android**: estos sensores no piden permiso en runtime; solo existe el límite de **200 Hz desde Android 12** (nosotros usamos máximo **16 Hz**, así que no aplica).

---

## 9. Cómo se prueba / demostrar en clase

1. Backend: `uvicorn app.main:app --reload` → `http://127.0.0.1:8000`
2. Frontend: `npx expo start` → celular con **Expo Go** (sensores reales) o PC (botón **Simular**).
3. Entrar a *"Probar giroscopio y orientación"*.

**Estado de pruebas hoy:** `tsc` ✅ 0 errores · `eslint` ✅ 0 errores · **12 aserciones unitarias** de `lib/orientacion.ts` pasando (clasificación, histéresis, signo iOS, integración, pitch/roll) · las 3 rutas renderizan HTTP 200.

---

## 10. Preguntas probables del instructor (y respuesta corta)

1. **¿Qué mide exactamente el giroscopio?** → Velocidad angular en rad/s, no posición.
2. **¿Cómo sabe que está vertical?** → En reposo solo existe la gravedad; el eje que apunta al cielo lee ≈ 1 g.
3. **¿Qué es la deriva?** → Error que se acumula al integrar; por eso el ángulo no es absoluto.
4. **¿Por qué 75 % y no 50 %?** → A 45° dos ejes empatan (~71 % cada uno): con 50 % decidiría a mitad de camino y parpadearía.
5. **¿Qué es la histéresis?** → En zona gris no cambia la respuesta: mantiene la anterior para evitar el parpadeo.
6. **¿Por qué el botón "Invertir signo"?** → Android e iOS usan signo opuesto en el eje Z.
7. **¿Por qué la lógica está en `lib/` aparte?** → Separar modelo de vista: se testea sin celular (las 12 aserciones corren en Node).
