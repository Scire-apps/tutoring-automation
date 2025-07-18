# Requirements Document

## Introduction

This tutoring automation system streamlines the process of connecting tutees with tutors through an automated workflow. The system begins with tutees submitting requests via Google Forms, displays available opportunities to registered tutors, and manages the entire tutoring lifecycle from application to completion with volunteer hour tracking.

## Requirements

### Requirement 1

**User Story:** As a tutee, I want to submit a tutoring request through a Google Form without creating an account, so that I can quickly request help when needed.

#### Acceptance Criteria

1. WHEN a tutee submits the Google Form THEN the system SHALL capture their email, subject needed, availability time range, and preferred location
2. WHEN form data is submitted THEN the system SHALL send this data to the Flask backend automatically
3. WHEN the tutoring request is received THEN the system SHALL create a new tutoring opportunity visible to eligible tutors

### Requirement 2

**User Story:** As a tutor, I want to create and manage my tutor account, so that I can access tutoring opportunities and track my volunteer hours.

#### Acceptance Criteria

1. WHEN a tutor registers THEN the system SHALL create a tutor account with school affiliation
2. WHEN a tutor logs in THEN the system SHALL display their dashboard with active jobs and volunteer hours
3. WHEN a tutor account is created THEN the system SHALL set their status as "pending approval" for all subjects

### Requirement 3

**User Story:** As a tutor, I want to view available tutoring opportunities for my school, so that I can apply for jobs that match my expertise and availability.

#### Acceptance Criteria

1. WHEN a tutor accesses the "Tutoring Opportunities" page THEN the system SHALL display all open tutoring jobs for their school
2. WHEN displaying opportunities THEN the system SHALL show tutee availability, subject, and location for each job
3. WHEN a tutor is not pre-approved for a subject THEN the system SHALL NOT allow them to click apply to that tutoring opportunity.

### Requirement 4

**User Story:** As a tutor, I want to apply for tutoring opportunities on a first-come-first-served basis, so that I can secure tutoring jobs quickly.

#### Acceptance Criteria

1. WHEN a tutor clicks apply for a job THEN the system SHALL immediately assign the job if they are the first applicant and pre-approved
2. WHEN a job is assigned THEN the system SHALL remove the opportunity from the tutoring opportunities board
3. WHEN a tutor gets assigned THEN the system SHALL redirect them to the scheduling interface

### Requirement 5

**User Story:** As a tutor, I want to schedule sessions within the tutee's availability or propose alternative times, so that we can coordinate our meeting.

#### Acceptance Criteria

1. WHEN a tutor is assigned a job THEN the system SHALL display the tutee's availability window for scheduling
2. WHEN a tutor selects a time within availability THEN the system SHALL automatically confirm the session
3. WHEN a tutor clicks "suggest a different time" THEN the system SHALL display the tutee's email for direct coordination
4. WHEN scheduling conflicts arise THEN the tutor SHALL be able to cancel and return the job to high priority on the board

### Requirement 6

**User Story:** As a superadministrator, I want to manage tutor approvals for different subjects, so that only qualified tutors can access relevant tutoring opportunities.

#### Acceptance Criteria

1. WHEN a superadmin logs in THEN the system SHALL display all tutors for their school with approval status by subject
2. WHEN a superadmin approves a tutor for a subject THEN the system SHALL update their permissions immediately
3. WHEN a superadmin views tutor profiles THEN the system SHALL show their current approvals and pending subjects

### Requirement 7

**User Story:** As the system, I want to send automatic confirmation emails to both parties when a session is scheduled, so that everyone has the meeting details.

#### Acceptance Criteria

1. WHEN a session time is confirmed THEN the system SHALL send email confirmations to both tutor and tutee
2. WHEN sending confirmations THEN the system SHALL include date, time, location, and contact information
3. WHEN emails are sent THEN the system SHALL log the communication for record keeping

### Requirement 8

**User Story:** As a tutor, I want to upload session recordings and automatically receive volunteer hours, so that I can track my community service contributions.

#### Acceptance Criteria

1. WHEN a tutoring session is completed THEN the system SHALL prompt the tutor to upload an audio or video recording
2. WHEN a recording is uploaded THEN the system SHALL calculate volunteer hours based on file duration
3. WHEN volunteer hours are calculated THEN the system SHALL add them to the tutor's account balance
4. WHEN hours are added THEN the system SHALL allow tutors to view and withdraw their accumulated hours

### Requirement 9

**User Story:** As a tutor, I want to manage my active tutoring jobs, so that I can track my commitments and cancel if necessary.

#### Acceptance Criteria

1. WHEN a tutor views their dashboard THEN the system SHALL display all active tutoring assignments
2. WHEN a tutor cancels an active job THEN the system SHALL return it to the opportunities board with high priority
3. WHEN a job is cancelled THEN the system SHALL pin it to the top of the tutoring opportunities list

### Requirement 10

**User Story:** As the system, I want to integrate with Google Forms and manage the complete tutoring workflow, so that the process is fully automated from request to completion.

#### Acceptance Criteria

1. WHEN Google Form data is received THEN the system SHALL process it through the Flask backend
2. WHEN jobs are completed THEN the system SHALL remove them from all active lists
3. WHEN the system processes any workflow step THEN it SHALL maintain data consistency across Next.js frontend and Supabase database