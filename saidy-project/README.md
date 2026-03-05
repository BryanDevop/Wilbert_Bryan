# Proyecto Odoo 18 + React con Docker Compose

Estructura:

- `backend/`: configuracion de Odoo y addons personalizados.
- `frontend/`: app React (Vite).
- `docker-compose.yml`: orquestacion completa.

## Requisitos

- Docker Desktop instalado.

## Levantar el proyecto

Desde la raiz del proyecto:

```bash
docker compose up --build
```

Servicios:

- Odoo: http://localhost:8070
- React: http://localhost:5173

## Crear base de datos en Odoo

1. Abre http://localhost:8070
2. Crea una nueva base de datos.
3. Password maestro por defecto: `admin`

## Addons personalizados

Coloca tus modulos en:

`backend/addons/`

Luego reinicia Odoo:

```bash
docker compose restart odoo
```

## Modulo de pedidos de comida

Este proyecto ya incluye el modulo `food_orders` en:

`backend/addons/food_orders`

Para instalarlo en Odoo:

1. Entra a Odoo: http://localhost:8070
2. Activa modo desarrollador.
3. Ve a Apps y actualiza la lista de apps.
4. Busca `Food Orders` e instalalo.

Luego podras ver los pedidos creados desde React en el menu:

`Food Shop > Pedidos`

## Apagar servicios

```bash
docker compose down
```

Para borrar volumenes de datos:

```bash
docker compose down -v
```
