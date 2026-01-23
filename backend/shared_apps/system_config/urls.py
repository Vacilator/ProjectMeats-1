from django.urls import path
from .views import StudioView

app_name = 'system_config'

urlpatterns = [
    # Blueprint Studio view
    path('studio/<uuid:blueprint_id>/', StudioView.as_view(), name='studio'),
]
