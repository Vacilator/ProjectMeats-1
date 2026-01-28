"""URL configuration for Inquiries app."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import InquiryViewSet, InquiryProductViewSet

router = DefaultRouter()
router.register(r'inquiries', InquiryViewSet, basename='inquiry')
router.register(r'inquiry-products', InquiryProductViewSet, basename='inquiry-product')

urlpatterns = [
    path('', include(router.urls)),
]
