# Le Bain Code Backend

Backend API for Le Bain Code's learning platform. Handles user authentication and progress tracking.

## Quick Setup

1. Install MongoDB:
```bash
brew tap mongodb/brew
brew install mongodb-community@7.0
brew services start mongodb-community@7.0
```
2. Configure Environment:
```bash
# Create .env file with:
MONGODB_URI=mongodb://localhost:27017/lebaincode
JWT_SECRET=[generate with node crypto]
PORT=5000
```

3. Install & Run:
```bash
npm install
npm run create-admin [username] [password]  # Create admin user
npm run dev                                 # Start development server
```
## Features
- User authentication with JWT
- Organization-based access control

## Testing
Use Postman to test endpoints:
- POST /api/auth/login

### To run API and back locally
    1. Clone both frontend and backend repos
```bash 
    git clone [frontend-repo-url]
    git clone [backend-repo-url]
```

    2. Install dependencies for both

    3. Copy and configure environment variables
 ```bash 
    cp .env.example .env
```

    4. Import the database 
```bash
    mongorestore --db your_database_name ./backup/your_database_name
    # Check if backup folder exists
    ls ./backup/lebaincode
```

    5. Start both servers
    - Terminal 1 (backend):
    - Terminal 2 (frontend):

## 🔐 GitHub OAuth Authentication

### Configuration
1. Create `.env` file with the project's GitHub OAuth credentials (get from maintainer):
```bash
GITHUB_CLIENT_ID=provided_client_id
GITHUB_CLIENT_SECRET=provided_client_secret
JWT_SECRET=your_jwt_secret
```
Development Setup
- The project uses an existing GitHub OAuth App configured with:
    - Homepage URL: http://localhost:3000 (development)
    - Callback URL: http://localhost:5000/api/auth/github/callback (development)
- Start the server:
```bash
NODE_ENV=development node src/server.js
```

Authentication Flow
- GET /api/auth/github: Initiates GitHub OAuth flow
- GET /api/auth/github/callback: Handles OAuth callback
- GET /api/user/profile: Returns authenticated user data

Testing Locally
- Ensure MongoDB is running
- Start the server on port 5000
- Frontend should be running on port 3000
- Test GitHub authentication flow through frontend

Note: You don't need to create your own GitHub OAuth app - the project uses a shared one for development.

