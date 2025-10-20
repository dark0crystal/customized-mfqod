#!/usr/bin/env python3
"""
Test runner script for email notification service tests

This script provides various options for running email service tests:
- Run all tests
- Run specific test categories
- Run with coverage reporting
- Run in different modes (fast, comprehensive, etc.)
"""

import sys
import subprocess
import argparse
from pathlib import Path


def run_command(cmd, description):
    """Run a command and handle the output"""
    print(f"\n🔄 {description}")
    print(f"Command: {' '.join(cmd)}")
    print("-" * 50)
    
    try:
        result = subprocess.run(cmd, check=True, capture_output=False)
        print(f"✅ {description} completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed with exit code {e.returncode}")
        return False
    except FileNotFoundError:
        print(f"❌ Command not found: {cmd[0]}")
        print("Please ensure pytest is installed: pip install pytest pytest-asyncio")
        return False


def main():
    parser = argparse.ArgumentParser(description="Run email notification service tests")
    
    # Test selection options
    parser.add_argument(
        "--test-type", 
        choices=["all", "unit", "integration", "email", "smtp", "template", "bulk", "error"],
        default="all",
        help="Type of tests to run"
    )
    
    parser.add_argument(
        "--coverage", 
        action="store_true",
        help="Run tests with coverage reporting"
    )
    
    parser.add_argument(
        "--fast", 
        action="store_true",
        help="Run tests in fast mode (skip slow tests)"
    )
    
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Run tests in verbose mode"
    )
    
    parser.add_argument(
        "--specific-test",
        help="Run a specific test function (e.g., test_send_email_success)"
    )
    
    parser.add_argument(
        "--install-deps",
        action="store_true",
        help="Install test dependencies before running tests"
    )
    
    args = parser.parse_args()
    
    # Change to backend directory
    backend_dir = Path(__file__).parent
    print(f"📁 Working directory: {backend_dir}")
    
    # Install dependencies if requested
    if args.install_deps:
        deps_cmd = [
            sys.executable, "-m", "pip", "install", 
            "pytest", "pytest-asyncio", "pytest-cov", "pytest-mock"
        ]
        if not run_command(deps_cmd, "Installing test dependencies"):
            return 1
    
    # Build pytest command
    pytest_cmd = [sys.executable, "-m", "pytest"]
    
    # Add test file
    if args.specific_test:
        pytest_cmd.extend([f"tests/test_notification_service.py::{args.specific_test}"])
    else:
        pytest_cmd.append("tests/test_notification_service.py")
    
    # Add verbosity options
    if args.verbose:
        pytest_cmd.extend(["-v", "-s"])
    
    # Add test type markers
    if args.test_type != "all":
        pytest_cmd.extend(["-m", args.test_type])
    
    # Add fast mode (skip slow tests)
    if args.fast:
        pytest_cmd.extend(["-m", "not slow"])
    
    # Add coverage reporting
    if args.coverage:
        pytest_cmd.extend([
            "--cov=app.services.notification_service",
            "--cov=app.config.email_config", 
            "--cov-report=html:htmlcov",
            "--cov-report=term-missing",
            "--cov-fail-under=80"
        ])
    
    # Run the tests
    success = run_command(pytest_cmd, f"Running {args.test_type} email service tests")
    
    if success:
        print("\n🎉 All tests completed successfully!")
        
        if args.coverage:
            print("\n📊 Coverage report generated in 'htmlcov' directory")
            print("Open 'htmlcov/index.html' in your browser to view the report")
    else:
        print("\n💥 Some tests failed. Check the output above for details.")
        return 1
    
    return 0


def run_quick_test():
    """Run a quick smoke test to verify the service is working"""
    print("🚀 Running quick email service smoke test...")
    
    quick_cmd = [
        sys.executable, "-m", "pytest", 
        "tests/test_notification_service.py::TestServiceInitialization::test_service_initialization_with_dependencies",
        "-v"
    ]
    
    return run_command(quick_cmd, "Quick smoke test")


def run_comprehensive_test():
    """Run comprehensive test suite"""
    print("🔬 Running comprehensive email service test suite...")
    
    comprehensive_cmd = [
        sys.executable, "-m", "pytest",
        "tests/test_notification_service.py",
        "-v",
        "--tb=long",
        "--durations=10"
    ]
    
    return run_command(comprehensive_cmd, "Comprehensive test suite")


def show_test_info():
    """Show information about available tests"""
    print("📋 Email Notification Service Test Information")
    print("=" * 60)
    
    test_categories = {
        "unit": "Basic unit tests for individual methods",
        "integration": "Integration tests with mocked external services",
        "email": "Email-specific functionality tests",
        "smtp": "SMTP connection and sending tests",
        "template": "Template loading and rendering tests",
        "bulk": "Bulk notification functionality tests", 
        "error": "Error handling and edge case tests"
    }
    
    print("\nAvailable test categories:")
    for category, description in test_categories.items():
        print(f"  {category:12} - {description}")
    
    print("\nExample commands:")
    print("  python run_email_tests.py --test-type unit")
    print("  python run_email_tests.py --coverage")
    print("  python run_email_tests.py --fast")
    print("  python run_email_tests.py --specific-test test_send_email_success")
    print("  python run_email_tests.py --install-deps")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--info":
        show_test_info()
    elif len(sys.argv) > 1 and sys.argv[1] == "--quick":
        sys.exit(0 if run_quick_test() else 1)
    elif len(sys.argv) > 1 and sys.argv[1] == "--comprehensive":
        sys.exit(0 if run_comprehensive_test() else 1)
    else:
        sys.exit(main())