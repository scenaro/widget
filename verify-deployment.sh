#!/bin/bash

# Verification script for widget-sdk deployment
# Usage: ./verify-deployment.sh

set -e

echo "🔍 Verifying Widget SDK Deployment..."
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
S3_BUCKET="scenaro-widget-sdk-cdn"
CLOUDFRONT_DIST_ID="E2USPRRPYV6SLU"
CLOUDFRONT_DOMAIN="d69oiovkxf69d.cloudfront.net"
CUSTOM_DOMAIN="cdn.scenaro.io"

echo "📦 Checking S3 Bucket: $S3_BUCKET"
echo "-----------------------------------"

# Check if AWS CLI is available
if ! command -v aws &> /dev/null; then
    echo -e "${YELLOW}⚠ AWS CLI not found. Skipping S3 checks.${NC}"
else
    # List files in S3
    echo "Files in S3 bucket:"
    aws s3 ls s3://$S3_BUCKET/ --recursive | head -20 || echo -e "${RED}✗ Failed to list S3 files${NC}"
    echo ""
    
    # Check for key files
    echo "Checking for key files:"
    
    if aws s3 ls s3://$S3_BUCKET/widget.js &> /dev/null; then
        echo -e "${GREEN}✓ widget.js found${NC}"
        aws s3 ls s3://$S3_BUCKET/widget.js --human-readable
    else
        echo -e "${RED}✗ widget.js not found${NC}"
    fi
    
    if aws s3 ls s3://$S3_BUCKET/runtime/index.html &> /dev/null; then
        echo -e "${GREEN}✓ runtime/index.html found${NC}"
        aws s3 ls s3://$S3_BUCKET/runtime/index.html --human-readable
    else
        echo -e "${RED}✗ runtime/index.html not found${NC}"
    fi
    echo ""
fi

echo "🌐 Checking CloudFront Distribution: $CLOUDFRONT_DIST_ID"
echo "---------------------------------------------------"

if ! command -v aws &> /dev/null; then
    echo -e "${YELLOW}⚠ AWS CLI not found. Skipping CloudFront checks.${NC}"
else
    # Get CloudFront distribution status
    DIST_STATUS=$(aws cloudfront get-distribution --id $CLOUDFRONT_DIST_ID --query 'Distribution.Status' --output text 2>/dev/null || echo "ERROR")
    
    if [ "$DIST_STATUS" = "Deployed" ]; then
        echo -e "${GREEN}✓ CloudFront distribution is deployed${NC}"
    else
        echo -e "${YELLOW}⚠ CloudFront status: $DIST_STATUS${NC}"
    fi
    
    # Get domain name
    DIST_DOMAIN=$(aws cloudfront get-distribution --id $CLOUDFRONT_DIST_ID --query 'Distribution.DomainName' --output text 2>/dev/null || echo "")
    if [ -n "$DIST_DOMAIN" ]; then
        echo "Domain: $DIST_DOMAIN"
    fi
    echo ""
fi

echo "🌍 Testing HTTP Endpoints"
echo "-------------------------"

# Test CloudFront URL
echo "Testing CloudFront URL:"
CLOUDFRONT_URL="https://$CLOUDFRONT_DOMAIN/widget.js"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$CLOUDFRONT_URL" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ CloudFront URL accessible (HTTP $HTTP_CODE)${NC}"
    echo "  URL: $CLOUDFRONT_URL"
    
    # Get file size
    FILE_SIZE=$(curl -s -I "$CLOUDFRONT_URL" | grep -i "content-length" | awk '{print $2}' | tr -d '\r' || echo "unknown")
    echo "  File size: $FILE_SIZE bytes"
else
    echo -e "${RED}✗ CloudFront URL not accessible (HTTP $HTTP_CODE)${NC}"
    echo "  URL: $CLOUDFRONT_URL"
fi
echo ""

# Test runtime URL
echo "Testing Runtime URL:"
RUNTIME_URL="https://$CLOUDFRONT_DOMAIN/runtime/index.html"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$RUNTIME_URL" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Runtime URL accessible (HTTP $HTTP_CODE)${NC}"
    echo "  URL: $RUNTIME_URL"
else
    echo -e "${RED}✗ Runtime URL not accessible (HTTP $HTTP_CODE)${NC}"
    echo "  URL: $RUNTIME_URL"
fi
echo ""

# Test custom domain (if configured)
if [ "$CUSTOM_DOMAIN" != "" ]; then
    echo "Testing Custom Domain:"
    CUSTOM_URL="https://$CUSTOM_DOMAIN/widget.js"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$CUSTOM_URL" 2>/dev/null || echo "000")
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✓ Custom domain accessible (HTTP $HTTP_CODE)${NC}"
        echo "  URL: $CUSTOM_URL"
    else
        echo -e "${YELLOW}⚠ Custom domain not accessible (HTTP $HTTP_CODE)${NC}"
        echo "  URL: $CUSTOM_URL"
        echo "  (This is expected if DNS/ACM certificate is not yet configured)"
    fi
    echo ""
fi

echo "📋 Summary"
echo "----------"
echo "S3 Bucket: $S3_BUCKET"
echo "CloudFront Distribution ID: $CLOUDFRONT_DIST_ID"
echo "CloudFront Domain: $CLOUDFRONT_DOMAIN"
echo "Custom Domain: $CUSTOM_DOMAIN"
echo ""
echo "✅ Verification complete!"

