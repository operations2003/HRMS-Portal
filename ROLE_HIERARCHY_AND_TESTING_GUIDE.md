# 🏢 TaskNera HRMS — Role Hierarchy & Simple Testing Guide

> **Welcome!** This guide is written in **plain, everyday English** (no confusing coding jargon).  
> It explains who does what in the portal, how permissions flow from top to bottom, and gives you ready-to-use login accounts so you can test every feature manually in minutes.

---

## 🧭 1. The Big Picture: How Roles Work in Simple Words

Think of the HRMS portal like a real company office building:

```
                  ┌──────────────────────────────────────────────┐
                  │          👑 1. ADMIN (System Boss)           │
                  │    Controls entire company, settings, RBAC   │
                  └──────────────────────┬───────────────────────┘
                                         │
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │          💼 2. HR (People Operations)        │
                  │   Hires, onboards, verifies docs, exits & F&F│
                  └──────────────────────┬───────────────────────┘
                                         │
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │        👔 3. MANAGER (Team Supervisor)       │
                  │ Approves team leaves, reviews appraisals, KPIs│
                  └──────────────────────┬───────────────────────┘
                                         │
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │         👤 4. EMPLOYEE (Staff Member)        │
                  │   Clock-in, apply leave, own docs, expenses  │
                  └──────────────────────────────────────────────┘
```

1. **👑 Admin (The Super Boss)**: Has the master keys to every room. Can create departments, change company settings, manage user logins, and see all data.
2. **💼 HR (Human Resources)**: In charge of the employees. Hires new staff, checks ID proofs in the document vault, reviews leave policies, conducts exit processes, and looks at company-wide reports.
3. **👔 Manager (Team Lead / Supervisor)**: In charge of their own specific team. Can see who in their team is working today, approve or reject team leaves, rate team performance, and check their own personal attendance/leaves.
4. **👤 Employee (Team Member)**: In charge of themselves. Can punch in/out, check their remaining leaves, submit doctor/ID documents, ask for help via helpdesk, and submit expense bills. They **cannot** see other people's private data.

---

## 📊 2. Feature Comparison: Who Can Do What?

Here is a simple checklist of every menu item in the portal and which roles have access to it:

| Menu Feature | What is it for? | 👑 Admin | 💼 HR | 👔 Manager | 👤 Employee |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Dashboard** | Main homepage with real-time stats | ✅ (Admin Stats) | ✅ (Admin/HR Stats) | ✅ **(Manager Overview)** | ✅ (My Work Hub) |
| **Manager Cockpit** | Supervisor command center for direct reports | ✅ | ✅ | ✅ | ❌ |
| **Team Management** | View team members, profiles & supervisor logs | ✅ | ✅ | ✅ (Own Team) | ❌ |
| **Approvals Center** | Approve or reject pending team requests | ✅ | ✅ | ✅ (Own Team) | ❌ |
| **Performance** | Quarterly appraisal reviews & performance scores | ✅ | ✅ | ✅ (Review team) | ✅ (Self-review only) |
| **HR Operations** | Manage contracts, employee states & audits | ✅ | ✅ | ❌ | ❌ |
| **Probation Pipeline** | Review new hires completing probation period | ✅ | ✅ | ✅ (Own Team) | ❌ |
| **HR Analytics** | Charts on attendance trends & headcount | ✅ | ✅ | ❌ | ❌ |
| **Attendance** | Daily punch clock (Clock In / Clock Out) & logs | ✅ | ✅ | ✅ | ✅ |
| **Leaves** | View holiday calendar, leave balances, apply leave | ✅ (Manage all) | ✅ (Manage all) | ✅ (Self + Team) | ✅ (Self only) |
| **Work Tasks** | Assign, track, and complete daily tasks | ✅ | ✅ | ✅ | ✅ |
| **Expenses** | Submit travel or food bills for reimbursement | ✅ (Approve) | ✅ (Approve) | ✅ (Approve team) | ✅ (Submit bills) |
| **Training & Skills**| Skill courses, training programs & certifications | ✅ | ✅ | ✅ | ✅ |
| **Engagement** | Company polls, surveys, and announcements | ✅ | ✅ | ✅ | ✅ |
| **Organizations** | Company profile & branches | ✅ | ❌ | ❌ | ❌ |
| **Onboarding** | Candidate onboarding progress & checklist | ✅ | ✅ | ❌ | ❌ |
| **Employees** | Master company employee directory | ✅ | ✅ | ❌ | ❌ |
| **Document Vault** | Upload ID, passport, contracts (stored in database) | ✅ (All company) | ✅ (All company) | ❌ (Own docs) | ✅ (Own docs only) |
| **Helpdesk** | Support tickets for IT or HR assistance | ✅ (Resolve) | ✅ (Resolve) | ✅ | ✅ (Raise ticket) |
| **Requests** | Internal requests (equipment, certificates) | ✅ | ✅ | ✅ | ✅ |
| **Departments** | Department creation & department heads | ✅ | ✅ | ❌ | ❌ |
| **User Accounts** | Create or edit user logins & passwords | ✅ | ❌ | ❌ | ❌ |
| **Resignation** | Submit resignation & initiate exit | ✅ | ✅ | ✅ | ✅ |
| **Exit Checklist** | Department clearances (IT, Finance, Admin) | ✅ | ✅ | ❌ | ❌ |
| **Offboarding** | Full deprovisioning & account closing | ✅ | ✅ | ❌ | ❌ |
| **Full & Final (F&F)**| Final settlement computation & clearance | ✅ | ✅ | ❌ | ❌ |
| **Roles & RBAC** | System security permissions & role definitions | ✅ | ❌ | ❌ | ❌ |
| **Admin Settings** | General system configurations & security flags | ✅ | ❌ | ❌ | ❌ |

