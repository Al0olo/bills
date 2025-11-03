#!/bin/bash

# Script to validate GitHub Actions workflows

set -e

echo "🔍 Validating GitHub Actions Workflows"
echo "======================================"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check for YAML linting
echo -e "\n📋 Checking YAML syntax..."

if command_exists yamllint; then
    echo "✅ yamllint found"
    yamllint .github/workflows/*.yml || true
elif command_exists python3; then
    echo "⚠️  yamllint not found, using Python YAML parser"
    for file in .github/workflows/*.yml; do
        python3 -c "import yaml; yaml.safe_load(open('$file'))" && \
            echo -e "${GREEN}✅ $file${NC}" || \
            echo -e "${RED}❌ $file${NC}"
    done
else
    echo -e "${YELLOW}⚠️  No YAML validator found${NC}"
fi

# Validate workflow structure
echo -e "\n📦 Validating workflow structure..."

WORKFLOW_DIR=".github/workflows"

for workflow in "$WORKFLOW_DIR"/*.yml; do
    echo -e "\n🔎 Checking: $(basename "$workflow")"
    
    # Check for required keys
    if grep -q "^name:" "$workflow"; then
        echo -e "  ${GREEN}✅${NC} Has 'name' field"
    else
        echo -e "  ${RED}❌${NC} Missing 'name' field"
    fi
    
    if grep -q "^on:" "$workflow"; then
        echo -e "  ${GREEN}✅${NC} Has 'on' trigger"
    else
        echo -e "  ${RED}❌${NC} Missing 'on' trigger"
    fi
    
    if grep -q "^jobs:" "$workflow"; then
        echo -e "  ${GREEN}✅${NC} Has 'jobs' defined"
    else
        echo -e "  ${RED}❌${NC} Missing 'jobs'"
    fi
    
    # Count jobs
    JOB_COUNT=$(grep -c "^  [a-z]" "$workflow" | head -1 || echo "0")
    echo -e "  📊 Number of jobs: ${JOB_COUNT}"
    
    # Check for actions versions
    if grep -q "uses:.*@v[0-9]" "$workflow"; then
        echo -e "  ${GREEN}✅${NC} Uses versioned actions"
    fi
done

# Check for secrets/environment variables
echo -e "\n🔐 Checking for secrets usage..."

if grep -rq "\${{ secrets\." ".github/workflows/"; then
    echo -e "${GREEN}✅${NC} Secrets are being used"
    echo "Used secrets:"
    grep -roh "\${{ secrets\.[A-Z_]* }}" ".github/workflows/" | sort -u | sed 's/^/  - /'
else
    echo -e "${YELLOW}⚠️${NC}  No secrets found"
fi

# Test workflow syntax with act (if available)
echo -e "\n🎬 Testing with act (if installed)..."

if command_exists act; then
    echo -e "${GREEN}✅ act is installed${NC}"
    echo ""
    echo "Available workflows:"
    act -l -W .github/workflows/ci.yml 2>/dev/null || echo "Main CI workflow"
    echo ""
    act -l -W .github/workflows/ci-local.yml 2>/dev/null || echo "Local CI workflow"
    
    echo -e "\n${GREEN}Ready to test locally!${NC}"
    echo "Run: ./scripts/test-ci-local.sh quick"
else
    echo -e "${YELLOW}⚠️  act is not installed${NC}"
    echo ""
    echo "To test workflows locally, install act:"
    echo "  macOS:   brew install act"
    echo "  Linux:   curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash"
    echo "  Windows: choco install act-cli"
    echo ""
    echo "Then run: ./scripts/test-ci-local.sh quick"
fi

# Check Docker
echo -e "\n🐳 Checking Docker..."

if command_exists docker; then
    if docker ps >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Docker is running${NC}"
    else
        echo -e "${YELLOW}⚠️  Docker is installed but not running${NC}"
    fi
else
    echo -e "${RED}❌ Docker is not installed${NC}"
    echo "Docker is required for local CI testing"
fi

# Summary
echo -e "\n📊 Validation Summary"
echo "===================="
echo "Workflows found: $(ls -1 .github/workflows/*.yml 2>/dev/null | wc -l)"
echo "Docker status: $(docker ps >/dev/null 2>&1 && echo 'Running' || echo 'Not running')"
echo "act installed: $(command_exists act && echo 'Yes' || echo 'No')"

echo -e "\n${GREEN}✅ Validation complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Review the validation output above"
echo "2. Install act (if not installed) to test locally"
echo "3. Run: ./scripts/test-ci-local.sh quick"
echo "4. If everything works, push to trigger real CI"

