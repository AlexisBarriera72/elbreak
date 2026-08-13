# El Break Food Truck

Carta y órdenes de [El Break Food Truck](https://instagram.com/el_break_food_truck) — Yauco, Puerto Rico.

Sitio estático. Sin framework, sin dependencias, sin `node_modules`. El HTML se
genera a partir de dos archivos de datos y se sube tal cual.

**Peso total: ~678 KB**, fotos y tipografías incluidas.

---

## Empezar

Hace falta **Node 18 o superior**. Nada más — no hay `npm install`.

```bash
npm run dev      # compila y sirve en http://localhost:4321
npm run build    # genera dist/
npm test         # 39 pruebas, sin dependencias
```

---

## Cambiar la carta

Todo el contenido vive en dos archivos. **No hay que tocar el HTML.**

| Qué quieres cambiar | Archivo |
| --- | --- |
| Platos, precios, descripciones, fotos | `src/data/menu.json` |
| Teléfono, horario, dirección, Instagram | `src/data/site.json` |
| Versículos de la tarjeta | `src/data/versiculos.json` |

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

**Por WhatsApp, y solo por WhatsApp.** El cliente arma su orden y le da a
«Enviar por WhatsApp». Se le abre WhatsApp con la orden ya escrita y solo tiene
que darle a enviar. Te llega como un mensaje normal, desde su número.

No hay servidor de por medio, no hay base de datos y no hay nada que
configurar: funciona desde el primer despliegue. El número al que llegan las
órdenes es el campo `whatsapp` de `site.json`.

---

## Cambiar el horario de un día suelto

Entra en **`/panel`** y escribe la clave. Hay tres botones:

| Botón | Para qué |
| --- | --- |
| **Marcar cerrado** | tocaba trabajar y al final no sales |
| **Abrir hoy** | una fiesta, un evento, un domingo suelto |
| **Volver al horario normal** | deshacer lo anterior |

Al abrir un día que no toca se proponen las horas de siempre (11:00 am – 2:00
pm), pero puedes cambiarlas: si el evento es de noche, pones 5:00 pm – 10:00 pm
y el sitio lo dice tal cual, con su aviso de «cierra pronto» y todo.

**No hay que acordarse de deshacerlo.** Lo guardado lleva la fecha dentro, así
que en cuanto deja de ser hoy el truck vuelve solo a su horario. Si se te
olvida, no pasa nada. «Volver al horario normal» solo hace falta si te
arrepientes el mismo día.

La página no está enlazada desde ningún sitio y lleva `noindex`, pero lo que la
protege de verdad es la clave. **Que sea larga.**

### Qué hay que configurar una vez

En Vercel, `Settings → Environment Variables`. Los cuatro valores están
explicados en `.env.example`:

| Variable | De dónde sale |
| --- | --- |
| `PANEL_CLAVE` | te la inventas tú |
| `GLOBAL_CONFIG_ID` | Storage → Global Config → Create |
| `GLOBAL_CONFIG_READ_TOKEN` | Global Config → Tokens |
| `VERCEL_API_TOKEN` | Account Settings → Tokens |

> `VERCEL_API_TOKEN` vale para toda tu cuenta de Vercel: trátalo como una
> contraseña. Solo lo usa la función en el servidor, nunca llega al navegador.

**Si no configuras nada, no se rompe nada**: el sitio funciona con su horario
de siempre y `/panel` simplemente dice que no está configurado.

---

## Los versículos

Gira uno por día, a medianoche en Yauco. Con los 123 que hay, un cliente que
venga cada semana tarda unos cuatro meses en ver uno repetido.

Para añadir más, pega otra línea al final de la lista en
`src/data/versiculos.json`:

```json
{ "texto": "Lo que quieras poner.", "cita": "Libro 1:1" }
```

No hay que tocar nada más: el ciclo se alarga solo. Todo el que abra la página
el mismo día ve el mismo versículo, y no cambia al recargar.

---

## Publicar

El sitio es estático y corre igual en los tres.

### Cloudflare Pages — recomendado

Su plan gratuito **permite uso comercial**, que es lo que es un food truck.

1. Sube el repositorio a GitHub.
2. Cloudflare Pages → **Create a project** → conecta el repositorio.
3. Configuración:
   - Build command: `npm run build`
   - Build output directory: `dist`

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
  data/versiculos.json    ← los 123 versículos
  build.js                ← genera dist/. Sin dependencias.
  dev.js                  ← servidor local
  templates/pagina.js     ← el HTML
  templates/panel.js      ← la página de /panel

public/                   ← se copia tal cual a dist/
  assets/css/app.css
  assets/js/horario.js    ← horario y fechas. Lo usan navegador, build y función.
  assets/js/versiculo.js  ← qué versículo toca hoy
  assets/js/carrito.js    ← carrito y mensaje de WhatsApp
  assets/js/formato.js    ← formato de precios
  assets/js/app.js        ← conecta todo con la página
  assets/js/panel.js      ← los tres botones de /panel
  assets/img/  fonts/
  _headers                ← caché y seguridad (Cloudflare y Netlify)

api/estado.js             ← lee y escribe la excepción del día

test/                     ← 39 pruebas con el runner de Node
```

Cuatro decisiones que conviene no deshacer:

- **El horario se calcula una sola vez.** `horario.js` lo importan el navegador
  y el script de build. Si se duplica la lógica, tarde o temprano el pie de
  página dice una cosa y la píldora otra.
- **La hora es la del truck, no la del visitante.** Todo se calcula en
  `America/Puerto_Rico`. Alguien mirando desde Orlando necesita saber si está
  abierto en Yauco.
- **La carta va escrita en el HTML**, no la pinta JavaScript. Por eso Google la
  lee y por eso el sitio sirve aunque el JavaScript falle. El JavaScript solo
  añade el estado en vivo y el carrito.
- **La excepción del panel lleva la fecha dentro, no es un sí/no.** Es lo que
  hace que el truck vuelva solo a su horario al día siguiente. Si algún día se
  cambia por un booleano, un despiste deja el sitio mintiendo para siempre.

---

## Licencia

Privado. Fotos, logo y textos son de El Break Food Truck.
