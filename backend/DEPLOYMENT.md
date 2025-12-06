# Deployment Guide - FastAPI Backend

## Quick Start

### Local Development

```bash
# 1. Clone and setup
git clone your-repo
cd backend

# 2. Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment
cp .env.example .env
# Edit .env with your values

# 5. Start database (Docker)
docker-compose up -d db

# 6. Initialize database
psql -U postgres -d healthcare_db -f init_db.sql

# 7. Run API
uvicorn main:app --reload
```

## Production Deployment

### AWS Deployment (Recommended)

#### 1. Setup RDS PostgreSQL

```bash
# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier healthcare-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 16.1 \
  --master-username postgres \
  --master-user-password YourPassword123 \
  --allocated-storage 20

# Connect and enable pgvector
psql -h your-rds-endpoint.rds.amazonaws.com -U postgres -d postgres
CREATE EXTENSION vector;
```

#### 2. Setup S3 Bucket

```bash
# Create bucket
aws s3 mb s3://healthcare-records-prod

# Create CORS configuration
cat > cors.json << EOF
{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3000
    }
  ]
}
EOF

aws s3api put-bucket-cors --bucket healthcare-records-prod --cors-configuration file://cors.json

# Setup bucket policy (private access)
cat > policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::YOUR_ACCOUNT_ID:user/healthcare-api"
      },
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::healthcare-records-prod",
        "arn:aws:s3:::healthcare-records-prod/*"
      ]
    }
  ]
}
EOF

aws s3api put-bucket-policy --bucket healthcare-records-prod --policy file://policy.json
```

#### 3. Deploy to EC2

```bash
# SSH to EC2 instance
ssh -i your-key.pem ubuntu@ec2-ip-address

# Install dependencies
sudo apt update
sudo apt install python3.11 python3-pip python3-venv nginx -y

# Clone and setup
git clone your-repo
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Create systemd service
sudo nano /etc/systemd/system/healthcare-api.service
```

**healthcare-api.service:**
```ini
[Unit]
Description=HealthCare API
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/backend
Environment="PATH=/home/ubuntu/backend/venv/bin"
EnvironmentFile=/home/ubuntu/backend/.env
ExecStart=/home/ubuntu/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
# Start service
sudo systemctl daemon-reload
sudo systemctl enable healthcare-api
sudo systemctl start healthcare-api
sudo systemctl status healthcare-api
```

#### 4. Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/healthcare-api
```

**nginx config:**
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/healthcare-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Setup SSL with Let's Encrypt
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d api.yourdomain.com
```

### Railway Deployment

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login
railway login

# 3. Initialize project
railway init

# 4. Add PostgreSQL
railway add

# 5. Deploy
railway up

# 6. Set environment variables in Railway dashboard
# - SECRET_KEY
# - AWS_ACCESS_KEY_ID
# - AWS_SECRET_ACCESS_KEY
# - S3_BUCKET_NAME
# - TWILIO_* (if using)
# - OPENAI_API_KEY
```

### Render Deployment

1. **Connect GitHub Repository**
   - Go to render.com
   - Click "New +" → "Web Service"
   - Connect your repository

2. **Configure Service**
   ```
   Name: healthcare-api
   Environment: Python 3
   Build Command: pip install -r requirements.txt
   Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT
   ```

3. **Add PostgreSQL Database**
   - Click "New +" → "PostgreSQL"
   - Connect to your web service

4. **Environment Variables**
   - Add all from `.env.example`
   - DATABASE_URL will be auto-populated

5. **Deploy**
   - Click "Create Web Service"

### DigitalOcean App Platform

1. **Create app.yaml**
```yaml
name: healthcare-api
services:
  - name: api
    dockerfile_path: Dockerfile
    github:
      repo: your-username/your-repo
      branch: main
      deploy_on_push: true
    envs:
      - key: DATABASE_URL
        scope: RUN_TIME
        value: ${db.DATABASE_URL}
      - key: SECRET_KEY
        scope: RUN_TIME
        value: your-secret-key
      - key: AWS_ACCESS_KEY_ID
        scope: RUN_TIME
        value: your-aws-key
      - key: AWS_SECRET_ACCESS_KEY
        scope: RUN_TIME
        value: your-aws-secret
      - key: S3_BUCKET_NAME
        scope: RUN_TIME
        value: healthcare-records-prod
    http_port: 8000
    health_check:
      http_path: /api/health
    instance_size_slug: basic-xxs
    instance_count: 1

