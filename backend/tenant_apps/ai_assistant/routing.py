from django.urls import re_path

from .consumers import AIInboxConsumer

websocket_urlpatterns = [
    re_path(r"^ws/ai/inbox/$", AIInboxConsumer.as_asgi()),
]
