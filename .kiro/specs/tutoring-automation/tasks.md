# Implementation Plan

## Project Setup and Infrastructure

- [x] 1. Initialize project structure and development environment

  - Create root directory structure with separate frontend and backend folders
  - Set up Next.js frontend project with TypeScript
  - Set up Flask backend project with Python virtual environment
  - Configure development environment with necessary dependencies
  - _Requirements: 10.3_

- [x] 2. Configure database and external services
  - Set up Supabase project and configure database connection
  - Configure Google Forms API integration
  - Set up email service configuration
  - Configure file storage service for session recordings
  - _Requirements: 10.1, 7.1, 8.1_

## Core Data Models and Database Schema

- [x] 3. Implement database schema and core models

  - Create Tutor table with school affiliation and approval tracking
  - Create TutoringOpportunity table with priority and status fields
  - Create TutoringJob table for active assignments
  - Create SubjectApproval table for tutor permissions
  - Create SessionRecording and Communication tables
  - _Requirements: 2.1, 3.1, 6.2_

- [x] 3.1. Update sample data with actual schools and subjects

  - Replace fictional schools with actual school names and domains
  - Update subject list with accurate course offerings
  - Run updated SQL script in Supabase
  - Verify data is correctly inserted
  - _Requirements: 2.1, 3.1_

- [x] 4. Implement data validation and model classes
  - Create TypeScript interfaces for all data models
  - Implement Python model classes with validation
  - Add database constraints and indexes for performance
  - Write unit tests for model validation logic
  - _Requirements: 1.1, 2.1, 8.2_

## Authentication and User Management

- [x] 5. Implement tutor authentication system

  - Set up Supabase Auth integration in Next.js frontend
  - Create tutor registration flow with school affiliation
  - Implement login/logout functionality
  - Add session management and protected routes
  - _Requirements: 2.1, 2.2_

- [x] 6. Implement superadmin authentication

  - Create superadmin registration and login system
  - Add role-based access control middleware
  - Implement school-specific admin permissions
  - Create admin dashboard authentication flow
  - _Requirements: 6.1_

- [x] 6.1. Fix middleware and RLS policies for admin access

  - Resolve middleware redirect loops for admin routes
  - Implement proper RLS policies for admins and tutors tables
  - Fix role determination in authentication context
  - Migrate from simplified admin dashboard to full-featured version
  - _Requirements: 6.1, 6.2_

- [x] 6.2. Implement invitation-based admin registration system

  - Create admin invitation table and API endpoints
  - Build invitation creation interface for superadmins
  - Implement secure invitation token generation and validation
  - Create invitation-based admin registration flow
  - Generate registration links with copy-to-clipboard functionality for manual sharing
  - _Requirements: 6.1, 6.2_

- [x] 6.3. Implement school-level admin authentication and dashboard
  - Fix middleware to properly redirect school-level admins (role: 'admin') to school admin dashboard
  - Create school admin dashboard interface at `/admin/school/dashboard`
  - Implement school-specific data filtering for school admins
  - Add school admin navigation and layout components
  - Ensure school admins can only see data from their assigned school
  - Test authentication flow for both superadmins and school admins
  - _Requirements: 6.1, 6.2_

## Google Forms Integration

- [x] 7. Build Google Forms webhook handler

  - Create Flask endpoint to receive Google Forms submissions
  - Implement form data parsing and validation
  - Add error handling for malformed submissions
  - Write tests for form data processing
  - _Requirements: 1.1, 1.2, 10.1_

- [x] 7.1. Finalize Google Forms integration after deployment

  - Update Google Apps Script with actual backend webhook URL
  - Generate and configure webhook secret key
  - Deploy script to Google Forms
  - Set up trigger for form submissions
  - Test end-to-end form submission flow
  - _Requirements: 1.1, 1.2, 10.1_

- [x] 8. Implement tutoring opportunity creation
  - Process form data to create TutoringOpportunity records
  - Validate tutee email, subject, availability, and location
  - Set initial opportunity status and priority
  - Add logging for opportunity creation events
  - _Requirements: 1.3, 10.2_

## Tutor Dashboard and Opportunity Management

- [x] 9. Create tutor dashboard interface

  - Build Next.js dashboard page with active jobs display
  - Show volunteer hours balance and account status
  - Display tutor's subject approvals and pending subjects
  - Add responsive design for mobile access
  - _Requirements: 2.2, 8.4_

- [x] 10. Implement tutoring opportunities board

  - Create opportunities listing page filtered by school
  - Display tutee availability, subject, and location for each job
  - Implement real-time updates for opportunity changes
  - Add search and filter functionality
  - _Requirements: 3.1, 3.2_

- [x] 11. Build job application system
  - Add apply button with pre-approval validation
  - Implement first-come-first-served assignment logic
  - Remove assigned opportunities from the board immediately
  - Redirect to scheduling interface after assignment
  - _Requirements: 3.3, 4.1, 4.2, 4.3_

## Scheduling and Session Management

