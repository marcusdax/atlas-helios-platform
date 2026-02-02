# Atlas & Helios Platform - Deployment Guide

## 🚀 Production Deployment Checklist

### Pre-Deployment Setup

#### 1. Environment Configuration
```bash
# Copy environment template
cp .env.example .env.production

# Configure production settings
NODE_ENV=production
DATABASE_URL=postgresql://user:password@prod-db:5432/atlas_helios_prod
REDIS_URL=redis://prod-redis:6379
JWT_SECRET=your-production-jwt-secret-minimum-32-characters
FRONTEND_URL=https://your-domain.com
```

#### 2. External API Keys
Ensure you have production API keys for:
- **NOAA Weather API**: Weather data and alerts
- **Property Data APIs**: CoreLogic, Black Knight
- **Computer Vision Services**: TensorFlow models
- **Email Service**: SMTP configuration
- **Cloud Storage**: AWS S3 or equivalent

#### 3. Database Setup
```sql
-- Create production database
CREATE DATABASE atlas_helios_prod;

-- Create user with appropriate permissions
CREATE USER atlas_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE atlas_helios_prod TO atlas_user;

-- Run migrations
npm run migrate
```

### Cloud Deployment Options

#### Option 1: AWS Deployment

##### 1.1 ECR (Elastic Container Registry)
```bash
# Build and push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com

docker build -t atlas-helios-platform .
docker tag atlas-helios-platform:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/atlas-helios-platform:latest
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/atlas-helios-platform:latest
```

##### 1.2 ECS (Elastic Container Service)
```json
{
  "family": "atlas-helios-platform",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::123456789:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::123456789:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "123456789.dkr.ecr.us-east-1.amazonaws.com/atlas-helios-platform:latest",
      "portMappings": [
        {
          "containerPort": 5000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/atlas-helios-platform",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

##### 1.3 RDS (Relational Database Service)
```bash
# Create RDS PostgreSQL instance
aws rds create-db-instance \
  --db-instance-identifier atlas-helios-prod \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 14.9 \
  --master-username atlas_user \
  --master-user-password SecurePassword123! \
  --allocated-storage 20 \
  --vpc-security-group-ids sg-12345678 \
  --db-subnet-group-name atlas-subnet-group
```

#### Option 2: Google Cloud Platform

##### 2.1 Cloud Run Deployment
```bash
# Build and deploy to Cloud Run
gcloud run deploy atlas-helios-platform \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 5000 \
  --memory 1Gi \
  --cpu 1
```

##### 2.2 Cloud SQL Setup
```bash
# Create Cloud SQL instance
gcloud sql instances create atlas-helios-prod \
  --database-version POSTGRES_14 \
  --tier db-f1-micro \
  --region us-central1

# Create database
gcloud sql databases create atlas_helios_prod --instance atlas-helios-prod
```

#### Option 3: Azure Deployment

##### 3.1 Container Instances
```bash
# Deploy to Azure Container Instances
az container create \
  --resource-group atlas-helios-rg \
  --name atlas-helios-platform \
  --image atlas-helios-platform:latest \
  --ports 5000 \
  --environment-variables NODE_ENV=production
```

### Kubernetes Deployment

#### 1. Namespace and ConfigMap
```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: atlas-helios

---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: atlas-helios-config
  namespace: atlas-helios
data:
  NODE_ENV: "production"
  DB_HOST: "postgresql-service"
  REDIS_HOST: "redis-service"
  JWT_SECRET: "your-production-jwt-secret"
```

#### 2. Database Deployment
```yaml
# k8s/postgresql.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgresql
  namespace: atlas-helios
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgresql
  template:
    metadata:
      labels:
        app: postgresql
    spec:
      containers:
      - name: postgresql
        image: postgres:15-alpine
        env:
        - name: POSTGRES_DB
          value: "atlas_helios_prod"
        - name: POSTGRES_USER
          value: "atlas_user"
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: password
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc
```

#### 3. Application Deployment
```yaml
# k8s/backend.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: atlas-helios-backend
  namespace: atlas-helios
spec:
  replicas: 3
  selector:
    matchLabels:
      app: atlas-helios-backend
  template:
    metadata:
      labels:
        app: atlas-helios-backend
    spec:
      containers:
      - name: backend
        image: atlas-helios-platform:latest
        ports:
        - containerPort: 5000
        env:
        - name: NODE_ENV
          valueFrom:
            configMapKeyRef:
              name: atlas-helios-config
              key: NODE_ENV
        - name: DB_HOST
          valueFrom:
            configMapKeyRef:
              name: atlas-helios-config
              key: DB_HOST
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

#### 4. Service and Ingress
```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: atlas-helios-backend-service
  namespace: atlas-helios
spec:
  selector:
    app: atlas-helios-backend
  ports:
  - protocol: TCP
    port: 80
    targetPort: 5000
  type: ClusterIP

---
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: atlas-helios-ingress
  namespace: atlas-helios
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - api.your-domain.com
    secretName: atlas-helios-tls
  rules:
  - host: api.your-domain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: atlas-helios-backend-service
            port:
              number: 80
```

### SSL/TLS Configuration

#### Let's Encrypt with Cert-Manager
```yaml
# k8s/cert-manager.yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@your-domain.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
```

### Monitoring and Logging

