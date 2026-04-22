from odoo import fields, models


class FoodProduct(models.Model):
    _name = "food.product"
    _description = "Food Product"
    _order = "sequence, name"

    sequence = fields.Integer(default=10)
    name = fields.Char(string="Nombre", required=True)
    category = fields.Char(string="Categoria", required=True)
    description = fields.Text(string="Descripcion")
    price = fields.Float(string="Precio", required=True)
    emoji = fields.Char(string="Emoji", default="🍽️")
    rating = fields.Float(string="Rating", default=4.5)
    prep_time = fields.Integer(string="Tiempo de preparacion", default=15)
    tag = fields.Char(string="Etiqueta", default="Disponible")
    is_available = fields.Boolean(string="Disponible", default=True)
    active = fields.Boolean(default=True)

