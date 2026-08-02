terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "project_name" {
  type    = string
  default = "sales-crm"
}

variable "environment" {
  type    = string
  default = "production"
}

variable "bucket_name" {
  type    = string
  default = null
}

variable "upload_prefix" {
  type    = string
  default = "uploads"

  validation {
    condition     = trim(var.upload_prefix, "/") != ""
    error_message = "upload_prefix cannot be empty."
  }
}

variable "tags" {
  type    = map(string)
  default = {}
}

locals {
  name_prefix   = lower(replace("${var.project_name}-${var.environment}", "/[^a-z0-9-]/", "-"))
  upload_prefix = trim(var.upload_prefix, "/")
  tags = merge(var.tags, {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  })
}

resource "aws_s3_bucket" "uploads" {
  bucket        = var.bucket_name
  bucket_prefix = var.bucket_name == null ? "${local.name_prefix}-uploads-" : null

  tags = local.tags
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_iam_user" "uploader" {
  name = "${local.name_prefix}-s3-uploader"
  path = "/service/"

  tags = local.tags
}

resource "aws_iam_access_key" "uploader" {
  user = aws_iam_user.uploader.name
}

data "aws_iam_policy_document" "uploader" {
  statement {
    sid       = "ListUploadPrefix"
    effect    = "Allow"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.uploads.arn]

    condition {
      test     = "StringLike"
      variable = "s3:prefix"
      values   = ["${local.upload_prefix}/*"]
    }
  }

  statement {
    sid    = "ReadWriteUploadedObjects"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
    ]
    resources = ["${aws_s3_bucket.uploads.arn}/${local.upload_prefix}/*"]
  }
}

resource "aws_iam_user_policy" "uploader" {
  name   = "${local.name_prefix}-s3-upload"
  user   = aws_iam_user.uploader.name
  policy = data.aws_iam_policy_document.uploader.json
}

output "bucket_name" {
  value = aws_s3_bucket.uploads.bucket
}

output "backend_env" {
  sensitive = true
  value     = <<EOT
AWS_ACCESS_KEY_ID=${aws_iam_access_key.uploader.id}
AWS_SECRET_ACCESS_KEY=${aws_iam_access_key.uploader.secret}
AWS_REGION=${var.aws_region}
S3_BUCKET=${aws_s3_bucket.uploads.bucket}
S3_UPLOAD_PREFIX=${local.upload_prefix}
EOT
}
