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


