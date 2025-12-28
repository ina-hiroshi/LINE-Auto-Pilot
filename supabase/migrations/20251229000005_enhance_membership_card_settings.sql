ALTER TABLE stores
ADD COLUMN IF NOT EXISTS membership_card_settings jsonb DEFAULT '{
  "card_type": "point",
  "name_display": "line_name",
  "show_icon": true,
  "show_member_no": true,
  "show_rank": true,
  "stamp_config": {
    "total_slots": 20,
    "goal_reward": "特典チケット"
  }
}'::jsonb,
ADD COLUMN IF NOT EXISTS membership_rank_settings jsonb DEFAULT '[
  {"name": "Bronze", "threshold": 0},
  {"name": "Silver", "threshold": 100},
  {"name": "Gold", "threshold": 500},
  {"name": "Platinum", "threshold": 1000}
]'::jsonb;
