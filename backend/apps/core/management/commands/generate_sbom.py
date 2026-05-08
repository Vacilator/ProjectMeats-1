"""
SBOM Generation Management Command (Phase 9.4)

Generates Software Bill of Materials (SBOM) for compliance and security audits.
"""
import json
import subprocess
from pathlib import Path

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Generate Software Bill of Materials (SBOM) for Python and JavaScript dependencies"

    def add_arguments(self, parser):
        parser.add_argument(
            "--format",
            type=str,
            default="cyclonedx",
            choices=["cyclonedx", "spdx"],
            help="SBOM format (default: cyclonedx)",
        )
        parser.add_argument("--output", type=str, default="./sbom", help="Output directory for SBOM files")

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING("=" * 80))
        self.stdout.write(self.style.WARNING("SBOM GENERATION"))
        self.stdout.write(self.style.WARNING("=" * 80))
        self.stdout.write("")

        output_dir = Path(options["output"])
        output_dir.mkdir(exist_ok=True)

        # Generate Python SBOM
        self.stdout.write(self.style.HTTP_INFO("Generating Python SBOM..."))
        python_success = self.generate_python_sbom(output_dir)

        # Generate JavaScript SBOM
        self.stdout.write(self.style.HTTP_INFO("Generating JavaScript SBOM..."))
        js_success = self.generate_javascript_sbom(output_dir)

        # Generate combined report
        if python_success and js_success:
            self.generate_combined_report(output_dir)

        # Summary
        self.stdout.write("")
        self.stdout.write(self.style.WARNING("=" * 80))
        if python_success and js_success:
            self.stdout.write(self.style.SUCCESS("✓ SBOM GENERATION COMPLETE"))
            self.stdout.write(f"\nOutput directory: {output_dir.absolute()}")
            self.stdout.write("\nFiles generated:")
            self.stdout.write("  - sbom-python.json (Python dependencies)")
            self.stdout.write("  - sbom-javascript.json (JavaScript dependencies)")
            self.stdout.write("  - sbom-summary.txt (Combined report)")
        else:
            self.stdout.write(self.style.ERROR("✗ SBOM GENERATION FAILED"))
        self.stdout.write(self.style.WARNING("=" * 80))

    def generate_python_sbom(self, output_dir):
        """
        Generate SBOM for Python dependencies using CycloneDX.
        """
        backend_dir = Path(__file__).resolve().parent.parent.parent.parent.parent
        requirements_file = backend_dir / "requirements.txt"
        output_file = output_dir / "sbom-python.json"

        if not requirements_file.exists():
            self.stdout.write(self.style.ERROR(f"  ✗ requirements.txt not found: {requirements_file}"))
            return False

        try:
            # Check if cyclonedx-bom is installed
            result = subprocess.run(["pip", "show", "cyclonedx-bom"], capture_output=True, text=True)

            if result.returncode != 0:
                self.stdout.write(self.style.WARNING("  ! Installing cyclonedx-bom..."))
                subprocess.run(["pip", "install", "cyclonedx-bom"], check=True, capture_output=True)

            # Generate SBOM
            result = subprocess.run(
                ["cyclonedx-py", "-r", "-i", str(requirements_file), "-o", str(output_file), "--format", "json"],
                capture_output=True,
                text=True,
                cwd=str(backend_dir),
            )

            if result.returncode == 0:
                self.stdout.write(self.style.SUCCESS(f"  ✓ Python SBOM: {output_file}"))

                # Parse and display summary
                with open(output_file, "r") as f:
                    sbom = json.load(f)
                    component_count = len(sbom.get("components", []))
                    self.stdout.write(f"    → {component_count} Python packages")

                return True
            else:
                self.stdout.write(self.style.ERROR(f"  ✗ Failed: {result.stderr}"))
                return False

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"  ✗ Error: {str(e)}"))
            return False

    def generate_javascript_sbom(self, output_dir):
        """
        Generate SBOM for JavaScript dependencies using CycloneDX.
        """
        frontend_dir = Path(__file__).resolve().parent.parent.parent.parent.parent.parent / "frontend"
        package_json = frontend_dir / "package.json"
        output_file = output_dir / "sbom-javascript.json"

        if not package_json.exists():
            self.stdout.write(self.style.ERROR(f"  ✗ package.json not found: {package_json}"))
            return False

        try:
            # Generate SBOM using npx
            result = subprocess.run(
                ["npx", "@cyclonedx/cyclonedx-npm", "--output-file", str(output_file)],
                capture_output=True,
                text=True,
                cwd=str(frontend_dir),
            )

            if result.returncode == 0:
                self.stdout.write(self.style.SUCCESS(f"  ✓ JavaScript SBOM: {output_file}"))

                # Parse and display summary
                with open(output_file, "r") as f:
                    sbom = json.load(f)
                    component_count = len(sbom.get("components", []))
                    self.stdout.write(f"    → {component_count} JavaScript packages")

                return True
            else:
                self.stdout.write(self.style.ERROR(f"  ✗ Failed: {result.stderr}"))
                return False

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"  ✗ Error: {str(e)}"))
            return False

    def generate_combined_report(self, output_dir):
        """
        Generate a human-readable combined report.
        """
        python_file = output_dir / "sbom-python.json"
        js_file = output_dir / "sbom-javascript.json"
        report_file = output_dir / "sbom-summary.txt"

        try:
            with open(python_file, "r") as f:
                python_sbom = json.load(f)

            with open(js_file, "r") as f:
                js_sbom = json.load(f)

            # Generate report
            with open(report_file, "w") as f:
                f.write("=" * 80 + "\n")
                f.write("ProjectMeats - Software Bill of Materials (SBOM) Summary\n")
                f.write("=" * 80 + "\n\n")

                # Python dependencies
                f.write("PYTHON DEPENDENCIES\n")
                f.write("-" * 80 + "\n")
                python_components = python_sbom.get("components", [])
                f.write(f"Total packages: {len(python_components)}\n\n")

                for comp in sorted(python_components, key=lambda x: x.get("name", "")):
                    name = comp.get("name", "Unknown")
                    version = comp.get("version", "Unknown")
                    licenses = comp.get("licenses", [])
                    license_str = (
                        ", ".join([lic.get("license", {}).get("id", "Unknown") for lic in licenses])
                        if licenses
                        else "Unknown"
                    )

                    f.write(f"  {name} {version} ({license_str})\n")

                f.write("\n")

                # JavaScript dependencies
                f.write("JAVASCRIPT DEPENDENCIES\n")
                f.write("-" * 80 + "\n")
                js_components = js_sbom.get("components", [])
                f.write(f"Total packages: {len(js_components)}\n\n")

                for comp in sorted(js_components, key=lambda x: x.get("name", "")):
                    name = comp.get("name", "Unknown")
                    version = comp.get("version", "Unknown")
                    licenses = comp.get("licenses", [])
                    license_str = (
                        ", ".join([lic.get("license", {}).get("id", "Unknown") for lic in licenses])
                        if licenses
                        else "Unknown"
                    )

                    f.write(f"  {name} {version} ({license_str})\n")

                f.write("\n")
                f.write("=" * 80 + "\n")
                f.write(f"TOTAL: {len(python_components) + len(js_components)} packages\n")
                f.write("=" * 80 + "\n")

            self.stdout.write(self.style.SUCCESS(f"  ✓ Summary report: {report_file}"))

        except Exception as e:
            self.stdout.write(self.style.WARNING(f"  ! Could not generate summary: {str(e)}"))
