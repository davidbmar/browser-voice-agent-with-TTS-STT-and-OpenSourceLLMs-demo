# Runbooks

## What is a Runbook?

A runbook is a step-by-step procedure for operational tasks. Think "how to deploy", "how to recover from X failure", or "how to debug Y issue".

## When to Create a Runbook

Create a runbook when:
- You've debugged something complex and want to remember the steps
- You have a deployment or operational procedure that needs to be repeatable
- You want to onboard someone on how to do a task
- You've solved an incident and want to document the recovery process

## Runbook Template

```markdown
# Runbook: Task Name

## Purpose
What does this accomplish?

## Prerequisites
- What needs to be true before starting?
- What access/tools are needed?

## Steps
1. Step one
2. Step two
3. ...

## Verification
How do you know it worked?

## Rollback
What if something goes wrong?

## Related
- ADR-XXXX
- Session S-YYYY-MM-DD-HHMM-slug
```

## Examples

- Deploying to production
- Rolling back a bad deploy
- Debugging database connection issues
- Setting up local development environment
- Restoring from backup
