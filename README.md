# El Break Food Truck

Carta y órdenes de [El Break Food Truck](https://instagram.com/el_break_food_truck) — Yauco, Puerto Rico.

Sitio estático. Sin framework, sin dependencias, sin `node_modules`. El HTML se
genera a partir de dos archivos de datos y se sube tal cual.

**Peso total: ~658 KB**, fotos y tipografías incluidas.

---

## Empezar

Hace falta **Node 18 o superior**. Nada más — no hay `npm install`.

```bash
npm run dev      # compila y sirve en http://localhost:4321
npm run build    # genera dist/
npm test         # 29 pruebas, sin dependencias
```

---

## Cambiar la carta

Todo el contenido vive en dos archivos. **No hay que tocar el HTML.**

| Qué quieres cambiar | Archivo |
| --- | --- |
| Platos, precios, descripciones, fotos | `src/data/menu.json` |
| Teléfono, horario, dirección, Instagram | `src/data/site.json` |

Un precio se escribe **una sola vez**. De ahí sale la carta, el creador de
bowls, el carrito y el mensaje de WhatsApp, así que no pueden contradecirse.

### Subir un precio

```json
{ "id": "burger-el-break", "nombre": "El Break Burger", "precio": 9 }
```

Cambia el `9`, guarda, `git push`. El host recompila solo.

### Añadir un plato

Añádelo al grupo que toque en `menu.json`:

```json
{
  "id": "burger-nueva",
  "nombre": "Burger Nueva",
  "precio": 11,
  "desc": "Lo que lleva.",
  "foto": null
}
```

`"foto": null` hace que el plato salga como una línea de carta impresa, con
puntos hasta el precio. Si le pones foto, sale como tarjeta con imagen. **No
hace falta tener foto de todo**: la página está pensada para mezclar los dos
formatos, y así no hay que inventar imágenes.

Para añadir foto: mete el `.jpg` en `public/assets/img/` y pon el nombre del
archivo, el `alt` y las medidas:

```json
{ "foto": "burger-nueva.jpg", "alt": "Descripción para quien no la ve.", "ancho": 900, "alto": 675 }
```

Que no pase de **900 px de ancho ni de 100 KB**.

### Cambiar el horario

En `site.json`. Las llaves son el día de la semana (1 = lunes … 7 = domingo):

```json
"horario": {
  "3": { "abre": "11:00", "cierra": "14:00" },
  "4": { "abre": "11:00", "cierra": "14:00" },
  "5": { "abre": "11:00", "cierra": "14:00" }
}
```

Con eso se actualizan a la vez el aviso de «Abierto ahora», el pie de página y
los datos que lee Google. Si abres un sábado, añade `"6": { ... }` y ya.

---

## Cómo llegan las órdenes

Hay dos caminos, y el segundo es opcional.

**1. WhatsApp (siempre activo, sin configurar nada).**
El cliente arma su orden y le da a «Enviar por WhatsApp». Se le abre WhatsApp
con la orden ya escrita y solo tiene que darle a enviar. Te llega como un
mensaje normal. No hay servidor de por medio.

**2. Telegram (opcional, para que quede constancia).**
Además, el sitio avisa a un bot de Telegram. Sirve por si el cliente arma la
orden y no llega a darle a enviar en WhatsApp. **Si no lo configuras, no pasa
nada**: el sitio funciona igual desde el primer despliegue.

### Configurar el aviso de Telegram

1. En Telegram, escribe a **@BotFather** y manda `/newbot`. Te da un token:
   `8123456789:AAH0k2Lp-Qxxxxxxxxxxxxxxxxxxxxx`
2. Abre un chat con tu bot nuevo y mándale cualquier cosa («hola»).
3. Entra en `https://api.telegram.org/bot<TU_TOKEN>/getUpdates` y busca
   `"chat":{"id":123456789` — ese número es tu chat.
4. Mete los dos valores en el panel del host:

   | Variable | Valor |
   | --- | --- |
   | `TELEGRAM_BOT_TOKEN` | el token de BotFather |
   | `TELEGRAM_CHAT_ID` | el número del paso 3 |

Instala Telegram en el teléfono, activa las notificaciones de ese chat y ya
suena cada vez que alguien manda una orden.

> El token va **solo** en el panel del host, nunca en el repositorio.
> `.env` está en `.gitignore` para que no se suba por accidente.

---

## Publicar

El sitio corre igual en los tres. La función de `/api/order` está escrita con
`Request`/`Response` estándar y cada host tiene su adaptador de tres líneas.

### Cloudflare Pages — recomendado

Su plan gratuito **permite uso comercial**, que es lo que es un food truck.

1. Sube el repositorio a GitHub.
2. Cloudflare Pages → **Create a project** → conecta el repositorio.
3. Configuración:
   - Build command: `npm run build`
   - Build output directory: `dist`
4. Settings → Environment variables → añade las dos de Telegram (si las usas).

Las funciones de `functions/api/` se publican solas.

### Netlify

También **permite uso comercial** en el plan gratuito. `netlify.toml` ya lo
deja configurado: conecta el repositorio y listo.

### Vercel

`vercel.json` ya está puesto. Conecta el repositorio y detecta todo.

> **Ojo con el plan.** El plan Hobby de Vercel es para proyectos personales sin
> ánimo de lucro. Un sitio que recibe órdenes de clientes es uso comercial, y
> eso pide el plan Pro (20 $/mes). Por eso arriba está recomendado Cloudflare
> Pages: mismo resultado, gratis, sin esa restricción.

---

## Cómo está montado

```
src/
  data/menu.json          ← platos y precios (fuente única)
  data/site.json          ← teléfono, horario, dirección
  build.js                ← genera dist/. Sin dependencias.
  dev.js                  ← servidor local con /api/order
  templates/pagina.js     ← el HTML
  order-handler.js        ← aviso de Telegram (Request → Response)

public/                   ← se copia tal cual a dist/
  assets/css/app.css
  assets/js/horario.js    ← horario. Lo usan el navegador y el build.
  assets/js/carrito.js    ← carrito y mensaje de WhatsApp
  assets/js/formato.js    ← formato de precios
  assets/js/app.js        ← conecta todo con la página
  assets/img/  fonts/
  _headers                ← caché y seguridad (Cloudflare y Netlify)

api/order.js              ← adaptador Vercel
functions/api/order.js    ← adaptador Cloudflare Pages
netlify/functions/order.mjs ← adaptador Netlify

test/                     ← 29 pruebas con el runner de Node
```

Tres decisiones que conviene no deshacer:

- **El horario se calcula una sola vez.** `horario.js` lo importan el navegador
  y el script de build. Si se duplica la lógica, tarde o temprano el pie de
  página dice una cosa y la píldora otra.
- **La hora es la del truck, no la del visitante.** Todo se calcula en
  `America/Puerto_Rico`. Alguien mirando desde Orlando necesita saber si está
  abierto en Yauco.
- **La carta va escrita en el HTML**, no la pinta JavaScript. Por eso Google la
  lee y por eso el sitio sirve aunque el JavaScript falle. El JavaScript solo
  añade el estado en vivo y el carrito.

---

## Licencia

Privado. Fotos, logo y textos son de El Break Food Truck.
