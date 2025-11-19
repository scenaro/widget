terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = "~> 5.0"
      configuration_aliases = [aws.us_east_1]
    }
  }
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
# Note: If zone_id is not provided, this resource will be skipped
# and certificate validation must be done manually via DNS records
resource "aws_acm_certificate_validation" "main" {
  count    = var.zone_id != "" ? 1 : 0
  provider = aws.us_east_1
  
  certificate_arn = aws_acm_certificate.main.arn

  validation_record_fqdns = [
    for record in aws_route53_record.cert_validation : record.fqdn
  ]

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
  value = var.zone_id != "" ? aws_acm_certificate_validation.main[0].certificate_arn : aws_acm_certificate.main.arn
}

