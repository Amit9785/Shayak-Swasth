# HealthCare Management Backend - FastAPI

Complete FastAPI backend for the HealthCare Management Platform with role-based access, OTP verification, and AI features.

## Features

✅ **Authentication**
- Phone + OTP authentication
- Email/Password login
- JWT token-based sessions

✅ **Role-Based Access Control**
- Patient, Doctor, Hospital Manager, Admin roles
- Separate roles table for security

✅ **Patient Records Management**
- Upload to AWS S3
- File type detection (PDF, Image, DICOM, Reports)
- View/Download records

✅ **Hospital Manager Security**
- OTP verification for sensitive actions
- Upload/Update/Delete with 2FA

✅ **Audit Logging**
- Complete access tracking
- Action timestamps and user info

✅ **AI Features**
- Semantic search with embeddings
- "Ask your report" chatbot
- OpenAI integration

## Setup

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your credentials
```

### 3. Setup Database

```bash
# Using Docker Compose (recommended)
docker-compose up -d db

# Or install PostgreSQL with pgvector manually
psql -U postgres -c "CREATE DATABASE healthcare_db;"
psql -U postgres -d healthcare_db -c "CREATE EXTENSION vector;"
```

### 4. Run Application

```bash
# Development
uvicorn main:app --reload --port 8000

# Or using Docker Compose (includes database)
docker-compose up
```

### 5. Access API Documentation

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Deployment Options

### Option 1: AWS (EC2 + RDS + S3)

1. **RDS PostgreSQL**
   ```bash
   # Create RDS instance with PostgreSQL 16 + pgvector
   ```

2. **S3 Bucket**
   ```bash
   aws s3 mb s3://healthcare-records-bucket
   aws s3api put-bucket-cors --bucket healthcare-records-bucket --cors-configuration file://cors.json
   ```

3. **EC2 Deployment**
   ```bash
   # SSH to EC2
   git clone your-repo
   cd backend
   pip install -r requirements.txt
   uvicorn main:app --host 0.0.0.0 --port 8000
   
   # Or use systemd service
   sudo cp healthcare-api.service /etc/systemd/system/
   sudo systemctl enable healthcare-api
   sudo systemctl start healthcare-api
   ```

### Option 2: Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Deploy
railway up
```

Add environment variables in Railway dashboard.

### Option 3: Render

1. Connect your GitHub repo
2. Create new Web Service
3. Build Command: `pip install -r requirements.txt`
4. Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add environment variables

### Option 4: DigitalOcean App Platform

```bash
# Create app.yaml
name: healthcare-api
services:
- name: api
  dockerfile_path: Dockerfile
  github:
    repo: your-username/your-repo
    branch: main
  envs:
    - key: DATABASE_URL
      value: ${db.DATABASE_URL}
  http_port: 8000
databases:
- name: db
  engine: PG
  version: "16"
```

## API Endpoints

### Authentication
- `POST /api/auth/send-otp` - Send OTP
- `POST /api/auth/verify-otp` - Verify OTP & Login
- `POST /api/auth/login` - Email/Password login
- `POST /api/auth/logout` - Logout

### Patients
- `POST /api/patients/` - Create patient profile
- `GET /api/patients/me` - Get my profile
- `GET /api/patients/search` - Search patients
- `GET /api/patients/{id}` - Get patient by ID

### Records
- `POST /api/records/upload` - Upload record
- `GET /api/records/` - List records
- `GET /api/records/{id}` - Get record
- `DELETE /api/records/{id}` - Delete record

### Hospital Manager
- `POST /api/manager/send-otp` - Send OTP for action
- `POST /api/manager/verify-otp` - Verify OTP

### Admin
- `GET /api/admin/users` - List all users
- `GET /api/admin/audit-logs` - View audit logs
- `POST /api/admin/users/{id}/roles` - Assign role
- `DELETE /api/admin/users/{id}` - Delete user

### AI Features
- `POST /api/ai/embed` - Generate embeddings
- `POST /api/ai/search` - Semantic search
- `POST /api/ai/ask` - Ask report questions

## Database Schema

See `models.py` for complete schema including:
- users
- user_roles
- patients
- records
- record_texts
- embeddings
- shared_access
- access_logs
- manager_action_otps

## Security Considerations

1. **Always use HTTPS in production**
2. **Change SECRET_KEY** to a strong random value
3. **Enable Twilio** for real OTP sending
4. **Setup S3 bucket policies** properly
5. **Use strong passwords** for database
6. **Enable rate limiting** (add middleware)
7. **Implement HIPAA compliance** measures

## Testing

```bash
# Install test dependencies
pip install pytest pytest-asyncio httpx

# Run tests
pytest
```

## Monitoring

- Add Sentry for error tracking
- Use CloudWatch/DataDog for metrics
- Enable PostgreSQL query logging
- Monitor S3 usage and costs

## Frontend Integration

Update your Lovable frontend `.env`:
```bash
VITE_API_URL=https://your-api-domain.com
```

Then update API calls to use this URL.

## Support

For issues or questions, contact the development team.

<!-- Ashmit contribution -->
