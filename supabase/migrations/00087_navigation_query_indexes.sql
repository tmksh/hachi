-- Match frequent navigation/sidebar filters. No change to RLS or returned rows.
-- Apply through the normal migration deployment; large tables may need a concurrent
-- index rollout outside a transaction after checking production table sizes.
CREATE INDEX IF NOT EXISTS idx_workflow_steps_pending_approver
  ON workflow_steps (approver_id, request_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_workflow_steps_request_order
  ON workflow_steps (request_id, step_order);

CREATE INDEX IF NOT EXISTS idx_internal_messages_recipient_unread
  ON internal_messages (recipient_id)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_contractor_orders_construction_created
  ON contractor_orders (construction_id, created_at DESC);
