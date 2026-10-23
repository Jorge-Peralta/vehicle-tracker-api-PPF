-- Runs once, when the Docker volume is first created.
-- Separate database for the test suite, so tests never touch development data.
CREATE DATABASE vehicle_tracker_test OWNER vehicle_tracker;
