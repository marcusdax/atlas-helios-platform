# Atlas & Helios PropertyInsight AI Platform

## 🌟 Overview

Atlas & Helios is a comprehensive AI-powered platform for storm intelligence, property assessment, and damage estimation in the property insurance and restoration industry. The platform combines real-time weather data, computer vision analysis, and predictive analytics to provide actionable insights for property professionals.

### 🏗️ Architecture

- **Atlas**: Storm Intelligence System
  - Real-time weather monitoring and alerts
  - Damage probability scoring for properties
  - Predictive storm tracking
  - Geographic risk assessment

- **Helios**: AI-Powered Estimating System
  - Property assessment and damage analysis
  - Computer vision for damage detection
  - Automated estimate generation
  - Professional reporting tools

## 🚀 Features

### Core Features
- **Real-time Storm Tracking**: Integration with NOAA and weather APIs for live storm monitoring
- **AI-Powered Damage Assessment**: Computer vision analysis of property images
- **Predictive Analytics**: Machine learning models for damage probability scoring
- **Interactive Mapping**: Real-time storm visualization with property risk markers
- **Lead Generation**: Automated identification of high-potential prospects
- **Estimate Generation**: Professional estimates with line-item breakdown
- **CRM Integration**: Seamless integration with existing business systems
- **Mobile Field Tools**: Progressive Web App for on-site inspections

### Technical Features
- **Real-time Updates**: WebSocket connections for live data streaming
- **Responsive Design**: Mobile-first design with desktop optimization
- **PWA Support**: Installable app with offline capabilities
- **Secure Authentication**: JWT-based authentication with refresh tokens
- **API-First Architecture**: RESTful APIs for all core functions
- **Cloud-Native**: Docker containers with cloud deployment support
- **Scalable Database**: PostgreSQL with optimized queries and indexing

## 🛠️ Technology Stack

### Frontend
- **React 18**: Modern React with hooks and concurrent features
- **TypeScript**: Type-safe development (optional)
- **Tailwind CSS**: Utility-first CSS framework
- **Framer Motion**: Smooth animations and transitions
- **ECharts**: Advanced data visualization
- **Leaflet**: Interactive maps with storm overlay
- **React Router**: Client-side routing
- **Socket.io Client**: Real-time communication

### Backend
- **Node.js**: JavaScript runtime environment
- **Express.js**: Web application framework
- **Socket.io**: Real-time bidirectional communication
- **PostgreSQL**: Relational database for structured data
- **Redis**: Caching and session management
- **TensorFlow.js**: Machine learning for computer vision
- **Sharp**: Image processing and manipulation
- **Winston**: Structured logging
- **Joi**: Data validation
- **bcrypt**: Password hashing

### DevOps & Deployment
- **Docker**: Containerization for consistent deployments
- **Docker Compose**: Multi-container orchestration
- **Nginx**: Reverse proxy and static file serving
- **PostgreSQL**: Production database
- **Redis**: Caching and session store
- **Health Checks**: Application monitoring and diagnostics

## 📋 Prerequisites

Before running the application, ensure you have:

- **Node.js 18+**: JavaScript runtime
- **npm**: Package manager
- **PostgreSQL 13+**: Database server
- **Redis 6+**: Caching server
- **Docker & Docker Compose**: For containerized deployment
- **API Keys**: 
  - NOAA Weather API
  - Property data providers (CoreLogic, Black Knight)
  - Computer vision services

## 🚀 Quick Start

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/marcusdax/atlas-helios-platform.git
   cd atlas-helios-platform
   ```

2. **Install dependencies**
   ```bash
   npm run install:all
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Database Setup**
   ```bash
   # Start PostgreSQL and create database
   createdb atlas_helios_dev
   
   # Run migrations
   cd backend
   npm run migrate
   ```

5. **Start the application**
   ```bash
   # Development mode (starts both frontend and backend)
   npm run dev
   
   # Or start individually
   npm run backend:dev  # Backend on port 5000
   npm run frontend:dev # Frontend on port 3000
   ```

### Docker Deployment

1. **Environment Setup**
   ```bash
   cp .env.example .env
   # Configure database and API keys
   ```

2. **Start with Docker Compose**
   ```bash
   docker-compose up -d
   ```

3. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000
   - Database Admin (pgAdmin): http://localhost:5050
   - Redis Commander: http://localhost:8081

## 🔧 Configuration

### Environment Variables

Key environment variables to configure:

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=atlas_helios_dev
DB_USER=postgres
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your-super-secure-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret

# External APIs
NOAA_API_KEY=your-noaa-key
CORELOGIC_API_KEY=your-corelogic-key
BLACKKNIGHT_API_KEY=your-blackknight-key