#### 1. Prometheus Monitoring
```yaml
# k8s/monitoring.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: atlas-helios-metrics
  namespace: atlas-helios
spec:
  selector:
    matchLabels:
      app: atlas-helios-backend
  endpoints:
  - port: metrics
    path: /metrics
```

#### 2. ELK Stack for Logging
```yaml
# k8s/logging.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: filebeat-config
  namespace: atlas-helios
data:
  filebeat.yml: |
    filebeat.inputs:
    - type: container
      paths:
        - /var/log/containers/*atlas-helios*.log
      processors:
      - add_kubernetes_metadata:
          host: ${NODE_NAME}
          matchers:
          - logs_path:
              logs_path: "/var/log/containers/"
    output.elasticsearch:
      hosts: ["elasticsearch:9200"]
      index: "atlas-helios-logs-%{+yyyy.MM.dd}"
```

### Health Checks and Load Balancing

#### Application Health Endpoints
```javascript
// Backend health check
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await db.raw('SELECT 1');
    
    // Check Redis connection
    await redis.ping();
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        redis: 'connected',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});
```

### CI/CD Pipeline

#### GitHub Actions
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with:
        node-version: '18'
    - run: npm run test:all
    
  build-and-deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Build Docker image
      run: |
        docker build -t atlas-helios-platform .
        docker tag atlas-helios-platform:latest $ECR_REGISTRY/atlas-helios-platform:latest
    - name: Push to ECR
      run: |
        aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY
        docker push $ECR_REGISTRY/atlas-helios-platform:latest
    - name: Deploy to ECS
      run: |
        aws ecs update-service --cluster atlas-helios-cluster --service atlas-helios-service --force-new-deployment
```

### Backup and Disaster Recovery

#### Database Backup Strategy
```bash
# Automated daily backups
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > backup_$DATE.sql
aws s3 cp backup_$DATE.sql s3://atlas-helios-backups/database/
```

#### Cross-Region Replication
```yaml
# Database replication configuration
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: atlas-helios-primary
spec:
  instances: 3
  primaryUpdateStrategy: unsupervised
  postgresql:
    parameters:
      max_connections: "200"
  bootstrap:
    initdb:
      database: atlas_helios_prod
      owner: atlas_user
  streamingReplication:
    maxSlotLag: 10MB
    maxSynchronousSlots: 2
```

### Security Hardening

#### Container Security
```dockerfile
# Dockerfile security hardening
FROM node:18-alpine

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set ownership and permissions
RUN chown -R nodejs:nodejs /app && \
    chmod -R 755 /app

# Switch to non-root user
USER nodejs

# Use non-privileged ports
EXPOSE 5000

# Security labels
LABEL security.scan="enabled" \
      security.compliance="OWASP" \
      security.policies="strict"
```

#### Network Security
```yaml
# Network policies
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: atlas-helios-network-policy
  namespace: atlas-helios
spec:
  podSelector:
    matchLabels:
      app: atlas-helios-backend
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 5000
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgresql
    ports:
    - protocol: TCP
      port: 5432
```

### Performance Optimization

#### Database Optimization
```sql
-- Index optimization
CREATE INDEX CONCURRENTLY idx_properties_location 
ON properties USING GIST (point(longitude, latitude));

CREATE INDEX CONCURRENTLY idx_storms_detected_at 
ON storm_events (detected_at DESC);

-- Query optimization
ANALYZE;
VACUUM;
```

#### Caching Strategy
```javascript
// Redis caching implementation
const cacheMiddleware = (duration = 300) => {
  return async (req, res, next) => {
    const key = `cache:${req.originalUrl}`;
    const cached = await redis.get(key);
    
    if (cached) {
      return res.json(JSON.parse(cached));
    }
    
    // Cache the response
    res.sendResponse = res.json;
    res.json = (body) => {
      redis.setex(key, duration, JSON.stringify(body));
      res.sendResponse(body);
    };
    
    next();
  };
};
```

### Post-Deployment Checklist

#### 1. Health Verification
- [ ] All services are running and healthy
- [ ] Database connections are stable
- [ ] API endpoints are responding
- [ ] WebSocket connections are working
- [ ] SSL certificates are valid

#### 2. Functional Testing
- [ ] User authentication works
- [ ] Storm tracking is active
- [ ] Property assessments can be created
- [ ] Real-time updates are working
- [ ] Mobile app is accessible

#### 3. Performance Validation
- [ ] Response times are under SLA
- [ ] Database queries are optimized
- [ ] Memory and CPU usage is normal
- [ ] Load testing passes thresholds

#### 4. Security Verification
- [ ] All endpoints require authentication
- [ ] SSL/TLS is properly configured
- [ ] Rate limiting is active
- [ ] Security headers are present
- [ ] Vulnerability scan passes

### Monitoring and Alerting

#### Application Metrics
```javascript
// Prometheus metrics
const prometheus = require('prom-client');

// Create metrics
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

const propertyAssessmentsTotal = new prometheus.Counter({
  name: 'property_assessments_total',
  help: 'Total number of property assessments',
  labelNames: ['status']
});
```

#### Alerting Rules
```yaml
# alerting-rules.yaml
groups:
- name: atlas-helios
  rules:
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "High error rate detected"
      
  - alert: DatabaseConnectionFailure
    expr: up{job="postgresql"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Database connection failed"
```

---

**Deployment Support**: For deployment assistance, contact support@propertyinsight.ai