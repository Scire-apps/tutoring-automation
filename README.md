# Tutoring Automation System

A comprehensive tutoring management platform that automates the process of matching tutees with tutors, scheduling sessions, and tracking volunteer hours.

## Project Structure

```
tutoring-app/
├── frontend/          # Next.js frontend with TypeScript
├── backend/           # Flask backend API
└── .kiro/            # Kiro specs and configuration
```

## Development Setup

### Prerequisites

- Node.js (v18 or higher)
- Python 3.8+
- npm or yarn

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:3000`

### Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

The backend API will be available at `http://localhost:5000`

### Environment Configuration

1. Copy `backend/.env.example` to `backend/.env`
2. Fill in your Supabase credentials and other configuration values

## Features

- Automated tutoring opportunity creation from Google Forms
- Tutor dashboard with job management
- Admin approval system for tutors
- Session scheduling and recording upload
- Volunteer hour tracking
- Email notifications

## Tech Stack

- **Frontend**: Next.js, TypeScript, Tailwind CSS
- **Backend**: Flask, Python
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **File Storage**: Supabase Storage