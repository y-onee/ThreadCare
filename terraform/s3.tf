resource "aws_s3_bucket" "receipts" {
  bucket        = "${var.project_name}-receipts-${var.environment}"
  force_destroy = true
}

# Block public access
resource "aws_s3_bucket_public_access_block" "receipts_block" {
  bucket = aws_s3_bucket.receipts.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enable server-side encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "receipts_encryption" {
  bucket = aws_s3_bucket.receipts.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# S3 Lifecycle Rule to transition archive files to Glacier
resource "aws_s3_bucket_lifecycle_configuration" "receipts_lifecycle" {
  bucket = aws_s3_bucket.receipts.id

  rule {
    id     = "archive-receipts"
    status = "Enabled"

    filter {}

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    expiration {
      days = 365
    }
  }
}
