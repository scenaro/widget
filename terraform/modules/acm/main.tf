variable "domain_name" {
  description = "Domain name for the certificate (e.g. cdn.scenaro.io)"
  type        = string
}

variable "zone_id" {
  description = "Route53 hosted zone ID for DNS validation (optional)"
  type        = string
  default     = ""
}

variable "common_tags" {
  description = "Common tags to apply to resources"
  type        = map(string)
  default     = {}
}

# ACM Certificate (must be in us-east-1 for CloudFront)
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

resource "aws_acm_certificate" "main" {
  provider          = aws.us_east_1
  domain_name       = var.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(var.common_tags, {
    Name = "Certificate-${var.domain_name}"
  })
}

# DNS validation record (if Route53 zone_id is provided)
resource "aws_acm_certificate_validation" "main" {
  provider        = aws.us_east_1
  certificate_arn = aws_acm_certificate.main.arn

  # If zone_id is provided, create validation records automatically
  # Otherwise, manual DNS validation is required
  validation_record_fqdns = var.zone_id != "" ? [
    for record in aws_route53_record.cert_validation : record.fqdn
  ] : []

  timeouts {
    create = "5m"
  }
}

# Route53 validation records (only if zone_id is provided)
resource "aws_route53_record" "cert_validation" {
  count   = var.zone_id != "" ? length(aws_acm_certificate.main.domain_validation_options) : 0
  zone_id = var.zone_id

  name    = aws_acm_certificate.main.domain_validation_options[count.index].resource_record_name
  type    = aws_acm_certificate.main.domain_validation_options[count.index].resource_record_type
  records = [aws_acm_certificate.main.domain_validation_options[count.index].resource_record_value]
  ttl     = 60
}

output "certificate_arn" {
  value = aws_acm_certificate.main.arn
}

output "certificate_validation_arn" {
  value = aws_acm_certificate_validation.main.certificate_arn
}

