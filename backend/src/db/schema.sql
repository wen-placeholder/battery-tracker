CREATE DATABASE IF NOT EXISTS battery_tracker;
USE battery_tracker;

CREATE TABLE IF NOT EXISTS states (
  name       VARCHAR(50) PRIMARY KEY,
  sort_order INT NOT NULL DEFAULT 0
);

INSERT INTO states (name, sort_order) VALUES
  ('Received',    1),
  ('Incoming QC', 2),
  ('Storage',     3),
  ('Under Test',  4),
  ('Passed',      5),
  ('Failed',      6),
  ('Disposed',    7);

CREATE TABLE IF NOT EXISTS cells (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  cell_id          VARCHAR(50)  NOT NULL UNIQUE,
  manufacturer     VARCHAR(100) NOT NULL,
  chemistry        ENUM('NMC', 'NCA', 'LFP') NOT NULL,
  capacity_mah     DECIMAL(10, 2) NOT NULL,
  voltage_nominal  DECIMAL(5, 3) NOT NULL,
  batch_number     VARCHAR(50),
  received_date    DATE NOT NULL,
  notes            TEXT,
  current_state    VARCHAR(50) NOT NULL DEFAULT 'Received',
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (current_state) REFERENCES states(name)
);

CREATE TABLE IF NOT EXISTS cell_events (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  cell_id     VARCHAR(50)  NOT NULL,
  event_type  ENUM('state_change', 'correction', 'note') NOT NULL,
  from_state  VARCHAR(50),
  to_state    VARCHAR(50),
  logged_by   VARCHAR(100) NOT NULL DEFAULT 'system',
  notes       TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cell_id)    REFERENCES cells(cell_id),
  FOREIGN KEY (from_state) REFERENCES states(name),
  FOREIGN KEY (to_state)   REFERENCES states(name)
);
