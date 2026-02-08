# Architecture

## What Goes Here?

This directory holds system architecture documentation:
- High-level system design
- Component diagrams
- Data flow diagrams
- Service interaction maps
- Technology stack overviews

## When to Document Architecture

Document architecture when:
- Starting a new project or major feature
- Making significant structural changes
- Onboarding needs system-level context
- Multiple components interact in complex ways

## What to Include

- **Diagrams**: Visual representation of the system
- **Component Descriptions**: What each piece does
- **Integration Points**: How components connect
- **Data Flow**: How information moves through the system
- **Technology Choices**: What tech and why (link to ADRs)

## Format

Use markdown with embedded diagrams:
- Mermaid for diagrams (GitHub renders it)
- ASCII diagrams for simplicity
- Images if created externally

Link to relevant ADRs that explain architectural decisions.

## Example Structure

```markdown
# System Architecture

## Overview
High-level description

## Components
- Component A: does X
- Component B: does Y

## Diagram
[mermaid diagram or ASCII art]

## Data Flow
How data moves through the system

## Related ADRs
- ADR-0005: Why we chose microservices
- ADR-0012: Database architecture
```
