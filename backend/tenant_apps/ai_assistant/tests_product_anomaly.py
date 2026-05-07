"""Tests for product anomaly baseline service."""

from unittest import TestCase

from tenant_apps.ai_assistant.services.product_anomaly_baseline import (
    AnomalyCheckResult,
    AnomalyThreshold,
    ProductBaseline,
    build_baseline_from_history,
    compute_deviation_sigma,
    evaluate_single_field,
    evaluate_submission,
)


class TestComputeDeviationSigma(TestCase):
    """Test the deviation sigma calculator."""

    def test_zero_deviation(self):
        self.assertEqual(compute_deviation_sigma(10.0, 10.0, 2.0), 0.0)

    def test_one_sigma(self):
        self.assertAlmostEqual(compute_deviation_sigma(12.0, 10.0, 2.0), 1.0)

    def test_negative_deviation(self):
        self.assertAlmostEqual(compute_deviation_sigma(8.0, 10.0, 2.0), 1.0)

    def test_zero_stddev_same_value(self):
        self.assertEqual(compute_deviation_sigma(5.0, 5.0, 0.0), 0.0)

    def test_zero_stddev_different_value(self):
        self.assertEqual(compute_deviation_sigma(6.0, 5.0, 0.0), float("inf"))


class TestBuildBaselineFromHistory(TestCase):
    """Test baseline construction from historical values."""

    def test_empty_values(self):
        baseline = build_baseline_from_history("p1", "unit_price", [])
        self.assertEqual(baseline.sample_count, 0)
        self.assertFalse(baseline.is_sufficient)

    def test_single_value(self):
        baseline = build_baseline_from_history("p1", "unit_price", [10.0])
        self.assertEqual(baseline.mean, 10.0)
        self.assertEqual(baseline.stddev, 0.0)
        self.assertEqual(baseline.sample_count, 1)
        self.assertFalse(baseline.is_sufficient)

    def test_sufficient_data(self):
        values = [10.0, 12.0, 11.0, 9.0, 13.0, 10.5]
        baseline = build_baseline_from_history("p1", "unit_price", values)
        self.assertTrue(baseline.is_sufficient)
        self.assertEqual(baseline.sample_count, 6)
        self.assertAlmostEqual(baseline.mean, sum(values) / 6, places=4)
        self.assertEqual(baseline.min_value, 9.0)
        self.assertEqual(baseline.max_value, 13.0)

    def test_custom_window_days(self):
        baseline = build_baseline_from_history("p1", "weight", [1.0, 2.0], window_days=30)
        self.assertEqual(baseline.window_days, 30)


class TestEvaluateSingleField(TestCase):
    """Test single-field anomaly evaluation."""

    def _make_baseline(self, mean=10.0, stddev=2.0, count=20):
        return ProductBaseline(
            product_id="p1",
            field_name="unit_price",
            mean=mean,
            stddev=stddev,
            min_value=mean - 3 * stddev,
            max_value=mean + 3 * stddev,
            sample_count=count,
        )

    def test_normal_value(self):
        baseline = self._make_baseline()
        result = evaluate_single_field(10.5, baseline)
        self.assertEqual(result.severity, "normal")
        self.assertFalse(result.is_anomalous)
        self.assertFalse(result.requires_confirmation)

    def test_warning_value(self):
        baseline = self._make_baseline(mean=10.0, stddev=2.0)
        # 2.5 sigma above mean = 15.0
        result = evaluate_single_field(15.0, baseline)
        self.assertEqual(result.severity, "warning")
        self.assertTrue(result.is_anomalous)
        self.assertTrue(result.requires_confirmation)
        self.assertIn("above", result.message)

    def test_critical_value(self):
        baseline = self._make_baseline(mean=10.0, stddev=2.0)
        # 4+ sigma below mean = 1.0
        result = evaluate_single_field(1.0, baseline)
        self.assertEqual(result.severity, "critical")
        self.assertTrue(result.is_anomalous)
        self.assertIn("below", result.message)

    def test_insufficient_data_returns_normal(self):
        baseline = ProductBaseline(
            product_id="p1",
            field_name="unit_price",
            mean=10.0,
            stddev=2.0,
            min_value=5.0,
            max_value=15.0,
            sample_count=3,  # Below 5 threshold
        )
        result = evaluate_single_field(100.0, baseline)
        self.assertEqual(result.severity, "normal")
        self.assertIn("Insufficient", result.message)

    def test_below_min_absolute_deviation(self):
        baseline = self._make_baseline(mean=10.0, stddev=0.1)
        # Default min_absolute_deviation for unit_price is 0.50
        # Value 10.3 is 3σ away but only 0.3 absolute
        result = evaluate_single_field(10.3, baseline)
        self.assertEqual(result.severity, "normal")

    def test_custom_threshold(self):
        baseline = self._make_baseline(mean=10.0, stddev=2.0)
        # Strict threshold: warn at 1σ
        strict = AnomalyThreshold(warn_sigma=1.0, block_sigma=2.0, min_absolute_deviation=0.01)
        result = evaluate_single_field(12.5, baseline, strict)
        self.assertEqual(result.severity, "warning")

    def test_baseline_context_populated(self):
        baseline = self._make_baseline()
        result = evaluate_single_field(10.0, baseline)
        self.assertIn("sample_count", result.baseline_context)
        self.assertEqual(result.baseline_context["sample_count"], 20)


