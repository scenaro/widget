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

