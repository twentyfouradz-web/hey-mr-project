-- Existing pending ads are published because ad approval is no longer required.
UPDATE ads SET status='approved' WHERE status='pending';
