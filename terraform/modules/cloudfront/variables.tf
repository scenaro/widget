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

