# Terraform

Creates a private S3 uploads bucket and an IAM user with only the permissions the backend upload flow needs.

```sh
cd terraform
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform apply
terraform output -raw backend_env
```

Add the printed values to `backend/.env.production` or your deployment secrets. For local uploads, add them to `backend/.env.development`.

Keep Terraform state private; the generated IAM secret is stored there.
