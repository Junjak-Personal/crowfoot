---
description: Split a large pull request into smaller, focused PRs following skeleton review and TDD practices
---

## Task

Split the current large pull request into smaller, manageable PRs following t-wada's TDD practices and skeleton review methodology.

## Core Principles

### 1. Skeleton Review Approach
Reference: https://note.com/knowledgework/n/n50fc54509dd5

First PR should be a skeleton implementation to enable early design feedback.

### 2. TDD Practice (t-wada style)
Follow t-wada's TDD practice: Each PR must contain both feature and test code together.

### 3. PR Size Constraints
- **Hard limit**: 300 lines maximum
- **Target range**: 100-200 lines (ideal)
- **Scope**: Both implementation and test code count toward the limit

## PR Structure

### First PR: Skeleton Implementation
```
Purpose: Enable skeleton review for early architectural feedback
Contents:
- Core interfaces and contracts
- Basic class/module structure  
- Minimal implementation proving the approach
- Basic tests validating structure
- Clear TODOs for subsequent features
```

### Subsequent PRs: Feature Increments
```
Purpose: Add one small, complete feature
Contents:
- Single feature implementation
- Comprehensive tests for that feature
- Updates to skeleton if needed
- Each PR independently valuable
```

### PR Chaining Strategy
```
PR1 (Skeleton) → main branch
PR2 (Feature A) → PR1's branch
PR3 (Feature B) → PR2's branch
...continues as needed
```

## Execution Process

### Phase 1: Analysis
1. Review all current changes
2. Identify core abstractions and interfaces
3. Map features to logical units
4. Estimate line counts per unit

### Phase 2: Planning
1. Design skeleton structure
   - What interfaces are needed?
   - What's the minimal viable structure?
   - Which design patterns to showcase?

2. Plan feature PRs
   - One feature = one PR
   - Each with complete test coverage
   - Dependencies between features
   - Expected 100-200 lines each

### Phase 3: User Approval
Present a detailed split plan showing:
- Skeleton PR contents and purpose
- Each feature PR with:
  - Feature description
  - Test approach
  - Estimated line count
  - Dependencies

### Phase 4: Implementation
1. Create skeleton branch and PR first
2. Implement skeleton with tests
3. Create feature branches from skeleton
4. Implement features with TDD approach
5. Chain PRs appropriately

### Phase 5: PR Management
1. Create all PRs as **Draft** status
2. Use project template for descriptions
3. Only mark "Ready for review" after full chain exists
4. Ensure each PR description follows template

## PR Description Requirements

Use project template: `.github/pull_request_template.md`

$ARGUMENTS