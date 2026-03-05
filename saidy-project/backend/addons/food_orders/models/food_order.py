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

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get("name", "Nuevo") == "Nuevo":
                vals["name"] = self.env["ir.sequence"].next_by_code("food.order") or "Nuevo"
        return super().create(vals_list)


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