- [x] 12. Create scheduling interface

  - Display tutee availability window for assigned jobs
  - Allow time selection within availability range
  - Implement auto-confirmation for valid time selections
  - Add "suggest different time" option with tutee email display
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 13. Implement job cancellation and re-queuing
  - Add cancel button for active tutoring jobs
  - Return cancelled jobs to opportunities board with high priority
  - Pin high-priority jobs to top of opportunities list
  - Update job status and notify relevant parties
  - _Requirements: 5.4, 9.2, 9.3_

## Administrative Controls

- [ ] 14. Build superadmin dashboard

  - Create admin interface showing all tutors by school
  - Display tutor approval status for each subject
  - Show pending approval requests and tutor profiles
  - Add bulk approval functionality for efficiency
  - _Requirements: 6.1, 6.3_

- [ ] 15. Implement tutor approval management
  - Create approval/denial interface for subject permissions
  - Update tutor permissions immediately upon approval
  - Add approval history tracking and audit logs
  - Send notification emails for approval status changes
  - _Requirements: 6.2, 3.3_

## Email Notification System

- [x] 16. Build email notification service

  - Create email templates for session confirmations
  - Implement automatic email sending for scheduled sessions using Brevo API
  - Include date, time, location, and contact information
  - Add email delivery logging and error handling
  - _Requirements: 7.1, 7.2, 7.3_

- [x] 17. Implement notification triggers
  - Set up email triggers for job assignments
  - Add confirmation emails for both tutor and tutee
  - Implement cancellation and rescheduling notifications
  - Create reminder email functionality
  - _Requirements: 7.1, 7.2_

## Session Recording and Volunteer Hours

- [x] 18. Create session recording upload system

  - Build file upload interface for audio/video recordings
  - Implement secure file storage with access controls
  - Add file type validation and size restrictions
  - Create progress indicators for large file uploads
  - _Requirements: 8.1_

- [x] 19. Implement volunteer hour calculation

  - Extract duration from uploaded audio/video files
  - Calculate volunteer hours based on exact recording length (no rounding)
  - Add hours to tutor's account balance automatically
  - Create hour calculation audit trail
  - _Requirements: 8.2, 8.3_

- [ ] 20. Build volunteer hour management
  - Display accumulated hours in tutor dashboard
  - Implement hour withdrawal/tracking system
  - Add hour history and transaction logging
  - Create hour balance verification functionality
  - _Requirements: 8.4_

## Testing and Quality Assurance

- [ ] 21. Write comprehensive unit tests

  - Test all Flask API endpoints with various inputs
  - Test React components with Jest and Testing Library
  - Test database models and validation logic
  - Test email service and file upload functionality
  - _Requirements: All requirements validation_

- [ ] 22. Implement integration tests

  - Test complete user workflows from form to completion
  - Test Google Forms integration with mock data
  - Test email delivery and notification systems
  - Test file upload and hour calculation pipeline
  - _Requirements: 10.1, 10.2, 10.3_

- [ ] 23. Add end-to-end testing
  - Test tutee form submission to tutor assignment flow
  - Test admin approval workflow and permission updates
  - Test session scheduling and recording upload process
  - Test cross-browser compatibility and mobile responsiveness
  - _Requirements: Complete system validation_

## Security and Performance

- [ ] 24. Implement security measures

  - Add input sanitization and validation throughout
  - Implement rate limiting on API endpoints
  - Add file upload security scanning
  - Configure HTTPS and secure headers
  - _Requirements: Security for all user inputs_

- [ ] 25. Optimize performance and deployment
  - Add database indexing for query optimization
  - Implement caching for frequently accessed data
  - Configure production deployment environment
  - Add monitoring and logging for production use
  - _Requirements: 10.3_

## Security Hardening

- [ ] 26. Fix Supabase session/cookie parsing issues and restore proper API architecture

  - Debug and resolve the "Failed to parse cookie string" errors in Supabase client
  - Fix session token retrieval for backend API authentication
  - Restore tutor management to use proper backend API endpoints instead of direct Supabase queries
  - Implement proper server-side validation and audit logging for tutor subject approvals
  - Add rate limiting and business logic validation in backend API
  - Test authentication flow works properly across all admin interfaces
  - Ensure consistent session handling between dashboard and edit pages
  - _Requirements: Proper API architecture and security_

- [ ] 27. Implement comprehensive Row Level Security (RLS) policies
  - **Re-enable RLS on all tables** (currently disabled for development)
  - Create secure RLS policies for `admin_invitations` table with proper admin access controls
  - Implement RLS policies for `admins` table allowing self-access and superadmin management
  - Create RLS policies for `tutors` table with school-based access restrictions
  - Implement RLS policies for `tutoring_opportunities`, `tutoring_jobs`, and `subject_approvals` tables
  - Add service-level access policies for backend operations using service key
  - Test all RLS policies with different user roles (tutor, admin, superadmin)
  - Verify middleware authentication works correctly with RLS enabled
  - Document security model and access patterns for each table
  - Ensure no unauthorized data access is possible across all user types
  - _Requirements: Security for all database operations_
