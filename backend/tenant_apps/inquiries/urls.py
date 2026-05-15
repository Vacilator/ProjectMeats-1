"""URL configuration for Inquiries app."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import InquiryViewSet, InquiryProductViewSet, InquiryProductSupplierBidViewSet, InquiryTemplateViewSet
from .views_trades import TradePipelineViewSet

router = DefaultRouter()
router.register(r'inquiries', InquiryViewSet, basename='inquiry')
router.register(r'inquiry-products', InquiryProductViewSet, basename='inquiry-product')
router.register(r'inquiry-product-bids', InquiryProductSupplierBidViewSet, basename='inquiry-product-bid')
router.register(r'inquiry-templates', InquiryTemplateViewSet, basename='inquiry-template')
router.register(r'trades', TradePipelineViewSet, basename='trade')

urlpatterns = [
    path('', include(router.urls)),
]
