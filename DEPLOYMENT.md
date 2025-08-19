# AI Document Chatbot - Deployment Guide

## 🚀 Deployment Instructions

### Frontend Deployment

#### 1. Environment Configuration

**For Development:**
```bash
# client/.env
VITE_API_BASE_URL=http://localhost:4000/api
```

**For Production:**
```bash
# client/.env
VITE_API_BASE_URL=https://your-backend-domain.com/api
```

#### 2. Build and Deploy Frontend

```bash
# Navigate to client directory
cd client

# Install dependencies
npm install

# Build for production
npm run build

# Deploy the 'dist' folder to your hosting service
```

**Recommended Frontend Hosting:**
- **Vercel** (Recommended)
- **Netlify**
- **GitHub Pages**
- **Firebase Hosting**

#### 3. Vercel Deployment (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd client
vercel

# Follow the prompts:
# - Set up and deploy: Yes
# - Which scope: Your account
# - Link to existing project: No
# - Project name: ai-chatbot-frontend
# - Directory: ./
# - Override settings: No
```

### Backend Deployment

#### 1. Environment Variables

Create `.env` file in server directory:
```bash
# server/.env
MONGODB_URI=your_mongodb_connection_string
GEMINI_API_KEY=your_gemini_api_key
PORT=4000
NODE_ENV=production
```

#### 2. Deploy Backend

**Recommended Backend Hosting:**
- **Railway** (Recommended)
- **Render**
- **Heroku**
- **DigitalOcean App Platform**

#### 3. Railway Deployment (Recommended)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Navigate to server directory
cd server

# Initialize Railway project
railway init

# Deploy
railway up
```

#### 4. Alternative: Render Deployment

1. Connect your GitHub repository to Render
2. Create a new Web Service
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Add environment variables in Render dashboard

### Environment Variables Setup

#### Frontend (.env)
```bash
# Development
VITE_API_BASE_URL=http://localhost:4000/api

# Production (replace with your actual backend URL)
VITE_API_BASE_URL=https://your-backend-url.railway.app/api
```

#### Backend (.env)
```bash
# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/ai-chatbot

# AI Service
GEMINI_API_KEY=your_gemini_api_key_here

# Server Configuration
PORT=4000
NODE_ENV=production

# CORS (optional - for specific frontend domains)
FRONTEND_URL=https://your-frontend-domain.vercel.app
```

### Post-Deployment Steps

#### 1. Update Frontend Environment
After backend deployment, update frontend `.env`:
```bash
VITE_API_BASE_URL=https://your-actual-backend-url.com/api
```

#### 2. Rebuild and Redeploy Frontend
```bash
cd client
npm run build
# Redeploy to your hosting service
```

#### 3. Test Deployment
- ✅ Frontend loads correctly
- ✅ Backend API responds
- ✅ Document upload works
- ✅ Chat functionality works
- ✅ Appointment booking works

### Troubleshooting

#### Common Issues:

**1. CORS Errors**
- Ensure backend CORS is configured for your frontend domain
- Check if API_BASE_URL is correct in frontend

**2. Environment Variables Not Loading**
- Verify `.env` files are in correct locations
- Ensure variables start with `VITE_` for frontend
- Restart development servers after changes

**3. Build Failures**
- Check all dependencies are installed
- Verify Node.js version compatibility
- Clear node_modules and reinstall if needed

**4. API Connection Issues**
- Verify backend is running and accessible
- Check network/firewall settings
- Ensure API endpoints are correct

### Production Checklist

- [ ] Frontend environment variables updated
- [ ] Backend environment variables set
- [ ] MongoDB connection working
- [ ] Gemini API key valid
- [ ] CORS configured correctly
- [ ] File upload limits appropriate
- [ ] Error handling working
- [ ] SSL certificates configured
- [ ] Domain names configured
- [ ] Performance optimized

### Monitoring and Maintenance

#### Recommended Tools:
- **Uptime Monitoring**: UptimeRobot, Pingdom
- **Error Tracking**: Sentry
- **Analytics**: Google Analytics
- **Performance**: Lighthouse, Web Vitals

#### Regular Maintenance:
- Monitor API usage and costs
- Update dependencies regularly
- Backup database regularly
- Monitor server resources
- Review error logs

### Support

For deployment issues:
1. Check the troubleshooting section above
2. Verify all environment variables
3. Check hosting service logs
4. Test API endpoints directly

---

**Note**: Replace placeholder URLs and credentials with your actual deployment URLs and credentials.