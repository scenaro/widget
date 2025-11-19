variable "domain_name" {
  description = "Custom domain name (e.g. cdn.scenaro.io)"
  type        = string
}

variable "s3_bucket_id" {
  description = "S3 bucket ID to use as origin"
  type        = string
}

variable "s3_bucket_domain_name" {
  description = "S3 bucket domain name"
  type        = string
}

variable "certificate_arn" {
  description = "ACM certificate ARN for the custom domain"
  type        = string
}

variable "common_tags" {
  description = "Common tags to apply to resources"
  type        = map(string)
  default     = {}
}

# CloudFront Origin Access Identity (OAI) - deprecated but still works
# Using Origin Access Control (OAC) is recommended for new deployments
resource "aws_cloudfront_origin_access_control" "main" {
  name                              = "${var.domain_name}-oac"
  description                       = "OAC for ${var.domain_name}"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# CloudFront distribution
resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "CDN for Scenaro Widget SDK"
  default_root_object = "widget.js"
  price_class         = "PriceClass_100" # Use only North America and Europe (cheaper)

  aliases = [var.domain_name]

  origin {
    domain_name              = var.s3_bucket_domain_name
    origin_id               = "S3-${var.s3_bucket_id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.main.id
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${var.s3_bucket_id}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 86400    # 1 day
    max_ttl                = 31536000 # 1 year
    compress               = true

    # Security headers
    response_headers_policy_id = aws_cloudfront_response_headers_policy.main.id
  }

  # Cache behavior for runtime/index.html
  ordered_cache_behavior {
    path_pattern     = "runtime/*"
    target_origin_id = "S3-${var.s3_bucket_id}"

    allowed_methods = ["GET", "HEAD", "OPTIONS"]
    cached_methods  = ["GET", "HEAD"]

    forwarded_values {
      query_string = true # Important: preserve ?scenario=xxx query params
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600     # 1 hour (runtime can change more frequently)
    max_ttl                = 86400    # 1 day
    compress               = true

    response_headers_policy_id = aws_cloudfront_response_headers_policy.main.id
  }

  # Cache behavior for engines and connectors (can cache longer)
  ordered_cache_behavior {
    path_pattern     = "engines/*"
    target_origin_id = "S3-${var.s3_bucket_id}"

    allowed_methods = ["GET", "HEAD", "OPTIONS"]
    cached_methods  = ["GET", "HEAD"]

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 86400    # 1 day
    max_ttl                = 31536000 # 1 year
    compress               = true

    response_headers_policy_id = aws_cloudfront_response_headers_policy.main.id
  }

  ordered_cache_behavior {
    path_pattern     = "connectors/*"
    target_origin_id = "S3-${var.s3_bucket_id}"

    allowed_methods = ["GET", "HEAD", "OPTIONS"]
    cached_methods  = ["GET", "HEAD"]

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 86400    # 1 day
    max_ttl                = 31536000 # 1 year
    compress               = true

    response_headers_policy_id = aws_cloudfront_response_headers_policy.main.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = var.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = merge(var.common_tags, {
    Name = "CloudFront-${var.domain_name}"
  })
}

# Security headers policy
resource "aws_cloudfront_response_headers_policy" "main" {
  name = "${var.domain_name}-security-headers"

  security_headers_config {
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains          = true
      override                     = true
    }
    content_type_options {
      override = true
    }
    frame_options {
      frame_option = "SAMEORIGIN"
      override     = true
    }
    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }
  }

  cors_config {
    access_control_allow_origins {
      items = ["*"]
    }
    access_control_allow_headers {
      items = ["*"]
    }
    access_control_allow_methods {
      items = ["GET", "HEAD", "OPTIONS"]
    }
    access_control_allow_credentials = false
    access_control_max_age_sec        = 3600
    origin_override                    = true
  }
}

output "distribution_id" {
  value = aws_cloudfront_distribution.main.id
}

output "distribution_arn" {
  value = aws_cloudfront_distribution.main.arn
}

output "distribution_domain_name" {
  value = aws_cloudfront_distribution.main.domain_name
}

output "distribution_hosted_zone_id" {
  value = aws_cloudfront_distribution.main.hosted_zone_id
}

