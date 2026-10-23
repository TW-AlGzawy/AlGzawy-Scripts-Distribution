-- D1 one-time migration; execute ONLY after live-game QA acceptance.
-- No changes to device bindings, subscriptions, schema or global_control.
INSERT INTO portal_entitlements(user_id,script_id,allowed)
SELECT user_id,'algzawy-builder-v1',1 FROM portal_entitlements
WHERE allowed=1 AND script_id IN ('auto-builder-ar-v054','auto-builder-ar-v061','auto-builder-pro-algzawy-v3-0-free-finish','auto-builder-pro-algzawy-v3-3-fixed-queue')
GROUP BY user_id
ON CONFLICT(user_id,script_id) DO UPDATE SET allowed=1,updated_at=datetime('now');
INSERT INTO portal_preferences(user_id,script_id,enabled,settings_json)
SELECT p.user_id,'algzawy-builder-v1',MAX(p.enabled),'{}' FROM portal_preferences p
JOIN portal_entitlements e ON e.user_id=p.user_id AND e.script_id=p.script_id AND e.allowed=1
WHERE p.script_id IN ('auto-builder-ar-v054','auto-builder-ar-v061','auto-builder-pro-algzawy-v3-0-free-finish','auto-builder-pro-algzawy-v3-3-fixed-queue')
GROUP BY p.user_id
ON CONFLICT(user_id,script_id) DO NOTHING;
