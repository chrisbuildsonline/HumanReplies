---
inclusion: always
---

# README Maintenance Rules

## Project Documentation Standards

The HumanReplies project maintains a single, comprehensive README.md file at the project root that documents all components. This approach ensures consistency and prevents documentation fragmentation.

## Kiro Integration Rules

When making ANY changes to the project, you MUST update the README.md file to reflect:

### 1. New Features
- Add feature descriptions to relevant component sections
- Update API endpoints if backend changes
- Document new configuration options
- Add usage examples for new functionality

### 2. Architecture Changes
- Update the project structure diagrams
- Modify component descriptions
- Update integration flow documentation
- Revise deployment instructions if needed

### 3. Configuration Updates
- Update environment variable sections
- Document new settings or options
- Modify setup instructions
- Update development workflow if changed

### 4. API Changes
- Document new endpoints in backend section
- Update request/response examples
- Modify authentication requirements
- Update error handling documentation

### 5. Database Schema Changes
- Update database schema documentation
- Document new tables or columns
- Update migration instructions
- Revise data flow descriptions

## Documentation Sections to Maintain

### Extension Section
- Supported platforms
- Installation instructions
- Configuration options
- Usage examples
- Technical architecture

### Backend Section
- API endpoints
- Database schema
- Environment variables
- Development workflow
- Deployment instructions

### Dashboard Section
- Features and capabilities
- Technical stack
- Component structure
- Development setup
- Analytics data structure

### Landing Page Section
- Features and design
- Technical implementation
- Deployment process

### Integration Flow
- Data flow diagrams
- Component interactions
- Authentication flow
- Error handling

## Quality Standards

### Documentation Must Be:
1. **Accurate**: Reflect current implementation
2. **Complete**: Cover all major features and setup
3. **Clear**: Easy to understand for new developers
4. **Current**: Updated with every significant change
5. **Consistent**: Follow established formatting and style

### When to Update README
- Adding new features or components
- Modifying existing functionality
- Changing configuration requirements
- Updating dependencies or tech stack
- Modifying deployment processes
- Adding new API endpoints
- Changing database schema
- Updating environment setup

## Enforcement

This rule is enforced through:
- Kiro steering file (this document)
- Code review requirements
- Automated checks where possible
- Developer responsibility and awareness

## Example Update Scenarios

### Adding New Platform Support
```markdown
### Supported Platforms
- **X (Twitter)**: Full integration with reply generation
- **LinkedIn**: Full integration with reply generation ← ADD THIS
- **Facebook**: Coming soon
```

### New API Endpoint
```markdown
#### Replies (`/api/v1/replies`)
- `POST /` - Create new reply record
- `GET /` - Get user's replies (paginated, filterable)
- `GET /stats` - Get dashboard statistics
- `GET /recent` - Get recent reply activity
- `DELETE /{reply_id}` - Delete specific reply
- `PUT /{reply_id}` - Update specific reply ← ADD THIS
```

### New Environment Variable
```env
# API Settings
ENVIRONMENT=development
API_HOST=0.0.0.0
API_PORT=8000
RATE_LIMIT_REQUESTS=100  ← ADD THIS
```

Remember: The README.md is the single source of truth for project documentation. Keep it current, accurate, and comprehensive.