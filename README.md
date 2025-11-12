# Shayak-Swasth - Healthcare Management Platform

## 🏥 What is Shayak-Swasth?

**Shayak-Swasth** is a comprehensive healthcare management platform designed to streamline medical record management, enable secure access control, and leverage AI-powered features for enhanced healthcare delivery. The platform provides role-based access for patients, doctors, hospital managers, and administrators to manage medical records efficiently and securely.

## ✨ Key Features

### 🔐 Authentication & Security
- **Multi-factor Authentication**: Phone-based OTP verification and email/password login
- **Role-Based Access Control (RBAC)**: Four distinct roles with specific permissions
  - **Patient**: Manage personal medical records
  - **Doctor**: Access patient records with permissions
  - **Hospital Manager**: Administrative controls with 2FA for sensitive operations
  - **Admin**: System-wide management and audit capabilities
- **Secure Storage**: Integration with AWS S3 for encrypted file storage
- **Audit Trail**: Complete logging of all system actions for compliance

### 📄 Medical Records Management
- **Upload & Store**: Support for multiple file types (PDF, Images, DICOM, Reports)
- **Organize Records**: Categorize and tag medical documents
- **Share Access**: Grant controlled access to healthcare providers
- **Download & View**: Easy access to your medical history
- **Version Control**: Track changes and updates to records

### 🤖 AI-Powered Features
- **Semantic Search**: Find relevant medical records using natural language queries
- **Ask Your Report**: Interactive chatbot to answer questions about medical documents
- **OpenAI Integration**: Leveraging advanced AI for document analysis
- **Vector Embeddings**: PostgreSQL pgvector for efficient similarity search

### 👥 Role-Specific Dashboards
- **Patient Dashboard**: View and manage personal medical records, upload new documents
- **Doctor Dashboard**: Search patients, access granted records, manage patient care
- **Hospital Manager Dashboard**: Administrative controls with OTP verification for sensitive actions
- **Admin Dashboard**: User management, system monitoring, and audit log access

### 📊 Data Management
- **PostgreSQL Database**: Robust relational database with pgvector extension
- **Structured Data**: Organized tables for users, patients, records, and access logs
- **Efficient Querying**: Optimized database schema for fast data retrieval

## 🛠️ Technology Stack

### Frontend
- **React 18**: Modern UI library for building interactive interfaces
- **TypeScript**: Type-safe development
- **Vite**: Fast build tool and development server
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn-ui**: Beautiful and accessible UI components
- **React Router**: Client-side routing
- **TanStack Query**: Data fetching and caching
- **React Hook Form**: Form handling with validation
- **Zod**: Schema validation

### Backend
- **FastAPI**: High-performance Python web framework
- **PostgreSQL 14+**: Relational database with pgvector extension
- **SQLAlchemy**: Python ORM for database operations
- **JWT**: Secure token-based authentication
- **Bcrypt**: Password hashing
- **Pydantic**: Data validation and settings management

### Cloud Services
- **AWS S3**: Secure file storage for medical records
- **OpenAI API**: AI-powered search and document analysis
- **Twilio** (optional): SMS OTP delivery

### DevOps
- **Docker**: Containerization for easy deployment
- **Docker Compose**: Multi-container orchestration

## 🚀 Getting Started

### Prerequisites
- **Node.js 18+** and npm
- **Python 3.9+**
- **PostgreSQL 14+** with pgvector extension
- **Docker** (optional, recommended)

### Quick Start with Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/Amit9785/Shayak-Swasth.git
cd Shayak-Swasth

# Start the backend (includes database)
cd backend
docker-compose up -d

# In a new terminal, start the frontend
cd ..
npm install
npm run dev
```

Visit `http://localhost:8080` to access the application.

### Manual Setup

#### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Start the server
uvicorn main:app --reload --port 8000
```

#### 2. Frontend Setup

```bash
# From project root
npm install

# Create environment file
echo "VITE_API_URL=http://localhost:8000" > .env

