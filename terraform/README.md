# Widget SDK Infrastructure

This Terraform configuration deploys the Scenaro Widget SDK to AWS using S3 + CloudFront.

## Architecture

- **S3 Bucket**: Stores static assets (widget.js, engines, connectors, runtime)
- **CloudFront Distribution**: Global CDN for fast delivery
- **ACM Certificate**: SSL/TLS certificate for `cdn.scenaro.io`
- **Route53** (optional): DNS records for custom domain

## Prerequisites

1. AWS CLI configured with appropriate credentials
2. Terraform >= 1.2.0
3. Access to the S3 backend bucket: `scenaro-tfstate`
4. Route53 hosted zone for `scenaro.io` (if using automatic DNS validation)

## Deployment

### Initial Setup

1. **Configure Route53 Zone ID** (optional, for automatic DNS validation):
   ```hcl
   # In modules/acm/main.tf, uncomment and set:
   zone_id = "Z1234567890ABC"
   ```

2. **Initialize Terraform**:
   ```bash
   cd widget-sdk/terraform
   terraform init
   ```

3. **Plan the deployment**:
   ```bash
   terraform plan
   ```

4. **Apply the configuration**:
   ```bash
   terraform apply
   ```

### Manual DNS Validation (if not using Route53)

If you don't set `zone_id`, ACM will require manual DNS validation:

1. After `terraform apply`, check the certificate validation:
   ```bash
   terraform output
   ```

2. Add the DNS validation records to your DNS provider manually.

3. Wait for validation (usually 5-10 minutes).

### Post-Deployment

1. **Get CloudFront Distribution ID**:
   ```bash
   terraform output cloudfront_distribution_id
   ```

2. **Add to GitHub Secrets**:
   - `CLOUDFRONT_DISTRIBUTION_ID`: The distribution ID from above
   - `AWS_ACCESS_KEY_ID`: AWS access key with S3 and CloudFront permissions
   - `AWS_SECRET_ACCESS_KEY`: AWS secret key

3. **Deploy code**:
   Push to `production` branch - GitHub Actions will automatically:
   - Build the widget SDK
   - Sync to S3
   - Invalidate CloudFront cache

## Manual Deployment

If you need to deploy manually:

```bash
cd widget-sdk
npm run build
aws s3 sync dist/ s3://scenaro-widget-sdk-cdn/ --delete
aws cloudfront create-invalidation --distribution-id <DIST_ID> --paths "/*"
```

## Custom Domain Setup

The Terraform configuration creates:
- ACM certificate for `cdn.scenaro.io` (in us-east-1)
- CloudFront distribution with the custom domain alias

To complete the DNS setup:

1. **If using Route53**: Uncomment the Route53 record in `main.tf` and set your zone ID.

2. **If using external DNS**: Create a CNAME record:
   - Name: `cdn.scenaro.io`
   - Value: `<cloudfront_domain_name>` (from `terraform output`)

## Cost Optimization

- **Price Class**: Set to `PriceClass_100` (North America + Europe only)
- **Caching**: Aggressive caching for static assets (1 year), shorter for runtime (1 hour)
- **Compression**: Enabled for all content

## Security

- S3 bucket is private (no public access)
- CloudFront uses Origin Access Control (OAC) to access S3
- HTTPS enforced (TLS 1.2+)
- Security headers configured (HSTS, X-Frame-Options, etc.)
- CORS configured for widget SDK access from any origin

