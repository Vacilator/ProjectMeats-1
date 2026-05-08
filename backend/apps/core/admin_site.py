"""
Custom Django Admin Site Configuration for ProjectMeats.

Implements three-tiered configuration hierarchy:
1. Root Level (System-Wide): Superuser-only, affects all tenants globally
2. System Level: Shared templates, choice lists, blueprints
3. Tenant Level: Tenant-specific business data and overrides

Design Philosophy:
- Changes flow downward: Root → System → Tenant
- Tenant admins only see their tenant's data
- System admins manage shared resources
- Root/superusers manage infrastructure
"""
from django.contrib import admin
from django.utils.safestring import mark_safe


class MeatsCentralAdminSite(admin.AdminSite):
    """
    Custom admin site with branded UI and three-tier organization.
    """

    site_header = "🥩 Meats Central Administration"
    site_title = "Meats Central Admin"
    index_title = "System Dashboard"

    def index(self, request, extra_context=None):
        """
        Custom admin index with three-tier organization.
        """
        extra_context = extra_context or {}

        # Add tier information based on user permissions
        if request.user.is_superuser:
            extra_context["user_tier"] = "root"
            extra_context["tier_description"] = mark_safe(
                '<div class="help" style="margin-bottom: 20px; padding: 15px; background: #e8f5e9; border-left: 4px solid #4caf50;">'
                "<strong>🔑 Root Access</strong><br>"
                "You have full system access. Changes at Root level affect all tenants."
                "</div>"
            )
        elif request.user.is_staff:
            extra_context["user_tier"] = "tenant"
            extra_context["tier_description"] = mark_safe(
                '<div class="help" style="margin-bottom: 20px; padding: 15px; background: #e3f2fd; border-left: 4px solid #2196f3;">'
                "<strong>🏢 Tenant Administrator</strong><br>"
                "You manage your tenant's data. System-level templates and configurations are inherited."
                "</div>"
            )

        return super().index(request, extra_context=extra_context)

    def get_app_list(self, request, app_label=None):
        """
        Custom app ordering with three-tier grouping.

        Order:
        1. ROOT LEVEL (🔒): User management, infrastructure
        2. SYSTEM LEVEL (⚙️): Configurations, templates, blueprints
        3. TENANT LEVEL (🏢): Business data
        """
        app_list = super().get_app_list(request, app_label)

        # Define tier order with emojis
        tier_order = {
            # ROOT LEVEL (Infrastructure)
            "auth": ("🔒 Root", 0, "User & Permission Management"),
            "authtoken": ("🔒 Root", 0, "API Authentication"),
            # SYSTEM LEVEL (Configuration & Templates)
            "system": ("⚙️ System Configuration", 1, "Global Templates & Choice Lists"),
            "system_config": ("⚙️ System Configuration", 1, "System Blueprints"),
            "tenants": ("⚙️ System Configuration", 1, "Tenant Management"),
            "core": ("⚙️ System Configuration", 1, "Core Models & Settings"),
            # TENANT LEVEL (Business Data)
            "suppliers": ("🏢 Tenant Data", 2, "Supply Chain"),
            "customers": ("🏢 Tenant Data", 2, "Customer Relations"),
            "carriers": ("🏢 Tenant Data", 2, "Logistics"),
            "purchase_orders": ("🏢 Tenant Data", 2, "Purchasing"),
            "sales_orders": ("🏢 Tenant Data", 2, "Sales"),
            "orders": ("🏢 Tenant Data", 2, "Order Management"),
            "products": ("🏢 Tenant Data", 2, "Product Catalog"),
            "invoices": ("🏢 Tenant Data", 2, "Accounting"),
            "plants": ("🏢 Tenant Data", 2, "Facility Management"),
            "locations": ("🏢 Tenant Data", 2, "Locations"),
            "contacts": ("🏢 Tenant Data", 2, "Contact Management"),
            "inquiries": ("🏢 Tenant Data", 2, "Sales Inquiries"),
            "fulfillments": ("🏢 Tenant Data", 2, "Order Fulfillment"),
            "workflows": ("🏢 Tenant Data", 2, "Automated Workflows"),
            "cockpit": ("🏢 Tenant Data", 2, "Dashboard & Analytics"),
            "ai_assistant": ("🏢 Tenant Data", 2, "AI Tools"),
            "bug_reports": ("🏢 Tenant Data", 2, "Issue Tracking"),
        }

        # Group apps by tier
        for app in app_list:
            app_label = app["app_label"]
            if app_label in tier_order:
                tier_name, tier_level, tier_desc = tier_order[app_label]
                app["tier_name"] = tier_name
                app["tier_level"] = tier_level
                app["tier_description"] = tier_desc
            else:
                # Unknown apps go to tenant level by default
                app["tier_name"] = "🏢 Tenant Data"
                app["tier_level"] = 2
                app["tier_description"] = "Miscellaneous"

        # Sort: tier level, then app name
        app_list.sort(key=lambda x: (x.get("tier_level", 99), x.get("tier_name", "zzz"), x["name"]))

        # Add tier headers
        current_tier = None
        result = []
        for app in app_list:
            tier_name = app.get("tier_name")
            if tier_name != current_tier:
                current_tier = tier_name
                # Add visual separator in app list
                app["is_tier_header"] = True
            result.append(app)

        return result


# Create singleton instance
admin_site = MeatsCentralAdminSite(name="meatscentral_admin")
