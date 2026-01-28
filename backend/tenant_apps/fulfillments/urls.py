"""URL configuration for Fulfillments app."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import FulfillmentViewSet, FulfillmentProductViewSet

router = DefaultRouter()
router.register(r'fulfillments', FulfillmentViewSet, basename='fulfillment')
router.register(r'fulfillment-products', FulfillmentProductViewSet, basename='fulfillment-product')

urlpatterns = [
    path('', include(router.urls)),
]
