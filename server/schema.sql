CREATE DATABASE IF NOT EXISTS feastflow_local
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE feastflow_local;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(120) PRIMARY KEY,
  email VARCHAR(180) NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(160) NOT NULL,
  role VARCHAR(32) NOT NULL,
  vendor_id VARCHAR(120) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY users_role_email_unique (role, email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mfa_challenges (
  id VARCHAR(120) PRIMARY KEY,
  user_id VARCHAR(120) NOT NULL,
  purpose VARCHAR(32) NOT NULL DEFAULT 'login',
  code_hash CHAR(64) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  max_attempts TINYINT UNSIGNED NOT NULL DEFAULT 5,
  expires_at DATETIME NOT NULL,
  sent_at DATETIME NOT NULL,
  verified_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY mfa_challenges_user_status_index (user_id, status),
  KEY mfa_challenges_expiry_index (expires_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vendors (
  id VARCHAR(120) PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  owner VARCHAR(160) NOT NULL,
  status VARCHAR(32) NOT NULL,
  cuisine VARCHAR(180) NOT NULL,
  address VARCHAR(240) NOT NULL,
  pincode VARCHAR(20) NOT NULL,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  location_label VARCHAR(220) NOT NULL,
  service_radius INT NOT NULL,
  distance_km DECIMAL(8,2) NOT NULL DEFAULT 0,
  rating DECIMAL(3,2) NOT NULL DEFAULT 0,
  review_count INT NOT NULL DEFAULT 0,
  response_minutes INT NOT NULL DEFAULT 0,
  min_price INT NOT NULL DEFAULT 0,
  max_guests INT NOT NULL DEFAULT 0,
  license VARCHAR(120) NOT NULL,
  image LONGTEXT NOT NULL,
  payout_due INT NOT NULL DEFAULT 0,
  admin_note TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS documents (
  id VARCHAR(120) PRIMARY KEY,
  parent_id VARCHAR(120) NOT NULL,
  parent_type VARCHAR(40) NOT NULL DEFAULT 'vendor',
  vendor_id VARCHAR(120) NOT NULL,
  document_key VARCHAR(64) NOT NULL,
  document_name VARCHAR(120) NOT NULL,
  original_file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  file_size INT NOT NULL,
  file_blob LONGBLOB NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  uploaded_by VARCHAR(120) NULL,
  uploaded_at DATETIME NOT NULL,
  approved_by VARCHAR(120) NULL,
  approved_at DATETIME NULL,
  rejection_reason TEXT NULL,
  UNIQUE KEY documents_vendor_key_unique (vendor_id, document_key),
  KEY documents_parent_index (parent_id, parent_type),
  KEY documents_status_index (status),
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vendor_service_pincodes (
  vendor_id VARCHAR(120) NOT NULL,
  pincode VARCHAR(20) NOT NULL,
  PRIMARY KEY (vendor_id, pincode),
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vendor_dietary_options (
  vendor_id VARCHAR(120) NOT NULL,
  option_name VARCHAR(80) NOT NULL,
  PRIMARY KEY (vendor_id, option_name),
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vendor_event_types (
  vendor_id VARCHAR(120) NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  PRIMARY KEY (vendor_id, event_type),
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vendor_badges (
  vendor_id VARCHAR(120) NOT NULL,
  badge VARCHAR(80) NOT NULL,
  PRIMARY KEY (vendor_id, badge),
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vendor_availability (
  vendor_id VARCHAR(120) NOT NULL,
  available_date DATE NOT NULL,
  PRIMARY KEY (vendor_id, available_date),
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vendor_packages (
  id VARCHAR(120) PRIMARY KEY,
  vendor_id VARCHAR(120) NOT NULL,
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  price_per_guest INT NOT NULL,
  min_guests INT NOT NULL,
  image LONGTEXT NOT NULL,
  instant_book TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS package_tags (
  package_id VARCHAR(120) NOT NULL,
  tag VARCHAR(80) NOT NULL,
  PRIMARY KEY (package_id, tag),
  FOREIGN KEY (package_id) REFERENCES vendor_packages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS package_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  package_id VARCHAR(120) NOT NULL,
  sort_order INT NOT NULL,
  item_text VARCHAR(180) NOT NULL,
  FOREIGN KEY (package_id) REFERENCES vendor_packages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS add_ons (
  id VARCHAR(80) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  price INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bookings (
  id VARCHAR(120) PRIMARY KEY,
  customer_id VARCHAR(120) NULL,
  vendor_id VARCHAR(120) NOT NULL,
  package_id VARCHAR(120) NOT NULL,
  customer_name VARCHAR(160) NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  event_date DATE NOT NULL,
  guests INT NOT NULL,
  note TEXT NULL,
  amount INT NOT NULL,
  deposit INT NOT NULL,
  payment_choice VARCHAR(32) NOT NULL,
  status VARCHAR(40) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY bookings_customer_index (customer_id),
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS booking_add_ons (
  booking_id VARCHAR(120) NOT NULL,
  add_on_id VARCHAR(80) NOT NULL,
  PRIMARY KEY (booking_id, add_on_id),
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS booking_timeline (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  booking_id VARCHAR(120) NOT NULL,
  sort_order INT NOT NULL,
  timeline_text VARCHAR(240) NOT NULL,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  booking_id VARCHAR(120) NOT NULL,
  sender_role VARCHAR(32) NOT NULL,
  message_text TEXT NOT NULL,
  message_time VARCHAR(32) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
  id VARCHAR(120) PRIMARY KEY,
  booking_id VARCHAR(120) NOT NULL,
  amount INT NOT NULL,
  currency VARCHAR(12) NOT NULL,
  status VARCHAR(48) NOT NULL,
  provider VARCHAR(120) NOT NULL,
  created_at DATETIME NOT NULL,
  confirmed_at DATETIME NULL,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reviews (
  booking_id VARCHAR(120) PRIMARY KEY,
  rating INT NOT NULL,
  review_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS event_log (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  body TEXT NOT NULL,
  payload JSON NULL,
  event_time VARCHAR(32) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id VARCHAR(120) PRIMARY KEY,
  user_id VARCHAR(120) NOT NULL,
  user_role VARCHAR(32) NOT NULL,
  vendor_id VARCHAR(120) NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY push_subscriptions_user_index (user_id),
  KEY push_subscriptions_role_index (user_role),
  KEY push_subscriptions_vendor_index (vendor_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mobile_push_subscriptions (
  id VARCHAR(120) PRIMARY KEY,
  user_id VARCHAR(120) NOT NULL,
  user_role VARCHAR(32) NOT NULL,
  vendor_id VARCHAR(120) NULL,
  expo_push_token VARCHAR(255) NOT NULL,
  platform VARCHAR(24) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY mobile_push_token_unique (expo_push_token),
  KEY mobile_push_user_index (user_id),
  KEY mobile_push_role_index (user_role),
  KEY mobile_push_vendor_index (vendor_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
