# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

# design
- Always follow the existing design system; if none exists, create one (document in DESIGN.md). Confidence: 0.85
- Design for wide screens — make use of horizontal space with master-detail or similar layouts. Confidence: 0.80
- Use /impeccable for design improvements and polish. Confidence: 0.75

# workflow
- Show the plan before making changes when the request involves architectural or multi-file work. Confidence: 0.70

# database
- Use native local Postgres (Postgres.app, port 5432, db ai-sdk-app) for this project. Confidence: 0.75
- Use soft delete only — never hard delete; use deleted_at/deleted_by columns with partial unique indexes filtered on deleted_at IS NULL. Confidence: 0.85