class TestEvaluateSubmission(TestCase):
    """Test batch evaluation of multiple fields."""

    def _make_baseline(self, field_name, mean=10.0, stddev=2.0):
        return ProductBaseline(
            product_id="p1",
            field_name=field_name,
            mean=mean,
            stddev=stddev,
            min_value=mean - 3 * stddev,
            max_value=mean + 3 * stddev,
            sample_count=30,
        )

    def test_all_normal(self):
        checks = [
            (10.0, self._make_baseline("unit_price")),
            (11.0, self._make_baseline("weight")),
        ]
        response = evaluate_submission(checks)
        self.assertFalse(response.has_warnings)
        self.assertFalse(response.has_critical)
        self.assertFalse(response.requires_confirmation)
        self.assertEqual(len(response.results), 2)

    def test_one_warning(self):
        checks = [
            (10.0, self._make_baseline("unit_price")),
            (15.0, self._make_baseline("weight", mean=10.0, stddev=2.0)),
        ]
        response = evaluate_submission(checks)
        self.assertTrue(response.has_warnings)
        self.assertFalse(response.has_critical)
        self.assertTrue(response.requires_confirmation)

    def test_one_critical(self):
        checks = [
            (10.0, self._make_baseline("unit_price")),
            (1000.0, self._make_baseline("total_amount", mean=5000.0, stddev=500.0)),
        ]
        response = evaluate_submission(checks)
        self.assertTrue(response.has_critical)
        self.assertTrue(response.requires_confirmation)

    def test_custom_thresholds_override(self):
        checks = [
            (12.5, self._make_baseline("unit_price", mean=10.0, stddev=2.0)),
        ]
        # Default warn_sigma=2.0 → 1.25σ is normal
        response = evaluate_submission(checks)
        self.assertFalse(response.has_warnings)

        # Custom warn_sigma=1.0 → 1.25σ is warning
        custom = {"unit_price": AnomalyThreshold(warn_sigma=1.0, block_sigma=3.0, min_absolute_deviation=0.01)}
        response2 = evaluate_submission(checks, thresholds=custom)
        self.assertTrue(response2.has_warnings)

    def test_empty_checks(self):
        response = evaluate_submission([])
        self.assertEqual(len(response.results), 0)
        self.assertFalse(response.has_warnings)
        self.assertFalse(response.requires_confirmation)


class TestProductBaselineProperties(TestCase):
    """Test ProductBaseline dataclass properties."""

    def test_is_sufficient_at_threshold(self):
        b = ProductBaseline("p1", "x", 10, 2, 5, 15, sample_count=5)
        self.assertTrue(b.is_sufficient)

    def test_is_not_sufficient_below_threshold(self):
        b = ProductBaseline("p1", "x", 10, 2, 5, 15, sample_count=4)
        self.assertFalse(b.is_sufficient)

    def test_default_window_days(self):
        b = ProductBaseline("p1", "x", 10, 2, 5, 15, sample_count=10)
        self.assertEqual(b.window_days, 90)
