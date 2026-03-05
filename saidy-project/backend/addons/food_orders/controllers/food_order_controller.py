from odoo import fields, http
from odoo.exceptions import ValidationError
from odoo.http import request


class FoodOrderController(http.Controller):
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

        if not customer_name:
            raise ValidationError("El nombre del cliente es obligatorio")

        if not items:
            raise ValidationError("El pedido debe tener al menos una linea")

        if pay_now and payment_method not in {"cash", "card", "transfer"}:
            raise ValidationError("Debes seleccionar un metodo de pago valido")

        line_values = []
        for item in items:
            quantity = int(item.get("quantity") or 0)
            unit_price = float(item.get("unit_price") or 0.0)
            product_name = (item.get("product_name") or "").strip()

            if not product_name:
                raise ValidationError("Cada linea debe tener un producto")
            if quantity <= 0:
                raise ValidationError("La cantidad debe ser mayor que 0")

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

        order_vals = {
            "customer_name": customer_name,
            "customer_phone": params.get("customer_phone") or "",
            "customer_address": params.get("customer_address") or "",
            "total_amount": total_amount,
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
        }