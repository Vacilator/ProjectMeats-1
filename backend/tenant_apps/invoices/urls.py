"""URL configuration for invoices app."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ClaimViewSet, InvoiceViewSet, PaymentTransactionViewSet

router = DefaultRouter()
router.register(r"invoices", InvoiceViewSet, basename="invoice")
router.register(r"claims", ClaimViewSet, basename="claim")
router.register(r"payments", PaymentTransactionViewSet, basename="payment")

urlpatterns = [
    path("", include(router.urls)),
]
