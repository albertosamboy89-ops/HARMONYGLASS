# Harmony Glass - Executive Finance Manager

Plataforma profesional para la gestión financiera, control de presupuestos y seguimiento de clientes.

## 🚀 Despliegue en Vercel

Esta aplicación está construida con **React + Vite + Tailwind CSS** y utiliza **Firebase** para el almacenamiento y autenticación.

### Pasos para desplegar:

1.  **Sube el código a GitHub**:
    *   Usa la opción "Export to GitHub" en la configuración de AI Studio.
2.  **Conecta con Vercel**:
    *   Ve a [Vercel](https://vercel.com) e importa tu nuevo repositorio de GitHub.
3.  **Configura las Variables de Entorno**:
    *   En Vercel, ve a **Settings > Environment Variables**.
    *   Añade los valores de tu archivo `firebase-applet-config.json` con el prefijo `VITE_` si los usas en el cliente, o asegúrate de que el código los lea correctamente.
    *   *Nota*: AI Studio usa el archivo `firebase-applet-config.json` directamente. Para Vercel, asegúrate de que este archivo esté presente o configura las variables en `vite.config.ts`.

## 🛠️ Tecnologías

- **Frontend**: React 19, Vite, Tailwind CSS 4.
- **Componentes**: shadcn/ui.
- **Backend**: Firebase Firestore & Auth.
- **Animaciones**: Motion.

## 📈 Características

- **Dashboard Ejecutivo**: Vista clara de flujo de caja y presupuestos.
- **Gestión de Clientes**: Seguimiento de anticipos y saldos.
- **Control de Gastos**: Registro de gastos operativos en efectivo y tarjeta.
- **Seguridad**: Autenticación integrada.

---
*Desarrollado con excelencia operativa.*
