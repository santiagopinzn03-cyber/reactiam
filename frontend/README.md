# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Giroscopio y orientación (ejemplo didáctico)

Pantalla nueva: **`app/giroscopio.tsx`** (desde el inicio, botón *“Probar giroscopio y orientación”*).
La lógica pura está en **`lib/orientacion.ts`** para poder testearla y reutilizarla.

**Cómo verlo funcionando**

1. Backend: `uvicorn app.main:app --reload` (puerto 8000).
2. Frontend: `npx expo start` y abrí la app en un celular con **Expo Go** (el giroscopio sólo
   existe en dispositivos reales; en PC usá el botón *Simular*, que alimenta la misma lógica con
   datos sintéticos).
3. Entrá a *Probar giroscopio y orientación*, tocá **Usar sensores reales** y:
   - girá el celular → las barras del giroscopio se mueven y el **giro acumulado** crece;
   - dejalo quieto en vertical / horizontal / acostado → cambia la etiqueta de posición.

**¿Cómo sabe el celular si está horizontal, vertical o acostado?**

| Sensor | Qué mide | Cómo da la posición |
| --- | --- | --- |
| **Giroscopio** (`Gyroscope`) | Velocidad angular en **rad/s** sobre x, y y z: qué tan rápido gira. | No da la posición directa: hay que **integrar** (`ángulo += ω · Δt`) y el error se acumula (**deriva**), por eso el ángulo acumulado hay que reiniciarlo. |
| **Acelerómetro** (`Accelerometer`) | En reposo mide sólo la **gravedad** (≈ 1 g). | El eje que *apunta hacia arriba* lee ≈ 1 y los demás ≈ 0: `z≈1` acostado boca arriba, `z≈-1` boca abajo, `y≈1` vertical, `x≈1` horizontal. |

- **Regla del 75 %**: sólo se decide si un eje concentra ≥ 75 % de la gravedad; a ~45° (durante el
  movimiento) se devuelve `null` y se mantiene el estado anterior (**histéresis**, evita parpadeos).
- **Por qué no sólo el giroscopio**: exigiría partir de una posición conocida e integrar siempre y
  la deriva te saca de eje. Por eso las apps reales (y el rotado automático de pantalla) combinan
  **acelerómetro para el reposo + giroscopio para el movimiento rápido**.
- **Diferencia de plataformas**: Android e iOS usan signo opuesto en el eje Z (teléfono acostado:
  Android `z ≈ +1`, iOS `z ≈ -1`). La app normaliza el vector (`signoGravedad()`) y ofrece el botón
  *Invertir signo* por si algún equipo necesita calibración.

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
