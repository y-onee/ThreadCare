# SafePay: Cloud-Native Payment Gateway with AI Fraud Detection

SafePay is a secure, transaction-safe, event-driven payment gateway built on AWS. It leverages serverless architectures (AWS Step Functions and AWS Lambda) to orchestrate validation, AI-powered fraud risk scoring (via Amazon Bedrock), payment network processing, persistent logging, and notification webhooks.

This project was built for the **CSCI 5411 Advanced Cloud Architecting** term project.

---

## Architecture Summary

SafePay decouples transaction ingestion from execution using a serverless pipeline:
1. **API Ingestion**: Merchants call the POST `/charge` endpoint on **Amazon API Gateway**.
2. **Orchestrator**: API Gateway starts execution of the **AWS Step Functions** State Machine. It immediately returns a `200 OK` with the execution ARN to the client to ensure sub-second response times.
3. **Validation**: The **Validate Lambda** parses payment credentials, transaction amounts, and currencies.
4. **AI Risk Assessment**: The **Analyze Risk Lambda** uses **Amazon Bedrock** (Anthropic Claude model) to analyze geolocation, transaction histories, and risk parameters. It falls back to a rules engine if Bedrock is throttled or restricted.
5. **Card Processing**: If approved, the **Process Card Lambda** simulates card authorization.
6. **Data Archival**: The **Generate Receipt Lambda** updates state in:
   - **Amazon DynamoDB**: Key-value fast querying for transaction statuses.
   - **Amazon S3**: Permanent long-term archiving of payment receipt JSONs with Glacier lifecycle policies.
   - **Amazon Aurora Serverless v2 (PostgreSQL)**: Relational tables for financial auditing.
7. **Webhook Notification**: The **Notify Merchant Lambda** publishes details to an **Amazon SNS** topic to dispatch notifications (SMS, Email, Webhooks).

### Architectural Diagram
You can review the drawn vector diagrams embedded in the compiled PDF report:
- `CSCI5411_Final_Report.pdf` (High-level architecture on Page 5, Sequence diagram on Page 6).

---

## Directory Structure

```
.
├── .github/workflows/deploy.yml   # GitHub Actions CI/CD Pipeline
├── src/lambdas/                    # AWS Lambda Function Source Code
│   ├── validate_transaction.js     # Step 1: Input schema check
│   ├── analyze_risk.js             # Step 2: Bedrock AI risk score
│   ├── process_card.js             # Step 3: Card processor simulator
│   ├── generate_receipt.js         # Step 4: S3 receipt / DB state
│   └── notify_merchant.js          # Step 5: SNS notifications
├── terraform/                      # Infrastructure as Code (IaC) files
│   ├── main.tf                     # Provider & Terraform setup
│   ├── variables.tf                # Deploy-time variables
│   ├── iam.tf                      # Security roles & policies
│   ├── apigateway.tf               # REST API Setup
│   ├── step_functions.tf           # State Machine definition
│   ├── lambdas.tf                  # Lambda function setups
│   ├── dynamodb.tf                 # DynamoDB Table
│   ├── s3.tf                       # S3 Buckets & Lifecycles
│   ├── rds.tf                      # VPC, Subnets, Security Groups, Aurora
│   └── monitoring.tf               # CloudWatch Alarms & Dashboards
├── tests/                          # Jest Unit Tests
│   └── lambdas.test.js             # 11 Unit tests covering Lambdas
├── scripts/                        # PDF Report generator
│   └── generate_report.py          # Python report compiler
├── package.json                    # Node dependencies and scripts
└── README.md                       # Documentation
```

---

## Prerequisite Setup

To run, deploy, or test SafePay, ensure you have the following installed locally:
1. **Node.js**: v18.0.0 or later (v20+ recommended).
2. **Python**: 3.9 or later (required to compile the PDF report).
3. **Terraform**: 1.5.0 or later.
4. **AWS CLI**: configured with appropriate credentials (if deploying to live AWS).

---

## Running Local Unit Tests

SafePay features an extensive Jest unit test suite that mocks AWS clients and Bedrock runtime parameters.

1. Install local dependencies:
   ```bash
   npm install
   ```
2. Run the test suite:
   ```bash
   npm test
   ```
3. Run test coverage checks:
   ```bash
   npm run test:coverage
   ```

---

## Infrastructure Deployment (IaC)

### AWS Academy Learner Lab Setup

AWS Academy Learner Lab restricts custom IAM Role creation and requires using a pre-configured IAM role called `LabRole`. Follow these workarounds to deploy:

1. **IAM Role Setup**:
   Open `terraform/lambdas.tf` and `terraform/step_functions.tf`.
   Replace the `role` and `role_arn` attributes to point to the pre-existing role ARN:
   ```hcl
   role = "arn:aws:iam::[YOUR_LEARNER_LAB_ACCOUNT_ID]:role/LabRole"
   ```
2. **Remove Custom IAM Resources**:
   Comment out or remove `terraform/iam.tf` since Learner Lab will reject custom role definitions.
3. **Database Security Group**:
   Ensure your private subnets match the routing table configured in your Learner Lab VPC.

### Deployment Instructions (Standard AWS Console / CLI)

1. Initialize Terraform directory:
   ```bash
   cd terraform
   terraform init
   ```
2. Validate syntax:
   ```bash
   terraform validate
   ```
3. View proposed cloud resources:
   ```bash
   terraform plan
   ```
4. Deploy the infrastructure:
   ```bash
   terraform apply
   ```
5. Note the outputs:
   - `apigateway_endpoint`: The HTTP post endpoint for processing charges.
   - `step_function_arn`: State machine resource name.

---

## Generating the PDF Term Report

The Graduate track PDF report compiles all NFRs, user stories, architecture schemas, and AWS Well-Architected Framework evaluations programmatically:

1. Install compilation dependencies:
   ```bash
   pip3 install reportlab
   ```
2. Run the generator script:
   ```bash
   python3 scripts/generate_report.py
   ```
3. The report is generated in the root directory: `CSCI5411_Final_Report.pdf`.