# Start development server
npm run dev
```

For detailed setup instructions, see [STARTUP.md](STARTUP.md).

## 📖 Documentation

- **[STARTUP.md](STARTUP.md)**: Comprehensive setup and deployment guide
- **[Backend README](backend/README.md)**: Backend API documentation
- **[Backend DEPLOYMENT](backend/DEPLOYMENT.md)**: Production deployment guide
- **API Documentation**: Available at `http://localhost:8000/docs` when running

## 🔒 Security Features

- **HIPAA-Ready**: Designed with healthcare compliance in mind
- **Encrypted Storage**: AWS S3 with encryption at rest
- **Secure Communication**: HTTPS/TLS for all data transmission
- **Access Logging**: Complete audit trail of all actions
- **OTP Verification**: Two-factor authentication for sensitive operations
- **JWT Tokens**: Secure session management
- **Password Hashing**: Bcrypt for password security

## 🎯 Use Cases

1. **Personal Health Records**: Patients can store and organize all medical documents in one place
2. **Doctor-Patient Communication**: Secure sharing of medical records between patients and healthcare providers
3. **Hospital Management**: Administrative tools for managing patient records and access
4. **Medical Research**: AI-powered search to find relevant medical information quickly
5. **Emergency Access**: Quick access to critical medical information when needed
6. **Compliance**: Audit logs for regulatory compliance and accountability

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Test thoroughly
5. Commit: `git commit -m 'Add some feature'`
6. Push: `git push origin feature/your-feature`
7. Open a Pull Request

## 📝 Development Workflow

### Editing Code

**Use your preferred IDE**

```sh
# Clone the repository
git clone https://github.com/Amit9785/Shayak-Swasth.git

# Navigate to the project directory
cd Shayak-Swasth

# Install dependencies
npm install

# Start development server
npm run dev
```

**Edit directly in GitHub**
- Navigate to the desired file(s)
- Click the "Edit" button (pencil icon) at the top right
- Make your changes and commit

**Use GitHub Codespaces**
- Click on the "Code" button (green button)
- Select the "Codespaces" tab
- Click "New codespace"
- Edit files directly within the Codespace

### Available Scripts

```bash
# Frontend
npm run dev          # Start development server
npm run build        # Build for production
npm run build:dev    # Build for development
npm run lint         # Run ESLint
npm run preview      # Preview production build

# Backend
cd backend
uvicorn main:app --reload  # Start development server
pytest                      # Run tests
```

## 🌐 Deployment

The application can be deployed to various platforms:

- **AWS**: EC2, RDS, S3
- **Railway**: One-click deployment
- **Render**: Web services deployment
- **DigitalOcean**: App Platform

See [backend/DEPLOYMENT.md](backend/DEPLOYMENT.md) for detailed deployment instructions.

## 📊 Project Structure

```
Shayak-Swasth/
├── backend/              # FastAPI backend
│   ├── routers/         # API route handlers
│   ├── models.py        # Database models
│   ├── schemas.py       # Pydantic schemas
│   ├── auth_utils.py    # Authentication utilities
│   ├── database.py      # Database configuration
│   └── main.py          # Application entry point
├── src/                 # React frontend
│   ├── components/      # Reusable UI components
│   ├── pages/          # Page components
│   ├── hooks/          # Custom React hooks
│   └── lib/            # Utility functions
├── README.md           # This file
├── STARTUP.md          # Setup guide
└── package.json        # Node dependencies
```

## 🐛 Troubleshooting

Common issues and solutions:

**Database Connection Issues**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Verify pgvector extension
psql -U postgres -d healthcare_db -c "SELECT * FROM pg_extension WHERE extname = 'vector';"
```

**Backend Not Starting**
```bash
# Check Python version
python --version  # Should be 3.9+

# Reinstall dependencies
pip install -r requirements.txt --force-reinstall
```

**Frontend Build Issues**
```bash
# Clear cache
rm -rf node_modules package-lock.json
npm install
```

## 📞 Support

For questions, issues, or suggestions:
- Open an issue on GitHub
- Check the API documentation at `/docs`
- Review the [STARTUP.md](STARTUP.md) guide

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

Built with modern technologies and best practices for healthcare data management, ensuring security, scalability, and user experience.
