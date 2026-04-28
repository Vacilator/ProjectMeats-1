from django.urls import re_path

from apps.core.consumers import EntityMutationConsumer

websocket_urlpatterns = [
    re_path(r'^ws/entities/mutations/$', EntityMutationConsumer.as_asgi()),
]
