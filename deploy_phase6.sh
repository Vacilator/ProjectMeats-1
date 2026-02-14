#!/bin/bash

# Phase 6: Email Integration Deployment Script
# Automates the setup process for email integration

set -e  # Exit on error

echo "========================================================================"
echo "Phase 6: Email Integration - Deployment Script"
echo "========================================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the project root
if [ ! -f "backend/manage.py" ]; then
    echo -e "${RED}Error: Must run from project root directory${NC}"
    exit 1
fi

echo -e "${GREEN}Step 1: Installing dependencies...${NC}"
cd backend
pip install -q cryptography>=42.0.0
echo "✓ cryptography installed"
echo ""

echo -e "${GREEN}Step 2: Running migrations...${NC}"
python manage.py migrate integrations
echo "✓ Migrations applied"
echo ""

echo -e "${GREEN}Step 3: Generating encryption key...${NC}"
ENCRYPTION_KEY=$(python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
echo "✓ Encryption key generated"
echo ""

echo -e "${YELLOW}========================================================================"
echo "IMPORTANT: Save these values to your environment variables"
echo "========================================================================${NC}"
echo ""
echo "Add these to your .env file or environment:"
echo ""
echo "# Email Integration (Phase 6)"
echo "OAUTH_ENCRYPTION_KEY=\"$ENCRYPTION_KEY\""
echo "MICROSOFT_CLIENT_ID=\"your_azure_app_client_id\""
echo "MICROSOFT_CLIENT_SECRET=\"your_azure_app_client_secret\""
echo ""
echo -e "${YELLOW}========================================================================"
echo "Next Steps:"
echo "========================================================================${NC}"
echo ""
echo "1. Register Azure AD App:"
echo "   - Go to https://portal.azure.com/ → Azure Active Directory"
echo "   - Navigate to 'App registrations' → 'New registration'"
echo "   - Name: ProjectMeats Email Integration"
echo "   - Redirect URI: https://your-domain.com/api/v1/integrations/oauth/callback/microsoft/"
echo "   - Copy Client ID → MICROSOFT_CLIENT_ID"
echo "   - Create client secret → MICROSOFT_CLIENT_SECRET"
echo "   - Add permissions: Mail.Send, Mail.ReadWrite, User.Read, offline_access"
echo ""
echo "2. Set environment variables (shown above)"
echo ""
echo "3. Restart backend server"
echo ""
echo "4. Test connection:"
echo "   - Navigate to Settings → Integrations"
echo "   - Click 'Connect' on Microsoft Outlook"
echo "   - Complete OAuth flow"
echo ""
echo -e "${GREEN}✅ Deployment script complete!${NC}"
echo ""
