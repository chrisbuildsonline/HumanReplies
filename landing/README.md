# HumanReplies Landing Page

This is the Next.js web application for HumanReplies, an AI-powered social media assistant.

## Features

- **Responsive Landing Page**: Hero section with clear value proposition and extension download link
- **User Dashboard**: Authentication-protected dashboard for managing social media connections and writing style
- **Authentication Pages**: Sign in and sign up pages with social OAuth options
- **Navigation & Layout**: Reusable navigation and footer components
- **Error Handling**: Custom error pages and loading states
- **Dark Mode Support**: Full dark mode support with Tailwind CSS

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── auth/              # Authentication pages
│   │   ├── signin/        # Sign in page
│   │   └── signup/        # Sign up page
│   ├── dashboard/         # User dashboard
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Landing page
│   ├── error.tsx          # Error boundary
│   ├── not-found.tsx      # 404 page
│   └── loading.tsx        # Loading component
├── components/            # Reusable components
│   ├── Navigation.tsx     # Main navigation
│   ├── Footer.tsx         # Site footer
│   └── Loading.tsx        # Loading spinner
└── middleware.ts          # Route protection middleware
```

## Pages

- **Landing Page** (`/`): Hero section, features, and extension download
- **Dashboard** (`/dashboard`): User account management and social media connections
- **Sign In** (`/auth/signin`): User authentication
- **Sign Up** (`/auth/signup`): User registration

## Technologies

- **Next.js 15**: React framework with App Router
- **TypeScript**: Type safety
- **Tailwind CSS**: Utility-first CSS framework
- **React 19**: Latest React features

## Requirements Addressed

This implementation addresses **Requirement 9** from the specification:
- ✅ Clean and informative landing page
- ✅ Clear hero section explaining product value proposition
- ✅ Prominent download link for Chrome extension
- ✅ Compelling information about features and benefits
- ✅ Clear information about functionality and use cases

## Next Steps

1. Integrate Clerk authentication for real user management
2. Connect to Supabase backend for data persistence
3. Add social media OAuth integration
4. Implement writing style analysis features
5. Add real Chrome extension download functionality