---

## 🔑 3. Ready-to-Use Login Credentials for Manual Testing

Use these accounts to test each role right away. No setup needed:

| Role | Test Email Account | Password | What You Will Experience |
| :--- | :--- | :--- | :--- |
| **👑 Admin** | `shubham@tasknera.com` | `Shubham@264` | Full company-wide controls, all menus unlocked, user management, system settings. |
| **💼 HR** | `abhijeet@gmail.com` *(or `ajay1725@gmail.com`)* | `12345678` | Onboarding, employee directory, document verification, HR operations, leave approvals. |
| **👔 Manager** | `ajay@tasknera.com` | `ajay@123` | **New Manager Dashboard**, team roster status, Manager Cockpit, team leave approvals. |
| **👤 Employee** | `shreya@tasknera.com` | `12345678` | Clean personal self-service portal: Clock In/Out, apply for leave, upload personal docs. |

---

## 🧪 4. Step-by-Step Manual Testing Checklist

Follow these 4 simple walkthroughs to verify all functionalities work correctly:

---

### 🧪 Test 1: Testing as an Employee (Team Member)
**Goal:** Verify employee self-service works smoothly and other people's private data is hidden.

1. **Log in**: Use `shreya@tasknera.com` with password `12345678`.
2. **Dashboard**:
   - Notice the greeting: *"Welcome back, Shreya!"*
   - Check the 4 personal cards: *My Attendance, My Leaves, My Performance, Helpdesk*.
3. **Attendance**:
   - Click **Attendance** on the left menu.
   - Click **Clock In** button. Notice status becomes active.
4. **Leaves**:
   - Click **Leaves** on the left menu.
   - See your 11 company leave categories (Casual Leave, Sick Leave, Earned Leave, etc.).
   - Click **Apply for Leave**, select a date, and submit.
5. **Document Vault**:
   - Click **Documents** on the left menu.
   - You only see **your own** uploaded files (Aadhaar, College ID, etc.).
   - Click **Upload Onboarding Document**, choose a test image or PDF, and click upload.
   - Notice you **do not** see other employees' documents (privacy protected!).
6. **Log Out**: Click your profile icon at top-right and click **Sign Out**.

---

### 🧪 Test 2: Testing as a Manager (Supervisor / Team Lead)
**Goal:** Verify the **Manager Dashboard** and **Manager Cockpit** are two distinct, powerful tools.

