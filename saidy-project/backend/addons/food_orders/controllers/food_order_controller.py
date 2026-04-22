from werkzeug.security import check_password_hash, generate_password_hash

from odoo import fields, http, release
from odoo.exceptions import ValidationError
from odoo.http import request


class FoodOrderController(http.Controller):
    def _session_payload(self, account):
        return {
            "uid": account.id,
            "full_name": account.name,
            "email": account.email,
            "business_name": account.business_name or "",
            "db": request.db,
        }

    @http.route("/food_orders/health", type="json", auth="public", methods=["POST"], csrf=False)
    def food_orders_health(self, **kwargs):
        return {
            "server_version": release.version,
            "server_version_info": list(release.version_info),
            "status": "ok",
            "db": request.session.db or request.db,
        }

    @http.route("/food_orders/session", type="json", auth="public", methods=["POST"], csrf=False)
    def food_orders_session(self, **kwargs):
        return {"authenticated": False, "db": request.db}

    @http.route("/food_orders/register", type="json", auth="public", methods=["POST"], csrf=False)
    def food_orders_register(self, **kwargs):
        params = kwargs or request.jsonrequest or {}
        if "params" in params and isinstance(params["params"], dict):
            params = params["params"]

        full_name = (params.get("full_name") or "").strip()
        business_name = (params.get("business_name") or "").strip()
        email = (params.get("email") or "").strip().lower()
        password = params.get("password") or ""
        confirm_password = params.get("confirm_password") or ""
        db_name = (params.get("db") or request.db or "").strip()

        if not db_name:
            raise ValidationError("No hay una base de datos seleccionada en Odoo")
        if not full_name or not business_name or not email or not password:
            raise ValidationError("Completa todos los campos requeridos")
        if password != confirm_password:
            raise ValidationError("La confirmacion de la contrasena no coincide")
        account_model = request.env["food.customer.account"].sudo()
        if account_model.search_count([("email", "=", email)]):
            raise ValidationError("Ya existe una cuenta con ese correo")

        account = account_model.create(
            {
                "name": full_name,
                "business_name": business_name,
                "email": email,
                "password_hash": generate_password_hash(password),
            }
        )

        return {"authenticated": True, "user": self._session_payload(account), "db": db_name}

    @http.route("/food_orders/login", type="json", auth="public", methods=["POST"], csrf=False)
    def food_orders_login(self, **kwargs):
        params = kwargs or request.jsonrequest or {}
        if "params" in params and isinstance(params["params"], dict):
            params = params["params"]

        email = (params.get("email") or "").strip().lower()
        password = params.get("password") or ""
        db_name = (params.get("db") or request.db or "").strip()

        if not db_name:
            raise ValidationError("No hay una base de datos seleccionada en Odoo")
        if not email or not password:
            raise ValidationError("Debes indicar correo y contrasena")

        account = request.env["food.customer.account"].sudo().search([("email", "=", email)], limit=1)
        if not account or not check_password_hash(account.password_hash, password):
            raise ValidationError("Correo o contrasena incorrectos")

        return {"authenticated": True, "user": self._session_payload(account), "db": db_name}

    @http.route("/food_orders/logout", type="json", auth="public", methods=["POST"], csrf=False)
    def food_orders_logout(self, **kwargs):
        return {"authenticated": False}

    @http.route("/food_orders/dashboard", type="json", auth="public", methods=["POST"], csrf=False)
    def food_orders_dashboard(self, **kwargs):
        orders = request.env["food.order"].sudo().search([], limit=5, order="create_date desc")
        paid_orders = request.env["food.order"].sudo().search_count([("payment_status", "=", "paid")])
        total_orders = request.env["food.order"].sudo().search_count([])
        revenue_data = request.env["food.order"].sudo().read_group(
            [("payment_status", "=", "paid")], ["total_amount:sum"], []
        )
        revenue = 0.0
        if revenue_data:
            revenue = revenue_data[0].get("total_amount_sum", revenue_data[0].get("total_amount", 0.0))

        return {
            "metrics": {
                "total_orders": total_orders,
                "paid_orders": paid_orders,
                "revenue": revenue,
                "satisfaction": min(92 + total_orders, 99),
            },
            "recent_orders": [
                {
                    "name": order.name,
                    "customer_name": order.customer_name,
                    "total_amount": order.total_amount,
                    "payment_status": order.payment_status,
                    "order_type": order.order_type,
                    "item_count": order.item_count,
                }
                for order in orders
            ],
        }

    @http.route("/food_orders/products", type="json", auth="public", methods=["POST"], csrf=False)
    def food_orders_products(self, **kwargs):
        products = request.env["food.product"].sudo().search(
            [("active", "=", True), ("is_available", "=", True)], order="sequence asc, name asc"
        )
        return {
            "products": [
                {
                    "id": product.id,
                    "name": product.name,
                    "category": product.category,
                    "price": product.price,
                    "emoji": product.emoji or "🍽️",
                    "rating": product.rating or 0,
                    "prepTime": product.prep_time or 0,
                    "tag": product.tag or "Disponible",
                    "description": product.description or "",
                }
                for product in products
            ]
        }

    @http.route("/food_orders/create", type="json", auth="public", methods=["POST"], csrf=False)
    def create_food_order(self, **kwargs):
        params = kwargs or request.jsonrequest or {}
        if "params" in params and isinstance(params["params"], dict):
            params = params["params"]

        customer_name = (params.get("customer_name") or "").strip()
        items = params.get("items") or []
        total_amount = float(params.get("total_amount") or 0.0)
        payment_method = (params.get("payment_method") or "").strip()
        payment_reference = (params.get("payment_reference") or "").strip()
        pay_now = bool(params.get("pay_now", True))
        order_type = (params.get("order_type") or "delivery").strip()
        scheduled_slot = (params.get("scheduled_slot") or "asap").strip()
        customer_note = (params.get("customer_note") or "").strip()
        promo_code = (params.get("promo_code") or "").strip()
        is_priority = bool(params.get("is_priority", False))
        service_fee = float(params.get("service_fee") or 0.0)
        priority_fee = float(params.get("priority_fee") or 0.0)
        discount_amount = float(params.get("discount_amount") or 0.0)

        if not customer_name:
            raise ValidationError("El nombre del cliente es obligatorio")

        if not items:
            raise ValidationError("El pedido debe tener al menos una linea")

        if pay_now and payment_method not in {"cash", "card", "transfer"}:
            raise ValidationError("Debes seleccionar un metodo de pago valido")

        if order_type not in {"delivery", "pickup", "dine_in"}:
            raise ValidationError("El tipo de pedido no es valido")

        if scheduled_slot not in {"asap", "15", "30", "45", "60"}:
            raise ValidationError("El horario seleccionado no es valido")

        line_values = []
        computed_total = 0.0
        for item in items:
            quantity = int(item.get("quantity") or 0)
            unit_price = float(item.get("unit_price") or 0.0)
            product_name = (item.get("product_name") or "").strip()

            if not product_name:
                raise ValidationError("Cada linea debe tener un producto")
            if quantity <= 0:
                raise ValidationError("La cantidad debe ser mayor que 0")
            if unit_price < 0:
                raise ValidationError("El precio unitario no puede ser negativo")

            computed_total += quantity * unit_price

            line_values.append(
                (
                    0,
                    0,
                    {
                        "product_name": product_name,
                        "category": item.get("category") or "",
                        "quantity": quantity,
                        "unit_price": unit_price,
                    },
                )
            )

        if service_fee < 0 or priority_fee < 0 or discount_amount < 0:
            raise ValidationError("Los ajustes del pedido no pueden ser negativos")

        expected_total = computed_total + service_fee + priority_fee - discount_amount
        if abs(expected_total - total_amount) > 0.01:
            raise ValidationError("El total del pedido no coincide con el detalle enviado")

        order_vals = {
            "customer_name": customer_name,
            "customer_phone": params.get("customer_phone") or "",
            "customer_address": params.get("customer_address") or "",
            "total_amount": total_amount,
            "order_type": order_type,
            "scheduled_slot": scheduled_slot,
            "customer_note": customer_note,
            "promo_code": promo_code,
            "is_priority": is_priority,
            "service_fee": service_fee,
            "priority_fee": priority_fee,
            "discount_amount": discount_amount,
            "line_ids": line_values,
            "payment_status": "paid" if pay_now else "unpaid",
            "payment_method": payment_method or False,
            "payment_reference": payment_reference,
            "paid_amount": total_amount if pay_now else 0.0,
            "paid_at": fields.Datetime.now() if pay_now else False,
        }

        order = request.env["food.order"].sudo().create(order_vals)

        return {
            "order_id": order.id,
            "order_name": order.name,
            "payment_status": order.payment_status,
            "payment_method": order.payment_method,
            "estimated_ready_minutes": order.estimated_ready_minutes,
        }
