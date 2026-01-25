"""
Schema Builder app configuration.

Bundle One: Custom System Data - Django Admin Enhancements
Provides CRUD functionality for Data Schemas and Fields with versioning.
"""
from django.apps import AppConfig


class SchemaBuilderConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.schema_builder'
    verbose_name = 'Schema Builder'
    
    def ready(self):
        # Import signals if needed
        pass
