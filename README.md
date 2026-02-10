# Base Backend API

## Overview
This is a generic Base Backend built with Node.js and Express. It provides a solid foundation for any project with robust features:
- **Authentication**: JWT, RBAC (Admin, User, etc.).
- **Users**: Complete CRUD and profile management.
- **Uploads**: Secure file upload system with local storage.
- **JSON DB**: Built-in JSON file-based database for rapid prototyping (can differ to MongoDB/Postgres).

## Getting Started

### Prerequisites
- Node.js v16+ (Recommended)
- npm or yarn

### Installation

1.  Clone the repository
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start server:
    ```bash
    npm run dev
    ```

## Project Structure
- `controllers`: Request handlers
- `services`: Business logic
- `models/schemas`: Data definitions
- `routes`: API endpoints
- `middleware`: Auth, Logging, Validation
- `utils`: Helpers

## API Endpoints
See `routes/` for detailed endpoints.
- `/api/auth`: Register, Login, Me
- `/api/users`: User management
- `/api/upload`: File uploads

## License
MIT