# Computer Vision
CV_DAMAGE_MODEL_PATH=/models/damage-detection
CV_ROOF_MODEL_PATH=/models/roof-classification

# Frontend
FRONTEND_URL=http://localhost:3000
REACT_APP_WS_URL=ws://localhost:5000
```

### Database Schema

The application uses the following main tables:
- `users`: User accounts and authentication
- `companies`: Company/organization data
- `properties`: Property information and metadata
- `property_assessments`: AI-powered property assessments
- `storm_events`: Weather events and alerts
- `leads`: Generated leads and prospects
- `estimates`: Professional estimates and proposals

## 📚 API Documentation

### Authentication Endpoints
```
POST /api/auth/login          # User login
POST /api/auth/register       # User registration
POST /api/auth/refresh        # Refresh access token
POST /api/auth/logout         # User logout
GET  /api/auth/me             # Get current user
```

### Property Management
```
GET  /api/properties          # List properties
POST /api/properties          # Create property
GET  /api/properties/:id      # Get property details
PUT  /api/properties/:id      # Update property
GET  /api/properties/search   # Search properties
```

### Storm Intelligence
```
GET  /api/storms              # Get active storms
GET  /api/storms/:id          # Get storm details
POST /api/storms/track        # Start storm tracking
GET  /api/storms/report/:id   # Get storm report
```

### Property Assessments
```
POST /api/assessments         # Start assessment
GET  /api/assessments/:id     # Get assessment results
PUT  /api/assessments/:id     # Update assessment
GET  /api/assessments/history # Assessment history
```

### Lead Management
```
GET  /api/leads               # List leads
POST /api/leads               # Create lead
PUT  /api/leads/:id           # Update lead
POST /api/leads/export        # Export to CRM
```

### Estimate Generation
```
POST /api/estimates           # Create estimate
GET  /api/estimates/:id       # Get estimate
PUT  /api/estimates/:id       # Update estimate
POST /api/estimates/:id/send  # Send estimate
```

### Alter Rendering Engine
```
POST /api/renders             # Render a before/after improvement (?mode=async for a job)
GET  /api/renders/:id         # Poll an async render
GET  /api/renders/industries  # Trade presets for the picker
```

## 🎨 Alter Rendering Engine

The before/after property renderer is packaged separately from the platform, under
[`packages/`](packages/README.md), so it can be reused in other products:

| Package | What it is |
|---|---|
| `@alter/render-core` | The engine — providers, prompt guardrails, idempotency, retry, circuit breaking, caching, telemetry. No framework, no DOM. |
| `@alter/render-server` | A mountable Express router. The only place the provider API key exists. |
| `@alter/render-elements` | `<alter-compare>`, the before/after slider as a custom element — works with or without a framework. |
| `@alter/render-react` | The `useAlterRender` hook and an `<AlterCompare>` component. |

A standalone app built on them lives in
[`apps/propertyinsight-studio`](apps/propertyinsight-studio/README.md) — the full
PropertyInsight product (render studio, suggestions, geospatial screening, campaign
one-pagers, market framing) with its own server, build and deploy, independent of the
Atlas & Helios backend.

Inside this repo they are also wired up by `backend/src/routes/renderRoutes.js`,
`frontend/src/lib/renderer.js`, and `frontend/src/components/render/AlterRenderPanel.js`.
[`examples/vanilla.html`](examples/vanilla.html) shows the same engine driven from a plain
HTML page with no build step.

With no `ALTER_RENDER_API_KEY` configured the engine boots on a mock provider that returns
real (synthetic) images offline, so the feature is demoable and testable before any key is
provisioned. See [`packages/README.md`](packages/README.md) for the full guide.

## 🔒 Security

### Authentication & Authorization
- JWT-based authentication with access and refresh tokens
- Role-based access control (RBAC)
- Password hashing with bcrypt (12 rounds)
- Session management with Redis

### Data Protection
- Input validation with Joi
- SQL injection prevention with parameterized queries
- CORS configuration for cross-origin requests
- Rate limiting on API endpoints
- Helmet.js for security headers

### API Security
- HTTPS enforcement in production
- API key validation for external services
- Request/response logging for audit trails
- Secure headers and CSRF protection

## 📱 Mobile Support

The platform includes Progressive Web App (PWA) features:

- **Offline Capability**: Core features work without internet
- **Install Prompts**: Users can install as native app
- **Push Notifications**: Real-time storm alerts and updates
- **Mobile-Optimized UI**: Touch-friendly interface
- **Camera Integration**: Photo capture for assessments
- **GPS Integration**: Location-based property services

## 🤖 AI & Machine Learning

### Computer Vision Pipeline
- **Damage Detection**: TensorFlow.js models for image analysis
- **Roof Classification**: Automated roof type identification
- **Severity Assessment**: Damage severity scoring
- **Material Recognition**: Construction material identification

### Predictive Analytics
- **Storm Tracking**: NOAA data integration with predictive modeling
- **Risk Scoring**: Property-specific damage probability
- **Lead Scoring**: AI-powered prospect prioritization
- **Cost Estimation**: Automated repair cost calculations

## 🗄️ Database Design

### PostgreSQL Schema
The database is designed for scalability and performance:

- **Indexed queries** for fast property searches
- **JSON columns** for flexible metadata storage
- **Foreign key constraints** for data integrity
- **Composite indexes** for complex queries
- **Partitioning** for large datasets

### Data Relationships
```
Users -> Companies (Many-to-One)
Companies -> Properties (One-to-Many)
Properties -> Assessments (One-to-Many)
Properties -> Leads (One-to-Many)
StormEvents -> Properties (Many-to-Many)
```

## 🔄 Real-time Features

### WebSocket Events
- **storm_alert**: New weather alerts
- **storm_update**: Storm tracking updates
- **property_assessment_complete**: Assessment results
- **new_leads_generated**: Lead notifications
- **estimate_status_change**: Estimate updates

### Live Dashboard
- Real-time storm map updates
- Live property risk scores
- Instant notification delivery
- Collaborative assessment features

## 📊 Monitoring & Analytics

### Application Monitoring
- **Health checks** for all services
- **Performance metrics** tracking
- **Error logging** with Winston
- **Database query monitoring**

### Business Analytics
- **Property assessment metrics**
- **Lead conversion tracking**
- **Storm impact analysis**
- **User activity monitoring**

## 🚢 Deployment

### Production Deployment

#### AWS Deployment
```bash
# Using Docker and AWS ECS
docker build -t atlas-helios-platform .
docker tag atlas-helios-platform:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/atlas-helios-platform:latest
```

#### Kubernetes Deployment
```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/
```

#### Environment-Specific Configs
- **Development**: Local development with hot reload
- **Staging**: Production-like environment for testing
- **Production**: Optimized for performance and security

### CI/CD Pipeline
1. **Code Commit** → GitHub/GitLab
2. **Automated Tests** → Jest, Cypress
3. **Build & Containerize** → Docker
4. **Security Scan** → Snyk, OWASP
5. **Deploy to Staging** → Automated testing
6. **Deploy to Production** → Blue-green deployment

## 🧪 Testing

### Test Strategy
- **Unit Tests**: Jest for backend logic
- **Integration Tests**: API endpoint testing
- **E2E Tests**: Cypress for user workflows
- **Performance Tests**: Load testing with Artillery
- **Security Tests**: OWASP ZAP scanning

### Running Tests
```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test

