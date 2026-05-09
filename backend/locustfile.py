"""
Locust Load Testing Configuration
Phase 6.3: Load Testing

Tests ProjectMeats backend API performance under load.
Simulates 1000+ concurrent users performing realistic workflows.

Usage:
    # Run locally
    locust -f locustfile.py --host=http://localhost:8000

    # Run with web UI
    locust -f locustfile.py --host=http://localhost:8000 --web-host=0.0.0.0

    # Run headless (10 users, 2 spawn rate, 1 minute)
    locust -f locustfile.py --headless --users 10 --spawn-rate 2 --run-time 1m --host=http://localhost:8000

    # Run against production (use with caution!)
    locust -f locustfile.py --host=https://api.meatscentral.com
"""

import random
from locust import HttpUser, task, between, SequentialTaskSet


class AuthenticationFlow(SequentialTaskSet):
    """
    Sequential task set for authentication flow.
    Ensures tasks run in order: login -> verify -> logout.
    """

    @task
    def login(self):
        """Login to obtain authentication token."""
        payload = {
            "username": f"loadtest_user_{random.randint(1, 100)}@test.com",
            "password": "LoadTest123!",
        }

        with self.client.post(
            "/api/auth/login/",
            json=payload,
            catch_response=True,
            name="01. Login"
        ) as response:
            if response.status_code == 200:
                data = response.json()
                self.user.auth_token = data.get("access")
                self.user.tenant_id = data.get("tenant_id")
                response.success()
            else:
                response.failure(f"Login failed: {response.status_code}")

    @task
    def verify_token(self):
        """Verify authentication token is valid."""
        if not hasattr(self.user, "auth_token"):
            return

        headers = {"Authorization": f"Bearer {self.user.auth_token}"}

        with self.client.get(
            "/api/auth/me/",
            headers=headers,
            catch_response=True,
            name="02. Verify Token"
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Token verification failed: {response.status_code}")

    @task
    def logout(self):
        """Logout and invalidate token."""
        if not hasattr(self.user, "auth_token"):
            return

        headers = {"Authorization": f"Bearer {self.user.auth_token}"}

        with self.client.post(
            "/api/auth/logout/",
            headers=headers,
            catch_response=True,
            name="03. Logout"
        ) as response:
            if response.status_code in [200, 204]:
                response.success()
                # Clean up auth token
                delattr(self.user, "auth_token")
            else:
                response.failure(f"Logout failed: {response.status_code}")


class WorkflowOperations(SequentialTaskSet):
    """
    Sequential task set for workflow operations.
    Tests workflow listing, creation, retrieval, and deletion.
    """

    def on_start(self):
        """Login before workflow operations."""
        self.login()

    def login(self):
        """Helper to login and store auth token."""
        payload = {
            "username": f"loadtest_user_{random.randint(1, 100)}@test.com",
            "password": "LoadTest123!",
        }

        response = self.client.post("/api/auth/login/", json=payload)
        if response.status_code == 200:
            data = response.json()
            self.user.auth_token = data.get("access")
            self.user.tenant_id = data.get("tenant_id")

    def get_headers(self):
        """Get authorization headers."""
        if not hasattr(self.user, "auth_token"):
            return {}
        return {
            "Authorization": f"Bearer {self.user.auth_token}",
            "X-Tenant-ID": str(self.user.tenant_id) if hasattr(self.user, "tenant_id") else "",
        }

    @task(3)
    def list_workflows(self):
        """List all workflows for the tenant."""
        with self.client.get(
            "/api/workflows/",
            headers=self.get_headers(),
            catch_response=True,
            name="Workflows - List"
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"List workflows failed: {response.status_code}")

    @task(2)
    def get_workflow_detail(self):
        """Get details of a specific workflow."""
        # Assume workflow IDs 1-50 exist
        workflow_id = random.randint(1, 50)

        with self.client.get(
            f"/api/workflows/{workflow_id}/",
            headers=self.get_headers(),
            catch_response=True,
            name="Workflows - Detail"
        ) as response:
            if response.status_code in [200, 404]:
                response.success()
            else:
                response.failure(f"Get workflow failed: {response.status_code}")

    @task(1)
    def create_workflow(self):
        """Create a new workflow."""
        payload = {
            "name": f"Load Test Workflow {random.randint(1000, 9999)}",
            "description": "Created by load testing",
            "is_active": True,
            "nodes": [],
            "edges": [],
        }

        with self.client.post(
            "/api/workflows/",
            json=payload,
            headers=self.get_headers(),
            catch_response=True,
            name="Workflows - Create"
        ) as response:
            if response.status_code in [200, 201]:
                response.success()
            else:
                response.failure(f"Create workflow failed: {response.status_code}")


class FormSubmissionFlow(SequentialTaskSet):
    """
    Sequential task set for form submission flow.
    Tests form retrieval and submission.
    """

    def on_start(self):
        """Login before form operations."""
        self.login()

    def login(self):
        """Helper to login and store auth token."""
        payload = {
            "username": f"loadtest_user_{random.randint(1, 100)}@test.com",
            "password": "LoadTest123!",
        }

        response = self.client.post("/api/auth/login/", json=payload)
        if response.status_code == 200:
            data = response.json()
            self.user.auth_token = data.get("access")
            self.user.tenant_id = data.get("tenant_id")

    def get_headers(self):
        """Get authorization headers."""
        if not hasattr(self.user, "auth_token"):
            return {}
        return {
            "Authorization": f"Bearer {self.user.auth_token}",
            "X-Tenant-ID": str(self.user.tenant_id) if hasattr(self.user, "tenant_id") else "",
        }

    @task(2)
    def get_form(self):
        """Retrieve a form definition."""
        # Assume form IDs 1-20 exist
        form_id = random.randint(1, 20)

        with self.client.get(
            f"/api/forms/{form_id}/",
            headers=self.get_headers(),
            catch_response=True,
            name="Forms - Get Definition"
        ) as response:
            if response.status_code in [200, 404]:
                response.success()
            else:
                response.failure(f"Get form failed: {response.status_code}")

    @task(1)
    def submit_form(self):
        """Submit a form with sample data."""
        form_id = random.randint(1, 20)

        payload = {
            "form_id": form_id,
            "data": {
                "customer_name": f"Load Test Customer {random.randint(1, 1000)}",
                "email": f"customer{random.randint(1, 1000)}@test.com",
                "product": random.choice(["Beef", "Pork", "Chicken", "Lamb"]),
                "quantity": random.randint(1, 100),
                "notes": "Automated load test submission",
            },
        }

        with self.client.post(
            f"/api/forms/{form_id}/submit/",
            json=payload,
            headers=self.get_headers(),
            catch_response=True,
            name="Forms - Submit"
        ) as response:
            if response.status_code in [200, 201]:
                response.success()
            else:
                response.failure(f"Submit form failed: {response.status_code}")


class CatalogBrowsing(SequentialTaskSet):
    """
    Sequential task set for catalog browsing.
    Tests supplier/customer listings and search.
    """

    def on_start(self):
        """Login before catalog operations."""
        self.login()

    def login(self):
        """Helper to login and store auth token."""
        payload = {
            "username": f"loadtest_user_{random.randint(1, 100)}@test.com",
            "password": "LoadTest123!",
        }

        response = self.client.post("/api/auth/login/", json=payload)
        if response.status_code == 200:
            data = response.json()
            self.user.auth_token = data.get("access")
            self.user.tenant_id = data.get("tenant_id")

    def get_headers(self):
        """Get authorization headers."""
        if not hasattr(self.user, "auth_token"):
            return {}
        return {
            "Authorization": f"Bearer {self.user.auth_token}",
            "X-Tenant-ID": str(self.user.tenant_id) if hasattr(self.user, "tenant_id") else "",
        }

    @task(3)
    def list_suppliers(self):
        """List all suppliers."""
        with self.client.get(
            "/api/suppliers/",
            headers=self.get_headers(),
            catch_response=True,
            name="Catalog - List Suppliers"
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"List suppliers failed: {response.status_code}")

    @task(3)
    def list_customers(self):
        """List all customers."""
        with self.client.get(
            "/api/customers/",
            headers=self.get_headers(),
            catch_response=True,
            name="Catalog - List Customers"
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"List customers failed: {response.status_code}")

    @task(2)
    def search_suppliers(self):
        """Search suppliers by name."""
        search_terms = ["Beef", "Premium", "Organic", "Local", "Fresh"]
        search_query = random.choice(search_terms)

        with self.client.get(
            f"/api/suppliers/?search={search_query}",
            headers=self.get_headers(),
            catch_response=True,
            name="Catalog - Search Suppliers"
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Search suppliers failed: {response.status_code}")


class ProjectMeatsUser(HttpUser):
    """
    Simulated ProjectMeats user.
    
    Performs random tasks from multiple task sets:
    - Authentication flow
    - Workflow operations
    - Form submissions
    - Catalog browsing
    
    Think time: 1-3 seconds between requests
    """

    wait_time = between(1, 3)

    # Task distribution (weight determines frequency)
    tasks = {
        AuthenticationFlow: 1,
        WorkflowOperations: 3,
        FormSubmissionFlow: 2,
        CatalogBrowsing: 4,
    }

    # Class-level attributes for session management
    auth_token = None
    tenant_id = None


class AdminUser(HttpUser):
    """
    Simulated admin user with higher activity on workflow operations.
    
    Think time: 0.5-2 seconds (faster than regular users)
    """

    wait_time = between(0.5, 2)

    tasks = {
        WorkflowOperations: 5,
        FormSubmissionFlow: 2,
        CatalogBrowsing: 3,
    }

    auth_token = None
    tenant_id = None


class ReadOnlyUser(HttpUser):
    """
    Simulated read-only user (browsing only, no write operations).
    
    Think time: 2-5 seconds (slower browsing)
    """

    wait_time = between(2, 5)

    tasks = {
        CatalogBrowsing: 10,
    }

    auth_token = None
    tenant_id = None


# Event hooks for custom reporting
from locust import events


@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """Hook that runs when load test starts."""
    print("\n" + "="*50)
    print("ProjectMeats Load Test Starting...")
    print(f"Target host: {environment.host}")
    print("="*50 + "\n")


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """Hook that runs when load test stops."""
    print("\n" + "="*50)
    print("ProjectMeats Load Test Complete!")
    print(f"Total requests: {environment.stats.total.num_requests}")
    print(f"Failures: {environment.stats.total.num_failures}")
    print(f"Average response time: {environment.stats.total.avg_response_time:.2f}ms")
    print(f"RPS: {environment.stats.total.total_rps:.2f}")
    print("="*50 + "\n")
