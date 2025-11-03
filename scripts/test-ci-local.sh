#!/bin/bash

# Script to test GitHub Actions locally using act
# Install act: brew install act (macOS) or see https://github.com/nektos/act

set -e

echo "🚀 Testing GitHub Actions locally with act"
echo "=========================================="

# Check if act is installed
if ! command -v act &> /dev/null; then
    echo "❌ act is not installed"
    echo "Install it with: brew install act (macOS) or visit https://github.com/nektos/act"
    exit 1
fi

echo "✅ act is installed"
echo ""

# Function to run a specific workflow
run_workflow() {
    local workflow=$1
    local job=$2
    
    echo "📋 Running workflow: $workflow"
    if [ -n "$job" ]; then
        echo "   Job: $job"
        act -W ".github/workflows/$workflow" -j "$job" --container-architecture linux/amd64
    else
        act -W ".github/workflows/$workflow" --container-architecture linux/amd64
    fi
}

# Parse command line arguments
case "${1:-all}" in
    "unit")
        echo "Running unit tests only..."
        run_workflow "ci-local.yml" "unit-test-quick"
        ;;
    "build")
        echo "Running Docker build only..."
        run_workflow "ci-local.yml" "build-docker-local"
        ;;
    "quick")
        echo "Running quick local CI workflow..."
        run_workflow "ci-local.yml"
        ;;
    "full")
        echo "Running full CI workflow (this may take a while)..."
        echo "⚠️  Note: Integration tests require Docker-in-Docker and may not work locally"
        act -W ".github/workflows/ci.yml" push --container-architecture linux/amd64
        ;;
    "list")
        echo "Available workflows:"
        act -W ".github/workflows/ci.yml" -l
        echo ""
        echo "Available jobs in ci-local.yml:"
        act -W ".github/workflows/ci-local.yml" -l
        ;;
    "help"|"-h"|"--help")
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  unit     - Run unit tests only"
        echo "  build    - Run Docker build only"
        echo "  quick    - Run quick local CI workflow (default)"
        echo "  full     - Run full CI workflow (slow, may not work locally)"
        echo "  list     - List all available workflows and jobs"
        echo "  help     - Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0 unit      # Test unit tests"
        echo "  $0 build     # Test Docker builds"
        echo "  $0 quick     # Quick local test"
        ;;
    *)
        echo "Running quick local CI workflow (default)..."
        run_workflow "ci-local.yml"
        ;;
esac

echo ""
echo "✅ CI test completed!"

