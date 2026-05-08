from django.core.exceptions import RequestDataTooBig, SuspiciousOperation
from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory
from rest_framework.views import APIView

from apps.core.exceptions import exception_handler


class _DummyView(APIView):
    pass


class ExceptionHandlerUploadLimitsTests(SimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.view = _DummyView()

    def test_request_data_too_big_returns_413_not_500(self):
        req = self.factory.post("/api/v1/ai-assistant/ai-documents/", data={})
        resp = exception_handler(RequestDataTooBig("too big"), {"request": req, "view": self.view})

        self.assertIsNotNone(resp)
        self.assertEqual(resp.status_code, 413)
        self.assertEqual(resp.data.get("code"), "PAYLOAD_TOO_LARGE")

    def test_suspicious_operation_returns_400(self):
        req = self.factory.post("/api/v1/ai-assistant/ai-documents/", data={})
        resp = exception_handler(SuspiciousOperation("bad payload"), {"request": req, "view": self.view})

        self.assertIsNotNone(resp)
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.data.get("code"), "SUSPICIOUS_OPERATION")
