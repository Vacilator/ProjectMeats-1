"""
Django Admin Site Configuration for ProjectMeats.

Wave 4 Enhancement: Customized admin site with emoji-grouped sections.

Admin Panel Organization:
- 🏢 Tenants: Multi-tenancy management
- ⚙️ System: Configuration and settings
- 📦 Products: Product catalog
- 🛒 Orders: Purchase and sales orders
- 👥 CRM: Customers, suppliers, contacts
- 🏭 Operations: Plants, carriers, fulfillments
- 📊 Reports: Analytics and reporting
- 🔐 Auth: Authentication and permissions
"""
from django.contrib import admin


class ProjectMeatsAdminSite(admin.AdminSite):
    """
    Custom admin site for ProjectMeats with enhanced UI.

    Features:
    - Custom branding
    - Emoji-organized sections
    - Quick links to common tasks
    """

    site_header = "🥩 Meats Central Admin"
    site_title = "Meats Central"
    index_title = "Admin Dashboard"

    # Enable sidebar by default (Django 3.1+)
    enable_nav_sidebar = True

    def get_app_list(self, request, app_label=None):
        """
        Customize app list with emoji prefixes and reordering.

        Groups:
        1. System & Config (most important)
        2. Tenants
        3. Business apps (alphabetical)
        4. Auth (last)
        """
        app_list = super().get_app_list(request, app_label)

        # Define emoji prefixes for apps
        app_emojis = {
            "system": "⚙️ ",
            "tenants": "🏢 ",
            "suppliers": "🏭 ",
            "customers": "👥 ",
            "contacts": "📇 ",
            "products": "📦 ",
            "purchase_orders": "🛒 ",
            "sales_orders": "💰 ",
            "invoices": "📄 ",
            "plants": "🏗️ ",
            "carriers": "🚚 ",
            "locations": "📍 ",
            "fulfillments": "📬 ",
            "cockpit": "🎛️ ",
            "workflows": "🔄 ",
            "inquiries": "❓ ",
            "ai_assistant": "🤖 ",
            "bug_reports": "🐛 ",
            "auth": "🔐 ",
            "authtoken": "🔑 ",
            "core": "🔧 ",
        }

        # Define priority order (lower = higher priority)
        app_priority = {
            "system": 1,
            "tenants": 2,
            "products": 10,
            "customers": 11,
            "suppliers": 12,
            "contacts": 13,
            "purchase_orders": 20,
            "sales_orders": 21,
            "invoices": 22,
            "plants": 30,
            "carriers": 31,
            "locations": 32,
            "fulfillments": 33,
            "cockpit": 40,
            "workflows": 41,
            "inquiries": 42,
            "ai_assistant": 50,
            "bug_reports": 51,
            "core": 90,
            "auth": 98,
            "authtoken": 99,
        }

        # Add emojis to app names
        for app in app_list:
            app_name = app["app_label"]
            emoji = app_emojis.get(app_name, "")
            if emoji:
                app["name"] = f"{emoji}{app['name']}"

        # Sort by priority
        def get_priority(app):
            return app_priority.get(app["app_label"], 50)

        app_list.sort(key=get_priority)

        return app_list


# Create a single instance of our custom admin site
admin_site = ProjectMeatsAdminSite(name="projectmeats_admin")

# To use this custom site, update urls.py to use:
# from projectmeats.admin import admin_site
# path("admin/", admin_site.urls),