databases:
  - name: db
    engine: PG
    version: "16"
    size: db-s-1vcpu-1gb
```

2. **Deploy**
```bash
doctl apps create --spec app.yaml
```

## Environment Variables

**Required:**
```bash
DATABASE_URL=postgresql://user:pass@host:5432/dbname
SECRET_KEY=your-super-secret-jwt-key
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=healthcare-records-prod
```

**Optional:**
```bash
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1234567890
OPENAI_API_KEY=sk-...
APP_ENV=production
```

## Database Migrations

```bash
# Create migration
alembic revision --autogenerate -m "description"

# Apply migration
alembic upgrade head

# Rollback
alembic downgrade -1
```

## Monitoring & Logging

### Sentry Integration

```python
# Add to main.py
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

sentry_sdk.init(
    dsn="your-sentry-dsn",
    integrations=[FastApiIntegration()],
    traces_sample_rate=1.0,
)
```

### CloudWatch Logs (AWS)

```bash
# Install awslogs
sudo apt install awslogs -y

# Configure /etc/awslogs/awslogs.conf
[/var/log/healthcare-api.log]
datetime_format = %Y-%m-%d %H:%M:%S
file = /var/log/healthcare-api.log
buffer_duration = 5000
log_stream_name = {instance_id}
initial_position = start_of_file
log_group_name = /aws/ec2/healthcare-api
```

## Performance Tuning

### Gunicorn (Production)

```bash
pip install gunicorn

# Run with multiple workers
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### Database Connection Pooling

```python
# In database.py
engine = create_engine(
    DATABASE_URL,
    pool_size=20,
    max_overflow=0,
    pool_pre_ping=True
)
```

## Security Checklist

- ✅ HTTPS enabled (SSL certificate)
- ✅ CORS properly configured
- ✅ SECRET_KEY is random and secure
- ✅ Database passwords are strong
- ✅ S3 bucket is private
- ✅ Rate limiting enabled
- ✅ Input validation on all endpoints
- ✅ SQL injection protection (using ORM)
- ✅ XSS protection
- ✅ CSRF protection for state-changing operations
- ✅ Audit logging enabled
- ✅ Regular security updates

## Scaling

### Horizontal Scaling

```bash
# AWS Auto Scaling Group
aws autoscaling create-auto-scaling-group \
  --auto-scaling-group-name healthcare-api-asg \
  --launch-template LaunchTemplateId=lt-xxx \
  --min-size 2 \
  --max-size 10 \
  --desired-capacity 2 \
  --target-group-arns arn:aws:elasticloadbalancing:...
```

### Database Read Replicas

```bash
# Create RDS read replica
aws rds create-db-instance-read-replica \
  --db-instance-identifier healthcare-db-replica \
  --source-db-instance-identifier healthcare-db
```

## Backup & Recovery

```bash
# Automated RDS backups (AWS)
aws rds modify-db-instance \
  --db-instance-identifier healthcare-db \
  --backup-retention-period 7 \
  --preferred-backup-window "03:00-04:00"

# Manual backup
pg_dump -h your-rds-endpoint -U postgres healthcare_db > backup.sql

# Restore
psql -h your-rds-endpoint -U postgres healthcare_db < backup.sql
```

## Troubleshooting

**Connection errors:**
```bash
# Check if API is running
curl http://localhost:8000/api/health

# Check logs
sudo journalctl -u healthcare-api -f

# Check database connection
psql -h your-db-host -U postgres -d healthcare_db
```

**Performance issues:**
```bash
# Check database queries
# Enable slow query log in PostgreSQL
ALTER DATABASE healthcare_db SET log_min_duration_statement = 1000;

# Monitor with pgAdmin or psql
SELECT * FROM pg_stat_activity;
```

## Cost Optimization

- Use AWS Free Tier (t3.micro EC2, 20GB RDS)
- Enable S3 Lifecycle policies
- Use CloudFront CDN for static assets
- Implement database query caching
- Use reserved instances for production

## Support

For deployment issues:
1. Check logs: `sudo journalctl -u healthcare-api -f`
2. Verify environment variables
3. Test database connectivity
4. Check firewall rules
5. Review nginx logs: `sudo tail -f /var/log/nginx/error.log`
