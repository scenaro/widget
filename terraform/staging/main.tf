terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "scenaro-tfstate"
    key            = "scenaro/widget/staging/terraform.tfstate"
    region         = "eu-west-3"
    dynamodb_table = "scenaro-tf-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = "eu-west-3"
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

data "aws_route53_zone" "main" {
  name         = "scenaro.io"
  private_zone = false
}

locals {
  domain_name = "cdn.staging.scenaro.io"
  bucket_name = "scenaro-widget-cdn-staging"

  common_tags = {
    Project     = "scenaro-widget"
    Environment = "staging"
    ManagedBy   = "Terraform"
  }
}

module "acm" {
  source = "../modules/acm"
  providers = {
    aws.us_east_1 = aws.us_east_1
  }

  domain_name = local.domain_name
  zone_id     = data.aws_route53_zone.main.zone_id
  common_tags = local.common_tags
}

module "s3" {
  source = "../modules/s3"

  bucket_name = local.bucket_name
  domain_name = local.domain_name
  common_tags = local.common_tags
}

module "cloudfront" {
  source = "../modules/cloudfront"

  domain_name           = local.domain_name
  s3_bucket_id          = module.s3.bucket_id
  s3_bucket_domain_name = module.s3.bucket_regional_domain_name
  certificate_arn       = module.acm.certificate_validation_arn
  common_tags           = local.common_tags
}

resource "aws_s3_bucket_policy" "main" {
  bucket = module.s3.bucket_id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipal"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${module.s3.bucket_arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = module.cloudfront.distribution_arn
          }
        }
      }
    ]
  })

  depends_on = [module.cloudfront]
}

resource "aws_route53_record" "cdn" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = local.domain_name
  type    = "A"

  alias {
    name                   = module.cloudfront.distribution_domain_name
    zone_id                = module.cloudfront.distribution_hosted_zone_id
    evaluate_target_health = false
  }
}

output "s3_bucket_id" {
  value = module.s3.bucket_id
}

output "cloudfront_distribution_id" {
  value = module.cloudfront.distribution_id
}

output "custom_domain" {
  value = local.domain_name
}
