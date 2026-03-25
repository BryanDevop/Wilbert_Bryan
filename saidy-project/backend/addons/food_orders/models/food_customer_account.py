from odoo import fields, models


class FoodCustomerAccount(models.Model):
    _name = "food.customer.account"
    _description = "Food Customer Account"
    _order = "create_date desc"

    name = fields.Char(string="Nombre completo", required=True)
    business_name = fields.Char(string="Negocio", required=True)
    email = fields.Char(string="Correo", required=True)
    password_hash = fields.Char(string="Password Hash", required=True)
    active = fields.Boolean(default=True)

    _sql_constraints = [
        ("food_customer_account_email_unique", "unique(email)", "El correo ya existe en la plataforma."),
    ]
