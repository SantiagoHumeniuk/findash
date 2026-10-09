# Arquitectura del Proyecto: Financytics

Este documento describe los principios de diseño, patrones y decisiones técnicas que conforman la arquitectura de la aplicación Financytics.

## 1. Principios de Diseño Fundamentales

* **Estructura Basada en Features (Feature-Sliced Design):** El código se organiza por dominio de negocio (`dashboard`, `portfolio`, `auth`) en lugar de por tipo de archivo (`pages`, `components`). Esto mejora la cohesión, reduce el acoplamiento y hace que el proyecto sea más fácil de escalar.
* **Separación de Responsabilidades (SoC):** Se busca una clara distinción entre la capa de UI (componentes), la capa de estado/lógica (hooks) y la capa de servicios (llamadas a API, cálculos).
* **Seguridad de Tipos de Extremo a Extremo:** TypeScript se utiliza en modo estricto. Las respuestas de APIs externas son validadas (idealmente con Zod) para garantizar la integridad de los datos en toda la aplicación.
* **Rendimiento Primero:** Se priorizan técnicas como el *lazy loading* de rutas y la memoización de componentes para asegurar una experiencia de usuario rápida y fluida.

## 2. Flujo de Datos y Manejo de Estado

La aplicación utiliza un modelo de estado híbrido:

1.  **Estado Global del Servidor (Server State):** Gestionado por **TanStack Query (React Query)**. Es la fuente de verdad para todos los datos que provienen de una API (datos de activos, noticias, dividendos). React Query se encarga del cacheo, la revalidación en segundo plano y los estados de carga/error.

2.  **Estado Global del Cliente (Client State):** Gestionado a través de **React Context** (`Providers`). Se limita a datos que definen el estado de la UI global y no son asíncronos, como:
    * `AuthProvider`: Estado de la sesión del usuario.
    * `ConfigProvider`: Configuración de la aplicación cargada desde `config.json`.
    * `DashboardProvider`: La lista de `selectedTickers` (un simple array de strings).

3.  **Estado Local del Componente:** Gestionado con `useState` y `useReducer` para estados que solo afectan a un único componente (ej: el valor de un input en un formulario).

### Flujo Típico de una Petición de Datos

```
1. Componente de UI -> Llama al hook `useAssetData('AAPL')`.
2. `useAssetData` (React Query) -> Comprueba si hay datos frescos en caché.
   - Si los hay: Devuelve los datos cacheados instantáneamente.
   - Si no los hay (o están obsoletos):
     3. Llama a la `queryFn` (ej: `fetchTickerData`).
     4. `fetchTickerData` (Capa de Servicio) -> Realiza la llamada a la Supabase Edge Function.
     5. Supabase -> Llama a la API externa (FMP).
     6. Los datos regresan, son procesados y cacheados por React Query.
7. El componente se actualiza con los nuevos datos.
```

## 3. Decisiones Técnicas Clave

### ¿Por qué Vite en lugar de Create React App?
Vite ofrece un arranque en desarrollo casi instantáneo (HMR) y un proceso de build optimizado gracias al uso de esbuild, lo que acelera significativamente el ciclo de desarrollo.

### ¿Por qué Supabase?
Supabase fue elegido como un backend-as-a-service integral que proporciona:
* **Autenticación:** Solución completa y segura para la gestión de usuarios.
* **Base de Datos PostgreSQL:** Una base de datos relacional robusta y escalable.
* **Edge Functions:** Permiten crear un proxy seguro para ocultar las claves de API de servicios externos (FMP) y controlar el rate-limiting desde el servidor.

### ¿Por qué TanStack Query (React Query)?
Reemplaza la gestión manual de estado asíncrono. Resuelve de forma nativa problemas complejos como:
* Cacheo y deduplicación de peticiones.
* Revalidación de datos en segundo plano.
* Gestión de estados de `isLoading`, `isError`, `isSuccess`.
* Paginación y consultas de datos infinitas.

### ¿Por qué shadcn/ui y Tailwind CSS?
Esta combinación ofrece la máxima flexibilidad. No es una librería de componentes tradicional, sino una colección de componentes reutilizables que se copian en el proyecto. Esto permite una personalización total del estilo a través de Tailwind CSS sin estar atado a las opiniones de diseño de una librería externa.

## 4. Proveedores de datos financieros

### Acciones: FMP y Yahoo Finance

FMP sigue siendo el proveedor principal de estados financieros, calificaciones y demás datos fundamentales. Yahoo Finance complementa las cotizaciones cuando devuelve valores disponibles —incluidos PER y EPS forward— y se usa como fallback si la consulta o los datos esenciales de FMP fallan. Los precios de Yahoo sustituyen a los de FMP únicamente cuando Yahoo informa una cotización más reciente.

La verificación del límite del plan sucede antes de consultar cualquiera de los proveedores. Si el usuario no tiene llamadas FMP disponibles, se usa la caché válida o se muestra el error; Yahoo no se consulta para eludir el límite. Un fallback Yahoo exitoso también cuenta como una consulta de activo. Las métricas de variación de Yahoo se conservan en puntos porcentuales y su historial se ordena cronológicamente antes de calcular cambios.

El comparador histórico SPY/QQQ consulta ambos índices en una operación Yahoo únicamente al seleccionarlo, verifica y actualiza el contador diario del usuario, y normaliza el portafolio y el índice como retornos porcentuales desde el mismo período. No se generan series simuladas para sustituir datos faltantes. La analítica y el historial del portafolio reutilizan el `AssetData` ya cargado para evitar consultas paralelas por cada holding.

Para publicar el proxy actualizado de Yahoo Finance:

```bash
supabase functions deploy yahoo-finance-proxy
```

### Renta fija argentina: DATA912

La pestaña **Renta Fija en Vivo** consulta los endpoints públicos `/live/arg_bonds` y `/live/arg_corp` a través de `data912-fixed-income-proxy`, y muestra por separado bonos soberanos y obligaciones negociables. La pantalla actualiza las cotizaciones cada 30 segundos. DATA912 es un feed público separado del contador de consultas de activos; si falla uno de sus endpoints, la respuesta conserva y muestra los datos del otro junto con el error parcial.

Desde la raíz del proyecto, publicar la función nueva con:

```bash
supabase functions deploy data912-fixed-income-proxy
```

### Variables macroeconómicas: ArgentinaDatos y Dolarazo

Las cotizaciones de dólares, inflación, plazos fijos y UVA, junto con la fuente alternativa Dolarazo, se solicitan a través de `argentina-macro-proxy`. Esto evita depender de políticas CORS inconsistentes de los proveedores, en particular la restricción de origen del endpoint UVA de ArgentinaDatos. El proxy acepta únicamente recursos predefinidos y valida los errores de respuesta antes de mostrarlos en la interfaz.

```bash
supabase functions deploy argentina-macro-proxy
```

Después del despliegue de ambas funciones y del frontend actualizado, verificar en Supabase que `data912-fixed-income-proxy` devuelva `fetchedAt`, `sovereign`, `corporate` y el objeto `errors`. La API de cotizaciones no incluye calendarios de cupones, amortizaciones ni flujos de fondos. La aplicación muestra vencimientos solo cuando se identifican en el ticker o en el mapeo local de series soberanas; las fechas inferidas deben cotejarse con la ficha oficial del instrumento. Estima TIR solo para letras cero cupón; para los demás instrumentos indica que no está disponible, en vez de presentar una tasa inventada. La TIR de un bono con cupones requiere además un calendario completo de pagos y un precio de liquidación comparable, por lo que no se debe derivar de la cotización sola.