# E2E tests
npm run test:e2e

# All tests
npm run test:all
```

## 📈 Performance Optimization

### Frontend Optimizations
- **Code splitting** for faster loading
- **Lazy loading** of components
- **Image optimization** with Sharp
- **Caching strategies** with service workers
- **Bundle analysis** and optimization

### Backend Optimizations
- **Database indexing** for fast queries
- **Connection pooling** for database efficiency
- **Caching** with Redis for frequently accessed data
- **Compression** of API responses
- **Rate limiting** to prevent abuse

## 🤝 Contributing

### Development Workflow
1. **Fork** the repository
2. **Create** a feature branch
3. **Make** your changes
4. **Add** tests for new features
5. **Submit** a pull request

### Code Standards
- **ESLint** for JavaScript/TypeScript linting
- **Prettier** for code formatting
- **Husky** for pre-commit hooks
- **Conventional Commits** for commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Documentation
- **API Documentation**: Available at `/docs/api`
- **User Guide**: Comprehensive user documentation
- **Developer Guide**: Technical implementation details

### Getting Help
- **GitHub Issues**: Bug reports and feature requests
- **Discord**: Community chat and support
- **Email**: support@propertyinsight.ai
- **Documentation**: https://docs.propertyinsight.ai

## 🗺️ Roadmap

### Phase 1 (Current)
- ✅ Core storm intelligence platform
- ✅ Property assessment tools
- ✅ Basic estimate generation
- ✅ Real-time notifications

### Phase 2 (Q2 2024)
- 🔄 Advanced AI models
- 🔄 CRM integrations
- 🔄 Mobile app improvements
- 🔄 Advanced reporting

### Phase 3 (Q3 2024)
- 📅 Multi-tenant architecture
- 📅 Advanced analytics
- 📅 API marketplace
- 📅 Enterprise features

---

**Built with ❤️ by MiniMax Agent**

For more information, visit [PropertyInsight.ai](https://propertyinsight.ai)