1. **Log in**: Use `ajay@tasknera.com` with password `ajay@123`.
2. **Dashboard (The New Manager Dashboard)**:
   - Click **Dashboard** on the left menu (`/dashboard`).
   - Notice the **Executive Welcome Banner**: Displays how many team members are on duty today.
   - Check the 5 KPI cards:
     - *Direct Reports count*
     - *Today Presence %*
     - *On Leave Today*
     - *Pending Actions*
     - *My Attendance (with quick Clock In / Clock Out button)*
   - Look at **Today's Team Attendance & Roster**: Shows each direct report with green (Present), yellow (Late), or gray (Not Checked In).
   - Look at **Upcoming Team Availability (7-Day Forecast)**: Shows who has upcoming approved or pending leaves.
   - Look at **Priority Supervisory Approvals**: If an employee applied for leave, you can click **Approve** directly from the dashboard!
3. **Manager Cockpit (The In-Depth Workflow Tool)**:
   - Click **Manager Cockpit** on the left menu (`/manager`).
   - Notice this is the supervisory workspace: full direct reports directory, detailed appraisal review triggers, and attendance audits.
   - Compare it with the Dashboard: **Dashboard is your executive overview, Cockpit is your working tool.**
4. **Approvals**:
   - Click **Approvals** on the left menu.
   - See all pending leave and appraisal requests from your team.
5. **Log Out**: Click your profile icon at top-right and click **Sign Out**.

---

### 🧪 Test 3: Testing as HR (People Operations)
**Goal:** Verify employee hiring, company document vault, and onboarding approvals.

1. **Log in**: Use `abhijeet@gmail.com` with password `12345678`.
2. **Dashboard**:
   - You see company-wide metrics: Total Employees, Active Departments, Recent Hires.
3. **Employees**:
   - Click **Employees** on the left menu.
   - You see all staff members across the company.
4. **Document Vault**:
   - Click **Documents** on the left menu.
   - Notice the top tabs: **All Company Documents**, **By Employee Vault**, and **My Documents**.
   - In **All Company Documents**, you can see documents uploaded by Shreya, Vishal, Edwina, etc., with their name, code, and department tag!
   - Click **View** or **Download** on any document: the real document opens instantly (streamed directly from the database!).
   - You can click **Approve** or **Reject** with a reason.
5. **Onboarding**:
   - Click **Onboarding** on the left menu.
   - Review new hires transitioning into the company, check their IT setup readiness, and verification status.
6. **HR Operations & Analytics**:
   - Check **HR Operations** and **HR Analytics** for turnover and attendance reports.
7. **Log Out**: Click your profile icon at top-right and click **Sign Out**.

---

### 🧪 Test 4: Testing as Admin (The Super Boss)
**Goal:** Verify governance, system settings, and RBAC controls.

1. **Log in**: Use `shubham@tasknera.com` with password `Shubham@264`.
2. **Dashboard**:
   - Master executive command console.
3. **User Accounts & Roles**:
   - Click **User Accounts** on the left menu. You can add new user logins, deactivate accounts, or reset roles.
   - Click **Roles & RBAC** at the bottom of the menu. You can inspect exact system permissions mapped to Admin, HR, Manager, and Employee.
4. **Organizations & Departments**:
   - Click **Organizations** and **Departments** to manage company structures.
5. **Exit & Full & Final (F&F)**:
   - Access **Offboarding** and **Full & Final** to view exit clearances and settlements.

---

## 🎯 Quick Summary of Differences

| Aspect | 👑 Admin | 💼 HR | 👔 Manager | 👤 Employee |
| :--- | :--- | :--- | :--- | :--- |
| **Scope of View** | Entire System & Server | Entire Company Workforce | Own Team / Direct Reports | Only Themselves |
| **Main Focus** | System Governance & Setup | Hiring, Records & Compliance | Team Productivity & Approvals | Personal Work & Requests |
| **Dashboard Type** | System Master Console | Workforce Overview Console | **Executive Team & Self Hub** | Personal Work Hub |
| **Can Edit Logins?** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Can Approve Leaves?**| ✅ Yes | ✅ Yes | ✅ (For their team) | ❌ (Can only apply) |
| **Document Vault** | Views/Downloads All Docs | Views/Downloads/Approves All Docs | Personal Docs Only | Personal Docs Only |
