from odoo import api, fields, models


class FoodOrder(models.Model):
    _name = "food.order"
    _description = "Food Order"
    _order = "create_date desc"

    name = fields.Char(string="Referencia", required=True, copy=False, default="Nuevo")
    customer_name = fields.Char(string="Cliente", required=True)
    customer_phone = fields.Char(string="Telefono")
    customer_address = fields.Text(string="Direccion")
    total_amount = fields.Float(string="Total", required=True)
    order_type = fields.Selection(
        [("delivery", "Delivery"), ("pickup", "Recoger"), ("dine_in", "Consumir en local")],
        string="Tipo de pedido",
        default="delivery",
        required=True,
    )
    scheduled_slot = fields.Selection(
        [
            ("asap", "Lo antes posible"),
            ("15", "En 15 minutos"),
            ("30", "En 30 minutos"),
            ("45", "En 45 minutos"),
            ("60", "En 60 minutos"),
        ],
        string="Horario",
        default="asap",
        required=True,
    )
    customer_note = fields.Text(string="Notas del cliente")
    promo_code = fields.Char(string="Codigo promocional")
    is_priority = fields.Boolean(string="Pedido prioritario")
    service_fee = fields.Float(string="Cargo de servicio")
    priority_fee = fields.Float(string="Cargo prioritario")
    discount_amount = fields.Float(string="Descuento")
    state = fields.Selection(
        [("new", "Nuevo"), ("done", "Completado"), ("cancel", "Cancelado")],
        string="Estado",
        default="new",
        required=True,
    )
    payment_status = fields.Selection(
        [("unpaid", "No pagado"), ("paid", "Pagado")],
        string="Pago",
        default="unpaid",
        required=True,
    )
    payment_method = fields.Selection(
        [("cash", "Efectivo"), ("card", "Tarjeta"), ("transfer", "Transferencia")],
        string="Metodo de pago",
    )
    payment_reference = fields.Char(string="Referencia de pago")
    paid_amount = fields.Float(string="Monto pagado")
    paid_at = fields.Datetime(string="Fecha de pago")
    line_ids = fields.One2many("food.order.line", "order_id", string="Lineas")
    item_count = fields.Integer(string="Items", compute="_compute_order_metrics", store=True)
    estimated_ready_minutes = fields.Integer(
        string="Tiempo estimado (min)", compute="_compute_order_metrics", store=True
    )

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get("name", "Nuevo") == "Nuevo":
                vals["name"] = self.env["ir.sequence"].next_by_code("food.order") or "Nuevo"
        return super().create(vals_list)

    @api.depends("line_ids.quantity", "order_type", "is_priority")
    def _compute_order_metrics(self):
        for order in self:
            total_items = sum(order.line_ids.mapped("quantity"))
            base_minutes = 15 if order.order_type == "pickup" else 25
            if order.order_type == "dine_in":
                base_minutes = 18
            extra_minutes = max(total_items - 2, 0) * 4
            priority_discount = 5 if order.is_priority else 0

            order.item_count = total_items
            order.estimated_ready_minutes = max(base_minutes + extra_minutes - priority_discount, 10)


class FoodOrderLine(models.Model):
    _name = "food.order.line"
    _description = "Food Order Line"

    order_id = fields.Many2one("food.order", string="Pedido", required=True, ondelete="cascade")
    product_name = fields.Char(string="Producto", required=True)
    category = fields.Char(string="Categoria")
    quantity = fields.Integer(string="Cantidad", required=True, default=1)
    unit_price = fields.Float(string="Precio Unitario", required=True)
    subtotal = fields.Float(string="Subtotal", compute="_compute_subtotal", store=True)

    @api.depends("quantity", "unit_price")
    def _compute_subtotal(self):
        for line in self:
            line.subtotal = line.quantity * line.unit_price
