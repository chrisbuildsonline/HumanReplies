# Requirements Document

## Introduction

The Guardian Prompts feature extends the HumanReplies system by allowing users to set content filters and guidelines that act as guardrails for AI-generated responses. This includes the ability to specify excluded words, phrases, topics, or content types that should never appear in generated replies. The feature ensures that all AI-generated content adheres to the user's personal, professional, or brand guidelines, providing an additional layer of control over the authenticity and appropriateness of responses.

## Requirements

### Requirement 1

**User Story:** As a professional user, I want to set excluded words and phrases, so that my AI-generated replies never contain inappropriate or off-brand language.

#### Acceptance Criteria

1. WHEN accessing user settings THEN the system SHALL provide a guardian prompts configuration section
2. WHEN adding excluded words THEN the system SHALL accept individual words, phrases, or comma-separated lists
3. WHEN generating replies THEN the system SHALL scan all content against the excluded words list before presenting options
4. IF generated content contains excluded words THEN the system SHALL automatically regenerate alternative responses

### Requirement 2

**User Story:** As a brand manager, I want to set topic restrictions, so that AI replies avoid sensitive subjects that could harm my company's reputation.

#### Acceptance Criteria

1. WHEN configuring guardian prompts THEN users SHALL be able to specify restricted topics or themes
2. WHEN analyzing original posts THEN the system SHALL identify if topics relate to restricted subjects
3. WHEN restricted topics are detected THEN the system SHALL either skip reply generation or create neutral responses
4. IF a user attempts to reply to restricted content THEN the system SHALL warn them about potential policy violations

### Requirement 3

**User Story:** As a content creator, I want to set positive guidelines for tone and messaging, so that my replies consistently reflect my desired brand voice and values.

#### Acceptance Criteria

1. WHEN setting guardian prompts THEN users SHALL be able to define positive guidelines for tone, messaging, and values
2. WHEN generating replies THEN the system SHALL incorporate these positive guidelines into the framework prompt
3. WHEN reviewing generated content THEN users SHALL see responses that align with their specified brand voice
4. IF generated content conflicts with positive guidelines THEN the system SHALL prioritize guideline adherence over other factors

### Requirement 4

**User Story:** As a user with multiple accounts, I want different guardian prompt settings for different platforms or contexts, so that I can maintain appropriate boundaries for personal vs. professional interactions.

#### Acceptance Criteria

1. WHEN managing guardian prompts THEN users SHALL be able to create different rule sets for different platforms or account types
2. WHEN switching between connected accounts THEN the system SHALL automatically apply the appropriate guardian prompt settings
3. WHEN generating replies THEN the system SHALL use context-specific restrictions based on the current platform and account
4. IF no specific rules exist for a platform THEN the system SHALL apply default guardian prompt settings

### Requirement 5

**User Story:** As a user, I want to easily manage and update my guardian prompts, so that I can refine my content guidelines as my needs evolve.

#### Acceptance Criteria

1. WHEN accessing guardian prompt settings THEN users SHALL see an intuitive interface for adding, editing, and removing restrictions
2. WHEN updating guardian prompts THEN changes SHALL take effect immediately for new reply generations
3. WHEN managing large lists THEN users SHALL be able to import/export guardian prompt configurations
4. IF users want to test settings THEN they SHALL be able to preview how restrictions affect sample content

### Requirement 6

**User Story:** As a user, I want to see when guardian prompts have influenced my replies, so that I understand how the filtering is working and can adjust settings if needed.

#### Acceptance Criteria

1. WHEN guardian prompts affect reply generation THEN the system SHALL provide subtle indicators in the UI
2. WHEN content is filtered or modified THEN users SHALL be able to see what restrictions were applied
3. WHEN reviewing reply history THEN users SHALL be able to identify which responses were influenced by guardian prompts
4. IF users want more details THEN they SHALL be able to access logs showing specific filtering actions

### Requirement 7

**User Story:** As a team administrator, I want to set organization-wide guardian prompts, so that all team members' AI-generated content adheres to company policies and brand guidelines.

#### Acceptance Criteria

1. WHEN managing team settings THEN administrators SHALL be able to define organization-wide guardian prompts
2. WHEN team members generate replies THEN the system SHALL apply both personal and organizational restrictions
3. WHEN conflicts arise THEN organizational guardian prompts SHALL take precedence over personal settings
4. IF team members need exceptions THEN administrators SHALL be able to grant specific overrides or exemptions

### Requirement 8

**User Story:** As a user, I want guardian prompts to work seamlessly with my existing writing style preferences, so that content filtering doesn't compromise the authenticity of my voice.

#### Acceptance Criteria

1. WHEN applying guardian prompts THEN the system SHALL maintain the user's established writing style and tone
2. WHEN content is filtered THEN replacement suggestions SHALL match the user's authentic voice patterns
3. WHEN generating alternatives THEN the system SHALL find creative ways to express ideas within the guardian prompt constraints
4. IF guardian prompts severely limit expression THEN the system SHALL suggest adjustments to the restrictions

### Requirement 9

**User Story:** As a user, I want pre-built guardian prompt templates for common use cases, so that I can quickly set up appropriate content guidelines without starting from scratch.

#### Acceptance Criteria

1. WHEN setting up guardian prompts THEN users SHALL see templates for common scenarios (professional, casual, brand-safe, family-friendly)
2. WHEN selecting templates THEN users SHALL be able to customize and modify the pre-built restrictions
3. WHEN using templates THEN the system SHALL explain what each template includes and why
4. IF users want to share templates THEN they SHALL be able to export and import custom guardian prompt configurations

### Requirement 10

**User Story:** As a user, I want guardian prompts to learn from my manual edits and rejections, so that the system becomes more accurate at predicting what content I find acceptable.

#### Acceptance Criteria

1. WHEN users edit or reject generated replies THEN the system SHALL analyze patterns in the modifications
2. WHEN consistent editing patterns emerge THEN the system SHALL suggest new guardian prompt rules
3. WHEN users approve suggested rules THEN they SHALL be automatically added to the guardian prompt configuration
4. IF the learning system makes incorrect suggestions THEN users SHALL be able to dismiss and provide feedback